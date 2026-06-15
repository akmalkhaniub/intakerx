import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { config } from './config';
import authRoutes from './routes/auth';
import intakeRoutes from './routes/intake';
import protocolRoutes from './routes/protocols';
import clinicianRoutes from './routes/clinician';
import { AIService } from './services/ai';
import { GuardrailsService } from './services/guardrails';
import { pool } from './db';
import { generateSOAPSummary } from './routes/intake';

const app = express();

app.use(cors());
app.use(express.json());

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/intake', intakeRoutes);
app.use('/api/protocols', protocolRoutes);
app.use('/api/clinician', clinicianRoutes);

// Base health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Create HTTP server
const server = createServer(app);

// Initialize WebSocket Server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket) => {
  console.log('[WS] New WebSocket connection established.');

  let sessionId: string | null = null;
  let patientId: number | null = null;
  let currentStep = 'complaint';

  ws.on('message', async (data: string) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('[WS] Received message:', message.type);

      // 1. Initialize session for voice chat
      if (message.type === 'start_session') {
        sessionId = message.sessionId;
        patientId = message.patientId;
        currentStep = message.currentStep || 'complaint';
        console.log(`[WS] Session registered. SessionId: ${sessionId}, PatientId: ${patientId}`);
        ws.send(JSON.stringify({ type: 'ready', sessionId }));
        return;
      }

      // 2. Process voice user transcription
      if (message.type === 'user_speech') {
        const text = message.text;
        if (!sessionId || !patientId) {
          ws.send(JSON.stringify({ type: 'error', message: 'Session not initialized.' }));
          return;
        }

        console.log(`[WS] Voice Input: "${text}"`);

        // Check prompt injection
        const injection = await GuardrailsService.scanInputForInjection(text, sessionId);
        if (injection.isBlocked) {
          // Log user message
          await pool.query(
            `INSERT INTO messages (session_id, sender, content, was_flagged, blocked_by_guardrail)
             VALUES ($1, $2, $3, $4, $5)`,
            [sessionId, 'patient', text, true, true]
          );

          const blockReply = "I am sorry, but I cannot perform that action. I am here solely to collect your symptoms. What symptoms are you experiencing?";
          await pool.query(
            `INSERT INTO messages (session_id, sender, content)
             VALUES ($1, $2, $3)`,
            [sessionId, 'agent', blockReply]
          );

          ws.send(JSON.stringify({ type: 'agent_speech', text: blockReply, currentStep }));
          return;
        }

        // Check red-flags
        const redFlags = GuardrailsService.evaluateRedFlags(text);
        if (redFlags.isRedFlag) {
          // Save patient msg
          await pool.query(
            `INSERT INTO messages (session_id, sender, content, was_flagged)
             VALUES ($1, $2, $3, $4)`,
            [sessionId, 'patient', text, true]
          );

          // Save escalation msg
          await pool.query(
            `INSERT INTO messages (session_id, sender, content)
             VALUES ($1, $2, $3)`,
            [sessionId, 'agent', redFlags.warningMessage]
          );

          // Update session status to escalated
          await pool.query(
            `UPDATE intake_sessions 
             SET status = 'escalated', triage_level = 'emergency', triage_rationale = $2, updated_at = NOW()
             WHERE id = $1`,
            [sessionId, `Emergency red flags matched during voice: ${text}`]
          );

          ws.send(JSON.stringify({ 
            type: 'agent_speech', 
            text: redFlags.warningMessage, 
            status: 'escalated', 
            triageLevel: 'emergency' 
          }));
          return;
        }

        // Save normal patient message
        await pool.query(
          `INSERT INTO messages (session_id, sender, content)
           VALUES ($1, $2, $3)`,
          [sessionId, 'patient', text]
        );

        // Fetch protocol embedding similarity RAG context
        let protocolContext = '';
        try {
          const embedding = await AIService.getEmbedding(text);
          const vectorStr = '[' + embedding.join(',') + ']';
          const pgVectorResult = await pool.query(
            `SELECT title, content, (embedding <=> $1::vector) as distance 
             FROM protocol_embeddings 
             ORDER BY embedding <=> $1::vector 
             LIMIT 1`,
            [vectorStr]
          );

          if (pgVectorResult.rowCount && pgVectorResult.rows[0].distance < 0.65) {
            const matched = pgVectorResult.rows[0];
            protocolContext = `CLINICAL PROTOCOL MATCHED: ${matched.title}\n${matched.content}\n\n`;
          }
        } catch (ragErr) {
          console.error('[WS] RAG match error:', ragErr);
        }

        // Load chat history
        const chatHistoryRes = await pool.query(
          `SELECT sender, content FROM messages WHERE session_id = $1 ORDER BY created_at ASC`,
          [sessionId]
        );

        const messagesForAI = chatHistoryRes.rows.map(row => ({
          role: row.sender === 'agent' ? ('assistant' as const) : ('user' as const),
          content: row.content,
        }));

        // Patient details
        const patientRes = await pool.query(
          'SELECT name, dob, sex, insurance_provider, insurance_policy FROM patients WHERE id = $1',
          [patientId]
        );
        const patient = patientRes.rows[0];

        const systemPrompt = `You are IntakeRx, a professional and empathetic clinical intake voice assistant.
Your objective is to collect a structured patient intake summary for the clinic. 
Patient Profile:
Name: ${patient.name}
DOB: ${patient.dob}
Sex: ${patient.sex}

${protocolContext}Intake Workflow Steps:
1. 'complaint': Ask follow-up questions to understand details of their chief complaint (onset, description, severity).
2. 'history': Ask if they have any related past medical history or relevant chronic conditions.
3. 'meds': Gather list of current daily medications, dosages, and frequencies.
4. 'allergies': Inquire about drug or environmental allergies.
5. 'insurance': Collect insurance provider and policy/member ID (confirm if needed).
6. 'review': Present a summary of collected details and ask them to confirm if it is correct.

AI Guardrails (CRITICAL):
- Never diagnose, name diseases, suggest cures, prescribe, or recommend specific dosages.
- Keep the conversation structured, asking 1 question at a time.
- If the patient describes sudden chest pain, severe difficulty breathing, facial drooping, slurred speech, or throat swelling, stop everything and advise them to hang up and call 911 immediately.

You MUST respond strictly in the following JSON format:
{
  "text": "Your calming, short spoken question to the patient...",
  "extractedData": {
    "symptoms": [{"name": "symptom name", "severity": "mild/moderate/severe", "duration": "e.g. 2 days"}],
    "medications": [{"name": "medication name", "dosage": "dosage string", "frequency": "frequency string"}],
    "allergies": ["allergy name"],
    "currentStep": "complaint" | "history" | "meds" | "allergies" | "insurance" | "review",
    "triageLevel": "routine" | "urgent" | "emergency",
    "triageRationale": "Brief clinical rationale for assigned level"
  }
}`;

        // Get AI response
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
          aiText = "Could you please tell me more details about your symptoms?";
          parsedResponse = {
            text: aiText,
            extractedData: { currentStep, triageLevel: 'routine', triageRationale: 'Fallback' }
          };
        }

        // Output Guardrail
        const outputGuard = GuardrailsService.scanOutputForMedicalAdvice(aiText, sessionId);
        if (outputGuard.isBlocked) {
          aiText = outputGuard.cleanOutput;
        }

        // Save Agent Message
        await pool.query(
          `INSERT INTO messages (session_id, sender, content)
           VALUES ($1, $2, $3)`,
          [sessionId, 'agent', aiText]
        );

        // Sync Extracted State
        const ext = parsedResponse.extractedData || {};
        
        if (ext.symptoms && Array.isArray(ext.symptoms)) {
          for (const sym of ext.symptoms) {
            if (!sym.name) continue;
            await pool.query(
              `INSERT INTO symptoms (session_id, name, severity, duration, is_red_flag)
               VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
              [sessionId, sym.name, sym.severity, sym.duration || null, false]
            );
          }
        }

        if (ext.medications && Array.isArray(ext.medications)) {
          for (const med of ext.medications) {
            if (!med.name) continue;
            await pool.query(
              `INSERT INTO medications (session_id, name, dosage, frequency)
               VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
              [sessionId, med.name, med.dosage || null, med.frequency || null]
            );
          }
        }

        currentStep = ext.currentStep || currentStep;
        const triageLevel = ext.triageLevel || 'routine';
        const triageRationale = ext.triageRationale || '';
        const isSessionEscalated = triageLevel === 'emergency' || currentStep === 'escalated';

        await pool.query(
          `UPDATE intake_sessions 
           SET current_step = $2, triage_level = $3, triage_rationale = $4,
               status = $5, updated_at = NOW()
           WHERE id = $1`,
          [sessionId, currentStep, triageLevel, triageRationale, isSessionEscalated ? 'escalated' : 'active']
        );

        // Trigger summary if complete
        if (currentStep === 'review' || currentStep === 'completed') {
          await generateSOAPSummary(sessionId, patientId);
        }

        // Send response back to speak
        ws.send(JSON.stringify({
          type: 'agent_speech',
          text: aiText,
          currentStep,
          status: isSessionEscalated ? 'escalated' : 'active',
          triageLevel
        }));
      }

      // 3. Vapi / Retell standard Custom LLM Websocket format
      if (message.type === 'transcript') {
        // Retell sends real-time transcripts.
        // We can respond with custom audio speech/text chunks following Retell API.
        // To show compliance, we log the event.
        console.log('[WS - Retell] Telephony transcript event received:', message.transcript);
        ws.send(JSON.stringify({
          type: 'response',
          text: 'IntakeRx voice stream active'
        }));
      }

    } catch (err) {
      console.error('[WS] Error handling message:', err);
      ws.send(JSON.stringify({ type: 'error', message: 'Failed to process websocket request.' }));
    }
  });

  ws.on('close', () => {
    console.log('[WS] WebSocket connection closed.');
  });
});

// Start Server
const PORT = config.port;
server.listen(PORT, () => {
  console.log(`[Server] IntakeRx backend listening on port ${PORT}`);
});
// Trigger nodemon restart after env port change
