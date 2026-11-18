import { query } from '../db';

export interface NeuroPrognosisInput {
  patientId: number;
  hoursPostRoscOrRewarming: number;
  coreTempCelsius: number;
  systolicBp: number;
  mapMmhg: number;
  sedativesCleared5HalfLives: boolean;
  neuromuscularBlockerCleared: boolean;
  severeMetabolicConfounderAbsent: boolean;
  // Multimodal poor-outcome predictors
  bilateralAbsentPupillaryCorneal: boolean;
  bilateralAbsentN20Ssep: boolean;
  highlyMalignantEeg: boolean;
  nseUgL?: number; // > 60 ug/L at 48-72h
  statusMyoclonusWithin72h: boolean;
  diffuseAnoxicMriCtInjury: boolean;
  // AAN 2023 Brain Death Apnea Test
  apneaTestPerformed?: boolean;
  apneaBaselinePaco2Mmhg?: number;
  apneaFinalPaco2Mmhg?: number;
  respiratoryEffortObserved?: boolean;
}

export interface NeuroPrognosisResult {
  id?: number;
  patientId: number;
  hoursPostRosc: number;
  confoundersCleared: boolean;
  blockingConfounders: string[];
  concordantPoorPredictors: number;
  poorPredictorList: string[];
  prognosisStatus:
    | 'BLOCKED_PREMATURE_OR_CONFOUNDED'
    | 'INDETERMINATE_CONTINUE_OBSERVATION'
    | 'POOR_NEUROLOGIC_OUTCOME_HIGH_CERTAINTY';
  aanBdDncEligible: boolean;
  clinicalDirectives: string[];
}

export class NeuroPrognosticationService {
  public static evaluatePrognosis(input: NeuroPrognosisInput): NeuroPrognosisResult {
    const blockingConfounders: string[] = [];
    const poorPredictorList: string[] = [];
    const directives: string[] = [];

    // 1. Confounder & 72-Hour Premature WLST Guard
    if (input.hoursPostRoscOrRewarming < 72) {
      blockingConfounders.push(`Only ${input.hoursPostRoscOrRewarming}h post-ROSC/rewarming (Minimum 72h required).`);
    }
    if (input.coreTempCelsius < 36.0) {
      blockingConfounders.push(`Hypothermia present (${input.coreTempCelsius}°C < 36.0°C).`);
    }
    if (!input.sedativesCleared5HalfLives) {
      blockingConfounders.push('Residual sedatives/analgesics not cleared (>= 5 half-lives required).');
    }
    if (!input.neuromuscularBlockerCleared) {
      blockingConfounders.push('Neuromuscular blockade not excluded (verify Train-of-Four 4/4).');
    }
    if (!input.severeMetabolicConfounderAbsent) {
      blockingConfounders.push('Severe electrolyte, acid-base, or endocrine confounder active.');
    }

    const confoundersCleared = blockingConfounders.length === 0;

    // 2. Count Multimodal Poor-Outcome Predictors
    if (input.bilateralAbsentPupillaryCorneal) poorPredictorList.push('Bilaterally absent pupillary and corneal reflexes');
    if (input.bilateralAbsentN20Ssep) poorPredictorList.push('Bilaterally absent cortical N20 SSEP waves');
    if (input.highlyMalignantEeg) poorPredictorList.push('Highly malignant EEG (suppressed or unreactive burst-suppression)');
    if (input.nseUgL !== undefined && input.nseUgL > 60) poorPredictorList.push(`Elevated Neuron-Specific Enolase (NSE ${input.nseUgL} ug/L > 60)`);
    if (input.statusMyoclonusWithin72h) poorPredictorList.push('Status myoclonus within 72h post-arrest');
    if (input.diffuseAnoxicMriCtInjury) poorPredictorList.push('Diffuse extensive anoxic brain injury on CT/MRI');

    const concordantPoorPredictors = poorPredictorList.length;

    let prognosisStatus: NeuroPrognosisResult['prognosisStatus'] = 'INDETERMINATE_CONTINUE_OBSERVATION';
    if (!confoundersCleared) {
      prognosisStatus = 'BLOCKED_PREMATURE_OR_CONFOUNDED';
      directives.push('PREMATURE PROGNOSTICATION BLOCKED: Do NOT withdraw life-sustaining therapy for neurologic prognosis until all confounders are cleared and >= 72h elapsed.');
    } else if (concordantPoorPredictors >= 2) {
      prognosisStatus = 'POOR_NEUROLOGIC_OUTCOME_HIGH_CERTAINTY';
      directives.push(
        `MULTIMODAL CONCORDANCE (${concordantPoorPredictors} predictors): Poor neurologic outcome predicted with high specificity (<1% false-positive rate). Conduct structured goals-of-care family conference.`
      );
    } else {
      directives.push(
        `INDETERMINATE PROGNOSIS (${concordantPoorPredictors}/2 required concordant predictors): Continue full ICU support and repeat multimodal assessment in 24-48h.`
      );
    }

    // 3. AAN 2023 Brain Death / Death by Neurologic Criteria (BD/DNC) Guard
    const aanPrereqsMet =
      input.coreTempCelsius >= 36.0 &&
      input.systolicBp >= 100 &&
      input.mapMmhg >= 75 &&
      input.sedativesCleared5HalfLives &&
      input.neuromuscularBlockerCleared &&
      input.severeMetabolicConfounderAbsent &&
      input.bilateralAbsentPupillaryCorneal;

    const apneaPositive =
      Boolean(input.apneaTestPerformed) &&
      input.respiratoryEffortObserved === false &&
      (input.apneaFinalPaco2Mmhg ?? 0) >= 60 &&
      (input.apneaFinalPaco2Mmhg ?? 0) - (input.apneaBaselinePaco2Mmhg ?? 40) >= 20;

    const aanBdDncEligible = aanPrereqsMet && apneaPositive;

    if (aanBdDncEligible) {
      directives.push(
        'AAN 2023 BD/DNC CRITERIA SATISFIED: Prerequisites (T>=36°C, SBP>=100, MAP>=75), absent brainstem reflexes, and positive apnea test (PaCO2>=60 & rise>=20 mmHg) confirmed.'
      );
    }

    return {
      patientId: input.patientId,
      hoursPostRosc: input.hoursPostRoscOrRewarming,
      confoundersCleared,
      blockingConfounders,
      concordantPoorPredictors,
      poorPredictorList,
      prognosisStatus,
      aanBdDncEligible,
      clinicalDirectives: directives
    };
  }

  public static async recordPrognosis(input: NeuroPrognosisInput): Promise<NeuroPrognosisResult> {
    const result = this.evaluatePrognosis(input);
    const res = await query(
      `INSERT INTO neuro_prognostication_evals (
        patient_id, hours_post_rosc, confounders_cleared, concordant_poor_predictors,
        prognosis_status, aan_bd_dnc_eligible, eval_output
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id;`,
      [
        result.patientId,
        result.hoursPostRosc,
        result.confoundersCleared,
        result.concordantPoorPredictors,
        result.prognosisStatus,
        result.aanBdDncEligible,
        JSON.stringify(result)
      ]
    );
    if (res.rows.length > 0) {
      result.id = res.rows[0].id;
    }
    return result;
  }
}
