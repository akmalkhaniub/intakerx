import { AortaCodeService } from './services/aortaCode';
import { pool } from './db';

async function runAortaCodeTests() {
  console.log('========================================================');
  console.log('--- Phase 83: AORTA-CODE Command Integration Tests -----');
  console.log('========================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, message: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✓ ${message}`);
      passedTests++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      throw new Error(`Test failed: ${message}`);
    }
  }

  try {
    // ---------------------------------------------------------
    // Test Group 1: Stanford Type A & DeBakey I / II
    // ---------------------------------------------------------
    console.log('Test Group 1: Stanford Type A & Open Sternotomy Urgency');
    const typeACase = AortaCodeService.evaluateAorticDissection({
      patientId: 201,
      involvesAscendingAorta: true,
      involvesAorticArch: true,
      involvesDescendingAorta: true,
      extendsBelowDiaphragm: true,
      aorticDiameterMm: 58,
      intimalTearLocation: 'Sinotubular Junction',
      cardiacTamponadePresent: true,
      aorticRegurgSeverity: 'SEVERE'
    });

    assert(typeACase.stanfordType === 'TYPE_A', 'Stanford Type A confirmed for ascending involvement');
    assert(typeACase.debakeyType === 'I', 'DeBakey Type I confirmed (ascending + descending)');
    assert(typeACase.emergentSurgeryIndicated === true, 'Emergent open cardiothoracic surgery indicated');
    assert(typeACase.tevarIndicated === false, 'TEVAR not indicated for primary ascending Type A');
    assert(typeACase.clinicalDisposition.includes('EMERGENT OR'), 'Disposition specifies STAT OR sternotomy');
    assert(typeACase.immediateCriticalChecklist.some(c => c.includes('Cardiac Tamponade')), 'Warns against pericardiocentesis in tamponade if OR ready');

    const debakey2Case = AortaCodeService.evaluateAorticDissection({
      patientId: 202,
      involvesAscendingAorta: true,
      involvesAorticArch: false,
      involvesDescendingAorta: false,
      extendsBelowDiaphragm: false,
      aorticDiameterMm: 48,
      intimalTearLocation: 'Ascending Aorta'
    });
    assert(debakey2Case.stanfordType === 'TYPE_A', 'Type A confirmed');
    assert(debakey2Case.debakeyType === 'II', 'DeBakey Type II confirmed (confined to ascending aorta)');

    // ---------------------------------------------------------
    // Test Group 2: Stanford Type B Uncomplicated
    // ---------------------------------------------------------
    console.log('\nTest Group 2: Stanford Type B Uncomplicated Medical Management');
    const typeBUncomplicated = AortaCodeService.evaluateAorticDissection({
      patientId: 203,
      involvesAscendingAorta: false,
      involvesAorticArch: false,
      involvesDescendingAorta: true,
      extendsBelowDiaphragm: false,
      aorticDiameterMm: 42,
      intimalTearLocation: 'Distal to Left Subclavian Artery',
      refractoryPain: false,
      refractoryHypertension: false,
      rapidExpansion: false
    });

    assert(typeBUncomplicated.stanfordType === 'TYPE_B', 'Stanford Type B confirmed');
    assert(typeBUncomplicated.debakeyType === 'IIIa', 'DeBakey Type IIIa confirmed (above diaphragm)');
    assert(typeBUncomplicated.emergentSurgeryIndicated === false, 'No emergent open surgery indicated');
    assert(typeBUncomplicated.complicatedTypeB === false, 'Classified as UNCOMPLICATED Type B');
    assert(typeBUncomplicated.tevarIndicated === false, 'TEVAR not indicated for uncomplicated presentation');
    assert(typeBUncomplicated.clinicalDisposition.includes('ICU ADMISSION'), 'Disposition is ICU anti-impulse medical management');

    // ---------------------------------------------------------
    // Test Group 3: Stanford Type B Complicated (TEVAR Indication)
    // ---------------------------------------------------------
    console.log('\nTest Group 3: Stanford Type B Complicated & TEVAR Triggers');
    const typeBComplicated = AortaCodeService.evaluateAorticDissection({
      patientId: 204,
      involvesAscendingAorta: false,
      involvesAorticArch: false,
      involvesDescendingAorta: true,
      extendsBelowDiaphragm: true,
      aorticDiameterMm: 56, // >= 55 mm trigger
      intimalTearLocation: 'Proximal Descending Thoracic',
      refractoryPain: true, // Refractory pain trigger
      malperfusion: {
        mesenteric: true, // Mesenteric malperfusion trigger
        lowerExtremity: true // Acute limb ischemia trigger
      }
    });

    assert(typeBComplicated.stanfordType === 'TYPE_B', 'Stanford Type B confirmed');
    assert(typeBComplicated.debakeyType === 'IIIb', 'DeBakey Type IIIb confirmed (extends below diaphragm)');
    assert(typeBComplicated.complicatedTypeB === true, 'Complicated Type B confirmed');
    assert(typeBComplicated.tevarIndicated === true, 'TEVAR endovascular repair indicated');
    assert(typeBComplicated.clinicalDisposition.includes('TEVAR'), 'Disposition directs to Urgent Endovascular / TEVAR suite');
    assert(typeBComplicated.malperfusionSyndromesDetected.length === 2, 'Detected 2 malperfusion syndromes');

    // ---------------------------------------------------------
    // Test Group 4: Malperfusion Syndrome Spectrum
    // ---------------------------------------------------------
    console.log('\nTest Group 4: Malperfusion Syndrome Spectrum');
    const fullMalperf = AortaCodeService.evaluateAorticDissection({
      patientId: 205,
      involvesAscendingAorta: true,
      involvesAorticArch: true,
      involvesDescendingAorta: true,
      extendsBelowDiaphragm: true,
      aorticDiameterMm: 52,
      intimalTearLocation: 'Arch',
      malperfusion: {
        coronary: true,
        cerebral: true,
        spinalCord: true,
        mesenteric: true,
        renal: true,
        lowerExtremity: true
      }
    });

    assert(fullMalperf.malperfusionSyndromesDetected.some(s => s.includes('Coronary Malperfusion')), 'Coronary malperfusion detected');
    assert(fullMalperf.malperfusionSyndromesDetected.some(s => s.includes('Cerebral Malperfusion')), 'Cerebral malperfusion detected');
    assert(fullMalperf.malperfusionSyndromesDetected.some(s => s.includes('Spinal Cord Malperfusion')), 'Spinal cord (anterior spinal artery) detected');
    assert(fullMalperf.malperfusionSyndromesDetected.some(s => s.includes('Mesenteric Malperfusion')), 'Mesenteric malperfusion detected');
    assert(fullMalperf.malperfusionSyndromesDetected.some(s => s.includes('Renal Malperfusion')), 'Renal malperfusion detected');
    assert(fullMalperf.malperfusionSyndromesDetected.some(s => s.includes('Lower Extremity Malperfusion')), 'Lower extremity acute ischemia detected');

    // ---------------------------------------------------------
    // Test Group 5: Anti-Impulse Hemodynamics & dP/dt Shear Stress
    // ---------------------------------------------------------
    console.log('\nTest Group 5: Anti-Impulse Hemodynamics & Reflex Tachycardia Alert');
    // Scenario A: Dangerous Vasodilator Alone with Tachycardia
    const dangerousVasodilator = AortaCodeService.analyzeAntiImpulseHemodynamics({
      patientId: 206,
      heartRateBpm: 98,
      systolicBpMmhg: 170,
      diastolicBpMmhg: 95,
      betaBlockerActive: false,
      vasodilatorActive: true // Vasodilator started without beta-blocker!
    });

    assert(dangerousVasodilator.reflexTachycardiaAlert === true, 'Reflex tachycardia alert triggered');
    assert(dangerousVasodilator.shearStressStatus === 'CRITICAL_HIGH_RISK', 'Shear stress classified as CRITICAL_HIGH_RISK');
    assert(dangerousVasodilator.dpDtControlled === false, 'dP/dt not controlled');
    assert(dangerousVasodilator.protocolNextStep.includes('STEP 1: Establish negative inotropic beta-blockade'), 'Directs clinician to establish beta-blocker first');
    assert(dangerousVasodilator.recommendedOrders.some(o => o.drug.includes('Esmolol')), 'Recommends IV Esmolol bolus and infusion');

    // Scenario B: Optimal Beta-Blockade Achieved, Vasodilator Titration Next
    const rateControlled = AortaCodeService.analyzeAntiImpulseHemodynamics({
      patientId: 207,
      heartRateBpm: 56, // Target < 60 bpm achieved
      systolicBpMmhg: 148, // SBP still elevated
      diastolicBpMmhg: 86,
      betaBlockerActive: true,
      vasodilatorActive: false
    });

    assert(rateControlled.hrControlled === true, 'Heart rate controlled (< 60 bpm)');
    assert(rateControlled.sbpControlled === false, 'SBP not yet controlled (> 120 mmHg)');
    assert(rateControlled.reflexTachycardiaAlert === false, 'No reflex tachycardia risk');
    assert(rateControlled.protocolNextStep.includes('STEP 2: HR is controlled'), 'Directs clinician to STEP 2 (Nicardipine titration)');
    assert(rateControlled.recommendedOrders.some(o => o.drug.includes('Nicardipine')), 'Prescribes IV Nicardipine titration');

    // Scenario C: Perfect Anti-Impulse Goal Achieved
    const fullyControlled = AortaCodeService.analyzeAntiImpulseHemodynamics({
      patientId: 208,
      heartRateBpm: 54, // Target 50-60
      systolicBpMmhg: 108, // Target 100-120
      diastolicBpMmhg: 68,
      betaBlockerActive: true,
      vasodilatorActive: true
    });

    assert(fullyControlled.hrControlled === true, 'Heart rate controlled');
    assert(fullyControlled.sbpControlled === true, 'SBP controlled');
    assert(fullyControlled.dpDtControlled === true, 'Both dP/dt targets met (HR < 60 and SBP 100-120)');
    assert(fullyControlled.shearStressStatus === 'CONTROLLED', 'Shear stress status is CONTROLLED');
    assert(fullyControlled.protocolNextStep.includes('MAINTENANCE'), 'Protocol status is MAINTENANCE');

    // ---------------------------------------------------------
    // Test Group 6: Critical Contraindications
    // ---------------------------------------------------------
    console.log('\nTest Group 6: Critical Contraindications Checklist');
    assert(typeACase.contraindicatedTherapies.some(c => c.includes('Hydralazine')), 'Strictly contraindicates pure Hydralazine');
    assert(typeACase.contraindicatedTherapies.some(c => c.includes('Intra-Aortic Balloon Pump (IABP)')), 'Strictly contraindicates IABP');
    assert(typeACase.contraindicatedTherapies.some(c => c.includes('Thrombolytic Therapy')), 'Strictly contraindicates thrombolytics');
    assert(typeACase.contraindicatedTherapies.some(c => c.includes('Anticoagulation')), 'Strictly contraindicates anticoagulation');

    // ---------------------------------------------------------
    // Test Group 7: Database Persistence & History Retrieval
    // ---------------------------------------------------------
    console.log('\nTest Group 7: Database Persistence & History Retrieval');
    let patientId = 1;
    const patRes = await pool.query(`SELECT id FROM patients LIMIT 1`);
    if (patRes.rows.length > 0) {
      patientId = patRes.rows[0].id;
    } else {
      const newPat = await pool.query(`INSERT INTO patients (name, age, gender) VALUES ('Aorta Test Patient', 62, 'Male') RETURNING id`);
      patientId = newPat.rows[0].id;
    }

    const savedEncounter = await AortaCodeService.saveAorticEncounter({
      patientId,
      stanfordType: 'TYPE_A',
      debakeyType: 'I',
      aorticDiameterMm: 55,
      intimalTearLocation: 'Ascending Aorta Root',
      cardiacTamponadePresent: false,
      aorticRegurgSeverity: 'MODERATE',
      coronaryInvolvement: true,
      refractoryPain: true,
      rapidExpansion: false,
      malperfusionSyndromes: ['Coronary Malperfusion', 'Renal Malperfusion'],
      tevarIndicated: false,
      clinicalDisposition: 'EMERGENT OR Sternotomy'
    });

    assert(savedEncounter.id > 0, 'Successfully recorded aortic syndrome encounter');
    assert(savedEncounter.stanford_type === 'TYPE_A', 'Stanford type persisted (TYPE_A)');
    assert(Number(savedEncounter.aortic_diameter_mm) === 55, 'Aortic diameter persisted (55 mm)');

    const savedTelemetry = await AortaCodeService.logAntiImpulseTelemetry({
      encounterId: savedEncounter.id,
      patientId,
      heartRateBpm: 58,
      systolicBpMmhg: 114,
      diastolicBpMmhg: 72,
      meanArterialPressureMmhg: 86,
      dpDtControlled: true,
      betaBlockerActive: true,
      vasodilatorActive: true,
      reflexTachycardiaRisk: false,
      activeMedications: ['IV Esmolol', 'IV Nicardipine']
    });

    assert(savedTelemetry.id > 0, 'Successfully recorded anti-impulse telemetry log');
    assert(savedTelemetry.dp_dt_controlled === true, 'dp_dt_controlled persisted');
    assert(Number(savedTelemetry.heart_rate_bpm) === 58, 'Heart rate persisted (58 bpm)');

    const history = await AortaCodeService.getPatientAortaHistory(patientId);
    assert(history.length > 0, 'Retrieved patient aorta encounters');
    assert(history.some(h => h.id === savedEncounter.id), 'Encounter found in history');

    const logs = await AortaCodeService.getEncounterTelemetryLogs(savedEncounter.id);
    assert(logs.length > 0, 'Retrieved telemetry logs for encounter');
    assert(logs[0].id === savedTelemetry.id, 'Telemetry log ID matches');

    console.log('\n========================================================');
    console.log(`Phase 83 AORTA-CODE Tests Complete: ${passedTests}/${totalTests} Passed (100%)`);
    console.log('========================================================\n');
  } catch (err: any) {
    console.error('Test execution failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runAortaCodeTests();
