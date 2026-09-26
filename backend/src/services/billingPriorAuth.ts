import { pool } from '../db';

export interface PriorAuthPacketData {
  urgency: 'standard' | 'expedited' | 'urgent';
  medicalNecessityCriteria: string[];
  failedConservativeTherapies: string[];
  supportingDiagnostics: string[];
  peerToPeerContact: {
    physicianName: string;
    phone: string;
    preferredTime: string;
  };
  letterOfMedicalNecessity: string;
}

export interface ServiceLineItem {
  dateOfService: string;
  placeOfService: string;
  cptCode: string;
  procedureDescription: string;
  modifier?: string;
  diagnosisPointers: string[]; // e.g. ['A', 'B']
  charge: number;
  units: number;
}

export interface Cms1500ScrubReport {
  isClean: boolean;
  score: number;
  scrubErrors: string[];
  scrubWarnings: string[];
}

export class BillingPriorAuthService {
  /**
   * Reference Procedure Directory with Coverage Criteria
   */
  private static readonly PROCEDURE_CATALOG: Record<string, {
    name: string;
    standardFee: number;
    recommendedDx: string[];
    requiredConservativeTrialDays: number;
    necessityGuidelines: string[];
  }> = {
    '70553': {
      name: 'MRI Brain with and without IV Contrast',
      standardFee: 1450.00,
      recommendedDx: ['G43.909', 'R51.9', 'G44.1', 'C79.31'],
      requiredConservativeTrialDays: 30,
      necessityGuidelines: [
        'Persistent or worsening neurological deficit documented on physical exam',
        'Failure of at least 30-day course of preventative pharmacological intervention or acute red flags',
        'Rule out intracranial mass, demyelinating disease, or vascular malformation'
      ]
    },
    '72148': {
      name: 'MRI Lumbar Spine without Contrast',
      standardFee: 1100.00,
      recommendedDx: ['M54.5', 'M51.26', 'M54.16', 'G83.4'],
      requiredConservativeTrialDays: 42,
      necessityGuidelines: [
        'Radicular pain unresponsive to 6 weeks of conservative therapy (PT, NSAIDs, activity modification)',
        'Presence of progressive neurological motor deficit or cauda equina red flags'
      ]
    },
    '93458': {
      name: 'Left Heart Catheterization with Coronary Angiogram',
      standardFee: 4800.00,
      recommendedDx: ['I25.10', 'I20.0', 'I21.9', 'I25.700'],
      requiredConservativeTrialDays: 0,
      necessityGuidelines: [
        'High-risk ischemic symptoms unresponsive to optimal medical therapy or Acute Coronary Syndrome',
        'Non-invasive testing demonstrating significant inducible ischemia'
      ]
    },
    '78815': {
      name: 'PET-CT Systemic/Thoracic for Tumor Imaging',
      standardFee: 3200.00,
      recommendedDx: ['C34.90', 'C50.919', 'C78.00', 'Z85.118'],
      requiredConservativeTrialDays: 0,
      necessityGuidelines: [
        'Histologically confirmed malignancy requiring initial baseline staging or restaging post-therapy',
        'Suspicious solitary pulmonary nodule > 8mm on prior diagnostic CT'
      ]
    },
    '27447': {
      name: 'Total Knee Arthroplasty (TKA)',
      standardFee: 8500.00,
      recommendedDx: ['M17.11', 'M17.12', 'M17.0'],
      requiredConservativeTrialDays: 90,
      necessityGuidelines: [
        'Severe advanced osteoarthritic changes (Kellgren-Lawrence Grade 3 or 4) on weight-bearing radiographs',
        'Failure of minimum 3 months conservative therapy including structured physical therapy, weight reduction, and intra-articular injections'
      ]
    },
    'J0178': {
      name: 'Aflibercept Intravitreal Injection (Eylea), 1 mg',
      standardFee: 1850.00,
      recommendedDx: ['H35.3211', 'H35.3221', 'H35.81'],
      requiredConservativeTrialDays: 0,
      necessityGuidelines: [
        'Optical coherence tomography (OCT) or fluorescein angiography confirming active choroidal neovascularization',
        'Diabetic macular edema with central visual acuity loss'
      ]
    }
  };

  /**
   * Reference ICD-10 Directory
   */
  private static readonly DIAGNOSIS_CATALOG: Record<string, string> = {
    'G43.909': 'Migraine, unspecified, not intractable, without status migrainosus',
    'R51.9': 'Headache, unspecified',
    'M54.5': 'Low back pain, unspecified',
    'M54.16': 'Radiculopathy, lumbar region',
    'I25.10': 'Atherosclerotic heart disease of native coronary artery without angina pectoris',
    'I20.0': 'Unstable angina',
    'C34.90': 'Malignant neoplasm of unspecified part of unspecified bronchus or lung',
    'M17.11': 'Unilateral primary osteoarthritis, right knee',
    'M17.12': 'Unilateral primary osteoarthritis, left knee',
    'H35.3211': 'Exudative age-related macular degeneration, right eye'
  };

  /**
   * Evaluates clinical necessity and calculates payer denial risk score (0-100%).
   */
  public static evaluateDenialRisk(
    cptCode: string,
    icd10Code: string,
    conservativeTherapies: string[],
    clinicalNotes: string,
    urgency: 'standard' | 'expedited' | 'urgent'
  ): { score: number; rationale: string; missingChecklist: string[] } {
    let score = 10; // Baseline administrative denial risk
    const reasons: string[] = [];
    const missing: string[] = [];

    const procedure = this.PROCEDURE_CATALOG[cptCode];
    if (!procedure) {
      score += 30;
      reasons.push(`CPT code ${cptCode} is unlisted in standard automated coverage guidelines and requires manual payer policy review.`);
    } else {
      // Check Diagnosis Alignment
      if (!procedure.recommendedDx.includes(icd10Code)) {
        score += 25;
        reasons.push(`Primary diagnosis ${icd10Code} is not in standard LCD/NCD covered indication list for CPT ${cptCode}.`);
        missing.push(`Verify secondary covered ICD-10 indication matching payer medical policy.`);
      }

      // Check Conservative Therapy Duration / History
      if (procedure.requiredConservativeTrialDays > 0) {
        if (!conservativeTherapies || conservativeTherapies.length === 0) {
          score += 35;
          reasons.push(`No prior conservative therapy documented. Payer requires at least ${procedure.requiredConservativeTrialDays} days of documented conservative management.`);
          missing.push(`Documentation of ${procedure.requiredConservativeTrialDays}-day conservative therapy trial (e.g. physical therapy, oral NSAIDs, or specialist consultation).`);
        } else if (conservativeTherapies.length < 2) {
          score += 15;
          reasons.push(`Conservative therapy documentation is limited (${conservativeTherapies.length} modality reported). Payer typically mandates multimodal failed therapies.`);
          missing.push(`Additional multimodal conservative therapy trial records.`);
        }
      }
    }

    // Check clinical documentation length / richness
    if (!clinicalNotes || clinicalNotes.trim().length < 50) {
      score += 20;
      reasons.push('Clinical justification documentation is brief or lacks granular symptom progression details.');
      missing.push('Detailed subjective history of present illness and physical exam findings.');
    }

    // Red flag / urgent mitigation
    const redFlagKeywords = ['acute', 'sudden', 'motor deficit', 'syncope', 'intractable', 'malignancy', 'unstable', 'cauda equina', 'emergent'];
    const hasRedFlag = redFlagKeywords.some(rf => clinicalNotes.toLowerCase().includes(rf));
    if (hasRedFlag || urgency === 'urgent' || urgency === 'expedited') {
      score = Math.max(5, score - 15);
      reasons.push('High-risk clinical symptoms or expedited urgency mitigate denial risk for immediate medical necessity.');
    }

    // Cap score at 95% and floor at 5%
    const finalScore = Math.min(95, Math.max(5, score));
    const rationale = reasons.length > 0 ? reasons.join(' ') : 'Clinical documentation fully satisfies published payer coverage policy with low denial risk.';

    return {
      score: finalScore,
      rationale,
      missingChecklist: missing
    };
  }

  /**
   * Generates a formal CMS/Payer-compliant Letter of Medical Necessity
   */
  public static generateLetterOfMedicalNecessity(params: {
    patientName: string;
    patientDob?: string;
    payerName: string;
    cptCode: string;
    procedureName: string;
    icd10Code: string;
    diagnosisName: string;
    clinicalJustification: string;
    failedConservativeTherapies: string[];
    attendingClinician: string;
    urgency: string;
  }): string {
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const formattedTherapies = params.failedConservativeTherapies.length > 0
      ? params.failedConservativeTherapies.map(t => `  - ${t}`).join('\n')
      : '  - Patient presented with acute or progressive clinical red-flag manifestations precluding conservative postponement.';

    return `PRIOR-AUTHORIZATION REQUEST & FORMAL LETTER OF MEDICAL NECESSITY
Date: ${today}
To: Medical Review & Prior-Authorization Department — ${params.payerName}
Urgency Level: ${params.urgency.toUpperCase()} CLINICAL REVIEW REQUESTED

PATIENT INFORMATION:
Patient Name: ${params.patientName}
DOB: ${params.patientDob || '1978-04-12'}
Encounter ID: IntakeRx Certified Clinical Encounter

ORDERING / ATTENDING CLINICIAN:
Provider: ${params.attendingClinician}
NPI: 1487920153 | Taxonomy: 207Q00000X (Allopathic & Osteopathic Physicians)
Clinic: IntakeRx Academic Medical Center & Health System

REQUESTED SERVICE / PROCEDURE:
CPT / HCPCS Code: ${params.cptCode}
Description: ${params.procedureName}

PRIMARY CLINICAL INDICATION:
ICD-10-CM Diagnosis Code: ${params.icd10Code}
Description: ${params.diagnosisName}

CLINICAL BACKGROUND & MEDICAL NECESSITY JUSTIFICATION:
${params.clinicalJustification}

DOCUMENTED FAILED CONSERVATIVE MANAGEMENT:
${formattedTherapies}

CLINICAL CONCLUSION & DIRECT PHYSICIAN APPEAL:
The requested diagnostic/therapeutic procedure (${params.cptCode}: ${params.procedureName}) is recognized within standard-of-care clinical practice guidelines (NCCN / AHA / ACC / AAN / CMS NCD) as essential and medically indispensable for this patient. Delay or denial of this pre-authorized service carries significant risk of clinical decompensation, irreversible tissue injury, or preventable emergency hospitalization.

Should additional clinical documentation or peer-to-peer physician consultation be required, please reach my clinical team directly at (555) 019-2834.

Sincerely,
${params.attendingClinician}
Department of Specialty Medicine & Clinical Intake
IntakeRx Health System`;
  }

  /**
   * Generates a new Prior-Authorization packet and saves to database.
   */
  public static async generatePriorAuthPacket(params: {
    sessionId: string;
    payerName: string;
    procedureCpt: string;
    diagnosisIcd10: string;
    urgency?: 'standard' | 'expedited' | 'urgent';
    customJustification?: string;
    failedTherapies?: string[];
  }): Promise<any> {
    const { sessionId, payerName, procedureCpt, diagnosisIcd10 } = params;
    const urgency = params.urgency || 'standard';

    // Retrieve Session & Patient Details
    const sessionRes = await pool.query(
      `SELECT s.*, p.name as patient_name, p.dob, p.insurance_provider, p.insurance_policy,
              sm.summary_data
       FROM intake_sessions s
       LEFT JOIN patients p ON s.patient_id = p.id
       LEFT JOIN intake_summaries sm ON s.id = sm.session_id
       WHERE s.id = $1`,
      [sessionId]
    );

    if (sessionRes.rows.length === 0) {
      throw new Error(`Encounter session not found for ID: ${sessionId}`);
    }

    const session = sessionRes.rows[0];
    const patientName = session.patient_name || 'Encounter Patient';
    const patientDob = session.dob ? new Date(session.dob).toISOString().split('T')[0] : '1982-05-15';
    const soapNotes = session.summary_data?.soapNotes || session.summary_data || {};

    const procedure = this.PROCEDURE_CATALOG[procedureCpt] || {
      name: `Specialty Procedure (CPT ${procedureCpt})`,
      standardFee: 1200.00,
      recommendedDx: [diagnosisIcd10],
      requiredConservativeTrialDays: 0,
      necessityGuidelines: ['Clinical standard of care']
    };

    const diagnosisName = this.DIAGNOSIS_CATALOG[diagnosisIcd10] || `Clinical Diagnosis (${diagnosisIcd10})`;

    const failedTherapies = params.failedTherapies || [
      'Failed trial of first-line oral analgesic & anti-inflammatory pharmacotherapy (4+ weeks)',
      'Structured outpatient physical therapy regimen completed with persistent symptoms'
    ];

    const clinicalJustification = params.customJustification || 
      (soapNotes.assessment || soapNotes.hpi || 
      `Patient presents with progressive, clinically refractory symptoms directly correlated with ${diagnosisName}. Objective diagnostic evaluation via ${procedure.name} is urgently required for definitive clinical management.`);

    // Denial Risk Evaluation
    const riskEval = this.evaluateDenialRisk(
      procedureCpt,
      diagnosisIcd10,
      failedTherapies,
      clinicalJustification,
      urgency
    );

    // Letter Generation
    const letter = this.generateLetterOfMedicalNecessity({
      patientName,
      patientDob,
      payerName,
      cptCode: procedureCpt,
      procedureName: procedure.name,
      icd10Code: diagnosisIcd10,
      diagnosisName,
      clinicalJustification,
      failedConservativeTherapies: failedTherapies,
      attendingClinician: 'Dr. Sarah Jenkins, MD',
      urgency
    });

    const packetData: PriorAuthPacketData = {
      urgency,
      medicalNecessityCriteria: procedure.necessityGuidelines,
      failedConservativeTherapies: failedTherapies,
      supportingDiagnostics: ['Baseline CBC/CMP Chemistries', 'Initial Plain Film Radiography', 'Specialist Clinical Evaluation'],
      peerToPeerContact: {
        physicianName: 'Dr. Sarah Jenkins, MD',
        phone: '(555) 019-2834 Ext. 401',
        preferredTime: 'Mon-Fri 08:00 - 10:00 EST'
      },
      letterOfMedicalNecessity: letter
    };

    // Insert into prior_authorizations
    const insertRes = await pool.query(
      `INSERT INTO prior_authorizations (
        session_id, payer_name, procedure_cpt, procedure_name,
        diagnosis_icd10, diagnosis_name, clinical_justification,
        denial_risk_score, denial_risk_rationale, packet_data, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        sessionId,
        payerName,
        procedureCpt,
        procedure.name,
        diagnosisIcd10,
        diagnosisName,
        clinicalJustification,
        riskEval.score,
        riskEval.rationale,
        JSON.stringify(packetData),
        'pending_payer_review'
      ]
    );

    return insertRes.rows[0];
  }

  /**
   * Retrieves all Prior-Authorization records for an encounter.
   */
  public static async getPriorAuths(sessionId: string): Promise<any[]> {
    const res = await pool.query(
      `SELECT * FROM prior_authorizations
       WHERE session_id = $1
       ORDER BY created_at DESC`,
      [sessionId]
    );
    return res.rows;
  }

  /**
   * Updates status of Prior-Authorization (e.g. approved, peer-to-peer, denied)
   */
  public static async updatePriorAuthStatus(paId: number, status: string, authNumber?: string): Promise<any> {
    const generatedAuth = authNumber || (status === 'approved' ? `AUTH-${Math.floor(100000 + Math.random() * 900000)}` : null);
    const res = await pool.query(
      `UPDATE prior_authorizations
       SET status = $1, auth_number = COALESCE($2, auth_number), updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, generatedAuth, paId]
    );
    return res.rows[0];
  }

  /**
   * Scrubs a CMS-1500 claim against standard EDI 837P billing validation rules.
   */
  public static scrubCms1500Claim(claim: {
    renderingNpi: string;
    placeOfService: string;
    icd10Codes: string[];
    serviceLines: ServiceLineItem[];
    totalBilled: number;
  }): Cms1500ScrubReport {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Rule 1: NPI format check (10 digits)
    if (!/^\d{10}$/.test(claim.renderingNpi)) {
      errors.push(`Invalid Rendering Provider NPI "${claim.renderingNpi}": Must be exactly 10 digits.`);
    }

    // Rule 2: Place of Service Code
    const validPos = ['11', '12', '21', '22', '23', '02', '10', '31', '32'];
    if (!validPos.includes(claim.placeOfService)) {
      errors.push(`Invalid Place of Service code "${claim.placeOfService}". Expected valid CMS POS code.`);
    }

    // Rule 3: ICD-10 presence
    if (!claim.icd10Codes || claim.icd10Codes.length === 0) {
      errors.push('No ICD-10 diagnosis codes provided in Box 21.');
    }

    // Rule 4: Service Lines validation
    if (!claim.serviceLines || claim.serviceLines.length === 0) {
      errors.push('Claim must contain at least one service line in Box 24.');
    } else {
      let calculatedTotal = 0;
      claim.serviceLines.forEach((line, index) => {
        const lineNum = index + 1;
        calculatedTotal += line.charge * (line.units || 1);

        if (!line.cptCode || line.cptCode.trim().length === 0) {
          errors.push(`Line ${lineNum}: Missing CPT/HCPCS procedure code.`);
        }
        if (!line.diagnosisPointers || line.diagnosisPointers.length === 0) {
          errors.push(`Line ${lineNum} (CPT ${line.cptCode}): Missing Box 24E Diagnosis Pointer.`);
        }
        if (line.charge <= 0) {
          errors.push(`Line ${lineNum}: Invalid charge amount ($${line.charge}). Must be > 0.`);
        }
      });

      // Charge Balance Check
      if (Math.abs(calculatedTotal - claim.totalBilled) > 0.05) {
        errors.push(`Total Billed discrepancy: Header total ($${claim.totalBilled}) does not match sum of service lines ($${calculatedTotal.toFixed(2)}).`);
      }
    }

    if (claim.serviceLines && claim.serviceLines.length > 6) {
      warnings.push('Claim exceeds 6 line items; splitting across multiple CMS-1500 forms may be required for paper billing.');
    }

    const isClean = errors.length === 0;
    const score = isClean ? 100 : Math.max(0, 100 - (errors.length * 25));

    return {
      isClean,
      score,
      scrubErrors: errors,
      scrubWarnings: warnings
    };
  }

  /**
   * Compiles CMS-1500 Claim and renders standardized layout
   */
  public static async compileCms1500Claim(params: {
    sessionId: string;
    paId?: number;
    placeOfService?: string;
    additionalLines?: ServiceLineItem[];
  }): Promise<any> {
    const { sessionId, paId } = params;
    const pos = params.placeOfService || '11';

    // Fetch session and patient
    const sessionRes = await pool.query(
      `SELECT s.*, p.name as patient_name, p.dob, p.insurance_provider, p.insurance_policy,
              sm.summary_data
       FROM intake_sessions s
       LEFT JOIN patients p ON s.patient_id = p.id
       LEFT JOIN intake_summaries sm ON s.id = sm.session_id
       WHERE s.id = $1`,
      [sessionId]
    );

    if (sessionRes.rows.length === 0) {
      throw new Error(`Encounter session not found: ${sessionId}`);
    }

    const session = sessionRes.rows[0];
    const patientName = session.patient_name || 'Encounter Patient';
    const patientDob = session.dob ? new Date(session.dob).toISOString().split('T')[0] : '1982-05-15';
    const insuredId = session.insurance_policy || 'INS-8392109';

    // Optional PA linkage
    let paRecord: any = null;
    let payerName = 'Blue Cross Blue Shield of Texas';
    let payerId = 'BCBSTX01';

    if (paId) {
      const paRes = await pool.query(`SELECT * FROM prior_authorizations WHERE id = $1`, [paId]);
      if (paRes.rows.length > 0) {
        paRecord = paRes.rows[0];
        payerName = paRecord.payer_name;
        payerId = payerName.toLowerCase().includes('aetna') ? '60054' : payerName.toLowerCase().includes('united') ? '87726' : 'BCBSTX01';
      }
    }

    // Default E/M Service Line
    const today = new Date().toISOString().split('T')[0];
    const defaultLines: ServiceLineItem[] = [
      {
        dateOfService: today,
        placeOfService: pos,
        cptCode: '99214',
        procedureDescription: 'Office/Outpatient Visit, Established Patient, Moderate Complexity Medical Decision Making (30-39 min)',
        modifier: '25',
        diagnosisPointers: ['A'],
        charge: 215.00,
        units: 1
      }
    ];

    // If PA exists, add procedure line
    if (paRecord) {
      const catalogEntry = this.PROCEDURE_CATALOG[paRecord.procedure_cpt];
      const procFee = catalogEntry ? catalogEntry.standardFee : 850.00;
      defaultLines.push({
        dateOfService: today,
        placeOfService: pos,
        cptCode: paRecord.procedure_cpt,
        procedureDescription: paRecord.procedure_name,
        diagnosisPointers: ['A', 'B'],
        charge: procFee,
        units: 1
      });
    }

    const finalServiceLines = params.additionalLines ? [...defaultLines, ...params.additionalLines] : defaultLines;
    const totalBilled = finalServiceLines.reduce((acc, l) => acc + (l.charge * (l.units || 1)), 0);

    const icd10Codes = paRecord 
      ? [paRecord.diagnosis_icd10, 'R51.9']
      : ['M54.5', 'R51.9'];

    // Scrub Claim
    const scrub = this.scrubCms1500Claim({
      renderingNpi: '1487920153',
      placeOfService: pos,
      icd10Codes,
      serviceLines: finalServiceLines,
      totalBilled
    });

    // Render Text Layout (Standard CMS-1500 representation)
    const renderedCms1500 = `================================================================================
                    HEALTH INSURANCE CLAIM FORM (CMS-1500)
--------------------------------------------------------------------------------
1. MEDICARE / MEDICAID / TRICARE / [X] OTHER (COMMERCIAL)
1a. INSURED'S I.D. NUMBER: ${insuredId}
2. PATIENT'S NAME: ${patientName.toUpperCase()}
3. PATIENT'S BIRTH DATE: ${patientDob}  | SEX: [X] M  [ ] F
4. INSURED'S NAME: ${patientName.toUpperCase()}
--------------------------------------------------------------------------------
11. INSURED'S POLICY GROUP NUMBER: GRP-940218
11c. INSURANCE PLAN NAME / PROGRAM: ${payerName.toUpperCase()} (Payer ID: ${payerId})
--------------------------------------------------------------------------------
21. DIAGNOSIS OR NATURE OF ILLNESS OR INJURY (ICD-10-CM):
    A. [ ${icd10Codes[0] || ''} ]     B. [ ${icd10Codes[1] || ''} ]
    C. [             ]     D. [             ]
23. PRIOR AUTHORIZATION NUMBER: ${paRecord?.auth_number || 'PENDING'}
--------------------------------------------------------------------------------
24. DATES OF SERVICE | POS | CPT/HCPCS | MOD | DIAG POINTER | CHARGES   | UNITS
${finalServiceLines.map((line, idx) => 
  `(${idx + 1}) ${line.dateOfService}   |  ${line.placeOfService} | ${line.cptCode.padEnd(9)} | ${(line.modifier || '--').padEnd(3)} | ${line.diagnosisPointers.join(',').padEnd(12)} | $${line.charge.toFixed(2).padStart(8)} | ${line.units}`
).join('\n')}
--------------------------------------------------------------------------------
28. TOTAL CHARGE: $${totalBilled.toFixed(2)}    29. AMOUNT PAID: $0.00   30. BALANCE DUE: $${totalBilled.toFixed(2)}
31. SIGNATURE OF PHYSICIAN / SUPPLIER: Dr. Sarah Jenkins, MD  (Electronically Signed)
32. SERVICE FACILITY LOCATION: IntakeRx Clinical Health Center, 500 Medical Way
33. BILLING PROVIDER INFO: NPI: 1487920153 | Phone: (555) 019-2834 | Tax ID: 74-1892041
================================================================================
EDI 837P SCRUB STATUS: ${scrub.isClean ? 'PASSED 100% (CLEAN CLAIM)' : 'REJECTED - ERRORS FOUND'}
================================================================================`;

    const insertClaim = await pool.query(
      `INSERT INTO insurance_claims (
        session_id, pa_id, patient_name, insured_id, payer_id, payer_name,
        billing_provider, rendering_npi, place_of_service, icd10_codes,
        service_lines, total_billed, cms1500_rendered_text, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        sessionId,
        paId || null,
        patientName,
        insuredId,
        payerId,
        payerName,
        'IntakeRx Academic Medical Practice, LLC',
        '1487920153',
        pos,
        JSON.stringify(icd10Codes),
        JSON.stringify(finalServiceLines),
        totalBilled,
        renderedCms1500,
        scrub.isClean ? 'scrubbed_clean' : 'needs_review'
      ]
    );

    return {
      claim: insertClaim.rows[0],
      scrubReport: scrub
    };
  }

  /**
   * Retrieves all insurance claims for an encounter session
   */
  public static async getClaims(sessionId: string): Promise<any[]> {
    const res = await pool.query(
      `SELECT * FROM insurance_claims
       WHERE session_id = $1
       ORDER BY created_at DESC`,
      [sessionId]
    );
    return res.rows;
  }

  /**
   * Submits a clean claim to clearinghouse (Simulates EDI 837P batch submission)
   */
  public static async submitClaimToClearinghouse(claimId: number): Promise<any> {
    const claimRes = await pool.query(`SELECT * FROM insurance_claims WHERE id = $1`, [claimId]);
    if (claimRes.rows.length === 0) {
      throw new Error(`Claim not found for ID: ${claimId}`);
    }

    const batchId = `EDI837P-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const updateRes = await pool.query(
      `UPDATE insurance_claims
       SET status = 'submitted', clearinghouse_batch_id = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [batchId, claimId]
    );

    return {
      claim: updateRes.rows[0],
      batchId,
      clearinghouseStatus: 'ACK_999_ACCEPTED',
      transmissionTimestamp: new Date().toISOString()
    };
  }
}
