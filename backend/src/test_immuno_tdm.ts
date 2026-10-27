import {
  evaluateCniTdm,
  evaluateCyp3aInteractions,
  differentiateCniToxicityVsRejection,
  saveTdmRecord,
  getPatientTdmHistory,
  logNephrotoxicityEvaluation,
  getPatientNephrotoxicityLogs
} from './services/immunoTdm';
import { pool } from './db';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('\n=== RUNNING IMMUNO-TDM TEST SUITE (PHASE 86) ===\n');

  try {
    // ----------------------------------------------------
    // TEST SUITE 1: TACROLIMUS TDM TARGET EVALUATION
    // ----------------------------------------------------
    console.log('--- 1. Tacrolimus TDM Target Evaluation ---');

    // Months 0-3: Target 8 - 12 ng/mL
    const tacEarlyTherapeutic = evaluateCniTdm({
      transplantId: 1,
      patientId: 1,
      drugName: 'TACROLIMUS',
      levelType: 'C0_TROUGH',
      measuredLevel: 10.2,
      postOpMonths: 1.5,
      currentDoseMgPerDay: 4
    });
    assert(tacEarlyTherapeutic.status === 'THERAPEUTIC', 'Tacrolimus 10.2 ng/mL at 1.5 mo is THERAPEUTIC');
    assert(tacEarlyTherapeutic.targetRangeLow === 8.0 && tacEarlyTherapeutic.targetRangeHigh === 12.0, 'Target is 8.0 - 12.0 ng/mL');
    assert(tacEarlyTherapeutic.doseAdjustmentPct === 0, 'No dose adjustment for therapeutic level');

    const tacEarlySubtherapeutic = evaluateCniTdm({
      transplantId: 1,
      patientId: 1,
      drugName: 'TACROLIMUS',
      levelType: 'C0_TROUGH',
      measuredLevel: 5.0,
      postOpMonths: 2.0,
      currentDoseMgPerDay: 4
    });
    assert(tacEarlySubtherapeutic.status === 'SUBTHERAPEUTIC', 'Tacrolimus 5.0 ng/mL at 2.0 mo is SUBTHERAPEUTIC');
    assert(tacEarlySubtherapeutic.doseAdjustmentPct > 0, 'Dose adjustment is positive (increase dose)');
    assert(tacEarlySubtherapeutic.clinicalActionChecklist.some(c => c.includes('acute cellular or antibody-mediated rejection')), 'Flags rejection risk');

    const tacEarlySupratherapeutic = evaluateCniTdm({
      transplantId: 1,
      patientId: 1,
      drugName: 'TACROLIMUS',
      levelType: 'C0_TROUGH',
      measuredLevel: 13.5,
      postOpMonths: 1.0,
      currentDoseMgPerDay: 6
    });
    assert(tacEarlySupratherapeutic.status === 'SUPRATHERAPEUTIC', 'Tacrolimus 13.5 ng/mL at 1.0 mo is SUPRATHERAPEUTIC');
    assert(tacEarlySupratherapeutic.doseAdjustmentPct < 0, 'Dose adjustment is negative (decrease dose)');

    const tacEarlyCriticalToxic = evaluateCniTdm({
      transplantId: 1,
      patientId: 1,
      drugName: 'TACROLIMUS',
      levelType: 'C0_TROUGH',
      measuredLevel: 18.5,
      postOpMonths: 0.5,
      currentDoseMgPerDay: 8
    });
    assert(tacEarlyCriticalToxic.status === 'CRITICAL_TOXIC', 'Tacrolimus 18.5 ng/mL is CRITICAL_TOXIC');
    assert(tacEarlyCriticalToxic.clinicalActionChecklist.some(c => c.includes('HOLD morning CNI dose')), 'Recommends holding dose immediately');

    // Months 3-12: Target 6 - 10 ng/mL
    const tacMidTherapeutic = evaluateCniTdm({
      transplantId: 1,
      patientId: 1,
      drugName: 'TACROLIMUS',
      levelType: 'C0_TROUGH',
      measuredLevel: 7.5,
      postOpMonths: 6.0
    });
    assert(tacMidTherapeutic.status === 'THERAPEUTIC', 'Tacrolimus 7.5 ng/mL at 6 mo is THERAPEUTIC');
    assert(tacMidTherapeutic.targetRangeLow === 6.0 && tacMidTherapeutic.targetRangeHigh === 10.0, 'Mid-phase target is 6.0 - 10.0 ng/mL');

    // Post-12 Months: Target 5 - 8 ng/mL
    const tacLateTherapeutic = evaluateCniTdm({
      transplantId: 1,
      patientId: 1,
      drugName: 'TACROLIMUS',
      levelType: 'C0_TROUGH',
      measuredLevel: 6.0,
      postOpMonths: 18.0
    });
    assert(tacLateTherapeutic.status === 'THERAPEUTIC', 'Tacrolimus 6.0 ng/mL at 18 mo is THERAPEUTIC');
    assert(tacLateTherapeutic.targetRangeLow === 5.0 && tacLateTherapeutic.targetRangeHigh === 8.0, 'Late target is 5.0 - 8.0 ng/mL');

    // ----------------------------------------------------
    // TEST SUITE 2: CYCLOSPORINE C0 & C2 EVALUATION
    // ----------------------------------------------------
    console.log('\n--- 2. Cyclosporine TDM Evaluation (C0 & C2) ---');

    const csaC0Therapeutic = evaluateCniTdm({
      transplantId: 1,
      patientId: 1,
      drugName: 'CYCLOSPORINE',
      levelType: 'C0_TROUGH',
      measuredLevel: 250,
      postOpMonths: 2.0
    });
    assert(csaC0Therapeutic.status === 'THERAPEUTIC', 'Cyclosporine C0 250 ng/mL at 2 mo is THERAPEUTIC (200-300)');

    const csaC2Therapeutic = evaluateCniTdm({
      transplantId: 1,
      patientId: 1,
      drugName: 'CYCLOSPORINE',
      levelType: 'C2_PEAK',
      measuredLevel: 1200,
      postOpMonths: 1.0
    });
    assert(csaC2Therapeutic.status === 'THERAPEUTIC', 'Cyclosporine C2 1200 ng/mL at 1 mo is THERAPEUTIC (1000-1400)');

    const csaC2Toxic = evaluateCniTdm({
      transplantId: 1,
      patientId: 1,
      drugName: 'CYCLOSPORINE',
      levelType: 'C2_PEAK',
      measuredLevel: 2100,
      postOpMonths: 1.0
    });
    assert(csaC2Toxic.status === 'CRITICAL_TOXIC', 'Cyclosporine C2 2100 ng/mL is CRITICAL_TOXIC (>1800)');

    // ----------------------------------------------------
    // TEST SUITE 3: CYP3A4 / P-GP INTERACTION ENGINE
    // ----------------------------------------------------
    console.log('\n--- 3. CYP3A4 / P-gp Drug Interaction Engine ---');

    // Voriconazole (Strong Inhibitor)
    const voriconazoleScreen = evaluateCyp3aInteractions('TACROLIMUS', ['Voriconazole 200mg BID', 'Prednisone 10mg']);
    assert(voriconazoleScreen.overallRiskLevel === 'CRITICAL_INHIBITOR_TOXICITY', 'Voriconazole flagged as CRITICAL_INHIBITOR_TOXICITY');
    assert(voriconazoleScreen.suggestedImmediateCniAdjustmentPct === -66, 'Voriconazole triggers -66% CNI dose reduction');
    assert(voriconazoleScreen.identifiedInteractions.length === 1, 'Correctly matched 1 critical interaction');

    // Rifampin (Strong Inducer)
    const rifampinScreen = evaluateCyp3aInteractions('TACROLIMUS', ['Rifampin 600mg daily', 'Aspirin 81mg']);
    assert(rifampinScreen.overallRiskLevel === 'CRITICAL_INDUCER_REJECTION', 'Rifampin flagged as CRITICAL_INDUCER_REJECTION');
    assert(rifampinScreen.suggestedImmediateCniAdjustmentPct >= 100, 'Rifampin triggers +150% CNI dose increase');

    // Fluconazole & Diltiazem (Moderate Inhibitors)
    const moderateScreen = evaluateCyp3aInteractions('TACROLIMUS', ['Fluconazole 200mg', 'Diltiazem 120mg']);
    assert(moderateScreen.overallRiskLevel === 'MODERATE', 'Fluconazole + Diltiazem flagged as MODERATE');
    assert(moderateScreen.identifiedInteractions.length === 2, 'Found both moderate inhibitors');

    // St. John's Wort
    const herbalScreen = evaluateCyp3aInteractions('CYCLOSPORINE', ['St Johns Wort extract']);
    assert(herbalScreen.overallRiskLevel === 'CRITICAL_INDUCER_REJECTION', "St. John's Wort triggers critical rejection alert");

    // Clean regimen
    const cleanScreen = evaluateCyp3aInteractions('TACROLIMUS', ['Metoprolol succinate 25mg', 'Acetaminophen 500mg']);
    assert(cleanScreen.overallRiskLevel === 'NONE', 'Benign medications report overallRiskLevel NONE');
    assert(cleanScreen.identifiedInteractions.length === 0, 'No interactions detected for clean regimen');

    // ----------------------------------------------------
    // TEST SUITE 4: CNI TOXICITY VS. REJECTION DIFFERENTIATION
    // ----------------------------------------------------
    console.log('\n--- 4. CNI Toxicity vs. Acute Rejection Differential ---');

    // Case 1: Pure CNI Nephrotoxicity
    // Elevated Cr, High trough (16.5), FeNa 0.3%, negative DSA, Tremor present, No fever
    const cniToxicityCase = differentiateCniToxicityVsRejection({
      transplantId: 1,
      patientId: 1,
      baselineCreatinine: 1.1,
      currentCreatinine: 2.2,
      tacrolimusTrough: 16.5,
      postOpMonths: 2,
      fenaPercent: 0.3,
      dsaPositive: false,
      highestMfi: 450,
      hasNeurologicalSymptoms: true,
      hasHypertensionOrHyperkalemia: true,
      hasFeverOrGraftTenderness: false,
      graftDysfunctionSigns: false
    });
    assert(cniToxicityCase.primarySuspect === 'CNI_NEPHROTOXICITY', 'Case 1 correctly diagnosed as CNI_NEPHROTOXICITY');
    assert(cniToxicityCase.cniToxicityProbability === 'HIGH', 'CNI toxicity probability is HIGH');
    assert(cniToxicityCase.rejectionProbability === 'LOW', 'Rejection probability is LOW');
    assert(cniToxicityCase.actionPlan[0].action.includes('Reduce CNI dose'), 'Action plan advises CNI dose reduction');

    // Case 2: Pure Acute Rejection
    // Elevated Cr, Low trough (4.2), FeNa 2.4%, DSA Positive (MFI 7200), Graft tenderness, Fever
    const rejectionCase = differentiateCniToxicityVsRejection({
      transplantId: 1,
      patientId: 1,
      baselineCreatinine: 1.0,
      currentCreatinine: 2.3,
      tacrolimusTrough: 4.2,
      postOpMonths: 4,
      fenaPercent: 2.4,
      dsaPositive: true,
      highestMfi: 7200,
      hasNeurologicalSymptoms: false,
      hasHypertensionOrHyperkalemia: false,
      hasFeverOrGraftTenderness: true,
      graftDysfunctionSigns: true
    });
    assert(rejectionCase.primarySuspect === 'ACUTE_ALLOGRAFT_REJECTION', 'Case 2 correctly diagnosed as ACUTE_ALLOGRAFT_REJECTION');
    assert(rejectionCase.rejectionProbability === 'HIGH', 'Rejection probability is HIGH');
    assert(rejectionCase.cniToxicityProbability === 'LOW', 'CNI toxicity probability is LOW');
    assert(rejectionCase.actionPlan[0].action.includes('allograft biopsy'), 'Action plan advises urgent biopsy and DSA panel');

    // ----------------------------------------------------
    // TEST SUITE 5: DATABASE PERSISTENCE
    // ----------------------------------------------------
    console.log('\n--- 5. Database Persistence & Log Retrieval ---');

    // Ensure a test patient exists or query patient 1
    const pRes = await pool.query('SELECT id FROM patients LIMIT 1');
    let testPatientId = 1;
    if (pRes.rows.length > 0) {
      testPatientId = pRes.rows[0].id;
    }

    // Save TDM Record
    const savedTdm = await saveTdmRecord({
      transplantId: 1,
      patientId: testPatientId,
      ...tacEarlyTherapeutic
    });
    assert(savedTdm && savedTdm.id > 0, `TDM record saved with ID ${savedTdm?.id}`);

    // Retrieve TDM history
    const history = await getPatientTdmHistory(testPatientId);
    assert(history.length > 0, `Retrieved ${history.length} TDM records for patient ${testPatientId}`);

    // Log Nephrotoxicity Evaluation
    const savedNephro = await logNephrotoxicityEvaluation({
      transplantId: 1,
      patientId: testPatientId,
      baselineCreatinine: 1.1,
      currentCreatinine: 2.2,
      tacrolimusTrough: 16.5,
      postOpMonths: 2,
      ...cniToxicityCase
    });
    assert(savedNephro && savedNephro.id > 0, `Nephrotoxicity log saved with ID ${savedNephro?.id}`);

    // Retrieve Nephrotoxicity logs
    const nephroLogs = await getPatientNephrotoxicityLogs(testPatientId);
    assert(nephroLogs.length > 0, `Retrieved ${nephroLogs.length} nephrotoxicity logs for patient ${testPatientId}`);

    console.log(`\n========================================`);
    console.log(`IMMUNO-TDM TEST SUMMARY:`);
    console.log(`  TOTAL PASSED: ${passedTests}`);
    console.log(`  TOTAL FAILED: ${failedTests}`);
    console.log(`========================================\n`);

    if (failedTests > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal error during IMMUNO-TDM test execution:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
