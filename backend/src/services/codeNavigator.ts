import { pool } from '../db';

export interface CodeEvaluationInput {
  current_rhythm: 'VF' | 'PVT' | 'PEA' | 'ASYSTOLE';
  cycle_number: number; // 1, 2, 3...
  time_in_code_seconds: number;
  etco2_mmhg: number;
  compression_fraction_percent: number; // Target >= 80%
  epinephrine_doses_given: number;
  last_epinephrine_cycle?: number;
  amiodarone_mg_given: number;
  lidocaine_mg_given: number;
  h_and_t_findings?: {
    hypovolemia?: boolean;
    hypoxia?: boolean;
    acidosis?: boolean;
    hypokalemia?: boolean;
    hyperkalemia?: boolean;
    hypothermia?: boolean;
    tension_pneumothorax?: boolean;
    cardiac_tamponade?: boolean;
    toxins?: boolean;
    pulmonary_thrombosis?: boolean;
    coronary_thrombosis?: boolean;
  };
}

export interface CodeEvaluationResult {
  rhythm_type: 'SHOCKABLE' | 'NON_SHOCKABLE';
  immediate_shock_indicated: boolean;
  shock_energy_joules?: number;
  drug_recommendation: string;
  next_drug_due_cycle?: number;
  etco2_status: 'ROSC_DETECTED' | 'ADEQUATE_CPR' | 'POOR_CPR_QUALITY';
  etco2_action: string;
  cpr_quality_alert: string;
  reversible_cause_actions: string[];
  actionable_checklist: string[];
}

export interface PostArrestCareInput {
  map_mmhg: number;
  sbp_mmhg: number;
  spo2_percent: number;
  paco2_mmhg?: number;
  core_temperature_celsius: number;
  stemi_on_12lead: boolean;
  comatose_unresponsive: boolean;
}

export interface PostArrestCareResult {
  ttm_protocol_indicated: boolean;
  target_temperature_range: string;
  hemodynamic_status: 'OPTIMAL' | 'HYPOTENSIVE_PRESSOR_REQUIRED';
  pressor_guidance: string;
  cath_lab_activation_indicated: boolean;
  ventilation_targets: string[];
  post_arrest_action_plan: string[];
}

export class CodeNavigatorService {
  /**
   * Evaluates ACLS 2025 algorithm branching, drugs, shocks, and CPR telemetry for active code
   */
  static evaluateCodeCycle(input: CodeEvaluationInput): CodeEvaluationResult {
    const isShockable = input.current_rhythm === 'VF' || input.current_rhythm === 'PVT';
    const actions: string[] = [];
    const revActions: string[] = [];

    // 1. Defibrillation guidance
    let immediateShock = false;
    let shockEnergy: number | undefined;

    if (isShockable) {
      immediateShock = true;
      shockEnergy = 200; // Biphasic standard 200 Joules (or manufacturer max)
      actions.push(`SHOCKABLE RHYTHM (${input.current_rhythm}): Deliver immediate asynchronous shock at ${shockEnergy}J biphasic. Immediately resume high-quality chest compressions for 2 minutes without pausing for rhythm re-check.`);
    } else {
      actions.push(`NON-SHOCKABLE RHYTHM (${input.current_rhythm}): DO NOT SHOCK. Immediately resume high-quality CPR for 2 minutes.`);
    }

    // 2. Pharmacology Titration (AHA ACLS 2025)
    let drugRec = 'Continue CPR; reassess rhythm at 2-minute mark.';
    let nextDueCycle: number | undefined;

    if (isShockable) {
      // Cycle 1: Shock -> CPR
      // Cycle 2: Shock -> Epinephrine 1 mg IV/IO
      // Cycle 3: Shock -> Amiodarone 300 mg IV/IO (or Lidocaine 1-1.5 mg/kg)
      // Cycle 4: Shock -> Epinephrine 1 mg IV/IO
      // Cycle 5: Shock -> Amiodarone 150 mg IV/IO (second dose)
      if (input.cycle_number >= 2 && (input.last_epinephrine_cycle === undefined || (input.cycle_number - input.last_epinephrine_cycle) >= 2)) {
        drugRec = 'Administer Epinephrine 1 mg IV/IO push (1:10,000 / 0.1 mg/mL) followed by 20 mL normal saline flush and limb elevation. Repeat every 3-5 minutes (every second cycle).';
        nextDueCycle = input.cycle_number + 2;
      } else if (input.cycle_number === 3 && input.amiodarone_mg_given < 300 && input.lidocaine_mg_given === 0) {
        drugRec = 'FIRST-LINE ANTIARRHYTHMIC: Administer Amiodarone 300 mg IV/IO bolus (or Lidocaine 1.0 - 1.5 mg/kg IV/IO if Amiodarone unavailable).';
      } else if (input.cycle_number >= 5 && input.amiodarone_mg_given === 300) {
        drugRec = 'SECOND-LINE ANTIARRHYTHMIC: Administer Amiodarone 150 mg IV/IO bolus (second dose; cumulative max 450 mg) or Lidocaine 0.5 - 0.75 mg/kg.';
      }
    } else {
      // Non-shockable (PEA/Asystole): Epinephrine ASAP, repeat q3-5m
      if (input.epinephrine_doses_given === 0 || (input.last_epinephrine_cycle !== undefined && (input.cycle_number - input.last_epinephrine_cycle) >= 2)) {
        drugRec = 'Administer Epinephrine 1 mg IV/IO STAT (1:10,000 / 0.1 mg/mL) + 20 mL NS flush. Repeat every 3-5 minutes.';
        nextDueCycle = input.cycle_number + 2;
      } else {
        drugRec = 'CPR in progress. Focus aggressively on reversible H\'s and T\'s while awaiting next Epinephrine window.';
      }
    }

    // 3. EtCO2 Evaluation
    let etco2Status: 'ROSC_DETECTED' | 'ADEQUATE_CPR' | 'POOR_CPR_QUALITY' = 'ADEQUATE_CPR';
    let etco2Action = 'EtCO2 within expected compression range (15 - 30 mmHg).';

    if (input.etco2_mmhg >= 35) {
      etco2Status = 'ROSC_DETECTED';
      etco2Action = `ROSC DETECTED (EtCO2 ${input.etco2_mmhg} mmHg >= 35 mmHg): Abrupt sustained spike in end-tidal CO2 confirms Return of Spontaneous Circulation. Pause compressions, assess central carotid pulse, and initiate post-cardiac arrest care.`;
      actions.unshift('🚨 ROSC DETECTED: Abrupt rise in EtCO2 >= 35 mmHg. Verify central pulse and blood pressure.');
    } else if (input.etco2_mmhg < 10) {
      etco2Status = 'POOR_CPR_QUALITY';
      etco2Action = `LOW EtCO2 (${input.etco2_mmhg} mmHg < 10 mmHg): Indicates sub-optimal cardiac output, compressor fatigue, or misplaced advanced airway. Rotate compressor immediately; confirm endotracheal tube depth and chest recoil.`;
      actions.push('CRITICAL CPR WARNING: Low EtCO2 indicates inadequate forward blood flow. Rotate compressor immediately.');
    }

    // 4. Chest Compression Fraction (CCF)
    let ccfAlert = `CCF: ${input.compression_fraction_percent}% (Optimal target >= 80%).`;
    if (input.compression_fraction_percent < 80) {
      ccfAlert = `WARNING: Chest Compression Fraction ${input.compression_fraction_percent}% is below the 80% AHA target. Minimize pre- and post-shock pauses to < 5 seconds.`;
    }

    // 5. Reversible Causes H's and T's
    const ht = input.h_and_t_findings || {};
    if (ht.hypovolemia) {
      revActions.push('Hypovolemia: Administer rapid IV/IO balanced crystalloids (1-2 L) or initiate Massive Transfusion Protocol if hemorrhagic.');
    }
    if (ht.hyperkalemia) {
      revActions.push('Hyperkalemia: Administer Calcium Chloride 1g (10 mL of 10%) IV push over 2 min to stabilize myocardium + Regular Insulin 10 units IV + D50W 50 mL + Sodium Bicarbonate 50 mEq.');
    }
    if (ht.acidosis) {
      revActions.push('Hydrogen Ion / Acidosis: Ensure adequate alveolar ventilation; administer Sodium Bicarbonate 50-100 mEq IV if severe preexisting metabolic acidosis.');
    }
    if (ht.tension_pneumothorax) {
      revActions.push('Tension Pneumothorax: Perform STAT needle decompression (5th ICS anterior axillary line) followed immediately by finger thoracostomy and tube thoracostomy.');
    }
    if (ht.cardiac_tamponade) {
      revActions.push('Cardiac Tamponade: Perform emergency ultrasound-guided subxiphoid pericardiocentesis with drainage catheter placement.');
    }
    if (ht.pulmonary_thrombosis) {
      revActions.push('Pulmonary Thrombosis: Consider emergency rescue thrombolytic therapy (Alteplase / tPA 50 mg IV bolus) and continue CPR for at least 30-60 minutes.');
    }
    if (ht.toxins) {
      revActions.push('Toxins: Identify specific toxidrome and administer targeted antidote (e.g. Naloxone for opioids, High-Dose Insulin for CCBs, Lipid Emulsion for local anesthetics/bupivacaine).');
    }

    return {
      rhythm_type: isShockable ? 'SHOCKABLE' : 'NON_SHOCKABLE',
      immediate_shock_indicated: immediateShock,
      shock_energy_joules: shockEnergy,
      drug_recommendation: drugRec,
      next_drug_due_cycle: nextDueCycle,
      etco2_status: etco2Status,
      etco2_action: etco2Action,
      cpr_quality_alert: ccfAlert,
      reversible_cause_actions: revActions,
      actionable_checklist: actions
    };
  }

  /**
   * Evaluates Post-Cardiac Arrest Care Bundle (TTM, Hemodynamics, Cath Lab)
   */
  static evaluatePostArrestCare(input: PostArrestCareInput): PostArrestCareResult {
    const ventTargets: string[] = [];
    const plan: string[] = [];

    // 1. Targeted Temperature Management (TTM)
    // Indicated for all comatose patients post-ROSC
    const isTtmIndicated = input.comatose_unresponsive;
    const ttmTarget = isTtmIndicated ? '32°C to 36°C constant temperature for at least 24 hours' : 'Maintain strict normothermia (avoid fever > 37.7°C)';

    if (isTtmIndicated) {
      plan.push('INITIATE TTM: Patient is comatose post-ROSC. Target 32°C - 36°C using closed-loop surface cooling or intravascular catheter. Prevent shivering with sedation and paralytics.');
    } else {
      plan.push('Maintain active normothermia. Strictly prevent and treat any pyrexia / fever > 37.7°C with antipyretics and surface cooling.');
    }

    // 2. Hemodynamics & Pressors
    let hemoStatus: 'OPTIMAL' | 'HYPOTENSIVE_PRESSOR_REQUIRED' = 'OPTIMAL';
    let pressorGuidance = 'Blood pressure within post-ROSC target (MAP >= 65 mmHg, SBP >= 90 mmHg).';

    if (input.map_mmhg < 65 || input.sbp_mmhg < 90) {
      hemoStatus = 'HYPOTENSIVE_PRESSOR_REQUIRED';
      pressorGuidance = `POST-ROSC HYPOTENSION (MAP ${input.map_mmhg} mmHg < 65 mmHg, SBP ${input.sbp_mmhg} mmHg < 90 mmHg): High risk of secondary ischemic cerebral injury. Initiate Norepinephrine (0.05 - 0.3 mcg/kg/min) or Epinephrine infusion to maintain MAP >= 65 mmHg.`;
      plan.push('Initiate vasoactive infusion (Norepinephrine first-line) to restore cerebral perfusion pressure (MAP >= 65 mmHg).');
    }

    // 3. Emergent Coronary Angiography (Cath Lab)
    const cathLabIndicated = input.stemi_on_12lead;
    if (cathLabIndicated) {
      plan.push('STAT CATH LAB ACTIVATION: 12-lead ECG confirms ST-elevation myocardial infarction (STEMI). Transport directly to cardiac catheterization suite for primary PCI.');
    } else {
      plan.push('If comatose with high suspicion of acute coronary occlusion despite non-STEMI ECG, consult interventional cardiology for emergent vs early coronary angiography.');
    }

    // 4. Ventilation & Oxygenation Targets
    ventTargets.push(`Oxygenation: Titrate FiO2 to maintain SpO2 92% - 98% (avoid hyperoxia PaO2 > 300 mmHg to limit reactive oxygen species injury).`);
    ventTargets.push(`Ventilation: Maintain normocapnia PaCO2 35 - 45 mmHg (EtCO2 35 - 40 mmHg). Strictly avoid hypocapnia which induces cerebral vasoconstriction.`);

    return {
      ttm_protocol_indicated: isTtmIndicated,
      target_temperature_range: ttmTarget,
      hemodynamic_status: hemoStatus,
      pressor_guidance: pressorGuidance,
      cath_lab_activation_indicated: cathLabIndicated,
      ventilation_targets: ventTargets,
      post_arrest_action_plan: plan
    };
  }

  /**
   * Persists a new Code Arrest Event
   */
  static async startCodeEvent(params: {
    patient_id: number;
    initial_rhythm: string;
    current_etco2_mmhg?: number;
    compression_fraction_percent?: number;
    h_and_t_checklist?: any;
  }) {
    const query = `
      INSERT INTO code_arrest_events (
        patient_id,
        initial_rhythm,
        current_rhythm,
        current_etco2_mmhg,
        compression_fraction_percent,
        h_and_t_checklist,
        code_status
      ) VALUES ($1, $2, $2, $3, $4, $5, 'ACTIVE')
      RETURNING *;
    `;
    const values = [
      params.patient_id,
      params.initial_rhythm,
      params.current_etco2_mmhg || null,
      params.compression_fraction_percent || null,
      JSON.stringify(params.h_and_t_checklist || {})
    ];
    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  /**
   * Logs a 2-Minute Code Cycle
   */
  static async logCodeCycle(params: {
    code_id: number;
    cycle_number: number;
    rhythm_assessed: string;
    shock_delivered?: boolean;
    shock_energy_joules?: number;
    drug_administered?: string;
    cycle_etco2_mmhg?: number;
    cycle_ccf_percent?: number;
    reversible_causes_addressed?: string[];
    notes?: string;
  }) {
    const query = `
      INSERT INTO code_cycle_logs (
        code_id,
        cycle_number,
        rhythm_assessed,
        shock_delivered,
        shock_energy_joules,
        drug_administered,
        cycle_etco2_mmhg,
        cycle_ccf_percent,
        reversible_causes_addressed,
        notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `;
    const values = [
      params.code_id,
      params.cycle_number,
      params.rhythm_assessed,
      Boolean(params.shock_delivered),
      params.shock_energy_joules || null,
      params.drug_administered || null,
      params.cycle_etco2_mmhg || null,
      params.cycle_ccf_percent || null,
      JSON.stringify(params.reversible_causes_addressed || []),
      params.notes || null
    ];
    const { rows } = await pool.query(query, values);

    // Update parent code_arrest_events counters
    await pool.query(`
      UPDATE code_arrest_events
      SET current_rhythm = $1,
          cycle_count = GREATEST(cycle_count, $2),
          total_shocks_delivered = total_shocks_delivered + (CASE WHEN $3 = true THEN 1 ELSE 0 END),
          current_etco2_mmhg = COALESCE($4, current_etco2_mmhg),
          compression_fraction_percent = COALESCE($5, compression_fraction_percent)
      WHERE id = $6;
    `, [
      params.rhythm_assessed,
      params.cycle_number,
      Boolean(params.shock_delivered),
      params.cycle_etco2_mmhg || null,
      params.cycle_ccf_percent || null,
      params.code_id
    ]);

    return rows[0];
  }

  /**
   * Updates Code Status (ROSC or Terminated)
   */
  static async updateCodeStatus(codeId: number, status: 'ROSC_ACHIEVED' | 'TERMINATED', roscTimestamp?: Date) {
    const query = `
      UPDATE code_arrest_events
      SET code_status = $1::varchar,
          rosc_achieved = ($1::varchar = 'ROSC_ACHIEVED'),
          rosc_timestamp = CASE WHEN $1::varchar = 'ROSC_ACHIEVED' THEN COALESCE($2, CURRENT_TIMESTAMP) ELSE NULL END
      WHERE id = $3
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [status, roscTimestamp || null, codeId]);
    return rows[0];
  }

  /**
   * Retrieves Code Events and Cycle History for a patient
   */
  static async getPatientCodeHistory(patientId: number) {
    const codeQuery = `
      SELECT * FROM code_arrest_events
      WHERE patient_id = $1
      ORDER BY code_start_time DESC
      LIMIT 10;
    `;
    const cyclesQuery = `
      SELECT ccl.* FROM code_cycle_logs ccl
      JOIN code_arrest_events cae ON ccl.code_id = cae.id
      WHERE cae.patient_id = $1
      ORDER BY ccl.logged_at DESC
      LIMIT 30;
    `;
    const [codeRes, cycleRes] = await Promise.all([
      pool.query(codeQuery, [patientId]),
      pool.query(cyclesQuery, [patientId])
    ]);
    return {
      code_events: codeRes.rows,
      cycle_logs: cycleRes.rows
    };
  }
}
