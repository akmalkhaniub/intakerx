import { pool } from '../db';

export type DeliveryMode = 'VAGINAL' | 'CESAREAN';

export type PphStage =
  | 'STAGE_0_NORMAL'
  | 'STAGE_1_MILD'
  | 'STAGE_2_MODERATE'
  | 'STAGE_3_SEVERE_MTP';

export type PphEtiology =
  | 'TONE_ATONY'
  | 'TRAUMA_LACERATION'
  | 'TISSUE_RETAINED_OR_ACCRETA'
  | 'THROMBIN_COAGULOPATHY';

export type UterotonicAgent =
  | 'OXYTOCIN'
  | 'METHERGINE'
  | 'CARBOPROST_HEMABATE'
  | 'MISOPROSTOL'
  | 'TRANEXAMIC_ACID';

export type UterotonicResponse =
  | 'ATONY_RESOLVED'
  | 'ONGOING_ATONY'
  | 'ADVERSE_HYPERTENSION'
  | 'ADVERSE_BRONCHOSPASM';

export interface EvaluatePphInput {
  patientId: number;
  deliveryMode: DeliveryMode;
  qblMl: number;
  heartRate: number;
  systolicBp: number;
  diastolicBp: number;
  minutesPostpartum: number;
  fundusBoggyOrAtonic?: boolean;
  suspectedPlacentaAccreta?: boolean;
  placentaAccretaType?: 'NONE' | 'ACCRETA' | 'INCRETA' | 'PERCRETA';
  priorCesareansCount?: number;
  placentaPreviaPresent?: boolean;
  suspectedGenitalTrauma?: boolean;
  retainedTissueSuspected?: boolean;
  hasHypertensionOrPreeclampsia?: boolean;
  hasAsthmaOrBronchospasm?: boolean;
  activeTransfusionUnitsPrbc?: number;
  fibrinogenMgDl?: number;
  txaAdministered?: boolean;
}

export interface UterotonicStep {
  agent: string;
  dose: string;
  route: string;
  contraindicated: boolean;
  reason?: string;
}

export interface PphEvaluationResult {
  patientId: number;
  deliveryMode: DeliveryMode;
  qblMl: number;
  heartRate: number;
  systolicBp: number;
  diastolicBp: number;
  shockIndex: number;
  shockIndexElevated: boolean;
  pphStage: PphStage;
  etiology: PphEtiology;
  atonyPresent: boolean;
  accretaSuspected: boolean;
  pasRiskPercentage: number;
  uterotonicCascade: {
    firstLine: string;
    orderedLadder: UterotonicStep[];
    activeWarning?: string;
  };
  txaGuidance: {
    indicated: boolean;
    withinWindow: boolean;
    dose: string;
    repeatDoseProtocol: string;
    cautionNote: string;
  };
  bakriBalloonGuidance: {
    indicated: boolean;
    targetVolumeMl: string;
    tamponadeTestCriteria: string;
    concomitantAction: string;
  };
  mtpAndSurgicalPlan: {
    mtpActivated: boolean;
    ratioProtocol: string;
    surgicalInterventions: string[];
  };
  protocolDirectives: string[];
  clinicalSummary: string;
}

export interface LogUterotonicInput {
  encounterId?: number;
  patientId: number;
  agent: UterotonicAgent;
  dose: string;
  route: string;
  cumulativeDose: string;
  responseObserved: UterotonicResponse;
}

export interface UterotonicLogResult {
  patientId: number;
  encounterId?: number;
  agent: UterotonicAgent;
  dose: string;
  route: string;
  cumulativeDose: string;
  responseObserved: UterotonicResponse;
  nextStepAction: string;
  clinicalFeedback: string;
}

export class ObHemorrhageService {
  /**
   * Evaluates Postpartum Hemorrhage staging, etiologies (4Ts), uterotonic cascade contraindications, TXA, and MTP.
   */
  public static evaluateHemorrhage(input: EvaluatePphInput): PphEvaluationResult {
    const directives: string[] = [];
    const shockIndex = input.systolicBp > 0 ? Number((input.heartRate / input.systolicBp).toFixed(2)) : 0;
    const shockIndexElevated = shockIndex >= 0.9;

    // 1. Determine CMQCC / ACOG Staging
    let pphStage: PphStage = 'STAGE_0_NORMAL';
    const normalThreshold = input.deliveryMode === 'VAGINAL' ? 500 : 1000;
    const isTransfusing2Plus = (input.activeTransfusionUnitsPrbc || 0) >= 2;
    const abnormalVitals = input.heartRate > 110 || input.systolicBp < 90 || shockIndexElevated;

    if (input.qblMl > 1500.0 || isTransfusing2Plus || (input.qblMl > 1000.0 && abnormalVitals && (input.fibrinogenMgDl !== undefined && input.fibrinogenMgDl < 200))) {
      pphStage = 'STAGE_3_SEVERE_MTP';
      directives.push(`STAGE 3 OB-HEMORRHAGE (QBL ${input.qblMl} mL, Shock Index ${shockIndex}): STAT Massive Transfusion Protocol (MTP), OR surgical mobilization, adult ICU notification.`);
    } else if (input.qblMl > 1000.0 || abnormalVitals || (input.qblMl > normalThreshold && abnormalVitals)) {
      pphStage = 'STAGE_2_MODERATE';
      directives.push(`STAGE 2 OB-HEMORRHAGE (QBL ${input.qblMl} mL, Shock Index ${shockIndex}): Obstetric rapid response, blood bank type & crossmatch 2-4 units PRBCs, escalate uterotonics & TXA.`);
    } else if (input.qblMl > normalThreshold) {
      pphStage = 'STAGE_1_MILD';
      directives.push(`STAGE 1 OB-HEMORRHAGE (QBL ${input.qblMl} mL): Quantitative blood loss exceeds threshold (${normalThreshold} mL). Fundal massage, 2 large-bore IVs (16-18G), initiate Oxytocin.`);
    } else {
      pphStage = 'STAGE_0_NORMAL';
    }

    // 2. Identify Etiology (The 4 Ts: Tone, Tissue, Trauma, Thrombin)
    let etiology: PphEtiology = 'TONE_ATONY';
    const atonyPresent = input.fundusBoggyOrAtonic !== false; // defaults to true in bleeding
    const accretaSuspected = input.suspectedPlacentaAccreta === true || input.placentaAccretaType !== undefined && input.placentaAccretaType !== 'NONE';

    // Placenta Accreta Spectrum (PAS) Risk Calculation
    let pasRiskPercentage = 0;
    const priorCS = input.priorCesareansCount || 0;
    const hasPrevia = input.placentaPreviaPresent === true;

    if (hasPrevia) {
      if (priorCS === 0) pasRiskPercentage = 3;
      else if (priorCS === 1) pasRiskPercentage = 11;
      else if (priorCS === 2) pasRiskPercentage = 40;
      else if (priorCS >= 3) pasRiskPercentage = 61;
    } else {
      if (priorCS >= 3) pasRiskPercentage = 1;
    }

    if (accretaSuspected || pasRiskPercentage >= 40) {
      etiology = 'TISSUE_RETAINED_OR_ACCRETA';
      directives.push(`PAS ALERT: Placenta Accreta Spectrum suspected (Risk: ${pasRiskPercentage}%). DO NOT forcibly peel or manually extract placenta; high risk of catastrophic unheralded hemorrhage.`);
    } else if (input.suspectedGenitalTrauma) {
      etiology = 'TRAUMA_LACERATION';
      directives.push('TRAUMA SUSPECTED: Inspect cervix, vagina, and perineum for deep lacerations or expanding retroperitoneal hematoma.');
    } else if (input.fibrinogenMgDl !== undefined && input.fibrinogenMgDl < 200) {
      etiology = 'THROMBIN_COAGULOPATHY';
      directives.push(`THROMBIN DEFECT: Fibrinogen critical (${input.fibrinogenMgDl} mg/dL < 200). Order 10-20 units Cryoprecipitate STAT.`);
    } else {
      etiology = 'TONE_ATONY';
      if (atonyPresent) {
        directives.push('TONE: Uterine atony identified as primary hemorrhage driver. Perform vigorous bimanual uterine compression.');
      }
    }

    // 3. Stepped Uterotonic Cascade with Contraindication Intelligence
    const ladder: UterotonicStep[] = [];

    // Step 1: Oxytocin (Always first-line)
    ladder.push({
      agent: 'Oxytocin (Pitocin)',
      dose: '10 - 40 units in 500 - 1000 mL crystalloid (rate 250 - 500 mL/h) or 10 units IM',
      route: 'IV Infusion / IM',
      contraindicated: false
    });

    // Step 2: Methergine (Contraindicated in HTN / Preeclampsia)
    const methergineContraindicated = input.hasHypertensionOrPreeclampsia === true || input.systolicBp >= 140.0 || input.diastolicBp >= 90.0;
    ladder.push({
      agent: 'Methylergonovine (Methergine)',
      dose: '0.2 mg IM every 2 - 4 hours (Max 5 doses / 1.0 mg)',
      route: 'IM (Never IV due to fatal hypertensive crisis / stroke)',
      contraindicated: methergineContraindicated,
      reason: methergineContraindicated ? 'CONTRAINDICATED: Hypertension / Preeclampsia (causes severe vasoconstriction & cerebral hemorrhage)' : undefined
    });

    // Step 3: Carboprost / Hemabate (Contraindicated in Asthma)
    const carboprostContraindicated = input.hasAsthmaOrBronchospasm === true;
    ladder.push({
      agent: '15-methyl PGF2α (Carboprost / Hemabate)',
      dose: '250 mcg (0.25 mg) IM or intramyometrial every 15 - 90 min (Max 8 doses / 2.0 mg)',
      route: 'IM / Intramyometrial',
      contraindicated: carboprostContraindicated,
      reason: carboprostContraindicated ? 'CONTRAINDICATED: Active Asthma / Bronchospasm (causes profound bronchoconstriction & V/Q mismatch)' : undefined
    });

    // Step 4: Misoprostol (Cytotec) (Safe across HTN & Asthma)
    ladder.push({
      agent: 'Misoprostol (Cytotec)',
      dose: '800 - 1000 mcg sublingually, buccally, or rectally',
      route: 'Sublingual / PR',
      contraindicated: false
    });

    // Cascade First-Line and Guidance
    let activeWarning: string | undefined;
    if (methergineContraindicated && carboprostContraindicated) {
      activeWarning = 'DUAL CONTRAINDICATION: Both Methergine (HTN) and Carboprost (Asthma) are contraindicated! Escalate immediately from Oxytocin to Misoprostol 800-1000 mcg and intrauterine balloon tamponade.';
      directives.push(activeWarning);
    } else if (methergineContraindicated) {
      activeWarning = 'Methergine is contraindicated due to maternal hypertension/preeclampsia. Skip Methergine -> Proceed to Carboprost or Misoprostol.';
      directives.push(activeWarning);
    } else if (carboprostContraindicated) {
      activeWarning = 'Carboprost (Hemabate) is contraindicated due to asthma. Skip Carboprost -> Proceed to Methergine or Misoprostol.';
      directives.push(activeWarning);
    }

    // 4. Tranexamic Acid (TXA) Protocol (WOMAN Trial)
    const within3hWindow = input.minutesPostpartum <= 180;
    const txaIndicated = (pphStage === 'STAGE_2_MODERATE' || pphStage === 'STAGE_3_SEVERE_MTP' || input.qblMl > 500) && !input.txaAdministered;

    const txaGuidance = {
      indicated: txaIndicated,
      withinWindow: within3hWindow,
      dose: 'Tranexamic Acid (TXA) 1.0 g IV in 100 mL NS infused over 10 minutes',
      repeatDoseProtocol: 'Repeat second dose of TXA 1.0 g IV if bleeding continues after 30 minutes or restarts within 24 hours',
      cautionNote: within3hWindow
        ? 'WOMAN Trial: TXA administered within 3 hours reduces maternal mortality from bleeding by >30%.'
        : 'CAUTION: >3 hours postpartum. Trial evidence shows no survival benefit when given beyond 3 hours and potential thrombotic harm.'
    };

    if (txaIndicated) {
      directives.push(`TXA Directive: ${txaGuidance.dose}. ${within3hWindow ? 'Within optimal 3-hour window.' : 'Post-3h window warning.'}`);
    }

    // 5. Intrauterine Balloon Tamponade (Bakri Balloon)
    const bakriIndicated = atonyPresent && (pphStage === 'STAGE_2_MODERATE' || pphStage === 'STAGE_3_SEVERE_MTP') && !accretaSuspected;
    const bakriBalloonGuidance = {
      indicated: bakriIndicated,
      targetVolumeMl: '300 - 500 mL sterile saline',
      tamponadeTestCriteria: 'Positive test: bleeding from cervical canal decreases markedly. Negative test: >50 mL rapid drainage within 15 min indicates failure -> Proceed to laparotomy.',
      concomitantAction: 'Place vaginal packing to prevent balloon expulsion; place Foley catheter to continuous gravity drainage.'
    };

    if (bakriIndicated) {
      directives.push(`Bakri Balloon: Indicated for refractory uterine atony. Instill ${bakriBalloonGuidance.targetVolumeMl} sterile saline and evaluate Tamponade Test.`);
    }

    // 6. Massive Transfusion & Surgical Escalation Plan
    const mtpActivated = pphStage === 'STAGE_3_SEVERE_MTP';
    const surgicalInterventions: string[] = [];

    if (pphStage === 'STAGE_2_MODERATE' || pphStage === 'STAGE_3_SEVERE_MTP') {
      surgicalInterventions.push('Examination under anesthesia (EUA) with curettage of retained cotyledons');
      surgicalInterventions.push('Uterine artery embolization (UAE) via Interventional Radiology if hemodynamically stable');
      surgicalInterventions.push('Laparotomy with Uterine Compression Sutures (B-Lynch or Hayman technique)');
      surgicalInterventions.push('Bilateral Uterine Artery / Internal Iliac (Hypogastric) Artery Ligation');
      surgicalInterventions.push('Definitive Emergent Peripartum Hysterectomy (Total vs. Supracervical) if unyielding hemorrhage');
    }

    const mtpAndSurgicalPlan = {
      mtpActivated,
      ratioProtocol: 'Balanced 1:1:1 resuscitation: 4 units PRBCs + 4 units FFP + 1 single-donor Apheresis Platelet pack + 10-20 units Cryoprecipitate for Fibrinogen < 200 mg/dL.',
      surgicalInterventions
    };

    if (mtpActivated) {
      directives.push(`MTP Activated: Rapid transfuser primed. Target: SBP > 90, Fibrinogen >= 200 mg/dL, Platelets >= 50k, Ca2+ >= 1.1 mmol/L.`);
    }

    // Clinical Summary
    let clinicalSummary = '';
    if (pphStage === 'STAGE_3_SEVERE_MTP') {
      clinicalSummary = `CRITICAL STAGE 3 PPH: QBL ${input.qblMl} mL, Shock Index ${shockIndex}. MTP active, surgical team mobilized.`;
    } else if (pphStage === 'STAGE_2_MODERATE') {
      clinicalSummary = `STAGE 2 PPH: QBL ${input.qblMl} mL. Escalate uterotonics, give TXA 1g IV, consider Bakri balloon.`;
    } else if (pphStage === 'STAGE_1_MILD') {
      clinicalSummary = `STAGE 1 PPH: QBL ${input.qblMl} mL. Vigorous massage, IV Oxytocin, monitor closely.`;
    } else {
      clinicalSummary = `Postpartum status normal: QBL ${input.qblMl} mL within physiologic bounds.`;
    }

    return {
      patientId: input.patientId,
      deliveryMode: input.deliveryMode,
      qblMl: input.qblMl,
      heartRate: input.heartRate,
      systolicBp: input.systolicBp,
      diastolicBp: input.diastolicBp,
      shockIndex,
      shockIndexElevated,
      pphStage,
      etiology,
      atonyPresent,
      accretaSuspected,
      pasRiskPercentage,
      uterotonicCascade: {
        firstLine: 'Oxytocin (Pitocin) 10-40U IV infusion',
        orderedLadder: ladder,
        activeWarning
      },
      txaGuidance,
      bakriBalloonGuidance,
      mtpAndSurgicalPlan,
      protocolDirectives: directives,
      clinicalSummary
    };
  }

  /**
   * Logs and analyzes a uterotonic administration event.
   */
  public static logUterotonicAdministration(input: LogUterotonicInput): UterotonicLogResult {
    let nextStepAction = '';
    let clinicalFeedback = '';

    if (input.responseObserved === 'ATONY_RESOLVED') {
      nextStepAction = 'Maintain slow Oxytocin maintenance infusion (10-20 U/L at 125 mL/h) for 4-6 hours. Frequent fundal checks.';
      clinicalFeedback = `Successful response to ${input.agent}: Uterus firm, bleeding controlled. Avoid over-transfusion.`;
    } else if (input.responseObserved === 'ONGOING_ATONY') {
      if (input.agent === 'OXYTOCIN') {
        nextStepAction = 'Proceed immediately to Second-Line Uterotonic: Methergine 0.2 mg IM (if not hypertensive) OR Carboprost 250 mcg IM (if not asthmatic) OR Misoprostol 800 mcg.';
      } else if (input.agent === 'METHERGINE' || input.agent === 'CARBOPROST_HEMABATE') {
        nextStepAction = 'Proceed to Misoprostol 800-1000 mcg sublingual/PR and initiate Bakri Intrauterine Balloon Tamponade (300-500 mL).';
      } else {
        nextStepAction = 'Refractory to medical cascade: Mobilize OR for immediate laparotomy (B-Lynch sutures vs. UAE vs. Emergent Hysterectomy).';
      }
      clinicalFeedback = `Refractory bleeding after ${input.agent} (${input.dose}). Uterine tone remains boggy. Escalate therapy without delay.`;
    } else if (input.responseObserved === 'ADVERSE_HYPERTENSION') {
      nextStepAction = 'Cease ergot alkaloids immediately. Check stat BP and administer emergency IV Labetalol or Hydralazine if SBP >= 160 or DBP >= 110.';
      clinicalFeedback = `ADVERSE EVENT: Acute hypertensive surge following ${input.agent}. Ergot-induced vasospasm suspected.`;
    } else if (input.responseObserved === 'ADVERSE_BRONCHOSPASM') {
      nextStepAction = 'Cease prostaglandin F2alpha. Administer nebulized Albuterol/Ipratropium and IV hydrocortisone if severe bronchospasm.';
      clinicalFeedback = `ADVERSE EVENT: Bronchospasm following ${input.agent}. Prostaglandin-induced airway constriction.`;
    }

    return {
      patientId: input.patientId,
      encounterId: input.encounterId,
      agent: input.agent,
      dose: input.dose,
      route: input.route,
      cumulativeDose: input.cumulativeDose,
      responseObserved: input.responseObserved,
      nextStepAction,
      clinicalFeedback
    };
  }

  /**
   * Persists obstetric hemorrhage encounter.
   */
  public static async persistHemorrhageEncounter(result: PphEvaluationResult): Promise<number> {
    const query = `
      INSERT INTO obstetric_hemorrhage_encounters (
        patient_id,
        delivery_mode,
        qbl_ml,
        vital_shock_index,
        heart_rate,
        systolic_bp,
        diastolic_bp,
        pph_stage,
        etiology_category,
        uterine_atony_present,
        placenta_accreta_suspected,
        active_hemorrhage,
        txa_administered,
        bakri_balloon_indicated,
        mtp_activated,
        recommended_uterotonic,
        uterotonic_roadmap,
        surgical_escalation_plan,
        protocol_directives
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING id;
    `;

    const values = [
      result.patientId,
      result.deliveryMode,
      result.qblMl,
      result.shockIndex,
      result.heartRate,
      result.systolicBp,
      result.diastolicBp,
      result.pphStage,
      result.etiology,
      result.atonyPresent,
      result.accretaSuspected,
      result.pphStage !== 'STAGE_0_NORMAL',
      result.txaGuidance.indicated && !result.txaGuidance.withinWindow ? false : true,
      result.bakriBalloonGuidance.indicated,
      result.mtpAndSurgicalPlan.mtpActivated,
      result.uterotonicCascade.firstLine,
      JSON.stringify(result.uterotonicCascade.orderedLadder),
      result.mtpAndSurgicalPlan.surgicalInterventions.join('; '),
      JSON.stringify(result.protocolDirectives)
    ];

    const res = await pool.query(query, values);
    return res.rows[0].id;
  }

  /**
   * Persists uterotonic administration log.
   */
  public static async persistUterotonicLog(result: UterotonicLogResult): Promise<number> {
    const query = `
      INSERT INTO uterotonic_administration_logs (
        encounter_id,
        patient_id,
        agent_administered,
        route_and_dosage,
        cumulative_dose,
        response_observed,
        next_step_action
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id;
    `;

    const values = [
      result.encounterId || null,
      result.patientId,
      result.agent,
      `${result.route} - ${result.dose}`,
      result.cumulativeDose,
      result.responseObserved,
      result.nextStepAction
    ];

    const res = await pool.query(query, values);
    return res.rows[0].id;
  }

  /**
   * Retrieves hemorrhage encounters for a patient.
   */
  public static async getHemorrhageEncounters(patientId: number): Promise<any[]> {
    const query = `
      SELECT * FROM obstetric_hemorrhage_encounters
      WHERE patient_id = $1
      ORDER BY evaluated_at DESC;
    `;
    const res = await pool.query(query, [patientId]);
    return res.rows;
  }

  /**
   * Retrieves uterotonic administration logs for a patient.
   */
  public static async getUterotonicLogs(patientId: number): Promise<any[]> {
    const query = `
      SELECT * FROM uterotonic_administration_logs
      WHERE patient_id = $1
      ORDER BY administered_at DESC;
    `;
    const res = await pool.query(query, [patientId]);
    return res.rows;
  }
}
