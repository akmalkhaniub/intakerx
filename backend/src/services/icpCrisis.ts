import { pool } from '../db';

export type IcpTierLevel = 'TIER_0' | 'TIER_1' | 'TIER_2' | 'TIER_3';

export type HerniationSyndrome =
  | 'NONE_MONITORED'
  | 'UNCAL_TRANSTENTORIAL'
  | 'CENTRAL_HERNIATION'
  | 'TONSILLAR_FORAMEN_MAGNUM'
  | 'SUBFALCINE_CINGULATE';

export interface IcpCrisisInput {
  patientId: number;
  gcsScore: number;
  icpMmhg: number;
  mapMmhg: number;
  pbto2Mmhg?: number; // Brain tissue oxygenation (normal > 25, hypoxia < 20)
  sjvo2Percent?: number; // Jugular venous saturation (normal 55-75%)
  npiLeft?: number; // Neurological Pupil Index (3.0 - 5.0 normal, < 3.0 abnormal)
  npiRight?: number;
  pupilAsymmetryMm?: number;
  cushingTriadPresent?: boolean; // Bradycardia + irregular respirations + severe hypertension
  unilateralPupilDilation?: boolean; // Blown pupil
  bilateralFixedDilated?: boolean;
  decerebratePosturing?: boolean;
  evdInPlace?: boolean;
  currentSodiumMeqL?: number;
  currentOsmolalityMosmKg?: number;
  hasArterialLine?: boolean;
}

export interface ClinicalAction {
  step: number;
  action: string;
  urgency: 'STAT_EMERGENT' | 'URGENT' | 'ROUTINE';
  rationale: string;
}

export interface IcpCrisisResult {
  icpMmhg: number;
  mapMmhg: number;
  cppMmhg: number;
  cppStatus: 'ISCHEMIC_COMPROMISE' | 'OPTIMAL_TARGET' | 'HYPEREMIC_RISK';
  tierLevel: IcpTierLevel;
  herniationSyndrome: HerniationSyndrome;
  pupilReactivityAssessment: string;
  multimodalNeuromonitoringAlerts: string[];
  osmotherapyRegimen: {
    recommendedAgent: 'HYPERTONIC_SALINE_3' | 'HYPERTONIC_SALINE_23_4' | 'MANNITOL_20' | 'HOLD_OSMOTHERAPY';
    dosingDirective: string;
    targetSodiumMeqL: string;
    serumOsmolalityCeiling: string;
    contraindicationsOrPrecautions: string[];
  };
  targetParameters: {
    targetIcp: string;
    targetCpp: string;
    targetPaco2: string;
    targetPbto2: string;
    targetSerumSodium: string;
  };
  clinicalActions: ClinicalAction[];
}

export interface OsmotherapyInput {
  patientId: number;
  agent: 'HYPERTONIC_SALINE_3' | 'HYPERTONIC_SALINE_23_4' | 'MANNITOL_20';
  doseVolumeMl: number;
  serumSodiumMeqL: number;
  serumOsmolalityMosmKg: number;
  osmolarGap?: number;
  preIcp: number;
  postIcp?: number;
}

export interface OsmotherapyResult {
  safetyStatus: 'SAFE_TO_ADMINISTER' | 'CAUTION_BORDERLINE_OSMOLALITY' | 'CONTRAINDICATED_HYPEROSMOLAR';
  deltaIcp?: number;
  directives: string[];
}

// 1. EVALUATE ICP CRISIS & MULTIMODAL NEUROMONITORING
export function evaluateIcpCrisis(input: IcpCrisisInput): IcpCrisisResult {
  const {
    icpMmhg,
    mapMmhg,
    pbto2Mmhg,
    sjvo2Percent,
    npiLeft,
    npiRight,
    cushingTriadPresent,
    unilateralPupilDilation,
    bilateralFixedDilated,
    decerebratePosturing,
    evdInPlace,
    currentSodiumMeqL,
    currentOsmolalityMosmKg
  } = input;

  // 1. Calculate Cerebral Perfusion Pressure (CPP = MAP - ICP)
  const cppMmhg = Math.round((mapMmhg - icpMmhg) * 10) / 10;
  let cppStatus: IcpCrisisResult['cppStatus'] = 'OPTIMAL_TARGET';
  if (cppMmhg < 60.0) {
    cppStatus = 'ISCHEMIC_COMPROMISE';
  } else if (cppMmhg > 70.0) {
    cppStatus = 'HYPEREMIC_RISK';
  } else {
    cppStatus = 'OPTIMAL_TARGET';
  }

  // 2. Pupillometry & Herniation Assessment
  let herniationSyndrome: HerniationSyndrome = 'NONE_MONITORED';
  let pupilReactivity = 'Normal bilateral reactivity (NPi 3.0 - 5.0)';

  const minNpi = Math.min(npiLeft !== undefined ? npiLeft : 5.0, npiRight !== undefined ? npiRight : 5.0);
  const npiDiscrepancy = (npiLeft !== undefined && npiRight !== undefined) ? Math.abs(npiLeft - npiRight) : 0;

  if (cushingTriadPresent) {
    herniationSyndrome = 'TONSILLAR_FORAMEN_MAGNUM';
    pupilReactivity = 'CRITICAL: Cushing Triad (Bradycardia + Hypertension + Respiratory Depression) - Impending medullary coning';
  } else if (unilateralPupilDilation || (npiDiscrepancy >= 0.7 && minNpi < 3.0)) {
    herniationSyndrome = 'UNCAL_TRANSTENTORIAL';
    pupilReactivity = 'STAT ALERT: Unilateral pupillary dilation / sluggish NPi (< 3.0) - Impending uncal transtentorial herniation compressing CN III';
  } else if (bilateralFixedDilated || (minNpi === 0 && decerebratePosturing)) {
    herniationSyndrome = 'CENTRAL_HERNIATION';
    pupilReactivity = 'EMERGENT: Bilateral fixed, dilated pupils / non-reactive (NPi 0.0) - Central transtentorial herniation';
  } else if (minNpi < 3.0) {
    pupilReactivity = `Abnormal pupillary constriction (NPi ${minNpi} < 3.0) - Subclinical intracranial hypertension preceding clinical herniation`;
  }

  // 3. SIBICC Tier Classification
  let tierLevel: IcpTierLevel = 'TIER_0';
  if (herniationSyndrome !== 'NONE_MONITORED' || icpMmhg > 30.0) {
    tierLevel = 'TIER_3';
  } else if (icpMmhg >= 26.0 || (pbto2Mmhg !== undefined && pbto2Mmhg < 15.0)) {
    tierLevel = 'TIER_2';
  } else if (icpMmhg > 20.0 || cppMmhg < 60.0) {
    tierLevel = 'TIER_1';
  } else {
    tierLevel = 'TIER_0';
  }

  // 4. Multimodal Neuromonitoring Alerts
  const multimodalAlerts: string[] = [];
  if (pbto2Mmhg !== undefined) {
    if (pbto2Mmhg < 15.0) {
      multimodalAlerts.push(`CRITICAL BRAIN TISSUE ISCHEMIA: PbtO2 (${pbto2Mmhg} mmHg) is below cellular viability threshold (< 15 mmHg). High risk of irreversible secondary infarction.`);
    } else if (pbto2Mmhg < 20.0) {
      multimodalAlerts.push(`BRAIN TISSUE HYPOXIA: PbtO2 (${pbto2Mmhg} mmHg) < 20 mmHg. Optimize CPP >= 65-70 mmHg, increase FiO2 to maintain PaO2 >= 100 mmHg, and target Hemoglobin >= 7-9 g/dL.`);
    } else {
      multimodalAlerts.push(`Brain tissue oxygenation adequate: PbtO2 ${pbto2Mmhg} mmHg (>= 20 mmHg).`);
    }
  }

  if (sjvo2Percent !== undefined) {
    if (sjvo2Percent < 55.0) {
      multimodalAlerts.push(`CEREBRAL OLIGEMIA / HYPOPERFUSION: SjvO2 (${sjvo2Percent}%) < 55%. Cerebral oxygen extraction is elevated due to inadequate cerebral blood flow.`);
    } else if (sjvo2Percent > 75.0) {
      multimodalAlerts.push(`CEREBRAL HYPEREMIA OR INFARCTION: SjvO2 (${sjvo2Percent}%) > 75%. Reduced cerebral metabolic demand (tissue death or deep barbiturate coma).`);
    }
  }

  // 5. Osmotherapy Regimen
  let recommendedAgent: IcpCrisisResult['osmotherapyRegimen']['recommendedAgent'] = 'HYPERTONIC_SALINE_3';
  let dosingDirective = '';
  const osmoPrecautions: string[] = [];

  const na = currentSodiumMeqL || 140;
  const osmo = currentOsmolalityMosmKg || 295;

  if (herniationSyndrome === 'UNCAL_TRANSTENTORIAL' || herniationSyndrome === 'TONSILLAR_FORAMEN_MAGNUM' || herniationSyndrome === 'CENTRAL_HERNIATION') {
    recommendedAgent = 'HYPERTONIC_SALINE_23_4';
    dosingDirective = 'EMERGENT HERNIATION RESCUE: Hypertonic Saline 23.4% (30 mL IV push over 10-15 minutes via central line). Rapid osmolar gradient reduction of cerebral edema.';
  } else if (na >= 155 || osmo >= 320) {
    recommendedAgent = 'HOLD_OSMOTHERAPY';
    dosingDirective = `HOLD OSMOTHERAPY: Serum Na (${na} mEq/L >= 155) or Osmolality (${osmo} mOsm/kg >= 320) has reached safety ceiling. Risk of acute kidney injury, subdural hemorrhage, and central pontine myelinolysis. Transition to CSF drainage / Tier 2/3 interventions.`;
    osmoPrecautions.push('Sodium/Osmolality ceiling reached');
  } else if (mapMmhg < 65.0 || cppMmhg < 60.0) {
    // Mannitol causes osmotic diuresis and hypovolemia -> avoid in borderline hemodynamics
    recommendedAgent = 'HYPERTONIC_SALINE_3';
    dosingDirective = 'Hypertonic Saline 3% (250 mL IV bolus over 15-20 minutes, or 1-2 mL/kg). Preserves intravascular volume while mobilizing brain water into intravascular space.';
    osmoPrecautions.push('Mannitol contraindicated due to hypotension / hypovolemia risk');
  } else {
    // Normal volume, choose based on clinical preference
    recommendedAgent = 'HYPERTONIC_SALINE_3';
    dosingDirective = 'Hypertonic Saline 3% (250 mL IV bolus over 20 min) OR Mannitol 20% (0.5 - 1.0 g/kg IV over 20 min). Target serum Na 145-155 mEq/L, Osmolality < 320 mOsm/kg.';
  }

  // 6. Step-by-Step Clinical Actions Plan
  const plan: ClinicalAction[] = [];

  // Tier 0 foundation
  plan.push({
    step: 1,
    action: 'Head of Bed elevated 30-45 degrees with neck strictly midline; loosen cervical collar straps if present.',
    urgency: 'STAT_EMERGENT',
    rationale: 'Facilitates jugular venous outflow and prevents passive intracranial venous engorgement.'
  });

  if (evdInPlace) {
    plan.push({
      step: 2,
      action: 'Open External Ventricular Drain (EVD) to drain CSF continuously against 10-15 cmH2O pop-off, or drain 5-10 mL intermittently for ICP spikes.',
      urgency: 'STAT_EMERGENT',
      rationale: 'Rapid intracranial volume unloading according to the Monro-Kellie doctrine.'
    });
  }

  if (tierLevel === 'TIER_1' || tierLevel === 'TIER_2' || tierLevel === 'TIER_3') {
    plan.push({
      step: 3,
      action: dosingDirective,
      urgency: 'STAT_EMERGENT',
      rationale: 'Creates osmotic intravascular gradient to reduce cerebral parenchymal intracellular water volume.'
    });
  }

  if (cppMmhg < 60.0) {
    plan.push({
      step: 4,
      action: 'Initiate or titrate IV Norepinephrine infusion to target MAP >= 80-85 mmHg to restore CPP >= 60-70 mmHg.',
      urgency: 'STAT_EMERGENT',
      rationale: 'Prevents secondary ischemic brain infarction from critical cerebral hypoperfusion.'
    });
  }

  if (tierLevel === 'TIER_2' || tierLevel === 'TIER_3') {
    plan.push({
      step: 5,
      action: 'Administer Neuromuscular Blockade trial (Cisatracurium 0.15 mg/kg IV bolus, target TOF 1-2/4) under deep analgesia/sedation.',
      urgency: 'STAT_EMERGENT',
      rationale: 'Abolishes shivering, dyssynchronous coughing against ventilator, and motor posturing that skyrocket intrathoracic and intracranial pressure.'
    });

    plan.push({
      step: 6,
      action: 'Transient Mild Hyperventilation targeting PaCO2 30-35 mmHg. STRICTLY AVOID PaCO2 < 30 mmHg unless PbtO2 is continuously monitored.',
      urgency: 'URGENT',
      rationale: 'Induces cerebral precapillary vasoconstriction to reduce intracranial blood volume; excessive hypocapnia (< 30) causes cerebral ischemia.'
    });
  }

  if (tierLevel === 'TIER_3') {
    plan.push({
      step: 7,
      action: 'STAT NEUROSURGERY NOTIFICATION: Emergency Decompressive Craniectomy (frontotemporoparietal hemicraniectomy >= 12x15 cm with duraplasty).',
      urgency: 'STAT_EMERGENT',
      rationale: 'Surgical decompression provides definitive mechanical relief of refractory compartment syndrome.'
    });

    plan.push({
      step: 8,
      action: 'Initiate High-Dose Pentobarbital Coma (Loading 10 mg/kg over 30 min, then 5 mg/kg/h x 3h, then 1-2 mg/kg/h maintenance) with continuous cEEG monitoring targeting burst suppression (3-5 bursts/minute).',
      urgency: 'STAT_EMERGENT',
      rationale: 'Suppresses cerebral metabolic rate of oxygen (CMRO2) by up to 50% to arrest progressive metabolic crisis.'
    });
  }

  return {
    icpMmhg,
    mapMmhg,
    cppMmhg,
    cppStatus,
    tierLevel,
    herniationSyndrome,
    pupilReactivityAssessment: pupilReactivity,
    multimodalNeuromonitoringAlerts: multimodalAlerts,
    osmotherapyRegimen: {
      recommendedAgent,
      dosingDirective,
      targetSodiumMeqL: '145 - 155 mEq/L (Ceiling 160 mEq/L)',
      serumOsmolalityCeiling: '< 320 mOsm/kg',
      contraindicationsOrPrecautions: osmoPrecautions
    },
    targetParameters: {
      targetIcp: '< 20 - 22 mmHg',
      targetCpp: '60 - 70 mmHg (Avoid < 60 mmHg)',
      targetPaco2: tierLevel === 'TIER_2' || tierLevel === 'TIER_3' ? '30 - 35 mmHg' : '35 - 40 mmHg',
      targetPbto2: '>= 20 mmHg',
      targetSerumSodium: '145 - 155 mEq/L'
    },
    clinicalActions: plan
  };
}

// 2. MONITOR OSMOTHERAPY ADMINISTRATION & SAFETY LIMITS
export function evaluateOsmotherapy(input: OsmotherapyInput): OsmotherapyResult {
  const {
    agent,
    serumSodiumMeqL,
    serumOsmolalityMosmKg,
    osmolarGap,
    preIcp,
    postIcp
  } = input;

  const directives: string[] = [];
  let safetyStatus: OsmotherapyResult['safetyStatus'] = 'SAFE_TO_ADMINISTER';

  // Check Sodium & Osmolality limits
  if (serumSodiumMeqL >= 160.0 || serumOsmolalityMosmKg >= 320.0) {
    safetyStatus = 'CONTRAINDICATED_HYPEROSMOLAR';
    directives.push(`CRITICAL HYPEROSMOLAR TOXICITY: Serum Na (${serumSodiumMeqL} mEq/L >= 160) or Osmolality (${serumOsmolalityMosmKg} mOsm/kg >= 320) exceeds safety limit. Discontinue further osmotherapy immediately to prevent acute tubular necrosis and central pontine myelinolysis.`);
  } else if (serumSodiumMeqL >= 155.0 || serumOsmolalityMosmKg >= 315.0) {
    safetyStatus = 'CAUTION_BORDERLINE_OSMOLALITY';
    directives.push(`BORDERLINE SAFETY THRESHOLD: Serum Na ${serumSodiumMeqL} mEq/L (target 145-155), Osmolality ${serumOsmolalityMosmKg} mOsm/kg. Use lower dose and repeat serum electrolytes in 2 hours.`);
  } else {
    safetyStatus = 'SAFE_TO_ADMINISTER';
    directives.push(`Electrolytes safe for administration: Na ${serumSodiumMeqL} mEq/L (< 155), Osmolality ${serumOsmolalityMosmKg} mOsm/kg (< 320).`);
  }

  // Mannitol specific checks
  if (agent === 'MANNITOL_20') {
    if (osmolarGap !== undefined && osmolarGap >= 20.0) {
      safetyStatus = 'CONTRAINDICATED_HYPEROSMOLAR';
      directives.push(`ELEVATED OSMOLAR GAP: Osmolar gap (${osmolarGap} mOsm/kg >= 20) indicates significant unexcreted mannitol accumulation. Hold Mannitol immediately to prevent renal shutdown.`);
    }
    directives.push('Mannitol Protocol: Monitor urine output strictly; ensure Foley catheter in place. Flush crystals before infusion if visible.');
  }

  // Hypertonic saline central line check
  if (agent === 'HYPERTONIC_SALINE_3' || agent === 'HYPERTONIC_SALINE_23_4') {
    if (agent === 'HYPERTONIC_SALINE_23_4') {
      directives.push('23.4% Saline Guardrail: MUST be infused via Central Venous Access due to extreme osmolarity (8008 mOsm/L). Peripheral extravasation causes severe tissue sloughing.');
    }
  }

  let deltaIcp: number | undefined = undefined;
  if (postIcp !== undefined) {
    deltaIcp = Math.round((preIcp - postIcp) * 10) / 10;
    if (deltaIcp >= 5.0) {
      directives.push(`THERAPEUTIC RESPONSE: ICP decreased by ${deltaIcp} mmHg (from ${preIcp} to ${postIcp} mmHg). Continue monitoring.`);
    } else {
      directives.push(`REFRACTORY RESPONSE: ICP reduction was suboptimal (delta ${deltaIcp} mmHg, current ICP ${postIcp} mmHg). Re-evaluate for escalating tier.`);
    }
  }

  return {
    safetyStatus,
    deltaIcp,
    directives
  };
}

// 3. DATABASE PERSISTENCE
export async function saveIcpEvaluation(record: IcpCrisisInput & IcpCrisisResult) {
  const result = await pool.query(
    `INSERT INTO icp_crisis_encounters (
      patient_id, gcs_score, icp_mmhg, map_mmhg, cpp_mmhg,
      pbto2_mmhg, sjvo2_percent, npi_left, npi_right,
      pupil_reactivity, herniation_syndrome, tier_level,
      osmotherapy_regimen, target_parameters, clinical_actions
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING *`,
    [
      record.patientId,
      record.gcsScore,
      record.icpMmhg,
      record.mapMmhg,
      record.cppMmhg,
      record.pbto2Mmhg || null,
      record.sjvo2Percent || null,
      record.npiLeft || null,
      record.npiRight || null,
      record.pupilReactivityAssessment,
      record.herniationSyndrome,
      record.tierLevel,
      record.osmotherapyRegimen.dosingDirective,
      JSON.stringify(record.targetParameters),
      JSON.stringify(record.clinicalActions)
    ]
  );
  return result.rows[0];
}

export async function getPatientIcpEvaluations(patientId: number) {
  const result = await pool.query(
    'SELECT * FROM icp_crisis_encounters WHERE patient_id = $1 ORDER BY evaluated_at DESC LIMIT 50',
    [patientId]
  );
  return result.rows;
}

export async function saveOsmotherapyLog(log: OsmotherapyInput & OsmotherapyResult) {
  const result = await pool.query(
    `INSERT INTO osmotherapy_administration_logs (
      patient_id, agent, dose_volume_ml, serum_sodium_meq_l,
      serum_osmolality_mosm_kg, osmolar_gap, pre_icp, post_icp, directives
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [
      log.patientId,
      log.agent,
      log.doseVolumeMl,
      log.serumSodiumMeqL,
      log.serumOsmolalityMosmKg,
      log.osmolarGap || null,
      log.preIcp,
      log.postIcp || null,
      log.directives.join(' | ')
    ]
  );
  return result.rows[0];
}

export async function getPatientOsmotherapyLogs(patientId: number) {
  const result = await pool.query(
    'SELECT * FROM osmotherapy_administration_logs WHERE patient_id = $1 ORDER BY logged_at DESC LIMIT 50',
    [patientId]
  );
  return result.rows;
}
