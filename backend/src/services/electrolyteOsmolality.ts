import { query } from '../db';

export interface ElectrolyteOsmInput {
  patientId: number;
  weightKg: number;
  sex: 'M' | 'F';
  measuredSodiumMeqL: number;
  previousSodium24hAgoMeqL?: number;
  potassiumMeqL: number;
  chlorideMeqL: number;
  bicarbonateMeqL: number;
  albuminGDl: number;
  glucoseMgDl: number;
  bunMgDl: number;
  measuredOsmolalityMOsmKg?: number;
  ethanolMgDl?: number;
  arterialPh: number;
  paco2Mmhg: number;
  highOdsRiskFactors?: boolean; // alcoholism, malnutrition, cirrhosis
}

export interface ElectrolyteOsmResult {
  id?: number;
  patientId: number;
  correctedSodiumMeqL: number;
  deltaSodium24h: number;
  odsOvercorrectionRisk: boolean;
  freeWaterDeficitLiters: number;
  correctedAnionGap: number;
  wintersExpectedPaco2Min: number;
  wintersExpectedPaco2Max: number;
  osmolarGap: number;
  acidBaseDiagnosis: string;
  clinicalDirectives: string[];
}

export class ElectrolyteOsmolalityService {
  public static evaluateElectrolytes(input: ElectrolyteOsmInput): ElectrolyteOsmResult {
    const directives: string[] = [];

    // 1. Hyperglycemia-Corrected Sodium (Katz 1.6 vs Hillier 2.4)
    const glucoseExcess = Math.max(0, input.glucoseMgDl - 100) / 100.0;
    const correctionFactor = input.glucoseMgDl > 400 ? 2.4 : 1.6;
    const correctedSodiumMeqL = parseFloat((input.measuredSodiumMeqL + correctionFactor * glucoseExcess).toFixed(1));

    // 2. Osmolar Gap
    const ethanolTerm = (input.ethanolMgDl ?? 0) / 4.6;
    const calcOsm = 2 * input.measuredSodiumMeqL + input.glucoseMgDl / 18.0 + input.bunMgDl / 2.8 + ethanolTerm;
    const osmolarGap =
      input.measuredOsmolalityMOsmKg !== undefined
        ? parseFloat((input.measuredOsmolalityMOsmKg - calcOsm).toFixed(1))
        : 0;

    if (osmolarGap > 10.0) {
      directives.push(`ELEVATED OSMOLAR GAP (${osmolarGap} mOsm/kg > 10): Suspect toxic alcohol ingestion (Methanol, Ethylene Glycol, or Isopropanol). Consider Fomepizole.`);
    }

    // 3. ODS Overcorrection Guard & Free Water Deficit
    const prevNa = input.previousSodium24hAgoMeqL ?? input.measuredSodiumMeqL;
    const deltaSodium24h = parseFloat((input.measuredSodiumMeqL - prevNa).toFixed(1));
    const highRiskOds = Boolean(input.highOdsRiskFactors || input.potassiumMeqL < 3.0);
    const safe24hCeiling = highRiskOds ? 6.0 : 8.0;
    const odsOvercorrectionRisk = prevNa < 130 && deltaSodium24h > safe24hCeiling;

    if (odsOvercorrectionRisk) {
      directives.push(
        `CRITICAL ODS OVERCORRECTION RISK: Na+ rose +${deltaSodium24h} mEq/L in 24h (Ceiling: ${safe24hCeiling} mEq/L). Administer Desmopressin (DDAVP) 2 mcg IV q6h + D5W rescue infusion to prevent Osmotic Demyelination Syndrome.`
      );
    }

    const tbwFactor = input.sex === 'M' ? 0.6 : 0.5;
    const tbw = tbwFactor * input.weightKg;
    const freeWaterDeficitLiters =
      correctedSodiumMeqL > 145
        ? parseFloat((tbw * (correctedSodiumMeqL / 140.0 - 1.0)).toFixed(2))
        : 0;

    if (freeWaterDeficitLiters > 0) {
      directives.push(`HYPERNATREMIA FREE WATER DEFICIT: ${freeWaterDeficitLiters} L. Replace slowly over 48-72h (max Na+ drop <= 8-10 mEq/L per 24h) to avoid cerebral edema.`);
    }

    // 4. Albumin-Corrected Anion Gap & Acid-Base Triple-Disorder Solver
    const rawAg = input.measuredSodiumMeqL - (input.chlorideMeqL + input.bicarbonateMeqL);
    const correctedAnionGap = parseFloat((rawAg + 2.5 * (4.0 - input.albuminGDl)).toFixed(1));

    const wintersMid = 1.5 * input.bicarbonateMeqL + 8.0;
    const wintersExpectedPaco2Min = parseFloat((wintersMid - 2.0).toFixed(1));
    const wintersExpectedPaco2Max = parseFloat((wintersMid + 2.0).toFixed(1));

    const disorders: string[] = [];
    if (correctedAnionGap > 12.0) {
      disorders.push('High Anion Gap Metabolic Acidosis (HAGMA)');
      const deltaAg = correctedAnionGap - 12.0;
      const deltaHco3 = Math.max(0.5, 24.0 - input.bicarbonateMeqL);
      const deltaRatio = deltaAg / deltaHco3;
      if (deltaRatio < 1.0) {
        disorders.push('Concurrent Non-Anion Gap Metabolic Acidosis (NAGMA)');
      } else if (deltaRatio > 2.0) {
        disorders.push('Concurrent Metabolic Alkalosis');
      }
    } else if (input.bicarbonateMeqL < 22 && input.arterialPh < 7.35) {
      disorders.push('Non-Anion Gap Metabolic Acidosis (NAGMA)');
    } else if (input.bicarbonateMeqL > 26 && input.arterialPh > 7.45) {
      disorders.push('Primary Metabolic Alkalosis');
    }

    if (input.bicarbonateMeqL < 22) {
      if (input.paco2Mmhg > wintersExpectedPaco2Max) {
        disorders.push('Concurrent Respiratory Acidosis (Inadequate Compensation)');
      } else if (input.paco2Mmhg < wintersExpectedPaco2Min) {
        disorders.push('Concurrent Respiratory Alkalosis');
      }
    } else if (input.arterialPh < 7.35 && input.paco2Mmhg > 45) {
      disorders.push('Primary Respiratory Acidosis');
    } else if (input.arterialPh > 7.45 && input.paco2Mmhg < 35) {
      disorders.push('Primary Respiratory Alkalosis');
    }

    const acidBaseDiagnosis = disorders.length > 0 ? disorders.join(' + ') : 'Normal Acid-Base Balance';

    return {
      patientId: input.patientId,
      correctedSodiumMeqL,
      deltaSodium24h,
      odsOvercorrectionRisk,
      freeWaterDeficitLiters,
      correctedAnionGap,
      wintersExpectedPaco2Min,
      wintersExpectedPaco2Max,
      osmolarGap,
      acidBaseDiagnosis,
      clinicalDirectives: directives
    };
  }

  public static async recordEvaluation(input: ElectrolyteOsmInput): Promise<ElectrolyteOsmResult> {
    const result = this.evaluateElectrolytes(input);
    const res = await query(
      `INSERT INTO electrolyte_osmolality_evals (
        patient_id, corrected_sodium_meq_l, corrected_anion_gap, osmolar_gap,
        ods_overcorrection_risk, acid_base_diagnosis, eval_output
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id;`,
      [
        result.patientId,
        result.correctedSodiumMeqL,
        result.correctedAnionGap,
        result.osmolarGap,
        result.odsOvercorrectionRisk,
        result.acidBaseDiagnosis,
        JSON.stringify(result)
      ]
    );
    if (res.rows.length > 0) {
      result.id = res.rows[0].id;
    }
    return result;
  }
}
