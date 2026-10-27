import { pool } from '../db';

export type CniDrug = 'TACROLIMUS' | 'CYCLOSPORINE';
export type TdmLevelType = 'C0_TROUGH' | 'C2_PEAK';
export type TdmStatus = 'SUBTHERAPEUTIC' | 'THERAPEUTIC' | 'SUPRATHERAPEUTIC' | 'CRITICAL_TOXIC';

export interface CniTdmInput {
  transplantId: number;
  patientId: number;
  drugName: CniDrug;
  levelType: TdmLevelType;
  measuredLevel: number;
  postOpMonths: number;
  currentDoseMgPerDay?: number;
}

export interface CniTdmEvaluationResult {
  drugName: CniDrug;
  levelType: TdmLevelType;
  measuredLevel: number;
  postOpMonths: number;
  targetRangeLow: number;
  targetRangeHigh: number;
  status: TdmStatus;
  doseAdjustmentPct: number;
  recommendedDoseMgPerDay?: number;
  doseRecommendation: string;
  clinicalActionChecklist: string[];
  monitoringInterval: string;
}

export interface Cyp3aInteractionItem {
  drugName: string;
  interactionType: 'STRONG_INHIBITOR' | 'MODERATE_INHIBITOR' | 'STRONG_INDUCER' | 'MODERATE_INDUCER';
  cyp3aEffect: string;
  expectedCniShift: string;
  recommendedDoseAdjustmentPct: number;
  clinicalInstruction: string;
}

export interface Cyp3aInteractionReport {
  cniDrug: CniDrug;
  concurrentDrugsChecked: string[];
  identifiedInteractions: Cyp3aInteractionItem[];
  overallRiskLevel: 'NONE' | 'MODERATE' | 'HIGH' | 'CRITICAL_INDUCER_REJECTION' | 'CRITICAL_INHIBITOR_TOXICITY';
  suggestedImmediateCniAdjustmentPct: number;
  pharmacistRecommendations: string[];
}

export interface CniVsRejectionInput {
  transplantId: number;
  patientId: number;
  baselineCreatinine: number;
  currentCreatinine: number;
  tacrolimusTrough: number;
  postOpMonths: number;
  fenaPercent?: number;
  dsaPositive?: boolean;
  highestMfi?: number;
  hasNeurologicalSymptoms?: boolean;
  hasHypertensionOrHyperkalemia?: boolean;
  hasFeverOrGraftTenderness?: boolean;
  graftDysfunctionSigns?: boolean;
  interactingDrugs?: string[];
}

export interface CniVsRejectionResult {
  cniToxicityProbability: 'LOW' | 'INTERMEDIATE' | 'HIGH';
  rejectionProbability: 'LOW' | 'INTERMEDIATE' | 'HIGH';
  primarySuspect: 'CNI_NEPHROTOXICITY' | 'ACUTE_ALLOGRAFT_REJECTION' | 'MIXED_ETIOLOGY' | 'INDETERMINATE';
  differentialScore: { cniScore: number; rejectionScore: number };
  diagnosticDifferentiation: string;
  actionPlan: {
    step: number;
    action: string;
    urgency: 'IMMEDIATE' | 'WITHIN_24H' | 'ROUTINE';
    rationale: string;
  }[];
}

// 1. TDM TARGET DETERMINATION & DOSE EVALUATION
export function evaluateCniTdm(input: CniTdmInput): CniTdmEvaluationResult {
  const { drugName, levelType, measuredLevel, postOpMonths, currentDoseMgPerDay } = input;
  let targetLow = 0;
  let targetHigh = 0;

  if (drugName === 'TACROLIMUS') {
    if (postOpMonths <= 3) {
      targetLow = 8.0;
      targetHigh = 12.0;
    } else if (postOpMonths <= 12) {
      targetLow = 6.0;
      targetHigh = 10.0;
    } else {
      targetLow = 5.0;
      targetHigh = 8.0;
    }
  } else {
    // CYCLOSPORINE
    if (levelType === 'C2_PEAK') {
      if (postOpMonths <= 3) {
        targetLow = 1000.0;
        targetHigh = 1400.0;
      } else if (postOpMonths <= 12) {
        targetLow = 700.0;
        targetHigh = 900.0;
      } else {
        targetLow = 500.0;
        targetHigh = 700.0;
      }
    } else {
      // C0_TROUGH
      if (postOpMonths <= 3) {
        targetLow = 200.0;
        targetHigh = 300.0;
      } else if (postOpMonths <= 12) {
        targetLow = 150.0;
        targetHigh = 250.0;
      } else {
        targetLow = 100.0;
        targetHigh = 200.0;
      }
    }
  }

  // Determine Status
  let status: TdmStatus = 'THERAPEUTIC';
  let doseAdjustmentPct = 0;
  const checklist: string[] = [];
  let monitoringInterval = 'Routine surveillance (every 1-2 weeks)';

  const criticalToxicCutoff = drugName === 'TACROLIMUS' ? 15.0 : (levelType === 'C2_PEAK' ? 1800.0 : 400.0);

  if (measuredLevel >= criticalToxicCutoff || measuredLevel > targetHigh * 1.5) {
    status = 'CRITICAL_TOXIC';
    doseAdjustmentPct = -50;
    checklist.push('HOLD morning CNI dose immediately.');
    checklist.push('Draw stat repeat level to rule out lab timing artifact (sample drawn from same IV lumen or non-trough).');
    checklist.push('Assess for neurotoxicity (tremor, encephalopathy, visual changes, seizures) and thrombotic microangiopathy (LDH, platelets, schistocytes).');
    checklist.push('Hydrate with isotonic saline if hypovolemic; monitor serum creatinine and potassium Q12-24H.');
    monitoringInterval = 'Daily stat levels until < target ceiling';
  } else if (measuredLevel > targetHigh) {
    status = 'SUPRATHERAPEUTIC';
    const targetMid = (targetLow + targetHigh) / 2;
    doseAdjustmentPct = Math.max(-40, Math.round(((targetMid - measuredLevel) / measuredLevel) * 100));
    checklist.push(`Decrease total daily dose by approx ${Math.abs(doseAdjustmentPct)}%.`);
    checklist.push('Screen concurrent medications for CYP3A4 / P-glycoprotein inhibitors.');
    checklist.push('Verify accurate timing of dose (exact 12-hour trough sample before morning dose).');
    monitoringInterval = 'Repeat trough level in 3-5 days';
  } else if (measuredLevel < targetLow) {
    status = 'SUBTHERAPEUTIC';
    const targetMid = (targetLow + targetHigh) / 2;
    doseAdjustmentPct = Math.min(50, Math.round(((targetMid - measuredLevel) / measuredLevel) * 100));
    checklist.push(`Increase total daily dose by approx ${doseAdjustmentPct}%.`);
    checklist.push('High risk for acute cellular or antibody-mediated rejection! Verify patient adherence.');
    checklist.push('Screen for CYP3A4 inducers (e.g., rifampin, carbamazepine, St. John\'s Wort) or GI malabsorption/diarrhea.');
    checklist.push('Order DSA screening and graft functional biomarkers if clinical suspicion of rejection.');
    monitoringInterval = 'Repeat trough level in 3 days post-dose increase';
  } else {
    status = 'THERAPEUTIC';
    doseAdjustmentPct = 0;
    checklist.push('Maintain current dosing regimen.');
    checklist.push('Confirm adherence and stable administration relative to food/meals.');
    monitoringInterval = postOpMonths <= 3 ? 'Weekly' : (postOpMonths <= 12 ? 'Bi-weekly' : 'Monthly');
  }

  let recommendedDoseMgPerDay: number | undefined;
  if (currentDoseMgPerDay !== undefined && currentDoseMgPerDay > 0) {
    const rawNewDose = currentDoseMgPerDay * (1 + doseAdjustmentPct / 100);
    recommendedDoseMgPerDay = Math.round(rawNewDose * 10) / 10;
  }

  const doseRecommendation = status === 'THERAPEUTIC'
    ? `Target achieved (${targetLow}-${targetHigh} ng/mL). Maintain current regimen.`
    : status === 'CRITICAL_TOXIC'
    ? `CRITICAL TOXIC LEVEL (${measuredLevel} ng/mL). Hold dose; recheck C0 in 12-24h; restart at ${Math.abs(doseAdjustmentPct)}% lower dose once < ${targetHigh} ng/mL.`
    : `Level is ${status} (${measuredLevel} ng/mL vs target ${targetLow}-${targetHigh} ng/mL). Recommend ${doseAdjustmentPct > 0 ? '+' : ''}${doseAdjustmentPct}% dose modification${recommendedDoseMgPerDay ? ` (from ${currentDoseMgPerDay}mg to ~${recommendedDoseMgPerDay}mg/day)` : ''}.`;

  return {
    drugName,
    levelType,
    measuredLevel,
    postOpMonths,
    targetRangeLow: targetLow,
    targetRangeHigh: targetHigh,
    status,
    doseAdjustmentPct,
    recommendedDoseMgPerDay,
    doseRecommendation,
    clinicalActionChecklist: checklist,
    monitoringInterval
  };
}

// 2. CYP3A4 & P-GP DRUG INTERACTION ENGINE
const CYP3A_INTERACTIONS: Record<string, { type: Cyp3aInteractionItem['interactionType']; effect: string; cniShift: string; doseAdjPct: number; instruction: string }> = {
  voriconazole: {
    type: 'STRONG_INHIBITOR',
    effect: 'Potent CYP3A4 & CYP2C19 inhibition',
    cniShift: 'Increases CNI AUC by 200% - 300% (3x - 4x level increase)',
    doseAdjPct: -66,
    instruction: 'Empirically decrease Tacrolimus dose by 66% (to 1/3) or Cyclosporine by 50% immediately upon starting Voriconazole. Check trough levels at 48h and 96h.'
  },
  posaconazole: {
    type: 'STRONG_INHIBITOR',
    effect: 'Potent CYP3A4 & P-gp inhibition',
    cniShift: 'Increases CNI AUC by 200% - 300%',
    doseAdjPct: -66,
    instruction: 'Empirically decrease Tacrolimus dose by 66% to 75%. Monitor trough level every 48 hours until stable.'
  },
  itraconazole: {
    type: 'STRONG_INHIBITOR',
    effect: 'Potent CYP3A4 & P-gp inhibition',
    cniShift: 'Increases CNI AUC by 150% - 250%',
    doseAdjPct: -50,
    instruction: 'Reduce CNI dose by 50%. TDM monitoring every 2-3 days until steady-state.'
  },
  ketoconazole: {
    type: 'STRONG_INHIBITOR',
    effect: 'Potent CYP3A4 inhibition',
    cniShift: 'Increases CNI AUC by 200% - 300%',
    doseAdjPct: -66,
    instruction: 'Reduce CNI dose by 66%. Stat trough surveillance.'
  },
  clarithromycin: {
    type: 'STRONG_INHIBITOR',
    effect: 'Potent CYP3A4 & P-gp inhibition',
    cniShift: 'Increases CNI levels by 100% - 200%',
    doseAdjPct: -50,
    instruction: 'Strong macrolide interaction. Reduce CNI dose by 50% or switch to Azithromycin (minimal CYP3A4 inhibition).'
  },
  fluconazole: {
    type: 'MODERATE_INHIBITOR',
    effect: 'Moderate CYP3A4 & CYP2C9 inhibition (dose-dependent)',
    cniShift: 'Increases CNI levels by 30% - 50%',
    doseAdjPct: -33,
    instruction: 'Reduce CNI dose by 25% - 33% if fluconazole >= 200mg/day. Monitor trough within 72 hours.'
  },
  diltiazem: {
    type: 'MODERATE_INHIBITOR',
    effect: 'Moderate CYP3A4 & P-gp inhibition',
    cniShift: 'Increases CNI levels by 25% - 40%',
    doseAdjPct: -25,
    instruction: 'Anticipate reduced CNI requirement by 20-30%. Monitor trough at next scheduled visit.'
  },
  verapamil: {
    type: 'MODERATE_INHIBITOR',
    effect: 'Moderate CYP3A4 & P-gp inhibition',
    cniShift: 'Increases CNI levels by 25% - 40%',
    doseAdjPct: -25,
    instruction: 'Reduce CNI dose by 20-25% and verify level at day 4.'
  },
  rifampin: {
    type: 'STRONG_INDUCER',
    effect: 'Massive CYP3A4 & P-gp induction',
    cniShift: 'Decreases CNI levels by 60% - 80% (severe allograft rejection risk)',
    doseAdjPct: 150,
    instruction: 'CRITICAL RISK OF REJECTION. Avoid combination if possible. If mandatory, anticipate requiring 2x to 4x CNI dose; check trough levels every 48-72h.'
  },
  carbamazepine: {
    type: 'STRONG_INDUCER',
    effect: 'Potent hepatic CYP3A4 induction',
    cniShift: 'Decreases CNI levels by 50% - 70%',
    doseAdjPct: 100,
    instruction: 'High rejection risk. Consider non-inducing anticonvulsants (e.g., levetiracetam, lacosamide). If carbamazepine maintained, double CNI dose with frequent TDM.'
  },
  phenytoin: {
    type: 'STRONG_INDUCER',
    effect: 'Potent CYP3A4 & P-gp induction',
    cniShift: 'Decreases CNI levels by 50% - 70%',
    doseAdjPct: 100,
    instruction: 'Switch to non-inducing alternative (levetiracetam) if feasible. Otherwise, increase CNI by 100% and monitor TDM bi-weekly.'
  },
  'st johns wort': {
    type: 'STRONG_INDUCER',
    effect: 'Hyperforin-mediated CYP3A4 and P-gp induction',
    cniShift: 'Causes precipitous drop in CNI levels leading to refractory rejection',
    doseAdjPct: 100,
    instruction: 'CONTRAINDICATED. Immediately discontinue herbal supplement. Recheck CNI trough in 48 hours.'
  }
};

export function evaluateCyp3aInteractions(cniDrug: CniDrug, concurrentDrugs: string[]): Cyp3aInteractionReport {
  const identified: Cyp3aInteractionItem[] = [];
  const normalizedList = concurrentDrugs.map(d => d.trim().toLowerCase());

  for (const drug of normalizedList) {
    for (const [key, rule] of Object.entries(CYP3A_INTERACTIONS)) {
      if (drug.includes(key)) {
        identified.push({
          drugName: drug.toUpperCase(),
          interactionType: rule.type,
          cyp3aEffect: rule.effect,
          expectedCniShift: rule.cniShift,
          recommendedDoseAdjustmentPct: rule.doseAdjPct,
          clinicalInstruction: rule.instruction
        });
        break;
      }
    }
  }

  let overallRiskLevel: Cyp3aInteractionReport['overallRiskLevel'] = 'NONE';
  let suggestedImmediateCniAdjustmentPct = 0;
  const recommendations: string[] = [];

  const strongInhibitor = identified.find(i => i.interactionType === 'STRONG_INHIBITOR');
  const strongInducer = identified.find(i => i.interactionType === 'STRONG_INDUCER');
  const moderateInhibitor = identified.find(i => i.interactionType === 'MODERATE_INHIBITOR');

  if (strongInducer) {
    overallRiskLevel = 'CRITICAL_INDUCER_REJECTION';
    suggestedImmediateCniAdjustmentPct = strongInducer.recommendedDoseAdjustmentPct;
    recommendations.push(`EMERGENCY ALERT: ${strongInducer.drugName} is a strong CYP3A4 inducer that drastically lowers ${cniDrug} levels. High risk of allograft rejection.`);
    recommendations.push(strongInducer.clinicalInstruction);
  } else if (strongInhibitor) {
    overallRiskLevel = 'CRITICAL_INHIBITOR_TOXICITY';
    suggestedImmediateCniAdjustmentPct = strongInhibitor.recommendedDoseAdjustmentPct;
    recommendations.push(`TOXICITY ALERT: ${strongInhibitor.drugName} is a potent CYP3A4 inhibitor. Pre-emptive ${cniDrug} dose reduction required to avoid acute renal failure.`);
    recommendations.push(strongInhibitor.clinicalInstruction);
  } else if (moderateInhibitor) {
    overallRiskLevel = 'MODERATE';
    suggestedImmediateCniAdjustmentPct = moderateInhibitor.recommendedDoseAdjustmentPct;
    recommendations.push(`Moderate CYP3A4 interaction identified with ${moderateInhibitor.drugName}.`);
    recommendations.push(moderateInhibitor.clinicalInstruction);
  } else {
    recommendations.push(`No critical CYP3A4/P-gp inhibitors or inducers detected among evaluated agents.`);
  }

  return {
    cniDrug,
    concurrentDrugsChecked: concurrentDrugs,
    identifiedInteractions: identified,
    overallRiskLevel,
    suggestedImmediateCniAdjustmentPct,
    pharmacistRecommendations: recommendations
  };
}

// 3. CNI TOXICITY VS ACUTE REJECTION DIFFERENTIATION
export function differentiateCniToxicityVsRejection(input: CniVsRejectionInput): CniVsRejectionResult {
  const {
    baselineCreatinine,
    currentCreatinine,
    tacrolimusTrough,
    fenaPercent,
    dsaPositive,
    highestMfi,
    hasNeurologicalSymptoms,
    hasHypertensionOrHyperkalemia,
    hasFeverOrGraftTenderness,
    graftDysfunctionSigns
  } = input;

  let cniScore = 0;
  let rejectionScore = 0;

  // Creatinine rise is present in both, but magnitude vs trough gives clues
  const crDelta = currentCreatinine - baselineCreatinine;
  const pctRise = baselineCreatinine > 0 ? (crDelta / baselineCreatinine) * 100 : 0;

  // Tacrolimus Trough
  if (tacrolimusTrough >= 15.0) {
    cniScore += 4;
  } else if (tacrolimusTrough >= 12.0) {
    cniScore += 3;
  } else if (tacrolimusTrough < 6.0) {
    rejectionScore += 4;
  } else if (tacrolimusTrough < 8.0) {
    rejectionScore += 2;
  }

  // FeNa (Fractional Excretion of Sodium)
  // Prerenal physiology (<1%) favors CNI afferent arteriolar vasoconstriction
  // FeNa > 1.5-2% favors tubulitis / intrinsic allograft injury
  if (fenaPercent !== undefined) {
    if (fenaPercent < 1.0) {
      cniScore += 2;
    } else if (fenaPercent > 1.5) {
      rejectionScore += 2;
    }
  }

  // DSA & Luminex MFI
  if (dsaPositive || (highestMfi !== undefined && highestMfi >= 2000)) {
    rejectionScore += 4;
  } else if (highestMfi !== undefined && highestMfi < 1000) {
    cniScore += 1;
  }

  // Neurotoxicity symptoms (CNI signature)
  if (hasNeurologicalSymptoms) {
    cniScore += 2;
  }

  // Hypertension / Hyperkalemia (classic CNI side effects)
  if (hasHypertensionOrHyperkalemia) {
    cniScore += 1;
  }

  // Graft tenderness / Fever (classic rejection signs)
  if (hasFeverOrGraftTenderness) {
    rejectionScore += 3;
  }

  // Functional graft failure (EF drop, FEV1 decline, severe oliguria)
  if (graftDysfunctionSigns) {
    rejectionScore += 3;
  }

  // Classification
  let cniProb: 'LOW' | 'INTERMEDIATE' | 'HIGH' = 'LOW';
  let rejProb: 'LOW' | 'INTERMEDIATE' | 'HIGH' = 'LOW';
  let primarySuspect: CniVsRejectionResult['primarySuspect'] = 'INDETERMINATE';

  if (cniScore >= 5) cniProb = 'HIGH';
  else if (cniScore >= 3) cniProb = 'INTERMEDIATE';

  if (rejectionScore >= 5) rejProb = 'HIGH';
  else if (rejectionScore >= 3) rejProb = 'INTERMEDIATE';

  if (cniProb === 'HIGH' && rejProb === 'LOW') {
    primarySuspect = 'CNI_NEPHROTOXICITY';
  } else if (rejProb === 'HIGH' && cniProb === 'LOW') {
    primarySuspect = 'ACUTE_ALLOGRAFT_REJECTION';
  } else if (cniScore >= 3 && rejectionScore >= 3) {
    primarySuspect = 'MIXED_ETIOLOGY';
  } else if (cniScore > rejectionScore) {
    primarySuspect = 'CNI_NEPHROTOXICITY';
  } else if (rejectionScore > cniScore) {
    primarySuspect = 'ACUTE_ALLOGRAFT_REJECTION';
  } else {
    primarySuspect = 'INDETERMINATE';
  }

  const actionPlan: CniVsRejectionResult['actionPlan'] = [];

  if (primarySuspect === 'CNI_NEPHROTOXICITY') {
    actionPlan.push({
      step: 1,
      action: 'Reduce CNI dose by 25-33% or temporarily hold morning dose if trough > 15 ng/mL.',
      urgency: 'IMMEDIATE',
      rationale: 'Relieves afferent arteriolar vasoconstriction and stops ongoing ischemic tubular injury.'
    });
    actionPlan.push({
      step: 2,
      action: 'Check 24-48h repeat serum creatinine, electrolytes (K+, Mg2+), and CNI trough.',
      urgency: 'WITHIN_24H',
      rationale: 'Creatinine should plateau or improve within 48-72h if pure hemodynamic CNI nephrotoxicity.'
    });
    actionPlan.push({
      step: 3,
      action: 'Screen for interacting CYP3A4 inhibitors (azoles, macrolides, calcium channel blockers).',
      urgency: 'ROUTINE',
      rationale: 'Identifies the root trigger of elevated CNI exposure.'
    });
  } else if (primarySuspect === 'ACUTE_ALLOGRAFT_REJECTION') {
    actionPlan.push({
      step: 1,
      action: 'Urgent allograft biopsy (Endomyocardial Biopsy or Transbronchial Biopsy) + Donor-Specific Antibody (DSA) panel.',
      urgency: 'IMMEDIATE',
      rationale: 'Histopathological confirmation of ACR (ISHLT grade) and C4d/pAMR staining is mandatory prior to escalated immunosuppression.'
    });
    actionPlan.push({
      step: 2,
      action: 'Empiric high-dose IV methylprednisolone (500-1000mg/day x 3 days) if hemodynamic compromise or severe allograft dysfunction.',
      urgency: 'IMMEDIATE',
      rationale: 'First-line rescue therapy for acute cellular rejection.'
    });
    actionPlan.push({
      step: 3,
      action: 'Restore therapeutic CNI exposure (target top half of target window).',
      urgency: 'WITHIN_24H',
      rationale: 'Overcomes subtherapeutic immunosuppressive coverage that triggered rejection.'
    });
  } else {
    actionPlan.push({
      step: 1,
      action: 'Conservative CNI dose decrease (15-20%) with strict daily creatinine and trough tracking.',
      urgency: 'IMMEDIATE',
      rationale: 'Tests CNI responsiveness while avoiding drastic underexposure.'
    });
    actionPlan.push({
      step: 2,
      action: 'Stat DSA Luminex screen and expedited protocol biopsy if creatinine fails to improve within 48 hours.',
      urgency: 'WITHIN_24H',
      rationale: 'Safely differentiates overlapping acute rejection from protracted CNI toxicity.'
    });
  }

  const diagnosticDifferentiation = `Creatinine rose from ${baselineCreatinine} to ${currentCreatinine} mg/dL (+${Math.round(pctRise)}%). Differential analysis yields CNI score ${cniScore} vs Rejection score ${rejectionScore}. Primary suspicion is ${primarySuspect.replace(/_/g, ' ')} (CNI Probability: ${cniProb}, Rejection Probability: ${rejProb}).`;

  return {
    cniToxicityProbability: cniProb,
    rejectionProbability: rejProb,
    primarySuspect,
    differentialScore: { cniScore, rejectionScore },
    diagnosticDifferentiation,
    actionPlan
  };
}

// 4. DATABASE OPERATIONS
export async function saveTdmRecord(record: CniTdmEvaluationResult & { transplantId: number; patientId: number }) {
  const result = await pool.query(
    `INSERT INTO immuno_tdm_records (
      transplant_id, patient_id, drug_name, level_type, measured_level,
      target_range_low, target_range_high, post_op_months, status,
      dose_adjustment_pct, dose_recommendation
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *`,
    [
      record.transplantId,
      record.patientId,
      record.drugName,
      record.levelType,
      record.measuredLevel,
      record.targetRangeLow,
      record.targetRangeHigh,
      record.postOpMonths,
      record.status,
      record.doseAdjustmentPct,
      record.doseRecommendation
    ]
  );
  return result.rows[0];
}

export async function getPatientTdmHistory(patientId: number, transplantId?: number) {
  let query = 'SELECT * FROM immuno_tdm_records WHERE patient_id = $1';
  const params: any[] = [patientId];
  if (transplantId) {
    query += ' AND transplant_id = $2';
    params.push(transplantId);
  }
  query += ' ORDER BY logged_at DESC LIMIT 50';
  const result = await pool.query(query, params);
  return result.rows;
}

export async function logNephrotoxicityEvaluation(evaluation: CniVsRejectionInput & CniVsRejectionResult) {
  const result = await pool.query(
    `INSERT INTO cni_nephrotoxicity_logs (
      transplant_id, patient_id, baseline_creatinine, current_creatinine,
      tacrolimus_trough, interacting_drugs, cni_toxicity_probability,
      rejection_probability, diagnostic_differentiation, action_plan
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      evaluation.transplantId,
      evaluation.patientId,
      evaluation.baselineCreatinine,
      evaluation.currentCreatinine,
      evaluation.tacrolimusTrough,
      JSON.stringify(evaluation.interactingDrugs || []),
      evaluation.cniToxicityProbability,
      evaluation.rejectionProbability,
      evaluation.diagnosticDifferentiation,
      JSON.stringify(evaluation.actionPlan)
    ]
  );
  return result.rows[0];
}

export async function getPatientNephrotoxicityLogs(patientId: number, transplantId?: number) {
  let query = 'SELECT * FROM cni_nephrotoxicity_logs WHERE patient_id = $1';
  const params: any[] = [patientId];
  if (transplantId) {
    query += ' AND transplant_id = $2';
    params.push(transplantId);
  }
  query += ' ORDER BY created_at DESC LIMIT 50';
  const result = await pool.query(query, params);
  return result.rows;
}
