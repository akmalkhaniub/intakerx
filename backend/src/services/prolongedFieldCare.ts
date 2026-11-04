import { pool } from '../db';

export interface WalkingBloodBankDonor {
  donorId: string;
  name: string;
  bloodType: string;
  rhFactor: '+' | '-';
  eldonCardVerified: boolean;
  transfusionStatus: 'AVAILABLE' | 'DRAWN' | 'DEFERRED';
}

export interface EvaluatePfcInput {
  patientId: number;
  fieldHour: number;
  totalPfcHoursPlanned?: number;
  systolicBp: number;
  meanArterialPressure: number;
  hourlyUrineOutputMlKgH: number;
  coreTempCelsius: number;
  wholeBloodUnitsTransfused: number;
  wbbDonorsAvailable?: WalkingBloodBankDonor[];
  activeWarmingApplied: boolean;
  antibioticGiven?: boolean;
  evacWeatherStatus?: 'FLYABLE' | 'INCLEMENT_DELAYED_24H' | 'PROTRACTED_GROUND_EVAC_ONLY';
}

export interface PfcEvaluationResult {
  patientId: number;
  fieldHour: number;
  resuscitationStatus: 'COMPENSATED' | 'DECOMPENSATING_SHOCK' | 'HYPOTHERMIC_COAGULOPATHIC';
  fluidTitrationDirective: string;
  wbbActivationMandated: boolean;
  wbbEligibleDonorsCount: number;
  hypothermiaAlert?: string;
  antibioticDirective: string;
  pfcChecklist: string[];
}

export class ProlongedFieldCareService {
  /**
   * Evaluates austere critical care parameters under prolonged field care (72h) constraints.
   */
  public static evaluateProlongedCare(input: EvaluatePfcInput): PfcEvaluationResult {
    const pfcChecklist: string[] = [];
    let status: 'COMPENSATED' | 'DECOMPENSATING_SHOCK' | 'HYPOTHERMIC_COAGULOPATHIC' = 'COMPENSATED';
    let fluidDirective = 'Maintain minimal volume resuscitation. Target MAP >= 65 mmHg and UOP 0.5-1.0 mL/kg/h.';
    let wbbMandated = false;
    let hypothermiaAlert: string | undefined;

    // 1. Hemodynamics & Urine Output Titration
    if (input.meanArterialPressure < 65 || input.hourlyUrineOutputMlKgH < 0.5) {
      status = 'DECOMPENSATING_SHOCK';
      fluidDirective = 'Inadequate End-Organ Perfusion (UOP < 0.5 mL/kg/h). Titrate 1 unit Fresh Whole Blood (FWB) or 250 mL Hextend bolus. Avoid crystalloid volume overload.';
      wbbMandated = true;
      pfcChecklist.push('Activate Walking Blood Bank (WBB) donor roster.');
    }

    // 2. Hypothermia Prevention & Lethal Triad
    if (input.coreTempCelsius < 35.5) {
      status = 'HYPOTHERMIC_COAGULOPATHIC';
      hypothermiaAlert = `CRITICAL HYPOTHERMIA (${input.coreTempCelsius}°C): Severe coagulopathy and platelet dysfunction imminent. Deploy active chemical heating blankets (HPMK), insulate ground pad, and infuse warm fluids.`;
      pfcChecklist.push('Deploy HPMK active heating shell and hypothermia wraps.');
    } else if (!input.activeWarmingApplied) {
      pfcChecklist.push('Initiate prophylactic passive and active warming. Hypothermia causes uncorrectable microvascular oozing in austere environments.');
    }

    // 3. Walking Blood Bank (WBB) screening
    const donors = input.wbbDonorsAvailable || [];
    const eligibleDonors = donors.filter(d => d.eldonCardVerified && d.transfusionStatus === 'AVAILABLE');

    if (wbbMandated && eligibleDonors.length === 0) {
      pfcChecklist.push('WARNING: Zero pre-screened WBB donors currently available. Emergency Eldoncard crossmatch required immediately.');
    }

    // 4. Antibiotic Prophylaxis (Austere infection prevention)
    let antibioticDirective = 'Ertapenem 1g IV/IO once daily (or Moxifloxacin 400mg PO) active.';
    if (input.antibioticGiven === false) {
      antibioticDirective = 'STAT ANTIBIOTIC NEEDED: Administer Ertapenem 1g IV over 30 min (CoTCCC guidelines) to prevent austere battlefield sepsis.';
      pfcChecklist.push('Administer broad-spectrum systemic antimicrobial (Ertapenem).');
    }

    // 5. Evac Contingency
    if (input.evacWeatherStatus === 'INCLEMENT_DELAYED_24H' || input.evacWeatherStatus === 'PROTRACTED_GROUND_EVAC_ONLY') {
      pfcChecklist.push('Evacuation delayed > 24 hours. Transition to strict nurse-to-patient 1:1 shift rotation and fluid intake/output log.');
    }

    return {
      patientId: input.patientId,
      fieldHour: input.fieldHour,
      resuscitationStatus: status,
      fluidTitrationDirective: fluidDirective,
      wbbActivationMandated: wbbMandated,
      wbbEligibleDonorsCount: eligibleDonors.length,
      hypothermiaAlert,
      antibioticDirective,
      pfcChecklist
    };
  }

  /**
   * Evaluates prolonged field care and persists to database.
   */
  public static async evaluateAndPersist(input: EvaluatePfcInput): Promise<PfcEvaluationResult> {
    const res = this.evaluateProlongedCare(input);

    await pool.query(`
      INSERT INTO prolonged_field_care_logs (
        patient_id, field_hour, total_pfc_hours_planned, wbb_donor_roster,
        whole_blood_units_transfused, urine_output_ml_kg_h, fluid_resus_type,
        hypothermia_active_warming, core_temp_celsius, antibiotic_prophylaxis,
        telemedicine_evac_status, clinical_actions
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);
    `, [
      input.patientId,
      input.fieldHour,
      input.totalPfcHoursPlanned || 72,
      JSON.stringify(input.wbbDonorsAvailable || []),
      input.wholeBloodUnitsTransfused,
      input.hourlyUrineOutputMlKgH,
      res.wbbActivationMandated ? 'FRESH_WHOLE_BLOOD' : 'RESTRICTED_CRYSTALLOID',
      input.activeWarmingApplied,
      input.coreTempCelsius,
      res.antibioticDirective,
      input.evacWeatherStatus || 'INCLEMENT_DELAYED_24H',
      JSON.stringify(res.pfcChecklist)
    ]);

    return res;
  }
}
