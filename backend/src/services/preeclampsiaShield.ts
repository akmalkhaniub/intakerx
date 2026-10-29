import { pool } from '../db';

export type PreeclampsiaSeverity =
  | 'NO_PREECLAMPSIA'
  | 'GESTATIONAL_HYPERTENSION'
  | 'PREECLAMPSIA_WITHOUT_SEVERE_FEATURES'
  | 'PREECLAMPSIA_WITH_SEVERE_FEATURES'
  | 'ECLAMPSIA_ACTIVE_SEIZURE';

export type HellpClass =
  | 'CLASS_1_SEVERE' // Platelets < 50k
  | 'CLASS_2_MODERATE' // Platelets 50k - 100k
  | 'CLASS_3_MILD' // Platelets 100k - 150k
  | 'NO_HELLP';

export interface EvaluatePreeclampsiaInput {
  patientId: number;
  gestationalAgeWeeks: number;
  systolicBp: number;
  diastolicBp: number;
  priorConfirmedSevereBp?: boolean; // 2 occasions at least 15 min apart
  neurologicalSymptoms?: string[]; // 'severe_headache', 'visual_scotomata', 'hyperreflexia_clonus'
  pulmonaryEdema?: boolean;
  activeEclampticSeizure?: boolean;
  plateletCount: number;
  serumCreatinine: number;
  astUL: number;
  altUL: number;
  ldhUL: number;
  totalBilirubinMgDl: number;
  // Swansea AFLP criteria optional fields
  hypoglycemiaMgDl?: number;
  elevatedUricAcidMgDl?: number;
  coagulopathyPtSec?: number;
  vomitingOrAbdominalPain?: boolean;
  encephalopathy?: boolean;
  // Comorbidity flags for antihypertensives
  hasAsthmaOrBradycardia?: boolean;
}

export interface PreeclampsiaEvaluationResult {
  patientId: number;
  gestationalAgeWeeks: number;
  systolicBp: number;
  diastolicBp: number;
  severeHypertension: boolean;
  neurologicalSymptoms: string[];
  pulmonaryEdema: boolean;
  plateletCount: number;
  serumCreatinine: number;
  astUL: number;
  altUL: number;
  ldhUL: number;
  totalBilirubinMgDl: number;
  preeclampsiaSeverity: PreeclampsiaSeverity;
  hellpClass: HellpClass;
  swanseaAflpScore: number;
  aflpSuspected: boolean;
  emergencyAntihypertensivePlan: {
    indicated: boolean;
    targetBp: string;
    firstLineDrug: string;
    dosingRoadmap: string[];
    contraindicatedAgents: string[];
  };
  mgso4Plan: {
    indicated: boolean;
    loadingDose: string;
    maintenanceInfusion: string;
    recurrentSeizureDose: string;
    antidoteOrder: string;
  };
  deliveryTimingGuidance: {
    recommendation: string;
    urgency: 'EMERGENT_STAT' | 'URGENT_WITHIN_24_48H' | 'EXPECTANT_MANAGEMENT';
    corticosteroidsIndicated: boolean;
  };
  protocolDirectives: string[];
  clinicalSummary: string;
}

export interface LogMagnesiumSurveillanceInput {
  encounterId?: number;
  patientId: number;
  hoursOnMgso4: number;
  currentInfusionRateGH: number;
  serumMagnesiumMgDl?: number;
  patellarReflexIntact: boolean;
  respiratoryRate: number;
  hourlyUrineOutputMl: number;
}

export interface MagnesiumSurveillanceResult {
  patientId: number;
  encounterId?: number;
  hoursOnMgso4: number;
  currentInfusionRateGH: number;
  serumMagnesiumMgDl?: number;
  patellarReflexIntact: boolean;
  respiratoryRate: number;
  hourlyUrineOutputMl: number;
  toxicityFlag: 'NONE_THERAPEUTIC' | 'SUBTHERAPEUTIC' | 'LOSS_OF_REFLEXES' | 'RESPIRATORY_DEPRESSION' | 'OLIGURIA_ACCUMULATION_RISK';
  titrationAction: 'MAINTAIN' | 'UPTITRATE' | 'HOLD_AND_REDUCE' | 'STAT_CALCIUM_GLUCONATE';
  clinicalDirective: string;
}

export class PreeclampsiaShieldService {
  /**
   * Evaluates Preeclampsia severity, HELLP syndrome, emergency antihypertensive protocol, and MgSO4 therapy.
   */
  public static evaluatePreeclampsia(input: EvaluatePreeclampsiaInput): PreeclampsiaEvaluationResult {
    const directives: string[] = [];
    const severeHypertension = input.systolicBp >= 160.0 || input.diastolicBp >= 110.0;

    // 1. Severe Features Assessment
    const neuroSymptoms = input.neurologicalSymptoms || [];
    const hasNeuro = neuroSymptoms.some(s => ['severe_headache', 'visual_scotomata', 'hyperreflexia_clonus'].includes(s));
    const thrombocytopenia = input.plateletCount < 100000;
    const renalInsufficiency = input.serumCreatinine > 1.1;
    const impairedLiver = input.astUL >= 70.0 || input.altUL >= 70.0;
    const hasPulmonaryEdema = input.pulmonaryEdema === true;

    const hasSevereFeatures =
      severeHypertension ||
      thrombocytopenia ||
      renalInsufficiency ||
      impairedLiver ||
      hasPulmonaryEdema ||
      hasNeuro;

    let preeclampsiaSeverity: PreeclampsiaSeverity = 'NO_PREECLAMPSIA';
    if (input.activeEclampticSeizure) {
      preeclampsiaSeverity = 'ECLAMPSIA_ACTIVE_SEIZURE';
      directives.push('STAT ALERT: Eclampsia (Active Tonic-Clonic Seizure). Immediate airway protection, seizure termination with MgSO4 bolus, and plan for emergent delivery.');
    } else if (hasSevereFeatures) {
      preeclampsiaSeverity = 'PREECLAMPSIA_WITH_SEVERE_FEATURES';
      directives.push('Preeclampsia with Severe Features Confirmed: End-organ dysfunction or severe hypertension. Inpatient admission to High-Risk L&D required.');
    } else if (input.systolicBp >= 140.0 || input.diastolicBp >= 90.0) {
      preeclampsiaSeverity = 'PREECLAMPSIA_WITHOUT_SEVERE_FEATURES';
      directives.push('Preeclampsia without Severe Features: Close outpatient surveillance or stepdown observation.');
    }

    // 2. HELLP Syndrome Classification (Mississippi Triple Class)
    const hemolysisPresent = input.ldhUL > 600.0 || input.totalBilirubinMgDl >= 1.2;
    let hellpClass: HellpClass = 'NO_HELLP';

    if (hemolysisPresent && impairedLiver) {
      if (input.plateletCount < 50000) {
        hellpClass = 'CLASS_1_SEVERE';
        directives.push('CRITICAL ALERT: Mississippi Class 1 Severe HELLP (Platelets < 50,000/mcL). High risk of subcapsular liver hematoma and spontaneous rupture. Transfuse platelets prior to delivery if < 20k vaginal / < 50k cesarean.');
      } else if (input.plateletCount < 100000) {
        hellpClass = 'CLASS_2_MODERATE';
        directives.push('Mississippi Class 2 Moderate HELLP (Platelets 50,000 - 100,000/mcL). Continuous monitoring, expedited delivery indicated.');
      } else if (input.plateletCount < 150000) {
        hellpClass = 'CLASS_3_MILD';
        directives.push('Mississippi Class 3 Mild HELLP: Early microvascular consumption. Recheck labs every 6-8 hours.');
      }
    }

    // 3. Swansea Diagnostic Criteria for Acute Fatty Liver of Pregnancy (AFLP)
    let swanseaScore = 0;
    if (input.vomitingOrAbdominalPain) swanseaScore++;
    if (input.encephalopathy) swanseaScore++;
    if (input.totalBilirubinMgDl > 0.8) swanseaScore++;
    if (input.hypoglycemiaMgDl !== undefined && input.hypoglycemiaMgDl < 72.0) swanseaScore++;
    if (input.elevatedUricAcidMgDl !== undefined && input.elevatedUricAcidMgDl > 5.7) swanseaScore++;
    if (input.serumCreatinine > 1.1) swanseaScore++;
    if (impairedLiver) swanseaScore++;
    if (thrombocytopenia) swanseaScore++;
    if (input.coagulopathyPtSec !== undefined && input.coagulopathyPtSec > 14.0) swanseaScore++;

    const aflpSuspected = swanseaScore >= 6;
    if (aflpSuspected) {
      directives.push(`SWANSEA CRITERIA MET (${swanseaScore}/14): Acute Fatty Liver of Pregnancy (AFLP) suspected. Profound risk of fulminant hepatic necrosis and hypoglycemia. Immediate delivery and ICU transfer.`);
    }

    // 4. Emergency Antihypertensive Protocol (ACOG Guidelines)
    const emergencyAntihypertensiveIndicated = severeHypertension;
    let firstLineDrug = 'IV Labetalol';
    const contraindicatedAgents: string[] = [];
    const dosingRoadmap: string[] = [];

    if (input.hasAsthmaOrBradycardia) {
      firstLineDrug = 'IV Hydralazine or Oral Nifedipine IR';
      contraindicatedAgents.push('IV Labetalol - CONTRAINDICATED in asthma, heart block, or severe bradycardia');
      dosingRoadmap.push('Hydralazine 5 - 10 mg IV over 2 min -> Recheck BP in 20 min -> If still severe, give Hydralazine 10 mg IV (Max cumulative 20-30 mg)');
      dosingRoadmap.push('Alternative: Nifedipine 10 - 20 mg PO (swallow whole, DO NOT bite/puncture capsule) -> Recheck BP in 20 min');
    } else {
      firstLineDrug = 'IV Labetalol';
      dosingRoadmap.push('Labetalol 20 mg IV bolus over 2 min -> Recheck BP in 10 min');
      dosingRoadmap.push('If still severe: Labetalol 40 mg IV over 2 min -> Recheck in 10 min -> Labetalol 80 mg IV over 2 min (Max cumulative 220-300 mg)');
      dosingRoadmap.push('Second-line escalation: Hydralazine 10 mg IV or Nifedipine 20 mg PO');
    }

    if (emergencyAntihypertensiveIndicated) {
      directives.push(`ACOG CRITICAL PROTOCOL: Emergency antihypertensive therapy mandatory within 30-60 min for severe BP (${input.systolicBp}/${input.diastolicBp} mmHg). Goal: SBP 140-150 mmHg, DBP 90-100 mmHg to prevent hemorrhagic stroke without placental hypoperfusion.`);
    }

    // 5. Magnesium Sulfate (MgSO4) Seizure Prophylaxis & Neuroprotection
    const mgso4Indicated =
      preeclampsiaSeverity === 'PREECLAMPSIA_WITH_SEVERE_FEATURES' ||
      preeclampsiaSeverity === 'ECLAMPSIA_ACTIVE_SEIZURE' ||
      hellpClass !== 'NO_HELLP';

    const mgso4Plan = {
      indicated: mgso4Indicated,
      loadingDose: '4.0 - 6.0 g IV piggyback in 100 mL diluent over 15-20 minutes',
      maintenanceInfusion: '1.0 - 2.0 g/hour continuous IV infusion',
      recurrentSeizureDose: '2.0 g IV bolus over 3-5 minutes for recurrent eclamptic seizure',
      antidoteOrder: 'Calcium Gluconate 10% 10 mL (1g) IV push over 3-5 minutes available AT BEDSIDE'
    };

    if (mgso4Indicated) {
      directives.push('MgSO4 Protocol: Initiate 4-6g IV loading dose over 15-20 min, followed by 1-2g/h maintenance for 24h postpartum.');
      directives.push('Magnesium Toxicity Watchdog: Strict hourly monitoring of patellar reflexes, respiratory rate (>= 12/min), and hourly urine output (>= 30 mL/h).');
    }

    // 6. Delivery Timing Guidance
    let deliveryRecommendation = '';
    let deliveryUrgency: PreeclampsiaEvaluationResult['deliveryTimingGuidance']['urgency'] = 'EXPECTANT_MANAGEMENT';
    let corticosteroidsIndicated = false;

    if (preeclampsiaSeverity === 'ECLAMPSIA_ACTIVE_SEIZURE' || hellpClass === 'CLASS_1_SEVERE' || aflpSuspected || hasPulmonaryEdema) {
      deliveryUrgency = 'EMERGENT_STAT';
      deliveryRecommendation = 'STAT Delivery indicated upon maternal stabilization, regardless of gestational age. Eclampsia, Class 1 HELLP, or pulmonary edema precludes expectant management.';
      directives.push(deliveryRecommendation);
    } else if (preeclampsiaSeverity === 'PREECLAMPSIA_WITH_SEVERE_FEATURES') {
      if (input.gestationalAgeWeeks >= 34.0) {
        deliveryUrgency = 'URGENT_WITHIN_24_48H';
        deliveryRecommendation = 'Gestational age >= 34 weeks with severe features: Delivery recommended after initial maternal stabilization.';
      } else {
        deliveryUrgency = 'URGENT_WITHIN_24_48H';
        corticosteroidsIndicated = true;
        deliveryRecommendation = 'Gestational age < 34 weeks: Administer Betamethasone 12 mg IM (2 doses 24h apart) for fetal lung maturity; deliver at 34 weeks or sooner if maternal/fetal deterioration.';
        directives.push('Antenatal Corticosteroids: Betamethasone 12 mg IM Q24H x 2 doses for fetal lung maturation.');
      }
    } else {
      if (input.gestationalAgeWeeks >= 37.0) {
        deliveryUrgency = 'URGENT_WITHIN_24_48H';
        deliveryRecommendation = 'Preeclampsia without severe features at >= 37 weeks: Induction of labor recommended.';
      } else {
        deliveryUrgency = 'EXPECTANT_MANAGEMENT';
        deliveryRecommendation = 'Expectant management until 37 weeks with twice-weekly clinical and lab surveillance.';
      }
    }

    // Overall Clinical Summary
    let clinicalSummary = '';
    if (preeclampsiaSeverity === 'ECLAMPSIA_ACTIVE_SEIZURE') {
      clinicalSummary = `ACTIVE ECLAMPSIA: STAT MgSO4 bolus (4-6g IV), stabilize airway, emergent delivery planning.`;
    } else if (hellpClass === 'CLASS_1_SEVERE') {
      clinicalSummary = `CLASS 1 HELLP SYNDROME (Platelets ${input.plateletCount}): Critical liver/bleeding risk. MgSO4 prophylaxis + expedited delivery.`;
    } else if (preeclampsiaSeverity === 'PREECLAMPSIA_WITH_SEVERE_FEATURES') {
      clinicalSummary = `PREECLAMPSIA WITH SEVERE FEATURES: Emergency BP lowering (${firstLineDrug}) + MgSO4 seizure prophylaxis + delivery planning (${deliveryUrgency}).`;
    } else {
      clinicalSummary = `Preeclampsia evaluated: ${preeclampsiaSeverity}. Follow standard obstetric surveillance.`;
    }

    return {
      patientId: input.patientId,
      gestationalAgeWeeks: input.gestationalAgeWeeks,
      systolicBp: input.systolicBp,
      diastolicBp: input.diastolicBp,
      severeHypertension,
      neurologicalSymptoms: neuroSymptoms,
      pulmonaryEdema: hasPulmonaryEdema,
      plateletCount: input.plateletCount,
      serumCreatinine: input.serumCreatinine,
      astUL: input.astUL,
      altUL: input.altUL,
      ldhUL: input.ldhUL,
      totalBilirubinMgDl: input.totalBilirubinMgDl,
      preeclampsiaSeverity,
      hellpClass,
      swanseaAflpScore: swanseaScore,
      aflpSuspected,
      emergencyAntihypertensivePlan: {
        indicated: emergencyAntihypertensiveIndicated,
        targetBp: 'SBP 140 - 150 mmHg, DBP 90 - 100 mmHg within 30-60 min',
        firstLineDrug,
        dosingRoadmap,
        contraindicatedAgents
      },
      mgso4Plan,
      deliveryTimingGuidance: {
        recommendation: deliveryRecommendation,
        urgency: deliveryUrgency,
        corticosteroidsIndicated
      },
      protocolDirectives: directives,
      clinicalSummary
    };
  }

  /**
   * Evaluates hourly Magnesium Sulfate surveillance against toxicity and oliguria accumulation risk.
   */
  public static evaluateMagnesiumSurveillance(input: LogMagnesiumSurveillanceInput): MagnesiumSurveillanceResult {
    let toxicityFlag: MagnesiumSurveillanceResult['toxicityFlag'] = 'NONE_THERAPEUTIC';
    let titrationAction: MagnesiumSurveillanceResult['titrationAction'] = 'MAINTAIN';
    let clinicalDirective = '';

    // Check Respiratory Rate first (Highest fatality risk)
    if (input.respiratoryRate < 12) {
      toxicityFlag = 'RESPIRATORY_DEPRESSION';
      titrationAction = 'STAT_CALCIUM_GLUCONATE';
      clinicalDirective = `CRITICAL TOXICITY: Respiratory depression (RR ${input.respiratoryRate}/min). Stop MgSO4 infusion immediately. Administer Calcium Gluconate 10% 10 mL (1g) IV push over 3-5 minutes. Prepare bag-valve-mask ventilatory support.`;
    } else if (!input.patellarReflexIntact) {
      toxicityFlag = 'LOSS_OF_REFLEXES';
      titrationAction = 'HOLD_AND_REDUCE';
      clinicalDirective = `TOXICITY WARNING: Loss of deep tendon (patellar) reflexes. Holds MgSO4 infusion immediately and check stat serum magnesium level. Re-evaluate reflexes every 15 minutes before restarting at 50% rate.`;
    } else if (input.hourlyUrineOutputMl < 30.0) {
      toxicityFlag = 'OLIGURIA_ACCUMULATION_RISK';
      titrationAction = 'HOLD_AND_REDUCE';
      clinicalDirective = `ACCUMULATION RISK: Oliguria (< 30 mL/h, current ${input.hourlyUrineOutputMl} mL/h). Magnesium is 100% renally cleared; high risk of rapid fatal accumulation. Reduce infusion to 1.0 g/h or hold until urine output improves.`;
    } else if (input.serumMagnesiumMgDl !== undefined && input.serumMagnesiumMgDl > 9.6) {
      toxicityFlag = 'LOSS_OF_REFLEXES';
      titrationAction = 'HOLD_AND_REDUCE';
      clinicalDirective = `Supratherapeutic serum magnesium (${input.serumMagnesiumMgDl} mg/dL > 8.4 mg/dL ceiling). Hold infusion until level < 8.0 mg/dL.`;
    } else if (input.serumMagnesiumMgDl !== undefined && input.serumMagnesiumMgDl < 4.8) {
      toxicityFlag = 'SUBTHERAPEUTIC';
      titrationAction = 'UPTITRATE';
      clinicalDirective = `Subtherapeutic serum magnesium (${input.serumMagnesiumMgDl} mg/dL < 4.8 mg/dL target). Consider 2g IV re-bolus and increase maintenance infusion to 2.0 g/h.`;
    } else {
      toxicityFlag = 'NONE_THERAPEUTIC';
      titrationAction = 'MAINTAIN';
      clinicalDirective = `Therapeutic & Safe: Patellar reflexes intact, RR ${input.respiratoryRate}/min, and adequate renal clearance (${input.hourlyUrineOutputMl} mL/h). Continue MgSO4 maintenance at ${input.currentInfusionRateGH} g/h.`;
    }

    return {
      patientId: input.patientId,
      encounterId: input.encounterId,
      hoursOnMgso4: input.hoursOnMgso4,
      currentInfusionRateGH: input.currentInfusionRateGH,
      serumMagnesiumMgDl: input.serumMagnesiumMgDl,
      patellarReflexIntact: input.patellarReflexIntact,
      respiratoryRate: input.respiratoryRate,
      hourlyUrineOutputMl: input.hourlyUrineOutputMl,
      toxicityFlag,
      titrationAction,
      clinicalDirective
    };
  }

  /**
   * Persists preeclampsia evaluation encounter.
   */
  public static async persistEvaluation(result: PreeclampsiaEvaluationResult): Promise<number> {
    const query = `
      INSERT INTO preeclampsia_encounters (
        patient_id,
        gestational_age_weeks,
        systolic_bp,
        diastolic_bp,
        severe_hypertension,
        neurological_symptoms,
        pulmonary_edema,
        platelet_count,
        serum_creatinine,
        ast_u_l,
        alt_u_l,
        ldh_u_l,
        total_bilirubin_mg_dl,
        preeclampsia_severity,
        hellp_class,
        swansea_aflp_score,
        aflp_suspected,
        emergency_antihypertensive_indicated,
        recommended_antihypertensive,
        mgso4_regimen,
        delivery_timing_guidance,
        protocol_directives
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      RETURNING id;
    `;

    const values = [
      result.patientId,
      result.gestationalAgeWeeks,
      result.systolicBp,
      result.diastolicBp,
      result.severeHypertension,
      JSON.stringify(result.neurologicalSymptoms || []),
      result.pulmonaryEdema,
      result.plateletCount,
      result.serumCreatinine,
      result.astUL,
      result.altUL,
      result.ldhUL,
      result.totalBilirubinMgDl,
      result.preeclampsiaSeverity,
      result.hellpClass,
      result.swanseaAflpScore,
      result.aflpSuspected,
      result.emergencyAntihypertensivePlan.indicated,
      result.emergencyAntihypertensivePlan.firstLineDrug,
      result.mgso4Plan.loadingDose,
      result.deliveryTimingGuidance.recommendation,
      JSON.stringify(result.protocolDirectives)
    ];

    const res = await pool.query(query, values);
    return res.rows[0].id;
  }

  /**
   * Persists magnesium surveillance log.
   */
  public static async persistMagnesiumLog(result: MagnesiumSurveillanceResult): Promise<number> {
    const query = `
      INSERT INTO magnesium_surveillance_logs (
        encounter_id,
        patient_id,
        hours_on_mgso4,
        current_infusion_rate_g_h,
        serum_magnesium_mg_dl,
        patellar_reflex_intact,
        respiratory_rate,
        hourly_urine_output_ml,
        toxicity_flag,
        titration_action,
        clinical_directive
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id;
    `;

    const values = [
      result.encounterId || null,
      result.patientId,
      result.hoursOnMgso4,
      result.currentInfusionRateGH,
      result.serumMagnesiumMgDl || null,
      result.patellarReflexIntact,
      result.respiratoryRate,
      result.hourlyUrineOutputMl,
      result.toxicityFlag,
      result.titrationAction,
      result.clinicalDirective
    ];

    const res = await pool.query(query, values);
    return res.rows[0].id;
  }

  /**
   * Retrieves preeclampsia evaluations for a patient.
   */
  public static async getEvaluations(patientId: number): Promise<any[]> {
    const query = `
      SELECT * FROM preeclampsia_encounters
      WHERE patient_id = $1
      ORDER BY evaluated_at DESC;
    `;
    const res = await pool.query(query, [patientId]);
    return res.rows;
  }

  /**
   * Retrieves magnesium surveillance logs for a patient.
   */
  public static async getMagnesiumLogs(patientId: number): Promise<any[]> {
    const query = `
      SELECT * FROM magnesium_surveillance_logs
      WHERE patient_id = $1
      ORDER BY logged_at DESC;
    `;
    const res = await pool.query(query, [patientId]);
    return res.rows;
  }
}
