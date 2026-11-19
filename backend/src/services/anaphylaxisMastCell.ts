import { query } from '../db';

export interface AnaphylaxisMastCellInput {
  patientId: number;
  suspectedTrigger: string; // e.g. "Rocuronium", "Cefazolin", "Latex", "Chlorhexidine"
  cutaneousSignsPresent: boolean;
  systolicBpMmhg: number;
  heartRateBpm: number;
  bronchospasmOrStridor: boolean;
  cardiacArrestPresent: boolean;
  patientOnBetaBlocker: boolean;
  epinephrineDosesGivenCount: number;
  totalEpinephrineMgGiven: number;
  shockPersistsAfterEpinephrine: boolean;
  measuredTryptaseUgL?: number;
  baselineTryptaseUgL?: number;
}

export interface AnaphylaxisMastCellResult {
  id?: number;
  patientId: number;
  ringMessmerGrade: 'Grade I' | 'Grade II' | 'Grade III' | 'Grade IV';
  suspectedTrigger: string;
  refractoryShock: boolean;
  firstLineEpinephrineRecommendation: string;
  glucagonIndicated: boolean;
  methyleneBlueIndicated: boolean;
  sugammadexIndicated: boolean;
  tryptaseSchedule: string[];
  anaphylaxisDirectives: string[];
}

export class AnaphylaxisMastCellService {
  public static evaluateAnaphylaxis(input: AnaphylaxisMastCellInput): AnaphylaxisMastCellResult {
    const directives: string[] = [];

    // 1. Ring and Messmer Clinical Grading
    let ringMessmerGrade: AnaphylaxisMastCellResult['ringMessmerGrade'] = 'Grade I';
    if (input.cardiacArrestPresent) {
      ringMessmerGrade = 'Grade IV';
    } else if (input.systolicBpMmhg < 70 || (input.bronchospasmOrStridor && input.systolicBpMmhg < 90)) {
      ringMessmerGrade = 'Grade III';
    } else if (input.systolicBpMmhg < 90 || input.bronchospasmOrStridor || input.heartRateBpm > 120) {
      ringMessmerGrade = 'Grade II';
    } else {
      ringMessmerGrade = 'Grade I';
    }

    // 2. Epinephrine Directives
    let epiRec = '';
    if (ringMessmerGrade === 'Grade IV') {
      epiRec = 'ACLS Epinephrine: 1 mg IV push q3-5min, initiate CPR, advance airway.';
      directives.push(epiRec);
    } else if (ringMessmerGrade === 'Grade III') {
      epiRec =
        'STAT Epinephrine IV bolus 50 - 100 mcg (0.05-0.1 mg) IV q1-2min titrated to MAP > 65 mmHg; initiate continuous infusion at 0.05 - 0.5 mcg/kg/min immediately.';
      directives.push(epiRec);
    } else if (ringMessmerGrade === 'Grade II') {
      epiRec = 'Epinephrine 0.3 - 0.5 mg IM into anterolateral thigh, or 10 - 20 mcg IV bolus aliquots.';
      directives.push(epiRec);
    } else {
      epiRec = 'Monitor airway closely; administer H1-antihistamine (Diphenhydramine 50 mg IV) and corticosteroid (Methylprednisolone 125 mg IV).';
      directives.push(epiRec);
    }

    // 3. Refractory Shock Determination
    const refractoryShock =
      (ringMessmerGrade === 'Grade III' || ringMessmerGrade === 'Grade IV') &&
      input.epinephrineDosesGivenCount >= 3 &&
      input.shockPersistsAfterEpinephrine;

    // 4. Targeted Rescue Adjuncts
    let glucagonIndicated = false;
    let methyleneBlueIndicated = false;
    let sugammadexIndicated = false;

    if (input.patientOnBetaBlocker && (ringMessmerGrade === 'Grade III' || ringMessmerGrade === 'Grade IV' || refractoryShock)) {
      glucagonIndicated = true;
      directives.push(
        'BETA-BLOCKER RESCUE INDICATION: Glucagon 1 - 5 mg IV slow push over 5 minutes, followed by continuous infusion at 5 - 15 mcg/min (activates myocardial adenylate cyclase independently of beta-adrenergic receptors).'
      );
    }

    if (refractoryShock) {
      methyleneBlueIndicated = true;
      directives.push(
        'REFRACTORY VASOPLEGIC ANAPHYLAXIS: Methylene Blue 1.5 - 2.0 mg/kg IV infused over 20-30 minutes (direct inhibition of inducible nitric oxide synthase and soluble guanylyl cyclase).'
      );
    }

    const triggerLower = input.suspectedTrigger.toLowerCase();
    if (triggerLower.includes('rocuronium') || triggerLower.includes('vecuronium')) {
      sugammadexIndicated = true;
      directives.push(
        `NEUROMUSCULAR BLOCKER INDUCED ANAPHYLAXIS (${input.suspectedTrigger}): STAT Sugammadex 16 mg/kg IV push for chemical encapsulation of circulating steroidal neuromuscular relaxant molecules.`
      );
    }

    // 5. Serial Mast Cell Tryptase Timing Protocol
    const tryptaseSchedule = [
      'Sample 1 (Acute Peak): Draw serum SST tube STAT (within 30 - 120 minutes of shock onset).',
      'Sample 2 (Clearance Kinetics): Draw second serum sample at 4 - 6 hours post-event.',
      'Sample 3 (True Baseline): Draw convalescent sample at >= 24 hours post-resuscitation.'
    ];

    if (input.measuredTryptaseUgL !== undefined && input.baselineTryptaseUgL !== undefined) {
      const threshold = 1.2 * input.baselineTryptaseUgL + 2.0;
      if (input.measuredTryptaseUgL > threshold) {
        directives.push(
          `LAB CONFIRMATION: Peak serum tryptase (${input.measuredTryptaseUgL} µg/L) exceeds diagnostic threshold (${threshold.toFixed(
            1
          )} µg/L = 1.2 * baseline + 2.0), confirming systemic mast cell degranulation.`
        );
      }
    }

    return {
      patientId: input.patientId,
      ringMessmerGrade,
      suspectedTrigger: input.suspectedTrigger,
      refractoryShock,
      firstLineEpinephrineRecommendation: epiRec,
      glucagonIndicated,
      methyleneBlueIndicated,
      sugammadexIndicated,
      tryptaseSchedule,
      anaphylaxisDirectives: directives
    };
  }

  public static async recordEvaluation(input: AnaphylaxisMastCellInput): Promise<AnaphylaxisMastCellResult> {
    const result = this.evaluateAnaphylaxis(input);

    const res = await query(
      `INSERT INTO anaphylaxis_mast_cell_events (
        patient_id, ring_messmer_grade, suspected_trigger, epinephrine_total_dose_mg,
        refractory_shock, glucagon_indicated, methylene_blue_indicated,
        sugammadex_indicated, peak_tryptase_ug_l, eval_output
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id`,
      [
        input.patientId,
        result.ringMessmerGrade,
        input.suspectedTrigger,
        input.totalEpinephrineMgGiven,
        result.refractoryShock,
        result.glucagonIndicated,
        result.methyleneBlueIndicated,
        result.sugammadexIndicated,
        input.measuredTryptaseUgL || null,
        JSON.stringify(result)
      ]
    );

    result.id = res.rows[0].id;
    return result;
  }
}
