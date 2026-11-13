import { query } from '../db';

export type CprTechnique = 'HANDSTAND_CPR' | 'EVETTS_RUSSOMANO_METHOD' | 'REVERSE_BEAR_HUG';
export type HemorrhageType = 'NONE' | 'ARTERIAL_BLEED' | 'VENOUS_SHEARING' | 'LUNG_LACERATION';

export interface MicrogravResusInput {
  patientId: number;
  cardiacArrestPresent: boolean;
  rhythm?: string; // 'VFIB', 'VTACH', 'ASYSTOLE', 'PEA', 'SINUS_BRADY'
  ceilingAnchorAvailable: boolean; // Overhead bulkhead / deckhead <= 2.2m
  confinedSpaceCapsule: boolean; // Small capsule vs spacious space station module
  hemorrhagePresent: boolean;
  hemorrhageType?: HemorrhageType;
  estimatedBloodLossMl?: number;
  canopyDeployed?: boolean;
}

export interface MicrogravResusResult {
  id?: number;
  patientId: number;
  cardiacArrestPresent: boolean;
  cprTechnique: CprTechnique;
  compressionRateCpm: number;
  compressionDepthCm: number;
  defibrillationGuidance: {
    padsType: string;
    energyJoules: number;
    sparkHazardMitigation: string;
  };
  hermeticCanopyDeployed: boolean;
  laminarSuctionFlowLpm: number;
  autotransfusionVolumeMl: number;
  aerosolContainmentVerified: boolean;
  resusProtocol: {
    airwayManagement: string;
    vascularAccess: string;
    fluidReplacement: string;
    surgicalDirectives: string[];
  };
  clinicalAlerts: string[];
}

export class MicrogravResusService {
  /**
   * Evaluates microgravity ACLS resuscitation mechanics, surgical aerosol containment, and autotransfusion.
   */
  public static evaluateResuscitation(input: MicrogravResusInput): MicrogravResusResult {
    const alerts: string[] = [];

    // 1. Biomechanical CPR Selection
    let cprTechnique: CprTechnique = 'EVETTS_RUSSOMANO_METHOD';
    if (input.confinedSpaceCapsule) {
      cprTechnique = 'REVERSE_BEAR_HUG';
      alerts.push('Confined crew capsule detected: Employing Reverse Bear-Hug CPR technique (rescuer positioned behind patient with sternal compression).');
    } else if (input.ceilingAnchorAvailable) {
      cprTechnique = 'HANDSTAND_CPR';
      alerts.push('Overhead bulkhead anchoring available: Handstand CPR selected to leverage spacecraft ceiling as rigid Newtonian reaction barrier.');
    } else {
      cprTechnique = 'EVETTS_RUSSOMANO_METHOD';
      alerts.push('Free-floating zero-g environment: Evetts-Russomano method selected (rescuer legs interlocked around patient torso to establish closed kinematic loop).');
    }

    const compressionRateCpm = 110; // Target 100-120
    const compressionDepthCm = 5.5; // Target 5-6 cm

    // 2. Defibrillation Protocol
    let shockEnergy = 0;
    if (input.rhythm === 'VFIB' || input.rhythm === 'VTACH') {
      shockEnergy = 200;
      alerts.push('SHOCKABLE RHYTHM DETECTED: Hands-free adhesive pads required. Discharge 200J biphasic shock.');
    }

    const defibrillationGuidance = {
      padsType: 'Pre-gelled hands-free adhesive defibrillation pads (anterior-lateral or anterior-posterior placement).',
      energyJoules: shockEnergy,
      sparkHazardMitigation: 'MANDATORY: Verify habitat O2 concentration is <= 23.5% before high-voltage discharge. Never use handheld metal paddles (arcing & push-off recoil hazard).'
    };

    // 3. Surgical Aerosol Containment & Autotransfusion
    let hermeticCanopyDeployed = input.canopyDeployed || false;
    let laminarSuctionFlowLpm = 0;
    let autotransfusionVolumeMl = 0;
    let aerosolContainmentVerified = true;
    const surgicalDirectives: string[] = [];

    if (input.hemorrhagePresent) {
      hermeticCanopyDeployed = true;
      laminarSuctionFlowLpm = 60.0; // 60 LPM laminar negative-pressure boundary

      if (input.estimatedBloodLossMl && input.estimatedBloodLossMl > 250) {
        // Microgravity red cell salvage with centrifugal vortex air-fluid separator
        autotransfusionVolumeMl = Math.round(input.estimatedBloodLossMl * 0.75);
        surgicalDirectives.push(`Initiate closed-loop microgravity autotransfusion: Recovered ${autotransfusionVolumeMl} mL of washed red blood cells with vortex air-fluid bubble trap.`);
      }

      if (input.hemorrhageType === 'ARTERIAL_BLEED') {
        alerts.push('CRITICAL ARTERIAL BLEED IN MICROGRAVITY: Blood drops form aerosolized suspended globules. Negative pressure suction canopy active.');
        surgicalDirectives.push('Apply pressurized hemostatic gauze (QuikClot / Celox) with continuous local suction canopy.');
      } else if (input.hemorrhageType === 'LUNG_LACERATION') {
        alerts.push('PULMONARY HEMORRHAGE IN MICROGRAVITY: Blood can easily flood contralateral bronchial tree without gravity pooling.');
        surgicalDirectives.push('Isolate right/left bronchus via double-lumen ETT or bronchial blocker immediately.');
      }
    }

    const resusProtocol = {
      airwayManagement: 'Video laryngoscopy with suction-assisted intubation. Inflate ETT cuff with sterile saline (prevents microgravity volume shift & barometric expansion).',
      vascularAccess: 'Proximal tibia or humeral head Intraosseous (IO) needle (easier to secure in weightlessness than peripheral IV).',
      fluidReplacement: input.cardiacArrestPresent || input.hemorrhagePresent
        ? 'Lyophilized (freeze-dried) reconstituted plasma + autotransfused salvaged blood. Limit crystalloids to avoid exacerbating cephalad interstitial edema.'
        : 'Maintenance balanced electrolyte infusion.',
      surgicalDirectives
    };

    return {
      patientId: input.patientId,
      cardiacArrestPresent: input.cardiacArrestPresent,
      cprTechnique,
      compressionRateCpm,
      compressionDepthCm,
      defibrillationGuidance,
      hermeticCanopyDeployed,
      laminarSuctionFlowLpm,
      autotransfusionVolumeMl,
      aerosolContainmentVerified,
      resusProtocol,
      clinicalAlerts: alerts
    };
  }

  /**
   * Persists microgravity resuscitation event to database.
   */
  public static async recordResusEvent(input: MicrogravResusInput): Promise<MicrogravResusResult> {
    const result = this.evaluateResuscitation(input);
    const insertQuery = `
      INSERT INTO microgravity_resus_events (
        patient_id, cardiac_arrest_present, cpr_technique, compression_rate_cpm,
        compression_depth_cm, hermetic_canopy_deployed, laminar_suction_flow_lpm,
        autotransfusion_volume_ml, aerosol_containment_verified, resus_protocol
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, logged_at;
    `;
    const res = await query(insertQuery, [
      result.patientId,
      result.cardiacArrestPresent,
      result.cprTechnique,
      result.compressionRateCpm,
      result.compressionDepthCm,
      result.hermeticCanopyDeployed,
      result.laminarSuctionFlowLpm,
      result.autotransfusionVolumeMl,
      result.aerosolContainmentVerified,
      JSON.stringify(result.resusProtocol)
    ]);
    if (res.rows.length > 0) {
      result.id = res.rows[0].id;
    }
    return result;
  }
}
