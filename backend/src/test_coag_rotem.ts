import {
  evaluateRotemAssay,
  evaluateAnticoagulantReversal,
  CoagRotemService
} from './services/coagRotem';
import { pool } from './db';

async function runTests() {
  console.log('--- STARTING PHASE 74 COAG-ROTEM COMMAND INTEGRATION TESTS ---');
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
    // 1. Normal ROTEM Assay
    const norm = evaluateRotemAssay({
      assay_type: 'ROTEM_DELTA',
      clinical_scenario: 'trauma_mhp',
      extem_ct_sec: 65,
      intem_ct_sec: 160,
      fibtem_mcf_mm: 14,
      extem_mcf_mm: 58,
      maximum_lysis_percent: 6
    });
    assert(norm.deficiency_pattern === 'NORMAL_HEMOSTASIS', 'ROTEM: Normal hemostasis pattern identified');
    assert(norm.urgency === 'STABLE_MONITOR', 'ROTEM: Urgency is STABLE_MONITOR');
    assert(norm.recommended_products.some(p => p.product === 'NONE'), 'ROTEM: No blood products indicated');

    // 2. Hyperfibrinolysis Detection
    const hyperfib = evaluateRotemAssay({
      assay_type: 'ROTEM_DELTA',
      clinical_scenario: 'trauma_mhp',
      extem_ct_sec: 75,
      fibtem_mcf_mm: 11,
      extem_mcf_mm: 52,
      maximum_lysis_percent: 28.0 // Critical > 15%
    });
    assert(hyperfib.deficiency_pattern === 'HYPERFIBRINOLYSIS', 'ROTEM: Hyperfibrinolysis identified (ML 28%)');
    assert(hyperfib.urgency === 'STAT_HEMORRHAGE_CONTROL', 'ROTEM: Urgency is STAT_HEMORRHAGE_CONTROL');
    assert(hyperfib.recommended_products.some(p => p.product === 'TRANEXAMIC_ACID'), 'ROTEM: Tranexamic Acid prescribed for hyperfibrinolysis');

    // 3. Hypofibrinogenemia Detection
    const hypofib = evaluateRotemAssay({
      assay_type: 'ROTEM_DELTA',
      clinical_scenario: 'postpartum_hemorrhage',
      extem_ct_sec: 70,
      fibtem_mcf_mm: 6.0, // Critical < 10 mm
      extem_mcf_mm: 42,
      maximum_lysis_percent: 8
    });
    assert(hypofib.deficiency_pattern === 'HYPOFIBRINOGENEMIA', 'ROTEM: Hypofibrinogenemia identified (FIBTEM MCF 6 mm)');
    assert(hypofib.recommended_products.some(p => p.product === 'FIBRINOGEN_OR_CRYO'), 'ROTEM: Fibrinogen Concentrate / Cryoprecipitate recommended');

    // 4. Thrombocytopenia
    const thrombo = evaluateRotemAssay({
      assay_type: 'ROTEM_DELTA',
      clinical_scenario: 'cardiovascular_or',
      extem_ct_sec: 72,
      fibtem_mcf_mm: 16.0, // Normal fibrinogen
      extem_mcf_mm: 36.0,  // Deficient platelets (< 45 mm)
      maximum_lysis_percent: 5
    });
    assert(thrombo.deficiency_pattern === 'THROMBOCYTOPENIA', 'ROTEM: Thrombocytopenia identified (EXTEM MCF 36 mm with normal FIBTEM)');
    assert(thrombo.recommended_products.some(p => p.product === 'PLATELETS'), 'ROTEM: Apheresis Platelets recommended');

    // 5. Coagulation Factor Depletion
    const factorDef = evaluateRotemAssay({
      assay_type: 'ROTEM_DELTA',
      clinical_scenario: 'liver_transplant',
      extem_ct_sec: 115.0, // Prolonged CT > 80s
      fibtem_mcf_mm: 15.0,
      extem_mcf_mm: 55.0,
      maximum_lysis_percent: 7
    });
    assert(factorDef.deficiency_pattern === 'FACTOR_DEFICIENCY', 'ROTEM: Coagulation factor deficiency identified (EXTEM CT 115s)');
    assert(factorDef.recommended_products.some(p => p.product === 'PCC_OR_FFP'), 'ROTEM: 4F-PCC / FFP prescribed');

    // 6. Heparin Effect
    const hepar = evaluateRotemAssay({
      assay_type: 'ROTEM_DELTA',
      clinical_scenario: 'cardiovascular_or',
      extem_ct_sec: 68,
      intem_ct_sec: 320,
      heptem_ct_sec: 180, // Ratio 320/180 = 1.77 > 1.25
      fibtem_mcf_mm: 14,
      extem_mcf_mm: 56,
      maximum_lysis_percent: 6
    });
    assert(hepar.heparin_effect_detected, 'ROTEM: Heparin effect detected by INTEM/HEPTEM ratio > 1.25');
    assert(hepar.recommended_products.some(p => p.product === 'PROTAMINE'), 'ROTEM: Protamine sulfate recommended');

    // 7. Anticoagulant Reversal Protocols
    // Dabigatran -> Idarucizumab
    const dabig = evaluateAnticoagulantReversal({
      target_agent: 'dabigatran',
      last_dose_hours_ago: 3.5,
      bleeding_severity: 'life_threatening_ich'
    });
    assert(dabig.reversal_agent.includes('Idarucizumab'), 'Reversal: Idarucizumab selected for Dabigatran');
    assert(dabig.prescribed_dose.includes('5 g IV'), 'Reversal: Standard 5g IV Praxbind dose returned');

    // Apixaban high dose -> Andexanet alfa High Dose
    const apixHigh = evaluateAnticoagulantReversal({
      target_agent: 'apixaban',
      last_dose_hours_ago: 2.0,
      last_dose_mg: 10, // > 5 mg
      bleeding_severity: 'life_threatening_ich'
    });
    assert(apixHigh.reversal_agent.includes('HIGH DOSE'), 'Reversal: High-dose Andexanet alfa selected for recent high-dose Apixaban');
    assert(apixHigh.prescribed_dose.includes('800 mg'), 'Reversal: 800 mg IV bolus dose returned');

    // Warfarin -> 4F-PCC + Vitamin K
    const warf = evaluateAnticoagulantReversal({
      target_agent: 'warfarin',
      last_dose_hours_ago: 12.0,
      inr: 4.8,
      patient_weight_kg: 80,
      bleeding_severity: 'major_surgical_gastrointestinal'
    });
    assert(warf.reversal_agent.includes('4-Factor PCC') && warf.reversal_agent.includes('Vitamin K'), 'Reversal: 4F-PCC + Vitamin K selected for Warfarin');
    assert(warf.prescribed_dose.includes('4F-PCC') && warf.prescribed_dose.includes('Vitamin K 10 mg'), 'Reversal: Weight-based PCC and 10mg IV Vitamin K prescribed');

    // Heparin -> Protamine
    const heparRev = evaluateAnticoagulantReversal({
      target_agent: 'unfractionated_heparin',
      last_dose_hours_ago: 1.0,
      bleeding_severity: 'major_surgical_gastrointestinal'
    });
    assert(heparRev.reversal_agent.includes('Protamine'), 'Reversal: Protamine sulfate selected for Heparin');
    assert(heparRev.prescribed_dose.includes('1 mg Protamine per 100 units'), 'Reversal: Standard stoichiometry returned');

    // 8. Database Operations
    const assaySave = await CoagRotemService.evaluateAndSaveAssay(1, {
      assay_type: 'ROTEM_DELTA',
      clinical_scenario: 'trauma_mhp',
      extem_ct_sec: 95,
      fibtem_mcf_mm: 7,
      extem_mcf_mm: 38,
      maximum_lysis_percent: 22
    });
    assert(assaySave.assay.id > 0, 'DB: ROTEM assay saved with primary key');
    assert(assaySave.assay.deficiency_pattern === 'HYPERFIBRINOLYSIS', 'DB: Hyperfibrinolysis saved');

    const revSave = await CoagRotemService.evaluateAndSaveReversal(1, {
      target_agent: 'dabigatran',
      last_dose_hours_ago: 2.5,
      bleeding_severity: 'life_threatening_ich'
    });
    assert(revSave.reversal_event.id > 0, 'DB: Anticoagulant reversal saved with primary key');
    assert(revSave.reversal_event.reversal_agent.includes('Idarucizumab'), 'DB: Idarucizumab recorded');

    const history = await CoagRotemService.getPatientCoagHistory(1);
    assert(history.assays.length >= 1, 'DB: Retrieved ROTEM assays for patient 1');
    assert(history.reversals.length >= 1, 'DB: Retrieved reversal events for patient 1');

  } catch (err: any) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    console.log(`\nPHASE 74 SUMMARY: ${passed} passed, ${failed} failed.`);
    await pool.end();
    if (failed > 0) {
      process.exit(1);
    }
  }
}

runTests();
