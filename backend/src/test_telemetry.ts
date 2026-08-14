import { pool } from './db';
import { v4 as uuidv4 } from 'uuid';

async function runTelemetryTest() {
  console.log('==================================================');
  console.log('       IntakeRx Vitals Telemetry Playback Test    ');
  console.log('==================================================\n');

  const testSessionId = uuidv4();
  let testPatientId: number | null = null;

  try {
    // 1. Seed a mock patient
    console.log('1. Seeding mock patient...');
    const patientRes = await pool.query(
      `INSERT INTO patients (name, email, password_hash, dob, sex, insurance_provider, insurance_policy)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        'John Smith',
        `john.smith.${Date.now()}@example.com`,
        'hashed_password',
        '1985-05-15',
        'Male',
        'Aetna',
        'AE-998877'
      ]
    );
    testPatientId = patientRes.rows[0].id;

    // 2. Seed a mock session
    console.log('2. Seeding mock session...');
    await pool.query(
      `INSERT INTO intake_sessions (id, patient_id, status, current_step, triage_level)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        testSessionId,
        testPatientId,
        'completed',
        'completed',
        'routine'
      ]
    );

    // 3. Seed historical vitals logs (Normal, Distress, Recovery)
    console.log('3. Seeding vitals telemetry logs in session_vitals...');
    const timestamp0 = new Date(Date.now() - 60000); // 1 min ago
    const timestamp1 = new Date(Date.now() - 30000); // 30 sec ago
    const timestamp2 = new Date();                  // Now

    await pool.query(
      `INSERT INTO session_vitals (session_id, heart_rate, spo2, bp_systolic, bp_diastolic, created_at)
       VALUES 
         ($1, $2, $3, $4, $5, $6),
         ($7, $8, $9, $10, $11, $12),
         ($13, $14, $15, $16, $17, $18)`,
      [
        testSessionId, 72, 98, 120, 80, timestamp0,      // Normal
        testSessionId, 135, 90, 145, 95, timestamp1,     // Distress: Tachycardia + Hypoxemia
        testSessionId, 85, 97, 122, 82, timestamp2        // Recovery
      ]
    );

    // 4. Fetch the session details to verify vitals array mapping
    console.log('4. Fetching session details with vitals...');
    // Query directly from session_vitals to verify order
    const vitalsRes = await pool.query(
      `SELECT heart_rate as "heartRate", spo2, bp_systolic as "bpSystolic", bp_diastolic as "bpDiastolic", created_at as "createdAt"
       FROM session_vitals
       WHERE session_id = $1
       ORDER BY created_at ASC`,
      [testSessionId]
    );

    const vitals = vitalsRes.rows;
    console.log(`- Retrieved ${vitals.length} vitals entries.`);
    
    // Assert counts
    if (vitals.length !== 3) {
      throw new Error(`Expected 3 vitals entries, got ${vitals.length}`);
    }

    // Assert values
    console.log('5. Validating telemetry logs integrity...');
    const entry0 = vitals[0];
    const entry1 = vitals[1];
    const entry2 = vitals[2];

    console.log(`   Entry 0 (Normal): HR=${entry0.heartRate} (Exp: 72), SpO2=${entry0.spo2}% (Exp: 98%), BP=${entry0.bpSystolic}/${entry0.bpDiastolic} (Exp: 120/80)`);
    if (entry0.heartRate !== 72 || entry0.spo2 !== 98 || entry0.bpSystolic !== 120 || entry0.bpDiastolic !== 80) {
      throw new Error('Entry 0 values mismatch');
    }

    console.log(`   Entry 1 (Distress): HR=${entry1.heartRate} (Exp: 135), SpO2=${entry1.spo2}% (Exp: 90%), BP=${entry1.bpSystolic}/${entry1.bpDiastolic} (Exp: 145/95)`);
    if (entry1.heartRate !== 135 || entry1.spo2 !== 90 || entry1.bpSystolic !== 145 || entry1.bpDiastolic !== 95) {
      throw new Error('Entry 1 values mismatch');
    }

    console.log(`   Entry 2 (Recovery): HR=${entry2.heartRate} (Exp: 85), SpO2=${entry2.spo2}% (Exp: 97%), BP=${entry2.bpSystolic}/${entry2.bpDiastolic} (Exp: 122/82)`);
    if (entry2.heartRate !== 85 || entry2.spo2 !== 97 || entry2.bpSystolic !== 122 || entry2.bpDiastolic !== 82) {
      throw new Error('Entry 2 values mismatch');
    }

    console.log('\n✔ VITALS TELEMETRY DATABASE VERIFICATION PASSED SUCCESSFULLY.');

  } catch (err) {
    console.error('❌ Telemetry test failed:', err);
    process.exit(1);
  } finally {
    // 6. Cleanup test records
    console.log('\n6. Cleaning up database entries...');
    if (testPatientId) {
      await pool.query('DELETE FROM patients WHERE id = $1', [testPatientId]);
      console.log('Cleanup complete.');
    }
  }
}

runTelemetryTest();
