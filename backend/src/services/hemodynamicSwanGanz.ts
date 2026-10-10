import { pool } from '../db';

export interface PACHemodynamicInput {
  patientId: number;
  heartRate: number; // bpm
  systolicBp: number; // mmHg
  diastolicBp: number; // mmHg
  mapMmhg?: number; // optional, calculated if missing: (2*diastolic + systolic)/3
  cvpMmhg: number; // Central Venous Pressure / Right Atrial Pressure (normal: 2-8 mmHg)
  mpapMmhg: number; // Mean Pulmonary Artery Pressure (normal: 10-20 mmHg)
  pcwpMmhg: number; // Pulmonary Capillary Wedge Pressure (normal: 6-12 mmHg)
  cardiacOutputLMin: number; // L/min (normal: 4.0-8.0)
  heightCm: number; // cm
  weightKg: number; // kg
  sao2Percent: number; // Arterial O2 Saturation (e.g. 98%)
  svo2Percent: number; // Mixed Venous O2 Saturation (normal: 65-75%)
  hgbGDl: number; // Hemoglobin (e.g. 12.5 g/dL)
  pao2Mmhg?: number; // Arterial PaO2 (default: 90)
  pvo2Mmhg?: number; // Mixed Venous PvO2 (default: 40)
}

export type ForresterQuadrant = 'Warm_Dry' | 'Warm_Wet' | 'Cold_Dry' | 'Cold_Wet';

export interface PACHemodynamicProfile {
  patientId: number;
  bsaM2: number;
  cardiacIndex: number;
  strokeVolumeMl: number;
  strokeVolumeIndex: number;
  mapMmhg: number;
  svrDynes: number;
  svriDynes: number;
  pvrDynes: number;
  pvriDynes: number;
  pvrWoodUnits: number;
  lvswi: number;
  rvswi: number;
  cao2MlDl: number;
  cvo2MlDl: number;
  do2Index: number;
  vo2Index: number;
  o2ExtractionRatioPercent: number;
  forresterQuadrant: ForresterQuadrant;
  quadrantDescription: string;
  therapeuticRecommendations: string[];
  clinicalAlerts: {
    level: 'info' | 'warning' | 'critical';
    title: string;
    description: string;
  }[];
}

export interface PACSafetyInput {
  patientId: number;
  balloonInflationVolumeMl: number; // Max 1.5 mL
  inflationDurationSeconds: number; // Max 15 seconds
  spontaneousWedgeDetected: boolean;
  pressureWaveformDamped: boolean;
  currentMpapMmhg: number;
  currentPcwpMmhg: number;
}

export interface PACSafetyAssessment {
  patientId: number;
  airLockoutTriggered: boolean;
  overinflationRisk: boolean;
  prolongedInflationRisk: boolean;
  catheterMigrationAlert: boolean;
  pulmonaryRuptureRisk: 'low' | 'moderate' | 'high' | 'imminent';
  recommendedActions: string[];
  safetyEventsToLog: {
    eventType: string;
    severity: 'warning' | 'critical' | 'life_threatening';
    warningMessage: string;
    actionTaken: string;
  }[];
}

export class HemodynamicSwanGanzService {
  /**
   * Calculates Body Surface Area using DuBois formula
   */
  public static calculateBSA(heightCm: number, weightKg: number): number {
    if (heightCm <= 0 || weightKg <= 0) return 1.73; // standard adult default
    const bsa = 0.007184 * Math.pow(weightKg, 0.425) * Math.pow(heightCm, 0.725);
    return Math.round(bsa * 100) / 100;
  }

  /**
   * Computes comprehensive Swan-Ganz thermodilution hemodynamic profile
   */
  public static calculateProfile(input: PACHemodynamicInput): PACHemodynamicProfile {
    const bsa = this.calculateBSA(input.heightCm, input.weightKg);
    const map = input.mapMmhg ?? Math.round((input.systolicBp + 2 * input.diastolicBp) / 3);

    // Derived Hemodynamics
    const ci = Math.round((input.cardiacOutputLMin / bsa) * 100) / 100;
    const sv = Math.round(((input.cardiacOutputLMin * 1000) / input.heartRate) * 10) / 10;
    const svi = Math.round((sv / bsa) * 10) / 10;

    // Resistances: dynes*sec/cm^5 = ((P_mean - P_downstream) / CO) * 80
    const co = Math.max(input.cardiacOutputLMin, 0.5); // protect div by zero
    const svr = Math.round(((map - input.cvpMmhg) / co) * 80);
    const svri = Math.round(svr * bsa);

    const transpulmonaryGradient = Math.max(input.mpapMmhg - input.pcwpMmhg, 0);
    const pvr = Math.round((transpulmonaryGradient / co) * 80);
    const pvri = Math.round(pvr * bsa);
    const pvrWoodUnits = Math.round((transpulmonaryGradient / co) * 10) / 10;

    // Stroke Work Indices
    // LVSWI = 0.0136 * (MAP - PCWP) * SVI
    const lvswi = Math.round(0.0136 * Math.max(map - input.pcwpMmhg, 0) * svi * 10) / 10;
    // RVSWI = 0.0136 * (mPAP - CVP) * SVI
    const rvswi = Math.round(0.0136 * Math.max(input.mpapMmhg - input.cvpMmhg, 0) * svi * 10) / 10;

    // Oxygen Content & Delivery
    const pao2 = input.pao2Mmhg ?? 90;
    const pvo2 = input.pvo2Mmhg ?? 40;
    const cao2 = Math.round(((input.hgbGDl * 1.34 * (input.sao2Percent / 100)) + (pao2 * 0.0031)) * 10) / 10;
    const cvo2 = Math.round(((input.hgbGDl * 1.34 * (input.svo2Percent / 100)) + (pvo2 * 0.0031)) * 10) / 10;

    // Delivery & Consumption Indices
    const do2i = Math.round(ci * cao2 * 10);
    const vo2i = Math.round(ci * Math.max(cao2 - cvo2, 0.1) * 10);
    const o2er = cao2 > 0 ? Math.round(((cao2 - cvo2) / cao2) * 1000) / 10 : 25;

    // Forrester / Stevenson Quadrant Classification
    // CI cut-off: 2.2 L/min/m2; PCWP cut-off: 18 mmHg
    let forresterQuadrant: ForresterQuadrant = 'Warm_Dry';
    let quadrantDescription = '';
    const recommendations: string[] = [];
    const alerts: PACHemodynamicProfile['clinicalAlerts'] = [];

    if (ci >= 2.2 && input.pcwpMmhg <= 18) {
      forresterQuadrant = 'Warm_Dry';
      quadrantDescription = 'Quadrant I: Compensated Hemodynamics (Adequate perfusion, euvolemic)';
      recommendations.push('Maintain current baseline hemodynamics and optimize oral guideline-directed medical therapy (GDMT).');
      recommendations.push('Monitor fluid balance and titrate maintenance infusions.');
    } else if (ci >= 2.2 && input.pcwpMmhg > 18) {
      forresterQuadrant = 'Warm_Wet';
      quadrantDescription = 'Quadrant II: Pulmonary Congestion / Volume Overload (Adequate perfusion, elevated filling pressures)';
      recommendations.push('Intravenous loop diuretics (Furosemide or Bumetanide infusion) to reduce PCWP target < 15-18 mmHg.');
      recommendations.push('Venodilator therapy (Nitroglycerin infusion or IV Nitroprusside if SBP > 100 mmHg) to lower preload and LV wall stress.');
      recommendations.push('Strict negative fluid balance goal of 1.0-2.0 L/24h with continuous telemetry monitoring.');
    } else if (ci < 2.2 && input.pcwpMmhg <= 18) {
      forresterQuadrant = 'Cold_Dry';
      quadrantDescription = 'Quadrant III: Hypoperfusion with Relative Hypovolemia (Inadequate perfusion, low/normal filling pressures)';
      recommendations.push('Judicious crystalloid volume challenge (250-500 mL balanced crystalloids) under continuous PCWP and SV monitoring.');
      recommendations.push('If hypoperfusion persists after volume optimization, initiate inotrope (Dobutamine 2.5-5.0 mcg/kg/min or Milrinone 0.25-0.375 mcg/kg/min).');
      recommendations.push('Avoid aggressive diuresis; assess for overdiuresis or occult blood loss.');
    } else {
      forresterQuadrant = 'Cold_Wet';
      quadrantDescription = 'Quadrant IV: Cardiogenic Shock / Decompensated Failure (Hypoperfusion + Severe Congestion)';
      recommendations.push('EMERGENT: Initiate inotropic support (Dobutamine 2.5-10 mcg/kg/min or Milrinone) combined with vasopressor (Norepinephrine) to maintain MAP >= 65 mmHg.');
      recommendations.push('Cautious venous offloading once perfusion pressure restored (gentle diuresis + ultrafiltration consideration).');
      recommendations.push('Urgent evaluation for Mechanical Circulatory Support (MCS): IABP, Impella CP/5.5, or VA-ECMO.');
      recommendations.push('Cardiology / Heart Failure consultation for emergent advanced therapies.');
      alerts.push({
        level: 'critical',
        title: 'CARDIOGENIC SHOCK (FORRESTER IV)',
        description: `CI is critically depressed at ${ci} L/min/m2 with severe wedge pressure of ${input.pcwpMmhg} mmHg. High 30-day mortality risk without urgent mechanical/inotropic escalation.`
      });
    }

    // Secondary alerts
    if (input.svo2Percent < 60) {
      alerts.push({
        level: 'critical',
        title: 'CRITICAL SvO2 DESATURATION',
        description: `Mixed venous oxygen saturation is ${input.svo2Percent}% (<60%), reflecting severe tissue oxygen extraction and systemic hypoperfusion. Check Hgb, cardiac output, and arterial oxygenation.`
      });
    } else if (input.svo2Percent > 82) {
      alerts.push({
        level: 'warning',
        title: 'HIGH SvO2 WARNING',
        description: `Mixed venous O2 is ${input.svo2Percent}% (>82%). Consider hyperdynamic distributive shock (sepsis), cellular oxygen uncoupling (cyanide, mitochondrial dysfunction), or left-to-right intracardiac shunt.`
      });
    }

    if (svr > 1500) {
      alerts.push({
        level: 'warning',
        title: 'ELEVATED SYSTEMIC VASCULAR RESISTANCE',
        description: `SVR is ${svr} dynes*s/cm5 (>1500). High afterload impairs LV stroke work and elevates myocardial oxygen demand. Consider cautious afterload reduction.`
      });
    }

    if (pvrWoodUnits >= 3.0 || input.mpapMmhg >= 35) {
      alerts.push({
        level: 'warning',
        title: 'PULMONARY HYPERTENSION DETECTED',
        description: `mPAP is ${input.mpapMmhg} mmHg with PVR of ${pvrWoodUnits} Wood units. Monitor RV function and avoid hypoxia/hypercapnia.`
      });
    }

    return {
      patientId: input.patientId,
      bsaM2: bsa,
      cardiacIndex: ci,
      strokeVolumeMl: sv,
      strokeVolumeIndex: svi,
      mapMmhg: map,
      svrDynes: svr,
      svriDynes: svri,
      pvrDynes: pvr,
      pvriDynes: pvri,
      pvrWoodUnits: pvrWoodUnits,
      lvswi,
      rvswi,
      cao2MlDl: cao2,
      cvo2MlDl: cvo2,
      do2Index: do2i,
      vo2Index: vo2i,
      o2ExtractionRatioPercent: o2er,
      forresterQuadrant,
      quadrantDescription,
      therapeuticRecommendations: recommendations,
      clinicalAlerts: alerts
    };
  }

  /**
   * Real-time Swan-Ganz safety and catheter complication watchdog
   */
  public static evaluateCatheterSafety(safetyInput: PACSafetyInput): PACSafetyAssessment {
    const safetyEventsToLog: PACSafetyAssessment['safetyEventsToLog'] = [];
    const recommendedActions: string[] = [];

    // 1. Balloon overinflation check (Max capacity 1.5 mL)
    const overinflationRisk = safetyInput.balloonInflationVolumeMl > 1.5;
    const airLockoutTriggered = safetyInput.balloonInflationVolumeMl > 1.5;
    if (overinflationRisk) {
      safetyEventsToLog.push({
        eventType: 'balloon_overinflation_risk',
        severity: 'life_threatening',
        warningMessage: `CRITICAL SAFETY LOCKOUT: Balloon inflation volume was ${safetyInput.balloonInflationVolumeMl} mL (exceeds manufacturer limit of 1.5 mL). Immediate pulmonary artery rupture hazard.`,
        actionTaken: 'Air injection lockout triggered. Passive deflation enforced.'
      });
      recommendedActions.push('LOCKOUT: Deflate balloon immediately. Never exceed 1.5 mL of air in standard Swan-Ganz catheters.');
    }

    // 2. Prolonged inflation check (Max 15 seconds)
    const prolongedInflationRisk = safetyInput.inflationDurationSeconds > 15;
    if (prolongedInflationRisk) {
      safetyEventsToLog.push({
        eventType: 'prolonged_balloon_inflation',
        severity: 'critical',
        warningMessage: `Balloon inflated for ${safetyInput.inflationDurationSeconds} seconds (>15s maximum). Prolonged occlusion causes pulmonary infarction.`,
        actionTaken: 'Automated deflation reminder issued.'
      });
      recommendedActions.push('Deflate balloon immediately to restore pulmonary arterial branch blood flow.');
    }

    // 3. Spontaneous wedging / Catheter migration check
    const catheterMigrationAlert = safetyInput.spontaneousWedgeDetected;
    if (catheterMigrationAlert) {
      safetyEventsToLog.push({
        eventType: 'spontaneous_wedge_detected',
        severity: 'life_threatening',
        warningMessage: 'Spontaneous pulmonary capillary wedge waveform detected while balloon is deflated. Catheter has migrated distally into peripheral pulmonary arteriole.',
        actionTaken: 'Urgent bedside clinician pull-back alert dispatched.'
      });
      recommendedActions.push('EMERGENT: Withdraw Swan-Ganz catheter 2-3 cm until pulmonary artery waveform is re-established.');
      recommendedActions.push('Confirm balloon is fully deflated and gate valve locked.');
    }

    // 4. Pressure waveform damping
    if (safetyInput.pressureWaveformDamped) {
      recommendedActions.push('Damped waveform detected: Flush transducer line with pressurized heparinized saline, verify no air bubbles, and check catheter patency.');
    }

    // 5. Pulmonary rupture risk index
    let pulmonaryRuptureRisk: PACSafetyAssessment['pulmonaryRuptureRisk'] = 'low';
    if (overinflationRisk || (safetyInput.currentMpapMmhg > 45 && safetyInput.balloonInflationVolumeMl >= 1.4)) {
      pulmonaryRuptureRisk = 'imminent';
    } else if (catheterMigrationAlert || safetyInput.currentPcwpMmhg > 25) {
      pulmonaryRuptureRisk = 'high';
    } else if (safetyInput.currentMpapMmhg > 35) {
      pulmonaryRuptureRisk = 'moderate';
    }

    return {
      patientId: safetyInput.patientId,
      airLockoutTriggered,
      overinflationRisk,
      prolongedInflationRisk,
      catheterMigrationAlert,
      pulmonaryRuptureRisk,
      recommendedActions,
      safetyEventsToLog
    };
  }

  /**
   * Saves a PAC hemodynamic profile to the database
   */
  public static async saveRecord(input: PACHemodynamicInput): Promise<any> {
    const profile = this.calculateProfile(input);

    const result = await pool.query(
      `INSERT INTO pac_hemodynamic_records (
        patient_id, heart_rate, map_mmhg, cvp_mmhg, mpap_mmhg, pcwp_mmhg,
        cardiac_output_l_min, cardiac_index, svr_dynes, pvr_dynes,
        svo2_percent, do2_index, vo2_index, o2_extraction_ratio_percent,
        forrester_quadrant, therapeutic_recommendations
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        input.patientId,
        input.heartRate,
        profile.mapMmhg,
        input.cvpMmhg,
        input.mpapMmhg,
        input.pcwpMmhg,
        input.cardiacOutputLMin,
        profile.cardiacIndex,
        profile.svrDynes,
        profile.pvrDynes,
        input.svo2Percent,
        profile.do2Index,
        profile.vo2Index,
        profile.o2ExtractionRatioPercent,
        profile.forresterQuadrant,
        JSON.stringify(profile.therapeuticRecommendations)
      ]
    );

    return {
      record: result.rows[0],
      profile
    };
  }

  /**
   * Retrieves historical PAC hemodynamic records for a patient
   */
  public static async getRecordsByPatient(patientId: number): Promise<any[]> {
    const result = await pool.query(
      `SELECT * FROM pac_hemodynamic_records
       WHERE patient_id = $1
       ORDER BY recorded_at DESC`,
      [patientId]
    );
    return result.rows;
  }

  /**
   * Logs a safety event into the database
   */
  public static async logSafetyEvent(
    patientId: number,
    eventType: string,
    severity: string,
    warningMessage: string,
    actionTaken?: string,
    balloonInflationVolumeMl?: number,
    acknowledgedBy?: string
  ): Promise<any> {
    const result = await pool.query(
      `INSERT INTO pac_catheter_safety_events (
        patient_id, event_type, severity, balloon_inflation_volume_ml,
        warning_message, action_taken, acknowledged_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        patientId,
        eventType,
        severity,
        balloonInflationVolumeMl || null,
        warningMessage,
        actionTaken || null,
        acknowledgedBy || null
      ]
    );
    return result.rows[0];
  }

  /**
   * Retrieves active safety alerts for a patient
   */
  public static async getSafetyEvents(patientId: number): Promise<any[]> {
    const result = await pool.query(
      `SELECT * FROM pac_catheter_safety_events
       WHERE patient_id = $1
       ORDER BY created_at DESC`,
      [patientId]
    );
    return result.rows;
  }
}
export default HemodynamicSwanGanzService;
