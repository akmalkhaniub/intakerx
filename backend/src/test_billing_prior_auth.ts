import { pool, bootstrap } from './db';
import { BillingPriorAuthService } from './services/billingPriorAuth';

async function runBillingPriorAuthTest() {
  console.log('====================================================');
  console.log('  IntakeRx Autonomous Prior-Auth & CMS-1500 Test   ');
  console.log('====================================================\n');

  try {
    await bootstrap();

    // 1. Create Mock Patient & Session
    console.log('1. Setting up clinical encounter for high-cost procedure billing...');
    const patientEmail = `victoria.${Date.now()}@example.com`;
    const patientRes = await pool.query(`
      INSERT INTO patients (name, email, password_hash, dob, sex, insurance_provider, insurance_policy)
      VALUES ('Victoria Sterling', $1, 'hashedpwd', '1984-11-20', 'Female', 'Aetna Open Choice PPO', 'POL-984210')
      RETURNING *
    `, [patientEmail]);
    const patient = patientRes.rows[0];

    const sessionRes = await pool.query(`
      INSERT INTO intake_sessions (
        id, patient_id, status, triage_level
      ) VALUES (
        gen_random_uuid(), $1, 'completed', 'urgent'
      ) RETURNING *
    `, [patient.id]);
    const session = sessionRes.rows[0];

    await pool.query(`
      INSERT INTO intake_summaries (
        session_id, summary_data
      ) VALUES ($1, $2)
    `, [
      session.id,
      JSON.stringify({
        subjective: 'Patient reports progressive, daily unilateral throbbing headaches refractory to sumatriptan and topiramate.',
        objective: 'Neurological exam: Focal right upper extremity paresthesias, cranial nerves intact.',
        assessment: 'Intractable complex migraine with aura; rule out intracranial demyelinating disease or structural lesion.',
        plan: 'Urgent Brain MRI with/without contrast (CPT 70553). Submit expedited prior-authorization.'
      })
    ]);
    console.log(`   ✔ Encounter initialized [Session: ${session.id.substring(0, 8)}] for ${patient.name}`);

    // 2. Generate Autonomous Prior-Authorization Packet
    console.log('\n2. Generating Prior-Authorization Packet with AI Denial Risk Scoring...');
    const pa = await BillingPriorAuthService.generatePriorAuthPacket({
      sessionId: session.id,
      payerName: 'Aetna Open Choice PPO',
      procedureCpt: '70553',
      diagnosisIcd10: 'G43.909',
      urgency: 'expedited',
      customJustification: 'Progressive severe intractable headaches accompanied by new-onset right-sided hemiparesthesia refractory to 2 preventative classes.',
      failedTherapies: [
        'Failed 8-week trial of oral Topiramate (50mg BID) discontinued due to lack of efficacy',
        'Failed abortive therapy with Sumatriptan nasal spray and oral NSAIDs'
      ]
    });

    console.log(`   ✔ PA Record Created [ID: ${pa.id}]`);
    console.log(`     Payer: ${pa.payer_name}`);
    console.log(`     Requested Service: CPT ${pa.procedure_cpt} - ${pa.procedure_name}`);
    console.log(`     Indication: ICD-10 ${pa.diagnosis_icd10} - ${pa.diagnosis_name}`);
    console.log(`     Payer Denial Risk Score: ${pa.denial_risk_score}%`);
    console.log(`     Risk Rationale: "${pa.denial_risk_rationale}"`);

    if (pa.denial_risk_score > 50) {
      throw new Error(`Unexpected high denial risk score: ${pa.denial_risk_score}%`);
    }

    const packetData = typeof pa.packet_data === 'string' ? JSON.parse(pa.packet_data) : pa.packet_data;
    if (!packetData.letterOfMedicalNecessity || !packetData.letterOfMedicalNecessity.includes('LETTER OF MEDICAL NECESSITY')) {
      throw new Error('Letter of Medical Necessity was not generated correctly.');
    }
    console.log('   ✔ Formal Letter of Medical Necessity successfully compiled.');

    // 3. Clinician / Payer Approves Prior-Authorization
    console.log('\n3. Simulating Payer Real-Time Authorization Response...');
    const approvedPa = await BillingPriorAuthService.updatePriorAuthStatus(pa.id, 'approved');
    console.log(`   ✔ PA Status: ${approvedPa.status.toUpperCase()} [Auth Code: ${approvedPa.auth_number}]`);

    // 4. Compile CMS-1500 Clean Claim
    console.log('\n4. Compiling CMS-1500 (EDI 837P) Clean Insurance Claim...');
    const compiled = await BillingPriorAuthService.compileCms1500Claim({
      sessionId: session.id,
      paId: approvedPa.id,
      placeOfService: '11'
    });

    const { claim, scrubReport } = compiled;
    console.log(`   ✔ Claim Compiled [ID: ${claim.id}]`);
    console.log(`     Billed Provider: ${claim.billing_provider} (NPI: ${claim.rendering_npi})`);
    console.log(`     Total Charges: $${Number(claim.total_billed).toFixed(2)}`);
    console.log(`     EDI 837P Scrub Score: ${scrubReport.score}% (Is Clean: ${scrubReport.isClean})`);
    
    if (!scrubReport.isClean) {
      throw new Error(`Scrub report failed: ${JSON.stringify(scrubReport.scrubErrors)}`);
    }

    console.log('   ✔ Box 1-33 Validation Passed (Zero Billing Rejections).');

    // 5. Submit Claim to Clearinghouse
    console.log('\n5. Submitting Scrubbed Claim to Clearinghouse (Batch Dispatch)...');
    const submission = await BillingPriorAuthService.submitClaimToClearinghouse(claim.id);
    console.log(`   ✔ Claim Status: ${submission.claim.status.toUpperCase()}`);
    console.log(`   ✔ Electronic Batch ID: ${submission.batchId}`);
    console.log(`   ✔ Clearinghouse Status: ${submission.clearinghouseStatus}`);
    console.log(`   ✔ Transmission Timestamp: ${submission.transmissionTimestamp}`);

    console.log('\n✔ AUTONOMOUS PRIOR-AUTH & CMS-1500 CLAIM SUITE PASSED 100%!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  }
}

runBillingPriorAuthTest();
