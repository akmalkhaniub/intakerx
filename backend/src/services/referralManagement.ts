import { query } from '../db';

export interface CreateReferralInput {
  sessionId?: string;
  patientId: number;
  specialty: string;
  priority: 'routine' | 'urgent' | 'emergent';
  reasonForReferral: string;
  provisionalDiagnosisCode?: string;
  targetFacility?: string;
  targetSpecialist?: string;
  referringClinicianId?: number;
}

export interface CreateEConsultInput {
  sessionId?: string;
  patientId: number;
  specialty: string;
  clinicalQuestion: string;
  urgency?: 'standard_48h' | 'stat_24h';
}

export class ReferralManagementService {
  /**
   * Create a new formal specialist referral.
   */
  public async createReferral(input: CreateReferralInput) {
    const res = await query(
      `INSERT INTO specialist_referrals (
        session_id, patient_id, specialty, priority, reason_for_referral,
        provisional_diagnosis_code, target_facility, target_specialist,
        referring_clinician_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'submitted')
      RETURNING *`,
      [
        input.sessionId || null,
        input.patientId,
        input.specialty,
        input.priority,
        input.reasonForReferral,
        input.provisionalDiagnosisCode || null,
        input.targetFacility || 'Regional Academic Medical Center',
        input.targetSpecialist || 'Next Available Specialist',
        input.referringClinicianId || null
      ]
    );
    return res.rows[0];
  }

  /**
   * Update referral lifecycle status and attach return consult notes.
   */
  public async updateReferralStatus(
    referralId: number,
    status: 'submitted' | 'scheduled' | 'completed' | 'consult_note_returned',
    appointmentDate?: string,
    consultSummaryNotes?: string,
    specialistSignature?: string
  ) {
    const res = await query(
      `UPDATE specialist_referrals
       SET status = $1,
           appointment_date = COALESCE($2, appointment_date),
           consult_summary_notes = COALESCE($3, consult_summary_notes),
           specialist_signature = COALESCE($4, specialist_signature),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [
        status,
        appointmentDate ? new Date(appointmentDate) : null,
        consultSummaryNotes || null,
        specialistSignature || null,
        referralId
      ]
    );
    return res.rows[0];
  }

  /**
   * Get all referrals for a session.
   */
  public async getReferralsBySession(sessionId: string) {
    const res = await query(
      `SELECT r.*, p.name as patient_name, p.dob, p.sex
       FROM specialist_referrals r
       JOIN patients p ON r.patient_id = p.id
       WHERE r.session_id = $1
       ORDER BY r.created_at DESC`,
      [sessionId]
    );
    return res.rows;
  }

  /**
   * Get all referrals for a patient.
   */
  public async getReferralsByPatient(patientId: number) {
    const res = await query(
      `SELECT * FROM specialist_referrals WHERE patient_id = $1 ORDER BY created_at DESC`,
      [patientId]
    );
    return res.rows;
  }

  /**
   * Create an Asynchronous e-Consultation Request (CPT 99451).
   */
  public async createEConsult(input: CreateEConsultInput) {
    const res = await query(
      `INSERT INTO e_consult_requests (
        session_id, patient_id, specialty, clinical_question, urgency,
        status, cpt_billing_code
      ) VALUES ($1, $2, $3, $4, $5, 'pending', '99451')
      RETURNING *`,
      [
        input.sessionId || null,
        input.patientId,
        input.specialty,
        input.clinicalQuestion,
        input.urgency || 'standard_48h'
      ]
    );
    return res.rows[0];
  }

  /**
   * Specialist responds to an e-consult request.
   */
  public async respondToEConsult(
    eConsultId: number,
    specialistResponse: string,
    answeringSpecialistId?: number,
    convertToInPerson: boolean = false
  ) {
    const status = convertToInPerson ? 'converted_to_in_person' : 'answered';
    const res = await query(
      `UPDATE e_consult_requests
       SET specialist_response = $1,
           answering_specialist_id = $2,
           status = $3,
           answered_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [specialistResponse, answeringSpecialistId || null, status, eConsultId]
    );
    return res.rows[0];
  }

  /**
   * Get e-consults for a session.
   */
  public async getEConsultsBySession(sessionId: string) {
    const res = await query(
      `SELECT e.*, p.name as patient_name
       FROM e_consult_requests e
       JOIN patients p ON e.patient_id = p.id
       WHERE e.session_id = $1
       ORDER BY e.created_at DESC`,
      [sessionId]
    );
    return res.rows;
  }

  /**
   * Evaluate if a clinical presentation is appropriate for e-Consult triage vs in-person.
   */
  public evaluateEConsultTriageEligibility(specialty: string, clinicalContext: string): {
    recommendedPathway: 'e_consult' | 'in_person_referral';
    rationale: string;
    estimatedTurnaroundHours: number;
    billingCode: string;
  } {
    const lower = (clinicalContext || '').toLowerCase();

    // Red flag symptoms requiring in-person evaluation
    if (lower.includes('syncope') || lower.includes('unstable') || lower.includes('rapid growth') || lower.includes('bleeding')) {
      return {
        recommendedPathway: 'in_person_referral',
        rationale: 'Acuity/symptom profile requires immediate direct physical examination and diagnostic instrumentation.',
        estimatedTurnaroundHours: 24,
        billingCode: '99244'
      };
    }

    // Stable presentations ideal for asynchronous e-consult
    return {
      recommendedPathway: 'e_consult',
      rationale: `Asynchronous peer-to-peer review suitable for ${specialty}. Solves clinical question within 24-48 hours without specialist waitlist delays.`,
      estimatedTurnaroundHours: 48,
      billingCode: '99451'
    };
  }
}

export const referralManagementService = new ReferralManagementService();
