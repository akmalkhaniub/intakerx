import { pool } from '../db';

export type BurnMechanism =
  | 'THERMAL_FLAME'
  | 'SCALD'
  | 'ELECTRICAL_HIGH_VOLTAGE'
  | 'CHEMICAL';

export type FluidCreepFlag =
  | 'NORMAL'
  | 'CAUTION_CREEP'
  | 'SEVERE_ACS_RISK';

export type TitrationAction =
  | 'MAINTAIN'
  | 'INCREASE_20_PCT'
  | 'DECREASE_20_PCT'
  | 'STAT_ALBUMIN_RESCUE'
  | 'SURGICAL_ESCHAROTOMY';

export interface TbsaBreakdownInput {
  headNeck?: number; // 9%
  anteriorTrunk?: number; // 18%
  posteriorTrunk?: number; // 18%
  rightArm?: number; // 9%
  leftArm?: number; // 9%
  rightLeg?: number; // 18%
  leftLeg?: number; // 18%
  perineum?: number; // 1%
  firstDegreeSunburnTbsa?: number; // STRICTLY EXCLUDED
}

export interface EvaluateBurnInput {
  patientId: number;
  weightKg: number;
  isPediatric?: boolean;
  mechanism: BurnMechanism;
  hoursSinceInjury: number;
  prehospitalFluidReceivedMl?: number;
  tbsaBreakdown?: TbsaBreakdownInput;
  totalTbsaPercentage?: number;
  circumferentialBurnLimbsOrTorso?: boolean;
  inhalationInjurySigns?: string[]; // 'singed_nasal_hairs', 'carbonaceous_sputum', 'facial_burns', 'stridor_hoarseness', 'enclosed_space'
  carboxyhemoglobinPct?: number;
  serumLactateMmolL?: number;
  pigmenturiaOrRhabdo?: boolean;
  cumulativeFluidMl?: number;
}

export interface BurnEvaluationResult {
  patientId: number;
  weightKg: number;
  calculatedTbsa: number;
  firstDegreeTbsaExcluded: number;
  mechanism: BurnMechanism;
  hoursSinceInjury: number;
  carboxyhemoglobinPct?: number;
  parklandFormula: {
    coefficientMlPerKgPct: number;
    total24hVolumeMl: number;
    first8hVolumeTotalMl: number;
    remainingFirst8hVolumeMl: number;
    remainingFirst8hHours: number;
    first8hRateMlH: number;
    next16hVolumeMl: number;
    next16hRateMlH: number;
  };
  targetUrineOutput: {
    targetRangeMlKgH: string;
    targetMinMlH: number;
    targetMaxMlH: number;
    specialRationale: string;
  };
  inhalationInjuryPlan: {
    suspected: boolean;
    intubationIndicated: boolean;
    fio2Protocol: string;
    coHalfLifeEstimate: string;
    cyanideAntidoteIndicated: boolean;
    cyanideAntidoteDose?: string;
  };
  compartmentSyndromeAndEscharotomy: {
    escharotomyIndicated: boolean;
    locationGuidance: string[];
    bladderPressureMonitoringIndicated: boolean;
  };
  protocolDirectives: string[];
  clinicalSummary: string;
}

export interface LogHourlyTitrationInput {
  encounterId?: number;
  patientId: number;
  weightKg: number;
  hourPostBurn: number;
  currentLrRateMlH: number;
  urineOutputMl: number;
  bladderPressureMmhg?: number;
  cumulativeFluidMl: number;
  pigmenturiaPresent?: boolean;
}

export interface HourlyTitrationResult {
  patientId: number;
  encounterId?: number;
  hourPostBurn: number;
  currentLrRateMlH: number;
  urineOutputMl: number;
  urineOutputMlKgH: number;
  bladderPressureMmhg?: number;
  cumulativeFluidMl: number;
  fluidCreepFlag: FluidCreepFlag;
  titrationAction: TitrationAction;
  newLrRateMlH: number;
  clinicalDirective: string;
}

export class BurnResusService {
  /**
   * Calculates TBSA, Parkland-Baxter 24h Fluid, Inhalation Injury Protocol, and Escharotomy needs.
   */
  public static evaluateBurnShock(input: EvaluateBurnInput): BurnEvaluationResult {
    const directives: string[] = [];

    // 1. Calculate TBSA (2nd and 3rd degree ONLY)
    let calculatedTbsa = 0;
    let firstDegreeExcluded = 0;

    if (input.tbsaBreakdown) {
      const b = input.tbsaBreakdown;
      calculatedTbsa =
        (b.headNeck || 0) +
        (b.anteriorTrunk || 0) +
        (b.posteriorTrunk || 0) +
        (b.rightArm || 0) +
        (b.leftArm || 0) +
        (b.rightLeg || 0) +
        (b.leftLeg || 0) +
        (b.perineum || 0);
      firstDegreeExcluded = b.firstDegreeSunburnTbsa || 0;
    } else {
      calculatedTbsa = input.totalTbsaPercentage || 0;
    }

    if (firstDegreeExcluded > 0) {
      directives.push(`RULE OF NINES: Excluded ${firstDegreeExcluded}% superficial 1st degree sunburn from Parkland formula (2nd/3rd degree only).`);
    }

    // 2. Parkland / Baxter Fluid Calculation
    // Coefficient: Standard 4.0 mL/kg/%TBSA (3.0 for pediatric, 4.0 for deep thermal or electrical)
    const coefficient = input.isPediatric ? 3.0 : 4.0;
    const total24hVolume = Number((coefficient * input.weightKg * calculatedTbsa).toFixed(1));

    // The Burn Clock starts AT INJURY TIME, NOT hospital arrival time!
    const elapsedHours = Math.min(Math.max(input.hoursSinceInjury, 0), 24);
    const prehospitalFluid = input.prehospitalFluidReceivedMl || 0;

    const first8hTotalTarget = total24hVolume / 2.0;
    const remainingFirst8hVolume = Math.max(0, first8hTotalTarget - prehospitalFluid);
    const remainingFirst8hHours = Math.max(0.5, 8.0 - elapsedHours);

    // Initial infusion rate for the first 8-hour block
    let first8hRate = 0;
    if (elapsedHours < 8.0) {
      first8hRate = Number((remainingFirst8hVolume / remainingFirst8hHours).toFixed(1));
    } else {
      // Patient arrived after 8h; proceed to next 16h calculation
      first8hRate = Number((total24hVolume / 2.0 / 16.0).toFixed(1));
    }

    const next16hVolume = total24hVolume / 2.0;
    const next16hRate = Number((next16hVolume / 16.0).toFixed(1));

    directives.push(`Parkland-Baxter Fluid Plan: Total 24h LR = ${total24hVolume} mL (${coefficient} mL x ${input.weightKg} kg x ${calculatedTbsa}% TBSA).`);
    if (elapsedHours > 0) {
      directives.push(`Burn Clock Offset: ${elapsedHours}h elapsed since injury. Initial rate accelerated to ${first8hRate} mL/h for the remaining ${remainingFirst8hHours.toFixed(1)}h of the 8-hour window.`);
    } else {
      directives.push(`Initial Infusion Rate: ${first8hRate} mL/h Lactated Ringer's over first 8 hours.`);
    }

    // 3. Target Urine Output Determination
    let targetRange = '0.5 - 1.0 mL/kg/h';
    let targetMin = Number((0.5 * input.weightKg).toFixed(1));
    let targetMax = Number((1.0 * input.weightKg).toFixed(1));
    let specialRationale = 'Standard thermal adult target: Maintain adequate microvascular perfusion while preventing fluid creep.';

    if (input.pigmenturiaOrRhabdo || input.mechanism === 'ELECTRICAL_HIGH_VOLTAGE') {
      targetRange = '1.5 - 2.0 mL/kg/h (or 75-100 mL/h)';
      targetMin = Math.max(75, Number((1.5 * input.weightKg).toFixed(1)));
      targetMax = Math.max(100, Number((2.0 * input.weightKg).toFixed(1)));
      specialRationale = 'High-voltage electrical injury / Pigmenturia: High flow target to flush toxic myoglobin/hemoglobin casts and prevent acute tubular necrosis (ATN).';
      directives.push(`Electrical/Pigmenturia Target: Maintain UO at ${targetMin} - ${targetMax} mL/h (${targetRange}) until urine clears.`);
    } else if (input.isPediatric) {
      targetRange = '1.0 - 1.5 mL/kg/h';
      targetMin = Number((1.0 * input.weightKg).toFixed(1));
      targetMax = Number((1.5 * input.weightKg).toFixed(1));
      specialRationale = 'Pediatric burn target (<30 kg): Higher metabolic rate and renal concentrating limitations.';
    }

    // 4. Inhalation Injury, Carbon Monoxide & Cyanide Toxicity Sentinel
    const inhalSigns = input.inhalationInjurySigns || [];
    const hasInhalSigns = inhalSigns.length > 0;
    const severeInhal = inhalSigns.some(s => ['stridor_hoarseness', 'carbonaceous_sputum', 'enclosed_space'].includes(s));
    const coPct = input.carboxyhemoglobinPct || 0;
    const lactate = input.serumLactateMmolL || 0;

    const cyanideSuspected = (inhalSigns.includes('enclosed_space') && lactate >= 8.0) || lactate >= 10.0;
    const intubationIndicated = severeInhal || coPct >= 25.0 || calculatedTbsa >= 40.0;

    let coHalfLife = 'Room air: 4-6 hours';
    let fio2Protocol = 'Maintain room air unless hypoxemic';
    if (coPct > 5.0 || hasInhalSigns) {
      fio2Protocol = 'STAT 100% FiO2 via non-rebreather mask or endotracheal tube';
      coHalfLife = '100% FiO2 reduces COHb half-life from 300 min to 45-60 min (HBOT reduces to 20-30 min)';
      directives.push(`CO Protocol: Administer 100% FiO2 continuously. Current COHb ${coPct}%. Target COHb < 3-5%.`);
    }

    let cyanideAntidoteDose: string | undefined;
    if (cyanideSuspected) {
      cyanideAntidoteDose = 'Hydroxocobalamin (Cyanokit) 5.0 g IV infusion over 15 minutes (repeat second 5.0 g dose if refractory shock)';
      directives.push(`CRITICAL TOXICITY: Smoke-inhalation Cyanide toxicity suspected (Lactate ${lactate} mmol/L). Administer ${cyanideAntidoteDose}.`);
    }

    if (intubationIndicated) {
      directives.push('AIRWAY WATCHDOG: Emergent endotracheal intubation indicated. High risk of rapid laryngeal edema and complete airway occlusion within 6-12 hours.');
    }

    // 5. Circumferential Burns & Escharotomy
    const escharotomyIndicated = input.circumferentialBurnLimbsOrTorso === true;
    const locationGuidance: string[] = [];

    if (escharotomyIndicated) {
      locationGuidance.push('Torso: Mid-axillary bilateral vertical incisions joined by transverse subcostal incision ("shield" cut) to release ventilatory restriction.');
      locationGuidance.push('Limbs: Medial and lateral mid-axial incisions avoiding ulnar and common peroneal nerves to restore distal arterial pulses.');
      directives.push('SURGICAL ALERT: Circumferential full-thickness burn. Monitor Doppler pulses and peak airway pressures. Prepare bedside scalpel for emergent escharotomy.');
    }

    // Clinical Summary
    let clinicalSummary = '';
    if (calculatedTbsa >= 20.0 || escharotomyIndicated || cyanideSuspected) {
      clinicalSummary = `CRITICAL BURN SHOCK: ${calculatedTbsa}% TBSA (${input.mechanism}). Parkland LR ${total24hVolume} mL/24h. Initial rate ${first8hRate} mL/h. ${cyanideSuspected ? 'Cyanide antidote ordered.' : ''}`;
    } else {
      clinicalSummary = `Burn shock evaluated: ${calculatedTbsa}% TBSA. Parkland 24h LR: ${total24hVolume} mL. Titrate to UO ${targetRange}.`;
    }

    return {
      patientId: input.patientId,
      weightKg: input.weightKg,
      calculatedTbsa,
      firstDegreeTbsaExcluded: firstDegreeExcluded,
      mechanism: input.mechanism,
      hoursSinceInjury: input.hoursSinceInjury,
      carboxyhemoglobinPct: input.carboxyhemoglobinPct,
      parklandFormula: {
        coefficientMlPerKgPct: coefficient,
        total24hVolumeMl: total24hVolume,
        first8hVolumeTotalMl: first8hTotalTarget,
        remainingFirst8hVolumeMl: remainingFirst8hVolume,
        remainingFirst8hHours,
        first8hRateMlH: first8hRate,
        next16hVolumeMl: next16hVolume,
        next16hRateMlH: next16hRate
      },
      targetUrineOutput: {
        targetRangeMlKgH: targetRange,
        targetMinMlH: targetMin,
        targetMaxMlH: targetMax,
        specialRationale
      },
      inhalationInjuryPlan: {
        suspected: hasInhalSigns,
        intubationIndicated,
        fio2Protocol,
        coHalfLifeEstimate: coHalfLife,
        cyanideAntidoteIndicated: cyanideSuspected,
        cyanideAntidoteDose
      },
      compartmentSyndromeAndEscharotomy: {
        escharotomyIndicated,
        locationGuidance,
        bladderPressureMonitoringIndicated: calculatedTbsa >= 30.0 || input.cumulativeFluidMl !== undefined
      },
      protocolDirectives: directives,
      clinicalSummary
    };
  }

  /**
   * Evaluates hourly urine output titration against Parkland targets and monitors fluid creep / ACS.
   */
  public static evaluateHourlyTitration(input: LogHourlyTitrationInput): HourlyTitrationResult {
    const uoMlKgH = Number((input.urineOutputMl / input.weightKg).toFixed(2));
    const cumulativeFluidPerKg = Number((input.cumulativeFluidMl / input.weightKg).toFixed(1));

    // Fluid Creep & ACS Risk Assessment
    let fluidCreepFlag: FluidCreepFlag = 'NORMAL';
    if (cumulativeFluidPerKg > 250.0 || (input.bladderPressureMmhg !== undefined && input.bladderPressureMmhg >= 20.0)) {
      fluidCreepFlag = 'SEVERE_ACS_RISK';
    } else if (cumulativeFluidPerKg > 180.0 || (input.bladderPressureMmhg !== undefined && input.bladderPressureMmhg >= 12.0)) {
      fluidCreepFlag = 'CAUTION_CREEP';
    }

    // Target UO Thresholds
    const minTarget = input.pigmenturiaPresent ? 1.5 : 0.5;
    const maxTarget = input.pigmenturiaPresent ? 2.0 : 1.0;

    let titrationAction: TitrationAction = 'MAINTAIN';
    let newLrRate = input.currentLrRateMlH;
    let clinicalDirective = '';

    if (input.bladderPressureMmhg !== undefined && input.bladderPressureMmhg >= 20.0) {
      titrationAction = 'STAT_ALBUMIN_RESCUE';
      newLrRate = Number((input.currentLrRateMlH * 0.75).toFixed(0));
      clinicalDirective = `CRITICAL ACS ALERT: Bladder pressure ${input.bladderPressureMmhg} mmHg (>=20 mmHg). Abdominal Compartment Syndrome developing! Decrease crystalloids by 25% and initiate 5% Albumin rescue infusion (0.5-1.0 mL/kg/%TBSA). Prepare surgical decompression.`;
    } else if (uoMlKgH < minTarget) {
      titrationAction = 'INCREASE_20_PCT';
      newLrRate = Number((input.currentLrRateMlH * 1.25).toFixed(0));
      clinicalDirective = `Oliguria / Under-resuscitation (UO ${uoMlKgH} mL/kg/h < ${minTarget}). Increase Lactated Ringer's rate by 25% from ${input.currentLrRateMlH} to ${newLrRate} mL/h.`;
    } else if (uoMlKgH > maxTarget && fluidCreepFlag !== 'NORMAL') {
      titrationAction = 'DECREASE_20_PCT';
      newLrRate = Number((input.currentLrRateMlH * 0.8).toFixed(0));
      clinicalDirective = `Over-resuscitation & Fluid Creep Warning (UO ${uoMlKgH} mL/kg/h > ${maxTarget}, Cumulative ${cumulativeFluidPerKg} mL/kg). Decrease LR rate by 20% to ${newLrRate} mL/h to prevent pulmonary edema and ACS.`;
    } else if (uoMlKgH > maxTarget) {
      titrationAction = 'DECREASE_20_PCT';
      newLrRate = Number((input.currentLrRateMlH * 0.8).toFixed(0));
      clinicalDirective = `Excessive urine output (UO ${uoMlKgH} mL/kg/h > ${maxTarget}). Decrease LR rate by 20% to ${newLrRate} mL/h to maintain target range.`;
    } else {
      titrationAction = 'MAINTAIN';
      clinicalDirective = `Target Reached: Urine output ${uoMlKgH} mL/kg/h is within therapeutic window (${minTarget} - ${maxTarget} mL/kg/h). Maintain current infusion rate at ${input.currentLrRateMlH} mL/h.`;
    }

    return {
      patientId: input.patientId,
      encounterId: input.encounterId,
      hourPostBurn: input.hourPostBurn,
      currentLrRateMlH: input.currentLrRateMlH,
      urineOutputMl: input.urineOutputMl,
      urineOutputMlKgH: uoMlKgH,
      bladderPressureMmhg: input.bladderPressureMmhg,
      cumulativeFluidMl: input.cumulativeFluidMl,
      fluidCreepFlag,
      titrationAction,
      newLrRateMlH: newLrRate,
      clinicalDirective
    };
  }

  /**
   * Persists burn resuscitation encounter.
   */
  public static async persistBurnEncounter(result: BurnEvaluationResult): Promise<number> {
    const query = `
      INSERT INTO burn_resuscitation_encounters (
        patient_id,
        weight_kg,
        tbsa_percentage,
        burn_depth_classification,
        mechanism_type,
        hours_since_injury,
        parkland_total_24h_ml,
        first_8h_rate_ml_h,
        next_16h_rate_ml_h,
        target_urine_output_ml_kg_h,
        inhalation_injury_suspected,
        carboxyhemoglobin_pct,
        cyanide_suspected,
        escharotomy_indicated,
        protocol_directives
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id;
    `;

    const values = [
      result.patientId,
      result.weightKg,
      result.calculatedTbsa,
      'SECOND_AND_THIRD_DEGREE',
      result.mechanism,
      result.hoursSinceInjury,
      result.parklandFormula.total24hVolumeMl,
      result.parklandFormula.first8hRateMlH,
      result.parklandFormula.next16hRateMlH,
      result.targetUrineOutput.targetMinMlH / result.weightKg,
      result.inhalationInjuryPlan.suspected,
      result.carboxyhemoglobinPct || null,
      result.inhalationInjuryPlan.cyanideAntidoteIndicated,
      result.compartmentSyndromeAndEscharotomy.escharotomyIndicated,
      JSON.stringify(result.protocolDirectives)
    ];

    const res = await pool.query(query, values);
    return res.rows[0].id;
  }

  /**
   * Persists hourly titration log.
   */
  public static async persistTitrationLog(result: HourlyTitrationResult): Promise<number> {
    const query = `
      INSERT INTO hourly_parkland_titration_logs (
        encounter_id,
        patient_id,
        hour_post_burn,
        current_lr_rate_ml_h,
        urine_output_ml,
        urine_output_ml_kg_h,
        bladder_pressure_mmhg,
        cumulative_fluid_ml,
        fluid_creep_flag,
        titration_action,
        new_lr_rate_ml_h,
        clinical_directive
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id;
    `;

    const values = [
      result.encounterId || null,
      result.patientId,
      result.hourPostBurn,
      result.currentLrRateMlH,
      result.urineOutputMl,
      result.urineOutputMlKgH,
      result.bladderPressureMmhg || null,
      result.cumulativeFluidMl,
      result.fluidCreepFlag,
      result.titrationAction,
      result.newLrRateMlH,
      result.clinicalDirective
    ];

    const res = await pool.query(query, values);
    return res.rows[0].id;
  }

  /**
   * Retrieves burn encounters for a patient.
   */
  public static async getBurnEncounters(patientId: number): Promise<any[]> {
    const query = `
      SELECT * FROM burn_resuscitation_encounters
      WHERE patient_id = $1
      ORDER BY evaluated_at DESC;
    `;
    const res = await pool.query(query, [patientId]);
    return res.rows;
  }

  /**
   * Retrieves titration logs for a patient.
   */
  public static async getTitrationLogs(patientId: number): Promise<any[]> {
    const query = `
      SELECT * FROM hourly_parkland_titration_logs
      WHERE patient_id = $1
      ORDER BY logged_at DESC;
    `;
    const res = await pool.query(query, [patientId]);
    return res.rows;
  }
}
