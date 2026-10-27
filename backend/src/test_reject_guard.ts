import { RejectGuardService } from './services/rejectGuard';
import { pool } from './db';

async function runRejectGuardTests() {
  console.log('========================================================');
  console.log('--- Phase 85: REJECT-GUARD Command Integration Tests ---');
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
    // Test Group 1: ISHLT Heart Acute Cellular Rejection (ACR)
    // ---------------------------------------------------------
    console.log('Test Group 1: ISHLT Heart Acute Cellular Rejection (ACR)');
    // Grade 0R
    const heart0R = RejectGuardService.evaluateBiopsy({
      transplantId: 1,
      patientId: 101,
      organType: 'HEART',
      heartAcrGrade: '0R',
      pamrGrade: 'pAMR 0',
      c4dStaining: 'NEGATIVE',
      cd68MacrophagesPositive: false
    });
    assert(heart0R.cellularRejectionSeverity === 'NONE', 'Grade 0R confirms no cellular rejection');
    assert(heart0R.treatmentIndicated === false, 'No treatment indicated for 0R');

    // Grade 1R
    const heart1R = RejectGuardService.evaluateBiopsy({
      transplantId: 1,
      patientId: 101,
      organType: 'HEART',
      heartAcrGrade: '1R',
      pamrGrade: 'pAMR 0',
      c4dStaining: 'NEGATIVE',
      cd68MacrophagesPositive: false
    });
    assert(heart1R.cellularRejectionSeverity === 'MILD', 'Grade 1R confirms mild rejection');
    assert(heart1R.treatmentIndicated === false, 'Asymptomatic 1R does not trigger pulse therapy');

    // Grade 2R (Treatment indicated)
    const heart2R = RejectGuardService.evaluateBiopsy({
      transplantId: 1,
      patientId: 101,
      organType: 'HEART',
      heartAcrGrade: '2R',
      pamrGrade: 'pAMR 0',
      c4dStaining: 'NEGATIVE',
      cd68MacrophagesPositive: false,
      myocyteDamagePresent: true
    });
    assert(heart2R.cellularRejectionSeverity === 'MODERATE', 'Grade 2R confirms moderate rejection');
    assert(heart2R.treatmentIndicated === true, 'Treatment indicated for Grade 2R');
    assert(heart2R.recommendedTherapies.some(t => t.agent.includes('Methylprednisolone')), 'Prescribes pulse IV Methylprednisolone');
    assert(heart2R.recommendedTherapies.some(t => t.dosing.includes('1000 mg')), 'Specifies 1000 mg IV daily x 3 days');

    // Grade 3R (Severe, rATG indicated)
    const heart3R = RejectGuardService.evaluateBiopsy({
      transplantId: 1,
      patientId: 101,
      organType: 'HEART',
      heartAcrGrade: '3R',
      pamrGrade: 'pAMR 0',
      c4dStaining: 'NEGATIVE',
      cd68MacrophagesPositive: false,
      myocyteDamagePresent: true,
      allograftDysfunctionPresent: true
    });
    assert(heart3R.cellularRejectionSeverity === 'SEVERE', 'Grade 3R confirms severe rejection');
    assert(heart3R.treatmentIndicated === true, 'Treatment indicated for Grade 3R');
    assert(heart3R.recommendedTherapies.some(t => t.category === 'CYTOLYTIC_ANTIBODY'), 'Recommends cytolytic antibody therapy');
    assert(heart3R.recommendedTherapies.some(t => t.agent.includes('Thymoglobulin')), 'Specifies rATG / Thymoglobulin');

    // ---------------------------------------------------------
    // Test Group 2: ISHLT Lung Acute Cellular Rejection (A-Grade)
    // ---------------------------------------------------------
    console.log('\nTest Group 2: ISHLT Lung Acute Cellular Rejection (ACR)');
    const lungA3 = RejectGuardService.evaluateBiopsy({
      transplantId: 2,
      patientId: 102,
      organType: 'LUNG_BILATERAL',
      lungAcrGrade: 'A3',
      pamrGrade: 'pAMR 0',
      c4dStaining: 'NEGATIVE',
      cd68MacrophagesPositive: false
    });
    assert(lungA3.cellularRejectionSeverity === 'MODERATE', 'Lung Grade A3 confirms moderate rejection');
    assert(lungA3.treatmentIndicated === true, 'Treatment indicated for A3');
    assert(lungA3.recommendedTherapies.some(t => t.category === 'PULSE_STEROID'), 'Prescribes pulse steroids for lung ACR A3');

    // ---------------------------------------------------------
    // Test Group 3: Antibody-Mediated Rejection (pAMR)
    // ---------------------------------------------------------
    console.log('\nTest Group 3: ISHLT Antibody-Mediated Rejection (pAMR)');
    // pAMR 1(I) with C4d diffuse staining
    const pamr1 = RejectGuardService.evaluateBiopsy({
      transplantId: 1,
      patientId: 101,
      organType: 'HEART',
      heartAcrGrade: '0R',
      pamrGrade: 'pAMR 1(I)',
      c4dStaining: 'DIFFUSE',
      cd68MacrophagesPositive: true
    });
    assert(pamr1.antibodyRejectionSeverity === 'SUSPECTED', 'pAMR 1(I) with diffuse C4d classified as SUSPECTED AMR');

    // pAMR 2 (Confirmed AMR)
    const pamr2 = RejectGuardService.evaluateBiopsy({
      transplantId: 1,
      patientId: 101,
      organType: 'HEART',
      heartAcrGrade: '0R',
      pamrGrade: 'pAMR 2',
      c4dStaining: 'DIFFUSE',
      cd68MacrophagesPositive: true,
      allograftDysfunctionPresent: true
    });
    assert(pamr2.antibodyRejectionSeverity === 'CONFIRMED', 'pAMR 2 classified as CONFIRMED AMR');
    assert(pamr2.treatmentIndicated === true, 'Treatment indicated for confirmed AMR');
    assert(pamr2.recommendedTherapies.some(t => t.category === 'PLASMAPHERESIS_IVIG'), 'Recommends TPE + IVIG');
    assert(pamr2.recommendedTherapies.some(t => t.category === 'TARGETED_B_CELL'), 'Recommends Rituximab or Bortezomib');

    // ---------------------------------------------------------
    // Test Group 4: Luminex SAB & C1q Complement-Fixing DSA
    // ---------------------------------------------------------
    console.log('\nTest Group 4: Luminex SAB & C1q Complement-Fixing DSA');
    // Negative DSA (< 1000 MFI)
    const dsaNeg = RejectGuardService.evaluateDsaSurveillance({
      transplantId: 1,
      patientId: 101,
      hlaClass: 'CLASS_I',
      specificHlaLoci: [{ locus: 'HLA-A', allele: 'A*02:01', mfi: 450 }],
      c1qComplementFixing: false
    });
    assert(dsaNeg.dsaStatus === 'NEGATIVE', 'MFI < 1000 is NEGATIVE');
    assert(dsaNeg.riskStratification === 'LOW', 'Risk is LOW');

    // Weak DSA (1000 - 3000 MFI)
    const dsaWeak = RejectGuardService.evaluateDsaSurveillance({
      transplantId: 1,
      patientId: 101,
      hlaClass: 'CLASS_II',
      specificHlaLoci: [{ locus: 'HLA-DR', allele: 'DRB1*04:01', mfi: 2400 }],
      c1qComplementFixing: false
    });
    assert(dsaWeak.dsaStatus === 'WEAK', 'MFI 2400 is WEAK');
    assert(dsaWeak.riskStratification === 'INTERMEDIATE', 'Risk is INTERMEDIATE');

    // Strong C1q-positive DSA (> 10000 MFI with complement fixation)
    const dsaStrongC1q = RejectGuardService.evaluateDsaSurveillance({
      transplantId: 1,
      patientId: 101,
      hlaClass: 'BOTH',
      specificHlaLoci: [
        { locus: 'HLA-A', allele: 'A*02:01', mfi: 8200 },
        { locus: 'HLA-DQ', allele: 'DQB1*03:01', mfi: 14500 }
      ],
      c1qComplementFixing: true
    });
    assert(dsaStrongC1q.dsaStatus === 'STRONG', 'Max MFI 14500 is STRONG');
    assert(dsaStrongC1q.riskStratification === 'CRITICAL', 'Risk is CRITICAL');
    assert(dsaStrongC1q.complementFixingAlert === true, 'C1q complement fixation alert triggered');
    assert(dsaStrongC1q.recommendedInterventions.some(i => i.includes('Plasma Exchange')), 'Recommends TPE for strong DSA');

    // ---------------------------------------------------------
    // Test Group 5: Database Persistence & History Retrieval
    // ---------------------------------------------------------
    console.log('\nTest Group 5: Database Persistence & History Retrieval');
    let patientId = 1;
    let transplantId = 1;
    const patRes = await pool.query('SELECT id FROM patients LIMIT 1');
    if (patRes.rows.length > 0) {
      patientId = patRes.rows[0].id;
    }

    const txRes = await pool.query('SELECT id FROM allograft_transplant_records LIMIT 1');
    if (txRes.rows.length > 0) {
      transplantId = txRes.rows[0].id;
    }

    const savedBiopsy = await RejectGuardService.saveBiopsy({
      transplantId,
      patientId,
      organType: 'HEART',
      acrGrade: '2R',
      pamrGrade: 'pAMR 1(I)',
      c4dStaining: 'DIFFUSE',
      cd68Macrophages: 'POSITIVE',
      myocyteDamagePresent: true,
      allograftDysfunctionPresent: false,
      treatmentIndicated: true,
      pathologyNotes: 'Endomyocardial biopsy showing Grade 2R with focal capillary C4d deposition.'
    });

    assert(savedBiopsy.id > 0, 'Successfully recorded allograft biopsy');
    assert(savedBiopsy.acr_grade === '2R', 'ACR grade matches (2R)');
    assert(savedBiopsy.treatment_indicated === true, 'treatment_indicated is true');

    const savedDsa = await RejectGuardService.saveDsaSurveillance({
      transplantId,
      patientId,
      hlaClass: 'CLASS_II',
      specificHlaLoci: [{ locus: 'HLA-DQ', allele: 'DQB1*06:02', mfi: 11200 }],
      maxMfi: 11200,
      c1qComplementFixing: true,
      dsaStatus: 'STRONG',
      riskStratification: 'CRITICAL',
      recommendedInterventions: ['Therapeutic Plasma Exchange (TPE)', 'IVIG 2 g/kg']
    });

    assert(savedDsa.id > 0, 'Successfully recorded DSA surveillance record');
    assert(savedDsa.max_mfi === 11200, 'Max MFI matches (11200)');
    assert(savedDsa.c1q_complement_fixing === true, 'c1q_complement_fixing is true');

    const biopsies = await RejectGuardService.getPatientBiopsies(patientId);
    assert(biopsies.length > 0, 'Retrieved patient biopsies');
    assert(biopsies.some(b => b.id === savedBiopsy.id), 'Recorded biopsy found in patient history');

    const dsaList = await RejectGuardService.getPatientDsaHistory(patientId);
    assert(dsaList.length > 0, 'Retrieved patient DSA surveillance list');
    assert(dsaList.some(d => d.id === savedDsa.id), 'Recorded DSA found in history');

    console.log('\n========================================================');
    console.log(`Phase 85 REJECT-GUARD Tests Complete: ${passedTests}/${totalTests} Passed (100%)`);
    console.log('========================================================\n');
  } catch (err: any) {
    console.error('Test execution failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runRejectGuardTests();
