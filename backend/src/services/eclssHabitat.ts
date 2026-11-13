import { query } from '../db';

export type AtmosphereStatus = 'OPTIMAL_NOMINAL' | 'HYPERCAPNIC_RISK' | 'HYPOXIC_FIRE_HAZARD' | 'TOXIC_AMMONIA_EMERGENCY';

export interface EclssHabitatInput {
  habitatModule: string; // e.g. 'HAB_CORE_ALPHA', 'AIRLOCK', 'ORION_CAPSULE'
  cabinPressurePsia: number; // 14.7 psia (sea-level equivalent) or 8.2 psia (exploration atmosphere)
  pco2Mmhg: number; // Inspired CO2 partial pressure in mmHg
  o2Percentage: number; // Volume percentage
  liohSaturationPct: number; // 0-100%
  ammoniaCoolantPpm: number; // External cooling loop ammonia breach in ppm
}

export interface EclssHabitatResult {
  id?: number;
  habitatModule: string;
  cabinPressurePsia: number;
  pco2Mmhg: number;
  o2Percentage: number;
  liohSaturationPct: number;
  ammoniaCoolantPpm: number;
  atmosphereStatus: AtmosphereStatus;
  respiratoryIndex: {
    inspiredCo2Severity: string;
    flammabilityRisk: string;
    hypoxiaRisk: string;
    ammoniaToxicityTier: string;
  };
  correctiveActions: string[];
  systemDirectives: {
    scrubberMode: string;
    maskStatus: string;
    ventilationRate: string;
    crewDirectives: string[];
  };
}

export class EclssHabitatService {
  /**
   * Evaluates closed-loop environmental control & life support systems (ECLSS),
   * hypercapnia limits, flammability envelopes, and toxic ammonia leak alerts.
   */
  public static evaluateHabitat(input: EclssHabitatInput): EclssHabitatResult {
    const actions: string[] = [];
    const crewDirectives: string[] = [];
    let status: AtmosphereStatus = 'OPTIMAL_NOMINAL';

    // 1. Carbon Dioxide (CO2) & Scrubber Evaluation
    let inspiredCo2Severity = 'OPTIMAL (< 2.0 mmHg)';
    let scrubberMode = 'Nominal Regenerative 4-Bed Molecular Sieve (4BMS) Cycle';

    if (input.pco2Mmhg >= 7.0) {
      status = 'HYPERCAPNIC_RISK';
      inspiredCo2Severity = 'CRITICAL SEVERE HYPERCAPNIA (>= 7.0 mmHg)';
      actions.push('EMERGENT: Severe cabin hypercapnia. Acute respiratory acidosis and encephalopathy hazard.');
      scrubberMode = 'EMERGENCY: Force secondary backup LiOH canister banks online. Maximize cabin circulation velocity.';
      crewDirectives.push('Don emergency breathing apparatus (EBA) if headache or dyspnea develops.');
    } else if (input.pco2Mmhg >= 3.0) {
      status = 'HYPERCAPNIC_RISK';
      inspiredCo2Severity = 'ELEVATED (>= 3.0 mmHg) - Space Headache & Lethargy Risk';
      actions.push('WARNING: Elevated PCO2 detected. Crew neuro-cognitive performance decrement.');
      scrubberMode = 'Accelerate 4BMS thermal desorb cycle or swap LiOH canister.';
      crewDirectives.push('Increase local personal fan airflow to break up stagnant exhaled CO2 pocket around face.');
    }

    if (input.liohSaturationPct >= 85.0) {
      actions.push(`LiOH canister saturation at ${input.liohSaturationPct.toFixed(1)}%. Replace with fresh canister.`);
    }

    // 2. Oxygen & Flammability / Hypoxia Envelope
    let flammabilityRisk = 'LOW';
    let hypoxiaRisk = 'LOW';

    // Norms depend on pressure: 8.2 psia (exploration) vs 14.7 psia (ISS standard)
    const isExplorationAtmosphere = input.cabinPressurePsia < 10.0;
    const maxSafeO2Pct = isExplorationAtmosphere ? 36.0 : 23.5;
    const minSafeO2Pct = isExplorationAtmosphere ? 30.0 : 19.5;

    if (input.o2Percentage > maxSafeO2Pct) {
      status = 'HYPOXIC_FIRE_HAZARD';
      flammabilityRisk = 'HIGH / CRITICAL FIRE HAZARD';
      actions.push(`CRITICAL: Oxygen concentration (${input.o2Percentage.toFixed(1)}%) violates NASA-STD-6001 materials flammability ceiling.`);
      crewDirectives.push('Inhibit all high-energy experiment racks. Introduce N2 makeup gas immediately.');
    } else if (input.o2Percentage < minSafeO2Pct) {
      status = 'HYPOXIC_FIRE_HAZARD';
      hypoxiaRisk = 'HIGH / ACUTE HYPOXIA RISK';
      actions.push(`ALERT: Oxygen concentration (${input.o2Percentage.toFixed(1)}%) below safe inspired threshold.`);
      crewDirectives.push('Inject high-pressure O2 from reserve cryogenic tankage.');
    }

    // 3. Ammonia Coolant Breach (The Ultimate Space Station Chemical Hazard)
    let ammoniaToxicityTier = 'NOMINAL (0 ppm)';
    let maskStatus = 'NOT_REQUIRED';

    if (input.ammoniaCoolantPpm >= 50.0) {
      status = 'TOXIC_AMMONIA_EMERGENCY';
      ammoniaToxicityTier = 'IDLH (>= 50 ppm) - IMMEDIATELY DANGEROUS TO LIFE';
      maskStatus = 'MANDATORY QUICK-DON MASK WITH AMMONIA FILTER';
      actions.push('CATASTROPHIC HAZARD: Anhydrous ammonia cooling loop breach into cabin volume.');
      actions.push('Emergency module isolation: Close inter-module ventilation (IMV) valves and deploy activated charcoal chemisorption scrubbers.');
      crewDirectives.push('STAT: Don Quick-Don Masks with ammonia scrub cartridges within 5 seconds.');
      crewDirectives.push('Evacuate contaminated module, isolate inter-module ventilation hatches, and seal hatch.');
      crewDirectives.push('Deploy Activated Charcoal / Chemisorption scrub pack and verify zero exterior loop pressure.');
    } else if (input.ammoniaCoolantPpm >= 5.0) {
      status = 'TOXIC_AMMONIA_EMERGENCY';
      ammoniaToxicityTier = 'MODERATE BREACH (>= 5 ppm)';
      maskStatus = 'PRECAUTIONARY MASK DONNING';
      actions.push('WARNING: Ammonia odor threshold exceeded. Suspect internal heat exchanger micro-fracture.');
      crewDirectives.push('Don masks and initiate targeted trace contaminant sniffing with draeger tubes.');
    }

    const systemDirectives = {
      scrubberMode,
      maskStatus,
      ventilationRate: status === 'TOXIC_AMMONIA_EMERGENCY' ? 'ISOLATED_MODULE_OFF' : 'HIGH_FLOW (120 CFM)',
      crewDirectives
    };

    return {
      habitatModule: input.habitatModule,
      cabinPressurePsia: input.cabinPressurePsia,
      pco2Mmhg: input.pco2Mmhg,
      o2Percentage: input.o2Percentage,
      liohSaturationPct: input.liohSaturationPct,
      ammoniaCoolantPpm: input.ammoniaCoolantPpm,
      atmosphereStatus: status,
      respiratoryIndex: {
        inspiredCo2Severity,
        flammabilityRisk,
        hypoxiaRisk,
        ammoniaToxicityTier
      },
      correctiveActions: actions,
      systemDirectives
    };
  }

  /**
   * Persists ECLSS habitat telemetry to database.
   */
  public static async recordHabitatTelemetry(input: EclssHabitatInput): Promise<EclssHabitatResult> {
    const result = this.evaluateHabitat(input);
    const insertQuery = `
      INSERT INTO eclss_habitat_telemetry (
        habitat_module, cabin_pressure_psia, pco2_mmhg, o2_percentage,
        lioh_saturation_pct, ammonia_coolant_ppm, atmosphere_status, corrective_actions
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, logged_at;
    `;
    const res = await query(insertQuery, [
      result.habitatModule,
      result.cabinPressurePsia,
      result.pco2Mmhg,
      result.o2Percentage,
      result.liohSaturationPct,
      result.ammoniaCoolantPpm,
      result.atmosphereStatus,
      JSON.stringify(result.correctiveActions)
    ]);
    if (res.rows.length > 0) {
      result.id = res.rows[0].id;
    }
    return result;
  }
}
