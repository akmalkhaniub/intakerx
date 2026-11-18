import { VentilatorDigitalTwinService } from './services/ventilatorDigitalTwin';
import { ElectrolyteOsmolalityService } from './services/electrolyteOsmolality';
import { ArrhythmiaEpService } from './services/arrhythmiaEpEngine';
import { ScarceResourceEthicsService } from './services/scarceResourceEthics';
import { FederatedPrivacyAuditService } from './services/federatedPrivacyAudit';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runSuite9Tests() {
  console.log('=== RUNNING SUITE 9: DIGITAL TWIN, EP, ACID-BASE, CSC ETHICS & AI GOVERNANCE (PHASES 116–120) TESTS ===\n');

  try {
    // -------------------------------------------------------------------------
    // Phase 116: DIGITAL-TWIN-VENT
    // -------------------------------------------------------------------------
    console.log('[Phase 116: DIGITAL-TWIN-VENT (Mechanical Power & Driving Pressure Twin)]');

    const optimalVent = VentilatorDigitalTwinService.evaluateVentTwin({
      patientId: 1,
      sex: 'M',
      heightCm: 175,
      tidalVolumeMl: 420,
      respiratoryRate: 18,
      setPeepCmH2O: 10,
      autoPeepCmH2O: 0,
      plateauPressureCmH2O: 22,
      peakPressureCmH2O: 26,
      fio2: 0.4,
      pao2Mmhg: 95,
      arterialPh: 7.36
    });
    assert(optimalVent.drivingPressureCmH2O === 12, `Driving pressure < 15 (actual: ${optimalVent.drivingPressureCmH2O})`);
    assert(optimalVent.ventSafetyTier === 'LUNG_PROTECTIVE_OPTIMAL', 'Optimal ARDSNet mechanics classified safe');
    assert(optimalVent.pronePositioningIndicated === false, 'Prone not indicated for P/F > 150');

    const severeArds = await VentilatorDigitalTwinService.recordVentTwin({
      patientId: 1,
      sex: 'F',
      heightCm: 162,
      tidalVolumeMl: 450,
      respiratoryRate: 28,
      setPeepCmH2O: 14,
      autoPeepCmH2O: 2,
      plateauPressureCmH2O: 34,
      peakPressureCmH2O: 42,
      fio2: 0.9,
      pao2Mmhg: 70,
      arterialPh: 7.18
    });
    assert(severeArds.drivingPressureCmH2O === 18, `Driving pressure >= 15 flagged (actual: ${severeArds.drivingPressureCmH2O})`);
    assert(severeArds.mechanicalPowerJMin > 17.0, `Mechanical power > 17 J/min flagged (actual: ${severeArds.mechanicalPowerJMin})`);
    assert(severeArds.ventSafetyTier === 'CRITICAL_VILI_INJURY_RISK', 'Classified as CRITICAL_VILI_INJURY_RISK');
    assert(severeArds.pronePositioningIndicated === true, 'PROSEVA prone positioning indicated (P/F < 150)');
    assert(severeArds.ecmoEvaluationIndicated === true, 'EOLIA VV-ECMO evaluation triggered');
    assert(severeArds.id !== undefined && severeArds.id > 0, `Vent digital twin persisted with ID ${severeArds.id}`);

    // -------------------------------------------------------------------------
    // Phase 117: ELECTROLYTE-OSMOLALITY
    // -------------------------------------------------------------------------
    console.log('\n[Phase 117: ELECTROLYTE-OSMOLALITY (ODS Guard, Osmolar Gap & Winter Formula)]');

    const odsAndToxicAlcohol = await ElectrolyteOsmolalityService.recordEvaluation({
      patientId: 1,
      weightKg: 70,
      sex: 'M',
      measuredSodiumMeqL: 126,
      previousSodium24hAgoMeqL: 114, // +12 mEq/L in 24h -> ODS hazard!
      potassiumMeqL: 2.8,
      chlorideMeqL: 92,
      bicarbonateMeqL: 12,
      albuminGDl: 2.0, // AG_corr = (126 - 104) + 2.5*(4-2) = 22 + 5 = 27!
      glucoseMgDl: 110,
      bunMgDl: 14,
      measuredOsmolalityMOsmKg: 315, // Calc ~ 2*126 + 110/18 + 14/2.8 = 252 + 6.1 + 5 = 263.1 -> OsmGap ~ 51.9
      arterialPh: 7.18,
      paco2Mmhg: 38, // Winter's: 1.5*12 + 8 = 26 +/- 2 -> 38 > 28 => Concurrent Resp Acidosis!
      highOdsRiskFactors: true
    });
    assert(odsAndToxicAlcohol.odsOvercorrectionRisk === true, 'Detects ODS overcorrection hazard (+12 > 6 mEq/L ceiling)');
    assert(odsAndToxicAlcohol.osmolarGap > 10, `Detects elevated Osmolar Gap (actual: ${odsAndToxicAlcohol.osmolarGap})`);
    assert(odsAndToxicAlcohol.correctedAnionGap === 27, `Albumin-corrected Anion Gap is 27 (actual: ${odsAndToxicAlcohol.correctedAnionGap})`);
    assert(odsAndToxicAlcohol.acidBaseDiagnosis.includes('HAGMA'), 'Diagnoses High Anion Gap Metabolic Acidosis');
    assert(odsAndToxicAlcohol.acidBaseDiagnosis.includes('Concurrent Respiratory Acidosis'), 'Detects inadequate respiratory compensation via Winter formula');
    assert(odsAndToxicAlcohol.id !== undefined && odsAndToxicAlcohol.id > 0, `Electrolyte eval persisted with ID ${odsAndToxicAlcohol.id}`);

    // -------------------------------------------------------------------------
    // Phase 118: CARDIO-ARRHYTHMIA-EP
    // -------------------------------------------------------------------------
    console.log('\n[Phase 118: CARDIO-ARRHYTHMIA-EP (Fridericia QTc, Tisdale & Vaughan-Williams)]');

    const epCrisis = await ArrhythmiaEpService.recordEpEval({
      patientId: 1,
      ageYears: 74,
      sex: 'F',
      heartRate: 52,
      rawQtMs: 500,
      qrsDurationMs: 90,
      serumPotassiumMeqL: 3.1,
      serumMagnesiumMgDl: 1.4,
      onLoopDiuretic: true,
      acuteMiOrSepsis: true,
      heartFailureEfLt40: true,
      structuralCad: true,
      wpwPreExcitation: true,
      activeQtProlongingDrugs: ['Amiodarone', 'Ondansetron']
    });
    assert(epCrisis.qtcFridericiaMs > epCrisis.qtcBazettMs, `Computes Fridericia QTc > Bazett in bradycardia (${epCrisis.qtcFridericiaMs} vs ${epCrisis.qtcBazettMs} ms)`);
    assert(epCrisis.tisdaleRiskTier === 'HIGH', `Tisdale score is HIGH (actual: ${epCrisis.tisdaleRiskScore})`);
    assert(epCrisis.contraindicatedDrugs.includes('Adenosine'), 'Blocks Adenosine in WPW pre-excitation');
    assert(epCrisis.contraindicatedDrugs.includes('Flecainide'), 'Blocks Class Ic Flecainide in structural CAD');
    assert(epCrisis.contraindicatedDrugs.includes('Verapamil'), 'Blocks Verapamil in HFrEF / WPW');
    assert(epCrisis.id !== undefined && epCrisis.id > 0, `EP eval persisted with ID ${epCrisis.id}`);

    // -------------------------------------------------------------------------
    // Phase 119: ETHICS-TRIAGE-ALLOC
    // -------------------------------------------------------------------------
    console.log('\n[Phase 119: ETHICS-TRIAGE-ALLOC (Crisis Standards of Care & Time-Limited Trial)]');

    const cscAlloc = await ScarceResourceEthicsService.recordAllocation({
      patientId: 1,
      scarceResourceType: 'MECHANICAL_VENTILATOR',
      sofaScore: 14, // 4 pts
      comorbidityPrognosis: 'FIVE_YEAR_LIFE_LIMITING', // 2 pts
      isEssentialResponder: false,
      crisisSurgeLevel: 3, // TLT = 48h
      hoursOnTrialAlready: 52,
      sofaDeltaSinceAdmission: 3
    });
    assert(cscAlloc.allocationPriorityScore === 6, `Allocation priority score is 6 (actual: ${cscAlloc.allocationPriorityScore})`);
    assert(cscAlloc.priorityTier === 'LOW_PRIORITY_YELLOW', 'Classified as LOW_PRIORITY_YELLOW');
    assert(cscAlloc.reallocationReviewTriggered === true, 'Expired TLT (52h >= 48h) with worsening SOFA triggers Ethics Committee review');
    assert(cscAlloc.palliativeSymptomBundle.dyspneaPain.includes('Morphine'), 'Provides non-abandonment Palliative Symptom Bundle');
    assert(cscAlloc.id !== undefined && cscAlloc.id > 0, `CSC allocation persisted with ID ${cscAlloc.id}`);

    // -------------------------------------------------------------------------
    // Phase 120: FEDERATED-PRIVACY-AUDIT
    // -------------------------------------------------------------------------
    console.log('\n[Phase 120: FEDERATED-PRIVACY-AUDIT (HIPAA Safe Harbor, DP Epsilon & PSI Drift)]');

    const privacyAudit = await FederatedPrivacyAuditService.recordAudit({
      modelId: 'SEPSIS-SUBPHENOTYPE-V4',
      clinicalTextPayload: 'Patient MRN-99887766 SSN 123-45-6789 DOB 1932-05-14 email john.doe@hospital.org IP 192.168.1.44',
      patientAge: 94,
      aggregateMetricValue: 0.84,
      sensitivityDeltaF: 0.05,
      epsilonRequested: 0.5,
      previousEpsilonSpent: 2.0,
      maxEpsilonBudget: 5.0,
      expectedBinDist: [0.5, 0.3, 0.2],
      actualBinDist: [0.15, 0.35, 0.5] // Major distribution shift -> PSI >= 0.25
    });
    assert(privacyAudit.phiLeakCount === 5, `Detected and redacted 5 PHI identifiers (actual: ${privacyAudit.phiLeakCount})`);
    assert(!privacyAudit.redactedPayload.includes('123-45-6789'), 'SSN scrubbed from payload');
    assert(privacyAudit.ageGeneralized.includes('90+'), 'Age > 89 generalized per HIPAA Safe Harbor');
    assert(privacyAudit.privacyBudgetExhausted === false, 'Epsilon budget within limit (2.5 / 5.0)');
    assert(privacyAudit.psiDriftScore >= 0.25, `PSI drift >= 0.25 detected (actual: ${privacyAudit.psiDriftScore})`);
    assert(privacyAudit.governanceStatus === 'DRIFT_SHADOW_FALLBACK', 'Triggers DRIFT_SHADOW_FALLBACK');
    assert(privacyAudit.id !== undefined && privacyAudit.id > 0, `Privacy audit persisted with ID ${privacyAudit.id}`);

    const budgetExhausted = FederatedPrivacyAuditService.runAudit({
      modelId: 'SEPSIS-SUBPHENOTYPE-V4',
      clinicalTextPayload: 'Clean aggregated note',
      aggregateMetricValue: 0.84,
      sensitivityDeltaF: 0.05,
      epsilonRequested: 1.0,
      previousEpsilonSpent: 4.5,
      maxEpsilonBudget: 5.0,
      expectedBinDist: [0.5, 0.3, 0.2],
      actualBinDist: [0.5, 0.3, 0.2]
    });
    assert(budgetExhausted.privacyBudgetExhausted === true, 'Blocks query when epsilon budget exhausted');
    assert(budgetExhausted.dpNoisedMetricValue === null, 'Withholds metric output when budget exhausted');

    console.log('\n=============================================================');
    console.log(`SUITE 9 (PHASES 116–120) TESTS COMPLETE: ${passed} passed, ${failed} failed.`);
    console.log('=============================================================\n');
  } catch (error) {
    console.error('Fatal test error in Suite 9:', error);
    process.exit(1);
  } finally {
    const { pool } = require('./db');
    await pool.end();
    if (failed > 0) process.exit(1);
    process.exit(0);
  }
}

runSuite9Tests();
