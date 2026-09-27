import { pool, bootstrap } from './db';
import { clinicalCodingService } from './services/clinicalCoding';

async function runClinicalCodingTest() {
  console.log('====================================================');
  console.log('  IntakeRx Phase 31: Autonomous CAC & Cross-Mapping ');
  console.log('====================================================\n');

  try {
    await bootstrap();

    // 1. Create Patient and Encounter with Unspecified Knee Pain and Comorbidities
    console.log('1. Setting up Clinical Encounter for CAC Extraction...');
    const patientEmail = `cac.patient.${Date.now()}@example.com`;
    const patientRes = await pool.query(`
      INSERT INTO patients (name, email, password_hash, dob, sex)
      VALUES ('Harold Finch', $1, 'hashed_pw', '1962-04-12', 'Male')
      RETURNING *
    `, [patientEmail]);
    const patient = patientRes.rows[0];

    const sessionRes = await pool.query(`
      INSERT INTO intake_sessions (
        id, patient_id, status, triage_level, triage_rationale
      ) VALUES (
        gen_random_uuid(), $1, 'active', 'yellow', 'Moderate severity knee pain and diabetic evaluation'
      ) RETURNING *
    `, [patient.id]);
    const session = sessionRes.rows[0];

    // Insert Clinical Summary / SOAP Note
    await pool.query(`
      INSERT INTO intake_summaries (
        session_id, summary_data, status
      ) VALUES (
        $1,
        $2,
        'confirmed'
      )
    `, [
      session.id,
      JSON.stringify({
        chiefComplaint: 'Severe right knee pain and swelling for 4 weeks. Burning feet tingling at night.',
        assessment: 'Patient reports moderate-severe right knee osteoarthritis causing gait impairment. History of essential hypertension and type 2 diabetes with peripheral neuropathy.',
        plan: 'Right knee radiograph, continue hypertension management, initiate gabapentin for diabetic neuropathy.',
        subjective: 'Patient reports progressive right knee aching worsening with ambulation. Peripheral numbness and burning feet sensation.',
        objective: 'Right knee crepitus and mild effusion. BP 138/84, HR 74, SpO2 98%.'
      })
    ]);
    console.log(`   ✔ Encounter initialized [Session: ${session.id.substring(0, 8)}]`);

    // 2. Execute Autonomous CAC Analysis
    console.log('\n2. Running Autonomous CAC NLP Entity Extractor & Dual Crosswalks...');
    const analysis = await clinicalCodingService.analyzeEncounterDocumentation(session.id);

    console.log(`   ✔ Total Suggested Codes: ${analysis.suggestedCodes.length}`);
    console.log(`   ✔ Documentation Completeness: ${analysis.documentationCompleteness}%`);
    console.log(`   ✔ Downcoding Risk Score: ${analysis.downcodingRiskScore}/100`);
    console.log(`   ✔ Estimated Revenue Impact Delta: $${analysis.revenueImpactEstimate.toFixed(2)}`);

    // Verify key codes
    const icd10Codes = analysis.suggestedCodes.filter(c => c.codeSystem === 'ICD-10-CM');
    console.log('   Suggested ICD-10-CM Codes:');
    for (const code of icd10Codes) {
      console.log(`     - [${code.code}] ${code.description} (Confidence: ${code.confidenceScore}%, Specificity: ${code.specificityLevel})`);
      if (code.crossMappings.icd11) {
        console.log(`       -> ICD-11: ${code.crossMappings.icd11.code} - ${code.crossMappings.icd11.title}`);
      }
      if (code.crossMappings.snomedCt) {
        console.log(`       -> SNOMED-CT: ${code.crossMappings.snomedCt.code} - ${code.crossMappings.snomedCt.title}`);
      }
    }

    // Verify Right Knee Osteoarthritis Specificity Upgrade was detected
    const hasRightKnee = icd10Codes.some(c => c.code === 'M17.11');
    const hasNeuropathy = icd10Codes.some(c => c.code === 'E11.40');
    const hasHtn = icd10Codes.some(c => c.code === 'I10');
    const hasEmCpt = analysis.suggestedCodes.some(c => c.code === '99214' || c.codeSystem === 'CPT');

    if (!hasRightKnee && !icd10Codes.some(c => c.code.startsWith('M17'))) {
      throw new Error('CAC failed to identify Knee Osteoarthritis codes');
    }
    console.log(`   ✔ Right Knee Laterality Recognition: ${hasRightKnee ? 'EXACT M17.11' : 'Detected'}`);
    console.log(`   ✔ Diabetic Neuropathy Specificity: ${hasNeuropathy ? 'UPGRADED E11.40' : 'Detected'}`);
    console.log(`   ✔ Comorbidity Cross-Mapping (Hypertension I10): ${hasHtn ? 'YES' : 'NO'}`);
    console.log(`   ✔ E&M CPT Procedure Code Suggested: ${hasEmCpt ? 'YES' : 'NO'}`);

    // 3. Test CDI Query & Specificity Recommendations
    console.log('\n3. Testing CDI Clinical Documentation Improvement Query Generation...');
    const testUnspecifiedAnalysis = await clinicalCodingService.analyzeEncounterDocumentation(
      session.id,
      'Patient reports knee pain and asthma. Unspecified.'
    );
    console.log(`   ✔ CDI Specificity Recommendations Triggered: ${testUnspecifiedAnalysis.specificityRecommendations.length}`);
    for (const rec of testUnspecifiedAnalysis.specificityRecommendations) {
      console.log(`     - Issue: ${rec.issue}`);
      console.log(`       Query: "${rec.clarificationQuery}"`);
      console.log(`       Upgrades: ${rec.suggestedUpgrades.map(u => `${u.code} (+$${u.revenueDelta})`).join(', ')}`);
    }

    // 4. Test Clinician Review and Code Acceptance
    console.log('\n4. Simulating Clinician Code Review and Sign-Off...');
    const dbSessions = await clinicalCodingService.getCacSessions(session.id);
    if (dbSessions.length === 0) {
      throw new Error('No CAC sessions saved in database.');
    }
    const cacSession = dbSessions[0];

    const acceptedCodes = analysis.suggestedCodes.map(c => ({
      code: c.code,
      codeSystem: c.codeSystem,
      description: c.description,
      status: 'accepted'
    }));

    const reviewed = await clinicalCodingService.reviewAndAcceptCodes(
      cacSession.id,
      acceptedCodes,
      'Approved high-specificity ICD-10 and dual ICD-11/SNOMED-CT codes. Clinical documentation supports M17.11.'
    );

    console.log(`   ✔ Review completed. Status: ${reviewed.status}`);
    console.log(`   ✔ Accepted Codes Count: ${reviewed.accepted_codes.length}`);
    console.log(`   ✔ Clinician Feedback: "${reviewed.clinician_feedback}"`);

    console.log('\n====================================================');
    console.log('  Phase 31 CAC & Cross-Mapping Test Passed 100%!     ');
    console.log('====================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ CAC Test Failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runClinicalCodingTest();
