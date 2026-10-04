import { pool } from '../db';

export interface VitalsAndExam {
  heartRate: number;
  systolicBp: number;
  diastolicBp: number;
  respiratoryRate: number;
  temperatureC: number;
  pupilSize: 'miosis' | 'normal' | 'mydriasis';
  skinExam: 'diaphoretic' | 'dry_warm' | 'normal' | 'cyanotic';
  bowelSounds: 'hyperactive' | 'normoactive' | 'hypoactive' | 'absent';
  mentalStatus: 'alert' | 'somnolent' | 'coma' | 'delirium' | 'agitated';
  seizurePresent?: boolean;
}

export interface ToxidromeResult {
  toxidrome: 'Anticholinergic' | 'Cholinergic' | 'Sympathomimetic' | 'Opioid' | 'Sedative-Hypnotic' | 'Undifferentiated';
  confidence: number;
  classicFeatures: string[];
  primaryAntidote: string;
  contraindicationsAlert: string | null;
  treatmentRecommendations: string[];
}

export interface HunterCriteriaInput {
  serotonergicAgentPresent: boolean;
  spontaneousClonus: boolean;
  inducibleClonus: boolean;
  ocularClonus: boolean;
  agitation: boolean;
  diaphoresis: boolean;
  tremor: boolean;
  hyperreflexia: boolean;
  hypertonia: boolean;
  temperatureC: number;
}

export interface HunterCriteriaResult {
  isSerotoninSyndrome: boolean;
  criteriaMet: string[];
  severity: 'mild' | 'moderate' | 'severe_life_threatening';
  interventions: string[];
}

export interface ApapNomogramResult {
  hoursPostIngestion: number;
  apapConcentrationMcgPerMl: number;
  treatmentThresholdNomogram: number;
  highRiskThresholdNomogram: number;
  nacIndicated: boolean;
  riskCategory: 'Below_Nomogram' | 'Possible_Hepatotoxicity' | 'High_Risk_Severe_Hepatotoxicity' | 'Uninterpretable_Early' | 'Delayed_Presentation';
  nacIvRegimen21Hour: {
    bag1Loading: { doseMg: number; fluid: string; durationHours: number; rateMlPerHour: number };
    bag2Second: { doseMg: number; fluid: string; durationHours: number; rateMlPerHour: number };
    bag3Maintenance: { doseMg: number; fluid: string; durationHours: number; rateMlPerHour: number };
    totalDoseMg: number;
  };
  monitoringRecommendations: string[];
}

export interface SalicylateAssessmentResult {
  salicylateLevelMgPerDl: number;
  severity: 'Therapeutic' | 'Mild' | 'Moderate' | 'Severe';
  bicarbonateAlkalinizationRegimen: {
    bolusDoseMeq: number;
    infusionDrip: string;
    targetUrinePh: string;
    targetBloodPh: string;
    potassiumTargetMeqPerL: string;
  };
  hemodialysisIndicated: boolean;
  hemodialysisReasons: string[];
  clinicalDirectives: string[];
}

export interface ToxicAlcoholResult {
  suspectedAlcohol: string;
  measuredOsmolality: number;
  calculatedOsmolality: number;
  osmolarGap: number;
  isElevatedOsmolarGap: boolean;
  fomepizoleIndicated: boolean;
  fomepizoleLoadingDoseMg: number;
  fomepizoleMaintenanceDoseMg: number;
  hemodialysisIndicated: boolean;
  adjunctiveTherapies: string[];
  clinicalDirectives: string[];
}

export interface DigiFabResult {
  scenario: string;
  vialsRecommended: number;
  mgFabTotal: number;
  administrationInstructions: string;
  hyperkalemiaWarning: string | null;
}

/**
 * 1. Toxidrome Classification Engine
 */
export function classifyToxidrome(vitals: VitalsAndExam): ToxidromeResult {
  const hr = vitals.heartRate;
  const temp = vitals.temperatureC;
  const pupils = vitals.pupilSize;
  const skin = vitals.skinExam;
  const bowel = vitals.bowelSounds;
  const mental = vitals.mentalStatus;
  const rr = vitals.respiratoryRate;

  // Anticholinergic: Hot, Red, Dry, Blind (mydriasis), Mad (delirium), Tachycardia, Absent bowel sounds
  if (pupils === 'mydriasis' && skin === 'dry_warm' && (bowel === 'absent' || bowel === 'hypoactive') && hr > 95) {
    return {
      toxidrome: 'Anticholinergic',
      confidence: 94,
      classicFeatures: [
        'Mydriasis (dilated pupils)',
        'Anhidrosis (warm, dry skin)',
        'Decreased/absent bowel sounds',
        'Tachycardia',
        'Delirium / hallucinations ("Mad as a hatter")'
      ],
      primaryAntidote: 'Physostigmine (1-2 mg IV slow over 5 min)',
      contraindicationsAlert: 'CONTRAINDICATED if suspected Tricyclic Antidepressant (TCA) overdose or QRS prolongation > 100ms (risk of asystolic cardiac arrest).',
      treatmentRecommendations: [
        'Obtain 12-lead EKG immediately to rule out QRS/QTc prolongation',
        'Place Foley catheter (assess for severe urinary retention)',
        'Control agitation with Benzodiazepines (e.g. Diazepam 5-10 mg or Lorazepam 2-4 mg IV)',
        'Active physical cooling if hyperthermic (avoid antipyretics)'
      ]
    };
  }

  // Cholinergic: SLUDGEM (Salivation, Lacrimation, Urination, Defecation, GI upset, Emesis, Miosis, Bronchorrhea/Bradycardia)
  if (pupils === 'miosis' && skin === 'diaphoretic' && (bowel === 'hyperactive' || vitals.seizurePresent) && (hr < 65 || rr > 24)) {
    return {
      toxidrome: 'Cholinergic',
      confidence: 92,
      classicFeatures: [
        'Miosis (pinpoint pupils)',
        'Diaphoresis and excessive lacrimation/salivation',
        'Hyperactive bowel sounds / diarrhea',
        'Bronchorrhea, bronchospasm, respiratory compromise'
      ],
      primaryAntidote: 'Atropine (2-5 mg IV q3-5min doubled until pulmonary secretions clear) + Pralidoxime (2-PAM 1-2 g IV over 30 min)',
      contraindicationsAlert: 'Do NOT rely on heart rate or pupil size as endpoint; titrate Atropine exclusively to clearing of tracheobronchial secretions.',
      treatmentRecommendations: [
        'Decontaminate skin immediately; discard all contaminated clothing',
        'Ensure PPE (gloves, gown, charcoal respirator) for resuscitation team',
        'Early intubation with non-depolarizing paralytic if severe bronchorrhea (avoid Succinylcholine due to prolonged block)',
        'Continuous pulse oximetry and end-tidal CO2 capnography'
      ]
    };
  }

  // Opioid: Miosis, CNS depression, hypoventilation, bradycardia
  if (pupils === 'miosis' && (mental === 'somnolent' || mental === 'coma') && rr < 12) {
    return {
      toxidrome: 'Opioid',
      confidence: 96,
      classicFeatures: [
        'Severe respiratory depression (RR < 12/min)',
        'Miosis (pinpoint pupils)',
        'Coma / profound CNS depression',
        'Hypothermia and hyporeflexia'
      ],
      primaryAntidote: 'Naloxone (0.04 - 0.4 mg IV initial titration, up to 2 mg for synthetic opioids like Fentanyl)',
      contraindicationsAlert: 'Titrate to adequate spontaneous respirations (>10/min), NOT complete alertness, to prevent acute precipitated withdrawal agitation.',
      treatmentRecommendations: [
        'Support bag-valve-mask ventilation with 100% FiO2 prior to antidote',
        'Re-dose Naloxone or start continuous infusion (2/3 of awakening dose per hour) if long-acting opioid (e.g. Methadone)',
        'Observe for minimum 4-6 hours post-administration (re-sedation sentinel)'
      ]
    };
  }

  // Sympathomimetic: Tachycardia, hypertension, mydriasis, diaphoresis (distinguishes from anticholinergic), hyperthermia
  if (pupils === 'mydriasis' && skin === 'diaphoretic' && hr > 105) {
    return {
      toxidrome: 'Sympathomimetic',
      confidence: 90,
      classicFeatures: [
        'Tachycardia and severe hypertension',
        'Mydriasis',
        'Diaphoresis (wet skin, differentiating from anticholinergic)',
        'Psychomotor agitation, delirium, paranoia',
        'Hyperthermia risk'
      ],
      primaryAntidote: 'Benzodiazepines IV (Lorazepam 2-4 mg or Diazepam 5-10 mg repeated q10-15m)',
      contraindicationsAlert: 'AVOID pure beta-blockers (e.g., Propranolol) due to risk of unopposed alpha-1 stimulation causing hypertensive crisis and coronary spasm.',
      treatmentRecommendations: [
        'Aggressive sedation with intravenous Benzodiazepines to break adrenergic cascade',
        'Aggressive active cooling (ice bath / evaporative mist) if core temp > 39.0°C',
        'If hypertension refractory after benzos: Phentolamine or Nicardipine / Nitroprusside',
        'Monitor CPK and urine output for rhabdomyolysis'
      ]
    };
  }

  // Sedative-Hypnotic: Coma/somnolence, normal or depressed vitals, normal pupils
  if (mental === 'somnolent' || mental === 'coma') {
    return {
      toxidrome: 'Sedative-Hypnotic',
      confidence: 78,
      classicFeatures: [
        'CNS depression / somnolence / coma',
        'Normal to slurred speech, ataxia',
        'Relatively normal pupil size and vital signs unless massive co-ingestion'
      ],
      primaryAntidote: 'Supportive airway care (Flumazenil is GENERALLY CONTRAINDICATED in unknown overdose due to fatal refractory seizures)',
      contraindicationsAlert: 'Flumazenil carries high risk of refractory status epilepticus and arrhythmia in chronic benzo users or TCA co-ingestion.',
      treatmentRecommendations: [
        'Airway protection and aspiration precautions',
        'Serial neurological checks and capnography monitoring',
        'Rule out hypoglycemia (rapid fingerstick glucose)',
        'Supportive IV fluids'
      ]
    };
  }

  return {
    toxidrome: 'Undifferentiated',
    confidence: 50,
    classicFeatures: ['Mixed or non-specific clinical signs; consider poly-substance ingestion or delayed absorption'],
    primaryAntidote: 'Supportive care, Naloxone trial if hypoventilating, Fingerstick glucose check',
    contraindicationsAlert: null,
    treatmentRecommendations: [
      'Comprehensive toxicology panel (APAP, Salicylate, Ethanol, ECG, Osmolar gap, Urine drug screen)',
      'Intravenous access and continuous cardiopulmonary monitoring',
      'Contact Regional Poison Control Center'
    ]
  };
}

/**
 * 2. Hunter Serotonin Toxicity Criteria
 */
export function evaluateHunterCriteria(input: HunterCriteriaInput): HunterCriteriaResult {
  const criteriaMet: string[] = [];

  if (!input.serotonergicAgentPresent) {
    return {
      isSerotoninSyndrome: false,
      criteriaMet: ['No serotonergic agent identified'],
      severity: 'mild',
      interventions: ['Evaluate alternative causes of hyperadrenergic or altered mental state']
    };
  }

  let positive = false;

  if (input.spontaneousClonus) {
    positive = true;
    criteriaMet.push('Spontaneous clonus present (Pathognomonic)');
  } else if (input.inducibleClonus && (input.agitation || input.diaphoresis)) {
    positive = true;
    criteriaMet.push('Inducible clonus WITH Agitation or Diaphoresis');
  } else if (input.ocularClonus && (input.agitation || input.diaphoresis)) {
    positive = true;
    criteriaMet.push('Ocular clonus WITH Agitation or Diaphoresis');
  } else if (input.tremor && input.hyperreflexia) {
    positive = true;
    criteriaMet.push('Tremor WITH Hyperreflexia');
  } else if (input.hypertonia && input.temperatureC > 38.0 && (input.ocularClonus || input.inducibleClonus)) {
    positive = true;
    criteriaMet.push('Hypertonia + Hyperthermia (>38.0°C) WITH Ocular or Inducible Clonus');
  }

  let severity: 'mild' | 'moderate' | 'severe_life_threatening' = 'mild';
  if (positive) {
    if (input.temperatureC >= 39.0 || input.hypertonia || input.spontaneousClonus) {
      severity = 'severe_life_threatening';
    } else if (input.temperatureC > 38.0 || input.agitation) {
      severity = 'moderate';
    }
  }

  const interventions: string[] = [
    'Immediately discontinue all serotonergic medications (SSRIs, SNRIs, MAOIs, Triptans, Tramadol, Linezolid)',
    'Intravenous Benzodiazepines (e.g. Lorazepam 2-4 mg IV) for neuromuscular agitation',
    'Cyproheptadine: 12 mg initial oral/NG dose, followed by 2 mg q2h if symptoms persist (maintenance 4-8 mg q6h)'
  ];

  if (severity === 'severe_life_threatening') {
    interventions.unshift('EMERGENCY: Immediate endotracheal intubation, neuromuscular paralysis with Vecuronium/Rocuronium (AVOID Succinylcholine), and aggressive active cooling');
  }

  return {
    isSerotoninSyndrome: positive,
    criteriaMet: positive ? criteriaMet : ['Hunter criteria negative; symptoms do not fulfill diagnostic threshold'],
    severity,
    interventions
  };
}

/**
 * 3. Rumack-Matthew APAP Nomogram & 21-Hour IV NAC Protocol
 */
export function evaluateAcetaminophenToxicity(
  hoursPostIngestion: number,
  apapConcentrationMcgPerMl: number,
  weightKg: number
): ApapNomogramResult {
  // Cap dosing weight at 100 kg per toxicology guidelines
  const dosingWeight = Math.min(weightKg, 100);

  // Bag 1: 150 mg/kg over 60 min
  const bag1DoseMg = Math.round(dosingWeight * 150);
  // Bag 2: 50 mg/kg over 4 hours
  const bag2DoseMg = Math.round(dosingWeight * 50);
  // Bag 3: 100 mg/kg over 16 hours
  const bag3DoseMg = Math.round(dosingWeight * 100);
  const totalDoseMg = bag1DoseMg + bag2DoseMg + bag3DoseMg;

  const nacIvRegimen = {
    bag1Loading: {
      doseMg: bag1DoseMg,
      fluid: '200 mL D5W (or 0.45% NaCl)',
      durationHours: 1,
      rateMlPerHour: 200
    },
    bag2Second: {
      doseMg: bag2DoseMg,
      fluid: '500 mL D5W',
      durationHours: 4,
      rateMlPerHour: 125
    },
    bag3Maintenance: {
      doseMg: bag3DoseMg,
      fluid: '1000 mL D5W',
      durationHours: 16,
      rateMlPerHour: 62.5
    },
    totalDoseMg
  };

  const monitoringRecs = [
    'Check AST, ALT, Total Bilirubin, INR, and Serum Creatinine at baseline and near end of 21-hr infusion (hour 20)',
    'Do NOT stop NAC at 21 hours if ALT/AST are elevated and rising, or INR > 1.3, or APAP is still detectable (>10 mcg/mL)',
    'If anaphylactoid reaction occurs (flushing/urticaria): hold infusion briefly, administer Diphenhydramine 50 mg IV, restart at slower rate'
  ];

  // Cases < 4 hours: level cannot be interpreted on nomogram
  if (hoursPostIngestion < 4) {
    return {
      hoursPostIngestion,
      apapConcentrationMcgPerMl,
      treatmentThresholdNomogram: 150,
      highRiskThresholdNomogram: 300,
      nacIndicated: apapConcentrationMcgPerMl >= 150,
      riskCategory: 'Uninterpretable_Early',
      nacIvRegimen21Hour: nacIvRegimen,
      monitoringRecommendations: [
        'Repeat serum APAP level at EXACTLY 4 hours post-ingestion to plot on Rumack-Matthew nomogram',
        ...monitoringRecs
      ]
    };
  }

  // Cases > 24 hours: Delayed presentation
  if (hoursPostIngestion > 24) {
    const nacNeeded = apapConcentrationMcgPerMl > 5;
    return {
      hoursPostIngestion,
      apapConcentrationMcgPerMl,
      treatmentThresholdNomogram: 4.7,
      highRiskThresholdNomogram: 9.4,
      nacIndicated: nacNeeded,
      riskCategory: 'Delayed_Presentation',
      nacIvRegimen21Hour: nacIvRegimen,
      monitoringRecommendations: [
        'Delayed APAP presentation: Administer NAC immediately if APAP detectable or any hepatic transaminase elevation',
        'Assess for fulminant hepatic failure criteria (Kings College Criteria for liver transplantation)',
        ...monitoringRecs
      ]
    };
  }

  // Rumack-Matthew formula:
  // Treatment Line: 150 mcg/mL at 4 hr; half-life line = 4 hr -> C(t) = 150 * (0.5)^((t-4)/4)
  const treatmentLine = 150 * Math.pow(0.5, (hoursPostIngestion - 4) / 4);
  const highRiskLine = 300 * Math.pow(0.5, (hoursPostIngestion - 4) / 4);

  const nacIndicated = apapConcentrationMcgPerMl >= treatmentLine;
  let riskCategory: 'Below_Nomogram' | 'Possible_Hepatotoxicity' | 'High_Risk_Severe_Hepatotoxicity' = 'Below_Nomogram';

  if (apapConcentrationMcgPerMl >= highRiskLine) {
    riskCategory = 'High_Risk_Severe_Hepatotoxicity';
  } else if (apapConcentrationMcgPerMl >= treatmentLine) {
    riskCategory = 'Possible_Hepatotoxicity';
  }

  return {
    hoursPostIngestion,
    apapConcentrationMcgPerMl,
    treatmentThresholdNomogram: Math.round(treatmentLine * 10) / 10,
    highRiskThresholdNomogram: Math.round(highRiskLine * 10) / 10,
    nacIndicated,
    riskCategory,
    nacIvRegimen21Hour: nacIvRegimen,
    monitoringRecommendations: nacIndicated ? monitoringRecs : ['Repeat APAP in 2-4 hours if extended-release formulation ingested; otherwise discharge or psychiatric evaluation if asymptomatic']
  };
}

/**
 * 4. Salicylate Toxicity, Alkalinization & Hemodialysis Sentinel
 */
export function evaluateSalicylateToxicity(
  salicylateLevelMgPerDl: number,
  arterialPh: number,
  serumPotassiumMeqPerL: number,
  hasAlteredMentalStatus: boolean,
  hasPulmonaryEdema: boolean,
  hasRenalFailure: boolean,
  weightKg: number
): SalicylateAssessmentResult {
  let severity: 'Therapeutic' | 'Mild' | 'Moderate' | 'Severe' = 'Therapeutic';
  if (salicylateLevelMgPerDl >= 70) {
    severity = 'Severe';
  } else if (salicylateLevelMgPerDl >= 45) {
    severity = 'Moderate';
  } else if (salicylateLevelMgPerDl >= 30) {
    severity = 'Mild';
  }

  const bolusDoseMeq = Math.round(Math.min(weightKg, 100) * 1.5);
  const alkalinizationRegimen = {
    bolusDoseMeq,
    infusionDrip: '3 ampules (150 mEq) Sodium Bicarbonate in 1000 mL D5W at 150-250 mL/hr',
    targetUrinePh: '7.5 - 8.0 (measure q1-2h with test strip)',
    targetBloodPh: '7.45 - 7.55 (do NOT exceed 7.55)',
    potassiumTargetMeqPerL: 'Maintain serum K > 4.0 - 4.5 mEq/L (hypokalemia prevents urinary alkalinization due to H+/K+ renal exchange)'
  };

  const hemodialysisReasons: string[] = [];
  if (salicylateLevelMgPerDl >= 90) {
    hemodialysisReasons.push(`Critically high acute salicylate level (${salicylateLevelMgPerDl} mg/dL ≥ 90 mg/dL threshold)`);
  }
  if (hasAlteredMentalStatus) {
    hemodialysisReasons.push('Presence of central nervous system toxicity / cerebral edema (Altered Mental Status, seizures)');
  }
  if (hasPulmonaryEdema) {
    hemodialysisReasons.push('Non-cardiogenic pulmonary edema (contraindication to extensive fluid load for alkalinization)');
  }
  if (hasRenalFailure) {
    hemodialysisReasons.push('Acute kidney injury / failure preventing renal clearance of salicylate');
  }
  if (arterialPh < 7.20) {
    hemodialysisReasons.push(`Refractory severe acidemia (Arterial pH ${arterialPh} < 7.20)`);
  }

  const hemodialysisIndicated = hemodialysisReasons.length > 0;

  const clinicalDirectives: string[] = [
    'Serial salicylate levels q2h until consecutive levels show clear downward trajectory',
    'Serial blood gas monitoring (ABG/VBG) to titrate bicarbonate infusion without exceeding pH 7.55',
    'AVOID intubation if possible! If patient requires intubation, hyperventilate to match pre-intubation minute ventilation (respiratory alkalosis is vital compensatory mechanism; sudden hypoventilation causes fatal CSF salicylate influx)'
  ];

  if (serumPotassiumMeqPerL < 4.0) {
    clinicalDirectives.unshift(`URGENT: Add 20-40 mEq KCl to bicarbonate bag; current K+ is ${serumPotassiumMeqPerL} mEq/L (alkalinization WILL FAIL without adequate potassium)`);
  }

  return {
    salicylateLevelMgPerDl,
    severity,
    bicarbonateAlkalinizationRegimen: alkalinizationRegimen,
    hemodialysisIndicated,
    hemodialysisReasons,
    clinicalDirectives
  };
}

/**
 * 5. Toxic Alcohol Osmolar Gap & Fomepizole Protocol
 */
export function evaluateToxicAlcoholIngestion(
  suspectedAlcohol: 'METHANOL' | 'ETHYLENE_GLYCOL' | 'ISOPROPANOL' | 'UNKNOWN',
  measuredSerumOsmolality: number,
  sodiumMeqPerL: number,
  glucoseMgPerDl: number,
  bunMgPerDl: number,
  ethanolMgPerDl: number = 0,
  weightKg: number,
  arterialPh: number = 7.40
): ToxicAlcoholResult {
  // Calculated Osmolality = 2*Na + Glucose/18 + BUN/2.8 + EtOH/4.6
  const calcOsm = 2 * sodiumMeqPerL + (glucoseMgPerDl / 18) + (bunMgPerDl / 2.8) + (ethanolMgPerDl / 4.6);
  const roundedCalcOsm = Math.round(calcOsm * 10) / 10;
  const osmolarGap = Math.round((measuredSerumOsmolality - calcOsm) * 10) / 10;
  const isElevatedOsmolarGap = osmolarGap > 10;

  const dosingWeight = Math.min(weightKg, 100);
  const fomepizoleLoadingDoseMg = Math.round(dosingWeight * 15); // 15 mg/kg
  const fomepizoleMaintenanceDoseMg = Math.round(dosingWeight * 10); // 10 mg/kg q12h

  // Fomepizole indicated for Methanol/Ethylene Glycol with elevated gap or metabolic acidosis
  const fomepizoleIndicated = (suspectedAlcohol === 'METHANOL' || suspectedAlcohol === 'ETHYLENE_GLYCOL' || suspectedAlcohol === 'UNKNOWN') &&
    (isElevatedOsmolarGap || arterialPh < 7.30);

  const adjunctiveTherapies: string[] = [];
  if (suspectedAlcohol === 'METHANOL' || suspectedAlcohol === 'UNKNOWN') {
    adjunctiveTherapies.push('Folinic Acid (Leucovorin) 50 mg IV q4h OR Folic Acid 50 mg IV q4h (enhances nontoxic formate elimination)');
  }
  if (suspectedAlcohol === 'ETHYLENE_GLYCOL' || suspectedAlcohol === 'UNKNOWN') {
    adjunctiveTherapies.push('Thiamine 100 mg IV q6h + Pyridoxine (Vitamin B6) 50 mg IV q6h (diverts glyoxylate to nontoxic glycine/alpha-hydroxyketoadipate)');
  }
  if (suspectedAlcohol === 'ISOPROPANOL') {
    adjunctiveTherapies.push('Supportive care + IV hydration; Fomepizole is NOT indicated for Isopropanol (acetone metabolite is non-retinotoxic / non-nephrotoxic)');
  }

  const hemodialysisIndicated = osmolarGap > 25 || arterialPh < 7.15 || (suspectedAlcohol === 'METHANOL' && arterialPh < 7.25);

  return {
    suspectedAlcohol,
    measuredOsmolality: measuredSerumOsmolality,
    calculatedOsmolality: roundedCalcOsm,
    osmolarGap,
    isElevatedOsmolarGap,
    fomepizoleIndicated,
    fomepizoleLoadingDoseMg,
    fomepizoleMaintenanceDoseMg,
    hemodialysisIndicated,
    adjunctiveTherapies,
    clinicalDirectives: [
      fomepizoleIndicated ? `Administer Fomepizole loading dose ${fomepizoleLoadingDoseMg} mg IV over 30 min immediately` : 'Monitor osmolality and acid-base profile',
      'If Fomepizole unavailable, consider 10% IV Ethanol infusion (target blood ethanol 100-150 mg/dL)',
      hemodialysisIndicated ? 'CRITICAL: Nephrology emergent consult for Intermittent Hemodialysis' : 'Repeat osmolar gap and arterial blood gas every 2-4 hours'
    ]
  };
}

/**
 * 6. Digoxin Toxicity & DigiFab Vial Calculator
 */
export function calculateDigiFabDosing(
  scenario: 'KNOWN_INGESTION_AMOUNT' | 'STEADY_STATE_SERUM_LEVEL' | 'EMPIRIC_ARREST',
  amountIngestedMg?: number,
  serumDigoxinNgPerMl?: number,
  patientWeightKg?: number
): DigiFabResult {
  // 1 vial DigiFab = 40 mg, binds 0.5 mg digoxin
  let vials = 10; // Default empiric

  if (scenario === 'EMPIRIC_ARREST') {
    vials = 10; // 10-20 vials for acute cardiac arrest or hemodynamic collapse
    return {
      scenario,
      vialsRecommended: vials,
      mgFabTotal: vials * 40,
      administrationInstructions: '10 to 20 vials (400 - 800 mg) IV push over 5 minutes for cardiac arrest or impending asystole/ventricular arrhythmia.',
      hyperkalemiaWarning: 'Anticipate rapid decrease in serum potassium following DigiFab administration. DO NOT administer IV Calcium for hyperkalemia prior to DigiFab (risk of "stone heart").'
    };
  }

  if (scenario === 'KNOWN_INGESTION_AMOUNT' && amountIngestedMg && amountIngestedMg > 0) {
    // Vials = (mg ingested * 0.8 bioavailability) / 0.5 mg per vial
    vials = Math.ceil((amountIngestedMg * 0.8) / 0.5);
    return {
      scenario,
      vialsRecommended: vials,
      mgFabTotal: vials * 40,
      administrationInstructions: `Reconstitute each vial with 4 mL sterile water; infuse ${vials} vials (${vials * 40} mg) in 100 mL Normal Saline over 30 minutes.`,
      hyperkalemiaWarning: 'Closely monitor serum Potassium; rebound hypokalemia may require aggressive replenishment.'
    };
  }

  if (scenario === 'STEADY_STATE_SERUM_LEVEL' && serumDigoxinNgPerMl && patientWeightKg) {
    // Vials = (Serum Digoxin in ng/mL * Weight in kg) / 100
    vials = Math.ceil((serumDigoxinNgPerMl * patientWeightKg) / 100);
    vials = Math.max(vials, 1);
    return {
      scenario,
      vialsRecommended: vials,
      mgFabTotal: vials * 40,
      administrationInstructions: `Administer ${vials} vials (${vials * 40} mg) IV over 30 minutes for steady-state toxicity.`,
      hyperkalemiaWarning: 'Digoxin levels measured AFTER DigiFab will be falsely elevated due to antibody-bound fraction; do not guide therapy with post-Fab levels.'
    };
  }

  return {
    scenario,
    vialsRecommended: 10,
    mgFabTotal: 400,
    administrationInstructions: 'Administer 10 vials (400 mg) IV over 30 minutes (or IV push if cardiac arrest).',
    hyperkalemiaWarning: 'Monitor continuous telemetry and serum potassium.'
  };
}

/**
 * 7. Database Persistence & Query Helpers
 */
export async function createToxicologyCase(data: {
  patientId: number;
  substanceName: string;
  ingestionCategory: string;
  ingestionTimeHoursAgo: number;
  amountIngestedMgOrUnits?: number;
  patientWeightKg: number;
  serumLevel?: number;
  serumLevelUnit?: string;
  measuredOsmolality?: number;
  calculatedOsmolarGap?: number;
  toxidromeIdentified?: string;
  hunterSerotoninPositive?: boolean;
  recommendedAntidote?: string;
  antidoteDosingPlan?: any;
  hemodialysisIndicated?: boolean;
  poisonControlCaseNumber?: string;
}) {
  const result = await pool.query(
    `INSERT INTO toxicology_ingestion_cases (
      patient_id, substance_name, ingestion_category, ingestion_time_hours_ago,
      amount_ingested_mg_or_units, patient_weight_kg, serum_level, serum_level_unit,
      measured_osmolality, calculated_osmolar_gap, toxidrome_identified,
      hunter_serotonin_positive, recommended_antidote, antidote_dosing_plan,
      hemodialysis_indicated, poison_control_case_number
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    RETURNING *`,
    [
      data.patientId,
      data.substanceName,
      data.ingestionCategory,
      data.ingestionTimeHoursAgo,
      data.amountIngestedMgOrUnits || null,
      data.patientWeightKg,
      data.serumLevel || null,
      data.serumLevelUnit || null,
      data.measuredOsmolality || null,
      data.calculatedOsmolarGap || null,
      data.toxidromeIdentified || null,
      data.hunterSerotoninPositive || false,
      data.recommendedAntidote || null,
      data.antidoteDosingPlan ? JSON.stringify(data.antidoteDosingPlan) : null,
      data.hemodialysisIndicated || false,
      data.poisonControlCaseNumber || `PCC-2026-${Math.floor(100000 + Math.random() * 900000)}`
    ]
  );
  return result.rows[0];
}

export async function recordAntidoteAdministration(data: {
  caseId: number;
  antidoteName: string;
  doseAdministered: number;
  doseUnit: string;
  route?: string;
  administeredBy?: string;
  postAdminVitals?: any;
  notes?: string;
}) {
  const result = await pool.query(
    `INSERT INTO antidote_administrations (
      case_id, antidote_name, dose_administered, dose_unit, route, administered_by, post_admin_vitals, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      data.caseId,
      data.antidoteName,
      data.doseAdministered,
      data.doseUnit,
      data.route || 'IV',
      data.administeredBy || 'Clinical Staff',
      data.postAdminVitals ? JSON.stringify(data.postAdminVitals) : null,
      data.notes || null
    ]
  );
  return result.rows[0];
}

export async function getToxicologyCaseDetails(caseId: number) {
  const caseRes = await pool.query(`SELECT * FROM toxicology_ingestion_cases WHERE id = $1`, [caseId]);
  if (caseRes.rows.length === 0) return null;
  const adminRes = await pool.query(`SELECT * FROM antidote_administrations WHERE case_id = $1 ORDER BY administered_at DESC`, [caseId]);
  return {
    ...caseRes.rows[0],
    antidoteAdministrations: adminRes.rows
  };
}

export async function listActiveToxicologyCases(limit: number = 20) {
  const result = await pool.query(
    `SELECT * FROM toxicology_ingestion_cases ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
}
