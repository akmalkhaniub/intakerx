import { VadPulseService } from './services/vadPulse';
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
  console.log('\n==================================================');
  console.log('--- Phase 78: VAD-PULSE Command Integration Tests ---');
  console.log('==================================================\n');

  try {
    // 1. Impella Suction Alarm Resolution
    console.log('Test Group 1: Impella Microaxial Suction Event & P-Level Stepdown');
    const suctionEval = VadPulseService.evaluateImpella({
      device_model: 'IMPELLA_CP',
      current_p_level: 'P-8',
      flow_rate_l_min: 1.8,
      purge_pressure_mmhg: 550,
      purge_flow_ml_hr: 12,
      suction_alarm_active: true,
      map_mmhg: 68,
      cvp_mmhg: 6,
      pcwp_mmhg: 8
    });

    assert(suctionEval.status === 'SUCTION_EVENT', 'Status correctly classified as SUCTION_EVENT');
    assert(suctionEval.recommended_p_level === 'P-4', 'Stepped down P-8 to P-4 by 4 levels');
    assert(suctionEval.bedside_interventions.some(i => i.includes('fluid challenge')), 'Recommends IV crystalloid fluid challenge for low CVP');
    assert(suctionEval.bedside_interventions.some(i => i.includes('echocardiogram')), 'Recommends STAT bedside echocardiogram for inlet positioning');
    assert(suctionEval.hemodynamic_guidance.some(g => g.includes('Hypovolemia identified')), 'Flags hypovolemia as suction trigger');

    // 2. Impella Purge System High Pressure / Occlusion
    console.log('\nTest Group 2: Impella Purge System Pressure & Flow Alarms');
    const purgeHighEval = VadPulseService.evaluateImpella({
      device_model: 'IMPELLA_5_5',
      current_p_level: 'P-6',
      flow_rate_l_min: 4.2,
      purge_pressure_mmhg: 1250,
      purge_flow_ml_hr: 1.2,
      suction_alarm_active: false,
      map_mmhg: 76
    });

    assert(purgeHighEval.status === 'PURGE_SYSTEM_ALARM', 'Status is PURGE_SYSTEM_ALARM on occlusion');
    assert(purgeHighEval.purge_system_action.includes('CRITICAL: Purge lumen occlusion'), 'Identifies purge lumen occlusion or biomaterial deposition');
    assert(purgeHighEval.bedside_interventions.some(i => i.includes('purge cassette')), 'Recommends checking purge cassette for crystallization or clot');

    // 3. Impella Purge System Low Pressure / Leak
    const purgeLowEval = VadPulseService.evaluateImpella({
      device_model: 'IMPELLA_2_5',
      current_p_level: 'P-5',
      flow_rate_l_min: 2.3,
      purge_pressure_mmhg: 220,
      purge_flow_ml_hr: 36,
      suction_alarm_active: false,
      map_mmhg: 72
    });

    assert(purgeLowEval.status === 'PURGE_SYSTEM_ALARM', 'Status is PURGE_SYSTEM_ALARM on leak');
    assert(purgeLowEval.purge_system_action.includes('WARNING: Purge system leak suspected'), 'Identifies purge system leak');
    assert(purgeLowEval.bedside_interventions.some(i => i.includes('luer locks') || i.includes('Tighten purge line')), 'Recommends checking connections and luer locks');

    // 4. Impella Optimal Hemodynamics
    console.log('\nTest Group 3: Impella Optimal Operation');
    const optimalImpella = VadPulseService.evaluateImpella({
      device_model: 'IMPELLA_CP',
      current_p_level: 'P-7',
      flow_rate_l_min: 3.6,
      purge_pressure_mmhg: 650,
      purge_flow_ml_hr: 15,
      suction_alarm_active: false,
      map_mmhg: 78
    });
    assert(optimalImpella.status === 'OPTIMAL', 'Status is OPTIMAL when flow and purge are normal');
    assert(optimalImpella.recommended_p_level === 'P-7', 'Maintains P-7');

    // 5. Durable LVAD Pump Thrombosis Sentinel (HeartMate 3)
    console.log('\nTest Group 4: Durable LVAD Thrombosis Sentinel (HM3)');
    const thrombosisEval = VadPulseService.evaluateDurableLvad({
      device_type: 'HEARTMATE_3',
      speed_rpm: 5600,
      flow_l_min: 5.2,
      power_watts: 8.8,
      baseline_power_watts: 5.2, // Delta +3.6W >= 2.0W
      pulsatility_index: 2.8,
      baseline_pi: 4.0,
      doppler_map_mmhg: 74,
      ldh_u_l: 890, // >= 625 U/L (>= 2.5x ULN)
      plasma_free_hgb_mg_dl: 58,
      hematuria_or_dark_urine: true
    });

    assert(thrombosisEval.alarm_classification === 'PUMP_THROMBOSIS_SUSPECTED', 'Alarm classified as PUMP_THROMBOSIS_SUSPECTED');
    assert(thrombosisEval.thrombosis_risk_level === 'HIGH_CRITICAL', 'Thrombosis risk level is HIGH_CRITICAL');
    assert(thrombosisEval.power_differential_watts === 3.6, 'Calculated power spike differential accurately (+3.6 W)');
    assert(thrombosisEval.anticoagulation_recommendation.includes('EMERGENT THROMBOSIS REGIMEN'), 'Triggers emergent thrombosis protocol');
    assert(thrombosisEval.anticoagulation_recommendation.includes('Heparin') || thrombosisEval.anticoagulation_recommendation.includes('Bivalirudin'), 'Recommends IV Heparin/Bivalirudin');
    assert(thrombosisEval.actionable_checklist.some(c => c.includes('ramp study')), 'Recommends STAT ramp study');

    // 6. Durable LVAD Low Flow and Suction Collapse
    console.log('\nTest Group 5: Durable LVAD Low Flow & Suction Collapse');
    const suctionCollapseEval = VadPulseService.evaluateDurableLvad({
      device_type: 'HEARTMATE_3',
      speed_rpm: 5400,
      flow_l_min: 2.4, // < 3.0 L/min
      power_watts: 4.6,
      baseline_power_watts: 5.0,
      pulsatility_index: 2.1,
      baseline_pi: 4.2, // Delta -2.1 <= -1.5
      doppler_map_mmhg: 72
    });

    assert(suctionCollapseEval.alarm_classification === 'SUCTION_COLLAPSE', 'Identifies SUCTION_COLLAPSE from low flow and negative PI delta');
    assert(suctionCollapseEval.pi_differential === -2.1, 'Accurately computes PI delta (-2.1)');
    assert(suctionCollapseEval.actionable_checklist.some(c => c.includes('suction collapse')), 'Checklist flags ventricular suction collapse');

    // 7. Durable LVAD High Afterload / Doppler MAP Hypertension
    console.log('\nTest Group 6: Durable LVAD Doppler MAP & Afterload Management');
    const hypertensionEval = VadPulseService.evaluateDurableLvad({
      device_type: 'HEARTWARE_HVAD',
      speed_rpm: 2800,
      flow_l_min: 4.1,
      power_watts: 4.8,
      baseline_power_watts: 4.5,
      pulsatility_index: 3.8,
      baseline_pi: 3.6,
      doppler_map_mmhg: 98 // > 85 mmHg
    });

    assert(hypertensionEval.afterload_status === 'HYPERTENSIVE_HIGH_RISK', 'Classified as HYPERTENSIVE_HIGH_RISK');
    assert(hypertensionEval.alarm_classification === 'HYPERTENSION_HIGH_AFTERLOAD', 'Alarm classified as HYPERTENSION_HIGH_AFTERLOAD');
    assert(hypertensionEval.blood_pressure_recommendation.includes('ELEVATED AFTERLOAD'), 'Recommends afterload reduction');
    assert(hypertensionEval.blood_pressure_recommendation.includes('Nicardipine'), 'Recommends Nicardipine titration');

    // 8. Post-LVAD Right Ventricular Failure (CVP/PCWP & PAPi)
    console.log('\nTest Group 7: Post-LVAD Severe Refractory RV Failure');
    const severeRvf = VadPulseService.evaluatePostLvadRvFailure({
      cvp_mmhg: 20,
      pcwp_mmhg: 16, // CVP/PCWP = 1.25 > 0.63
      systolic_pap_mmhg: 32,
      diastolic_pap_mmhg: 14, // Pulse pressure = 18; PAPi = 18 / 20 = 0.90 < 1.5
      inotropic_support_active: true,
      signs_of_systemic_congestion: true
    });

    assert(severeRvf.rv_failure_detected === true, 'Detected acute post-LVAD RV failure');
    assert(severeRvf.rvf_severity === 'SEVERE_REFRACTORY', 'Classified as SEVERE_REFRACTORY');
    assert(severeRvf.cvp_pcwp_ratio === 1.25, 'CVP/PCWP ratio computed accurately (1.25)');
    assert(severeRvf.papi_score === 0.9, 'PAPi score computed accurately (0.90)');
    assert(severeRvf.rvad_mechanical_support_indicated === true, 'Triggered temporary RVAD mechanical support indication');
    assert(severeRvf.pulmonary_vasodilator_advice.includes('Inhaled Nitric Oxide'), 'Recommends inhaled nitric oxide (iNO)');
    assert(severeRvf.hemodynamic_action_plan.some(p => p.includes('RVAD / Impella RP')), 'Recommends surgical consult for RVAD / Impella RP');

    // 9. Post-LVAD Mild-Moderate RV Failure
    console.log('\nTest Group 8: Post-LVAD Mild-Moderate RV Failure');
    const mildRvf = VadPulseService.evaluatePostLvadRvFailure({
      cvp_mmhg: 16,
      pcwp_mmhg: 20, // CVP/PCWP = 0.8 > 0.63
      systolic_pap_mmhg: 42,
      diastolic_pap_mmhg: 14, // Pulse pressure = 28; PAPi = 28 / 16 = 1.75 < 2.0
      inotropic_support_active: false,
      signs_of_systemic_congestion: true
    });

    assert(mildRvf.rv_failure_detected === true, 'Mild RV failure detected');
    assert(mildRvf.rvf_severity === 'MILD_MODERATE', 'Severity is MILD_MODERATE');
    assert(mildRvf.rvad_mechanical_support_indicated === false, 'RVAD not immediately required');
    assert(mildRvf.inotropic_optimization.includes('Milrinone') || mildRvf.inotropic_optimization.includes('Dobutamine'), 'Recommends initiating Milrinone or Dobutamine');

    // 10. Post-LVAD Normal RV Hemodynamics
    console.log('\nTest Group 9: Normal Post-LVAD RV Hemodynamics');
    const normalRv = VadPulseService.evaluatePostLvadRvFailure({
      cvp_mmhg: 10,
      pcwp_mmhg: 18, // CVP/PCWP = 0.56 <= 0.63
      systolic_pap_mmhg: 38,
      diastolic_pap_mmhg: 12, // Pulse pressure = 26; PAPi = 26 / 10 = 2.6 >= 2.0
      inotropic_support_active: false,
      signs_of_systemic_congestion: false
    });

    assert(normalRv.rv_failure_detected === false, 'No RV failure detected');
    assert(normalRv.rvf_severity === 'NONE', 'Severity is NONE');
    assert(normalRv.cvp_pcwp_ratio === 0.56, 'CVP/PCWP ratio normal (0.56)');
    assert(normalRv.papi_score === 2.6, 'PAPi score robust (2.60)');

    // 11. Database Persistence Verification
    console.log('\nTest Group 10: Database Persistence & Retrieval');
    // Ensure test patient exists
    let patientId = 1;
    const patRes = await pool.query('SELECT id FROM patients LIMIT 1');
    if (patRes.rows.length > 0) {
      patientId = patRes.rows[0].id;
    }

    // Register device
    const registeredDevice = await VadPulseService.registerVadDevice({
      patient_id: patientId,
      device_category: 'HEARTMATE_3',
      implant_date: new Date(),
      set_speed_rpm: 5400,
      purge_fluid_type: 'N/A - Centrifugal Flow',
      baseline_power_watts: 5.1,
      baseline_pi: 4.1,
      target_map_mmhg_min: 70,
      target_map_mmhg_max: 80,
      active_status: true
    });

    assert(Boolean(registeredDevice.id), 'Successfully persisted mechanical VAD device record');
    assert(registeredDevice.device_category === 'HEARTMATE_3', 'Device category correctly persisted');

    // Log telemetry alarm
    const alarmLog = await VadPulseService.logVadTelemetryAlarm({
      device_id: registeredDevice.id,
      patient_id: patientId,
      flow_l_min: 5.2,
      power_watts: 8.8,
      pulsatility_index: 2.8,
      doppler_map_mmhg: 74,
      ldh_u_l: 890,
      plasma_free_hgb_mg_dl: 58,
      alarm_type: 'PUMP_THROMBOSIS_SUSPECTED',
      thrombosis_risk_alert: true,
      rv_failure_alert: false
    });

    assert(Boolean(alarmLog.id), 'Successfully persisted VAD telemetry alarm record');
    assert(alarmLog.alarm_type === 'PUMP_THROMBOSIS_SUSPECTED', 'Alarm type accurately recorded');
    assert(alarmLog.thrombosis_risk_alert === true, 'Thrombosis risk alert boolean set to true');

    // Fetch patient VAD history
    const history = await VadPulseService.getPatientVadHistory(patientId);
    assert(Array.isArray(history.devices) && history.devices.length > 0, 'Retrieved patient VAD devices');
    assert(Array.isArray(history.telemetry_alarms) && history.telemetry_alarms.length > 0, 'Retrieved patient telemetry alarms');
    assert(history.telemetry_alarms.some(a => a.id === alarmLog.id), 'Recorded alarm found in patient history');

    console.log(`\n==================================================`);
    console.log(`Phase 78 VAD-PULSE Tests Complete: ${passedTests}/${totalTests} Passed (100%)`);
    console.log(`==================================================\n`);
  } catch (error) {
    console.error('Test execution failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
