import { query } from '../db';

export interface ArrhythmiaEpInput {
  patientId: number;
  ageYears: number;
  sex: 'M' | 'F';
  heartRate: number;
  rawQtMs: number;
  qrsDurationMs: number;
  serumPotassiumMeqL: number;
  serumMagnesiumMgDl: number;
  onLoopDiuretic: boolean;
  acuteMiOrSepsis: boolean;
  heartFailureEfLt40: boolean;
  structuralCad: boolean;
  wpwPreExcitation: boolean;
  tdpActive?: boolean;
  activeQtProlongingDrugs: string[];
}

export interface ArrhythmiaEpResult {
  id?: number;
  patientId: number;
  qtcBazettMs: number;
  qtcFridericiaMs: number;
  tisdaleRiskScore: number;
  tisdaleRiskTier: 'LOW' | 'MODERATE' | 'HIGH';
  tdpStormRisk: 'LOW' | 'ELEVATED' | 'CRITICAL_TDP_ALERT';
  contraindicatedDrugs: string[];
  epRecommendations: string[];
}

export class ArrhythmiaEpService {
  public static evaluateEp(input: ArrhythmiaEpInput): ArrhythmiaEpResult {
    const contraindicatedDrugs: string[] = [];
    const recs: string[] = [];

    // 1. Wide-QRS Bogossian correction if QRS >= 120 ms
    const effectiveQt =
      input.qrsDurationMs >= 120 ? Math.max(200, input.rawQtMs - 0.485 * input.qrsDurationMs) : input.rawQtMs;

    const rrSec = 60.0 / Math.max(25, input.heartRate);
    const qtcBazettMs = parseFloat((effectiveQt / Math.sqrt(rrSec)).toFixed(1));
    const qtcFridericiaMs = parseFloat((effectiveQt / Math.cbrt(rrSec)).toFixed(1));

    // 2. Tisdale QTc Prolongation Risk Score
    let tisdale = 0;
    if (input.ageYears >= 68) tisdale += 1;
    if (input.sex === 'F') tisdale += 1;
    if (input.onLoopDiuretic) tisdale += 1;
    if (input.serumPotassiumMeqL <= 3.5) tisdale += 2;
    if (qtcFridericiaMs >= 450) tisdale += 2;
    if (input.acuteMiOrSepsis) tisdale += 2;
    if (input.heartFailureEfLt40) tisdale += 3;
    if (input.activeQtProlongingDrugs.length >= 1) tisdale += 3;
    if (input.activeQtProlongingDrugs.length >= 2) tisdale += 3;

    const tisdaleRiskTier: ArrhythmiaEpResult['tisdaleRiskTier'] =
      tisdale >= 11 ? 'HIGH' : tisdale >= 7 ? 'MODERATE' : 'LOW';

    // 3. Torsades de Pointes (TdP) Risk & Storm Protocol
    let tdpStormRisk: ArrhythmiaEpResult['tdpStormRisk'] = 'LOW';
    if (input.tdpActive || qtcFridericiaMs >= 500) {
      tdpStormRisk = 'CRITICAL_TDP_ALERT';
      contraindicatedDrugs.push('Amiodarone', 'Sotalol', 'Procainamide', 'Haloperidol', 'Ondansetron', 'Levofloxacin');
      recs.push(
        `CRITICAL TORSADES DE POINTES RISK (QTcF: ${qtcFridericiaMs} ms): Administer Magnesium Sulfate 2g IV STAT, replete K+ to 4.5-5.0 mEq/L, hold all QT-prolonging drugs, and prepare overdrive pacing (90-110 bpm) or Isoproterenol.`
      );
    } else if (qtcFridericiaMs >= 470 || tisdaleRiskTier === 'HIGH') {
      tdpStormRisk = 'ELEVATED';
      recs.push(`ELEVATED QTc RISK (Tisdale ${tisdale}): Check daily 12-lead ECG, maintain K+ > 4.0 and Mg2+ > 2.0 mg/dL, and deprescribe non-essential QT drugs.`);
    }

    // 4. Vaughan-Williams Contraindication Matrix
    if (input.wpwPreExcitation) {
      contraindicatedDrugs.push('Adenosine', 'Verapamil', 'Diltiazem', 'Digoxin', 'Metoprolol (AV Nodal Blockers)');
      recs.push('WPW PRE-EXCITATION GUARD: Strictly avoid AV nodal blockers (risk of VF degeneration). Use IV Procainamide or synchronized DC cardioversion.');
    }
    if (input.structuralCad || input.acuteMiOrSepsis) {
      contraindicatedDrugs.push('Flecainide', 'Propafenone (Class Ic CAST Contraindication)');
      recs.push('STRUCTURAL / ISCHEMIC HEART GUARD: Class Ic antiarrhythmics strictly contraindicated (CAST mortality hazard).');
    }
    if (input.heartFailureEfLt40) {
      contraindicatedDrugs.push('Verapamil', 'Diltiazem (Negative Inotropes in HFrEF)');
      recs.push('HFrEF (EF < 40%) GUARD: Avoid non-DHP calcium channel blockers.');
    }

    const uniqueContraindicated = Array.from(new Set(contraindicatedDrugs));

    return {
      patientId: input.patientId,
      qtcBazettMs,
      qtcFridericiaMs,
      tisdaleRiskScore: tisdale,
      tisdaleRiskTier,
      tdpStormRisk,
      contraindicatedDrugs: uniqueContraindicated,
      epRecommendations: recs
    };
  }

  public static async recordEpEval(input: ArrhythmiaEpInput): Promise<ArrhythmiaEpResult> {
    const result = this.evaluateEp(input);
    const res = await query(
      `INSERT INTO arrhythmia_ep_evals (
        patient_id, qtc_fredericia_ms, tisdale_risk_score, tdp_storm_risk,
        contraindicated_drugs, ep_output
      ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;`,
      [
        result.patientId,
        result.qtcFridericiaMs,
        result.tisdaleRiskScore,
        result.tdpStormRisk,
        JSON.stringify(result.contraindicatedDrugs),
        JSON.stringify(result)
      ]
    );
    if (res.rows.length > 0) {
      result.id = res.rows[0].id;
    }
    return result;
  }
}
