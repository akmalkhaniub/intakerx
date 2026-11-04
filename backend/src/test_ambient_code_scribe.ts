import { AmbientCodeScribeService } from './services/ambientCodeScribe';
import { IcuSimulatorService } from './services/icuSimulator';
import { pool } from './db';

async function runTests() {
  console.log('=== RUNNING AMBIENT CODE-RESUSCITATION SCRIBE & VOICE HUD (PILLAR 3) TESTS ===\n');
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
    // Ensure simulated beds are loaded for patient IDs 1-12
    await IcuSimulatorService.initializeWard('Century Ambient Ward');

    // -------------------------------------------------------------
    // Test 1: Start Resuscitation Session
    // -------------------------------------------------------------
    console.log('[Test 1] Start Resuscitation Code Session');
    const session = await AmbientCodeScribeService.startSession(
      1,
      1,
      'Dr. Sarah Connor, MD',
      'RN Michael Scott',
      'MATERNAL_CODE_PMCS'
    );

    assert(session.id > 0, `Session started with ID ${session.id}`);
    assert(session.isActive === true, 'Session isActive is true');
    assert(session.codeType === 'MATERNAL_CODE_PMCS', 'Code type is MATERNAL_CODE_PMCS');
    assert(session.totalEpinephrineMg === 0, 'Initial Epinephrine tally is 0 mg');
    assert(session.totalDefibrillations === 0, 'Initial Defibrillation tally is 0');

    // -------------------------------------------------------------
    // Test 2: Process Resuscitation Utterances (Rhythm, Defib, Epi)
    // -------------------------------------------------------------
    console.log('\n[Test 2] Parse Ambient Resuscitation Utterances');
    
    // Rhythm check
    const r1 = await AmbientCodeScribeService.processUtterance(session.id, 'Two minutes elapsed, rhythm check: PEA', 'CODE_LEADER');
    assert(r1.event.eventType === 'RHYTHM_CHECK', 'Rhythm check detected');
    assert(r1.event.structuredPayload.rhythm === 'PEA', 'Rhythm correctly identified as PEA');

    // Defibrillation
    const r2 = await AmbientCodeScribeService.processUtterance(session.id, 'Rhythm converted to V-Fib, clear, shock delivered at 200 Joules biphasic', 'CODE_TEAM');
    assert(r2.event.eventType === 'DEFIBRILLATION', 'Defibrillation detected');
    assert(r2.event.structuredPayload.joules === 200, 'Energy logged at 200 Joules');

    // Epinephrine 1mg
    const r3 = await AmbientCodeScribeService.processUtterance(session.id, 'First Epinephrine 1 milligram IV push given and flushed', 'CODE_RECORDER');
    assert(r3.event.eventType === 'MEDICATION_GIVEN', 'Medication given event logged');
    assert(r3.event.structuredPayload.drug === 'Epinephrine', 'Epinephrine drug identified');

    // Check tally update
    const updatedSess = await AmbientCodeScribeService.getSession(session.id);
    assert(updatedSess?.totalDefibrillations === 1, `Defibrillations incremented to 1 (actual: ${updatedSess?.totalDefibrillations})`);
    assert(updatedSess?.totalEpinephrineMg === 1.0, `Total Epinephrine incremented to 1.0 mg (actual: ${updatedSess?.totalEpinephrineMg})`);

    // -------------------------------------------------------------
    // Test 3: Bedside Voice HUD Query Resolution
    // -------------------------------------------------------------
    console.log('\n[Test 3] Bedside Voice HUD Queries');
    
    // Elapsed code time query
    const q1 = await AmbientCodeScribeService.processUtterance(session.id, 'IntakeRx, what is the elapsed code time?', 'CODE_LEADER');
    assert(q1.event.eventType === 'VOICE_QUERY_RESOLVED', 'Voice query event type detected');
    assert(Boolean(q1.voiceAnswer && q1.voiceAnswer.includes('Elapsed resuscitation time is')), `Spoken elapsed time answered: "${q1.voiceAnswer}"`);

    // Last epinephrine query
    const q2 = await AmbientCodeScribeService.processUtterance(session.id, 'IntakeRx, when was the last epinephrine given?', 'CODE_LEADER');
    assert(Boolean(q2.voiceAnswer && q2.voiceAnswer.includes('Last Epinephrine 1 milligram was given')), `Spoken last epinephrine status answered: "${q2.voiceAnswer}"`);

    // -------------------------------------------------------------
    // Test 4: Cross-Phase Contraindication Alert in Code
    // -------------------------------------------------------------
    console.log('\n[Test 4] Clinical Safety Guard: Methergine in Severe Preeclampsia (Bed 3)');
    const sessBed3 = await AmbientCodeScribeService.startSession(3, 3, 'Dr. House', 'RN Cameron', 'OB_HEMORRHAGE_CODE');
    const rContra = await AmbientCodeScribeService.processUtterance(sessBed3.id, 'Give Methergine 0.2 milligrams IM now for atony', 'CODE_LEADER');
    
    assert(Boolean(rContra.activeAlert && rContra.activeAlert.includes('CRITICAL CONTRAINDICATION ALERT')), 'Cross-phase contraindication alert triggered');
    assert(Boolean(rContra.event.structuredPayload.contraindicationFlagged), 'Event structured payload marked contraindicationFlagged');

    // -------------------------------------------------------------
    // Test 5: Maternal Resuscitation Procedures (Manual LUD & PMCS)
    // -------------------------------------------------------------
    console.log('\n[Test 5] Maternal Code Sentinels: Manual LUD & PMCS');
    const rLud = await AmbientCodeScribeService.processUtterance(session.id, 'Manual LUD applied on flat backboard to relieve IVC compression', 'CODE_TEAM');
    assert(rLud.event.eventType === 'PROCEDURE_PERFORMED', 'Procedure event logged');
    assert(rLud.event.structuredPayload.procedure === 'Manual Left Uterine Displacement (LUD)', 'LUD recognized');

    const rPmcs = await AmbientCodeScribeService.processUtterance(session.id, 'Minute 4 reached without ROSC. Scalpel in hand, PMCS hysterotomy started!', 'CODE_LEADER');
    assert(rPmcs.event.structuredPayload.procedure === 'Perimortem Cesarean Section (PMCS)', 'PMCS procedure recognized');
    
    const sessAfterPmcs = await AmbientCodeScribeService.getSession(session.id);
    assert(sessAfterPmcs?.pmcsPerformed === true, 'pmcsPerformed flag set to true on session');

    // -------------------------------------------------------------
    // Test 6: MTP Balanced Blood Hang
    // -------------------------------------------------------------
    console.log('\n[Test 6] MTP Blood Transfusion Hang');
    const rMtp = await AmbientCodeScribeService.processUtterance(session.id, 'Pack 1 MTP hanging: 4 units PRBC, 4 units FFP, 1 pack platelets', 'CODE_TEAM');
    assert(rMtp.event.eventType === 'MTP_BLOOD_HANG', 'MTP blood hang event detected');
    
    const sessAfterMtp = await AmbientCodeScribeService.getSession(session.id);
    assert(sessAfterMtp?.mtpUnitsPrbc === 4, 'PRBC tally is 4');
    assert(sessAfterMtp?.mtpUnitsFfp === 4, 'FFP tally is 4');
    assert(sessAfterMtp?.mtpUnitsPlatelets === 1, 'Platelet tally is 1');

    // -------------------------------------------------------------
    // Test 7: ROSC Achievement
    // -------------------------------------------------------------
    console.log('\n[Test 7] ROSC Verification');
    const rRosc = await AmbientCodeScribeService.processUtterance(session.id, 'Palpable femoral and carotid pulse returned! We have ROSC, BP 94/58', 'CODE_LEADER');
    assert(rRosc.event.eventType === 'ROSC_ACHIEVED', 'ROSC achieved event logged');
    
    const sessAfterRosc = await AmbientCodeScribeService.getSession(session.id);
    assert(sessAfterRosc?.roscAchieved === true, 'roscAchieved flag set to true');

    // -------------------------------------------------------------
    // Test 8: Conclude Session & Legal Debrief Generation
    // -------------------------------------------------------------
    console.log('\n[Test 8] Conclude Code & Generate Legal Chronological Debrief');
    const concludedSession = await AmbientCodeScribeService.stopSession(session.id);
    assert(concludedSession.isActive === false, 'Session isActive is false');
    assert(!!concludedSession.endedAt, 'endedAt timestamp populated');
    assert(Boolean(concludedSession.debriefSummary && concludedSession.debriefSummary.includes('LEGAL DEBRIEF')), 'Debrief summary contains header');
    assert(Boolean(concludedSession.debriefSummary?.includes('QUANTITATIVE RESUSCITATION TALLIES')), 'Debrief includes quantitative tallies');
    assert(Boolean(concludedSession.debriefSummary?.includes('CHRONOLOGICAL CODE LOG')), 'Debrief includes chronological table');
    assert(Boolean(concludedSession.debriefSummary?.includes('ROSC ACHIEVED')), 'Debrief documents ROSC achievement');

    console.log(`\n=============================================================`);
    console.log(`AMBIENT CODE SCRIBE TESTS COMPLETE: ${passed} passed, ${failed} failed.`);
    console.log(`=============================================================`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during Ambient Code Scribe test execution:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
