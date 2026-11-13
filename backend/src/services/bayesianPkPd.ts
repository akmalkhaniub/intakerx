import { query } from '../db';

export type PkDrugName = 'VANCOMYCIN' | 'MEROPENEM' | 'PIPERACILLIN_TAZOBACTAM' | 'GENTAMICIN';

export interface BayesianPkPdInput {
  patientId: number;
  drugName: PkDrugName;
  ageYears: number;
  sex: 'M' | 'F';
  weightKg: number;
  serumCreatinineMgDl: number;
  crrtActive?: boolean;
  sepsisThirdSpacing?: boolean;
  pathogenMicMgL?: number; // default 1.0 for Vanco
  measuredTroughMgL?: number; // optional observed trough for Bayesian posterior update
  concomitantNephrotoxins?: boolean;
}

export interface BayesianPkPdResult {
  id?: number;
  patientId: number;
  drugName: PkDrugName;
  estimatedCrClMlMin: number;
  arcDetected: boolean;
  estimatedVdL: number;
  estimatedClearanceLH: number;
  predictedAuc24: number;
  targetAucMicRatio: number;
  loadingDoseMg: number;
  recommendedRegimen: string;
  nephrotoxicityRisk: 'LOW' | 'MODERATE' | 'HIGH';
  clinicalAlerts: string[];
}

export class BayesianPkPdService {
  private static roundToNearest(val: number, step: number): number {
    return Math.round(val / step) * step;
  }

  public static evaluateDosing(input: BayesianPkPdInput): BayesianPkPdResult {
    const alerts: string[] = [];
    const mic = input.pathogenMicMgL ?? 1.0;

    // 1. Cockcroft-Gault Creatinine Clearance
    let crcl = ((140 - input.ageYears) * input.weightKg) / (72 * Math.max(0.4, input.serumCreatinineMgDl));
    if (input.sex === 'F') crcl *= 0.85;
    if (input.crrtActive) {
      crcl = 35.0; // Effective CRRT effluent clearance ~ 30-35 mL/min
      alerts.push('CRRT ACTIVE: Using effective extracorporeal effluent clearance (35 mL/min) instead of native serum creatinine.');
    }
    const estimatedCrClMlMin = parseFloat(crcl.toFixed(1));
    const arcDetected = !input.crrtActive && estimatedCrClMlMin > 130.0;

    if (arcDetected) {
      alerts.push(`AUGMENTED RENAL CLEARANCE (ARC) DETECTED: CrCl ${estimatedCrClMlMin} mL/min (>130). Standard dosing risks subtherapeutic failure.`);
    }

    // 2. Volume of Distribution (Vd)
    const vdPerKg = input.sepsisThirdSpacing ? 0.85 : 0.70;
    const estimatedVdL = parseFloat((vdPerKg * input.weightKg).toFixed(2));

    let estimatedClearanceLH = 0;
    let predictedAuc24 = 0;
    let loadingDoseMg = 0;
    let recommendedRegimen = '';
    let nephrotoxicityRisk: 'LOW' | 'MODERATE' | 'HIGH' = 'LOW';

    if (input.drugName === 'VANCOMYCIN') {
      // Population prior CL_vanco (L/h)
      let clVanco = 0.048 * estimatedCrClMlMin + 0.35;

      // Bayesian MAP posterior update if measured trough is provided (reference trough = 15 mg/L)
      if (input.measuredTroughMgL !== undefined && input.measuredTroughMgL > 0) {
        const troughRatio = 15.0 / input.measuredTroughMgL;
        // Damped Bayesian posterior shift
        clVanco = clVanco * (0.6 + 0.4 * Math.min(2.0, Math.max(0.4, troughRatio)));
        alerts.push(`Bayesian posterior updated using observed trough ${input.measuredTroughMgL} mg/L.`);
      }

      estimatedClearanceLH = parseFloat(clVanco.toFixed(2));
      loadingDoseMg = Math.min(3000, this.roundToNearest(25 * input.weightKg, 250));

      // Target AUC24 = 500 * MIC (within 400-600 mg*h/L optimal window)
      const targetAuc = Math.min(600, Math.max(400, 500 * mic));
      const idealDailyDose = targetAuc * clVanco;

      // Choose interval based on CrCl / ARC
      const intervalHours = arcDetected ? 8 : estimatedCrClMlMin >= 50 ? 12 : estimatedCrClMlMin >= 25 ? 24 : 48;
      const dosesPerDay = 24 / intervalHours;
      const singleDose = Math.min(2000, Math.max(500, this.roundToNearest(idealDailyDose / dosesPerDay, 250)));
      const actualDailyDose = singleDose * dosesPerDay;

      predictedAuc24 = parseFloat((actualDailyDose / clVanco).toFixed(1));
      recommendedRegimen = `Load ${loadingDoseMg} mg IV x1, then ${singleDose} mg IV q${intervalHours}h (Target AUC24/MIC: 400-600)`;

      if (mic >= 2.0) {
        alerts.push(`HIGH VANCOMYCIN MIC (${mic} mg/L): Achieving AUC/MIC >= 400 risks nephrotoxicity (AUC > 600). Consider Daptomycin or Linezolid.`);
      }
      if (predictedAuc24 > 600 || (input.concomitantNephrotoxins && predictedAuc24 > 520)) {
        nephrotoxicityRisk = 'HIGH';
        alerts.push('HIGH NEPHROTOXICITY RISK: Predicted AUC24 > 600 or concomitant nephrotoxins (e.g. Pip-Tazo). Monitor SCr daily.');
      } else if (predictedAuc24 > 550 || input.concomitantNephrotoxins) {
        nephrotoxicityRisk = 'MODERATE';
      }
    } else if (input.drugName === 'MEROPENEM' || input.drugName === 'PIPERACILLIN_TAZOBACTAM') {
      estimatedClearanceLH = parseFloat((0.08 * estimatedCrClMlMin + 1.2).toFixed(2));
      loadingDoseMg = input.drugName === 'MEROPENEM' ? 1000 : 4500;
      const extendedInfusion = arcDetected || mic >= 4.0 || input.sepsisThirdSpacing;
      const infusionStr = extendedInfusion ? 'over 3h extended infusion' : 'over 30min';

      if (input.drugName === 'MEROPENEM') {
        const dose = estimatedCrClMlMin >= 50 ? 1000 : 500;
        const freq = arcDetected ? 'q6h' : estimatedCrClMlMin >= 25 ? 'q8h' : 'q12h';
        recommendedRegimen = `Load ${loadingDoseMg} mg IV x1, then ${dose} mg IV ${freq} ${infusionStr} (100% fT>MIC)`;
        predictedAuc24 = parseFloat(((dose * (24 / (freq === 'q6h' ? 6 : freq === 'q8h' ? 8 : 12))) / estimatedClearanceLH).toFixed(1));
      } else {
        const dose = estimatedCrClMlMin >= 40 ? 4500 : 2250;
        const freq = arcDetected ? 'q6h (continuous 18g/24h alt)' : estimatedCrClMlMin >= 20 ? 'q8h' : 'q12h';
        recommendedRegimen = `Load 4500 mg IV x1, then ${dose} mg IV ${freq} ${infusionStr}`;
        predictedAuc24 = parseFloat(((dose * 3) / estimatedClearanceLH).toFixed(1));
      }
    } else {
      // GENTAMICIN Hartford Extended-Interval Nomogram (7 mg/kg)
      estimatedClearanceLH = parseFloat((0.055 * estimatedCrClMlMin + 0.2).toFixed(2));
      loadingDoseMg = this.roundToNearest(7 * input.weightKg, 20);
      const interval = estimatedCrClMlMin >= 60 ? 24 : estimatedCrClMlMin >= 40 ? 36 : 48;
      recommendedRegimen = `${loadingDoseMg} mg IV (7 mg/kg Hartford Nomogram) q${interval}h; obtain 6-14h post-dose level.`;
      predictedAuc24 = parseFloat(((loadingDoseMg * (24 / interval)) / estimatedClearanceLH).toFixed(1));
      nephrotoxicityRisk = estimatedCrClMlMin < 40 ? 'HIGH' : 'MODERATE';
    }

    const targetAucMicRatio = parseFloat((predictedAuc24 / mic).toFixed(1));

    return {
      patientId: input.patientId,
      drugName: input.drugName,
      estimatedCrClMlMin,
      arcDetected,
      estimatedVdL,
      estimatedClearanceLH,
      predictedAuc24,
      targetAucMicRatio,
      loadingDoseMg,
      recommendedRegimen,
      nephrotoxicityRisk,
      clinicalAlerts: alerts
    };
  }

  public static async recordDosing(input: BayesianPkPdInput): Promise<BayesianPkPdResult> {
    const result = this.evaluateDosing(input);
    const res = await query(
      `INSERT INTO bayesian_pk_pd_dosing (
        patient_id, drug_name, estimated_crcl_ml_min, arc_detected, estimated_vd_l,
        predicted_auc24, target_auc_mic_ratio, recommended_regimen, nephrotoxicity_risk, pk_profile
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id;`,
      [
        result.patientId,
        result.drugName,
        result.estimatedCrClMlMin,
        result.arcDetected,
        result.estimatedVdL,
        result.predictedAuc24,
        result.targetAucMicRatio,
        result.recommendedRegimen,
        result.nephrotoxicityRisk,
        JSON.stringify(result)
      ]
    );
    if (res.rows.length > 0) {
      result.id = res.rows[0].id;
    }
    return result;
  }
}
