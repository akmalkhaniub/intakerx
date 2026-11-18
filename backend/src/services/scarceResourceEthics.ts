import { query } from '../db';

export type ComorbidityPrognosis = 'NONE' | 'FIVE_YEAR_LIFE_LIMITING' | 'ONE_YEAR_SEVERE_LIMITING';

export interface ScarceResourceInput {
  patientId: number;
  scarceResourceType: 'MECHANICAL_VENTILATOR' | 'VA_VV_ECMO' | 'ICU_BED' | 'CRRT_MACHINE';
  sofaScore: number; // 0-24
  comorbidityPrognosis: ComorbidityPrognosis;
  isEssentialResponder: boolean;
  crisisSurgeLevel: 1 | 2 | 3; // 1=Contingency, 2=Crisis, 3=Extreme Catastrophic
  hoursOnTrialAlready?: number;
  sofaDeltaSinceAdmission?: number; // negative = improving
}

export interface ScarceResourceResult {
  id?: number;
  patientId: number;
  scarceResourceType: string;
  allocationPriorityScore: number; // 1 (highest priority) to 8 (lowest priority)
  priorityTier: 'HIGH_PRIORITY_RED' | 'INTERMEDIATE_PRIORITY_ORANGE' | 'LOW_PRIORITY_YELLOW';
  timeLimitedTrialHours: number;
  reallocationReviewTriggered: boolean;
  palliativeSymptomBundle: {
    dyspneaPain: string;
    anxietyAirHunger: string;
    secretions: string;
    ethicsOversight: string;
  };
  ethicalDirectives: string[];
}

export class ScarceResourceEthicsService {
  public static evaluateAllocation(input: ScarceResourceInput): ScarceResourceResult {
    const directives: string[] = [];

    // 1. Short-term survival (SOFA 1-4 points)
    let sofaPoints = 1;
    if (input.sofaScore > 12) sofaPoints = 4;
    else if (input.sofaScore >= 10) sofaPoints = 3;
    else if (input.sofaScore >= 6) sofaPoints = 2;

    // 2. Long-term survival prognosis (0, 2, or 4 points)
    let comorbidityPoints = 0;
    if (input.comorbidityPrognosis === 'ONE_YEAR_SEVERE_LIMITING') comorbidityPoints = 4;
    else if (input.comorbidityPrognosis === 'FIVE_YEAR_LIFE_LIMITING') comorbidityPoints = 2;

    let rawScore = sofaPoints + comorbidityPoints;

    // 3. Essential responder multiplier adjustment in Crisis Level >= 2
    if (input.isEssentialResponder && input.crisisSurgeLevel >= 2) {
      rawScore = Math.max(1, rawScore - 1);
      directives.push('Crisis Responder Multiplier applied (-1 priority score) to preserve emergency clinical capacity.');
    }

    const allocationPriorityScore = Math.min(8, Math.max(1, rawScore));

    let priorityTier: ScarceResourceResult['priorityTier'] = 'HIGH_PRIORITY_RED';
    if (allocationPriorityScore >= 6) {
      priorityTier = 'LOW_PRIORITY_YELLOW';
    } else if (allocationPriorityScore >= 4) {
      priorityTier = 'INTERMEDIATE_PRIORITY_ORANGE';
    }

    // 4. Time-Limited Trial (TLT) & Reassessment
    const timeLimitedTrialHours = input.crisisSurgeLevel === 3 ? 48 : 72;
    const hoursElapsed = input.hoursOnTrialAlready ?? 0;
    const sofaDelta = input.sofaDeltaSinceAdmission ?? 0;
    const reallocationReviewTriggered = hoursElapsed >= timeLimitedTrialHours && sofaDelta >= 2;

    if (reallocationReviewTriggered) {
      directives.push(
        `TIME-LIMITED TRIAL EXPIRED (${hoursElapsed}h >= ${timeLimitedTrialHours}h) WITH WORSENING SOFA (+${sofaDelta}): Convene Triage Officer & Ethics Committee for reallocation review.`
      );
    } else {
      directives.push(
        `Non-discriminatory CSC Allocation Score: ${allocationPriorityScore}/8 (${priorityTier}). Reassess SOFA trajectory at ${timeLimitedTrialHours}h.`
      );
    }

    directives.push('FAIRNESS GUARD: Allocation excludes race, socioeconomic status, insurance, and non-prognostic disability.');

    const palliativeSymptomBundle = {
      dyspneaPain: 'Morphine Sulfate 2-5 mg IV/SC q15-30m PRN dyspnea or pain (titrate to comfort, no ceiling).',
      anxietyAirHunger: 'Lorazepam 0.5-2 mg IV/SC q1-2h PRN agitation or air hunger.',
      secretions: 'Glycopyrrolate 0.2 mg IV/SC q4-6h PRN terminal airway secretions.',
      ethicsOversight: 'Mandatory 2-clinician Triage Team separation from bedside care team; Chaplaincy & Family Liaison support.'
    };

    return {
      patientId: input.patientId,
      scarceResourceType: input.scarceResourceType,
      allocationPriorityScore,
      priorityTier,
      timeLimitedTrialHours,
      reallocationReviewTriggered,
      palliativeSymptomBundle,
      ethicalDirectives: directives
    };
  }

  public static async recordAllocation(input: ScarceResourceInput): Promise<ScarceResourceResult> {
    const result = this.evaluateAllocation(input);
    const res = await query(
      `INSERT INTO scarce_resource_allocations (
        patient_id, allocation_priority_score, priority_tier,
        time_limited_trial_hours, allocation_output
      ) VALUES ($1, $2, $3, $4, $5) RETURNING id;`,
      [
        result.patientId,
        result.allocationPriorityScore,
        result.priorityTier,
        result.timeLimitedTrialHours,
        JSON.stringify(result)
      ]
    );
    if (res.rows.length > 0) {
      result.id = res.rows[0].id;
    }
    return result;
  }
}
