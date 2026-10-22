import { pool } from '../db';

export type OrganType = 'HEART' | 'LUNG_SINGLE' | 'LUNG_BILATERAL' | 'HEART_LUNG';
export type Timepoint = 'T0' | 'T24' | 'T48' | 'T72' | 'OTHER';
export type LungPgdGrade = 'GRADE_0' | 'GRADE_1' | 'GRADE_2' | 'GRADE_3';
export type HeartPgdSeverity = 'NONE' | 'PGD_LV_MILD' | 'PGD_LV_MODERATE' | 'PGD_LV_SEVERE' | 'PGD_RV';
export type InhaledVasodilator = 'NONE' | 'INO' | 'EPOPROSTENOL';
export type EcmoType = 'NONE' | 'VV_ECMO' | 'VA_ECMO';

export interface VasoactiveDoses {
  dopamineMcgKgMin?: number;
  dobutamineMcgKgMin?: number;
  epinephrineMcgKgMin?: number;
  milrinoneMcgKgMin?: number;
  vasopressinUnitsKgMin?: number;
  norepinephrineMcgKgMin?: number;
}

export interface LungPgdInput {
  pao2Mmhg: number;
  fio2: number; // 0.21 - 1.0
  radiographicInfiltrates: boolean;
  ecmoActive?: boolean;
  ecmoType?: EcmoType;
  invasiveMechanicalVentilation?: boolean;
}

export interface LungPgdResult {
  pao2Fio2Ratio: number;
  pgdGrade: LungPgdGrade;
  ecmoIndicated: boolean;
  inhaledVasodilatorRecommended: InhaledVasodilator;
  suggestedVasodilatorDose: string;
  protectiveVentProtocol: string[];
  clinicalSummary: string;
}

export interface HeartPgdInput {
  lvefPercent: number;
  cvpMmhg: number;
  pcwpMmhg: number;
  cardiacIndexLMinM2?: number;
  pulmonaryArterySystolicMmhg?: number;
  pulmonaryArteryDiastolicMmhg?: number;
  rvDysfunctionPresent?: boolean;
  vasoactives?: VasoactiveDoses;
  newIabpPlaced?: boolean;
  mechanicalCirculatorySupportActive?: boolean;
  mcsType?: string;
}

export interface HeartPgdResult {
  visScore: number;
  papi?: number;
  pgdSeverity: HeartPgdSeverity;
  rvFailurePresent: boolean;
  mechanicalSupportIndicated: boolean;
  inhaledVasodilatorRecommended: InhaledVasodilator;
  suggestedVasodilatorDose: string;
  hemodynamicActionPlan: string[];
  clinicalSummary: string;
}

export class GraftPulseService {
  /**
   * Calculates the Vasoactive-Inotropic Score (VIS).
   */
  public static calculateVisScore(doses: VasoactiveDoses = {}): number {
    const dopamine = doses.dopamineMcgKgMin || 0;
    const dobutamine = doses.dobutamineMcgKgMin || 0;
    const epi = doses.epinephrineMcgKgMin || 0;
    const milrinone = doses.milrinoneMcgKgMin || 0;
    const vasopressin = doses.vasopressinUnitsKgMin || 0;
    const norepi = doses.norepinephrineMcgKgMin || 0;

    const vis = dopamine + dobutamine + (100 * epi) + (10 * milrinone) + (10000 * vasopressin) + (100 * norepi);
    return Math.round(vis * 10) / 10;
  }

  /**
   * Assesses ISHLT Primary Graft Dysfunction (PGD) for Lung Allografts.
   */
  public static assessLungPGD(input: LungPgdInput): LungPgdResult {
    const {
      pao2Mmhg,
      fio2,
      radiographicInfiltrates,
      ecmoActive = false,
      ecmoType = 'NONE'
    } = input;

    const normalizedFio2 = fio2 > 1.0 ? fio2 / 100 : fio2;
    const pao2Fio2Ratio = Math.round((pao2Mmhg / Math.max(0.21, normalizedFio2)) * 10) / 10;

    let pgdGrade: LungPgdGrade = 'GRADE_0';

    if (ecmoActive && (ecmoType === 'VV_ECMO' || ecmoType === 'VA_ECMO')) {
      pgdGrade = 'GRADE_3';
    } else if (!radiographicInfiltrates) {
      pgdGrade = 'GRADE_0';
    } else {
      if (pao2Fio2Ratio > 300) {
        pgdGrade = 'GRADE_1';
      } else if (pao2Fio2Ratio >= 200 && pao2Fio2Ratio <= 300) {
        pgdGrade = 'GRADE_2';
      } else {
        pgdGrade = 'GRADE_3';
      }
    }

    const ecmoIndicated = (pgdGrade === 'GRADE_3' && pao2Fio2Ratio < 100) || (ecmoActive && ecmoType === 'VV_ECMO');
    let inhaledVasodilatorRecommended: InhaledVasodilator = 'NONE';
    let suggestedVasodilatorDose = 'None';

    if (pgdGrade === 'GRADE_2' || pgdGrade === 'GRADE_3') {
      inhaledVasodilatorRecommended = 'INO';
      suggestedVasodilatorDose = '20 - 40 ppm inline inhalation';
    }

    const protectiveVentProtocol: string[] = [
      'Low Tidal Volume: 6 mL/kg predicted donor body weight to reduce shear stress.',
      'Plateau Pressure < 28 cmH2O and Driving Pressure <= 14 cmH2O.',
      'Judicious PEEP: 8 - 12 cmH2O to prevent derecruitment without alveolar overdistention.',
      'Conservative fluid balance: Target neutral to negative balance to minimize allograft capillary leak.'
    ];

    if (pgdGrade === 'GRADE_3') {
      protectiveVentProtocol.push('CRITICAL: PGD Grade 3 detected. Mobilize ECMO team for potential Veno-Venous (VV-ECMO) cannulation if refractory hypoxemia (P/F < 80 for > 6h) persists.');
    }

    const clinicalSummary = `ISHLT Lung PGD Classification: ${pgdGrade} (P/F Ratio: ${pao2Fio2Ratio}, Infiltrates: ${radiographicInfiltrates ? 'Present' : 'Absent'}).`;

    return {
      pao2Fio2Ratio,
      pgdGrade,
      ecmoIndicated,
      inhaledVasodilatorRecommended,
      suggestedVasodilatorDose,
      protectiveVentProtocol,
      clinicalSummary
    };
  }

  /**
   * Assesses ISHLT Primary Graft Dysfunction (PGD) for Heart Allografts.
   */
  public static assessHeartPGD(input: HeartPgdInput): HeartPgdResult {
    const {
      lvefPercent,
      cvpMmhg,
      pcwpMmhg,
      cardiacIndexLMinM2 = 2.4,
      pulmonaryArterySystolicMmhg,
      pulmonaryArteryDiastolicMmhg,
      rvDysfunctionPresent = false,
      vasoactives = {},
      newIabpPlaced = false,
      mechanicalCirculatorySupportActive = false,
      mcsType = 'NONE'
    } = input;

    const visScore = GraftPulseService.calculateVisScore(vasoactives);

    // Calculate PAPi (Pulmonary Artery Pulsatility Index)
    let papi: number | undefined;
    if (pulmonaryArterySystolicMmhg !== undefined && pulmonaryArteryDiastolicMmhg !== undefined && cvpMmhg > 0) {
      const pulsePressure = pulmonaryArterySystolicMmhg - pulmonaryArteryDiastolicMmhg;
      papi = Math.round((pulsePressure / cvpMmhg) * 100) / 100;
    }

    // Right Ventricular PGD (PGD-RV)
    // CVP > 15 mmHg, PCWP <= 15 mmHg, PAPi < 1.5, or severe RV dilation/hypokinesia
    const rvFailurePresent = (cvpMmhg > 15 && pcwpMmhg <= 15) || (papi !== undefined && papi < 1.5) || rvDysfunctionPresent;

    let pgdSeverity: HeartPgdSeverity = 'NONE';
    const isMcsActive = mechanicalCirculatorySupportActive || (mcsType !== 'NONE' && mcsType !== '');

    if (isMcsActive) {
      pgdSeverity = 'PGD_LV_SEVERE';
    } else if (lvefPercent <= 40 || pcwpMmhg > 20 || (cardiacIndexLMinM2 < 2.0 && pcwpMmhg > 15)) {
      if (visScore >= 10 || newIabpPlaced) {
        pgdSeverity = 'PGD_LV_MODERATE';
      } else {
        pgdSeverity = 'PGD_LV_MILD';
      }
    } else if (rvFailurePresent) {
      pgdSeverity = 'PGD_RV';
    } else {
      pgdSeverity = 'NONE';
    }

    const mechanicalSupportIndicated = pgdSeverity === 'PGD_LV_SEVERE' || (pgdSeverity === 'PGD_LV_MODERATE' && visScore >= 20);

    let inhaledVasodilatorRecommended: InhaledVasodilator = 'NONE';
    let suggestedVasodilatorDose = 'None';

    if (rvFailurePresent || pgdSeverity === 'PGD_RV') {
      inhaledVasodilatorRecommended = 'INO';
      suggestedVasodilatorDose = '20 - 40 ppm inline inhalation to reduce RV afterload without systemic vasodilation';
    }

    const hemodynamicActionPlan: string[] = [];
    if (pgdSeverity === 'PGD_LV_SEVERE') {
      hemodynamicActionPlan.push('EMERGENT: PGD-LV Severe. Maintain or upgrade VA-ECMO or microaxial pump (Impella) support.');
      hemodynamicActionPlan.push('Maintain MAP 65-75 mmHg while decompressing left ventricle to prevent pulmonary edema.');
    } else if (pgdSeverity === 'PGD_LV_MODERATE') {
      hemodynamicActionPlan.push(`PGD-LV Moderate (VIS Score: ${visScore}). Titrate inodilators (Milrinone 0.25-0.5 mcg/kg/min or Dobutamine) with arterial line monitoring.`);
      hemodynamicActionPlan.push('Evaluate placement of Intra-Aortic Balloon Pump (IABP) or Impella if inotrope requirement accelerates (VIS >= 15).');
    } else if (pgdSeverity === 'PGD_LV_MILD') {
      hemodynamicActionPlan.push('PGD-LV Mild. Low-dose inotropic support, optimize preload (CVP 8-12 mmHg), avoid excessive vasopressors.');
    }

    if (rvFailurePresent) {
      hemodynamicActionPlan.push('Right Ventricular Protection: Inhaled Nitric Oxide 20-40 ppm, cautious diuresis to lower CVP, avoid hypercapnia and acidosis which spike pulmonary vascular resistance.');
    }

    const clinicalSummary = `ISHLT Heart PGD Status: ${pgdSeverity} (VIS: ${visScore}, LVEF: ${lvefPercent}%, CVP: ${cvpMmhg} mmHg, PAPi: ${papi !== undefined ? papi : 'N/A'}).`;

    return {
      visScore,
      papi,
      pgdSeverity,
      rvFailurePresent,
      mechanicalSupportIndicated,
      inhaledVasodilatorRecommended,
      suggestedVasodilatorDose,
      hemodynamicActionPlan,
      clinicalSummary
    };
  }

  /**
   * Database: Record a new allograft transplant.
   */
  public static async recordTransplant(input: {
    patientId: number;
    organType: OrganType;
    donorAge?: number;
    ischemicTimeMinutes: number;
    surgicalNotes?: string;
  }): Promise<any> {
    const res = await pool.query(
      `INSERT INTO allograft_transplant_records (
        patient_id, organ_type, donor_age, ischemic_time_minutes, surgical_notes
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        input.patientId,
        input.organType,
        input.donorAge || null,
        input.ischemicTimeMinutes,
        input.surgicalNotes || ''
      ]
    );
    return res.rows[0];
  }

  /**
   * Database: Log PGD surveillance assessment.
   */
  public static async logPgdSurveillance(input: {
    transplantId: number;
    patientId: number;
    timepoint: Timepoint;
    pao2Fio2Ratio?: number;
    radiographicInfiltrates?: boolean;
    lvefPercent?: number;
    cvpMmhg?: number;
    pcwpMmhg?: number;
    cardiacIndex?: number;
    papi?: number;
    visScore?: number;
    ecmoActive?: boolean;
    ecmoType?: EcmoType;
    pgdGrade: string;
    inhaledVasodilator?: InhaledVasodilator;
    inhaledVasodilatorDose?: string;
    recommendations?: any;
  }): Promise<any> {
    const res = await pool.query(
      `INSERT INTO pgd_surveillance_logs (
        transplant_id, patient_id, timepoint, pao2_fio2_ratio,
        radiographic_infiltrates, lvef_percent, cvp_mmhg, pcwp_mmhg,
        cardiac_index, papi, vis_score, ecmo_active, ecmo_type,
        pgd_grade, inhaled_vasodilator, inhaled_vasodilator_dose, recommendations
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        input.transplantId,
        input.patientId,
        input.timepoint,
        input.pao2Fio2Ratio || null,
        input.radiographicInfiltrates || false,
        input.lvefPercent || null,
        input.cvpMmhg || null,
        input.pcwpMmhg || null,
        input.cardiacIndex || null,
        input.papi || null,
        input.visScore || null,
        input.ecmoActive || false,
        input.ecmoType || 'NONE',
        input.pgdGrade,
        input.inhaledVasodilator || 'NONE',
        input.inhaledVasodilatorDose || null,
        JSON.stringify(input.recommendations || {})
      ]
    );
    return res.rows[0];
  }

  /**
   * Database: Get patient allograft transplants.
   */
  public static async getPatientTransplants(patientId: number): Promise<any[]> {
    const res = await pool.query(
      `SELECT * FROM allograft_transplant_records
       WHERE patient_id = $1
       ORDER BY transplant_timestamp DESC`,
      [patientId]
    );
    return res.rows;
  }

  /**
   * Database: Get PGD surveillance logs for a transplant.
   */
  public static async getTransplantPgdLogs(transplantId: number): Promise<any[]> {
    const res = await pool.query(
      `SELECT * FROM pgd_surveillance_logs
       WHERE transplant_id = $1
       ORDER BY logged_at DESC`,
      [transplantId]
    );
    return res.rows;
  }
}
