import { pool } from './db';
import { IcuRoundingService, FastHugBidBundle, CamIcuFeatures } from './services/icuRounding';

async function runTests() {
  console.log('--- STARTING ROUNDING-HUD TEST SUITE (PHASE 75) ---');
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
    // 1. FAST-HUG-BID 100% Compliance Evaluation
    const perfectBundle: FastHugBidBundle = {
      feeding: { status: 'ENTERAL', compliant: true },
      analgesia: { assessed: true, score: 1, adequate_control: true, opioid_sparing_used: true, compliant: true },
      sedation: { rass_target: -1, rass_actual: -1, sedation_vacation_attempted: true, compliant: true },
      thromboembolism: { modality: 'PHARMACOLOGICAL_LMWH', contraindication_documented: false, compliant: true },
      head_of_bed: { elevation_degrees: 35, contraindicated: false, compliant: true },
      ulcer_prophylaxis: { indicated: true, agent: 'PPI', compliant: true },
      glucose_control: { current_glucose_mg_dl: 150, within_target_range: true, insulin_protocol_active: true, compliant: true },
      breathing_trial: { intubated: true, sbt_performed_or_screened: true, sbt_passed: true, compliant: true },
      indwelling_devices: { daily_review_conducted: true, foley_in_place: true, cvc_in_place: true, art_line_in_place: false, compliant: true },
      deescalation: { antibiotics_active: true, timeout_48h_performed: true, cultures_reviewed: true, compliant: true }
    };

    const perfectEval = IcuRoundingService.evaluateFastHugBid(perfectBundle);
    assert(perfectEval.compliance_percent === 100, 'FAST-HUG-BID: 10/10 items yields 100% compliance');
    assert(perfectEval.safety_gaps.length === 0, 'FAST-HUG-BID: Zero safety gaps for perfect bundle');

    // 2. FAST-HUG-BID Partial Compliance with Safety Gaps
    const suboptBundle: FastHugBidBundle = {
      ...perfectBundle,
      head_of_bed: { elevation_degrees: 15, contraindicated: false, compliant: false },
      thromboembolism: { modality: 'NONE', contraindication_documented: false, compliant: false },
      deescalation: { antibiotics_active: true, timeout_48h_performed: false, cultures_reviewed: false, compliant: false }
    };

    const suboptEval = IcuRoundingService.evaluateFastHugBid(suboptBundle);
    assert(suboptEval.compliance_percent === 70, 'FAST-HUG-BID: 7/10 items yields 70% compliance');
    assert(suboptEval.safety_gaps.length === 3, 'FAST-HUG-BID: Exactly 3 safety gaps identified');
    assert(suboptEval.safety_gaps.some(g => g.includes('Head of bed angle 15°')), 'FAST-HUG-BID: HOB angle flagged');
    assert(suboptEval.safety_gaps.some(g => g.includes('VTE prophylaxis missing')), 'FAST-HUG-BID: Missing VTE prophylaxis flagged');
    assert(suboptEval.safety_gaps.some(g => g.includes('48-hour timeout not performed')), 'FAST-HUG-BID: Missing antimicrobial timeout flagged');

    // 3. CAM-ICU Evaluation: Negative Delirium
    const normalFeatures: CamIcuFeatures = {
      acute_onset_or_fluctuating: false,
      inattention_errors: 1, // <= 2 is normal
      current_rass: 0,
      disorganized_thinking_errors: 0
    };
    const negCamResult = IcuRoundingService.evaluateCamIcu(normalFeatures);
    assert(negCamResult.delirium_status === 'NEGATIVE', 'CAM-ICU: Negative when no acute onset and normal attention');
    assert(negCamResult.subtype === 'NONE', 'CAM-ICU: Subtype NONE for negative delirium');

    // 4. CAM-ICU Evaluation: Positive Hyperactive Delirium
    const hyperFeatures: CamIcuFeatures = {
      acute_onset_or_fluctuating: true,
      inattention_errors: 4, // > 2 errors = abnormal
      current_rass: 2, // Agitated (+2)
      disorganized_thinking_errors: 2
    };
    const hyperResult = IcuRoundingService.evaluateCamIcu(hyperFeatures);
    assert(hyperResult.delirium_status === 'POSITIVE', 'CAM-ICU: Positive delirium correctly identified');
    assert(hyperResult.subtype === 'HYPERACTIVE', 'CAM-ICU: RASS +2 categorized as HYPERACTIVE');
    assert(hyperResult.interventions.some(i => i.includes('Dexmedetomidine')), 'CAM-ICU: Agitation management recommends dexmedetomidine');

    // 5. CAM-ICU Evaluation: Positive Hypoactive Delirium
    const hypoFeatures: CamIcuFeatures = {
      acute_onset_or_fluctuating: true,
      inattention_errors: 5,
      current_rass: -2, // Lightly sedated/hypoactive (-2)
      disorganized_thinking_errors: 3
    };
    const hypoResult = IcuRoundingService.evaluateCamIcu(hypoFeatures);
    assert(hypoResult.delirium_status === 'POSITIVE', 'CAM-ICU: Positive hypoactive delirium detected');
    assert(hypoResult.subtype === 'HYPOACTIVE', 'CAM-ICU: RASS -2 categorized as HYPOACTIVE');

    // 6. CAM-ICU Evaluation: Deep Sedation / Coma (Unassessable)
    const comaFeatures: CamIcuFeatures = {
      acute_onset_or_fluctuating: true,
      inattention_errors: 10,
      current_rass: -4, // Deep sedation
      disorganized_thinking_errors: 5
    };
    const comaResult = IcuRoundingService.evaluateCamIcu(comaFeatures);
    assert(comaResult.delirium_status === 'UNASSESSABLE_COMA', 'CAM-ICU: RASS -4 flagged as UNASSESSABLE_COMA');

    // 7. CAM-ICU with QTc Safety Interlock Alert
    const qtcAlertResult = IcuRoundingService.evaluateCamIcu(hyperFeatures, 525, 440);
    assert(qtcAlertResult.qtc_alert === true, 'CAM-ICU QTc Alert: Flagged true for QTc 525 ms (> 500 ms)');
    assert(qtcAlertResult.antipsychotic_safety_warning !== undefined, 'CAM-ICU QTc Alert: Safety warning present');
    assert(qtcAlertResult.antipsychotic_safety_warning!.includes('CONTRAINDICATED: Haloperidol'), 'CAM-ICU QTc Alert: Haloperidol contraindication emphasized');

    // 8. CAM-ICU with Significant Delta QTc (+65 ms)
    const deltaQtcResult = IcuRoundingService.evaluateCamIcu(hyperFeatures, 485, 420);
    assert(deltaQtcResult.qtc_alert === true, 'CAM-ICU QTc Alert: Delta QTc +65 ms flagged alert');
    assert(deltaQtcResult.antipsychotic_safety_warning!.includes('SIGNIFICANT QTc DELTA'), 'CAM-ICU QTc Alert: Delta warning issued');

    // 9. Invasive Device: Foley Catheter > 48h without indication
    const foleyResult = IcuRoundingService.evaluateDevice({
      device_type: 'foley_urinary_catheter',
      insertion_timestamp: new Date(Date.now() - 3.5 * 24 * 3600 * 1000).toISOString(),
      device_days: 3.5,
      daily_indication_present: false,
      infection_bundle_compliant: true
    });
    assert(foleyResult.removal_recommended === true, 'Device Foley: Removal recommended when days > 2 and no indication');
    assert(foleyResult.infection_risk_level === 'HIGH', 'Device Foley: Risk level HIGH for unindicated prolonged Foley');
    assert(foleyResult.actionable_guidance.some(g => g.includes('Immediate removal recommended to prevent CAUTI')), 'Device Foley: CAUTI prevention guidance generated');

    // 10. Invasive Device: Foley with active indication
    const foleyIndicated = IcuRoundingService.evaluateDevice({
      device_type: 'foley_urinary_catheter',
      insertion_timestamp: new Date().toISOString(),
      device_days: 1.0,
      daily_indication_present: true,
      infection_bundle_compliant: true
    });
    assert(foleyIndicated.removal_recommended === false, 'Device Foley: Removal not recommended when day 1 with indication');
    assert(foleyIndicated.infection_risk_level === 'LOW', 'Device Foley: Risk level LOW for early catheter');

    // 11. Invasive Device: Central Venous Catheter > 7 days
    const cvcResult = IcuRoundingService.evaluateDevice({
      device_type: 'central_venous_catheter',
      insertion_timestamp: new Date().toISOString(),
      device_days: 8.5,
      daily_indication_present: false,
      infection_bundle_compliant: true
    });
    assert(cvcResult.removal_recommended === true, 'Device CVC: Removal recommended at 8.5 days without indication');
    assert(cvcResult.infection_risk_level === 'HIGH', 'Device CVC: High CLABSI risk identified');

    // 12. Invasive Device: Mechanical Ventilation (ETT)
    const ettResult = IcuRoundingService.evaluateDevice({
      device_type: 'endotracheal_tube',
      insertion_timestamp: new Date().toISOString(),
      device_days: 3.0,
      daily_indication_present: true,
      infection_bundle_compliant: true
    });
    assert(ettResult.actionable_guidance.some(g => g.includes('VAP bundle surveillance active')), 'Device ETT: VAP bundle surveillance triggered at day 3');

    // 13. Database Operations: Insert Rounding Checklist
    // Ensure test patient exists
    const patientRes = await pool.query('SELECT id FROM patients LIMIT 1');
    const patientId = patientRes.rows.length > 0 ? patientRes.rows[0].id : 1;

    const savedChecklist = await IcuRoundingService.saveRoundingChecklist({
      patient_id: patientId,
      bed_number: 'ICU-BED-04B',
      fast_hug_bid_bundle: perfectBundle,
      compliance_score_percent: 100.0,
      cam_icu_delirium_status: 'NEGATIVE',
      cam_icu_subtype: 'NONE',
      qtc_interval_ms: 430,
      qtc_risk_alert: false,
      antimicrobial_timeout_due: false
    });
    assert(savedChecklist.id > 0, 'Database: Successfully inserted icu_rounding_checklist');
    assert(savedChecklist.bed_number === 'ICU-BED-04B', 'Database: Bed number matches inserted record');
    assert(Number(savedChecklist.compliance_score_percent) === 100.0, 'Database: Compliance score matches');

    // 14. Database Operations: Insert Invasive Device Tracker
    const savedDevice = await IcuRoundingService.trackInvasiveDevice({
      patient_id: patientId,
      device_type: 'foley_urinary_catheter',
      insertion_timestamp: new Date().toISOString(),
      device_days: 3.5,
      daily_indication_present: false,
      infection_bundle_compliant: true,
      removal_recommended: true
    });
    assert(savedDevice.id > 0, 'Database: Successfully inserted invasive_device_tracker');
    assert(savedDevice.device_type === 'foley_urinary_catheter', 'Database: Device type matches');
    assert(savedDevice.removal_recommended === true, 'Database: Removal recommended boolean preserved');

    // 15. Database Operations: Retrieve Patient History
    const history = await IcuRoundingService.getPatientRoundingHistory(patientId);
    assert(history.checklists.length > 0, 'Database: Successfully retrieved checklists history');
    assert(history.devices.length > 0, 'Database: Successfully retrieved devices history');

  } catch (err) {
    console.error('Test suite error:', err);
    failed++;
  } finally {
    console.log(`\n--- TEST RUN FINISHED: ${passed} PASSED, ${failed} FAILED ---`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
