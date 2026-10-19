import { pool } from '../db';

export interface AtlantaAssessmentInput {
  organ_failure_present: boolean;
  organ_failure_duration_hours?: number; // < 48h vs >= 48h
  respiratory_pao2_fio2?: number; // Modified Marshall <= 300
  renal_creatinine_mg_dl?: number; // Modified Marshall >= 1.9 mg/dL
  cardiovascular_systolic_bp?: number; // Modified Marshall < 90 mmHg fluid-unresponsive
  local_complications?: string[]; // 'acute_peripancreatic_fluid_collection', 'acute_necrotic_collection', 'walled_off_necrosis', 'pseudocyst'
  systemic_complications?: boolean; // exacerbation of underlying comorbidities
}

export interface AtlantaAssessmentResult {
  severity: 'MILD' | 'MODERATELY_SEVERE' | 'SEVERE';
  organ_failure_type: 'NONE' | 'TRANSIENT' | 'PERSISTENT';
  marshall_score: number;
  organ_failure_systems: string[];
  icu_admission_indicated: boolean;
  clinical_recommendations: string[];
}

export interface BisapScoreInput {
  bun_mg_dl: number; // > 25 mg/dL
  impaired_mental_status: boolean; // GCS < 15 or disorientation
  sirs_criteria_count: number; // >= 2 criteria
  age: number; // > 60 years
  pleural_effusion: boolean;
}

export interface BisapScoreResult {
  score: number;
  criteria_met: string[];
  mortality_risk_category: 'LOW' | 'INTERMEDIATE' | 'HIGH';
  estimated_mortality_percent: number;
  clinical_guidance: string[];
}

export interface FluidResuscitationInput {
  weight_kg: number;
  fluid_type: 'Lactated_Ringers' | 'Normal_Saline';
  current_rate_ml_hr: number;
  hematocrit_percent: number; // Baseline vs current (target 35-44%)
  bun_mg_dl: number; // Baseline vs current
  previous_bun_mg_dl?: number;
  urine_output_ml_kg_hr: number; // Target >= 0.5 - 1.0 mL/kg/hr
  signs_of_fluid_overload: boolean;
}

export interface FluidResuscitationResult {
  recommended_rate_ml_hr: number;
  fluid_choice: string;
  hematocrit_status: 'HEMOCONCENTRATED' | 'TARGET_RANGE' | 'OVERDILUTED';
  bun_trajectory: 'IMPROVING' | 'STATIONARY' | 'WORSENING';
  resuscitation_adequacy: 'OPTIMAL' | 'UNDER_RESUSCITATED' | 'OVER_RESUSCITATED_AT_RISK';
  clinical_actions: string[];
}

export interface DutchStepUpInput {
  necrosis_present: boolean;
  necrosis_type: 'STERILE' | 'SUSPECTED_INFECTED' | 'CONFIRMED_INFECTED';
  gas_on_ct: boolean;
  days_since_onset: number;
  current_step: 'CONSERVATIVE_MEDICAL' | 'PERCUTANEOUS_CATHETER_DRAINAGE' | 'ENDOSCOPIC_TRANSMURAL_DRAINAGE' | 'VARD_MINIMALLY_INVASIVE' | 'OPEN_NECROSECTOMY';
  hours_at_current_step: number;
  clinical_response: 'IMPROVING' | 'STABLE' | 'DETERIORATING';
  drainage_output_ml_24h?: number;
}

export interface DutchStepUpResult {
  infection_confirmed_or_strongly_suspected: boolean;
  recommended_step: string;
  antimicrobial_guidance: string;
  procedure_timing: string;
  surgical_consultation_required: boolean;
  action_plan: string[];
}

export interface TokyoGuidelinesTg18Input {
  fever_temp_celsius: number;
  jaundice_or_bilirubin_mg_dl: number;
  ruq_pain: boolean;
  wbc_count_k: number;
  organ_dysfunction_present: boolean;
  gallstones_or_biliary_dilation: boolean;
}

export interface Tg18CholangitisResult {
  suspected_acute_cholangitis: boolean;
  tg18_severity: 'GRADE_I_MILD' | 'GRADE_II_MODERATE' | 'GRADE_III_SEVERE' | 'NOT_CHOLANGITIS';
  ercp_timing: 'EMERGENT_WITHIN_24H' | 'URGENT_WITHIN_48H' | 'ELECTIVE_INDEX_ADMISSION' | 'NOT_INDICATED';
  cholecystectomy_recommendation: string;
  antimicrobial_coverage: string[];
}

export class AcutePancreatitisService {
  /**
   * Evaluates Acute Pancreatitis severity per the Revised Atlanta Classification (2012)
   */
  static evaluateAtlantaClassification(input: AtlantaAssessmentInput): AtlantaAssessmentResult {
    let marshallScore = 0;
    const organSystems: string[] = [];

    // Modified Marshall System scoring
    if (input.respiratory_pao2_fio2 !== undefined && input.respiratory_pao2_fio2 <= 300) {
      marshallScore += input.respiratory_pao2_fio2 <= 200 ? 3 : 2;
      organSystems.push(`Respiratory Failure (PaO2/FiO2: ${input.respiratory_pao2_fio2})`);
    }

    if (input.renal_creatinine_mg_dl !== undefined && input.renal_creatinine_mg_dl >= 1.9) {
      marshallScore += input.renal_creatinine_mg_dl >= 3.6 ? 3 : 2;
      organSystems.push(`Renal Failure (Creatinine: ${input.renal_creatinine_mg_dl} mg/dL)`);
    }

    if (input.cardiovascular_systolic_bp !== undefined && input.cardiovascular_systolic_bp < 90) {
      marshallScore += 2;
      organSystems.push(`Cardiovascular Failure (Systolic BP: ${input.cardiovascular_systolic_bp} mmHg)`);
    }

    const hasOrganFailure = input.organ_failure_present || marshallScore >= 2;
    const durationHours = input.organ_failure_duration_hours || 0;
    const isPersistent = hasOrganFailure && durationHours >= 48;
    const isTransient = hasOrganFailure && durationHours < 48;

    const hasLocalComp = input.local_complications && input.local_complications.length > 0;
    const hasSystemicComp = Boolean(input.systemic_complications);

    let severity: 'MILD' | 'MODERATELY_SEVERE' | 'SEVERE';
    let organFailureType: 'NONE' | 'TRANSIENT' | 'PERSISTENT' = 'NONE';
    const recs: string[] = [];

    if (isPersistent) {
      severity = 'SEVERE';
      organFailureType = 'PERSISTENT';
      recs.push('Persistent organ failure (>48h): High mortality risk (20-40%). Immediate ICU admission mandatory.');
      recs.push('Continuous invasive hemodynamic arterial line monitoring and central venous access.');
      recs.push('Delayed CECT abdomen with IV contrast (perform at 72-96h from onset to accurately delineate pancreatic parenchymal necrosis).');
    } else if (isTransient || hasLocalComp || hasSystemicComp) {
      severity = 'MODERATELY_SEVERE';
      organFailureType = isTransient ? 'TRANSIENT' : 'NONE';
      recs.push('Moderately Severe Pancreatitis: High intermediate step-down or ICU monitoring recommended.');
      if (isTransient) {
        recs.push('Transient organ failure resolved or lasting <48 hours. Serial monitoring of vitals and urine output.');
      }
      if (hasLocalComp) {
        recs.push(`Local complication documented: ${input.local_complications!.join(', ')}. Serial imaging follow-up indicated.`);
      }
    } else {
      severity = 'MILD';
      organFailureType = 'NONE';
      recs.push('Mild Acute Pancreatitis: General inpatient ward admission.');
      recs.push('Early oral refeeding with low-fat solid or liquid diet as soon as abdominal pain subsides and ileus resolves.');
      recs.push('Avoid routine prophylactic antibiotics and avoid routine non-indicated abdominal CT scans in uncomplicated mild disease.');
    }

    return {
      severity,
      organ_failure_type: organFailureType,
      marshall_score: marshallScore,
      organ_failure_systems: organSystems,
      icu_admission_indicated: severity === 'SEVERE' || (severity === 'MODERATELY_SEVERE' && isTransient),
      clinical_recommendations: recs
    };
  }

  /**
   * Evaluates the Bedside Index for Severity in Acute Pancreatitis (BISAP, 0-5)
   */
  static evaluateBisapScore(input: BisapScoreInput): BisapScoreResult {
    let score = 0;
    const criteria: string[] = [];

    if (input.bun_mg_dl > 25) {
      score++;
      criteria.push(`BUN > 25 mg/dL (${input.bun_mg_dl} mg/dL)`);
    }
    if (input.impaired_mental_status) {
      score++;
      criteria.push('Impaired Mental Status (GCS < 15 or encephalopathy)');
    }
    if (input.sirs_criteria_count >= 2) {
      score++;
      criteria.push(`SIRS Criteria Met (Count: ${input.sirs_criteria_count} >= 2)`);
    }
    if (input.age > 60) {
      score++;
      criteria.push(`Age > 60 years (${input.age} yo)`);
    }
    if (input.pleural_effusion) {
      score++;
      criteria.push('Pleural Effusion Present on Imaging');
    }

    let category: 'LOW' | 'INTERMEDIATE' | 'HIGH';
    let mortalityPercent = 0.5;
    const guidance: string[] = [];

    if (score >= 3) {
      category = 'HIGH';
      mortalityPercent = score === 3 ? 5.3 : score === 4 ? 12.7 : 22.5;
      guidance.push(`BISAP Score ${score}/5: High Risk for in-hospital mortality (~${mortalityPercent}%) and persistent organ failure.`);
      guidance.push('Admit to Intensive Care Unit or Step-Down Unit for aggressive resuscitation and multi-organ surveillance.');
    } else if (score === 2) {
      category = 'INTERMEDIATE';
      mortalityPercent = 1.9;
      guidance.push(`BISAP Score ${score}/5: Intermediate Risk (estimated mortality ~1.9%). Regular floor or stepdown telemetry monitoring.`);
    } else {
      category = 'LOW';
      mortalityPercent = score === 0 ? 0.2 : 0.5;
      guidance.push(`BISAP Score ${score}/5: Low Risk (estimated mortality < 1%). Standard floor admission with goal-directed hydration.`);
    }

    return {
      score,
      criteria_met: criteria,
      mortality_risk_category: category,
      estimated_mortality_percent: mortalityPercent,
      clinical_guidance: guidance
    };
  }

  /**
   * Calculates Goal-Directed Fluid Resuscitation Kinetics and adequacy
   */
  static evaluateFluidResuscitation(input: FluidResuscitationInput): FluidResuscitationResult {
    const actions: string[] = [];

    // 1. Fluid Choice: Lactated Ringer's vs Saline
    const fluidChoice = input.fluid_type === 'Lactated_Ringers'
      ? 'Lactated Ringers (Preferred: lowers SIRS rates and metabolic acidosis)'
      : 'Normal Saline (Caution: high-volume 0.9% NaCl risks hyperchloremic metabolic acidosis and renal vasoconstriction)';

    if (input.fluid_type !== 'Lactated_Ringers') {
      actions.push('Switch to Lactated Ringer solution to reduce peripancreatic inflammation and renal hypoperfusion.');
    }

    // 2. Hematocrit Status (Target: 35-44%)
    let hctStatus: 'HEMOCONCENTRATED' | 'TARGET_RANGE' | 'OVERDILUTED' = 'TARGET_RANGE';
    if (input.hematocrit_percent > 44) {
      hctStatus = 'HEMOCONCENTRATED';
      actions.push(`Hemoconcentration present (Hct ${input.hematocrit_percent}% > 44%). Signals severe intravascular volume depletion and pancreatic microvascular hypoperfusion.`);
    } else if (input.hematocrit_percent < 33) {
      hctStatus = 'OVERDILUTED';
      actions.push(`Low hematocrit (Hct ${input.hematocrit_percent}% < 33%). Rule out active retroperitoneal bleeding or aggressive over-dilution.`);
    }

    // 3. BUN Trajectory
    let bunTrajectory: 'IMPROVING' | 'STATIONARY' | 'WORSENING' = 'STATIONARY';
    if (input.previous_bun_mg_dl !== undefined) {
      if (input.bun_mg_dl < input.previous_bun_mg_dl - 2) {
        bunTrajectory = 'IMPROVING';
      } else if (input.bun_mg_dl > input.previous_bun_mg_dl + 2) {
        bunTrajectory = 'WORSENING';
        actions.push(`Rising BUN (${input.previous_bun_mg_dl} -> ${input.bun_mg_dl} mg/dL). Independent predictor of acute kidney injury and pancreatic necrosis.`);
      }
    }

    // 4. Urine Output Assessment
    const adequateUrine = input.urine_output_ml_kg_hr >= 0.5;

    // 5. Adequacy & Recommended Rate
    let adequacy: 'OPTIMAL' | 'UNDER_RESUSCITATED' | 'OVER_RESUSCITATED_AT_RISK' = 'OPTIMAL';
    let recommendedRate = input.current_rate_ml_hr;

    if (input.signs_of_fluid_overload) {
      adequacy = 'OVER_RESUSCITATED_AT_RISK';
      recommendedRate = Math.min(100, Math.round(input.weight_kg * 1.0));
      actions.push('CRITICAL: Signs of fluid overload or pulmonary edema detected. Decrease infusion rate immediately to avoid abdominal compartment syndrome and ARDS.');
    } else if (hctStatus === 'HEMOCONCENTRATED' || !adequateUrine || bunTrajectory === 'WORSENING') {
      adequacy = 'UNDER_RESUSCITATED';
      // Titrate up to 200-250 mL/hr or 3-5 mL/kg/hr
      recommendedRate = Math.max(250, Math.min(400, Math.round(input.weight_kg * 3.5)));
      actions.push(`Increase fluid infusion to ${recommendedRate} mL/hr Lactated Ringers. Re-evaluate vitals, Hct, and BUN in 4-6 hours.`);
    } else {
      adequacy = 'OPTIMAL';
      recommendedRate = Math.max(125, Math.min(200, Math.round(input.weight_kg * 1.5)));
      actions.push(`Target resuscitation goals achieved (Urine output ${input.urine_output_ml_kg_hr} mL/kg/h >= 0.5). Taper to maintenance rate ${recommendedRate} mL/hr.`);
    }

    return {
      recommended_rate_ml_hr: recommendedRate,
      fluid_choice: fluidChoice,
      hematocrit_status: hctStatus,
      bun_trajectory: bunTrajectory,
      resuscitation_adequacy: adequacy,
      clinical_actions: actions
    };
  }

  /**
   * Evaluates Pancreatic Necrosis and governs the Dutch Step-Up Approach
   */
  static evaluateDutchStepUp(input: DutchStepUpInput): DutchStepUpResult {
    const isGasOnCt = input.gas_on_ct;
    const isConfirmedInfected = input.necrosis_type === 'CONFIRMED_INFECTED' || isGasOnCt;
    const isSuspectedInfected = input.necrosis_type === 'SUSPECTED_INFECTED' || (input.necrosis_present && input.days_since_onset >= 10 && input.clinical_response === 'DETERIORATING');

    let recommendedStep = input.current_step as string;
    let timing = 'Routine monitoring';
    let surgicalConsult = false;
    const plan: string[] = [];

    // Antibiotic recommendations: carbapenem for infected necrosis
    let abxGuidance = 'Routine prophylactic antibiotics NOT recommended for sterile acute pancreatitis.';

    if (isConfirmedInfected || isSuspectedInfected) {
      abxGuidance = 'Targeted pancreatic penetration: IV Meropenem 1g q8h (or IV Ciprofloxacin 400mg q12h + Metronidazole 500mg q8h if severe penicillin anaphylaxis).';
      plan.push('Infected pancreatic necrosis verified/strongly suspected: initiate carbapenem therapy and assemble multidisciplinary HPB surgery / interventional radiology team.');
      surgicalConsult = true;
    }

    if (!input.necrosis_present) {
      recommendedStep = 'CONSERVATIVE_MEDICAL';
      timing = 'Standard supportive care';
      plan.push('No pancreatic parenchymal necrosis. Continue medical resuscitation and advance enteral feeding.');
    } else if (!isConfirmedInfected && !isSuspectedInfected) {
      recommendedStep = 'CONSERVATIVE_MEDICAL';
      timing = 'Postpone invasive drainage while sterile';
      plan.push('Sterile acute necrotizing pancreatitis: Withhold invasive interventions during first 2-4 weeks to allow collection walling-off (WON formation).');
    } else {
      // Infected or deteriorating necrosis: Follow Dutch Step-Up
      if (input.current_step === 'CONSERVATIVE_MEDICAL') {
        recommendedStep = 'PERCUTANEOUS_CATHETER_DRAINAGE';
        timing = 'Urgent (Within 24-48 hours)';
        plan.push('STEP 1: Perform CT- or ultrasound-guided Percutaneous Catheter Drainage (PCD) via retroperitoneal left flank approach (or endoscopic transmural cystogastrostomy if adherent to stomach).');
        plan.push('Note: Drainage alone successfully resolves up to 35-50% of infected necrosis cases without requiring operative debridement (PANTER trial).');
      } else if (input.current_step === 'PERCUTANEOUS_CATHETER_DRAINAGE' || input.current_step === 'ENDOSCOPIC_TRANSMURAL_DRAINAGE') {
        if (input.clinical_response === 'DETERIORATING' && input.hours_at_current_step >= 72) {
          recommendedStep = 'VARD_MINIMALLY_INVASIVE';
          timing = 'Within 48 hours';
          plan.push('STEP 2: Patient deteriorating >= 72h post-drainage. Step-up to minimally invasive Video-Assisted Retroperitoneal Debridement (VARD) using percutaneous drain tract.');
        } else if (input.clinical_response === 'STABLE' && input.hours_at_current_step >= 72) {
          recommendedStep = 'UPSIZE_DRAINAGE_CATHETERS';
          timing = 'Next 24 hours';
          plan.push('Patient stable but not improving: Upsize percutaneous drainage catheters (14F -> 20-28F) and institute continuous saline catheter lavage before proceeding to necrosectomy.');
        } else {
          recommendedStep = input.current_step;
          timing = 'Continue current drainage';
          plan.push('Clinical improvement noted on current drainage. Continue daily catheter flushing and monitor systemic inflammatory markers.');
        }
      } else if (input.current_step === 'VARD_MINIMALLY_INVASIVE') {
        if (input.clinical_response === 'DETERIORATING') {
          recommendedStep = 'OPEN_NECROSECTOMY';
          timing = 'Emergent surgical intervention';
          plan.push('STEP 3: Failure of minimally invasive VARD with ongoing clinical sepsis. Proceed to open laparotomy necrosectomy with post-operative closed continuous bursa omentalis lavage.');
        } else {
          recommendedStep = 'VARD_MINIMALLY_INVASIVE';
          timing = 'Post-operative monitoring';
          plan.push('Continue post-VARD irrigation and serial CT monitoring.');
        }
      }
    }

    return {
      infection_confirmed_or_strongly_suspected: isConfirmedInfected || isSuspectedInfected,
      recommended_step: recommendedStep,
      antimicrobial_guidance: abxGuidance,
      procedure_timing: timing,
      surgical_consultation_required: surgicalConsult,
      action_plan: plan
    };
  }

  /**
   * Evaluates Gallstone Pancreatitis & Acute Cholangitis per Tokyo Guidelines (TG18)
   */
  static evaluateTg18Cholangitis(input: TokyoGuidelinesTg18Input): Tg18CholangitisResult {
    // Charcot's triad: Fever + Jaundice + RUQ pain
    const hasCharcots = input.fever_temp_celsius >= 38.0 && input.jaundice_or_bilirubin_mg_dl >= 2.5 && input.ruq_pain;
    const isCholangitisSuspected = hasCharcots || (input.gallstones_or_biliary_dilation && (input.fever_temp_celsius >= 38.0 || input.jaundice_or_bilirubin_mg_dl >= 3.0));

    let severity: 'GRADE_I_MILD' | 'GRADE_II_MODERATE' | 'GRADE_III_SEVERE' | 'NOT_CHOLANGITIS' = 'NOT_CHOLANGITIS';
    let ercpTiming: 'EMERGENT_WITHIN_24H' | 'URGENT_WITHIN_48H' | 'ELECTIVE_INDEX_ADMISSION' | 'NOT_INDICATED' = 'NOT_INDICATED';
    let choleRecommendation = 'No gallstones identified. Manage underlying medical etiology.';
    const abx: string[] = [];

    if (!isCholangitisSuspected && !input.gallstones_or_biliary_dilation) {
      severity = 'NOT_CHOLANGITIS';
      ercpTiming = 'NOT_INDICATED';
    } else if (isCholangitisSuspected) {
      if (input.organ_dysfunction_present) {
        severity = 'GRADE_III_SEVERE';
        ercpTiming = 'EMERGENT_WITHIN_24H';
        abx.push('Piperacillin-Tazobactam 4.5g IV q6h or Meropenem 1g IV q8h for severe cholangitis with sepsis/organ failure.');
      } else if (input.wbc_count_k > 12 || input.wbc_count_k < 4 || input.fever_temp_celsius >= 39.0 || input.jaundice_or_bilirubin_mg_dl >= 5.0) {
        severity = 'GRADE_II_MODERATE';
        ercpTiming = 'URGENT_WITHIN_48H';
        abx.push('Ceftriaxone 2g IV daily + Metronidazole 500mg IV q8h.');
      } else {
        severity = 'GRADE_I_MILD';
        ercpTiming = 'URGENT_WITHIN_48H';
        abx.push('Ampicillin-Sulbactam 3g IV q6h or Ciprofloxacin + Metronidazole.');
      }

      choleRecommendation = 'Index admission cholecystectomy recommended following clinical resolution and biliary duct clearance to prevent 30-day recurrent gallstone pancreatitis (recurrence rate up to 30%).';
    } else if (input.gallstones_or_biliary_dilation) {
      // Gallstone pancreatitis without active cholangitis
      severity = 'NOT_CHOLANGITIS';
      if (input.jaundice_or_bilirubin_mg_dl >= 4.0) {
        ercpTiming = 'URGENT_WITHIN_48H'; // persistent common bile duct obstruction
      } else {
        ercpTiming = 'NOT_INDICATED'; // transient stone passage
      }
      choleRecommendation = 'Index admission laparoscopic cholecystectomy with intraoperative cholangiogram recommended prior to discharge.';
    }

    return {
      suspected_acute_cholangitis: isCholangitisSuspected,
      tg18_severity: severity,
      ercp_timing: ercpTiming,
      cholecystectomy_recommendation: choleRecommendation,
      antimicrobial_coverage: abx
    };
  }

  /**
   * Persists an Acute Pancreatitis Encounter in the database
   */
  static async savePancreatitisEncounter(params: {
    patient_id: number;
    etiology: string;
    atlanta_severity: string;
    bisap_score: number;
    glasgow_imrie_score?: number;
    sirs_present: boolean;
    organ_failure_persistent: boolean;
    fluid_rate_ml_hr: number;
    fluid_type?: string;
    hematocrit_percent?: number;
    bun_mg_dl?: number;
    urine_output_ml_kg_hr?: number;
    gallstone_cholangitis_suspected: boolean;
    tg18_severity?: string;
    ercp_recommended_within_24h: boolean;
  }) {
    const query = `
      INSERT INTO acute_pancreatitis_encounters (
        patient_id,
        etiology,
        atlanta_severity,
        bisap_score,
        glasgow_imrie_score,
        sirs_present,
        organ_failure_persistent,
        fluid_rate_ml_hr,
        fluid_type,
        hematocrit_percent,
        bun_mg_dl,
        urine_output_ml_kg_hr,
        gallstone_cholangitis_suspected,
        tg18_severity,
        ercp_recommended_within_24h
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *;
    `;
    const values = [
      params.patient_id,
      params.etiology,
      params.atlanta_severity,
      params.bisap_score,
      params.glasgow_imrie_score || null,
      params.sirs_present,
      params.organ_failure_persistent,
      params.fluid_rate_ml_hr,
      params.fluid_type || 'Lactated Ringers',
      params.hematocrit_percent || null,
      params.bun_mg_dl || null,
      params.urine_output_ml_kg_hr || null,
      params.gallstone_cholangitis_suspected,
      params.tg18_severity || null,
      params.ercp_recommended_within_24h
    ];
    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  /**
   * Persists a Pancreatic Step-Up Intervention entry
   */
  static async saveStepUpIntervention(params: {
    encounter_id: number;
    patient_id: number;
    necrosis_type: string;
    gas_on_ct: boolean;
    current_step: string;
    clinical_response: string;
    drainage_output_ml_24h?: number;
    next_recommended_step: string;
    antimicrobial_regimen?: string;
  }) {
    const query = `
      INSERT INTO pancreatic_stepup_interventions (
        encounter_id,
        patient_id,
        necrosis_type,
        gas_on_ct,
        current_step,
        clinical_response,
        drainage_output_ml_24h,
        next_recommended_step,
        antimicrobial_regimen
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;
    const values = [
      params.encounter_id,
      params.patient_id,
      params.necrosis_type,
      params.gas_on_ct,
      params.current_step,
      params.clinical_response,
      params.drainage_output_ml_24h || null,
      params.next_recommended_step,
      params.antimicrobial_regimen || null
    ];
    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  /**
   * Retrieves patient pancreatitis encounters and step-up intervention logs
   */
  static async getPatientPancreatitisHistory(patientId: number) {
    const encountersQuery = `
      SELECT * FROM acute_pancreatitis_encounters
      WHERE patient_id = $1
      ORDER BY created_at DESC
      LIMIT 20;
    `;
    const stepUpQuery = `
      SELECT * FROM pancreatic_stepup_interventions
      WHERE patient_id = $1
      ORDER BY logged_at DESC
      LIMIT 20;
    `;
    const [encountersRes, stepUpRes] = await Promise.all([
      pool.query(encountersQuery, [patientId]),
      pool.query(stepUpQuery, [patientId])
    ]);
    return {
      encounters: encountersRes.rows,
      step_up_interventions: stepUpRes.rows
    };
  }
}
