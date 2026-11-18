import { query } from '../db';

export type VenomClass =
  | 'CROTALIDAE_PIT_VIPER'
  | 'ELAPID_CORAL_COBRA'
  | 'SCORPION_CENTRUROIDES'
  | 'MARINE_STONEFISH_BOX_JELLY';

export interface EnvenomationInput {
  patientId: number;
  venomClass: VenomClass;
  preferredAntivenom?: 'CROFAB' | 'ANAVIP';
  leadingEdgeAdvancing: boolean;
  fibrinogenMgDl: number;
  plateletsK: number;
  inr: number;
  systolicBp: number;
  ptosisOrBulbarWeakness: boolean;
  nifCmH2O?: number; // Negative Inspiratory Force, e.g. -18 (closer to 0 = weaker)
  compartmentPressureMmhg?: number;
}

export interface EnvenomationResult {
  id?: number;
  patientId: number;
  venomClass: VenomClass;
  severityGrade: 'DRY_BITE_OR_MINIMAL' | 'MODERATE_LOCAL_OR_COAG' | 'SEVERE_SYSTEMIC_OR_NEURO';
  coagulopathyPresent: boolean;
  recommendedAntivenom: string;
  initialVials: number;
  airwayIntubationIndicated: boolean;
  prohibitedInterventions: string[];
  clinicalDirectives: string[];
}

export class EnvenomationAntivenomService {
  public static evaluateEnvenomation(input: EnvenomationInput): EnvenomationResult {
    const directives: string[] = [];
    const prohibitedInterventions: string[] = [
      'DO NOT apply arterial tourniquet or constricting band (worsens local ischemia/necrosis).',
      'DO NOT perform wound incision, mouth suction, or ice immersion.'
    ];

    const coagulopathyPresent = input.fibrinogenMgDl < 150 || input.plateletsK < 150 || input.inr > 1.2;
    const hypotension = input.systolicBp < 90;
    const weakNif = input.nifCmH2O !== undefined && input.nifCmH2O > -20; // e.g., -15 > -20
    const airwayIntubationIndicated = input.ptosisOrBulbarWeakness && weakNif;

    let severityGrade: EnvenomationResult['severityGrade'] = 'DRY_BITE_OR_MINIMAL';
    let recommendedAntivenom = 'Observation only (serial labs q6h x 12-24h)';
    let initialVials = 0;

    if (input.venomClass === 'CROTALIDAE_PIT_VIPER') {
      prohibitedInterventions.push('DO NOT perform prophylactic fasciotomy — give additional antivenom first; only consider fasciotomy if compartment pressure > 30 mmHg persists despite full antivenom control.');

      if (hypotension || input.fibrinogenMgDl < 100 || input.plateletsK < 50) {
        severityGrade = 'SEVERE_SYSTEMIC_OR_NEURO';
        if (input.preferredAntivenom === 'ANAVIP') {
          recommendedAntivenom = 'Anavip (Crotalidae Immune F(ab\')2 Equine)';
          initialVials = 20;
        } else {
          recommendedAntivenom = 'CroFab (Crotalidae Polyvalent Immune Fab Ovine)';
          initialVials = 10;
        }
        directives.push(`SEVERE CROTALID ENVENOMATION: Infuse ${initialVials} vials of ${recommendedAntivenom} IV over 60 min; repeat until initial control achieved.`);
      } else if (input.leadingEdgeAdvancing || coagulopathyPresent) {
        severityGrade = 'MODERATE_LOCAL_OR_COAG';
        if (input.preferredAntivenom === 'ANAVIP') {
          recommendedAntivenom = 'Anavip (Crotalidae Immune F(ab\')2 Equine)';
          initialVials = 10;
        } else {
          recommendedAntivenom = 'CroFab (Crotalidae Polyvalent Immune Fab Ovine)';
          initialVials = 6;
        }
        directives.push(`MODERATE CROTALID ENVENOMATION: Infuse ${initialVials} vials of ${recommendedAntivenom} IV; mark leading edge of edema every 30 min.`);
      }

      if (input.compartmentPressureMmhg && input.compartmentPressureMmhg > 30) {
        directives.push(`ELEVATED COMPARTMENT PRESSURE (${input.compartmentPressureMmhg} mmHg): Escalate antivenom dose + elevate limb; consult surgery only if refractory.`);
      }
    } else if (input.venomClass === 'ELAPID_CORAL_COBRA') {
      severityGrade = input.ptosisOrBulbarWeakness || weakNif ? 'SEVERE_SYSTEMIC_OR_NEURO' : 'MODERATE_LOCAL_OR_COAG';
      recommendedAntivenom = 'North American Coral Snake / Polyvalent Elapid Antivenom';
      initialVials = 5;
      directives.push('ELAPID NEUROTOXICITY: Administer antivenom early (prior to established neuromuscular paralysis) and monitor NIF & FVC q2h.');
      if (airwayIntubationIndicated) {
        directives.push(`IMMINENT RESPIRATORY FAILURE (NIF ${input.nifCmH2O} cmH2O + bulbar weakness): Perform early elective endotracheal intubation.`);
      }
    } else if (input.venomClass === 'SCORPION_CENTRUROIDES') {
      severityGrade = input.ptosisOrBulbarWeakness || hypotension ? 'SEVERE_SYSTEMIC_OR_NEURO' : 'MODERATE_LOCAL_OR_COAG';
      recommendedAntivenom = 'Anascorp (Centruroides Immune F(ab\')2)';
      initialVials = severityGrade === 'SEVERE_SYSTEMIC_OR_NEURO' ? 3 : 0;
      directives.push('CENTRUROIDES ENVENOMATION: Manage cranial nerve opsoclonus/secretions with Anascorp 3 vials IV + gentle benzodiazepines if antivenom unavailable.');
    } else {
      severityGrade = hypotension ? 'SEVERE_SYSTEMIC_OR_NEURO' : 'MODERATE_LOCAL_OR_COAG';
      recommendedAntivenom = 'Marine Polyvalent / Box Jellyfish Antivenom + Hot Water Immersion (45°C for Stonefish)';
      initialVials = hypotension ? 3 : 1;
      directives.push('MARINE ENVENOMATION: Apply acetic acid (vinegar) for Chironex box jellyfish tentacles; hot water immersion (42-45°C) for heat-labile stonefish venom.');
    }

    return {
      patientId: input.patientId,
      venomClass: input.venomClass,
      severityGrade,
      coagulopathyPresent,
      recommendedAntivenom,
      initialVials,
      airwayIntubationIndicated,
      prohibitedInterventions,
      clinicalDirectives: directives
    };
  }

  public static async recordEnvenomation(input: EnvenomationInput): Promise<EnvenomationResult> {
    const result = this.evaluateEnvenomation(input);
    const res = await query(
      `INSERT INTO envenomation_antivenom_logs (
        patient_id, venom_class, severity_grade, recommended_antivenom,
        initial_vials, eval_output
      ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;`,
      [
        result.patientId,
        result.venomClass,
        result.severityGrade,
        result.recommendedAntivenom,
        result.initialVials,
        JSON.stringify(result)
      ]
    );
    if (res.rows.length > 0) {
      result.id = res.rows[0].id;
    }
    return result;
  }
}
