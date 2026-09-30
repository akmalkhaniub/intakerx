import { pool, bootstrap } from './db';
import { infectionSurveillanceService } from './services/infectionSurveillance';

async function runInfectionSurveillanceTest() {
  console.log('====================================================');
  console.log('  IntakeRx Phase 42: Infection Prevention & NHSN    ');
  console.log('====================================================\n');

  try {
    console.log('Initializing database bootstrap...');
    await bootstrap();

    // 1. Setup Patient and Inpatient Session
    console.log('1. Setting up Inpatient for Device-Day Infection Surveillance...');
    const patientEmail = `hai.patient.${Date.now()}@example.com`;
    const patientRes = await pool.query(`
      INSERT INTO patients (name, email, password_hash, dob, sex)
      VALUES ('Harold Finch', $1, 'pass_hash', '1952-11-04', 'Male')
      RETURNING id, name;
    `, [patientEmail]);
    const patient = patientRes.rows[0];

    const sessionRes = await pool.query(`
      INSERT INTO intake_sessions (id, patient_id, status, triage_level, triage_rationale)
      VALUES (gen_random_uuid(), $1, 'active', 'priority', 'Inpatient ICU Admission - Invasive Device Surveillance')
      RETURNING id;
    `, [patient.id]);
    const session = sessionRes.rows[0];

    console.log(`   ✔ Patient Initialized [ID: ${patient.id}, Name: ${patient.name}]`);
    console.log(`   ✔ Inpatient Session Linked [UUID: ${session.id.substring(0, 8)}]`);

    // 2. Query Seeded Infection Surveillance Metrics
    console.log('\n2. Querying Baseline Infection Control & Device Surveillance Summary...');
    const initialSummary = await infectionSurveillanceService.getHaiSurveillanceSummary();
    console.log(`   ✔ Active Invasive Lines: ${initialSummary.metrics.totalActiveLines}`);
    console.log(`   ✔ Confirmed HAIs: ${initialSummary.metrics.confirmedHais}`);
    console.log(`   ✔ Estimated HACRP SIR: ${initialSummary.metrics.hacrpSirEstimate}`);

    // 3. Log High-Risk Central Venous Line with Dwell Time Breach
    console.log('\n3. Ingesting Central Venous Line with Prolonged Dwell Time (6 Days)...');
    const cvcLine = await infectionSurveillanceService.logDeviceLine({
      patientId: patient.id,
      sessionId: session.id,
      deviceType: 'central_venous_catheter',
      insertionDate: '2026-09-24',
      lineDaysCount: 6,
      anatomicalSite: 'right_internal_jugular',
      necessityJustification: 'Total parenteral nutrition and central venous pressure monitoring',
      bundleChecklist: [
        'Sterile insertion checklist attested',
        'Chlorhexidine sponge dressing in place',
        'Daily line necessity review completed'
      ]
    });

    console.log(`   ✔ CVC Line Registered: ID = #${cvcLine.id} [Site: ${cvcLine.anatomicalSite}]`);
    console.log(`   ✔ Line Days: ${cvcLine.lineDaysCount}`);
    console.log(`   ✔ Dwell Time Alert Triggered: ${cvcLine.dwellTimeAlert} (Expected: true)`);
    console.log(`   ✔ Status: ${cvcLine.status} (Expected: removal_recommended)`);

    if (!cvcLine.dwellTimeAlert || cvcLine.status !== 'removal_recommended') {
      throw new Error('Expected central line > 5 days to trigger dwell time removal recommendation');
    }

    // 4. Log Short-Term Indwelling Foley Catheter (Normative Dwell Time)
    console.log('\n4. Ingesting Indwelling Foley Catheter (1 Day Dwell Time)...');
    const foleyLine = await infectionSurveillanceService.logDeviceLine({
      patientId: patient.id,
      sessionId: session.id,
      deviceType: 'foley_urinary_catheter',
      insertionDate: '2026-09-29',
      lineDaysCount: 1,
      anatomicalSite: 'urethral',
      necessityJustification: 'Post-operative urinary output monitoring following abdominal surgery'
    });

    console.log(`   ✔ Foley Catheter Registered: ID = #${foleyLine.id}`);
    console.log(`   ✔ Line Days: ${foleyLine.lineDaysCount}`);
    console.log(`   ✔ Dwell Time Alert Triggered: ${foleyLine.dwellTimeAlert} (Expected: false)`);
    console.log(`   ✔ Status: ${foleyLine.status} (Expected: active)`);

    if (foleyLine.dwellTimeAlert || foleyLine.status !== 'active') {
      throw new Error('Expected 1-day Foley catheter to be active without dwell alert');
    }

    // 5. Evaluate CDC NHSN CLABSI Event
    console.log('\n5. Evaluating Bloodstream Infection Against CDC NHSN CLABSI Criteria...');
    const clabsiEvent = await infectionSurveillanceService.evaluateHaiInfection({
      patientId: patient.id,
      deviceLineId: cvcLine.id,
      infectionType: 'CLABSI',
      identifiedOrganism: 'Enterococcus faecalis',
      colonyCount: '2/2 Blood Cultures Positive',
      lineDaysAtOnset: 6,
      feverPresent: true,
      clinicalSignsDescription: 'High fever 39.1C, rigors, erythema and purulent exudate around CVC insertion site',
      primaryAlternativeSourceExcluded: true
    });

    console.log(`   ✔ CLABSI Evaluation Recorded: ID = #${clabsiEvent.id}`);
    console.log(`   ✔ Pathogen: ${clabsiEvent.identifiedOrganism}`);
    console.log(`   ✔ NHSN Criteria Met: ${clabsiEvent.nhsnCriteriaMet} (Expected: true)`);
    console.log(`   ✔ HACRP Domain: ${clabsiEvent.hacrpDomain}`);
    console.log(`   ✔ HACRP Penalty Risk Tier: ${clabsiEvent.hacrpPenaltyRisk} (Expected: high_penalty_zone)`);

    if (!clabsiEvent.nhsnCriteriaMet || clabsiEvent.hacrpPenaltyRisk !== 'high_penalty_zone') {
      throw new Error('Expected confirmed CLABSI event with high penalty risk');
    }

    // 6. Evaluate Positive Clostridioides Difficile LabID Event & Automated Isolation
    console.log('\n6. Evaluating Positive C. difficile PCR Lab & Automated Isolation Precautions...');
    const cdiffEvent = await infectionSurveillanceService.evaluateHaiInfection({
      patientId: patient.id,
      infectionType: 'C_DIFFICILE',
      identifiedOrganism: 'Clostridioides difficile (Toxin B PCR Positive)',
      feverPresent: true,
      clinicalSignsDescription: 'Watery diarrhea > 6 episodes/day post-clindamycin therapy; leukocytosis 17.5k'
    });

    console.log(`   ✔ C. difficile Event Recorded: ID = #${cdiffEvent.id}`);
    console.log(`   ✔ Isolation Precautions: ${cdiffEvent.isolationPrecautions} (Expected: contact_enteric_isolation)`);

    if (cdiffEvent.isolationPrecautions !== 'contact_enteric_isolation') {
      throw new Error('Expected contact_enteric_isolation for C. difficile');
    }

    // 7. Update Line Status Upon Removal
    console.log('\n7. Discontinuing Central Venous Line Following Infection Confirmation...');
    const removedLine = await infectionSurveillanceService.updateDeviceStatus(cvcLine.id, 'discontinued', '2026-09-30');
    console.log(`   ✔ Line Status Updated: ${removedLine.status} (Expected: discontinued)`);
    console.log(`   ✔ Documented Removal Date: ${removedLine.removalDate}`);

    if (removedLine.status !== 'discontinued') {
      throw new Error('Expected line status to be discontinued');
    }

    // 8. Query Updated Infection Prevention Summary
    console.log('\n8. Querying Post-Intervention Infection Prevention Dashboard...');
    const updatedSummary = await infectionSurveillanceService.getHaiSurveillanceSummary();
    console.log(`   ✔ Active Lines Tracked: ${updatedSummary.metrics.totalActiveLines}`);
    console.log(`   ✔ Confirmed HAIs Logged: ${updatedSummary.metrics.confirmedHais}`);
    console.log(`   ✔ Patients Under Isolation Precautions: ${updatedSummary.metrics.patientsInIsolation}`);
    console.log(`   ✔ Forecasted Standardized Infection Ratio (SIR): ${updatedSummary.metrics.hacrpSirEstimate}`);

    console.log('\n====================================================');
    console.log('  Phase 42 Test Passed: 100% SUCCESS               ');
    console.log('====================================================\n');
  } catch (err) {
    console.error('\n❌ Test failed with error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runInfectionSurveillanceTest();
