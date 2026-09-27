import { pool, bootstrap } from './db';
import { ipassRoundingService } from './services/ipassRounding';

async function runIpassRoundingTest() {
  console.log('====================================================');
  console.log('  IntakeRx Phase 34: Inpatient I-PASS & Rounding    ');
  console.log('====================================================\n');

  try {
    await bootstrap();

    // 1. Setup Inpatient Case
    console.log('1. Setting up Inpatient Patient & Shift Handoff Context...');
    const patientEmail = `ipass.patient.${Date.now()}@example.com`;
    const patientRes = await pool.query(`
      INSERT INTO patients (name, email, password_hash, dob, sex)
      VALUES ('Margaret Holloway', $1, 'ipass_pw', '1952-08-14', 'Female')
      RETURNING *
    `, [patientEmail]);
    const patient = patientRes.rows[0];

    const sessionRes = await pool.query(`
      INSERT INTO intake_sessions (id, patient_id, status, triage_level, triage_rationale)
      VALUES (gen_random_uuid(), $1, 'active', 'orange', 'Inpatient Ward Bed 412-A • Post-Op Rounding & Night Shift Transfer')
      RETURNING *
    `, [patient.id]);
    const session = sessionRes.rows[0];
    console.log(`   ✔ Inpatient Encounter initialized [Session: ${session.id.substring(0, 8)}, Bed 412-A: ${patient.name}]`);

    // 2. Create Standardized I-PASS Handoff
    console.log('\n2. Authoring Standardized I-PASS Shift Handoff...');
    const handoff = await ipassRoundingService.createHandoff({
      patientId: patient.id,
      sessionId: session.id,
      illnessSeverity: 'watcher',
      patientSummary: '72yo F POD#2 s/p right total hip arthroplasty. Developed low-grade fever 38.1C. Surgical dressing clean/dry/intact. Hemodynamically compensated.',
      actionItems: [
        {
          id: 'action-1',
          task: 'Check morning CBC and Basic Metabolic Panel (target Hgb > 8.0 g/dL)',
          completed: false,
          priority: 'stat',
          assignee: 'Night On-Call Resident'
        },
        {
          id: 'action-2',
          task: 'Ensure incentive spirometry 10 breaths/hr while awake to prevent atelectasis',
          completed: false,
          priority: 'routine',
          assignee: 'Bedside RN'
        }
      ],
      contingencyPlans: [
        {
          trigger: 'If Temp >= 38.5C or HR > 105 bpm',
          plan: 'Collect blood cultures x 2 sets, send urinalysis with reflex culture, initiate paracetamol 1g PO, notify cross-cover fellow.'
        },
        {
          trigger: 'If SBP < 90 mmHg or acute urine output < 0.5 mL/kg/hr for 2h',
          plan: 'Administer 500 mL Lactated Ringers bolus, check for Foley kink/obstruction, re-evaluate within 20 minutes.'
        }
      ],
      linesTubesDrains: [
        {
          type: 'Indwelling Foley Urinary Catheter',
          location: 'Urethral',
          insertedDate: '2026-09-24',
          daysInPlace: 4,
          infectionRiskTier: 'high_clabsi_cauti_risk'
        },
        {
          type: 'Peripheral IV 20G',
          location: 'Left Antecubital Fossa',
          insertedDate: '2026-09-27',
          daysInPlace: 1,
          infectionRiskTier: 'low'
        }
      ],
      dischargeBarriers: [
        'Physical Therapy gait clearance (currently weight-bearing as tolerated with walker)',
        'Discontinue Foley catheter (CAUTI reduction protocol day 4 prompt)',
        'Coordinate home health physical therapy and visiting nurse'
      ],
      outgoingClinicianId: 1
    });

    console.log(`   ✔ I-PASS Handoff Created [ID: #${handoff.id}, Severity: ${handoff.illness_severity.toUpperCase()}]`);
    console.log(`   ✔ Action Items Count: ${handoff.action_items.length}`);
    console.log(`   ✔ Contingency Triggers: ${handoff.contingency_plans.length}`);
    console.log(`   ✔ Lines/Tubes/Drains: ${handoff.lines_tubes_drains.length} (CAUTI Alert: Foley Day 4)`);

    // 3. Test Action Item Completion
    console.log('\n3. Testing Action Item Status Toggle...');
    const updatedHandoff = await ipassRoundingService.toggleActionItem(handoff.id, 'action-1', true);
    const completedItem = updatedHandoff.action_items.find((a: any) => a.id === 'action-1');
    console.log(`   ✔ Action Item [action-1] Status: completed = ${completedItem.completed}`);
    if (!completedItem.completed) {
      throw new Error('Action item toggle failed.');
    }

    // 4. Test Synthesis by Receiver & Transfer Sign-Off
    console.log('\n4. Simulating Incoming Clinician Synthesis & Transfer Sign-Off...');
    const signedOff = await ipassRoundingService.signOffHandoff(
      handoff.id,
      2, // Incoming nocturnal hospitalist
      'Synthesis read-back completed: Watcher acuity accepted. Confirmed morning lab follow-up, CAUTI discontinuation protocol for morning rounds, and fluid resuscitation contingency plan.'
    );

    console.log(`   ✔ Transfer of Care Cryptographically Stamped [Signed: ${signedOff.signed_off_at}]`);
    console.log(`   ✔ Synthesis Notes: "${signedOff.synthesis_notes.substring(0, 75)}..."`);
    if (!signedOff.signed_off_at || signedOff.incoming_clinician_id !== 2) {
      throw new Error('Handoff transfer sign-off failed.');
    }

    // 5. Test Inpatient Rounding Census Summary
    console.log('\n5. Testing Inpatient Bedside Rounding Census Aggregator...');
    const census = await ipassRoundingService.getBedsideRoundingCensus();
    console.log(`   ✔ Census Patients Tracked: ${census.metrics.totalPatients}`);
    console.log(`   ✔ Watcher Count: ${census.metrics.watcherCount}`);
    console.log(`   ✔ Indwelling Devices > 3 Days (CLABSI/CAUTI risk): ${census.metrics.highRiskLinesCount}`);

    if (census.metrics.watcherCount < 1 || census.metrics.highRiskLinesCount < 1) {
      throw new Error('Census metrics aggregation failed.');
    }

    console.log('\n====================================================');
    console.log('  Phase 34 I-PASS & Rounding Test Passed 100%!       ');
    console.log('====================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ I-PASS & Rounding Test Failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runIpassRoundingTest();
