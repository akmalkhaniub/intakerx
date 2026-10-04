import {
  calculateRadiobiology,
  evaluateQuantecConstraints,
  evaluateTheranosticProtocol,
  calculateDecayAndRelease,
  createRadiationPlan,
  recordTheranosticCycle,
  getTheranosticCycleDetails,
  listActiveTheranosticCycles,
  listRadiationPlans
} from './services/radiationTheranostics';
import { pool } from './db';

async function runTests() {
  console.log('🧪 Starting Radiation Oncology & Theranostics Command Test Suite (Phase 60)...\n');

  try {
    // 1. Radiobiology BED & EQD2 Tests
    console.log('--- Test 1: Linear-Quadratic Radiobiology Model (BED & EQD2) ---');
    const prostateSbrt = calculateRadiobiology({
      physicalDoseGy: 40,
      fractionCount: 5,
      alphaBetaRatioTumor: 1.5,
      alphaBetaRatioOar: 3.0
    });
    console.log(`✓ Prostate SBRT (40 Gy / 5 fx @ 8 Gy/fx): BED_tumor=${prostateSbrt.bedTumorGy} Gy, EQD2_tumor=${prostateSbrt.eqd2TumorGy} Gy, BED_oar=${prostateSbrt.bedOarGy} Gy`);
    if (prostateSbrt.dosePerFractionGy !== 8 || prostateSbrt.eqd2TumorGy < 100) {
      throw new Error('Prostate SBRT calculation error');
    }

    const standardLung = calculateRadiobiology({
      physicalDoseGy: 60,
      fractionCount: 30,
      alphaBetaRatioTumor: 10,
      alphaBetaRatioOar: 3
    });
    console.log(`✓ Standard Lung (60 Gy / 30 fx @ 2 Gy/fx): BED_tumor=${standardLung.bedTumorGy} Gy, EQD2_tumor=${standardLung.eqd2TumorGy} Gy`);
    if (standardLung.bedTumorGy !== 72 || standardLung.eqd2TumorGy !== 60) {
      throw new Error('Standard fractionation calculation error');
    }

    // 2. QUANTEC Constraints Tests
    console.log('\n--- Test 2: QUANTEC Normal Tissue Constraints ---');
    const cordSafe = evaluateQuantecConstraints({
      organ: 'Spinal_Cord',
      maxDoseGy: 42
    });
    console.log(`✓ Safe Cord (42 Gy): isCompliant=${cordSafe.isCompliant}, ToxicityLevel=${cordSafe.toxicityRiskLevel}`);
    if (!cordSafe.isCompliant) throw new Error('Spinal cord 42 Gy should be compliant');

    const cordOverdose = evaluateQuantecConstraints({
      organ: 'Spinal_Cord',
      maxDoseGy: 52
    });
    console.log(`✓ Cord Overdose (52 Gy): isCompliant=${cordOverdose.isCompliant}, ToxicityLevel=${cordOverdose.toxicityRiskLevel}`);
    if (cordOverdose.isCompliant || cordOverdose.toxicityRiskLevel !== 'High Risk of Severe Toxicity') {
      throw new Error('Spinal cord 52 Gy should trigger high risk violation');
    }

    const lungOverdose = evaluateQuantecConstraints({
      organ: 'Lungs',
      meanDoseGy: 22,
      volumeAboveThresholdPercent: 36
    });
    console.log(`✓ Lung Overdose: isCompliant=${lungOverdose.isCompliant}, Alert=${lungOverdose.riskAlert}`);
    if (lungOverdose.isCompliant) throw new Error('Lung overdose should be non-compliant');

    // 3. Theranostic Protocol Evaluator Tests
    console.log('\n--- Test 3: Targeted Radionuclide Theranostic Protocols ---');
    const pluvictoEligible = evaluateTheranosticProtocol({
      radiopharmaceutical: '177Lu-PSMA-617_Pluvicto',
      cycleNumber: 1,
      eGfrMlMin: 65,
      plateletsKPerUl: 180,
      ancKPerUl: 2.8
    });
    console.log(`✓ Pluvicto Protocol: isEligible=${pluvictoEligible.isEligibleForDosing}, Dose=${pluvictoEligible.standardDoseGbq} GBq (${pluvictoEligible.standardDoseMci} mCi), Premeds=${pluvictoEligible.mandatoryPremedications.length}`);
    if (!pluvictoEligible.isEligibleForDosing) throw new Error('Pluvicto should be eligible');

    const pluvictoRenalFailure = evaluateTheranosticProtocol({
      radiopharmaceutical: '177Lu-PSMA-617_Pluvicto',
      cycleNumber: 2,
      eGfrMlMin: 22, // Below 30 threshold
      plateletsKPerUl: 160
    });
    console.log(`✓ Pluvicto Renal Contraindication: isEligible=${pluvictoRenalFailure.isEligibleForDosing}, Alert=${pluvictoRenalFailure.eligibilityAlerts[0]}`);
    if (pluvictoRenalFailure.isEligibleForDosing) throw new Error('Pluvicto should be ineligible for eGFR < 30');

    const lutatheraCase = evaluateTheranosticProtocol({
      radiopharmaceutical: '177Lu-DOTATATE_Lutathera',
      cycleNumber: 1,
      eGfrMlMin: 70,
      plateletsKPerUl: 210
    });
    console.log(`✓ Lutathera Protocol: Nephroprotection=${lutatheraCase.mandatoryNephroprotection ? 'REQUIRED' : 'NONE'}`);
    if (!lutatheraCase.mandatoryNephroprotection || !lutatheraCase.mandatoryNephroprotection.includes('Lysine')) {
      throw new Error('Lutathera must enforce Lysine/Arginine nephroprotection');
    }

    // 4. Radioactive Decay & NRC Patient Release Watchdog
    console.log('\n--- Test 4: Radioactive Decay & ALARA Patient Release ---');
    const luDecay = calculateDecayAndRelease({
      radiopharmaceutical: '177Lu',
      initialActivityGbq: 7.4,
      hoursElapsed: 48,
      initial1mDoseRateUsvHr: 95
    });
    console.log(`✓ 177Lu Decay @ 48h: Retained=${luDecay.retainedActivityGbq} GBq (${luDecay.retainedActivityMci} mCi), Current 1m Rate=${luDecay.current1mDoseRateUsvHr} uSv/hr, NRC Release Met=${luDecay.nrcReleaseCriteriaMet}`);
    if (luDecay.retainedActivityGbq >= 7.4 || luDecay.current1mDoseRateUsvHr >= 95) {
      throw new Error('Radioactive decay did not attenuate activity');
    }

    // 5. Database Persistence & Query Helpers
    console.log('\n--- Test 5: Database Persistence & Queries ---');
    let patientId = 1;
    const patRes = await pool.query(`SELECT id FROM patients LIMIT 1`);
    if (patRes.rows.length > 0) {
      patientId = patRes.rows[0].id;
    } else {
      const newPat = await pool.query(
        `INSERT INTO patients (first_name, last_name, date_of_birth, gender) VALUES ('Rad', 'Oncology', '1958-03-12', 'Male') RETURNING id`
      );
      patientId = newPat.rows[0].id;
    }

    const radPlan = await createRadiationPlan({
      patientId,
      tumorSite: 'Prostate_Carcinoma',
      prescribedPhysicalDoseGy: 40,
      fractionCount: 5,
      dosePerFractionGy: 8,
      alphaBetaRatioTumor: 1.5,
      bedTumorGy: 253.3,
      eqd2TumorGy: 108.6,
      quantecConstraintsChecked: { spinal_cord: 'N/A', rectum_v70: 'compliant' }
    });
    console.log(`✓ Created Radiation Treatment Plan: ID=${radPlan.id}, Site=${radPlan.tumor_site}, EQD2=${radPlan.eqd2_tumor_gy} Gy`);

    const thCycle = await recordTheranosticCycle({
      patientId,
      radiopharmaceutical: '177Lu-PSMA-617_Pluvicto',
      cycleNumber: 1,
      administeredActivityGbq: 7.400,
      administeredActivityMci: 200.0,
      aminoAcidNephroprotectionUsed: false,
      postAdmin1mDoseRateUsvHr: 42.5,
      nrcReleaseCriteriaMet: true,
      isolationPrecautionsHours: 72
    });
    console.log(`✓ Recorded Theranostic Cycle: ID=${thCycle.id}, Agent=${thCycle.radiopharmaceutical}, Cycle#=${thCycle.cycle_number}, NRC Release=${thCycle.nrc_release_criteria_met}`);

    const details = await getTheranosticCycleDetails(thCycle.id);
    if (!details || details.cycle_number !== 1) throw new Error('Failed to retrieve cycle details');
    console.log(`✓ Verified Theranostic Cycle Details retrieved successfully.`);

    const plans = await listRadiationPlans(5);
    const cycles = await listActiveTheranosticCycles(5);
    console.log(`✓ Listed ${plans.length} radiation plan(s) and ${cycles.length} theranostic cycle(s).`);

    console.log('\n🎉 ALL RADIATION ONCOLOGY & THERANOSTICS TESTS PASSED (100%)! 🎉\n');
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
