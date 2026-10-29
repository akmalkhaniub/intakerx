import { MaternalCodeService } from './services/maternalCode';
import { pool } from './db';

async function runTests() {
  console.log('=== RUNNING MATERNAL-CODE (PHASE 96) INTEGRATION TESTS ===\n');
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
    // Test 1: Aortocaval Compression Risk & Missing LUD Alert
    // -------------------------------------------------------------
    console.log('[Test 1] Aortocaval Compression Risk & Ineffective CPR without LUD');
    const t1 = MaternalCodeService.evaluateMaternalCode({
      patientId: 1,
      gestationalAgeWeeks: 32,
      arrestRhythm: 'PEA',
      etiologySuspected: 'PULMONARY_EMBOLISM',
      minutesSinceArrest: 1.5,
      ludActive: false
    });

    assert(t1.aortocavalCompressionRisk === true, 'Gravid uterus >= 20 weeks correctly recognized as causing aortocaval compression');
    assert(t1.ludGuidance.warning !== undefined, 'Issued critical warning: CPR ineffective without manual LUD');
    assert(Boolean(t1.protocolDirectives.some(d => d.includes('Manual Left Uterine Displacement'))), 'Directs immediate manual LUD');

    // -------------------------------------------------------------
    // Test 2: Active Manual LUD on Flat Firm Surface
    // -------------------------------------------------------------
    console.log('\n[Test 2] Manual LUD Active (Flat Firm Backboard)');
    const t2 = MaternalCodeService.evaluateMaternalCode({
      patientId: 1,
      gestationalAgeWeeks: 34,
      arrestRhythm: 'ASYSTOLE',
      etiologySuspected: 'MASSIVE_OB_HEMORRHAGE',
      minutesSinceArrest: 2.0,
      ludActive: true
    });

    assert(t2.ludGuidance.ludActive === true, 'LUD confirmed active');
    assert(Boolean(t2.protocolDirectives.some(d => d.includes('Do NOT tilt patient backboard'))), 'Prohibits tilting patient backboard to maintain compression depth');

    // -------------------------------------------------------------
    // Test 3: The 4-Minute Rule & Bedside Scalpel Countdown
    // -------------------------------------------------------------
    console.log('\n[Test 3] The 4-Minute Rule: Bedside Scalpel Alert (<4 min)');
    const t3 = MaternalCodeService.evaluateMaternalCode({
      patientId: 1,
      gestationalAgeWeeks: 30,
      arrestRhythm: 'PEA',
      etiologySuspected: 'CARDIAC_DISEASE',
      minutesSinceArrest: 2.5,
      ludActive: true,
      roscAchieved: false
    });

    assert(t3.pmcsGuidance.indicated === true, 'PMCS indicated for arrest >= 20 weeks without ROSC');
    assert(t3.pmcsGuidance.actionRequired === 'PREPARE_BEDSIDE_TRAY', 'Directs PREPARE_BEDSIDE_TRAY before 4:00');
    assert(t3.pmcsGuidance.countdownMinutesToIncision === 1.5, 'Countdown to incision is 1.5 minutes (4.0 - 2.5)');
    assert(t3.pmcsGuidance.countdownMinutesToDelivery === 2.5, 'Countdown to delivery is 2.5 minutes (5.0 - 2.5)');

    // -------------------------------------------------------------
    // Test 4: The 4-Minute Rule Triggered: STAT PMCS Incision Now (>= 4 min)
    // -------------------------------------------------------------
    console.log('\n[Test 4] The 4-Minute Rule Triggered: STAT PMCS Incision (>= 4 min)');
    const t4 = MaternalCodeService.evaluateMaternalCode({
      patientId: 1,
      gestationalAgeWeeks: 36,
      arrestRhythm: 'PEA',
      etiologySuspected: 'AMNIOTIC_FLUID_EMBOLISM',
      minutesSinceArrest: 4.2,
      ludActive: true,
      roscAchieved: false
    });

    assert(t4.pmcsGuidance.actionRequired === 'STAT_PMCS_INCISION_NOW', 'Triggers STAT_PMCS_INCISION_NOW at minute 4.2');
    assert(t4.pmcsGuidance.countdownMinutesToIncision === 0, 'Countdown to incision is 0');
    assert(Boolean(t4.protocolDirectives.some(d => d.includes('Make immediate bedside surgical incision'))), 'Directs immediate incision without transfer to OR');

    // -------------------------------------------------------------
    // Test 5: Previable Gestational Age (< 20 Weeks)
    // -------------------------------------------------------------
    console.log('\n[Test 5] Previable Gestational Age (< 20 Weeks): PMCS Not Indicated');
    const t5 = MaternalCodeService.evaluateMaternalCode({
      patientId: 1,
      gestationalAgeWeeks: 16,
      arrestRhythm: 'VF_VT',
      etiologySuspected: 'CARDIAC_DISEASE',
      minutesSinceArrest: 5.0,
      ludActive: false
    });

    assert(t5.aortocavalCompressionRisk === false, 'No aortocaval compression at 16 weeks');
    assert(t5.pmcsGuidance.indicated === false, 'PMCS not indicated for previable fetus');
    assert(t5.pmcsGuidance.actionRequired === 'NOT_INDICATED_PREVIABLE', 'Action is NOT_INDICATED_PREVIABLE');

    // -------------------------------------------------------------
    // Test 6: Amniotic Fluid Embolism (AFE) Sentinel & A-OK Regimen
    // -------------------------------------------------------------
    console.log('\n[Test 6] Amniotic Fluid Embolism (AFE) Sentinel & A-OK Pharmacological Protocol');
    const t6 = MaternalCodeService.evaluateMaternalCode({
      patientId: 1,
      gestationalAgeWeeks: 39,
      arrestRhythm: 'PEA',
      etiologySuspected: 'AMNIOTIC_FLUID_EMBOLISM',
      minutesSinceArrest: 1.0,
      ludActive: true
    });

    assert(t6.aokPlan !== undefined, 'A-OK rescue plan generated for AFE');
    assert(Boolean(t6.aokPlan?.atropineDose.includes('Atropine 1.0 mg IV')), 'Includes Atropine 1 mg IV for vagal/coronary spasm');
    assert(Boolean(t6.aokPlan?.ondansetronDose.includes('Ondansetron 8.0 mg IV')), 'Includes Ondansetron 8 mg IV for serotonin-mediated pulmonary vasoconstriction');
    assert(Boolean(t6.aokPlan?.ketorolacDose.includes('Ketorolac 30.0 mg IV')), 'Includes Ketorolac 30 mg IV for thromboxane blockade');
    assert(Boolean(t6.aokPlan?.rvProtectiveDirectives.some((d: string) => d.includes('Avoid fluid overloading'))), 'Directs RV protective ventilation and limits crystalloid overload');

    // -------------------------------------------------------------
    // Test 7: Consumptive Coagulopathy / DIC Protocol in Pregnancy
    // -------------------------------------------------------------
    console.log('\n[Test 7] Consumptive Coagulopathy / DIC Protocol (Fibrinogen < 200 mg/dL & TXA)');
    const t7 = MaternalCodeService.evaluateMaternalCode({
      patientId: 1,
      gestationalAgeWeeks: 38,
      arrestRhythm: 'SEVERE_COLLAPSE_PRE_ARREST',
      etiologySuspected: 'AMNIOTIC_FLUID_EMBOLISM',
      minutesSinceArrest: 3.0,
      ludActive: true,
      fibrinogenLevelMgDl: 130, // Severely depleted for pregnancy
      activeBleedingFromLinesOrSites: true
    });

    assert(t7.coagulopathyPlan?.dicSuspected === true, 'Identifies consumptive DIC');
    assert(t7.coagulopathyPlan?.cryoprecipitateRecommended === true, 'Directs emergent Cryoprecipitate for fibrinogen < 200 mg/dL');
    assert(t7.coagulopathyPlan?.txaRecommended === true, 'Directs Tranexamic Acid 1g IV over 10 min');
    assert(Boolean(t7.protocolDirectives.some(d => d.includes('Cryoprecipitate 10 - 20 units'))), 'Directs 10-20 units Cryo');

    // -------------------------------------------------------------
    // Test 8: Magnesium Toxicity Cardiac Arrest Sentinel
    // -------------------------------------------------------------
    console.log('\n[Test 8] Magnesium Sulfate Toxicity Arrest Protocol');
    const t8 = MaternalCodeService.evaluateMaternalCode({
      patientId: 1,
      gestationalAgeWeeks: 34,
      arrestRhythm: 'PEA',
      etiologySuspected: 'MAGNESIUM_TOXICITY',
      minutesSinceArrest: 1.0,
      ludActive: true
    });

    assert(Boolean(t8.protocolDirectives.some(d => d.includes('Calcium Gluconate 10%'))), 'Directs immediate Calcium Gluconate antidote');
    assert(Boolean(t8.protocolDirectives.some(d => d.includes('stop all MgSO4 infusions'))), 'Directs immediate cessation of MgSO4');

    // -------------------------------------------------------------
    // Test 9: Interventions Logging & Feedback
    // -------------------------------------------------------------
    console.log('\n[Test 9] Resuscitation Intervention Logging');
    const int1 = MaternalCodeService.logIntervention({
      patientId: 1,
      elapsedMinutes: 1.0,
      interventionType: 'LUD_POSITIONING',
      agentOrAction: 'Manual Two-Handed LUD',
      dosageOrDetails: 'Leftward displacement of fundus on firm backboard',
      hemodynamicResponse: 'Palpable femoral pulse during compressions'
    });
    assert(int1.clinicalFeedback.includes('Left Uterine Displacement confirmed'), 'Generated clinical feedback for LUD');

    const int2 = MaternalCodeService.logIntervention({
      patientId: 1,
      elapsedMinutes: 4.0,
      interventionType: 'PMCS_INCISION',
      agentOrAction: 'Vertical midline abdominal incision',
      dosageOrDetails: 'Scalpel No 10 to rectus sheath and lower uterine segment',
      hemodynamicResponse: 'Infant delivering'
    });
    assert(int2.clinicalFeedback.includes('Resuscitative Hysterotomy'), 'Generated clinical feedback for PMCS incision');

    // -------------------------------------------------------------
    // Test 10: Database Persistence & Retrieval
    // -------------------------------------------------------------
    console.log('\n[Test 10] Database Persistence: Maternal Code Encounters & Intervention Logs');
    const encId = await MaternalCodeService.persistEvaluation(t4);
    assert(encId > 0, `Maternal code encounter persisted with ID: ${encId}`);

    const evals = await MaternalCodeService.getEvaluations(1);
    assert(evals.length > 0, `Retrieved ${evals.length} evaluation(s) for patient 1`);
    assert(evals[0].etiology_suspected === 'AMNIOTIC_FLUID_EMBOLISM', 'Stored etiology is AMNIOTIC_FLUID_EMBOLISM');

    const logId = await MaternalCodeService.persistIntervention(int1);
    assert(logId > 0, `Intervention log persisted with ID: ${logId}`);

    const logs = await MaternalCodeService.getInterventions(1);
    assert(logs.length > 0, `Retrieved ${logs.length} intervention log(s) for patient 1`);
    assert(logs[0].intervention_type === 'LUD_POSITIONING', 'Stored intervention type is LUD_POSITIONING');

    console.log(`\n=================================================`);
    console.log(`MATERNAL-CODE TESTS COMPLETED: ${passed} passed, ${failed} failed`);
    console.log(`=================================================`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution exception:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
