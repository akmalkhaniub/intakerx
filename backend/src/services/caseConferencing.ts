import { pool } from '../db';

export interface CaseConferenceNote {
  id: number;
  conferenceId: number;
  clinicianName: string;
  specialty: string;
  recommendation: string;
  voteDiagnosis?: string;
  urgency: 'stat' | 'urgent' | 'routine';
  createdAt: string;
}

export interface CaseConference {
  id: number;
  sessionId: string;
  title: string;
  specialtyFocus: string;
  status: 'open' | 'in_review' | 'consensus_reached' | 'finalized';
  consensusSummary?: string;
  consensusDiagnosis?: string;
  finalizedAt?: string;
  createdAt: string;
  notes: CaseConferenceNote[];
  votingBreakdown: { diagnosis: string; voteCount: number; percentage: number }[];
}

/**
 * Creates or retrieves the active MDT Case Conference for a session
 */
export async function getOrCreateConference(
  sessionId: string,
  specialtyFocus: string = 'Multidisciplinary Acute Care Review',
  title?: string
): Promise<CaseConference> {
  const existing = await pool.query(
    `SELECT * FROM case_conferences WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [sessionId]
  );

  let conferenceId: number;
  if (existing.rows.length > 0) {
    conferenceId = existing.rows[0].id;
  } else {
    // Determine default title from patient & chief complaint if available
    let confTitle = title || 'MDT Case Conference Review';
    const sessRes = await pool.query(
      `SELECT s.id, p.name FROM intake_sessions s JOIN patients p ON s.patient_id = p.id WHERE s.id = $1`,
      [sessionId]
    );
    if (sessRes.rows.length > 0) {
      confTitle = `${sessRes.rows[0].name} — ${specialtyFocus}`;
    }

    const newConf = await pool.query(
      `INSERT INTO case_conferences (session_id, title, specialty_focus, status)
       VALUES ($1, $2, $3, 'open')
       RETURNING id`,
      [sessionId, confTitle, specialtyFocus]
    );
    conferenceId = newConf.rows[0].id;

    // Seed initial specialist baseline note
    await pool.query(
      `INSERT INTO case_conference_notes (
         conference_id, clinician_name, specialty, recommendation, vote_diagnosis, urgency
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        conferenceId,
        'Dr. Robert Vance, MD (Attending Hospitalist)',
        'Internal Medicine',
        'Patient presents with atypical chest pain and dyspnea. Initial high-sensitivity troponin is pending. Requesting cardiology and radiology review for emergent angiogram vs CT pulmonary angiogram.',
        'Acute Coronary Syndrome (NSTEMI)',
        'urgent'
      ]
    );
  }

  const details = await getConference(conferenceId);
  if (!details) {
    throw new Error(`Failed to load conference ${conferenceId}`);
  }
  return details;
}

/**
 * Retrieves full conference details with notes and voting breakdown
 */
export async function getConference(conferenceIdOrSessionId: number | string): Promise<CaseConference | null> {
  const isNumeric = !isNaN(Number(conferenceIdOrSessionId));
  const confRes = await pool.query(
    isNumeric 
      ? `SELECT * FROM case_conferences WHERE id = $1`
      : `SELECT * FROM case_conferences WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [conferenceIdOrSessionId]
  );

  if (confRes.rows.length === 0) return null;
  const conf = confRes.rows[0];

  const notesRes = await pool.query(
    `SELECT * FROM case_conference_notes WHERE conference_id = $1 ORDER BY created_at ASC`,
    [conf.id]
  );

  const notes: CaseConferenceNote[] = notesRes.rows.map(r => ({
    id: r.id,
    conferenceId: r.conference_id,
    clinicianName: r.clinician_name,
    specialty: r.specialty,
    recommendation: r.recommendation,
    voteDiagnosis: r.vote_diagnosis,
    urgency: r.urgency as any,
    createdAt: r.created_at?.toISOString ? r.created_at.toISOString() : String(r.created_at)
  }));

  // Calculate diagnosis voting breakdown
  const voteCounts: Record<string, number> = {};
  let totalVotes = 0;
  for (const n of notes) {
    if (n.voteDiagnosis) {
      voteCounts[n.voteDiagnosis] = (voteCounts[n.voteDiagnosis] || 0) + 1;
      totalVotes++;
    }
  }

  const votingBreakdown = Object.entries(voteCounts).map(([diagnosis, count]) => ({
    diagnosis,
    voteCount: count,
    percentage: totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
  })).sort((a, b) => b.voteCount - a.voteCount);

  return {
    id: conf.id,
    sessionId: conf.session_id,
    title: conf.title,
    specialtyFocus: conf.specialty_focus,
    status: conf.status,
    consensusSummary: conf.consensus_summary,
    consensusDiagnosis: conf.consensus_diagnosis,
    finalizedAt: conf.finalized_at?.toISOString ? conf.finalized_at.toISOString() : (conf.finalized_at ? String(conf.finalized_at) : undefined),
    createdAt: conf.created_at?.toISOString ? conf.created_at.toISOString() : String(conf.created_at),
    notes,
    votingBreakdown
  };
}

/**
 * Appends a new specialist clinical contribution & vote
 */
export async function addConferenceNote(
  conferenceId: number,
  note: {
    clinicianName: string;
    specialty: string;
    recommendation: string;
    voteDiagnosis?: string;
    urgency?: 'stat' | 'urgent' | 'routine';
  }
): Promise<CaseConferenceNote> {
  const res = await pool.query(
    `INSERT INTO case_conference_notes (
       conference_id, clinician_name, specialty, recommendation, vote_diagnosis, urgency
     ) VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      conferenceId,
      note.clinicianName,
      note.specialty,
      note.recommendation,
      note.voteDiagnosis || null,
      note.urgency || 'routine'
    ]
  );

  const r = res.rows[0];
  return {
    id: r.id,
    conferenceId: r.conference_id,
    clinicianName: r.clinician_name,
    specialty: r.specialty,
    recommendation: r.recommendation,
    voteDiagnosis: r.vote_diagnosis,
    urgency: r.urgency,
    createdAt: r.created_at?.toISOString ? r.created_at.toISOString() : String(r.created_at)
  };
}

/**
 * Finalizes multidisciplinary consensus and signs off the case conference
 */
export async function finalizeConsensus(
  conferenceId: number,
  consensusDiagnosis: string,
  consensusSummary: string
): Promise<CaseConference> {
  await pool.query(
    `UPDATE case_conferences 
     SET status = 'consensus_reached',
         consensus_diagnosis = $1,
         consensus_summary = $2,
         finalized_at = CURRENT_TIMESTAMP
     WHERE id = $3`,
    [consensusDiagnosis, consensusSummary, conferenceId]
  );

  const updated = await getConference(conferenceId);
  if (!updated) {
    throw new Error(`Conference ${conferenceId} could not be retrieved after finalization.`);
  }
  return updated;
}
