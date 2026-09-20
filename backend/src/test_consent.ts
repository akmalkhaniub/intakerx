import { pool, bootstrap } from './db';

async function runConsentTest() {
  console.log('==================================================');
  console.log('        IntakeRx Patient Consent Workflow Test    ');
  console.log('==================================================\n');

  let testPatientId: number | null = null;

  try {
    // 1. Run migrations to ensure consent_records table exists
    console.log('1. Verifying database migrations...');
    await bootstrap();

    // 2. Seed a test patient
    console.log('2. Seeding test patient...');
    const patientRes = await pool.query(
      `INSERT INTO patients (name, email, password_hash, dob, sex)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      ['Consent Test Patient', `consent.test.${Date.now()}@example.com`, 'hashedpass', '1990-01-01', 'Female']
    );
    testPatientId = patientRes.rows[0].id;
    console.log(`   - Created patient ID: ${testPatientId}`);

    // 3. Verify consent status before consent
    console.log('3. Checking consent status (pre-consent)...');
    const preCheck = await pool.query(
      `SELECT id, consent_type, version, agreed, signed_at
       FROM consent_records
       WHERE patient_id = $1 AND agreed = TRUE`,
      [testPatientId]
    );
    console.log(`   - Consented records count: ${preCheck.rows.length} (Expected: 0)`);
    if (preCheck.rows.length !== 0) {
      throw new Error('Expected 0 consent records before consent submission!');
    }

    // 4. Record patient consent
    console.log('4. Submitting patient clinical consent...');
    const insertRes = await pool.query(
      `INSERT INTO consent_records (patient_id, consent_type, version, agreed, ip_address)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, signed_at`,
      [testPatientId, 'ai_intake_disclosure', 'v1.0', true, '127.0.0.1']
    );
    const consentId = insertRes.rows[0].id;
    const signedAt = insertRes.rows[0].signed_at;
    console.log(`   - Consent recorded with ID: ${consentId} at ${signedAt}`);

    // 5. Verify consent status after consent
    console.log('5. Checking consent status (post-consent)...');
    const postCheck = await pool.query(
      `SELECT id, consent_type as "consentType", version, agreed, signed_at as "signedAt"
       FROM consent_records
       WHERE patient_id = $1 AND agreed = TRUE
       ORDER BY signed_at DESC
       LIMIT 1`,
      [testPatientId]
    );

    if (postCheck.rows.length === 0) {
      throw new Error('Expected consent record, but none found!');
    }

    const rec = postCheck.rows[0];
    console.log(`   - Retrieved record:`);
    console.log(`     Type: ${rec.consentType} (Expected: ai_intake_disclosure)`);
    console.log(`     Version: ${rec.version} (Expected: v1.0)`);
    console.log(`     Agreed: ${rec.agreed} (Expected: true)`);

    if (rec.consentType !== 'ai_intake_disclosure' || rec.version !== 'v1.0' || !rec.agreed) {
      throw new Error('Consent record fields do not match expected values!');
    }

    console.log('\n✔ PATIENT CONSENT WORKFLOW VALIDATED SUCCESSFULLY.');
  } catch (err) {
    console.error('\n❌ Consent test failed:', err);
    process.exit(1);
  } finally {
    // 6. Cleanup
    console.log('\n6. Cleaning up database entries...');
    if (testPatientId) {
      await pool.query('DELETE FROM patients WHERE id = $1', [testPatientId]);
      console.log('Cleanup complete.');
    }
    await pool.end();
  }
}

runConsentTest();
