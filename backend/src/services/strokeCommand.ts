import { query } from '../db';

export interface NihssDetails {
  loc1a: number; // 0-3 Level of consciousness
  loc1b: number; // 0-2 LOC Questions
  loc1c: number; // 0-2 LOC Commands
  bestGaze: number; // 0-2 Horizontal gaze
  visualFields: number; // 0-3 Visual fields
  facialPalsy: number; // 0-3 Facial symmetry
  motorLeftArm: number; // 0-4 Motor drift left arm
  motorRightArm: number; // 0-4 Motor drift right arm
  motorLeftLeg: number; // 0-4 Motor drift left leg
  motorRightLeg: number; // 0-4 Motor drift right leg
  limbAtaxia: number; // 0-2 Cerebellar ataxia
  sensoryLoss: number; // 0-2 Pinprick sensation
  bestLanguage: number; // 0-3 Aphasia assessment
  dysarthria: number; // 0-2 Articulation/slurring
  extinctionInattention: number; // 0-2 Visual/tactile neglect
}

export interface ThrombolysisParams {
  patientWeightKg: number;
  lastKnownWell: string | Date;
  edArrivalTime: string | Date;
  systolicBp: number;
  diastolicBp: number;
  bloodGlucoseMgDl: number;
  plateletCount: number;
  inr: number;
  onOralAnticoagulants: boolean;
  recentMajorSurgeryOrHeadTrauma: boolean;
  activeInternalBleeding: boolean;
  ctHemorrhagePresent: boolean;
  preferredAgent?: 'tenecteplase' | 'alteplase';
}

export interface ThrombectomyParams {
  nihssScore: number;
  aspectsScore: number; // 0-10
  lvoDetected: boolean;
  lvoLocation: 'ICA' | 'MCA_M1' | 'MCA_M2' | 'Basilar' | 'None';
  hoursSinceLKW: number;
  preStrokemRS?: number; // modified Rankin Scale 0-2 preferred
}

export class StrokeCommandService {
  /**
   * Evaluates NIH Stroke Scale (0-42), determines clinical severity tier,
   * anatomical localization (dominant vs non-dominant vs posterior vs lacunar), and key functional deficits.
   */
  static evaluateNihss(details: NihssDetails): {
    totalScore: number;
    severity: 'No Stroke Symptoms' | 'Minor Stroke' | 'Moderate Stroke' | 'Moderate to Severe Stroke' | 'Severe Stroke';
    localization: string;
    deficits: string[];
  } {
    const totalScore =
      details.loc1a +
      details.loc1b +
      details.loc1c +
      details.bestGaze +
      details.visualFields +
      details.facialPalsy +
      details.motorLeftArm +
      details.motorRightArm +
      details.motorLeftLeg +
      details.motorRightLeg +
      details.limbAtaxia +
      details.sensoryLoss +
      details.bestLanguage +
      details.dysarthria +
      details.extinctionInattention;

    let severity: 'No Stroke Symptoms' | 'Minor Stroke' | 'Moderate Stroke' | 'Moderate to Severe Stroke' | 'Severe Stroke';
    if (totalScore === 0) severity = 'No Stroke Symptoms';
    else if (totalScore <= 4) severity = 'Minor Stroke';
    else if (totalScore <= 15) severity = 'Moderate Stroke';
    else if (totalScore <= 20) severity = 'Moderate to Severe Stroke';
    else severity = 'Severe Stroke';

    const deficits: string[] = [];
    if (details.loc1a > 0) deficits.push('Depressed Level of Consciousness');
    if (details.facialPalsy > 0) deficits.push('Facial Asymmetry / Palsy');
    if (details.motorLeftArm > 0 || details.motorLeftLeg > 0) deficits.push('Left-Sided Motor Drift / Hemiparesis');
    if (details.motorRightArm > 0 || details.motorRightLeg > 0) deficits.push('Right-Sided Motor Drift / Hemiparesis');
    if (details.bestLanguage > 0) deficits.push('Aphasia / Language Impairment');
    if (details.dysarthria > 0) deficits.push('Dysarthria / Slurred Speech');
    if (details.bestGaze > 0) deficits.push('Horizontal Conjugate Gaze Deviation');
    if (details.visualFields > 0) deficits.push('Visual Field Defect / Hemianopia');
    if (details.limbAtaxia > 0) deficits.push('Limb Cerebellar Ataxia');
    if (details.extinctionInattention > 0) deficits.push('Hemi-spatial Inattention / Neglect');

    // Neuroanatomical localization reasoning
    let localization = 'Indeterminate Cortical / Subcortical Syndrome';
    const leftHemisphereSigns = (details.motorRightArm > 0 || details.motorRightLeg > 0) && details.bestLanguage > 0;
    const rightHemisphereSigns = (details.motorLeftArm > 0 || details.motorLeftLeg > 0) && details.extinctionInattention > 0;
    const posteriorSigns = details.limbAtaxia > 0 || (details.bestGaze > 0 && details.loc1a > 1);

    if (leftHemisphereSigns) {
      localization = 'Dominant Left MCA Territory (Cortical Aphasia + Right Hemiparesis)';
    } else if (rightHemisphereSigns) {
      localization = 'Non-Dominant Right MCA Territory (Hemi-spatial Neglect + Left Hemiparesis)';
    } else if (posteriorSigns) {
      localization = 'Vertebrobasilar / Posterior Fossa Circulation (Brainstem/Cerebellar Signs)';
    } else if (details.motorLeftArm > 0 || details.motorRightArm > 0) {
      localization = 'Lacunar / Deep Subcortical Ischemia (Internal Capsule / Corona Radiata)';
    }

    return { totalScore, severity, localization, deficits };
  }

  /**
   * Assesses IV Thrombolytic (Tenecteplase / Alteplase) candidacy, contraindications, and dosing.
   */
  static evaluateThrombolysis(params: ThrombolysisParams): {
    safetyCleared: boolean;
    contraindications: string[];
    agentRecommended: 'tenecteplase' | 'alteplase';
    recommendedDoseMg: number;
    rationale: string;
    bloodPressureControlled: boolean;
  } {
    const contraindications: string[] = [];

    // Time window calculation
    const lkwDate = new Date(params.lastKnownWell);
    const edDate = new Date(params.edArrivalTime);
    const diffHours = (edDate.getTime() - lkwDate.getTime()) / (1000 * 60 * 60);

    if (diffHours > 4.5) {
      contraindications.push(`Time since Last Known Well (${diffHours.toFixed(1)}h) exceeds 4.5h standard IV thrombolytic window`);
    }

    if (params.ctHemorrhagePresent) {
      contraindications.push('Absolute Contraindication: Acute intracranial hemorrhage visualised on neuroimaging');
    }

    const bpExceeded = params.systolicBp >= 185 || params.diastolicBp >= 110;
    if (bpExceeded) {
      contraindications.push(`Blood pressure (${params.systolicBp}/${params.diastolicBp} mmHg) exceeds safety threshold (SBP < 185, DBP < 110 required)`);
    }

    if (params.bloodGlucoseMgDl < 50) {
      contraindications.push(`Severe hypoglycemia (${params.bloodGlucoseMgDl} mg/dL) must be reversed before administering thrombolytics`);
    }

    if (params.plateletCount < 100000) {
      contraindications.push(`Thrombocytopenia (${params.plateletCount} /uL < 100,000 threshold) poses severe hemorrhagic risk`);
    }

    if (params.inr > 1.7) {
      contraindications.push(`Coagulopathy (INR ${params.inr} > 1.7 threshold) contraindicates intravenous fibrinolysis`);
    }

    if (params.onOralAnticoagulants) {
      contraindications.push('Active treatment with direct oral anticoagulant (DOAC) or therapeutic heparin within 48h');
    }

    if (params.recentMajorSurgeryOrHeadTrauma) {
      contraindications.push('Recent major surgery, serious head trauma, or intracranial surgery within past 3 months');
    }

    if (params.activeInternalBleeding) {
      contraindications.push('Active internal bleeding or known gastrointestinal hemorrhage within past 21 days');
    }

    const safetyCleared = contraindications.length === 0;
    const agent = params.preferredAgent || 'tenecteplase';

    // Tenecteplase: 0.25 mg/kg IV bolus over 5 sec (max 25 mg)
    // Alteplase: 0.9 mg/kg IV (max 90 mg)
    let doseMg = 0;
    if (agent === 'tenecteplase') {
      doseMg = Math.min(25, Number((params.patientWeightKg * 0.25).toFixed(2)));
    } else {
      doseMg = Math.min(90, Number((params.patientWeightKg * 0.9).toFixed(2)));
    }

    let rationale = safetyCleared
      ? `Patient meets all AHA/ASA inclusion criteria within ${diffHours.toFixed(1)}h of LKW. Administer ${agent.toUpperCase()} ${doseMg} mg immediately.`
      : `IV Thrombolysis withheld due to ${contraindications.length} safety contraindication(s). Consider emergent Endovascular Thrombectomy (EVT) if LVO present.`;

    return {
      safetyCleared,
      contraindications,
      agentRecommended: agent,
      recommendedDoseMg: doseMg,
      rationale,
      bloodPressureControlled: !bpExceeded
    };
  }

  /**
   * Assesses Endovascular Mechanical Thrombectomy (EVT) eligibility per DAWN / DEFUSE-3 criteria.
   */
  static evaluateThrombectomy(params: ThrombectomyParams): {
    candidate: boolean;
    windowType: 'early_0_6h' | 'extended_6_24h' | 'not_eligible';
    rationale: string;
    targetAngioSuiteMinutes: number;
  } {
    if (!params.lvoDetected || params.lvoLocation === 'None') {
      return {
        candidate: false,
        windowType: 'not_eligible',
        rationale: 'No Large Vessel Occlusion (LVO) detected on CTA/MRA.',
        targetAngioSuiteMinutes: 0
      };
    }

    if (params.nihssScore < 6) {
      return {
        candidate: false,
        windowType: 'not_eligible',
        rationale: `NIHSS score (${params.nihssScore}) < 6. EVT generally reserved for disabling deficits with NIHSS >= 6.`,
        targetAngioSuiteMinutes: 0
      };
    }

    if (params.aspectsScore < 6) {
      return {
        candidate: false,
        windowType: 'not_eligible',
        rationale: `ASPECTS score (${params.aspectsScore}/10) < 6 signifies large completed core infarction with excessive hemorrhagic transformation risk.`,
        targetAngioSuiteMinutes: 0
      };
    }

    if (params.hoursSinceLKW <= 6) {
      return {
        candidate: true,
        windowType: 'early_0_6h',
        rationale: `Eligible for Early-Window Mechanical Thrombectomy (0-6h from LKW). LVO in ${params.lvoLocation}, NIHSS ${params.nihssScore}, ASPECTS ${params.aspectsScore}/10.`,
        targetAngioSuiteMinutes: 60
      };
    } else if (params.hoursSinceLKW <= 24) {
      return {
        candidate: true,
        windowType: 'extended_6_24h',
        rationale: `Eligible for Extended-Window Mechanical Thrombectomy (6-24h, DAWN/DEFUSE-3 criteria). Salvageable penumbra with ASPECTS ${params.aspectsScore}/10 and proximal ${params.lvoLocation} occlusion.`,
        targetAngioSuiteMinutes: 45
      };
    } else {
      return {
        candidate: false,
        windowType: 'not_eligible',
        rationale: `Time from Last Known Well (${params.hoursSinceLKW.toFixed(1)}h) exceeds 24h thrombectomy window.`,
        targetAngioSuiteMinutes: 0
      };
    }
  }

  /**
   * Calculates Door-to-Needle (DTN) time and benchmark compliance.
   */
  static calculateDoorToNeedle(edArrival: string | Date, treatmentTime: string | Date): {
    dtnMinutes: number;
    targetMet: boolean;
    speedTier: 'golden_hour' | 'standard_target' | 'delayed';
  } {
    const arrival = new Date(edArrival).getTime();
    const treatment = new Date(treatmentTime).getTime();
    const dtnMinutes = Math.max(0, Math.round((treatment - arrival) / (1000 * 60)));

    let speedTier: 'golden_hour' | 'standard_target' | 'delayed';
    if (dtnMinutes <= 30) speedTier = 'golden_hour';
    else if (dtnMinutes <= 45) speedTier = 'standard_target';
    else speedTier = 'delayed';

    return {
      dtnMinutes,
      targetMet: dtnMinutes <= 45,
      speedTier
    };
  }

  /**
   * Creates a new Acute Stroke Code event in the database.
   */
  static async createStrokeCase(patientId: number, data: {
    lastKnownWell: string | Date;
    edArrivalTime: string | Date;
    ctCompletionTime?: string | Date;
    nihssDetails: NihssDetails;
    strokeSubtype: 'Ischemic' | 'Hemorrhagic' | 'TIA';
    aspectsScore?: number;
    lvoDetected?: boolean;
    lvoLocation?: string;
    thrombolyticCandidate?: boolean;
    thrombectomyCandidate?: boolean;
  }) {
    const nihssEval = this.evaluateNihss(data.nihssDetails);

    const res = await query(
      `INSERT INTO stroke_code_cases (
        patient_id, last_known_well, ed_arrival_time, ct_completion_time,
        nihss_total_score, nihss_details, stroke_subtype, aspects_score,
        lvo_detected, lvo_location, thrombolytic_candidate, thrombectomy_candidate,
        case_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active_code')
      RETURNING *`,
      [
        patientId,
        data.lastKnownWell,
        data.edArrivalTime,
        data.ctCompletionTime || null,
        nihssEval.totalScore,
        JSON.stringify(data.nihssDetails),
        data.strokeSubtype,
        data.aspectsScore || null,
        data.lvoDetected || false,
        data.lvoLocation || null,
        data.thrombolyticCandidate || false,
        data.thrombectomyCandidate || false
      ]
    );

    return {
      ...res.rows[0],
      nihss_evaluation: nihssEval
    };
  }

  /**
   * Records a thrombolysis safety checklist evaluation.
   */
  static async recordThrombolyticEvaluation(caseId: number, data: {
    patientWeightKg: number;
    systolicBp: number;
    diastolicBp: number;
    bloodGlucoseMgDl: number;
    plateletCount: number;
    inr: number;
    onOralAnticoagulants: boolean;
    recentMajorSurgeryOrHeadTrauma: boolean;
    activeInternalBleeding: boolean;
    ctHemorrhagePresent: boolean;
    preferredAgent?: 'tenecteplase' | 'alteplase';
  }) {
    // Fetch parent stroke case to get LKW and ED arrival
    const caseRes = await query('SELECT * FROM stroke_code_cases WHERE id = $1', [caseId]);
    if (caseRes.rows.length === 0) {
      throw new Error(`Stroke case #${caseId} not found`);
    }
    const strokeCase = caseRes.rows[0];

    const evalResult = this.evaluateThrombolysis({
      patientWeightKg: data.patientWeightKg,
      lastKnownWell: strokeCase.last_known_well,
      edArrivalTime: strokeCase.ed_arrival_time,
      systolicBp: data.systolicBp,
      diastolicBp: data.diastolicBp,
      bloodGlucoseMgDl: data.bloodGlucoseMgDl,
      plateletCount: data.plateletCount,
      inr: data.inr,
      onOralAnticoagulants: data.onOralAnticoagulants,
      recentMajorSurgeryOrHeadTrauma: data.recentMajorSurgeryOrHeadTrauma,
      activeInternalBleeding: data.activeInternalBleeding,
      ctHemorrhagePresent: data.ctHemorrhagePresent,
      preferredAgent: data.preferredAgent
    });

    const res = await query(
      `INSERT INTO thrombolytic_evaluations (
        stroke_case_id, systolic_bp, diastolic_bp, blood_glucose_mg_dl,
        platelet_count, inr, on_oral_anticoagulants, recent_major_surgery_head_trauma,
        active_internal_bleeding, contraindications, safety_cleared,
        agent_recommended, recommended_dose_mg
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        caseId,
        data.systolicBp,
        data.diastolicBp,
        data.bloodGlucoseMgDl,
        data.plateletCount,
        data.inr,
        data.onOralAnticoagulants,
        data.recentMajorSurgeryOrHeadTrauma,
        data.activeInternalBleeding,
        JSON.stringify(evalResult.contraindications),
        evalResult.safetyCleared,
        evalResult.agentRecommended,
        evalResult.recommendedDoseMg
      ]
    );

    // If cleared, update stroke case candidacy
    if (evalResult.safetyCleared) {
      await query(
        `UPDATE stroke_code_cases
         SET thrombolytic_candidate = TRUE, thrombolytic_agent = $1
         WHERE id = $2`,
        [evalResult.agentRecommended, caseId]
      );
    }

    return {
      evaluation: res.rows[0],
      analysis: evalResult
    };
  }

  /**
   * Administers thrombolytic and logs Door-to-Needle (DTN) time.
   */
  static async recordThrombolyticAdministration(caseId: number, administeredAt: string | Date) {
    const caseRes = await query('SELECT * FROM stroke_code_cases WHERE id = $1', [caseId]);
    if (caseRes.rows.length === 0) throw new Error(`Stroke case #${caseId} not found`);
    const strokeCase = caseRes.rows[0];

    const dtn = this.calculateDoorToNeedle(strokeCase.ed_arrival_time, administeredAt);

    const updateRes = await query(
      `UPDATE stroke_code_cases
       SET thrombolytic_administered = TRUE,
           door_to_needle_minutes = $1,
           dtn_target_met = $2
       WHERE id = $3
       RETURNING *`,
      [dtn.dtnMinutes, dtn.targetMet, caseId]
    );

    return {
      updatedCase: updateRes.rows[0],
      dtnMetrics: dtn
    };
  }

  /**
   * Updates mechanical thrombectomy progress status.
   */
  static async updateThrombectomyStatus(caseId: number, status: string) {
    const res = await query(
      `UPDATE stroke_code_cases
       SET thrombectomy_status = $1
       WHERE id = $2
       RETURNING *`,
      [status, caseId]
    );
    return res.rows[0];
  }

  /**
   * Lists stroke code cases with optional filtering.
   */
  static async getStrokeCases(patientId?: number) {
    let sql = 'SELECT * FROM stroke_code_cases';
    const params: any[] = [];
    if (patientId) {
      sql += ' WHERE patient_id = $1';
      params.push(patientId);
    }
    sql += ' ORDER BY created_at DESC';
    const res = await query(sql, params);
    return res.rows;
  }
}
