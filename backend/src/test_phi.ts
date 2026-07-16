import { pool } from './db';
import { PHIService } from './services/phi';
import { v4 as uuidv4 } from 'uuid';

async function runPHITests() {
  console.log('==================================================');
  console.log('         IntakeRx PHI Redactor Unit Tests         ');
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

  try {
    // 1. Create mock patient and session
    const patientEmail = `testphi_${Date.now()}@example.com`;
    const newPatient = await pool.query(
      `INSERT INTO patients (name, email, password_hash, dob, sex, insurance_provider, insurance_policy)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      ['Johnathan Doe', patientEmail, 'hashpass', '1990-05-15', 'Male', 'Aetna', 'POL123']
    );
    const patientId = newPatient.rows[0].id;
    const sessionId = uuidv4();

    await pool.query(
      `INSERT INTO intake_sessions (id, patient_id, status, current_step)
       VALUES ($1, $2, $3, $4)`,
      [sessionId, patientId, 'active', 'complaint']
    );

    // Test Case 1: Generic Email Redaction
    console.log('Test 1: Generic Email Redaction');
    const emailInput = 'Please contact me at admin@intakerx.com';
    const emailRedacted = await PHIService.redactAndLog(emailInput, sessionId);
    assert(
      emailRedacted.includes('[REDACTED_EMAIL]') && !emailRedacted.includes('admin@intakerx.com'),
      'Should redact generic email addresses.'
    );

    // Test Case 2: Generic SSN Redaction
    console.log('\nTest 2: Generic SSN Redaction');
    const ssnInput = 'My SSN is 123-45-6789';
    const ssnRedacted = await PHIService.redactAndLog(ssnInput, sessionId);
    assert(
      ssnRedacted.includes('[REDACTED_SSN]') && !ssnRedacted.includes('123-45-6789'),
      'Should redact Social Security Numbers.'
    );

    // Test Case 3: Generic Phone Redaction
    console.log('\nTest 3: Generic Phone Redaction');
    const phoneInput = 'Call me at (555) 123-4567 or +1 555-123-4567';
    const phoneRedacted = await PHIService.redactAndLog(phoneInput, sessionId);
    assert(
      phoneRedacted.includes('[REDACTED_PHONE]') && !phoneRedacted.includes('555-123-4567'),
      'Should redact phone numbers.'
    );

    // Test Case 4: Generic DOB Redaction
    console.log('\nTest 4: Generic DOB Redaction');
    const dobInput = 'I was born on 12/25/1985';
    const dobRedacted = await PHIService.redactAndLog(dobInput, sessionId);
    assert(
      dobRedacted.includes('[REDACTED_DOB]') && !dobRedacted.includes('12/25/1985'),
      'Should redact standard date of birth.'
    );

    // Test Case 5: Exact Patient Database Matches (Scrubbing name/email)
    console.log('\nTest 5: Exact Patient Matches');
    const dbInput = `Hello, my name is Johnathan Doe. My email is ${patientEmail} and DOB is 1990-05-15.`;
    const dbRedacted = await PHIService.redactAndLog(dbInput, sessionId);
    assert(
      dbRedacted.includes('[REDACTED_NAME]') &&
      dbRedacted.includes('[REDACTED_EMAIL]') &&
      dbRedacted.includes('[REDACTED_DOB]') &&
      !dbRedacted.includes('Johnathan') &&
      !dbRedacted.includes(patientEmail),
      'Should dynamically query database and scrub exact patient record details.'
    );

    // Test Case 6: Name Heuristics
    console.log('\nTest 6: Heuristic Name Redaction');
    const heuristicInput = 'Hello, my name is Alice Smith. I am called Bob. I am Charlie.';
    const heuristicRedacted = await PHIService.redactAndLog(heuristicInput, sessionId);
    assert(
      heuristicRedacted.includes('[REDACTED_NAME]') &&
      !heuristicRedacted.includes('Alice') &&
      !heuristicRedacted.includes('Bob') &&
      !heuristicRedacted.includes('Charlie'),
      `Should recognize common name prefix patterns. Got: "${heuristicRedacted}"`
    );

    // Test Case 7: Logs audit verification
    console.log('\nTest 7: Redaction Logs Verification');
    const logsRes = await pool.query(
      `SELECT COUNT(*) FROM phi_redaction_logs WHERE session_id = $1`,
      [sessionId]
    );
    const logCount = parseInt(logsRes.rows[0].count, 10);
    assert(
      logCount > 0,
      `Should save entries in phi_redaction_logs. Found: ${logCount} records.`
    );

    // Clean up
    await pool.query('DELETE FROM patients WHERE id = $1', [patientId]);
    console.log('\n==================================================');
    console.log(`Test Results: ${passedTests}/${totalTests} Passed`);
    console.log('==================================================');
    
    await pool.end();
    process.exit(passedTests === totalTests ? 0 : 1);
  } catch (err) {
    console.error('Test execution failed:', err);
    try {
      await pool.end();
    } catch (e) {}
    process.exit(1);
  }
}

runPHITests();
