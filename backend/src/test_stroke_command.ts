import { query, pool } from './db';
import { StrokeCommandService, NihssDetails } from './services/strokeCommand';

async function runStrokeCommandTest() {
  console.log('--- STARTING ACUTE STROKE CODE & NEUROVASCULAR COMMAND TEST (PHASE 51) ---');

  try {
    // 1. Create a dummy patient
    const testEmail = `stroke.patient.${Date.now()}@hospital.org`;
    const patientRes = await query(
      `INSERT INTO patients (name, email, password_hash, dob, sex)
       VALUES ($1, $2, 'hash123', '1958-04-12', 'female')
       RETURNING id, name`,
      ['Eleanor Vance', testEmail]
    );
    const patientId = patientRes.rows[0].id;
    console.log(`✔ Created dummy patient #${patientId} (${patientRes.rows[0].name})`);

    // 2. Test NIHSS scoring & neuroanatomical localization
    const nihssInput: NihssDetails = {
      loc1a: 1, // somnolent
      loc1b: 1, // 1 question wrong
      loc1c: 0, // performs both tasks
      bestGaze: 1, // partial gaze palsy
      visualFields: 2, // complete hemianopia
      facialPalsy: 2, // partial facial palsy
      motorLeftArm: 0, // no drift
      motorRightArm: 3, // some effort against gravity, drops
      motorLeftLeg: 0, // no drift
      motorRightLeg: 3, // falls to bed
      limbAtaxia: 0, // absent
      sensoryLoss: 1, // mild sensory loss
      bestLanguage: 2, // severe aphasia
      dysarthria: 1, // mild-to-moderate slurring
      extinctionInattention: 0 // no neglect
    };

    const nihssEval = StrokeCommandService.evaluateNihss(nihssInput);
    console.log(`✔ NIHSS Evaluated: Total Score = ${nihssEval.totalScore}/42 (${nihssEval.severity})`);
    console.log(`✔ Neuroanatomical Localization: ${nihssEval.localization}`);
    if (nihssEval.totalScore !== 17 || nihssEval.severity !== 'Moderate to Severe Stroke') {
      throw new Error(`Expected NIHSS score 17 and Moderate to Severe Stroke, got ${nihssEval.totalScore} and ${nihssEval.severity}`);
    }

    // 3. Test Thrombolysis candidacy & Tenecteplase calculation (Eligible Case)
    const now = new Date();
    const lkw = new Date(now.getTime() - 90 * 60 * 1000); // 1.5 hours ago
    const arrival = new Date(now.getTime() - 25 * 60 * 1000); // 25 mins ago

    const eligibleEval = StrokeCommandService.evaluateThrombolysis({
      patientWeightKg: 70,
      lastKnownWell: lkw,
      edArrivalTime: arrival,
      systolicBp: 165,
      diastolicBp: 92,
      bloodGlucoseMgDl: 135,
      plateletCount: 220000,
      inr: 1.05,
      onOralAnticoagulants: false,
      recentMajorSurgeryOrHeadTrauma: false,
      activeInternalBleeding: false,
      ctHemorrhagePresent: false,
      preferredAgent: 'tenecteplase'
    });

    console.log(`✔ Thrombolysis Safety Cleared: ${eligibleEval.safetyCleared} | Agent: ${eligibleEval.agentRecommended.toUpperCase()} ${eligibleEval.recommendedDoseMg} mg`);
    if (!eligibleEval.safetyCleared || eligibleEval.recommendedDoseMg !== 17.5) {
      throw new Error(`Expected safety clearance with 17.5 mg Tenecteplase, got ${JSON.stringify(eligibleEval)}`);
    }

    // 4. Test Thrombolysis Contraindications (Ineligible Case with SBP 198 and DOAC use)
    const contraindicationEval = StrokeCommandService.evaluateThrombolysis({
      patientWeightKg: 80,
      lastKnownWell: lkw,
      edArrivalTime: arrival,
      systolicBp: 198, // SBP >= 185 contraindication
      diastolicBp: 114, // DBP >= 110 contraindication
      bloodGlucoseMgDl: 110,
      plateletCount: 180000,
      inr: 1.1,
      onOralAnticoagulants: true, // DOAC contraindication
      recentMajorSurgeryOrHeadTrauma: false,
      activeInternalBleeding: false,
      ctHemorrhagePresent: false
    });

    console.log(`✔ Contraindicated Thrombolysis caught ${contraindicationEval.contraindications.length} safety alerts:`);
    contraindicationEval.contraindications.forEach((c) => console.log(`   - ${c}`));
    if (contraindicationEval.safetyCleared || contraindicationEval.contraindications.length < 2) {
      throw new Error('Failed to catch severe hypertension and oral anticoagulant contraindications');
    }

    // 5. Test Door-to-Needle (DTN) Calculator
    const bolusTime = new Date(arrival.getTime() + 32 * 60 * 1000); // 32 minutes from arrival
    const dtn = StrokeCommandService.calculateDoorToNeedle(arrival, bolusTime);
    console.log(`✔ Door-to-Needle Metric: ${dtn.dtnMinutes} minutes (Target Met: ${dtn.targetMet}, Tier: ${dtn.speedTier})`);
    if (dtn.dtnMinutes !== 32 || !dtn.targetMet) {
      throw new Error(`Expected DTN 32 min and targetMet=true, got ${dtn.dtnMinutes}`);
    }

    // 6. Test Endovascular Thrombectomy (EVT) Evaluation (LVO in Proximal MCA M1)
    const evtEval = StrokeCommandService.evaluateThrombectomy({
      nihssScore: nihssEval.totalScore, // 14
      aspectsScore: 8, // salvageable penumbra
      lvoDetected: true,
      lvoLocation: 'MCA_M1',
      hoursSinceLKW: 2.5
    });

    console.log(`✔ EVT Mechanical Thrombectomy Candidate: ${evtEval.candidate} (${evtEval.windowType})`);
    console.log(`   Rationale: ${evtEval.rationale}`);
    if (!evtEval.candidate || evtEval.windowType !== 'early_0_6h') {
      throw new Error('Expected candidate for early-window mechanical thrombectomy');
    }

    // 7. Persist Stroke Case to DB
    const strokeCase = await StrokeCommandService.createStrokeCase(patientId, {
      lastKnownWell: lkw,
      edArrivalTime: arrival,
      ctCompletionTime: new Date(arrival.getTime() + 15 * 60 * 1000),
      nihssDetails: nihssInput,
      strokeSubtype: 'Ischemic',
      aspectsScore: 8,
      lvoDetected: true,
      lvoLocation: 'MCA_M1',
      thrombolyticCandidate: true,
      thrombectomyCandidate: true
    });
    console.log(`✔ Persisted Stroke Code Case #${strokeCase.id} in DB`);

    // 8. Record Thrombolytic Checklist & Safety in DB
    const recordedEval = await StrokeCommandService.recordThrombolyticEvaluation(strokeCase.id, {
      patientWeightKg: 70,
      systolicBp: 165,
      diastolicBp: 92,
      bloodGlucoseMgDl: 135,
      plateletCount: 220000,
      inr: 1.05,
      onOralAnticoagulants: false,
      recentMajorSurgeryOrHeadTrauma: false,
      activeInternalBleeding: false,
      ctHemorrhagePresent: false,
      preferredAgent: 'tenecteplase'
    });
    console.log(`✔ Recorded Thrombolytic Evaluation #${recordedEval.evaluation.id} for Case #${strokeCase.id}`);

    // 9. Administer thrombolytic and log DTN
    const adminRes = await StrokeCommandService.recordThrombolyticAdministration(strokeCase.id, bolusTime);
    console.log(`✔ Administered Tenecteplase: DTN = ${adminRes.dtnMetrics.dtnMinutes} mins (Target Met: ${adminRes.dtnMetrics.targetMet})`);

    // 10. Update Thrombectomy status to Recanalization
    const evtStatus = await StrokeCommandService.updateThrombectomyStatus(strokeCase.id, 'tici_3_recanalization');
    console.log(`✔ Updated Thrombectomy status to: ${evtStatus.thrombectomy_status}`);

    // 11. Fetch all stroke cases
    const allCases = await StrokeCommandService.getStrokeCases(patientId);
    console.log(`✔ Verified query: retrieved ${allCases.length} case(s) for patient #${patientId}`);

    console.log('--- ALL PHASE 51 ACUTE STROKE COMMAND INTEGRATION TESTS PASSED (100% SUCCESS) ---');
  } catch (err) {
    console.error('❌ Phase 51 Integration Test Failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runStrokeCommandTest();
