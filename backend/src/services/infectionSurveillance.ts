import { pool } from '../db';

export interface DeviceLineInput {
  patientId: number;
  sessionId?: string | null;
  deviceType: 'central_venous_catheter' | 'foley_urinary_catheter' | 'endotracheal_tube' | 'arterial_line';
  insertionDate: string; // YYYY-MM-DD
  lineDaysCount?: number;
  anatomicalSite: string;
  necessityJustification: string;
  bundleChecklist?: string[];
}

export interface DeviceLineRecord {
  id: number;
  patientId: number;
  sessionId?: string | null;
  deviceType: string;
  insertionDate: string;
  removalDate?: string | null;
  lineDaysCount: number;
  anatomicalSite: string;
  necessityJustification: string;
  bundleChecklist: string[];
  status: string; // 'active', 'removal_recommended', 'discontinued'
  dwellTimeAlert: boolean;
  patientName?: string;
  createdAt: string;
}

export interface HaiEvaluationInput {
  patientId: number;
  deviceLineId?: number | null;
  infectionType: 'CLABSI' | 'CAUTI' | 'SSI' | 'C_DIFFICILE' | 'MRSA_BACTEREMIA';
  identifiedOrganism: string;
  colonyCount?: string;
  lineDaysAtOnset?: number;
  feverPresent?: boolean;
  clinicalSignsDescription: string;
  primaryAlternativeSourceExcluded?: boolean;
}

export interface HaiSurveillanceRecord {
  id: number;
  patientId: number;
  deviceLineId?: number | null;
  infectionType: string;
  nhsnCriteriaMet: boolean;
  identifiedOrganism: string;
  colonyCount?: string | null;
  isolationPrecautions: string;
  hacrpDomain: string;
  hacrpPenaltyRisk: string;
  infectionPreventionNotes: string;
  patientName?: string;
  createdAt: string;
}

export class InfectionSurveillanceService {
  /**
   * Seeds demo invasive lines and HAI surveillance events if table is empty.
   */
  async seedInitialInfectionDataIfEmpty(): Promise<void> {
    const { rows } = await pool.query('SELECT COUNT(*) FROM device_line_days');
    if (parseInt(rows[0].count, 10) > 0) return;

    const patientRes = await pool.query('SELECT id, name FROM patients LIMIT 2');
    const p1 = patientRes.rows[0]?.id || 1;
    const p2 = patientRes.rows[1]?.id || p1;

    // Seed active central line and Foley catheter
    const cvcRes = await pool.query(`
      INSERT INTO device_line_days (
        patient_id, device_type, insertion_date, line_days_count, anatomical_site,
        necessity_justification, bundle_checklist, status
      ) VALUES ($1, 'central_venous_catheter', CURRENT_DATE - INTERVAL '6 days', 6, 'right_internal_jugular',
        'Vasoactive infusion & CVP hemodynamic monitoring in Septic Shock',
        $2, 'removal_recommended')
      RETURNING id;
    `, [p1, JSON.stringify([
      'Maximal sterile barrier precautions used',
      'Chlorhexidine skin antisepsis verified',
      'Daily site inspection clean/dry/intact',
      'Dressing changed within 7 days'
    ])]);

    await pool.query(`
      INSERT INTO device_line_days (
        patient_id, device_type, insertion_date, line_days_count, anatomical_site,
        necessity_justification, bundle_checklist, status
      ) VALUES ($1, 'foley_urinary_catheter', CURRENT_DATE - INTERVAL '2 days', 2, 'urethral',
        'Accurate hourly urinary output titration in acute renal impairment',
        $2, 'active')
    `, [p2, JSON.stringify([
      'Aseptic insertion technique maintained',
      'Catheter secured to thigh to prevent traction',
      'Drainage bag below bladder level'
    ])]);

    // Seed positive HAI surveillance event (CLABSI)
    await pool.query(`
      INSERT INTO hai_surveillance_events (
        patient_id, device_line_id, infection_type, nhsn_criteria_met,
        identified_organism, colony_count, isolation_precautions,
        hacrp_domain, hacrp_penalty_risk, infection_prevention_notes
      ) VALUES ($1, $2, 'CLABSI', TRUE, 'Staphylococcus epidermidis', '2/2 Blood Bottles Positive',
        'standard', 'Domain_2_NHSN', 'high_penalty_zone',
        'CDC NHSN Central Line-Associated BSI confirmed. Central line in place 6 days; blood cultures positive x2 with no secondary source. Catheter removal ordered.'
      )
    `, [p1, cvcRes.rows[0].id]);
  }

  /**
   * Evaluates if line dwell time warrants a removal alert.
   */
  evaluateDwellTimeAlert(deviceType: string, lineDays: number, site: string): boolean {
    if (deviceType === 'central_venous_catheter') {
      if (site.includes('femoral') && lineDays >= 3) return true;
      if (lineDays >= 5) return true;
    }
    if (deviceType === 'foley_urinary_catheter' && lineDays >= 4) {
      return true;
    }
    return false;
  }

  /**
   * Logs a new invasive device/line and monitors line days.
   */
  async logDeviceLine(input: DeviceLineInput): Promise<DeviceLineRecord> {
    await this.seedInitialInfectionDataIfEmpty();

    const days = input.lineDaysCount || 1;
    const dwellAlert = this.evaluateDwellTimeAlert(input.deviceType, days, input.anatomicalSite);
    const initialStatus = dwellAlert ? 'removal_recommended' : 'active';

    const query = `
      INSERT INTO device_line_days (
        patient_id,
        session_id,
        device_type,
        insertion_date,
        line_days_count,
        anatomical_site,
        necessity_justification,
        bundle_checklist,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;

    const values = [
      input.patientId,
      input.sessionId || null,
      input.deviceType,
      input.insertionDate,
      days,
      input.anatomicalSite,
      input.necessityJustification,
      JSON.stringify(input.bundleChecklist || []),
      initialStatus
    ];

    const { rows } = await pool.query(query, values);
    return this.mapLineRow(rows[0]);
  }

  /**
   * Updates device line status or records removal date.
   */
  async updateDeviceStatus(id: number, status: string, removalDate?: string): Promise<DeviceLineRecord> {
    const query = `
      UPDATE device_line_days
      SET status = $1,
          removal_date = COALESCE($2, removal_date)
      WHERE id = $3
      RETURNING *;
    `;

    const { rows } = await pool.query(query, [status, removalDate || null, id]);
    if (rows.length === 0) {
      throw new Error(`Device line #${id} not found.`);
    }
    return this.mapLineRow(rows[0]);
  }

  /**
   * Evaluates suspected Hospital-Acquired Infection against CDC NHSN algorithms.
   */
  async evaluateHaiInfection(input: HaiEvaluationInput): Promise<HaiSurveillanceRecord> {
    await this.seedInitialInfectionDataIfEmpty();

    // Determine Isolation Precautions automatically based on pathogen and infection type
    let isolation = 'standard';
    const orgLower = input.identifiedOrganism.toLowerCase();

    if (input.infectionType === 'C_DIFFICILE' || orgLower.includes('difficile')) {
      isolation = 'contact_enteric_isolation'; // Bleach / soap & water mandatory
    } else if (input.infectionType === 'MRSA_BACTEREMIA' || orgLower.includes('mrsa') || orgLower.includes('vre') || orgLower.includes('cre')) {
      isolation = 'contact_isolation';
    } else if (orgLower.includes('tuberculosis') || orgLower.includes('measles')) {
      isolation = 'airborne_isolation';
    } else if (orgLower.includes('influenza') || orgLower.includes('rsv') || orgLower.includes('pertussis')) {
      isolation = 'droplet_isolation';
    }

    // NHSN Criteria Evaluation
    let nhsnCriteriaMet = true;
    let notes = `CDC NHSN Surveillance evaluation for ${input.infectionType}: `;

    if (input.infectionType === 'CLABSI') {
      const lineDays = input.lineDaysAtOnset || 3;
      const altExcluded = input.primaryAlternativeSourceExcluded !== undefined ? input.primaryAlternativeSourceExcluded : true;
      if (lineDays > 2 && altExcluded) {
        nhsnCriteriaMet = true;
        notes += `Confirmed CLABSI. Central venous access in place for ${lineDays} days with positive blood isolate (${input.identifiedOrganism}). No secondary source identified. `;
      } else {
        nhsnCriteriaMet = false;
        notes += 'Sub-threshold for NHSN CLABSI: Central line in place ≤2 calendar days or secondary primary infection site present. ';
      }
    } else if (input.infectionType === 'CAUTI') {
      const lineDays = input.lineDaysAtOnset || 3;
      if (lineDays > 2 && input.feverPresent) {
        nhsnCriteriaMet = true;
        notes += `Confirmed CAUTI. Indwelling urinary catheter in place >2 days with fever and positive urine culture (${input.identifiedOrganism} ${input.colonyCount || '>=10^5 CFU/mL'}). `;
      } else {
        nhsnCriteriaMet = false;
        notes += 'Asymptomatic bacteriuria or catheter present ≤2 days; does not meet NHSN CAUTI criteria. ';
      }
    } else if (input.infectionType === 'C_DIFFICILE') {
      nhsnCriteriaMet = true;
      notes += `LabID CDI Event confirmed. Positive diagnostic test for Clostridioides difficile toxin/PCR. Automatic Contact Enteric isolation assigned. `;
    } else {
      nhsnCriteriaMet = true;
      notes += `Pathogen: ${input.identifiedOrganism}. Clinical signs: ${input.clinicalSignsDescription}. `;
    }

    // HACRP Domain 2 Penalty Risk Tier
    const penaltyRisk = nhsnCriteriaMet ? 'high_penalty_zone' : 'low';
    notes += `CMS HACRP Domain 2 Risk: ${penaltyRisk.replace(/_/g, ' ')}.`;

    const query = `
      INSERT INTO hai_surveillance_events (
        patient_id,
        device_line_id,
        infection_type,
        nhsn_criteria_met,
        identified_organism,
        colony_count,
        isolation_precautions,
        hacrp_domain,
        hacrp_penalty_risk,
        infection_prevention_notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Domain_2_NHSN', $8, $9)
      RETURNING *;
    `;

    const values = [
      input.patientId,
      input.deviceLineId || null,
      input.infectionType,
      nhsnCriteriaMet,
      input.identifiedOrganism,
      input.colonyCount || null,
      isolation,
      penaltyRisk,
      notes
    ];

    const { rows } = await pool.query(query, values);
    return this.mapHaiRow(rows[0]);
  }

  /**
   * Retrieves all device lines with optional status filter.
   */
  async getDeviceLines(patientId?: number, status?: string): Promise<DeviceLineRecord[]> {
    await this.seedInitialInfectionDataIfEmpty();

    let query = `
      SELECT d.*, p.name as patient_name
      FROM device_line_days d
      LEFT JOIN patients p ON d.patient_id = p.id
    `;
    const conditions: string[] = [];
    const values: any[] = [];

    if (patientId) {
      conditions.push(`d.patient_id = $${values.length + 1}`);
      values.push(patientId);
    }
    if (status) {
      conditions.push(`d.status = $${values.length + 1}`);
      values.push(status);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    query += ' ORDER BY d.created_at DESC;';

    const { rows } = await pool.query(query, values);
    return rows.map(r => this.mapLineRow(r));
  }

  /**
   * Returns facility-wide HAI infection control surveillance summary.
   */
  async getHaiSurveillanceSummary(): Promise<{
    activeLines: DeviceLineRecord[];
    haiEvents: HaiSurveillanceRecord[];
    metrics: {
      totalActiveLines: number;
      linesExceedingDwellLimit: number;
      confirmedHais: number;
      patientsInIsolation: number;
      hacrpSirEstimate: number; // Standardized Infection Ratio
    };
  }> {
    await this.seedInitialInfectionDataIfEmpty();

    const activeLines = await this.getDeviceLines(undefined, 'active');
    const removalLines = await this.getDeviceLines(undefined, 'removal_recommended');
    const allTrackedLines = [...activeLines, ...removalLines];

    const haiQuery = `
      SELECT h.*, p.name as patient_name
      FROM hai_surveillance_events h
      LEFT JOIN patients p ON h.patient_id = p.id
      ORDER BY h.created_at DESC LIMIT 50;
    `;
    const haiRes = await pool.query(haiQuery);
    const haiEvents: HaiSurveillanceRecord[] = haiRes.rows.map(r => this.mapHaiRow(r));

    const confirmedHais = haiEvents.filter(e => e.nhsnCriteriaMet).length;
    const dwellExceeded = allTrackedLines.filter(l => l.dwellTimeAlert).length;
    const isolationCount = haiEvents.filter(e => e.isolationPrecautions !== 'standard').length;

    // Simulated Standardized Infection Ratio (SIR): benchmark = 1.0
    const hacrpSirEstimate = confirmedHais > 0 ? parseFloat((0.85 + confirmedHais * 0.25).toFixed(2)) : 0.65;

    return {
      activeLines: allTrackedLines,
      haiEvents,
      metrics: {
        totalActiveLines: allTrackedLines.length,
        linesExceedingDwellLimit: dwellExceeded,
        confirmedHais,
        patientsInIsolation: isolationCount,
        hacrpSirEstimate
      }
    };
  }

  private mapLineRow(r: any): DeviceLineRecord {
    const days = Number(r.line_days_count) || 1;
    const site = r.anatomical_site || '';
    const dwell = this.evaluateDwellTimeAlert(r.device_type, days, site);

    return {
      id: r.id,
      patientId: Number(r.patient_id),
      sessionId: r.session_id,
      deviceType: r.device_type,
      insertionDate: r.insertion_date ? new Date(r.insertion_date).toISOString().split('T')[0] : '',
      removalDate: r.removal_date ? new Date(r.removal_date).toISOString().split('T')[0] : null,
      lineDaysCount: days,
      anatomicalSite: r.anatomical_site,
      necessityJustification: r.necessity_justification,
      bundleChecklist: typeof r.bundle_checklist === 'string'
        ? JSON.parse(r.bundle_checklist)
        : (r.bundle_checklist || []),
      status: r.status,
      dwellTimeAlert: dwell,
      patientName: r.patient_name,
      createdAt: r.created_at
    };
  }

  private mapHaiRow(r: any): HaiSurveillanceRecord {
    return {
      id: r.id,
      patientId: Number(r.patient_id),
      deviceLineId: r.device_line_id ? Number(r.device_line_id) : null,
      infectionType: r.infection_type,
      nhsnCriteriaMet: Boolean(r.nhsn_criteria_met),
      identifiedOrganism: r.identified_organism,
      colonyCount: r.colony_count,
      isolationPrecautions: r.isolation_precautions,
      hacrpDomain: r.hacrp_domain,
      hacrpPenaltyRisk: r.hacrp_penalty_risk,
      infectionPreventionNotes: r.infection_prevention_notes,
      patientName: r.patient_name,
      createdAt: r.created_at
    };
  }
}

export const infectionSurveillanceService = new InfectionSurveillanceService();
