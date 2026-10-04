import {
  classifyToxidrome,
  evaluateHunterCriteria,
  evaluateAcetaminophenToxicity,
  evaluateSalicylateToxicity,
  evaluateToxicAlcoholIngestion,
  calculateDigiFabDosing,
  createToxicologyCase,
  recordAntidoteAdministration,
  getToxicologyCaseDetails,
  listActiveToxicologyCases
} from './services/medicalToxicology';
import { pool } from './db';

async function runTests() {
  console.log('🧪 Starting Medical Toxicology & Poison Control Command Test Suite (Phase 58)...\n');

  try {
    // 1. Toxidrome Classification Tests
    console.log('--- Test 1: Toxidrome Classification Engine ---');
    const anticholinergicExam = classifyToxidrome({
      heartRate: 125,
      systolicBp: 140,
      diastolicBp: 88,
      respiratoryRate: 18,
      temperatureC: 38.6,
      pupilSize: 'mydriasis',
      skinExam: 'dry_warm',
      bowelSounds: 'absent',
      mentalStatus: 'delirium'
    });
    console.log(`✓ Anticholinergic Test: Detected '${anticholinergicExam.toxidrome}' with confidence ${anticholinergicExam.confidence}%. Antidote: ${anticholinergicExam.primaryAntidote}`);
    if (anticholinergicExam.toxidrome !== 'Anticholinergic') throw new Error('Expected Anticholinergic toxidrome');

    const cholinergicExam = classifyToxidrome({
      heartRate: 48,
      systolicBp: 95,
      diastolicBp: 55,
      respiratoryRate: 26,
      temperatureC: 36.8,
      pupilSize: 'miosis',
      skinExam: 'diaphoretic',
      bowelSounds: 'hyperactive',
      mentalStatus: 'alert'
    });
    console.log(`✓ Cholinergic Test: Detected '${cholinergicExam.toxidrome}' with confidence ${cholinergicExam.confidence}%. Antidote: ${cholinergicExam.primaryAntidote}`);
    if (cholinergicExam.toxidrome !== 'Cholinergic') throw new Error('Expected Cholinergic toxidrome');

    const opioidExam = classifyToxidrome({
      heartRate: 58,
      systolicBp: 92,
      diastolicBp: 50,
      respiratoryRate: 7,
      temperatureC: 35.8,
      pupilSize: 'miosis',
      skinExam: 'normal',
      bowelSounds: 'hypoactive',
      mentalStatus: 'coma'
    });
    console.log(`✓ Opioid Test: Detected '${opioidExam.toxidrome}' with confidence ${opioidExam.confidence}%. Antidote: ${opioidExam.primaryAntidote}`);
    if (opioidExam.toxidrome !== 'Opioid') throw new Error('Expected Opioid toxidrome');

    // 2. Hunter Serotonin Toxicity Criteria
    console.log('\n--- Test 2: Hunter Serotonin Toxicity Criteria ---');
    const hunterPositive = evaluateHunterCriteria({
      serotonergicAgentPresent: true,
      spontaneousClonus: true,
      inducibleClonus: true,
      ocularClonus: true,
      agitation: true,
      diaphoresis: true,
      tremor: true,
      hyperreflexia: true,
      hypertonia: true,
      temperatureC: 39.4
    });
    console.log(`✓ Hunter Positive: isSerotoninSyndrome=${hunterPositive.isSerotoninSyndrome}, severity=${hunterPositive.severity}, criteria=${hunterPositive.criteriaMet[0]}`);
    if (!hunterPositive.isSerotoninSyndrome || hunterPositive.severity !== 'severe_life_threatening') {
      throw new Error('Hunter criteria failed to detect severe serotonin syndrome');
    }

    const hunterNegative = evaluateHunterCriteria({
      serotonergicAgentPresent: false,
      spontaneousClonus: false,
      inducibleClonus: false,
      ocularClonus: false,
      agitation: false,
      diaphoresis: false,
      tremor: false,
      hyperreflexia: false,
      hypertonia: false,
      temperatureC: 37.0
    });
    console.log(`✓ Hunter Negative: isSerotoninSyndrome=${hunterNegative.isSerotoninSyndrome}`);
    if (hunterNegative.isSerotoninSyndrome) throw new Error('Expected negative serotonin syndrome');

    // 3. Rumack-Matthew APAP Nomogram & NAC Protocol
    console.log('\n--- Test 3: Rumack-Matthew APAP Nomogram & 21-Hour IV NAC Protocol ---');
    const apapToxic = evaluateAcetaminophenToxicity(4, 210, 70);
    console.log(`✓ APAP @ 4h (210 mcg/mL): Category=${apapToxic.riskCategory}, NAC Indicated=${apapToxic.nacIndicated}`);
    console.log(`  NAC Protocol: Bag 1=${apapToxic.nacIvRegimen21Hour.bag1Loading.doseMg} mg, Bag 2=${apapToxic.nacIvRegimen21Hour.bag2Second.doseMg} mg, Bag 3=${apapToxic.nacIvRegimen21Hour.bag3Maintenance.doseMg} mg (Total ${apapToxic.nacIvRegimen21Hour.totalDoseMg} mg)`);
    if (!apapToxic.nacIndicated || apapToxic.nacIvRegimen21Hour.totalDoseMg !== 21000) {
      throw new Error('APAP 4h calculation mismatch');
    }

    const apapSubtoxic = evaluateAcetaminophenToxicity(8, 45, 80);
    console.log(`✓ APAP @ 8h (45 mcg/mL vs 75 mcg/mL threshold): Category=${apapSubtoxic.riskCategory}, NAC Indicated=${apapSubtoxic.nacIndicated}`);
    if (apapSubtoxic.nacIndicated) throw new Error('APAP 8h subtoxic incorrectly flagged for NAC');

    // 4. Salicylate Toxicity & Alkalinization / Dialysis Sentinel
    console.log('\n--- Test 4: Salicylate Toxicity & Hemodialysis Sentinel ---');
    const salicylateCase = evaluateSalicylateToxicity(94, 7.22, 3.4, true, false, false, 70);
    console.log(`✓ Salicylate Assessment: Severity=${salicylateCase.severity}, Dialysis Indicated=${salicylateCase.hemodialysisIndicated}`);
    console.log(`  Bicarbonate Bolus: ${salicylateCase.bicarbonateAlkalinizationRegimen.bolusDoseMeq} mEq, Target Urine pH: ${salicylateCase.bicarbonateAlkalinizationRegimen.targetUrinePh}`);
    if (!salicylateCase.hemodialysisIndicated || salicylateCase.severity !== 'Severe') {
      throw new Error('Expected severe salicylate toxicity requiring hemodialysis');
    }

    // 5. Toxic Alcohol Osmolar Gap & Fomepizole
    console.log('\n--- Test 5: Toxic Alcohol Osmolar Gap & Fomepizole Protocol ---');
    const toxicAlcohol = evaluateToxicAlcoholIngestion(
      'METHANOL',
      338, // Measured Osm
      140, // Na
      95,  // Glucose
      14,  // BUN
      0,   // EtOH
      80,  // Weight kg
      7.24 // pH
    );
    // Calc Osm = 2*140 + 95/18 (5.28) + 14/2.8 (5.0) = 290.3
    // Gap = 338 - 290.3 = 47.7 mOsm/kg
    console.log(`✓ Toxic Alcohol: Calc Osm=${toxicAlcohol.calculatedOsmolality}, Gap=${toxicAlcohol.osmolarGap} mOsm/kg, Fomepizole Indicated=${toxicAlcohol.fomepizoleIndicated}`);
    console.log(`  Fomepizole Loading Dose: ${toxicAlcohol.fomepizoleLoadingDoseMg} mg (15 mg/kg), Dialysis Indicated=${toxicAlcohol.hemodialysisIndicated}`);
    if (!toxicAlcohol.fomepizoleIndicated || toxicAlcohol.osmolarGap < 40) {
      throw new Error('Expected elevated osmolar gap with Fomepizole indication');
    }

    // 6. DigiFab Vial Calculator
    console.log('\n--- Test 6: DigiFab Vial Calculator ---');
    const digiKnown = calculateDigiFabDosing('KNOWN_INGESTION_AMOUNT', 10); // 10 mg * 0.8 / 0.5 = 16 vials
    console.log(`✓ Known Ingestion (10 mg Digoxin): ${digiKnown.vialsRecommended} vials (${digiKnown.mgFabTotal} mg Fab)`);
    if (digiKnown.vialsRecommended !== 16) throw new Error('Expected 16 vials for 10 mg ingestion');

    const digiSteady = calculateDigiFabDosing('STEADY_STATE_SERUM_LEVEL', undefined, 5.0, 80); // (5 * 80) / 100 = 4 vials
    console.log(`✓ Steady State (5 ng/mL, 80 kg): ${digiSteady.vialsRecommended} vials`);
    if (digiSteady.vialsRecommended !== 4) throw new Error('Expected 4 vials for steady-state level');

    const digiArrest = calculateDigiFabDosing('EMPIRIC_ARREST');
    console.log(`✓ Empiric Arrest: ${digiArrest.vialsRecommended} vials`);
    if (digiArrest.vialsRecommended !== 10) throw new Error('Expected 10 vials for empiric arrest');

    // 7. Database Persistence Tests
    console.log('\n--- Test 7: Database Persistence & Queries ---');
    let patientId = 1;
    const patRes = await pool.query(`SELECT id FROM patients LIMIT 1`);
    if (patRes.rows.length > 0) {
      patientId = patRes.rows[0].id;
    } else {
      const newPat = await pool.query(
        `INSERT INTO patients (first_name, last_name, date_of_birth, gender) VALUES ('Tox', 'Patient', '1990-05-15', 'Female') RETURNING id`
      );
      patientId = newPat.rows[0].id;
    }

    const toxCase = await createToxicologyCase({
      patientId,
      substanceName: 'Acetaminophen Extra Strength (500mg x 40 tabs)',
      ingestionCategory: 'ACETAMINOPHEN',
      ingestionTimeHoursAgo: 4.5,
      amountIngestedMgOrUnits: 20000,
      patientWeightKg: 68,
      serumLevel: 185,
      serumLevelUnit: 'mcg/mL',
      toxidromeIdentified: 'Undifferentiated',
      recommendedAntidote: 'N-Acetylcysteine (IV 21-Hour Regimen)',
      antidoteDosingPlan: apapToxic.nacIvRegimen21Hour,
      hemodialysisIndicated: false
    });
    console.log(`✓ Created Toxicology Ingestion Case: ID=${toxCase.id}, Case#=${toxCase.poison_control_case_number}`);

    const antidoteAdmin = await recordAntidoteAdministration({
      caseId: toxCase.id,
      antidoteName: 'N-Acetylcysteine (Loading Bag 1)',
      doseAdministered: 10200,
      doseUnit: 'mg',
      route: 'IV',
      administeredBy: 'PharmD Specialist / ICU Nurse',
      postAdminVitals: { bp: '120/78', hr: 82, spo2: 99 },
      notes: 'No anaphylactoid symptoms; infusion running via dedicated line at 200 mL/hr.'
    });
    console.log(`✓ Recorded Antidote Administration: ID=${antidoteAdmin.id}, Dose=${antidoteAdmin.dose_administered} ${antidoteAdmin.dose_unit}`);

    const caseDetails = await getToxicologyCaseDetails(toxCase.id);
    console.log(`✓ Retrieved Case Details: Found ${caseDetails.antidoteAdministrations.length} antidote administration(s)`);
    if (!caseDetails || caseDetails.antidoteAdministrations.length === 0) {
      throw new Error('Failed to retrieve case details with administrations');
    }

    const activeList = await listActiveToxicologyCases(5);
    console.log(`✓ Listed Active Cases: Found ${activeList.length} cases.`);
    if (activeList.length === 0) throw new Error('Active cases list is empty');

    console.log('\n🎉 ALL MEDICAL TOXICOLOGY & POISON CONTROL TESTS PASSED (100%)! 🎉\n');
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
