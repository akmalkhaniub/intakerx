import { CellularImmunotherapyService } from './services/cellularImmunotherapy';

async function runTests() {
  console.log('--- STARTING PHASE 69 CELLULAR IMMUNOTHERAPY & CAR-T INTEGRATION TESTS ---');
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
    // Test 1: CRS Grade 0 (No fever)
    const crs0 = CellularImmunotherapyService.evaluateCrs({
      temperature_celsius: 37.4,
      systolic_bp_mmhg: 120,
      vasopressors_required: 'none',
      fio2_oxygen_delivery: 'room_air'
    });
    assert(crs0.crs_grade === 'Grade_0', 'CRS: Grade 0 when afebrile');

    // Test 2: CRS Grade 1 (Fever alone)
    const crs1 = CellularImmunotherapyService.evaluateCrs({
      temperature_celsius: 38.8,
      systolic_bp_mmhg: 115,
      vasopressors_required: 'none',
      fio2_oxygen_delivery: 'room_air'
    });
    assert(crs1.crs_grade === 'Grade_1', 'CRS: Grade 1 with fever alone');
    assert(crs1.clinical_management.some(m => m.includes('Supportive care')), 'Grade 1 supportive management');

    // Test 3: CRS Grade 2 (Fever + low-flow NC)
    const crs2 = CellularImmunotherapyService.evaluateCrs({
      temperature_celsius: 39.1,
      systolic_bp_mmhg: 105,
      vasopressors_required: 'none',
      fio2_oxygen_delivery: 'low_flow_nasal_cannula'
    });
    assert(crs2.crs_grade === 'Grade_2', 'CRS: Grade 2 with fever and nasal cannula');
    assert(crs2.clinical_management.some(m => m.includes('Tocilizumab')), 'Grade 2 recommends Tocilizumab');

    // Test 4: CRS Grade 3 (Fever + single vasopressor)
    const crs3 = CellularImmunotherapyService.evaluateCrs({
      temperature_celsius: 39.4,
      systolic_bp_mmhg: 85,
      vasopressors_required: 'single_low_dose',
      fio2_oxygen_delivery: 'low_flow_nasal_cannula'
    });
    assert(crs3.crs_grade === 'Grade_3', 'CRS: Grade 3 with single pressor requirement');
    assert(crs3.clinical_management.some(m => m.includes('Dexamethasone')), 'Grade 3 includes Dexamethasone');

    // Test 5: CRS Grade 4 (Fever + multiple vasopressors / vent)
    const crs4 = CellularImmunotherapyService.evaluateCrs({
      temperature_celsius: 40.1,
      systolic_bp_mmhg: 75,
      vasopressors_required: 'multiple_or_high_dose',
      fio2_oxygen_delivery: 'positive_pressure_vent'
    });
    assert(crs4.crs_grade === 'Grade_4', 'CRS: Grade 4 with multi-pressor and ventilator support');

    // Test 6: ICANS Grade 0 (Normal ICE 10/10)
    const icans0 = CellularImmunotherapyService.evaluateIcans({
      ice_score: 10,
      depressed_consciousness: 'alert',
      motor_findings: 'none',
      elevated_icp_papilledema: false
    });
    assert(icans0.icans_grade === 'Grade_0', 'ICANS: Grade 0 with normal ICE 10/10');

    // Test 7: ICANS Grade 1 (ICE 8)
    const icans1 = CellularImmunotherapyService.evaluateIcans({
      ice_score: 8,
      depressed_consciousness: 'alert',
      motor_findings: 'none',
      elevated_icp_papilledema: false
    });
    assert(icans1.icans_grade === 'Grade_1', 'ICANS: Grade 1 with ICE 8');

    // Test 8: ICANS Grade 2 (ICE 5, awakens to voice)
    const icans2 = CellularImmunotherapyService.evaluateIcans({
      ice_score: 5,
      depressed_consciousness: 'awakens_to_voice',
      motor_findings: 'none',
      elevated_icp_papilledema: false
    });
    assert(icans2.icans_grade === 'Grade_2', 'ICANS: Grade 2 with ICE 5');

    // Test 9: ICANS Grade 3 (ICE 1)
    const icans3 = CellularImmunotherapyService.evaluateIcans({
      ice_score: 1,
      depressed_consciousness: 'awakens_only_to_tactile',
      motor_findings: 'mild_tremor',
      elevated_icp_papilledema: false
    });
    assert(icans3.icans_grade === 'Grade_3', 'ICANS: Grade 3 with ICE 1');

    // Test 10: ICANS Grade 4 (Coma / Status epilepticus / Papilledema)
    const icans4 = CellularImmunotherapyService.evaluateIcans({
      ice_score: 0,
      depressed_consciousness: 'unresponsive_or_coma',
      motor_findings: 'status_epilepticus_or_paresis',
      elevated_icp_papilledema: true
    });
    assert(icans4.icans_grade === 'Grade_4', 'ICANS: Grade 4 with status epilepticus and papilledema');
    assert(icans4.clinical_management.some(m => m.includes('Methylprednisolone 1000 mg')), 'Grade 4 pulse steroids recommended');

    // Test 11: HScore - Severe Secondary HLH/MAS Trigger (Score >= 169)
    const hscoreSevere = CellularImmunotherapyService.calculateHScore({
      temperature_celsius: 39.8, // 49 pts
      organomegaly: 'both', // 38 pts
      cytopenias_lineages: 3, // 34 pts
      ferritin_ng_ml: 12500, // 50 pts
      triglycerides_mg_dl: 420, // 64 pts
      fibrinogen_mg_dl: 180, // 30 pts
      ast_u_l: 85 // 19 pts (Total: 284)
    });
    assert(hscoreSevere.total_hscore >= 169, `HScore ${hscoreSevere.total_hscore} >= 169`);
    assert(hscoreSevere.hlh_suspected === true, 'Secondary HLH/MAS triggered');
    assert(hscoreSevere.interventions.some(i => i.includes('Anakinra')), 'Anakinra IL-1 antagonist protocol triggered');

    // Test 12: HScore - Low Risk
    const hscoreLow = CellularImmunotherapyService.calculateHScore({
      temperature_celsius: 37.8,
      organomegaly: 'none',
      cytopenias_lineages: 1,
      ferritin_ng_ml: 450,
      triglycerides_mg_dl: 110,
      fibrinogen_mg_dl: 320,
      ast_u_l: 22
    });
    assert(hscoreLow.hlh_suspected === false, 'HScore low risk not suspected for HLH');

    // Test 13: DB Persistence - Record CAR-T Case
    const cartCase = await CellularImmunotherapyService.recordCartCase({
      patient_id: 1,
      product_name: 'Tisagenlecleucel (Kymriah)',
      infusion_date: '2026-10-01',
      crs_grade: 'Grade_3',
      icans_grade: 'Grade_2',
      ice_neuro_score: 5,
      hscore_hlh_risk: 145.0,
      tocilizumab_doses_given: 2,
      dexamethasone_active: true
    });
    assert(Boolean(cartCase.id), 'DB: CAR-T case recorded with ID');
    assert(cartCase.product_name === 'Tisagenlecleucel (Kymriah)', 'DB: Product name preserved');

    // Test 14: DB Persistence - Record CRS Event
    const crsEvent = await CellularImmunotherapyService.recordCrsEvent({
      case_id: cartCase.id,
      temperature_celsius: 39.4,
      systolic_bp_mmhg: 84,
      vasopressor_required: true,
      fio2_oxygen_requirement: 0.40,
      ferritin_ng_ml: 8200,
      il6_pg_ml: 1250,
      crp_mg_dl: 18.5,
      intervention_administered: 'Tocilizumab 8 mg/kg IV #2 + Dexamethasone 10 mg IV'
    });
    assert(Boolean(crsEvent.id), 'DB: CRS event recorded with ID');

    // Test 15: DB Persistence - Retrieve Patient Profile
    const profile = await CellularImmunotherapyService.getPatientCartProfile(1);
    assert(profile.cases.length > 0, 'DB: Retrieved CAR-T cases for patient 1');
    assert(profile.events.length > 0, 'DB: Retrieved CRS events for patient 1');

    console.log(`\nPHASE 69 SUMMARY: ${passed} passed, ${failed} failed.`);
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
