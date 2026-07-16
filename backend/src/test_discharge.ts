process.env.PORT = '8090'; // Start on test port to avoid conflicts

import { pool } from './db';
import { v4 as uuidv4 } from 'uuid';
import http from 'http';
import bcrypt from 'bcryptjs';

// Boot the server programmatically
import { server } from './index';

async function runDischargeTests() {
  console.log('==================================================');
  console.log('      IntakeRx Discharge Summary Unit Tests       ');
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

  const patientEmail = `testdischarge_${Date.now()}@example.com`;
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
      ['Discharge Test Patient', patientEmail, 'hashpass', '1995-02-12', 'Male', 'Aetna', 'POL555']
    );
    patientId = newPatient.rows[0].id;

    await pool.query(
      `INSERT INTO intake_sessions (id, patient_id, status, current_step, preferred_language)
       VALUES ($1, $2, 'active', 'summary', 'es-ES')`,
      [sessionId, patientId]
    );

    // Seed mock clinical SOAP note
    const mockSoapSummary = {
      chiefComplaint: "Severe cough and mild fever",
      historyOfPresentIllness: "Patient reports severe dry cough starting 3 days ago. Mild fever of 100.2 F last night.",
      pastMedicalHistory: "None",
      allergies: [],
      medications: []
    };

    await pool.query(
      `INSERT INTO intake_summaries (session_id, summary_data, status)
       VALUES ($1, $2, 'confirmed')`,
      [sessionId, JSON.stringify(mockSoapSummary)]
    );

    // 3. Make HTTP request to login clinician
    const loginData = JSON.stringify({
      email: clinicianEmail,
      password: 'admin2026',
      role: 'clinician'
    });

    const token = await new Promise<string>((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 8090,
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

    // 4. POST /sessions/:id/discharge - Trigger summary generation
    console.log('[HTTP] Requesting discharge summary generation...');
    const generateRes = await new Promise<any>((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 8090,
        path: `/api/clinician/sessions/${sessionId}/discharge`,
        method: 'POST',
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
            reject(new Error(`Generate discharge failed: ${res.statusCode}. Body: ${body}`));
          }
        });
      });
      req.on('error', reject);
      req.end();
    });

    const summaryText = generateRes.dischargeSummary;
    assert(typeof summaryText === 'string' && summaryText.length > 50, 'Should return generated text summary.');
    assert(
      summaryText.includes('#') && 
      (summaryText.toLowerCase().includes('discussed') || summaryText.includes('1.') || summaryText.includes('discutido') || summaryText.includes('discutió')),
      'Should contain header instructions format.'
    );

    // 5. GET /sessions/:id/discharge - Retrieve discharge summary
    console.log('[HTTP] Requesting discharge summary retrieval...');
    const retrieveRes = await new Promise<any>((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 8090,
        path: `/api/clinician/sessions/${sessionId}/discharge`,
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
            reject(new Error(`Retrieve discharge failed: ${res.statusCode}`));
          }
        });
      });
      req.on('error', reject);
      req.end();
    });

    assert(
      retrieveRes.dischargeSummary === summaryText,
      'Retrieved discharge summary must exactly match the generated database record.'
    );
    assert(
      retrieveRes.preferredLanguage === 'es-ES',
      `Summary should preserve requested language target. Got: ${retrieveRes.preferredLanguage}`
    );

    // Clean up
    await pool.query('DELETE FROM patients WHERE id = $1', [patientId]);
    if (didSeedClinician && clinicianId) {
      await pool.query('DELETE FROM patients WHERE id = $1', [clinicianId]);
    }
    console.log('\n==================================================');
    console.log(`Discharge Test Results: ${passedTests}/${totalTests} Passed`);
    console.log('==================================================');
    await pool.end();
    server.close();
    process.exit(passedTests === totalTests ? 0 : 1);

  } catch (err) {
    console.error('Discharge test failed:', err);
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

runDischargeTests();
