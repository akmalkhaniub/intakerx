import { pool, bootstrap } from './db';
import { perioperativeSuiteService } from './services/perioperativeSuite';

async function runPerioperativeSuiteTest() {
  console.log('====================================================');
  console.log('  IntakeRx Phase 41: Perioperative Care & ERAS Hub  ');
  console.log('====================================================\n');

  try {
    console.log('Initializing database bootstrap...');
    await bootstrap();

    // 1. Setup Surgical Patient and Session
    console.log('1. Setting up Perioperative Surgical Patient...');
    const patientEmail = `surg.patient.${Date.now()}@example.com`;
    const patientRes = await pool.query(`
      INSERT INTO patients (name, email, password_hash, dob, sex)
      VALUES ('Dennis Gallagher', $1, 'hashed_pwd', '1960-03-22', 'Male')
      RETURNING id, name;
    `, [patientEmail]);
    const patient = patientRes.rows[0];

    const sessionRes = await pool.query(`
      INSERT INTO intake_sessions (id, patient_id, status, triage_level, triage_rationale)
      VALUES (gen_random_uuid(), $1, 'active', 'priority', 'Elective Laparoscopic Colectomy - Pre-Op Surgical Pathway')
      RETURNING id;
    `, [patient.id]);
    const session = sessionRes.rows[0];

    console.log(`   ✔ Patient Initialized [ID: ${patient.id}, Name: ${patient.name}]`);
    console.log(`   ✔ Intake Session Linked [UUID: ${session.id.substring(0, 8)}]`);

    // 2. Query Initial Seeded OR Schedule
    console.log('\n2. Querying Initial Operating Room Schedule...');
    const initialCases = await perioperativeSuiteService.getSurgicalCases();
    console.log(`   ✔ Active OR Cases Found: ${initialCases.length}`);
    if (initialCases.length === 0) {
      throw new Error('Expected initial seeded OR cases to exist.');
    }

    // 3. Book New Complex Surgical Case with RCRI Risk Stratification
    console.log('\n3. Booking Surgical Case with RCRI & ASA Risk Stratification...');
    const bookedCase = await perioperativeSuiteService.createSurgicalCase({
      patientId: patient.id,
      sessionId: session.id,
      procedureName: 'Laparoscopic Low Anterior Resection & Loop Ileostomy',
      operatingRoom: 'OR-4 (Colorectal MIS)',
      primarySurgeon: 'Dr. Jordan Ross, MD (Colorectal Attending)',
      anesthesiologist: 'Dr. Maya Lin, MD (Chief Anesthesiologist)',
      asaClass: 'ASA_III',
      rcriFactors: {
        highRiskSurgery: true,
        ischemicHeartDisease: true,
        congestiveHeartFailure: false,
        cerebrovascularDisease: false,
        insulinTherapy: false,
        preopCreatinineOverTwo: false
      },
      mallampatiClass: 'Class_II',
      npoStatusVerified: true
    });

    console.log(`   ✔ Case Booked: ID = #${bookedCase.id} [Room: ${bookedCase.operatingRoom}]`);
    console.log(`   ✔ Procedure: ${bookedCase.procedureName}`);
    console.log(`   ✔ ASA Physical Status: ${bookedCase.asaClass}`);
    console.log(`   ✔ Calculated RCRI Score: ${bookedCase.rcriScore} (Expected: 2)`);
    console.log(`   ✔ Estimated Cardiac Risk: ${bookedCase.rcriRiskPercentage}% (Expected: 2.4%)`);

    if (bookedCase.rcriScore !== 2 || bookedCase.rcriRiskPercentage !== 2.4) {
      throw new Error('RCRI calculation mismatch');
    }

    // 4. Advance Case Lifecycle through Perioperative Milestones
    console.log('\n4. Progressing Case Through Pre-Op & Intra-Op Milestones...');
    const preopCase = await perioperativeSuiteService.updateCaseStatus(bookedCase.id, 'preop_ready');
    console.log(`   ✔ Pre-Op Clearance Verified: Status = ${preopCase.status}`);

    const inOrCase = await perioperativeSuiteService.updateCaseStatus(bookedCase.id, 'in_or');
    console.log(`   ✔ Patient In Operating Room: Status = ${inOrCase.status}`);

    // 5. Record Intra-Op Anesthesia, Neuromuscular TOF & Aldrete Recovery
    console.log('\n5. Logging Intra-Op Anesthesia, TOF Twitches & PACU Aldrete Scoring...');
    const anesthRecord = await perioperativeSuiteService.recordAnesthesiaLog({
      caseId: bookedCase.id,
      anesthesiaType: 'general_endotracheal',
      airwayGrade: 'Grade_1',
      tofTwitchCount: 4, // Complete neuromuscular recovery
      reversalAgent: 'sugammadex_200mg',
      eblMl: 125,
      fluidsAdministeredMl: 1400,
      aldreteScore: 9, // ≥9 meets discharge criteria
      ponvApfelScore: 1,
      erasAdherenceItems: [
        'Preoperative carbohydrate loading drink',
        'Multimodal opioid-sparing analgesia (IV Acetaminophen + Ketorolac)',
        'Bilateral ultrasound-guided TAP block',
        'Intraoperative normothermia maintenance (Bair Hugger)',
        'Early post-extubation oral hydration plan'
      ],
      anesthesiologistNotes: 'Smooth emergence, extubated in OR with zero residual neuromuscular block. Transferred to PACU on room air.'
    });

    console.log(`   ✔ Anesthesia Record Created: ID = #${anesthRecord.id}`);
    console.log(`   ✔ Neuromuscular TOF: ${anesthRecord.tofTwitchCount}/4 with ${anesthRecord.reversalAgent}`);
    console.log(`   ✔ Modified Aldrete Score: ${anesthRecord.aldreteScore}/10`);
    console.log(`   ✔ PACU Discharge Eligibility: ${anesthRecord.pacuDischargeEligible} (Expected: true)`);
    console.log(`   ✔ ERAS Checklist Elements Adhered: ${anesthRecord.erasProtocolAdherence.length}`);

    if (!anesthRecord.pacuDischargeEligible) {
      throw new Error('Expected patient with Aldrete 9 and TOF 4 to be PACU discharge eligible');
    }

    // 6. Complete PACU Recovery and Discharge Case
    console.log('\n6. Completing PACU Recovery & Discharging to Inpatient Surgical Ward...');
    const dischargedCase = await perioperativeSuiteService.updateCaseStatus(bookedCase.id, 'discharged');
    console.log(`   ✔ Final Case Status: ${dischargedCase.status} (Expected: discharged)`);

    // 7. Verify Joined Query Details
    console.log('\n7. Verifying Comprehensive Joined Case Details...');
    const verifiedCase = await perioperativeSuiteService.getCaseById(bookedCase.id);
    console.log(`   ✔ Verified Case ID ${verifiedCase?.id} with Anesthesia ID ${verifiedCase?.anesthesiaRecord?.id}`);
    console.log(`   ✔ Patient Name Attached: ${verifiedCase?.patientName}`);

    if (!verifiedCase?.anesthesiaRecord) {
      throw new Error('Expected joined anesthesia record to be populated');
    }

    console.log('\n====================================================');
    console.log('  Phase 41 Test Passed: 100% SUCCESS               ');
    console.log('====================================================\n');
  } catch (err) {
    console.error('\n❌ Test failed with error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runPerioperativeSuiteTest();
