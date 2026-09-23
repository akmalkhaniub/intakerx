import { pool, bootstrap } from './db';
import * as PortalService from './services/patientPortal';

async function runPatientPortalTests() {
  console.log('====================================================');
  console.log('  IntakeRx Patient Health Portal & Wearables Test    ');
  console.log('====================================================\n');

  try {
    console.log('Initializing database bootstrap...');
    await bootstrap();

    // 1. Setup Test Patient
    console.log('1. Setting up patient for Health Portal testing...');
    const email = `marcus.vance.${Date.now()}@example.com`;
    const patientRes = await pool.query(
      `INSERT INTO patients (name, email, password_hash, dob, sex)
       VALUES ('Marcus Vance', $1, 'hashedpwd', '1985-06-20', 'Male')
       RETURNING id`,
      [email]
    );
    const patientId = patientRes.rows[0].id;
    console.log(`   ✔ Patient created: Marcus Vance [ID: ${patientId}]`);

    // 2. Setup Intake Encounter for Patient
    console.log('\n2. Creating completed clinical encounter for portal view...');
    const sessionRes = await pool.query(
      `INSERT INTO intake_sessions (
         id, patient_id, status, triage_level, current_step
       ) VALUES (
         gen_random_uuid(), $1, 'completed', 'green', 'summary'
       ) RETURNING id`,
      [patientId]
    );
    const sessionId = sessionRes.rows[0].id;

    await pool.query(
      `INSERT INTO messages (session_id, sender, content)
       VALUES ($1, 'patient', 'Routine physical and cardiology wellness checkup.')`,
      [sessionId]
    );
    console.log(`   ✔ Encounter attached [Session: ${sessionId.slice(0, 8)}]`);

    // 3. Test Wearable Biometrics Ingestion (Apple Health / HealthKit)
    console.log('\n3. Ingesting Wearable Biometrics from Apple Health...');
    const appleHealthRecord = await PortalService.syncWearableBiometrics(
      patientId,
      'Apple Watch Series 9 (HealthKit)',
      {
        hrvMs: 42,
        restingHr: 64,
        stepCount: 8420,
        sleepHours: 7.4,
        sleepScore: 88,
        nightlySpo2: 97.5,
        ecgClassification: 'sinus_rhythm'
      }
    );
    console.log(`   ✔ Apple Health Sync Successful:`);
    console.log(`     - Device: ${appleHealthRecord.sourceDevice}`);
    console.log(`     - HRV: ${appleHealthRecord.hrvMs}ms | Resting HR: ${appleHealthRecord.restingHr} bpm | Steps: ${appleHealthRecord.stepCount}`);
    console.log(`     - Sleep: ${appleHealthRecord.sleepHours} hrs (Score: ${appleHealthRecord.sleepScore}) | Nightly SpO2: ${appleHealthRecord.nightlySpo2}%`);

    if (appleHealthRecord.hrvMs !== 42 || appleHealthRecord.restingHr !== 64) {
      throw new Error('Apple Health biometric ingestion values do not match.');
    }

    // 4. Test Ingestion with Anomaly (Android Health Connect / Pixel Watch with Atrial Fibrillation)
    console.log('\n4. Ingesting High-Acuity Biometric Event (Android Health Connect)...');
    const pixelWatchRecord = await PortalService.syncWearableBiometrics(
      patientId,
      'Pixel Watch 3 (Health Connect)',
      {
        hrvMs: 18,
        restingHr: 98,
        stepCount: 3100,
        sleepHours: 4.8,
        sleepScore: 54,
        nightlySpo2: 91.2,
        ecgClassification: 'afib_detected'
      }
    );
    console.log(`   ✔ Health Connect Synced [ECG: ${pixelWatchRecord.ecgClassification}]`);

    // 5. Seed 7-Day Longitudinal Trajectory
    console.log('\n5. Seeding 7-Day Continuous Biometric Trend History...');
    await PortalService.seedRealisticWearableHistory(patientId, 'Apple Watch Ultra 2');
    console.log('   ✔ 7-day longitudinal trajectory seeded into database.');

    // 6. Test Full Portal Dashboard Aggregation
    console.log('\n6. Fetching Consolidated Patient Health Portal Dashboard...');
    const dashboard = await PortalService.getPatientPortalDashboard(patientId);
    console.log(`   - Patient: ${dashboard.patient.name} (${dashboard.patient.dob}, ${dashboard.patient.sex})`);
    console.log(`   - Recent Encounters: ${dashboard.recentVisits.length}`);
    console.log(`   - Connected Devices: ${dashboard.wearableBiometrics.connectedDevices.join(', ')}`);
    console.log(`   - 7-Day Telemetry Datapoints: ${dashboard.wearableBiometrics.trend7Days.length}`);
    console.log(`   - Biometric Alerts Triggered: ${dashboard.wearableBiometrics.biometricAlerts.length}`);

    if (dashboard.wearableBiometrics.trend7Days.length !== 7) {
      throw new Error(`Expected 7 days of trajectory, received: ${dashboard.wearableBiometrics.trend7Days.length}`);
    }

    console.log('\n✔ PATIENT HEALTH PORTAL & WEARABLES BIOMETRIC INGESTION TEST PASSED 100%!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test failed with error:', err);
    process.exit(1);
  }
}

runPatientPortalTests();
