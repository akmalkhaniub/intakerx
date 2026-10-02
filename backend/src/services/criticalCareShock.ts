import { pool } from '../db';

export interface ShockEvaluationInput {
  patientId: number;
  sessionId?: string;
  icuBed: string;
  shockPhenotype: 'distributive_septic' | 'cardiogenic' | 'hypovolemic' | 'obstructive';
  meanArterialPressure: number;
  cardiacIndex?: number;
  systemicVascularResistance?: number;
  fluidResponsivenessIndex?: string;
  ultrasoundPattern?: 'A_lines_dry' | 'B_lines_interstitial_edema' | 'RV_strain_PE' | 'pericardial_effusion';
  serumLactateMmolL: number;
  baselineLactate?: number;
  primaryVasopressor?: string;
  currentDoseMcgKgMin?: number;
  attendingIntensivist?: string;
}

export interface VasopressorTitrationInput {
  shockRecordId: number;
  agentName: string;
  doseRate: number;
  doseUnits?: string;
  targetMap?: number;
  resultingMap: number;
  titrationReason: string;
  titratedBy?: string;
}

export interface IcuShockSummary {
  metrics: {
    activeShockCases: number;
    septicShockCount: number;
    cardiogenicShockCount: number;
    multiPressorRefractoryCount: number;
    meanLactateClearanceRate: number;
    targetMapAttainmentRate: number;
  };
  recentRecords: any[];
  recentTitrations: any[];
}

export async function evaluateShockAndResuscitation(input: ShockEvaluationInput) {
  const {
    patientId,
    sessionId,
    icuBed,
    shockPhenotype,
    meanArterialPressure,
    cardiacIndex,
    systemicVascularResistance,
    fluidResponsivenessIndex = 'PPV 14% (Fluid Responsive)',
    ultrasoundPattern = 'A_lines_dry',
    serumLactateMmolL,
    baselineLactate,
    primaryVasopressor = 'Norepinephrine',
    currentDoseMcgKgMin = 0.12,
    attendingIntensivist = 'Dr. Marcus Webb, MD (Critical Care Medicine)'
  } = input;

  // Calculate Lactate Clearance Kinetics
  let lactateClearancePercent = 0.0;
  if (baselineLactate && baselineLactate > 0) {
    lactateClearancePercent = Math.round(((baselineLactate - serumLactateMmolL) / baselineLactate) * 100 * 10) / 10;
  }

  // Determine Resuscitation Status
  let resuscitationStatus = 'active_resuscitation';
  if (meanArterialPressure >= 65 && serumLactateMmolL <= 2.0 && currentDoseMcgKgMin <= 0.05) {
    resuscitationStatus = 'weaned';
  } else if (meanArterialPressure >= 65 && lactateClearancePercent >= 15.0) {
    resuscitationStatus = 'stabilized';
  } else if (currentDoseMcgKgMin >= 0.50 || (cardiacIndex && cardiacIndex < 1.8)) {
    resuscitationStatus = 'escalated_ecmo_device';
  }

  const query = `
    INSERT INTO icu_shock_records (
      patient_id,
      session_id,
      icu_bed,
      shock_phenotype,
      mean_arterial_pressure,
      cardiac_index,
      systemic_vascular_resistance,
      fluid_responsiveness_index,
      ultrasound_pattern,
      serum_lactate_mmol_l,
      lactate_clearance_percent,
      primary_vasopressor,
      current_dose_mcg_kg_min,
      resuscitation_status,
      attending_intensivist,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP)
    RETURNING *;
  `;

  const { rows } = await pool.query(query, [
    patientId,
    sessionId || null,
    icuBed,
    shockPhenotype,
    meanArterialPressure,
    cardiacIndex || null,
    systemicVascularResistance || null,
    fluidResponsivenessIndex,
    ultrasoundPattern,
    serumLactateMmolL,
    lactateClearancePercent,
    primaryVasopressor,
    currentDoseMcgKgMin,
    resuscitationStatus,
    attendingIntensivist
  ]);

  return rows[0];
}

export async function recordVasopressorTitration(input: VasopressorTitrationInput) {
  const {
    shockRecordId,
    agentName,
    doseRate,
    doseUnits = 'mcg/kg/min',
    targetMap = 65,
    resultingMap,
    titrationReason,
    titratedBy = 'ICU Titration Protocol'
  } = input;

  const insertQuery = `
    INSERT INTO vasopressor_titrations (
      shock_record_id,
      agent_name,
      dose_rate,
      dose_units,
      target_map,
      resulting_map,
      titration_reason,
      titrated_by,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
    RETURNING *;
  `;

  const { rows } = await pool.query(insertQuery, [
    shockRecordId,
    agentName,
    doseRate,
    doseUnits,
    targetMap,
    resultingMap,
    titrationReason,
    titratedBy
  ]);

  // Update master shock record MAP and current dose
  await pool.query(`
    UPDATE icu_shock_records
    SET mean_arterial_pressure = $1,
        current_dose_mcg_kg_min = $2,
        primary_vasopressor = $3
    WHERE id = $4
  `, [resultingMap, doseRate, agentName, shockRecordId]);

  return rows[0];
}

async function seedInitialIcuShockDataIfEmpty() {
  const countRes = await pool.query('SELECT COUNT(*) FROM icu_shock_records');
  if (parseInt(countRes.rows[0].count, 10) > 0) return;

  const patientRes = await pool.query('SELECT id, name FROM patients LIMIT 1');
  if (patientRes.rows.length === 0) return;
  const p = patientRes.rows[0];

  const shockRes = await pool.query(`
    INSERT INTO icu_shock_records (
      patient_id, icu_bed, shock_phenotype, mean_arterial_pressure, cardiac_index,
      systemic_vascular_resistance, fluid_responsiveness_index, ultrasound_pattern,
      serum_lactate_mmol_l, lactate_clearance_percent, primary_vasopressor,
      current_dose_mcg_kg_min, resuscitation_status, attending_intensivist, created_at
    ) VALUES ($1, 'MICU Bed 08', 'distributive_septic', 68.0, 3.4, 650,
      'PPV 15% (Responsive to 500mL Bolus)', 'A_lines_dry', 2.8, 22.2, 'Norepinephrine',
      0.16, 'stabilized', 'Dr. Marcus Webb, MD', CURRENT_TIMESTAMP - INTERVAL '3 hours')
    RETURNING id;
  `, [p.id]);

  if (shockRes.rows.length > 0) {
    await pool.query(`
      INSERT INTO vasopressor_titrations (
        shock_record_id, agent_name, dose_rate, dose_units, target_map, resulting_map,
        titration_reason, titrated_by, created_at
      ) VALUES ($1, 'Norepinephrine', 0.16, 'mcg/kg/min', 65, 68,
        'Titrated up from 0.10 for MAP < 65', 'Critical Care RN & Protocol', CURRENT_TIMESTAMP - INTERVAL '2 hours')
    `, [shockRes.rows[0].id]);
  }
}

export async function getIcuShockSummary(): Promise<IcuShockSummary> {
  await seedInitialIcuShockDataIfEmpty();

  const shockRes = await pool.query(`
    SELECT s.*, p.name as patient_name
    FROM icu_shock_records s
    LEFT JOIN patients p ON s.patient_id = p.id
    ORDER BY s.created_at DESC
    LIMIT 25;
  `);

  const titrationRes = await pool.query(`
    SELECT t.*, s.icu_bed, s.shock_phenotype, p.name as patient_name
    FROM vasopressor_titrations t
    LEFT JOIN icu_shock_records s ON t.shock_record_id = s.id
    LEFT JOIN patients p ON s.patient_id = p.id
    ORDER BY t.created_at DESC
    LIMIT 25;
  `);

  const totalCases = shockRes.rows.length;
  const septicCases = shockRes.rows.filter(s => s.shock_phenotype === 'distributive_septic').length;
  const cardioCases = shockRes.rows.filter(s => s.shock_phenotype === 'cardiogenic').length;
  const multiPressors = shockRes.rows.filter(s => Number(s.current_dose_mcg_kg_min) >= 0.25).length;

  const targetMapMetCount = shockRes.rows.filter(s => Number(s.mean_arterial_pressure) >= 65).length;
  const targetMapRate = totalCases > 0 ? Math.round((targetMapMetCount / totalCases) * 100) : 100;

  let totalLactateClearance = 0;
  shockRes.rows.forEach(s => {
    totalLactateClearance += Number(s.lactate_clearance_percent || 0);
  });
  const meanLactateClearance = totalCases > 0 ? Math.round((totalLactateClearance / totalCases) * 10) / 10 : 0;

  return {
    metrics: {
      activeShockCases: totalCases,
      septicShockCount: septicCases,
      cardiogenicShockCount: cardioCases,
      multiPressorRefractoryCount: multiPressors,
      meanLactateClearanceRate: meanLactateClearance,
      targetMapAttainmentRate: targetMapRate
    },
    recentRecords: shockRes.rows.map(s => ({
      id: s.id,
      patientId: s.patient_id,
      patientName: s.patient_name || `Patient #${s.patient_id}`,
      icuBed: s.icu_bed,
      shockPhenotype: s.shock_phenotype,
      meanArterialPressure: Number(s.mean_arterial_pressure),
      cardiacIndex: s.cardiac_index ? Number(s.cardiac_index) : null,
      systemicVascularResistance: s.systemic_vascular_resistance,
      fluidResponsivenessIndex: s.fluid_responsiveness_index,
      ultrasoundPattern: s.ultrasound_pattern,
      serumLactateMmolL: Number(s.serum_lactate_mmol_l),
      lactateClearancePercent: Number(s.lactate_clearance_percent),
      primaryVasopressor: s.primary_vasopressor,
      currentDoseMcgKgMin: Number(s.current_dose_mcg_kg_min),
      resuscitationStatus: s.resuscitation_status,
      attendingIntensivist: s.attending_intensivist,
      createdAt: s.created_at
    })),
    recentTitrations: titrationRes.rows.map(t => ({
      id: t.id,
      shockRecordId: t.shock_record_id,
      patientName: t.patient_name || `Patient #${t.shock_record_id}`,
      icuBed: t.icu_bed,
      shockPhenotype: t.shock_phenotype,
      agentName: t.agent_name,
      doseRate: Number(t.dose_rate),
      doseUnits: t.dose_units,
      targetMap: t.target_map,
      resultingMap: t.resulting_map,
      titrationReason: t.titration_reason,
      titratedBy: t.titrated_by,
      createdAt: t.created_at
    }))
  };
}

export async function getPatientShockData(patientId: number) {
  const records = await pool.query(
    'SELECT * FROM icu_shock_records WHERE patient_id = $1 ORDER BY created_at DESC',
    [patientId]
  );
  return records.rows;
}
