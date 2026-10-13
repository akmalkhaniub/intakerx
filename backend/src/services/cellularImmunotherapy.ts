import { pool } from '../db';

export type CrsGrade = 'Grade_0' | 'Grade_1' | 'Grade_2' | 'Grade_3' | 'Grade_4';
export type IcansGrade = 'Grade_0' | 'Grade_1' | 'Grade_2' | 'Grade_3' | 'Grade_4';

export interface CrsEvaluation {
  temperature_celsius: number;
  systolic_bp_mmhg: number;
  vasopressors_required: 'none' | 'single_low_dose' | 'multiple_or_high_dose';
  fio2_oxygen_delivery: 'room_air' | 'low_flow_nasal_cannula' | 'high_flow_or_mask' | 'positive_pressure_vent';
  crs_grade: CrsGrade;
  clinical_management: string[];
}

export interface IcansEvaluation {
  ice_score: number; // 0 to 10 (10 is normal, 0 is severe encephalopathy)
  depressed_consciousness: 'alert' | 'awakens_to_voice' | 'awakens_only_to_tactile' | 'unresponsive_or_coma';
  motor_findings: 'none' | 'mild_tremor' | 'myoclonus' | 'status_epilepticus_or_paresis';
  elevated_icp_papilledema: boolean;
  icans_grade: IcansGrade;
  clinical_management: string[];
}

export interface HScoreEvaluation {
  temperature_celsius: number;
  organomegaly: 'none' | 'hepatomegaly_or_splenomegaly' | 'both';
  cytopenias_lineages: number; // 1, 2, or 3 lineages affected
  ferritin_ng_ml: number;
  triglycerides_mg_dl: number;
  fibrinogen_mg_dl: number;
  ast_u_l: number;
  total_hscore: number;
  hlh_probability_percent: number;
  hlh_suspected: boolean;
  interventions: string[];
}

export class CellularImmunotherapyService {
  /**
   * ASTCT Consensus Cytokine Release Syndrome (CRS) Grading:
   * Fever (>= 38.0°C) is mandatory for CRS diagnosis.
   * Grade 1: Fever alone, no hypotension, no hypoxia.
   * Grade 2: Fever + hypotension responsive to fluids OR low-flow nasal cannula (<= 6 L/min).
   * Grade 3: Fever + hypotension requiring a single vasopressor OR high-flow nasal cannula / face-mask.
   * Grade 4: Fever + hypotension requiring multiple vasopressors OR mechanical ventilation (BiPAP/CPAP/ETT).
   */
  static evaluateCrs(params: {
    temperature_celsius: number;
    systolic_bp_mmhg: number;
    vasopressors_required: 'none' | 'single_low_dose' | 'multiple_or_high_dose';
    fio2_oxygen_delivery: 'room_air' | 'low_flow_nasal_cannula' | 'high_flow_or_mask' | 'positive_pressure_vent';
  }): CrsEvaluation {
    const { temperature_celsius, vasopressors_required, fio2_oxygen_delivery } = params;
    const hasFever = temperature_celsius >= 38.0;

    let grade: CrsGrade = 'Grade_0';
    const mgmt: string[] = [];

    if (!hasFever) {
      grade = 'Grade_0';
      mgmt.push('No fever: CRS criteria not met. Continue close inpatient observation and vital sign checks q4h.');
    } else {
      if (vasopressors_required === 'multiple_or_high_dose' || fio2_oxygen_delivery === 'positive_pressure_vent') {
        grade = 'Grade_4';
        mgmt.push('CRITICAL: Grade 4 CRS. Life-threatening toxicity. Transfer to ICU immediately.');
        mgmt.push('Administer Tocilizumab 8 mg/kg IV (max 800 mg) over 1 hour. Repeat q8h up to 4 doses total.');
        mgmt.push('Administer Dexamethasone 20 mg IV q6h (or Methylprednisolone 1000 mg/day IV for refractory shock).');
      } else if (vasopressors_required === 'single_low_dose' || fio2_oxygen_delivery === 'high_flow_or_mask') {
        grade = 'Grade_3';
        mgmt.push('SEVERE: Grade 3 CRS. ICU admission indicated.');
        mgmt.push('Administer Tocilizumab 8 mg/kg IV over 1 hour.');
        mgmt.push('Initiate Dexamethasone 10-20 mg IV q6h.');
      } else if (fio2_oxygen_delivery === 'low_flow_nasal_cannula' || params.systolic_bp_mmhg < 90) {
        grade = 'Grade_2';
        mgmt.push('MODERATE: Grade 2 CRS with hypotension or mild hypoxia.');
        mgmt.push('Administer 500-1000 mL crystalloid bolus; if refractory, administer Tocilizumab 8 mg/kg IV.');
        mgmt.push('Consider Dexamethasone 10 mg IV q6h if refractory to first-line Tocilizumab.');
      } else {
        grade = 'Grade_1';
        mgmt.push('MILD: Grade 1 CRS (Fever alone).');
        mgmt.push('Supportive care: Acetaminophen, infectious workup (blood cultures, chest X-ray), hydration.');
      }
    }

    return {
      temperature_celsius,
      systolic_bp_mmhg: params.systolic_bp_mmhg,
      vasopressors_required,
      fio2_oxygen_delivery,
      crs_grade: grade,
      clinical_management: mgmt
    };
  }

  /**
   * ASTCT Consensus ICANS Neurotoxicity Staging:
   * Assesses Immune Effector Cell-Associated Encephalopathy (ICE) score (0-10) and motor/ICP signs.
   * Grade 1: ICE 7-9, awakens to voice.
   * Grade 2: ICE 3-6, awakens only to tactile.
   * Grade 3: ICE 0-2, stupor, any clinical seizure, or focal edema.
   * Grade 4: ICE 0, coma/unresponsive, status epilepticus, or severe cerebral edema.
   */
  static evaluateIcans(params: {
    ice_score: number;
    depressed_consciousness: 'alert' | 'awakens_to_voice' | 'awakens_only_to_tactile' | 'unresponsive_or_coma';
    motor_findings: 'none' | 'mild_tremor' | 'myoclonus' | 'status_epilepticus_or_paresis';
    elevated_icp_papilledema: boolean;
  }): IcansEvaluation {
    const { ice_score, depressed_consciousness, motor_findings, elevated_icp_papilledema } = params;

    let grade: IcansGrade = 'Grade_0';
    const mgmt: string[] = [];

    if (
      depressed_consciousness === 'unresponsive_or_coma' ||
      motor_findings === 'status_epilepticus_or_paresis' ||
      elevated_icp_papilledema
    ) {
      grade = 'Grade_4';
      mgmt.push('CRITICAL: Grade 4 ICANS with severe coma, status epilepticus, or cerebral edema.');
      mgmt.push('High-dose pulse Methylprednisolone 1000 mg IV daily for 3 days, followed by rapid taper.');
      mgmt.push('Levetiracetam 1000-1500 mg IV q12h seizure prophylaxis/treatment. Emergent head CT/MRI brain.');
    } else if (ice_score <= 2 || depressed_consciousness === 'awakens_only_to_tactile') {
      grade = 'Grade_3';
      mgmt.push('SEVERE: Grade 3 ICANS. ICU monitoring indicated.');
      mgmt.push('Initiate Dexamethasone 10-20 mg IV q6h.');
      mgmt.push('Continuous EEG monitoring and neurology consultation.');
    } else if (ice_score <= 6 || depressed_consciousness === 'awakens_to_voice') {
      grade = 'Grade_2';
      mgmt.push('MODERATE: Grade 2 ICANS.');
      mgmt.push('Initiate Dexamethasone 10 mg IV q6h.');
    } else if (ice_score <= 9) {
      grade = 'Grade_1';
      mgmt.push('MILD: Grade 1 ICANS with mild handwriting difficulty or attention impairment.');
      mgmt.push('Serial ICE checks q8h. Withhold sedatives. Levetiracetam 750 mg PO BID prophylaxis.');
    } else {
      grade = 'Grade_0';
      mgmt.push('Normal neurological function (ICE score 10/10). No ICANS features.');
    }

    return {
      ice_score,
      depressed_consciousness,
      motor_findings,
      elevated_icp_papilledema,
      icans_grade: grade,
      clinical_management: mgmt
    };
  }

  /**
   * HScore for Secondary Hemophagocytic Lymphohistiocytosis / Macrophage Activation Syndrome (HLH/MAS)
   * Score > 169 indicates > 93% probability of HLH/MAS in CAR-T setting.
   */
  static calculateHScore(params: {
    temperature_celsius: number;
    organomegaly: 'none' | 'hepatomegaly_or_splenomegaly' | 'both';
    cytopenias_lineages: number;
    ferritin_ng_ml: number;
    triglycerides_mg_dl: number;
    fibrinogen_mg_dl: number;
    ast_u_l: number;
  }): HScoreEvaluation {
    let score = 0;

    // Temperature
    if (params.temperature_celsius > 39.4) score += 49;
    else if (params.temperature_celsius >= 38.4) score += 33;

    // Organomegaly
    if (params.organomegaly === 'both') score += 38;
    else if (params.organomegaly === 'hepatomegaly_or_splenomegaly') score += 23;

    // Cytopenias
    if (params.cytopenias_lineages >= 3) score += 34;
    else if (params.cytopenias_lineages === 2) score += 24;

    // Ferritin
    if (params.ferritin_ng_ml > 6000) score += 50;
    else if (params.ferritin_ng_ml > 2000) score += 35;

    // Triglycerides
    if (params.triglycerides_mg_dl > 354) score += 64;
    else if (params.triglycerides_mg_dl > 132) score += 44;

    // Fibrinogen
    if (params.fibrinogen_mg_dl <= 250) score += 30;

    // AST
    if (params.ast_u_l >= 30) score += 19;

    const isSuspected = score >= 169;
    const probability = isSuspected ? 94.0 : Number(Math.min(90, Math.max(5, (score / 200) * 80)).toFixed(1));

    const interventions: string[] = [];
    if (isSuspected) {
      interventions.push('EMERGENCY HLH/MAS ALERT: HScore >= 169 predicts secondary hemophagocytic lymphohistiocytosis.');
      interventions.push('Initiate Anakinra (IL-1 receptor antagonist) 100-200 mg IV/SC q6-8h.');
      interventions.push('High-dose Dexamethasone 10-20 mg/m2 or Methylprednisolone pulse therapy.');
      interventions.push('Urgent bone marrow biopsy to assess for hemophagocytosis; send soluble CD25 (sIL-2R).');
    } else {
      interventions.push('HScore < 169: Secondary HLH/MAS unlikely currently. Continue serial ferritin and fibrinogen monitoring.');
    }

    return {
      temperature_celsius: params.temperature_celsius,
      organomegaly: params.organomegaly,
      cytopenias_lineages: params.cytopenias_lineages,
      ferritin_ng_ml: params.ferritin_ng_ml,
      triglycerides_mg_dl: params.triglycerides_mg_dl,
      fibrinogen_mg_dl: params.fibrinogen_mg_dl,
      ast_u_l: params.ast_u_l,
      total_hscore: score,
      hlh_probability_percent: probability,
      hlh_suspected: isSuspected,
      interventions
    };
  }

  /**
   * Persists a CAR-T Cellular Therapy Case
   */
  static async recordCartCase(data: {
    patient_id: number;
    product_name: string;
    infusion_date: string;
    crs_grade?: CrsGrade;
    icans_grade?: IcansGrade;
    ice_neuro_score?: number;
    hscore_hlh_risk?: number;
    tocilizumab_doses_given?: number;
    dexamethasone_active?: boolean;
  }) {
    const result = await pool.query(
      `INSERT INTO cart_cellular_therapy_cases (
        patient_id, product_name, infusion_date, crs_grade, icans_grade,
        ice_neuro_score, hscore_hlh_risk, tocilizumab_doses_given, dexamethasone_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        data.patient_id,
        data.product_name,
        data.infusion_date,
        data.crs_grade || 'Grade_0',
        data.icans_grade || 'Grade_0',
        data.ice_neuro_score ?? 10,
        data.hscore_hlh_risk || 0.0,
        data.tocilizumab_doses_given || 0,
        data.dexamethasone_active || false
      ]
    );

    return result.rows[0];
  }

  /**
   * Persists a Cytokine Release Event log
   */
  static async recordCrsEvent(data: {
    case_id: number;
    temperature_celsius: number;
    systolic_bp_mmhg: number;
    vasopressor_required?: boolean;
    fio2_oxygen_requirement?: number;
    ferritin_ng_ml?: number;
    il6_pg_ml?: number;
    crp_mg_dl?: number;
    intervention_administered: string;
  }) {
    const result = await pool.query(
      `INSERT INTO cytokine_release_events (
        case_id, temperature_celsius, systolic_bp_mmhg, vasopressor_required,
        fio2_oxygen_requirement, ferritin_ng_ml, il6_pg_ml, crp_mg_dl,
        intervention_administered
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        data.case_id,
        data.temperature_celsius,
        data.systolic_bp_mmhg,
        data.vasopressor_required || false,
        data.fio2_oxygen_requirement || 0.21,
        data.ferritin_ng_ml || null,
        data.il6_pg_ml || null,
        data.crp_mg_dl || null,
        data.intervention_administered
      ]
    );

    return result.rows[0];
  }

  /**
   * Fetches CAR-T Cellular Therapy Case & Events for Patient
   */
  static async getPatientCartProfile(patientId: number) {
    const cases = await pool.query(
      'SELECT * FROM cart_cellular_therapy_cases WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 10',
      [patientId]
    );

    let events: any[] = [];
    if (cases.rows.length > 0) {
      const caseIds = cases.rows.map(c => c.id);
      const evRes = await pool.query(
        'SELECT * FROM cytokine_release_events WHERE case_id = ANY($1) ORDER BY logged_at DESC LIMIT 20',
        [caseIds]
      );
      events = evRes.rows;
    }

    return {
      cases: cases.rows,
      events
    };
  }
}
