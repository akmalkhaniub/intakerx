import { pool } from '../db';

export type UspCategory = 'Category_1' | 'Category_2' | 'Category_3';
export type StorageCondition = 'room_temp' | 'refrigerated' | 'frozen';
export type CleanroomPressureStatus = 'normal' | 'warning' | 'critical_breach';

export interface IvCompoundingBatchRecord {
  id: number;
  patient_id?: number | null;
  patient_name?: string;
  prescription_order_id?: string;
  medication_name: string;
  base_solution: string;
  drug_dose_mg: number;
  drug_volume_ml: number;
  drug_specific_gravity: number;
  empty_bag_tare_grams: number;
  expected_final_weight_grams: number;
  actual_scale_weight_grams?: number | null;
  weight_variance_percent?: number | null;
  gravimetric_passed?: boolean | null;
  usp_category: UspCategory;
  storage_condition: StorageCondition;
  beyond_use_date: string;
  is_hazardous_usp800: boolean;
  cstd_verified: boolean;
  compounding_hood_id: string;
  compounded_by_pharmacist: string;
  batch_status: 'compounded' | 'quarantined_out_of_spec' | 'verified_dispensed' | 'wasted';
  created_at: string;
}

export interface CleanroomTelemetryRecord {
  id: number;
  cleanroom_zone: string;
  differential_pressure_in_wg: number;
  pressure_status: CleanroomPressureStatus;
  hepa_particle_count_0_5um: number;
  iso_class: string;
  air_changes_per_hour: number;
  temperature_celsius: number;
  relative_humidity_percent: number;
  sensor_timestamp: string;
}

export class CleanroomCompoundingService {
  /**
   * Density-adjusted gravimetric expected weight calculation
   */
  public static calculateGravimetricExpected(
    emptyBagTareGrams: number,
    drugVolumeMl: number,
    drugSpecificGravity: number = 1.000
  ): number {
    const expected = emptyBagTareGrams + (drugVolumeMl * drugSpecificGravity);
    return Number(expected.toFixed(2));
  }

  /**
   * Calculates Beyond-Use Date (BUD) per USP <797> standards
   */
  public static calculateBud(
    category: UspCategory,
    storage: StorageCondition,
    prepTime: Date = new Date()
  ): Date {
    const bud = new Date(prepTime.getTime());

    if (category === 'Category_1') {
      if (storage === 'room_temp') bud.setHours(bud.getHours() + 12);
      else if (storage === 'refrigerated') bud.setHours(bud.getHours() + 24);
      else bud.setHours(bud.getHours() + 24); // Frozen not recognized for Cat 1
    } else if (category === 'Category_2') {
      if (storage === 'room_temp') bud.setDate(bud.getDate() + 4);
      else if (storage === 'refrigerated') bud.setDate(bud.getDate() + 10);
      else if (storage === 'frozen') bud.setDate(bud.getDate() + 45);
    } else {
      // Category 3 (Sterility tested & endotoxin validated)
      if (storage === 'room_temp') bud.setDate(bud.getDate() + 45);
      else if (storage === 'refrigerated') bud.setDate(bud.getDate() + 60);
      else if (storage === 'frozen') bud.setDate(bud.getDate() + 90);
    }

    return bud;
  }

  /**
   * Creates a sterile compounding batch record
   */
  public static async createCompoundingBatch(params: {
    patientId?: number;
    prescriptionOrderId?: string;
    medicationName: string;
    baseSolution: string;
    drugDoseMg: number;
    drugVolumeMl: number;
    drugSpecificGravity?: number;
    emptyBagTareGrams: number;
    uspCategory?: UspCategory;
    storageCondition?: StorageCondition;
    isHazardousUsp800?: boolean;
    cstdVerified?: boolean;
    compoundingHoodId: string;
    compoundedByPharmacist: string;
  }): Promise<IvCompoundingBatchRecord> {
    const {
      patientId,
      prescriptionOrderId,
      medicationName,
      baseSolution,
      drugDoseMg,
      drugVolumeMl,
      drugSpecificGravity = 1.000,
      emptyBagTareGrams,
      uspCategory = 'Category_2',
      storageCondition = 'refrigerated',
      isHazardousUsp800 = false,
      cstdVerified = false,
      compoundingHoodId,
      compoundedByPharmacist
    } = params;

    const expectedWeight = this.calculateGravimetricExpected(emptyBagTareGrams, drugVolumeMl, drugSpecificGravity);
    const bud = this.calculateBud(uspCategory, storageCondition);

    const res = await pool.query(
      `INSERT INTO iv_compounding_batches (
        patient_id, prescription_order_id, medication_name, base_solution,
        drug_dose_mg, drug_volume_ml, drug_specific_gravity, empty_bag_tare_grams,
        expected_final_weight_grams, usp_category, storage_condition,
        beyond_use_date, is_hazardous_usp800, cstd_verified,
        compounding_hood_id, compounded_by_pharmacist, batch_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'compounded')
      RETURNING *`,
      [
        patientId || null,
        prescriptionOrderId || null,
        medicationName,
        baseSolution,
        drugDoseMg,
        drugVolumeMl,
        drugSpecificGravity,
        emptyBagTareGrams,
        expectedWeight,
        uspCategory,
        storageCondition,
        bud.toISOString(),
        isHazardousUsp800,
        cstdVerified,
        compoundingHoodId,
        compoundedByPharmacist
      ]
    );

    return res.rows[0];
  }

  /**
   * Verifies scale gravimetric weight and performs safety lockout / release
   */
  public static async verifyBatchGravimetric(params: {
    batchId: number;
    actualScaleWeightGrams: number;
  }): Promise<IvCompoundingBatchRecord> {
    const { batchId, actualScaleWeightGrams } = params;

    const batchRes = await pool.query(`SELECT * FROM iv_compounding_batches WHERE id = $1`, [batchId]);
    if (batchRes.rows.length === 0) {
      throw new Error(`IV Compounding Batch #${batchId} not found`);
    }
    const batch = batchRes.rows[0];

    const expected = Number(batch.expected_final_weight_grams);
    const variancePercent = Number((((actualScaleWeightGrams - expected) / expected) * 100).toFixed(2));
    const passed = Math.abs(variancePercent) <= 3.00; // Strict +/- 3% tolerance
    const newStatus = passed ? 'verified_dispensed' : 'quarantined_out_of_spec';

    const updateRes = await pool.query(
      `UPDATE iv_compounding_batches SET
        actual_scale_weight_grams = $1,
        weight_variance_percent = $2,
        gravimetric_passed = $3,
        batch_status = $4
      WHERE id = $5
      RETURNING *`,
      [actualScaleWeightGrams, variancePercent, passed, newStatus, batchId]
    );

    return updateRes.rows[0];
  }

  /**
   * Records environmental differential pressure and HEPA particle telemetry
   */
  public static async recordTelemetry(params: {
    cleanroomZone: string;
    differentialPressureInWg: number;
    hepaParticleCount05um: number;
    isoClass: string;
    airChangesPerHour: number;
    temperatureCelsius: number;
    relativeHumidityPercent: number;
  }): Promise<CleanroomTelemetryRecord> {
    const {
      cleanroomZone,
      differentialPressureInWg,
      hepaParticleCount05um,
      isoClass,
      airChangesPerHour,
      temperatureCelsius,
      relativeHumidityPercent
    } = params;

    let status: CleanroomPressureStatus = 'normal';

    const isHazardous = cleanroomZone.toLowerCase().includes('hazardous') || cleanroomZone.toLowerCase().includes('c-pec');

    if (isHazardous) {
      // Must maintain negative pressure between -0.010 and -0.030 in. w.g.
      if (differentialPressureInWg > -0.010) {
        status = 'critical_breach'; // Loss of containment
      } else if (differentialPressureInWg > -0.015) {
        status = 'warning';
      }
    } else {
      // Non-hazardous buffer room must maintain positive pressure >= +0.020 in. w.g.
      if (differentialPressureInWg < 0.015) {
        status = 'critical_breach';
      } else if (differentialPressureInWg < 0.020) {
        status = 'warning';
      }
    }

    const res = await pool.query(
      `INSERT INTO cleanroom_telemetry (
        cleanroom_zone, differential_pressure_in_wg, pressure_status,
        hepa_particle_count_0_5um, iso_class, air_changes_per_hour,
        temperature_celsius, relative_humidity_percent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        cleanroomZone,
        differentialPressureInWg,
        status,
        hepaParticleCount05um,
        isoClass,
        airChangesPerHour,
        temperatureCelsius,
        relativeHumidityPercent
      ]
    );

    return res.rows[0];
  }

  /**
   * Summary analytics for cleanroom automation
   */
  public static async getCleanroomAnalytics(): Promise<{
    totalBatchesPrepared: number;
    verifiedDispensedCount: number;
    quarantinedCount: number;
    gravimetricPassRate: string;
    hazardousChemoBatches: number;
    activeCleanroomAlerts: number;
  }> {
    const batchRes = await pool.query(`
      SELECT 
        COUNT(*) as total_batches,
        COUNT(*) FILTER (WHERE batch_status = 'verified_dispensed') as verified_count,
        COUNT(*) FILTER (WHERE batch_status = 'quarantined_out_of_spec') as quarantined_count,
        COUNT(*) FILTER (WHERE is_hazardous_usp800 = true) as chemo_count
      FROM iv_compounding_batches
    `);

    const telemRes = await pool.query(`
      SELECT COUNT(*) as alert_count
      FROM cleanroom_telemetry
      WHERE pressure_status != 'normal' AND sensor_timestamp >= NOW() - INTERVAL '2 hours'
    `);

    const b = batchRes.rows[0];
    const t = telemRes.rows[0];

    const total = Number(b.total_batches || 0);
    const verified = Number(b.verified_count || 0);
    const passRate = total > 0 ? `${((verified / total) * 100).toFixed(1)}%` : '100.0%';

    return {
      totalBatchesPrepared: total,
      verifiedDispensedCount: verified,
      quarantinedCount: Number(b.quarantined_count || 0),
      gravimetricPassRate: passRate,
      hazardousChemoBatches: Number(b.chemo_count || 0),
      activeCleanroomAlerts: Number(t.alert_count || 0)
    };
  }

  /**
   * Retrieves batches
   */
  public static async getRecentBatches(status?: string, isHazardous?: boolean, limit = 50): Promise<IvCompoundingBatchRecord[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (status) {
      conditions.push(`b.batch_status = $${idx++}`);
      values.push(status);
    }
    if (isHazardous !== undefined) {
      conditions.push(`b.is_hazardous_usp800 = $${idx++}`);
      values.push(isHazardous);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(limit);

    const res = await pool.query(`
      SELECT b.*, p.name as patient_name
      FROM iv_compounding_batches b
      LEFT JOIN patients p ON b.patient_id = p.id
      ${whereClause}
      ORDER BY b.created_at DESC
      LIMIT $${idx}
    `, values);

    return res.rows;
  }

  /**
   * Retrieves latest telemetry by zone
   */
  public static async getLatestCleanroomTelemetry(): Promise<CleanroomTelemetryRecord[]> {
    const res = await pool.query(`
      SELECT DISTINCT ON (cleanroom_zone) *
      FROM cleanroom_telemetry
      ORDER BY cleanroom_zone, sensor_timestamp DESC
    `);

    return res.rows;
  }
}
