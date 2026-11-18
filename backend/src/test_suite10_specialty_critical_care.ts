import { TmaHematologyService } from './services/tmaHematology';
import { GeriatricDeliriumBeersService } from './services/geriatricDeliriumBeers';
import { EnvenomationAntivenomService } from './services/envenomationAntivenom';
import { TropicalCriticalCareService } from './services/tropicalCriticalCare';
import { NeuroPrognosticationService } from './services/neuroPrognostication';

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

async function runSuite10Tests() {
  console.log('=== RUNNING SUITE 10: HEMATOLOGY TMA, GERIATRIC DELIRIUM, TOX, TROPICAL & NEURO-PROGNOSIS (PHASES 121–125) TESTS ===\n');

  try {
    // -------------------------------------------------------------------------
    // Phase 121: TMA-HEMATOLOGY-GUARD
    // -------------------------------------------------------------------------
    console.log('[Phase 121: TMA-HEMATOLOGY-GUARD (PLASMIC Score & ISTH DIC)]');

    const ttpCase = await TmaHematologyService.recordEvaluation({
      patientId: 1,
      plateletsK: 14,
      hemolysisPresent: true,
      activeCancer: false,
      solidOrganOrStemCellTransplant: false,
      mcvFl: 86,
      inr: 1.1,
      creatinineMgDl: 1.3,
      ptProlongationSec: 1.0,
      fibrinogenMgDl: 320,
      dDimerElevation: 'MODERATE'
    });
    assert(ttpCase.plasmicScore === 7, `PLASMIC score is 7/7 (actual: ${ttpCase.plasmicScore})`);
    assert(ttpCase.primaryTmaSyndrome === 'HIGH_PROBABILITY_TTP', 'Identified as HIGH_PROBABILITY_TTP');
    assert(ttpCase.tpeUrgentIndicated === true, 'STAT Therapeutic Plasma Exchange mandated');
    assert(ttpCase.plateletTransfusionProhibited === true, 'Prophylactic platelet transfusion strictly prohibited');
    assert(ttpCase.id !== undefined && ttpCase.id > 0, `TMA eval persisted with ID ${ttpCase.id}`);

    const dicCase = TmaHematologyService.evaluateTma({
      patientId: 1,
      plateletsK: 35,
      hemolysisPresent: true,
      activeCancer: true,
      solidOrganOrStemCellTransplant: false,
      mcvFl: 92,
      inr: 2.3,
      creatinineMgDl: 2.4,
      ptProlongationSec: 7.5,
      fibrinogenMgDl: 75,
      dDimerElevation: 'SEVERE'
    });
    assert(dicCase.isthDicScore === 8, `ISTH DIC score is 8/8 (actual: ${dicCase.isthDicScore})`);
    assert(dicCase.primaryTmaSyndrome === 'OVERT_DIC', 'Arbitrated as OVERT_DIC rather than TTP');

    // -------------------------------------------------------------------------
    // Phase 122: GERIATRIC-DELIRIUM-BEERS
    // -------------------------------------------------------------------------
    console.log('\n[Phase 122: GERIATRIC-DELIRIUM-BEERS (CAM-ICU, ACB & AGS Beers)]');

    const deliriumCase = await GeriatricDeliriumBeersService.recordEvaluation({
      patientId: 1,
      ageYears: 79,
      rassScore: 2,
      acuteOnsetOrFluctuating: true,
      inattentionPresent: true,
      disorganizedThinking: true,
      activeMedications: ['Diphenhydramine', 'Lorazepam', 'Oxybutynin', 'Acetaminophen']
    });
    assert(deliriumCase.camIcuPositive === true, 'CAM-ICU positive for acute delirium');
    assert(deliriumCase.acbTotalScore === 7, `ACB score sums 3+1+3=7 (actual: ${deliriumCase.acbTotalScore})`);
    assert(deliriumCase.beersViolationCount === 3, `Detected 3 AGS Beers violations (actual: ${deliriumCase.beersViolationCount})`);
    assert(deliriumCase.deliriumRiskTier === 'HIGH_ACTIVE_DELIRIUM_OR_ACB', 'Classified as HIGH_ACTIVE_DELIRIUM_OR_ACB');
    assert(deliriumCase.abcdefLiberationChecklist.length === 6, 'Outputs full 6-element ABCDEF Liberation Bundle');
    assert(deliriumCase.id !== undefined && deliriumCase.id > 0, `Geriatric delirium eval persisted with ID ${deliriumCase.id}`);

    // -------------------------------------------------------------------------
    // Phase 123: ENVENOMATION-TOX-ANTIVENOM
    // -------------------------------------------------------------------------
    console.log('\n[Phase 123: ENVENOMATION-TOX-ANTIVENOM (Crotalidae & Elapid Protocols)]');

    const pitViper = await EnvenomationAntivenomService.recordEnvenomation({
      patientId: 1,
      venomClass: 'CROTALIDAE_PIT_VIPER',
      preferredAntivenom: 'CROFAB',
      leadingEdgeAdvancing: true,
      fibrinogenMgDl: 80,
      plateletsK: 42,
      inr: 1.8,
      systolicBp: 84,
      ptosisOrBulbarWeakness: false,
      compartmentPressureMmhg: 34
    });
    assert(pitViper.severityGrade === 'SEVERE_SYSTEMIC_OR_NEURO', 'Classified as SEVERE pit viper envenomation');
    assert(pitViper.coagulopathyPresent === true, 'Detects venom-induced consumptive coagulopathy');
    assert(pitViper.initialVials === 10, `Prescribes 10 vials CroFab initial load (actual: ${pitViper.initialVials})`);
    assert(pitViper.prohibitedInterventions.some(p => p.includes('fasciotomy')), 'Prohibits routine prophylactic fasciotomy');
    assert(pitViper.id !== undefined && pitViper.id > 0, `Envenomation log persisted with ID ${pitViper.id}`);

    const elapid = EnvenomationAntivenomService.evaluateEnvenomation({
      patientId: 1,
      venomClass: 'ELAPID_CORAL_COBRA',
      leadingEdgeAdvancing: false,
      fibrinogenMgDl: 300,
      plateletsK: 220,
      inr: 1.0,
      systolicBp: 118,
      ptosisOrBulbarWeakness: true,
      nifCmH2O: -14
    });
    assert(elapid.airwayIntubationIndicated === true, 'Weak NIF (-14 > -20) + bulbar palsy triggers early intubation');

    // -------------------------------------------------------------------------
    // Phase 124: TROPICAL-MALARIA-DENGUE
    // -------------------------------------------------------------------------
    console.log('\n[Phase 124: TROPICAL-MALARIA-DENGUE (WHO Severe Malaria & Dengue Shock)]');

    const severeMalaria = await TropicalCriticalCareService.recordEvaluation({
      patientId: 1,
      syndrome: 'FALCIPARUM_MALARIA',
      weightKg: 70,
      parasitemiaPct: 9.5,
      gcsScore: 9,
      lactateMmolL: 6.2,
      glucoseMgDl: 36,
      hemoglobinGDl: 6.4,
      bilirubinMgDl: 4.5,
      creatinineMgDl: 2.1,
      systolicBp: 94,
      diastolicBp: 60,
      plateletsK: 48
    });
    assert(severeMalaria.severityTier === 'CRITICAL_SEVERE_ICU', 'Classified as WHO Severe Malaria');
    assert(severeMalaria.ivArtesunateIndicated === true, 'Mandates STAT IV Artesunate');
    assert(severeMalaria.artesunateDoseMg === 168, `Calculates 2.4 mg/kg * 70kg = 168 mg (actual: ${severeMalaria.artesunateDoseMg})`);
    assert(severeMalaria.clinicalDirectives.some(d => d.includes('PADH')), 'Includes 4-week Post-Artesunate Delayed Hemolysis surveillance');
    assert(severeMalaria.id !== undefined && severeMalaria.id > 0, `Tropical eval persisted with ID ${severeMalaria.id}`);

    const dengueShock = TropicalCriticalCareService.evaluateTropical({
      patientId: 1,
      syndrome: 'DENGUE_FEVER',
      weightKg: 60,
      gcsScore: 15,
      lactateMmolL: 3.1,
      glucoseMgDl: 98,
      hemoglobinGDl: 16.5,
      bilirubinMgDl: 0.9,
      creatinineMgDl: 1.0,
      systolicBp: 92,
      diastolicBp: 76, // Pulse pressure = 16 <= 20!
      hematocritRisePct: 24,
      plateletsK: 28,
      mucosalBleedingPresent: true
    });
    assert(dengueShock.pulsePressureMmhg === 16, `Narrow pulse pressure is 16 mmHg (actual: ${dengueShock.pulsePressureMmhg})`);
    assert(dengueShock.plasmaLeakageShock === true, 'Detects Dengue Shock Syndrome plasma leakage');
    assert(dengueShock.prohibitedAgents.some(a => a.includes('Ibuprofen')), 'Strictly prohibits NSAIDs/Aspirin in Dengue');

    // -------------------------------------------------------------------------
    // Phase 125: NEURO-PROGNOSIS-MULTIMODAL
    // -------------------------------------------------------------------------
    console.log('\n[Phase 125: NEURO-PROGNOSIS-MULTIMODAL (72h Confounder Guard & AAN 2023 BD/DNC)]');

    const prematureBlocked = NeuroPrognosticationService.evaluatePrognosis({
      patientId: 1,
      hoursPostRoscOrRewarming: 36, // < 72h!
      coreTempCelsius: 34.5,
      systolicBp: 110,
      mapMmhg: 78,
      sedativesCleared5HalfLives: false,
      neuromuscularBlockerCleared: true,
      severeMetabolicConfounderAbsent: true,
      bilateralAbsentPupillaryCorneal: true,
      bilateralAbsentN20Ssep: true,
      highlyMalignantEeg: true,
      nseUgL: 95,
      statusMyoclonusWithin72h: true,
      diffuseAnoxicMriCtInjury: true
    });
    assert(prematureBlocked.confoundersCleared === false, 'Detects premature < 72h, hypothermia, and active sedatives');
    assert(prematureBlocked.prognosisStatus === 'BLOCKED_PREMATURE_OR_CONFOUNDED', 'Blocks premature WLST prognostication');

    const validPrognosisAndBd = await NeuroPrognosticationService.recordPrognosis({
      patientId: 1,
      hoursPostRoscOrRewarming: 84,
      coreTempCelsius: 36.8,
      systolicBp: 114,
      mapMmhg: 82,
      sedativesCleared5HalfLives: true,
      neuromuscularBlockerCleared: true,
      severeMetabolicConfounderAbsent: true,
      bilateralAbsentPupillaryCorneal: true,
      bilateralAbsentN20Ssep: true,
      highlyMalignantEeg: true,
      nseUgL: 112,
      statusMyoclonusWithin72h: false,
      diffuseAnoxicMriCtInjury: true,
      apneaTestPerformed: true,
      apneaBaselinePaco2Mmhg: 40,
      apneaFinalPaco2Mmhg: 66,
      respiratoryEffortObserved: false
    });
    assert(validPrognosisAndBd.confoundersCleared === true, 'All confounders cleared at 84h');
    assert(validPrognosisAndBd.concordantPoorPredictors === 5, `5 concordant poor predictors (actual: ${validPrognosisAndBd.concordantPoorPredictors})`);
    assert(validPrognosisAndBd.prognosisStatus === 'POOR_NEUROLOGIC_OUTCOME_HIGH_CERTAINTY', 'High-certainty multimodal poor prognosis');
    assert(validPrognosisAndBd.aanBdDncEligible === true, 'AAN 2023 BD/DNC apnea test & prerequisites satisfied');
    assert(validPrognosisAndBd.id !== undefined && validPrognosisAndBd.id > 0, `Neuro-prognosis eval persisted with ID ${validPrognosisAndBd.id}`);

    console.log('\n=============================================================');
    console.log(`SUITE 10 (PHASES 121–125) TESTS COMPLETE: ${passed} passed, ${failed} failed.`);
    console.log('=============================================================\n');
  } catch (error) {
    console.error('Fatal test error in Suite 10:', error);
    process.exit(1);
  } finally {
    const { pool } = require('./db');
    await pool.end();
    if (failed > 0) process.exit(1);
    process.exit(0);
  }
}

runSuite10Tests();
