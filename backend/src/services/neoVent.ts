import { pool } from '../db';

export type GestationalCategory = 'EXTREME_PRETERM' | 'VERY_PRETERM' | 'MODERATE_LATE_PRETERM' | 'TERM';
export type WeightCategory = 'ELBW' | 'VLBW' | 'LBW' | 'NORMAL_BIRTH_WEIGHT';
export type NeonatalVentMode = 'CPAP' | 'NIPPV' | 'SIMV_VG' | 'HFOV' | 'HFJV';
export type SurfactantType = 'PORACTANT_ALFA' | 'BERACTANT' | 'CALFACTANT';
export type DeliveryTechnique = 'LISA' | 'INSURE' | 'STANDARD_ETT';

export interface BloodGasInput {
  pH: number;
  pCO2: number;
  pO2: number;
  spO2: number;
  baseDeficit?: number;
}

export interface VentSettingsInput {
  mode: NeonatalVentMode;
  fio2: number; // 0.21 - 1.00 or percentage 21-100
  peepMmh2o?: number;
  pipMmh2o?: number;
  mapMmh2o?: number;
  tidalVolumeMlPerKg?: number;
  rateBpm?: number;
  inspiratoryTimeSec?: number;
  frequencyHz?: number; // for HFOV (e.g. 10 - 15 Hz)
  amplitudeDeltaP?: number; // for HFOV (e.g. 20 - 45 cmH2O)
}

export interface NeoVentEvaluationInput {
  patientId: number;
  gestationalAgeWeeks: number;
  birthWeightGrams: number;
  currentWeightGrams: number;
  postnatalAgeDays: number;
  diagnosis: 'RDS' | 'TTN' | 'MAS' | 'BPD' | 'PNEUMONIA' | 'PPHN';
  settings: VentSettingsInput;
  bloodGas: BloodGasInput;
}

export interface VentilatoryAdjustment {
  parameter: string;
  currentValue: string | number;
  recommendedChange: string;
  rationale: string;
}

export interface NeoVentEvaluationResult {
  gestationalCategory: GestationalCategory;
  weightCategory: WeightCategory;
  oxygenationIndex?: number;
  oxygenationIndexSeverity?: 'NORMAL_OR_MILD' | 'MODERATE' | 'SEVERE_INO_INDICATION' | 'CRITICAL_ECMO_THRESHOLD';
  targetSpo2Range: string;
  targetPco2Range: string;
  bloodGasInterpretation: string;
  ventAdjustments: VentilatoryAdjustment[];
  clinicalDirectives: string[];
}

export interface SurfactantCalculationInput {
  patientId: number;
  currentWeightKg: number;
  surfactantType: SurfactantType;
  doseNumber: 1 | 2 | 3;
  deliveryTechnique: DeliveryTechnique;
  preFio2: number;
  onCpap: boolean;
}

export interface SurfactantCalculationResult {
  surfactantType: SurfactantType;
  doseNumber: 1 | 2 | 3;
  doseMgPerKg: number;
  totalMg: number;
  concentrationMgPerMl: number;
  totalVolumeMl: number;
  deliveryTechnique: DeliveryTechnique;
  lisaFeasibility: {
    feasible: boolean;
    criteria: string;
  };
  postAdministrationChecklist: string[];
}

// 1. SURFACTANT REPLACEMENT THERAPY CALCULATOR
export function calculateSurfactantDose(input: SurfactantCalculationInput): SurfactantCalculationResult {
  const { currentWeightKg, surfactantType, doseNumber, deliveryTechnique, onCpap, preFio2 } = input;

  let doseMgPerKg = 0;
  let concentrationMgPerMl = 0;

  if (surfactantType === 'PORACTANT_ALFA') {
    // Curosurf: 80 mg/mL. Initial dose 200 mg/kg (2.5 mL/kg), subsequent 100 mg/kg (1.25 mL/kg)
    doseMgPerKg = doseNumber === 1 ? 200 : 100;
    concentrationMgPerMl = 80;
  } else if (surfactantType === 'BERACTANT') {
    // Survanta: 25 mg/mL. 100 mg/kg (4.0 mL/kg)
    doseMgPerKg = 100;
    concentrationMgPerMl = 25;
  } else {
    // CALFACTANT: Infasurf: 35 mg/mL. 105 mg/kg (3.0 mL/kg)
    doseMgPerKg = 105;
    concentrationMgPerMl = 35;
  }

  const totalMg = Math.round(doseMgPerKg * currentWeightKg * 10) / 10;
  const totalVolumeMl = Math.round((totalMg / concentrationMgPerMl) * 100) / 100;

  // LISA Feasibility check
  const isLisaFeasible = onCpap && deliveryTechnique === 'LISA' && preFio2 >= 0.30;
  const lisaCriteria = isLisaFeasible
    ? 'LISA is optimal: Spontaneously breathing preterm infant on CPAP requiring FiO2 >= 0.30. Avoids invasive mechanical ventilation.'
    : deliveryTechnique === 'LISA' && !onCpap
    ? 'LISA requires spontaneous respiration on nasal CPAP. If intubated or apneic, deliver via standard ETT or INSURE.'
    : 'Standard delivery via ETT / INSURE selected.';

  const checklist: string[] = [
    `Warm vial to room temperature (do not shake; gently invert).`,
    `Draw exactly ${totalVolumeMl} mL (${totalMg} mg) using a sterile syringe.`,
    deliveryTechnique === 'LISA'
      ? 'Introduce thin catheter (16-18G angiocath or dedicated surfactant catheter) through vocal cords under direct laryngoscopy while infant remains on CPAP.'
      : 'Instill via ETT catheter in 2-4 aliquots over 1-2 minutes with bag/ventilator breaths.',
    'WARNING: Rapid compliance improvement occurs within minutes! Promptly wean PIP/Vt and FiO2 to prevent pneumothorax, pulmonary hemorrhage, and hypocarbia.'
  ];

  return {
    surfactantType,
    doseNumber,
    doseMgPerKg,
    totalMg,
    concentrationMgPerMl,
    totalVolumeMl,
    deliveryTechnique,
    lisaFeasibility: {
      feasible: isLisaFeasible,
      criteria: lisaCriteria
    },
    postAdministrationChecklist: checklist
  };
}

// 2. NEONATAL VENTILATION & GAS EXCHANGE ENGINE
export function evaluateNeonatalVentilation(input: NeoVentEvaluationInput): NeoVentEvaluationResult {
  const { gestationalAgeWeeks, birthWeightGrams, settings, bloodGas } = input;

  // Normalize FiO2 to fraction 0.21 - 1.00
  const normalizedFio2 = settings.fio2 > 1.0 ? settings.fio2 / 100 : settings.fio2;

  // 1. Categorization
  let gestationalCategory: GestationalCategory = 'TERM';
  if (gestationalAgeWeeks < 28) gestationalCategory = 'EXTREME_PRETERM';
  else if (gestationalAgeWeeks < 32) gestationalCategory = 'VERY_PRETERM';
  else if (gestationalAgeWeeks < 37) gestationalCategory = 'MODERATE_LATE_PRETERM';

  let weightCategory: WeightCategory = 'NORMAL_BIRTH_WEIGHT';
  if (birthWeightGrams < 1000) weightCategory = 'ELBW';
  else if (birthWeightGrams < 1500) weightCategory = 'VLBW';
  else if (birthWeightGrams < 2500) weightCategory = 'LBW';

  // 2. Oxygenation Targets & Permissive Hypercapnia
  const isPreterm = gestationalAgeWeeks < 32 || birthWeightGrams < 1500;
  const targetSpo2Range = isPreterm ? '90% - 95% (strict limits to prevent ROP and BPD)' : '92% - 98%';
  const targetPco2Range = isPreterm ? '45 - 65 mmHg (Permissive hypercapnia, pH >= 7.22)' : '40 - 55 mmHg (pH >= 7.25)';

  // 3. Oxygenation Index (OI) Calculation
  let oxygenationIndex: number | undefined;
  let oxygenationIndexSeverity: NeoVentEvaluationResult['oxygenationIndexSeverity'];

  const map = settings.mapMmh2o !== undefined
    ? settings.mapMmh2o
    : (settings.pipMmh2o && settings.peepMmh2o ? settings.peepMmh2o + (settings.pipMmh2o - settings.peepMmh2o) * 0.4 : undefined);

  if (map !== undefined && bloodGas.pO2 > 0) {
    // OI = (MAP * FiO2 * 100) / PaO2 (with FiO2 expressed as percentage 21-100)
    oxygenationIndex = Math.round(((map * (normalizedFio2 * 100)) / bloodGas.pO2) * 10) / 10;

    if (oxygenationIndex < 10) oxygenationIndexSeverity = 'NORMAL_OR_MILD';
    else if (oxygenationIndex < 15) oxygenationIndexSeverity = 'MODERATE';
    else if (oxygenationIndex < 25) oxygenationIndexSeverity = 'SEVERE_INO_INDICATION';
    else oxygenationIndexSeverity = 'CRITICAL_ECMO_THRESHOLD';
  }

  // 4. Blood Gas Interpretation & Adjustments
  const adjustments: VentilatoryAdjustment[] = [];
  const directives: string[] = [];

  let bgInterp = '';
  if (bloodGas.pH < 7.22 && bloodGas.pCO2 > 65) {
    bgInterp = 'Severe uncompensated respiratory acidosis with hypercapnia exceeding permissive threshold.';
  } else if (bloodGas.pH >= 7.22 && bloodGas.pH <= 7.35 && bloodGas.pCO2 >= 45 && bloodGas.pCO2 <= 65) {
    bgInterp = 'Ideal permissive hypercapnia achieved with neuroprotective pH.';
  } else if (bloodGas.pCO2 < 40) {
    bgInterp = 'Hypocarbia detected (CRITICAL RISK for periventricular leukomalacia PVL and cerebral ischemia in preterm infants).';
  } else {
    bgInterp = `Mixed acid-base profile (pH ${bloodGas.pH}, pCO2 ${bloodGas.pCO2} mmHg).`;
  }

  // Ventilation adjustments based on mode and blood gas
  if (bloodGas.pCO2 > 65 || bloodGas.pH < 7.22) {
    // Under-ventilated (pCO2 too high)
    if (settings.mode === 'SIMV_VG') {
      const currentVt = settings.tidalVolumeMlPerKg || 4.5;
      adjustments.push({
        parameter: 'Tidal Volume (Vt)',
        currentValue: `${currentVt} mL/kg`,
        recommendedChange: `Increase to ${Math.min(6.0, currentVt + 0.5)} mL/kg`,
        rationale: 'Increases alveolar minute ventilation while remaining within lung-protective limits.'
      });
      if (settings.rateBpm) {
        adjustments.push({
          parameter: 'Ventilator Rate',
          currentValue: `${settings.rateBpm} bpm`,
          recommendedChange: `Increase by 5-10 bpm (up to 55-60 bpm max)`,
          rationale: 'Increases CO2 clearance.'
        });
      }
    } else if (settings.mode === 'HFOV') {
      const currentAmp = settings.amplitudeDeltaP || 25;
      adjustments.push({
        parameter: 'Oscillator Amplitude (Delta P)',
        currentValue: `${currentAmp} cmH2O`,
        recommendedChange: `Increase by 2-4 cmH2O (verify chest wiggle down to umbilicus)`,
        rationale: 'Amplitude directly drives tidal volume and CO2 elimination on HFOV.'
      });
      const currentHz = settings.frequencyHz || 10;
      if (currentHz > 8) {
        adjustments.push({
          parameter: 'Frequency (Hz)',
          currentValue: `${currentHz} Hz`,
          recommendedChange: `Decrease frequency to ${currentHz - 1} or ${currentHz - 2} Hz`,
          rationale: 'On HFOV, LOWER frequency produces LARGER tidal volumes (inverse relationship) and clears more CO2.'
        });
      }
    }
  } else if (bloodGas.pCO2 < 40) {
    // Hyper-ventilated (pCO2 too low) - emergency in preterm!
    directives.push('URGENT: Immediately wean ventilation to resolve hypocarbia (pCO2 < 40 mmHg reduces cerebral blood flow and causes PVL/cerebral palsy).');
    if (settings.mode === 'SIMV_VG') {
      const currentVt = settings.tidalVolumeMlPerKg || 5.0;
      adjustments.push({
        parameter: 'Tidal Volume (Vt)',
        currentValue: `${currentVt} mL/kg`,
        recommendedChange: `Decrease by 0.5 mL/kg (down to 4.0 mL/kg)`,
        rationale: 'Slows CO2 clearance.'
      });
    } else if (settings.mode === 'HFOV') {
      const currentAmp = settings.amplitudeDeltaP || 25;
      adjustments.push({
        parameter: 'Amplitude (Delta P)',
        currentValue: `${currentAmp} cmH2O`,
        recommendedChange: `Wean Amplitude by 2-4 cmH2O`,
        rationale: 'Reduces high-frequency tidal displacement to allow CO2 accumulation.'
      });
    }
  }

  // Oxygenation adjustments
  if (bloodGas.spO2 < (isPreterm ? 90 : 92) || bloodGas.pO2 < 50) {
    // Hypoxemia
    if (normalizedFio2 < 0.60) {
      adjustments.push({
        parameter: 'FiO2',
        currentValue: `${Math.round(normalizedFio2 * 100)}%`,
        recommendedChange: `Increase by 5-10% (target SpO2 ${targetSpo2Range})`,
        rationale: 'Corrects acute hypoxemia.'
      });
    }
    if (settings.mode === 'HFOV' && settings.mapMmh2o) {
      adjustments.push({
        parameter: 'Mean Airway Pressure (MAP)',
        currentValue: `${settings.mapMmh2o} cmH2O`,
        recommendedChange: `Increase MAP by 1-2 cmH2O (high-lung volume recruitment strategy)`,
        rationale: 'Recruits atelectatic alveolar units and improves ventilation-perfusion matching.'
      });
    } else if (settings.peepMmh2o) {
      adjustments.push({
        parameter: 'PEEP',
        currentValue: `${settings.peepMmh2o} cmH2O`,
        recommendedChange: `Increase PEEP by 1 cmH2O (target 6-8 cmH2O)`,
        rationale: 'Prevents end-expiratory alveolar collapse and preserves Functional Residual Capacity (FRC).'
      });
    }
  } else if (bloodGas.spO2 > (isPreterm ? 95 : 98)) {
    // Hyperoxia - risk for ROP in preemies!
    if (normalizedFio2 > 0.21) {
      adjustments.push({
        parameter: 'FiO2',
        currentValue: `${Math.round(normalizedFio2 * 100)}%`,
        recommendedChange: `Wean FiO2 by 3-5% every 5-10 minutes toward room air (21%)`,
        rationale: isPreterm ? 'Hyperoxia induces oxygen free radicals, vascular obliteration, and Retinopathy of Prematurity (ROP).' : 'Prevents hyperoxic lung injury.'
      });
    }
  }

  // Directives for severe oxygenation failure (OI triggers)
  if (oxygenationIndexSeverity === 'SEVERE_INO_INDICATION') {
    directives.push(`HIGH OXYGENATION INDEX (${oxygenationIndex}): Indication for inhaled Nitric Oxide (iNO at 20 ppm) to treat pulmonary hypertension and refractory hypoxemia.`);
  } else if (oxygenationIndexSeverity === 'CRITICAL_ECMO_THRESHOLD') {
    directives.push(`CRITICAL OXYGENATION INDEX (${oxygenationIndex} >= 25): Impending ECMO threshold. Alert Neonatal ECMO team for cannulation evaluation if gestational age >= 34 weeks and weight >= 2.0 kg.`);
  }

  return {
    gestationalCategory,
    weightCategory,
    oxygenationIndex,
    oxygenationIndexSeverity,
    targetSpo2Range,
    targetPco2Range,
    bloodGasInterpretation: bgInterp,
    ventAdjustments: adjustments,
    clinicalDirectives: directives
  };
}

// 3. DATABASE OPERATIONS
export async function saveNeonatalVentRecord(record: NeoVentEvaluationInput & NeoVentEvaluationResult) {
  const result = await pool.query(
    `INSERT INTO neonatal_vent_records (
      patient_id, gestational_age_weeks, birth_weight_grams, current_weight_grams,
      postnatal_age_days, diagnosis, vent_mode, current_settings, blood_gas,
      oxygenation_index, ventilatory_adjustments, clinical_recommendations
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *`,
    [
      record.patientId,
      record.gestationalAgeWeeks,
      record.birthWeightGrams,
      record.currentWeightGrams,
      record.postnatalAgeDays,
      record.diagnosis,
      record.settings.mode,
      JSON.stringify(record.settings),
      JSON.stringify(record.bloodGas),
      record.oxygenationIndex || null,
      JSON.stringify(record.ventAdjustments),
      record.clinicalDirectives.join(' | ') || record.bloodGasInterpretation
    ]
  );
  return result.rows[0];
}

export async function getPatientVentRecords(patientId: number) {
  const result = await pool.query(
    'SELECT * FROM neonatal_vent_records WHERE patient_id = $1 ORDER BY logged_at DESC LIMIT 50',
    [patientId]
  );
  return result.rows;
}

export async function saveSurfactantLog(log: SurfactantCalculationInput & SurfactantCalculationResult & { postFio2?: number; complications?: string[] }) {
  const result = await pool.query(
    `INSERT INTO surfactant_administration_logs (
      patient_id, dose_number, surfactant_type, dose_mg_per_kg, total_dose_ml,
      delivery_technique, pre_fio2, post_fio2, complications
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [
      log.patientId,
      log.doseNumber,
      log.surfactantType,
      log.doseMgPerKg,
      log.totalVolumeMl,
      log.deliveryTechnique,
      log.preFio2,
      log.postFio2 || null,
      JSON.stringify(log.complications || [])
    ]
  );
  return result.rows[0];
}

export async function getPatientSurfactantLogs(patientId: number) {
  const result = await pool.query(
    'SELECT * FROM surfactant_administration_logs WHERE patient_id = $1 ORDER BY administered_at DESC LIMIT 50',
    [patientId]
  );
  return result.rows;
}
