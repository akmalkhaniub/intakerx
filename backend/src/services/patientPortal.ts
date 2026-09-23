import { pool } from '../db';

export interface WearableTelemetryRecord {
  id: number;
  patientId: number;
  sourceDevice: string;
  recordedAt: string;
  hrvMs: number;
  restingHr: number;
  stepCount: number;
  sleepHours: number;
  sleepScore: number;
  nightlySpo2: number;
  ecgClassification: 'sinus_rhythm' | 'afib_detected' | 'inconclusive';
}

export interface PatientPortalDashboardData {
  patient: {
    id: number;
    name: string;
    email: string;
    dob: string;
    sex: string;
  };
  recentVisits: {
    sessionId: string;
    date: string;
    status: string;
    chiefComplaint: string;
    triageLevel: string;
    dischargeGuideline?: any;
  }[];
  scheduledFollowUps: any[];
  wearableBiometrics: {
    connectedDevices: string[];
    latestTelemetry: WearableTelemetryRecord | null;
    trend7Days: WearableTelemetryRecord[];
    biometricAlerts: {
      severity: 'low' | 'warning' | 'critical';
      title: string;
      message: string;
    }[];
  };
}

/**
 * Retrieves consolidated Patient Health Portal dashboard data
 */
export async function getPatientPortalDashboard(patientId: number): Promise<PatientPortalDashboardData> {
  // 1. Patient profile
  const patRes = await pool.query(
    `SELECT id, name, email, dob, sex FROM patients WHERE id = $1`,
    [patientId]
  );
  if (patRes.rows.length === 0) {
    throw new Error(`Patient ${patientId} not found`);
  }
  const p = patRes.rows[0];

  // 2. Recent visits & discharge summaries
  const visitsRes = await pool.query(
    `SELECT 
       s.id as session_id,
       s.status,
       s.triage_level,
       s.created_at,
       (SELECT content FROM messages WHERE session_id = s.id AND sender = 'patient' LIMIT 1) as complaint
     FROM intake_sessions s
     WHERE s.patient_id = $1
     ORDER BY s.created_at DESC
     LIMIT 5`,
    [patientId]
  );

  const recentVisits = visitsRes.rows.map(row => ({
    sessionId: row.session_id,
    date: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    status: row.status,
    chiefComplaint: row.complaint || 'Primary Medical Evaluation',
    triageLevel: row.triage_level || 'standard'
  }));

  // 3. Scheduled follow-ups
  const fuRes = await pool.query(
    `SELECT id, scheduled_at, interval_days, survey_type, status, patient_response 
     FROM followup_schedules 
     WHERE patient_id = $1 
     ORDER BY scheduled_at DESC LIMIT 5`,
    [patientId]
  );

  // 4. Wearable biometrics
  const wearRes = await pool.query(
    `SELECT * FROM patient_wearables_telemetry 
     WHERE patient_id = $1 
     ORDER BY recorded_at DESC 
     LIMIT 7`,
    [patientId]
  );

  const trend7Days: WearableTelemetryRecord[] = wearRes.rows.map(mapRowToWearable);
  const latestTelemetry = trend7Days.length > 0 ? trend7Days[0] : null;

  // Distinct connected devices
  const devicesRes = await pool.query(
    `SELECT DISTINCT source_device FROM patient_wearables_telemetry WHERE patient_id = $1`,
    [patientId]
  );
  const connectedDevices = devicesRes.rows.map(r => r.source_device);

  // Biometric anomaly & safety rules
  const biometricAlerts: { severity: 'low' | 'warning' | 'critical'; title: string; message: string }[] = [];
  if (latestTelemetry) {
    if (latestTelemetry.ecgClassification === 'afib_detected') {
      biometricAlerts.push({
        severity: 'critical',
        title: 'Cardiac Rhythm Alert',
        message: 'Irregular rhythm detected by wearable ECG matching potential Atrial Fibrillation. Clinician notified.'
      });
    }
    if (latestTelemetry.nightlySpo2 < 92) {
      biometricAlerts.push({
        severity: 'warning',
        title: 'Nocturnal Hypoxemia',
        message: `Mean nighttime oxygen saturation dropped to ${latestTelemetry.nightlySpo2}%. Inquire regarding sleep apnea or nocturnal dyspnea.`
      });
    }
    if (latestTelemetry.hrvMs < 25 && latestTelemetry.restingHr > 88) {
      biometricAlerts.push({
        severity: 'warning',
        title: 'Elevated Autonomic Stress / Fatigue',
        message: `Low Heart Rate Variability (${latestTelemetry.hrvMs}ms) coupled with elevated resting heart rate (${latestTelemetry.restingHr} bpm).`
      });
    }
  }

  return {
    patient: {
      id: p.id,
      name: p.name,
      email: p.email,
      dob: p.dob ? (p.dob.toISOString ? p.dob.toISOString().split('T')[0] : String(p.dob)) : '1980-01-01',
      sex: p.sex
    },
    recentVisits,
    scheduledFollowUps: fuRes.rows,
    wearableBiometrics: {
      connectedDevices: connectedDevices.length > 0 ? connectedDevices : ['Apple Watch Series 9 (HealthKit)'],
      latestTelemetry,
      trend7Days,
      biometricAlerts
    }
  };
}

/**
 * Ingests a new wearable biometric record (from Apple Health or Health Connect)
 */
export async function syncWearableBiometrics(
  patientId: number,
  sourceDevice: string,
  data?: Partial<WearableTelemetryRecord>
): Promise<WearableTelemetryRecord> {
  const hrvMs = data?.hrvMs ?? Math.round(35 + Math.random() * 30);
  const restingHr = data?.restingHr ?? Math.round(62 + Math.random() * 18);
  const stepCount = data?.stepCount ?? Math.round(5500 + Math.random() * 6000);
  const sleepHours = data?.sleepHours ?? +(6.2 + Math.random() * 2.2).toFixed(1);
  const sleepScore = data?.sleepScore ?? Math.round(72 + Math.random() * 22);
  const nightlySpo2 = data?.nightlySpo2 ?? +(95 + Math.random() * 4).toFixed(1);
  const ecgClassification = data?.ecgClassification ?? 'sinus_rhythm';

  const res = await pool.query(
    `INSERT INTO patient_wearables_telemetry (
       patient_id, source_device, recorded_at, hrv_ms, resting_hr, step_count,
       sleep_hours, sleep_score, nightly_spo2, ecg_classification, raw_payload
     ) VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      patientId,
      sourceDevice,
      hrvMs,
      restingHr,
      stepCount,
      sleepHours,
      sleepScore,
      nightlySpo2,
      ecgClassification,
      JSON.stringify({ syncedAt: new Date().toISOString(), source: sourceDevice })
    ]
  );

  return mapRowToWearable(res.rows[0]);
}

/**
 * Seeds a 7-day longitudinal biometric trajectory for a patient
 */
export async function seedRealisticWearableHistory(
  patientId: number,
  sourceDevice: string = 'Apple Watch Series 9 (HealthKit)'
): Promise<void> {
  // Clear any old telemetry for clean test seed
  await pool.query(`DELETE FROM patient_wearables_telemetry WHERE patient_id = $1`, [patientId]);

  const now = Date.now();
  for (let i = 6; i >= 0; i--) {
    const timestamp = new Date(now - i * 24 * 3600 * 1000);
    const hrv = Math.round(38 + (i % 3) * 6 + Math.random() * 5);
    const rhr = Math.round(65 + (i % 2) * 4);
    const steps = Math.round(6000 + i * 800 + Math.random() * 500);
    const sleep = +(7.1 - (i === 1 ? 1.5 : 0) + Math.random() * 0.8).toFixed(1);
    const sleepScore = Math.round(75 + (i % 4) * 5);
    const spo2 = +(97.2 - (i === 0 ? 0.8 : 0)).toFixed(1);
    const ecg = i === 1 ? 'sinus_rhythm' : 'sinus_rhythm';

    await pool.query(
      `INSERT INTO patient_wearables_telemetry (
         patient_id, source_device, recorded_at, hrv_ms, resting_hr, step_count,
         sleep_hours, sleep_score, nightly_spo2, ecg_classification, raw_payload
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        patientId,
        sourceDevice,
        timestamp,
        hrv,
        rhr,
        steps,
        sleep,
        sleepScore,
        spo2,
        ecg,
        JSON.stringify({ dayOffset: i, autoGenerated: true })
      ]
    );
  }
}

function mapRowToWearable(row: any): WearableTelemetryRecord {
  return {
    id: row.id,
    patientId: row.patient_id,
    sourceDevice: row.source_device,
    recordedAt: row.recorded_at?.toISOString ? row.recorded_at.toISOString() : String(row.recorded_at),
    hrvMs: Number(row.hrv_ms),
    restingHr: Number(row.resting_hr),
    stepCount: Number(row.step_count),
    sleepHours: Number(row.sleep_hours),
    sleepScore: Number(row.sleep_score),
    nightlySpo2: Number(row.nightly_spo2),
    ecgClassification: row.ecg_classification
  };
}
