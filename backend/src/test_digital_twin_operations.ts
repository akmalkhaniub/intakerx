import {
  calculateErlangC,
  evaluateSurgicalBlockReallocation,
  evaluateDivertRisk,
  DigitalTwinOperationsService,
  HospitalUnit
} from './services/digitalTwinOperations';
import { pool } from './db';

async function runTests() {
  console.log('--- STARTING PHASE 71 DIGITAL TWIN OPERATIONS INTEGRATION TESTS ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`[PASS] ${msg}`);
      passed++;
    } else {
      console.error(`[FAIL] ${msg}`);
      failed++;
    }
  }

  try {
    // 1. Erlang-C Queuing Theory Engine Tests
    const normalErlang = calculateErlangC(45, 8.0, 0.238); // ED 45 beds, 8 arrivals/hr, mu=0.238
    assert(normalErlang.utilization < 1.0, 'Erlang-C: Normal ED utilization < 100%');
    assert(normalErlang.probability_of_delay >= 0 && normalErlang.probability_of_delay <= 1.0, 'Erlang-C: Probability of delay in valid [0, 1] range');
    assert(normalErlang.average_wait_hours >= 0, 'Erlang-C: Average wait hours calculated');

    const saturatedErlang = calculateErlangC(10, 15.0, 0.5); // 10 servers, 15 arrivals, mu=0.5 -> A=30, rho=3.0 (saturated)
    assert(saturatedErlang.probability_of_delay === 1.0, 'Erlang-C: Saturated system yields probability of delay = 1.0');
    assert(saturatedErlang.average_wait_hours > 0, 'Erlang-C: Saturated wait hours projected');

    // 2. Surgical Block Reallocation Engine Tests
    const surg1 = evaluateSurgicalBlockReallocation(0, 4, 3);
    assert(surg1.elective_blocks_to_defer === 0, 'Surgical: 0 emergency add-ons requires 0 deferrals');
    assert(surg1.recommended_actions.length > 0, 'Surgical: Baseline actions returned');

    const surg2 = evaluateSurgicalBlockReallocation(6, 1, 0); // 6 emergency trauma cases, 1 PACU, 0 SICU
    assert(surg2.elective_blocks_to_defer > 0, 'Surgical: High emergency add-ons triggers elective block deferrals');
    assert(surg2.freed_or_minutes >= 300, 'Surgical: Freed OR minutes calculated for emergency add-ons');
    assert(surg2.recovered_icu_beds > 0, 'Surgical: Recovered ICU beds projected');
    assert(surg2.recommended_actions.some(a => a.includes('CRITICAL: SICU bed deficit')), 'Surgical: Critical SICU bed deficit alert triggered');

    // 3. 6-Hour Predictive ED Divert Risk Engine Tests
    const mockUnitsNormal: HospitalUnit[] = [
      {
        id: 1,
        unit_name: 'Emergency Department (ED)',
        unit_type: 'ED',
        total_beds: 45,
        occupied_beds: 25,
        staffed_nurses: 12,
        target_nurse_to_patient_ratio: 0.33,
        pending_admissions: 2,
        pending_discharges: 5,
        diversion_status: false,
        surge_capacity_available: 10
      },
      {
        id: 2,
        unit_name: 'Medical Intensive Care (MICU)',
        unit_type: 'ICU',
        total_beds: 24,
        occupied_beds: 14,
        staffed_nurses: 10,
        target_nurse_to_patient_ratio: 0.5,
        pending_admissions: 1,
        pending_discharges: 2,
        diversion_status: false,
        surge_capacity_available: 2
      }
    ];

    const normalRisk = evaluateDivertRisk(mockUnitsNormal, 5.0);
    assert(normalRisk.divert_risk_probability < 0.45, 'Divert: Normal conditions yield low risk probability');
    assert(!normalRisk.divert_recommended, 'Divert: Normal conditions do not recommend diversion');
    assert(normalRisk.alert_level === 'NORMAL' || normalRisk.alert_level === 'ELEVATED', 'Divert: Alert level is normal or elevated');

    const mockUnitsSurge: HospitalUnit[] = [
      {
        id: 1,
        unit_name: 'Emergency Department (ED)',
        unit_type: 'ED',
        total_beds: 45,
        occupied_beds: 45,
        staffed_nurses: 10,
        target_nurse_to_patient_ratio: 0.33,
        pending_admissions: 12,
        pending_discharges: 1,
        diversion_status: false,
        surge_capacity_available: 0
      },
      {
        id: 2,
        unit_name: 'Medical Intensive Care (MICU)',
        unit_type: 'ICU',
        total_beds: 24,
        occupied_beds: 23,
        staffed_nurses: 11,
        target_nurse_to_patient_ratio: 0.5,
        pending_admissions: 5,
        pending_discharges: 0,
        diversion_status: false,
        surge_capacity_available: 0
      },
      {
        id: 3,
        unit_name: 'Acute General Med-Surg',
        unit_type: 'MEDSURG',
        total_beds: 80,
        occupied_beds: 78,
        staffed_nurses: 14,
        target_nurse_to_patient_ratio: 0.2,
        pending_admissions: 8,
        pending_discharges: 1,
        diversion_status: false,
        surge_capacity_available: 0
      }
    ];

    const criticalRisk = evaluateDivertRisk(mockUnitsSurge, 14.5);
    assert(criticalRisk.divert_risk_probability >= 0.70, 'Divert: Severe surge yields >= 70% divert probability');
    assert(criticalRisk.divert_recommended, 'Divert: Divert recommended on critical surge');
    assert(criticalRisk.alert_level === 'CRITICAL_DIVERT_IMMINENT', 'Divert: Alert level set to CRITICAL_DIVERT_IMMINENT');
    assert(criticalRisk.projected_divert_hours > 0, 'Divert: Projected diversion hours calculated');
    assert(criticalRisk.contributing_factors.length >= 3, 'Divert: Multiple contributing factors flagged');

    // 4. Database Digital Twin Operations Service Tests
    const units = await DigitalTwinOperationsService.getHospitalUnits();
    assert(units.length >= 6, 'DB: Retrieved all 6 standard hospital units');
    assert(units.some(u => u.unit_type === 'ED'), 'DB: Emergency Department found');
    assert(units.some(u => u.unit_type === 'ICU'), 'DB: ICU units found');
    assert(units[0].occupancy_rate_percent !== undefined, 'DB: Occupancy rate calculated');
    assert(units[0].effective_capacity !== undefined, 'DB: Effective staffed capacity calculated');

    // Test unit update
    const ed = units.find(u => u.unit_type === 'ED')!;
    const updatedEd = await DigitalTwinOperationsService.updateUnitCensus(ed.id, {
      occupied_beds: 42,
      pending_admissions: 9
    });
    assert(updatedEd.occupied_beds === 42, 'DB: Unit census updated successfully');

    // Test simulation execution
    const simResult = await DigitalTwinOperationsService.runFlowSimulation({
      scenario_name: 'Winter Respiratory Surge + Multi-Trauma Mass Casualty',
      ed_arrival_rate_per_hr: 13.5,
      icu_stepdown_transfer_rate: 3.2,
      or_addon_surgeries_count: 5,
      simulation_duration_hours: 24
    });

    assert(simResult.scenario_name.includes('Surge'), 'Simulation: Scenario name preserved');
    assert(simResult.divert_risk_probability > 0, 'Simulation: Divert risk probability generated');
    assert(simResult.predicted_boarding_time_hours > 0, 'Simulation: Predicted boarding time generated');
    assert(simResult.actionable_mitigations.length > 0, 'Simulation: Actionable mitigations returned');
    assert(simResult.erlang_c_metrics['Emergency Department'] !== undefined, 'Simulation: ED Erlang-C metrics returned');

    // Test simulation history retrieval
    const history = await DigitalTwinOperationsService.getSimulationHistory(5);
    assert(history.length >= 1, 'DB: Simulation run persisted and retrieved from history');
    assert(history[0].scenario_name.includes('Surge'), 'DB: Persisted run matches executed scenario');

  } catch (err: any) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    console.log(`\nPHASE 71 SUMMARY: ${passed} passed, ${failed} failed.`);
    await pool.end();
    if (failed > 0) {
      process.exit(1);
    }
  }
}

runTests();
