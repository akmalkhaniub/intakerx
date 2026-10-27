import { pool } from '../db';

export type CchdCategory =
  | 'DUCTAL_DEPENDENT_SYSTEMIC'
  | 'DUCTAL_DEPENDENT_PULMONARY'
  | 'DUCTAL_DEPENDENT_MIXING'
  | 'NON_DUCTAL_OR_PULMONARY';

export type PulseQuality = 'NORMAL' | 'DIMINISHED' | 'ABSENT';

export interface CongenitalHeartInput {
  patientId: number;
  postnatalAgeHours: number;
  preDuctalSpo2: number; // Right hand
  postDuctalSpo2: number; // Left/Right foot
  roomAirPao2?: number;
  hyperoxiaPao2: number; // PaO2 on 100% FiO2
  femoralPulses: PulseQuality;
  fourExtremityBpGradientMmhg?: number; // Upper SBP - Lower SBP
  echocardiogramFindings?: string[];
  hasMetabolicAcidosis: boolean;
  lactateMmolL?: number;
}

export interface CongenitalHeartResult {
  lesionCategory: CchdCategory;
  suspectedLesions: string[];
  hyperoxiaTestInterpretation: {
    result: 'POSITIVE_CYANOTIC_CHD' | 'NEGATIVE_PULMONARY' | 'EQUIVOCAL';
    pao2Value: number;
    explanation: string;
  };
  differentialCyanosisPattern: 'NORMAL' | 'TRUE_DIFFERENTIAL' | 'REVERSE_DIFFERENTIAL';
  pge1Indicated: boolean;
  pge1Dosing: string;
  oxygenationTargetStrategy: string;
  rashkindIndicated: boolean;
  apneaRiskAlert: {
    alert: boolean;
    recommendation: string;
  };
  clinicalActions: {
    step: number;
    action: string;
    urgency: 'STAT_EMERGENT' | 'URGENT' | 'ROUTINE';
    rationale: string;
  }[];
}

export interface Pge1MonitoringInput {
  patientId: number;
  infusionRateMcgKgMin: number;
  apneaObserved: boolean;
  temperatureCelsius?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  preDuctalSpo2: number;
  postDuctalSpo2: number;
  patientWeightKg: number;
}

export interface Pge1MonitoringResult {
  infusionStatus: 'EFFECTIVE_DUCTAL_PATENCY' | 'SUBTHERAPEUTIC_CLOSED_DUCTUS' | 'EXCESSIVE_SIDE_EFFECTS';
  hemodynamicStability: string;
  apneaGuardDirectives: string[];
  recommendedInfusionAdjustment: string;
}

// 1. EVALUATE CONGENITAL HEART DISEASE & DUCTAL DEPENDENCY
export function evaluateCongenitalHeart(input: CongenitalHeartInput): CongenitalHeartResult {
  const {
    preDuctalSpo2,
    postDuctalSpo2,
    hyperoxiaPao2,
    femoralPulses,
    fourExtremityBpGradientMmhg,
    echocardiogramFindings = [],
    hasMetabolicAcidosis,
    lactateMmolL
  } = input;

  // 1. Hyperoxia Test
  let hyperoxiaResult: CongenitalHeartResult['hyperoxiaTestInterpretation']['result'] = 'EQUIVOCAL';
  let hyperoxiaExplanation = '';

  if (hyperoxiaPao2 >= 250) {
    hyperoxiaResult = 'NEGATIVE_PULMONARY';
    hyperoxiaExplanation = `PaO2 ${hyperoxiaPao2} mmHg on 100% FiO2 rules out fixed intracardiac cyanotic shunt. Favors primary pulmonary disease (RDS, TTN, meconium aspiration) or hypoventilation.`;
  } else if (hyperoxiaPao2 < 150) {
    hyperoxiaResult = 'POSITIVE_CYANOTIC_CHD';
    hyperoxiaExplanation = `PaO2 ${hyperoxiaPao2} mmHg on 100% FiO2 is fixed and refractory (<150 mmHg). Strongly indicative of Cyanotic Critical Congenital Heart Disease (right-to-left intracardiac shunting or complete anatomical mixing).`;
  } else {
    hyperoxiaResult = 'EQUIVOCAL';
    hyperoxiaExplanation = `PaO2 ${hyperoxiaPao2} mmHg is borderline (150-249 mmHg). Urgent pediatric echocardiography indicated.`;
  }

  // 2. Differential Cyanosis
  let diffPattern: CongenitalHeartResult['differentialCyanosisPattern'] = 'NORMAL';
  const spo2Diff = preDuctalSpo2 - postDuctalSpo2;

  if (spo2Diff >= 3) {
    diffPattern = 'TRUE_DIFFERENTIAL'; // Pre-ductal > Post-ductal
  } else if (spo2Diff <= -3) {
    diffPattern = 'REVERSE_DIFFERENTIAL'; // Post-ductal > Pre-ductal
  }

  // 3. Category & Suspected Lesions
  let category: CchdCategory = 'NON_DUCTAL_OR_PULMONARY';
  const suspected: string[] = [];

  const echoJoined = echocardiogramFindings.join(' ').toUpperCase();

  // Check Systemic Ductal Dependency (Left-Sided Obstruction)
  const hasDiminishedPulses = femoralPulses === 'DIMINISHED' || femoralPulses === 'ABSENT';
  const hasBpGradient = fourExtremityBpGradientMmhg !== undefined && fourExtremityBpGradientMmhg >= 15;
  const echoSystemic = echoJoined.includes('HLHS') || echoJoined.includes('COA') || echoJoined.includes('IAA') || echoJoined.includes('AORTIC STENOSIS');

  if (hasDiminishedPulses || hasBpGradient || echoSystemic) {
    category = 'DUCTAL_DEPENDENT_SYSTEMIC';
    if (echoJoined.includes('HLHS')) suspected.push('Hypoplastic Left Heart Syndrome (HLHS)');
    if (echoJoined.includes('COA') || hasBpGradient) suspected.push('Severe / Critical Coarctation of the Aorta (CoA)');
    if (echoJoined.includes('IAA')) suspected.push('Interrupted Aortic Arch (IAA)');
    if (echoJoined.includes('AORTIC STENOSIS')) suspected.push('Critical Aortic Stenosis');
    if (suspected.length === 0) suspected.push('Ductal-Dependent Systemic Obstruction (CoA / HLHS / IAA)');
  } else if (diffPattern === 'REVERSE_DIFFERENTIAL' || echoJoined.includes('TGA') || echoJoined.includes('TRANSPOSITION')) {
    category = 'DUCTAL_DEPENDENT_MIXING';
    suspected.push('D-Transposition of the Great Arteries (D-TGA)');
    if (echoJoined.includes('TAPVR')) suspected.push('Total Anomalous Pulmonary Venous Return (TAPVR)');
    if (echoJoined.includes('TRUNCUS')) suspected.push('Truncus Arteriosus');
  } else if (hyperoxiaResult === 'POSITIVE_CYANOTIC_CHD') {
    // Pulmonary Ductal Dependency (Right-Sided Obstruction)
    category = 'DUCTAL_DEPENDENT_PULMONARY';
    if (echoJoined.includes('PULMONARY ATRESIA') || echoJoined.includes('PA/IVS') || echoJoined.includes('PA-IVS')) suspected.push('Pulmonary Atresia with Intact Ventricular Septum (PA/IVS)');
    if (echoJoined.includes('TETRALOGY') || echoJoined.includes('TOF')) suspected.push('Severe Tetralogy of Fallot with Ductal-Dependent Flow');
    if (echoJoined.includes('TRICUSPID ATRESIA')) suspected.push('Tricuspid Atresia');
    if (echoJoined.includes('CRITICAL PS')) suspected.push('Critical Pulmonary Stenosis');
    if (suspected.length === 0) suspected.push('Ductal-Dependent Pulmonary Obstruction (PA/IVS, Critical PS, Tricuspid Atresia)');
  } else {
    category = 'NON_DUCTAL_OR_PULMONARY';
    suspected.push('Primary Pulmonary Parenchymal Disease / PPHN without Ductal Dependency');
  }

  // 4. PGE1 Indication & Dosing
  const pge1Indicated = category !== 'NON_DUCTAL_OR_PULMONARY' || (hyperoxiaResult === 'POSITIVE_CYANOTIC_CHD' && hasMetabolicAcidosis);
  let pge1Dosing = '';

  if (pge1Indicated) {
    if (hasMetabolicAcidosis || femoralPulses === 'ABSENT' || (lactateMmolL !== undefined && lactateMmolL > 4.0)) {
      pge1Dosing = 'EMERGENT RESCUE DOSING: Alprostadil (PGE1) 0.05 - 0.10 mcg/kg/min continuous IV/IO infusion immediately to re-open closing ductus arteriosus.';
    } else {
      pge1Dosing = 'MAINTENANCE DOSING: Alprostadil (PGE1) 0.01 - 0.025 mcg/kg/min continuous IV infusion to maintain ductal patency while minimizing apnea and vasodilation.';
    }
  } else {
    pge1Dosing = 'PGE1 not indicated based on negative hyperoxia screen and preserved femoral perfusion.';
  }

  // 5. Oxygenation Target Strategy
  let oxygenationStrategy = '';
  if (category === 'DUCTAL_DEPENDENT_SYSTEMIC') {
    oxygenationStrategy = 'SUB-AMBIENT / NORMIC OXYGEN TARGET: Maintain SpO2 75% - 85% on room air (FiO2 0.21) or blended nitrogen if SpO2 > 88%. STRICTLY AVOID HYPEROXIA (FiO2 > 0.21 causes pulmonary vasodilation, precipitating massive pulmonary overcirculation and fatal coronary/systemic hypoperfusion steal!).';
  } else if (category === 'DUCTAL_DEPENDENT_PULMONARY') {
    oxygenationStrategy = 'Target SpO2 75% - 85%. Supplemental oxygen is permissive but reliance is strictly on PGE1-mediated pulmonary blood flow.';
  } else if (category === 'DUCTAL_DEPENDENT_MIXING') {
    oxygenationStrategy = 'Target SpO2 75% - 85%. Requires both PDA patency (PGE1) and adequate atrial septal mixing.';
  } else {
    oxygenationStrategy = 'Standard neonatal oxygenation targets (SpO2 90% - 95% for preterm, 92% - 98% for term).';
  }

  // 6. Rashkind Atrial Septostomy Sentinel
  let rashkindIndicated = false;
  if (category === 'DUCTAL_DEPENDENT_MIXING' || echoJoined.includes('TGA')) {
    if (preDuctalSpo2 < 70 || echoJoined.includes('RESTRICTIVE') || echoJoined.includes('INTACT ATRIAL')) {
      rashkindIndicated = true;
    }
  }

  // 7. Clinical Actions
  const actions: CongenitalHeartResult['clinicalActions'] = [];

  if (pge1Indicated) {
    actions.push({
      step: 1,
      action: 'Start continuous IV/IO Alprostadil (Prostaglandin E1) infusion immediately via dedicated line.',
      urgency: 'STAT_EMERGENT',
      rationale: 'Life-saving restoration and maintenance of patent ductus arteriosus (PDA).'
    });
    actions.push({
      step: 2,
      action: 'Airway and intubation equipment at bedside (PGE1 carries 10-12% apnea rate, highest in first 60 minutes).',
      urgency: 'STAT_EMERGENT',
      rationale: 'Apnea and hypotension are prominent side effects of PGE1.'
    });
    actions.push({
      step: 3,
      action: 'Stat Pediatric Cardiology Consult for emergent confirmatory bedside echocardiogram.',
      urgency: 'STAT_EMERGENT',
      rationale: 'Delineates precise anatomical lesion (HLHS, TGA, CoA, TAPVR).'
    });
    actions.push({
      step: 4,
      action: oxygenationStrategy,
      urgency: 'URGENT',
      rationale: 'Balances pulmonary-to-systemic blood flow ratio (Qp:Qs).'
    });
    if (rashkindIndicated) {
      actions.push({
        step: 5,
        action: 'EMERGENCY RASHKIND BALLOON ATRIAL SEPTOSTOMY: Restrictive atrial septum in D-TGA prevents oxygenated mixing. Alert Cath Lab / Pediatric Interventionalist immediately.',
        urgency: 'STAT_EMERGENT',
        rationale: 'Creates large non-restrictive atrial defect to relieve fatal refractory hypoxia.'
      });
    }
  } else {
    actions.push({
      step: 1,
      action: 'Proceed with neonatal pulmonary care (CPAP / Surfactant / Antibiotics for presumed pneumonia or RDS).',
      urgency: 'URGENT',
      rationale: 'Negative hyperoxia screen excludes fixed cyanotic intracardiac shunt.'
    });
  }

  return {
    lesionCategory: category,
    suspectedLesions: suspected,
    hyperoxiaTestInterpretation: {
      result: hyperoxiaResult,
      pao2Value: hyperoxiaPao2,
      explanation: hyperoxiaExplanation
    },
    differentialCyanosisPattern: diffPattern,
    pge1Indicated,
    pge1Dosing,
    oxygenationTargetStrategy: oxygenationStrategy,
    rashkindIndicated,
    apneaRiskAlert: {
      alert: pge1Indicated,
      recommendation: 'Mandatory continuous cardiorespiratory monitoring; intubation supplies & bag-valve-mask ready at warmer.'
    },
    clinicalActions: actions
  };
}

// 2. MONITOR PGE1 INFUSION DYNAMICS
export function evaluatePge1Infusion(input: Pge1MonitoringInput): Pge1MonitoringResult {
  const {
    infusionRateMcgKgMin,
    apneaObserved,
    temperatureCelsius = 37.0,
    bloodPressureSystolic,
    preDuctalSpo2,
    postDuctalSpo2,
    patientWeightKg
  } = input;

  const directives: string[] = [];
  let status: Pge1MonitoringResult['infusionStatus'] = 'EFFECTIVE_DUCTAL_PATENCY';
  let hemodynamicStability = 'Hemodynamically stable on PGE1.';
  let adjustment = 'Maintain current rate.';

  // Check Apnea
  if (apneaObserved) {
    directives.push('CRITICAL: Apnea episode detected. Bag-valve-mask ventilate immediately; prepare for elective endotracheal intubation.');
  }
  if (patientWeightKg < 2.0) {
    directives.push('High vulnerability infant (< 2.0 kg): 20%+ incidence of profound PGE1 apnea. Strongly consider preemptive elective intubation.');
  }

  // Check Vasodilation / Pyrexia / Hypotension
  if (temperatureCelsius > 38.0) {
    directives.push(`Pyrexia (${temperatureCelsius} C): Expected prostaglandin-mediated central thermoregulatory resetting. Antipyretic / cooling measures.`);
  }

  if (bloodPressureSystolic !== undefined && bloodPressureSystolic < 45) {
    hemodynamicStability = `Systemic hypotension (SBP ${bloodPressureSystolic} mmHg). Administer 10 mL/kg isotonic saline bolus.`;
    status = 'EXCESSIVE_SIDE_EFFECTS';
    adjustment = 'Wean PGE1 dose by 25-50% (down to 0.01 - 0.02 mcg/kg/min) once ductal patency confirmed.';
  }

  // Check Ductal Opening Response
  const minSpo2 = Math.min(preDuctalSpo2, postDuctalSpo2);
  if (minSpo2 >= 75 && infusionRateMcgKgMin >= 0.05) {
    status = 'EFFECTIVE_DUCTAL_PATENCY';
    adjustment = 'Ductal patency re-established (SpO2 >= 75%). Wean PGE1 to maintenance rate (0.01 - 0.025 mcg/kg/min) to prevent side effects.';
  } else if (minSpo2 < 65 && infusionRateMcgKgMin < 0.05) {
    status = 'SUBTHERAPEUTIC_CLOSED_DUCTUS';
    adjustment = 'Severe hypoxemia persists. Escalate PGE1 to 0.05 - 0.10 mcg/kg/min.';
  }

  return {
    infusionStatus: status,
    hemodynamicStability,
    apneaGuardDirectives: directives,
    recommendedInfusionAdjustment: adjustment
  };
}

// 3. DATABASE OPERATIONS
export async function saveCongenitalHeartEvaluation(evalData: CongenitalHeartInput & CongenitalHeartResult) {
  const result = await pool.query(
    `INSERT INTO congenital_heart_evaluations (
      patient_id, lesion_category, suspected_lesions, hyperoxia_test,
      pge1_indicated, pge1_dosing, oxygenation_target_strategy,
      rashkind_indicated, clinical_actions
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [
      evalData.patientId,
      evalData.lesionCategory,
      JSON.stringify(evalData.suspectedLesions),
      JSON.stringify(evalData.hyperoxiaTestInterpretation),
      evalData.pge1Indicated,
      evalData.pge1Dosing,
      evalData.oxygenationTargetStrategy,
      evalData.rashkindIndicated,
      JSON.stringify(evalData.clinicalActions)
    ]
  );
  return result.rows[0];
}

export async function getPatientCchdEvaluations(patientId: number) {
  const result = await pool.query(
    'SELECT * FROM congenital_heart_evaluations WHERE patient_id = $1 ORDER BY evaluated_at DESC LIMIT 50',
    [patientId]
  );
  return result.rows;
}

export async function savePge1Log(log: Pge1MonitoringInput & Pge1MonitoringResult) {
  const result = await pool.query(
    `INSERT INTO pge1_infusion_monitoring_logs (
      patient_id, infusion_rate_mcg_kg_min, apnea_observed, temperature_celsius,
      blood_pressure_systolic, blood_pressure_diastolic, pre_ductal_spo2,
      post_ductal_spo2, airway_status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [
      log.patientId,
      log.infusionRateMcgKgMin,
      log.apneaObserved,
      log.temperatureCelsius || null,
      log.bloodPressureSystolic || null,
      log.bloodPressureDiastolic || null,
      log.preDuctalSpo2,
      log.postDuctalSpo2,
      log.apneaGuardDirectives.join('; ') || 'Intact spontaneous respiration'
    ]
  );
  return result.rows[0];
}

export async function getPatientPge1Logs(patientId: number) {
  const result = await pool.query(
    'SELECT * FROM pge1_infusion_monitoring_logs WHERE patient_id = $1 ORDER BY logged_at DESC LIMIT 50',
    [patientId]
  );
  return result.rows;
}
