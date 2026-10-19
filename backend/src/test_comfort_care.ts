import { ComfortCareService } from './services/comfortCare';
import { pool } from './db';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('--- Phase 79: COMFORT-CARE Command Integration Tests ---');
  console.log('======================================================\n');

  try {
    // 1. ESAS-r Multi-Domain Assessment - Severe Distress
    console.log('Test Group 1: ESAS-r Multi-Domain Symptom Evaluation (Severe)');
    const severeEsas = ComfortCareService.evaluateEsasR({
      pain: 8,
      tiredness: 7,
      drowsiness: 6,
      nausea: 8,
      appetite: 9,
      shortness_of_breath: 8,
      depression: 5,
      anxiety: 8,
      wellbeing: 8
    });

    assert(severeEsas.total_distress_score === 67, 'Total symptom distress score accurate (67/90)');
    assert(severeEsas.overall_distress_severity === 'SEVERE', 'Severity classified as SEVERE');
    assert(severeEsas.physical_symptom_score === 46, 'Physical symptom score calculated accurately (46/60)');
    assert(severeEsas.psychological_symptom_score === 13, 'Psychological symptom score calculated accurately (13/20)');
    assert(severeEsas.severe_symptoms.some(s => s.includes('Severe Pain')), 'Identified severe pain');
    assert(severeEsas.severe_symptoms.some(s => s.includes('Severe Dyspnea')), 'Identified severe dyspnea');
    assert(severeEsas.severe_symptoms.some(s => s.includes('Severe Nausea')), 'Identified severe nausea');
    assert(severeEsas.targeted_interventions.some(i => i.includes('breakthrough PRN dose')), 'Recommends scheduled opioid with breakthrough dose');
    assert(severeEsas.targeted_interventions.some(i => i.includes('sublingual morphine') || i.includes('fan')), 'Recommends sublingual morphine & fan for dyspnea');

    // 2. ESAS-r Mild/Controlled Symptoms
    console.log('\nTest Group 2: ESAS-r Mild / Controlled Symptoms');
    const mildEsas = ComfortCareService.evaluateEsasR({
      pain: 2,
      tiredness: 3,
      drowsiness: 2,
      nausea: 1,
      appetite: 2,
      shortness_of_breath: 1,
      depression: 1,
      anxiety: 2,
      wellbeing: 2
    });

    assert(mildEsas.total_distress_score === 16, 'Total distress score is 16');
    assert(mildEsas.overall_distress_severity === 'MILD', 'Severity classified as MILD');
    assert(mildEsas.severe_symptoms.length === 0, 'No severe symptoms flagged');

    // 3. Opioid Equianalgesic Converter: Oral Morphine to Oral Hydromorphone
    console.log('\nTest Group 3: Opioid Converter (Oral Morphine -> Oral Hydromorphone)');
    const rot1 = ComfortCareService.convertOpioidEquianalgesic({
      from_opioid: 'MORPHINE',
      from_dose_mg_24h: 120, // 120 mg OME
      from_route: 'ORAL',
      to_opioid: 'HYDROMORPHONE',
      to_route: 'ORAL',
      cross_tolerance_reduction_percent: 25
    });

    // 120 mg OME / 4.0 = 30 mg hydromorphone unadjusted.
    // 25% reduction = 30 * 0.75 = 22.5 mg/24h.
    assert(rot1.baseline_oral_morphine_equivalent_mg_24h === 120, 'Baseline OME computed accurately (120 mg)');
    assert(rot1.unadjusted_target_dose_24h === 30, 'Unadjusted oral hydromorphone dose is 30 mg');
    assert(rot1.recommended_daily_dose === 22.5, 'Recommended daily dose is 22.5 mg after 25% cross-tolerance reduction');
    assert(rot1.cross_tolerance_reduction_applied_percent === 25, 'Applied 25% reduction');
    assert(rot1.breakthrough_prn_dose > 2.0 && rot1.breakthrough_prn_dose < 3.5, 'Calculated appropriate breakthrough PRN dose (2.7 mg)');
    assert(rot1.breakthrough_frequency_and_route.includes('PRN'), 'Specifies PRN breakthrough interval');

    // 4. Opioid Equianalgesic Converter: IV Morphine to Oral Oxycodone
    console.log('\nTest Group 4: Opioid Converter (IV Morphine -> Oral Oxycodone)');
    const rot2 = ComfortCareService.convertOpioidEquianalgesic({
      from_opioid: 'MORPHINE',
      from_dose_mg_24h: 30, // 30 mg IV Morphine * 3.0 = 90 mg OME
      from_route: 'IV',
      to_opioid: 'OXYCODONE',
      to_route: 'ORAL',
      cross_tolerance_reduction_percent: 30
    });

    // 90 mg OME / 1.5 = 60 mg Oral Oxycodone unadjusted.
    // 30% reduction = 60 * 0.70 = 42.0 mg/24h.
    assert(rot2.baseline_oral_morphine_equivalent_mg_24h === 90, 'IV Morphine OME accurately computed (90 mg)');
    assert(rot2.unadjusted_target_dose_24h === 60, 'Unadjusted oral oxycodone is 60 mg');
    assert(rot2.recommended_daily_dose === 42, 'Recommended dose is 42 mg after 30% reduction');

    // 5. Opioid Equianalgesic Converter: High-Dose Oxycodone to Transdermal Fentanyl
    console.log('\nTest Group 5: Opioid Converter (Oral Oxycodone -> Transdermal Fentanyl)');
    const rot3 = ComfortCareService.convertOpioidEquianalgesic({
      from_opioid: 'OXYCODONE',
      from_dose_mg_24h: 80, // 80 * 1.5 = 120 mg OME
      from_route: 'ORAL',
      to_opioid: 'FENTANYL',
      to_route: 'TRANSDERMAL_MCG_HR',
      cross_tolerance_reduction_percent: 25
    });

    // 120 mg OME / 2.4 = 50 mcg/hr unadjusted.
    // 25% reduction = 37.5 mcg/hr -> rounds to commercial patch 37 or 50 mcg/hr.
    assert(rot3.baseline_oral_morphine_equivalent_mg_24h === 120, 'Calculated OME for oxycodone 80 mg (120 mg)');
    assert(rot3.unit === 'mcg/hr patch', 'Target unit is mcg/hr patch');
    assert([37, 50, 25].includes(rot3.recommended_daily_dose), 'Rounded to valid commercial transdermal fentanyl patch');
    assert(rot3.clinical_warnings.some(w => w.includes('subcutaneous reservoir') || w.includes('12-24 hours')), 'Warns of 12-24h delay for patch steady state');
    assert(rot3.breakthrough_frequency_and_route.includes('Oral Morphine'), 'Recommends short-acting oral breakthrough for patch users');

    // 6. Opioid Converter: Renal Impairment Safeguard
    console.log('\nTest Group 6: Renal / Hepatic Impairment Safeguard');
    const rot4 = ComfortCareService.convertOpioidEquianalgesic({
      from_opioid: 'HYDROMORPHONE',
      from_dose_mg_24h: 10,
      from_route: 'ORAL',
      to_opioid: 'MORPHINE',
      to_route: 'ORAL',
      cross_tolerance_reduction_percent: 15, // User requested 15%, but renal should enforce >= 33%
      renal_hepatic_impairment: true
    });

    assert(rot4.cross_tolerance_reduction_applied_percent >= 33, 'Enforced minimum 33% reduction for organ impairment');
    assert(rot4.clinical_warnings.some(w => w.includes('RENAL / HEPATIC IMPAIRMENT')), 'Flags renal/hepatic impairment warning');
    assert(rot4.clinical_warnings.some(w => w.includes('Morphine active metabolites')), 'Warns about M6G/M3G metabolite neurotoxicity in renal failure');

    // 7. Terminal Symptom Assessment: Imminent End-of-Life (PPS 20%)
    console.log('\nTest Group 7: Terminal Symptom Protocol (Imminent End-of-Life PPS 20%)');
    const terminalEval = ComfortCareService.evaluateTerminalSymptoms({
      refractory_dyspnea_present: true,
      respiratory_rate_breaths_min: 28,
      spo2_percent: 88,
      death_rattle_secretions_present: true,
      terminal_agitation_delirium_present: true,
      urinary_retention_ruled_out: false,
      bowel_impaction_ruled_out: false,
      pps_v2_percent: 20,
      polst_code_status: 'DNR_COMFORT_FOCUSED'
    });

    assert(terminalEval.pps_trajectory_classification === 'IMMINENT_END_OF_LIFE', 'PPS 20% classified as IMMINENT_END_OF_LIFE');
    assert(terminalEval.median_survival_prognosis.includes('hours to days'), 'Prognosis identifies hours-to-days survival');
    assert(terminalEval.polst_concordance_review.includes('DNR / Comfort-Focused Care'), 'Confirms DNR/Comfort-focused POLST');
    assert(terminalEval.dyspnea_protocol.some(d => d.includes('sublingual Morphine')), 'Dyspnea protocol includes sublingual morphine');
    assert(terminalEval.dyspnea_protocol.some(d => d.includes('Bedside Fan')), 'Dyspnea protocol includes trigeminal bedside fan');
    assert(terminalEval.dyspnea_protocol.some(d => d.includes('Hypoxemic dyspnea detected')), 'Identified SpO2 88% and ordered low-flow O2');
    assert(terminalEval.secretions_protocol.some(s => s.includes('Glycopyrrolate')), 'Secretions protocol includes Glycopyrrolate');
    assert(terminalEval.secretions_protocol.some(s => s.includes('AVOID DEEP OROPHARYNGEAL SUCTIONING')), 'Strictly warns against deep suctioning');
    assert(terminalEval.agitation_delirium_protocol.some(a => a.includes('bladder scan') || a.includes('urinary retention')), 'Prompts immediate bladder scan for urinary retention');
    assert(terminalEval.agitation_delirium_protocol.some(a => a.includes('Haloperidol')), 'Recommends Haloperidol for terminal delirium');
    assert(terminalEval.agitation_delirium_protocol.some(a => a.includes('Midazolam')), 'Recommends Midazolam for refractory agitation / palliative sedation');

    // 8. Goals of Care Alert: Full Code with Terminal PPS 30%
    console.log('\nTest Group 8: Goals of Care Discordance Alert');
    const fullCodeTerminal = ComfortCareService.evaluateTerminalSymptoms({
      refractory_dyspnea_present: false,
      death_rattle_secretions_present: false,
      terminal_agitation_delirium_present: false,
      urinary_retention_ruled_out: true,
      bowel_impaction_ruled_out: true,
      pps_v2_percent: 30,
      polst_code_status: 'FULL_CODE'
    });

    assert(fullCodeTerminal.pps_trajectory_classification === 'TRANSITIONAL_TERMINAL', 'Classified as TRANSITIONAL_TERMINAL');
    assert(fullCodeTerminal.care_plan_action_items.some(a => a.includes('GOALS OF CARE ALERT')), 'Generated Goals of Care Alert for full code in dying patient');

    // 9. Database Persistence Verification
    console.log('\nTest Group 9: Database Persistence & History Retrieval');
    let patientId = 1;
    const patRes = await pool.query('SELECT id FROM patients LIMIT 1');
    if (patRes.rows.length > 0) {
      patientId = patRes.rows[0].id;
    }

    // Save palliative care encounter
    const encounter = await ComfortCareService.savePalliativeEncounter({
      patient_id: patientId,
      pps_v2_score: 30,
      esas_r_scores: {
        pain: 7,
        tiredness: 8,
        drowsiness: 5,
        nausea: 4,
        appetite: 9,
        shortness_of_breath: 6,
        depression: 4,
        anxiety: 6,
        wellbeing: 8
      },
      polst_code_status: 'DNR_COMFORT_FOCUSED',
      goals_of_care_trajectory: 'END_OF_LIFE_COMFORT',
      terminal_symptoms: {
        refractory_dyspnea: true,
        secretions: true,
        terminal_agitation: false
      },
      care_plan_recommendations: [
        'Discontinue non-comfort vital signs',
        'Bedside fan for dyspnea',
        'Glycopyrrolate 0.2 mg SC q4h PRN'
      ]
    });

    assert(Boolean(encounter.id), 'Successfully saved palliative care encounter in database');
    assert(encounter.polst_code_status === 'DNR_COMFORT_FOCUSED', 'POLST code status correctly persisted');

    // Log opioid rotation
    const rotationLog = await ComfortCareService.logOpioidRotation({
      encounter_id: encounter.id,
      patient_id: patientId,
      from_opioid: 'MORPHINE',
      from_dose_mg_24h: 120,
      from_route: 'ORAL',
      to_opioid: 'HYDROMORPHONE',
      to_route: 'ORAL',
      calculated_equianalgesic_mg: 30,
      cross_tolerance_reduction_percent: 25,
      prescribed_dose_mg_24h: 22.5,
      breakthrough_dose_mg: 2.7,
      breakthrough_interval_hours: 'q2-3h PRN'
    });

    assert(Boolean(rotationLog.id), 'Successfully recorded opioid rotation log');
    assert(rotationLog.from_opioid === 'MORPHINE' && rotationLog.to_opioid === 'HYDROMORPHONE', 'Opioids correctly recorded');
    assert(Number(rotationLog.prescribed_dose_mg_24h) === 22.5, 'Prescribed dose matches (22.5 mg)');

    // Retrieve patient history
    const history = await ComfortCareService.getPatientPalliativeHistory(patientId);
    assert(Array.isArray(history.encounters) && history.encounters.length > 0, 'Retrieved patient palliative encounters');
    assert(Array.isArray(history.opioid_rotations) && history.opioid_rotations.length > 0, 'Retrieved patient opioid rotations');
    assert(history.encounters.some(e => e.id === encounter.id), 'Created encounter found in history');
    assert(history.opioid_rotations.some(r => r.id === rotationLog.id), 'Created rotation log found in history');

    console.log(`\n======================================================`);
    console.log(`Phase 79 COMFORT-CARE Tests Complete: ${passedTests}/${totalTests} Passed (100%)`);
    console.log(`======================================================\n`);
  } catch (error) {
    console.error('Test execution failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
