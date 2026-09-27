import { query } from '../db';

export interface PgxProfileRecord {
  id?: number;
  patientId: number;
  gene: 'CYP2D6' | 'CYP2C19' | 'HLA-B*5701' | 'TPMT' | 'SLCO1B1' | 'DPYD';
  diplotype: string;
  phenotype: 'Poor Metabolizer' | 'Intermediate Metabolizer' | 'Normal Metabolizer' | 'Ultrarapid Metabolizer' | 'Positive (High Risk)' | 'Negative (Standard Risk)';
  testDate?: string;
  labSource?: string;
}

export interface PgxInteractionAlert {
  gene: string;
  drug: string;
  patientDiplotype: string;
  patientPhenotype: string;
  severity: 'CRITICAL_CONTRAINDICATION' | 'DOSAGE_ADJUSTMENT_REQUIRED' | 'EFFICACY_WARNING' | 'INFORMATIONAL';
  cpicLevel: '1A' | '1B' | '2A';
  clinicalImpact: string;
  recommendedAlternative: string;
}

export interface RenalStewardshipAdvice {
  crClMlMin: number;
  renalImpairmentTier: 'Normal (>=90)' | 'Mild (60-89)' | 'Moderate (30-59)' | 'Severe (15-29)' | 'End-Stage (<15)';
  isDoseAdjusted: boolean;
  dosageAdjustmentAdvice: string;
}

export interface AntimicrobialRecommendation {
  infectionSite: string;
  firstLineRegimen: string;
  secondLineRegimen: string;
  antibiogramSusceptibility: string;
  durationDays: number;
  renalAdvice: RenalStewardshipAdvice;
  contraindications: string[];
}

export interface SafetyEvaluationResult {
  sessionId?: string;
  patientId: number;
  crCl: number;
  infectionSite?: string;
  stewardshipAdvice?: AntimicrobialRecommendation;
  pgxAlerts: PgxInteractionAlert[];
  overallSafetyTier: 'SAFE' | 'WARNING' | 'CRITICAL_HAZARD';
}

export class AntimicrobialPgxService {
  /**
   * Cockcroft-Gault Creatinine Clearance Calculator.
   */
  public calculateCrCl(age: number, weightKg: number, serumCrMgDl: number, isFemale: boolean): number {
    if (serumCrMgDl <= 0) return 100;
    const base = ((140 - age) * weightKg) / (72 * serumCrMgDl);
    const crCl = isFemale ? base * 0.85 : base;
    return Math.round(crCl * 10) / 10;
  }

  /**
   * Evaluate empiric antimicrobial therapy based on infection site and renal clearance.
   */
  public getAntimicrobialStewardshipGuidance(
    infectionSite: string,
    crCl: number
  ): AntimicrobialRecommendation {
    let tier: RenalStewardshipAdvice['renalImpairmentTier'] = 'Normal (>=90)';
    if (crCl >= 60 && crCl < 90) tier = 'Mild (60-89)';
    else if (crCl >= 30 && crCl < 60) tier = 'Moderate (30-59)';
    else if (crCl >= 15 && crCl < 30) tier = 'Severe (15-29)';
    else if (crCl < 15) tier = 'End-Stage (<15)';

    const siteUpper = (infectionSite || '').toUpperCase();

    if (siteUpper.includes('UTI') || siteUpper.includes('URINARY') || siteUpper.includes('CYSTITIS')) {
      const nitroContraindicated = crCl < 30;
      return {
        infectionSite: 'Uncomplicated Urinary Tract Infection (Cystitis)',
        firstLineRegimen: nitroContraindicated
          ? 'Fosfomycin tromethamine 3g PO single dose OR Cephalexin 500mg PO QID'
          : 'Nitrofurantoin monohydrate/macrocrystals 100mg PO BID x 5 days',
        secondLineRegimen: 'Trimethoprim-sulfamethoxazole (TMP-SMX) 160/800mg 1 DS tab PO BID x 3 days',
        antibiogramSusceptibility: 'E. coli local susceptibility: Nitrofurantoin 93%, TMP-SMX 78%, Ciprofloxacin 71% (High fluoroquinolone resistance).',
        durationDays: nitroContraindicated ? 1 : 5,
        renalAdvice: {
          crClMlMin: crCl,
          renalImpairmentTier: tier,
          isDoseAdjusted: nitroContraindicated,
          dosageAdjustmentAdvice: nitroContraindicated
            ? 'CONTRAINDICATION: Nitrofurantoin is ineffective and risks peripheral neuropathy when CrCl < 30 mL/min. Switched to Fosfomycin.'
            : 'Standard nitrofurantoin dosing appropriate with CrCl >= 30 mL/min.'
        },
        contraindications: nitroContraindicated ? ['Nitrofurantoin'] : []
      };
    }

    if (siteUpper.includes('PNEUMONIA') || siteUpper.includes('CAP') || siteUpper.includes('LUNG')) {
      const isLevofloxacinAdjusted = crCl < 50;
      return {
        infectionSite: 'Community-Acquired Pneumonia (CAP)',
        firstLineRegimen: 'Ceftriaxone 1g-2g IV once daily PLUS Azithromycin 500mg PO/IV daily',
        secondLineRegimen: isLevofloxacinAdjusted
          ? 'Levofloxacin 750mg PO/IV every 48 hours (Renally Adjusted)'
          : 'Levofloxacin 750mg PO/IV once daily x 5 days',
        antibiogramSusceptibility: 'S. pneumoniae susceptibility: Ceftriaxone 97%, Macrolides 68% (combination mandatory), Levofloxacin 98%.',
        durationDays: 5,
        renalAdvice: {
          crClMlMin: crCl,
          renalImpairmentTier: tier,
          isDoseAdjusted: isLevofloxacinAdjusted,
          dosageAdjustmentAdvice: isLevofloxacinAdjusted
            ? 'If fluoroquinolone used: Levofloxacin requires extension of dosing interval to q48h when CrCl < 50 mL/min to prevent neurotoxicity/tendon rupture.'
            : 'Ceftriaxone requires no renal dose adjustment (dual biliary/renal excretion).'
        },
        contraindications: []
      };
    }

    if (siteUpper.includes('SEPSIS') || siteUpper.includes('SHOCK') || siteUpper.includes('BACTEREMIA')) {
      const cefepimeAdjusted = crCl < 60;
      return {
        infectionSite: 'Hospital Sepsis of Undetermined Source',
        firstLineRegimen: cefepimeAdjusted
          ? `Vancomycin 15-20 mg/kg IV (Trough guided) + Cefepime ${crCl < 30 ? '1g IV q24h' : '2g IV q12h'} (Renally reduced)`
          : 'Vancomycin 15-20 mg/kg IV (AUC/MIC 400-600) + Cefepime 2g IV q8h extended infusion',
        secondLineRegimen: 'Meropenem 1g IV q8h + Daptomycin 8-10 mg/kg IV q24h',
        antibiogramSusceptibility: 'Broad coverage against MRSA, P. aeruginosa (89%), Enterobacterales (94%).',
        durationDays: 7,
        renalAdvice: {
          crClMlMin: crCl,
          renalImpairmentTier: tier,
          isDoseAdjusted: cefepimeAdjusted,
          dosageAdjustmentAdvice: cefepimeAdjusted
            ? 'Cefepime neurotoxicity (encephalopathy/myoclonus) risk: reduce from q8h to q12h or q24h. Vancomycin requires pharmacist therapeutic drug monitoring (TDM).'
            : 'Standard sepsis antipseudomonal beta-lactam dosing indicated.'
        },
        contraindications: []
      };
    }

    // Default: Skin and Soft Tissue / Cellulitis
    return {
      infectionSite: 'Skin and Soft Tissue Infection / Cellulitis',
      firstLineRegimen: 'Cefazolin 1g-2g IV q8h OR Cefalexin 500mg PO QID',
      secondLineRegimen: 'Doxycycline 100mg PO BID (active against community-acquired MRSA)',
      antibiogramSusceptibility: 'MSSA susceptibility: Cefazolin 99%. MRSA local prevalence 22%.',
      durationDays: 5,
      renalAdvice: {
        crClMlMin: crCl,
        renalImpairmentTier: tier,
        isDoseAdjusted: crCl < 50,
        dosageAdjustmentAdvice: crCl < 50 ? 'Cephalexin interval extended to q8h-q12h.' : 'Standard dosing appropriate.'
      },
      contraindications: []
    };
  }

  /**
   * Screen proposed medication list against patient's Pharmacogenomic (PGx) profile.
   */
  public evaluatePgxInteractions(
    proposedMeds: string[],
    profiles: PgxProfileRecord[]
  ): PgxInteractionAlert[] {
    const alerts: PgxInteractionAlert[] = [];
    const medListLower = proposedMeds.map(m => m.toLowerCase());

    const getProfile = (geneName: string) => profiles.find(p => p.gene.toUpperCase() === geneName.toUpperCase());

    // 1. CYP2D6 Checks (Codeine, Tramadol)
    const cyp2d6 = getProfile('CYP2D6');
    if (cyp2d6) {
      const hasCodeine = medListLower.some(m => m.includes('codeine') || m.includes('tylenol #3'));
      const hasTramadol = medListLower.some(m => m.includes('tramadol') || m.includes('ultram'));

      if (hasCodeine || hasTramadol) {
        const drug = hasCodeine ? 'Codeine' : 'Tramadol';
        if (cyp2d6.phenotype.includes('Ultrarapid')) {
          alerts.push({
            gene: 'CYP2D6',
            drug,
            patientDiplotype: cyp2d6.diplotype,
            patientPhenotype: cyp2d6.phenotype,
            severity: 'CRITICAL_CONTRAINDICATION',
            cpicLevel: '1A',
            clinicalImpact: `FDA Black Box Warning: Ultrarapid CYP2D6 metabolizers rapidly bioactivate ${drug} into excessive morphine levels, risking fatal respiratory arrest.`,
            recommendedAlternative: 'Discontinue codeine/tramadol. Use non-CYP2D6 metabolized analgesics such as Hydromorphone, Morphine, or Ketorolac.'
          });
        } else if (cyp2d6.phenotype.includes('Poor')) {
          alerts.push({
            gene: 'CYP2D6',
            drug,
            patientDiplotype: cyp2d6.diplotype,
            patientPhenotype: cyp2d6.phenotype,
            severity: 'EFFICACY_WARNING',
            cpicLevel: '1A',
            clinicalImpact: `Poor metabolizer cannot bioactivate ${drug} into its active analgesic form. Patient will experience lack of pain relief with high risk of pseudo-refractory escalation.`,
            recommendedAlternative: 'Avoid codeine/tramadol. Prescribe non-prodrug analgesics (e.g., Acetaminophen, Ibuprofen, Hydromorphone).'
          });
        }
      }
    }

    // 2. CYP2C19 Checks (Clopidogrel, Voriconazole)
    const cyp2c19 = getProfile('CYP2C19');
    if (cyp2c19) {
      const hasClopidogrel = medListLower.some(m => m.includes('clopidogrel') || m.includes('plavix'));
      if (hasClopidogrel && (cyp2c19.phenotype.includes('Poor') || cyp2c19.phenotype.includes('Intermediate'))) {
        alerts.push({
          gene: 'CYP2C19',
          drug: 'Clopidogrel',
          patientDiplotype: cyp2c19.diplotype,
          patientPhenotype: cyp2c19.phenotype,
          severity: 'CRITICAL_CONTRAINDICATION',
          cpicLevel: '1A',
          clinicalImpact: 'Significantly decreased platelet inhibition and 3-fold higher risk of stent thrombosis and ischemic stroke.',
          recommendedAlternative: 'Switch antiplatelet to alternative P2Y12 inhibitor not dependent on CYP2C19: Prasugrel or Ticagrelor.'
        });
      }

      const hasVoriconazole = medListLower.some(m => m.includes('voriconazole') || m.includes('vfend'));
      if (hasVoriconazole) {
        if (cyp2c19.phenotype.includes('Ultrarapid')) {
          alerts.push({
            gene: 'CYP2C19',
            drug: 'Voriconazole',
            patientDiplotype: cyp2c19.diplotype,
            patientPhenotype: cyp2c19.phenotype,
            severity: 'EFFICACY_WARNING',
            cpicLevel: '1A',
            clinicalImpact: 'Extremely high clearance yields sub-therapeutic voriconazole trough concentrations, causing invasive fungal breakthrough.',
            recommendedAlternative: 'Use Isavuconazole, Posaconazole, or Liposomal Amphotericin B.'
          });
        } else if (cyp2c19.phenotype.includes('Poor')) {
          alerts.push({
            gene: 'CYP2C19',
            drug: 'Voriconazole',
            patientDiplotype: cyp2c19.diplotype,
            patientPhenotype: cyp2c19.phenotype,
            severity: 'DOSAGE_ADJUSTMENT_REQUIRED',
            cpicLevel: '1A',
            clinicalImpact: 'Excessive voriconazole accumulation leads to visual hallucinations, encephalopathy, and severe hepatotoxicity.',
            recommendedAlternative: 'Reduce standard maintenance dose by 50% and mandate weekly therapeutic drug monitoring (TDM).'
          });
        }
      }
    }

    // 3. HLA-B*5701 Checks (Abacavir)
    const hlaB5701 = getProfile('HLA-B*5701');
    if (hlaB5701) {
      const hasAbacavir = medListLower.some(m => m.includes('abacavir') || m.includes('triumeq') || m.includes('epzicom'));
      if (hasAbacavir && (hlaB5701.phenotype.includes('Positive') || hlaB5701.diplotype.toLowerCase().includes('pos'))) {
        alerts.push({
          gene: 'HLA-B*5701',
          drug: 'Abacavir',
          patientDiplotype: hlaB5701.diplotype,
          patientPhenotype: hlaB5701.phenotype,
          severity: 'CRITICAL_CONTRAINDICATION',
          cpicLevel: '1A',
          clinicalImpact: 'Absolute Black Box Contraindication: High risk of severe, life-threatening multi-organ systemic hypersensitivity syndrome.',
          recommendedAlternative: 'Avoid abacavir entirely. Utilize Tenofovir alafenamide (TAF) or Tenofovir disoproxil fumarate (TDF) regimens.'
        });
      }
    }

    // 4. TPMT Checks (Azathioprine, 6-Mercaptopurine)
    const tpmt = getProfile('TPMT');
    if (tpmt) {
      const hasAza = medListLower.some(m => m.includes('azathioprine') || m.includes('imuran') || m.includes('mercaptopurine'));
      if (hasAza && (tpmt.phenotype.includes('Poor') || tpmt.phenotype.includes('Intermediate'))) {
        alerts.push({
          gene: 'TPMT',
          drug: 'Azathioprine / 6-Mercaptopurine',
          patientDiplotype: tpmt.diplotype,
          patientPhenotype: tpmt.phenotype,
          severity: tpmt.phenotype.includes('Poor') ? 'CRITICAL_CONTRAINDICATION' : 'DOSAGE_ADJUSTMENT_REQUIRED',
          cpicLevel: '1A',
          clinicalImpact: 'Severe, life-threatening bone marrow suppression, agranulocytosis, and fatal pancytopenia.',
          recommendedAlternative: tpmt.phenotype.includes('Poor')
            ? 'Switch to non-thiopurine immunosuppressant (e.g. Methotrexate, Mycophenolate mofetil).'
            : 'Reduce standard starting dose by 50-70% and monitor CBC weekly.'
        });
      }
    }

    // 5. SLCO1B1 Checks (Simvastatin)
    const slco1b1 = getProfile('SLCO1B1');
    if (slco1b1) {
      const hasSimva = medListLower.some(m => m.includes('simvastatin') || m.includes('zocor') || m.includes('vytorin'));
      if (hasSimva && (slco1b1.phenotype.includes('Poor') || slco1b1.diplotype.includes('*5'))) {
        alerts.push({
          gene: 'SLCO1B1',
          drug: 'Simvastatin',
          patientDiplotype: slco1b1.diplotype,
          patientPhenotype: slco1b1.phenotype,
          severity: 'DOSAGE_ADJUSTMENT_REQUIRED',
          cpicLevel: '1A',
          clinicalImpact: 'Decreased hepatic statin uptake causes marked systemic statin exposure with high risk of rhabdomyolysis and myopathy.',
          recommendedAlternative: 'Avoid simvastatin >20mg. Prescribe Rosuvastatin or Atorvastatin which have lower dependence on SLCO1B1 transport.'
        });
      }
    }

    return alerts;
  }

  /**
   * Comprehensive evaluation combining renal stewardship and PGx alerts.
   */
  public async evaluatePatientSafety(
    patientId: number,
    sessionId: string | undefined,
    proposedMeds: string[],
    infectionSite: string = 'UTI',
    serumCrMgDl: number = 1.1,
    weightKg: number = 70
  ): Promise<SafetyEvaluationResult> {
    // 1. Fetch patient age and sex
    const patientRes = await query('SELECT dob, sex FROM patients WHERE id = $1', [patientId]);
    let age = 50;
    let isFemale = false;
    if (patientRes.rows.length > 0) {
      const dob = new Date(patientRes.rows[0].dob);
      const diffMs = Date.now() - dob.getTime();
      age = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25)));
      isFemale = (patientRes.rows[0].sex || '').toLowerCase().startsWith('f');
    }

    // 2. Compute CrCl
    const crCl = this.calculateCrCl(age, weightKg, serumCrMgDl, isFemale);

    // 3. Stewardship advice
    const stewardshipAdvice = this.getAntimicrobialStewardshipGuidance(infectionSite, crCl);

    // 4. Fetch PGx Profiles
    const pgxProfiles = await this.getPatientPgxProfiles(patientId);

    // 5. Evaluate PGx alerts
    const pgxAlerts = this.evaluatePgxInteractions(proposedMeds, pgxProfiles);

    // 6. Determine overall tier
    const hasCritical = pgxAlerts.some(a => a.severity === 'CRITICAL_CONTRAINDICATION') ||
      stewardshipAdvice.contraindications.length > 0;
    const hasWarning = pgxAlerts.some(a => a.severity === 'DOSAGE_ADJUSTMENT_REQUIRED' || a.severity === 'EFFICACY_WARNING') ||
      stewardshipAdvice.renalAdvice.isDoseAdjusted;

    const overallSafetyTier: SafetyEvaluationResult['overallSafetyTier'] = hasCritical
      ? 'CRITICAL_HAZARD'
      : hasWarning
      ? 'WARNING'
      : 'SAFE';

    // 7. Persist audit record
    if (sessionId) {
      await query(
        `INSERT INTO antimicrobial_stewardship_audits (
          session_id, patient_id, infection_site, creatinine_clearance,
          prescribed_regimen, stewardship_recommendation, pgx_alerts, approval_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          sessionId,
          patientId,
          infectionSite,
          crCl,
          proposedMeds.join(', '),
          JSON.stringify(stewardshipAdvice),
          JSON.stringify(pgxAlerts),
          hasCritical ? 'flagged_hazard' : 'approved'
        ]
      );
    }

    return {
      sessionId,
      patientId,
      crCl,
      infectionSite,
      stewardshipAdvice,
      pgxAlerts,
      overallSafetyTier
    };
  }

  /**
   * Insert a PGx profile for a patient.
   */
  public async addPatientPgxProfile(profile: PgxProfileRecord) {
    const res = await query(
      `INSERT INTO patient_pgx_profiles (
        patient_id, gene, diplotype, phenotype, lab_source
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        profile.patientId,
        profile.gene,
        profile.diplotype,
        profile.phenotype,
        profile.labSource || 'Standard PGx NGS Panel'
      ]
    );
    return res.rows[0];
  }

  /**
   * Retrieve all PGx profiles for a patient.
   */
  public async getPatientPgxProfiles(patientId: number): Promise<PgxProfileRecord[]> {
    const res = await query(
      `SELECT * FROM patient_pgx_profiles WHERE patient_id = $1 ORDER BY gene ASC`,
      [patientId]
    );
    return res.rows.map(r => ({
      id: r.id,
      patientId: r.patient_id,
      gene: r.gene,
      diplotype: r.diplotype,
      phenotype: r.phenotype,
      testDate: r.test_date,
      labSource: r.lab_source
    }));
  }

  /**
   * Get stewardship audits for an encounter.
   */
  public async getAuditsBySession(sessionId: string) {
    const res = await query(
      `SELECT * FROM antimicrobial_stewardship_audits WHERE session_id = $1 ORDER BY created_at DESC`,
      [sessionId]
    );
    return res.rows;
  }
}

export const antimicrobialPgxService = new AntimicrobialPgxService();
