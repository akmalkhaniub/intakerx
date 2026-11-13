import { ClosedLoopTitrationService } from './services/closedLoopTitration';
import { BayesianPkPdService } from './services/bayesianPkPd';
import { SepsisSubphenotypeService } from './services/sepsisSubphenotype';
import { PocusVexusService } from './services/pocusVexus';
import { HandoffHallucinationGuardService } from './services/handoffHallucinationGuard';

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

async function runSuite8Tests() {
  console.log('=== RUNNING SUITE 8: AUTONOMOUS CLOSED-LOOP ICU & PRECISION THERAPEUTICS (PHASES 111–115) TESTS ===\n');

  try {
    // -------------------------------------------------------------------------
    // Phase 111: CLOSED-LOOP-TITRATION
    // -------------------------------------------------------------------------
    console.log('[Phase 111: CLOSED-LOOP-TITRATION (PID Vasopressor & PRIS Guard)]');

    const deadbandHold = ClosedLoopTitrationService.evaluateTitration({
      patientId: 1,
      currentMapMmhg: 66,
      previousMapMmhg: 65,
      targetMapMmhg: 65,
      currentNorepiRateMcgKgMin: 0.12,
      vasopressinActive: false,
      currentRass: -1,
      currentPropofolRateMcgKgMin: 25,
      propofolInfusionHours: 12
    });
    assert(deadbandHold.controllerStatus === 'DEADBAND_HOLD', 'MAP within +/- 2 mmHg holds Norepinephrine steady');
    assert(deadbandHold.norepiDeltaMcgKgMin === 0, 'Norepinephrine delta is exactly 0 in deadband');

    const refractoryEscalation = ClosedLoopTitrationService.evaluateTitration({
      patientId: 1,
      currentMapMmhg: 48,
      previousMapMmhg: 52,
      targetMapMmhg: 65,
      integralErrorMap: 40,
      currentNorepiRateMcgKgMin: 0.48,
      vasopressinActive: false,
      currentRass: 1,
      currentPropofolRateMcgKgMin: 30,
      propofolInfusionHours: 18
    });
    assert(refractoryEscalation.norepiDeltaMcgKgMin <= 0.05, `Norepinephrine step clamped <= 0.05 (actual: ${refractoryEscalation.norepiDeltaMcgKgMin})`);
    assert(refractoryEscalation.vasopressinRecommended === true, 'Vasopressin 0.03 U/min adjunct triggered at Norepi >= 0.25');
    assert(refractoryEscalation.hydrocortisoneRecommended === true, 'Hydrocortisone triggered at Norepi >= 0.50');

    const prisEmergency = await ClosedLoopTitrationService.recordTitration({
      patientId: 1,
      currentMapMmhg: 62,
      previousMapMmhg: 64,
      currentNorepiRateMcgKgMin: 0.15,
      vasopressinActive: false,
      currentRass: -2,
      currentPropofolRateMcgKgMin: 85,
      propofolInfusionHours: 54,
      lactateMmolL: 5.2,
      triglyceridesMgDl: 610
    });
    assert(prisEmergency.prisRiskFlagged === true, 'Propofol Infusion Syndrome (PRIS) detected');
    assert(prisEmergency.recommendedPropofolRateMcgKgMin === 0, 'PRIS triggers hard stop (Propofol = 0)');
    assert(prisEmergency.controllerStatus === 'HUMAN_OVERRIDE_REQUIRED_PRIS', 'Requires immediate human override');
    assert(prisEmergency.id !== undefined && prisEmergency.id > 0, `Titration log persisted with ID ${prisEmergency.id}`);

    // -------------------------------------------------------------------------
    // Phase 112: BAYESIAN-PK-PD
    // -------------------------------------------------------------------------
    console.log('\n[Phase 112: BAYESIAN-PK-PD (Precision Vancomycin AUC24 & ARC Dosing)]');

    const arcPatient = BayesianPkPdService.evaluateDosing({
      patientId: 1,
      drugName: 'VANCOMYCIN',
      ageYears: 28,
      sex: 'M',
      weightKg: 80,
      serumCreatinineMgDl: 0.6,
      sepsisThirdSpacing: true,
      pathogenMicMgL: 1.0
    });
    assert(arcPatient.arcDetected === true, `Augmented Renal Clearance detected (CrCl: ${arcPatient.estimatedCrClMlMin} mL/min)`);
    assert(arcPatient.estimatedVdL === 68, `Third-spacing expanded Vd to 0.85 L/kg (actual: ${arcPatient.estimatedVdL} L)`);
    assert(arcPatient.recommendedRegimen.includes('q8h'), 'ARC triggers q8h Vancomycin maintenance interval');

    const nephroRiskPatient = await BayesianPkPdService.recordDosing({
      patientId: 1,
      drugName: 'VANCOMYCIN',
      ageYears: 72,
      sex: 'F',
      weightKg: 70,
      serumCreatinineMgDl: 1.9,
      pathogenMicMgL: 2.0,
      concomitantNephrotoxins: true
    });
    assert(nephroRiskPatient.nephrotoxicityRisk === 'HIGH', 'High MIC + concomitant nephrotoxins flagged as HIGH risk');
    assert(nephroRiskPatient.clinicalAlerts.some(a => a.includes('Daptomycin or Linezolid')), 'Suggests alternative agent for MIC >= 2.0');
    assert(nephroRiskPatient.id !== undefined && nephroRiskPatient.id > 0, `Bayesian PK/PD dosing persisted with ID ${nephroRiskPatient.id}`);

    // -------------------------------------------------------------------------
    // Phase 113: SEPSIS-SUBPHENOTYPE
    // -------------------------------------------------------------------------
    console.log('\n[Phase 113: SEPSIS-SUBPHENOTYPE (SOFA/qSOFA/NEWS2 & Seymour Phenotypes)]');

    const deltaShock = await SepsisSubphenotypeService.recordEvaluation({
      patientId: 1,
      ageYears: 64,
      heartRate: 132,
      systolicBp: 82,
      mapMmhg: 56,
      respiratoryRate: 28,
      spo2Pct: 91,
      supplementalO2: true,
      tempCelsius: 39.2,
      gcsScore: 13,
      pao2Fio2Ratio: 185,
      plateletsK: 68,
      bilirubinMgDl: 2.6,
      creatinineMgDl: 2.4,
      lactateMmolL: 5.1,
      vasopressorActive: true,
      minutesSinceTimeZero: 70,
      lactateDrawn: true,
      culturesDrawn: true,
      antibioticsGiven: false,
      fluidBolusStarted: true
    });
    assert(deltaShock.qsofaScore === 3, `qSOFA is 3/3 (actual: ${deltaShock.qsofaScore})`);
    assert(deltaShock.sofaScore >= 10, `SOFA score reflects multi-organ failure (actual: ${deltaShock.sofaScore})`);
    assert(deltaShock.subphenotype === 'DELTA_SHOCK_COAGULOPATHIC', 'Correctly classified as DELTA shock/coagulopathic subphenotype');
    assert(deltaShock.bundle1hCompliant === false, 'Flags overdue 1-Hour Bundle when Abx missing > 60 min');
    assert(deltaShock.id !== undefined && deltaShock.id > 0, `Sepsis subphenotype persisted with ID ${deltaShock.id}`);

    // -------------------------------------------------------------------------
    // Phase 114: POCUS-VEXUS-SHOCK
    // -------------------------------------------------------------------------
    console.log('\n[Phase 114: POCUS-VEXUS-SHOCK (VExUS Congestion Grading & RUSH Shock)]');

    const severeVexus = await PocusVexusService.recordExam({
      patientId: 1,
      ivcDiameterCm: 2.4,
      ivcCollapsibilityPct: 10,
      hepaticVeinPattern: 'SEVERE_S_REVERSAL',
      portalVmaxCmS: 30,
      portalVminCmS: 10, // PI = 66.7% (>= 50%)
      intrarenalVeinPattern: 'MONOPHASIC_DIASTOLIC',
      lvEjectionFractionPct: 25,
      rvDilatedMcConnell: false,
      pericardialEffusionWithCollapse: false,
      lungSlidingPresent: true,
      bilateralBLinesPresent: true
    });
    assert(severeVexus.portalPulsatilityPct >= 50, `Portal Pulsatility Index >= 50% (actual: ${severeVexus.portalPulsatilityPct}%)`);
    assert(severeVexus.vexusGrade === 3, `VExUS Grade is 3 (severe congestion, actual: ${severeVexus.vexusGrade})`);
    assert(severeVexus.shockPhenotype === 'CARDIOGENIC_SHOCK', 'RUSH identifies CARDIOGENIC_SHOCK');
    assert(severeVexus.fluidToleranceStatus === 'FLUID_INTOLERANT_DERESUSCITATE', 'Mandates de-resuscitation / diuretics');
    assert(severeVexus.id !== undefined && severeVexus.id > 0, `POCUS VExUS exam persisted with ID ${severeVexus.id}`);

    const tamponade = PocusVexusService.evaluatePocus({
      patientId: 1,
      ivcDiameterCm: 2.3,
      ivcCollapsibilityPct: 5,
      hepaticVeinPattern: 'MILD_S_LT_D',
      portalVmaxCmS: 25,
      portalVminCmS: 20,
      intrarenalVeinPattern: 'CONTINUOUS',
      lvEjectionFractionPct: 55,
      rvDilatedMcConnell: false,
      pericardialEffusionWithCollapse: true,
      lungSlidingPresent: true,
      bilateralBLinesPresent: false
    });
    assert(tamponade.shockPhenotype === 'OBSTRUCTIVE_TAMPONADE', 'Identifies OBSTRUCTIVE_TAMPONADE');

    // -------------------------------------------------------------------------
    // Phase 115: HANDOFF-HALLUCINATION-GUARD
    // -------------------------------------------------------------------------
    console.log('\n[Phase 115: HANDOFF-HALLUCINATION-GUARD (Zero-Tolerance Sign-Out Auditor)]');

    const unsafeHandoff = await HandoffHallucinationGuardService.recordVerification({
      patientId: 1,
      canonicalRecord: {
        codeStatus: 'DNR_DNI',
        allergies: ['Penicillin', 'Sulfa'],
        activeMedications: [
          { name: 'Norepinephrine', dose: '10', unit: 'mcg/min', route: 'IV' },
          { name: 'Heparin', dose: '5000', unit: 'units', route: 'SC' }
        ],
        pendingCriticalLabs: ['Troponin 4h repeat'],
        latestMapMmhg: 64
      },
      proposedHandoff: {
        codeStatus: 'FULL_CODE', // CRITICAL MISMATCH
        allergies: ['Penicillin'], // Sulfa OMITTED
        activeMedications: [
          { name: 'Norepinephrine', dose: '10', unit: 'mg/min', route: 'IV' }, // 1000x UNIT ERROR
          { name: 'Amiodarone', dose: '150', unit: 'mg', route: 'IV' } // HALLUCINATED MED + Heparin OMITTED
        ],
        pendingCriticalLabs: [],
        reportedMapMmhg: 85, // >10 mmHg drift
        contingencyPlan: 'Call MD' // too short
      }
    });
    assert(unsafeHandoff.verificationStatus === 'BLOCKED_CRITICAL_DISCREPANCY', 'Blocks unsafe handoff sign-out');
    assert(unsafeHandoff.safeToSignOut === false, 'safeToSignOut is false');
    assert(unsafeHandoff.discrepancyCount >= 6, `Detected all discrepancies (actual: ${unsafeHandoff.discrepancyCount})`);
    assert(unsafeHandoff.discrepancies.some(d => d.category === 'DOSE_OR_UNIT_ERROR'), 'Catches 1000x mg vs mcg unit conversion error');
    assert(unsafeHandoff.discrepancies.some(d => d.category === 'HALLUCINATED_MEDICATION'), 'Catches hallucinated Amiodarone');
    assert(unsafeHandoff.id !== undefined && unsafeHandoff.id > 0, `Handoff audit persisted with ID ${unsafeHandoff.id}`);

    const safeHandoff = HandoffHallucinationGuardService.verifyHandoff({
      patientId: 1,
      canonicalRecord: {
        codeStatus: 'FULL_CODE',
        allergies: ['Penicillin'],
        activeMedications: [{ name: 'Vancomycin', dose: '1000', unit: 'mg', route: 'IV' }],
        pendingCriticalLabs: ['AM BMP'],
        latestMapMmhg: 70
      },
      proposedHandoff: {
        codeStatus: 'FULL_CODE',
        allergies: ['Penicillin'],
        activeMedications: [{ name: 'Vancomycin', dose: '1000', unit: 'mg', route: 'IV' }],
        pendingCriticalLabs: ['AM BMP'],
        reportedMapMmhg: 71,
        contingencyPlan: 'If MAP < 65 mmHg, repeat bedside POCUS and initiate Norepinephrine at 0.05 mcg/kg/min.'
      }
    });
    assert(safeHandoff.verificationStatus === 'VERIFIED_SAFE', 'Clean matching handoff verified safe');
    assert(safeHandoff.safetyIntegrityScore === 100, 'Clean handoff scores 100/100');

    console.log('\n=============================================================');
    console.log(`SUITE 8 (PHASES 111–115) TESTS COMPLETE: ${passed} passed, ${failed} failed.`);
    console.log('=============================================================\n');
  } catch (error) {
    console.error('Fatal test error in Suite 8:', error);
    process.exit(1);
  } finally {
    const { pool } = require('./db');
    await pool.end();
    if (failed > 0) process.exit(1);
    process.exit(0);
  }
}

runSuite8Tests();
