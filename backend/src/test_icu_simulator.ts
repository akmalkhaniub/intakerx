import { IcuSimulatorService, SimulatedBed } from './services/icuSimulator';
import { pool } from './db';

async function runTests() {
  console.log('=== RUNNING REAL-TIME ICU TELEMETRY SIMULATOR & STRESS ENGINE (PILLAR 1) INTEGRATION TESTS ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Initialize 12-Bed Canonical Ward
    // -------------------------------------------------------------
    console.log('[Test 1] Initialize 12-Bed Canonical Ward');
    const beds = await IcuSimulatorService.initializeWard('Century Test ICU');
    
    assert(beds.length === 12, `Ward successfully initialized with exactly 12 beds (actual: ${beds.length})`);
    
    const bed1 = beds.find((b: SimulatedBed) => b.bedNumber === 1);
    assert(!!bed1, 'Bed 1 exists');
    assert(bed1?.clinicalProfileId === 'BED1_MATERNAL_CODE', `Bed 1 profile matches Maternal Code (actual: ${bed1?.clinicalProfileId})`);
    assert(bed1?.centuryTier === 'EXTREME_SURGE_ORCHESTRATED', `Bed 1 tier is EXTREME (actual: ${bed1?.centuryTier})`);

    const bed2 = beds.find((b: SimulatedBed) => b.bedNumber === 2);
    assert(!!bed2, 'Bed 2 exists');
    assert(bed2?.clinicalProfileId === 'BED2_AORTA_SPINAL', `Bed 2 profile matches Aorta vs Spinal (actual: ${bed2?.clinicalProfileId})`);
    assert(Boolean(bed2?.activeConflicts.some(c => c.conflictId === 'CONFLICT_AORTIC_VS_SPINAL_MAP')), 'Bed 2 detects Aortic vs Neuro BP target conflict');

    const bed3 = beds.find((b: SimulatedBed) => b.bedNumber === 3);
    assert(Boolean(bed3?.clinicalProfileId === 'BED3_PREECLAMPSIA_HEMORRHAGE'), 'Bed 3 matches Preeclampsia + Hemorrhage');
    assert(Boolean(bed3?.activeConflicts.some(c => c.conflictId === 'CONFLICT_PREECLAMPSIA_VS_METHERGINE')), 'Bed 3 detects Methergine contraindication');

    const bed4 = beds.find((b: SimulatedBed) => b.bedNumber === 4);
    assert(Boolean(bed4?.clinicalProfileId === 'BED4_BURN_ACS'), 'Bed 4 matches Burn ACS');
    assert(Boolean(bed4?.activeConflicts.some(c => c.conflictId === 'CONFLICT_BURN_PARKLAND_VS_ACS')), 'Bed 4 detects Parkland vs Abdominal HTN conflict');

    // -------------------------------------------------------------
    // Test 2: Step Tick Simulation with Physiological Drift
    // -------------------------------------------------------------
    console.log('\n[Test 2] Execute Simulation Tick Loop with Drift');
    const tickedBeds = IcuSimulatorService.tickSimulation();
    assert(tickedBeds.length === 12, 'Simulation tick returned all 12 updated beds');
    
    // Check that every bed has a valid score and tier
    const allValidScores = tickedBeds.every((b: SimulatedBed) => typeof b.centuryScore === 'number' && b.centuryScore >= 0 && b.centuryScore <= 100);
    assert(allValidScores, 'All beds have calibrated Century scores in [0, 100] range');

    // -------------------------------------------------------------
    // Test 3: Crisis Injection - Bed 4 Abdominal Compartment Spike
    // -------------------------------------------------------------
    console.log('\n[Test 3] Acute Crisis Injection: Bed 4 ACS Bladder Spike');
    const bed4Crisis = await IcuSimulatorService.triggerCrisis(4, 'ACS_BLADDER_SPIKE');
    assert(bed4Crisis.isCrashing === true, 'Bed 4 isCrashing flag set to true');
    assert(bed4Crisis.trend === 'DETERIORATING', 'Bed 4 trend set to DETERIORATING');
    assert((bed4Crisis.state.renalFluids?.bladderPressureIapMmhg || 0) >= 25, `Bed 4 IAP severely elevated >= 25 mmHg (actual: ${bed4Crisis.state.renalFluids?.bladderPressureIapMmhg})`);
    assert((bed4Crisis.state.renalFluids?.hourlyUrineOutputMlKgH || 1) <= 0.15, `Bed 4 urine output oliguric/anuric <= 0.15 (actual: ${bed4Crisis.state.renalFluids?.hourlyUrineOutputMlKgH})`);

    // -------------------------------------------------------------
    // Test 4: Protocol Intervention - Bed 4 Albumin Rescue & Escharotomy
    // -------------------------------------------------------------
    console.log('\n[Test 4] Protocol Intervention: Bed 4 Albumin Escharotomy Protocol');
    const bed4Intervened = await IcuSimulatorService.applyIntervention(4, 'ALBUMIN_ESCHAROTOMY');
    assert(bed4Intervened.isCrashing === false, 'Bed 4 isCrashing resolved to false');
    assert(bed4Intervened.trend === 'IMPROVING', 'Bed 4 trend set to IMPROVING');
    assert((bed4Intervened.state.renalFluids?.bladderPressureIapMmhg || 0) <= 15, `Bed 4 IAP successfully decompressed <= 15 mmHg (actual: ${bed4Intervened.state.renalFluids?.bladderPressureIapMmhg})`);
    assert((bed4Intervened.state.renalFluids?.hourlyUrineOutputMlKgH || 0) >= 0.5, `Bed 4 urine output restored (actual: ${bed4Intervened.state.renalFluids?.hourlyUrineOutputMlKgH})`);

    // -------------------------------------------------------------
    // Test 5: Crisis Injection & Protocol Intervention - Bed 2 Aortic Dissection
    // -------------------------------------------------------------
    console.log('\n[Test 5] Crisis & Intervention: Bed 2 Aortic Dissection SBP Spike & Esmolol Protocol');
    const bed2Crisis = await IcuSimulatorService.triggerCrisis(2, 'AORTIC_DISSECTION_SPIKE');
    assert(bed2Crisis.state.cardiovascular.systolicBp >= 180, `Bed 2 SBP spiked dangerously (actual: ${bed2Crisis.state.cardiovascular.systolicBp})`);
    assert(bed2Crisis.state.cardiovascular.heartRate >= 100, `Bed 2 HR spiked (actual: ${bed2Crisis.state.cardiovascular.heartRate})`);

    const bed2Intervened = await IcuSimulatorService.applyIntervention(2, 'ESMOLOL_ANTI_IMPULSE');
    assert(bed2Intervened.state.cardiovascular.systolicBp <= 120, `Bed 2 SBP brought under 120 mmHg for dissection anti-impulse (actual: ${bed2Intervened.state.cardiovascular.systolicBp})`);
    assert(bed2Intervened.state.cardiovascular.heartRate <= 65, `Bed 2 HR brought under 65 bpm with Esmolol (actual: ${bed2Intervened.state.cardiovascular.heartRate})`);

    // -------------------------------------------------------------
    // Test 6: Database Persistence & Event Log Verification
    // -------------------------------------------------------------
    console.log('\n[Test 6] Database Persistence Verification');
    const bedRows = await pool.query('SELECT COUNT(*) as count FROM icu_simulated_beds WHERE ward_id = $1;', [1]);
    assert(parseInt(bedRows.rows[0].count, 10) === 12, '12 beds persisted in icu_simulated_beds table');

    const eventRows = await pool.query('SELECT COUNT(*) as count FROM icu_simulation_events_log WHERE ward_id = $1;', [1]);
    const eventCount = parseInt(eventRows.rows[0].count, 10);
    assert(eventCount >= 4, `At least 4 crisis & intervention events logged in icu_simulation_events_log (actual: ${eventCount})`);

    console.log(`\n=============================================================`);
    console.log(`ICU SIMULATOR TESTS COMPLETE: ${passed} passed, ${failed} failed.`);
    console.log(`=============================================================`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during ICU Simulator test execution:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
