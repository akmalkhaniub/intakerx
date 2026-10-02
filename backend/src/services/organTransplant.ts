import { pool } from '../db';

export interface RecipientHlaProfile {
  a?: string[];
  b?: string[];
  c?: string[];
  dr?: string[];
  dq?: string[];
  dp?: string[];
  specificAntibodies?: Array<{
    locus: string;
    allele: string;
    mfi: number;
    c1qPositive?: boolean;
  }>;
}

export interface DonorHlaProfile {
  a: string[];
  b: string[];
  c?: string[];
  dr: string[];
  dq?: string[];
  dp?: string[];
}

export interface DsaMatch {
  locus: string;
  allele: string;
  mfi: number;
  c1qPositive: boolean;
  isUnacceptableAntigen: boolean;
}

export interface VirtualCrossmatchResult {
  id: number;
  transplant_case_id: number;
  crossmatch_type: string;
  detected_dsas: DsaMatch[];
  peak_mfi: number;
  crossmatch_prediction: 'negative_compatible' | 'low_positive_permissible' | 'high_positive_contraindicated';
  rejection_risk_level: 'low' | 'moderate' | 'high_hyperacute';
  recommended_induction_protocol: string;
  desensitization_required: boolean;
  reviewed_by_director?: string;
  evaluated_at: string;
}

export interface TransplantCaseRecord {
  id: number;
  patient_id: number;
  patient_name?: string;
  organ_type: 'kidney' | 'liver' | 'heart' | 'lung' | 'pancreas';
  listing_status: 'active_listed' | 'match_pending' | 'in_transit' | 'in_operating_room' | 'transplanted' | 'delisted';
  recipient_blood_group: string;
  meld_na_score?: number | null;
  kdpi_score?: number | null;
  cpra_percentage: number;
  recipient_hla: RecipientHlaProfile;
  unacceptable_antigens: string[];
  donor_unos_id?: string | null;
  donor_blood_group?: string | null;
  donor_hla?: DonorHlaProfile | null;
  preservation_method: 'static_cold_storage' | 'hypothermic_machine_perfusion' | 'normothermic_regional_perfusion';
  cross_clamp_timestamp?: string | null;
  max_acceptable_cit_hours: number;
  transit_courier_eta?: string | null;
  assigned_surgeon?: string | null;
  created_at: string;
  updated_at: string;
  elapsedCitHours?: number;
  citRiskStatus?: 'optimal' | 'caution_approaching_limit' | 'critical_risk';
  crossmatches?: VirtualCrossmatchResult[];
}

export class OrganTransplantService {
  /**
   * Calculates OPTN/UNOS Standard MELD-Na Score
   * MELD(i) = 9.57 * ln(Cr) + 3.78 * ln(Bilirubin) + 11.2 * ln(INR) + 6.43
   * If MELD(i) > 11: MELD-Na = MELD(i) + 1.32 * (137 - Na) - [0.033 * MELD(i) * (137 - Na)]
   */
  public static calculateMeldNa(params: {
    creatinine: number;
    bilirubin: number;
    inr: number;
    sodium: number;
    onDialysisTwicePastWeek?: boolean;
  }): { meldInitial: number; meldNa: number } {
    let cr = params.onDialysisTwicePastWeek ? 4.0 : Math.max(1.0, Math.min(params.creatinine, 4.0));
    let bili = Math.max(1.0, params.bilirubin);
    let inr = Math.max(1.0, params.inr);
    let na = Math.max(125, Math.min(params.sodium, 137));

    let meldInitial = 9.57 * Math.log(cr) + 3.78 * Math.log(bili) + 11.2 * Math.log(inr) + 6.43;
    meldInitial = Math.round(meldInitial);

    let meldNa = meldInitial;
    if (meldInitial > 11) {
      meldNa = meldInitial + 1.32 * (137 - na) - (0.033 * meldInitial * (137 - na));
      meldNa = Math.round(meldNa);
      meldNa = Math.max(meldInitial, Math.min(meldNa, 40));
    }

    return { meldInitial, meldNa };
  }

  /**
   * Approximates Kidney Donor Profile Index (KDPI %) based on donor attributes
   */
  public static calculateKdpi(params: {
    donorAge: number;
    donorHeightCm: number;
    donorWeightKg: number;
    hypertension: boolean;
    diabetes: boolean;
    causeOfDeath: 'trauma' | 'stroke' | 'anoxia' | 'other';
    creatinine: number;
    dcd: boolean; // Donation after Circulatory Death
    hcvPositive?: boolean;
  }): number {
    let kdpi = 20; // baseline
    if (params.donorAge > 50) kdpi += (params.donorAge - 50) * 1.5;
    if (params.hypertension) kdpi += 12;
    if (params.diabetes) kdpi += 15;
    if (params.causeOfDeath === 'stroke') kdpi += 8;
    if (params.creatinine > 1.5) kdpi += (params.creatinine - 1.5) * 10;
    if (params.dcd) kdpi += 14;
    if (params.hcvPositive) kdpi += 10;

    return Math.max(1, Math.min(Math.round(kdpi), 99));
  }

  /**
   * Creates a solid organ transplant listing
   */
  public static async createTransplantCase(params: {
    patientId: number;
    organType: 'kidney' | 'liver' | 'heart' | 'lung' | 'pancreas';
    recipientBloodGroup: string;
    meldNaScore?: number;
    kdpiScore?: number;
    cpraPercentage?: number;
    recipientHla: RecipientHlaProfile;
    unacceptableAntigens?: string[];
    assignedSurgeon?: string;
  }): Promise<TransplantCaseRecord> {
    const {
      patientId,
      organType,
      recipientBloodGroup,
      meldNaScore,
      kdpiScore,
      cpraPercentage = 0,
      recipientHla,
      unacceptableAntigens = [],
      assignedSurgeon
    } = params;

    const maxCitHours = organType === 'heart' ? 5.0 : organType === 'lung' ? 8.0 : organType === 'liver' ? 10.0 : 24.0;

    const insertRes = await pool.query(
      `INSERT INTO transplant_cases (
        patient_id, organ_type, recipient_blood_group, meld_na_score,
        kdpi_score, cpra_percentage, recipient_hla, unacceptable_antigens,
        max_acceptable_cit_hours, assigned_surgeon
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        patientId,
        organType,
        recipientBloodGroup,
        meldNaScore || null,
        kdpiScore || null,
        cpraPercentage,
        JSON.stringify(recipientHla),
        unacceptableAntigens,
        maxCitHours,
        assignedSurgeon || 'Transplant Surgical Service'
      ]
    );

    return insertRes.rows[0];
  }

  /**
   * Virtual Flow-Cytometry Crossmatch & DSA Analysis Engine
   */
  public static async runVirtualCrossmatch(params: {
    transplantCaseId: number;
    donorUnosId: string;
    donorBloodGroup: string;
    donorHla: DonorHlaProfile;
    preservationMethod: 'static_cold_storage' | 'hypothermic_machine_perfusion' | 'normothermic_regional_perfusion';
    crossClampTimestamp?: string;
    transitEtaMinutes?: number;
    reviewedByDirector?: string;
  }): Promise<{ crossmatch: VirtualCrossmatchResult; updatedCase: TransplantCaseRecord }> {
    const {
      transplantCaseId,
      donorUnosId,
      donorBloodGroup,
      donorHla,
      preservationMethod,
      crossClampTimestamp = new Date().toISOString(),
      transitEtaMinutes = 90,
      reviewedByDirector
    } = params;

    const caseRes = await pool.query(`SELECT * FROM transplant_cases WHERE id = $1`, [transplantCaseId]);
    if (caseRes.rows.length === 0) {
      throw new Error(`Transplant Case #${transplantCaseId} not found`);
    }
    const tCase = caseRes.rows[0];

    const recipientHla: RecipientHlaProfile = tCase.recipient_hla || {};
    const unacceptables: string[] = tCase.unacceptable_antigens || [];
    const antibodies = recipientHla.specificAntibodies || [];

    // Collect all donor alleles
    const allDonorAlleles: Array<{ locus: string; allele: string }> = [];
    (donorHla.a || []).forEach(al => allDonorAlleles.push({ locus: 'A', allele: al }));
    (donorHla.b || []).forEach(al => allDonorAlleles.push({ locus: 'B', allele: al }));
    (donorHla.c || []).forEach(al => allDonorAlleles.push({ locus: 'C', allele: al }));
    (donorHla.dr || []).forEach(al => allDonorAlleles.push({ locus: 'DR', allele: al }));
    (donorHla.dq || []).forEach(al => allDonorAlleles.push({ locus: 'DQ', allele: al }));
    (donorHla.dp || []).forEach(al => allDonorAlleles.push({ locus: 'DP', allele: al }));

    // Detect DSAs
    const detectedDsas: DsaMatch[] = [];
    let peakMfi = 0;

    for (const dAllele of allDonorAlleles) {
      const matchAb = antibodies.find(ab => 
        ab.allele.toLowerCase() === dAllele.allele.toLowerCase() ||
        ab.allele.replace('*', '').toLowerCase() === dAllele.allele.replace('*', '').toLowerCase()
      );

      const isUnacceptable = unacceptables.some(u => 
        u.toLowerCase() === dAllele.allele.toLowerCase() ||
        u.replace('*', '').toLowerCase() === dAllele.allele.replace('*', '').toLowerCase()
      );

      if (matchAb || isUnacceptable) {
        const mfi = matchAb ? matchAb.mfi : 5000;
        const c1q = matchAb?.c1qPositive ?? (mfi > 4000);
        detectedDsas.push({
          locus: dAllele.locus,
          allele: dAllele.allele,
          mfi,
          c1qPositive: c1q,
          isUnacceptableAntigen: isUnacceptable
        });
        if (mfi > peakMfi) peakMfi = mfi;
      }
    }

    // Determine Virtual Crossmatch Outcome
    let prediction: 'negative_compatible' | 'low_positive_permissible' | 'high_positive_contraindicated' = 'negative_compatible';
    let riskLevel: 'low' | 'moderate' | 'high_hyperacute' = 'low';
    let inductionProtocol = 'Compatible crossmatch. Standard induction: Basiliximab (Simulect 20mg IV D0/D4) + Tacrolimus + MMF + Corticosteroid taper.';
    let desensitizationReq = false;

    const hasContraindicatedDsa = detectedDsas.some(d => d.isUnacceptableAntigen || d.mfi >= 3500 || (d.c1qPositive && d.mfi > 2500));
    const hasModerateDsa = detectedDsas.some(d => d.mfi >= 1000 && d.mfi < 3500);

    if (hasContraindicatedDsa) {
      prediction = 'high_positive_contraindicated';
      riskLevel = 'high_hyperacute';
      inductionProtocol = 'CONTRAINDICATED: High-titer complement-fixing DSAs detected. Extreme risk of hyperacute/accelerated AMR. Urgent organ decline recommended unless pre-transplant plasma exchange + IVIG + Eculizumab protocol active.';
      desensitizationReq = true;
    } else if (hasModerateDsa) {
      prediction = 'low_positive_permissible';
      riskLevel = 'moderate';
      inductionProtocol = 'PERMISSIBLE BORDERLINE: Low-level DSA present. Administer Augmented Induction: Antithymocyte Globulin (Thymoglobulin 6 mg/kg cumulative) + Intra-op Methylprednisolone 500mg + IVIG 1g/kg on POD 1.';
      desensitizationReq = true;
    }

    // Insert HLA crossmatch record
    const insertXmRes = await pool.query(
      `INSERT INTO hla_crossmatches (
        transplant_case_id, crossmatch_type, detected_dsas, peak_mfi,
        crossmatch_prediction, rejection_risk_level, recommended_induction_protocol,
        desensitization_required, reviewed_by_director
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        transplantCaseId,
        'virtual_flow_cytometry',
        JSON.stringify(detectedDsas),
        peakMfi,
        prediction,
        riskLevel,
        inductionProtocol,
        desensitizationReq,
        reviewedByDirector || 'HLA Histocompatibility Lab Director'
      ]
    );

    // Update case with donor info & transit ETA
    const etaTimestamp = new Date(Date.now() + transitEtaMinutes * 60 * 1000).toISOString();
    const updatedStatus = prediction === 'high_positive_contraindicated' ? 'match_pending' : 'in_transit';

    const updateCaseRes = await pool.query(
      `UPDATE transplant_cases SET
        donor_unos_id = $1,
        donor_blood_group = $2,
        donor_hla = $3,
        preservation_method = $4,
        cross_clamp_timestamp = $5,
        transit_courier_eta = $6,
        listing_status = $7,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *`,
      [
        donorUnosId,
        donorBloodGroup,
        JSON.stringify(donorHla),
        preservationMethod,
        crossClampTimestamp,
        etaTimestamp,
        updatedStatus,
        transplantCaseId
      ]
    );

    return {
      crossmatch: insertXmRes.rows[0],
      updatedCase: updateCaseRes.rows[0]
    };
  }

  /**
   * Updates transplant case status (e.g. into OR, transplanted)
   */
  public static async updateCaseStatus(caseId: number, status: string): Promise<TransplantCaseRecord> {
    const res = await pool.query(
      `UPDATE transplant_cases SET listing_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [status, caseId]
    );
    if (res.rows.length === 0) throw new Error(`Transplant Case #${caseId} not found`);
    return res.rows[0];
  }

  /**
   * Retrieves summary analytics for transplant command center
   */
  public static async getTransplantDashboardAnalytics(): Promise<{
    activeListedCount: number;
    inTransitCount: number;
    inOrCount: number;
    totalCrossmatches: number;
    compatibleRate: string;
    organBreakdown: Record<string, number>;
  }> {
    const casesRes = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE listing_status = 'active_listed') as active_listed,
        COUNT(*) FILTER (WHERE listing_status = 'in_transit') as in_transit,
        COUNT(*) FILTER (WHERE listing_status = 'in_operating_room') as in_or,
        organ_type, COUNT(*) as org_count
      FROM transplant_cases
      GROUP BY organ_type
    `);

    const xmRes = await pool.query(`
      SELECT 
        COUNT(*) as total_xm,
        COUNT(*) FILTER (WHERE crossmatch_prediction = 'negative_compatible') as compatible_xm
      FROM hla_crossmatches
    `);

    let activeListed = 0;
    let inTransit = 0;
    let inOr = 0;
    const organMap: Record<string, number> = {};

    casesRes.rows.forEach(r => {
      activeListed += Number(r.active_listed || 0);
      inTransit += Number(r.in_transit || 0);
      inOr += Number(r.in_or || 0);
      organMap[r.organ_type] = Number(r.org_count || 0);
    });

    const totalXm = Number(xmRes.rows[0]?.total_xm || 0);
    const compXm = Number(xmRes.rows[0]?.compatible_xm || 0);
    const compRate = totalXm > 0 ? `${((compXm / totalXm) * 100).toFixed(1)}%` : '100.0%';

    return {
      activeListedCount: activeListed,
      inTransitCount: inTransit,
      inOrCount: inOr,
      totalCrossmatches: totalXm,
      compatibleRate: compRate,
      organBreakdown: organMap
    };
  }

  /**
   * Retrieves all transplant cases with computed CIT metrics
   */
  public static async getTransplantCases(status?: string, organType?: string): Promise<TransplantCaseRecord[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (status) {
      conditions.push(`c.listing_status = $${idx++}`);
      values.push(status);
    }
    if (organType) {
      conditions.push(`c.organ_type = $${idx++}`);
      values.push(organType);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const res = await pool.query(`
      SELECT c.*, p.name as patient_name
      FROM transplant_cases c
      LEFT JOIN patients p ON c.patient_id = p.id
      ${whereClause}
      ORDER BY c.created_at DESC
    `, values);

    const now = Date.now();

    return res.rows.map(row => {
      let elapsedCitHours = 0;
      let citRiskStatus: 'optimal' | 'caution_approaching_limit' | 'critical_risk' = 'optimal';

      if (row.cross_clamp_timestamp) {
        const clampMs = new Date(row.cross_clamp_timestamp).getTime();
        elapsedCitHours = Number(((now - clampMs) / (1000 * 60 * 60)).toFixed(1));
        const maxCit = Number(row.max_acceptable_cit_hours || 24);

        if (elapsedCitHours > maxCit * 0.8) {
          citRiskStatus = 'critical_risk';
        } else if (elapsedCitHours > maxCit * 0.5) {
          citRiskStatus = 'caution_approaching_limit';
        }
      }

      return {
        ...row,
        elapsedCitHours,
        citRiskStatus
      };
    });
  }

  /**
   * Retrieves single case with crossmatch history
   */
  public static async getCaseDetails(caseId: number): Promise<TransplantCaseRecord> {
    const caseRes = await pool.query(`
      SELECT c.*, p.name as patient_name
      FROM transplant_cases c
      LEFT JOIN patients p ON c.patient_id = p.id
      WHERE c.id = $1
    `, [caseId]);

    if (caseRes.rows.length === 0) throw new Error(`Transplant Case #${caseId} not found`);

    const xmRes = await pool.query(`
      SELECT * FROM hla_crossmatches WHERE transplant_case_id = $1 ORDER BY evaluated_at DESC
    `, [caseId]);

    const record = caseRes.rows[0];
    record.crossmatches = xmRes.rows;

    if (record.cross_clamp_timestamp) {
      const clampMs = new Date(record.cross_clamp_timestamp).getTime();
      record.elapsedCitHours = Number(((Date.now() - clampMs) / (1000 * 60 * 60)).toFixed(1));
      const maxCit = Number(record.max_acceptable_cit_hours || 24);
      record.citRiskStatus = record.elapsedCitHours > maxCit * 0.8 ? 'critical_risk' : record.elapsedCitHours > maxCit * 0.5 ? 'caution_approaching_limit' : 'optimal';
    }

    return record;
  }
}
