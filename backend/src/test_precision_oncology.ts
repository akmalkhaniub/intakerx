import { pool, bootstrap } from './db';
import * as precisionOncologyService from './services/precisionOncology';

async function runPrecisionOncologyTest() {
  console.log('====================================================');
  console.log('  IntakeRx Phase 44: Precision Oncology & Tumor Board');
  console.log('====================================================\n');

  try {
    console.log('Initializing database bootstrap...');
    await bootstrap();

    // 1. Setup Oncology Patient
    console.log('1. Setting up Patient for Precision Oncology & Molecular Tumor Board...');
    const patientEmail = `oncology.patient.${Date.now()}@example.com`;
    const patientRes = await pool.query(`
      INSERT INTO patients (name, email, password_hash, dob, sex)
      VALUES ('Genevieve Moreau', $1, 'pass_hash', '1964-07-22', 'Female')
      RETURNING id, name;
    `, [patientEmail]);
    const patient = patientRes.rows[0];

    const sessionRes = await pool.query(`
      INSERT INTO intake_sessions (id, patient_id, status, triage_level, triage_rationale)
      VALUES (gen_random_uuid(), $1, 'active', 'priority', 'Stage IVB NSCLC Adenocarcinoma - Genomic NGS Review')
      RETURNING id;
    `, [patient.id]);
    const session = sessionRes.rows[0];

    console.log(`   ✔ Patient Initialized [ID: ${patient.id}, Name: ${patient.name}]`);
    console.log(`   ✔ Oncology Session Linked [UUID: ${session.id.substring(0, 8)}]`);

    // 2. Query Baseline Precision Oncology Summary
    console.log('\n2. Querying Baseline Molecular Tumor Board Summary...');
    const initialSummary = await precisionOncologyService.getOncologySummary();
    console.log(`   ✔ Total Existing MTB Cases: ${initialSummary.metrics.totalTumorBoardCases}`);
    console.log(`   ✔ Tier I Actionable Variants: ${initialSummary.metrics.tierIActionableVariants}`);
    console.log(`   ✔ Baseline NCCN Concordance Rate: ${initialSummary.metrics.nccnConcordanceRate}%`);

    // 3. Ingest and Classify NGS Genomic Variant (EGFR p.L858R)
    console.log('\n3. Classifying NGS Somatic Variant according to AMP/ASCO/CAP Standards...');
    const egfrVariant = await precisionOncologyService.evaluateGenomicVariant({
      patientId: patient.id,
      sessionId: session.id,
      geneSymbol: 'EGFR',
      variantNomenclature: 'p.L858R',
      variantAlleleFrequency: 41.5
    });

    console.log(`   ✔ Variant ID: #${egfrVariant.id}`);
    console.log(`   ✔ Gene / Biomarker: ${egfrVariant.gene_symbol} ${egfrVariant.variant_nomenclature}`);
    console.log(`   ✔ VAF: ${egfrVariant.variant_allele_frequency}%`);
    console.log(`   ✔ AMP Tier: ${egfrVariant.amp_tier} (Expected: Tier_I)`);
    console.log(`   ✔ Matched Actionable Therapy: ${egfrVariant.actionable_drug_target}`);
    console.log(`   ✔ Evidence Level: ${egfrVariant.evidence_level} (Expected: FDA_approved)`);

    if (egfrVariant.amp_tier !== 'Tier_I' || !egfrVariant.actionable_drug_target.includes('Osimertinib')) {
      throw new Error('Genomic variant evaluation failed to match Osimertinib as Tier I target for EGFR L858R.');
    }

    // 4. Ingest and Classify Second Variant (KRAS p.G12C)
    console.log('\n4. Ingesting KRAS p.G12C Variant...');
    const krasVariant = await precisionOncologyService.evaluateGenomicVariant({
      patientId: patient.id,
      sessionId: session.id,
      geneSymbol: 'KRAS',
      variantNomenclature: 'p.G12C',
      variantAlleleFrequency: 36.2
    });
    console.log(`   ✔ KRAS Variant ID: #${krasVariant.id}`);
    console.log(`   ✔ Matched Targeted Agent: ${krasVariant.actionable_drug_target}`);

    // 5. Evaluate NCCN Category 1 Concordant Regimen (Osimertinib for EGFR-mutant NSCLC)
    console.log('\n5. Evaluating NCCN Pathway Concordance for EGFR-Mutant NSCLC...');
    const concordantPathway = await precisionOncologyService.evaluatePathwayAndRegimen({
      patientId: patient.id,
      sessionId: session.id,
      cancerType: 'Non-Small Cell Lung Cancer',
      histology: 'Adenocarcinoma',
      clinicalStage: 'Stage IVB',
      biomarkerProfile: { egfrMutation: 'L858R', pdl1Tps: '65%' },
      proposedRegimen: 'Osimertinib 80mg daily monotherapy',
      heightCm: 168,
      weightKg: 62,
      gfr: 90
    });

    console.log(`   ✔ Pathway ID: #${concordantPathway.id}`);
    console.log(`   ✔ Calculated Mosteller BSA: ${concordantPathway.bsa_m2} m²`);
    console.log(`   ✔ NCCN Concordance Status: ${concordantPathway.nccn_concordance} (Expected: concordant)`);
    console.log(`   ✔ MTB Recommendation: ${concordantPathway.mtb_recommendation.substring(0, 80)}...`);

    if (concordantPathway.nccn_concordance !== 'concordant') {
      throw new Error('NCCN concordance checker failed on Category 1 preferred regimen.');
    }

    // 6. Evaluate Contraindicated Divergent Regimen (Cetuximab in RAS-mutant Colorectal)
    console.log('\n6. Testing Divergence Detection: Anti-EGFR Prescribed in KRAS-Mutant Colorectal...');
    const divergentPathway = await precisionOncologyService.evaluatePathwayAndRegimen({
      patientId: patient.id,
      sessionId: session.id,
      cancerType: 'Colorectal Adenocarcinoma',
      histology: 'Adenocarcinoma',
      clinicalStage: 'Stage IV',
      biomarkerProfile: { krasStatus: 'mutant' },
      proposedRegimen: 'Cetuximab 400mg/m2 IV monotherapy',
      heightCm: 170,
      weightKg: 70
    });

    console.log(`   ✔ Pathway ID: #${divergentPathway.id}`);
    console.log(`   ✔ NCCN Concordance: ${divergentPathway.nccn_concordance} (Expected: non_concordant_review_required)`);
    console.log(`   ✔ Clinical Warning Flagged: ${divergentPathway.mtb_recommendation.substring(0, 90)}...`);

    if (divergentPathway.nccn_concordance !== 'non_concordant_review_required') {
      throw new Error('NCCN concordance checker failed to flag contraindicated anti-EGFR therapy in RAS-mutant colorectal cancer.');
    }

    // 7. Verify Calvert Formula Carboplatin Dosing
    console.log('\n7. Verifying Calvert Carboplatin AUC Dosing Engine...');
    const targetAuc = 5;
    const patientGfr = 75;
    const carboplatinDose = precisionOncologyService.calculateCalvertCarboplatinDose(targetAuc, patientGfr);
    const expectedDose = 5 * (75 + 25); // 500 mg
    console.log(`   ✔ Calculated Carboplatin Dose (AUC ${targetAuc}, GFR ${patientGfr}): ${carboplatinDose} mg (Expected: ${expectedDose} mg)`);

    if (carboplatinDose !== expectedDose) {
      throw new Error(`Calvert AUC dose calculation mismatch: got ${carboplatinDose}, expected ${expectedDose}`);
    }

    // 8. Query Updated Oncology Summary Metrics
    console.log('\n8. Querying Post-Intervention Molecular Tumor Board Analytics...');
    const updatedSummary = await precisionOncologyService.getOncologySummary();
    console.log(`   ✔ Total MTB Cases: ${updatedSummary.metrics.totalTumorBoardCases}`);
    console.log(`   ✔ Tier I Actionable Biomarkers Tracked: ${updatedSummary.metrics.tierIActionableVariants}`);
    console.log(`   ✔ NCCN Concordance Rate: ${updatedSummary.metrics.nccnConcordanceRate}%`);
    console.log(`   ✔ Precision Clinical Trials Matched: ${updatedSummary.metrics.precisionTrialsMatched}`);

    console.log('\n====================================================');
    console.log('  Phase 44 Test Passed: 100% SUCCESS               ');
    console.log('====================================================\n');

  } catch (err) {
    console.error('\n❌ Phase 44 Test Failed with Error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runPrecisionOncologyTest();
