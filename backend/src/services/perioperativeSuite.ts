import { pool } from '../db';

export interface RcriFactors {
  highRiskSurgery?: boolean;
  ischemicHeartDisease?: boolean;
  congestiveHeartFailure?: boolean;
  cerebrovascularDisease?: boolean;
  insulinTherapy?: boolean;
  preopCreatinineOverTwo?: boolean;
}

export interface SurgicalCaseInput {
  patientId: number;
  sessionId?: string | null;
  procedureName: string;
  operatingRoom: string;
  primarySurgeon: string;
  anesthesiologist: string;
  asaClass: 'ASA_I' | 'ASA_II' | 'ASA_III' | 'ASA_IV' | 'ASA_V_E';
  rcriFactors?: RcriFactors;
  mallampatiClass?: 'Class_I' | 'Class_II' | 'Class_III' | 'Class_IV';
  npoStatusVerified?: boolean;
}

export interface AnesthesiaLogInput {
  caseId: number;
  anesthesiaType: 'general_endotracheal' | 'spinal_epidural' | 'mac_sedation' | 'regional_block';
  airwayGrade?: string;
  tofTwitchCount: number; // 0 - 4
  reversalAgent?: string;
  eblMl: number;
  fluidsAdministeredMl: number;
  aldreteScore: number; // 0 - 10
  ponvApfelScore: number; // 0 - 4
  erasAdherenceItems: string[];
  anesthesiologistNotes?: string;
}

export interface AnesthesiaRecord {
  id: number;
  caseId: number;
  anesthesiaType: string;
  airwayGrade: string;
  tofTwitchCount: number;
  reversalAgent?: string | null;
  eblMl: number;
  fluidsAdministeredMl: number;
  aldreteScore: number;
  ponvApfelScore: number;
  erasProtocolAdherence: string[];
  anesthesiaSummary: string;
  pacuDischargeEligible: boolean;
  createdAt: string;
}

export interface SurgicalCaseRecord {
  id: number;
  patientId: number;
  sessionId?: string | null;
  procedureName: string;
  operatingRoom: string;
  primarySurgeon: string;
  anesthesiologist: string;
  asaClass: string;
  rcriScore: number;
  rcriRiskPercentage: number;
  mallampatiClass: string;
  npoStatusVerified: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  patientName?: string;
  anesthesiaRecord?: AnesthesiaRecord | null;
}

export class PerioperativeSuiteService {
  /**
   * Calculates Revised Cardiac Risk Index (RCRI) score and risk percentage.
   */
  calculateRcri(factors?: RcriFactors): { score: number; riskPercent: number } {
    if (!factors) return { score: 0, riskPercent: 0.4 };
    let score = 0;
    if (factors.highRiskSurgery) score += 1;
    if (factors.ischemicHeartDisease) score += 1;
    if (factors.congestiveHeartFailure) score += 1;
    if (factors.cerebrovascularDisease) score += 1;
    if (factors.insulinTherapy) score += 1;
    if (factors.preopCreatinineOverTwo) score += 1;

    let riskPercent = 0.4;
    if (score === 1) riskPercent = 1.0;
    else if (score === 2) riskPercent = 2.4;
    else if (score >= 3) riskPercent = 5.4;

    return { score, riskPercent };
  }

  /**
   * Pre-populates OR suite with demo surgical cases if empty.
   */
  async seedInitialORCasesIfEmpty(): Promise<void> {
    const { rows } = await pool.query('SELECT COUNT(*) FROM surgical_cases');
    if (parseInt(rows[0].count, 10) > 0) return;

    // Fetch a sample patient or fallback
    const patientRes = await pool.query('SELECT id FROM patients LIMIT 1');
    const patientId = patientRes.rows.length > 0 ? patientRes.rows[0].id : 1;

    const initialCases = [
      {
        procedure: 'Off-Pump Coronary Artery Bypass (OPCAB)',
        room: 'OR-1 (Cardiovascular)',
        surgeon: 'Dr. Marcus Vance, MD',
        anesthesiologist: 'Dr. Elena Rostova, MD',
        asa: 'ASA_IV',
        rcri: 3,
        mallampati: 'Class_II',
        status: 'in_or'
      },
      {
        procedure: 'Total Hip Arthroplasty (Direct Anterior)',
        room: 'OR-2 (Orthopedics)',
        surgeon: 'Dr. Gregory Stone, MD',
        anesthesiologist: 'Dr. Alan Drake, MD',
        asa: 'ASA_II',
        rcri: 0,
        mallampati: 'Class_I',
        status: 'preop_ready'
      },
      {
        procedure: 'Laparoscopic Left Hemicolectomy (ERAS)',
        room: 'OR-3 (General / Colorectal)',
        surgeon: 'Dr. Cynthia Hayes, MD',
        anesthesiologist: 'Dr. Chloe Kim, MD',
        asa: 'ASA_III',
        rcri: 1,
        mallampati: 'Class_II',
        status: 'pacu_recovery'
      }
    ];

    for (const c of initialCases) {
      const caseRes = await pool.query(`
        INSERT INTO surgical_cases (
          patient_id, procedure_name, operating_room, primary_surgeon, anesthesiologist,
          asa_class, rcri_score, mallampati_class, npo_status_verified, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9)
        RETURNING id;
      `, [patientId, c.procedure, c.room, c.surgeon, c.anesthesiologist, c.asa, c.rcri, c.mallampati, c.status]);

      if (c.status === 'pacu_recovery') {
        await pool.query(`
          INSERT INTO anesthesia_records (
            case_id, anesthesia_type, airway_grade, tof_twitch_count, reversal_agent,
            ebl_ml, fluids_administered_ml, aldrete_score, ponv_apfel_score,
            eras_protocol_adherence, anesthesia_summary
          ) VALUES ($1, 'general_endotracheal', 'Grade_1', 4, 'sugammadex_200mg', 120, 1500, 9, 1,
            $2, 'Smooth endotracheal extubation in OR. TOF 4/4 post-sugammadex. Transferred to PACU in stable condition.'
          )
        `, [caseRes.rows[0].id, JSON.stringify([
          'Preemptive oral acetaminophen & celecoxib',
          'Intraoperative protective lung ventilation',
          'Goal-directed fluid restriction',
          'Transversus abdominis plane (TAP) block',
          'Early oral fluid sips approved'
        ])]);
      }
    }
  }

  /**
   * Books a new surgical case with perioperative risk evaluation.
   */
  async createSurgicalCase(input: SurgicalCaseInput): Promise<SurgicalCaseRecord> {
    await this.seedInitialORCasesIfEmpty();
    const { score, riskPercent } = this.calculateRcri(input.rcriFactors);

    const query = `
      INSERT INTO surgical_cases (
        patient_id,
        session_id,
        procedure_name,
        operating_room,
        primary_surgeon,
        anesthesiologist,
        asa_class,
        rcri_score,
        mallampati_class,
        npo_status_verified,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'scheduled')
      RETURNING *;
    `;

    const values = [
      input.patientId,
      input.sessionId || null,
      input.procedureName,
      input.operatingRoom,
      input.primarySurgeon,
      input.anesthesiologist,
      input.asaClass,
      score,
      input.mallampatiClass || 'Class_I',
      input.npoStatusVerified !== undefined ? input.npoStatusVerified : true
    ];

    const { rows } = await pool.query(query, values);
    return this.mapCaseRow(rows[0], riskPercent);
  }

  /**
   * Updates surgical case lifecycle status.
   */
  async updateCaseStatus(caseId: number, status: string): Promise<SurgicalCaseRecord> {
    const query = `
      UPDATE surgical_cases
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [status, caseId]);
    if (rows.length === 0) {
      throw new Error(`Surgical case #${caseId} not found.`);
    }
    return this.mapCaseRow(rows[0]);
  }

  /**
   * Records anesthesia administration, neuromuscular recovery, and PACU Aldrete scoring.
   */
  async recordAnesthesiaLog(input: AnesthesiaLogInput): Promise<AnesthesiaRecord> {
    const pacuDischargeEligible = input.aldreteScore >= 9 && input.tofTwitchCount === 4;

    let summary = `Anesthesia Modality: ${input.anesthesiaType.replace(/_/g, ' ')}. `;
    summary += `Airway: ${input.airwayGrade || 'Grade 1'}. `;
    summary += `Neuromuscular status: TOF ${input.tofTwitchCount}/4 with ${input.reversalAgent ? input.reversalAgent.replace(/_/g, ' ') : 'spontaneous recovery'}. `;
    summary += `EBL: ${input.eblMl} mL. Total Fluids: ${input.fluidsAdministeredMl} mL. `;
    summary += `PACU Modified Aldrete Score: ${input.aldreteScore}/10 (${pacuDischargeEligible ? 'Eligible for Phase II Discharge' : 'Requires ongoing PACU monitoring'}). `;
    if (input.anesthesiologistNotes) {
      summary += `Notes: ${input.anesthesiologistNotes}`;
    }

    const query = `
      INSERT INTO anesthesia_records (
        case_id,
        anesthesia_type,
        airway_grade,
        tof_twitch_count,
        reversal_agent,
        ebl_ml,
        fluids_administered_ml,
        aldrete_score,
        ponv_apfel_score,
        eras_protocol_adherence,
        anesthesia_summary
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `;

    const values = [
      input.caseId,
      input.anesthesiaType,
      input.airwayGrade || 'Grade_1',
      input.tofTwitchCount,
      input.reversalAgent || null,
      input.eblMl,
      input.fluidsAdministeredMl,
      input.aldreteScore,
      input.ponvApfelScore,
      JSON.stringify(input.erasAdherenceItems || []),
      summary
    ];

    const { rows } = await pool.query(query, values);
    const row = rows[0];

    // If Aldrete score is provided and case is not yet discharged, update case status to pacu_recovery
    await pool.query(`
      UPDATE surgical_cases
      SET status = 'pacu_recovery', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status NOT IN ('discharged');
    `, [input.caseId]);

    return {
      id: row.id,
      caseId: row.case_id,
      anesthesiaType: row.anesthesia_type,
      airwayGrade: row.airway_grade,
      tofTwitchCount: row.tof_twitch_count,
      reversalAgent: row.reversal_agent,
      eblMl: row.ebl_ml,
      fluidsAdministeredMl: row.fluids_administered_ml,
      aldreteScore: row.aldrete_score,
      ponvApfelScore: row.ponv_apfel_score,
      erasProtocolAdherence: typeof row.eras_protocol_adherence === 'string'
        ? JSON.parse(row.eras_protocol_adherence)
        : (row.eras_protocol_adherence || []),
      anesthesiaSummary: row.anesthesia_summary,
      pacuDischargeEligible,
      createdAt: row.created_at
    };
  }

  /**
   * Retrieves all surgical cases with joined patient and anesthesia details.
   */
  async getSurgicalCases(status?: string, operatingRoom?: string): Promise<SurgicalCaseRecord[]> {
    await this.seedInitialORCasesIfEmpty();

    let query = `
      SELECT c.*, p.name as patient_name,
             a.id as anesth_id, a.anesthesia_type, a.airway_grade, a.tof_twitch_count,
             a.reversal_agent, a.ebl_ml, a.fluids_administered_ml, a.aldrete_score,
             a.ponv_apfel_score, a.eras_protocol_adherence, a.anesthesia_summary, a.created_at as anesth_created_at
      FROM surgical_cases c
      LEFT JOIN patients p ON c.patient_id = p.id
      LEFT JOIN anesthesia_records a ON c.id = a.case_id
    `;

    const values: any[] = [];
    const conditions: string[] = [];

    if (status) {
      conditions.push(`c.status = $${values.length + 1}`);
      values.push(status);
    }
    if (operatingRoom) {
      conditions.push(`c.operating_room = $${values.length + 1}`);
      values.push(operatingRoom);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    query += ' ORDER BY c.created_at DESC;';

    const { rows } = await pool.query(query, values);
    return rows.map(r => this.mapJoinedCaseRow(r));
  }

  /**
   * Retrieves single surgical case by ID.
   */
  async getCaseById(caseId: number): Promise<SurgicalCaseRecord | null> {
    const query = `
      SELECT c.*, p.name as patient_name,
             a.id as anesth_id, a.anesthesia_type, a.airway_grade, a.tof_twitch_count,
             a.reversal_agent, a.ebl_ml, a.fluids_administered_ml, a.aldrete_score,
             a.ponv_apfel_score, a.eras_protocol_adherence, a.anesthesia_summary, a.created_at as anesth_created_at
      FROM surgical_cases c
      LEFT JOIN patients p ON c.patient_id = p.id
      LEFT JOIN anesthesia_records a ON c.id = a.case_id
      WHERE c.id = $1;
    `;
    const { rows } = await pool.query(query, [caseId]);
    if (rows.length === 0) return null;
    return this.mapJoinedCaseRow(rows[0]);
  }

  private mapCaseRow(r: any, precalcRisk?: number): SurgicalCaseRecord {
    const score = Number(r.rcri_score) || 0;
    let risk = precalcRisk;
    if (risk === undefined) {
      risk = 0.4;
      if (score === 1) risk = 1.0;
      else if (score === 2) risk = 2.4;
      else if (score >= 3) risk = 5.4;
    }

    return {
      id: r.id,
      patientId: Number(r.patient_id),
      sessionId: r.session_id,
      procedureName: r.procedure_name,
      operatingRoom: r.operating_room,
      primarySurgeon: r.primary_surgeon,
      anesthesiologist: r.anesthesiologist,
      asaClass: r.asa_class,
      rcriScore: score,
      rcriRiskPercentage: risk,
      mallampatiClass: r.mallampati_class,
      npoStatusVerified: Boolean(r.npo_status_verified),
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      patientName: r.patient_name
    };
  }

  private mapJoinedCaseRow(r: any): SurgicalCaseRecord {
    const base = this.mapCaseRow(r);
    if (r.anesth_id) {
      const aldrete = Number(r.aldrete_score) || 0;
      const tof = Number(r.tof_twitch_count) || 0;
      base.anesthesiaRecord = {
        id: r.anesth_id,
        caseId: r.id,
        anesthesiaType: r.anesthesia_type,
        airwayGrade: r.airway_grade,
        tofTwitchCount: tof,
        reversalAgent: r.reversal_agent,
        eblMl: Number(r.ebl_ml) || 0,
        fluidsAdministeredMl: Number(r.fluids_administered_ml) || 0,
        aldreteScore: aldrete,
        ponvApfelScore: Number(r.ponv_apfel_score) || 0,
        erasProtocolAdherence: typeof r.eras_protocol_adherence === 'string'
          ? JSON.parse(r.eras_protocol_adherence)
          : (r.eras_protocol_adherence || []),
        anesthesiaSummary: r.anesthesia_summary,
        pacuDischargeEligible: aldrete >= 9 && tof === 4,
        createdAt: r.anesth_created_at
      };
    }
    return base;
  }
}

export const perioperativeSuiteService = new PerioperativeSuiteService();
