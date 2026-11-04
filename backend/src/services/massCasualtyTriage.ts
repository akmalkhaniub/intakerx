import { pool } from '../db';

export type TriageCategory = 'RED_IMMEDIATE' | 'YELLOW_DELAYED' | 'GREEN_MINIMAL' | 'BLACK_EXPECTANT';
export type TriageSystem = 'SALT' | 'START' | 'JUMPSTART';

export interface EvaluateTriageInput {
  incidentId: string;
  casualtyNumber: number;
  triageSystem?: TriageSystem;
  ageGroup?: 'ADULT' | 'PEDIATRIC' | 'GERIATRIC';
  canWalk: boolean;
  canWaveOrPurposefulMovement?: boolean;
  spontaneousBreathing: boolean;
  respiratoryRate?: number;
  radialPulsePresent: boolean;
  obeysCommands: boolean;
  majorHemorrhageControlled?: boolean;
  hasChestDecompressionNeeded?: boolean;
  assignedDestination?: string;
}

export interface TriageEvaluationResult {
  incidentId: string;
  casualtyNumber: number;
  triageCategory: TriageCategory;
  triageSystem: TriageSystem;
  priorityRank: number; // 1 = Immediate (Red), 2 = Delayed (Yellow), 3 = Minimal (Green), 4 = Expectant (Black)
  colorCode: string;
  clinicalRationale: string;
  lifeSavingInterventions: string[];
  evacuationPriority: string;
  transportDestination: string;
}

export interface IcsMciIncidentSummary {
  incidentId: string;
  totalCasualties: number;
  categoryBreakdown: {
    RED_IMMEDIATE: number;
    YELLOW_DELAYED: number;
    GREEN_MINIMAL: number;
    BLACK_EXPECTANT: number;
  };
  immediateEvacPercentage: number;
  surgeRecommendation: string;
}

export class MassCasualtyTriageService {
  /**
   * Evaluates casualty using standard SALT / START triage algorithm.
   */
  public static evaluateCasualty(input: EvaluateTriageInput): TriageEvaluationResult {
    const system = input.triageSystem || 'SALT';
    const lifeSavingInterventions: string[] = [];

    let category: TriageCategory = 'YELLOW_DELAYED';
    let rationale = '';

    // Step 1: Global Sorting (Can they walk?)
    if (input.canWalk) {
      category = 'GREEN_MINIMAL';
      rationale = 'Able to walk and follow commands. Ambulatory walking wounded (SALT Step 1 / START Minor).';
    } else {
      // Step 2: Individual Assessment & Lifesaving Interventions (LSI)
      if (input.majorHemorrhageControlled === false) {
        lifeSavingInterventions.push('Immediate extremity tourniquet or hemostatic wound packing');
      }
      if (input.hasChestDecompressionNeeded) {
        lifeSavingInterventions.push('Bedside needle thoracostomy (2nd intercostal space MCL or 5th anterior axillary)');
      }

      // Check Breathing
      if (!input.spontaneousBreathing) {
        if (input.ageGroup === 'PEDIATRIC') {
          lifeSavingInterventions.push('5 rescue breaths delivered with pediatric pocket mask');
        }
        category = 'BLACK_EXPECTANT';
        rationale = 'Apneic following airway repositioning. Deceased or expectant under austere triage conditions.';
      } else {
        // Breathing is present - evaluate physiological stability
        const rr = input.respiratoryRate ?? 20;
        const abnormalRespiration = rr < 10 || rr > 30;
        const absentPulse = !input.radialPulsePresent;
        const unableToObey = !input.obeysCommands;

        if (abnormalRespiration || absentPulse || unableToObey) {
          category = 'RED_IMMEDIATE';
          const triggers: string[] = [];
          if (abnormalRespiration) triggers.push(`Tachypneic/Bradypneic (RR ${rr}/min)`);
          if (absentPulse) triggers.push('Absent radial pulse / uncompensated shock');
          if (unableToObey) triggers.push('Altered mental status / unable to follow simple commands');
          rationale = `Immediate surgical/critical care required: ${triggers.join(', ')}.`;
        } else {
          category = 'YELLOW_DELAYED';
          rationale = 'Respirations, perfusion, and mental status are preserved. Serious injury present but stable for delayed transport.';
        }
      }
    }

    const priorityRank = category === 'RED_IMMEDIATE' ? 1
      : category === 'YELLOW_DELAYED' ? 2
      : category === 'GREEN_MINIMAL' ? 3 : 4;

    const colorCode = category === 'RED_IMMEDIATE' ? '#ef4444'
      : category === 'YELLOW_DELAYED' ? '#f59e0b'
      : category === 'GREEN_MINIMAL' ? '#10b981' : '#1e293b';

    const evacuationPriority = category === 'RED_IMMEDIATE' ? 'PRIORITY 1: IMMEDIATE ROTARY / ALS EVAC'
      : category === 'YELLOW_DELAYED' ? 'PRIORITY 2: SECONDARY AMBULANCE TRANSPORT'
      : category === 'GREEN_MINIMAL' ? 'PRIORITY 3: AUSTERE BUS / MINIMAL CARE STAGING' : 'PRIORITY 4: EXPECTANT MORGUE STAGING';

    const transportDestination = input.assignedDestination || (
      category === 'RED_IMMEDIATE' ? 'Level 1 Trauma Center / ICU Resuscitation Bay'
      : category === 'YELLOW_DELAYED' ? 'Regional Community Hospital / Stepdown Unit'
      : category === 'GREEN_MINIMAL' ? 'Urgent Care Center / Alternate Care Facility' : 'On-Scene Temporary Morgue'
    );

    return {
      incidentId: input.incidentId,
      casualtyNumber: input.casualtyNumber,
      triageCategory: category,
      triageSystem: system,
      priorityRank,
      colorCode,
      clinicalRationale: rationale,
      lifeSavingInterventions,
      evacuationPriority,
      transportDestination
    };
  }

  /**
   * Evaluates casualty and persists to database.
   */
  public static async triageAndPersist(input: EvaluateTriageInput): Promise<TriageEvaluationResult> {
    const result = this.evaluateCasualty(input);

    await pool.query(`
      INSERT INTO mci_triage_events (
        incident_id, casualty_number, triage_category, triage_system, age_group,
        can_walk, spontaneous_breathing, respiratory_rate, radial_pulse_present,
        obeys_commands, life_saving_interventions_applied, assigned_destination
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);
    `, [
      input.incidentId,
      input.casualtyNumber,
      result.triageCategory,
      result.triageSystem,
      input.ageGroup || 'ADULT',
      input.canWalk,
      input.spontaneousBreathing,
      input.respiratoryRate ?? null,
      input.radialPulsePresent,
      input.obeysCommands,
      JSON.stringify(result.lifeSavingInterventions),
      result.transportDestination
    ]);

    return result;
  }

  /**
   * Retrieves ICS Incident Command System Summary across all casualties in an event.
   */
  public static async getIncidentSummary(incidentId: string): Promise<IcsMciIncidentSummary> {
    const res = await pool.query(
      'SELECT triage_category, COUNT(*) as count FROM mci_triage_events WHERE incident_id = $1 GROUP BY triage_category;',
      [incidentId]
    );

    const breakdown = {
      RED_IMMEDIATE: 0,
      YELLOW_DELAYED: 0,
      GREEN_MINIMAL: 0,
      BLACK_EXPECTANT: 0
    };

    let total = 0;
    for (const row of res.rows) {
      const cat = row.triage_category as TriageCategory;
      const count = parseInt(row.count, 10);
      if (breakdown[cat] !== undefined) {
        breakdown[cat] = count;
      }
      total += count;
    }

    const immediatePct = total > 0 ? Number(((breakdown.RED_IMMEDIATE / total) * 100).toFixed(1)) : 0;

    let surgeRecommendation = 'NORMAL SURGE: Standard regional hospital distribution.';
    if (immediatePct >= 30.0 || breakdown.RED_IMMEDIATE >= 5) {
      surgeRecommendation = 'CRITICAL CODE RED SURGE: Activate Regional Disaster Medical Advisory Committee (DMAC) & Disaster Mesh Routing.';
    } else if (immediatePct >= 15.0) {
      surgeRecommendation = 'ELEVATED SURGE: Divert non-critical patients to Alternate Care Facilities.';
    }

    return {
      incidentId,
      totalCasualties: total,
      categoryBreakdown: breakdown,
      immediateEvacPercentage: immediatePct,
      surgeRecommendation
    };
  }
}
