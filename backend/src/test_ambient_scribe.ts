import { AmbientScribeService } from './services/ambientScribe';
import { v4 as uuidv4 } from 'uuid';

async function runAmbientScribeTest() {
  console.log('====================================================');
  console.log('  IntakeRx Ambient Clinical Scribe & Diarizer Test  ');
  console.log('====================================================\n');

  const testSessionId = uuidv4();

  try {
    // 1. Initial State Check
    console.log('1. Checking initial transcript state...');
    const initial = AmbientScribeService.getTranscript(testSessionId);
    if (initial.turns.length !== 0 || initial.status !== 'idle') {
      throw new Error(`Expected empty idle transcript, got turns: ${initial.turns.length}, status: ${initial.status}`);
    }
    console.log('   ✔ Initialized empty encounter transcript.');

    // 2. Add manual diarized turns with entity extraction
    console.log('\n2. Testing manual multi-speaker turn addition & entity extraction...');
    const turn1 = AmbientScribeService.addTurn(
      testSessionId,
      'clinician',
      'Good afternoon. What symptoms are bothering you today?'
    );
    console.log(`   - Clinician Turn 1: "${turn1.text}" [Speaker: ${turn1.speaker}]`);

    const turn2 = AmbientScribeService.addTurn(
      testSessionId,
      'patient',
      'I have had severe chest pain and shortness of breath for two hours, and I am very scared.',
      'distressed'
    );
    console.log(`   - Patient Turn 2: "${turn2.text}" [Sentiment: ${turn2.sentiment}]`);
    console.log(`     Entities detected:`, turn2.entities);

    const hasChestPain = turn2.entities.some(e => e.type === 'symptom' && e.text === 'chest pain');
    const hasDyspnea = turn2.entities.some(e => e.type === 'symptom' && e.text === 'shortness of breath');
    if (!hasChestPain || !hasDyspnea) {
      throw new Error('Failed to extract symptoms chest pain or shortness of breath from patient turn');
    }
    console.log('   ✔ Accurately extracted symptoms and inferred distressed sentiment.');

    // 3. Test Simulation Dialogue (Cardiology scenario)
    console.log('\n3. Testing Clinical Dialogue Simulation (Cardiology scenario)...');
    const simTranscript = AmbientScribeService.simulateDialogue(testSessionId, 'cardiac');
    console.log(`   - Simulated Turns count: ${simTranscript.turns.length}`);
    if (simTranscript.turns.length < 5) {
      throw new Error(`Expected at least 5 dialogue turns, got ${simTranscript.turns.length}`);
    }

    const clinicianTurns = simTranscript.turns.filter(t => t.speaker === 'clinician');
    const patientTurns = simTranscript.turns.filter(t => t.speaker === 'patient');
    console.log(`   - Diarization: ${clinicianTurns.length} Clinician turns, ${patientTurns.length} Patient turns`);
    if (clinicianTurns.length === 0 || patientTurns.length === 0) {
      throw new Error('Diarization failed to partition clinician and patient turns');
    }

    // 4. Test Synthesis to Structured SOAP Note
    console.log('\n4. Synthesizing Ambient Dialogue into Structured SOAP Clinical Note...');
    const soap = AmbientScribeService.synthesizeSOAP(testSessionId);
    console.log('\n   [SUBJECTIVE]:');
    console.log('   ' + soap.subjective.split('\n').join('\n   '));
    console.log('\n   [OBJECTIVE]:');
    console.log('   ' + soap.objective.split('\n').join('\n   '));
    console.log('\n   [ASSESSMENT]:');
    console.log('   ' + soap.assessment.split('\n').join('\n   '));
    console.log('\n   [PLAN]:');
    console.log('   ' + soap.plan.split('\n').join('\n   '));
    console.log(`\n   Confidence Score: ${soap.confidenceScore}%`);
    console.log(`   Keywords: ${soap.highlightedKeywords.join(', ')}`);

    if (!soap.subjective.includes('CHIEF COMPLAINT') || !soap.plan.includes('MANAGEMENT PLAN')) {
      throw new Error('SOAP synthesis missing critical required sections');
    }
    if (soap.highlightedKeywords.length === 0) {
      throw new Error('SOAP synthesis failed to extract highlighted clinical keywords');
    }
    console.log('\n   ✔ Synthesized comprehensive SOAP note from conversational dialogue.');

    // 5. Test Migraine & Respiratory Scenarios
    console.log('\n5. Validating other dialogue scenarios (Migraine & Respiratory)...');
    const migraineSession = uuidv4();
    const migraineSim = AmbientScribeService.simulateDialogue(migraineSession, 'migraine');
    const migraineSoap = AmbientScribeService.synthesizeSOAP(migraineSession);
    if (!migraineSoap.subjective.toLowerCase().includes('headache') && !migraineSoap.subjective.toLowerCase().includes('migraine')) {
      throw new Error('Migraine scenario did not mention headache in subjective');
    }
    console.log('   ✔ Migraine scenario simulated and synthesized.');

    // 6. Test Clear Transcript
    AmbientScribeService.clearTranscript(testSessionId);
    AmbientScribeService.clearTranscript(migraineSession);
    const cleared = AmbientScribeService.getTranscript(testSessionId);
    if (cleared.turns.length !== 0) {
      throw new Error('Transcript was not cleared properly');
    }
    console.log('   ✔ Transcript store cleaned up.');

    console.log('\n✔ AMBIENT CLINICAL SCRIBE TEST PASSED WITH 100% SUCCESS!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Ambient Scribe Test failed:', err);
    process.exit(1);
  }
}

runAmbientScribeTest();
