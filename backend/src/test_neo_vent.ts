import {
  calculateSurfactantDose,
  evaluateNeonatalVentilation,
  saveNeonatalVentRecord,
  getPatientVentRecords,
  saveSurfactantLog,
  getPatientSurfactantLogs
} from './services/neoVent';
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
  console.log('\n=== RUNNING NEO-VENT TEST SUITE (PHASE 88) ===\n');

  try {
    // ----------------------------------------------------
    // TEST SUITE 1: SURFACTANT REPLACEMENT THERAPY
    // ----------------------------------------------------
    console.log('--- 1. Surfactant Replacement Therapy Engine ---');

    // Poractant Alfa Initial Dose (200 mg/kg, 80 mg/mL = 2.5 mL/kg)
    const curosurfDose1 = calculateSurfactantDose({
      patientId: 1,
      currentWeightKg: 1.0,
      surfactantType: 'PORACTANT_ALFA',
      doseNumber: 1,
      deliveryTechnique: 'LISA',
      preFio2: 0.40,
      onCpap: true
    });
    assert(curosurfDose1.doseMgPerKg === 200, 'Poractant alfa dose 1 is 200 mg/kg');
    assert(curosurfDose1.totalMg === 200, 'Total mg for 1.0kg is 200 mg');
    assert(curosurfDose1.totalVolumeMl === 2.5, 'Total volume is 2.5 mL');
    assert(curosurfDose1.lisaFeasibility.feasible === true, 'LISA is feasible for spontaneous breathing infant on CPAP with FiO2 >= 0.30');

    // Poractant Alfa Repeat Dose (100 mg/kg, 80 mg/mL = 1.25 mL/kg)
    const curosurfDose2 = calculateSurfactantDose({
      patientId: 1,
      currentWeightKg: 1.2,
      surfactantType: 'PORACTANT_ALFA',
      doseNumber: 2,
      deliveryTechnique: 'INSURE',
      preFio2: 0.35,
      onCpap: false
    });
    assert(curosurfDose2.doseMgPerKg === 100, 'Poractant alfa repeat dose is 100 mg/kg');
    assert(curosurfDose2.totalVolumeMl === 1.5, 'Total volume for 1.2kg repeat dose is 1.5 mL');

    // Beractant (Survanta: 100 mg/kg, 25 mg/mL = 4.0 mL/kg)
    const beractantDose = calculateSurfactantDose({
      patientId: 1,
      currentWeightKg: 1.5,
      surfactantType: 'BERACTANT',
      doseNumber: 1,
      deliveryTechnique: 'STANDARD_ETT',
      preFio2: 0.50,
      onCpap: false
    });
    assert(beractantDose.doseMgPerKg === 100, 'Beractant is 100 mg/kg');
    assert(beractantDose.totalVolumeMl === 6.0, 'Beractant volume for 1.5kg is 6.0 mL (4.0 mL/kg)');

    // Calfactant (Infasurf: 105 mg/kg, 35 mg/mL = 3.0 mL/kg)
    const calfactantDose = calculateSurfactantDose({
      patientId: 1,
      currentWeightKg: 2.0,
      surfactantType: 'CALFACTANT',
      doseNumber: 1,
      deliveryTechnique: 'STANDARD_ETT',
      preFio2: 0.45,
      onCpap: false
    });
    assert(calfactantDose.doseMgPerKg === 105, 'Calfactant is 105 mg/kg');
    assert(calfactantDose.totalVolumeMl === 6.0, 'Calfactant volume for 2.0kg is 6.0 mL (3.0 mL/kg)');

    // ----------------------------------------------------
    // TEST SUITE 2: STRATIFICATION & PERMISSIVE HYPERCAPNIA
    // ----------------------------------------------------
    console.log('\n--- 2. Neonatal Stratification & Gas Exchange Targets ---');

    // Case 1: Extreme Preterm ELBW (25 weeks, 750g)
    const elbwEval = evaluateNeonatalVentilation({
      patientId: 1,
      gestationalAgeWeeks: 25.4,
      birthWeightGrams: 750,
      currentWeightGrams: 720,
      postnatalAgeDays: 3,
      diagnosis: 'RDS',
      settings: {
        mode: 'SIMV_VG',
        fio2: 0.28,
        peepMmh2o: 6,
        pipMmh2o: 18,
        tidalVolumeMlPerKg: 4.5,
        rateBpm: 45
      },
      bloodGas: {
        pH: 7.29,
        pCO2: 52,
        pO2: 58,
        spO2: 92
      }
    });
    assert(elbwEval.gestationalCategory === 'EXTREME_PRETERM', '25 weeks is EXTREME_PRETERM');
    assert(elbwEval.weightCategory === 'ELBW', '750g is ELBW');
    assert(elbwEval.targetSpo2Range.includes('90% - 95%'), 'Target SpO2 for preterm is 90% - 95% (ROP prevention)');
    assert(elbwEval.bloodGasInterpretation.includes('permissive hypercapnia'), 'pH 7.29 & pCO2 52 identified as ideal permissive hypercapnia');

    // Case 2: Term Infant MAS
    const termEval = evaluateNeonatalVentilation({
      patientId: 1,
      gestationalAgeWeeks: 39.2,
      birthWeightGrams: 3400,
      currentWeightGrams: 3350,
      postnatalAgeDays: 1,
      diagnosis: 'MAS',
      settings: {
        mode: 'SIMV_VG',
        fio2: 0.40,
        peepMmh2o: 6,
        pipMmh2o: 24,
        tidalVolumeMlPerKg: 5.5,
        rateBpm: 35
      },
      bloodGas: {
        pH: 7.36,
        pCO2: 44,
        pO2: 82,
        spO2: 96
      }
    });
    assert(termEval.gestationalCategory === 'TERM', '39 weeks is TERM');
    assert(termEval.weightCategory === 'NORMAL_BIRTH_WEIGHT', '3400g is NORMAL_BIRTH_WEIGHT');
    assert(termEval.targetSpo2Range.includes('92% - 98%'), 'Target SpO2 for term is 92% - 98%');

    // ----------------------------------------------------
    // TEST SUITE 3: VENTILATOR PHYSICS & ADJUSTMENTS
    // ----------------------------------------------------
    console.log('\n--- 3. Ventilatory Physics & Acid-Base Adjustments ---');

    // Sub-case 3A: Severe Respiratory Acidosis (SIMV_VG)
    const severeAcidosis = evaluateNeonatalVentilation({
      patientId: 1,
      gestationalAgeWeeks: 27.0,
      birthWeightGrams: 900,
      currentWeightGrams: 890,
      postnatalAgeDays: 2,
      diagnosis: 'RDS',
      settings: {
        mode: 'SIMV_VG',
        fio2: 0.35,
        peepMmh2o: 5,
        tidalVolumeMlPerKg: 4.0,
        rateBpm: 40
      },
      bloodGas: {
        pH: 7.14,
        pCO2: 78,
        pO2: 52,
        spO2: 91
      }
    });
    assert(severeAcidosis.bloodGasInterpretation.includes('Severe uncompensated respiratory acidosis'), 'Identifies severe respiratory acidosis');
    assert(severeAcidosis.ventAdjustments.some(a => a.parameter.includes('Tidal Volume')), 'Recommends increasing Vt');
    assert(severeAcidosis.ventAdjustments.some(a => a.parameter.includes('Rate')), 'Recommends increasing rate');

    // Sub-case 3B: Severe Respiratory Acidosis on HFOV
    const hfovAcidosis = evaluateNeonatalVentilation({
      patientId: 1,
      gestationalAgeWeeks: 26.0,
      birthWeightGrams: 800,
      currentWeightGrams: 800,
      postnatalAgeDays: 1,
      diagnosis: 'RDS',
      settings: {
        mode: 'HFOV',
        fio2: 0.40,
        mapMmh2o: 12,
        frequencyHz: 12,
        amplitudeDeltaP: 24
      },
      bloodGas: {
        pH: 7.18,
        pCO2: 72,
        pO2: 60,
        spO2: 93
      }
    });
    assert(hfovAcidosis.ventAdjustments.some(a => a.parameter.includes('Amplitude') && a.recommendedChange.includes('Increase')), 'HFOV: Recommends increasing Amplitude for CO2 clearance');
    assert(hfovAcidosis.ventAdjustments.some(a => a.parameter.includes('Frequency') && a.recommendedChange.includes('Decrease frequency')), 'HFOV: Recommends decreasing frequency (Hz) to clear CO2');

    // Sub-case 3C: Hypocarbia Alert (Preterm PVL prevention)
    const hypocarbiaCase = evaluateNeonatalVentilation({
      patientId: 1,
      gestationalAgeWeeks: 28.0,
      birthWeightGrams: 1100,
      currentWeightGrams: 1100,
      postnatalAgeDays: 4,
      diagnosis: 'RDS',
      settings: {
        mode: 'SIMV_VG',
        fio2: 0.25,
        tidalVolumeMlPerKg: 5.5,
        rateBpm: 50
      },
      bloodGas: {
        pH: 7.55,
        pCO2: 28,
        pO2: 75,
        spO2: 95
      }
    });
    assert(hypocarbiaCase.clinicalDirectives.some(d => d.includes('hypocarbia') && d.includes('PVL')), 'Triggers urgent warning against hypocarbia and PVL');
    assert(hypocarbiaCase.ventAdjustments.some(a => a.parameter.includes('Tidal Volume') && a.recommendedChange.includes('Decrease')), 'Recommends weaning Vt to allow CO2 accumulation');

    // Sub-case 3D: Hyperoxia Alert in Preterm
    const hyperoxiaCase = evaluateNeonatalVentilation({
      patientId: 1,
      gestationalAgeWeeks: 27.5,
      birthWeightGrams: 950,
      currentWeightGrams: 940,
      postnatalAgeDays: 2,
      diagnosis: 'RDS',
      settings: {
        mode: 'CPAP',
        fio2: 0.45
      },
      bloodGas: {
        pH: 7.34,
        pCO2: 48,
        pO2: 95,
        spO2: 99
      }
    });
    assert(hyperoxiaCase.ventAdjustments.some(a => a.parameter === 'FiO2' && a.rationale.includes('Retinopathy of Prematurity')), 'Triggers FiO2 weaning to prevent ROP in preterm');

    // ----------------------------------------------------
    // TEST SUITE 4: OXYGENATION INDEX (OI) SEVERITY TIERS
    // ----------------------------------------------------
    console.log('\n--- 4. Oxygenation Index (OI) Severity & ECMO Alerts ---');

    // Mild OI (< 10)
    const mildOi = evaluateNeonatalVentilation({
      patientId: 1,
      gestationalAgeWeeks: 38.0,
      birthWeightGrams: 3100,
      currentWeightGrams: 3100,
      postnatalAgeDays: 1,
      diagnosis: 'TTN',
      settings: { mode: 'HFOV', mapMmh2o: 10, fio2: 0.40 },
      bloodGas: { pH: 7.35, pCO2: 45, pO2: 65, spO2: 94 }
    });
    assert(mildOi.oxygenationIndex !== undefined && mildOi.oxygenationIndex < 10, `Mild OI is ${mildOi.oxygenationIndex}`);
    assert(mildOi.oxygenationIndexSeverity === 'NORMAL_OR_MILD', 'OI < 10 is NORMAL_OR_MILD');

    // Severe OI (15 - 25: iNO indication)
    const severeOi = evaluateNeonatalVentilation({
      patientId: 1,
      gestationalAgeWeeks: 39.0,
      birthWeightGrams: 3500,
      currentWeightGrams: 3500,
      postnatalAgeDays: 1,
      diagnosis: 'PPHN',
      settings: { mode: 'HFOV', mapMmh2o: 16, fio2: 0.80 },
      bloodGas: { pH: 7.28, pCO2: 48, pO2: 55, spO2: 88 }
    });
    assert(severeOi.oxygenationIndexSeverity === 'SEVERE_INO_INDICATION', 'OI 23.3 is SEVERE_INO_INDICATION');
    assert(severeOi.clinicalDirectives.some(d => d.includes('inhaled Nitric Oxide (iNO at 20 ppm)')), 'Indicates iNO therapy');

    // Critical OI (>= 25: ECMO alert)
    const criticalOi = evaluateNeonatalVentilation({
      patientId: 1,
      gestationalAgeWeeks: 40.0,
      birthWeightGrams: 3600,
      currentWeightGrams: 3600,
      postnatalAgeDays: 2,
      diagnosis: 'MAS',
      settings: { mode: 'HFOV', mapMmh2o: 20, fio2: 1.00 },
      bloodGas: { pH: 7.18, pCO2: 55, pO2: 45, spO2: 78 }
    });
    assert(criticalOi.oxygenationIndexSeverity === 'CRITICAL_ECMO_THRESHOLD', 'OI 44.4 is CRITICAL_ECMO_THRESHOLD');
    assert(criticalOi.clinicalDirectives.some(d => d.includes('Neonatal ECMO team')), 'Alerts Neonatal ECMO team');

    // ----------------------------------------------------
    // TEST SUITE 5: DATABASE PERSISTENCE
    // ----------------------------------------------------
    console.log('\n--- 5. Database Persistence & Log Retrieval ---');

    const pRes = await pool.query('SELECT id FROM patients LIMIT 1');
    let testPatientId = 1;
    if (pRes.rows.length > 0) testPatientId = pRes.rows[0].id;

    // Save Vent Record
    const savedVent = await saveNeonatalVentRecord({
      patientId: testPatientId,
      gestationalAgeWeeks: 25.4,
      birthWeightGrams: 750,
      currentWeightGrams: 720,
      postnatalAgeDays: 3,
      diagnosis: 'RDS',
      settings: { mode: 'SIMV_VG', fio2: 0.28 },
      bloodGas: { pH: 7.29, pCO2: 52, pO2: 58, spO2: 92 },
      ...elbwEval
    });
    assert(savedVent && savedVent.id > 0, `Neonatal vent record saved with ID ${savedVent?.id}`);

    const retrievedVents = await getPatientVentRecords(testPatientId);
    assert(retrievedVents.length > 0, `Retrieved ${retrievedVents.length} neonatal vent records`);

    // Save Surfactant Log
    const savedSurfactant = await saveSurfactantLog({
      patientId: testPatientId,
      currentWeightKg: 1.0,
      preFio2: 0.40,
      onCpap: true,
      postFio2: 0.25,
      complications: ['Transient bradycardia during catheter insertion, resolved spontaneously'],
      ...curosurfDose1
    });
    assert(savedSurfactant && savedSurfactant.id > 0, `Surfactant log saved with ID ${savedSurfactant?.id}`);

    const retrievedSurfactants = await getPatientSurfactantLogs(testPatientId);
    assert(retrievedSurfactants.length > 0, `Retrieved ${retrievedSurfactants.length} surfactant administration logs`);

    console.log(`\n========================================`);
    console.log(`NEO-VENT TEST SUMMARY:`);
    console.log(`  TOTAL PASSED: ${passedTests}`);
    console.log(`  TOTAL FAILED: ${failedTests}`);
    console.log(`========================================\n`);

    if (failedTests > 0) process.exit(1);
    else process.exit(0);
  } catch (err) {
    console.error('Fatal error during NEO-VENT test execution:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
