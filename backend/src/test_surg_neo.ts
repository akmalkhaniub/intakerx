import {
  evaluateNeonatalSurgicalEmergency,
  evaluateSurgicalDecompression,
  saveSurgicalEvaluation,
  getPatientSurgicalEvaluations,
  saveDecompressionLog,
  getPatientDecompressionLogs,
  SurgicalEvaluationInput,
  DecompressionMonitoringInput
} from './services/surgNeo';
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
  console.log('=== RUNNING SURG-NEO (PHASE 91) INTEGRATION & SURGICAL SAFETY TESTS ===\n');

  // TEST 1: Congenital Diaphragmatic Hernia (CDH)
  console.log('[Test 1] CDH Emergency: Bag-Mask Contraindication & Gentle Ventilation');
  const cdhInput: SurgicalEvaluationInput = {
    patientId: 1,
    gestationalAgeWeeks: 38.5,
    currentWeightGrams: 3200,
    emergencyType: 'CDH',
    clinicalPresentation: {
      scaphoidAbdomen: true,
      bowelSoundsInChest: true
    },
    radiographicFindings: {
      bowelLoopsInHemithorax: true,
      mediastinalShiftOpposite: true
    }
  };
  const cdhRes = evaluateNeonatalSurgicalEmergency(cdhInput);
  assert(cdhRes.emergencyType === 'CDH', 'Emergency type identified as CDH');
  assert(
    cdhRes.contraindicatedInterventions.some(c => c.intervention.includes('Bag-Valve-Mask') && c.absoluteContraindication),
    'Strictly contraindicates Bag-Valve-Mask ventilation'
  );
  assert(
    cdhRes.airwayVentStrategy.includes('PIP < 25') && cdhRes.airwayVentStrategy.includes('Permissive Hypercapnia'),
    'Prescribes gentle lung-protective ventilation (PIP < 25 cmH2O, Permissive Hypercapnia)'
  );
  assert(
    cdhRes.decompressionRegimen.includes('Replogle') && cdhRes.decompressionRegimen.includes('-20 to -30 mmHg'),
    'Directs Replogle sump decompression to -20 to -30 mmHg'
  );
  assert(
    cdhRes.syndromicAndCoAnomalyScreen.some(s => s.includes('Echocardiogram')),
    'Includes urgent Echocardiogram screen for PPHN and cardiac defects'
  );

  // TEST 2: Gastroschisis: Evaporative Fluid Loss & Silo Reduction
  console.log('\n[Test 2] Gastroschisis: Sterile Bowel Bag, Fluid Resuscitation & Staged Silo');
  const gastroInput: SurgicalEvaluationInput = {
    patientId: 1,
    gestationalAgeWeeks: 36.2,
    currentWeightGrams: 2400,
    emergencyType: 'GASTROSCHISIS',
    clinicalPresentation: {
      exposedEvisceratedBowel: true,
      umbilicalCordOnSac: false
    },
    radiographicFindings: {}
  };
  const gastroRes = evaluateNeonatalSurgicalEmergency(gastroInput);
  assert(gastroRes.surgicalUrgency === 'STAGED_SILO_OR_REDUCTION', 'Urgency is STAGED_SILO_OR_REDUCTION');
  assert(
    gastroRes.fluidResuscitationTarget.includes('150 - 200 mL/kg/day'),
    'Recommends aggressive fluid replacement (150-200 mL/kg/day) for evaporative loss'
  );
  assert(
    gastroRes.clinicalActionPlan.some(p => p.action.includes('bowel bag') || p.action.includes('plastic wrap')),
    'Directs immediate sterile bowel bag / plastic wrap application'
  );
  assert(
    gastroRes.contraindicatedInterventions.some(c => c.intervention.includes('Dry Dressing') || c.intervention.includes('Gauze')),
    'Contraindicates dry dressing on exposed viscera'
  );

  // TEST 3: Omphalocele: Beckwith-Wiedemann & Cardiac Screen
  console.log('\n[Test 3] Omphalocele: Syndromic Screening (Beckwith-Wiedemann & CHD)');
  const omphaloceleInput: SurgicalEvaluationInput = {
    patientId: 1,
    gestationalAgeWeeks: 39.0,
    currentWeightGrams: 3500,
    emergencyType: 'OMPHALOCELE',
    clinicalPresentation: {
      umbilicalCordOnSac: true,
      sacRuptured: false
    },
    radiographicFindings: {}
  };
  const omphaloceleRes = evaluateNeonatalSurgicalEmergency(omphaloceleInput);
  assert(
    omphaloceleRes.syndromicAndCoAnomalyScreen.some(s => s.includes('Beckwith-Wiedemann') && s.includes('Hypoglycemia')),
    'Screens for Beckwith-Wiedemann Syndrome (hyperinsulinemic hypoglycemia & macroglossia)'
  );
  assert(
    omphaloceleRes.syndromicAndCoAnomalyScreen.some(s => s.includes('Echocardiogram')),
    'Mandates STAT Echocardiogram for high-frequency congenital heart defects (35-50%)'
  );
  assert(
    omphaloceleRes.contraindicatedInterventions.some(c => c.intervention.includes('Aggressive Manual Reduction')),
    'Contraindicates aggressive manual reduction of intact sac (risk of hepatic vein kinking/arrest)'
  );

  // TEST 4: Tracheoesophageal Fistula & Esophageal Atresia (TEF/EA)
  console.log('\n[Test 4] TEF/EA: Upper Pouch Decompression, HOB Elevation & Avoid PPV');
  const tefInput: SurgicalEvaluationInput = {
    patientId: 1,
    gestationalAgeWeeks: 38.0,
    currentWeightGrams: 2900,
    emergencyType: 'TEF_EA',
    clinicalPresentation: {
      excessiveSalivationDrooling: true,
      chokingWithFeeds: true,
      inabilityToPassNgt: true
    },
    radiographicFindings: {
      coiledNgtInUpperPouch: true
    }
  };
  const tefRes = evaluateNeonatalSurgicalEmergency(tefInput);
  assert(
    tefRes.contraindicatedInterventions.some(c => c.intervention.includes('Positive Pressure Ventilation') && c.absoluteContraindication),
    'Strictly contraindicates Positive Pressure Ventilation (PPV/CPAP/Bag-Mask)'
  );
  assert(
    tefRes.clinicalActionPlan.some(p => p.action.includes('30 - 45 degrees')),
    'Directs elevating head of bed to 30-45 degrees to minimize gastric acid reflux via fistula'
  );
  assert(
    tefRes.syndromicAndCoAnomalyScreen.some(s => s.includes('VACTERL')),
    'Mandates systematic VACTERL anomaly screening protocol'
  );
  assert(
    tefRes.decompressionRegimen.includes('10 Fr Replogle') && tefRes.decompressionRegimen.includes('CONTINUOUS SUCTION'),
    'Prescribes 10 Fr Replogle to continuous suction in upper pouch'
  );

  // TEST 5: Necrotizing Enterocolitis (NEC Bell's Stage IIIB - Perforated)
  console.log('\n[Test 5] NEC Stage IIIB: Pneumoperitoneum, Surgical Intervention & Triple Antibiotics');
  const necInput: SurgicalEvaluationInput = {
    patientId: 1,
    gestationalAgeWeeks: 27.2,
    currentWeightGrams: 850, // ELBW < 1000g -> Primary Peritoneal Drain candidate
    emergencyType: 'NEC',
    clinicalPresentation: {
      abdominalDistention: true,
      abdominalErythemaOrDiscoloration: true,
      septicShockOrAcidosis: true,
      grosslyBloodyStools: true
    },
    radiographicFindings: {
      pneumatosisIntestinalis: true,
      portalVenousGas: true,
      pneumoperitoneumFreeAir: true
    },
    plateletCount: 38000,
    serumLactateMmolL: 5.4,
    bloodPh: 7.14
  };
  const necRes = evaluateNeonatalSurgicalEmergency(necInput);
  assert(necRes.bellStage === 'STAGE_IIIB_PERFORATED', 'Correctly staged as Bell Stage IIIB (Perforated)');
  assert(
    necRes.surgicalUrgency === 'URGENT_BEDSIDE_DRAIN',
    'Urgency is URGENT_BEDSIDE_DRAIN for ELBW infant (< 1000g)'
  );
  assert(
    Boolean(
      necRes.antimicrobialRegimen?.includes('Ampicillin') &&
      necRes.antimicrobialRegimen?.includes('Gentamicin') &&
      necRes.antimicrobialRegimen?.includes('Metronidazole')
    ),
    'Prescribes broad-spectrum triple therapy (Ampicillin + Gentamicin + Metronidazole)'
  );
  assert(
    necRes.contraindicatedInterventions.some(c => c.intervention.includes('Enteral Nutrition')),
    'Contraindicates enteral feedings'
  );

  // TEST 6: Surgical Decompression Monitoring
  console.log('\n[Test 6] Surgical Decompression: Suction Safety & Bilious Aspirate Protocol');
  const decompInput1: DecompressionMonitoringInput = {
    patientId: 1,
    emergencyType: 'CDH',
    replogleSizeFr: 10,
    suctionPressureMmhg: -25, // Optimal
    aspirateVolumeMl: 14,
    aspirateCharacter: 'Clear gastric secretions',
    abdominalExam: 'Soft, scaphoid, non-tender'
  };
  const decompRes1 = evaluateSurgicalDecompression(decompInput1);
  assert(decompRes1.suctionStatus === 'OPTIMAL_CONTINUOUS_DRAIN', 'Identified as OPTIMAL_CONTINUOUS_DRAIN');
  assert(decompRes1.decompressionEffective === true, 'Decompression marked effective');

  const decompInput2: DecompressionMonitoringInput = {
    patientId: 1,
    emergencyType: 'NEC',
    replogleSizeFr: 8,
    suctionPressureMmhg: -50, // High suction hazard (> 40 mmHg)
    aspirateVolumeMl: 28,
    aspirateCharacter: 'Bilio-viscous green drainage',
    abdominalExam: 'Distended, tense, erythematous'
  };
  const decompRes2 = evaluateSurgicalDecompression(decompInput2);
  assert(
    decompRes2.suctionStatus === 'EXCESSIVE_PRESSURE_RISK',
    'Detected EXCESSIVE_PRESSURE_RISK for suction > 40 mmHg'
  );
  assert(
    decompRes2.aspirateRiskAssessment.includes('BILIOUS ENTERIC ASPIRATE'),
    'Identified bilious drainage risk for mechanical obstruction'
  );
  assert(
    decompRes2.directives.some(d => d.includes('PERITONEAL RE-EVALUATION')),
    'Triggered peritoneal re-evaluation directive for tense, erythematous abdomen'
  );

  // TEST 7: Database Persistence
  console.log('\n[Test 7] Database Persistence: Evaluations & Decompression Logs');
  try {
    const pRes = await pool.query('SELECT id FROM patients LIMIT 1');
    const testPatientId = pRes.rows.length > 0 ? pRes.rows[0].id : 1;

    const savedEval = await saveSurgicalEvaluation({
      ...cdhInput,
      patientId: testPatientId,
      ...cdhRes
    });
    assert(!!savedEval && savedEval.id > 0, `Surgical evaluation saved with ID: ${savedEval?.id}`);
    assert(savedEval.surgical_emergency_type === 'CDH', 'Stored emergency_type is CDH');

    const historyEvals = await getPatientSurgicalEvaluations(testPatientId);
    assert(historyEvals.length > 0, `Retrieved ${historyEvals.length} surgical evaluations for patient ${testPatientId}`);

    const savedLog = await saveDecompressionLog({
      ...decompInput1,
      patientId: testPatientId,
      ...decompRes1
    });
    assert(!!savedLog && savedLog.id > 0, `Decompression log saved with ID: ${savedLog?.id}`);
    assert(savedLog.decompression_effective === true, 'Stored decompression_effective is true');

    const historyLogs = await getPatientDecompressionLogs(testPatientId);
    assert(historyLogs.length > 0, `Retrieved ${historyLogs.length} decompression logs for patient ${testPatientId}`);
  } catch (err) {
    console.error('Database persistence test error:', err);
    assert(false, 'Database operations succeeded without error');
  }

  console.log(`\n=================================================`);
  console.log(`SURG-NEO TESTS COMPLETED: ${passed} passed, ${failed} failed`);
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
