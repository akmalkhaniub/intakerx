import { query } from '../db';

export interface DamageControlSurgeryInput {
  patientId: number;
  coreTemperatureC: number;
  arterialPh: number;
  baseDeficitMeqL: number;
  inr: number;
  plateletsK: number;
  packedRbcUnitsTransfused: number;
  estimatedBloodLossMl: number;
  activeAbdominalPacking: boolean;
  bowelEdemaOrVisceralSwelling: boolean;
  intraAbdominalPressureMmhg: number;
}

export interface DamageControlSurgeryResult {
  id?: number;
  patientId: number;
  lethalTriadPresent: boolean;
  lethalTriadComponents: {
    hypothermia: boolean;
    acidosis: boolean;
    coagulopathy: boolean;
  };
  physiologicalExhaustionTier: 'STABLE' | 'IMMINENT_COLLAPSE' | 'PHYSIOLOGICAL_EXTREMIS';
  openAbdomenIndicated: boolean;
  tacTechnique: 'ABThera Negative Pressure (-125 mmHg)' | 'Barker Vacuum Pack' | 'Bogota Bag' | 'Primary Closure Allowed';
  abdominalCompartmentSyndromeRisk: 'LOW' | 'IAH_GRADE_I_II' | 'IAH_GRADE_III' | 'ACS_EMERGENCY';
  plannedIcuResuscitationHrs: number;
  surgicalDirectives: string[];
}

export class DamageControlSurgeryService {
  public static evaluateDcs(input: DamageControlSurgeryInput): DamageControlSurgeryResult {
    const directives: string[] = [];

    // 1. Lethal Triad Components
    const hypothermia = input.coreTemperatureC < 35.0;
    const acidosis = input.arterialPh < 7.20 || input.baseDeficitMeqL > 10.0;
    const coagulopathy = input.inr > 1.5 || input.plateletsK < 50;

    const triadCount = (hypothermia ? 1 : 0) + (acidosis ? 1 : 0) + (coagulopathy ? 1 : 0);
    const lethalTriadPresent = triadCount >= 2;

    let physiologicalExhaustionTier: DamageControlSurgeryResult['physiologicalExhaustionTier'] = 'STABLE';
    if (triadCount === 3 || input.arterialPh < 7.10 || input.packedRbcUnitsTransfused >= 10) {
      physiologicalExhaustionTier = 'PHYSIOLOGICAL_EXTREMIS';
    } else if (triadCount >= 1 || input.baseDeficitMeqL > 6.0) {
      physiologicalExhaustionTier = 'IMMINENT_COLLAPSE';
    }

    // 2. Abdominal Compartment Syndrome & Pressure Stratification
    let abdominalCompartmentSyndromeRisk: DamageControlSurgeryResult['abdominalCompartmentSyndromeRisk'] = 'LOW';
    if (input.intraAbdominalPressureMmhg >= 20) {
      abdominalCompartmentSyndromeRisk = 'ACS_EMERGENCY';
      directives.push(
        `ABDOMINAL COMPARTMENT SYNDROME (IAP ${input.intraAbdominalPressureMmhg} mmHg): Emergent decompressive laparotomy required. Avoid forced fascial closure.`
      );
    } else if (input.intraAbdominalPressureMmhg >= 16) {
      abdominalCompartmentSyndromeRisk = 'IAH_GRADE_III';
      directives.push(`Intra-abdominal Hypertension Grade III (IAP ${input.intraAbdominalPressureMmhg} mmHg): Initiate aggressive gastrointestinal decompression and sedation.`);
    } else if (input.intraAbdominalPressureMmhg >= 12) {
      abdominalCompartmentSyndromeRisk = 'IAH_GRADE_I_II';
    }

    // 3. Open Abdomen & TAC Technique
    let openAbdomenIndicated = false;
    let tacTechnique: DamageControlSurgeryResult['tacTechnique'] = 'Primary Closure Allowed';
    let plannedIcuResuscitationHrs = 0;

    if (
      lethalTriadPresent ||
      physiologicalExhaustionTier === 'PHYSIOLOGICAL_EXTREMIS' ||
      input.bowelEdemaOrVisceralSwelling ||
      input.activeAbdominalPacking ||
      input.intraAbdominalPressureMmhg >= 16
    ) {
      openAbdomenIndicated = true;
      plannedIcuResuscitationHrs = lethalTriadPresent ? 36 : 24;

      if (input.bowelEdemaOrVisceralSwelling || input.activeAbdominalPacking) {
        tacTechnique = 'ABThera Negative Pressure (-125 mmHg)';
        directives.push(
          'ABBREVIATED DAMAGE CONTROL LAPAROTOMY: Pack bleeding quadrants, place visceral protective layer, apply continuous negative pressure wound therapy (ABThera -125 mmHg).'
        );
      } else {
        tacTechnique = 'Barker Vacuum Pack';
        directives.push('Temporary Abdominal Closure indicated: Maintain Barker vacuum pack or suction drainage to prevent tension closure.');
      }

      directives.push(
        `PLANNED ICU RESUSCITATION (${plannedIcuResuscitationHrs}h): Active warming to core > 36.0°C, balance 1:1:1 MTP transfusion, correct base deficit to < 4 mEq/L before scheduled take-back for pack removal.`
      );
      directives.push('PRIMARY FASCIAL CLOSURE IS STRICTLY PROHIBITED in the setting of severe visceral edema.');
    } else {
      directives.push('Physiological status stable without severe visceral edema: Definitive primary abdominal wall closure permitted.');
    }

    return {
      patientId: input.patientId,
      lethalTriadPresent,
      lethalTriadComponents: {
        hypothermia,
        acidosis,
        coagulopathy
      },
      physiologicalExhaustionTier,
      openAbdomenIndicated,
      tacTechnique,
      abdominalCompartmentSyndromeRisk,
      plannedIcuResuscitationHrs,
      surgicalDirectives: directives
    };
  }

  public static async recordEvaluation(input: DamageControlSurgeryInput): Promise<DamageControlSurgeryResult> {
    const result = this.evaluateDcs(input);

    const res = await query(
      `INSERT INTO damage_control_surgery_logs (
        patient_id, lethal_triad_present, hypothermia_c, arterial_ph,
        base_deficit_meq, coagulopathy_inr, open_abdomen_indicated,
        tac_technique, planned_icu_resuscitation_hrs, eval_output
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id`,
      [
        input.patientId,
        result.lethalTriadPresent,
        input.coreTemperatureC,
        input.arterialPh,
        input.baseDeficitMeqL,
        input.inr,
        result.openAbdomenIndicated,
        result.tacTechnique,
        result.plannedIcuResuscitationHrs,
        JSON.stringify(result)
      ]
    );

    result.id = res.rows[0].id;
    return result;
  }
}
