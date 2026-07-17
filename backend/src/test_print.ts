process.env.PORT = '8093';

import { pool } from './db';
import { v4 as uuidv4 } from 'uuid';
import http from 'http';
import bcrypt from 'bcryptjs';
import { server } from './index';

async function runPrintTests() {
  console.log('==================================================');
  console.log('      IntakeRx Clinician Print Engine Tests       ');
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

  const patientEmail = `testprint_${Date.now()}@example.com`;
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
      console.log('Seeded mock clinician.');
    } else {
      clinicianId = clinCheck.rows[0].id;
    }

    // 2. Setup mock patient, session, symptoms, vitals
    const newPatient = await pool.query(
      `INSERT INTO patients (name, email, password_hash, dob, sex, insurance_provider, insurance_policy)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      ['Print Test Patient', patientEmail, 'hashpass', '1985-04-12', 'Female', 'Blue Cross', 'BC999']
    );
    patientId = newPatient.rows[0].id;

    await pool.query(
      `INSERT INTO intake_sessions (id, patient_id, status, current_step, triage_level, triage_rationale)
       VALUES ($1, $2, 'completed', 'summary', 'urgent', 'Elevated cardiovascular warning indications.')`,
      [sessionId, patientId]
    );

    // Seed mock symptom
    await pool.query(
      `INSERT INTO symptoms (session_id, name, severity, duration)
       VALUES ($1, 'Chest Pain', 'severe', '30 minutes')`,
      [sessionId]
    );

    // Seed mock vitals
    await pool.query(
      `INSERT INTO session_vitals (session_id, heart_rate, spo2, bp_systolic, bp_diastolic)
       VALUES ($1, 98, 96, 140, 90)`,
      [sessionId]
    );

    // Seed mock SOAP summary
    const mockSummary = {
      chiefComplaint: 'Severe retrosternal chest pain',
      historyOfPresentIllness: '30 mins of squeezing pain radiating to left arm.',
      pastMedicalHistory: 'Hypertension, hyperlipidemia.',
      allergies: ['Penicillin'],
      medications: [{ name: 'Aspirin', dosage: '81mg', frequency: 'daily' }]
    };
    await pool.query(
      `INSERT INTO intake_summaries (session_id, summary_data)
       VALUES ($1, $2)`,
      [sessionId, JSON.stringify(mockSummary)]
    );

    // 3. Log in clinician
    const loginData = JSON.stringify({
      email: clinicianEmail,
      password: 'admin2026',
      role: 'clinician'
    });

    const token = await new Promise<string>((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 8093,
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

    // 4. Retrieve session details via clinician API
    console.log('[HTTP] Requesting session details for print schema verification...');
    const details = await new Promise<any>((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 8093,
        path: `/api/intake/sessions/${sessionId}`,
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
            reject(new Error(`Fetch details failed: ${res.statusCode}`));
          }
        });
      });
      req.on('error', reject);
      req.end();
    });

    // Validate schema keys required by print layouts
    assert(details.session.patientName === 'Print Test Patient', 'Patient name matches database entry.');
    assert(details.session.patientDob !== undefined && details.session.patientDob !== null, 'Date of birth is exported.');
    assert(details.session.insuranceProvider === 'Blue Cross', 'Insurance info is complete.');
    assert(details.summary !== null && details.summary.summaryData.chiefComplaint !== undefined, 'SOAP summary data is complete.');
    assert(Array.isArray(details.vitals) && details.vitals.length > 0 && details.vitals[0].heartRate === 98, 'Biometric telemetry structure is exported.');
    assert(details.symptoms.length > 0 && details.symptoms[0].name === 'Chest Pain', 'Associated symptom lists are exported.');

    // Clean up
    await pool.query('DELETE FROM patients WHERE id = $1', [patientId]);
    if (didSeedClinician && clinicianId) {
      await pool.query('DELETE FROM patients WHERE id = $1', [clinicianId]);
    }

    console.log('\n==================================================');
    console.log(`Print Engine Test Results: ${passedTests}/${totalTests} Passed`);
    console.log('==================================================');
    await pool.end();
    server.close();
    process.exit(passedTests === totalTests ? 0 : 1);

  } catch (err) {
    console.error('Print test failed:', err);
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

runPrintTests();
