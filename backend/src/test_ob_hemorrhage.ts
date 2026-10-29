import { ObHemorrhageService } from './services/obHemorrhage';
import { pool } from './db';

async function runTests() {
  console.log('=== RUNNING OB-HEMORRHAGE (PHASE 98) INTEGRATION TESTS ===\n');
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
    // Test 1: Stage 1 PPH (Vaginal Delivery QBL > 500 mL)
    // -------------------------------------------------------------
    console.log('[Test 1] Stage 1 PPH (Vaginal QBL > 500 mL, Normal Vitals)');
    const t1 = ObHemorrhageService.evaluateHemorrhage({
      patientId: 1,
      deliveryMode: 'VAGINAL',
      qblMl: 650,
      heartRate: 88,
      systolicBp: 118,
      diastolicBp: 74,
      minutesPostpartum: 25,
      fundusBoggyOrAtonic: true
    });

    assert(t1.pphStage === 'STAGE_1_MILD', 'Classified as STAGE_1_MILD PPH');
    assert(t1.shockIndexElevated === false, 'Shock index is normal (< 0.9)');
    assert(t1.uterotonicCascade.firstLine.includes('Oxytocin'), 'First-line uterotonic is Oxytocin');
    assert(t1.protocolDirectives.some(d => d.includes('STAGE 1 OB-HEMORRHAGE')), 'Directs Stage 1 bundle (massage, 2 large-bore IVs, Oxytocin)');

    // -------------------------------------------------------------
    // Test 2: Stage 2 PPH (QBL 1000-1500 mL with Shock Index >= 0.9)
    // -------------------------------------------------------------
    console.log('\n[Test 2] Stage 2 PPH (QBL 1200 mL, Tachycardia, Shock Index >= 0.9)');
    const t2 = ObHemorrhageService.evaluateHemorrhage({
      patientId: 1,
      deliveryMode: 'VAGINAL',
      qblMl: 1200,
      heartRate: 115,
      systolicBp: 92,
      diastolicBp: 58,
      minutesPostpartum: 45,
      fundusBoggyOrAtonic: true
    });

    assert(t2.pphStage === 'STAGE_2_MODERATE', 'Classified as STAGE_2_MODERATE PPH');
    assert(t2.shockIndexElevated === true, `Shock index elevated (actual: ${t2.shockIndex} >= 0.9)`);
    assert(t2.txaGuidance.indicated === true, 'TXA indicated in Stage 2 PPH');
    assert(t2.txaGuidance.withinWindow === true, 'TXA within 3-hour window per WOMAN trial');
    assert(t2.bakriBalloonGuidance.indicated === true, 'Bakri balloon tamponade indicated for refractory atony');

    // -------------------------------------------------------------
    // Test 3: Stage 3 Severe PPH (QBL > 1500 mL, MTP Activation)
    // -------------------------------------------------------------
    console.log('\n[Test 3] Stage 3 Severe PPH (QBL 1900 mL, MTP Activation & 1:1:1 Ratio)');
    const t3 = ObHemorrhageService.evaluateHemorrhage({
      patientId: 1,
      deliveryMode: 'CESAREAN',
      qblMl: 1900,
      heartRate: 130,
      systolicBp: 78,
      diastolicBp: 42,
      minutesPostpartum: 60,
      activeTransfusionUnitsPrbc: 2,
      fibrinogenMgDl: 160
    });

    assert(t3.pphStage === 'STAGE_3_SEVERE_MTP', 'Classified as STAGE_3_SEVERE_MTP');
    assert(t3.mtpAndSurgicalPlan.mtpActivated === true, 'Massive Transfusion Protocol (MTP) activated');
    assert(t3.mtpAndSurgicalPlan.ratioProtocol.includes('1:1:1'), 'Specifies balanced 1:1:1 transfusion protocol');
    assert(t3.mtpAndSurgicalPlan.surgicalInterventions.some(s => s.includes('B-Lynch')), 'Includes B-Lynch compressive sutures in surgical escalation');

    // -------------------------------------------------------------
    // Test 4: Uterotonic Cascade Contraindications (Hypertension / Preeclampsia)
    // -------------------------------------------------------------
    console.log('\n[Test 4] Uterotonic Cascade: Preeclampsia / HTN (Methergine Contraindicated)');
    const t4 = ObHemorrhageService.evaluateHemorrhage({
      patientId: 1,
      deliveryMode: 'VAGINAL',
      qblMl: 1100,
      heartRate: 105,
      systolicBp: 162,
      diastolicBp: 102,
      minutesPostpartum: 35,
      hasHypertensionOrPreeclampsia: true
    });

    const methergineStep = t4.uterotonicCascade.orderedLadder.find(s => s.agent.includes('Methergine'));
    assert(Boolean(methergineStep?.contraindicated), 'Methergine flagged as strictly contraindicated in hypertension');
    assert(Boolean(methergineStep?.reason?.includes('Hypertension / Preeclampsia')), 'Explains vasoconstriction and cerebral hemorrhage risk');
    assert(Boolean(t4.uterotonicCascade.activeWarning?.includes('Skip Methergine')), 'Issues warning to skip Methergine');

    // -------------------------------------------------------------
    // Test 5: Uterotonic Cascade Contraindications (Asthma / Bronchospasm)
    // -------------------------------------------------------------
    console.log('\n[Test 5] Uterotonic Cascade: Asthma / Bronchospasm (Carboprost Contraindicated)');
    const t5 = ObHemorrhageService.evaluateHemorrhage({
      patientId: 1,
      deliveryMode: 'VAGINAL',
      qblMl: 1100,
      heartRate: 100,
      systolicBp: 110,
      diastolicBp: 70,
      minutesPostpartum: 30,
      hasAsthmaOrBronchospasm: true
    });

    const carboprostStep = t5.uterotonicCascade.orderedLadder.find(s => s.agent.includes('Carboprost'));
    assert(Boolean(carboprostStep?.contraindicated), 'Carboprost/Hemabate flagged as strictly contraindicated in asthma');
    assert(Boolean(carboprostStep?.reason?.includes('Asthma / Bronchospasm')), 'Explains severe bronchoconstriction risk');
    assert(Boolean(t5.uterotonicCascade.activeWarning?.includes('Skip Carboprost')), 'Issues warning to skip Carboprost');

    // -------------------------------------------------------------
    // Test 6: Dual Contraindication (Asthma AND Preeclampsia)
    // -------------------------------------------------------------
    console.log('\n[Test 6] Dual Contraindication: Both Methergine AND Carboprost Contraindicated');
    const t6 = ObHemorrhageService.evaluateHemorrhage({
      patientId: 1,
      deliveryMode: 'VAGINAL',
      qblMl: 1300,
      heartRate: 112,
      systolicBp: 168,
      diastolicBp: 104,
      minutesPostpartum: 40,
      hasHypertensionOrPreeclampsia: true,
      hasAsthmaOrBronchospasm: true
    });

    assert(Boolean(t6.uterotonicCascade.activeWarning?.includes('DUAL CONTRAINDICATION')), 'Identifies dual contraindication');
    assert(Boolean(t6.uterotonicCascade.activeWarning?.includes('Misoprostol 800-1000 mcg')), 'Directs immediate leap to Misoprostol and balloon tamponade');

    // -------------------------------------------------------------
    // Test 7: Placenta Accreta Spectrum (PAS) Risk Stratification
    // -------------------------------------------------------------
    console.log('\n[Test 7] Placenta Accreta Spectrum (PAS) Risk Calculation');
    // Placenta Previa + 2 Prior Cesareans = ~40% Risk
    const t7a = ObHemorrhageService.evaluateHemorrhage({
      patientId: 1,
      deliveryMode: 'CESAREAN',
      qblMl: 800,
      heartRate: 98,
      systolicBp: 112,
      diastolicBp: 68,
      minutesPostpartum: 15,
      placentaPreviaPresent: true,
      priorCesareansCount: 2
    });
    assert(t7a.pasRiskPercentage === 40, 'Accreta risk calculated as 40% for Previa + 2 Prior Cesareans');
    assert(t7a.etiology === 'TISSUE_RETAINED_OR_ACCRETA', 'Etiology classified as TISSUE_RETAINED_OR_ACCRETA');
    assert(t7a.protocolDirectives.some(d => d.includes('DO NOT forcibly peel')), 'Strictly prohibits manual peeling of placenta');

    // Placenta Previa + 3 Prior Cesareans = ~61% Risk
    const t7b = ObHemorrhageService.evaluateHemorrhage({
      patientId: 1,
      deliveryMode: 'CESAREAN',
      qblMl: 900,
      heartRate: 102,
      systolicBp: 110,
      diastolicBp: 65,
      minutesPostpartum: 15,
      placentaPreviaPresent: true,
      priorCesareansCount: 3
    });
    assert(t7b.pasRiskPercentage === 61, 'Accreta risk calculated as 61% for Previa + >=3 Prior Cesareans');

    // -------------------------------------------------------------
    // Test 8: WOMAN Trial TXA Timing Window (>3h warning)
    // -------------------------------------------------------------
    console.log('\n[Test 8] Tranexamic Acid Post-3-Hour Window Warning');
    const t8 = ObHemorrhageService.evaluateHemorrhage({
      patientId: 1,
      deliveryMode: 'VAGINAL',
      qblMl: 1100,
      heartRate: 104,
      systolicBp: 106,
      diastolicBp: 68,
      minutesPostpartum: 210 // 3.5 hours postpartum (>180 min)
    });
    assert(t8.txaGuidance.withinWindow === false, 'Correctly flags time as exceeding 3-hour window');
    assert(t8.txaGuidance.cautionNote.includes('CAUTION: >3 hours postpartum'), 'Includes trial evidence warning about lack of benefit beyond 3 hours');

    // -------------------------------------------------------------
    // Test 9: Intrauterine Bakri Balloon Guidance
    // -------------------------------------------------------------
    console.log('\n[Test 9] Intrauterine Bakri Balloon Tamponade Test');
    assert(t2.bakriBalloonGuidance.targetVolumeMl === '300 - 500 mL sterile saline', 'Target volume is 300 - 500 mL sterile saline');
    assert(t2.bakriBalloonGuidance.tamponadeTestCriteria.includes('>50 mL rapid drainage'), 'Defines negative test criteria triggering laparotomy');

    // -------------------------------------------------------------
    // Test 10: Uterotonic Administration Logging & Response Feedback
    // -------------------------------------------------------------
    console.log('\n[Test 10] Uterotonic Administration Feedback & Adverse Event Alerts');
    // Ongoing atony after Oxytocin
    const log1 = ObHemorrhageService.logUterotonicAdministration({
      patientId: 1,
      agent: 'OXYTOCIN',
      dose: '30 units in 500 mL NS',
      route: 'IV Infusion',
      cumulativeDose: '30 units',
      responseObserved: 'ONGOING_ATONY'
    });
    assert(log1.nextStepAction.includes('Second-Line Uterotonic'), 'Directs second-line uterotonic when Oxytocin fails');

    // Adverse hypertension after Methergine
    const log2 = ObHemorrhageService.logUterotonicAdministration({
      patientId: 1,
      agent: 'METHERGINE',
      dose: '0.2 mg IM',
      route: 'IM',
      cumulativeDose: '0.2 mg',
      responseObserved: 'ADVERSE_HYPERTENSION'
    });
    assert(log2.clinicalFeedback.includes('ADVERSE EVENT: Acute hypertensive surge'), 'Alerts to ergot-induced vasospasm surge');
    assert(log2.nextStepAction.includes('Cease ergot alkaloids'), 'Orders immediate cessation of ergot alkaloids');

    // Adverse bronchospasm after Carboprost
    const log3 = ObHemorrhageService.logUterotonicAdministration({
      patientId: 1,
      agent: 'CARBOPROST_HEMABATE',
      dose: '250 mcg IM',
      route: 'IM',
      cumulativeDose: '250 mcg',
      responseObserved: 'ADVERSE_BRONCHOSPASM'
    });
    assert(log3.clinicalFeedback.includes('Bronchospasm following CARBOPROST_HEMABATE'), 'Alerts to prostaglandin airway constriction');
    assert(log3.nextStepAction.includes('Cease prostaglandin F2alpha'), 'Directs cessation and bronchodilators');

    // Atony resolved
    const log4 = ObHemorrhageService.logUterotonicAdministration({
      patientId: 1,
      agent: 'MISOPROSTOL',
      dose: '800 mcg',
      route: 'Sublingual',
      cumulativeDose: '800 mcg',
      responseObserved: 'ATONY_RESOLVED'
    });
    assert(log4.responseObserved === 'ATONY_RESOLVED', 'Atony resolved');
    assert(log4.nextStepAction.includes('Maintain slow Oxytocin maintenance infusion'), 'Directs maintenance Oxytocin post-stabilization');

    // -------------------------------------------------------------
    // Test 11: Database Persistence of Hemorrhage Encounter & Uterotonic Logs
    // -------------------------------------------------------------
    console.log('\n[Test 11] Database Persistence for Hemorrhage Encounters & Uterotonic Logs');
    
    // Ensure test patient exists
    const patientCheck = await pool.query('SELECT id FROM patients WHERE id = 1');
    if (patientCheck.rowCount === 0) {
      await pool.query(`
        INSERT INTO patients (id, name, email, password_hash, dob, sex)
        VALUES (1, 'Test Ob Patient', 'obpatient@example.com', 'hash123', '1995-05-15', 'Female')
        ON CONFLICT (id) DO NOTHING;
      `);
    }

    const savedEncId = await ObHemorrhageService.persistHemorrhageEncounter(t3);
    assert(typeof savedEncId === 'number' && savedEncId > 0, `Hemorrhage encounter persisted with ID ${savedEncId}`);

    const savedLogId = await ObHemorrhageService.persistUterotonicLog({
      ...log4,
      encounterId: savedEncId
    });
    assert(typeof savedLogId === 'number' && savedLogId > 0, `Uterotonic administration log persisted with ID ${savedLogId}`);

    const encounters = await ObHemorrhageService.getHemorrhageEncounters(1);
    assert(encounters.length > 0, `Retrieved ${encounters.length} hemorrhage encounter(s) for patient 1`);

    const logs = await ObHemorrhageService.getUterotonicLogs(1);
    assert(logs.length > 0, `Retrieved ${logs.length} uterotonic log(s) for patient 1`);

    console.log(`\n=============================================================`);
    console.log(`OB-HEMORRHAGE TEST SUITE FINISHED: ${passed} PASSED, ${failed} FAILED`);
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
