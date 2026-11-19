import { query } from '../db';

export interface MicrocirculationNirsInput {
  patientId: number;
  macroMapMmhg: number; // e.g. 70 mmHg
  sto2Percentage: number; // e.g. 62%
  mfiScore: number; // 0.0 - 3.0 (e.g. 2.1)
  ppvPercentage: number; // e.g. 68%
  perfusedVesselDensityMm2: number; // e.g. 8.5 mm/mm2
  norepinephrineDoseMcgKgMin: number; // e.g. 0.4 mcg/kg/min
  hematocritPct: number; // e.g. 22%
  cvpMmhg: number; // e.g. 16 mmHg
  fluidBalance24hLiters: number; // e.g. +6.5 L
}

export interface MicrocirculationNirsResult {
  id?: number;
  patientId: number;
  sto2Percentage: number;
  mfiScore: number;
  ppvPercentage: number;
  macroMapMmhg: number;
  hemodynamicCoherenceLoss:
    | 'COHERENT'
    | 'TYPE_1_HETEROGENEITY_SEPSIS'
    | 'TYPE_2_HEMODILUTION_FLUID'
    | 'TYPE_3_VASOCONSTRICTION_TAMPO'
    | 'TYPE_4_CAPILLARY_LEAK_EDEMA';
  microcirculatoryShockState: 'NORMAL_PERFUSED' | 'MILD_IMPAIRMENT' | 'SEVERE_DISSOCIATED_HYPOXIA';
  fluidResponsiveCaution: boolean;
  resuscitationGuidance: string;
  clinicalDirectives: string[];
}

export class MicrocirculationNirsService {
  public static evaluateMicrocirculation(input: MicrocirculationNirsInput): MicrocirculationNirsResult {
    const directives: string[] = [];

    const macroAdequate = input.macroMapMmhg >= 65;
    const microImpaired = input.mfiScore < 2.5 || input.ppvPercentage < 80 || input.sto2Percentage < 72;

    let microcirculatoryShockState: MicrocirculationNirsResult['microcirculatoryShockState'] = 'NORMAL_PERFUSED';
    if (input.mfiScore < 2.0 || input.ppvPercentage < 65 || input.sto2Percentage < 60) {
      microcirculatoryShockState = 'SEVERE_DISSOCIATED_HYPOXIA';
    } else if (microImpaired) {
      microcirculatoryShockState = 'MILD_IMPAIRMENT';
    }

    // Determine Ince Type of Loss of Hemodynamic Coherence
    let coherence: MicrocirculationNirsResult['hemodynamicCoherenceLoss'] = 'COHERENT';
    let guidance = '';
    let fluidResponsiveCaution = false;

    if (!microImpaired && macroAdequate) {
      coherence = 'COHERENT';
      guidance = 'Microcirculation and macrocirculation are coherent. Hemodynamic targets achieved without microcirculatory shunting.';
      directives.push('Tissue oxygenation StO2 and sublingual perfusion index (MFI > 2.8) verify cellular delivery.');
    } else if (input.norepinephrineDoseMcgKgMin >= 0.35 && input.mfiScore < 2.5) {
      coherence = 'TYPE_3_VASOCONSTRICTION_TAMPO';
      fluidResponsiveCaution = true;
      guidance =
        'Ince Type 3 Decoupling (Excessive Vasoconstriction / Elevated Afterload): High-dose vasopressor is clamping the microvascular beds despite normal/high MAP. Consider adding inodilator (Dobutamine / Milrinone) or cautious vasopressor de-escalation.';
      directives.push('WARNING: Raising MAP further with alpha-agonists will worsen capillary hypoperfusion and metabolic debt.');
    } else if (input.hematocritPct < 25 && input.fluidBalance24hLiters > 3.0) {
      coherence = 'TYPE_2_HEMODILUTION_FLUID';
      fluidResponsiveCaution = true;
      guidance =
        'Ince Type 2 Decoupling (Iatrogenic Hemodilution): Crystalloid dilution has reduced oxygen-carrying capacity and widened intercapillary distance. Stop crystalloids; transfuse PRBCs to target Hct 28-30%.';
      directives.push('Crystalloid resuscitation ineffective for microvascular oxygen carriage at current hematocrit.');
    } else if (input.fluidBalance24hLiters >= 5.0 || input.cvpMmhg >= 14) {
      coherence = 'TYPE_4_CAPILLARY_LEAK_EDEMA';
      fluidResponsiveCaution = true;
      guidance =
        'Ince Type 4 Decoupling (Capillary Leak / Interstitial Edema): Microvascular venous congestion (CVP > 14 mmHg) and positive fluid balance obstruct venous outflow and capillary perfusion. Initiate diuresis or CRRT ultrafiltration.';
      directives.push('STOP ALL UNNECESSARY FLUID BOLUSES: Capillary edema is impairing cellular oxygen diffusion.');
    } else {
      coherence = 'TYPE_1_HETEROGENEITY_SEPSIS';
      guidance =
        'Ince Type 1 Decoupling (Heterogeneous Microvascular Perfusion): Blocked capillaries interspersed with fast hyperdynamic flow, indicative of septic endothelial glycocalyx breakdown.';
      directives.push('Target endothelial stabilization, source control, and cautious inotropy; avoid volume overload.');
    }

    return {
      patientId: input.patientId,
      sto2Percentage: input.sto2Percentage,
      mfiScore: input.mfiScore,
      ppvPercentage: input.ppvPercentage,
      macroMapMmhg: input.macroMapMmhg,
      hemodynamicCoherenceLoss: coherence,
      microcirculatoryShockState,
      fluidResponsiveCaution,
      resuscitationGuidance: guidance,
      clinicalDirectives: directives
    };
  }

  public static async recordEvaluation(input: MicrocirculationNirsInput): Promise<MicrocirculationNirsResult> {
    const result = this.evaluateMicrocirculation(input);

    const res = await query(
      `INSERT INTO microcirculation_nirs_evals (
        patient_id, sto2_percentage, mfi_score, ppv_percentage,
        macro_map_mmhg, hemodynamic_coherence_loss, resuscitation_guidance, eval_output
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id`,
      [
        input.patientId,
        input.sto2Percentage,
        input.mfiScore,
        input.ppvPercentage,
        input.macroMapMmhg,
        result.hemodynamicCoherenceLoss,
        result.resuscitationGuidance,
        JSON.stringify(result)
      ]
    );

    result.id = res.rows[0].id;
    return result;
  }
}
