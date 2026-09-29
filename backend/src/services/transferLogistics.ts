import { pool } from '../db';

export interface HospitalBed {
  id: number;
  facilityName: string;
  unitName: string;
  bedNumber: string;
  bedType: 'icu' | 'telemetry' | 'med_surg' | 'peds' | 'isolation' | 'burn';
  status: 'available' | 'occupied' | 'reserved_inbound' | 'cleaning';
  acuityCapabilities: string[];
  assignedPatientName?: string | null;
  updatedAt?: string;
}

export interface TransferRequestInput {
  patientId: number;
  sessionId?: string | null;
  sendingFacility: string;
  receivingFacility: string;
  serviceNeeded: string; // e.g. 'neuro_interventional_stroke', 'cardiology_cath_lab', 'burn_critical_care', 'ecmo_resuscitation', 'trauma_surgery'
  urgencyLevel: 'stat_emergent' | 'urgent_under_2hr' | 'priority_under_6hr' | 'routine';
  sendingPhysicianName: string;
  clinicalRationale: string;
  transportMode?: 'rotor_air_ambulance' | 'fixed_wing_air' | 'ground_als' | 'critical_care_transport';
}

export interface TransferRequestRecord {
  id: number;
  patientId: number;
  sessionId?: string | null;
  sendingFacility: string;
  receivingFacility: string;
  serviceNeeded: string;
  urgencyLevel: string;
  sendingPhysicianName: string;
  receivingPhysicianName?: string | null;
  receivingPhysicianAccepted: boolean;
  bedAssignedId?: number | null;
  transportMode: string;
  transportEtaMinutes?: number | null;
  emtalaComplianceStatus: string;
  clinicalRationale: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  patientName?: string;
  assignedBedNumber?: string;
  assignedUnitName?: string;
}

export class TransferLogisticsService {
  /**
   * Seeds demo hospital beds if the bed inventory is empty.
   */
  async seedInitialBedsIfEmpty(): Promise<void> {
    const { rows } = await pool.query('SELECT COUNT(*) FROM hospital_bed_inventory');
    if (parseInt(rows[0].count, 10) > 0) return;

    const initialBeds = [
      {
        facility: 'Metropolitan Medical Center',
        unit: 'Neuro Trauma ICU',
        bed: 'NT-101',
        type: 'icu',
        status: 'available',
        capabilities: ['icp_monitoring', 'craniotomy_postop', 'mechanical_ventilation', 'evd_drainage']
      },
      {
        facility: 'Metropolitan Medical Center',
        unit: 'Neuro Trauma ICU',
        bed: 'NT-102',
        type: 'icu',
        status: 'occupied',
        capabilities: ['icp_monitoring', 'mechanical_ventilation'],
        patient: 'James Miller'
      },
      {
        facility: 'Metropolitan Medical Center',
        unit: 'Cardiac Cath Stepdown',
        bed: 'CC-201',
        type: 'telemetry',
        status: 'available',
        capabilities: ['continuous_telemetry', 'heparin_infusion', 'femoral_sheath_care']
      },
      {
        facility: 'Metropolitan Medical Center',
        unit: 'Medical Intensive Care Unit',
        bed: 'MICU-301',
        type: 'icu',
        status: 'available',
        capabilities: ['mechanical_ventilation', 'crrt_dialysis', 'ecmo', 'prone_positioning']
      },
      {
        facility: 'Metropolitan Medical Center',
        unit: 'Burn Critical Care Unit',
        bed: 'BURN-401',
        type: 'burn',
        status: 'available',
        capabilities: ['hydrotherapy', 'air_fluidized_bed', 'ambient_temperature_control']
      },
      {
        facility: 'Metropolitan Medical Center',
        unit: 'Pediatric Intensive Care Unit',
        bed: 'PICU-501',
        type: 'peds',
        status: 'available',
        capabilities: ['pediatric_ventilation', 'nitric_oxide', 'pediatric_crrt']
      }
    ];

    for (const b of initialBeds) {
      await pool.query(`
        INSERT INTO hospital_bed_inventory (
          facility_name, unit_name, bed_number, bed_type, status, acuity_capabilities, assigned_patient_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [b.facility, b.unit, b.bed, b.type, b.status, JSON.stringify(b.capabilities), b.patient || null]);
    }
  }

  /**
   * Creates an inter-facility transfer request with EMTALA verification.
   */
  async createTransferRequest(input: TransferRequestInput): Promise<TransferRequestRecord> {
    await this.seedInitialBedsIfEmpty();

    // EMTALA Screening Check
    let initialEmtalaStatus = 'pending_acceptance';
    if (!input.clinicalRationale || input.clinicalRationale.trim().length < 10) {
      throw new Error('EMTALA Violation: Inter-facility transfer requires documented clinical rationale & stabilization status.');
    }

    // Auto-match an available bed candidate based on service needed
    let matchedBedId: number | null = null;
    let targetUnitPattern = '%';
    if (input.serviceNeeded.includes('stroke') || input.serviceNeeded.includes('neuro')) {
      targetUnitPattern = '%Neuro%';
    } else if (input.serviceNeeded.includes('cath') || input.serviceNeeded.includes('cardio')) {
      targetUnitPattern = '%Cardiac%';
    } else if (input.serviceNeeded.includes('burn')) {
      targetUnitPattern = '%Burn%';
    } else if (input.serviceNeeded.includes('ecmo') || input.serviceNeeded.includes('icu')) {
      targetUnitPattern = '%ICU%';
    }

    const bedRes = await pool.query(`
      SELECT id FROM hospital_bed_inventory
      WHERE status = 'available' AND unit_name ILIKE $1
      ORDER BY id ASC LIMIT 1;
    `, [targetUnitPattern]);

    if (bedRes.rows.length > 0) {
      matchedBedId = bedRes.rows[0].id;
    }

    const query = `
      INSERT INTO facility_transfer_requests (
        patient_id,
        session_id,
        sending_facility,
        receiving_facility,
        service_needed,
        urgency_level,
        sending_physician_name,
        bed_assigned_id,
        transport_mode,
        emtala_compliance_status,
        clinical_rationale,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'requested')
      RETURNING *;
    `;

    const values = [
      input.patientId,
      input.sessionId || null,
      input.sendingFacility,
      input.receivingFacility,
      input.serviceNeeded,
      input.urgencyLevel,
      input.sendingPhysicianName,
      matchedBedId,
      input.transportMode || 'ground_als',
      initialEmtalaStatus,
      input.clinicalRationale
    ];

    const { rows } = await pool.query(query, values);
    return this.mapTransferRow(rows[0]);
  }

  /**
   * Receiving physician accepts the transfer, guaranteeing EMTALA compliant receipt.
   */
  async acceptTransfer(requestId: number, receivingPhysician: string, bedId?: number): Promise<TransferRequestRecord> {
    const existingRes = await pool.query('SELECT * FROM facility_transfer_requests WHERE id = $1', [requestId]);
    if (existingRes.rows.length === 0) {
      throw new Error(`Transfer request #${requestId} not found.`);
    }

    const currentReq = existingRes.rows[0];
    const finalBedId = bedId || currentReq.bed_assigned_id;

    // Reserve bed in inventory
    if (finalBedId) {
      await pool.query(`
        UPDATE hospital_bed_inventory
        SET status = 'reserved_inbound', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1;
      `, [finalBedId]);
    }

    const updateQuery = `
      UPDATE facility_transfer_requests
      SET receiving_physician_name = $1,
          receiving_physician_accepted = TRUE,
          bed_assigned_id = $2,
          emtala_compliance_status = 'compliant_accepted',
          status = 'physician_accepted',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *;
    `;

    const { rows } = await pool.query(updateQuery, [receivingPhysician, finalBedId, requestId]);
    return this.mapTransferRow(rows[0]);
  }

  /**
   * Dispatches emergency transport (ground or air ambulance) with estimated arrival.
   */
  async dispatchTransport(requestId: number, mode: string, etaMinutes: number): Promise<TransferRequestRecord> {
    const query = `
      UPDATE facility_transfer_requests
      SET transport_mode = $1,
          transport_eta_minutes = $2,
          status = 'en_route',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *;
    `;

    const { rows } = await pool.query(query, [mode, etaMinutes, requestId]);
    if (rows.length === 0) {
      throw new Error(`Transfer request #${requestId} not found.`);
    }
    return this.mapTransferRow(rows[0]);
  }

  /**
   * Marks transfer completed upon patient arrival and transitions bed to occupied.
   */
  async completeTransfer(requestId: number): Promise<TransferRequestRecord> {
    const transferRes = await pool.query(`
      SELECT t.*, p.name as patient_name
      FROM facility_transfer_requests t
      LEFT JOIN patients p ON t.patient_id = p.id
      WHERE t.id = $1;
    `, [requestId]);

    if (transferRes.rows.length === 0) {
      throw new Error(`Transfer request #${requestId} not found.`);
    }

    const req = transferRes.rows[0];

    // Transition bed to occupied
    if (req.bed_assigned_id) {
      await pool.query(`
        UPDATE hospital_bed_inventory
        SET status = 'occupied',
            assigned_patient_name = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2;
      `, [req.patient_name || 'Transfer Inbound Patient', req.bed_assigned_id]);
    }

    const { rows } = await pool.query(`
      UPDATE facility_transfer_requests
      SET status = 'arrived',
          transport_eta_minutes = 0,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `, [requestId]);

    return this.mapTransferRow(rows[0]);
  }

  /**
   * Retrieves all hospital bed inventory with status filtering.
   */
  async getBedInventory(status?: string, bedType?: string): Promise<{
    beds: HospitalBed[];
    metrics: {
      total: number;
      available: number;
      occupied: number;
      reserved: number;
      occupancyPercent: number;
    };
  }> {
    await this.seedInitialBedsIfEmpty();

    let query = 'SELECT * FROM hospital_bed_inventory';
    const conditions: string[] = [];
    const values: any[] = [];

    if (status) {
      conditions.push(`status = $${values.length + 1}`);
      values.push(status);
    }
    if (bedType) {
      conditions.push(`bed_type = $${values.length + 1}`);
      values.push(bedType);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    query += ' ORDER BY unit_name ASC, bed_number ASC;';

    const { rows } = await pool.query(query, values);
    const beds: HospitalBed[] = rows.map(r => ({
      id: r.id,
      facilityName: r.facility_name,
      unitName: r.unit_name,
      bedNumber: r.bed_number,
      bedType: r.bed_type,
      status: r.status,
      acuityCapabilities: typeof r.acuity_capabilities === 'string'
        ? JSON.parse(r.acuity_capabilities)
        : (r.acuity_capabilities || []),
      assignedPatientName: r.assigned_patient_name,
      updatedAt: r.updated_at
    }));

    // Calculate metrics across all beds
    const allBedsRes = await pool.query('SELECT status FROM hospital_bed_inventory');
    const total = allBedsRes.rows.length;
    const available = allBedsRes.rows.filter(b => b.status === 'available').length;
    const occupied = allBedsRes.rows.filter(b => b.status === 'occupied').length;
    const reserved = allBedsRes.rows.filter(b => b.status === 'reserved_inbound').length;
    const occupancyPercent = total > 0 ? Math.round(((occupied + reserved) / total) * 100) : 0;

    return {
      beds,
      metrics: {
        total,
        available,
        occupied,
        reserved,
        occupancyPercent
      }
    };
  }

  /**
   * Retrieves transfer requests with joined patient and bed details.
   */
  async getTransferRequests(status?: string): Promise<TransferRequestRecord[]> {
    let query = `
      SELECT t.*, p.name as patient_name, b.bed_number as assigned_bed_number, b.unit_name as assigned_unit_name
      FROM facility_transfer_requests t
      LEFT JOIN patients p ON t.patient_id = p.id
      LEFT JOIN hospital_bed_inventory b ON t.bed_assigned_id = b.id
    `;

    const values: any[] = [];
    if (status) {
      query += ` WHERE t.status = $1`;
      values.push(status);
    }

    query += ' ORDER BY t.created_at DESC;';

    const { rows } = await pool.query(query, values);
    return rows.map(r => this.mapTransferRow(r));
  }

  private mapTransferRow(r: any): TransferRequestRecord {
    return {
      id: r.id,
      patientId: Number(r.patient_id),
      sessionId: r.session_id,
      sendingFacility: r.sending_facility,
      receivingFacility: r.receiving_facility,
      serviceNeeded: r.service_needed,
      urgencyLevel: r.urgency_level,
      sendingPhysicianName: r.sending_physician_name,
      receivingPhysicianName: r.receiving_physician_name,
      receivingPhysicianAccepted: Boolean(r.receiving_physician_accepted),
      bedAssignedId: r.bed_assigned_id ? Number(r.bed_assigned_id) : null,
      transportMode: r.transport_mode,
      transportEtaMinutes: r.transport_eta_minutes !== null ? Number(r.transport_eta_minutes) : null,
      emtalaComplianceStatus: r.emtala_compliance_status,
      clinicalRationale: r.clinical_rationale,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      patientName: r.patient_name,
      assignedBedNumber: r.assigned_bed_number,
      assignedUnitName: r.assigned_unit_name
    };
  }
}

export const transferLogisticsService = new TransferLogisticsService();
