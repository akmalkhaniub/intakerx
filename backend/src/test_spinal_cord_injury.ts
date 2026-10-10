import { pool } from './db';
import { SpinalCordInjuryService } from './services/spinalCordInjury';

async function runSpinalCordInjuryTests() {
  console.log('====================================================');
  console.log('🧪 Starting Phase 62: SPINE-ALERT Neurotrauma Tests');
  console.log('====================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // 1. AIS Grade A (Complete Injury)
    console.log('\n--- 1. AIS Grade A Complete Injury ---');
    const aisAResult = SpinalCordInjuryService.classifyASIA({
      patientId: 1,
      neurologicalLevelOfInjury: 'C5',
      motorScoreTotal: 20,
      sensoryScoreLightTouch: 34,
      sensoryScorePinprick: 34,
      sacralSparingSensory: false,
      sacralSparingMotor: false,
      keyMusclesBelowNliGrade3OrMorePercent: 0
    });
    console.log(`Grade A Result: ${aisAResult.asiaImpairmentScale} (${aisAResult.completeness})`);
    assert(aisAResult.asiaImpairmentScale === 'A', 'Correctly classified as AIS Grade A');
    assert(aisAResult.completeness === 'Complete', 'Completeness is Complete');
    assert(aisAResult.recommendedCareDirectives.some(d => d.includes('MAP 85-90 mmHg')), 'MAP 85-90 directive included');

    // 2. AIS Grade B (Sensory Incomplete)
    console.log('\n--- 2. AIS Grade B Sensory Incomplete ---');
    const aisBResult = SpinalCordInjuryService.classifyASIA({
      patientId: 1,
      neurologicalLevelOfInjury: 'T4',
      motorScoreTotal: 50,
      sensoryScoreLightTouch: 80,
      sensoryScorePinprick: 80,
      sacralSparingSensory: true,
      sacralSparingMotor: false,
      keyMusclesBelowNliGrade3OrMorePercent: 0
    });
    console.log(`Grade B Result: ${aisBResult.asiaImpairmentScale} (${aisBResult.completeness})`);
    assert(aisBResult.asiaImpairmentScale === 'B', 'Correctly classified as AIS Grade B');
    assert(aisBResult.completeness === 'Sensory Incomplete', 'Completeness is Sensory Incomplete');

    // 3. AIS Grade C vs D (Motor Incomplete)
    console.log('\n--- 3. AIS Grade C and D (Motor Incomplete) ---');
    const aisCResult = SpinalCordInjuryService.classifyASIA({
      patientId: 1,
      neurologicalLevelOfInjury: 'C6',
      motorScoreTotal: 45,
      sensoryScoreLightTouch: 70,
      sensoryScorePinprick: 70,
      sacralSparingSensory: true,
      sacralSparingMotor: true,
      keyMusclesBelowNliGrade3OrMorePercent: 30 // <50% are >=3/5
    });
    assert(aisCResult.asiaImpairmentScale === 'C', 'Correctly classified as AIS Grade C (<50% muscles >=3/5)');

    const aisDResult = SpinalCordInjuryService.classifyASIA({
      patientId: 1,
      neurologicalLevelOfInjury: 'C6',
      motorScoreTotal: 82,
      sensoryScoreLightTouch: 95,
      sensoryScorePinprick: 95,
      sacralSparingSensory: true,
      sacralSparingMotor: true,
      keyMusclesBelowNliGrade3OrMorePercent: 75 // >=50% are >=3/5
    });
    assert(aisDResult.asiaImpairmentScale === 'D', 'Correctly classified as AIS Grade D (>=50% muscles >=3/5)');

    // 4. Neurogenic Shock vs Spinal Shock Differentiation
    console.log('\n--- 4. Neurogenic Shock vs Spinal Shock Differentiation ---');
    const shockResult = SpinalCordInjuryService.differentiateShock({
      neurologicalLevelOfInjury: 'C5',
      systolicBp: 82,
      diastolicBp: 52,
      mapMmhg: 62,
      heartRate: 50,
      temperatureCelsius: 35.8,
      bulbocavernosusReflexPresent: false,
      hoursPostInjury: 12
    });
    console.log(`Shock evaluation - Neurogenic: ${shockResult.neurogenicShockActive}, Spinal: ${shockResult.spinalShockActive}`);
    assert(shockResult.neurogenicShockActive === true, 'Neurogenic shock detected (Cervical NLI, Hypotension + Bradycardia)');
    assert(shockResult.spinalShockActive === true, 'Spinal shock detected (Absent bulbocavernosus reflex in acute phase)');
    assert(shockResult.mapTargetGoal.includes('85 - 90 mmHg'), 'Target MAP 85-90 mmHg recommended');
    assert(shockResult.immediateDirectives.some(d => d.includes('Norepinephrine')), 'Norepinephrine vasopressor directive included');

    // 5. Autonomic Dysreflexia Emergency Watchdog
    console.log('\n--- 5. Autonomic Dysreflexia Watchdog ---');
    const adResult = SpinalCordInjuryService.evaluateAutonomicDysreflexia({
      caseId: 1,
      neurologicalLevelOfInjury: 'T4',
      baselineSbp: 100,
      currentSbp: 188,
      currentDbp: 110,
      currentHeartRate: 46,
      suspectedTrigger: 'distended_urinary_bladder',
      symptoms: ['pounding_headache', 'facial_flushing', 'profuse_diaphoresis_above_t4']
    });
    console.log(`AD evaluation - Detected: ${adResult.isAutonomicDysreflexia}, Severity: ${adResult.severity}, Rise: +${adResult.sbpRiseAboveBaseline} mmHg`);
    assert(adResult.isAutonomicDysreflexia === true, 'Autonomic Dysreflexia correctly identified');
    assert(adResult.severity === 'hypertensive_crisis', 'Categorized as hypertensive crisis');
    assert(adResult.emergencyStepByStepProtocol.some(p => p.includes('Sit patient upright')), 'Upright positioning protocol in step 1');
    assert(adResult.emergencyStepByStepProtocol.some(p => p.includes('Nitropaste') || p.includes('Nifedipine')), 'Emergency antihypertensive intervention present');

    // 6. Spine Instability (SLIC / TLICS)
    console.log('\n--- 6. Spine Instability Classification ---');
    // SLIC: Morphology (burst = 2), DLC (disrupted = 2), Neuro (incomplete = 3) -> Total 7
    const slicOperative = SpinalCordInjuryService.evaluateSpineInstability('SLIC', 2, 2, 3);
    console.log(`SLIC Total: ${slicOperative.totalScore}, Recommendation: ${slicOperative.treatmentRecommendation}`);
    assert(slicOperative.totalScore === 7, 'Total SLIC score is 7');
    assert(slicOperative.treatmentRecommendation === 'Operative Stabilization Indicated', 'Operative stabilization indicated for score >= 5');

    const tlicsStable = SpinalCordInjuryService.evaluateSpineInstability('TLICS', 1, 0, 0);
    assert(tlicsStable.totalScore === 1, 'Total TLICS score is 1');
    assert(tlicsStable.treatmentRecommendation === 'Non-Operative', 'Non-operative management for score <= 3');

    // 7. Database Persistence Verification
    console.log('\n--- 7. Database Persistence Verification ---');
    let testPatientId = 1;
    const patientCheck = await pool.query(`SELECT id FROM patients LIMIT 1`);
    if (patientCheck.rows.length > 0) {
      testPatientId = patientCheck.rows[0].id;
    } else {
      const newPatient = await pool.query(
        `INSERT INTO patients (name, date_of_birth, gender) VALUES ('Spine Trauma Patient', '1988-06-20', 'FEMALE') RETURNING id`
      );
      testPatientId = newPatient.rows[0].id;
    }

    // Create SCI Case
    const createdCase = await SpinalCordInjuryService.createCase({
      patientId: testPatientId,
      neurologicalLevelOfInjury: 'C5',
      asiaImpairmentScale: 'A',
      motorScoreTotal: 22,
      sensoryScoreLightTouch: 40,
      sensoryScorePinprick: 38,
      sacralSparingSensory: false,
      sacralSparingMotor: false,
      bulbocavernosusReflexPresent: false,
      spinalShockActive: true,
      neurogenicShockActive: true,
      slicOrTlicsScore: 7,
      surgicalIndication: 'Operative Stabilization Indicated'
    });
    assert(createdCase && createdCase.id > 0, 'Spinal cord injury case persisted in database');

    const cases = await SpinalCordInjuryService.getCasesByPatient(testPatientId);
    assert(cases.length > 0, 'Retrieved stored SCI cases by patient ID');

    // Record AD Event
    const adEvent = await SpinalCordInjuryService.recordADEvent({
      caseId: createdCase.id,
      systolicBp: 185,
      diastolicBp: 105,
      heartRate: 48,
      suspectedTrigger: 'blocked_foley_catheter',
      symptoms: ['severe_headache', 'diaphoresis'],
      interventionsApplied: ['upright_positioning', 'foley_irrigated_300ml_drained', 'nitropaste_1_inch'],
      postInterventionSbp: 122,
      resolved: true
    });
    assert(adEvent && adEvent.id > 0, 'Autonomic dysreflexia event persisted');

    const adEvents = await SpinalCordInjuryService.getADEventsByCase(createdCase.id);
    assert(adEvents.length > 0, 'Retrieved AD events by case ID');

    console.log('\n====================================================');
    console.log(`📊 Phase 62 Test Results: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Unhandled test failure:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runSpinalCordInjuryTests();
