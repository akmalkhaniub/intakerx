import { pool } from '../db';

export type CmvDrStatus = 'D_POS_R_NEG' | 'D_POS_R_POS' | 'D_NEG_R_POS' | 'D_NEG_R_NEG';
export type EbvDrStatus = 'D_POS_R_NEG' | 'D_POS_R_POS' | 'D_NEG_R_POS' | 'D_NEG_R_NEG';
export type CmvRiskLevel = 'HIGH' | 'INTERMEDIATE' | 'LOW';
export type EbvPtldRisk = 'HIGH' | 'INTERMEDIATE' | 'LOW';

export interface ProphylaxisPlanInput {
  transplantId: number;
  patientId: number;
  organType: 'HEART' | 'LUNG' | 'HEART_LUNG';
  cmvDonorStatus: 'POSITIVE' | 'NEGATIVE';
  cmvRecipientStatus: 'POSITIVE' | 'NEGATIVE';
  ebvDonorStatus: 'POSITIVE' | 'NEGATIVE';
  ebvRecipientStatus: 'POSITIVE' | 'NEGATIVE';
  crClMlMin: number;
  ancCellsPerUl?: number;
  plateletsPerUl?: number;
  sulfaAllergy: boolean;
  g6pdDeficiency?: boolean;
  antithymocyteGlobulinUsed?: boolean;
}

export interface ProphylaxisPlanResult {
  organType: string;
  cmvDrStatus: CmvDrStatus;
  cmvRiskLevel: CmvRiskLevel;
  valganciclovirDosing: string;
  valganciclovirDurationMonths: number;
  cytopeniaAlert: {
    alert: boolean;
    neutropenia: boolean;
    thrombocytopenia: boolean;
    guidance: string;
  };
  pcpRegimen: string;
  pcpDuration: string;
  fungalRegimen: string;
  fungalDuration: string;
  ebvPtldRisk: EbvPtldRisk;
  surveillanceSchedule: {
    test: string;
    frequency: string;
    rationale: string;
  }[];
  clinicalChecklist: string[];
}

export interface ViralLoadInput {
  transplantId: number;
  patientId: number;
  virusType: 'CMV' | 'EBV' | 'BKV' | 'ADV';
  copiesPerMl: number;
  previousCopiesPerMl?: number;
  onProphylaxis?: boolean;
}

export interface ViralLoadResult {
  virusType: 'CMV' | 'EBV' | 'BKV' | 'ADV';
  copiesPerMl: number;
  log10Value: number;
  interpretation: 'UNDETECTABLE_OR_TRACE' | 'LOW_LEVEL_DNAEMIA' | 'MODERATE_DNAEMIA' | 'HIGH_BURDEN_INFECTION' | 'CRITICAL_HIGH_DNAEMIA';
  viralKinetics: string;
  clinicalAction: string;
  immunosuppressionAdjustment: string;
  recommendedMonitoring: string;
}

// 1. GENERATE PROPHYLAXIS PLAN
export function generateOpportunisticProphylaxisPlan(input: ProphylaxisPlanInput): ProphylaxisPlanResult {
  const {
    organType,
    cmvDonorStatus,
    cmvRecipientStatus,
    ebvDonorStatus,
    ebvRecipientStatus,
    crClMlMin,
    ancCellsPerUl,
    plateletsPerUl,
    sulfaAllergy,
    g6pdDeficiency,
    antithymocyteGlobulinUsed
  } = input;

  // Determine CMV Serostatus Combination
  let cmvDrStatus: CmvDrStatus = 'D_NEG_R_NEG';
  let cmvRiskLevel: CmvRiskLevel = 'LOW';

  if (cmvDonorStatus === 'POSITIVE' && cmvRecipientStatus === 'NEGATIVE') {
    cmvDrStatus = 'D_POS_R_NEG';
    cmvRiskLevel = 'HIGH';
  } else if (cmvDonorStatus === 'POSITIVE' && cmvRecipientStatus === 'POSITIVE') {
    cmvDrStatus = 'D_POS_R_POS';
    cmvRiskLevel = 'INTERMEDIATE';
  } else if (cmvDonorStatus === 'NEGATIVE' && cmvRecipientStatus === 'POSITIVE') {
    cmvDrStatus = 'D_NEG_R_POS';
    cmvRiskLevel = 'INTERMEDIATE';
  } else {
    cmvDrStatus = 'D_NEG_R_NEG';
    cmvRiskLevel = 'LOW';
  }

  // Valganciclovir Dosing by Cockcroft-Gault CrCl
  let valganciclovirDosing = '';
  let valganciclovirDurationMonths = 0;

  if (cmvRiskLevel === 'LOW') {
    valganciclovirDosing = 'No Valganciclovir indicated. Use Acyclovir 400mg PO BID (or Valacyclovir 500mg PO daily) for HSV/VZV prophylaxis. Transfuse leukoreduced or CMV-seronegative blood only.';
    valganciclovirDurationMonths = 3;
  } else {
    valganciclovirDurationMonths = cmvRiskLevel === 'HIGH' ? (organType.includes('LUNG') ? 12 : 6) : 3;
    if (antithymocyteGlobulinUsed) {
      valganciclovirDurationMonths = Math.max(valganciclovirDurationMonths, 6);
    }

    if (crClMlMin >= 60) {
      valganciclovirDosing = 'Valganciclovir 900 mg PO once daily with food.';
    } else if (crClMlMin >= 40) {
      valganciclovirDosing = 'Valganciclovir 450 mg PO once daily with food (renal adjusted: CrCl 40-59 mL/min).';
    } else if (crClMlMin >= 25) {
      valganciclovirDosing = 'Valganciclovir 450 mg PO every 48 hours (renal adjusted: CrCl 25-39 mL/min).';
    } else if (crClMlMin >= 10) {
      valganciclovirDosing = 'Valganciclovir 450 mg PO twice weekly (e.g. Mondays and Thursdays; renal adjusted: CrCl 10-24 mL/min).';
    } else {
      valganciclovirDosing = 'CrCl < 10 mL/min: Valganciclovir not recommended. Consult nephrology / ID for post-hemodialysis dosing (200 mg three times weekly post-HD) or transition to preemptive weekly CMV qPCR surveillance.';
    }
  }

  // Cytopenia Guard
  const isNeutropenic = ancCellsPerUl !== undefined && ancCellsPerUl < 1000;
  const isThrombocytopenic = plateletsPerUl !== undefined && plateletsPerUl < 50000;
  const cytopeniaAlertActive = isNeutropenic || isThrombocytopenic;
  let cytopeniaGuidance = 'Hematologic counts within acceptable range.';

  if (cytopeniaAlertActive) {
    if (isNeutropenic && isThrombocytopenic) {
      cytopeniaGuidance = `SEVERE BICYTOPENIA (ANC ${ancCellsPerUl}/uL, Plt ${plateletsPerUl}/uL). Hold Valganciclovir immediately to prevent fatal marrow aplasia. Administer G-CSF (Filgrastim 300 mcg SC daily). Transition to weekly plasma CMV qPCR preemptive surveillance.`;
    } else if (isNeutropenic) {
      cytopeniaGuidance = `NEUTROPENIA (ANC ${ancCellsPerUl}/uL < 1000/uL). Dose-dependent Valganciclovir myelosuppression. Administer G-CSF (Filgrastim 300 mcg SC Q48-72h) or hold drug if ANC < 750/uL.`;
    } else {
      cytopeniaGuidance = `THROMBOCYTOPENIA (Platelets ${plateletsPerUl}/uL < 50,000/uL). Monitor platelet trend; consider reducing Mycophenolate/Azathioprine or Valganciclovir if marrow toxicity persists.`;
    }
  }

  // PCP Prophylaxis
  let pcpRegimen = '';
  const pcpDuration = organType.includes('LUNG') ? 'Lifelong (lung transplant standard)' : 'Minimum 6-12 months (or lifelong per institutional protocol)';

  if (!sulfaAllergy && !g6pdDeficiency) {
    pcpRegimen = 'Trimethoprim-Sulfamethoxazole (TMP-SMX) 1 Single-Strength (SS 80/400mg) tablet PO once daily (or 1 Double-Strength DS tablet MWF). Also confers Nocardia & Toxoplasma gondii coverage.';
  } else if (sulfaAllergy && !g6pdDeficiency) {
    pcpRegimen = 'Atovaquone 1500 mg PO once daily with fatty meal (preferred alternative for severe sulfa allergy). Second alternative: Dapsone 100 mg PO daily (G6PD screen negative verified).';
  } else if (g6pdDeficiency) {
    pcpRegimen = 'Atovaquone 1500 mg PO once daily with meals OR Inhaled Pentamidine 300 mg monthly via Respirgard II nebulizer (Dapsone & Sulfa strictly contraindicated due to acute hemolytic anemia risk).';
  } else {
    pcpRegimen = 'Atovaquone 1500 mg PO once daily with meals.';
  }

  // Fungal Prophylaxis
  let fungalRegimen = '';
  let fungalDuration = '';

  if (organType.includes('LUNG')) {
    fungalRegimen = 'Voriconazole 200 mg PO BID (target trough 1.5 - 5.5 mcg/mL; NOTE: mandatory 66% pre-emptive Tacrolimus dose reduction due to CYP3A4 inhibition) OR Isavuconazole 200 mg PO daily OR Inhaled Amphotericin B 25 mg nebulized weekly.';
    fungalDuration = '3 to 6 months post-transplant (universal prophylaxis for lung allografts).';
  } else {
    // Heart
    fungalRegimen = 'Fluconazole 200 mg PO daily for 1-3 months (or targeted mold-active Voriconazole/Posaconazole if prolonged ICU stay, delayed sternal closure, or re-exploration).';
    fungalDuration = '1 to 3 months post-transplant.';
  }

  // EBV & PTLD Risk
  let ebvPtldRisk: EbvPtldRisk = 'LOW';
  if (ebvDonorStatus === 'POSITIVE' && ebvRecipientStatus === 'NEGATIVE') {
    ebvPtldRisk = 'HIGH';
  } else if (ebvDonorStatus === 'POSITIVE' || ebvRecipientStatus === 'POSITIVE') {
    ebvPtldRisk = 'INTERMEDIATE';
  } else {
    ebvPtldRisk = 'LOW';
  }

  // Surveillance Schedule
  const surveillanceSchedule = [
    {
      test: 'Plasma CMV Quantitative qPCR',
      frequency: cmvRiskLevel === 'HIGH' ? 'Monthly while on prophylaxis, then Q2W x 3 months after stopping' : 'Monthly x 6 months (or triggered by fever/cytopenia)',
      rationale: 'Detects breakthrough viral replication or late-onset primary CMV disease.'
    },
    {
      test: 'Plasma EBV Quantitative qPCR',
      frequency: ebvPtldRisk === 'HIGH' ? 'Monthly for 6 months, then every 3 months for year 1' : 'Quarterly for 12 months',
      rationale: 'Surveillance for asymptomatic DNAemia to prevent Post-Transplant Lymphoproliferative Disorder (PTLD).'
    },
    {
      test: 'CBC with Differential & Platelets',
      frequency: 'Weekly for first 8 weeks, then bi-weekly while on Valganciclovir',
      rationale: 'Monitors for Valganciclovir/TMP-SMX induced neutropenia, leukopenia, and thrombocytopenia.'
    },
    {
      test: 'Serum Creatinine & Estimated CrCl',
      frequency: 'Weekly x 4 weeks, then bi-weekly',
      rationale: 'Mandatory for dose adjustment of Valganciclovir to prevent neurotoxicity/underdosing.'
    }
  ];

  if (organType.includes('LUNG')) {
    surveillanceSchedule.push({
      test: 'Voriconazole Trough Level TDM',
      frequency: 'Day 5-7 post initiation, then weekly until stable (target 1.5 - 5.5 mcg/mL)',
      rationale: 'Narrow therapeutic window; prevents hepatotoxicity, visual hallucinations, and breakthrough invasive aspergillosis.'
    });
  }

  const checklist: string[] = [
    `Initiate ${valganciclovirDosing.split('.')[0]} within 5-10 days post-transplant once oral medications tolerated.`,
    `Start ${pcpRegimen.split('.')[0]}.`,
    `Fungal coverage: ${fungalRegimen.split('.')[0]}.`,
    ebvPtldRisk === 'HIGH' ? 'CRITICAL: EBV D+/R- carries severe early PTLD risk. Ensure baseline and monthly EBV qPCR tracking.' : 'Standard EBV tracking.',
    'Counsel patient: Promptly report any unexplained fever, diarrhea, profound fatigue, dyspnea, or mouth ulcers.'
  ];

  return {
    organType,
    cmvDrStatus,
    cmvRiskLevel,
    valganciclovirDosing,
    valganciclovirDurationMonths,
    cytopeniaAlert: {
      alert: cytopeniaAlertActive,
      neutropenia: isNeutropenic,
      thrombocytopenia: isThrombocytopenic,
      guidance: cytopeniaGuidance
    },
    pcpRegimen,
    pcpDuration,
    fungalRegimen,
    fungalDuration,
    ebvPtldRisk,
    surveillanceSchedule,
    clinicalChecklist: checklist
  };
}

// 2. INTERPRET VIRAL LOAD SURVEILLANCE
export function interpretViralLoadSurveillance(input: ViralLoadInput): ViralLoadResult {
  const { virusType, copiesPerMl, previousCopiesPerMl, onProphylaxis } = input;
  const log10Value = copiesPerMl > 0 ? Math.round(Math.log10(copiesPerMl) * 100) / 100 : 0;

  let interpretation: ViralLoadResult['interpretation'] = 'UNDETECTABLE_OR_TRACE';
  let viralKinetics = 'Stable baseline';
  let clinicalAction = '';
  let immunosuppressionAdjustment = '';
  let recommendedMonitoring = '';

  if (previousCopiesPerMl !== undefined && previousCopiesPerMl > 0) {
    const foldChange = copiesPerMl / previousCopiesPerMl;
    if (foldChange >= 3.0) {
      viralKinetics = `RAPID VIRAL KINETICS: ${foldChange.toFixed(1)}x surge since prior assay (${previousCopiesPerMl} ➔ ${copiesPerMl} copies/mL, +${(log10Value - Math.log10(previousCopiesPerMl)).toFixed(2)} log10).`;
    } else if (foldChange <= 0.33) {
      viralKinetics = `VIRAL CLEARANCE: Significant decrease (${previousCopiesPerMl} ➔ ${copiesPerMl} copies/mL).`;
    } else {
      viralKinetics = `Stable viral load within 0.5 log10 variance.`;
    }
  }

  if (virusType === 'CMV') {
    if (copiesPerMl < 200) {
      interpretation = 'UNDETECTABLE_OR_TRACE';
      clinicalAction = onProphylaxis ? 'Continue maintenance prophylaxis regimen.' : 'No active viral DNAemia detected. Routine surveillance.';
      immunosuppressionAdjustment = 'Maintain standard target immunosuppression.';
      recommendedMonitoring = 'Repeat CMV qPCR in 4 weeks or per standard protocol.';
    } else if (copiesPerMl < 1000) {
      interpretation = 'LOW_LEVEL_DNAEMIA';
      clinicalAction = onProphylaxis
        ? 'Possible breakthrough replication. Verify medication adherence and check CrCl to ensure adequate Valganciclovir dosing.'
        : 'Low-level asymptomatic DNAemia. Initiate close surveillance; hold off on full treatment if asymptomatic.';
      immunosuppressionAdjustment = 'Monitor closely; no immediate reduction required unless rising.';
      recommendedMonitoring = 'Repeat CMV qPCR in 7 days to assess replication kinetics.';
    } else if (copiesPerMl < 5000) {
      interpretation = 'MODERATE_DNAEMIA';
      clinicalAction = 'Significant CMV DNAemia. Transition from prophylaxis to TREATMENT DOSING: Valganciclovir 900 mg PO BID (or IV Ganciclovir 5 mg/kg Q12H if severe symptoms or malabsorption). Screen for end-organ disease (fever, leukopenia, diarrhea, hepatitis).';
      immunosuppressionAdjustment = 'Reduce antimetabolite (Mycophenolate / Azathioprine) by 50% to enhance host cellular viral clearance.';
      recommendedMonitoring = 'Weekly CMV qPCR until negative on 2 consecutive tests.';
    } else {
      interpretation = 'HIGH_BURDEN_INFECTION';
      clinicalAction = 'HIGH-BURDEN CMV INFECTION. High risk of tissue-invasive pneumonitis, colitis, or allograft injury. Mandatory therapeutic IV Ganciclovir 5 mg/kg Q12H renally adjusted. Test for UL97/UL54 ganciclovir resistance mutations if prior prolonged exposure.';
      immunosuppressionAdjustment = 'Hold Mycophenolate/Azathioprine completely. Reduce CNI target trough by 25-33%.';
      recommendedMonitoring = 'Weekly CMV qPCR; monitor CBC, creatinine, and liver enzymes bi-weekly.';
    }
  } else if (virusType === 'EBV') {
    if (copiesPerMl < 500) {
      interpretation = 'UNDETECTABLE_OR_TRACE';
      clinicalAction = 'EBV viral load negative or below quantifiable threshold.';
      immunosuppressionAdjustment = 'Maintain baseline maintenance immunosuppression.';
      recommendedMonitoring = 'Routine surveillance qPCR per protocol schedule.';
    } else if (copiesPerMl < 10000) {
      interpretation = 'LOW_LEVEL_DNAEMIA';
      clinicalAction = 'Low-to-moderate EBV DNAemia. Clinical evaluation for lymphadenopathy, fever, sore throat, or organomegaly.';
      immunosuppressionAdjustment = 'Consider modest reduction of antimetabolite dose (25%) if persisting > 4 weeks.';
      recommendedMonitoring = 'Repeat EBV qPCR in 2-4 weeks.';
    } else {
      interpretation = 'CRITICAL_HIGH_DNAEMIA';
      clinicalAction = 'CRITICAL ALERT: HIGH-LOAD EBV DNAEMIA (>10,000 copies/mL). Severe risk of Post-Transplant Lymphoproliferative Disorder (PTLD). Perform urgent neck/chest/abdomen/pelvis CT or PET/CT scan. Consult Hematology/Oncology.';
      immunosuppressionAdjustment = 'Aggressive reduction of immunosuppression: Stop Mycophenolate/mTOR inhibitor, reduce CNI trough target by 50%. (Rituximab indicated if biopsy confirms CD20+ PTLD).';
      recommendedMonitoring = 'EBV qPCR every 1-2 weeks; urgent lymph node / tissue biopsy of suspicious FDG-avid lesions.';
    }
  } else {
    // BKV or ADV
    if (copiesPerMl < 1000) {
      interpretation = 'LOW_LEVEL_DNAEMIA';
      clinicalAction = `${virusType} viral load within low-level threshold.`;
      immunosuppressionAdjustment = 'Maintain current regimen.';
      recommendedMonitoring = 'Repeat in 4 weeks.';
    } else {
      interpretation = 'HIGH_BURDEN_INFECTION';
      clinicalAction = `Significant ${virusType} viremia. Risk of viral nephropathy (BKV) or disseminated disease (Adenovirus).`;
      immunosuppressionAdjustment = 'Reduce CNI / antimetabolite exposure by 25-50%.';
      recommendedMonitoring = 'Surveillance qPCR every 2 weeks.';
    }
  }

  return {
    virusType,
    copiesPerMl,
    log10Value,
    interpretation,
    viralKinetics,
    clinicalAction,
    immunosuppressionAdjustment,
    recommendedMonitoring
  };
}

// 3. DATABASE OPERATIONS
export async function saveProphylaxisPlan(plan: ProphylaxisPlanResult & { transplantId: number; patientId: number }) {
  const result = await pool.query(
    `INSERT INTO opportunistic_prophylaxis_plans (
      transplant_id, patient_id, cmv_d_r_status, cmv_risk_level,
      valganciclovir_dosing, pcp_regimen, fungal_regimen, ebv_ptld_risk,
      surveillance_schedule
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [
      plan.transplantId,
      plan.patientId,
      plan.cmvDrStatus,
      plan.cmvRiskLevel,
      plan.valganciclovirDosing,
      plan.pcpRegimen,
      plan.fungalRegimen,
      plan.ebvPtldRisk,
      JSON.stringify(plan.surveillanceSchedule)
    ]
  );
  return result.rows[0];
}

export async function getPatientProphylaxisPlans(patientId: number, transplantId?: number) {
  let query = 'SELECT * FROM opportunistic_prophylaxis_plans WHERE patient_id = $1';
  const params: any[] = [patientId];
  if (transplantId) {
    query += ' AND transplant_id = $2';
    params.push(transplantId);
  }
  query += ' ORDER BY created_at DESC LIMIT 20';
  const result = await pool.query(query, params);
  return result.rows;
}

export async function saveViralLoadRecord(record: ViralLoadInput & ViralLoadResult & { transplantId: number; patientId: number }) {
  const result = await pool.query(
    `INSERT INTO viral_load_surveillance_logs (
      transplant_id, patient_id, virus_type, assay_type, copies_per_ml,
      log10_value, interpretation, clinical_action
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      record.transplantId,
      record.patientId,
      record.virusType,
      'QUANTITATIVE_PCR',
      record.copiesPerMl,
      record.log10Value,
      record.interpretation,
      record.clinicalAction
    ]
  );
  return result.rows[0];
}

export async function getPatientViralLoadHistory(patientId: number, virusType?: string) {
  let query = 'SELECT * FROM viral_load_surveillance_logs WHERE patient_id = $1';
  const params: any[] = [patientId];
  if (virusType) {
    query += ' AND virus_type = $2';
    params.push(virusType);
  }
  query += ' ORDER BY tested_at DESC LIMIT 50';
  const result = await pool.query(query, params);
  return result.rows;
}
