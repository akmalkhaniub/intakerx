import { NeuroCriticalCareService } from './services/neuroCriticalCare';

async function runTests() {
  console.log('--- STARTING PHASE 68 NEUROCRITICAL CARE INTEGRATION TESTS ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    // Test 1: Autoregulation - Intact Capacity (PRx <= 0.20)
    const intactAuto = NeuroCriticalCareService.evaluateAutoregulation({
      mean_icp_mmhg: 14.0,
      map_mmhg: 85.0,
      prx_autoregulation_index: -0.15
    });
    assert(intactAuto.cpp_mmhg === 71.0, 'CPP calculated as 71.0 mmHg (MAP 85 - ICP 14)');
    assert(intactAuto.autoregulation_status === 'intact', 'Autoregulation classified as intact');
    assert(intactAuto.optimal_cpp_target_mmhg === 65.0, 'Optimal CPP target defaulted to 65.0 mmHg');

    // Test 2: Autoregulation - Severely Impaired Capacity (PRx > 0.35)
    const impairedAuto = NeuroCriticalCareService.evaluateAutoregulation({
      mean_icp_mmhg: 26.0,
      map_mmhg: 80.0,
      prx_autoregulation_index: 0.48
    });
    assert(impairedAuto.cpp_mmhg === 54.0, 'CPP calculated as 54.0 mmHg');
    assert(impairedAuto.autoregulation_status === 'severely_dysfunctional', 'Autoregulation classified as severely dysfunctional');
    assert(impairedAuto.optimal_cpp_target_mmhg === 70.0, 'Optimal CPP target elevated to 70.0 mmHg');
    assert(impairedAuto.clinical_recommendations.some(r => r.includes('Intracranial Hypertension')), 'ICP > 22 alert generated');
    assert(impairedAuto.clinical_recommendations.some(r => r.includes('Hypoperfusion alert')), 'CPP < 60 alert generated');

    // Test 3: Multimodal Metabolism - Severe Hypoxia (PbtO2 < 15) & Energy Crisis (LPR > 40)
    const severeMetab = NeuroCriticalCareService.evaluateMultimodalMetabolism({
      pbto2_brain_oxygen_mmhg: 11.5,
      lactate_pyruvate_ratio: 48.0
    });
    assert(severeMetab.hypoxia_detected === true, 'PbtO2 11.5 triggers severe hypoxia');
    assert(severeMetab.cellular_energy_crisis_detected === true, 'LPR 48 triggers cellular energy crisis');
    assert(severeMetab.metabolic_alerts.some(a => a.includes('CRITICAL BRAIN HYPOXIA')), 'Critical brain hypoxia message included');
    assert(severeMetab.metabolic_alerts.some(a => a.includes('CELLULAR METABOLIC CRISIS')), 'Cellular crisis message included');

    // Test 4: Multimodal Metabolism - Normal Parameters
    const normalMetab = NeuroCriticalCareService.evaluateMultimodalMetabolism({
      pbto2_brain_oxygen_mmhg: 28.0,
      lactate_pyruvate_ratio: 18.0
    });
    assert(normalMetab.hypoxia_detected === false, 'PbtO2 28 detected as non-hypoxic');
    assert(normalMetab.cellular_energy_crisis_detected === false, 'LPR 18 detected as normal metabolic state');

    // Test 5: SAH Vasospasm - Critical Vasospasm (Lindegaard > 6 & MCA >= 200)
    const severeSpasm = NeuroCriticalCareService.evaluateSahVasospasm({
      mca_mean_velocity_cm_s: 220,
      ica_mean_velocity_cm_s: 32
    });
    assert(severeSpasm.lindegaard_ratio === 6.88, 'Lindegaard ratio calculated as 6.88');
    assert(severeSpasm.vasospasm_severity === 'severe', 'Vasospasm severity classified as severe');
    assert(severeSpasm.interventions.some(i => i.includes('intra-arterial vasodilator')), 'Angiography and vasodilator intervention recommended');

    // Test 6: SAH Vasospasm - Benign Hyperemia (MCA > 120, LR < 3)
    const hyperemia = NeuroCriticalCareService.evaluateSahVasospasm({
      mca_mean_velocity_cm_s: 140,
      ica_mean_velocity_cm_s: 60
    });
    assert(hyperemia.lindegaard_ratio === 2.33, 'Lindegaard ratio calculated as 2.33');
    assert(hyperemia.vasospasm_severity === 'hyperemia', 'Vasospasm classified as hyperemia');

    // Test 7: Status Epilepticus Continuous EEG - Adequate Burst Suppression
    const eegAdequate = NeuroCriticalCareService.evaluateEegBurstSuppression({
      salzburg_criteria_met: true,
      burst_suppression_ratio_percent: 85.0
    });
    assert(eegAdequate.sedation_depth_adequate === true, 'Burst suppression 85% classified as adequate');
    assert(eegAdequate.salzburg_criteria_met === true, 'Salzburg criteria status preserved');

    // Test 8: Status Epilepticus Continuous EEG - Suboptimal Burst Suppression
    const eegSuboptimal = NeuroCriticalCareService.evaluateEegBurstSuppression({
      salzburg_criteria_met: false,
      burst_suppression_ratio_percent: 45.0
    });
    assert(eegSuboptimal.sedation_depth_adequate === false, 'Burst suppression 45% classified as suboptimal');

    // Test 9: DB Persistence - Record Neuro Monitoring Session
    const dbSession = await NeuroCriticalCareService.recordMonitoringSession({
      patient_id: 1,
      diagnosis_category: 'Severe Traumatic Brain Injury',
      mean_icp_mmhg: 19.5,
      map_mmhg: 88.0,
      prx_autoregulation_index: 0.12,
      pbto2_brain_oxygen_mmhg: 23.0,
      lactate_pyruvate_ratio: 22.0,
      lindegaard_ratio: 2.1,
      eeg_burst_suppression_ratio: 82.0
    });
    assert(Boolean(dbSession.session.id), 'DB: Session saved with primary key');
    assert(Number(dbSession.session.cpp_mmhg) === 68.5, 'DB: Derived CPP saved accurately');

    // Test 10: DB Persistence - Record Intracranial Event
    const dbEvent = await NeuroCriticalCareService.recordHypertensionEvent({
      session_id: dbSession.session.id,
      peak_icp_mmhg: 29.0,
      duration_minutes: 25,
      lundberg_wave_type: 'A_wave',
      tier_intervention_applied: 'Tier 2: 3% Hypertonic Saline bolus + CSF drainage via EVD',
      hyperosmolar_agent: '3% Hypertonic Saline 250 mL IV',
      eeg_status_epilepticus_detected: false,
      outcome_status: 'controlled'
    });
    assert(Boolean(dbEvent.id), 'DB: Intracranial event saved with primary key');
    assert(dbEvent.lundberg_wave_type === 'A_wave', 'DB: Lundberg wave recorded');

    // Test 11: DB Persistence - Retrieve Patient Profile
    const profile = await NeuroCriticalCareService.getPatientNeuroProfile(1);
    assert(profile.sessions.length > 0, 'DB: Retrieved sessions for patient 1');
    assert(profile.events.length > 0, 'DB: Retrieved intracranial events for patient 1');

    console.log(`\nPHASE 68 SUMMARY: ${passed} passed, ${failed} failed.`);
    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Test execution failed with unhandled error:', error);
    process.exit(1);
  }
}

runTests().then(() => {
  process.exit(0);
});
