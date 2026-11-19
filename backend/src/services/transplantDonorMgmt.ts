import { query } from '../db';

export interface TransplantDonorMgmtInput {
  patientId: number;
  meanArterialPressureMmhg: number; // target 60-80
  systolicBpMmhg: number; // target > 100
  cvpMmhg: number; // target 4-10
  urineOutputMlKgHr: number; // target 1.0 - 3.0
  serumSodiumMeqL: number; // target 135 - 155
  bloodGlucoseMgDl: number; // target 120 - 180
  pao2Fio2Ratio: number; // target >= 300
  vasopressorCount: number; // target <= 1 low-dose
  tripleHormoneTherapyActive: boolean;
  coreTemperatureC: number; // target 36.0 - 37.5
}

export interface DmgItemCheck {
  target: string;
  achieved: boolean;
  value: string;
  idealRange: string;
}

export interface TransplantDonorMgmtResult {
  id?: number;
  patientId: number;
  donorMgmtGoalsMet: number; // out of 8
  totalDmgTargets: number;
  optnBundleComplianceTier: 'OPTIMAL_DONOR_STATE' | 'ACCEPTABLE_MODERATE' | 'CRITICAL_ALLOGRAFT_RISK';
  neurogenicShockPresent: boolean;
  diabetesInsipidusActive: boolean;
  tripleHormoneTherapyActive: boolean;
  checklist: DmgItemCheck[];
  organProcurementDirectives: string[];
}

export class TransplantDonorMgmtService {
  public static evaluateDonor(input: TransplantDonorMgmtInput): TransplantDonorMgmtResult {
    const directives: string[] = [];
    const checklist: DmgItemCheck[] = [];

    // 1. MAP / SBP
    const mapAchieved = input.meanArterialPressureMmhg >= 60 && input.meanArterialPressureMmhg <= 85;
    checklist.push({
      target: 'Mean Arterial Pressure',
      achieved: mapAchieved,
      value: `${input.meanArterialPressureMmhg} mmHg`,
      idealRange: '60 - 85 mmHg'
    });

    // 2. CVP
    const cvpAchieved = input.cvpMmhg >= 4 && input.cvpMmhg <= 10;
    checklist.push({
      target: 'Central Venous Pressure (CVP)',
      achieved: cvpAchieved,
      value: `${input.cvpMmhg} mmHg`,
      idealRange: '4 - 10 mmHg'
    });

    // 3. Vasopressor Dependency
    const vasopressorAchieved = input.vasopressorCount <= 1;
    checklist.push({
      target: 'Vasopressor Dependency',
      achieved: vasopressorAchieved,
      value: `${input.vasopressorCount} agent(s)`,
      idealRange: '<= 1 low-dose agent'
    });

    // 4. Urine Output
    const uoAchieved = input.urineOutputMlKgHr >= 1.0 && input.urineOutputMlKgHr <= 3.5;
    checklist.push({
      target: 'Urine Output Rate',
      achieved: uoAchieved,
      value: `${input.urineOutputMlKgHr} mL/kg/h`,
      idealRange: '1.0 - 3.0 mL/kg/h'
    });

    // 5. Serum Sodium
    const sodiumAchieved = input.serumSodiumMeqL >= 135 && input.serumSodiumMeqL <= 155;
    checklist.push({
      target: 'Serum Sodium (Liver Viability)',
      achieved: sodiumAchieved,
      value: `${input.serumSodiumMeqL} mEq/L`,
      idealRange: '135 - 155 mEq/L'
    });

    // 6. Blood Glucose
    const glucoseAchieved = input.bloodGlucoseMgDl >= 120 && input.bloodGlucoseMgDl <= 180;
    checklist.push({
      target: 'Glycemic Control',
      achieved: glucoseAchieved,
      value: `${input.bloodGlucoseMgDl} mg/dL`,
      idealRange: '120 - 180 mg/dL'
    });

    // 7. PaO2/FiO2 Ratio (Lung Protection)
    const pao2Achieved = input.pao2Fio2Ratio >= 300;
    checklist.push({
      target: 'PaO2/FiO2 (Lung Donor Criteria)',
      achieved: pao2Achieved,
      value: `${input.pao2Fio2Ratio}`,
      idealRange: '>= 300 on PEEP 8-10'
    });

    // 8. Core Temperature
    const tempAchieved = input.coreTemperatureC >= 36.0 && input.coreTemperatureC <= 37.8;
    checklist.push({
      target: 'Normothermia Maintenance',
      achieved: tempAchieved,
      value: `${input.coreTemperatureC} °C`,
      idealRange: '36.0 - 37.5 °C'
    });

    const goalsMet = checklist.filter((item) => item.achieved).length;
    const totalGoals = checklist.length;

    // Detect Neurogenic Shock / Vasoplegia
    const neurogenicShockPresent = input.meanArterialPressureMmhg < 60 || input.vasopressorCount >= 2;

    // Detect Central Diabetes Insipidus
    const diabetesInsipidusActive = input.urineOutputMlKgHr > 4.0 || input.serumSodiumMeqL > 150;

    let tier: TransplantDonorMgmtResult['optnBundleComplianceTier'] = 'ACCEPTABLE_MODERATE';
    if (goalsMet >= 7) {
      tier = 'OPTIMAL_DONOR_STATE';
      directives.push(`OPTN/UNOS DMG Bundle Optimal: ${goalsMet}/${totalGoals} targets met. Multi-organ procurement viability maximized.`);
    } else if (goalsMet >= 4) {
      tier = 'ACCEPTABLE_MODERATE';
      directives.push(`OPTN/UNOS DMG Bundle Moderate: ${goalsMet}/${totalGoals} targets met. Targeted resuscitation required.`);
    } else {
      tier = 'CRITICAL_ALLOGRAFT_RISK';
      directives.push(`CRITICAL ALLOGRAFT VIABILITY WARNING: Only ${goalsMet}/${totalGoals} DMG targets met. High risk of organ loss.`);
    }

    // Pathophysiology-driven directives
    if (diabetesInsipidusActive) {
      directives.push(
        'CENTRAL DIABETES INSIPIDUS ACTIVE: Initiate Vasopressin infusion (0.5 - 2.4 U/hr continuous). Administer Desmopressin (DDAVP 1-2 mcg IV q6h) if UO > 4 mL/kg/h and urine specific gravity < 1.005. Replace urine losses 1:1 with 0.45% NaCl or D5W.'
      );
    }

    if (!input.tripleHormoneTherapyActive) {
      directives.push(
        'TRIPLE HORMONE THERAPY DEFICIENCY: Brain death abolishes hypothalamic-pituitary-thyroid axis. STAT protocol: Methylprednisolone 15 mg/kg IV + Levothyroxine (T4) 20 mcg bolus then 10 mcg/h infusion + Regular insulin infusion to preserve donor cardiac energetics and lung function.'
      );
    } else {
      directives.push('Triple Hormone Replacement Therapy active: Maintained endocrine homeostasis.');
    }

    if (input.serumSodiumMeqL > 155) {
      directives.push(
        `SEVERE HYPERNATREMIA (${input.serumSodiumMeqL} mEq/L): Causes acute hepatic allograft cellular dehydration and primary graft dysfunction. Infuse free water (D5W or sterile water via enteric tube) to reduce Na < 155 mEq/L.`
      );
    }

    if (!pao2Achieved) {
      directives.push(
        'Lung Donor Optimization Protocol: Ensure lung-protective ventilation (Vt 6-8 mL/kg PBW, PEEP 8-10 cmH2O). Perform gentle recruitment maneuvers (30 cmH2O for 30s) and bronchoscopy for mucus plugging clearance.'
      );
    }

    return {
      patientId: input.patientId,
      donorMgmtGoalsMet: goalsMet,
      totalDmgTargets: totalGoals,
      optnBundleComplianceTier: tier,
      neurogenicShockPresent,
      diabetesInsipidusActive,
      tripleHormoneTherapyActive: input.tripleHormoneTherapyActive,
      checklist,
      organProcurementDirectives: directives
    };
  }

  public static async recordEvaluation(input: TransplantDonorMgmtInput): Promise<TransplantDonorMgmtResult> {
    const result = this.evaluateDonor(input);

    const res = await query(
      `INSERT INTO transplant_donor_mgmt_logs (
        patient_id, donor_mgmt_goals_met, total_dmg_targets,
        neurogenic_shock_present, diabetes_insipidus_active, triple_hormone_therapy_active,
        optn_bundle_compliance_tier, eval_output
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id`,
      [
        input.patientId,
        result.donorMgmtGoalsMet,
        result.totalDmgTargets,
        result.neurogenicShockPresent,
        result.diabetesInsipidusActive,
        result.tripleHormoneTherapyActive,
        result.optnBundleComplianceTier,
        JSON.stringify(result)
      ]
    );

    result.id = res.rows[0].id;
    return result;
  }
}
