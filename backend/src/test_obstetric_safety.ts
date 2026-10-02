import { pool, bootstrap } from './db';
import { ObstetricSafetyService } from './services/obstetricSafety';

async function runObstetricSafetyTests() {
  console.log('====================================================');
  console.log('  IntakeRx Phase 49: Obstetric Safety & Command Hub ');
  console.log('====================================================\n');

  try {
    await bootstrap();

    // 1. Setup L&D Patient
    console.log('1. Setting up Labor & Delivery Patient in Active Labor...');
    const patientEmail = `ob.patient.${Date.now()}@example.com`;
    const patientRes = await pool.query(`
      INSERT INTO patients (name, email, password_hash, dob, sex)
      VALUES ('Camilla Reyes', $1, 'pass123', '1995-11-03', 'Female')
      RETURNING id, name
    `, [patientEmail]);
    const patient = patientRes.rows[0];
    console.log(`   ✔ L&D Patient Registered: [ID: ${patient.id}, Name: ${patient.name}]`);

    // 2. NICHD 3-Tier Classification Tests
    console.log('\n2. Testing NICHD 3-Tier Fetal Heart Rate Classification Engine...');
    
    // Normal Tier I
    const tier1 = ObstetricSafetyService.classifyNichdTier({
      fhrBaselineBpm: 135,
      variability: 'moderate',
      accelerationsPresent: true,
      decelerationsType: 'none',
      uterineContractionsPer10min: 3
    });
    console.log(`   ✔ Test Tracing 1 (Baseline 135, Mod Var, No Decels): ${tier1.tier} (Expected: Tier_I)`);
    if (tier1.tier !== 'Tier_I') throw new Error(`Expected Tier_I, got ${tier1.tier}`);

    // Indeterminate Tier II
    const tier2 = ObstetricSafetyService.classifyNichdTier({
      fhrBaselineBpm: 150,
      variability: 'minimal',
      accelerationsPresent: false,
      decelerationsType: 'variable',
      uterineContractionsPer10min: 4
    });
    console.log(`   ✔ Test Tracing 2 (Baseline 150, Min Var, Variable Decels): ${tier2.tier} (Expected: Tier_II)`);
    if (tier2.tier !== 'Tier_II') throw new Error(`Expected Tier_II, got ${tier2.tier}`);

    // Abnormal Tier III
    const tier3 = ObstetricSafetyService.classifyNichdTier({
      fhrBaselineBpm: 88,
      variability: 'absent',
      accelerationsPresent: false,
      decelerationsType: 'late_recurrent',
      uterineContractionsPer10min: 6
    });
    console.log(`   ✔ Test Tracing 3 (Bradycardia 88, Absent Var, Recurrent Late Decels, Tachysystole): ${tier3.tier} (Expected: Tier_III)`);
    console.log(`   ✔ Tachysystole Detected: ${tier3.tachysystole} (Expected: true)`);
    if (tier3.tier !== 'Tier_III' || !tier3.tachysystole) throw new Error('Tier_III classification failed.');

    // 3. Record Fetal Monitoring Log to Database
    console.log('\n3. Logging Electronic Fetal Monitoring (EFM) Tracing to EHR...');
    const fhrLog = await ObstetricSafetyService.recordFetalMonitoringLog({
      patientId: patient.id,
      gestationalAgeWeeks: 39.4,
      fhrBaselineBpm: 88,
      variability: 'absent',
      accelerationsPresent: false,
      decelerationsType: 'late_recurrent',
      uterineContractionsPer10min: 6,
      interventionsPerformed: ['Lateral maternal repositioning', '1000mL LR IV bolus', 'Discontinued Oxytocin'],
      loggedBy: 'Sarah Jenkins, RNC-OB'
    });
    console.log(`   ✔ Fetal Monitoring Record #${fhrLog.id} Stored [Tier: ${fhrLog.nichd_tier}]`);
    console.log(`   ✔ Protocol Recommendation: ${fhrLog.clinicalRecommendation?.substring(0, 60)}...`);

    // 4. MEWC Maternal Early Warning Surveillance
    console.log('\n4. Evaluating Maternal Early Warning Criteria (MEWC) Surveillance...');
    const mewcTriggers = ObstetricSafetyService.evaluateMewc({
      sbp: 168,
      dbp: 112,
      hr: 124,
      rr: 22,
      spo2: 94,
      headache: true,
      epigastricPain: true
    });
    console.log(`   ✔ MEWC Triggers Detected: ${mewcTriggers.length}`);
    mewcTriggers.forEach(t => console.log(`      * ${t}`));
    if (mewcTriggers.length < 5) throw new Error('Expected at least 5 MEWC triggers.');

    // 5. QBL & Postpartum Hemorrhage Staging
    console.log('\n5. Staging Quantitative Blood Loss (QBL) & PPH Escalation...');
    const pphStage1 = ObstetricSafetyService.stagePostpartumHemorrhage({ qblMl: 650, modeOfDelivery: 'vaginal' });
    const pphStage2 = ObstetricSafetyService.stagePostpartumHemorrhage({ qblMl: 1200, modeOfDelivery: 'vaginal' });
    const pphStage3 = ObstetricSafetyService.stagePostpartumHemorrhage({ qblMl: 1850, modeOfDelivery: 'cesarean', unstableVitals: true });

    console.log(`   ✔ QBL 650 mL: ${pphStage1.stage} (First-line Uterotonics: Pitocin, Methergine, Hemabate)`);
    console.log(`   ✔ QBL 1200 mL: ${pphStage2.stage} (Tranexamic Acid TXA 1g IV + Bakri Balloon)`);
    console.log(`   ✔ QBL 1850 mL: ${pphStage3.stage} (Massive Transfusion Protocol MTP 4:4:1)`);
    if (pphStage1.stage !== 'stage_1' || pphStage2.stage !== 'stage_2' || pphStage3.stage !== 'stage_3') {
      throw new Error('PPH staging logic mismatch.');
    }

    // 6. Declare Severe Preeclampsia / Eclampsia Emergency
    console.log('\n6. Declaring Severe Preeclampsia Obstetric Emergency & Magnesium Neuroprotection...');
    const obEmergency = await ObstetricSafetyService.declareObstetricEmergency({
      patientId: patient.id,
      emergencyType: 'severe_preeclampsia_eclampsia',
      quantitativeBloodLossMl: 200,
      currentVitals: {
        sbp: 168,
        dbp: 112,
        hr: 124,
        rr: 22,
        spo2: 94
      },
      leadObstetrician: 'Dr. Katherine Bell, MD, FACOG'
    });
    console.log(`   ✔ Emergency Declared: ID #${obEmergency.id} [Stage: ${obEmergency.severity_stage}]`);
    console.log(`   ✔ Protocol Checklist Steps: ${obEmergency.protocol_checklist.length}`);

    // Administer Labetalol & Magnesium Sulfate
    console.log('   ✔ Administering IV Labetalol 20mg STAT...');
    await ObstetricSafetyService.recordMedicationAdministration({
      emergencyId: obEmergency.id,
      medicationName: 'Labetalol IV',
      dose: '20 mg',
      route: 'IV push over 2 min'
    });

    console.log('   ✔ Starting Magnesium Sulfate 4g IV loading dose and 2g/hr maintenance infusion...');
    const updatedEmergency = await ObstetricSafetyService.recordMedicationAdministration({
      emergencyId: obEmergency.id,
      medicationName: 'Magnesium Sulfate',
      dose: '4g bolus then 2g/hr',
      route: 'IV infusion'
    });

    console.log(`   ✔ Active Medications Administered: ${updatedEmergency.active_medications_administered.length}`);
    console.log(`   ✔ Magnesium Infusion Active: ${updatedEmergency.magnesium_infusion_active} @ ${updatedEmergency.magnesium_rate_g_hr} g/hr`);
    if (!updatedEmergency.magnesium_infusion_active) {
      throw new Error('Expected active magnesium sulfate infusion.');
    }

    // 7. Resolve Emergency and Verify Analytics
    console.log('\n7. Stabilizing Patient & Querying L&D Command Analytics...');
    const resolved = await ObstetricSafetyService.resolveEmergency(obEmergency.id, 'stabilized');
    console.log(`   ✔ Emergency Resolved Status: ${resolved.emergency_status}`);

    const analytics = await ObstetricSafetyService.getObSafeDashboardAnalytics();
    console.log(`   ✔ Active Emergencies Count: ${analytics.activeEmergenciesCount}`);
    console.log(`   ✔ Tier III Fetal Tracings Today: ${analytics.tier3FetalTracingsCount}`);
    console.log(`   ✔ Active Magnesium Infusions: ${analytics.activeMagnesiumInfusions}`);

    console.log('\n====================================================');
    console.log('  Phase 49 Test Passed: 100% SUCCESS               ');
    console.log('====================================================\n');
  } catch (err) {
    console.error('Test failed with error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runObstetricSafetyTests();
