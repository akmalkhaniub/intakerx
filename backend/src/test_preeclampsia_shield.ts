import { PreeclampsiaShieldService } from './services/preeclampsiaShield';
import { pool } from './db';

async function runTests() {
  console.log('=== RUNNING PREECLAMPSIA-SHIELD (PHASE 97) INTEGRATION TESTS ===\n');
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
    // Test 1: Severe Hypertension without Asthma (IV Labetalol First-Line)
    // -------------------------------------------------------------
    console.log('[Test 1] Severe Hypertension without Asthma (IV Labetalol First-Line)');
    const t1 = PreeclampsiaShieldService.evaluatePreeclampsia({
      patientId: 1,
      gestationalAgeWeeks: 35,
      systolicBp: 172,
      diastolicBp: 114,
      plateletCount: 180000,
      serumCreatinine: 0.8,
      astUL: 28,
      altUL: 24,
      ldhUL: 210,
      totalBilirubinMgDl: 0.6,
      hasAsthmaOrBradycardia: false
    });

    assert(t1.severeHypertension === true, 'Recognized severe hypertension (SBP >= 160 or DBP >= 110)');
    assert(t1.preeclampsiaSeverity === 'PREECLAMPSIA_WITH_SEVERE_FEATURES', 'Severity classified as PREECLAMPSIA_WITH_SEVERE_FEATURES');
    assert(t1.emergencyAntihypertensivePlan.indicated === true, 'Emergency antihypertensive therapy indicated');
    assert(t1.emergencyAntihypertensivePlan.firstLineDrug === 'IV Labetalol', 'First-line drug is IV Labetalol for patient without asthma/bradycardia');
    assert(t1.emergencyAntihypertensivePlan.dosingRoadmap.some(r => r.includes('Labetalol 20 mg IV')), 'Dosing roadmap starts with Labetalol 20 mg IV');
    assert(t1.emergencyAntihypertensivePlan.targetBp.includes('SBP 140 - 150 mmHg'), 'Target BP set to SBP 140-150 mmHg, DBP 90-100 mmHg');

    // -------------------------------------------------------------
    // Test 2: Severe Hypertension with Asthma/Bradycardia (Labetalol Contraindicated)
    // -------------------------------------------------------------
    console.log('\n[Test 2] Severe Hypertension with Asthma/Bradycardia (Labetalol Contraindicated)');
    const t2 = PreeclampsiaShieldService.evaluatePreeclampsia({
      patientId: 1,
      gestationalAgeWeeks: 36,
      systolicBp: 184,
      diastolicBp: 118,
      plateletCount: 160000,
      serumCreatinine: 0.9,
      astUL: 32,
      altUL: 30,
      ldhUL: 240,
      totalBilirubinMgDl: 0.7,
      hasAsthmaOrBradycardia: true
    });

    assert(t2.emergencyAntihypertensivePlan.firstLineDrug.includes('Hydralazine') || t2.emergencyAntihypertensivePlan.firstLineDrug.includes('Nifedipine'), 'Selects Hydralazine/Nifedipine when beta-blockers contraindicated');
    assert(t2.emergencyAntihypertensivePlan.contraindicatedAgents.some(c => c.includes('Labetalol')), 'Explicitly flags IV Labetalol as contraindicated');
    assert(t2.emergencyAntihypertensivePlan.dosingRoadmap.some(r => r.includes('DO NOT bite/puncture')), 'Warns never to bite/puncture Nifedipine capsules');

    // -------------------------------------------------------------
    // Test 3: HELLP Syndrome Classification (Mississippi Class 1, 2, 3)
    // -------------------------------------------------------------
    console.log('\n[Test 3] HELLP Syndrome Mississippi Classification');
    // Class 1: Platelets < 50k, LDH > 600, AST >= 70
    const t3a = PreeclampsiaShieldService.evaluatePreeclampsia({
      patientId: 1,
      gestationalAgeWeeks: 33,
      systolicBp: 156,
      diastolicBp: 98,
      plateletCount: 42000,
      serumCreatinine: 1.2,
      astUL: 180,
      altUL: 165,
      ldhUL: 850,
      totalBilirubinMgDl: 1.8
    });
    assert(t3a.hellpClass === 'CLASS_1_SEVERE', 'Platelets 42k with hemolysis & transaminitis classified as CLASS_1_SEVERE');
    assert(t3a.protocolDirectives.some(d => d.includes('subcapsular liver hematoma')), 'Warns of subcapsular liver hematoma and spontaneous rupture');

    // Class 2: Platelets 50k - 100k
    const t3b = PreeclampsiaShieldService.evaluatePreeclampsia({
      patientId: 1,
      gestationalAgeWeeks: 33,
      systolicBp: 150,
      diastolicBp: 94,
      plateletCount: 78000,
      serumCreatinine: 1.0,
      astUL: 110,
      altUL: 95,
      ldhUL: 680,
      totalBilirubinMgDl: 1.4
    });
    assert(t3b.hellpClass === 'CLASS_2_MODERATE', 'Platelets 78k classified as CLASS_2_MODERATE');

    // Class 3: Platelets 100k - 150k
    const t3c = PreeclampsiaShieldService.evaluatePreeclampsia({
      patientId: 1,
      gestationalAgeWeeks: 33,
      systolicBp: 146,
      diastolicBp: 92,
      plateletCount: 125000,
      serumCreatinine: 0.9,
      astUL: 78,
      altUL: 82,
      ldhUL: 620,
      totalBilirubinMgDl: 1.3
    });
    assert(t3c.hellpClass === 'CLASS_3_MILD', 'Platelets 125k classified as CLASS_3_MILD');

    // -------------------------------------------------------------
    // Test 4: Swansea AFLP Score & Acute Fatty Liver of Pregnancy
    // -------------------------------------------------------------
    console.log('\n[Test 4] Swansea Criteria for Acute Fatty Liver of Pregnancy (AFLP)');
    const t4 = PreeclampsiaShieldService.evaluatePreeclampsia({
      patientId: 1,
      gestationalAgeWeeks: 35,
      systolicBp: 148,
      diastolicBp: 96,
      plateletCount: 88000, // +1
      serumCreatinine: 1.4, // +1
      astUL: 140, // +1
      altUL: 130,
      ldhUL: 710,
      totalBilirubinMgDl: 2.2, // +1
      vomitingOrAbdominalPain: true, // +1
      encephalopathy: true, // +1
      hypoglycemiaMgDl: 54, // +1
      coagulopathyPtSec: 18.5 // +1
    });

    assert(t4.swanseaAflpScore >= 6, `Calculated Swansea AFLP score >= 6 (actual: ${t4.swanseaAflpScore})`);
    assert(t4.aflpSuspected === true, 'AFLP marked suspected (fulminant hepatic necrosis risk)');
    assert(t4.deliveryTimingGuidance.urgency === 'EMERGENT_STAT', 'AFLP triggers EMERGENT_STAT delivery recommendation');

    // -------------------------------------------------------------
    // Test 5: Active Eclampsia Seizure & MgSO4 Management
    // -------------------------------------------------------------
    console.log('\n[Test 5] Active Eclampsia Seizure & MgSO4 Protocol');
    const t5 = PreeclampsiaShieldService.evaluatePreeclampsia({
      patientId: 1,
      gestationalAgeWeeks: 32,
      systolicBp: 168,
      diastolicBp: 112,
      activeEclampticSeizure: true,
      plateletCount: 140000,
      serumCreatinine: 1.0,
      astUL: 45,
      altUL: 40,
      ldhUL: 320,
      totalBilirubinMgDl: 0.8
    });

    assert(t5.preeclampsiaSeverity === 'ECLAMPSIA_ACTIVE_SEIZURE', 'Classified as ECLAMPSIA_ACTIVE_SEIZURE');
    assert(t5.mgso4Plan.indicated === true, 'MgSO4 indicated for eclampsia seizure');
    assert(t5.mgso4Plan.loadingDose.includes('4.0 - 6.0 g IV'), 'Loading dose specifies 4-6g IV over 15-20 min');
    assert(t5.mgso4Plan.antidoteOrder.includes('Calcium Gluconate'), 'Calcium Gluconate 1g IV specified as bedside antidote');
    assert(t5.deliveryTimingGuidance.urgency === 'EMERGENT_STAT', 'Eclampsia dictates STAT delivery upon stabilization');

    // -------------------------------------------------------------
    // Test 6: Delivery Timing Based on Gestational Age (<34w vs >=34w vs >=37w)
    // -------------------------------------------------------------
    console.log('\n[Test 6] Delivery Timing Guidance & Antenatal Corticosteroids');
    // Preterm < 34w with severe features
    const t6a = PreeclampsiaShieldService.evaluatePreeclampsia({
      patientId: 1,
      gestationalAgeWeeks: 31,
      systolicBp: 164,
      diastolicBp: 104,
      plateletCount: 150000,
      serumCreatinine: 0.8,
      astUL: 30,
      altUL: 28,
      ldhUL: 220,
      totalBilirubinMgDl: 0.5
    });
    assert(t6a.deliveryTimingGuidance.corticosteroidsIndicated === true, 'Corticosteroids indicated for gestational age < 34 weeks');
    assert(t6a.protocolDirectives.some(d => d.includes('Betamethasone 12 mg IM')), 'Orders Betamethasone 12 mg IM for fetal lung maturation');

    // Late preterm >= 34w with severe features
    const t6b = PreeclampsiaShieldService.evaluatePreeclampsia({
      patientId: 1,
      gestationalAgeWeeks: 34.5,
      systolicBp: 166,
      diastolicBp: 108,
      plateletCount: 150000,
      serumCreatinine: 0.8,
      astUL: 30,
      altUL: 28,
      ldhUL: 220,
      totalBilirubinMgDl: 0.5
    });
    assert(t6b.deliveryTimingGuidance.corticosteroidsIndicated === false, 'Corticosteroids not routinely indicated >= 34 weeks in severe preeclampsia');
    assert(t6b.deliveryTimingGuidance.recommendation.includes('>= 34 weeks with severe features: Delivery recommended'), 'Recommends delivery at >= 34 weeks with severe features');

    // Term >= 37w without severe features
    const t6c = PreeclampsiaShieldService.evaluatePreeclampsia({
      patientId: 1,
      gestationalAgeWeeks: 38,
      systolicBp: 144,
      diastolicBp: 92,
      plateletCount: 220000,
      serumCreatinine: 0.7,
      astUL: 24,
      altUL: 22,
      ldhUL: 180,
      totalBilirubinMgDl: 0.4
    });
    assert(t6c.preeclampsiaSeverity === 'PREECLAMPSIA_WITHOUT_SEVERE_FEATURES', 'Preeclampsia without severe features');
    assert(t6c.deliveryTimingGuidance.recommendation.includes('Induction of labor recommended'), 'Recommends induction of labor at >= 37 weeks');

    // -------------------------------------------------------------
    // Test 7: Hourly Magnesium Surveillance & Toxicity Detection
    // -------------------------------------------------------------
    console.log('\n[Test 7] Magnesium Surveillance: Respiratory Depression (Stat Antidote)');
    const t7a = PreeclampsiaShieldService.evaluateMagnesiumSurveillance({
      patientId: 1,
      hoursOnMgso4: 4,
      currentInfusionRateGH: 2.0,
      patellarReflexIntact: false,
      respiratoryRate: 10, // < 12
      hourlyUrineOutputMl: 45
    });
    assert(t7a.toxicityFlag === 'RESPIRATORY_DEPRESSION', 'Detected respiratory depression (RR < 12)');
    assert(t7a.titrationAction === 'STAT_CALCIUM_GLUCONATE', 'Directs STAT Calcium Gluconate');
    assert(t7a.clinicalDirective.includes('Calcium Gluconate 10% 10 mL (1g) IV push'), 'Prescribes Calcium Gluconate 1g IV push');

    console.log('\n[Test 8] Magnesium Surveillance: Loss of Patellar Reflexes');
    const t7b = PreeclampsiaShieldService.evaluateMagnesiumSurveillance({
      patientId: 1,
      hoursOnMgso4: 2,
      currentInfusionRateGH: 2.0,
      patellarReflexIntact: false,
      respiratoryRate: 15,
      hourlyUrineOutputMl: 40
    });
    assert(t7b.toxicityFlag === 'LOSS_OF_REFLEXES', 'Detected loss of patellar reflexes');
    assert(t7b.titrationAction === 'HOLD_AND_REDUCE', 'Action is HOLD_AND_REDUCE');

    console.log('\n[Test 9] Magnesium Surveillance: Oliguria Accumulation Risk');
    const t7c = PreeclampsiaShieldService.evaluateMagnesiumSurveillance({
      patientId: 1,
      hoursOnMgso4: 6,
      currentInfusionRateGH: 2.0,
      patellarReflexIntact: true,
      respiratoryRate: 16,
      hourlyUrineOutputMl: 22 // < 30 mL/h
    });
    assert(t7c.toxicityFlag === 'OLIGURIA_ACCUMULATION_RISK', 'Detected oliguria accumulation risk (< 30 mL/h)');
    assert(t7c.titrationAction === 'HOLD_AND_REDUCE', 'Action is HOLD_AND_REDUCE due to renal clearance loss');

    console.log('\n[Test 10] Magnesium Surveillance: Normal Therapeutic Run');
    const t7d = PreeclampsiaShieldService.evaluateMagnesiumSurveillance({
      patientId: 1,
      hoursOnMgso4: 3,
      currentInfusionRateGH: 2.0,
      patellarReflexIntact: true,
      respiratoryRate: 16,
      hourlyUrineOutputMl: 55,
      serumMagnesiumMgDl: 5.8
    });
    assert(t7d.toxicityFlag === 'NONE_THERAPEUTIC', 'Therapeutic and safe');
    assert(t7d.titrationAction === 'MAINTAIN', 'Action is MAINTAIN');

    // -------------------------------------------------------------
    // Test 11: Database Persistence of Evaluation and Surveillance Logs
    // -------------------------------------------------------------
    console.log('\n[Test 11] Database Persistence for Encounters & Magnesium Logs');
    
    // Ensure test patient exists
    const patientCheck = await pool.query('SELECT id FROM patients WHERE id = 1');
    if (patientCheck.rowCount === 0) {
      await pool.query(`
        INSERT INTO patients (id, name, email, password_hash, dob, sex)
        VALUES (1, 'Test Ob Patient', 'obpatient@example.com', 'hash123', '1995-05-15', 'Female')
        ON CONFLICT (id) DO NOTHING;
      `);
    }

    const savedEncId = await PreeclampsiaShieldService.persistEvaluation(t1);
    assert(typeof savedEncId === 'number' && savedEncId > 0, `Preeclampsia encounter persisted with ID ${savedEncId}`);

    const savedLogId = await PreeclampsiaShieldService.persistMagnesiumLog({
      ...t7d,
      encounterId: savedEncId
    });
    assert(typeof savedLogId === 'number' && savedLogId > 0, `Magnesium surveillance log persisted with ID ${savedLogId}`);

    const evaluations = await PreeclampsiaShieldService.getEvaluations(1);
    assert(evaluations.length > 0, `Retrieved ${evaluations.length} evaluation(s) for patient 1`);

    const logs = await PreeclampsiaShieldService.getMagnesiumLogs(1);
    assert(logs.length > 0, `Retrieved ${logs.length} magnesium surveillance log(s) for patient 1`);

    console.log(`\n=============================================================`);
    console.log(`PREECLAMPSIA-SHIELD TEST SUITE FINISHED: ${passed} PASSED, ${failed} FAILED`);
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
