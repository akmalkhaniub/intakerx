import { query } from '../db';

export interface EcmoRecirculationInput {
  patientId: number;
  ecmoMode: 'VV_ECMO' | 'VA_ECMO' | 'VAV_ECMO';
  preOxygenatorSatPct?: number; // SpreO2 (e.g. 84%)
  postOxygenatorSatPct?: number; // SpostO2 (e.g. 99%)
  mixedVenousSatPct?: number; // SvO2 (e.g. 68%)
  rightRadialSpo2Pct?: number; // e.g. 78% in Harlequin
  femoralArterialSpo2Pct?: number; // e.g. 98% in peripheral VA ECMO
  sweepGasFlowLpm: number;
  pumpFlowLpm: number;
  nativeLungTidalVolumeMl: number;
}

export interface EcmoRecirculationResult {
  id?: number;
  patientId: number;
  ecmoMode: string;
  recirculationFractionPct?: number;
  recirculationRiskTier: 'ACCEPTABLE_FLOW' | 'MODERATE_RECIRCULATION' | 'SEVERE_RECIRCULATION' | 'HARLEQUIN_SYNDROME_CRITICAL' | 'NORMAL_PERFUSION';
  differentialHypoxemiaPresent: boolean;
  radialToFemoralGradientPct?: number;
  ecmoDirectives: string[];
}

export class EcmoRecirculationService {
  public static evaluateEcmo(input: EcmoRecirculationInput): EcmoRecirculationResult {
    const directives: string[] = [];
    let recirculationFractionPct: number | undefined = undefined;
    let differentialHypoxemiaPresent = false;
    let radialToFemoralGradientPct: number | undefined = undefined;
    let recirculationRiskTier: EcmoRecirculationResult['recirculationRiskTier'] = 'NORMAL_PERFUSION';

    if (input.ecmoMode === 'VV_ECMO') {
      // Recirculation Fraction = (SpreO2 - SvO2) / (SpostO2 - SvO2) * 100%
      if (input.preOxygenatorSatPct && input.postOxygenatorSatPct && input.mixedVenousSatPct) {
        const numerator = input.preOxygenatorSatPct - input.mixedVenousSatPct;
        const denominator = input.postOxygenatorSatPct - input.mixedVenousSatPct;
        if (denominator > 0) {
          recirculationFractionPct = Number(((numerator / denominator) * 100).toFixed(1));
        }
      }

      if (recirculationFractionPct !== undefined) {
        if (recirculationFractionPct >= 30.0) {
          recirculationRiskTier = 'SEVERE_RECIRCULATION';
          directives.push(`SEVERE RECIRCULATION (RF ${recirculationFractionPct}% >= 30%): Oxygenated return blood is immediately re-aspirated into drainage cannula. Check cannula tip positioning under TEE/fluoroscopy. Consider advancing return cannula or withdrawing drainage cannula to achieve >= 10-15 cm separation.`);
          directives.push('Consider decreasing pump speed slightly to collapse the recirculation vortex.');
        } else if (recirculationFractionPct >= 20.0) {
          recirculationRiskTier = 'MODERATE_RECIRCULATION';
          directives.push(`MODERATE RECIRCULATION (RF ${recirculationFractionPct}%): Monitor for falling arterial saturation despite high circuit pre-oxygenator saturation.`);
        } else {
          recirculationRiskTier = 'ACCEPTABLE_FLOW';
          directives.push(`VV ECMO Recirculation within safe operating limits (RF ${recirculationFractionPct}% < 20%).`);
        }
      }
    } else if (input.ecmoMode === 'VA_ECMO') {
      // Differential Hypoxemia / Harlequin / North-South Syndrome
      if (input.rightRadialSpo2Pct !== undefined && input.femoralArterialSpo2Pct !== undefined) {
        radialToFemoralGradientPct = input.femoralArterialSpo2Pct - input.rightRadialSpo2Pct;

        if (radialToFemoralGradientPct >= 10 || (input.rightRadialSpo2Pct < 88 && input.femoralArterialSpo2Pct >= 95)) {
          differentialHypoxemiaPresent = true;
          recirculationRiskTier = 'HARLEQUIN_SYNDROME_CRITICAL';
          directives.push(`CRITICAL HARLEQUIN SYNDROME (North-South Differential Hypoxemia): Right radial SpO2 (${input.rightRadialSpo2Pct}%) is severely desaturated compared to lower extremity femoral SpO2 (${input.femoralArterialSpo2Pct}%). Recovering native left ventricle is ejecting poorly oxygenated blood into coronary arteries and carotid/cerebral circulation!`);
          directives.push('Immediate Action Ladder: 1) Increase ventilator FiO2 and optimize PEEP to improve native lung oxygenation. 2) If pulmonary shunting persists, convert circuit to V-AV ECMO configuration (return blood split to right internal jugular vein).');
        } else {
          recirculationRiskTier = 'NORMAL_PERFUSION';
          directives.push('Dual-circulation saturation check: Upper and lower body oxygenation are concordant.');
        }
      }
    }

    directives.push(`Sweep gas setting ${input.sweepGasFlowLpm} L/min, pump flow ${input.pumpFlowLpm} L/min.`);

    return {
      patientId: input.patientId,
      ecmoMode: input.ecmoMode,
      recirculationFractionPct,
      recirculationRiskTier,
      differentialHypoxemiaPresent,
      radialToFemoralGradientPct,
      ecmoDirectives: directives
    };
  }

  public static async recordEvaluation(input: EcmoRecirculationInput): Promise<EcmoRecirculationResult> {
    const result = this.evaluateEcmo(input);

    const res = await query(
      `INSERT INTO ecmo_recirculation_events (
        patient_id, ecmo_mode, recirculation_fraction_pct,
        differential_hypoxemia_present, right_radial_spo2_pct,
        femoral_art_spo2_pct, recirculation_risk_tier, eval_output
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id`,
      [
        input.patientId,
        result.ecmoMode,
        result.recirculationFractionPct || null,
        result.differentialHypoxemiaPresent,
        input.rightRadialSpo2Pct || null,
        input.femoralArterialSpo2Pct || null,
        result.recirculationRiskTier,
        JSON.stringify(result)
      ]
    );

    result.id = res.rows[0].id;
    return result;
  }
}
