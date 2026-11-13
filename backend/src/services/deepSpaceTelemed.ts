import crypto from 'crypto';
import { query } from '../db';

export interface DeepSpaceTelemedInput {
  patientId: number;
  missionDistanceAu: number; // Distance in Astronomical Units (e.g. 1.524 for Mars)
  symptoms: string[]; // e.g. ['severe_right_flank_pain', 'microscopic_hematuria', 'nausea', 'bone_density_loss']
  vitals: {
    heartRate: number;
    systolicBp: number;
    diastolicBp: number;
    tempCelsius: number;
    spo2Pct: number;
  };
  pocusFindings?: string[]; // e.g. ['hydronephrosis_right_kidney', 'acoustic_shadowing_ureteral_calculus']
  onboardLabFindings?: {
    serumCalciumMgDl?: number; // e.g. 11.2 (elevated from microgravity osteoclast resorption)
    hematuriaDipstick?: boolean;
    whiteBloodCellCount?: number;
    lactateMmolL?: number;
  };
}

export interface DiagnosticHypothesis {
  condition: string;
  priorProbability: number;
  posteriorProbability: number;
  keyEvidence: string[];
}

export interface DeepSpaceTelemedResult {
  id?: number;
  patientId: number;
  missionDistanceAu: number;
  oneWayLatencyMinutes: number;
  roundTripDelayMinutes: number;
  clinicalAutonomyMandated: boolean;
  differentials: DiagnosticHypothesis[];
  primaryDiagnosis: string;
  confidenceScorePct: number;
  onboardTreatmentPlan: {
    immediateDirectives: string[];
    pharmacotherapy: string[];
    austereResourceConservation: string[];
    surgicalContingency: string;
  };
  earthBurstPayload: {
    transmissionHeader: {
      missionTimeElapsed: string;
      spacecraftId: string;
      oneWayDelayMin: number;
      securityClearance: string;
    };
    vitalSummary: Record<string, number>;
    primaryAssessment: string;
    actionTaken: string[];
  };
  cryptographicSignature: string;
  clinicalAlerts: string[];
}

export class DeepSpaceTelemedService {
  private static readonly AU_KM = 149597870.7;
  private static readonly C_KM_S = 299792.458;

  /**
   * Calculates speed-of-light communication latency to Earth based on orbital distance in AU.
   */
  public static calculateLatency(distanceAu: number): { oneWayMinutes: number; roundTripMinutes: number } {
    const oneWaySeconds = (distanceAu * this.AU_KM) / this.C_KM_S;
    const oneWayMinutes = parseFloat((oneWaySeconds / 60.0).toFixed(2));
    const roundTripMinutes = parseFloat((oneWayMinutes * 2.0).toFixed(2));
    return { oneWayMinutes, roundTripMinutes };
  }

  /**
   * Autonomous Bayesian Diagnostic Engine for deep-space missions under severe comms latency.
   */
  public static evaluateAutonomousTelemed(input: DeepSpaceTelemedInput): DeepSpaceTelemedResult {
    const alerts: string[] = [];
    const { oneWayMinutes, roundTripMinutes } = this.calculateLatency(input.missionDistanceAu);

    const clinicalAutonomyMandated = oneWayMinutes >= 3.0; // Any delay >= 3 mins prohibits real-time terrestrial guidance
    if (clinicalAutonomyMandated) {
      alerts.push(`INTERPLANETARY COMMS LATENCY: One-way delay is ${oneWayMinutes} mins (Round-trip ${roundTripMinutes} mins). Autonomous onboard clinical resolution active.`);
    }

    // 1. Multi-Hypothesis Bayesian Probability Calculations
    // Prior probabilities in deep space
    let nephrolithiasisWeight = 0.35; // high in microgravity due to bone resorption hypercalciuria
    let appendicitisWeight = 0.20;
    let dcsBendsWeight = 0.15;
    let bowelObstructionWeight = 0.15;
    let toxicInhalationWeight = 0.15;

    const nephrolithiasisEvidence: string[] = [];
    const appendicitisEvidence: string[] = [];
    const dcsEvidence: string[] = [];

    // Analyze symptoms
    if (input.symptoms.includes('severe_right_flank_pain') || input.symptoms.includes('colicky_pain')) {
      nephrolithiasisWeight *= 3.5;
      nephrolithiasisEvidence.push('Colicky unilateral flank pain');
    }
    if (input.symptoms.includes('microscopic_hematuria') || input.onboardLabFindings?.hematuriaDipstick) {
      nephrolithiasisWeight *= 3.0;
      nephrolithiasisEvidence.push('Microscopic hematuria on dipstick');
    }
    if (input.symptoms.includes('bone_density_loss') || (input.onboardLabFindings?.serumCalciumMgDl && input.onboardLabFindings.serumCalciumMgDl > 10.5)) {
      nephrolithiasisWeight *= 2.5;
      nephrolithiasisEvidence.push(`Hypercalcemia (${input.onboardLabFindings?.serumCalciumMgDl || 11.0} mg/dL) from osteoclastic microgravity unloading`);
    }

    // Ultrasound POCUS Evidence
    if (input.pocusFindings) {
      if (input.pocusFindings.includes('hydronephrosis_right_kidney') || input.pocusFindings.includes('acoustic_shadowing_ureteral_calculus')) {
        nephrolithiasisWeight *= 5.0;
        nephrolithiasisEvidence.push('POCUS reveals ureteral calculus with proximal hydronephrosis');
      }
      if (input.pocusFindings.includes('non_compressible_appendix') || input.pocusFindings.includes('target_sign_rlq')) {
        appendicitisWeight *= 6.0;
        appendicitisEvidence.push('POCUS demonstrates non-compressible aperistaltic appendix > 6mm');
      }
    }

    if (input.vitals.tempCelsius >= 38.3) {
      appendicitisWeight *= 2.5;
      appendicitisEvidence.push(`Fever (${input.vitals.tempCelsius} C) favoring acute inflammatory infectious etiology`);
    }

    if (input.symptoms.includes('joint_pain_post_eva') || input.symptoms.includes('decompression_itch')) {
      dcsBendsWeight *= 4.0;
      dcsEvidence.push('Post-EVA joint and periarticular pain');
    }

    // Normalize probabilities
    const totalWeight = nephrolithiasisWeight + appendicitisWeight + dcsBendsWeight + bowelObstructionWeight + toxicInhalationWeight;
    const pNephro = parseFloat((nephrolithiasisWeight / totalWeight).toFixed(3));
    const pAppy = parseFloat((appendicitisWeight / totalWeight).toFixed(3));
    const pDcs = parseFloat((dcsBendsWeight / totalWeight).toFixed(3));
    const pObst = parseFloat((bowelObstructionWeight / totalWeight).toFixed(3));
    const pToxic = parseFloat((toxicInhalationWeight / totalWeight).toFixed(3));

    const differentials: DiagnosticHypothesis[] = [
      { condition: 'Spaceflight Nephrolithiasis (Microgravity Hypercalciuric Calculus)', priorProbability: 0.35, posteriorProbability: pNephro, keyEvidence: nephrolithiasisEvidence },
      { condition: 'Acute Appendicitis', priorProbability: 0.20, posteriorProbability: pAppy, keyEvidence: appendicitisEvidence },
      { condition: 'Decompression Sickness (EVA Hypobaric Dysbarism)', priorProbability: 0.15, posteriorProbability: pDcs, keyEvidence: dcsEvidence },
      { condition: 'Mechanical Bowel Obstruction / Volvulus', priorProbability: 0.15, posteriorProbability: pObst, keyEvidence: ['Microgravity visceral displacement'] },
      { condition: 'Toxic Inhalation Pneumonitis', priorProbability: 0.15, posteriorProbability: pToxic, keyEvidence: ['Closed ECLSS trace chemical exposure'] }
    ].sort((a, b) => b.posteriorProbability - a.posteriorProbability);

    const primary = differentials[0];
    const confidenceScorePct = Math.round(primary.posteriorProbability * 100);

    // 2. Onboard Treatment Plan
    const immediateDirectives: string[] = [];
    const pharmacotherapy: string[] = [];
    const austereResourceConservation: string[] = [];
    let surgicalContingency = 'None immediately required. Medical management prioritized in austere flight regime.';

    if (primary.condition.includes('Nephrolithiasis')) {
      immediateDirectives.push('Bedside ultrasound guided tracking of ureteral calculus and resistive index.');
      immediateDirectives.push('Fluid hydration therapy: Target 2.5 - 3.0 L/day oral or IV balanced fluids to promote stone passage.');
      pharmacotherapy.push('Ketorolac 30 mg IV or Ibuprofen 800 mg PO q8h for renal capsular prostaglandin inhibition.');
      pharmacotherapy.push('Tamsulosin 0.4 mg PO daily to relax distal ureteral smooth muscle.');
      pharmacotherapy.push('Ondansetron 4-8 mg PO/IV PRN for visceral nausea.');
      austereResourceConservation.push('Limit IV crystalloid bags to < 2.0 L total to preserve spacecraft medical water reserve; transition to oral electrolyte solution as soon as nausea controlled.');
      surgicalContingency = 'If intractable obstruction or infected stone (sepsis/fever) develops, prepare percutaneous nephrostomy or urgent telemedicine surgical consultation.';
      alerts.push(`DIAGNOSIS: Spaceflight Nephrolithiasis identified with ${confidenceScorePct}% posterior probability. Medical expulsive therapy initiated.`);
    } else if (primary.condition.includes('Appendicitis')) {
      immediateDirectives.push('Strict NPO; continuous abdominal exam and serial WBC/lactate checks.');
      pharmacotherapy.push('Non-operative deep-space protocol: Ceftriaxone 2g IV q24h + Metronidazole 500mg IV q8h.');
      surgicalContingency = 'Prepare hermetic surgical canopy and laparoscopic instruments if medical antibiotic failure occurs.';
      alerts.push(`DIAGNOSIS: Acute Appendicitis identified (${confidenceScorePct}%). Non-operative antibiotic management active.`);
    }

    // 3. Cryptographic Deep Space Burst Payload
    const earthBurstPayload = {
      transmissionHeader: {
        missionTimeElapsed: `MET Day ${Math.round(input.missionDistanceAu * 100)}`,
        spacecraftId: 'ARES-DEEP-SPACE-EXPLORER',
        oneWayDelayMin: oneWayMinutes,
        securityClearance: 'MEDICAL_CONFIDENTIAL_FLIGHT_SURGEON'
      },
      vitalSummary: {
        hr: input.vitals.heartRate,
        sbp: input.vitals.systolicBp,
        temp: input.vitals.tempCelsius,
        spo2: input.vitals.spo2Pct
      },
      primaryAssessment: primary.condition,
      actionTaken: immediateDirectives
    };

    const payloadString = JSON.stringify(earthBurstPayload);
    const cryptographicSignature = crypto.createHash('sha256').update(payloadString).digest('hex');

    return {
      patientId: input.patientId,
      missionDistanceAu: input.missionDistanceAu,
      oneWayLatencyMinutes: oneWayMinutes,
      roundTripDelayMinutes: roundTripMinutes,
      clinicalAutonomyMandated,
      differentials,
      primaryDiagnosis: primary.condition,
      confidenceScorePct,
      onboardTreatmentPlan: {
        immediateDirectives,
        pharmacotherapy,
        austereResourceConservation,
        surgicalContingency
      },
      earthBurstPayload,
      cryptographicSignature,
      clinicalAlerts: alerts
    };
  }

  /**
   * Persists deep space telemedicine session to database.
   */
  public static async recordTelemedSession(input: DeepSpaceTelemedInput): Promise<DeepSpaceTelemedResult> {
    const result = this.evaluateAutonomousTelemed(input);
    const insertQuery = `
      INSERT INTO deep_space_telemed_sessions (
        patient_id, mission_distance_au, one_way_latency_minutes, round_trip_delay_minutes,
        symptoms, primary_differential, posterior_probability, onboard_treatment_plan,
        earth_burst_payload, cryptographic_hash
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, created_at;
    `;
    const res = await query(insertQuery, [
      result.patientId,
      result.missionDistanceAu,
      result.oneWayLatencyMinutes,
      result.roundTripDelayMinutes,
      JSON.stringify(input.symptoms),
      result.primaryDiagnosis,
      result.confidenceScorePct / 100.0,
      JSON.stringify(result.onboardTreatmentPlan),
      JSON.stringify(result.earthBurstPayload),
      result.cryptographicSignature
    ]);
    if (res.rows.length > 0) {
      result.id = res.rows[0].id;
    }
    return result;
  }
}
