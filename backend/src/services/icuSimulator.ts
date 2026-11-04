import { pool } from '../db';
import {
  CenturyOrchestratorService,
  CenturyPatientStateInput,
  CrossPhaseConflict,
  CenturyTier,
  OrganDomain
} from './centuryOrchestrator';
import { EventEmitter } from 'events';

export interface SimulatedBed {
  id?: number;
  wardId?: number;
  bedNumber: number;
  patientId: number;
  patientName: string;
  age: number;
  sex: string;
  clinicalProfileId: string;
  primaryDiagnosis: string;
  state: CenturyPatientStateInput;
  centuryScore: number;
  centuryTier: CenturyTier;
  primaryDomain: OrganDomain;
  activeConflicts: CrossPhaseConflict[];
  dispatchedTeams: string[];
  isCrashing: boolean;
  trend: 'STABLE' | 'DETERIORATING' | 'IMPROVING';
  lastIntervention?: string;
  lastUpdated: string;
}

export class IcuSimulatorService {
  private static beds: Map<number, SimulatedBed> = new Map();
  private static timer: NodeJS.Timeout | null = null;
  public static emitter: EventEmitter = new EventEmitter();
  private static isRunning: boolean = false;
  private static wardId: number = 1;

  /**
   * Initializes or resets the 12-bed ICU ward representing the full IntakeRx critical care spectrum.
   */
  public static async initializeWard(wardName: string = 'IntakeRx Century Grand ICU'): Promise<SimulatedBed[]> {
    this.beds.clear();

    // Ensure dummy patients 1 to 12 exist in database for foreign keys
    for (let i = 1; i <= 12; i++) {
      await pool.query(`
        INSERT INTO patients (id, name, email, password_hash, dob, sex)
        VALUES ($1, $2, $3, 'hash123', '1985-01-01', 'Female')
        ON CONFLICT (id) DO NOTHING;
      `, [i, `ICU Bed ${i} Patient`, `icubed${i}@example.com`]);
    }

    // Ensure ward record exists
    const wardRes = await pool.query(`
      INSERT INTO icu_simulation_wards (id, ward_name, total_beds, is_running)
      VALUES (1, $1, 12, false)
      ON CONFLICT (id) DO UPDATE SET ward_name = $1, updated_at = CURRENT_TIMESTAMP
      RETURNING id;
    `, [wardName]);
    this.wardId = wardRes.rows[0].id;

    // Seed 12 canonical bed profiles
    const seedTemplates: Array<Omit<SimulatedBed, 'centuryScore' | 'centuryTier' | 'primaryDomain' | 'activeConflicts' | 'dispatchedTeams' | 'lastUpdated'>> = [
      {
        bedNumber: 1,
        patientId: 1,
        patientName: 'Elena Rostova (G1P0 34w)',
        age: 29,
        sex: 'Female',
        clinicalProfileId: 'BED1_MATERNAL_CODE',
        primaryDiagnosis: 'Amniotic Fluid Embolism & Maternal Cardiac Arrest (Phase 96)',
        isCrashing: true,
        trend: 'DETERIORATING',
        state: {
          patientId: 1,
          cardiovascular: { heartRate: 0, systolicBp: 0, diastolicBp: 0, meanArterialPressure: 0, shockIndex: 0 },
          respiratory: { paO2FiO2Ratio: 50, mechanicalVentilation: true },
          neurologic: { gcsScore: 3 },
          obstetric: { isPregnantOrPostpartum: true, gestationalAgeWeeks: 34, activeMaternalCardiacArrest: true }
        }
      },
      {
        bedNumber: 2,
        patientId: 2,
        patientName: 'Marcus Vance',
        age: 58,
        sex: 'Male',
        clinicalProfileId: 'BED2_AORTA_SPINAL',
        primaryDiagnosis: 'Type A Aortic Dissection colliding with T4 Spinal Cord Injury (Phases 66 & 95)',
        isCrashing: true,
        trend: 'DETERIORATING',
        state: {
          patientId: 2,
          neurologic: { spinalCordInjuryLevel: 'T4' },
          cardiovascular: { heartRate: 88, systolicBp: 168, diastolicBp: 96, meanArterialPressure: 120, shockIndex: 0.52, acuteAorticDissectionTypeA: true }
        }
      },
      {
        bedNumber: 3,
        patientId: 3,
        patientName: 'Sophia Lin (Postpartum)',
        age: 32,
        sex: 'Female',
        clinicalProfileId: 'BED3_PREECLAMPSIA_HEMORRHAGE',
        primaryDiagnosis: 'Severe Preeclampsia with PPH Atony (Methergine Contraindicated) (Phases 97 & 98)',
        isCrashing: true,
        trend: 'DETERIORATING',
        state: {
          patientId: 3,
          cardiovascular: { heartRate: 114, systolicBp: 168, diastolicBp: 104, meanArterialPressure: 125, shockIndex: 0.68 },
          obstetric: { isPregnantOrPostpartum: true, severePreeclampsiaEclampsia: true, postpartumHemorrhageActive: true, qblMl: 1350 }
        }
      },
      {
        bedNumber: 4,
        patientId: 4,
        patientName: 'David Miller',
        age: 44,
        sex: 'Male',
        clinicalProfileId: 'BED4_BURN_ACS',
        primaryDiagnosis: '45% TBSA Flame Burn Shock with Fluid Creep & ACS (Phase 99)',
        isCrashing: true,
        trend: 'DETERIORATING',
        state: {
          patientId: 4,
          cardiovascular: { heartRate: 122, systolicBp: 94, diastolicBp: 56, meanArterialPressure: 68, shockIndex: 1.3 },
          renalFluids: { bladderPressureIapMmhg: 23, hourlyUrineOutputMlKgH: 0.28 },
          traumaAndBurns: { burnTbsaPercentage: 45 }
        }
      },
      {
        bedNumber: 5,
        patientId: 5,
        patientName: 'Rachel Green',
        age: 30,
        sex: 'Female',
        clinicalProfileId: 'BED5_ASTHMA_PPH',
        primaryDiagnosis: 'Severe Status Asthmaticus with PPH Atony (Carboprost Contraindicated) (Phases 65 & 98)',
        isCrashing: true,
        trend: 'DETERIORATING',
        state: {
          patientId: 5,
          cardiovascular: { heartRate: 118, systolicBp: 106, diastolicBp: 64, meanArterialPressure: 78, shockIndex: 1.11 },
          respiratory: { severeAsthmaBronchospasm: true },
          obstetric: { isPregnantOrPostpartum: true, postpartumHemorrhageActive: true, qblMl: 1200 }
        }
      },
      {
        bedNumber: 6,
        patientId: 6,
        patientName: 'Arthur Pendelton',
        age: 62,
        sex: 'Male',
        clinicalProfileId: 'BED6_STATUS_EPILEPTICUS',
        primaryDiagnosis: 'Super-Refractory Status Epilepticus on cEEG Titration (Phase 94)',
        isCrashing: false,
        trend: 'STABLE',
        state: {
          patientId: 6,
          neurologic: { gcsScore: 6, statusEpilepticusActive: true },
          cardiovascular: { heartRate: 82, systolicBp: 122, diastolicBp: 76, meanArterialPressure: 91, shockIndex: 0.67 }
        }
      },
      {
        bedNumber: 7,
        patientId: 7,
        patientName: 'Chloe Bennett',
        age: 51,
        sex: 'Female',
        clinicalProfileId: 'BED7_SAH_VASOSPASM',
        primaryDiagnosis: 'Aneurysmal SAH Day 7 with Severe DCI / TCD Vasospasm (Phase 93)',
        isCrashing: false,
        trend: 'STABLE',
        state: {
          patientId: 7,
          neurologic: { subarachnoidVasospasmActive: true, gcsScore: 11 },
          cardiovascular: { heartRate: 76, systolicBp: 148, diastolicBp: 86, meanArterialPressure: 106, shockIndex: 0.51 }
        }
      },
      {
        bedNumber: 8,
        patientId: 8,
        patientName: 'Gabriel Santos',
        age: 26,
        sex: 'Male',
        clinicalProfileId: 'BED8_ICP_HERNIATION',
        primaryDiagnosis: 'Severe TBI with SIBICC Tier 3 Herniation Crisis (Phase 92)',
        isCrashing: true,
        trend: 'DETERIORATING',
        state: {
          patientId: 8,
          neurologic: { gcsScore: 4, icpMmhg: 28, cppMmhg: 48 },
          cardiovascular: { heartRate: 54, systolicBp: 178, diastolicBp: 92, meanArterialPressure: 120, shockIndex: 0.3 }
        }
      },
      {
        bedNumber: 9,
        patientId: 9,
        patientName: 'William Harrison',
        age: 67,
        sex: 'Male',
        clinicalProfileId: 'BED9_ECMO_CARDIOGENIC',
        primaryDiagnosis: 'Cardiogenic Shock on Biventricular VA-ECMO & Impella CP (Phases 38 & 61)',
        isCrashing: false,
        trend: 'STABLE',
        state: {
          patientId: 9,
          cardiovascular: { heartRate: 90, systolicBp: 98, diastolicBp: 62, meanArterialPressure: 74, shockIndex: 0.92, activeMcsDevice: 'VA_ECMO + Impella CP', vasoactiveInotropicScore: 18 }
        }
      },
      {
        bedNumber: 10,
        patientId: 10,
        patientName: 'Maya Patel',
        age: 39,
        sex: 'Female',
        clinicalProfileId: 'BED10_ARDS_PRONE',
        primaryDiagnosis: 'Severe ARDS P/F 72 on Prone Lung-Protective Ventilation (Phase 65)',
        isCrashing: false,
        trend: 'STABLE',
        state: {
          patientId: 10,
          respiratory: { paO2FiO2Ratio: 72, mechanicalVentilation: true, drivingPressureCmH2O: 16 },
          cardiovascular: { heartRate: 98, systolicBp: 112, diastolicBp: 70, meanArterialPressure: 84, shockIndex: 0.88 }
        }
      },
      {
        bedNumber: 11,
        patientId: 11,
        patientName: 'Carlos Gomez',
        age: 35,
        sex: 'Male',
        clinicalProfileId: 'BED11_ELECTRICAL_RHABDO',
        primaryDiagnosis: 'High-Voltage Electrical Burn with Severe Pigmenturia (Phase 99)',
        isCrashing: false,
        trend: 'IMPROVING',
        state: {
          patientId: 11,
          cardiovascular: { heartRate: 88, systolicBp: 126, diastolicBp: 80, meanArterialPressure: 95, shockIndex: 0.7 },
          renalFluids: { hourlyUrineOutputMlKgH: 1.8 },
          traumaAndBurns: { burnTbsaPercentage: 18 }
        }
      },
      {
        bedNumber: 12,
        patientId: 12,
        patientName: 'Beatrice Wood',
        age: 74,
        sex: 'Female',
        clinicalProfileId: 'BED12_SEPSIS_CRRT',
        primaryDiagnosis: 'Septic Shock with Anuric AKI on Continuous RRT (Phases 19 & 44)',
        isCrashing: false,
        trend: 'STABLE',
        state: {
          patientId: 12,
          cardiovascular: { heartRate: 96, systolicBp: 104, diastolicBp: 62, meanArterialPressure: 76, shockIndex: 0.92, vasoactiveInotropicScore: 12 },
          renalFluids: { crrtActive: true, serumCreatinineMgDl: 3.8, hourlyUrineOutputMlKgH: 0.1 },
          hepaticMetabolic: { serumLactateMmolL: 3.4 }
        }
      }
    ];

    for (const t of seedTemplates) {
      const synthesis = CenturyOrchestratorService.synthesizeGrandOrchestration(t.state);
      const bed: SimulatedBed = {
        ...t,
        wardId: this.wardId,
        centuryScore: synthesis.centuryScore,
        centuryTier: synthesis.centuryTier,
        primaryDomain: synthesis.primaryDomain,
        activeConflicts: synthesis.crossPhaseConflicts,
        dispatchedTeams: synthesis.dispatchedTeams,
        lastUpdated: new Date().toISOString()
      };
      this.beds.set(bed.bedNumber, bed);
      await this.persistBed(bed);
    }

    return Array.from(this.beds.values());
  }

  /**
   * Retrieves the current state of all beds.
   */
  public static async getWardBeds(): Promise<SimulatedBed[]> {
    if (this.beds.size === 0) {
      await this.initializeWard();
    }
    return Array.from(this.beds.values());
  }

  /**
   * Executes a single simulation step across all beds:
   * - Injects micro-jitter on vitals
   * - Drifts crashing beds toward instability
   * - Recalculates Century Orchestrator synthesis
   * - Emits SSE telemetry event
   */
  public static tickSimulation(): SimulatedBed[] {
    const updated: SimulatedBed[] = [];

    for (const bed of this.beds.values()) {
      const cv = bed.state.cardiovascular;

      if (bed.isCrashing) {
        // Crashing beds deteriorate
        if (cv.heartRate > 0) {
          cv.heartRate = Math.min(160, cv.heartRate + Math.floor(Math.random() * 3));
          cv.systolicBp = Math.max(50, cv.systolicBp - Math.floor(Math.random() * 2));
          cv.diastolicBp = Math.max(30, cv.diastolicBp - Math.floor(Math.random() * 2));
          cv.meanArterialPressure = Number(((cv.systolicBp + 2 * cv.diastolicBp) / 3).toFixed(1));
          cv.shockIndex = cv.systolicBp > 0 ? Number((cv.heartRate / cv.systolicBp).toFixed(2)) : 0;
        }

        // Bladder pressure creep if burn ACS
        if (bed.state.renalFluids?.bladderPressureIapMmhg) {
          bed.state.renalFluids.bladderPressureIapMmhg = Number((bed.state.renalFluids.bladderPressureIapMmhg + 0.1).toFixed(1));
        }

        // ICP creep if brain injury
        if (bed.state.neurologic?.icpMmhg) {
          bed.state.neurologic.icpMmhg = Math.min(40, Number((bed.state.neurologic.icpMmhg + 0.2).toFixed(1)));
          bed.state.neurologic.cppMmhg = Number((cv.meanArterialPressure - bed.state.neurologic.icpMmhg).toFixed(1));
        }
      } else {
        // Stable beds experience realistic micro-variability
        if (cv.heartRate > 0) {
          const hrJitter = (Math.random() - 0.5) * 2;
          const sbpJitter = (Math.random() - 0.5) * 2;
          cv.heartRate = Math.round(cv.heartRate + hrJitter);
          cv.systolicBp = Math.round(cv.systolicBp + sbpJitter);
          cv.meanArterialPressure = Number(((cv.systolicBp + 2 * cv.diastolicBp) / 3).toFixed(1));
          cv.shockIndex = cv.systolicBp > 0 ? Number((cv.heartRate / cv.systolicBp).toFixed(2)) : 0;
        }
      }

      // Recalculate synthesis
      const synthesis = CenturyOrchestratorService.synthesizeGrandOrchestration(bed.state);
      bed.centuryScore = synthesis.centuryScore;
      bed.centuryTier = synthesis.centuryTier;
      bed.primaryDomain = synthesis.primaryDomain;
      bed.activeConflicts = synthesis.crossPhaseConflicts;
      bed.dispatchedTeams = synthesis.dispatchedTeams;
      bed.lastUpdated = new Date().toISOString();

      updated.push(bed);
    }

    // Broadcast SSE update
    this.emitter.emit('tick', updated);
    return updated;
  }

  /**
   * Injects an acute crisis event on a specific bed.
   */
  public static async triggerCrisis(bedNumber: number, crisisType: string): Promise<SimulatedBed> {
    const bed = this.beds.get(bedNumber);
    if (!bed) {
      throw new Error(`Bed #${bedNumber} not found in active ward.`);
    }

    const priorState = JSON.parse(JSON.stringify(bed.state));
    bed.isCrashing = true;
    bed.trend = 'DETERIORATING';

    switch (crisisType) {
      case 'MATERNAL_ARREST':
        bed.state.cardiovascular = { heartRate: 0, systolicBp: 0, diastolicBp: 0, meanArterialPressure: 0, shockIndex: 0 };
        bed.state.obstetric = { isPregnantOrPostpartum: true, gestationalAgeWeeks: 34, activeMaternalCardiacArrest: true };
        break;

      case 'ACS_BLADDER_SPIKE':
        if (!bed.state.renalFluids) bed.state.renalFluids = {};
        bed.state.renalFluids.bladderPressureIapMmhg = 25.0;
        bed.state.renalFluids.hourlyUrineOutputMlKgH = 0.1;
        break;

      case 'STATUS_BREAKTHROUGH':
        if (!bed.state.neurologic) bed.state.neurologic = {};
        bed.state.neurologic.statusEpilepticusActive = true;
        bed.state.neurologic.gcsScore = 3;
        break;

      case 'AORTIC_DISSECTION_SPIKE':
        bed.state.cardiovascular.acuteAorticDissectionTypeA = true;
        bed.state.cardiovascular.systolicBp = 190;
        bed.state.cardiovascular.heartRate = 105;
        bed.state.cardiovascular.meanArterialPressure = 135;
        break;

      case 'SEVERE_PPH_HEMORRHAGE':
        if (!bed.state.obstetric) bed.state.obstetric = { isPregnantOrPostpartum: true };
        bed.state.obstetric.postpartumHemorrhageActive = true;
        bed.state.obstetric.qblMl = 1800;
        bed.state.cardiovascular.heartRate = 138;
        bed.state.cardiovascular.systolicBp = 72;
        bed.state.cardiovascular.diastolicBp = 42;
        bed.state.cardiovascular.meanArterialPressure = 52;
        bed.state.cardiovascular.shockIndex = 1.91;
        break;

      case 'HERNIATION_ICP_CRISIS':
        if (!bed.state.neurologic) bed.state.neurologic = {};
        bed.state.neurologic.icpMmhg = 34;
        bed.state.neurologic.cppMmhg = 38;
        bed.state.neurologic.gcsScore = 3;
        break;

      default:
        // Generic crash
        bed.state.cardiovascular.systolicBp = 68;
        bed.state.cardiovascular.heartRate = 145;
        bed.state.cardiovascular.meanArterialPressure = 48;
        bed.state.cardiovascular.shockIndex = 2.13;
        break;
    }

    const synthesis = CenturyOrchestratorService.synthesizeGrandOrchestration(bed.state);
    bed.centuryScore = synthesis.centuryScore;
    bed.centuryTier = synthesis.centuryTier;
    bed.primaryDomain = synthesis.primaryDomain;
    bed.activeConflicts = synthesis.crossPhaseConflicts;
    bed.dispatchedTeams = synthesis.dispatchedTeams;
    bed.lastIntervention = `CRISIS TRIGGERED: ${crisisType}`;
    bed.lastUpdated = new Date().toISOString();

    // Log crisis event to DB
    await pool.query(`
      INSERT INTO icu_simulation_events_log (ward_id, bed_number, event_type, description, prior_state, new_state)
      VALUES ($1, $2, $3, $4, $5, $6);
    `, [
      this.wardId,
      bedNumber,
      `CRISIS_${crisisType}`,
      `Acute deterioration on Bed #${bedNumber}: ${crisisType}`,
      JSON.stringify(priorState),
      JSON.stringify(bed.state)
    ]);

    await this.persistBed(bed);
    this.emitter.emit('tick', Array.from(this.beds.values()));
    return bed;
  }

  /**
   * Applies a clinical protocol intervention to stabilize a bed.
   */
  public static async applyIntervention(bedNumber: number, interventionType: string): Promise<SimulatedBed> {
    const bed = this.beds.get(bedNumber);
    if (!bed) {
      throw new Error(`Bed #${bedNumber} not found in active ward.`);
    }

    const priorState = JSON.parse(JSON.stringify(bed.state));
    bed.isCrashing = false;
    bed.trend = 'IMPROVING';

    switch (interventionType) {
      case 'MANUAL_LUD_PMCS':
        // Bed 1 ROSC or PMCS delivery
        bed.state.cardiovascular = { heartRate: 98, systolicBp: 110, diastolicBp: 68, meanArterialPressure: 82, shockIndex: 0.89 };
        if (bed.state.obstetric) bed.state.obstetric.activeMaternalCardiacArrest = false;
        break;

      case 'ALBUMIN_ESCHAROTOMY':
        // Bed 4 Burn ACS decompression
        if (bed.state.renalFluids) {
          bed.state.renalFluids.bladderPressureIapMmhg = 13.5;
          bed.state.renalFluids.hourlyUrineOutputMlKgH = 0.85;
        }
        bed.state.cardiovascular.heartRate = 96;
        bed.state.cardiovascular.systolicBp = 118;
        bed.state.cardiovascular.meanArterialPressure = 88;
        break;

      case 'ESMOLOL_ANTI_IMPULSE':
        // Bed 2 Aortic Dissection control
        bed.state.cardiovascular.heartRate = 56;
        bed.state.cardiovascular.systolicBp = 112;
        bed.state.cardiovascular.diastolicBp = 70;
        bed.state.cardiovascular.meanArterialPressure = 84;
        break;

      case 'CARBOPROST_MISOPROSTOL_BAKRI':
        // Bed 3 Preeclampsia + PPH resolution without Methergine
        bed.state.cardiovascular.heartRate = 92;
        bed.state.cardiovascular.systolicBp = 142;
        bed.state.cardiovascular.diastolicBp = 88;
        bed.state.cardiovascular.meanArterialPressure = 106;
        if (bed.state.obstetric) bed.state.obstetric.postpartumHemorrhageActive = false;
        break;

      case 'BURST_SUPPRESSION_TITRATION':
        // Bed 6 Status Epilepticus termination
        if (bed.state.neurologic) {
          bed.state.neurologic.statusEpilepticusActive = false;
          bed.state.neurologic.gcsScore = 9;
        }
        break;

      case 'HYPERTONIC_SALINE_OSMOTHERAPY':
        // Bed 8 Herniation resolution
        if (bed.state.neurologic) {
          bed.state.neurologic.icpMmhg = 14;
          bed.state.neurologic.cppMmhg = 72;
          bed.state.neurologic.gcsScore = 8;
        }
        break;

      default:
        // Generic stabilization
        bed.state.cardiovascular.heartRate = 84;
        bed.state.cardiovascular.systolicBp = 120;
        bed.state.cardiovascular.diastolicBp = 76;
        bed.state.cardiovascular.meanArterialPressure = 90;
        bed.state.cardiovascular.shockIndex = 0.7;
        break;
    }

    const synthesis = CenturyOrchestratorService.synthesizeGrandOrchestration(bed.state);
    bed.centuryScore = synthesis.centuryScore;
    bed.centuryTier = synthesis.centuryTier;
    bed.primaryDomain = synthesis.primaryDomain;
    bed.activeConflicts = synthesis.crossPhaseConflicts;
    bed.dispatchedTeams = synthesis.dispatchedTeams;
    bed.lastIntervention = `INTERVENTION APPLIED: ${interventionType}`;
    bed.lastUpdated = new Date().toISOString();

    // Log intervention event to DB
    await pool.query(`
      INSERT INTO icu_simulation_events_log (ward_id, bed_number, event_type, description, prior_state, new_state)
      VALUES ($1, $2, $3, $4, $5, $6);
    `, [
      this.wardId,
      bedNumber,
      `INTERVENTION_${interventionType}`,
      `Protocol intervention applied on Bed #${bedNumber}: ${interventionType}`,
      JSON.stringify(priorState),
      JSON.stringify(bed.state)
    ]);

    await this.persistBed(bed);
    this.emitter.emit('tick', Array.from(this.beds.values()));
    return bed;
  }

  /**
   * Starts background automated simulation loop.
   */
  public static startSimulation(intervalMs: number = 2000): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.timer = setInterval(() => {
      this.tickSimulation();
    }, intervalMs);
    pool.query('UPDATE icu_simulation_wards SET is_running = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [this.wardId]);
  }

  /**
   * Stops background automated simulation loop.
   */
  public static stopSimulation(): void {
    if (!this.isRunning) return;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    pool.query('UPDATE icu_simulation_wards SET is_running = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [this.wardId]);
  }

  public static isSimulationRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Persists bed state into DB table.
   */
  private static async persistBed(bed: SimulatedBed): Promise<void> {
    await pool.query(`
      INSERT INTO icu_simulated_beds (
        ward_id,
        bed_number,
        patient_id,
        patient_name,
        age,
        sex,
        clinical_profile_id,
        primary_diagnosis,
        current_state,
        century_score,
        century_tier,
        active_conflicts,
        dispatched_teams,
        is_crashing,
        last_updated
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
      ON CONFLICT (ward_id, bed_number) DO UPDATE SET
        current_state = $9,
        century_score = $10,
        century_tier = $11,
        active_conflicts = $12,
        dispatched_teams = $13,
        is_crashing = $14,
        last_updated = CURRENT_TIMESTAMP;
    `, [
      this.wardId,
      bed.bedNumber,
      bed.patientId,
      bed.patientName,
      bed.age,
      bed.sex,
      bed.clinicalProfileId,
      bed.primaryDiagnosis,
      JSON.stringify(bed.state),
      bed.centuryScore,
      bed.centuryTier,
      JSON.stringify(bed.activeConflicts),
      JSON.stringify(bed.dispatchedTeams),
      bed.isCrashing
    ]);
  }
}
