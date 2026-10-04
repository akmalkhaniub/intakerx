import { query, pool } from './db';
import { AirwayIntubationService } from './services/airwayIntubation';

async function runAirwayIntubationTest() {
  console.log('--- STARTING EMERGENCY AIRWAY & RSI COMMAND FLEET TEST (PHASE 57) ---');

  try {
    // 1. Create dummy patient
    const testEmail = `airway.patient.${Date.now()}@traumacenter.org`;
    const patientRes = await query(
      `INSERT INTO patients (name, email, password_hash, dob, sex)
       VALUES ($1, $2, 'hash123', '1975-08-19', 'male')
       RETURNING id, name`,
      ['Marcus Vance', testEmail]
    );
    const patientId = patientRes.rows[0].id;
    console.log(`✔ Created dummy patient #${patientId} (${patientRes.rows[0].name})`);

    // 2. Test LEMON Difficult Airway Score
    const lemonEval = AirwayIntubationService.calculateLemonScore({
      lookExternallyAbnormal: true, // +1 (beard/facial trauma)
      interIncisorGapLessThan3Fingers: true, // +1
      hyomentalDistanceLessThan3Fingers: false,
      thyrohyoidDistanceLessThan2Fingers: true, // +1
      mallampatiClass: 3, // +2
      airwayObstructionPresent: true, // +1 (stridor)
      neckMobilityLimited: true // +1 (C-spine collar)
    });
    // Expected score: 1 + 1 + 0 + 1 + 2 + 1 + 1 = 7 (High_Difficult_Airway)
    console.log(`✔ LEMON Evaluated: Score = ${lemonEval.score} (${lemonEval.difficultyTier})`);
    console.log(`   Equipment: ${lemonEval.recommendedEquipment.join('; ')}`);
    if (lemonEval.score !== 7 || lemonEval.difficultyTier !== 'High_Difficult_Airway') {
      throw new Error(`Expected LEMON score 7 and High_Difficult_Airway, got ${JSON.stringify(lemonEval)}`);
    }

    // 3. Test MACOCHA Score for Critically Ill ICU Intubation
    const macochaEval = AirwayIntubationService.calculateMacochaScore({
      mallampatiClass3or4: true, // +5
      obstructiveSleepApnea: true, // +2
      cervicalSpineLimitation: false,
      mouthOpeningLessThan3cm: false,
      comaGcsLessThan8: true, // +1
      severeHypoxemiaPfRatioUnder200: true, // +1
      operatorNonAnesthesiologist: true // +1
    });
    // Expected score: 5 + 2 + 1 + 1 + 1 = 10 (High_Risk)
    console.log(`✔ MACOCHA Evaluated: Score = ${macochaEval.score} (${macochaEval.riskTier}) | Difficulty: ${macochaEval.predictedDifficultyPercent}%`);
    console.log(`   Advisory: ${macochaEval.advisory}`);
    if (macochaEval.score !== 10 || macochaEval.riskTier !== 'High_Risk_Difficult_Intubation') {
      throw new Error(`Expected MACOCHA score 10, got ${JSON.stringify(macochaEval)}`);
    }

    // 4. Test RSI Pharmacology Calculator (Succinylcholine Contraindicated -> Rocuronium)
    const rsiMeds = AirwayIntubationService.calculateRsiMedications({
      patientWeightKg: 80,
      hemodynamicallyUnstableOrShock: false,
      severeBronchospasmOrAsthma: false,
      elevatedIcpOrAorticDissection: true,
      succinylcholineContraindicated: true, // e.g. severe burn >24h / K+ 6.1
      preferredInduction: 'Etomidate'
    });
    // Etomidate: 0.3 * 80 = 24.0 mg
    // Rocuronium: 1.2 * 80 = 96.0 mg
    // Sugammadex rescue: 16 * 80 = 1280 mg
    // Pretreatment Fentanyl: 2 * 80 = 160 mcg
    console.log(`✔ RSI Regimen: Induction = ${rsiMeds.selectedInductionAgent} (${rsiMeds.inductionDoseMg} mg) | Paralytic = ${rsiMeds.selectedParalyticAgent} (${rsiMeds.paralyticDoseMg} mg)`);
    console.log(`   Sugammadex Emergency Reversal Dose: ${rsiMeds.sugammadexImmediateRescueDoseMg} mg (16 mg/kg)`);
    console.log(`   Pretreatment: ${rsiMeds.pretreatmentFentanylDoseMcg} mcg Fentanyl`);
    if (rsiMeds.inductionDoseMg !== 24.0 || rsiMeds.paralyticDoseMg !== 96.0 || rsiMeds.sugammadexImmediateRescueDoseMg !== 1280) {
      throw new Error(`Unexpected RSI dosing calculation: ${JSON.stringify(rsiMeds)}`);
    }

    // 5. Test Airway Attempt Outcome & CICO Emergency Trigger
    const cicoAttempt = AirwayIntubationService.evaluateAirwayAttempt({
      attemptsCount: 3,
      cormackLehaneGrade: 4,
      lowestSpo2Percent: 72,
      supraglotticAirwayPlaced: true,
      supraglotticVentilationSuccessful: false
    });
    console.log(`✔ Airway Attempt Outcome: CICO Triggered = ${cicoAttempt.cicoEmergencyTriggered} | Step: ${cicoAttempt.protocolStep}`);
    console.log(`   Directive: ${cicoAttempt.urgentActionDirective}`);
    if (!cicoAttempt.cicoEmergencyTriggered || !cicoAttempt.urgentActionDirective.includes('cricothyroidotomy')) {
      throw new Error(`Expected CICO emergency and cricothyroidotomy directive: ${JSON.stringify(cicoAttempt)}`);
    }

    // 6. Database Integration: Record Airway Intubation Event
    const event = await AirwayIntubationService.createIntubationEvent(patientId, {
      indication: 'airway_protection',
      patientWeightKg: 80,
      lemonScore: lemonEval.score,
      lemonDetails: lemonEval,
      macochaScore: macochaEval.score,
      deviceUsed: 'video_laryngoscope_hyperangulated',
      bladeSize: 'C-MAC D-Blade',
      bougieUsed: true,
      ettSizeMm: 8.0,
      ettDepthCm: 23.0,
      cormackLehaneGrade: 2,
      attemptsCount: 1,
      lowestSpo2Percent: 94,
      etco2Confirmed: true,
      cicoEmergencyTriggered: false,
      surgicalAirwayPerformed: false,
      intubationStatus: 'successful',
      operatorName: 'Dr. Sarah Connor, MD'
    });
    console.log(`✔ Recorded Airway Intubation Event #${event.id} (${event.device_used}, ETT ${event.ett_size_mm}mm @ ${event.ett_depth_cm}cm)`);

    // 7. Database Integration: Record RSI Medications
    const rsiAdmin = await AirwayIntubationService.recordRsiMedications(event.id, {
      inductionAgent: rsiMeds.selectedInductionAgent,
      inductionDoseMg: rsiMeds.inductionDoseMg,
      paralyticAgent: rsiMeds.selectedParalyticAgent,
      paralyticDoseMg: rsiMeds.paralyticDoseMg,
      sugammadexAdministered: false,
      succinylcholineContraindicationChecked: true
    });
    console.log(`✔ Recorded RSI Medications #${rsiAdmin.id}: ${rsiAdmin.induction_agent} ${rsiAdmin.induction_dose_mg}mg + ${rsiAdmin.paralytic_agent} ${rsiAdmin.paralytic_dose_mg}mg`);

    // 8. Query Intubation Events
    const events = await AirwayIntubationService.getIntubationEvents(patientId);
    console.log(`✔ Fetched ${events.length} intubation event(s) for patient #${patientId}`);

    console.log('\n--- ALL EMERGENCY AIRWAY & RSI TESTS PASSED SUCCESSFULLY (PHASE 57) ---');
  } catch (error) {
    console.error('❌ Airway Intubation Test Failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runAirwayIntubationTest();
