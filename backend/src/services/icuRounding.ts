import { pool } from '../db';

export interface FastHugBidBundle {
  feeding: {
    status: 'ENTERAL' | 'PARENTERAL' | 'NPO_WITH_CONTRAINDICATION' | 'NPO_WITHOUT_REASON';
    compliant: boolean;
    details?: string;
  };
  analgesia: {
    assessed: boolean;
    score: number; // CPOT 0-8 or NRS 0-10
    adequate_control: boolean; // CPOT <= 2 or NRS <= 3
    opioid_sparing_used: boolean;
    compliant: boolean;
  };
  sedation: {
    rass_target: number; // e.g. -1 or 0
    rass_actual: number;
    sedation_vacation_attempted: boolean;
    compliant: boolean;
  };
  thromboembolism: {
    modality: 'PHARMACOLOGICAL_LMWH' | 'PHARMACOLOGICAL_UFH' | 'MECHANICAL_IPC_SCD' | 'NONE';
    contraindication_documented: boolean;
    compliant: boolean;
  };
  head_of_bed: {
    elevation_degrees: number; // 30-45 recommended
    contraindicated: boolean;
    compliant: boolean;
  };
  ulcer_prophylaxis: {
    indicated: boolean; // mechanical ventilation > 48h or coagulopathy
    agent: 'PPI' | 'H2RA' | 'NONE';
    compliant: boolean;
  };
  glucose_control: {
    current_glucose_mg_dl: number;
    within_target_range: boolean; // 140-180 mg/dL target
    insulin_protocol_active: boolean;
    compliant: boolean;
  };
  breathing_trial: {
    intubated: boolean;
    sbt_performed_or_screened: boolean;
    sbt_passed?: boolean;
    compliant: boolean;
  };
  indwelling_devices: {
    daily_review_conducted: boolean;
    foley_in_place: boolean;
    cvc_in_place: boolean;
    art_line_in_place: boolean;
    compliant: boolean;
  };
  deescalation: {
    antibiotics_active: boolean;
    timeout_48h_performed: boolean;
    cultures_reviewed: boolean;
    compliant: boolean;
  };
}

export interface FastHugEvaluationResult {
  total_elements: number;
  compliant_elements: number;
  compliance_percent: number;
  safety_gaps: string[];
  recommendations: string[];
}

export interface CamIcuFeatures {
  acute_onset_or_fluctuating: boolean; // Feature 1
  inattention_errors: number; // Feature 2: SAVEAHAART (errors out of 10, > 2 errors is abnormal)
  current_rass: number; // Feature 3: -5 to +4
  baseline_rass?: number;
  disorganized_thinking_errors: number; // Feature 4: errors out of 5, > 1 error is abnormal
}

export interface CamIcuEvaluationResult {
  delirium_status: 'POSITIVE' | 'NEGATIVE' | 'UNASSESSABLE_COMA';
  subtype: 'HYPERACTIVE' | 'HYPOACTIVE' | 'MIXED' | 'NONE';
  feature_1_acute_fluctuation: boolean;
  feature_2_inattention_positive: boolean;
  feature_3_altered_consciousness_positive: boolean;
  feature_4_disorganized_thinking_positive: boolean;
  qtc_alert: boolean;
  clinical_summary: string;
  antipsychotic_safety_warning?: string;
  interventions: string[];
}

export interface InvasiveDeviceInput {
  device_type: 'foley_urinary_catheter' | 'central_venous_catheter' | 'endotracheal_tube' | 'arterial_line';
  insertion_timestamp: string | Date;
  device_days?: number;
  daily_indication_present: boolean;
  infection_bundle_compliant: boolean;
}

export interface InvasiveDeviceEvaluationResult {
  device_type: string;
  device_days: number;
  daily_indication_present: boolean;
  infection_bundle_compliant: boolean;
  removal_recommended: boolean;
  infection_risk_level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  actionable_guidance: string[];
}

export class IcuRoundingService {
  /**
   * Evaluates the 10 core components of the FAST-HUG-BID bundle
   */
  static evaluateFastHugBid(bundle: FastHugBidBundle): FastHugEvaluationResult {
    let compliantCount = 0;
    const totalCount = 10;
    const safetyGaps: string[] = [];
    const recommendations: string[] = [];

    // F - Feeding
    if (bundle.feeding.compliant) {
      compliantCount++;
    } else {
      safetyGaps.push('Enteral feeding not established and patient is NPO without documented contraindication.');
      recommendations.push('Initiate early trophic enteral nutrition within 24-48h of ICU admission if hemodynamically stable.');
    }

    // A - Analgesia
    if (bundle.analgesia.compliant) {
      compliantCount++;
    } else {
      safetyGaps.push(`Pain inadequately controlled (Score: ${bundle.analgesia.score}) or assessment missing.`);
      recommendations.push('Titrate multimodal analgesia with opioid-sparing adjuncts (Acetaminophen, Gabapentinoids) to CPOT <= 2.');
    }

    // S - Sedation
    if (bundle.sedation.compliant) {
      compliantCount++;
    } else {
      safetyGaps.push(`Sedation out of target (RASS actual: ${bundle.sedation.rass_actual}, target: ${bundle.sedation.rass_target}) or Daily SAT omitted.`);
      recommendations.push('Conduct Spontaneous Awakening Trial (SAT) daily unless actively paralyzed or undergoing ARDS prone ventilation.');
    }

    // T - Thromboembolism
    if (bundle.thromboembolism.compliant) {
      compliantCount++;
    } else {
      safetyGaps.push('VTE prophylaxis missing without documented high bleeding risk contraindication.');
      recommendations.push('Order pharmacological thromboprophylaxis (Enoxaparin 40mg daily or Heparin 5000U TID); apply pneumatic compression devices immediately.');
    }

    // H - Head of Bed
    if (bundle.head_of_bed.compliant) {
      compliantCount++;
    } else {
      safetyGaps.push(`Head of bed angle ${bundle.head_of_bed.elevation_degrees}° is below 30° standard for VAP/aspiration prevention.`);
      recommendations.push('Elevate head of bed between 30° and 45° continuously unless contraindicated by acute spinal clearance or ECMO cannulation.');
    }

    // U - Ulcer Prophylaxis
    if (bundle.ulcer_prophylaxis.compliant) {
      compliantCount++;
    } else {
      safetyGaps.push('Stress ulcer prophylaxis indicated (ventilated > 48h or coagulopathy) but not prescribed.');
      recommendations.push('Initiate enteral/IV PPI or H2RA while risk factors persist.');
    }

    // G - Glucose Control
    if (bundle.glucose_control.compliant) {
      compliantCount++;
    } else {
      safetyGaps.push(`Blood glucose ${bundle.glucose_control.current_glucose_mg_dl} mg/dL outside optimal target (140-180 mg/dL).`);
      recommendations.push('Adjust basal-bolus or IV regular insulin protocol to maintain glycemic stability between 140 and 180 mg/dL.');
    }

    // B - Breathing Trial
    if (bundle.breathing_trial.compliant) {
      compliantCount++;
    } else {
      safetyGaps.push('Intubated patient without documented daily Spontaneous Breathing Trial (SBT) evaluation.');
      recommendations.push('Coordinate SAT/SBT paired weaning trial with respiratory therapy if FiO2 <= 0.40 and PEEP <= 8.');
    }

    // I - Indwelling Devices
    if (bundle.indwelling_devices.compliant) {
      compliantCount++;
    } else {
      safetyGaps.push('Daily review of invasive catheters/lines omitted.');
      recommendations.push('Evaluate everyday necessity of Foley catheter, central line, and arterial lines for immediate removal.');
    }

    // D - De-escalation
    if (bundle.deescalation.compliant) {
      compliantCount++;
    } else {
      safetyGaps.push('Antimicrobial 48-hour timeout not performed or active cultures not addressed.');
      recommendations.push('Audit active antimicrobials against microbiology isolates; de-escalate from broad-spectrum to targeted therapy or cease empiric coverage.');
    }

    const compliancePercent = Math.round((compliantCount / totalCount) * 1000) / 10;

    return {
      total_elements: totalCount,
      compliant_elements: compliantCount,
      compliance_percent: compliancePercent,
      safety_gaps: safetyGaps,
      recommendations: recommendations
    };
  }

  /**
   * Evaluates Delirium using CAM-ICU algorithmic tree and cross-references QTc risk
   */
  static evaluateCamIcu(features: CamIcuFeatures, qtcIntervalMs?: number, baselineQtcMs?: number): CamIcuEvaluationResult {
    // If RASS is -4 or -5, patient is in deep sedation or coma -> CAM-ICU Unassessable
    if (features.current_rass === -4 || features.current_rass === -5) {
      return {
        delirium_status: 'UNASSESSABLE_COMA',
        subtype: 'NONE',
        feature_1_acute_fluctuation: features.acute_onset_or_fluctuating,
        feature_2_inattention_positive: false,
        feature_3_altered_consciousness_positive: false,
        feature_4_disorganized_thinking_positive: false,
        qtc_alert: false,
        clinical_summary: `Patient is deeply sedated or comatose (RASS ${features.current_rass}). Delirium assessment unassessable. Reassess during daily sedation interruption.`,
        interventions: ['Withhold psychoactive sedatives if clinically safe to perform daily sedation interruption (SAT).']
      };
    }

    // Feature 1: Acute Onset or Fluctuating Course
    const f1 = features.acute_onset_or_fluctuating;

    // Feature 2: Inattention (SAVEAHAART: > 2 errors out of 10)
    const f2 = features.inattention_errors > 2;

    // Feature 3: Altered Level of Consciousness (Current RASS != 0)
    const f3 = features.current_rass !== 0;

    // Feature 4: Disorganized Thinking (> 1 error out of 5)
    const f4 = features.disorganized_thinking_errors > 1;

    // CAM-ICU Positive = Feature 1 AND Feature 2 AND (Feature 3 OR Feature 4)
    const isPositive = f1 && f2 && (f3 || f4);

    let subtype: 'HYPERACTIVE' | 'HYPOACTIVE' | 'MIXED' | 'NONE' = 'NONE';
    if (isPositive) {
      if (features.current_rass > 0) {
        subtype = 'HYPERACTIVE';
      } else if (features.current_rass < 0) {
        subtype = 'HYPOACTIVE';
      } else {
        // RASS is 0 but disorganized thinking is positive or fluctuated
        subtype = 'MIXED';
      }
    }

    // Check QTc risk
    let qtcAlert = false;
    let warning: string | undefined = undefined;
    if (qtcIntervalMs && qtcIntervalMs > 500) {
      qtcAlert = true;
      warning = `CRITICAL QTc PROLONGATION (${qtcIntervalMs} ms > 500 ms). High risk for Torsades de Pointes. CONTRAINDICATED: Haloperidol, Ziprasidone, Quetiapine. Check and replate K+ >= 4.0 mEq/L and Mg2+ >= 2.0 mg/dL.`;
    } else if (qtcIntervalMs && baselineQtcMs && (qtcIntervalMs - baselineQtcMs) >= 60) {
      qtcAlert = true;
      warning = `SIGNIFICANT QTc DELTA (+${qtcIntervalMs - baselineQtcMs} ms from baseline). Extreme caution with QT-prolonging antipsychotics. Continuous telemetry monitoring required.`;
    }

    const interventions: string[] = [];
    if (isPositive) {
      interventions.push('Initiate ABCDEF bundle: daily awakening and breathing trials, optimize pain control, early progressive mobility.');
      interventions.push('Promote sleep-wake cycle: open window blinds, decrease nocturnal monitor alarms, avoid unnecessary midnight vitals/labs.');
      interventions.push('Discontinue deliriogenic medications: high-dose benzodiazepines, anticholinergics, antihistamines.');
      if (subtype === 'HYPERACTIVE') {
        interventions.push('For severe agitation risking self-extubation or device dislodgement: Dexmedetomidine preferred over haloperidol.');
      } else if (subtype === 'HYPOACTIVE') {
        interventions.push('Non-pharmacological delirium protocol: frequent reorientation, family presence, corrective sensory devices (glasses, hearing aids).');
      }
      if (qtcAlert && warning) {
        interventions.push('AVOID conventional antipsychotics (Haloperidol) due to dangerous QTc elevation.');
      }
    } else {
      interventions.push('Maintain non-pharmacological delirium prevention protocol and repeat CAM-ICU screening every nursing shift.');
    }

    const clinicalSummary = isPositive
      ? `CAM-ICU POSITIVE: Delirium detected (${subtype} subtype). Features: Acute onset/fluctuation=${f1}, Inattention=${f2}, Altered RASS=${f3} (${features.current_rass}), Disorganized thinking=${f4}.`
      : `CAM-ICU NEGATIVE: No clinical evidence of ICU delirium at current evaluation. RASS ${features.current_rass}.`;

    return {
      delirium_status: isPositive ? 'POSITIVE' : 'NEGATIVE',
      subtype,
      feature_1_acute_fluctuation: f1,
      feature_2_inattention_positive: f2,
      feature_3_altered_consciousness_positive: f3,
      feature_4_disorganized_thinking_positive: f4,
      qtc_alert: qtcAlert,
      clinical_summary: clinicalSummary,
      antipsychotic_safety_warning: warning,
      interventions
    };
  }

  /**
   * Evaluates Invasive Device Days & flags CAUTI, CLABSI, and VAP bundle triggers
   */
  static evaluateDevice(input: InvasiveDeviceInput): InvasiveDeviceEvaluationResult {
    let days = input.device_days;
    if (days === undefined) {
      const insertion = new Date(input.insertion_timestamp).getTime();
      const now = Date.now();
      days = Math.max(0, Math.round(((now - insertion) / (1000 * 60 * 60 * 24)) * 10) / 10);
    }

    let removalRecommended = false;
    let riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' = 'LOW';
    const guidance: string[] = [];

    switch (input.device_type) {
      case 'foley_urinary_catheter':
        if (days > 2.0 && !input.daily_indication_present) {
          removalRecommended = true;
          riskLevel = 'HIGH';
          guidance.push(`Foley catheter in place for ${days} days without clear ongoing clinical indication. Immediate removal recommended to prevent CAUTI.`);
          guidance.push('Transition to condom catheter, external female collection pouch, or intermittent straight cath protocol.');
        } else if (days > 2.0) {
          riskLevel = 'MODERATE';
          guidance.push(`Foley catheter duration ${days} days. Document daily necessity (e.g. hourly urine output in shock, urinary retention, open sacral wound).`);
        } else {
          riskLevel = 'LOW';
          guidance.push('Ensure dependent drainage bag positioning below bladder level and closed sterile system maintenance.');
        }
        break;

      case 'central_venous_catheter':
        if (days > 7.0 || !input.daily_indication_present) {
          removalRecommended = !input.daily_indication_present || days > 14.0;
          riskLevel = days > 14.0 ? 'CRITICAL' : 'HIGH';
          guidance.push(`Central line in place for ${days} days. High CLABSI hazard zone. Daily inspection of insertion site and chlorhexidine dressing integrity mandatory.`);
          if (!input.daily_indication_present) {
            guidance.push('No ongoing indication for central access. Pull line today or step down to peripheral ultrasound-guided IV.');
          }
        } else if (!input.infection_bundle_compliant) {
          riskLevel = 'HIGH';
          guidance.push('CLABSI prevention bundle non-compliant: Immediate dressing change, biopatch replacement, and scrub-the-hub auditing required.');
        } else {
          riskLevel = 'MODERATE';
          guidance.push('Maintain biopatch dressing and aseptic port scrub protocols.');
        }
        break;

      case 'endotracheal_tube':
        if (days > 2.0) {
          riskLevel = days > 7.0 ? 'HIGH' : 'MODERATE';
          guidance.push(`Mechanical ventilation day ${days}. VAP bundle surveillance active: continuous subglottic aspiration, chlorhexidine oral care q12h, head of bed >= 30°.`);
          if (days > 10.0) {
            guidance.push('Prolonged mechanical ventilation (>10 days): Consult ENT/Trauma surgery for early tracheostomy evaluation.');
          }
        } else {
          riskLevel = 'LOW';
          guidance.push('Daily assessment for spontaneous breathing trial (SBT) readiness.');
        }
        break;

      case 'arterial_line':
        if (days > 5.0 || !input.daily_indication_present) {
          removalRecommended = !input.daily_indication_present || days > 7.0;
          riskLevel = days > 7.0 ? 'HIGH' : 'MODERATE';
          guidance.push(`Arterial line in place for ${days} days. Assess continuous blood pressure monitoring necessity; step down to automated cuff if vasopressors weaned.`);
        } else {
          riskLevel = 'LOW';
          guidance.push('Check distal pulse and skin perfusion every shift to rule out limb ischemia.');
        }
        break;
    }

    if (!input.infection_bundle_compliant) {
      guidance.push('Infection bundle deviation detected. Re-educate nursing staff and inspect insertion site for erythema or purulence.');
    }

    return {
      device_type: input.device_type,
      device_days: days,
      daily_indication_present: input.daily_indication_present,
      infection_bundle_compliant: input.infection_bundle_compliant,
      removal_recommended: removalRecommended,
      infection_risk_level: riskLevel,
      actionable_guidance: guidance
    };
  }

  /**
   * Persists an ICU Rounding Checklist in the database
   */
  static async saveRoundingChecklist(params: {
    patient_id: number;
    bed_number: string;
    fast_hug_bid_bundle: FastHugBidBundle;
    compliance_score_percent: number;
    cam_icu_delirium_status: string;
    cam_icu_subtype?: string;
    qtc_interval_ms?: number;
    qtc_risk_alert: boolean;
    antimicrobial_timeout_due: boolean;
  }) {
    const query = `
      INSERT INTO icu_rounding_checklists (
        patient_id,
        bed_number,
        fast_hug_bid_bundle,
        compliance_score_percent,
        cam_icu_delirium_status,
        cam_icu_subtype,
        qtc_interval_ms,
        qtc_risk_alert,
        antimicrobial_timeout_due
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;
    const values = [
      params.patient_id,
      params.bed_number,
      JSON.stringify(params.fast_hug_bid_bundle),
      params.compliance_score_percent,
      params.cam_icu_delirium_status,
      params.cam_icu_subtype || null,
      params.qtc_interval_ms || null,
      params.qtc_risk_alert,
      params.antimicrobial_timeout_due
    ];
    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  /**
   * Tracks an invasive device entry in the database
   */
  static async trackInvasiveDevice(params: {
    patient_id: number;
    device_type: string;
    insertion_timestamp: string | Date;
    device_days: number;
    daily_indication_present: boolean;
    infection_bundle_compliant: boolean;
    removal_recommended: boolean;
  }) {
    const query = `
      INSERT INTO invasive_device_trackers (
        patient_id,
        device_type,
        insertion_timestamp,
        device_days,
        daily_indication_present,
        infection_bundle_compliant,
        removal_recommended
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const values = [
      params.patient_id,
      params.device_type,
      params.insertion_timestamp,
      params.device_days,
      params.daily_indication_present,
      params.infection_bundle_compliant,
      params.removal_recommended
    ];
    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  /**
   * Retrieves rounding history and active devices for a patient
   */
  static async getPatientRoundingHistory(patientId: number) {
    const checklistsQuery = `
      SELECT * FROM icu_rounding_checklists
      WHERE patient_id = $1
      ORDER BY created_at DESC
      LIMIT 20;
    `;
    const devicesQuery = `
      SELECT * FROM invasive_device_trackers
      WHERE patient_id = $1
      ORDER BY created_at DESC
      LIMIT 20;
    `;
    const [checklistsRes, devicesRes] = await Promise.all([
      pool.query(checklistsQuery, [patientId]),
      pool.query(devicesQuery, [patientId])
    ]);
    return {
      checklists: checklistsRes.rows,
      devices: devicesRes.rows
    };
  }
}
