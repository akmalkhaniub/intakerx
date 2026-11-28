import { query } from '../db';

export interface VentilatorAsynchronyInput {
  patientId: number;
  totalBreathsAnalyzed: number;
  reverseTriggeringEvents: number;
  doubleTriggeringEvents: number;
  ineffectiveTriggeringEvents: number;
  ventilatorSetRateBpm: number;
  measuredPatientRateBpm: number;
  intrinsicPeepCmH2O: number;
  inspiratoryTimeSec: number;
  patientOnNeuromuscularBlockade: boolean;
}

export interface VentilatorAsynchronyResult {
  id?: number;
  patientId: number;
  asynchronyIndexPct: number;
  asynchronySeverityTier: 'OPTIMAL_SYNCHRONY' | 'MODERATE_ASYNCHRONY' | 'SEVERE_DYSYNCHRONY_CRISIS';
  reverseTriggeringDetected: boolean;
  doubleTriggeringDetected: boolean;
  ineffectiveTriggeringDetected: boolean;
  breathStackingVolutraumaRisk: 'LOW' | 'ELEVATED' | 'CRITICAL_VOLUTRAUMA';
  neuromuscularBlockadeIndicated: boolean;
  ventilatorDirectives: string[];
}

export class VentilatorAsynchronyService {
  public static evaluateAsynchrony(input: VentilatorAsynchronyInput): VentilatorAsynchronyResult {
    const directives: string[] = [];

    const totalEvents = input.reverseTriggeringEvents + input.doubleTriggeringEvents + input.ineffectiveTriggeringEvents;
    const asynchronyIndexPct = input.totalBreathsAnalyzed > 0
      ? Number(((totalEvents / input.totalBreathsAnalyzed) * 100).toFixed(1))
      : 0;

    let asynchronySeverityTier: VentilatorAsynchronyResult['asynchronySeverityTier'] = 'OPTIMAL_SYNCHRONY';
    if (asynchronyIndexPct >= 20.0) {
      asynchronySeverityTier = 'SEVERE_DYSYNCHRONY_CRISIS';
    } else if (asynchronyIndexPct >= 10.0) {
      asynchronySeverityTier = 'MODERATE_ASYNCHRONY';
    }

    const reverseTriggeringDetected = input.reverseTriggeringEvents >= 3;
    const doubleTriggeringDetected = input.doubleTriggeringEvents >= 3;
    const ineffectiveTriggeringDetected = input.ineffectiveTriggeringEvents >= 5;

    let breathStackingVolutraumaRisk: VentilatorAsynchronyResult['breathStackingVolutraumaRisk'] = 'LOW';
    if (reverseTriggeringDetected || doubleTriggeringDetected) {
      breathStackingVolutraumaRisk = asynchronyIndexPct >= 15.0 ? 'CRITICAL_VOLUTRAUMA' : 'ELEVATED';
      directives.push(
        `OCCULT VOLUTRAUMA RISK (${breathStackingVolutraumaRisk}): Breath-stacking generates transpulmonary pressure spikes and delivers double tidal volume (up to 12-16 mL/kg PBW), negating lung-protective ventilation.`
      );
    }

    if (reverseTriggeringDetected) {
      directives.push(
        'REVERSE TRIGGERING (Entrainment Dyssynchrony): Mandatory breath triggers diaphragmatic contraction late in inflation. Titrate sedation or adjust respiratory rate; if refractory, brief cisatracurium neuromuscular blockade recommended to abolish diaphragmatic entrainment.'
      );
    }

    if (doubleTriggeringDetected) {
      directives.push(
        `DOUBLE TRIGGERING (Patient Hunger / Short Ti): Inspiratory time (${input.inspiratoryTimeSec}s) is shorter than neural inspiratory time. Lengthen Ti or increase flow/pressure support.`
      );
    }

    if (ineffectiveTriggeringDetected) {
      directives.push(
        `INEFFECTIVE TRIGGERING (Intrinsic PEEP ${input.intrinsicPeepCmH2O} cmH2O): Patient effort cannot overcome intrinsic auto-PEEP threshold. Set extrinsic PEEP to 80% of auto-PEEP and optimize flow trigger sensitivity.`
      );
    }

    const neuromuscularBlockadeIndicated =
      !input.patientOnNeuromuscularBlockade &&
      (asynchronySeverityTier === 'SEVERE_DYSYNCHRONY_CRISIS' || breathStackingVolutraumaRisk === 'CRITICAL_VOLUTRAUMA');

    if (neuromuscularBlockadeIndicated) {
      directives.push(
        'NEUROMUSCULAR BLOCKADE INDICATION: High asynchrony index with refractory breath-stacking in ARDS. Initiate Cisatracurium continuous infusion (ROSE trial protocol / 48h limit) under deep sedation.'
      );
    }

    return {
      patientId: input.patientId,
      asynchronyIndexPct,
      asynchronySeverityTier,
      reverseTriggeringDetected,
      doubleTriggeringDetected,
      ineffectiveTriggeringDetected,
      breathStackingVolutraumaRisk,
      neuromuscularBlockadeIndicated,
      ventilatorDirectives: directives
    };
  }

  public static async recordEvaluation(input: VentilatorAsynchronyInput): Promise<VentilatorAsynchronyResult> {
    const result = this.evaluateAsynchrony(input);

    const res = await query(
      `INSERT INTO ventilator_asynchrony_evals (
        patient_id, asynchrony_index_pct, reverse_triggering_detected,
        double_triggering_detected, ineffective_triggering_detected,
        breath_stacking_volutrauma_risk, neuromuscular_blockade_indicated, eval_output
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id`,
      [
        input.patientId,
        result.asynchronyIndexPct,
        result.reverseTriggeringDetected,
        result.doubleTriggeringDetected,
        result.ineffectiveTriggeringDetected,
        result.breathStackingVolutraumaRisk,
        result.neuromuscularBlockadeIndicated,
        JSON.stringify(result)
      ]
    );

    result.id = res.rows[0].id;
    return result;
  }
}
