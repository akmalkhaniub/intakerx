import { query } from '../db';

export type SansGrade = 'GRADE_0' | 'GRADE_1' | 'GRADE_2' | 'GRADE_3' | 'GRADE_4';
export type IjvFlow = 'NORMAL_ANTEROGRADE' | 'STAGNANT' | 'RETROGRADE_FLOW' | 'OCCLUSIVE_THROMBOSIS';

export interface SansEvaluationInput {
  patientId: number;
  missionDay: number;
  onsdMm: number; // Optic Nerve Sheath Diameter in mm (Normal <= 5.0mm, >5.8 abnormal)
  choroidalFolds: boolean;
  hyperopicShiftDiopters: number; // e.g. +1.50 D
  cottonWoolSpots: boolean;
  ijvFlowPattern: IjvFlow;
}

export interface SansEvaluationResult {
  id?: number;
  patientId: number;
  missionDay: number;
  onsdMm: number;
  choroidalFolds: boolean;
  hyperopicShiftDiopters: number;
  cottonWoolSpots: boolean;
  ijvFlowPattern: IjvFlow;
  sansGrade: SansGrade;
  fluidShiftSeverityScore: number; // 0 to 100
  lbnpTargetMmhg: number;
  lbnpDurationMinutes: number;
  anticoagulationRequired: boolean;
  countermeasurePlan: {
    targetLBNP: string;
    duration: string;
    anticoagulation: string;
    hydrationProtocol: string;
    nutritionAugmentation: string;
    visionCorrection: string;
    monitoringFrequency: string;
  };
  clinicalAlerts: string[];
}

export class SpaceSansService {
  /**
   * Evaluates Spaceflight Associated Neuro-ocular Syndrome (SANS) and cephalad fluid shift.
   */
  public static evaluateSans(input: SansEvaluationInput): SansEvaluationResult {
    const alerts: string[] = [];
    let severityScore = 15; // baseline microgravity fluid shift

    // 1. ONSD grading & score
    if (input.onsdMm > 6.5) {
      severityScore += 40;
      alerts.push(`CRITICAL: Optic Nerve Sheath Diameter markedly expanded (${input.onsdMm} mm) indicating severe intracranial hypertension.`);
    } else if (input.onsdMm > 5.8) {
      severityScore += 25;
      alerts.push(`ELEVATED: ONSD (${input.onsdMm} mm) exceeds upper microgravity safety threshold (5.8 mm).`);
    } else if (input.onsdMm > 5.0) {
      severityScore += 10;
    }

    // 2. Fundoscopy & Refractive shifts
    if (input.choroidalFolds) {
      severityScore += 15;
      alerts.push('Fundoscopic examination reveals choroidal folds indicative of posterior globe flattening.');
    }

    if (input.cottonWoolSpots) {
      severityScore += 20;
      alerts.push('ALERT: Cotton wool spots visualized, indicating retinal nerve fiber layer localized axoplasmic flow stasis and ischemia.');
    }

    if (input.hyperopicShiftDiopters >= 1.0) {
      severityScore += 10;
      alerts.push(`Hyperopic shift of +${input.hyperopicShiftDiopters.toFixed(2)} D detected from shortened axial globe length.`);
    }

    // 3. IJV Hemodynamics
    let anticoagulationRequired = false;
    let anticoagulationDirective = 'None indicated. Routine bilateral neck ultrasound surveillance.';
    
    if (input.ijvFlowPattern === 'OCCLUSIVE_THROMBOSIS') {
      severityScore += 30;
      anticoagulationRequired = true;
      anticoagulationDirective = 'STAT Enoxaparin 1.5 mg/kg SC q24h or Apixaban 10 mg PO BID x 7 days followed by 5 mg BID. Urgent telemetry downlink.';
      alerts.push('EMERGENT: Occlusive internal jugular vein thrombosis confirmed in microgravity. Initiate therapeutic anticoagulation immediately.');
    } else if (input.ijvFlowPattern === 'RETROGRADE_FLOW' || input.ijvFlowPattern === 'STAGNANT') {
      severityScore += 20;
      anticoagulationRequired = true;
      anticoagulationDirective = 'Prophylactic Enoxaparin 40 mg SC daily or Rivaroxaban 10 mg PO daily. Increase daily LBNP sessions to augment cranial venous drainage.';
      alerts.push(`WARNING: IJV hemodynamics demonstrate ${input.ijvFlowPattern.replace('_', ' ')}. High risk for secondary cerebral venous thrombosis.`);
    }

    // Clamp severity score to 100
    const fluidShiftSeverityScore = Math.min(100, Math.round(severityScore));

    // 4. SANS Clinical Staging (Frisén-derived microgravity scale)
    let sansGrade: SansGrade = 'GRADE_0';
    if (input.cottonWoolSpots || input.onsdMm >= 6.5) {
      sansGrade = 'GRADE_4';
    } else if (input.choroidalFolds && input.onsdMm >= 5.8) {
      sansGrade = 'GRADE_3';
    } else if (input.choroidalFolds || input.hyperopicShiftDiopters >= 1.0) {
      sansGrade = 'GRADE_2';
    } else if (input.onsdMm > 5.2 || input.hyperopicShiftDiopters > 0.5) {
      sansGrade = 'GRADE_1';
    }

    // 5. Lower Body Negative Pressure (LBNP) Prescription
    let lbnpTargetMmhg = -25.0;
    let lbnpDurationMinutes = 60;

    if (sansGrade === 'GRADE_4' || sansGrade === 'GRADE_3') {
      lbnpTargetMmhg = -40.0;
      lbnpDurationMinutes = 120;
    } else if (sansGrade === 'GRADE_2') {
      lbnpTargetMmhg = -35.0;
      lbnpDurationMinutes = 90;
    } else if (sansGrade === 'GRADE_1') {
      lbnpTargetMmhg = -30.0;
      lbnpDurationMinutes = 60;
    }

    const countermeasurePlan = {
      targetLBNP: `${lbnpTargetMmhg} mmHg chamber seal`,
      duration: `${lbnpDurationMinutes} minutes/day in single or divided blocks`,
      anticoagulation: anticoagulationDirective,
      hydrationProtocol: 'Maintain euvolemia with 2.5-3.0 L/day oral water; ingest 1.0 L isotonic electrolyte beverage (4.5 g NaCl) 2 hours prior to re-entry or heavy EVA.',
      nutritionAugmentation: 'High-dose 1-carbon metabolic support: Methylcobalamin (B12) 1000 mcg, L-methylfolate 800 mcg, and Choline 500 mg daily to modulate SANS risk alleles.',
      visionCorrection: input.hyperopicShiftDiopters > 0 ? `Space Anticipation Glasses prescription adjusted by +${input.hyperopicShiftDiopters.toFixed(2)} D.` : 'No adjustable vision corrective lenses required.',
      monitoringFrequency: sansGrade >= 'GRADE_2' ? 'Bedside ultrasound ONSD and OCT every 72 hours; daily IJV Doppler flow check.' : 'Weekly ONSD ultrasound and retinal photography.'
    };

    return {
      patientId: input.patientId,
      missionDay: input.missionDay,
      onsdMm: input.onsdMm,
      choroidalFolds: input.choroidalFolds,
      hyperopicShiftDiopters: input.hyperopicShiftDiopters,
      cottonWoolSpots: input.cottonWoolSpots,
      ijvFlowPattern: input.ijvFlowPattern,
      sansGrade,
      fluidShiftSeverityScore,
      lbnpTargetMmhg,
      lbnpDurationMinutes,
      anticoagulationRequired,
      countermeasurePlan,
      clinicalAlerts: alerts
    };
  }

  /**
   * Persists the SANS evaluation to the database.
   */
  public static async recordSansEvaluation(input: SansEvaluationInput): Promise<SansEvaluationResult> {
    const result = this.evaluateSans(input);
    const insertQuery = `
      INSERT INTO space_sans_evaluations (
        patient_id, mission_day, onsd_mm, choroidal_folds, hyperopic_shift_diopters,
        cotton_wool_spots, ijv_flow_pattern, sans_grade, lbnp_target_mmhg,
        lbnp_duration_minutes, countermeasure_plan
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, logged_at;
    `;
    const res = await query(insertQuery, [
      result.patientId,
      result.missionDay,
      result.onsdMm,
      result.choroidalFolds,
      result.hyperopicShiftDiopters,
      result.cottonWoolSpots,
      result.ijvFlowPattern,
      result.sansGrade,
      result.lbnpTargetMmhg,
      result.lbnpDurationMinutes,
      JSON.stringify(result.countermeasurePlan)
    ]);
    if (res.rows.length > 0) {
      result.id = res.rows[0].id;
    }
    return result;
  }
}
