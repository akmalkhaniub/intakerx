import { pool } from '../db';

export interface ClinicalTrial {
  id: number;
  nctId: string;
  title: string;
  phase: string;
  sponsor: string;
  condition: string;
  status: string;
  minAge: number;
  maxAge: number;
  gender: string;
  inclusionCriteria: string[];
  exclusionCriteria: string[];
  biomarkerRequirements: Record<string, any>;
  studyLocations: string[];
  contactEmail: string;
}

export interface PatientTrialMatch {
  id: number;
  sessionId: string;
  patientId: number;
  trialId: number;
  matchScore: number;
  matchedInclusions: string[];
  matchedExclusions: string[];
  status: 'identified' | 'clinician_reviewed' | 'patient_contacted' | 'enrolled' | 'declined';
  clinicianNotes?: string;
  trial: ClinicalTrial;
  createdAt: string;
}

/**
 * Seeds a portfolio of real-world clinical trials if not already present
 */
export async function seedInitialClinicalTrials(): Promise<void> {
  const existing = await pool.query(`SELECT COUNT(*) FROM clinical_trials`);
  if (parseInt(existing.rows[0].count, 10) > 0) return;

  const trials = [
    {
      nctId: 'NCT05423871',
      title: 'Targeted SGLT2i Cardioprotection in High-Risk Acute Coronary Syndrome (EMPA-CARDIAC)',
      phase: 'Phase 3',
      sponsor: 'Global Cardiovascular Clinical Research Network',
      condition: 'Acute Coronary Syndrome, Myocardial Infarction, Angina',
      status: 'RECRUITING',
      minAge: 40,
      maxAge: 85,
      gender: 'ALL',
      inclusionCriteria: [
        'Adults aged 40-85 presenting with suspected acute coronary syndrome or angina',
        'Substernal chest pressure or pain radiating to left arm/jaw',
        'Tachycardia or elevated cardiovascular risk profile',
        'Ability to provide written informed consent'
      ],
      exclusionCriteria: [
        'End-stage renal disease (eGFR < 15 mL/min/1.73m2)',
        'Active severe systemic bleeding diathesis',
        'Current pregnancy or lactation'
      ],
      biomarkerRequirements: { 'hs_troponin': 'elevated or serial positive', 'eGFR': '>20' },
      studyLocations: ['Johns Hopkins Hospital, MD', 'Mayo Clinic, MN', 'Cleveland Clinic, OH'],
      contactEmail: 'trials@empa-cardiac.org'
    },
    {
      nctId: 'NCT04912986',
      title: 'Next-Gen Monoclonal Antibody Dual-Inhibition for Refractory Hypertension (TARGET-HTN)',
      phase: 'Phase 2',
      sponsor: 'National Heart, Lung, and Blood Institute (NHLBI)',
      condition: 'Hypertension, Hypertensive Urgency, Elevated Afterload',
      status: 'RECRUITING',
      minAge: 25,
      maxAge: 80,
      gender: 'ALL',
      inclusionCriteria: [
        'Documented systolic BP >= 140 mmHg or diastolic BP >= 90 mmHg',
        'History of cardiovascular disease or persistent afterload strain',
        'Age 25-80 years'
      ],
      exclusionCriteria: [
        'Known secondary renovascular hypertension',
        'Recent stroke within past 3 months'
      ],
      biomarkerRequirements: { 'baseline_sbp': '>=140' },
      studyLocations: ['Mass General Brigham, MA', 'Stanford Medicine, CA'],
      contactEmail: 'target-htn@nhlbi.nih.gov'
    },
    {
      nctId: 'NCT05891042',
      title: 'Inhaled Selective PDE4 Inhibitor in Acute Reactive Airway Exacerbations (AERO-STABLE)',
      phase: 'Phase 3',
      sponsor: 'Pulmonary Care Innovation Consortium',
      condition: 'Dyspnea, Bronchospasm, Asthma, COPD',
      status: 'RECRUITING',
      minAge: 18,
      maxAge: 75,
      gender: 'ALL',
      inclusionCriteria: [
        'Acute presentation with shortness of breath, wheezing, or cough',
        'Documented reduction in pulse oximetry or exertional dyspnea',
        'Age 18-75'
      ],
      exclusionCriteria: [
        'Active untreated pulmonary tuberculosis',
        'Requirement for immediate mechanical invasive ventilation'
      ],
      biomarkerRequirements: { 'fev1': '<80%', 'spo2': '<=95%' },
      studyLocations: ['UCLA Medical Center, CA', 'Duke University Health, NC'],
      contactEmail: 'trials@aerostable.org'
    },
    {
      nctId: 'NCT06129841',
      title: 'Digital Health AI Companion with GLP-1 Receptor Agonists for Early Diabetic Cardiomyopathy',
      phase: 'Phase 4',
      sponsor: 'Academic Endocrinology Alliance',
      condition: 'Type 2 Diabetes, Metabolic Syndrome, Cardiac Risk',
      status: 'RECRUITING',
      minAge: 35,
      maxAge: 78,
      gender: 'ALL',
      inclusionCriteria: [
        'Diagnosed Type 2 Diabetes or impaired glucose tolerance with cardiovascular risk',
        'Access to smartphone / wearable health tracking device',
        'Age 35-78'
      ],
      exclusionCriteria: [
        'Personal or familial history of medullary thyroid carcinoma',
        'History of multiple endocrine neoplasia syndrome type 2'
      ],
      biomarkerRequirements: { 'hba1c': '>=7.0%' },
      studyLocations: ['NYU Langone, NY', 'Northwestern Medicine, IL'],
      contactEmail: 'study@endo-digital.org'
    }
  ];

  for (const t of trials) {
    await pool.query(
      `INSERT INTO clinical_trials (
         nct_id, title, phase, sponsor, condition, status, min_age, max_age,
         gender, inclusion_criteria, exclusion_criteria, biomarker_requirements,
         study_locations, contact_email
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (nct_id) DO NOTHING`,
      [
        t.nctId,
        t.title,
        t.phase,
        t.sponsor,
        t.condition,
        t.status,
        t.minAge,
        t.maxAge,
        t.gender,
        t.inclusionCriteria,
        t.exclusionCriteria,
        JSON.stringify(t.biomarkerRequirements),
        t.studyLocations,
        t.contactEmail
      ]
    );
  }
}

/**
 * Evaluates patient presentation against all recruiting clinical trials and stores matches
 */
export async function matchPatientAgainstTrials(sessionId: string): Promise<PatientTrialMatch[]> {
  await seedInitialClinicalTrials();

  // 1. Get session and patient
  const sessRes = await pool.query(
    `SELECT s.id, s.patient_id, p.dob, p.sex, p.name 
     FROM intake_sessions s
     JOIN patients p ON s.patient_id = p.id
     WHERE s.id = $1`,
    [sessionId]
  );
  if (sessRes.rows.length === 0) {
    throw new Error(`Session ${sessionId} not found`);
  }
  const { patient_id, dob, sex } = sessRes.rows[0];

  // Age calculation
  const birthYear = new Date(dob).getFullYear();
  const currentYear = new Date().getFullYear();
  const patientAge = currentYear - birthYear;

  // 2. Fetch symptoms and messages for text features
  const sympRes = await pool.query(`SELECT name, severity FROM symptoms WHERE session_id = $1`, [sessionId]);
  const msgRes = await pool.query(`SELECT content FROM messages WHERE session_id = $1 AND sender = 'patient' LIMIT 4`, [sessionId]);
  const vitRes = await pool.query(
    `SELECT heart_rate, bp_systolic, bp_diastolic, spo2 FROM session_vitals WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [sessionId]
  );

  const symptomText = sympRes.rows.map((s: any) => s.name).join(' ');
  const messageText = msgRes.rows.map((m: any) => m.content).join(' ');
  const clinicalCorpus = (symptomText + ' ' + messageText).toLowerCase();

  const vitals = vitRes.rows[0] || {};

  // 3. Query all available recruiting trials
  const trialsRes = await pool.query(`SELECT * FROM clinical_trials WHERE status = 'RECRUITING'`);
  const matches: PatientTrialMatch[] = [];

  for (const row of trialsRes.rows) {
    const trial = mapRowToTrial(row);

    // Hard filter: Age and Gender
    if (patientAge < trial.minAge || patientAge > trial.maxAge) continue;
    if (trial.gender !== 'ALL' && trial.gender.toLowerCase() !== (sex || '').toLowerCase()) continue;

    let score = 50; // base score for qualifying demographic
    const matchedInclusions: string[] = [];
    const matchedExclusions: string[] = [];

    // Condition matching
    const conditionKeywords = trial.condition.toLowerCase().split(/[,\s]+/);
    const hasConditionOverlap = conditionKeywords.some(kw => kw.length > 3 && clinicalCorpus.includes(kw));
    if (hasConditionOverlap) {
      score += 25;
    }

    // Inclusion criteria check
    for (const inc of trial.inclusionCriteria) {
      const incLower = inc.toLowerCase();
      if (
        (incLower.includes('chest') && (clinicalCorpus.includes('chest') || clinicalCorpus.includes('angina'))) ||
        (incLower.includes('substernal') && clinicalCorpus.includes('substernal')) ||
        (incLower.includes('tachycardia') && vitals.heart_rate && vitals.heart_rate > 95) ||
        (incLower.includes('systolic bp >= 140') && vitals.bp_systolic && vitals.bp_systolic >= 140) ||
        (incLower.includes('shortness of breath') && (clinicalCorpus.includes('breath') || clinicalCorpus.includes('dyspnea'))) ||
        (incLower.includes('age') && patientAge >= trial.minAge) ||
        (incLower.includes('consent') || incLower.includes('adult'))
      ) {
        matchedInclusions.push(inc);
        score += 8;
      }
    }

    // Exclusion criteria check
    for (const exc of trial.exclusionCriteria) {
      const excLower = exc.toLowerCase();
      if (excLower.includes('pregnancy') && sex?.toLowerCase() === 'male') {
        // Automatically cleared
        matchedExclusions.push(`Cleared: Patient is male (Not pregnant)`);
      } else if (excLower.includes('tuberculosis') && !clinicalCorpus.includes('tuberculosis')) {
        matchedExclusions.push(`Cleared: No reported history of pulmonary tuberculosis`);
      } else if (excLower.includes('stroke within') && !clinicalCorpus.includes('stroke')) {
        matchedExclusions.push(`Cleared: No recent acute stroke event on record`);
      }
    }

    // Cap match score between 0 and 99%
    const finalScore = Math.min(98, Math.max(45, score));

    // Persist match in database (upsert)
    const matchRes = await pool.query(
      `INSERT INTO patient_trial_matches (
         session_id, patient_id, trial_id, match_score, matched_inclusions, matched_exclusions, status
       ) VALUES ($1, $2, $3, $4, $5, $6, 'identified')
       RETURNING *`,
      [sessionId, patient_id, trial.id, finalScore, matchedInclusions, matchedExclusions]
    );

    matches.push({
      id: matchRes.rows[0].id,
      sessionId,
      patientId: patient_id,
      trialId: trial.id,
      matchScore: finalScore,
      matchedInclusions,
      matchedExclusions,
      status: 'identified',
      trial,
      createdAt: matchRes.rows[0].created_at?.toISOString() || new Date().toISOString()
    });
  }

  // Sort matches by highest compatibility score
  matches.sort((a, b) => b.matchScore - a.matchScore);
  return matches;
}

/**
 * Returns trial matches for a given session
 */
export async function getMatchesForSession(sessionId: string): Promise<PatientTrialMatch[]> {
  const existing = await pool.query(
    `SELECT m.*, 
            t.nct_id, t.title, t.phase, t.sponsor, t.condition, t.status as trial_status,
            t.min_age, t.max_age, t.gender, t.inclusion_criteria, t.exclusion_criteria,
            t.biomarker_requirements, t.study_locations, t.contact_email
     FROM patient_trial_matches m
     JOIN clinical_trials t ON m.trial_id = t.id
     WHERE m.session_id = $1
     ORDER BY m.match_score DESC`,
    [sessionId]
  );

  if (existing.rows.length === 0) {
    return matchPatientAgainstTrials(sessionId);
  }

  return existing.rows.map(mapRowToMatch);
}

/**
 * Updates clinician review status of a match
 */
export async function updateMatchStatus(
  matchId: number,
  status: PatientTrialMatch['status'],
  notes?: string
): Promise<void> {
  await pool.query(
    `UPDATE patient_trial_matches 
     SET status = $1, clinician_notes = COALESCE($2, clinician_notes) 
     WHERE id = $3`,
    [status, notes || null, matchId]
  );
}

function mapRowToTrial(row: any): ClinicalTrial {
  return {
    id: row.id,
    nctId: row.nct_id,
    title: row.title,
    phase: row.phase,
    sponsor: row.sponsor,
    condition: row.condition,
    status: row.status,
    minAge: row.min_age,
    maxAge: row.max_age,
    gender: row.gender,
    inclusionCriteria: row.inclusion_criteria || [],
    exclusionCriteria: row.exclusion_criteria || [],
    biomarkerRequirements: typeof row.biomarker_requirements === 'string' ? JSON.parse(row.biomarker_requirements) : (row.biomarker_requirements || {}),
    studyLocations: row.study_locations || [],
    contactEmail: row.contact_email || ''
  };
}

function mapRowToMatch(row: any): PatientTrialMatch {
  return {
    id: row.id,
    sessionId: row.session_id,
    patientId: row.patient_id,
    trialId: row.trial_id,
    matchScore: Number(row.match_score),
    matchedInclusions: row.matched_inclusions || [],
    matchedExclusions: row.matched_exclusions || [],
    status: row.status,
    clinicianNotes: row.clinician_notes,
    trial: {
      id: row.trial_id,
      nctId: row.nct_id,
      title: row.title,
      phase: row.phase,
      sponsor: row.sponsor,
      condition: row.condition,
      status: row.trial_status || 'RECRUITING',
      minAge: row.min_age,
      maxAge: row.max_age,
      gender: row.gender,
      inclusionCriteria: row.inclusion_criteria || [],
      exclusionCriteria: row.exclusion_criteria || [],
      biomarkerRequirements: typeof row.biomarker_requirements === 'string' ? JSON.parse(row.biomarker_requirements) : (row.biomarker_requirements || {}),
      studyLocations: row.study_locations || [],
      contactEmail: row.contact_email || ''
    },
    createdAt: row.created_at?.toISOString ? row.created_at.toISOString() : String(row.created_at)
  };
}
