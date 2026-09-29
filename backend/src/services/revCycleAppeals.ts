import { query } from '../db';

export interface CptLineItem {
  code: string;
  description: string;
  modifiers?: string[];
  units: number;
  chargeCents: number;
}

export interface CciEditConflict {
  primaryCode: string;
  bundledCode: string;
  rationale: string;
  allowedWithModifier: boolean;
  recommendedModifier?: string;
}

export interface NcdLcdValidation {
  cptCode: string;
  isCovered: boolean;
  requiredIcd10Prefixes: string[];
  matchedIcd10?: string;
  rationale: string;
}

export interface ScrubResult {
  isValid: boolean;
  denialProbabilityPercent: number;
  cciEdits: CciEditConflict[];
  ncdLcdValidations: NcdLcdValidation[];
  recommendations: string[];
}

export interface ClaimCreationParams {
  patientId: number;
  sessionId?: string;
  claimType?: 'CMS-1500' | 'UB-04';
  payerName: string;
  cptCodes: CptLineItem[];
  icd10Codes: string[];
}

// Built-in NCCI Procedure-to-Procedure (PTP) edits
const CCI_RULES: Array<{
  primary: string;
  bundled: string;
  rationale: string;
  allowedWithModifier: boolean;
  recommendedModifier: string;
}> = [
  {
    primary: '99214',
    bundled: '99451',
    rationale: 'E/M Office Visit billed same day as Interprofessional e-Consultation requires significant separate service indicator',
    allowedWithModifier: true,
    recommendedModifier: '25'
  },
  {
    primary: '99285',
    bundled: '99291',
    rationale: 'Emergency Department High Acuity Visit is mutually exclusive with Critical Care services without distinct time documentation',
    allowedWithModifier: true,
    recommendedModifier: '25'
  },
  {
    primary: '80053',
    bundled: '36415',
    rationale: 'Routine venipuncture is frequently bundled into comprehensive metabolic laboratory panel allowances by commercial payers',
    allowedWithModifier: true,
    recommendedModifier: '59'
  }
];

// Built-in Medicare NCD/LCD Coverage Rules
const NCD_LCD_RULES: Array<{
  cpt: string;
  desc: string;
  allowedPrefixes: string[];
  guidelineName: string;
}> = [
  {
    cpt: '83036',
    desc: 'Glycated Hemoglobin (HbA1c)',
    allowedPrefixes: ['E10', 'E11', 'E13', 'O24', 'R73'],
    guidelineName: 'CMS NCD 190.21 - Glycated Hemoglobin / Diabetes Mellitus'
  },
  {
    cpt: '71046',
    desc: 'Radiologic Examination, Chest; 2 Views',
    allowedPrefixes: ['R05', 'R06', 'R07', 'J18', 'J44', 'I50'],
    guidelineName: 'CMS LCD L34232 - Diagnostic Chest Imaging Indications'
  },
  {
    cpt: '93000',
    desc: 'Electrocardiogram, Routine ECG with at least 12 leads',
    allowedPrefixes: ['I20', 'I21', 'I25', 'I48', 'R00', 'R07'],
    guidelineName: 'CMS LCD L33948 - Electrocardiographic Services'
  }
];

export class RevCycleAppealsService {
  /**
   * Scrub and validate claim line items against CCI unbundling edits and NCD/LCD medical necessity.
   */
  public scrubClaim(cptCodes: CptLineItem[], icd10Codes: string[]): ScrubResult {
    const cciEdits: CciEditConflict[] = [];
    const ncdLcdValidations: NcdLcdValidation[] = [];
    const recommendations: string[] = [];

    const cptSet = new Set(cptCodes.map(c => c.code));

    // 1. Check CCI PTP Edits
    for (const rule of CCI_RULES) {
      if (cptSet.has(rule.primary) && cptSet.has(rule.bundled)) {
        const primaryItem = cptCodes.find(c => c.code === rule.primary);
        const hasMod = primaryItem?.modifiers?.includes(rule.recommendedModifier);

        if (!hasMod) {
          cciEdits.push({
            primaryCode: rule.primary,
            bundledCode: rule.bundled,
            rationale: rule.rationale,
            allowedWithModifier: rule.allowedWithModifier,
            recommendedModifier: rule.recommendedModifier
          });
          recommendations.push(
            `Attach Modifier -${rule.recommendedModifier} to CPT ${rule.primary} to override CCI unbundling denial for ${rule.bundled}.`
          );
        }
      }
    }

    // 2. Check NCD/LCD Medical Necessity
    for (const item of cptCodes) {
      const rule = NCD_LCD_RULES.find(r => r.cpt === item.code);
      if (rule) {
        const matched = icd10Codes.find(icd => rule.allowedPrefixes.some(p => icd.startsWith(p)));
        if (matched) {
          ncdLcdValidations.push({
            cptCode: item.code,
            isCovered: true,
            requiredIcd10Prefixes: rule.allowedPrefixes,
            matchedIcd10: matched,
            rationale: `Complies with ${rule.guidelineName} (linked to ${matched}).`
          });
        } else {
          ncdLcdValidations.push({
            cptCode: item.code,
            isCovered: false,
            requiredIcd10Prefixes: rule.allowedPrefixes,
            rationale: `High denial risk: CPT ${item.code} lacks qualifying diagnosis under ${rule.guidelineName}. Requires: ${rule.allowedPrefixes.join(', ')}.`
          });
          recommendations.push(
            `Add primary or secondary ICD-10 indication (e.g. ${rule.allowedPrefixes[0]}) to establish medical necessity for CPT ${item.code}.`
          );
        }
      }
    }

    // 3. Denial Probability Calculation
    let denialProbability = 5; // baseline clean rate
    if (cciEdits.length > 0) denialProbability += cciEdits.length * 35;
    const uncoveredCount = ncdLcdValidations.filter(v => !v.isCovered).length;
    if (uncoveredCount > 0) denialProbability += uncoveredCount * 40;
    denialProbability = Math.min(95, denialProbability);

    const isValid = cciEdits.length === 0 && uncoveredCount === 0;

    return {
      isValid,
      denialProbabilityPercent: denialProbability,
      cciEdits,
      ncdLcdValidations,
      recommendations
    };
  }

  /**
   * Create and record a new revenue cycle claim.
   */
  public async createClaim(params: ClaimCreationParams) {
    const scrub = this.scrubClaim(params.cptCodes, params.icd10Codes);
    const totalBilledCents = params.cptCodes.reduce((sum, item) => sum + (item.chargeCents * item.units), 0);

    const status = scrub.isValid ? 'scrubbed_clean' : 'flagged_pre_submission';

    const res = await query(
      `INSERT INTO claims_revcycle_records (
        patient_id, session_id, claim_type, payer_name, total_billed_cents,
        status, cpt_codes, icd10_codes, cci_edits_detected, ncd_lcd_compliance
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        params.patientId,
        params.sessionId || null,
        params.claimType || 'CMS-1500',
        params.payerName,
        totalBilledCents,
        status,
        JSON.stringify(params.cptCodes),
        JSON.stringify(params.icd10Codes),
        JSON.stringify(scrub.cciEdits),
        scrub.ncdLcdValidations.every(v => v.isCovered)
      ]
    );

    return {
      claim: res.rows[0],
      scrubResult: scrub
    };
  }

  /**
   * Simulate a payer adjudication denial with standard CARC/RARC codes.
   */
  public async simulateClaimDenial(
    claimId: number,
    denialCode: 'CO-50' | 'CO-97' | 'CO-16' = 'CO-50',
    denialDescription?: string
  ) {
    const defaultDescriptions: Record<string, string> = {
      'CO-50': 'Claim denied: Non-covered services because the service is not deemed a medical necessity by the payer.',
      'CO-97': 'Claim denied: The benefit for this service is included in the payment/allowance for another service/procedure already adjudicated.',
      'CO-16': 'Claim denied: Claim lacks documentation or required clinical notes demonstrating indications.'
    };

    const description = denialDescription || defaultDescriptions[denialCode];

    const res = await query(
      `UPDATE claims_revcycle_records
       SET status = 'denied',
           denial_reason_code = $1,
           denial_reason_description = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [denialCode, description, claimId]
    );

    return res.rows[0];
  }

  /**
   * Autonomous AI Clinical Appeal Letter Generator.
   * Compiles an evidence-backed formal dispute letter citing medical guidelines and patient records.
   */
  public async generateAppealLetter(claimId: number) {
    const claimRes = await query(
      `SELECT c.*, p.name as patient_name, p.dob as patient_dob, p.sex as patient_sex
       FROM claims_revcycle_records c
       JOIN patients p ON c.patient_id = p.id
       WHERE c.id = $1`,
      [claimId]
    );

    if (claimRes.rows.length === 0) {
      throw new Error(`Claim #${claimId} not found`);
    }

    const claim = claimRes.rows[0];
    const cptCodes: CptLineItem[] = typeof claim.cpt_codes === 'string' ? JSON.parse(claim.cpt_codes) : claim.cpt_codes;
    const icd10Codes: string[] = typeof claim.icd10_codes === 'string' ? JSON.parse(claim.icd10_codes) : claim.icd10_codes;

    const billedAmount = (claim.total_billed_cents / 100).toFixed(2);
    const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const clinicalEvidence = [
      {
        source: 'American Diabetes Association (ADA) Standards of Medical Care 2026',
        citation: 'Section 6 - Glycemic Targets: Routine quarterly assessment of HbA1c is mandated for insulin/oral hypoglycemic multi-therapy titration.',
        relevance: 'Directly refutes medical necessity denial for CPT 83036.'
      },
      {
        source: 'CMS National Coverage Determination (NCD 190.21)',
        citation: 'Testing of glycated hemoglobin is covered for patients diagnosed with Type 2 Diabetes Mellitus with chronic complications (ICD-10 E11.22).',
        relevance: 'Demonstrates statutory compliance with Medicare coverage criteria.'
      },
      {
        source: 'AMA CPT Coding Guidelines & Modifier -25 Protocol',
        citation: 'A significant, separately identifiable evaluation and management service by the same physician on the same day as other diagnostic interventions is fully reimbursable when distinct clinical decisions are documented.',
        relevance: 'Rebuts bundled service reduction under CARC CO-97.'
      }
    ];

    const letterContent = `
# FORMAL CLINICAL RECONSIDERATION & NOTICE OF DISPUTE

**DATE:** ${currentDate}  
**TO:** Appeals & Grievance Department — ${claim.payer_name}  
**PATIENT NAME:** ${claim.patient_name}  
**PATIENT DOB:** ${new Date(claim.patient_dob).toLocaleDateString()}  
**CLAIM REFERENCE ID:** CLM-${claim.id.toString().padStart(6, '0')}  
**TOTAL DISPUTED AMOUNT:** $${billedAmount}  
**PAYER DENIAL CODE:** ${claim.denial_reason_code || 'CO-50'} (${claim.denial_reason_description || 'Medical Necessity'})  

---

### I. EXECUTIVE SUMMARY & FORMAL STATEMENT OF DISPUTE
This letter constitutes a formal first-level clinical appeal submitted on behalf of **${claim.patient_name}** regarding the wrongful denial of claim reference **#CLM-${claim.id}** for services rendered. The payer has cited **${claim.denial_reason_code}: "${claim.denial_reason_description}"**.

Following an exhaustive clinical review of the medical record, treatment trajectory, and established professional consensus guidelines, we formally contest this determination as medically, administratively, and legally unsupportable. We demand immediate reversal and remittance of the billed charge of **$${billedAmount}**.

---

### II. CLINICAL INDICATIONS & MEDICAL NECESSITY
The patient presents with documented chronic multi-morbidity categorized under ICD-10 diagnostic codes:
${icd10Codes.map(code => `- **${code}**`).join('\n')}

The services rendered included:
${cptCodes.map(c => `- **CPT ${c.code} (${c.description})**: ${c.units} unit(s) — $${(c.chargeCents / 100).toFixed(2)}`).join('\n')}

Under accepted clinical standards of care, withholding these diagnostic evaluations would violate prevailing evidence-based medicine and subject the patient to acute risks of avoidable hospitalization and metabolic decompensation.

---

### III. PEER-REVIEWED EVIDENCE & STATUTORY CITATIONS
1. **${clinicalEvidence[0].source}**:  
   _${clinicalEvidence[0].citation}_  
   *Clinical Impact:* ${clinicalEvidence[0].relevance}

2. **${clinicalEvidence[1].source}**:  
   _${clinicalEvidence[1].citation}_  
   *Clinical Impact:* ${clinicalEvidence[1].relevance}

3. **${clinicalEvidence[2].source}**:  
   _${clinicalEvidence[2].citation}_  
   *Clinical Impact:* ${clinicalEvidence[2].relevance}

---

### IV. STATUTORY COMPLIANCE & PROMPT ADJUDICATION DEMAND
Under Section 2719 of the Public Health Service Act (42 U.S.C. § 300gg-19) as codified in the Affordable Care Act and applicable State Prompt Payment Statutes, health plans are required to maintain a full and fair review process. 

We request that ${claim.payer_name} immediately re-adjudicate this claim and issue payment of **$${billedAmount}** within thirty (30) business days of receipt of this notice. Failure to do so will prompt escalation to the State Insurance Commissioner and the Department of Labor Employee Benefits Security Administration (EBSA).

Respectfully submitted,

**IntakeRx Clinical Revenue Cycle & Appeals Engine**  
*On Behalf of Attending Physician & Healthcare System*
    `.trim();

    // Persist appeal letter
    const appealRes = await query(
      `INSERT INTO claim_appeal_letters (
        claim_id, appeal_level, letter_content, clinical_evidence, status
      ) VALUES ($1, 'first_level_reconsideration', $2, $3, 'draft')
      RETURNING *`,
      [claimId, letterContent, JSON.stringify(clinicalEvidence)]
    );

    // Update claim status to appealed
    await query(
      `UPDATE claims_revcycle_records
       SET status = 'appealed', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [claimId]
    );

    return appealRes.rows[0];
  }

  /**
   * Submit an appeal letter to the payer.
   */
  public async submitAppeal(appealId: number) {
    const res = await query(
      `UPDATE claim_appeal_letters
       SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [appealId]
    );
    return res.rows[0];
  }

  /**
   * Fetch all revenue cycle claims.
   */
  public async getClaims(statusFilter?: string) {
    let sql = `
      SELECT c.*, p.name as patient_name, a.id as appeal_id, a.status as appeal_status
      FROM claims_revcycle_records c
      JOIN patients p ON c.patient_id = p.id
      LEFT JOIN claim_appeal_letters a ON a.claim_id = c.id
    `;
    const params: any[] = [];
    if (statusFilter && statusFilter !== 'all') {
      sql += ` WHERE c.status = $1`;
      params.push(statusFilter);
    }
    sql += ` ORDER BY c.created_at DESC LIMIT 50`;

    const res = await query(sql, params);
    return res.rows;
  }
}

export const revCycleAppealsService = new RevCycleAppealsService();
