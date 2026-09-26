import { pool, bootstrap } from './db';
import * as ConfService from './services/caseConferencing';

async function runCaseConferencingTests() {
  console.log('====================================================');
  console.log('  IntakeRx Multidisciplinary Case Conference Test    ');
  console.log('====================================================\n');

  try {
    console.log('Initializing database bootstrap...');
    await bootstrap();

    // 1. Setup Patient & Encounter
    console.log('1. Setting up complex diagnostic case for MDT review...');
    const patientRes = await pool.query(
      `INSERT INTO patients (name, email, password_hash, dob, sex)
       VALUES ('Eleanor Rigby', $1, 'hashedpwd', '1958-09-12', 'Female')
       RETURNING id`,
      [`eleanor.${Date.now()}@example.com`]
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
    console.log(`   ✔ Encounter initialized [Session: ${sessionId.slice(0, 8)}]`);

    // 2. Initialize Case Conference Room
    console.log('\n2. Initializing MDT Case Conference...');
    const conf = await ConfService.getOrCreateConference(sessionId, 'Cardiovascular & Thoracic Tumor Board');
    console.log(`   ✔ Case Conference created [ID: ${conf.id}]: "${conf.title}"`);
    console.log(`     Focus: ${conf.specialtyFocus} | Status: ${conf.status}`);
    console.log(`     Initial Baseline Note: "${conf.notes[0]?.recommendation.slice(0, 70)}..."`);

    // 3. Specialists Add Opinions and Diagnostic Votes
    console.log('\n3. Simulating Specialist Multi-Provider Contributions & Voting...');
    
    // Specialist 1: Interventional Cardiology
    const note1 = await ConfService.addConferenceNote(conf.id, {
      clinicianName: 'Dr. Marcus Brody, MD (Interventional Cardiology)',
      specialty: 'Cardiology',
      recommendation: 'Coronary anatomy shows diffuse non-obstructive disease on previous records. Elevated troponin suggests acute myocarditis over ischemic plaque rupture.',
      voteDiagnosis: 'Acute Myocarditis',
      urgency: 'stat'
    });
    console.log(`   ✔ Added note from ${note1.clinicianName} [Vote: ${note1.voteDiagnosis}]`);

    // Specialist 2: Diagnostic Radiology
    const note2 = await ConfService.addConferenceNote(conf.id, {
      clinicianName: 'Dr. Helen Cho, MD (Cardiothoracic Radiology)',
      specialty: 'Radiology',
      recommendation: 'Contrast-enhanced cardiac MRI demonstrates patchy late gadolinium enhancement in the epicardial layer. No ischemic subendocardial scar.',
      voteDiagnosis: 'Acute Myocarditis',
      urgency: 'urgent'
    });
    console.log(`   ✔ Added note from ${note2.clinicianName} [Vote: ${note2.voteDiagnosis}]`);

    // Specialist 3: Critical Care
    const note3 = await ConfService.addConferenceNote(conf.id, {
      clinicianName: 'Dr. Liam Patel, MD (Cardiac Intensive Care)',
      specialty: 'Critical Care',
      recommendation: 'Concur with myocarditis diagnosis. Admit to CICU for telemetry, start colchicine and NSAIDs, hold beta-blocker titration until hemodynamics stabilize.',
      voteDiagnosis: 'Acute Myocarditis',
      urgency: 'urgent'
    });
    console.log(`   ✔ Added note from ${note3.clinicianName} [Vote: ${note3.voteDiagnosis}]`);

    // 4. Verify Voting Distribution
    console.log('\n4. Verifying Diagnostic Consensus Voting Breakdown...');
    const updatedConf = await ConfService.getConference(conf.id);
    if (!updatedConf) throw new Error('Conference retrieval failed.');

    console.log(`   - Total Specialist Contributions: ${updatedConf.notes.length}`);
    console.log(`   - Consensus Voting Distribution:`);
    for (const v of updatedConf.votingBreakdown) {
      console.log(`     • ${v.diagnosis}: ${v.voteCount} votes (${v.percentage}%)`);
    }

    const topVote = updatedConf.votingBreakdown[0];
    if (topVote.diagnosis !== 'Acute Myocarditis' || topVote.voteCount < 3) {
      throw new Error(`Expected Acute Myocarditis majority vote, got ${topVote.diagnosis}`);
    }
    console.log(`   ✔ Consensus clear: Acute Myocarditis holds 75% majority vote.`);

    // 5. Finalize Consensus Note
    console.log('\n5. Attending Clinician Signs Off MDT Consensus Note...');
    const finalized = await ConfService.finalizeConsensus(
      conf.id,
      'Acute Viral Myocarditis with Preserved Left Ventricular Ejection Fraction',
      'The Multidisciplinary Case Review Board unanimously concurs with Acute Myocarditis based on CMR late gadolinium enhancement and non-obstructive coronary angiography. Patient admitted to CICU under cardioprotective monitoring protocol.'
    );

    console.log(`   ✔ Conference status: ${finalized.status} (Finalized At: ${finalized.finalizedAt})`);
    console.log(`   ✔ Final Consensus Diagnosis: "${finalized.consensusDiagnosis}"`);
    console.log(`   ✔ Consensus Summary: "${finalized.consensusSummary}"`);

    console.log('\n✔ MULTIDISCIPLINARY TEAM CASE CONFERENCING TEST PASSED 100%!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test failed with error:', err);
    process.exit(1);
  }
}

runCaseConferencingTests();
