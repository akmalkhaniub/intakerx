import { query, pool } from './db';
import { BurnTraumaService } from './services/burnTrauma';

async function runBurnTraumaTest() {
  console.log('--- STARTING BURN & COMPLEX TRAUMA RESUSCITATION FLEET TEST (PHASE 55) ---');

  try {
    // 1. Create dummy patient
    const testEmail = `burn.patient.${Date.now()}@burncenter.org`;
    const patientRes = await query(
      `INSERT INTO patients (name, email, password_hash, dob, sex)
       VALUES ($1, $2, 'hash123', '1988-06-22', 'female')
       RETURNING id, name`,
      ['Elena Vance', testEmail]
    );
    const patientId = patientRes.rows[0].id;
    console.log(`✔ Created dummy Burn Trauma patient #${patientId} (${patientRes.rows[0].name})`);

    // 2. Test %TBSA Calculation (Rule of Nines & Lund-Browder)
    const tbsaEval = BurnTraumaService.calculateTbsa({
      headNeckPercent: 4.5,
      anteriorTorsoPercent: 18.0,
      posteriorTorsoPercent: 9.0,
      rightArmPercent: 9.0,
      leftArmPercent: 4.5,
      rightLegPercent: 0,
      leftLegPercent: 0,
      perineumPercent: 0,
      partialThicknessPercent: 25.0,
      fullThicknessPercent: 20.0
    });
    // Expected anatomical sum: 4.5 + 18 + 9 + 9 + 4.5 = 45%
    console.log(`✔ %TBSA Evaluated: Total = ${tbsaEval.totalTbsaPercentage}% | Severity: ${tbsaEval.burnSeverityCategory} | ABA Center Referral: ${tbsaEval.abaBurnCenterReferralCriteriaMet}`);
    console.log(`   Referral Rationale: ${tbsaEval.referralRationale.join('; ')}`);
    if (tbsaEval.totalTbsaPercentage !== 45 || tbsaEval.burnSeverityCategory !== 'Major_Severe' || !tbsaEval.abaBurnCenterReferralCriteriaMet) {
      throw new Error(`Unexpected TBSA evaluation output: ${JSON.stringify(tbsaEval)}`);
    }

    // 3. Test Consensus Parkland Resuscitation Calculation
    const now = new Date();
    const injuryTimestamp = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
    const edArrivalTimestamp = now;

    const resuscitation = BurnTraumaService.calculateFluidResuscitation({
      patientWeightKg: 70,
      tbsaPercentage: 45,
      injuryTimestamp,
      edArrivalTimestamp,
      formulaType: 'Parkland'
    });
    // 4 mL * 70 kg * 45% = 12,600 mL 24h total
    // First 8h total: 6,300 mL. Since 2h elapsed, remaining time = 6h.
    // First 8h rate: 6,300 / 6 = 1,050 mL/hr.
    // Next 16h total: 6,300 mL. Rate: 6,300 / 16 = 394 mL/hr.
    // Fluid creep threshold: 250 * 70 = 17,500 mL.
    console.log(`✔ Parkland Resuscitation: 24h Total = ${resuscitation.total24hVolumeMl} mL | First 8h Rate = ${resuscitation.first8hRateMlHr} mL/hr (over remaining ${resuscitation.remainingHoursFirst8h}h) | Next 16h Rate = ${resuscitation.next16hRateMlHr} mL/hr`);
    if (resuscitation.total24hVolumeMl !== 12600 || resuscitation.first8hRateMlHr !== 1050 || resuscitation.next16hRateMlHr !== 394) {
      throw new Error(`Unexpected Parkland calculation: ${JSON.stringify(resuscitation)}`);
    }

    // 4. Test Carboxyhemoglobin & Inhalation Injury Kinetics
    const inhalationEval = BurnTraumaService.evaluateInhalationAndCyanide({
      coHemoglobinPercent: 28.5,
      fio2DeliveredPercent: 100, // on 100% FiO2
      serumLactateMmolL: 9.4, // >= 8.0 indicates high cyanide risk
      facialBurns: true,
      carbonaceousSputum: true,
      stridorOrHoarseness: true,
      bronchoscopyGrade: 3
    });
    console.log(`✔ Inhalation Injury Evaluated: Half-life = ${inhalationEval.estimatedCoHbHalfLifeHours}h | Target Time: ${inhalationEval.hoursToTargetCoHb}h | Cyanide Risk: ${inhalationEval.cyanideToxicityRisk} | Airway Risk: ${inhalationEval.airwayCompromiseRisk}`);
    console.log(`   Hydroxocobalamin Indicated: ${inhalationEval.hydroxocobalaminIndicated}`);
    if (inhalationEval.cyanideToxicityRisk !== 'High_Critical' || !inhalationEval.hydroxocobalaminIndicated || inhalationEval.airwayCompromiseRisk !== 'Critical_Immediate_Intubation') {
      throw new Error(`Expected high critical cyanide and critical immediate intubation: ${JSON.stringify(inhalationEval)}`);
    }

    // 5. Test Closed-Loop Hourly Titration Logic
    // Patient weight: 70kg -> Target UOP 0.5-1.0 mL/kg/hr is 35-70 mL/hr
    // Sub-target scenario: 22 mL UOP -> 22 / 70 = 0.31 mL/kg/hr -> increase 20%
    const lowUopTitration = BurnTraumaService.evaluateHourlyTitration({
      postBurnHour: 3,
      urineOutputMl: 22,
      currentInfusionRateMlHr: 1050,
      patientWeightKg: 70,
      cumulativeFluidInfusedMl: 3150
    });
    console.log(`✔ Low UOP Titration: UOP = ${lowUopTitration.uopMlKgHr} mL/kg/hr | Recommendation: ${lowUopTitration.rateAdjustmentRecommendation} -> ${lowUopTitration.newRecommendedRateMlHr} mL/hr`);
    if (lowUopTitration.rateAdjustmentRecommendation !== 'increase_20_percent' || lowUopTitration.newRecommendedRateMlHr !== 1260) {
      throw new Error(`Expected 20% increase to 1260 mL/hr, got ${JSON.stringify(lowUopTitration)}`);
    }

    // High UOP scenario: 95 mL UOP -> 95 / 70 = 1.36 mL/kg/hr -> decrease 20%
    const highUopTitration = BurnTraumaService.evaluateHourlyTitration({
      postBurnHour: 4,
      urineOutputMl: 95,
      currentInfusionRateMlHr: 1260,
      patientWeightKg: 70,
      cumulativeFluidInfusedMl: 4410
    });
    console.log(`✔ High UOP Titration: UOP = ${highUopTitration.uopMlKgHr} mL/kg/hr | Recommendation: ${highUopTitration.rateAdjustmentRecommendation} -> ${highUopTitration.newRecommendedRateMlHr} mL/hr`);
    if (highUopTitration.rateAdjustmentRecommendation !== 'decrease_20_percent' || highUopTitration.newRecommendedRateMlHr !== 1008) {
      throw new Error(`Expected 20% decrease to 1008 mL/hr, got ${JSON.stringify(highUopTitration)}`);
    }

    // Fluid creep & Bladder pressure test
    const creepTitration = BurnTraumaService.evaluateHourlyTitration({
      postBurnHour: 18,
      urineOutputMl: 40,
      currentInfusionRateMlHr: 600,
      patientWeightKg: 70,
      cumulativeFluidInfusedMl: 18000, // 18000 / 70 = 257 mL/kg (>250)
      bladderPressureMmhg: 16.5 // IAH
    });
    console.log(`✔ Fluid Creep & IAH Watchdog: Fluid Creep Alert = ${creepTitration.fluidCreepAlert} | IAH Alert = ${creepTitration.intraAbdominalHypertensionAlert}`);
    if (!creepTitration.fluidCreepAlert || !creepTitration.intraAbdominalHypertensionAlert) {
      throw new Error(`Expected fluid creep and IAH alerts: ${JSON.stringify(creepTitration)}`);
    }

    // 6. Create Burn Trauma Case in Database
    const caseResult = await BurnTraumaService.createBurnCase(patientId, {
      injuryTimestamp,
      edArrivalTimestamp,
      patientWeightKg: 70,
      tbsaPercentage: 45,
      partialThicknessTbsa: 25,
      fullThicknessTbsa: 20,
      burnMechanism: 'flame',
      inhalationInjuryPresent: true,
      formulaType: 'Parkland',
      coHemoglobinPercent: 28.5,
      cyanideSuspected: true
    });
    const caseId = caseResult.burnCase.id;
    console.log(`✔ Created Burn Trauma Case #${caseId} (24h Target: ${caseResult.burnCase.calculated_24h_volume_ml} mL)`);

    // 7. Record Hourly Titration in Database
    const titrationResult = await BurnTraumaService.recordHourlyTitration(caseId, {
      postBurnHour: 1,
      urineOutputMl: 42,
      meanArterialPressureMmhg: 74,
      bladderPressureMmhg: 8.5,
      volumeInfusedThisHourMl: 1050,
      clinicalNotes: 'Adequate initial response to Parkland rate. Clear yellow urine.'
    });
    console.log(`✔ Recorded Titration Log #${titrationResult.titration.id}: UOP = ${titrationResult.titration.uop_ml_kg_hr} mL/kg/hr | Recommendation: ${titrationResult.titration.rate_adjustment_recommendation} | Cumulative: ${titrationResult.updatedCase.cumulative_fluid_infused_ml} mL`);

    // 8. Query Cases & Titrations
    const cases = await BurnTraumaService.getBurnCases(patientId);
    const titrations = await BurnTraumaService.getHourlyTitrations(caseId);
    console.log(`✔ Fetched ${cases.length} burn case(s) and ${titrations.length} titration entry/entries for patient #${patientId}`);

    console.log('\n--- ALL BURN & COMPLEX TRAUMA TESTS PASSED SUCCESSFULLY (PHASE 55) ---');
  } catch (error) {
    console.error('❌ Burn Trauma Test Failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runBurnTraumaTest();
