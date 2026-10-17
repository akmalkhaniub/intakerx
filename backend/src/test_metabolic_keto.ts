import {
  calculateCorrectedSodium,
  calculateEffectiveOsmolality,
  calculateAnionGap,
  evaluateMetabolicKeto,
  evaluateHourlyTitration,
  MetabolicKetoService
} from './services/metabolicKeto';
import { pool } from './db';

async function runTests() {
  console.log('--- STARTING PHASE 73 METABOLIC-KETO COMMAND INTEGRATION TESTS ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`[PASS] ${msg}`);
      passed++;
    } else {
      console.error(`[FAIL] ${msg}`);
      failed++;
    }
  }

  try {
    // 1. Fundamental Calculations
    const corrNa = calculateCorrectedSodium(132, 600); // 132 + 0.016 * 500 = 132 + 8 = 140
    assert(corrNa === 140.0, 'Calculations: Katz corrected sodium calculated correctly (140 mEq/L)');

    const effOsm = calculateEffectiveOsmolality(140, 720); // 2*140 + 720/18 = 280 + 40 = 320
    assert(effOsm === 320.0, 'Calculations: Effective osmolality calculated correctly (320 mOsm/kg)');

    const ag = calculateAnionGap(138, 98, 12); // 138 - (98 + 12) = 28
    assert(ag === 28.0, 'Calculations: Anion gap calculated correctly (28 mEq/L)');

    // 2. Severe DKA Evaluation
    const dkaSevere = evaluateMetabolicKeto({
      blood_glucose_mg_dl: 480,
      arterial_ph: 6.95,
      serum_bicarbonate_meq_l: 8.0,
      beta_hydroxybutyrate_mmol_l: 5.8,
      serum_sodium_meq_l: 134,
      serum_potassium_meq_l: 4.6,
      serum_chloride_meq_l: 96,
      bun_mg_dl: 28,
      patient_weight_kg: 70
    });
    assert(dkaSevere.presentation_type === 'DKA_SEVERE', 'Diagnostic: Severe DKA identified (pH < 7.00, HCO3 < 10)');
    assert(dkaSevere.anion_gap === 30, 'Diagnostic: Anion gap calculated (30 mEq/L)');
    assert(dkaSevere.potassium_safety.status === 'NORMAL_REPLACE', 'Potassium: Normal replacement status verified');
    assert(dkaSevere.insulin_protocol.initial_rate_units_hr === 7.0, 'Insulin: 0.1 units/kg/hr calculated (7.0 units/hr)');
    assert(!dkaSevere.transition_criteria.ready_for_subq_bridge, 'Transition: SubQ bridge false while acidosis persists');

    // 3. Potassium Safety Interlock (Strict Hold if K+ < 3.3)
    const dkaHypokalemia = evaluateMetabolicKeto({
      blood_glucose_mg_dl: 510,
      arterial_ph: 7.15,
      serum_bicarbonate_meq_l: 12.0,
      beta_hydroxybutyrate_mmol_l: 4.2,
      serum_sodium_meq_l: 136,
      serum_potassium_meq_l: 3.0, // Hypokalemic
      serum_chloride_meq_l: 100,
      bun_mg_dl: 22,
      patient_weight_kg: 80
    });
    assert(dkaHypokalemia.potassium_safety.status === 'INSULIN_HOLD_CRITICAL', 'Potassium: K+ 3.0 triggers INSULIN_HOLD_CRITICAL');
    assert(dkaHypokalemia.insulin_protocol.initial_rate_units_hr === 0.0, 'Potassium: Initial insulin rate locked at 0 units/hr');
    assert(dkaHypokalemia.potassium_safety.action.includes('HOLD INSULIN IMMEDIATELY'), 'Potassium: Urgent insulin hold action message generated');

    // 4. Hyperosmolar Hyperglycemic State (HHS)
    const hhsEval = evaluateMetabolicKeto({
      blood_glucose_mg_dl: 950,
      arterial_ph: 7.36,
      serum_bicarbonate_meq_l: 22.0,
      beta_hydroxybutyrate_mmol_l: 0.8,
      serum_sodium_meq_l: 142,
      serum_potassium_meq_l: 4.8,
      serum_chloride_meq_l: 102,
      bun_mg_dl: 68,
      patient_weight_kg: 85
    });
    assert(hhsEval.presentation_type === 'HHS', 'Diagnostic: HHS identified (Glucose > 600, Osm >= 320, bicarb >= 18)');
    assert(hhsEval.effective_osmolality >= 320, 'Diagnostic: Effective osmolality exceeds HHS threshold (>= 320 mOsm/kg)');

    // 5. Euglycemic DKA (SGLT2-Inhibitor Associated)
    const eDkaEval = evaluateMetabolicKeto({
      blood_glucose_mg_dl: 185, // Euglycemic < 200
      arterial_ph: 7.18,
      serum_bicarbonate_meq_l: 11.0,
      beta_hydroxybutyrate_mmol_l: 4.5,
      serum_sodium_meq_l: 135,
      serum_potassium_meq_l: 4.2,
      serum_chloride_meq_l: 98,
      bun_mg_dl: 20,
      patient_weight_kg: 65,
      sglt2i_exposure: true
    });
    assert(eDkaEval.presentation_type === 'EUGLYCEMIC_DKA', 'Diagnostic: Euglycemic DKA identified with SGLT2i exposure');
    assert(eDkaEval.fluid_protocol.bag_2_rate_ml_hr > 0, 'Fluids: Dextrose-containing Bag 2 initiated immediately in eDKA');

    // 6. Subcutaneous Bridge Criteria Met
    const dkaResolved = evaluateMetabolicKeto({
      blood_glucose_mg_dl: 175,
      arterial_ph: 7.35,
      serum_bicarbonate_meq_l: 20.0,
      beta_hydroxybutyrate_mmol_l: 0.4,
      serum_sodium_meq_l: 138,
      serum_potassium_meq_l: 4.2,
      serum_chloride_meq_l: 108,
      bun_mg_dl: 15,
      patient_weight_kg: 70
    });
    assert(dkaResolved.transition_criteria.ready_for_subq_bridge, 'Transition: SubQ bridge ready when bicarb >= 18 and AG <= 12');
    assert(dkaResolved.transition_criteria.bridge_instructions.includes('2 hours BEFORE'), 'Transition: 2-hour SubQ overlap instruction provided');

    // 7. Dynamic Hourly Titration Engine
    // Optimal drop (50-75 mg/dL/hr)
    const titrOptimal = evaluateHourlyTitration({
      current_glucose_mg_dl: 380,
      previous_glucose_mg_dl: 440, // 60 drop
      current_insulin_rate_units_hr: 6.0,
      current_potassium_meq_l: 4.4,
      anion_gap: 20
    });
    assert(titrOptimal.drop_rate_assessment === 'OPTIMAL', 'Titration: Drop rate 60 mg/dL/hr assessed as OPTIMAL');
    assert(titrOptimal.adjusted_insulin_rate_units_hr === 6.0, 'Titration: Insulin rate maintained on optimal drop');

    // Slow drop (< 50 mg/dL/hr)
    const titrSlow = evaluateHourlyTitration({
      current_glucose_mg_dl: 420,
      previous_glucose_mg_dl: 440, // 20 drop
      current_insulin_rate_units_hr: 6.0,
      current_potassium_meq_l: 4.4,
      anion_gap: 22
    });
    assert(titrSlow.drop_rate_assessment === 'TOO_SLOW_INCREASE', 'Titration: Drop rate 20 mg/dL/hr assessed as TOO_SLOW_INCREASE');
    assert(titrSlow.adjusted_insulin_rate_units_hr === 9.0, 'Titration: Insulin rate increased by 50% (9.0 units/hr)');

    // Rapid drop (> 100 mg/dL/hr) - Cerebral Edema Protection
    const titrFast = evaluateHourlyTitration({
      current_glucose_mg_dl: 280,
      previous_glucose_mg_dl: 420, // 140 drop
      current_insulin_rate_units_hr: 8.0,
      current_potassium_meq_l: 4.1,
      anion_gap: 18
    });
    assert(titrFast.drop_rate_assessment === 'TOO_FAST_RISK_CEREBRAL_EDEMA', 'Titration: Drop rate 140 mg/dL/hr triggers CEREBRAL_EDEMA warning');
    assert(titrFast.adjusted_insulin_rate_units_hr < 8.0, 'Titration: Insulin rate reduced to curb rapid drop');

    // Dextrose activation when glucose <= 200
    const titrLow = evaluateHourlyTitration({
      current_glucose_mg_dl: 195,
      previous_glucose_mg_dl: 245,
      current_insulin_rate_units_hr: 4.0,
      current_potassium_meq_l: 4.2,
      anion_gap: 14
    });
    assert(titrLow.dextrose_required, 'Titration: Glucose <= 200 mg/dL requires dextrose addition');

    // 8. Database Operations
    const encResult = await MetabolicKetoService.evaluateAndSaveEncounter(1, {
      blood_glucose_mg_dl: 490,
      arterial_ph: 7.12,
      serum_bicarbonate_meq_l: 11.0,
      beta_hydroxybutyrate_mmol_l: 5.2,
      serum_sodium_meq_l: 135,
      serum_potassium_meq_l: 4.5,
      serum_chloride_meq_l: 97,
      bun_mg_dl: 24,
      patient_weight_kg: 72
    });
    assert(encResult.encounter.id > 0, 'DB: Metabolic encounter saved with primary key');
    assert(encResult.encounter.presentation_type === 'DKA_MODERATE', 'DB: Moderate DKA persisted');

    const logResult = await MetabolicKetoService.logTitration(encResult.encounter.id, {
      current_glucose_mg_dl: 430,
      previous_glucose_mg_dl: 490,
      current_insulin_rate_units_hr: 7.2,
      current_potassium_meq_l: 4.3,
      anion_gap: 24
    });
    assert(logResult.log.id > 0, 'DB: Insulin titration log saved with primary key');
    assert(logResult.evaluation.drop_rate_assessment === 'OPTIMAL', 'DB: Drop rate evaluated');

    const history = await MetabolicKetoService.getPatientMetabolicHistory(1);
    assert(history.encounters.length >= 1, 'DB: Retrieved metabolic encounters for patient 1');
    assert(history.titration_logs.length >= 1, 'DB: Retrieved titration logs for patient 1');

  } catch (err: any) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    console.log(`\nPHASE 73 SUMMARY: ${passed} passed, ${failed} failed.`);
    await pool.end();
    if (failed > 0) {
      process.exit(1);
    }
  }
}

runTests();
