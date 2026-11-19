import { query } from '../db';

export interface ReboaTraumaInput {
  patientId: number;
  hemorrhageAnatomy: 'SUBDIAPHRAGMATIC_ABDOMINAL' | 'PELVIC_FRACTURE_OR_GROIN' | 'THORACIC_SUSPECTED' | 'MESENTERIC_SOLITARY';
  systolicBpMmhg: number;
  occlusionStartTime: string; // ISO string
  elapsedOcclusionMinutes: number;
  isPartialReboa: boolean;
  balloonVolumeMl: number;
  proximalMapMmhg: number;
  distalPulsePalpable: boolean;
}

export interface ReboaTraumaResult {
  id?: number;
  patientId: number;
  aorticZone: 'Zone 1' | 'Zone 2' | 'Zone 3' | 'CONTRAINDICATED';
  balloonVolumeMl: number;
  maxIschemiaDurationMin: number;
  remainingSafeTimeMin: number;
  isPartialReboa: boolean;
  targetDistalMapMmhg: number;
  ischemiaRiskTier: 'SAFE_WINDOW' | 'WARNING_ELAPSED_50PCT' | 'CRITICAL_ISCHEMIA_EXCEEDED' | 'PROCEDURAL_CONTRAINDICATION';
  reperfusionShockRisk: 'LOW' | 'MODERATE' | 'IMMINENT_LETHAL_WASHOUT';
  reboaDirectives: string[];
}

export class ReboaTraumaService {
  public static evaluateReboa(input: ReboaTraumaInput): ReboaTraumaResult {
    const directives: string[] = [];

    // 1. Zone Selection
    let aorticZone: ReboaTraumaResult['aorticZone'] = 'Zone 1';
    let maxIschemiaDurationMin = 30;

    if (input.hemorrhageAnatomy === 'THORACIC_SUSPECTED') {
      aorticZone = 'CONTRAINDICATED';
      directives.push(
        'CONTRAINDICATION: REBOA is contraindicated in suspected thoracic aortic rupture or pericardial tamponade (increases proximal hemorrhage).'
      );
      return {
        patientId: input.patientId,
        aorticZone,
        balloonVolumeMl: 0,
        maxIschemiaDurationMin: 0,
        remainingSafeTimeMin: 0,
        isPartialReboa: false,
        targetDistalMapMmhg: 0,
        ischemiaRiskTier: 'PROCEDURAL_CONTRAINDICATION',
        reperfusionShockRisk: 'LOW',
        reboaDirectives: directives
      };
    } else if (input.hemorrhageAnatomy === 'PELVIC_FRACTURE_OR_GROIN') {
      aorticZone = 'Zone 3';
      maxIschemiaDurationMin = 60;
      directives.push('Zone 3 Placement Confirmed (Infrarenal aorta): Balloon positioned above aortic bifurcation for pelvic/groin hemorrhage.');
    } else {
      aorticZone = 'Zone 1';
      maxIschemiaDurationMin = 30;
      directives.push('Zone 1 Placement Confirmed (Descending thoracic aorta): Celiac to L-subclavian for severe intra-abdominal/retroperitoneal hemorrhage.');
    }

    // 2. Ischemia Duration & Time Budget
    const remainingSafeTimeMin = Math.max(0, maxIschemiaDurationMin - input.elapsedOcclusionMinutes);

    let ischemiaRiskTier: ReboaTraumaResult['ischemiaRiskTier'] = 'SAFE_WINDOW';
    let reperfusionShockRisk: ReboaTraumaResult['reperfusionShockRisk'] = 'LOW';

    if (input.elapsedOcclusionMinutes > maxIschemiaDurationMin) {
      ischemiaRiskTier = 'CRITICAL_ISCHEMIA_EXCEEDED';
      reperfusionShockRisk = 'IMMINENT_LETHAL_WASHOUT';
      directives.push(
        `CRITICAL ISCHEMIA WARNING: Occlusion time (${input.elapsedOcclusionMinutes} min) has EXCEEDED maximum safe limit (${maxIschemiaDurationMin} min)! Immediate stepwise balloon deflation is mandatory to avert lethal visceral necrosis, refractory lactic acidosis, and hyperkalemic arrest.`
      );
    } else if (input.elapsedOcclusionMinutes >= maxIschemiaDurationMin * 0.5) {
      ischemiaRiskTier = 'WARNING_ELAPSED_50PCT';
      reperfusionShockRisk = 'MODERATE';
      directives.push(
        `Time Budget Alert: ${remainingSafeTimeMin} minutes of safe occlusion remaining. Expedite definitive surgical or angioembolization hemostasis.`
      );
    }

    // 3. Partial REBOA (pREBOA) & Hemodynamic Targets
    let targetDistalMapMmhg = 0;
    if (input.isPartialReboa) {
      targetDistalMapMmhg = 40; // permissive distal perfusion
      directives.push(
        'Partial REBOA (pREBOA) active: Titrate deflation to target distal MAP 35-45 mmHg while maintaining proximal MAP > 65 mmHg to mitigate downstream ischemic debt.'
      );
    } else {
      targetDistalMapMmhg = 0;
      directives.push('Complete Aortic Occlusion active: Monitor proximal MAP and avoid balloon overinflation rupture.');
    }

    // 4. Deflation & Reperfusion Guidance
    directives.push('Stepwise Deflation Protocol: Deflate over 5-10 minutes under continuous invasive blood pressure monitoring; prepare calcium chloride and bicarbonate for reperfusion washout.');

    return {
      patientId: input.patientId,
      aorticZone,
      balloonVolumeMl: input.balloonVolumeMl,
      maxIschemiaDurationMin,
      remainingSafeTimeMin,
      isPartialReboa: input.isPartialReboa,
      targetDistalMapMmhg,
      ischemiaRiskTier,
      reperfusionShockRisk,
      reboaDirectives: directives
    };
  }

  public static async recordEvaluation(input: ReboaTraumaInput): Promise<ReboaTraumaResult> {
    const result = this.evaluateReboa(input);

    const res = await query(
      `INSERT INTO reboa_trauma_missions (
        patient_id, aortic_zone, balloon_volume_ml, occlusion_start_time,
        max_ischemia_duration_min, is_partial_reboa, target_distal_map_mmhg,
        ischemia_risk_tier, eval_output
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id`,
      [
        input.patientId,
        result.aorticZone,
        input.balloonVolumeMl,
        input.occlusionStartTime,
        result.maxIschemiaDurationMin,
        result.isPartialReboa,
        result.targetDistalMapMmhg,
        result.ischemiaRiskTier,
        JSON.stringify(result)
      ]
    );

    result.id = res.rows[0].id;
    return result;
  }
}
