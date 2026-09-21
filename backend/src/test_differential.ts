import { pool, bootstrap } from './db';
import { DiagnosisService } from './services/diagnosis';
import { v4 as uuidv4 } from 'uuid';

async function runDifferentialTest() {
  console.log('====================================================');
  console.log('  IntakeRx AI Differential Diagnosis & Matrix Test  ');
  console.log('====================================================\n');

  let testPatientId: number | null = null;
  const testSessionId = uuidv4();

  try {
    // 1. Setup database and test patient
    console.log('1. Setting up clinical test encounter...');
    await bootstrap();
    const patientRes = await pool.query(
      `INSERT INTO patients (name, email, password_hash, dob, sex)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      ['Arthur Dent', `arthur.dent.${Date.now()}@example.com`, 'hash', '1982-10-14', 'Male']
    );
    testPatientId = patientRes.rows[0].id;

    // 2. Create session with acute cardiac presentation
    await pool.query(
      `INSERT INTO intake_sessions (id, patient_id, status, current_step, triage_level)
       VALUES ($1, $2, $3, $4, $5)`,
      [testSessionId, testPatientId, 'completed', 'completed', 'emergency']
    );

    // Initial message
    await pool.query(
      `INSERT INTO messages (session_id, sender, content)
       VALUES ($1, $2, $3)`,
      [testSessionId, 'patient', 'I have severe tight chest pain radiating to my left arm for the past 45 minutes.']
    );

    // Seed symptoms
    await pool.query(
      `INSERT INTO symptoms (session_id, name, severity, duration, is_red_flag)
       VALUES 
         ($1, $2, $3, $4, $5),
         ($6, $7, $8, $9, $10)`,
      [
        testSessionId, 'Crushing substernal chest pressure', 'severe', '45 minutes', true,
        testSessionId, 'Shortness of breath', 'moderate', '45 minutes', false
      ]
    );

    // 3. Invoke DiagnosisService
    console.log('\n2. Computing differential diagnosis matrix...');
    const result = await DiagnosisService.generateDifferential(testSessionId);

    console.log(`   - Encounter ID: ${result.sessionId.slice(0, 8)}`);
    console.log(`   - Chief Complaint: "${result.chiefComplaint}"`);
    console.log(`   - Generated Candidates: ${result.candidates.length}`);

    if (result.candidates.length === 0) {
      throw new Error('DiagnosisService returned 0 candidates!');
    }

    // 4. Validate candidates
    console.log('\n3. Validating differential candidates:');
    result.candidates.forEach(c => {
      console.log(`     #${c.rank}: ${c.condition} [${c.icd10}]`);
      console.log(`         Probability: ${c.probability}% | Urgency: ${c.urgency.toUpperCase()}`);
      console.log(`         Rule-out Workup: ${c.ruleOutCriteria.slice(0, 2).join('; ')}`);
    });

    const topCandidate = result.candidates[0];
    if (!topCandidate.condition.includes('Acute Coronary Syndrome') && !topCandidate.condition.includes('Angina')) {
      throw new Error(`Expected Acute Coronary Syndrome as #1 candidate for chest pain, got: ${topCandidate.condition}`);
    }

    if (topCandidate.probability < 70) {
      throw new Error(`Expected high confidence (>=70%) for acute presentation, got: ${topCandidate.probability}%`);
    }

    if (topCandidate.icd10 !== 'I20.9') {
      throw new Error(`Expected ICD-10 code I20.9, got: ${topCandidate.icd10}`);
    }

    console.log('\n✔ AI DIFFERENTIAL DIAGNOSIS MATRIX PASSED VALIDATION.');
  } catch (err) {
    console.error('\n❌ Differential test failed:', err);
    process.exit(1);
  } finally {
    console.log('\nCleaning up encounter records...');
    if (testPatientId) {
      await pool.query('DELETE FROM patients WHERE id = $1', [testPatientId]);
      console.log('Cleanup complete.');
    }
    await pool.end();
  }
}

runDifferentialTest();
