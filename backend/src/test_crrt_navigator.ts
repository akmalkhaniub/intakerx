import {
  evaluateKdigoStage,
  calculateCrrtPrescription,
  evaluateFilterPressures,
  evaluateRcaCitrateProtocol,
  createCrrtSession,
  recordHourlyTelemetry,
  getCrrtSessionDetails,
  listActiveCrrtSessions
} from './services/crrtNavigator';
import { pool } from './db';

async function runTests() {
  console.log('🧪 Starting CRRT & Acute Nephrology Navigator Test Suite (Phase 59)...\n');

  try {
    // 1. KDIGO AKI Staging Tests
    console.log('--- Test 1: KDIGO AKI Staging Calculator ---');
    const stage3Case = evaluateKdigoStage({
      baselineCreatinineMgPerDl: 1.1,
      currentCreatinineMgPerDl: 3.5, // > 3.0x baseline
      urineOutputMlPerKgPerHour: 0.2,
      urineOutputDurationHours: 26
    });
    console.log(`✓ KDIGO Stage 3: Stage=${stage3Case.stage} (${stage3Case.stageName}), Criteria=${stage3Case.criteriaTriggered[0]}`);
    if (stage3Case.stage !== 3) throw new Error('Expected KDIGO Stage 3');

    const stage2Case = evaluateKdigoStage({
      baselineCreatinineMgPerDl: 1.0,
      currentCreatinineMgPerDl: 2.2, // 2.2x baseline
      urineOutputMlPerKgPerHour: 0.4,
      urineOutputDurationHours: 14
    });
    console.log(`✓ KDIGO Stage 2: Stage=${stage2Case.stage} (${stage2Case.stageName})`);
    if (stage2Case.stage !== 2) throw new Error('Expected KDIGO Stage 2');

    const stage1Case = evaluateKdigoStage({
      baselineCreatinineMgPerDl: 0.9,
      currentCreatinineMgPerDl: 1.3,
      creatinineRise48hMgPerDl: 0.4
    });
    console.log(`✓ KDIGO Stage 1: Stage=${stage1Case.stage} (${stage1Case.stageName})`);
    if (stage1Case.stage !== 1) throw new Error('Expected KDIGO Stage 1');

    // 2. CRRT Prescription & Effluent Dose Calculation
    console.log('\n--- Test 2: CRRT Prescription & Effluent Dose Calculator ---');
    const prescription = calculateCrrtPrescription({
      modality: 'CVVHDF',
      patientWeightKg: 80,
      targetDeliveredDoseMlKgHr: 22,
      anticipatedDowntimePercent: 15,
      netUltrafiltrationRateMlHr: 150,
      replacementPredilutionPercent: 50
    });
    console.log(`✓ CVVHDF Prescription (80 kg): Prescribed Dose=${prescription.prescribedEffluentDoseMlKgHr} mL/kg/h, Total Effluent=${prescription.totalEffluentRateMlHr} mL/hr`);
    console.log(`  Dialysate=${prescription.dialysateFlowRateMlHr} mL/hr, Replacement=${prescription.replacementFluidRateMlHr} mL/hr (Pre=${prescription.predilutionReplacementRateMlHr}, Post=${prescription.postdilutionReplacementRateMlHr})`);
    console.log(`  Filtration Fraction=${prescription.filtrationFractionPercent}%`);
    if (prescription.prescribedEffluentDoseMlKgHr < 25 || prescription.filtrationFractionPercent <= 0) {
      throw new Error('Prescription calculation mismatch');
    }

    // 3. Filter Clotting & Transmembrane Pressure (TMP) Watchdog
    console.log('\n--- Test 3: TMP & Filter Clotting Watchdog ---');
    const optimalFilter = evaluateFilterPressures({
      filterInflowPressureMmhg: 160,
      venousReturnPressureMmhg: 100,
      effluentPressureMmhg: -20
    });
    // TMP = (160 + 100)/2 - (-20) = 130 - (-20) = 150 mmHg
    // DeltaP = 160 - 100 = 60 mmHg
    console.log(`✓ Optimal Filter: TMP=${optimalFilter.transmembranePressureMmhg} mmHg, Delta-P=${optimalFilter.pressureDropMmhg} mmHg, ClottingRisk=${optimalFilter.clottingRisk}`);
    if (optimalFilter.clottingRisk !== 'optimal') throw new Error('Expected optimal filter risk');

    const clottingFilter = evaluateFilterPressures({
      filterInflowPressureMmhg: 340,
      venousReturnPressureMmhg: 110,
      effluentPressureMmhg: -80
    });
    // TMP = (340 + 110)/2 - (-80) = 225 + 80 = 305 mmHg
    // DeltaP = 340 - 110 = 230 mmHg
    console.log(`✓ Critical Clotting Filter: TMP=${clottingFilter.transmembranePressureMmhg} mmHg, Delta-P=${clottingFilter.pressureDropMmhg} mmHg, Risk=${clottingFilter.clottingRisk}`);
    if (clottingFilter.clottingRisk !== 'critical_clot_immediate_change') {
      throw new Error('Expected critical clot immediate change risk');
    }

    // 4. Regional Citrate Anticoagulation (RCA) & Citrate Toxicity Sentinel
    console.log('\n--- Test 4: Regional Citrate Anticoagulation (RCA) Protocol ---');
    const normalRca = evaluateRcaCitrateProtocol({
      postFilterIonizedCaMmolL: 0.30,
      systemicIonizedCaMmolL: 1.18,
      totalSerumCalciumMgPerDl: 9.0
    });
    // Total Ca mmol = 9.0 * 0.25 = 2.25 mmol/L
    // Ratio = 2.25 / 1.18 = 1.91 (normal < 2.5)
    console.log(`✓ Normal RCA: CircuitStatus='${normalRca.circuitAnticoagulationStatus}', Ratio=${normalRca.totalToIonizedCaRatio}, CitrateToxicity=${normalRca.citrateToxicityDetected}`);
    if (normalRca.citrateToxicityDetected || normalRca.circuitAnticoagulationStatus !== 'Target Therapeutic') {
      throw new Error('Normal RCA incorrectly flagged');
    }

    const toxicCitrate = evaluateRcaCitrateProtocol({
      postFilterIonizedCaMmolL: 0.28,
      systemicIonizedCaMmolL: 0.85, // Severe systemic hypocalcemia
      totalSerumCalciumMgPerDl: 10.5, // Total Ca = 2.625 mmol/L -> Ratio = 2.625 / 0.85 = 3.09 (> 2.5)
      arterialPh: 7.18
    });
    console.log(`✓ Citrate Toxicity Sentinel: Ratio=${toxicCitrate.totalToIonizedCaRatio}, CitrateToxicity=${toxicCitrate.citrateToxicityDetected}`);
    console.log(`  Emergency Action: ${toxicCitrate.emergencyActions[0]}`);
    if (!toxicCitrate.citrateToxicityDetected) {
      throw new Error('Failed to detect pathognomonic citrate lock / toxicity');
    }

    // 5. Database Persistence & Query Helpers
    console.log('\n--- Test 5: Database Persistence & Queries ---');
    let patientId = 1;
    const patRes = await pool.query(`SELECT id FROM patients LIMIT 1`);
    if (patRes.rows.length > 0) {
      patientId = patRes.rows[0].id;
    } else {
      const newPat = await pool.query(
        `INSERT INTO patients (first_name, last_name, date_of_birth, gender) VALUES ('Crrt', 'Patient', '1982-11-20', 'Male') RETURNING id`
      );
      patientId = newPat.rows[0].id;
    }

    const session = await createCrrtSession({
      patientId,
      kdigoStage: 3,
      modality: 'CVVHDF',
      prescribedEffluentDoseMlKgHr: 25.8,
      patientWeightKg: 80,
      bloodFlowRateMlMin: 200,
      dialysateFlowRateMlHr: 950,
      replacementFluidFlowRateMlHr: 964,
      replacementPredilutionPercent: 50,
      netUltrafiltrationTargetMlHr: 150,
      anticoagulationType: 'Regional_Citrate',
      filterType: 'AN69ST_1.5m2'
    });
    console.log(`✓ Created CRRT Session: ID=${session.id}, Modality=${session.modality}, Status=${session.session_status}`);

    const telemetry1 = await recordHourlyTelemetry({
      sessionId: session.id,
      hourNumber: 1,
      transmembranePressureMmhg: 145,
      filterPressureDropMmhg: 65,
      postFilterIonizedCaMmolL: 0.31,
      systemicIonizedCaMmolL: 1.20,
      totalSerumCaMgDl: 9.1,
      totalToIonizedCaRatio: 1.90,
      citrateToxicityAlert: false,
      filterClottingRisk: 'optimal'
    });
    console.log(`✓ Recorded Hourly Telemetry: ID=${telemetry1.id}, Hour=${telemetry1.hour_number}, TMP=${telemetry1.transmembrane_pressure_mmhg} mmHg`);

    const sessionDetails = await getCrrtSessionDetails(session.id);
    console.log(`✓ Retrieved Session Details: Found ${sessionDetails.hourlyTelemetry.length} hourly telemetry record(s)`);
    if (!sessionDetails || sessionDetails.hourlyTelemetry.length === 0) {
      throw new Error('Failed to retrieve session details with telemetry');
    }

    const activeSessions = await listActiveCrrtSessions(5);
    console.log(`✓ Listed Active Sessions: Found ${activeSessions.length} active session(s)`);
    if (activeSessions.length === 0) throw new Error('Active sessions list is empty');

    console.log('\n🎉 ALL CRRT & ACUTE NEPHROLOGY TESTS PASSED (100%)! 🎉\n');
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
