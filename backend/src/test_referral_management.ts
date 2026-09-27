import { pool, bootstrap } from './db';
import { referralManagementService } from './services/referralManagement';

async function runReferralManagementTest() {
  console.log('====================================================');
  console.log('  IntakeRx Phase 33: Closed-Loop Referral & eConsult');
  console.log('====================================================\n');

  try {
    await bootstrap();

    // 1. Create Patient & Session
    console.log('1. Setting up Patient & Clinical Encounter...');
    const patientEmail = `referral.patient.${Date.now()}@example.com`;
    const patientRes = await pool.query(`
      INSERT INTO patients (name, email, password_hash, dob, sex)
      VALUES ('Franklin Castle', $1, 'referral_pw', '1975-11-20', 'Male')
      RETURNING *
    `, [patientEmail]);
    const patient = patientRes.rows[0];

    const sessionRes = await pool.query(`
      INSERT INTO intake_sessions (id, patient_id, status, triage_level, triage_rationale)
      VALUES (gen_random_uuid(), $1, 'active', 'yellow', 'Cardiology outpatient referral and Dermatology e-Consult')
      RETURNING *
    `, [patient.id]);
    const session = sessionRes.rows[0];
    console.log(`   ✔ Encounter initialized [Session: ${session.id.substring(0, 8)}, Patient: ${patient.name}]`);

    // 2. Test Formal Specialist Referral Lifecycle
    console.log('\n2. Testing Formal Specialist Referral Workflow...');
    const referral = await referralManagementService.createReferral({
      sessionId: session.id,
      patientId: patient.id,
      specialty: 'Cardiology',
      priority: 'urgent',
      reasonForReferral: 'Evaluation for exertional angina with positive stress test. Assess for coronary angiography.',
      provisionalDiagnosisCode: 'I25.10',
      targetFacility: 'Metropolitan Heart & Vascular Institute',
      targetSpecialist: 'Dr. Arthur Vance, FACC'
    });
    console.log(`   ✔ Referral Created [ID: #${referral.id}, Specialty: ${referral.specialty}, Status: ${referral.status}]`);

    // Transition: Scheduled
    const appointmentDate = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const scheduled = await referralManagementService.updateReferralStatus(
      referral.id,
      'scheduled',
      appointmentDate
    );
    console.log(`   ✔ Referral Scheduled [Status: ${scheduled.status}, Date: ${scheduled.appointment_date}]`);

    // Transition: Completed with Consult Note Returned
    const completed = await referralManagementService.updateReferralStatus(
      referral.id,
      'consult_note_returned',
      undefined,
      'Coronary CTA performed: 70% proximal LAD stenosis. Initiated high-intensity rosuvastatin and scheduled elective cardiac catheterization.',
      'Arthur Vance, MD (NPI: 1982736450)'
    );
    console.log(`   ✔ Consult Note Returned [Status: ${completed.status}, Specialist: ${completed.specialist_signature}]`);
    console.log(`     Summary: "${completed.consult_summary_notes.substring(0, 80)}..."`);

    // Verify session referrals
    const sessionReferrals = await referralManagementService.getReferralsBySession(session.id);
    if (sessionReferrals.length === 0 || sessionReferrals[0].status !== 'consult_note_returned') {
      throw new Error('Referral verification failed.');
    }

    // 3. Test e-Consultation Triage Eligibility Evaluation
    console.log('\n3. Testing Asynchronous e-Consultation Triage Screener...');
    const triageStable = referralManagementService.evaluateEConsultTriageEligibility(
      'Dermatology',
      'Stable annular erythematous scaly plaque on trunk for 6 weeks. No systemic symptoms.'
    );
    console.log(`   ✔ Stable Presentation Pathway: ${triageStable.recommendedPathway} (CPT: ${triageStable.billingCode}, Turnaround: ${triageStable.estimatedTurnaroundHours}h)`);
    if (triageStable.recommendedPathway !== 'e_consult') {
      throw new Error('Expected e_consult pathway for stable rash');
    }

    const triageUrgent = referralManagementService.evaluateEConsultTriageEligibility(
      'Cardiology',
      'Recurrent syncope with chest pressure and diaphoresis on exertion.'
    );
    console.log(`   ✔ High Acuity Pathway: ${triageUrgent.recommendedPathway} (Turnaround: ${triageUrgent.estimatedTurnaroundHours}h)`);
    if (triageUrgent.recommendedPathway !== 'in_person_referral') {
      throw new Error('Expected in_person_referral pathway for syncope');
    }

    // 4. Test Asynchronous e-Consultation Request & Response (CPT 99451)
    console.log('\n4. Testing Asynchronous e-Consult Submission & Specialist Response...');
    const eConsult = await referralManagementService.createEConsult({
      sessionId: session.id,
      patientId: patient.id,
      specialty: 'Dermatology',
      clinicalQuestion: 'Please review dermoscopy image of annular plaque on right flank. Suspect tinea corporis vs nummular eczema. Recommended topical therapy?',
      urgency: 'standard_48h'
    });
    console.log(`   ✔ e-Consult Submitted [ID: #${eConsult.id}, Specialty: ${eConsult.specialty}, Status: ${eConsult.status}]`);

    // Specialist responds
    const answeredEConsult = await referralManagementService.respondToEConsult(
      eConsult.id,
      'Morphology and peripheral collarette of scale are characteristic of Tinea Corporis. Recommend Terbinafine 1% cream BID x 14 days. Avoid combination steroid creams (e.g. Lotrisone) which risk tinea incognito.',
      101, // specialist ID
      false
    );
    console.log(`   ✔ e-Consult Answered [Status: ${answeredEConsult.status}]`);
    console.log(`     Specialist Advice: "${answeredEConsult.specialist_response.substring(0, 90)}..."`);

    // Verify session eConsults
    const sessionEConsults = await referralManagementService.getEConsultsBySession(session.id);
    if (sessionEConsults.length === 0 || sessionEConsults[0].status !== 'answered') {
      throw new Error('e-Consult retrieval verification failed.');
    }

    console.log('\n====================================================');
    console.log('  Phase 33 Referral & eConsult Test Passed 100%!    ');
    console.log('====================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Referral & eConsult Test Failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runReferralManagementTest();
