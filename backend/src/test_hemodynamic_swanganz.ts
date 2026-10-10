import { pool } from './db';
import { HemodynamicSwanGanzService } from './services/hemodynamicSwanGanz';

async function runHemodynamicSwanGanzTests() {
  console.log('====================================================');
  console.log('🧪 Starting Phase 61: HEMO-SWAN Swan-Ganz Tests');
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
    // 1. BSA Calculation Test
    console.log('\n--- 1. DuBois BSA Calculation ---');
    const bsa = HemodynamicSwanGanzService.calculateBSA(175, 70);
    console.log(`Calculated BSA for 175cm, 70kg: ${bsa} m2`);
    assert(bsa >= 1.83 && bsa <= 1.87, 'DuBois BSA calculation within expected range (~1.85 m2)');

    // 2. Normal / Warm & Dry Profile Test
    console.log('\n--- 2. Normal / Warm & Dry Profile ---');
    const normalInput = {
      patientId: 1,
      heartRate: 72,
      systolicBp: 120,
      diastolicBp: 80,
      mapMmhg: 93,
      cvpMmhg: 6,
      mpapMmhg: 15,
      pcwpMmhg: 10,
      cardiacOutputLMin: 5.2,
      heightCm: 175,
      weightKg: 70,
      sao2Percent: 99,
      svo2Percent: 72,
      hgbGDl: 14.0
    };
    const normalProfile = HemodynamicSwanGanzService.calculateProfile(normalInput);
    console.log(`Normal profile - CI: ${normalProfile.cardiacIndex}, SVR: ${normalProfile.svrDynes}, Quadrant: ${normalProfile.forresterQuadrant}`);
    assert(normalProfile.forresterQuadrant === 'Warm_Dry', 'Correctly classified as Warm & Dry (Quadrant I)');
    assert(normalProfile.cardiacIndex >= 2.5, 'Cardiac index in normal adult range');
    assert(normalProfile.svrDynes >= 1200 && normalProfile.svrDynes <= 1450, 'SVR within expected dynes*s/cm5');
    assert(normalProfile.do2Index > 450, 'Adequate oxygen delivery index (>450 mL/min/m2)');

    // 3. Cold & Wet / Cardiogenic Shock Profile Test
    console.log('\n--- 3. Cold & Wet / Cardiogenic Shock Profile ---');
    const shockInput = {
      patientId: 1,
      heartRate: 110,
      systolicBp: 85,
      diastolicBp: 55,
      mapMmhg: 65,
      cvpMmhg: 16,
      mpapMmhg: 38,
      pcwpMmhg: 26,
      cardiacOutputLMin: 2.8,
      heightCm: 175,
      weightKg: 75,
      sao2Percent: 92,
      svo2Percent: 49,
      hgbGDl: 11.5
    };
    const shockProfile = HemodynamicSwanGanzService.calculateProfile(shockInput);
    console.log(`Shock profile - CI: ${shockProfile.cardiacIndex}, PCWP: ${shockInput.pcwpMmhg}, SVR: ${shockProfile.svrDynes}, Quadrant: ${shockProfile.forresterQuadrant}`);
    assert(shockProfile.forresterQuadrant === 'Cold_Wet', 'Correctly classified as Cold & Wet (Quadrant IV - Cardiogenic Shock)');
    assert(shockProfile.cardiacIndex < 2.2, 'Severely depressed cardiac index (<2.2 L/min/m2)');
    assert(shockProfile.clinicalAlerts.some(a => a.title.includes('CARDIOGENIC SHOCK')), 'Critical cardiogenic shock alert triggered');
    assert(shockProfile.clinicalAlerts.some(a => a.title.includes('CRITICAL SvO2')), 'Critical SvO2 desaturation alert (<60%) triggered');
    assert(shockProfile.therapeuticRecommendations.some(r => r.includes('Mechanical Circulatory Support')), 'MCS recommendation present');

    // 4. Warm & Wet Pulmonary Congestion Test
    console.log('\n--- 4. Warm & Wet Pulmonary Congestion ---');
    const wetInput = {
      patientId: 1,
      heartRate: 85,
      systolicBp: 145,
      diastolicBp: 90,
      mapMmhg: 108,
      cvpMmhg: 12,
      mpapMmhg: 32,
      pcwpMmhg: 22,
      cardiacOutputLMin: 5.8,
      heightCm: 170,
      weightKg: 80,
      sao2Percent: 95,
      svo2Percent: 68,
      hgbGDl: 13.0
    };
    const wetProfile = HemodynamicSwanGanzService.calculateProfile(wetInput);
    console.log(`Wet profile - CI: ${wetProfile.cardiacIndex}, PCWP: ${wetInput.pcwpMmhg}, Quadrant: ${wetProfile.forresterQuadrant}`);
    assert(wetProfile.forresterQuadrant === 'Warm_Wet', 'Correctly classified as Warm & Wet (Quadrant II)');
    assert(wetProfile.therapeuticRecommendations.some(r => r.includes('diuretics')), 'Loop diuretic recommendation included');

    // 5. Catheter Safety Watchdog Tests
    console.log('\n--- 5. Catheter Safety Watchdog ---');
    const overinflationTest = HemodynamicSwanGanzService.evaluateCatheterSafety({
      patientId: 1,
      balloonInflationVolumeMl: 1.8,
      inflationDurationSeconds: 10,
      spontaneousWedgeDetected: false,
      pressureWaveformDamped: false,
      currentMpapMmhg: 25,
      currentPcwpMmhg: 14
    });
    console.log(`Overinflation test - Lockout: ${overinflationTest.airLockoutTriggered}, Risk: ${overinflationTest.pulmonaryRuptureRisk}`);
    assert(overinflationTest.airLockoutTriggered === true, 'Air lockout triggered for balloon volume > 1.5 mL');
    assert(overinflationTest.overinflationRisk === true, 'Overinflation risk detected');

    const spontaneousWedgeTest = HemodynamicSwanGanzService.evaluateCatheterSafety({
      patientId: 1,
      balloonInflationVolumeMl: 0.0,
      inflationDurationSeconds: 0,
      spontaneousWedgeDetected: true,
      pressureWaveformDamped: true,
      currentMpapMmhg: 22,
      currentPcwpMmhg: 16
    });
    console.log(`Spontaneous wedge test - Migration alert: ${spontaneousWedgeTest.catheterMigrationAlert}`);
    assert(spontaneousWedgeTest.catheterMigrationAlert === true, 'Catheter migration alert triggered for spontaneous wedge');
    assert(spontaneousWedgeTest.recommendedActions.some(a => a.includes('Withdraw Swan-Ganz')), 'Bedside pull-back action recommended');

    // 6. Database Persistence Verification
    console.log('\n--- 6. Database Persistence Verification ---');
    // Ensure test patient exists
    let testPatientId = 1;
    const patientCheck = await pool.query(`SELECT id FROM patients LIMIT 1`);
    if (patientCheck.rows.length > 0) {
      testPatientId = patientCheck.rows[0].id;
    } else {
      const newPatient = await pool.query(
        `INSERT INTO patients (name, date_of_birth, gender) VALUES ('Swan Test Patient', '1965-04-12', 'MALE') RETURNING id`
      );
      testPatientId = newPatient.rows[0].id;
    }

    // Save PAC Record
    const saved = await HemodynamicSwanGanzService.saveRecord({
      ...shockInput,
      patientId: testPatientId
    });
    assert(saved.record && saved.record.id > 0, 'PAC hemodynamic record saved to database');
    assert(saved.record.forrester_quadrant === 'Cold_Wet', 'Stored record reflects Cold_Wet quadrant');

    // Fetch PAC Records
    const records = await HemodynamicSwanGanzService.getRecordsByPatient(testPatientId);
    assert(records.length > 0, 'Retrieved stored PAC records by patient ID');

    // Log Safety Event
    const loggedSafety = await HemodynamicSwanGanzService.logSafetyEvent(
      testPatientId,
      'spontaneous_wedge_detected',
      'life_threatening',
      'Spontaneous wedge waveform with uninflated balloon.',
      'Catheter pulled back 2 cm. PA waveform restored.',
      0.0,
      'Dr. ICU Specialist'
    );
    assert(loggedSafety && loggedSafety.id > 0, 'Catheter safety event logged to database');

    const safetyEvents = await HemodynamicSwanGanzService.getSafetyEvents(testPatientId);
    assert(safetyEvents.length > 0, 'Retrieved catheter safety event history');

    console.log('\n====================================================');
    console.log(`📊 Phase 61 Test Results: ${passed} PASSED, ${failed} FAILED`);
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

runHemodynamicSwanGanzTests();
