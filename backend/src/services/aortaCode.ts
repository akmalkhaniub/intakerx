import { pool } from '../db';

export type StanfordType = 'TYPE_A' | 'TYPE_B';
export type DeBakeyType = 'I' | 'II' | 'IIIa' | 'IIIb';

export interface MalperfusionFlags {
  coronary?: boolean;
  cerebral?: boolean;
  spinalCord?: boolean;
  mesenteric?: boolean;
  renal?: boolean;
  lowerExtremity?: boolean;
}

export interface AortaEvaluationInput {
  patientId: number;
  involvesAscendingAorta: boolean; // Proximal to innominate/brachiocephalic
  involvesAorticArch: boolean;
  involvesDescendingAorta: boolean; // Distal to left subclavian
  extendsBelowDiaphragm: boolean;
  aorticDiameterMm: number;
  intimalTearLocation: string;
  cardiacTamponadePresent?: boolean;
  aorticRegurgSeverity?: 'NONE' | 'MILD' | 'MODERATE' | 'SEVERE';
  refractoryPain?: boolean;
  refractoryHypertension?: boolean;
  rapidExpansion?: boolean;
  pericardialEffusionOrRupture?: boolean;
  malperfusion?: MalperfusionFlags;
}

export interface AortaEvaluationResult {
  stanfordType: StanfordType;
  debakeyType: DeBakeyType;
  emergentSurgeryIndicated: boolean;
  tevarIndicated: boolean;
  complicatedTypeB: boolean;
  clinicalDisposition: string;
  malperfusionSyndromesDetected: string[];
  immediateCriticalChecklist: string[];
  contraindicatedTherapies: string[];
}

export interface AntiImpulseInput {
  encounterId?: number;
  patientId: number;
  heartRateBpm: number;
  systolicBpMmhg: number;
  diastolicBpMmhg: number;
  betaBlockerActive: boolean;
  vasodilatorActive: boolean;
  activeMedications?: string[];
}

export interface AntiImpulseResult {
  meanArterialPressureMmhg: number;
  hrControlled: boolean; // Target < 60 bpm (55-60)
  sbpControlled: boolean; // Target 100-120 mmHg
  dpDtControlled: boolean; // Both HR < 60 and SBP 100-120
  reflexTachycardiaAlert: boolean; // Vasodilator given without adequate beta blockade
  shearStressStatus: 'CRITICAL_HIGH_RISK' | 'SUBOPTIMAL' | 'CONTROLLED';
  protocolNextStep: string;
  recommendedOrders: {
    drug: string;
    dose: string;
    route: string;
    rationale: string;
  }[];
  warnings: string[];
}

export class AortaCodeService {
  /**
   * Evaluates acute aortic dissection classification, malperfusion syndromes,
   * surgical urgency, and TEVAR indications.
   */
  public static evaluateAorticDissection(input: AortaEvaluationInput): AortaEvaluationResult {
    const {
      involvesAscendingAorta,
      involvesAorticArch,
      involvesDescendingAorta,
      extendsBelowDiaphragm,
      aorticDiameterMm,
      cardiacTamponadePresent = false,
      aorticRegurgSeverity = 'NONE',
      refractoryPain = false,
      refractoryHypertension = false,
      rapidExpansion = false,
      pericardialEffusionOrRupture = false,
      malperfusion = {}
    } = input;

    // 1. Stanford Classification
    const stanfordType: StanfordType = involvesAscendingAorta ? 'TYPE_A' : 'TYPE_B';

    // 2. DeBakey Classification
    let debakeyType: DeBakeyType = 'IIIa';
    if (involvesAscendingAorta) {
      if (involvesDescendingAorta || involvesAorticArch) {
        debakeyType = 'I';
      } else {
        debakeyType = 'II';
      }
    } else {
      if (extendsBelowDiaphragm) {
        debakeyType = 'IIIb';
      } else {
        debakeyType = 'IIIa';
      }
    }

    // 3. Malperfusion Assessment
    const malperfusionSyndromesDetected: string[] = [];
    if (malperfusion.coronary) {
      malperfusionSyndromesDetected.push('Coronary Malperfusion (Acute Myocardial Ischemia / STEMI / Cardiogenic Shock)');
    }
    if (malperfusion.cerebral) {
      malperfusionSyndromesDetected.push('Cerebral Malperfusion (Carotid Artery Obstruction / Acute Stroke / Hemiparesis)');
    }
    if (malperfusion.spinalCord) {
      malperfusionSyndromesDetected.push('Spinal Cord Malperfusion (Anterior Spinal Artery Ischemia / Acute Paraplegia)');
    }
    if (malperfusion.mesenteric) {
      malperfusionSyndromesDetected.push('Mesenteric Malperfusion (Celiac/SMA Compromise / Intestinal Necrosis / Acidosis)');
    }
    if (malperfusion.renal) {
      malperfusionSyndromesDetected.push('Renal Malperfusion (Renal Artery Dissection / Oliguria / Creatinine Spike)');
    }
    if (malperfusion.lowerExtremity) {
      malperfusionSyndromesDetected.push('Lower Extremity Malperfusion (Iliac/Femoral Occlusion / Pulseless Cold Leg)');
    }

    const hasMalperfusion = malperfusionSyndromesDetected.length > 0;
    const severeAorticDilation = aorticDiameterMm >= 55.0;

    // 4. Complicated Type B Criteria
    const complicatedTypeB = (stanfordType === 'TYPE_B') && (
      hasMalperfusion ||
      refractoryPain ||
      refractoryHypertension ||
      rapidExpansion ||
      severeAorticDilation ||
      pericardialEffusionOrRupture
    );

    // 5. Urgency & Interventions
    const emergentSurgeryIndicated = (stanfordType === 'TYPE_A') || cardiacTamponadePresent;
    const tevarIndicated = complicatedTypeB;

    let clinicalDisposition = '';
    if (stanfordType === 'TYPE_A') {
      clinicalDisposition = 'EMERGENT OR: STAT Cardiothoracic Surgery Consultation for Open Sternotomy & Hemiarch/Total Arch Replacement.';
    } else if (complicatedTypeB) {
      clinicalDisposition = 'URGENT ENDOVASCULAR OR/HYBRID SUITE: Complicated Type B Dissection. Mobilize Vascular/Interventional Team for TEVAR.';
    } else {
      clinicalDisposition = 'ICU ADMISSION: Uncomplicated Type B Dissection. Invasive Arterial Line Monitoring & Anti-Impulse Shear Stress Therapy.';
    }

    // 6. Checklists & Critical Contraindications
    const immediateCriticalChecklist: string[] = [
      'Establish immediate arterial line monitoring (prefer right radial unless innominate artery compromised; check bilateral arm blood pressures).',
      'Target Heart Rate < 60 bpm FIRST with IV Esmolol or Labetalol to reduce dP/dt shear stress.',
      'Target Systolic Blood Pressure 100-120 mmHg with IV Nicardipine/Clevidipine ONLY AFTER beta-blocker established.',
      'Type and cross-match 6-10 units PRBCs, 4 units FFP, and cryoprecipitate STAT.'
    ];

    if (cardiacTamponadePresent) {
      immediateCriticalChecklist.unshift('CRITICAL: Cardiac Tamponade present. Avoid aggressive pericardiocentesis if OR is immediately available, as decompression can trigger catastrophic exsanguination from aortic root rupture.');
    }
    if (aorticRegurgSeverity === 'SEVERE') {
      immediateCriticalChecklist.push('Severe Acute Aortic Regurgitation: Avoid beta-blockers that induce profound bradycardia; maintain HR 60-70 bpm to prevent acute LV volume overload.');
    }

    const contraindicatedTherapies: string[] = [
      'Pure vasodilators alone (e.g. Hydralazine, Nitroprusside without beta-blockade): Prohibited due to reflex tachycardia accelerating dP/dt and extending dissection.',
      'Intra-Aortic Balloon Pump (IABP): Strictly contraindicated (balloon inflation within dissecting aorta causes catastrophic intimal disruption and rupture).',
      'Thrombolytic Therapy (tPA / Tenecteplase): Absolutely contraindicated in suspected or confirmed aortic dissection.',
      'Full Anticoagulation (Heparin / Bivalirudin): Prohibited prior to surgical stabilization.'
    ];

    return {
      stanfordType,
      debakeyType,
      emergentSurgeryIndicated,
      tevarIndicated,
      complicatedTypeB,
      clinicalDisposition,
      malperfusionSyndromesDetected,
      immediateCriticalChecklist,
      contraindicatedTherapies
    };
  }

  /**
   * Evaluates hemodynamic anti-impulse parameters, reflex tachycardia risk,
   * shear stress (dP/dt), and next medication titration steps.
   */
  public static analyzeAntiImpulseHemodynamics(hemo: AntiImpulseInput): AntiImpulseResult {
    const {
      heartRateBpm,
      systolicBpMmhg,
      diastolicBpMmhg,
      betaBlockerActive,
      vasodilatorActive
    } = hemo;

    const meanArterialPressureMmhg = Math.round((diastolicBpMmhg * 2 + systolicBpMmhg) / 3);
    const hrControlled = heartRateBpm < 60 && heartRateBpm >= 45;
    const sbpControlled = systolicBpMmhg >= 95 && systolicBpMmhg <= 120;
    const dpDtControlled = hrControlled && sbpControlled;

    // Reflex tachycardia warning: Vasodilator is running, but HR is NOT controlled (< 60 bpm) or beta blocker is absent
    const reflexTachycardiaAlert = vasodilatorActive && (!betaBlockerActive || heartRateBpm >= 60);

    let shearStressStatus: 'CRITICAL_HIGH_RISK' | 'SUBOPTIMAL' | 'CONTROLLED' = 'CONTROLLED';
    if (reflexTachycardiaAlert || systolicBpMmhg > 140 || heartRateBpm >= 80) {
      shearStressStatus = 'CRITICAL_HIGH_RISK';
    } else if (!dpDtControlled) {
      shearStressStatus = 'SUBOPTIMAL';
    } else {
      shearStressStatus = 'CONTROLLED';
    }

    const recommendedOrders: { drug: string; dose: string; route: string; rationale: string }[] = [];
    const warnings: string[] = [];

    if (!betaBlockerActive || heartRateBpm >= 60) {
      recommendedOrders.push({
        drug: 'Esmolol Hydrochloride',
        dose: '500 mcg/kg IV bolus over 1 min, then infuse 50-300 mcg/kg/min',
        route: 'Intravenous Continuous Infusion',
        rationale: 'Ultra-short acting cardioselective beta-1 blocker. Lowers LV dP/dt shear stress without delay.'
      });
      recommendedOrders.push({
        drug: 'Labetalol Hydrochloride (Alternative)',
        dose: '20 mg IV slow push over 2 min, double dose q10min (up to 300 mg max) or 1-2 mg/min infusion',
        route: 'Intravenous Push / Continuous',
        rationale: 'Combined alpha-1 and non-selective beta blocker for combined rate and pressure control.'
      });
    }

    if (heartRateBpm < 60 && systolicBpMmhg > 120) {
      recommendedOrders.push({
        drug: 'Nicardipine Hydrochloride',
        dose: '5 mg/hr IV infusion, titrate by 2.5 mg/hr q5-15 min (max 15 mg/hr)',
        route: 'Intravenous Continuous Infusion',
        rationale: 'Potent arterial dihydropyridine calcium channel blocker to achieve target SBP 100-120 mmHg.'
      });
    }

    if (reflexTachycardiaAlert) {
      warnings.push('CRITICAL ALERT: Vasodilator therapy active without adequate beta-blockade! Reflex tachycardia increases dP/dt and propagates dissection flap. Aggressively uptitrate IV Esmolol/Labetalol immediately!');
    }
    if (systolicBpMmhg < 95) {
      warnings.push('WARNING: Hypotension (SBP < 95 mmHg). Evaluate immediately for acute aortic rupture, hemopericardium / tamponade, or acute severe aortic regurgitation.');
    }
    if (heartRateBpm < 45) {
      warnings.push('WARNING: Excessive bradycardia (HR < 45 bpm). Temporarily hold or reduce beta-blocker infusion.');
    }

    let protocolNextStep = '';
    if (!betaBlockerActive || heartRateBpm >= 60) {
      protocolNextStep = 'STEP 1: Establish negative inotropic beta-blockade (Target HR 55-60 bpm). DO NOT initiate pure vasodilators yet.';
    } else if (systolicBpMmhg > 120) {
      protocolNextStep = 'STEP 2: HR is controlled (< 60 bpm). Initiate or titrate IV Nicardipine/Clevidipine to achieve target SBP 100-120 mmHg.';
    } else if (dpDtControlled) {
      protocolNextStep = 'MAINTENANCE: Anti-impulse goals achieved (HR < 60 bpm, SBP 100-120 mmHg). Maintain continuous infusions and monitor serial pulses/lactate.';
    } else {
      protocolNextStep = 'MONITORING: Continue close arterial line hemodynamic titration.';
    }

    return {
      meanArterialPressureMmhg,
      hrControlled,
      sbpControlled,
      dpDtControlled,
      reflexTachycardiaAlert,
      shearStressStatus,
      protocolNextStep,
      recommendedOrders,
      warnings
    };
  }

  /**
   * Database: Save aortic syndrome encounter.
   */
  public static async saveAorticEncounter(input: {
    patientId: number;
    stanfordType: StanfordType;
    debakeyType: DeBakeyType;
    aorticDiameterMm: number;
    intimalTearLocation: string;
    cardiacTamponadePresent?: boolean;
    aorticRegurgSeverity?: string;
    coronaryInvolvement?: boolean;
    refractoryPain?: boolean;
    rapidExpansion?: boolean;
    malperfusionSyndromes?: any;
    tevarIndicated?: boolean;
    clinicalDisposition: string;
  }): Promise<any> {
    const res = await pool.query(
      `INSERT INTO aortic_syndrome_encounters (
        patient_id, stanford_type, debakey_type, aortic_diameter_mm,
        intimal_tear_location, cardiac_tamponade_present, aortic_regurg_severity,
        coronary_involvement, refractory_pain, rapid_expansion,
        malperfusion_syndromes, tevar_indicated, clinical_disposition
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        input.patientId,
        input.stanfordType,
        input.debakeyType,
        input.aorticDiameterMm,
        input.intimalTearLocation,
        input.cardiacTamponadePresent || false,
        input.aorticRegurgSeverity || 'NONE',
        input.coronaryInvolvement || false,
        input.refractoryPain || false,
        input.rapidExpansion || false,
        JSON.stringify(input.malperfusionSyndromes || []),
        input.tevarIndicated || false,
        input.clinicalDisposition
      ]
    );
    return res.rows[0];
  }

  /**
   * Database: Log anti-impulse telemetry readings.
   */
  public static async logAntiImpulseTelemetry(input: {
    encounterId: number;
    patientId: number;
    heartRateBpm: number;
    systolicBpMmhg: number;
    diastolicBpMmhg: number;
    meanArterialPressureMmhg: number;
    dpDtControlled: boolean;
    betaBlockerActive: boolean;
    vasodilatorActive: boolean;
    reflexTachycardiaRisk: boolean;
    activeMedications?: any;
  }): Promise<any> {
    const res = await pool.query(
      `INSERT INTO anti_impulse_telemetry_logs (
        encounter_id, patient_id, heart_rate_bpm, systolic_bp_mmhg,
        diastolic_bp_mmhg, mean_arterial_pressure_mmhg, dp_dt_controlled,
        beta_blocker_active, vasodilator_active, reflex_tachycardia_risk,
        active_medications
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        input.encounterId,
        input.patientId,
        input.heartRateBpm,
        input.systolicBpMmhg,
        input.diastolicBpMmhg,
        input.meanArterialPressureMmhg,
        input.dpDtControlled,
        input.betaBlockerActive,
        input.vasodilatorActive,
        input.reflexTachycardiaRisk,
        JSON.stringify(input.activeMedications || [])
      ]
    );
    return res.rows[0];
  }

  /**
   * Database: Retrieve patient aortic encounters.
   */
  public static async getPatientAortaHistory(patientId: number): Promise<any[]> {
    const res = await pool.query(
      `SELECT * FROM aortic_syndrome_encounters
       WHERE patient_id = $1
       ORDER BY created_at DESC`,
      [patientId]
    );
    return res.rows;
  }

  /**
   * Database: Retrieve telemetry logs for encounter.
   */
  public static async getEncounterTelemetryLogs(encounterId: number): Promise<any[]> {
    const res = await pool.query(
      `SELECT * FROM anti_impulse_telemetry_logs
       WHERE encounter_id = $1
       ORDER BY logged_at DESC`,
      [encounterId]
    );
    return res.rows;
  }
}
