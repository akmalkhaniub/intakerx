import { pool } from '../db';

export type DivingDiagnosis = 'DCS_TYPE_I' | 'DCS_TYPE_II' | 'ARTERIAL_GAS_EMBOLISM' | 'CO_POISONING' | 'CLOSTRIDIAL_MYONECROSIS';
export type HyperbaricTable = 'US_NAVY_TABLE_6' | 'US_NAVY_TABLE_5' | 'US_NAVY_TABLE_6A';

export interface EvaluateDivingInput {
  patientId: number;
  diagnosis: DivingDiagnosis;
  diveDepthMsw: number;
  bottomTimeMin: number;
  timeToSymptomOnsetMin: number;
  symptoms: string[];
  rapidAscentReported: boolean;
  spinalDeficitPresent?: boolean;
  alteredMentalStatus?: boolean;
  jointPainOnly?: boolean;
  surfaceOxygenStarted?: boolean;
}

export interface HyperbaricTreatmentResult {
  patientId: number;
  diagnosis: DivingDiagnosis;
  recommendedTable: HyperbaricTable;
  maximumChamberPressureAta: number;
  maximumChamberDepthFsw: number;
  totalChamberDurationMin: number;
  oxygenBreathingPeriodsCount: number;
  airBreaksRequired: boolean;
  surfaceWashoutDirectives: string[];
  flyingBanHours: number;
  clinicalDirectives: string[];
}

export class DivingHyperbaricService {
  /**
   * Evaluates diving decompression illness and assigns evidence-based US Navy Hyperbaric Treatment Protocol.
   */
  public static evaluateDivingIllness(input: EvaluateDivingInput): HyperbaricTreatmentResult {
    let table: HyperbaricTable = 'US_NAVY_TABLE_6';
    let maxAta = 2.8;
    let maxFsw = 60;
    let durationMin = 285;
    let o2Periods = 3;
    let flyingBan = 72;
    const directives: string[] = [];
    const surfaceWashout: string[] = [];

    // Surface Washout Protocol
    if (!input.surfaceOxygenStarted) {
      surfaceWashout.push('STAT: Initiate 100% Normobaric Oxygen via tight-fitting reservoir mask (15 L/min) immediately. Do not delay while awaiting chamber mobilization.');
    } else {
      surfaceWashout.push('Surface 100% Oxygen active. Continue continuous pre-chamber nitrogen washout.');
    }

    // Protocol Determination
    if (input.diagnosis === 'ARTERIAL_GAS_EMBOLISM') {
      table = 'US_NAVY_TABLE_6';
      maxAta = 2.8;
      maxFsw = 60;
      durationMin = 285;
      o2Periods = 3;
      flyingBan = 72;
      directives.push('Arterial Gas Embolism (AGE): Pressurize immediately to 60 fsw (2.8 ATA) on 100% O2. If symptoms worsen on initial descent, consider Table 6A (165 fsw / 6 ATA air compression).');
      directives.push('Administer IV isotonic crystalloids (Normal Saline or Plasmalyte) to prevent hemoconcentration and microvascular sludging.');
    } else if (input.diagnosis === 'DCS_TYPE_II' || input.spinalDeficitPresent || input.alteredMentalStatus) {
      table = 'US_NAVY_TABLE_6';
      maxAta = 2.8;
      maxFsw = 60;
      durationMin = 285;
      o2Periods = 3;
      flyingBan = 72;
      directives.push('Decompression Sickness Type II (Neurologic/Spinal): US Navy Treatment Table 6 mandatory. Administer three 20-minute 100% O2 periods at 60 fsw with 5-minute air breaks.');
      directives.push('Serial neurologic evaluations mandatory every 15 minutes during chamber treatment.');
    } else if (input.diagnosis === 'DCS_TYPE_I' && input.jointPainOnly) {
      if (input.timeToSymptomOnsetMin > 10) {
        table = 'US_NAVY_TABLE_5';
        maxAta = 2.8;
        maxFsw = 60;
        durationMin = 135;
        o2Periods = 2;
        flyingBan = 24;
        directives.push('Decompression Sickness Type I (Pain-Only Bends): US Navy Table 5 indicated IF symptoms resolve completely within first 10 minutes at 60 fsw.');
        directives.push('If pain persists beyond 10 minutes at 60 fsw, immediately escalate to Table 6.');
      } else {
        table = 'US_NAVY_TABLE_6';
        durationMin = 285;
        directives.push('Rapid-onset DCS Type I (< 10 min from surfacing): High risk of concealed spinal bubble burden. Treat aggressively with US Navy Table 6.');
      }
    }

    directives.push(`Strict Flying After Diving Ban: No commercial air travel or altitude exposure above 1,000 ft for minimum ${flyingBan} hours post-treatment.`);

    return {
      patientId: input.patientId,
      diagnosis: input.diagnosis,
      recommendedTable: table,
      maximumChamberPressureAta: maxAta,
      maximumChamberDepthFsw: maxFsw,
      totalChamberDurationMin: durationMin,
      oxygenBreathingPeriodsCount: o2Periods,
      airBreaksRequired: true,
      surfaceWashoutDirectives: surfaceWashout,
      flyingBanHours: flyingBan,
      clinicalDirectives: directives
    };
  }

  /**
   * Evaluates diving illness and persists session to database.
   */
  public static async evaluateAndPersist(input: EvaluateDivingInput): Promise<HyperbaricTreatmentResult> {
    const res = this.evaluateDivingIllness(input);

    await pool.query(`
      INSERT INTO hyperbaric_sessions (
        patient_id, diagnosis, dive_depth_msw, bottom_time_min, time_to_symptom_onset_min,
        recommended_table, total_chamber_duration_min, maximum_chamber_ata,
        oxygen_breathing_periods, flying_ban_hours, treatment_protocol
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);
    `, [
      input.patientId,
      input.diagnosis,
      input.diveDepthMsw,
      input.bottomTimeMin,
      input.timeToSymptomOnsetMin,
      res.recommendedTable,
      res.totalChamberDurationMin,
      res.maximumChamberPressureAta,
      res.oxygenBreathingPeriodsCount,
      res.flyingBanHours,
      JSON.stringify(res.clinicalDirectives)
    ]);

    return res;
  }
}
