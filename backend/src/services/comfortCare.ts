import { pool } from '../db';

export interface EsasRScores {
  pain: number; // 0 - 10
  tiredness: number; // 0 - 10
  drowsiness: number; // 0 - 10
  nausea: number; // 0 - 10
  appetite: number; // 0 - 10 (0 best, 10 worst)
  shortness_of_breath: number; // 0 - 10
  depression: number; // 0 - 10
  anxiety: number; // 0 - 10
  wellbeing: number; // 0 - 10 (0 best, 10 worst)
  other_symptom_name?: string;
  other_symptom_score?: number;
}

export interface EsasRAssessmentResult {
  total_distress_score: number; // 0 - 90
  physical_symptom_score: number; // 0 - 60
  psychological_symptom_score: number; // 0 - 20
  overall_distress_severity: 'MILD' | 'MODERATE' | 'SEVERE';
  severe_symptoms: string[];
  targeted_interventions: string[];
}

export interface OpioidConversionInput {
  from_opioid: 'MORPHINE' | 'OXYCODONE' | 'HYDROMORPHONE' | 'FENTANYL';
  from_dose_mg_24h: number;
  from_route: 'ORAL' | 'IV' | 'SC' | 'TRANSDERMAL_MCG_HR';
  to_opioid: 'MORPHINE' | 'OXYCODONE' | 'HYDROMORPHONE' | 'FENTANYL';
  to_route: 'ORAL' | 'IV' | 'SC' | 'TRANSDERMAL_MCG_HR';
  cross_tolerance_reduction_percent?: number; // Default 25%, typically 25% - 50%
  renal_hepatic_impairment?: boolean;
}

export interface OpioidConversionResult {
  baseline_oral_morphine_equivalent_mg_24h: number;
  unadjusted_target_dose_24h: number;
  cross_tolerance_reduction_applied_percent: number;
  recommended_daily_dose: number;
  unit: string;
  breakthrough_prn_dose: number;
  breakthrough_frequency_and_route: string;
  clinical_warnings: string[];
  conversion_formula_notes: string;
}

export interface TerminalSymptomAssessmentInput {
  refractory_dyspnea_present: boolean;
  respiratory_rate_breaths_min?: number;
  spo2_percent?: number;
  death_rattle_secretions_present: boolean;
  terminal_agitation_delirium_present: boolean;
  urinary_retention_ruled_out: boolean;
  bowel_impaction_ruled_out: boolean;
  pps_v2_percent: number; // 10% - 100%
  polst_code_status: 'FULL_CODE' | 'DNR_COMFORT_FOCUSED' | 'DNR_LIMITED_INTERVENTIONS';
}

export interface TerminalSymptomAssessmentResult {
  pps_trajectory_classification: 'FULL_FUNCTION' | 'PROGRESSIVE_DISEASE' | 'ADVANCED_DISEASE' | 'TRANSITIONAL_TERMINAL' | 'IMMINENT_END_OF_LIFE';
  median_survival_prognosis: string;
  polst_concordance_review: string;
  dyspnea_protocol: string[];
  secretions_protocol: string[];
  agitation_delirium_protocol: string[];
  care_plan_action_items: string[];
}

export class ComfortCareService {
  /**
   * Evaluates Edmonton Symptom Assessment System - Revised (ESAS-r) multi-domain symptoms
   */
  static evaluateEsasR(scores: EsasRScores): EsasRAssessmentResult {
    const standardScores = [
      scores.pain,
      scores.tiredness,
      scores.drowsiness,
      scores.nausea,
      scores.appetite,
      scores.shortness_of_breath,
      scores.depression,
      scores.anxiety,
      scores.wellbeing
    ];

    const totalDistress = standardScores.reduce((acc, curr) => acc + Math.max(0, Math.min(10, curr || 0)), 0);
    const physicalScore = (scores.pain || 0) + (scores.tiredness || 0) + (scores.drowsiness || 0) +
                          (scores.nausea || 0) + (scores.appetite || 0) + (scores.shortness_of_breath || 0);
    const psychScore = (scores.depression || 0) + (scores.anxiety || 0);

    let distressSeverity: 'MILD' | 'MODERATE' | 'SEVERE' = 'MILD';
    if (totalDistress >= 45) {
      distressSeverity = 'SEVERE';
    } else if (totalDistress >= 25) {
      distressSeverity = 'MODERATE';
    }

    const severeSymptoms: string[] = [];
    const interventions: string[] = [];

    if (scores.pain >= 7) {
      severeSymptoms.push(`Severe Pain (Score: ${scores.pain}/10)`);
      interventions.push('Initiate or titrate scheduled opioid therapy with immediate-release breakthrough PRN dose (10-15% of 24h total dose).');
    } else if (scores.pain >= 4) {
      interventions.push('Optimize non-opioid co-analgesics (Acetaminophen, topical agents) or initiate low-dose opioid.');
    }

    if (scores.shortness_of_breath >= 7) {
      severeSymptoms.push(`Severe Dyspnea (Score: ${scores.shortness_of_breath}/10)`);
      interventions.push('Prescribe low-dose oral/sublingual morphine (2.5 - 5.0 mg q2h PRN) for central relief of air hunger; position bedside fan facing cheek/nasolabial fold.');
    }

    if (scores.nausea >= 7) {
      severeSymptoms.push(`Severe Nausea (Score: ${scores.nausea}/10)`);
      interventions.push('Identify etiology: Metoclopramide 10 mg q6h for gastroparesis/opioid-induced; Ondansetron 4-8 mg q8h or Haloperidol 0.5-1 mg for chemical/toxin triggers.');
    }

    if (scores.anxiety >= 7 || scores.depression >= 7) {
      severeSymptoms.push(`Severe Psychological Distress (Anxiety: ${scores.anxiety}/10, Depression: ${scores.depression}/10)`);
      interventions.push('Integrate palliative psychosocial/spiritual care; consider low-dose Lorazepam (0.5 mg PO/SL PRN) for panic-dyspnea crisis or SSRI/Mirtazapine.');
    }

    if (scores.tiredness >= 7 || scores.drowsiness >= 7) {
      severeSymptoms.push(`Severe Fatigue/Somnolence (Tiredness: ${scores.tiredness}/10, Drowsiness: ${scores.drowsiness}/10)`);
      interventions.push('Review medication list for sedating polypharmacy (antihistamines, muscle relaxants, high opioid doses); evaluate for hypercalcemia or infection.');
    }

    return {
      total_distress_score: totalDistress,
      physical_symptom_score: physicalScore,
      psychological_symptom_score: psychScore,
      overall_distress_severity: distressSeverity,
      severe_symptoms: severeSymptoms,
      targeted_interventions: interventions
    };
  }

  /**
   * Converts between opioids using standard Oral Morphine Equivalent (OME) ratios
   * and applies 25% to 50% incomplete cross-tolerance reduction
   */
  static convertOpioidEquianalgesic(input: OpioidConversionInput): OpioidConversionResult {
    const warnings: string[] = [];

    // Step 1: Calculate Oral Morphine Equivalent (OME mg/24h)
    let ome24h = 0;
    const fromOpioid = input.from_opioid;
    const fromRoute = input.from_route;
    const fromDose = input.from_dose_mg_24h;

    if (fromOpioid === 'MORPHINE') {
      if (fromRoute === 'ORAL') {
        ome24h = fromDose * 1.0;
      } else if (fromRoute === 'IV' || fromRoute === 'SC') {
        ome24h = fromDose * 3.0; // 10 mg IV = 30 mg PO
      }
    } else if (fromOpioid === 'OXYCODONE') {
      if (fromRoute === 'ORAL') {
        ome24h = fromDose * 1.5; // 20 mg PO = 30 mg Oral Morphine
      } else if (fromRoute === 'IV' || fromRoute === 'SC') {
        ome24h = fromDose * 2.0;
      }
    } else if (fromOpioid === 'HYDROMORPHONE') {
      if (fromRoute === 'ORAL') {
        ome24h = fromDose * 4.0; // 7.5 mg PO = 30 mg Oral Morphine (1 mg PO ~ 4 mg OME)
      } else if (fromRoute === 'IV' || fromRoute === 'SC') {
        ome24h = fromDose * 20.0; // 1.5 mg IV = 30 mg Oral Morphine (1 mg IV ~ 20 mg OME)
      }
    } else if (fromOpioid === 'FENTANYL') {
      if (fromRoute === 'TRANSDERMAL_MCG_HR') {
        // 25 mcg/hr transdermal patch ~ 60 mg Oral Morphine / 24h (2.4 factor)
        ome24h = fromDose * 2.4;
      } else if (fromRoute === 'IV' || fromRoute === 'SC') {
        // 100 mcg (0.1 mg) IV Fentanyl ~ 10 mg IV Morphine ~ 30 mg Oral Morphine
        // 1 mg IV Fentanyl = 300 mg OME
        ome24h = fromDose * 300.0;
      }
    }

    ome24h = Math.round(ome24h * 10) / 10;

    // Step 2: Convert OME to target opioid and route (unadjusted)
    let unadjustedTarget = 0;
    let targetUnit = 'mg/24h';
    const toOpioid = input.to_opioid;
    const toRoute = input.to_route;

    if (toOpioid === 'MORPHINE') {
      if (toRoute === 'ORAL') {
        unadjustedTarget = ome24h / 1.0;
      } else if (toRoute === 'IV' || toRoute === 'SC') {
        unadjustedTarget = ome24h / 3.0;
      }
    } else if (toOpioid === 'OXYCODONE') {
      if (toRoute === 'ORAL') {
        unadjustedTarget = ome24h / 1.5;
      } else if (toRoute === 'IV' || toRoute === 'SC') {
        unadjustedTarget = ome24h / 2.0;
      }
    } else if (toOpioid === 'HYDROMORPHONE') {
      if (toRoute === 'ORAL') {
        unadjustedTarget = ome24h / 4.0;
      } else if (toRoute === 'IV' || toRoute === 'SC') {
        unadjustedTarget = ome24h / 20.0;
      }
    } else if (toOpioid === 'FENTANYL') {
      if (toRoute === 'TRANSDERMAL_MCG_HR') {
        unadjustedTarget = ome24h / 2.4;
        targetUnit = 'mcg/hr patch';
      } else if (toRoute === 'IV' || toRoute === 'SC') {
        unadjustedTarget = ome24h / 300.0;
        targetUnit = 'mg/24h (IV)';
      }
    }

    unadjustedTarget = Math.round(unadjustedTarget * 100) / 100;

    // Step 3: Apply incomplete cross-tolerance reduction
    // Standard recommended reduction: 25% - 50%.
    let reductionPercent = input.cross_tolerance_reduction_percent !== undefined
      ? input.cross_tolerance_reduction_percent
      : 25;

    if (input.renal_hepatic_impairment) {
      if (reductionPercent < 33) {
        reductionPercent = 33;
      }
      warnings.push('RENAL / HEPATIC IMPAIRMENT: Minimum 33-50% dose reduction enforced to prevent toxic metabolite accumulation (e.g., Morphine-6-glucuronide, Hydromorphone-3-glucuronide).');
      if (toOpioid === 'MORPHINE') {
        warnings.push('CAUTION: Morphine active metabolites (M6G, M3G) accumulate in renal clearance failure (eGFR < 30 mL/min). Consider Hydromorphone or Fentanyl.');
      }
    }

    // Fentanyl patch note: does not allow fine titration; round to nearest patch strength (12.5, 25, 50, 75, 100 mcg/hr)
    let recommendedDose = unadjustedTarget * (1 - reductionPercent / 100);

    if (toOpioid === 'FENTANYL' && toRoute === 'TRANSDERMAL_MCG_HR') {
      warnings.push('TRANSDERMAL FENTANYL: Requires 12-24 hours for subcutaneous reservoir to reach steady state. Continue prior oral/IV coverage for the first 12 hours.');
      // Snap to common patch strength
      const patchSizes = [12, 25, 37, 50, 75, 100];
      const closestPatch = patchSizes.reduce((prev, curr) =>
        Math.abs(curr - recommendedDose) < Math.abs(prev - recommendedDose) ? curr : prev
      );
      recommendedDose = closestPatch;
      warnings.push(`Dose rounded to nearest commercial transdermal patch size: ${closestPatch} mcg/hr.`);
    } else {
      recommendedDose = Math.round(recommendedDose * 10) / 10;
    }

    // Step 4: Calculate Breakthrough PRN Dose (10% to 15% of 24h total dose)
    let breakthroughDose = 0;
    let breakthroughNotes = '';

    if (toRoute === 'TRANSDERMAL_MCG_HR') {
      // For fentanyl patches, breakthrough is given via short-acting oral/IV morphine or hydromorphone
      const breakthroughOme = ome24h * 0.12; // 12% of total daily OME
      breakthroughDose = Math.round((breakthroughOme / 1.0) * 10) / 10; // Oral morphine 10-15%
      breakthroughNotes = 'Oral Morphine immediate-release q2-3h PRN (transdermal patches cannot be used for PRN breakthrough pain)';
    } else if (toRoute === 'ORAL') {
      breakthroughDose = Math.round((recommendedDose * 0.12) * 10) / 10;
      breakthroughNotes = `${toOpioid} oral immediate-release q2-3h PRN breakthrough pain`;
    } else {
      breakthroughDose = Math.round((recommendedDose * 0.10) * 100) / 100;
      breakthroughNotes = `${toOpioid} IV/SC bolus q1-2h PRN breakthrough pain`;
    }

    return {
      baseline_oral_morphine_equivalent_mg_24h: ome24h,
      unadjusted_target_dose_24h: unadjustedTarget,
      cross_tolerance_reduction_applied_percent: reductionPercent,
      recommended_daily_dose: recommendedDose,
      unit: targetUnit,
      breakthrough_prn_dose: breakthroughDose,
      breakthrough_frequency_and_route: breakthroughNotes,
      clinical_warnings: warnings,
      conversion_formula_notes: `Converted ${fromDose} ${fromRoute} ${fromOpioid} to ~${ome24h} mg Oral Morphine Equivalents (OME). Subtracted ${reductionPercent}% for incomplete cross-tolerance.`
    };
  }

  /**
   * Assesses Terminal Symptoms & Formulates End-of-Life Palliative Protocol
   */
  static evaluateTerminalSymptoms(input: TerminalSymptomAssessmentInput): TerminalSymptomAssessmentResult {
    const dyspneaPlan: string[] = [];
    const secretionsPlan: string[] = [];
    const agitationPlan: string[] = [];
    const actionItems: string[] = [];

    // 1. PPS v2 Trajectory & Prognosis
    let trajectory: 'FULL_FUNCTION' | 'PROGRESSIVE_DISEASE' | 'ADVANCED_DISEASE' | 'TRANSITIONAL_TERMINAL' | 'IMMINENT_END_OF_LIFE' = 'FULL_FUNCTION';
    let prognosis = 'Median survival months to years. Curative or disease-modifying goals concordant.';

    if (input.pps_v2_percent <= 20) {
      trajectory = 'IMMINENT_END_OF_LIFE';
      prognosis = 'Imminent dying phase: Median survival hours to days (typically 24 - 72 hours). Transition to intensive comfort measures only.';
      actionItems.push('Transition focus entirely to bedside comfort; discontinue non-comfort routine diagnostic labs, vital sign checks, and enteral tube feeds.');
      actionItems.push('Ensure emergency sublingual/subcutaneous comfort medication kit is at bedside (morphine, glycopyrrolate, haloperidol, lorazepam/midazolam).');
    } else if (input.pps_v2_percent <= 40) {
      trajectory = 'TRANSITIONAL_TERMINAL';
      prognosis = 'Advanced terminal trajectory: Bedbound, minimal intake. Median survival days to weeks. Active palliative care integration.';
      actionItems.push('Review code status and ensure POLST/MOLST concordance with family/surrogate decision-maker.');
    } else if (input.pps_v2_percent <= 60) {
      trajectory = 'ADVANCED_DISEASE';
      prognosis = 'Advanced illness: Reduced ambulation, requiring assistance. Median survival weeks to months.';
    } else if (input.pps_v2_percent <= 80) {
      trajectory = 'PROGRESSIVE_DISEASE';
      prognosis = 'Progressive disease with preserved self-care. Median survival months.';
    }

    // 2. POLST Concordance Review
    let polstReview = 'POLST matches care goals.';
    if (input.polst_code_status === 'DNR_COMFORT_FOCUSED') {
      polstReview = 'POLST Order: DNR / Comfort-Focused Care. Avoid CPR, intubation, mechanical ventilation, or transfer to intensive care unit. Focus on symptom relief in current setting.';
    } else if (input.polst_code_status === 'DNR_LIMITED_INTERVENTIONS') {
      polstReview = 'POLST Order: DNR / Limited Additional Interventions. Treat medical conditions with IV fluids, non-invasive respiratory support if helpful, but avoid invasive mechanical ventilation and cardiac resuscitation.';
    } else {
      polstReview = 'POLST Order: Full Code. If patient has PPS <= 30% and progressive multi-organ decline, recommend urgent goals of care conference to review CPR futility and burdens.';
      if (input.pps_v2_percent <= 30) {
        actionItems.push('GOALS OF CARE ALERT: Full code status documented in patient with PPS <= 30%. Convene multidisciplinary palliative family meeting to align care goals.');
      }
    }

    // 3. Refractory Dyspnea Protocol
    if (input.refractory_dyspnea_present) {
      dyspneaPlan.push('First-line Opioid: Oral/sublingual Morphine solution 2.5 - 5 mg PO/SL q2h PRN (or Morphine 1 - 2 mg IV/SC q1h PRN) for central dyspnea relief.');
      dyspneaPlan.push('Bedside Fan: Direct gentle cool airflow towards cheek/nasolabial fold to stimulate trigeminal mechanoreceptors (proven non-pharmacologic dyspnea reduction).');
      dyspneaPlan.push('Positioning: Elevate head of bed to 45 degrees or high Fowler position with arm support.');

      if (input.spo2_percent !== undefined && input.spo2_percent < 90) {
        dyspneaPlan.push(`Hypoxemic dyspnea detected (SpO2 ${input.spo2_percent}% < 90%). Provide low-flow nasal cannula O2 (1-2 L/min) for comfort.`);
      } else {
        dyspneaPlan.push('Supplemental oxygen is NOT required if SpO2 >= 90% (air fan is equally or more effective without drying nasal mucosa).');
      }
      actionItems.push('Initiate terminal dyspnea protocol with sublingual/IV morphine titration.');
    }

    // 4. Terminal Secretions ("Death Rattle") Protocol
    if (input.death_rattle_secretions_present) {
      secretionsPlan.push('First-line Antimuscarinic: Glycopyrrolate 0.2 - 0.4 mg IV/SC q4h PRN (does not cross blood-brain barrier; preserves cognitive clarity).');
      secretionsPlan.push('Alternative: Scopolamine 1.5 mg transdermal patch q72h (note: can cause central sedation or paradoxical agitation).');
      secretionsPlan.push('Postural Drainage: Position patient in lateral recovery or semi-prone position with pillow support to facilitate natural drainage.');
      secretionsPlan.push('WARNING: STRICTLY AVOID DEEP OROPHARYNGEAL SUCTIONING. Suctioning provokes mucosal trauma, violent gag reflexes, and severe patient/family distress without resolving hypopharyngeal secretions.');
      secretionsPlan.push('Family Education: Reassure family that "death rattle" sounds are caused by vibration of accumulated secretions in relaxed vocal cords and do not indicate patient suffering or suffocation.');
      actionItems.push('Administer Glycopyrrolate and reposition patient; counsel bedside family on non-distress nature of secretions.');
    }

    // 5. Terminal Restlessness & Agitation / Delirium
    if (input.terminal_agitation_delirium_present) {
      if (!input.urinary_retention_ruled_out) {
        agitationPlan.push('IMMEDIATE SCREEN: Perform STAT bedside bladder scan or palpation. Acute urinary retention is the most frequent reversible cause of terminal agitation.');
      }
      if (!input.bowel_impaction_ruled_out) {
        agitationPlan.push('IMMEDIATE SCREEN: Perform gentle digital rectal exam or abdominal exam to rule out severe fecal impaction / opioid constipation.');
      }

      agitationPlan.push('First-line Neuroleptic: Haloperidol 0.5 - 2.0 mg IV/SC/PO q4-6h PRN for hyperactive delirium with hallucinations or agitation.');
      agitationPlan.push('Refractory Agitation / Palliative Sedation: Midazolam 1 - 5 mg/hr continuous IV/SC infusion (or 1 - 2 mg IV/SC bolus q1h PRN) if neuroleptics fail and distress is severe.');
      actionItems.push('Rule out urinary retention and initiate Haloperidol/Midazolam protocol for terminal agitation.');
    }

    return {
      pps_trajectory_classification: trajectory,
      median_survival_prognosis: prognosis,
      polst_concordance_review: polstReview,
      dyspnea_protocol: dyspneaPlan,
      secretions_protocol: secretionsPlan,
      agitation_delirium_protocol: agitationPlan,
      care_plan_action_items: actionItems
    };
  }

  /**
   * Persists a Palliative Care Encounter
   */
  static async savePalliativeEncounter(params: {
    patient_id: number;
    pps_v2_score: number;
    esas_r_scores: EsasRScores;
    polst_code_status: string;
    goals_of_care_trajectory: string;
    terminal_symptoms?: any;
    care_plan_recommendations?: string[];
  }) {
    const query = `
      INSERT INTO palliative_care_encounters (
        patient_id,
        pps_v2_score,
        esas_r_scores,
        polst_code_status,
        goals_of_care_trajectory,
        terminal_symptoms,
        care_plan_recommendations
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const values = [
      params.patient_id,
      params.pps_v2_score,
      JSON.stringify(params.esas_r_scores),
      params.polst_code_status,
      params.goals_of_care_trajectory,
      JSON.stringify(params.terminal_symptoms || {}),
      JSON.stringify(params.care_plan_recommendations || [])
    ];
    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  /**
   * Logs an Opioid Equianalgesic Rotation
   */
  static async logOpioidRotation(params: {
    encounter_id?: number;
    patient_id: number;
    from_opioid: string;
    from_dose_mg_24h: number;
    from_route: string;
    to_opioid: string;
    to_route: string;
    calculated_equianalgesic_mg: number;
    cross_tolerance_reduction_percent: number;
    prescribed_dose_mg_24h: number;
    breakthrough_dose_mg: number;
    breakthrough_interval_hours?: string;
  }) {
    const query = `
      INSERT INTO opioid_rotation_logs (
        encounter_id,
        patient_id,
        from_opioid,
        from_dose_mg_24h,
        from_route,
        to_opioid,
        to_route,
        calculated_equianalgesic_mg,
        cross_tolerance_reduction_percent,
        prescribed_dose_mg_24h,
        breakthrough_dose_mg,
        breakthrough_interval_hours
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *;
    `;
    const values = [
      params.encounter_id || null,
      params.patient_id,
      params.from_opioid,
      params.from_dose_mg_24h,
      params.from_route,
      params.to_opioid,
      params.to_route,
      params.calculated_equianalgesic_mg,
      params.cross_tolerance_reduction_percent,
      params.prescribed_dose_mg_24h,
      params.breakthrough_dose_mg,
      params.breakthrough_interval_hours || 'q2-3h PRN'
    ];
    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  /**
   * Retrieves Palliative Encounters and Opioid Rotations for a patient
   */
  static async getPatientPalliativeHistory(patientId: number) {
    const encQuery = `
      SELECT * FROM palliative_care_encounters
      WHERE patient_id = $1
      ORDER BY created_at DESC
      LIMIT 20;
    `;
    const rotQuery = `
      SELECT * FROM opioid_rotation_logs
      WHERE patient_id = $1
      ORDER BY logged_at DESC
      LIMIT 20;
    `;
    const [encRes, rotRes] = await Promise.all([
      pool.query(encQuery, [patientId]),
      pool.query(rotQuery, [patientId])
    ]);
    return {
      encounters: encRes.rows,
      opioid_rotations: rotRes.rows
    };
  }
}
