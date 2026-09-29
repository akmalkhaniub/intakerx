import { query } from '../db';

export interface VitalsTelemetry {
  heartRate: number;
  respiratoryRate: number;
  systolicBp: number;
  diastolicBp?: number;
  temperatureC: number;
  oxygenSaturation: number;
  supplementalOxygen: boolean;
  avpuConsciousness: 'A' | 'V' | 'P' | 'U';
}

export interface LabsSnapshot {
  wbcCount?: number;
  bandsPercent?: number;
  lactate?: number;
  creatinine?: number;
  bilirubin?: number;
  platelets?: number;
}

export interface SepsisEvaluationResult {
  surveillanceId: number;
  patientId: number;
  sessionId: string | null;
  sirsScore: number;
  sirsPositive: boolean;
  sirsCriteria: string[];
  qsofaScore: number;
  qsofaPositive: boolean;
  qsofaCriteria: string[];
  news2Score: number;
  news2Risk: 'LOW' | 'MEDIUM' | 'HIGH';
  news2Breakdown: Record<string, number>;
  deteriorationTier: 'low' | 'medium' | 'high' | 'critical_sepsis';
  sep1Bundle?: any;
  recommendations: string[];
}

export class SepsisWatchdogService {
  /**
   * Calculate Systemic Inflammatory Response Syndrome (SIRS) score.
   */
  public calculateSirs(vitals: VitalsTelemetry, labs?: LabsSnapshot): { score: number; criteria: string[] } {
    let score = 0;
    const criteria: string[] = [];

    if (vitals.temperatureC > 38.3 || vitals.temperatureC < 36.0) {
      score += 1;
      criteria.push(`Abnormal Temp: ${vitals.temperatureC}°C (ref: 36.0 - 38.3°C)`);
    }

    if (vitals.heartRate > 90) {
      score += 1;
      criteria.push(`Tachycardia: ${vitals.heartRate} bpm (> 90 bpm)`);
    }

    if (vitals.respiratoryRate > 20) {
      score += 1;
      criteria.push(`Tachypnea: ${vitals.respiratoryRate} bpm (> 20 bpm)`);
    }

    if (labs?.wbcCount !== undefined) {
      if (labs.wbcCount > 12.0 || labs.wbcCount < 4.0 || (labs.bandsPercent !== undefined && labs.bandsPercent > 10)) {
        score += 1;
        criteria.push(`Leukocytosis/Leukopenia: ${labs.wbcCount} k/uL or >10% bands`);
      }
    }

    return { score, criteria };
  }

  /**
   * Calculate Quick Sepsis-related Organ Failure Assessment (qSOFA).
   */
  public calculateQsofa(vitals: VitalsTelemetry): { score: number; criteria: string[] } {
    let score = 0;
    const criteria: string[] = [];

    if (vitals.respiratoryRate >= 22) {
      score += 1;
      criteria.push(`Respiratory rate >= 22 /min (${vitals.respiratoryRate})`);
    }

    if (vitals.avpuConsciousness !== 'A') {
      score += 1;
      criteria.push(`Altered mental status (AVPU: ${vitals.avpuConsciousness})`);
    }

    if (vitals.systolicBp <= 100) {
      score += 1;
      criteria.push(`Hypotension: SBP <= 100 mmHg (${vitals.systolicBp})`);
    }

    return { score, criteria };
  }

  /**
   * Calculate National Early Warning Score 2 (NEWS2).
   */
  public calculateNews2(vitals: VitalsTelemetry): { score: number; breakdown: Record<string, number> } {
    const breakdown: Record<string, number> = {};

    // 1. Respiration Rate
    const rr = vitals.respiratoryRate;
    if (rr <= 8) breakdown.respiration = 3;
    else if (rr <= 11) breakdown.respiration = 1;
    else if (rr <= 20) breakdown.respiration = 0;
    else if (rr <= 24) breakdown.respiration = 2;
    else breakdown.respiration = 3;

    // 2. Oxygen Saturation (Scale 1)
    const spo2 = vitals.oxygenSaturation;
    if (spo2 <= 91) breakdown.oxygenSaturation = 3;
    else if (spo2 <= 93) breakdown.oxygenSaturation = 2;
    else if (spo2 <= 95) breakdown.oxygenSaturation = 1;
    else breakdown.oxygenSaturation = 0;

    // 3. Supplemental Oxygen
    breakdown.supplementalOxygen = vitals.supplementalOxygen ? 2 : 0;

    // 4. Systolic Blood Pressure
    const sbp = vitals.systolicBp;
    if (sbp <= 90) breakdown.systolicBp = 3;
    else if (sbp <= 100) breakdown.systolicBp = 2;
    else if (sbp <= 110) breakdown.systolicBp = 1;
    else if (sbp <= 219) breakdown.systolicBp = 0;
    else breakdown.systolicBp = 3;

    // 5. Heart Rate
    const hr = vitals.heartRate;
    if (hr <= 40) breakdown.heartRate = 3;
    else if (hr <= 50) breakdown.heartRate = 1;
    else if (hr <= 90) breakdown.heartRate = 0;
    else if (hr <= 110) breakdown.heartRate = 1;
    else if (hr <= 130) breakdown.heartRate = 2;
    else breakdown.heartRate = 3;

    // 6. Consciousness (AVPU)
    breakdown.consciousness = vitals.avpuConsciousness === 'A' ? 0 : 3;

    // 7. Temperature
    const temp = vitals.temperatureC;
    if (temp <= 35.0) breakdown.temperature = 3;
    else if (temp <= 36.0) breakdown.temperature = 1;
    else if (temp <= 38.0) breakdown.temperature = 0;
    else if (temp <= 39.0) breakdown.temperature = 1;
    else breakdown.temperature = 2;

    const score = Object.values(breakdown).reduce((a, b) => a + b, 0);
    return { score, breakdown };
  }

  /**
   * Evaluate patient for Sepsis & Clinical Deterioration.
   */
  public async evaluatePatient(
    patientId: number,
    sessionId: string | null,
    vitals: VitalsTelemetry,
    labs?: LabsSnapshot,
    sourceInfection: string = 'Suspected pulmonary / urinary source'
  ): Promise<SepsisEvaluationResult> {
    const sirs = this.calculateSirs(vitals, labs);
    const qsofa = this.calculateQsofa(vitals);
    const news2 = this.calculateNews2(vitals);

    const sirsPositive = sirs.score >= 2;
    const qsofaPositive = qsofa.score >= 2;

    let news2Risk: SepsisEvaluationResult['news2Risk'] = 'LOW';
    if (news2.score >= 7) news2Risk = 'HIGH';
    else if (news2.score >= 5) news2Risk = 'MEDIUM';

    let deteriorationTier: SepsisEvaluationResult['deteriorationTier'] = 'low';
    const hasElevatedLactate = labs?.lactate !== undefined && labs.lactate >= 2.0;

    if ((qsofaPositive || news2.score >= 7) && (sirsPositive || hasElevatedLactate)) {
      deteriorationTier = 'critical_sepsis';
    } else if (news2.score >= 7 || qsofaPositive) {
      deteriorationTier = 'high';
    } else if (news2.score >= 5 || sirsPositive) {
      deteriorationTier = 'medium';
    }

    const recommendations: string[] = [];
    if (deteriorationTier === 'critical_sepsis') {
      recommendations.push('🚨 Immediate Code Sepsis / Medical Rapid Response activation');
      recommendations.push('Initiate CMS SEP-1 3-Hour Resuscitation Bundle without delay');
      recommendations.push('Measure serum lactate stat (target < 2.0 mmol/L)');
      recommendations.push('Draw 2 sets of peripheral blood cultures PRIOR to antibiotic initiation');
      recommendations.push('Administer broad-spectrum IV antimicrobials within 60 minutes');
      if (vitals.systolicBp < 90 || (labs?.lactate && labs.lactate >= 4.0)) {
        recommendations.push('Initiate 30 mL/kg IV crystalloid fluid bolus for septic shock / hypoperfusion');
      }
    } else if (deteriorationTier === 'high') {
      recommendations.push('Urgent physician bedside review (< 15 minutes)');
      recommendations.push('Continuous cardiac and pulse oximetry monitoring');
      recommendations.push('Consider ICU / High-Dependency Stepdown transfer');
    } else if (deteriorationTier === 'medium') {
      recommendations.push('Increase vitals monitoring frequency to minimum q1h');
      recommendations.push('Assess for occult source of infection and clinical decline');
    } else {
      recommendations.push('Continue standard routine ward telemetry');
    }

    // Persist Surveillance Event
    const eventRes = await query(
      `INSERT INTO sepsis_surveillance_events (
        patient_id, session_id, sirs_score, qsofa_score, news2_score,
        deterioration_tier, vitals_snapshot, labs_snapshot, source_infection
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        patientId,
        sessionId || null,
        sirs.score,
        qsofa.score,
        news2.score,
        deteriorationTier,
        JSON.stringify(vitals),
        JSON.stringify(labs || {}),
        sourceInfection
      ]
    );
    const surveillance = eventRes.rows[0];

    // If critical sepsis or high risk, initialize SEP-1 3-hour bundle
    let sep1Bundle = null;
    if (deteriorationTier === 'critical_sepsis' || deteriorationTier === 'high') {
      const bundleRes = await query(
        `INSERT INTO sep1_bundle_actions (
          surveillance_id, bundle_window, lactate_measured, lactate_value,
          blood_cultures_drawn, broad_spectrum_abx_ordered, abx_regimen,
          fluid_resuscitation_administered, fluid_volume_ml, vasopressors_initiated
        ) VALUES ($1, '3_hour', $2, $3, false, false, null, false, 0, false)
        RETURNING *`,
        [
          surveillance.id,
          labs?.lactate !== undefined,
          labs?.lactate || null
        ]
      );
      sep1Bundle = bundleRes.rows[0];
    }

    return {
      surveillanceId: surveillance.id,
      patientId,
      sessionId,
      sirsScore: sirs.score,
      sirsPositive,
      sirsCriteria: sirs.criteria,
      qsofaScore: qsofa.score,
      qsofaPositive,
      qsofaCriteria: qsofa.criteria,
      news2Score: news2.score,
      news2Risk,
      news2Breakdown: news2.breakdown,
      deteriorationTier,
      sep1Bundle,
      recommendations
    };
  }

  /**
   * Update SEP-1 Resuscitation Bundle actions.
   */
  public async updateBundleAction(bundleId: number, updates: {
    lactateMeasured?: boolean;
    lactateValue?: number;
    bloodCulturesDrawn?: boolean;
    broadSpectrumAbxOrdered?: boolean;
    abxRegimen?: string;
    fluidResuscitationAdministered?: boolean;
    fluidVolumeMl?: number;
    vasopressorsInitiated?: boolean;
    repeatLactateMeasured?: boolean;
    notes?: string;
  }) {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.lactateMeasured !== undefined) {
      fields.push(`lactate_measured = $${idx++}`);
      values.push(updates.lactateMeasured);
    }
    if (updates.lactateValue !== undefined) {
      fields.push(`lactate_value = $${idx++}`);
      values.push(updates.lactateValue);
    }
    if (updates.bloodCulturesDrawn !== undefined) {
      fields.push(`blood_cultures_drawn = $${idx++}`);
      values.push(updates.bloodCulturesDrawn);
    }
    if (updates.broadSpectrumAbxOrdered !== undefined) {
      fields.push(`broad_spectrum_abx_ordered = $${idx++}`);
      values.push(updates.broadSpectrumAbxOrdered);
    }
    if (updates.abxRegimen !== undefined) {
      fields.push(`abx_regimen = $${idx++}`);
      values.push(updates.abxRegimen);
    }
    if (updates.fluidResuscitationAdministered !== undefined) {
      fields.push(`fluid_resuscitation_administered = $${idx++}`);
      values.push(updates.fluidResuscitationAdministered);
    }
    if (updates.fluidVolumeMl !== undefined) {
      fields.push(`fluid_volume_ml = $${idx++}`);
      values.push(updates.fluidVolumeMl);
    }
    if (updates.vasopressorsInitiated !== undefined) {
      fields.push(`vasopressors_initiated = $${idx++}`);
      values.push(updates.vasopressorsInitiated);
    }
    if (updates.repeatLactateMeasured !== undefined) {
      fields.push(`repeat_lactate_measured = $${idx++}`);
      values.push(updates.repeatLactateMeasured);
    }
    if (updates.notes !== undefined) {
      fields.push(`notes = $${idx++}`);
      values.push(updates.notes);
    }

    // Check if 3-hour bundle completed
    const currentRes = await query('SELECT * FROM sep1_bundle_actions WHERE id = $1', [bundleId]);
    if (currentRes.rows.length > 0) {
      const row = currentRes.rows[0];
      const isLactate = updates.lactateMeasured !== undefined ? updates.lactateMeasured : row.lactate_measured;
      const isBloodCultures = updates.bloodCulturesDrawn !== undefined ? updates.bloodCulturesDrawn : row.blood_cultures_drawn;
      const isAbx = updates.broadSpectrumAbxOrdered !== undefined ? updates.broadSpectrumAbxOrdered : row.broad_spectrum_abx_ordered;

      if (isLactate && isBloodCultures && isAbx) {
        fields.push(`bundle_completed_at = CURRENT_TIMESTAMP`);
      }
    }

    values.push(bundleId);
    const res = await query(
      `UPDATE sep1_bundle_actions
       SET ${fields.join(', ')}
       WHERE id = $${idx}
       RETURNING *`,
      values
    );
    return res.rows[0];
  }

  /**
   * Fetch active deterioration and sepsis alerts across the facility.
   */
  public async getActiveSepsisAlerts() {
    const res = await query(`
      SELECT 
        s.*,
        p.name as patient_name,
        p.dob as patient_dob,
        p.sex as patient_sex,
        b.id as bundle_id,
        b.lactate_measured,
        b.lactate_value,
        b.blood_cultures_drawn,
        b.broad_spectrum_abx_ordered,
        b.abx_regimen,
        b.fluid_resuscitation_administered,
        b.fluid_volume_ml,
        b.bundle_completed_at
      FROM sepsis_surveillance_events s
      JOIN patients p ON s.patient_id = p.id
      LEFT JOIN sep1_bundle_actions b ON b.surveillance_id = s.id
      WHERE s.status = 'active' AND s.deterioration_tier IN ('critical_sepsis', 'high', 'medium')
      ORDER BY s.created_at DESC
      LIMIT 25
    `);
    return res.rows;
  }

  /**
   * Fetch surveillance events for a specific patient.
   */
  public async getPatientSurveillanceHistory(patientId: number) {
    const res = await query(`
      SELECT s.*, b.id as bundle_id, b.bundle_completed_at, b.abx_regimen, b.fluid_volume_ml
      FROM sepsis_surveillance_events s
      LEFT JOIN sep1_bundle_actions b ON b.surveillance_id = s.id
      WHERE s.patient_id = $1
      ORDER BY s.created_at DESC
    `, [patientId]);
    return res.rows;
  }

  /**
   * Resolve an alert.
   */
  public async resolveAlert(surveillanceId: number, notes?: string) {
    const res = await query(`
      UPDATE sepsis_surveillance_events
      SET status = 'resolved'
      WHERE id = $1
      RETURNING *
    `, [surveillanceId]);
    return res.rows[0];
  }
}

export const sepsisWatchdogService = new SepsisWatchdogService();
