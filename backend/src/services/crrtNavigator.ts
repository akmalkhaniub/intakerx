import { pool } from '../db';

export interface KdigoInput {
  baselineCreatinineMgPerDl: number;
  currentCreatinineMgPerDl: number;
  creatinineRise48hMgPerDl?: number;
  urineOutputMlPerKgPerHour?: number;
  urineOutputDurationHours?: number;
  alreadyOnRrt?: boolean;
}

export interface KdigoResult {
  stage: 0 | 1 | 2 | 3;
  stageName: string;
  criteriaTriggered: string[];
  crrtUrgentIndications: string[];
}

export interface CrrtPrescriptionInput {
  modality: 'CVVHDF' | 'CVVH' | 'CVVHD' | 'SCUF';
  patientWeightKg: number;
  targetDeliveredDoseMlKgHr: number; // e.g. 20 - 25
  anticipatedDowntimePercent?: number; // e.g. 15%
  netUltrafiltrationRateMlHr: number; // e.g. 150
  hematocritPercent?: number; // default 30%
  replacementPredilutionPercent?: number; // default 50%
}

export interface CrrtPrescriptionResult {
  modality: string;
  prescribedEffluentDoseMlKgHr: number;
  totalEffluentRateMlHr: number;
  bloodFlowRateMlMin: number;
  dialysateFlowRateMlHr: number;
  replacementFluidRateMlHr: number;
  predilutionReplacementRateMlHr: number;
  postdilutionReplacementRateMlHr: number;
  netUltrafiltrationRateMlHr: number;
  filtrationFractionPercent: number;
  filtrationFractionWarning: string | null;
  dosingRecommendations: string[];
}

export interface FilterPressureInput {
  filterInflowPressureMmhg: number;
  venousReturnPressureMmhg: number;
  effluentPressureMmhg: number;
  accessArterialPressureMmhg?: number;
}

export interface FilterPressureResult {
  transmembranePressureMmhg: number;
  pressureDropMmhg: number;
  clottingRisk: 'optimal' | 'moderate_fouling' | 'high_clotting_risk' | 'critical_clot_immediate_change';
  warnings: string[];
  suggestedAction: string;
}

export interface RcaInput {
  postFilterIonizedCaMmolL: number;
  systemicIonizedCaMmolL: number;
  totalSerumCalciumMgPerDl: number;
  currentCitrateInfusionMmolHr?: number;
  currentCalciumInfusionMmolHr?: number;
  arterialPh?: number;
}

export interface RcaResult {
  totalSerumCalciumMmolL: number;
  totalToIonizedCaRatio: number;
  citrateToxicityDetected: boolean;
  circuitAnticoagulationStatus: 'Subtherapeutic (Clotting Risk)' | 'Target Therapeutic' | 'Over-anticoagulated';
  systemicCalciumStatus: 'Severe Hypocalcemia' | 'Mild Hypocalcemia' | 'Normocalcemic' | 'Hypercalcemic';
  citrateTitrationDirective: string;
  calciumTitrationDirective: string;
  emergencyActions: string[];
}

/**
 * 1. KDIGO AKI Staging Calculator
 */
export function evaluateKdigoStage(input: KdigoInput): KdigoResult {
  const criteria: string[] = [];
  let stage: 0 | 1 | 2 | 3 = 0;

  if (input.alreadyOnRrt) {
    stage = 3;
    criteria.push('Patient is currently receiving Renal Replacement Therapy (KDIGO Stage 3 by definition)');
  } else {
    const ratio = input.currentCreatinineMgPerDl / Math.max(input.baselineCreatinineMgPerDl, 0.1);
    const rise = input.creatinineRise48hMgPerDl || (input.currentCreatinineMgPerDl - input.baselineCreatinineMgPerDl);

    // Stage 3 checks
    if (ratio >= 3.0 || input.currentCreatinineMgPerDl >= 4.0) {
      stage = 3;
      criteria.push(`Serum creatinine ${input.currentCreatinineMgPerDl} mg/dL is ≥ 3.0× baseline or ≥ 4.0 mg/dL`);
    } else if (input.urineOutputMlPerKgPerHour !== undefined && input.urineOutputDurationHours !== undefined) {
      if (input.urineOutputMlPerKgPerHour < 0.3 && input.urineOutputDurationHours >= 24) {
        stage = 3;
        criteria.push(`Urine output < 0.3 mL/kg/h for ${input.urineOutputDurationHours} hours`);
      } else if (input.urineOutputMlPerKgPerHour === 0 && input.urineOutputDurationHours >= 12) {
        stage = 3;
        criteria.push(`Anuria for ${input.urineOutputDurationHours} hours`);
      }
    }

    // Stage 2 checks
    if (stage < 2) {
      if (ratio >= 2.0 && ratio < 3.0) {
        stage = 2;
        criteria.push(`Serum creatinine is 2.0 - 2.9× baseline (${Math.round(ratio * 10) / 10}×)`);
      } else if (input.urineOutputMlPerKgPerHour !== undefined && input.urineOutputDurationHours !== undefined) {
        if (input.urineOutputMlPerKgPerHour < 0.5 && input.urineOutputDurationHours >= 12) {
          stage = 2;
          criteria.push(`Urine output < 0.5 mL/kg/h for ${input.urineOutputDurationHours} hours`);
        }
      }
    }

    // Stage 1 checks
    if (stage < 1) {
      if (rise >= 0.3) {
        stage = 1;
        criteria.push(`Acute creatinine rise of ${Math.round(rise * 100) / 100} mg/dL ≥ 0.3 mg/dL in 48 hours`);
      } else if (ratio >= 1.5 && ratio < 2.0) {
        stage = 1;
        criteria.push(`Serum creatinine is 1.5 - 1.9× baseline (${Math.round(ratio * 10) / 10}×)`);
      } else if (input.urineOutputMlPerKgPerHour !== undefined && input.urineOutputDurationHours !== undefined) {
        if (input.urineOutputMlPerKgPerHour < 0.5 && input.urineOutputDurationHours >= 6) {
          stage = 1;
          criteria.push(`Urine output < 0.5 mL/kg/h for ${input.urineOutputDurationHours} hours`);
        }
      }
    }
  }

  const stageNames: Record<number, string> = {
    0: 'No Documented AKI',
    1: 'KDIGO Stage 1 AKI',
    2: 'KDIGO Stage 2 AKI',
    3: 'KDIGO Stage 3 AKI (Severe / RRT Eligible)'
  };

  const crrtUrgentIndications: string[] = [
    'Acidemia: Refractory metabolic acidosis (pH < 7.15 despite medical therapy)',
    'Electrolytes: Severe refractory hyperkalemia (K+ > 6.5 mEq/L or ECG changes)',
    'Ingestion: Toxic alcohols (methanol, ethylene glycol), salicylates, lithium',
    'Overload: Diuretic-refractory hypervolemia / non-cardiogenic pulmonary edema',
    'Uremia: Uremic pericarditis, encephalopathy, bleeding diathesis, or asterixis'
  ];

  return {
    stage,
    stageName: stageNames[stage],
    criteriaTriggered: criteria.length > 0 ? criteria : ['Serum creatinine and urine output within baseline parameters'],
    crrtUrgentIndications
  };
}

/**
 * 2. CRRT Prescription & Effluent Dose Calculator
 */
export function calculateCrrtPrescription(input: CrrtPrescriptionInput): CrrtPrescriptionResult {
  const weight = input.patientWeightKg;
  const downtimeFactor = 1 / (1 - ((input.anticipatedDowntimePercent || 15) / 100));
  
  // Prescribed effluent dose accounts for ~15% procedural/filter downtime to ensure delivered dose meets KDIGO 20-25 mL/kg/h target
  const prescribedDose = Math.round(input.targetDeliveredDoseMlKgHr * downtimeFactor * 10) / 10;
  
  // Total Effluent = Prescribed Dose * Weight (mL/hr)
  const totalEffluentRateMlHr = Math.round(prescribedDose * weight);

  let bloodFlowRateMlMin = 200; // standard 150-250 mL/min
  let dialysateFlowRateMlHr = 0;
  let replacementFluidRateMlHr = 0;
  let predilutionReplacementRateMlHr = 0;
  let postdilutionReplacementRateMlHr = 0;

  const netUf = input.netUltrafiltrationRateMlHr;

  if (input.modality === 'SCUF') {
    // Pure ultrafiltration, no dialysate, no replacement
    dialysateFlowRateMlHr = 0;
    replacementFluidRateMlHr = 0;
    bloodFlowRateMlMin = 150;
  } else if (input.modality === 'CVVHD') {
    // Pure diffusion: effluent = dialysate + net UF
    dialysateFlowRateMlHr = Math.max(0, totalEffluentRateMlHr - netUf);
    replacementFluidRateMlHr = 0;
    bloodFlowRateMlMin = 180;
  } else if (input.modality === 'CVVH') {
    // Pure convection: effluent = replacement + net UF
    replacementFluidRateMlHr = Math.max(0, totalEffluentRateMlHr - netUf);
    dialysateFlowRateMlHr = 0;
    const prePct = (input.replacementPredilutionPercent || 50) / 100;
    predilutionReplacementRateMlHr = Math.round(replacementFluidRateMlHr * prePct);
    postdilutionReplacementRateMlHr = replacementFluidRateMlHr - predilutionReplacementRateMlHr;
    bloodFlowRateMlMin = 220;
  } else {
    // CVVHDF: 50% diffusion / 50% convection split of clearance
    const clearanceNeeds = Math.max(0, totalEffluentRateMlHr - netUf);
    dialysateFlowRateMlHr = Math.round(clearanceNeeds * 0.5);
    replacementFluidRateMlHr = clearanceNeeds - dialysateFlowRateMlHr;
    const prePct = (input.replacementPredilutionPercent || 50) / 100;
    predilutionReplacementRateMlHr = Math.round(replacementFluidRateMlHr * prePct);
    postdilutionReplacementRateMlHr = replacementFluidRateMlHr - predilutionReplacementRateMlHr;
    bloodFlowRateMlMin = 200;
  }

  // Calculate Filtration Fraction (FF)
  // FF (%) = (Ultrafiltration Rate / Plasma Flow Rate) * 100
  // Ultrafiltration Rate = Net UF + Replacement Fluid Rate
  // Plasma Flow Rate (Qp) = Blood Flow Rate (mL/min) * 60 * (1 - Hct)
  const hct = (input.hematocritPercent || 30) / 100;
  const plasmaFlowRateMlHr = bloodFlowRateMlMin * 60 * (1 - hct);
  const totalUfMlHr = netUf + replacementFluidRateMlHr;
  
  // Adjusted for predilution: FF = Total UF / (Plasma Flow + Predilution Rate)
  const filtrationFraction = Math.round((totalUfMlHr / (plasmaFlowRateMlHr + predilutionReplacementRateMlHr)) * 1000) / 10;

  let filtrationFractionWarning: string | null = null;
  if (filtrationFraction > 25) {
    filtrationFractionWarning = `CRITICAL: Filtration Fraction (${filtrationFraction}%) exceeds safe 20-25% threshold. High risk of circuit hemoconcentration and rapid filter clotting! Increase Blood Flow Rate or shift more replacement to predilution.`;
  } else if (filtrationFraction > 20) {
    filtrationFractionWarning = `CAUTION: Filtration Fraction (${filtrationFraction}%) is near upper limit (20-25%). Closely monitor TMP and fiber pressure drop.`;
  }

  const dosingRecommendations: string[] = [
    `Target KDIGO delivered dose: ${input.targetDeliveredDoseMlKgHr} mL/kg/h (prescribed ${prescribedDose} mL/kg/h with ${input.anticipatedDowntimePercent || 15}% buffer)`,
    `Recommended blood flow rate: ${bloodFlowRateMlMin} mL/min (vascular access target)`,
    `Net patient fluid removal (Ultrafiltration): ${netUf} mL/hr`
  ];

  if (input.modality === 'CVVHDF' || input.modality === 'CVVH') {
    dosingRecommendations.push(`Replacement split: ${predilutionReplacementRateMlHr} mL/hr Predilution (${input.replacementPredilutionPercent || 50}%) / ${postdilutionReplacementRateMlHr} mL/hr Postdilution`);
  }

  return {
    modality: input.modality,
    prescribedEffluentDoseMlKgHr: prescribedDose,
    totalEffluentRateMlHr,
    bloodFlowRateMlMin,
    dialysateFlowRateMlHr,
    replacementFluidRateMlHr,
    predilutionReplacementRateMlHr,
    postdilutionReplacementRateMlHr,
    netUltrafiltrationRateMlHr: netUf,
    filtrationFractionPercent: filtrationFraction,
    filtrationFractionWarning,
    dosingRecommendations
  };
}

/**
 * 3. Filter Clotting & Transmembrane Pressure (TMP) Watchdog
 */
export function evaluateFilterPressures(input: FilterPressureInput): FilterPressureResult {
  // TMP = (Ppre + Pven) / 2 - Peff
  const tmp = Math.round(((input.filterInflowPressureMmhg + input.venousReturnPressureMmhg) / 2) - input.effluentPressureMmhg);
  // Pressure drop = Ppre - Pven
  const deltaP = Math.round(input.filterInflowPressureMmhg - input.venousReturnPressureMmhg);

  const warnings: string[] = [];
  let clottingRisk: 'optimal' | 'moderate_fouling' | 'high_clotting_risk' | 'critical_clot_immediate_change' = 'optimal';
  let suggestedAction = 'Maintain current circuit parameters; continuous pressure telemetry.';

  if (tmp >= 300 || deltaP >= 200) {
    clottingRisk = 'critical_clot_immediate_change';
    warnings.push(`CRITICAL FILTER FAILURE: TMP is ${tmp} mmHg (≥300 mmHg) or Delta-P is ${deltaP} mmHg (≥200 mmHg).`);
    warnings.push('Hollow fiber thrombosis has occurred. Return blood immediately to prevent catastrophic circuit clotting and patient blood loss!');
    suggestedAction = 'EMERGENCY: Initiate blood rinseback and replace CRRT circuit/membrane immediately.';
  } else if (tmp >= 250 || deltaP >= 150) {
    clottingRisk = 'high_clotting_risk';
    warnings.push(`High Clotting Risk: Elevated TMP (${tmp} mmHg) and/or Delta-P (${deltaP} mmHg) indicates severe membrane protein fouling.`);
    warnings.push('Prepare replacement circuit and prime with saline at bedside.');
    suggestedAction = 'Increase citrate pre-filter or saline flushes; notify ICU charge nurse for anticipated circuit change.';
  } else if (tmp >= 180 || deltaP >= 100) {
    clottingRisk = 'moderate_fouling';
    warnings.push(`Moderate Membrane Fouling: TMP ${tmp} mmHg (normal < 150-180 mmHg).`);
    suggestedAction = 'Verify circuit anticoagulation adequacy; check post-filter ionized calcium levels.';
  }

  return {
    transmembranePressureMmhg: tmp,
    pressureDropMmhg: deltaP,
    clottingRisk,
    warnings,
    suggestedAction
  };
}

/**
 * 4. Regional Citrate Anticoagulation (RCA) & Citrate Toxicity Sentinel
 */
export function evaluateRcaCitrateProtocol(input: RcaInput): RcaResult {
  // Total serum calcium in mmol/L = Total Ca in mg/dL * 0.25
  const totalCaMmol = Math.round((input.totalSerumCalciumMgPerDl * 0.25) * 100) / 100;
  
  // Total-to-ionized calcium ratio = Total Ca (mmol/L) / Systemic iCa (mmol/L)
  const ratio = Math.round((totalCaMmol / Math.max(input.systemicIonizedCaMmolL, 0.1)) * 100) / 100;

  // Pathognomonic Citrate Accumulation: Ratio > 2.5
  const citrateToxicityDetected = ratio >= 2.5 || (input.arterialPh !== undefined && input.arterialPh < 7.20 && ratio >= 2.2);

  let circuitStatus: 'Subtherapeutic (Clotting Risk)' | 'Target Therapeutic' | 'Over-anticoagulated' = 'Target Therapeutic';
  let citrateDirective = 'Maintain current citrate infusion rate.';

  if (input.postFilterIonizedCaMmolL > 0.35) {
    circuitStatus = 'Subtherapeutic (Clotting Risk)';
    citrateDirective = `INCREASE pre-filter Citrate infusion by 0.2 - 0.4 mmol/hr (post-filter iCa ${input.postFilterIonizedCaMmolL} > 0.35 mmol/L threshold; circuit clotting risk).`;
  } else if (input.postFilterIonizedCaMmolL < 0.25) {
    circuitStatus = 'Over-anticoagulated';
    citrateDirective = `DECREASE pre-filter Citrate infusion by 0.2 - 0.4 mmol/hr (post-filter iCa ${input.postFilterIonizedCaMmolL} < 0.25 mmol/L).`;
  }

  let systemicStatus: 'Severe Hypocalcemia' | 'Mild Hypocalcemia' | 'Normocalcemic' | 'Hypercalcemic' = 'Normocalcemic';
  let calciumDirective = 'Maintain systemic Calcium infusion rate.';

  if (input.systemicIonizedCaMmolL < 1.00) {
    systemicStatus = 'Severe Hypocalcemia';
    calciumDirective = `URGENT: Administer 10% Calcium Chloride 1g (or Calcium Gluconate 3g) IV bolus over 10 min and increase continuous calcium infusion by 20-30%.`;
  } else if (input.systemicIonizedCaMmolL < 1.10) {
    systemicStatus = 'Mild Hypocalcemia';
    calciumDirective = `Increase continuous Calcium infusion by 10-15% (systemic iCa ${input.systemicIonizedCaMmolL} < 1.10 mmol/L target).`;
  } else if (input.systemicIonizedCaMmolL > 1.30) {
    systemicStatus = 'Hypercalcemic';
    calciumDirective = `Decrease continuous Calcium infusion by 10-20% (systemic iCa ${input.systemicIonizedCaMmolL} > 1.30 mmol/L).`;
  }

  const emergencyActions: string[] = [];
  if (citrateToxicityDetected) {
    emergencyActions.push(`CRITICAL ALERT: Citrate "Lock" / Toxicity Confirmed! Total-to-Ionized Ca Ratio is ${ratio} (Threshold ≥ 2.5).`);
    emergencyActions.push('Hepatic / hypoperfusion failure is preventing citrate metabolism, leading to chelation of systemic calcium.');
    emergencyActions.push('IMMEDIATELY REDUCE or STOP Citrate infusion. Increase dialysate flow rate to clear circulating calcium-citrate complexes.');
    emergencyActions.push('Switch to systemic unfractionated heparin or anticoagulation-free CRRT with hourly saline flushes.');
    emergencyActions.push('Aggressively correct systemic hypocalcemia with IV Calcium Chloride.');
  }

  return {
    totalSerumCalciumMmolL: totalCaMmol,
    totalToIonizedCaRatio: ratio,
    citrateToxicityDetected,
    circuitAnticoagulationStatus: circuitStatus,
    systemicCalciumStatus: systemicStatus,
    citrateTitrationDirective: citrateDirective,
    calciumTitrationDirective: calciumDirective,
    emergencyActions
  };
}

/**
 * 5. Database Persistence & Query Helpers
 */
export async function createCrrtSession(data: {
  patientId: number;
  kdigoStage: number;
  modality: string;
  prescribedEffluentDoseMlKgHr: number;
  patientWeightKg: number;
  bloodFlowRateMlMin: number;
  dialysateFlowRateMlHr?: number;
  replacementFluidFlowRateMlHr?: number;
  replacementPredilutionPercent?: number;
  netUltrafiltrationTargetMlHr: number;
  anticoagulationType?: string;
  filterType?: string;
}) {
  const result = await pool.query(
    `INSERT INTO crrt_treatment_sessions (
      patient_id, kdigo_stage, modality, prescribed_effluent_dose_ml_kg_hr,
      patient_weight_kg, blood_flow_rate_ml_min, dialysate_flow_rate_ml_hr,
      replacement_fluid_flow_rate_ml_hr, replacement_predilution_percent,
      net_ultrafiltration_target_ml_hr, anticoagulation_type, filter_type
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *`,
    [
      data.patientId,
      data.kdigoStage,
      data.modality,
      data.prescribedEffluentDoseMlKgHr,
      data.patientWeightKg,
      data.bloodFlowRateMlMin,
      data.dialysateFlowRateMlHr || 0,
      data.replacementFluidFlowRateMlHr || 0,
      data.replacementPredilutionPercent || 50,
      data.netUltrafiltrationTargetMlHr,
      data.anticoagulationType || 'Regional_Citrate',
      data.filterType || 'AN69ST_1.5m2'
    ]
  );
  return result.rows[0];
}

export async function recordHourlyTelemetry(data: {
  sessionId: number;
  hourNumber: number;
  transmembranePressureMmhg: number;
  filterPressureDropMmhg: number;
  postFilterIonizedCaMmolL?: number;
  systemicIonizedCaMmolL?: number;
  totalSerumCaMgDl?: number;
  totalToIonizedCaRatio?: number;
  citrateToxicityAlert?: boolean;
  filterClottingRisk?: string;
}) {
  const result = await pool.query(
    `INSERT INTO crrt_hourly_telemetry (
      session_id, hour_number, transmembrane_pressure_mmhg, filter_pressure_drop_mmhg,
      post_filter_ionized_ca_mmol_l, systemic_ionized_ca_mmol_l, total_serum_ca_mg_dl,
      total_to_ionized_ca_ratio, citrate_toxicity_alert, filter_clotting_risk
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      data.sessionId,
      data.hourNumber,
      data.transmembranePressureMmhg,
      data.filterPressureDropMmhg,
      data.postFilterIonizedCaMmolL || null,
      data.systemicIonizedCaMmolL || null,
      data.totalSerumCaMgDl || null,
      data.totalToIonizedCaRatio || null,
      data.citrateToxicityAlert || false,
      data.filterClottingRisk || 'low'
    ]
  );
  return result.rows[0];
}

export async function getCrrtSessionDetails(sessionId: number) {
  const sessRes = await pool.query(`SELECT * FROM crrt_treatment_sessions WHERE id = $1`, [sessionId]);
  if (sessRes.rows.length === 0) return null;
  const telemetryRes = await pool.query(
    `SELECT * FROM crrt_hourly_telemetry WHERE session_id = $1 ORDER BY hour_number DESC`,
    [sessionId]
  );
  return {
    ...sessRes.rows[0],
    hourlyTelemetry: telemetryRes.rows
  };
}

export async function listActiveCrrtSessions(limit: number = 20) {
  const result = await pool.query(
    `SELECT * FROM crrt_treatment_sessions ORDER BY started_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
}
