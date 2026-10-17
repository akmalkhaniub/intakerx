import { pool } from '../db';

export type PresentationType =
  | 'DKA_MILD'
  | 'DKA_MODERATE'
  | 'DKA_SEVERE'
  | 'HHS'
  | 'MIXED_DKA_HHS'
  | 'EUGLYCEMIC_DKA'
  | 'HYPERGLYCEMIA_UNCOMPLICATED';

export interface MetabolicAssessmentInput {
  blood_glucose_mg_dl: number;
  arterial_ph: number;
  serum_bicarbonate_meq_l: number;
  beta_hydroxybutyrate_mmol_l: number;
  serum_sodium_meq_l: number;
  serum_potassium_meq_l: number;
  serum_chloride_meq_l: number;
  bun_mg_dl: number;
  patient_weight_kg?: number;
  sglt2i_exposure?: boolean;
  mental_status?: 'alert' | 'drowsy' | 'stupor_coma';
}

export interface TwoBagFluidRecommendation {
  bag_1_composition: string;
  bag_1_rate_ml_hr: number;
  bag_2_composition: string;
  bag_2_rate_ml_hr: number;
  target_glucose_window_mg_dl: string;
  potassium_additive_meq_l: number;
}

export interface MetabolicAssessmentResult {
  presentation_type: PresentationType;
  presentation_title: string;
  anion_gap: number;
  corrected_sodium: number;
  effective_osmolality: number;
  potassium_safety: {
    status: 'INSULIN_HOLD_CRITICAL' | 'NORMAL_REPLACE' | 'ELEVATED_MONITOR';
    action: string;
    potassium_repletion_directive: string;
  };
  insulin_protocol: {
    initial_rate_units_hr: number;
    hourly_drop_target_mg_dl: string;
    cerebral_edema_precautions: string[];
  };
  fluid_protocol: TwoBagFluidRecommendation;
  transition_criteria: {
    ready_for_subq_bridge: boolean;
    unmet_criteria: string[];
    bridge_instructions: string;
  };
}

export interface HourlyTitrationInput {
  current_glucose_mg_dl: number;
  previous_glucose_mg_dl: number;
  current_insulin_rate_units_hr: number;
  current_potassium_meq_l: number;
  anion_gap: number;
}

export interface HourlyTitrationResult {
  glucose_drop_rate_mg_dl_hr: number;
  adjusted_insulin_rate_units_hr: number;
  dextrose_required: boolean;
  potassium_action: string;
  drop_rate_assessment: 'OPTIMAL' | 'TOO_SLOW_INCREASE' | 'TOO_FAST_RISK_CEREBRAL_EDEMA';
  recommendations: string[];
}

/**
 * Calculates corrected sodium (Katz formula).
 */
export function calculateCorrectedSodium(measuredNa: number, glucose: number): number {
  if (glucose <= 100) return measuredNa;
  const correction = 0.016 * (glucose - 100);
  return Math.round((measuredNa + correction) * 10) / 10;
}

/**
 * Calculates effective serum osmolality.
 * 2 * Na + Glucose / 18 (BUN omitted as it diffuses freely and does not create effective osmotic gradient)
 */
export function calculateEffectiveOsmolality(sodium: number, glucose: number): number {
  const osmolality = (2 * sodium) + (glucose / 18);
  return Math.round(osmolality * 10) / 10;
}

/**
 * Calculates serum anion gap: Na - (Cl + HCO3).
 */
export function calculateAnionGap(sodium: number, chloride: number, bicarb: number): number {
  return Math.round((sodium - (chloride + bicarb)) * 10) / 10;
}

/**
 * Evaluates DKA vs HHS vs Euglycemic DKA and synthesizes closed-loop resuscitation guidance.
 */
export function evaluateMetabolicKeto(input: MetabolicAssessmentInput): MetabolicAssessmentResult {
  const anionGap = calculateAnionGap(input.serum_sodium_meq_l, input.serum_chloride_meq_l, input.serum_bicarbonate_meq_l);
  const correctedNa = calculateCorrectedSodium(input.serum_sodium_meq_l, input.blood_glucose_mg_dl);
  const effectiveOsm = calculateEffectiveOsmolality(input.serum_sodium_meq_l, input.blood_glucose_mg_dl);

  let type: PresentationType = 'HYPERGLYCEMIA_UNCOMPLICATED';
  let title = 'Hyperglycemia (Uncomplicated)';

  const isAcidosis = input.arterial_ph < 7.30 || input.serum_bicarbonate_meq_l < 18;
  const isKetosis = input.beta_hydroxybutyrate_mmol_l >= 3.0;
  const isHyperosmolar = effectiveOsm >= 320;
  const isSevereHyperglycemia = input.blood_glucose_mg_dl >= 600;

  // 1. Euglycemic DKA check
  if (input.sglt2i_exposure && input.blood_glucose_mg_dl < 250 && isAcidosis && isKetosis) {
    type = 'EUGLYCEMIC_DKA';
    title = 'Euglycemic DKA (SGLT2-Inhibitor Induced)';
  } else if (isSevereHyperglycemia && isHyperosmolar && isAcidosis && isKetosis) {
    type = 'MIXED_DKA_HHS';
    title = 'Mixed Diabetic Ketoacidosis & Hyperosmolar Hyperglycemic State';
  } else if (isSevereHyperglycemia && isHyperosmolar && (!isAcidosis || input.serum_bicarbonate_meq_l >= 18)) {
    type = 'HHS';
    title = 'Hyperosmolar Hyperglycemic State (HHS)';
  } else if (input.blood_glucose_mg_dl > 200 && isAcidosis) {
    if (input.arterial_ph < 7.00 || input.serum_bicarbonate_meq_l < 10) {
      type = 'DKA_SEVERE';
      title = 'Severe Diabetic Ketoacidosis (DKA)';
    } else if (input.arterial_ph < 7.25 || input.serum_bicarbonate_meq_l < 15) {
      type = 'DKA_MODERATE';
      title = 'Moderate Diabetic Ketoacidosis (DKA)';
    } else {
      type = 'DKA_MILD';
      title = 'Mild Diabetic Ketoacidosis (DKA)';
    }
  }

  // 2. Potassium Safety Interlock
  let kStatus: 'INSULIN_HOLD_CRITICAL' | 'NORMAL_REPLACE' | 'ELEVATED_MONITOR' = 'NORMAL_REPLACE';
  let kAction = 'Add 20-30 mEq KCl per liter of IV maintenance fluids.';
  let kDirective = 'Maintain serum potassium strictly between 4.0 - 5.0 mEq/L.';

  if (input.serum_potassium_meq_l < 3.3) {
    kStatus = 'INSULIN_HOLD_CRITICAL';
    kAction = 'CRITICAL ALERT: HOLD INSULIN IMMEDIATELY. Infuse 20-40 mEq/hr IV potassium chloride until serum K+ >= 3.3 mEq/L.';
    kDirective = 'High risk of fatal ventricular arrhythmias / cardiac arrest. Do NOT start insulin until hypokalemia is corrected.';
  } else if (input.serum_potassium_meq_l > 5.3) {
    kStatus = 'ELEVATED_MONITOR';
    kAction = 'Do not add potassium to IV fluids at this time. Re-check serum potassium every 2 hours.';
    kDirective = 'Serum potassium will rapidly shift intracellularly as insulin is infused and acidosis resolves.';
  }

  // 3. Weight-based insulin rate
  const weight = input.patient_weight_kg || 70;
  const initialInsulinRate = kStatus === 'INSULIN_HOLD_CRITICAL' ? 0.0 : Math.round(weight * 0.1 * 10) / 10;

  // 4. Two-Bag Fluid Recommendation
  let bag1 = '0.9% Normal Saline';
  let bag2 = 'D5W with 0.45% Saline + 20 mEq KCl';
  let bag1Rate = 250;
  let bag2Rate = 0;

  if (correctedNa >= 145) {
    bag1 = '0.45% Half-Normal Saline';
  }

  if (input.blood_glucose_mg_dl <= 200 || type === 'EUGLYCEMIC_DKA') {
    bag2Rate = 150;
    bag1Rate = 100;
  }

  // 5. Transition Criteria Check
  const unmetCriteria: string[] = [];
  if (input.blood_glucose_mg_dl >= 200 && type !== 'EUGLYCEMIC_DKA') unmetCriteria.push('Blood glucose >= 200 mg/dL');
  if (input.serum_bicarbonate_meq_l < 18) unmetCriteria.push('Serum bicarbonate < 18 mEq/L');
  if (input.arterial_ph < 7.30) unmetCriteria.push('Arterial pH < 7.30');
  if (anionGap > 12) unmetCriteria.push(`Anion gap open (${anionGap} > 12 mEq/L)`);
  if (input.beta_hydroxybutyrate_mmol_l >= 0.6) unmetCriteria.push(`Beta-hydroxybutyrate elevated (${input.beta_hydroxybutyrate_mmol_l} mmol/L)`);

  const readyForSubq = unmetCriteria.length === 0;
  const bridgeInstructions = readyForSubq
    ? 'Criteria for DKA resolution met. Administer SubQ basal insulin (Glargine 0.2-0.3 units/kg) 2 hours BEFORE stopping IV insulin infusion.'
    : `DKA not yet resolved. Continue IV insulin infusion and two-bag fluids. Pending: ${unmetCriteria.join(', ')}.`;

  return {
    presentation_type: type,
    presentation_title: title,
    anion_gap: anionGap,
    corrected_sodium: correctedNa,
    effective_osmolality: effectiveOsm,
    potassium_safety: {
      status: kStatus,
      action: kAction,
      potassium_repletion_directive: kDirective
    },
    insulin_protocol: {
      initial_rate_units_hr: initialInsulinRate,
      hourly_drop_target_mg_dl: '50 - 75 mg/dL per hour',
      cerebral_edema_precautions: [
        'Do not drop blood glucose faster than 100 mg/dL/hr to avoid precipitous plasma osmolar decline.',
        'When glucose reaches 200 mg/dL (or 300 mg/dL in HHS), immediately add 5% to 10% dextrose to IV fluids while maintaining insulin rate.',
        'Monitor for early headache, lethargy, bradycardia, or neurological deterioration (Cushing triad of cerebral edema).'
      ]
    },
    fluid_protocol: {
      bag_1_composition: bag1,
      bag_1_rate_ml_hr: bag1Rate,
      bag_2_composition: bag2,
      bag_2_rate_ml_hr: bag2Rate,
      target_glucose_window_mg_dl: type === 'HHS' ? '250 - 300 mg/dL' : '150 - 200 mg/dL',
      potassium_additive_meq_l: kStatus === 'NORMAL_REPLACE' ? 20 : 0
    },
    transition_criteria: {
      ready_for_subq_bridge: readyForSubq,
      unmet_criteria: unmetCriteria,
      bridge_instructions: bridgeInstructions
    }
  };
}

/**
 * Evaluates hourly titration and adjusts insulin rate.
 */
export function evaluateHourlyTitration(input: HourlyTitrationInput): HourlyTitrationResult {
  const dropRate = input.previous_glucose_mg_dl - input.current_glucose_mg_dl;
  let adjustedRate = input.current_insulin_rate_units_hr;
  let assessment: 'OPTIMAL' | 'TOO_SLOW_INCREASE' | 'TOO_FAST_RISK_CEREBRAL_EDEMA' = 'OPTIMAL';
  const recommendations: string[] = [];
  let dextroseRequired = false;

  if (input.current_glucose_mg_dl <= 200) {
    dextroseRequired = true;
    recommendations.push('Blood glucose <= 200 mg/dL reached: Initiate D5W or D10W two-bag titration.');
  }

  // Potassium check
  let kAction = 'Potassium within safe range. Continue replacement in fluids.';
  if (input.current_potassium_meq_l < 3.3) {
    adjustedRate = 0.0;
    kAction = 'STAT Potassium < 3.3 mEq/L: PAUSE INSULIN. Administer 20-40 mEq/hr IV KCl piggyback.';
    recommendations.push('Insulin stopped due to hypokalemia.');
  }

  if (adjustedRate > 0) {
    if (dropRate < 50) {
      assessment = 'TOO_SLOW_INCREASE';
      adjustedRate = Math.round((input.current_insulin_rate_units_hr * 1.5) * 10) / 10;
      recommendations.push(`Drop rate ${dropRate} mg/dL/hr is under target (50-75). Increased insulin infusion rate by 50% to ${adjustedRate} units/hr.`);
    } else if (dropRate > 100) {
      assessment = 'TOO_FAST_RISK_CEREBRAL_EDEMA';
      adjustedRate = Math.max(1.0, Math.round((input.current_insulin_rate_units_hr * 0.7) * 10) / 10);
      recommendations.push(`Drop rate ${dropRate} mg/dL/hr exceeds safe limit (100 mg/dL/hr). Reduced insulin infusion rate to ${adjustedRate} units/hr to protect against cerebral edema.`);
    } else {
      assessment = 'OPTIMAL';
      recommendations.push(`Drop rate ${dropRate} mg/dL/hr is on target (50-75). Maintain insulin infusion rate at ${adjustedRate} units/hr.`);
    }
  }

  return {
    glucose_drop_rate_mg_dl_hr: dropRate,
    adjusted_insulin_rate_units_hr: adjustedRate,
    dextrose_required: dextroseRequired,
    potassium_action: kAction,
    drop_rate_assessment: assessment,
    recommendations
  };
}

/**
 * Service Class: MetabolicKetoService
 */
export class MetabolicKetoService {
  /**
   * Evaluates patient presentation and persists encounter to DB.
   */
  static async evaluateAndSaveEncounter(patientId: number, input: MetabolicAssessmentInput) {
    const evaluation = evaluateMetabolicKeto(input);

    const res = await pool.query(`
      INSERT INTO metabolic_keto_encounters (
        patient_id, presentation_type, blood_glucose_mg_dl, arterial_ph,
        serum_bicarbonate_meq_l, beta_hydroxybutyrate_mmol_l, serum_sodium_meq_l,
        serum_potassium_meq_l, serum_chloride_meq_l, bun_mg_dl, anion_gap,
        effective_osmolality_mosm_kg, corrected_sodium_meq_l, sglt2i_inhibitor_exposure,
        two_bag_fluid_composition, insulin_rate_units_hr, subcutaneous_bridge_ready
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *;
    `, [
      patientId,
      evaluation.presentation_type,
      input.blood_glucose_mg_dl,
      input.arterial_ph,
      input.serum_bicarbonate_meq_l,
      input.beta_hydroxybutyrate_mmol_l,
      input.serum_sodium_meq_l,
      input.serum_potassium_meq_l,
      input.serum_chloride_meq_l,
      input.bun_mg_dl,
      evaluation.anion_gap,
      evaluation.effective_osmolality,
      evaluation.corrected_sodium,
      Boolean(input.sglt2i_exposure),
      JSON.stringify(evaluation.fluid_protocol),
      evaluation.insulin_protocol.initial_rate_units_hr,
      evaluation.transition_criteria.ready_for_subq_bridge
    ]);

    return {
      encounter: res.rows[0],
      evaluation
    };
  }

  /**
   * Logs hourly insulin titration event to DB.
   */
  static async logTitration(encounterId: number, input: HourlyTitrationInput) {
    const titrationEval = evaluateHourlyTitration(input);

    const res = await pool.query(`
      INSERT INTO insulin_infusion_logs (
        encounter_id, hourly_glucose_mg_dl, glucose_drop_rate_mg_dl_hr,
        insulin_infusion_units_hr, current_potassium_meq_l, potassium_infusion_meq_hr,
        dextrose_fluid_active, anion_gap_closed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `, [
      encounterId,
      input.current_glucose_mg_dl,
      titrationEval.glucose_drop_rate_mg_dl_hr,
      titrationEval.adjusted_insulin_rate_units_hr,
      input.current_potassium_meq_l,
      input.current_potassium_meq_l < 3.3 ? 20.0 : 0.0,
      titrationEval.dextrose_required,
      input.anion_gap <= 12
    ]);

    return {
      log: res.rows[0],
      evaluation: titrationEval
    };
  }

  /**
   * Retrieves metabolic keto history for a patient.
   */
  static async getPatientMetabolicHistory(patientId: number) {
    const encounters = await pool.query(`
      SELECT * FROM metabolic_keto_encounters
      WHERE patient_id = $1
      ORDER BY created_at DESC;
    `, [patientId]);

    const logs = await pool.query(`
      SELECT l.* FROM insulin_infusion_logs l
      JOIN metabolic_keto_encounters e ON l.encounter_id = e.id
      WHERE e.patient_id = $1
      ORDER BY l.logged_at DESC;
    `, [patientId]);

    return {
      encounters: encounters.rows,
      titration_logs: logs.rows
    };
  }
}
