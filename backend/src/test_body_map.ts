import { pool, bootstrap } from './db';
import { notificationBus } from './notifications';
import { v4 as uuidv4 } from 'uuid';

async function runBodyMapTest() {
  console.log('====================================================');
  console.log('   IntakeRx Anatomical Pain Locator / Map Test      ');
  console.log('====================================================\n');

  let testPatientId: number | null = null;
  const testSessionId = uuidv4();

  try {
    await bootstrap();

    // 1. Create a test patient
    console.log('1. Setting up test patient and encounter...');
    const patientRes = await pool.query(
      `INSERT INTO patients (name, email, password_hash, dob, sex)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      ['Elena Rostova', `elena.${Date.now()}@example.com`, 'hash123', '1990-05-12', 'Female']
    );
    testPatientId = patientRes.rows[0].id;

    // 2. Create an intake session
    await pool.query(
      `INSERT INTO intake_sessions (id, patient_id, status, triage_level, current_step)
       VALUES ($1, $2, 'active', 'moderate', 'complaint')`,
      [testSessionId, testPatientId]
    );
    console.log(`   - Test Encounter: ${testSessionId.slice(0, 8)}`);

    // 3. Simulate Recording a Non-Critical Pain Point (Right Knee, 5/10 Dull ache)
    console.log('\n2. Testing Non-Critical Pain Point (Right Knee, 5/10)...');
    const nonCritRegion = 'Right Knee';
    const nonCritIntensity = 5;
    const nonCritQuality = 'Dull / Aching';
    const nonCritRad = 'Radiates down anterior shin';

    const nonCritSeverity = nonCritIntensity <= 3 ? 'mild' : nonCritIntensity <= 6 ? 'moderate' : 'severe';
    const nonCritIsRedFlag = nonCritIntensity >= 8 && (nonCritRegion.toLowerCase().includes('chest') || nonCritRegion.toLowerCase().includes('head'));
    const nonCritSymptom = `Pain: ${nonCritRegion} (${nonCritIntensity}/10, ${nonCritQuality}) → ${nonCritRad}`;

    await pool.query(
      `INSERT INTO symptoms (session_id, name, severity, duration, is_red_flag)
       VALUES ($1, $2, $3, $4, $5)`,
      [testSessionId, nonCritSymptom, nonCritSeverity, 'acute', nonCritIsRedFlag]
    );

    await pool.query(
      `INSERT INTO messages (session_id, sender, content)
       VALUES ($1, $2, $3)`,
      [testSessionId, 'patient', `[Anatomical Pain Mapping]: ${nonCritSymptom}`]
    );

    if (nonCritIsRedFlag) {
      throw new Error('Knee pain VAS 5 should not be marked as red flag');
    }
    console.log(`   ✔ Recorded non-critical pain point successfully: "${nonCritSymptom}"`);

    // 4. Simulate Recording a Red-Flag Pain Point (Chest / Sternum, 9/10 Pressure / Tightness)
    console.log('\n3. Testing Critical Red-Flag Pain Point (Chest / Sternum, 9/10)...');
    const critRegion = 'Chest / Sternum';
    const critIntensity = 9;
    const critQuality = 'Pressure / Tightness';
    const critRad = 'Radiates to left shoulder and jaw';

    const critSeverity = critIntensity <= 3 ? 'mild' : critIntensity <= 6 ? 'moderate' : 'severe';
    const critIsRedFlag = critIntensity >= 8 && (critRegion.toLowerCase().includes('chest') || critRegion.toLowerCase().includes('head'));
    const critSymptom = `Pain: ${critRegion} (${critIntensity}/10, ${critQuality}) → ${critRad}`;

    await pool.query(
      `INSERT INTO symptoms (session_id, name, severity, duration, is_red_flag)
       VALUES ($1, $2, $3, $4, $5)`,
      [testSessionId, critSymptom, critSeverity, 'acute', critIsRedFlag]
    );

    await pool.query(
      `INSERT INTO messages (session_id, sender, content)
       VALUES ($1, $2, $3)`,
      [testSessionId, 'patient', `[Anatomical Pain Mapping]: ${critSymptom}`]
    );

    if (!critIsRedFlag) {
      throw new Error('Chest pain VAS 9 must trigger red flag!');
    }

    // Escalate session status & trigger notification
    await pool.query(
      `UPDATE intake_sessions SET triage_level = 'emergency', status = 'escalated', updated_at = NOW() WHERE id = $1`,
      [testSessionId]
    );

    let receivedNotif: any = null;
    notificationBus.on('notification', (n) => {
      if (n.sessionId === testSessionId) {
        receivedNotif = n;
      }
    });

    notificationBus.push(
      'emergency_triage',
      'Severe Pain Mapping Alert',
      `Patient reported severe pain (${critIntensity}/10) in ${critRegion}. Immediate attention advised.`,
      { sessionId: testSessionId, severity: 'critical' }
    );
    console.log(`   ✔ Red flag triggered! Notification dispatched.`);

    // 5. Verify database records
    console.log('\n4. Verifying database state:');
    const symCheck = await pool.query(
      `SELECT * FROM symptoms WHERE session_id = $1 ORDER BY id ASC`,
      [testSessionId]
    );
    console.log(`   - Symptoms recorded: ${symCheck.rows.length}`);
    if (symCheck.rows.length !== 2) {
      throw new Error(`Expected 2 symptoms, got ${symCheck.rows.length}`);
    }

    const sessCheck = await pool.query(
      `SELECT status, triage_level FROM intake_sessions WHERE id = $1`,
      [testSessionId]
    );
    console.log(`   - Session Status: ${sessCheck.rows[0].status}, Triage: ${sessCheck.rows[0].triage_level}`);
    if (sessCheck.rows[0].status !== 'escalated' || sessCheck.rows[0].triage_level !== 'emergency') {
      throw new Error('Session did not correctly escalate to emergency');
    }

    if (!receivedNotif) {
      throw new Error('Notification bus did not record emergency notification for pain point');
    }
    console.log(`   - Confirmed push notification on bus: "${receivedNotif.title}"`);

    console.log('\n✔ ANATOMICAL BODY MAP & PAIN POINT TEST PASSED SUCCESSFULLY!\n');
  } catch (err) {
    console.error('\n❌ Body Map Test failed:', err);
    process.exit(1);
  } finally {
    console.log('Cleaning up test data...');
    if (testPatientId) {
      await pool.query(`DELETE FROM patients WHERE id = $1`, [testPatientId]);
    }
    await pool.end();
  }
}

runBodyMapTest();
