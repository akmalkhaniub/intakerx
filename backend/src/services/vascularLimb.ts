import { pool } from '../db';

export type RutherfordCategory = 'I' | 'IIa' | 'IIb' | 'III';
export type SensoryLoss = 'none' | 'minimal_toes' | 'rest_pain_forefoot' | 'profound_anesthetic';
export type MotorDeficit = 'none' | 'mild_toe_weakness' | 'paralysis_rigor';
export type FlapColor = 'pink' | 'pale' | 'cyanotic_mottled' | 'violaceous_purple';

export interface RutherfordAssessmentInput {
  limb_affected: string;
  sensory_loss: SensoryLoss;
  motor_deficit: MotorDeficit;
  arterial_doppler_audible: boolean;
  venous_doppler_audible: boolean;
  active_bleeding_within_10_days?: boolean;
  cva_or_head_trauma_within_3_months?: boolean;
  intracranial_neoplasm?: boolean;
  systolic_bp?: number;
  diastolic_bp?: number;
}

export interface RutherfordAssessmentResult {
  category: RutherfordCategory;
  category_name: string;
  limb_viability: 'VIABLE' | 'MARGINALLY_THREATENED' | 'IMMEDIATELY_THREATENED' | 'IRREVERSIBLE';
  urgency: 'ELECTIVE_URGENT' | 'URGENT_HOURS' | 'EMERGENT_STAT' | 'PALLIATIVE_AMPUTATION';
  recommended_intervention: string;
  thrombolysis_eligible: boolean;
  contraindications: string[];
  clinical_pearls: string[];
}

export interface CompartmentPressureInput {
  compartment_name: 'anterior' | 'lateral' | 'superficial_posterior' | 'deep_posterior' | 'volar' | 'dorsal';
  measured_pressure_mmhg: number;
  diastolic_bp_mmhg: number;
}

export interface CompartmentPressureResult {
  compartment_name: string;
  measured_pressure_mmhg: number;
  diastolic_bp_mmhg: number;
  delta_p_mmhg: number;
  fasciotomy_indicated: boolean;
  alert_level: 'NORMAL' | 'BORDERLINE_OBSERVE' | 'CRITICAL_FASCIOTOMY_REQUIRED';
  surgical_directive: string;
  rehabilitation_and_rhabdo_prevention: string[];
}

export interface FreeFlapMonitoringInput {
  sto2_percent: number;
  laser_doppler_flux_pu: number;
  flap_color: FlapColor;
  capillary_refill_seconds: number;
  temp_difference_celsius: number;
  pinprick_bleeding: 'normal_bright_red' | 'absent_no_bleeding' | 'brisk_dark_purple';
}

export interface FreeFlapMonitoringResult {
  perfusion_status: 'HEALTHY' | 'ARTERIAL_OCCLUSION' | 'VENOUS_CONGESTION' | 'INDETERMINATE_OBSERVE';
  salvage_urgency: 'STABLE' | 'STAT_OR_EXPLORATION' | 'EMERGENT_SUTURE_RELEASE_LEECH';
  clinical_diagnosis: string;
  actions: string[];
}

/**
 * Evaluates Rutherford Acute Limb Ischemia (ALI) classification.
 */
export function evaluateRutherfordClassification(input: RutherfordAssessmentInput): RutherfordAssessmentResult {
  let category: RutherfordCategory = 'I';
  let categoryName = 'Category I: Viable';
  let viability: 'VIABLE' | 'MARGINALLY_THREATENED' | 'IMMEDIATELY_THREATENED' | 'IRREVERSIBLE' = 'VIABLE';
  let urgency: 'ELECTIVE_URGENT' | 'URGENT_HOURS' | 'EMERGENT_STAT' | 'PALLIATIVE_AMPUTATION' = 'ELECTIVE_URGENT';
  let recommendedIntervention = 'Urgent vascular imaging (CTA/Duplex) and planned revascularization.';

  const contraindications: string[] = [];
  if (input.active_bleeding_within_10_days) {
    contraindications.push('Active internal bleeding within 10 days');
  }
  if (input.cva_or_head_trauma_within_3_months) {
    contraindications.push('CVA or head trauma within 3 months');
  }
  if (input.intracranial_neoplasm) {
    contraindications.push('Known intracranial neoplasm / vascular malformation');
  }
  if (input.systolic_bp && input.systolic_bp > 180) {
    contraindications.push(`Severe uncontrolled systolic hypertension (${input.systolic_bp} mmHg)`);
  }

  // Classification logic based on SVS / TASC II guidelines
  if (input.motor_deficit === 'paralysis_rigor' || input.sensory_loss === 'profound_anesthetic') {
    if (!input.arterial_doppler_audible && !input.venous_doppler_audible) {
      category = 'III';
      categoryName = 'Category III: Irreversible';
      viability = 'IRREVERSIBLE';
      urgency = 'PALLIATIVE_AMPUTATION';
      recommendedIntervention = 'Primary amputation or conservative management. Avoid acute revascularization without dialysis preparation due to reperfusion hyperkalemia and toxic myoglobin wash-in.';
    } else {
      category = 'IIb';
      categoryName = 'Category IIb: Immediately Threatened';
      viability = 'IMMEDIATELY_THREATENED';
      urgency = 'EMERGENT_STAT';
      recommendedIntervention = 'STAT Surgical Thromboembolectomy (Fogarty catheter) or emergent hybrid surgical revascularization within 4-6 hours.';
    }
  } else if (input.sensory_loss === 'rest_pain_forefoot' || input.motor_deficit === 'mild_toe_weakness') {
    category = 'IIb';
    categoryName = 'Category IIb: Immediately Threatened';
    viability = 'IMMEDIATELY_THREATENED';
    urgency = 'EMERGENT_STAT';
    recommendedIntervention = 'STAT Surgical Thromboembolectomy (Fogarty catheter) or emergent bypass revascularization within 4-6 hours.';
  } else if (input.sensory_loss === 'minimal_toes' || !input.arterial_doppler_audible) {
    category = 'IIa';
    categoryName = 'Category IIa: Marginally Threatened';
    viability = 'MARGINALLY_THREATENED';
    urgency = 'URGENT_HOURS';
    if (contraindications.length === 0) {
      recommendedIntervention = 'STAT Catheter-Directed Thrombolysis (CDT with alteplase/tPA) or urgent percutaneous mechanical thrombectomy.';
    } else {
      recommendedIntervention = 'Urgent Surgical Thromboembolectomy (thrombolysis contraindicated due to bleeding risk).';
    }
  } else {
    // Category I
    category = 'I';
    categoryName = 'Category I: Viable';
    viability = 'VIABLE';
    urgency = 'ELECTIVE_URGENT';
    recommendedIntervention = 'Urgent formal diagnostic angiography / CTA followed by catheter-based or surgical revascularization.';
  }

  const thrombolysisEligible = (category === 'I' || category === 'IIa') && contraindications.length === 0;

  const clinicalPearls: string[] = [
    'Initiate immediate systemic anticoagulation with IV Unfractionated Heparin (80 units/kg bolus, 18 units/kg/hr infusion) targeting aPTT 60-80s to prevent clot propagation.',
    'Do not elevate the affected ischemic limb; maintain in a neutral or slightly dependent position to maximize gravity-assisted arterial perfusion.',
    'Pre-op preparation: Type & screen, serial potassium & creatine kinase (CK) monitoring, and hydration with sodium bicarbonate.'
  ];

  return {
    category,
    category_name: categoryName,
    limb_viability: viability,
    urgency,
    recommended_intervention: recommendedIntervention,
    thrombolysis_eligible: thrombolysisEligible,
    contraindications,
    clinical_pearls: clinicalPearls
  };
}

/**
 * Evaluates invasive compartment pressure and Delta-P (perfusion gradient).
 */
export function evaluateCompartmentPressure(input: CompartmentPressureInput): CompartmentPressureResult {
  const deltaP = Math.round((input.diastolic_bp_mmhg - input.measured_pressure_mmhg) * 10) / 10;
  
  // Delta P <= 30 mmHg OR absolute pressure >= 30 mmHg is the classic indication
  const fasciotomyIndicated = deltaP <= 30.0 || input.measured_pressure_mmhg >= 30.0;

  let alertLevel: 'NORMAL' | 'BORDERLINE_OBSERVE' | 'CRITICAL_FASCIOTOMY_REQUIRED' = 'NORMAL';
  let surgicalDirective = 'Normal compartmental pressure. Serial neurovascular exams every 2 hours.';

  if (fasciotomyIndicated) {
    alertLevel = 'CRITICAL_FASCIOTOMY_REQUIRED';
    surgicalDirective = `STAT Emergent Fasciotomy indicated for ${input.compartment_name} compartment (Delta-P = ${deltaP} mmHg <= 30 mmHg threshold). Decompress all 4 lower extremity compartments (anterior, lateral, superficial posterior, deep posterior) via dual-incision technique without delay.`;
  } else if (deltaP <= 35.0 || input.measured_pressure_mmhg >= 25.0) {
    alertLevel = 'BORDERLINE_OBSERVE';
    surgicalDirective = `Borderline tissue perfusion gradient (Delta-P = ${deltaP} mmHg). Repeat intracompartmental pressure measurement in 60-90 minutes. Keep limb at heart level (do NOT elevate). Remove all circumferential casts/splints.`;
  }

  const rhabdoPrevention: string[] = [
    'Aggressive crystalloid resuscitation targeting urine output > 1.5 - 2.0 mL/kg/hr to prevent acute tubular necrosis from myoglobin casts.',
    'Urinary alkalinization with IV Sodium Bicarbonate (target urine pH > 6.5) to inhibit Tamm-Horsfall myoglobin precipitation.',
    'Serial monitoring of serum potassium, creatine kinase (CK), and calcium every 4-6 hours to anticipate post-decompression reperfusion arrhythmias.'
  ];

  return {
    compartment_name: input.compartment_name,
    measured_pressure_mmhg: input.measured_pressure_mmhg,
    diastolic_bp_mmhg: input.diastolic_bp_mmhg,
    delta_p_mmhg: deltaP,
    fasciotomy_indicated: fasciotomyIndicated,
    alert_level: alertLevel,
    surgical_directive: surgicalDirective,
    rehabilitation_and_rhabdo_prevention: rhabdoPrevention
  };
}

/**
 * Evaluates microvascular free-flap viability & differentiates arterial vs venous failure.
 */
export function evaluateFreeFlapPerfusion(input: FreeFlapMonitoringInput): FreeFlapMonitoringResult {
  // Arterial Occlusion: StO2 < 50%, low Doppler flux, pale, prolonged capillary refill, cool
  if (
    (input.sto2_percent < 50 || input.laser_doppler_flux_pu < 2.0) &&
    (input.flap_color === 'pale' || input.capillary_refill_seconds > 3.0 || input.pinprick_bleeding === 'absent_no_bleeding')
  ) {
    return {
      perfusion_status: 'ARTERIAL_OCCLUSION',
      salvage_urgency: 'STAT_OR_EXPLORATION',
      clinical_diagnosis: 'Acute Microvascular Arterial Thrombosis / Severe Inflow Hypoperfusion',
      actions: [
        'STAT Notification to Microvascular Reconstructive Surgery team for emergent operative exploration.',
        'Immediate bolus of IV Unfractionated Heparin (5000 units) to halt microvascular thrombus propagation.',
        'Maintain normothermia and MAP > 85 mmHg to support collateral microcirculation.',
        'Operating room directive: Inspect pedicle for mechanical kinking, microvascular anastomotic revision, and intra-arterial papaverine/verapamil flush.'
      ]
    };
  }

  // Venous Congestion: StO2 < 50%, violaceous/dark purple, brisk capillary refill < 1s, dark rapid pinprick bleeding
  if (
    input.flap_color === 'violaceous_purple' ||
    input.pinprick_bleeding === 'brisk_dark_purple' ||
    (input.capillary_refill_seconds < 1.0 && input.sto2_percent < 55)
  ) {
    return {
      perfusion_status: 'VENOUS_CONGESTION',
      salvage_urgency: 'EMERGENT_SUTURE_RELEASE_LEECH',
      clinical_diagnosis: 'Microvascular Venous Outflow Failure / Severe Flap Congestion',
      actions: [
        'Emergent bedside release of compressive skin sutures and drainage of subcutaneous hematoma.',
        'STAT Operating room return for venous revision / thrombectomy or vein graft placement.',
        'If venous outflow cannot be surgically re-established: Initiate medicinal leech therapy (Hirudo medicinalis) 2-4 leeches to congested flap periphery every 4-6 hours.',
        'Mandatory antibiotic coverage: Ciprofloxacin 500 mg q12h or Trimethoprim-Sulfamethoxazole for Aeromonas hydrophila prophylaxis during leech application.'
      ]
    };
  }

  // Healthy Perfusion
  if (input.sto2_percent >= 60 && input.laser_doppler_flux_pu >= 4.0 && input.flap_color === 'pink') {
    return {
      perfusion_status: 'HEALTHY',
      salvage_urgency: 'STABLE',
      clinical_diagnosis: 'Viable Microvascular Free Flap with Adequate Perfusion',
      actions: [
        'Continue standard flap observation protocol (hourly bedside Doppler, color, and capillary refill checks for post-op hours 1-24).',
        'Maintain warm ambient room temperature (> 22 C) to avoid peripheral vasoconstriction.',
        'Maintain patient hydration and hematocrit target 27-30% for optimal blood viscosity.'
      ]
    };
  }

  return {
    perfusion_status: 'INDETERMINATE_OBSERVE',
    salvage_urgency: 'STABLE',
    clinical_diagnosis: 'Borderline or Indeterminate Microvascular Flap Perfusion',
    actions: [
      'Repeat clinical assessment and NIRS StO2 measurement in 30 minutes.',
      'Check for extrinsic compression by dressings, tracheostomy ties, or patient head position.'
    ]
  };
}

/**
 * Service Class: VascularLimbService
 */
export class VascularLimbService {
  /**
   * Evaluates Rutherford presentation and saves to database.
   */
  static async evaluateAndSaveEncounter(patientId: number, input: RutherfordAssessmentInput) {
    const evaluation = evaluateRutherfordClassification(input);

    const res = await pool.query(`
      INSERT INTO vascular_limb_encounters (
        patient_id, limb_affected, rutherford_category, sensory_loss, motor_deficit,
        arterial_doppler_audible, venous_doppler_audible, recommended_intervention,
        thrombolysis_contraindications
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `, [
      patientId,
      input.limb_affected,
      evaluation.category,
      input.sensory_loss,
      input.motor_deficit,
      input.arterial_doppler_audible,
      input.venous_doppler_audible,
      evaluation.recommended_intervention,
      JSON.stringify(evaluation.contraindications)
    ]);

    return {
      encounter: res.rows[0],
      evaluation
    };
  }

  /**
   * Logs invasive compartment pressure and optional free-flap monitoring.
   */
  static async logCompartmentPressure(
    encounterId: number,
    compInput: CompartmentPressureInput,
    flapInput?: FreeFlapMonitoringInput
  ) {
    const compEval = evaluateCompartmentPressure(compInput);
    const flapEval = flapInput ? evaluateFreeFlapPerfusion(flapInput) : null;

    const res = await pool.query(`
      INSERT INTO compartment_pressure_logs (
        encounter_id, compartment_name, measured_pressure_mmhg,
        diastolic_bp_mmhg, delta_p_mmhg, fasciotomy_indicated, free_flap_monitoring
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `, [
      encounterId,
      compInput.compartment_name,
      compInput.measured_pressure_mmhg,
      compInput.diastolic_bp_mmhg,
      compEval.delta_p_mmhg,
      compEval.fasciotomy_indicated,
      flapEval ? JSON.stringify({ input: flapInput, evaluation: flapEval }) : null
    ]);

    return {
      log: res.rows[0],
      compartment_evaluation: compEval,
      free_flap_evaluation: flapEval
    };
  }

  /**
   * Retrieves vascular history for a patient.
   */
  static async getPatientVascularHistory(patientId: number) {
    const encounters = await pool.query(`
      SELECT * FROM vascular_limb_encounters
      WHERE patient_id = $1
      ORDER BY created_at DESC;
    `, [patientId]);

    const logs = await pool.query(`
      SELECT c.* FROM compartment_pressure_logs c
      JOIN vascular_limb_encounters e ON c.encounter_id = e.id
      WHERE e.patient_id = $1
      ORDER BY c.logged_at DESC;
    `, [patientId]);

    return {
      encounters: encounters.rows,
      compartment_logs: logs.rows
    };
  }
}
