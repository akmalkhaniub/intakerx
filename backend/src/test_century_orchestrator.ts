import { CenturyOrchestratorService } from './services/centuryOrchestrator';
import { pool } from './db';

async function runTests() {
  console.log('=== RUNNING CENTURY-ORCHESTRATOR (PHASE 100) INTEGRATION TESTS ===\n');
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
    // Test 1: Baseline Stable Observation Tier
    // -------------------------------------------------------------
    console.log('[Test 1] Baseline Stable Patient Evaluation');
    const t1 = CenturyOrchestratorService.synthesizeGrandOrchestration({
      patientId: 1,
      cardiovascular: {
        heartRate: 72,
        systolicBp: 124,
        diastolicBp: 78,
        meanArterialPressure: 93,
        shockIndex: 0.58
      }
    });

    assert(t1.centuryTier === 'STABLE_OBSERVATION', 'Classified as STABLE_OBSERVATION tier');
    assert(t1.centuryScore < 25, `Century score is low for stable patient (actual: ${t1.centuryScore})`);
    assert(t1.crossPhaseConflicts.length === 0, 'Zero conflicts detected for stable patient');

    // -------------------------------------------------------------
    // Test 2: Extreme Multi-Organ Failure & Century Score >= 75
    // -------------------------------------------------------------
    console.log('\n[Test 2] Extreme Multi-Organ Failure (Tier: EXTREME_SURGE_ORCHESTRATED)');
    const t2 = CenturyOrchestratorService.synthesizeGrandOrchestration({
      patientId: 1,
      neurologic: {
        gcsScore: 5,
        icpMmhg: 24,
        statusEpilepticusActive: true
      },
      cardiovascular: {
        heartRate: 135,
        systolicBp: 74,
        diastolicBp: 40,
        meanArterialPressure: 51,
        shockIndex: 1.82,
        vasoactiveInotropicScore: 28,
        activeMcsDevice: 'VA_ECMO'
      },
      respiratory: {
        paO2FiO2Ratio: 85,
        mechanicalVentilation: true,
        drivingPressureCmH2O: 18
      },
      renalFluids: {
        hourlyUrineOutputMlKgH: 0.2,
        serumCreatinineMgDl: 3.2,
        crrtActive: true
      },
      hepaticMetabolic: {
        serumLactateMmolL: 7.2,
        totalBilirubinMgDl: 4.5
      },
      hematologic: {
        activeMtpProtocol: true,
        fibrinogenMgDl: 110,
        plateletCountK: 35
      }
    });

    assert(t2.centuryTier === 'EXTREME_SURGE_ORCHESTRATED', 'Classified as EXTREME_SURGE_ORCHESTRATED tier');
    assert(t2.centuryScore >= 75, `Century score is extreme (actual: ${t2.centuryScore})`);
    assert(t2.dispatchedTeams.some(t => t.includes('VA_ECMO')), 'Dispatched ECMO team');
    assert(t2.dispatchedTeams.some(t => t.includes('Massive Transfusion Protocol')), 'Dispatched MTP Blood Bank team');
    assert(t2.dispatchedTeams.some(t => t.includes('Neuro-Intensive Care')), 'Dispatched Neuro-ICU team');

    // -------------------------------------------------------------
    // Test 3: Conflict 1: Aortic Dissection vs. Spinal Cord Perfusion (Phases 66 vs 95)
    // -------------------------------------------------------------
    console.log('\n[Test 3] Conflict 1: Aortic Dissection (Phase 66) vs. Spinal Cord Perfusion (Phase 95)');
    const t3 = CenturyOrchestratorService.synthesizeGrandOrchestration({
      patientId: 1,
      neurologic: {
        spinalCordInjuryLevel: 'T4'
      },
      cardiovascular: {
        heartRate: 85,
        systolicBp: 155,
        diastolicBp: 88,
        meanArterialPressure: 110,
        shockIndex: 0.55,
        acuteAorticDissectionTypeA: true
      }
    });

    const c1 = t3.crossPhaseConflicts.find(c => c.conflictId === 'CONFLICT_AORTIC_VS_SPINAL_MAP');
    assert(Boolean(c1), 'Detected CONFLICT_AORTIC_VS_SPINAL_MAP');
    assert(Boolean(c1?.arbitratedResolutionDirective.includes('Anti-impulse control takes absolute survival precedence')), 'Arbitrated that aortic anti-impulse takes absolute survival precedence over cord MAP');
    assert(Boolean(c1?.arbitratedResolutionDirective.includes('lumbar drain for CSF pressure reduction')), 'Mandates CSF lumbar drain to augment spinal cord perfusion pressure without raising systemic BP');

    // -------------------------------------------------------------
    // Test 4: Conflict 2: Severe Preeclampsia vs. PPH Atony (Phases 97 vs 98)
    // -------------------------------------------------------------
    console.log('\n[Test 4] Conflict 2: Severe Preeclampsia (Phase 97) vs. PPH Atony (Phase 98)');
    const t4 = CenturyOrchestratorService.synthesizeGrandOrchestration({
      patientId: 1,
      cardiovascular: {
        heartRate: 110,
        systolicBp: 172,
        diastolicBp: 114,
        meanArterialPressure: 133,
        shockIndex: 0.64
      },
      obstetric: {
        isPregnantOrPostpartum: true,
        severePreeclampsiaEclampsia: true,
        postpartumHemorrhageActive: true,
        qblMl: 1300
      }
    });

    const c2 = t4.crossPhaseConflicts.find(c => c.conflictId === 'CONFLICT_PREECLAMPSIA_VS_METHERGINE');
    assert(Boolean(c2), 'Detected CONFLICT_PREECLAMPSIA_VS_METHERGINE');
    assert(Boolean(c2?.arbitratedResolutionDirective.includes('Methylergonovine (Methergine) is STRICTLY CONTRAINDICATED')), 'Strictly contraindicates Methergine in severe preeclampsia');
    assert(Boolean(c2?.arbitratedResolutionDirective.includes('Carboprost 250 mcg IM') || c2?.arbitratedResolutionDirective.includes('Misoprostol')), 'Directs immediate switch to Carboprost or Misoprostol + Bakri balloon');

    // -------------------------------------------------------------
    // Test 5: Conflict 3: Severe Asthma vs. PPH Atony (Phases 65 vs 98)
    // -------------------------------------------------------------
    console.log('\n[Test 5] Conflict 3: Severe Asthma (Phase 65) vs. PPH Atony (Phase 98)');
    const t5 = CenturyOrchestratorService.synthesizeGrandOrchestration({
      patientId: 1,
      cardiovascular: {
        heartRate: 118,
        systolicBp: 104,
        diastolicBp: 62,
        meanArterialPressure: 76,
        shockIndex: 1.13
      },
      respiratory: {
        severeAsthmaBronchospasm: true
      },
      obstetric: {
        isPregnantOrPostpartum: true,
        postpartumHemorrhageActive: true,
        qblMl: 1200
      }
    });

    const c3 = t5.crossPhaseConflicts.find(c => c.conflictId === 'CONFLICT_ASTHMA_VS_CARBOPROST');
    assert(Boolean(c3), 'Detected CONFLICT_ASTHMA_VS_CARBOPROST');
    assert(Boolean(c3?.arbitratedResolutionDirective.includes('Carboprost (Hemabate) is STRICTLY CONTRAINDICATED in active asthma')), 'Strictly contraindicates Carboprost in active asthma');

    // -------------------------------------------------------------
    // Test 6: Conflict 4: ARDS Fluid Restriction vs. Neurotrauma CPP (Phases 54 vs 65)
    // -------------------------------------------------------------
    console.log('\n[Test 6] Conflict 4: ARDS Fluid Restriction (Phase 65) vs. Neurotrauma CPP (Phase 54)');
    const t6 = CenturyOrchestratorService.synthesizeGrandOrchestration({
      patientId: 1,
      neurologic: {
        cppMmhg: 52 // < 60
      },
      cardiovascular: {
        heartRate: 95,
        systolicBp: 108,
        diastolicBp: 64,
        meanArterialPressure: 78,
        shockIndex: 0.88
      },
      respiratory: {
        paO2FiO2Ratio: 120 // Severe ARDS
      },
      hepaticMetabolic: {
        serumLactateMmolL: 3.2
      }
    });

    const c4 = t6.crossPhaseConflicts.find(c => c.conflictId === 'CONFLICT_ARDS_VS_CEREBRAL_PERFUSION');
    assert(Boolean(c4), 'Detected CONFLICT_ARDS_VS_CEREBRAL_PERFUSION');
    assert(Boolean(c4?.arbitratedResolutionDirective.includes('Hypertonic Saline (3% NaCl)')), 'Arbitrates Hypertonic Saline and vasopressors to maintain CPP without fluid overloading lungs');

    // -------------------------------------------------------------
    // Test 7: Conflict 5: Burn Parkland vs. Abdominal Compartment Syndrome (Phases 99 vs 44)
    // -------------------------------------------------------------
    console.log('\n[Test 7] Conflict 5: Burn Parkland (Phase 99) vs. Abdominal Compartment Syndrome (Phase 44)');
    const t7 = CenturyOrchestratorService.synthesizeGrandOrchestration({
      patientId: 1,
      cardiovascular: {
        heartRate: 116,
        systolicBp: 96,
        diastolicBp: 58,
        meanArterialPressure: 70,
        shockIndex: 1.2
      },
      renalFluids: {
        bladderPressureIapMmhg: 23 // >= 20 mmHg (ACS)
      },
      traumaAndBurns: {
        burnTbsaPercentage: 45
      }
    });

    const c5 = t7.crossPhaseConflicts.find(c => c.conflictId === 'CONFLICT_BURN_PARKLAND_VS_ACS');
    assert(Boolean(c5), 'Detected CONFLICT_BURN_PARKLAND_VS_ACS');
    assert(Boolean(c5?.arbitratedResolutionDirective.includes('5% Albumin colloid rescue')), 'Arbitrates 5% Albumin rescue infusion and bedside escharotomy');

    // -------------------------------------------------------------
    // Test 8: Maternal Arrest Sentinel & 4-Min PMCS Protocol
    // -------------------------------------------------------------
    console.log('\n[Test 8] Maternal Arrest Sentinel & Multi-Disciplinary Team Activation');
    const t8 = CenturyOrchestratorService.synthesizeGrandOrchestration({
      patientId: 1,
      cardiovascular: {
        heartRate: 0,
        systolicBp: 0,
        diastolicBp: 0,
        meanArterialPressure: 0,
        shockIndex: 0
      },
      obstetric: {
        isPregnantOrPostpartum: true,
        gestationalAgeWeeks: 32,
        activeMaternalCardiacArrest: true
      }
    });

    assert(t8.dispatchedTeams.some(t => t.includes('Code Obstetric Resuscitation Team')), 'Mobilized Code Obstetric Resuscitation Team');
    assert(t8.protocolDirectives.some(d => d.includes('Manual LUD on flat backboard')), 'Directs manual LUD on flat firm backboard');

    // -------------------------------------------------------------
    // Test 9: Database Persistence for Sessions and Cross-Phase Alerts
    // -------------------------------------------------------------
    console.log('\n[Test 9] Database Persistence for Century Sessions & Cross-Phase Alerts');
    
    // Ensure test patient exists
    const patientCheck = await pool.query('SELECT id FROM patients WHERE id = 1');
    if (patientCheck.rowCount === 0) {
      await pool.query(`
        INSERT INTO patients (id, name, email, password_hash, dob, sex)
        VALUES (1, 'Test Century Patient', 'centurypatient@example.com', 'hash123', '1985-04-12', 'Female')
        ON CONFLICT (id) DO NOTHING;
      `);
    }

    const savedSessionId = await CenturyOrchestratorService.persistOrchestratorSession(t3);
    assert(typeof savedSessionId === 'number' && savedSessionId > 0, `Century session persisted with ID ${savedSessionId}`);

    const sessions = await CenturyOrchestratorService.getOrchestratorSessions(1);
    assert(sessions.length > 0, `Retrieved ${sessions.length} century session(s) for patient 1`);

    const alerts = await CenturyOrchestratorService.getClinicalAlerts(1);
    assert(alerts.length > 0, `Retrieved ${alerts.length} cross-phase clinical alert(s) for patient 1`);

    console.log(`\n=============================================================`);
    console.log(`CENTURY-ORCHESTRATOR TEST SUITE FINISHED: ${passed} PASSED, ${failed} FAILED`);
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
