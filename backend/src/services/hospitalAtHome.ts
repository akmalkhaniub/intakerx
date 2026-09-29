import { query } from '../db';

export interface DeviceProvisionParams {
  enrollmentId: number;
  deviceType: 'cellular_bp_cuff' | 'continuous_pulse_ox' | 'smart_scale_chf' | 'cgm_glucose';
  serialNumber: string;
  syncFrequencyMinutes?: number;
}

export interface TelemetryPayload {
  serialNumber: string;
  readingType: 'blood_pressure' | 'spo2_heart_rate' | 'weight_kg' | 'blood_glucose';
  readingData: Record<string, any>;
}

export interface AnomalyEvaluation {
  isOutOfBounds: boolean;
  alertSeverity: 'normal' | 'mild_deviation' | 'urgent_call_required' | 'emergency_ems_dispatch';
  clinicalDirective: string;
}

export class HospitalAtHomeService {
  /**
   * Enroll patient in Hospital-at-Home (HaH) program.
   */
  public async enrollPatient(
    patientId: number,
    sessionId: string | null,
    diagnosis: string,
    acuityTier: 'stepdown_home' | 'moderate' | 'low_risk_observation' = 'moderate',
    primaryVirtualNurseId: number = 101
  ) {
    const res = await query(
      `INSERT INTO hah_enrollments (
        patient_id, session_id, admission_diagnosis, acuity_tier, primary_virtual_nurse_id
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [patientId, sessionId || null, diagnosis, acuityTier, primaryVirtualNurseId]
    );
    return res.rows[0];
  }

  /**
   * Provision a cellular RPM monitoring device for an active enrollment.
   */
  public async provisionDevice(params: DeviceProvisionParams) {
    const res = await query(
      `INSERT INTO rpm_device_fleet (
        enrollment_id, device_type, serial_number, sync_frequency_minutes
      ) VALUES ($1, $2, $3, $4)
      ON CONFLICT (serial_number) DO UPDATE
      SET enrollment_id = EXCLUDED.enrollment_id,
          last_heartbeat = CURRENT_TIMESTAMP,
          status = 'online'
      RETURNING *`,
      [
        params.enrollmentId,
        params.deviceType,
        params.serialNumber,
        params.syncFrequencyMinutes || 15
      ]
    );
    return res.rows[0];
  }

  /**
   * Evaluate clinical boundaries on incoming biometric reading.
   */
  public evaluateReading(readingType: string, data: Record<string, any>): AnomalyEvaluation {
    if (readingType === 'weight_kg') {
      const change = Number(data.changeOver48hKg || 0);
      if (change >= 2.0) {
        return {
          isOutOfBounds: true,
          alertSeverity: 'urgent_call_required',
          clinicalDirective: `Rapid fluid retention (+${change} kg in 48h). Risk of acute pulmonary edema. Contact patient to titrate Loop Diuretic.`
        };
      }
    } else if (readingType === 'blood_pressure') {
      const sbp = Number(data.systolic || 120);
      if (sbp >= 180 || sbp < 85) {
        return {
          isOutOfBounds: true,
          alertSeverity: 'emergency_ems_dispatch',
          clinicalDirective: `Critical hemodynamic anomaly (SBP: ${sbp} mmHg). High risk of hypertensive crisis or acute decompensation. Dispatch EMS if symptomatic.`
        };
      } else if (sbp >= 140 || sbp <= 95) {
        return {
          isOutOfBounds: true,
          alertSeverity: 'mild_deviation',
          clinicalDirective: `Elevated SBP (${sbp} mmHg). Schedule virtual nursing blood pressure check.`
        };
      }
    } else if (readingType === 'spo2_heart_rate') {
      const spo2 = Number(data.oxygenSaturation || 98);
      if (spo2 < 88) {
        return {
          isOutOfBounds: true,
          alertSeverity: 'urgent_call_required',
          clinicalDirective: `Severe nocturnal hypoxemia (SpO2: ${spo2}%). Verify nasal cannula placement and order stat portable O2 evaluation.`
        };
      }
    } else if (readingType === 'blood_glucose') {
      const bg = Number(data.glucoseMgDl || 110);
      if (bg < 55) {
        return {
          isOutOfBounds: true,
          alertSeverity: 'emergency_ems_dispatch',
          clinicalDirective: `Severe neuroglycopenia / hypoglycemia (${bg} mg/dL). Administer oral glucose gel or glucagon stat.`
        };
      } else if (bg > 300) {
        return {
          isOutOfBounds: true,
          alertSeverity: 'urgent_call_required',
          clinicalDirective: `Severe hyperglycemia (${bg} mg/dL). Check urine/blood ketones and hydrate.`
        };
      }
    }

    return {
      isOutOfBounds: false,
      alertSeverity: 'normal',
      clinicalDirective: 'Biometric reading within target home-stability parameters.'
    };
  }

  /**
   * Ingest biometric telemetry from cellular device webhook.
   */
  public async ingestTelemetry(payload: TelemetryPayload) {
    const devRes = await query(
      `SELECT d.*, e.patient_id
       FROM rpm_device_fleet d
       JOIN hah_enrollments e ON d.enrollment_id = e.id
       WHERE d.serial_number = $1`,
      [payload.serialNumber]
    );

    if (devRes.rows.length === 0) {
      throw new Error(`Device serial ${payload.serialNumber} not registered in fleet`);
    }

    const device = devRes.rows[0];
    const evaluation = this.evaluateReading(payload.readingType, payload.readingData);

    const readingRes = await query(
      `INSERT INTO rpm_telemetry_readings (
        device_id, patient_id, reading_type, reading_data, is_out_of_bounds, alert_severity
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        device.id,
        device.patient_id,
        payload.readingType,
        JSON.stringify(payload.readingData),
        evaluation.isOutOfBounds,
        evaluation.alertSeverity
      ]
    );

    // Update device heartbeat
    await query(
      `UPDATE rpm_device_fleet
       SET last_heartbeat = CURRENT_TIMESTAMP, status = 'online'
       WHERE id = $1`,
      [device.id]
    );

    return {
      reading: readingRes.rows[0],
      evaluation
    };
  }

  /**
   * Calculate CMS Remote Patient Monitoring (RPM) Billable Codes.
   * CPT 99453: Initial setup & education (~$19)
   * CPT 99454: Monthly transmission of >= 16 days of readings (~$55)
   * CPT 99457: First 20 mins of interactive clinical care (~$50)
   * CPT 99458: Addl 20 mins (~$40)
   */
  public async calculateRpmBilling(
    enrollmentId: number,
    transmissionDaysCount: number = 18,
    clinicalMinutesSpent: number = 25
  ) {
    const billableLogs: Array<{ cpt: string; feeCents: number; desc: string }> = [];

    // 1. Initial Device Setup & Patient Education (CPT 99453)
    billableLogs.push({
      cpt: '99453',
      feeCents: 1950,
      desc: 'Remote monitoring clinical setup and patient education on cellular device operation'
    });

    // 2. 16+ Days Transmission in a 30-day Calendar Window (CPT 99454)
    if (transmissionDaysCount >= 16) {
      billableLogs.push({
        cpt: '99454',
        feeCents: 5500,
        desc: `Monthly biometric transmission compliance achieved (${transmissionDaysCount} days transmitted, threshold >= 16)`
      });
    }

    // 3. First 20 Minutes Clinical Virtual Care (CPT 99457)
    if (clinicalMinutesSpent >= 20) {
      billableLogs.push({
        cpt: '99457',
        feeCents: 5000,
        desc: `Interactive clinical management: First 20 minutes completed (${clinicalMinutesSpent} min logged)`
      });
    }

    // 4. Additional 20 Minutes Increment (CPT 99458)
    if (clinicalMinutesSpent >= 40) {
      billableLogs.push({
        cpt: '99458',
        feeCents: 4000,
        desc: `Subsequent 20 minutes clinical interaction (${clinicalMinutesSpent} min total)`
      });
    }

    // Persist logs
    for (const b of billableLogs) {
      await query(
        `INSERT INTO rpm_billing_logs (
          enrollment_id, cpt_code, qualified_days_count, minutes_logged, status
        ) VALUES ($1, $2, $3, $4, 'billable')`,
        [enrollmentId, b.cpt, transmissionDaysCount, clinicalMinutesSpent]
      );
    }

    const totalCents = billableLogs.reduce((sum, item) => sum + item.feeCents, 0);

    return {
      enrollmentId,
      transmissionDaysCount,
      clinicalMinutesSpent,
      billableItems: billableLogs,
      totalBillableCents: totalCents,
      totalBillableDollars: (totalCents / 100).toFixed(2)
    };
  }

  /**
   * Fetch fleet overview and active home care patients.
   */
  public async getFleetOverview() {
    const [enrollmentsRes, alertsRes] = await Promise.all([
      query(`
        SELECT 
          e.*,
          p.name as patient_name,
          p.dob as patient_dob,
          COUNT(d.id) as device_count
        FROM hah_enrollments e
        JOIN patients p ON e.patient_id = p.id
        LEFT JOIN rpm_device_fleet d ON d.enrollment_id = e.id
        WHERE e.status = 'active'
        GROUP BY e.id, p.name, p.dob
        ORDER BY e.created_at DESC
      `),
      query(`
        SELECT r.*, p.name as patient_name, d.device_type
        FROM rpm_telemetry_readings r
        JOIN patients p ON r.patient_id = p.id
        JOIN rpm_device_fleet d ON r.device_id = d.id
        WHERE r.is_out_of_bounds = TRUE
        ORDER BY r.created_at DESC
        LIMIT 15
      `)
    ]);

    return {
      activeEnrollments: enrollmentsRes.rows,
      activeAlerts: alertsRes.rows
    };
  }

  /**
   * Fetch recent telemetry for an enrollment.
   */
  public async getEnrollmentTelemetry(enrollmentId: number) {
    const res = await query(
      `SELECT r.*, d.device_type, d.serial_number
       FROM rpm_telemetry_readings r
       JOIN rpm_device_fleet d ON r.device_id = d.id
       WHERE d.enrollment_id = $1
       ORDER BY r.created_at DESC
       LIMIT 30`,
      [enrollmentId]
    );
    return res.rows;
  }
}

export const hospitalAtHomeService = new HospitalAtHomeService();
