import { query } from '../db';

export type SepsisSubphenotype = 'ALPHA_LOW_RISK' | 'BETA_RENAL_CHRONIC' | 'GAMMA_HYPERINFLAMMATORY' | 'DELTA_SHOCK_COAGULOPATHIC';

export interface SepsisSubphenotypeInput {
  patientId: number;
  ageYears: number;
  heartRate: number;
  systolicBp: number;
  mapMmhg: number;
  respiratoryRate: number;
  spo2Pct: number;
  supplementalO2: boolean;
  tempCelsius: number;
  gcsScore: number;
  pao2Fio2Ratio: number;
  plateletsK: number; // e.g. 150 = 150,000/uL
  bilirubinMgDl: number;
  creatinineMgDl: number;
  lactateMmolL: number;
  vasopressorActive: boolean;
  crpMgL?: number;
  minutesSinceTimeZero: number;
  lactateDrawn: boolean;
  culturesDrawn: boolean;
  antibioticsGiven: boolean;
  fluidBolusStarted: boolean;
}

export interface SepsisSubphenotypeResult {
  id?: number;
  patientId: number;
  sofaScore: number;
  qsofaScore: number;
  news2Score: number;
  subphenotype: SepsisSubphenotype;
  bundle1hCompliant: boolean;
  bundleRemainingMinutes: number;
  missingBundleItems: string[];
  immunomodulationPlan: {
    corticosteroidDirective: string;
    fluidStrategy: string;
    ventilatoryTarget: string;
  };
  clinicalAlerts: string[];
}

export class SepsisSubphenotypeService {
  public static evaluateSepsis(input: SepsisSubphenotypeInput): SepsisSubphenotypeResult {
    const alerts: string[] = [];

    // 1. qSOFA (0-3)
    let qsofa = 0;
    if (input.respiratoryRate >= 22) qsofa++;
    if (input.gcsScore < 15) qsofa++;
    if (input.systolicBp <= 100) qsofa++;

    // 2. NEWS2
    let news2 = 0;
    if (input.respiratoryRate <= 8 || input.respiratoryRate >= 25) news2 += 3;
    else if (input.respiratoryRate >= 21) news2 += 2;
    else if (input.respiratoryRate <= 11) news2 += 1;

    if (input.spo2Pct <= 91) news2 += 3;
    else if (input.spo2Pct <= 93) news2 += 2;
    else if (input.spo2Pct <= 95) news2 += 1;

    if (input.supplementalO2) news2 += 2;
    if (input.tempCelsius <= 35.0) news2 += 3;
    else if (input.tempCelsius >= 39.1) news2 += 2;
    else if (input.tempCelsius <= 36.0 || input.tempCelsius >= 38.1) news2 += 1;

    if (input.systolicBp <= 90 || input.systolicBp >= 220) news2 += 3;
    else if (input.systolicBp <= 100) news2 += 2;
    else if (input.systolicBp <= 110) news2 += 1;

    if (input.heartRate <= 40 || input.heartRate >= 131) news2 += 3;
    else if (input.heartRate >= 111) news2 += 2;
    else if (input.heartRate <= 50 || input.heartRate >= 91) news2 += 1;

    if (input.gcsScore < 15) news2 += 3;

    // 3. SOFA Score (0-24)
    let sofa = 0;
    // Resp
    if (input.pao2Fio2Ratio < 100) sofa += 4;
    else if (input.pao2Fio2Ratio < 200) sofa += 3;
    else if (input.pao2Fio2Ratio < 300) sofa += 2;
    else if (input.pao2Fio2Ratio < 400) sofa += 1;
    // Coag
    if (input.plateletsK < 20) sofa += 4;
    else if (input.plateletsK < 50) sofa += 3;
    else if (input.plateletsK < 100) sofa += 2;
    else if (input.plateletsK < 150) sofa += 1;
    // Liver
    if (input.bilirubinMgDl >= 12.0) sofa += 4;
    else if (input.bilirubinMgDl >= 6.0) sofa += 3;
    else if (input.bilirubinMgDl >= 2.0) sofa += 2;
    else if (input.bilirubinMgDl >= 1.2) sofa += 1;
    // Cardio
    if (input.vasopressorActive) sofa += 3;
    else if (input.mapMmhg < 70) sofa += 1;
    // CNS
    if (input.gcsScore < 6) sofa += 4;
    else if (input.gcsScore <= 9) sofa += 3;
    else if (input.gcsScore <= 12) sofa += 2;
    else if (input.gcsScore <= 14) sofa += 1;
    // Renal
    if (input.creatinineMgDl >= 5.0) sofa += 4;
    else if (input.creatinineMgDl >= 3.5) sofa += 3;
    else if (input.creatinineMgDl >= 2.0) sofa += 2;
    else if (input.creatinineMgDl >= 1.2) sofa += 1;

    // 4. Seymour / Calfee Host-Response Subphenotype Classification
    let subphenotype: SepsisSubphenotype = 'ALPHA_LOW_RISK';
    let corticosteroidDirective = 'Corticosteroids NOT indicated unless refractory shock develops.';
    let fluidStrategy = 'Standard maintenance; reassess dynamic fluid responsiveness (PLR / PPV) before any bolus > 500 mL.';
    let ventilatoryTarget = 'Standard lung-protective tidal volume 6-8 mL/kg PBW.';

    const isDelta =
      (input.vasopressorActive && input.lactateMmolL >= 3.0) ||
      (input.lactateMmolL >= 4.0 && (input.plateletsK < 100 || input.bilirubinMgDl >= 2.0));

    const isGamma =
      !isDelta &&
      (input.pao2Fio2Ratio < 200 || (input.tempCelsius >= 38.5 && (input.crpMgL ?? 0) >= 150));

    const isBeta = !isDelta && !isGamma && (input.ageYears >= 65 && input.creatinineMgDl >= 2.0);

    if (isDelta) {
      subphenotype = 'DELTA_SHOCK_COAGULOPATHIC';
      corticosteroidDirective = 'Hydrocortisone 200 mg/day IV continuous or 50 mg IV q6h indicated for shock reversal.';
      fluidStrategy = 'Balanced crystalloids (Lactated Ringers / Plasma-Lyte) guided by dynamic stroke volume variation; early Norepinephrine to avoid fluid overload.';
      ventilatoryTarget = 'Early intubation if lactate rising; lung-protective Vt 6 mL/kg PBW.';
      alerts.push('DELTA SUBPHENOTYPE: High-mortality shock + coagulopathy/hepatic dysfunction phenotype detected.');
    } else if (isGamma) {
      subphenotype = 'GAMMA_HYPERINFLAMMATORY';
      corticosteroidDirective = 'Hyper-inflammatory ARDS overlap: Consider Methylprednisolone 1 mg/kg/day or Hydrocortisone 200 mg/day.';
      fluidStrategy = 'Conservative FACTT-style fluid management once perfusion restored to limit alveolar edema.';
      ventilatoryTarget = 'Strict ARDSNet Vt 6 mL/kg PBW, Pplat <= 30 cmH2O, high-PEEP table.';
      alerts.push('GAMMA SUBPHENOTYPE: Hyper-inflammatory pulmonary-predominant host response detected.');
    } else if (isBeta) {
      subphenotype = 'BETA_RENAL_CHRONIC';
      corticosteroidDirective = 'Routine steroids not indicated.';
      fluidStrategy = 'RESTRICTIVE FLUID GUARD: Elderly/CKD phenotype at high risk for flash pulmonary edema. Use 250 mL mini-boluses with POCUS/VExUS check.';
      alerts.push('BETA SUBPHENOTYPE: Older chronic renal comorbidity profile — avoid blind 30 mL/kg rapid bolus.');
    }

    // 5. Surviving Sepsis 1-Hour Bundle Compliance
    const missingBundleItems: string[] = [];
    if (!input.lactateDrawn) missingBundleItems.push('Measure serum lactate');
    if (!input.culturesDrawn) missingBundleItems.push('Obtain 2 sets of blood cultures prior to antibiotics');
    if (!input.antibioticsGiven) missingBundleItems.push('Administer broad-spectrum IV antimicrobials');
    if (!input.fluidBolusStarted && (input.lactateMmolL >= 4.0 || input.mapMmhg < 65)) {
      missingBundleItems.push('Begin balanced crystalloid resuscitation (guided by dynamic responsiveness)');
    }

    const bundleRemainingMinutes = Math.max(0, 60 - input.minutesSinceTimeZero);
    const bundle1hCompliant = missingBundleItems.length === 0 || (input.minutesSinceTimeZero <= 60 && missingBundleItems.length === 0);

    if (missingBundleItems.length > 0 && input.minutesSinceTimeZero > 60) {
      alerts.push(`BUNDLE BREACH: ${missingBundleItems.length} 1-Hour Sepsis Bundle item(s) overdue (${input.minutesSinceTimeZero} min elapsed).`);
    }

    return {
      patientId: input.patientId,
      sofaScore: sofa,
      qsofaScore: qsofa,
      news2Score: news2,
      subphenotype,
      bundle1hCompliant,
      bundleRemainingMinutes,
      missingBundleItems,
      immunomodulationPlan: {
        corticosteroidDirective,
        fluidStrategy,
        ventilatoryTarget
      },
      clinicalAlerts: alerts
    };
  }

  public static async recordEvaluation(input: SepsisSubphenotypeInput): Promise<SepsisSubphenotypeResult> {
    const result = this.evaluateSepsis(input);
    const res = await query(
      `INSERT INTO sepsis_subphenotype_evals (
        patient_id, sofa_score, qsofa_score, news2_score, subphenotype,
        bundle_1h_compliant, immunomodulation_plan
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id;`,
      [
        result.patientId,
        result.sofaScore,
        result.qsofaScore,
        result.news2Score,
        result.subphenotype,
        result.bundle1hCompliant,
        JSON.stringify(result.immunomodulationPlan)
      ]
    );
    if (res.rows.length > 0) {
      result.id = res.rows[0].id;
    }
    return result;
  }
}
