import { pool } from '../db';

export type PphnSeverity = 'SUBSYSTEMIC_MILD' | 'ISOSYSTEMIC_MODERATE' | 'SUPRASYSTEMIC_SEVERE';
export type PphnEtiology = 'MAS' | 'RDS' | 'CDH' | 'SEPSIS_PNEUMONIA' | 'IDIOPATHIC';
export type DuctalShuntType = 'PURE_RIGHT_TO_LEFT' | 'BIDIRECTIONAL' | 'PURE_LEFT_TO_RIGHT' | 'CLOSED';
export type ForamenOvaleShuntType = 'RIGHT_TO_LEFT' | 'BIDIRECTIONAL' | 'LEFT_TO_RIGHT';

export interface PphnEvaluationInput {
  patientId: number;
  gestationalAgeWeeks: number;
  birthWeightGrams: number;
  etiology: PphnEtiology;
  paspMmhg: number;
  systemicSbpMmhg: number;
  ductalShunt: DuctalShuntType;
  foramenOvaleShunt: ForamenOvaleShuntType;
  hasIvsFlatteningOrDShapedLv: boolean;
  meanAirwayPressureMmh2o: number;
  fio2: number; // 0.21 - 1.00 or 21 - 100
  pao2Mmhg: number;
  lactateMmolL?: number;
  ph?: number;
}

export interface PphnEvaluationResult {
  paspMmhg: number;
  systemicSbpMmhg: number;
  paspSbpRatio: number;
  pphnSeverity: PphnSeverity;
  shuntingPattern: string;
  oxygenationIndex: number;
  inoIndicated: boolean;
  inoDosePpm?: number;
  inoGuidance: string;
  adjunctiveTherapies: {
    agent: string;
    dosing: string;
    rationale: string;
  }[];
  ecmoEligibility: {
    eligibleByAgeAndWeight: boolean;
    ecmoCriteriaMet: boolean;
    alertStatus: 'CRITICAL_ECMO_CANDIDATE' | 'WATCHFUL_SURVEILLANCE' | 'INELIGIBLE';
    rationale: string;
  };
  clinicalManagementPlan: {
    step: number;
    action: string;
    urgency: 'STAT_EMERGENT' | 'URGENT' | 'ROUTINE';
    rationale: string;
  }[];
}

export interface InoMonitoringInput {
  patientId: number;
  inoDosePpm: number;
  fio2: number; // 0.21 - 1.00
  pao2Mmhg: number;
  meanAirwayPressureMmh2o: number;
  preInoPao2?: number;
  methemoglobinPercent: number;
  nitrogenDioxidePpm?: number;
}

export interface InoMonitoringResult {
  oxygenationIndex: number;
  responderStatus: 'POSITIVE_RESPONDER' | 'NON_RESPONDER' | 'WEANING_CANDIDATE';
  methemoglobinStatus: 'NORMAL' | 'ELEVATED_WEAN_DOSE' | 'TOXIC_HOLD_METHYLENE_BLUE';
  reboundWarning: boolean;
  weaningDirectives: string[];
}

// 1. EVALUATE PPHN SEVERITY & MULTIMODAL DIRECTIVES
export function evaluatePphn(input: PphnEvaluationInput): PphnEvaluationResult {
  const {
    gestationalAgeWeeks,
    birthWeightGrams,
    paspMmhg,
    systemicSbpMmhg,
    ductalShunt,
    foramenOvaleShunt,
    hasIvsFlatteningOrDShapedLv,
    meanAirwayPressureMmh2o,
    pao2Mmhg,
    lactateMmolL,
    ph
  } = input;

  const normalizedFio2 = input.fio2 > 1.0 ? input.fio2 / 100 : input.fio2;

  // 1. Hemodynamic Ratio & Severity
  const paspSbpRatio = Math.round((paspMmhg / systemicSbpMmhg) * 100) / 100;
  let pphnSeverity: PphnSeverity = 'SUBSYSTEMIC_MILD';

  if (paspSbpRatio >= 1.0 || ductalShunt === 'PURE_RIGHT_TO_LEFT') {
    pphnSeverity = 'SUPRASYSTEMIC_SEVERE';
  } else if (paspSbpRatio >= 0.75 || ductalShunt === 'BIDIRECTIONAL' || hasIvsFlatteningOrDShapedLv) {
    pphnSeverity = 'ISOSYSTEMIC_MODERATE';
  } else {
    pphnSeverity = 'SUBSYSTEMIC_MILD';
  }

  // 2. Shunting description
  const shuntingPattern = `Ductus: ${ductalShunt.replace(/_/g, ' ')} | PFO: ${foramenOvaleShunt.replace(/_/g, ' ')}${hasIvsFlatteningOrDShapedLv ? ' | Systolic IVS Flattening (D-shaped LV)' : ''}`;

  // 3. Oxygenation Index
  const oi = pao2Mmhg > 0 ? Math.round(((meanAirwayPressureMmh2o * (normalizedFio2 * 100)) / pao2Mmhg) * 10) / 10 : 0;

  // 4. iNO Indication (AAP / AHA guidelines)
  const isTermOrNearTerm = gestationalAgeWeeks >= 34.0;
  const inoIndicated = isTermOrNearTerm && (oi >= 15.0 || pphnSeverity === 'SUPRASYSTEMIC_SEVERE');
  let inoDosePpm = inoIndicated ? 20 : undefined;
  let inoGuidance = '';

  if (inoIndicated) {
    inoGuidance = 'INITIATE INHALED NITRIC OXIDE (iNO) at 20 ppm immediately. Selective pulmonary vasodilation without systemic hypotension. Re-assess PaO2 and OI at 30-60 minutes.';
  } else if (!isTermOrNearTerm && oi >= 15.0) {
    inoGuidance = `Preterm infant (${gestationalAgeWeeks} weeks < 34.0 weeks). iNO is off-label and not proven to decrease mortality in preterm infants. Use only as compassionate trial for severe refractory hypoxemia with documented suprasystemic pulmonary hypertension.`;
  } else {
    inoGuidance = 'iNO not currently indicated (subsystemic PPHN or OI < 15). Optimize lung recruitment and alveolar volume first.';
  }

  // 5. Inotropic & Adjunctive Vasodilator Strategy
  const adjunctive: PphnEvaluationResult['adjunctiveTherapies'] = [];

  // Goal: Maintain SBP > PASP to prevent R-to-L ductal shunting
  adjunctive.push({
    agent: 'Norepinephrine (0.05 - 0.3 mcg/kg/min) or Vasopressin',
    dosing: 'Continuous IV infusion titrated to maintain Systemic SBP > Estimated PASP',
    rationale: 'Increases SVR without increasing PVR, converting right-to-left ductal shunting into left-to-right to restore systemic arterial saturation.'
  });

  if (hasIvsFlatteningOrDShapedLv || pphnSeverity === 'SUPRASYSTEMIC_SEVERE') {
    adjunctive.push({
      agent: 'Milrinone (PDE-3 Inhibitor)',
      dosing: '0.33 - 0.75 mcg/kg/min continuous IV (avoid bolus if borderline BP)',
      rationale: 'Reduces RV afterload, improves RV/LV inotropy and lusitropy, and promotes pulmonary vasodilation in PDE-3 pathways.'
    });
  }

  if (pphnSeverity === 'SUPRASYSTEMIC_SEVERE') {
    adjunctive.push({
      agent: 'Sildenafil (PDE-5 Inhibitor)',
      dosing: 'IV 0.1 - 0.4 mg/kg/hr or PO 0.5 - 2 mg/kg Q6H',
      rationale: 'Potentiates cyclic GMP pathway downstream of nitric oxide; synergistic with iNO and aids weaning in refractory PPHN.'
    });
  }

  // 6. ECMO Threshold Evaluation
  const isEcmoEligible = gestationalAgeWeeks >= 34.0 && birthWeightGrams >= 2000;
  const meetsEcmoCriteria = isEcmoEligible && (
    oi >= 40.0 ||
    (oi >= 25.0 && ((ph !== undefined && ph < 7.15) || (lactateMmolL !== undefined && lactateMmolL >= 5.0)))
  );

  let ecmoStatus: PphnEvaluationResult['ecmoEligibility']['alertStatus'] = 'WATCHFUL_SURVEILLANCE';
  let ecmoRationale = '';

  if (!isEcmoEligible) {
    ecmoStatus = 'INELIGIBLE';
    ecmoRationale = `Infant ineligible for standard ECMO due to GA < 34 weeks (${gestationalAgeWeeks}w) or weight < 2.0 kg (${birthWeightGrams}g) due to high intracranial hemorrhage risk with systemic heparinization.`;
  } else if (meetsEcmoCriteria) {
    ecmoStatus = 'CRITICAL_ECMO_CANDIDATE';
    ecmoRationale = `CRITICAL ECMO CRITERIA MET (OI ${oi} >= 25-40 with refractory hypoxemia/shock). Alert Neonatal ECMO team for emergent VA-ECMO cannulation.`;
  } else {
    ecmoStatus = 'WATCHFUL_SURVEILLANCE';
    ecmoRationale = `Patient eligible if decompensation occurs. Current OI ${oi} is below ECMO trigger (< 40).`;
  }

  // 7. Clinical Management Plan
  const plan: PphnEvaluationResult['clinicalManagementPlan'] = [];

  if (inoIndicated) {
    plan.push({
      step: 1,
      action: 'Initiate inhaled Nitric Oxide (iNO) at 20 ppm via dedicated delivery device.',
      urgency: 'STAT_EMERGENT',
      rationale: 'Rapid selective pulmonary vasodilation.'
    });
  }

  plan.push({
    step: 2,
    action: 'Support SVR: Target Systemic Mean Arterial Pressure (MAP) >= 50 mmHg or SBP > PASP using Norepinephrine.',
    urgency: 'STAT_EMERGENT',
    rationale: 'Reverses right-to-left ductal shunting.'
  });

  plan.push({
    step: 3,
    action: 'Lung Recruitment: Optimize ventilation (HFOV / SIMV-VG) to achieve lung volume at 8-9 ribs on CXR without hyperinflation.',
    urgency: 'URGENT',
    rationale: 'Both atelectasis and alveolar overdistention increase pulmonary vascular resistance.'
  });

  if (meetsEcmoCriteria) {
    plan.push({
      step: 4,
      action: 'STAT NEONATAL ECMO ACTIVATION: Prepare VA-ECMO circuit and notify pediatric surgical team.',
      urgency: 'STAT_EMERGENT',
      rationale: 'Mortality exceeds 80% without extracorporeal life support.'
    });
  }

  return {
    paspMmhg,
    systemicSbpMmhg,
    paspSbpRatio,
    pphnSeverity,
    shuntingPattern,
    oxygenationIndex: oi,
    inoIndicated,
    inoDosePpm,
    inoGuidance,
    adjunctiveTherapies: adjunctive,
    ecmoEligibility: {
      eligibleByAgeAndWeight: isEcmoEligible,
      ecmoCriteriaMet: meetsEcmoCriteria,
      alertStatus: ecmoStatus,
      rationale: ecmoRationale
    },
    clinicalManagementPlan: plan
  };
}

// 2. MONITOR INO RESPONSE, METHEMOGLOBIN & WEANING
export function evaluateInoMonitoring(input: InoMonitoringInput): InoMonitoringResult {
  const {
    inoDosePpm,
    pao2Mmhg,
    meanAirwayPressureMmh2o,
    preInoPao2,
    methemoglobinPercent,
    nitrogenDioxidePpm
  } = input;

  const normalizedFio2 = input.fio2 > 1.0 ? input.fio2 / 100 : input.fio2;
  const oi = pao2Mmhg > 0 ? Math.round(((meanAirwayPressureMmh2o * (normalizedFio2 * 100)) / pao2Mmhg) * 10) / 10 : 0;

  // Responder status
  let responderStatus: InoMonitoringResult['responderStatus'] = 'POSITIVE_RESPONDER';
  if (preInoPao2 !== undefined) {
    const deltaPao2 = pao2Mmhg - preInoPao2;
    if (deltaPao2 >= 20.0 || (oi < 10 && normalizedFio2 < 0.60)) {
      responderStatus = (normalizedFio2 < 0.50 && oi < 8.0) ? 'WEANING_CANDIDATE' : 'POSITIVE_RESPONDER';
    } else {
      responderStatus = 'NON_RESPONDER';
    }
  } else {
    responderStatus = (normalizedFio2 < 0.50 && oi < 8.0) ? 'WEANING_CANDIDATE' : 'POSITIVE_RESPONDER';
  }

  // Methemoglobin Safety
  let metHbStatus: InoMonitoringResult['methemoglobinStatus'] = 'NORMAL';
  const directives: string[] = [];

  if (methemoglobinPercent >= 5.0) {
    metHbStatus = 'TOXIC_HOLD_METHYLENE_BLUE';
    directives.push(`CRITICAL METHEMOGLOBINEMIA (${methemoglobinPercent}% >= 5.0%). Hold iNO immediately. Administer IV Methylene Blue 1 mg/kg IV (1 - 2 mg/kg over 5 minutes).`);
  } else if (methemoglobinPercent >= 2.5) {
    metHbStatus = 'ELEVATED_WEAN_DOSE';
    directives.push(`ELEVATED METHEMOGLOBIN (${methemoglobinPercent}%). Reduce iNO dose by 50% (e.g. from 20 to 10 ppm). Repeat MetHb in 2 hours.`);
  } else {
    directives.push(`Methemoglobin safe (${methemoglobinPercent}% < 2.5%).`);
  }

  if (nitrogenDioxidePpm !== undefined && nitrogenDioxidePpm > 0.5) {
    directives.push(`DANGER: Nitrogen Dioxide (NO2) ${nitrogenDioxidePpm} ppm exceeds safety ceiling (> 0.5 ppm). Check delivery system scavengers.`);
  }

  // Weaning Directives
  const reboundWarning = true;
  if (responderStatus === 'WEANING_CANDIDATE') {
    directives.push('PATIENT READY FOR WEANING: FiO2 < 0.50 and OI < 10. Wean iNO stepwise down to 5 ppm, then 1 ppm, then trial off (by 5 ppm Q4H down to 5 ppm, then 1 ppm Q2-4H).');
    directives.push('REBOUND PPHN WARNING: Never discontinue iNO abruptly! Sudden withdrawal causes profound acute pulmonary vasoconstrictive arrest.');
  }

  return {
    oxygenationIndex: oi,
    responderStatus,
    methemoglobinStatus: metHbStatus,
    reboundWarning,
    weaningDirectives: directives
  };
}

// 3. DATABASE OPERATIONS
export async function savePphnEvaluation(record: PphnEvaluationInput & PphnEvaluationResult) {
  const result = await pool.query(
    `INSERT INTO pphn_evaluations (
      patient_id, gestational_age_weeks, birth_weight_grams, etiology,
      pasp_mmhg, systemic_sbp_mmhg, pasp_sbp_ratio, pphn_severity,
      shunting_pattern, oxygenation_index, ino_indicated, ino_dose_ppm,
      adjunctive_therapies, ecmo_criteria_met, clinical_management_plan
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING *`,
    [
      record.patientId,
      record.gestationalAgeWeeks,
      record.birthWeightGrams,
      record.etiology,
      record.paspMmhg,
      record.systemicSbpMmhg,
      record.paspSbpRatio,
      record.pphnSeverity,
      record.shuntingPattern,
      record.oxygenationIndex,
      record.inoIndicated,
      record.inoDosePpm || null,
      JSON.stringify(record.adjunctiveTherapies),
      record.ecmoEligibility.ecmoCriteriaMet,
      JSON.stringify(record.clinicalManagementPlan)
    ]
  );
  return result.rows[0];
}

export async function getPatientPphnEvaluations(patientId: number) {
  const result = await pool.query(
    'SELECT * FROM pphn_evaluations WHERE patient_id = $1 ORDER BY evaluated_at DESC LIMIT 50',
    [patientId]
  );
  return result.rows;
}

export async function saveInoLog(log: InoMonitoringInput & InoMonitoringResult) {
  const result = await pool.query(
    `INSERT INTO ino_monitoring_logs (
      patient_id, ino_dose_ppm, fio2, pao2_mmhg, oxygenation_index,
      methemoglobin_percent, nitrogen_dioxide_ppm, responder_status, weaning_action
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [
      log.patientId,
      log.inoDosePpm,
      log.fio2,
      log.pao2Mmhg,
      log.oxygenationIndex,
      log.methemoglobinPercent,
      log.nitrogenDioxidePpm || null,
      log.responderStatus,
      log.weaningDirectives.join(' | ')
    ]
  );
  return result.rows[0];
}

export async function getPatientInoLogs(patientId: number) {
  const result = await pool.query(
    'SELECT * FROM ino_monitoring_logs WHERE patient_id = $1 ORDER BY logged_at DESC LIMIT 50',
    [patientId]
  );
  return result.rows;
}
