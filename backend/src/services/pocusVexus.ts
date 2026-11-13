import { query } from '../db';

export type HepaticVeinPattern = 'NORMAL_S_GT_D' | 'MILD_S_LT_D' | 'SEVERE_S_REVERSAL';
export type IntrarenalVeinPattern = 'CONTINUOUS' | 'BIPHASIC' | 'MONOPHASIC_DIASTOLIC';
export type ShockPhenotype =
  | 'OBSTRUCTIVE_TAMPONADE'
  | 'OBSTRUCTIVE_MASSIVE_PE'
  | 'OBSTRUCTIVE_TENSION_PTX'
  | 'CARDIOGENIC_SHOCK'
  | 'HYPOVOLEMIC_SHOCK'
  | 'DISTRIBUTIVE_SHOCK';

export interface PocusVexusInput {
  patientId: number;
  ivcDiameterCm: number;
  ivcCollapsibilityPct: number;
  hepaticVeinPattern: HepaticVeinPattern;
  portalVmaxCmS: number;
  portalVminCmS: number;
  intrarenalVeinPattern: IntrarenalVeinPattern;
  lvEjectionFractionPct: number;
  rvDilatedMcConnell: boolean;
  pericardialEffusionWithCollapse: boolean;
  lungSlidingPresent: boolean;
  bilateralBLinesPresent: boolean;
}

export interface PocusVexusResult {
  id?: number;
  patientId: number;
  ivcDiameterCm: number;
  portalPulsatilityPct: number;
  vexusGrade: 0 | 1 | 2 | 3;
  severeCongestionTerritories: string[];
  shockPhenotype: ShockPhenotype;
  fluidToleranceStatus: 'FLUID_RESPONSIVE_SAFE' | 'FLUID_CAUTIOUS' | 'FLUID_INTOLERANT_DERESUSCITATE';
  clinicalDirectives: string[];
}

export class PocusVexusService {
  public static evaluatePocus(input: PocusVexusInput): PocusVexusResult {
    const directives: string[] = [];
    const severeTerritories: string[] = [];

    // 1. Portal Vein Pulsatility Index (%)
    const vmax = Math.max(1, input.portalVmaxCmS);
    const portalPulsatilityPct = parseFloat((((vmax - input.portalVminCmS) / vmax) * 100).toFixed(1));

    // 2. VExUS Grading (0 to 3)
    if (input.hepaticVeinPattern === 'SEVERE_S_REVERSAL') {
      severeTerritories.push('Hepatic Vein Systolic Flow Reversal');
    }
    if (portalPulsatilityPct >= 50.0) {
      severeTerritories.push(`Portal Vein Pulsatility ${portalPulsatilityPct}% (>= 50%)`);
    }
    if (input.intrarenalVeinPattern === 'MONOPHASIC_DIASTOLIC') {
      severeTerritories.push('Intrarenal Monophasic Diastolic-Only Flow');
    }

    let vexusGrade: 0 | 1 | 2 | 3 = 0;
    if (input.ivcDiameterCm < 2.0) {
      vexusGrade = 0;
    } else if (severeTerritories.length >= 2) {
      vexusGrade = 3;
    } else if (severeTerritories.length === 1) {
      vexusGrade = 2;
    } else {
      vexusGrade = 1;
    }

    // 3. RUSH Shock Phenotype Classification
    let shockPhenotype: ShockPhenotype = 'DISTRIBUTIVE_SHOCK';

    if (!input.lungSlidingPresent) {
      shockPhenotype = 'OBSTRUCTIVE_TENSION_PTX';
      directives.push('EMERGENT OBSTRUCTIVE SHOCK (TENSION PNEUMOTHORAX): Absent lung sliding. Perform immediate needle/finger thoracostomy decompression.');
    } else if (input.pericardialEffusionWithCollapse) {
      shockPhenotype = 'OBSTRUCTIVE_TAMPONADE';
      directives.push('EMERGENT OBSTRUCTIVE SHOCK (CARDIAC TAMPONADE): Pericardial effusion with chamber collapse. Perform ultrasound-guided pericardiocentesis STAT.');
    } else if (input.rvDilatedMcConnell) {
      shockPhenotype = 'OBSTRUCTIVE_MASSIVE_PE';
      directives.push('OBSTRUCTIVE SHOCK (MASSIVE PE / RV STRAIN): Avoid aggressive fluid loading (worsens RV septal shift). Evaluate systemic thrombolysis / PERT / inhaled NO.');
    } else if (input.lvEjectionFractionPct < 40 && (input.bilateralBLinesPresent || vexusGrade >= 2)) {
      shockPhenotype = 'CARDIOGENIC_SHOCK';
      directives.push('CARDIOGENIC SHOCK: Severely reduced LVEF with pulmonary/venous congestion. Initiate inotrope (Dobutamine/Milrinone) + Norepinephrine; avoid fluids.');
    } else if (input.ivcDiameterCm < 1.5 && input.ivcCollapsibilityPct >= 50 && !input.bilateralBLinesPresent) {
      shockPhenotype = 'HYPOVOLEMIC_SHOCK';
      directives.push('HYPOVOLEMIC SHOCK: Collapsible IVC + A-profile lungs. Administer 500 mL balanced crystalloid bolus or blood products and reassess.');
    } else {
      shockPhenotype = 'DISTRIBUTIVE_SHOCK';
      directives.push('DISTRIBUTIVE SHOCK: Preserved/hyperdynamic LV without tamponade or RV strain. Titrate Norepinephrine and address infectious/vasoplegic source.');
    }

    // 4. Fluid Tolerance & De-resuscitation Arbiter
    let fluidToleranceStatus: 'FLUID_RESPONSIVE_SAFE' | 'FLUID_CAUTIOUS' | 'FLUID_INTOLERANT_DERESUSCITATE' = 'FLUID_CAUTIOUS';

    if (vexusGrade >= 2 || (input.bilateralBLinesPresent && vexusGrade >= 1)) {
      fluidToleranceStatus = 'FLUID_INTOLERANT_DERESUSCITATE';
      directives.push(`VExUS GRADE ${vexusGrade} VENOUS CONGESTION: Patient is FLUID INTOLERANT. Halt all maintenance/bolus fluids and initiate IV loop diuretics (Furosemide) or CRRT ultrafiltration to prevent congestive AKI.`);
    } else if (vexusGrade === 0 && !input.bilateralBLinesPresent && !input.rvDilatedMcConnell) {
      fluidToleranceStatus = 'FLUID_RESPONSIVE_SAFE';
    }

    return {
      patientId: input.patientId,
      ivcDiameterCm: input.ivcDiameterCm,
      portalPulsatilityPct,
      vexusGrade,
      severeCongestionTerritories: severeTerritories,
      shockPhenotype,
      fluidToleranceStatus,
      clinicalDirectives: directives
    };
  }

  public static async recordExam(input: PocusVexusInput): Promise<PocusVexusResult> {
    const result = this.evaluatePocus(input);
    const res = await query(
      `INSERT INTO pocus_vexus_exams (
        patient_id, ivc_diameter_cm, portal_pulsatility_pct, vexus_grade,
        shock_phenotype, fluid_tolerance_status, exam_findings
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id;`,
      [
        result.patientId,
        result.ivcDiameterCm,
        result.portalPulsatilityPct,
        result.vexusGrade,
        result.shockPhenotype,
        result.fluidToleranceStatus,
        JSON.stringify(result)
      ]
    );
    if (res.rows.length > 0) {
      result.id = res.rows[0].id;
    }
    return result;
  }
}
