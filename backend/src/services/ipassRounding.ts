import { query } from '../db';

export interface ActionItem {
  id: string;
  task: string;
  completed: boolean;
  priority: 'stat' | 'routine';
  assignee?: string;
}

export interface ContingencyPlan {
  trigger: string;
  plan: string;
}

export interface LineTubeDrain {
  type: string;
  location: string;
  insertedDate: string;
  daysInPlace: number;
  infectionRiskTier: 'low' | 'moderate' | 'high_clabsi_cauti_risk';
}

export interface IPassHandoffRecord {
  id?: number;
  patientId: number;
  sessionId?: string;
  illnessSeverity: 'stable' | 'watcher' | 'unstable';
  patientSummary: string;
  actionItems: ActionItem[];
  contingencyPlans: ContingencyPlan[];
  linesTubesDrains: LineTubeDrain[];
  dischargeBarriers: string[];
  outgoingClinicianId?: number;
  incomingClinicianId?: number;
  synthesisNotes?: string;
  signedOffAt?: string;
  createdAt?: string;
}

export class IpassRoundingService {
  /**
   * Save or initiate a new I-PASS handoff record.
   */
  public async createHandoff(data: IPassHandoffRecord) {
    const res = await query(
      `INSERT INTO ipass_handoffs (
        patient_id, session_id, illness_severity, patient_summary,
        action_items, contingency_plans, lines_tubes_drains,
        discharge_barriers, outgoing_clinician_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        data.patientId,
        data.sessionId || null,
        data.illnessSeverity,
        data.patientSummary,
        JSON.stringify(data.actionItems || []),
        JSON.stringify(data.contingencyPlans || []),
        JSON.stringify(data.linesTubesDrains || []),
        JSON.stringify(data.dischargeBarriers || []),
        data.outgoingClinicianId || null
      ]
    );
    return res.rows[0];
  }

  /**
   * Complete incoming clinician synthesis and transfer sign-off.
   */
  public async signOffHandoff(
    handoffId: number,
    incomingClinicianId: number,
    synthesisNotes: string
  ) {
    const res = await query(
      `UPDATE ipass_handoffs
       SET incoming_clinician_id = $1,
           synthesis_notes = $2,
           signed_off_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [incomingClinicianId, synthesisNotes, handoffId]
    );
    return res.rows[0];
  }

  /**
   * Toggle task completion on an action item.
   */
  public async toggleActionItem(handoffId: number, actionItemId: string, completed: boolean) {
    const fetchRes = await query('SELECT action_items FROM ipass_handoffs WHERE id = $1', [handoffId]);
    if (fetchRes.rows.length === 0) return null;

    const items: ActionItem[] = fetchRes.rows[0].action_items || [];
    const updated = items.map(item => item.id === actionItemId ? { ...item, completed } : item);

    const updateRes = await query(
      `UPDATE ipass_handoffs
       SET action_items = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify(updated), handoffId]
    );
    return updateRes.rows[0];
  }

  /**
   * Get latest I-PASS handoff for a patient.
   */
  public async getLatestHandoffByPatient(patientId: number) {
    const res = await query(
      `SELECT h.*, p.name as patient_name, p.dob, p.sex
       FROM ipass_handoffs h
       JOIN patients p ON h.patient_id = p.id
       WHERE h.patient_id = $1
       ORDER BY h.created_at DESC LIMIT 1`,
      [patientId]
    );
    return res.rows.length > 0 ? res.rows[0] : null;
  }

  /**
   * Get all handoffs for an encounter session.
   */
  public async getHandoffsBySession(sessionId: string) {
    const res = await query(
      `SELECT h.*, p.name as patient_name
       FROM ipass_handoffs h
       JOIN patients p ON h.patient_id = p.id
       WHERE h.session_id = $1
       ORDER BY h.created_at DESC`,
      [sessionId]
    );
    return res.rows;
  }

  /**
   * Inpatient Unit Census Rounding Summary.
   */
  public async getBedsideRoundingCensus() {
    const res = await query(`
      SELECT h.*, p.name as patient_name, p.dob, p.sex
      FROM ipass_handoffs h
      JOIN patients p ON h.patient_id = p.id
      ORDER BY 
        CASE h.illness_severity 
          WHEN 'unstable' THEN 1 
          WHEN 'watcher' THEN 2 
          ELSE 3 
        END,
        h.created_at DESC
      LIMIT 20
    `);

    let totalPatients = res.rows.length;
    let unstableCount = 0;
    let watcherCount = 0;
    let stableCount = 0;
    let highRiskLinesCount = 0;

    res.rows.forEach(r => {
      if (r.illness_severity === 'unstable') unstableCount++;
      else if (r.illness_severity === 'watcher') watcherCount++;
      else stableCount++;

      const ltd: LineTubeDrain[] = r.lines_tubes_drains || [];
      if (ltd.some(l => l.daysInPlace > 3 || l.infectionRiskTier === 'high_clabsi_cauti_risk')) {
        highRiskLinesCount++;
      }
    });

    return {
      censusList: res.rows,
      metrics: {
        totalPatients,
        unstableCount,
        watcherCount,
        stableCount,
        highRiskLinesCount
      }
    };
  }
}

export const ipassRoundingService = new IpassRoundingService();
