import { query } from '../db';

export interface GeriatricDeliriumInput {
  patientId: number;
  ageYears: number;
  rassScore: number; // -5 to +4
  acuteOnsetOrFluctuating: boolean;
  inattentionPresent: boolean;
  disorganizedThinking: boolean;
  activeMedications: string[]; // drug names
}

export interface BeersViolation {
  medication: string;
  acbWeight: number;
  beersHazard: string;
  saferAlternative: string;
}

export interface GeriatricDeliriumResult {
  id?: number;
  patientId: number;
  camIcuPositive: boolean;
  acbTotalScore: number;
  beersViolationCount: number;
  beersViolations: BeersViolation[];
  deliriumRiskTier: 'LOW' | 'MODERATE_MONITOR' | 'HIGH_ACTIVE_DELIRIUM_OR_ACB';
  abcdefLiberationChecklist: string[];
  clinicalDirectives: string[];
}

export class GeriatricDeliriumBeersService {
  private static readonly ACB_SCORES: Record<string, number> = {
    diphenhydramine: 3,
    amitriptyline: 3,
    oxybutynin: 3,
    hydroxyzine: 3,
    scopolamine: 3,
    promethazine: 3,
    olanzapine: 3,
    paroxetine: 3,
    benztropine: 3,
    carbamazepine: 2,
    cyclobenzaprine: 2,
    amantadine: 2,
    meperidine: 2,
    furosemide: 1,
    digoxin: 1,
    prednisone: 1,
    alprazolam: 1,
    diazepam: 1,
    lorazepam: 1,
    midazolam: 1,
    codeine: 1
  };

  private static readonly BEERS_RULES: Record<string, { hazard: string; alt: string }> = {
    diphenhydramine: { hazard: 'Strong anticholinergic; precipitates acute delirium & urinary retention.', alt: 'Cetirizine or Loratadine (non-sedating 2nd-gen).' },
    hydroxyzine: { hazard: 'Strong anticholinergic; high delirium & fall risk.', alt: 'Non-pharmacologic anxiolysis or buspirone.' },
    amitriptyline: { hazard: 'Highly anticholinergic TCA; orthostasis & cardiac conduction block.', alt: 'Duloxetine or low-dose Gabapentin (renally adjusted).' },
    oxybutynin: { hazard: 'CNS anticholinergic cognitive decline.', alt: 'Mirabegron (beta-3 agonist) or pelvic floor therapy.' },
    lorazepam: { hazard: 'Benzodiazepine: increases ICU delirium, falls, and respiratory depression.', alt: 'Dexmedetomidine (ICU) or non-pharmacologic reorientation.' },
    diazepam: { hazard: 'Long-acting benzodiazepine with active metabolites.', alt: 'Avoid unless acute alcohol withdrawal (CIWA-guided).' },
    alprazolam: { hazard: 'Benzodiazepine: cognitive impairment & rebound anxiety.', alt: 'SSRI + CBT / non-pharmacologic protocol.' },
    midazolam: { hazard: 'Benzodiazepine infusion strongly linked to prolonged ICU delirium.', alt: 'Propofol or Dexmedetomidine (PADIS guidelines).' },
    zolpidem: { hazard: 'Non-benzodiazepine hypnotic (Z-drug): delirium & hip fracture risk.', alt: 'Melatonin 3 mg PO + nocturnal noise/light reduction.' },
    ketorolac: { hazard: 'High-risk NSAID: GI hemorrhage & acute kidney injury in older adults.', alt: 'Scheduled Acetaminophen 650-1000 mg q8h (max 3g/day).' },
    glyburide: { hazard: 'Long-acting sulfonylurea: severe prolonged hypoglycemia.', alt: 'Basal insulin or DPP-4 inhibitor.' }
  };

  public static evaluateDeliriumAndBeers(input: GeriatricDeliriumInput): GeriatricDeliriumResult {
    const directives: string[] = [];
    const violations: BeersViolation[] = [];

    // 1. CAM-ICU Diagnostic Algorithm (requires RASS >= -3 to assess)
    const camIcuPositive =
      input.rassScore >= -3 &&
      input.acuteOnsetOrFluctuating &&
      input.inattentionPresent &&
      (input.rassScore !== 0 || input.disorganizedThinking);

    // 2. ACB Score & AGS Beers Criteria Audit
    let acbTotal = 0;
    for (const rawMed of input.activeMedications) {
      const medNorm = rawMed.trim().toLowerCase();
      const weight = this.ACB_SCORES[medNorm] ?? 0;
      acbTotal += weight;

      const beersRule = this.BEERS_RULES[medNorm];
      if (beersRule && (input.ageYears >= 65 || weight >= 3)) {
        violations.push({
          medication: rawMed,
          acbWeight: weight,
          beersHazard: beersRule.hazard,
          saferAlternative: beersRule.alt
        });
      }
    }

    let deliriumRiskTier: GeriatricDeliriumResult['deliriumRiskTier'] = 'LOW';
    if (camIcuPositive || acbTotal >= 3) {
      deliriumRiskTier = 'HIGH_ACTIVE_DELIRIUM_OR_ACB';
    } else if (acbTotal >= 1 || violations.length > 0) {
      deliriumRiskTier = 'MODERATE_MONITOR';
    }

    if (camIcuPositive) {
      directives.push('CAM-ICU POSITIVE: Acute delirium confirmed. Deprescribe offending anticholinergics/benzodiazepines immediately and rule out sepsis, hypoxia, or urinary retention.');
    }
    if (acbTotal >= 3) {
      directives.push(`HIGH ANTICHOLINERGIC BURDEN (ACB Score ${acbTotal} >= 3): Associated with doubled delirium and cognitive decline risk. Execute Beers deprescribing.`);
    }

    const abcdefLiberationChecklist = [
      'A - Assess, Prevent, and Manage Pain (CPOT/BPS)',
      'B - Both Spontaneous Awakening Trials (SAT) & Spontaneous Breathing Trials (SBT)',
      'C - Choice of Analgesia & Sedation (avoid benzodiazepines; target RASS 0 to -1)',
      'D - Delirium: Assess (CAM-ICU q12h), Prevent (eyeglasses/hearing aids, daylight cycle)',
      'E - Early Mobility & Exercise (PT/OT within 24-48h)',
      'F - Family Engagement & Empowerment'
    ];

    return {
      patientId: input.patientId,
      camIcuPositive,
      acbTotalScore: acbTotal,
      beersViolationCount: violations.length,
      beersViolations: violations,
      deliriumRiskTier,
      abcdefLiberationChecklist,
      clinicalDirectives: directives
    };
  }

  public static async recordEvaluation(input: GeriatricDeliriumInput): Promise<GeriatricDeliriumResult> {
    const result = this.evaluateDeliriumAndBeers(input);
    const res = await query(
      `INSERT INTO geriatric_delirium_evals (
        patient_id, cam_icu_positive, acb_total_score, beers_violation_count,
        delirium_risk_tier, eval_output
      ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;`,
      [
        result.patientId,
        result.camIcuPositive,
        result.acbTotalScore,
        result.beersViolationCount,
        result.deliriumRiskTier,
        JSON.stringify(result)
      ]
    );
    if (res.rows.length > 0) {
      result.id = res.rows[0].id;
    }
    return result;
  }
}
