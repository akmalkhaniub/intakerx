import {
  evaluateRutherfordClassification,
  evaluateCompartmentPressure,
  evaluateFreeFlapPerfusion,
  VascularLimbService
} from './services/vascularLimb';
import { pool } from './db';

async function runTests() {
  console.log('--- STARTING PHASE 72 VASCULAR-LIMB COMMAND INTEGRATION TESTS ---');
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
    // 1. Rutherford ALI Classification Tests
    // Category I: Viable
    const r1 = evaluateRutherfordClassification({
      limb_affected: 'Left Lower Extremity',
      sensory_loss: 'none',
      motor_deficit: 'none',
      arterial_doppler_audible: true,
      venous_doppler_audible: true
    });
    assert(r1.category === 'I', 'Rutherford: Category I Viable identified');
    assert(r1.thrombolysis_eligible, 'Rutherford: Category I eligible for catheter-directed therapy');
    assert(r1.urgency === 'ELECTIVE_URGENT', 'Rutherford: Category I urgency is elective/urgent');

    // Category IIa: Marginally Threatened
    const r2a = evaluateRutherfordClassification({
      limb_affected: 'Right Lower Extremity',
      sensory_loss: 'minimal_toes',
      motor_deficit: 'none',
      arterial_doppler_audible: false,
      venous_doppler_audible: true
    });
    assert(r2a.category === 'IIa', 'Rutherford: Category IIa Marginally Threatened identified');
    assert(r2a.recommended_intervention.includes('Thrombolysis'), 'Rutherford: Catheter-directed thrombolysis recommended for IIa');

    // Category IIa with thrombolysis contraindication
    const r2aContra = evaluateRutherfordClassification({
      limb_affected: 'Right Lower Extremity',
      sensory_loss: 'minimal_toes',
      motor_deficit: 'none',
      arterial_doppler_audible: false,
      venous_doppler_audible: true,
      active_bleeding_within_10_days: true
    });
    assert(!r2aContra.thrombolysis_eligible, 'Rutherford: Active bleeding contraindicates thrombolysis');
    assert(r2aContra.recommended_intervention.includes('Surgical Thromboembolectomy'), 'Rutherford: Surgical revascularization selected when CDT contraindicated');

    // Category IIb: Immediately Threatened
    const r2b = evaluateRutherfordClassification({
      limb_affected: 'Left Lower Extremity',
      sensory_loss: 'rest_pain_forefoot',
      motor_deficit: 'mild_toe_weakness',
      arterial_doppler_audible: false,
      venous_doppler_audible: true
    });
    assert(r2b.category === 'IIb', 'Rutherford: Category IIb Immediately Threatened identified');
    assert(r2b.urgency === 'EMERGENT_STAT', 'Rutherford: Category IIb requires emergent STAT intervention');
    assert(r2b.recommended_intervention.includes('Fogarty'), 'Rutherford: Fogarty surgical thromboembolectomy indicated');

    // Category III: Irreversible
    const r3 = evaluateRutherfordClassification({
      limb_affected: 'Right Lower Extremity',
      sensory_loss: 'profound_anesthetic',
      motor_deficit: 'paralysis_rigor',
      arterial_doppler_audible: false,
      venous_doppler_audible: false
    });
    assert(r3.category === 'III', 'Rutherford: Category III Irreversible identified');
    assert(r3.urgency === 'PALLIATIVE_AMPUTATION', 'Rutherford: Category III urgency is amputation/palliative');
    assert(r3.recommended_intervention.includes('reperfusion hyperkalemia'), 'Rutherford: Reperfusion injury wash-in warning provided');

    // 2. Compartment Pressure & Delta-P Watchdog Tests
    // Normal compartment pressure
    const compNormal = evaluateCompartmentPressure({
      compartment_name: 'anterior',
      measured_pressure_mmhg: 14.0,
      diastolic_bp_mmhg: 75.0
    });
    assert(!compNormal.fasciotomy_indicated, 'Compartment: Normal pressure does not trigger fasciotomy');
    assert(compNormal.delta_p_mmhg === 61.0, 'Compartment: Delta-P accurately calculated (61 mmHg)');
    assert(compNormal.alert_level === 'NORMAL', 'Compartment: Alert level NORMAL');

    // Critical compartment syndrome (Delta P <= 30 mmHg)
    const compCrit = evaluateCompartmentPressure({
      compartment_name: 'anterior',
      measured_pressure_mmhg: 38.0,
      diastolic_bp_mmhg: 62.0
    });
    assert(compCrit.fasciotomy_indicated, 'Compartment: Delta-P 24 mmHg triggers emergent fasciotomy');
    assert(compCrit.alert_level === 'CRITICAL_FASCIOTOMY_REQUIRED', 'Compartment: Alert level CRITICAL');
    assert(compCrit.surgical_directive.includes('4 lower extremity compartments'), 'Compartment: 4-compartment dual-incision directive included');
    assert(compCrit.rehabilitation_and_rhabdo_prevention.some(p => p.includes('alkalinization')), 'Compartment: Rhabdomyolysis alkalinization protocol generated');

    // 3. Microvascular Free-Flap Perfusion Tests
    // Healthy flap
    const flapHealthy = evaluateFreeFlapPerfusion({
      sto2_percent: 74,
      laser_doppler_flux_pu: 6.8,
      flap_color: 'pink',
      capillary_refill_seconds: 1.8,
      temp_difference_celsius: -0.4,
      pinprick_bleeding: 'normal_bright_red'
    });
    assert(flapHealthy.perfusion_status === 'HEALTHY', 'Free-Flap: Healthy flap verified');
    assert(flapHealthy.salvage_urgency === 'STABLE', 'Free-Flap: Salvage urgency STABLE');

    // Arterial Thrombosis
    const flapArterial = evaluateFreeFlapPerfusion({
      sto2_percent: 38,
      laser_doppler_flux_pu: 0.9,
      flap_color: 'pale',
      capillary_refill_seconds: 4.5,
      temp_difference_celsius: -3.2,
      pinprick_bleeding: 'absent_no_bleeding'
    });
    assert(flapArterial.perfusion_status === 'ARTERIAL_OCCLUSION', 'Free-Flap: Arterial occlusion detected');
    assert(flapArterial.salvage_urgency === 'STAT_OR_EXPLORATION', 'Free-Flap: STAT OR exploration indicated');
    assert(flapArterial.actions.some(a => a.includes('Heparin')), 'Free-Flap: IV Heparin bolus recommended');

    // Venous Congestion
    const flapVenous = evaluateFreeFlapPerfusion({
      sto2_percent: 42,
      laser_doppler_flux_pu: 3.1,
      flap_color: 'violaceous_purple',
      capillary_refill_seconds: 0.6,
      temp_difference_celsius: -1.5,
      pinprick_bleeding: 'brisk_dark_purple'
    });
    assert(flapVenous.perfusion_status === 'VENOUS_CONGESTION', 'Free-Flap: Venous congestion detected');
    assert(flapVenous.salvage_urgency === 'EMERGENT_SUTURE_RELEASE_LEECH', 'Free-Flap: Suture release & leech urgency flagged');
    assert(flapVenous.actions.some(a => a.includes('Hirudo medicinalis')), 'Free-Flap: Leech therapy protocol included');
    assert(flapVenous.actions.some(a => a.includes('Aeromonas hydrophila')), 'Free-Flap: Aeromonas prophylactic antibiotic coverage indicated');

    // 4. Database Vascular Limb Service Integration Tests
    // Create encounter
    const encResult = await VascularLimbService.evaluateAndSaveEncounter(1, {
      limb_affected: 'Right Lower Extremity',
      sensory_loss: 'rest_pain_forefoot',
      motor_deficit: 'mild_toe_weakness',
      arterial_doppler_audible: false,
      venous_doppler_audible: true
    });
    assert(encResult.encounter.id > 0, 'DB: Vascular encounter saved with primary key');
    assert(encResult.encounter.rutherford_category === 'IIb', 'DB: Category IIb saved in DB');

    // Log compartment pressure with flap monitoring
    const compLogResult = await VascularLimbService.logCompartmentPressure(
      encResult.encounter.id,
      {
        compartment_name: 'anterior',
        measured_pressure_mmhg: 36.0,
        diastolic_bp_mmhg: 64.0
      },
      {
        sto2_percent: 44,
        laser_doppler_flux_pu: 2.2,
        flap_color: 'violaceous_purple',
        capillary_refill_seconds: 0.8,
        temp_difference_celsius: -1.2,
        pinprick_bleeding: 'brisk_dark_purple'
      }
    );
    assert(compLogResult.log.id > 0, 'DB: Compartment pressure log saved with primary key');
    assert(compLogResult.compartment_evaluation.fasciotomy_indicated, 'DB: Fasciotomy evaluated in log');
    assert(compLogResult.free_flap_evaluation?.perfusion_status === 'VENOUS_CONGESTION', 'DB: Flap venous congestion logged');

    // Retrieve history
    const history = await VascularLimbService.getPatientVascularHistory(1);
    assert(history.encounters.length >= 1, 'DB: Retrieved vascular encounters for patient 1');
    assert(history.compartment_logs.length >= 1, 'DB: Retrieved compartment pressure logs for patient 1');

  } catch (err: any) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    console.log(`\nPHASE 72 SUMMARY: ${passed} passed, ${failed} failed.`);
    await pool.end();
    if (failed > 0) {
      process.exit(1);
    }
  }
}

runTests();
