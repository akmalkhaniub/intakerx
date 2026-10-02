import { query, pool } from './db';
import { EcmoSupportService } from './services/ecmoSupport';

async function runEcmoSupportTest() {
  console.log('--- STARTING ECMO & MCS SUPPORT FLEET TEST (PHASE 54) ---');

  try {
    // 1. Create dummy patient
    const testEmail = `ecmo.patient.${Date.now()}@criticalcare.org`;
    const patientRes = await query(
      `INSERT INTO patients (name, email, password_hash, dob, sex)
       VALUES ($1, $2, 'hash123', '1968-04-14', 'male')
       RETURNING id, name`,
      ['Arthur Pendelton', testEmail]
    );
    const patientId = patientRes.rows[0].id;
    console.log(`✔ Created dummy ECMO patient #${patientId} (${patientRes.rows[0].name})`);

    // 2. Test RESP Score Calculation for VV-ECMO (Severe ARDS)
    const respResult = EcmoSupportService.calculateRespScore({
      age: 48, // <50 -> 0
      immunocompromised: false, // 0
      hoursVentilatedPriorToEcmo: 36, // <48 -> +3
      diagnosis: 'viral_pneumonia', // +3
      cnsDysfunction: false, // 0
      nonPulmonaryInfection: false, // 0
      bicarbonateMeqL: 22, // >=15 -> 0
      pipCmH2o: 38, // <42 -> 0
      pao2Fio2Ratio: 65 // <80 -> -1
    });
    // Expected score: 0 + 0 + 3 + 3 + 0 + 0 + 0 + 0 - 1 = 5 (Class II, 76%)
    console.log(`✔ RESP Score Calculated: Score = ${respResult.score} (${respResult.riskClass}) | Predicted Survival: ${respResult.predictedSurvivalPercent}%`);
    console.log(`   Interpretation: ${respResult.interpretation}`);
    if (respResult.score !== 5 || respResult.riskClass !== 'Class_II') {
      throw new Error(`Expected RESP score 5 and Class_II, got ${JSON.stringify(respResult)}`);
    }

    // 3. Test SAVE Score Calculation for VA-ECMO (Refractory Cardiogenic Shock)
    const saveResult = EcmoSupportService.calculateSaveScore({
      etiology: 'myocarditis', // +3
      age: 34, // <39 -> 0
      weightKg: 75, // 65-90 -> 0
      acuteRenalFailure: false, // 0
      liverFailure: false, // 0
      cnsDysfunction: false, // 0
      pulsePressureMmHg: 28, // >20 -> 0
      bicarbonateMeqL: 18 // >=15 -> 0
    });
    // Expected score: +3 -> Class II (58%)
    console.log(`✔ SAVE Score Calculated: Score = ${saveResult.score} (${saveResult.riskClass}) | Predicted Survival: ${saveResult.predictedSurvivalPercent}%`);
    console.log(`   Interpretation: ${saveResult.interpretation}`);
    if (saveResult.score !== 3 || saveResult.riskClass !== 'Class_II') {
      throw new Error(`Expected SAVE score 3 and Class_II, got ${JSON.stringify(saveResult)}`);
    }

    // 4. Test Circuit Telemetry Evaluation (Watchdog logic)
    const criticalTelemetry = EcmoSupportService.evaluateCircuitTelemetry({
      preMembranePressureMmHg: 260,
      postMembranePressureMmHg: 195, // ΔP = 65 mmHg (>= 55 -> critical_failure)
      venousDrainagePressureMmHg: -95, // <= -90 -> chatter alert
      plasmaFreeHemoglobinMgDl: 58.4, // >= 50 -> severe_pump_head_shear
      antiXaIuMl: 0.18, // < 0.25 -> subtherapeutic
      apttSeconds: 48
    });
    console.log(`✔ Circuit Telemetry Evaluated: ΔP = ${criticalTelemetry.transmembraneDeltaP} mmHg | Clot: ${criticalTelemetry.membraneClotRisk} | Chatter: ${criticalTelemetry.chatterDetected} | Hemolysis: ${criticalTelemetry.hemolysisSeverity}`);
    console.log(`   Alerts triggered: ${criticalTelemetry.alerts.length}`);
    if (criticalTelemetry.membraneClotRisk !== 'critical_failure' || !criticalTelemetry.chatterDetected || criticalTelemetry.hemolysisSeverity !== 'severe_pump_head_shear') {
      throw new Error(`Expected critical clot risk, chatter, and severe hemolysis, got ${JSON.stringify(criticalTelemetry)}`);
    }

    // 5. Initiate Active ECMO Run in Database
    const newRun = await EcmoSupportService.initiateEcmoRun(patientId, {
      ecmoType: 'VA_ECMO',
      cannulationConfig: 'Femoral-Femoral (25Fr Drainage / 17Fr Return)',
      cannulaSizeDrainageFr: 25,
      cannulaSizeReturnFr: 17,
      distalPerfusionCannulaPlaced: true,
      indicationDiagnosis: 'Fulminant Myocarditis with Biventricular Failure',
      baselinePfRatio: 65,
      saveScore: saveResult.score,
      survivalRiskClass: saveResult.riskClass,
      pumpRpm: 3800,
      bloodFlowLpm: 4.2,
      sweepGasLpm: 3.5,
      sweepFio2Percent: 100
    });
    const runId = newRun.id;
    console.log(`✔ Initiated ECMO Run #${runId} (${newRun.ecmo_type}) | Flow: ${newRun.blood_flow_lpm} L/min @ ${newRun.pump_rpm} RPM`);

    // 6. Record Circuit Telemetry in Database
    const loggedTelemetry = await EcmoSupportService.recordCircuitTelemetry(runId, {
      preMembranePressureMmHg: 210,
      postMembranePressureMmHg: 175, // ΔP = 35 mmHg (Normal <40)
      venousDrainagePressureMmHg: -45, // Safe > -90
      plasmaFreeHemoglobinMgDl: 12.0, // Normal <25
      antiXaIuMl: 0.38, // Therapeutic 0.30 - 0.50
      apttSeconds: 68
    });
    console.log(`✔ Recorded Telemetry #${loggedTelemetry.telemetry.id}: ΔP = ${loggedTelemetry.telemetry.transmembrane_delta_p_mmhg} mmHg (Clot alert: ${loggedTelemetry.telemetry.membrane_clot_alert}, Chatter: ${loggedTelemetry.telemetry.chatter_detected})`);

    // 7. Adjust Sweep Gas and RPM
    const adjusted = await EcmoSupportService.adjustSweepAndRpm(runId, {
      pumpRpm: 4000,
      bloodFlowLpm: 4.5,
      sweepGasLpm: 4.0
    });
    console.log(`✔ Adjusted ECMO Parameters: RPM = ${adjusted.pump_rpm}, Blood Flow = ${adjusted.blood_flow_lpm} L/min, Sweep = ${adjusted.sweep_gas_lpm} L/min`);

    // 8. Decannulate Circuit
    const decannulated = await EcmoSupportService.decannulateCircuit(runId, 'weaned_recovered');
    console.log(`✔ Decannulated ECMO Run #${decannulated.id}: Status = ${decannulated.circuit_status} at ${decannulated.decannulated_at}`);

    // 9. Query Patient ECMO Runs
    const runsList = await EcmoSupportService.getEcmoRuns(patientId);
    console.log(`✔ Fetched ${runsList.length} ECMO run(s) for patient #${patientId}`);

    console.log('\n--- ALL ECMO & MCS HUB TESTS PASSED SUCCESSFULLY (PHASE 54) ---');
  } catch (error) {
    console.error('❌ ECMO Support Test Failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runEcmoSupportTest();
