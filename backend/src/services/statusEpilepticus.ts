import { pool } from '../db';

export type SeizureType =
  | 'CONVULSIVE_GENERALIZED'
  | 'FOCAL_MOTOR'
  | 'NON_CONVULSIVE_NCSE'
  | 'MYOCLONIC_POST_ANOXIC';

export type StatusStage =
  | 'STAGE_1_EARLY' // 0-5 mins
  | 'STAGE_2_ESTABLISHED' // 5-20/30 mins
  | 'STAGE_3_REFRACTORY' // >20-40 mins (CIVAs indicated, burst suppression)
  | 'STAGE_4_SUPER_REFRACTORY'; // >=24 hours after CIVAs or recurrence on wean

export type EegPattern =
  | 'ELECTROGRAPHIC_SEIZURES'
  | 'PERIODIC_DISCHARGES_GPD_LPD'
  | 'RHYTHMIC_DELTA_ACTIVITY'
  | 'BURST_SUPPRESSION'
  | 'CONTINUOUS_SLOWING_ISOLATED'
  | 'COMPLETE_SUPPRESSION';

export interface EvaluateStatusEpilepticusInput {
  patientId: number;
  seizureDurationMins: number;
  seizureType: SeizureType;
  weightKg: number;
  ivAccess: boolean;
  firstLineBenzoGiven?: string;
  firstLineResponse?: 'RESOLVED' | 'REFRACTORY' | 'PENDING';
  secondLineAsmGiven?: string;
  secondLineResponse?: 'RESOLVED' | 'REFRACTORY' | 'PENDING';
  intubated: boolean;
  activeCivaInfusion?: string;
  civaDurationHours?: number;
  // Salzburg NCSE criteria inputs
  eegDischargesHz?: number;
  evolutionOrImprovementWithAsm?: boolean;
  // Clinical flags
  feverOrProdromePreceding?: boolean;
  noPriorEpilepsyHistory?: boolean;
  propofolDoseMgKgH?: number;
  propofolInfusionHours?: number;
  triglyceridesMgDl?: number;
  ckLevelUL?: number;
}

export interface StatusEpilepticusEvaluationResult {
  patientId: number;
  stage: StatusStage;
  seizureDurationMins: number;
  seizureType: SeizureType;
  weightKg: number;
  salzburgNcseMet: boolean;
  autoimmuneNorseSuspected: boolean;
  prisRiskFlag: boolean;
  firstLineDosing: {
    recommendedDrug: string;
    route: 'IV' | 'IM' | 'INTRABUCCAL' | 'RECTAL';
    calculatedDoseMg: number;
    maxDoseMg: number;
    repeatInstruction: string;
  };
  secondLineDosing: {
    agentOptions: Array<{
      drug: string;
      dosePerKg: string;
      calculatedDoseMg: number;
      maxDoseMg: number;
      infusionTimeMins: number;
      cautions: string;
    }>;
    preferredAgent: string;
  };
  civaRescuePlan?: {
    recommendedCiva: string;
    loadingDose: string;
    maintenanceRate: string;
    targetEegGoal: string;
    durationTargetHours: number;
  };
  superRefractoryRescuePlan?: {
    ketogenicDietDirective: string;
    immunomodulationDirective: string;
    rescueAgents: string[];
  };
  protocolDirectives: string[];
  recommendedAction: string;
}

export interface LogCeegTitrationInput {
  encounterId?: number;
  patientId: number;
  eegPattern: EegPattern;
  burstSuppressionRatioPct?: number; // Target 50 - 80%
  burstsPerMinute?: number; // Target 3 - 5 bursts/min
  interburstIntervalSec?: number; // Target >= 10 sec
  civaDrug: string;
  civaRateUnit: string;
  civaRate: number;
}

export interface CeegTitrationResult {
  patientId: number;
  encounterId?: number;
  eegPattern: EegPattern;
  burstSuppressionRatioPct?: number;
  burstsPerMinute?: number;
  interburstIntervalSec?: number;
  targetAchieved: boolean;
  civaDrug: string;
  civaRateUnit: string;
  civaRate: number;
  titrationDirective: string;
  actionRequired: 'UPTITRATE' | 'MAINTAIN' | 'DOWNTITRATE_WEAN' | 'CHANGE_AGENT';
}

export class StatusEpilepticusService {
  /**
   * Evaluates Status Epilepticus staging, first/second-line ASMs, CIVAs, and Super-Refractory Rescue protocols.
   */
  public static evaluateStatus(input: EvaluateStatusEpilepticusInput): StatusEpilepticusEvaluationResult {
    const directives: string[] = [];
    const wt = Math.max(1, input.weightKg);

    // 1. Salzburg Criteria for NCSE
    let salzburgNcseMet = false;
    if (input.seizureType === 'NON_CONVULSIVE_NCSE') {
      if (input.eegDischargesHz !== undefined && input.eegDischargesHz > 2.5) {
        salzburgNcseMet = true;
        directives.push('Salzburg NCSE Criterion Met: Continuous epileptiform discharges > 2.5 Hz confirm Non-Convulsive Status Epilepticus.');
      } else if (
        input.eegDischargesHz !== undefined &&
        input.eegDischargesHz <= 2.5 &&
        input.evolutionOrImprovementWithAsm === true
      ) {
        salzburgNcseMet = true;
        directives.push('Salzburg NCSE Criterion Met: Epileptiform discharges <= 2.5 Hz with spatiotemporal evolution or clinical/electrographic response to rapid ASM trial.');
      }
    }

    // 2. Stage Determination
    let stage: StatusStage = 'STAGE_1_EARLY';
    if (
      (input.civaDurationHours !== undefined && input.civaDurationHours >= 24) ||
      (input.propofolInfusionHours !== undefined && input.propofolInfusionHours >= 24) ||
      (input.activeCivaInfusion && input.seizureDurationMins >= 1440)
    ) {
      stage = 'STAGE_4_SUPER_REFRACTORY';
    } else if (
      input.secondLineResponse === 'REFRACTORY' ||
      input.activeCivaInfusion ||
      input.propofolDoseMgKgH !== undefined ||
      (input.seizureDurationMins >= 30 && (input.secondLineAsmGiven || input.firstLineResponse === 'REFRACTORY' || input.intubated))
    ) {
      stage = 'STAGE_3_REFRACTORY';
    } else if (
      input.firstLineResponse === 'REFRACTORY' ||
      (input.firstLineBenzoGiven && input.seizureDurationMins >= 5) ||
      input.seizureDurationMins >= 10
    ) {
      stage = 'STAGE_2_ESTABLISHED';
    } else {
      stage = 'STAGE_1_EARLY';
    }

    // 3. First-Line Benzodiazepine Dosing
    let firstLineDrug = '';
    let firstLineRoute: 'IV' | 'IM' | 'INTRABUCCAL' | 'RECTAL' = 'IV';
    let calcFirstLineDose = 0;
    let maxFirstLineDose = 0;
    let repeatInstruction = '';

    if (input.ivAccess) {
      firstLineDrug = 'Lorazepam';
      firstLineRoute = 'IV';
      calcFirstLineDose = Math.min(4.0, Math.round(wt * 0.1 * 10) / 10);
      maxFirstLineDose = 4.0;
      repeatInstruction = 'Administer IV bolus at 2 mg/min. If convulsion continues after 5-10 minutes, administer a single repeat dose of 4 mg IV.';
      directives.push(`First-Line: Lorazepam ${calcFirstLineDose} mg IV bolus (0.1 mg/kg, max 4 mg). Alternative: Diazepam 10 mg IV.`);
    } else {
      firstLineDrug = 'Midazolam';
      firstLineRoute = 'IM';
      if (wt >= 40) {
        calcFirstLineDose = 10.0;
        maxFirstLineDose = 10.0;
      } else if (wt >= 13) {
        calcFirstLineDose = 5.0;
        maxFirstLineDose = 5.0;
      } else {
        calcFirstLineDose = Math.round(wt * 0.2 * 10) / 10;
        maxFirstLineDose = 5.0;
      }
      repeatInstruction = 'Administer IM into anterior-lateral thigh or deltoid. Repeat once in 5-10 minutes if no cessation.';
      directives.push(`First-Line (No IV Access): Midazolam ${calcFirstLineDose} mg IM. (Preferred over rectal diazepam).`);
    }

    // 4. Second-Line Non-sedating ASM Dosing (ESETT trial recommendations)
    const keppraDose = Math.min(4500, Math.round(wt * 60));
    const fosDose = Math.min(1500, Math.round(wt * 20));
    const valproateDose = Math.min(3000, Math.round(wt * 40));

    const agentOptions = [
      {
        drug: 'Levetiracetam (Keppra)',
        dosePerKg: '60 mg/kg IV',
        calculatedDoseMg: keppraDose,
        maxDoseMg: 4500,
        infusionTimeMins: 10,
        cautions: 'Preferred first choice in cardiac instability, hepatic impairment, pregnancy, or elderly.'
      },
      {
        drug: 'Fosphenytoin',
        dosePerKg: '20 mg PE/kg IV',
        calculatedDoseMg: fosDose,
        maxDoseMg: 1500,
        infusionTimeMins: 10,
        cautions: 'Max infusion rate 150 mg PE/min. Continuous ECG telemetry required (arrhythmias, QT prolongation, hypotension).'
      },
      {
        drug: 'Sodium Valproate',
        dosePerKg: '40 mg/kg IV',
        calculatedDoseMg: valproateDose,
        maxDoseMg: 3000,
        infusionTimeMins: 10,
        cautions: 'Contraindicated in pregnancy, active severe hepatic failure, or known/suspected POLG/mitochondrial disorders.'
      }
    ];

    const preferredAgent = 'Levetiracetam (Keppra)';
    if (stage === 'STAGE_2_ESTABLISHED' || stage === 'STAGE_3_REFRACTORY' || stage === 'STAGE_4_SUPER_REFRACTORY') {
      directives.push(`Second-Line Urgency: Initiate Levetiracetam ${keppraDose} mg IV over 10 min, Fosphenytoin ${fosDose} mg PE over 10 min, or Valproate ${valproateDose} mg IV over 10 min.`);
    }

    // 5. PRIS (Propofol Infusion Syndrome) Sentinel
    let prisRiskFlag = false;
    if (
      (input.propofolDoseMgKgH !== undefined && input.propofolDoseMgKgH > 4.0 && (input.propofolInfusionHours || 0) >= 48) ||
      (input.triglyceridesMgDl !== undefined && input.triglyceridesMgDl > 400) ||
      (input.ckLevelUL !== undefined && input.ckLevelUL > 5000)
    ) {
      prisRiskFlag = true;
      directives.push('CRITICAL ALERT: PRIS (Propofol Infusion Syndrome) risk threshold exceeded! High-dose propofol (>4 mg/kg/h >48h, severe hypertriglyceridemia, or rhabdomyolysis). Transition immediately to Midazolam or Ketamine infusion.');
    }

    // 6. NORSE / FIRES / Autoimmune Encephalitis Screening
    let autoimmuneNorseSuspected = false;
    if (
      (stage === 'STAGE_3_REFRACTORY' || stage === 'STAGE_4_SUPER_REFRACTORY') &&
      input.noPriorEpilepsyHistory === true &&
      input.feverOrProdromePreceding === true
    ) {
      autoimmuneNorseSuspected = true;
      directives.push('NORSE / FIRES Alert: New-Onset Refractory Status Epilepticus in patient without prior epilepsy history preceded by febrile illness. Initiate emergent autoimmune/viral encephalitis workup and immunotherapy.');
    }

    // 7. CIVA Rescue Plan (Stage 3 & 4)
    let civaRescuePlan: StatusEpilepticusEvaluationResult['civaRescuePlan'] = undefined;
    if (stage === 'STAGE_3_REFRACTORY' || stage === 'STAGE_4_SUPER_REFRACTORY') {
      if (!input.intubated) {
        directives.push('URGENT AIRWAY DIRECTIVE: Patient entering Refractory Status Epilepticus requires emergent endotracheal intubation, mechanical ventilation, and arterial line before anesthetic infusion initiation.');
      }
      directives.push('Continuous EEG (cEEG) Mandatory: Connect continuous 10-20 EEG within 60 minutes. Titrate anesthetic infusion to electrographic burst suppression (3-5 bursts/min, BSR 50-80%).');

      const recommendedDrug = prisRiskFlag ? 'Midazolam or Ketamine' : 'Propofol';
      civaRescuePlan = {
        recommendedCiva: recommendedDrug,
        loadingDose: recommendedDrug === 'Propofol' ? '1.0 - 2.0 mg/kg IV over 5 min' : '0.2 mg/kg IV bolus',
        maintenanceRate: recommendedDrug === 'Propofol' ? '2.0 - 10.0 mg/kg/h (titrate to burst suppression)' : '0.05 - 2.0 mg/kg/h',
        targetEegGoal: 'Burst-Suppression Ratio (BSR) 50 - 80% (3-5 bursts/min with >= 10s interburst interval)',
        durationTargetHours: 24
      };
    }

    // 8. Super-Refractory Rescue Plan (Stage 4)
    let superRefractoryRescuePlan: StatusEpilepticusEvaluationResult['superRefractoryRescuePlan'] = undefined;
    if (stage === 'STAGE_4_SUPER_REFRACTORY') {
      directives.push('STAGE 4 SUPER-REFRACTORY STATUS EPILEPTICUS (SRSE): Status epilepticus refractory >= 24h of anesthetic infusion or recurring upon taper. Activate SRSE Multimodal Protocol.');
      superRefractoryRescuePlan = {
        ketogenicDietDirective: 'Initiate 4:1 (or 3:1) enteral Ketogenic Diet via feeding tube. Target serum beta-hydroxybutyrate > 3.0 mmol/L. Avoid dextrose-containing IV solutions.',
        immunomodulationDirective: 'High-dose pulse IV Methylprednisolone 1g daily x 5 days, followed by IVIG 2 g/kg over 5 days (or therapeutic plasma exchange x 5 cycles).',
        rescueAgents: [
          'Ketamine IV infusion (1 - 5 mg/kg/h) - NMDA receptor antagonist to overcome GABA receptor downregulation',
          'Inhaled Anesthetics (Isoflurane / Desflurane in Neuro-ICU with scavenging circuit)',
          'Pyridoxine (Vitamin B6) 100-500 mg IV trial',
          'Mild Therapeutic Hypothermia (32 - 35°C for 24-48 hours)'
        ]
      };
    }

    // Overall recommendation summary
    let recommendedAction = '';
    switch (stage) {
      case 'STAGE_1_EARLY':
        recommendedAction = `Administer first-line ${firstLineDrug} ${calcFirstLineDose} mg ${firstLineRoute}. Establish airway and continuous vital monitoring. Prepare second-line ASM immediately.`;
        break;
      case 'STAGE_2_ESTABLISHED':
        recommendedAction = `First-line benzo failed/insufficient. STAT infusion of second-line ASM: Levetiracetam ${keppraDose} mg IV over 10 min. Order STAT portable EEG.`;
        break;
      case 'STAGE_3_REFRACTORY':
        recommendedAction = `Status is REFRACTORY. Secure airway via endotracheal intubation, place arterial line, initiate continuous IV anesthetic infusion (${civaRescuePlan?.recommendedCiva}), and connect cEEG for burst-suppression titration.`;
        break;
      case 'STAGE_4_SUPER_REFRACTORY':
        recommendedAction = `SUPER-REFRACTORY STATUS EPILEPTICUS. Initiate multimodal rescue: Ketogenic diet (target BHB > 3.0 mmol/L), IV pulse steroids/IVIG, and add Ketamine or Inhaled Isoflurane.`;
        break;
    }

    return {
      patientId: input.patientId,
      stage,
      seizureDurationMins: input.seizureDurationMins,
      seizureType: input.seizureType,
      weightKg: wt,
      salzburgNcseMet,
      autoimmuneNorseSuspected,
      prisRiskFlag,
      firstLineDosing: {
        recommendedDrug: firstLineDrug,
        route: firstLineRoute,
        calculatedDoseMg: calcFirstLineDose,
        maxDoseMg: maxFirstLineDose,
        repeatInstruction
      },
      secondLineDosing: {
        agentOptions,
        preferredAgent
      },
      civaRescuePlan,
      superRefractoryRescuePlan,
      protocolDirectives: directives,
      recommendedAction
    };
  }

  /**
   * Titrates Continuous Anesthetic Infusions based on Continuous EEG (cEEG) patterns.
   */
  public static titrateCeeg(input: LogCeegTitrationInput): CeegTitrationResult {
    let targetAchieved = false;
    let actionRequired: CeegTitrationResult['actionRequired'] = 'MAINTAIN';
    let titrationDirective = '';

    const bsr = input.burstSuppressionRatioPct !== undefined ? input.burstSuppressionRatioPct : 0;
    const bpm = input.burstsPerMinute !== undefined ? input.burstsPerMinute : 0;
    const ibi = input.interburstIntervalSec !== undefined ? input.interburstIntervalSec : 0;

    switch (input.eegPattern) {
      case 'ELECTROGRAPHIC_SEIZURES':
        targetAchieved = false;
        actionRequired = 'UPTITRATE';
        titrationDirective = `Ongoing electrographic seizures detected. Administer STAT bolus of ${input.civaDrug} and increase continuous infusion rate by 20-25% immediately. Continuous target: complete suppression of ictal discharges.`;
        break;

      case 'PERIODIC_DISCHARGES_GPD_LPD':
        targetAchieved = false;
        actionRequired = 'UPTITRATE';
        titrationDirective = `Periodic discharges (GPDs/LPDs) on ictal-interictal continuum. Seizure threshold profoundly lowered. Uptitrate ${input.civaDrug} infusion by 15-20% toward burst-suppression target.`;
        break;

      case 'RHYTHMIC_DELTA_ACTIVITY':
        targetAchieved = false;
        actionRequired = 'UPTITRATE';
        titrationDirective = `Rhythmic delta activity (RDA) indicates subclinical epileptogenic irritation. Increase ${input.civaDrug} infusion to achieve burst suppression.`;
        break;

      case 'BURST_SUPPRESSION':
        // Desired target: BSR 50-80% OR (3-5 bursts/min with interburst intervals >= 10 sec)
        if ((bsr >= 50 && bsr <= 85) || (bpm >= 3 && bpm <= 5 && ibi >= 10)) {
          targetAchieved = true;
          actionRequired = 'MAINTAIN';
          titrationDirective = `TARGET ACHIEVED: Optimal burst-suppression depth (BSR ${bsr}%, ${bpm} bursts/min, IBI ${ibi}s). Maintain current ${input.civaDrug} infusion at ${input.civaRate} ${input.civaRateUnit} for at least 24-48 hours before gradual weaning attempt.`;
        } else if (bsr < 50 || bpm > 5) {
          targetAchieved = false;
          actionRequired = 'UPTITRATE';
          titrationDirective = `Under-suppressed: BSR ${bsr}% is below therapeutic target (50-80%) and burst rate (${bpm}/min) is too frequent. Uptitrate ${input.civaDrug} by 10-15%.`;
        } else {
          // BSR > 85% or excessive suppression
          targetAchieved = false;
          actionRequired = 'DOWNTITRATE_WEAN';
          titrationDirective = `Over-suppressed: BSR ${bsr}% exceeds 85% with prolonged interburst interval (${ibi}s). Risk of irreversible cardiovascular depression or profound hypotension. Reduce ${input.civaDrug} by 10-15%.`;
        }
        break;

      case 'CONTINUOUS_SLOWING_ISOLATED':
        targetAchieved = false;
        actionRequired = 'MAINTAIN';
        titrationDirective = `Diffuse non-epileptiform slowing without ictal patterns. If patient has achieved >= 24h seizure freedom, maintain current dose and consider slow decremental wean (10-20% per 6 hours).`;
        break;

      case 'COMPLETE_SUPPRESSION':
        targetAchieved = false;
        actionRequired = 'DOWNTITRATE_WEAN';
        titrationDirective = `Isoelectric (flat-line) EEG detected. Excessive anesthesia causing complete electrocerebral silence. Immediately downtitrate ${input.civaDrug} to avoid severe PRIS or cardiogenic collapse. Aim for return of 3-5 bursts/min.`;
        break;
    }

    return {
      patientId: input.patientId,
      encounterId: input.encounterId,
      eegPattern: input.eegPattern,
      burstSuppressionRatioPct: input.burstSuppressionRatioPct,
      burstsPerMinute: input.burstsPerMinute,
      interburstIntervalSec: input.interburstIntervalSec,
      targetAchieved,
      civaDrug: input.civaDrug,
      civaRateUnit: input.civaRateUnit,
      civaRate: input.civaRate,
      titrationDirective,
      actionRequired
    };
  }

  /**
   * Persists Status Epilepticus encounter evaluation to the database.
   */
  public static async persistEvaluation(result: StatusEpilepticusEvaluationResult): Promise<number> {
    const query = `
      INSERT INTO status_epilepticus_encounters (
        patient_id,
        seizure_duration_mins,
        seizure_type,
        stage,
        iv_access,
        weight_kg,
        first_line_benzo_given,
        first_line_response,
        second_line_asm_given,
        second_line_response,
        intubated,
        active_civa_infusion,
        salzburg_ncse_met,
        autoimmune_norse_suspected,
        pris_risk_flag,
        protocol_directives,
        recommended_action
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING id;
    `;

    const values = [
      result.patientId,
      result.seizureDurationMins,
      result.seizureType,
      result.stage,
      result.firstLineDosing.route === 'IV',
      result.weightKg,
      result.firstLineDosing.recommendedDrug,
      'PENDING',
      result.secondLineDosing.preferredAgent,
      'PENDING',
      false,
      result.civaRescuePlan?.recommendedCiva || null,
      result.salzburgNcseMet,
      result.autoimmuneNorseSuspected,
      result.prisRiskFlag,
      JSON.stringify(result.protocolDirectives),
      result.recommendedAction
    ];

    const res = await pool.query(query, values);
    return res.rows[0].id;
  }

  /**
   * Persists cEEG titration log to the database.
   */
  public static async persistCeegLog(result: CeegTitrationResult): Promise<number> {
    const query = `
      INSERT INTO continuous_eeg_titration_logs (
        encounter_id,
        patient_id,
        eeg_pattern,
        burst_suppression_ratio_pct,
        bursts_per_minute,
        interburst_interval_sec,
        target_achieved,
        civa_drug,
        civa_rate_unit,
        civa_rate,
        titration_directive
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id;
    `;

    const values = [
      result.encounterId || null,
      result.patientId,
      result.eegPattern,
      result.burstSuppressionRatioPct || null,
      result.burstsPerMinute || null,
      result.interburstIntervalSec || null,
      result.targetAchieved,
      result.civaDrug,
      result.civaRateUnit,
      result.civaRate,
      result.titrationDirective
    ];

    const res = await pool.query(query, values);
    return res.rows[0].id;
  }

  /**
   * Retrieves status epilepticus evaluations for a patient.
   */
  public static async getEvaluations(patientId: number): Promise<any[]> {
    const query = `
      SELECT * FROM status_epilepticus_encounters
      WHERE patient_id = $1
      ORDER BY evaluated_at DESC;
    `;
    const res = await pool.query(query, [patientId]);
    return res.rows;
  }

  /**
   * Retrieves continuous EEG titration logs for a patient.
   */
  public static async getCeegLogs(patientId: number): Promise<any[]> {
    const query = `
      SELECT * FROM continuous_eeg_titration_logs
      WHERE patient_id = $1
      ORDER BY logged_at DESC;
    `;
    const res = await pool.query(query, [patientId]);
    return res.rows;
  }
}
