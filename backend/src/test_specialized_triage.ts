import { pool, bootstrap } from './db';
import { SpecializedTriageService } from './services/specializedTriage';

async function runSpecializedTriageTest() {
  console.log('====================================================');
  console.log('  IntakeRx Specialized Pediatric/Geriatric Triage   ');
  console.log('====================================================\n');

  try {
    await bootstrap();

    // ----------------------------------------------------
    // 1. Pediatric Triage Simulation (PEWS Protocol)
    // ----------------------------------------------------
    console.log('1. Setting up Pediatric Patient & High-Acuity Respiratory Case...');
    const pedPatientEmail = `pediatric.leo.${Date.now()}@example.com`;
    const pedPatientRes = await pool.query(`
      INSERT INTO patients (name, email, password_hash, dob, sex)
      VALUES ('Leo Martinez (Toddler)', $1, 'ped_hash', '2024-03-10', 'Male')
      RETURNING *
    `, [pedPatientEmail]);
    const pedPatient = pedPatientRes.rows[0];

    const pedSessionRes = await pool.query(`
      INSERT INTO intake_sessions (id, patient_id, status, triage_level)
      VALUES (gen_random_uuid(), $1, 'active', 'orange')
      RETURNING *
    `, [pedPatient.id]);
    const pedSession = pedSessionRes.rows[0];
    console.log(`   ✔ Pediatric Encounter initialized [Session: ${pedSession.id.substring(0, 8)}]`);

    // Register Mother as Caregiver Proxy
    console.log('   Registering Legal Caregiver Proxy...');
    const pedProxy = await SpecializedTriageService.registerCaregiverProxy(pedPatient.id, {
      proxyName: 'Elena Martinez',
      relationship: 'Mother (Legal Guardian)',
      phone: '555-019-3382',
      email: 'elena.m@example.com',
      accessLevel: 'full'
    });
    console.log(`   ✔ Caregiver Proxy registered: ${pedProxy.proxy_name} [${pedProxy.relationship}]`);

    // Evaluate PEWS Score
    console.log('   Calculating Pediatric Early Warning Score (PEWS)...');
    const pewsResult = SpecializedTriageService.calculatePews({
      behavior: 2, // Irritable / continuous crying
      cardiovascular: 2, // Pale, cap refill 4s, tachycardia
      respiratory: 3, // Severe sternal retractions, tracheal tug, grunting
      nebulizerFrequent: true // Frequent albuterol nebs (+2)
    });

    console.log(`   ✔ Calculated PEWS: ${pewsResult.totalScore}/11 [Risk: ${pewsResult.riskTier}]`);
    console.log(`     Action: "${pewsResult.escalationAction}"`);
    if (pewsResult.totalScore !== 9 || pewsResult.riskTier !== 'HIGH') {
      throw new Error(`Unexpected PEWS calculation: Score ${pewsResult.totalScore}`);
    }

    // Save Pediatric Assessment to DB
    const pedAssessment = await SpecializedTriageService.recordAssessment({
      sessionId: pedSession.id,
      patientType: 'pediatric',
      pewsCriteria: {
        behavior: 2,
        cardiovascular: 2,
        respiratory: 3,
        nebulizerFrequent: true
      },
      proxyId: pedProxy.id,
      clinicianRecommendations: 'Immediate pediatric intensivist bedside evaluation. Prepare CPAP/high-flow nasal cannula.'
    });
    console.log(`   ✔ Pediatric Assessment recorded [ID: ${pedAssessment.id}, PEWS: ${pedAssessment.pews_score}]`);

    // ----------------------------------------------------
    // 2. Geriatric Triage Simulation (Morse Fall Risk & Delirium)
    // ----------------------------------------------------
    console.log('\n2. Setting up Geriatric Patient & Fall Vulnerability Assessment...');
    const gerPatientEmail = `geriatric.arthur.${Date.now()}@example.com`;
    const gerPatientRes = await pool.query(`
      INSERT INTO patients (name, email, password_hash, dob, sex)
      VALUES ('Arthur Pendelton (84yo)', $1, 'ger_hash', '1942-06-18', 'Male')
      RETURNING *
    `, [gerPatientEmail]);
    const gerPatient = gerPatientRes.rows[0];

    const gerSessionRes = await pool.query(`
      INSERT INTO intake_sessions (id, patient_id, status, triage_level)
      VALUES (gen_random_uuid(), $1, 'active', 'yellow')
      RETURNING *
    `, [gerPatient.id]);
    const gerSession = gerSessionRes.rows[0];
    console.log(`   ✔ Geriatric Encounter initialized [Session: ${gerSession.id.substring(0, 8)}]`);

    // Register Adult Daughter as DPOA Proxy
    const gerProxy = await SpecializedTriageService.registerCaregiverProxy(gerPatient.id, {
      proxyName: 'Claire Pendelton, Esq.',
      relationship: 'Adult Daughter (DPOA for Healthcare)',
      phone: '555-019-7714',
      email: 'claire.poa@example.com',
      accessLevel: 'full'
    });
    console.log(`   ✔ Caregiver Proxy registered: ${gerProxy.proxy_name} [${gerProxy.relationship}]`);

    // Calculate Morse Fall Risk
    console.log('   Calculating Morse Fall Risk Score...');
    const morseResult = SpecializedTriageService.calculateMorseFallRisk({
      historyOfFalls: true, // 25
      secondaryDiagnosis: true, // 15
      ambulatoryAid: 'furniture_support', // 30
      ivSalineLock: true, // 20
      gait: 'impaired_hesitant', // 20
      mentalStatus: 'overestimates_or_forgets' // 15
    });
    console.log(`   ✔ Morse Fall Risk Score: ${morseResult.totalScore} [Category: ${morseResult.riskLevel}]`);
    console.log(`     Precautions Count: ${morseResult.precautions.length} protocols engaged`);
    if (morseResult.totalScore !== 125 || morseResult.riskLevel !== 'HIGH') {
      throw new Error(`Unexpected Morse score: ${morseResult.totalScore}`);
    }

    // Screen Atypical Presentation & Delirium
    console.log('   Screening Atypical Geriatric Syndromes & Acute Delirium...');
    const geriatricScreen = SpecializedTriageService.screenGeriatricSyndromes({
      age: 84,
      chiefComplaint: 'Patient experienced unwitnessed fall in kitchen with subtle acute confusion today',
      symptoms: ['acute confusion', 'generalized weakness', 'unsteady gait'],
      hasAcuteConfusion: true,
      cfsScore: 6 // Moderately Frail
    });

    console.log(`   ✔ Delirium Detected: ${geriatricScreen.deliriumDetected}`);
    console.log(`   ✔ Clinical Frailty Scale (CFS): ${geriatricScreen.frailtyScore} (${geriatricScreen.frailtyCategory})`);
    console.log(`   ✔ Atypical Infection Flags: ${geriatricScreen.atypicalPresentationFlags.length}`);
    geriatricScreen.atypicalPresentationFlags.forEach(f => console.log(`     • ${f}`));

    if (!geriatricScreen.deliriumDetected || geriatricScreen.atypicalPresentationFlags.length === 0) {
      throw new Error('Atypical occult infection screen did not flag expected geriatric syndrome.');
    }

    // Save Geriatric Assessment to DB
    const gerAssessment = await SpecializedTriageService.recordAssessment({
      sessionId: gerSession.id,
      patientType: 'geriatric',
      morseCriteria: {
        historyOfFalls: true,
        secondaryDiagnosis: true,
        ambulatoryAid: 'furniture_support',
        ivSalineLock: true,
        gait: 'impaired_hesitant',
        mentalStatus: 'overestimates_or_forgets'
      },
      geriatricScreen: {
        hasAcuteConfusion: true,
        cfsScore: 6,
        symptoms: ['acute confusion', 'generalized weakness'],
        chiefComplaint: 'Patient experienced unwitnessed fall with subtle acute confusion'
      },
      proxyId: gerProxy.id,
      clinicianRecommendations: 'Red fall-risk protocol. STAT Urinalysis & Basic Metabolic Panel to rule out urosepsis/delirium.'
    });

    console.log(`   ✔ Geriatric Assessment recorded [ID: ${gerAssessment.id}, Morse: ${gerAssessment.morse_fall_score}]`);

    // ----------------------------------------------------
    // 3. Verification Query with Proxy Join
    // ----------------------------------------------------
    console.log('\n3. Verifying Assessment Retrieval with Caregiver Proxy Delegation...');
    const fetchedGer = await SpecializedTriageService.getAssessment(gerSession.id);
    console.log(`   ✔ Session ${fetchedGer.session_id.substring(0, 8)} linked to Proxy: ${fetchedGer.proxy_name} (${fetchedGer.relationship})`);
    console.log(`   ✔ Morse Score: ${fetchedGer.morse_fall_score} | Delirium: ${fetchedGer.delirium_detected}`);

    console.log('\n✔ PEDIATRIC & GERIATRIC SPECIALIZED TRIAGE SUITE PASSED 100%!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  }
}

runSpecializedTriageTest();
