import { LiverSupportService } from './services/liverSupport';

async function runTests() {
  console.log('--- STARTING PHASE 65 LIVER SUPPORT / MARS INTEGRATION TESTS ---');
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
    // Test 1: Acetaminophen King's College - Arterial pH < 7.30 trigger
    const apapPhTest = LiverSupportService.evaluateKingsCollegeCriteria({
      etiology: 'Acetaminophen',
      arterial_ph: 7.24,
      inr: 4.2,
      serum_creatinine_mg_dl: 2.1,
      serum_bilirubin_mg_dl: 8.5,
      west_haven_he_grade: 'Grade_II'
    });
    assert(apapPhTest.criteria_met === true, 'APAP ALF: pH < 7.30 triggers criteria');
    assert(apapPhTest.criteria_triggers.some(t => t.includes('pH < 7.30')), 'APAP ALF: triggers contain pH message');

    // Test 2: Acetaminophen King's College - Triad of HE III/IV + INR > 6.5 + Creatinine > 3.4
    const apapTriadTest = LiverSupportService.evaluateKingsCollegeCriteria({
      etiology: 'Acetaminophen',
      arterial_ph: 7.35,
      inr: 7.1,
      serum_creatinine_mg_dl: 4.0,
      serum_bilirubin_mg_dl: 12.0,
      west_haven_he_grade: 'Grade_III'
    });
    assert(apapTriadTest.criteria_met === true, 'APAP ALF: Triad triggers transplant criteria');

    // Test 3: Acetaminophen King's College - High lactate trigger
    const apapLactateTest = LiverSupportService.evaluateKingsCollegeCriteria({
      etiology: 'Acetaminophen',
      arterial_ph: 7.34,
      inr: 3.5,
      serum_creatinine_mg_dl: 1.8,
      serum_bilirubin_mg_dl: 5.0,
      west_haven_he_grade: 'Grade_I',
      arterial_lactate_mmol_l: 4.2
    });
    assert(apapLactateTest.criteria_met === true, 'APAP ALF: Lactate > 3.5 mmol/L triggers criteria');

    // Test 4: Acetaminophen King's College - Negative (No criteria met)
    const apapNegativeTest = LiverSupportService.evaluateKingsCollegeCriteria({
      etiology: 'Acetaminophen',
      arterial_ph: 7.38,
      inr: 2.4,
      serum_creatinine_mg_dl: 1.5,
      serum_bilirubin_mg_dl: 6.2,
      west_haven_he_grade: 'Grade_I',
      arterial_lactate_mmol_l: 2.1
    });
    assert(apapNegativeTest.criteria_met === false, 'APAP ALF: Criteria not met in mild toxicity');

    // Test 5: Non-Acetaminophen King's College - INR > 6.5 primary rule
    const nonApapInrTest = LiverSupportService.evaluateKingsCollegeCriteria({
      etiology: 'Non-Acetaminophen',
      arterial_ph: 7.36,
      inr: 7.2,
      serum_creatinine_mg_dl: 1.6,
      serum_bilirubin_mg_dl: 12.0,
      west_haven_he_grade: 'Grade_II'
    });
    assert(nonApapInrTest.criteria_met === true, 'Non-APAP ALF: INR > 6.5 triggers criteria');

    // Test 6: Non-Acetaminophen King's College - 3 of 5 subcriteria (Age > 40, Jaundice > 7d, Bilirubin > 17.5)
    const nonApapSubcriteriaTest = LiverSupportService.evaluateKingsCollegeCriteria({
      etiology: 'Non-Acetaminophen',
      arterial_ph: 7.38,
      inr: 2.8,
      serum_creatinine_mg_dl: 1.2,
      serum_bilirubin_mg_dl: 22.4,
      west_haven_he_grade: 'Grade_II',
      patient_age_years: 52,
      duration_jaundice_to_encephalopathy_days: 14
    });
    assert(nonApapSubcriteriaTest.criteria_met === true, 'Non-APAP ALF: 3 of 5 criteria met');

    // Test 7: Non-Acetaminophen King's College - Negative
    const nonApapNegativeTest = LiverSupportService.evaluateKingsCollegeCriteria({
      etiology: 'Non-Acetaminophen',
      arterial_ph: 7.40,
      inr: 2.1,
      serum_creatinine_mg_dl: 1.0,
      serum_bilirubin_mg_dl: 9.0,
      west_haven_he_grade: 'Grade_0',
      patient_age_years: 28,
      duration_jaundice_to_encephalopathy_days: 3
    });
    assert(nonApapNegativeTest.criteria_met === false, 'Non-APAP ALF: Negative criteria');

    // Test 8: MARS Albumin Clearance - Successful Session (Bili >= 25%, NH3 >= 30%)
    const marsSuccessful = LiverSupportService.calculateMarsClearance({
      patient_id: 1,
      dialysis_system: 'MARS',
      prescribed_hours: 6.0,
      blood_flow_rate_ml_min: 150,
      albumin_dialysate_flow_ml_min: 150,
      initial_total_bilirubin_mg_dl: 20.0,
      final_total_bilirubin_mg_dl: 13.0, // 35% clearance
      initial_ammonia_umol_l: 160,
      final_ammonia_umol_l: 96 // 40% clearance
    });
    assert(marsSuccessful.target_clearance_achieved === true, 'MARS: Target clearance achieved');
    assert(marsSuccessful.bilirubin_clearance_percent === 35.0, 'MARS: Bilirubin clearance 35%');
    assert(marsSuccessful.ammonia_clearance_percent === 40.0, 'MARS: Ammonia clearance 40%');

    // Test 9: MARS Albumin Clearance - Suboptimal Session
    const marsSuboptimal = LiverSupportService.calculateMarsClearance({
      patient_id: 1,
      dialysis_system: 'MARS',
      prescribed_hours: 6.0,
      blood_flow_rate_ml_min: 150,
      albumin_dialysate_flow_ml_min: 150,
      initial_total_bilirubin_mg_dl: 20.0,
      final_total_bilirubin_mg_dl: 18.0, // 10% clearance
      initial_ammonia_umol_l: 160,
      final_ammonia_umol_l: 140 // 12.5% clearance
    });
    assert(marsSuboptimal.target_clearance_achieved === false, 'MARS: Suboptimal clearance flagged');

    // Test 10: Cerebral Edema Risk - Critical Risk (NH3 >= 200)
    const edemaCritical = LiverSupportService.evaluateCerebralEdemaRisk({
      patient_id: 1,
      serum_ammonia_umol_l: 220,
      west_haven_he_grade: 'Grade_III'
    });
    assert(edemaCritical.icp_elevation_risk === 'critical', 'Cerebral Edema: Critical risk with NH3 > 200');
    assert(edemaCritical.hyperosmolar_therapy_indicated === true, 'Cerebral Edema: Hyperosmolar therapy indicated');

    // Test 11: Cerebral Edema Risk - High Risk
    const edemaHigh = LiverSupportService.evaluateCerebralEdemaRisk({
      patient_id: 1,
      serum_ammonia_umol_l: 160,
      west_haven_he_grade: 'Grade_II'
    });
    assert(edemaHigh.icp_elevation_risk === 'high', 'Cerebral Edema: High risk with NH3 160');

    // Test 12: Cerebral Edema Risk - Low Risk
    const edemaLow = LiverSupportService.evaluateCerebralEdemaRisk({
      patient_id: 1,
      serum_ammonia_umol_l: 45,
      west_haven_he_grade: 'Grade_0'
    });
    assert(edemaLow.icp_elevation_risk === 'low', 'Cerebral Edema: Low risk with normal NH3');

    // Test 13: Database Persistence - Record MARS Session
    const dbMarsSession = await LiverSupportService.recordMarsSession({
      patient_id: 1,
      dialysis_system: 'MARS',
      prescribed_hours: 6.0,
      blood_flow_rate_ml_min: 180,
      albumin_dialysate_flow_ml_min: 160,
      initial_total_bilirubin_mg_dl: 24.5,
      final_total_bilirubin_mg_dl: 16.0,
      initial_ammonia_umol_l: 185,
      final_ammonia_umol_l: 110,
      session_status: 'completed'
    });
    assert(Boolean(dbMarsSession.session.id), 'DB: Recorded MARS session successfully with ID');
    assert(Number(dbMarsSession.session.initial_total_bilirubin_mg_dl) === 24.5, 'DB: Initial bilirubin verified');

    // Test 14: Database Persistence - Record ALF Case
    const dbAlfCase = await LiverSupportService.recordAlfCase({
      patient_id: 1,
      etiology: 'Acetaminophen',
      west_haven_he_grade: 'Grade_IV',
      inr: 7.4,
      total_bilirubin_mg_dl: 14.2,
      serum_creatinine_mg_dl: 4.1,
      arterial_ph: 7.22,
      arterial_lactate_mmol_l: 5.4,
      serum_ammonia_umol_l: 210
    });
    assert(Boolean(dbAlfCase.case.id), 'DB: Recorded ALF case successfully with ID');
    assert(dbAlfCase.case.kings_college_criteria_met === true, 'DB: King\'s College status recorded');
    assert(dbAlfCase.case.icp_elevation_risk === 'critical', 'DB: ICP elevation risk recorded as critical');

    // Test 15: Retrieve Patient Profile
    const profile = await LiverSupportService.getPatientLiverProfile(1);
    assert(profile.mars_sessions.length > 0, 'DB: Retrieved MARS sessions for patient 1');
    assert(profile.alf_cases.length > 0, 'DB: Retrieved ALF cases for patient 1');

    console.log(`\nPHASE 65 SUMMARY: ${passed} passed, ${failed} failed.`);
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
