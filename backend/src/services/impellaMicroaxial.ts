import { query } from '../db';

export interface ImpellaMicroaxialInput {
  patientId: number;
  deviceModel: 'Impella CP' | 'Impella 5.0' | 'Impella 5.5' | 'Impella RP';
  pLevel: string; // e.g. 'P-8', 'P-6'
  flowRateLpm: number;
  motorCurrentMa: number;
  purgePressureMmhg: number;
  purgeFlowMlHr: number;
  meanArterialPressureMmhg: number;
  centralVenousPressureMmhg: number;
  cardiacOutputLpm: number;
  echocardiographicMalposition: boolean;
  systemicHypovolemiaSuspected: boolean;
}

export interface ImpellaMicroaxialResult {
  id?: number;
  patientId: number;
  deviceModel: string;
  pLevel: string;
  flowRateLpm: number;
  cardiacPowerOutputWatts: number;
  cpoShockStatus: 'ADEQUATE_PERFUSION' | 'IMPAIRED_CARDIOGENIC_SHOCK';
  suctionAlarmPresent: boolean;
  suctionEtiology: 'HYPOVOLEMIA_PRELOAD' | 'CANNULA_MALPOSITION_WALL' | 'RIGHT_VENTRICLE_FAILURE' | 'NO_SUCTION';
  purgeStatus: 'PURGE_NORMAL' | 'PURGE_HIGH_PRESSURE_CLOT_RISK' | 'PURGE_LOW_PRESSURE_LEAK' | 'PURGE_HIGH_FLOW_DILUTION';
  hemodynamicDirectives: string[];
}

export class ImpellaMicroaxialService {
  public static evaluateImpella(input: ImpellaMicroaxialInput): ImpellaMicroaxialResult {
    const directives: string[] = [];

    // 1. Cardiac Power Output (CPO = [MAP * CO] / 451)
    const cpoWatts = Number(((input.meanArterialPressureMmhg * input.cardiacOutputLpm) / 451).toFixed(2));
    const cpoShockStatus: ImpellaMicroaxialResult['cpoShockStatus'] =
      cpoWatts < 0.6 ? 'IMPAIRED_CARDIOGENIC_SHOCK' : 'ADEQUATE_PERFUSION';

    if (cpoShockStatus === 'IMPAIRED_CARDIOGENIC_SHOCK') {
      directives.push(`CARDIOGENIC SHOCK (CPO ${cpoWatts} W < 0.6 W): Insufficient total circulatory power output. Optimize LV unloading, escalate P-level if preload permits, and assess inotropic support.`);
    }

    // 2. Impella Suction Alarms & Etiology
    let suctionAlarmPresent = false;
    let suctionEtiology: ImpellaMicroaxialResult['suctionEtiology'] = 'NO_SUCTION';

    if (input.flowRateLpm < 2.0 || input.motorCurrentMa < 400 || input.echocardiographicMalposition || input.systemicHypovolemiaSuspected) {
      suctionAlarmPresent = true;
      if (input.echocardiographicMalposition) {
        suctionEtiology = 'CANNULA_MALPOSITION_WALL';
        directives.push('SUCTION ALARM - CANNULA MALPOSITION: Inlet cage abutting LV lateral wall or mitral subvalvular apparatus. Reduce P-level to P-2 immediately; reposition under TEE or fluoroscopy.');
      } else if (input.systemicHypovolemiaSuspected || input.centralVenousPressureMmhg < 8) {
        suctionEtiology = 'HYPOVOLEMIA_PRELOAD';
        directives.push(`SUCTION ALARM - INSUFFICIENT PRELOAD (CVP ${input.centralVenousPressureMmhg} mmHg): Administer crystalloid/blood volume expansion before stepping down pump support.`);
      } else if (input.centralVenousPressureMmhg > 16 && input.deviceModel !== 'Impella RP') {
        suctionEtiology = 'RIGHT_VENTRICLE_FAILURE';
        directives.push(`SUCTION ALARM - UNMASKED RV FAILURE (CVP ${input.centralVenousPressureMmhg} mmHg): LV decompression without adequate RV output. Initiate Inhaled Epoprostenol / Milrinone or evaluate for BiPella / Impella RP.`);
      } else {
        suctionEtiology = 'HYPOVOLEMIA_PRELOAD';
        directives.push('SUCTION DETECTED: Check LV cavity dimensions and volume status.');
      }
    }

    // 3. Purge System Dynamics (Normal: 300-1100 mmHg, 2-30 mL/h)
    let purgeStatus: ImpellaMicroaxialResult['purgeStatus'] = 'PURGE_NORMAL';
    if (input.purgePressureMmhg > 1100) {
      purgeStatus = 'PURGE_HIGH_PRESSURE_CLOT_RISK';
      directives.push(`PURGE HIGH PRESSURE WARNING (${input.purgePressureMmhg} mmHg > 1100 mmHg): Risk of biomaterial clotting in motor gap. Check tubing for kinks, confirm D20W + standard purge heparin/bicarbonate concentration, consider purge flush.`);
    } else if (input.purgePressureMmhg < 300) {
      purgeStatus = 'PURGE_LOW_PRESSURE_LEAK';
      directives.push(`PURGE LOW PRESSURE ALERT (${input.purgePressureMmhg} mmHg < 300 mmHg): Potential purge fluid leak or cassette disconnect. Inspect all Luer locks immediately.`);
    } else if (input.purgeFlowMlHr > 30) {
      purgeStatus = 'PURGE_HIGH_FLOW_DILUTION';
      directives.push(`HIGH PURGE FLOW (${input.purgeFlowMlHr} mL/h): High systemic delivery of hypertonic dextrose; monitor blood glucose closely.`);
    } else {
      directives.push('Purge system operating within normal pressure and flow parameters.');
    }

    return {
      patientId: input.patientId,
      deviceModel: input.deviceModel,
      pLevel: input.pLevel,
      flowRateLpm: input.flowRateLpm,
      cardiacPowerOutputWatts: cpoWatts,
      cpoShockStatus,
      suctionAlarmPresent,
      suctionEtiology,
      purgeStatus,
      hemodynamicDirectives: directives
    };
  }

  public static async recordEvaluation(input: ImpellaMicroaxialInput): Promise<ImpellaMicroaxialResult> {
    const result = this.evaluateImpella(input);

    const res = await query(
      `INSERT INTO impella_microaxial_logs (
        patient_id, device_model, p_level, flow_rate_lpm,
        motor_current_ma, purge_pressure_mmhg, purge_flow_ml_hr,
        suction_alarm_present, suction_etiology, cardiac_power_output_watts, eval_output
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
      [
        input.patientId,
        result.deviceModel,
        result.pLevel,
        input.flowRateLpm,
        input.motorCurrentMa,
        input.purgePressureMmhg,
        input.purgeFlowMlHr,
        result.suctionAlarmPresent,
        result.suctionEtiology,
        result.cardiacPowerOutputWatts,
        JSON.stringify(result)
      ]
    );

    result.id = res.rows[0].id;
    return result;
  }
}
