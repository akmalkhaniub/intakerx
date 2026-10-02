import { pool, bootstrap } from './db';
import * as criticalCareShockService from './services/criticalCareShock';

async function runCriticalCareShockTest() {
  console.log('====================================================');
  console.log('  IntakeRx Phase 46: ICU Shock Resuscitation Engine ');
  console.log('====================================================\n');

  try {
    console.log('Initializing database bootstrap...');
    await bootstrap();

    // 1. Setup Patient and ICU Session
    console.log('1. Setting up Inpatient for ICU Hemodynamic Shock Surveillance...');
    const patientEmail = `shock.patient.${Date.now()}@example.com`;
    const patientRes = await pool.query(`
      INSERT INTO patients (name, email, password_hash, dob, sex)
      VALUES ('Victor Thorne', $1, 'pass_hash', '1961-05-14', 'Male')
      RETURNING id, name;
    `, [patientEmail]);
    const patient = patientRes.rows[0];

    const sessionRes = await pool.query(`
      INSERT INTO intake_sessions (id, patient_id, status, triage_level, triage_rationale)
      VALUES (gen_random_uuid(), $1, 'active', 'immediate', 'Septic Shock with Refractory Hypotension - MICU')
      RETURNING id;
    `, [patient.id]);
    const session = sessionRes.rows[0];

    console.log(`   ✔ Patient Initialized [ID: ${patient.id}, Name: ${patient.name}]`);
    console.log(`   ✔ Critical Care Session Linked [UUID: ${session.id.substring(0, 8)}]`);

    // 2. Query Baseline ICU Shock Summary
    console.log('\n2. Querying Baseline ICU Hemodynamic Shock Summary...');
    const initialSummary = await criticalCareShockService.getIcuShockSummary();
    console.log(`   ✔ Total Active Shock Cases: ${initialSummary.metrics.activeShockCases}`);
    console.log(`   ✔ Septic Shock Count: ${initialSummary.metrics.septicShockCount}`);
    console.log(`   ✔ Baseline Target MAP Attainment Rate: ${initialSummary.metrics.targetMapAttainmentRate}%`);

    // 3. Ingest Acute Septic Shock Presentation
    console.log('\n3. Evaluating Acute Septic Shock & Dynamic Fluid Responsiveness...');
    const shockRecord = await criticalCareShockService.evaluateShockAndResuscitation({
      patientId: patient.id,
      sessionId: session.id,
      icuBed: 'MICU Bed 12',
      shockPhenotype: 'distributive_septic',
      meanArterialPressure: 54.0,
      cardiacIndex: 3.8,
      systemicVascularResistance: 580,
      fluidResponsivenessIndex: 'PPV 16% (Fluid Responsive)',
      ultrasoundPattern: 'A_lines_dry',
      serumLactateMmolL: 4.5,
      primaryVasopressor: 'Norepinephrine',
      currentDoseMcgKgMin: 0.10,
      attendingIntensivist: 'Dr. Marcus Webb, MD'
    });

    console.log(`   ✔ Shock Record Created: ID = #${shockRecord.id}`);
    console.log(`   ✔ Phenotype: ${shockRecord.shock_phenotype}`);
    console.log(`   ✔ Baseline MAP: ${shockRecord.mean_arterial_pressure} mmHg (Target: >= 65 mmHg)`);
    console.log(`   ✔ Fluid Responsiveness: ${shockRecord.fluid_responsiveness_index}`);
    console.log(`   ✔ Initial Resuscitation Status: ${shockRecord.resuscitation_status} (Expected: active_resuscitation)`);

    if (shockRecord.resuscitation_status !== 'active_resuscitation') {
      throw new Error(`Unexpected initial status: got ${shockRecord.resuscitation_status}, expected active_resuscitation`);
    }

    // 4. Log Vasopressor Titration Cascade
    console.log('\n4. Titrating Norepinephrine Infusion for MAP < 65 mmHg...');
    const titration = await criticalCareShockService.recordVasopressorTitration({
      shockRecordId: shockRecord.id,
      agentName: 'Norepinephrine',
      doseRate: 0.22,
      doseUnits: 'mcg/kg/min',
      targetMap: 65,
      resultingMap: 68,
      titrationReason: 'Escalated from 0.10 to 0.22 mcg/kg/min; crystalloid bolus co-administered based on A-lines',
      titratedBy: 'Critical Care Protocol Team'
    });

    console.log(`   ✔ Titration Logged: ID = #${titration.id}`);
    console.log(`   ✔ Agent: ${titration.agent_name} @ ${titration.dose_rate} ${titration.dose_units}`);
    console.log(`   ✔ Resulting MAP: ${titration.resulting_map} mmHg (Target Achieved: true)`);

    if (titration.resulting_map < 65) {
      throw new Error(`Target MAP not achieved in titration: got ${titration.resulting_map}`);
    }

    // 5. Ingest Reperfusion & Lactate Clearance Evaluation
    console.log('\n5. Evaluating 2-Hour Resuscitation Reperfusion & Lactate Clearance Kinetics...');
    const reperfusedRecord = await criticalCareShockService.evaluateShockAndResuscitation({
      patientId: patient.id,
      sessionId: session.id,
      icuBed: 'MICU Bed 12',
      shockPhenotype: 'distributive_septic',
      meanArterialPressure: 70.0,
      cardiacIndex: 3.2,
      systemicVascularResistance: 820,
      fluidResponsivenessIndex: 'PPV 8% (Fluid Refractory)',
      ultrasoundPattern: 'A_lines_dry',
      serumLactateMmolL: 2.5,
      baselineLactate: 4.5,
      primaryVasopressor: 'Norepinephrine',
      currentDoseMcgKgMin: 0.14,
      attendingIntensivist: 'Dr. Marcus Webb, MD'
    });

    console.log(`   ✔ Re-evaluation Record: ID = #${reperfusedRecord.id}`);
    console.log(`   ✔ Updated MAP: ${reperfusedRecord.mean_arterial_pressure} mmHg`);
    console.log(`   ✔ Current Lactate: ${reperfusedRecord.serum_lactate_mmol_l} mmol/L (Baseline: 4.5)`);
    console.log(`   ✔ Calculated Lactate Clearance: ${reperfusedRecord.lactate_clearance_percent}% (Expected: ~44.4%)`);
    console.log(`   ✔ Updated Status: ${reperfusedRecord.resuscitation_status} (Expected: stabilized)`);

    if (reperfusedRecord.resuscitation_status !== 'stabilized' || Number(reperfusedRecord.lactate_clearance_percent) < 20) {
      throw new Error('Lactate clearance or stabilization status check failed');
    }

    // 6. Query Updated ICU Shock Analytics
    console.log('\n6. Querying Updated ICU Hemodynamic Command Analytics...');
    const updatedSummary = await criticalCareShockService.getIcuShockSummary();
    console.log(`   ✔ Total Active Shock Records: ${updatedSummary.metrics.activeShockCases}`);
    console.log(`   ✔ Septic Shock Cases: ${updatedSummary.metrics.septicShockCount}`);
    console.log(`   ✔ Mean Lactate Clearance Rate: ${updatedSummary.metrics.meanLactateClearanceRate}%`);
    console.log(`   ✔ Target MAP Attainment Rate: ${updatedSummary.metrics.targetMapAttainmentRate}%`);

    console.log('\n====================================================');
    console.log('  Phase 46 Test Passed: 100% SUCCESS               ');
    console.log('====================================================\n');

  } catch (err) {
    console.error('\n❌ Phase 46 Test Failed with Error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runCriticalCareShockTest();
