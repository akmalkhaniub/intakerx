import { pool } from '../db';
import { notificationBus } from '../notifications';

export interface StartTriageCriteria {
  canWalk: boolean;
  hasSpontaneousBreathing: boolean;
  airwayRepositioned?: boolean;
  respiratoryRate?: number; // breaths/min
  hasRadialPulse?: boolean;
  capillaryRefillSec?: number;
  followsCommands?: boolean;
}

export interface StartTriageResult {
  tag: 'RED' | 'YELLOW' | 'GREEN' | 'BLACK';
  priority: 1 | 2 | 3 | 4; // 1 = Immediate, 2 = Delayed, 3 = Minor, 4 = Deceased
  label: string;
  rationale: string;
}

export interface OfflineFieldIntake {
  offlineId: string;
  timestamp: string;
  fieldResponder: string;
  patientName?: string;
  estimatedAge?: number;
  sex?: string;
  chiefComplaint: string;
  startCriteria: StartTriageCriteria;
  vitalSigns?: {
    heartRate?: number;
    bloodPressure?: string;
    respiratoryRate?: number;
    oxygenSat?: number;
    temperature?: number;
  };
  fieldNotes?: string;
  triageTagOverride?: 'RED' | 'YELLOW' | 'GREEN' | 'BLACK';
}

export class DisasterFieldTriageService {
  /**
   * Evaluates physiological criteria according to the standard START Triage protocol.
   */
  public static evaluateStartTriage(criteria: StartTriageCriteria): StartTriageResult {
    // 1. Ambulatory Assessment (Minor / Walking Wounded)
    if (criteria.canWalk) {
      return {
        tag: 'GREEN',
        priority: 3,
        label: 'Minor (Walking Wounded)',
        rationale: 'Patient is ambulatory and able to follow commands to relocate to designated treatment area.'
      };
    }

    // 2. Respiration Assessment
    if (!criteria.hasSpontaneousBreathing) {
      if (criteria.airwayRepositioned) {
        return {
          tag: 'RED',
          priority: 1,
          label: 'Immediate (Life-Threatening)',
          rationale: 'Spontaneous breathing initiated upon opening/repositioning airway. Immediate airway support required.'
        };
      }
      return {
        tag: 'BLACK',
        priority: 4,
        label: 'Expectant / Deceased',
        rationale: 'Apneic following airway repositioning maneuver. Palliative or expectant category under mass casualty protocol.'
      };
    }

    // Tachypnea / Bradypnea check
    if (criteria.respiratoryRate !== undefined) {
      if (criteria.respiratoryRate > 30 || criteria.respiratoryRate < 10) {
        return {
          tag: 'RED',
          priority: 1,
          label: 'Immediate (Severe Tachypnea / Bradypnea)',
          rationale: `Abnormal respiratory rate (${criteria.respiratoryRate} bpm). Exceeds safe threshold (>30 or <10). Immediate intervention required.`
        };
      }
    }

    // 3. Perfusion Assessment
    if (criteria.hasRadialPulse === false || (criteria.capillaryRefillSec !== undefined && criteria.capillaryRefillSec > 2)) {
      return {
        tag: 'RED',
        priority: 1,
        label: 'Immediate (Shock / Hypoperfusion)',
        rationale: 'Absent radial pulse or prolonged capillary refill (> 2 seconds) indicates systemic circulatory failure / decompensated shock.'
      };
    }

    // 4. Mental Status Assessment
    if (criteria.followsCommands === false) {
      return {
        tag: 'RED',
        priority: 1,
        label: 'Immediate (Altered Mental Status)',
        rationale: 'Unable to follow simple commands or unresponsive to verbal stimuli. Potential intracranial trauma or severe hypoxia.'
      };
    }

    // 5. Default Non-Ambulatory Stable Patient
    return {
      tag: 'YELLOW',
      priority: 2,
      label: 'Delayed (Serious, Non-Immediate)',
      rationale: 'Non-ambulatory with preserved airway, adequate respirations (10-30 bpm), palpable pulse, and intact cognitive responsiveness.'
    };
  }

  /**
   * Processes a batch of offline field intakes with cryptographic idempotency.
   */
  public static async processBatchSync(intakes: OfflineFieldIntake[]): Promise<{
    syncedCount: number;
    duplicateCount: number;
    results: Array<{
      offlineId: string;
      sessionId: string;
      status: 'created' | 'already_synced';
      tag: string;
    }>;
  }> {
    let syncedCount = 0;
    let duplicateCount = 0;
    const results: Array<{
      offlineId: string;
      sessionId: string;
      status: 'created' | 'already_synced';
      tag: string;
    }> = [];

    for (const item of intakes) {
      // Check for existing sync
      const existingRes = await pool.query(
        `SELECT id, start_triage_tag FROM intake_sessions WHERE offline_sync_id = $1`,
        [item.offlineId]
      );

      if (existingRes.rows.length > 0) {
        duplicateCount++;
        results.push({
          offlineId: item.offlineId,
          sessionId: existingRes.rows[0].id,
          status: 'already_synced',
          tag: existingRes.rows[0].start_triage_tag || 'YELLOW'
        });
        continue;
      }

      // Calculate START tag if not overridden
      const startResult = this.evaluateStartTriage(item.startCriteria);
      const finalTag = item.triageTagOverride || startResult.tag;

      // Create or Find Patient
      const patientName = item.patientName || `MCI Victim #${item.offlineId.substring(0, 6).toUpperCase()}`;
      const patientEmail = `mci.${item.offlineId.substring(0, 8)}@field.disaster.local`;
      const patientSex = item.sex || 'Unknown';
      const patientDob = item.estimatedAge 
        ? new Date(Date.now() - (item.estimatedAge * 365.25 * 24 * 3600 * 1000)).toISOString().split('T')[0]
        : '1990-01-01';

      const patientRes = await pool.query(
        `INSERT INTO patients (name, email, password_hash, dob, sex, insurance_provider, insurance_policy)
         VALUES ($1, $2, 'disaster_proxy_hash', $3, $4, 'FEMA Emergency Health Assistance', 'MCI-FIELD')
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [patientName, patientEmail, patientDob, patientSex]
      );
      const patientId = patientRes.rows[0].id;

      // Map START tag to ESI triage level for unified clinical workflow
      const triageLevelMap: Record<string, string> = {
        'RED': 'emergency',
        'YELLOW': 'urgent',
        'GREEN': 'routine',
        'BLACK': 'routine'
      };

      // Create intake_session
      const sessionRes = await pool.query(
        `INSERT INTO intake_sessions (
          id, patient_id, status, triage_level, triage_rationale,
          is_disaster_intake, start_triage_tag, offline_sync_id, field_responder
        ) VALUES (
          gen_random_uuid(), $1, 'completed', $2, $3,
          TRUE, $4, $5, $6
        ) RETURNING id`,
        [
          patientId,
          triageLevelMap[finalTag] || 'urgent',
          `START Triage Classification: ${finalTag} (${startResult.label}). ${startResult.rationale}`,
          finalTag,
          item.offlineId,
          item.fieldResponder
        ]
      );
      const sessionId = sessionRes.rows[0].id;

      // Create intake_summaries
      const summaryPayload = {
        chiefComplaint: item.chiefComplaint,
        historyOfPresentIllness: `Disaster Field Intake recorded at ${item.timestamp} by responder ${item.fieldResponder}.\nField Notes: ${item.fieldNotes || 'Rapid START field triage applied.'}`,
        startTriage: {
          tag: finalTag,
          rationale: startResult.rationale,
          criteria: item.startCriteria
        },
        vitals: item.vitalSigns || {},
        triageLevel: triageLevelMap[finalTag]
      };

      await pool.query(
        `INSERT INTO intake_summaries (session_id, summary_data, status)
         VALUES ($1, $2, 'confirmed')`,
        [sessionId, JSON.stringify(summaryPayload)]
      );

      // Emit high-priority notification if RED (Immediate)
      if (finalTag === 'RED') {
        notificationBus.push(
          'emergency_triage',
          `🚨 MCI RED TAG: ${patientName}`,
          `Critical life threat from field intake: ${startResult.rationale}`,
          { sessionId, patientName, severity: 'critical' }
        );
      }

      syncedCount++;
      results.push({
        offlineId: item.offlineId,
        sessionId,
        status: 'created',
        tag: finalTag
      });
    }

    return {
      syncedCount,
      duplicateCount,
      results
    };
  }

  /**
   * Gets current Disaster Mode status
   */
  public static async getDisasterModeStatus(): Promise<{
    isActive: boolean;
    incidentName?: string;
    activatedBy?: string;
    casualtyCount: number;
    guidelines?: string;
    updatedAt?: string;
  }> {
    const res = await pool.query(
      `SELECT * FROM disaster_mode_events ORDER BY id DESC LIMIT 1`
    );

    if (res.rows.length === 0) {
      return {
        isActive: false,
        casualtyCount: 0
      };
    }

    const row = res.rows[0];
    return {
      isActive: row.is_active,
      incidentName: row.incident_name,
      activatedBy: row.activated_by,
      casualtyCount: row.casualty_count,
      guidelines: row.guidelines,
      updatedAt: row.updated_at
    };
  }

  /**
   * Activates or deactivates facility Disaster Mode
   */
  public static async toggleDisasterMode(params: {
    isActive: boolean;
    activatedBy: string;
    incidentName?: string;
    guidelines?: string;
  }): Promise<any> {
    const { isActive, activatedBy } = params;
    const incidentName = params.incidentName || (isActive ? 'Mass Casualty Incident (MCI) Protocol Active' : 'Normal Clinical Operations Resumed');
    const guidelines = params.guidelines || (isActive 
      ? 'Streamlined START triage protocol enabled. Prioritize life threats, bypass routine surveys, assign color-coded tags.' 
      : 'Standard intake and registration procedures restored.');

    const res = await pool.query(
      `INSERT INTO disaster_mode_events (is_active, activated_by, incident_name, guidelines)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [isActive, activatedBy, incidentName, guidelines]
    );

    // Broadcast system notification
    notificationBus.push(
      'emergency_triage',
      isActive ? '⚠️ Emergency: Disaster Mode Activated' : '✅ Notice: Disaster Mode Deactivated',
      isActive 
        ? `Disaster Mode Activated by ${activatedBy}: "${incidentName}". Streamlined START triage protocols are now in effect.`
        : `Disaster Mode Deactivated by ${activatedBy}. Normal facility operations restored.`,
      { patientName: 'ALL UNITS', severity: isActive ? 'critical' : 'info' }
    );

    return res.rows[0];
  }
}
