import { pool, bootstrap } from './db';
import { AutonomousCdiService } from './services/autonomousCdi';

async function runAutonomousCdiTests() {
  console.log('====================================================');
  console.log('  IntakeRx Phase 47: Autonomous CDI & Query Hub Test');
  console.log('====================================================\n');

  try {
    await bootstrap();

    // 1. Create or retrieve test patient
    console.log('1. Setting up Test Patient for Autonomous CDI Audit...');
    const patientEmail = `eleanor.vance.${Date.now()}@example.com`;
    const patientRes = await pool.query(`
      INSERT INTO patients (name, email, password_hash, dob, sex)
      VALUES ('Eleanor Vance', $1, 'hash123', '1958-04-12', 'Female')
      RETURNING id, name
    `, [patientEmail]);
    const patient = patientRes.rows[0];
    console.log(`   ✔ Test Patient Created: [ID: ${patient.id}, Name: ${patient.name}]`);

    // 2. Perform CDI Discrepancy Chart Audit
    console.log('\n2. Executing Comprehensive Chart Discrepancy Audit (ATN, HFrEF, Malnutrition)...');
    const auditReview = await AutonomousCdiService.auditChartForDiscrepancies({
      patientId: patient.id,
      sessionId: 'sess-cdi-test-001',
      principalDiagnosis: 'Acute Kidney Failure, unspecified (N17.9)',
      secondaryDiagnoses: ['Congestive Heart Failure, unspecified (I50.9)', 'Type 2 Diabetes Mellitus'],
      clinicalIndicators: {
        creatinine: 3.4,
        baselineCreatinine: 1.1,
        feNa: 2.8,
        muddyBrownCasts: true,
        fluidChallengeGivenMl: 2500,
        ejectionFraction: 28,
        bnp: 3400,
        chfDocumented: true,
        chfType: 'unspecified',
        bmi: 17.2,
        weightLossPercentage: 11.5,
        weightLossTimeframeMonths: 3,
        temporalWasting: true,
        clinicalNotesSummary: 'Patient admitted with fluid overload, refractory oliguria, and significant temporal wasting.'
      },
      reviewerNotes: 'Automated CDI engine flagged 3 high-probability MCC opportunities.'
    });

    console.log(`   ✔ CDI Chart Review ID: #${auditReview.id}`);
    console.log(`   ✔ Base MS-DRG: ${auditReview.base_ms_drg} (Weight: ${auditReview.base_drg_weight})`);
    console.log(`   ✔ Projected MS-DRG: ${auditReview.projected_ms_drg} (Weight: ${auditReview.projected_drg_weight})`);
    console.log(`   ✔ Estimated Reimbursement Delta: +$${Number(auditReview.estimated_reimbursement_delta).toLocaleString()}`);
    console.log(`   ✔ Discrepancies Detected: ${auditReview.identified_discrepancies.length}`);

    if (auditReview.identified_discrepancies.length < 3) {
      throw new Error(`Expected at least 3 discrepancies detected, got ${auditReview.identified_discrepancies.length}`);
    }

    const types = auditReview.identified_discrepancies.map(d => d.queryType);
    console.log(`   ✔ Discrepancy Types: ${types.join(', ')}`);
    if (!types.includes('atn_vs_aki') || !types.includes('heart_failure_specificity') || !types.includes('malnutrition_severity')) {
      throw new Error('Missing expected discrepancy types in audit results.');
    }

    // 3. Generate ACDIS / AHIMA Compliant Non-Leading Physician Query
    console.log('\n3. Generating ACDIS/AHIMA Compliant Non-Leading Physician Query for ATN...');
    const query = await AutonomousCdiService.generateCompliantPhysicianQuery({
      cdiReviewId: auditReview.id,
      queryType: 'atn_vs_aki'
    });

    console.log(`   ✔ Generated Query ID: #${query.id}`);
    console.log(`   ✔ Query Type: ${query.query_type}`);
    console.log(`   ✔ Compliance Audit Status: ${query.compliance_audit_passed ? 'PASSED (Non-leading compliant)' : 'FAILED'}`);
    console.log(`   ✔ Clinical Evidence Points: ${query.objective_evidence.length}`);
    console.log(`   ✔ Available Query Options: ${query.query_options.length} options provided`);

    if (!query.compliance_audit_passed) {
      throw new Error('Physician query failed ACDIS/AHIMA compliance audit.');
    }
    if (!query.query_options.some(opt => opt.includes('Acute Tubular Necrosis'))) {
      throw new Error('Query options do not include ATN choice.');
    }
    if (!query.query_options.some(opt => opt.toLowerCase().includes('undetermined') || opt.toLowerCase().includes('unable'))) {
      throw new Error('Query lacks mandatory non-leading Undetermined/Unable option.');
    }

    // 4. Physician Signs Off & Agrees with Documented Specificity
    console.log('\n4. Submitting Physician Response with Specific ATN Documentation...');
    const responseResult = await AutonomousCdiService.submitPhysicianResponse({
      queryId: query.id,
      selectedDiagnosis: 'Acute Tubular Necrosis (ATN) secondary to prolonged renal hypoperfusion',
      physicianResponse: 'agree',
      physicianNotes: 'Agreed. Patient had ischemic insult with muddy brown granular casts on urine sediment and FeNa > 2% refractory to fluids.'
    });

    console.log(`   ✔ Query Status: ${responseResult.query.status} (Expected: agreed_and_documented)`);
    console.log(`   ✔ Selected Diagnosis: ${responseResult.query.selected_diagnosis}`);
    console.log(`   ✔ Chart Review Status: ${responseResult.updatedReview.review_status} (Expected: resolved_cc_mcc)`);
    console.log(`   ✔ Updated Secondary Diagnoses: ${responseResult.updatedReview.secondary_diagnoses.join(', ')}`);

    if (responseResult.query.status !== 'agreed_and_documented') {
      throw new Error(`Query status mismatch. Expected agreed_and_documented, got ${responseResult.query.status}`);
    }
    if (responseResult.updatedReview.review_status !== 'resolved_cc_mcc') {
      throw new Error(`Review status mismatch. Expected resolved_cc_mcc, got ${responseResult.updatedReview.review_status}`);
    }

    // 5. Query CDI Executive Analytics
    console.log('\n5. Fetching Executive CDI Analytics & CMI Financial Yield...');
    const analytics = await AutonomousCdiService.getCdiAnalytics();
    console.log(`   ✔ Total Charts Audited: ${analytics.totalAudits}`);
    console.log(`   ✔ Open Queries: ${analytics.openQueries}`);
    console.log(`   ✔ Agreed Queries (MCC Captured): ${analytics.agreedQueries}`);
    console.log(`   ✔ Physician Agreement Rate: ${analytics.physicianAgreementRate}`);
    console.log(`   ✔ Total Projected Revenue Lift: $${analytics.totalProjectedRevenueLift.toLocaleString()}`);
    console.log(`   ✔ Average Case Mix Index (CMI) Weight Lift: +${analytics.averageWeightLift}`);

    if (analytics.agreedQueries < 1) {
      throw new Error('Expected at least 1 agreed query in analytics.');
    }

    // 6. Query Lists of Reviews and Queries
    console.log('\n6. Testing Review & Query Listing Queries...');
    const recentReviews = await AutonomousCdiService.getRecentReviews(5);
    console.log(`   ✔ Recent Reviews Count: ${recentReviews.length}`);
    const recentQueries = await AutonomousCdiService.getQueries({ patientId: patient.id });
    console.log(`   ✔ Patient Queries Count: ${recentQueries.length}`);

    console.log('\n====================================================');
    console.log('  Phase 47 Test Passed: 100% SUCCESS               ');
    console.log('====================================================\n');
  } catch (err) {
    console.error('Test failed with error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runAutonomousCdiTests();
