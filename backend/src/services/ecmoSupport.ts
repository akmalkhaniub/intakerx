import { query } from '../db';

export interface RespScoreParams {
  age: number;
  immunocompromised: boolean;
  hoursVentilatedPriorToEcmo: number;
  diagnosis: 'viral_pneumonia' | 'bacterial_pneumonia' | 'asthma' | 'trauma_burn' | 'other_acute_respiratory';
  cnsDysfunction: boolean;
  nonPulmonaryInfection: boolean;
  bicarbonateMeqL: number;
  pipCmH2o: number;
  pao2Fio2Ratio: number;
}

export interface SaveScoreParams {
  etiology: 'myocarditis' | 'refractory_vt_vf' | 'post_cardiotomy' | 'cardiogenic_shock_ami' | 'other';
  age: number;
  weightKg: number;
  acuteRenalFailure: boolean;
  liverFailure: boolean;
  cnsDysfunction: boolean;
  pulsePressureMmHg: number;
  bicarbonateMeqL: number;
}

export interface CircuitTelemetryInput {
  preMembranePressureMmHg: number;
  postMembranePressureMmHg: number;
  venousDrainagePressureMmHg: number; // e.g. -45 mmHg
  plasmaFreeHemoglobinMgDl: number;
  antiXaIuMl: number;
  apttSeconds: number;
}

export class EcmoSupportService {
  /**
   * Calculates the RESP Score (Respiratory ECMO Survival Prediction) for VV-ECMO.
   */
  static calculateRespScore(params: RespScoreParams): {
    score: number;
    riskClass: 'Class_I' | 'Class_II' | 'Class_III' | 'Class_IV' | 'Class_V';
    predictedSurvivalPercent: number;
    interpretation: string;
  } {
    let score = 0;

    // Age
    if (params.age < 50) score += 0;
    else if (params.age < 60) score -= 2;
    else score -= 3;

    // Immunocompromised
    if (params.immunocompromised) score -= 2;

    // Mechanical ventilation duration
    if (params.hoursVentilatedPriorToEcmo < 48) score += 3;
    else if (params.hoursVentilatedPriorToEcmo <= 168) score += 1;
    else score -= 1;

    // Diagnosis
    if (params.diagnosis === 'asthma') score += 11;
    else if (params.diagnosis === 'viral_pneumonia') score += 3;
    else if (params.diagnosis === 'bacterial_pneumonia') score += 3;
    else if (params.diagnosis === 'trauma_burn') score += 3;
    else score += 1;

    // CNS dysfunction
    if (params.cnsDysfunction) score -= 7;

    // Non-pulmonary infection
    if (params.nonPulmonaryInfection) score -= 1;

    // Bicarbonate < 15
    if (params.bicarbonateMeqL < 15) score -= 2;

    // PIP >= 42
    if (params.pipCmH2o >= 42) score -= 1;

    // P/F ratio < 80
    if (params.pao2Fio2Ratio < 80) score -= 1;

    let riskClass: 'Class_I' | 'Class_II' | 'Class_III' | 'Class_IV' | 'Class_V';
    let predictedSurvivalPercent = 50;

    if (score >= 6) {
      riskClass = 'Class_I';
      predictedSurvivalPercent = 92;
    } else if (score >= 3) {
      riskClass = 'Class_II';
      predictedSurvivalPercent = 76;
    } else if (score >= -1) {
      riskClass = 'Class_III';
      predictedSurvivalPercent = 57;
    } else if (score >= -5) {
      riskClass = 'Class_IV';
      predictedSurvivalPercent = 33;
    } else {
      riskClass = 'Class_V';
      predictedSurvivalPercent = 18;
    }

    const interpretation = `RESP Score = ${score} (${riskClass}). Projected in-hospital survival with VV-ECMO: ${predictedSurvivalPercent}%.`;

    return {
      score,
      riskClass,
      predictedSurvivalPercent,
      interpretation
    };
  }

  /**
   * Calculates the SAVE Score (Survival After Veno-Arterial ECMO) for cardiogenic shock.
   */
  static calculateSaveScore(params: SaveScoreParams): {
    score: number;
    riskClass: 'Class_I' | 'Class_II' | 'Class_III' | 'Class_IV' | 'Class_V';
    predictedSurvivalPercent: number;
    interpretation: string;
  } {
    let score = 0;

    // Underlying Etiology
    if (params.etiology === 'myocarditis') score += 3;
    else if (params.etiology === 'refractory_vt_vf') score += 2;
    else if (params.etiology === 'post_cardiotomy') score -= 2;

    // Age
    if (params.age < 39) score += 0;
    else if (params.age <= 52) score -= 1;
    else score -= 3;

    // Weight
    if (params.weightKg < 65 || params.weightKg > 90) score -= 1;

    // Organ dysfunction
    if (params.acuteRenalFailure) score -= 3;
    if (params.liverFailure) score -= 2;
    if (params.cnsDysfunction) score -= 4;

    // Pulse Pressure <= 20 mmHg
    if (params.pulsePressureMmHg <= 20) score -= 3;

    // Bicarbonate < 15
    if (params.bicarbonateMeqL < 15) score -= 3;

    let riskClass: 'Class_I' | 'Class_II' | 'Class_III' | 'Class_IV' | 'Class_V';
    let predictedSurvivalPercent = 40;

    if (score > 5) {
      riskClass = 'Class_I';
      predictedSurvivalPercent = 75;
    } else if (score >= 1) {
      riskClass = 'Class_II';
      predictedSurvivalPercent = 58;
    } else if (score >= -4) {
      riskClass = 'Class_III';
      predictedSurvivalPercent = 42;
    } else if (score >= -9) {
      riskClass = 'Class_IV';
      predictedSurvivalPercent = 30;
    } else {
      riskClass = 'Class_V';
      predictedSurvivalPercent = 18;
    }

    const interpretation = `SAVE Score = ${score} (${riskClass}). Projected in-hospital survival with VA-ECMO: ${predictedSurvivalPercent}%.`;

    return {
      score,
      riskClass,
      predictedSurvivalPercent,
      interpretation
    };
  }

  /**
   * Analyzes real-time ECMO circuit pressures, trans-membrane gradient, and hemolysis biomarkers.
   */
  static evaluateCircuitTelemetry(data: CircuitTelemetryInput): {
    transmembraneDeltaP: number;
    membraneClotRisk: 'normal' | 'moderate_thrombus' | 'critical_failure';
    chatterDetected: boolean;
    hemolysisSeverity: 'normal' | 'elevated' | 'severe_pump_head_shear';
    anticoagulationStatus: 'subtherapeutic' | 'therapeutic' | 'supratherapeutic';
    alerts: string[];
  } {
    const transmembraneDeltaP = data.preMembranePressureMmHg - data.postMembranePressureMmHg;
    const alerts: string[] = [];

    let membraneClotRisk: 'normal' | 'moderate_thrombus' | 'critical_failure' = 'normal';
    if (transmembraneDeltaP >= 55) {
      membraneClotRisk = 'critical_failure';
      alerts.push(`CRITICAL: Transmembrane pressure gradient ΔP (${transmembraneDeltaP} mmHg >= 55) signifies extensive oxygenator thrombosis. Prepare emergent circuit exchange.`);
    } else if (transmembraneDeltaP >= 40) {
      membraneClotRisk = 'moderate_thrombus';
      alerts.push(`WARNING: Elevated ΔP (${transmembraneDeltaP} mmHg >= 40). Monitor closely for clot propagation.`);
    }

    // Venous drainage line chatter / suckdown
    const chatterDetected = data.venousDrainagePressureMmHg <= -90;
    if (chatterDetected) {
      alerts.push(`CHATTER ALERT: Venous drainage suction (${data.venousDrainagePressureMmHg} mmHg <= -90). Intravascular hypovolemia or cannula vascular wall suckdown. Reduce RPM or infuse volume.`);
    }

    // Plasma Free Hemoglobin (pfHb)
    let hemolysisSeverity: 'normal' | 'elevated' | 'severe_pump_head_shear' = 'normal';
    if (data.plasmaFreeHemoglobinMgDl >= 50.0) {
      hemolysisSeverity = 'severe_pump_head_shear';
      alerts.push(`HEMOLYSIS CRISIS: Plasma Free Hemoglobin (${data.plasmaFreeHemoglobinMgDl} mg/dL >= 50). Severe mechanical red cell shearing or pump head clot.`);
    } else if (data.plasmaFreeHemoglobinMgDl >= 25.0) {
      hemolysisSeverity = 'elevated';
      alerts.push(`ELEVATED pfHb (${data.plasmaFreeHemoglobinMgDl} mg/dL): Mild mechanical hemolysis.`);
    }

    // Anticoagulation evaluation (Anti-Xa target 0.3 - 0.5 IU/mL)
    let anticoagulationStatus: 'subtherapeutic' | 'therapeutic' | 'supratherapeutic' = 'therapeutic';
    if (data.antiXaIuMl < 0.25 || data.apttSeconds < 55) {
      anticoagulationStatus = 'subtherapeutic';
      alerts.push(`ANTICOAGULATION DEFICIT: Anti-Xa ${data.antiXaIuMl} IU/mL < 0.30 target. High risk of circuit thrombosis.`);
    } else if (data.antiXaIuMl > 0.65 || data.apttSeconds > 90) {
      anticoagulationStatus = 'supratherapeutic';
      alerts.push(`ANTICOAGULATION EXCESS: Anti-Xa ${data.antiXaIuMl} IU/mL > 0.50 target. High risk of cannulation site or intracranial hemorrhage.`);
    }

    return {
      transmembraneDeltaP,
      membraneClotRisk,
      chatterDetected,
      hemolysisSeverity,
      anticoagulationStatus,
      alerts
    };
  }

  /**
   * Initiates a new ECMO run in the database.
   */
  static async initiateEcmoRun(patientId: number, data: {
    ecmoType: 'VV_ECMO' | 'VA_ECMO' | 'ECPR' | 'Impella_CP' | 'ECPELLA';
    cannulationConfig: string;
    cannulaSizeDrainageFr: number;
    cannulaSizeReturnFr: number;
    distalPerfusionCannulaPlaced?: boolean;
    indicationDiagnosis: string;
    baselinePfRatio?: number;
    respScore?: number;
    saveScore?: number;
    survivalRiskClass?: string;
    pumpRpm: number;
    bloodFlowLpm: number;
    sweepGasLpm: number;
    sweepFio2Percent: number;
  }) {
    const res = await query(
      `INSERT INTO ecmo_runs (
        patient_id, ecmo_type, cannulation_config, cannula_size_drainage_fr,
        cannula_size_return_fr, distal_perfusion_cannula_placed, indication_diagnosis,
        baseline_pf_ratio, resp_score, save_score, survival_risk_class,
        pump_rpm, blood_flow_lpm, sweep_gas_lpm, sweep_fio2_percent,
        circuit_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'active_run')
      RETURNING *`,
      [
        patientId,
        data.ecmoType,
        data.cannulationConfig,
        data.cannulaSizeDrainageFr,
        data.cannulaSizeReturnFr,
        data.distalPerfusionCannulaPlaced ?? true,
        data.indicationDiagnosis,
        data.baselinePfRatio || null,
        data.respScore || null,
        data.saveScore || null,
        data.survivalRiskClass || null,
        data.pumpRpm,
        data.bloodFlowLpm,
        data.sweepGasLpm,
        data.sweepFio2Percent
      ]
    );

    return res.rows[0];
  }

  /**
   * Records live circuit pressure and biomarker telemetry.
   */
  static async recordCircuitTelemetry(runId: number, data: CircuitTelemetryInput) {
    const analysis = this.evaluateCircuitTelemetry(data);

    const res = await query(
      `INSERT INTO ecmo_circuit_telemetry (
        ecmo_run_id, pre_membrane_pressure_mmhg, post_membrane_pressure_mmhg,
        transmembrane_delta_p_mmhg, venous_drainage_pressure_mmhg,
        plasma_free_hemoglobin_mg_dl, anti_xa_iu_ml, aptt_seconds,
        chatter_detected, membrane_clot_alert
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        runId,
        data.preMembranePressureMmHg,
        data.postMembranePressureMmHg,
        analysis.transmembraneDeltaP,
        data.venousDrainagePressureMmHg,
        data.plasmaFreeHemoglobinMgDl,
        data.antiXaIuMl,
        data.apttSeconds,
        analysis.chatterDetected,
        analysis.membraneClotRisk === 'critical_failure'
      ]
    );

    return {
      telemetry: res.rows[0],
      analysis
    };
  }

  /**
   * Adjusts pump RPM, blood flow, or sweep gas parameters.
   */
  static async adjustSweepAndRpm(runId: number, updates: {
    pumpRpm?: number;
    bloodFlowLpm?: number;
    sweepGasLpm?: number;
    sweepFio2Percent?: number;
  }) {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.pumpRpm !== undefined) {
      fields.push(`pump_rpm = $${idx++}`);
      values.push(updates.pumpRpm);
    }
    if (updates.bloodFlowLpm !== undefined) {
      fields.push(`blood_flow_lpm = $${idx++}`);
      values.push(updates.bloodFlowLpm);
    }
    if (updates.sweepGasLpm !== undefined) {
      fields.push(`sweep_gas_lpm = $${idx++}`);
      values.push(updates.sweepGasLpm);
    }
    if (updates.sweepFio2Percent !== undefined) {
      fields.push(`sweep_fio2_percent = $${idx++}`);
      values.push(updates.sweepFio2Percent);
    }

    if (fields.length === 0) return null;

    values.push(runId);
    const sql = `UPDATE ecmo_runs SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    const res = await query(sql, values);
    return res.rows[0];
  }

  /**
   * Decannulates ECMO circuit.
   */
  static async decannulateCircuit(runId: number, outcome: string) {
    const res = await query(
      `UPDATE ecmo_runs
       SET circuit_status = $1, decannulated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [outcome, runId]
    );
    return res.rows[0];
  }

  /**
   * Lists ECMO runs.
   */
  static async getEcmoRuns(patientId?: number) {
    let sql = 'SELECT * FROM ecmo_runs';
    const params: any[] = [];
    if (patientId) {
      sql += ' WHERE patient_id = $1';
      params.push(patientId);
    }
    sql += ' ORDER BY cannulated_at DESC';
    const res = await query(sql, params);
    return res.rows;
  }
}
