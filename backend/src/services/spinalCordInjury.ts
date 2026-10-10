import { pool } from '../db';

export type ASIAGrade = 'A' | 'B' | 'C' | 'D' | 'E';

export interface ASIAScoringInput {
  patientId: number;
  neurologicalLevelOfInjury: string; // e.g. 'C5', 'T4', 'L1'
  motorScoreTotal: number; // 0-100 (Upper Extremity 0-50 + Lower Extremity 0-50)
  sensoryScoreLightTouch: number; // 0-112 (56 dermatomes * 2)
  sensoryScorePinprick: number; // 0-112
  sacralSparingSensory: boolean; // S4-S5 sensory or DAP preserved
  sacralSparingMotor: boolean; // Voluntary anal contraction (VAC)
  keyMusclesBelowNliGrade3OrMorePercent: number; // percentage of muscles >= 3/5 below NLI
}

export interface ASIAClassificationResult {
  neurologicalLevelOfInjury: string;
  asiaImpairmentScale: ASIAGrade;
  completeness: 'Complete' | 'Sensory Incomplete' | 'Motor Incomplete' | 'Normal';
  clinicalDescription: string;
  functionalPrognosis: string;
  recommendedCareDirectives: string[];
}

export interface ShockAssessmentInput {
  neurologicalLevelOfInjury: string;
  systolicBp: number;
  diastolicBp: number;
  mapMmhg: number;
  heartRate: number;
  temperatureCelsius: number;
  bulbocavernosusReflexPresent: boolean;
  hoursPostInjury: number;
}

export interface ShockAssessmentResult {
  neurogenicShockActive: boolean;
  spinalShockActive: boolean;
  mapTargetGoal: string;
  clinicalFindings: string[];
  immediateDirectives: string[];
}

export interface ADEvaluationInput {
  caseId: number;
  neurologicalLevelOfInjury: string;
  baselineSbp: number;
  currentSbp: number;
  currentDbp: number;
  currentHeartRate: number;
  suspectedTrigger: string;
  symptoms: string[];
}

export interface ADEvaluationResult {
  isAutonomicDysreflexia: boolean;
  severity: 'none' | 'mild' | 'moderate' | 'hypertensive_crisis';
  sbpRiseAboveBaseline: number;
  emergencyStepByStepProtocol: string[];
}

export interface SpineInstabilityResult {
  scoreType: 'SLIC' | 'TLICS';
  totalScore: number;
  treatmentRecommendation: 'Non-Operative' | 'Surgeon Discretion / Equivocal' | 'Operative Stabilization Indicated';
  guidelineRationale: string;
}

export class SpinalCordInjuryService {
  /**
   * Evaluates ISNCSCI ASIA Impairment Scale (AIS A-E)
   */
  public static classifyASIA(input: ASIAScoringInput): ASIAClassificationResult {
    let grade: ASIAGrade = 'A';
    let completeness: ASIAClassificationResult['completeness'] = 'Complete';
    let description = '';
    let prognosis = '';
    const directives: string[] = [];

    const hasSacralSparing = input.sacralSparingSensory || input.sacralSparingMotor;

    if (!hasSacralSparing) {
      grade = 'A';
      completeness = 'Complete';
      description = 'AIS Grade A: Complete injury. No sensory or motor function preserved in sacral segments S4-S5.';
      prognosis = 'Low likelihood of functional motor recovery below level of lesion (<10%). Rehabilitation focuses on compensatory adaptive mobility.';
      directives.push('Maintain strict MAP 85-90 mmHg for 7 days to preserve penumbra cord perfusion.');
      directives.push('Initiate deep venous thrombosis (DVT) prophylaxis within 24-72 hours post-injury.');
      directives.push('Implement rigorous Q2H turning protocol to prevent sacral and trochanteric decubitus ulcers.');
    } else if (input.sacralSparingSensory && !input.sacralSparingMotor && input.keyMusclesBelowNliGrade3OrMorePercent === 0) {
      grade = 'B';
      completeness = 'Sensory Incomplete';
      description = 'AIS Grade B: Sensory Incomplete. Sensory function preserved at S4-S5, but no motor function preserved below NLI.';
      prognosis = 'Sensory sparing confers a 30-40% chance of ambulation recovery at 1 year.';
      directives.push('Continuous sensory mapping and aggressive early neuroprotective perfusion optimization.');
      directives.push('Serial neurologic exams to detect rostral injury progression.');
    } else if (input.keyMusclesBelowNliGrade3OrMorePercent < 50) {
      grade = 'C';
      completeness = 'Motor Incomplete';
      description = 'AIS Grade C: Motor Incomplete. Motor function preserved below NLI, and more than half of key muscles have grade < 3/5.';
      prognosis = 'Fair motor recovery potential (50-60% achieve community ambulation with braces/assistive devices).';
      directives.push('Early intensive physical therapy and robotic exoskeleton / locomotor training evaluation.');
    } else if (input.motorScoreTotal < 100 || input.sensoryScoreLightTouch < 112) {
      grade = 'D';
      completeness = 'Motor Incomplete';
      description = 'AIS Grade D: Motor Incomplete. Motor function preserved below NLI, and at least half of key muscles have grade >= 3/5.';
      prognosis = 'High likelihood of functional ambulation (>80-90% independent walkers at 1 year).';
      directives.push('Targeted physical therapy, balance training, and neurogenic bladder/bowel management.');
    } else {
      grade = 'E';
      completeness = 'Normal';
      description = 'AIS Grade E: Normal sensory and motor function in all tested dermatomes and myotomes.';
      prognosis = 'Full neurological function preserved.';
      directives.push('Post-acute orthopedic spine precautions and dynamic radiographic stability monitoring.');
    }

    return {
      neurologicalLevelOfInjury: input.neurologicalLevelOfInjury,
      asiaImpairmentScale: grade,
      completeness,
      clinicalDescription: description,
      functionalPrognosis: prognosis,
      recommendedCareDirectives: directives
    };
  }

  /**
   * Differentiates Neurogenic Shock from Spinal Shock
   */
  public static differentiateShock(input: ShockAssessmentInput): ShockAssessmentResult {
    const isCervicalOrHighThoracic = /^(C[1-8]|T[1-6])$/i.test(input.neurologicalLevelOfInjury);
    const clinicalFindings: string[] = [];
    const immediateDirectives: string[] = [];

    // Neurogenic Shock: loss of sympathetic vasomotor tone (lesions >= T6)
    // Hallmark: Hypotension + Bradycardia (loss of sympathetic cardiac accelerator fibers T1-T4)
    const neurogenicShockActive = isCervicalOrHighThoracic && (input.mapMmhg < 75 || input.systolicBp < 90) && input.heartRate < 65;

    // Spinal Shock: transient depression of all spinal reflexes below lesion
    // Hallmark: absent bulbocavernosus reflex (flaccid paralysis)
    const spinalShockActive = !input.bulbocavernosusReflexPresent && input.hoursPostInjury <= 72;

    if (neurogenicShockActive) {
      clinicalFindings.push('NEUROGENIC SHOCK CONFIRMED: Loss of sympathetic vasomotor tone and cardiac acceleration.');
      clinicalFindings.push(`Hemodynamic Triad: MAP ${input.mapMmhg} mmHg, Heart Rate ${input.heartRate} bpm, Core Temp ${input.temperatureCelsius}°C.`);
      immediateDirectives.push('EMERGENT: Titrate IV Norepinephrine (or Epinephrine) to maintain MAP 85-90 mmHg for 7 days per AANS/CNS guidelines.');
      immediateDirectives.push('AVOID pure alpha-1 agonists (e.g., Phenylephrine) if severe bradycardia is present; may cause reflex arrest.');
      immediateDirectives.push('Keep Atropine / transcutaneous pacing on standby for profound vagal bradycardia (HR < 40 bpm).');
    }

    if (spinalShockActive) {
      clinicalFindings.push('SPINAL SHOCK DETECTED: Absent bulbocavernosus reflex with flaccid paralysis below lesion.');
      clinicalFindings.push('Note: True ISNCSCI ASIA completeness cannot be definitively determined until bulbocavernosus reflex returns.');
      immediateDirectives.push('Re-test bulbocavernosus reflex every 12-24 hours. When reflex returns, finalize definitive ASIA grade.');
    }

    return {
      neurogenicShockActive,
      spinalShockActive,
      mapTargetGoal: 'MAP 85 - 90 mmHg continuously for 7 days post-injury (AANS/CNS Guideline)',
      clinicalFindings,
      immediateDirectives
    };
  }

  /**
   * Evaluates Autonomic Dysreflexia (AD) in lesions >= T6
   */
  public static evaluateAutonomicDysreflexia(input: ADEvaluationInput): ADEvaluationResult {
    const isHighLevel = /^(C[1-8]|T[1-6])$/i.test(input.neurologicalLevelOfInjury);
    const sbpRise = input.currentSbp - input.baselineSbp;

    const isAD = isHighLevel && (sbpRise >= 20 || input.currentSbp >= 140);

    let severity: ADEvaluationResult['severity'] = 'none';
    if (!isAD) {
      severity = 'none';
    } else if (input.currentSbp >= 180 || sbpRise >= 50) {
      severity = 'hypertensive_crisis';
    } else if (input.currentSbp >= 150) {
      severity = 'moderate';
    } else {
      severity = 'mild';
    }

    const stepByStepProtocol: string[] = [];
    if (isAD) {
      stepByStepProtocol.push('STEP 1: Sit patient upright immediately (90 degrees with legs dangling) to induce orthostatic venous pooling and lower cerebral pressure.');
      stepByStepProtocol.push('STEP 2: Loosen all tight clothing, abdominal binders, compression stockings, and cervical collar if cleared.');
      stepByStepProtocol.push('STEP 3: Check urinary catheter immediately (culprit in 85% of cases). Unkink tubing, irrigate gentle saline, or straight catheterize distended bladder.');
      stepByStepProtocol.push('STEP 4: Check bowel for fecal impaction using generous 2% lidocaine jelly prior to digital rectal examination.');
      stepByStepProtocol.push('STEP 5: Inspect skin for ingrown toenails, pressure ulcers, or acute fractures below the level of injury.');
      if (input.currentSbp >= 150) {
        stepByStepProtocol.push('STEP 6: PHARMACOTHERAPY: Apply 1 inch of 2% Nitroglycerin ointment (Nitropaste) topically to chest/back (wipe off immediately if SBP drops < 100 mmHg), or administer oral Nifedipine 10 mg capsule (chew-and-swallow).');
      }
    }

    return {
      isAutonomicDysreflexia: isAD,
      severity,
      sbpRiseAboveBaseline: sbpRise,
      emergencyStepByStepProtocol: stepByStepProtocol
    };
  }

  /**
   * Evaluates Spine Instability and Surgical Indication (SLIC / TLICS)
   */
  public static evaluateSpineInstability(
    scoreType: 'SLIC' | 'TLICS',
    morphology: number,
    ligamentousComplex: number,
    neurologicalStatus: number
  ): SpineInstabilityResult {
    const total = morphology + ligamentousComplex + neurologicalStatus;
    let recommendation: SpineInstabilityResult['treatmentRecommendation'] = 'Non-Operative';
    let rationale = '';

    if (total >= 5) {
      recommendation = 'Operative Stabilization Indicated';
      rationale = `Score is ${total} (>=5). Significant mechanical and/or neurological instability requiring surgical decompression and internal fixation.`;
    } else if (total === 4) {
      recommendation = 'Surgeon Discretion / Equivocal';
      rationale = `Score is 4. Intermediate stability; treatment can be conservative (rigid orthosis) or operative based on patient comorbidities and spinal alignment.`;
    } else {
      recommendation = 'Non-Operative';
      rationale = `Score is ${total} (<=3). Mechanically stable fracture pattern; conservative management with external immobilization indicated.`;
    }

    return {
      scoreType,
      totalScore: total,
      treatmentRecommendation: recommendation,
      guidelineRationale: rationale
    };
  }

  /**
   * Saves a new Spinal Cord Injury Case
   */
  public static async createCase(input: {
    patientId: number;
    neurologicalLevelOfInjury: string;
    asiaImpairmentScale: string;
    motorScoreTotal: number;
    sensoryScoreLightTouch: number;
    sensoryScorePinprick: number;
    sacralSparingSensory: boolean;
    sacralSparingMotor: boolean;
    bulbocavernosusReflexPresent: boolean;
    spinalShockActive: boolean;
    neurogenicShockActive: boolean;
    slicOrTlicsScore?: number;
    surgicalIndication?: string;
  }): Promise<any> {
    const result = await pool.query(
      `INSERT INTO spinal_cord_injury_cases (
        patient_id, neurological_level_of_injury, asia_impairment_scale,
        motor_score_total, sensory_score_light_touch, sensory_score_pinprick,
        sacral_sparing_sensory, sacral_sparing_motor, bulbocavernosus_reflex_present,
        spinal_shock_active, neurogenic_shock_active, slic_or_tlics_score,
        surgical_indication
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        input.patientId,
        input.neurologicalLevelOfInjury,
        input.asiaImpairmentScale,
        input.motorScoreTotal,
        input.sensoryScoreLightTouch,
        input.sensoryScorePinprick,
        input.sacralSparingSensory,
        input.sacralSparingMotor,
        input.bulbocavernosusReflexPresent,
        input.spinalShockActive,
        input.neurogenicShockActive,
        input.slicOrTlicsScore || null,
        input.surgicalIndication || 'undetermined'
      ]
    );
    return result.rows[0];
  }

  /**
   * Retrieves spinal cord injury cases for a patient
   */
  public static async getCasesByPatient(patientId: number): Promise<any[]> {
    const result = await pool.query(
      `SELECT * FROM spinal_cord_injury_cases
       WHERE patient_id = $1
       ORDER BY created_at DESC`,
      [patientId]
    );
    return result.rows;
  }

  /**
   * Records an Autonomic Dysreflexia event
   */
  public static async recordADEvent(input: {
    caseId: number;
    systolicBp: number;
    diastolicBp: number;
    heartRate: number;
    suspectedTrigger: string;
    symptoms: string[];
    interventionsApplied: string[];
    postInterventionSbp?: number;
    resolved?: boolean;
  }): Promise<any> {
    const result = await pool.query(
      `INSERT INTO autonomic_dysreflexia_events (
        case_id, systolic_bp, diastolic_bp, heart_rate,
        suspected_trigger, symptoms, interventions_applied,
        post_intervention_sbp, resolved
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        input.caseId,
        input.systolicBp,
        input.diastolicBp,
        input.heartRate,
        input.suspectedTrigger,
        JSON.stringify(input.symptoms),
        JSON.stringify(input.interventionsApplied),
        input.postInterventionSbp || null,
        input.resolved ?? false
      ]
    );
    return result.rows[0];
  }

  /**
   * Retrieves AD events for a case
   */
  public static async getADEventsByCase(caseId: number): Promise<any[]> {
    const result = await pool.query(
      `SELECT * FROM autonomic_dysreflexia_events
       WHERE case_id = $1
       ORDER BY recorded_at DESC`,
      [caseId]
    );
    return result.rows;
  }
}

export default SpinalCordInjuryService;
