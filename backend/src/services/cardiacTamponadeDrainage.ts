import { query } from '../db';

export interface CardiacTamponadeDrainageInput {
  patientId: number;
  chestTubeRateMlHr: number;
  cumulativeDrainage4hMl: number;
  hoursPostop: number;
  meanArterialPressureMmhg: number;
  centralVenousPressureMmhg: number;
  pulmonaryArteryDiastolicMmhg: number;
  pulsusParadoxusMmhg: number;
  echoRightAtrialCollapse: boolean;
  suddenCessationOfDrainage: boolean;
}

export interface CardiacTamponadeDrainageResult {
  id?: number;
  patientId: number;
  chestTubeRateMlHr: number;
  cumulativeDrainage4hMl: number;
  surgicalReexplorationIndicated: boolean;
  reexplorationCriteriaMet: string[];
  occultTamponadeSuspected: boolean;
  diastolicEqualizationPresent: boolean;
  emergencyBedsideResternotomyAlert: boolean;
  cardiacSurgicalDirectives: string[];
}

export class CardiacTamponadeDrainageService {
  public static evaluateDrainage(input: CardiacTamponadeDrainageInput): CardiacTamponadeDrainageResult {
    const directives: string[] = [];
    const reexplorationCriteriaMet: string[] = [];

    // 1. Classic Cardiac Surgical Hemorrhage Re-exploration Criteria (Kirklin/Barratt-Boyes / STS Guidelines)
    if (input.chestTubeRateMlHr >= 400 && input.hoursPostop <= 2) {
      reexplorationCriteriaMet.push(`Catastrophic initial bleeding (${input.chestTubeRateMlHr} mL/h in hour ${input.hoursPostop} >= 400 mL/h)`);
    } else if (input.chestTubeRateMlHr >= 200) {
      reexplorationCriteriaMet.push(`Excessive persistent hemorrhage (${input.chestTubeRateMlHr} mL/h >= 200 mL/h)`);
    } else if (input.cumulativeDrainage4hMl >= 800) {
      reexplorationCriteriaMet.push(`Excessive 4-hour cumulative blood loss (${input.cumulativeDrainage4hMl} mL >= 800 mL)`);
    }

    const surgicalReexplorationIndicated = reexplorationCriteriaMet.length > 0;
    if (surgicalReexplorationIndicated) {
      directives.push(
        `INDICATED SURGICAL RE-EXPLORATION: Criteria met: ${reexplorationCriteriaMet.join('; ')}. Cross-match 4 units PRBC, 4 units FFP, activate massive transfusion protocol, notify cardiac surgeon and OR STAT.`
      );
    }

    // 2. Occult Clotted Mediastinal Tamponade (Low/Sudden Zero Output with Hemodynamic Deterioration)
    const diastolicGradient = Math.abs(input.centralVenousPressureMmhg - input.pulmonaryArteryDiastolicMmhg);
    const diastolicEqualizationPresent = diastolicGradient <= 4 && input.centralVenousPressureMmhg >= 12;

    const occultTamponadeSuspected =
      input.suddenCessationOfDrainage &&
      (input.meanArterialPressureMmhg < 65 ||
        diastolicEqualizationPresent ||
        input.pulsusParadoxusMmhg >= 10 ||
        input.echoRightAtrialCollapse);

    const emergencyBedsideResternotomyAlert =
      occultTamponadeSuspected &&
      (input.meanArterialPressureMmhg < 55 || input.echoRightAtrialCollapse || diastolicEqualizationPresent);

    if (emergencyBedsideResternotomyAlert) {
      directives.push(
        `EMERGENCY BEDSIDE RESTERNOTOMY ALERT: Sudden cessation of chest tube drainage with refractory shock (MAP ${input.meanArterialPressureMmhg} mmHg), diastolic pressure equalization (CVP ${input.centralVenousPressureMmhg} ~ PAD ${input.pulmonaryArteryDiastolicMmhg}), and RA/RV compression. Chest tubes are clotted! Prepare sternotomy tray and sterile prep at bedside immediately.`
      );
    } else if (occultTamponadeSuspected) {
      directives.push(
        'SUSPECTED OCCULT TAMPONADE: Abrupt drop in chest tube drainage with hemodynamic compromise. Perform urgent bedside echocardiogram (TTE/TEE) to inspect retrocardiac and right atrial hematoma.'
      );
    } else {
      directives.push('Mediastinal drainage and intracardiac filling pressures within monitored parameters.');
    }

    return {
      patientId: input.patientId,
      chestTubeRateMlHr: input.chestTubeRateMlHr,
      cumulativeDrainage4hMl: input.cumulativeDrainage4hMl,
      surgicalReexplorationIndicated,
      reexplorationCriteriaMet,
      occultTamponadeSuspected,
      diastolicEqualizationPresent,
      emergencyBedsideResternotomyAlert,
      cardiacSurgicalDirectives: directives
    };
  }

  public static async recordEvaluation(input: CardiacTamponadeDrainageInput): Promise<CardiacTamponadeDrainageResult> {
    const result = this.evaluateDrainage(input);

    const res = await query(
      `INSERT INTO cardiac_tamponade_drainage_logs (
        patient_id, chest_tube_rate_ml_hr, cumulative_drainage_4h_ml,
        surgical_reexploration_indicated, occult_tamponade_suspected,
        pulsus_paradoxus_mmhg, diastolic_equalization_present,
        emergency_bedside_resternotomy_alert, eval_output
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id`,
      [
        input.patientId,
        input.chestTubeRateMlHr,
        input.cumulativeDrainage4hMl,
        result.surgicalReexplorationIndicated,
        result.occultTamponadeSuspected,
        input.pulsusParadoxusMmhg,
        result.diastolicEqualizationPresent,
        result.emergencyBedsideResternotomyAlert,
        JSON.stringify(result)
      ]
    );

    result.id = res.rows[0].id;
    return result;
  }
}
