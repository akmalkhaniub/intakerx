import { PneumoDrainService } from './services/pneumoDrain';
import { pool } from './db';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('\n========================================================');
  console.log('--- Phase 81: PNEUMO-DRAIN Command Integration Tests ---');
  console.log('========================================================\n');

  try {
    // 1. Tension Pneumothorax Assessment (Acute Obstructive Shock)
    console.log('Test Group 1: Tension Pneumothorax & Immediate Thoracostomy');
    const tensionEval = PneumoDrainService.evaluateTensionPneumo({
      hemodynamic_instability: true,
      unilateral_absent_breath_sounds: true,
      tracheal_deviation: true,
      severe_dyspnea_cyanosis: true,
      anatomical_side: 'RIGHT'
    });

    assert(tensionEval.tension_pneumothorax_confirmed === true, 'Confirmed tension pneumothorax physiology');
    assert(tensionEval.immediate_decompression_required === true, 'Immediate decompression is required');
    assert(tensionEval.needle_decompression_location.includes('5th Intercostal Space') && tensionEval.needle_decompression_location.includes('RIGHT'), 'Specified 5th ICS anterior to mid-axillary line on RIGHT side');
    assert(tensionEval.finger_thoracostomy_protocol.includes('finger thoracostomy'), 'Included finger thoracostomy protocol');
    assert(tensionEval.critical_action_checklist.some(a => a.includes('DO NOT DELAY FOR CHEST X-RAY')), 'Warns to never delay decompression for radiography');

    // 2. Non-Tension Pneumothorax
    console.log('\nTest Group 2: Non-Tension Pneumothorax (Stable)');
    const nonTension = PneumoDrainService.evaluateTensionPneumo({
      hemodynamic_instability: false,
      unilateral_absent_breath_sounds: false,
      tracheal_deviation: false,
      severe_dyspnea_cyanosis: false,
      anatomical_side: 'LEFT'
    });

    assert(nonTension.tension_pneumothorax_confirmed === false, 'Tension physiology excluded');
    assert(nonTension.immediate_decompression_required === false, 'No emergent needle decompression needed');

    // 3. Massive Hemothorax: Initial Output >= 1500 mL (Emergent Thoracotomy Trigger)
    console.log('\nTest Group 3: Massive Hemothorax Initial Output (>= 1500 mL)');
    const massiveInitial = PneumoDrainService.evaluatePleuralDrainage({
      initial_insertion_output_ml: 1650,
      hourly_drainage_ml: 80,
      hours_monitoring: 1,
      fluid_character: 'FRANK_BLOOD',
      air_leak_grade: 'NONE',
      current_suction_cmh2o: -20,
      water_seal_trial_active: false
    });

    assert(massiveInitial.massive_hemothorax_detected === true, 'Detected massive hemothorax');
    assert(massiveInitial.emergent_thoracotomy_indicated === true, 'Triggered emergent OR thoracotomy indication');
    assert(massiveInitial.clinical_action_checklist.some(a => a.includes('STAT OPERATING ROOM THORACOTOMY')), 'Checklist triggers STAT OR thoracotomy');
    assert(massiveInitial.clinical_action_checklist.some(a => a.includes('autotransfusion') || a.includes('Cell Saver')), 'Recommends autotransfusion cell-saver canister');

    // 4. Massive Hemothorax: Persistent Hourly Output > 200 mL/hr for >= 2 Hours
    console.log('\nTest Group 4: Persistent Hemorrhage (> 200 mL/hr for >= 2 Hours)');
    const persistentBleed = PneumoDrainService.evaluatePleuralDrainage({
      initial_insertion_output_ml: 600,
      hourly_drainage_ml: 260,
      hours_monitoring: 3,
      fluid_character: 'FRANK_BLOOD',
      air_leak_grade: 'NONE',
      current_suction_cmh2o: -20,
      water_seal_trial_active: false
    });

    assert(persistentBleed.emergent_thoracotomy_indicated === true, 'Triggered thoracotomy for persistent bleeding > 200 mL/hr');

    // 5. Air Leak Severity & Bronchopleural Fistula
    console.log('\nTest Group 5: Air Leak Grading & Bronchopleural Fistula');
    const bronchopleural = PneumoDrainService.evaluatePleuralDrainage({
      initial_insertion_output_ml: 150,
      hourly_drainage_ml: 20,
      hours_monitoring: 4,
      fluid_character: 'SEROSANGUINOUS',
      air_leak_grade: 'GRADE_4_BRONCHOPLEURAL',
      current_suction_cmh2o: -20,
      water_seal_trial_active: false
    });

    assert(bronchopleural.air_leak_severity === 'BRONCHOPLEURAL_FISTULA', 'Classified as BRONCHOPLEURAL_FISTULA');
    assert(bronchopleural.clinical_action_checklist.some(a => a.includes('bronchoscopy')), 'Recommends urgent bronchoscopy');
    assert(bronchopleural.suction_vs_water_seal_recommendation.includes('DO NOT TRANSITION TO WATER SEAL'), 'Strictly contraindicates water seal during active air leak');

    // 6. Water Seal Trial & Chest Tube Removal Readiness
    console.log('\nTest Group 6: Water-Seal Trial & Removal Readiness');
    // Pre-water seal candidate
    const preTrial = PneumoDrainService.evaluatePleuralDrainage({
      initial_insertion_output_ml: 400,
      hourly_drainage_ml: 5,
      hours_monitoring: 24,
      fluid_character: 'SEROUS',
      air_leak_grade: 'NONE',
      current_suction_cmh2o: -20,
      water_seal_trial_active: false
    });

    assert(preTrial.chest_tube_removal_readiness === false, 'Not yet ready for removal before water-seal trial');
    assert(preTrial.suction_vs_water_seal_recommendation.includes('WATER-SEAL TRIAL'), 'Recommends transitioning to water-seal trial for 12-24h');

    // Post-water seal completed
    const readyForRemoval = PneumoDrainService.evaluatePleuralDrainage({
      initial_insertion_output_ml: 400,
      hourly_drainage_ml: 4,
      hours_monitoring: 48,
      fluid_character: 'SEROUS',
      air_leak_grade: 'NONE',
      current_suction_cmh2o: 0,
      water_seal_trial_active: true
    });

    assert(readyForRemoval.chest_tube_removal_readiness === true, 'Confirmed chest tube is READY FOR REMOVAL');
    assert(readyForRemoval.clinical_action_checklist.some(a => a.includes('post-water seal expiratory chest radiograph')), 'Instructs post-trial expiratory CXR before removal');

    // 7. Flail Chest & Surgical Stabilization (SSRF)
    console.log('\nTest Group 7: Flail Chest & Surgical Stabilization of Rib Fractures');
    const flailEval = PneumoDrainService.evaluateRibFractures({
      fractured_ribs_count: 6,
      flail_segment_present: true,
      bilateral_fractures: false,
      pulmonary_contusion_present: true,
      patient_age: 58,
      pain_score_10: 8,
      respiratory_failure_intubated: true
    });

    assert(flailEval.flail_chest_confirmed === true, 'Flail chest confirmed');
    assert(flailEval.thoracic_trauma_severity === 'SEVERE_HIGH_RISK', 'Classified as SEVERE_HIGH_RISK');
    assert(flailEval.ssrf_surgical_stabilization_indicated === true, 'Surgical stabilization (SSRF) indicated');
    assert(flailEval.regional_analgesia_recommendation.includes('Erector Spinae Plane') || flailEval.regional_analgesia_recommendation.includes('Serratus Anterior'), 'Recommends ESP or SAP regional block');
    assert(flailEval.pulmonary_hygiene_protocol.some(p => p.includes('Incentive Spirometry')), 'Includes aggressive incentive spirometry');

    // 8. Database Persistence & History Retrieval
    console.log('\nTest Group 8: Database Persistence & History Retrieval');
    let patientId = 1;
    const patRes = await pool.query('SELECT id FROM patients LIMIT 1');
    if (patRes.rows.length > 0) {
      patientId = patRes.rows[0].id;
    }

    // Insert thoracic drainage tube
    const tube = await PneumoDrainService.insertThoracicTube({
      patient_id: patientId,
      anatomical_side: 'RIGHT',
      tube_size_fr: 32,
      indication: 'HEMOTHORAX',
      initial_output_ml: 800,
      current_suction_cmh2o: -20,
      water_seal_trial_active: false
    });

    assert(Boolean(tube.id), 'Successfully recorded thoracic tube insertion');
    assert(tube.anatomical_side === 'RIGHT', 'Anatomical side matches (RIGHT)');
    assert(tube.tube_size_fr === 32, 'Tube size matches (32 Fr)');

    // Log pleural fluid drainage
    const drainageLog = await PneumoDrainService.logPleuralDrainage({
      tube_id: tube.id,
      patient_id: patientId,
      hourly_output_ml: 120,
      cumulative_24h_output_ml: 920,
      fluid_character: 'FRANK_BLOOD',
      air_leak_grade: 'GRADE_1_COUGH',
      massive_hemothorax_alert: false,
      emergent_thoracotomy_indicated: false
    });

    assert(Boolean(drainageLog.id), 'Successfully recorded pleural fluid drainage log');
    assert(drainageLog.hourly_output_ml === 120, 'Hourly output recorded accurately');

    // Update tube suction / water seal
    const updatedTube = await PneumoDrainService.updateTubeSuctionStatus(tube.id, 0, true);
    assert(Number(updatedTube.current_suction_cmh2o) === 0, 'Updated suction to 0 cmH2O (water seal)');
    assert(updatedTube.water_seal_trial_active === true, 'Water seal trial set to true');

    // Fetch patient thoracic history
    const history = await PneumoDrainService.getPatientThoracicHistory(patientId);
    assert(Array.isArray(history.tubes) && history.tubes.length > 0, 'Retrieved patient thoracic tubes');
    assert(Array.isArray(history.drainage_logs) && history.drainage_logs.length > 0, 'Retrieved pleural drainage logs');
    assert(history.tubes.some(t => t.id === tube.id), 'Inserted tube found in patient history');

    console.log(`\n========================================================`);
    console.log(`Phase 81 PNEUMO-DRAIN Tests Complete: ${passedTests}/${totalTests} Passed (100%)`);
    console.log(`========================================================\n`);
  } catch (error) {
    console.error('Test execution failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
