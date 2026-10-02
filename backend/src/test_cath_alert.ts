import { query, pool } from './db';
import { CathAlertService } from './services/cathAlert';

async function runCathAlertTest() {
  console.log('--- STARTING CARDIAC CATH LAB & STEMI FLEET TEST (PHASE 53) ---');

  try {
    // 1. Create dummy patient
    const testEmail = `cath.patient.${Date.now()}@cardiaccenter.org`;
    const patientRes = await query(
      `INSERT INTO patients (name, email, password_hash, dob, sex)
       VALUES ($1, $2, 'hash123', '1952-11-09', 'male')
       RETURNING id, name`,
      ['Dominic Rossi', testEmail]
    );
    const patientId = patientRes.rows[0].id;
    console.log(`✔ Created dummy cardiac patient #${patientId} (${patientRes.rows[0].name})`);

    // 2. Test ECG Recognition: Smith-Modified Sgarbossa for LBBB
    const sgarbossaEval = CathAlertService.evaluateEkgPattern({
      patternType: 'Smith_Sgarbossa_LBBB',
      sgarbossaConcordantSte: false,
      sgarbossaConcordantStdV1V3: false,
      smithExcessiveDiscordanceRatio: -0.28 // <= -0.25 threshold
    });
    console.log(`✔ Smith-Sgarbossa LBBB Evaluated: OMI Equivalent = ${sgarbossaEval.isOmiEquivalent} | Culprit: ${sgarbossaEval.culpritVessel}`);
    console.log(`   Rationale: ${sgarbossaEval.rationale}`);
    if (!sgarbossaEval.isOmiEquivalent || sgarbossaEval.culpritVessel !== 'LAD') {
      throw new Error(`Expected LAD OMI Equivalent for Smith-Sgarbossa, got ${JSON.stringify(sgarbossaEval)}`);
    }

    // 3. Test Wellens Syndrome Type B
    const wellensEval = CathAlertService.evaluateEkgPattern({
      patternType: 'Wellens_Type_B'
    });
    console.log(`✔ Wellens Syndrome Type B Evaluated: Urgency = ${wellensEval.urgencyLevel} | Culprit: ${wellensEval.culpritVessel}`);
    if (!wellensEval.isOmiEquivalent || wellensEval.culpritVessel !== 'LAD') {
      throw new Error(`Expected LAD OMI for Wellens Type B, got ${JSON.stringify(wellensEval)}`);
    }

    // 4. Test Mehran 2.0 Contrast-Induced Nephropathy (CIN) Risk
    const cinEval = CathAlertService.calculateMehranCinRisk({
      age: 78, // 4 pts
      diabetes: true, // 3 pts
      congestiveHeartFailure: true, // 5 pts
      hypotensionOrShock: false,
      baselineEgfr: 35, // 4 pts
      contrastVolumeMl: 220, // 2 pts
      patientWeightKg: 82
    });
    console.log(`✔ Mehran 2.0 CIN Risk Evaluated: Score = ${cinEval.riskScore} (${cinEval.riskTier}) | AKI Risk: ${cinEval.postPciAkiRiskPercent}%`);
    console.log(`   Hydration Target: ${cinEval.hydrationTargetMlPerHr} mL/hr | ${cinEval.hydrationGuideline}`);
    if (cinEval.riskScore !== 18 || cinEval.riskTier !== 'Very_High') {
      throw new Error(`Expected CIN score 18 and Very_High tier, got ${JSON.stringify(cinEval)}`);
    }

    // 5. Activate STEMI Code in Database
    const now = new Date();
    const edArrival = new Date(now.getTime() - 55 * 60 * 1000); // 55 mins ago
    const cathActivationTime = new Date(now.getTime() - 48 * 60 * 1000); // 48 mins ago

    const stemiCase = await CathAlertService.activateStemiCode(patientId, {
      ekgPattern: {
        patternType: 'Classic_STEMI',
        leadsWithElevation: ['V1', 'V2', 'V3', 'V4']
      },
      edArrivalTime: edArrival,
      cathLabActivationTime: cathActivationTime,
      vascularAccessSite: 'Right_Radial'
    });
    const activationId = stemiCase.activation.id;
    console.log(`✔ Activated STEMI Code #${activationId} (Presumed Culprit: ${stemiCase.activation.culprit_vessel_presumed})`);

    // 6. Log Balloon Inflation & Verify Door-to-Balloon (D2B)
    const balloonTime = new Date(edArrival.getTime() + 52 * 60 * 1000); // 52 minutes D2B
    const d2bResult = await CathAlertService.logBalloonInflation(activationId, balloonTime);
    console.log(`✔ Balloon Inflation Logged: D2B = ${d2bResult.d2bMetrics.d2bMinutes} mins (Target Met: ${d2bResult.d2bMetrics.targetMet}, Tier: ${d2bResult.d2bMetrics.speedClassification})`);
    if (d2bResult.d2bMetrics.d2bMinutes !== 52 || !d2bResult.d2bMetrics.targetMet) {
      throw new Error(`Expected D2B 52 min with targetMet=true, got ${d2bResult.d2bMetrics.d2bMinutes}`);
    }

    // 7. Record PCI Procedure Details
    const pciLog = await CathAlertService.recordPciProcedure(activationId, {
      lesionLocation: 'Proximal_LAD_99%_Thrombus',
      prePciTimiFlow: 0,
      postPciTimiFlow: 3,
      stentType: 'DES_Everolimus_Eluting_Xience',
      stentDiameterMm: 3.50,
      stentLengthMm: 28.0,
      anticoagulantAgent: 'Unfractionated_Heparin',
      peakActSeconds: 285
    });
    console.log(`✔ PCI Procedure Logged: #${pciLog.id} (${pciLog.lesion_location}) -> TIMI flow restored 0 -> 3 (ACT: ${pciLog.peak_act_seconds}s)`);

    // 8. Update CIN Risk & Hydration in Database
    const cinRecord = await CathAlertService.updateCinRisk(activationId, {
      age: 78,
      diabetes: true,
      congestiveHeartFailure: true,
      hypotensionOrShock: false,
      baselineEgfr: 35,
      contrastVolumeMl: 220,
      patientWeightKg: 82
    });
    console.log(`✔ Recorded CIN Nephropathy Risk #${cinRecord.updatedActivation.mehran_cin_risk_score} in DB`);

    // 9. Update Arteriotomy Closure & Strict Bed Rest
    const closureRecord = await CathAlertService.updateClosureAndBedRest(activationId, {
      closureDeviceUsed: 'Angio-Seal_8F',
      closureTime: new Date()
    });
    console.log(`✔ Arteriotomy Closure Updated: Device = ${closureRecord.closure_device_used} | Bed Rest = ${closureRecord.bed_rest_duration_hours} hours`);

    // 10. Query All Activations
    const allStemi = await CathAlertService.getStemiActivations(patientId);
    console.log(`✔ Verified query: retrieved ${allStemi.length} STEMI case(s) for patient #${patientId}`);

    console.log('--- ALL PHASE 53 CATH LAB & STEMI FLEET INTEGRATION TESTS PASSED (100% SUCCESS) ---');
  } catch (err) {
    console.error('❌ Phase 53 Integration Test Failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runCathAlertTest();
