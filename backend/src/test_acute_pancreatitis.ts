import { pool } from './db';
import {
  AcutePancreatitisService,
  AtlantaAssessmentInput,
  BisapScoreInput,
  FluidResuscitationInput,
  DutchStepUpInput,
  TokyoGuidelinesTg18Input
} from './services/acutePancreatitis';

async function runTests() {
  console.log('--- STARTING PANCREAS-ALERT TEST SUITE (PHASE 76) ---');
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
    // 1. Atlanta Classification: Mild Pancreatitis
    const mildInput: AtlantaAssessmentInput = {
      organ_failure_present: false,
      local_complications: [],
      systemic_complications: false
    };
    const mildResult = AcutePancreatitisService.evaluateAtlantaClassification(mildInput);
    assert(mildResult.severity === 'MILD', 'Atlanta: Classified as MILD when no organ failure or complications');
    assert(mildResult.icu_admission_indicated === false, 'Atlanta: ICU admission false for mild disease');
    assert(mildResult.organ_failure_type === 'NONE', 'Atlanta: Organ failure type is NONE');

    // 2. Atlanta Classification: Moderately Severe Pancreatitis (Transient Organ Failure)
    const modInput: AtlantaAssessmentInput = {
      organ_failure_present: true,
      organ_failure_duration_hours: 24, // < 48 hours = transient
      renal_creatinine_mg_dl: 2.4, // Marshall >= 2
      local_complications: ['acute_peripancreatic_fluid_collection'],
      systemic_complications: false
    };
    const modResult = AcutePancreatitisService.evaluateAtlantaClassification(modInput);
    assert(modResult.severity === 'MODERATELY_SEVERE', 'Atlanta: Classified as MODERATELY_SEVERE for transient organ failure < 48h');
    assert(modResult.organ_failure_type === 'TRANSIENT', 'Atlanta: Organ failure categorized as TRANSIENT');
    assert(modResult.marshall_score >= 2, 'Atlanta: Modified Marshall score reflects renal failure');

    // 3. Atlanta Classification: Severe Pancreatitis (Persistent Organ Failure)
    const severeInput: AtlantaAssessmentInput = {
      organ_failure_present: true,
      organ_failure_duration_hours: 72, // >= 48 hours = persistent
      respiratory_pao2_fio2: 180, // Marshall = 3
      renal_creatinine_mg_dl: 3.8, // Marshall = 3
      cardiovascular_systolic_bp: 82, // Marshall = 2
      local_complications: ['acute_necrotic_collection']
    };
    const severeResult = AcutePancreatitisService.evaluateAtlantaClassification(severeInput);
    assert(severeResult.severity === 'SEVERE', 'Atlanta: Classified as SEVERE for persistent organ failure >= 48h');
    assert(severeResult.organ_failure_type === 'PERSISTENT', 'Atlanta: Organ failure categorized as PERSISTENT');
    assert(severeResult.icu_admission_indicated === true, 'Atlanta: ICU admission mandatory for severe pancreatitis');
    assert(severeResult.marshall_score >= 6, 'Atlanta: Multi-organ Marshall score calculated');

    // 4. BISAP Scoring: Low Risk (Score 0)
    const bisapZero: BisapScoreInput = {
      bun_mg_dl: 14,
      impaired_mental_status: false,
      sirs_criteria_count: 0,
      age: 42,
      pleural_effusion: false
    };
    const bisapZeroResult = AcutePancreatitisService.evaluateBisapScore(bisapZero);
    assert(bisapZeroResult.score === 0, 'BISAP: Score is 0 for normal parameters');
    assert(bisapZeroResult.mortality_risk_category === 'LOW', 'BISAP: Low mortality risk (< 1%)');

    // 5. BISAP Scoring: High Risk (Score 4)
    const bisapHigh: BisapScoreInput = {
      bun_mg_dl: 38, // 1 pt (>25)
      impaired_mental_status: true, // 1 pt (GCS < 15)
      sirs_criteria_count: 3, // 1 pt (>= 2 criteria)
      age: 68, // 1 pt (> 60)
      pleural_effusion: false // 0 pt
    };
    const bisapHighResult = AcutePancreatitisService.evaluateBisapScore(bisapHigh);
    assert(bisapHighResult.score === 4, 'BISAP: Score is 4/5');
    assert(bisapHighResult.mortality_risk_category === 'HIGH', 'BISAP: High mortality risk category');
    assert(bisapHighResult.estimated_mortality_percent > 10, 'BISAP: Mortality risk > 10%');
    assert(bisapHighResult.clinical_guidance.some(g => g.includes('Intensive Care Unit')), 'BISAP: Recommends ICU care');

    // 6. Fluid Resuscitation: Under-resuscitated with Hemoconcentration & Rising BUN
    const underResusc: FluidResuscitationInput = {
      weight_kg: 80,
      fluid_type: 'Normal_Saline',
      current_rate_ml_hr: 100,
      hematocrit_percent: 48.0, // Hemoconcentrated > 44%
      bun_mg_dl: 32,
      previous_bun_mg_dl: 22, // Rising BUN
      urine_output_ml_kg_hr: 0.3, // Oliguric < 0.5 mL/kg/h
      signs_of_fluid_overload: false
    };
    const underResult = AcutePancreatitisService.evaluateFluidResuscitation(underResusc);
    assert(underResult.resuscitation_adequacy === 'UNDER_RESUSCITATED', 'Fluid: Detected under-resuscitation');
    assert(underResult.recommended_rate_ml_hr >= 250, 'Fluid: Recommended rate increased to >= 250 mL/h');
    assert(underResult.clinical_actions.some(a => a.includes('Switch to Lactated Ringer')), 'Fluid: Recommends switching from Saline to LR');
    assert(underResult.hematocrit_status === 'HEMOCONCENTRATED', 'Fluid: Flags hemoconcentration Hct > 44%');
    assert(underResult.bun_trajectory === 'WORSENING', 'Fluid: Flags worsening BUN trajectory');

    // 7. Fluid Resuscitation: Fluid Overload Sentinel
    const overloadInput: FluidResuscitationInput = {
      weight_kg: 80,
      fluid_type: 'Lactated_Ringers',
      current_rate_ml_hr: 300,
      hematocrit_percent: 36.0,
      bun_mg_dl: 18,
      urine_output_ml_kg_hr: 0.8,
      signs_of_fluid_overload: true
    };
    const overloadResult = AcutePancreatitisService.evaluateFluidResuscitation(overloadInput);
    assert(overloadResult.resuscitation_adequacy === 'OVER_RESUSCITATED_AT_RISK', 'Fluid: Overload detected and flagged');
    assert(overloadResult.recommended_rate_ml_hr <= 100, 'Fluid: Fluid rate decreased during overload');
    assert(overloadResult.clinical_actions.some(a => a.includes('abdominal compartment syndrome')), 'Fluid: Warns of compartment syndrome / ARDS risk');

    // 8. Dutch Step-Up: Sterile Necrosis (Early Phase)
    const sterileStep: DutchStepUpInput = {
      necrosis_present: true,
      necrosis_type: 'STERILE',
      gas_on_ct: false,
      days_since_onset: 7,
      current_step: 'CONSERVATIVE_MEDICAL',
      hours_at_current_step: 168,
      clinical_response: 'STABLE'
    };
    const sterileResult = AcutePancreatitisService.evaluateDutchStepUp(sterileStep);
    assert(sterileResult.recommended_step === 'CONSERVATIVE_MEDICAL', 'Dutch Step-Up: Postpones intervention for sterile necrosis');
    assert(sterileResult.antimicrobial_guidance.includes('NOT recommended for sterile'), 'Dutch Step-Up: Antibiotic prophylaxis withheld');

    // 9. Dutch Step-Up: Infected Necrosis (Gas on CT) -> Step 1 PCD
    const infectedStep1: DutchStepUpInput = {
      necrosis_present: true,
      necrosis_type: 'CONFIRMED_INFECTED',
      gas_on_ct: true,
      days_since_onset: 14,
      current_step: 'CONSERVATIVE_MEDICAL',
      hours_at_current_step: 48,
      clinical_response: 'DETERIORATING'
    };
    const step1Result = AcutePancreatitisService.evaluateDutchStepUp(infectedStep1);
    assert(step1Result.infection_confirmed_or_strongly_suspected === true, 'Dutch Step-Up: Confirmed infection from gas on CT');
    assert(step1Result.recommended_step === 'PERCUTANEOUS_CATHETER_DRAINAGE', 'Dutch Step-Up: Step 1 initiates percutaneous drainage');
    assert(step1Result.antimicrobial_guidance.includes('Meropenem'), 'Dutch Step-Up: Recommends IV Meropenem');

    // 10. Dutch Step-Up: Post-PCD Deterioration >= 72h -> Step 2 VARD
    const postPcdStep2: DutchStepUpInput = {
      necrosis_present: true,
      necrosis_type: 'CONFIRMED_INFECTED',
      gas_on_ct: false,
      days_since_onset: 18,
      current_step: 'PERCUTANEOUS_CATHETER_DRAINAGE',
      hours_at_current_step: 76,
      clinical_response: 'DETERIORATING',
      drainage_output_ml_24h: 120
    };
    const step2Result = AcutePancreatitisService.evaluateDutchStepUp(postPcdStep2);
    assert(step2Result.recommended_step === 'VARD_MINIMALLY_INVASIVE', 'Dutch Step-Up: Step 2 triggers VARD minimally invasive debridement');

    // 11. Tokyo Guidelines TG18: Severe Acute Cholangitis (Grade III) with Organ Dysfunction
    const severeCholangitis: TokyoGuidelinesTg18Input = {
      fever_temp_celsius: 39.4,
      jaundice_or_bilirubin_mg_dl: 6.2,
      ruq_pain: true,
      wbc_count_k: 18.5,
      organ_dysfunction_present: true,
      gallstones_or_biliary_dilation: true
    };
    const tg18Result = AcutePancreatitisService.evaluateTg18Cholangitis(severeCholangitis);
    assert(tg18Result.suspected_acute_cholangitis === true, 'TG18: Suspected acute cholangitis confirmed');
    assert(tg18Result.tg18_severity === 'GRADE_III_SEVERE', 'TG18: Classified as GRADE_III_SEVERE');
    assert(tg18Result.ercp_timing === 'EMERGENT_WITHIN_24H', 'TG18: Emergent ERCP within 24h recommended');
    assert(tg18Result.cholecystectomy_recommendation.includes('Index admission'), 'TG18: Recommends index admission cholecystectomy');

    // 12. Tokyo Guidelines TG18: Gallstone Pancreatitis without Cholangitis
    const gallstonePancreatitisOnly: TokyoGuidelinesTg18Input = {
      fever_temp_celsius: 37.1,
      jaundice_or_bilirubin_mg_dl: 1.2,
      ruq_pain: true,
      wbc_count_k: 10.5,
      organ_dysfunction_present: false,
      gallstones_or_biliary_dilation: true
    };
    const gallstoneResult = AcutePancreatitisService.evaluateTg18Cholangitis(gallstonePancreatitisOnly);
    assert(gallstoneResult.tg18_severity === 'NOT_CHOLANGITIS', 'TG18: Cholangitis ruled out');
    assert(gallstoneResult.ercp_timing === 'NOT_INDICATED', 'TG18: ERCP not indicated for uncomplicated stone passage');
    assert(gallstoneResult.cholecystectomy_recommendation.includes('laparoscopic cholecystectomy'), 'TG18: Lap chole recommended prior to discharge');

    // 13. Database Operations: Insert Pancreatitis Encounter
    const patientRes = await pool.query('SELECT id FROM patients LIMIT 1');
    const patientId = patientRes.rows.length > 0 ? patientRes.rows[0].id : 1;

    const savedEncounter = await AcutePancreatitisService.savePancreatitisEncounter({
      patient_id: patientId,
      etiology: 'biliary_gallstone',
      atlanta_severity: 'SEVERE',
      bisap_score: 4,
      glasgow_imrie_score: 4,
      sirs_present: true,
      organ_failure_persistent: true,
      fluid_rate_ml_hr: 250.0,
      fluid_type: 'Lactated Ringers',
      hematocrit_percent: 44.5,
      bun_mg_dl: 36.0,
      urine_output_ml_kg_hr: 0.45,
      gallstone_cholangitis_suspected: true,
      tg18_severity: 'GRADE_III_SEVERE',
      ercp_recommended_within_24h: true
    });
    assert(savedEncounter.id > 0, 'Database: Successfully saved acute_pancreatitis_encounter');
    assert(savedEncounter.atlanta_severity === 'SEVERE', 'Database: Severity matches SEVERE');
    assert(savedEncounter.ercp_recommended_within_24h === true, 'Database: ERCP recommendation preserved');

    // 14. Database Operations: Insert Step-Up Intervention Log
    const savedStepUp = await AcutePancreatitisService.saveStepUpIntervention({
      encounter_id: savedEncounter.id,
      patient_id: patientId,
      necrosis_type: 'CONFIRMED_INFECTED',
      gas_on_ct: true,
      current_step: 'PERCUTANEOUS_CATHETER_DRAINAGE',
      clinical_response: 'IMPROVING',
      drainage_output_ml_24h: 240.0,
      next_recommended_step: 'CONTINUE_CURRENT_DRAINAGE',
      antimicrobial_regimen: 'IV Meropenem 1g q8h'
    });
    assert(savedStepUp.id > 0, 'Database: Successfully saved pancreatic_stepup_intervention');
    assert(savedStepUp.necrosis_type === 'CONFIRMED_INFECTED', 'Database: Necrosis type matches');
    assert(Number(savedStepUp.drainage_output_ml_24h) === 240.0, 'Database: Drainage output matches');

    // 15. Database Operations: Retrieve History
    const history = await AcutePancreatitisService.getPatientPancreatitisHistory(patientId);
    assert(history.encounters.length > 0, 'Database: History retrieved encounters');
    assert(history.step_up_interventions.length > 0, 'Database: History retrieved step-up interventions');

  } catch (err) {
    console.error('Test suite error:', err);
    failed++;
  } finally {
    console.log(`\n--- TEST RUN FINISHED: ${passed} PASSED, ${failed} FAILED ---`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
