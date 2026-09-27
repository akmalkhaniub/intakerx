import { pool, bootstrap } from './db';
import { antimicrobialPgxService } from './services/antimicrobialPgx';

async function runAntimicrobialPgxTest() {
  console.log('====================================================');
  console.log('  IntakeRx Phase 32: Antimicrobial & PGx Safety     ');
  console.log('====================================================\n');

  try {
    await bootstrap();

    // 1. Create Patient
    console.log('1. Setting up Patient & Clinical Encounter...');
    const patientEmail = `pgx.patient.${Date.now()}@example.com`;
    const patientRes = await pool.query(`
      INSERT INTO patients (name, email, password_hash, dob, sex)
      VALUES ('Eleanor Vance', $1, 'pgx_hash', '1958-06-15', 'Female')
      RETURNING *
    `, [patientEmail]);
    const patient = patientRes.rows[0];

    const sessionRes = await pool.query(`
      INSERT INTO intake_sessions (id, patient_id, status, triage_level, triage_rationale)
      VALUES (gen_random_uuid(), $1, 'active', 'yellow', 'Complex UTI presentation with altered renal clearance')
      RETURNING *
    `, [patient.id]);
    const session = sessionRes.rows[0];
    console.log(`   ✔ Encounter initialized [Session: ${session.id.substring(0, 8)}, Patient: ${patient.name}]`);

    // 2. Test Cockcroft-Gault Renal Clearance Calculator
    console.log('\n2. Testing Cockcroft-Gault CrCl Calculator...');
    // 68 yo Female, 60kg, Serum Cr 2.4 mg/dL
    const crCl = antimicrobialPgxService.calculateCrCl(68, 60, 2.4, true);
    console.log(`   ✔ Calculated CrCl: ${crCl} mL/min (Expected ~21.3 mL/min)`);
    if (crCl < 20 || crCl > 23) {
      throw new Error(`Unexpected CrCl calculation: ${crCl}`);
    }

    // 3. Test Antimicrobial Stewardship Guidance (UTI with severe renal impairment)
    console.log('\n3. Testing Antimicrobial Stewardship Antibiogram Guidance...');
    const stewardship = antimicrobialPgxService.getAntimicrobialStewardshipGuidance('UTI', crCl);
    console.log(`   ✔ Infection Site: ${stewardship.infectionSite}`);
    console.log(`   ✔ Recommended First-Line: "${stewardship.firstLineRegimen}"`);
    console.log(`   ✔ Renal Tier: ${stewardship.renalAdvice.renalImpairmentTier}`);
    console.log(`   ✔ Nitrofurantoin Contraindicated: ${stewardship.contraindications.includes('Nitrofurantoin')}`);

    if (!stewardship.contraindications.includes('Nitrofurantoin')) {
      throw new Error('Stewardship engine failed to flag Nitrofurantoin contraindication for CrCl < 30');
    }

    // 4. Seed High-Impact PGx Profiles
    console.log('\n4. Recording High-Impact Pharmacogenomic (PGx) Genetic Variants...');
    await antimicrobialPgxService.addPatientPgxProfile({
      patientId: patient.id,
      gene: 'CYP2D6',
      diplotype: '*1/*2xN',
      phenotype: 'Ultrarapid Metabolizer',
      labSource: 'Illumina TruSight PGx Panel'
    });
    await antimicrobialPgxService.addPatientPgxProfile({
      patientId: patient.id,
      gene: 'CYP2C19',
      diplotype: '*2/*2',
      phenotype: 'Poor Metabolizer',
      labSource: 'Illumina TruSight PGx Panel'
    });
    await antimicrobialPgxService.addPatientPgxProfile({
      patientId: patient.id,
      gene: 'HLA-B*5701',
      diplotype: 'Positive',
      phenotype: 'Positive (High Risk)',
      labSource: 'HLA Sequence-Specific Oligonucleotide Probe'
    });
    console.log('   ✔ Ingested PGx variants: CYP2D6 (*1/*2xN), CYP2C19 (*2/*2), HLA-B*5701 (Positive)');

    // 5. Test Full Comprehensive Safety Evaluation
    console.log('\n5. Executing Multi-Modal Prescription Safety Evaluation...');
    const proposedMeds = ['Codeine 30mg PO Q4H PRN', 'Clopidogrel 75mg PO daily', 'Abacavir 300mg PO BID'];
    const safetyResult = await antimicrobialPgxService.evaluatePatientSafety(
      patient.id,
      session.id,
      proposedMeds,
      'Urinary Tract Infection',
      2.4,
      60
    );

    console.log(`   ✔ Overall Safety Tier: ${safetyResult.overallSafetyTier}`);
    console.log(`   ✔ Total PGx Critical Alerts: ${safetyResult.pgxAlerts.length}`);

    for (const alert of safetyResult.pgxAlerts) {
      console.log(`     - [${alert.severity}] Gene: ${alert.gene} + Drug: ${alert.drug}`);
      console.log(`       Impact: "${alert.clinicalImpact}"`);
      console.log(`       Alternative: "${alert.recommendedAlternative}"`);
    }

    if (safetyResult.overallSafetyTier !== 'CRITICAL_HAZARD') {
      throw new Error('Safety evaluation did not assign CRITICAL_HAZARD for fatal contraindications');
    }
    if (safetyResult.pgxAlerts.length < 3) {
      throw new Error(`Expected at least 3 PGx alerts, got ${safetyResult.pgxAlerts.length}`);
    }

    // 6. Verify Stewardship Audit Record Persistence
    console.log('\n6. Checking Audit Record Persistence...');
    const audits = await antimicrobialPgxService.getAuditsBySession(session.id);
    if (audits.length === 0) {
      throw new Error('Audit record was not persisted to database.');
    }
    console.log(`   ✔ Persisted Audit ID #${audits[0].id}, Approval Status: ${audits[0].approval_status}`);

    console.log('\n====================================================');
    console.log('  Phase 32 Antimicrobial & PGx Test Passed 100%!     ');
    console.log('====================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Antimicrobial & PGx Test Failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runAntimicrobialPgxTest();
