import { pool } from '../db';

export interface NeuroAutoregulationEvaluation {
  mean_icp_mmhg: number;
  map_mmhg: number;
  cpp_mmhg: number;
  prx_autoregulation_index: number; // Pressure Reactivity Index (-1.0 to +1.0)
  autoregulation_status: 'intact' | 'impaired' | 'severely_dysfunctional';
  optimal_cpp_target_mmhg: number;
  clinical_recommendations: string[];
}

export interface MultimodalMetabolismEvaluation {
  pbto2_brain_oxygen_mmhg?: number;
  lactate_pyruvate_ratio?: number;
  hypoxia_detected: boolean;
  cellular_energy_crisis_detected: boolean;
  metabolic_alerts: string[];
}

export interface SahVasospasmEvaluation {
  mca_mean_velocity_cm_s: number;
  ica_mean_velocity_cm_s: number;
  lindegaard_ratio: number;
  vasospasm_severity: 'none' | 'mild' | 'moderate' | 'severe' | 'hyperemia';
  interventions: string[];
}

export interface StatusEpilepticusEegEvaluation {
  salzburg_criteria_met: boolean;
  burst_suppression_ratio_percent: number; // 0 - 100%
  sedation_depth_adequate: boolean;
  recommendations: string[];
}

export class NeuroCriticalCareService {
  /**
   * Evaluates Cerebral Perfusion Pressure (CPP = MAP - ICP) and Pressure Reactivity Index (PRx).
   * PRx < 0: Intact autoregulation (vessels constrict when MAP rises, ICP falls).
   * PRx 0 to 0.25: Borderline/partially impaired.
   * PRx > 0.25: Impaired autoregulation (vessels passively dilate with MAP, ICP rises).
   * Calculates Optimal CPP (CPPopt) target (typically 60-70 mmHg, indexed to PRx minimum).
   */
  static evaluateAutoregulation(params: {
    mean_icp_mmhg: number;
    map_mmhg: number;
    prx_autoregulation_index: number;
  }): NeuroAutoregulationEvaluation {
    const { mean_icp_mmhg, map_mmhg, prx_autoregulation_index } = params;
    const cpp = Number((map_mmhg - mean_icp_mmhg).toFixed(1));

    let status: 'intact' | 'impaired' | 'severely_dysfunctional' = 'intact';
    const recs: string[] = [];

    if (prx_autoregulation_index > 0.35) {
      status = 'severely_dysfunctional';
      recs.push('CRITICAL: Severely impaired cerebral pressure autoregulation (PRx > 0.35). Vascular bed is passively pressure-dependent.');
      recs.push('Avoid acute MAP surges which directly translate to cerebral edema and intracranial pressure herniation.');
    } else if (prx_autoregulation_index > 0.20) {
      status = 'impaired';
      recs.push('Impaired autoregulatory reserve (PRx > 0.20). Maintain tight hemodynamic targets.');
    } else {
      status = 'intact';
      recs.push('Cerebral autoregulatory capacity preserved (PRx <= 0.20).');
    }

    // Dynamic CPPopt calculation: If autoregulation is impaired, target standard 65-70 mmHg; if intact, calibrate between 60-70
    let optimalCpp = 65.0;
    if (status === 'severely_dysfunctional') {
      optimalCpp = 70.0;
      recs.push('Maintain CPP strictly at 70 mmHg via vasopressor titration (Norepinephrine) to prevent cerebral ischemia without exacerbating edema.');
    }

    if (cpp < 60.0) {
      recs.push(`Hypoperfusion alert: Current CPP ${cpp} mmHg is below minimum neuroprotection target (>= 60 mmHg).`);
    }

    if (mean_icp_mmhg > 22.0) {
      recs.push(`Intracranial Hypertension: ICP ${mean_icp_mmhg} mmHg exceeds Tier 1 threshold (>22 mmHg). Initiate Tier 1 ICP management.`);
    }

    return {
      mean_icp_mmhg,
      map_mmhg,
      cpp_mmhg: cpp,
      prx_autoregulation_index,
      autoregulation_status: status,
      optimal_cpp_target_mmhg: optimalCpp,
      clinical_recommendations: recs
    };
  }

  /**
   * Multimodal Neurometabolic Monitoring:
   * Brain Tissue Oxygenation (PbtO2): Normal > 20-25 mmHg. Hypoxia < 20 mmHg. Severe ischemia < 15 mmHg.
   * Microdialysis Lactate/Pyruvate Ratio (LPR): Normal < 25. Energy crisis > 40.
   */
  static evaluateMultimodalMetabolism(params: {
    pbto2_brain_oxygen_mmhg?: number;
    lactate_pyruvate_ratio?: number;
  }): MultimodalMetabolismEvaluation {
    const alerts: string[] = [];
    let hypoxia = false;
    let energyCrisis = false;

    if (params.pbto2_brain_oxygen_mmhg !== undefined) {
      if (params.pbto2_brain_oxygen_mmhg < 15.0) {
        hypoxia = true;
        alerts.push(`CRITICAL BRAIN HYPOXIA: PbtO2 ${params.pbto2_brain_oxygen_mmhg} mmHg < 15 mmHg. Imminent ischemic infarction.`);
        alerts.push('Increase PaO2 target (titrate FiO2 to maintain PbtO2 >= 20 mmHg), optimize CPP > 70 mmHg, transfuse PRBC if Hb < 9 g/dL.');
      } else if (params.pbto2_brain_oxygen_mmhg < 20.0) {
        hypoxia = true;
        alerts.push(`Brain tissue hypoxia: PbtO2 ${params.pbto2_brain_oxygen_mmhg} mmHg is below critical threshold (<20 mmHg).`);
        alerts.push('Optimize cerebral oxygen delivery: assess CPP, cardiac index, arterial oxygen content.');
      }
    }

    if (params.lactate_pyruvate_ratio !== undefined) {
      if (params.lactate_pyruvate_ratio > 40.0) {
        energyCrisis = true;
        alerts.push(`CELLULAR METABOLIC CRISIS: Microdialysis LPR ${params.lactate_pyruvate_ratio} > 40 indicates anaerobic glycolytic shift or mitochondrial failure.`);
        alerts.push('Verify cerebral microvascular perfusion; rule out secondary systemic hypoglycemia (target serum glucose 140-180 mg/dL).');
      }
    }

    return {
      pbto2_brain_oxygen_mmhg: params.pbto2_brain_oxygen_mmhg,
      lactate_pyruvate_ratio: params.lactate_pyruvate_ratio,
      hypoxia_detected: hypoxia,
      cellular_energy_crisis_detected: energyCrisis,
      metabolic_alerts: alerts
    };
  }

  /**
   * Transcranial Doppler (TCD) & Lindegaard Ratio for Aneurysmal SAH Vasospasm:
   * Lindegaard Ratio (LR) = MCA Mean Velocity / Extracranial ICA Mean Velocity
   * LR < 3: Normal or hyperemia if MCA velocity is high
   * LR 3 to 6: Mild-to-moderate vasospasm
   * LR > 6: Severe true arterial vasospasm
   */
  static evaluateSahVasospasm(params: {
    mca_mean_velocity_cm_s: number;
    ica_mean_velocity_cm_s: number;
  }): SahVasospasmEvaluation {
    const { mca_mean_velocity_cm_s, ica_mean_velocity_cm_s } = params;
    const lr = ica_mean_velocity_cm_s > 0
      ? Number((mca_mean_velocity_cm_s / ica_mean_velocity_cm_s).toFixed(2))
      : 0;

    let severity: 'none' | 'mild' | 'moderate' | 'severe' | 'hyperemia' = 'none';
    const recs: string[] = [];

    if (lr > 6.0 && mca_mean_velocity_cm_s >= 200) {
      severity = 'severe';
      recs.push(`CRITICAL VASOSPASM: Lindegaard Ratio ${lr} > 6 with MCA velocity ${mca_mean_velocity_cm_s} cm/s.`);
      recs.push('Stat diagnostic cerebral angiography with consideration of intra-arterial vasodilator infusion (Verapamil/Nicardipine) or balloon angioplasty.');
      recs.push('Maintain induced hypertension with vasopressors (target SBP 160-180 mmHg if aneurysm secured).');
    } else if (lr >= 3.0) {
      severity = 'moderate';
      recs.push(`Moderate vasospasm: Lindegaard Ratio ${lr} (range 3-6). Serial TCD checks q12h and maintain euvolemia.`);
    } else if (mca_mean_velocity_cm_s > 120 && lr < 3.0) {
      severity = 'hyperemia';
      recs.push(`Benign Hyperemia: Elevated MCA velocity (${mca_mean_velocity_cm_s} cm/s) with low Lindegaard ratio (${lr} < 3). Vasospasm excluded.`);
    } else {
      severity = 'none';
      recs.push('Normal cerebral flow velocities without sonographic evidence of vasospasm.');
    }

    return {
      mca_mean_velocity_cm_s,
      ica_mean_velocity_cm_s,
      lindegaard_ratio: lr,
      vasospasm_severity: severity,
      interventions: recs
    };
  }

  /**
   * Evaluates Status Epilepticus Continuous EEG and Burst Suppression Depth
   * Adequate therapeutic burst suppression for refractory status epilepticus is >= 80% suppression ratio.
   */
  static evaluateEegBurstSuppression(params: {
    salzburg_criteria_met: boolean;
    burst_suppression_ratio_percent: number;
  }): StatusEpilepticusEegEvaluation {
    const { salzburg_criteria_met, burst_suppression_ratio_percent } = params;
    const isAdequate = burst_suppression_ratio_percent >= 80.0;
    const recs: string[] = [];

    if (salzburg_criteria_met) {
      recs.push('Salzburg Criteria MET for Non-Convulsive Status Epilepticus (NCSE). Continuous intravenous anesthetic infusion indicated.');
    }

    if (isAdequate) {
      recs.push(`Adequate therapeutic burst suppression achieved (${burst_suppression_ratio_percent}% >= 80%). Maintain continuous infusion for 24-48 hours before weaning.`);
    } else {
      recs.push(`Suboptimal burst suppression (${burst_suppression_ratio_percent}% < 80%). Titrate continuous anesthetic (Propofol, Midazolam, or Ketamine) upward under continuous EEG.`);
    }

    return {
      salzburg_criteria_met,
      burst_suppression_ratio_percent,
      sedation_depth_adequate: isAdequate,
      recommendations: recs
    };
  }

  /**
   * Persists a Neurocritical Care Multimodal Monitoring Session into DB
   */
  static async recordMonitoringSession(data: {
    patient_id: number;
    diagnosis_category: string;
    mean_icp_mmhg: number;
    map_mmhg: number;
    prx_autoregulation_index: number;
    pbto2_brain_oxygen_mmhg?: number;
    lactate_pyruvate_ratio?: number;
    lindegaard_ratio?: number;
    eeg_burst_suppression_ratio?: number;
  }) {
    const autoEval = this.evaluateAutoregulation({
      mean_icp_mmhg: data.mean_icp_mmhg,
      map_mmhg: data.map_mmhg,
      prx_autoregulation_index: data.prx_autoregulation_index
    });

    const result = await pool.query(
      `INSERT INTO neurocrit_monitoring_sessions (
        patient_id, diagnosis_category, mean_icp_mmhg, map_mmhg, cpp_mmhg,
        prx_autoregulation_index, optimal_cpp_target_mmhg, pbto2_brain_oxygen_mmhg,
        lactate_pyruvate_ratio, lindegaard_ratio, eeg_burst_suppression_ratio
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        data.patient_id,
        data.diagnosis_category,
        data.mean_icp_mmhg,
        data.map_mmhg,
        autoEval.cpp_mmhg,
        data.prx_autoregulation_index,
        autoEval.optimal_cpp_target_mmhg,
        data.pbto2_brain_oxygen_mmhg || null,
        data.lactate_pyruvate_ratio || null,
        data.lindegaard_ratio || null,
        data.eeg_burst_suppression_ratio || null
      ]
    );

    return {
      session: result.rows[0],
      autoregulation: autoEval
    };
  }

  /**
   * Persists an Intracranial Hypertension Event Log
   */
  static async recordHypertensionEvent(data: {
    session_id: number;
    peak_icp_mmhg: number;
    duration_minutes: number;
    lundberg_wave_type?: string;
    tier_intervention_applied: string;
    hyperosmolar_agent?: string;
    eeg_status_epilepticus_detected?: boolean;
    outcome_status?: string;
  }) {
    const result = await pool.query(
      `INSERT INTO intracranial_hypertension_events (
        session_id, peak_icp_mmhg, duration_minutes, lundberg_wave_type,
        tier_intervention_applied, hyperosmolar_agent, eeg_status_epilepticus_detected,
        outcome_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        data.session_id,
        data.peak_icp_mmhg,
        data.duration_minutes,
        data.lundberg_wave_type || 'A_wave',
        data.tier_intervention_applied,
        data.hyperosmolar_agent || null,
        data.eeg_status_epilepticus_detected || false,
        data.outcome_status || 'controlled'
      ]
    );

    return result.rows[0];
  }

  /**
   * Fetches Neurocritical Monitoring Sessions and Events for Patient
   */
  static async getPatientNeuroProfile(patientId: number) {
    const sessRes = await pool.query(
      'SELECT * FROM neurocrit_monitoring_sessions WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 10',
      [patientId]
    );

    let events: any[] = [];
    if (sessRes.rows.length > 0) {
      const sessionIds = sessRes.rows.map(s => s.id);
      const evRes = await pool.query(
        'SELECT * FROM intracranial_hypertension_events WHERE session_id = ANY($1) ORDER BY logged_at DESC LIMIT 20',
        [sessionIds]
      );
      events = evRes.rows;
    }

    return {
      sessions: sessRes.rows,
      events
    };
  }
}
