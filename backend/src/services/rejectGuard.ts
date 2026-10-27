import { pool } from '../db';

export type HeartAcrGrade = '0R' | '1R' | '2R' | '3R';
export type LungAcrGrade = 'A0' | 'A1' | 'A2' | 'A3' | 'A4';
export type PamrGrade = 'pAMR 0' | 'pAMR 1(H)' | 'pAMR 1(I)' | 'pAMR 2' | 'pAMR 3';
export type C4dStaining = 'NEGATIVE' | 'FOCAL' | 'DIFFUSE';
export type DsaStatus = 'NEGATIVE' | 'WEAK' | 'MODERATE' | 'STRONG';
export type DsaRiskLevel = 'LOW' | 'INTERMEDIATE' | 'HIGH' | 'CRITICAL';

export interface HlaLocusMfi {
  locus: 'HLA-A' | 'HLA-B' | 'HLA-C' | 'HLA-DR' | 'HLA-DQ' | 'HLA-DP';
  allele: string;
  mfi: number;
}

export interface BiopsyEvaluationInput {
  transplantId: number;
  patientId: number;
  organType: 'HEART' | 'LUNG_SINGLE' | 'LUNG_BILATERAL' | 'HEART_LUNG';
  heartAcrGrade?: HeartAcrGrade;
  lungAcrGrade?: LungAcrGrade;
  pamrGrade?: PamrGrade;
  c4dStaining: C4dStaining;
  cd68MacrophagesPositive: boolean;
  myocyteDamagePresent?: boolean;
  allograftDysfunctionPresent?: boolean;
  pathologyNotes?: string;
}

export interface BiopsyEvaluationResult {
  organType: string;
  acrGrade: string;
  pamrGrade: string;
  cellularRejectionSeverity: 'NONE' | 'MILD' | 'MODERATE' | 'SEVERE';
  antibodyRejectionSeverity: 'NEGATIVE' | 'SUSPECTED' | 'CONFIRMED' | 'SEVERE';
  treatmentIndicated: boolean;
  recommendedTherapies: {
    category: 'PULSE_STEROID' | 'CYTOLYTIC_ANTIBODY' | 'PLASMAPHERESIS_IVIG' | 'TARGETED_B_CELL' | 'OPTIMIZATION';
    agent: string;
    dosing: string;
    rationale: string;
  }[];
  clinicalActionChecklist: string[];
  summary: string;
}

export interface DsaEvaluationInput {
  transplantId: number;
  patientId: number;
  hlaClass: 'CLASS_I' | 'CLASS_II' | 'BOTH';
  specificHlaLoci: HlaLocusMfi[];
  c1qComplementFixing: boolean;
}

export interface DsaEvaluationResult {
  maxMfi: number;
  dsaStatus: DsaStatus;
  riskStratification: DsaRiskLevel;
  complementFixingAlert: boolean;
  immunologicSummary: string;
  recommendedInterventions: string[];
}

export class RejectGuardService {
  /**
   * Evaluates endomyocardial or transbronchial biopsy for ACR and pAMR.
   */
  public static evaluateBiopsy(input: BiopsyEvaluationInput): BiopsyEvaluationResult {
    const {
      organType,
      heartAcrGrade = '0R',
      lungAcrGrade = 'A0',
      pamrGrade = 'pAMR 0',
      c4dStaining,
      cd68MacrophagesPositive,
      myocyteDamagePresent = false,
      allograftDysfunctionPresent = false
    } = input;

    let cellularRejectionSeverity: 'NONE' | 'MILD' | 'MODERATE' | 'SEVERE' = 'NONE';
    let acrGradeDisplay: string = heartAcrGrade;

    if (organType === 'HEART') {
      acrGradeDisplay = heartAcrGrade;
      if (heartAcrGrade === '3R') {
        cellularRejectionSeverity = 'SEVERE';
      } else if (heartAcrGrade === '2R') {
        cellularRejectionSeverity = 'MODERATE';
      } else if (heartAcrGrade === '1R') {
        cellularRejectionSeverity = 'MILD';
      } else {
        cellularRejectionSeverity = 'NONE';
      }
    } else {
      // Lung allograft
      acrGradeDisplay = lungAcrGrade;
      if (lungAcrGrade === 'A4') {
        cellularRejectionSeverity = 'SEVERE';
      } else if (lungAcrGrade === 'A3') {
        cellularRejectionSeverity = 'MODERATE';
      } else if (lungAcrGrade === 'A1' || lungAcrGrade === 'A2') {
        cellularRejectionSeverity = 'MILD';
      } else {
        cellularRejectionSeverity = 'NONE';
      }
    }

    // Antibody-Mediated Rejection (AMR)
    let antibodyRejectionSeverity: 'NEGATIVE' | 'SUSPECTED' | 'CONFIRMED' | 'SEVERE' = 'NEGATIVE';
    if (pamrGrade === 'pAMR 3') {
      antibodyRejectionSeverity = 'SEVERE';
    } else if (pamrGrade === 'pAMR 2') {
      antibodyRejectionSeverity = 'CONFIRMED';
    } else if (pamrGrade === 'pAMR 1(H)' || pamrGrade === 'pAMR 1(I)' || c4dStaining !== 'NEGATIVE' || cd68MacrophagesPositive) {
      antibodyRejectionSeverity = 'SUSPECTED';
    } else {
      antibodyRejectionSeverity = 'NEGATIVE';
    }

    const recommendedTherapies: BiopsyEvaluationResult['recommendedTherapies'] = [];
    const clinicalActionChecklist: string[] = [];

    const acrNeedsTreatment = cellularRejectionSeverity === 'MODERATE' || cellularRejectionSeverity === 'SEVERE' || (cellularRejectionSeverity === 'MILD' && allograftDysfunctionPresent);
    const amrNeedsTreatment = antibodyRejectionSeverity === 'CONFIRMED' || antibodyRejectionSeverity === 'SEVERE' || (antibodyRejectionSeverity === 'SUSPECTED' && allograftDysfunctionPresent);
    const treatmentIndicated = acrNeedsTreatment || amrNeedsTreatment;

    // ACR Management
    if (cellularRejectionSeverity === 'MODERATE') {
      recommendedTherapies.push({
        category: 'PULSE_STEROID',
        agent: 'Methylprednisolone',
        dosing: '1000 mg IV daily (or 10-15 mg/kg) x 3 consecutive days',
        rationale: 'First-line immunosuppressive pulse for ISHLT Grade 2R (or A3) acute cellular rejection.'
      });
      clinicalActionChecklist.push('Administer IV Methylprednisolone 1000 mg STAT; repeat daily x 3 days.');
      clinicalActionChecklist.push('Check trough Tacrolimus / Cyclosporine levels; target upper therapeutic range.');
      clinicalActionChecklist.push('Schedule repeat surveillance biopsy in 2-4 weeks to confirm histological resolution.');
    } else if (cellularRejectionSeverity === 'SEVERE') {
      recommendedTherapies.push({
        category: 'PULSE_STEROID',
        agent: 'Methylprednisolone',
        dosing: '1000 mg IV daily x 3 days',
        rationale: 'Immediate anti-inflammatory pulse to arrest diffuse lymphohistiocytic destruction.'
      });
      recommendedTherapies.push({
        category: 'CYTOLYTIC_ANTIBODY',
        agent: 'Rabbit Antithymocyte Globulin (rATG / Thymoglobulin)',
        dosing: '1.5 mg/kg/day IV infusion over 6h x 3-5 days (titrate to CD3 count < 20-50 cells/mcL)',
        rationale: 'Polyclonal T-cell depletion for hemodynamically unstable or Grade 3R severe cellular rejection.'
      });
      clinicalActionChecklist.push('STAT rATG initiation with premedication (Acetaminophen, Diphenhydramine, Hydrocortisone).');
      clinicalActionChecklist.push('Daily absolute lymphocyte count and CD3 monitoring during rATG therapy.');
      clinicalActionChecklist.push('Provide CMV and PCP antimicrobial prophylaxis during cytolytic therapy.');
    } else if (cellularRejectionSeverity === 'MILD') {
      clinicalActionChecklist.push('Grade 1R (or A1/A2): Asymptomatic rejection. Optimize maintenance immunosuppression; repeat biopsy in 4 weeks.');
    }

    // AMR Management
    if (amrNeedsTreatment) {
      recommendedTherapies.push({
        category: 'PLASMAPHERESIS_IVIG',
        agent: 'Therapeutic Plasma Exchange (TPE) + Low-Dose IVIG',
        dosing: '1.0-1.5 plasma volume exchange every other day x 5-7 sessions, followed by IVIG 100 mg/kg after each TPE session or 1-2 g/kg post-series',
        rationale: 'Mechanical clearance of circulating cytotoxic donor-specific antibodies plus immunomodulation.'
      });
      recommendedTherapies.push({
        category: 'TARGETED_B_CELL',
        agent: 'Rituximab (or Bortezomib)',
        dosing: 'Rituximab 375 mg/m2 IV single dose (or Bortezomib 1.3 mg/m2 on days 1, 4, 8, 11)',
        rationale: 'CD20 B-cell depletion / plasma cell proteasome inhibition to eliminate antibody-secreting clones.'
      });
      clinicalActionChecklist.push('Coordinate Therapeutic Plasma Exchange (TPE) central catheter placement.');
      clinicalActionChecklist.push('Order STAT Luminex Single-Antigen Bead (SAB) assay with C1q complement-fixing screen.');
      clinicalActionChecklist.push('Monitor cardiac index, echocardiographic strain, and ventricular filling pressures continuously.');
    }

    const summary = `Histopathology: ACR ${acrGradeDisplay} (${cellularRejectionSeverity}), pAMR ${pamrGrade} (${antibodyRejectionSeverity}). C4d: ${c4dStaining}. Treatment Indicated: ${treatmentIndicated ? 'YES' : 'NO'}.`;

    return {
      organType,
      acrGrade: acrGradeDisplay,
      pamrGrade,
      cellularRejectionSeverity,
      antibodyRejectionSeverity,
      treatmentIndicated,
      recommendedTherapies,
      clinicalActionChecklist,
      summary
    };
  }

  /**
   * Evaluates Luminex Single-Antigen Bead (SAB) and C1q Complement-Fixing DSA assays.
   */
  public static evaluateDsaSurveillance(input: DsaEvaluationInput): DsaEvaluationResult {
    const { hlaClass, specificHlaLoci = [], c1qComplementFixing } = input;

    let maxMfi = 0;
    for (const item of specificHlaLoci) {
      if (item.mfi > maxMfi) {
        maxMfi = item.mfi;
      }
    }

    let dsaStatus: DsaStatus = 'NEGATIVE';
    let riskStratification: DsaRiskLevel = 'LOW';

    if (maxMfi > 10000) {
      dsaStatus = 'STRONG';
      riskStratification = 'CRITICAL';
    } else if (maxMfi > 3000) {
      dsaStatus = 'MODERATE';
      riskStratification = c1qComplementFixing ? 'CRITICAL' : 'HIGH';
    } else if (maxMfi >= 1000) {
      dsaStatus = 'WEAK';
      riskStratification = c1qComplementFixing ? 'HIGH' : 'INTERMEDIATE';
    } else {
      dsaStatus = 'NEGATIVE';
      riskStratification = 'LOW';
    }

    const recommendedInterventions: string[] = [];
    if (riskStratification === 'CRITICAL' || riskStratification === 'HIGH') {
      recommendedInterventions.push('Initiate desensitization / antibody removal: Therapeutic Plasma Exchange (TPE) 5-7 sessions.');
      recommendedInterventions.push('Administer IVIG (1-2 g/kg total dose) to neutralize residual antibodies.');
      recommendedInterventions.push('Consider Bortezomib (1.3 mg/m2) or Rituximab (375 mg/m2) to suppress antibody production.');
      recommendedInterventions.push('Urgent protocol endomyocardial/transbronchial biopsy to rule out subclinical microvascular injury.');
    } else if (riskStratification === 'INTERMEDIATE') {
      recommendedInterventions.push('Close serial Luminex surveillance (monthly x 3 months).');
      recommendedInterventions.push('Optimize calcineurin inhibitor (CNI) trough targets and check mycophenolate compliance.');
    } else {
      recommendedInterventions.push('Routine post-transplant DSA surveillance protocol (3, 6, 12 months post-op).');
    }

    const complementFixingAlert = c1qComplementFixing;
    let immunologicSummary = `Luminex SAB: ${dsaStatus} DSA (Max MFI: ${maxMfi}, ${hlaClass}). Risk: ${riskStratification}.`;
    if (complementFixingAlert) {
      immunologicSummary += ' CRITICAL ALERT: C1q complement-fixing antibodies detected (active complement pathway cytotoxicity).';
    }

    return {
      maxMfi,
      dsaStatus,
      riskStratification,
      complementFixingAlert,
      immunologicSummary,
      recommendedInterventions
    };
  }

  /**
   * Database: Save allograft rejection biopsy.
   */
  public static async saveBiopsy(input: {
    transplantId: number;
    patientId: number;
    organType: string;
    acrGrade: string;
    pamrGrade: string;
    c4dStaining: string;
    cd68Macrophages: string;
    myocyteDamagePresent?: boolean;
    allograftDysfunctionPresent?: boolean;
    treatmentIndicated: boolean;
    pathologyNotes?: string;
  }): Promise<any> {
    const res = await pool.query(
      `INSERT INTO allograft_rejection_biopsies (
        transplant_id, patient_id, organ_type, acr_grade, pamr_grade,
        c4d_staining, cd68_macrophages, myocyte_damage_present,
        allograft_dysfunction_present, treatment_indicated, pathology_notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        input.transplantId,
        input.patientId,
        input.organType,
        input.acrGrade,
        input.pamrGrade,
        input.c4dStaining,
        input.cd68Macrophages,
        input.myocyteDamagePresent || false,
        input.allograftDysfunctionPresent || false,
        input.treatmentIndicated,
        input.pathologyNotes || ''
      ]
    );
    return res.rows[0];
  }

  /**
   * Database: Save DSA Luminex surveillance record.
   */
  public static async saveDsaSurveillance(input: {
    transplantId: number;
    patientId: number;
    hlaClass: string;
    specificHlaLoci: any[];
    maxMfi: number;
    c1qComplementFixing: boolean;
    dsaStatus: string;
    riskStratification: string;
    recommendedInterventions?: any[];
  }): Promise<any> {
    const res = await pool.query(
      `INSERT INTO dsa_luminex_surveillance (
        transplant_id, patient_id, hla_class, specific_hla_loci,
        max_mfi, c1q_complement_fixing, dsa_status, risk_stratification,
        recommended_interventions
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        input.transplantId,
        input.patientId,
        input.hlaClass,
        JSON.stringify(input.specificHlaLoci || []),
        input.maxMfi,
        input.c1qComplementFixing || false,
        input.dsaStatus,
        input.riskStratification,
        JSON.stringify(input.recommendedInterventions || [])
      ]
    );
    return res.rows[0];
  }

  /**
   * Database: Get patient biopsies.
   */
  public static async getPatientBiopsies(patientId: number): Promise<any[]> {
    const res = await pool.query(
      `SELECT * FROM allograft_rejection_biopsies
       WHERE patient_id = $1
       ORDER BY biopsy_date DESC`,
      [patientId]
    );
    return res.rows;
  }

  /**
   * Database: Get patient DSA history.
   */
  public static async getPatientDsaHistory(patientId: number): Promise<any[]> {
    const res = await pool.query(
      `SELECT * FROM dsa_luminex_surveillance
       WHERE patient_id = $1
       ORDER BY sample_date DESC`,
      [patientId]
    );
    return res.rows;
  }
}
