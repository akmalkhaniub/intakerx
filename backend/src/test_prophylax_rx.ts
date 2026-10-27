import {
  generateOpportunisticProphylaxisPlan,
  interpretViralLoadSurveillance,
  saveProphylaxisPlan,
  getPatientProphylaxisPlans,
  saveViralLoadRecord,
  getPatientViralLoadHistory
} from './services/prophylaxRx';
import { pool } from './db';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('\n=== RUNNING PROPHYLAX-RX TEST SUITE (PHASE 87) ===\n');

  try {
    // ----------------------------------------------------
    // TEST SUITE 1: CMV RISK STRATIFICATION & DURATION
    // ----------------------------------------------------
    console.log('--- 1. CMV Serostatus Risk Stratification ---');

    // Case 1: D+/R- High Risk Heart
    const highRiskHeart = generateOpportunisticProphylaxisPlan({
      transplantId: 1,
      patientId: 1,
      organType: 'HEART',
      cmvDonorStatus: 'POSITIVE',
      cmvRecipientStatus: 'NEGATIVE',
      ebvDonorStatus: 'POSITIVE',
      ebvRecipientStatus: 'NEGATIVE',
      crClMlMin: 85,
      sulfaAllergy: false
    });
    assert(highRiskHeart.cmvDrStatus === 'D_POS_R_NEG', 'CMV Serostatus is D_POS_R_NEG');
    assert(highRiskHeart.cmvRiskLevel === 'HIGH', 'CMV Risk Level is HIGH');
    assert(highRiskHeart.valganciclovirDurationMonths === 6, 'Heart transplant high-risk duration is 6 months');
    assert(highRiskHeart.valganciclovirDosing.includes('900 mg PO once daily'), 'Dosing is 900 mg PO daily for CrCl >= 60');

    // Case 2: D+/R- High Risk Lung
    const highRiskLung = generateOpportunisticProphylaxisPlan({
      transplantId: 1,
      patientId: 1,
      organType: 'LUNG',
      cmvDonorStatus: 'POSITIVE',
      cmvRecipientStatus: 'NEGATIVE',
      ebvDonorStatus: 'POSITIVE',
      ebvRecipientStatus: 'POSITIVE',
      crClMlMin: 70,
      sulfaAllergy: false
    });
    assert(highRiskLung.valganciclovirDurationMonths === 12, 'Lung transplant high-risk duration is 12 months');
    assert(highRiskLung.fungalRegimen.includes('Voriconazole'), 'Lung transplant triggers mold-active Voriconazole');
    assert(highRiskLung.fungalRegimen.includes('CYP3A4'), 'Includes CNI dose reduction warning');

    // Case 3: R+ Intermediate Risk
    const intermediateRisk = generateOpportunisticProphylaxisPlan({
      transplantId: 1,
      patientId: 1,
      organType: 'HEART',
      cmvDonorStatus: 'NEGATIVE',
      cmvRecipientStatus: 'POSITIVE',
      ebvDonorStatus: 'NEGATIVE',
      ebvRecipientStatus: 'POSITIVE',
      crClMlMin: 90,
      sulfaAllergy: false
    });
    assert(intermediateRisk.cmvRiskLevel === 'INTERMEDIATE', 'D-/R+ is INTERMEDIATE risk');
    assert(intermediateRisk.valganciclovirDurationMonths === 3, 'Intermediate risk duration is 3 months');

    // Case 4: D-/R- Low Risk
    const lowRisk = generateOpportunisticProphylaxisPlan({
      transplantId: 1,
      patientId: 1,
      organType: 'HEART',
      cmvDonorStatus: 'NEGATIVE',
      cmvRecipientStatus: 'NEGATIVE',
      ebvDonorStatus: 'NEGATIVE',
      ebvRecipientStatus: 'NEGATIVE',
      crClMlMin: 80,
      sulfaAllergy: false
    });
    assert(lowRisk.cmvRiskLevel === 'LOW', 'D-/R- is LOW risk');
    assert(lowRisk.valganciclovirDosing.includes('No Valganciclovir indicated'), 'Valganciclovir spared; Acyclovir/Valacyclovir substituted');

    // ----------------------------------------------------
    // TEST SUITE 2: RENAL-ADJUSTED VALGANCICLOVIR DOSING
    // ----------------------------------------------------
    console.log('\n--- 2. Renal-Adjusted Valganciclovir Dosing ---');

    // CrCl 50 mL/min
    const renalTier1 = generateOpportunisticProphylaxisPlan({
      transplantId: 1,
      patientId: 1,
      organType: 'HEART',
      cmvDonorStatus: 'POSITIVE',
      cmvRecipientStatus: 'NEGATIVE',
      ebvDonorStatus: 'POSITIVE',
      ebvRecipientStatus: 'POSITIVE',
      crClMlMin: 50,
      sulfaAllergy: false
    });
    assert(renalTier1.valganciclovirDosing.includes('450 mg PO once daily'), 'CrCl 50 mL/min receives 450 mg daily');

    // CrCl 32 mL/min
    const renalTier2 = generateOpportunisticProphylaxisPlan({
      transplantId: 1,
      patientId: 1,
      organType: 'HEART',
      cmvDonorStatus: 'POSITIVE',
      cmvRecipientStatus: 'NEGATIVE',
      ebvDonorStatus: 'POSITIVE',
      ebvRecipientStatus: 'POSITIVE',
      crClMlMin: 32,
      sulfaAllergy: false
    });
    assert(renalTier2.valganciclovirDosing.includes('every 48 hours'), 'CrCl 32 mL/min receives 450 mg Q48H');

    // CrCl 18 mL/min
    const renalTier3 = generateOpportunisticProphylaxisPlan({
      transplantId: 1,
      patientId: 1,
      organType: 'HEART',
      cmvDonorStatus: 'POSITIVE',
      cmvRecipientStatus: 'NEGATIVE',
      ebvDonorStatus: 'POSITIVE',
      ebvRecipientStatus: 'POSITIVE',
      crClMlMin: 18,
      sulfaAllergy: false
    });
    assert(renalTier3.valganciclovirDosing.includes('twice weekly'), 'CrCl 18 mL/min receives 450 mg twice weekly');

    // CrCl 8 mL/min
    const renalTier4 = generateOpportunisticProphylaxisPlan({
      transplantId: 1,
      patientId: 1,
      organType: 'HEART',
      cmvDonorStatus: 'POSITIVE',
      cmvRecipientStatus: 'NEGATIVE',
      ebvDonorStatus: 'POSITIVE',
      ebvRecipientStatus: 'POSITIVE',
      crClMlMin: 8,
      sulfaAllergy: false
    });
    assert(renalTier4.valganciclovirDosing.includes('not recommended'), 'CrCl < 10 mL/min triggers dialysis consult / preemptive surveillance');

    // ----------------------------------------------------
    // TEST SUITE 3: CYTOPENIA GUARD & DRUG ALLERGIES
    // ----------------------------------------------------
    console.log('\n--- 3. Cytopenia Sentinel & Allergy Handling ---');

    // Neutropenia
    const neutropeniaCase = generateOpportunisticProphylaxisPlan({
      transplantId: 1,
      patientId: 1,
      organType: 'HEART',
      cmvDonorStatus: 'POSITIVE',
      cmvRecipientStatus: 'NEGATIVE',
      ebvDonorStatus: 'POSITIVE',
      ebvRecipientStatus: 'POSITIVE',
      crClMlMin: 75,
      ancCellsPerUl: 620,
      plateletsPerUl: 180000,
      sulfaAllergy: false
    });
    assert(neutropeniaCase.cytopeniaAlert.alert === true, 'Cytopenia alert triggered');
    assert(neutropeniaCase.cytopeniaAlert.neutropenia === true, 'Flags NEUTROPENIA (ANC < 1000)');
    assert(neutropeniaCase.cytopeniaAlert.guidance.includes('Filgrastim'), 'Recommends Filgrastim (G-CSF)');

    // Severe Bicytopenia
    const bicytopeniaCase = generateOpportunisticProphylaxisPlan({
      transplantId: 1,
      patientId: 1,
      organType: 'HEART',
      cmvDonorStatus: 'POSITIVE',
      cmvRecipientStatus: 'NEGATIVE',
      ebvDonorStatus: 'POSITIVE',
      ebvRecipientStatus: 'POSITIVE',
      crClMlMin: 75,
      ancCellsPerUl: 450,
      plateletsPerUl: 32000,
      sulfaAllergy: false
    });
    assert(bicytopeniaCase.cytopeniaAlert.guidance.includes('Hold Valganciclovir immediately'), 'Advises immediate drug hold for bicytopenia');

    // Sulfa Allergy -> Atovaquone
    const sulfaAllergyCase = generateOpportunisticProphylaxisPlan({
      transplantId: 1,
      patientId: 1,
      organType: 'HEART',
      cmvDonorStatus: 'POSITIVE',
      cmvRecipientStatus: 'NEGATIVE',
      ebvDonorStatus: 'POSITIVE',
      ebvRecipientStatus: 'POSITIVE',
      crClMlMin: 80,
      sulfaAllergy: true,
      g6pdDeficiency: false
    });
    assert(sulfaAllergyCase.pcpRegimen.includes('Atovaquone 1500 mg'), 'Sulfa allergy routes to Atovaquone 1500mg');

    // G6PD Deficiency -> No Dapsone
    const g6pdCase = generateOpportunisticProphylaxisPlan({
      transplantId: 1,
      patientId: 1,
      organType: 'HEART',
      cmvDonorStatus: 'POSITIVE',
      cmvRecipientStatus: 'NEGATIVE',
      ebvDonorStatus: 'POSITIVE',
      ebvRecipientStatus: 'POSITIVE',
      crClMlMin: 80,
      sulfaAllergy: true,
      g6pdDeficiency: true
    });
    assert(g6pdCase.pcpRegimen.includes('strictly contraindicated'), 'Dapsone strictly contraindicated in G6PD deficiency');

    // ----------------------------------------------------
    // TEST SUITE 4: VIRAL LOAD SURVEILLANCE INTERPRETATION
    // ----------------------------------------------------
    console.log('\n--- 4. Viral Load Quantitative Surveillance ---');

    // CMV Undetectable
    const cmvNeg = interpretViralLoadSurveillance({
      transplantId: 1,
      patientId: 1,
      virusType: 'CMV',
      copiesPerMl: 80,
      onProphylaxis: true
    });
    assert(cmvNeg.interpretation === 'UNDETECTABLE_OR_TRACE', 'CMV 80 copies is UNDETECTABLE_OR_TRACE');

    // CMV Moderate
    const cmvMod = interpretViralLoadSurveillance({
      transplantId: 1,
      patientId: 1,
      virusType: 'CMV',
      copiesPerMl: 2600,
      onProphylaxis: true
    });
    assert(cmvMod.interpretation === 'MODERATE_DNAEMIA', 'CMV 2600 copies is MODERATE_DNAEMIA');
    assert(cmvMod.clinicalAction.includes('TREATMENT DOSING'), 'Prompts transition to treatment dosing Valganciclovir BID');

    // CMV High Burden with Kinetics
    const cmvHigh = interpretViralLoadSurveillance({
      transplantId: 1,
      patientId: 1,
      virusType: 'CMV',
      copiesPerMl: 12000,
      previousCopiesPerMl: 2500,
      onProphylaxis: false
    });
    assert(cmvHigh.interpretation === 'HIGH_BURDEN_INFECTION', 'CMV 12000 copies is HIGH_BURDEN_INFECTION');
    assert(cmvHigh.viralKinetics.includes('RAPID VIRAL KINETICS'), 'Detects 4.8x rapid viral kinetics');
    assert(cmvHigh.clinicalAction.includes('IV Ganciclovir'), 'Prescribes IV Ganciclovir 5 mg/kg Q12H');

    // EBV High Burden (PTLD Risk)
    const ebvHigh = interpretViralLoadSurveillance({
      transplantId: 1,
      patientId: 1,
      virusType: 'EBV',
      copiesPerMl: 34000
    });
    assert(ebvHigh.interpretation === 'CRITICAL_HIGH_DNAEMIA', 'EBV 34000 copies is CRITICAL_HIGH_DNAEMIA');
    assert(ebvHigh.clinicalAction.includes('PTLD'), 'Flags severe PTLD risk');
    assert(ebvHigh.immunosuppressionAdjustment.includes('Stop Mycophenolate'), 'Recommends stopping antimetabolite and halving CNI');

    // ----------------------------------------------------
    // TEST SUITE 5: DATABASE PERSISTENCE & HISTORY
    // ----------------------------------------------------
    console.log('\n--- 5. Database Persistence & History ---');

    const pRes = await pool.query('SELECT id FROM patients LIMIT 1');
    let testPatientId = 1;
    if (pRes.rows.length > 0) testPatientId = pRes.rows[0].id;

    const savedPlan = await saveProphylaxisPlan({
      transplantId: 1,
      patientId: testPatientId,
      ...highRiskHeart
    });
    assert(savedPlan && savedPlan.id > 0, `Prophylaxis plan saved with ID ${savedPlan?.id}`);

    const retrievedPlans = await getPatientProphylaxisPlans(testPatientId);
    assert(retrievedPlans.length > 0, `Retrieved ${retrievedPlans.length} prophylaxis plans`);

    const savedViral = await saveViralLoadRecord({
      transplantId: 1,
      patientId: testPatientId,
      ...cmvHigh
    });
    assert(savedViral && savedViral.id > 0, `Viral load surveillance record saved with ID ${savedViral?.id}`);

    const retrievedViral = await getPatientViralLoadHistory(testPatientId, 'CMV');
    assert(retrievedViral.length > 0, `Retrieved ${retrievedViral.length} CMV viral load records`);

    console.log(`\n========================================`);
    console.log(`PROPHYLAX-RX TEST SUMMARY:`);
    console.log(`  TOTAL PASSED: ${passedTests}`);
    console.log(`  TOTAL FAILED: ${failedTests}`);
    console.log(`========================================\n`);

    if (failedTests > 0) process.exit(1);
    else process.exit(0);
  } catch (err) {
    console.error('Fatal error during PROPHYLAX-RX test execution:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
