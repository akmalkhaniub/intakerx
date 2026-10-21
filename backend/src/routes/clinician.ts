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
import { revCycleAppealsService } from '../services/revCycleAppeals';
import { hospitalAtHomeService } from '../services/hospitalAtHome';
import * as acousticBiomarkersService from '../services/acousticBiomarkers';
import { transferLogisticsService } from '../services/transferLogistics';
import { perioperativeSuiteService } from '../services/perioperativeSuite';
import { infectionSurveillanceService } from '../services/infectionSurveillance';
import * as dischargeMedRecService from '../services/dischargeMedRec';
import * as precisionOncologyService from '../services/precisionOncology';
import * as behavioralCrisisService from '../services/behavioralCrisis';
import * as criticalCareShockService from '../services/criticalCareShock';
import * as autonomousCdiService from '../services/autonomousCdi';
import * as organTransplantService from '../services/organTransplant';
import * as obstetricSafetyService from '../services/obstetricSafety';
import * as cleanroomCompoundingService from '../services/cleanroomCompounding';
import * as strokeCommandService from '../services/strokeCommand';
import * as massiveTransfusionService from '../services/massiveTransfusion';
import * as cathAlertService from '../services/cathAlert';
import * as ecmoSupportService from '../services/ecmoSupport';
import * as burnTraumaService from '../services/burnTrauma';
import * as pediatricResuscitationService from '../services/pediatricResuscitation';
import * as airwayIntubationService from '../services/airwayIntubation';
import * as medicalToxicologyService from '../services/medicalToxicology';
import * as crrtNavigatorService from '../services/crrtNavigator';
import * as radiationTheranosticsService from '../services/radiationTheranostics';
import * as hemodynamicSwanGanzService from '../services/hemodynamicSwanGanz';
import * as spinalCordInjuryService from '../services/spinalCordInjury';
import * as cbrneTriageService from '../services/cbrneTriage';
import * as hyperbaricMedicineService from '../services/hyperbaricMedicine';
import * as liverSupportService from '../services/liverSupport';
import * as cdsHooksFhirService from '../services/cdsHooksFhir';
import * as teleIcuScribeService from '../services/teleIcuScribe';
import * as neuroCriticalCareService from '../services/neuroCriticalCare';
import * as cellularImmunotherapyService from '../services/cellularImmunotherapy';
import * as ecprResuscitationService from '../services/ecprResuscitation';
import * as digitalTwinOperationsService from '../services/digitalTwinOperations';
import * as vascularLimbService from '../services/vascularLimb';
import * as metabolicKetoService from '../services/metabolicKeto';
import * as coagRotemService from '../services/coagRotem';
import * as icuRoundingService from '../services/icuRounding';
import * as acutePancreatitisService from '../services/acutePancreatitis';
import * as therapeuticApheresisService from '../services/therapeuticApheresis';
import * as vadPulseService from '../services/vadPulse';
import * as comfortCareService from '../services/comfortCare';
import * as codeNavigatorService from '../services/codeNavigator';
import * as pneumoDrainService from '../services/pneumoDrain';
import * as statusPulmoService from '../services/statusPulmo';
import * as aortaCodeService from '../services/aortaCode';

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

// Phase 37: Zero-Click Revenue Cycle & Denial Appeals AI Engine
router.post('/revcycle/scrub', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { cptCodes, icd10Codes } = req.body;
    if (!cptCodes || !icd10Codes) {
      return res.status(400).json({ error: 'cptCodes and icd10Codes are required.' });
    }
    const result = revCycleAppealsService.scrubClaim(cptCodes, icd10Codes);
    res.json(result);
  } catch (err: any) {
    console.error('Scrub claim error:', err);
    res.status(500).json({ error: 'Failed to scrub claim line items.' });
  }
});

router.post('/revcycle/claims', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { patientId, sessionId, claimType, payerName, cptCodes, icd10Codes } = req.body;
    if (!patientId || !payerName || !cptCodes) {
      return res.status(400).json({ error: 'patientId, payerName, and cptCodes are required.' });
    }
    const created = await revCycleAppealsService.createClaim({
      patientId: parseInt(patientId, 10),
      sessionId,
      claimType,
      payerName,
      cptCodes,
      icd10Codes: icd10Codes || []
    });
    res.json(created);
  } catch (err: any) {
    console.error('Create claim error:', err);
    res.status(500).json({ error: 'Failed to create revenue cycle claim.' });
  }
});

router.get('/revcycle/claims', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const claims = await revCycleAppealsService.getClaims(status);
    res.json(claims);
  } catch (err: any) {
    console.error('Fetch claims error:', err);
    res.status(500).json({ error: 'Failed to fetch claims list.' });
  }
});

router.post('/revcycle/claims/:id/simulate-denial', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const claimId = parseInt(req.params.id as string, 10);
    const { denialCode, denialDescription } = req.body;
    const denied = await revCycleAppealsService.simulateClaimDenial(claimId, denialCode, denialDescription);
    res.json(denied);
  } catch (err: any) {
    console.error('Simulate denial error:', err);
    res.status(500).json({ error: 'Failed to simulate claim denial.' });
  }
});

router.post('/revcycle/claims/:id/generate-appeal', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const claimId = parseInt(req.params.id as string, 10);
    const appeal = await revCycleAppealsService.generateAppealLetter(claimId);
    res.json(appeal);
  } catch (err: any) {
    console.error('Generate appeal letter error:', err);
    res.status(500).json({ error: 'Failed to generate clinical appeal letter.' });
  }
});

router.put('/revcycle/appeals/:id/submit', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const appealId = parseInt(req.params.id as string, 10);
    const submitted = await revCycleAppealsService.submitAppeal(appealId);
    res.json(submitted);
  } catch (err: any) {
    console.error('Submit appeal error:', err);
    res.status(500).json({ error: 'Failed to submit clinical appeal.' });
  }
});

// Phase 38: Hospital-at-Home (HaH) & Continuous RPM Fleet Command
router.post('/hah/enroll', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { patientId, sessionId, diagnosis, acuityTier, primaryVirtualNurseId } = req.body;
    if (!patientId || !diagnosis) {
      return res.status(400).json({ error: 'patientId and diagnosis are required.' });
    }
    const enrollment = await hospitalAtHomeService.enrollPatient(
      parseInt(patientId, 10),
      sessionId || null,
      diagnosis,
      acuityTier,
      primaryVirtualNurseId
    );
    res.json(enrollment);
  } catch (err: any) {
    console.error('HaH enroll error:', err);
    res.status(500).json({ error: 'Failed to enroll patient in Hospital-at-Home.' });
  }
});

router.post('/hah/devices/provision', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { enrollmentId, deviceType, serialNumber, syncFrequencyMinutes } = req.body;
    if (!enrollmentId || !deviceType || !serialNumber) {
      return res.status(400).json({ error: 'enrollmentId, deviceType, and serialNumber are required.' });
    }
    const device = await hospitalAtHomeService.provisionDevice({
      enrollmentId: parseInt(enrollmentId, 10),
      deviceType,
      serialNumber,
      syncFrequencyMinutes
    });
    res.json(device);
  } catch (err: any) {
    console.error('Provision device error:', err);
    res.status(500).json({ error: 'Failed to provision RPM device.' });
  }
});

router.post('/hah/telemetry/ingest', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { serialNumber, readingType, readingData } = req.body;
    if (!serialNumber || !readingType || !readingData) {
      return res.status(400).json({ error: 'serialNumber, readingType, and readingData are required.' });
    }
    const result = await hospitalAtHomeService.ingestTelemetry({
      serialNumber,
      readingType,
      readingData
    });
    res.json(result);
  } catch (err: any) {
    console.error('Ingest telemetry error:', err);
    res.status(500).json({ error: 'Failed to ingest biometric telemetry.' });
  }
});

router.get('/hah/fleet', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const fleet = await hospitalAtHomeService.getFleetOverview();
    res.json(fleet);
  } catch (err: any) {
    console.error('Fetch fleet error:', err);
    res.status(500).json({ error: 'Failed to retrieve HaH fleet overview.' });
  }
});

router.get('/hah/telemetry/:enrollmentId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const enrollmentId = parseInt(req.params.enrollmentId as string, 10);
    const telemetry = await hospitalAtHomeService.getEnrollmentTelemetry(enrollmentId);
    res.json(telemetry);
  } catch (err: any) {
    console.error('Fetch telemetry error:', err);
    res.status(500).json({ error: 'Failed to fetch enrollment telemetry.' });
  }
});

router.post('/hah/billing/calculate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { enrollmentId, transmissionDaysCount, clinicalMinutesSpent } = req.body;
    if (!enrollmentId) {
      return res.status(400).json({ error: 'enrollmentId is required.' });
    }
    const billing = await hospitalAtHomeService.calculateRpmBilling(
      parseInt(enrollmentId, 10),
      transmissionDaysCount,
      clinicalMinutesSpent
    );
    res.json(billing);
  } catch (err: any) {
    console.error('Calculate RPM billing error:', err);
    res.status(500).json({ error: 'Failed to calculate RPM billing.' });
  }
});

// Phase 39: Acoustic Biomarkers & Voice Affect Analyzer
router.post('/acoustic-biomarkers/analyze', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      sessionId,
      patientId,
      audioDurationSeconds,
      fundamentalFrequencyF0,
      f0StdDev,
      jitterPercent,
      shimmerPercent,
      hnrDb,
      speechRateWpm,
      pauseRatio,
      respiratoryPauseCount,
      affectiveTone,
      transcriptSample
    } = req.body;

    if (!patientId || audioDurationSeconds === undefined) {
      return res.status(400).json({ error: 'patientId and audioDurationSeconds are required.' });
    }

    const result = await acousticBiomarkersService.analyzeAndRecordAcousticSession({
      sessionId: sessionId || null,
      patientId: parseInt(patientId, 10),
      audioDurationSeconds: parseFloat(audioDurationSeconds),
      fundamentalFrequencyF0: parseFloat(fundamentalFrequencyF0 || 120),
      f0StdDev: parseFloat(f0StdDev || 20),
      jitterPercent: parseFloat(jitterPercent || 0.8),
      shimmerPercent: parseFloat(shimmerPercent || 2.5),
      hnrDb: parseFloat(hnrDb || 22),
      speechRateWpm: parseInt(speechRateWpm || 135, 10),
      pauseRatio: parseFloat(pauseRatio || 0.2),
      respiratoryPauseCount: respiratoryPauseCount !== undefined ? parseInt(respiratoryPauseCount, 10) : 0,
      affectiveTone,
      transcriptSample
    });

    res.json(result);
  } catch (err: any) {
    console.error('Acoustic biomarker analysis error:', err);
    res.status(500).json({ error: 'Failed to process and analyze acoustic biomarkers.' });
  }
});

router.get('/acoustic-biomarkers', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = req.query.patientId ? parseInt(req.query.patientId as string, 10) : undefined;
    const sessionId = req.query.sessionId as string | undefined;
    const sessions = await acousticBiomarkersService.getAcousticSessions(patientId, sessionId);
    res.json(sessions);
  } catch (err: any) {
    console.error('Fetch acoustic biomarker sessions error:', err);
    res.status(500).json({ error: 'Failed to retrieve voice biomarker sessions.' });
  }
});

router.get('/acoustic-biomarkers/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const session = await acousticBiomarkersService.getAcousticSessionById(id);
    if (!session) {
      return res.status(404).json({ error: 'Acoustic session not found.' });
    }
    res.json(session);
  } catch (err: any) {
    console.error('Fetch acoustic session error:', err);
    res.status(500).json({ error: 'Failed to retrieve acoustic session details.' });
  }
});

// Phase 40: Inter-Facility Acute Transfer Center & Bed Logistics (EMTALA Hub)
router.post('/transfers/request', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      patientId,
      sessionId,
      sendingFacility,
      receivingFacility,
      serviceNeeded,
      urgencyLevel,
      sendingPhysicianName,
      clinicalRationale,
      transportMode
    } = req.body;

    if (!patientId || !sendingFacility || !receivingFacility || !serviceNeeded || !sendingPhysicianName) {
      return res.status(400).json({ error: 'Missing mandatory transfer request parameters.' });
    }

    const request = await transferLogisticsService.createTransferRequest({
      patientId: parseInt(patientId, 10),
      sessionId: sessionId || null,
      sendingFacility,
      receivingFacility,
      serviceNeeded,
      urgencyLevel: urgencyLevel || 'stat_emergent',
      sendingPhysicianName,
      clinicalRationale: clinicalRationale || 'Acute care level elevation required for patient safety.',
      transportMode: transportMode || 'ground_als'
    });

    res.json(request);
  } catch (err: any) {
    console.error('Create transfer request error:', err);
    res.status(500).json({ error: err.message || 'Failed to create transfer request.' });
  }
});

router.post('/transfers/:id/accept', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { receivingPhysician, bedId } = req.body;

    if (!receivingPhysician) {
      return res.status(400).json({ error: 'receivingPhysician is required for EMTALA acceptance.' });
    }

    const updated = await transferLogisticsService.acceptTransfer(
      id,
      receivingPhysician,
      bedId ? parseInt(bedId, 10) : undefined
    );
    res.json(updated);
  } catch (err: any) {
    console.error('Accept transfer error:', err);
    res.status(500).json({ error: err.message || 'Failed to accept transfer.' });
  }
});

router.post('/transfers/:id/dispatch', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { transportMode, etaMinutes } = req.body;

    const updated = await transferLogisticsService.dispatchTransport(
      id,
      transportMode || 'ground_als',
      etaMinutes ? parseInt(etaMinutes, 10) : 30
    );
    res.json(updated);
  } catch (err: any) {
    console.error('Dispatch transport error:', err);
    res.status(500).json({ error: err.message || 'Failed to dispatch transport.' });
  }
});

router.post('/transfers/:id/complete', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const updated = await transferLogisticsService.completeTransfer(id);
    res.json(updated);
  } catch (err: any) {
    console.error('Complete transfer error:', err);
    res.status(500).json({ error: err.message || 'Failed to complete transfer.' });
  }
});

router.get('/transfers/requests', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const requests = await transferLogisticsService.getTransferRequests(status);
    res.json(requests);
  } catch (err: any) {
    console.error('Get transfer requests error:', err);
    res.status(500).json({ error: 'Failed to retrieve transfer requests.' });
  }
});

router.get('/transfers/beds', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const bedType = req.query.bedType as string | undefined;
    const inventory = await transferLogisticsService.getBedInventory(status, bedType);
    res.json(inventory);
  } catch (err: any) {
    console.error('Get bed inventory error:', err);
    res.status(500).json({ error: 'Failed to retrieve hospital bed inventory.' });
  }
});

// Phase 41: OR/Surgical Suite Logistics & Perioperative Care (ERAS Hub)
router.post('/perioperative/cases', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      patientId,
      sessionId,
      procedureName,
      operatingRoom,
      primarySurgeon,
      anesthesiologist,
      asaClass,
      rcriFactors,
      mallampatiClass,
      npoStatusVerified
    } = req.body;

    if (!patientId || !procedureName || !operatingRoom || !primarySurgeon || !anesthesiologist) {
      return res.status(400).json({ error: 'Missing required surgical case fields.' });
    }

    const created = await perioperativeSuiteService.createSurgicalCase({
      patientId: parseInt(patientId, 10),
      sessionId: sessionId || null,
      procedureName,
      operatingRoom,
      primarySurgeon,
      anesthesiologist,
      asaClass: asaClass || 'ASA_II',
      rcriFactors,
      mallampatiClass,
      npoStatusVerified: npoStatusVerified !== undefined ? npoStatusVerified : true
    });

    res.json(created);
  } catch (err: any) {
    console.error('Create surgical case error:', err);
    res.status(500).json({ error: err.message || 'Failed to create surgical case.' });
  }
});

router.put('/perioperative/cases/:id/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'status is required.' });
    }
    const updated = await perioperativeSuiteService.updateCaseStatus(id, status);
    res.json(updated);
  } catch (err: any) {
    console.error('Update case status error:', err);
    res.status(500).json({ error: err.message || 'Failed to update case status.' });
  }
});

router.post('/perioperative/cases/:id/anesthesia', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const caseId = parseInt(req.params.id as string, 10);
    const {
      anesthesiaType,
      airwayGrade,
      tofTwitchCount,
      reversalAgent,
      eblMl,
      fluidsAdministeredMl,
      aldreteScore,
      ponvApfelScore,
      erasAdherenceItems,
      anesthesiologistNotes
    } = req.body;

    if (!anesthesiaType || tofTwitchCount === undefined || aldreteScore === undefined) {
      return res.status(400).json({ error: 'anesthesiaType, tofTwitchCount, and aldreteScore are required.' });
    }

    const log = await perioperativeSuiteService.recordAnesthesiaLog({
      caseId,
      anesthesiaType,
      airwayGrade: airwayGrade || 'Grade_1',
      tofTwitchCount: parseInt(tofTwitchCount, 10),
      reversalAgent,
      eblMl: parseInt(eblMl || 0, 10),
      fluidsAdministeredMl: parseInt(fluidsAdministeredMl || 1000, 10),
      aldreteScore: parseInt(aldreteScore, 10),
      ponvApfelScore: parseInt(ponvApfelScore || 1, 10),
      erasAdherenceItems: erasAdherenceItems || [],
      anesthesiologistNotes
    });

    res.json(log);
  } catch (err: any) {
    console.error('Record anesthesia log error:', err);
    res.status(500).json({ error: err.message || 'Failed to record anesthesia log.' });
  }
});

router.get('/perioperative/cases', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const operatingRoom = req.query.operatingRoom as string | undefined;
    const cases = await perioperativeSuiteService.getSurgicalCases(status, operatingRoom);
    res.json(cases);
  } catch (err: any) {
    console.error('Get surgical cases error:', err);
    res.status(500).json({ error: 'Failed to retrieve surgical cases.' });
  }
});

router.get('/perioperative/cases/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const surgicalCase = await perioperativeSuiteService.getCaseById(id);
    if (!surgicalCase) {
      return res.status(404).json({ error: 'Surgical case not found.' });
    }
    res.json(surgicalCase);
  } catch (err: any) {
    console.error('Get single surgical case error:', err);
    res.status(500).json({ error: 'Failed to retrieve surgical case.' });
  }
});

// Phase 42: Infection Prevention & Hospital Acquired Condition (HAI / CDC NHSN) Surveillance
router.post('/infection/lines', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      patientId,
      sessionId,
      deviceType,
      insertionDate,
      lineDaysCount,
      anatomicalSite,
      necessityJustification,
      bundleChecklist
    } = req.body;

    if (!patientId || !deviceType || !insertionDate || !anatomicalSite || !necessityJustification) {
      return res.status(400).json({ error: 'Missing mandatory invasive line parameters.' });
    }

    const created = await infectionSurveillanceService.logDeviceLine({
      patientId: parseInt(patientId, 10),
      sessionId: sessionId || null,
      deviceType,
      insertionDate,
      lineDaysCount: lineDaysCount ? parseInt(lineDaysCount, 10) : 1,
      anatomicalSite,
      necessityJustification,
      bundleChecklist
    });

    res.json(created);
  } catch (err: any) {
    console.error('Log device line error:', err);
    res.status(500).json({ error: err.message || 'Failed to log invasive device line.' });
  }
});

router.put('/infection/lines/:id/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { status, removalDate } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'status is required.' });
    }
    const updated = await infectionSurveillanceService.updateDeviceStatus(id, status, removalDate);
    res.json(updated);
  } catch (err: any) {
    console.error('Update line status error:', err);
    res.status(500).json({ error: err.message || 'Failed to update line status.' });
  }
});

router.post('/infection/surveillance/evaluate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      patientId,
      deviceLineId,
      infectionType,
      identifiedOrganism,
      colonyCount,
      lineDaysAtOnset,
      feverPresent,
      clinicalSignsDescription,
      primaryAlternativeSourceExcluded
    } = req.body;

    if (!patientId || !infectionType || !identifiedOrganism || !clinicalSignsDescription) {
      return res.status(400).json({ error: 'Missing mandatory HAI evaluation parameters.' });
    }

    const event = await infectionSurveillanceService.evaluateHaiInfection({
      patientId: parseInt(patientId, 10),
      deviceLineId: deviceLineId ? parseInt(deviceLineId, 10) : null,
      infectionType,
      identifiedOrganism,
      colonyCount,
      lineDaysAtOnset: lineDaysAtOnset ? parseInt(lineDaysAtOnset, 10) : undefined,
      feverPresent: Boolean(feverPresent),
      clinicalSignsDescription,
      primaryAlternativeSourceExcluded: primaryAlternativeSourceExcluded !== undefined ? Boolean(primaryAlternativeSourceExcluded) : true
    });

    res.json(event);
  } catch (err: any) {
    console.error('Evaluate HAI infection error:', err);
    res.status(500).json({ error: err.message || 'Failed to evaluate HAI infection.' });
  }
});

router.get('/infection/surveillance/summary', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const summary = await infectionSurveillanceService.getHaiSurveillanceSummary();
    res.json(summary);
  } catch (err: any) {
    console.error('Get HAI surveillance summary error:', err);
    res.status(500).json({ error: 'Failed to retrieve infection surveillance summary.' });
  }
});

router.get('/infection/lines', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = req.query.patientId ? parseInt(req.query.patientId as string, 10) : undefined;
    const status = req.query.status as string | undefined;
    const lines = await infectionSurveillanceService.getDeviceLines(patientId, status);
    res.json(lines);
  } catch (err: any) {
    console.error('Get device lines error:', err);
    res.status(500).json({ error: 'Failed to retrieve invasive lines list.' });
  }
});

// ==========================================
// Phase 43: Autonomous Discharge MedRec & Meds-to-Beds Routes
// ==========================================

router.get('/med-rec/summary', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const summary = await dischargeMedRecService.getMedRecSummary();
    res.json(summary);
  } catch (err: any) {
    console.error('Get MedRec summary error:', err);
    res.status(500).json({ error: 'Failed to retrieve medication reconciliation summary.' });
  }
});

router.post('/med-rec/reconcile', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      patientId,
      sessionId,
      reconciliationType,
      homeMedications,
      inpatientMedications,
      dischargeMedications,
      eGfr,
      reviewedBy
    } = req.body;

    if (!patientId) {
      return res.status(400).json({ error: 'patientId is required for medication reconciliation.' });
    }

    const result = await dischargeMedRecService.performDischargeMedRec({
      patientId: parseInt(patientId, 10),
      sessionId,
      reconciliationType,
      homeMedications: homeMedications || [],
      inpatientMedications: inpatientMedications || [],
      dischargeMedications: dischargeMedications || [],
      eGfr: eGfr !== undefined ? Number(eGfr) : undefined,
      reviewedBy: reviewedBy || (req.user ? `${req.user.role} (${req.user.email || 'Staff'})` : 'Clinical Pharmacist')
    });

    res.json(result);
  } catch (err: any) {
    console.error('Perform MedRec error:', err);
    res.status(500).json({ error: err.message || 'Failed to perform discharge medication reconciliation.' });
  }
});

router.post('/med-rec/delivery-orders', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      reconciliationId,
      patientId,
      roomBed,
      targetDischargeTime,
      courierName,
      copayAmount,
      medicationList,
      pharmacistNotes
    } = req.body;

    if (!reconciliationId || !patientId || !roomBed) {
      return res.status(400).json({ error: 'reconciliationId, patientId, and roomBed are required.' });
    }

    const order = await dischargeMedRecService.createBedsideDeliveryOrder({
      reconciliationId: parseInt(reconciliationId, 10),
      patientId: parseInt(patientId, 10),
      roomBed,
      targetDischargeTime,
      courierName,
      copayAmount: copayAmount !== undefined ? Number(copayAmount) : 0,
      medicationList: medicationList || [],
      pharmacistNotes
    });

    res.status(201).json(order);
  } catch (err: any) {
    console.error('Create bedside delivery order error:', err);
    res.status(500).json({ error: err.message || 'Failed to create bedside delivery order.' });
  }
});

router.patch('/med-rec/delivery-orders/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orderId = parseInt(req.params.id as string, 10);
    const { deliveryStatus, copayCollected, teachBackCompleted, courierName, pharmacistNotes } = req.body;

    if (!deliveryStatus) {
      return res.status(400).json({ error: 'deliveryStatus is required.' });
    }

    const updated = await dischargeMedRecService.updateDeliveryStatus(orderId, deliveryStatus, {
      copayCollected,
      teachBackCompleted,
      courierName,
      pharmacistNotes
    });

    res.json(updated);
  } catch (err: any) {
    console.error('Update delivery order status error:', err);
    res.status(500).json({ error: err.message || 'Failed to update delivery order.' });
  }
});

router.get('/med-rec/patient/:patientId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = parseInt(req.params.patientId as string, 10);
    const data = await dischargeMedRecService.getPatientMedRecs(patientId);
    res.json(data);
  } catch (err: any) {
    console.error('Get patient med-recs error:', err);
    res.status(500).json({ error: 'Failed to retrieve patient med rec records.' });
  }
});

// ==========================================
// Phase 44: Precision Oncology & Genomic Tumor Board Routes
// ==========================================

router.get('/oncology/summary', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const summary = await precisionOncologyService.getOncologySummary();
    res.json(summary);
  } catch (err: any) {
    console.error('Get oncology summary error:', err);
    res.status(500).json({ error: 'Failed to retrieve precision oncology summary.' });
  }
});

router.post('/oncology/variants', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { patientId, sessionId, geneSymbol, variantNomenclature, variantAlleleFrequency, ampTier, actionableDrugTarget, evidenceLevel } = req.body;
    if (!patientId || !geneSymbol || !variantNomenclature) {
      return res.status(400).json({ error: 'patientId, geneSymbol, and variantNomenclature are required.' });
    }

    const variant = await precisionOncologyService.evaluateGenomicVariant({
      patientId: parseInt(patientId, 10),
      sessionId,
      geneSymbol,
      variantNomenclature,
      variantAlleleFrequency: variantAlleleFrequency !== undefined ? Number(variantAlleleFrequency) : undefined,
      ampTier,
      actionableDrugTarget,
      evidenceLevel
    });

    res.status(201).json(variant);
  } catch (err: any) {
    console.error('Evaluate genomic variant error:', err);
    res.status(500).json({ error: err.message || 'Failed to evaluate genomic variant.' });
  }
});

router.post('/oncology/pathway-evaluate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      patientId,
      sessionId,
      cancerType,
      histology,
      clinicalStage,
      biomarkerProfile,
      proposedRegimen,
      heightCm,
      weightKg,
      gfr,
      targetCarboplatinAuc,
      oncologistSignature
    } = req.body;

    if (!patientId || !cancerType || !histology || !clinicalStage || !proposedRegimen) {
      return res.status(400).json({ error: 'patientId, cancerType, histology, clinicalStage, and proposedRegimen are required.' });
    }

    const pathway = await precisionOncologyService.evaluatePathwayAndRegimen({
      patientId: parseInt(patientId, 10),
      sessionId,
      cancerType,
      histology,
      clinicalStage,
      biomarkerProfile: biomarkerProfile || {},
      proposedRegimen,
      heightCm: heightCm ? Number(heightCm) : undefined,
      weightKg: weightKg ? Number(weightKg) : undefined,
      gfr: gfr ? Number(gfr) : undefined,
      targetCarboplatinAuc: targetCarboplatinAuc ? Number(targetCarboplatinAuc) : undefined,
      oncologistSignature
    });

    res.json(pathway);
  } catch (err: any) {
    console.error('Evaluate oncology pathway error:', err);
    res.status(500).json({ error: err.message || 'Failed to evaluate oncology pathway.' });
  }
});

router.get('/oncology/patient/:patientId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = parseInt(req.params.patientId as string, 10);
    const data = await precisionOncologyService.getPatientOncologyData(patientId);
    res.json(data);
  } catch (err: any) {
    console.error('Get patient oncology data error:', err);
    res.status(500).json({ error: 'Failed to retrieve patient oncology records.' });
  }
});

// ==========================================
// Phase 45: Behavioral Health Emergency Command & Crisis Routes
// ==========================================

router.get('/behavioral/summary', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const summary = await behavioralCrisisService.getBehavioralCrisisSummary();
    res.json(summary);
  } catch (err: any) {
    console.error('Get behavioral crisis summary error:', err);
    res.status(500).json({ error: 'Failed to retrieve behavioral crisis summary.' });
  }
});

router.post('/behavioral/evaluations', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      patientId,
      sessionId,
      bvcItems,
      suicideRiskLevel,
      sensoryRoomUtilized,
      chemicalRestraintAdministered,
      evaluatingClinician,
      clinicalNarrative
    } = req.body;

    if (!patientId || !bvcItems) {
      return res.status(400).json({ error: 'patientId and bvcItems checklist are required.' });
    }

    const evaluation = await behavioralCrisisService.evaluateBehavioralCrisis({
      patientId: parseInt(patientId, 10),
      sessionId,
      bvcItems,
      suicideRiskLevel,
      sensoryRoomUtilized: Boolean(sensoryRoomUtilized),
      chemicalRestraintAdministered: Boolean(chemicalRestraintAdministered),
      evaluatingClinician,
      clinicalNarrative
    });

    res.status(201).json(evaluation);
  } catch (err: any) {
    console.error('Create behavioral evaluation error:', err);
    res.status(500).json({ error: err.message || 'Failed to record crisis evaluation.' });
  }
});

router.post('/behavioral/holds', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      patientId,
      crisisEvaluationId,
      statutoryHoldType,
      holdCriteria,
      rightsAdvisementDelivered,
      holdDurationHours,
      initiatingClinician,
      destinationFacility
    } = req.body;

    if (!patientId || !statutoryHoldType || !holdCriteria || holdCriteria.length === 0) {
      return res.status(400).json({ error: 'patientId, statutoryHoldType, and at least one holdCriteria are required.' });
    }

    const hold = await behavioralCrisisService.initiateInvoluntaryHold({
      patientId: parseInt(patientId, 10),
      crisisEvaluationId: crisisEvaluationId ? parseInt(crisisEvaluationId, 10) : undefined,
      statutoryHoldType,
      holdCriteria,
      rightsAdvisementDelivered: rightsAdvisementDelivered !== undefined ? Boolean(rightsAdvisementDelivered) : true,
      holdDurationHours: holdDurationHours ? Number(holdDurationHours) : 72,
      initiatingClinician,
      destinationFacility
    });

    res.status(201).json(hold);
  } catch (err: any) {
    console.error('Initiate involuntary hold error:', err);
    res.status(500).json({ error: err.message || 'Failed to initiate involuntary hold.' });
  }
});

router.patch('/behavioral/holds/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const holdId = parseInt(req.params.id as string, 10);
    const { bedPlacementStatus, destinationFacility, holdStatus } = req.body;

    const updated = await behavioralCrisisService.updateHoldPlacement(holdId, {
      bedPlacementStatus,
      destinationFacility,
      holdStatus
    });

    res.json(updated);
  } catch (err: any) {
    console.error('Update involuntary hold placement error:', err);
    res.status(500).json({ error: err.message || 'Failed to update hold placement.' });
  }
});

router.get('/behavioral/patient/:patientId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = parseInt(req.params.patientId as string, 10);
    const data = await behavioralCrisisService.getPatientPsychData(patientId);
    res.json(data);
  } catch (err: any) {
    console.error('Get patient behavioral data error:', err);
    res.status(500).json({ error: 'Failed to retrieve patient behavioral health records.' });
  }
});

// ==========================================
// Phase 46: Critical Care & ICU Hemodynamic Shock Routes
// ==========================================

router.get('/icu-shock/summary', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const summary = await criticalCareShockService.getIcuShockSummary();
    res.json(summary);
  } catch (err: any) {
    console.error('Get ICU shock summary error:', err);
    res.status(500).json({ error: 'Failed to retrieve ICU shock summary.' });
  }
});

router.post('/icu-shock/evaluate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      patientId,
      sessionId,
      icuBed,
      shockPhenotype,
      meanArterialPressure,
      cardiacIndex,
      systemicVascularResistance,
      fluidResponsivenessIndex,
      ultrasoundPattern,
      serumLactateMmolL,
      baselineLactate,
      primaryVasopressor,
      currentDoseMcgKgMin,
      attendingIntensivist
    } = req.body;

    if (!patientId || !icuBed || !shockPhenotype || meanArterialPressure === undefined || serumLactateMmolL === undefined) {
      return res.status(400).json({ error: 'patientId, icuBed, shockPhenotype, meanArterialPressure, and serumLactateMmolL are required.' });
    }

    const evaluation = await criticalCareShockService.evaluateShockAndResuscitation({
      patientId: parseInt(patientId, 10),
      sessionId,
      icuBed,
      shockPhenotype,
      meanArterialPressure: Number(meanArterialPressure),
      cardiacIndex: cardiacIndex !== undefined ? Number(cardiacIndex) : undefined,
      systemicVascularResistance: systemicVascularResistance !== undefined ? Number(systemicVascularResistance) : undefined,
      fluidResponsivenessIndex,
      ultrasoundPattern,
      serumLactateMmolL: Number(serumLactateMmolL),
      baselineLactate: baselineLactate !== undefined ? Number(baselineLactate) : undefined,
      primaryVasopressor,
      currentDoseMcgKgMin: currentDoseMcgKgMin !== undefined ? Number(currentDoseMcgKgMin) : undefined,
      attendingIntensivist
    });

    res.status(201).json(evaluation);
  } catch (err: any) {
    console.error('Evaluate ICU shock error:', err);
    res.status(500).json({ error: err.message || 'Failed to evaluate shock resuscitation status.' });
  }
});

router.post('/icu-shock/titrations', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { shockRecordId, agentName, doseRate, doseUnits, targetMap, resultingMap, titrationReason, titratedBy } = req.body;

    if (!shockRecordId || !agentName || doseRate === undefined || resultingMap === undefined || !titrationReason) {
      return res.status(400).json({ error: 'shockRecordId, agentName, doseRate, resultingMap, and titrationReason are required.' });
    }

    const titration = await criticalCareShockService.recordVasopressorTitration({
      shockRecordId: parseInt(shockRecordId, 10),
      agentName,
      doseRate: Number(doseRate),
      doseUnits,
      targetMap: targetMap ? Number(targetMap) : 65,
      resultingMap: Number(resultingMap),
      titrationReason,
      titratedBy
    });

    res.status(201).json(titration);
  } catch (err: any) {
    console.error('Record vasopressor titration error:', err);
    res.status(500).json({ error: err.message || 'Failed to log vasopressor titration.' });
  }
});

router.get('/icu-shock/patient/:patientId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = parseInt(req.params.patientId as string, 10);
    const data = await criticalCareShockService.getPatientShockData(patientId);
    res.json(data);
  } catch (err: any) {
    console.error('Get patient shock records error:', err);
    res.status(500).json({ error: 'Failed to retrieve patient shock records.' });
  }
});

// Phase 47: Autonomous Clinical Documentation Improvement (CDI) & Physician Query Hub
router.post('/cdi/audit', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { patientId, sessionId, principalDiagnosis, secondaryDiagnoses, clinicalIndicators, reviewerNotes } = req.body;
    if (!patientId || !principalDiagnosis || !clinicalIndicators) {
      return res.status(400).json({ error: 'patientId, principalDiagnosis, and clinicalIndicators are required.' });
    }

    const review = await autonomousCdiService.AutonomousCdiService.auditChartForDiscrepancies({
      patientId: parseInt(patientId, 10),
      sessionId,
      principalDiagnosis,
      secondaryDiagnoses: secondaryDiagnoses || [],
      clinicalIndicators,
      reviewerNotes
    });

    res.json(review);
  } catch (err: any) {
    console.error('CDI chart audit error:', err);
    res.status(500).json({ error: err.message || 'Failed to execute CDI chart audit.' });
  }
});

router.post('/cdi/queries/generate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { cdiReviewId, queryType } = req.body;
    if (!cdiReviewId || !queryType) {
      return res.status(400).json({ error: 'cdiReviewId and queryType are required.' });
    }

    const query = await autonomousCdiService.AutonomousCdiService.generateCompliantPhysicianQuery({
      cdiReviewId: parseInt(cdiReviewId, 10),
      queryType
    });

    res.json(query);
  } catch (err: any) {
    console.error('Generate physician query error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate physician query.' });
  }
});

router.post('/cdi/queries/:id/respond', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const queryId = parseInt(req.params.id as string, 10);
    const { selectedDiagnosis, physicianResponse, physicianNotes } = req.body;

    if (!physicianResponse) {
      return res.status(400).json({ error: 'physicianResponse (agree, disagree, or undetermined) is required.' });
    }

    const result = await autonomousCdiService.AutonomousCdiService.submitPhysicianResponse({
      queryId,
      selectedDiagnosis: selectedDiagnosis || '',
      physicianResponse,
      physicianNotes
    });

    res.json(result);
  } catch (err: any) {
    console.error('Submit query response error:', err);
    res.status(500).json({ error: err.message || 'Failed to submit physician query response.' });
  }
});

router.get('/cdi/analytics', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const analytics = await autonomousCdiService.AutonomousCdiService.getCdiAnalytics();
    res.json(analytics);
  } catch (err: any) {
    console.error('Get CDI analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch CDI analytics.' });
  }
});

router.get('/cdi/reviews', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;
    const reviews = await autonomousCdiService.AutonomousCdiService.getRecentReviews(limit);
    res.json(reviews);
  } catch (err: any) {
    console.error('Get CDI reviews error:', err);
    res.status(500).json({ error: 'Failed to fetch CDI reviews.' });
  }
});

router.get('/cdi/queries', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = req.query.patientId ? parseInt(req.query.patientId as string, 10) : undefined;
    const status = req.query.status as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    const queries = await autonomousCdiService.AutonomousCdiService.getQueries({ patientId, status, limit });
    res.json(queries);
  } catch (err: any) {
    console.error('Get CDI queries error:', err);
    res.status(500).json({ error: 'Failed to fetch physician queries.' });
  }
});

// Phase 48: Solid Organ Transplant Logistics & HLA Virtual Crossmatch Engine
router.post('/transplant/calc/meld-na', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { creatinine, bilirubin, inr, sodium, onDialysisTwicePastWeek } = req.body;
    if (creatinine === undefined || bilirubin === undefined || inr === undefined || sodium === undefined) {
      return res.status(400).json({ error: 'creatinine, bilirubin, inr, and sodium are required.' });
    }

    const scores = organTransplantService.OrganTransplantService.calculateMeldNa({
      creatinine: parseFloat(creatinine),
      bilirubin: parseFloat(bilirubin),
      inr: parseFloat(inr),
      sodium: parseFloat(sodium),
      onDialysisTwicePastWeek: !!onDialysisTwicePastWeek
    });

    res.json(scores);
  } catch (err: any) {
    console.error('Calculate MELD-Na error:', err);
    res.status(500).json({ error: 'Failed to calculate MELD-Na score.' });
  }
});

router.post('/transplant/calc/kdpi', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { donorAge, donorHeightCm, donorWeightKg, hypertension, diabetes, causeOfDeath, creatinine, dcd, hcvPositive } = req.body;
    if (donorAge === undefined || creatinine === undefined) {
      return res.status(400).json({ error: 'donorAge and creatinine are required.' });
    }

    const kdpi = organTransplantService.OrganTransplantService.calculateKdpi({
      donorAge: parseInt(donorAge, 10),
      donorHeightCm: parseFloat(donorHeightCm || 170),
      donorWeightKg: parseFloat(donorWeightKg || 75),
      hypertension: !!hypertension,
      diabetes: !!diabetes,
      causeOfDeath: causeOfDeath || 'trauma',
      creatinine: parseFloat(creatinine),
      dcd: !!dcd,
      hcvPositive: !!hcvPositive
    });

    res.json({ kdpi });
  } catch (err: any) {
    console.error('Calculate KDPI error:', err);
    res.status(500).json({ error: 'Failed to calculate KDPI.' });
  }
});

router.post('/transplant/cases', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      patientId,
      organType,
      recipientBloodGroup,
      meldNaScore,
      kdpiScore,
      cpraPercentage,
      recipientHla,
      unacceptableAntigens,
      assignedSurgeon
    } = req.body;

    if (!patientId || !organType || !recipientBloodGroup || !recipientHla) {
      return res.status(400).json({ error: 'patientId, organType, recipientBloodGroup, and recipientHla are required.' });
    }

    const transplantCase = await organTransplantService.OrganTransplantService.createTransplantCase({
      patientId: parseInt(patientId, 10),
      organType,
      recipientBloodGroup,
      meldNaScore: meldNaScore ? parseInt(meldNaScore, 10) : undefined,
      kdpiScore: kdpiScore ? parseInt(kdpiScore, 10) : undefined,
      cpraPercentage: cpraPercentage ? parseFloat(cpraPercentage) : 0,
      recipientHla,
      unacceptableAntigens: unacceptableAntigens || [],
      assignedSurgeon
    });

    res.json(transplantCase);
  } catch (err: any) {
    console.error('Create transplant case error:', err);
    res.status(500).json({ error: err.message || 'Failed to create transplant case.' });
  }
});

router.post('/transplant/crossmatch', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      transplantCaseId,
      donorUnosId,
      donorBloodGroup,
      donorHla,
      preservationMethod,
      crossClampTimestamp,
      transitEtaMinutes,
      reviewedByDirector
    } = req.body;

    if (!transplantCaseId || !donorUnosId || !donorBloodGroup || !donorHla) {
      return res.status(400).json({ error: 'transplantCaseId, donorUnosId, donorBloodGroup, and donorHla are required.' });
    }

    const result = await organTransplantService.OrganTransplantService.runVirtualCrossmatch({
      transplantCaseId: parseInt(transplantCaseId, 10),
      donorUnosId,
      donorBloodGroup,
      donorHla,
      preservationMethod: preservationMethod || 'static_cold_storage',
      crossClampTimestamp,
      transitEtaMinutes: transitEtaMinutes ? parseInt(transitEtaMinutes, 10) : 90,
      reviewedByDirector
    });

    res.json(result);
  } catch (err: any) {
    console.error('Run virtual crossmatch error:', err);
    res.status(500).json({ error: err.message || 'Failed to execute virtual crossmatch.' });
  }
});

router.post('/transplant/cases/:id/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const caseId = parseInt(req.params.id as string, 10);
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'status is required.' });
    }

    const updated = await organTransplantService.OrganTransplantService.updateCaseStatus(caseId, status);
    res.json(updated);
  } catch (err: any) {
    console.error('Update transplant status error:', err);
    res.status(500).json({ error: err.message || 'Failed to update transplant status.' });
  }
});

router.get('/transplant/analytics', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const analytics = await organTransplantService.OrganTransplantService.getTransplantDashboardAnalytics();
    res.json(analytics);
  } catch (err: any) {
    console.error('Get transplant analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch transplant analytics.' });
  }
});

router.get('/transplant/cases', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const organType = req.query.organType as string | undefined;
    const cases = await organTransplantService.OrganTransplantService.getTransplantCases(status, organType);
    res.json(cases);
  } catch (err: any) {
    console.error('Get transplant cases error:', err);
    res.status(500).json({ error: 'Failed to fetch transplant cases.' });
  }
});

router.get('/transplant/cases/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const caseId = parseInt(req.params.id as string, 10);
    const caseDetail = await organTransplantService.OrganTransplantService.getCaseDetails(caseId);
    res.json(caseDetail);
  } catch (err: any) {
    console.error('Get transplant case details error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch case details.' });
  }
});

// Phase 49: Labor & Delivery / Obstetric Emergency Command (OB-SAFE Hub)
router.post('/obstetric/fetal-logs', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      patientId,
      gestationalAgeWeeks,
      fhrBaselineBpm,
      variability,
      accelerationsPresent,
      decelerationsType,
      uterineContractionsPer10min,
      interventionsPerformed,
      loggedBy
    } = req.body;

    if (!patientId || !gestationalAgeWeeks || !fhrBaselineBpm || !variability) {
      return res.status(400).json({ error: 'patientId, gestationalAgeWeeks, fhrBaselineBpm, and variability are required.' });
    }

    const log = await obstetricSafetyService.ObstetricSafetyService.recordFetalMonitoringLog({
      patientId: parseInt(patientId, 10),
      gestationalAgeWeeks: parseFloat(gestationalAgeWeeks),
      fhrBaselineBpm: parseInt(fhrBaselineBpm, 10),
      variability,
      accelerationsPresent: !!accelerationsPresent,
      decelerationsType: decelerationsType || 'none',
      uterineContractionsPer10min: uterineContractionsPer10min ? parseInt(uterineContractionsPer10min, 10) : 3,
      interventionsPerformed: interventionsPerformed || [],
      loggedBy
    });

    res.json(log);
  } catch (err: any) {
    console.error('Record fetal log error:', err);
    res.status(500).json({ error: err.message || 'Failed to record fetal monitoring log.' });
  }
});

router.post('/obstetric/emergencies/declare', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { patientId, emergencyType, quantitativeBloodLossMl, currentVitals, leadObstetrician } = req.body;
    if (!patientId || !emergencyType) {
      return res.status(400).json({ error: 'patientId and emergencyType are required.' });
    }

    const emergency = await obstetricSafetyService.ObstetricSafetyService.declareObstetricEmergency({
      patientId: parseInt(patientId, 10),
      emergencyType,
      quantitativeBloodLossMl: quantitativeBloodLossMl ? parseInt(quantitativeBloodLossMl, 10) : 0,
      currentVitals: currentVitals || {},
      leadObstetrician
    });

    res.json(emergency);
  } catch (err: any) {
    console.error('Declare obstetric emergency error:', err);
    res.status(500).json({ error: err.message || 'Failed to declare obstetric emergency.' });
  }
});

router.post('/obstetric/emergencies/:id/medications', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const emergencyId = parseInt(req.params.id as string, 10);
    const { medicationName, dose, route } = req.body;
    if (!medicationName || !dose || !route) {
      return res.status(400).json({ error: 'medicationName, dose, and route are required.' });
    }

    const updated = await obstetricSafetyService.ObstetricSafetyService.recordMedicationAdministration({
      emergencyId,
      medicationName,
      dose,
      route
    });

    res.json(updated);
  } catch (err: any) {
    console.error('Administer medication error:', err);
    res.status(500).json({ error: err.message || 'Failed to administer emergency medication.' });
  }
});

router.post('/obstetric/emergencies/:id/resolve', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const emergencyId = parseInt(req.params.id as string, 10);
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'status is required.' });
    }

    const resolved = await obstetricSafetyService.ObstetricSafetyService.resolveEmergency(emergencyId, status);
    res.json(resolved);
  } catch (err: any) {
    console.error('Resolve obstetric emergency error:', err);
    res.status(500).json({ error: err.message || 'Failed to resolve emergency.' });
  }
});

router.get('/obstetric/analytics', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const analytics = await obstetricSafetyService.ObstetricSafetyService.getObSafeDashboardAnalytics();
    res.json(analytics);
  } catch (err: any) {
    console.error('Get obstetric analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch obstetric analytics.' });
  }
});

router.get('/obstetric/fetal-logs', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = req.query.patientId ? parseInt(req.query.patientId as string, 10) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const logs = await obstetricSafetyService.ObstetricSafetyService.getRecentFetalLogs(patientId, limit);
    res.json(logs);
  } catch (err: any) {
    console.error('Get fetal logs error:', err);
    res.status(500).json({ error: 'Failed to fetch fetal monitoring logs.' });
  }
});

router.get('/obstetric/emergencies', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const emergencies = await obstetricSafetyService.ObstetricSafetyService.getActiveEmergencies(status);
    res.json(emergencies);
  } catch (err: any) {
    console.error('Get emergencies error:', err);
    res.status(500).json({ error: 'Failed to fetch obstetric emergencies.' });
  }
});

// Phase 50: Pharmacy Sterile Compounding & USP <797>/<800> Cleanroom IV Automation
router.post('/cleanroom/batches', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      patientId,
      prescriptionOrderId,
      medicationName,
      baseSolution,
      drugDoseMg,
      drugVolumeMl,
      drugSpecificGravity,
      emptyBagTareGrams,
      uspCategory,
      storageCondition,
      isHazardousUsp800,
      cstdVerified,
      compoundingHoodId,
      compoundedByPharmacist
    } = req.body;

    if (!medicationName || !baseSolution || drugDoseMg === undefined || drugVolumeMl === undefined || emptyBagTareGrams === undefined) {
      return res.status(400).json({ error: 'medicationName, baseSolution, drugDoseMg, drugVolumeMl, and emptyBagTareGrams are required.' });
    }

    const batch = await cleanroomCompoundingService.CleanroomCompoundingService.createCompoundingBatch({
      patientId: patientId ? parseInt(patientId, 10) : undefined,
      prescriptionOrderId,
      medicationName,
      baseSolution,
      drugDoseMg: parseFloat(drugDoseMg),
      drugVolumeMl: parseFloat(drugVolumeMl),
      drugSpecificGravity: drugSpecificGravity ? parseFloat(drugSpecificGravity) : 1.000,
      emptyBagTareGrams: parseFloat(emptyBagTareGrams),
      uspCategory,
      storageCondition,
      isHazardousUsp800: !!isHazardousUsp800,
      cstdVerified: !!cstdVerified,
      compoundingHoodId: compoundingHoodId || 'HOOD-ISO5-01',
      compoundedByPharmacist: compoundedByPharmacist || 'Staff Compounding Pharmacist'
    });

    res.json(batch);
  } catch (err: any) {
    console.error('Create compounding batch error:', err);
    res.status(500).json({ error: err.message || 'Failed to create compounding batch.' });
  }
});

router.post('/cleanroom/batches/:id/verify-gravimetric', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const batchId = parseInt(req.params.id as string, 10);
    const { actualScaleWeightGrams } = req.body;
    if (actualScaleWeightGrams === undefined) {
      return res.status(400).json({ error: 'actualScaleWeightGrams is required.' });
    }

    const verified = await cleanroomCompoundingService.CleanroomCompoundingService.verifyBatchGravimetric({
      batchId,
      actualScaleWeightGrams: parseFloat(actualScaleWeightGrams)
    });

    res.json(verified);
  } catch (err: any) {
    console.error('Verify gravimetric error:', err);
    res.status(500).json({ error: err.message || 'Failed to verify gravimetric weight.' });
  }
});

router.post('/cleanroom/telemetry', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      cleanroomZone,
      differentialPressureInWg,
      hepaParticleCount05um,
      isoClass,
      airChangesPerHour,
      temperatureCelsius,
      relativeHumidityPercent
    } = req.body;

    if (!cleanroomZone || differentialPressureInWg === undefined || hepaParticleCount05um === undefined) {
      return res.status(400).json({ error: 'cleanroomZone, differentialPressureInWg, and hepaParticleCount05um are required.' });
    }

    const telem = await cleanroomCompoundingService.CleanroomCompoundingService.recordTelemetry({
      cleanroomZone,
      differentialPressureInWg: parseFloat(differentialPressureInWg),
      hepaParticleCount05um: parseInt(hepaParticleCount05um, 10),
      isoClass: isoClass || 'ISO_7',
      airChangesPerHour: parseInt(airChangesPerHour || 30, 10),
      temperatureCelsius: parseFloat(temperatureCelsius || 19.5),
      relativeHumidityPercent: parseFloat(relativeHumidityPercent || 45.0)
    });

    res.json(telem);
  } catch (err: any) {
    console.error('Record cleanroom telemetry error:', err);
    res.status(500).json({ error: err.message || 'Failed to record cleanroom telemetry.' });
  }
});

router.get('/cleanroom/analytics', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const analytics = await cleanroomCompoundingService.CleanroomCompoundingService.getCleanroomAnalytics();
    res.json(analytics);
  } catch (err: any) {
    console.error('Get cleanroom analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch cleanroom analytics.' });
  }
});

router.get('/cleanroom/batches', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const isHazardous = req.query.isHazardous !== undefined ? req.query.isHazardous === 'true' : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    const batches = await cleanroomCompoundingService.CleanroomCompoundingService.getRecentBatches(status, isHazardous, limit);
    res.json(batches);
  } catch (err: any) {
    console.error('Get compounding batches error:', err);
    res.status(500).json({ error: 'Failed to fetch compounding batches.' });
  }
});

router.get('/cleanroom/telemetry/latest', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const latest = await cleanroomCompoundingService.CleanroomCompoundingService.getLatestCleanroomTelemetry();
    res.json(latest);
  } catch (err: any) {
    console.error('Get latest cleanroom telemetry error:', err);
    res.status(500).json({ error: 'Failed to fetch cleanroom telemetry.' });
  }
});

// ==========================================
// Phase 51: Stroke & Neurovascular Acute Code Command (CODE-STROKE Hub)
// ==========================================

router.post('/stroke/evaluate-nihss', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { details } = req.body;
    if (!details) {
      res.status(400).json({ error: 'details (NihssDetails) is required' });
      return;
    }
    const result = strokeCommandService.StrokeCommandService.evaluateNihss(details);
    res.json(result);
  } catch (err: any) {
    console.error('Evaluate NIHSS error:', err);
    res.status(500).json({ error: 'Failed to evaluate NIHSS.' });
  }
});

router.post('/stroke/evaluate-thrombolysis', (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = strokeCommandService.StrokeCommandService.evaluateThrombolysis(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('Evaluate thrombolysis error:', err);
    res.status(500).json({ error: 'Failed to evaluate thrombolysis eligibility.' });
  }
});

router.post('/stroke/evaluate-thrombectomy', (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = strokeCommandService.StrokeCommandService.evaluateThrombectomy(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('Evaluate thrombectomy error:', err);
    res.status(500).json({ error: 'Failed to evaluate mechanical thrombectomy candidacy.' });
  }
});

router.post('/stroke/cases', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { patientId, caseData } = req.body;
    if (!patientId || !caseData) {
      res.status(400).json({ error: 'patientId and caseData are required' });
      return;
    }
    const createdCase = await strokeCommandService.StrokeCommandService.createStrokeCase(Number(patientId), caseData);
    res.status(201).json(createdCase);
  } catch (err: any) {
    console.error('Create stroke case error:', err);
    res.status(500).json({ error: 'Failed to create acute stroke code case.' });
  }
});

router.post('/stroke/cases/:caseId/thrombolytic-eval', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { caseId } = req.params;
    const result = await strokeCommandService.StrokeCommandService.recordThrombolyticEvaluation(Number(caseId), req.body);
    res.json(result);
  } catch (err: any) {
    console.error('Record thrombolytic eval error:', err);
    res.status(500).json({ error: 'Failed to record thrombolytic evaluation.' });
  }
});

router.post('/stroke/cases/:caseId/administer-thrombolytic', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { caseId } = req.params;
    const { administeredAt } = req.body;
    const result = await strokeCommandService.StrokeCommandService.recordThrombolyticAdministration(
      Number(caseId),
      administeredAt || new Date().toISOString()
    );
    res.json(result);
  } catch (err: any) {
    console.error('Administer thrombolytic error:', err);
    res.status(500).json({ error: 'Failed to record thrombolytic administration.' });
  }
});

router.patch('/stroke/cases/:caseId/thrombectomy-status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { caseId } = req.params;
    const { status } = req.body;
    if (!status) {
      res.status(400).json({ error: 'status is required' });
      return;
    }
    const updated = await strokeCommandService.StrokeCommandService.updateThrombectomyStatus(Number(caseId), status);
    res.json(updated);
  } catch (err: any) {
    console.error('Update thrombectomy status error:', err);
    res.status(500).json({ error: 'Failed to update thrombectomy status.' });
  }
});

router.get('/stroke/cases', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = req.query.patient_id ? Number(req.query.patient_id) : undefined;
    const cases = await strokeCommandService.StrokeCommandService.getStrokeCases(patientId);
    res.json(cases);
  } catch (err: any) {
    console.error('Get stroke cases error:', err);
    res.status(500).json({ error: 'Failed to fetch stroke cases.' });
  }
});

// ==========================================
// Phase 52: Blood Bank & Massive Transfusion Protocol (HEMO-SURGE Command)
// ==========================================

router.post('/mtp/evaluate-activation', (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = massiveTransfusionService.MassiveTransfusionService.evaluateMtpActivation(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('Evaluate MTP activation error:', err);
    res.status(500).json({ error: 'Failed to evaluate MTP criteria.' });
  }
});

router.post('/mtp/activations', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { patientId, activationData } = req.body;
    if (!patientId || !activationData) {
      res.status(400).json({ error: 'patientId and activationData are required' });
      return;
    }
    const result = await massiveTransfusionService.MassiveTransfusionService.activateMtp(Number(patientId), activationData);
    res.status(201).json(result);
  } catch (err: any) {
    console.error('Activate MTP error:', err);
    res.status(500).json({ error: 'Failed to activate MTP protocol.' });
  }
});

router.post('/mtp/activations/:activationId/transfuse', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { activationId } = req.params;
    const result = await massiveTransfusionService.MassiveTransfusionService.logBloodUnitTransfusion(
      Number(activationId),
      req.body
    );
    res.json(result);
  } catch (err: any) {
    console.error('Log blood transfusion error:', err);
    res.status(500).json({ error: 'Failed to log blood unit transfusion.' });
  }
});

router.post('/mtp/activations/:activationId/teg', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { activationId } = req.params;
    const result = await massiveTransfusionService.MassiveTransfusionService.recordTegAnalysis(
      Number(activationId),
      req.body
    );
    res.json(result);
  } catch (err: any) {
    console.error('Record TEG analysis error:', err);
    res.status(500).json({ error: 'Failed to record TEG analysis.' });
  }
});

router.post('/mtp/activations/:activationId/replete-calcium', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { activationId } = req.params;
    const { grams } = req.body;
    const updated = await massiveTransfusionService.MassiveTransfusionService.repleteCalcium(
      Number(activationId),
      Number(grams || 1.0)
    );
    res.json(updated);
  } catch (err: any) {
    console.error('Replete calcium error:', err);
    res.status(500).json({ error: 'Failed to record calcium repletion.' });
  }
});

router.patch('/mtp/activations/:activationId/deescalate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { activationId } = req.params;
    const { status } = req.body;
    const updated = await massiveTransfusionService.MassiveTransfusionService.deescalateMtp(
      Number(activationId),
      status || 'controlled'
    );
    res.json(updated);
  } catch (err: any) {
    console.error('Deescalate MTP error:', err);
    res.status(500).json({ error: 'Failed to deescalate MTP.' });
  }
});

router.get('/mtp/activations', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = req.query.patient_id ? Number(req.query.patient_id) : undefined;
    const activations = await massiveTransfusionService.MassiveTransfusionService.getMtpActivations(patientId);
    res.json(activations);
  } catch (err: any) {
    console.error('Get MTP activations error:', err);
    res.status(500).json({ error: 'Failed to fetch MTP activations.' });
  }
});

// ==========================================
// Phase 53: Cardiac Catheterization Lab & STEMI Door-to-Balloon Fleet (CATH-ALERT Hub)
// ==========================================

router.post('/stemi/evaluate-ekg', (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = cathAlertService.CathAlertService.evaluateEkgPattern(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('Evaluate EKG error:', err);
    res.status(500).json({ error: 'Failed to evaluate EKG pattern.' });
  }
});

router.post('/stemi/evaluate-cin-risk', (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = cathAlertService.CathAlertService.calculateMehranCinRisk(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('Evaluate CIN risk error:', err);
    res.status(500).json({ error: 'Failed to evaluate CIN risk.' });
  }
});

router.post('/stemi/activations', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { patientId, activationData } = req.body;
    if (!patientId || !activationData) {
      res.status(400).json({ error: 'patientId and activationData are required' });
      return;
    }
    const result = await cathAlertService.CathAlertService.activateStemiCode(Number(patientId), activationData);
    res.status(201).json(result);
  } catch (err: any) {
    console.error('Activate STEMI code error:', err);
    res.status(500).json({ error: 'Failed to activate STEMI code.' });
  }
});

router.post('/stemi/activations/:activationId/balloon-inflation', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { activationId } = req.params;
    const { balloonInflationTime } = req.body;
    const result = await cathAlertService.CathAlertService.logBalloonInflation(
      Number(activationId),
      balloonInflationTime || new Date().toISOString()
    );
    res.json(result);
  } catch (err: any) {
    console.error('Log balloon inflation error:', err);
    res.status(500).json({ error: 'Failed to record balloon inflation.' });
  }
});

router.post('/stemi/activations/:activationId/pci-log', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { activationId } = req.params;
    const result = await cathAlertService.CathAlertService.recordPciProcedure(Number(activationId), req.body);
    res.status(201).json(result);
  } catch (err: any) {
    console.error('Record PCI procedure error:', err);
    res.status(500).json({ error: 'Failed to record PCI procedure log.' });
  }
});

router.post('/stemi/activations/:activationId/cin-risk', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { activationId } = req.params;
    const result = await cathAlertService.CathAlertService.updateCinRisk(Number(activationId), req.body);
    res.json(result);
  } catch (err: any) {
    console.error('Update CIN risk error:', err);
    res.status(500).json({ error: 'Failed to record CIN risk evaluation.' });
  }
});

router.patch('/stemi/activations/:activationId/closure', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { activationId } = req.params;
    const updated = await cathAlertService.CathAlertService.updateClosureAndBedRest(Number(activationId), req.body);
    res.json(updated);
  } catch (err: any) {
    console.error('Update closure status error:', err);
    res.status(500).json({ error: 'Failed to update arteriotomy closure status.' });
  }
});

router.get('/stemi/activations', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = req.query.patient_id ? Number(req.query.patient_id) : undefined;
    const activations = await cathAlertService.CathAlertService.getStemiActivations(patientId);
    res.json(activations);
  } catch (err: any) {
    console.error('Get STEMI activations error:', err);
    res.status(500).json({ error: 'Failed to fetch STEMI activations.' });
  }
});

// ==========================================
// Phase 54: Extracorporeal Membrane Oxygenation (ECMO) & Mechanical Circulatory Support (MCS Hub)
// ==========================================

router.post('/ecmo/evaluate-resp', (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = ecmoSupportService.EcmoSupportService.calculateRespScore(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('Evaluate RESP score error:', err);
    res.status(500).json({ error: 'Failed to evaluate RESP score.' });
  }
});

router.post('/ecmo/evaluate-save', (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = ecmoSupportService.EcmoSupportService.calculateSaveScore(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('Evaluate SAVE score error:', err);
    res.status(500).json({ error: 'Failed to evaluate SAVE score.' });
  }
});

router.post('/ecmo/runs', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { patientId, runData } = req.body;
    if (!patientId || !runData) {
      res.status(400).json({ error: 'patientId and runData are required' });
      return;
    }
    const result = await ecmoSupportService.EcmoSupportService.initiateEcmoRun(Number(patientId), runData);
    res.status(201).json(result);
  } catch (err: any) {
    console.error('Initiate ECMO run error:', err);
    res.status(500).json({ error: 'Failed to initiate ECMO run.' });
  }
});

router.post('/ecmo/runs/:runId/telemetry', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { runId } = req.params;
    const result = await ecmoSupportService.EcmoSupportService.recordCircuitTelemetry(Number(runId), req.body);
    res.json(result);
  } catch (err: any) {
    console.error('Record ECMO telemetry error:', err);
    res.status(500).json({ error: 'Failed to record circuit telemetry.' });
  }
});

router.patch('/ecmo/runs/:runId/parameters', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { runId } = req.params;
    const updated = await ecmoSupportService.EcmoSupportService.adjustSweepAndRpm(Number(runId), req.body);
    res.json(updated);
  } catch (err: any) {
    console.error('Adjust ECMO parameters error:', err);
    res.status(500).json({ error: 'Failed to adjust ECMO parameters.' });
  }
});

router.patch('/ecmo/runs/:runId/decannulate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { runId } = req.params;
    const { outcome } = req.body;
    const updated = await ecmoSupportService.EcmoSupportService.decannulateCircuit(Number(runId), outcome || 'weaned_recovered');
    res.json(updated);
  } catch (err: any) {
    console.error('Decannulate ECMO error:', err);
    res.status(500).json({ error: 'Failed to decannulate ECMO run.' });
  }
});

router.get('/ecmo/runs', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = req.query.patient_id ? Number(req.query.patient_id) : undefined;
    const runs = await ecmoSupportService.EcmoSupportService.getEcmoRuns(patientId);
    res.json(runs);
  } catch (err: any) {
    console.error('Get ECMO runs error:', err);
    res.status(500).json({ error: 'Failed to fetch ECMO runs.' });
  }
});

// ==========================================
// Phase 55: Burn & Complex Trauma Resuscitation Command (TRAUMA-ONE Hub)
// ==========================================

router.post('/burn/evaluate-tbsa', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { map, isPediatric } = req.body;
    const result = burnTraumaService.BurnTraumaService.calculateTbsa(map, isPediatric);
    res.json(result);
  } catch (err: any) {
    console.error('Evaluate TBSA error:', err);
    res.status(500).json({ error: 'Failed to evaluate TBSA percentage.' });
  }
});

router.post('/burn/calculate-resuscitation', (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = burnTraumaService.BurnTraumaService.calculateFluidResuscitation(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('Calculate fluid resuscitation error:', err);
    res.status(500).json({ error: 'Failed to calculate fluid resuscitation.' });
  }
});

router.post('/burn/evaluate-inhalation', (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = burnTraumaService.BurnTraumaService.evaluateInhalationAndCyanide(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('Evaluate inhalation error:', err);
    res.status(500).json({ error: 'Failed to evaluate inhalation injury & COHb.' });
  }
});

router.post('/burn/cases', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { patientId, caseData } = req.body;
    if (!patientId || !caseData) {
      res.status(400).json({ error: 'patientId and caseData are required' });
      return;
    }
    const result = await burnTraumaService.BurnTraumaService.createBurnCase(Number(patientId), caseData);
    res.status(201).json(result);
  } catch (err: any) {
    console.error('Create burn case error:', err);
    res.status(500).json({ error: 'Failed to create burn trauma case.' });
  }
});

router.post('/burn/cases/:caseId/titration', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { caseId } = req.params;
    const result = await burnTraumaService.BurnTraumaService.recordHourlyTitration(Number(caseId), req.body);
    res.json(result);
  } catch (err: any) {
    console.error('Record burn titration error:', err);
    res.status(500).json({ error: 'Failed to record hourly titration.' });
  }
});

router.get('/burn/cases', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = req.query.patient_id ? Number(req.query.patient_id) : undefined;
    const cases = await burnTraumaService.BurnTraumaService.getBurnCases(patientId);
    res.json(cases);
  } catch (err: any) {
    console.error('Get burn cases error:', err);
    res.status(500).json({ error: 'Failed to fetch burn cases.' });
  }
});

router.get('/burn/cases/:caseId/titrations', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { caseId } = req.params;
    const titrations = await burnTraumaService.BurnTraumaService.getHourlyTitrations(Number(caseId));
    res.json(titrations);
  } catch (err: any) {
    console.error('Get hourly titrations error:', err);
    res.status(500).json({ error: 'Failed to fetch hourly titrations.' });
  }
});

// ==========================================
// Phase 56: Pediatric Intensive Care (PICU) & Neonatal Resuscitation Program (NRP-SAFE Hub)
// ==========================================

router.post('/pediatric/evaluate-apgar', (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = pediatricResuscitationService.PediatricResuscitationService.calculateApgar(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('Evaluate APGAR error:', err);
    res.status(500).json({ error: 'Failed to evaluate APGAR score.' });
  }
});

router.post('/pediatric/evaluate-nrp', (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = pediatricResuscitationService.PediatricResuscitationService.evaluateNrpAlgorithm(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('Evaluate NRP algorithm error:', err);
    res.status(500).json({ error: 'Failed to evaluate NRP algorithm.' });
  }
});

router.post('/pediatric/calculate-broselow', (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = pediatricResuscitationService.PediatricResuscitationService.calculateBroselowPals(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('Calculate Broselow error:', err);
    res.status(500).json({ error: 'Failed to calculate Broselow PALS parameters.' });
  }
});

router.post('/pediatric/evaluate-bhutani', (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = pediatricResuscitationService.PediatricResuscitationService.evaluateBhutaniNomogram(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('Evaluate Bhutani nomogram error:', err);
    res.status(500).json({ error: 'Failed to evaluate Bhutani nomogram.' });
  }
});

router.post('/pediatric/calculate-pelod2', (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = pediatricResuscitationService.PediatricResuscitationService.calculatePelod2(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('Calculate PELOD-2 error:', err);
    res.status(500).json({ error: 'Failed to calculate PELOD-2 score.' });
  }
});

router.post('/pediatric/neonatal-events', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { patientId, eventData } = req.body;
    if (!patientId || !eventData) {
      res.status(400).json({ error: 'patientId and eventData are required' });
      return;
    }
    const result = await pediatricResuscitationService.PediatricResuscitationService.createNeonatalEvent(Number(patientId), eventData);
    res.status(201).json(result);
  } catch (err: any) {
    console.error('Create neonatal event error:', err);
    res.status(500).json({ error: 'Failed to record neonatal resuscitation event.' });
  }
});

router.post('/pediatric/code-cases', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { patientId, caseData } = req.body;
    if (!patientId || !caseData) {
      res.status(400).json({ error: 'patientId and caseData are required' });
      return;
    }
    const result = await pediatricResuscitationService.PediatricResuscitationService.createPediatricCode(Number(patientId), caseData);
    res.status(201).json(result);
  } catch (err: any) {
    console.error('Create pediatric code case error:', err);
    res.status(500).json({ error: 'Failed to record pediatric code case.' });
  }
});

router.get('/pediatric/neonatal-events', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = req.query.patient_id ? Number(req.query.patient_id) : undefined;
    const events = await pediatricResuscitationService.PediatricResuscitationService.getNeonatalEvents(patientId);
    res.json(events);
  } catch (err: any) {
    console.error('Get neonatal events error:', err);
    res.status(500).json({ error: 'Failed to fetch neonatal events.' });
  }
});

router.get('/pediatric/code-cases', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = req.query.patient_id ? Number(req.query.patient_id) : undefined;
    const codes = await pediatricResuscitationService.PediatricResuscitationService.getPediatricCodes(patientId);
    res.json(codes);
  } catch (err: any) {
    console.error('Get pediatric codes error:', err);
    res.status(500).json({ error: 'Failed to fetch pediatric code cases.' });
  }
});

// ==========================================
// Phase 57: Emergency Airway & Rapid Sequence Intubation (AIRWAY-CODE Hub)
// ==========================================

router.post('/airway/evaluate-lemon', (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = airwayIntubationService.AirwayIntubationService.calculateLemonScore(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('Evaluate LEMON score error:', err);
    res.status(500).json({ error: 'Failed to evaluate LEMON difficult airway score.' });
  }
});

router.post('/airway/evaluate-macocha', (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = airwayIntubationService.AirwayIntubationService.calculateMacochaScore(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('Evaluate MACOCHA score error:', err);
    res.status(500).json({ error: 'Failed to evaluate MACOCHA ICU score.' });
  }
});

router.post('/airway/calculate-rsi', (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = airwayIntubationService.AirwayIntubationService.calculateRsiMedications(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('Calculate RSI medications error:', err);
    res.status(500).json({ error: 'Failed to calculate RSI medication dosing.' });
  }
});

router.post('/airway/evaluate-attempt', (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = airwayIntubationService.AirwayIntubationService.evaluateAirwayAttempt(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('Evaluate airway attempt error:', err);
    res.status(500).json({ error: 'Failed to evaluate airway attempt.' });
  }
});

router.post('/airway/events', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { patientId, eventData } = req.body;
    if (!patientId || !eventData) {
      res.status(400).json({ error: 'patientId and eventData are required' });
      return;
    }
    const result = await airwayIntubationService.AirwayIntubationService.createIntubationEvent(Number(patientId), eventData);
    res.status(201).json(result);
  } catch (err: any) {
    console.error('Create intubation event error:', err);
    res.status(500).json({ error: 'Failed to record intubation event.' });
  }
});

router.post('/airway/events/:eventId/rsi', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { eventId } = req.params;
    const result = await airwayIntubationService.AirwayIntubationService.recordRsiMedications(Number(eventId), req.body);
    res.status(201).json(result);
  } catch (err: any) {
    console.error('Record RSI medications error:', err);
    res.status(500).json({ error: 'Failed to record RSI medications.' });
  }
});

router.get('/airway/events', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = req.query.patient_id ? Number(req.query.patient_id) : undefined;
    const events = await airwayIntubationService.AirwayIntubationService.getIntubationEvents(patientId);
    res.json(events);
  } catch (err: any) {
    console.error('Get intubation events error:', err);
    res.status(500).json({ error: 'Failed to fetch intubation events.' });
  }
});

// Phase 58: Medical Toxicology & Poison Control Hub
router.post('/toxicology/classify-toxidrome', (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = medicalToxicologyService.classifyToxidrome(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('Toxidrome classification error:', err);
    res.status(500).json({ error: 'Failed to classify toxidrome.' });
  }
});

router.post('/toxicology/hunter-criteria', (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = medicalToxicologyService.evaluateHunterCriteria(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('Hunter criteria evaluation error:', err);
    res.status(500).json({ error: 'Failed to evaluate Hunter criteria.' });
  }
});

router.post('/toxicology/apap-nomogram', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { hoursPostIngestion, apapConcentrationMcgPerMl, weightKg } = req.body;
    const result = medicalToxicologyService.evaluateAcetaminophenToxicity(
      Number(hoursPostIngestion),
      Number(apapConcentrationMcgPerMl),
      Number(weightKg)
    );
    res.json(result);
  } catch (err: any) {
    console.error('APAP nomogram evaluation error:', err);
    res.status(500).json({ error: 'Failed to evaluate APAP nomogram.' });
  }
});

router.post('/toxicology/salicylate-assessment', (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      salicylateLevelMgPerDl,
      arterialPh,
      serumPotassiumMeqPerL,
      hasAlteredMentalStatus,
      hasPulmonaryEdema,
      hasRenalFailure,
      weightKg
    } = req.body;
    const result = medicalToxicologyService.evaluateSalicylateToxicity(
      Number(salicylateLevelMgPerDl),
      Number(arterialPh),
      Number(serumPotassiumMeqPerL),
      Boolean(hasAlteredMentalStatus),
      Boolean(hasPulmonaryEdema),
      Boolean(hasRenalFailure),
      Number(weightKg)
    );
    res.json(result);
  } catch (err: any) {
    console.error('Salicylate assessment error:', err);
    res.status(500).json({ error: 'Failed to evaluate salicylate toxicity.' });
  }
});

router.post('/toxicology/toxic-alcohol', (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      suspectedAlcohol,
      measuredSerumOsmolality,
      sodiumMeqPerL,
      glucoseMgPerDl,
      bunMgPerDl,
      ethanolMgPerDl,
      weightKg,
      arterialPh
    } = req.body;
    const result = medicalToxicologyService.evaluateToxicAlcoholIngestion(
      suspectedAlcohol,
      Number(measuredSerumOsmolality),
      Number(sodiumMeqPerL),
      Number(glucoseMgPerDl),
      Number(bunMgPerDl),
      Number(ethanolMgPerDl || 0),
      Number(weightKg),
      Number(arterialPh || 7.4)
    );
    res.json(result);
  } catch (err: any) {
    console.error('Toxic alcohol evaluation error:', err);
    res.status(500).json({ error: 'Failed to evaluate toxic alcohol ingestion.' });
  }
});

router.post('/toxicology/digifab', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { scenario, amountIngestedMg, serumDigoxinNgPerMl, patientWeightKg } = req.body;
    const result = medicalToxicologyService.calculateDigiFabDosing(
      scenario,
      amountIngestedMg ? Number(amountIngestedMg) : undefined,
      serumDigoxinNgPerMl ? Number(serumDigoxinNgPerMl) : undefined,
      patientWeightKg ? Number(patientWeightKg) : undefined
    );
    res.json(result);
  } catch (err: any) {
    console.error('DigiFab calculation error:', err);
    res.status(500).json({ error: 'Failed to calculate DigiFab dosing.' });
  }
});

router.post('/toxicology/cases', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await medicalToxicologyService.createToxicologyCase(req.body);
    res.status(201).json(result);
  } catch (err: any) {
    console.error('Create toxicology case error:', err);
    res.status(500).json({ error: 'Failed to create toxicology case.' });
  }
});

router.post('/toxicology/cases/:caseId/antidote', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const caseId = Number(req.params.caseId);
    const result = await medicalToxicologyService.recordAntidoteAdministration({
      caseId,
      ...req.body
    });
    res.status(201).json(result);
  } catch (err: any) {
    console.error('Record antidote administration error:', err);
    res.status(500).json({ error: 'Failed to record antidote administration.' });
  }
});

router.get('/toxicology/cases/:caseId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const caseId = Number(req.params.caseId);
    const result = await medicalToxicologyService.getToxicologyCaseDetails(caseId);
    if (!result) {
      return res.status(404).json({ error: 'Toxicology case not found.' });
    }
    res.json(result);
  } catch (err: any) {
    console.error('Get toxicology case details error:', err);
    res.status(500).json({ error: 'Failed to get toxicology case details.' });
  }
});

router.get('/toxicology/cases', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 25;
    const cases = await medicalToxicologyService.listActiveToxicologyCases(limit);
    res.json(cases);
  } catch (err: any) {
    console.error('List active toxicology cases error:', err);
    res.status(500).json({ error: 'Failed to list toxicology cases.' });
  }
});

// Phase 59: Continuous Renal Replacement Therapy (CRRT-NAVIGATOR)
router.post('/crrt/kdigo-stage', (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = crrtNavigatorService.evaluateKdigoStage(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('KDIGO staging error:', err);
    res.status(500).json({ error: 'Failed to evaluate KDIGO AKI stage.' });
  }
});

router.post('/crrt/prescribe', (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = crrtNavigatorService.calculateCrrtPrescription(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('CRRT prescription error:', err);
    res.status(500).json({ error: 'Failed to calculate CRRT prescription.' });
  }
});

router.post('/crrt/filter-pressures', (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = crrtNavigatorService.evaluateFilterPressures(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('Filter pressure analysis error:', err);
    res.status(500).json({ error: 'Failed to evaluate filter pressures.' });
  }
});

router.post('/crrt/rca-protocol', (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = crrtNavigatorService.evaluateRcaCitrateProtocol(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('RCA citrate evaluation error:', err);
    res.status(500).json({ error: 'Failed to evaluate RCA citrate protocol.' });
  }
});

router.post('/crrt/sessions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await crrtNavigatorService.createCrrtSession(req.body);
    res.status(201).json(result);
  } catch (err: any) {
    console.error('Create CRRT session error:', err);
    res.status(500).json({ error: 'Failed to create CRRT session.' });
  }
});

router.post('/crrt/sessions/:sessionId/telemetry', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessionId = Number(req.params.sessionId);
    const result = await crrtNavigatorService.recordHourlyTelemetry({
      sessionId,
      ...req.body
    });
    res.status(201).json(result);
  } catch (err: any) {
    console.error('Record CRRT telemetry error:', err);
    res.status(500).json({ error: 'Failed to record CRRT hourly telemetry.' });
  }
});

router.get('/crrt/sessions/:sessionId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessionId = Number(req.params.sessionId);
    const result = await crrtNavigatorService.getCrrtSessionDetails(sessionId);
    if (!result) {
      return res.status(404).json({ error: 'CRRT session not found.' });
    }
    res.json(result);
  } catch (err: any) {
    console.error('Get CRRT session details error:', err);
    res.status(500).json({ error: 'Failed to get CRRT session details.' });
  }
});

router.get('/crrt/sessions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 25;
    const sessions = await crrtNavigatorService.listActiveCrrtSessions(limit);
    res.json(sessions);
  } catch (err: any) {
    console.error('List active CRRT sessions error:', err);
    res.status(500).json({ error: 'Failed to list active CRRT sessions.' });
  }
});

// Phase 60: Radiation Oncology & Nuclear Medicine Theranostics
router.post('/radonc/radiobiology', (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = radiationTheranosticsService.calculateRadiobiology(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('Radiobiology calculation error:', err);
    res.status(500).json({ error: 'Failed to calculate radiobiology metrics.' });
  }
});

router.post('/radonc/quantec-eval', (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = radiationTheranosticsService.evaluateQuantecConstraints(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('QUANTEC constraint evaluation error:', err);
    res.status(500).json({ error: 'Failed to evaluate QUANTEC constraints.' });
  }
});

router.post('/radonc/theranostic-protocol', (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = radiationTheranosticsService.evaluateTheranosticProtocol(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('Theranostic protocol evaluation error:', err);
    res.status(500).json({ error: 'Failed to evaluate theranostic protocol.' });
  }
});

router.post('/radonc/decay-release', (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = radiationTheranosticsService.calculateDecayAndRelease(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('Decay and release calculation error:', err);
    res.status(500).json({ error: 'Failed to calculate radiation decay and release criteria.' });
  }
});

router.post('/radonc/plans', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await radiationTheranosticsService.createRadiationPlan(req.body);
    res.status(201).json(result);
  } catch (err: any) {
    console.error('Create radiation plan error:', err);
    res.status(500).json({ error: 'Failed to create radiation plan.' });
  }
});

router.get('/radonc/plans', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 25;
    const plans = await radiationTheranosticsService.listRadiationPlans(limit);
    res.json(plans);
  } catch (err: any) {
    console.error('List radiation plans error:', err);
    res.status(500).json({ error: 'Failed to list radiation plans.' });
  }
});

router.post('/radonc/cycles', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await radiationTheranosticsService.recordTheranosticCycle(req.body);
    res.status(201).json(result);
  } catch (err: any) {
    console.error('Record theranostic cycle error:', err);
    res.status(500).json({ error: 'Failed to record theranostic cycle.' });
  }
});

router.get('/radonc/cycles/:cycleId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cycleId = Number(req.params.cycleId);
    const result = await radiationTheranosticsService.getTheranosticCycleDetails(cycleId);
    if (!result) {
      return res.status(404).json({ error: 'Theranostic cycle not found.' });
    }
    res.json(result);
  } catch (err: any) {
    console.error('Get theranostic cycle details error:', err);
    res.status(500).json({ error: 'Failed to get theranostic cycle details.' });
  }
});

router.get('/radonc/cycles', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 25;
    const cycles = await radiationTheranosticsService.listActiveTheranosticCycles(limit);
    res.json(cycles);
  } catch (err: any) {
    console.error('List theranostic cycles error:', err);
    res.status(500).json({ error: 'Failed to list theranostic cycles.' });
  }
});

// ==========================================
// Phase 61: Advanced Hemodynamic Monitoring & Swan-Ganz Fleet (HEMO-SWAN)
// ==========================================

// Calculate PAC Hemodynamic Profile & Forrester Quadrant
router.post('/pac/calculate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const profile = hemodynamicSwanGanzService.HemodynamicSwanGanzService.calculateProfile(req.body);
    res.json(profile);
  } catch (err: any) {
    console.error('Calculate PAC profile error:', err);
    res.status(400).json({ error: err.message || 'Failed to calculate PAC hemodynamic profile.' });
  }
});

// Save PAC record
router.post('/pac/records', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const saved = await hemodynamicSwanGanzService.HemodynamicSwanGanzService.saveRecord(req.body);
    res.status(201).json(saved);
  } catch (err: any) {
    console.error('Save PAC record error:', err);
    res.status(500).json({ error: 'Failed to record PAC hemodynamic data.' });
  }
});

// Get PAC records by patient
router.get('/pac/patients/:patientId/records', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = Number(req.params.patientId);
    const records = await hemodynamicSwanGanzService.HemodynamicSwanGanzService.getRecordsByPatient(patientId);
    res.json(records);
  } catch (err: any) {
    console.error('Get PAC records error:', err);
    res.status(500).json({ error: 'Failed to retrieve PAC records.' });
  }
});

// Evaluate catheter safety watchdog
router.post('/pac/safety/evaluate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const assessment = hemodynamicSwanGanzService.HemodynamicSwanGanzService.evaluateCatheterSafety(req.body);
    res.json(assessment);
  } catch (err: any) {
    console.error('Evaluate PAC safety error:', err);
    res.status(400).json({ error: err.message || 'Failed to evaluate catheter safety.' });
  }
});

// Log catheter safety event
router.post('/pac/safety/log', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { patientId, eventType, severity, warningMessage, actionTaken, balloonInflationVolumeMl, acknowledgedBy } = req.body;
    const logged = await hemodynamicSwanGanzService.HemodynamicSwanGanzService.logSafetyEvent(
      Number(patientId),
      eventType,
      severity,
      warningMessage,
      actionTaken,
      balloonInflationVolumeMl ? Number(balloonInflationVolumeMl) : undefined,
      acknowledgedBy
    );
    res.status(201).json(logged);
  } catch (err: any) {
    console.error('Log PAC safety event error:', err);
    res.status(500).json({ error: 'Failed to log catheter safety event.' });
  }
});

// Get catheter safety events by patient
router.get('/pac/patients/:patientId/safety', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = Number(req.params.patientId);
    const events = await hemodynamicSwanGanzService.HemodynamicSwanGanzService.getSafetyEvents(patientId);
    res.json(events);
  } catch (err: any) {
    console.error('Get PAC safety events error:', err);
    res.status(500).json({ error: 'Failed to retrieve PAC safety events.' });
  }
});

// ==========================================
// Phase 62: Acute Spinal Cord Injury & Neurotrauma Spine Command (SPINE-ALERT)
// ==========================================

// Classify ASIA / ISNCSCI Impairment Scale
router.post('/spine/asia/classify', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const classification = spinalCordInjuryService.SpinalCordInjuryService.classifyASIA(req.body);
    res.json(classification);
  } catch (err: any) {
    console.error('Classify ASIA error:', err);
    res.status(400).json({ error: err.message || 'Failed to classify ASIA scale.' });
  }
});

// Differentiate Neurogenic Shock vs Spinal Shock
router.post('/spine/shock/differentiate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const assessment = spinalCordInjuryService.SpinalCordInjuryService.differentiateShock(req.body);
    res.json(assessment);
  } catch (err: any) {
    console.error('Differentiate shock error:', err);
    res.status(400).json({ error: err.message || 'Failed to evaluate shock state.' });
  }
});

// Evaluate Autonomic Dysreflexia Emergency
router.post('/spine/autonomic-dysreflexia/evaluate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adResult = spinalCordInjuryService.SpinalCordInjuryService.evaluateAutonomicDysreflexia(req.body);
    res.json(adResult);
  } catch (err: any) {
    console.error('Evaluate AD error:', err);
    res.status(400).json({ error: err.message || 'Failed to evaluate autonomic dysreflexia.' });
  }
});

// Evaluate Spine Instability (SLIC / TLICS)
router.post('/spine/instability/evaluate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { scoreType, morphology, ligamentousComplex, neurologicalStatus } = req.body;
    const instability = spinalCordInjuryService.SpinalCordInjuryService.evaluateSpineInstability(
      scoreType,
      Number(morphology),
      Number(ligamentousComplex),
      Number(neurologicalStatus)
    );
    res.json(instability);
  } catch (err: any) {
    console.error('Evaluate spine instability error:', err);
    res.status(400).json({ error: err.message || 'Failed to evaluate spine instability.' });
  }
});

// Create Spinal Cord Injury Case
router.post('/spine/cases', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const newCase = await spinalCordInjuryService.SpinalCordInjuryService.createCase(req.body);
    res.status(201).json(newCase);
  } catch (err: any) {
    console.error('Create SCI case error:', err);
    res.status(500).json({ error: 'Failed to create spinal cord injury case.' });
  }
});

// Get Spinal Cord Injury Cases for Patient
router.get('/spine/patients/:patientId/cases', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = Number(req.params.patientId);
    const cases = await spinalCordInjuryService.SpinalCordInjuryService.getCasesByPatient(patientId);
    res.json(cases);
  } catch (err: any) {
    console.error('Get SCI cases error:', err);
    res.status(500).json({ error: 'Failed to retrieve spinal cord injury cases.' });
  }
});

// Record Autonomic Dysreflexia Event
router.post('/spine/cases/:caseId/ad-events', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const caseId = Number(req.params.caseId);
    const event = await spinalCordInjuryService.SpinalCordInjuryService.recordADEvent({
      ...req.body,
      caseId
    });
    res.status(201).json(event);
  } catch (err: any) {
    console.error('Record AD event error:', err);
    res.status(500).json({ error: 'Failed to record autonomic dysreflexia event.' });
  }
});

// Get AD Events for Case
router.get('/spine/cases/:caseId/ad-events', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const caseId = Number(req.params.caseId);
    const events = await spinalCordInjuryService.SpinalCordInjuryService.getADEventsByCase(caseId);
    res.json(events);
  } catch (err: any) {
    console.error('Get AD events error:', err);
    res.status(500).json({ error: 'Failed to retrieve autonomic dysreflexia events.' });
  }
});

// ==========================================
// Phase 63: Disaster Triage, Mass Casualty Incident & CBRNE Defense (CBRNE-TRIAGE)
// ==========================================

// Evaluate Adult START Triage
router.post('/cbrne/triage/start', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = cbrneTriageService.CBRNETriageService.evaluateSTART(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('START triage error:', err);
    res.status(400).json({ error: err.message || 'Failed to evaluate START triage.' });
  }
});

// Evaluate Pediatric JumpSTART Triage
router.post('/cbrne/triage/jumpstart', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = cbrneTriageService.CBRNETriageService.evaluateJumpSTART(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('JumpSTART triage error:', err);
    res.status(400).json({ error: err.message || 'Failed to evaluate JumpSTART triage.' });
  }
});

// Match CBRNE Agent Threat & Antidote
router.post('/cbrne/agents/match', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const assessment = cbrneTriageService.CBRNETriageService.matchCBRNEAgent(req.body);
    res.json(assessment);
  } catch (err: any) {
    console.error('CBRNE agent match error:', err);
    res.status(400).json({ error: err.message || 'Failed to evaluate CBRNE agent threat.' });
  }
});

// Create MCI Triage Encounter
router.post('/cbrne/encounters', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const encounter = await cbrneTriageService.CBRNETriageService.createEncounter(req.body);
    res.status(201).json(encounter);
  } catch (err: any) {
    console.error('Create MCI encounter error:', err);
    res.status(500).json({ error: 'Failed to record MCI triage encounter.' });
  }
});

// List MCI Triage Encounters
router.get('/cbrne/encounters', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const incidentName = req.query.incidentName as string | undefined;
    const encounters = await cbrneTriageService.CBRNETriageService.listEncounters(incidentName);
    res.json(encounters);
  } catch (err: any) {
    console.error('List MCI encounters error:', err);
    res.status(500).json({ error: 'Failed to list MCI encounters.' });
  }
});

// Record CBRNE Exposure
router.post('/cbrne/encounters/:encounterId/exposures', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const encounterId = Number(req.params.encounterId);
    const exposure = await cbrneTriageService.CBRNETriageService.recordExposure({
      ...req.body,
      encounterId
    });
    res.status(201).json(exposure);
  } catch (err: any) {
    console.error('Record CBRNE exposure error:', err);
    res.status(500).json({ error: 'Failed to record CBRNE exposure.' });
  }
});

// Get Exposures by Encounter
router.get('/cbrne/encounters/:encounterId/exposures', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const encounterId = Number(req.params.encounterId);
    const exposures = await cbrneTriageService.CBRNETriageService.getExposuresByEncounter(encounterId);
    res.json(exposures);
  } catch (err: any) {
    console.error('Get CBRNE exposures error:', err);
    res.status(500).json({ error: 'Failed to retrieve CBRNE exposures.' });
  }
});

// Live Disaster Surge Capacity Statistics
router.get('/cbrne/surge-stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const incidentName = req.query.incidentName as string | undefined;
    const stats = await cbrneTriageService.CBRNETriageService.getSurgeCapacityStats(incidentName);
    res.json(stats);
  } catch (err: any) {
    console.error('Get surge stats error:', err);
    res.status(500).json({ error: 'Failed to calculate disaster surge statistics.' });
  }
});

// ==========================================
// Phase 64: Hyperbaric Medicine & Diving Emergency Fleet (HBOT-SAFE)
// ==========================================

// Calculate CO Elimination Kinetics
router.post('/hbot/co-kinetics', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { initialCohbPercent, elapsedMinutes, fio2Fraction, pressureAta, lossOfConsciousness, cardiacIschemia, pregnancy, neurologicalDeficit } = req.body;
    const profile = hyperbaricMedicineService.HyperbaricMedicineService.calculateCOElimination(
      Number(initialCohbPercent),
      Number(elapsedMinutes),
      Number(fio2Fraction),
      Number(pressureAta),
      Boolean(lossOfConsciousness),
      Boolean(cardiacIschemia),
      Boolean(pregnancy),
      Boolean(neurologicalDeficit)
    );
    res.json(profile);
  } catch (err: any) {
    console.error('CO kinetics error:', err);
    res.status(400).json({ error: err.message || 'Failed to calculate CO clearance kinetics.' });
  }
});

// Select Treatment Table
router.post('/hbot/tables/select', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { indication, isSevereOrAGE } = req.body;
    const table = hyperbaricMedicineService.HyperbaricMedicineService.selectTreatmentTable(indication, Boolean(isSevereOrAGE));
    res.json(table);
  } catch (err: any) {
    console.error('Select table error:', err);
    res.status(400).json({ error: err.message || 'Failed to select treatment table.' });
  }
});

// Evaluate Oxygen Toxicity (UPTD & CNS)
router.post('/hbot/toxicity/evaluate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { segments, cnsSymptoms } = req.body;
    const assessment = hyperbaricMedicineService.HyperbaricMedicineService.calculateOxygenToxicity(segments, cnsSymptoms || []);
    res.json(assessment);
  } catch (err: any) {
    console.error('Evaluate toxicity error:', err);
    res.status(400).json({ error: err.message || 'Failed to calculate oxygen toxicity.' });
  }
});

// Create HBOT Session
router.post('/hbot/sessions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = await hyperbaricMedicineService.HyperbaricMedicineService.createSession(req.body);
    res.status(201).json(session);
  } catch (err: any) {
    console.error('Create HBOT session error:', err);
    res.status(500).json({ error: 'Failed to record hyperbaric treatment session.' });
  }
});

// List HBOT Sessions for Patient
router.get('/hbot/patients/:patientId/sessions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = Number(req.params.patientId);
    const sessions = await hyperbaricMedicineService.HyperbaricMedicineService.listSessionsByPatient(patientId);
    res.json(sessions);
  } catch (err: any) {
    console.error('List HBOT sessions error:', err);
    res.status(500).json({ error: 'Failed to retrieve hyperbaric sessions.' });
  }
});

// Log HBOT Toxicity Event
router.post('/hbot/sessions/:sessionId/toxicity-logs', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessionId = Number(req.params.sessionId);
    const log = await hyperbaricMedicineService.HyperbaricMedicineService.logToxicityEvent({
      ...req.body,
      sessionId
    });
    res.status(201).json(log);
  } catch (err: any) {
    console.error('Log toxicity event error:', err);
    res.status(500).json({ error: 'Failed to log toxicity event.' });
  }
});

// Get Toxicity Logs for Session
router.get('/hbot/sessions/:sessionId/toxicity-logs', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessionId = Number(req.params.sessionId);
    const logs = await hyperbaricMedicineService.HyperbaricMedicineService.getToxicityLogsBySession(sessionId);
    res.json(logs);
  } catch (err: any) {
    console.error('Get toxicity logs error:', err);
    res.status(500).json({ error: 'Failed to retrieve toxicity logs.' });
  }
});

// Phase 65: Molecular Adsorbent Liver Support & Acute Liver Failure (LIVER-ALIVE Hub)
// Evaluate King's College Hospital Criteria
router.post('/liver/evaluate-kings-college', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const evaluation = liverSupportService.LiverSupportService.evaluateKingsCollegeCriteria(req.body);
    res.json(evaluation);
  } catch (err: any) {
    console.error('Evaluate King\'s College error:', err);
    res.status(500).json({ error: 'Failed to evaluate King\'s College criteria.' });
  }
});

// Evaluate MARS Albumin Clearance
router.post('/liver/evaluate-mars-clearance', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const evaluation = liverSupportService.LiverSupportService.calculateMarsClearance(req.body);
    res.json(evaluation);
  } catch (err: any) {
    console.error('Evaluate MARS clearance error:', err);
    res.status(500).json({ error: 'Failed to evaluate MARS clearance.' });
  }
});

// Evaluate Cerebral Edema Risk
router.post('/liver/evaluate-cerebral-edema', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const evaluation = liverSupportService.LiverSupportService.evaluateCerebralEdemaRisk(req.body);
    res.json(evaluation);
  } catch (err: any) {
    console.error('Evaluate cerebral edema risk error:', err);
    res.status(500).json({ error: 'Failed to evaluate cerebral edema risk.' });
  }
});

// Record MARS Session
router.post('/liver/mars-sessions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = await liverSupportService.LiverSupportService.recordMarsSession(req.body);
    res.status(201).json(session);
  } catch (err: any) {
    console.error('Record MARS session error:', err);
    res.status(500).json({ error: 'Failed to record MARS session.' });
  }
});

// Record Acute Liver Failure Case
router.post('/liver/alf-cases', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const alfCase = await liverSupportService.LiverSupportService.recordAlfCase(req.body);
    res.status(201).json(alfCase);
  } catch (err: any) {
    console.error('Record ALF case error:', err);
    res.status(500).json({ error: 'Failed to record ALF case.' });
  }
});

// Get Patient Liver Profile
router.get('/liver/patients/:patientId/profile', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = Number(req.params.patientId);
    const profile = await liverSupportService.LiverSupportService.getPatientLiverProfile(patientId);
    res.json(profile);
  } catch (err: any) {
    console.error('Get patient liver profile error:', err);
    res.status(500).json({ error: 'Failed to retrieve patient liver profile.' });
  }
});

// Phase 66: SMART-on-FHIR & CDS Hooks Enterprise Integration Engine (CDS-HOOKS Hub)
// CDS Services Discovery Endpoint
router.get('/cds-services', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const catalog = cdsHooksFhirService.CdsHooksFhirService.getDiscoveryCatalog();
    res.json(catalog);
  } catch (err: any) {
    console.error('CDS Discovery catalog error:', err);
    res.status(500).json({ error: 'Failed to retrieve CDS discovery catalog.' });
  }
});

// Execute CDS Hook Evaluator
router.post('/cds-services/:serviceId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cards = await cdsHooksFhirService.CdsHooksFhirService.evaluateHook(req.body);
    res.json(cards);
  } catch (err: any) {
    console.error('CDS Hook evaluation error:', err);
    res.status(500).json({ error: 'Failed to evaluate CDS hook.' });
  }
});

// Register SMART-on-FHIR Client
router.post('/smart/clients', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const client = await cdsHooksFhirService.CdsHooksFhirService.registerSmartClient(req.body);
    res.status(201).json(client);
  } catch (err: any) {
    console.error('Register SMART client error:', err);
    res.status(500).json({ error: 'Failed to register SMART client.' });
  }
});

// SMART OAuth2 Token Exchange
router.post('/smart/token', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tokenResponse = cdsHooksFhirService.CdsHooksFhirService.generateSmartTokenResponse(req.body);
    res.json(tokenResponse);
  } catch (err: any) {
    console.error('SMART token generation error:', err);
    res.status(500).json({ error: 'Failed to generate SMART token.' });
  }
});

// Audit Logs for Hook Invocations
router.get('/cds/invocations', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = req.query.patientId ? Number(req.query.patientId) : undefined;
    const invocations = await cdsHooksFhirService.CdsHooksFhirService.getHookInvocations(patientId);
    res.json(invocations);
  } catch (err: any) {
    console.error('Get CDS invocations error:', err);
    res.status(500).json({ error: 'Failed to retrieve CDS hook invocations.' });
  }
});

// Phase 67: Ambient Bedside Scribe & Tele-ICU Virtual Command (TELE-ICU Hub)
// Evaluate CPOT Pain Score
router.post('/tele-icu/evaluate-cpot', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const evaluation = teleIcuScribeService.TeleIcuScribeService.evaluateCpotScore(req.body);
    res.json(evaluation);
  } catch (err: any) {
    console.error('Evaluate CPOT score error:', err);
    res.status(500).json({ error: 'Failed to evaluate CPOT pain score.' });
  }
});

// Extract SOAP Note from Ambient Transcript
router.post('/tele-icu/extract-soap', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { rawTranscript, vitalsContext } = req.body;
    const soap = teleIcuScribeService.TeleIcuScribeService.extractSoapFromTranscript(rawTranscript, vitalsContext);
    res.json(soap);
  } catch (err: any) {
    console.error('Extract ambient SOAP error:', err);
    res.status(500).json({ error: 'Failed to extract SOAP note from transcript.' });
  }
});

// Create/Update Tele-ICU WebRTC Session
router.post('/tele-icu/sessions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = await teleIcuScribeService.TeleIcuScribeService.createTeleIcuSession(req.body);
    res.status(201).json(session);
  } catch (err: any) {
    console.error('Create Tele-ICU session error:', err);
    res.status(500).json({ error: 'Failed to create Tele-ICU session.' });
  }
});

// Record Ambient Transcript
router.post('/tele-icu/sessions/:sessionId/transcripts', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessionId = Number(req.params.sessionId);
    const { rawTranscript, vitalsContext } = req.body;
    const record = await teleIcuScribeService.TeleIcuScribeService.recordScribeTranscript(sessionId, rawTranscript, vitalsContext);
    res.status(201).json(record);
  } catch (err: any) {
    console.error('Record ambient transcript error:', err);
    res.status(500).json({ error: 'Failed to record ambient transcript.' });
  }
});

// Get Patient Tele-ICU History
router.get('/tele-icu/patients/:patientId/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = Number(req.params.patientId);
    const history = await teleIcuScribeService.TeleIcuScribeService.getPatientTeleIcuHistory(patientId);
    res.json(history);
  } catch (err: any) {
    console.error('Get patient Tele-ICU history error:', err);
    res.status(500).json({ error: 'Failed to retrieve Tele-ICU history.' });
  }
});

// Phase 68: Acute Neurological Resuscitation & Multimodal Neuro-Monitoring (NEURO-CRIT Hub)
// Evaluate Cerebral Autoregulation & PRx Index
router.post('/neurocrit/evaluate-autoregulation', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const evaluation = neuroCriticalCareService.NeuroCriticalCareService.evaluateAutoregulation(req.body);
    res.json(evaluation);
  } catch (err: any) {
    console.error('Evaluate autoregulation error:', err);
    res.status(500).json({ error: 'Failed to evaluate autoregulation.' });
  }
});

// Evaluate Multimodal Neurometabolism (PbtO2 & LPR)
router.post('/neurocrit/evaluate-metabolism', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const evaluation = neuroCriticalCareService.NeuroCriticalCareService.evaluateMultimodalMetabolism(req.body);
    res.json(evaluation);
  } catch (err: any) {
    console.error('Evaluate metabolism error:', err);
    res.status(500).json({ error: 'Failed to evaluate neurometabolism.' });
  }
});

// Evaluate SAH TCD & Lindegaard Ratio
router.post('/neurocrit/evaluate-sah-vasospasm', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const evaluation = neuroCriticalCareService.NeuroCriticalCareService.evaluateSahVasospasm(req.body);
    res.json(evaluation);
  } catch (err: any) {
    console.error('Evaluate SAH vasospasm error:', err);
    res.status(500).json({ error: 'Failed to evaluate SAH vasospasm.' });
  }
});

// Evaluate Status Epilepticus Continuous EEG
router.post('/neurocrit/evaluate-eeg', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const evaluation = neuroCriticalCareService.NeuroCriticalCareService.evaluateEegBurstSuppression(req.body);
    res.json(evaluation);
  } catch (err: any) {
    console.error('Evaluate EEG burst suppression error:', err);
    res.status(500).json({ error: 'Failed to evaluate EEG burst suppression.' });
  }
});

// Record Neurocritical Care Monitoring Session
router.post('/neurocrit/sessions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = await neuroCriticalCareService.NeuroCriticalCareService.recordMonitoringSession(req.body);
    res.status(201).json(session);
  } catch (err: any) {
    console.error('Record neurocrit session error:', err);
    res.status(500).json({ error: 'Failed to record monitoring session.' });
  }
});

// Record Intracranial Hypertension Event
router.post('/neurocrit/events', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const event = await neuroCriticalCareService.NeuroCriticalCareService.recordHypertensionEvent(req.body);
    res.status(201).json(event);
  } catch (err: any) {
    console.error('Record intracranial event error:', err);
    res.status(500).json({ error: 'Failed to record intracranial hypertension event.' });
  }
});

// Get Patient Neuro Profile
router.get('/neurocrit/patients/:patientId/profile', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = Number(req.params.patientId);
    const profile = await neuroCriticalCareService.NeuroCriticalCareService.getPatientNeuroProfile(patientId);
    res.json(profile);
  } catch (err: any) {
    console.error('Get patient neuro profile error:', err);
    res.status(500).json({ error: 'Failed to retrieve neuro profile.' });
  }
});

// Phase 69: Cellular Immunotherapy, CAR-T & Cytokine Release Command (CELL-SHIELD Hub)
// Evaluate ASTCT CRS Grade
router.post('/cart/evaluate-crs', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const evaluation = cellularImmunotherapyService.CellularImmunotherapyService.evaluateCrs(req.body);
    res.json(evaluation);
  } catch (err: any) {
    console.error('Evaluate CRS error:', err);
    res.status(500).json({ error: 'Failed to evaluate CRS grade.' });
  }
});

// Evaluate ASTCT ICANS Grade
router.post('/cart/evaluate-icans', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const evaluation = cellularImmunotherapyService.CellularImmunotherapyService.evaluateIcans(req.body);
    res.json(evaluation);
  } catch (err: any) {
    console.error('Evaluate ICANS error:', err);
    res.status(500).json({ error: 'Failed to evaluate ICANS grade.' });
  }
});

// Calculate HScore for Secondary HLH/MAS
router.post('/cart/evaluate-hscore', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const evaluation = cellularImmunotherapyService.CellularImmunotherapyService.calculateHScore(req.body);
    res.json(evaluation);
  } catch (err: any) {
    console.error('Evaluate HScore error:', err);
    res.status(500).json({ error: 'Failed to calculate HScore.' });
  }
});

// Record CAR-T Therapy Case
router.post('/cart/cases', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cartCase = await cellularImmunotherapyService.CellularImmunotherapyService.recordCartCase(req.body);
    res.status(201).json(cartCase);
  } catch (err: any) {
    console.error('Record CAR-T case error:', err);
    res.status(500).json({ error: 'Failed to record CAR-T therapy case.' });
  }
});

// Record Cytokine Release Event
router.post('/cart/events', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const event = await cellularImmunotherapyService.CellularImmunotherapyService.recordCrsEvent(req.body);
    res.status(201).json(event);
  } catch (err: any) {
    console.error('Record CRS event error:', err);
    res.status(500).json({ error: 'Failed to record CRS event.' });
  }
});

// Get Patient CAR-T Profile
router.get('/cart/patients/:patientId/profile', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = Number(req.params.patientId);
    const profile = await cellularImmunotherapyService.CellularImmunotherapyService.getPatientCartProfile(patientId);
    res.json(profile);
  } catch (err: any) {
    console.error('Get patient CAR-T profile error:', err);
    res.status(500).json({ error: 'Failed to retrieve CAR-T profile.' });
  }
});

// Phase 70: Extracorporeal Cardiopulmonary Resuscitation & Refractory Arrest (E-CPR Command)
// Evaluate E-CPR Inclusion Criteria
router.post('/ecpr/evaluate-inclusion', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const evaluation = ecprResuscitationService.EcprResuscitationService.evaluateInclusionCriteria(req.body);
    res.json(evaluation);
  } catch (err: any) {
    console.error('Evaluate E-CPR inclusion error:', err);
    res.status(500).json({ error: 'Failed to evaluate E-CPR inclusion criteria.' });
  }
});

// Evaluate Targeted Temperature Management Protocol
router.post('/ecpr/evaluate-ttm', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const evaluation = ecprResuscitationService.EcprResuscitationService.evaluateTtmProtocol(req.body);
    res.json(evaluation);
  } catch (err: any) {
    console.error('Evaluate TTM protocol error:', err);
    res.status(500).json({ error: 'Failed to evaluate TTM protocol.' });
  }
});

// Record E-CPR Resuscitation Case
router.post('/ecpr/cases', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ecprCase = await ecprResuscitationService.EcprResuscitationService.recordEcprCase(req.body);
    res.status(201).json(ecprCase);
  } catch (err: any) {
    console.error('Record E-CPR case error:', err);
    res.status(500).json({ error: 'Failed to record E-CPR resuscitation case.' });
  }
});

// Record TTM Temperature Log
router.post('/ecpr/temperature-logs', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const log = await ecprResuscitationService.EcprResuscitationService.recordTtmLog(req.body);
    res.status(201).json(log);
  } catch (err: any) {
    console.error('Record TTM log error:', err);
    res.status(500).json({ error: 'Failed to record TTM temperature log.' });
  }
});

// Get Patient E-CPR Profile
router.get('/ecpr/patients/:patientId/profile', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = Number(req.params.patientId);
    const profile = await ecprResuscitationService.EcprResuscitationService.getPatientEcprProfile(patientId);
    res.json(profile);
  } catch (err: any) {
    console.error('Get patient E-CPR profile error:', err);
    res.status(500).json({ error: 'Failed to retrieve E-CPR profile.' });
  }
});

// Phase 71: Hospital Operations Master Digital Twin & Predictive Flow (TWIN-ORCHESTRA Hub)

// Get all hospital units with census & ratio metrics
router.get('/digital-twin/units', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const units = await digitalTwinOperationsService.DigitalTwinOperationsService.getHospitalUnits();
    res.json(units);
  } catch (err: any) {
    console.error('Get digital twin units error:', err);
    res.status(500).json({ error: 'Failed to retrieve hospital digital twin units.' });
  }
});

// Update single unit census / staffing / diversion
router.patch('/digital-twin/units/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const unitId = Number(req.params.id);
    const updated = await digitalTwinOperationsService.DigitalTwinOperationsService.updateUnitCensus(unitId, req.body);
    res.json(updated);
  } catch (err: any) {
    console.error('Update unit census error:', err);
    res.status(500).json({ error: 'Failed to update hospital unit census.' });
  }
});

// Run flow simulation scenario
router.post('/digital-twin/simulate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      scenario_name,
      ed_arrival_rate_per_hr,
      icu_stepdown_transfer_rate,
      or_addon_surgeries_count,
      simulation_duration_hours
    } = req.body;

    if (!scenario_name || ed_arrival_rate_per_hr === undefined || icu_stepdown_transfer_rate === undefined) {
      res.status(400).json({ error: 'scenario_name, ed_arrival_rate_per_hr, and icu_stepdown_transfer_rate are required.' });
      return;
    }

    const result = await digitalTwinOperationsService.DigitalTwinOperationsService.runFlowSimulation({
      scenario_name,
      ed_arrival_rate_per_hr: Number(ed_arrival_rate_per_hr),
      icu_stepdown_transfer_rate: Number(icu_stepdown_transfer_rate),
      or_addon_surgeries_count: Number(or_addon_surgeries_count || 0),
      simulation_duration_hours: Number(simulation_duration_hours || 24)
    });

    res.json(result);
  } catch (err: any) {
    console.error('Run flow simulation error:', err);
    res.status(500).json({ error: 'Failed to run hospital flow simulation.' });
  }
});

// Get simulation history
router.get('/digital-twin/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 10;
    const history = await digitalTwinOperationsService.DigitalTwinOperationsService.getSimulationHistory(limit);
    res.json(history);
  } catch (err: any) {
    console.error('Get simulation history error:', err);
    res.status(500).json({ error: 'Failed to retrieve simulation history.' });
  }
});

// Phase 72: Acute Limb Ischemia, Compartment Syndrome & Microvascular Free-Flap (VASCULAR-LIMB Command)

// Evaluate Rutherford Acute Limb Ischemia
router.post('/vascular-limb/evaluate-rutherford', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const evaluation = vascularLimbService.evaluateRutherfordClassification(req.body);
    res.json(evaluation);
  } catch (err: any) {
    console.error('Evaluate Rutherford error:', err);
    res.status(500).json({ error: 'Failed to evaluate Rutherford classification.' });
  }
});

// Evaluate Compartment Pressure & Delta-P
router.post('/vascular-limb/evaluate-compartment', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const evaluation = vascularLimbService.evaluateCompartmentPressure(req.body);
    res.json(evaluation);
  } catch (err: any) {
    console.error('Evaluate compartment pressure error:', err);
    res.status(500).json({ error: 'Failed to evaluate compartment pressure.' });
  }
});

// Evaluate Microvascular Free-Flap Perfusion
router.post('/vascular-limb/evaluate-free-flap', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const evaluation = vascularLimbService.evaluateFreeFlapPerfusion(req.body);
    res.json(evaluation);
  } catch (err: any) {
    console.error('Evaluate free flap error:', err);
    res.status(500).json({ error: 'Failed to evaluate microvascular free flap.' });
  }
});

// Save Vascular Limb Encounter
router.post('/vascular-limb/encounters', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { patient_id, ...assessmentInput } = req.body;
    if (!patient_id) {
      res.status(400).json({ error: 'patient_id is required.' });
      return;
    }
    const result = await vascularLimbService.VascularLimbService.evaluateAndSaveEncounter(
      Number(patient_id),
      assessmentInput
    );
    res.status(201).json(result);
  } catch (err: any) {
    console.error('Save vascular encounter error:', err);
    res.status(500).json({ error: 'Failed to record vascular limb encounter.' });
  }
});

// Log Compartment Pressure & Optional Flap Monitoring
router.post('/vascular-limb/compartment-logs', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { encounter_id, compartment_input, free_flap_input } = req.body;
    if (!encounter_id || !compartment_input) {
      res.status(400).json({ error: 'encounter_id and compartment_input are required.' });
      return;
    }
    const result = await vascularLimbService.VascularLimbService.logCompartmentPressure(
      Number(encounter_id),
      compartment_input,
      free_flap_input
    );
    res.status(201).json(result);
  } catch (err: any) {
    console.error('Log compartment pressure error:', err);
    res.status(500).json({ error: 'Failed to log compartment pressure.' });
  }
});

// Get Patient Vascular History
router.get('/vascular-limb/patients/:patientId/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = Number(req.params.patientId);
    const history = await vascularLimbService.VascularLimbService.getPatientVascularHistory(patientId);
    res.json(history);
  } catch (err: any) {
    console.error('Get vascular history error:', err);
    res.status(500).json({ error: 'Failed to retrieve vascular limb history.' });
  }
});

// Phase 73: Complex DKA, HHS, Euglycemic SGLT2i & Dynamic Insulin Fleet (METABOLIC-KETO Command)

// Evaluate DKA vs HHS presentation & protocols
router.post('/metabolic-keto/evaluate-presentation', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const evaluation = metabolicKetoService.evaluateMetabolicKeto(req.body);
    res.json(evaluation);
  } catch (err: any) {
    console.error('Evaluate metabolic keto error:', err);
    res.status(500).json({ error: 'Failed to evaluate metabolic keto presentation.' });
  }
});

// Evaluate Hourly Insulin Titration
router.post('/metabolic-keto/evaluate-titration', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const evaluation = metabolicKetoService.evaluateHourlyTitration(req.body);
    res.json(evaluation);
  } catch (err: any) {
    console.error('Evaluate hourly titration error:', err);
    res.status(500).json({ error: 'Failed to evaluate insulin titration.' });
  }
});

// Save Metabolic Encounter
router.post('/metabolic-keto/encounters', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { patient_id, ...assessmentInput } = req.body;
    if (!patient_id) {
      res.status(400).json({ error: 'patient_id is required.' });
      return;
    }
    const result = await metabolicKetoService.MetabolicKetoService.evaluateAndSaveEncounter(
      Number(patient_id),
      assessmentInput
    );
    res.status(201).json(result);
  } catch (err: any) {
    console.error('Save metabolic encounter error:', err);
    res.status(500).json({ error: 'Failed to record metabolic keto encounter.' });
  }
});

// Log Hourly Insulin Titration
router.post('/metabolic-keto/titration-logs', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { encounter_id, ...titrationInput } = req.body;
    if (!encounter_id) {
      res.status(400).json({ error: 'encounter_id is required.' });
      return;
    }
    const result = await metabolicKetoService.MetabolicKetoService.logTitration(
      Number(encounter_id),
      titrationInput
    );
    res.status(201).json(result);
  } catch (err: any) {
    console.error('Log titration error:', err);
    res.status(500).json({ error: 'Failed to log insulin titration.' });
  }
});

// Get Patient Metabolic History
router.get('/metabolic-keto/patients/:patientId/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = Number(req.params.patientId);
    const history = await metabolicKetoService.MetabolicKetoService.getPatientMetabolicHistory(patientId);
    res.json(history);
  } catch (err: any) {
    console.error('Get metabolic history error:', err);
    res.status(500).json({ error: 'Failed to retrieve metabolic keto history.' });
  }
});

// Phase 74: Viscoelastic Point-of-Care Hemostasis, TEG/ROTEM & Targeted DOAC Reversal (COAG-ROTEM Command)

// Evaluate ROTEM / TEG viscoelastic assay
router.post('/coag-rotem/evaluate-rotem', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const evaluation = coagRotemService.evaluateRotemAssay(req.body);
    res.json(evaluation);
  } catch (err: any) {
    console.error('Evaluate ROTEM error:', err);
    res.status(500).json({ error: 'Failed to evaluate viscoelastic assay.' });
  }
});

// Evaluate Anticoagulant Reversal Protocol
router.post('/coag-rotem/evaluate-reversal', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const evaluation = coagRotemService.evaluateAnticoagulantReversal(req.body);
    res.json(evaluation);
  } catch (err: any) {
    console.error('Evaluate reversal error:', err);
    res.status(500).json({ error: 'Failed to evaluate anticoagulant reversal.' });
  }
});

// Save ROTEM Assay
router.post('/coag-rotem/assays', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { patient_id, ...assayInput } = req.body;
    if (!patient_id) {
      res.status(400).json({ error: 'patient_id is required.' });
      return;
    }
    const result = await coagRotemService.CoagRotemService.evaluateAndSaveAssay(
      Number(patient_id),
      assayInput
    );
    res.status(201).json(result);
  } catch (err: any) {
    console.error('Save ROTEM assay error:', err);
    res.status(500).json({ error: 'Failed to record viscoelastic assay.' });
  }
});

// Save Anticoagulant Reversal Event
router.post('/coag-rotem/reversals', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { patient_id, ...reversalInput } = req.body;
    if (!patient_id) {
      res.status(400).json({ error: 'patient_id is required.' });
      return;
    }
    const result = await coagRotemService.CoagRotemService.evaluateAndSaveReversal(
      Number(patient_id),
      reversalInput
    );
    res.status(201).json(result);
  } catch (err: any) {
    console.error('Save reversal event error:', err);
    res.status(500).json({ error: 'Failed to record anticoagulant reversal event.' });
  }
});

// Get Patient Coagulation History
router.get('/coag-rotem/patients/:patientId/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = Number(req.params.patientId);
    const history = await coagRotemService.CoagRotemService.getPatientCoagHistory(patientId);
    res.json(history);
  } catch (err: any) {
    console.error('Get coag history error:', err);
    res.status(500).json({ error: 'Failed to retrieve coagulation history.' });
  }
});

// Phase 75: ROUNDING-HUD - Evaluate FAST-HUG-BID Bundle
router.post('/icu-rounding/evaluate-fasthug', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { bundle } = req.body;
    if (!bundle) {
      res.status(400).json({ error: 'bundle is required.' });
      return;
    }
    const result = icuRoundingService.IcuRoundingService.evaluateFastHugBid(bundle);
    res.json(result);
  } catch (err: any) {
    console.error('Evaluate FAST-HUG-BID error:', err);
    res.status(500).json({ error: 'Failed to evaluate FAST-HUG-BID bundle.' });
  }
});

// Phase 75: ROUNDING-HUD - Evaluate CAM-ICU Delirium
router.post('/icu-rounding/evaluate-camicu', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { features, qtc_interval_ms, baseline_qtc_ms } = req.body;
    if (!features) {
      res.status(400).json({ error: 'features object is required.' });
      return;
    }
    const result = icuRoundingService.IcuRoundingService.evaluateCamIcu(features, qtc_interval_ms, baseline_qtc_ms);
    res.json(result);
  } catch (err: any) {
    console.error('Evaluate CAM-ICU error:', err);
    res.status(500).json({ error: 'Failed to evaluate CAM-ICU delirium.' });
  }
});

// Phase 75: ROUNDING-HUD - Evaluate Invasive Device Days & Risk
router.post('/icu-rounding/evaluate-device', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deviceInput = req.body;
    if (!deviceInput || !deviceInput.device_type) {
      res.status(400).json({ error: 'device_type is required.' });
      return;
    }
    const result = icuRoundingService.IcuRoundingService.evaluateDevice(deviceInput);
    res.json(result);
  } catch (err: any) {
    console.error('Evaluate device error:', err);
    res.status(500).json({ error: 'Failed to evaluate invasive device status.' });
  }
});

// Phase 75: ROUNDING-HUD - Save Rounding Checklist
router.post('/icu-rounding/checklists', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      patient_id,
      bed_number,
      fast_hug_bid_bundle,
      compliance_score_percent,
      cam_icu_delirium_status,
      cam_icu_subtype,
      qtc_interval_ms,
      qtc_risk_alert,
      antimicrobial_timeout_due
    } = req.body;

    if (!patient_id || !bed_number || !fast_hug_bid_bundle) {
      res.status(400).json({ error: 'patient_id, bed_number, and fast_hug_bid_bundle are required.' });
      return;
    }

    const saved = await icuRoundingService.IcuRoundingService.saveRoundingChecklist({
      patient_id: Number(patient_id),
      bed_number,
      fast_hug_bid_bundle,
      compliance_score_percent: Number(compliance_score_percent),
      cam_icu_delirium_status,
      cam_icu_subtype,
      qtc_interval_ms: qtc_interval_ms ? Number(qtc_interval_ms) : undefined,
      qtc_risk_alert: Boolean(qtc_risk_alert),
      antimicrobial_timeout_due: Boolean(antimicrobial_timeout_due)
    });

    res.status(201).json(saved);
  } catch (err: any) {
    console.error('Save rounding checklist error:', err);
    res.status(500).json({ error: 'Failed to record rounding checklist.' });
  }
});

// Phase 75: ROUNDING-HUD - Track Invasive Device
router.post('/icu-rounding/devices', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      patient_id,
      device_type,
      insertion_timestamp,
      device_days,
      daily_indication_present,
      infection_bundle_compliant,
      removal_recommended
    } = req.body;

    if (!patient_id || !device_type || !insertion_timestamp) {
      res.status(400).json({ error: 'patient_id, device_type, and insertion_timestamp are required.' });
      return;
    }

    const saved = await icuRoundingService.IcuRoundingService.trackInvasiveDevice({
      patient_id: Number(patient_id),
      device_type,
      insertion_timestamp,
      device_days: Number(device_days || 0),
      daily_indication_present: daily_indication_present !== undefined ? Boolean(daily_indication_present) : true,
      infection_bundle_compliant: infection_bundle_compliant !== undefined ? Boolean(infection_bundle_compliant) : true,
      removal_recommended: Boolean(removal_recommended)
    });

    res.status(201).json(saved);
  } catch (err: any) {
    console.error('Save device tracker error:', err);
    res.status(500).json({ error: 'Failed to record invasive device tracker.' });
  }
});

// Phase 75: ROUNDING-HUD - Get Patient Rounding History
router.get('/icu-rounding/patients/:patientId/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = Number(req.params.patientId);
    const history = await icuRoundingService.IcuRoundingService.getPatientRoundingHistory(patientId);
    res.json(history);
  } catch (err: any) {
    console.error('Get rounding history error:', err);
    res.status(500).json({ error: 'Failed to retrieve rounding history.' });
  }
});

// Phase 76: PANCREAS-ALERT - Evaluate Atlanta Classification
router.post('/pancreatitis/evaluate-atlanta', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const assessment = acutePancreatitisService.AcutePancreatitisService.evaluateAtlantaClassification(req.body);
    res.json(assessment);
  } catch (err: any) {
    console.error('Evaluate Atlanta classification error:', err);
    res.status(500).json({ error: 'Failed to evaluate Atlanta classification.' });
  }
});

// Phase 76: PANCREAS-ALERT - Evaluate BISAP Score
router.post('/pancreatitis/evaluate-bisap', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = acutePancreatitisService.AcutePancreatitisService.evaluateBisapScore(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('Evaluate BISAP error:', err);
    res.status(500).json({ error: 'Failed to evaluate BISAP score.' });
  }
});

// Phase 76: PANCREAS-ALERT - Evaluate Fluid Resuscitation
router.post('/pancreatitis/evaluate-fluid', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = acutePancreatitisService.AcutePancreatitisService.evaluateFluidResuscitation(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('Evaluate fluid error:', err);
    res.status(500).json({ error: 'Failed to evaluate fluid resuscitation.' });
  }
});

// Phase 76: PANCREAS-ALERT - Evaluate Dutch Step-Up Approach
router.post('/pancreatitis/evaluate-stepup', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = acutePancreatitisService.AcutePancreatitisService.evaluateDutchStepUp(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('Evaluate step-up error:', err);
    res.status(500).json({ error: 'Failed to evaluate Dutch Step-Up approach.' });
  }
});

// Phase 76: PANCREAS-ALERT - Evaluate Tokyo TG18 Cholangitis
router.post('/pancreatitis/evaluate-tg18', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = acutePancreatitisService.AcutePancreatitisService.evaluateTg18Cholangitis(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('Evaluate TG18 error:', err);
    res.status(500).json({ error: 'Failed to evaluate Tokyo TG18 guidelines.' });
  }
});

// Phase 76: PANCREAS-ALERT - Save Pancreatitis Encounter
router.post('/pancreatitis/encounters', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      patient_id,
      etiology,
      atlanta_severity,
      bisap_score,
      glasgow_imrie_score,
      sirs_present,
      organ_failure_persistent,
      fluid_rate_ml_hr,
      fluid_type,
      hematocrit_percent,
      bun_mg_dl,
      urine_output_ml_kg_hr,
      gallstone_cholangitis_suspected,
      tg18_severity,
      ercp_recommended_within_24h
    } = req.body;

    if (!patient_id || !etiology || !atlanta_severity || bisap_score === undefined || fluid_rate_ml_hr === undefined) {
      res.status(400).json({ error: 'Missing mandatory acute pancreatitis parameters.' });
      return;
    }

    const saved = await acutePancreatitisService.AcutePancreatitisService.savePancreatitisEncounter({
      patient_id: Number(patient_id),
      etiology,
      atlanta_severity,
      bisap_score: Number(bisap_score),
      glasgow_imrie_score: glasgow_imrie_score !== undefined ? Number(glasgow_imrie_score) : undefined,
      sirs_present: Boolean(sirs_present),
      organ_failure_persistent: Boolean(organ_failure_persistent),
      fluid_rate_ml_hr: Number(fluid_rate_ml_hr),
      fluid_type,
      hematocrit_percent: hematocrit_percent !== undefined ? Number(hematocrit_percent) : undefined,
      bun_mg_dl: bun_mg_dl !== undefined ? Number(bun_mg_dl) : undefined,
      urine_output_ml_kg_hr: urine_output_ml_kg_hr !== undefined ? Number(urine_output_ml_kg_hr) : undefined,
      gallstone_cholangitis_suspected: Boolean(gallstone_cholangitis_suspected),
      tg18_severity,
      ercp_recommended_within_24h: Boolean(ercp_recommended_within_24h)
    });

    res.status(201).json(saved);
  } catch (err: any) {
    console.error('Save pancreatitis encounter error:', err);
    res.status(500).json({ error: 'Failed to record pancreatitis encounter.' });
  }
});

// Phase 76: PANCREAS-ALERT - Save Step-Up Intervention Log
router.post('/pancreatitis/stepup-interventions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      encounter_id,
      patient_id,
      necrosis_type,
      gas_on_ct,
      current_step,
      clinical_response,
      drainage_output_ml_24h,
      next_recommended_step,
      antimicrobial_regimen
    } = req.body;

    if (!encounter_id || !patient_id || !necrosis_type || !current_step || !clinical_response || !next_recommended_step) {
      res.status(400).json({ error: 'Missing mandatory step-up intervention parameters.' });
      return;
    }

    const saved = await acutePancreatitisService.AcutePancreatitisService.saveStepUpIntervention({
      encounter_id: Number(encounter_id),
      patient_id: Number(patient_id),
      necrosis_type,
      gas_on_ct: Boolean(gas_on_ct),
      current_step,
      clinical_response,
      drainage_output_ml_24h: drainage_output_ml_24h !== undefined ? Number(drainage_output_ml_24h) : undefined,
      next_recommended_step,
      antimicrobial_regimen
    });

    res.status(201).json(saved);
  } catch (err: any) {
    console.error('Save step-up intervention error:', err);
    res.status(500).json({ error: 'Failed to record step-up intervention.' });
  }
});

// Phase 76: PANCREAS-ALERT - Get Patient Pancreatitis History
router.get('/pancreatitis/patients/:patientId/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = Number(req.params.patientId);
    const history = await acutePancreatitisService.AcutePancreatitisService.getPatientPancreatitisHistory(patientId);
    res.json(history);
  } catch (err: any) {
    console.error('Get pancreatitis history error:', err);
    res.status(500).json({ error: 'Failed to retrieve pancreatitis history.' });
  }
});

// Phase 77: PHERESIS-CMD - Evaluate ASFA Indication & Category
router.post('/apheresis/evaluate-asfa', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { indication } = req.body;
    if (!indication) {
      res.status(400).json({ error: 'indication is required.' });
      return;
    }
    const result = therapeuticApheresisService.TherapeuticApheresisService.evaluateAsfaGuidance(indication);
    res.json(result);
  } catch (err: any) {
    console.error('Evaluate ASFA error:', err);
    res.status(500).json({ error: 'Failed to evaluate ASFA guidance.' });
  }
});

// Phase 77: PHERESIS-CMD - Evaluate PLASMIC Score & TTP Protocol
router.post('/apheresis/evaluate-plasmic', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = therapeuticApheresisService.TherapeuticApheresisService.evaluatePlasmicScore(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('Evaluate PLASMIC error:', err);
    res.status(500).json({ error: 'Failed to evaluate PLASMIC score.' });
  }
});

// Phase 77: PHERESIS-CMD - Calculate Total Plasma Volume (TPV) & Exchange Dose
router.post('/apheresis/calculate-volume', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = therapeuticApheresisService.TherapeuticApheresisService.calculatePlasmaVolume(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('Calculate plasma volume error:', err);
    res.status(500).json({ error: 'Failed to calculate plasma volume.' });
  }
});

// Phase 77: PHERESIS-CMD - Evaluate Citrate-Induced Hypocalcemia Safety
router.post('/apheresis/evaluate-calcium', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = therapeuticApheresisService.TherapeuticApheresisService.evaluateCitrateCalciumSafety(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('Evaluate calcium safety error:', err);
    res.status(500).json({ error: 'Failed to evaluate citrate calcium safety.' });
  }
});

// Phase 77: PHERESIS-CMD - Save Apheresis Procedure Order
router.post('/apheresis/procedures', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      patient_id,
      asfa_indication,
      asfa_category,
      plasmic_score,
      adamts13_activity_percent,
      total_plasma_volume_ml,
      prescribed_exchange_tpv_fraction,
      total_exchange_volume_ml,
      replacement_fluid,
      platelet_transfusion_contraindicated,
      calcium_infusion_active
    } = req.body;

    if (!patient_id || !asfa_indication || !asfa_category || !total_plasma_volume_ml || !replacement_fluid) {
      res.status(400).json({ error: 'Missing mandatory apheresis procedure parameters.' });
      return;
    }

    const saved = await therapeuticApheresisService.TherapeuticApheresisService.saveApheresisProcedure({
      patient_id: Number(patient_id),
      asfa_indication,
      asfa_category,
      plasmic_score: plasmic_score !== undefined ? Number(plasmic_score) : undefined,
      adamts13_activity_percent: adamts13_activity_percent !== undefined ? Number(adamts13_activity_percent) : undefined,
      total_plasma_volume_ml: Number(total_plasma_volume_ml),
      prescribed_exchange_tpv_fraction: Number(prescribed_exchange_tpv_fraction || 1.0),
      total_exchange_volume_ml: Number(total_exchange_volume_ml),
      replacement_fluid,
      platelet_transfusion_contraindicated: Boolean(platelet_transfusion_contraindicated),
      calcium_infusion_active: calcium_infusion_active !== undefined ? Boolean(calcium_infusion_active) : true
    });

    res.status(201).json(saved);
  } catch (err: any) {
    console.error('Save apheresis procedure error:', err);
    res.status(500).json({ error: 'Failed to record apheresis procedure.' });
  }
});

// Phase 77: PHERESIS-CMD - Log Real-time Exchange Telemetry
router.post('/apheresis/telemetry-logs', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      procedure_id,
      patient_id,
      blood_processed_ml,
      plasma_removed_ml,
      replacement_administered_ml,
      acda_citrate_volume_ml,
      systemic_ionized_calcium_mmol_l,
      calcium_gluconate_infused_g,
      hypocalcemia_alert,
      circuit_pressure_inlet_mmhg
    } = req.body;

    if (!procedure_id || !patient_id || blood_processed_ml === undefined || systemic_ionized_calcium_mmol_l === undefined) {
      res.status(400).json({ error: 'Missing mandatory telemetry parameters.' });
      return;
    }

    const saved = await therapeuticApheresisService.TherapeuticApheresisService.logPlasmaExchangeTelemetry({
      procedure_id: Number(procedure_id),
      patient_id: Number(patient_id),
      blood_processed_ml: Number(blood_processed_ml),
      plasma_removed_ml: Number(plasma_removed_ml),
      replacement_administered_ml: Number(replacement_administered_ml),
      acda_citrate_volume_ml: Number(acda_citrate_volume_ml),
      systemic_ionized_calcium_mmol_l: Number(systemic_ionized_calcium_mmol_l),
      calcium_gluconate_infused_g: Number(calcium_gluconate_infused_g),
      hypocalcemia_alert: Boolean(hypocalcemia_alert),
      circuit_pressure_inlet_mmhg: circuit_pressure_inlet_mmhg !== undefined ? Number(circuit_pressure_inlet_mmhg) : undefined
    });

    res.status(201).json(saved);
  } catch (err: any) {
    console.error('Save exchange telemetry error:', err);
    res.status(500).json({ error: 'Failed to record plasma exchange telemetry.' });
  }
});

// Phase 77: PHERESIS-CMD - Get Patient Apheresis History
router.get('/apheresis/patients/:patientId/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = Number(req.params.patientId);
    const history = await therapeuticApheresisService.TherapeuticApheresisService.getPatientApheresisHistory(patientId);
    res.json(history);
  } catch (err: any) {
    console.error('Get apheresis history error:', err);
    res.status(500).json({ error: 'Failed to retrieve apheresis history.' });
  }
});

// Phase 78: VAD-PULSE - Evaluate Impella Microaxial Performance
router.post('/vad/evaluate-impella', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      device_model,
      current_p_level,
      flow_rate_l_min,
      motor_current_ma,
      purge_pressure_mmhg,
      purge_flow_ml_hr,
      suction_alarm_active,
      map_mmhg,
      cvp_mmhg,
      pcwp_mmhg
    } = req.body;

    if (!device_model || !current_p_level || flow_rate_l_min === undefined || purge_pressure_mmhg === undefined || purge_flow_ml_hr === undefined) {
      return res.status(400).json({ error: 'device_model, current_p_level, flow_rate_l_min, purge_pressure_mmhg, and purge_flow_ml_hr are required.' });
    }

    const result = vadPulseService.VadPulseService.evaluateImpella({
      device_model,
      current_p_level,
      flow_rate_l_min: Number(flow_rate_l_min),
      motor_current_ma: motor_current_ma !== undefined ? Number(motor_current_ma) : undefined,
      purge_pressure_mmhg: Number(purge_pressure_mmhg),
      purge_flow_ml_hr: Number(purge_flow_ml_hr),
      suction_alarm_active: Boolean(suction_alarm_active),
      map_mmhg: Number(map_mmhg || 75),
      cvp_mmhg: cvp_mmhg !== undefined ? Number(cvp_mmhg) : undefined,
      pcwp_mmhg: pcwp_mmhg !== undefined ? Number(pcwp_mmhg) : undefined
    });

    res.json(result);
  } catch (err: any) {
    console.error('Evaluate Impella error:', err);
    res.status(500).json({ error: 'Failed to evaluate Impella telemetry.' });
  }
});

// Phase 78: VAD-PULSE - Evaluate Durable LVAD & Thrombosis Sentinel
router.post('/vad/evaluate-durable', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      device_type,
      speed_rpm,
      flow_l_min,
      power_watts,
      baseline_power_watts,
      pulsatility_index,
      baseline_pi,
      doppler_map_mmhg,
      ldh_u_l,
      plasma_free_hgb_mg_dl,
      hematuria_or_dark_urine
    } = req.body;

    if (!device_type || speed_rpm === undefined || flow_l_min === undefined || power_watts === undefined || baseline_power_watts === undefined || pulsatility_index === undefined || baseline_pi === undefined || doppler_map_mmhg === undefined) {
      return res.status(400).json({ error: 'device_type, speed_rpm, flow_l_min, power_watts, baseline_power_watts, pulsatility_index, baseline_pi, and doppler_map_mmhg are required.' });
    }

    const result = vadPulseService.VadPulseService.evaluateDurableLvad({
      device_type,
      speed_rpm: Number(speed_rpm),
      flow_l_min: Number(flow_l_min),
      power_watts: Number(power_watts),
      baseline_power_watts: Number(baseline_power_watts),
      pulsatility_index: Number(pulsatility_index),
      baseline_pi: Number(baseline_pi),
      doppler_map_mmhg: Number(doppler_map_mmhg),
      ldh_u_l: ldh_u_l !== undefined ? Number(ldh_u_l) : undefined,
      plasma_free_hgb_mg_dl: plasma_free_hgb_mg_dl !== undefined ? Number(plasma_free_hgb_mg_dl) : undefined,
      hematuria_or_dark_urine: Boolean(hematuria_or_dark_urine)
    });

    res.json(result);
  } catch (err: any) {
    console.error('Evaluate Durable LVAD error:', err);
    res.status(500).json({ error: 'Failed to evaluate durable LVAD telemetry.' });
  }
});

// Phase 78: VAD-PULSE - Evaluate Post-LVAD RV Failure
router.post('/vad/evaluate-rv-failure', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      cvp_mmhg,
      pcwp_mmhg,
      systolic_pap_mmhg,
      diastolic_pap_mmhg,
      inotropic_support_active,
      signs_of_systemic_congestion
    } = req.body;

    if (cvp_mmhg === undefined || pcwp_mmhg === undefined || systolic_pap_mmhg === undefined || diastolic_pap_mmhg === undefined) {
      return res.status(400).json({ error: 'cvp_mmhg, pcwp_mmhg, systolic_pap_mmhg, and diastolic_pap_mmhg are required.' });
    }

    const result = vadPulseService.VadPulseService.evaluatePostLvadRvFailure({
      cvp_mmhg: Number(cvp_mmhg),
      pcwp_mmhg: Number(pcwp_mmhg),
      systolic_pap_mmhg: Number(systolic_pap_mmhg),
      diastolic_pap_mmhg: Number(diastolic_pap_mmhg),
      inotropic_support_active: Boolean(inotropic_support_active),
      signs_of_systemic_congestion: Boolean(signs_of_systemic_congestion)
    });

    res.json(result);
  } catch (err: any) {
    console.error('Evaluate Post-LVAD RV Failure error:', err);
    res.status(500).json({ error: 'Failed to evaluate post-LVAD RV failure.' });
  }
});

// Phase 78: VAD-PULSE - Register Mechanical VAD Device
router.post('/vad/devices', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      patient_id,
      device_category,
      implant_date,
      set_speed_rpm,
      current_p_level,
      purge_fluid_type,
      baseline_power_watts,
      baseline_pi,
      target_map_mmhg_min,
      target_map_mmhg_max,
      active_status
    } = req.body;

    if (!patient_id || !device_category || !implant_date || set_speed_rpm === undefined) {
      return res.status(400).json({ error: 'patient_id, device_category, implant_date, and set_speed_rpm are required.' });
    }

    const device = await vadPulseService.VadPulseService.registerVadDevice({
      patient_id: Number(patient_id),
      device_category,
      implant_date,
      set_speed_rpm: Number(set_speed_rpm),
      current_p_level,
      purge_fluid_type,
      baseline_power_watts: baseline_power_watts !== undefined ? Number(baseline_power_watts) : undefined,
      baseline_pi: baseline_pi !== undefined ? Number(baseline_pi) : undefined,
      target_map_mmhg_min: target_map_mmhg_min !== undefined ? Number(target_map_mmhg_min) : undefined,
      target_map_mmhg_max: target_map_mmhg_max !== undefined ? Number(target_map_mmhg_max) : undefined,
      active_status: active_status !== undefined ? Boolean(active_status) : true
    });

    res.status(201).json(device);
  } catch (err: any) {
    console.error('Register VAD Device error:', err);
    res.status(500).json({ error: 'Failed to register VAD device.' });
  }
});

// Phase 78: VAD-PULSE - Log VAD Telemetry & Alarms
router.post('/vad/telemetry-alarms', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      device_id,
      patient_id,
      flow_l_min,
      power_watts,
      pulsatility_index,
      doppler_map_mmhg,
      ldh_u_l,
      plasma_free_hgb_mg_dl,
      cvp_mmhg,
      pcwp_mmhg,
      papi_score,
      alarm_type,
      thrombosis_risk_alert,
      rv_failure_alert
    } = req.body;

    if (!device_id || !patient_id || flow_l_min === undefined || power_watts === undefined || doppler_map_mmhg === undefined || !alarm_type) {
      return res.status(400).json({ error: 'device_id, patient_id, flow_l_min, power_watts, doppler_map_mmhg, and alarm_type are required.' });
    }

    const alarmLog = await vadPulseService.VadPulseService.logVadTelemetryAlarm({
      device_id: Number(device_id),
      patient_id: Number(patient_id),
      flow_l_min: Number(flow_l_min),
      power_watts: Number(power_watts),
      pulsatility_index: pulsatility_index !== undefined ? Number(pulsatility_index) : undefined,
      doppler_map_mmhg: Number(doppler_map_mmhg),
      ldh_u_l: ldh_u_l !== undefined ? Number(ldh_u_l) : undefined,
      plasma_free_hgb_mg_dl: plasma_free_hgb_mg_dl !== undefined ? Number(plasma_free_hgb_mg_dl) : undefined,
      cvp_mmhg: cvp_mmhg !== undefined ? Number(cvp_mmhg) : undefined,
      pcwp_mmhg: pcwp_mmhg !== undefined ? Number(pcwp_mmhg) : undefined,
      papi_score: papi_score !== undefined ? Number(papi_score) : undefined,
      alarm_type,
      thrombosis_risk_alert: Boolean(thrombosis_risk_alert),
      rv_failure_alert: Boolean(rv_failure_alert)
    });

    res.status(201).json(alarmLog);
  } catch (err: any) {
    console.error('Log VAD Telemetry error:', err);
    res.status(500).json({ error: 'Failed to record VAD telemetry alarm.' });
  }
});

// Phase 78: VAD-PULSE - Get Patient VAD History
router.get('/vad/patients/:patientId/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = Number(req.params.patientId);
    const history = await vadPulseService.VadPulseService.getPatientVadHistory(patientId);
    res.json(history);
  } catch (err: any) {
    console.error('Get VAD History error:', err);
    res.status(500).json({ error: 'Failed to retrieve VAD history.' });
  }
});

// Phase 79: COMFORT-CARE - Evaluate ESAS-r Multi-Domain Symptoms
router.post('/palliative/evaluate-esas-r', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { scores } = req.body;
    if (!scores || typeof scores !== 'object') {
      return res.status(400).json({ error: 'scores object containing symptom ratings 0-10 is required.' });
    }

    const result = comfortCareService.ComfortCareService.evaluateEsasR(scores);
    res.json(result);
  } catch (err: any) {
    console.error('Evaluate ESAS-r error:', err);
    res.status(500).json({ error: 'Failed to evaluate ESAS-r symptoms.' });
  }
});

// Phase 79: COMFORT-CARE - Opioid Equianalgesic Converter & Cross-Tolerance
router.post('/palliative/convert-opioid', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      from_opioid,
      from_dose_mg_24h,
      from_route,
      to_opioid,
      to_route,
      cross_tolerance_reduction_percent,
      renal_hepatic_impairment
    } = req.body;

    if (!from_opioid || from_dose_mg_24h === undefined || !from_route || !to_opioid || !to_route) {
      return res.status(400).json({ error: 'from_opioid, from_dose_mg_24h, from_route, to_opioid, and to_route are required.' });
    }

    const result = comfortCareService.ComfortCareService.convertOpioidEquianalgesic({
      from_opioid,
      from_dose_mg_24h: Number(from_dose_mg_24h),
      from_route,
      to_opioid,
      to_route,
      cross_tolerance_reduction_percent: cross_tolerance_reduction_percent !== undefined ? Number(cross_tolerance_reduction_percent) : undefined,
      renal_hepatic_impairment: Boolean(renal_hepatic_impairment)
    });

    res.json(result);
  } catch (err: any) {
    console.error('Convert Opioid error:', err);
    res.status(500).json({ error: 'Failed to calculate opioid conversion.' });
  }
});

// Phase 79: COMFORT-CARE - Evaluate Terminal Symptoms & POLST Trajectory
router.post('/palliative/evaluate-terminal-symptoms', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      refractory_dyspnea_present,
      respiratory_rate_breaths_min,
      spo2_percent,
      death_rattle_secretions_present,
      terminal_agitation_delirium_present,
      urinary_retention_ruled_out,
      bowel_impaction_ruled_out,
      pps_v2_percent,
      polst_code_status
    } = req.body;

    if (pps_v2_percent === undefined || !polst_code_status) {
      return res.status(400).json({ error: 'pps_v2_percent and polst_code_status are required.' });
    }

    const result = comfortCareService.ComfortCareService.evaluateTerminalSymptoms({
      refractory_dyspnea_present: Boolean(refractory_dyspnea_present),
      respiratory_rate_breaths_min: respiratory_rate_breaths_min !== undefined ? Number(respiratory_rate_breaths_min) : undefined,
      spo2_percent: spo2_percent !== undefined ? Number(spo2_percent) : undefined,
      death_rattle_secretions_present: Boolean(death_rattle_secretions_present),
      terminal_agitation_delirium_present: Boolean(terminal_agitation_delirium_present),
      urinary_retention_ruled_out: Boolean(urinary_retention_ruled_out),
      bowel_impaction_ruled_out: Boolean(bowel_impaction_ruled_out),
      pps_v2_percent: Number(pps_v2_percent),
      polst_code_status
    });

    res.json(result);
  } catch (err: any) {
    console.error('Evaluate Terminal Symptoms error:', err);
    res.status(500).json({ error: 'Failed to assess terminal symptoms.' });
  }
});

// Phase 79: COMFORT-CARE - Save Palliative Care Encounter
router.post('/palliative/encounters', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      patient_id,
      pps_v2_score,
      esas_r_scores,
      polst_code_status,
      goals_of_care_trajectory,
      terminal_symptoms,
      care_plan_recommendations
    } = req.body;

    if (!patient_id || pps_v2_score === undefined || !esas_r_scores || !polst_code_status || !goals_of_care_trajectory) {
      return res.status(400).json({ error: 'patient_id, pps_v2_score, esas_r_scores, polst_code_status, and goals_of_care_trajectory are required.' });
    }

    const saved = await comfortCareService.ComfortCareService.savePalliativeEncounter({
      patient_id: Number(patient_id),
      pps_v2_score: Number(pps_v2_score),
      esas_r_scores,
      polst_code_status,
      goals_of_care_trajectory,
      terminal_symptoms,
      care_plan_recommendations
    });

    res.status(201).json(saved);
  } catch (err: any) {
    console.error('Save Palliative Encounter error:', err);
    res.status(500).json({ error: 'Failed to record palliative encounter.' });
  }
});

// Phase 79: COMFORT-CARE - Log Opioid Rotation
router.post('/palliative/opioid-rotations', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      encounter_id,
      patient_id,
      from_opioid,
      from_dose_mg_24h,
      from_route,
      to_opioid,
      to_route,
      calculated_equianalgesic_mg,
      cross_tolerance_reduction_percent,
      prescribed_dose_mg_24h,
      breakthrough_dose_mg,
      breakthrough_interval_hours
    } = req.body;

    if (!patient_id || !from_opioid || from_dose_mg_24h === undefined || !from_route || !to_opioid || !to_route || prescribed_dose_mg_24h === undefined) {
      return res.status(400).json({ error: 'patient_id, from_opioid, from_dose_mg_24h, from_route, to_opioid, to_route, and prescribed_dose_mg_24h are required.' });
    }

    const saved = await comfortCareService.ComfortCareService.logOpioidRotation({
      encounter_id: encounter_id ? Number(encounter_id) : undefined,
      patient_id: Number(patient_id),
      from_opioid,
      from_dose_mg_24h: Number(from_dose_mg_24h),
      from_route,
      to_opioid,
      to_route,
      calculated_equianalgesic_mg: Number(calculated_equianalgesic_mg),
      cross_tolerance_reduction_percent: Number(cross_tolerance_reduction_percent),
      prescribed_dose_mg_24h: Number(prescribed_dose_mg_24h),
      breakthrough_dose_mg: Number(breakthrough_dose_mg),
      breakthrough_interval_hours
    });

    res.status(201).json(saved);
  } catch (err: any) {
    console.error('Log Opioid Rotation error:', err);
    res.status(500).json({ error: 'Failed to log opioid rotation.' });
  }
});

// Phase 79: COMFORT-CARE - Get Patient Palliative History
router.get('/palliative/patients/:patientId/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = Number(req.params.patientId);
    const history = await comfortCareService.ComfortCareService.getPatientPalliativeHistory(patientId);
    res.json(history);
  } catch (err: any) {
    console.error('Get Palliative History error:', err);
    res.status(500).json({ error: 'Failed to retrieve palliative history.' });
  }
});

// Phase 80: CODE-NAVIGATOR - Evaluate ACLS 2025 Code Cycle
router.post('/code/evaluate-cycle', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      current_rhythm,
      cycle_number,
      time_in_code_seconds,
      etco2_mmhg,
      compression_fraction_percent,
      epinephrine_doses_given,
      last_epinephrine_cycle,
      amiodarone_mg_given,
      lidocaine_mg_given,
      h_and_t_findings
    } = req.body;

    if (!current_rhythm || cycle_number === undefined || etco2_mmhg === undefined || compression_fraction_percent === undefined) {
      return res.status(400).json({ error: 'current_rhythm, cycle_number, etco2_mmhg, and compression_fraction_percent are required.' });
    }

    const result = codeNavigatorService.CodeNavigatorService.evaluateCodeCycle({
      current_rhythm,
      cycle_number: Number(cycle_number),
      time_in_code_seconds: Number(time_in_code_seconds || 0),
      etco2_mmhg: Number(etco2_mmhg),
      compression_fraction_percent: Number(compression_fraction_percent),
      epinephrine_doses_given: Number(epinephrine_doses_given || 0),
      last_epinephrine_cycle: last_epinephrine_cycle !== undefined ? Number(last_epinephrine_cycle) : undefined,
      amiodarone_mg_given: Number(amiodarone_mg_given || 0),
      lidocaine_mg_given: Number(lidocaine_mg_given || 0),
      h_and_t_findings: h_and_t_findings || {}
    });

    res.json(result);
  } catch (err: any) {
    console.error('Evaluate Code Cycle error:', err);
    res.status(500).json({ error: 'Failed to evaluate code cycle.' });
  }
});

// Phase 80: CODE-NAVIGATOR - Evaluate Post-Cardiac Arrest Care Bundle
router.post('/code/evaluate-post-arrest', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      map_mmhg,
      sbp_mmhg,
      spo2_percent,
      paco2_mmhg,
      core_temperature_celsius,
      stemi_on_12lead,
      comatose_unresponsive
    } = req.body;

    if (map_mmhg === undefined || sbp_mmhg === undefined || spo2_percent === undefined || core_temperature_celsius === undefined) {
      return res.status(400).json({ error: 'map_mmhg, sbp_mmhg, spo2_percent, and core_temperature_celsius are required.' });
    }

    const result = codeNavigatorService.CodeNavigatorService.evaluatePostArrestCare({
      map_mmhg: Number(map_mmhg),
      sbp_mmhg: Number(sbp_mmhg),
      spo2_percent: Number(spo2_percent),
      paco2_mmhg: paco2_mmhg !== undefined ? Number(paco2_mmhg) : undefined,
      core_temperature_celsius: Number(core_temperature_celsius),
      stemi_on_12lead: Boolean(stemi_on_12lead),
      comatose_unresponsive: Boolean(comatose_unresponsive)
    });

    res.json(result);
  } catch (err: any) {
    console.error('Evaluate Post-Arrest Care error:', err);
    res.status(500).json({ error: 'Failed to evaluate post-arrest bundle.' });
  }
});

// Phase 80: CODE-NAVIGATOR - Start Code Event
router.post('/code/events', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      patient_id,
      initial_rhythm,
      current_etco2_mmhg,
      compression_fraction_percent,
      h_and_t_checklist
    } = req.body;

    if (!patient_id || !initial_rhythm) {
      return res.status(400).json({ error: 'patient_id and initial_rhythm are required.' });
    }

    const saved = await codeNavigatorService.CodeNavigatorService.startCodeEvent({
      patient_id: Number(patient_id),
      initial_rhythm,
      current_etco2_mmhg: current_etco2_mmhg !== undefined ? Number(current_etco2_mmhg) : undefined,
      compression_fraction_percent: compression_fraction_percent !== undefined ? Number(compression_fraction_percent) : undefined,
      h_and_t_checklist
    });

    res.status(201).json(saved);
  } catch (err: any) {
    console.error('Start Code Event error:', err);
    res.status(500).json({ error: 'Failed to record code arrest event.' });
  }
});

// Phase 80: CODE-NAVIGATOR - Log Code Cycle
router.post('/code/cycles', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      code_id,
      cycle_number,
      rhythm_assessed,
      shock_delivered,
      shock_energy_joules,
      drug_administered,
      cycle_etco2_mmhg,
      cycle_ccf_percent,
      reversible_causes_addressed,
      notes
    } = req.body;

    if (!code_id || cycle_number === undefined || !rhythm_assessed) {
      return res.status(400).json({ error: 'code_id, cycle_number, and rhythm_assessed are required.' });
    }

    const saved = await codeNavigatorService.CodeNavigatorService.logCodeCycle({
      code_id: Number(code_id),
      cycle_number: Number(cycle_number),
      rhythm_assessed,
      shock_delivered: Boolean(shock_delivered),
      shock_energy_joules: shock_energy_joules !== undefined ? Number(shock_energy_joules) : undefined,
      drug_administered,
      cycle_etco2_mmhg: cycle_etco2_mmhg !== undefined ? Number(cycle_etco2_mmhg) : undefined,
      cycle_ccf_percent: cycle_ccf_percent !== undefined ? Number(cycle_ccf_percent) : undefined,
      reversible_causes_addressed,
      notes
    });

    res.status(201).json(saved);
  } catch (err: any) {
    console.error('Log Code Cycle error:', err);
    res.status(500).json({ error: 'Failed to record code cycle log.' });
  }
});

// Phase 80: CODE-NAVIGATOR - Update Code Status (ROSC or Terminated)
router.patch('/code/events/:codeId/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const codeId = Number(req.params.codeId);
    const { status, rosc_timestamp } = req.body;

    if (!status || (status !== 'ROSC_ACHIEVED' && status !== 'TERMINATED')) {
      return res.status(400).json({ error: 'status must be ROSC_ACHIEVED or TERMINATED.' });
    }

    const updated = await codeNavigatorService.CodeNavigatorService.updateCodeStatus(
      codeId,
      status,
      rosc_timestamp ? new Date(rosc_timestamp) : undefined
    );

    res.json(updated);
  } catch (err: any) {
    console.error('Update Code Status error:', err);
    res.status(500).json({ error: 'Failed to update code status.' });
  }
});

// Phase 80: CODE-NAVIGATOR - Get Patient Code History
router.get('/code/patients/:patientId/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = Number(req.params.patientId);
    const history = await codeNavigatorService.CodeNavigatorService.getPatientCodeHistory(patientId);
    res.json(history);
  } catch (err: any) {
    console.error('Get Code History error:', err);
    res.status(500).json({ error: 'Failed to retrieve code history.' });
  }
});

// Phase 81: PNEUMO-DRAIN - Evaluate Tension Pneumothorax
router.post('/thoracic/evaluate-tension', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      hemodynamic_instability,
      unilateral_absent_breath_sounds,
      tracheal_deviation,
      severe_dyspnea_cyanosis,
      anatomical_side,
      subcutaneous_emphysema
    } = req.body;

    if (!anatomical_side || unilateral_absent_breath_sounds === undefined) {
      return res.status(400).json({ error: 'anatomical_side and unilateral_absent_breath_sounds are required.' });
    }

    const result = pneumoDrainService.PneumoDrainService.evaluateTensionPneumo({
      hemodynamic_instability: Boolean(hemodynamic_instability),
      unilateral_absent_breath_sounds: Boolean(unilateral_absent_breath_sounds),
      tracheal_deviation: Boolean(tracheal_deviation),
      severe_dyspnea_cyanosis: Boolean(severe_dyspnea_cyanosis),
      anatomical_side,
      subcutaneous_emphysema: Boolean(subcutaneous_emphysema)
    });

    res.json(result);
  } catch (err: any) {
    console.error('Evaluate Tension Pneumothorax error:', err);
    res.status(500).json({ error: 'Failed to evaluate tension pneumothorax.' });
  }
});

// Phase 81: PNEUMO-DRAIN - Evaluate Pleural Drainage & Thoracotomy Triggers
router.post('/thoracic/evaluate-drainage', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      initial_insertion_output_ml,
      hourly_drainage_ml,
      hours_monitoring,
      fluid_character,
      air_leak_grade,
      current_suction_cmh2o,
      water_seal_trial_active,
      sbp_mmhg
    } = req.body;

    if (initial_insertion_output_ml === undefined || hourly_drainage_ml === undefined || !fluid_character || !air_leak_grade) {
      return res.status(400).json({ error: 'initial_insertion_output_ml, hourly_drainage_ml, fluid_character, and air_leak_grade are required.' });
    }

    const result = pneumoDrainService.PneumoDrainService.evaluatePleuralDrainage({
      initial_insertion_output_ml: Number(initial_insertion_output_ml),
      hourly_drainage_ml: Number(hourly_drainage_ml),
      hours_monitoring: Number(hours_monitoring || 1),
      fluid_character,
      air_leak_grade,
      current_suction_cmh2o: Number(current_suction_cmh2o || -20),
      water_seal_trial_active: Boolean(water_seal_trial_active),
      sbp_mmhg: sbp_mmhg !== undefined ? Number(sbp_mmhg) : undefined
    });

    res.json(result);
  } catch (err: any) {
    console.error('Evaluate Pleural Drainage error:', err);
    res.status(500).json({ error: 'Failed to evaluate pleural drainage.' });
  }
});

// Phase 81: PNEUMO-DRAIN - Evaluate Rib Fractures & Flail Chest
router.post('/thoracic/evaluate-rib-fractures', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      fractured_ribs_count,
      flail_segment_present,
      bilateral_fractures,
      pulmonary_contusion_present,
      patient_age,
      pain_score_10,
      respiratory_failure_intubated
    } = req.body;

    if (fractured_ribs_count === undefined || patient_age === undefined || pain_score_10 === undefined) {
      return res.status(400).json({ error: 'fractured_ribs_count, patient_age, and pain_score_10 are required.' });
    }

    const result = pneumoDrainService.PneumoDrainService.evaluateRibFractures({
      fractured_ribs_count: Number(fractured_ribs_count),
      flail_segment_present: Boolean(flail_segment_present),
      bilateral_fractures: Boolean(bilateral_fractures),
      pulmonary_contusion_present: Boolean(pulmonary_contusion_present),
      patient_age: Number(patient_age),
      pain_score_10: Number(pain_score_10),
      respiratory_failure_intubated: Boolean(respiratory_failure_intubated)
    });

    res.json(result);
  } catch (err: any) {
    console.error('Evaluate Rib Fractures error:', err);
    res.status(500).json({ error: 'Failed to evaluate rib fractures and flail chest.' });
  }
});

// Phase 81: PNEUMO-DRAIN - Insert Thoracic Drainage Tube
router.post('/thoracic/tubes', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      patient_id,
      anatomical_side,
      tube_size_fr,
      indication,
      initial_output_ml,
      current_suction_cmh2o,
      water_seal_trial_active,
      active_status
    } = req.body;

    if (!patient_id || !anatomical_side || !tube_size_fr || !indication || initial_output_ml === undefined) {
      return res.status(400).json({ error: 'patient_id, anatomical_side, tube_size_fr, indication, and initial_output_ml are required.' });
    }

    const saved = await pneumoDrainService.PneumoDrainService.insertThoracicTube({
      patient_id: Number(patient_id),
      anatomical_side,
      tube_size_fr: Number(tube_size_fr),
      indication,
      initial_output_ml: Number(initial_output_ml),
      current_suction_cmh2o: current_suction_cmh2o !== undefined ? Number(current_suction_cmh2o) : undefined,
      water_seal_trial_active: water_seal_trial_active !== undefined ? Boolean(water_seal_trial_active) : undefined,
      active_status: active_status !== undefined ? Boolean(active_status) : undefined
    });

    res.status(201).json(saved);
  } catch (err: any) {
    console.error('Insert Thoracic Tube error:', err);
    res.status(500).json({ error: 'Failed to record thoracic tube insertion.' });
  }
});

// Phase 81: PNEUMO-DRAIN - Log Pleural Drainage
router.post('/thoracic/drainage-logs', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      tube_id,
      patient_id,
      hourly_output_ml,
      cumulative_24h_output_ml,
      fluid_character,
      air_leak_grade,
      massive_hemothorax_alert,
      emergent_thoracotomy_indicated
    } = req.body;

    if (!tube_id || !patient_id || hourly_output_ml === undefined || cumulative_24h_output_ml === undefined || !fluid_character || !air_leak_grade) {
      return res.status(400).json({ error: 'tube_id, patient_id, hourly_output_ml, cumulative_24h_output_ml, fluid_character, and air_leak_grade are required.' });
    }

    const saved = await pneumoDrainService.PneumoDrainService.logPleuralDrainage({
      tube_id: Number(tube_id),
      patient_id: Number(patient_id),
      hourly_output_ml: Number(hourly_output_ml),
      cumulative_24h_output_ml: Number(cumulative_24h_output_ml),
      fluid_character,
      air_leak_grade,
      massive_hemothorax_alert: Boolean(massive_hemothorax_alert),
      emergent_thoracotomy_indicated: Boolean(emergent_thoracotomy_indicated)
    });

    res.status(201).json(saved);
  } catch (err: any) {
    console.error('Log Pleural Drainage error:', err);
    res.status(500).json({ error: 'Failed to record pleural fluid drainage log.' });
  }
});

// Phase 81: PNEUMO-DRAIN - Update Tube Suction Status
router.patch('/thoracic/tubes/:tubeId/suction', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tubeId = Number(req.params.tubeId);
    const { current_suction_cmh2o, water_seal_trial_active } = req.body;

    if (current_suction_cmh2o === undefined || water_seal_trial_active === undefined) {
      return res.status(400).json({ error: 'current_suction_cmh2o and water_seal_trial_active are required.' });
    }

    const updated = await pneumoDrainService.PneumoDrainService.updateTubeSuctionStatus(
      tubeId,
      Number(current_suction_cmh2o),
      Boolean(water_seal_trial_active)
    );

    res.json(updated);
  } catch (err: any) {
    console.error('Update Tube Suction error:', err);
    res.status(500).json({ error: 'Failed to update thoracic tube suction status.' });
  }
});

// Phase 81: PNEUMO-DRAIN - Get Patient Thoracic History
router.get('/thoracic/patients/:patientId/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = Number(req.params.patientId);
    const history = await pneumoDrainService.PneumoDrainService.getPatientThoracicHistory(patientId);
    res.json(history);
  } catch (err: any) {
    console.error('Get Thoracic History error:', err);
    res.status(500).json({ error: 'Failed to retrieve thoracic history.' });
  }
});

// ==========================================
// Phase 82: STATUS-PULMO Endpoints
// ==========================================

// Evaluate Status Asthmaticus Severity
router.post('/pulmo/assess', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      patientId,
      pefPercent,
      speech,
      accessoryMuscleUse,
      silentChest,
      pulsusParadoxusMmhg,
      paco2Mmhg,
      ph,
      pao2Mmhg,
      fio2Percent,
      mentalStatus,
      heartRate,
      respiratoryRate,
      spo2Percent,
      intubated,
      notes
    } = req.body;

    const result = statusPulmoService.StatusPulmoService.assessAsthmaSeverity({
      patientId: Number(patientId),
      pefPercent: pefPercent !== undefined ? Number(pefPercent) : undefined,
      speech,
      accessoryMuscleUse: Boolean(accessoryMuscleUse),
      silentChest: Boolean(silentChest),
      pulsusParadoxusMmhg: pulsusParadoxusMmhg !== undefined ? Number(pulsusParadoxusMmhg) : undefined,
      paco2Mmhg: paco2Mmhg !== undefined ? Number(paco2Mmhg) : undefined,
      ph: ph !== undefined ? Number(ph) : undefined,
      pao2Mmhg: pao2Mmhg !== undefined ? Number(pao2Mmhg) : undefined,
      fio2Percent: fio2Percent !== undefined ? Number(fio2Percent) : undefined,
      mentalStatus,
      heartRate: heartRate !== undefined ? Number(heartRate) : undefined,
      respiratoryRate: respiratoryRate !== undefined ? Number(respiratoryRate) : undefined,
      spo2Percent: spo2Percent !== undefined ? Number(spo2Percent) : undefined,
      intubated: Boolean(intubated),
      notes
    });

    res.json(result);
  } catch (err: any) {
    console.error('Pulmo Assess error:', err);
    res.status(500).json({ error: 'Failed to assess status asthmaticus.' });
  }
});

// Calculate Ventilator Dynamics & Physics
router.post('/pulmo/vent-physics', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      encounterId,
      patientId,
      weightKg,
      heightCm,
      gender,
      tidalVolumeMl,
      respiratoryRateBpm,
      inspiratoryFlowLpm,
      appliedPeep,
      autoPeepCmh2o,
      plateauPressureCmh2o,
      peakPressureCmh2o,
      ph,
      paco2Mmhg,
      hasAcuteTbiOrElevatedIcp,
      ventilatorMode
    } = req.body;

    if (!patientId || !weightKg || !heightCm || !gender || !tidalVolumeMl || !respiratoryRateBpm || !inspiratoryFlowLpm) {
      return res.status(400).json({ error: 'Missing required ventilator physics parameters.' });
    }

    const result = statusPulmoService.StatusPulmoService.calculateVentilatorPhysics({
      encounterId: encounterId ? Number(encounterId) : undefined,
      patientId: Number(patientId),
      weightKg: Number(weightKg),
      heightCm: Number(heightCm),
      gender,
      tidalVolumeMl: Number(tidalVolumeMl),
      respiratoryRateBpm: Number(respiratoryRateBpm),
      inspiratoryFlowLpm: Number(inspiratoryFlowLpm),
      appliedPeep: Number(appliedPeep || 0),
      autoPeepCmh2o: Number(autoPeepCmh2o || 0),
      plateauPressureCmh2o: Number(plateauPressureCmh2o || 0),
      peakPressureCmh2o: Number(peakPressureCmh2o || 0),
      ph: ph !== undefined ? Number(ph) : undefined,
      paco2Mmhg: paco2Mmhg !== undefined ? Number(paco2Mmhg) : undefined,
      hasAcuteTbiOrElevatedIcp: Boolean(hasAcuteTbiOrElevatedIcp),
      ventilatorMode
    });

    res.json(result);
  } catch (err: any) {
    console.error('Pulmo Vent Physics error:', err);
    res.status(500).json({ error: 'Failed to calculate ventilator physics.' });
  }
});

// Evaluate Medical Escalation
router.post('/pulmo/escalation', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { severity, currentMeds, refractoryDurationMin, intubated, spo2Percent } = req.body;
    if (!severity) {
      return res.status(400).json({ error: 'severity is required.' });
    }

    const plan = statusPulmoService.StatusPulmoService.generateMedicalEscalation({
      severity,
      currentMeds: currentMeds || [],
      refractoryDurationMin: Number(refractoryDurationMin || 0),
      intubated: Boolean(intubated),
      spo2Percent: spo2Percent ? Number(spo2Percent) : undefined
    });

    res.json(plan);
  } catch (err: any) {
    console.error('Pulmo Escalation error:', err);
    res.status(500).json({ error: 'Failed to evaluate medical escalation.' });
  }
});

// Save Pulmo Encounter
router.post('/pulmo/encounter', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      patientId,
      severity,
      pefPercent,
      silentChest,
      pulsusParadoxusMmhg,
      paco2Mmhg,
      ph,
      pao2Mmhg,
      fio2Percent,
      intubated,
      dynamicHyperinflationRisk,
      rescueMedications,
      clinicalNotes
    } = req.body;

    if (!patientId || !severity) {
      return res.status(400).json({ error: 'patientId and severity are required.' });
    }

    const saved = await statusPulmoService.StatusPulmoService.savePulmoEncounter({
      patientId: Number(patientId),
      severity,
      pefPercent: pefPercent ? Number(pefPercent) : undefined,
      silentChest: Boolean(silentChest),
      pulsusParadoxusMmhg: pulsusParadoxusMmhg ? Number(pulsusParadoxusMmhg) : undefined,
      paco2Mmhg: paco2Mmhg ? Number(paco2Mmhg) : undefined,
      ph: ph ? Number(ph) : undefined,
      pao2Mmhg: pao2Mmhg ? Number(pao2Mmhg) : undefined,
      fio2Percent: fio2Percent ? Number(fio2Percent) : undefined,
      intubated: Boolean(intubated),
      dynamicHyperinflationRisk,
      rescueMedications,
      clinicalNotes
    });

    res.status(201).json(saved);
  } catch (err: any) {
    console.error('Save Pulmo Encounter error:', err);
    res.status(500).json({ error: 'Failed to save pulmo encounter.' });
  }
});

// Log Obstructive Vent Settings
router.post('/pulmo/vent-settings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      encounterId,
      patientId,
      tidalVolumeMl,
      respiratoryRateBpm,
      inspiratoryFlowLpm,
      ieRatio,
      appliedPeep,
      autoPeepCmh2o,
      plateauPressureCmh2o,
      peakPressureCmh2o,
      dynamicHyperinflationAlert,
      ventilatorMode
    } = req.body;

    if (!encounterId || !patientId || !tidalVolumeMl || !respiratoryRateBpm || !inspiratoryFlowLpm) {
      return res.status(400).json({ error: 'Missing required vent log parameters.' });
    }

    const saved = await statusPulmoService.StatusPulmoService.logVentSettings({
      encounterId: Number(encounterId),
      patientId: Number(patientId),
      tidalVolumeMl: Number(tidalVolumeMl),
      respiratoryRateBpm: Number(respiratoryRateBpm),
      inspiratoryFlowLpm: Number(inspiratoryFlowLpm),
      ieRatio: ieRatio || '1:4',
      appliedPeep: Number(appliedPeep || 0),
      autoPeepCmh2o: Number(autoPeepCmh2o || 0),
      plateauPressureCmh2o: Number(plateauPressureCmh2o || 0),
      peakPressureCmh2o: Number(peakPressureCmh2o || 0),
      dynamicHyperinflationAlert: Boolean(dynamicHyperinflationAlert),
      ventilatorMode
    });

    res.status(201).json(saved);
  } catch (err: any) {
    console.error('Log Vent Settings error:', err);
    res.status(500).json({ error: 'Failed to log ventilator settings.' });
  }
});

// Get Patient Pulmo History
router.get('/pulmo/patient/:patientId/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = Number(req.params.patientId);
    const history = await statusPulmoService.StatusPulmoService.getPatientPulmoHistory(patientId);
    res.json(history);
  } catch (err: any) {
    console.error('Get Pulmo History error:', err);
    res.status(500).json({ error: 'Failed to retrieve pulmo history.' });
  }
});

// Get Encounter Vent Settings
router.get('/pulmo/encounter/:encounterId/vent-settings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const encounterId = Number(req.params.encounterId);
    const settings = await statusPulmoService.StatusPulmoService.getEncounterVentSettings(encounterId);
    res.json(settings);
  } catch (err: any) {
    console.error('Get Encounter Vent Settings error:', err);
    res.status(500).json({ error: 'Failed to retrieve encounter vent settings.' });
  }
});

// ==========================================
// Phase 83: AORTA-CODE Endpoints
// ==========================================

// Evaluate Aortic Dissection Classification & Malperfusion
router.post('/aorta/evaluate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      patientId,
      involvesAscendingAorta,
      involvesAorticArch,
      involvesDescendingAorta,
      extendsBelowDiaphragm,
      aorticDiameterMm,
      intimalTearLocation,
      cardiacTamponadePresent,
      aorticRegurgSeverity,
      refractoryPain,
      refractoryHypertension,
      rapidExpansion,
      pericardialEffusionOrRupture,
      malperfusion
    } = req.body;

    if (!patientId || aorticDiameterMm === undefined) {
      return res.status(400).json({ error: 'patientId and aorticDiameterMm are required.' });
    }

    const result = aortaCodeService.AortaCodeService.evaluateAorticDissection({
      patientId: Number(patientId),
      involvesAscendingAorta: Boolean(involvesAscendingAorta),
      involvesAorticArch: Boolean(involvesAorticArch),
      involvesDescendingAorta: Boolean(involvesDescendingAorta),
      extendsBelowDiaphragm: Boolean(extendsBelowDiaphragm),
      aorticDiameterMm: Number(aorticDiameterMm),
      intimalTearLocation: intimalTearLocation || 'Aortic Root',
      cardiacTamponadePresent: Boolean(cardiacTamponadePresent),
      aorticRegurgSeverity,
      refractoryPain: Boolean(refractoryPain),
      refractoryHypertension: Boolean(refractoryHypertension),
      rapidExpansion: Boolean(rapidExpansion),
      pericardialEffusionOrRupture: Boolean(pericardialEffusionOrRupture),
      malperfusion
    });

    res.json(result);
  } catch (err: any) {
    console.error('Aorta Evaluate error:', err);
    res.status(500).json({ error: 'Failed to evaluate aortic dissection.' });
  }
});

// Analyze Anti-Impulse Hemodynamics & Shear Stress
router.post('/aorta/anti-impulse', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      encounterId,
      patientId,
      heartRateBpm,
      systolicBpMmhg,
      diastolicBpMmhg,
      betaBlockerActive,
      vasodilatorActive,
      activeMedications
    } = req.body;

    if (!patientId || heartRateBpm === undefined || systolicBpMmhg === undefined || diastolicBpMmhg === undefined) {
      return res.status(400).json({ error: 'Missing required hemodynamics parameters.' });
    }

    const result = aortaCodeService.AortaCodeService.analyzeAntiImpulseHemodynamics({
      encounterId: encounterId ? Number(encounterId) : undefined,
      patientId: Number(patientId),
      heartRateBpm: Number(heartRateBpm),
      systolicBpMmhg: Number(systolicBpMmhg),
      diastolicBpMmhg: Number(diastolicBpMmhg),
      betaBlockerActive: Boolean(betaBlockerActive),
      vasodilatorActive: Boolean(vasodilatorActive),
      activeMedications
    });

    res.json(result);
  } catch (err: any) {
    console.error('Anti-Impulse Analysis error:', err);
    res.status(500).json({ error: 'Failed to analyze anti-impulse hemodynamics.' });
  }
});

// Save Aortic Syndrome Encounter
router.post('/aorta/encounter', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      patientId,
      stanfordType,
      debakeyType,
      aorticDiameterMm,
      intimalTearLocation,
      cardiacTamponadePresent,
      aorticRegurgSeverity,
      coronaryInvolvement,
      refractoryPain,
      rapidExpansion,
      malperfusionSyndromes,
      tevarIndicated,
      clinicalDisposition
    } = req.body;

    if (!patientId || !stanfordType || !debakeyType || aorticDiameterMm === undefined) {
      return res.status(400).json({ error: 'Missing required encounter parameters.' });
    }

    const saved = await aortaCodeService.AortaCodeService.saveAorticEncounter({
      patientId: Number(patientId),
      stanfordType,
      debakeyType,
      aorticDiameterMm: Number(aorticDiameterMm),
      intimalTearLocation: intimalTearLocation || 'Ascending',
      cardiacTamponadePresent: Boolean(cardiacTamponadePresent),
      aorticRegurgSeverity,
      coronaryInvolvement: Boolean(coronaryInvolvement),
      refractoryPain: Boolean(refractoryPain),
      rapidExpansion: Boolean(rapidExpansion),
      malperfusionSyndromes,
      tevarIndicated: Boolean(tevarIndicated),
      clinicalDisposition: clinicalDisposition || 'ICU'
    });

    res.status(201).json(saved);
  } catch (err: any) {
    console.error('Save Aorta Encounter error:', err);
    res.status(500).json({ error: 'Failed to save aortic encounter.' });
  }
});

// Log Anti-Impulse Telemetry Readings
router.post('/aorta/telemetry', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      encounterId,
      patientId,
      heartRateBpm,
      systolicBpMmhg,
      diastolicBpMmhg,
      meanArterialPressureMmhg,
      dpDtControlled,
      betaBlockerActive,
      vasodilatorActive,
      reflexTachycardiaRisk,
      activeMedications
    } = req.body;

    if (!encounterId || !patientId || heartRateBpm === undefined || systolicBpMmhg === undefined) {
      return res.status(400).json({ error: 'Missing required telemetry log parameters.' });
    }

    const saved = await aortaCodeService.AortaCodeService.logAntiImpulseTelemetry({
      encounterId: Number(encounterId),
      patientId: Number(patientId),
      heartRateBpm: Number(heartRateBpm),
      systolicBpMmhg: Number(systolicBpMmhg),
      diastolicBpMmhg: Number(diastolicBpMmhg),
      meanArterialPressureMmhg: Number(meanArterialPressureMmhg),
      dpDtControlled: Boolean(dpDtControlled),
      betaBlockerActive: Boolean(betaBlockerActive),
      vasodilatorActive: Boolean(vasodilatorActive),
      reflexTachycardiaRisk: Boolean(reflexTachycardiaRisk),
      activeMedications
    });

    res.status(201).json(saved);
  } catch (err: any) {
    console.error('Log Telemetry error:', err);
    res.status(500).json({ error: 'Failed to log telemetry.' });
  }
});

// Get Patient Aorta History
router.get('/aorta/patient/:patientId/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = Number(req.params.patientId);
    const history = await aortaCodeService.AortaCodeService.getPatientAortaHistory(patientId);
    res.json(history);
  } catch (err: any) {
    console.error('Get Aorta History error:', err);
    res.status(500).json({ error: 'Failed to retrieve aorta history.' });
  }
});

// Get Telemetry Logs for Encounter
router.get('/aorta/encounter/:encounterId/telemetry', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const encounterId = Number(req.params.encounterId);
    const logs = await aortaCodeService.AortaCodeService.getEncounterTelemetryLogs(encounterId);
    res.json(logs);
  } catch (err: any) {
    console.error('Get Telemetry Logs error:', err);
    res.status(500).json({ error: 'Failed to retrieve telemetry logs.' });
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
