import { StatusPulmoService } from './services/statusPulmo';
import { pool } from './db';

async function runStatusPulmoTests() {
  console.log('========================================================');
  console.log('--- Phase 82: STATUS-PULMO Command Integration Tests ---');
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
    // Test Group 1: Impending Respiratory Arrest & Silent Chest
    // ---------------------------------------------------------
    console.log('Test Group 1: Impending Respiratory Arrest & Silent Chest');
    const silentChestCase = StatusPulmoService.assessAsthmaSeverity({
      patientId: 101,
      pefPercent: 25,
      silentChest: true,
      accessoryMuscleUse: true,
      mentalStatus: 'LETHARGIC',
      pulsusParadoxusMmhg: 28,
      paco2Mmhg: 54,
      ph: 7.18,
      heartRate: 135,
      respiratoryRate: 34,
      spo2Percent: 84
    });

    assert(silentChestCase.severity === 'IMPENDING_ARREST', 'Correctly classified as IMPENDING_ARREST');
    assert(silentChestCase.silentChestAlert === true, 'Silent chest alert triggered');
    assert(silentChestCase.hemodynamicPulsusAlert === true, 'Hemodynamic pulsus paradoxus alert triggered (> 15 mmHg)');
    assert(silentChestCase.intubationRisk === 'EMERGENT', 'Intubation risk is EMERGENT');
    assert(silentChestCase.recommendedActions.some(a => a.includes('STAT Pulmonary / Critical Care Consult')), 'Recommends STAT critical care consult');
    assert(silentChestCase.recommendedActions.some(a => a.includes('Ketamine')), 'Includes Ketamine dissociation / RSI prep');

    // ---------------------------------------------------------
    // Test Group 2: Pseudonormal PaCO2 Recognition
    // ---------------------------------------------------------
    console.log('\nTest Group 2: Pseudonormal PaCO2 Fatigue Alert');
    const pseudoNormalCase = StatusPulmoService.assessAsthmaSeverity({
      patientId: 102,
      pefPercent: 42,
      speech: 'WORDS',
      accessoryMuscleUse: true,
      paco2Mmhg: 42, // "Normal" on ABG, but ominous in an acute asthmatic with tachypnea
      ph: 7.36,
      respiratoryRate: 28,
      heartRate: 118,
      spo2Percent: 92
    });

    assert(pseudoNormalCase.severity === 'SEVERE', 'Classified as SEVERE asthma');
    assert(pseudoNormalCase.pseudonormalPaco2Alert === true, 'Pseudonormal PaCO2 fatigue warning triggered');
    assert(pseudoNormalCase.intubationRisk === 'HIGH', 'High intubation risk recognized');

    // ---------------------------------------------------------
    // Test Group 3: Mild and Moderate Asthma Assessment
    // ---------------------------------------------------------
    console.log('\nTest Group 3: Mild and Moderate Asthma Stratification');
    const mildCase = StatusPulmoService.assessAsthmaSeverity({
      patientId: 103,
      pefPercent: 82,
      speech: 'FULL_SENTENCES',
      accessoryMuscleUse: false,
      paco2Mmhg: 32,
      ph: 7.44,
      respiratoryRate: 18,
      heartRate: 78,
      spo2Percent: 98
    });
    assert(mildCase.severity === 'MILD', 'Mild asthma correctly classified');
    assert(mildCase.intubationRisk === 'LOW', 'Low intubation risk');

    const modCase = StatusPulmoService.assessAsthmaSeverity({
      patientId: 104,
      pefPercent: 62,
      speech: 'PHRASES',
      accessoryMuscleUse: false,
      paco2Mmhg: 34,
      ph: 7.42,
      respiratoryRate: 24,
      heartRate: 106,
      spo2Percent: 95
    });
    assert(modCase.severity === 'MODERATE', 'Moderate asthma correctly classified');
    assert(modCase.intubationRisk === 'INTERMEDIATE', 'Intermediate intubation risk');

    // ---------------------------------------------------------
    // Test Group 4: Ventilator Physics & Devine IBW
    // ---------------------------------------------------------
    console.log('\nTest Group 4: Ventilator Physics & Ideal Body Weight');
    // Male 178 cm (70.08 in) -> ~73.2 kg IBW
    const maleVent = StatusPulmoService.calculateVentilatorPhysics({
      patientId: 105,
      weightKg: 95, // Actual obese weight
      heightCm: 178,
      gender: 'MALE',
      tidalVolumeMl: 500,
      respiratoryRateBpm: 10,
      inspiratoryFlowLpm: 80,
      appliedPeep: 5,
      autoPeepCmh2o: 6,
      plateauPressureCmh2o: 24,
      peakPressureCmh2o: 42,
      ph: 7.28,
      paco2Mmhg: 58
    });

    assert(maleVent.ibwKg >= 70 && maleVent.ibwKg <= 75, `Devine male IBW calculated accurately (${maleVent.ibwKg} kg)`);
    assert(maleVent.vtPerKgIbw >= 6.0 && maleVent.vtPerKgIbw <= 8.0, `Vt safe per kg IBW (${maleVent.vtPerKgIbw} mL/kg)`);
    assert(maleVent.totalPeepCmh2o === 11, 'Total PEEP = Applied (5) + Auto (6) = 11 cmH2O');
    assert(maleVent.drivingPressureCmh2o === 13, 'Driving pressure = Pplat (24) - Total PEEP (11) = 13 cmH2O');
    assert(maleVent.airwayResistancePressureCmh2o === 18, 'Airway resistance = Ppeak (42) - Pplat (24) = 18 cmH2O');

    // Female 165 cm (64.96 in) -> ~56.9 kg IBW
    const femaleVent = StatusPulmoService.calculateVentilatorPhysics({
      patientId: 106,
      weightKg: 65,
      heightCm: 165,
      gender: 'FEMALE',
      tidalVolumeMl: 400,
      respiratoryRateBpm: 10,
      inspiratoryFlowLpm: 75,
      appliedPeep: 5,
      autoPeepCmh2o: 4,
      plateauPressureCmh2o: 22,
      peakPressureCmh2o: 38,
      ph: 7.31,
      paco2Mmhg: 52
    });
    assert(femaleVent.ibwKg >= 55 && femaleVent.ibwKg <= 60, `Devine female IBW calculated accurately (${femaleVent.ibwKg} kg)`);

    // ---------------------------------------------------------
    // Test Group 5: I:E Ratio & Dynamic Hyperinflation Alert
    // ---------------------------------------------------------
    console.log('\nTest Group 5: I:E Ratio & Dynamic Hyperinflation Alerts');
    // RR = 10 bpm -> Ttot = 6.0s. Insp flow = 80 L/min -> Flow = 1.33 L/s. Vt = 500 mL -> Ti = 0.38s. Te = 5.62s -> I:E ~ 1:14.8
    assert(maleVent.prolongedExpiratoryTimeCompliant === true, 'Prolonged expiratory time compliant (>= 1:3)');
    assert(maleVent.calculatedIeRatio.startsWith('1:'), 'I:E ratio string formatted properly');

    // Breath-stacking scenario with Auto-PEEP = 14 cmH2O and Pplat = 34 cmH2O
    const stackedVent = StatusPulmoService.calculateVentilatorPhysics({
      patientId: 107,
      weightKg: 75,
      heightCm: 175,
      gender: 'MALE',
      tidalVolumeMl: 650,
      respiratoryRateBpm: 24, // Way too fast for status asthmaticus!
      inspiratoryFlowLpm: 50,
      appliedPeep: 8,
      autoPeepCmh2o: 14, // Severe dynamic hyperinflation
      plateauPressureCmh2o: 35,
      peakPressureCmh2o: 65,
      ph: 7.16,
      paco2Mmhg: 72
    });

    assert(stackedVent.dynamicHyperinflationAlert === true, 'Dynamic hyperinflation alert triggered (Auto-PEEP >= 10, Pplat > 30)');
    assert(stackedVent.emergencyDecompressionProtocol.indicated === true, 'Emergency decompression protocol indicated');
    assert(stackedVent.emergencyDecompressionProtocol.steps.some(s => s.includes('DISCONNECT PATIENT IMMEDIATELY')), 'Instructs immediate ventilator disconnect');
    assert(stackedVent.emergencyDecompressionProtocol.steps.some(s => s.includes('finger thoracostomies')), 'Instructs bilateral finger thoracostomies if hypotension persists');

    // ---------------------------------------------------------
    // Test Group 6: Permissive Hypercapnia & Contraindication
    // ---------------------------------------------------------
    console.log('\nTest Group 6: Permissive Hypercapnia & Contraindications');
    // Permissive hypercapnia accepted: PaCO2 65, pH 7.24 (>= 7.20)
    const permissiveCase = StatusPulmoService.calculateVentilatorPhysics({
      patientId: 108,
      weightKg: 70,
      heightCm: 170,
      gender: 'MALE',
      tidalVolumeMl: 450,
      respiratoryRateBpm: 10,
      inspiratoryFlowLpm: 80,
      appliedPeep: 5,
      autoPeepCmh2o: 5,
      plateauPressureCmh2o: 25,
      peakPressureCmh2o: 40,
      ph: 7.24,
      paco2Mmhg: 65,
      hasAcuteTbiOrElevatedIcp: false
    });
    assert(permissiveCase.permissiveHypercapniaStatus.permitted === true, 'Permissive hypercapnia permitted with pH >= 7.20');
    assert(permissiveCase.permissiveHypercapniaStatus.phSafe === true, 'pH is recognized as safe for lung-protective ventilation');

    // Strict contraindication: Patient with acute TBI / ICP spike
    const tbiCase = StatusPulmoService.calculateVentilatorPhysics({
      patientId: 109,
      weightKg: 70,
      heightCm: 170,
      gender: 'MALE',
      tidalVolumeMl: 450,
      respiratoryRateBpm: 12,
      inspiratoryFlowLpm: 80,
      appliedPeep: 5,
      autoPeepCmh2o: 5,
      plateauPressureCmh2o: 25,
      peakPressureCmh2o: 40,
      ph: 7.26,
      paco2Mmhg: 62,
      hasAcuteTbiOrElevatedIcp: true
    });
    assert(tbiCase.permissiveHypercapniaStatus.permitted === false, 'Permissive hypercapnia prohibited in TBI/ICP');
    assert(Boolean(tbiCase.permissiveHypercapniaStatus.contraindicationWarning?.includes('STRICT CONTRAINDICATION')), 'Emits strict contraindication warning for TBI');

    // ---------------------------------------------------------
    // Test Group 7: Medical Escalation Pharmacotherapy Tiers
    // ---------------------------------------------------------
    console.log('\nTest Group 7: Medical Escalation Tiers');
    const tier1Plan = StatusPulmoService.generateMedicalEscalation({
      severity: 'MILD',
      refractoryDurationMin: 0
    });
    assert(tier1Plan.tier === 1, 'Mild case initiates Tier 1');
    assert(tier1Plan.orders.some(o => o.drug.includes('Albuterol')), 'Prescribes continuous Albuterol');
    assert(tier1Plan.orders.some(o => o.drug.includes('Methylprednisolone')), 'Prescribes systemic steroid');

    const tier2Plan = StatusPulmoService.generateMedicalEscalation({
      severity: 'SEVERE',
      refractoryDurationMin: 15
    });
    assert(tier2Plan.tier === 2, 'Severe 15-min case initiates Tier 2');
    assert(tier2Plan.orders.some(o => o.drug.includes('Magnesium Sulfate')), 'Prescribes IV Magnesium Sulfate 2g');
    assert(tier2Plan.criticalWarnings.some(w => w.includes('hypokalemia')), 'Warns about severe hypokalemia watchdog');

    const tier3Plan = StatusPulmoService.generateMedicalEscalation({
      severity: 'SEVERE',
      refractoryDurationMin: 35
    });
    assert(tier3Plan.tier === 3, 'Refractory 35-min case initiates Tier 3');
    assert(tier3Plan.orders.some(o => o.drug.includes('Terbutaline')), 'Prescribes Terbutaline');
    assert(tier3Plan.orders.some(o => o.drug.includes('Ketamine')), 'Prescribes IV Ketamine dissociation');

    const tier4Plan = StatusPulmoService.generateMedicalEscalation({
      severity: 'IMPENDING_ARREST',
      refractoryDurationMin: 75,
      intubated: true
    });
    assert(tier4Plan.tier === 4, 'Impending arrest / intubated case initiates Tier 4');
    assert(tier4Plan.orders.some(o => o.drug.includes('Isoflurane')), 'Prescribes volatile anesthetic (Isoflurane / Sevoflurane)');
    assert(tier4Plan.rescueOptions.some(r => r.includes('VV-ECMO')), 'Evaluates VV-ECMO / ECCO2R');

    // ---------------------------------------------------------
    // Test Group 8: Database Persistence & History Retrieval
    // ---------------------------------------------------------
    console.log('\nTest Group 8: Database Persistence & History Retrieval');
    // First, ensure a test patient exists
    let patientId = 1;
    const testPatientCheck = await pool.query(`SELECT id FROM patients LIMIT 1`);
    if (testPatientCheck.rows.length > 0) {
      patientId = testPatientCheck.rows[0].id;
    } else {
      const newPat = await pool.query(`INSERT INTO patients (name, age, gender) VALUES ('Pulmo Test Patient', 35, 'Female') RETURNING id`);
      patientId = newPat.rows[0].id;
    }

    const savedEncounter = await StatusPulmoService.savePulmoEncounter({
      patientId,
      severity: 'SEVERE',
      pefPercent: 44,
      silentChest: false,
      pulsusParadoxusMmhg: 18,
      paco2Mmhg: 48,
      ph: 7.29,
      pao2Mmhg: 68,
      fio2Percent: 60,
      intubated: true,
      dynamicHyperinflationRisk: 'HIGH',
      rescueMedications: { iv_magnesium: true, terbutaline: true, ketamine_infusion: true },
      clinicalNotes: 'Intubated for exhaustion; low RR and high flow configured.'
    });

    assert(savedEncounter.id > 0, 'Successfully recorded status pulmo encounter');
    assert(savedEncounter.severity === 'SEVERE', 'Encounter severity matches (SEVERE)');
    assert(Number(savedEncounter.paco2_mmhg) === 48, 'PaCO2 persisted accurately (48 mmHg)');
    assert(Number(savedEncounter.ph) === 7.29, 'pH persisted accurately (7.29)');

    const savedVentLog = await StatusPulmoService.logVentSettings({
      encounterId: savedEncounter.id,
      patientId,
      tidalVolumeMl: 420,
      respiratoryRateBpm: 10,
      inspiratoryFlowLpm: 80,
      ieRatio: '1:4.8',
      appliedPeep: 5,
      autoPeepCmh2o: 7,
      plateauPressureCmh2o: 26,
      peakPressureCmh2o: 48,
      dynamicHyperinflationAlert: false,
      ventilatorMode: 'VCV'
    });

    assert(savedVentLog.id > 0, 'Successfully logged obstructive ventilator settings');
    assert(Number(savedVentLog.respiratory_rate_bpm) === 10, 'Respiratory rate persisted (10 bpm)');
    assert(savedVentLog.ie_ratio === '1:4.8', 'I:E ratio persisted (1:4.8)');

    const history = await StatusPulmoService.getPatientPulmoHistory(patientId);
    assert(history.length > 0, 'Retrieved patient pulmo history successfully');
    assert(history.some(h => h.id === savedEncounter.id), 'Saved encounter is present in history');

    const ventSettings = await StatusPulmoService.getEncounterVentSettings(savedEncounter.id);
    assert(ventSettings.length > 0, 'Retrieved vent settings for encounter');
    assert(ventSettings[0].id === savedVentLog.id, 'Vent setting ID matches');

    console.log('\n========================================================');
    console.log(`Phase 82 STATUS-PULMO Tests Complete: ${passedTests}/${totalTests} Passed (100%)`);
    console.log('========================================================\n');
  } catch (err: any) {
    console.error('Test execution failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runStatusPulmoTests();
