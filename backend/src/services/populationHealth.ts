import { query } from '../db';

export interface HccCategory {
  hcc: string;
  description: string;
  weight: number;
  triggerCode: string;
}

export interface DiseaseInteraction {
  name: string;
  weight: number;
  description: string;
}

export interface RafCalculationResult {
  patientId: number;
  demographicWeight: number;
  hccCategories: HccCategory[];
  diseaseInteractions: DiseaseInteraction[];
  totalRafScore: number;
  annualCapitationBenchmark: number;
  riskTier: 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH';
}

export interface HedisCareGap {
  id?: number;
  patientId: number;
  measureCode: 'COL' | 'BCS' | 'CDC-A1C' | 'CBP' | 'KED';
  measureName: string;
  status: 'open' | 'compliant' | 'excluded';
  dueDate?: string;
  lastCompletedDate?: string;
  recommendedAction: string;
}

// Built-in CMS-HCC V28 Mapping Dictionary
const HCC_V28_MAP: Array<{
  triggers: RegExp[];
  hcc: string;
  desc: string;
  weight: number;
}> = [
  {
    triggers: [/E11\.4/i, /E11\.2/i, /E11\.3/i, /E11\.5/i, /diabetic neuropathy/i, /diabetic ckd/i],
    hcc: 'HCC 37',
    desc: 'Diabetes with Chronic Complications',
    weight: 0.302
  },
  {
    triggers: [/I50\./i, /heart failure/i, /chf/i, /congestive heart failure/i],
    hcc: 'HCC 226',
    desc: 'Congestive Heart Failure',
    weight: 0.360
  },
  {
    triggers: [/J44\./i, /copd/i, /chronic bronchitis/i, /emphysema/i],
    hcc: 'HCC 280',
    desc: 'Chronic Obstructive Pulmonary Disease',
    weight: 0.335
  },
  {
    triggers: [/N18\.4/i, /N18\.5/i, /N18\.6/i, /ckd stage 4/i, /ckd stage 5/i, /esrd/i],
    hcc: 'HCC 326',
    desc: 'Chronic Kidney Disease (Stages 4-5 / ESRD)',
    weight: 0.289
  },
  {
    triggers: [/I73\./i, /I25\.1/i, /peripheral vascular/i, /coronary artery disease/i, /cad/i],
    hcc: 'HCC 264',
    desc: 'Vascular Disease / Atherosclerosis',
    weight: 0.288
  },
  {
    triggers: [/F32\./i, /F33\./i, /major depress/i],
    hcc: 'HCC 155',
    desc: 'Major Depressive and Bipolar Disorders',
    weight: 0.309
  }
];

export class PopulationHealthService {
  /**
   * Calculate patient's CMS-HCC Risk Adjustment Factor (RAF).
   */
  public async calculatePatientRaf(
    patientId: number,
    documentedConditions: string[] = []
  ): Promise<RafCalculationResult> {
    // 1. Fetch patient age and sex
    const patientRes = await query('SELECT dob, sex FROM patients WHERE id = $1', [patientId]);
    let age = 68;
    let isFemale = false;
    if (patientRes.rows.length > 0) {
      const dob = new Date(patientRes.rows[0].dob);
      const diffMs = Date.now() - dob.getTime();
      age = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25)));
      isFemale = (patientRes.rows[0].sex || '').toLowerCase().startsWith('f');
    }

    // 2. Demographic Baseline Weight (CMS Community Non-Dual Aged model)
    let demographicWeight = 0.340; // Default 65-74
    if (age < 65) demographicWeight = 0.420; // Non-aged disabled
    else if (age >= 75 && age < 85) demographicWeight = 0.460;
    else if (age >= 85) demographicWeight = 0.650;
    if (isFemale) demographicWeight *= 0.95;

    // 3. Match documented conditions against HCC categories
    const conditionsStr = documentedConditions.join(' ');
    const matchedHccs: HccCategory[] = [];

    for (const hccEntry of HCC_V28_MAP) {
      const matched = hccEntry.triggers.some(t => t.test(conditionsStr));
      if (matched) {
        matchedHccs.push({
          hcc: hccEntry.hcc,
          description: hccEntry.desc,
          weight: hccEntry.weight,
          triggerCode: documentedConditions.find(c => hccEntry.triggers.some(t => t.test(c))) || 'Clinical finding'
        });
      }
    }

    // 4. Disease Interactions
    const interactions: DiseaseInteraction[] = [];
    const hasDiabetes = matchedHccs.some(h => h.hcc === 'HCC 37');
    const hasChf = matchedHccs.some(h => h.hcc === 'HCC 226');
    const hasCkd = matchedHccs.some(h => h.hcc === 'HCC 326');

    if (hasDiabetes && hasChf) {
      interactions.push({
        name: 'Diabetes + Heart Failure Interaction',
        weight: 0.145,
        description: 'Multi-morbidity metabolic-cardiac synergistic disease interaction'
      });
    }

    if (hasChf && hasCkd) {
      interactions.push({
        name: 'Heart Failure + CKD Interaction',
        weight: 0.160,
        description: 'Cardiorenal syndrome compound morbidity risk factor'
      });
    }

    // 5. Total Composite RAF Calculation
    const diseaseWeight = matchedHccs.reduce((acc, h) => acc + h.weight, 0);
    const interactionWeight = interactions.reduce((acc, i) => acc + i.weight, 0);
    const totalRafScore = Math.round((demographicWeight + diseaseWeight + interactionWeight) * 1000) / 1000;

    // Base Medicare Advantage monthly payment benchmark ~ $1,150.00
    const annualCapitationBenchmark = Math.round(1150.0 * totalRafScore * 12 * 100) / 100;

    let riskTier: RafCalculationResult['riskTier'] = 'LOW';
    if (totalRafScore >= 1.8) riskTier = 'VERY_HIGH';
    else if (totalRafScore >= 1.3) riskTier = 'HIGH';
    else if (totalRafScore >= 0.9) riskTier = 'MODERATE';

    const result: RafCalculationResult = {
      patientId,
      demographicWeight: Math.round(demographicWeight * 1000) / 1000,
      hccCategories: matchedHccs,
      diseaseInteractions: interactions,
      totalRafScore,
      annualCapitationBenchmark,
      riskTier
    };

    // 6. Persist to population_patient_raf
    await query(
      `INSERT INTO population_patient_raf (
        patient_id, raf_score, hcc_categories, disease_interactions, annual_capitation_benchmark
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        patientId,
        totalRafScore,
        JSON.stringify(matchedHccs),
        JSON.stringify(interactions),
        annualCapitationBenchmark
      ]
    );

    return result;
  }

  /**
   * Evaluate HEDIS Quality Care Gaps for a patient.
   */
  public async evaluateHedisCareGaps(
    patientId: number,
    conditions: string[] = []
  ): Promise<HedisCareGap[]> {
    const patientRes = await query('SELECT dob, sex FROM patients WHERE id = $1', [patientId]);
    if (patientRes.rows.length === 0) return [];

    const dob = new Date(patientRes.rows[0].dob);
    const diffMs = Date.now() - dob.getTime();
    const age = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25)));
    const isFemale = (patientRes.rows[0].sex || '').toLowerCase().startsWith('f');
    const condStr = conditions.join(' ').toLowerCase();

    const generatedGaps: HedisCareGap[] = [];

    // 1. Colorectal Cancer Screening (COL: 45-75 years)
    if (age >= 45 && age <= 75) {
      generatedGaps.push({
        patientId,
        measureCode: 'COL',
        measureName: 'Colorectal Cancer Screening (COL)',
        status: 'open',
        dueDate: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString().split('T')[0],
        recommendedAction: 'Order Screening Colonoscopy (every 10y) OR Cologuard / sDNA-FIT test (every 3y).'
      });
    }

    // 2. Breast Cancer Screening (BCS: Females 50-74 years)
    if (isFemale && age >= 50 && age <= 74) {
      generatedGaps.push({
        patientId,
        measureCode: 'BCS',
        measureName: 'Breast Cancer Screening (BCS)',
        status: 'open',
        dueDate: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().split('T')[0],
        recommendedAction: 'Order Biennial Screening Mammogram.'
      });
    }

    // 3. Comprehensive Diabetes Care (CDC-A1C & KED)
    if (condStr.includes('e11') || condStr.includes('diabet')) {
      generatedGaps.push({
        patientId,
        measureCode: 'CDC-A1C',
        measureName: 'Diabetes HbA1c Glycemic Control (CDC-A1C)',
        status: 'open',
        dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
        recommendedAction: 'Order serum HbA1c test (target < 8.0% for standard, < 7.0% for young adult).'
      });

      generatedGaps.push({
        patientId,
        measureCode: 'KED',
        measureName: 'Kidney Health Evaluation for Diabetes (KED)',
        status: 'open',
        dueDate: new Date(Date.now() + 45 * 24 * 3600 * 1000).toISOString().split('T')[0],
        recommendedAction: 'Order annual eGFR (blood) AND urine albumin-to-creatinine ratio (uACR).'
      });
    }

    // 4. Controlling High Blood Pressure (CBP)
    if (condStr.includes('i10') || condStr.includes('hypertens')) {
      generatedGaps.push({
        patientId,
        measureCode: 'CBP',
        measureName: 'Controlling High Blood Pressure (CBP)',
        status: 'open',
        dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
        recommendedAction: 'Ensure documented blood pressure < 140/90 mmHg. Re-check in clinic.'
      });
    }

    // Persist into hedis_care_gaps
    for (const gap of generatedGaps) {
      await query(
        `INSERT INTO hedis_care_gaps (
          patient_id, measure_code, measure_name, status, due_date, recommended_action
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          gap.patientId,
          gap.measureCode,
          gap.measureName,
          gap.status,
          gap.dueDate || null,
          gap.recommendedAction
        ]
      );
    }

    return generatedGaps;
  }

  /**
   * Close or satisfy a HEDIS care gap.
   */
  public async closeCareGap(gapId: number, completionDate?: string) {
    const res = await query(
      `UPDATE hedis_care_gaps
       SET status = 'compliant',
           last_completed_date = COALESCE($1, CURRENT_DATE),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [completionDate || null, gapId]
    );
    return res.rows[0];
  }

  /**
   * Fetch all care gaps for a patient.
   */
  public async getCareGapsByPatient(patientId: number) {
    const res = await query(
      `SELECT * FROM hedis_care_gaps WHERE patient_id = $1 ORDER BY status ASC, due_date ASC`,
      [patientId]
    );
    return res.rows;
  }

  /**
   * Population-level analytics dashboard summary.
   */
  public async getPopulationAnalytics() {
    const [rafRes, gapsRes] = await Promise.all([
      query(`SELECT AVG(raf_score) as avg_raf, COUNT(*) as total_patients FROM population_patient_raf`),
      query(`
        SELECT 
          COUNT(*) as total_gaps,
          COUNT(*) FILTER (WHERE status = 'compliant') as closed_gaps,
          COUNT(*) FILTER (WHERE status = 'open') as open_gaps
        FROM hedis_care_gaps
      `)
    ]);

    const avgRaf = parseFloat(rafRes.rows[0]?.avg_raf || '1.0');
    const totalGaps = parseInt(gapsRes.rows[0]?.total_gaps || '0', 10);
    const closedGaps = parseInt(gapsRes.rows[0]?.closed_gaps || '0', 10);
    const complianceRate = totalGaps > 0 ? Math.round((closedGaps / totalGaps) * 100) : 85;

    return {
      averageRafScore: Math.round(avgRaf * 1000) / 1000,
      totalStratifiedPatients: parseInt(rafRes.rows[0]?.total_patients || '0', 10),
      qualityComplianceRate: complianceRate,
      openCareGapsCount: parseInt(gapsRes.rows[0]?.open_gaps || '0', 10),
      closedCareGapsCount: closedGaps
    };
  }
}

export const populationHealthService = new PopulationHealthService();
