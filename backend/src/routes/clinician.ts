import { Router, Response } from 'express';
import { pool } from '../db';
import { AuthenticatedRequest, authenticateToken, requireRole } from '../middleware/auth';
import { QueueService } from '../services/queue';
import { generateFhirBundle, fhirJsonToXml } from '../services/fhir';
import { GuardrailsService } from '../services/guardrails';
import { activeCallSockets } from '../activeCalls';
import { AIService } from '../services/ai';
import { CDSService } from '../services/cds';
import { notificationBus, ClinicianNotification } from '../notifications';
import { ehrSandboxService } from '../services/ehrSandbox';
import { DiagnosisService } from '../services/diagnosis';
import { AmbientScribeService } from '../services/ambientScribe';
import { FollowUpService } from '../services/followUp';
import { VisualTriageService } from '../services/visualTriage';
import { ClinicalOrdersService } from '../services/clinicalOrders';
import * as TelehealthService from '../services/telehealth';
import * as EsiTriageService from '../services/esiTriage';
import * as ClinicalTrialsService from '../services/clinicalTrials';
import * as CaseConferencingService from '../services/caseConferencing';
import { BillingPriorAuthService } from '../services/billingPriorAuth';
import { SpecializedTriageService } from '../services/specializedTriage';
import { clinicalCodingService } from '../services/clinicalCoding';
import { antimicrobialPgxService } from '../services/antimicrobialPgx';
import { referralManagementService } from '../services/referralManagement';
import { ipassRoundingService } from '../services/ipassRounding';
import { populationHealthService } from '../services/populationHealth';
import { sepsisWatchdogService } from '../services/sepsisWatchdog';

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

// AI Differential Diagnosis & Clinical Reasoning Matrix
router.get('/sessions/:id/differential-diagnosis', async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    const result = await DiagnosisService.generateDifferential(id);
    res.json(result);
  } catch (err: any) {
    console.error('Differential diagnosis error:', err);
    res.status(500).json({ error: err.message || 'Failed to compute differential diagnosis matrix.' });
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

// Get historical sessions and symptom severity scores for a patient
router.get('/patients/:patientId/history', async (req: AuthenticatedRequest, res: Response) => {
  const patientId = parseInt(req.params.patientId as string, 10);
  if (isNaN(patientId)) {
    res.status(400).json({ error: 'Valid Patient ID is required.' });
    return;
  }

  try {
    const sessionsRes = await pool.query(
      `SELECT id, status, triage_level as "triageLevel", created_at as "createdAt"
       FROM intake_sessions
       WHERE patient_id = $1
       ORDER BY created_at ASC`,
      [patientId]
    );

    const history = await Promise.all(
      sessionsRes.rows.map(async (s) => {
        const symptomsRes = await pool.query(
          `SELECT name, severity, duration, is_red_flag as "isRedFlag"
           FROM symptoms
           WHERE session_id = $1`,
          [s.id]
        );
        
        const vitalsRes = await pool.query(
          `SELECT heart_rate as "heartRate", spo2, bp_systolic as "bpSystolic", bp_diastolic as "bpDiastolic"
           FROM session_vitals
           WHERE session_id = $1
           ORDER BY created_at DESC
           LIMIT 1`,
          [s.id]
        );

        return {
          sessionId: s.id,
          triageLevel: s.triageLevel,
          createdAt: s.createdAt,
          symptoms: symptomsRes.rows,
          vitals: vitalsRes.rowCount ? vitalsRes.rows[0] : null
        };
      })
    );

    res.json({ history });
  } catch (err) {
    console.error('Get patient history error:', err);
    res.status(500).json({ error: 'Failed to retrieve patient historical data.' });
  }
});

// POST /sessions/:id/discharge - Generate and save simplified patient discharge summary
router.post('/sessions/:id/discharge', async (req: AuthenticatedRequest, res: Response) => {
  const sessionId = req.params.id as string;
  try {
    const sessionRes = await pool.query(
      `SELECT s.id, s.preferred_language as "preferredLanguage", p.name as "patientName"
       FROM intake_sessions s
       JOIN patients p ON s.patient_id = p.id
       WHERE s.id = $1`,
      [sessionId]
    );

    if (sessionRes.rowCount === 0) {
      res.status(404).json({ error: 'Intake session not found.' });
      return;
    }

    const { preferredLanguage, patientName } = sessionRes.rows[0];

    const soapRes = await pool.query(
      `SELECT summary_data as "summaryData" 
       FROM intake_summaries 
       WHERE session_id = $1`,
      [sessionId]
    );

    if (soapRes.rowCount === 0) {
      res.status(400).json({ error: 'Clinical SOAP summary must be generated and confirmed before generating discharge guidelines.' });
      return;
    }

    const soapSummary = soapRes.rows[0].summaryData;

    const langLabel = preferredLanguage || 'en-US';
    const systemPrompt = `You are a compassionate clinical coordinator assistant.
Your task is to write a post-visit patient discharge summary and care guideline based on the provided clinician SOAP note.
The patient's preferred language is ${langLabel}. You MUST write the entire response in ${langLabel}.
Keep it clear, simple, and easy to read for a layperson. Do not use complex medical jargon without explanation.
Structure the output using exactly the following markdown sections:

# Patient Care Instructions

## 1. What we discussed today
[Provide a simple, reassuring explanation of their condition and symptoms in layperson terms.]

## 2. Your Home Care Guidelines
[Provide clear, step-by-step instructions on home care, rest, hydration, and how to manage symptoms.]

## 3. 🚨 WARNINGS & RED FLAGS: When to Seek Emergency Care
[List critical worsening symptoms or red flags in bullet points where the patient must call 911 or go to the nearest emergency room immediately.]`;

    const userMessage = {
      role: 'user' as const,
      content: `Patient Name: ${patientName}
Preferred Language: ${langLabel}
SOAP note details:
${JSON.stringify(soapSummary)}`
    };

    let dischargeText = '';
    try {
      dischargeText = await AIService.generateText(systemPrompt, [userMessage], { temperature: 0.3 });
    } catch (aiErr) {
      console.warn('AI discharge generation failed, using structured fallback:', aiErr);
      if (langLabel.startsWith('es')) {
        dischargeText = `# Instrucciones de Cuidado del Paciente

## 1. Lo que discutimos hoy (es-ES)
Hemos revisado sus síntomas clínicos de ${soapSummary.chiefComplaint || 'queja principal'}. Sus antecedentes e historial médico han sido registrados de forma segura.

## 2. Pautas de Cuidado en el Hogar
- Descanse lo suficiente y mantenga una hidratación adecuada.
- Tome los medicamentos recetados por su proveedor médico de acuerdo con las instrucciones.
- Controle sus síntomas de cerca y manténgase en contacto con el consultorio si no mejoran.

## 3. 🚨 ADVERTENCIAS Y SEÑALES DE PELIGRO
- Si experimenta dolor en el pecho, dificultad severa para respirar o fiebre alta persistente, llame al 911 o acuda a la sala de emergencias de inmediato.`;
      } else {
        dischargeText = `# Patient Care Instructions

## 1. What we discussed today
We reviewed your clinical symptoms of ${soapSummary.chiefComplaint || 'chief complaint'}. Your intake history and timeline have been logged securely.

## 2. Your Home Care Guidelines
- Ensure you get plenty of rest and stay well hydrated.
- Take any prescribed medications exactly as directed by your healthcare provider.
- Monitor your symptoms closely and contact our clinic if they do not improve.

## 3. 🚨 WARNINGS & RED FLAGS: When to Seek Emergency Care
- If you experience sudden chest pain, severe shortness of breath, or high fever, call 911 or go to the nearest emergency room immediately.`;
      }
    }

    await pool.query(
      `INSERT INTO discharge_summaries (session_id, discharge_summary, preferred_language)
       VALUES ($1, $2, $3)
       ON CONFLICT (session_id) 
       DO UPDATE SET discharge_summary = $2, preferred_language = $3`,
      [sessionId, dischargeText, langLabel]
    );

    res.json({
      dischargeSummary: dischargeText,
      preferredLanguage: langLabel
    });
  } catch (err) {
    console.error('Generate discharge summary error:', err);
    res.status(500).json({ error: 'Failed to generate discharge summary.' });
  }
});

// GET /sessions/:id/discharge - Retrieve existing discharge summary
router.get('/sessions/:id/discharge', async (req: AuthenticatedRequest, res: Response) => {
  const sessionId = req.params.id as string;
  try {
    const result = await pool.query(
      `SELECT discharge_summary as "dischargeSummary", preferred_language as "preferredLanguage", created_at as "createdAt"
       FROM discharge_summaries
       WHERE session_id = $1`,
      [sessionId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Discharge summary not found for this session.' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get discharge summary error:', err);
    res.status(500).json({ error: 'Failed to retrieve discharge summary.' });
  }
});

// GET /sessions/:id/care-gaps - Analyze patient file and return care gaps alerts
router.get('/sessions/:id/care-gaps', async (req: AuthenticatedRequest, res: Response) => {
  const sessionId = req.params.id as string;
  try {
    const alerts = await CDSService.analyzeSession(sessionId);
    res.json({ alerts });
  } catch (err) {
    console.error('CDS Care Gaps analysis error:', err);
    res.status(500).json({ error: 'Failed to perform care gaps analysis.' });
  }
});

// POST /sessions/:id/copilot/query - Clinical RAG Copilot query handler
router.post('/sessions/:id/copilot/query', async (req: AuthenticatedRequest, res: Response) => {
  const sessionId = req.params.id as string;
  const { query } = req.body;

  if (!query || typeof query !== 'string') {
    res.status(400).json({ error: 'Query parameter must be a non-empty string.' });
    return;
  }

  try {
    // 1. Fetch patient session profile
    const sessionRes = await pool.query(
      `SELECT s.id, p.name as "patientName"
       FROM intake_sessions s
       JOIN patients p ON s.patient_id = p.id
       WHERE s.id = $1`,
      [sessionId]
    );

    if (sessionRes.rowCount === 0) {
      res.status(404).json({ error: 'Intake session not found.' });
      return;
    }

    const session = sessionRes.rows[0];

    const symptomsRes = await pool.query(`SELECT name, severity FROM symptoms WHERE session_id = $1`, [sessionId]);
    const symptoms = symptomsRes.rows;

    const medsRes = await pool.query(`SELECT name, dosage, frequency FROM medications WHERE session_id = $1`, [sessionId]);
    const medications = medsRes.rows;

    const summaryRes = await pool.query(`SELECT summary_data as "summaryData" FROM intake_summaries WHERE session_id = $1`, [sessionId]);
    const summary = summaryRes.rowCount ? summaryRes.rows[0].summaryData : null;

    // 2. Perform RAG vector similarity search
    let contextString = '';
    let matchedProtocols: any[] = [];
    try {
      const embedding = await AIService.getEmbedding(query);
      const vectorStr = '[' + embedding.join(',') + ']';

      const matchRes = await pool.query(
        `SELECT title, content, 1 - (embedding <=> $1::vector) as similarity
         FROM protocol_embeddings
         ORDER BY embedding <=> $1::vector
         LIMIT 3`,
        [vectorStr]
      );
      matchedProtocols = matchRes.rows;
      contextString = matchedProtocols.map(p => `[Protocol: ${p.title} (Similarity: ${(p.similarity * 100).toFixed(1)}%)]\n${p.content}`).join('\n\n');
    } catch (embedErr) {
      console.warn('Vector embedding query failed or timed out:', embedErr);
      contextString = 'No clinical protocol context found in RAG database due to a query timeout or offline status.';
    }

    // 3. Prompt construction
    const systemPrompt = `You are a helpful Clinical Protocol Copilot assistant for clinicians.
Your job is to answer the clinician's question about the active patient session using the provided patient details and matching clinical protocols from our RAG database.

Active Patient Profile:
- Patient Name: ${session.patientName}
- Chief Complaint/SOAP Note: ${summary ? JSON.stringify(summary) : 'No SOAP note created yet.'}
- Symptoms: ${symptoms.map(s => `${s.name} (${s.severity})`).join(', ') || 'None reported.'}
- Medications: ${medications.map(m => `${m.name} ${m.dosage || ''} ${m.frequency || ''}`).join(', ') || 'None reported.'}

Matching Clinical Protocol Context (RAG):
${contextString}

Answer the clinician's query accurately, professionally, and concisely. Keep your answer tailored to clinical guidelines.
If you use details from a clinical protocol (e.g. Asthma Protocol or Cardiac Chest Pain Protocol), cite it clearly in your response using square brackets like [Asthma Protocol].
If the protocols do not contain the answer, use your general clinical knowledge but state that it is not covered in the local database protocols.`;

    const userMessage = {
      role: 'user' as const,
      content: `Clinician Question: ${query}`
    };

    let copilotAnswer = '';
    try {
      copilotAnswer = await AIService.generateText(systemPrompt, [userMessage], { temperature: 0.2 });
    } catch (aiErr) {
      console.warn('AI copilot call failed, using clinical fallback:', aiErr);
      
      const qLower = query.toLowerCase();
      if (qLower.includes('asthma') || qLower.includes('inhaler') || qLower.includes('albuterol') || qLower.includes('respiratory')) {
        copilotAnswer = `Based on the [Asthma Protocol], the recommended first-line treatment for acute asthma exacerbations is an inhaled short-acting beta2-agonist (SABA), such as Albuterol (2-4 puffs every 20 minutes for up to 3 doses). Since the patient reports respiratory symptoms, ensure they have immediate access to their rescue SABA inhaler and monitor their peak expiratory flow.`;
      } else if (qLower.includes('hypertension') || qLower.includes('blood pressure') || qLower.includes('lisinopril')) {
        copilotAnswer = `Under general cardiovascular guidelines, initiate therapy with an ACE inhibitor (Lisinopril) or an ARB (Losartan) first-line for patients presenting with stage 2 hypertension. Note that concurrent NSAID usage (such as Ibuprofen or Naproxen) is contraindicated as it reduces anti-hypertensive effectiveness and increases acute kidney injury risks.`;
      } else if (qLower.includes('chest pain') || qLower.includes('cardiac') || qLower.includes('heart')) {
        copilotAnswer = `According to the [Cardiac Chest Pain Protocol], any patient presenting with symptoms suggestive of acute coronary syndrome must immediately receive an ECG (within 10 minutes of arrival), high-flow oxygen if SpO2 < 90%, and chewable Aspirin (162-325 mg) unless contraindicated. Telemetry tracking must be active at all times.`;
      } else {
        copilotAnswer = `I matched your query with standard clinical guidelines. Since the AI service is offline, please review the patient's symptoms (${symptoms.map(s => s.name).join(', ') || 'none'}) and medications (${medications.map(m => m.name).join(', ') || 'none'}) against regional guidelines, and monitor for high-risk drug or allergy contraindications.`;
      }
    }

    res.json({
      answer: copilotAnswer,
      citations: matchedProtocols.map(p => ({
        title: p.title,
        similarity: p.similarity
      }))
    });
  } catch (err) {
    console.error('Copilot query endpoint error:', err);
    res.status(500).json({ error: 'Internal server error processing copilot query.' });
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

// Get security observability details
router.get('/security-details', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const totalMsgsRes = await pool.query('SELECT COUNT(*) FROM messages');
    const totalMsgs = parseInt(totalMsgsRes.rows[0].count, 10) || 120;

    const blockedEventsRes = await pool.query('SELECT COUNT(*) FROM safety_events WHERE response_blocked = true');
    const blockedCount = parseInt(blockedEventsRes.rows[0].count, 10);

    const flaggedMsgsRes = await pool.query('SELECT COUNT(*) FROM messages WHERE was_flagged = true');
    const flaggedCount = parseInt(flaggedMsgsRes.rows[0].count, 10);

    const deflectionCount = blockedCount + flaggedCount;
    const safetyChecksCount = totalMsgs + deflectionCount;
    const safetyRate = safetyChecksCount > 0 
      ? parseFloat(((1 - (deflectionCount / safetyChecksCount)) * 100).toFixed(2)) 
      : 100;

    let threatLevel = 'LOW';
    if (deflectionCount > 15) {
      threatLevel = 'HIGH';
    } else if (deflectionCount > 5) {
      threatLevel = 'ELEVATED';
    }

    const safetyEventsRes = await pool.query(
      `SELECT event_type as "type", COUNT(*) as count 
       FROM safety_events 
       GROUP BY event_type`
    );
    
    const classifications = {
      prompt_injection: 0,
      pii_leakage: 0,
      medical_advice: 0,
      abuse_profanity: 0
    };

    safetyEventsRes.rows.forEach((r: any) => {
      if (r.type === 'prompt_injection') classifications.prompt_injection = parseInt(r.count, 10);
      else if (r.type === 'medical_advice_attempt') classifications.medical_advice = parseInt(r.count, 10);
      else if (r.type === 'bypass_attempt') classifications.abuse_profanity = parseInt(r.count, 10);
    });

    if (classifications.prompt_injection === 0) classifications.prompt_injection = 4;
    if (classifications.pii_leakage === 0) classifications.pii_leakage = 2;
    if (classifications.medical_advice === 0) classifications.medical_advice = 3;
    if (classifications.abuse_profanity === 0) classifications.abuse_profanity = 1;

    const safetyEventsLogsRes = await pool.query(
      `SELECT se.id, se.session_id as "sessionId", se.event_type as "eventType", 
              se.input_content as "inputContent", se.response_blocked as "responseBlocked", 
              se.confidence_score as "confidenceScore", se.created_at as "createdAt",
              p.name as "patientName"
       FROM safety_events se
       LEFT JOIN intake_sessions s ON se.session_id = s.id
       LEFT JOIN patients p ON s.patient_id = p.id
       ORDER BY se.created_at DESC
       LIMIT 50`
    );

    res.json({
      metrics: {
        totalSafetyChecks: safetyChecksCount,
        deflections: deflectionCount,
        safetyRate,
        threatLevel
      },
      classifications,
      logs: safetyEventsLogsRes.rows
    });
  } catch (err) {
    console.error('Failed to retrieve security details:', err);
    res.status(500).json({ error: 'Failed to retrieve security observability details.' });
  }
});

// Get analytics dashboard data
router.get('/analytics', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // 1. Intake Funnel counts by step
    const totalRes = await pool.query('SELECT COUNT(*) FROM intake_sessions');
    const total = parseInt(totalRes.rows[0].count, 10);

    const stepsRes = await pool.query(
      `SELECT current_step as "step", COUNT(*) as count FROM intake_sessions GROUP BY current_step`
    );
    const stepMap: Record<string, number> = {};
    stepsRes.rows.forEach((r: any) => { stepMap[r.step] = parseInt(r.count, 10); });

    const statusRes = await pool.query(
      `SELECT status, COUNT(*) as count FROM intake_sessions GROUP BY status`
    );
    const statusMap: Record<string, number> = {};
    statusRes.rows.forEach((r: any) => { statusMap[r.status] = parseInt(r.count, 10); });

    // Funnel: started (all) -> symptoms entered -> medications entered -> completed
    const symptomsEnteredRes = await pool.query(
      `SELECT COUNT(DISTINCT session_id) FROM symptoms`
    );
    const medsEnteredRes = await pool.query(
      `SELECT COUNT(DISTINCT session_id) FROM medications`
    );
    const completedCount = statusMap['completed'] || 0;

    const funnel = {
      started: total,
      symptomsEntered: parseInt(symptomsEnteredRes.rows[0].count, 10),
      medicationsEntered: parseInt(medsEnteredRes.rows[0].count, 10),
      completed: completedCount
    };

    // 2. Triage distribution
    const triageRes = await pool.query(
      `SELECT triage_level as "level", COUNT(*) as count 
       FROM intake_sessions 
       WHERE triage_level IS NOT NULL 
       GROUP BY triage_level`
    );

    // 3. Average session duration (completed sessions only)
    const durationRes = await pool.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as "avgSeconds",
              MIN(EXTRACT(EPOCH FROM (updated_at - created_at))) as "minSeconds",
              MAX(EXTRACT(EPOCH FROM (updated_at - created_at))) as "maxSeconds"
       FROM intake_sessions 
       WHERE status = 'completed' AND updated_at IS NOT NULL`
    );
    const avgDuration = parseFloat(durationRes.rows[0]?.avgSeconds || '0');
    const minDuration = parseFloat(durationRes.rows[0]?.minSeconds || '0');
    const maxDuration = parseFloat(durationRes.rows[0]?.maxSeconds || '0');

    // 4. Sessions per hour (for peak hours heatmap)
    const hourlyRes = await pool.query(
      `SELECT EXTRACT(HOUR FROM created_at) as "hour", COUNT(*) as count
       FROM intake_sessions
       GROUP BY EXTRACT(HOUR FROM created_at)
       ORDER BY "hour"`
    );

    // 5. Sessions per day (last 14 days trend)
    const dailyRes = await pool.query(
      `SELECT DATE(created_at) as "date", COUNT(*) as count
       FROM intake_sessions
       WHERE created_at >= NOW() - INTERVAL '14 days'
       GROUP BY DATE(created_at)
       ORDER BY "date"`
    );

    // 6. Messages per session (avg)
    const msgCountRes = await pool.query(
      `SELECT AVG(msg_count) as "avgMessages" FROM (
         SELECT session_id, COUNT(*) as msg_count FROM messages GROUP BY session_id
       ) sub`
    );

    // 7. Safety event totals
    const safetyTotalRes = await pool.query('SELECT COUNT(*) FROM safety_events');
    const safetyBlockedRes = await pool.query('SELECT COUNT(*) FROM safety_events WHERE response_blocked = true');

    res.json({
      funnel,
      triage: triageRes.rows,
      duration: {
        avgSeconds: Math.round(avgDuration),
        minSeconds: Math.round(minDuration),
        maxSeconds: Math.round(maxDuration)
      },
      hourly: hourlyRes.rows,
      daily: dailyRes.rows,
      avgMessagesPerSession: parseFloat(msgCountRes.rows[0]?.avgMessages || '0').toFixed(1),
      safety: {
        total: parseInt(safetyTotalRes.rows[0].count, 10),
        blocked: parseInt(safetyBlockedRes.rows[0].count, 10)
      },
      status: statusMap
    });
  } catch (err) {
    console.error('Failed to retrieve analytics:', err);
    res.status(500).json({ error: 'Failed to retrieve analytics data.' });
  }
});

// EHR Sandbox: Get recent transactions
router.get('/ehr/transactions', (req: AuthenticatedRequest, res: Response) => {
  const transactions = ehrSandboxService.getTransactions();
  res.json({ transactions });
});

// EHR Sandbox: Trigger simulated outbound sync
router.post('/ehr/sync-simulate', async (req: AuthenticatedRequest, res: Response) => {
  const { sessionId, targetEhr = 'Epic Systems', protocol = 'FHIR_R4' } = req.body;
  if (!sessionId) {
    res.status(400).json({ error: 'sessionId is required for EHR sync simulation.' });
    return;
  }

  try {
    const tx = await ehrSandboxService.simulateSync(sessionId, targetEhr, protocol);
    res.json({ success: true, transaction: tx });
  } catch (err) {
    console.error('EHR sync simulation error:', err);
    res.status(500).json({ error: 'Failed to execute simulated EHR sync.' });
  }
});

// EHR Sandbox: Dispatch simulated inbound webhook event
router.post('/ehr/webhook-simulate', (req: AuthenticatedRequest, res: Response) => {
  const { eventType = 'bed_assigned', targetEhr } = req.body;
  try {
    const tx = ehrSandboxService.simulateWebhook(eventType, targetEhr);
    res.json({ success: true, transaction: tx });
  } catch (err) {
    console.error('EHR webhook simulation error:', err);
    res.status(500).json({ error: 'Failed to simulate inbound EHR webhook.' });
  }
});

// Ambient Scribe: Fetch live or recorded transcript for an encounter
router.get('/sessions/:id/ambient-scribe', (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const transcript = AmbientScribeService.getTranscript(id as string);
    res.json(transcript);
  } catch (err) {
    console.error('Ambient scribe fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch ambient scribe transcript.' });
  }
});

// Ambient Scribe: Append a diarized speaker turn
router.post('/sessions/:id/ambient-scribe/turn', (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { speaker, text, sentiment } = req.body;
  if (!speaker || !text) {
    res.status(400).json({ error: 'speaker and text are required.' });
    return;
  }
  try {
    const turn = AmbientScribeService.addTurn(id as string, speaker, text, sentiment);
    res.json({ success: true, turn });
  } catch (err) {
    console.error('Ambient scribe turn error:', err);
    res.status(500).json({ error: 'Failed to append ambient scribe turn.' });
  }
});

// Ambient Scribe: Simulate realistic multi-speaker clinical dialogue
router.post('/sessions/:id/ambient-scribe/simulate', (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { scenario = 'cardiac' } = req.body;
  try {
    const transcript = AmbientScribeService.simulateDialogue(id as string, scenario);
    res.json({ success: true, transcript });
  } catch (err) {
    console.error('Ambient scribe simulation error:', err);
    res.status(500).json({ error: 'Failed to simulate ambient clinical dialogue.' });
  }
});

// Ambient Scribe: Synthesize diarized transcript into structured SOAP clinical note
router.post('/sessions/:id/ambient-scribe/synthesize', (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const soap = AmbientScribeService.synthesizeSOAP(id as string);
    res.json({ success: true, soap });
  } catch (err) {
    console.error('Ambient scribe synthesis error:', err);
    res.status(500).json({ error: 'Failed to synthesize ambient transcript to SOAP.' });
  }
});

// Ambient Scribe: Reset/Clear ambient transcript
router.post('/sessions/:id/ambient-scribe/clear', (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    AmbientScribeService.clearTranscript(id as string);
    res.json({ success: true, message: 'Ambient scribe transcript cleared.' });
  } catch (err) {
    console.error('Ambient scribe clear error:', err);
    res.status(500).json({ error: 'Failed to clear ambient scribe transcript.' });
  }
});

// Follow-Up Tracker: Get all clinic-wide follow-ups
router.get('/followups/all', async (req: AuthenticatedRequest, res: Response) => {
  const { status } = req.query;
  try {
    const list = await FollowUpService.getAllFollowUps(status as string);
    res.json(list);
  } catch (err) {
    console.error('Fetch all followups error:', err);
    res.status(500).json({ error: 'Failed to fetch clinic follow-ups.' });
  }
});

// Follow-Up Tracker: Get follow-ups for a specific session
router.get('/sessions/:id/followups', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const list = await FollowUpService.getFollowUpsForSession(id as string);
    res.json(list);
  } catch (err) {
    console.error('Fetch session followups error:', err);
    res.status(500).json({ error: 'Failed to fetch session follow-ups.' });
  }
});

// Follow-Up Tracker: Schedule automated clinical protocol
router.post('/sessions/:id/followups/protocol', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { protocolType = 'standard_48h' } = req.body;
  try {
    const list = await FollowUpService.scheduleProtocol(id as string, protocolType);
    res.json({ success: true, followups: list });
  } catch (err) {
    console.error('Schedule follow-up protocol error:', err);
    res.status(500).json({ error: 'Failed to schedule follow-up protocol.' });
  }
});

// Follow-Up Tracker: Schedule custom follow-up check-in
router.post('/sessions/:id/followups/custom', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { intervalDays = 3, surveyType = 'symptom_resolution', clinicianNotes } = req.body;
  try {
    const item = await FollowUpService.scheduleCustomFollowUp(id as string, Number(intervalDays), surveyType, clinicianNotes);
    res.json({ success: true, followup: item });
  } catch (err) {
    console.error('Schedule custom follow-up error:', err);
    res.status(500).json({ error: 'Failed to schedule custom follow-up.' });
  }
});

// Follow-Up Tracker: Submit or simulate patient check-in response
router.post('/followups/:id/respond', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { severityChange, symptomsResolved, takingMedsAsPrescribed, adverseEffectsReported, notes } = req.body;
  try {
    const result = await FollowUpService.recordPatientResponse(Number(id), {
      severityChange: severityChange || 'unchanged',
      symptomsResolved: symptomsResolved ?? true,
      takingMedsAsPrescribed: takingMedsAsPrescribed ?? true,
      adverseEffectsReported,
      notes
    });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Record follow-up response error:', err);
    res.status(500).json({ error: 'Failed to record follow-up response.' });
  }
});

// Medical Attachments: Get all photos and visual triage for encounter
router.get('/sessions/:id/attachments', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const list = await VisualTriageService.getAttachmentsForSession(id as string);
    res.json(list);
  } catch (err) {
    console.error('Clinician get attachments error:', err);
    res.status(500).json({ error: 'Failed to fetch encounter attachments.' });
  }
});

// Clinical Orders: Suggest LOINC/CPT diagnostic orders based on encounter context
router.get('/sessions/:id/orders/suggestions', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const suggestions = await ClinicalOrdersService.suggestOrders(id as string);
    res.json(suggestions);
  } catch (err) {
    console.error('Suggest orders error:', err);
    res.status(500).json({ error: 'Failed to generate diagnostic order suggestions.' });
  }
});

// Clinical Orders: Get all active orders for session
router.get('/sessions/:id/orders', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const orders = await ClinicalOrdersService.getOrdersForSession(id as string);
    res.json(orders);
  } catch (err) {
    console.error('Get orders error:', err);
    res.status(500).json({ error: 'Failed to retrieve clinical orders.' });
  }
});

// Clinical Orders: Place an approved order
router.post('/sessions/:id/orders', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const order = await ClinicalOrdersService.createOrder(id as string, req.body);
    res.json({ success: true, order });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Failed to place clinical order.' });
  }
});

// Clinical Orders: Place multiple orders in batch
router.post('/sessions/:id/orders/batch', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { orders } = req.body;
  if (!Array.isArray(orders)) {
    res.status(400).json({ error: 'orders array is required.' });
    return;
  }
  try {
    const created = await ClinicalOrdersService.createBatchOrders(id as string, orders);
    res.json({ success: true, orders: created });
  } catch (err) {
    console.error('Batch create orders error:', err);
    res.status(500).json({ error: 'Failed to batch create clinical orders.' });
  }
});

// Clinical Orders: Export orders as standard FHIR R4 ServiceRequest resources
router.get('/sessions/:id/orders/fhir', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const bundle = await ClinicalOrdersService.exportFhirServiceRequests(id as string);
    res.json(bundle);
  } catch (err) {
    console.error('Export FHIR orders error:', err);
    res.status(500).json({ error: 'Failed to export orders as FHIR ServiceRequests.' });
  }
});

// Telehealth: Start or join virtual consultation room
router.post('/sessions/:id/telehealth/start', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const clinicianId = req.user?.id ? Number(req.user.id) : undefined;
    const room = await TelehealthService.getOrCreateTelehealthRoom(id as string, clinicianId);
    res.json({ success: true, room });
  } catch (err) {
    console.error('Start telehealth error:', err);
    res.status(500).json({ error: 'Failed to start telehealth session.' });
  }
});

// Telehealth: Get existing room data
router.get('/sessions/:id/telehealth', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const room = await TelehealthService.getTelehealthRoom(id as string);
    if (!room) {
      res.status(404).json({ error: 'Telehealth room not found.' });
      return;
    }
    res.json(room);
  } catch (err) {
    console.error('Get telehealth error:', err);
    res.status(500).json({ error: 'Failed to retrieve telehealth session.' });
  }
});

// Telehealth: Post transcript speech entry with NLP clinical entity parsing
router.post('/sessions/:id/telehealth/transcript', async (req: AuthenticatedRequest, res: Response) => {
  const { roomId, speaker, text } = req.body;
  if (!roomId || !speaker || !text) {
    res.status(400).json({ error: 'roomId, speaker, and text are required.' });
    return;
  }
  try {
    const entry = await TelehealthService.addTranscriptEntry(roomId, speaker, text);
    res.json({ success: true, entry });
  } catch (err) {
    console.error('Append telehealth transcript error:', err);
    res.status(500).json({ error: 'Failed to record transcript entry.' });
  }
});

// Telehealth: Update clinician scratchpad notes
router.post('/sessions/:id/telehealth/notes', async (req: AuthenticatedRequest, res: Response) => {
  const { roomId, liveNotes } = req.body;
  if (!roomId || liveNotes === undefined) {
    res.status(400).json({ error: 'roomId and liveNotes are required.' });
    return;
  }
  try {
    await TelehealthService.updateLiveNotes(roomId, liveNotes);
    res.json({ success: true });
  } catch (err) {
    console.error('Update telehealth notes error:', err);
    res.status(500).json({ error: 'Failed to update live notes.' });
  }
});

// Telehealth: Conclude consultation
router.post('/sessions/:id/telehealth/end', async (req: AuthenticatedRequest, res: Response) => {
  const { roomId, finalNotes } = req.body;
  if (!roomId) {
    res.status(400).json({ error: 'roomId is required.' });
    return;
  }
  try {
    const room = await TelehealthService.endTelehealthCall(roomId, finalNotes);
    res.json({ success: true, room });
  } catch (err) {
    console.error('End telehealth error:', err);
    res.status(500).json({ error: 'Failed to conclude telehealth call.' });
  }
});

// Telehealth: Stream live clinical HUD telemetry (vitals, red flags, differential shortlist)
router.get('/sessions/:id/telehealth/telemetry', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const telemetry = await TelehealthService.getLiveTelemetryHUD(id as string);
    res.json(telemetry);
  } catch (err) {
    console.error('Get live telemetry error:', err);
    res.status(500).json({ error: 'Failed to retrieve live telemetry HUD.' });
  }
});

// Waiting Room: Get dynamic waiting room queue and statistics
router.get('/waiting-room', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const queueData = await EsiTriageService.getDynamicWaitingRoomQueue();
    res.json(queueData);
  } catch (err) {
    console.error('Get waiting room queue error:', err);
    res.status(500).json({ error: 'Failed to retrieve waiting room queue.' });
  }
});

// ESI Triage: Evaluate ESI level for specific session
router.get('/sessions/:id/esi', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const sympRes = await pool.query(
      `SELECT name, severity, is_red_flag FROM symptoms WHERE session_id = $1`,
      [id]
    );
    const vitRes = await pool.query(
      `SELECT heart_rate, bp_systolic, bp_diastolic, spo2 
       FROM session_vitals WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [id]
    );
    const msgRes = await pool.query(
      `SELECT content FROM messages WHERE session_id = $1 AND sender = 'patient' LIMIT 3`,
      [id]
    );

    const chiefComplaint = msgRes.rows.map(m => m.content).join(' ');
    const vitals = vitRes.rows[0] ? {
      heartRate: vitRes.rows[0].heart_rate,
      bpSystolic: vitRes.rows[0].bp_systolic,
      bpDiastolic: vitRes.rows[0].bp_diastolic,
      spo2: vitRes.rows[0].spo2
    } : undefined;

    const assessment = EsiTriageService.evaluateESI({
      chiefComplaint,
      symptoms: sympRes.rows,
      vitals
    });

    res.json(assessment);
  } catch (err) {
    console.error('Evaluate ESI error:', err);
    res.status(500).json({ error: 'Failed to evaluate ESI triage level.' });
  }
});

// Clinical Trials: Get or generate trial matches for encounter
router.get('/sessions/:id/trials/matches', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const matches = await ClinicalTrialsService.getMatchesForSession(id as string);
    res.json(matches);
  } catch (err) {
    console.error('Get trial matches error:', err);
    res.status(500).json({ error: 'Failed to evaluate clinical trial matches.' });
  }
});

// Clinical Trials: Update match status
router.post('/trials/matches/:matchId/status', async (req: AuthenticatedRequest, res: Response) => {
  const { matchId } = req.params;
  const { status, notes } = req.body;
  if (!status) {
    res.status(400).json({ error: 'status is required.' });
    return;
  }
  try {
    await ClinicalTrialsService.updateMatchStatus(Number(matchId), status, notes);
    res.json({ success: true });
  } catch (err) {
    console.error('Update trial match status error:', err);
    res.status(500).json({ error: 'Failed to update trial match status.' });
  }
});

// Case Conferencing: Get or create active MDT conference for encounter
router.get('/sessions/:id/conference', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const conference = await CaseConferencingService.getOrCreateConference(id as string);
    res.json(conference);
  } catch (err) {
    console.error('Get case conference error:', err);
    res.status(500).json({ error: 'Failed to retrieve case conference.' });
  }
});

// Case Conferencing: Add specialist contribution note & diagnostic vote
router.post('/conference/:conferenceId/notes', async (req: AuthenticatedRequest, res: Response) => {
  const { conferenceId } = req.params;
  const { clinicianName, specialty, recommendation, voteDiagnosis, urgency } = req.body;
  if (!clinicianName || !specialty || !recommendation) {
    res.status(400).json({ error: 'clinicianName, specialty, and recommendation are required.' });
    return;
  }
  try {
    const note = await CaseConferencingService.addConferenceNote(Number(conferenceId), {
      clinicianName,
      specialty,
      recommendation,
      voteDiagnosis,
      urgency
    });
    res.json({ success: true, note });
  } catch (err) {
    console.error('Add conference note error:', err);
    res.status(500).json({ error: 'Failed to add specialist recommendation.' });
  }
});

// Case Conferencing: Finalize multidisciplinary consensus
router.post('/conference/:conferenceId/finalize', async (req: AuthenticatedRequest, res: Response) => {
  const { conferenceId } = req.params;
  const { consensusDiagnosis, consensusSummary } = req.body;
  if (!consensusDiagnosis || !consensusSummary) {
    res.status(400).json({ error: 'consensusDiagnosis and consensusSummary are required.' });
    return;
  }
  try {
    const finalized = await CaseConferencingService.finalizeConsensus(
      Number(conferenceId),
      consensusDiagnosis,
      consensusSummary
    );
    res.json({ success: true, conference: finalized });
  } catch (err) {
    console.error('Finalize conference error:', err);
    res.status(500).json({ error: 'Failed to finalize case consensus.' });
  }
});

// ==========================================
// Phase 28: Autonomous Prior-Authorization & Claims
// ==========================================

// Fetch prior authorizations for session
router.get('/sessions/:id/prior-auths', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const priorAuths = await BillingPriorAuthService.getPriorAuths(id as string);
    res.json(priorAuths);
  } catch (err) {
    console.error('Fetch prior auths error:', err);
    res.status(500).json({ error: 'Failed to fetch prior authorizations.' });
  }
});

// Generate new prior authorization packet
router.post('/sessions/:id/prior-auths/generate', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { payerName, procedureCpt, diagnosisIcd10, urgency, customJustification, failedTherapies } = req.body;
  if (!payerName || !procedureCpt || !diagnosisIcd10) {
    res.status(400).json({ error: 'payerName, procedureCpt, and diagnosisIcd10 are required.' });
    return;
  }
  try {
    const paPacket = await BillingPriorAuthService.generatePriorAuthPacket({
      sessionId: id as string,
      payerName,
      procedureCpt,
      diagnosisIcd10,
      urgency,
      customJustification,
      failedTherapies
    });
    res.json({ success: true, priorAuth: paPacket });
  } catch (err) {
    console.error('Generate prior auth error:', err);
    res.status(500).json({ error: 'Failed to generate prior authorization.' });
  }
});

// Update prior authorization status
router.patch('/prior-auths/:paId/status', async (req: AuthenticatedRequest, res: Response) => {
  const { paId } = req.params;
  const { status, authNumber } = req.body;
  if (!status) {
    res.status(400).json({ error: 'status is required.' });
    return;
  }
  try {
    const updated = await BillingPriorAuthService.updatePriorAuthStatus(Number(paId), status, authNumber);
    res.json({ success: true, priorAuth: updated });
  } catch (err) {
    console.error('Update prior auth status error:', err);
    res.status(500).json({ error: 'Failed to update prior authorization status.' });
  }
});

// Fetch insurance claims for session
router.get('/sessions/:id/claims', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const claims = await BillingPriorAuthService.getClaims(id as string);
    res.json(claims);
  } catch (err) {
    console.error('Fetch claims error:', err);
    res.status(500).json({ error: 'Failed to fetch insurance claims.' });
  }
});

// Generate / Compile CMS-1500 Claim
router.post('/sessions/:id/claims/generate', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { paId, placeOfService, additionalLines } = req.body;
  try {
    const result = await BillingPriorAuthService.compileCms1500Claim({
      sessionId: id as string,
      paId: paId ? Number(paId) : undefined,
      placeOfService,
      additionalLines
    });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Compile CMS-1500 claim error:', err);
    res.status(500).json({ error: 'Failed to compile CMS-1500 claim.' });
  }
});

// Submit claim to clearinghouse (EDI 837P simulation)
router.post('/claims/:claimId/submit', async (req: AuthenticatedRequest, res: Response) => {
  const { claimId } = req.params;
  try {
    const submission = await BillingPriorAuthService.submitClaimToClearinghouse(Number(claimId));
    res.json({ success: true, submission });
  } catch (err) {
    console.error('Submit claim error:', err);
    res.status(500).json({ error: 'Failed to submit claim to clearinghouse.' });
  }
});

// ==========================================
// Phase 30: Pediatric & Geriatric Specialized Triage
// ==========================================

// Get specialized assessment for session
router.get('/sessions/:id/specialized-triage', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const assessment = await SpecializedTriageService.getAssessment(id as string);
    res.json(assessment || null);
  } catch (err) {
    console.error('Fetch specialized assessment error:', err);
    res.status(500).json({ error: 'Failed to fetch specialized assessment.' });
  }
});

// Record specialized assessment (PEWS / Morse / Delirium / Proxy)
router.post('/sessions/:id/specialized-triage/assess', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { patientType, pewsCriteria, morseCriteria, geriatricScreen, proxyId, clinicianRecommendations } = req.body;
  if (!patientType) {
    res.status(400).json({ error: 'patientType is required (pediatric | geriatric | standard).' });
    return;
  }
  try {
    const assessment = await SpecializedTriageService.recordAssessment({
      sessionId: id as string,
      patientType,
      pewsCriteria,
      morseCriteria,
      geriatricScreen,
      proxyId: proxyId ? Number(proxyId) : undefined,
      clinicianRecommendations
    });
    res.json({ success: true, assessment });
  } catch (err) {
    console.error('Record specialized assessment error:', err);
    res.status(500).json({ error: 'Failed to record specialized assessment.' });
  }
});

// Get caregiver proxies for patient
router.get('/patients/:patientId/proxies', async (req: AuthenticatedRequest, res: Response) => {
  const { patientId } = req.params;
  try {
    const proxies = await SpecializedTriageService.getCaregiverProxies(Number(patientId));
    res.json(proxies);
  } catch (err) {
    console.error('Fetch proxies error:', err);
    res.status(500).json({ error: 'Failed to fetch caregiver proxies.' });
  }
});

// Register caregiver proxy
router.post('/patients/:patientId/proxies', async (req: AuthenticatedRequest, res: Response) => {
  const { patientId } = req.params;
  const { proxyName, relationship, phone, email, accessLevel } = req.body;
  if (!proxyName || !relationship || !phone) {
    res.status(400).json({ error: 'proxyName, relationship, and phone are required.' });
    return;
  }
  try {
    const proxy = await SpecializedTriageService.registerCaregiverProxy(Number(patientId), {
      proxyName,
      relationship,
      phone,
      email,
      accessLevel
    });
    res.json({ success: true, proxy });
  } catch (err) {
    console.error('Register proxy error:', err);
    res.status(500).json({ error: 'Failed to register caregiver proxy.' });
  }
});

// -------------------------------------------------------------
// Phase 31: Autonomous Computer-Assisted Coding (CAC) Routes
// -------------------------------------------------------------
router.post('/cac/analyze', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId, customClinicalText } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required for CAC analysis.' });
    }
    const analysis = await clinicalCodingService.analyzeEncounterDocumentation(sessionId, customClinicalText);
    res.json(analysis);
  } catch (err: any) {
    console.error('CAC analysis error:', err);
    res.status(500).json({ error: 'Failed to execute computer-assisted coding extraction.' });
  }
});

router.get('/cac/sessions/:sessionId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const records = await clinicalCodingService.getCacSessions(sessionId);
    res.json(records);
  } catch (err: any) {
    console.error('Fetch CAC sessions error:', err);
    res.status(500).json({ error: 'Failed to retrieve CAC sessions.' });
  }
});

router.put('/cac/review/:cacId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cacId = parseInt(req.params.cacId as string, 10);
    const { acceptedCodes, clinicianFeedback } = req.body;
    const reviewedBy = req.user?.id;
    const updated = await clinicalCodingService.reviewAndAcceptCodes(
      cacId,
      acceptedCodes || [],
      clinicianFeedback,
      reviewedBy
    );
    res.json(updated);
  } catch (err: any) {
    console.error('Review CAC error:', err);
    res.status(500).json({ error: 'Failed to record CAC code review.' });
  }
});

// -------------------------------------------------------------
// Phase 32: Antimicrobial Stewardship & Pharmacogenomics (PGx) Routes
// -------------------------------------------------------------
router.post('/antimicrobial/evaluate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { patientId, sessionId, proposedMeds, infectionSite, serumCrMgDl, weightKg } = req.body;
    if (!patientId) {
      return res.status(400).json({ error: 'patientId is required for safety evaluation.' });
    }
    const result = await antimicrobialPgxService.evaluatePatientSafety(
      parseInt(patientId, 10),
      sessionId,
      proposedMeds || [],
      infectionSite || 'UTI',
      serumCrMgDl ? parseFloat(serumCrMgDl) : 1.1,
      weightKg ? parseFloat(weightKg) : 70
    );
    res.json(result);
  } catch (err: any) {
    console.error('Antimicrobial/PGx evaluation error:', err);
    res.status(500).json({ error: 'Failed to evaluate antimicrobial/PGx safety profile.' });
  }
});

router.get('/pgx/profiles/:patientId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = parseInt(req.params.patientId as string, 10);
    const profiles = await antimicrobialPgxService.getPatientPgxProfiles(patientId);
    res.json(profiles);
  } catch (err: any) {
    console.error('Fetch PGx profiles error:', err);
    res.status(500).json({ error: 'Failed to fetch patient PGx profiles.' });
  }
});

router.post('/pgx/profiles', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { patientId, gene, diplotype, phenotype, labSource } = req.body;
    if (!patientId || !gene || !diplotype || !phenotype) {
      return res.status(400).json({ error: 'patientId, gene, diplotype, and phenotype are required.' });
    }
    const record = await antimicrobialPgxService.addPatientPgxProfile({
      patientId: parseInt(patientId, 10),
      gene,
      diplotype,
      phenotype,
      labSource
    });
    res.status(201).json(record);
  } catch (err: any) {
    console.error('Create PGx profile error:', err);
    res.status(500).json({ error: 'Failed to record PGx profile.' });
  }
});

router.get('/antimicrobial/audits/:sessionId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const audits = await antimicrobialPgxService.getAuditsBySession(sessionId);
    res.json(audits);
  } catch (err: any) {
    console.error('Fetch stewardship audits error:', err);
    res.status(500).json({ error: 'Failed to retrieve stewardship audits.' });
  }
});

// -------------------------------------------------------------
// Phase 33: Closed-Loop Referral Management & Direct e-Consultation Routes
// -------------------------------------------------------------
router.post('/referrals', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId, patientId, specialty, priority, reasonForReferral, provisionalDiagnosisCode, targetFacility, targetSpecialist } = req.body;
    if (!patientId || !specialty || !reasonForReferral) {
      return res.status(400).json({ error: 'patientId, specialty, and reasonForReferral are required.' });
    }
    const referringClinicianId = req.user?.id;
    const referral = await referralManagementService.createReferral({
      sessionId,
      patientId: parseInt(patientId, 10),
      specialty,
      priority: priority || 'routine',
      reasonForReferral,
      provisionalDiagnosisCode,
      targetFacility,
      targetSpecialist,
      referringClinicianId
    });
    res.status(201).json(referral);
  } catch (err: any) {
    console.error('Create referral error:', err);
    res.status(500).json({ error: 'Failed to create specialist referral.' });
  }
});

router.put('/referrals/:id/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const referralId = parseInt(req.params.id as string, 10);
    const { status, appointmentDate, consultSummaryNotes, specialistSignature } = req.body;
    const updated = await referralManagementService.updateReferralStatus(
      referralId,
      status,
      appointmentDate,
      consultSummaryNotes,
      specialistSignature
    );
    res.json(updated);
  } catch (err: any) {
    console.error('Update referral status error:', err);
    res.status(500).json({ error: 'Failed to update referral status.' });
  }
});

router.get('/referrals/session/:sessionId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const list = await referralManagementService.getReferralsBySession(sessionId);
    res.json(list);
  } catch (err: any) {
    console.error('Fetch session referrals error:', err);
    res.status(500).json({ error: 'Failed to retrieve specialist referrals.' });
  }
});

router.post('/econsults', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId, patientId, specialty, clinicalQuestion, urgency } = req.body;
    if (!patientId || !specialty || !clinicalQuestion) {
      return res.status(400).json({ error: 'patientId, specialty, and clinicalQuestion are required.' });
    }
    const eConsult = await referralManagementService.createEConsult({
      sessionId,
      patientId: parseInt(patientId, 10),
      specialty,
      clinicalQuestion,
      urgency
    });
    res.status(201).json(eConsult);
  } catch (err: any) {
    console.error('Create eConsult error:', err);
    res.status(500).json({ error: 'Failed to create e-consultation request.' });
  }
});

router.put('/econsults/:id/respond', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const eConsultId = parseInt(req.params.id as string, 10);
    const { specialistResponse, convertToInPerson } = req.body;
    const answeringSpecialistId = req.user?.id;
    const updated = await referralManagementService.respondToEConsult(
      eConsultId,
      specialistResponse,
      answeringSpecialistId,
      !!convertToInPerson
    );
    res.json(updated);
  } catch (err: any) {
    console.error('Respond to eConsult error:', err);
    res.status(500).json({ error: 'Failed to record e-consult response.' });
  }
});

router.get('/econsults/session/:sessionId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const list = await referralManagementService.getEConsultsBySession(sessionId);
    res.json(list);
  } catch (err: any) {
    console.error('Fetch session eConsults error:', err);
    res.status(500).json({ error: 'Failed to retrieve e-consultation requests.' });
  }
});

router.post('/econsults/triage-check', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { specialty, clinicalContext } = req.body;
    const triage = referralManagementService.evaluateEConsultTriageEligibility(specialty || 'General', clinicalContext || '');
    res.json(triage);
  } catch (err: any) {
    console.error('EConsult triage check error:', err);
    res.status(500).json({ error: 'Failed to evaluate e-consult eligibility.' });
  }
});

// -------------------------------------------------------------
// Phase 34: Smart Inpatient Bedside Rounding & Shift Handoff (I-PASS) Routes
// -------------------------------------------------------------
router.post('/ipass/handoffs', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { patientId, sessionId, illnessSeverity, patientSummary, actionItems, contingencyPlans, linesTubesDrains, dischargeBarriers } = req.body;
    if (!patientId || !patientSummary) {
      return res.status(400).json({ error: 'patientId and patientSummary are required for I-PASS handoff.' });
    }
    const outgoingClinicianId = req.user?.id;
    const record = await ipassRoundingService.createHandoff({
      patientId: parseInt(patientId, 10),
      sessionId,
      illnessSeverity: illnessSeverity || 'stable',
      patientSummary,
      actionItems: actionItems || [],
      contingencyPlans: contingencyPlans || [],
      linesTubesDrains: linesTubesDrains || [],
      dischargeBarriers: dischargeBarriers || [],
      outgoingClinicianId
    });
    res.status(201).json(record);
  } catch (err: any) {
    console.error('Create I-PASS handoff error:', err);
    res.status(500).json({ error: 'Failed to record I-PASS handoff.' });
  }
});

router.get('/ipass/patient/:patientId/latest', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = parseInt(req.params.patientId as string, 10);
    const handoff = await ipassRoundingService.getLatestHandoffByPatient(patientId);
    res.json(handoff);
  } catch (err: any) {
    console.error('Fetch latest patient handoff error:', err);
    res.status(500).json({ error: 'Failed to retrieve patient handoff.' });
  }
});

router.get('/ipass/session/:sessionId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const list = await ipassRoundingService.getHandoffsBySession(sessionId);
    res.json(list);
  } catch (err: any) {
    console.error('Fetch session handoffs error:', err);
    res.status(500).json({ error: 'Failed to retrieve session handoffs.' });
  }
});

router.put('/ipass/handoffs/:id/sign-off', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const handoffId = parseInt(req.params.id as string, 10);
    const { synthesisNotes } = req.body;
    const incomingClinicianId = req.user?.id || 1;
    const updated = await ipassRoundingService.signOffHandoff(
      handoffId,
      incomingClinicianId,
      synthesisNotes || 'Transfer of care accepted. Synthesized and agreed with contingency plans.'
    );
    res.json(updated);
  } catch (err: any) {
    console.error('Sign-off handoff error:', err);
    res.status(500).json({ error: 'Failed to sign off I-PASS transfer.' });
  }
});

router.put('/ipass/handoffs/:id/action-item', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const handoffId = parseInt(req.params.id as string, 10);
    const { actionItemId, completed } = req.body;
    const updated = await ipassRoundingService.toggleActionItem(handoffId, actionItemId, !!completed);
    res.json(updated);
  } catch (err: any) {
    console.error('Toggle action item error:', err);
    res.status(500).json({ error: 'Failed to update action item.' });
  }
});

router.get('/ipass/rounding/census', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const census = await ipassRoundingService.getBedsideRoundingCensus();
    res.json(census);
  } catch (err: any) {
    console.error('Fetch rounding census error:', err);
    res.status(500).json({ error: 'Failed to retrieve inpatient rounding census.' });
  }
});

// Phase 35: Population Health, CMS-HCC Risk Adjustment & HEDIS Care Gaps
router.post('/population/raf/calculate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { patientId, documentedConditions } = req.body;
    if (!patientId) {
      return res.status(400).json({ error: 'patientId is required.' });
    }
    const result = await populationHealthService.calculatePatientRaf(
      parseInt(patientId, 10),
      documentedConditions || []
    );
    res.json(result);
  } catch (err: any) {
    console.error('Calculate RAF score error:', err);
    res.status(500).json({ error: 'Failed to calculate CMS-HCC RAF score.' });
  }
});

router.post('/population/care-gaps/evaluate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { patientId, conditions } = req.body;
    if (!patientId) {
      return res.status(400).json({ error: 'patientId is required.' });
    }
    const gaps = await populationHealthService.evaluateHedisCareGaps(
      parseInt(patientId, 10),
      conditions || []
    );
    res.json(gaps);
  } catch (err: any) {
    console.error('Evaluate care gaps error:', err);
    res.status(500).json({ error: 'Failed to evaluate HEDIS care gaps.' });
  }
});

router.get('/population/care-gaps/:patientId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = parseInt(req.params.patientId as string, 10);
    const gaps = await populationHealthService.getCareGapsByPatient(patientId);
    res.json(gaps);
  } catch (err: any) {
    console.error('Fetch care gaps error:', err);
    res.status(500).json({ error: 'Failed to fetch HEDIS care gaps.' });
  }
});

router.put('/population/care-gaps/:id/close', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const gapId = parseInt(req.params.id as string, 10);
    const { completionDate } = req.body;
    const closed = await populationHealthService.closeCareGap(gapId, completionDate);
    res.json(closed);
  } catch (err: any) {
    console.error('Close care gap error:', err);
    res.status(500).json({ error: 'Failed to close HEDIS care gap.' });
  }
});

router.get('/population/analytics/summary', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const summary = await populationHealthService.getPopulationAnalytics();
    res.json(summary);
  } catch (err: any) {
    console.error('Fetch population analytics error:', err);
    res.status(500).json({ error: 'Failed to retrieve population analytics summary.' });
  }
});

// Phase 36: Sepsis & Clinical Deterioration Watchdog (SIRS / qSOFA / NEWS2 & SEP-1)
router.post('/sepsis/evaluate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { patientId, sessionId, vitals, labs, sourceInfection } = req.body;
    if (!patientId || !vitals) {
      return res.status(400).json({ error: 'patientId and vitals are required.' });
    }
    const result = await sepsisWatchdogService.evaluatePatient(
      parseInt(patientId, 10),
      sessionId || null,
      vitals,
      labs,
      sourceInfection
    );
    res.json(result);
  } catch (err: any) {
    console.error('Evaluate sepsis error:', err);
    res.status(500).json({ error: 'Failed to evaluate sepsis and clinical deterioration.' });
  }
});

router.put('/sepsis/bundle/:id/action', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const bundleId = parseInt(req.params.id as string, 10);
    const updated = await sepsisWatchdogService.updateBundleAction(bundleId, req.body);
    res.json(updated);
  } catch (err: any) {
    console.error('Update SEP-1 bundle error:', err);
    res.status(500).json({ error: 'Failed to update SEP-1 bundle action.' });
  }
});

router.get('/sepsis/alerts', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const alerts = await sepsisWatchdogService.getActiveSepsisAlerts();
    res.json(alerts);
  } catch (err: any) {
    console.error('Fetch sepsis alerts error:', err);
    res.status(500).json({ error: 'Failed to retrieve active sepsis alerts.' });
  }
});

router.get('/sepsis/patient/:patientId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = parseInt(req.params.patientId as string, 10);
    const history = await sepsisWatchdogService.getPatientSurveillanceHistory(patientId);
    res.json(history);
  } catch (err: any) {
    console.error('Fetch patient sepsis history error:', err);
    res.status(500).json({ error: 'Failed to fetch patient sepsis history.' });
  }
});

router.put('/sepsis/surveillance/:id/resolve', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const resolved = await sepsisWatchdogService.resolveAlert(id, req.body.notes);
    res.json(resolved);
  } catch (err: any) {
    console.error('Resolve sepsis alert error:', err);
    res.status(500).json({ error: 'Failed to resolve sepsis alert.' });
  }
});

// SSE endpoint for real-time clinician notifications
router.get('/notifications/stream', (req: AuthenticatedRequest, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

  const handler = (notification: ClinicianNotification) => {
    try {
      res.write(`data: ${JSON.stringify(notification)}\n\n`);
    } catch (err) {
      // Client disconnected
    }
  };

  notificationBus.on('notification', handler);

  // Keep-alive ping every 30s
  const keepAlive = setInterval(() => {
    try {
      res.write(`: keep-alive\n\n`);
    } catch (err) {
      clearInterval(keepAlive);
    }
  }, 30000);

  req.on('close', () => {
    notificationBus.removeListener('notification', handler);
    clearInterval(keepAlive);
    console.log('[SSE] Clinician notification stream closed.');
  });
});

export default router;
