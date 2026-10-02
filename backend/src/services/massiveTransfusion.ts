import { query } from '../db';

export interface AbcParams {
  penetratingMechanism: boolean; // 1 pt
  systolicBp: number; // <= 90 mmHg -> 1 pt
  heartRate: number; // >= 120 bpm -> 1 pt
  fastPositive: boolean; // 1 pt
  temperatureCelsius: number;
}

export interface TegMetrics {
  rTimeMin: number; // normal 5 - 10 min
  kTimeMin: number; // normal 1 - 3 min
  alphaAngleDeg: number; // normal 53 - 72 deg
  maximumAmplitudeMm: number; // normal 50 - 70 mm
  ly30Percent: number; // normal < 3%
  ionizedCalciumMmolL: number; // normal 1.15 - 1.33 mmol/L
}

export interface BloodUnitInput {
  bloodUnitBarcode: string;
  componentType: 'PRBC' | 'FFP' | 'Platelets' | 'Cryoprecipitate';
  bloodGroupRh: string; // e.g. 'O_NEG', 'O_POS', 'A_POS'
  isUncrossed: boolean;
  rapidInfuserUsed?: boolean;
  bloodWarmerVerified?: boolean;
}

export class MassiveTransfusionService {
  /**
   * Evaluates ABC Score (0-4) and Shock Index (HR / SBP).
   * ABC Score >= 2 strongly predicts requirement for massive transfusion (>= 10 units in 24h).
   */
  static evaluateMtpActivation(params: AbcParams): {
    abcScore: number;
    shockIndex: number;
    mtpIndicated: boolean;
    urgencyTier: 'CRITICAL_MTP' | 'ELEVATED_WATCH' | 'STANDARD_TRAUMA';
    rationale: string;
  } {
    let abcScore = 0;
    if (params.penetratingMechanism) abcScore += 1;
    if (params.systolicBp <= 90) abcScore += 1;
    if (params.heartRate >= 120) abcScore += 1;
    if (params.fastPositive) abcScore += 1;

    const sbp = Math.max(1, params.systolicBp);
    const shockIndex = Number((params.heartRate / sbp).toFixed(2));

    const mtpIndicated = abcScore >= 2 || shockIndex >= 1.0;

    let urgencyTier: 'CRITICAL_MTP' | 'ELEVATED_WATCH' | 'STANDARD_TRAUMA';
    if (abcScore >= 2 && shockIndex >= 1.3) urgencyTier = 'CRITICAL_MTP';
    else if (mtpIndicated) urgencyTier = 'ELEVATED_WATCH';
    else urgencyTier = 'STANDARD_TRAUMA';

    let rationale = '';
    if (mtpIndicated) {
      rationale = `MTP Activation Mandated: ABC Score = ${abcScore}/4, Shock Index = ${shockIndex}. Rapid 1:1:1 balanced blood component delivery and fluid warmers indicated.`;
    } else {
      rationale = `MTP Not Triggered: ABC Score = ${abcScore}/4, Shock Index = ${shockIndex}. Continue controlled volume resuscitation with type & crossmatch.`;
    }

    return {
      abcScore,
      shockIndex,
      mtpIndicated,
      urgencyTier,
      rationale
    };
  }

  /**
   * Evaluates current PRBC : FFP : Platelet ratio targeting 1:1:1.
   * Warns of dilutional coagulopathy if FFP or Platelets lag behind PRBCs.
   */
  static calculateResuscitationRatio(prbc: number, ffp: number, platelets: number): {
    ratioString: string;
    isBalanced: boolean;
    dilutionalCoagulopathyRisk: boolean;
    thrombocytopeniaRisk: boolean;
    feedback: string;
  } {
    const ratioString = `${prbc}:${ffp}:${platelets}`;
    if (prbc === 0) {
      return {
        ratioString,
        isBalanced: true,
        dilutionalCoagulopathyRisk: false,
        thrombocytopeniaRisk: false,
        feedback: 'No blood units transfused yet.'
      };
    }

    const ffpRatio = ffp / prbc;
    const pltRatio = platelets / prbc;

    const dilutionalCoagulopathyRisk = prbc >= 4 && ffpRatio < 0.6;
    const thrombocytopeniaRisk = prbc >= 4 && pltRatio < 0.6;
    const isBalanced = ffpRatio >= 0.75 && pltRatio >= 0.75;

    let feedback = '1:1:1 balanced hemostatic resuscitation maintained.';
    if (dilutionalCoagulopathyRisk && thrombocytopeniaRisk) {
      feedback = 'CRITICAL: Severe dilutional coagulopathy & thrombocytopenia risk. Transfuse urgent FFP and Platelets now.';
    } else if (dilutionalCoagulopathyRisk) {
      feedback = 'WARNING: FFP transfusion lagging behind PRBCs. Increase plasma infusion to preserve factor concentrations.';
    } else if (thrombocytopeniaRisk) {
      feedback = 'WARNING: Platelet transfusion lagging. Infuse apheresis platelets to prevent microvascular bleeding.';
    }

    return {
      ratioString,
      isBalanced,
      dilutionalCoagulopathyRisk,
      thrombocytopeniaRisk,
      feedback
    };
  }

  /**
   * Interprets Thromboelastography (TEG) parameters to guide targeted hemostatic factor replacement.
   */
  static interpretTeg(metrics: TegMetrics): {
    coagulopathyClassification: string;
    recommendations: string[];
    txaIndicated: boolean;
    cryoPacksRecommended: number;
    ffpUnitsRecommended: number;
    plateletUnitsRecommended: number;
  } {
    const recommendations: string[] = [];
    let ffpUnitsRecommended = 0;
    let cryoPacksRecommended = 0;
    let plateletUnitsRecommended = 0;
    let txaIndicated = false;

    // R-Time: Factor deficiency
    if (metrics.rTimeMin > 10.0) {
      ffpUnitsRecommended = 2;
      recommendations.push(`Prolonged R-Time (${metrics.rTimeMin} min > 10 min): Enzymatic clotting factor deficiency. Administer 2-4 units FFP or 4-factor PCC.`);
    }

    // K-Time and Alpha Angle: Fibrinogen deficiency
    if (metrics.kTimeMin > 3.0 || metrics.alphaAngleDeg < 53.0) {
      cryoPacksRecommended = 10;
      recommendations.push(`Depressed Alpha Angle (${metrics.alphaAngleDeg}° < 53°) / Prolonged K-Time: Fibrinogen deficiency. Administer 10 units Cryoprecipitate or Fibrinogen Concentrate.`);
    }

    // Maximum Amplitude (MA): Platelet function / count
    if (metrics.maximumAmplitudeMm < 50.0) {
      plateletUnitsRecommended = 1;
      recommendations.push(`Reduced Maximum Amplitude (${metrics.maximumAmplitudeMm} mm < 50 mm): Severe platelet hypofunction/thrombocytopenia. Transfuse 1 apheresis platelet unit.`);
    }

    // LY30: Hyperfibrinolysis
    if (metrics.ly30Percent > 3.0) {
      txaIndicated = true;
      recommendations.push(`Elevated LY30 (${metrics.ly30Percent}% > 3.0%): Accelerated systemic hyperfibrinolysis. Administer Tranexamic Acid (TXA) 1g IV bolus over 10 min + 1g over 8 hours.`);
    }

    // Hypocalcemia
    if (metrics.ionizedCalciumMmolL < 1.12) {
      recommendations.push(`Hypocalcemia (Ionized Ca²+ ${metrics.ionizedCalciumMmolL} mmol/L < 1.15): Citrate toxicity. Administer Calcium Chloride 1g IV.`);
    }

    if (recommendations.length === 0) {
      recommendations.push('TEG clot formation and stability parameters within normal physiological limits.');
    }

    let coagulopathyClassification = 'Normal Clot Kinetics';
    if (txaIndicated) coagulopathyClassification = 'Hyperfibrinolysis Syndrome';
    else if (cryoPacksRecommended > 0 && ffpUnitsRecommended > 0) coagulopathyClassification = 'Severe Multi-Factor Coagulopathy';
    else if (plateletUnitsRecommended > 0) coagulopathyClassification = 'Thrombocytopenic Coagulopathy';
    else if (ffpUnitsRecommended > 0) coagulopathyClassification = 'Enzymatic Factor Depletion';

    return {
      coagulopathyClassification,
      recommendations,
      txaIndicated,
      cryoPacksRecommended,
      ffpUnitsRecommended,
      plateletUnitsRecommended
    };
  }

  /**
   * Assesses citrate accumulation risk and required Calcium Chloride repletion.
   * Standard: 1g Calcium Chloride IV for every 4 units of blood products.
   */
  static evaluateCitrateRisk(prbcTransfused: number, ffpTransfused: number, calciumRepletedGrams: number): {
    totalCitrateUnits: number;
    recommendedCalciumGrams: number;
    calciumDeficitGrams: number;
    repletionRequired: boolean;
    guideline: string;
  } {
    const totalCitrateUnits = prbcTransfused + ffpTransfused;
    // 1g CaCl2 per 4 blood units
    const recommendedCalciumGrams = Number((totalCitrateUnits / 4.0).toFixed(1));
    const calciumDeficitGrams = Math.max(0, Number((recommendedCalciumGrams - calciumRepletedGrams).toFixed(1)));
    const repletionRequired = calciumDeficitGrams >= 1.0;

    let guideline = 'Serum calcium repletion on schedule.';
    if (repletionRequired) {
      guideline = `ALERT: High risk of citrate toxicity & myocardial depression. Administer ${calciumDeficitGrams}g Calcium Chloride IV via central or large-bore peripheral line immediately.`;
    }

    return {
      totalCitrateUnits,
      recommendedCalciumGrams,
      calciumDeficitGrams,
      repletionRequired,
      guideline
    };
  }

  /**
   * Activates Massive Transfusion Protocol in DB.
   */
  static async activateMtp(patientId: number, data: {
    activationTrigger: string;
    penetratingMechanism: boolean;
    systolicBp: number;
    heartRate: number;
    fastPositive: boolean;
    temperatureCelsius: number;
    txaAdministered?: boolean;
  }) {
    const evalResult = this.evaluateMtpActivation({
      penetratingMechanism: data.penetratingMechanism,
      systolicBp: data.systolicBp,
      heartRate: data.heartRate,
      fastPositive: data.fastPositive,
      temperatureCelsius: data.temperatureCelsius
    });

    const res = await query(
      `INSERT INTO mtp_activations (
        patient_id, activation_trigger, abc_score, shock_index,
        temperature_celsius, txa_administered, mtp_status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'active_transfusion')
      RETURNING *`,
      [
        patientId,
        data.activationTrigger,
        evalResult.abcScore,
        evalResult.shockIndex,
        data.temperatureCelsius,
        data.txaAdministered || false
      ]
    );

    return {
      mtp: res.rows[0],
      activationEvaluation: evalResult
    };
  }

  /**
   * Logs an infused blood unit, updating unit tallies and 1:1:1 ratio.
   */
  static async logBloodUnitTransfusion(activationId: number, unitData: BloodUnitInput) {
    const mtpRes = await query('SELECT * FROM mtp_activations WHERE id = $1', [activationId]);
    if (mtpRes.rows.length === 0) throw new Error(`MTP Activation #${activationId} not found`);
    const mtp = mtpRes.rows[0];

    // Log the unit
    const unitRes = await query(
      `INSERT INTO blood_component_transfusions (
        mtp_activation_id, blood_unit_barcode, component_type,
        blood_group_rh, is_uncrossmatched, rapid_infuser_used, blood_warmer_verified
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        activationId,
        unitData.bloodUnitBarcode,
        unitData.componentType,
        unitData.bloodGroupRh,
        unitData.isUncrossed,
        unitData.rapidInfuserUsed ?? true,
        unitData.bloodWarmerVerified ?? true
      ]
    );

    // Increment tallies
    let prbc = mtp.prbc_units_transfused;
    let ffp = mtp.ffp_units_transfused;
    let plt = mtp.platelet_units_transfused;
    let cryo = mtp.cryo_units_transfused;

    if (unitData.componentType === 'PRBC') prbc += 1;
    else if (unitData.componentType === 'FFP') ffp += 1;
    else if (unitData.componentType === 'Platelets') plt += 1;
    else if (unitData.componentType === 'Cryoprecipitate') cryo += 1;

    const ratioAnalysis = this.calculateResuscitationRatio(prbc, ffp, plt);

    const updatedMtp = await query(
      `UPDATE mtp_activations
       SET prbc_units_transfused = $1,
           ffp_units_transfused = $2,
           platelet_units_transfused = $3,
           cryo_units_transfused = $4,
           current_ratio = $5
       WHERE id = $6
       RETURNING *`,
      [prbc, ffp, plt, cryo, ratioAnalysis.ratioString, activationId]
    );

    const citrateAnalysis = this.evaluateCitrateRisk(prbc, ffp, Number(mtp.calcium_repleted_grams));

    return {
      transfusion: unitRes.rows[0],
      updatedMtp: updatedMtp.rows[0],
      ratioAnalysis,
      citrateAnalysis
    };
  }

  /**
   * Records a TEG viscoelastic assay and stores targeted recommendations.
   */
  static async recordTegAnalysis(activationId: number, tegData: TegMetrics) {
    const analysis = this.interpretTeg(tegData);

    const res = await query(
      `INSERT INTO viscoelastic_teg_records (
        mtp_activation_id, r_time_min, k_time_min, alpha_angle_deg,
        maximum_amplitude_mm, ly30_percent, ionized_calcium_mmol_l,
        targeted_therapy_recommendation
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        activationId,
        tegData.rTimeMin,
        tegData.kTimeMin,
        tegData.alphaAngleDeg,
        tegData.maximumAmplitudeMm,
        tegData.ly30Percent,
        tegData.ionizedCalciumMmolL,
        JSON.stringify(analysis.recommendations)
      ]
    );

    return {
      record: res.rows[0],
      analysis
    };
  }

  /**
   * Records Calcium Chloride repletion.
   */
  static async repleteCalcium(activationId: number, grams: number) {
    const res = await query(
      `UPDATE mtp_activations
       SET calcium_repleted_grams = calcium_repleted_grams + $1
       WHERE id = $2
       RETURNING *`,
      [grams, activationId]
    );
    return res.rows[0];
  }

  /**
   * De-escalates or controls MTP activation.
   */
  static async deescalateMtp(activationId: number, status: 'controlled' | 'de_escalated' | 'deceased') {
    const res = await query(
      `UPDATE mtp_activations
       SET mtp_status = $1, deactivated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, activationId]
    );
    return res.rows[0];
  }

  /**
   * Lists MTP activations with optional patient filter.
   */
  static async getMtpActivations(patientId?: number) {
    let sql = 'SELECT * FROM mtp_activations';
    const params: any[] = [];
    if (patientId) {
      sql += ' WHERE patient_id = $1';
      params.push(patientId);
    }
    sql += ' ORDER BY activated_at DESC';
    const res = await query(sql, params);
    return res.rows;
  }
}
