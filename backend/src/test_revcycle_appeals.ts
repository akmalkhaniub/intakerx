import { pool, bootstrap } from './db';
import { revCycleAppealsService, CptLineItem } from './services/revCycleAppeals';

async function runRevCycleAppealsTest() {
  console.log('====================================================');
  console.log('  IntakeRx Phase 37: Zero-Click RevCycle & Appeals  ');
  console.log('====================================================\n');

  try {
    await bootstrap();

    // 1. Setup Patient Context
    console.log('1. Setting up Outpatient Encounter with Complex Billing...');
    const patientEmail = `revcycle.patient.${Date.now()}@example.com`;
    const patientRes = await pool.query(`
      INSERT INTO patients (name, email, password_hash, dob, sex)
      VALUES ('Marcus Sterling', $1, 'revcycle_pw', '1965-06-18', 'Male')
      RETURNING *
    `, [patientEmail]);
    const patient = patientRes.rows[0];

    const sessionRes = await pool.query(`
      INSERT INTO intake_sessions (id, patient_id, status, triage_level, triage_rationale)
      VALUES (gen_random_uuid(), $1, 'completed', 'green', 'Internal Medicine Encounter - Diabetic Nephropathy & Follow-Up')
      RETURNING *
    `, [patient.id]);
    const session = sessionRes.rows[0];
    console.log(`   ✔ Encounter initialized [Session: ${session.id.substring(0, 8)}, Patient: ${patient.name}]`);

    // 2. Test Claim Scrubbing & CCI Edit Interception
    console.log('\n2. Testing Pre-Submission Claim Scrubber (CCI & NCD/LCD Checks)...');
    const dirtyCptCodes: CptLineItem[] = [
      { code: '99214', description: 'Office Visit Level 4', units: 1, chargeCents: 21500 }, // missing mod 25
      { code: '99451', description: 'Interprofessional e-Consultation', units: 1, chargeCents: 7500 },
      { code: '83036', description: 'Glycated Hemoglobin (HbA1c)', units: 1, chargeCents: 4200 }
    ];
    const icd10Codes = ['E11.22 Type 2 diabetes with diabetic CKD', 'I10 Essential hypertension'];

    const dirtyScrub = revCycleAppealsService.scrubClaim(dirtyCptCodes, icd10Codes);
    console.log(`   ✔ Unbundled Claim Scrub: Valid = ${dirtyScrub.isValid}, Denial Probability = ${dirtyScrub.denialProbabilityPercent}%`);
    console.log(`   ✔ CCI Edits Detected: ${dirtyScrub.cciEdits.length}`);
    dirtyScrub.cciEdits.forEach(e => console.log(`     - Conflict: ${e.primaryCode} + ${e.bundledCode} (Fix: Modifier -${e.recommendedModifier})`));

    if (dirtyScrub.isValid) {
      throw new Error('Expected claim with unbundled 99214 + 99451 to fail pre-submission scrub');
    }
    if (dirtyScrub.cciEdits.length === 0) {
      throw new Error('Expected CCI edit conflict to be flagged');
    }

    // 3. Create Clean Claim with Correct Coding Modifier
    console.log('\n3. Correcting Claim with Modifier -25 & Submitting CMS-1500...');
    const cleanCptCodes: CptLineItem[] = [
      { code: '99214', description: 'Office Visit Level 4', modifiers: ['25'], units: 1, chargeCents: 21500 },
      { code: '99451', description: 'Interprofessional e-Consultation', units: 1, chargeCents: 7500 },
      { code: '83036', description: 'Glycated Hemoglobin (HbA1c)', units: 1, chargeCents: 4200 }
    ];

    const claimCreation = await revCycleAppealsService.createClaim({
      patientId: patient.id,
      sessionId: session.id,
      claimType: 'CMS-1500',
      payerName: 'UnitedHealthcare Commercial',
      cptCodes: cleanCptCodes,
      icd10Codes
    });

    const claim = claimCreation.claim;
    console.log(`   ✔ Clean Claim Created [ID: ${claim.id}, Payer: ${claim.payer_name}, Status: ${claim.status}]`);
    console.log(`   ✔ Total Billed: $${(claim.total_billed_cents / 100).toFixed(2)}`);

    if (claim.status !== 'scrubbed_clean') {
      throw new Error(`Expected claim status 'scrubbed_clean', got ${claim.status}`);
    }

    // 4. Simulate Payer Claim Denial (CARC CO-50)
    console.log('\n4. Simulating Payer Adjudication Denial (CARC CO-50: Medical Necessity)...');
    const deniedClaim = await revCycleAppealsService.simulateClaimDenial(
      claim.id,
      'CO-50',
      'Services not deemed medically necessary per Commercial Payer Coverage Policy Bulletin'
    );
    console.log(`   ✔ Denial Recorded: Code ${deniedClaim.denial_reason_code} - ${deniedClaim.denial_reason_description}`);
    console.log(`   ✔ Updated Claim Status: ${deniedClaim.status}`);

    if (deniedClaim.status !== 'denied') {
      throw new Error(`Expected claim status 'denied', got ${deniedClaim.status}`);
    }

    // 5. Generate Autonomous AI Clinical Appeal Letter
    console.log('\n5. Compiling Autonomous AI Clinical Appeal Letter & Evidence...');
    const appeal = await revCycleAppealsService.generateAppealLetter(claim.id);
    const evidenceList = typeof appeal.clinical_evidence === 'string' ? JSON.parse(appeal.clinical_evidence) : appeal.clinical_evidence;
    console.log(`   ✔ Evidence Citations: ${evidenceList.length} peer-reviewed guidelines included`);

    if (!appeal.letter_content.includes('FORMAL CLINICAL RECONSIDERATION & NOTICE OF DISPUTE')) {
      throw new Error('Appeal letter header missing');
    }
    if (!appeal.letter_content.includes('American Diabetes Association')) {
      throw new Error('Expected clinical citation not found in appeal letter');
    }

    // 6. Submit Clinical Appeal to Payer
    console.log('\n6. Submitting Formal Appeal & Updating Revenue Cycle Status...');
    const submittedAppeal = await revCycleAppealsService.submitAppeal(appeal.id);
    console.log(`   ✔ Appeal Submitted: Status = ${submittedAppeal.status}, Timestamp = ${submittedAppeal.submitted_at}`);

    if (submittedAppeal.status !== 'submitted') {
      throw new Error(`Expected appeal status 'submitted', got ${submittedAppeal.status}`);
    }

    // 7. Verify Claims Ledger Query
    console.log('\n7. Verifying Revenue Cycle Ledger & Payer Recovery Tracking...');
    const claimsLedger = await revCycleAppealsService.getClaims('appealed');
    console.log(`   ✔ Retrieved ${claimsLedger.length} active appealed claim(s) in recovery workflow`);

    console.log('\n====================================================');
    console.log('  Phase 37 Test Passed: 100% SUCCESS               ');
    console.log('====================================================');
  } catch (err) {
    console.error('\n❌ Phase 37 Test Failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runRevCycleAppealsTest();
