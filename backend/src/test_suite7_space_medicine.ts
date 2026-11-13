import { SpaceSansService } from './services/spaceSans';
import { SolarRadService } from './services/solarRad';
import { MicrogravResusService } from './services/microgravResus';
import { EclssHabitatService } from './services/eclssHabitat';
import { DeepSpaceTelemedService } from './services/deepSpaceTelemed';
import { query } from './db';

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

async function runSuite7Tests() {
  console.log('=== RUNNING SUITE 7: SPACEFLIGHT, PLANETARY & DEEP-SPACE MEDICINE (PHASES 106–110) TESTS ===\n');

  try {
    // -------------------------------------------------------------------------
    // Phase 106: SPACE-SANS
    // -------------------------------------------------------------------------
    console.log('[Phase 106: SPACE-SANS (Spaceflight Associated Neuro-ocular Syndrome)]');
    
    // Normal / mild test
    const mildSans = SpaceSansService.evaluateSans({
      patientId: 1,
      missionDay: 30,
      onsdMm: 4.8,
      choroidalFolds: false,
      hyperopicShiftDiopters: 0.25,
      cottonWoolSpots: false,
      ijvFlowPattern: 'NORMAL_ANTEROGRADE'
    });
    assert(mildSans.sansGrade === 'GRADE_0', 'Normal ONSD categorized as GRADE_0');
    assert(mildSans.anticoagulationRequired === false, 'Anticoagulation not required for normal flow');
    assert(mildSans.lbnpTargetMmhg === -25.0, 'Baseline LBNP is -25.0 mmHg');

    // Severe test with IJV thrombosis & cotton wool spots
    const severeSans = await SpaceSansService.recordSansEvaluation({
      patientId: 1,
      missionDay: 180,
      onsdMm: 6.8,
      choroidalFolds: true,
      hyperopicShiftDiopters: 1.75,
      cottonWoolSpots: true,
      ijvFlowPattern: 'OCCLUSIVE_THROMBOSIS'
    });
    assert(severeSans.sansGrade === 'GRADE_4', 'Severe SANS categorized as GRADE_4');
    assert(severeSans.fluidShiftSeverityScore >= 80, `Severity score is high (actual: ${severeSans.fluidShiftSeverityScore})`);
    assert(severeSans.anticoagulationRequired === true, 'Therapeutic anticoagulation mandated for IJV thrombosis');
    assert(severeSans.lbnpTargetMmhg === -40.0, 'Escalated LBNP prescribed at -40.0 mmHg');
    assert(severeSans.lbnpDurationMinutes === 120, 'LBNP daily duration escalated to 120 minutes');
    assert(severeSans.id !== undefined && severeSans.id > 0, `SANS evaluation persisted to database with ID ${severeSans.id}`);

    // -------------------------------------------------------------------------
    // Phase 107: SOLAR-RAD
    // -------------------------------------------------------------------------
    console.log('\n[Phase 107: SOLAR-RAD (Space Radiation & Solar Particle Event Sentinel)]');

    // Nominal LEO pass
    const normalRad = SolarRadService.evaluateRadiation({
      missionPhase: 'LEO',
      speProtonFluxPfu: 5.0,
      gcrDoseRateMsvDay: 0.5,
      cumulativeMissionDoseMsv: 25.0,
      evaActive: false
    });
    assert(normalRad.stormTier === 'GREEN_NORMAL', 'Nominal LEO radiation is GREEN_NORMAL');
    assert(normalRad.shelterInPlaceRequired === false, 'Shelter in place not required for nominal LEO');

    // Extreme Carrington-scale Solar Particle Event in Mars Transit
    const extremeSpe = await SolarRadService.recordRadiationLog({
      missionPhase: 'TRANSIT_MARS',
      speProtonFluxPfu: 15000.0,
      gcrDoseRateMsvDay: 1.6,
      cumulativeMissionDoseMsv: 180.0,
      evaActive: true
    });
    assert(extremeSpe.stormTier === 'BLACK_LETHAL_SPE' || extremeSpe.stormTier === 'RED_CRITICAL_STORM', `Storm tier is critical (actual: ${extremeSpe.stormTier})`);
    assert(extremeSpe.currentDoseRateMsvHour > 50.0, `Dose rate exceeds storm threshold (actual: ${extremeSpe.currentDoseRateMsvHour} mSv/h)`);
    assert(extremeSpe.shelterInPlaceRequired === true, 'Mandates water-wall / polyethylene storm shelter retreat');
    assert(extremeSpe.evaAbortImmediate === true, 'STAT Emergency EVA termination mandated');
    assert(extremeSpe.filgrastimIndicated === true, 'Filgrastim (G-CSF) prescribed for hematopoietic acute radiation syndrome');
    assert(extremeSpe.id !== undefined && extremeSpe.id > 0, `Solar radiation log persisted with ID ${extremeSpe.id}`);

    // -------------------------------------------------------------------------
    // Phase 108: MICROGRAV-RESUS
    // -------------------------------------------------------------------------
    console.log('\n[Phase 108: MICROGRAV-RESUS (Zero-G Resuscitation & Containment)]');

    // Biomechanical technique selection: Ceiling anchor
    const handstandResus = MicrogravResusService.evaluateResuscitation({
      patientId: 1,
      cardiacArrestPresent: true,
      rhythm: 'VFIB',
      ceilingAnchorAvailable: true,
      confinedSpaceCapsule: false,
      hemorrhagePresent: false
    });
    assert(handstandResus.cprTechnique === 'HANDSTAND_CPR', 'Ceiling anchor triggers HANDSTAND_CPR technique');
    assert(handstandResus.defibrillationGuidance.energyJoules === 200, 'Shockable rhythm prescribes 200J biphasic shock');

    // Confined space capsule technique
    const capsuleResus = MicrogravResusService.evaluateResuscitation({
      patientId: 1,
      cardiacArrestPresent: true,
      ceilingAnchorAvailable: false,
      confinedSpaceCapsule: true,
      hemorrhagePresent: false
    });
    assert(capsuleResus.cprTechnique === 'REVERSE_BEAR_HUG', 'Confined space capsule selects REVERSE_BEAR_HUG CPR');

    // Free-floating technique
    const freeFloatResus = MicrogravResusService.evaluateResuscitation({
      patientId: 1,
      cardiacArrestPresent: true,
      ceilingAnchorAvailable: false,
      confinedSpaceCapsule: false,
      hemorrhagePresent: false
    });
    assert(freeFloatResus.cprTechnique === 'EVETTS_RUSSOMANO_METHOD', 'Free-floating zero-g selects EVETTS_RUSSOMANO_METHOD');

    // Microgravity hemorrhage with autotransfusion and hermetic suction canopy
    const traumaResus = await MicrogravResusService.recordResusEvent({
      patientId: 1,
      cardiacArrestPresent: false,
      ceilingAnchorAvailable: true,
      confinedSpaceCapsule: false,
      hemorrhagePresent: true,
      hemorrhageType: 'ARTERIAL_BLEED',
      estimatedBloodLossMl: 800,
      canopyDeployed: true
    });
    assert(traumaResus.hermeticCanopyDeployed === true, 'Hermetic surgical canopy deployed for arterial hemorrhage');
    assert(traumaResus.laminarSuctionFlowLpm >= 60.0, 'Laminar negative-pressure suction active >= 60 LPM');
    assert(traumaResus.autotransfusionVolumeMl === 600, `Autotransfused volume correctly calculated at 75% recovery (actual: ${traumaResus.autotransfusionVolumeMl} mL)`);
    assert(traumaResus.id !== undefined && traumaResus.id > 0, `Microgravity resus event persisted with ID ${traumaResus.id}`);

    // -------------------------------------------------------------------------
    // Phase 109: ECLSS-HABITAT
    // -------------------------------------------------------------------------
    console.log('\n[Phase 109: ECLSS-HABITAT (Closed-Loop Life Support & Toxic Atmosphere)]');

    // Nominal exploration atmosphere (8.2 psia, 34% O2)
    const nominalHabitat = EclssHabitatService.evaluateHabitat({
      habitatModule: 'HAB_CORE_ALPHA',
      cabinPressurePsia: 8.2,
      pco2Mmhg: 1.5,
      o2Percentage: 34.0,
      liohSaturationPct: 20.0,
      ammoniaCoolantPpm: 0.0
    });
    assert(nominalHabitat.atmosphereStatus === 'OPTIMAL_NOMINAL', 'Exploration atmosphere evaluated as OPTIMAL_NOMINAL');

    // Severe Hypercapnia (PCO2 7.8 mmHg)
    const hypercapnicHabitat = EclssHabitatService.evaluateHabitat({
      habitatModule: 'AIRLOCK',
      cabinPressurePsia: 14.7,
      pco2Mmhg: 7.8,
      o2Percentage: 20.9,
      liohSaturationPct: 92.0,
      ammoniaCoolantPpm: 0.0
    });
    assert(hypercapnicHabitat.atmosphereStatus === 'HYPERCAPNIC_RISK', 'PCO2 >= 7.0 mmHg flagged as HYPERCAPNIC_RISK');
    assert(hypercapnicHabitat.systemDirectives.scrubberMode.includes('EMERGENCY'), 'Directs emergency secondary LiOH scrubber activation');

    // Toxic Ammonia Breach (65 ppm IDLH)
    const ammoniaBreach = await EclssHabitatService.recordHabitatTelemetry({
      habitatModule: 'LAB_MODULE_BETA',
      cabinPressurePsia: 14.7,
      pco2Mmhg: 2.1,
      o2Percentage: 20.9,
      liohSaturationPct: 40.0,
      ammoniaCoolantPpm: 65.0
    });
    assert(ammoniaBreach.atmosphereStatus === 'TOXIC_AMMONIA_EMERGENCY', 'Ammonia >= 50 ppm classified as TOXIC_AMMONIA_EMERGENCY');
    assert(ammoniaBreach.systemDirectives.maskStatus.includes('MANDATORY QUICK-DON MASK'), 'Directs mandatory Quick-Don mask donning within 5 seconds');
    assert(ammoniaBreach.correctiveActions.length >= 2, 'Multiple emergency containment actions generated');
    assert(ammoniaBreach.id !== undefined && ammoniaBreach.id > 0, `ECLSS telemetry persisted with ID ${ammoniaBreach.id}`);

    // -------------------------------------------------------------------------
    // Phase 110: DELAYED-COMMS-TELEMED
    // -------------------------------------------------------------------------
    console.log('\n[Phase 110: DELAYED-COMMS-TELEMED (Deep Space Autonomous Diagnostic Engine)]');

    // Latency calculation test for Mars average distance (1.524 AU)
    const latency = DeepSpaceTelemedService.calculateLatency(1.524);
    assert(latency.oneWayMinutes >= 12.0 && latency.oneWayMinutes <= 13.0, `One-way latency to Mars is ~12.68 minutes (actual: ${latency.oneWayMinutes})`);
    assert(latency.roundTripMinutes >= 25.0 && latency.roundTripMinutes <= 26.0, `Round-trip delay to Mars is ~25.35 minutes (actual: ${latency.roundTripMinutes})`);

    // Microgravity Nephrolithiasis case evaluation under 1.524 AU latency
    const telemedSession = await DeepSpaceTelemedService.recordTelemedSession({
      patientId: 1,
      missionDistanceAu: 1.524,
      symptoms: ['severe_right_flank_pain', 'microscopic_hematuria', 'bone_density_loss', 'nausea'],
      vitals: {
        heartRate: 104,
        systolicBp: 142,
        diastolicBp: 88,
        tempCelsius: 37.1,
        spo2Pct: 98
      },
      pocusFindings: ['hydronephrosis_right_kidney', 'acoustic_shadowing_ureteral_calculus'],
      onboardLabFindings: {
        serumCalciumMgDl: 11.4,
        hematuriaDipstick: true
      }
    });

    assert(telemedSession.clinicalAutonomyMandated === true, 'Autonomous clinical mode mandated due to comms latency >= 3 min');
    assert(telemedSession.primaryDiagnosis.includes('Nephrolithiasis'), `Primary diagnosis correctly identified as Spaceflight Nephrolithiasis (actual: ${telemedSession.primaryDiagnosis})`);
    assert(telemedSession.confidenceScorePct >= 60, `Bayesian confidence score is high (actual: ${telemedSession.confidenceScorePct}%)`);
    assert(telemedSession.onboardTreatmentPlan.pharmacotherapy.some(p => p.includes('Tamsulosin')), 'Prescribes Tamsulosin for ureteral smooth muscle relaxation');
    assert(telemedSession.onboardTreatmentPlan.pharmacotherapy.some(p => p.includes('Ketorolac')), 'Prescribes Ketorolac for capsular pain');
    assert(telemedSession.cryptographicSignature.length === 64, 'Generated 64-char SHA-256 HMAC cryptographic signature for Earth downlink burst');
    assert(telemedSession.id !== undefined && telemedSession.id > 0, `Telemedicine session persisted with ID ${telemedSession.id}`);

    console.log('\n=============================================================');
    console.log(`SUITE 7 (PHASES 106–110) TESTS COMPLETE: ${passed} passed, ${failed} failed.`);
    console.log('=============================================================\n');

  } catch (error) {
    console.error('Fatal test error in Suite 7:', error);
    process.exit(1);
  } finally {
    const { pool } = require('./db');
    await pool.end();
    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runSuite7Tests();
