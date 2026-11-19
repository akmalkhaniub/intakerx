import { DamageControlSurgeryService } from './services/damageControlSurgery';
import { ReboaTraumaService } from './services/reboaTrauma';
import { MicrocirculationNirsService } from './services/microcirculationNirs';
import { TransplantDonorMgmtService } from './services/transplantDonorMgmt';
import { AnaphylaxisMastCellService } from './services/anaphylaxisMastCell';

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

async function runSuite11Tests() {
  console.log('=== RUNNING SUITE 11: COMPLEX SURGICAL CRITICAL CARE, TRAUMA & MICROVASCULAR (PHASES 126–130) TESTS ===\n');

  try {
    // -------------------------------------------------------------------------
    // Phase 126: DAMAGE-CONTROL-SURGERY
    // -------------------------------------------------------------------------
    console.log('[Phase 126: DAMAGE-CONTROL-SURGERY (Lethal Triad, Open Abdomen & TAC)]');

    const extremisDcs = await DamageControlSurgeryService.recordEvaluation({
      patientId: 1,
      coreTemperatureC: 34.2,
      arterialPh: 7.12,
      baseDeficitMeqL: 14.5,
      inr: 2.1,
      plateletsK: 38,
      packedRbcUnitsTransfused: 12,
      estimatedBloodLossMl: 4500,
      activeAbdominalPacking: true,
      bowelEdemaOrVisceralSwelling: true,
      intraAbdominalPressureMmhg: 22
    });

    assert(extremisDcs.lethalTriadPresent === true, 'Lethal triad correctly identified in extremis trauma');
    assert(extremisDcs.lethalTriadComponents.hypothermia === true, 'Hypothermia flagged (< 35.0°C)');
    assert(extremisDcs.lethalTriadComponents.acidosis === true, 'Acidosis flagged (pH < 7.20 / base deficit > 10)');
    assert(extremisDcs.lethalTriadComponents.coagulopathy === true, 'Coagulopathy flagged (INR > 1.5 / Plt < 50k)');
    assert(extremisDcs.physiologicalExhaustionTier === 'PHYSIOLOGICAL_EXTREMIS', 'Tier is PHYSIOLOGICAL_EXTREMIS');
    assert(extremisDcs.openAbdomenIndicated === true, 'Open abdomen temporary abdominal closure indicated');
    assert(extremisDcs.tacTechnique === 'ABThera Negative Pressure (-125 mmHg)', 'ABThera negative pressure closure selected');
    assert(extremisDcs.abdominalCompartmentSyndromeRisk === 'ACS_EMERGENCY', 'Abdominal compartment syndrome emergency detected');
    assert(extremisDcs.plannedIcuResuscitationHrs === 36, 'Planned ICU resuscitation duration is 36 hours');
    assert(extremisDcs.id !== undefined && extremisDcs.id > 0, `DCS record persisted to DB with ID ${extremisDcs.id}`);

    const stableTrauma = DamageControlSurgeryService.evaluateDcs({
      patientId: 1,
      coreTemperatureC: 36.8,
      arterialPh: 7.38,
      baseDeficitMeqL: 2.0,
      inr: 1.05,
      plateletsK: 230,
      packedRbcUnitsTransfused: 1,
      estimatedBloodLossMl: 400,
      activeAbdominalPacking: false,
      bowelEdemaOrVisceralSwelling: false,
      intraAbdominalPressureMmhg: 8
    });
    assert(stableTrauma.lethalTriadPresent === false, 'Stable patient has no lethal triad');
    assert(stableTrauma.openAbdomenIndicated === false, 'Primary closure allowed for stable non-edematous abdomen');
    assert(stableTrauma.tacTechnique === 'Primary Closure Allowed', 'Technique is Primary Closure Allowed');

    // -------------------------------------------------------------------------
    // Phase 127: REBOA-TRAUMA-HEMODYNAMICS
    // -------------------------------------------------------------------------
    console.log('\n[Phase 127: REBOA-TRAUMA-HEMODYNAMICS (Aortic Occlusion & pREBOA)]');

    const zone1Mission = await ReboaTraumaService.recordEvaluation({
      patientId: 1,
      hemorrhageAnatomy: 'SUBDIAPHRAGMATIC_ABDOMINAL',
      systolicBpMmhg: 58,
      occlusionStartTime: new Date().toISOString(),
      elapsedOcclusionMinutes: 18,
      isPartialReboa: false,
      balloonVolumeMl: 18,
      proximalMapMmhg: 78,
      distalPulsePalpable: false
    });
    assert(zone1Mission.aorticZone === 'Zone 1', 'Subdiaphragmatic hemorrhage allocated to Zone 1');
    assert(zone1Mission.maxIschemiaDurationMin === 30, 'Zone 1 max ischemia duration is 30 minutes');
    assert(zone1Mission.remainingSafeTimeMin === 12, `12 minutes safe occlusion remaining (actual: ${zone1Mission.remainingSafeTimeMin})`);
    assert(zone1Mission.ischemiaRiskTier === 'WARNING_ELAPSED_50PCT', 'Risk tier is WARNING_ELAPSED_50PCT');
    assert(zone1Mission.id !== undefined && zone1Mission.id > 0, `REBOA mission persisted to DB with ID ${zone1Mission.id}`);

    const zone3pReboa = ReboaTraumaService.evaluateReboa({
      patientId: 1,
      hemorrhageAnatomy: 'PELVIC_FRACTURE_OR_GROIN',
      systolicBpMmhg: 65,
      occlusionStartTime: new Date().toISOString(),
      elapsedOcclusionMinutes: 20,
      isPartialReboa: true,
      balloonVolumeMl: 12,
      proximalMapMmhg: 74,
      distalPulsePalpable: true
    });
    assert(zone3pReboa.aorticZone === 'Zone 3', 'Pelvic fracture allocated to Zone 3');
    assert(zone3pReboa.maxIschemiaDurationMin === 60, 'Zone 3 max ischemia duration is 60 minutes');
    assert(zone3pReboa.isPartialReboa === true, 'pREBOA mode verified');
    assert(zone3pReboa.targetDistalMapMmhg === 40, 'Target distal MAP is 40 mmHg for pREBOA');

    const overtimeZone1 = ReboaTraumaService.evaluateReboa({
      patientId: 1,
      hemorrhageAnatomy: 'SUBDIAPHRAGMATIC_ABDOMINAL',
      systolicBpMmhg: 50,
      occlusionStartTime: new Date().toISOString(),
      elapsedOcclusionMinutes: 42,
      isPartialReboa: false,
      balloonVolumeMl: 20,
      proximalMapMmhg: 62,
      distalPulsePalpable: false
    });
    assert(overtimeZone1.ischemiaRiskTier === 'CRITICAL_ISCHEMIA_EXCEEDED', 'Critical ischemia timeout triggered at 42 min');
    assert(overtimeZone1.reperfusionShockRisk === 'IMMINENT_LETHAL_WASHOUT', 'Reperfusion washout risk is IMMINENT_LETHAL_WASHOUT');

    const contraThoracic = ReboaTraumaService.evaluateReboa({
      patientId: 1,
      hemorrhageAnatomy: 'THORACIC_SUSPECTED',
      systolicBpMmhg: 60,
      occlusionStartTime: new Date().toISOString(),
      elapsedOcclusionMinutes: 0,
      isPartialReboa: false,
      balloonVolumeMl: 0,
      proximalMapMmhg: 60,
      distalPulsePalpable: false
    });
    assert(contraThoracic.aorticZone === 'CONTRAINDICATED', 'REBOA strictly contraindicated for suspected thoracic rupture');

    // -------------------------------------------------------------------------
    // Phase 128: SUBCLINICAL-MICROCIRCULATION-NIRS
    // -------------------------------------------------------------------------
    console.log('\n[Phase 128: SUBCLINICAL-MICROCIRCULATION-NIRS (Ince Decoupling & StO2)]');

    const type3Vasopressor = await MicrocirculationNirsService.recordEvaluation({
      patientId: 1,
      macroMapMmhg: 78,
      sto2Percentage: 58,
      mfiScore: 1.8,
      ppvPercentage: 59,
      perfusedVesselDensityMm2: 7.2,
      norepinephrineDoseMcgKgMin: 0.45,
      hematocritPct: 32,
      cvpMmhg: 10,
      fluidBalance24hLiters: 1.5
    });
    assert(type3Vasopressor.hemodynamicCoherenceLoss === 'TYPE_3_VASOCONSTRICTION_TAMPO', 'Identified Ince Type 3 excessive vasoconstriction');
    assert(type3Vasopressor.fluidResponsiveCaution === true, 'Fluid caution flag activated');
    assert(type3Vasopressor.microcirculatoryShockState === 'SEVERE_DISSOCIATED_HYPOXIA', 'Severe dissociated microcirculatory shock flagged');
    assert(type3Vasopressor.id !== undefined && type3Vasopressor.id > 0, `NIRS eval persisted to DB with ID ${type3Vasopressor.id}`);

    const type2Dilution = MicrocirculationNirsService.evaluateMicrocirculation({
      patientId: 1,
      macroMapMmhg: 70,
      sto2Percentage: 66,
      mfiScore: 2.2,
      ppvPercentage: 72,
      perfusedVesselDensityMm2: 9.0,
      norepinephrineDoseMcgKgMin: 0.1,
      hematocritPct: 21,
      cvpMmhg: 9,
      fluidBalance24hLiters: 4.8
    });
    assert(type2Dilution.hemodynamicCoherenceLoss === 'TYPE_2_HEMODILUTION_FLUID', 'Identified Ince Type 2 iatrogenic hemodilution');

    const type4VenousEdema = MicrocirculationNirsService.evaluateMicrocirculation({
      patientId: 1,
      macroMapMmhg: 72,
      sto2Percentage: 64,
      mfiScore: 2.0,
      ppvPercentage: 66,
      perfusedVesselDensityMm2: 8.0,
      norepinephrineDoseMcgKgMin: 0.15,
      hematocritPct: 30,
      cvpMmhg: 17,
      fluidBalance24hLiters: 6.8
    });
    assert(type4VenousEdema.hemodynamicCoherenceLoss === 'TYPE_4_CAPILLARY_LEAK_EDEMA', 'Identified Ince Type 4 venous congestion & tissue edema');

    const coherentResus = MicrocirculationNirsService.evaluateMicrocirculation({
      patientId: 1,
      macroMapMmhg: 75,
      sto2Percentage: 84,
      mfiScore: 2.9,
      ppvPercentage: 92,
      perfusedVesselDensityMm2: 13.5,
      norepinephrineDoseMcgKgMin: 0.08,
      hematocritPct: 34,
      cvpMmhg: 8,
      fluidBalance24hLiters: 1.0
    });
    assert(coherentResus.hemodynamicCoherenceLoss === 'COHERENT', 'Identified coherent micro-macro circulation');
    assert(coherentResus.microcirculatoryShockState === 'NORMAL_PERFUSED', 'Microcirculatory shock state is NORMAL_PERFUSED');

    // -------------------------------------------------------------------------
    // Phase 129: TRANSPLANT-DONOR-OPTIMIZATION
    // -------------------------------------------------------------------------
    console.log('\n[Phase 129: TRANSPLANT-DONOR-OPTIMIZATION (OPTN DMG Bundle & HRT)]');

    const optimalDonor = await TransplantDonorMgmtService.recordEvaluation({
      patientId: 1,
      meanArterialPressureMmhg: 72,
      systolicBpMmhg: 118,
      cvpMmhg: 7,
      urineOutputMlKgHr: 1.8,
      serumSodiumMeqL: 142,
      bloodGlucoseMgDl: 140,
      pao2Fio2Ratio: 380,
      vasopressorCount: 1,
      tripleHormoneTherapyActive: true,
      coreTemperatureC: 36.9
    });
    assert(optimalDonor.donorMgmtGoalsMet === 8, `All 8 DMG targets achieved (actual: ${optimalDonor.donorMgmtGoalsMet})`);
    assert(optimalDonor.optnBundleComplianceTier === 'OPTIMAL_DONOR_STATE', 'Tier is OPTIMAL_DONOR_STATE');
    assert(optimalDonor.diabetesInsipidusActive === false, 'Diabetes insipidus controlled');
    assert(optimalDonor.id !== undefined && optimalDonor.id > 0, `Donor log persisted to DB with ID ${optimalDonor.id}`);

    const decompensatedDonor = TransplantDonorMgmtService.evaluateDonor({
      patientId: 1,
      meanArterialPressureMmhg: 54,
      systolicBpMmhg: 82,
      cvpMmhg: 2,
      urineOutputMlKgHr: 6.2,
      serumSodiumMeqL: 161,
      bloodGlucoseMgDl: 240,
      pao2Fio2Ratio: 220,
      vasopressorCount: 3,
      tripleHormoneTherapyActive: false,
      coreTemperatureC: 34.6
    });
    assert(decompensatedDonor.optnBundleComplianceTier === 'CRITICAL_ALLOGRAFT_RISK', 'Critical allograft risk detected');
    assert(decompensatedDonor.diabetesInsipidusActive === true, 'Severe diabetes insipidus flagged (UO 6.2 mL/kg/h, Na 161)');
    assert(decompensatedDonor.neurogenicShockPresent === true, 'Neurogenic shock present (MAP 54, vasopressors 3)');

    // -------------------------------------------------------------------------
    // Phase 130: ANAPHYLAXIS-PERIOPERATIVE-MAST-CELL
    // -------------------------------------------------------------------------
    console.log('\n[Phase 130: ANAPHYLAXIS-PERIOPERATIVE-MAST-CELL (Ring & Messmer, Tryptase)]');

    const rocuroniumBetaBlockerCrisis = await AnaphylaxisMastCellService.recordEvaluation({
      patientId: 1,
      suspectedTrigger: 'Rocuronium bromide',
      cutaneousSignsPresent: true,
      systolicBpMmhg: 55,
      heartRateBpm: 138,
      bronchospasmOrStridor: true,
      cardiacArrestPresent: false,
      patientOnBetaBlocker: true,
      epinephrineDosesGivenCount: 3,
      totalEpinephrineMgGiven: 0.3,
      shockPersistsAfterEpinephrine: true,
      measuredTryptaseUgL: 28.5,
      baselineTryptaseUgL: 5.2
    });

    assert(rocuroniumBetaBlockerCrisis.ringMessmerGrade === 'Grade III', 'Cardiovascular collapse classified as Grade III');
    assert(rocuroniumBetaBlockerCrisis.refractoryShock === true, 'Refractory anaphylactic shock identified');
    assert(rocuroniumBetaBlockerCrisis.glucagonIndicated === true, 'Glucagon indicated for beta-blocker refractoriness');
    assert(rocuroniumBetaBlockerCrisis.methyleneBlueIndicated === true, 'Methylene blue indicated for refractory vasoplegia');
    assert(rocuroniumBetaBlockerCrisis.sugammadexIndicated === true, 'Sugammadex 16 mg/kg indicated for rocuronium encapsulation');
    assert(rocuroniumBetaBlockerCrisis.tryptaseSchedule.length === 3, 'Full 3-stage tryptase sampling schedule provided');
    assert(rocuroniumBetaBlockerCrisis.id !== undefined && rocuroniumBetaBlockerCrisis.id > 0, `Anaphylaxis event persisted to DB with ID ${rocuroniumBetaBlockerCrisis.id}`);

    const cardiacArrestAnaphylaxis = AnaphylaxisMastCellService.evaluateAnaphylaxis({
      patientId: 1,
      suspectedTrigger: 'Cefazolin',
      cutaneousSignsPresent: false,
      systolicBpMmhg: 0,
      heartRateBpm: 0,
      bronchospasmOrStridor: true,
      cardiacArrestPresent: true,
      patientOnBetaBlocker: false,
      epinephrineDosesGivenCount: 1,
      totalEpinephrineMgGiven: 1.0,
      shockPersistsAfterEpinephrine: true
    });
    assert(cardiacArrestAnaphylaxis.ringMessmerGrade === 'Grade IV', 'Cardiac arrest classified as Grade IV');

    const grade1Urticaria = AnaphylaxisMastCellService.evaluateAnaphylaxis({
      patientId: 1,
      suspectedTrigger: 'Latex surgical gloves',
      cutaneousSignsPresent: true,
      systolicBpMmhg: 122,
      heartRateBpm: 78,
      bronchospasmOrStridor: false,
      cardiacArrestPresent: false,
      patientOnBetaBlocker: false,
      epinephrineDosesGivenCount: 0,
      totalEpinephrineMgGiven: 0,
      shockPersistsAfterEpinephrine: false
    });
    assert(grade1Urticaria.ringMessmerGrade === 'Grade I', 'Isolated cutaneous reaction classified as Grade I');
    assert(grade1Urticaria.refractoryShock === false, 'No refractory shock in Grade I');

    console.log(`\n================================================================`);
    console.log(`SUITE 11 TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log(`================================================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal error during Suite 11 testing:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runSuite11Tests();
