import { query } from '../db';

export interface TmaHematologyInput {
  patientId: number;
  plateletsK: number; // e.g. 18 = 18,000/uL
  hemolysisPresent: boolean; // schistocytes + undetectable haptoglobin / retic > 2.5% / indirect bili > 2.0
  activeCancer: boolean;
  solidOrganOrStemCellTransplant: boolean;
  mcvFl: number;
  inr: number;
  creatinineMgDl: number;
  ptProlongationSec: number;
  fibrinogenMgDl: number;
  dDimerElevation: 'NORMAL' | 'MODERATE' | 'SEVERE';
}

export interface TmaHematologyResult {
  id?: number;
  patientId: number;
  plasmicScore: number; // 0-7
  plasmicRiskTier: 'LOW' | 'INTERMEDIATE' | 'HIGH';
  isthDicScore: number; // 0-8
  overtDicPresent: boolean;
  primaryTmaSyndrome: 'HIGH_PROBABILITY_TTP' | 'OVERT_DIC' | 'SUSPECTED_AHUS_COMPLEMENT_TMA' | 'INDETERMINATE_TMA';
  tpeUrgentIndicated: boolean;
  plateletTransfusionProhibited: boolean;
  hematologyDirectives: string[];
}

export class TmaHematologyService {
  public static evaluateTma(input: TmaHematologyInput): TmaHematologyResult {
    const directives: string[] = [];

    // 1. PLASMIC Score (0-7)
    let plasmic = 0;
    if (input.plateletsK < 30) plasmic++;
    if (input.hemolysisPresent) plasmic++;
    if (!input.activeCancer) plasmic++;
    if (!input.solidOrganOrStemCellTransplant) plasmic++;
    if (input.mcvFl < 90) plasmic++;
    if (input.inr < 1.5) plasmic++;
    if (input.creatinineMgDl < 2.0) plasmic++;

    const plasmicRiskTier: TmaHematologyResult['plasmicRiskTier'] =
      plasmic >= 6 ? 'HIGH' : plasmic === 5 ? 'INTERMEDIATE' : 'LOW';

    // 2. ISTH Overt DIC Score (0-8)
    let isth = 0;
    if (input.plateletsK < 50) isth += 2;
    else if (input.plateletsK < 100) isth += 1;

    if (input.dDimerElevation === 'SEVERE') isth += 3;
    else if (input.dDimerElevation === 'MODERATE') isth += 2;

    if (input.ptProlongationSec >= 6.0) isth += 2;
    else if (input.ptProlongationSec >= 3.0) isth += 1;

    if (input.fibrinogenMgDl < 100) isth += 1;

    const overtDicPresent = isth >= 5;

    // 3. Syndrome Arbitration
    let primaryTmaSyndrome: TmaHematologyResult['primaryTmaSyndrome'] = 'INDETERMINATE_TMA';
    let tpeUrgentIndicated = false;
    let plateletTransfusionProhibited = false;

    if (overtDicPresent && input.inr >= 1.5) {
      primaryTmaSyndrome = 'OVERT_DIC';
      directives.push(`OVERT DIC (ISTH Score ${isth}/8): Treat underlying trigger urgently. Replace fibrinogen with Cryoprecipitate if < 100-150 mg/dL.`);
    } else if (plasmic >= 6) {
      primaryTmaSyndrome = 'HIGH_PROBABILITY_TTP';
      tpeUrgentIndicated = true;
      plateletTransfusionProhibited = true;
      directives.push(
        `EMERGENT TTP (PLASMIC ${plasmic}/7): Draw baseline ADAMTS13 activity NOW, then start STAT Therapeutic Plasma Exchange (TPE 1.0-1.5 PV daily) + Methylprednisolone 1g IV + Caplacizumab 10 mg IV/SC.`
      );
      directives.push('STRICT CONTRAINDICATION: Prophylactic platelet transfusion PROHIBITED in TTP (accelerates microvascular thrombosis).');
    } else if (input.hemolysisPresent && input.plateletsK < 150 && input.creatinineMgDl >= 2.0) {
      primaryTmaSyndrome = 'SUSPECTED_AHUS_COMPLEMENT_TMA';
      directives.push(
        'SUSPECTED COMPLEMENT-MEDIATED aHUS: Send stool Shiga toxin/STEC PCR and ADAMTS13. If ADAMTS13 > 10% and STEC negative, initiate Eculizumab / Ravulizumab with meningococcal prophylaxis.'
      );
    } else {
      directives.push(`Intermediate/Indeterminate TMA (PLASMIC ${plasmic}/7, ISTH ${isth}/8): Obtain urgent peripheral blood smear for schistocytes and ADAMTS13 assay.`);
    }

    return {
      patientId: input.patientId,
      plasmicScore: plasmic,
      plasmicRiskTier,
      isthDicScore: isth,
      overtDicPresent,
      primaryTmaSyndrome,
      tpeUrgentIndicated,
      plateletTransfusionProhibited,
      hematologyDirectives: directives
    };
  }

  public static async recordEvaluation(input: TmaHematologyInput): Promise<TmaHematologyResult> {
    const result = this.evaluateTma(input);
    const res = await query(
      `INSERT INTO tma_hematology_evals (
        patient_id, plasmic_score, isth_dic_score, primary_tma_syndrome,
        tpe_urgent_indicated, platelet_transfusion_prohibited, eval_output
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id;`,
      [
        result.patientId,
        result.plasmicScore,
        result.isthDicScore,
        result.primaryTmaSyndrome,
        result.tpeUrgentIndicated,
        result.plateletTransfusionProhibited,
        JSON.stringify(result)
      ]
    );
    if (res.rows.length > 0) {
      result.id = res.rows[0].id;
    }
    return result;
  }
}
