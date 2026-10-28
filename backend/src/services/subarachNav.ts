import { pool } from '../db';

export type DciRiskCategory = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type AneurysmTreatmentType = 'COILED' | 'CLIPPED' | 'FLOW_DIVERTER' | 'UNSECURED';
export type VasospasmSeverity =
  | 'NO_VASOSPASM'
  | 'HYPEREMIA_NOT_VASOSPASM'
  | 'MILD_VASOSPASM'
  | 'MODERATE_VASOSPASM'
  | 'SEVERE_CRITICAL_VASOSPASM';

export interface SubarachnoidEvaluationInput {
  patientId: number;
  huntHessGrade: number; // 1 to 5
  modifiedFisherGrade: number; // 1 to 4
  gcsScore: number; // 3 to 15
  hasFocalDeficit: boolean;
  aneurysmSecured: boolean;
  aneurysmTreatmentType?: AneurysmTreatmentType;
  postBleedDay: number; // 1 to 21
  hasHydrocephalus?: boolean;
  currentSbpMmhg?: number;
  currentMapMmhg?: number;
  serumSodiumMeqL?: number;
  urineOutputMlHr?: number;
}

export interface ClinicalActionStep {
  step: number;
  action: string;
  urgency: 'STAT_EMERGENT' | 'URGENT' | 'ROUTINE';
  rationale: string;
}

export interface SubarachnoidEvaluationResult {
  huntHessGrade: number;
  modifiedFisherGrade: number;
  wfnsGrade: number;
  dciRiskCategory: DciRiskCategory;
  bloodPressureTarget: string;
  nimodipineRegimen: string;
  hyponatremiaManagement?: string;
  hydrocephalusGuidance?: string;
  clinicalActionPlan: ClinicalActionStep[];
}

export interface TcdVasospasmInput {
  patientId: number;
  postBleedDay: number;
  mcaMfvLeft: number; // cm/s
  mcaMfvRight: number; // cm/s
  icaExtracranialMfv: number; // cm/s (submandibular ICA)
  currentMapMmhg: number;
  newFocalDeficitOrDropInGcs: boolean;
  onNorepinephrine?: boolean;
}

export interface TcdVasospasmResult {
  maxMcaVelocity: number;
  lindegaardRatio: number;
  vasospasmSeverity: VasospasmSeverity;
  endovascularRescueIndicated: boolean;
  inducedHypertensionTarget: string;
  directives: string[];
}

// 1. EVALUATE ANEURYSMAL SAH SEVERITY & VASOSPASM RISK
export function evaluateSubarachnoidHemorrhage(input: SubarachnoidEvaluationInput): SubarachnoidEvaluationResult {
  const {
    huntHessGrade,
    modifiedFisherGrade,
    gcsScore,
    hasFocalDeficit,
    aneurysmSecured,
    postBleedDay,
    hasHydrocephalus,
    serumSodiumMeqL
  } = input;

  // 1. Calculate WFNS Grade
  let wfnsGrade = 1;
  if (gcsScore === 15) {
    wfnsGrade = hasFocalDeficit ? 2 : 1;
  } else if (gcsScore === 13 || gcsScore === 14) {
    wfnsGrade = hasFocalDeficit ? 3 : 2;
  } else if (gcsScore >= 7 && gcsScore <= 12) {
    wfnsGrade = 4;
  } else {
    wfnsGrade = 5;
  }

  // 2. Determine DCI Risk Category
  const isPeakWindow = postBleedDay >= 4 && postBleedDay <= 14;
  let dciRiskCategory: DciRiskCategory = 'LOW';

  if ((modifiedFisherGrade === 3 || modifiedFisherGrade === 4) && isPeakWindow) {
    dciRiskCategory = 'CRITICAL';
  } else if (modifiedFisherGrade === 3 || modifiedFisherGrade === 4 || huntHessGrade >= 4) {
    dciRiskCategory = 'HIGH';
  } else if (modifiedFisherGrade === 2) {
    dciRiskCategory = 'MODERATE';
  } else {
    dciRiskCategory = 'LOW';
  }

  // 3. Blood Pressure Target (Strict pre-securing vs Permissive/Induced post-securing)
  let bloodPressureTarget = '';
  if (!aneurysmSecured) {
    bloodPressureTarget = 'STRICT SBP < 140 mmHg (or MAP < 90 mmHg) using IV Nicardipine or Clevidipine infusion. Re-bleeding carries 70% mortality. AVOID hypotension (MAP < 65 mmHg).';
  } else {
    bloodPressureTarget = 'EUVHOLEMIC NORMOTENSION TO PERMISSIVE HYPERTENSION: Maintain SBP < 160-180 mmHg and MAP >= 80-90 mmHg. If Delayed Cerebral Ischemia (DCI) develops, induce hypertension with Norepinephrine to target MAP > 90-110 mmHg or SBP 160-200 mmHg.';
  }

  // 4. Nimodipine Regimen (Class I, Level A evidence)
  let nimodipineRegimen = 'Nimodipine 60 mg PO/NG Q4H for 21 days from ictus. Proven to improve functional neurological outcomes and decrease cerebral infarction.';
  if (input.currentMapMmhg !== undefined && input.currentMapMmhg < 70) {
    nimodipineRegimen = 'HYPOTENSION ALERT: Split Nimodipine to 30 mg PO/NG Q2H (never discontinue completely). Support MAP with IV crystalloids and Norepinephrine if needed to prevent cerebral hypoperfusion.';
  }

  // 5. Hyponatremia & Salt Wasting Sentinel
  let hyponatremiaManagement: string | undefined = undefined;
  if (serumSodiumMeqL !== undefined && serumSodiumMeqL < 135) {
    hyponatremiaManagement = `HYPONATREMIA ALERT (Na ${serumSodiumMeqL} mEq/L < 135): Evaluate for Cerebral Salt Wasting (CSW) vs SIADH. In aSAH, volume contraction from CSW dramatically increases stroke/DCI risk. DO NOT FLUID RESTRICT. Maintain euvolemia/hypervolemia with IV 0.9% Normal Saline or 3% Hypertonic Saline, and initiate Fludrocortisone 0.1 - 0.2 mg PO BID.`;
  }

  // 6. Hydrocephalus Guidance
  let hydrocephalusGuidance: string | undefined = undefined;
  if (hasHydrocephalus) {
    hydrocephalusGuidance = 'ACUTE HYDROCEPHALUS DETECTED: Emergent External Ventricular Drain (EVD) placement indicated. Set drain pop-off at 15-20 cmH2O initially (avoid rapid sudden ventricular collapse to prevent transmural aneurysm re-rupture if unsecured).';
  }

  // 7. Step-by-Step Clinical Action Plan
  const plan: ClinicalActionStep[] = [];

  if (!aneurysmSecured) {
    plan.push({
      step: 1,
      action: 'STAT Endovascular Coiling vs Microsurgical Clipping: Target definitive aneurysm securement within 24 hours of ictus.',
      urgency: 'STAT_EMERGENT',
      rationale: 'Early obliteration eliminates re-bleeding risk and permits induced hypertension for vasospasm.'
    });
    plan.push({
      step: 2,
      action: 'Maintain strict SBP < 140 mmHg with IV Nicardipine titration. Bed rest, dark quiet room, analgesia, and stool softeners.',
      urgency: 'STAT_EMERGENT',
      rationale: 'Minimizes transmural pressure spikes across fragile aneurysm dome.'
    });
  } else {
    plan.push({
      step: 1,
      action: 'Aneurysm successfully secured: Transition to euvolemic hemodynamic targets (MAP >= 85-90 mmHg).',
      urgency: 'URGENT',
      rationale: 'Permits safe hemodynamic augmentation to perfuse microcirculation without re-rupture hazard.'
    });
  }

  plan.push({
    step: 2,
    action: nimodipineRegimen,
    urgency: 'STAT_EMERGENT',
    rationale: 'Neuroprotection against microvascular vasospasm and cortical spreading ischemia.'
  });

  if (hasHydrocephalus) {
    plan.push({
      step: 3,
      action: 'Urgent EVD placement with continuous ICP and CSF drainage monitoring.',
      urgency: 'STAT_EMERGENT',
      rationale: 'Relieves intracranial hypertension and accelerates clearance of subarachnoid cisternal blood.'
    });
  }

  plan.push({
    step: 4,
    action: 'Daily Transcranial Doppler (TCD) sonography and continuous clinical DCI neurological exam Q1H (GCS, pupil reactivity, focal motor deficits).',
    urgency: 'URGENT',
    rationale: 'Detects peak vasospasm velocity shifts (days 4-14) prior to permanent territorial infarction.'
  });

  return {
    huntHessGrade,
    modifiedFisherGrade,
    wfnsGrade,
    dciRiskCategory,
    bloodPressureTarget,
    nimodipineRegimen,
    hyponatremiaManagement,
    hydrocephalusGuidance,
    clinicalActionPlan: plan
  };
}

// 2. MONITOR TCD VASOSPASM & INDUCED HYPERTENSION / ENDOVASCULAR RESCUE
export function evaluateTcdVasospasm(input: TcdVasospasmInput): TcdVasospasmResult {
  const {
    mcaMfvLeft,
    mcaMfvRight,
    icaExtracranialMfv,
    newFocalDeficitOrDropInGcs
  } = input;

  const maxMca = Math.max(mcaMfvLeft, mcaMfvRight);
  const lindegaard = icaExtracranialMfv > 0 ? Math.round((maxMca / icaExtracranialMfv) * 100) / 100 : 0;

  let vasospasmSeverity: VasospasmSeverity = 'NO_VASOSPASM';

  if (maxMca < 120.0 && lindegaard < 3.0) {
    vasospasmSeverity = 'NO_VASOSPASM';
  } else if (maxMca >= 120.0 && lindegaard < 3.0) {
    vasospasmSeverity = 'HYPEREMIA_NOT_VASOSPASM';
  } else if (maxMca > 200.0 || lindegaard >= 6.0) {
    vasospasmSeverity = 'SEVERE_CRITICAL_VASOSPASM';
  } else if (maxMca >= 140.0 || (lindegaard >= 3.0 && lindegaard < 6.0)) {
    vasospasmSeverity = 'MODERATE_VASOSPASM';
  } else {
    vasospasmSeverity = 'MILD_VASOSPASM';
  }

  // Endovascular Rescue Indications
  const endovascularRescueIndicated =
    vasospasmSeverity === 'SEVERE_CRITICAL_VASOSPASM' ||
    (newFocalDeficitOrDropInGcs && vasospasmSeverity !== 'NO_VASOSPASM' && vasospasmSeverity !== 'HYPEREMIA_NOT_VASOSPASM');

  // Induced Hypertension Targets
  let inducedHypertensionTarget = '';
  if (vasospasmSeverity === 'NO_VASOSPASM' || vasospasmSeverity === 'HYPEREMIA_NOT_VASOSPASM') {
    inducedHypertensionTarget = 'Maintain euvolemic baseline normotension: MAP 80 - 90 mmHg (SBP 120 - 150 mmHg).';
  } else {
    inducedHypertensionTarget = 'INDUCED HYPERTENSION ACTIVE: Titrate IV Norepinephrine or Phenylephrine to target MAP > 90 - 110 mmHg (or SBP 160 - 200 mmHg). Assess for neurological deficit reversal within 30-60 minutes.';
  }

  // Directives
  const directives: string[] = [];

  if (vasospasmSeverity === 'SEVERE_CRITICAL_VASOSPASM') {
    directives.push(`CRITICAL VASOSPASM DETECTED: MCA Mean Flow Velocity ${maxMca} cm/s (> 200) or Lindegaard Ratio ${lindegaard} (>= 6.0). Imminent risk of major territorial stroke.`);
    directives.push('STAT Neurointerventional activation for emergent Diagnostic Cerebral Angiography (DSA) with intra-arterial Verapamil / Milrinone infusion or balloon angioplasty.');
  } else if (vasospasmSeverity === 'MODERATE_VASOSPASM') {
    directives.push(`MODERATE VASOSPASM: MCA MFV ${maxMca} cm/s (140-200) with Lindegaard Ratio ${lindegaard} (3.0-6.0). Escalate induced hypertension and perform repeat TCD in 12 hours.`);
  } else if (vasospasmSeverity === 'HYPEREMIA_NOT_VASOSPASM') {
    directives.push(`HYPEREMIC VELOCITY: Elevated MCA flow (${maxMca} cm/s) with normal Lindegaard Ratio (${lindegaard} < 3.0) represents physiological cerebral hyperemia or post-ischemic reperfusion, NOT true vasospasm.`);
  } else {
    directives.push(`TCD within baseline limits: MCA MFV ${maxMca} cm/s, Lindegaard Ratio ${lindegaard}. Continue daily surveillance.`);
  }

  if (newFocalDeficitOrDropInGcs) {
    directives.push('ACUTE NEUROLOGICAL DETERIORATION: Drop in GCS or new motor/speech deficit. STAT non-contrast head CT to rule out re-bleeding or acute hydrocephalus, followed immediately by CTA / perfusion imaging.');
  }

  return {
    maxMcaVelocity: maxMca,
    lindegaardRatio: lindegaard,
    vasospasmSeverity,
    endovascularRescueIndicated,
    inducedHypertensionTarget,
    directives
  };
}

// 3. DATABASE OPERATIONS
export async function saveSubarachnoidEvaluation(record: SubarachnoidEvaluationInput & SubarachnoidEvaluationResult) {
  const result = await pool.query(
    `INSERT INTO subarachnoid_encounters (
      patient_id, hunt_hess_grade, modified_fisher_grade, wfns_grade,
      aneurysm_secured, aneurysm_treatment_type, post_bleed_day,
      blood_pressure_target, nimodipine_regimen, dci_risk_category, clinical_action_plan
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *`,
    [
      record.patientId,
      record.huntHessGrade,
      record.modifiedFisherGrade,
      record.wfnsGrade,
      record.aneurysmSecured,
      record.aneurysmTreatmentType || null,
      record.postBleedDay,
      record.bloodPressureTarget,
      record.nimodipineRegimen,
      record.dciRiskCategory,
      JSON.stringify(record.clinicalActionPlan)
    ]
  );
  return result.rows[0];
}

export async function getPatientSubarachnoidEvaluations(patientId: number) {
  const result = await pool.query(
    'SELECT * FROM subarachnoid_encounters WHERE patient_id = $1 ORDER BY evaluated_at DESC LIMIT 50',
    [patientId]
  );
  return result.rows;
}

export async function saveTcdLog(log: TcdVasospasmInput & TcdVasospasmResult) {
  const result = await pool.query(
    `INSERT INTO tcd_vasospasm_surveillance_logs (
      patient_id, post_bleed_day, mca_mfv_left, mca_mfv_right,
      ica_extracranial_mfv, lindegaard_ratio, vasospasm_severity,
      endovascular_rescue_indicated, induced_hypertension_target, directives
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      log.patientId,
      log.postBleedDay,
      log.mcaMfvLeft,
      log.mcaMfvRight,
      log.icaExtracranialMfv,
      log.lindegaardRatio,
      log.vasospasmSeverity,
      log.endovascularRescueIndicated,
      log.inducedHypertensionTarget,
      log.directives.join(' | ')
    ]
  );
  return result.rows[0];
}

export async function getPatientTcdLogs(patientId: number) {
  const result = await pool.query(
    'SELECT * FROM tcd_vasospasm_surveillance_logs WHERE patient_id = $1 ORDER BY logged_at DESC LIMIT 50',
    [patientId]
  );
  return result.rows;
}
