import { BurnResusService } from './services/burnResus';
import { pool } from './db';

async function runTests() {
  console.log('=== RUNNING BURN-RESUS (PHASE 99) INTEGRATION TESTS ===\n');
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
    // -------------------------------------------------------------
    // Test 1: Rule of Nines Calculation & Exclusion of 1st-Degree Burns
    // -------------------------------------------------------------
    console.log('[Test 1] Rule of Nines Calculation & Exclusion of 1st-Degree Burns');
    const t1 = BurnResusService.evaluateBurnShock({
      patientId: 1,
      weightKg: 70,
      mechanism: 'THERMAL_FLAME',
      hoursSinceInjury: 0,
      tbsaBreakdown: {
        headNeck: 9, // 9%
        anteriorTrunk: 18, // 18%
        rightArm: 9, // 9%
        firstDegreeSunburnTbsa: 15 // Strictly excluded!
      }
    });

    assert(t1.calculatedTbsa === 36, `Calculated TBSA is 36% (actual: ${t1.calculatedTbsa}%)`);
    assert(t1.firstDegreeTbsaExcluded === 15, '15% superficial first degree sunburn excluded from formula');
    assert(t1.parklandFormula.total24hVolumeMl === 10080, `Parkland 24h volume is 10,080 mL (actual: ${t1.parklandFormula.total24hVolumeMl})`);

    // -------------------------------------------------------------
    // Test 2: Standard Parkland 24h & Burn Clock Onset
    // -------------------------------------------------------------
    console.log('\n[Test 2] Parkland-Baxter Formulation at Hour 0');
    const t2 = BurnResusService.evaluateBurnShock({
      patientId: 1,
      weightKg: 80,
      mechanism: 'THERMAL_FLAME',
      hoursSinceInjury: 0,
      totalTbsaPercentage: 40
    });

    // 4 mL x 80 kg x 40% = 12,800 mL
    assert(t2.parklandFormula.total24hVolumeMl === 12800, 'Calculated 12,800 mL total 24h volume');
    // First 8h volume = 6,400 mL -> 800 mL/h
    assert(t2.parklandFormula.first8hRateMlH === 800, `First 8h rate is 800 mL/h (actual: ${t2.parklandFormula.first8hRateMlH})`);
    // Next 16h volume = 6,400 mL -> 400 mL/h
    assert(t2.parklandFormula.next16hRateMlH === 400, `Next 16h rate is 400 mL/h (actual: ${t2.parklandFormula.next16hRateMlH})`);

    // -------------------------------------------------------------
    // Test 3: The Burn Clock Offset (Late Arrival at Hour 3)
    // -------------------------------------------------------------
    console.log('\n[Test 3] Burn Clock Offset: Delayed Presentation 3 Hours Post-Injury');
    const t3 = BurnResusService.evaluateBurnShock({
      patientId: 1,
      weightKg: 80,
      mechanism: 'THERMAL_FLAME',
      hoursSinceInjury: 3.0,
      totalTbsaPercentage: 40,
      prehospitalFluidReceivedMl: 1000 // received 1000 mL in transit
    });

    // Total first 8h target = 6,400 mL. Remaining = 6,400 - 1,000 = 5,400 mL.
    // Remaining time in 8-hour window = 8 - 3 = 5 hours.
    // Rate = 5,400 / 5 = 1,080 mL/h.
    assert(t3.parklandFormula.remainingFirst8hHours === 5.0, 'Remaining time in 8h block is 5.0 hours');
    assert(t3.parklandFormula.first8hRateMlH === 1080, `Accelerated initial rate is 1,080 mL/h (actual: ${t3.parklandFormula.first8hRateMlH})`);
    assert(t3.protocolDirectives.some(d => d.includes('Initial rate accelerated to 1080 mL/h')), 'Issues directive regarding accelerated initial rate');

    // -------------------------------------------------------------
    // Test 4: Pediatric Burn Resuscitation (3 mL/kg/%TBSA)
    // -------------------------------------------------------------
    console.log('\n[Test 4] Pediatric Burn Resuscitation (Weight 20 kg, 25% TBSA)');
    const t4 = BurnResusService.evaluateBurnShock({
      patientId: 1,
      weightKg: 20,
      isPediatric: true,
      mechanism: 'SCALD',
      hoursSinceInjury: 1.0,
      totalTbsaPercentage: 25
    });

    // 3 mL x 20 kg x 25% = 1,500 mL
    assert(t4.parklandFormula.coefficientMlPerKgPct === 3.0, 'Pediatric coefficient set to 3.0 mL/kg/%TBSA');
    assert(t4.parklandFormula.total24hVolumeMl === 1500, 'Calculated 1,500 mL total 24h volume');
    assert(t4.targetUrineOutput.targetRangeMlKgH === '1.0 - 1.5 mL/kg/h', 'Pediatric target UO is 1.0 - 1.5 mL/kg/h');

    // -------------------------------------------------------------
    // Test 5: Electrical Burn & Pigmenturia Target (1.5 - 2.0 mL/kg/h)
    // -------------------------------------------------------------
    console.log('\n[Test 5] High-Voltage Electrical Burn & Pigmenturia UO Target');
    const t5 = BurnResusService.evaluateBurnShock({
      patientId: 1,
      weightKg: 75,
      mechanism: 'ELECTRICAL_HIGH_VOLTAGE',
      hoursSinceInjury: 1.0,
      totalTbsaPercentage: 15,
      pigmenturiaOrRhabdo: true
    });

    assert(t5.targetUrineOutput.targetRangeMlKgH.includes('1.5 - 2.0 mL/kg/h'), 'Target UO elevated to 1.5 - 2.0 mL/kg/h for electrical injury/pigmenturia');
    assert(t5.targetUrineOutput.targetMinMlH >= 75, 'Minimum hourly UO floor is at least 75 mL/h');
    assert(t5.protocolDirectives.some(d => d.includes('flush toxic myoglobin/hemoglobin casts') || d.includes('Electrical/Pigmenturia Target')), 'Directs flushing myoglobin casts to prevent ATN');

    // -------------------------------------------------------------
    // Test 6: Inhalation Injury, Carbon Monoxide & Cyanide Toxicity
    // -------------------------------------------------------------
    console.log('\n[Test 6] Smoke Inhalation: Severe Airway Signs, COHb & Cyanide Toxicity');
    const t6 = BurnResusService.evaluateBurnShock({
      patientId: 1,
      weightKg: 70,
      mechanism: 'THERMAL_FLAME',
      hoursSinceInjury: 1.5,
      totalTbsaPercentage: 45,
      inhalationInjurySigns: ['singed_nasal_hairs', 'carbonaceous_sputum', 'enclosed_space', 'stridor_hoarseness'],
      carboxyhemoglobinPct: 26,
      serumLactateMmolL: 9.8
    });

    assert(t6.inhalationInjuryPlan.intubationIndicated === true, 'Emergent endotracheal intubation indicated');
    assert(t6.inhalationInjuryPlan.fio2Protocol.includes('100% FiO2'), 'Orders continuous 100% FiO2');
    assert(t6.inhalationInjuryPlan.coHalfLifeEstimate.includes('reduces COHb half-life from 300 min to 45-60 min'), 'Explains COHb half-life reduction with 100% O2');
    assert(t6.inhalationInjuryPlan.cyanideAntidoteIndicated === true, 'Cyanide toxicity suspected from enclosed space and lactate 9.8');
    assert(Boolean(t6.inhalationInjuryPlan.cyanideAntidoteDose?.includes('Hydroxocobalamin (Cyanokit) 5.0 g IV')), 'Prescribes Hydroxocobalamin 5g IV infusion');

    // -------------------------------------------------------------
    // Test 7: Circumferential Burns & Bedside Escharotomy Guidance
    // -------------------------------------------------------------
    console.log('\n[Test 7] Circumferential Torso/Limb Burns & Bedside Escharotomy');
    const t7 = BurnResusService.evaluateBurnShock({
      patientId: 1,
      weightKg: 70,
      mechanism: 'THERMAL_FLAME',
      hoursSinceInjury: 2.0,
      totalTbsaPercentage: 35,
      circumferentialBurnLimbsOrTorso: true
    });

    assert(t7.compartmentSyndromeAndEscharotomy.escharotomyIndicated === true, 'Escharotomy indicated for circumferential burns');
    assert(t7.compartmentSyndromeAndEscharotomy.locationGuidance.some(l => l.includes('Mid-axillary bilateral vertical incisions')), 'Provides torso shield incision guidance');
    assert(t7.compartmentSyndromeAndEscharotomy.locationGuidance.some(l => l.includes('ulnar and common peroneal nerves')), 'Warns to avoid ulnar and common peroneal nerves during limb escharotomy');

    // -------------------------------------------------------------
    // Test 8: Hourly Fluid Titration: Under-Resuscitation (Oliguria)
    // -------------------------------------------------------------
    console.log('\n[Test 8] Hourly Titration: Oliguria (Increase Rate by 25%)');
    const log1 = BurnResusService.evaluateHourlyTitration({
      patientId: 1,
      weightKg: 80,
      hourPostBurn: 3,
      currentLrRateMlH: 800,
      urineOutputMl: 25, // 25 / 80 = 0.31 mL/kg/h (< 0.5)
      cumulativeFluidMl: 2400
    });

    assert(log1.titrationAction === 'INCREASE_20_PCT', 'Action is INCREASE_20_PCT');
    assert(log1.newLrRateMlH === 1000, `New rate is 1,000 mL/h (+25%) (actual: ${log1.newLrRateMlH})`);
    assert(log1.clinicalDirective.includes('Increase Lactated Ringer\'s rate by 25%'), 'Directs 25% rate increase');

    // -------------------------------------------------------------
    // Test 9: Hourly Fluid Titration: Over-Resuscitation (Decrease Rate)
    // -------------------------------------------------------------
    console.log('\n[Test 9] Hourly Titration: Excessive UO (Decrease Rate by 20%)');
    const log2 = BurnResusService.evaluateHourlyTitration({
      patientId: 1,
      weightKg: 70,
      hourPostBurn: 5,
      currentLrRateMlH: 600,
      urineOutputMl: 95, // 95 / 70 = 1.36 mL/kg/h (> 1.0)
      cumulativeFluidMl: 3500
    });

    assert(log2.titrationAction === 'DECREASE_20_PCT', 'Action is DECREASE_20_PCT');
    assert(log2.newLrRateMlH === 480, `New rate is 480 mL/h (-20%) (actual: ${log2.newLrRateMlH})`);

    // -------------------------------------------------------------
    // Test 10: Fluid Creep & Abdominal Compartment Syndrome (ACS Alert)
    // -------------------------------------------------------------
    console.log('\n[Test 10] Fluid Creep & Bladder Pressure >= 20 mmHg (Stat Albumin Rescue)');
    const log3 = BurnResusService.evaluateHourlyTitration({
      patientId: 1,
      weightKg: 70,
      hourPostBurn: 14,
      currentLrRateMlH: 700,
      urineOutputMl: 28, // 0.4 mL/kg/h
      bladderPressureMmhg: 22.0, // >= 20 mmHg
      cumulativeFluidMl: 18000 // 257 mL/kg (> 250 mL/kg)
    });

    assert(log3.fluidCreepFlag === 'SEVERE_ACS_RISK', 'Classified as SEVERE_ACS_RISK');
    assert(log3.titrationAction === 'STAT_ALBUMIN_RESCUE', 'Action is STAT_ALBUMIN_RESCUE');
    assert(log3.clinicalDirective.includes('Abdominal Compartment Syndrome developing'), 'Alerts to developing Abdominal Compartment Syndrome');
    assert(log3.clinicalDirective.includes('5% Albumin rescue infusion'), 'Orders 5% Albumin rescue infusion to decrease crystalloid volume');

    // -------------------------------------------------------------
    // Test 11: Database Persistence of Encounters & Titration Logs
    // -------------------------------------------------------------
    console.log('\n[Test 11] Database Persistence for Burn Encounters & Titration Logs');
    
    // Ensure test patient exists
    const patientCheck = await pool.query('SELECT id FROM patients WHERE id = 1');
    if (patientCheck.rowCount === 0) {
      await pool.query(`
        INSERT INTO patients (id, name, email, password_hash, dob, sex)
        VALUES (1, 'Test Burn Patient', 'burnpatient@example.com', 'hash123', '1990-08-20', 'Male')
        ON CONFLICT (id) DO NOTHING;
      `);
    }

    const savedEncId = await BurnResusService.persistBurnEncounter(t2);
    assert(typeof savedEncId === 'number' && savedEncId > 0, `Burn encounter persisted with ID ${savedEncId}`);

    const savedLogId = await BurnResusService.persistTitrationLog({
      ...log1,
      encounterId: savedEncId
    });
    assert(typeof savedLogId === 'number' && savedLogId > 0, `Titration log persisted with ID ${savedLogId}`);

    const encounters = await BurnResusService.getBurnEncounters(1);
    assert(encounters.length > 0, `Retrieved ${encounters.length} burn encounter(s) for patient 1`);

    const logs = await BurnResusService.getTitrationLogs(1);
    assert(logs.length > 0, `Retrieved ${logs.length} titration log(s) for patient 1`);

    console.log(`\n=============================================================`);
    console.log(`BURN-RESUS TEST SUITE FINISHED: ${passed} PASSED, ${failed} FAILED`);
    console.log(`=============================================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Unhandled test exception:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
