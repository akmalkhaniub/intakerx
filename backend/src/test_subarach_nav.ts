import {
  evaluateSubarachnoidHemorrhage,
  evaluateTcdVasospasm,
  saveSubarachnoidEvaluation,
  getPatientSubarachnoidEvaluations,
  saveTcdLog,
  getPatientTcdLogs,
  SubarachnoidEvaluationInput,
  TcdVasospasmInput
} from './services/subarachNav';
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
  console.log('=== RUNNING SUBARACH-NAV (PHASE 93) INTEGRATION & VASOSPASM TESTS ===\n');

  // TEST 1: Unsecured Aneurysm - Strict SBP < 140 mmHg Target & Re-bleeding Prevention
  console.log('[Test 1] Unsecured Aneurysmal SAH (Strict Pre-Securing BP Target)');
  const case1: SubarachnoidEvaluationInput = {
    patientId: 1,
    huntHessGrade: 3,
    modifiedFisherGrade: 4,
    gcsScore: 13,
    hasFocalDeficit: true,
    aneurysmSecured: false,
    postBleedDay: 1,
    hasHydrocephalus: true,
    currentSbpMmhg: 165
  };
  const res1 = evaluateSubarachnoidHemorrhage(case1);
  assert(res1.wfnsGrade === 3, `Calculated WFNS Grade correctly: ${res1.wfnsGrade} (GCS 13 with deficit)`);
  assert(
    res1.bloodPressureTarget.includes('STRICT SBP < 140 mmHg'),
    'Prescribes strict SBP < 140 mmHg to prevent fatal aneurysm re-bleeding'
  );
  assert(
    Boolean(res1.hydrocephalusGuidance?.includes('Emergent External Ventricular Drain (EVD)')),
    'Directs emergent EVD placement for acute hydrocephalus'
  );
  assert(
    res1.nimodipineRegimen.includes('Nimodipine 60 mg PO/NG Q4H'),
    'Prescribes standard Nimodipine 60 mg Q4H for 21 days'
  );

  // TEST 2: Secured Aneurysm in Peak DCI Window (Days 4-14) with Critical DCI Risk
  console.log('\n[Test 2] Secured Aneurysm in Peak DCI Window (Modified Fisher 4, Day 7)');
  const case2: SubarachnoidEvaluationInput = {
    patientId: 1,
    huntHessGrade: 4,
    modifiedFisherGrade: 4,
    gcsScore: 8,
    hasFocalDeficit: true,
    aneurysmSecured: true,
    aneurysmTreatmentType: 'COILED',
    postBleedDay: 7, // Peak vasospasm window
    currentMapMmhg: 64 // Hypotensive on nimodipine
  };
  const res2 = evaluateSubarachnoidHemorrhage(case2);
  assert(res2.dciRiskCategory === 'CRITICAL', 'Classified as CRITICAL DCI risk during peak window');
  assert(
    res2.bloodPressureTarget.includes('PERMISSIVE HYPERTENSION') && res2.bloodPressureTarget.includes('MAP > 90-110 mmHg'),
    'Permits induced hypertension targets once aneurysm is secured'
  );
  assert(
    res2.nimodipineRegimen.includes('Split Nimodipine to 30 mg PO/NG Q2H'),
    'Adjusts Nimodipine to 30 mg Q2H for MAP < 70 mmHg (does not discontinue)'
  );

  // TEST 3: Hyponatremia & Cerebral Salt Wasting Sentinel
  console.log('\n[Test 3] Cerebral Salt Wasting vs SIADH Sentinel');
  const case3: SubarachnoidEvaluationInput = {
    patientId: 1,
    huntHessGrade: 2,
    modifiedFisherGrade: 2,
    gcsScore: 15,
    hasFocalDeficit: false,
    aneurysmSecured: true,
    postBleedDay: 5,
    serumSodiumMeqL: 129 // Severe hyponatremia
  };
  const res3 = evaluateSubarachnoidHemorrhage(case3);
  assert(
    Boolean(res3.hyponatremiaManagement?.includes('DO NOT FLUID RESTRICT')),
    'Strictly contraindicates fluid restriction in aSAH hyponatremia'
  );
  assert(
    Boolean(res3.hyponatremiaManagement?.includes('Fludrocortisone')),
    'Directs Fludrocortisone and hypertonic/normal saline for volume expansion'
  );

  // TEST 4: TCD Vasospasm - Normal Baseline Flow
  console.log('\n[Test 4] TCD Vasospasm: Normal Baseline Surveillance');
  const tcdNormal: TcdVasospasmInput = {
    patientId: 1,
    postBleedDay: 3,
    mcaMfvLeft: 85,
    mcaMfvRight: 92,
    icaExtracranialMfv: 45,
    currentMapMmhg: 88,
    newFocalDeficitOrDropInGcs: false
  };
  const tcdNormalRes = evaluateTcdVasospasm(tcdNormal);
  assert(tcdNormalRes.vasospasmSeverity === 'NO_VASOSPASM', 'Identified as NO_VASOSPASM');
  assert(tcdNormalRes.lindegaardRatio === 2.04, `Calculated Lindegaard ratio: ${tcdNormalRes.lindegaardRatio}`);
  assert(tcdNormalRes.endovascularRescueIndicated === false, 'Endovascular rescue not indicated');

  // TEST 5: TCD Vasospasm - Hyperemia vs True Vasospasm (Lindegaard Ratio < 3.0)
  console.log('\n[Test 5] TCD Vasospasm: Hyperemia Differentiated from Vasospasm');
  const tcdHyperemia: TcdVasospasmInput = {
    patientId: 1,
    postBleedDay: 6,
    mcaMfvLeft: 148,
    mcaMfvRight: 152, // Elevated velocity > 140
    icaExtracranialMfv: 62, // High extracranial flow -> LR = 152 / 62 = 2.45 (< 3.0)
    currentMapMmhg: 90,
    newFocalDeficitOrDropInGcs: false
  };
  const tcdHyperemiaRes = evaluateTcdVasospasm(tcdHyperemia);
  assert(
    tcdHyperemiaRes.vasospasmSeverity === 'HYPEREMIA_NOT_VASOSPASM',
    'Correctly classified as HYPEREMIA_NOT_VASOSPASM due to Lindegaard < 3.0'
  );
  assert(tcdHyperemiaRes.endovascularRescueIndicated === false, 'Endovascular rescue not indicated for hyperemia');

  // TEST 6: TCD Vasospasm - Severe Critical Vasospasm & Endovascular Rescue Trigger
  console.log('\n[Test 6] TCD Vasospasm: Severe Critical Vasospasm (MFV > 200, LR > 6.0)');
  const tcdSevere: TcdVasospasmInput = {
    patientId: 1,
    postBleedDay: 8,
    mcaMfvLeft: 225, // > 200 cm/s
    mcaMfvRight: 180,
    icaExtracranialMfv: 32, // LR = 225 / 32 = 7.03 (> 6.0)
    currentMapMmhg: 85,
    newFocalDeficitOrDropInGcs: true // Acute neurological deterioration
  };
  const tcdSevereRes = evaluateTcdVasospasm(tcdSevere);
  assert(
    tcdSevereRes.vasospasmSeverity === 'SEVERE_CRITICAL_VASOSPASM',
    'Correctly classified as SEVERE_CRITICAL_VASOSPASM'
  );
  assert(tcdSevereRes.lindegaardRatio === 7.03, `Calculated Lindegaard ratio: ${tcdSevereRes.lindegaardRatio}`);
  assert(tcdSevereRes.endovascularRescueIndicated === true, 'Triggered STAT Endovascular Rescue (DSA / Verapamil / Angioplasty)');
  assert(
    tcdSevereRes.inducedHypertensionTarget.includes('MAP > 90 - 110 mmHg'),
    'Prescribes aggressive Induced Hypertension target'
  );

  // TEST 7: Database Persistence
  console.log('\n[Test 7] Database Persistence: aSAH Evaluations & TCD Logs');
  try {
    const pRes = await pool.query('SELECT id FROM patients LIMIT 1');
    const testPatientId = pRes.rows.length > 0 ? pRes.rows[0].id : 1;

    const savedEval = await saveSubarachnoidEvaluation({
      ...case2,
      patientId: testPatientId,
      ...res2
    });
    assert(!!savedEval && savedEval.id > 0, `Subarachnoid evaluation saved with ID: ${savedEval?.id}`);
    assert(savedEval.dci_risk_category === 'CRITICAL', 'Stored dci_risk_category is CRITICAL');

    const historyEvals = await getPatientSubarachnoidEvaluations(testPatientId);
    assert(historyEvals.length > 0, `Retrieved ${historyEvals.length} subarachnoid evaluations for patient ${testPatientId}`);

    const savedLog = await saveTcdLog({
      ...tcdSevere,
      patientId: testPatientId,
      ...tcdSevereRes
    });
    assert(!!savedLog && savedLog.id > 0, `TCD log saved with ID: ${savedLog?.id}`);
    assert(savedLog.vasospasm_severity === 'SEVERE_CRITICAL_VASOSPASM', 'Stored vasospasm_severity is SEVERE_CRITICAL_VASOSPASM');

    const historyLogs = await getPatientTcdLogs(testPatientId);
    assert(historyLogs.length > 0, `Retrieved ${historyLogs.length} TCD logs for patient ${testPatientId}`);
  } catch (err) {
    console.error('Database persistence test error:', err);
    assert(false, 'Database operations succeeded without error');
  }

  console.log(`\n=================================================`);
  console.log(`SUBARACH-NAV TESTS COMPLETED: ${passed} passed, ${failed} failed`);
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
