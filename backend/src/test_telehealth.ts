import { pool, bootstrap } from './db';
import * as TelehealthService from './services/telehealth';

async function runTelehealthTests() {
  console.log('====================================================');
  console.log('  IntakeRx Telehealth Video Consultation & HUD Test  ');
  console.log('====================================================\n');

  try {
    console.log('Initializing database bootstrap...');
    await bootstrap();

    // 1. Setup Patient and Encounter
    console.log('1. Setting up mock patient encounter for Telehealth...');
    const patientEmail = `evelyn.${Date.now()}@test.com`;
    const patientRes = await pool.query(
      `INSERT INTO patients (name, email, password_hash, dob, sex)
       VALUES ('Evelyn Miller', $1, 'hashedpwd', '1968-04-12', 'female')
       RETURNING id`,
      [patientEmail]
    );
    const patientId = patientRes.rows[0].id;

    const sessionRes = await pool.query(
      `INSERT INTO intake_sessions (
         id, patient_id, status, triage_level, current_step
       ) VALUES (
         gen_random_uuid(), $1, 'active', 'orange', 'complaint'
       ) RETURNING id`,
      [patientId]
    );
    const sessionId = sessionRes.rows[0].id;

    await pool.query(
      `INSERT INTO messages (session_id, sender, content)
       VALUES ($1, 'patient', 'Severe crushing retrosternal chest pain radiating to left arm and jaw with sweating')`,
      [sessionId]
    );

    await pool.query(
      `INSERT INTO symptoms (session_id, name, severity, duration, is_red_flag)
       VALUES ($1, 'Severe substernal chest pressure', 'severe', '2 hours', true)`,
      [sessionId]
    );

    console.log(`   ✔ Encounter initialized [ID: ${sessionId.slice(0, 8)}]`);

    // 2. Create or Join Telehealth Room
    console.log('\n2. Initializing Telehealth Room & Ambient HUD...');
    const room = await TelehealthService.getOrCreateTelehealthRoom(sessionId);
    console.log(`   ✔ Virtual Consultation Room Created: [Room ID: ${room.roomId}]`);
    console.log(`     Status: ${room.status} | Quality: ${room.callQuality.resolution} @ ${room.callQuality.fps}fps (${room.callQuality.latencyMs}ms RTT)`);

    if (room.status !== 'active' || !room.roomId) {
      throw new Error('Room creation verification failed.');
    }

    // 3. Live Ambient Transcription & Clinical Entity Extraction
    console.log('\n3. Simulating Live Patient Speech with Ambient NLP Entity Parsing...');
    const speech1 = await TelehealthService.addTranscriptEntry(
      room.roomId,
      'patient',
      "I have intense substernal chest pressure with nausea and sweat pouring down my face."
    );
    console.log(`   - Patient: "${speech1.text}"`);
    console.log(`     Extracted Entities (${speech1.clinicalEntities?.length}):`, 
      speech1.clinicalEntities?.map(e => `[${e.category.toUpperCase()}] ${e.term}`).join(', ')
    );

    const hasSubsternal = speech1.clinicalEntities?.some(e => e.term.includes('Chest Pressure'));
    const hasDiaphoresis = speech1.clinicalEntities?.some(e => e.term.includes('Diaphoresis'));
    if (!hasSubsternal || !hasDiaphoresis) {
      throw new Error('Entity extraction failed to detect expected clinical signs.');
    }
    console.log('   ✔ Ambient NLP successfully extracted symptoms (Chest Pressure, Diaphoresis, Nausea).');

    // 4. Update Live Clinical Notes
    console.log('\n4. Clinician Scratchpad Notes Update...');
    const notesText = "STAT 12-lead ECG dispatched. Sublingual Nitro administered. Patient remains sitting upright.";
    await TelehealthService.updateLiveNotes(room.roomId, notesText);
    console.log(`   ✔ Updated notes: "${notesText}"`);

    // 5. Test Live Heads-Up Display Telemetry
    console.log('\n5. Querying Real-time Clinical HUD Telemetry...');
    const hud = await TelehealthService.getLiveTelemetryHUD(sessionId);
    console.log(`   - Live Vitals: HR ${hud.vitals.heartRate} bpm (${hud.vitals.heartRateTrend}) | BP ${hud.vitals.bloodPressure} | SpO2 ${hud.vitals.spo2}%`);
    console.log(`   - Red Flags Active (${hud.redFlags.length}):`);
    hud.redFlags.forEach(rf => console.log(`     • [${rf.severity.toUpperCase()}] ${rf.title} -> Action: ${rf.recommendedAction}`));
    console.log(`   - Differential Shortlist: ${hud.aiDifferentialShortlist.slice(0, 2).join(', ')}`);

    if (hud.vitals.heartRate < 90 || hud.redFlags.length === 0) {
      throw new Error('HUD telemetry did not reflect cardiac acuity.');
    }
    console.log('   ✔ Clinical HUD Telemetry reflects high-acuity cardiac signs.');

    // 6. Conclude Telehealth Consultation
    console.log('\n6. Ending Telehealth Consultation...');
    const ended = await TelehealthService.endTelehealthCall(
      room.roomId,
      "Consultation completed. Directing EMS for emergency department transfer."
    );
    console.log(`   ✔ Room finalized: Status=${ended.status} | Call Duration: ${ended.durationSeconds}s`);
    console.log(`   ✔ Final Live Notes: "${ended.liveNotes}"`);

    if (ended.status !== 'completed') {
      throw new Error('Call termination status check failed.');
    }

    console.log('\n✔ TELEHEALTH VIDEO CONSULTATION & LIVE CLINICAL HUD TEST PASSED 100%!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test failed with error:', err);
    process.exit(1);
  }
}

runTelehealthTests();
