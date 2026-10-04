import { pool } from '../db';

export interface RadiobiologyInput {
  physicalDoseGy: number;
  fractionCount: number;
  alphaBetaRatioTumor: number; // e.g. 10 for most tumors, 1.5 for prostate
  alphaBetaRatioOar?: number; // default 3 for late responding normal tissues
}

export interface RadiobiologyResult {
  physicalDoseGy: number;
  fractionCount: number;
  dosePerFractionGy: number;
  alphaBetaRatioTumor: number;
  bedTumorGy: number;
  eqd2TumorGy: number;
  alphaBetaRatioOar: number;
  bedOarGy: number;
  eqd2OarGy: number;
  clinicalInterpretation: string;
}

export interface QuantecOrganInput {
  organ: 'Spinal_Cord' | 'Brainstem' | 'Optic_Chiasm_Nerve' | 'Kidneys_Bilateral' | 'Lungs' | 'Heart' | 'Rectum';
  maxDoseGy?: number;
  meanDoseGy?: number;
  volumeAboveThresholdPercent?: number; // e.g. V20, V30, V50
  volumeThresholdGy?: number;
}

export interface QuantecAssessmentResult {
  organ: string;
  isCompliant: boolean;
  quantecStandard: string;
  measuredMetric: string;
  riskAlert: string | null;
  toxicityRiskLevel: 'Negligible' | 'Borderline' | 'High Risk of Severe Toxicity';
}

export interface TheranosticProtocolInput {
  radiopharmaceutical: '177Lu-PSMA-617_Pluvicto' | '177Lu-DOTATATE_Lutathera' | '131I-Sodium_Iodide' | '90Y-Microspheres_SIRT';
  cycleNumber: number;
  eGfrMlMin?: number;
  plateletsKPerUl?: number;
  ancKPerUl?: number;
  tshMiuPerL?: number;
  lungShuntFractionPercent?: number;
}

export interface TheranosticProtocolResult {
  radiopharmaceutical: string;
  cycleNumber: number;
  standardDoseGbq: number;
  standardDoseMci: number;
  intervalWeeks: number;
  isEligibleForDosing: boolean;
  eligibilityAlerts: string[];
  mandatoryPremedications: string[];
  mandatoryNephroprotection: string | null;
  clinicalDirectives: string[];
}

export interface DecayAndReleaseInput {
  radiopharmaceutical: '177Lu' | '131I' | '90Y' | '68Ga';
  initialActivityGbq: number;
  hoursElapsed: number;
  initial1mDoseRateUsvHr: number; // e.g. 80 uSv/hr
}

export interface DecayAndReleaseResult {
  halfLifeHours: number;
  retainedActivityGbq: number;
  retainedActivityMci: number;
  current1mDoseRateUsvHr: number;
  nrcReleaseCriteriaMet: boolean; // NRC limit: <= 50 uSv/hr (5 mrem/hr) at 1 meter
  hoursUntilNrcRelease: number;
  radiationSafetyPrecautions: string[];
}

/**
 * 1. Linear-Quadratic Radiobiology Model (BED & EQD2)
 */
export function calculateRadiobiology(input: RadiobiologyInput): RadiobiologyResult {
  const d = input.physicalDoseGy / Math.max(input.fractionCount, 1);
  const abTumor = input.alphaBetaRatioTumor;
  const abOar = input.alphaBetaRatioOar || 3.0;

  // BED = D * (1 + d / (a/b))
  const bedTumor = input.physicalDoseGy * (1 + (d / abTumor));
  // EQD2 = BED / (1 + 2 / (a/b)) = D * (d + a/b) / (2 + a/b)
  const eqd2Tumor = input.physicalDoseGy * ((d + abTumor) / (2 + abTumor));

  const bedOar = input.physicalDoseGy * (1 + (d / abOar));
  const eqd2Oar = input.physicalDoseGy * ((d + abOar) / (2 + abOar));

  let interpretation = 'Standard fractionation schedule.';
  if (d >= 5.0) {
    interpretation = `Stereotactic Ablative Radiotherapy (SABR / SBRT / SRS) hypofractionated regimen with high fractional dose (${Math.round(d * 10) / 10} Gy/fx). EQD2 tumor potency is significantly amplified (${Math.round(eqd2Tumor * 10) / 10} Gy vs ${input.physicalDoseGy} Gy physical).`;
  } else if (d > 2.2) {
    interpretation = `Moderately hypofractionated radiotherapy (${Math.round(d * 10) / 10} Gy/fx).`;
  }

  return {
    physicalDoseGy: Math.round(input.physicalDoseGy * 10) / 10,
    fractionCount: input.fractionCount,
    dosePerFractionGy: Math.round(d * 100) / 100,
    alphaBetaRatioTumor: abTumor,
    bedTumorGy: Math.round(bedTumor * 10) / 10,
    eqd2TumorGy: Math.round(eqd2Tumor * 10) / 10,
    alphaBetaRatioOar: abOar,
    bedOarGy: Math.round(bedOar * 10) / 10,
    eqd2OarGy: Math.round(eqd2Oar * 10) / 10,
    clinicalInterpretation: interpretation
  };
}

/**
 * 2. QUANTEC Normal Tissue Constraint Evaluator
 */
export function evaluateQuantecConstraints(input: QuantecOrganInput): QuantecAssessmentResult {
  let isCompliant = true;
  let standard = '';
  let measured = '';
  let riskAlert: string | null = null;
  let toxicityRiskLevel: 'Negligible' | 'Borderline' | 'High Risk of Severe Toxicity' = 'Negligible';

  switch (input.organ) {
    case 'Spinal_Cord':
      standard = 'Max Dose < 45 - 50 Gy (EQD2_3) [Myelopathy risk < 0.2%]';
      measured = `Max Dose: ${input.maxDoseGy || 0} Gy`;
      if ((input.maxDoseGy || 0) >= 50) {
        isCompliant = false;
        toxicityRiskLevel = 'High Risk of Severe Toxicity';
        riskAlert = `CRITICAL CORD OVERDOSE: Max dose ${input.maxDoseGy} Gy exceeds 50 Gy threshold. High risk of radiation myelopathy and paraplegia!`;
      } else if ((input.maxDoseGy || 0) >= 45) {
        toxicityRiskLevel = 'Borderline';
        riskAlert = `CAUTION: Max dose ${input.maxDoseGy} Gy approaches spinal cord tolerance limit (45-50 Gy).`;
      }
      break;

    case 'Brainstem':
      standard = 'Max Dose < 54 Gy [Neuropathy/necrosis risk < 5%]';
      measured = `Max Dose: ${input.maxDoseGy || 0} Gy`;
      if ((input.maxDoseGy || 0) > 54) {
        isCompliant = false;
        toxicityRiskLevel = 'High Risk of Severe Toxicity';
        riskAlert = `BRAINSTEM OVERDOSE: Max dose ${input.maxDoseGy} Gy exceeds 54 Gy tolerance. Risk of cranial neuropathies and focal brainstem necrosis.`;
      }
      break;

    case 'Optic_Chiasm_Nerve':
      standard = 'Max Dose < 54 - 55 Gy [Radiation optic neuropathy (RION) risk < 3%]';
      measured = `Max Dose: ${input.maxDoseGy || 0} Gy`;
      if ((input.maxDoseGy || 0) > 55) {
        isCompliant = false;
        toxicityRiskLevel = 'High Risk of Severe Toxicity';
        riskAlert = `OPTIC APPARATUS OVERDOSE: Max dose ${input.maxDoseGy} Gy exceeds 55 Gy. High risk of irreversible blindness (RION).`;
      }
      break;

    case 'Kidneys_Bilateral':
      standard = 'Mean Dose < 15 - 18 Gy OR V20 < 30% [Clinical nephropathy < 5%]';
      measured = `Mean Dose: ${input.meanDoseGy || 0} Gy, V20: ${input.volumeAboveThresholdPercent || 0}%`;
      if ((input.meanDoseGy || 0) > 18 || (input.volumeAboveThresholdPercent || 0) > 32) {
        isCompliant = false;
        toxicityRiskLevel = 'High Risk of Severe Toxicity';
        riskAlert = `RADIATION NEPHROPATHY RISK: Mean bilateral kidney dose ${input.meanDoseGy} Gy > 18 Gy or V20 > 30%. Risk of chronic renal failure.`;
      }
      break;

    case 'Lungs':
      standard = 'Mean Lung Dose < 20 Gy, V20 < 30 - 35% [Symptomatic pneumonitis < 20%]';
      measured = `Mean Dose: ${input.meanDoseGy || 0} Gy, V20: ${input.volumeAboveThresholdPercent || 0}%`;
      if ((input.meanDoseGy || 0) > 20 || (input.volumeAboveThresholdPercent || 0) > 35) {
        isCompliant = false;
        toxicityRiskLevel = 'High Risk of Severe Toxicity';
        riskAlert = `RADIATION PNEUMONITIS RISK: Mean lung dose ${input.meanDoseGy} Gy > 20 Gy or V20 > 35%. High risk of steroid-dependent pneumonitis.`;
      }
      break;

    case 'Heart':
      standard = 'Mean Dose < 26 Gy, V30 < 46% [Long-term cardiac mortality < 1%]';
      measured = `Mean Dose: ${input.meanDoseGy || 0} Gy, V30: ${input.volumeAboveThresholdPercent || 0}%`;
      if ((input.meanDoseGy || 0) > 26 || (input.volumeAboveThresholdPercent || 0) > 46) {
        isCompliant = false;
        toxicityRiskLevel = 'High Risk of Severe Toxicity';
        riskAlert = `CARDIOTOXICITY ALERT: Mean heart dose ${input.meanDoseGy} Gy > 26 Gy. High risk of late ischemic heart disease / pericarditis.`;
      }
      break;

    case 'Rectum':
      standard = 'V50 < 50%, V70 < 20% [Grade ≥ 2 late rectal toxicity < 10%]';
      measured = `V50/V70: ${input.volumeAboveThresholdPercent || 0}%`;
      if ((input.volumeThresholdGy || 70) >= 70 && (input.volumeAboveThresholdPercent || 0) > 20) {
        isCompliant = false;
        toxicityRiskLevel = 'High Risk of Severe Toxicity';
        riskAlert = `PROCTITIS OVERDOSE: Rectal V70 ${input.volumeAboveThresholdPercent}% exceeds 20% limit. High risk of chronic radiation proctitis/ulceration.`;
      }
      break;
  }

  return {
    organ: input.organ.replace(/_/g, ' '),
    isCompliant,
    quantecStandard: standard,
    measuredMetric: measured,
    riskAlert,
    toxicityRiskLevel
  };
}

/**
 * 3. Targeted Theranostic Protocol Evaluator
 */
export function evaluateTheranosticProtocol(input: TheranosticProtocolInput): TheranosticProtocolResult {
  const alerts: string[] = [];
  let isEligible = true;

  if (input.radiopharmaceutical === '177Lu-PSMA-617_Pluvicto') {
    if (input.eGfrMlMin !== undefined && input.eGfrMlMin < 30) {
      isEligible = false;
      alerts.push(`Renal safety contraindication: eGFR ${input.eGfrMlMin} mL/min < 30 mL/min threshold.`);
    }
    if (input.plateletsKPerUl !== undefined && input.plateletsKPerUl < 75) {
      isEligible = false;
      alerts.push(`Hematologic safety contraindication: Platelets ${input.plateletsKPerUl}k/uL < 75k/uL.`);
    }
    if (input.ancKPerUl !== undefined && input.ancKPerUl < 1.5) {
      isEligible = false;
      alerts.push(`Hematologic safety contraindication: Absolute Neutrophil Count ${input.ancKPerUl}k/uL < 1.5k/uL.`);
    }

    return {
      radiopharmaceutical: '177Lu-PSMA-617 (Pluvicto)',
      cycleNumber: input.cycleNumber,
      standardDoseGbq: 7.4,
      standardDoseMci: 200,
      intervalWeeks: 6,
      isEligibleForDosing: isEligible,
      eligibilityAlerts: alerts,
      mandatoryPremedications: [
        'Ondansetron 8 mg IV 30-60 min prior to radiopharmaceutical',
        'Dexamethasone 4 mg IV (antiemetic & radiation-induced nausea prophylaxis)',
        'Hydration: 500 mL 0.9% NaCl IV starting 30 min pre-infusion'
      ],
      mandatoryNephroprotection: null,
      clinicalDirectives: [
        'Verify PSMA-positive metastatic castration-resistant prostate cancer on 68Ga-PSMA-11 or 18F-DCFPyL PET/CT prior to cycle 1',
        'Infuse 177Lu-PSMA-617 (7.4 GBq / 200 mCi) IV slowly over 1-10 minutes',
        'Perform whole-body SPECT/CT 24h post-infusion to confirm tumor biodistribution and dosimetry',
        'Repeat CBC, eGFR, AST/ALT, and PSA q4-6 weeks prior to each subsequent cycle (up to 6 cycles maximum)'
      ]
    };
  }

  if (input.radiopharmaceutical === '177Lu-DOTATATE_Lutathera') {
    if (input.eGfrMlMin !== undefined && input.eGfrMlMin < 30) {
      isEligible = false;
      alerts.push(`Renal safety contraindication: eGFR ${input.eGfrMlMin} mL/min < 30 mL/min.`);
    }
    if (input.plateletsKPerUl !== undefined && input.plateletsKPerUl < 75) {
      isEligible = false;
      alerts.push(`Hematologic safety contraindication: Platelets ${input.plateletsKPerUl}k/uL < 75k/uL.`);
    }

    return {
      radiopharmaceutical: '177Lu-DOTATATE (Lutathera)',
      cycleNumber: input.cycleNumber,
      standardDoseGbq: 7.4,
      standardDoseMci: 200,
      intervalWeeks: 8,
      isEligibleForDosing: isEligible,
      eligibilityAlerts: alerts,
      mandatoryPremedications: [
        'Ondansetron 8 mg IV or Granisetron 1 mg IV 30 min prior to amino acid infusion',
        'Aprepitant 125 mg PO 1 hr prior (prevents amino-acid induced hyperemesis)'
      ],
      mandatoryNephroprotection: 'MANDATORY: Co-infusion of Amino Acid Solution (2.5% Lysine + 2.5% L-Arginine in 1000 mL 0.9% NaCl). Initiate 30 min PRIOR to Lutathera and continue at 250 mL/hr for 4 hours total (blocks renal tubular peptide uptake).',
      clinicalDirectives: [
        'Verify somatostatin receptor (SSTR) overexpression on 68Ga-DOTATATE PET/CT',
        'Hold long-acting somatostatin analogs (octreotide LAR) for minimum 4 weeks prior to cycle',
        'Infuse 177Lu-DOTATATE (7.4 GBq / 200 mCi) IV over 30 minutes in dedicated secondary IV line concurrently with amino acids',
        'Post-treatment dosimetry SPECT/CT within 24 hours'
      ]
    };
  }

  if (input.radiopharmaceutical === '131I-Sodium_Iodide') {
    if (input.tshMiuPerL !== undefined && input.tshMiuPerL < 30) {
      isEligible = false;
      alerts.push(`Inadequate TSH stimulation: TSH ${input.tshMiuPerL} mIU/L is < 30 mIU/L requirement (inadequate thyroid iodine avidity).`);
    }

    return {
      radiopharmaceutical: '131I-Sodium Iodide (Radioiodine)',
      cycleNumber: input.cycleNumber,
      standardDoseGbq: 3.7, // ~100 mCi
      standardDoseMci: 100,
      intervalWeeks: 24,
      isEligibleForDosing: isEligible,
      eligibilityAlerts: alerts,
      mandatoryPremedications: [
        'Strict Low-Iodine Diet (< 50 mcg/day) for 14 days pre-ablation',
        'Recombinant human TSH (Thyrogen) 0.9 mg IM daily x 2 doses (or 4-6 week thyroid hormone withdrawal)',
        'Negative serum pregnancy test within 24 hours of administration'
      ],
      mandatoryNephroprotection: null,
      clinicalDirectives: [
        'Maintain aggressive oral hydration (3-4 L/day) and frequent voiding to reduce bladder radiation dose',
        'Encourage sour candies (lemon drops) starting 24h post-administration to protect salivary glands against radiation sialadenitis',
        'Strict radioactive isolation in lead-shielded inpatient room until 1-meter dose rate meets NRC release threshold'
      ]
    };
  }

  // 90Y-Microspheres
  if (input.lungShuntFractionPercent !== undefined && input.lungShuntFractionPercent > 20) {
    isEligible = false;
    alerts.push(`Lung Shunt Fraction ${input.lungShuntFractionPercent}% exceeds 20% limit (fatal radiation pneumonitis risk).`);
  }

  return {
    radiopharmaceutical: '90Y-Microspheres (Selective Internal Radiation Therapy - SIRT)',
    cycleNumber: input.cycleNumber,
    standardDoseGbq: 2.5,
    standardDoseMci: 67.5,
    intervalWeeks: 12,
    isEligibleForDosing: isEligible,
    eligibilityAlerts: alerts,
    mandatoryPremedications: [
      'Proton Pump Inhibitor (e.g. Pantoprazole 40 mg PO daily) for gastric ulcer prophylaxis',
      'Hepatic angiogram with coil embolization of gastroduodenal/falciform arteries to prevent non-target extrahepatic deposition'
    ],
    mandatoryNephroprotection: null,
    clinicalDirectives: [
      'Transarterial microcatheter delivery directly into tumor-feeding lobar hepatic arteries in Interventional Radiology',
      'Bremsstrahlung SPECT/CT or PET/CT within 24 hours to confirm tumoral microsphere retention',
      'Monitor for Post-Embolization Syndrome (fatigue, mild abdominal pain, low-grade fever)'
    ]
  };
}

/**
 * 4. Radioactive Decay & NRC Patient Release Watchdog
 */
export function calculateDecayAndRelease(input: DecayAndReleaseInput): DecayAndReleaseResult {
  const halfLives: Record<string, number> = {
    '177Lu': 159.5, // 6.647 days
    '131I': 192.5,  // 8.02 days
    '90Y': 64.1,    // 2.67 days
    '68Ga': 1.13    // 67.7 min (1.13 hours)
  };

  const tHalf = halfLives[input.radiopharmaceutical] || 150;
  
  // A(t) = A0 * (0.5)^(t / tHalf)
  const decayFraction = Math.pow(0.5, input.hoursElapsed / tHalf);
  const retainedGbq = Math.round(input.initialActivityGbq * decayFraction * 1000) / 1000;
  const retainedMci = Math.round(retainedGbq * 27.027 * 10) / 10;

  // 1-meter dose rate decays proportionately: D_dot(t) = D_dot_0 * decayFraction
  const current1mRate = Math.round(input.initial1mDoseRateUsvHr * decayFraction * 10) / 10;

  // NRC Regulatory Guide 8.39 Limit: 50 uSv/hr (5 mrem/hr) at 1 meter
  const nrcLimit = 50.0;
  const nrcReleaseCriteriaMet = current1mRate <= nrcLimit;

  // Hours until release: D_dot_0 * (0.5)^(t / tHalf) = 50 -> t = tHalf * log2(D_dot_0 / 50)
  let hoursUntilRelease = 0;
  if (input.initial1mDoseRateUsvHr > nrcLimit) {
    const ratio = input.initial1mDoseRateUsvHr / nrcLimit;
    const requiredTotalHours = tHalf * (Math.log(ratio) / Math.log(2));
    hoursUntilRelease = Math.max(0, Math.round((requiredTotalHours - input.hoursElapsed) * 10) / 10);
  }

  const safetyPrecautions: string[] = [
    'Maintain minimum 2 meters (6 feet) distance from pregnant women and children under 18 years for 3-7 days',
    'Sleep in a separate bedroom on dedicated bedding for 3-5 days',
    'Use dedicated bathroom facilities; sit during urination and double-flush toilet after each use',
    'Wash patient clothing, bed linens, and towels separately from other household laundry',
    'Wash hands thoroughly with soap and warm water for at least 30 seconds after using bathroom'
  ];

  if (!nrcReleaseCriteriaMet) {
    safetyPrecautions.unshift(`INPATIENT SHIELDED ISOLATION REQUIRED: Current 1-meter dose rate (${current1mRate} µSv/hr) exceeds NRC 50 µSv/hr release limit.`);
  }

  return {
    halfLifeHours: tHalf,
    retainedActivityGbq: retainedGbq,
    retainedActivityMci: retainedMci,
    current1mDoseRateUsvHr: current1mRate,
    nrcReleaseCriteriaMet,
    hoursUntilNrcRelease: hoursUntilRelease,
    radiationSafetyPrecautions: safetyPrecautions
  };
}

/**
 * 5. Database Persistence & Query Helpers
 */
export async function createRadiationPlan(data: {
  patientId: number;
  tumorSite: string;
  prescribedPhysicalDoseGy: number;
  fractionCount: number;
  dosePerFractionGy: number;
  alphaBetaRatioTumor: number;
  bedTumorGy: number;
  eqd2TumorGy: number;
  quantecConstraintsChecked?: any;
}) {
  const result = await pool.query(
    `INSERT INTO radiation_treatment_plans (
      patient_id, tumor_site, prescribed_physical_dose_gy, fraction_count,
      dose_per_fraction_gy, alpha_beta_ratio_tumor, bed_tumor_gy, eqd2_tumor_gy,
      quantec_constraints_checked
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [
      data.patientId,
      data.tumorSite,
      data.prescribedPhysicalDoseGy,
      data.fractionCount,
      data.dosePerFractionGy,
      data.alphaBetaRatioTumor,
      data.bedTumorGy,
      data.eqd2TumorGy,
      data.quantecConstraintsChecked ? JSON.stringify(data.quantecConstraintsChecked) : null
    ]
  );
  return result.rows[0];
}

export async function recordTheranosticCycle(data: {
  patientId: number;
  radiopharmaceutical: string;
  cycleNumber: number;
  administeredActivityGbq: number;
  administeredActivityMci: number;
  aminoAcidNephroprotectionUsed?: boolean;
  postAdmin1mDoseRateUsvHr?: number;
  nrcReleaseCriteriaMet?: boolean;
  isolationPrecautionsHours: number;
}) {
  const result = await pool.query(
    `INSERT INTO theranostic_cycles (
      patient_id, radiopharmaceutical, cycle_number, administered_activity_gbq,
      administered_activity_mci, amino_acid_nephroprotection_used, post_admin_1m_dose_rate_usv_hr,
      nrc_release_criteria_met, isolation_precautions_hours
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [
      data.patientId,
      data.radiopharmaceutical,
      data.cycleNumber,
      data.administeredActivityGbq,
      data.administeredActivityMci,
      data.aminoAcidNephroprotectionUsed !== undefined ? data.aminoAcidNephroprotectionUsed : true,
      data.postAdmin1mDoseRateUsvHr || null,
      data.nrcReleaseCriteriaMet || false,
      data.isolationPrecautionsHours
    ]
  );
  return result.rows[0];
}

export async function getTheranosticCycleDetails(cycleId: number) {
  const res = await pool.query(`SELECT * FROM theranostic_cycles WHERE id = $1`, [cycleId]);
  return res.rows.length > 0 ? res.rows[0] : null;
}

export async function listActiveTheranosticCycles(limit: number = 20) {
  const res = await pool.query(`SELECT * FROM theranostic_cycles ORDER BY administration_timestamp DESC LIMIT $1`, [limit]);
  return res.rows;
}

export async function listRadiationPlans(limit: number = 20) {
  const res = await pool.query(`SELECT * FROM radiation_treatment_plans ORDER BY created_at DESC LIMIT $1`, [limit]);
  return res.rows;
}
