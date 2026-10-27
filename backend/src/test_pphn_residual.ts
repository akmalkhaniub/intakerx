import {
  evaluatePphn,
  evaluateInoMonitoring,
  savePphnEvaluation,
  getPatientPphnEvaluations,
  saveInoLog,
  getPatientInoLogs,
  PphnEvaluationInput,
  InoMonitoringInput
} from './services/pphnResidual';
import { pool } from './db';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('=== RUNNING PPHN-RESIDUAL (PHASE 90) INTEGRATION & CLINICAL SAFETY TESTS ===\n');

  // TEST 1: Suprasystemic Severe PPHN with High OI (>20) - iNO Indicated & SVR Support
  console.log('[Test 1] Suprasystemic Severe PPHN with High OI & Right-to-Left Shunt');
  const case1: PphnEvaluationInput = {
    patientId: 901,
    gestationalAgeWeeks: 39,
    birthWeightGrams: 3400,
    etiology: 'MAS',
    paspMmhg: 75,
    systemicSbpMmhg: 60, // PASP > SBP (Suprasystemic 1.25)
    ductalShunt: 'PURE_RIGHT_TO_LEFT',
    foramenOvaleShunt: 'RIGHT_TO_LEFT',
    hasIvsFlatteningOrDShapedLv: true,
    meanAirwayPressureMmh2o: 18,
    fio2: 1.0, // 100%
    pao2Mmhg: 45, // OI = (18 * 1.0 * 100) / 45 = 40.0
    lactateMmolL: 4.8,
    ph: 7.22
  };
  const res1 = evaluatePphn(case1);
  assert(res1.pphnSeverity === 'SUPRASYSTEMIC_SEVERE', 'Identified as SUPRASYSTEMIC_SEVERE');
  assert(res1.paspSbpRatio === 1.25, `Calculated PASP/SBP ratio correctly: ${res1.paspSbpRatio}`);
  assert(res1.oxygenationIndex === 40, `Calculated OI correctly: ${res1.oxygenationIndex}`);
  assert(res1.inoIndicated === true, 'Inhaled Nitric Oxide (iNO) is indicated');
  assert(res1.inoDosePpm === 20, `Initial recommended iNO dose is 20 ppm: ${res1.inoDosePpm}`);
  assert(res1.ecmoEligibility.ecmoCriteriaMet === true, 'Meets ECMO criteria (OI >= 40)');
  assert(res1.ecmoEligibility.alertStatus === 'CRITICAL_ECMO_CANDIDATE', 'Flagged as CRITICAL_ECMO_CANDIDATE');
  assert(
    res1.adjunctiveTherapies.some(t => t.agent.includes('Norepinephrine') || t.agent.includes('Vasopressin')),
    'Recommends systemic vasoconstrictor (Norepinephrine/Vasopressin) to elevate SBP above PASP'
  );
  assert(
    res1.adjunctiveTherapies.some(t => t.agent.includes('Milrinone')),
    'Includes Milrinone for inodilator effect and RV afterload reduction'
  );

  // TEST 2: Isosystemic Moderate PPHN with Bidirectional Ductal Shunt
  console.log('\n[Test 2] Isosystemic Moderate PPHN with Bidirectional Shunting');
  const case2: PphnEvaluationInput = {
    patientId: 902,
    gestationalAgeWeeks: 38,
    birthWeightGrams: 3100,
    etiology: 'RDS',
    paspMmhg: 50,
    systemicSbpMmhg: 60, // PASP/SBP = 0.83
    ductalShunt: 'BIDIRECTIONAL',
    foramenOvaleShunt: 'LEFT_TO_RIGHT',
    hasIvsFlatteningOrDShapedLv: true,
    meanAirwayPressureMmh2o: 12,
    fio2: 0.60,
    pao2Mmhg: 60 // OI = (12 * 0.60 * 100) / 60 = 12.0
  };
  const res2 = evaluatePphn(case2);
  assert(res2.pphnSeverity === 'ISOSYSTEMIC_MODERATE', 'Correctly classified as ISOSYSTEMIC_MODERATE');
  assert(res2.oxygenationIndex === 12, `Calculated OI: ${res2.oxygenationIndex}`);
  assert(res2.inoIndicated === false, 'iNO not immediately indicated (OI < 15-20)');
  assert(res2.ecmoEligibility.ecmoCriteriaMet === false, 'ECMO criteria not met');

  // TEST 3: Subsystemic Mild PPHN
  console.log('\n[Test 3] Subsystemic Mild PPHN');
  const case3: PphnEvaluationInput = {
    patientId: 903,
    gestationalAgeWeeks: 40,
    birthWeightGrams: 3500,
    etiology: 'IDIOPATHIC',
    paspMmhg: 30,
    systemicSbpMmhg: 65, // PASP/SBP = 0.46
    ductalShunt: 'PURE_LEFT_TO_RIGHT',
    foramenOvaleShunt: 'LEFT_TO_RIGHT',
    hasIvsFlatteningOrDShapedLv: false,
    meanAirwayPressureMmh2o: 8,
    fio2: 0.35,
    pao2Mmhg: 80 // OI = (8 * 0.35 * 100) / 80 = 3.5
  };
  const res3 = evaluatePphn(case3);
  assert(res3.pphnSeverity === 'SUBSYSTEMIC_MILD', 'Correctly classified as SUBSYSTEMIC_MILD');
  assert(res3.inoIndicated === false, 'iNO not indicated');

  // TEST 4: ECMO Age & Weight Ineligibility Check
  console.log('\n[Test 4] ECMO Eligibility Criteria (Preterm & Low Birth Weight Guardrails)');
  const case4: PphnEvaluationInput = {
    patientId: 904,
    gestationalAgeWeeks: 32, // < 34 weeks (high intraventricular hemorrhage risk on heparin)
    birthWeightGrams: 1600, // < 2000g (cannula vascular limitation)
    etiology: 'RDS',
    paspMmhg: 70,
    systemicSbpMmhg: 50,
    ductalShunt: 'PURE_RIGHT_TO_LEFT',
    foramenOvaleShunt: 'RIGHT_TO_LEFT',
    hasIvsFlatteningOrDShapedLv: true,
    meanAirwayPressureMmh2o: 20,
    fio2: 1.0,
    pao2Mmhg: 40 // OI = 50
  };
  const res4 = evaluatePphn(case4);
  assert(res4.ecmoEligibility.eligibleByAgeAndWeight === false, 'Marked ineligible for ECMO by gestational age & birth weight');
  assert(res4.ecmoEligibility.alertStatus === 'INELIGIBLE', 'Status is INELIGIBLE for standard veno-arterial ECMO');

  // TEST 5: iNO Titration & Monitoring - Positive Responder
  console.log('\n[Test 5] iNO Monitoring: Positive Responder');
  const inoCase1: InoMonitoringInput = {
    patientId: 901,
    inoDosePpm: 20,
    fio2: 0.70,
    pao2Mmhg: 95,
    meanAirwayPressureMmh2o: 14, // OI = (14 * 0.7 * 100) / 95 = 10.3
    preInoPao2: 45, // PaO2 improved by 50 mmHg (> 20 mmHg criterion)
    methemoglobinPercent: 1.2,
    nitrogenDioxidePpm: 0.4
  };
  const inoRes1 = evaluateInoMonitoring(inoCase1);
  assert(inoRes1.responderStatus === 'POSITIVE_RESPONDER', 'Correctly marked POSITIVE_RESPONDER');
  assert(inoRes1.methemoglobinStatus === 'NORMAL', 'Methemoglobin normal (1.2% < 2.5%)');
  assert(inoRes1.reboundWarning === true, 'Rebound warning active to prevent abrupt cessation');

  // TEST 6: iNO Monitoring - Methemoglobinemia Toxicity & Methylene Blue Directive
  console.log('\n[Test 6] iNO Monitoring: Methemoglobin Toxicity (> 5.0%)');
  const inoCase2: InoMonitoringInput = {
    patientId: 902,
    inoDosePpm: 20,
    fio2: 0.80,
    pao2Mmhg: 70,
    meanAirwayPressureMmh2o: 16,
    methemoglobinPercent: 5.8, // > 5.0% toxic threshold
    nitrogenDioxidePpm: 1.1
  };
  const inoRes2 = evaluateInoMonitoring(inoCase2);
  assert(
    inoRes2.methemoglobinStatus === 'TOXIC_HOLD_METHYLENE_BLUE',
    'Correctly flagged as TOXIC_HOLD_METHYLENE_BLUE'
  );
  assert(
    inoRes2.weaningDirectives.some(d => d.includes('Methylene Blue 1 mg/kg IV')),
    'Includes immediate Methylene Blue 1 mg/kg IV directive'
  );

  // TEST 7: iNO Monitoring - Elevated Methemoglobin (2.5 - 5.0%) Dose Reduction
  console.log('\n[Test 7] iNO Monitoring: Elevated Methemoglobin (2.5 - 5.0%)');
  const inoCase3: InoMonitoringInput = {
    patientId: 903,
    inoDosePpm: 20,
    fio2: 0.60,
    pao2Mmhg: 75,
    meanAirwayPressureMmh2o: 12,
    methemoglobinPercent: 3.4
  };
  const inoRes3 = evaluateInoMonitoring(inoCase3);
  assert(
    inoRes3.methemoglobinStatus === 'ELEVATED_WEAN_DOSE',
    'Correctly flagged as ELEVATED_WEAN_DOSE'
  );
  assert(
    inoRes3.weaningDirectives.some(d => d.includes('Reduce iNO dose by 50%')),
    'Directs reducing iNO dose by 50%'
  );

  // TEST 8: iNO Monitoring - Weaning Candidate
  console.log('\n[Test 8] iNO Monitoring: Weaning Candidate');
  const inoCase4: InoMonitoringInput = {
    patientId: 904,
    inoDosePpm: 10,
    fio2: 0.40,
    pao2Mmhg: 85,
    meanAirwayPressureMmh2o: 10, // OI = (10 * 0.4 * 100) / 85 = 4.7
    methemoglobinPercent: 1.1
  };
  const inoRes4 = evaluateInoMonitoring(inoCase4);
  assert(
    inoRes4.responderStatus === 'WEANING_CANDIDATE',
    'Flagged as WEANING_CANDIDATE (OI < 10, FiO2 <= 0.50)'
  );
  assert(
    inoRes4.weaningDirectives.some(d => d.includes('stepwise down to 5 ppm, then 1 ppm')),
    'Provides structured gradual weaning protocol to 1 ppm before discontinuation'
  );

  // TEST 9: Database Persistence for PPHN Evaluations and iNO Logs
  console.log('\n[Test 9] Database Persistence: PPHN Evaluations & iNO Logs');
  try {
    const pRes = await pool.query('SELECT id FROM patients LIMIT 1');
    const testPatientId = pRes.rows.length > 0 ? pRes.rows[0].id : 1;

    const savedEval = await savePphnEvaluation({
      ...case1,
      patientId: testPatientId,
      ...res1
    });
    assert(!!savedEval && savedEval.id > 0, `PPHN evaluation persisted with ID: ${savedEval?.id}`);
    assert(savedEval.pphn_severity === 'SUPRASYSTEMIC_SEVERE', 'Stored pphn_severity is SUPRASYSTEMIC_SEVERE');

    const historyEvals = await getPatientPphnEvaluations(testPatientId);
    assert(historyEvals.length > 0, `Retrieved ${historyEvals.length} historical PPHN evaluations for patient ${testPatientId}`);

    const savedLog = await saveInoLog({
      ...inoCase1,
      patientId: testPatientId,
      ...inoRes1
    });
    assert(!!savedLog && savedLog.id > 0, `iNO log persisted with ID: ${savedLog?.id}`);
    assert(savedLog.responder_status === 'POSITIVE_RESPONDER', 'Stored responder_status is POSITIVE_RESPONDER');

    const historyLogs = await getPatientInoLogs(testPatientId);
    assert(historyLogs.length > 0, `Retrieved ${historyLogs.length} historical iNO logs for patient ${testPatientId}`);
  } catch (err) {
    console.error('Database persistence test failed:', err);
    assert(false, 'Database operations succeeded without error');
  }

  console.log(`\n=================================================`);
  console.log(`PPHN-RESIDUAL TESTS COMPLETED: ${passed} passed, ${failed} failed`);
  console.log(`=================================================`);

  await pool.end();

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});