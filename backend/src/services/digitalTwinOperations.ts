import { pool } from '../db';

export interface HospitalUnit {
  id: number;
  unit_name: string;
  unit_type: 'ED' | 'ICU' | 'STEPDOWN' | 'MEDSURG' | 'PACU' | 'OR';
  total_beds: number;
  occupied_beds: number;
  staffed_nurses: number;
  target_nurse_to_patient_ratio: number;
  pending_admissions: number;
  pending_discharges: number;
  diversion_status: boolean;
  surge_capacity_available: number;
  occupancy_rate_percent?: number;
  effective_capacity?: number;
  staffing_deficit?: number;
}

export interface SimulationParams {
  scenario_name: string;
  ed_arrival_rate_per_hr: number;
  icu_stepdown_transfer_rate: number;
  or_addon_surgeries_count: number;
  simulation_duration_hours?: number;
}

export interface ErlangCResult {
  traffic_intensity: number;
  utilization: number;
  probability_of_delay: number;
  average_wait_hours: number;
}

export interface DivertRiskAnalysis {
  divert_risk_probability: number;
  divert_recommended: boolean;
  alert_level: 'NORMAL' | 'ELEVATED' | 'HIGH_SURGE' | 'CRITICAL_DIVERT_IMMINENT';
  projected_divert_hours: number;
  bottleneck_unit: string;
  contributing_factors: string[];
}

export interface SurgicalReallocationRecommendation {
  elective_blocks_to_defer: number;
  freed_or_minutes: number;
  recovered_icu_beds: number;
  recommended_actions: string[];
}

export interface DigitalTwinSimulationResult {
  scenario_name: string;
  ed_arrival_rate_per_hr: number;
  icu_stepdown_transfer_rate: number;
  or_addon_surgeries_count: number;
  simulation_duration_hours: number;
  projected_divert_hours: number;
  predicted_boarding_time_hours: number;
  bottleneck_unit: string;
  divert_risk_probability: number;
  alert_level: string;
  erlang_c_metrics: Record<string, ErlangCResult>;
  surgical_reallocations: SurgicalReallocationRecommendation;
  actionable_mitigations: string[];
}

/**
 * Factorial helper with safety bound.
 */
function factorial(n: number): number {
  if (n <= 1) return 1;
  let res = 1;
  for (let i = 2; i <= n; i++) {
    res *= i;
    if (res > 1e100) return 1e100;
  }
  return res;
}

/**
 * Calculates Erlang-C delay probability and average queue wait time.
 * c = number of servers/beds
 * lambda = arrival rate per hour
 * mu = service rate per server per hour (1 / average length of stay in hours)
 */
export function calculateErlangC(c: number, lambda: number, mu: number): ErlangCResult {
  if (c <= 0 || mu <= 0 || lambda <= 0) {
    return {
      traffic_intensity: 0,
      utilization: 0,
      probability_of_delay: 0,
      average_wait_hours: 0
    };
  }

  const A = lambda / mu; // Traffic intensity in Erlangs
  const rho = A / c;     // Utilization

  if (rho >= 1.0) {
    // Saturated system
    return {
      traffic_intensity: Math.round(A * 100) / 100,
      utilization: Math.min(Math.round(rho * 100) / 100, 1.5),
      probability_of_delay: 1.0,
      average_wait_hours: Math.round((lambda / c) * 4.5 * 10) / 10 // heavy congestion delay
    };
  }

  // Summation term: sum_{k=0}^{c-1} (A^k / k!)
  let sumTerm = 0;
  for (let k = 0; k < c; k++) {
    let term = 1;
    for (let j = 1; j <= k; j++) {
      term *= A / j;
    }
    sumTerm += term;
  }

  // Last term: (A^c / c!) * (1 / (1 - rho))
  let lastTerm = 1;
  for (let j = 1; j <= c; j++) {
    lastTerm *= A / j;
  }
  const erlangCTerm = lastTerm * (1 / (1 - rho));

  const p0 = 1 / (sumTerm + erlangCTerm);
  const probDelay = Math.min(Math.max(erlangCTerm * p0, 0), 1.0);

  // Wq = probDelay / (c * mu - lambda)
  const remainingCapacity = (c * mu) - lambda;
  const avgWait = remainingCapacity > 0 ? (probDelay / remainingCapacity) : 4.0;

  return {
    traffic_intensity: Math.round(A * 100) / 100,
    utilization: Math.round(rho * 100) / 100,
    probability_of_delay: Math.round(probDelay * 1000) / 1000,
    average_wait_hours: Math.round(avgWait * 100) / 100
  };
}

/**
 * Evaluates dynamic elective surgical block reallocation when emergent OR cases arrive.
 */
export function evaluateSurgicalBlockReallocation(
  emergencyAddons: number,
  pacuAvailableBeds: number,
  sicuAvailableBeds: number
): SurgicalReallocationRecommendation {
  const blocksToDefer = Math.max(0, Math.ceil(emergencyAddons * 0.75 - Math.floor(pacuAvailableBeds / 2)));
  const freedOrMinutes = blocksToDefer * 150; // Average elective surgical block duration
  const recoveredIcuBeds = Math.min(blocksToDefer, Math.max(1, Math.floor(emergencyAddons * 0.5)));

  const recommendedActions: string[] = [];

  if (emergencyAddons > 0) {
    recommendedActions.push(`Convert ${Math.min(2, emergencyAddons)} OR suites to designated Level 1 Trauma / Emergent Laparotomy hold.`);
  }

  if (blocksToDefer > 0) {
    recommendedActions.push(`Elective block pause: Defer ${blocksToDefer} non-urgent elective inpatient surgical cases to outpatient ambulatory slots.`);
    recommendedActions.push(`Preserves ${recoveredIcuBeds} post-operative SICU beds for emergency resuscitation admissions.`);
  } else {
    recommendedActions.push('Surgical suite and PACU capacity adequate for scheduled and emergent caseload.');
  }

  if (sicuAvailableBeds < emergencyAddons && emergencyAddons > 1) {
    recommendedActions.push('CRITICAL: SICU bed deficit detected. Transition PACU bay 3-4 to temporary post-cardiac/trauma overflow holding.');
  }

  return {
    elective_blocks_to_defer: blocksToDefer,
    freed_or_minutes: freedOrMinutes,
    recovered_icu_beds: recoveredIcuBeds,
    recommended_actions: recommendedActions
  };
}

/**
 * 6-Hour Predictive ED Divert Risk Engine
 */
export function evaluateDivertRisk(
  units: HospitalUnit[],
  edArrivalRate: number
): DivertRiskAnalysis {
  const ed = units.find(u => u.unit_type === 'ED') || {
    total_beds: 45,
    occupied_beds: 40,
    staffed_nurses: 10,
    pending_admissions: 8,
    pending_discharges: 2,
    surge_capacity_available: 5
  };

  const icuUnits = units.filter(u => u.unit_type === 'ICU');
  const icuTotalBeds = icuUnits.reduce((acc, u) => acc + u.total_beds, 0) || 44;
  const icuOccupied = icuUnits.reduce((acc, u) => acc + u.occupied_beds, 0) || 40;

  const medSurgUnits = units.filter(u => u.unit_type === 'MEDSURG' || u.unit_type === 'STEPDOWN');
  const medSurgTotal = medSurgUnits.reduce((acc, u) => acc + u.total_beds, 0) || 112;
  const medSurgOccupied = medSurgUnits.reduce((acc, u) => acc + u.occupied_beds, 0) || 103;

  const edNetPending = ed.pending_admissions - ed.pending_discharges;
  const edEffectiveOccupancy = (ed.occupied_beds + Math.max(0, edNetPending)) / ed.total_beds;
  const icuOccupancyRate = icuOccupied / icuTotalBeds;
  const floorOccupancyRate = medSurgOccupied / medSurgTotal;

  // Contributing factors
  const factors: string[] = [];
  let riskScore = 0.0;

  // 1. ED Volume pressure
  if (edEffectiveOccupancy >= 1.0) {
    riskScore += 0.45;
    factors.push(`ED at 100%+ capacity (${ed.occupied_beds}/${ed.total_beds} beds filled + ${edNetPending} net pending)`);
  } else if (edEffectiveOccupancy >= 0.88) {
    riskScore += 0.30;
    factors.push(`ED high utilization (${Math.round(edEffectiveOccupancy * 100)}%)`);
  }

  // 2. High arrival rate surge
  if (edArrivalRate >= 12.0) {
    riskScore += 0.25;
    factors.push(`High arrival surge: ${edArrivalRate} patients/hr exceeds standard intake bandwidth`);
  } else if (edArrivalRate >= 8.0) {
    riskScore += 0.15;
    factors.push(`Elevated arrival rate: ${edArrivalRate} patients/hr`);
  }

  // 3. Upstream ICU Boarding Bottleneck
  if (icuOccupancyRate >= 0.90) {
    riskScore += 0.20;
    factors.push(`ICU boarding gridlock: ICU occupancy at ${Math.round(icuOccupancyRate * 100)}% (${icuOccupied}/${icuTotalBeds})`);
  }

  // 4. Med-Surg stepdown gridlock
  if (floorOccupancyRate >= 0.90) {
    riskScore += 0.15;
    factors.push(`Inpatient acute bed gridlock: Med-Surg/Telemetry at ${Math.round(floorOccupancyRate * 100)}%`);
  }

  // Normalize probability 0.0 to 0.99
  const prob = Math.min(Math.round(riskScore * 100) / 100, 0.98);

  let alertLevel: 'NORMAL' | 'ELEVATED' | 'HIGH_SURGE' | 'CRITICAL_DIVERT_IMMINENT' = 'NORMAL';
  let projectedHours = 0;
  let divertRecommended = false;

  if (prob >= 0.70) {
    alertLevel = 'CRITICAL_DIVERT_IMMINENT';
    divertRecommended = true;
    projectedHours = Math.round((prob * 5.5) * 10) / 10;
  } else if (prob >= 0.45) {
    alertLevel = 'HIGH_SURGE';
    projectedHours = Math.round((prob * 3.0) * 10) / 10;
  } else if (prob >= 0.25) {
    alertLevel = 'ELEVATED';
  }

  // Determine primary bottleneck unit
  let bottleneck = 'Emergency Department (ED)';
  if (icuOccupancyRate > edEffectiveOccupancy && icuOccupancyRate > 0.85) {
    bottleneck = 'Medical & Surgical ICU (Critical Care Gridlock)';
  } else if (floorOccupancyRate > 0.92) {
    bottleneck = 'Acute General Med-Surg (Discharge Velocity Deficit)';
  }

  return {
    divert_risk_probability: prob,
    divert_recommended: divertRecommended,
    alert_level: alertLevel,
    projected_divert_hours: projectedHours,
    bottleneck_unit: bottleneck,
    contributing_factors: factors
  };
}

/**
 * Service Class: DigitalTwinOperationsService
 */
export class DigitalTwinOperationsService {
  /**
   * Retrieves all hospital units with real-time operational calculations.
   */
  static async getHospitalUnits(): Promise<HospitalUnit[]> {
    const res = await pool.query(`
      SELECT 
        id, unit_name, unit_type, total_beds, occupied_beds,
        staffed_nurses, target_nurse_to_patient_ratio,
        pending_admissions, pending_discharges, diversion_status,
        surge_capacity_available
      FROM digital_twin_hospital_units
      ORDER BY id ASC;
    `);

    return res.rows.map((row: any) => {
      const total = Number(row.total_beds);
      const occupied = Number(row.occupied_beds);
      const nurses = Number(row.staffed_nurses);
      const ratio = Number(row.target_nurse_to_patient_ratio);

      // Max patients nurses can safely care for
      const maxNursedPatients = ratio > 0 ? Math.floor(nurses / ratio) : total;
      const effectiveCap = Math.min(total, maxNursedPatients);
      const deficit = Math.max(0, occupied - maxNursedPatients);

      return {
        id: row.id,
        unit_name: row.unit_name,
        unit_type: row.unit_type,
        total_beds: total,
        occupied_beds: occupied,
        staffed_nurses: nurses,
        target_nurse_to_patient_ratio: ratio,
        pending_admissions: Number(row.pending_admissions),
        pending_discharges: Number(row.pending_discharges),
        diversion_status: Boolean(row.diversion_status),
        surge_capacity_available: Number(row.surge_capacity_available),
        occupancy_rate_percent: total > 0 ? Math.round((occupied / total) * 100) : 0,
        effective_capacity: effectiveCap,
        staffing_deficit: deficit
      };
    });
  }

  /**
   * Updates census and staffing parameters for a single hospital unit.
   */
  static async updateUnitCensus(unitId: number, data: Partial<HospitalUnit>): Promise<HospitalUnit> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.occupied_beds !== undefined) {
      fields.push(`occupied_beds = $${idx++}`);
      values.push(data.occupied_beds);
    }
    if (data.staffed_nurses !== undefined) {
      fields.push(`staffed_nurses = $${idx++}`);
      values.push(data.staffed_nurses);
    }
    if (data.pending_admissions !== undefined) {
      fields.push(`pending_admissions = $${idx++}`);
      values.push(data.pending_admissions);
    }
    if (data.pending_discharges !== undefined) {
      fields.push(`pending_discharges = $${idx++}`);
      values.push(data.pending_discharges);
    }
    if (data.diversion_status !== undefined) {
      fields.push(`diversion_status = $${idx++}`);
      values.push(data.diversion_status);
    }
    if (data.surge_capacity_available !== undefined) {
      fields.push(`surge_capacity_available = $${idx++}`);
      values.push(data.surge_capacity_available);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(unitId);

    const q = `
      UPDATE digital_twin_hospital_units
      SET ${fields.join(', ')}
      WHERE id = $${idx}
      RETURNING *;
    `;

    const res = await pool.query(q, values);
    return res.rows[0];
  }

  /**
   * Runs the complete operations flow simulation and persists results.
   */
  static async runFlowSimulation(params: SimulationParams): Promise<DigitalTwinSimulationResult> {
    const units = await this.getHospitalUnits();

    // 1. Erlang-C calculations for ED
    const edUnit = units.find(u => u.unit_type === 'ED') || {
      total_beds: 45,
      occupied_beds: 41,
      staffed_nurses: 12
    };
    // Standard ED average length of stay ~ 4.2 hours -> mu = 1/4.2 = 0.238
    const edErlang = calculateErlangC(
      edUnit.total_beds,
      params.ed_arrival_rate_per_hr,
      0.238
    );

    // 2. Erlang-C calculations for ICU
    const icuUnit = units.find(u => u.unit_type === 'ICU') || {
      total_beds: 24,
      occupied_beds: 22,
      staffed_nurses: 11
    };
    // ICU average stay ~ 72 hours -> mu = 1/72 = 0.0138
    const icuArrivals = (params.ed_arrival_rate_per_hr * 0.12) + (params.or_addon_surgeries_count * 0.4);
    const icuErlang = calculateErlangC(
      icuUnit.total_beds,
      icuArrivals,
      0.0138
    );

    // 3. Surgical Block Reallocations
    const pacu = units.find(u => u.unit_type === 'PACU');
    const sicu = units.find(u => u.unit_name.includes('Surgical'));
    const pacuAvailable = pacu ? Math.max(0, pacu.total_beds - pacu.occupied_beds) : 4;
    const sicuAvailable = sicu ? Math.max(0, sicu.total_beds - sicu.occupied_beds) : 2;

    const surgicalReallocation = evaluateSurgicalBlockReallocation(
      params.or_addon_surgeries_count,
      pacuAvailable,
      sicuAvailable
    );

    // 4. Divert Risk Evaluation
    const divertRisk = evaluateDivertRisk(units, params.ed_arrival_rate_per_hr);

    // 5. Synthesize Actionable Mitigations
    const mitigations: string[] = [];
    if (divertRisk.divert_recommended) {
      mitigations.push('Activate Code Triage: Emergency Department diversion protocol recommended to regional EMS dispatch.');
      mitigations.push('Expedite inpatient discharge rounds: Target 8 Med-Surg and 3 Telemetry discharges before 13:00.');
      mitigations.push('Deploy Surge Nursing Pool: Call in 3 relief float nurses to expand active ED ratio to 1:3.');
    } else {
      mitigations.push('Maintain standard operational cadence. Monitor ED boarding times continuously.');
    }

    if (surgicalReallocation.elective_blocks_to_defer > 0) {
      mitigations.push(...surgicalReallocation.recommended_actions);
    }

    const duration = params.simulation_duration_hours || 24;
    const predictedBoardingTime = Math.max(1.2, edErlang.average_wait_hours);

    // 6. Persist Simulation Run to DB
    await pool.query(`
      INSERT INTO bed_flow_simulation_runs (
        scenario_name, ed_arrival_rate_per_hr, icu_stepdown_transfer_rate,
        or_addon_surgeries_count, simulation_duration_hours,
        projected_divert_hours, predicted_boarding_time_hours,
        bottleneck_unit, divert_risk_probability, recommended_reallocations
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);
    `, [
      params.scenario_name,
      params.ed_arrival_rate_per_hr,
      params.icu_stepdown_transfer_rate,
      params.or_addon_surgeries_count,
      duration,
      divertRisk.projected_divert_hours,
      predictedBoardingTime,
      divertRisk.bottleneck_unit,
      divertRisk.divert_risk_probability,
      JSON.stringify({
        erlang_c: { ed: edErlang, icu: icuErlang },
        surgical: surgicalReallocation,
        mitigations
      })
    ]);

    return {
      scenario_name: params.scenario_name,
      ed_arrival_rate_per_hr: params.ed_arrival_rate_per_hr,
      icu_stepdown_transfer_rate: params.icu_stepdown_transfer_rate,
      or_addon_surgeries_count: params.or_addon_surgeries_count,
      simulation_duration_hours: duration,
      projected_divert_hours: divertRisk.projected_divert_hours,
      predicted_boarding_time_hours: predictedBoardingTime,
      bottleneck_unit: divertRisk.bottleneck_unit,
      divert_risk_probability: divertRisk.divert_risk_probability,
      alert_level: divertRisk.alert_level,
      erlang_c_metrics: {
        'Emergency Department': edErlang,
        'Intensive Care Unit': icuErlang
      },
      surgical_reallocations: surgicalReallocation,
      actionable_mitigations: mitigations
    };
  }

  /**
   * Retrieves past simulation runs.
   */
  static async getSimulationHistory(limit: number = 10): Promise<any[]> {
    const res = await pool.query(`
      SELECT * FROM bed_flow_simulation_runs
      ORDER BY created_at DESC
      LIMIT $1;
    `, [limit]);
    return res.rows;
  }
}
