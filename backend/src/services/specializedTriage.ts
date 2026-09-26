import { pool } from '../db';
import { notificationBus } from '../notifications';

export interface PewsCriteria {
  behavior: 0 | 1 | 2 | 3;
  cardiovascular: 0 | 1 | 2 | 3;
  respiratory: 0 | 1 | 2 | 3;
  nebulizerFrequent?: boolean; // +2
  persistentVomitingPostOp?: boolean; // +2
}

export interface PewsResult {
  totalScore: number;
  riskTier: 'LOW' | 'MEDIUM' | 'HIGH';
  color: string;
  escalationAction: string;
  subscores: {
    behavior: number;
    cardiovascular: number;
    respiratory: number;
    extras: number;
  };
}

export interface MorseCriteria {
  historyOfFalls: boolean; // 25
  secondaryDiagnosis: boolean; // 15
  ambulatoryAid: 'none_bedrest' | 'crutches_cane_walker' | 'furniture_support'; // 0, 15, 30
  ivSalineLock: boolean; // 20
  gait: 'normal_bedrest' | 'weak' | 'impaired_hesitant'; // 0, 10, 20
  mentalStatus: 'knows_own_limits' | 'overestimates_or_forgets'; // 0, 15
}

export interface MorseResult {
  totalScore: number;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH';
  precautions: string[];
}

export interface GeriatricScreenResult {
  deliriumDetected: boolean;
  deliriumRationale?: string;
  frailtyScore: number; // 1 to 9 (Clinical Frailty Scale)
  frailtyCategory: string;
  atypicalPresentationFlags: string[];
  clinicalAlerts: string[];
}

export interface CaregiverProxyData {
  proxyName: string;
  relationship: string;
  phone: string;
  email?: string;
  accessLevel?: 'full' | 'intake_only' | 'view_only';
  consentVerified?: boolean;
}

export class SpecializedTriageService {
  /**
   * Calculates Pediatric Early Warning Score (PEWS)
   */
  public static calculatePews(criteria: PewsCriteria): PewsResult {
    let extras = 0;
    if (criteria.nebulizerFrequent) extras += 2;
    if (criteria.persistentVomitingPostOp) extras += 2;

    const totalScore = criteria.behavior + criteria.cardiovascular + criteria.respiratory + extras;

    let riskTier: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    let color = '#10b981'; // Green
    let escalationAction = 'Standard pediatric observations every 4 hours. Patient clinically stable.';

    if (totalScore >= 5) {
      riskTier = 'HIGH';
      color = '#ef4444'; // Red
      escalationAction = '🚨 STAT CRITICAL: Activate Pediatric Rapid Response Team (PRRT). Urgent pediatric intensivist bedside evaluation.';
    } else if (totalScore >= 3) {
      riskTier = 'MEDIUM';
      color = '#f59e0b'; // Amber
      escalationAction = '⚠️ MEDIUM RISK: Notify pediatric charge nurse and on-call resident. Increase observations to Q1H.';
    }

    return {
      totalScore,
      riskTier,
      color,
      escalationAction,
      subscores: {
        behavior: criteria.behavior,
        cardiovascular: criteria.cardiovascular,
        respiratory: criteria.respiratory,
        extras
      }
    };
  }

  /**
   * Calculates Morse Fall Risk Score for Geriatric & Vulnerable Patients
   */
  public static calculateMorseFallRisk(criteria: MorseCriteria): MorseResult {
    let score = 0;

    // 1. History of falling
    if (criteria.historyOfFalls) score += 25;

    // 2. Secondary diagnosis
    if (criteria.secondaryDiagnosis) score += 15;

    // 3. Ambulatory aid
    if (criteria.ambulatoryAid === 'furniture_support') score += 30;
    else if (criteria.ambulatoryAid === 'crutches_cane_walker') score += 15;

    // 4. IV or Saline Lock
    if (criteria.ivSalineLock) score += 20;

    // 5. Gait
    if (criteria.gait === 'impaired_hesitant') score += 20;
    else if (criteria.gait === 'weak') score += 10;

    // 6. Mental status
    if (criteria.mentalStatus === 'overestimates_or_forgets') score += 15;

    let riskLevel: 'LOW' | 'MODERATE' | 'HIGH' = 'LOW';
    const precautions: string[] = ['Standard orientation to environment', 'Call light positioned within reach'];

    if (score >= 51) {
      riskLevel = 'HIGH';
      precautions.push(
        'Red Fall-Risk Identification Band',
        'Bed alarm / chair pressure sensor engaged',
        'Low-height bed positioned with floor landing mat',
        'Direct 1-to-1 assisted ambulation for all transfers',
        'Physical therapy evaluation for mobility assistive devices'
      );
    } else if (score >= 25) {
      riskLevel = 'MODERATE';
      precautions.push(
        'Yellow Fall-Risk Identification Band',
        'Assisted transfers and ambulation required',
        'Non-skid safety footwear verified'
      );
    }

    return {
      totalScore: score,
      riskLevel,
      precautions
    };
  }

  /**
   * Evaluates Atypical Geriatric Presentations, Delirium, and Frailty
   */
  public static screenGeriatricSyndromes(params: {
    age?: number;
    chiefComplaint?: string;
    symptoms?: string[];
    history?: string[];
    vitalSigns?: any;
    hasAcuteConfusion?: boolean;
    cfsScore?: number;
  }): GeriatricScreenResult {
    const { chiefComplaint = '', symptoms = [], hasAcuteConfusion, cfsScore = 3 } = params;
    const combinedText = `${chiefComplaint} ${symptoms.join(' ')}`.toLowerCase();
    const atypicalFlags: string[] = [];
    const alerts: string[] = [];

    // Screen 1: Atypical UTI / Occult Sepsis
    if (combinedText.includes('confusion') || combinedText.includes('fall') || combinedText.includes('weakness') || hasAcuteConfusion) {
      if (!combinedText.includes('dysuria') && !combinedText.includes('fever')) {
        atypicalFlags.push('Atypical Occult Infection: Acute confusion / recurrent fall without classic dysuria or febrile response');
        alerts.push('Recommend STAT Urinalysis and Blood Cultures to rule out occult UTI/urosepsis.');
      }
    }

    // Screen 2: Atypical Coronary Syndrome
    if (combinedText.includes('fatigue') || combinedText.includes('syncope') || combinedText.includes('dizziness')) {
      if (!combinedText.includes('chest pain')) {
        atypicalFlags.push('Atypical Myocardial Ischemia: Syncope/unexplained weakness in elder without classic retrosternal angina');
        alerts.push('Order baseline 12-lead ECG and serial cardiac troponins to rule out silent NSTEMI.');
      }
    }

    // Screen 3: Delirium (4AT screening heuristic)
    const deliriumDetected = Boolean(hasAcuteConfusion || combinedText.includes('delirium') || combinedText.includes('hallucination') || combinedText.includes('agitation'));
    if (deliriumDetected) {
      alerts.push('🚨 ACUTE DELIRIUM DETECTED: Screen for underlying infection, polypharmacy/anticholinergic tox, electrolyte imbalance, or stroke.');
    }

    // Clinical Frailty Scale Categories
    const frailtyMap: Record<number, string> = {
      1: 'Very Fit',
      2: 'Well',
      3: 'Managing Well',
      4: 'Vulnerable',
      5: 'Mildly Frail',
      6: 'Moderately Frail',
      7: 'Severely Frail',
      8: 'Very Severely Frail',
      9: 'Terminally Ill'
    };

    return {
      deliriumDetected,
      deliriumRationale: deliriumDetected ? 'Acute onset fluctuating cognitive alteration / disorientation noted.' : undefined,
      frailtyScore: cfsScore,
      frailtyCategory: frailtyMap[cfsScore] || 'Managing Well',
      atypicalPresentationFlags: atypicalFlags,
      clinicalAlerts: alerts
    };
  }

  /**
   * Registers a Caregiver Proxy for authorized patient representation
   */
  public static async registerCaregiverProxy(patientId: number, proxyData: CaregiverProxyData): Promise<any> {
    const res = await pool.query(
      `INSERT INTO caregiver_proxies (
        patient_id, proxy_name, relationship, phone, email, access_level, consent_verified
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        patientId,
        proxyData.proxyName,
        proxyData.relationship,
        proxyData.phone,
        proxyData.email || null,
        proxyData.accessLevel || 'full',
        proxyData.consentVerified ?? true
      ]
    );
    return res.rows[0];
  }

  /**
   * Fetches all registered proxies for a patient
   */
  public static async getCaregiverProxies(patientId: number): Promise<any[]> {
    const res = await pool.query(
      `SELECT * FROM caregiver_proxies WHERE patient_id = $1 ORDER BY created_at DESC`,
      [patientId]
    );
    return res.rows;
  }

  /**
   * Records a complete specialized pediatric/geriatric triage assessment
   */
  public static async recordAssessment(params: {
    sessionId: string;
    patientType: 'pediatric' | 'geriatric' | 'standard';
    pewsCriteria?: PewsCriteria;
    morseCriteria?: MorseCriteria;
    geriatricScreen?: {
      hasAcuteConfusion?: boolean;
      cfsScore?: number;
      symptoms?: string[];
      chiefComplaint?: string;
    };
    proxyId?: number;
    clinicianRecommendations?: string;
  }): Promise<any> {
    const { sessionId, patientType, proxyId } = params;

    let pewsResult: PewsResult | null = null;
    if (params.pewsCriteria) {
      pewsResult = this.calculatePews(params.pewsCriteria);
    }

    let morseResult: MorseResult | null = null;
    if (params.morseCriteria) {
      morseResult = this.calculateMorseFallRisk(params.morseCriteria);
    }

    let geriatricScreen: GeriatricScreenResult | null = null;
    if (params.geriatricScreen) {
      geriatricScreen = this.screenGeriatricSyndromes(params.geriatricScreen);
    }

    // Recommendation compilation
    const recommendations: string[] = [];
    if (pewsResult) recommendations.push(pewsResult.escalationAction);
    if (morseResult) recommendations.push(...morseResult.precautions);
    if (geriatricScreen) recommendations.push(...geriatricScreen.clinicalAlerts);
    if (params.clinicianRecommendations) recommendations.push(params.clinicianRecommendations);

    const recsString = recommendations.join('\n');

    const res = await pool.query(
      `INSERT INTO specialized_triage_assessments (
        session_id, patient_type, pews_score, pews_data,
        morse_fall_score, morse_data, frailty_score, delirium_detected,
        atypical_presentation_flags, proxy_id, clinician_recommendations
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        sessionId,
        patientType,
        pewsResult ? pewsResult.totalScore : null,
        pewsResult ? JSON.stringify(pewsResult) : '{}',
        morseResult ? morseResult.totalScore : null,
        morseResult ? JSON.stringify(morseResult) : '{}',
        geriatricScreen ? geriatricScreen.frailtyScore : null,
        geriatricScreen ? geriatricScreen.deliriumDetected : false,
        geriatricScreen ? JSON.stringify(geriatricScreen.atypicalPresentationFlags) : '[]',
        proxyId || null,
        recsString
      ]
    );

    // If PEWS is HIGH or Delirium is detected, trigger clinician alert
    if (pewsResult?.riskTier === 'HIGH') {
      notificationBus.push(
        'emergency_triage',
        '🚨 PEDIATRIC HIGH RISK ALERT (PEWS >= 5)',
        `PEWS Score ${pewsResult.totalScore}: Pediatric Rapid Response activation required immediately.`,
        { sessionId, severity: 'critical' }
      );
    } else if (geriatricScreen?.deliriumDetected) {
      notificationBus.push(
        'session_escalated',
        '⚠️ GERIATRIC ACUTE DELIRIUM ALERT',
        `Acute delirium / high fall risk flagged. Fall precautions & medical workup required.`,
        { sessionId, severity: 'warning' }
      );
    }

    return res.rows[0];
  }

  /**
   * Fetches latest specialized assessment for an encounter session
   */
  public static async getAssessment(sessionId: string): Promise<any> {
    const res = await pool.query(
      `SELECT a.*, cp.proxy_name, cp.relationship, cp.phone as proxy_phone, cp.access_level
       FROM specialized_triage_assessments a
       LEFT JOIN caregiver_proxies cp ON a.proxy_id = cp.id
       WHERE a.session_id = $1
       ORDER BY a.created_at DESC
       LIMIT 1`,
      [sessionId]
    );
    return res.rows[0] || null;
  }
}
