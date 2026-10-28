import { SpinalCordService } from './services/spinalCord';
import { pool } from './db';

async function runTests() {
  console.log('=== RUNNING SPINAL-CORD (PHASE 95) INTEGRATION TESTS ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // Test 1: ASIA Grade A (Complete Injury) & Lesion Above T6
    // -------------------------------------------------------------
    console.log('[Test 1] ASIA Grade A Complete Cervical Injury');
    const t1 = SpinalCordService.evaluateInjury({
      patientId: 1,
      neurologicalLevelOfInjury: 'C5',
      hoursSinceInjury: 4,
      motorScoreTotal: 22,
      sensoryScoreTotal: 46,
      sacralSparingSensory: false,
      sacralSparingMotor: false,
      keyMusclesBelowNliGrade3Percent: 0,
      bulbocavernosusReflexPresent: false,
      currentSbp: 86,
      currentDbp: 52,
      currentMap: 63,
      currentHeartRate: 48,
      cordCompressionOnMri: true,
      spinalInstabilityPresent: true
    });

    assert(t1.asiaGrade === 'A', 'Correctly classified as ASIA Grade A');
    assert(t1.completeness === 'COMPLETE', 'Completeness is COMPLETE');
    assert(t1.lesionAboveT6 === true, 'C5 recognized as lesion above T6');
    assert(t1.spinalShockActive === true, 'Absent bulbocavernosus reflex indicates active spinal shock');
    assert(t1.neurogenicShockActive === true, 'Hypotension + bradycardia in C5 lesion triggers Neurogenic Shock');
    assert(t1.mapTargetGoal.recommendedVasopressor.includes('Norepinephrine'), 'Recommends Norepinephrine for neurogenic shock');
    assert(Boolean(t1.mapTargetGoal.contraindicatedAgents.some(a => a.includes('Phenylephrine'))), 'Phenylephrine contraindicated due to reflex bradycardia');

    // -------------------------------------------------------------
    // Test 2: ASIA Grade B (Sensory Incomplete)
    // -------------------------------------------------------------
    console.log('\n[Test 2] ASIA Grade B Sensory Incomplete Thoracic Injury');
    const t2 = SpinalCordService.evaluateInjury({
      patientId: 1,
      neurologicalLevelOfInjury: 'T4',
      hoursSinceInjury: 8,
      motorScoreTotal: 50,
      sensoryScoreTotal: 120,
      sacralSparingSensory: true,
      sacralSparingMotor: false,
      keyMusclesBelowNliGrade3Percent: 0,
      bulbocavernosusReflexPresent: true,
      currentSbp: 118,
      currentDbp: 74,
      currentMap: 88,
      currentHeartRate: 72,
      cordCompressionOnMri: true,
      spinalInstabilityPresent: false
    });

    assert(t2.asiaGrade === 'B', 'Correctly classified as ASIA Grade B (Sensory Incomplete)');
    assert(t2.completeness === 'SENSORY_INCOMPLETE', 'Completeness is SENSORY_INCOMPLETE');
    assert(t2.spinalShockActive === false, 'Bulbocavernosus reflex present: spinal shock resolved');
    assert(t2.neurogenicShockActive === false, 'Hemodynamically stable');

    // -------------------------------------------------------------
    // Test 3: ASIA Grade C (Motor Incomplete < 50% Grade >= 3)
    // -------------------------------------------------------------
    console.log('\n[Test 3] ASIA Grade C Motor Incomplete');
    const t3 = SpinalCordService.evaluateInjury({
      patientId: 1,
      neurologicalLevelOfInjury: 'C6',
      hoursSinceInjury: 14,
      motorScoreTotal: 42,
      sensoryScoreTotal: 140,
      sacralSparingSensory: true,
      sacralSparingMotor: true,
      keyMusclesBelowNliGrade3Percent: 25,
      bulbocavernosusReflexPresent: true,
      currentSbp: 124,
      currentDbp: 78,
      currentMap: 93,
      currentHeartRate: 68,
      cordCompressionOnMri: true,
      spinalInstabilityPresent: true
    });

    assert(t3.asiaGrade === 'C', 'Correctly classified as ASIA Grade C (< 50% muscles >= 3/5)');
    assert(t3.completeness === 'MOTOR_INCOMPLETE', 'Completeness is MOTOR_INCOMPLETE');

    // -------------------------------------------------------------
    // Test 4: ASIA Grade D (Motor Incomplete >= 50% Grade >= 3)
    // -------------------------------------------------------------
    console.log('\n[Test 4] ASIA Grade D Motor Incomplete');
    const t4 = SpinalCordService.evaluateInjury({
      patientId: 1,
      neurologicalLevelOfInjury: 'T10',
      hoursSinceInjury: 6,
      motorScoreTotal: 82,
      sensoryScoreTotal: 180,
      sacralSparingSensory: true,
      sacralSparingMotor: true,
      keyMusclesBelowNliGrade3Percent: 80,
      bulbocavernosusReflexPresent: true,
      currentSbp: 130,
      currentDbp: 82,
      currentMap: 98,
      currentHeartRate: 74,
      cordCompressionOnMri: true,
      spinalInstabilityPresent: true
    });

    assert(t4.asiaGrade === 'D', 'Correctly classified as ASIA Grade D (>= 50% muscles >= 3/5)');
    assert(t4.lesionAboveT6 === false, 'T10 is below T6');

    // -------------------------------------------------------------
    // Test 5: Concomitant Hemorrhagic Shock Differential
    // -------------------------------------------------------------
    console.log('\n[Test 5] Polytrauma: Concomitant Hemorrhagic Shock vs Isolated Neurogenic Shock');
    const t5 = SpinalCordService.evaluateInjury({
      patientId: 1,
      neurologicalLevelOfInjury: 'C5',
      hoursSinceInjury: 2,
      motorScoreTotal: 30,
      sensoryScoreTotal: 60,
      sacralSparingSensory: false,
      sacralSparingMotor: false,
      keyMusclesBelowNliGrade3Percent: 0,
      bulbocavernosusReflexPresent: false,
      currentSbp: 80,
      currentDbp: 50,
      currentMap: 60,
      currentHeartRate: 128, // Tachycardia
      cordCompressionOnMri: true,
      spinalInstabilityPresent: true
    });

    assert(t5.concomitantHemorrhagicShockSuspected === true, 'Flags concomitant hemorrhagic shock due to tachycardia (HR 128)');
    assert(Boolean(t5.protocolDirectives.some(d => d.includes('occult hemorrhagic shock'))), 'Warns of occult hemorrhagic polytrauma bleeding');

    // -------------------------------------------------------------
    // Test 6: Ultra-Early Surgical Decompression Window Timing
    // -------------------------------------------------------------
    console.log('\n[Test 6] Surgical Decompression Windows (<12h vs 12-24h vs >24h)');
    assert(t1.decompressionWindowStatus === 'ULTRA_EARLY_OPTIMAL', '4h post-injury is ULTRA_EARLY_OPTIMAL (<12h)');
    assert(t3.decompressionWindowStatus === 'EARLY_ACCEPTABLE', '14h post-injury is EARLY_ACCEPTABLE (<24h)');

    const t6Delayed = SpinalCordService.evaluateInjury({
      patientId: 1,
      neurologicalLevelOfInjury: 'C5',
      hoursSinceInjury: 32,
      motorScoreTotal: 30,
      sensoryScoreTotal: 60,
      sacralSparingSensory: false,
      sacralSparingMotor: false,
      keyMusclesBelowNliGrade3Percent: 0,
      bulbocavernosusReflexPresent: true,
      currentSbp: 120,
      currentDbp: 80,
      currentMap: 93,
      currentHeartRate: 70,
      cordCompressionOnMri: true,
      spinalInstabilityPresent: true
    });
    assert(t6Delayed.decompressionWindowStatus === 'DELAYED', '32h post-injury is DELAYED (>24h)');

    // -------------------------------------------------------------
    // Test 7: Autonomic Dysreflexia (AD) Sentinel
    // -------------------------------------------------------------
    console.log('\n[Test 7] Autonomic Dysreflexia Sentinel (>T6 with Severe SBP Surge)');
    const t7 = SpinalCordService.evaluateInjury({
      patientId: 1,
      neurologicalLevelOfInjury: 'T3',
      hoursSinceInjury: 72,
      motorScoreTotal: 35,
      sensoryScoreTotal: 70,
      sacralSparingSensory: false,
      sacralSparingMotor: false,
      keyMusclesBelowNliGrade3Percent: 0,
      bulbocavernosusReflexPresent: true,
      currentSbp: 175,
      currentDbp: 105,
      currentMap: 128,
      currentHeartRate: 50,
      cordCompressionOnMri: false,
      spinalInstabilityPresent: false,
      baselineSbp: 110
    });

    assert(t7.autonomicDysreflexiaRisk === true, 'Identifies AD risk in T3 lesion');
    assert(Boolean(t7.protocolDirectives.some(d => d.includes('Autonomic Dysreflexia detected'))), 'Triggers emergency AD warning for SBP >= baseline + 20');

    // -------------------------------------------------------------
    // Test 8: Hourly MAP Augmentation Titration
    // -------------------------------------------------------------
    console.log('\n[Test 8] MAP Augmentation Protocol Titration Rules (Target 85-95 mmHg)');

    // 8a: Subtherapeutic MAP < 85 -> Ischemia alert & uptitrate
    const m1 = SpinalCordService.titrateMap({
      patientId: 1,
      postInjuryHour: 6,
      systolicBp: 98,
      diastolicBp: 62,
      mapMmhg: 74,
      heartRate: 64,
      activeVasopressor: 'Norepinephrine',
      vasopressorDoseMcgMin: 8
    });
    assert(m1.targetMet === false, 'MAP 74 mmHg does not meet target');
    assert(m1.ischemiaRiskAlert === true, 'Triggers critical cord ischemia alert');
    assert(m1.vasopressorAction === 'UPTITRATE', 'Directs vasopressor uptitration');

    // 8b: Therapeutic MAP (85-95 mmHg) -> Maintain
    const m2 = SpinalCordService.titrateMap({
      patientId: 1,
      postInjuryHour: 12,
      systolicBp: 122,
      diastolicBp: 72,
      mapMmhg: 89,
      heartRate: 68,
      activeVasopressor: 'Norepinephrine',
      vasopressorDoseMcgMin: 12
    });
    assert(m2.targetMet === true, 'MAP 89 mmHg achieves target corridor');
    assert(m2.vasopressorAction === 'MAINTAIN', 'Directs maintain regimen');
    assert(m2.ischemiaRiskAlert === false, 'No ischemia alert');

    // 8c: Supratherapeutic MAP > 95 mmHg -> Wean
    const m3 = SpinalCordService.titrateMap({
      patientId: 1,
      postInjuryHour: 24,
      systolicBp: 154,
      diastolicBp: 92,
      mapMmhg: 112,
      heartRate: 72,
      activeVasopressor: 'Norepinephrine',
      vasopressorDoseMcgMin: 20
    });
    assert(m3.targetMet === false, 'MAP 112 mmHg is supratherapeutic');
    assert(m3.vasopressorAction === 'WEAN', 'Directs vasopressor weaning to avoid hematoma expansion');

    // -------------------------------------------------------------
    // Test 9: Database Persistence & Retrieval
    // -------------------------------------------------------------
    console.log('\n[Test 9] Database Persistence: SCI Evaluations & MAP Logs');
    const evalId = await SpinalCordService.persistEvaluation(t1);
    assert(evalId > 0, `Spinal cord evaluation persisted with ID: ${evalId}`);

    const evals = await SpinalCordService.getEvaluations(1);
    assert(evals.length > 0, `Retrieved ${evals.length} evaluation(s) for patient 1`);
    assert(evals[0].asia_grade === 'A', 'Stored ASIA grade is A');

    const mapLogId = await SpinalCordService.persistMapLog(m2);
    assert(mapLogId > 0, `MAP augmentation log persisted with ID: ${mapLogId}`);

    const mapLogs = await SpinalCordService.getMapLogs(1);
    assert(mapLogs.length > 0, `Retrieved ${mapLogs.length} MAP log(s) for patient 1`);
    assert(mapLogs[0].target_met === true, 'Stored target_met is true');

    console.log(`\n=================================================`);
    console.log(`SPINAL-CORD TESTS COMPLETED: ${passed} passed, ${failed} failed`);
    console.log(`=================================================`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution exception:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
