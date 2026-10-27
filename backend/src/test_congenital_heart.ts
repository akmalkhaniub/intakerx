import {
  evaluateCongenitalHeart,
  evaluatePge1Infusion,
  saveCongenitalHeartEvaluation,
  getPatientCchdEvaluations,
  savePge1Log,
  getPatientPge1Logs
} from './services/congenitalHeart';
import { pool } from './db';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('\n=== RUNNING CONGENITAL-HEART TEST SUITE (PHASE 89) ===\n');

  try {
    // ----------------------------------------------------
    // TEST SUITE 1: DUCTAL-DEPENDENT LESION CLASSIFICATION
    // ----------------------------------------------------
    console.log('--- 1. Ductal-Dependent Lesion Classification ---');

    // Case 1: Ductal-Dependent Systemic Obstruction (HLHS / CoA)
    const systemicCase = evaluateCongenitalHeart({
      patientId: 1,
      postnatalAgeHours: 36,
      preDuctalSpo2: 88,
      postDuctalSpo2: 78,
      hyperoxiaPao2: 110,
      femoralPulses: 'ABSENT',
      fourExtremityBpGradientMmhg: 24,
      echocardiogramFindings: ['COA', 'LV_DYSFUNCTION'],
      hasMetabolicAcidosis: true,
      lactateMmolL: 5.4
    });
    assert(systemicCase.lesionCategory === 'DUCTAL_DEPENDENT_SYSTEMIC', 'Absent femoral pulses + BP gradient classified as DUCTAL_DEPENDENT_SYSTEMIC');
    assert(systemicCase.pge1Indicated === true, 'PGE1 is indicated for ductal-dependent systemic lesion');
    assert(systemicCase.pge1Dosing.includes('0.05 - 0.10'), 'Rescue high-dose PGE1 indicated for cardiogenic shock / closed ductus');
    assert(systemicCase.oxygenationTargetStrategy.includes('SUB-AMBIENT') || systemicCase.oxygenationTargetStrategy.includes('AVOID HYPEROXIA'), 'Mandates sub-ambient / normic oxygen strategy to prevent pulmonary overcirculation steal');

    // Case 2: Ductal-Dependent Pulmonary Obstruction (PA/IVS)
    const pulmonaryCase = evaluateCongenitalHeart({
      patientId: 1,
      postnatalAgeHours: 8,
      preDuctalSpo2: 65,
      postDuctalSpo2: 64,
      hyperoxiaPao2: 45,
      femoralPulses: 'NORMAL',
      echocardiogramFindings: ['PA/IVS'],
      hasMetabolicAcidosis: false
    });
    assert(pulmonaryCase.lesionCategory === 'DUCTAL_DEPENDENT_PULMONARY', 'PA/IVS + positive hyperoxia test classified as DUCTAL_DEPENDENT_PULMONARY');
    assert(pulmonaryCase.hyperoxiaTestInterpretation.result === 'POSITIVE_CYANOTIC_CHD', 'Hyperoxia PaO2 45 mmHg is POSITIVE_CYANOTIC_CHD');
    assert(pulmonaryCase.pge1Indicated === true, 'PGE1 is indicated to restore pulmonary blood flow');

    // Case 3: Ductal-Dependent Mixing (D-TGA with Restrictive ASD)
    const mixingCase = evaluateCongenitalHeart({
      patientId: 1,
      postnatalAgeHours: 12,
      preDuctalSpo2: 68,
      postDuctalSpo2: 76,
      hyperoxiaPao2: 52,
      femoralPulses: 'NORMAL',
      echocardiogramFindings: ['TGA', 'RESTRICTIVE ATRIAL SEPTUM'],
      hasMetabolicAcidosis: true,
      lactateMmolL: 4.1
    });
    assert(mixingCase.lesionCategory === 'DUCTAL_DEPENDENT_MIXING', 'D-TGA with reverse differential cyanosis classified as DUCTAL_DEPENDENT_MIXING');
    assert(mixingCase.differentialCyanosisPattern === 'REVERSE_DIFFERENTIAL', 'Post-ductal SpO2 76 > Pre-ductal 68 is REVERSE_DIFFERENTIAL');
    assert(mixingCase.rashkindIndicated === true, 'Restrictive atrial septum triggers urgent Rashkind Balloon Septostomy');

    // Case 4: Non-Ductal Pulmonary Disease (Severe RDS / TTN)
    const pulmonaryDiseaseCase = evaluateCongenitalHeart({
      patientId: 1,
      postnatalAgeHours: 6,
      preDuctalSpo2: 94,
      postDuctalSpo2: 93,
      hyperoxiaPao2: 340,
      femoralPulses: 'NORMAL',
      hasMetabolicAcidosis: false
    });
    assert(pulmonaryDiseaseCase.lesionCategory === 'NON_DUCTAL_OR_PULMONARY', 'PaO2 340 on hyperoxia test classified as NON_DUCTAL_OR_PULMONARY');
    assert(pulmonaryDiseaseCase.pge1Indicated === false, 'PGE1 NOT indicated for negative hyperoxia screen');

    // ----------------------------------------------------
    // TEST SUITE 2: HYPEROXIA TEST & DIFFERENTIAL CYANOSIS
    // ----------------------------------------------------
    console.log('\n--- 2. Hyperoxia Test & Cyanosis Patterns ---');

    assert(pulmonaryDiseaseCase.hyperoxiaTestInterpretation.result === 'NEGATIVE_PULMONARY', 'Hyperoxia PaO2 >= 250 is NEGATIVE_PULMONARY');
    assert(pulmonaryCase.hyperoxiaTestInterpretation.result === 'POSITIVE_CYANOTIC_CHD', 'Hyperoxia PaO2 < 150 is POSITIVE_CYANOTIC_CHD');

    // True Differential Cyanosis (e.g. Pre 96%, Post 88%)
    const diffCyanosisCase = evaluateCongenitalHeart({
      patientId: 1,
      postnatalAgeHours: 24,
      preDuctalSpo2: 96,
      postDuctalSpo2: 88,
      hyperoxiaPao2: 85,
      femoralPulses: 'DIMINISHED',
      hasMetabolicAcidosis: false
    });
    assert(diffCyanosisCase.differentialCyanosisPattern === 'TRUE_DIFFERENTIAL', 'Pre-ductal 96 vs Post-ductal 88 is TRUE_DIFFERENTIAL');

    // ----------------------------------------------------
    // TEST SUITE 3: PGE1 INFUSION MONITORING & APNEA GUARD
    // ----------------------------------------------------
    console.log('\n--- 3. PGE1 Infusion Monitoring & Apnea Guard ---');

    // Case 3A: Apnea episode detected
    const apneaMonitor = evaluatePge1Infusion({
      patientId: 1,
      infusionRateMcgKgMin: 0.05,
      apneaObserved: true,
      patientWeightKg: 1.8,
      preDuctalSpo2: 82,
      postDuctalSpo2: 81
    });
    assert(apneaMonitor.apneaGuardDirectives.some(d => d.includes('Apnea episode detected')), 'Triggers critical apnea alert');
    assert(apneaMonitor.apneaGuardDirectives.some(d => d.includes('< 2.0 kg')), 'Identifies high vulnerability low-weight infant for apnea');

    // Case 3B: Hypotension from PGE1 vasodilation
    const hypotensionMonitor = evaluatePge1Infusion({
      patientId: 1,
      infusionRateMcgKgMin: 0.08,
      apneaObserved: false,
      bloodPressureSystolic: 38,
      temperatureCelsius: 38.4,
      patientWeightKg: 3.2,
      preDuctalSpo2: 80,
      postDuctalSpo2: 79
    });
    assert(hypotensionMonitor.hemodynamicStability.includes('Systemic hypotension'), 'Detects PGE1-induced hypotension');
    assert(hypotensionMonitor.apneaGuardDirectives.some(d => d.includes('Pyrexia')), 'Notes expected PGE1 pyrexia');

    // Case 3C: Effective ductal reopening allowing maintenance wean
    const effectiveMonitor = evaluatePge1Infusion({
      patientId: 1,
      infusionRateMcgKgMin: 0.06,
      apneaObserved: false,
      bloodPressureSystolic: 55,
      temperatureCelsius: 37.1,
      patientWeightKg: 3.0,
      preDuctalSpo2: 84,
      postDuctalSpo2: 82
    });
    assert(effectiveMonitor.infusionStatus === 'EFFECTIVE_DUCTAL_PATENCY', 'SpO2 >= 75% on 0.06 is EFFECTIVE_DUCTAL_PATENCY');
    assert(effectiveMonitor.recommendedInfusionAdjustment.includes('Wean PGE1 to maintenance rate'), 'Recommends weaning to 0.01 - 0.025 mcg/kg/min');

    // ----------------------------------------------------
    // TEST SUITE 4: DATABASE PERSISTENCE
    // ----------------------------------------------------
    console.log('\n--- 4. Database Persistence & History ---');

    const pRes = await pool.query('SELECT id FROM patients LIMIT 1');
    let testPatientId = 1;
    if (pRes.rows.length > 0) testPatientId = pRes.rows[0].id;

    // Save Congenital Heart Evaluation
    const savedEval = await saveCongenitalHeartEvaluation({
      patientId: testPatientId,
      postnatalAgeHours: 36,
      preDuctalSpo2: 88,
      postDuctalSpo2: 78,
      hyperoxiaPao2: 110,
      femoralPulses: 'ABSENT',
      fourExtremityBpGradientMmhg: 24,
      echocardiogramFindings: ['COA', 'LV_DYSFUNCTION'],
      hasMetabolicAcidosis: true,
      lactateMmolL: 5.4,
      ...systemicCase
    });
    assert(savedEval && savedEval.id > 0, `CCHD evaluation saved with ID ${savedEval?.id}`);

    const retrievedEvals = await getPatientCchdEvaluations(testPatientId);
    assert(retrievedEvals.length > 0, `Retrieved ${retrievedEvals.length} CCHD evaluations`);

    // Save PGE1 Infusion Log
    const savedPge1 = await savePge1Log({
      patientId: testPatientId,
      infusionRateMcgKgMin: 0.05,
      apneaObserved: true,
      temperatureCelsius: 38.4,
      bloodPressureSystolic: 50,
      bloodPressureDiastolic: 28,
      preDuctalSpo2: 82,
      postDuctalSpo2: 81,
      patientWeightKg: 1.8,
      ...apneaMonitor
    });
    assert(savedPge1 && savedPge1.id > 0, `PGE1 monitoring log saved with ID ${savedPge1?.id}`);

    const retrievedLogs = await getPatientPge1Logs(testPatientId);
    assert(retrievedLogs.length > 0, `Retrieved ${retrievedLogs.length} PGE1 monitoring logs`);

    console.log(`\n========================================`);
    console.log(`CONGENITAL-HEART TEST SUMMARY:`);
    console.log(`  TOTAL PASSED: ${passedTests}`);
    console.log(`  TOTAL FAILED: ${failedTests}`);
    console.log(`========================================\n`);

    if (failedTests > 0) process.exit(1);
    else process.exit(0);
  } catch (err) {
    console.error('Fatal error during CONGENITAL-HEART test execution:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
