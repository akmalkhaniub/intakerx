import { query } from '../db';

export interface ApgarComponents {
  heartRate: 0 | 1 | 2; // 0=absent, 1=<100, 2=>=100
  respiratoryEffort: 0 | 1 | 2; // 0=absent, 1=slow/irregular, 2=good/crying
  muscleTone: 0 | 1 | 2; // 0=flaccid, 1=some flexion, 2=active motion
  reflexIrritability: 0 | 1 | 2; // 0=none, 1=grimace, 2=vigorous cry/cough
  color: 0 | 1 | 2; // 0=blue/pale, 1=acrocyanosis, 2=pink all over
}

export interface NrpAssessmentInput {
  gestationalAgeWeeks: number;
  postnatalAgeMinutes: number;
  heartRateBpm: number;
  isBreathingOrCrying: boolean;
  preductalSpo2Percent: number;
  muscleToneAdequate: boolean;
  meconiumAspirated?: boolean;
}

export interface BroselowParams {
  patientAgeMonths: number;
  patientWeightKg: number;
}

export interface BhutaniParams {
  postnatalAgeHours: number;
  totalSerumBilirubinMgDl: number;
  gestationalAgeWeeks: number;
  hasHemolysisOrG6pd?: boolean;
}

export interface Pelod2Params {
  pupillaryReaction: 'both_reactive' | 'one_reactive' | 'both_fixed';
  lactateMmolL: number;
  creatinineUmolL: number;
  pao2Fio2Ratio: number;
  plateletsK: number;
  invasiveVentilation: boolean;
}

export class PediatricResuscitationService {
  /**
   * Calculates the APGAR score (0-10) and clinical interpretation.
   */
  static calculateApgar(components: ApgarComponents): {
    totalScore: number;
    clinicalCategory: 'Reassuring_Normal' | 'Moderately_Abnormal' | 'Severely_Depressed_Critical';
    immediateActions: string[];
  } {
    const totalScore =
      components.heartRate +
      components.respiratoryEffort +
      components.muscleTone +
      components.reflexIrritability +
      components.color;

    const immediateActions: string[] = [];
    let clinicalCategory: 'Reassuring_Normal' | 'Moderately_Abnormal' | 'Severely_Depressed_Critical' = 'Reassuring_Normal';

    if (totalScore >= 7) {
      clinicalCategory = 'Reassuring_Normal';
      immediateActions.push('Dry infant, maintain warmth (36.5 - 37.5°C), skin-to-skin contact, routine suction if needed.');
    } else if (totalScore >= 4) {
      clinicalCategory = 'Moderately_Abnormal';
      immediateActions.push('Tactile stimulation, clear airway, evaluate heart rate and respirations closely.');
      immediateActions.push('Prepare for positive pressure ventilation (PPV) if HR < 100 or apnea persists.');
    } else {
      clinicalCategory = 'Severely_Depressed_Critical';
      immediateActions.push('EMERGENCY: Immediate Positive Pressure Ventilation (PPV) with T-piece resuscitator or self-inflating bag.');
      immediateActions.push('Apply 3-lead ECG monitor and pulse oximeter on right wrist (preductal).');
      immediateActions.push('Prepare umbilical venous catheter (UVC) and emergency epinephrine 1:10,000.');
    }

    return {
      totalScore,
      clinicalCategory,
      immediateActions
    };
  }

  /**
   * Evaluates the Neonatal Resuscitation Program (NRP 8th Edition) algorithm and preductal SpO2 targets.
   */
  static evaluateNrpAlgorithm(input: NrpAssessmentInput): {
    targetPreductalSpo2Range: string;
    isSpo2TargetMet: boolean;
    requiredInterventions: string[];
    epinephrineUvcDoseMg?: number;
    epinephrineUvcDoseMl?: number;
    recommendedFiO2: number;
    clinicalDirective: string;
  } {
    // 8th Edition Preductal SpO2 Targets (min -> [low, high])
    let minSpo2 = 60;
    let maxSpo2 = 65;

    if (input.postnatalAgeMinutes <= 1) {
      minSpo2 = 60; maxSpo2 = 65;
    } else if (input.postnatalAgeMinutes === 2) {
      minSpo2 = 65; maxSpo2 = 70;
    } else if (input.postnatalAgeMinutes === 3) {
      minSpo2 = 70; maxSpo2 = 75;
    } else if (input.postnatalAgeMinutes === 4) {
      minSpo2 = 75; maxSpo2 = 80;
    } else if (input.postnatalAgeMinutes <= 9) {
      minSpo2 = 80; maxSpo2 = 85;
    } else {
      minSpo2 = 85; maxSpo2 = 95;
    }

    const isSpo2TargetMet = input.preductalSpo2Percent >= minSpo2 && input.preductalSpo2Percent <= maxSpo2 + 5;
    const requiredInterventions: string[] = [];

    // FiO2 titration: Term babies start at 21%, Preterm (<35w) at 21-30%
    let recommendedFiO2 = input.gestationalAgeWeeks < 35 ? 30 : 21;

    let clinicalDirective = 'Maintain thermal neutrality and monitor transitions.';

    // Heart rate logic
    if (input.heartRateBpm < 60) {
      recommendedFiO2 = 100;
      requiredInterventions.push('CHEST COMPRESSIONS: 3:1 compression-to-ventilation ratio (90 compressions + 30 breaths/min).');
      requiredInterventions.push('Increase supplemental oxygen to 100% FiO2.');
      requiredInterventions.push('Perform endotracheal intubation or laryngeal mask placement.');
      requiredInterventions.push('Establish Umbilical Venous Catheter (UVC) emergency vascular access.');

      // Est weight ~ 3.0 kg if term, 1.5 if preterm
      const estWeightKg = input.gestationalAgeWeeks >= 37 ? 3.2 : input.gestationalAgeWeeks >= 32 ? 2.0 : 1.2;
      const epiMg = Math.round(0.02 * estWeightKg * 1000) / 1000; // 0.02 mg/kg
      const epiMl = Math.round((epiMg / 0.1) * 100) / 100; // 0.1 mg/mL concentration -> 0.2 mL/kg

      clinicalDirective = `CRITICAL BRADYCARDIA (HR < 60). Coordinate 3:1 compressions with 100% FiO2 PPV. Administer Epinephrine IV/UVC ${epiMg} mg (${epiMl} mL of 1:10,000) flushed with 3 mL NS.`;

      return {
        targetPreductalSpo2Range: `${minSpo2}% - ${maxSpo2}%`,
        isSpo2TargetMet,
        requiredInterventions,
        epinephrineUvcDoseMg: epiMg,
        epinephrineUvcDoseMl: epiMl,
        recommendedFiO2,
        clinicalDirective
      };
    } else if (input.heartRateBpm < 100 || !input.isBreathingOrCrying) {
      requiredInterventions.push('POSITIVE PRESSURE VENTILATION (PPV): 40 - 60 breaths/min at 20-25 cmH2O PIP.');
      requiredInterventions.push('Perform MR. SOPA corrective ventilation steps if chest rise is inadequate.');
      clinicalDirective = `HEART RATE < 100 or APNEA: Initiate immediate PPV. Titrate oxygen to meet ${minSpo2}-${maxSpo2}% target.`;
    } else if (!isSpo2TargetMet && input.preductalSpo2Percent < minSpo2) {
      recommendedFiO2 = Math.min(100, recommendedFiO2 + 10);
      requiredInterventions.push(`Titrate FiO2 to ${recommendedFiO2}% to reach target preductal SpO2.`);
      clinicalDirective = `Sub-target preductal oxygenation (${input.preductalSpo2Percent}% < ${minSpo2}%). Increase FiO2.`;
    }

    return {
      targetPreductalSpo2Range: `${minSpo2}% - ${maxSpo2}%`,
      isSpo2TargetMet,
      requiredInterventions,
      recommendedFiO2,
      clinicalDirective
    };
  }

  /**
   * Broselow Pediatric Emergency Tape Sizing & PALS Resuscitation Calculator.
   */
  static calculateBroselowPals(params: BroselowParams): {
    broselowColor: string;
    weightTierDescription: string;
    ettSizeUncuffedMm: number;
    ettSizeCuffedMm: number;
    ettDepthLipCm: number;
    defibrillationJoules: number; // 2 J/kg
    cardioversionJoules: number; // 0.5 - 1.0 J/kg
    epinephrineDoseMg: number; // 0.01 mg/kg
    epinephrineVolumeMl: number; // 0.1 mg/mL
    amiodaroneDoseMg: number; // 5 mg/kg
    normalSalineBolusMl: number; // 20 mL/kg
    dextrose10BolusMl: number; // 5 mL/kg
  } {
    const wt = params.patientWeightKg;
    const ageYrs = params.patientAgeMonths / 12.0;

    let color = 'Grey';
    let desc = 'Infant (< 5 kg)';

    if (wt <= 5) {
      color = 'Grey'; desc = 'Infant (3 - 5 kg)';
    } else if (wt <= 7) {
      color = 'Pink'; desc = 'Small Toddler (6 - 7 kg)';
    } else if (wt <= 9) {
      color = 'Red'; desc = 'Toddler (8 - 9 kg)';
    } else if (wt <= 11) {
      color = 'Purple'; desc = 'Older Toddler (10 - 11 kg)';
    } else if (wt <= 14) {
      color = 'Yellow'; desc = 'Young Child (12 - 14 kg)';
    } else if (wt <= 18) {
      color = 'White'; desc = 'Child (15 - 18 kg)';
    } else if (wt <= 23) {
      color = 'Blue'; desc = 'Child (19 - 23 kg)';
    } else if (wt <= 29) {
      color = 'Orange'; desc = 'Older Child (24 - 29 kg)';
    } else {
      color = 'Green'; desc = 'Adolescent (30 - 36 kg)';
    }

    // ETT Sizing formula
    let ettUncuffed = 3.5;
    let ettCuffed = 3.0;

    if (ageYrs < 1) {
      if (wt < 1.0) { ettUncuffed = 2.5; ettCuffed = 2.0; }
      else if (wt < 2.5) { ettUncuffed = 3.0; ettCuffed = 2.5; }
      else { ettUncuffed = 3.5; ettCuffed = 3.0; }
    } else {
      ettUncuffed = Math.round((ageYrs / 4.0 + 4.0) * 2) / 2;
      ettCuffed = Math.round((ageYrs / 4.0 + 3.5) * 2) / 2;
    }

    const ettDepth = Math.round(ettCuffed * 3.0 * 10) / 10;
    const defibrillationJoules = Math.min(200, Math.round(wt * 2));
    const cardioversionJoules = Math.max(1, Math.round(wt * 1.0));
    const epinephrineDoseMg = Math.round(0.01 * wt * 1000) / 1000;
    const epinephrineVolumeMl = Math.round((epinephrineDoseMg / 0.1) * 100) / 100;
    const amiodaroneDoseMg = Math.min(300, Math.round(5.0 * wt));
    const normalSalineBolusMl = Math.min(1000, Math.round(20.0 * wt));
    const dextrose10BolusMl = Math.round(5.0 * wt);

    return {
      broselowColor: color,
      weightTierDescription: desc,
      ettSizeUncuffedMm: ettUncuffed,
      ettSizeCuffedMm: ettCuffed,
      ettDepthLipCm: ettDepth,
      defibrillationJoules,
      cardioversionJoules,
      epinephrineDoseMg,
      epinephrineVolumeMl,
      amiodaroneDoseMg,
      normalSalineBolusMl,
      dextrose10BolusMl
    };
  }

  /**
   * Bhutani Nomogram for Neonatal Hyperbilirubinemia & Phototherapy Risk.
   */
  static evaluateBhutaniNomogram(params: BhutaniParams): {
    riskZone: 'Low_Risk' | 'Low_Intermediate' | 'High_Intermediate' | 'High_Critical_Risk';
    percentileEst: string;
    phototherapyIndicated: boolean;
    exchangeTransfusionIndicated: boolean;
    recommendation: string;
  } {
    const ageH = Math.max(12, Math.min(120, params.postnatalAgeHours));
    const tsb = params.totalSerumBilirubinMgDl;

    // Approximate Bhutani threshold cutoffs at 48h and 72h
    // 48h: 40th=8.5, 75th=11.0, 95th=13.0
    // 72h: 40th=11.0, 75th=13.5, 95th=15.5
    const slope = (15.5 - 13.0) / 24.0;
    const p95 = 13.0 + (ageH - 48) * slope;
    const p75 = 11.0 + (ageH - 48) * slope;
    const p40 = 8.5 + (ageH - 48) * slope;

    let riskZone: 'Low_Risk' | 'Low_Intermediate' | 'High_Intermediate' | 'High_Critical_Risk' = 'Low_Risk';
    let percentileEst = '<40th percentile';
    let phototherapyIndicated = false;
    let exchangeTransfusionIndicated = false;

    if (tsb >= p95) {
      riskZone = 'High_Critical_Risk';
      percentileEst = '>95th percentile';
      phototherapyIndicated = true;
    } else if (tsb >= p75) {
      riskZone = 'High_Intermediate';
      percentileEst = '75th - 95th percentile';
      phototherapyIndicated = params.gestationalAgeWeeks < 38 || Boolean(params.hasHemolysisOrG6pd);
    } else if (tsb >= p40) {
      riskZone = 'Low_Intermediate';
      percentileEst = '40th - 75th percentile';
    } else {
      riskZone = 'Low_Risk';
      percentileEst = '<40th percentile';
    }

    if (tsb >= 20.0 || (params.hasHemolysisOrG6pd && tsb >= 18.0)) {
      exchangeTransfusionIndicated = true;
    }

    let recommendation = `TSB ${tsb} mg/dL is in the ${riskZone} zone at ${ageH} hours of life.`;
    if (exchangeTransfusionIndicated) {
      recommendation += ' CRITICAL: Threshold for double-volume Exchange Transfusion met! Admit to NICU immediately.';
    } else if (phototherapyIndicated) {
      recommendation += ' Intensive double-bank LED phototherapy indicated. Repeat TSB in 4-6 hours.';
    } else {
      recommendation += ' Routine follow-up bilirubin check in 24-48 hours.';
    }

    return {
      riskZone,
      percentileEst,
      phototherapyIndicated,
      exchangeTransfusionIndicated,
      recommendation
    };
  }

  /**
   * PELOD-2 (Pediatric Logistic Organ Dysfunction-2) Severity Calculator.
   */
  static calculatePelod2(params: Pelod2Params): {
    pelod2Score: number;
    predictedInHospitalMortalityPercent: number;
    organFailuresIdentified: string[];
  } {
    let score = 0;
    const organFailures: string[] = [];

    // Neurologic (Pupils)
    if (params.pupillaryReaction === 'both_fixed') {
      score += 5;
      organFailures.push('Neurologic: Bilateral fixed pupils');
    } else if (params.pupillaryReaction === 'one_reactive') {
      score += 2;
      organFailures.push('Neurologic: Unilateral fixed pupil');
    }

    // Cardiovascular (Lactate)
    if (params.lactateMmolL >= 11.0) {
      score += 4;
      organFailures.push('Cardiovascular: Severe lactic acidosis (>=11 mmol/L)');
    } else if (params.lactateMmolL >= 5.0) {
      score += 1;
      organFailures.push('Cardiovascular: Elevated lactate (>=5 mmol/L)');
    }

    // Renal (Creatinine)
    if (params.creatinineUmolL >= 93) {
      score += 2;
      organFailures.push('Renal: Severe acute kidney injury');
    }

    // Respiratory (PaO2/FiO2 with invasive ventilation)
    if (params.invasiveVentilation) {
      if (params.pao2Fio2Ratio <= 150) {
        score += 3;
        organFailures.push('Respiratory: Severe ARDS (P/F <= 150)');
      } else if (params.pao2Fio2Ratio <= 300) {
        score += 1;
        organFailures.push('Respiratory: Moderate ARDS (P/F <= 300)');
      }
    }

    // Hematologic (Platelets)
    if (params.plateletsK < 35) {
      score += 2;
      organFailures.push('Hematologic: Severe thrombocytopenia (<35k)');
    }

    // Logit mortality conversion
    // PELOD-2 mortality equation approximation: logit = -4.3 + 0.3 * score
    const logit = -4.3 + 0.35 * score;
    const predictedMortality = Math.round((1 / (1 + Math.exp(-logit))) * 1000) / 10;

    return {
      pelod2Score: score,
      predictedInHospitalMortalityPercent: Math.min(99.0, Math.max(1.0, predictedMortality)),
      organFailuresIdentified: organFailures
    };
  }

  /**
   * Database: Records a neonatal resuscitation event.
   */
  static async createNeonatalEvent(patientId: number, data: {
    birthTimestamp: Date | string;
    gestationalAgeWeeks: number;
    birthWeightGrams: number;
    apgar1min: number;
    apgar5min: number;
    apgar10min?: number;
    apgarDetails: any;
    ppvRequired?: boolean;
    intubationRequired?: boolean;
    chestCompressionsRequired?: boolean;
    epinephrineAdministered?: boolean;
    uvcPlaced?: boolean;
    targetPreductalSpo2Met?: boolean;
    serumBilirubinMgDl?: number;
    postnatalAgeHours?: number;
    phototherapyIndicated?: boolean;
    exchangeTransfusionIndicated?: boolean;
  }) {
    const res = await query(
      `INSERT INTO neonatal_resuscitation_events (
        patient_id, birth_timestamp, gestational_age_weeks, birth_weight_grams,
        apgar_1min, apgar_5min, apgar_10min, apgar_details,
        ppv_required, intubation_required, chest_compressions_required,
        epinephrine_administered, uvc_placed, target_preductal_spo2_met,
        serum_bilirubin_mg_dl, postnatal_age_hours,
        phototherapy_indicated, exchange_transfusion_indicated,
        resuscitation_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'active_code')
      RETURNING *`,
      [
        patientId,
        data.birthTimestamp,
        data.gestationalAgeWeeks,
        data.birthWeightGrams,
        data.apgar1min,
        data.apgar5min,
        data.apgar10min || null,
        JSON.stringify(data.apgarDetails),
        data.ppvRequired ?? false,
        data.intubationRequired ?? false,
        data.chestCompressionsRequired ?? false,
        data.epinephrineAdministered ?? false,
        data.uvcPlaced ?? false,
        data.targetPreductalSpo2Met ?? true,
        data.serumBilirubinMgDl || null,
        data.postnatalAgeHours || null,
        data.phototherapyIndicated ?? false,
        data.exchangeTransfusionIndicated ?? false
      ]
    );

    return res.rows[0];
  }

  /**
   * Database: Records a pediatric emergency resuscitation code case.
   */
  static async createPediatricCode(patientId: number, data: {
    patientAgeMonths: number;
    patientWeightKg: number;
    clinicalNotes?: string;
  }) {
    const broselow = this.calculateBroselowPals({
      patientAgeMonths: data.patientAgeMonths,
      patientWeightKg: data.patientWeightKg
    });

    const res = await query(
      `INSERT INTO pediatric_code_cases (
        patient_id, patient_age_months, patient_weight_kg,
        broselow_color, ett_size_uncuffed_mm, ett_size_cuffed_mm,
        ett_insertion_depth_cm, defibrillation_joules, cardioversion_joules,
        epinephrine_dose_mg, amiodarone_dose_mg, normal_saline_bolus_ml,
        clinical_notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        patientId,
        data.patientAgeMonths,
        data.patientWeightKg,
        broselow.broselowColor,
        broselow.ettSizeUncuffedMm,
        broselow.ettSizeCuffedMm,
        broselow.ettDepthLipCm,
        broselow.defibrillationJoules,
        broselow.cardioversionJoules,
        broselow.epinephrineDoseMg,
        broselow.amiodaroneDoseMg,
        broselow.normalSalineBolusMl,
        data.clinicalNotes || null
      ]
    );

    return {
      codeCase: res.rows[0],
      broselow
    };
  }

  /**
   * Lists neonatal resuscitation events.
   */
  static async getNeonatalEvents(patientId?: number) {
    let sql = 'SELECT * FROM neonatal_resuscitation_events';
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
   * Lists pediatric code cases.
   */
  static async getPediatricCodes(patientId?: number) {
    let sql = 'SELECT * FROM pediatric_code_cases';
    const params: any[] = [];
    if (patientId) {
      sql += ' WHERE patient_id = $1';
      params.push(patientId);
    }
    sql += ' ORDER BY created_at DESC';
    const res = await query(sql, params);
    return res.rows;
  }
}
