import { TeleIcuScribeService } from './services/teleIcuScribe';

async function runTests() {
  console.log('--- STARTING PHASE 67 TELE-ICU & AMBIENT SCRIBE INTEGRATION TESTS ---');
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
    // Test 1: CPOT Score Evaluation - Severe Pain (Total >= 6)
    const severeCpot = TeleIcuScribeService.evaluateCpotScore({
      facial_expression: 2, // Grimacing
      body_movements: 2, // Restlessness / pulling at tubes
      muscle_tension: 1, // Tense
      ventilator_compliance_or_vocalization: 2 // Fighting ventilator
    });
    assert(severeCpot.total_score === 7, 'CPOT: Total score 7 calculated correctly');
    assert(severeCpot.pain_level === 'severe', 'CPOT: Pain level classified as severe');
    assert(severeCpot.actionable_intervention.includes('CRITICAL'), 'CPOT: Actionable critical intervention generated');

    // Test 2: CPOT Score Evaluation - Moderate Pain (Score 3-5)
    const modCpot = TeleIcuScribeService.evaluateCpotScore({
      facial_expression: 1,
      body_movements: 1,
      muscle_tension: 1,
      ventilator_compliance_or_vocalization: 1
    });
    assert(modCpot.total_score === 4, 'CPOT: Total score 4 calculated correctly');
    assert(modCpot.pain_level === 'moderate', 'CPOT: Pain level classified as moderate');

    // Test 3: CPOT Score Evaluation - Minimal / No Pain (Score 0-2)
    const minCpot = TeleIcuScribeService.evaluateCpotScore({
      facial_expression: 0,
      body_movements: 0,
      muscle_tension: 0,
      ventilator_compliance_or_vocalization: 0
    });
    assert(minCpot.total_score === 0, 'CPOT: Total score 0 calculated correctly');
    assert(minCpot.pain_level === 'none_mild', 'CPOT: Pain level classified as none_mild');

    // Test 4: Ambient Audio SOAP Extraction
    const sampleTranscript = `Bedside RN: Intensivist, patient is opening eyes to voice, spontaneous tidal volume 450 mL.
Dr. Intensivist: Excellent, let's prepare for extubation later this morning once RSBI check is confirmed. Maintain current sedation hold.`;

    const soap = TeleIcuScribeService.extractSoapFromTranscript(sampleTranscript, {
      hr: 82,
      bp: '124/76',
      spo2: 99,
      temp: 36.8,
      pressor: 'Weaned off norepinephrine'
    });
    assert(Boolean(soap.subjective), 'Ambient SOAP: Subjective section generated');
    assert(soap.objective.includes('HR 82 bpm'), 'Ambient SOAP: Objective vitals incorporated');
    assert(soap.plan.some(p => p.includes('extubation')), 'Ambient SOAP: Extubation trigger identified in plan');
    assert(soap.critical_care_time_minutes === 45, 'Ambient SOAP: Critical care time documented');

    // Test 5: Ambient Audio Bleeding Trigger
    const bleedingTranscript = `Bedside RN: Patient has had 300 mL of dark blood from NG tube over the last hour.
Dr. Intensivist: Check stat hemoglobin and order transfusion if Hb drops below 7.`;
    const bleedingSoap = TeleIcuScribeService.extractSoapFromTranscript(bleedingTranscript);
    assert(bleedingSoap.plan.some(p => p.includes('PRBCs') || p.includes('bleeding')), 'Ambient SOAP: Transfusion trigger identified in plan');

    // Test 6: Database Persistence - Create Tele-ICU Session
    const session = await TeleIcuScribeService.createTeleIcuSession({
      patient_id: 1,
      bed_number: 'ICU-POD-04',
      virtual_intensivist_name: 'Dr. Rebecca Stone, MD, FCCM',
      webrtc_channel_id: 'channel-icu-pod4-live',
      high_acuity_alert: true,
      cpot_pain_score: 3,
      rass_agitation_score: 1
    });
    assert(Boolean(session.id), 'DB: Created Tele-ICU session with valid ID');
    assert(session.bed_number === 'ICU-POD-04', 'DB: Bed number preserved');
    assert(session.high_acuity_alert === true, 'DB: High acuity status preserved');

    // Test 7: Database Persistence - Record Ambient Transcript
    const transcriptRecord = await TeleIcuScribeService.recordScribeTranscript(
      session.id,
      sampleTranscript,
      { hr: 82, bp: '124/76', spo2: 99 }
    );
    assert(Boolean(transcriptRecord.transcript.id), 'DB: Recorded ambient transcript with valid ID');
    assert(transcriptRecord.soap.critical_care_time_minutes === 45, 'DB: SOAP extraction returned with record');

    // Test 8: Retrieve Patient Tele-ICU History
    const history = await TeleIcuScribeService.getPatientTeleIcuHistory(1);
    assert(history.sessions.length > 0, 'DB: Retrieved Tele-ICU sessions for patient 1');
    assert(history.transcripts.length > 0, 'DB: Retrieved ambient transcripts for patient 1');

    console.log(`\nPHASE 67 SUMMARY: ${passed} passed, ${failed} failed.`);
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
