import { pool, bootstrap } from './db';
import { CleanroomCompoundingService } from './services/cleanroomCompounding';

async function runCleanroomCompoundingTests() {
  console.log('====================================================');
  console.log('  IntakeRx Phase 50: Pharmacy Sterile Compounding   ');
  console.log('====================================================\n');

  try {
    await bootstrap();

    // 1. Density-Adjusted Gravimetric Formula Validation
    console.log('1. Testing Density-Adjusted Gravimetric Weight Formula...');
    const emptyTare = 525.0; // 500mL D5W bag tare + overfill
    const drugVolume = 50.0; // 50 mL Paclitaxel concentrate
    const specGravity = 1.050; // Dense non-aqueous vehicle
    const expectedWeight = CleanroomCompoundingService.calculateGravimetricExpected(emptyTare, drugVolume, specGravity);
    console.log(`   ✔ Calculated Expected Weight: ${expectedWeight} g (Formula: 525.0 + [50.0 * 1.050] = 577.50 g)`);
    if (expectedWeight !== 577.50) throw new Error(`Gravimetric formula calculation mismatch: ${expectedWeight}`);

    // 2. USP <797> Beyond-Use Date (BUD) Calculations
    console.log('\n2. Testing USP <797> Beyond-Use Date (BUD) Calculation Rules...');
    const now = new Date();
    const budCat1Room = CleanroomCompoundingService.calculateBud('Category_1', 'room_temp', now);
    const budCat2Refrig = CleanroomCompoundingService.calculateBud('Category_2', 'refrigerated', now);
    const budCat2Frozen = CleanroomCompoundingService.calculateBud('Category_2', 'frozen', now);

    const hoursCat1 = Math.round((budCat1Room.getTime() - now.getTime()) / (1000 * 3600));
    const daysCat2Refrig = Math.round((budCat2Refrig.getTime() - now.getTime()) / (1000 * 3600 * 24));
    const daysCat2Frozen = Math.round((budCat2Frozen.getTime() - now.getTime()) / (1000 * 3600 * 24));

    console.log(`   ✔ Category 1 Room Temp BUD: +${hoursCat1} hours (Expected: 12 hours)`);
    console.log(`   ✔ Category 2 Refrigerated BUD: +${daysCat2Refrig} days (Expected: 10 days)`);
    console.log(`   ✔ Category 2 Frozen BUD: +${daysCat2Frozen} days (Expected: 45 days)`);
    if (hoursCat1 !== 12 || daysCat2Refrig !== 10 || daysCat2Frozen !== 45) {
      throw new Error('USP <797> BUD duration rule mismatch.');
    }

    // 3. Setup Test Patient for Chemotherapy Infusion
    console.log('\n3. Setting up Oncology Patient for Sterile IV Compounding...');
    const patientEmail = `chemo.patient.${Date.now()}@example.com`;
    const patientRes = await pool.query(`
      INSERT INTO patients (name, email, password_hash, dob, sex)
      VALUES ('Gregory House', $1, 'pass123', '1965-06-11', 'Male')
      RETURNING id, name
    `, [patientEmail]);
    const patient = patientRes.rows[0];

    // 4. Create Compounding Batch with CSTD & USP <800> Chemo Controls
    console.log('\n4. Preparing Hazardous Chemotherapy IV Batch (Paclitaxel 300mg in D5W)...');
    const batch = await CleanroomCompoundingService.createCompoundingBatch({
      patientId: patient.id,
      prescriptionOrderId: 'RX-CHEMO-901',
      medicationName: 'Paclitaxel Injection',
      baseSolution: '5% Dextrose in Water (D5W) 500mL',
      drugDoseMg: 300,
      drugVolumeMl: 50.0,
      drugSpecificGravity: 1.050,
      emptyBagTareGrams: 525.0,
      uspCategory: 'Category_2',
      storageCondition: 'refrigerated',
      isHazardousUsp800: true,
      cstdVerified: true, // Closed-System Drug-Transfer Device verified
      compoundingHoodId: 'BSC-C-PEC-HOOD-03',
      compoundedByPharmacist: 'Elena Rostova, PharmD, BCOP'
    });

    console.log(`   ✔ IV Compounding Batch #${batch.id} Created`);
    console.log(`   ✔ Expected Weight: ${batch.expected_final_weight_grams} g`);
    console.log(`   ✔ USP <800> Hazardous Flag: ${batch.is_hazardous_usp800}`);
    console.log(`   ✔ CSTD Verified: ${batch.cstd_verified}`);
    console.log(`   ✔ Initial Status: ${batch.batch_status}`);

    // 5. Test Scale Verification: Out-of-Tolerance Safety Lockout
    console.log('\n5. Simulating Scale Gravimetric Check: OUT-OF-SPEC Weight (Safety Lockout)...');
    const outOfSpec = await CleanroomCompoundingService.verifyBatchGravimetric({
      batchId: batch.id,
      actualScaleWeightGrams: 535.0 // Variance: ~ -7.36% (Missing drug volume)
    });
    console.log(`   ✔ Actual Weight: ${outOfSpec.actual_scale_weight_grams} g`);
    console.log(`   ✔ Weight Variance: ${outOfSpec.weight_variance_percent}%`);
    console.log(`   ✔ Gravimetric Passed: ${outOfSpec.gravimetric_passed} (Expected: false)`);
    console.log(`   ✔ Quarantined Status: ${outOfSpec.batch_status} (Expected: quarantined_out_of_spec)`);
    if (outOfSpec.gravimetric_passed !== false || outOfSpec.batch_status !== 'quarantined_out_of_spec') {
      throw new Error('Safety lockout failed to quarantine out-of-spec batch.');
    }

    // 6. Test Scale Verification: In-Tolerance Successful Verification
    console.log('\n6. Preparing & Verifying IN-SPEC IV Batch (+/- 3% Tolerance)...');
    const validBatch = await CleanroomCompoundingService.createCompoundingBatch({
      patientId: patient.id,
      prescriptionOrderId: 'RX-CHEMO-902',
      medicationName: 'Carboplatin 450mg in D5W',
      baseSolution: '5% Dextrose in Water (D5W) 250mL',
      drugDoseMg: 450,
      drugVolumeMl: 45.0,
      drugSpecificGravity: 1.010,
      emptyBagTareGrams: 270.0,
      compoundingHoodId: 'BSC-C-PEC-HOOD-03',
      compoundedByPharmacist: 'Elena Rostova, PharmD, BCOP'
    });

    // Expected: 270 + (45 * 1.010) = 315.45g. Actual scale: 316.0g (Variance: +0.17%)
    const inSpec = await CleanroomCompoundingService.verifyBatchGravimetric({
      batchId: validBatch.id,
      actualScaleWeightGrams: 316.0
    });
    console.log(`   ✔ Actual Weight: ${inSpec.actual_scale_weight_grams} g (Expected: ${inSpec.expected_final_weight_grams} g)`);
    console.log(`   ✔ Weight Variance: ${inSpec.weight_variance_percent}%`);
    console.log(`   ✔ Gravimetric Passed: ${inSpec.gravimetric_passed} (Expected: true)`);
    console.log(`   ✔ Verified Dispensed: ${inSpec.batch_status} (Expected: verified_dispensed)`);
    if (inSpec.gravimetric_passed !== true || inSpec.batch_status !== 'verified_dispensed') {
      throw new Error('Valid batch gravimetric verification failed.');
    }

    // 7. Cleanroom Environmental Telemetry & Differential Pressure
    console.log('\n7. Recording USP <797>/<800> Cleanroom Environmental Telemetry...');
    const nonHazTelem = await CleanroomCompoundingService.recordTelemetry({
      cleanroomZone: 'Positive_Buffer_Room_ISO7',
      differentialPressureInWg: 0.0245, // >= +0.020 in. w.g. (Normal positive pressure)
      hepaParticleCount05um: 1840,
      isoClass: 'ISO_7',
      airChangesPerHour: 34,
      temperatureCelsius: 19.2,
      relativeHumidityPercent: 44.5
    });
    console.log(`   ✔ Non-Hazardous Zone Telemetry: ${nonHazTelem.cleanroom_zone} -> Pressure Status: ${nonHazTelem.pressure_status}`);

    const chemoTelem = await CleanroomCompoundingService.recordTelemetry({
      cleanroomZone: 'Hazardous_Chemo_C-PEC_ISO7',
      differentialPressureInWg: -0.0210, // Between -0.010 and -0.030 in. w.g. (Normal negative pressure)
      hepaParticleCount05um: 820,
      isoClass: 'ISO_7',
      airChangesPerHour: 38,
      temperatureCelsius: 18.8,
      relativeHumidityPercent: 42.0
    });
    console.log(`   ✔ Hazardous Chemo Zone Telemetry: ${chemoTelem.cleanroom_zone} -> Pressure Status: ${chemoTelem.pressure_status}`);
    if (nonHazTelem.pressure_status !== 'normal' || chemoTelem.pressure_status !== 'normal') {
      throw new Error('Cleanroom telemetry status mismatch.');
    }

    // 8. Query Analytics
    console.log('\n8. Querying Cleanroom Automation Executive Analytics...');
    const analytics = await CleanroomCompoundingService.getCleanroomAnalytics();
    console.log(`   ✔ Total Batches Compounded: ${analytics.totalBatchesPrepared}`);
    console.log(`   ✔ Verified Dispensed: ${analytics.verifiedDispensedCount}`);
    console.log(`   ✔ Quarantined Out-of-Spec: ${analytics.quarantinedCount}`);
    console.log(`   ✔ Gravimetric Pass Rate: ${analytics.gravimetricPassRate}`);
    console.log(`   ✔ Hazardous Chemo Batches: ${analytics.hazardousChemoBatches}`);

    console.log('\n====================================================');
    console.log('  Phase 50 Test Passed: 100% SUCCESS               ');
    console.log('====================================================\n');
  } catch (err) {
    console.error('Test failed with error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runCleanroomCompoundingTests();
