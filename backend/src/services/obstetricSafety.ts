import { pool } from '../db';

export type NichdTier = 'Tier_I' | 'Tier_II' | 'Tier_III';
export type ObEmergencyType = 'postpartum_hemorrhage' | 'severe_preeclampsia_eclampsia' | 'shoulder_dystocia' | 'cord_prolapse' | 'uterine_rupture';
export type ObSeverityStage = 'stage_1' | 'stage_2' | 'stage_3' | 'critical';

export interface FetalMonitoringLogRecord {
  id: number;
  patient_id: number;
  patient_name?: string;
  gestational_age_weeks: number;
  fhr_baseline_bpm: number;
  variability: 'absent' | 'minimal' | 'moderate' | 'marked';
  accelerations_present: boolean;
  decelerations_type: 'none' | 'early' | 'variable' | 'late_recurrent' | 'prolonged' | 'sinusoidal';
  uterine_contractions_per_10min: number;
  tachysystole: boolean;
  nichd_tier: NichdTier;
  interventions_performed: string[];
  logged_by: string;
  created_at: string;
  clinicalRecommendation?: string;
}

export interface ObstetricEmergencyRecord {
  id: number;
  patient_id: number;
  patient_name?: string;
  emergency_type: ObEmergencyType;
  severity_stage: ObSeverityStage;
  quantitative_blood_loss_ml: number;
  mewc_triggers: string[];
  current_vitals: {
    sbp?: number;
    dbp?: number;
    hr?: number;
    rr?: number;
    spo2?: number;
    temperature?: number;
    urineOutputMlHr?: number;
  };
  active_medications_administered: Array<{
    name: string;
    dose: string;
    route: string;
    timestamp: string;
  }>;
  magnesium_infusion_active: boolean;
  magnesium_rate_g_hr: number;
  protocol_checklist: Array<{
    step: string;
    completed: boolean;
    completedAt?: string;
  }>;
  emergency_status: 'active_emergency' | 'stabilized' | 'escalated_to_or' | 'resolved';
  lead_obstetrician: string;
  declared_at: string;
  resolved_at?: string;
}

export class ObstetricSafetyService {
  /**
   * Classifies Fetal Heart Rate Tracing according to NICHD 3-Tier Consensus Guidelines
   */
  public static classifyNichdTier(params: {
    fhrBaselineBpm: number;
    variability: 'absent' | 'minimal' | 'moderate' | 'marked';
    accelerationsPresent: boolean;
    decelerationsType: 'none' | 'early' | 'variable' | 'late_recurrent' | 'prolonged' | 'sinusoidal';
    uterineContractionsPer10min?: number;
  }): { tier: NichdTier; tachysystole: boolean; recommendation: string } {
    const { fhrBaselineBpm, variability, decelerationsType, uterineContractionsPer10min = 3 } = params;
    const tachysystole = uterineContractionsPer10min > 5;

    // Tier III: Abnormal - Predictive of abnormal fetal acid-base status
    const isSinusoidal = decelerationsType === 'sinusoidal';
    const isAbsentVarWithSevereDecels = variability === 'absent' && (
      decelerationsType === 'late_recurrent' || 
      decelerationsType === 'variable' || 
      fhrBaselineBpm < 110
    );
    const isSevereBradycardia = fhrBaselineBpm < 100;

    if (isSinusoidal || isAbsentVarWithSevereDecels || isSevereBradycardia) {
      return {
        tier: 'Tier_III',
        tachysystole,
        recommendation: 'STAT OB & Neonatology code alert. Immediate intrauterine resuscitation: lateral decubitus, IV crystalloid bolus 1000mL, 100% O2 via non-rebreather, discontinue oxytocin/uterotonics. Prepare OR for emergent operative delivery (C-section) within 30 minutes.'
      };
    }

    // Tier I: Normal - Highly predictive of normal fetal acid-base status
    const isNormalBaseline = fhrBaselineBpm >= 110 && fhrBaselineBpm <= 160;
    const isModerateVariability = variability === 'moderate';
    const isBenignDecel = decelerationsType === 'none' || decelerationsType === 'early';

    if (isNormalBaseline && isModerateVariability && isBenignDecel) {
      return {
        tier: 'Tier_I',
        tachysystole,
        recommendation: 'Reassuring Category I tracing. Continue standard routine labor surveillance. No active intrauterine resuscitation required.'
      };
    }

    // Tier II: Indeterminate - Requires continued evaluation, resuscitation, and surveillance
    return {
      tier: 'Tier_II',
      tachysystole,
      recommendation: 'Category II indeterminate tracing. Initiate targeted intrauterine resuscitation: maternal repositioning, 500-1000mL IV fluid bolus, reduce or discontinue oxytocin infusion. Continuous electronic fetal monitoring required.'
    };
  }

  /**
   * Evaluates Maternal Early Warning Criteria (MEWC) triggers
   */
  public static evaluateMewc(vitals: {
    sbp?: number;
    dbp?: number;
    hr?: number;
    rr?: number;
    spo2?: number;
    urineOutputMlHr?: number;
    headache?: boolean;
    epigastricPain?: boolean;
    shortnessOfBreath?: boolean;
    alteredMentalStatus?: boolean;
  }): string[] {
    const triggers: string[] = [];

    if (vitals.sbp !== undefined && vitals.sbp >= 160) triggers.push(`Severe Systolic Hypertension (SBP >= 160 mmHg: ${vitals.sbp})`);
    if (vitals.sbp !== undefined && vitals.sbp < 90) triggers.push(`Maternal Hypotension (SBP < 90 mmHg: ${vitals.sbp})`);
    if (vitals.dbp !== undefined && vitals.dbp >= 110) triggers.push(`Severe Diastolic Hypertension (DBP >= 110 mmHg: ${vitals.dbp})`);
    if (vitals.hr !== undefined && vitals.hr > 120) triggers.push(`Maternal Tachycardia (HR > 120 bpm: ${vitals.hr})`);
    if (vitals.hr !== undefined && vitals.hr < 50) triggers.push(`Maternal Bradycardia (HR < 50 bpm: ${vitals.hr})`);
    if (vitals.rr !== undefined && vitals.rr > 30) triggers.push(`Maternal Tachypnea (RR > 30 rpm: ${vitals.rr})`);
    if (vitals.rr !== undefined && vitals.rr < 10) triggers.push(`Maternal Bradypnea / Respiratory Depression (RR < 10 rpm: ${vitals.rr})`);
    if (vitals.spo2 !== undefined && vitals.spo2 < 95) triggers.push(`Maternal Hypoxia (SpO2 < 95%: ${vitals.spo2}%)`);
    if (vitals.urineOutputMlHr !== undefined && vitals.urineOutputMlHr < 35) triggers.push(`Oliguria (< 35 mL/hr for >= 2 hrs: ${vitals.urineOutputMlHr} mL/hr)`);
    if (vitals.headache) triggers.push('Non-remitting frontal/occipital headache (Preeclampsia neuro-trigger)');
    if (vitals.epigastricPain) triggers.push('Right upper quadrant / epigastric pain (Hepatic capsular distension)');
    if (vitals.shortnessOfBreath) triggers.push('Acute shortness of breath / Pulmonary edema suspicion');
    if (vitals.alteredMentalStatus) triggers.push('Maternal confusion / altered sensorium');

    return triggers;
  }

  /**
   * Evaluates Quantitative Blood Loss (QBL) and stages Postpartum Hemorrhage (PPH)
   */
  public static stagePostpartumHemorrhage(params: {
    qblMl: number;
    modeOfDelivery: 'vaginal' | 'cesarean';
    unstableVitals?: boolean;
  }): { stage: ObSeverityStage; actions: string[] } {
    const { qblMl, modeOfDelivery, unstableVitals = false } = params;
    const thresholdStage1 = modeOfDelivery === 'vaginal' ? 500 : 1000;

    if (qblMl > 1500 || (qblMl > 1000 && unstableVitals)) {
      return {
        stage: 'stage_3',
        actions: [
          'Activate STAT Massive Transfusion Protocol (MTP) 4:4:1 PRBC / FFP / Platelets',
          'Call STAT Emergency OB Hemorrhage Rapid Response Team & Anesthesia Attending',
          'Prepare Operating Room for emergent laparotomy, B-Lynch uterine suture, or hysterectomy',
          'Administer Tranexamic Acid (TXA) 1g IV if not already given within 3 hours of birth',
          'Place arterial line and second large-bore 16G peripheral IV or central venous access'
        ]
      };
    }

    if (qblMl > 1000 || (qblMl > thresholdStage1 && unstableVitals)) {
      return {
        stage: 'stage_2',
        actions: [
          'Mobilize bedside OB Hemorrhage Cart & notify Blood Bank for 2 units crossmatched PRBCs',
          'Administer Tranexamic Acid (TXA) 1g IV in 100mL NS over 10 minutes',
          'Inspect birth canal for deep cervical/vaginal lacerations or retained placental fragments',
          'Prepare Bakri intrauterine tamponade balloon (inflate 300-500 mL sterile saline)',
          'Continue second-line uterotonics (Methergine 0.2mg IM unless HTN, Hemabate 250mcg IM unless asthma)'
        ]
      };
    }

    if (qblMl >= thresholdStage1 || unstableVitals) {
      return {
        stage: 'stage_1',
        actions: [
          'Perform vigorous fundal massage and express uterine clots',
          'Ensure 18G IV patency and start 2nd peripheral IV line',
          'Infuse Oxytocin (Pitocin) 30-40 units in 500-1000mL LR wide open',
          'Administer Methylergonovine (Methergine) 0.2mg IM (Contraindicated if SBP >= 140 / DBP >= 90)',
          'Administer Carboprost (Hemabate) 250mcg IM (Contraindicated in active asthma)',
          'Administer Misoprostol (Cytotec) 800-1000mcg sublingually or rectally'
        ]
      };
    }

    return {
      stage: 'stage_1',
      actions: ['Continue routine active management of the third stage of labor.']
    };
  }

  /**
   * Logs a fetal heart rate and contraction tracing with NICHD tiering
   */
  public static async recordFetalMonitoringLog(params: {
    patientId: number;
    gestationalAgeWeeks: number;
    fhrBaselineBpm: number;
    variability: 'absent' | 'minimal' | 'moderate' | 'marked';
    accelerationsPresent: boolean;
    decelerationsType: 'none' | 'early' | 'variable' | 'late_recurrent' | 'prolonged' | 'sinusoidal';
    uterineContractionsPer10min?: number;
    interventionsPerformed?: string[];
    loggedBy?: string;
  }): Promise<FetalMonitoringLogRecord> {
    const {
      patientId,
      gestationalAgeWeeks,
      fhrBaselineBpm,
      variability,
      accelerationsPresent,
      decelerationsType,
      uterineContractionsPer10min = 3,
      interventionsPerformed = [],
      loggedBy = 'L&D Labor Triage Nurse'
    } = params;

    const classification = this.classifyNichdTier({
      fhrBaselineBpm,
      variability,
      accelerationsPresent,
      decelerationsType,
      uterineContractionsPer10min
    });

    const res = await pool.query(
      `INSERT INTO fetal_monitoring_logs (
        patient_id, gestational_age_weeks, fhr_baseline_bpm, variability,
        accelerations_present, decelerations_type, uterine_contractions_per_10min,
        tachysystole, nichd_tier, interventions_performed, logged_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        patientId,
        gestationalAgeWeeks,
        fhrBaselineBpm,
        variability,
        accelerationsPresent,
        decelerationsType,
        uterineContractionsPer10min,
        classification.tachysystole,
        classification.tier,
        interventionsPerformed,
        loggedBy
      ]
    );

    const log = res.rows[0];
    log.clinicalRecommendation = classification.recommendation;
    return log;
  }

  /**
   * Declares an active Obstetric Emergency (PPH, Severe Preeclampsia, etc.)
   */
  public static async declareObstetricEmergency(params: {
    patientId: number;
    emergencyType: ObEmergencyType;
    quantitativeBloodLossMl?: number;
    currentVitals?: {
      sbp?: number;
      dbp?: number;
      hr?: number;
      rr?: number;
      spo2?: number;
      urineOutputMlHr?: number;
    };
    leadObstetrician?: string;
  }): Promise<ObstetricEmergencyRecord> {
    const {
      patientId,
      emergencyType,
      quantitativeBloodLossMl = 0,
      currentVitals = {},
      leadObstetrician = 'Attending Obstetrician'
    } = params;

    const mewcTriggers = this.evaluateMewc(currentVitals);

    let stage: ObSeverityStage = 'stage_1';
    let checklist: Array<{ step: string; completed: boolean }> = [];

    if (emergencyType === 'postpartum_hemorrhage') {
      const pph = this.stagePostpartumHemorrhage({
        qblMl: quantitativeBloodLossMl,
        modeOfDelivery: 'vaginal',
        unstableVitals: (currentVitals.sbp !== undefined && currentVitals.sbp < 90) || (currentVitals.hr !== undefined && currentVitals.hr > 120)
      });
      stage = pph.stage;
      checklist = pph.actions.map(action => ({ step: action, completed: false }));
    } else if (emergencyType === 'severe_preeclampsia_eclampsia') {
      stage = mewcTriggers.some(t => t.includes('160') || t.includes('110')) ? 'critical' : 'stage_2';
      checklist = [
        { step: 'Administer IV Labetalol 20mg over 2 min (or Hydralazine 5-10mg IV) within 30 min', completed: false },
        { step: 'Initiate Magnesium Sulfate 4-6g IV loading dose in 100mL over 20-30 min', completed: false },
        { step: 'Start Magnesium Sulfate continuous maintenance infusion 2g/hr', completed: false },
        { step: 'Verify Calcium Gluconate 1g IV available at bedside for toxicity reversal', completed: false },
        { step: 'Place indwelling Foley catheter with urometer for strict hourly output monitoring', completed: false }
      ];
    } else {
      checklist = [
        { step: 'Call STAT OB Emergency Team and Neonatal Resuscitation Team (NRP)', completed: false },
        { step: 'Position patient in McRoberts maneuver / supine left tilt', completed: false },
        { step: 'Prepare immediate operative intervention', completed: false }
      ];
    }

    const insertRes = await pool.query(
      `INSERT INTO obstetric_emergencies (
        patient_id, emergency_type, severity_stage, quantitative_blood_loss_ml,
        mewc_triggers, current_vitals, protocol_checklist, emergency_status, lead_obstetrician
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        patientId,
        emergencyType,
        stage,
        quantitativeBloodLossMl,
        JSON.stringify(mewcTriggers),
        JSON.stringify(currentVitals),
        JSON.stringify(checklist),
        'active_emergency',
        leadObstetrician
      ]
    );

    return insertRes.rows[0];
  }

  /**
   * Administers protocol emergency medication (Oxytocin, TXA, Labetalol, MgSO4)
   */
  public static async recordMedicationAdministration(params: {
    emergencyId: number;
    medicationName: string;
    dose: string;
    route: string;
  }): Promise<ObstetricEmergencyRecord> {
    const { emergencyId, medicationName, dose, route } = params;

    const medEntry = {
      name: medicationName,
      dose,
      route,
      timestamp: new Date().toISOString()
    };

    const isMag = medicationName.toLowerCase().includes('magnesium');

    const res = await pool.query(
      `UPDATE obstetric_emergencies SET
        active_medications_administered = active_medications_administered || $1::jsonb,
        magnesium_infusion_active = CASE WHEN $2 = true THEN true ELSE magnesium_infusion_active END,
        magnesium_rate_g_hr = CASE WHEN $2 = true THEN 2.0 ELSE magnesium_rate_g_hr END
      WHERE id = $3
      RETURNING *`,
      [JSON.stringify([medEntry]), isMag, emergencyId]
    );

    if (res.rows.length === 0) throw new Error(`Obstetric Emergency #${emergencyId} not found`);
    return res.rows[0];
  }

  /**
   * Resolves emergency
   */
  public static async resolveEmergency(emergencyId: number, status: 'stabilized' | 'escalated_to_or' | 'resolved'): Promise<ObstetricEmergencyRecord> {
    const res = await pool.query(
      `UPDATE obstetric_emergencies SET
        emergency_status = $1,
        resolved_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *`,
      [status, emergencyId]
    );
    if (res.rows.length === 0) throw new Error(`Obstetric Emergency #${emergencyId} not found`);
    return res.rows[0];
  }

  /**
   * L&D Command Center Analytics
   */
  public static async getObSafeDashboardAnalytics(): Promise<{
    activeEmergenciesCount: number;
    tier3FetalTracingsCount: number;
    activeMagnesiumInfusions: number;
    pphIncidentsToday: number;
    meanQblHemorrhageMl: number;
  }> {
    const emergRes = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE emergency_status = 'active_emergency') as active_emergencies,
        COUNT(*) FILTER (WHERE magnesium_infusion_active = true) as active_mag,
        COUNT(*) FILTER (WHERE emergency_type = 'postpartum_hemorrhage') as pph_cases,
        COALESCE(AVG(quantitative_blood_loss_ml) FILTER (WHERE emergency_type = 'postpartum_hemorrhage'), 0) as avg_qbl
      FROM obstetric_emergencies
    `);

    const fhrRes = await pool.query(`
      SELECT COUNT(*) as tier3_count
      FROM fetal_monitoring_logs
      WHERE nichd_tier = 'Tier_III' AND created_at >= NOW() - INTERVAL '24 hours'
    `);

    const emerg = emergRes.rows[0];
    const fhr = fhrRes.rows[0];

    return {
      activeEmergenciesCount: Number(emerg.active_emergencies || 0),
      tier3FetalTracingsCount: Number(fhr.tier3_count || 0),
      activeMagnesiumInfusions: Number(emerg.active_mag || 0),
      pphIncidentsToday: Number(emerg.pph_cases || 0),
      meanQblHemorrhageMl: Math.round(Number(emerg.avg_qbl || 0))
    };
  }

  /**
   * Lists recent fetal logs
   */
  public static async getRecentFetalLogs(patientId?: number, limit = 50): Promise<FetalMonitoringLogRecord[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (patientId) {
      conditions.push(`f.patient_id = $${idx++}`);
      values.push(patientId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(limit);

    const res = await pool.query(`
      SELECT f.*, p.name as patient_name
      FROM fetal_monitoring_logs f
      LEFT JOIN patients p ON f.patient_id = p.id
      ${whereClause}
      ORDER BY f.created_at DESC
      LIMIT $${idx}
    `, values);

    return res.rows;
  }

  /**
   * Lists active emergencies
   */
  public static async getActiveEmergencies(status?: string): Promise<ObstetricEmergencyRecord[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (status) {
      conditions.push(`e.emergency_status = $${idx++}`);
      values.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const res = await pool.query(`
      SELECT e.*, p.name as patient_name
      FROM obstetric_emergencies e
      LEFT JOIN patients p ON e.patient_id = p.id
      ${whereClause}
      ORDER BY e.declared_at DESC
    `, values);

    return res.rows;
  }
}
