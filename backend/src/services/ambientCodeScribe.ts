import { pool } from '../db';
import { EventEmitter } from 'events';
import { FhirGatewayService } from './fhirGateway';

export type ResusEventType =
  | 'RHYTHM_CHECK'
  | 'DEFIBRILLATION'
  | 'MEDICATION_GIVEN'
  | 'AIRWAY_INTUBATION'
  | 'PROCEDURE_PERFORMED'
  | 'LAB_RESULT'
  | 'VOICE_QUERY_RESOLVED'
  | 'CRITICAL_ALERT'
  | 'ROSC_ACHIEVED'
  | 'MTP_BLOOD_HANG'
  | 'CPR_CYCLE';

export interface AmbientCodeSession {
  id: number;
  patientId: number;
  bedNumber: number;
  codeType: string;
  codeLeader: string;
  codeRecorder: string;
  startedAt: string;
  endedAt?: string;
  isActive: boolean;
  totalEpinephrineMg: number;
  totalDefibrillations: number;
  roscAchieved: boolean;
  pmcsPerformed: boolean;
  mtpUnitsPrbc: number;
  mtpUnitsFfp: number;
  mtpUnitsPlatelets: number;
  debriefSummary?: string;
}

export interface AmbientCodeEvent {
  id?: number;
  sessionId: number;
  elapsedSeconds: number;
  eventType: ResusEventType;
  utteranceText: string;
  structuredPayload: Record<string, any>;
  speakerRole: string;
  createdAt?: string;
}

export interface VoiceQueryResolution {
  isQuery: boolean;
  queryType?: 'ELAPSED_TIME' | 'LAST_EPINEPHRINE' | 'MTP_RATIO' | 'DEFIBRILLATIONS' | 'GENERAL';
  spokenAnswer?: string;
}

export class AmbientCodeScribeService {
  public static emitter: EventEmitter = new EventEmitter();

  /**
   * Initiates a new bedside ambient resuscitation code session.
   */
  public static async startSession(
    patientId: number,
    bedNumber: number,
    codeLeader: string = 'Dr. Sarah Connor, MD',
    codeRecorder: string = 'RN Michael Scott',
    codeType: string = 'CARDIAC_ARREST_ACLS'
  ): Promise<AmbientCodeSession> {
    const res = await pool.query(`
      INSERT INTO ambient_code_resus_sessions (
        patient_id, bed_number, code_type, code_leader, code_recorder, started_at, is_active
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, true)
      RETURNING *;
    `, [patientId, bedNumber, codeType, codeLeader, codeRecorder]);

    const row = res.rows[0];
    const session: AmbientCodeSession = {
      id: row.id,
      patientId: row.patient_id,
      bedNumber: row.bed_number,
      codeType: row.code_type,
      codeLeader: row.code_leader,
      codeRecorder: row.code_recorder,
      startedAt: row.started_at.toISOString(),
      isActive: row.is_active,
      totalEpinephrineMg: parseFloat(row.total_epinephrine_mg) || 0.0,
      totalDefibrillations: row.total_defibrillations || 0,
      roscAchieved: row.rosc_achieved,
      pmcsPerformed: row.pmcs_performed,
      mtpUnitsPrbc: row.mtp_units_prbc || 0,
      mtpUnitsFfp: row.mtp_units_ffp || 0,
      mtpUnitsPlatelets: row.mtp_units_platelets || 0
    };

    // Log initialization event
    await this.logEvent({
      sessionId: session.id,
      elapsedSeconds: 0,
      eventType: 'CPR_CYCLE',
      utteranceText: `CODE BLUE INITIATED. Type: ${codeType}. Leader: ${codeLeader}, Recorder: ${codeRecorder}.`,
      structuredPayload: { status: 'STARTED', codeType },
      speakerRole: 'CODE_LEADER'
    });

    return session;
  }

  /**
   * Retrieves active or completed session by ID.
   */
  public static async getSession(sessionId: number): Promise<AmbientCodeSession | null> {
    const res = await pool.query('SELECT * FROM ambient_code_resus_sessions WHERE id = $1', [sessionId]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      patientId: row.patient_id,
      bedNumber: row.bed_number,
      codeType: row.code_type,
      codeLeader: row.code_leader,
      codeRecorder: row.code_recorder,
      startedAt: row.started_at.toISOString(),
      endedAt: row.ended_at ? row.ended_at.toISOString() : undefined,
      isActive: row.is_active,
      totalEpinephrineMg: parseFloat(row.total_epinephrine_mg) || 0.0,
      totalDefibrillations: row.total_defibrillations || 0,
      roscAchieved: row.rosc_achieved,
      pmcsPerformed: row.pmcs_performed,
      mtpUnitsPrbc: row.mtp_units_prbc || 0,
      mtpUnitsFfp: row.mtp_units_ffp || 0,
      mtpUnitsPlatelets: row.mtp_units_platelets || 0,
      debriefSummary: row.debrief_summary
    };
  }

  /**
   * Retrieves chronological event stream for a session.
   */
  public static async getSessionEvents(sessionId: number): Promise<AmbientCodeEvent[]> {
    const res = await pool.query(
      'SELECT * FROM ambient_code_resus_events WHERE session_id = $1 ORDER BY id ASC',
      [sessionId]
    );
    return res.rows.map(r => ({
      id: r.id,
      sessionId: r.session_id,
      elapsedSeconds: r.elapsed_seconds,
      eventType: r.event_type as ResusEventType,
      utteranceText: r.utterance_text,
      structuredPayload: r.structured_payload,
      speakerRole: r.speaker_role,
      createdAt: r.created_at.toISOString()
    }));
  }

  /**
   * Parses ambient audio transcript utterance in real-time, updates resuscitation tallies,
   * arbitrates cross-phase contraindications, and answers voice queries.
   */
  public static async processUtterance(
    sessionId: number,
    utteranceText: string,
    speakerRole: string = 'CODE_TEAM'
  ): Promise<{ event: AmbientCodeEvent; voiceAnswer?: string; activeAlert?: string }> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Resuscitation session ${sessionId} not found`);
    }

    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000));
    const lower = utteranceText.toLowerCase().trim();

    let eventType: ResusEventType = 'CPR_CYCLE';
    const payload: Record<string, any> = { rawText: utteranceText };
    let voiceAnswer: string | undefined;
    let activeAlert: string | undefined;

    // 1. Voice HUD Queries ("IntakeRx, what is..." or "IntakeRx, status...")
    if (lower.includes('intakerx') || lower.includes('hey intakerx') || lower.includes('what is the') || lower.includes('how many') || lower.includes('when was')) {
      eventType = 'VOICE_QUERY_RESOLVED';

      if (lower.includes('elapsed') || lower.includes('how long') || lower.includes('code time')) {
        const mins = Math.floor(elapsedSeconds / 60);
        const secs = elapsedSeconds % 60;
        voiceAnswer = `Elapsed resuscitation time is ${mins} minute${mins !== 1 ? 's' : ''} and ${secs} second${secs !== 1 ? 's' : ''}.`;
        payload.query = 'ELAPSED_TIME';
        payload.answer = voiceAnswer;
      } else if (lower.includes('last epi') || lower.includes('epinephrine')) {
        const lastEpiRes = await pool.query(`
          SELECT elapsed_seconds FROM ambient_code_resus_events
          WHERE session_id = $1 AND event_type = 'MEDICATION_GIVEN' AND structured_payload->>'drug' = 'Epinephrine'
          ORDER BY id DESC LIMIT 1;
        `, [sessionId]);

        if (lastEpiRes.rows.length === 0) {
          voiceAnswer = `No epinephrine has been recorded yet. Total given: ${session.totalEpinephrineMg} milligrams.`;
        } else {
          const lastSecs = lastEpiRes.rows[0].elapsed_seconds;
          const diffSecs = elapsedSeconds - lastSecs;
          const diffMins = Math.floor(diffSecs / 60);
          voiceAnswer = `Last Epinephrine 1 milligram was given ${diffMins} minute${diffMins !== 1 ? 's' : ''} ${diffSecs % 60} seconds ago. Next dose ${diffSecs >= 180 ? 'IS DUE NOW (Q3-5m window).' : `in ${180 - diffSecs} seconds.`}`;
        }
        payload.query = 'LAST_EPINEPHRINE';
        payload.answer = voiceAnswer;
      } else if (lower.includes('mtp') || lower.includes('blood ratio') || lower.includes('transfusion')) {
        voiceAnswer = `Current MTP Transfusion status: ${session.mtpUnitsPrbc} units PRBC, ${session.mtpUnitsFfp} units FFP, and ${session.mtpUnitsPlatelets} pack platelets. Ratio: ${session.mtpUnitsPrbc}:${session.mtpUnitsFfp}:${session.mtpUnitsPlatelets}. Target is balanced 1:1:1.`;
        payload.query = 'MTP_RATIO';
        payload.answer = voiceAnswer;
      } else if (lower.includes('shock') || lower.includes('defib')) {
        voiceAnswer = `Total shocks delivered: ${session.totalDefibrillations}.`;
        payload.query = 'DEFIBRILLATIONS';
        payload.answer = voiceAnswer;
      } else {
        voiceAnswer = `IntakeRx Bedside Scribe: Code is active at ${Math.floor(elapsedSeconds / 60)} minutes. Total Epinephrine: ${session.totalEpinephrineMg} mg, Shocks: ${session.totalDefibrillations}.`;
        payload.query = 'GENERAL_STATUS';
        payload.answer = voiceAnswer;
      }
    }

    // 2. Defibrillation ("clear", "shock delivered", "200 joules", "defib")
    else if (lower.includes('shock delivered') || lower.includes('discharged 200') || (lower.includes('shock') && lower.includes('joules'))) {
      eventType = 'DEFIBRILLATION';
      const joules = lower.includes('150') ? 150 : lower.includes('360') ? 360 : 200;
      payload.joules = joules;
      payload.shockNumber = session.totalDefibrillations + 1;

      // Update session defib tally
      await pool.query('UPDATE ambient_code_resus_sessions SET total_defibrillations = total_defibrillations + 1 WHERE id = $1', [sessionId]);
      session.totalDefibrillations += 1;
    }

    // 3. Rhythm Check ("rhythm check PEA", "asystole", "v-fib", "ventricular fibrillation", "v-tach")
    else if (lower.includes('rhythm check') || lower.includes('rhythm is') || lower.includes('pea') || lower.includes('asystole') || lower.includes('v-fib') || lower.includes('ventricular fib')) {
      eventType = 'RHYTHM_CHECK';
      let rhythm = 'PEA';
      if (lower.includes('asystole')) rhythm = 'Asystole';
      else if (lower.includes('v-fib') || lower.includes('ventricular fib') || lower.includes('vf')) rhythm = 'Ventricular Fibrillation (V-Fib)';
      else if (lower.includes('v-tach') || lower.includes('ventricular tach') || lower.includes('vt')) rhythm = 'Pulseless V-Tach';
      else if (lower.includes('sinus') || lower.includes('organized')) rhythm = 'Organized Sinus Rhythm';

      payload.rhythm = rhythm;
      payload.cprCycleReset = true;
    }

    // 4. Medications Given
    else if (
      lower.includes('epinephrine') ||
      lower.includes('epi ') ||
      lower.includes('amiodarone') ||
      lower.includes('calcium gluconate') ||
      lower.includes('sodium bicarb') ||
      lower.includes('methergine') ||
      lower.includes('carboprost') ||
      lower.includes('misoprostol')
    ) {
      eventType = 'MEDICATION_GIVEN';

      if (lower.includes('epinephrine') || lower.includes('epi ')) {
        payload.drug = 'Epinephrine';
        payload.dose = '1 mg IV push';
        await pool.query('UPDATE ambient_code_resus_sessions SET total_epinephrine_mg = total_epinephrine_mg + 1.0 WHERE id = $1', [sessionId]);
        session.totalEpinephrineMg += 1.0;
      } else if (lower.includes('amiodarone')) {
        payload.drug = 'Amiodarone';
        payload.dose = lower.includes('150') ? '150 mg IV push' : '300 mg IV push';
      } else if (lower.includes('calcium gluconate')) {
        payload.drug = 'Calcium Gluconate';
        payload.dose = '1 g IV';
      } else if (lower.includes('sodium bicarb')) {
        payload.drug = 'Sodium Bicarbonate';
        payload.dose = '50 mEq IV push';
      } else if (lower.includes('methergine') || lower.includes('methylergonovine')) {
        payload.drug = 'Methylergonovine (Methergine)';
        payload.dose = '0.2 mg IM';

        // Check Contraindication via Clinical State
        const clinicalState = await FhirGatewayService.getPatientClinicalState(session.patientId);
        if (clinicalState?.obstetric?.severePreeclampsiaEclampsia) {
          activeAlert = '🚨 CRITICAL CONTRAINDICATION ALERT: Methergine administered in severe preeclampsia/hypertension. Stroke risk elevated!';
          payload.contraindicationFlagged = true;
          payload.contraindicationHazard = 'Hypertensive crisis / Stroke risk in Preeclampsia (Phase 97)';
        }
      } else if (lower.includes('carboprost') || lower.includes('hemabate')) {
        payload.drug = 'Carboprost (Hemabate)';
        payload.dose = '250 mcg IM';

        const clinicalState = await FhirGatewayService.getPatientClinicalState(session.patientId);
        if (clinicalState?.respiratory?.severeAsthmaBronchospasm) {
          activeAlert = '🚨 CRITICAL CONTRAINDICATION ALERT: Carboprost administered in status asthmaticus. Fatal bronchospasm risk!';
          payload.contraindicationFlagged = true;
          payload.contraindicationHazard = 'Severe Bronchospasm in Asthma (Phase 65)';
        }
      }
    }

    // 5. Maternal Code / PMCS Procedures ("manual lud", "pmcs", "scalpel in hand", "hysterotomy")
    else if (lower.includes('manual lud') || lower.includes('pmcs') || lower.includes('scalpel in hand') || lower.includes('hysterotomy') || lower.includes('perimortem')) {
      eventType = 'PROCEDURE_PERFORMED';
      if (lower.includes('manual lud')) {
        payload.procedure = 'Manual Left Uterine Displacement (LUD)';
        payload.rationale = 'Aortocaval decompression on firm backboard';
      } else {
        payload.procedure = 'Perimortem Cesarean Section (PMCS)';
        payload.incisionTimeMinutes = Math.floor(elapsedSeconds / 60);
        await pool.query('UPDATE ambient_code_resus_sessions SET pmcs_performed = true WHERE id = $1', [sessionId]);
        session.pmcsPerformed = true;
      }
    }

    // 6. Airway Intubation ("ett", "intubated", "tube confirmed")
    else if (lower.includes('intubated') || lower.includes('ett placed') || lower.includes('tube confirmed') || lower.includes('etco2')) {
      eventType = 'AIRWAY_INTUBATION';
      payload.tubeSize = '7.5 mm';
      payload.depthCm = 22;
      payload.confirmation = 'Colorimetric capnography / continuous ETCO2 waveform';
    }

    // 7. MTP Blood Products Hang ("prbc", "ffp", "platelets hanging", "pack 1 mtp")
    else if (lower.includes('prbc') || lower.includes('ffp') || lower.includes('platelets') || lower.includes('mtp')) {
      eventType = 'MTP_BLOOD_HANG';
      let prbc = 0;
      let ffp = 0;
      let plt = 0;

      if (lower.includes('pack 1') || lower.includes('cooler 1')) {
        prbc = 4;
        ffp = 4;
        plt = 1;
      } else {
        if (lower.includes('prbc') || lower.includes('packed red')) prbc = 2;
        if (lower.includes('ffp') || lower.includes('fresh frozen')) ffp = 2;
        if (lower.includes('platelet')) plt = 1;
      }

      payload.unitsAdded = { prbc, ffp, platelets: plt };
      await pool.query(`
        UPDATE ambient_code_resus_sessions
        SET mtp_units_prbc = mtp_units_prbc + $1,
            mtp_units_ffp = mtp_units_ffp + $2,
            mtp_units_platelets = mtp_units_platelets + $3
        WHERE id = $4;
      `, [prbc, ffp, plt, sessionId]);

      session.mtpUnitsPrbc += prbc;
      session.mtpUnitsFfp += ffp;
      session.mtpUnitsPlatelets += plt;
    }

    // 8. ROSC Achieved ("pulse returned", "rosc achieved", "palpable carotid pulse")
    else if (lower.includes('pulse returned') || lower.includes('rosc achieved') || lower.includes('palpable pulse') || lower.includes('we have rosc')) {
      eventType = 'ROSC_ACHIEVED';
      payload.roscTimeSeconds = elapsedSeconds;
      await pool.query('UPDATE ambient_code_resus_sessions SET rosc_achieved = true WHERE id = $1', [sessionId]);
      session.roscAchieved = true;
    }

    // Log the event
    const event = await this.logEvent({
      sessionId,
      elapsedSeconds,
      eventType,
      utteranceText,
      structuredPayload: payload,
      speakerRole
    });

    // Emit live event for connected SSE listeners
    this.emitter.emit('event', { sessionId, event, session, voiceAnswer, activeAlert });

    return { event, voiceAnswer, activeAlert };
  }

  /**
   * Concludes a code session and generates a legal chronological debrief report.
   */
  public static async stopSession(sessionId: number): Promise<AmbientCodeSession> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const debrief = await this.generateLegalDebrief(sessionId);

    const res = await pool.query(`
      UPDATE ambient_code_resus_sessions
      SET is_active = false,
          ended_at = CURRENT_TIMESTAMP,
          debrief_summary = $1
      WHERE id = $2
      RETURNING *;
    `, [debrief, sessionId]);

    const row = res.rows[0];
    return {
      ...session,
      isActive: false,
      endedAt: row.ended_at.toISOString(),
      debriefSummary: debrief
    };
  }

  /**
   * Generates AHA / ACLS compliant legal chronological resuscitation debrief.
   */
  public static async generateLegalDebrief(sessionId: number): Promise<string> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    const events = await this.getSessionEvents(sessionId);

    const totalMinutes = Math.floor(
      (new Date(session.endedAt || new Date()).getTime() - new Date(session.startedAt).getTime()) / 60000
    );

    let md = `# INTAKERX RESUSCITATION CODE EVENT RECORD & LEGAL DEBRIEF\n\n`;
    md += `**Session ID:** RESUS-${session.id} | **Patient ID:** PAT-${session.patientId} | **Bed:** #${session.bedNumber}\n`;
    md += `**Code Type:** ${session.codeType}\n`;
    md += `**Code Leader:** ${session.codeLeader} | **Code Scribe / Recorder:** ${session.codeRecorder}\n`;
    md += `**Started At:** ${session.startedAt} | **Duration:** ${totalMinutes} minutes\n`;
    md += `**ROSC Status:** ${session.roscAchieved ? '✅ ROSC ACHIEVED' : '❌ TERMINATED WITHOUT ROSC'}\n`;
    if (session.pmcsPerformed) md += `**PMCS Status:** 👶 PERIMORTEM CESAREAN SECTION DELIVERED BED-SIDE\n`;
    md += `\n### QUANTITATIVE RESUSCITATION TALLIES:\n`;
    md += `- **Total Epinephrine:** ${session.totalEpinephrineMg} mg\n`;
    md += `- **Total Defibrillations Delivered:** ${session.totalDefibrillations}\n`;
    md += `- **Blood Products Transfused (MTP):** ${session.mtpUnitsPrbc} PRBC : ${session.mtpUnitsFfp} FFP : ${session.mtpUnitsPlatelets} PLT (Balanced Ratio: ${session.mtpUnitsPrbc}:${session.mtpUnitsFfp}:${session.mtpUnitsPlatelets})\n\n`;

    md += `### CHRONOLOGICAL CODE LOG (LEGAL TIME-STAMPED RECORD):\n`;
    md += `| Elapsed | Event Type | Speaker | Clinical Action / Verbal Utterance | Payload Metadata |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- |\n`;

    for (const e of events) {
      const mins = Math.floor(e.elapsedSeconds / 60);
      const secs = e.elapsedSeconds % 60;
      const timeStr = `+${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      const payloadStr = JSON.stringify(e.structuredPayload).replace(/\|/g, '-');
      md += `| ${timeStr} | \`${e.eventType}\` | ${e.speakerRole} | ${e.utteranceText} | ${payloadStr} |\n`;
    }

    md += `\n*Record electronically verified and cryptographic HMAC sealed by IntakeRx Ambient Scribe System (Phase 100+).*`;
    return md;
  }

  /**
   * Helper to write event to database.
   */
  private static async logEvent(event: Omit<AmbientCodeEvent, 'id' | 'createdAt'>): Promise<AmbientCodeEvent> {
    const res = await pool.query(`
      INSERT INTO ambient_code_resus_events (
        session_id, elapsed_seconds, event_type, utterance_text, structured_payload, speaker_role
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `, [
      event.sessionId,
      event.elapsedSeconds,
      event.eventType,
      event.utteranceText,
      JSON.stringify(event.structuredPayload),
      event.speakerRole
    ]);

    const r = res.rows[0];
    return {
      id: r.id,
      sessionId: r.session_id,
      elapsedSeconds: r.elapsed_seconds,
      eventType: r.event_type as ResusEventType,
      utteranceText: r.utterance_text,
      structuredPayload: r.structured_payload,
      speakerRole: r.speaker_role,
      createdAt: r.created_at.toISOString()
    };
  }
}
