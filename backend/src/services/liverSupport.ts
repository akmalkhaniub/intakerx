import { pool } from '../db';

export type WestHavenGrade = 'Grade_0' | 'Grade_I' | 'Grade_II' | 'Grade_III' | 'Grade_IV';

export interface KingsCollegeEvaluation {
  etiology: 'Acetaminophen' | 'Non-Acetaminophen';
  arterial_ph: number;
  inr: number;
  serum_creatinine_mg_dl: number;
  serum_bilirubin_mg_dl: number;
  west_haven_he_grade: WestHavenGrade;
  arterial_lactate_mmol_l?: number;
  duration_jaundice_to_encephalopathy_days?: number;
  patient_age_years?: number;
  criteria_met: boolean;
  criteria_triggers: string[];
  recommendation: string;
}

export interface MarsClearanceEvaluation {
  session_id?: number;
  patient_id: number;
  dialysis_system: 'MARS' | 'Prometheus';
  prescribed_hours: number;
  blood_flow_rate_ml_min: number;
  albumin_dialysate_flow_ml_min: number;
  initial_total_bilirubin_mg_dl: number;
  final_total_bilirubin_mg_dl: number;
  initial_ammonia_umol_l: number;
  final_ammonia_umol_l: number;
  bilirubin_clearance_percent: number;
  ammonia_clearance_percent: number;
  target_clearance_achieved: boolean;
  clinical_recommendations: string[];
}

export interface CerebralEdemaRiskEvaluation {
  patient_id: number;
  serum_ammonia_umol_l: number;
  west_haven_he_grade: WestHavenGrade;
  icp_monitoring_indicated: boolean;
  icp_elevation_risk: 'low' | 'moderate' | 'high' | 'critical';
  cerebral_perfusion_pressure_target_mmhg: string;
  hyperosmolar_therapy_indicated: boolean;
  interventions: string[];
}

export class LiverSupportService {
  /**
   * Evaluates King's College Hospital Criteria for Emergency Liver Transplantation
   * Acetaminophen-induced ALF:
   *   Arterial pH < 7.30 after resuscitation OR
   *   All 3: Grade III/IV HE + INR > 6.5 (PT > 100s) + Creatinine > 3.4 mg/dL (300 µmol/L)
   *   Or Arterial Lactate > 3.5 mmol/L post-fluid resuscitation or > 3.0 mmol/L at 12h
   * Non-Acetaminophen ALF:
   *   INR > 6.5 OR
   *   Any 3 of 5:
   *     - Age < 10 or > 40
   *     - Etiology (non-A non-B hepatitis, halothane, idiosyncratic drug)
   *     - Duration of jaundice to encephalopathy > 7 days
   *     - INR > 3.5
   *     - Serum bilirubin > 17.5 mg/dL (300 µmol/L)
   */
  static evaluateKingsCollegeCriteria(params: {
    etiology: 'Acetaminophen' | 'Non-Acetaminophen';
    arterial_ph: number;
    inr: number;
    serum_creatinine_mg_dl: number;
    serum_bilirubin_mg_dl: number;
    west_haven_he_grade: WestHavenGrade;
    arterial_lactate_mmol_l?: number;
    duration_jaundice_to_encephalopathy_days?: number;
    patient_age_years?: number;
  }): KingsCollegeEvaluation {
    const triggers: string[] = [];
    let criteriaMet = false;

    if (params.etiology === 'Acetaminophen') {
      if (params.arterial_ph < 7.30) {
        triggers.push('Arterial pH < 7.30 post fluid resuscitation');
        criteriaMet = true;
      }
      if (params.arterial_lactate_mmol_l && params.arterial_lactate_mmol_l > 3.5) {
        triggers.push(`Arterial lactate ${params.arterial_lactate_mmol_l} mmol/L > 3.5 mmol/L`);
        criteriaMet = true;
      }

      const severeEnceph = params.west_haven_he_grade === 'Grade_III' || params.west_haven_he_grade === 'Grade_IV';
      const severeInr = params.inr > 6.5;
      const severeCreatinine = params.serum_creatinine_mg_dl > 3.4;

      if (severeEnceph && severeInr && severeCreatinine) {
        triggers.push('Triad of Grade III/IV Encephalopathy + INR > 6.5 + Creatinine > 3.4 mg/dL');
        criteriaMet = true;
      }
    } else {
      // Non-Acetaminophen
      if (params.inr > 6.5) {
        triggers.push('INR > 6.5 (Primary single criterion)');
        criteriaMet = true;
      }

      let subCriteriaCount = 0;
      if (params.patient_age_years !== undefined && (params.patient_age_years < 10 || params.patient_age_years > 40)) {
        subCriteriaCount++;
        triggers.push(`Age ${params.patient_age_years} (<10 or >40 years)`);
      }
      if (params.duration_jaundice_to_encephalopathy_days !== undefined && params.duration_jaundice_to_encephalopathy_days > 7) {
        subCriteriaCount++;
        triggers.push(`Jaundice to encephalopathy interval > 7 days (${params.duration_jaundice_to_encephalopathy_days} days)`);
      }
      if (params.inr > 3.5) {
        subCriteriaCount++;
        triggers.push(`INR ${params.inr} > 3.5`);
      }
      if (params.serum_bilirubin_mg_dl > 17.5) {
        subCriteriaCount++;
        triggers.push(`Serum bilirubin ${params.serum_bilirubin_mg_dl} mg/dL > 17.5 mg/dL`);
      }
      // Etiology non-A/B/idiosyncratic
      subCriteriaCount++;
      triggers.push('Etiology favorable to King\'s College sub-criterion (Idiosyncratic/Non-APAP)');

      if (subCriteriaCount >= 3) {
        criteriaMet = true;
      }
    }

    const recommendation = criteriaMet
      ? 'EMERGENCY: King\'s College Hospital Criteria MET. Immediate UNOS Status 1A Liver Transplant listing indicated. Initiate molecular adsorbent liver support (MARS/Prometheus) bridging protocol.'
      : 'King\'s College Hospital Criteria NOT met currently. Continue rigorous ICU monitoring, serial INR/lactate/ammonia checks q4h, and neuroprotective protocol.';

    return {
      etiology: params.etiology,
      arterial_ph: params.arterial_ph,
      inr: params.inr,
      serum_creatinine_mg_dl: params.serum_creatinine_mg_dl,
      serum_bilirubin_mg_dl: params.serum_bilirubin_mg_dl,
      west_haven_he_grade: params.west_haven_he_grade,
      arterial_lactate_mmol_l: params.arterial_lactate_mmol_l,
      duration_jaundice_to_encephalopathy_days: params.duration_jaundice_to_encephalopathy_days,
      patient_age_years: params.patient_age_years,
      criteria_met: criteriaMet,
      criteria_triggers: triggers,
      recommendation
    };
  }

  /**
   * Calculates MARS / Prometheus Albumin Dialysis clearance percentages and validation
   * Target: Bilirubin clearance >= 25%, Ammonia clearance >= 30% per standard 6h session
   */
  static calculateMarsClearance(params: {
    patient_id: number;
    dialysis_system: 'MARS' | 'Prometheus';
    prescribed_hours: number;
    blood_flow_rate_ml_min: number;
    albumin_dialysate_flow_ml_min: number;
    initial_total_bilirubin_mg_dl: number;
    final_total_bilirubin_mg_dl: number;
    initial_ammonia_umol_l: number;
    final_ammonia_umol_l: number;
  }): MarsClearanceEvaluation {
    const biliDiff = Math.max(0, params.initial_total_bilirubin_mg_dl - params.final_total_bilirubin_mg_dl);
    const biliClearance = params.initial_total_bilirubin_mg_dl > 0
      ? Number(((biliDiff / params.initial_total_bilirubin_mg_dl) * 100).toFixed(2))
      : 0;

    const nh3Diff = Math.max(0, params.initial_ammonia_umol_l - params.final_ammonia_umol_l);
    const nh3Clearance = params.initial_ammonia_umol_l > 0
      ? Number(((nh3Diff / params.initial_ammonia_umol_l) * 100).toFixed(2))
      : 0;

    const targetAchieved = biliClearance >= 25 && nh3Clearance >= 30;
    const recommendations: string[] = [];

    if (targetAchieved) {
      recommendations.push(`Satisfactory toxin clearance achieved: Bilirubin reduction ${biliClearance}% (target >=25%), Ammonia reduction ${nh3Clearance}% (target >=30%).`);
      recommendations.push('Maintain circuit anticoagulation (regional citrate preferred in coagulopathy/ALF, monitoring ionized Ca2+).');
    } else {
      recommendations.push(`Suboptimal clearance: Bilirubin reduction ${biliClearance}% (target >=25%), Ammonia reduction ${nh3Clearance}% (target >=30%).`);
      recommendations.push('Check albumin circuit saturation: replace albumin dialysate, check carbon and resin adsorber cartridge pressures, verify blood flow rate (150-200 mL/min).');
    }

    return {
      patient_id: params.patient_id,
      dialysis_system: params.dialysis_system,
      prescribed_hours: params.prescribed_hours,
      blood_flow_rate_ml_min: params.blood_flow_rate_ml_min,
      albumin_dialysate_flow_ml_min: params.albumin_dialysate_flow_ml_min,
      initial_total_bilirubin_mg_dl: params.initial_total_bilirubin_mg_dl,
      final_total_bilirubin_mg_dl: params.final_total_bilirubin_mg_dl,
      initial_ammonia_umol_l: params.initial_ammonia_umol_l,
      final_ammonia_umol_l: params.final_ammonia_umol_l,
      bilirubin_clearance_percent: biliClearance,
      ammonia_clearance_percent: nh3Clearance,
      target_clearance_achieved: targetAchieved,
      clinical_recommendations: recommendations
    };
  }

  /**
   * Assesses Cerebral Edema and Intracranial Hypertension Risk in ALF
   * Arterial Ammonia > 150 µmol/L or Grade III/IV HE carries high/critical risk for fatal cerebral herniation.
   */
  static evaluateCerebralEdemaRisk(params: {
    patient_id: number;
    serum_ammonia_umol_l: number;
    west_haven_he_grade: WestHavenGrade;
  }): CerebralEdemaRiskEvaluation {
    const { serum_ammonia_umol_l, west_haven_he_grade } = params;
    let risk: 'low' | 'moderate' | 'high' | 'critical' = 'low';
    const interventions: string[] = [];

    const isSevereHE = west_haven_he_grade === 'Grade_III' || west_haven_he_grade === 'Grade_IV';

    if (serum_ammonia_umol_l >= 200 || (isSevereHE && serum_ammonia_umol_l >= 150)) {
      risk = 'critical';
      interventions.push('CRITICAL ALERT: Imminent risk of cerebral edema and uncal herniation. Continuous ICP monitor or pupillometry indicated.');
      interventions.push('Target cerebral perfusion pressure (CPP) 60-80 mmHg; maintain MAP > 75 mmHg.');
      interventions.push('Administer 3% hypertonic saline bolus (target serum sodium 145-150 mEq/L) or 20% mannitol (0.5-1.0 g/kg).');
      interventions.push('Initiate continuous venovenous hemofiltration (CVVH) or MARS to accelerate ammonia elimination.');
      interventions.push('Avoid hyperthermia (maintain normothermia 35-36°C); elevate head of bed 30 degrees; minimal endotracheal suctioning.');
    } else if (serum_ammonia_umol_l >= 150 || isSevereHE) {
      risk = 'high';
      interventions.push('HIGH RISK: Hyperammonemia > 150 µmol/L or Grade III/IV HE. High propensity for intracranial hypertension.');
      interventions.push('Institute hourly neurological checks and pupillometry; intubation for airway protection if not already done.');
      interventions.push('Target serum sodium 145-150 mEq/L with hypertonic saline prophylaxis.');
      interventions.push('Target CPP 60-80 mmHg.');
    } else if (serum_ammonia_umol_l >= 100 || west_haven_he_grade === 'Grade_II') {
      risk = 'moderate';
      interventions.push('MODERATE RISK: Grade II HE / Elevated ammonia. Monitor serial ammonias q6h.');
      interventions.push('Lactulose oral/rectal and rifaximin administration; avoid sedatives.');
    } else {
      risk = 'low';
      interventions.push('LOW RISK: Minimal HE symptoms. Routine ICU hepatic encephalopathy surveillance.');
    }

    return {
      patient_id: params.patient_id,
      serum_ammonia_umol_l,
      west_haven_he_grade,
      icp_monitoring_indicated: risk === 'critical' || risk === 'high',
      icp_elevation_risk: risk,
      cerebral_perfusion_pressure_target_mmhg: '60-80 mmHg',
      hyperosmolar_therapy_indicated: risk === 'critical',
      interventions
    };
  }

  /**
   * Persists a MARS session into PostgreSQL database
   */
  static async recordMarsSession(data: {
    patient_id: number;
    dialysis_system: 'MARS' | 'Prometheus';
    prescribed_hours: number;
    blood_flow_rate_ml_min: number;
    albumin_dialysate_flow_ml_min: number;
    initial_total_bilirubin_mg_dl: number;
    final_total_bilirubin_mg_dl: number;
    initial_ammonia_umol_l: number;
    final_ammonia_umol_l: number;
    session_status?: string;
  }) {
    const clearance = this.calculateMarsClearance(data);

    const result = await pool.query(
      `INSERT INTO mars_liver_sessions (
        patient_id, dialysis_system, prescribed_hours, blood_flow_rate_ml_min,
        albumin_dialysate_flow_ml_min, initial_total_bilirubin_mg_dl, final_total_bilirubin_mg_dl,
        initial_ammonia_umol_l, final_ammonia_umol_l, bilirubin_clearance_percent,
        ammonia_clearance_percent, session_status, started_at, ended_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW() - INTERVAL '6 hours', NOW())
      RETURNING *`,
      [
        data.patient_id,
        data.dialysis_system,
        data.prescribed_hours,
        data.blood_flow_rate_ml_min,
        data.albumin_dialysate_flow_ml_min,
        data.initial_total_bilirubin_mg_dl,
        data.final_total_bilirubin_mg_dl,
        data.initial_ammonia_umol_l,
        data.final_ammonia_umol_l,
        clearance.bilirubin_clearance_percent,
        clearance.ammonia_clearance_percent,
        data.session_status || 'completed'
      ]
    );

    return {
      session: result.rows[0],
      clearance
    };
  }

  /**
   * Persists an Acute Liver Failure case into PostgreSQL database
   */
  static async recordAlfCase(data: {
    patient_id: number;
    etiology: 'Acetaminophen' | 'Non-Acetaminophen';
    west_haven_he_grade: WestHavenGrade;
    inr: number;
    total_bilirubin_mg_dl: number;
    serum_creatinine_mg_dl: number;
    arterial_ph: number;
    arterial_lactate_mmol_l: number;
    serum_ammonia_umol_l: number;
    duration_jaundice_to_encephalopathy_days?: number;
    patient_age_years?: number;
  }) {
    const kingsEval = this.evaluateKingsCollegeCriteria({
      etiology: data.etiology,
      arterial_ph: data.arterial_ph,
      inr: data.inr,
      serum_creatinine_mg_dl: data.serum_creatinine_mg_dl,
      serum_bilirubin_mg_dl: data.total_bilirubin_mg_dl,
      west_haven_he_grade: data.west_haven_he_grade,
      arterial_lactate_mmol_l: data.arterial_lactate_mmol_l,
      duration_jaundice_to_encephalopathy_days: data.duration_jaundice_to_encephalopathy_days,
      patient_age_years: data.patient_age_years
    });

    const cerebralEval = this.evaluateCerebralEdemaRisk({
      patient_id: data.patient_id,
      serum_ammonia_umol_l: data.serum_ammonia_umol_l,
      west_haven_he_grade: data.west_haven_he_grade
    });

    const result = await pool.query(
      `INSERT INTO acute_liver_failure_cases (
        patient_id, etiology, west_haven_he_grade, inr, total_bilirubin_mg_dl,
        serum_creatinine_mg_dl, arterial_ph, arterial_lactate_mmol_l, serum_ammonia_umol_l,
        kings_college_criteria_met, urgent_transplant_listed, icp_elevation_risk
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        data.patient_id,
        data.etiology,
        data.west_haven_he_grade,
        data.inr,
        data.total_bilirubin_mg_dl,
        data.serum_creatinine_mg_dl,
        data.arterial_ph,
        data.arterial_lactate_mmol_l,
        data.serum_ammonia_umol_l,
        kingsEval.criteria_met,
        kingsEval.criteria_met, // listed if criteria met
        cerebralEval.icp_elevation_risk
      ]
    );

    return {
      case: result.rows[0],
      kings_college: kingsEval,
      cerebral_edema_risk: cerebralEval
    };
  }

  /**
   * Fetches MARS sessions and ALF cases for a patient
   */
  static async getPatientLiverProfile(patientId: number) {
    const marsRes = await pool.query(
      'SELECT * FROM mars_liver_sessions WHERE patient_id = $1 ORDER BY started_at DESC LIMIT 10',
      [patientId]
    );
    const alfRes = await pool.query(
      'SELECT * FROM acute_liver_failure_cases WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 10',
      [patientId]
    );
    return {
      mars_sessions: marsRes.rows,
      alf_cases: alfRes.rows
    };
  }
}
