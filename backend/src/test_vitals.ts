process.env.PORT = '8088'; // Use different port for test server to avoid EADDRINUSE

import { pool } from './db';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

// Start server programmatically
import './index';

async function runVitalsTests() {
  console.log('==================================================');
  console.log('       IntakeRx Vitals Simulator Unit Tests        ');
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

  const patientEmail = `testvitals_${Date.now()}@example.com`;
  let patientId: number | null = null;
  const sessionId = uuidv4();

  try {
    // 1. Setup mock patient and session
    const newPatient = await pool.query(
      `INSERT INTO patients (name, email, password_hash, dob, sex, insurance_provider, insurance_policy)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      ['Vitals Test Patient', patientEmail, 'hashpass', '1985-08-20', 'Female', 'BlueCross', 'POL789']
    );
    patientId = newPatient.rows[0].id;

    await pool.query(
      `INSERT INTO intake_sessions (id, patient_id, status, current_step)
       VALUES ($1, $2, $3, $4)`,
      [sessionId, patientId, 'active', 'complaint']
    );

    // 2. Open WebSocket link to test port 8088
    const ws = new WebSocket('ws://localhost:8088');

    // Return a promise that resolves when test is complete
    await new Promise<void>((resolve, reject) => {
      let step = 0;

      ws.on('open', () => {
        console.log('[WS] Connected to test server.');
        // Send start_session message
        ws.send(JSON.stringify({
          type: 'start_session',
          sessionId,
          patientId,
          currentStep: 'complaint'
        }));
      });

      ws.on('message', async (data) => {
        try {
          const msg = JSON.parse(data.toString());

          if (msg.type === 'vitals') {
            const { heartRate, spo2, bpSystolic, bpDiastolic } = msg.vitals;
            console.log(`[WS] Received Vitals: HR=${heartRate}, SpO2=${spo2}%, BP=${bpSystolic}/${bpDiastolic}`);

            if (step === 0) {
              // Test standard vitals range
              assert(
                heartRate >= 70 && heartRate <= 80 &&
                spo2 >= 96 && spo2 <= 99 &&
                bpSystolic >= 115 && bpSystolic <= 125,
                'Standard vitals should remain in normal homeostatic range.'
              );

              // Step up to trigger distress
              console.log('\n[WS] Sending distress simulation trigger...');
              step = 1;
              ws.send(JSON.stringify({
                type: 'simulate_distress',
                value: true
              }));
            } else if (step === 1) {
              // Wait for distress vitals
              if (heartRate > 130 && spo2 < 92) {
                assert(
                  heartRate >= 135 && heartRate <= 150 &&
                  spo2 >= 85 && spo2 <= 90 &&
                  bpSystolic >= 155 && bpSystolic <= 170,
                  `Vitals distress should reflect abnormal parameters. Got: HR=${heartRate}, SpO2=${spo2}%`
                );

                // Fetch session status from DB to ensure auto-escalated
                const sessionRes = await pool.query('SELECT status, triage_level as "triageLevel" FROM intake_sessions WHERE id = $1', [sessionId]);
                const { status, triageLevel } = sessionRes.rows[0];

                assert(
                  status === 'escalated' && triageLevel === 'emergency',
                  'Session should automatically escalate to emergency status on distress vitals.'
                );

                ws.close();
              }
            }
          }
        } catch (err) {
          reject(err);
        }
      });

      ws.on('close', () => {
        resolve();
      });

      ws.on('error', (err) => {
        reject(err);
      });
    });

    // Cleanup
    await pool.query('DELETE FROM patients WHERE id = $1', [patientId]);
    console.log('\n==================================================');
    console.log(`Vitals Test Results: ${passedTests}/${totalTests} Passed`);
    console.log('==================================================');
    await pool.end();
    process.exit(passedTests === totalTests ? 0 : 1);

  } catch (err) {
    console.error('Vitals test failed:', err);
    if (patientId) {
      await pool.query('DELETE FROM patients WHERE id = $1', [patientId]);
    }
    await pool.end();
    process.exit(1);
  }
}

runVitalsTests();
