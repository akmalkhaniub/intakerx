import { query } from '../db';

export interface VasoplegicShockRescueInput {
  patientId: number;
  meanArterialPressureMmhg: number;
  norepinephrineEquivalentMcgKgMin: number;
  systemicVascularResistanceDynes: number;
  cardiacIndexLMinM2: number;
  hoursPostCardiopulmonaryBypass: number;
  currentVasopressinUPerMin: number;
  methyleneBlueGiven: boolean;
  angiotensinIiGiven: boolean;
  refractoryToHighDoseCatecholamines: boolean;
}

export interface VasoplegicShockRescueResult {
  id?: number;
  patientId: number;
  vasoplegiaSeverityTier: 'NO_VASOPLEGIA' | 'MILD_REFRACTORY' | 'MODERATE_VASOPLEGIA' | 'EXTREMIS_CATASTROPHIC';
  vasopressinIndicated: boolean;
  methyleneBlueIndicated: boolean;
  hydroxocobalaminIndicated: boolean;
  angiotensinIiIndicated: boolean;
  rescueLadderStep: number; // 0 to 4
  shockDirectives: string[];
}

export class VasoplegicShockRescueService {
  public static evaluateVasoplegia(input: VasoplegicShockRescueInput): VasoplegicShockRescueResult {
    const directives: string[] = [];

    const isVasoplegic =
      input.meanArterialPressureMmhg < 65 &&
      input.systemicVascularResistanceDynes < 800 &&
      input.cardiacIndexLMinM2 >= 2.2;

    let vasoplegiaSeverityTier: VasoplegicShockRescueResult['vasoplegiaSeverityTier'] = 'NO_VASOPLEGIA';
    let rescueLadderStep = 0;

    let vasopressinIndicated = false;
    let methyleneBlueIndicated = false;
    let hydroxocobalaminIndicated = false;
    let angiotensinIiIndicated = false;

    if (!isVasoplegic && input.meanArterialPressureMmhg >= 65) {
      vasoplegiaSeverityTier = 'NO_VASOPLEGIA';
      directives.push('Hemodynamic stability achieved; systemic vascular resistance is adequate.');
    } else {
      if (input.norepinephrineEquivalentMcgKgMin >= 0.5 || input.systemicVascularResistanceDynes < 500) {
        vasoplegiaSeverityTier = 'EXTREMIS_CATASTROPHIC';
      } else if (input.norepinephrineEquivalentMcgKgMin >= 0.25 || input.systemicVascularResistanceDynes < 700) {
        vasoplegiaSeverityTier = 'MODERATE_VASOPLEGIA';
      } else {
        vasoplegiaSeverityTier = 'MILD_REFRACTORY';
      }

      // Step 1: Vasopressin (V1 receptor agonist)
      if (input.currentVasopressinUPerMin < 0.03) {
        vasopressinIndicated = true;
        rescueLadderStep = 1;
        directives.push(
          'STEP 1 RESCUE: Initiate Vasopressin continuous infusion at fixed 0.03-0.04 U/min (replaces neurohypophyseal depletion post-CPB and restores V1 vascular tone without pulmonary vasoconstriction).'
        );
      }

      // Step 2: Methylene Blue (Inhibits inducible NOS and soluble guanylyl cyclase)
      if (!input.methyleneBlueGiven && (input.norepinephrineEquivalentMcgKgMin >= 0.3 || input.currentVasopressinUPerMin >= 0.03)) {
        methyleneBlueIndicated = true;
        if (rescueLadderStep < 2) rescueLadderStep = 2;
        directives.push(
          'STEP 2 RESCUE: Administer Methylene Blue 1.5 - 2.0 mg/kg IV infused over 30-60 minutes (repeat in 8-12h if transient response). Blocks CPB-induced inducible nitric oxide synthase (iNOS) surge.'
        );
      }

      // Step 3: Hydroxocobalamin (Vitamin B12a - Nitric oxide scavenger)
      if (input.norepinephrineEquivalentMcgKgMin >= 0.4 && (input.methyleneBlueGiven || input.refractoryToHighDoseCatecholamines)) {
        hydroxocobalaminIndicated = true;
        if (rescueLadderStep < 3) rescueLadderStep = 3;
        directives.push(
          'STEP 3 RESCUE: Infuse Hydroxocobalamin (Cyanokit) 5.0 g IV over 15 minutes. Scavenges circulating NO and hydrogen sulfide, restoring systemic vasomotor responsiveness.'
        );
      }

      // Step 4: Synthetic Angiotensin II (Giapreza - AT1 receptor agonist)
      if (input.norepinephrineEquivalentMcgKgMin >= 0.5 && !input.angiotensinIiGiven) {
        angiotensinIiIndicated = true;
        rescueLadderStep = 4;
        directives.push(
          'STEP 4 RESCUE: Synthetic Angiotensin II (Giapreza) 10 - 40 ng/kg/min continuous infusion indicated for catecholamine-refractory distributive shock (ATHOS-3 protocol; maintain venous thromboembolism prophylaxis).'
        );
      }
    }

    directives.push(
      `Post-CPB time: ${input.hoursPostCardiopulmonaryBypass}h. Current pressor burden: ${input.norepinephrineEquivalentMcgKgMin} mcg/kg/min NE equivalent, SVR ${input.systemicVascularResistanceDynes} dynes·s/cm⁵.`
    );

    return {
      patientId: input.patientId,
      vasoplegiaSeverityTier,
      vasopressinIndicated,
      methyleneBlueIndicated,
      hydroxocobalaminIndicated,
      angiotensinIiIndicated,
      rescueLadderStep,
      shockDirectives: directives
    };
  }

  public static async recordEvaluation(input: VasoplegicShockRescueInput): Promise<VasoplegicShockRescueResult> {
    const result = this.evaluateVasoplegia(input);

    const res = await query(
      `INSERT INTO vasoplegic_shock_rescue_logs (
        patient_id, norepinephrine_equivalent_mcg_kg_min,
        systemic_vascular_resistance_dynes, cardiac_index_l_min_m2,
        vasoplegia_severity_tier, vasopressin_indicated, methylene_blue_indicated,
        hydroxocobalamin_indicated, angiotensin_ii_indicated, eval_output
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id`,
      [
        input.patientId,
        input.norepinephrineEquivalentMcgKgMin,
        input.systemicVascularResistanceDynes,
        input.cardiacIndexLMinM2,
        result.vasoplegiaSeverityTier,
        result.vasopressinIndicated,
        result.methyleneBlueIndicated,
        result.hydroxocobalaminIndicated,
        result.angiotensinIiIndicated,
        JSON.stringify(result)
      ]
    );

    result.id = res.rows[0].id;
    return result;
  }
}
