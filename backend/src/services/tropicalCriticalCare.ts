import { query } from '../db';

export type TropicalSyndrome = 'FALCIPARUM_MALARIA' | 'DENGUE_FEVER';

export interface TropicalCriticalCareInput {
  patientId: number;
  syndrome: TropicalSyndrome;
  weightKg: number;
  parasitemiaPct?: number;
  gcsScore: number;
  lactateMmolL: number;
  glucoseMgDl: number;
  hemoglobinGDl: number;
  bilirubinMgDl: number;
  creatinineMgDl: number;
  systolicBp: number;
  diastolicBp: number;
  hematocritRisePct?: number; // % rise above baseline
  plateletsK: number;
  mucosalBleedingPresent?: boolean;
}

export interface TropicalCriticalCareResult {
  id?: number;
  patientId: number;
  pathogenSyndrome: TropicalSyndrome;
  severityTier: 'UNCOMPLICATED' | 'WARNING_SIGNS_ADMIT' | 'CRITICAL_SEVERE_ICU';
  ivArtesunateIndicated: boolean;
  artesunateDoseMg: number;
  plasmaLeakageShock: boolean;
  pulsePressureMmhg: number;
  prohibitedAgents: string[];
  clinicalDirectives: string[];
}

export class TropicalCriticalCareService {
  public static evaluateTropical(input: TropicalCriticalCareInput): TropicalCriticalCareResult {
    const directives: string[] = [];
    const prohibitedAgents: string[] = [];

    const pulsePressureMmhg = Math.max(0, input.systolicBp - input.diastolicBp);
    let severityTier: TropicalCriticalCareResult['severityTier'] = 'UNCOMPLICATED';
    let ivArtesunateIndicated = false;
    let artesunateDoseMg = 0;
    let plasmaLeakageShock = false;

    if (input.syndrome === 'FALCIPARUM_MALARIA') {
      const severeCriteria: string[] = [];
      if ((input.parasitemiaPct ?? 0) > 5.0) severeCriteria.push(`Hyperparasitemia (${input.parasitemiaPct}%)`);
      if (input.gcsScore < 11) severeCriteria.push(`Cerebral Malaria (GCS ${input.gcsScore})`);
      if (input.lactateMmolL > 5.0) severeCriteria.push(`Severe Lactic Acidosis (${input.lactateMmolL} mmol/L)`);
      if (input.glucoseMgDl < 40) severeCriteria.push(`Severe Hypoglycemia (${input.glucoseMgDl} mg/dL)`);
      if (input.hemoglobinGDl < 7.0) severeCriteria.push(`Severe Malarial Anemia (Hb ${input.hemoglobinGDl} g/dL)`);
      if (input.bilirubinMgDl > 3.0) severeCriteria.push(`Jaundice (Bili ${input.bilirubinMgDl} mg/dL)`);
      if (input.creatinineMgDl > 3.0) severeCriteria.push(`Malarial AKI (Cr ${input.creatinineMgDl} mg/dL)`);

      if (severeCriteria.length > 0) {
        severityTier = 'CRITICAL_SEVERE_ICU';
        ivArtesunateIndicated = true;
        const mgPerKg = input.weightKg < 20 ? 3.0 : 2.4;
        artesunateDoseMg = Math.round(mgPerKg * input.weightKg);
        directives.push(
          `WHO SEVERE MALARIA [${severeCriteria.join(', ')}]: Administer STAT IV Artesunate ${artesunateDoseMg} mg (${mgPerKg} mg/kg) at 0h, 12h, and 24h, then daily.`
        );
        directives.push('Monitor blood glucose q2-4h (parasite consumption & quinine/severe malaria hypoglycemia risk).');
        directives.push('Schedule weekly CBC, LDH, and Haptoglobin for 4 weeks to detect Post-Artesunate Delayed Hemolysis (PADH).');
      } else {
        severityTier = 'WARNING_SIGNS_ADMIT';
        directives.push('Uncomplicated P. falciparum: Initiate oral Artemether-Lumefantrine (ACT) and repeat blood smear q12-24h.');
      }
    } else {
      // DENGUE_FEVER
      prohibitedAgents.push('Ibuprofen', 'Ketorolac', 'Naproxen', 'Aspirin (Strictly contraindicated — severe GI/mucosal hemorrhage hazard)');
      const narrowPp = pulsePressureMmhg <= 20;
      const hemoconcentration = (input.hematocritRisePct ?? 0) >= 20;
      plasmaLeakageShock = narrowPp || input.systolicBp < 90 || (hemoconcentration && input.plateletsK < 50);

      if (plasmaLeakageShock) {
        severityTier = 'CRITICAL_SEVERE_ICU';
        directives.push(
          `DENGUE SHOCK SYNDROME (PP ${pulsePressureMmhg} mmHg, Hct rise ${input.hematocritRisePct ?? 0}%, Plt ${input.plateletsK}k): Infuse isotonic crystalloid 10-20 mL/kg over 15-30 min, then taper carefully to 5-7 -> 3-5 -> 2-3 mL/kg/h guided by serial Hematocrit.`
        );
        directives.push('Avoid over-resuscitation during convalescent reabsorption phase (risk of acute pulmonary edema). Use Acetaminophen ONLY for fever.');
      } else if (input.plateletsK < 100 || input.mucosalBleedingPresent) {
        severityTier = 'WARNING_SIGNS_ADMIT';
        directives.push('Dengue with Warning Signs: Admit for q4-6h Hematocrit/Platelet tracking and maintenance isotonic fluids (2-3 mL/kg/h).');
      } else {
        directives.push('Uncomplicated Dengue: Oral rehydration, Acetaminophen PRN, strict return precautions for defervescence critical phase.');
      }
    }

    return {
      patientId: input.patientId,
      pathogenSyndrome: input.syndrome,
      severityTier,
      ivArtesunateIndicated,
      artesunateDoseMg,
      plasmaLeakageShock,
      pulsePressureMmhg,
      prohibitedAgents,
      clinicalDirectives: directives
    };
  }

  public static async recordEvaluation(input: TropicalCriticalCareInput): Promise<TropicalCriticalCareResult> {
    const result = this.evaluateTropical(input);
    const res = await query(
      `INSERT INTO tropical_critical_care_evals (
        patient_id, pathogen_syndrome, severity_tier, iv_artesunate_indicated,
        plasma_leakage_shock, eval_output
      ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;`,
      [
        result.patientId,
        result.pathogenSyndrome,
        result.severityTier,
        result.ivArtesunateIndicated,
        result.plasmaLeakageShock,
        JSON.stringify(result)
      ]
    );
    if (res.rows.length > 0) {
      result.id = res.rows[0].id;
    }
    return result;
  }
}
