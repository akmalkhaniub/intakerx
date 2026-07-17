process.env.PORT = '8092'; // Start on test port to avoid conflicts

import { pool } from './db';
import { v4 as uuidv4 } from 'uuid';
import http from 'http';
import bcrypt from 'bcryptjs';

// Boot the server programmatically
import { server } from './index';

async function runCopilotTests() {
  console.log('==================================================');
  console.log('      IntakeRx AI Clinical Copilot Tests          ');
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

  const patientEmail = `testcopilot_${Date.now()}@example.com`;
  let patientId: number | null = null;
  let clinicianId: number | null = null;
  let didSeedClinician = false;
  let protocolChunkId: number | null = null;
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
      ['Copilot Test Patient', patientEmail, 'hashpass', '1990-11-30', 'Male', 'Humana', 'POL888']
    );
    patientId = newPatient.rows[0].id;

    await pool.query(
      `INSERT INTO intake_sessions (id, patient_id, status, current_step)
       VALUES ($1, $2, 'active', 'complaint')`,
      [sessionId, patientId]
    );

    // Seed mock symptom
    await pool.query(
      `INSERT INTO symptoms (session_id, name, severity, duration)
       VALUES ($1, 'Asthma Exacerbation', 'severe', '2 hours')`,
      [sessionId]
    );

    // Seed mock protocol chunk in RAG database
    const mockEmbedding = Array(768).fill(0.123);
    const vectorStr = '[' + mockEmbedding.join(',') + ']';
    const protocolRes = await pool.query(
      `INSERT INTO protocol_embeddings (title, content, chunk_index, embedding)
       VALUES ($1, $2, $3, $4::vector) RETURNING id`,
      ['Test Asthma Protocol Chunk', 'For acute asthma exacerbation, administer SABA inhaler 2-4 puffs. Monitor peak flow rates closely.', 0, vectorStr]
    );
    protocolChunkId = protocolRes.rows[0].id;
    console.log('Seeded mock protocol chunk into vector DB.');

    // 4. Log in clinician programmatically
    const loginData = JSON.stringify({
      email: clinicianEmail,
      password: 'admin2026',
      role: 'clinician'
    });

    const token = await new Promise<string>((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 8092,
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

    // 5. POST /sessions/:id/copilot/query - Ask Copilot clinical query
    console.log('[HTTP] Requesting copilot search query...');
    const copilotData = JSON.stringify({
      query: 'What is the recommended treatment for acute asthma exacerbation SABA?'
    });

    const queryRes = await new Promise<any>((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 8092,
        path: `/api/clinician/sessions/${sessionId}/copilot/query`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(copilotData),
          'Authorization': `Bearer ${token}`
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(JSON.parse(body));
          } else {
            reject(new Error(`Copilot query failed: ${res.statusCode}. Body: ${body}`));
          }
        });
      });
      req.on('error', reject);
      req.write(copilotData);
      req.end();
    });

    assert(typeof queryRes.answer === 'string' && queryRes.answer.length > 20, 'Should return text answer response from Copilot.');
    assert(Array.isArray(queryRes.citations), 'Citations field should return an array.');
    
    // Clean up
    await pool.query('DELETE FROM patients WHERE id = $1', [patientId]);
    if (didSeedClinician && clinicianId) {
      await pool.query('DELETE FROM patients WHERE id = $1', [clinicianId]);
    }
    if (protocolChunkId) {
      await pool.query('DELETE FROM protocol_embeddings WHERE id = $1', [protocolChunkId]);
    }
    console.log('\n==================================================');
    console.log(`Copilot Test Results: ${passedTests}/${totalTests} Passed`);
    console.log('==================================================');
    await pool.end();
    server.close();
    process.exit(passedTests === totalTests ? 0 : 1);

  } catch (err) {
    console.error('Copilot test failed:', err);
    if (patientId) {
      await pool.query('DELETE FROM patients WHERE id = $1', [patientId]);
    }
    if (didSeedClinician && clinicianId) {
      await pool.query('DELETE FROM patients WHERE id = $1', [clinicianId]);
    }
    if (protocolChunkId) {
      await pool.query('DELETE FROM protocol_embeddings WHERE id = $1', [protocolChunkId]);
    }
    await pool.end();
    server.close();
    process.exit(1);
  }
}

runCopilotTests();
