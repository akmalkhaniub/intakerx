import { pool } from '../db';

export type ASIAImpairmentGrade = 'A' | 'B' | 'C' | 'D' | 'E';

export interface EvaluateSpinalCordInput {
  patientId: number;
  neurologicalLevelOfInjury: string; // e.g. 'C4', 'C5', 'T4', 'L1'
  hoursSinceInjury: number;
  motorScoreTotal: number; // 0-100
  sensoryScoreTotal: number; // 0-224 (Light touch 0-112 + Pinprick 0-112)
  sacralSparingSensory: boolean;
  sacralSparingMotor: boolean;
  keyMusclesBelowNliGrade3Percent: number; // % of key muscles below NLI >= 3/5
  bulbocavernosusReflexPresent: boolean;
  currentSbp: number;
  currentDbp: number;
  currentMap: number;
  currentHeartRate: number;
  cordCompressionOnMri: boolean;
  spinalInstabilityPresent: boolean;
  baselineSbp?: number;
}

export interface SpinalCordEvaluationResult {
  patientId: number;
  neurologicalLevelOfInjury: string;
  hoursSinceInjury: number;
  asiaGrade: ASIAImpairmentGrade;
  completeness: 'COMPLETE' | 'SENSORY_INCOMPLETE' | 'MOTOR_INCOMPLETE' | 'NORMAL';
  motorScoreTotal: number;
  sensoryScoreTotal: number;
  sacralSparingSensory: boolean;
  sacralSparingMotor: boolean;
  bulbocavernosusReflexPresent: boolean;
  spinalShockActive: boolean;
  neurogenicShockActive: boolean;
  concomitantHemorrhagicShockSuspected: boolean;
  lesionAboveT6: boolean;
  surgicalCandidate: boolean;
  decompressionWindowStatus: 'ULTRA_EARLY_OPTIMAL' | 'EARLY_ACCEPTABLE' | 'DELAYED';
  mapTargetGoal: {
    minMapMmhg: number;
    maxMapMmhg: number;
    durationDays: number;
    durationHoursTotal: number;
    recommendedVasopressor: string;
    contraindicatedAgents: string[];
  };
  autonomicDysreflexiaRisk: boolean;
  protocolDirectives: string[];
  recommendedAction: string;
}

export interface LogMapAugmentationInput {
  encounterId?: number;
  patientId: number;
  postInjuryHour: number;
  systolicBp: number;
  diastolicBp: number;
  mapMmhg: number;
  heartRate: number;
  activeVasopressor?: string;
  vasopressorDoseMcgMin?: number;
}

export interface MapAugmentationLogResult {
  patientId: number;
  encounterId?: number;
  postInjuryHour: number;
  systolicBp: number;
  diastolicBp: number;
  mapMmhg: number;
  heartRate: number;
  targetMet: boolean;
  activeVasopressor?: string;
  vasopressorDoseMcgMin?: number;
  vasopressorAction: 'UPTITRATE' | 'MAINTAIN' | 'WEAN' | 'SWITCH_AGENT';
  ischemiaRiskAlert: boolean;
  actionPlan: string;
}

export class SpinalCordService {
  /**
   * Helper to determine if NLI is at or above T6
   */
  public static isLesionAboveT6(nli: string): boolean {
    const clean = nli.trim().toUpperCase();
    if (clean.startsWith('C')) return true;
    if (clean.startsWith('T')) {
      const level = parseInt(clean.substring(1), 10);
      return !isNaN(level) && level <= 6;
    }
    return false;
  }

  /**
   * Evaluates Acute Spinal Cord Injury: ASIA scale, shock phenotype, MAP target, and decompression window.
   */
  public static evaluateInjury(input: EvaluateSpinalCordInput): SpinalCordEvaluationResult {
    const directives: string[] = [];
    const nli = input.neurologicalLevelOfInjury.toUpperCase().trim();
    const lesionAboveT6 = this.isLesionAboveT6(nli);

    // 1. ASIA Classification
    let asiaGrade: ASIAImpairmentGrade = 'A';
    let completeness: SpinalCordEvaluationResult['completeness'] = 'COMPLETE';

    if (!input.sacralSparingSensory && !input.sacralSparingMotor) {
      asiaGrade = 'A';
      completeness = 'COMPLETE';
      directives.push(`ASIA Grade A (Complete Injury): No sacral sensory (S4-S5) or voluntary anal motor contraction preserved.`);
    } else if (input.sacralSparingSensory && !input.sacralSparingMotor) {
      asiaGrade = 'B';
      completeness = 'SENSORY_INCOMPLETE';
      directives.push(`ASIA Grade B (Sensory Incomplete): S4-S5 sensation or deep anal pressure intact, but no motor function preserved below injury.`);
    } else if (input.sacralSparingMotor || input.keyMusclesBelowNliGrade3Percent > 0) {
      if (input.keyMusclesBelowNliGrade3Percent < 50) {
        asiaGrade = 'C';
        completeness = 'MOTOR_INCOMPLETE';
        directives.push(`ASIA Grade C (Motor Incomplete): More than half of key muscles below NLI have muscle grade < 3/5.`);
      } else {
        if (input.motorScoreTotal === 100 && input.sensoryScoreTotal === 224) {
          asiaGrade = 'E';
          completeness = 'NORMAL';
          directives.push(`ASIA Grade E (Normal): Motor and sensory functions have recovered to intact.`);
        } else {
          asiaGrade = 'D';
          completeness = 'MOTOR_INCOMPLETE';
          directives.push(`ASIA Grade D (Motor Incomplete): At least half of key muscles below NLI have muscle grade >= 3/5.`);
        }
      }
    }

    // 2. Spinal Shock vs. Neurogenic Shock Differentiation
    const spinalShockActive = !input.bulbocavernosusReflexPresent;
    if (spinalShockActive) {
      directives.push(`Spinal Shock Active: Absent bulbocavernosus reflex and flaccid areflexia below ${nli}. True baseline AIS cannot be definitively finalized until bulbocavernosus reflex returns.`);
    } else {
      directives.push(`Bulbocavernosus Reflex Present: Spinal shock has resolved.`);
    }

    let neurogenicShockActive = false;
    let concomitantHemorrhagicShockSuspected = false;

    if (input.currentMap < 85 || input.currentSbp < 90) {
      if (lesionAboveT6 && input.currentHeartRate < 60) {
        neurogenicShockActive = true;
        directives.push(`STAT ALERT: Neurogenic Shock Identified! Lesion above T6 (${nli}) with hypotension (MAP ${input.currentMap} mmHg) and relative/absolute bradycardia (HR ${input.currentHeartRate} bpm). Unopposed parasympathetic tone.`);
      } else if (input.currentHeartRate >= 90) {
        concomitantHemorrhagicShockSuspected = true;
        directives.push(`WARNING: Hypotension (MAP ${input.currentMap} mmHg) with tachycardia (HR ${input.currentHeartRate} bpm). Suggests concomitant occult hemorrhagic shock (e.g. blunt abdominal/pelvic trauma) rather than isolated neurogenic shock.`);
      } else {
        neurogenicShockActive = lesionAboveT6;
      }
    }

    // 3. MAP Augmentation Protocol (AANS / CNS Consensus: MAP 85-90 mmHg for 5-7 days)
    const recommendedVasopressor = lesionAboveT6 ? 'Norepinephrine (Levophed)' : 'Norepinephrine or Phenylephrine';
    const contraindicatedAgents: string[] = [];
    if (lesionAboveT6) {
      contraindicatedAgents.push('Phenylephrine (Neo-Synephrine) - STRICTLY CONTRAINDICATED in high lesions due to reflex worsening of bradycardia');
    }
    directives.push(`AANS/CNS Guideline: Maintain MAP >= 85 - 90 mmHg continuously for 7 days (168 hours) post-injury to prevent secondary cord ischemic penumbra infarction.`);

    // 4. Ultra-Early Surgical Decompression Window (STASCIS)
    const surgicalCandidate = input.cordCompressionOnMri || input.spinalInstabilityPresent;
    let decompressionWindowStatus: SpinalCordEvaluationResult['decompressionWindowStatus'] = 'ULTRA_EARLY_OPTIMAL';
    if (input.hoursSinceInjury <= 12) {
      decompressionWindowStatus = 'ULTRA_EARLY_OPTIMAL';
      directives.push(`SURGICAL WINDOW OPTIMAL: ${input.hoursSinceInjury}h since injury (<12h). Emergent decompression and rigid stabilization recommended for maximum neurological recovery.`);
    } else if (input.hoursSinceInjury <= 24) {
      decompressionWindowStatus = 'EARLY_ACCEPTABLE';
      directives.push(`SURGICAL WINDOW ACCEPTABLE: ${input.hoursSinceInjury}h since injury (<24h). Urgent surgical decompression recommended.`);
    } else {
      decompressionWindowStatus = 'DELAYED';
      directives.push(`DELAYED DECOMPRESSION: ${input.hoursSinceInjury}h since injury (>24h). Surgical stabilization indicated for mechanical alignment, but primary ischemic injury window has elapsed.`);
    }

    // 5. Autonomic Dysreflexia Sentinel
    let autonomicDysreflexiaRisk = false;
    if (lesionAboveT6) {
      autonomicDysreflexiaRisk = true;
      if (input.baselineSbp && input.currentSbp >= input.baselineSbp + 20) {
        directives.push(`EMERGENCY: Autonomic Dysreflexia detected! SBP ${input.currentSbp} mmHg is >=20 mmHg above baseline (${input.baselineSbp} mmHg). Check for bladder distension or fecal impaction immediately.`);
      }
    }

    // Steroid caution directive
    directives.push(`STEROID CONSENSUS: High-dose Methylprednisolone (NASCIS) is NOT recommended as routine standard of care due to high rates of severe sepsis, pneumonia, and gastrointestinal hemorrhage.`);

    let recommendedAction = '';
    if (neurogenicShockActive) {
      recommendedAction = `Initiate STAT Norepinephrine infusion titrated to MAP >= 85 mmHg. Place arterial line, administer crystalloid challenge with caution, and expedite surgical decompression.`;
    } else if (surgicalCandidate && decompressionWindowStatus === 'ULTRA_EARLY_OPTIMAL') {
      recommendedAction = `STAT Spine Surgery consult for ultra-early operative decompression within 12h window. Target MAP 85-90 mmHg with Norepinephrine.`;
    } else {
      recommendedAction = `Maintain MAP >= 85 mmHg for 7 days. Continuous neuromonitoring and strict spine precautions.`;
    }

    return {
      patientId: input.patientId,
      neurologicalLevelOfInjury: nli,
      hoursSinceInjury: input.hoursSinceInjury,
      asiaGrade,
      completeness,
      motorScoreTotal: input.motorScoreTotal,
      sensoryScoreTotal: input.sensoryScoreTotal,
      sacralSparingSensory: input.sacralSparingSensory,
      sacralSparingMotor: input.sacralSparingMotor,
      bulbocavernosusReflexPresent: input.bulbocavernosusReflexPresent,
      spinalShockActive,
      neurogenicShockActive,
      concomitantHemorrhagicShockSuspected,
      lesionAboveT6,
      surgicalCandidate,
      decompressionWindowStatus,
      mapTargetGoal: {
        minMapMmhg: 85,
        maxMapMmhg: 90,
        durationDays: 7,
        durationHoursTotal: 168,
        recommendedVasopressor,
        contraindicatedAgents
      },
      autonomicDysreflexiaRisk,
      protocolDirectives: directives,
      recommendedAction
    };
  }

  /**
   * Evaluates hourly MAP titration against the 85-90 mmHg target.
   */
  public static titrateMap(input: LogMapAugmentationInput): MapAugmentationLogResult {
    let targetMet = false;
    let vasopressorAction: MapAugmentationLogResult['vasopressorAction'] = 'MAINTAIN';
    let ischemiaRiskAlert = false;
    let actionPlan = '';

    if (input.mapMmhg >= 85 && input.mapMmhg <= 95) {
      targetMet = true;
      vasopressorAction = 'MAINTAIN';
      actionPlan = `TARGET ACHIEVED: MAP ${input.mapMmhg} mmHg is within therapeutic augmentation corridor (85-95 mmHg). Maintain active vasopressor regimen.`;
    } else if (input.mapMmhg < 85) {
      targetMet = false;
      vasopressorAction = 'UPTITRATE';
      ischemiaRiskAlert = true;
      actionPlan = `CRITICAL CORD ISCHEMIA RISK: MAP ${input.mapMmhg} mmHg is below the 85 mmHg threshold. Uptitrate vasopressor by 15-20% immediately. Consider arterial line calibration check and 250 mL crystalloid bolus if CVP < 8.`;
    } else {
      // MAP > 95 mmHg
      targetMet = false;
      vasopressorAction = 'WEAN';
      ischemiaRiskAlert = false;
      actionPlan = `MAP ${input.mapMmhg} mmHg is above upper corridor (>95 mmHg). Risk of spinal cord hematoma expansion. Wean vasopressor infusion slowly by 10% every 15 minutes toward 85-90 mmHg.`;
    }

    return {
      patientId: input.patientId,
      encounterId: input.encounterId,
      postInjuryHour: input.postInjuryHour,
      systolicBp: input.systolicBp,
      diastolicBp: input.diastolicBp,
      mapMmhg: input.mapMmhg,
      heartRate: input.heartRate,
      targetMet,
      activeVasopressor: input.activeVasopressor,
      vasopressorDoseMcgMin: input.vasopressorDoseMcgMin,
      vasopressorAction,
      ischemiaRiskAlert,
      actionPlan
    };
  }

  /**
   * Persists Spinal Cord Injury encounter to the database.
   */
  public static async persistEvaluation(result: SpinalCordEvaluationResult): Promise<number> {
    const query = `
      INSERT INTO spinal_cord_injury_encounters (
        patient_id,
        neurological_level_of_injury,
        hours_since_injury,
        asia_grade,
        motor_score_total,
        sensory_score_total,
        sacral_sparing_sensory,
        sacral_sparing_motor,
        bulbocavernosus_reflex_present,
        spinal_shock_active,
        neurogenic_shock_active,
        lesion_above_t6,
        surgical_candidate,
        decompression_window_status,
        recommended_vasopressor,
        target_map_min,
        target_map_max,
        directives
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING id;
    `;

    const values = [
      result.patientId,
      result.neurologicalLevelOfInjury,
      result.hoursSinceInjury,
      result.asiaGrade,
      result.motorScoreTotal,
      result.sensoryScoreTotal,
      result.sacralSparingSensory,
      result.sacralSparingMotor,
      result.bulbocavernosusReflexPresent,
      result.spinalShockActive,
      result.neurogenicShockActive,
      result.lesionAboveT6,
      result.surgicalCandidate,
      result.decompressionWindowStatus,
      result.mapTargetGoal.recommendedVasopressor,
      result.mapTargetGoal.minMapMmhg,
      result.mapTargetGoal.maxMapMmhg,
      JSON.stringify(result.protocolDirectives)
    ];

    const res = await pool.query(query, values);
    return res.rows[0].id;
  }

  /**
   * Persists hourly MAP augmentation log.
   */
  public static async persistMapLog(result: MapAugmentationLogResult): Promise<number> {
    const query = `
      INSERT INTO map_augmentation_logs (
        encounter_id,
        patient_id,
        post_injury_hour,
        systolic_bp,
        diastolic_bp,
        map_mmhg,
        heart_rate,
        target_met,
        active_vasopressor,
        vasopressor_dose_mcg_min,
        vasopressor_action,
        ischemia_risk_alert,
        action_plan
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id;
    `;

    const values = [
      result.encounterId || null,
      result.patientId,
      result.postInjuryHour,
      result.systolicBp,
      result.diastolicBp,
      result.mapMmhg,
      result.heartRate,
      result.targetMet,
      result.activeVasopressor || null,
      result.vasopressorDoseMcgMin || null,
      result.vasopressorAction,
      result.ischemiaRiskAlert,
      result.actionPlan
    ];

    const res = await pool.query(query, values);
    return res.rows[0].id;
  }

  /**
   * Retrieves spinal cord injury evaluations for a patient.
   */
  public static async getEvaluations(patientId: number): Promise<any[]> {
    const query = `
      SELECT * FROM spinal_cord_injury_encounters
      WHERE patient_id = $1
      ORDER BY evaluated_at DESC;
    `;
    const res = await pool.query(query, [patientId]);
    return res.rows;
  }

  /**
   * Retrieves MAP augmentation logs for a patient.
   */
  public static async getMapLogs(patientId: number): Promise<any[]> {
    const query = `
      SELECT * FROM map_augmentation_logs
      WHERE patient_id = $1
      ORDER BY logged_at DESC;
    `;
    const res = await pool.query(query, [patientId]);
    return res.rows;
  }
}
