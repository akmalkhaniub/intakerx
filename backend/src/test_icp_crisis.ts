import {
  evaluateIcpCrisis,
  evaluateOsmotherapy,
  saveIcpEvaluation,
  getPatientIcpEvaluations,
  saveOsmotherapyLog,
  getPatientOsmotherapyLogs,
  IcpCrisisInput,
  OsmotherapyInput
} from './services/icpCrisis';
import { pool } from './db';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('=== RUNNING ICP-CRISIS (PHASE 92) INTEGRATION & NEUROTRAUMA SAFETY TESTS ===\n');

  // TEST 1: Tier 0 Baseline Neuro-Protection
  console.log('[Test 1] Tier 0 Baseline Prophylaxis (Normal ICP & Optimal CPP)');
  const case1: IcpCrisisInput = {
    patientId: 1,
    gcsScore: 14,
    icpMmhg: 12.0,
    mapMmhg: 85.0,
    pbto2Mmhg: 28.0,
    sjvo2Percent: 65.0,
    npiLeft: 4.2,
    npiRight: 4.1
  };
  const res1 = evaluateIcpCrisis(case1);
  assert(res1.tierLevel === 'TIER_0', 'Classified as TIER_0');
  assert(res1.cppMmhg === 73.0, `Calculated CPP correctly: ${res1.cppMmhg} mmHg`);
  assert(res1.herniationSyndrome === 'NONE_MONITORED', 'No herniation syndrome');
  assert(
    res1.clinicalActions.some(a => a.action.includes('Head of Bed elevated 30-45 degrees')),
    'Includes HOB 30-45 degrees midline protocol'
  );

  // TEST 2: Tier 1 Intracranial Hypertension with Ischemic CPP Compromise (< 60 mmHg)
  console.log('\n[Test 2] Tier 1: ICP 23 mmHg with Ischemic CPP Compromise (57 mmHg)');
  const case2: IcpCrisisInput = {
    patientId: 1,
    gcsScore: 9,
    icpMmhg: 23.0,
    mapMmhg: 80.0, // CPP = 80 - 23 = 57 mmHg (< 60)
    evdInPlace: true,
    currentSodiumMeqL: 142,
    currentOsmolalityMosmKg: 298
  };
  const res2 = evaluateIcpCrisis(case2);
  assert(res2.tierLevel === 'TIER_1', 'Classified as TIER_1');
  assert(res2.cppMmhg === 57.0, `Calculated CPP: ${res2.cppMmhg} mmHg`);
  assert(res2.cppStatus === 'ISCHEMIC_COMPROMISE', 'Identified as ISCHEMIC_COMPROMISE');
  assert(
    res2.clinicalActions.some(a => a.action.includes('Open External Ventricular Drain (EVD)')),
    'Directs opening EVD to drain CSF'
  );
  assert(
    res2.clinicalActions.some(a => a.action.includes('Norepinephrine') && a.action.includes('CPP >= 60-70')),
    'Directs Norepinephrine titration to restore CPP >= 60-70 mmHg'
  );

  // TEST 3: Tier 2 Refractory ICP with Brain Tissue Hypoxia (PbtO2 < 15 mmHg)
  console.log('\n[Test 3] Tier 2: Refractory ICP (28 mmHg) & Critical Cellular Hypoxia (PbtO2 13 mmHg)');
  const case3: IcpCrisisInput = {
    patientId: 1,
    gcsScore: 6,
    icpMmhg: 28.0,
    mapMmhg: 95.0, // CPP = 67 mmHg
    pbto2Mmhg: 13.0, // Critical hypoxia < 15 mmHg
    sjvo2Percent: 51.0, // Cerebral oligemia < 55%
    npiLeft: 3.2,
    npiRight: 3.1
  };
  const res3 = evaluateIcpCrisis(case3);
  assert(res3.tierLevel === 'TIER_2', 'Classified as TIER_2');
  assert(
    res3.multimodalNeuromonitoringAlerts.some(a => a.includes('CRITICAL BRAIN TISSUE ISCHEMIA')),
    'Triggered Critical Brain Tissue Ischemia alert (PbtO2 < 15 mmHg)'
  );
  assert(
    res3.multimodalNeuromonitoringAlerts.some(a => a.includes('CEREBRAL OLIGEMIA')),
    'Triggered Cerebral Oligemia alert (SjvO2 < 55%)'
  );
  assert(
    res3.clinicalActions.some(a => a.action.includes('Neuromuscular Blockade') && a.action.includes('Cisatracurium')),
    'Directs Cisatracurium neuromuscular blockade trial'
  );
  assert(
    res3.clinicalActions.some(a => a.action.includes('PaCO2 30-35 mmHg')),
    'Prescribes mild hyperventilation to PaCO2 30-35 mmHg'
  );

  // TEST 4: Tier 3 Impending Uncal Transtentorial Herniation (Blown Pupil / Sluggish NPi)
  console.log('\n[Test 4] Tier 3: Impending Uncal Transtentorial Herniation (Blown Pupil)');
  const case4: IcpCrisisInput = {
    patientId: 1,
    gcsScore: 4,
    icpMmhg: 34.0,
    mapMmhg: 100.0,
    unilateralPupilDilation: true,
    npiLeft: 1.8,
    npiRight: 4.2
  };
  const res4 = evaluateIcpCrisis(case4);
  assert(res4.tierLevel === 'TIER_3', 'Classified as TIER_3');
  assert(res4.herniationSyndrome === 'UNCAL_TRANSTENTORIAL', 'Identified as UNCAL_TRANSTENTORIAL');
  assert(
    res4.osmotherapyRegimen.recommendedAgent === 'HYPERTONIC_SALINE_23_4',
    'Recommends emergent Hypertonic Saline 23.4% 30 mL push'
  );
  assert(
    res4.clinicalActions.some(a => a.action.includes('Emergency Decompressive Craniectomy')),
    'Directs STAT Neurosurgery consultation for Emergency Decompressive Craniectomy'
  );
  assert(
    res4.clinicalActions.some(a => a.action.includes('Pentobarbital Coma')),
    'Initiates high-dose Barbiturate Coma protocol with cEEG burst suppression target'
  );

  // TEST 5: Tonsillar Herniation (Cushing's Triad)
  console.log('\n[Test 5] Tier 3: Tonsillar Herniation with Cushing Triad');
  const case5: IcpCrisisInput = {
    patientId: 1,
    gcsScore: 5,
    icpMmhg: 38.0,
    mapMmhg: 125.0,
    cushingTriadPresent: true
  };
  const res5 = evaluateIcpCrisis(case5);
  assert(res5.herniationSyndrome === 'TONSILLAR_FORAMEN_MAGNUM', 'Identified as TONSILLAR_FORAMEN_MAGNUM');
  assert(res5.tierLevel === 'TIER_3', 'Emergency TIER_3');

  // TEST 6: Osmotherapy Ceiling & Safety Limits
  console.log('\n[Test 6] Osmotherapy Safety: Safe vs Borderline vs Contraindicated');
  const osmoSafe: OsmotherapyInput = {
    patientId: 1,
    agent: 'HYPERTONIC_SALINE_3',
    doseVolumeMl: 250,
    serumSodiumMeqL: 148,
    serumOsmolalityMosmKg: 305,
    preIcp: 24,
    postIcp: 17
  };
  const osmoSafeRes = evaluateOsmotherapy(osmoSafe);
  assert(osmoSafeRes.safetyStatus === 'SAFE_TO_ADMINISTER', 'Classified as SAFE_TO_ADMINISTER');
  assert(osmoSafeRes.deltaIcp === 7.0, `Calculated delta ICP correctly: ${osmoSafeRes.deltaIcp} mmHg`);

  const osmoToxic: OsmotherapyInput = {
    patientId: 1,
    agent: 'MANNITOL_20',
    doseVolumeMl: 350,
    serumSodiumMeqL: 161, // Exceeds 160 ceiling
    serumOsmolalityMosmKg: 328, // Exceeds 320 ceiling
    osmolarGap: 24, // Exceeds 20 gap ceiling
    preIcp: 26
  };
  const osmoToxicRes = evaluateOsmotherapy(osmoToxic);
  assert(
    osmoToxicRes.safetyStatus === 'CONTRAINDICATED_HYPEROSMOLAR',
    'Classified as CONTRAINDICATED_HYPEROSMOLAR'
  );
  assert(
    osmoToxicRes.directives.some(d => d.includes('CRITICAL HYPEROSMOLAR TOXICITY')),
    'Issued critical hyperosmolar toxicity alert'
  );
  assert(
    osmoToxicRes.directives.some(d => d.includes('ELEVATED OSMOLAR GAP')),
    'Issued elevated mannitol osmolar gap warning (gap >= 20)'
  );

  // TEST 7: Database Persistence
  console.log('\n[Test 7] Database Persistence: ICP Crisis Encounters & Osmotherapy Logs');
  try {
    const pRes = await pool.query('SELECT id FROM patients LIMIT 1');
    const testPatientId = pRes.rows.length > 0 ? pRes.rows[0].id : 1;

    const savedEval = await saveIcpEvaluation({
      ...case4,
      patientId: testPatientId,
      ...res4
    });
    assert(!!savedEval && savedEval.id > 0, `ICP evaluation saved with ID: ${savedEval?.id}`);
    assert(savedEval.herniation_syndrome === 'UNCAL_TRANSTENTORIAL', 'Stored herniation_syndrome is UNCAL_TRANSTENTORIAL');

    const historyEvals = await getPatientIcpEvaluations(testPatientId);
    assert(historyEvals.length > 0, `Retrieved ${historyEvals.length} ICP evaluations for patient ${testPatientId}`);

    const savedLog = await saveOsmotherapyLog({
      ...osmoSafe,
      patientId: testPatientId,
      ...osmoSafeRes
    });
    assert(!!savedLog && savedLog.id > 0, `Osmotherapy log saved with ID: ${savedLog?.id}`);
    assert(savedLog.agent === 'HYPERTONIC_SALINE_3', 'Stored agent is HYPERTONIC_SALINE_3');

    const historyLogs = await getPatientOsmotherapyLogs(testPatientId);
    assert(historyLogs.length > 0, `Retrieved ${historyLogs.length} osmotherapy logs for patient ${testPatientId}`);
  } catch (err) {
    console.error('Database persistence test error:', err);
    assert(false, 'Database operations succeeded without error');
  }

  console.log(`\n=================================================`);
  console.log(`ICP-CRISIS TESTS COMPLETED: ${passed} passed, ${failed} failed`);
  console.log(`=================================================`);

  await pool.end();

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
