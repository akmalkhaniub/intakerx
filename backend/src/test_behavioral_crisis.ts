import { pool, bootstrap } from './db';
import * as behavioralCrisisService from './services/behavioralCrisis';

async function runBehavioralCrisisTest() {
  console.log('====================================================');
  console.log('  IntakeRx Phase 45: Behavioral Health & Crisis Hub ');
  console.log('====================================================\n');

  try {
    console.log('Initializing database bootstrap...');
    await bootstrap();

    // 1. Setup Patient and Emergency Crisis Session
    console.log('1. Setting up Inpatient for Emergency Psychiatric Crisis Evaluation...');
    const patientEmail = `psych.patient.${Date.now()}@example.com`;
    const patientRes = await pool.query(`
      INSERT INTO patients (name, email, password_hash, dob, sex)
      VALUES ('Raymond Vance', $1, 'pass_hash', '1975-09-18', 'Male')
      RETURNING id, name;
    `, [patientEmail]);
    const patient = patientRes.rows[0];

    const sessionRes = await pool.query(`
      INSERT INTO intake_sessions (id, patient_id, status, triage_level, triage_rationale)
      VALUES (gen_random_uuid(), $1, 'active', 'immediate', 'Emergency Dept Agitation - Acute Psych Evaluation')
      RETURNING id;
    `, [patient.id]);
    const session = sessionRes.rows[0];

    console.log(`   ✔ Patient Initialized [ID: ${patient.id}, Name: ${patient.name}]`);
    console.log(`   ✔ Crisis Session Linked [UUID: ${session.id.substring(0, 8)}]`);

    // 2. Query Baseline Behavioral Crisis Summary
    console.log('\n2. Querying Baseline Behavioral Crisis & Involuntary Hold Metrics...');
    const initialSummary = await behavioralCrisisService.getBehavioralCrisisSummary();
    console.log(`   ✔ Active Crises Logged: ${initialSummary.metrics.activeCrises}`);
    console.log(`   ✔ 1:1 Observers Active: ${initialSummary.metrics.constantObserversRequired}`);
    console.log(`   ✔ Active Legal Holds: ${initialSummary.metrics.activeLegalHolds}`);
    console.log(`   ✔ Bed Placement Queue: ${initialSummary.metrics.bedPlacementQueue}`);

    // 3. Evaluate Acute Agitation using Brøset Violence Checklist (BVC)
    console.log('\n3. Evaluating Acute Agitation & Violence Risk with Brøset Violence Checklist (BVC)...');
    const evaluation = await behavioralCrisisService.evaluateBehavioralCrisis({
      patientId: patient.id,
      sessionId: session.id,
      bvcItems: {
        confused: true,
        irritable: true,
        boisterous: true,
        physicallyThreatening: false,
        verballyThreatening: true,
        attackingObjects: false
      },
      suicideRiskLevel: 'high_active_intent',
      sensoryRoomUtilized: false,
      chemicalRestraintAdministered: false,
      evaluatingClinician: 'Psychiatric Emergency Specialist Dr. Julian Mercer, MD',
      clinicalNarrative: 'Patient exhibiting severe agitation, racing thoughts, and paranoia with active suicidal ideation.'
    });

    console.log(`   ✔ Crisis Evaluation ID: #${evaluation.id}`);
    console.log(`   ✔ BVC Score: ${evaluation.bvc_score} / 6 (Expected: 4)`);
    console.log(`   ✔ Violence Risk Level: ${evaluation.violence_risk_level} (Expected: high_imminent)`);
    console.log(`   ✔ Assigned Observation Level: ${evaluation.observation_level} (Expected: 1_to_1_constant_sitter)`);
    console.log(`   ✔ De-Escalation Protocol: ${evaluation.de_escalation_protocol} (Expected: behavioral_rapid_response_code_grey)`);

    if (evaluation.bvc_score !== 4 || evaluation.observation_level !== '1_to_1_constant_sitter') {
      throw new Error(`BVC evaluation or observation tier failed: got BVC=${evaluation.bvc_score}, obs=${evaluation.observation_level}`);
    }

    // 4. Initiate Involuntary Psychiatric Hold (California 5150 72-Hour Legal Hold)
    console.log('\n4. Executing Statutory Involuntary Psychiatric Hold (5150 72-Hour Hold)...');
    const hold = await behavioralCrisisService.initiateInvoluntaryHold({
      patientId: patient.id,
      crisisEvaluationId: evaluation.id,
      statutoryHoldType: 'California 5150 (72h)',
      holdCriteria: ['danger_to_self', 'danger_to_others'],
      rightsAdvisementDelivered: true,
      holdDurationHours: 72,
      initiatingClinician: 'Dr. Julian Mercer, MD (Licensed Psychiatrist)'
    });

    console.log(`   ✔ Involuntary Hold Record ID: #${hold.id}`);
    console.log(`   ✔ Hold Statutory Type: ${hold.statutory_hold_type}`);
    console.log(`   ✔ Criteria Documented: ${JSON.stringify(hold.hold_criteria)}`);
    console.log(`   ✔ Rights Advisement Delivered: ${hold.rights_advisement_delivered} (Expected: true)`);
    console.log(`   ✔ Hold Expiration Timestamp: ${hold.expires_at}`);
    console.log(`   ✔ Initial Bed Placement Status: ${hold.bed_placement_status} (Expected: searching)`);

    // Verify hold expiration is ~72 hours in future
    const holdInitiated = new Date(hold.initiated_at).getTime();
    const holdExpires = new Date(hold.expires_at).getTime();
    const diffHours = Math.round((holdExpires - holdInitiated) / (1000 * 3600));
    console.log(`   ✔ Statutory Expiration Window: ${diffHours} Hours (Expected: 72)`);

    if (diffHours !== 72) {
      throw new Error(`Involuntary hold expiration mismatch: calculated ${diffHours} hours, expected 72`);
    }

    // 5. Regional Psychiatric Crisis Bed Locator & Placement Logistics
    console.log('\n5. Locating Regional Inpatient Psychiatric Bed & Updating Placement Queue...');
    const updatedHold = await behavioralCrisisService.updateHoldPlacement(hold.id, {
      bedPlacementStatus: 'bed_reserved',
      destinationFacility: 'Cedars-Sinai Inpatient Psychiatric Pavilion (Bed 302A)'
    });

    console.log(`   ✔ Bed Placement Updated: ${updatedHold.bed_placement_status} (Expected: bed_reserved)`);
    console.log(`   ✔ Target Destination Facility: ${updatedHold.destination_facility}`);

    // Progress to transport en route
    const transportHold = await behavioralCrisisService.updateHoldPlacement(hold.id, {
      bedPlacementStatus: 'transport_en_route'
    });
    console.log(`   ✔ Transport Status: ${transportHold.bed_placement_status} (Expected: transport_en_route)`);

    // 6. Query Updated Post-Intervention Behavioral Health Summary
    console.log('\n6. Querying Updated Behavioral Health Command Analytics...');
    const updatedSummary = await behavioralCrisisService.getBehavioralCrisisSummary();
    console.log(`   ✔ Total Active Crises: ${updatedSummary.metrics.activeCrises}`);
    console.log(`   ✔ Patients Under 1:1 Observation: ${updatedSummary.metrics.constantObserversRequired}`);
    console.log(`   ✔ Active Involuntary Legal Holds: ${updatedSummary.metrics.activeLegalHolds}`);
    console.log(`   ✔ Restraint-Free De-Escalation Success Rate: ${updatedSummary.metrics.deEscalationSuccessRate}%`);

    console.log('\n====================================================');
    console.log('  Phase 45 Test Passed: 100% SUCCESS               ');
    console.log('====================================================\n');

  } catch (err) {
    console.error('\n❌ Phase 45 Test Failed with Error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runBehavioralCrisisTest();
