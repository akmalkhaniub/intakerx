import { GraftPulseService } from './services/graftPulse';
import { pool } from './db';

async function runGraftPulseTests() {
  console.log('========================================================');
  console.log('--- Phase 84: GRAFT-PULSE Command Integration Tests ----');
  console.log('========================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, message: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✓ ${message}`);
      passedTests++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      throw new Error(`Test failed: ${message}`);
    }
  }

  try {
    // ---------------------------------------------------------
    // Test Group 1: ISHLT Lung PGD Classification (Grades 0 - 3)
    // ---------------------------------------------------------
    console.log('Test Group 1: ISHLT Lung Primary Graft Dysfunction (PGD)');
    // Grade 0: Clear lung fields, no diffuse alveolar infiltrates
    const lungGrade0 = GraftPulseService.assessLungPGD({
      pao2Mmhg: 280,
      fio2: 0.5, // P/F = 560
      radiographicInfiltrates: false
    });
    assert(lungGrade0.pgdGrade === 'GRADE_0', 'Grade 0 confirmed when radiographic infiltrates are absent');
    assert(lungGrade0.pao2Fio2Ratio === 560, 'P/F ratio calculated accurately (560)');
    assert(lungGrade0.inhaledVasodilatorRecommended === 'NONE', 'No inhaled vasodilator needed for Grade 0');

    // Grade 1: Infiltrates present, P/F > 300
    const lungGrade1 = GraftPulseService.assessLungPGD({
      pao2Mmhg: 220,
      fio2: 0.6, // P/F = 366.7
      radiographicInfiltrates: true
    });
    assert(lungGrade1.pgdGrade === 'GRADE_1', 'Grade 1 confirmed (infiltrates with P/F > 300)');
    assert(lungGrade1.pao2Fio2Ratio > 300, 'P/F ratio > 300');

    // Grade 2: Infiltrates present, 200 <= P/F <= 300
    const lungGrade2 = GraftPulseService.assessLungPGD({
      pao2Mmhg: 120,
      fio2: 0.5, // P/F = 240
      radiographicInfiltrates: true
    });
    assert(lungGrade2.pgdGrade === 'GRADE_2', 'Grade 2 confirmed (infiltrates with 200 <= P/F <= 300)');
    assert(lungGrade2.inhaledVasodilatorRecommended === 'INO', 'Recommends Inhaled Nitric Oxide for Grade 2');
    assert(lungGrade2.suggestedVasodilatorDose.includes('20 - 40 ppm'), 'Doses iNO at 20 - 40 ppm');

    // Grade 3: Infiltrates present, P/F < 200
    const lungGrade3 = GraftPulseService.assessLungPGD({
      pao2Mmhg: 85,
      fio2: 0.9, // P/F = 94.4
      radiographicInfiltrates: true
    });
    assert(lungGrade3.pgdGrade === 'GRADE_3', 'Grade 3 confirmed (infiltrates with P/F < 200)');
    assert(lungGrade3.ecmoIndicated === true, 'Triggers VV-ECMO indication for severe Grade 3 (P/F < 100)');
    assert(lungGrade3.protectiveVentProtocol.some(p => p.includes('VV-ECMO')), 'Includes VV-ECMO mobilization in protocol');

    // Grade 3 Override: Active ECMO for graft failure
    const lungEcmoOverride = GraftPulseService.assessLungPGD({
      pao2Mmhg: 250,
      fio2: 0.4,
      radiographicInfiltrates: false,
      ecmoActive: true,
      ecmoType: 'VV_ECMO'
    });
    assert(lungEcmoOverride.pgdGrade === 'GRADE_3', 'Active VV-ECMO automatically classifies as Grade 3 per ISHLT');

    // ---------------------------------------------------------
    // Test Group 2: Vasoactive-Inotropic Score (VIS) Calculations
    // ---------------------------------------------------------
    console.log('\nTest Group 2: Vasoactive-Inotropic Score (VIS) Calculations');
    // VIS = Dopamine + Dobutamine + (100 * Epi) + (10 * Milrinone) + (10000 * Vaso) + (100 * Norepi)
    const vis1 = GraftPulseService.calculateVisScore({
      dobutamineMcgKgMin: 5,
      milrinoneMcgKgMin: 0.375, // 0.375 * 10 = 3.75
      norepinephrineMcgKgMin: 0.08 // 0.08 * 100 = 8
    }); // 5 + 3.75 + 8 = 16.75 -> 16.8
    assert(vis1 >= 16.7 && vis1 <= 16.8, `VIS score calculated correctly (${vis1})`);

    const visHigh = GraftPulseService.calculateVisScore({
      epinephrineMcgKgMin: 0.1, // 10
      norepinephrineMcgKgMin: 0.15, // 15
      vasopressinUnitsKgMin: 0.0004, // 0.0004 * 10000 = 4
      milrinoneMcgKgMin: 0.5 // 5
    }); // 10 + 15 + 4 + 5 = 34
    assert(visHigh === 34, `High-dose VIS score calculated accurately (${visHigh})`);

    // ---------------------------------------------------------
    // Test Group 3: ISHLT Heart PGD-LV & PGD-RV Stratification
    // ---------------------------------------------------------
    console.log('\nTest Group 3: ISHLT Heart PGD Stratification');
    // Normal / None
    const heartNormal = GraftPulseService.assessHeartPGD({
      lvefPercent: 55,
      cvpMmhg: 8,
      pcwpMmhg: 12,
      cardiacIndexLMinM2: 2.8
    });
    assert(heartNormal.pgdSeverity === 'NONE', 'Classified as NONE for normal allograft function');
    assert(heartNormal.rvFailurePresent === false, 'No RV failure');

    // PGD-LV Mild (LVEF <= 40%, low VIS < 10)
    const heartMild = GraftPulseService.assessHeartPGD({
      lvefPercent: 35,
      cvpMmhg: 12,
      pcwpMmhg: 16,
      cardiacIndexLMinM2: 2.1,
      vasoactives: { dobutamineMcgKgMin: 5 } // VIS = 5
    });
    assert(heartMild.pgdSeverity === 'PGD_LV_MILD', 'Classified as PGD_LV_MILD');
    assert(heartMild.mechanicalSupportIndicated === false, 'No mechanical support indicated for Mild');

    // PGD-LV Moderate (LVEF <= 40%, VIS >= 10)
    const heartMod = GraftPulseService.assessHeartPGD({
      lvefPercent: 30,
      cvpMmhg: 16,
      pcwpMmhg: 22,
      cardiacIndexLMinM2: 1.8,
      vasoactives: {
        dobutamineMcgKgMin: 5,
        norepinephrineMcgKgMin: 0.1 // 10 -> total VIS = 15
      }
    });
    assert(heartMod.pgdSeverity === 'PGD_LV_MODERATE', 'Classified as PGD_LV_MODERATE (VIS >= 10)');
    assert(heartMod.visScore === 15, 'VIS score is 15');

    // PGD-LV Severe (MCS Active)
    const heartSevere = GraftPulseService.assessHeartPGD({
      lvefPercent: 20,
      cvpMmhg: 18,
      pcwpMmhg: 24,
      cardiacIndexLMinM2: 1.4,
      mechanicalCirculatorySupportActive: true,
      mcsType: 'VA_ECMO'
    });
    assert(heartSevere.pgdSeverity === 'PGD_LV_SEVERE', 'Classified as PGD_LV_SEVERE when MCS is active');
    assert(heartSevere.mechanicalSupportIndicated === true, 'Mechanical support indicated');

    // PGD-RV (CVP > 15, PCWP <= 15, PAPi < 1.5)
    // PASP = 28, PADP = 14, CVP = 16 -> Pulse Pressure = 14 -> PAPi = 14 / 16 = 0.88 (< 1.5)
    const heartRv = GraftPulseService.assessHeartPGD({
      lvefPercent: 50,
      cvpMmhg: 16,
      pcwpMmhg: 12,
      pulmonaryArterySystolicMmhg: 28,
      pulmonaryArteryDiastolicMmhg: 14,
      rvDysfunctionPresent: true
    });
    assert(heartRv.rvFailurePresent === true, 'RV failure identified');
    assert(heartRv.pgdSeverity === 'PGD_RV', 'Classified as PGD_RV');
    assert(heartRv.papi !== undefined && heartRv.papi < 1.5, `PAPi calculated below threshold (${heartRv.papi})`);
    assert(heartRv.inhaledVasodilatorRecommended === 'INO', 'Recommends Inhaled Nitric Oxide for RV afterload reduction');

    // ---------------------------------------------------------
    // Test Group 4: Database Persistence & History
    // ---------------------------------------------------------
    console.log('\nTest Group 4: Database Persistence & History Retrieval');
    let patientId = 1;
    const patRes = await pool.query('SELECT id FROM patients LIMIT 1');
    if (patRes.rows.length > 0) {
      patientId = patRes.rows[0].id;
    } else {
      const newPat = await pool.query(`INSERT INTO patients (name, age, gender) VALUES ('Transplant Patient', 54, 'Male') RETURNING id`);
      patientId = newPat.rows[0].id;
    }

    const savedTx = await GraftPulseService.recordTransplant({
      patientId,
      organType: 'LUNG_BILATERAL',
      donorAge: 32,
      ischemicTimeMinutes: 285,
      surgicalNotes: 'Sequential bilateral lung transplantation via clamshell thoracosternotomy.'
    });

    assert(savedTx.id > 0, 'Successfully recorded allograft transplant');
    assert(savedTx.organ_type === 'LUNG_BILATERAL', 'Organ type matches (LUNG_BILATERAL)');
    assert(savedTx.ischemic_time_minutes === 285, 'Ischemic time recorded (285 min)');

    const savedLog = await GraftPulseService.logPgdSurveillance({
      transplantId: savedTx.id,
      patientId,
      timepoint: 'T24',
      pao2Fio2Ratio: 185.5,
      radiographicInfiltrates: true,
      pgdGrade: 'GRADE_3',
      inhaledVasodilator: 'INO',
      inhaledVasodilatorDose: '20 ppm',
      recommendations: { protective_vent: true, ecmo_readiness: true }
    });

    assert(savedLog.id > 0, 'Successfully logged PGD surveillance');
    assert(savedLog.timepoint === 'T24', 'Timepoint matches (T24)');
    assert(Number(savedLog.pao2_fio2_ratio) === 185.5, 'P/F ratio persisted accurately (185.5)');
    assert(savedLog.pgd_grade === 'GRADE_3', 'PGD Grade matches (GRADE_3)');

    const txHistory = await GraftPulseService.getPatientTransplants(patientId);
    assert(txHistory.length > 0, 'Retrieved patient transplant history');
    assert(txHistory.some(t => t.id === savedTx.id), 'Recorded transplant found in history');

    const pgdLogs = await GraftPulseService.getTransplantPgdLogs(savedTx.id);
    assert(pgdLogs.length > 0, 'Retrieved PGD surveillance logs for transplant');
    assert(pgdLogs[0].id === savedLog.id, 'Surveillance log ID matches');

    console.log('\n========================================================');
    console.log(`Phase 84 GRAFT-PULSE Tests Complete: ${passedTests}/${totalTests} Passed (100%)`);
    console.log('========================================================\n');
  } catch (err: any) {
    console.error('Test execution failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runGraftPulseTests();
