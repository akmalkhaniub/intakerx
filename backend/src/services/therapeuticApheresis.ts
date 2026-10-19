import { pool } from '../db';

export type AsfaIndication =
  | 'TTP'
  | 'guillain_barre'
  | 'myasthenic_crisis'
  | 'anti_gbm_goodpasture'
  | 'cidp'
  | 'hyperviscosity_myeloma'
  | 'catastrophic_aps'
  | 'nmosd'
  | 'hashimoto_encephalopathy'
  | 'severe_sle_cerebritis';

export interface AsfaGuidanceResult {
  indication: AsfaIndication;
  category: 'CATEGORY_I' | 'CATEGORY_II' | 'CATEGORY_III';
  evidence_grade: string;
  first_line_indication: boolean;
  recommended_replacement_fluid: 'FRESH_FROZEN_PLASMA' | 'ALBUMIN_5_PERCENT' | 'COMBINATION_ALBUMIN_FFP';
  recommended_tpv_range: string;
  recommended_frequency: string;
  clinical_summary: string;
}

export interface PlasmicScoreInput {
  platelet_count_k: number; // < 30k = 1 pt
  hemolysis_present: boolean; // retics > 2.5%, undetectable haptoglobin, indirect bili > 2 = 1 pt
  active_cancer_in_past_year: boolean; // No = 1 pt
  stem_cell_or_organ_transplant: boolean; // No = 1 pt
  mcv_fl: number; // < 90 fL = 1 pt
  inr: number; // < 1.5 = 1 pt
  creatinine_mg_dl: number; // < 2.0 mg/dL = 1 pt
  adamts13_activity_percent?: number; // < 10% diagnostic for TTP
}

export interface PlasmicScoreResult {
  score: number;
  risk_category: 'LOW' | 'INTERMEDIATE' | 'HIGH';
  severe_adamts13_deficiency_probability_percent: number;
  immediate_tpe_required: boolean;
  platelet_transfusion_contraindicated: boolean;
  black_box_warning?: string;
  management_plan: string[];
}

export interface PlasmaVolumeInput {
  weight_kg: number;
  gender: 'MALE' | 'FEMALE';
  hematocrit_percent: number;
  prescribed_tpv_fraction: number; // e.g., 1.0, 1.2, 1.5
}

export interface PlasmaVolumeResult {
  total_blood_volume_ml: number;
  total_plasma_volume_ml: number;
  target_exchange_volume_ml: number;
  solute_removal_fraction_percent: number; // (1 - e^-x) * 100
  formula_basis: string;
}

export interface CitrateCalciumInput {
  systemic_ionized_calcium_mmol_l: number; // Normal 1.10 - 1.30 mmol/L
  acda_infusion_rate_ml_min?: number;
  calcium_gluconate_prophylactic_rate_ml_hr?: number;
  clinical_symptoms_present: boolean; // perioral tingling, cramps, tetany, QTc prolonged
}

export interface CitrateCalciumResult {
  hypocalcemia_alert: boolean;
  calcium_status: 'NORMAL' | 'MILD_HYPOCALCEMIA' | 'SEVERE_CRITICAL_HYPOCALCEMIA';
  emergency_calcium_bolus_required: boolean;
  bolus_dose_instructions?: string;
  continuous_infusion_adjustment: string;
  cardiac_warning?: string;
  actionable_checklist: string[];
}

export class TherapeuticApheresisService {
  /**
   * Retrieves ASFA Category, replacement fluid, and frequency standards
   */
  static evaluateAsfaGuidance(indication: AsfaIndication): AsfaGuidanceResult {
    switch (indication) {
      case 'TTP':
        return {
          indication,
          category: 'CATEGORY_I',
          evidence_grade: '1A (Strong recommendation, high-quality evidence)',
          first_line_indication: true,
          recommended_replacement_fluid: 'FRESH_FROZEN_PLASMA',
          recommended_tpv_range: '1.0 to 1.5 TPV',
          recommended_frequency: 'Daily until platelet count > 150k and normal LDH for 2 consecutive days',
          clinical_summary: 'TTP is a medical emergency. Immediate TPE replaces deficient ADAMTS13 protease and removes ultra-large VWF multimers.'
        };

      case 'guillain_barre':
        return {
          indication,
          category: 'CATEGORY_I',
          evidence_grade: '1A',
          first_line_indication: true,
          recommended_replacement_fluid: 'ALBUMIN_5_PERCENT',
          recommended_tpv_range: '1.0 to 1.5 TPV',
          recommended_frequency: '5 exchanges over 7 to 14 days',
          clinical_summary: 'Equivalent efficacy to IVIG in halting demyelinating motor neuropathy. Albumin 5% preferred over FFP.'
        };

      case 'myasthenic_crisis':
        return {
          indication,
          category: 'CATEGORY_I',
          evidence_grade: '1B',
          first_line_indication: true,
          recommended_replacement_fluid: 'ALBUMIN_5_PERCENT',
          recommended_tpv_range: '1.0 to 1.5 TPV',
          recommended_frequency: 'Every other day for 4 to 6 exchanges',
          clinical_summary: 'Rapid clearance of anti-AChR or anti-MuSK antibodies to restore neuromuscular junction transmission and avert respiratory failure.'
        };

      case 'anti_gbm_goodpasture':
        return {
          indication,
          category: 'CATEGORY_I',
          evidence_grade: '1A',
          first_line_indication: true,
          recommended_replacement_fluid: 'COMBINATION_ALBUMIN_FFP',
          recommended_tpv_range: '1.0 TPV',
          recommended_frequency: 'Daily or alternate days for 14 days with cyclophosphamide & high-dose steroids',
          clinical_summary: 'Rapid clearance of anti-GBM IgG prevents irreversible crescentic glomerulonephritis and alveolar hemorrhage. Use FFP if diffuse pulmonary hemorrhage.'
        };

      case 'cidp':
        return {
          indication,
          category: 'CATEGORY_I',
          evidence_grade: '1B',
          first_line_indication: true,
          recommended_replacement_fluid: 'ALBUMIN_5_PERCENT',
          recommended_tpv_range: '1.0 to 1.5 TPV',
          recommended_frequency: '2-3 exchanges weekly for 2-3 weeks, then maintenance taper',
          clinical_summary: 'Indicated for refractory motor impairment or severe exacerbations in chronic inflammatory demyelinating polyneuropathy.'
        };

      case 'catastrophic_aps':
        return {
          indication,
          category: 'CATEGORY_I',
          evidence_grade: '1C',
          first_line_indication: true,
          recommended_replacement_fluid: 'FRESH_FROZEN_PLASMA',
          recommended_tpv_range: '1.0 to 1.5 TPV',
          recommended_frequency: 'Daily for at least 3-5 days in combination with therapeutic heparin and steroids',
          clinical_summary: 'CAPS storm requires immediate removal of antiphospholipid antibodies and cytokine cascade control.'
        };

      case 'hyperviscosity_myeloma':
        return {
          indication,
          category: 'CATEGORY_I',
          evidence_grade: '1B',
          first_line_indication: true,
          recommended_replacement_fluid: 'ALBUMIN_5_PERCENT',
          recommended_tpv_range: '1.0 to 1.5 TPV',
          recommended_frequency: 'Daily or alternate days until serum viscosity < 3.0 cP or neurological symptoms clear',
          clinical_summary: 'Emergency cytoreduction of monoclonal IgM/IgA/IgG paraprotein to prevent intracranial hemorrhage or retinal vein thrombosis.'
        };

      case 'nmosd':
        return {
          indication,
          category: 'CATEGORY_II',
          evidence_grade: '1B',
          first_line_indication: false,
          recommended_replacement_fluid: 'ALBUMIN_5_PERCENT',
          recommended_tpv_range: '1.0 to 1.5 TPV',
          recommended_frequency: '5-7 exchanges every other day for acute attacks refractory to IV methylprednisolone',
          clinical_summary: 'Targeted removal of Aquaporin-4 (AQP4-IgG) or MOG antibodies to salvage optic nerve and spinal cord function.'
        };

      case 'severe_sle_cerebritis':
        return {
          indication,
          category: 'CATEGORY_II',
          evidence_grade: '2C',
          first_line_indication: false,
          recommended_replacement_fluid: 'ALBUMIN_5_PERCENT',
          recommended_tpv_range: '1.0 TPV',
          recommended_frequency: 'Alternate days for 3-6 procedures alongside pulse cyclophosphamide',
          clinical_summary: 'Adjunctive rescue therapy in life-threatening lupus cerebritis or diffuse pulmonary hemorrhage.'
        };

      case 'hashimoto_encephalopathy':
      default:
        return {
          indication,
          category: 'CATEGORY_II',
          evidence_grade: '2C',
          first_line_indication: false,
          recommended_replacement_fluid: 'ALBUMIN_5_PERCENT',
          recommended_tpv_range: '1.0 TPV',
          recommended_frequency: '3 to 5 exchanges',
          clinical_summary: 'Clears antithyroid antibodies in steroid-refractory encephalopathy.'
        };
    }
  }

  /**
   * Evaluates the PLASMIC Score for suspected TTP and enforces safety interlocks
   */
  static evaluatePlasmicScore(input: PlasmicScoreInput): PlasmicScoreResult {
    let score = 0;

    if (input.platelet_count_k < 30) score++;
    if (input.hemolysis_present) score++;
    if (!input.active_cancer_in_past_year) score++;
    if (!input.stem_cell_or_organ_transplant) score++;
    if (input.mcv_fl < 90) score++;
    if (input.inr < 1.5) score++;
    if (input.creatinine_mg_dl < 2.0) score++;

    let category: 'LOW' | 'INTERMEDIATE' | 'HIGH';
    let probabilityPercent = 4;
    const plan: string[] = [];
    let warning: string | undefined = undefined;

    if (score >= 6) {
      category = 'HIGH';
      probabilityPercent = score === 7 ? 82 : 68;
      warning = 'CRITICAL BLACK-BOX SAFETY INTERLOCK: PLATELET TRANSFUSION IS STRICTLY CONTRAINDICATED IN TTP. Transfusing platelets fuels widespread microvascular thrombosis, triggering acute myocardial infarction, stroke, or sudden death. Transfuse ONLY in the setting of catastrophic, life-threatening intracranial hemorrhage.';
      plan.push('INITIATE EMERGENT THERAPEUTIC PLASMA EXCHANGE (TPE) IMMEDIATELY with 1.0 - 1.5 TPV Fresh Frozen Plasma (FFP). Do NOT delay TPE for ADAMTS13 lab confirmation.');
      plan.push('Corticosteroid Pulse: IV Methylprednisolone 1g daily for 3 days, followed by oral prednisone 1 mg/kg.');
      plan.push('Targeted Anti-vWF Nanobody: Administer Caplacizumab 10mg IV bolus prior to first TPE, followed by 10mg SubQ daily.');
      plan.push('Draw pre-treatment citrated plasma tube for ADAMTS13 activity and inhibitor titer before any plasma administration.');
    } else if (score === 5) {
      category = 'INTERMEDIATE';
      probabilityPercent = 23;
      plan.push('Intermediate risk for severe ADAMTS13 deficiency. Expedite STAT ADAMTS13 assay.');
      plan.push('Consider trial TPE if clinical condition is deteriorating or microangiopathic hemolytic anemia progresses.');
    } else {
      category = 'LOW';
      probabilityPercent = 4;
      plan.push('Low probability of severe ADAMTS13 deficiency (< 10%). Investigate alternative etiologies: HUS, DIC, HELLP syndrome, sepsis-induced coagulopathy, severe B12 deficiency.');
    }

    if (input.adamts13_activity_percent !== undefined) {
      if (input.adamts13_activity_percent < 10) {
        plan.unshift(`CONFIRMED TTP: ADAMTS13 Activity is ${input.adamts13_activity_percent}% (< 10% diagnostic threshold). Continue daily TPE.`);
      } else {
        plan.unshift(`ADAMTS13 Activity is ${input.adamts13_activity_percent}% (>= 10%). TTP is less likely; consider discontinuing TPE if alternative diagnosis identified.`);
      }
    }

    return {
      score,
      risk_category: category,
      severe_adamts13_deficiency_probability_percent: probabilityPercent,
      immediate_tpe_required: category === 'HIGH',
      platelet_transfusion_contraindicated: category === 'HIGH',
      black_box_warning: warning,
      management_plan: plan
    };
  }

  /**
   * Calculates Total Blood Volume (TBV), Total Plasma Volume (TPV), and Target Exchange Volume
   */
  static calculatePlasmaVolume(input: PlasmaVolumeInput): PlasmaVolumeResult {
    // Formula: TBV = Weight (kg) * (70 mL/kg for Male, 65 mL/kg for Female)
    const factor = input.gender === 'MALE' ? 70 : 65;
    const tbv = Math.round(input.weight_kg * factor);

    // TPV = TBV * (1 - Hematocrit)
    const hctFraction = input.hematocrit_percent / 100;
    const tpv = Math.round(tbv * (1 - hctFraction));

    // Target Exchange Volume
    const targetVolume = Math.round(tpv * input.prescribed_tpv_fraction);

    // Solute Removal: (1 - e^-x) * 100%
    const removalFraction = Math.round((1 - Math.exp(-input.prescribed_tpv_fraction)) * 1000) / 10;

    return {
      total_blood_volume_ml: tbv,
      total_plasma_volume_ml: tpv,
      target_exchange_volume_ml: targetVolume,
      solute_removal_fraction_percent: removalFraction,
      formula_basis: `TBV = ${input.weight_kg}kg × ${factor} mL/kg; TPV = TBV × (1 - ${input.hematocrit_percent}%); Exchange = ${input.prescribed_tpv_fraction} × TPV`
    };
  }

  /**
   * Evaluates ACD-A Citrate Anticoagulation & Ionized Hypocalcemia Sentinel
   */
  static evaluateCitrateCalciumSafety(input: CitrateCalciumInput): CitrateCalciumResult {
    const ica = input.systemic_ionized_calcium_mmol_l;
    const actions: string[] = [];

    let status: 'NORMAL' | 'MILD_HYPOCALCEMIA' | 'SEVERE_CRITICAL_HYPOCALCEMIA' = 'NORMAL';
    let isAlert = false;
    let emergencyBolus = false;
    let bolusText: string | undefined = undefined;
    let cardWarning: string | undefined = undefined;
    let continuousAdjustment = 'Maintain standard prophylactic Calcium Gluconate infusion (10-20 mL/hr of 10% solution).';

    if (ica < 0.90 || (ica < 1.00 && input.clinical_symptoms_present)) {
      status = 'SEVERE_CRITICAL_HYPOCALCEMIA';
      isAlert = true;
      emergencyBolus = true;
      bolusText = 'STAT IV PUSH: Administer 2 grams (20 mL) of 10% Calcium Gluconate IV over 10-15 minutes with continuous EKG rhythm strip monitoring.';
      cardWarning = 'CRITICAL QTc PROLONGATION & VENTRICULAR ARRHYTHMIA HAZARD. Citrate accumulation binding ionized calcium.';
      continuousAdjustment = 'Increase continuous prophylactic Calcium Gluconate infusion by 50-100% (e.g. up to 30-40 mL/hr); decrease apheresis blood inlet flow rate.';
      actions.push('Administer immediate emergency Calcium Gluconate bolus.');
      actions.push('Slow blood inlet flow rate and reduce ACD-A infusion ratio from 10:1 to 15:1 or 20:1.');
      actions.push('Repeat ionized calcium check via blood gas analyzer in 15 minutes.');
    } else if (ica < 1.10) {
      status = 'MILD_HYPOCALCEMIA';
      isAlert = true;
      continuousAdjustment = 'Increase prophylactic Calcium Gluconate infusion by 25-50% (e.g. increase from 15 mL/hr to 22 mL/hr).';
      actions.push('Mild ionized hypocalcemia detected. Increase calcium infusion rate.');
      actions.push('Assess patient for perioral tingling, finger numbness, or Chvostek sign.');
    } else {
      status = 'NORMAL';
      actions.push('Ionized calcium is in optimal target physiological window (1.10 - 1.30 mmol/L). Continue routine protocol monitoring.');
    }

    return {
      hypocalcemia_alert: isAlert,
      calcium_status: status,
      emergency_calcium_bolus_required: emergencyBolus,
      bolus_dose_instructions: bolusText,
      continuous_infusion_adjustment: continuousAdjustment,
      cardiac_warning: cardWarning,
      actionable_checklist: actions
    };
  }

  /**
   * Persists an Apheresis Procedure order/configuration in the database
   */
  static async saveApheresisProcedure(params: {
    patient_id: number;
    asfa_indication: string;
    asfa_category: string;
    plasmic_score?: number;
    adamts13_activity_percent?: number;
    total_plasma_volume_ml: number;
    prescribed_exchange_tpv_fraction: number;
    total_exchange_volume_ml: number;
    replacement_fluid: string;
    platelet_transfusion_contraindicated: boolean;
    calcium_infusion_active: boolean;
  }) {
    const query = `
      INSERT INTO apheresis_procedures (
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
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `;
    const values = [
      params.patient_id,
      params.asfa_indication,
      params.asfa_category,
      params.plasmic_score || null,
      params.adamts13_activity_percent || null,
      params.total_plasma_volume_ml,
      params.prescribed_exchange_tpv_fraction,
      params.total_exchange_volume_ml,
      params.replacement_fluid,
      params.platelet_transfusion_contraindicated,
      params.calcium_infusion_active
    ];
    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  /**
   * Logs real-time plasma exchange telemetry & citrate/calcium metrics
   */
  static async logPlasmaExchangeTelemetry(params: {
    procedure_id: number;
    patient_id: number;
    blood_processed_ml: number;
    plasma_removed_ml: number;
    replacement_administered_ml: number;
    acda_citrate_volume_ml: number;
    systemic_ionized_calcium_mmol_l: number;
    calcium_gluconate_infused_g: number;
    hypocalcemia_alert: boolean;
    circuit_pressure_inlet_mmhg?: number;
  }) {
    const query = `
      INSERT INTO plasma_exchange_logs (
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
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `;
    const values = [
      params.procedure_id,
      params.patient_id,
      params.blood_processed_ml,
      params.plasma_removed_ml,
      params.replacement_administered_ml,
      params.acda_citrate_volume_ml,
      params.systemic_ionized_calcium_mmol_l,
      params.calcium_gluconate_infused_g,
      params.hypocalcemia_alert,
      params.circuit_pressure_inlet_mmhg || null
    ];
    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  /**
   * Retrieves apheresis procedures and exchange telemetry logs for a patient
   */
  static async getPatientApheresisHistory(patientId: number) {
    const procQuery = `
      SELECT * FROM apheresis_procedures
      WHERE patient_id = $1
      ORDER BY created_at DESC
      LIMIT 20;
    `;
    const logsQuery = `
      SELECT * FROM plasma_exchange_logs
      WHERE patient_id = $1
      ORDER BY logged_at DESC
      LIMIT 20;
    `;
    const [procRes, logsRes] = await Promise.all([
      pool.query(procQuery, [patientId]),
      pool.query(logsQuery, [patientId])
    ]);
    return {
      procedures: procRes.rows,
      telemetry_logs: logsRes.rows
    };
  }
}
