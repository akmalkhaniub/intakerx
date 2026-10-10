import { pool } from './db';
import { HyperbaricMedicineService } from './services/hyperbaricMedicine';

async function runHyperbaricMedicineTests() {
  console.log('====================================================');
  console.log('🧪 Starting Phase 64: HBOT-SAFE Hyperbaric Medicine Tests');
  console.log('====================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Carbon Monoxide Clearance Kinetics
    console.log('\n--- 1. Carbon Monoxide Elimination Kinetics ---');
    // Room air
    const roomAirCO = HyperbaricMedicineService.calculateCOElimination(30.0, 160, 0.21, 1.0);
    console.log(`Room Air CO t1/2: ${roomAirCO.halfLifeMinutes}m, Projected at 160m: ${roomAirCO.projectedCurrentCohbPercent}%`);
    assert(roomAirCO.halfLifeMinutes === 320, 'Room air half-life is 320 minutes');
    assert(roomAirCO.projectedCurrentCohbPercent > 20.0, 'Slow clearance on room air');

    // 100% O2 NRB
    const nrbCO = HyperbaricMedicineService.calculateCOElimination(30.0, 80, 1.0, 1.0);
    console.log(`NRB 100% O2 t1/2: ${nrbCO.halfLifeMinutes}m, Projected at 80m: ${nrbCO.projectedCurrentCohbPercent}%`);
    assert(nrbCO.halfLifeMinutes === 80, 'Normobaric 100% O2 half-life is 80 minutes');
    assert(Math.abs(nrbCO.projectedCurrentCohbPercent - 15.0) <= 0.5, 'Reduced by 50% after one 80m half-life (~15%)');

    // Hyperbaric O2 (2.8 ATA)
    const hbotCO = HyperbaricMedicineService.calculateCOElimination(35.0, 40, 1.0, 2.8, true, false, false, true);
    console.log(`Hyperbaric 2.8 ATA t1/2: ${hbotCO.halfLifeMinutes}m, Projected at 40m: ${hbotCO.projectedCurrentCohbPercent}%`);
    assert(hbotCO.halfLifeMinutes <= 25, 'Hyperbaric half-life reduced to <= 25 minutes');
    assert(hbotCO.uhmsEmergentHbotIndicated === true, 'UHMS emergent HBOT criteria met (COHb >25%, syncope, neuro deficit)');
    assert(hbotCO.indicationCriteriaMet.length >= 2, 'Multiple UHMS clinical indications cataloged');

    // Pregnancy indication threshold (>15%)
    const pregnantCO = HyperbaricMedicineService.calculateCOElimination(18.0, 0, 1.0, 1.0, false, false, true, false);
    assert(pregnantCO.uhmsEmergentHbotIndicated === true, 'Pregnancy with COHb 18% (>15% threshold) triggers HBOT indication');

    // 2. US Navy Treatment Table Selection
    console.log('\n--- 2. Treatment Table Selection ---');
    // DCS Type I (pain only)
    const tt5 = HyperbaricMedicineService.selectTreatmentTable('DCS_TYPE_I', false);
    console.log(`DCS Type I Table: ${tt5.treatmentTable} (${tt5.maxDepthFsw} fsw)`);
    assert(tt5.treatmentTable.includes('Table 5'), 'US Navy Table 5 selected for DCS Type I');
    assert(tt5.maxDepthFsw === 60, 'Table 5 max depth is 60 fsw (2.8 ATA)');

    // DCS Type II / Arterial Gas Embolism
    const tt6 = HyperbaricMedicineService.selectTreatmentTable('ARTERIAL_GAS_EMBOLISM', false);
    console.log(`AGE Table: ${tt6.treatmentTable} (${tt6.totalDurationMinutes} mins)`);
    assert(tt6.treatmentTable.includes('Table 6'), 'US Navy Table 6 selected for Arterial Gas Embolism');
    assert(tt6.totalDurationMinutes >= 285, 'Table 6 duration >= 285 minutes');

    // Severe / Deep Embolism
    const tt6a = HyperbaricMedicineService.selectTreatmentTable('ARTERIAL_GAS_EMBOLISM_DEEP', true);
    console.log(`Deep AGE Table: ${tt6a.treatmentTable} (${tt6a.maxDepthFsw} fsw)`);
    assert(tt6a.treatmentTable.includes('Table 6A'), 'US Navy Table 6A selected for deep air compression');
    assert(tt6a.maxDepthFsw === 165, 'Table 6A deep compression to 165 fsw (6.0 ATA)');

    // 3. Oxygen Toxicity Watchdogs (UPTD & CNS)
    console.log('\n--- 3. Oxygen Toxicity Watchdog ---');
    // UPTD Calculation
    const toxicityAssessment = HyperbaricMedicineService.calculateOxygenToxicity(
      [
        { po2Ata: 2.8, durationMinutes: 60 },
        { po2Ata: 1.9, durationMinutes: 90 }
      ],
      ['visual_tunneling', 'tinnitus']
    );
    console.log(`Cumulative UPTD: ${toxicityAssessment.cumulativeUptd}, Daily Ceiling Exceeded: ${toxicityAssessment.dailyUptdCeilingExceeded}`);
    assert(toxicityAssessment.cumulativeUptd > 200, 'Cumulative UPTD calculated accurately');
    assert(toxicityAssessment.cnsProdromeDetected === true, 'CNS prodromal VENTID symptoms detected');
    assert(toxicityAssessment.cnsToxicityRisk === 'moderate', 'CNS toxicity risk flagged as moderate');

    // Imminent Convulsion (Facial twitching)
    const convulsionWatchdog = HyperbaricMedicineService.calculateOxygenToxicity(
      [{ po2Ata: 2.8, durationMinutes: 45 }],
      ['lip_twitching', 'facial_fasciculations']
    );
    console.log(`Convulsion risk: ${convulsionWatchdog.cnsToxicityRisk}`);
    assert(convulsionWatchdog.cnsToxicityRisk === 'imminent_convulsion', 'Imminent convulsion flagged for facial twitching');
    assert(convulsionWatchdog.mandatoryEmergencyActions.some(a => a.includes('DO NOT ASCEND')), 'Strict prohibition against ascent during active seizure included');

    // 4. Database Persistence Verification
    console.log('\n--- 4. Database Persistence Verification ---');
    let testPatientId = 1;
    const patientCheck = await pool.query(`SELECT id FROM patients LIMIT 1`);
    if (patientCheck.rows.length > 0) {
      testPatientId = patientCheck.rows[0].id;
    } else {
      const newPatient = await pool.query(
        `INSERT INTO patients (name, date_of_birth, gender) VALUES ('Diver Patient', '1992-08-14', 'MALE') RETURNING id`
      );
      testPatientId = newPatient.rows[0].id;
    }

    // Create Session
    const session = await HyperbaricMedicineService.createSession({
      patientId: testPatientId,
      indication: 'ARTERIAL_GAS_EMBOLISM',
      treatmentTable: 'US_NAVY_TT6',
      chamberType: 'multiplace',
      maxDepthFsw: 60,
      pressureAta: 2.80,
      totalDurationMinutes: 285,
      airBreaksCount: 3,
      initialCohbPercent: null as any,
      finalCohbPercent: null as any,
      sessionStatus: 'completed'
    });
    assert(session && session.id > 0, 'Hyperbaric treatment session persisted');

    const sessions = await HyperbaricMedicineService.listSessionsByPatient(testPatientId);
    assert(sessions.length > 0, 'Retrieved stored HBOT sessions by patient ID');

    // Log Toxicity Event
    const toxLog = await HyperbaricMedicineService.logToxicityEvent({
      sessionId: session.id,
      cumulativeUptd: 285.5,
      cnsSymptomsObserved: ['visual_tunneling', 'perioral_numbness'],
      airBreakInstituted: true,
      chamberAscentInitiated: false,
      notes: '15-minute chamber air break provided. Symptoms resolved.'
    });
    assert(toxLog && toxLog.id > 0, 'Toxicity watchdog event persisted');

    const logs = await HyperbaricMedicineService.getToxicityLogsBySession(session.id);
    assert(logs.length > 0, 'Retrieved toxicity logs by session ID');

    console.log('\n====================================================');
    console.log(`📊 Phase 64 Test Results: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Unhandled test failure:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runHyperbaricMedicineTests();
