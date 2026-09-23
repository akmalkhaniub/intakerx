import { pool } from '../db';

export type ESILevel = 1 | 2 | 3 | 4 | 5;

export interface ESIAssessment {
  esiLevel: ESILevel;
  levelName: 'Resuscitation' | 'Emergent' | 'Urgent' | 'Less Urgent' | 'Non-Urgent';
  priorityScore: number; // Higher number = higher priority
  rationale: string;
  recommendedMaxWaitMinutes: number;
  estimatedResourceCount: number;
  clinicalFlags: string[];
  vitalsWarning: boolean;
  requiresRapidIntervention: boolean;
}

export interface WaitingRoomPatient {
  sessionId: string;
  patientId: number;
  patientName: string;
  age: number;
  gender: string;
  checkInTime: string;
  waitDurationMinutes: number;
  esi: ESIAssessment;
  isBreached: boolean;
  lwbsRisk: 'low' | 'moderate' | 'high'; // Left Without Being Seen risk
  assignedRoom?: string;
  chiefComplaint: string;
  vitalsSummary?: string;
}

/**
 * Executes standard Emergency Severity Index (ESI) v4 algorithm
 */
export function evaluateESI(input: {
  chiefComplaint?: string;
  symptoms: { name: string; severity?: string; is_red_flag?: boolean }[];
  vitals?: {
    heartRate?: number;
    bpSystolic?: number;
    bpDiastolic?: number;
    spo2?: number;
    temperatureF?: number;
    respiratoryRate?: number;
  };
}): ESIAssessment {
  const text = (
    (input.chiefComplaint || '') + ' ' +
    input.symptoms.map(s => s.name).join(' ')
  ).toLowerCase();

  const vitals = input.vitals || {};
  const clinicalFlags: string[] = [];
  let vitalsWarning = false;

  // Step A: Does the patient require immediate life-saving intervention? (ESI 1)
  const isCardiacArrest = text.includes('unresponsive') || text.includes('pulseless') || text.includes('arrest') || text.includes('agonal');
  const isSevereShock = (vitals.bpSystolic && vitals.bpSystolic < 80) || (vitals.heartRate && (vitals.heartRate > 150 || vitals.heartRate < 40));
  const isSevereHypoxia = vitals.spo2 !== undefined && vitals.spo2 < 88;

  if (isCardiacArrest || isSevereShock || isSevereHypoxia) {
    if (isCardiacArrest) clinicalFlags.push('Potential unresponsiveness or arrest presentation');
    if (isSevereShock) clinicalFlags.push(`Hemodynamic instability: BP ${vitals.bpSystolic}, HR ${vitals.heartRate}`);
    if (isSevereHypoxia) clinicalFlags.push(`Critical hypoxia: SpO2 ${vitals.spo2}%`);

    return {
      esiLevel: 1,
      levelName: 'Resuscitation',
      priorityScore: 100,
      rationale: 'Immediate life-saving intervention required for airway, breathing, or hemodynamic collapse.',
      recommendedMaxWaitMinutes: 0,
      estimatedResourceCount: 5,
      clinicalFlags,
      vitalsWarning: true,
      requiresRapidIntervention: true
    };
  }

  // Step B: Is this a high-risk situation, or confused/lethargic/disoriented, or severe pain/distress? (ESI 2)
  const isAcuteChestPain = (text.includes('chest') || text.includes('substernal') || text.includes('angina')) && 
    (text.includes('crushing') || text.includes('pressure') || text.includes('radiat') || text.includes('sweat') || text.includes('diaphor'));
  const isStrokeSigns = text.includes('stroke') || text.includes('facial droop') || text.includes('slurred') || text.includes('hemiparesis') || text.includes('numbness one side');
  const isSevereDyspnea = text.includes('severe shortness of breath') || text.includes('stridor') || (vitals.spo2 !== undefined && vitals.spo2 <= 92);
  const isSeverePain = input.symptoms.some(s => s.severity === 'severe' || s.is_red_flag);
  const isHighTachycardia = vitals.heartRate !== undefined && vitals.heartRate > 115;
  const isHighHypertension = vitals.bpSystolic !== undefined && vitals.bpSystolic >= 180;

  if (isAcuteChestPain || isStrokeSigns || isSevereDyspnea || isHighHypertension || (isSeverePain && isHighTachycardia)) {
    if (isAcuteChestPain) clinicalFlags.push('High-risk cardiac presentation suspicious for Acute Coronary Syndrome');
    if (isStrokeSigns) clinicalFlags.push('Suspected acute focal neurological deficit / CVA');
    if (isSevereDyspnea) clinicalFlags.push('Severe respiratory distress or desaturation');
    if (isHighHypertension) clinicalFlags.push(`Hypertensive crisis threshold: SBP ${vitals.bpSystolic}`);

    return {
      esiLevel: 2,
      levelName: 'Emergent',
      priorityScore: 80,
      rationale: 'High-risk clinical condition requiring emergent evaluation to avoid organ failure or clinical deterioration.',
      recommendedMaxWaitMinutes: 10,
      estimatedResourceCount: 3,
      clinicalFlags,
      vitalsWarning: isHighTachycardia || isHighHypertension || isSevereDyspnea,
      requiresRapidIntervention: true
    };
  }

  // Step C: How many resources are anticipated?
  // Resources: Labs, ECG, X-Ray/CT, IV fluids, IV medications, Specialty consult, Complex procedure
  let resourceCount = 0;
  if (text.includes('abdominal') || text.includes('stomach') || text.includes('vomit') || text.includes('fever')) {
    resourceCount += 2; // Labs + Imaging / IV
    clinicalFlags.push('Anticipated abdominal lab work and ultrasound/CT workup');
  }
  if (text.includes('fracture') || text.includes('fall') || text.includes('twist') || text.includes('bone') || text.includes('swelling')) {
    resourceCount += 1; // X-Ray
    clinicalFlags.push('Anticipated diagnostic plain radiography');
  }
  if (text.includes('laceration') || text.includes('cut') || text.includes('bleeding')) {
    resourceCount += 1; // Suture / wound repair
    clinicalFlags.push('Anticipated minor surgical repair / wound care');
  }
  if (text.includes('headache') || text.includes('migraine')) {
    resourceCount += 1; // IV abortive therapy or labs
  }

  // Step D: Danger zone vital signs consideration for ESI 3
  if (vitals.heartRate && vitals.heartRate > 105) vitalsWarning = true;
  if (vitals.respiratoryRate && vitals.respiratoryRate > 24) vitalsWarning = true;
  if (vitals.temperatureF && vitals.temperatureF > 102.5) vitalsWarning = true;

  if (resourceCount >= 2 || vitalsWarning) {
    return {
      esiLevel: 3,
      levelName: 'Urgent',
      priorityScore: 50,
      rationale: 'Patient is stable but will require two or more diagnostic/therapeutic resources.',
      recommendedMaxWaitMinutes: 30,
      estimatedResourceCount: Math.max(2, resourceCount),
      clinicalFlags,
      vitalsWarning,
      requiresRapidIntervention: false
    };
  }

  if (resourceCount === 1) {
    return {
      esiLevel: 4,
      levelName: 'Less Urgent',
      priorityScore: 30,
      rationale: 'Patient is stable and predicted to require a single simple diagnostic or procedural resource.',
      recommendedMaxWaitMinutes: 60,
      estimatedResourceCount: 1,
      clinicalFlags,
      vitalsWarning: false,
      requiresRapidIntervention: false
    };
  }

  // ESI 5: No resources anticipated
  return {
    esiLevel: 5,
    levelName: 'Non-Urgent',
    priorityScore: 10,
    rationale: 'Patient presentation requires physical exam and prescription without additional hospital resources.',
    recommendedMaxWaitMinutes: 120,
    estimatedResourceCount: 0,
    clinicalFlags: ['Routine evaluation / prescription refill'],
    vitalsWarning: false,
    requiresRapidIntervention: false
  };
}

/**
 * Returns dynamic waiting room queue sorted by clinical acuity and wait time
 */
export async function getDynamicWaitingRoomQueue(): Promise<{
  queue: WaitingRoomPatient[];
  stats: {
    totalWaiting: number;
    esi1Count: number;
    esi2Count: number;
    esi3Count: number;
    esi4Count: number;
    esi5Count: number;
    breachedCount: number;
    avgWaitMinutes: number;
  };
}> {
  // Query active or escalated sessions
  const res = await pool.query(`
    SELECT 
      s.id as session_id,
      s.patient_id,
      s.status,
      s.triage_level,
      s.created_at,
      p.name as patient_name,
      p.dob,
      p.sex
    FROM intake_sessions s
    JOIN patients p ON s.patient_id = p.id
    WHERE s.status IN ('active', 'escalated')
    ORDER BY s.created_at ASC
  `);

  const queue: WaitingRoomPatient[] = [];

  for (const row of res.rows) {
    // Get symptoms
    const sympRes = await pool.query(
      `SELECT name, severity, is_red_flag FROM symptoms WHERE session_id = $1`,
      [row.session_id]
    );

    // Get latest vitals
    const vitRes = await pool.query(
      `SELECT heart_rate, bp_systolic, bp_diastolic, spo2 
       FROM session_vitals WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [row.session_id]
    );

    const vitals = vitRes.rows[0] ? {
      heartRate: vitRes.rows[0].heart_rate,
      bpSystolic: vitRes.rows[0].bp_systolic,
      bpDiastolic: vitRes.rows[0].bp_diastolic,
      spo2: vitRes.rows[0].spo2
    } : undefined;

    // Get messages for chief complaint context
    const msgRes = await pool.query(
      `SELECT content FROM messages WHERE session_id = $1 AND sender = 'patient' LIMIT 2`,
      [row.session_id]
    );
    const chiefComplaint = msgRes.rows.map(m => m.content).join(' ') || 'General Triage Consultation';

    const esi = evaluateESI({
      chiefComplaint,
      symptoms: sympRes.rows,
      vitals
    });

    const checkIn = new Date(row.created_at).getTime();
    const waitDurationMinutes = Math.max(1, Math.round((Date.now() - checkIn) / 60000));
    const isBreached = waitDurationMinutes > esi.recommendedMaxWaitMinutes;

    // Calculate LWBS (Left Without Being Seen) risk
    let lwbsRisk: 'low' | 'moderate' | 'high' = 'low';
    if (waitDurationMinutes > 45 && esi.esiLevel >= 4) lwbsRisk = 'high';
    else if (waitDurationMinutes > 30) lwbsRisk = 'moderate';

    // Age calculation
    const birth = new Date(row.dob).getTime();
    const age = Math.floor((Date.now() - birth) / (365.25 * 24 * 3600 * 1000)) || 45;

    let vitalsSummary: string | undefined;
    if (vitals && vitals.heartRate) {
      vitalsSummary = `HR ${vitals.heartRate} | BP ${vitals.bpSystolic || 120}/${vitals.bpDiastolic || 80} | SpO2 ${vitals.spo2 || 98}%`;
    }

    queue.push({
      sessionId: row.session_id,
      patientId: row.patient_id,
      patientName: row.patient_name,
      age,
      gender: row.sex,
      checkInTime: new Date(row.created_at).toISOString(),
      waitDurationMinutes,
      esi,
      isBreached,
      lwbsRisk,
      chiefComplaint: chiefComplaint.slice(0, 90),
      vitalsSummary
    });
  }

  // Sort queue by:
  // 1. ESI level (ascending: 1 comes first)
  // 2. Priority score (descending)
  // 3. Wait time breach status
  // 4. Wait duration (longest wait first)
  queue.sort((a, b) => {
    if (a.esi.esiLevel !== b.esi.esiLevel) {
      return a.esi.esiLevel - b.esi.esiLevel;
    }
    if (a.isBreached !== b.isBreached) {
      return a.isBreached ? -1 : 1;
    }
    return b.waitDurationMinutes - a.waitDurationMinutes;
  });

  const esi1Count = queue.filter(q => q.esi.esiLevel === 1).length;
  const esi2Count = queue.filter(q => q.esi.esiLevel === 2).length;
  const esi3Count = queue.filter(q => q.esi.esiLevel === 3).length;
  const esi4Count = queue.filter(q => q.esi.esiLevel === 4).length;
  const esi5Count = queue.filter(q => q.esi.esiLevel === 5).length;
  const breachedCount = queue.filter(q => q.isBreached).length;
  const totalMinutes = queue.reduce((acc, q) => acc + q.waitDurationMinutes, 0);
  const avgWaitMinutes = queue.length > 0 ? Math.round(totalMinutes / queue.length) : 0;

  return {
    queue,
    stats: {
      totalWaiting: queue.length,
      esi1Count,
      esi2Count,
      esi3Count,
      esi4Count,
      esi5Count,
      breachedCount,
      avgWaitMinutes
    }
  };
}
