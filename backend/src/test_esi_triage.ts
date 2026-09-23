import { pool, bootstrap } from './db';
import * as EsiService from './services/esiTriage';

async function runESITests() {
  console.log('====================================================');
  console.log('  IntakeRx Intelligent ESI 1-5 Triage & Queue Test   ');
  console.log('====================================================\n');

  try {
    console.log('Initializing database bootstrap...');
    await bootstrap();

    // 1. Test ESI Algorithm Level 1: Resuscitation
    console.log('1. Evaluating ESI 1 (Resuscitation Scenario)...');
    const esi1 = EsiService.evaluateESI({
      chiefComplaint: 'Patient collapsed, pulseless and agonal breathing',
      symptoms: [{ name: 'Unresponsive', severity: 'severe', is_red_flag: true }],
      vitals: { heartRate: 30, bpSystolic: 60, spo2: 78 }
    });
    console.log(`   - Level: ESI ${esi1.esiLevel} [${esi1.levelName}] | Max Wait: ${esi1.recommendedMaxWaitMinutes}m`);
    console.log(`   - Priority Score: ${esi1.priorityScore} | Rapid Intervention: ${esi1.requiresRapidIntervention}`);
    if (esi1.esiLevel !== 1 || !esi1.requiresRapidIntervention || esi1.recommendedMaxWaitMinutes !== 0) {
      throw new Error('ESI 1 evaluation failed');
    }
    console.log('   ✔ ESI 1 properly classified as immediate resuscitation.\n');

    // 2. Test ESI Algorithm Level 2: Emergent
    console.log('2. Evaluating ESI 2 (Emergent High-Risk Cardiac Scenario)...');
    const esi2 = EsiService.evaluateESI({
      chiefComplaint: 'Crushing retrosternal chest pain with diaphoresis and left arm numbness',
      symptoms: [
        { name: 'Crushing chest pain', severity: 'severe', is_red_flag: true },
        { name: 'Diaphoresis', severity: 'moderate' }
      ],
      vitals: { heartRate: 118, bpSystolic: 185, bpDiastolic: 110, spo2: 95 }
    });
    console.log(`   - Level: ESI ${esi2.esiLevel} [${esi2.levelName}] | Max Wait: ${esi2.recommendedMaxWaitMinutes}m`);
    console.log(`   - Clinical Flags: ${esi2.clinicalFlags.join(', ')}`);
    if (esi2.esiLevel !== 2 || esi2.recommendedMaxWaitMinutes !== 10) {
      throw new Error('ESI 2 evaluation failed');
    }
    console.log('   ✔ ESI 2 properly classified as emergent (10 min max wait).\n');

    // 3. Test ESI Algorithm Level 3: Urgent (2+ resources)
    console.log('3. Evaluating ESI 3 (Urgent Abdominal Pain Scenario - 2+ resources)...');
    const esi3 = EsiService.evaluateESI({
      chiefComplaint: 'Right lower quadrant abdominal pain with fever and vomiting',
      symptoms: [
        { name: 'Abdominal pain', severity: 'moderate' },
        { name: 'Vomiting', severity: 'mild' }
      ],
      vitals: { heartRate: 88, bpSystolic: 125, spo2: 99, temperatureF: 101.2 }
    });
    console.log(`   - Level: ESI ${esi3.esiLevel} [${esi3.levelName}] | Resources: ${esi3.estimatedResourceCount} | Max Wait: ${esi3.recommendedMaxWaitMinutes}m`);
    if (esi3.esiLevel !== 3 || esi3.estimatedResourceCount < 2) {
      throw new Error('ESI 3 evaluation failed');
    }
    console.log('   ✔ ESI 3 properly identified multiple resource requirements.\n');

    // 4. Test ESI Algorithm Level 4: Less Urgent (1 resource)
    console.log('4. Evaluating ESI 4 (Less Urgent Simple Laceration Scenario - 1 resource)...');
    const esi4 = EsiService.evaluateESI({
      chiefComplaint: 'Clean knife laceration to left thumb requiring sutures',
      symptoms: [{ name: 'Thumb cut', severity: 'mild' }],
      vitals: { heartRate: 72, bpSystolic: 118, spo2: 99 }
    });
    console.log(`   - Level: ESI ${esi4.esiLevel} [${esi4.levelName}] | Resources: ${esi4.estimatedResourceCount} | Max Wait: ${esi4.recommendedMaxWaitMinutes}m`);
    if (esi4.esiLevel !== 4 || esi4.estimatedResourceCount !== 1) {
      throw new Error('ESI 4 evaluation failed');
    }
    console.log('   ✔ ESI 4 correctly assigned to single-resource laceration.\n');

    // 5. Test ESI Algorithm Level 5: Non-Urgent (0 resources)
    console.log('5. Evaluating ESI 5 (Non-Urgent Prescription Refill - 0 resources)...');
    const esi5 = EsiService.evaluateESI({
      chiefComplaint: 'Routine blood pressure medication refill request',
      symptoms: [],
      vitals: { heartRate: 70, bpSystolic: 122, spo2: 98 }
    });
    console.log(`   - Level: ESI ${esi5.esiLevel} [${esi5.levelName}] | Resources: ${esi5.estimatedResourceCount} | Max Wait: ${esi5.recommendedMaxWaitMinutes}m`);
    if (esi5.esiLevel !== 5 || esi5.estimatedResourceCount !== 0) {
      throw new Error('ESI 5 evaluation failed');
    }
    console.log('   ✔ ESI 5 correctly assigned for zero-resource routine refill.\n');

    // 6. Test Dynamic Waiting Room Queue Manager
    console.log('6. Querying Dynamic Waiting Room Queue & Metrics...');
    const queueData = await EsiService.getDynamicWaitingRoomQueue();
    console.log(`   - Total Waiting: ${queueData.stats.totalWaiting}`);
    console.log(`   - ESI Distribution: ESI 1: ${queueData.stats.esi1Count} | ESI 2: ${queueData.stats.esi2Count} | ESI 3: ${queueData.stats.esi3Count} | ESI 4: ${queueData.stats.esi4Count} | ESI 5: ${queueData.stats.esi5Count}`);
    console.log(`   - Average Wait Duration: ${queueData.stats.avgWaitMinutes} minutes`);
    console.log(`   - Wait Time Breaches: ${queueData.stats.breachedCount}`);

    if (queueData.queue.length > 0) {
      const topPatient = queueData.queue[0];
      console.log(`   - Top Priority in Queue: ${topPatient.patientName} (ESI ${topPatient.esi.esiLevel}, Wait: ${topPatient.waitDurationMinutes}m, Breached: ${topPatient.isBreached})`);
    }

    console.log('\n✔ INTELLIGENT ESI 1-5 TRIAGE QUEUE & WAITING ROOM TEST PASSED 100%!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test failed with error:', err);
    process.exit(1);
  }
}

runESITests();
