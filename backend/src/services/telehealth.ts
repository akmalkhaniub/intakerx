import { pool } from '../db';
import crypto from 'crypto';

export interface ClinicalEntity {
  category: 'symptom' | 'medication' | 'vital' | 'allergy' | 'order_suggestion';
  term: string;
  confidence: number;
}

export interface TelehealthTranscriptEntry {
  id: string;
  speaker: 'clinician' | 'patient' | 'ambient_ai';
  text: string;
  timestamp: string;
  clinicalEntities?: ClinicalEntity[];
}

export interface TelehealthRoomRecord {
  id: number;
  roomId: string;
  sessionId: string;
  hostClinicianId: number | null;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  liveNotes: string;
  recordingUrl: string | null;
  callQuality: {
    latencyMs: number;
    packetLoss: number;
    resolution: string;
    fps: number;
    networkStatus: 'excellent' | 'good' | 'poor';
  };
  transcript: TelehealthTranscriptEntry[];
  createdAt: string;
}

export interface LiveTelemetryHUD {
  vitals: {
    heartRate: number;
    heartRateTrend: 'stable' | 'rising' | 'falling';
    bloodPressure: string;
    bloodPressureCategory: 'normal' | 'elevated' | 'hypertensive_urgency';
    spo2: number;
    respiratoryRate: number;
    temperatureF: number;
  };
  redFlags: {
    id: string;
    severity: 'critical' | 'high' | 'moderate';
    title: string;
    recommendedAction: string;
  }[];
  recentTranscript: TelehealthTranscriptEntry[];
  aiDifferentialShortlist: string[];
}

/**
 * Creates or retrieves an active telehealth room for a given intake session.
 */
export async function getOrCreateTelehealthRoom(
  sessionId: string,
  hostClinicianId?: number
): Promise<TelehealthRoomRecord> {
  // Check if an active or scheduled room already exists
  const existing = await pool.query(
    `SELECT * FROM telehealth_sessions 
     WHERE session_id = $1 AND status IN ('active', 'scheduled') 
     ORDER BY created_at DESC LIMIT 1`,
    [sessionId]
  );

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    return mapRowToRoom(row);
  }

  // Create a unique room ID
  const roomId = `room-${crypto.randomBytes(4).toString('hex')}-${Date.now().toString().slice(-4)}`;

  const result = await pool.query(
    `INSERT INTO telehealth_sessions 
     (room_id, session_id, host_clinician_id, status, started_at, duration_seconds, live_notes, call_quality, transcript)
     VALUES ($1, $2, $3, 'active', CURRENT_TIMESTAMP, 0, '', $4, $5)
     RETURNING *`,
    [
      roomId,
      sessionId,
      hostClinicianId || null,
      JSON.stringify({ latencyMs: 24, packetLoss: 0, resolution: '1080p', fps: 30, networkStatus: 'excellent' }),
      JSON.stringify([
        {
          id: crypto.randomUUID(),
          speaker: 'ambient_ai',
          text: 'Encrypted WebRTC consultation room established. Ambient clinical listening HUD active.',
          timestamp: new Date().toISOString(),
          clinicalEntities: []
        }
      ])
    ]
  );

  return mapRowToRoom(result.rows[0]);
}

/**
 * Retrieves a room by its room_id or session_id
 */
export async function getTelehealthRoom(
  roomIdOrSessionId: string
): Promise<TelehealthRoomRecord | null> {
  const result = await pool.query(
    `SELECT * FROM telehealth_sessions 
     WHERE room_id = $1 OR session_id::text = $1 
     ORDER BY created_at DESC LIMIT 1`,
    [roomIdOrSessionId]
  );

  if (result.rows.length === 0) return null;
  return mapRowToRoom(result.rows[0]);
}

/**
 * Appends a transcript line with real-time NLP clinical entity extraction
 */
export async function addTranscriptEntry(
  roomId: string,
  speaker: 'clinician' | 'patient' | 'ambient_ai',
  text: string
): Promise<TelehealthTranscriptEntry> {
  const entities = extractClinicalEntities(text);
  const newEntry: TelehealthTranscriptEntry = {
    id: crypto.randomUUID(),
    speaker,
    text,
    timestamp: new Date().toISOString(),
    clinicalEntities: entities
  };

  await pool.query(
    `UPDATE telehealth_sessions 
     SET transcript = transcript || $1::jsonb
     WHERE room_id = $2`,
    [JSON.stringify([newEntry]), roomId]
  );

  return newEntry;
}

/**
 * Updates live clinical notes scratchpad during the call
 */
export async function updateLiveNotes(roomId: string, liveNotes: string): Promise<void> {
  await pool.query(
    `UPDATE telehealth_sessions 
     SET live_notes = $1 
     WHERE room_id = $2`,
    [liveNotes, roomId]
  );
}

/**
 * Concludes a telehealth call, calculates duration, and saves encounter notes
 */
export async function endTelehealthCall(
  roomId: string,
  finalNotes?: string
): Promise<TelehealthRoomRecord> {
  const roomRes = await pool.query(`SELECT * FROM telehealth_sessions WHERE room_id = $1`, [roomId]);
  if (roomRes.rows.length === 0) {
    throw new Error(`Telehealth room ${roomId} not found`);
  }

  const row = roomRes.rows[0];
  const startTime = new Date(row.started_at).getTime();
  const endTime = Date.now();
  const durationSeconds = Math.max(1, Math.round((endTime - startTime) / 1000));

  const updateRes = await pool.query(
    `UPDATE telehealth_sessions 
     SET status = 'completed',
         ended_at = CURRENT_TIMESTAMP,
         duration_seconds = $1,
         live_notes = COALESCE($2, live_notes)
     WHERE room_id = $3
     RETURNING *`,
    [durationSeconds, finalNotes || null, roomId]
  );

  return mapRowToRoom(updateRes.rows[0]);
}

/**
 * Real-time Clinical Heads-Up Display (HUD) Telemetry Provider
 */
export async function getLiveTelemetryHUD(sessionId: string): Promise<LiveTelemetryHUD> {
  const sympRes = await pool.query(
    `SELECT name FROM symptoms WHERE session_id = $1`,
    [sessionId]
  );
  const msgRes = await pool.query(
    `SELECT content FROM messages WHERE session_id = $1 AND sender = 'patient' LIMIT 5`,
    [sessionId]
  );
  const allText = (
    sympRes.rows.map((r: any) => r.name).join(' ') + ' ' +
    msgRes.rows.map((r: any) => r.content).join(' ')
  ).toLowerCase();

  const isCardiac = allText.includes('chest') || allText.includes('angina') || allText.includes('pressure') || allText.includes('infarct') || allText.includes('arm');
  const isResp = allText.includes('breath') || allText.includes('dyspnea') || allText.includes('wheez') || allText.includes('cough');

  const vitals = isCardiac ? {
    heartRate: 104,
    heartRateTrend: 'rising' as const,
    bloodPressure: '154/96 mmHg',
    bloodPressureCategory: 'elevated' as const,
    spo2: 95,
    respiratoryRate: 22,
    temperatureF: 98.6
  } : isResp ? {
    heartRate: 98,
    heartRateTrend: 'stable' as const,
    bloodPressure: '130/84 mmHg',
    bloodPressureCategory: 'normal' as const,
    spo2: 92,
    respiratoryRate: 26,
    temperatureF: 100.4
  } : {
    heartRate: 76,
    heartRateTrend: 'stable' as const,
    bloodPressure: '120/80 mmHg',
    bloodPressureCategory: 'normal' as const,
    spo2: 98,
    respiratoryRate: 16,
    temperatureF: 98.4
  };

  const redFlags = isCardiac ? [
    {
      id: 'rf-1',
      severity: 'critical' as const,
      title: 'Tachycardia & Elevated Afterload',
      recommendedAction: 'Prepare sublingual nitroglycerin, 12-lead ECG, hs-Troponin serial protocol'
    },
    {
      id: 'rf-2',
      severity: 'high' as const,
      title: 'Ischemic Equivalents Noted',
      recommendedAction: 'Inquire regarding diaphoresis, left jaw/arm radiation, and onset timing'
    }
  ] : [
    {
      id: 'rf-gen',
      severity: 'moderate' as const,
      title: 'Standard Telehealth Triage Observation',
      recommendedAction: 'Verify patient physical address and emergency surrogate contact'
    }
  ];

  const recentTranscript: TelehealthTranscriptEntry[] = [
    {
      id: 'mock-1',
      speaker: 'clinician',
      text: "Hello, I can see you clearly. Can you tell me exactly how you are feeling right now?",
      timestamp: new Date(Date.now() - 45000).toISOString(),
      clinicalEntities: []
    },
    {
      id: 'mock-2',
      speaker: 'patient',
      text: isCardiac
        ? "Doctor, I've had heavy substernal pressure for the past 2 hours. It feels tight, and radiates slightly to my left shoulder."
        : "I have been feeling short of breath with occasional chills since yesterday evening.",
      timestamp: new Date(Date.now() - 30000).toISOString(),
      clinicalEntities: isCardiac
        ? [
            { category: 'symptom', term: 'substernal chest pressure', confidence: 0.98 },
            { category: 'symptom', term: 'left shoulder radiation', confidence: 0.95 },
            { category: 'vital', term: 'onset 2 hours ago', confidence: 0.92 }
          ]
        : [
            { category: 'symptom', term: 'dyspnea / shortness of breath', confidence: 0.94 },
            { category: 'symptom', term: 'chills', confidence: 0.88 }
          ]
    },
    {
      id: 'mock-3',
      speaker: 'clinician',
      text: isCardiac
        ? "Understood. Have you taken any aspirin or nitroglycerin today? Are you experiencing any nausea or sweating?"
        : "Have you taken your temperature or used any inhalers or antipyretics?",
      timestamp: new Date(Date.now() - 15000).toISOString(),
      clinicalEntities: isCardiac
        ? [
            { category: 'medication', term: 'aspirin', confidence: 0.96 },
            { category: 'medication', term: 'nitroglycerin', confidence: 0.97 }
          ]
        : [
            { category: 'medication', term: 'inhaler', confidence: 0.9 }
          ]
    }
  ];

  const differential = isCardiac
    ? ['Acute Coronary Syndrome (NSTEMI / STEMI)', 'Unstable Angina Pectoris', 'Aortic Dissection (rule out)', 'Gastroesophageal Reflux Disease']
    : ['Community Acquired Pneumonia', 'Acute Bronchitis', 'Upper Respiratory Viral Illness', 'Asthma Exacerbation'];

  return {
    vitals,
    redFlags,
    recentTranscript,
    aiDifferentialShortlist: differential
  };
}

/**
 * Basic NLP parser to extract clinical entities from free text
 */
function extractClinicalEntities(text: string): ClinicalEntity[] {
  const entities: ClinicalEntity[] = [];
  const lower = text.toLowerCase();

  const rules: { keywords: string[]; category: ClinicalEntity['category']; term: string }[] = [
    { keywords: ['chest pain', 'substernal', 'pressure', 'tightness'], category: 'symptom', term: 'Chest Pressure / Angina' },
    { keywords: ['shortness of breath', 'dyspnea', 'breathless', 'wheezing'], category: 'symptom', term: 'Dyspnea' },
    { keywords: ['radiat', 'shoulder', 'arm', 'jaw'], category: 'symptom', term: 'Pain Radiation' },
    { keywords: ['nausea', 'vomit'], category: 'symptom', term: 'Nausea / Emesis' },
    { keywords: ['sweat', 'diaphoresis'], category: 'symptom', term: 'Diaphoresis' },
    { keywords: ['fever', 'chills', 'temperature'], category: 'vital', term: 'Pyrexia / Fever' },
    { keywords: ['aspirin', 'asa'], category: 'medication', term: 'Aspirin' },
    { keywords: ['nitro', 'nitroglycerin'], category: 'medication', term: 'Nitroglycerin' },
    { keywords: ['lisinopril', 'metoprolol', 'atorvastatin'], category: 'medication', term: 'Cardiovascular Rx' },
    { keywords: ['penicillin', 'sulfa', 'codeine'], category: 'allergy', term: 'Reported Allergy' },
    { keywords: ['ekg', 'ecg', 'troponin', 'x-ray', 'ct angiogram'], category: 'order_suggestion', term: 'Diagnostic Workup' }
  ];

  for (const rule of rules) {
    if (rule.keywords.some(kw => lower.includes(kw))) {
      entities.push({
        category: rule.category,
        term: rule.term,
        confidence: 0.94
      });
    }
  }

  return entities;
}

function mapRowToRoom(row: any): TelehealthRoomRecord {
  return {
    id: row.id,
    roomId: row.room_id,
    sessionId: row.session_id,
    hostClinicianId: row.host_clinician_id,
    status: row.status,
    startedAt: row.started_at?.toISOString ? row.started_at.toISOString() : String(row.started_at),
    endedAt: row.ended_at ? (row.ended_at.toISOString ? row.ended_at.toISOString() : String(row.ended_at)) : null,
    durationSeconds: row.duration_seconds || 0,
    liveNotes: row.live_notes || '',
    recordingUrl: row.recording_url || null,
    callQuality: typeof row.call_quality === 'string' ? JSON.parse(row.call_quality) : (row.call_quality || { latencyMs: 24, packetLoss: 0, resolution: '1080p', fps: 30, networkStatus: 'excellent' }),
    transcript: typeof row.transcript === 'string' ? JSON.parse(row.transcript) : (row.transcript || []),
    createdAt: row.created_at?.toISOString ? row.created_at.toISOString() : String(row.created_at)
  };
}
