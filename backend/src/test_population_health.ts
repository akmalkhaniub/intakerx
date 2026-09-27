import { pool, bootstrap } from './db';
import { populationHealthService } from './services/populationHealth';

async function runPopulationHealthTest() {
  console.log('====================================================');
  console.log('  IntakeRx Phase 35: Population Health & CMS-HCC    ');
  console.log('====================================================\n');

  try {
    await bootstrap();

    // 1. Setup Medicare Advantage / At-Risk Cohort Patient
    console.log('1. Setting up Medicare Advantage Patient Context...');
    const patientEmail = `pophealth.patient.${Date.now()}@example.com`;
    const patientRes = await pool.query(`
      INSERT INTO patients (name, email, password_hash, dob, sex)
      VALUES ('Harold Jenkins', $1, 'pophealth_pw', '1958-03-22', 'Male')
      RETURNING *
    `, [patientEmail]);
    const patient = patientRes.rows[0];

    console.log(`   ✔ Patient created: ${patient.name}, DOB: ${patient.dob}, Sex: ${patient.sex}`);

    // 2. Calculate CMS-HCC V28 Risk Adjustment Factor (RAF)
    console.log('\n2. Calculating CMS-HCC V28 Risk Adjustment Score...');
    const documentedConditions = [
      'E11.22 - Type 2 diabetes mellitus with diabetic chronic kidney disease',
      'I50.22 - Chronic systolic (congestive) heart failure',
      'N18.4 - Chronic kidney disease, stage 4 (severe)',
      'I10 - Essential (primary) hypertension'
    ];

    const rafResult = await populationHealthService.calculatePatientRaf(
      patient.id,
      documentedConditions
    );

    console.log(`   ✔ Base Demographic Weight: ${rafResult.demographicWeight}`);
    console.log(`   ✔ Documented HCCs: ${rafResult.hccCategories.map(h => `${h.hcc} (${h.description}: +${h.weight})`).join(', ')}`);
    console.log(`   ✔ Disease Interactions: ${rafResult.diseaseInteractions.map(i => `${i.name}: +${i.weight}`).join(', ')}`);
    console.log(`   ✔ Total Composite RAF: ${rafResult.totalRafScore}`);
    console.log(`   ✔ Risk Tier: ${rafResult.riskTier}`);
    console.log(`   ✔ Annual Capitation Benchmark: $${rafResult.annualCapitationBenchmark.toLocaleString()}`);

    if (rafResult.totalRafScore < 1.4) {
      throw new Error(`Expected composite RAF >= 1.400 for multi-morbid cardiorenal diabetes patient, got ${rafResult.totalRafScore}`);
    }
    if (rafResult.hccCategories.length < 3) {
      throw new Error(`Expected at least 3 HCC categories mapped, got ${rafResult.hccCategories.length}`);
    }
    if (rafResult.diseaseInteractions.length < 2) {
      throw new Error(`Expected at least 2 disease interactions (Diabetes+CHF and CHF+CKD), got ${rafResult.diseaseInteractions.length}`);
    }

    // 3. Evaluate HEDIS Quality Care Gaps
    console.log('\n3. Evaluating HEDIS Quality Care Gaps (NCQA Standards)...');
    const gaps = await populationHealthService.evaluateHedisCareGaps(
      patient.id,
      documentedConditions
    );

    console.log(`   ✔ Total Identified Care Gaps: ${gaps.length}`);
    gaps.forEach((g, idx) => {
      console.log(`     [Gap ${idx + 1}] ${g.measureCode} - ${g.measureName} (Status: ${g.status}, Due: ${g.dueDate})`);
      console.log(`            Action: ${g.recommendedAction}`);
    });

    const hasCol = gaps.some(g => g.measureCode === 'COL');
    const hasCdc = gaps.some(g => g.measureCode === 'CDC-A1C');
    const hasKed = gaps.some(g => g.measureCode === 'KED');
    const hasCbp = gaps.some(g => g.measureCode === 'CBP');

    if (!hasCol || !hasCdc || !hasKed || !hasCbp) {
      throw new Error('Missing expected HEDIS care gaps (COL, CDC-A1C, KED, CBP)');
    }

    // 4. Retrieve Care Gaps from DB
    console.log('\n4. Fetching Persisted Care Gaps...');
    const storedGaps = await populationHealthService.getCareGapsByPatient(patient.id);
    console.log(`   ✔ Successfully fetched ${storedGaps.length} persisted care gaps`);

    // 5. Close a Care Gap (e.g. In-clinic HbA1c Lab completed)
    console.log('\n5. Closing a HEDIS Care Gap (CDC-A1C satisfied with HbA1c = 7.2%)...');
    const gapToClose = storedGaps.find(g => g.measure_code === 'CDC-A1C');
    if (!gapToClose) throw new Error('CDC-A1C gap not found for closing');

    const closed = await populationHealthService.closeCareGap(gapToClose.id, '2026-09-28');
    console.log(`   ✔ Gap closed: Measure ${closed.measure_code}, Status: ${closed.status}, Completed: ${closed.last_completed_date}`);

    if (closed.status !== 'compliant') {
      throw new Error(`Expected gap status to be 'compliant', got ${closed.status}`);
    }

    // 6. Aggregate Population Analytics Summary
    console.log('\n6. Aggregating Population-Level Quality & RAF Analytics...');
    const analytics = await populationHealthService.getPopulationAnalytics();
    console.log(`   ✔ Population Average RAF: ${analytics.averageRafScore}`);
    console.log(`   ✔ Total Stratified Patients: ${analytics.totalStratifiedPatients}`);
    console.log(`   ✔ Quality Compliance Rate: ${analytics.qualityComplianceRate}%`);
    console.log(`   ✔ Open Gaps: ${analytics.openCareGapsCount}, Closed Gaps: ${analytics.closedCareGapsCount}`);

    console.log('\n====================================================');
    console.log('  Phase 35 Test Passed: 100% SUCCESS               ');
    console.log('====================================================');
  } catch (err) {
    console.error('\n❌ Phase 35 Test Failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runPopulationHealthTest();
