import { query } from '../db';

export interface EkgPatternInput {
  patternType: 'Classic_STEMI' | 'Smith_Sgarbossa_LBBB' | 'Wellens_Type_A' | 'Wellens_Type_B' | 'de_Winter' | 'Posterior_STEMI';
  leadsWithElevation?: string[]; // e.g. ['V1', 'V2', 'V3', 'V4']
  sgarbossaConcordantSte?: boolean; // >= 1mm in leads with positive QRS
  sgarbossaConcordantStdV1V3?: boolean; // >= 1mm in V1-V3
  smithExcessiveDiscordanceRatio?: number; // ST / S ratio (e.g. -0.28)
  stElevationMm?: number;
}

export interface CinParams {
  age: number;
  diabetes: boolean;
  congestiveHeartFailure: boolean;
  hypotensionOrShock: boolean;
  baselineEgfr: number; // mL/min/1.73m2
  contrastVolumeMl: number;
  patientWeightKg: number;
}

export interface PciLogInput {
  lesionLocation: string; // e.g. 'Proximal_LAD', 'Mid_RCA', 'Circumflex_OM1'
  prePciTimiFlow: number; // 0-3
  postPciTimiFlow: number; // 0-3
  stentType: string; // e.g. 'DES_Everolimus_Eluting'
  stentDiameterMm: number;
  stentLengthMm: number;
  anticoagulantAgent: string; // 'Unfractionated_Heparin' | 'Bivalirudin'
  peakActSeconds: number;
}

export class CathAlertService {
  /**
   * Evaluates 12-lead ECG for Classic STEMI or High-Risk Occlusion MI (OMI) Equivalents.
   */
  static evaluateEkgPattern(input: EkgPatternInput): {
    patternName: string;
    isOmiEquivalent: boolean;
    culpritVessel: 'LAD' | 'RCA' | 'LCx' | 'Left_Main' | 'Indeterminate';
    urgencyLevel: 'EMERGENT_CATH_LAB' | 'URGENT_ANGIO_2H' | 'ISCHEMIA_GUIDED';
    rationale: string;
  } {
    let culpritVessel: 'LAD' | 'RCA' | 'LCx' | 'Left_Main' | 'Indeterminate' = 'Indeterminate';
    let isOmiEquivalent = true;
    let urgencyLevel: 'EMERGENT_CATH_LAB' | 'URGENT_ANGIO_2H' | 'ISCHEMIA_GUIDED' = 'EMERGENT_CATH_LAB';
    let rationale = '';

    switch (input.patternType) {
      case 'Classic_STEMI': {
        const leads = input.leadsWithElevation || [];
        const isAnterior = leads.some((l) => ['V1', 'V2', 'V3', 'V4'].includes(l));
        const isInferior = leads.some((l) => ['II', 'III', 'aVF'].includes(l));
        const isLateral = leads.some((l) => ['I', 'aVL', 'V5', 'V6'].includes(l));

        if (isAnterior) culpritVessel = 'LAD';
        else if (isInferior) culpritVessel = 'RCA';
        else if (isLateral) culpritVessel = 'LCx';
        else culpritVessel = 'LAD';

        rationale = `Classic STEMI confirmed with acute injury current in ${leads.join(', ')}. Culprit: ${culpritVessel}. Immediate Door-to-Balloon pathway mandated.`;
        break;
      }

      case 'Smith_Sgarbossa_LBBB': {
        culpritVessel = 'LAD';
        const concordantSte = input.sgarbossaConcordantSte || false;
        const concordantStd = input.sgarbossaConcordantStdV1V3 || false;
        const ratio = input.smithExcessiveDiscordanceRatio !== undefined ? input.smithExcessiveDiscordanceRatio : -0.15;
        const excessiveDiscordance = ratio <= -0.25;

        if (concordantSte || concordantStd || excessiveDiscordance) {
          isOmiEquivalent = true;
          urgencyLevel = 'EMERGENT_CATH_LAB';
          rationale = `Positive Smith-Modified Sgarbossa (ST/S ratio ${ratio} <= -0.25 or concordant STE/STD). High specificity for acute coronary occlusion despite LBBB/ventricular pacing.`;
        } else {
          isOmiEquivalent = false;
          urgencyLevel = 'URGENT_ANGIO_2H';
          rationale = 'LBBB present without satisfying Smith-Sgarbossa criteria. Correlate with emergent bedside echo and serial troponins.';
        }
        break;
      }

      case 'Wellens_Type_A':
      case 'Wellens_Type_B': {
        culpritVessel = 'LAD';
        isOmiEquivalent = true;
        urgencyLevel = 'EMERGENT_CATH_LAB';
        const typeStr = input.patternType === 'Wellens_Type_A' ? 'Type A (Biphasic T-waves V2-V3)' : 'Type B (Deep, symmetric T-wave inversions V2-V3)';
        rationale = `Wellens Syndrome ${typeStr} indicates impending transmural anterior MI due to severe proximal LAD stenosis. Avoid stress testing; prepare emergent catheterization.`;
        break;
      }

      case 'de_Winter': {
        culpritVessel = 'LAD';
        isOmiEquivalent = true;
        urgencyLevel = 'EMERGENT_CATH_LAB';
        rationale = 'de Winter T-Waves (1-3mm upsloping ST depression at J-point with tall, peaked precordial T-waves) represents acute anterior descending OMI equivalent in ~2% of acute anterior LAD occlusions.';
        break;
      }

      case 'Posterior_STEMI': {
        culpritVessel = 'LCx';
        isOmiEquivalent = true;
        urgencyLevel = 'EMERGENT_CATH_LAB';
        rationale = 'Isolated Posterior STEMI with reciprocal horizontal ST depression, tall R-waves in V1-V3, and posterior ST elevation in leads V7-V9. Presumed LCx occlusion.';
        break;
      }

      default:
        isOmiEquivalent = false;
        urgencyLevel = 'ISCHEMIA_GUIDED';
        rationale = 'Indeterminate ECG presentation. Inpatient telemetry monitoring and serial high-sensitivity troponins recommended.';
    }

    return {
      patternName: input.patternType,
      isOmiEquivalent,
      culpritVessel,
      urgencyLevel,
      rationale
    };
  }

  /**
   * Calculates Door-to-Balloon (D2B) time and benchmark adherence (AHA/ACC Goal <= 90 mins).
   */
  static calculateDoorToBalloon(edArrival: string | Date, balloonInflation: string | Date): {
    d2bMinutes: number;
    targetMet: boolean;
    speedClassification: 'gold_standard_sub60' | 'guideline_met_sub90' | 'delayed';
  } {
    const arrival = new Date(edArrival).getTime();
    const balloon = new Date(balloonInflation).getTime();
    const d2bMinutes = Math.max(0, Math.round((balloon - arrival) / (1000 * 60)));

    let speedClassification: 'gold_standard_sub60' | 'guideline_met_sub90' | 'delayed';
    if (d2bMinutes <= 60) speedClassification = 'gold_standard_sub60';
    else if (d2bMinutes <= 90) speedClassification = 'guideline_met_sub90';
    else speedClassification = 'delayed';

    return {
      d2bMinutes,
      targetMet: d2bMinutes <= 90,
      speedClassification
    };
  }

  /**
   * Calculates Mehran 2.0 Risk Score for Contrast-Induced Nephropathy (CIN / PC-AKI).
   */
  static calculateMehranCinRisk(params: CinParams): {
    riskScore: number;
    riskTier: 'Low' | 'Moderate' | 'High' | 'Very_High';
    postPciAkiRiskPercent: number;
    dialysisRiskPercent: number;
    hydrationTargetMlPerHr: number;
    hydrationGuideline: string;
  } {
    let score = 0;

    // Hypotension / cardiogenic shock (5 pts)
    if (params.hypotensionOrShock) score += 5;

    // Congestive Heart Failure / NYHA III-IV (5 pts)
    if (params.congestiveHeartFailure) score += 5;

    // Age > 75 (4 pts)
    if (params.age > 75) score += 4;

    // Diabetes Mellitus (3 pts)
    if (params.diabetes) score += 3;

    // Baseline eGFR
    if (params.baselineEgfr < 20) score += 6;
    else if (params.baselineEgfr < 40) score += 4;
    else if (params.baselineEgfr < 60) score += 2;

    // Contrast Volume: 1 pt per 100 mL
    const contrastPts = Math.floor(params.contrastVolumeMl / 100);
    score += contrastPts;

    let riskTier: 'Low' | 'Moderate' | 'High' | 'Very_High';
    let postPciAkiRiskPercent = 5.0;
    let dialysisRiskPercent = 0.1;

    if (score <= 5) {
      riskTier = 'Low';
      postPciAkiRiskPercent = 7.5;
      dialysisRiskPercent = 0.04;
    } else if (score <= 10) {
      riskTier = 'Moderate';
      postPciAkiRiskPercent = 14.0;
      dialysisRiskPercent = 0.12;
    } else if (score <= 15) {
      riskTier = 'High';
      postPciAkiRiskPercent = 26.1;
      dialysisRiskPercent = 1.09;
    } else {
      riskTier = 'Very_High';
      postPciAkiRiskPercent = 57.3;
      dialysisRiskPercent = 12.6;
    }

    // Weight-based hydration rate: 1.0 to 1.5 mL/kg/h isotonic saline
    const weight = Math.max(40, params.patientWeightKg);
    const hydrationTargetMlPerHr = Number((weight * 1.0).toFixed(0));

    const hydrationGuideline =
      riskTier === 'High' || riskTier === 'Very_High'
        ? `Initiate aggressive renal hydration with isotonic 0.9% NaCl at ${hydrationTargetMlPerHr} mL/hr for 6-12 hours post-PCI. Minimize radiocontrast volume < ${Math.max(100, Math.round(params.baselineEgfr * 2))} mL.`
        : `Standard hydration protocol: 0.9% NaCl at ${hydrationTargetMlPerHr} mL/hr for 4-6 hours post-PCI.`;

    return {
      riskScore: score,
      riskTier,
      postPciAkiRiskPercent,
      dialysisRiskPercent,
      hydrationTargetMlPerHr,
      hydrationGuideline
    };
  }

  /**
   * Activates a STEMI / Cath Alert case in DB.
   */
  static async activateStemiCode(patientId: number, data: {
    ekgPattern: EkgPatternInput;
    edArrivalTime: string | Date;
    cathLabActivationTime: string | Date;
    vascularAccessSite?: 'Right_Radial' | 'Left_Radial' | 'Right_Femoral' | 'Left_Femoral';
  }) {
    const ekgEval = this.evaluateEkgPattern(data.ekgPattern);

    const res = await query(
      `INSERT INTO stemi_activations (
        patient_id, ekg_pattern_type, culprit_vessel_presumed,
        ed_arrival_time, cath_lab_activation_time, vascular_access_site,
        activation_status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'active_code')
      RETURNING *`,
      [
        patientId,
        data.ekgPattern.patternType,
        ekgEval.culpritVessel,
        data.edArrivalTime,
        data.cathLabActivationTime,
        data.vascularAccessSite || 'Right_Radial'
      ]
    );

    return {
      activation: res.rows[0],
      ekgAnalysis: ekgEval
    };
  }

  /**
   * Logs wire cross / balloon inflation and records Door-to-Balloon metrics.
   */
  static async logBalloonInflation(activationId: number, balloonTime: string | Date) {
    const actRes = await query('SELECT * FROM stemi_activations WHERE id = $1', [activationId]);
    if (actRes.rows.length === 0) throw new Error(`STEMI Activation #${activationId} not found`);
    const act = actRes.rows[0];

    const d2b = this.calculateDoorToBalloon(act.ed_arrival_time, balloonTime);

    const res = await query(
      `UPDATE stemi_activations
       SET balloon_inflation_time = $1,
           door_to_balloon_minutes = $2,
           d2b_target_met = $3,
           activation_status = 'reperfusion_achieved'
       WHERE id = $4
       RETURNING *`,
      [balloonTime, d2b.d2bMinutes, d2b.targetMet, activationId]
    );

    return {
      activation: res.rows[0],
      d2bMetrics: d2b
    };
  }

  /**
   * Records a PCI procedure log (lesion, stent, TIMI flow, ACT).
   */
  static async recordPciProcedure(activationId: number, data: PciLogInput) {
    const res = await query(
      `INSERT INTO pci_procedure_logs (
        stemi_activation_id, lesion_location, pre_pci_timi_flow,
        post_pci_timi_flow, stent_type, stent_diameter_mm,
        stent_length_mm, anticoagulant_agent, peak_act_seconds
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        activationId,
        data.lesionLocation,
        data.prePciTimiFlow,
        data.postPciTimiFlow,
        data.stentType,
        data.stentDiameterMm,
        data.stentLengthMm,
        data.anticoagulantAgent,
        data.peakActSeconds
      ]
    );

    return res.rows[0];
  }

  /**
   * Calculates CIN risk and stores contrast volume and hydration target in DB.
   */
  static async updateCinRisk(activationId: number, params: CinParams) {
    const cin = this.calculateMehranCinRisk(params);

    const res = await query(
      `UPDATE stemi_activations
       SET contrast_volume_ml = $1,
           mehran_cin_risk_score = $2,
           hydration_target_ml_per_hr = $3
       WHERE id = $4
       RETURNING *`,
      [params.contrastVolumeMl, cin.riskScore, cin.hydrationTargetMlPerHr, activationId]
    );

    return {
      updatedActivation: res.rows[0],
      cinAnalysis: cin
    };
  }

  /**
   * Updates arteriotomy closure device and strict flat bed rest countdown.
   */
  static async updateClosureAndBedRest(activationId: number, data: {
    closureDeviceUsed: string; // 'Angio-Seal' | 'Perclose' | 'Mynx' | 'Manual_Compression'
    closureTime: string | Date;
  }) {
    // Bed rest: 2.0h for radial or closure device, 6.0h for manual femoral compression
    let bedRestDurationHours = 2.0;
    if (data.closureDeviceUsed === 'Manual_Compression') {
      bedRestDurationHours = 6.0;
    }

    const res = await query(
      `UPDATE stemi_activations
       SET closure_device_used = $1,
           closure_time = $2,
           bed_rest_duration_hours = $3
       WHERE id = $4
       RETURNING *`,
      [data.closureDeviceUsed, data.closureTime, bedRestDurationHours, activationId]
    );

    return res.rows[0];
  }

  /**
   * Lists STEMI activations.
   */
  static async getStemiActivations(patientId?: number) {
    let sql = 'SELECT * FROM stemi_activations';
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
