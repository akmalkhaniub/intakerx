import { pool, bootstrap } from './db';
import * as acousticBiomarkersService from './services/acousticBiomarkers';

async function runAcousticBiomarkersTest() {
  console.log('====================================================');
  console.log('  IntakeRx Phase 39: Acoustic Biomarkers & Affect   ');
  console.log('====================================================\n');

  try {
    console.log('Initializing database bootstrap...');
    await bootstrap();

    // 1. Setup Patient and Session
    console.log('1. Setting up Tele-Intake Encounter...');
    const patientEmail = `vocal.patient.${Date.now()}@example.com`;
    const patientRes = await pool.query(`
      INSERT INTO patients (name, email, password_hash, dob, sex)
      VALUES ('Eleanor Vance', $1, 'hashed_pwd', '1958-04-12', 'Female')
      RETURNING id, name;
    `, [patientEmail]);
    const patient = patientRes.rows[0];

    const sessionRes = await pool.query(`
      INSERT INTO intake_sessions (id, patient_id, status, triage_level, triage_rationale)
      VALUES (gen_random_uuid(), $1, 'active', 'moderate', 'Progressive hoarseness and intermittent shortness of breath during exertion')
      RETURNING id;
    `, [patient.id]);
    const session = sessionRes.rows[0];

    console.log(`   ✔ Intake Session initialized [Session ID: ${session.id}, Patient: ${patient.name}]`);

    // 2. Test Normative Voice Profile
    console.log('\n2. Ingesting & Analyzing Normative Conversational Speech Sample...');
    const normalResult = await acousticBiomarkersService.analyzeAndRecordAcousticSession({
      sessionId: session.id,
      patientId: patient.id,
      audioDurationSeconds: 45.2,
      fundamentalFrequencyF0: 198.5, // Hz (normal female vocal pitch)
      f0StdDev: 28.4, // Hz
      jitterPercent: 0.62, // % (normal < 1.04%)
      shimmerPercent: 2.15, // % (normal < 3.81%)
      hnrDb: 24.8, // dB (normal > 20 dB)
      speechRateWpm: 138,
      pauseRatio: 0.18,
      respiratoryPauseCount: 0,
      transcriptSample: "Good morning doctor, I have been feeling fairly well over the weekend with my usual activities."
    });

    console.log(`   ✔ Session Recorded: ID = ${normalResult.id}`);
    console.log(`   ✔ Affective Tone: ${normalResult.affectiveTone}`);
    console.log(`   ✔ Clinical Flags Count: ${normalResult.clinicalScreenFlags.length} (Expected 0)`);
    console.log(`   ✔ Dysphonia Severity Index: ${normalResult.compositeScores.dysphoniaSeverityIndex}/100`);

    if (normalResult.clinicalScreenFlags.length !== 0) {
      throw new Error('Expected 0 flags for normative voice profile');
    }

    // 3. Test Pathologic Dysphonia & Vocal Cord Strain
    console.log('\n3. Ingesting & Analyzing Severe Vocal Cord Dysphonia & Glottal Incompetence...');
    const dysphoniaResult = await acousticBiomarkersService.analyzeAndRecordAcousticSession({
      sessionId: session.id,
      patientId: patient.id,
      audioDurationSeconds: 32.0,
      fundamentalFrequencyF0: 145.2,
      f0StdDev: 18.0,
      jitterPercent: 3.12, // elevated > 1.04%
      shimmerPercent: 7.85, // elevated > 3.81%
      hnrDb: 11.2, // severe turbulence < 15 dB
      speechRateWpm: 118,
      pauseRatio: 0.24,
      respiratoryPauseCount: 1,
      transcriptSample: "My voice has been very raspy and strained for the last three weeks, especially at night."
    });

    console.log(`   ✔ Session Recorded: ID = ${dysphoniaResult.id}`);
    console.log(`   ✔ Dysphonia Severity Index: ${dysphoniaResult.compositeScores.dysphoniaSeverityIndex}/100`);
    console.log(`   ✔ Clinical Screen Flags: ${dysphoniaResult.clinicalScreenFlags.map(f => f.marker).join(', ')}`);
    console.log(`   ✔ AI Summary Preview: ${dysphoniaResult.aiVocalSummary.substring(0, 110)}...`);

    const dysphoniaFlag = dysphoniaResult.clinicalScreenFlags.find(f => f.category === 'dysphonia');
    if (!dysphoniaFlag || dysphoniaFlag.severity !== 'high') {
      throw new Error('Expected high-severity dysphonia flag');
    }

    // 4. Test Acute Respiratory Dyspnea & Phonation Fragmentation
    console.log('\n4. Ingesting & Analyzing Acute Dyspneic Respiratory Speech Compromise...');
    const dyspneaResult = await acousticBiomarkersService.analyzeAndRecordAcousticSession({
      sessionId: session.id,
      patientId: patient.id,
      audioDurationSeconds: 28.5,
      fundamentalFrequencyF0: 215.0,
      f0StdDev: 32.0,
      jitterPercent: 0.95,
      shimmerPercent: 3.10,
      hnrDb: 21.0,
      speechRateWpm: 110,
      pauseRatio: 0.44, // high silence ratio > 0.35
      respiratoryPauseCount: 6, // frequent air hunger pauses >= 4
      transcriptSample: "I can't... catch my breath... when I try to... finish this sentence..."
    });

    console.log(`   ✔ Session Recorded: ID = ${dyspneaResult.id}`);
    console.log(`   ✔ Affective Tone: ${dyspneaResult.affectiveTone} (Expected dyspneic_interrupted)`);
    console.log(`   ✔ Respiratory Stress Index: ${dyspneaResult.compositeScores.respiratoryStressIndex}/100`);

    if (dyspneaResult.affectiveTone !== 'dyspneic_interrupted') {
      throw new Error('Expected affective tone to be dyspneic_interrupted');
    }

    // 5. Test Flat Affect & Psychomotor Retardation (Depression / Parkinsonian Prosody)
    console.log('\n5. Ingesting & Analyzing Blunted / Monotone Affect & Bradylalia...');
    const flatAffectResult = await acousticBiomarkersService.analyzeAndRecordAcousticSession({
      sessionId: session.id,
      patientId: patient.id,
      audioDurationSeconds: 40.0,
      fundamentalFrequencyF0: 115.0,
      f0StdDev: 9.4, // severely restricted pitch modulation < 15 Hz
      jitterPercent: 0.72,
      shimmerPercent: 2.30,
      hnrDb: 22.5,
      speechRateWpm: 78, // severe bradylalia < 105 WPM
      pauseRatio: 0.28,
      respiratoryPauseCount: 0,
      transcriptSample: "I have no energy. Everything feels empty. I don't see any reason to get out of bed."
    });

    console.log(`   ✔ Session Recorded: ID = ${flatAffectResult.id}`);
    console.log(`   ✔ Affective Tone: ${flatAffectResult.affectiveTone} (Expected flat_monotone)`);
    console.log(`   ✔ Psychomotor Slowing Score: ${flatAffectResult.compositeScores.psychomotorSlowingScore}/100`);

    if (flatAffectResult.affectiveTone !== 'flat_monotone') {
      throw new Error('Expected affective tone to be flat_monotone');
    }

    // 6. Query Session History and Single Session Details
    console.log('\n6. Querying Historical Voice Biomarker Sessions...');
    const allSessions = await acousticBiomarkersService.getAcousticSessions(patient.id);
    console.log(`   ✔ Total Sessions Retrieved for Patient: ${allSessions.length} (Expected 4)`);

    if (allSessions.length < 4) {
      throw new Error(`Expected at least 4 sessions, found ${allSessions.length}`);
    }

    const fetchedSession = await acousticBiomarkersService.getAcousticSessionById(dysphoniaResult.id!);
    console.log(`   ✔ Retrieved Single Session ID ${fetchedSession?.id}: Flags=${fetchedSession?.clinicalScreenFlags.length}`);

    if (!fetchedSession || fetchedSession.id !== dysphoniaResult.id) {
      throw new Error('Failed to retrieve specific acoustic session by ID');
    }

    console.log('\n====================================================');
    console.log('  Phase 39 Test Passed: 100% SUCCESS               ');
    console.log('====================================================\n');
  } catch (err) {
    console.error('\n❌ Test failed with error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runAcousticBiomarkersTest();
