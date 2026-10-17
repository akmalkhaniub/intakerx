import { pool } from '../db';

export type AssayType = 'ROTEM_DELTA' | 'TEG_5000' | 'TEG_6S';
export type ClinicalScenario = 'trauma_mhp' | 'postpartum_hemorrhage' | 'cardiovascular_or' | 'liver_transplant';
export type AnticoagulantAgent = 'apixaban' | 'rivaroxaban' | 'edoxaban' | 'dabigatran' | 'warfarin' | 'unfractionated_heparin' | 'enoxaparin';
export type BleedingSeverity = 'life_threatening_ich' | 'major_surgical_gastrointestinal' | 'minor_non_life_threatening';

export interface RotemAssayInput {
  assay_type: AssayType;
  clinical_scenario: ClinicalScenario;
  extem_ct_sec?: number;
  intem_ct_sec?: number;
  fibtem_mcf_mm?: number;
  extem_mcf_mm?: number;
  maximum_lysis_percent?: number;
  heptem_ct_sec?: number;
  patient_weight_kg?: number;
}

export interface RotemProductRecommendation {
  product: 'TRANEXAMIC_ACID' | 'FIBRINOGEN_OR_CRYO' | 'PLATELETS' | 'PCC_OR_FFP' | 'PROTAMINE' | 'NONE';
  product_name: string;
  dosage: string;
  rationale: string;
  target_goal: string;
}

export interface RotemAssayResult {
  deficiency_pattern: 'HYPERFIBRINOLYSIS' | 'HYPOFIBRINOGENEMIA' | 'THROMBOCYTOPENIA' | 'FACTOR_DEFICIENCY' | 'HEPARIN_EFFECT' | 'NORMAL_HEMOSTASIS';
  pattern_description: string;
  urgency: 'STAT_HEMORRHAGE_CONTROL' | 'URGENT_CORRECTION' | 'STABLE_MONITOR';
  heparin_effect_detected: boolean;
  recommended_products: RotemProductRecommendation[];
  hemostatic_summary: string;
}

export interface ReversalInput {
  target_agent: AnticoagulantAgent;
  last_dose_hours_ago: number;
  last_dose_mg?: number;
  patient_weight_kg?: number;
  anti_xa_level_iu_ml?: number;
  inr?: number;
  bleeding_severity: BleedingSeverity;
}

export interface ReversalResult {
  target_agent: string;
  reversal_agent: string;
  prescribed_dose: string;
  administration_instructions: string[];
  monitoring_and_precautions: string[];
  rebound_anticoagulation_risk: string;
}

/**
 * Evaluates ROTEM / TEG viscoelastic parameters and delivers product guidance.
 */
export function evaluateRotemAssay(input: RotemAssayInput): RotemAssayResult {
  const recommendations: RotemProductRecommendation[] = [];
  let pattern: 'HYPERFIBRINOLYSIS' | 'HYPOFIBRINOGENEMIA' | 'THROMBOCYTOPENIA' | 'FACTOR_DEFICIENCY' | 'HEPARIN_EFFECT' | 'NORMAL_HEMOSTASIS' = 'NORMAL_HEMOSTASIS';
  let patternDesc = 'Normal viscoelastic profile with intact clot initiation and firmness.';
  let urgency: 'STAT_HEMORRHAGE_CONTROL' | 'URGENT_CORRECTION' | 'STABLE_MONITOR' = 'STABLE_MONITOR';
  let heparinEffect = false;

  const weight = input.patient_weight_kg || 70;

  // 1. Check Hyperfibrinolysis first (ML > 15%)
  if (input.maximum_lysis_percent && input.maximum_lysis_percent > 15.0) {
    pattern = 'HYPERFIBRINOLYSIS';
    patternDesc = `Critical hyperfibrinolysis detected: Maximum Lysis (ML) is ${input.maximum_lysis_percent}% (threshold > 15%). Accelerating clot breakdown.`;
    urgency = 'STAT_HEMORRHAGE_CONTROL';
    recommendations.push({
      product: 'TRANEXAMIC_ACID',
      product_name: 'Tranexamic Acid (TXA)',
      dosage: '1 g IV bolus infused over 10 minutes, followed immediately by 1 g IV infusion over 8 hours.',
      rationale: 'Inhibits plasminogen activation to halt fulminant fibrinolysis and consumption coagulopathy.',
      target_goal: 'Reduction of ROTEM ML to < 15% (or TEG LY30 < 3%).'
    });
  }

  // 2. Check Fibrinogen / FIBTEM (MCF < 10 mm)
  if (input.fibtem_mcf_mm !== undefined && input.fibtem_mcf_mm < 10.0) {
    if (pattern === 'NORMAL_HEMOSTASIS') {
      pattern = 'HYPOFIBRINOGENEMIA';
      patternDesc = `Critical hypofibrinogenemia: FIBTEM MCF is ${input.fibtem_mcf_mm} mm (threshold < 10 mm). Severe deficit of functional fibrin polymer mesh.`;
      urgency = 'STAT_HEMORRHAGE_CONTROL';
    }
    const fibConcentrateGrams = Math.max(2, Math.round(weight * 0.05));
    recommendations.push({
      product: 'FIBRINOGEN_OR_CRYO',
      product_name: 'Fibrinogen Concentrate (RiaSTAP) OR Cryoprecipitate',
      dosage: `${fibConcentrateGrams} g IV Fibrinogen Concentrate OR 10-20 units Cryoprecipitate (2 pools).`,
      rationale: 'Restores substrate for cross-linked fibrin matrix formation independent of platelet count.',
      target_goal: 'FIBTEM MCF >= 12 mm (Target serum fibrinogen > 150-200 mg/dL).'
    });
  }

  // 3. Check Platelet component (EXTEM MCF < 45 mm with adequate FIBTEM >= 10 mm)
  if (
    input.extem_mcf_mm !== undefined &&
    input.extem_mcf_mm < 45.0 &&
    (input.fibtem_mcf_mm === undefined || input.fibtem_mcf_mm >= 10.0)
  ) {
    if (pattern === 'NORMAL_HEMOSTASIS') {
      pattern = 'THROMBOCYTOPENIA';
      patternDesc = `Platelet-mediated clot weakness: EXTEM MCF is ${input.extem_mcf_mm} mm (< 45 mm) despite adequate fibrinogen polymer strength.`;
      urgency = 'URGENT_CORRECTION';
    }
    recommendations.push({
      product: 'PLATELETS',
      product_name: 'Apheresis Platelets',
      dosage: '1 Apheresis Unit (single donor) infused over 30 minutes.',
      rationale: 'Replenishes functional platelet surface for thrombin generation and clot retraction.',
      target_goal: 'EXTEM MCF >= 50 mm.'
    });
  }

  // 4. Check Coagulation Factor Initiation (EXTEM CT > 80s)
  if (input.extem_ct_sec !== undefined && input.extem_ct_sec > 80.0) {
    if (pattern === 'NORMAL_HEMOSTASIS') {
      pattern = 'FACTOR_DEFICIENCY';
      patternDesc = `Extrinsic pathway thrombin delay: EXTEM Clotting Time (CT) is ${input.extem_ct_sec}s (> 80s). Prothrombin / factor depletion.`;
      urgency = 'URGENT_CORRECTION';
    }
    recommendations.push({
      product: 'PCC_OR_FFP',
      product_name: '4-Factor Prothrombin Complex Concentrate (4F-PCC) OR FFP',
      dosage: `4F-PCC 25-30 units/kg (approx ${weight * 25} units) OR Fresh Frozen Plasma 15 mL/kg.`,
      rationale: 'Rapidly replenishes Factors II, VII, IX, and X to accelerate initial thrombin generation.',
      target_goal: 'EXTEM CT < 80 seconds.'
    });
  }

  // 5. Check Heparin effect (INTEM CT prolonged vs HEPTEM)
  if (input.intem_ct_sec && input.heptem_ct_sec) {
    const ratio = input.intem_ct_sec / input.heptem_ct_sec;
    if (ratio > 1.25) {
      heparinEffect = true;
      pattern = 'HEPARIN_EFFECT';
      patternDesc = `Heparin-induced coagulopathy confirmed: INTEM/HEPTEM ratio = ${Math.round(ratio * 100) / 100} (> 1.25 demonstrates heparinase correction).`;
      urgency = 'URGENT_CORRECTION';
      recommendations.push({
        product: 'PROTAMINE',
        product_name: 'Protamine Sulfate',
        dosage: '25 - 50 mg slow IV push over 10 minutes.',
        rationale: 'Neutralizes circulating unfractionated or low-molecular-weight heparin.',
        target_goal: 'Normalization of INTEM CT to match HEPTEM baseline.'
      });
    }
  }

  if (recommendations.length === 0) {
    recommendations.push({
      product: 'NONE',
      product_name: 'No blood products indicated',
      dosage: 'None',
      rationale: 'Hemostatic parameters within physiological reference intervals.',
      target_goal: 'Maintain normothermia (> 36 C), pH > 7.30, and ionized calcium > 1.1 mmol/L.'
    });
  }

  const summary = `Viscoelastic Assessment: ${patternDesc} (${recommendations.length} action${recommendations.length > 1 ? 's' : ''} recommended)`;

  return {
    deficiency_pattern: pattern,
    pattern_description: patternDesc,
    urgency,
    heparin_effect_detected: heparinEffect,
    recommended_products: recommendations,
    hemostatic_summary: summary
  };
}

/**
 * Evaluates specific anticoagulant reversal protocol.
 */
export function evaluateAnticoagulantReversal(input: ReversalInput): ReversalResult {
  const weight = input.patient_weight_kg || 70;
  let reversalAgent = 'Unknown';
  let prescribedDose = 'Unknown';
  const instructions: string[] = [];
  const precautions: string[] = [];
  let reboundRisk = 'Low';

  switch (input.target_agent) {
    case 'dabigatran': {
      reversalAgent = 'Idarucizumab (Praxbind)';
      prescribedDose = '5 g IV (administered as two consecutive 2.5 g / 50 mL vials)';
      instructions.push('Administer each 2.5 g vial as rapid IV infusion over 5-10 minutes or consecutive boluses.');
      instructions.push('No dosage adjustment required for renal or hepatic impairment.');
      precautions.push('Monitor for hypersensitivity reactions (hereditary fructose intolerance due to sorbitol excipient).');
      precautions.push('Coagulation parameters (dTT, ECT, aPTT) normalize within minutes; aPTT elevation after 24h may indicate redistribution.');
      reboundRisk = 'Low; redistribution may occur in severe renal failure after 12-24 hours.';
      break;
    }

    case 'apixaban':
    case 'rivaroxaban':
    case 'edoxaban': {
      const isApixabanOver5 = input.target_agent === 'apixaban' && input.last_dose_mg && input.last_dose_mg > 5;
      const isRivaroxabanOver10 = input.target_agent === 'rivaroxaban' && input.last_dose_mg && input.last_dose_mg > 10;
      const isRecent = input.last_dose_hours_ago < 8;

      if (isRecent && (isApixabanOver5 || isRivaroxabanOver10)) {
        // High dose Andexanet alfa
        reversalAgent = 'Andexanet alfa (Andexxa) - HIGH DOSE';
        prescribedDose = '800 mg IV bolus (30 mg/min) followed by 8 mg/min IV infusion for 120 minutes (960 mg total infusion)';
      } else {
        // Low dose Andexanet alfa OR 4F-PCC
        reversalAgent = 'Andexanet alfa (Andexxa) LOW DOSE or 4-Factor PCC (Kcentra)';
        prescribedDose = 'Andexxa 400 mg IV bolus (30 mg/min) + 4 mg/min infusion x 120 min OR 4F-PCC 50 units/kg (max 5000 units)';
      }

      instructions.push('If using Andexxa: Reconstitute each vial with sterile water; do NOT shake; administer via dedicated inline 0.2/0.22 micron filter.');
      instructions.push('If using 4F-PCC (Kcentra): Administer 50 units/kg IV infusion at rate <= 8.4 mL/min.');
      precautions.push('Black Box Warning for Andexanet alfa: Arterial and venous thromboembolic events, ischemic stroke, and cardiac arrest reported in up to 18% of patients.');
      precautions.push('Anti-Xa activity assays cannot be used to monitor Andexanet alfa efficacy as they overestimate residual inhibition.');
      reboundRisk = 'High; Anti-Xa activity rebounds between 2-4 hours post-infusion as decoy receptor clears while DOAC remains tissue-bound.';
      break;
    }

    case 'warfarin': {
      reversalAgent = '4-Factor PCC (Kcentra) + IV Vitamin K (Phytonadione)';
      let pccUnitsPerKg = 25;
      if (input.inr && input.inr >= 6.0) {
        pccUnitsPerKg = 50;
      } else if (input.inr && input.inr >= 4.0) {
        pccUnitsPerKg = 35;
      }
      const totalUnits = Math.min(5000, Math.round(weight * pccUnitsPerKg));
      prescribedDose = `4F-PCC ${totalUnits} units (${pccUnitsPerKg} units/kg) IV + Vitamin K 10 mg IV in 50 mL D5W over 30 min`;
      instructions.push('Infuse 4F-PCC over 15-30 minutes.');
      instructions.push('Always co-administer IV Vitamin K to stimulate sustained hepatic factor synthesis as 4F-PCC half-life is limited (Factor VII t1/2 ~ 6 hours).');
      precautions.push('Avoid rapid IV push of Vitamin K due to black box risk of anaphylactoid cardiovascular collapse.');
      precautions.push('Re-check INR 30 minutes post-PCC infusion and q6h thereafter.');
      reboundRisk = 'Moderate if Vitamin K is omitted, as Factor VII from PCC clears within 6-8 hours.';
      break;
    }

    case 'unfractionated_heparin': {
      reversalAgent = 'Protamine Sulfate';
      prescribedDose = '1 mg Protamine per 100 units of Heparin given in past 2 hours (Max single dose 50 mg slow IV)';
      instructions.push('Administer slow IV push over 10 minutes.');
      precautions.push('Rapid infusion causes catastrophic histamine release, pulmonary hypertension, and severe systemic hypotension.');
      precautions.push('Patients with prior vasectomy or NPH insulin allergy have elevated risk of severe protamine anaphylaxis.');
      reboundRisk = 'Heparin rebound may occur 2-4 hours after bypass due to release from adipose tissue reserves.';
      break;
    }

    default: {
      reversalAgent = '4-Factor PCC / Supportive Care';
      prescribedDose = '4F-PCC 50 units/kg IV';
      instructions.push('Supportive resuscitation with mechanical local hemostasis.');
    }
  }

  return {
    target_agent: input.target_agent,
    reversal_agent: reversalAgent,
    prescribed_dose: prescribedDose,
    administration_instructions: instructions,
    monitoring_and_precautions: precautions,
    rebound_anticoagulation_risk: reboundRisk
  };
}

/**
 * Service Class: CoagRotemService
 */
export class CoagRotemService {
  /**
   * Evaluates viscoelastic assay and saves to DB.
   */
  static async evaluateAndSaveAssay(patientId: number, input: RotemAssayInput) {
    const evaluation = evaluateRotemAssay(input);

    const res = await pool.query(`
      INSERT INTO coag_rotem_assays (
        patient_id, assay_type, clinical_scenario, extem_ct_sec,
        intem_ct_sec, fibtem_mcf_mm, extem_mcf_mm, maximum_lysis_percent,
        heparinase_correction_ratio, deficiency_pattern, blood_products_prescribed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `, [
      patientId,
      input.assay_type,
      input.clinical_scenario,
      input.extem_ct_sec || null,
      input.intem_ct_sec || null,
      input.fibtem_mcf_mm || null,
      input.extem_mcf_mm || null,
      input.maximum_lysis_percent || null,
      input.intem_ct_sec && input.heptem_ct_sec ? Math.round((input.intem_ct_sec / input.heptem_ct_sec) * 100) / 100 : null,
      evaluation.deficiency_pattern,
      JSON.stringify(evaluation.recommended_products)
    ]);

    return {
      assay: res.rows[0],
      evaluation
    };
  }

  /**
   * Evaluates and records anticoagulant reversal event.
   */
  static async evaluateAndSaveReversal(patientId: number, input: ReversalInput) {
    const evaluation = evaluateAnticoagulantReversal(input);

    const res = await pool.query(`
      INSERT INTO anticoagulant_reversal_events (
        patient_id, target_agent, last_dose_hours_ago, anti_xa_level_iu_ml,
        inr, bleeding_severity, reversal_agent, prescribed_dose, administration_guidelines
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `, [
      patientId,
      input.target_agent,
      input.last_dose_hours_ago,
      input.anti_xa_level_iu_ml || null,
      input.inr || null,
      input.bleeding_severity,
      evaluation.reversal_agent,
      evaluation.prescribed_dose,
      JSON.stringify({
        instructions: evaluation.administration_instructions,
        precautions: evaluation.monitoring_and_precautions,
        rebound_risk: evaluation.rebound_anticoagulation_risk
      })
    ]);

    return {
      reversal_event: res.rows[0],
      evaluation
    };
  }

  /**
   * Retrieves coagulation and reversal history for a patient.
   */
  static async getPatientCoagHistory(patientId: number) {
    const assays = await pool.query(`
      SELECT * FROM coag_rotem_assays
      WHERE patient_id = $1
      ORDER BY created_at DESC;
    `, [patientId]);

    const reversals = await pool.query(`
      SELECT * FROM anticoagulant_reversal_events
      WHERE patient_id = $1
      ORDER BY created_at DESC;
    `, [patientId]);

    return {
      assays: assays.rows,
      reversals: reversals.rows
    };
  }
}
