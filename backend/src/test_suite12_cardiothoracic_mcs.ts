import { ImpellaMicroaxialService } from './services/impellaMicroaxial';
import { EcmoRecirculationService } from './services/ecmoRecirculation';
import { VentilatorAsynchronyService } from './services/ventilatorAsynchrony';
import { VasoplegicShockRescueService } from './services/vasoplegicShockRescue';
import { CardiacTamponadeDrainageService } from './services/cardiacTamponadeDrainage';

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

async function runSuite12Tests() {
  console.log('=== RUNNING SUITE 12: CARDIOTHORACIC ICU, MCS & ECLS (PHASES 131–135) TESTS ===\n');

  try {
    // -------------------------------------------------------------------------
    // Phase 131: IMPELLA-MICROAXIAL-FLOW
    // -------------------------------------------------------------------------
    console.log('[Phase 131: IMPELLA-MICROAXIAL-FLOW (Hemodynamics, Suction & Purge)]');

    const cardiogenicShockImpella = await ImpellaMicroaxialService.recordEvaluation({
      patientId: 1,
      deviceModel: 'Impella CP',
      pLevel: 'P-8',
      flowRateLpm: 1.8,
      motorCurrentMa: 380,
      purgePressureMmhg: 540,
      purgeFlowMlHr: 11.5,
      meanArterialPressureMmhg: 58,
      centralVenousPressureMmhg: 10,
      cardiacOutputLpm: 2.8,
      echocardiographicMalposition: true,
      systemicHypovolemiaSuspected: false
    });

    assert(cardiogenicShockImpella.cpoShockStatus === 'IMPAIRED_CARDIOGENIC_SHOCK', 'Cardiogenic shock identified (CPO < 0.6 W)');
    assert(cardiogenicShockImpella.cardiacPowerOutputWatts === 0.36, `CPO calculated correctly as 0.36 W (actual: ${cardiogenicShockImpella.cardiacPowerOutputWatts})`);
    assert(cardiogenicShockImpella.suctionAlarmPresent === true, 'Suction alarm triggered');
    assert(cardiogenicShockImpella.suctionEtiology === 'CANNULA_MALPOSITION_WALL', 'Suction etiology identified as CANNULA_MALPOSITION_WALL');
    assert(cardiogenicShockImpella.purgeStatus === 'PURGE_NORMAL', 'Purge status within normal limits');
    assert(cardiogenicShockImpella.id !== undefined && cardiogenicShockImpella.id > 0, `Impella record persisted with ID ${cardiogenicShockImpella.id}`);

    const rvFailureSuction = ImpellaMicroaxialService.evaluateImpella({
      patientId: 1,
      deviceModel: 'Impella 5.5',
      pLevel: 'P-6',
      flowRateLpm: 1.9,
      motorCurrentMa: 390,
      purgePressureMmhg: 610,
      purgeFlowMlHr: 9.0,
      meanArterialPressureMmhg: 62,
      centralVenousPressureMmhg: 19,
      cardiacOutputLpm: 3.2,
      echocardiographicMalposition: false,
      systemicHypovolemiaSuspected: false
    });
    assert(rvFailureSuction.suctionEtiology === 'RIGHT_VENTRICLE_FAILURE', 'Unmasked RV failure identified as suction etiology (CVP 19 mmHg)');

    const purgeClotAlarm = ImpellaMicroaxialService.evaluateImpella({
      patientId: 1,
      deviceModel: 'Impella CP',
      pLevel: 'P-8',
      flowRateLpm: 3.5,
      motorCurrentMa: 650,
      purgePressureMmhg: 1250,
      purgeFlowMlHr: 6.0,
      meanArterialPressureMmhg: 78,
      centralVenousPressureMmhg: 10,
      cardiacOutputLpm: 5.0,
      echocardiographicMalposition: false,
      systemicHypovolemiaSuspected: false
    });
    assert(purgeClotAlarm.purgeStatus === 'PURGE_HIGH_PRESSURE_CLOT_RISK', 'Purge high pressure clot alarm triggered (1250 mmHg > 1100 mmHg)');

    const purgeLeakAlarm = ImpellaMicroaxialService.evaluateImpella({
      patientId: 1,
      deviceModel: 'Impella CP',
      pLevel: 'P-8',
      flowRateLpm: 3.5,
      motorCurrentMa: 650,
      purgePressureMmhg: 220,
      purgeFlowMlHr: 12.0,
      meanArterialPressureMmhg: 78,
      centralVenousPressureMmhg: 10,
      cardiacOutputLpm: 5.0,
      echocardiographicMalposition: false,
      systemicHypovolemiaSuspected: false
    });
    assert(purgeLeakAlarm.purgeStatus === 'PURGE_LOW_PRESSURE_LEAK', 'Purge low pressure leak alarm triggered (220 mmHg < 300 mmHg)');

    // -------------------------------------------------------------------------
    // Phase 132: ECMO-RECIRCULATION-HARLEQUIN
    // -------------------------------------------------------------------------
    console.log('\n[Phase 132: ECMO-RECIRCULATION-HARLEQUIN (Recirculation Fraction & North-South)]');

    const severeRecirculationVv = await EcmoRecirculationService.recordEvaluation({
      patientId: 1,
      ecmoMode: 'VV_ECMO',
      preOxygenatorSatPct: 86,
      postOxygenatorSatPct: 98,
      mixedVenousSatPct: 65,
      sweepGasFlowLpm: 8.0,
      pumpFlowLpm: 4.5,
      nativeLungTidalVolumeMl: 150
    });
    assert(severeRecirculationVv.recirculationFractionPct !== undefined && severeRecirculationVv.recirculationFractionPct >= 60, `High Recirculation Fraction calculated: ${severeRecirculationVv.recirculationFractionPct}%`);
    assert(severeRecirculationVv.recirculationRiskTier === 'SEVERE_RECIRCULATION', 'Classified as SEVERE_RECIRCULATION (RF >= 30%)');
    assert(severeRecirculationVv.id !== undefined && severeRecirculationVv.id > 0, `ECMO event persisted with ID ${severeRecirculationVv.id}`);

    const acceptableRecirculation = EcmoRecirculationService.evaluateEcmo({
      patientId: 1,
      ecmoMode: 'VV_ECMO',
      preOxygenatorSatPct: 70,
      postOxygenatorSatPct: 99,
      mixedVenousSatPct: 65,
      sweepGasFlowLpm: 5.0,
      pumpFlowLpm: 3.8,
      nativeLungTidalVolumeMl: 280
    });
    assert(acceptableRecirculation.recirculationFractionPct !== undefined && acceptableRecirculation.recirculationFractionPct < 20, `Acceptable Recirculation Fraction: ${acceptableRecirculation.recirculationFractionPct}%`);
    assert(acceptableRecirculation.recirculationRiskTier === 'ACCEPTABLE_FLOW', 'Classified as ACCEPTABLE_FLOW');

    const harlequinVaCrisis = EcmoRecirculationService.evaluateEcmo({
      patientId: 1,
      ecmoMode: 'VA_ECMO',
      rightRadialSpo2Pct: 76,
      femoralArterialSpo2Pct: 99,
      sweepGasFlowLpm: 6.0,
      pumpFlowLpm: 4.2,
      nativeLungTidalVolumeMl: 200
    });
    assert(harlequinVaCrisis.differentialHypoxemiaPresent === true, 'Harlequin differential hypoxemia detected');
    assert(harlequinVaCrisis.radialToFemoralGradientPct === 23, `Radial-to-femoral gradient is 23% (actual: ${harlequinVaCrisis.radialToFemoralGradientPct})`);
    assert(harlequinVaCrisis.recirculationRiskTier === 'HARLEQUIN_SYNDROME_CRITICAL', 'Classified as HARLEQUIN_SYNDROME_CRITICAL');

    // -------------------------------------------------------------------------
    // Phase 133: VENTILATOR-ASYNCHRONY-NEUROMUSCULAR
    // -------------------------------------------------------------------------
    console.log('\n[Phase 133: VENTILATOR-ASYNCHRONY-NEUROMUSCULAR (Reverse Triggering & AI)]');

    const reverseTriggeringCrisis = await VentilatorAsynchronyService.recordEvaluation({
      patientId: 1,
      totalBreathsAnalyzed: 100,
      reverseTriggeringEvents: 14,
      doubleTriggeringEvents: 8,
      ineffectiveTriggeringEvents: 3,
      ventilatorSetRateBpm: 18,
      measuredPatientRateBpm: 26,
      intrinsicPeepCmH2O: 3,
      inspiratoryTimeSec: 0.8,
      patientOnNeuromuscularBlockade: false
    });
    assert(reverseTriggeringCrisis.asynchronyIndexPct === 25.0, `Asynchrony Index calculated as 25.0% (actual: ${reverseTriggeringCrisis.asynchronyIndexPct}%)`);
    assert(reverseTriggeringCrisis.asynchronySeverityTier === 'SEVERE_DYSYNCHRONY_CRISIS', 'Tier is SEVERE_DYSYNCHRONY_CRISIS');
    assert(reverseTriggeringCrisis.reverseTriggeringDetected === true, 'Reverse triggering entrainment detected');
    assert(reverseTriggeringCrisis.doubleTriggeringDetected === true, 'Double triggering detected');
    assert(reverseTriggeringCrisis.breathStackingVolutraumaRisk === 'CRITICAL_VOLUTRAUMA', 'Volutrauma risk is CRITICAL_VOLUTRAUMA');
    assert(reverseTriggeringCrisis.neuromuscularBlockadeIndicated === true, 'Neuromuscular blockade indicated');
    assert(reverseTriggeringCrisis.id !== undefined && reverseTriggeringCrisis.id > 0, `Vent asynchrony eval persisted with ID ${reverseTriggeringCrisis.id}`);

    const copdIneffectiveTriggering = VentilatorAsynchronyService.evaluateAsynchrony({
      patientId: 1,
      totalBreathsAnalyzed: 100,
      reverseTriggeringEvents: 0,
      doubleTriggeringEvents: 0,
      ineffectiveTriggeringEvents: 12,
      ventilatorSetRateBpm: 14,
      measuredPatientRateBpm: 22,
      intrinsicPeepCmH2O: 8,
      inspiratoryTimeSec: 1.0,
      patientOnNeuromuscularBlockade: false
    });
    assert(copdIneffectiveTriggering.ineffectiveTriggeringDetected === true, 'Ineffective triggering detected in auto-PEEP');
    assert(copdIneffectiveTriggering.asynchronySeverityTier === 'MODERATE_ASYNCHRONY', 'Tier is MODERATE_ASYNCHRONY');
    assert(copdIneffectiveTriggering.breathStackingVolutraumaRisk === 'LOW', 'Volutrauma risk is LOW');

    // -------------------------------------------------------------------------
    // Phase 134: POST-CARDIOTOMY-VASOPLEGIA
    // -------------------------------------------------------------------------
    console.log('\n[Phase 134: POST-CARDIOTOMY-VASOPLEGIA (Rescue Ladder & Non-Adrenergics)]');

    const extremisVasoplegia = await VasoplegicShockRescueService.recordEvaluation({
      patientId: 1,
      meanArterialPressureMmhg: 52,
      norepinephrineEquivalentMcgKgMin: 0.45,
      systemicVascularResistanceDynes: 460,
      cardiacIndexLMinM2: 3.4,
      hoursPostCardiopulmonaryBypass: 3,
      currentVasopressinUPerMin: 0.0,
      methyleneBlueGiven: false,
      angiotensinIiGiven: false,
      refractoryToHighDoseCatecholamines: true
    });
    assert(extremisVasoplegia.vasoplegiaSeverityTier === 'EXTREMIS_CATASTROPHIC', 'Classified as EXTREMIS_CATASTROPHIC vasoplegia');
    assert(extremisVasoplegia.vasopressinIndicated === true, 'Step 1 Vasopressin indicated');
    assert(extremisVasoplegia.methyleneBlueIndicated === true, 'Step 2 Methylene Blue indicated');
    assert(extremisVasoplegia.hydroxocobalaminIndicated === true, 'Step 3 Hydroxocobalamin indicated');
    assert(extremisVasoplegia.id !== undefined && extremisVasoplegia.id > 0, `Vasoplegic shock record persisted with ID ${extremisVasoplegia.id}`);

    const refractoryGiaprezaCase = VasoplegicShockRescueService.evaluateVasoplegia({
      patientId: 1,
      meanArterialPressureMmhg: 50,
      norepinephrineEquivalentMcgKgMin: 0.65,
      systemicVascularResistanceDynes: 420,
      cardiacIndexLMinM2: 3.1,
      hoursPostCardiopulmonaryBypass: 6,
      currentVasopressinUPerMin: 0.04,
      methyleneBlueGiven: true,
      angiotensinIiGiven: false,
      refractoryToHighDoseCatecholamines: true
    });
    assert(refractoryGiaprezaCase.angiotensinIiIndicated === true, 'Step 4 Synthetic Angiotensin II indicated');
    assert(refractoryGiaprezaCase.rescueLadderStep === 4, 'Rescue ladder reached Step 4');

    // -------------------------------------------------------------------------
    // Phase 135: CARDIAC-SURGERY-DRAINAGE-TAMPONADE
    // -------------------------------------------------------------------------
    console.log('\n[Phase 135: CARDIAC-SURGERY-DRAINAGE-TAMPONADE (Chest Tubes & Resternotomy)]');

    const surgicalHemorrhage = await CardiacTamponadeDrainageService.recordEvaluation({
      patientId: 1,
      chestTubeRateMlHr: 480,
      cumulativeDrainage4hMl: 650,
      hoursPostop: 1,
      meanArterialPressureMmhg: 62,
      centralVenousPressureMmhg: 8,
      pulmonaryArteryDiastolicMmhg: 14,
      pulsusParadoxusMmhg: 4,
      echoRightAtrialCollapse: false,
      suddenCessationOfDrainage: false
    });
    assert(surgicalHemorrhage.surgicalReexplorationIndicated === true, 'Surgical re-exploration indicated (480 mL/h in hour 1)');
    assert(surgicalHemorrhage.reexplorationCriteriaMet.length >= 1, 'Re-exploration criteria documented');
    assert(surgicalHemorrhage.occultTamponadeSuspected === false, 'Not occult tamponade (brisk bleeding visible)');
    assert(surgicalHemorrhage.id !== undefined && surgicalHemorrhage.id > 0, `Drainage log persisted with ID ${surgicalHemorrhage.id}`);

    const occultTamponadeEmergency = CardiacTamponadeDrainageService.evaluateDrainage({
      patientId: 1,
      chestTubeRateMlHr: 15,
      cumulativeDrainage4hMl: 380,
      hoursPostop: 4,
      meanArterialPressureMmhg: 48,
      centralVenousPressureMmhg: 19,
      pulmonaryArteryDiastolicMmhg: 18,
      pulsusParadoxusMmhg: 14,
      echoRightAtrialCollapse: true,
      suddenCessationOfDrainage: true
    });
    assert(occultTamponadeEmergency.occultTamponadeSuspected === true, 'Occult clotted tamponade detected');
    assert(occultTamponadeEmergency.diastolicEqualizationPresent === true, 'Diastolic equalization confirmed (CVP 19 ~ PAD 18)');
    assert(occultTamponadeEmergency.emergencyBedsideResternotomyAlert === true, 'EMERGENCY BEDSIDE RESTERNOTOMY ALERT triggered');

    console.log(`\n================================================================`);
    console.log(`SUITE 12 TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log(`================================================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal error during Suite 12 testing:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runSuite12Tests();
