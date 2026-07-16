import { Router, Response } from 'express';
import { pool } from '../db';
import { AuthenticatedRequest, authenticateToken, requireRole } from '../middleware/auth';
import { QueueService } from '../services/queue';
import { generateFhirBundle, fhirJsonToXml } from '../services/fhir';
import { GuardrailsService } from '../services/guardrails';
import { activeCallSockets } from '../activeCalls';

const router = Router();

// Apply clinician role check to all routes here
router.use(authenticateToken as any);
router.use(requireRole('clinician') as any);

// Get dashboard stats
router.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const totalSessions = await pool.query('SELECT COUNT(*) FROM intake_sessions');
    const activeSessions = await pool.query("SELECT COUNT(*) FROM intake_sessions WHERE status = 'active'");
    const escalatedSessions = await pool.query("SELECT COUNT(*) FROM intake_sessions WHERE status = 'escalated'");
    const completedSessions = await pool.query("SELECT COUNT(*) FROM intake_sessions WHERE status = 'completed'");
    
    const triageLevels = await pool.query(
      `SELECT triage_level as "level", COUNT(*) as count 
       FROM intake_sessions 
       WHERE triage_level IS NOT NULL 
       GROUP BY triage_level`
    );

    const safetyStats = await pool.query(
      `SELECT event_type as "type", COUNT(*) as count 
       FROM safety_events 
       GROUP BY event_type`
    );

    const recentSafetyEvents = await pool.query(
      `SELECT id, session_id as "sessionId", event_type as "eventType", 
              input_content as "inputContent", response_blocked as "responseBlocked", 
              confidence_score as "confidenceScore", created_at as "createdAt"
       FROM safety_events
       ORDER BY created_at DESC
       LIMIT 10`
    );

    res.json({
      counts: {
        total: parseInt(totalSessions.rows[0].count, 10),
        active: parseInt(activeSessions.rows[0].count, 10),
        escalated: parseInt(escalatedSessions.rows[0].count, 10),
        completed: parseInt(completedSessions.rows[0].count, 10),
      },
      triage: triageLevels.rows,
      safety: {
        counts: safetyStats.rows,
        recent: recentSafetyEvents.rows,
      }
    });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ error: 'Failed to retrieve stats.' });
  }
});

// Live Security Audit / Guardrail sandbox tester
router.post('/test-guardrail', async (req: AuthenticatedRequest, res: Response) => {
  const { input } = req.body;
  if (!input) {
    res.status(400).json({ error: 'Input text is required for guardrail testing.' });
    return;
  }

  const startTime = Date.now();

  try {
    // 1. Scan for prompt injection (heuristics + AI classifier)
    const injectionResult = await GuardrailsService.scanInputForInjection(input);

    // 2. Scan for medical advice
    const medicalAdviceResult = GuardrailsService.scanOutputForMedicalAdvice(input);

    // 3. Scan for emergency red flags
    const redFlagResult = GuardrailsService.evaluateRedFlags(input);

    const latencyMs = Date.now() - startTime;

    res.json({
      input,
      latencyMs,
      injection: {
        isBlocked: injectionResult.isBlocked,
        reason: injectionResult.reason || 'Clear',
        confidence: injectionResult.confidence,
      },
      medicalAdvice: {
        isBlocked: medicalAdviceResult.isBlocked,
        cleanOutput: medicalAdviceResult.cleanOutput,
      },
      redFlags: {
        isRedFlag: redFlagResult.isRedFlag,
        warningMessage: redFlagResult.warningMessage || null,
      }
    });
  } catch (err: any) {
    console.error('Test guardrail error:', err);
    res.status(500).json({ error: 'Failed to execute guardrail simulation: ' + err.message });
  }
});

// Update/Edit SOAP summary
router.put('/sessions/:id/summary', async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;
  const { summaryData } = req.body;

  if (!summaryData) {
    res.status(400).json({ error: 'Summary data is required.' });
    return;
  }

  try {
    // Check if session exists
    const sessionRes = await pool.query('SELECT 1 FROM intake_sessions WHERE id = $1', [id]);
    if (sessionRes.rowCount === 0) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }

    // Save summary edits
    const result = await pool.query(
      `INSERT INTO intake_summaries (session_id, summary_data, status)
       VALUES ($1, $2, 'pending')
       ON CONFLICT (session_id) 
       DO UPDATE SET summary_data = EXCLUDED.summary_data, status = 'pending'
       RETURNING *`,
      [id, JSON.stringify(summaryData)]
    );

    // Update session step to completed
    await pool.query(
      `UPDATE intake_sessions SET status = 'completed', current_step = 'completed', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (session_id, user_id, action, details)
       VALUES ($1, $2, $3, $4)`,
      [id, req.user?.id, 'summary_update', JSON.stringify({ summaryData })]
    );

    res.json({ success: true, summary: result.rows[0] });
  } catch (err) {
    console.error('Update summary error:', err);
    res.status(500).json({ error: 'Failed to update summary.' });
  }
});

// Trigger EHR Sync
router.post('/sessions/:id/sync', async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;

  try {
    const summaryRes = await pool.query(
      `SELECT summary_data as "summaryData", status
       FROM intake_summaries
       WHERE session_id = $1`,
      [id]
    );

    if (summaryRes.rowCount === 0) {
      res.status(404).json({ error: 'SOAP summary not found for this session. Complete the intake first.' });
      return;
    }

    const { summaryData, status } = summaryRes.rows[0];

    if (status === 'synced') {
      res.status(400).json({ error: 'This summary has already been synced to the EHR.' });
      return;
    }

    // Trigger queue worker
    await QueueService.enqueueSync(id, summaryData);

    res.json({ success: true, message: 'EHR sync job enqueued successfully.' });
  } catch (err) {
    console.error('Trigger sync error:', err);
    res.status(500).json({ error: 'Failed to initiate EHR sync.' });
  }
});

// Export session data as HL7 FHIR Bundle (JSON or XML)
router.get('/sessions/:id/fhir', async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;
  const format = req.query.format as string;
  const acceptHeader = req.headers.accept || '';

  try {
    const bundle = await generateFhirBundle(id);

    if (format === 'xml' || acceptHeader.includes('xml') || acceptHeader.includes('application/fhir+xml')) {
      const xml = fhirJsonToXml(bundle);
      res.setHeader('Content-Type', 'application/fhir+xml');
      res.send(xml);
    } else {
      res.setHeader('Content-Type', 'application/fhir+json');
      res.json(bundle);
    }
  } catch (err: any) {
    console.error('Export FHIR error:', err);
    if (err.message === 'Session not found') {
      res.status(404).json({ error: 'Session not found.' });
    } else {
      res.status(500).json({ error: 'Failed to export FHIR bundle.' });
    }
  }
});

// Check drug-drug and drug-allergy interactions
router.get('/sessions/:id/interactions', async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;

  try {
    // 1. Fetch medications from medications table
    const medsRes = await pool.query(
      'SELECT name FROM medications WHERE session_id = $1',
      [id]
    );

    // 2. Fetch summary_data (which contains updated medications and allergies lists)
    const summaryRes = await pool.query(
      'SELECT summary_data as "summaryData" FROM intake_summaries WHERE session_id = $1',
      [id]
    );

    // 3. Compile all active medications and allergies
    const activeMeds: string[] = medsRes.rows.map(m => m.name);
    const activeAllergies: string[] = [];

    if (summaryRes.rows.length > 0 && summaryRes.rows[0].summaryData) {
      const soap = summaryRes.rows[0].summaryData;
      
      // Add meds from summary if they are not already in list
      if (Array.isArray(soap.medications)) {
        soap.medications.forEach((med: any) => {
          const medName = typeof med === 'string' ? med : med.name;
          if (medName && !activeMeds.some(m => m.toLowerCase() === medName.toLowerCase())) {
            activeMeds.push(medName);
          }
        });
      }

      // Add allergies from summary
      if (Array.isArray(soap.allergies)) {
        soap.allergies.forEach((allergy: any) => {
          if (typeof allergy === 'string' && allergy) {
            activeAllergies.push(allergy);
          }
        });
      }
    }

    // If there are no medications and no allergies, return empty alerts list
    if (activeMeds.length === 0 && activeAllergies.length === 0) {
      res.json({ alerts: [] });
      return;
    }

    // 4. Fetch all interaction rules from database
    const rulesRes = await pool.query(
      'SELECT id, rule_type as "ruleType", trigger_item as "triggerItem", conflict_item as "conflictItem", severity, description FROM interaction_rules'
    );

    const alerts: any[] = [];

    // 5. Evaluate rules against active meds and allergies
    rulesRes.rows.forEach(rule => {
      const triggerLower = rule.triggerItem.toLowerCase();
      const conflictLower = rule.conflictItem.toLowerCase();

      if (rule.ruleType === 'drug_drug') {
        // Find if trigger_item is in active medications AND conflict_item is in active medications
        const hasTrigger = activeMeds.some(med => med.toLowerCase().includes(triggerLower));
        const hasConflict = activeMeds.some(med => med.toLowerCase().includes(conflictLower));

        if (hasTrigger && hasConflict) {
          alerts.push({
            ruleId: rule.id,
            ruleType: 'drug_drug',
            severity: rule.severity,
            triggerItem: rule.triggerItem,
            conflictItem: rule.conflictItem,
            description: rule.description
          });
        }
      } else if (rule.ruleType === 'drug_allergy') {
        // Find if trigger_item is in active medications AND conflict_item is in patient allergies
        const hasTrigger = activeMeds.some(med => med.toLowerCase().includes(triggerLower));
        const hasAllergyConflict = activeAllergies.some(allergy => allergy.toLowerCase().includes(conflictLower));

        if (hasTrigger && hasAllergyConflict) {
          alerts.push({
            ruleId: rule.id,
            ruleType: 'drug_allergy',
            severity: rule.severity,
            triggerItem: rule.triggerItem,
            conflictItem: rule.conflictItem,
            description: rule.description
          });
        }
      }
    });

    res.json({ alerts });
  } catch (err) {
    console.error('Check interactions error:', err);
    res.status(500).json({ error: 'Failed to evaluate clinical interactions.' });
  }
});

// Get all PHI Redaction compliance audit logs
router.get('/phi-logs', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT l.id, l.session_id as "sessionId", l.phi_type as "phiType", 
              l.original_content as "originalContent", l.redacted_content as "redactedContent", 
              l.created_at as "createdAt", p.name as "patientName"
       FROM phi_redaction_logs l
       LEFT JOIN intake_sessions s ON l.session_id = s.id
       LEFT JOIN patients p ON s.patient_id = p.id
       ORDER BY l.created_at DESC
       LIMIT 50`
    );
    res.json({ logs: result.rows });
  } catch (err) {
    console.error('Get PHI logs error:', err);
    res.status(500).json({ error: 'Failed to retrieve PHI redaction logs.' });
  }
});

// Get all active voice telephony sessions
router.get('/active-calls', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const calls = await Promise.all(
      Array.from(activeCallSockets.entries()).map(async ([sessionId, call]) => {
        // Query latest vitals from DB
        const vitalsRes = await pool.query(
          `SELECT heart_rate as "heartRate", spo2, bp_systolic as "bpSystolic", bp_diastolic as "bpDiastolic"
           FROM session_vitals
           WHERE session_id = $1
           ORDER BY created_at DESC
           LIMIT 1`,
          [sessionId]
        );
        return {
          sessionId,
          patientName: call.patientName,
          messages: call.messages,
          vitals: vitalsRes.rowCount ? vitalsRes.rows[0] : null
        };
      })
    );
    res.json({ activeCalls: calls });
  } catch (err) {
    console.error('Get active calls error:', err);
    res.status(500).json({ error: 'Failed to retrieve active calls.' });
  }
});

// Send clinician barge-in message override
router.post('/active-calls/:id/barge-in', async (req: AuthenticatedRequest, res: Response) => {
  const sessionId = req.params.id as string;
  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Barge-in message is required and must be a string.' });
    return;
  }

  try {
    const call = activeCallSockets.get(sessionId);
    if (!call) {
      res.status(404).json({ error: 'Active call session not found.' });
      return;
    }

    // Send frame to WS client
    call.ws.send(JSON.stringify({
      type: 'barge_in',
      text: message
    }));

    // Record the message in memory
    call.messages.push({
      sender: 'agent',
      content: `[Barge-in Override]: ${message}`,
      createdAt: new Date().toISOString()
    });

    // Save override to database
    await pool.query(
      `INSERT INTO messages (session_id, sender, content)
       VALUES ($1, $2, $3)`,
      [sessionId, 'agent', `[Barge-in Override]: ${message}`]
    );

    // Save audit log
    await pool.query(
      `INSERT INTO audit_logs (session_id, user_id, action, details)
       VALUES ($1, $2, $3, $4)`,
      [sessionId, req.user?.id, 'clinician_barge_in', JSON.stringify({ message })]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Clinician barge-in error:', err);
    res.status(500).json({ error: 'Failed to execute clinician barge-in.' });
  }
});

export default router;
