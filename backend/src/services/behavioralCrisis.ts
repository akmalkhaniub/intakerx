import { pool } from '../db';

export interface BvcItemChecklist {
  confused: boolean;
  irritable: boolean;
  boisterous: boolean;
  physicallyThreatening: boolean;
  verballyThreatening: boolean;
  attackingObjects: boolean;
}

export interface PsychCrisisEvaluationInput {
  patientId: number;
  sessionId?: string;
  bvcItems: BvcItemChecklist;
  suicideRiskLevel?: 'none' | 'low' | 'moderate' | 'high_active_intent';
  sensoryRoomUtilized?: boolean;
  chemicalRestraintAdministered?: boolean;
  evaluatingClinician?: string;
  clinicalNarrative?: string;
}

export interface InvoluntaryHoldInput {
  patientId: number;
  crisisEvaluationId?: number;
  statutoryHoldType: string;
  holdCriteria: ('danger_to_self' | 'danger_to_others' | 'gravely_disabled')[];
  rightsAdvisementDelivered?: boolean;
  holdDurationHours?: number; // Defaults to 72 hours
  initiatingClinician?: string;
  destinationFacility?: string;
}

export interface BehavioralCrisisSummary {
  metrics: {
    activeCrises: number;
    constantObserversRequired: number; // 1:1 sitters
    activeLegalHolds: number;
    bedPlacementQueue: number;
    deEscalationSuccessRate: number;
    sensoryRoomUsageCount: number;
  };
  recentEvaluations: any[];
  activeHolds: any[];
}

export async function evaluateBehavioralCrisis(input: PsychCrisisEvaluationInput) {
  const {
    patientId,
    sessionId,
    bvcItems,
    suicideRiskLevel = 'low',
    sensoryRoomUtilized = false,
    chemicalRestraintAdministered = false,
    evaluatingClinician = 'Psychiatric Emergency Response Clinician',
    clinicalNarrative = ''
  } = input;

  // Calculate Brøset Violence Checklist (BVC) score: 0 to 6
  let bvcScore = 0;
  if (bvcItems.confused) bvcScore += 1;
  if (bvcItems.irritable) bvcScore += 1;
  if (bvcItems.boisterous) bvcScore += 1;
  if (bvcItems.physicallyThreatening) bvcScore += 1;
  if (bvcItems.verballyThreatening) bvcScore += 1;
  if (bvcItems.attackingObjects) bvcScore += 1;

  // Stratify Violence Risk
  let violenceRiskLevel: 'low' | 'moderate' | 'high_imminent' = 'low';
  if (bvcScore >= 3) {
    violenceRiskLevel = 'high_imminent';
  } else if (bvcScore >= 1) {
    violenceRiskLevel = 'moderate';
  }

  // Assign Observation Level
  let observationLevel: 'standard_safety_rounds' | '15_min_q15' | '1_to_1_constant_sitter' = 'standard_safety_rounds';
  if (violenceRiskLevel === 'high_imminent' || suicideRiskLevel === 'high_active_intent') {
    observationLevel = '1_to_1_constant_sitter';
  } else if (violenceRiskLevel === 'moderate' || suicideRiskLevel === 'moderate') {
    observationLevel = '15_min_q15';
  }

  // Assign Trauma-Informed De-escalation Protocol
  let deEscalationProtocol = 'verbal_supportive_listening';
  if (violenceRiskLevel === 'high_imminent') {
    deEscalationProtocol = 'behavioral_rapid_response_code_grey';
  } else if (violenceRiskLevel === 'moderate') {
    deEscalationProtocol = 'verbal_de_escalation_sensory_room';
  }

  const query = `
    INSERT INTO psych_crisis_evaluations (
      patient_id,
      session_id,
      bvc_score,
      bvc_items,
      violence_risk_level,
      suicide_risk_level,
      observation_level,
      de_escalation_protocol,
      sensory_room_utilized,
      chemical_restraint_administered,
      evaluating_clinician,
      clinical_narrative,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
    RETURNING *;
  `;

  const { rows } = await pool.query(query, [
    patientId,
    sessionId || null,
    bvcScore,
    JSON.stringify(bvcItems),
    violenceRiskLevel,
    suicideRiskLevel,
    observationLevel,
    deEscalationProtocol,
    sensoryRoomUtilized,
    chemicalRestraintAdministered,
    evaluatingClinician,
    clinicalNarrative
  ]);

  return rows[0];
}

export async function initiateInvoluntaryHold(input: InvoluntaryHoldInput) {
  const {
    patientId,
    crisisEvaluationId,
    statutoryHoldType,
    holdCriteria,
    rightsAdvisementDelivered = true,
    holdDurationHours = 72,
    initiatingClinician = 'Attending Emergency Psychiatrist',
    destinationFacility
  } = input;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + holdDurationHours * 3600 * 1000);

  const query = `
    INSERT INTO involuntary_hold_records (
      patient_id,
      crisis_evaluation_id,
      statutory_hold_type,
      hold_criteria,
      rights_advisement_delivered,
      initiated_at,
      expires_at,
      hold_status,
      initiating_clinician,
      destination_facility,
      bed_placement_status,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, 'active_hold', $7, $8, 'searching', CURRENT_TIMESTAMP)
    RETURNING *;
  `;

  const { rows } = await pool.query(query, [
    patientId,
    crisisEvaluationId || null,
    statutoryHoldType,
    JSON.stringify(holdCriteria),
    rightsAdvisementDelivered,
    expiresAt,
    initiatingClinician,
    destinationFacility || null
  ]);

  return rows[0];
}

export async function updateHoldPlacement(
  holdId: number,
  updates: {
    bedPlacementStatus?: 'searching' | 'bed_reserved' | 'transport_en_route' | 'admitted';
    destinationFacility?: string;
    holdStatus?: 'active_hold' | 'discharged_voluntary' | 'extended_5250' | 'rescinded';
  }
) {
  const currentRes = await pool.query('SELECT * FROM involuntary_hold_records WHERE id = $1', [holdId]);
  if (currentRes.rows.length === 0) {
    throw new Error(`Involuntary hold record #${holdId} not found`);
  }

  const existing = currentRes.rows[0];
  const bedStatus = updates.bedPlacementStatus || existing.bed_placement_status;
  const facility = updates.destinationFacility || existing.destination_facility;
  const holdStatus = updates.holdStatus || existing.hold_status;

  const query = `
    UPDATE involuntary_hold_records
    SET bed_placement_status = $1,
        destination_facility = $2,
        hold_status = $3
    WHERE id = $4
    RETURNING *;
  `;

  const { rows } = await pool.query(query, [bedStatus, facility, holdStatus, holdId]);
  return rows[0];
}

async function seedInitialPsychDataIfEmpty() {
  const countRes = await pool.query('SELECT COUNT(*) FROM psych_crisis_evaluations');
  if (parseInt(countRes.rows[0].count, 10) > 0) return;

  const patientRes = await pool.query('SELECT id, name FROM patients LIMIT 1');
  if (patientRes.rows.length === 0) return;
  const p = patientRes.rows[0];

  const evalRes = await pool.query(`
    INSERT INTO psych_crisis_evaluations (
      patient_id, bvc_score, bvc_items, violence_risk_level, suicide_risk_level, observation_level,
      de_escalation_protocol, sensory_room_utilized, chemical_restraint_administered, evaluating_clinician,
      clinical_narrative, created_at
    ) VALUES ($1, 2, '{"confused": true, "irritable": true, "boisterous": false, "physicallyThreatening": false, "verballyThreatening": false, "attackingObjects": false}'::jsonb,
      'moderate', 'low', '15_min_q15', 'verbal_de_escalation_sensory_room', TRUE, FALSE,
      'Crisis Clinician Taylor Reed, LCSW', 'Patient presented with acute agitation. Successfully calmed in low-stim sensory room.', CURRENT_TIMESTAMP - INTERVAL '4 hours')
    RETURNING id;
  `, [p.id]);

  if (evalRes.rows.length > 0) {
    await pool.query(`
      INSERT INTO involuntary_hold_records (
        patient_id, crisis_evaluation_id, statutory_hold_type, hold_criteria, rights_advisement_delivered,
        initiated_at, expires_at, hold_status, initiating_clinician, destination_facility, bed_placement_status, created_at
      ) VALUES ($1, $2, 'California 5150 (72h)', '["danger_to_self", "gravely_disabled"]'::jsonb, TRUE,
        CURRENT_TIMESTAMP - INTERVAL '4 hours', CURRENT_TIMESTAMP + INTERVAL '68 hours', 'active_hold',
        'Dr. Julian Mercer, MD', 'Bayview Inpatient Psychiatric Center', 'bed_reserved', CURRENT_TIMESTAMP - INTERVAL '4 hours')
    `, [p.id, evalRes.rows[0].id]);
  }
}

export async function getBehavioralCrisisSummary(): Promise<BehavioralCrisisSummary> {
  await seedInitialPsychDataIfEmpty();

  const evalRes = await pool.query(`
    SELECT e.*, p.name as patient_name
    FROM psych_crisis_evaluations e
    LEFT JOIN patients p ON e.patient_id = p.id
    ORDER BY e.created_at DESC
    LIMIT 30;
  `);

  const holdRes = await pool.query(`
    SELECT h.*, p.name as patient_name
    FROM involuntary_hold_records h
    LEFT JOIN patients p ON h.patient_id = p.id
    ORDER BY h.created_at DESC
    LIMIT 30;
  `);

  const activeHolds = holdRes.rows.filter(h => h.hold_status === 'active_hold');
  const sittersRequired = evalRes.rows.filter(e => e.observation_level === '1_to_1_constant_sitter').length;
  const sensoryRoomCount = evalRes.rows.filter(e => e.sensory_room_utilized).length;
  const noRestraintCount = evalRes.rows.filter(e => !e.chemical_restraint_administered).length;
  const deEscalationRate = evalRes.rows.length > 0
    ? Math.round((noRestraintCount / evalRes.rows.length) * 100)
    : 100;

  const searchingBeds = activeHolds.filter(h => h.bed_placement_status === 'searching' || h.bed_placement_status === 'bed_reserved');

  return {
    metrics: {
      activeCrises: evalRes.rows.length,
      constantObserversRequired: sittersRequired,
      activeLegalHolds: activeHolds.length,
      bedPlacementQueue: searchingBeds.length,
      deEscalationSuccessRate: deEscalationRate,
      sensoryRoomUsageCount: sensoryRoomCount
    },
    recentEvaluations: evalRes.rows.map(e => ({
      id: e.id,
      patientId: e.patient_id,
      patientName: e.patient_name || `Patient #${e.patient_id}`,
      bvcScore: e.bvc_score,
      bvcItems: e.bvc_items || {},
      violenceRiskLevel: e.violence_risk_level,
      suicideRiskLevel: e.suicide_risk_level,
      observationLevel: e.observation_level,
      deEscalationProtocol: e.de_escalation_protocol,
      sensoryRoomUtilized: e.sensory_room_utilized,
      chemicalRestraintAdministered: e.chemical_restraint_administered,
      evaluatingClinician: e.evaluating_clinician,
      clinicalNarrative: e.clinical_narrative,
      createdAt: e.created_at
    })),
    activeHolds: holdRes.rows.map(h => {
      const now = new Date();
      const expires = new Date(h.expires_at);
      const hoursRemaining = Math.max(0, Math.round(((expires.getTime() - now.getTime()) / (1000 * 3600)) * 10) / 10);

      return {
        id: h.id,
        patientId: h.patient_id,
        patientName: h.patient_name || `Patient #${h.patient_id}`,
        crisisEvaluationId: h.crisis_evaluation_id,
        statutoryHoldType: h.statutory_hold_type,
        holdCriteria: h.hold_criteria || [],
        rightsAdvisementDelivered: h.rights_advisement_delivered,
        initiatedAt: h.initiated_at,
        expiresAt: h.expires_at,
        hoursRemaining,
        holdStatus: h.hold_status,
        initiatingClinician: h.initiating_clinician,
        destinationFacility: h.destination_facility,
        bedPlacementStatus: h.bed_placement_status,
        createdAt: h.created_at
      };
    })
  };
}

export async function getPatientPsychData(patientId: number) {
  const evals = await pool.query(
    'SELECT * FROM psych_crisis_evaluations WHERE patient_id = $1 ORDER BY created_at DESC',
    [patientId]
  );
  const holds = await pool.query(
    'SELECT * FROM involuntary_hold_records WHERE patient_id = $1 ORDER BY created_at DESC',
    [patientId]
  );

  return {
    evaluations: evals.rows,
    holds: holds.rows
  };
}
