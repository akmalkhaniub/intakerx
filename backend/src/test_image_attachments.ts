import { pool, bootstrap } from './db';
import { VisualTriageService } from './services/visualTriage';
import { notificationBus } from './notifications';
import { v4 as uuidv4 } from 'uuid';

async function runImageAttachmentsTest() {
  console.log('====================================================');
  console.log('  IntakeRx Medical Photo & Visual Triage Test       ');
  console.log('====================================================\n');

  let testPatientId: number | null = null;
  const testSessionId = uuidv4();

  try {
    await bootstrap();

    // 1. Setup Patient and Encounter
    console.log('1. Setting up test patient and encounter...');
    const patientRes = await pool.query(
      `INSERT INTO patients (name, email, password_hash, dob, sex)
       VALUES ($1, $2, 'dummyhash', '1992-03-15', 'Female')
       RETURNING id`,
      ['Chloe Bennett', `chloe.${Date.now()}@example.com`]
    );
    testPatientId = patientRes.rows[0].id;

    await pool.query(
      `INSERT INTO intake_sessions (id, patient_id, status, triage_level, current_step)
       VALUES ($1, $2, 'active', 'routine', 'complaint')`,
      [testSessionId, testPatientId]
    );
    console.log(`   ✔ Encounter initialized [ID: ${testSessionId.slice(0, 8)}]`);

    // 2. Attach Non-Critical Medical Image (Localized insect bite on arm)
    console.log('\n2. Testing Non-Critical Photo Attachment (Localized insect bite)...');
    const dummyBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const res1 = await VisualTriageService.attachImage(testSessionId, {
      fileName: 'insect_bite_left_forearm.png',
      mimeType: 'image/png',
      fileSize: 1024,
      dataUrl: dummyBase64,
      caption: 'Mild red bite on left forearm with slight itch, no fever'
    });

    console.log(`   - Attachment ID: ${res1.attachment.id}`);
    console.log(`   - Visual Tags: ${res1.triage.visualTags.join(', ')}`);
    console.log(`   - Triage Severity: ${res1.triage.triageSeverity}, isRedFlag: ${res1.triage.isRedFlag}`);

    if (res1.triage.isRedFlag !== false || res1.triage.triageSeverity !== 'moderate') {
      throw new Error(`Expected isRedFlag=false and severity='moderate' for insect bite, got ${res1.triage.triageSeverity}`);
    }
    console.log('   ✔ Non-critical image correctly triaged.');

    // 3. Attach Critical Red-Flag Medical Image (Spreading erythema / black necrotic tissue)
    console.log('\n3. Testing Critical Red-Flag Photo Attachment (Rapidly spreading erythema)...');
    let alertDispatched = false;
    const notifHandler = (n: any) => {
      if (n.sessionId === testSessionId) {
        alertDispatched = true;
      }
    };
    notificationBus.on('notification', notifHandler);

    const res2 = await VisualTriageService.attachImage(testSessionId, {
      fileName: 'lower_leg_rash.jpg',
      mimeType: 'image/jpeg',
      fileSize: 2048,
      dataUrl: dummyBase64,
      caption: 'Rapidly spreading erythema across lower leg with black necrotic center and severe pain'
    });

    console.log(`   - Attachment ID: ${res2.attachment.id}`);
    console.log(`   - Visual Tags: ${res2.triage.visualTags.join(', ')}`);
    console.log(`   - Observations: ${res2.triage.clinicalObservations.join('; ')}`);
    console.log(`   - Triage Severity: ${res2.triage.triageSeverity}, isRedFlag: ${res2.triage.isRedFlag}`);

    if (res2.triage.isRedFlag !== true || res2.triage.triageSeverity !== 'emergency') {
      throw new Error('Expected isRedFlag=true and emergency severity for spreading erythema & necrosis');
    }

    if (!alertDispatched) {
      throw new Error('Critical visual symptom notification was not dispatched on notificationBus!');
    }
    console.log('   ✔ Critical red-flag visual finding escalated encounter to emergency.');

    // 4. Verify Session Status & Database Records
    console.log('\n4. Verifying Session Escalation & Retrieval...');
    const sessCheck = await pool.query(
      `SELECT status, triage_level FROM intake_sessions WHERE id = $1`,
      [testSessionId]
    );
    console.log(`   - Updated Session Status: ${sessCheck.rows[0].status}, Triage: ${sessCheck.rows[0].triage_level}`);
    if (sessCheck.rows[0].status !== 'escalated' || sessCheck.rows[0].triage_level !== 'emergency') {
      throw new Error('Session was not escalated in database');
    }

    const attachmentsList = await VisualTriageService.getAttachmentsForSession(testSessionId);
    console.log(`   - Attachments stored: ${attachmentsList.length}`);
    if (attachmentsList.length !== 2) {
      throw new Error(`Expected 2 attachments, found ${attachmentsList.length}`);
    }

    const messages = await pool.query(
      `SELECT * FROM messages WHERE session_id = $1 AND content LIKE '%Medical Photo Attached%'`,
      [testSessionId]
    );
    console.log(`   - Chat messages with photo notifications: ${messages.rows.length}`);
    if (messages.rows.length !== 2) {
      throw new Error(`Expected 2 photo chat messages, found ${messages.rows.length}`);
    }

    notificationBus.removeListener('notification', notifHandler);
    console.log('\n✔ MEDICAL IMAGE & VISUAL TRIAGE TEST PASSED 100%!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Medical image test failed:', err);
    process.exit(1);
  } finally {
    console.log('Cleaning up test data...');
    if (testPatientId) {
      await pool.query(`DELETE FROM patients WHERE id = $1`, [testPatientId]);
    }
    await pool.end();
  }
}

runImageAttachmentsTest();
