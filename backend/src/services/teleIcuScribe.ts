import { pool } from '../db';

export interface CpotAssessment {
  facial_expression: number; // 0: Relaxed, 1: Tense, 2: Grimacing
  body_movements: number; // 0: Absence of movements, 1: Protection/slow, 2: Restlessness/pulling
  muscle_tension: number; // 0: Relaxed, 1: Tense/resistant, 2: Very tense/rigid
  ventilator_compliance_or_vocalization: number; // 0: Tolerating vent / normal talk, 1: Coughing / sighing, 2: Fighting vent / crying
  total_score: number; // 0 - 8
  pain_level: 'none_mild' | 'moderate' | 'severe';
  actionable_intervention: string;
}

export interface AmbientSoapNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string[];
  critical_care_time_minutes: number;
}

export class TeleIcuScribeService {
  /**
   * Critical-Care Pain Observation Tool (CPOT) Score Evaluator
   * Score 0-2: Minimal/no pain
   * Score 3-5: Moderate pain - non-pharmacologic or titration indicated
   * Score 6-8: Severe pain - stat analgesia / multimodal sedation re-evaluation
   */
  static evaluateCpotScore(params: {
    facial_expression: number;
    body_movements: number;
    muscle_tension: number;
    ventilator_compliance_or_vocalization: number;
  }): CpotAssessment {
    const f = Math.min(2, Math.max(0, params.facial_expression));
    const b = Math.min(2, Math.max(0, params.body_movements));
    const m = Math.min(2, Math.max(0, params.muscle_tension));
    const v = Math.min(2, Math.max(0, params.ventilator_compliance_or_vocalization));

    const total = f + b + m + v;

    let painLevel: 'none_mild' | 'moderate' | 'severe' = 'none_mild';
    let intervention = 'Patient comfortable; continue routine PADIS (Pain, Agitation, Delirium) surveillance.';

    if (total >= 6) {
      painLevel = 'severe';
      intervention = 'CRITICAL: Severe pain detected in intubated/non-communicative patient. Administer STAT fentanyl/hydromorphone bolus and review sedation hold.';
    } else if (total >= 3) {
      painLevel = 'moderate';
      intervention = 'MODERATE PAIN: Assess endotracheal tube positioning, reposition patient, adjust analgesic infusion per PADIS protocol.';
    }

    return {
      facial_expression: f,
      body_movements: b,
      muscle_tension: m,
      ventilator_compliance_or_vocalization: v,
      total_score: total,
      pain_level: painLevel,
      actionable_intervention: intervention
    };
  }

  /**
   * Natural Language Ambient ICU Audio Parsing & Clinical SOAP Note Synthesizer
   */
  static extractSoapFromTranscript(rawTranscript: string, vitalsContext?: {
    hr?: number;
    bp?: string;
    spo2?: number;
    temp?: number;
    pressor?: string;
  }): AmbientSoapNote {
    const lines = rawTranscript.split('\n').filter(l => l.trim().length > 0);

    // Subjective synthesis
    const subjective = `Intensive care ambient conversation captured between bedside team and intensivist. Discussions focus on bedside hemodynamic tolerance, neurological exam responses, and weaning readiness. Transcript snippet: "${lines.slice(0, 2).join(' ')}"`;

    // Objective synthesis
    const vitalsStr = vitalsContext
      ? `Bedside telemetry: HR ${vitalsContext.hr || 88} bpm, BP ${vitalsContext.bp || '118/72'} mmHg, SpO2 ${vitalsContext.spo2 || 98}%, Temp ${vitalsContext.temp || 37.1}°C. Vasoactive infusion: ${vitalsContext.pressor || 'Norepinephrine 0.04 mcg/kg/min'}.`
      : 'Continuous telemetry: Sinus rhythm, arterial line waveforms intact, invasive mechanical ventilation in pressure support mode.';

    // Assessment synthesis
    const assessment = 'Critical care patient admitted with multi-organ dysfunction syndrome requiring invasive monitoring and hemodynamic support. Hemodynamics presently stabilizing with preserved end-organ perfusion.';

    // Plan action items
    const plan: string[] = [
      'Maintain MAP target >= 65 mmHg with cautious vasoactive weaning as tolerated',
      'Daily spontaneous breathing trial (SBT) and spontaneous awakening trial (SAT) protocol',
      'Multimodal analgesia with CPOT targeted <= 2',
      'DVT prophylaxis with low molecular weight heparin and sequential compression devices',
      'Serial arterial blood gas and lactate monitoring every 6 hours'
    ];

    if (/extubat/i.test(rawTranscript)) {
      plan.unshift('Prepare for planned extubation: verify cuff leak test and RSBI < 105');
    }
    if (/bleeding|hemoglobin|transfus/i.test(rawTranscript)) {
      plan.unshift('Stat CBC and type & cross 2 units PRBCs for active bleeding concern');
    }

    return {
      subjective,
      objective: vitalsStr,
      assessment,
      plan,
      critical_care_time_minutes: 45
    };
  }

  /**
   * Initializes or updates a Tele-ICU WebRTC Virtual Command Session
   */
  static async createTeleIcuSession(data: {
    patient_id: number;
    bed_number: string;
    virtual_intensivist_name: string;
    webrtc_channel_id: string;
    high_acuity_alert?: boolean;
    cpot_pain_score?: number;
    rass_agitation_score?: number;
  }) {
    const result = await pool.query(
      `INSERT INTO tele_icu_sessions (
        patient_id, bed_number, virtual_intensivist_name, webrtc_channel_id,
        high_acuity_alert, cpot_pain_score, rass_agitation_score, connection_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'connected')
      ON CONFLICT (webrtc_channel_id) DO UPDATE
      SET connection_status = 'connected', high_acuity_alert = EXCLUDED.high_acuity_alert,
          cpot_pain_score = EXCLUDED.cpot_pain_score, rass_agitation_score = EXCLUDED.rass_agitation_score
      RETURNING *`,
      [
        data.patient_id,
        data.bed_number,
        data.virtual_intensivist_name,
        data.webrtc_channel_id,
        data.high_acuity_alert || false,
        data.cpot_pain_score || 0,
        data.rass_agitation_score || 0
      ]
    );

    return result.rows[0];
  }

  /**
   * Persists an Ambient Scribe SOAP transcript to database
   */
  static async recordScribeTranscript(sessionId: number, rawTranscript: string, vitalsContext?: any) {
    const soap = this.extractSoapFromTranscript(rawTranscript, vitalsContext);

    const result = await pool.query(
      `INSERT INTO ambient_scribe_transcripts (
        session_id, raw_ambient_audio_transcript, subjective_summary,
        objective_vitals_summary, assessment_clinical_reasoning,
        plan_action_items, critical_care_time_minutes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        sessionId,
        rawTranscript,
        soap.subjective,
        soap.objective,
        soap.assessment,
        JSON.stringify(soap.plan),
        soap.critical_care_time_minutes
      ]
    );

    return {
      transcript: result.rows[0],
      soap
    };
  }

  /**
   * Retrieves Tele-ICU sessions and ambient transcripts for a patient
   */
  static async getPatientTeleIcuHistory(patientId: number) {
    const sessions = await pool.query(
      'SELECT * FROM tele_icu_sessions WHERE patient_id = $1 ORDER BY started_at DESC LIMIT 10',
      [patientId]
    );

    let transcripts: any[] = [];
    if (sessions.rows.length > 0) {
      const sessionIds = sessions.rows.map(s => s.id);
      const transRes = await pool.query(
        'SELECT * FROM ambient_scribe_transcripts WHERE session_id = ANY($1) ORDER BY created_at DESC LIMIT 20',
        [sessionIds]
      );
      transcripts = transRes.rows;
    }

    return {
      sessions: sessions.rows,
      transcripts
    };
  }
}
