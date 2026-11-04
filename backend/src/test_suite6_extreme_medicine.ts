import { MassCasualtyTriageService } from './services/massCasualtyTriage';
import { FlightCritService } from './services/flightCrit';
import { DivingHyperbaricService } from './services/divingHyperbaric';
import { ProlongedFieldCareService } from './services/prolongedFieldCare';
import { CyberGridBlackoutService } from './services/cyberGridBlackout';
import { pool } from './db';

async function runTests() {
  console.log('=== RUNNING SUITE 6: DISASTER, FLIGHT & EXTREME-ENVIRONMENT MEDICINE (PHASES 101–105) TESTS ===\n');
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

  try {
    // ------------------------------------------------------------------------
    // PHASE 101: MASS-CASUALTY-TRIAGE
    // ------------------------------------------------------------------------
    console.log('[Phase 101: MASS-CASUALTY-TRIAGE]');
    const incId = `MCI-TEST-${Date.now()}`;

    // Casualty 1: Green (Walking wounded)
    const c1 = await MassCasualtyTriageService.triageAndPersist({
      incidentId: incId,
      casualtyNumber: 1,
      canWalk: true,
      spontaneousBreathing: true,
      radialPulsePresent: true,
      obeysCommands: true
    });
    assert(c1.triageCategory === 'GREEN_MINIMAL', 'Walking casualty categorized as GREEN_MINIMAL');
    assert(c1.priorityRank === 3, 'Priority rank is 3');

    // Casualty 2: Red (Tension pneumothorax / absent pulse)
    const c2 = await MassCasualtyTriageService.triageAndPersist({
      incidentId: incId,
      casualtyNumber: 2,
      canWalk: false,
      spontaneousBreathing: true,
      respiratoryRate: 36,
      radialPulsePresent: false,
      obeysCommands: false,
      hasChestDecompressionNeeded: true
    });
    assert(c2.triageCategory === 'RED_IMMEDIATE', 'Tachypneic/shock casualty categorized as RED_IMMEDIATE');
    assert(c2.priorityRank === 1, 'Priority rank is 1');
    assert(c2.lifeSavingInterventions.some(l => l.includes('thoracostomy')), 'Directs needle thoracostomy for decompression');

    // Casualty 3: Black (Apneic)
    const c3 = await MassCasualtyTriageService.triageAndPersist({
      incidentId: incId,
      casualtyNumber: 3,
      canWalk: false,
      spontaneousBreathing: false,
      radialPulsePresent: false,
      obeysCommands: false
    });
    assert(c3.triageCategory === 'BLACK_EXPECTANT', 'Apneic casualty categorized as BLACK_EXPECTANT');

    // Casualty 4: Yellow (Delayed)
    const c4 = await MassCasualtyTriageService.triageAndPersist({
      incidentId: incId,
      casualtyNumber: 4,
      canWalk: false,
      spontaneousBreathing: true,
      respiratoryRate: 18,
      radialPulsePresent: true,
      obeysCommands: true
    });
    assert(c4.triageCategory === 'YELLOW_DELAYED', 'Non-walking but physiologically intact categorized as YELLOW_DELAYED');

    // ICS Summary
    const ics = await MassCasualtyTriageService.getIncidentSummary(incId);
    assert(ics.totalCasualties === 4, 'Incident summary reports exactly 4 casualties');
    assert(ics.categoryBreakdown.RED_IMMEDIATE === 1, '1 Red casualty');
    assert(ics.categoryBreakdown.YELLOW_DELAYED === 1, '1 Yellow casualty');
    assert(ics.categoryBreakdown.GREEN_MINIMAL === 1, '1 Green casualty');
    assert(ics.categoryBreakdown.BLACK_EXPECTANT === 1, '1 Black casualty');

    // ------------------------------------------------------------------------
    // PHASE 102: FLIGHT-CRIT
    // ------------------------------------------------------------------------
    console.log('\n[Phase 102: FLIGHT-CRIT (Aeromedical Flight Physiology)]');
    const f1 = await FlightCritService.evaluateAndPersist({
      patientId: 1,
      aircraftType: 'FIXED_WING_PRESSURIZED',
      cruisingAltitudeFt: 25000,
      cabinAltitudeFt: 8000,
      paO2SeaLevelMmhg: 95,
      fiO2: 0.21,
      baselineMapMmhg: 85,
      baselineIcpMmhg: 14,
      pneumothoraxPresent: true,
      chestTubeInPlace: false, // Untreated pneumothorax!
      ettCuffAirFilled: true,
      accelerationGVector: '+Gz'
    });

    assert(f1.gasExpansionRatio >= 1.25, `Boyle's law gas expands >= 25% at 8,000 ft (actual: ${f1.gasExpansionRatio})`);
    assert(f1.flightRiskTier === 'CRITICAL', 'Flight risk tier is CRITICAL due to untreated pneumothorax');
    assert(f1.cabinAltitudeRestrictionMandated === true, 'Cabin Altitude Restriction (CAR) mandated');
    assert(f1.flightDirectives.some(d => d.includes('Untreated pneumothorax will expand')), 'Flags untreated pneumothorax danger');
    assert(f1.flightDirectives.some(d => d.includes('sterile saline')), 'Directs ETT cuff replacement with sterile water/saline');

    // ------------------------------------------------------------------------
    // PHASE 103: DIVING-HYPERBARIC
    // ------------------------------------------------------------------------
    console.log('\n[Phase 103: DIVING-HYPERBARIC (US Navy Decompression Protocols)]');
    const h1 = await DivingHyperbaricService.evaluateAndPersist({
      patientId: 2,
      diagnosis: 'ARTERIAL_GAS_EMBOLISM',
      diveDepthMsw: 30,
      bottomTimeMin: 45,
      timeToSymptomOnsetMin: 4,
      symptoms: ['Right hemiplegia', 'Aphasia', 'Loss of consciousness'],
      rapidAscentReported: true,
      surfaceOxygenStarted: false
    });

    assert(h1.recommendedTable === 'US_NAVY_TABLE_6', 'Recommends US Navy Treatment Table 6 for AGE');
    assert(h1.maximumChamberPressureAta === 2.8, 'Chamber pressure targets 2.8 ATA (60 fsw)');
    assert(h1.totalChamberDurationMin === 285, 'Table 6 duration is 285 minutes');
    assert(h1.flyingBanHours === 72, 'Strict 72-hour commercial flight ban mandated');
    assert(h1.surfaceWashoutDirectives.some(d => d.includes('100% Normobaric Oxygen')), 'Directs immediate normobaric 100% O2 surface washout');

    // ------------------------------------------------------------------------
    // PHASE 104: TACTICAL-PROLONGED-FIELD-CARE
    // ------------------------------------------------------------------------
    console.log('\n[Phase 104: TACTICAL-PROLONGED-FIELD-CARE (PFC 72h)]');
    const pfc = await ProlongedFieldCareService.evaluateAndPersist({
      patientId: 3,
      fieldHour: 18,
      totalPfcHoursPlanned: 72,
      systolicBp: 82,
      meanArterialPressure: 56, // Shock
      hourlyUrineOutputMlKgH: 0.22, // Oliguric
      coreTempCelsius: 34.8, // Hypothermic!
      wholeBloodUnitsTransfused: 1,
      activeWarmingApplied: false,
      antibioticGiven: false,
      wbbDonorsAvailable: [
        { donorId: 'D1', name: 'SGT Miller', bloodType: 'O', rhFactor: '+', eldonCardVerified: true, transfusionStatus: 'AVAILABLE' }
      ]
    });

    assert(pfc.resuscitationStatus === 'HYPOTHERMIC_COAGULOPATHIC', 'Identifies lethal hypothermic status');
    assert(pfc.wbbActivationMandated === true, 'Mandates Walking Blood Bank (WBB) activation');
    assert(pfc.wbbEligibleDonorsCount === 1, 'Recognizes 1 eligible pre-screened donor');
    assert(Boolean(pfc.hypothermiaAlert && pfc.hypothermiaAlert.includes('CRITICAL HYPOTHERMIA')), 'Flags critical hypothermia alert');
    assert(pfc.pfcChecklist.some(c => c.includes('Ertapenem')), 'Directs Ertapenem antibiotic prophylaxis');

    // ------------------------------------------------------------------------
    // PHASE 105: CYBER-GRID-BLACKOUT
    // ------------------------------------------------------------------------
    console.log('\n[Phase 105: CYBER-GRID-BLACKOUT (Zero-Trust Mesh & Offline Fallback)]');
    const black = await CyberGridBlackoutService.evaluateAndPersist({
      nodeId: 'NODE-ICU-CENTURY-01',
      facilityZone: 'Trauma & Century Critical Care Wing',
      isGridPowerAvailable: false,
      generatorFuelGallons: 420,
      generatorLoadKw: 150,
      upsBatteryCapacityMinutes: 90,
      activeIcuVentilators: 12,
      ventilatorsOnPneumaticFallback: 6,
      offlinePeerNodeIds: ['NODE-OR-01', 'NODE-ED-01', 'NODE-BLOOD-01', 'NODE-PHARM-01']
    });

    assert(black.systemAlertLevel === 'RED_BLACKOUT_OPERATIONAL', 'Classified as RED_BLACKOUT_OPERATIONAL');
    assert(black.estimatedGeneratorRuntimeHours > 30, `Calculated generator fuel runtime > 30 hours (actual: ${black.estimatedGeneratorRuntimeHours}h)`);
    assert(black.loadSheddingDirectives.length >= 3, 'Provides 3 tiers of emergency load shedding directives');
    assert(black.sampleGravityDrips.length === 4, 'Calculates manual gravity IV drip rates for 4 critical medications');
    
    const nsDrip = black.sampleGravityDrips.find(d => d.medicationName.includes('Normal Saline'));
    assert(nsDrip?.calculatedDripsPerMinute === 31, `125 mL/h @ 15 gtt/mL is exactly 31 drips/min (actual: ${nsDrip?.calculatedDripsPerMinute})`);

    const levoDrip = black.sampleGravityDrips.find(d => d.medicationName.includes('Norepinephrine'));
    assert(levoDrip?.calculatedDripsPerMinute === 30, `30 mL/h @ 60 gtt/mL microdrip is exactly 30 drips/min (actual: ${levoDrip?.calculatedDripsPerMinute})`);

    assert(black.meshSyncState.syncHash.length === 32, 'Zero-trust cryptographic mesh sync hash generated');

    console.log(`\n=============================================================`);
    console.log(`SUITE 6 (PHASES 101-105) TESTS COMPLETE: ${passed} passed, ${failed} failed.`);
    console.log(`=============================================================`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during Suite 6 test execution:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
