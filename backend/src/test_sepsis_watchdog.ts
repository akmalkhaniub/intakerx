import { pool, bootstrap } from './db';
import { sepsisWatchdogService } from './services/sepsisWatchdog';

async function runSepsisWatchdogTest() {
  console.log('====================================================');
  console.log('  IntakeRx Phase 36: Sepsis & Deterioration Watchdog');
  console.log('====================================================\n');

  try {
    await bootstrap();

    // 1. Setup Patient Context
    console.log('1. Setting up Inpatient Encounter with Suspected Sepsis...');
    const patientEmail = `sepsis.patient.${Date.now()}@example.com`;
    const patientRes = await pool.query(`
      INSERT INTO patients (name, email, password_hash, dob, sex)
      VALUES ('Eleanor Vance', $1, 'sepsis_pw', '1960-11-04', 'Female')
      RETURNING *
    `, [patientEmail]);
    const patient = patientRes.rows[0];

    const sessionRes = await pool.query(`
      INSERT INTO intake_sessions (id, patient_id, status, triage_level, triage_rationale)
      VALUES (gen_random_uuid(), $1, 'active', 'red', 'Emergency Dept Bed 14 - Acute Decompensation & Fever')
      RETURNING *
    `, [patient.id]);
    const session = sessionRes.rows[0];
    console.log(`   ✔ Encounter initialized [Session: ${session.id.substring(0, 8)}, Bed 14: ${patient.name}]`);

    // 2. Evaluate Septic Shock Presentation
    console.log('\n2. Evaluating Critical Telemetry & Lab Presentation...');
    const evalResult = await sepsisWatchdogService.evaluatePatient(
      patient.id,
      session.id,
      {
        heartRate: 124,
        respiratoryRate: 26,
        systolicBp: 86,
        diastolicBp: 52,
        temperatureC: 39.2,
        oxygenSaturation: 91,
        supplementalOxygen: true,
        avpuConsciousness: 'V' // Responding only to voice / acute confusion
      },
      {
        wbcCount: 17.8,
        bandsPercent: 14,
        lactate: 4.5,
        creatinine: 2.2,
        platelets: 110
      },
      'Severe Community-Acquired Pneumonia / Urosepsis'
    );

    console.log(`   ✔ SIRS Score: ${evalResult.sirsScore}/4 (Positive: ${evalResult.sirsPositive})`);
    evalResult.sirsCriteria.forEach(c => console.log(`     - ${c}`));

    console.log(`   ✔ qSOFA Score: ${evalResult.qsofaScore}/3 (Positive: ${evalResult.qsofaPositive})`);
    evalResult.qsofaCriteria.forEach(c => console.log(`     - ${c}`));

    console.log(`   ✔ NEWS2 Composite Score: ${evalResult.news2Score} (Risk Category: ${evalResult.news2Risk})`);
    console.log(`   ✔ Deterioration Tier: ${evalResult.deteriorationTier.toUpperCase()}`);

    if (evalResult.sirsScore < 3) {
      throw new Error(`Expected SIRS >= 3, got ${evalResult.sirsScore}`);
    }
    if (evalResult.qsofaScore !== 3) {
      throw new Error(`Expected qSOFA = 3, got ${evalResult.qsofaScore}`);
    }
    if (evalResult.news2Score < 8) {
      throw new Error(`Expected NEWS2 >= 8, got ${evalResult.news2Score}`);
    }
    if (evalResult.deteriorationTier !== 'critical_sepsis') {
      throw new Error(`Expected deterioration tier 'critical_sepsis', got ${evalResult.deteriorationTier}`);
    }
    if (!evalResult.sep1Bundle) {
      throw new Error('Expected automated SEP-1 3-hour bundle generation');
    }

    console.log(`   ✔ Automated SEP-1 Bundle Initialized [Bundle ID: ${evalResult.sep1Bundle.id}]`);

    // 3. Execute CMS SEP-1 Resuscitation Bundle
    console.log('\n3. Executing CMS SEP-1 3-Hour Resuscitation Bundle Actions...');
    const updatedBundle = await sepsisWatchdogService.updateBundleAction(
      evalResult.sep1Bundle.id,
      {
        lactateMeasured: true,
        lactateValue: 4.5,
        bloodCulturesDrawn: true,
        broadSpectrumAbxOrdered: true,
        abxRegimen: 'Vancomycin 1.5g IV stat + Piperacillin-Tazobactam 4.5g IV stat',
        fluidResuscitationAdministered: true,
        fluidVolumeMl: 2100, // 30 mL/kg for 70kg patient
        notes: 'Resuscitation in progress. Peripheral lines established x2. Lactated Ringers infused under pressure.'
      }
    );

    console.log(`   ✔ Blood Cultures Drawn: ${updatedBundle.blood_cultures_drawn}`);
    console.log(`   ✔ Antimicrobial Regimen: ${updatedBundle.abx_regimen}`);
    console.log(`   ✔ Fluid Resuscitation: ${updatedBundle.fluid_volume_ml} mL Crystalloid`);
    console.log(`   ✔ Bundle Completed Timestamp: ${updatedBundle.bundle_completed_at}`);

    if (!updatedBundle.bundle_completed_at) {
      throw new Error('Expected bundle_completed_at to be populated upon completing core criteria');
    }

    // 4. Fetch Facility-Wide Sepsis Surveillance Alerts
    console.log('\n4. Querying Active Facility Sepsis Alerts...');
    const activeAlerts = await sepsisWatchdogService.getActiveSepsisAlerts();
    console.log(`   ✔ Active Critical Sepsis Alerts: ${activeAlerts.length}`);
    const alertFound = activeAlerts.find(a => a.id === evalResult.surveillanceId);
    if (!alertFound) {
      throw new Error('Created sepsis surveillance event not found in active alerts');
    }
    console.log(`   ✔ Verified Alert for Patient: ${alertFound.patient_name}, NEWS2: ${alertFound.news2_score}`);

    // 5. Patient Surveillance History
    console.log('\n5. Fetching Patient Longitudinal Deterioration History...');
    const history = await sepsisWatchdogService.getPatientSurveillanceHistory(patient.id);
    console.log(`   ✔ Retrieved ${history.length} surveillance event(s) for patient`);

    // 6. Resolve Alert Post-Stabilization
    console.log('\n6. Resolving Sepsis Alert Post-ICU Transfer & Stabilization...');
    const resolved = await sepsisWatchdogService.resolveAlert(evalResult.surveillanceId, 'Transferred to Medical ICU Bed 04. Vitals stabilized.');
    console.log(`   ✔ Surveillance Status: ${resolved.status}`);

    if (resolved.status !== 'resolved') {
      throw new Error(`Expected status 'resolved', got ${resolved.status}`);
    }

    console.log('\n====================================================');
    console.log('  Phase 36 Test Passed: 100% SUCCESS               ');
    console.log('====================================================');
  } catch (err) {
    console.error('\n❌ Phase 36 Test Failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runSepsisWatchdogTest();
