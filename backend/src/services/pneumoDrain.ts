import { pool } from '../db';

export interface TensionPneumoInput {
  hemodynamic_instability: boolean; // SBP < 90 or MAP < 65
  unilateral_absent_breath_sounds: boolean;
  tracheal_deviation: boolean;
  severe_dyspnea_cyanosis: boolean;
  anatomical_side: 'LEFT' | 'RIGHT';
  subcutaneous_emphysema?: boolean;
}

export interface TensionPneumoResult {
  tension_pneumothorax_confirmed: boolean;
  immediate_decompression_required: boolean;
  needle_decompression_location: string;
  finger_thoracostomy_protocol: string;
  definitive_chest_tube_size: string;
  critical_action_checklist: string[];
}

export interface PleuralDrainageInput {
  initial_insertion_output_ml: number;
  hourly_drainage_ml: number;
  hours_monitoring: number;
  fluid_character: 'FRANK_BLOOD' | 'SEROSANGUINOUS' | 'SEROUS' | 'PURULENT';
  air_leak_grade: 'NONE' | 'GRADE_1_COUGH' | 'GRADE_2_EXPIRATION' | 'GRADE_3_CONTINUOUS' | 'GRADE_4_BRONCHOPLEURAL';
  current_suction_cmh2o: number; // e.g. -20 cmH2O
  water_seal_trial_active: boolean;
  sbp_mmhg?: number;
}

export interface PleuralDrainageResult {
  massive_hemothorax_detected: boolean;
  emergent_thoracotomy_indicated: boolean;
  air_leak_severity: 'RESOLVED' | 'MILD_INTERMITTENT' | 'MODERATE' | 'SEVERE_CONTINUOUS' | 'BRONCHOPLEURAL_FISTULA';
  suction_vs_water_seal_recommendation: string;
  chest_tube_removal_readiness: boolean;
  clinical_action_checklist: string[];
}

export interface RibFractureFlailInput {
  fractured_ribs_count: number;
  flail_segment_present: boolean; // Paradoxical inward motion
  bilateral_fractures: boolean;
  pulmonary_contusion_present: boolean;
  patient_age: number;
  pain_score_10: number;
  respiratory_failure_intubated: boolean;
}

export interface RibFractureFlailResult {
  flail_chest_confirmed: boolean;
  thoracic_trauma_severity: 'MILD' | 'MODERATE' | 'SEVERE_HIGH_RISK';
  ssrf_surgical_stabilization_indicated: boolean;
  regional_analgesia_recommendation: string;
  pulmonary_hygiene_protocol: string[];
  clinical_management_plan: string[];
}

export class PneumoDrainService {
  /**
   * Assesses tension pneumothorax and outputs immediate needle/finger thoracostomy protocol
   */
  static evaluateTensionPneumo(input: TensionPneumoInput): TensionPneumoResult {
    const isTension = input.unilateral_absent_breath_sounds &&
      (input.hemodynamic_instability || input.tracheal_deviation || input.severe_dyspnea_cyanosis);

    const actions: string[] = [];
    const side = input.anatomical_side;

    // ATLS 10th Edition Landmark: 5th Intercostal Space, slightly anterior to the mid-axillary line
    const needleSite = `5th Intercostal Space, anterior to mid-axillary line on the ${side} side (preferred ATLS landmark, avoids thick pectoral tissue) OR 2nd Intercostal Space mid-clavicular line.`;
    const fingerProc = `Perform STAT ${side}-sided finger thoracostomy: 3-4 cm incision over 5th intercostal space, blunt dissection with Kelly clamp over superior border of rib into pleural space, followed by digital finger sweep 360° to confirm pleural entry and release tension pneumothorax.`;
    const tubeSize = '28 to 32 Fr large-bore chest tube directed posteriorly and apically for pneumothorax / basally for hemothorax.';

    if (isTension) {
      actions.push(`EMERGENCY TENSION PNEUMOTHORAX (${side}): Immediately perform needle decompression followed by finger thoracostomy. DO NOT DELAY FOR CHEST X-RAY.`);
      actions.push(`Landmark: ${needleSite}`);
      actions.push(`Convert to definitive tube thoracostomy: Insert ${tubeSize} connected to underwater seal at -20 cmH2O.`);
      actions.push('Monitor for rapid hemodynamic recovery (reversal of obstructive shock and normalization of blood pressure).');
    } else {
      actions.push(`Tension physiology not currently present on ${side}. Obtain urgent bedside chest radiograph or thoracic ultrasound (eFAST) to quantify pneumothorax.`);
    }

    return {
      tension_pneumothorax_confirmed: isTension,
      immediate_decompression_required: isTension,
      needle_decompression_location: needleSite,
      finger_thoracostomy_protocol: fingerProc,
      definitive_chest_tube_size: tubeSize,
      critical_action_checklist: actions
    };
  }

  /**
   * Evaluates chest tube drainage output, massive hemothorax, emergent OR thoracotomy triggers, and air leaks
   */
  static evaluatePleuralDrainage(input: PleuralDrainageInput): PleuralDrainageResult {
    const actions: string[] = [];

    // 1. Massive Hemothorax & Thoracotomy Triggers
    // Criteria A: Immediate initial blood return >= 1500 mL
    // Criteria B: Persistent bleeding > 200 mL/hr for 2 to 4 consecutive hours
    const isInitialMassive = input.fluid_character === 'FRANK_BLOOD' && input.initial_insertion_output_ml >= 1500;
    const isPersistentMassive = input.fluid_character === 'FRANK_BLOOD' && input.hourly_drainage_ml >= 200 && input.hours_monitoring >= 2;

    const isEmergentThoracotomy = isInitialMassive || isPersistentMassive;
    const isMassiveHemo = isInitialMassive || (input.fluid_character === 'FRANK_BLOOD' && input.initial_insertion_output_ml >= 1000);

    if (isEmergentThoracotomy) {
      actions.push('🚨 STAT OPERATING ROOM THORACOTOMY INDICATED: Massive hemothorax meeting surgical threshold (>1500 mL initial OR >200 mL/hr for >=2 hours).');
      actions.push('Immediately consult Cardiothoracic / Trauma Surgery for emergent anterolateral or posterolateral thoracotomy.');
      actions.push('Activate Massive Transfusion Protocol (MTP 1:1:1 PRBC/FFP/Platelets).');
      actions.push('Attach autotransfusion collection canister (Cell Saver) to chest drainage unit for re-infusion of shed pleural blood.');
    } else if (input.fluid_character === 'FRANK_BLOOD' && input.hourly_drainage_ml > 100) {
      actions.push(`Active hemothorax: Drainage ${input.hourly_drainage_ml} mL/hr. Monitor hourly output closely. Prepare operating suite if output exceeds 200 mL/hr.`);
    }

    // 2. Air Leak Severity & Classification
    let airLeakSeverity: 'RESOLVED' | 'MILD_INTERMITTENT' | 'MODERATE' | 'SEVERE_CONTINUOUS' | 'BRONCHOPLEURAL_FISTULA' = 'RESOLVED';
    if (input.air_leak_grade === 'GRADE_4_BRONCHOPLEURAL') {
      airLeakSeverity = 'BRONCHOPLEURAL_FISTULA';
      actions.push('GRADE 4 AIR LEAK: Continuous high-volume bubbling indicates bronchopleural fistula or major tracheobronchial rupture. Urgent bronchoscopy indicated.');
    } else if (input.air_leak_grade === 'GRADE_3_CONTINUOUS') {
      airLeakSeverity = 'SEVERE_CONTINUOUS';
      actions.push('Grade 3 continuous air leak during inspiration and expiration. Maintain active suction at -20 cmH2O.');
    } else if (input.air_leak_grade === 'GRADE_2_EXPIRATION') {
      airLeakSeverity = 'MODERATE';
      actions.push('Grade 2 air leak on normal expiration. Lung parenchyma healing in progress.');
    } else if (input.air_leak_grade === 'GRADE_1_COUGH') {
      airLeakSeverity = 'MILD_INTERMITTENT';
      actions.push('Grade 1 intermittent air leak on forced cough only. Minor residual parenchymal leak.');
    } else {
      airLeakSeverity = 'RESOLVED';
      actions.push('No air leak detected in water-seal chamber.');
    }

    // 3. Suction vs Water Seal & Removal Readiness
    let suctionRec = 'Maintain active suction at -20 cmH2O while active air leak or high fluid output persists.';
    let removalReady = false;

    const isFluidLow = input.hourly_drainage_ml < 10 && input.fluid_character !== 'FRANK_BLOOD';
    const isNoAirLeak = input.air_leak_grade === 'NONE';

    if (isNoAirLeak && isFluidLow) {
      if (input.water_seal_trial_active) {
        removalReady = true;
        suctionRec = 'Water-seal trial completed without air leak recurrence or fluid re-accumulation. Chest tube is READY FOR REMOVAL.';
        actions.push('Tube removal protocol: Obtain post-water seal expiratory chest radiograph to confirm complete lung expansion. Remove tube at end-expiration or peak inspiration with petrolatum gauze occlusive dressing.');
      } else {
        suctionRec = 'No air leak and low drainage output (< 150 mL/24h). Discontinue suction and transition to WATER-SEAL TRIAL (gravity drainage) for 12 - 24 hours.';
        actions.push('Initiate water-seal trial for 12-24 hours prior to removal; assess for delayed pneumothorax re-accumulation.');
      }
    } else if (input.air_leak_grade !== 'NONE') {
      suctionRec = 'Active air leak present. DO NOT TRANSITION TO WATER SEAL OR CLAMP TUBE. Maintain continuous negative suction (-20 cmH2O).';
    }

    return {
      massive_hemothorax_detected: isMassiveHemo,
      emergent_thoracotomy_indicated: isEmergentThoracotomy,
      air_leak_severity: airLeakSeverity,
      suction_vs_water_seal_recommendation: suctionRec,
      chest_tube_removal_readiness: removalReady,
      clinical_action_checklist: actions
    };
  }

  /**
   * Evaluates Flail Chest, Severe Rib Fractures, and Surgical Stabilization (SSRF)
   */
  static evaluateRibFractures(input: RibFractureFlailInput): RibFractureFlailResult {
    const isFlail = input.flail_segment_present || (input.fractured_ribs_count >= 6 && input.bilateral_fractures);
    const actions: string[] = [];
    const hygiene: string[] = [];

    // Severity Staging
    let severity: 'MILD' | 'MODERATE' | 'SEVERE_HIGH_RISK' = 'MILD';
    if (isFlail || input.fractured_ribs_count >= 5 || input.pulmonary_contusion_present || input.patient_age >= 65) {
      severity = 'SEVERE_HIGH_RISK';
    } else if (input.fractured_ribs_count >= 3) {
      severity = 'MODERATE';
    }

    // Surgical Stabilization of Rib Fractures (SSRF) Indication
    // Indicated for flail chest with respiratory failure/inability to wean, >= 3 displaced rib fractures, or severe chest deformity
    let ssrfIndicated = false;
    if (isFlail && (input.respiratory_failure_intubated || input.pulmonary_contusion_present)) {
      ssrfIndicated = true;
      actions.push('SURGICAL STABILIZATION OF RIB FRACTURES (SSRF) INDICATED: Flail chest with respiratory compromise / ventilator dependence. Early surgical plating (< 72h) significantly shortens ICU stay and ventilator days.');
    } else if (input.fractured_ribs_count >= 4 && input.pain_score_10 >= 7) {
      actions.push('Consider SSRF evaluation for multiple displaced fractures with refractory severe pain despite regional blocks.');
    }

    // Regional Analgesia Strategy
    let analgesia = 'Multimodal oral/IV non-opioid analgesia (Acetaminophen, NSAIDs if no bleeding, Lidocaine patches).';
    if (input.pain_score_10 >= 6 || input.fractured_ribs_count >= 3) {
      analgesia = 'REGIONAL ANALGESIA: Place continuous Erector Spinae Plane (ESP) catheter or Serratus Anterior Plane (SAP) block (0.2% Ropivacaine). Superior to thoracic epidural in trauma with spine clearance or anticoagulation issues.';
      actions.push('Consult Acute Pain Service for ESP / SAP regional block catheter to preserve deep breathing and cough.');
    }

    // Pulmonary Hygiene Protocol
    hygiene.push('Incentive Spirometry: Minimum 10 breaths every hour while awake; target > 15 mL/kg inspiratory volume.');
    hygiene.push('Aggressive chest physiotherapy, early mobilization, and positive expiratory pressure (PEP) valve.');
    hygiene.push('Avoid heavy opioid sedation that suppresses respiratory drive and cough reflex (leading to atelectasis and pneumonia).');

    return {
      flail_chest_confirmed: isFlail,
      thoracic_trauma_severity: severity,
      ssrf_surgical_stabilization_indicated: ssrfIndicated,
      regional_analgesia_recommendation: analgesia,
      pulmonary_hygiene_protocol: hygiene,
      clinical_management_plan: actions
    };
  }

  /**
   * Persists a Thoracic Drainage Tube insertion
   */
  static async insertThoracicTube(params: {
    patient_id: number;
    anatomical_side: string;
    tube_size_fr: number;
    indication: string;
    initial_output_ml: number;
    current_suction_cmh2o?: number;
    water_seal_trial_active?: boolean;
    active_status?: boolean;
  }) {
    const query = `
      INSERT INTO thoracic_drainage_tubes (
        patient_id,
        anatomical_side,
        tube_size_fr,
        indication,
        initial_output_ml,
        current_suction_cmh2o,
        water_seal_trial_active,
        active_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const values = [
      params.patient_id,
      params.anatomical_side,
      params.tube_size_fr,
      params.indication,
      params.initial_output_ml,
      params.current_suction_cmh2o !== undefined ? params.current_suction_cmh2o : -20,
      params.water_seal_trial_active !== undefined ? params.water_seal_trial_active : false,
      params.active_status !== undefined ? params.active_status : true
    ];
    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  /**
   * Logs Pleural Fluid Drainage
   */
  static async logPleuralDrainage(params: {
    tube_id: number;
    patient_id: number;
    hourly_output_ml: number;
    cumulative_24h_output_ml: number;
    fluid_character: string;
    air_leak_grade: string;
    massive_hemothorax_alert?: boolean;
    emergent_thoracotomy_indicated?: boolean;
  }) {
    const query = `
      INSERT INTO pleural_fluid_drainage_logs (
        tube_id,
        patient_id,
        hourly_output_ml,
        cumulative_24h_output_ml,
        fluid_character,
        air_leak_grade,
        massive_hemothorax_alert,
        emergent_thoracotomy_indicated
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const values = [
      params.tube_id,
      params.patient_id,
      params.hourly_output_ml,
      params.cumulative_24h_output_ml,
      params.fluid_character,
      params.air_leak_grade,
      Boolean(params.massive_hemothorax_alert),
      Boolean(params.emergent_thoracotomy_indicated)
    ];
    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  /**
   * Updates Chest Tube Suction / Water Seal status
   */
  static async updateTubeSuctionStatus(tubeId: number, suctionCmh2o: number, waterSealTrial: boolean) {
    const query = `
      UPDATE thoracic_drainage_tubes
      SET current_suction_cmh2o = $1,
          water_seal_trial_active = $2
      WHERE id = $3
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [suctionCmh2o, waterSealTrial, tubeId]);
    return rows[0];
  }

  /**
   * Retrieves Thoracic Tubes and Drainage Logs for a patient
   */
  static async getPatientThoracicHistory(patientId: number) {
    const tubesQuery = `
      SELECT * FROM thoracic_drainage_tubes
      WHERE patient_id = $1
      ORDER BY insertion_timestamp DESC
      LIMIT 10;
    `;
    const logsQuery = `
      SELECT pfdl.*, tdt.anatomical_side, tdt.tube_size_fr FROM pleural_fluid_drainage_logs pfdl
      JOIN thoracic_drainage_tubes tdt ON pfdl.tube_id = tdt.id
      WHERE pfdl.patient_id = $1
      ORDER BY pfdl.logged_at DESC
      LIMIT 30;
    `;
    const [tubeRes, logRes] = await Promise.all([
      pool.query(tubesQuery, [patientId]),
      pool.query(logsQuery, [patientId])
    ]);
    return {
      tubes: tubeRes.rows,
      drainage_logs: logRes.rows
    };
  }
}
