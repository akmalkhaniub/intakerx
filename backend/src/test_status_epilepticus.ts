import { StatusEpilepticusService } from './services/statusEpilepticus';
import { pool } from './db';

async function runTests() {
  console.log('=== RUNNING STATUS-EPILEPTICUS (PHASE 94) INTEGRATION TESTS ===\n');
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
    // Test 1: Stage 1 Early Status Epilepticus with IV Access
    // -------------------------------------------------------------
    console.log('[Test 1] Stage 1 Early Status Epilepticus with IV Access');
    const t1 = StatusEpilepticusService.evaluateStatus({
      patientId: 1,
      seizureDurationMins: 4,
      seizureType: 'CONVULSIVE_GENERALIZED',
      weightKg: 70,
      ivAccess: true,
      intubated: false
    });

    assert(t1.stage === 'STAGE_1_EARLY', 'Correctly staged as STAGE_1_EARLY (4 min duration)');
    assert(t1.firstLineDosing.recommendedDrug === 'Lorazepam', 'Prescribes Lorazepam for IV access');
    assert(t1.firstLineDosing.route === 'IV', 'Route is IV');
    assert(t1.firstLineDosing.calculatedDoseMg === 4.0, 'Calculates 4.0 mg Lorazepam for 70 kg adult (0.1 mg/kg capped at 4 mg)');
    assert(t1.secondLineDosing.agentOptions.length === 3, 'Prepares 3 second-line ASM alternatives');

    // -------------------------------------------------------------
    // Test 2: Stage 1 Early Status Epilepticus without IV Access
    // -------------------------------------------------------------
    console.log('\n[Test 2] Stage 1 Early Status Epilepticus without IV Access (IM Midazolam)');
    const t2 = StatusEpilepticusService.evaluateStatus({
      patientId: 1,
      seizureDurationMins: 3,
      seizureType: 'CONVULSIVE_GENERALIZED',
      weightKg: 80,
      ivAccess: false,
      intubated: false
    });

    assert(t2.firstLineDosing.recommendedDrug === 'Midazolam', 'Prescribes Midazolam when no IV access');
    assert(t2.firstLineDosing.route === 'IM', 'Route is IM');
    assert(t2.firstLineDosing.calculatedDoseMg === 10.0, 'Prescribes 10 mg IM Midazolam for patient >= 40 kg');

    // -------------------------------------------------------------
    // Test 3: Stage 2 Established Status Epilepticus (ESETT Dosing)
    // -------------------------------------------------------------
    console.log('\n[Test 3] Stage 2 Established Status Epilepticus (ESETT Trial Weight-Based ASMs)');
    const t3 = StatusEpilepticusService.evaluateStatus({
      patientId: 1,
      seizureDurationMins: 15,
      seizureType: 'CONVULSIVE_GENERALIZED',
      weightKg: 60,
      ivAccess: true,
      firstLineBenzoGiven: 'Lorazepam 4mg IV',
      firstLineResponse: 'REFRACTORY',
      intubated: false
    });

    assert(t3.stage === 'STAGE_2_ESTABLISHED', 'Correctly staged as STAGE_2_ESTABLISHED after failed first-line');
    const keppra = t3.secondLineDosing.agentOptions.find(a => a.drug.includes('Levetiracetam'));
    const fosphen = t3.secondLineDosing.agentOptions.find(a => a.drug.includes('Fosphenytoin'));
    const valproate = t3.secondLineDosing.agentOptions.find(a => a.drug.includes('Valproate'));

    assert(keppra?.calculatedDoseMg === 3600, 'Calculates Keppra 3,600 mg (60 mg/kg for 60 kg)');
    assert(fosphen?.calculatedDoseMg === 1200, 'Calculates Fosphenytoin 1,200 mg PE (20 mg PE/kg for 60 kg)');
    assert(valproate?.calculatedDoseMg === 2400, 'Calculates Sodium Valproate 2,400 mg (40 mg/kg for 60 kg)');

    // -------------------------------------------------------------
    // Test 4: Stage 3 Refractory Status Epilepticus (RSE) & Airway Directive
    // -------------------------------------------------------------
    console.log('\n[Test 4] Stage 3 Refractory Status Epilepticus & Airway Directive');
    const t4 = StatusEpilepticusService.evaluateStatus({
      patientId: 1,
      seizureDurationMins: 45,
      seizureType: 'CONVULSIVE_GENERALIZED',
      weightKg: 75,
      ivAccess: true,
      firstLineBenzoGiven: 'Lorazepam 4mg IV',
      firstLineResponse: 'REFRACTORY',
      secondLineAsmGiven: 'Levetiracetam 4500mg IV',
      secondLineResponse: 'REFRACTORY',
      intubated: false
    });

    assert(t4.stage === 'STAGE_3_REFRACTORY', 'Correctly staged as STAGE_3_REFRACTORY');
    assert(t4.civaRescuePlan !== undefined, 'Generated continuous IV anesthetic (CIVA) rescue plan');
    assert(Boolean(t4.protocolDirectives.some(d => d.includes('URGENT AIRWAY DIRECTIVE'))), 'Directs urgent endotracheal intubation before CIVA');
    assert(Boolean(t4.protocolDirectives.some(d => d.includes('Continuous EEG'))), 'Directs mandatory continuous EEG placement');

    // -------------------------------------------------------------
    // Test 5: PRIS (Propofol Infusion Syndrome) Safety Sentinel
    // -------------------------------------------------------------
    console.log('\n[Test 5] PRIS (Propofol Infusion Syndrome) Sentinel Trigger');
    const t5 = StatusEpilepticusService.evaluateStatus({
      patientId: 1,
      seizureDurationMins: 180,
      seizureType: 'CONVULSIVE_GENERALIZED',
      weightKg: 70,
      ivAccess: true,
      intubated: true,
      propofolDoseMgKgH: 5.5,
      propofolInfusionHours: 52,
      triglyceridesMgDl: 480,
      ckLevelUL: 6200
    });

    assert(t5.prisRiskFlag === true, 'Triggered PRIS risk flag for high-dose propofol >48h with hypertriglyceridemia/CK elevation');
    assert(Boolean(t5.protocolDirectives.some(d => d.includes('PRIS (Propofol Infusion Syndrome) risk threshold exceeded'))), 'Directs immediate transition away from Propofol');
    assert(t5.civaRescuePlan?.recommendedCiva.includes('Midazolam') === true, 'Recommends Midazolam or Ketamine instead of Propofol');

    // -------------------------------------------------------------
    // Test 6: NORSE / FIRES Autoimmune Encephalitis Trigger
    // -------------------------------------------------------------
    console.log('\n[Test 6] NORSE / FIRES Autoimmune Encephalitis Trigger');
    const t6 = StatusEpilepticusService.evaluateStatus({
      patientId: 1,
      seizureDurationMins: 60,
      seizureType: 'CONVULSIVE_GENERALIZED',
      weightKg: 65,
      ivAccess: true,
      secondLineResponse: 'REFRACTORY',
      intubated: true,
      noPriorEpilepsyHistory: true,
      feverOrProdromePreceding: true
    });

    assert(t6.autoimmuneNorseSuspected === true, 'Flagged NORSE / FIRES due to new-onset refractory status preceded by febrile prodrome');
    assert(Boolean(t6.protocolDirectives.some(d => d.includes('NORSE / FIRES Alert'))), 'Directs autoimmune workup and early immunotherapy');

    // -------------------------------------------------------------
    // Test 7: Stage 4 Super-Refractory Status Epilepticus (SRSE)
    // -------------------------------------------------------------
    console.log('\n[Test 7] Stage 4 Super-Refractory Status Epilepticus (SRSE Multimodal Rescue)');
    const t7 = StatusEpilepticusService.evaluateStatus({
      patientId: 1,
      seizureDurationMins: 1600,
      seizureType: 'CONVULSIVE_GENERALIZED',
      weightKg: 70,
      ivAccess: true,
      intubated: true,
      activeCivaInfusion: 'Midazolam 1.2 mg/kg/h',
      civaDurationHours: 26
    });

    assert(t7.stage === 'STAGE_4_SUPER_REFRACTORY', 'Correctly staged as STAGE_4_SUPER_REFRACTORY (>=24h CIVA)');
    assert(t7.superRefractoryRescuePlan !== undefined, 'Formulated Super-Refractory multimodal plan');
    assert(Boolean(t7.superRefractoryRescuePlan?.ketogenicDietDirective.includes('Ketogenic Diet')), 'Includes enteral Ketogenic Diet protocol (target BHB > 3.0 mmol/L)');
    assert(Boolean(t7.superRefractoryRescuePlan?.immunomodulationDirective.includes('Methylprednisolone')), 'Includes pulse IV steroids/IVIG/PLEX');
    assert(Boolean(t7.superRefractoryRescuePlan?.rescueAgents.some(a => a.includes('Ketamine'))), 'Includes Ketamine infusion to overcome GABA receptor downregulation');

    // -------------------------------------------------------------
    // Test 8: Salzburg Criteria for Non-Convulsive Status Epilepticus (NCSE)
    // -------------------------------------------------------------
    console.log('\n[Test 8] Salzburg Criteria for NCSE');
    const t8a = StatusEpilepticusService.evaluateStatus({
      patientId: 1,
      seizureDurationMins: 45,
      seizureType: 'NON_CONVULSIVE_NCSE',
      weightKg: 70,
      ivAccess: true,
      intubated: false,
      eegDischargesHz: 3.2
    });
    assert(t8a.salzburgNcseMet === true, 'Discharges > 2.5 Hz satisfy Salzburg criterion for NCSE');

    const t8b = StatusEpilepticusService.evaluateStatus({
      patientId: 1,
      seizureDurationMins: 45,
      seizureType: 'NON_CONVULSIVE_NCSE',
      weightKg: 70,
      ivAccess: true,
      intubated: false,
      eegDischargesHz: 1.5,
      evolutionOrImprovementWithAsm: true
    });
    assert(t8b.salzburgNcseMet === true, 'Discharges <= 2.5 Hz with rapid ASM improvement satisfy Salzburg criterion');

    // -------------------------------------------------------------
    // Test 9: cEEG Anesthetic Infusion Titration Rules
    // -------------------------------------------------------------
    console.log('\n[Test 9] Continuous EEG Titration: Seizures, Burst Suppression Depth & Isoelectric Safety');
    
    // 9a: Active seizures -> Uptitrate
    const c1 = StatusEpilepticusService.titrateCeeg({
      patientId: 1,
      eegPattern: 'ELECTROGRAPHIC_SEIZURES',
      civaDrug: 'Propofol',
      civaRateUnit: 'mg/kg/h',
      civaRate: 3.0
    });
    assert(c1.actionRequired === 'UPTITRATE', 'Active seizures trigger CIVA uptitration');
    assert(c1.targetAchieved === false, 'Target not achieved during seizures');

    // 9b: Therapeutic burst suppression achieved (BSR 65%, 4 bursts/min, IBI 12s)
    const c2 = StatusEpilepticusService.titrateCeeg({
      patientId: 1,
      eegPattern: 'BURST_SUPPRESSION',
      burstSuppressionRatioPct: 65,
      burstsPerMinute: 4,
      interburstIntervalSec: 12,
      civaDrug: 'Midazolam',
      civaRateUnit: 'mg/kg/h',
      civaRate: 0.8
    });
    assert(c2.targetAchieved === true, 'Burst suppression target achieved (BSR 65%, 4 bpm, IBI 12s)');
    assert(c2.actionRequired === 'MAINTAIN', 'Action is MAINTAIN for 24-48 hours');

    // 9c: Under-suppressed burst suppression (BSR 35%, 8 bpm) -> Uptitrate
    const c3 = StatusEpilepticusService.titrateCeeg({
      patientId: 1,
      eegPattern: 'BURST_SUPPRESSION',
      burstSuppressionRatioPct: 35,
      burstsPerMinute: 8,
      interburstIntervalSec: 4,
      civaDrug: 'Propofol',
      civaRateUnit: 'mg/kg/h',
      civaRate: 2.5
    });
    assert(c3.targetAchieved === false, 'Under-suppressed burst suppression recognized');
    assert(c3.actionRequired === 'UPTITRATE', 'Action is UPTITRATE when BSR < 50%');

    // 9d: Complete electrocerebral silence (Isoelectric) -> Downtitrate
    const c4 = StatusEpilepticusService.titrateCeeg({
      patientId: 1,
      eegPattern: 'COMPLETE_SUPPRESSION',
      civaDrug: 'Pentobarbital',
      civaRateUnit: 'mg/kg/h',
      civaRate: 5.0
    });
    assert(c4.actionRequired === 'DOWNTITRATE_WEAN', 'Isoelectric EEG triggers immediate downtitration to avoid toxicity');

    // -------------------------------------------------------------
    // Test 10: Database Persistence & Retrieval
    // -------------------------------------------------------------
    console.log('\n[Test 10] Database Persistence: SE Evaluations & cEEG Titration Logs');
    const evalId = await StatusEpilepticusService.persistEvaluation(t4);
    assert(evalId > 0, `Status epilepticus evaluation persisted with ID: ${evalId}`);

    const evals = await StatusEpilepticusService.getEvaluations(1);
    assert(evals.length > 0, `Retrieved ${evals.length} evaluation(s) for patient 1`);
    assert(evals[0].stage === 'STAGE_3_REFRACTORY', 'Stored stage is STAGE_3_REFRACTORY');

    const ceegId = await StatusEpilepticusService.persistCeegLog(c2);
    assert(ceegId > 0, `cEEG titration log persisted with ID: ${ceegId}`);

    const ceegLogs = await StatusEpilepticusService.getCeegLogs(1);
    assert(ceegLogs.length > 0, `Retrieved ${ceegLogs.length} cEEG log(s) for patient 1`);
    assert(ceegLogs[0].target_achieved === true, 'Stored target_achieved is true');

    console.log(`\n=================================================`);
    console.log(`STATUS-EPILEPTICUS TESTS COMPLETED: ${passed} passed, ${failed} failed`);
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
