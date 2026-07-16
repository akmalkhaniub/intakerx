process.env.PORT = '8089'; // Start on test port to avoid conflicts

import { pool } from './db';
import { v4 as uuidv4 } from 'uuid';
import http from 'http';
import bcrypt from 'bcryptjs';

// Boot the server programmatically
import './index';

async function runHistoryTests() {
  console.log('==================================================');
  console.log('      IntakeRx Patient History Unit Tests         ');
  console.log('==================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, message: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`[PASS] ${message}`);
    } else {
      console.error(`[FAIL] ${message}`);
    }
  }

  const patientEmail = `testhistory_${Date.now()}@example.com`;
  let patientId: number | null = null;
  let clinicianId: number | null = null;
  let didSeedClinician = false;
  const session1 = uuidv4();
  const session2 = uuidv4();
  const session3 = uuidv4();

  const clinicianEmail = 'dr.smith@clinic.com';

  try {
    // 1. Ensure test clinician exists in database
    const clinCheck = await pool.query('SELECT id FROM patients WHERE email = $1', [clinicianEmail]);
    if (clinCheck.rowCount === 0) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash('admin2026', salt);
      const clinRes = await pool.query(
        `INSERT INTO patients (name, email, password_hash, dob, sex)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        ['Dr. Smith', clinicianEmail, hash, '1975-05-10', 'Male']
      );
      clinicianId = clinRes.rows[0].id;
      didSeedClinician = true;
      console.log('Seeded mock clinician user.');
    } else {
      clinicianId = clinCheck.rows[0].id;
    }

    // 2. Setup mock patient
    const newPatient = await pool.query(
      `INSERT INTO patients (name, email, password_hash, dob, sex, insurance_provider, insurance_policy)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      ['History Test Patient', patientEmail, 'hashpass', '1970-01-01', 'Male', 'Cigna', 'POL456']
    );
    patientId = newPatient.rows[0].id;

    // 3. Seed 3 chronological sessions (spaced 1 hour apart in database)
    await pool.query(
      `INSERT INTO intake_sessions (id, patient_id, status, current_step, created_at, updated_at)
       VALUES ($1, $2, 'completed', 'summary', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours')`,
      [session1, patientId]
    );
    await pool.query(
      `INSERT INTO intake_sessions (id, patient_id, status, current_step, created_at, updated_at)
       VALUES ($1, $2, 'completed', 'summary', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours')`,
      [session2, patientId]
    );
    await pool.query(
      `INSERT INTO intake_sessions (id, patient_id, status, current_step, created_at, updated_at)
       VALUES ($1, $2, 'active', 'complaint', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour')`,
      [session3, patientId]
    );

    // Seed symptoms with varying severities
    // Session 1: Mild headache
    await pool.query(
      `INSERT INTO symptoms (session_id, name, severity, duration)
       VALUES ($1, 'Headache', 'mild', '1 day')`,
      [session1]
    );
    // Session 2: Moderate headache + nausea
    await pool.query(
      `INSERT INTO symptoms (session_id, name, severity, duration)
       VALUES ($1, 'Headache', 'moderate', '2 days')`,
      [session2]
    );
    await pool.query(
      `INSERT INTO symptoms (session_id, name, severity, duration)
       VALUES ($1, 'Nausea', 'mild', '6 hours')`,
      [session2]
    );
    // Session 3: Severe chest pain
    await pool.query(
      `INSERT INTO symptoms (session_id, name, severity, duration, is_red_flag)
       VALUES ($1, 'Chest Pain', 'severe', '30 minutes', true)`,
      [session3]
    );

    // Seed vitals for session 3
    await pool.query(
      `INSERT INTO session_vitals (session_id, heart_rate, spo2, bp_systolic, bp_diastolic)
       VALUES ($1, 78, 98, 120, 80)`,
      [session3]
    );

    // 4. Make HTTP request to login
    const loginData = JSON.stringify({
      email: clinicianEmail,
      password: 'admin2026',
      role: 'clinician'
    });

    const token = await new Promise<string>((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 8089,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(loginData)
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(JSON.parse(body).token);
          } else {
            reject(new Error(`Login failed with status: ${res.statusCode}. Body: ${body}`));
          }
        });
      });

      req.on('error', reject);
      req.write(loginData);
      req.end();
    });

    // Make history GET request
    const historyData = await new Promise<any>((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 8089,
        path: `/api/clinician/patients/${patientId}/history`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(JSON.parse(body));
          } else {
            reject(new Error(`History request failed: ${res.statusCode}`));
          }
        });
      });
      req.on('error', reject);
      req.end();
    });

    const history = historyData.history;
    assert(Array.isArray(history), 'History response should contain a history array.');
    assert(history.length === 3, `History should return exactly 3 sessions. Found: ${history.length}`);

    // Verify chronological order (session 1, then session 2, then session 3)
    assert(
      history[0].sessionId === session1 &&
      history[1].sessionId === session2 &&
      history[2].sessionId === session3,
      'History sessions should be ordered chronologically (oldest first).'
    );

    // Verify symptom extractions
    assert(
      history[0].symptoms[0].name === 'Headache' && history[0].symptoms[0].severity === 'mild',
      'Session 1 should contain mild headache.'
    );
    assert(
      history[1].symptoms.length === 2 && 
      history[1].symptoms.some((s: any) => s.name === 'Headache' && s.severity === 'moderate') &&
      history[1].symptoms.some((s: any) => s.name === 'Nausea' && s.severity === 'mild'),
      'Session 2 should contain moderate headache and mild nausea.'
    );
    assert(
      history[2].symptoms[0].name === 'Chest Pain' && history[2].symptoms[0].severity === 'severe',
      'Session 3 should contain severe chest pain.'
    );

    // Verify vitals link
    assert(
      history[2].vitals !== null && history[2].vitals.heartRate === 78 && history[2].vitals.spo2 === 98,
      'Session 3 should contain linked session vitals.'
    );

    // Clean up
    await pool.query('DELETE FROM patients WHERE id = $1', [patientId]);
    if (didSeedClinician && clinicianId) {
      await pool.query('DELETE FROM patients WHERE id = $1', [clinicianId]);
    }
    console.log('\n==================================================');
    console.log(`History Test Results: ${passedTests}/${totalTests} Passed`);
    console.log('==================================================');
    await pool.end();
    process.exit(passedTests === totalTests ? 0 : 1);

  } catch (err) {
    console.error('History test failed:', err);
    if (patientId) {
      await pool.query('DELETE FROM patients WHERE id = $1', [patientId]);
    }
    if (didSeedClinician && clinicianId) {
      await pool.query('DELETE FROM patients WHERE id = $1', [clinicianId]);
    }
    await pool.end();
    process.exit(1);
  }
}

runHistoryTests();
