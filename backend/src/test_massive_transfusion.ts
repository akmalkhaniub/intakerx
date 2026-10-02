import { query, pool } from './db';
import { MassiveTransfusionService } from './services/massiveTransfusion';

async function runMassiveTransfusionTest() {
  console.log('--- STARTING MASSIVE TRANSFUSION PROTOCOL & BLOOD BANK COMMAND TEST (PHASE 52) ---');

  try {
    // 1. Create dummy patient
    const testEmail = `mtp.patient.${Date.now()}@traumacenter.org`;
    const patientRes = await query(
      `INSERT INTO patients (name, email, password_hash, dob, sex)
       VALUES ($1, $2, 'hash123', '1992-07-24', 'male')
       RETURNING id, name`,
      ['Marcus Thorne', testEmail]
    );
    const patientId = patientRes.rows[0].id;
    console.log(`✔ Created dummy trauma patient #${patientId} (${patientRes.rows[0].name})`);

    // 2. Test ABC Score & Shock Index Engine
    const abcEval = MassiveTransfusionService.evaluateMtpActivation({
      penetratingMechanism: true, // 1 pt
      systolicBp: 82, // <= 90 -> 1 pt
      heartRate: 138, // >= 120 -> 1 pt
      fastPositive: true, // 1 pt
      temperatureCelsius: 35.4
    });

    console.log(`✔ ABC Score Evaluated: ${abcEval.abcScore}/4 | Shock Index: ${abcEval.shockIndex} (${abcEval.urgencyTier})`);
    console.log(`   Rationale: ${abcEval.rationale}`);
    if (abcEval.abcScore !== 4 || !abcEval.mtpIndicated || abcEval.shockIndex < 1.5) {
      throw new Error(`Expected ABC Score 4 and MTP indicated, got ${JSON.stringify(abcEval)}`);
    }

    // 3. Activate MTP in Database
    const mtpActivation = await MassiveTransfusionService.activateMtp(patientId, {
      activationTrigger: 'Penetrating_Thoracoabdominal_Trauma',
      penetratingMechanism: true,
      systolicBp: 82,
      heartRate: 138,
      fastPositive: true,
      temperatureCelsius: 35.4,
      txaAdministered: true
    });
    const activationId = mtpActivation.mtp.id;
    console.log(`✔ Activated MTP #${activationId} for Patient #${patientId} (Status: ${mtpActivation.mtp.mtp_status})`);

    // 4. Test Blood Component Logging & 1:1:1 Ratio Tracking
    // Unit 1: PRBC
    const u1 = await MassiveTransfusionService.logBloodUnitTransfusion(activationId, {
      bloodUnitBarcode: 'W03452600101',
      componentType: 'PRBC',
      bloodGroupRh: 'O_NEG',
      isUncrossed: true,
      rapidInfuserUsed: true,
      bloodWarmerVerified: true
    });
    console.log(`✔ Transfused Unit 1 (PRBC O-Neg uncrossed) -> Ratio: ${u1.updatedMtp.current_ratio}`);

    // Unit 2: PRBC (skew ratio to test dilutional coagulopathy alert)
    await MassiveTransfusionService.logBloodUnitTransfusion(activationId, {
      bloodUnitBarcode: 'W03452600102',
      componentType: 'PRBC',
      bloodGroupRh: 'O_NEG',
      isUncrossed: true
    });
    await MassiveTransfusionService.logBloodUnitTransfusion(activationId, {
      bloodUnitBarcode: 'W03452600103',
      componentType: 'PRBC',
      bloodGroupRh: 'O_NEG',
      isUncrossed: true
    });
    const u4 = await MassiveTransfusionService.logBloodUnitTransfusion(activationId, {
      bloodUnitBarcode: 'W03452600104',
      componentType: 'PRBC',
      bloodGroupRh: 'O_NEG',
      isUncrossed: true
    });
    console.log(`✔ Transfused 4 PRBCs total -> Ratio: ${u4.updatedMtp.current_ratio} (Dilutional Alert: ${u4.ratioAnalysis.dilutionalCoagulopathyRisk})`);
    if (!u4.ratioAnalysis.dilutionalCoagulopathyRisk) {
      throw new Error('Expected dilutional coagulopathy alert when 4 PRBCs transfused with 0 FFP');
    }

    // Now restore balance with 4 FFP and 4 Platelet equivalents
    for (let i = 1; i <= 4; i++) {
      await MassiveTransfusionService.logBloodUnitTransfusion(activationId, {
        bloodUnitBarcode: `FFP-2026-00${i}`,
        componentType: 'FFP',
        bloodGroupRh: 'AB_POS',
        isUncrossed: true
      });
      await MassiveTransfusionService.logBloodUnitTransfusion(activationId, {
        bloodUnitBarcode: `PLT-2026-00${i}`,
        componentType: 'Platelets',
        bloodGroupRh: 'O_POS',
        isUncrossed: false
      });
    }

    // Check balanced ratio
    const balancedCheck = MassiveTransfusionService.calculateResuscitationRatio(4, 4, 4);
    console.log(`✔ Balanced 1:1:1 Check: Ratio = ${balancedCheck.ratioString} (Balanced: ${balancedCheck.isBalanced})`);
    if (!balancedCheck.isBalanced) {
      throw new Error(`Expected balanced ratio 4:4:4, got ${JSON.stringify(balancedCheck)}`);
    }

    // 5. Test Citrate Accumulation & Calcium Repletion Sentinel
    // 4 PRBC + 4 FFP = 8 units -> 2.0g Calcium Chloride recommended
    const citrateRisk = MassiveTransfusionService.evaluateCitrateRisk(4, 4, 0.0);
    console.log(`✔ Citrate Accumulation Sentinel: ${citrateRisk.totalCitrateUnits} units -> Recommended CaCl2 = ${citrateRisk.recommendedCalciumGrams}g (Deficit = ${citrateRisk.calciumDeficitGrams}g)`);
    if (!citrateRisk.repletionRequired || citrateRisk.recommendedCalciumGrams !== 2.0) {
      throw new Error(`Expected CaCl2 repletion 2.0g, got ${JSON.stringify(citrateRisk)}`);
    }

    // Replete 2.0g Calcium Chloride in DB
    const repleted = await MassiveTransfusionService.repleteCalcium(activationId, 2.0);
    console.log(`✔ Repleted Calcium: ${repleted.calcium_repleted_grams}g CaCl2 recorded`);

    // 6. Test Viscoelastic Hemostatic Guidance (TEG Assay)
    const tegResult = await MassiveTransfusionService.recordTegAnalysis(activationId, {
      rTimeMin: 12.0, // prolonged > 10m -> FFP needed
      kTimeMin: 4.2, // prolonged > 3m -> Cryo needed
      alphaAngleDeg: 46.0, // depressed < 53 deg -> Cryo needed
      maximumAmplitudeMm: 44.0, // reduced < 50 mm -> Platelets needed
      ly30Percent: 4.8, // elevated > 3% -> Hyperfibrinolysis / TXA needed
      ionizedCalciumMmolL: 1.08 // hypocalcemia
    });

    console.log(`✔ TEG Assay Interpreted: ${tegResult.analysis.coagulopathyClassification}`);
    console.log(`   TXA Indicated: ${tegResult.analysis.txaIndicated} | Cryo Packs: ${tegResult.analysis.cryoPacksRecommended} | FFP Units: ${tegResult.analysis.ffpUnitsRecommended}`);
    tegResult.analysis.recommendations.forEach((r) => console.log(`   - ${r}`));

    if (
      !tegResult.analysis.txaIndicated ||
      tegResult.analysis.cryoPacksRecommended !== 10 ||
      tegResult.analysis.ffpUnitsRecommended !== 2
    ) {
      throw new Error(`TEG interpretation mismatch: ${JSON.stringify(tegResult.analysis)}`);
    }

    // 7. De-escalate MTP upon surgical hemostasis
    const deescalated = await MassiveTransfusionService.deescalateMtp(activationId, 'controlled');
    console.log(`✔ MTP De-escalated: Status = ${deescalated.mtp_status} at ${deescalated.deactivated_at}`);

    // 8. Query all activations
    const allActivations = await MassiveTransfusionService.getMtpActivations(patientId);
    console.log(`✔ Verified query: retrieved ${allActivations.length} activation(s) for patient #${patientId}`);

    console.log('--- ALL PHASE 52 MASSIVE TRANSFUSION COMMAND INTEGRATION TESTS PASSED (100% SUCCESS) ---');
  } catch (err) {
    console.error('❌ Phase 52 Integration Test Failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMassiveTransfusionTest();
