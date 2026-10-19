import { pool } from './db';
import {
  TherapeuticApheresisService,
  PlasmicScoreInput,
  PlasmaVolumeInput,
  CitrateCalciumInput
} from './services/therapeuticApheresis';

async function runTests() {
  console.log('--- STARTING PHERESIS-CMD TEST SUITE (PHASE 77) ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    // 1. ASFA Guidance: TTP (Category I, FFP)
    const ttpGuidance = TherapeuticApheresisService.evaluateAsfaGuidance('TTP');
    assert(ttpGuidance.category === 'CATEGORY_I', 'ASFA: TTP is Category I indication');
    assert(ttpGuidance.first_line_indication === true, 'ASFA: TTP is first-line indication');
    assert(ttpGuidance.recommended_replacement_fluid === 'FRESH_FROZEN_PLASMA', 'ASFA: TTP mandates FFP replacement');
    assert(ttpGuidance.evidence_grade.includes('1A'), 'ASFA: TTP evidence grade is 1A');

    // 2. ASFA Guidance: Guillain-Barré (Category I, Albumin 5%)
    const gbsGuidance = TherapeuticApheresisService.evaluateAsfaGuidance('guillain_barre');
    assert(gbsGuidance.category === 'CATEGORY_I', 'ASFA: GBS is Category I indication');
    assert(gbsGuidance.recommended_replacement_fluid === 'ALBUMIN_5_PERCENT', 'ASFA: GBS replacement fluid is Albumin 5%');

    // 3. ASFA Guidance: Myasthenia Gravis & NMOSD
    const mgGuidance = TherapeuticApheresisService.evaluateAsfaGuidance('myasthenic_crisis');
    assert(mgGuidance.category === 'CATEGORY_I', 'ASFA: Myasthenic crisis is Category I');
    const nmosdGuidance = TherapeuticApheresisService.evaluateAsfaGuidance('nmosd');
    assert(nmosdGuidance.category === 'CATEGORY_II', 'ASFA: NMOSD is Category II');

    // 4. PLASMIC Score: High Risk (Score 6/7) with Safety Black-Box Interlock
    const highPlasmic: PlasmicScoreInput = {
      platelet_count_k: 18, // 1 pt (<30)
      hemolysis_present: true, // 1 pt
      active_cancer_in_past_year: false, // 1 pt
      stem_cell_or_organ_transplant: false, // 1 pt
      mcv_fl: 84, // 1 pt (<90)
      inr: 1.1, // 1 pt (<1.5)
      creatinine_mg_dl: 2.3 // 0 pt (>=2.0)
    };
    const highResult = TherapeuticApheresisService.evaluatePlasmicScore(highPlasmic);
    assert(highResult.score === 6, 'PLASMIC: Correctly scored 6/7');
    assert(highResult.risk_category === 'HIGH', 'PLASMIC: High risk category for severe ADAMTS13 deficiency');
    assert(highResult.immediate_tpe_required === true, 'PLASMIC: Immediate emergent TPE required');
    assert(highResult.platelet_transfusion_contraindicated === true, 'PLASMIC: Platelet transfusion contraindicated interlock active');
    assert(highResult.black_box_warning !== undefined, 'PLASMIC: Black-box safety warning present');
    assert(highResult.black_box_warning!.includes('PLATELET TRANSFUSION IS STRICTLY CONTRAINDICATED'), 'PLASMIC: Enforces platelet contraindication');

    // 5. PLASMIC Score: Intermediate Risk (Score 5)
    const midPlasmic: PlasmicScoreInput = {
      platelet_count_k: 24, // 1 pt
      hemolysis_present: true, // 1 pt
      active_cancer_in_past_year: true, // 0 pt
      stem_cell_or_organ_transplant: false, // 1 pt
      mcv_fl: 95, // 0 pt
      inr: 1.2, // 1 pt
      creatinine_mg_dl: 1.4 // 1 pt
    };
    const midResult = TherapeuticApheresisService.evaluatePlasmicScore(midPlasmic);
    assert(midResult.score === 5, 'PLASMIC: Correctly scored 5/7');
    assert(midResult.risk_category === 'INTERMEDIATE', 'PLASMIC: Intermediate risk category');
    assert(midResult.management_plan.some(p => p.includes('STAT ADAMTS13')), 'PLASMIC: Expedites STAT ADAMTS13');

    // 6. PLASMIC Score: Confirmed Severe ADAMTS13 Deficiency (< 10%)
    const confirmedInput: PlasmicScoreInput = {
      ...highPlasmic,
      adamts13_activity_percent: 2.5
    };
    const confirmedResult = TherapeuticApheresisService.evaluatePlasmicScore(confirmedInput);
    assert(confirmedResult.management_plan.some(p => p.includes('CONFIRMED TTP: ADAMTS13 Activity is 2.5%')), 'PLASMIC: Validates confirmed TTP lab');

    // 7. Total Plasma Volume: Male (70 kg, Hct 40%, 1.0 TPV)
    const maleVolInput: PlasmaVolumeInput = {
      weight_kg: 70,
      gender: 'MALE',
      hematocrit_percent: 40.0,
      prescribed_tpv_fraction: 1.0
    };
    const maleVolResult = TherapeuticApheresisService.calculatePlasmaVolume(maleVolInput);
    assert(maleVolResult.total_blood_volume_ml === 4900, 'TPV: Male TBV = 70 * 70 = 4900 mL');
    assert(maleVolResult.total_plasma_volume_ml === 2940, 'TPV: Male TPV = 4900 * 0.6 = 2940 mL');
    assert(maleVolResult.target_exchange_volume_ml === 2940, 'TPV: 1.0 TPV exchange = 2940 mL');
    assert(maleVolResult.solute_removal_fraction_percent >= 63, 'TPV: Solute removal ~63.2% for 1.0 TPV');

    // 8. Total Plasma Volume: Female (60 kg, Hct 35%, 1.5 TPV)
    const femaleVolInput: PlasmaVolumeInput = {
      weight_kg: 60,
      gender: 'FEMALE',
      hematocrit_percent: 35.0,
      prescribed_tpv_fraction: 1.5
    };
    const femaleVolResult = TherapeuticApheresisService.calculatePlasmaVolume(femaleVolInput);
    assert(femaleVolResult.total_blood_volume_ml === 3900, 'TPV: Female TBV = 60 * 65 = 3900 mL');
    assert(femaleVolResult.total_plasma_volume_ml === 2535, 'TPV: Female TPV = 3900 * 0.65 = 2535 mL');
    assert(femaleVolResult.target_exchange_volume_ml === 3803, 'TPV: 1.5 TPV exchange = 3803 mL');
    assert(femaleVolResult.solute_removal_fraction_percent >= 77, 'TPV: Solute removal ~77.7% for 1.5 TPV');

    // 9. Citrate/Calcium Safety: Normal Systemic Ionized Calcium (1.22 mmol/L)
    const normCal: CitrateCalciumInput = {
      systemic_ionized_calcium_mmol_l: 1.22,
      clinical_symptoms_present: false
    };
    const normCalResult = TherapeuticApheresisService.evaluateCitrateCalciumSafety(normCal);
    assert(normCalResult.calcium_status === 'NORMAL', 'Calcium: Normal status when iCa = 1.22 mmol/L');
    assert(normCalResult.hypocalcemia_alert === false, 'Calcium: No alert when calcium is normal');

    // 10. Citrate/Calcium Safety: Mild Hypocalcemia (1.04 mmol/L)
    const mildCal: CitrateCalciumInput = {
      systemic_ionized_calcium_mmol_l: 1.04,
      clinical_symptoms_present: true
    };
    const mildCalResult = TherapeuticApheresisService.evaluateCitrateCalciumSafety(mildCal);
    assert(mildCalResult.calcium_status === 'MILD_HYPOCALCEMIA', 'Calcium: Mild hypocalcemia identified');
    assert(mildCalResult.hypocalcemia_alert === true, 'Calcium: Mild alert flagged');
    assert(mildCalResult.continuous_infusion_adjustment.includes('Increase prophylactic Calcium'), 'Calcium: Infusion titration directed');

    // 11. Citrate/Calcium Safety: Severe Critical Hypocalcemia (0.84 mmol/L)
    const critCal: CitrateCalciumInput = {
      systemic_ionized_calcium_mmol_l: 0.84,
      clinical_symptoms_present: true
    };
    const critCalResult = TherapeuticApheresisService.evaluateCitrateCalciumSafety(critCal);
    assert(critCalResult.calcium_status === 'SEVERE_CRITICAL_HYPOCALCEMIA', 'Calcium: Critical hypocalcemia triggered');
    assert(critCalResult.emergency_calcium_bolus_required === true, 'Calcium: Emergency IV bolus required');
    assert(critCalResult.bolus_dose_instructions!.includes('2 grams (20 mL) of 10% Calcium Gluconate'), 'Calcium: Specifies 2g Calcium Gluconate STAT push');
    assert(critCalResult.cardiac_warning !== undefined, 'Calcium: QTc prolongation / arrhythmia warning issued');

    // 12. Database Operations: Insert Apheresis Procedure Order
    const patientRes = await pool.query('SELECT id FROM patients LIMIT 1');
    const patientId = patientRes.rows.length > 0 ? patientRes.rows[0].id : 1;

    const savedProc = await TherapeuticApheresisService.saveApheresisProcedure({
      patient_id: patientId,
      asfa_indication: 'TTP',
      asfa_category: 'CATEGORY_I',
      plasmic_score: 7,
      adamts13_activity_percent: 1.8,
      total_plasma_volume_ml: 2940.0,
      prescribed_exchange_tpv_fraction: 1.0,
      total_exchange_volume_ml: 2940.0,
      replacement_fluid: 'FRESH_FROZEN_PLASMA',
      platelet_transfusion_contraindicated: true,
      calcium_infusion_active: true
    });
    assert(savedProc.id > 0, 'Database: Successfully saved apheresis_procedure');
    assert(savedProc.asfa_indication === 'TTP', 'Database: Indication matches TTP');
    assert(savedProc.platelet_transfusion_contraindicated === true, 'Database: Platelet contraindication preserved');

    // 13. Database Operations: Log Real-Time Exchange Telemetry
    const savedLog = await TherapeuticApheresisService.logPlasmaExchangeTelemetry({
      procedure_id: savedProc.id,
      patient_id: patientId,
      blood_processed_ml: 4500.0,
      plasma_removed_ml: 2900.0,
      replacement_administered_ml: 2900.0,
      acda_citrate_volume_ml: 320.0,
      systemic_ionized_calcium_mmol_l: 1.14,
      calcium_gluconate_infused_g: 1.5,
      hypocalcemia_alert: false,
      circuit_pressure_inlet_mmhg: -80
    });
    assert(savedLog.id > 0, 'Database: Successfully saved plasma_exchange_log');
    assert(Number(savedLog.plasma_removed_ml) === 2900.0, 'Database: Plasma removed volume matches');

    // 14. Database Operations: Retrieve History
    const history = await TherapeuticApheresisService.getPatientApheresisHistory(patientId);
    assert(history.procedures.length > 0, 'Database: Successfully retrieved apheresis procedures');
    assert(history.telemetry_logs.length > 0, 'Database: Successfully retrieved telemetry logs');

  } catch (err) {
    console.error('Test suite error:', err);
    failed++;
  } finally {
    console.log(`\n--- TEST RUN FINISHED: ${passed} PASSED, ${failed} FAILED ---`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
