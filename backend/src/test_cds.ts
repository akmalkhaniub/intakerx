process.env.PORT = '8091'; // Start on test port to avoid conflicts

import { pool } from './db';
import { v4 as uuidv4 } from 'uuid';
import http from 'http';
import bcrypt from 'bcryptjs';

// Boot the server programmatically
import { server } from './index';

async function runCDSTests() {
  console.log('==================================================');
  console.log('      IntakeRx CDS Care Gaps Analyzer Tests       ');
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

  const patientEmail = `testcds_${Date.now()}@example.com`;
  let patientId: number | null = null;
  let clinicianId: number | null = null;
  let didSeedClinician = false;
  const sessionId = uuidv4();

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

    // 2. Setup mock patient and session
    const newPatient = await pool.query(
      `INSERT INTO patients (name, email, password_hash, dob, sex, insurance_provider, insurance_policy)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      ['CDS Test Patient', patientEmail, 'hashpass', '1980-06-20', 'Male', 'BlueShield', 'POL777']
    );
    patientId = newPatient.rows[0].id;

    await pool.query(
      `INSERT INTO intake_sessions (id, patient_id, status, current_step)
       VALUES ($1, $2, 'active', 'complaint')`,
      [sessionId, patientId]
    );

    // 3. Seed symptoms & medications to trigger both missing_therapy and contraindicated_therapy gaps
    // Gap 1: Patient has Hypertension but no medications (missing therapy)
    await pool.query(
      `INSERT INTO symptoms (session_id, name, severity, duration)
       VALUES ($1, 'Hypertension', 'moderate', '6 months')`,
      [sessionId]
    );

    // Gap 2: Patient has Diabetes and is taking Contrast Dye (contraindicated therapy + missing therapy)
    await pool.query(
      `INSERT INTO symptoms (session_id, name, severity, duration)
       VALUES ($1, 'Diabetes', 'mild', '2 years')`,
      [sessionId]
    );
    await pool.query(
      `INSERT INTO medications (session_id, name, dosage, frequency)
       VALUES ($1, 'Contrast Dye', '50ml', 'once before CT')`,
      [sessionId]
    );

    // 4. Log in clinician programmatically
    const loginData = JSON.stringify({
      email: clinicianEmail,
      password: 'admin2026',
      role: 'clinician'
    });

    const token = await new Promise<string>((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 8091,
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
            reject(new Error(`Login failed: ${res.statusCode}`));
          }
        });
      });

      req.on('error', reject);
      req.write(loginData);
      req.end();
    });

    // 5. GET /sessions/:id/care-gaps
    console.log('[HTTP] Requesting care gaps analysis...');
    const gapsData = await new Promise<any>((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 8091,
        path: `/api/clinician/sessions/${sessionId}/care-gaps`,
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
            reject(new Error(`Care gaps request failed: ${res.statusCode}`));
          }
        });
      });
      req.on('error', reject);
      req.end();
    });

    const alerts = gapsData.alerts;
    assert(Array.isArray(alerts), 'Response should contain an alerts array.');
    assert(alerts.length === 3, `Should detect exactly 3 guideline alerts. Found: ${alerts.length}`);

    // Verify missing therapy alert for Hypertension
    const missingHtAlert = alerts.find((a: any) => a.type === 'missing_therapy' && a.conditionName === 'Hypertension');
    assert(missingHtAlert !== undefined, 'Should detect a missing therapy care gap for Hypertension.');

    // Verify missing therapy alert for Diabetes
    const missingDbAlert = alerts.find((a: any) => a.type === 'missing_therapy' && a.conditionName === 'Diabetes');
    assert(missingDbAlert !== undefined, 'Should detect a missing therapy care gap for Diabetes.');

    // Verify contraindicated therapy alert for Diabetes
    const contraindicatedAlert = alerts.find((a: any) => a.type === 'contraindicated_therapy' && a.conditionName === 'Diabetes');
    assert(contraindicatedAlert !== undefined, 'Should detect a contraindicated therapy warning.');
    assert(
      contraindicatedAlert?.severity === 'high',
      `Contraindicated therapy warning should have HIGH severity.`
    );

    // Clean up
    await pool.query('DELETE FROM patients WHERE id = $1', [patientId]);
    if (didSeedClinician && clinicianId) {
      await pool.query('DELETE FROM patients WHERE id = $1', [clinicianId]);
    }
    console.log('\n==================================================');
    console.log(`CDS Test Results: ${passedTests}/${totalTests} Passed`);
    console.log('==================================================');
    await pool.end();
    server.close();
    process.exit(passedTests === totalTests ? 0 : 1);

  } catch (err) {
    console.error('CDS test failed:', err);
    if (patientId) {
      await pool.query('DELETE FROM patients WHERE id = $1', [patientId]);
    }
    if (didSeedClinician && clinicianId) {
      await pool.query('DELETE FROM patients WHERE id = $1', [clinicianId]);
    }
    await pool.end();
    server.close();
    process.exit(1);
  }
}

runCDSTests();
