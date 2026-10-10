import { pool } from '../db';

export interface COKineticProfile {
  initialCohbPercent: number;
  elapsedMinutes: number;
  ambientCondition: 'Room Air (1.0 ATA)' | 'Normobaric 100% O2 (1.0 ATA)' | 'Hyperbaric 100% O2 (2.5-3.0 ATA)';
  halfLifeMinutes: number;
  projectedCurrentCohbPercent: number;
  uhmsEmergentHbotIndicated: boolean;
  indicationCriteriaMet: string[];
  recommendedTable: string;
}

export interface TreatmentTableProfile {
  indication: string;
  treatmentTable: string;
  maxDepthFsw: number;
  maxPressureAta: number;
  totalDurationMinutes: number;
  o2BreathingPeriodsCount: number;
  airBreaksMinutes: number;
  description: string;
  chamberOperationalRules: string[];
}

export interface ToxicitySegment {
  po2Ata: number;
  durationMinutes: number;
}

export interface OxygenToxicityAssessment {
  cumulativeUptd: number;
  dailyUptdCeilingExceeded: boolean;
  pulmonaryToxicityRisk: 'negligible' | 'moderate' | 'high' | 'critical';
  cnsToxicityRisk: 'low' | 'moderate' | 'imminent_convulsion';
  cnsProdromeDetected: boolean;
  observedProdromalSymptoms: string[];
  mandatoryEmergencyActions: string[];
}

export class HyperbaricMedicineService {
  /**
   * Calculates Carbon Monoxide clearance kinetics and UHMS HBOT indications
   */
  public static calculateCOElimination(
    initialCohbPercent: number,
    elapsedMinutes: number,
    fio2Fraction: number,
    pressureAta: number,
    lossOfConsciousness: boolean = false,
    cardiacIschemia: boolean = false,
    pregnancy: boolean = false,
    neurologicalDeficit: boolean = false
  ): COKineticProfile {
    let halfLife = 320; // Room air default (1 ATA, 21% O2)
    let condition: COKineticProfile['ambientCondition'] = 'Room Air (1.0 ATA)';

    if (pressureAta >= 2.0 && fio2Fraction >= 0.95) {
      // Hyperbaric Oxygen: half-life collapses to ~20 minutes at 2.5-3.0 ATA
      halfLife = Math.round(80 / Math.pow(pressureAta, 1.4));
      condition = 'Hyperbaric 100% O2 (2.5-3.0 ATA)';
    } else if (fio2Fraction >= 0.85) {
      // Normobaric 100% O2 via non-rebreather: half-life ~80 minutes
      halfLife = 80;
      condition = 'Normobaric 100% O2 (1.0 ATA)';
    }

    const projectedCohb = Math.round(initialCohbPercent * Math.pow(0.5, elapsedMinutes / halfLife) * 10) / 10;

    // UHMS Indications
    const indicationsMet: string[] = [];
    if (initialCohbPercent >= 25.0) indicationsMet.push('Carboxyhemoglobin level >= 25%');
    if (pregnancy && initialCohbPercent >= 15.0) indicationsMet.push('Pregnancy with COHb >= 15% (fetal hemoglobin HbF has 200x affinity and severe vulnerability)');
    if (lossOfConsciousness) indicationsMet.push('Documented syncope / loss of consciousness');
    if (cardiacIschemia) indicationsMet.push('Acute myocardial ischemia / elevated troponin / ischemic ECG changes');
    if (neurologicalDeficit) indicationsMet.push('Objective neuropsychiatric or cerebellar deficit');

    const uhmsIndicated = indicationsMet.length > 0;

    return {
      initialCohbPercent,
      elapsedMinutes,
      ambientCondition: condition,
      halfLifeMinutes: halfLife,
      projectedCurrentCohbPercent: Math.max(projectedCohb, 0.5),
      uhmsEmergentHbotIndicated: uhmsIndicated,
      indicationCriteriaMet: indicationsMet,
      recommendedTable: uhmsIndicated ? 'UHMS CO Protocol (2.5 - 3.0 ATA for 90m with air breaks)' : 'Normobaric 100% O2 via NRB'
    };
  }

  /**
   * Selects appropriate hyperbaric treatment table based on indication
   */
  public static selectTreatmentTable(indication: string, isSevereOrAGE: boolean): TreatmentTableProfile {
    const ind = indication.toUpperCase();

    if (ind.includes('GAS_EMBOLISM') || ind.includes('AGE') || (ind.includes('DCS') && isSevereOrAGE)) {
      if (isSevereOrAGE && ind.includes('DEEP')) {
        return {
          indication,
          treatmentTable: 'US Navy Treatment Table 6A (TT6A)',
          maxDepthFsw: 165,
          maxPressureAta: 6.0,
          totalDurationMinutes: 350,
          o2BreathingPeriodsCount: 4,
          airBreaksMinutes: 15,
          description: 'Emergency deep compression to 165 fsw (6.0 ATA) on air for 30 minutes to reduce intravascular bubble volume, followed by decompression to 60 fsw on 100% O2.',
          chamberOperationalRules: [
            'Initial compression to 165 fsw on compressed air.',
            'Switch to 100% O2 upon decompression to 60 fsw.',
            'Maintain continuous tender inside multiplace chamber.',
            'Table 6 extensions permitted at 60 fsw and 30 fsw if deficits persist.'
          ]
        };
      }
      return {
        indication,
        treatmentTable: 'US Navy Treatment Table 6 (TT6)',
        maxDepthFsw: 60,
        maxPressureAta: 2.8,
        totalDurationMinutes: 285,
        o2BreathingPeriodsCount: 3,
        airBreaksMinutes: 15,
        description: 'Standard protocol for DCS Type II (neurologic/cardiorespiratory) and Arterial Gas Embolism (AGE). 60 fsw on 100% O2 with 5-minute air breaks every 20 minutes.',
        chamberOperationalRules: [
          'Mandatory 5-minute air breaks every 20 minutes of 100% O2 at 60 fsw.',
          'Up to two 25-minute extensions at 60 fsw and two 75-minute extensions at 30 fsw allowed.',
          'Continuous monitoring for CNS oxygen toxicity (VENTID prodrome).'
        ]
      };
    }

    if (ind.includes('DCS_TYPE_I') || (ind.includes('DCS') && !isSevereOrAGE)) {
      return {
        indication,
        treatmentTable: 'US Navy Treatment Table 5 (TT5)',
        maxDepthFsw: 60,
        maxPressureAta: 2.8,
        totalDurationMinutes: 135,
        o2BreathingPeriodsCount: 2,
        airBreaksMinutes: 10,
        description: 'US Navy Table 5 for DCS Type I (pain-only decompression sickness resolved within 10 minutes at 60 fsw).',
        chamberOperationalRules: [
          'If pain not completely resolved within 10 minutes at 60 fsw, immediately advance to Table 6.',
          'Two 20-minute O2 breathing sessions at 60 fsw separated by 5-minute air break.'
        ]
      };
    }

    if (ind.includes('CO') || ind.includes('CARBON_MONOXIDE')) {
      return {
        indication,
        treatmentTable: 'UHMS Carbon Monoxide Protocol',
        maxDepthFsw: 50,
        maxPressureAta: 2.5,
        totalDurationMinutes: 90,
        o2BreathingPeriodsCount: 3,
        airBreaksMinutes: 15,
        description: 'Hyperbaric oxygen at 2.5-3.0 ATA for 90 minutes. Clears COHb in ~20m and dissociates CO from cytochrome oxidase.',
        chamberOperationalRules: [
          'Three 25-minute 100% O2 blocks with two 5-minute air breaks.',
          'Repeat hyperbaric treatment within 6-12 hours if neurologic sequelae or cognitive deficit persist.'
        ]
      };
    }

    // Default: Problem Wound / Necrotizing Soft Tissue / Radiation Necrosis
    return {
      indication,
      treatmentTable: 'Clinical Hyperbaric Wound / Tissue Protocol',
      maxDepthFsw: 45,
      maxPressureAta: 2.36,
      totalDurationMinutes: 90,
      o2BreathingPeriodsCount: 3,
      airBreaksMinutes: 10,
      description: 'Standard 2.0-2.4 ATA for 90 minutes with two 5-minute air breaks. Promotes fibroblast proliferation, angiogenesis, and osteogenesis.',
      chamberOperationalRules: [
        'Daily sessions (Monday-Friday) for 30-40 total treatments for Wagner Grade 3-4 diabetic ulcers.',
        'Pre- and post-transcutaneous oximetry (TcPO2) assessment to verify tissue perfusion response.'
      ]
    };
  }

  /**
   * Calculates Unit Pulmonary Toxic Dose (UPTD) and CNS toxicity risk
   */
  public static calculateOxygenToxicity(
    segments: ToxicitySegment[],
    cnsSymptoms: string[]
  ): OxygenToxicityAssessment {
    let totalUptd = 0;

    for (const seg of segments) {
      if (seg.po2Ata > 0.5) {
        // UPTD = t * ((PO2 - 0.5) / 0.5) ^ 0.83
        const factor = Math.pow((seg.po2Ata - 0.5) / 0.5, 0.83);
        totalUptd += seg.durationMinutes * factor;
      }
    }

    totalUptd = Math.round(totalUptd * 10) / 10;
    const dailyUptdCeilingExceeded = totalUptd > 615;

    let pulmonaryRisk: OxygenToxicityAssessment['pulmonaryToxicityRisk'] = 'negligible';
    if (totalUptd > 1425) pulmonaryRisk = 'critical';
    else if (totalUptd > 615) pulmonaryRisk = 'high';
    else if (totalUptd > 450) pulmonaryRisk = 'moderate';

    // CNS Toxicity Watchdog (VENTID prodrome)
    // Visual, Ear, Nausea, Twitching, Irritability, Dizziness
    const prodromes = cnsSymptoms.filter(s =>
      /twitch|fasciculation|nausea|tinnitus|vision|dizzy|seizure|convulsion|irritab/i.test(s)
    );
    const hasTwitching = cnsSymptoms.some(s => /twitch|fasciculation/i.test(s));
    const hasConvulsion = cnsSymptoms.some(s => /convulsion|seizure/i.test(s));

    let cnsRisk: OxygenToxicityAssessment['cnsToxicityRisk'] = 'low';
    if (hasConvulsion || hasTwitching) {
      cnsRisk = 'imminent_convulsion';
    } else if (prodromes.length > 0) {
      cnsRisk = 'moderate';
    }

    const mandatoryActions: string[] = [];
    if (cnsRisk === 'imminent_convulsion') {
      mandatoryActions.push('EMERGENT: Remove 100% O2 mask/hood immediately and switch patient to chamber ambient air.');
      mandatoryActions.push('DO NOT ASCEND / DECOMPRESS during active convulsion (airway closure creates fatal pulmonary barotrauma and massive AGE).');
      mandatoryActions.push('Protect patient from traumatic injury inside chamber; maintain airway open without forcing bite blocks.');
      mandatoryActions.push('Once tonic-clonic phase ends, ventilate and consider aborting session with slow controlled ascent.');
    } else if (prodromes.length > 0) {
      mandatoryActions.push('Institute immediate 15-minute air break.');
      mandatoryActions.push('If prodrome resolves, continue table on air breaks or reduce chamber depth by 10 fsw.');
    }

    if (dailyUptdCeilingExceeded) {
      mandatoryActions.push(`Daily pulmonary oxygen ceiling exceeded (${totalUptd} UPTD > 615 limit). Suspend further hyperbaric dives for 24-48 hours.`);
    }

    return {
      cumulativeUptd: totalUptd,
      dailyUptdCeilingExceeded,
      pulmonaryToxicityRisk: pulmonaryRisk,
      cnsToxicityRisk: cnsRisk,
      cnsProdromeDetected: prodromes.length > 0,
      observedProdromalSymptoms: prodromes,
      mandatoryEmergencyActions: mandatoryActions
    };
  }

  /**
   * Saves a Hyperbaric Treatment Session
   */
  public static async createSession(input: {
    patientId: number;
    indication: string;
    treatmentTable: string;
    chamberType?: string;
    maxDepthFsw: number;
    pressureAta: number;
    totalDurationMinutes: number;
    airBreaksCount?: number;
    initialCohbPercent?: number;
    finalCohbPercent?: number;
    sessionStatus?: string;
  }): Promise<any> {
    const result = await pool.query(
      `INSERT INTO hbot_treatment_sessions (
        patient_id, indication, treatment_table, chamber_type,
        max_depth_fsw, pressure_ata, total_duration_minutes,
        air_breaks_count, initial_cohb_percent, final_cohb_percent, session_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        input.patientId,
        input.indication,
        input.treatmentTable,
        input.chamberType || 'multiplace',
        input.maxDepthFsw,
        input.pressureAta,
        input.totalDurationMinutes,
        input.airBreaksCount || 2,
        input.initialCohbPercent || null,
        input.finalCohbPercent || null,
        input.sessionStatus || 'completed'
      ]
    );
    return result.rows[0];
  }

  /**
   * Retrieves treatment sessions for a patient
   */
  public static async listSessionsByPatient(patientId: number): Promise<any[]> {
    const result = await pool.query(
      `SELECT * FROM hbot_treatment_sessions
       WHERE patient_id = $1
       ORDER BY started_at DESC`,
      [patientId]
    );
    return result.rows;
  }

  /**
   * Logs a toxicity watchdog event for a session
   */
  public static async logToxicityEvent(input: {
    sessionId: number;
    cumulativeUptd: number;
    cnsSymptomsObserved: string[];
    airBreakInstituted: boolean;
    chamberAscentInitiated: boolean;
    notes?: string;
  }): Promise<any> {
    const result = await pool.query(
      `INSERT INTO hbot_toxicity_logs (
        session_id, cumulative_uptd, cns_symptoms_observed,
        air_break_instituted, chamber_ascent_initiated, notes
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        input.sessionId,
        input.cumulativeUptd,
        JSON.stringify(input.cnsSymptomsObserved),
        input.airBreakInstituted,
        input.chamberAscentInitiated,
        input.notes || null
      ]
    );
    return result.rows[0];
  }

  /**
   * Retrieves toxicity logs for a session
   */
  public static async getToxicityLogsBySession(sessionId: number): Promise<any[]> {
    const result = await pool.query(
      `SELECT * FROM hbot_toxicity_logs
       WHERE session_id = $1
       ORDER BY logged_at DESC`,
      [sessionId]
    );
    return result.rows;
  }
}

export default HyperbaricMedicineService;
