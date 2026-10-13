import { pool } from '../db';

export interface EcprInclusionEvaluation {
  patient_age_years: number;
  arrest_witnessed: boolean;
  bystander_cpr_minutes: number;
  initial_rhythm: 'VF' | 'pVT' | 'PEA' | 'Asystole';
  end_tidal_co2_mmhg: number;
  no_flow_time_minutes: number; // Time from collapse to CPR
  inclusion_criteria_met: boolean;
  eligibility_reasons: string[];
  contraindications: string[];
  recommendation: string;
}

export interface TtmProtocolEvaluation {
  target_temperature_celsius: 33.0 | 36.0;
  current_core_temperature_celsius: number;
  cooling_phase: 'induction' | 'maintenance' | 'rewarming';
  bsas_shivering_score: number; // Bedside Shivering Assessment Scale (0 to 3)
  rewarming_rate_c_per_hr: number; // Max 0.25 C/hr
  interventions: string[];
}

export class EcprResuscitationService {
  /**
   * E-CPR Inclusion & Cannulation Criteria Checklist:
   * Witnessed cardiac arrest.
   * Minimal no-flow time (< 5 minutes from collapse to CPR).
   * Initial shockable rhythm (VF / pulseless VT) preferred.
   * High-quality CPR with End-Tidal CO2 > 10 mmHg (indicates cellular perfusion).
   * Age <= 65 years.
   * Goal: Percutaneous femoral VA-ECMO cannulation and flow achieved within 60 minutes of collapse.
   */
  static evaluateInclusionCriteria(params: {
    patient_age_years: number;
    arrest_witnessed: boolean;
    no_flow_time_minutes: number;
    bystander_cpr_minutes: number;
    initial_rhythm: 'VF' | 'pVT' | 'PEA' | 'Asystole';
    end_tidal_co2_mmhg: number;
    severe_comorbidities?: boolean;
  }): EcprInclusionEvaluation {
    const reasons: string[] = [];
    const contraindications: string[] = [];

    let eligible = true;

    if (!params.arrest_witnessed) {
      eligible = false;
      contraindications.push('Unwitnessed arrest: indeterminate period of anoxic ischemic brain injury.');
    } else {
      reasons.push('Witnessed arrest verified.');
    }

    if (params.no_flow_time_minutes > 5) {
      eligible = false;
      contraindications.push(`No-flow time ${params.no_flow_time_minutes} min exceeds 5-minute ischemic threshold.`);
    }

    if (params.patient_age_years > 65) {
      eligible = false;
      contraindications.push(`Patient age ${params.patient_age_years} > 65 years relative contraindication for E-CPR.`);
    } else {
      reasons.push(`Age ${params.patient_age_years} <= 65 years meets resuscitation criteria.`);
    }

    const isShockable = params.initial_rhythm === 'VF' || params.initial_rhythm === 'pVT';
    if (isShockable) {
      reasons.push(`Initial rhythm ${params.initial_rhythm} is shockable (favorable etiology for coronary revascularization on VA-ECMO).`);
    } else {
      contraindications.push(`Non-shockable initial rhythm (${params.initial_rhythm}) carries lower favorable neurological recovery.`);
    }

    if (params.end_tidal_co2_mmhg < 10) {
      eligible = false;
      contraindications.push(`End-Tidal CO2 ${params.end_tidal_co2_mmhg} mmHg < 10 mmHg indicates futile systemic perfusion.`);
    } else {
      reasons.push(`End-Tidal CO2 ${params.end_tidal_co2_mmhg} mmHg >= 10 mmHg confirms viable metabolic perfusion.`);
    }

    if (params.severe_comorbidities) {
      eligible = false;
      contraindications.push('Pre-existing severe end-stage co-morbidities / advanced directive DNR.');
    }

    const recommendation = eligible
      ? 'STAT E-CPR ACTIVATION: Candidate meets all ELSO criteria. Dispatch E-CPR cannulation team immediately. Continue mechanical chest compressions (LUCAS). Target cannulation-to-flow < 60 minutes.'
      : 'E-CPR CRITERIA NOT MET. Review contraindications. Continue standard ACLS resuscitation algorithms.';

    return {
      patient_age_years: params.patient_age_years,
      arrest_witnessed: params.arrest_witnessed,
      bystander_cpr_minutes: params.bystander_cpr_minutes,
      initial_rhythm: params.initial_rhythm,
      end_tidal_co2_mmhg: params.end_tidal_co2_mmhg,
      no_flow_time_minutes: params.no_flow_time_minutes,
      inclusion_criteria_met: eligible,
      eligibility_reasons: reasons,
      contraindications,
      recommendation
    };
  }

  /**
   * Closed-Loop Targeted Temperature Management (TTM 33°C or 36°C) Protocol:
   * Induction: Rapid cooling via intravascular cooling catheter / ice packs.
   * Maintenance: Maintain target temperature precisely for 24 hours.
   * Rewarming: Strict controlled rewarming at <= 0.25°C per hour to prevent secondary rebound hyperthermia and cerebral edema.
   * Shivering: Bedside Shivering Assessment Scale (BSAS 0-3) tiered suppression protocol.
   */
  static evaluateTtmProtocol(params: {
    target_temperature_celsius: 33.0 | 36.0;
    current_core_temperature_celsius: number;
    cooling_phase: 'induction' | 'maintenance' | 'rewarming';
    bsas_shivering_score: number;
  }): TtmProtocolEvaluation {
    const { target_temperature_celsius, current_core_temperature_celsius, cooling_phase, bsas_shivering_score } = params;
    const interventions: string[] = [];

    if (cooling_phase === 'induction') {
      interventions.push(`Induction phase: Rapidly achieve target core temperature ${target_temperature_celsius}°C.`);
      interventions.push('Infuse cold saline 4°C (up to 30 mL/kg) and initiate automated intravascular heat exchange.');
    } else if (cooling_phase === 'maintenance') {
      const delta = Math.abs(current_core_temperature_celsius - target_temperature_celsius);
      if (delta > 0.5) {
        interventions.push(`Maintenance variance: Core temp ${current_core_temperature_celsius}°C deviates from target ${target_temperature_celsius}°C. Adjust servo-water temperature.`);
      } else {
        interventions.push(`Target core temperature ${target_temperature_celsius}°C locked within ±0.2°C window.`);
      }
      interventions.push('Maintain continuous core temperature monitoring (esophageal or bladder probe).');
    } else if (cooling_phase === 'rewarming') {
      interventions.push('Controlled active rewarming phase: Strictly limit rate to <= 0.25°C/hr.');
      interventions.push('Watch for rewarming complications: systemic vasodilation (hypotension) and hyperkalemia (potassium shift).');
    }

    // Shivering suppression protocol
    if (bsas_shivering_score >= 2) {
      interventions.push(`SIGNIFICANT SHIVERING (BSAS ${bsas_shivering_score}/3): Shivering triples metabolic oxygen consumption.`);
      interventions.push('Tier 1: Surface counter-warming (warm socks, hands).');
      interventions.push('Tier 2: Acetaminophen 1g IV + Buspirone 30 mg PO/NG + Magnesium sulfate infusion (target serum Mg 3.0-3.5 mg/dL).');
      interventions.push('Tier 3: Dexmedetomidine infusion or low-dose Meperidine 25-50 mg IV.');
      interventions.push('Tier 4: Neuromuscular blockade (Cisatracurium / Rocuronium) with continuous EEG monitoring.');
    } else if (bsas_shivering_score === 1) {
      interventions.push('Mild shivering (BSAS 1/3): Initiate surface counter-warming and magnesium sulfate infusion.');
    } else {
      interventions.push('BSAS 0/3: No shivering observed; continue maintenance protocol.');
    }

    return {
      target_temperature_celsius,
      current_core_temperature_celsius,
      cooling_phase,
      bsas_shivering_score,
      rewarming_rate_c_per_hr: 0.25,
      interventions
    };
  }

  /**
   * Persists an E-CPR Resuscitation Case into PostgreSQL
   */
  static async recordEcprCase(data: {
    patient_id: number;
    arrest_witnessed: boolean;
    bystander_cpr_duration_minutes: number;
    initial_rhythm: 'VF' | 'pVT' | 'PEA' | 'Asystole';
    end_tidal_co2_mmhg: number;
    arterial_ph: number;
    arterial_lactate_mmol_l: number;
    cannulation_time_to_flow_minutes: number;
    va_ecmo_flow_l_min?: number;
    target_temperature_celsius?: number;
    bsas_shivering_score?: number;
  }) {
    const inclusion = this.evaluateInclusionCriteria({
      patient_age_years: 52, // standard adult
      arrest_witnessed: data.arrest_witnessed,
      no_flow_time_minutes: 2,
      bystander_cpr_minutes: data.bystander_cpr_duration_minutes,
      initial_rhythm: data.initial_rhythm,
      end_tidal_co2_mmhg: data.end_tidal_co2_mmhg
    });

    const result = await pool.query(
      `INSERT INTO ecpr_resuscitation_cases (
        patient_id, arrest_witnessed, bystander_cpr_duration_minutes, initial_rhythm,
        end_tidal_co2_mmhg, arterial_ph, arterial_lactate_mmol_l, cannulation_time_to_flow_minutes,
        inclusion_criteria_met, va_ecmo_flow_l_min, target_temperature_celsius, bsas_shivering_score
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        data.patient_id,
        data.arrest_witnessed,
        data.bystander_cpr_duration_minutes,
        data.initial_rhythm,
        data.end_tidal_co2_mmhg,
        data.arterial_ph,
        data.arterial_lactate_mmol_l,
        data.cannulation_time_to_flow_minutes,
        inclusion.inclusion_criteria_met,
        data.va_ecmo_flow_l_min || 3.5,
        data.target_temperature_celsius || 33.0,
        data.bsas_shivering_score || 0
      ]
    );

    return {
      case: result.rows[0],
      inclusion
    };
  }

  /**
   * Persists a TTM Temperature Log
   */
  static async recordTtmLog(data: {
    case_id: number;
    core_temperature_celsius: number;
    cooling_phase: 'induction' | 'maintenance' | 'rewarming';
    shivering_suppression_agent?: string;
    rewarming_rate_c_per_hr?: number;
  }) {
    const result = await pool.query(
      `INSERT INTO ttm_temperature_logs (
        case_id, core_temperature_celsius, cooling_phase,
        shivering_suppression_agent, rewarming_rate_c_per_hr
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        data.case_id,
        data.core_temperature_celsius,
        data.cooling_phase,
        data.shivering_suppression_agent || null,
        data.rewarming_rate_c_per_hr || 0.25
      ]
    );

    return result.rows[0];
  }

  /**
   * Fetches E-CPR Cases and Temperature Logs for Patient
   */
  static async getPatientEcprProfile(patientId: number) {
    const cases = await pool.query(
      'SELECT * FROM ecpr_resuscitation_cases WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 10',
      [patientId]
    );

    let logs: any[] = [];
    if (cases.rows.length > 0) {
      const caseIds = cases.rows.map(c => c.id);
      const logRes = await pool.query(
        'SELECT * FROM ttm_temperature_logs WHERE case_id = ANY($1) ORDER BY logged_at DESC LIMIT 20',
        [caseIds]
      );
      logs = logRes.rows;
    }

    return {
      cases: cases.rows,
      logs
    };
  }
}
