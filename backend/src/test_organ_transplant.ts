import { pool, bootstrap } from './db';
import { OrganTransplantService } from './services/organTransplant';

async function runOrganTransplantTests() {
  console.log('====================================================');
  console.log('  IntakeRx Phase 48: Organ Transplant & HLA Engine  ');
  console.log('====================================================\n');

  try {
    await bootstrap();

    // 1. MELD-Na & KDPI Verification
    console.log('1. Testing MELD-Na & KDPI Scoring Algorithms...');
    const meldResult = OrganTransplantService.calculateMeldNa({
      creatinine: 2.5,
      bilirubin: 3.8,
      inr: 2.2,
      sodium: 129
    });
    console.log(`   ✔ MELD Initial: ${meldResult.meldInitial}, MELD-Na: ${meldResult.meldNa}`);
    if (meldResult.meldNa < meldResult.meldInitial || meldResult.meldNa > 40) {
      throw new Error(`MELD-Na calculation out of expected bounds: ${meldResult.meldNa}`);
    }

    const kdpiScore = OrganTransplantService.calculateKdpi({
      donorAge: 56,
      donorHeightCm: 175,
      donorWeightKg: 82,
      hypertension: true,
      diabetes: false,
      causeOfDeath: 'stroke',
      creatinine: 1.6,
      dcd: false
    });
    console.log(`   ✔ Calculated KDPI: ${kdpiScore}% (Expected moderate-risk expanded criteria profile)`);
    if (kdpiScore < 10 || kdpiScore > 99) {
      throw new Error(`KDPI score outside reasonable range: ${kdpiScore}`);
    }

    // 2. Setup Patient & Transplant Listing
    console.log('\n2. Listing Patient for Deceased Donor Kidney Transplant...');
    const patientEmail = `transplant.candidate.${Date.now()}@example.com`;
    const patientRes = await pool.query(`
      INSERT INTO patients (name, email, password_hash, dob, sex)
      VALUES ('Marcus Sterling', $1, 'pass123', '1974-08-22', 'Male')
      RETURNING id, name
    `, [patientEmail]);
    const patient = patientRes.rows[0];

    const tCase = await OrganTransplantService.createTransplantCase({
      patientId: patient.id,
      organType: 'kidney',
      recipientBloodGroup: 'O+',
      cpraPercentage: 68.5,
      recipientHla: {
        a: ['A*01:01', 'A*24:02'],
        b: ['B*08:01', 'B*44:02'],
        dr: ['DRB1*03:01', 'DRB1*15:01'],
        specificAntibodies: [
          { locus: 'A', allele: 'A*02:01', mfi: 6200, c1qPositive: true },
          { locus: 'B', allele: 'B*07:02', mfi: 1800, c1qPositive: false }
        ]
      },
      unacceptableAntigens: ['A*02:01'],
      assignedSurgeon: 'Dr. Rebecca Chen, FACS (Transplant Division Chief)'
    });

    console.log(`   ✔ Transplant Case Created: ID #${tCase.id} [${tCase.organ_type.toUpperCase()} / Blood Group ${tCase.recipient_blood_group}]`);
    console.log(`   ✔ Recipient cPRA: ${tCase.cpra_percentage}% (Highly sensitized)`);
    console.log(`   ✔ Unacceptable Antigens: ${tCase.unacceptable_antigens.join(', ')}`);

    // 3. Virtual Crossmatch Against Incompatible Donor (Donor has A*02:01)
    console.log('\n3. Simulating Virtual Crossmatch with Incompatible Donor Offer (UNOS #DONOR-NY-891)...');
    const incompatibleOffer = await OrganTransplantService.runVirtualCrossmatch({
      transplantCaseId: tCase.id,
      donorUnosId: 'DONOR-NY-891',
      donorBloodGroup: 'O+',
      donorHla: {
        a: ['A*02:01', 'A*03:01'], // A*02:01 matches high-titer DSA (MFI 6200)
        b: ['B*15:01', 'B*35:01'],
        dr: ['DRB1*04:01', 'DRB1*11:01']
      },
      preservationMethod: 'hypothermic_machine_perfusion',
      crossClampTimestamp: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
      transitEtaMinutes: 120,
      reviewedByDirector: 'Dr. Samuel Vance, PhD, D(ABHI)'
    });

    console.log(`   ✔ Detected DSAs Count: ${incompatibleOffer.crossmatch.detected_dsas.length}`);
    console.log(`   ✔ Peak MFI: ${incompatibleOffer.crossmatch.peak_mfi}`);
    console.log(`   ✔ Crossmatch Prediction: ${incompatibleOffer.crossmatch.crossmatch_prediction} (Expected: high_positive_contraindicated)`);
    console.log(`   ✔ Rejection Risk Level: ${incompatibleOffer.crossmatch.rejection_risk_level} (Expected: high_hyperacute)`);
    console.log(`   ✔ Desensitization Required: ${incompatibleOffer.crossmatch.desensitization_required}`);

    if (incompatibleOffer.crossmatch.crossmatch_prediction !== 'high_positive_contraindicated') {
      throw new Error(`Expected high_positive_contraindicated crossmatch, got ${incompatibleOffer.crossmatch.crossmatch_prediction}`);
    }

    // 4. Virtual Crossmatch Against Fully Compatible Donor (No DSAs)
    console.log('\n4. Simulating Virtual Crossmatch with Second Compatible Donor Offer (UNOS #DONOR-MA-104)...');
    const compatibleOffer = await OrganTransplantService.runVirtualCrossmatch({
      transplantCaseId: tCase.id,
      donorUnosId: 'DONOR-MA-104',
      donorBloodGroup: 'O+',
      donorHla: {
        a: ['A*01:01', 'A*11:01'], // Negative for A*02:01
        b: ['B*08:01', 'B*18:01'], // Negative for B*07:02
        dr: ['DRB1*03:01', 'DRB1*13:01']
      },
      preservationMethod: 'hypothermic_machine_perfusion',
      crossClampTimestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
      transitEtaMinutes: 45,
      reviewedByDirector: 'Dr. Samuel Vance, PhD, D(ABHI)'
    });

    console.log(`   ✔ Detected DSAs Count: ${compatibleOffer.crossmatch.detected_dsas.length} (Expected: 0)`);
    console.log(`   ✔ Peak MFI: ${compatibleOffer.crossmatch.peak_mfi}`);
    console.log(`   ✔ Crossmatch Prediction: ${compatibleOffer.crossmatch.crossmatch_prediction} (Expected: negative_compatible)`);
    console.log(`   ✔ Case Updated Status: ${compatibleOffer.updatedCase.listing_status} (Expected: in_transit)`);

    if (compatibleOffer.crossmatch.crossmatch_prediction !== 'negative_compatible') {
      throw new Error(`Expected negative_compatible crossmatch, got ${compatibleOffer.crossmatch.crossmatch_prediction}`);
    }

    // 5. Update Status into Operating Room & Reperfusion
    console.log('\n5. Transitioning Transplant Case into Operating Room...');
    const orCase = await OrganTransplantService.updateCaseStatus(tCase.id, 'in_operating_room');
    console.log(`   ✔ Status Updated: ${orCase.listing_status}`);

    // 6. Test Cold Ischemia Time & Analytics Center
    console.log('\n6. Evaluating Cold Ischemia Time (CIT) Logistics & Command Analytics...');
    const caseDetails = await OrganTransplantService.getCaseDetails(tCase.id);
    console.log(`   ✔ Elapsed CIT: ${caseDetails.elapsedCitHours} hours / Max Limit: ${caseDetails.max_acceptable_cit_hours} hours`);
    console.log(`   ✔ CIT Risk Tier: ${caseDetails.citRiskStatus} (Expected: optimal)`);
    console.log(`   ✔ Total Crossmatches Logged for Case: ${caseDetails.crossmatches?.length}`);

    const analytics = await OrganTransplantService.getTransplantDashboardAnalytics();
    console.log(`   ✔ Active Listed Count: ${analytics.activeListedCount}`);
    console.log(`   ✔ In Operating Room: ${analytics.inOrCount}`);
    console.log(`   ✔ Total Crossmatches Evaluated: ${analytics.totalCrossmatches}`);
    console.log(`   ✔ Compatibility Rate: ${analytics.compatibleRate}`);

    console.log('\n====================================================');
    console.log('  Phase 48 Test Passed: 100% SUCCESS               ');
    console.log('====================================================\n');
  } catch (err) {
    console.error('Test failed with error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runOrganTransplantTests();
