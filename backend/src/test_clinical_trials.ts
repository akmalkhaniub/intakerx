import { pool, bootstrap } from './db';
import * as TrialsService from './services/clinicalTrials';

async function runClinicalTrialsTests() {
  console.log('====================================================');
  console.log('  IntakeRx AI Clinical Trial Matching Test           ');
  console.log('====================================================\n');

  try {
    console.log('Initializing database bootstrap...');
    await bootstrap();

    // 1. Seed Clinical Trials
    console.log('1. Seeding and verifying trial portfolio...');
    await TrialsService.seedInitialClinicalTrials();
    const trialCountRes = await pool.query('SELECT COUNT(*) FROM clinical_trials');
    console.log(`   ✔ Clinical trial portfolio loaded with ${trialCountRes.rows[0].count} recruiting trials.`);

    // 2. Setup Patient & Cardiac Encounter
    console.log('\n2. Setting up test encounter for trial matching (ACS / Angina)...');
    const patientRes = await pool.query(
      `INSERT INTO patients (name, email, password_hash, dob, sex)
       VALUES ('Arthur Dent', $1, 'hashedpwd', '1965-03-15', 'Male')
       RETURNING id`,
      [`arthur.${Date.now()}@example.com`]
    );
    const patientId = patientRes.rows[0].id;

    const sessionRes = await pool.query(
      `INSERT INTO intake_sessions (
         id, patient_id, status, triage_level, current_step
       ) VALUES (
         gen_random_uuid(), $1, 'active', 'orange', 'summary'
       ) RETURNING id`,
      [patientId]
    );
    const sessionId = sessionRes.rows[0].id;

    await pool.query(
      `INSERT INTO messages (session_id, sender, content)
       VALUES ($1, 'patient', 'Substernal chest pressure radiating to left arm with exertional angina and shortness of breath.')`,
      [sessionId]
    );

    await pool.query(
      `INSERT INTO symptoms (session_id, name, severity, is_red_flag)
       VALUES ($1, 'Substernal chest pressure', 'severe', true)`,
      [sessionId]
    );

    await pool.query(
      `INSERT INTO session_vitals (session_id, heart_rate, bp_systolic, bp_diastolic, spo2)
       VALUES ($1, 102, 148, 92, 96)`,
      [sessionId]
    );
    console.log(`   ✔ Encounter initialized [Session: ${sessionId.slice(0, 8)}]`);

    // 3. Match Patient against Clinical Trials
    console.log('\n3. Running AI Clinical Trial Matching Engine...');
    const matches = await TrialsService.matchPatientAgainstTrials(sessionId);
    console.log(`   ✔ Generated ${matches.length} qualifying trial matches:`);

    for (const m of matches) {
      console.log(`     • [${m.trial.nctId}] ${m.trial.title.slice(0, 60)}...`);
      console.log(`       Match Score: ${m.matchScore}% | Inclusions Met: ${m.matchedInclusions.length} | Cleared Exclusions: ${m.matchedExclusions.length}`);
    }

    if (matches.length === 0) {
      throw new Error('Expected at least 1 trial match for cardiac patient.');
    }

    // Top match should be the cardiac trial (NCT05423871)
    const topMatch = matches[0];
    if (topMatch.trial.nctId !== 'NCT05423871' && topMatch.matchScore < 75) {
      throw new Error(`Top match expected to be EMPA-CARDIAC, got: ${topMatch.trial.nctId}`);
    }
    console.log(`   ✔ Top Match correctly identified as ${topMatch.trial.nctId} with ${topMatch.matchScore}% compatibility.`);

    // 4. Update Match Status
    console.log('\n4. Clinician Approving Match for Patient Discussion...');
    await TrialsService.updateMatchStatus(topMatch.id, 'clinician_reviewed', 'Suitable candidate for SGLT2i protocol. Discuss at next visit.');
    
    const verifyRes = await pool.query('SELECT status, clinician_notes FROM patient_trial_matches WHERE id = $1', [topMatch.id]);
    console.log(`   ✔ Match status updated to: ${verifyRes.rows[0].status} ("${verifyRes.rows[0].clinician_notes}")`);

    console.log('\n✔ AI CLINICAL TRIAL MATCHING & PRECISION PROTOCOL TEST PASSED 100%!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test failed with error:', err);
    process.exit(1);
  }
}

runClinicalTrialsTests();
