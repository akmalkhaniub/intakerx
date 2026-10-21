import { pool } from '../db';

export type AsthmaSeverity = 'MILD' | 'MODERATE' | 'SEVERE' | 'IMPENDING_ARREST';

export interface AsthmaAssessmentInput {
  patientId: number;
  pefPercent?: number; // % predicted or % personal best
  speech?: 'FULL_SENTENCES' | 'PHRASES' | 'WORDS' | 'UNABLE_TO_SPEAK';
  accessoryMuscleUse?: boolean;
  silentChest?: boolean;
  pulsusParadoxusMmhg?: number;
  paco2Mmhg?: number;
  ph?: number;
  pao2Mmhg?: number;
  fio2Percent?: number;
  mentalStatus?: 'ALERT' | 'AGITATED' | 'LETHARGIC' | 'CONFUSED' | 'COMATOSE';
  heartRate?: number;
  respiratoryRate?: number;
  spo2Percent?: number;
  intubated?: boolean;
  notes?: string;
}

export interface AsthmaAssessmentResult {
  severity: AsthmaSeverity;
  pseudonormalPaco2Alert: boolean;
  hypercapnicAcidosisAlert: boolean;
  silentChestAlert: boolean;
  hemodynamicPulsusAlert: boolean;
  intubationRisk: 'LOW' | 'INTERMEDIATE' | 'HIGH' | 'EMERGENT';
  summary: string;
  recommendedActions: string[];
}

export interface VentPhysicsInput {
  encounterId?: number;
  patientId: number;
  weightKg: number;
  heightCm: number;
  gender: 'MALE' | 'FEMALE';
  tidalVolumeMl: number;
  respiratoryRateBpm: number;
  inspiratoryFlowLpm: number;
  appliedPeep: number;
  autoPeepCmh2o: number;
  plateauPressureCmh2o: number;
  peakPressureCmh2o: number;
  ph?: number;
  paco2Mmhg?: number;
  hasAcuteTbiOrElevatedIcp?: boolean;
  ventilatorMode?: string;
}

export interface VentPhysicsResult {
  ibwKg: number;
  vtPerKgIbw: number;
  vtSafe: boolean; // 6-8 mL/kg
  totalPeepCmh2o: number;
  drivingPressureCmh2o: number;
  airwayResistancePressureCmh2o: number;
  tiSeconds: number;
  teSeconds: number;
  calculatedIeRatio: string;
  prolongedExpiratoryTimeCompliant: boolean;
  dynamicHyperinflationAlert: boolean;
  permissiveHypercapniaStatus: {
    permitted: boolean;
    phSafe: boolean;
    rationale: string;
    contraindicationWarning?: string;
  };
  emergencyDecompressionProtocol: {
    indicated: boolean;
    steps: string[];
  };
  recommendations: string[];
}

export interface MedicalEscalationInput {
  severity: AsthmaSeverity;
  currentMeds?: string[];
  refractoryDurationMin?: number;
  intubated?: boolean;
  spo2Percent?: number;
}

export interface MedicalOrder {
  drug: string;
  dose: string;
  route: string;
  frequency: string;
  indication: string;
  monitoring: string;
}

export interface MedicalEscalationPlan {
  tier: 1 | 2 | 3 | 4;
  tierName: string;
  orders: MedicalOrder[];
  criticalWarnings: string[];
  rescueOptions: string[];
}

export class StatusPulmoService {
  /**
   * Assesses status asthmaticus severity based on clinical exam, spirometry, and ABG.
   */
  public static assessAsthmaSeverity(input: AsthmaAssessmentInput): AsthmaAssessmentResult {
    const {
      pefPercent,
      speech,
      accessoryMuscleUse,
      silentChest = false,
      pulsusParadoxusMmhg = 0,
      paco2Mmhg,
      ph,
      mentalStatus = 'ALERT',
      heartRate = 80,
      respiratoryRate = 18,
      spo2Percent = 98,
      intubated = false
    } = input;

    // Pseudonormal PaCO2 alert: In acute hyperventilation asthma, PaCO2 should be low (<35 mmHg).
    // A PaCO2 >= 40-42 mmHg in an exhausted tachypneic patient signals impending respiratory arrest.
    const pseudonormalPaco2Alert = (paco2Mmhg !== undefined && paco2Mmhg >= 40 && paco2Mmhg <= 45 && respiratoryRate >= 24);
    const hypercapnicAcidosisAlert = (paco2Mmhg !== undefined && paco2Mmhg > 45) || (ph !== undefined && ph < 7.30);
    const silentChestAlert = silentChest;
    const hemodynamicPulsusAlert = pulsusParadoxusMmhg >= 15;

    let severity: AsthmaSeverity = 'MILD';
    let intubationRisk: 'LOW' | 'INTERMEDIATE' | 'HIGH' | 'EMERGENT' = 'LOW';

    const isComatoseOrExhausted = ['LETHARGIC', 'CONFUSED', 'COMATOSE'].includes(mentalStatus);
    const severeAcidosis = ph !== undefined && ph < 7.20;
    const severePef = pefPercent !== undefined && pefPercent < 30;

    if (silentChest || isComatoseOrExhausted || (paco2Mmhg !== undefined && paco2Mmhg >= 50 && severeAcidosis) || severePef || pulsusParadoxusMmhg > 25) {
      severity = 'IMPENDING_ARREST';
      intubationRisk = intubated ? 'HIGH' : 'EMERGENT';
    } else if (
      (pefPercent !== undefined && pefPercent < 50) ||
      (paco2Mmhg !== undefined && paco2Mmhg >= 42) ||
      ['WORDS', 'UNABLE_TO_SPEAK'].includes(speech || '') ||
      (accessoryMuscleUse && respiratoryRate > 30) ||
      heartRate > 120 ||
      pulsusParadoxusMmhg >= 15 ||
      spo2Percent < 90
    ) {
      severity = 'SEVERE';
      intubationRisk = 'HIGH';
    } else if (
      (pefPercent !== undefined && pefPercent <= 70) ||
      speech === 'PHRASES' ||
      respiratoryRate > 22 ||
      heartRate > 100
    ) {
      severity = 'MODERATE';
      intubationRisk = 'INTERMEDIATE';
    } else {
      severity = 'MILD';
      intubationRisk = 'LOW';
    }

    const recommendedActions: string[] = [];
    if (severity === 'IMPENDING_ARREST') {
      recommendedActions.push('STAT Pulmonary / Critical Care Consult; mobilize difficult airway team at bedside');
      recommendedActions.push('Initiate continuous nebulized Albuterol + Ipratropium with inline high-flow O2/Heliox');
      recommendedActions.push('Administer IV Magnesium Sulfate 2g over 20 min and IV Methylprednisolone 125mg');
      recommendedActions.push('Prepare SQ/IM Epinephrine 0.3-0.5mg or IV Ketamine dissociation (1-2 mg/kg)');
      if (!intubated) {
        recommendedActions.push('Prepare RSI with Ketamine + Rocuronium; use largest ETT possible (>= 8.0 mm) to reduce airway resistance');
      }
    } else if (severity === 'SEVERE') {
      recommendedActions.push('Continuous Albuterol 10-15 mg/hr + Ipratropium 0.5mg q4h');
      recommendedActions.push('IV Methylprednisolone 60-125mg STAT');
      recommendedActions.push('IV Magnesium Sulfate 2g over 20 min');
      recommendedActions.push('Serial ABG monitoring at 60 min intervals to assess PaCO2 trajectory');
    } else if (severity === 'MODERATE') {
      recommendedActions.push('Nebulized Albuterol 2.5-5mg q20min x 3 doses then q1-2h');
      recommendedActions.push('Nebulized Ipratropium 0.5mg q20min x 3 doses');
      recommendedActions.push('Oral Prednisone 50mg or IV Methylprednisolone 60mg');
    } else {
      recommendedActions.push('Inhaled Albuterol 4-8 puffs via MDI with spacer q4h PRN');
      recommendedActions.push('Oral Prednisone 40-50mg daily for 5-7 days');
    }

    let summary = `Asthma Severity: ${severity}. Intubation Risk: ${intubationRisk}.`;
    if (silentChestAlert) {
      summary += ' CRITICAL ALERT: Silent Chest detected (absence of wheezing due to zero air movement).';
    }
    if (pseudonormalPaco2Alert) {
      summary += ' WARNING: Pseudonormal PaCO2 (fatigue & impending hypercapnic failure).';
    }
    if (hypercapnicAcidosisAlert) {
      summary += ' WARNING: Hypercapnic respiratory acidosis present.';
    }

    return {
      severity,
      pseudonormalPaco2Alert,
      hypercapnicAcidosisAlert,
      silentChestAlert,
      hemodynamicPulsusAlert,
      intubationRisk,
      summary,
      recommendedActions
    };
  }

  /**
   * Calculates obstructive mechanical ventilator physics: IBW, tidal volume safety,
   * driving pressure, Auto-PEEP, I:E ratio, permissive hypercapnia, and dynamic hyperinflation risk.
   */
  public static calculateVentilatorPhysics(vent: VentPhysicsInput): VentPhysicsResult {
    const {
      heightCm,
      gender,
      tidalVolumeMl,
      respiratoryRateBpm,
      inspiratoryFlowLpm,
      appliedPeep,
      autoPeepCmh2o,
      plateauPressureCmh2o,
      peakPressureCmh2o,
      ph = 7.35,
      paco2Mmhg = 40,
      hasAcuteTbiOrElevatedIcp = false
    } = vent;

    // Ideal Body Weight calculation (Devine Formula)
    const heightInches = heightCm / 2.54;
    const inchesOver60 = Math.max(0, heightInches - 60);
    const ibwKg = gender === 'MALE'
      ? Math.round((50 + 2.3 * inchesOver60) * 10) / 10
      : Math.round((45.5 + 2.3 * inchesOver60) * 10) / 10;

    const vtPerKgIbw = Math.round((tidalVolumeMl / ibwKg) * 10) / 10;
    const vtSafe = vtPerKgIbw >= 6.0 && vtPerKgIbw <= 8.5;

    // Hemodynamic & Barotrauma Pressures
    const totalPeepCmh2o = Math.round((appliedPeep + autoPeepCmh2o) * 10) / 10;
    const drivingPressureCmh2o = Math.round((plateauPressureCmh2o - totalPeepCmh2o) * 10) / 10;
    const airwayResistancePressureCmh2o = Math.round((peakPressureCmh2o - plateauPressureCmh2o) * 10) / 10;

    // Timing & I:E Ratio Calculations
    // Ti (seconds) = (Vt in liters) / (Inspiratory Flow in L/s)
    const flowLps = inspiratoryFlowLpm / 60;
    const vtLiters = tidalVolumeMl / 1000;
    const tiSeconds = Math.round((vtLiters / flowLps) * 100) / 100;

    // Ttot (seconds) = 60 / RR
    const ttotSeconds = Math.round((60 / Math.max(1, respiratoryRateBpm)) * 100) / 100;
    const teSeconds = Math.max(0.1, Math.round((ttotSeconds - tiSeconds) * 100) / 100);

    const ieDenominator = Math.round((teSeconds / Math.max(0.1, tiSeconds)) * 10) / 10;
    const calculatedIeRatio = `1:${ieDenominator}`;
    const prolongedExpiratoryTimeCompliant = ieDenominator >= 3.0; // Goal 1:3 to 1:5 in status asthmaticus

    // Dynamic Hyperinflation & Gas Trapping Alert
    const dynamicHyperinflationAlert = (autoPeepCmh2o >= 10) || (plateauPressureCmh2o > 30) || (airwayResistancePressureCmh2o >= 25);

    // Permissive Hypercapnia evaluation
    let phSafe = ph >= 7.20;
    let permitted = true;
    let rationale = '';
    let contraindicationWarning: string | undefined;

    if (hasAcuteTbiOrElevatedIcp) {
      permitted = false;
      contraindicationWarning = 'STRICT CONTRAINDICATION: Permissive hypercapnia is contraindicated in acute traumatic brain injury / intracranial hypertension due to cerebral vasodilation and intracranial pressure spikes.';
      rationale = 'Hypercapnia prohibited due to intracranial hypertension risk.';
    } else if (paco2Mmhg > 45 && ph >= 7.20) {
      permitted = true;
      rationale = `Permissive hypercapnia accepted (PaCO2 ${paco2Mmhg} mmHg, pH ${ph} >= 7.20). Prioritizing lung protection and prolonged expiration over normocapnia.`;
    } else if (paco2Mmhg > 45 && ph < 7.20) {
      permitted = false;
      phSafe = false;
      rationale = `Severe uncompensated respiratory acidosis (pH ${ph} < 7.20, PaCO2 ${paco2Mmhg} mmHg). Consider buffering with THAM or gentle titration of minute ventilation without reducing expiratory time.`;
    } else {
      permitted = true;
      rationale = `Normal or mild PaCO2 (${paco2Mmhg} mmHg), pH (${ph}) within acceptable physiological range.`;
    }

    // Emergency ventilator disconnection & chest compression protocol
    const emergencyDecompressionProtocol = {
      indicated: dynamicHyperinflationAlert,
      steps: [
        'If acute hypotension, bradycardia, or PEA arrest occurs:',
        '1. DISCONNECT PATIENT IMMEDIATELY FROM VENTILATOR to break breath-stacking loop.',
        '2. Manually compress bilateral anterior chest wall during prolonged apnea to evacuate trapped alveolar gas.',
        '3. Allow 20-30 seconds of passive exhalation hold; watch for immediate MAP and pulse recovery.',
        '4. If hypotension does not resolve immediately, perform bilateral finger thoracostomies to rule out tension pneumothorax.',
        '5. Upon reconnection: decrease RR to 8-10 bpm, increase inspiratory flow to 80-100 L/min, and decrease applied PEEP.'
      ]
    };

    const recommendations: string[] = [];
    if (!vtSafe) {
      recommendations.push(`Adjust tidal volume to 6-8 mL/kg IBW (${Math.round(ibwKg * 6)}-${Math.round(ibwKg * 8)} mL). Current is ${vtPerKgIbw} mL/kg.`);
    }
    if (!prolongedExpiratoryTimeCompliant) {
      recommendations.push(`Prolong expiratory time (current I:E ${calculatedIeRatio}). Target I:E 1:3 to 1:5 by decreasing RR (8-12 bpm) and increasing inspiratory flow to 80-100 L/min.`);
    }
    if (autoPeepCmh2o >= 10) {
      recommendations.push(`Severe Auto-PEEP (${autoPeepCmh2o} cmH2O): High risk of breath stacking. Minimize applied extrinsic PEEP (keep <= 5 cmH2O or match <= 80% intrinsic PEEP to reduce work of triggering without adding pressure).`);
    }
    if (plateauPressureCmh2o > 30) {
      recommendations.push(`Plateau pressure elevated (${plateauPressureCmh2o} cmH2O > 30 cmH2O): Reduce tidal volume to protect against alveolar barotrauma and pneumothorax.`);
    }

    return {
      ibwKg,
      vtPerKgIbw,
      vtSafe,
      totalPeepCmh2o,
      drivingPressureCmh2o,
      airwayResistancePressureCmh2o,
      tiSeconds,
      teSeconds,
      calculatedIeRatio,
      prolongedExpiratoryTimeCompliant,
      dynamicHyperinflationAlert,
      permissiveHypercapniaStatus: {
        permitted,
        phSafe,
        rationale,
        contraindicationWarning
      },
      emergencyDecompressionProtocol,
      recommendations
    };
  }

  /**
   * Medical escalation engine for refractory status asthmaticus.
   */
  public static generateMedicalEscalation(input: MedicalEscalationInput): MedicalEscalationPlan {
    const { severity, refractoryDurationMin = 0, intubated = false } = input;

    let tier: 1 | 2 | 3 | 4 = 1;
    let tierName = 'Tier 1: Initial Inhaled Bronchodilators & Systemic Steroids';
    const orders: MedicalOrder[] = [];
    const criticalWarnings: string[] = [];
    const rescueOptions: string[] = [];

    if (severity === 'IMPENDING_ARREST' || refractoryDurationMin >= 60 || intubated) {
      tier = 4;
      tierName = 'Tier 4: Deep Dissociation, Volatile Anesthesia & Extracorporeal Rescue';
    } else if (severity === 'SEVERE' && refractoryDurationMin >= 30) {
      tier = 3;
      tierName = 'Tier 3: Parenteral Adrenergic Agonists & Dissociative Bronchodilation';
    } else if (severity === 'SEVERE' || refractoryDurationMin >= 15) {
      tier = 2;
      tierName = 'Tier 2: Parenteral Magnesium & High-Dose Continuous Inhalations';
    } else {
      tier = 1;
      tierName = 'Tier 1: High-Dose Inhaled Bronchodilators & Systemic Steroids';
    }

    // Baseline Tier 1
    orders.push({
      drug: 'Albuterol Sulfate (Continuous Nebulization)',
      dose: '10-15 mg/hr',
      route: 'Inhalation via Large-Volume Nebulizer',
      frequency: 'Continuous',
      indication: 'Relief of intense bronchospasm',
      monitoring: 'Continuous ECG, serial potassium checks q2-4h (hypokalemia watchdog)'
    });
    orders.push({
      drug: 'Ipratropium Bromide',
      dose: '0.5 mg',
      route: 'Inhalation',
      frequency: 'q20min x 3 doses, then q4h',
      indication: 'Anticholinergic vagal bronchodilation',
      monitoring: 'Pupillary dilation, urinary retention'
    });
    orders.push({
      drug: 'Methylprednisolone',
      dose: '60 - 125 mg',
      route: 'IV Bolus',
      frequency: 'q6h',
      indication: 'Reduction of severe airway inflammation & beta-receptor upregulation',
      monitoring: 'Hyperglycemia, acute leukocytosis'
    });

    if (tier >= 2) {
      orders.push({
        drug: 'Magnesium Sulfate',
        dose: '2.0 g in 100 mL D5W',
        route: 'IV Infusion',
        frequency: 'Over 20 minutes STAT',
        indication: 'Inhibition of smooth muscle calcium influx -> profound bronchodilation',
        monitoring: 'Deep tendon reflexes, blood pressure, respiratory rate'
      });
      criticalWarnings.push('Watch for severe hypokalemia due to high-dose beta-2 agonist drive. Replace potassium aggressively to keep K+ >= 4.0 mEq/L.');
    }

    if (tier >= 3) {
      orders.push({
        drug: 'Terbutaline',
        dose: '0.25 mg SQ (or IV infusion 0.1-10 mcg/kg/min)',
        route: 'Subcutaneous / IV Infusion',
        frequency: 'q20min x 3 doses PRN SQ, or titrated continuous IV',
        indication: 'Parenteral beta-2 bronchodilation bypassing mucus-plugged obstructed airways',
        monitoring: 'Tachyarrhythmias, myocardial ischemia, lactic acidosis'
      });
      orders.push({
        drug: 'Ketamine',
        dose: '1.0 - 2.0 mg/kg IV bolus, followed by 0.5 - 2.0 mg/kg/hr infusion',
        route: 'IV Infusion',
        frequency: 'Continuous',
        indication: 'Sympathomimetic bronchodilation via endogenous catecholamine release & NMDA antagonism',
        monitoring: 'Emergence delirium, bronchorrhea (treat with glycopyrrolate)'
      });
      criticalWarnings.push('Lactic acidosis may develop secondary to exogenous beta-agonist receptor stimulation rather than tissue hypoperfusion.');
    }

    if (tier >= 4) {
      orders.push({
        drug: 'Inhaled Isoflurane / Sevoflurane (via AnaConDa / specialized ICU vaporizer)',
        dose: '0.5 - 1.5 MAC',
        route: 'Inline Inhalation',
        frequency: 'Continuous',
        indication: 'Direct bronchial smooth muscle relaxation in refractory status asthmaticus',
        monitoring: 'Systemic vasodilation, profound hypotension, nephrotoxicity (compound A), scavenger exhaust'
      });
      rescueOptions.push('Veno-Venous Extracorporeal Membrane Oxygenation (VV-ECMO) or Extracorporeal Carbon Dioxide Removal (ECCO2R) evaluation if plateau pressure > 35 cmH2O or refractory uncompensated acidosis pH < 7.15 despite maximal therapy.');
      rescueOptions.push('Heliox (Helium-Oxygen 80:20 or 70:30 mixture) to convert turbulent airway flow to laminar flow.');
    }

    return {
      tier,
      tierName,
      orders,
      criticalWarnings,
      rescueOptions
    };
  }

  /**
   * Database: Save status pulmo encounter.
   */
  public static async savePulmoEncounter(input: {
    patientId: number;
    severity: AsthmaSeverity;
    pefPercent?: number;
    silentChest?: boolean;
    pulsusParadoxusMmhg?: number;
    paco2Mmhg?: number;
    ph?: number;
    pao2Mmhg?: number;
    fio2Percent?: number;
    intubated?: boolean;
    dynamicHyperinflationRisk?: string;
    rescueMedications?: any;
    clinicalNotes?: string;
  }): Promise<any> {
    const res = await pool.query(
      `INSERT INTO status_pulmo_encounters (
        patient_id, severity, pef_percent, silent_chest,
        pulsus_paradoxus_mmhg, paco2_mmhg, ph, pao2_mmhg,
        fio2_percent, intubated, dynamic_hyperinflation_risk,
        rescue_medications, clinical_notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        input.patientId,
        input.severity,
        input.pefPercent || null,
        input.silentChest || false,
        input.pulsusParadoxusMmhg || null,
        input.paco2Mmhg || null,
        input.ph || null,
        input.pao2Mmhg || null,
        input.fio2Percent || null,
        input.intubated || false,
        input.dynamicHyperinflationRisk || 'NONE',
        JSON.stringify(input.rescueMedications || {}),
        input.clinicalNotes || ''
      ]
    );
    return res.rows[0];
  }

  /**
   * Database: Log obstructive ventilator settings and physics.
   */
  public static async logVentSettings(input: {
    encounterId: number;
    patientId: number;
    tidalVolumeMl: number;
    respiratoryRateBpm: number;
    inspiratoryFlowLpm: number;
    ieRatio: string;
    appliedPeep: number;
    autoPeepCmh2o: number;
    plateauPressureCmh2o: number;
    peakPressureCmh2o: number;
    dynamicHyperinflationAlert: boolean;
    ventilatorMode?: string;
  }): Promise<any> {
    const res = await pool.query(
      `INSERT INTO obstructive_vent_settings (
        encounter_id, patient_id, tidal_volume_ml, respiratory_rate_bpm,
        inspiratory_flow_lpm, ie_ratio, applied_peep, auto_peep_cmh2o,
        plateau_pressure_cmh2o, peak_pressure_cmh2o, dynamic_hyperinflation_alert,
        ventilator_mode
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        input.encounterId,
        input.patientId,
        input.tidalVolumeMl,
        input.respiratoryRateBpm,
        input.inspiratoryFlowLpm,
        input.ieRatio,
        input.appliedPeep,
        input.autoPeepCmh2o,
        input.plateauPressureCmh2o,
        input.peakPressureCmh2o,
        input.dynamicHyperinflationAlert,
        input.ventilatorMode || 'VCV'
      ]
    );
    return res.rows[0];
  }

  /**
   * Database: Retrieve patient's pulmo encounter history.
   */
  public static async getPatientPulmoHistory(patientId: number): Promise<any[]> {
    const res = await pool.query(
      `SELECT * FROM status_pulmo_encounters
       WHERE patient_id = $1
       ORDER BY created_at DESC`,
      [patientId]
    );
    return res.rows;
  }

  /**
   * Database: Retrieve vent settings for an encounter.
   */
  public static async getEncounterVentSettings(encounterId: number): Promise<any[]> {
    const res = await pool.query(
      `SELECT * FROM obstructive_vent_settings
       WHERE encounter_id = $1
       ORDER BY logged_at DESC`,
      [encounterId]
    );
    return res.rows;
  }
}
