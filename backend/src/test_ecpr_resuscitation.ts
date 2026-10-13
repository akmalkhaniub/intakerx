import { EcprResuscitationService } from './services/ecprResuscitation';

async function runTests() {
  console.log('--- STARTING PHASE 70 E-CPR RESUSCITATION & TTM INTEGRATION TESTS ---');
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
    // Test 1: Inclusion Criteria Met (Witnessed, no-flow 2m, shockable VF, EtCO2 18, age 48)
    const eligibleCase = EcprResuscitationService.evaluateInclusionCriteria({
      patient_age_years: 48,
      arrest_witnessed: true,
      no_flow_time_minutes: 2,
      bystander_cpr_minutes: 15,
      initial_rhythm: 'VF',
      end_tidal_co2_mmhg: 18
    });
    assert(eligibleCase.inclusion_criteria_met === true, 'E-CPR: Candidate meets all ELSO criteria');
    assert(eligibleCase.recommendation.includes('STAT E-CPR ACTIVATION'), 'E-CPR: STAT activation recommendation returned');

    // Test 2: Unwitnessed Arrest Exclusion
    const unwitnessedCase = EcprResuscitationService.evaluateInclusionCriteria({
      patient_age_years: 52,
      arrest_witnessed: false,
      no_flow_time_minutes: 0,
      bystander_cpr_minutes: 10,
      initial_rhythm: 'VF',
      end_tidal_co2_mmhg: 20
    });
    assert(unwitnessedCase.inclusion_criteria_met === false, 'E-CPR: Unwitnessed arrest excluded');
    assert(unwitnessedCase.contraindications.some(c => c.includes('Unwitnessed arrest')), 'Unwitnessed contraindication logged');

    // Test 3: Prolonged No-Flow Exclusion (>5m)
    const prolongedNoFlow = EcprResuscitationService.evaluateInclusionCriteria({
      patient_age_years: 55,
      arrest_witnessed: true,
      no_flow_time_minutes: 8,
      bystander_cpr_minutes: 12,
      initial_rhythm: 'VF',
      end_tidal_co2_mmhg: 16
    });
    assert(prolongedNoFlow.inclusion_criteria_met === false, 'E-CPR: No-flow > 5m excluded');

    // Test 4: Age > 65 Exclusion
    const elderlyCase = EcprResuscitationService.evaluateInclusionCriteria({
      patient_age_years: 72,
      arrest_witnessed: true,
      no_flow_time_minutes: 1,
      bystander_cpr_minutes: 10,
      initial_rhythm: 'VF',
      end_tidal_co2_mmhg: 18
    });
    assert(elderlyCase.inclusion_criteria_met === false, 'E-CPR: Age > 65 excluded');

    // Test 5: Low EtCO2 Futile Perfusion Exclusion (<10 mmHg)
    const lowEtco2 = EcprResuscitationService.evaluateInclusionCriteria({
      patient_age_years: 45,
      arrest_witnessed: true,
      no_flow_time_minutes: 1,
      bystander_cpr_minutes: 20,
      initial_rhythm: 'VF',
      end_tidal_co2_mmhg: 6
    });
    assert(lowEtco2.inclusion_criteria_met === false, 'E-CPR: EtCO2 < 10 excluded');

    // Test 6: TTM Protocol - Induction Phase
    const ttmInduction = EcprResuscitationService.evaluateTtmProtocol({
      target_temperature_celsius: 33.0,
      current_core_temperature_celsius: 36.8,
      cooling_phase: 'induction',
      bsas_shivering_score: 0
    });
    assert(ttmInduction.cooling_phase === 'induction', 'TTM: Induction phase preserved');
    assert(ttmInduction.interventions.some(i => i.includes('Induction phase')), 'Induction cooling protocol returned');

    // Test 7: TTM Protocol - Maintenance Phase with Significant Shivering (BSAS >= 2)
    const ttmShivering = EcprResuscitationService.evaluateTtmProtocol({
      target_temperature_celsius: 33.0,
      current_core_temperature_celsius: 33.1,
      cooling_phase: 'maintenance',
      bsas_shivering_score: 2
    });
    assert(ttmShivering.bsas_shivering_score === 2, 'TTM: BSAS score 2 preserved');
    assert(ttmShivering.interventions.some(i => i.includes('SIGNIFICANT SHIVERING')), 'Significant shivering alert triggered');
    assert(ttmShivering.interventions.some(i => i.includes('Magnesium sulfate')), 'Magnesium and multi-tier suppression indicated');

    // Test 8: TTM Protocol - Rewarming Phase Rate Limit (0.25 C/hr)
    const ttmRewarming = EcprResuscitationService.evaluateTtmProtocol({
      target_temperature_celsius: 36.0,
      current_core_temperature_celsius: 34.5,
      cooling_phase: 'rewarming',
      bsas_shivering_score: 0
    });
    assert(ttmRewarming.rewarming_rate_c_per_hr === 0.25, 'TTM: Rewarming rate strictly limited to 0.25 C/hr');
    assert(ttmRewarming.interventions.some(i => i.includes('Controlled active rewarming')), 'Rewarming precautions generated');

    // Test 9: DB Persistence - Record E-CPR Case
    const ecprRecord = await EcprResuscitationService.recordEcprCase({
      patient_id: 1,
      arrest_witnessed: true,
      bystander_cpr_duration_minutes: 18,
      initial_rhythm: 'VF',
      end_tidal_co2_mmhg: 19.5,
      arterial_ph: 7.18,
      arterial_lactate_mmol_l: 8.4,
      cannulation_time_to_flow_minutes: 42,
      va_ecmo_flow_l_min: 3.8,
      target_temperature_celsius: 33.0,
      bsas_shivering_score: 1
    });
    assert(Boolean(ecprRecord.case.id), 'DB: E-CPR case saved with primary key');
    assert(ecprRecord.case.inclusion_criteria_met === true, 'DB: Inclusion criteria saved as true');

    // Test 10: DB Persistence - Record TTM Temperature Log
    const ttmLog = await EcprResuscitationService.recordTtmLog({
      case_id: ecprRecord.case.id,
      core_temperature_celsius: 33.0,
      cooling_phase: 'maintenance',
      shivering_suppression_agent: 'Magnesium sulfate 2g IV + Dexmedetomidine 0.5 mcg/kg/hr',
      rewarming_rate_c_per_hr: 0.25
    });
    assert(Boolean(ttmLog.id), 'DB: TTM log saved with primary key');

    // Test 11: DB Persistence - Retrieve Patient Profile
    const profile = await EcprResuscitationService.getPatientEcprProfile(1);
    assert(profile.cases.length > 0, 'DB: Retrieved E-CPR cases for patient 1');
    assert(profile.logs.length > 0, 'DB: Retrieved TTM logs for patient 1');

    console.log(`\nPHASE 70 SUMMARY: ${passed} passed, ${failed} failed.`);
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
