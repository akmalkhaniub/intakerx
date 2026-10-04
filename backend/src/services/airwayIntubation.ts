import { query } from '../db';

export interface LemonComponents {
  lookExternallyAbnormal: boolean; // facial trauma, beard, micrognathia, macroglossia
  interIncisorGapLessThan3Fingers: boolean;
  hyomentalDistanceLessThan3Fingers: boolean;
  thyrohyoidDistanceLessThan2Fingers: boolean;
  mallampatiClass: 1 | 2 | 3 | 4;
  airwayObstructionPresent: boolean; // stridor, epiglottitis, neck hematoma, foreign body
  neckMobilityLimited: boolean; // C-spine collar, arthritis, halo
}

export interface MacochaComponents {
  mallampatiClass3or4: boolean; // +5
  obstructiveSleepApnea: boolean; // +2
  cervicalSpineLimitation: boolean; // +1
  mouthOpeningLessThan3cm: boolean; // +1
  comaGcsLessThan8: boolean; // +1
  severeHypoxemiaPfRatioUnder200: boolean; // +1
  operatorNonAnesthesiologist: boolean; // +1
}

export interface RsiMedicationParams {
  patientWeightKg: number;
  hemodynamicallyUnstableOrShock: boolean;
  severeBronchospasmOrAsthma: boolean;
  elevatedIcpOrAorticDissection: boolean;
  succinylcholineContraindicated: boolean; // crush >24h, denervation >24h, burn >24h, K+ >= 5.5, malignant hyperthermia
  preferredInduction?: 'Etomidate' | 'Ketamine' | 'Propofol';
}

export class AirwayIntubationService {
  /**
   * Evaluates the LEMON Difficult Airway Assessment score (0-10).
   */
  static calculateLemonScore(components: LemonComponents): {
    score: number;
    difficultyTier: 'Low_Difficulty' | 'Intermediate_Difficulty' | 'High_Difficult_Airway';
    recommendedEquipment: string[];
    riskFactors: string[];
  } {
    let score = 0;
    const riskFactors: string[] = [];

    if (components.lookExternallyAbnormal) {
      score += 1;
      riskFactors.push('Look: External facial trauma, beard, or anatomical distortion');
    }
    if (components.interIncisorGapLessThan3Fingers) {
      score += 1;
      riskFactors.push('Evaluate: Mouth opening < 3 finger breadths');
    }
    if (components.hyomentalDistanceLessThan3Fingers) {
      score += 1;
      riskFactors.push('Evaluate: Hyoid-mental distance < 3 finger breadths');
    }
    if (components.thyrohyoidDistanceLessThan2Fingers) {
      score += 1;
      riskFactors.push('Evaluate: Thyroid-hyoid distance < 2 finger breadths');
    }

    // Mallampati Class
    if (components.mallampatiClass === 4) {
      score += 3;
      riskFactors.push('Mallampati Class IV (Only hard palate visible)');
    } else if (components.mallampatiClass === 3) {
      score += 2;
      riskFactors.push('Mallampati Class III (Soft palate and base of uvula visible)');
    } else if (components.mallampatiClass === 2) {
      score += 1;
    }

    if (components.airwayObstructionPresent) {
      score += 1;
      riskFactors.push('Obstruction: Upper airway compromise or stridor detected');
    }
    if (components.neckMobilityLimited) {
      score += 1;
      riskFactors.push('Neck: Limited cervical extension or C-spine immobilization collar');
    }

    let difficultyTier: 'Low_Difficulty' | 'Intermediate_Difficulty' | 'High_Difficult_Airway' = 'Low_Difficulty';
    const recommendedEquipment: string[] = [];

    if (score >= 4) {
      difficultyTier = 'High_Difficult_Airway';
      recommendedEquipment.push('Video Laryngoscope with Hyperangulated blade (GlideScope / C-MAC D-Blade)');
      recommendedEquipment.push('Dynamic Tracheal Tube Introducer (Frova / Bougie)');
      recommendedEquipment.push('Second-generation Supraglottic Airway (LMA ProSeal / i-gel) primed at bedside');
      recommendedEquipment.push('Scalpel-Bougie-Tube Emergency Cricothyroidotomy kit checked and open');
    } else if (score >= 2) {
      difficultyTier = 'Intermediate_Difficulty';
      recommendedEquipment.push('Standard Video Laryngoscope (Macintosh 3/4 video blade)');
      recommendedEquipment.push('Endotracheal Tube Introducer (Bougie)');
      recommendedEquipment.push('Supraglottic Airway (i-gel) immediately accessible');
    } else {
      difficultyTier = 'Low_Difficulty';
      recommendedEquipment.push('Standard Direct or Video Laryngoscope (Mac 3 or Miller 2/3)');
      recommendedEquipment.push('Stylet and suction ready');
    }

    return {
      score,
      difficultyTier,
      recommendedEquipment,
      riskFactors
    };
  }

  /**
   * Calculates the MACOCHA score (0-12) for critically ill ICU intubations.
   */
  static calculateMacochaScore(components: MacochaComponents): {
    score: number;
    riskTier: 'Low_Risk' | 'High_Risk_Difficult_Intubation';
    predictedDifficultyPercent: number;
    advisory: string;
  } {
    let score = 0;
    if (components.mallampatiClass3or4) score += 5;
    if (components.obstructiveSleepApnea) score += 2;
    if (components.cervicalSpineLimitation) score += 1;
    if (components.mouthOpeningLessThan3cm) score += 1;
    if (components.comaGcsLessThan8) score += 1;
    if (components.severeHypoxemiaPfRatioUnder200) score += 1;
    if (components.operatorNonAnesthesiologist) score += 1;

    const riskTier = score >= 3 ? 'High_Risk_Difficult_Intubation' : 'Low_Risk';
    const predictedDifficultyPercent = score >= 5 ? 75 : score >= 3 ? 40 : 10;
    const advisory =
      score >= 3
        ? `MACOCHA Score = ${score} (High Risk). 40-75% probability of severe desaturation or intubation failure. Senior intensivist / airway expert presence recommended. Utilize high-flow nasal pre-oxygenation (NIV/HFNC) during apnea.`
        : `MACOCHA Score = ${score} (Low Risk). Standard ICU pre-oxygenation and rapid sequence induction.`;

    return {
      score,
      riskTier,
      predictedDifficultyPercent,
      advisory
    };
  }

  /**
   * Calculates Weight-Based Rapid Sequence Intubation (RSI) Drug Regimen & Sugammadex Reversal.
   */
  static calculateRsiMedications(params: RsiMedicationParams): {
    selectedInductionAgent: string;
    inductionDoseMg: number;
    inductionRationale: string;
    selectedParalyticAgent: string;
    paralyticDoseMg: number;
    paralyticRationale: string;
    sugammadexImmediateRescueDoseMg: number; // 16 mg/kg
    sugammadexRoutineDoseMg: number; // 2 mg/kg
    pretreatmentFentanylDoseMcg?: number;
    warnings: string[];
  } {
    const wt = params.patientWeightKg;
    const warnings: string[] = [];

    // 1. Induction Agent Selection
    let selectedInduction = params.preferredInduction || 'Etomidate';
    let inductionDoseMg = Math.round(0.3 * wt * 10) / 10;
    let inductionRationale = 'Etomidate (0.3 mg/kg): Hemodynamically stable, rapid onset (15-30s), minimal cardiac depression.';

    if (params.hemodynamicallyUnstableOrShock) {
      if (params.severeBronchospasmOrAsthma) {
        selectedInduction = 'Ketamine';
        inductionDoseMg = Math.round(1.5 * wt * 10) / 10;
        inductionRationale = 'Ketamine (1.5 mg/kg): Sympathomimetic support in shock and potent bronchodilation for severe asthma.';
      } else {
        selectedInduction = 'Etomidate';
        inductionDoseMg = Math.round(0.2 * wt * 10) / 10; // reduced dose in severe shock
        inductionRationale = 'Etomidate (0.2 mg/kg reduced): Hemodynamically neutral, safe in trauma and cardiogenic shock.';
      }
    } else if (params.severeBronchospasmOrAsthma) {
      selectedInduction = 'Ketamine';
      inductionDoseMg = Math.round(1.5 * wt * 10) / 10;
      inductionRationale = 'Ketamine (1.5 mg/kg): Bronchodilation via catecholamine release and direct smooth muscle relaxation.';
    } else if (selectedInduction === 'Propofol') {
      inductionDoseMg = Math.round(1.5 * wt * 10) / 10;
      inductionRationale = 'Propofol (1.5 mg/kg): Rapid awakening and neuroprotective properties. CAUTION: Causes systemic vasodilation.';
      if (params.hemodynamicallyUnstableOrShock) {
        warnings.push('CRITICAL WARNING: Propofol in shock causes profound myocardial depression and hypotension. Switched to Etomidate.');
        selectedInduction = 'Etomidate';
        inductionDoseMg = Math.round(0.2 * wt * 10) / 10;
      }
    }

    // 2. Paralytic Agent Selection
    let selectedParalytic = 'Succinylcholine';
    let paralyticDoseMg = Math.round(1.5 * wt * 10) / 10; // 1.5 mg/kg
    let paralyticRationale = 'Succinylcholine (1.5 mg/kg): Depolarizing blocker, rapid onset (45s), short duration of action (6-10 min).';

    if (params.succinylcholineContraindicated) {
      selectedParalytic = 'Rocuronium';
      paralyticDoseMg = Math.round(1.2 * wt * 10) / 10; // 1.2 mg/kg RSI dose
      paralyticRationale = 'Rocuronium (1.2 mg/kg): Non-depolarizing blocker chosen due to Succinylcholine contraindications (hyperkalemia / crush / burn / denervation). Immediate rescue reversal available via Sugammadex.';
      warnings.push('Succinylcholine contraindicated. Rocuronium 1.2 mg/kg selected.');
    }

    // 3. Sugammadex Reversal Dosing
    const sugammadexImmediateRescueDoseMg = Math.round(16.0 * wt); // 16 mg/kg for immediate rescue reversal of 1.2 mg/kg rocuronium
    const sugammadexRoutineDoseMg = Math.round(2.0 * wt); // 2 mg/kg for routine reversal of moderate block

    // 4. Pretreatment Fentanyl (for elevated ICP or aortic dissection)
    let pretreatmentFentanylDoseMcg: number | undefined;
    if (params.elevatedIcpOrAorticDissection) {
      pretreatmentFentanylDoseMcg = Math.round(2.0 * wt);
      warnings.push(`Pretreatment: Fentanyl ${pretreatmentFentanylDoseMcg} mcg IV administered 3 min prior to blunt sympathetic reflex surge.`);
    }

    return {
      selectedInductionAgent: selectedInduction,
      inductionDoseMg,
      inductionRationale,
      selectedParalyticAgent: selectedParalytic,
      paralyticDoseMg,
      paralyticRationale,
      sugammadexImmediateRescueDoseMg,
      sugammadexRoutineDoseMg,
      pretreatmentFentanylDoseMcg,
      warnings
    };
  }

  /**
   * Evaluates airway attempt outcomes and triggers CICO surgical airway alerts.
   */
  static evaluateAirwayAttempt(data: {
    attemptsCount: number;
    cormackLehaneGrade: number;
    lowestSpo2Percent: number;
    supraglotticAirwayPlaced?: boolean;
    supraglotticVentilationSuccessful?: boolean;
  }): {
    cicoEmergencyTriggered: boolean;
    urgentActionDirective: string;
    protocolStep: string;
  } {
    let cicoEmergencyTriggered = false;
    let urgentActionDirective = 'Proceed with tracheal intubation and confirm tube position with continuous capnography.';
    let protocolStep = 'Primary Intubation Plan';

    if (data.attemptsCount >= 3) {
      protocolStep = 'Failed Intubation Pathway';
      if (data.lowestSpo2Percent < 80 && (!data.supraglotticAirwayPlaced || !data.supraglotticVentilationSuccessful)) {
        cicoEmergencyTriggered = true;
        protocolStep = 'CANNOT INTUBATE, CANNOT OXYGENATE (CICO) EMERGENCY';
        urgentActionDirective = 'CRITICAL CICO EMERGENCY: Declare CICO. Call for maximum assistance. Perform emergent surgical cricothyroidotomy (scalpel-bougie-tube technique: #10 scalpel incision through cricothyroid membrane, bougie insertion, 6.0mm cuffed ETT over bougie).';
      } else {
        urgentActionDirective = 'Multiple failed attempts. Stop laryngoscopy attempts. Insert 2nd-generation Supraglottic Airway (LMA ProSeal/i-gel) to re-oxygenate.';
      }
    } else if (data.attemptsCount === 2) {
      protocolStep = 'Secondary Attempt Modifications';
      urgentActionDirective = 'Attempt 1 failed. Change operator, blade geometry (switch to hyperangulated video blade), utilize bougie, or optimize head positioning.';
    }

    return {
      cicoEmergencyTriggered,
      urgentActionDirective,
      protocolStep
    };
  }

  /**
   * Database: Records an intubation event.
   */
  static async createIntubationEvent(patientId: number, data: {
    indication: string;
    patientWeightKg: number;
    lemonScore: number;
    lemonDetails: any;
    macochaScore?: number;
    deviceUsed: string;
    bladeSize: string;
    bougieUsed?: boolean;
    ettSizeMm: number;
    ettDepthCm: number;
    cormackLehaneGrade: number;
    attemptsCount?: number;
    lowestSpo2Percent: number;
    etco2Confirmed?: boolean;
    cicoEmergencyTriggered?: boolean;
    surgicalAirwayPerformed?: boolean;
    intubationStatus?: string;
    operatorName?: string;
  }) {
    const res = await query(
      `INSERT INTO airway_intubation_events (
        patient_id, indication, patient_weight_kg, lemon_score, lemon_details,
        macocha_score, device_used, blade_size, bougie_used, ett_size_mm,
        ett_depth_cm, cormack_lehane_grade, attempts_count, lowest_spo2_percent,
        etco2_confirmed, cico_emergency_triggered, surgical_airway_performed,
        intubation_status, operator_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *`,
      [
        patientId,
        data.indication,
        data.patientWeightKg,
        data.lemonScore,
        JSON.stringify(data.lemonDetails),
        data.macochaScore || null,
        data.deviceUsed,
        data.bladeSize,
        data.bougieUsed ?? true,
        data.ettSizeMm,
        data.ettDepthCm,
        data.cormackLehaneGrade,
        data.attemptsCount ?? 1,
        data.lowestSpo2Percent,
        data.etco2Confirmed ?? true,
        data.cicoEmergencyTriggered ?? false,
        data.surgicalAirwayPerformed ?? false,
        data.intubationStatus ?? 'successful',
        data.operatorName || null
      ]
    );

    return res.rows[0];
  }

  /**
   * Database: Records RSI medication administration.
   */
  static async recordRsiMedications(eventId: number, data: {
    inductionAgent: string;
    inductionDoseMg: number;
    paralyticAgent: string;
    paralyticDoseMg: number;
    sugammadexAdministered?: boolean;
    sugammadexDoseMg?: number;
    succinylcholineContraindicationChecked?: boolean;
  }) {
    const res = await query(
      `INSERT INTO rsi_medication_administrations (
        airway_event_id, induction_agent, induction_dose_mg, paralytic_agent,
        paralytic_dose_mg, sugammadex_administered, sugammadex_dose_mg,
        succinylcholine_contraindication_checked
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        eventId,
        data.inductionAgent,
        data.inductionDoseMg,
        data.paralyticAgent,
        data.paralyticDoseMg,
        data.sugammadexAdministered ?? false,
        data.sugammadexDoseMg || null,
        data.succinylcholineContraindicationChecked ?? true
      ]
    );

    return res.rows[0];
  }

  /**
   * Lists airway intubation events.
   */
  static async getIntubationEvents(patientId?: number) {
    let sql = 'SELECT * FROM airway_intubation_events';
    const params: any[] = [];
    if (patientId) {
      sql += ' WHERE patient_id = $1';
      params.push(patientId);
    }
    sql += ' ORDER BY recorded_at DESC';
    const res = await query(sql, params);
    return res.rows;
  }
}
