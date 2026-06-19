import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth';
import { AIService, ChatMessage } from '../services/ai';
import { GuardrailsService } from '../services/guardrails';

const router = Router();

const GREETINGS: Record<string, string> = {
  'en-US': "Hello! I am IntakeRx, your clinic's AI patient intake assistant. I will help gather your medical history, chief complaint, and basic details before your visit. To start, please describe what symptoms or issues you are experiencing today.",
  'es-ES': "¡Hola! Soy IntakeRx, el asistente de admisión de pacientes con IA de su clínica. Le ayudaré a recopilar su historial médico, queja principal y detalles básicos antes de su visita. Para comenzar, describa qué síntomas o problemas está experimentando hoy.",
  'fr-FR': "Bonjour ! Je suis IntakeRx, l'assistant IA d'admission des patients de votre clinique. Je vais vous aider à recueillir vos antécédents médicaux, votre motif de consultation principal et vos informations de base avant votre visite. Pour commencer, veuillez décrire les symptômes ou les problèmes que vous rencontrez aujourd'hui.",
  'zh-CN': "您好！我是 IntakeRx，我们诊所的 AI 患者接诊助手。在您就诊前，我将帮助收集您的病史、主诉和基本信息。首先，请描述您今天遇到的症状或问题。"
};

// Create new session
router.post('/sessions', authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  const { preferredLanguage = 'en-US' } = req.body;
  const sessionId = uuidv4();

  try {
    await pool.query(
      `INSERT INTO intake_sessions (id, patient_id, status, current_step, preferred_language)
       VALUES ($1, $2, $3, $4, $5)`,
      [sessionId, req.user.id, 'active', 'complaint', preferredLanguage]
    );

    // Initial system greeting message
    const welcomeText = GREETINGS[preferredLanguage] || GREETINGS['en-US'];
    await pool.query(
      `INSERT INTO messages (session_id, sender, content)
       VALUES ($1, $2, $3)`,
      [sessionId, 'agent', welcomeText]
    );

    res.status(201).json({
      id: sessionId,
      status: 'active',
      currentStep: 'complaint',
      welcomeMessage: welcomeText,
      preferredLanguage
    });
  } catch (err) {
    console.error('Create session error:', err);
    res.status(500).json({ error: 'Failed to create intake session.' });
  }
});

// Get all sessions
router.get('/sessions', authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  try {
    let result;
    if (req.user.role === 'clinician') {
      // Clinician gets all sessions + patient name
      result = await pool.query(
        `SELECT s.id, s.status, s.current_step as "currentStep", s.triage_level as "triageLevel", 
                s.triage_rationale as "triageRationale", s.created_at as "createdAt", s.updated_at as "updatedAt",
                p.name as "patientName", p.dob as "patientDob", p.sex as "patientSex"
         FROM intake_sessions s
         JOIN patients p ON s.patient_id = p.id
         ORDER BY s.updated_at DESC`
      );
    } else {
      // Patient gets their own sessions
      result = await pool.query(
        `SELECT id, status, current_step as "currentStep", triage_level as "triageLevel", 
                triage_rationale as "triageRationale", created_at as "createdAt", updated_at as "updatedAt"
         FROM intake_sessions s
         WHERE s.patient_id = $1
         ORDER BY s.updated_at DESC`,
        [req.user.id]
      );
    }

    res.json(result.rows);
  } catch (err) {
    console.error('Get sessions error:', err);
    res.status(500).json({ error: 'Failed to retrieve sessions.' });
  }
});

// Get session detail with messages, symptoms, meds, summary
router.get('/sessions/:id', authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  const id = req.params.id as string;

  try {
    // 1. Get session metadata & patient details
    const sessionRes = await pool.query(
      `SELECT s.id, s.status, s.current_step as "currentStep", s.triage_level as "triageLevel", 
              s.triage_rationale as "triageRationale", s.created_at as "createdAt", s.updated_at as "updatedAt",
              s.patient_id as "patientId", s.preferred_language as "preferredLanguage",
              p.name as "patientName", p.dob as "patientDob", p.sex as "patientSex",
              p.insurance_provider as "insuranceProvider", p.insurance_policy as "insurancePolicy"
       FROM intake_sessions s
       JOIN patients p ON s.patient_id = p.id
       WHERE s.id = $1`,
      [id]
    );

    if (sessionRes.rowCount === 0) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }

    const session = sessionRes.rows[0];

    // Access control: Patients can only access their own sessions
    if (req.user.role === 'patient' && session.patientId !== req.user.id) {
      res.status(403).json({ error: 'Forbidden.' });
      return;
    }

    // 2. Get messages
    const messagesRes = await pool.query(
      `SELECT id, sender, content, was_flagged as "wasFlagged", blocked_by_guardrail as "blockedByGuardrail", created_at as "createdAt"
       FROM messages
       WHERE session_id = $1
       ORDER BY created_at ASC`,
      [id]
    );

    // 3. Get symptoms
    const symptomsRes = await pool.query(
      `SELECT id, name, severity, duration, is_red_flag as "isRedFlag"
       FROM symptoms
       WHERE session_id = $1`,
      [id]
    );

    // 4. Get medications
    const medsRes = await pool.query(
      `SELECT id, name, dosage, frequency
       FROM medications
       WHERE session_id = $1`,
      [id]
    );

    // 5. Get summary (if exists)
    const summaryRes = await pool.query(
      `SELECT summary_data as "summaryData", confirmed_at as "confirmedAt", status, ehr_sync_id as "ehrSyncId"
       FROM intake_summaries
       WHERE session_id = $1`,
      [id]
    );

    res.json({
      session: {
        id: session.id,
        status: session.status,
        currentStep: session.currentStep,
        triageLevel: session.triageLevel,
        triageRationale: session.triageRationale,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        patientName: session.patientName,
        patientDob: session.patientDob,
        patientSex: session.patientSex,
        insuranceProvider: session.insuranceProvider,
        insurancePolicy: session.insurancePolicy,
        preferredLanguage: session.preferredLanguage,
      },
      messages: messagesRes.rows,
      symptoms: symptomsRes.rows,
      medications: medsRes.rows,
      summary: summaryRes.rowCount && summaryRes.rowCount > 0 ? summaryRes.rows[0] : null,
    });
  } catch (err) {
    console.error('Get session detail error:', err);
    res.status(500).json({ error: 'Failed to retrieve session details.' });
  }
});

// Post message (intake chat engine)
router.post('/sessions/:id/messages', authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  const id = req.params.id as string;
  const { content } = req.body;

  if (!content || !content.trim()) {
    res.status(400).json({ error: 'Message content is required.' });
    return;
  }

  try {
    // 1. Fetch Session Info
    const sessionRes = await pool.query(
      `SELECT s.id, s.status, s.current_step as "currentStep", s.patient_id as "patientId",
              s.preferred_language as "preferredLanguage",
              p.name as "patientName", p.dob as "patientDob", p.sex as "patientSex"
       FROM intake_sessions s
       JOIN patients p ON s.patient_id = p.id
       WHERE s.id = $1`,
      [id]
    );

    if (sessionRes.rowCount === 0) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }

    const session = sessionRes.rows[0];

    if (req.user.role === 'patient' && session.patientId !== req.user.id) {
      res.status(403).json({ error: 'Forbidden.' });
      return;
    }

    if (session.status === 'escalated' || session.status === 'completed') {
      res.status(400).json({ error: 'This session has been closed or escalated to clinical staff.' });
      return;
    }

    // 2. Input Guardrail Layer (Prompt Injection Scanner)
    const inputGuard = await GuardrailsService.scanInputForInjection(content, id);
    if (inputGuard.isBlocked) {
      // Save patient blocked input
      await pool.query(
        `INSERT INTO messages (session_id, sender, content, was_flagged, blocked_by_guardrail)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, 'patient', content, true, true]
      );

      // Save standard block reply
      const blockReply = "I am sorry, but I cannot perform that action or answer that question. I am here solely to collect your symptoms and medical history for the clinic. Please tell me about your symptoms.";
      const savedReply = await pool.query(
        `INSERT INTO messages (session_id, sender, content)
         VALUES ($1, $2, $3) RETURNING *`,
        [id, 'agent', blockReply]
      );

      res.json({
        reply: savedReply.rows[0],
        session: { id, status: session.status, currentStep: session.currentStep },
      });
      return;
    }

    // 3. Evaluate Red Flags (Emergency Escalation)
    const redFlagEval = GuardrailsService.evaluateRedFlags(content);
    if (redFlagEval.isRedFlag) {
      // Save patient message
      await pool.query(
        `INSERT INTO messages (session_id, sender, content, was_flagged)
         VALUES ($1, $2, $3, $4)`,
        [id, 'patient', content, true]
      );

      // Save escalation reply
      const savedReply = await pool.query(
        `INSERT INTO messages (session_id, sender, content)
         VALUES ($1, $2, $3) RETURNING *`,
        [id, 'agent', redFlagEval.warningMessage]
      );

      // Update session status in DB
      await pool.query(
        `UPDATE intake_sessions 
         SET status = 'escalated', triage_level = 'emergency', triage_rationale = $2, updated_at = NOW()
         WHERE id = $1`,
        [id, `Emergency red flags matched: ${content}`]
      );

      res.json({
        reply: savedReply.rows[0],
        session: { id, status: 'escalated', currentStep: session.currentStep, triageLevel: 'emergency' },
      });
      return;
    }

    // Save standard patient message
    await pool.query(
      `INSERT INTO messages (session_id, sender, content)
       VALUES ($1, $2, $3)`,
      [id, 'patient', content]
    );

    // 4. Retrieve Clinical Protocol context via RAG
    let protocolContext = '';
    try {
      // Find the chief complaint text from patient's messages
      const complaintRes = await pool.query(
        `SELECT content FROM messages WHERE session_id = $1 AND sender = 'patient' ORDER BY created_at ASC LIMIT 1`,
        [id]
      );
      const queryText = complaintRes.rows[0]?.content || content;

      const queryEmbedding = await AIService.getEmbedding(queryText);
      const vectorStr = '[' + queryEmbedding.join(',') + ']';
      
      const pgVectorResult = await pool.query(
        `SELECT title, content, (embedding <=> $1::vector) as distance 
         FROM protocol_embeddings 
         ORDER BY embedding <=> $1::vector 
         LIMIT 1`,
        [vectorStr]
      );

      if (pgVectorResult.rowCount && pgVectorResult.rowCount > 0) {
        const matched = pgVectorResult.rows[0];
        // Only inject if distance threshold indicates a reasonable match (< 0.65)
        if (matched.distance < 0.65) {
          protocolContext = `CLINICAL PROTOCOL MATCHED: ${matched.title}\n${matched.content}\n\n`;
          console.log(`[RAG Match] Protocol: ${matched.title}, Distance: ${matched.distance}`);
        }
      }
    } catch (ragErr) {
      console.error('RAG protocol matching failed:', ragErr);
      // Fallback gracefully without breaking intake flow
    }

    // 5. Build AI Session Context & History
    const chatHistoryRes = await pool.query(
      `SELECT sender, content FROM messages WHERE session_id = $1 ORDER BY created_at ASC`,
      [id]
    );

    const messagesForAI: ChatMessage[] = chatHistoryRes.rows.map(row => ({
      role: row.sender === 'agent' ? 'assistant' : 'user',
      content: row.content,
    }));

    const preferredLanguage = session.preferredLanguage || 'en-US';
    const langNames: Record<string, string> = {
      'en-US': 'English',
      'es-ES': 'Spanish',
      'fr-FR': 'French',
      'zh-CN': 'Chinese (Mandarin)'
    };
    const activeLangName = langNames[preferredLanguage] || 'English';

    // System Prompt instructions
    const systemPrompt = `You are IntakeRx, a professional and empathetic clinical intake voice and chat agent.
Your objective is to collect a structured patient intake summary for the clinic. 
Patient Profile:
Name: ${session.patientName}
DOB: ${session.patientDob}
Sex: ${session.patientSex}

${protocolContext}Intake Workflow Steps:
1. 'complaint': Ask follow-up questions to understand details of their chief complaint (onset, description, severity).
2. 'history': Ask if they have any related past medical history or relevant chronic conditions.
3. 'meds': Gather list of current daily medications, dosages, and frequencies.
4. 'allergies': Inquire about drug or environmental allergies.
5. 'insurance': Collect insurance provider and policy/member ID (already provided as Provider: ${session.insuranceProvider || 'Pending'}, Policy: ${session.insurancePolicy || 'Pending'}, confirm if needed).
6. 'review': Present a summary of collected details and ask them to confirm if it is correct.

AI Guardrails (CRITICAL):
- Never diagnose, name diseases, suggest cures, prescribe, or recommend specific dosages.
- Refuse medical advice requests: redirect them politely, saying you are only an intake assistant.
- Keep the conversation structured, asking 1-2 questions at a time.
- If the patient describes sudden chest pain, severe difficulty breathing, facial drooping, slurred speech, or throat swelling, stop everything and advise them to hang up and call 911 immediately.

MULTILINGUAL INSTRUCTION:
- The patient's preferred language is: ${activeLangName} (${preferredLanguage}).
- You MUST conduct the dialogue and write the "text" property in ${activeLangName}.
- However, for the JSON "extractedData" fields (symptoms, medications, allergies, triageRationale), you MUST translate them back to English. This is critical for indexing into the clinic's English EHR system.

You MUST respond strictly in the following JSON format:
{
  "text": "Your calming question or response to be spoken/shown to the patient (written in ${activeLangName})...",
  "extractedData": {
    "symptoms": [{"name": "symptom name (translated to English)", "severity": "mild/moderate/severe", "duration": "duration in English, e.g. 2 days"}],
    "medications": [{"name": "medication name (translated to English)", "dosage": "dosage string in English", "frequency": "frequency string in English"}],
    "allergies": ["allergy name (translated to English)"],
    "currentStep": "complaint" | "history" | "meds" | "allergies" | "insurance" | "review",
    "triageLevel": "routine" | "urgent" | "emergency",
    "triageRationale": "Brief clinical rationale for assigned level (written in English)"
  }
}`;

    // 6. Generate AI response
    let aiText = '';
    let parsedResponse: any = {};
    
    try {
      const response = await AIService.generateText(systemPrompt, messagesForAI, {
        temperature: 0.1,
        responseJsonSchema: {
          type: 'OBJECT',
          properties: {
            text: { type: 'STRING' },
            extractedData: {
              type: 'OBJECT',
              properties: {
                symptoms: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      name: { type: 'STRING' },
                      severity: { type: 'STRING' },
                      duration: { type: 'STRING' }
                    },
                    required: ['name', 'severity']
                  }
                },
                medications: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      name: { type: 'STRING' },
                      dosage: { type: 'STRING' },
                      frequency: { type: 'STRING' }
                    },
                    required: ['name']
                  }
                },
                allergies: { type: 'ARRAY', items: { type: 'STRING' } },
                currentStep: { type: 'STRING' },
                triageLevel: { type: 'STRING' },
                triageRationale: { type: 'STRING' }
              },
              required: ['currentStep', 'triageLevel', 'triageRationale']
            }
          },
          required: ['text', 'extractedData']
        }
      });

      parsedResponse = JSON.parse(response.trim());
      aiText = parsedResponse.text;
    } catch (err) {
      console.error('AI text generation or parse failed:', err);
      // Fallback response format if AI fails
      aiText = "Could you please tell me more details about your symptoms?";
      parsedResponse = {
        text: aiText,
        extractedData: {
          currentStep: session.currentStep,
          triageLevel: 'routine',
          triageRationale: 'Failed parsing response'
        }
      };
    }

    // 7. Output Guardrail (Block diagnosis / medical advice)
    const outputGuard = GuardrailsService.scanOutputForMedicalAdvice(aiText, id);
    if (outputGuard.isBlocked) {
      aiText = outputGuard.cleanOutput;
    }

    // 8. Save Agent Message to Database
    const savedReply = await pool.query(
      `INSERT INTO messages (session_id, sender, content)
       VALUES ($1, $2, $3) RETURNING *`,
      [id, 'agent', aiText]
    );

    // 9. Sync Extracted State to Database
    const ext = parsedResponse.extractedData || {};
    
    // Save extracted symptoms
    if (ext.symptoms && Array.isArray(ext.symptoms)) {
      for (const sym of ext.symptoms) {
        if (!sym.name) continue;
        const isRed = /chest\s*pain|shortness|breathing|facial|speech/i.test(sym.name);
        await pool.query(
          `INSERT INTO symptoms (session_id, name, severity, duration, is_red_flag)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT DO NOTHING`,
          [id, sym.name, sym.severity || 'mild', sym.duration || null, isRed]
        );
      }
    }

    // Save extracted medications
    if (ext.medications && Array.isArray(ext.medications)) {
      for (const med of ext.medications) {
        if (!med.name) continue;
        await pool.query(
          `INSERT INTO medications (session_id, name, dosage, frequency)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING`,
          [id, med.name, med.dosage || null, med.frequency || null]
        );
      }
    }

    // Update session step, triage level
    const triageLvl = ext.triageLevel || 'routine';
    const triageRat = ext.triageRationale || '';
    const nextStep = ext.currentStep || session.currentStep;
    const isSessionEscalated = triageLvl === 'emergency' || nextStep === 'escalated';

    await pool.query(
      `UPDATE intake_sessions 
       SET current_step = $2, triage_level = $3, triage_rationale = $4,
           status = $5, updated_at = NOW()
       WHERE id = $1`,
      [id, nextStep, triageLvl, triageRat, isSessionEscalated ? 'escalated' : 'active']
    );

    // 10. Generate SOAP Summary if review stage complete
    if (nextStep === 'review' || nextStep === 'completed') {
      try {
        await generateSOAPSummary(id, session.patientId);
      } catch (sumErr) {
        console.error('Failed to pre-generate SOAP summary:', sumErr);
      }
    }

    res.json({
      reply: savedReply.rows[0],
      session: {
        id,
        status: isSessionEscalated ? 'escalated' : 'active',
        currentStep: nextStep,
        triageLevel: triageLvl,
      },
    });
  } catch (err) {
    console.error('Process message error:', err);
    res.status(500).json({ error: 'Failed to process message.' });
  }
});

// Generate and save a clinical SOAP summary from session history
async function generateSOAPSummary(sessionId: string, patientId: number) {
  // Check if summary already exists
  const existing = await pool.query('SELECT 1 FROM intake_summaries WHERE session_id = $1', [sessionId]);
  if (existing.rowCount && existing.rowCount > 0) return;

  // Retrieve patient details
  const patientRes = await pool.query(
    'SELECT name, dob, sex, insurance_provider, insurance_policy FROM patients WHERE id = $1',
    [patientId]
  );
  const patient = patientRes.rows[0];

  // Retrieve full transcript
  const transcriptRes = await pool.query(
    'SELECT sender, content FROM messages WHERE session_id = $1 ORDER BY created_at ASC',
    [sessionId]
  );
  const transcript = transcriptRes.rows.map(m => `${m.sender}: ${m.content}`).join('\n');

  // Retrieve symptoms and meds
  const symptomsRes = await pool.query('SELECT name, severity, duration, is_red_flag FROM symptoms WHERE session_id = $1', [sessionId]);
  const medsRes = await pool.query('SELECT name, dosage, frequency FROM medications WHERE session_id = $1', [sessionId]);
  
  const symptomsStr = symptomsRes.rows.map(s => `${s.name} (${s.severity}, duration: ${s.duration || 'unknown'})`).join(', ');
  const medsStr = medsRes.rows.map(m => `${m.name} ${m.dosage || ''} ${m.frequency || ''}`).join(', ');

  const prompt = `You are a clinical summarization AI. Create a high-fidelity clinician SOAP pre-visit summary from the following patient intake details.
Patient: ${patient.name} (DOB: ${patient.dob}, Sex: ${patient.sex})
Insurance: ${patient.insurance_provider || 'N/A'}, Policy: ${patient.insurance_policy || 'N/A'}
Extracted Symptoms: ${symptomsStr || 'None'}
Extracted Medications: ${medsStr || 'None'}

Transcript:
${transcript}

Output raw JSON matching this structure:
{
  "chiefComplaint": "Short description of the primary symptom or request...",
  "historyOfPresentIllness": "Detailed history of present illness (HPI) outlining onset, character, severity, and context...",
  "pastMedicalHistory": "Past medical history or chronic conditions mentioned...",
  "medications": [{"name": "med name", "dosage": "dosage", "frequency": "frequency"}],
  "allergies": ["allergy name"],
  "insurance": {
    "provider": "insurance provider",
    "policyNumber": "policy number"
  },
  "triageLevel": "routine" | "urgent" | "emergency",
  "triageRationale": "clinical reasoning for the triage level",
  "redFlagsIdentified": ["list of red flag symptoms, if any"]
}`;

  const summaryText = await AIService.generateText(
    "You are a medical scribe that creates clinician-friendly SOAP pre-visit summaries from patient intake interviews. Output strict JSON.",
    [{ role: 'user', content: prompt }],
    {
      temperature: 0.1,
      responseJsonSchema: {
        type: 'OBJECT',
        properties: {
          chiefComplaint: { type: 'STRING' },
          historyOfPresentIllness: { type: 'STRING' },
          pastMedicalHistory: { type: 'STRING' },
          medications: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING' },
                dosage: { type: 'STRING' },
                frequency: { type: 'STRING' }
              },
              required: ['name']
            }
          },
          allergies: { type: 'ARRAY', items: { type: 'STRING' } },
          insurance: {
            type: 'OBJECT',
            properties: {
              provider: { type: 'STRING' },
              policyNumber: { type: 'STRING' }
            }
          },
          triageLevel: { type: 'STRING' },
          triageRationale: { type: 'STRING' },
          redFlagsIdentified: { type: 'ARRAY', items: { type: 'STRING' } }
        },
        required: ['chiefComplaint', 'historyOfPresentIllness', 'medications', 'allergies', 'triageLevel', 'triageRationale', 'redFlagsIdentified']
      }
    }
  );

  const soapData = JSON.parse(summaryText.trim());
  
  await pool.query(
    `INSERT INTO intake_summaries (session_id, summary_data, status)
     VALUES ($1, $2, $3)`,
    [sessionId, JSON.stringify(soapData), 'pending']
  );
}

export default router;
export { generateSOAPSummary };
