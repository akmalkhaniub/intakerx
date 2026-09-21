import { pool, bootstrap } from './db';
import { FollowUpService } from './services/followUp';
import { notificationBus } from './notifications';
import { v4 as uuidv4 } from 'uuid';

async function runFollowUpTest() {
  console.log('====================================================');
  console.log('  IntakeRx Post-Visit Follow-Up & Tracker Test      ');
  console.log('====================================================\n');

  let testPatientId: number | null = null;
  const testSessionId = uuidv4();

  try {
    await bootstrap();

    // 1. Setup Patient and Encounter
    console.log('1. Setting up test patient and encounter...');
    const patientRes = await pool.query(
      `INSERT INTO patients (name, email, password_hash, dob, sex)
       VALUES ($1, $2, 'dummyhash', '1975-08-22', 'Male')
       RETURNING id`,
      ['Marcus Vance', `marcus.${Date.now()}@example.com`]
    );
    testPatientId = patientRes.rows[0].id;

    await pool.query(
      `INSERT INTO intake_sessions (id, patient_id, status, triage_level, current_step)
       VALUES ($1, $2, 'completed', 'moderate', 'completed')`,
      [testSessionId, testPatientId]
    );
    console.log(`   ✔ Encounter initialized [ID: ${testSessionId.slice(0, 8)}]`);

    // 2. Schedule Cardiac Intensive Protocol (3 automated check-ins)
    console.log('\n2. Testing Automated Follow-Up Protocol Scheduling (cardiac_intensive)...');
    const schedules = await FollowUpService.scheduleProtocol(testSessionId, 'cardiac_intensive');
    console.log(`   - Scheduled Check-ins Count: ${schedules.length}`);
    if (schedules.length !== 3) {
      throw new Error(`Expected 3 check-ins for cardiac_intensive protocol, got ${schedules.length}`);
    }

    schedules.forEach(s => {
      console.log(`     • Day ${s.intervalDays} [${s.surveyType}]: Status="${s.status}" | Notes="${s.clinicianNotes}"`);
    });
    console.log('   ✔ Successfully scheduled multi-tier follow-up protocol in database.');

    // 3. Test Normal Patient Check-in Response (Slightly better, adherent)
    console.log('\n3. Testing Patient Response (Positive Progression)...');
    const day1Schedule = schedules[0];
    const res1 = await FollowUpService.recordPatientResponse(day1Schedule.id, {
      severityChange: 'slightly_better',
      symptomsResolved: false,
      takingMedsAsPrescribed: true,
      notes: 'Chest tightness has significantly diminished after resting and taking metoprolol.'
    });

    console.log(`   - Response Status: ${res1.followup.status}, Escalated: ${res1.escalated}`);
    if (res1.followup.status !== 'responded' || res1.escalated !== false) {
      throw new Error(`Expected status 'responded' and escalated false, got status: ${res1.followup.status}, escalated: ${res1.escalated}`);
    }
    console.log('   ✔ Positive check-in recorded without unwarranted escalation.');

    // 4. Test Deterioration Response (Worse, adverse effect, triggers escalation)
    console.log('\n4. Testing Deterioration & Red-Flag Escalation Response...');
    let alertDispatched = false;
    const notifHandler = (n: any) => {
      if (n.sessionId === testSessionId) {
        alertDispatched = true;
      }
    };
    notificationBus.on('notification', notifHandler);

    const day3Schedule = schedules[1];
    const res2 = await FollowUpService.recordPatientResponse(day3Schedule.id, {
      severityChange: 'much_worse',
      symptomsResolved: false,
      takingMedsAsPrescribed: false,
      adverseEffectsReported: 'Severe dizziness and orthostatic nausea upon standing',
      notes: 'Pain returned with vengeance and radiates down left arm again.'
    });

    console.log(`   - Response Status: ${res2.followup.status}, Escalated: ${res2.escalated}`);
    if (res2.followup.status !== 'escalated' || res2.escalated !== true) {
      throw new Error(`Expected status 'escalated' and escalated true for clinical deterioration!`);
    }

    if (!alertDispatched) {
      throw new Error('Follow-up deterioration alert was not dispatched to clinician notification bus!');
    }
    console.log('   ✔ Deterioration triggered urgent clinician alert notification.');

    // 5. Test Querying Follow-Ups
    console.log('\n5. Verifying Query Interfaces...');
    const sessionList = await FollowUpService.getFollowUpsForSession(testSessionId);
    if (sessionList.length !== 3) {
      throw new Error(`Expected 3 session follow-ups, got ${sessionList.length}`);
    }

    const escalatedList = await FollowUpService.getAllFollowUps('escalated');
    const found = escalatedList.find(f => f.sessionId === testSessionId);
    if (!found) {
      throw new Error('Escalated follow-up not found in filtered clinic query');
    }
    console.log(`   ✔ Filtered query returned escalated follow-up for patient ${found.patientName}.`);

    notificationBus.removeListener('notification', notifHandler);
    console.log('\n✔ AUTOMATED FOLLOW-UP & TRACKER TEST PASSED WITH 100% SUCCESS!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Follow-Up Test failed:', err);
    process.exit(1);
  } finally {
    console.log('Cleaning up test data...');
    if (testPatientId) {
      await pool.query(`DELETE FROM patients WHERE id = $1`, [testPatientId]);
    }
    await pool.end();
  }
}

runFollowUpTest();
