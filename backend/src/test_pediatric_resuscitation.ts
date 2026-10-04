import { query, pool } from './db';
import { PediatricResuscitationService } from './services/pediatricResuscitation';

async function runPediatricResuscitationTest() {
  console.log('--- STARTING PICU & NEONATAL RESUSCITATION PROGRAM FLEET TEST (PHASE 56) ---');

  try {
    // 1. Create dummy neonatal/pediatric patient
    const testEmail = `pediatric.patient.${Date.now()}@childrenshospital.org`;
    const patientRes = await query(
      `INSERT INTO patients (name, email, password_hash, dob, sex)
       VALUES ($1, $2, 'hash123', '2026-10-04', 'male')
       RETURNING id, name`,
      ['Baby Boy Miller', testEmail]
    );
    const patientId = patientRes.rows[0].id;
    console.log(`✔ Created dummy patient #${patientId} (${patientRes.rows[0].name})`);

    // 2. Test APGAR Score Calculation
    const apgar1min = PediatricResuscitationService.calculateApgar({
      heartRate: 1, // < 100 bpm
      respiratoryEffort: 0, // absent/apneic
      muscleTone: 1, // some flexion
      reflexIrritability: 0, // no response
      color: 1 // acrocyanosis
    });
    // Expected: 1 + 0 + 1 + 0 + 1 = 3 (Severely_Depressed_Critical)
    console.log(`✔ 1-Min APGAR: Score = ${apgar1min.totalScore} (${apgar1min.clinicalCategory})`);
    if (apgar1min.totalScore !== 3 || apgar1min.clinicalCategory !== 'Severely_Depressed_Critical') {
      throw new Error(`Expected APGAR score 3 and critical category, got ${JSON.stringify(apgar1min)}`);
    }

    const apgar5min = PediatricResuscitationService.calculateApgar({
      heartRate: 2, // >= 100 bpm
      respiratoryEffort: 2, // good cry
      muscleTone: 2, // active motion
      reflexIrritability: 1, // grimace
      color: 1 // acrocyanosis
    });
    // Expected: 2 + 2 + 2 + 1 + 1 = 8 (Reassuring_Normal)
    console.log(`✔ 5-Min APGAR: Score = ${apgar5min.totalScore} (${apgar5min.clinicalCategory})`);
    if (apgar5min.totalScore !== 8 || apgar5min.clinicalCategory !== 'Reassuring_Normal') {
      throw new Error(`Expected APGAR score 8, got ${JSON.stringify(apgar5min)}`);
    }

    // 3. Test NRP Algorithm: Bradycardia HR < 60 with Epinephrine Dosing
    const nrpCritical = PediatricResuscitationService.evaluateNrpAlgorithm({
      gestationalAgeWeeks: 39,
      postnatalAgeMinutes: 2,
      heartRateBpm: 48,
      isBreathingOrCrying: false,
      preductalSpo2Percent: 54,
      muscleToneAdequate: false
    });
    console.log(`✔ NRP Algorithm Evaluated: Target SpO2 = ${nrpCritical.targetPreductalSpo2Range} | FiO2: ${nrpCritical.recommendedFiO2}%`);
    console.log(`   Interventions: ${nrpCritical.requiredInterventions.join('; ')}`);
    console.log(`   Epinephrine Dose: ${nrpCritical.epinephrineUvcDoseMg} mg (${nrpCritical.epinephrineUvcDoseMl} mL)`);
    if (!nrpCritical.epinephrineUvcDoseMg || nrpCritical.recommendedFiO2 !== 100) {
      throw new Error(`Expected 100% FiO2 and Epinephrine dose for HR 48, got ${JSON.stringify(nrpCritical)}`);
    }

    // 4. Test Broselow Tape & PALS Emergency Sizing
    // Patient: 36 months (3.0 yrs), 14 kg -> Yellow Zone
    const broselow = PediatricResuscitationService.calculateBroselowPals({
      patientAgeMonths: 36,
      patientWeightKg: 14.0
    });
    console.log(`✔ Broselow Calculated: Color = ${broselow.broselowColor} (${broselow.weightTierDescription})`);
    console.log(`   ETT Size: Uncuffed ${broselow.ettSizeUncuffedMm} mm / Cuffed ${broselow.ettSizeCuffedMm} mm (Depth: ${broselow.ettDepthLipCm} cm)`);
    console.log(`   Defibrillation: ${broselow.defibrillationJoules} J | Epinephrine: ${broselow.epinephrineDoseMg} mg | NS Bolus: ${broselow.normalSalineBolusMl} mL`);
    if (broselow.broselowColor !== 'Yellow' || broselow.defibrillationJoules !== 28 || broselow.normalSalineBolusMl !== 280) {
      throw new Error(`Expected Yellow zone, 28 J, 280 mL NS, got ${JSON.stringify(broselow)}`);
    }

    // 5. Test Bhutani Nomogram for Neonatal Hyperbilirubinemia
    const bhutaniEval = PediatricResuscitationService.evaluateBhutaniNomogram({
      postnatalAgeHours: 48,
      totalSerumBilirubinMgDl: 14.5,
      gestationalAgeWeeks: 38
    });
    console.log(`✔ Bhutani Nomogram: TSB = 14.5 mg/dL @ 48h -> Zone = ${bhutaniEval.riskZone} (${bhutaniEval.percentileEst}) | Phototherapy: ${bhutaniEval.phototherapyIndicated}`);
    if (bhutaniEval.riskZone !== 'High_Critical_Risk' || !bhutaniEval.phototherapyIndicated) {
      throw new Error(`Expected High_Critical_Risk and phototherapy=true, got ${JSON.stringify(bhutaniEval)}`);
    }

    // 6. Test PELOD-2 Organ Dysfunction Score
    const pelod = PediatricResuscitationService.calculatePelod2({
      pupillaryReaction: 'both_fixed', // 5 pts
      lactateMmolL: 12.0, // 4 pts
      creatinineUmolL: 105, // 2 pts
      pao2Fio2Ratio: 140, // 3 pts
      plateletsK: 30, // 2 pts
      invasiveVentilation: true
    });
    console.log(`✔ PELOD-2 Score: ${pelod.pelod2Score} pts | Predicted Mortality: ${pelod.predictedInHospitalMortalityPercent}%`);
    console.log(`   Organ Failures: ${pelod.organFailuresIdentified.join('; ')}`);
    if (pelod.pelod2Score < 10) {
      throw new Error(`Expected high PELOD-2 score, got ${pelod.pelod2Score}`);
    }

    // 7. Database Integration: Record Neonatal Resuscitation Event
    const neoEvent = await PediatricResuscitationService.createNeonatalEvent(patientId, {
      birthTimestamp: new Date(),
      gestationalAgeWeeks: 39.0,
      birthWeightGrams: 3250,
      apgar1min: apgar1min.totalScore,
      apgar5min: apgar5min.totalScore,
      apgarDetails: { 1: apgar1min, 5: apgar5min },
      ppvRequired: true,
      intubationRequired: false,
      chestCompressionsRequired: false,
      epinephrineAdministered: false,
      serumBilirubinMgDl: 14.5,
      postnatalAgeHours: 48,
      phototherapyIndicated: true
    });
    console.log(`✔ Recorded Neonatal Resuscitation Event #${neoEvent.id} (APGAR 1m=${neoEvent.apgar_1min}, 5m=${neoEvent.apgar_5min})`);

    // 8. Database Integration: Record Pediatric Code Case
    const codeResult = await PediatricResuscitationService.createPediatricCode(patientId, {
      patientAgeMonths: 36,
      patientWeightKg: 14.0,
      clinicalNotes: 'Severe asthma exacerbation with status asthmaticus and impending respiratory failure.'
    });
    console.log(`✔ Recorded Pediatric Code Case #${codeResult.codeCase.id} (${codeResult.broselow.broselowColor} Zone: ETT ${codeResult.broselow.ettSizeCuffedMm}mm)`);

    // 9. Query Patient Events
    const events = await PediatricResuscitationService.getNeonatalEvents(patientId);
    const codes = await PediatricResuscitationService.getPediatricCodes(patientId);
    console.log(`✔ Fetched ${events.length} neonatal event(s) and ${codes.length} pediatric code case(s) for patient #${patientId}`);

    console.log('\n--- ALL PICU & NEONATAL RESUSCITATION TESTS PASSED SUCCESSFULLY (PHASE 56) ---');
  } catch (error) {
    console.error('❌ Pediatric Resuscitation Test Failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runPediatricResuscitationTest();
