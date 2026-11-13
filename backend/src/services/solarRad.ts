import { query } from '../db';

export type MissionPhase = 'LEO' | 'LUNAR_SURFACE' | 'TRANSIT_MARS' | 'MARTIAN_SURFACE';
export type StormTier = 'GREEN_NORMAL' | 'YELLOW_ELEVATED' | 'RED_CRITICAL_STORM' | 'BLACK_LETHAL_SPE';
export type ArsStage = 'NONE' | 'HEMATOPOIETIC_PRODROMAL' | 'HEMATOPOIETIC_LATENT' | 'GASTROINTESTINAL_ACUTE' | 'NEUROVASCULAR_COLLAPSE';

export interface SolarRadInput {
  missionPhase: MissionPhase;
  speProtonFluxPfu: number; // Proton Flux Units (> 10 MeV). >100 is significant, >10,000 extreme
  gcrDoseRateMsvDay: number; // Galactic Cosmic Ray background in mSv/day (typ 1.3 - 1.8 in transit)
  cumulativeMissionDoseMsv: number; // Accumulated career/mission dose
  evaActive: boolean; // Is astronaut currently on an EVA spacewalk?
  estimatedExposureHours?: number;
}

export interface SolarRadResult {
  id?: number;
  missionPhase: MissionPhase;
  speProtonFluxPfu: number;
  gcrDoseRateMsvDay: number;
  cumulativeDoseMsv: number;
  evaActive: boolean;
  stormTier: StormTier;
  currentDoseRateMsvHour: number;
  projected24hDoseMsv: number;
  shelterInPlaceRequired: boolean;
  evaAbortImmediate: boolean;
  arsSyndromeStage: ArsStage;
  filgrastimIndicated: boolean;
  radioprotectionPlan: {
    stormShelterProtocol: string;
    shieldingMaterials: string;
    medicalCountermeasures: string;
    antiemeticRegimen: string;
    hematopoieticSupport: string;
    dosimetryMonitoring: string;
  };
  clinicalDirectives: string[];
}

export class SolarRadService {
  /**
   * Evaluates space radiation exposure, Solar Particle Events (SPEs), and Galactic Cosmic Ray (GCR) risks.
   */
  public static evaluateRadiation(input: SolarRadInput): SolarRadResult {
    const directives: string[] = [];

    // 1. Calculate Dose Rate in mSv/hour
    // Baseline GCR hourly rate + SPE proton conversion (empiric NASA SP-2016-628 model)
    const gcrHourlyMsv = input.gcrDoseRateMsvDay / 24.0;
    
    // SPE flux conversion: 100 pfu roughly corresponds to ~2.5 mSv/h unshielded; 10,000 pfu > 250 mSv/h
    let speHourlyMsv = 0;
    if (input.speProtonFluxPfu > 10) {
      speHourlyMsv = (input.speProtonFluxPfu / 100.0) * 2.5;
    }

    // Planetary / LEO shielding factors
    let shieldingFactor = 1.0;
    if (input.missionPhase === 'LEO') {
      shieldingFactor = 0.15; // Geomagnetic van Allen protection
    } else if (input.missionPhase === 'MARTIAN_SURFACE') {
      shieldingFactor = 0.55; // Planetary body 2pi steradian shadowing + thin CO2 atmosphere
    } else if (input.missionPhase === 'LUNAR_SURFACE') {
      shieldingFactor = 0.50; // Moon 2pi solid angle shadowing
    }

    const currentDoseRateMsvHour = parseFloat(((gcrHourlyMsv + speHourlyMsv) * shieldingFactor).toFixed(2));
    const projected24hDoseMsv = parseFloat((currentDoseRateMsvHour * 24.0).toFixed(2));

    // 2. Storm Tier Classification
    let stormTier: StormTier = 'GREEN_NORMAL';
    let shelterInPlaceRequired = false;
    let evaAbortImmediate = false;

    if (currentDoseRateMsvHour >= 500.0 || input.speProtonFluxPfu >= 20000) {
      stormTier = 'BLACK_LETHAL_SPE';
      shelterInPlaceRequired = true;
      directives.push('LETHAL SOLAR PARTICLE EVENT (SPE) IN PROGRESS. Radiation dose rate exceeds 500 mSv/h.');
    } else if (currentDoseRateMsvHour >= 50.0 || input.speProtonFluxPfu >= 1000) {
      stormTier = 'RED_CRITICAL_STORM';
      shelterInPlaceRequired = true;
      directives.push('CRITICAL SOLAR STORM WARNING: Dose rate exceeds 50 mSv/h.');
    } else if (currentDoseRateMsvHour >= 2.0 || input.speProtonFluxPfu >= 100) {
      stormTier = 'YELLOW_ELEVATED';
      directives.push('ELEVATED RADIATION: Solar active region facing trajectory. Prepare contingency shelter.');
    }

    if (input.evaActive && stormTier !== 'GREEN_NORMAL') {
      evaAbortImmediate = true;
      directives.push('EMERGENT EVA TERMINATION: Astronauts outside spacecraft must egress to airlock immediately. Ingress & repress within 15 minutes.');
    }

    // 3. Acute Radiation Syndrome (ARS) Projection (based on projected dose in Gy/Sv)
    // 1 Sv = 1000 mSv. 1 Gy of proton/gamma radiation ~ 1-1.5 Sv
    const totalAcuteProjectedSv = projected24hDoseMsv / 1000.0;
    let arsSyndromeStage: ArsStage = 'NONE';
    let filgrastimIndicated = false;

    if (totalAcuteProjectedSv >= 10.0) {
      arsSyndromeStage = 'NEUROVASCULAR_COLLAPSE';
      filgrastimIndicated = true;
      directives.push('CRITICAL ARS: Projected dose >= 10 Gy. Neurovascular collapse, severe cerebral edema, cardiovascular hypotension impending.');
    } else if (totalAcuteProjectedSv >= 6.0) {
      arsSyndromeStage = 'GASTROINTESTINAL_ACUTE';
      filgrastimIndicated = true;
      directives.push('SEVERE ARS: Projected dose 6-10 Gy. Intestinal mucosal sloughing, severe dehydration, fluid translocation.');
    } else if (totalAcuteProjectedSv >= 2.0) {
      arsSyndromeStage = 'HEMATOPOIETIC_PRODROMAL';
      filgrastimIndicated = true;
      directives.push('MODERATE ARS: Projected dose 2-6 Gy. Severe bone marrow suppression and absolute neutrophil count (ANC) nadir within 10-14 days.');
    } else if (totalAcuteProjectedSv >= 0.7) {
      arsSyndromeStage = 'HEMATOPOIETIC_LATENT';
      directives.push('MILD ARS PRODROMAL: Dose 0.7-2 Gy. Transient nausea, lymphocyte depletion within 48h.');
    }

    // 4. Medical Countermeasure Protocols
    const shelterDirective = shelterInPlaceRequired
      ? 'MANDATORY STORM SHELTER: All crew retreat to spacecraft storm core (water-shielded tank bay / polyethylene storm bunker). Seal secondary storm hatch.'
      : 'Maintain standard habitable volume layout. Routine active dosimeter logging.';

    const antiemeticDirective = totalAcuteProjectedSv >= 0.5
      ? 'Ondansetron 8 mg IV/ODT q8h + Dexamethasone 10 mg IV for acute radiation-induced emesis prevention.'
      : 'Oral antiemetics PRN for mild nausea.';

    const hematopoieticDirective = filgrastimIndicated
      ? 'STAT Filgrastim (G-CSF) 5 mcg/kg/day SC beginning 24h post-exposure until ANC > 1,000/mcL x 3 consecutive days; Oral Ciprofloxacin 500 mg PO BID for neutropenic gut translocation prophylaxis.'
      : 'Serial absolute lymphocyte count (ALC) q12h to calculate Andrews lymphocyte depletion curve.';

    const radioprotectionPlan = {
      stormShelterProtocol: shelterDirective,
      shieldingMaterials: 'Deploy flexible polyethylene blankets (5 g/cm2) and route grey-water storage bladders to storm vault perimeter.',
      medicalCountermeasures: 'Oral Amifostine 500 mg PO or Radioprotective Antioxidant Cocktail (Alpha-tocopherol 400 IU, N-acetylcysteine 1200 mg, Ascorbate 1000 mg) prior to peak fluence.',
      antiemeticRegimen: antiemeticDirective,
      hematopoieticSupport: hematopoieticDirective,
      dosimetryMonitoring: 'Continuous readout on crew active personal dosimeters (APD); download thermoluminescent dosimeter (TLD) chips every 6 hours.'
    };

    return {
      missionPhase: input.missionPhase,
      speProtonFluxPfu: input.speProtonFluxPfu,
      gcrDoseRateMsvDay: input.gcrDoseRateMsvDay,
      cumulativeDoseMsv: input.cumulativeMissionDoseMsv,
      evaActive: input.evaActive,
      stormTier,
      currentDoseRateMsvHour,
      projected24hDoseMsv,
      shelterInPlaceRequired,
      evaAbortImmediate,
      arsSyndromeStage,
      filgrastimIndicated,
      radioprotectionPlan,
      clinicalDirectives: directives
    };
  }

  /**
   * Persists solar radiation telemetry to database.
   */
  public static async recordRadiationLog(input: SolarRadInput): Promise<SolarRadResult> {
    const result = this.evaluateRadiation(input);
    const insertQuery = `
      INSERT INTO solar_radiation_logs (
        mission_phase, spe_proton_flux_pfu, gcr_dose_rate_msv_day, cumulative_dose_msv,
        eva_active, storm_tier, shelter_in_place_required, ars_syndrome_stage,
        filgrastim_indicated, radioprotection_plan
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, logged_at;
    `;
    const res = await query(insertQuery, [
      result.missionPhase,
      result.speProtonFluxPfu,
      result.gcrDoseRateMsvDay,
      result.cumulativeDoseMsv,
      result.evaActive,
      result.stormTier,
      result.shelterInPlaceRequired,
      result.arsSyndromeStage,
      result.filgrastimIndicated,
      JSON.stringify(result.radioprotectionPlan)
    ]);
    if (res.rows.length > 0) {
      result.id = res.rows[0].id;
    }
    return result;
  }
}
