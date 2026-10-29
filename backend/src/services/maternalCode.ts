import { pool } from '../db';

export type ArrestRhythm = 'PEA' | 'ASYSTOLE' | 'VF_VT' | 'SEVERE_COLLAPSE_PRE_ARREST';

export type SuspectedMaternalEtiology =
  | 'AMNIOTIC_FLUID_EMBOLISM'
  | 'MASSIVE_OB_HEMORRHAGE'
  | 'PREECLAMPSIA_ECLAMPSIA'
  | 'SEPSIS_CHORIOAMNIONITIS'
  | 'PULMONARY_EMBOLISM'
  | 'CARDIAC_DISEASE'
  | 'MAGNESIUM_TOXICITY';

export interface EvaluateMaternalCodeInput {
  patientId: number;
  gestationalAgeWeeks: number;
  fundalHeightCm?: number;
  arrestRhythm: ArrestRhythm;
  etiologySuspected: SuspectedMaternalEtiology;
  minutesSinceArrest: number;
  ludActive: boolean;
  chestCompressionsQuality?: 'OPTIMAL' | 'SUBOPTIMAL';
  hysterotomyInitiated?: boolean;
  hysterotomyDeliveryMinute?: number;
  aokProtocolAdministered?: boolean;
  fibrinogenLevelMgDl?: number;
  plateletCount?: number;
  activeBleedingFromLinesOrSites?: boolean;
  roscAchieved?: boolean;
}

export interface MaternalCodeEvaluationResult {
  patientId: number;
  gestationalAgeWeeks: number;
  fundalHeightCm?: number;
  arrestRhythm: ArrestRhythm;
  etiologySuspected: SuspectedMaternalEtiology;
  minutesSinceArrest: number;
  aortocavalCompressionRisk: boolean;
  ludGuidance: {
    ludActive: boolean;
    technique: string;
    warning?: string;
  };
  pmcsGuidance: {
    indicated: boolean;
    countdownMinutesToIncision: number;
    countdownMinutesToDelivery: number;
    actionRequired: 'PREPARE_BEDSIDE_TRAY' | 'STAT_PMCS_INCISION_NOW' | 'CONTINUE_RESUSCITATION_POST_DELIVERY' | 'NOT_INDICATED_PREVIABLE';
    locationDirective: string;
    rationale: string;
  };
  aokPlan?: {
    indicated: boolean;
    atropineDose: string;
    ondansetronDose: string;
    ketorolacDose: string;
    rvProtectiveDirectives: string[];
  };
  coagulopathyPlan?: {
    dicSuspected: boolean;
    cryoprecipitateRecommended: boolean;
    targetFibrinogenMgDl: number;
    txaRecommended: boolean;
    transfusionDirectives: string[];
  };
  protocolDirectives: string[];
  actionSummary: string;
}

export interface LogMaternalInterventionInput {
  encounterId?: number;
  patientId: number;
  elapsedMinutes: number;
  interventionType: string;
  agentOrAction: string;
  dosageOrDetails: string;
  hemodynamicResponse: string;
}

export interface MaternalInterventionResult {
  patientId: number;
  encounterId?: number;
  elapsedMinutes: number;
  interventionType: string;
  agentOrAction: string;
  dosageOrDetails: string;
  hemodynamicResponse: string;
  clinicalFeedback: string;
}

export class MaternalCodeService {
  /**
   * Evaluates maternal cardiopulmonary arrest, manual LUD, 4-minute PMCS countdown, and AFE A-OK protocols.
   */
  public static evaluateMaternalCode(input: EvaluateMaternalCodeInput): MaternalCodeEvaluationResult {
    const directives: string[] = [];

    // 1. Aortocaval Compression Risk & Manual Left Uterine Displacement (LUD)
    const aortocavalCompressionRisk =
      input.gestationalAgeWeeks >= 20.0 || (input.fundalHeightCm !== undefined && input.fundalHeightCm >= 20);

    let ludWarning: string | undefined = undefined;
    if (aortocavalCompressionRisk) {
      if (!input.ludActive) {
        ludWarning = 'CRITICAL ALERT: Chest compressions are completely ineffective without continuous Manual Left Uterine Displacement (LUD). The gravid uterus compresses the IVC and aorta, reducing venous return to near zero.';
        directives.push(ludWarning);
      } else {
        directives.push('Manual Left Uterine Displacement (LUD) Verified: One- or two-handed leftward manual displacement maintained on flat firm backboard. (Do NOT tilt patient backboard, which degrades chest compressions).');
      }
    } else {
      directives.push(`Gestational age (${input.gestationalAgeWeeks} weeks) < 20 weeks: Uterus below umbilicus, minimal aortocaval compression.`);
    }

    // 2. Resuscitative Hysterotomy / Perimortem Cesarean Section (PMCS) Countdown
    const pmcsIndicated = aortocavalCompressionRisk && !input.roscAchieved;
    let actionRequired: MaternalCodeEvaluationResult['pmcsGuidance']['actionRequired'] = 'NOT_INDICATED_PREVIABLE';
    let countdownIncision = 0;
    let countdownDelivery = 0;
    let locationDirective = 'Perform at current bedside location. NEVER transport an arresting mother to the operating room.';
    let pmcsRationale = '';

    if (pmcsIndicated) {
      countdownIncision = Math.max(0, Math.round((4.0 - input.minutesSinceArrest) * 10) / 10);
      countdownDelivery = Math.max(0, Math.round((5.0 - input.minutesSinceArrest) * 10) / 10);

      if (input.hysterotomyInitiated) {
        actionRequired = 'CONTINUE_RESUSCITATION_POST_DELIVERY';
        pmcsRationale = 'Hysterotomy initiated. Expedite infant delivery, clamp umbilical cord, and continue maternal CPR. Delivery relieves aortocaval compression and decreases maternal oxygen consumption by 60%.';
        directives.push(pmcsRationale);
      } else if (input.minutesSinceArrest >= 4.0) {
        actionRequired = 'STAT_PMCS_INCISION_NOW';
        pmcsRationale = 'THE 4-MINUTE RULE TRIGGERED: Arrest duration >= 4 minutes without ROSC. Make immediate bedside surgical incision (No sterile prep or drape delay; scalpel only). Goal: Fetus delivered by 5 minutes.';
        directives.push(pmcsRationale);
      } else {
        actionRequired = 'PREPARE_BEDSIDE_TRAY';
        pmcsRationale = `Arrest duration ${input.minutesSinceArrest} min. Scalpel to bedside NOW. Alert OB, scrub nurse, and Neonatal Resuscitation Team. If no ROSC by 4:00 minutes, surgical incision must start immediately.`;
        directives.push(pmcsRationale);
      }
    } else if (input.roscAchieved) {
      actionRequired = 'CONTINUE_RESUSCITATION_POST_DELIVERY';
      pmcsRationale = 'ROSC Achieved: Maintain LUD, secure airway, monitor fetal heart rate continuously, and transfer to ICU/OR under strict hemodynamic stabilization.';
      directives.push(pmcsRationale);
    } else {
      actionRequired = 'NOT_INDICATED_PREVIABLE';
      pmcsRationale = 'Gestational age < 20 weeks. Emergency hysterotomy does not improve maternal hemodynamics and is not indicated for maternal resuscitation.';
      directives.push(pmcsRationale);
    }

    // 3. Amniotic Fluid Embolism (AFE) Sentinel & A-OK Regimen
    let aokPlan: MaternalCodeEvaluationResult['aokPlan'] = undefined;
    if (input.etiologySuspected === 'AMNIOTIC_FLUID_EMBOLISM') {
      directives.push('AMNIOTIC FLUID EMBOLISM (AFE) ACTIVATION: Triad of acute cardiovascular collapse, severe hypoxemia, and consumptive coagulopathy/DIC. Activate A-OK Resuscitation Protocol STAT.');
      aokPlan = {
        indicated: true,
        atropineDose: 'Atropine 1.0 mg IV push (blocks vagal bradycardia and pulmonary/coronary vasospasm)',
        ondansetronDose: 'Ondansetron 8.0 mg IV push (5-HT3 antagonist blocks serotonin-mediated pulmonary vasoconstriction)',
        ketorolacDose: 'Ketorolac 30.0 mg IV push (COX inhibitor blocks thromboxane cascade and microvascular clot propagation)',
        rvProtectiveDirectives: [
          'Acute Right Ventricular (RV) Failure Protocol: Avoid fluid overloading the failing right ventricle (limit crystal boluses to <= 500 mL)',
          'Early Epinephrine infusion (0.05 - 0.5 mcg/kg/min) or Dobutamine/Milrinone for RV inotropy and pulmonary afterload reduction',
          'Inhaled epoprostenol (Flolan) or nitric oxide (iNO) via ventilator if refractory acute pulmonary hypertension'
        ]
      };
    }

    // 4. Coagulopathy & DIC Protocol
    let coagulopathyPlan: MaternalCodeEvaluationResult['coagulopathyPlan'] = undefined;
    const dicSuspected =
      input.etiologySuspected === 'AMNIOTIC_FLUID_EMBOLISM' ||
      input.etiologySuspected === 'MASSIVE_OB_HEMORRHAGE' ||
      (input.fibrinogenLevelMgDl !== undefined && input.fibrinogenLevelMgDl < 200) ||
      input.activeBleedingFromLinesOrSites === true;

    if (dicSuspected) {
      const cryoRecommended = (input.fibrinogenLevelMgDl !== undefined && input.fibrinogenLevelMgDl < 200) || input.activeBleedingFromLinesOrSites === true;
      directives.push('COAGULOPATHY & DIC ALERT: In pregnancy, baseline fibrinogen is elevated (400-500 mg/dL). A fibrinogen level < 200 mg/dL represents severe critical consumptive coagulopathy. Order emergent Cryoprecipitate.');
      directives.push('Cryoprecipitate 10 - 20 units STAT: Target fibrinogen >= 200 mg/dL.');
      directives.push('Administer Tranexamic Acid (TXA) 1g IV over 10 minutes immediately (WOMAN trial protocol).');

      coagulopathyPlan = {
        dicSuspected: true,
        cryoprecipitateRecommended: cryoRecommended,
        targetFibrinogenMgDl: 200,
        txaRecommended: true,
        transfusionDirectives: [
          'Cryoprecipitate 10 - 20 units STAT (1 pool = 10 units raises fibrinogen by ~70-100 mg/dL)',
          'Tranexamic Acid (TXA) 1g IV in 100 mL NS over 10 min; repeat 1g in 30 min if ongoing bleeding',
          'Massive Transfusion Protocol (MTP): 1:1:1 PRBC, FFP, Platelets via rapid warmer'
        ]
      };
    }

    // 5. Magnesium Toxicity Sentinel
    if (input.etiologySuspected === 'MAGNESIUM_TOXICITY') {
      directives.push('MAGNESIUM TOXICITY ARREST: Immediately stop all MgSO4 infusions. Administer Calcium Gluconate 10% 10 mL (1g) IV over 3-5 min (or Calcium Chloride 10% 10 mL via central line) as direct physiological antagonist.');
    }

    // High-performance action summary
    let actionSummary = '';
    if (actionRequired === 'STAT_PMCS_INCISION_NOW') {
      actionSummary = `EMERGENCY 4-MINUTE RULE: Initiate immediate bedside hysterotomy (PMCS). Deliver fetus by 5 minutes. Maintain continuous CPR and LUD.`;
    } else if (input.etiologySuspected === 'AMNIOTIC_FLUID_EMBOLISM') {
      actionSummary = `AFE Resuscitation: Push A-OK regimen (Atropine 1mg, Ondansetron 8mg, Ketorolac 30mg), order Cryo + TXA for DIC, and prepare for PMCS if arrest persists >= 4 min.`;
    } else if (pmcsIndicated) {
      actionSummary = `Arrest at ${input.minutesSinceArrest} min. Scalpel to bedside. Continuous LUD. Incision mandatory at 4:00 min if no ROSC.`;
    } else {
      actionSummary = `Standard maternal ACLS protocol with etiology-directed interventions.`;
    }

    return {
      patientId: input.patientId,
      gestationalAgeWeeks: input.gestationalAgeWeeks,
      fundalHeightCm: input.fundalHeightCm,
      arrestRhythm: input.arrestRhythm,
      etiologySuspected: input.etiologySuspected,
      minutesSinceArrest: input.minutesSinceArrest,
      aortocavalCompressionRisk,
      ludGuidance: {
        ludActive: input.ludActive,
        technique: 'Continuous manual one- or two-handed leftward displacement of the gravid uterus off the maternal IVC/aorta.',
        warning: ludWarning
      },
      pmcsGuidance: {
        indicated: pmcsIndicated,
        countdownMinutesToIncision: countdownIncision,
        countdownMinutesToDelivery: countdownDelivery,
        actionRequired,
        locationDirective,
        rationale: pmcsRationale
      },
      aokPlan,
      coagulopathyPlan,
      protocolDirectives: directives,
      actionSummary
    };
  }

  /**
   * Logs a specific resuscitation intervention (e.g. LUD, AOK, PMCS incision, Cryo).
   */
  public static logIntervention(input: LogMaternalInterventionInput): MaternalInterventionResult {
    let clinicalFeedback = '';

    switch (input.interventionType) {
      case 'LUD_POSITIONING':
        clinicalFeedback = 'Manual Left Uterine Displacement confirmed. Relieves up to 80% aortocaval venous obstruction.';
        break;
      case 'AOK_REGIMEN':
        clinicalFeedback = 'A-OK administered (Atropine + Ondansetron + Ketorolac). Vagolytic and antiserotonergic blockade active for AFE shock.';
        break;
      case 'PMCS_INCISION':
        clinicalFeedback = 'Resuscitative Hysterotomy incision initiated at bedside. Goal infant extraction within 60 seconds.';
        break;
      case 'PMCS_DELIVERY':
        clinicalFeedback = 'Infant delivered. Aortocaval compression eradicated. Transfer infant to Neonatal Resuscitation Team. Continue maternal ACLS.';
        break;
      case 'CRYOPRECIPITATE_TXA':
        clinicalFeedback = 'Cryoprecipitate and TXA repleted. Combats hyperfibrinolysis and consumptive DIC.';
        break;
      default:
        clinicalFeedback = `Intervention ${input.interventionType} recorded at minute ${input.elapsedMinutes}.`;
        break;
    }

    return {
      patientId: input.patientId,
      encounterId: input.encounterId,
      elapsedMinutes: input.elapsedMinutes,
      interventionType: input.interventionType,
      agentOrAction: input.agentOrAction,
      dosageOrDetails: input.dosageOrDetails,
      hemodynamicResponse: input.hemodynamicResponse,
      clinicalFeedback
    };
  }

  /**
   * Persists maternal code evaluation to the database.
   */
  public static async persistEvaluation(result: MaternalCodeEvaluationResult): Promise<number> {
    const query = `
      INSERT INTO maternal_code_encounters (
        patient_id,
        gestational_age_weeks,
        fundal_height_cm,
        arrest_rhythm,
        etiology_suspected,
        lud_active,
        pmcs_indicated,
        minutes_since_arrest,
        hysterotomy_initiated,
        aok_protocol_administered,
        dic_coagulopathy_present,
        fibrinogen_level_mg_dl,
        rosc_achieved,
        protocol_directives,
        action_summary
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id;
    `;

    const values = [
      result.patientId,
      result.gestationalAgeWeeks,
      result.fundalHeightCm || null,
      result.arrestRhythm,
      result.etiologySuspected,
      result.ludGuidance.ludActive,
      result.pmcsGuidance.indicated,
      result.minutesSinceArrest,
      result.pmcsGuidance.actionRequired === 'CONTINUE_RESUSCITATION_POST_DELIVERY',
      Boolean(result.aokPlan?.indicated),
      Boolean(result.coagulopathyPlan?.dicSuspected),
      result.coagulopathyPlan?.targetFibrinogenMgDl || null,
      false,
      JSON.stringify(result.protocolDirectives),
      result.actionSummary
    ];

    const res = await pool.query(query, values);
    return res.rows[0].id;
  }

  /**
   * Persists maternal resuscitation intervention log.
   */
  public static async persistIntervention(result: MaternalInterventionResult): Promise<number> {
    const query = `
      INSERT INTO maternal_resuscitation_interventions_logs (
        encounter_id,
        patient_id,
        elapsed_minutes,
        intervention_type,
        agent_or_action,
        dosage_or_details,
        hemodynamic_response
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id;
    `;

    const values = [
      result.encounterId || null,
      result.patientId,
      result.elapsedMinutes,
      result.interventionType,
      result.agentOrAction,
      result.dosageOrDetails,
      result.hemodynamicResponse
    ];

    const res = await pool.query(query, values);
    return res.rows[0].id;
  }

  /**
   * Retrieves maternal code evaluations for a patient.
   */
  public static async getEvaluations(patientId: number): Promise<any[]> {
    const query = `
      SELECT * FROM maternal_code_encounters
      WHERE patient_id = $1
      ORDER BY evaluated_at DESC;
    `;
    const res = await pool.query(query, [patientId]);
    return res.rows;
  }

  /**
   * Retrieves maternal interventions for a patient.
   */
  public static async getInterventions(patientId: number): Promise<any[]> {
    const query = `
      SELECT * FROM maternal_resuscitation_interventions_logs
      WHERE patient_id = $1
      ORDER BY recorded_at DESC;
    `;
    const res = await pool.query(query, [patientId]);
    return res.rows;
  }
}
