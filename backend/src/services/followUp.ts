import { pool } from '../db';
import { notificationBus } from '../notifications';

export interface PatientFollowUpResponse {
  severityChange: 'much_better' | 'slightly_better' | 'unchanged' | 'worse' | 'much_worse';
  symptomsResolved: boolean;
  takingMedsAsPrescribed: boolean;
  adverseEffectsReported?: string;
  notes?: string;
}

export interface FollowUpSchedule {
  id: number;
  sessionId: string;
  patientId: number;
  scheduledAt: string;
  intervalDays: number;
  surveyType: 'symptom_resolution' | 'medication_adherence' | 'wound_check' | 'cardiac_vital_check' | 'satisfaction';
  status: 'pending' | 'sent' | 'responded' | 'overdue' | 'escalated';
  patientResponse?: PatientFollowUpResponse;
  clinicianNotes?: string;
  createdAt: string;
  updatedAt: string;
  patientName?: string;
  chiefComplaint?: string;
}

export class FollowUpService {
  /**
   * Schedule automated follow-up check-ins based on clinical encounter protocol
   */
  static async scheduleProtocol(
    sessionId: string,
    protocolType: 'standard_48h' | 'cardiac_intensive' | 'surgical_wound' = 'standard_48h'
  ): Promise<FollowUpSchedule[]> {
    const sessionRes = await pool.query(
      `SELECT s.id, s.patient_id, p.name as patient_name 
       FROM intake_sessions s
       JOIN patients p ON s.patient_id = p.id
       WHERE s.id = $1`,
      [sessionId]
    );

    if (sessionRes.rowCount === 0) {
      throw new Error(`Encounter session ${sessionId} not found`);
    }

    const { patient_id } = sessionRes.rows[0];

    // Define protocol intervals and surveys
    let intervals: Array<{ days: number; surveyType: FollowUpSchedule['surveyType']; notes: string }> = [];

    if (protocolType === 'cardiac_intensive') {
      intervals = [
        { days: 1, surveyType: 'symptom_resolution', notes: '24-hour acute chest discomfort / dyspnea check' },
        { days: 3, surveyType: 'cardiac_vital_check', notes: '72-hour pulse, blood pressure & nitro tolerance review' },
        { days: 14, surveyType: 'medication_adherence', notes: '2-week cardiology regimen adherence audit' }
      ];
    } else if (protocolType === 'surgical_wound') {
      intervals = [
        { days: 3, surveyType: 'wound_check', notes: 'Day 3 wound erythema / drainage check' },
        { days: 7, surveyType: 'symptom_resolution', notes: 'Day 7 pain control and mobility review' },
        { days: 14, surveyType: 'satisfaction', notes: 'Day 14 suture removal readiness & discharge sign-off' }
      ];
    } else {
      intervals = [
        { days: 2, surveyType: 'symptom_resolution', notes: '48-hour symptom resolution check' },
        { days: 7, surveyType: 'medication_adherence', notes: '7-day prescription compliance audit' }
      ];
    }

    const created: FollowUpSchedule[] = [];
    for (const item of intervals) {
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + item.days);

      const res = await pool.query(
        `INSERT INTO followup_schedules 
         (session_id, patient_id, scheduled_at, interval_days, survey_type, status, clinician_notes)
         VALUES ($1, $2, $3, $4, $5, 'pending', $6)
         RETURNING *`,
        [sessionId, patient_id, scheduledDate.toISOString(), item.days, item.surveyType, item.notes]
      );
      created.push(this.formatRow(res.rows[0]));
    }

    return created;
  }

  /**
   * Schedule a custom follow-up check-in
   */
  static async scheduleCustomFollowUp(
    sessionId: string,
    intervalDays: number,
    surveyType: FollowUpSchedule['surveyType'],
    clinicianNotes?: string
  ): Promise<FollowUpSchedule> {
    const sessionRes = await pool.query(
      `SELECT patient_id FROM intake_sessions WHERE id = $1`,
      [sessionId]
    );
    if (sessionRes.rowCount === 0) {
      throw new Error(`Encounter session ${sessionId} not found`);
    }

    const patient_id = sessionRes.rows[0].patient_id;
    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + intervalDays);

    const res = await pool.query(
      `INSERT INTO followup_schedules 
       (session_id, patient_id, scheduled_at, interval_days, survey_type, status, clinician_notes)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6)
       RETURNING *`,
      [sessionId, patient_id, scheduledDate.toISOString(), intervalDays, surveyType, clinicianNotes || '']
    );

    return this.formatRow(res.rows[0]);
  }

  /**
   * Record patient check-in response and auto-escalate if deterioration or non-adherence is detected
   */
  static async recordPatientResponse(
    followupId: number,
    response: PatientFollowUpResponse
  ): Promise<{ followup: FollowUpSchedule; escalated: boolean }> {
    const checkRes = await pool.query(
      `SELECT f.*, p.name as patient_name 
       FROM followup_schedules f
       JOIN patients p ON f.patient_id = p.id
       WHERE f.id = $1`,
      [followupId]
    );

    if (checkRes.rowCount === 0) {
      throw new Error(`Follow-up schedule #${followupId} not found`);
    }

    const current = checkRes.rows[0];

    // Evaluate clinical deterioration triggers
    const isWorsening = response.severityChange === 'worse' || response.severityChange === 'much_worse';
    const isNonAdherent = response.takingMedsAsPrescribed === false;
    const isAdverseEffect = !!response.adverseEffectsReported && response.adverseEffectsReported.trim().length > 0;

    const escalated = isWorsening || (isNonAdherent && isWorsening) || isAdverseEffect;
    const nextStatus = escalated ? 'escalated' : 'responded';

    const updateRes = await pool.query(
      `UPDATE followup_schedules
       SET status = $1, patient_response = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [nextStatus, JSON.stringify(response), followupId]
    );

    const updated = this.formatRow(updateRes.rows[0]);

    if (escalated) {
      // Trigger instant push notification to clinician notification bus
      notificationBus.push(
        'emergency_triage',
        'Post-Visit Follow-Up Deterioration Alert',
        `Patient ${current.patient_name || 'Encounter'} reported worsening symptoms during ${current.survey_type} check-in: "${response.severityChange}". ${response.notes || ''}`,
        { sessionId: current.session_id, severity: 'critical' }
      );
    }

    return { followup: updated, escalated };
  }

  /**
   * Get all follow-ups for a specific encounter
   */
  static async getFollowUpsForSession(sessionId: string): Promise<FollowUpSchedule[]> {
    const res = await pool.query(
      `SELECT f.*, p.name as patient_name
       FROM followup_schedules f
       JOIN patients p ON f.patient_id = p.id
       WHERE f.session_id = $1
       ORDER BY f.scheduled_at ASC`,
      [sessionId]
    );
    return res.rows.map(r => this.formatRow(r));
  }

  /**
   * Get all follow-ups with optional status filter for the clinic oversight dashboard
   */
  static async getAllFollowUps(filterStatus?: string): Promise<FollowUpSchedule[]> {
    let query = `
      SELECT f.*, p.name as patient_name, s.triage_level
      FROM followup_schedules f
      JOIN patients p ON f.patient_id = p.id
      JOIN intake_sessions s ON f.session_id = s.id
    `;
    const params: any[] = [];
    if (filterStatus && filterStatus !== 'all') {
      query += ` WHERE f.status = $1`;
      params.push(filterStatus);
    }
    query += ` ORDER BY f.scheduled_at ASC LIMIT 100`;

    const res = await pool.query(query, params);
    return res.rows.map(r => this.formatRow(r));
  }

  private static formatRow(row: any): FollowUpSchedule {
    return {
      id: row.id,
      sessionId: row.session_id,
      patientId: row.patient_id,
      scheduledAt: row.scheduled_at,
      intervalDays: row.interval_days,
      surveyType: row.survey_type,
      status: row.status,
      patientResponse: row.patient_response,
      clinicianNotes: row.clinician_notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      patientName: row.patient_name
    };
  }
}
