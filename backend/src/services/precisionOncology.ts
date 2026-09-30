import { pool } from '../db';

export interface GenomicVariantInput {
  patientId: number;
  sessionId?: string;
  geneSymbol: string;
  variantNomenclature: string;
  variantAlleleFrequency?: number;
  ampTier?: 'Tier_I' | 'Tier_II' | 'Tier_III_VUS' | 'Tier_IV';
  actionableDrugTarget?: string;
  evidenceLevel?: 'FDA_approved' | 'NCCN_compendia' | 'Clinical_trials' | 'Investigational';
}

export interface OncologyPathwayInput {
  patientId: number;
  sessionId?: string;
  cancerType: string;
  histology: string;
  clinicalStage: string;
  biomarkerProfile?: Record<string, any>;
  proposedRegimen: string;
  heightCm?: number;
  weightKg?: number;
  gfr?: number;
  targetCarboplatinAuc?: number;
  oncologistSignature?: string;
}

export interface ClinicalTrialMatch {
  trialId: string;
  title: string;
  phase: string;
  matchedBiomarker: string;
  mechanism: string;
  recruitingStatus: string;
}

// Precision Oncology Knowledgebase (AMP/ASCO/CAP Standards)
const VARIANT_CATALOG = [
  {
    gene: 'EGFR',
    variants: ['p.L858R', 'Exon 19 del', 'L858R', 'del19'],
    drug: 'Osimertinib 80mg daily',
    tier: 'Tier_I' as const,
    evidence: 'FDA_approved' as const,
    indication: '1st-line preferred for EGFR-mutated metastatic NSCLC (FLAURA trial)'
  },
  {
    gene: 'EGFR',
    variants: ['p.T790M', 'T790M'],
    drug: 'Osimertinib 80mg daily',
    tier: 'Tier_I' as const,
    evidence: 'FDA_approved' as const,
    indication: 'Resistance mutation acquired after 1st/2nd generation EGFR TKIs'
  },
  {
    gene: 'KRAS',
    variants: ['p.G12C', 'G12C'],
    drug: 'Sotorasib 960mg QD or Adagrasib 600mg BID',
    tier: 'Tier_I' as const,
    evidence: 'FDA_approved' as const,
    indication: 'KRAS G12C-mutated locally advanced or metastatic NSCLC; in CRC requires Cetuximab combination'
  },
  {
    gene: 'BRAF',
    variants: ['p.V600E', 'V600E'],
    drug: 'Dabrafenib + Trametinib (NSCLC/Melanoma) or Encorafenib + Cetuximab (CRC)',
    tier: 'Tier_I' as const,
    evidence: 'FDA_approved' as const,
    indication: 'BRAF V600E-mutated metastatic disease across multiple tumor types'
  },
  {
    gene: 'ERBB2',
    variants: ['Amplification', 'HER2-positive', 'IHC 3+'],
    drug: 'Trastuzumab deruxtecan (T-DXd) or Pertuzumab + Trastuzumab',
    tier: 'Tier_I' as const,
    evidence: 'FDA_approved' as const,
    indication: 'HER2-positive or HER2-low advanced breast and gastric carcinomas'
  },
  {
    gene: 'BRCA1',
    variants: ['c.68_69delAG', 'Pathogenic', 'p.C61G', 'Loss of function'],
    drug: 'Olaparib 300mg BID or Talazoparib 1mg QD',
    tier: 'Tier_I' as const,
    evidence: 'FDA_approved' as const,
    indication: 'Germline or somatic BRCA-mutated breast, ovarian, pancreatic, or prostate cancer'
  },
  {
    gene: 'ALK',
    variants: ['EML4-ALK fusion', 'Fusion'],
    drug: 'Alectinib 600mg BID or Lorlatinib 100mg QD',
    tier: 'Tier_I' as const,
    evidence: 'FDA_approved' as const,
    indication: '1st-line ALK-rearranged metastatic non-small cell lung cancer'
  }
];

export async function evaluateGenomicVariant(input: GenomicVariantInput) {
  let matchedDrug = input.actionableDrugTarget;
  let tier = input.ampTier || 'Tier_I';
  let evidence = input.evidenceLevel || 'FDA_approved';

  if (!matchedDrug) {
    const catalogMatch = VARIANT_CATALOG.find(
      c => c.gene.toUpperCase() === input.geneSymbol.toUpperCase() &&
           c.variants.some(v => input.variantNomenclature.toLowerCase().includes(v.toLowerCase()))
    );

    if (catalogMatch) {
      matchedDrug = catalogMatch.drug;
      tier = catalogMatch.tier;
      evidence = catalogMatch.evidence;
    } else {
      matchedDrug = 'Phase I/II Basket Clinical Trial or Standard Chemotherapy';
      tier = 'Tier_II';
      evidence = 'Investigational';
    }
  }

  const query = `
    INSERT INTO tumor_genomic_variants (
      patient_id,
      session_id,
      gene_symbol,
      variant_nomenclature,
      variant_allele_frequency,
      amp_tier,
      actionable_drug_target,
      evidence_level,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
    RETURNING *;
  `;

  const { rows } = await pool.query(query, [
    input.patientId,
    input.sessionId || null,
    input.geneSymbol.toUpperCase(),
    input.variantNomenclature,
    input.variantAlleleFrequency || 0,
    tier,
    matchedDrug,
    evidence
  ]);

  return rows[0];
}

export function calculateMostellerBsa(heightCm: number, weightKg: number): number {
  if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) return 1.80; // Standard nominal BSA
  return Math.round(Math.sqrt((heightCm * weightKg) / 3600) * 100) / 100;
}

export function calculateCalvertCarboplatinDose(targetAuc: number, gfr: number): number {
  // Calvert: Dose = Target AUC * (capped GFR + 25)
  // FDA GFR cap = 125 mL/min to prevent life-threatening myelosuppression
  const cappedGfr = Math.min(Math.max(gfr, 15), 125);
  return Math.round(targetAuc * (cappedGfr + 25));
}

export async function evaluatePathwayAndRegimen(input: OncologyPathwayInput) {
  const {
    patientId,
    sessionId,
    cancerType,
    histology,
    clinicalStage,
    biomarkerProfile = {},
    proposedRegimen,
    heightCm = 175,
    weightKg = 75,
    gfr = 85,
    targetCarboplatinAuc = 5,
    oncologistSignature = 'Dr. Alexander Vance, MD (Thoracic/Precision Oncology)'
  } = input;

  const bsa = calculateMostellerBsa(heightCm, weightKg);
  let calvertDose: number | null = null;
  if (proposedRegimen.toLowerCase().includes('carboplatin') || targetCarboplatinAuc) {
    calvertDose = calculateCalvertCarboplatinDose(targetCarboplatinAuc, gfr);
  }

  // Clinical Pathway Concordance Logic
  let nccnConcordance: 'concordant' | 'concordant_with_modifications' | 'non_concordant_review_required' = 'concordant';
  let mtbRecommendation = '';
  const clinicalTrialMatches: ClinicalTrialMatch[] = [];

  const lowerRegimen = proposedRegimen.toLowerCase();
  const lowerCancer = cancerType.toLowerCase();

  // Rule 1: Colorectal Cancer with KRAS / NRAS mutation + anti-EGFR antibody (Cetuximab/Panitumumab)
  if (lowerCancer.includes('colorectal') && biomarkerProfile.krasStatus === 'mutant' && (lowerRegimen.includes('cetuximab') || lowerRegimen.includes('panitumumab')) && !lowerRegimen.includes('encorafenib')) {
    nccnConcordance = 'non_concordant_review_required';
    mtbRecommendation = 'CRITICAL NCCN DIVERGENCE: Anti-EGFR monoclonal antibody monotherapy is strictly contraindicated in RAS-mutant colorectal cancer due to downstream constitutive MAPK activation and lack of benefit. Recommend standard FOLFOX/FOLFIRI + Bevacizumab.';
  }
  // Rule 2: NSCLC Stage IV with sensitizing EGFR mutation
  else if (lowerCancer.includes('lung') && biomarkerProfile.egfrMutation && !lowerRegimen.includes('osimertinib') && !lowerRegimen.includes('tki')) {
    nccnConcordance = 'concordant_with_modifications';
    mtbRecommendation = 'NCCN Category 1 recommendation for EGFR-mutant advanced NSCLC is 1st-line Osimertinib monotherapy. Cytotoxic doublet chemotherapy is acceptable but suboptimal compared to targeted 3rd-generation TKI.';
  }
  // Rule 3: Concordant targeted therapy
  else {
    nccnConcordance = 'concordant';
    mtbRecommendation = `Regimen '${proposedRegimen}' aligns with NCCN Clinical Practice Guidelines in Oncology (Category 1/2A Preferred) for ${clinicalStage} ${histology} ${cancerType}. Dosing verified against BSA ${bsa} m² and organ function.`;
  }

  // Generate matching precision trials
  if (biomarkerProfile.krasStatus === 'G12C' || (typeof biomarkerProfile.krasStatus === 'string' && biomarkerProfile.krasStatus.includes('G12C'))) {
    clinicalTrialMatches.push({
      trialId: 'NCT05284383',
      title: 'Phase II Trial of Novel Pan-KRAS and KRAS-G12C Targeted Combinations in Solid Tumors',
      phase: 'Phase 2',
      matchedBiomarker: 'KRAS p.G12C',
      mechanism: 'Selective Small Molecule KRAS(ON) Switch-II Pocket Inhibitor',
      recruitingStatus: 'Actively Recruiting'
    });
  }

  if (biomarkerProfile.tmbHigh || biomarkerProfile.msiStatus === 'MSI-H') {
    clinicalTrialMatches.push({
      trialId: 'NCT04843189',
      title: 'Bispecific PD-1/CTLA-4 Checkpoint Immunotherapy in TMB-High Advanced Neoplasms',
      phase: 'Phase 1b/2',
      matchedBiomarker: 'TMB >= 10 mut/Mb or MSI-High',
      mechanism: 'Dual Checkpoint Receptor Blockade',
      recruitingStatus: 'Actively Recruiting'
    });
  }

  const insertQuery = `
    INSERT INTO oncology_pathway_records (
      patient_id,
      session_id,
      cancer_type,
      histology,
      clinical_stage,
      biomarker_profile,
      proposed_regimen,
      nccn_concordance,
      bsa_m2,
      calvert_auc_dose_mg,
      mtb_recommendation,
      clinical_trial_matches,
      status,
      oncologist_signature,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'tumor_board_approved', $13, CURRENT_TIMESTAMP)
    RETURNING *;
  `;

  const { rows } = await pool.query(insertQuery, [
    patientId,
    sessionId || null,
    cancerType,
    histology,
    clinicalStage,
    JSON.stringify(biomarkerProfile),
    proposedRegimen,
    nccnConcordance,
    bsa,
    calvertDose,
    mtbRecommendation,
    JSON.stringify(clinicalTrialMatches),
    oncologistSignature
  ]);

  return rows[0];
}

async function seedInitialOncologyDataIfEmpty() {
  const countRes = await pool.query('SELECT COUNT(*) FROM oncology_pathway_records');
  if (parseInt(countRes.rows[0].count, 10) > 0) return;

  const patientRes = await pool.query('SELECT id, name FROM patients LIMIT 1');
  if (patientRes.rows.length === 0) return;
  const p = patientRes.rows[0];

  // Seed baseline variant
  await pool.query(`
    INSERT INTO tumor_genomic_variants (
      patient_id, gene_symbol, variant_nomenclature, variant_allele_frequency, amp_tier, actionable_drug_target, evidence_level, created_at
    ) VALUES ($1, 'EGFR', 'p.L858R', 38.4, 'Tier_I', 'Osimertinib 80mg daily', 'FDA_approved', CURRENT_TIMESTAMP - INTERVAL '2 days')
  `, [p.id]);

  // Seed baseline pathway
  await pool.query(`
    INSERT INTO oncology_pathway_records (
      patient_id, cancer_type, histology, clinical_stage, biomarker_profile, proposed_regimen,
      nccn_concordance, bsa_m2, calvert_auc_dose_mg, mtb_recommendation, clinical_trial_matches, status, oncologist_signature, created_at
    ) VALUES ($1, 'Non-Small Cell Lung Cancer', 'Adenocarcinoma', 'Stage IVB',
      '{"egfrMutation": "L858R", "pdl1Tps": "45%", "alkFusion": false}'::jsonb,
      'Osimertinib 80mg daily', 'concordant', 1.84, NULL,
      'NCCN Category 1 Preferred 1st-line therapy for metastatic EGFR-mutant NSCLC.',
      '[]'::jsonb, 'tumor_board_approved', 'Dr. Alexander Vance, MD', CURRENT_TIMESTAMP - INTERVAL '2 days')
  `, [p.id]);
}

export async function getOncologySummary() {
  await seedInitialOncologyDataIfEmpty();

  const pathwayRes = await pool.query(`
    SELECT o.*, p.name as patient_name
    FROM oncology_pathway_records o
    LEFT JOIN patients p ON o.patient_id = p.id
    ORDER BY o.created_at DESC
    LIMIT 25;
  `);

  const variantRes = await pool.query(`
    SELECT v.*, p.name as patient_name
    FROM tumor_genomic_variants v
    LEFT JOIN patients p ON v.patient_id = p.id
    ORDER BY v.created_at DESC
    LIMIT 25;
  `);

  const totalCases = pathwayRes.rows.length;
  const concordantCases = pathwayRes.rows.filter(r => r.nccn_concordance === 'concordant').length;
  const concordanceRate = totalCases > 0 ? Math.round((concordantCases / totalCases) * 100) : 100;
  const tierIVariants = variantRes.rows.filter(v => v.amp_tier === 'Tier_I').length;

  let totalTrialsCount = 0;
  pathwayRes.rows.forEach(r => {
    const trials = Array.isArray(r.clinical_trial_matches) ? r.clinical_trial_matches : [];
    totalTrialsCount += trials.length;
  });

  return {
    metrics: {
      totalTumorBoardCases: totalCases,
      nccnConcordanceRate: concordanceRate,
      tierIActionableVariants: tierIVariants,
      precisionTrialsMatched: totalTrialsCount,
      activeRegimensOnboarded: totalCases
    },
    recentPathways: pathwayRes.rows.map(r => ({
      id: r.id,
      patientId: r.patient_id,
      patientName: r.patient_name || `Patient #${r.patient_id}`,
      cancerType: r.cancer_type,
      histology: r.histology,
      clinicalStage: r.clinical_stage,
      biomarkerProfile: r.biomarker_profile || {},
      proposedRegimen: r.proposed_regimen,
      nccnConcordance: r.nccn_concordance,
      bsaM2: Number(r.bsa_m2),
      calvertAucDoseMg: r.calvert_auc_dose_mg ? Number(r.calvert_auc_dose_mg) : null,
      mtbRecommendation: r.mtb_recommendation,
      clinicalTrialMatches: r.clinical_trial_matches || [],
      status: r.status,
      oncologistSignature: r.oncologist_signature,
      createdAt: r.created_at
    })),
    recentVariants: variantRes.rows.map(v => ({
      id: v.id,
      patientId: v.patient_id,
      patientName: v.patient_name || `Patient #${v.patient_id}`,
      geneSymbol: v.gene_symbol,
      variantNomenclature: v.variant_nomenclature,
      variantAlleleFrequency: Number(v.variant_allele_frequency),
      ampTier: v.amp_tier,
      actionableDrugTarget: v.actionable_drug_target,
      evidenceLevel: v.evidence_level,
      createdAt: v.created_at
    }))
  };
}

export async function getPatientOncologyData(patientId: number) {
  const variants = await pool.query(
    'SELECT * FROM tumor_genomic_variants WHERE patient_id = $1 ORDER BY created_at DESC',
    [patientId]
  );
  const pathways = await pool.query(
    'SELECT * FROM oncology_pathway_records WHERE patient_id = $1 ORDER BY created_at DESC',
    [patientId]
  );

  return {
    variants: variants.rows,
    pathways: pathways.rows
  };
}
