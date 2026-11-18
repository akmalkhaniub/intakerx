import { query } from '../db';

export interface VentTwinInput {
  patientId: number;
  sex: 'M' | 'F';
  heightCm: number;
  tidalVolumeMl: number;
  respiratoryRate: number;
  setPeepCmH2O: number;
  autoPeepCmH2O: number;
  plateauPressureCmH2O: number;
  peakPressureCmH2O: number;
  inspiratoryFlowLMin?: number; // default 60 L/min = 1.0 L/s
  fio2: number; // 0.21 to 1.0
  pao2Mmhg: number;
  arterialPh: number;
}

export interface VentTwinResult {
  id?: number;
  patientId: number;
  predictedBodyWeightKg: number;
  vtPerKgPbw: number;
  totalPeepCmH2O: number;
  drivingPressureCmH2O: number;
  staticComplianceMlCmH2O: number;
  airwayResistanceCmH2OLs: number;
  mechanicalPowerJMin: number;
  pao2Fio2Ratio: number;
  ventSafetyTier: 'LUNG_PROTECTIVE_OPTIMAL' | 'BAROTRAUMA_STRAIN_WARNING' | 'CRITICAL_VILI_INJURY_RISK';
  pronePositioningIndicated: boolean;
  ecmoEvaluationIndicated: boolean;
  digitalTwinRecommendations: string[];
}

export class VentilatorDigitalTwinService {
  public static evaluateVentTwin(input: VentTwinInput): VentTwinResult {
    const recs: string[] = [];

    // 1. Predicted Body Weight (ARDSNet)
    const basePbw = input.sex === 'M' ? 50.0 : 45.5;
    const pbw = Math.max(35, parseFloat((basePbw + 0.91 * (input.heightCm - 152.4)).toFixed(1)));
    const vtPerKgPbw = parseFloat((input.tidalVolumeMl / pbw).toFixed(2));

    // 2. Pressures & Compliance
    const totalPeep = parseFloat((input.setPeepCmH2O + input.autoPeepCmH2O).toFixed(1));
    const drivingPressure = parseFloat(Math.max(1, input.plateauPressureCmH2O - totalPeep).toFixed(1));
    const staticCompliance = parseFloat((input.tidalVolumeMl / drivingPressure).toFixed(1));

    // 3. Airway Resistance
    const flowLs = Math.max(0.2, (input.inspiratoryFlowLMin ?? 60) / 60.0);
    const resistiveGradient = Math.max(0, input.peakPressureCmH2O - input.plateauPressureCmH2O);
    const airwayResistance = parseFloat((resistiveGradient / flowLs).toFixed(1));

    // 4. Gattinoni Mechanical Power (J/min)
    const vtLiters = input.tidalVolumeMl / 1000.0;
    const mechanicalPower = parseFloat(
      (0.098 * input.respiratoryRate * vtLiters * (input.peakPressureCmH2O - 0.5 * drivingPressure)).toFixed(2)
    );

    // 5. Oxygenation & Prone / ECMO Triggers
    const pfRatio = Math.round(input.pao2Mmhg / Math.max(0.21, input.fio2));
    const pronePositioningIndicated = pfRatio < 150 && input.fio2 >= 0.6 && input.setPeepCmH2O >= 5;
    const ecmoEvaluationIndicated = (pfRatio < 80 && input.fio2 >= 0.8) || (input.arterialPh < 7.15 && drivingPressure >= 15);

    // 6. Safety Tier & Actionable Optimization
    let ventSafetyTier: VentTwinResult['ventSafetyTier'] = 'LUNG_PROTECTIVE_OPTIMAL';

    if (drivingPressure >= 15 || input.plateauPressureCmH2O > 30 || mechanicalPower > 17.0) {
      ventSafetyTier = 'CRITICAL_VILI_INJURY_RISK';
    } else if (vtPerKgPbw > 6.5 || input.autoPeepCmH2O >= 3.0 || resistiveGradient >= 8.0) {
      ventSafetyTier = 'BAROTRAUMA_STRAIN_WARNING';
    }

    if (drivingPressure >= 15) {
      const targetVt = Math.round(pbw * 5.0);
      recs.push(`HIGH DRIVING PRESSURE (${drivingPressure} cmH2O >= 15): Reduce Vt toward ${targetVt} mL (5 mL/kg PBW) or perform PEEP titration trial.`);
    }
    if (mechanicalPower > 17.0) {
      recs.push(`EXCESSIVE MECHANICAL POWER (${mechanicalPower} J/min > 17): High VILI energy transfer. Reduce Vt, RR, or driving pressure.`);
    }
    if (resistiveGradient >= 8.0) {
      recs.push(`ELEVATED AIRWAY RESISTANCE (${airwayResistance} cmH2O/L/s, Ppeak-Pplat=${resistiveGradient}): Inspect ETT for kinking/secretions or administer bronchodilator.`);
    }
    if (input.autoPeepCmH2O >= 2.0) {
      recs.push(`AUTO-PEEP (${input.autoPeepCmH2O} cmH2O) DETECTED: Lengthen expiratory time (lower RR or increase inspiratory flow) to prevent dynamic hyperinflation.`);
    }
    if (pronePositioningIndicated) {
      recs.push(`PROSEVA PRONE INDICATED: P/F ratio ${pfRatio} (<150). Initiate 16h/day prone positioning.`);
    }
    if (ecmoEvaluationIndicated) {
      recs.push('EOLIA VV-ECMO ALERT: Refractory severe hypoxemia or uncompensated respiratory acidosis (pH < 7.15). Activate ECMO team.');
    }
    if (input.arterialPh < 7.2 && drivingPressure < 15) {
      recs.push(`PERMISSIVE HYPERCAPNIA FLOOR BREACHED (pH ${input.arterialPh}): Increase RR up to 32-35 bpm while monitoring auto-PEEP.`);
    }

    return {
      patientId: input.patientId,
      predictedBodyWeightKg: pbw,
      vtPerKgPbw,
      totalPeepCmH2O: totalPeep,
      drivingPressureCmH2O: drivingPressure,
      staticComplianceMlCmH2O: staticCompliance,
      airwayResistanceCmH2OLs: airwayResistance,
      mechanicalPowerJMin: mechanicalPower,
      pao2Fio2Ratio: pfRatio,
      ventSafetyTier,
      pronePositioningIndicated,
      ecmoEvaluationIndicated,
      digitalTwinRecommendations: recs
    };
  }

  public static async recordVentTwin(input: VentTwinInput): Promise<VentTwinResult> {
    const result = this.evaluateVentTwin(input);
    const res = await query(
      `INSERT INTO ventilator_digital_twin_logs (
        patient_id, driving_pressure_cmh2o, mechanical_power_j_min, static_compliance_ml_cmh2o,
        auto_peep_cmh2o, vent_safety_tier, prone_positioning_indicated, twin_output
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id;`,
      [
        result.patientId,
        result.drivingPressureCmH2O,
        result.mechanicalPowerJMin,
        result.staticComplianceMlCmH2O,
        input.autoPeepCmH2O,
        result.ventSafetyTier,
        result.pronePositioningIndicated,
        JSON.stringify(result)
      ]
    );
    if (res.rows.length > 0) {
      result.id = res.rows[0].id;
    }
    return result;
  }
}
