import { query } from '../db';

export interface AnatomicalBurnMap {
  headNeckPercent: number; // Max 9 adult, 18 infant
  anteriorTorsoPercent: number; // Max 18
  posteriorTorsoPercent: number; // Max 18
  rightArmPercent: number; // Max 9
  leftArmPercent: number; // Max 9
  rightLegPercent: number; // Max 18 adult, 14 infant
  leftLegPercent: number; // Max 18 adult, 14 infant
  perineumPercent: number; // Max 1
  partialThicknessPercent: number;
  fullThicknessPercent: number;
}

export interface ParklandParams {
  patientWeightKg: number;
  tbsaPercentage: number;
  injuryTimestamp: Date | string;
  edArrivalTimestamp?: Date | string;
  formulaType?: 'Parkland' | 'Modified_Brooke';
  isElectrical?: boolean;
}

export interface InhalationParams {
  coHemoglobinPercent: number;
  fio2DeliveredPercent: number; // 21, 100, or 300 (for HBOT)
  serumLactateMmolL: number;
  facialBurns: boolean;
  carbonaceousSputum: boolean;
  stridorOrHoarseness: boolean;
  bronchoscopyGrade?: 0 | 1 | 2 | 3 | 4; // 0=none, 4=massive necrosis
}

export interface HourlyTitrationInput {
  postBurnHour: number;
  urineOutputMl: number;
  currentInfusionRateMlHr: number;
  patientWeightKg: number;
  isPediatric?: boolean;
  isElectrical?: boolean;
  meanArterialPressureMmhg?: number;
  bladderPressureMmhg?: number;
  cumulativeFluidInfusedMl: number;
  clinicalNotes?: string;
}

export class BurnTraumaService {
  /**
   * Calculates Total Body Surface Area (%TBSA) using Rule of Nines / Lund-Browder principles.
   */
  static calculateTbsa(map: AnatomicalBurnMap, isPediatric = false): {
    totalTbsaPercentage: number;
    partialThicknessPercentage: number;
    fullThicknessPercentage: number;
    burnSeverityCategory: 'Minor' | 'Moderate' | 'Major_Severe';
    abaBurnCenterReferralCriteriaMet: boolean;
    referralRationale: string[];
  } {
    const anatomicalSum =
      map.headNeckPercent +
      map.anteriorTorsoPercent +
      map.posteriorTorsoPercent +
      map.rightArmPercent +
      map.leftArmPercent +
      map.rightLegPercent +
      map.leftLegPercent +
      map.perineumPercent;

    const totalTbsaPercentage = Math.min(100, Math.round(anatomicalSum * 10) / 10);
    const partialThicknessPercentage = Math.min(totalTbsaPercentage, map.partialThicknessPercent);
    const fullThicknessPercentage = Math.min(totalTbsaPercentage, map.fullThicknessPercent);

    const referralRationale: string[] = [];
    let burnSeverityCategory: 'Minor' | 'Moderate' | 'Major_Severe' = 'Minor';

    if (totalTbsaPercentage >= 20 || (isPediatric && totalTbsaPercentage >= 10)) {
      burnSeverityCategory = 'Major_Severe';
      referralRationale.push(`%TBSA (${totalTbsaPercentage}%) exceeds critical threshold (>=20% adult, >=10% pediatric).`);
    } else if (totalTbsaPercentage >= 10) {
      burnSeverityCategory = 'Moderate';
    }

    if (fullThicknessPercentage >= 5) {
      burnSeverityCategory = 'Major_Severe';
      referralRationale.push(`Full-thickness burns (${fullThicknessPercentage}%) exceed 5% TBSA.`);
    }

    // Special anatomical sites
    if (map.headNeckPercent > 0 || map.perineumPercent > 0) {
      referralRationale.push('Involvement of critical anatomical zones (face, hands, feet, or genitalia/perineum).');
    }

    const abaBurnCenterReferralCriteriaMet = referralRationale.length > 0;

    return {
      totalTbsaPercentage,
      partialThicknessPercentage,
      fullThicknessPercentage,
      burnSeverityCategory,
      abaBurnCenterReferralCriteriaMet,
      referralRationale
    };
  }

  /**
   * Consensus Parkland & Modified Brooke Resuscitation Fluid Calculator.
   * Total 24h Fluid = Factor * Weight (kg) * %TBSA.
   * 50% given in the first 8 hours post-injury; 50% given over the next 16 hours.
   */
  static calculateFluidResuscitation(params: ParklandParams): {
    formulaUsed: string;
    factorMlPerKgPerTbsa: number;
    total24hVolumeMl: number;
    first8hTotalMl: number;
    next16hTotalMl: number;
    elapsedHoursSinceBurn: number;
    remainingHoursFirst8h: number;
    first8hRateMlHr: number;
    next16hRateMlHr: number;
    fluidCreepThresholdMl: number; // 250 mL/kg
    guidelines: string[];
  } {
    const isBrooke = params.formulaType === 'Modified_Brooke';
    let factor = isBrooke ? 2.0 : 4.0;
    if (params.isElectrical) {
      factor = 4.0; // High fluid requirements for myoglobinuric acute tubular necrosis
    }

    const total24hVolumeMl = Math.round(factor * params.patientWeightKg * params.tbsaPercentage);
    const first8hTotalMl = Math.round(total24hVolumeMl * 0.5);
    const next16hTotalMl = Math.round(total24hVolumeMl * 0.5);

    const injuryTime = new Date(params.injuryTimestamp).getTime();
    const edTime = params.edArrivalTimestamp ? new Date(params.edArrivalTimestamp).getTime() : Date.now();
    const elapsedHoursSinceBurn = Math.max(0, Math.min(8, (edTime - injuryTime) / (1000 * 60 * 60)));
    const remainingHoursFirst8h = Math.max(0.5, 8.0 - elapsedHoursSinceBurn);

    const first8hRateMlHr = Math.round(first8hTotalMl / remainingHoursFirst8h);
    const next16hRateMlHr = Math.round(next16hTotalMl / 16.0);
    const fluidCreepThresholdMl = Math.round(250 * params.patientWeightKg);

    const guidelines: string[] = [
      `Primary Crystalloid: Balanced salt solution (Lactated Ringer's). Avoid Normal Saline (0.9% NaCl) to prevent hyperchloremic metabolic acidosis.`,
      `Resuscitation clock begins AT TIME OF INJURY (${elapsedHoursSinceBurn.toFixed(1)}h elapsed). First 50% must complete by post-burn hour 8.`,
      `Target Urine Output: ${params.isElectrical ? '1.5 - 2.0 mL/kg/hr (75-100 mL/hr)' : '0.5 - 1.0 mL/kg/hr (30-50 mL/hr)'}. Titrate infusion hourly based strictly on UOP, NOT fixed formula.`,
      `Fluid Creep Ceiling: ${fluidCreepThresholdMl} mL (250 mL/kg). Cumulative volumes above this markedly increase Intra-Abdominal Hypertension (IAH) & Compartment Syndrome.`
    ];

    return {
      formulaUsed: isBrooke ? 'Modified Brooke (2 mL/kg/%TBSA)' : 'Consensus Parkland (4 mL/kg/%TBSA)',
      factorMlPerKgPerTbsa: factor,
      total24hVolumeMl,
      first8hTotalMl,
      next16hTotalMl,
      elapsedHoursSinceBurn: Math.round(elapsedHoursSinceBurn * 10) / 10,
      remainingHoursFirst8h: Math.round(remainingHoursFirst8h * 10) / 10,
      first8hRateMlHr,
      next16hRateMlHr,
      fluidCreepThresholdMl,
      guidelines
    };
  }

  /**
   * Evaluates Carboxyhemoglobin Kinetics & Smoke Inhalation Injury Severity.
   */
  static evaluateInhalationAndCyanide(params: InhalationParams): {
    estimatedCoHbHalfLifeHours: number;
    hoursToTargetCoHb: number; // Target < 3.0%
    cyanideToxicityRisk: 'Low' | 'Moderate' | 'High_Critical';
    hydroxocobalaminIndicated: boolean;
    airwayCompromiseRisk: 'Low' | 'Moderate_Impending' | 'Critical_Immediate_Intubation';
    alerts: string[];
    actionItems: string[];
  } {
    const alerts: string[] = [];
    const actionItems: string[] = [];

    // Half life calculation:
    // Room air (FiO2 21%): ~300 mins (5.0 hrs)
    // 100% FiO2 (High flow NRB): ~75 mins (1.25 hrs)
    // HBOT (3.0 ATA): ~25 mins (0.42 hrs)
    let halfLifeHours = 5.0;
    if (params.fio2DeliveredPercent >= 250) {
      halfLifeHours = 0.42; // HBOT
    } else if (params.fio2DeliveredPercent >= 90) {
      halfLifeHours = 1.25; // 100% FiO2
    } else {
      halfLifeHours = 5.0; // Room air
    }

    // Time to target COHb < 3%
    const currentCo = Math.max(1.0, params.coHemoglobinPercent);
    const halfLivesNeeded = Math.max(0, Math.log2(currentCo / 3.0));
    const hoursToTargetCoHb = Math.round(halfLivesNeeded * halfLifeHours * 10) / 10;

    if (params.coHemoglobinPercent >= 25) {
      alerts.push(`CRITICAL COHb: ${params.coHemoglobinPercent}% signifies severe Carbon Monoxide Poisoning. Evaluate for Hyperbaric Oxygen Therapy (HBOT).`);
    } else if (params.coHemoglobinPercent >= 10) {
      alerts.push(`ELEVATED COHb: ${params.coHemoglobinPercent}%. Administer 100% FiO2 via tight-fitting non-rebreather or endotracheal tube.`);
    }

    // Cyanide Toxicity Risk
    // Smoke inhalation from closed space + severe metabolic acidosis / lactate >= 8 mmol/L
    let cyanideToxicityRisk: 'Low' | 'Moderate' | 'High_Critical' = 'Low';
    let hydroxocobalaminIndicated = false;

    if (params.serumLactateMmolL >= 8.0 && (params.carbonaceousSputum || params.facialBurns)) {
      cyanideToxicityRisk = 'High_Critical';
      hydroxocobalaminIndicated = true;
      alerts.push(`CYANIDE TOXICITY WARNING: Smoke inhalation with profound hyperlactatemia (${params.serumLactateMmolL} mmol/L >= 8.0).`);
      actionItems.push('Administer Hydroxocobalamin (Cyanokit) 5.0g IV infusion over 15 minutes immediately.');
    } else if (params.serumLactateMmolL >= 4.0) {
      cyanideToxicityRisk = 'Moderate';
      actionItems.push('Monitor serial arterial blood gas & lactate every 2 hours.');
    }

    // Airway compromise
    let airwayCompromiseRisk: 'Low' | 'Moderate_Impending' | 'Critical_Immediate_Intubation' = 'Low';
    if (params.stridorOrHoarseness || (params.bronchoscopyGrade && params.bronchoscopyGrade >= 3)) {
      airwayCompromiseRisk = 'Critical_Immediate_Intubation';
      alerts.push('CRITICAL AIRWAY: Stridor/hoarseness or severe mucosal sloughing indicates impending catastrophic supraglottic occlusion.');
      actionItems.push('Perform emergent endotracheal intubation before progressive edema prevents laryngoscopy.');
    } else if (params.facialBurns && params.carbonaceousSputum) {
      airwayCompromiseRisk = 'Moderate_Impending';
      actionItems.push('Continuous capnography, serial vocal cord visualization, maintain head of bed elevated 30-45 degrees.');
    }

    return {
      estimatedCoHbHalfLifeHours: halfLifeHours,
      hoursToTargetCoHb,
      cyanideToxicityRisk,
      hydroxocobalaminIndicated,
      airwayCompromiseRisk,
      alerts,
      actionItems
    };
  }

  /**
   * Closed-Loop Hourly Resuscitation Titration Watchdog.
   * Adjusts fluid rate by 20-30% based on hourly urine output (UOP).
   */
  static evaluateHourlyTitration(input: HourlyTitrationInput): {
    uopMlKgHr: number;
    targetUopRange: string;
    isUopAdequate: boolean;
    rateAdjustmentRecommendation: 'maintain' | 'increase_20_percent' | 'decrease_20_percent' | 'urgent_bolus';
    newRecommendedRateMlHr: number;
    fluidCreepAlert: boolean;
    intraAbdominalHypertensionAlert: boolean;
    clinicalAdvisory: string;
  } {
    const uopMlKgHr = Math.round((input.urineOutputMl / input.patientWeightKg) * 100) / 100;
    let targetMin = 0.5;
    let targetMax = 1.0;

    if (input.isPediatric) {
      targetMin = 1.0;
      targetMax = 1.5;
    } else if (input.isElectrical) {
      targetMin = 1.5;
      targetMax = 2.0;
    }

    const isUopAdequate = uopMlKgHr >= targetMin && uopMlKgHr <= targetMax;
    let rateAdjustmentRecommendation: 'maintain' | 'increase_20_percent' | 'decrease_20_percent' | 'urgent_bolus' = 'maintain';
    let newRecommendedRateMlHr = input.currentInfusionRateMlHr;
    let clinicalAdvisory = `UOP (${uopMlKgHr} mL/kg/hr) is within target range [${targetMin}-${targetMax} mL/kg/hr]. Maintain current infusion rate.`;

    if (uopMlKgHr < targetMin) {
      if (uopMlKgHr < targetMin * 0.5) {
        rateAdjustmentRecommendation = 'urgent_bolus';
        newRecommendedRateMlHr = Math.round(input.currentInfusionRateMlHr * 1.33);
        clinicalAdvisory = `Severe oliguria (${uopMlKgHr} mL/kg/hr < ${targetMin}). Increase infusion rate by ~33% (${newRecommendedRateMlHr} mL/hr) or administer 500 mL LR crystalloid bolus.`;
      } else {
        rateAdjustmentRecommendation = 'increase_20_percent';
        newRecommendedRateMlHr = Math.round(input.currentInfusionRateMlHr * 1.20);
        clinicalAdvisory = `Sub-target UOP (${uopMlKgHr} mL/kg/hr < ${targetMin}). Increase infusion rate by 20% to ${newRecommendedRateMlHr} mL/hr.`;
      }
    } else if (uopMlKgHr > targetMax) {
      rateAdjustmentRecommendation = 'decrease_20_percent';
      newRecommendedRateMlHr = Math.max(100, Math.round(input.currentInfusionRateMlHr * 0.80));
      clinicalAdvisory = `Supra-target UOP (${uopMlKgHr} mL/kg/hr > ${targetMax}). Decrease infusion rate by 20% to ${newRecommendedRateMlHr} mL/hr to prevent fluid creep.`;
    }

    // Fluid Creep Assessment (>= 250 mL/kg)
    const cumulativeMlPerKg = input.cumulativeFluidInfusedMl / input.patientWeightKg;
    const fluidCreepAlert = cumulativeMlPerKg >= 250;

    // Intra-Abdominal Pressure (IAP) check
    let intraAbdominalHypertensionAlert = false;
    if (input.bladderPressureMmhg && input.bladderPressureMmhg >= 12.0) {
      intraAbdominalHypertensionAlert = true;
      clinicalAdvisory += ` WARNING: Bladder pressure ${input.bladderPressureMmhg} mmHg indicates Intra-Abdominal Hypertension (IAH >= 12 mmHg). Risk of ACS.`;
    }

    return {
      uopMlKgHr,
      targetUopRange: `${targetMin} - ${targetMax} mL/kg/hr`,
      isUopAdequate,
      rateAdjustmentRecommendation,
      newRecommendedRateMlHr,
      fluidCreepAlert,
      intraAbdominalHypertensionAlert,
      clinicalAdvisory
    };
  }

  /**
   * Initiates a new Burn Trauma Case in the database.
   */
  static async createBurnCase(patientId: number, data: {
    injuryTimestamp: Date | string;
    edArrivalTimestamp: Date | string;
    patientWeightKg: number;
    isPediatric?: boolean;
    tbsaPercentage: number;
    partialThicknessTbsa?: number;
    fullThicknessTbsa?: number;
    burnMechanism: string;
    inhalationInjuryPresent?: boolean;
    formulaType?: 'Parkland' | 'Modified_Brooke';
    coHemoglobinPercent?: number;
    cyanideSuspected?: boolean;
  }) {
    const resuscitation = this.calculateFluidResuscitation({
      patientWeightKg: data.patientWeightKg,
      tbsaPercentage: data.tbsaPercentage,
      injuryTimestamp: data.injuryTimestamp,
      edArrivalTimestamp: data.edArrivalTimestamp,
      formulaType: data.formulaType,
      isElectrical: data.burnMechanism.toLowerCase().includes('electrical')
    });

    const res = await query(
      `INSERT INTO burn_trauma_cases (
        patient_id, injury_timestamp, ed_arrival_timestamp, patient_weight_kg,
        is_pediatric, tbsa_percentage, partial_thickness_tbsa, full_thickness_tbsa,
        burn_mechanism, inhalation_injury_present, formula_type,
        calculated_24h_volume_ml, first_8h_rate_ml_hr, next_16h_rate_ml_hr,
        current_infusion_rate_ml_hr, cumulative_fluid_infused_ml, fluid_creep_warning,
        co_hemoglobin_percent, cyanide_suspected, case_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 'active_resuscitation')
      RETURNING *`,
      [
        patientId,
        data.injuryTimestamp,
        data.edArrivalTimestamp,
        data.patientWeightKg,
        data.isPediatric ?? false,
        data.tbsaPercentage,
        data.partialThicknessTbsa ?? 0,
        data.fullThicknessTbsa ?? 0,
        data.burnMechanism,
        data.inhalationInjuryPresent ?? false,
        data.formulaType ?? 'Parkland',
        resuscitation.total24hVolumeMl,
        resuscitation.first8hRateMlHr,
        resuscitation.next16hRateMlHr,
        resuscitation.first8hRateMlHr, // Start at first 8h rate
        0, // Cumulative infused starts at 0
        false,
        data.coHemoglobinPercent || null,
        data.cyanideSuspected ?? false
      ]
    );

    return {
      burnCase: res.rows[0],
      resuscitationPlan: resuscitation
    };
  }

  /**
   * Records an hourly titration log and updates cumulative volume in burn_trauma_cases.
   */
  static async recordHourlyTitration(caseId: number, data: {
    postBurnHour: number;
    urineOutputMl: number;
    meanArterialPressureMmhg?: number;
    bladderPressureMmhg?: number;
    volumeInfusedThisHourMl: number;
    clinicalNotes?: string;
  }) {
    // 1. Fetch current case
    const caseRes = await query('SELECT * FROM burn_trauma_cases WHERE id = $1', [caseId]);
    if (caseRes.rows.length === 0) {
      throw new Error(`Burn trauma case #${caseId} not found`);
    }
    const burnCase = caseRes.rows[0];

    const currentCumulative = Number(burnCase.cumulative_fluid_infused_ml) + data.volumeInfusedThisHourMl;
    const isPediatric = Boolean(burnCase.is_pediatric);
    const isElectrical = burnCase.burn_mechanism.toLowerCase().includes('electrical');

    // 2. Evaluate titration recommendation
    const evaluation = this.evaluateHourlyTitration({
      postBurnHour: data.postBurnHour,
      urineOutputMl: data.urineOutputMl,
      currentInfusionRateMlHr: Number(burnCase.current_infusion_rate_ml_hr),
      patientWeightKg: Number(burnCase.patient_weight_kg),
      isPediatric,
      isElectrical,
      meanArterialPressureMmhg: data.meanArterialPressureMmhg,
      bladderPressureMmhg: data.bladderPressureMmhg,
      cumulativeFluidInfusedMl: currentCumulative,
      clinicalNotes: data.clinicalNotes
    });

    // 3. Insert titration record
    const titrationRes = await query(
      `INSERT INTO burn_hourly_titrations (
        burn_case_id, post_burn_hour, urine_output_ml, uop_ml_kg_hr,
        mean_arterial_pressure_mmhg, bladder_pressure_mmhg,
        infusion_rate_prescribed_ml_hr, volume_infused_this_hour_ml,
        rate_adjustment_recommendation, clinical_notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        caseId,
        data.postBurnHour,
        data.urineOutputMl,
        evaluation.uopMlKgHr,
        data.meanArterialPressureMmhg || null,
        data.bladderPressureMmhg || null,
        evaluation.newRecommendedRateMlHr,
        data.volumeInfusedThisHourMl,
        evaluation.rateAdjustmentRecommendation,
        data.clinicalNotes || null
      ]
    );

    // 4. Update burn case with new infusion rate, cumulative fluid, and fluid creep status
    const updatedCaseRes = await query(
      `UPDATE burn_trauma_cases
       SET current_infusion_rate_ml_hr = $1,
           cumulative_fluid_infused_ml = $2,
           fluid_creep_warning = $3
       WHERE id = $4
       RETURNING *`,
      [
        evaluation.newRecommendedRateMlHr,
        currentCumulative,
        evaluation.fluidCreepAlert,
        caseId
      ]
    );

    return {
      titration: titrationRes.rows[0],
      updatedCase: updatedCaseRes.rows[0],
      evaluation
    };
  }

  /**
   * Fetches burn trauma cases.
   */
  static async getBurnCases(patientId?: number) {
    let sql = 'SELECT * FROM burn_trauma_cases';
    const params: any[] = [];
    if (patientId) {
      sql += ' WHERE patient_id = $1';
      params.push(patientId);
    }
    sql += ' ORDER BY created_at DESC';
    const res = await query(sql, params);
    return res.rows;
  }

  /**
   * Fetches hourly titrations for a case.
   */
  static async getHourlyTitrations(caseId: number) {
    const res = await query(
      `SELECT * FROM burn_hourly_titrations
       WHERE burn_case_id = $1
       ORDER BY post_burn_hour ASC`,
      [caseId]
    );
    return res.rows;
  }
}
