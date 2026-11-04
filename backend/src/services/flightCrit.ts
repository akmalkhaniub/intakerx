import { pool } from '../db';

export type AircraftType = 'ROTARY_WING' | 'FIXED_WING_PRESSURIZED' | 'FIXED_WING_UNPRESSURIZED';
export type GForceVector = '+Gz' | '-Gz' | '+Gx' | '-Gx';

export interface EvaluateFlightInput {
  patientId: number;
  aircraftType: AircraftType;
  cruisingAltitudeFt: number;
  cabinAltitudeFt?: number;
  paO2SeaLevelMmhg: number;
  paCO2SeaLevelMmhg?: number;
  fiO2: number;
  baselineMapMmhg: number;
  baselineIcpMmhg?: number;
  pneumothoraxPresent: boolean;
  chestTubeInPlace: boolean;
  chestTubeOpenToAir?: boolean;
  ettCuffAirFilled: boolean;
  hasPneumocephalus?: boolean;
  accelerationGVector?: GForceVector;
}

export interface FlightEvaluationResult {
  patientId: number;
  aircraftType: AircraftType;
  cabinAltitudeFt: number;
  barometricPressureMmhg: number;
  gasExpansionRatio: number;
  predictedPaO2AltitudeMmhg: number;
  predictedPaO2DropMmhg: number;
  predictedMapHeadMmhg: number;
  predictedCppMmhg: number;
  flightRiskTier: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  cabinAltitudeRestrictionMandated: boolean;
  maxPermissibleCabinAltitudeFt: number;
  flightDirectives: string[];
}

export class FlightCritService {
  /**
   * Barometric pressure at altitude in feet using international standard atmosphere (ISA).
   */
  public static calculateBarometricPressure(altitudeFt: number): number {
    return Number((760 * Math.pow(1 - (0.0000068756 * altitudeFt), 5.2559)).toFixed(1));
  }

  /**
   * Evaluates aeromedical flight physiology for critical care transport.
   */
  public static evaluateFlightPhysiology(input: EvaluateFlightInput): FlightEvaluationResult {
    const flightDirectives: string[] = [];
    const paco2 = input.paCO2SeaLevelMmhg ?? 40.0;

    // Determine effective cabin altitude
    let cabinAltFt = input.cruisingAltitudeFt;
    if (input.aircraftType === 'FIXED_WING_PRESSURIZED') {
      cabinAltFt = input.cabinAltitudeFt ?? Math.min(8000, Math.round(input.cruisingAltitudeFt * 0.3));
    }

    const pb = this.calculateBarometricPressure(cabinAltFt);
    const pbSeaLevel = 760.0;

    // Boyle's Law: Gas expansion ratio V2 / V1 = P1 / P2
    const gasExpansionRatio = Number((pbSeaLevel / pb).toFixed(2));

    // Dalton's Law & Alveolar Gas Equation
    // PAO2 = (Pb - 47) * FiO2 - (PaCO2 / 0.8)
    const paO2AlveolarSea = (pbSeaLevel - 47) * input.fiO2 - (paco2 / 0.8);
    const paO2AlveolarAlt = (pb - 47) * input.fiO2 - (paco2 / 0.8);
    const aaGradient = Math.max(0, paO2AlveolarSea - input.paO2SeaLevelMmhg);

    // Predicted PaO2 at cabin altitude
    const predictedPaO2 = Math.max(20, Number((paO2AlveolarAlt - aaGradient).toFixed(1)));
    const paO2Drop = Number((input.paO2SeaLevelMmhg - predictedPaO2).toFixed(1));

    // G-Force effects on MAP and CPP
    // Head level is approx 30 cm above heart level: delta P = 0.77 * 30cm * G = ~23 mmHg per 1 G
    const gVector = input.accelerationGVector || '+Gz';
    let mapHead = input.baselineMapMmhg;
    if (gVector === '+Gz') {
      // Rotary climb: venous drain from head, MAP at head drops
      mapHead = Math.max(30, Number((input.baselineMapMmhg - 18).toFixed(1)));
    } else if (gVector === '-Gz') {
      // Descent: cephalad fluid shift, ICP spikes
      mapHead = Number((input.baselineMapMmhg + 12).toFixed(1));
    }

    const icp = input.baselineIcpMmhg ?? 12.0;
    const predictedIcp = gVector === '-Gz' ? icp + 8.0 : icp;
    const predictedCpp = Number((mapHead - predictedIcp).toFixed(1));

    // Determine Flight Risk Tier and Critical Directives
    let riskTier: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' = 'LOW';
    let cabinRestriction = false;
    let maxCabinAlt = 8000;

    // 1. Hypoxia Check
    if (predictedPaO2 < 60.0) {
      riskTier = 'HIGH';
      flightDirectives.push(`Cabin Altitude Hypoxia Warning: Predicted PaO2 drops to ${predictedPaO2} mmHg. Escalate FiO2 to 1.0 or titrate PEEP.`);
    }

    // 2. Pneumothorax Check (Boyle's Law)
    if (input.pneumothoraxPresent) {
      if (!input.chestTubeInPlace) {
        riskTier = 'CRITICAL';
        cabinRestriction = true;
        maxCabinAlt = 1000;
        flightDirectives.push('CRITICAL CONTRAINDICATION: Untreated pneumothorax will expand by ' + Math.round((gasExpansionRatio - 1) * 100) + '% into fatal tension pneumothorax. Thoracostomy mandatory prior to takeoff!');
      } else if (input.chestTubeOpenToAir === false) {
        riskTier = 'HIGH';
        flightDirectives.push('Chest tube must remain open to atmospheric flutter valve / drainage box. NEVER CLAMP chest tube during flight.');
      }
    }

    // 3. ETT Cuff Gas Expansion Check
    if (input.ettCuffAirFilled) {
      flightDirectives.push(`Boyle's Law Gas Expansion: ETT cuff volume expands ${Math.round((gasExpansionRatio - 1) * 100)}%. Replace air in ETT cuff with sterile saline to prevent tracheal mucosal necrosis.`);
    }

    // 4. Pneumocephalus / Brain Injury Check
    if (input.hasPneumocephalus) {
      riskTier = 'CRITICAL';
      cabinRestriction = true;
      maxCabinAlt = 1500;
      flightDirectives.push('Pneumocephalus detected: Intracranial air expansion will precipitate fatal uncal herniation. Maintain Cabin Altitude Restriction <= 1,500 ft (Sea Level Cabin Profile).');
    }

    // 5. Neurotrauma CPP Check
    if (predictedCpp < 60.0) {
      if (riskTier !== 'CRITICAL') riskTier = 'HIGH';
      flightDirectives.push(`Cerebral Perfusion Pressure Compromise: Predicted CPP drops to ${predictedCpp} mmHg under ${gVector}. Administer vasopressor to maintain systemic MAP.`);
    }

    if (flightDirectives.length === 0) {
      flightDirectives.push('Flight profile cleared. Physiological parameters within acceptable aeromedical transport margins.');
    }

    return {
      patientId: input.patientId,
      aircraftType: input.aircraftType,
      cabinAltitudeFt: cabinAltFt,
      barometricPressureMmhg: pb,
      gasExpansionRatio,
      predictedPaO2AltitudeMmhg: predictedPaO2,
      predictedPaO2DropMmhg: paO2Drop,
      predictedMapHeadMmhg: mapHead,
      predictedCppMmhg: predictedCpp,
      flightRiskTier: riskTier,
      cabinAltitudeRestrictionMandated: cabinRestriction,
      maxPermissibleCabinAltitudeFt: maxCabinAlt,
      flightDirectives
    };
  }

  /**
   * Evaluates aeromedical flight and persists to database.
   */
  public static async evaluateAndPersist(input: EvaluateFlightInput): Promise<FlightEvaluationResult> {
    const res = this.evaluateFlightPhysiology(input);

    await pool.query(`
      INSERT INTO flight_crit_missions (
        patient_id, aircraft_type, cruising_altitude_ft, cabin_altitude_ft,
        pao2_sea_level_mmhg, predicted_pao2_altitude_mmhg, gas_expansion_ratio,
        pneumothorax_present, chest_tube_open_to_air, ett_cuff_water_filled,
        acceleration_g_vector, predicted_cpp_mmhg, flight_recommendations
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13);
    `, [
      input.patientId,
      input.aircraftType,
      input.cruisingAltitudeFt,
      res.cabinAltitudeFt,
      input.paO2SeaLevelMmhg,
      res.predictedPaO2AltitudeMmhg,
      res.gasExpansionRatio,
      input.pneumothoraxPresent,
      input.chestTubeOpenToAir ?? true,
      !input.ettCuffAirFilled,
      input.accelerationGVector || '+Gz',
      res.predictedCppMmhg,
      JSON.stringify(res.flightDirectives)
    ]);

    return res;
  }
}
