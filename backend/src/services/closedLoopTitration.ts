import { query } from '../db';

export type ControllerStatus =
  | 'CLOSED_LOOP_ACTIVE'
  | 'DEADBAND_HOLD'
  | 'ESCALATE_ADJUNCT_PRESSOR'
  | 'HUMAN_OVERRIDE_REQUIRED_PRIS';

export interface ClosedLoopTitrationInput {
  patientId: number;
  currentMapMmhg: number;
  previousMapMmhg: number;
  targetMapMmhg?: number;
  integralErrorMap?: number;
  currentNorepiRateMcgKgMin: number;
  vasopressinActive: boolean;
  currentRass: number; // -5 to +4
  targetRass?: number; // default -1
  currentPropofolRateMcgKgMin: number; // 0 to 100
  propofolInfusionHours: number;
  lactateMmolL?: number;
  triglyceridesMgDl?: number;
  creatineKinaseUL?: number;
}

export interface ClosedLoopTitrationResult {
  id?: number;
  patientId: number;
  currentMapMmhg: number;
  targetMapMmhg: number;
  mapErrorMmhg: number;
  recommendedNorepiRateMcgKgMin: number;
  norepiDeltaMcgKgMin: number;
  vasopressinRecommended: boolean;
  hydrocortisoneRecommended: boolean;
  currentRass: number;
  targetRass: number;
  recommendedPropofolRateMcgKgMin: number;
  prisRiskFlagged: boolean;
  controllerStatus: ControllerStatus;
  safetyClampsApplied: string[];
  clinicalDirectives: string[];
}

export class ClosedLoopTitrationService {
  private static readonly KP = 0.004;
  private static readonly KI = 0.0005;
  private static readonly KD = 0.002;
  private static readonly MAX_NOREPI_STEP = 0.05;
  private static readonly MAX_NOREPI_RATE = 2.5;
  private static readonly DEADBAND_MMHG = 2.0;

  public static evaluateTitration(input: ClosedLoopTitrationInput): ClosedLoopTitrationResult {
    const targetMap = input.targetMapMmhg ?? 65.0;
    const targetRass = input.targetRass ?? -1;
    const integralError = input.integralErrorMap ?? 0;
    const safetyClampsApplied: string[] = [];
    const clinicalDirectives: string[] = [];

    // 1. Vasopressor PID Controller
    const mapError = parseFloat((targetMap - input.currentMapMmhg).toFixed(2));
    let rawNorepiDelta = 0;
    let clampedDelta = 0;

    if (Math.abs(mapError) <= this.DEADBAND_MMHG) {
      clampedDelta = 0;
      clinicalDirectives.push(`MAP (${input.currentMapMmhg} mmHg) within +/- ${this.DEADBAND_MMHG} mmHg deadband of target ${targetMap} mmHg. Holding Norepinephrine steady.`);
    } else {
      const dMap = input.currentMapMmhg - input.previousMapMmhg;
      rawNorepiDelta = this.KP * mapError + this.KI * integralError - this.KD * dMap;
      if (Math.abs(rawNorepiDelta) > this.MAX_NOREPI_STEP) {
        clampedDelta = Math.sign(rawNorepiDelta) * this.MAX_NOREPI_STEP;
        safetyClampsApplied.push(`Norepinephrine step clamped from ${rawNorepiDelta.toFixed(4)} to ${clampedDelta.toFixed(4)} mcg/kg/min.`);
      } else {
        clampedDelta = parseFloat(rawNorepiDelta.toFixed(4));
      }
    }

    let recommendedNorepiRate = parseFloat(
      Math.max(0, Math.min(this.MAX_NOREPI_RATE, input.currentNorepiRateMcgKgMin + clampedDelta)).toFixed(3)
    );

    if (input.currentNorepiRateMcgKgMin + clampedDelta > this.MAX_NOREPI_RATE) {
      safetyClampsApplied.push(`Norepinephrine ceiling clamp applied at ${this.MAX_NOREPI_RATE} mcg/kg/min.`);
    }

    // 2. Vasopressin & Refractory Shock Adjunct Rules
    const vasopressinRecommended = recommendedNorepiRate >= 0.25 && !input.vasopressinActive;
    const hydrocortisoneRecommended = recommendedNorepiRate >= 0.5;

    if (vasopressinRecommended) {
      clinicalDirectives.push('ADJUNCT VASOPRESSOR: Norepinephrine >= 0.25 mcg/kg/min. Initiate fixed-dose Vasopressin 0.03 units/min IV.');
    }
    if (hydrocortisoneRecommended) {
      clinicalDirectives.push('REFRACTORY SHOCK: Norepinephrine >= 0.50 mcg/kg/min. Initiate Hydrocortisone 50 mg IV q6h (200 mg/day) and evaluate Angiotensin II / Epinephrine.');
    }

    // 3. Sedation Titration & Propofol Infusion Syndrome (PRIS) Watchdog
    const lactate = input.lactateMmolL ?? 1.2;
    const triglycerides = input.triglyceridesMgDl ?? 150;
    const ck = input.creatineKinaseUL ?? 120;

    // 83 mcg/kg/min == 5.0 mg/kg/h threshold
    const highDoseProlonged = input.currentPropofolRateMcgKgMin >= 83 && input.propofolInfusionHours >= 48;
    const metabolicPrisMarkers =
      input.currentPropofolRateMcgKgMin >= 65 && (lactate >= 4.0 || triglycerides >= 500 || ck >= 5000);
    const prisRiskFlagged = highDoseProlonged || metabolicPrisMarkers;

    let recommendedPropofolRate = input.currentPropofolRateMcgKgMin;
    let controllerStatus: ControllerStatus =
      Math.abs(mapError) <= this.DEADBAND_MMHG ? 'DEADBAND_HOLD' : 'CLOSED_LOOP_ACTIVE';

    if (vasopressinRecommended || hydrocortisoneRecommended) {
      controllerStatus = 'ESCALATE_ADJUNCT_PRESSOR';
    }

    if (prisRiskFlagged) {
      recommendedPropofolRate = 0;
      controllerStatus = 'HUMAN_OVERRIDE_REQUIRED_PRIS';
      safetyClampsApplied.push('HARD STOP: Propofol Infusion Syndrome (PRIS) criteria triggered. Propofol set to 0 mcg/kg/min.');
      clinicalDirectives.push(
        'CRITICAL PRIS ALERT: Discontinue Propofol immediately. Transition sedation to Dexmedetomidine (0.2-1.4 mcg/kg/h) or Ketamine/Midazolam and monitor CK, lactate, and ECG for Brugada-like pattern.'
      );
    } else {
      const rassError = input.currentRass - targetRass; // positive = too awake, need more sedation
      if (rassError !== 0) {
        const propofolDelta = Math.max(-10, Math.min(10, rassError * 5));
        recommendedPropofolRate = Math.max(0, Math.min(80, input.currentPropofolRateMcgKgMin + propofolDelta));
        if (input.currentPropofolRateMcgKgMin + propofolDelta > 80) {
          safetyClampsApplied.push('Propofol ceiling clamped at 80 mcg/kg/min (< 5 mg/kg/h PRIS guardrail).');
        }
      }
    }

    return {
      patientId: input.patientId,
      currentMapMmhg: input.currentMapMmhg,
      targetMapMmhg: targetMap,
      mapErrorMmhg: mapError,
      recommendedNorepiRateMcgKgMin: recommendedNorepiRate,
      norepiDeltaMcgKgMin: parseFloat((recommendedNorepiRate - input.currentNorepiRateMcgKgMin).toFixed(3)),
      vasopressinRecommended,
      hydrocortisoneRecommended,
      currentRass: input.currentRass,
      targetRass,
      recommendedPropofolRateMcgKgMin: recommendedPropofolRate,
      prisRiskFlagged,
      controllerStatus,
      safetyClampsApplied,
      clinicalDirectives
    };
  }

  public static async recordTitration(input: ClosedLoopTitrationInput): Promise<ClosedLoopTitrationResult> {
    const result = this.evaluateTitration(input);
    const res = await query(
      `INSERT INTO closed_loop_titration_logs (
        patient_id, current_map_mmhg, target_map_mmhg, norepi_rate_mcg_kg_min,
        vasopressin_active, current_rass, propofol_rate_mcg_kg_min, pris_risk_flagged,
        controller_status, titration_output
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id;`,
      [
        result.patientId,
        result.currentMapMmhg,
        result.targetMapMmhg,
        result.recommendedNorepiRateMcgKgMin,
        input.vasopressinActive,
        result.currentRass,
        result.recommendedPropofolRateMcgKgMin,
        result.prisRiskFlagged,
        result.controllerStatus,
        JSON.stringify(result)
      ]
    );
    if (res.rows.length > 0) {
      result.id = res.rows[0].id;
    }
    return result;
  }
}
