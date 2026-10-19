import { pool } from '../db';

export interface ImpellaAssessmentInput {
  device_model: 'IMPELLA_2_5' | 'IMPELLA_CP' | 'IMPELLA_5_0' | 'IMPELLA_5_5' | 'IMPELLA_RP';
  current_p_level: string; // e.g. 'P-8'
  flow_rate_l_min: number;
  motor_current_ma?: number;
  purge_pressure_mmhg: number; // Normal 300 - 1100 mmHg
  purge_flow_ml_hr: number; // Normal 2 - 30 mL/hr
  suction_alarm_active: boolean;
  map_mmhg: number;
  cvp_mmhg?: number;
  pcwp_mmhg?: number;
}

export interface ImpellaAssessmentResult {
  status: 'OPTIMAL' | 'SUCTION_EVENT' | 'PURGE_SYSTEM_ALARM' | 'MALPOSITION_SUSPECTED' | 'HYPOVOLEMIA';
  recommended_p_level: string;
  purge_system_action: string;
  hemodynamic_guidance: string[];
  bedside_interventions: string[];
}

export interface DurableLvadTelemetryInput {
  device_type: 'HEARTMATE_3' | 'HEARTWARE_HVAD';
  speed_rpm: number; // e.g. 5400 RPM
  flow_l_min: number; // Target 4.0 - 6.0 L/min
  power_watts: number; // Target 4.0 - 6.5 W
  baseline_power_watts: number;
  pulsatility_index: number; // Target 3.0 - 6.0
  baseline_pi: number;
  doppler_map_mmhg: number; // Target 70 - 80 mmHg
  ldh_u_l?: number; // Normal < 250 U/L, Thrombosis >= 2.5x ULN (>= 625 U/L)
  plasma_free_hgb_mg_dl?: number; // > 40 mg/dL severe hemolysis
  hematuria_or_dark_urine?: boolean;
}

export interface DurableLvadTelemetryResult {
  alarm_classification: 'NORMAL' | 'LOW_FLOW' | 'PUMP_THROMBOSIS_SUSPECTED' | 'HYPERTENSION_HIGH_AFTERLOAD' | 'SUCTION_COLLAPSE';
  thrombosis_risk_level: 'LOW' | 'MODERATE' | 'HIGH_CRITICAL';
  afterload_status: 'OPTIMAL_70_80' | 'HYPERTENSIVE_HIGH_RISK' | 'HYPOTENSIVE';
  power_differential_watts: number;
  pi_differential: number;
  anticoagulation_recommendation: string;
  blood_pressure_recommendation: string;
  actionable_checklist: string[];
}

export interface PostLvadRvFailureInput {
  cvp_mmhg: number;
  pcwp_mmhg: number;
  systolic_pap_mmhg: number;
  diastolic_pap_mmhg: number;
  inotropic_support_active: boolean;
  signs_of_systemic_congestion: boolean;
}

export interface PostLvadRvFailureResult {
  rv_failure_detected: boolean;
  rvf_severity: 'NONE' | 'MILD_MODERATE' | 'SEVERE_REFRACTORY';
  cvp_pcwp_ratio: number;
  papi_score: number;
  inotropic_optimization: string;
  pulmonary_vasodilator_advice: string;
  rvad_mechanical_support_indicated: boolean;
  hemodynamic_action_plan: string[];
}

export class VadPulseService {
  /**
   * Evaluates Impella microaxial flow pump performance and suction events
   */
  static evaluateImpella(input: ImpellaAssessmentInput): ImpellaAssessmentResult {
    const actions: string[] = [];
    const guidance: string[] = [];
    let status: 'OPTIMAL' | 'SUCTION_EVENT' | 'PURGE_SYSTEM_ALARM' | 'MALPOSITION_SUSPECTED' | 'HYPOVOLEMIA' = 'OPTIMAL';
    let recPLevel = input.current_p_level;

    // Purge system assessment: normal purge pressure 300 - 1100 mmHg, flow 2 - 30 mL/hr
    let purgeAction = 'Purge pressure and flow within normal physiological limits.';
    if (input.purge_pressure_mmhg > 1100 || input.purge_flow_ml_hr < 2) {
      purgeAction = 'CRITICAL: Purge lumen occlusion or biomaterial deposition. Inspect tubing for kinking; flush or switch purge cassette with 20% Dextrose + Heparin.';
      status = 'PURGE_SYSTEM_ALARM';
      actions.push('Check purge cassette and pressure transducer for crystallization or fibrin clot.');
    } else if (input.purge_pressure_mmhg < 300 || input.purge_flow_ml_hr > 30) {
      purgeAction = 'WARNING: Purge system leak suspected. Inspect all luer locks, purge disc, and cannula connection for fluid leakage.';
      status = 'PURGE_SYSTEM_ALARM';
      actions.push('Tighten purge line connections; check for external purge fluid extravasation.');
    }

    // Suction event / cannula malposition
    if (input.suction_alarm_active) {
      status = 'SUCTION_EVENT';
      // Step down P-level to break suction contact with intraventricular septum or papillary muscle
      const currentLevelNum = parseInt(input.current_p_level.replace('P-', ''), 10) || 8;
      const stepDownLevel = Math.max(2, currentLevelNum - 4);
      recPLevel = `P-${stepDownLevel}`;

      actions.push(`SUCTION ALARM ACTIVE: Inflow cannula suctioning against LV wall. Immediately step down from ${input.current_p_level} to ${recPLevel}.`);
      actions.push('Administer IV crystalloid fluid challenge (250-500 mL) if CVP or PCWP indicates hypovolemia.');
      actions.push('Perform STAT bedside echocardiogram (TTE/TEE) to verify inlet position 3.5 - 4.0 cm below aortic valve leaflet plane into LV cavity.');

      if (input.cvp_mmhg !== undefined && input.cvp_mmhg < 8) {
        guidance.push('Hypovolemia identified as primary trigger for ventricular suction. Correct circulating volume.');
      }
    } else if (input.flow_rate_l_min < 2.0 && input.current_p_level !== 'P-1' && input.current_p_level !== 'P-2') {
      status = 'MALPOSITION_SUSPECTED';
      actions.push('Inadequate forward microaxial flow for current P-level. Screen for aortic valve impingement, cannula migration into aorta, or kink.');
    } else {
      guidance.push(`Stable hemodynamic unloading on ${input.current_p_level} (Flow: ${input.flow_rate_l_min} L/min). Target MAP: 65 - 85 mmHg.`);
    }

    return {
      status,
      recommended_p_level: recPLevel,
      purge_system_action: purgeAction,
      hemodynamic_guidance: guidance,
      bedside_interventions: actions
    };
  }

  /**
   * Evaluates Durable LVAD (HeartMate 3 / HVAD) Telemetry and Screens for Pump Thrombosis
   */
  static evaluateDurableLvad(input: DurableLvadTelemetryInput): DurableLvadTelemetryResult {
    const actions: string[] = [];
    const powerDelta = Math.round((input.power_watts - input.baseline_power_watts) * 100) / 100;
    const piDelta = Math.round((input.pulsatility_index - input.baseline_pi) * 10) / 10;

    // 1. Thrombosis Sentinel: Power spike >= 2.0W above baseline, or LDH >= 2.5x ULN (~625 U/L), or plasma free Hgb > 40 mg/dL
    const isLdhHigh = input.ldh_u_l !== undefined && input.ldh_u_l >= 625;
    const isHemolysisHigh = (input.plasma_free_hgb_mg_dl !== undefined && input.plasma_free_hgb_mg_dl >= 40) || Boolean(input.hematuria_or_dark_urine);
    const isPowerSpike = powerDelta >= 2.0;

    let thrombosisRisk: 'LOW' | 'MODERATE' | 'HIGH_CRITICAL' = 'LOW';
    let alarmClass: 'NORMAL' | 'LOW_FLOW' | 'PUMP_THROMBOSIS_SUSPECTED' | 'HYPERTENSION_HIGH_AFTERLOAD' | 'SUCTION_COLLAPSE' = 'NORMAL';
    let anticoagRec = 'Maintain therapeutic warfarin target INR 2.0 - 3.0 + Aspirin 81-325 mg daily.';

    if (isPowerSpike && (isLdhHigh || isHemolysisHigh)) {
      thrombosisRisk = 'HIGH_CRITICAL';
      alarmClass = 'PUMP_THROMBOSIS_SUSPECTED';
      anticoagRec = 'EMERGENT THROMBOSIS REGIMEN: Initiate therapeutic IV Unfractionated Heparin (target anti-Xa 0.3 - 0.7 or aPTT 60-80s) or IV Bivalirudin. Consult cardiothoracic surgery for urgent surgical pump exchange or catheter-directed thrombolysis (Alteplase).';
      actions.push('CRITICAL PUMP THROMBOSIS DETECTED: Significant power spike concurrent with severe intravascular shear hemolysis.');
      actions.push('Obtain STAT echocardiographic ramp study and plasma free hemoglobin.');
      actions.push('Hold non-essential blood transfusions and prepare surgical suite.');
    } else if (isPowerSpike || isLdhHigh) {
      thrombosisRisk = 'MODERATE';
      alarmClass = 'PUMP_THROMBOSIS_SUSPECTED';
      anticoagRec = 'Check STAT INR, anti-Xa, and platelet count. Bridge with therapeutic enoxaparin or IV heparin if subtherapeutic INR < 2.0.';
      actions.push('Isolated power elevation or rising LDH. Intensify anticoagulation surveillance.');
    }

    // 2. Flow & Suction Evaluation
    if (input.flow_l_min < 3.0) {
      if (thrombosisRisk !== 'HIGH_CRITICAL') {
        alarmClass = 'LOW_FLOW';
      }
      actions.push(`LOW FLOW ALARM (${input.flow_l_min} L/min < 3.0 L/min). Differential: Hypovolemia, right ventricular failure, cardiac tamponade, or extreme afterload.`);
      if (piDelta <= -1.5) {
        alarmClass = 'SUCTION_COLLAPSE';
        actions.push('Low flow with significant PI reduction suggests left ventricular suction collapse. Consider volume infusion or lowering pump speed.');
      }
    }

    // 3. Afterload / Blood Pressure Management
    let afterloadStatus: 'OPTIMAL_70_80' | 'HYPERTENSIVE_HIGH_RISK' | 'HYPOTENSIVE' = 'OPTIMAL_70_80';
    let bpRec = 'Doppler opening pressure within ideal hemodynamic target (70 - 80 mmHg).';

    if (input.doppler_map_mmhg > 85) {
      afterloadStatus = 'HYPERTENSIVE_HIGH_RISK';
      if (alarmClass === 'NORMAL') alarmClass = 'HYPERTENSION_HIGH_AFTERLOAD';
      bpRec = `ELEVATED AFTERLOAD (Doppler MAP ${input.doppler_map_mmhg} mmHg > 85 mmHg). High risk for decreased forward flow, aortic valve regurgitation, and hemorrhagic stroke. Initiate IV Nicardipine or uptitrate oral ACEi/ARB/Hydralazine to target MAP 70-80 mmHg.`;
      actions.push('Aggressive afterload reduction indicated to preserve pump flow and protect cerebral vasculature.');
    } else if (input.doppler_map_mmhg < 65) {
      afterloadStatus = 'HYPOTENSIVE';
      bpRec = `Hypotension detected (Doppler MAP ${input.doppler_map_mmhg} mmHg < 65 mmHg). Evaluate for bleeding, sepsis, or acute RV failure.`;
      actions.push('Assess volume status, hematocrit, and vasopressor requirements.');
    }

    return {
      alarm_classification: alarmClass,
      thrombosis_risk_level: thrombosisRisk,
      afterload_status: afterloadStatus,
      power_differential_watts: powerDelta,
      pi_differential: piDelta,
      anticoagulation_recommendation: anticoagRec,
      blood_pressure_recommendation: bpRec,
      actionable_checklist: actions
    };
  }

  /**
   * Evaluates Post-LVAD Right Ventricular Failure (RVF) and Hemodynamic Indexes
   */
  static evaluatePostLvadRvFailure(input: PostLvadRvFailureInput): PostLvadRvFailureResult {
    // 1. CVP / PCWP Ratio (Abnormal > 0.63)
    const cvpPcwpRatio = input.pcwp_mmhg > 0
      ? Math.round((input.cvp_mmhg / input.pcwp_mmhg) * 100) / 100
      : 0;

    // 2. Pulmonary Artery Pulsatility Index (PAPi = (sPAP - dPAP) / CVP)
    // Low PAPi < 2.0 or < 1.85 strongly indicates RV failure
    const pulsePressure = input.systolic_pap_mmhg - input.diastolic_pap_mmhg;
    const papi = input.cvp_mmhg > 0
      ? Math.round((pulsePressure / input.cvp_mmhg) * 100) / 100
      : 0;

    let isRvFailure = false;
    let severity: 'NONE' | 'MILD_MODERATE' | 'SEVERE_REFRACTORY' = 'NONE';
    let inotropicOpt = 'Wean inotropes gradually as hemodynamics allow.';
    let pulmVasodilator = 'Not indicated in absence of pulmonary hypertension or RV congestion.';
    let rvadIndicated = false;
    const plan: string[] = [];

    if (input.cvp_mmhg > 15 || cvpPcwpRatio > 0.63 || papi < 2.0 || input.signs_of_systemic_congestion) {
      isRvFailure = true;

      if (papi < 1.5 && input.cvp_mmhg >= 18 && input.inotropic_support_active) {
        severity = 'SEVERE_REFRACTORY';
        rvadIndicated = true;
        inotropicOpt = 'Maximal dual inotropic support (Epinephrine 0.03 - 0.1 mcg/kg/min + Milrinone 0.375 - 0.5 mcg/kg/min or Dobutamine).';
        pulmVasodilator = 'Initiate Inhaled Nitric Oxide (iNO 20-40 ppm) or inhaled Epoprostenol to reduce RV afterload without causing systemic vasodilation.';
        plan.push('SEVERE REFRACTORY RV FAILURE: High CVP, low PAPi < 1.5, and failure of inotropic therapy.');
        plan.push('Immediate surgical evaluation for temporary mechanical Right Ventricular Assist Device (RVAD / Impella RP / ProtekDuo).');
      } else {
        severity = 'MILD_MODERATE';
        inotropicOpt = 'Initiate or uptitrate inotropic support: Milrinone (0.25 - 0.375 mcg/kg/min) or Dobutamine (2.5 - 5.0 mcg/kg/min).';
        pulmVasodilator = 'Consider Inhaled Epoprostenol or sildenafil if pulmonary vascular resistance is elevated.';
        plan.push('Acute RV failure detected. Restrict fluids, optimize inotropy, and titrate loop diuretics.');
      }

      plan.push(`CVP/PCWP Ratio: ${cvpPcwpRatio} (> 0.63 threshold confirms disproportionate right-sided volume overload).`);
      plan.push(`PAPi Score: ${papi} (< 2.0 indicates impaired RV systolic contractile reserve).`);
    } else {
      plan.push(`RV function preserved. CVP ${input.cvp_mmhg} mmHg, PAPi ${papi} >= 2.0, CVP/PCWP ${cvpPcwpRatio} <= 0.63.`);
    }

    return {
      rv_failure_detected: isRvFailure,
      rvf_severity: severity,
      cvp_pcwp_ratio: cvpPcwpRatio,
      papi_score: papi,
      inotropic_optimization: inotropicOpt,
      pulmonary_vasodilator_advice: pulmVasodilator,
      rvad_mechanical_support_indicated: rvadIndicated,
      hemodynamic_action_plan: plan
    };
  }

  /**
   * Persists a Mechanical VAD Device entry
   */
  static async registerVadDevice(params: {
    patient_id: number;
    device_category: string;
    implant_date: string | Date;
    set_speed_rpm: number;
    current_p_level?: string;
    purge_fluid_type?: string;
    baseline_power_watts?: number;
    baseline_pi?: number;
    target_map_mmhg_min?: number;
    target_map_mmhg_max?: number;
    active_status?: boolean;
  }) {
    const query = `
      INSERT INTO mechanical_vad_devices (
        patient_id,
        device_category,
        implant_date,
        set_speed_rpm,
        current_p_level,
        purge_fluid_type,
        baseline_power_watts,
        baseline_pi,
        target_map_mmhg_min,
        target_map_mmhg_max,
        active_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `;
    const values = [
      params.patient_id,
      params.device_category,
      params.implant_date,
      params.set_speed_rpm,
      params.current_p_level || null,
      params.purge_fluid_type || null,
      params.baseline_power_watts || null,
      params.baseline_pi || null,
      params.target_map_mmhg_min || 70,
      params.target_map_mmhg_max || 80,
      params.active_status !== undefined ? params.active_status : true
    ];
    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  /**
   * Logs a VAD Telemetry and Alarm entry
   */
  static async logVadTelemetryAlarm(params: {
    device_id: number;
    patient_id: number;
    flow_l_min: number;
    power_watts: number;
    pulsatility_index?: number;
    doppler_map_mmhg: number;
    ldh_u_l?: number;
    plasma_free_hgb_mg_dl?: number;
    cvp_mmhg?: number;
    pcwp_mmhg?: number;
    papi_score?: number;
    alarm_type: string;
    thrombosis_risk_alert: boolean;
    rv_failure_alert: boolean;
  }) {
    const query = `
      INSERT INTO vad_telemetry_alarms (
        device_id,
        patient_id,
        flow_l_min,
        power_watts,
        pulsatility_index,
        doppler_map_mmhg,
        ldh_u_l,
        plasma_free_hgb_mg_dl,
        cvp_mmhg,
        pcwp_mmhg,
        papi_score,
        alarm_type,
        thrombosis_risk_alert,
        rv_failure_alert
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *;
    `;
    const values = [
      params.device_id,
      params.patient_id,
      params.flow_l_min,
      params.power_watts,
      params.pulsatility_index || null,
      params.doppler_map_mmhg,
      params.ldh_u_l || null,
      params.plasma_free_hgb_mg_dl || null,
      params.cvp_mmhg || null,
      params.pcwp_mmhg || null,
      params.papi_score || null,
      params.alarm_type,
      params.thrombosis_risk_alert,
      params.rv_failure_alert
    ];
    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  /**
   * Retrieves VAD devices and telemetry alarms for a patient
   */
  static async getPatientVadHistory(patientId: number) {
    const devicesQuery = `
      SELECT * FROM mechanical_vad_devices
      WHERE patient_id = $1
      ORDER BY created_at DESC
      LIMIT 20;
    `;
    const alarmsQuery = `
      SELECT * FROM vad_telemetry_alarms
      WHERE patient_id = $1
      ORDER BY logged_at DESC
      LIMIT 20;
    `;
    const [devRes, alarmRes] = await Promise.all([
      pool.query(devicesQuery, [patientId]),
      pool.query(alarmsQuery, [patientId])
    ]);
    return {
      devices: devRes.rows,
      telemetry_alarms: alarmRes.rows
    };
  }
}
