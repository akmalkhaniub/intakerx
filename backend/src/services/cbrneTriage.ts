import { pool } from '../db';

export type MCICategory = 'RED' | 'YELLOW' | 'GREEN' | 'BLACK';

export interface AdultSTARTInput {
  incidentName: string;
  patientIdentifier: string;
  canWalk: boolean;
  spontaneousBreathing: boolean;
  repositionsAirwayResumesBreathing?: boolean;
  respiratoryRate?: number;
  radialPulsePresent?: boolean;
  capillaryRefillSeconds?: number;
  obeysCommands?: boolean;
}

export interface PediatricJumpSTARTInput {
  incidentName: string;
  patientIdentifier: string;
  canWalk: boolean;
  spontaneousBreathing: boolean;
  repositionsAirwayResumesBreathing?: boolean;
  palpablePulse?: boolean;
  gaveRescueBreathsResumedBreathing?: boolean;
  respiratoryRate?: number;
  avpuScore?: 'A' | 'V' | 'P' | 'U';
}

export interface MCITriageResult {
  patientIdentifier: string;
  isPediatric: boolean;
  triageCategory: MCICategory;
  categoryLabel: string;
  destinationZone: string;
  rationale: string;
  immediateInterventions: string[];
}

export type CBRNEClass =
  | 'CHEMICAL_NERVE'
  | 'CHEMICAL_CYANIDE'
  | 'CHEMICAL_VESICANT'
  | 'CHEMICAL_PULMONARY'
  | 'RADIOLOGICAL'
  | 'BIOLOGICAL';

export interface CBRNEAgentInput {
  cbrneClass: CBRNEClass;
  agentName: string; // e.g. 'Sarin', 'VX', 'Cyanide', 'Mustard', 'Cesium_137'
  patientWeightKg?: number;
  symptomsObserved: string[];
}

export interface CBRNEThreatAssessment {
  cbrneClass: CBRNEClass;
  agentName: string;
  toxicityMechanism: string;
  antidoteRecommended: string;
  antidoteDosingProtocol: string;
  chempackDeploymentTriggered: boolean;
  decontaminationProcedure: string;
  ppeLevelRequired: 'Level A' | 'Level B' | 'Level C' | 'Level D';
  specialCautions: string[];
}

export class CBRNETriageService {
  /**
   * Evaluates Adult START Triage Algorithm
   */
  public static evaluateSTART(input: AdultSTARTInput): MCITriageResult {
    // 1. Minor / Walking Wounded
    if (input.canWalk) {
      return {
        patientIdentifier: input.patientIdentifier,
        isPediatric: false,
        triageCategory: 'GREEN',
        categoryLabel: 'Minor (Walking Wounded)',
        destinationZone: 'green_outpatient_assembly',
        rationale: 'Patient is ambulatory and can walk to secondary triage area.',
        immediateInterventions: ['Direct to Green Assembly Area', 'Secondary assessment when acute reds cleared']
      };
    }

    // 2. Respiration Check
    if (!input.spontaneousBreathing) {
      if (input.repositionsAirwayResumesBreathing) {
        return {
          patientIdentifier: input.patientIdentifier,
          isPediatric: false,
          triageCategory: 'RED',
          categoryLabel: 'Immediate (Life Threatening)',
          destinationZone: 'acute_red_tent_resuscitation',
          rationale: 'Apnea resolved upon manual airway repositioning.',
          immediateInterventions: ['Insert Nasopharyngeal/Oropharyngeal airway', 'Place in recovery position or secure airway']
        };
      } else {
        return {
          patientIdentifier: input.patientIdentifier,
          isPediatric: false,
          triageCategory: 'BLACK',
          categoryLabel: 'Expectant / Deceased',
          destinationZone: 'morgue_staging_area',
          rationale: 'Patient remains apneic after head-tilt / chin-lift airway opening.',
          immediateInterventions: ['Palliative comfort if agonal', 'Do not initiate CPR in mass casualty triage']
        };
      }
    }

    const rr = input.respiratoryRate ?? 20;
    if (rr > 30 || rr < 10) {
      return {
        patientIdentifier: input.patientIdentifier,
        isPediatric: false,
        triageCategory: 'RED',
        categoryLabel: 'Immediate (Life Threatening)',
        destinationZone: 'acute_red_tent_resuscitation',
        rationale: `Tachypnea or bradypnea (Respiratory rate: ${rr} bpm).`,
        immediateInterventions: ['High-flow supplemental oxygen', 'Chest decompression if tension pneumothorax suspected']
      };
    }

    // 3. Perfusion Check (Radial pulse or Cap Refill)
    const capRefill = input.capillaryRefillSeconds ?? 1.5;
    const pulsePresent = input.radialPulsePresent ?? true;
    if (!pulsePresent || capRefill > 2.0) {
      return {
        patientIdentifier: input.patientIdentifier,
        isPediatric: false,
        triageCategory: 'RED',
        categoryLabel: 'Immediate (Life Threatening)',
        destinationZone: 'acute_red_tent_resuscitation',
        rationale: `Hemodynamic compromise: Absent radial pulse or delayed capillary refill (${capRefill}s > 2s).`,
        immediateInterventions: ['Control major external hemorrhage with tourniquet/hemostatic dressing', 'Initiate volume resuscitation']
      };
    }

    // 4. Mental Status Check
    const obeys = input.obeysCommands ?? true;
    if (!obeys) {
      return {
        patientIdentifier: input.patientIdentifier,
        isPediatric: false,
        triageCategory: 'RED',
        categoryLabel: 'Immediate (Life Threatening)',
        destinationZone: 'acute_red_tent_resuscitation',
        rationale: 'Altered mental status: Inability to obey simple commands.',
        immediateInterventions: ['Airway protection', 'Assess for intracranial trauma, hypoxemia, or toxin exposure']
      };
    }

    // 5. Delayed (Yellow)
    return {
      patientIdentifier: input.patientIdentifier,
      isPediatric: false,
      triageCategory: 'YELLOW',
      categoryLabel: 'Delayed (Serious, Not Immediately Moribund)',
      destinationZone: 'yellow_monitoring_tent',
      rationale: 'Breathing < 30, radial pulse present, obeys commands, but unable to walk.',
      immediateInterventions: ['Splint fractures', 'Dress wounds', 'Re-triage every 15-30 minutes']
    };
  }

  /**
   * Evaluates Pediatric JumpSTART Triage Algorithm (<8 years)
   */
  public static evaluateJumpSTART(input: PediatricJumpSTARTInput): MCITriageResult {
    // 1. Ambulatory
    if (input.canWalk) {
      return {
        patientIdentifier: input.patientIdentifier,
        isPediatric: true,
        triageCategory: 'GREEN',
        categoryLabel: 'Minor (Pediatric Walking Wounded)',
        destinationZone: 'green_pediatric_staging',
        rationale: 'Child is ambulatory with caregiver or independent.',
        immediateInterventions: ['Keep accompanied with guardian', 'Secondary triage screening']
      };
    }

    // 2. Apnea evaluation with rescue breaths
    if (!input.spontaneousBreathing) {
      if (input.repositionsAirwayResumesBreathing) {
        return {
          patientIdentifier: input.patientIdentifier,
          isPediatric: true,
          triageCategory: 'RED',
          categoryLabel: 'Immediate (Pediatric Critical)',
          destinationZone: 'acute_red_tent_resuscitation',
          rationale: 'Breathing resumed after manual airway opening.',
          immediateInterventions: ['Position airway with rolled towel under shoulders', 'Continuous airway monitoring']
        };
      }

      if (!input.palpablePulse) {
        return {
          patientIdentifier: input.patientIdentifier,
          isPediatric: true,
          triageCategory: 'BLACK',
          categoryLabel: 'Expectant / Deceased',
          destinationZone: 'morgue_staging_area',
          rationale: 'Apneic and pulseless in pediatric disaster triage.',
          immediateInterventions: ['Tag Black', 'Do not initiate resource-intensive CPR']
        };
      }

      // Pulse present -> 5 rescue breaths
      if (input.gaveRescueBreathsResumedBreathing) {
        return {
          patientIdentifier: input.patientIdentifier,
          isPediatric: true,
          triageCategory: 'RED',
          categoryLabel: 'Immediate (Pediatric Critical)',
          destinationZone: 'acute_red_tent_resuscitation',
          rationale: 'Breathing initiated after 5 rescue breaths (apnea secondary to respiratory arrest).',
          immediateInterventions: ['Bag-valve-mask ventilatory support', 'Immediate advanced airway placement']
        };
      } else {
        return {
          patientIdentifier: input.patientIdentifier,
          isPediatric: true,
          triageCategory: 'BLACK',
          categoryLabel: 'Expectant / Deceased',
          destinationZone: 'morgue_staging_area',
          rationale: 'Child remained apneic despite 5 rescue breaths.',
          immediateInterventions: ['Tag Black']
        };
      }
    }

    // 3. Respiratory Rate (Pediatric normal: 15-45 bpm)
    const rr = input.respiratoryRate ?? 24;
    if (rr < 15 || rr > 45) {
      return {
        patientIdentifier: input.patientIdentifier,
        isPediatric: true,
        triageCategory: 'RED',
        categoryLabel: 'Immediate (Pediatric Critical)',
        destinationZone: 'acute_red_tent_resuscitation',
        rationale: `Pediatric respiratory distress: Rate ${rr} bpm (abnormal range <15 or >45 bpm).`,
        immediateInterventions: ['Blow-by or mask oxygenation', 'Assess airway patency and work of breathing']
      };
    }

    // 4. Perfusion
    if (!input.palpablePulse) {
      return {
        patientIdentifier: input.patientIdentifier,
        isPediatric: true,
        triageCategory: 'RED',
        categoryLabel: 'Immediate (Pediatric Critical)',
        destinationZone: 'acute_red_tent_resuscitation',
        rationale: 'Absent peripheral pulses in breathing pediatric patient.',
        immediateInterventions: ['Control catastrophic bleeding', 'Emergent intraosseous (IO) vascular access']
      };
    }

    // 5. Mental Status (AVPU)
    const avpu = input.avpuScore ?? 'A';
    if (avpu === 'P' || avpu === 'U') {
      return {
        patientIdentifier: input.patientIdentifier,
        isPediatric: true,
        triageCategory: 'RED',
        categoryLabel: 'Immediate (Pediatric Critical)',
        destinationZone: 'acute_red_tent_resuscitation',
        rationale: `Depressed pediatric mental status (AVPU score: '${avpu}' - Posturing or Unresponsive).`,
        immediateInterventions: ['Airway protection', 'Check point-of-care blood glucose for hypoglycemia']
      };
    }

    // 6. Delayed (Yellow)
    return {
      patientIdentifier: input.patientIdentifier,
      isPediatric: true,
      triageCategory: 'YELLOW',
      categoryLabel: 'Delayed (Pediatric Moderate)',
      destinationZone: 'yellow_monitoring_tent',
      rationale: 'Stable respirations (15-45), palpable pulses, Alert/Voice responsive, but non-ambulatory.',
      immediateInterventions: ['Immobilize injuries', 'Pain relief', 'Frequent re-assessment']
    };
  }

  /**
   * Matches CBRNE chemical/radiological agents and dictates antidotes + decon
   */
  public static matchCBRNEAgent(input: CBRNEAgentInput): CBRNEThreatAssessment {
    const agent = input.agentName.toLowerCase();
    const isPediatric = (input.patientWeightKg ?? 70) < 30;

    switch (input.cbrneClass) {
      case 'CHEMICAL_NERVE':
        return {
          cbrneClass: 'CHEMICAL_NERVE',
          agentName: input.agentName,
          toxicityMechanism: 'Irreversible inhibition of acetylcholinesterase producing cholinergic crisis (SLUDGEM / Killer B\'s: Bronchorrhea, Bronchospasm, Bradycardia).',
          antidoteRecommended: 'DuoDote / Mark I Kit (Atropine + Pralidoxime chloride 2-PAM) + Benzodiazepine (Midazolam)',
          antidoteDosingProtocol: isPediatric
            ? 'Atropine 0.05-0.1 mg/kg IV/IM (titrate until clear breath sounds) + 2-PAM 20-50 mg/kg IV/IM over 30 min + Midazolam 0.2 mg/kg IM.'
            : 'ADULT: Atropine 2-6 mg IM/IV repeated Q5-10m until tracheobronchial secretions dry + Pralidoxime (2-PAM) 600-1800 mg IM (1-3 auto-injectors) + Midazolam 10 mg IM for seizure control.',
          chempackDeploymentTriggered: true,
          decontaminationProcedure: 'Remove all contaminated clothing (disposes 80-90% of vapor/liquid). Apply Reactive Skin Decontamination Lotion (RSDL) or copious warm soapy water flush. AVOID hypochlorite in eyes or open abdominal wounds.',
          ppeLevelRequired: 'Level C',
          specialCautions: [
            'Do NOT wait for lab confirmation; treat immediately on clinical signs of miosis, copious secretions, and fasciculations.',
            'Maintain dry airway: Atropine is titrated to reversal of secretional drowning (NOT heart rate or pupil size).'
          ]
        };

      case 'CHEMICAL_CYANIDE':
        return {
          cbrneClass: 'CHEMICAL_CYANIDE',
          agentName: input.agentName,
          toxicityMechanism: 'Inhibition of mitochondrial cytochrome c oxidase (complex IV), halting cellular aerobic ATP production despite normal PaO2.',
          antidoteRecommended: 'Hydroxocobalamin (Cyanokit)',
          antidoteDosingProtocol: isPediatric
            ? 'Cyanokit 70 mg/kg (up to 5g) IV infusion over 15 minutes. May repeat once if cardiac arrest or severe shock persists.'
            : 'ADULT: Hydroxocobalamin 5.0 g IV infusion over 15 minutes. Second 5.0 g dose infused over 15m to 2h if refractory hemodynamic instability.',
          chempackDeploymentTriggered: true,
          decontaminationProcedure: 'Strip outer clothing into double-bag sealed containment. Copious water skin flush. 100% high-flow supplemental oxygen.',
          ppeLevelRequired: 'Level B',
          specialCautions: [
            'Turns skin, mucous membranes, and urine chromaturic dark red/purple for several days.',
            'Interferes with colorimetric laboratory assays (carboxyhemoglobin, bilirubin, creatinine) - draw baseline labs prior to infusion if possible without delaying treatment.'
          ]
        };

      case 'CHEMICAL_VESICANT':
        return {
          cbrneClass: 'CHEMICAL_VESICANT',
          agentName: input.agentName,
          toxicityMechanism: 'DNA alkylation and glutathione depletion causing blistering, deep tissue burns, corneal ulceration, and airway sloughing.',
          antidoteRecommended: agent.includes('lewisite') ? 'British Anti-Lewisite (BAL / Dimercaprol)' : 'Supportive & Topical Burn Decontamination',
          antidoteDosingProtocol: agent.includes('lewisite')
            ? 'Dimercaprol (BAL) 3.0-5.0 mg/kg deep IM Q4H for 2 days, then Q12H. Severe painful injection in peanut oil base.'
            : 'Sulfur Mustard has no specific biochemical antidote; rapid decontamination within 2 minutes is paramount to arrest alkylation.',
          chempackDeploymentTriggered: false,
          decontaminationProcedure: 'Emergency dermal decontamination with RSDL sponge or 0.5% bleach solution within 60-120 seconds. Continuous eye irrigation with Morgan lenses for minimum 15-30 minutes.',
          ppeLevelRequired: 'Level A',
          specialCautions: [
            'Vesicant blisters contain toxic mustard liquid; do not rupture intact blisters in open field.',
            'Delayed clinical onset (2-24 hours); patients initially asymptomatic may develop catastrophic airway obstruction later.'
          ]
        };

      case 'CHEMICAL_PULMONARY':
        return {
          cbrneClass: 'CHEMICAL_PULMONARY',
          agentName: input.agentName,
          toxicityMechanism: 'Direct mucosal alveolar damage leading to delayed non-cardiogenic pulmonary edema (ARDS) after 4-24 hour latency.',
          antidoteRecommended: 'Supportive: Inhaled Beta-2 Agonists + PEEP Mechanical Ventilation',
          antidoteDosingProtocol: 'Nebulized Albuterol 2.5-5.0 mg Q20m PRN bronchospasm. Early positive end-expiratory pressure (PEEP) titration. Restrict fluids judiciously to prevent worsening alveolar flooding.',
          chempackDeploymentTriggered: false,
          decontaminationProcedure: 'Move upwind to fresh air. Remove clothing. Flush eyes and skin with tepid water for 15 minutes.',
          ppeLevelRequired: 'Level C',
          specialCautions: [
            'Absolute physical rest: Exertion drastically accelerates and worsens lethal phosgene pulmonary edema.',
            'Mandatory minimum 24-hour observational hold even for mildly symptomatic patients.'
          ]
        };

      case 'RADIOLOGICAL':
        const isCesium = agent.includes('cesium') || agent.includes('137');
        const isIodine = agent.includes('iodine') || agent.includes('131');
        return {
          cbrneClass: 'RADIOLOGICAL',
          agentName: input.agentName,
          toxicityMechanism: 'Ionizing radiation damage (DNA double-strand breaks, acute radiation sickness, and internal radioisotope deposition).',
          antidoteRecommended: isCesium
            ? 'Prussian Blue (Ferric hexacyanoferrate)'
            : isIodine
            ? 'Potassium Iodide (KI)'
            : 'DTPA (Calcium/Zinc Diethylenetriaminepentaacetate)',
          antidoteDosingProtocol: isCesium
            ? 'Prussian Blue: 3.0 g orally three times daily with food (pediatric: 1.0 g PO TID). Binds Cesium-137 in gut to accelerate fecal elimination.'
            : isIodine
            ? 'Potassium Iodide (KI): 130 mg PO once (children: 65 mg, infants: 16-32 mg) within 4 hours to saturate thyroid iodine receptors.'
            : 'Ca-DTPA 1.0 g IV/inhalation initial dose in first 24h, followed by Zn-DTPA for transuranics (Plutonium, Americium).',
          chempackDeploymentTriggered: false,
          decontaminationProcedure: 'Gross decontamination: Removal of clothing removes 90% of external contamination. Wash with mild soap and lukewarm water (avoid hot water which causes vasodilation and increased dermal absorption). Survey with Geiger counter target <2x background.',
          ppeLevelRequired: 'Level C',
          specialCautions: [
            'Radiological contamination is rarely an immediate threat to healthcare worker life compared to conventional trauma: Life-saving resuscitation takes priority over decontamination.',
            'Collect 24-hour urine and baseline CBC with differential to track lymphocyte depletion kinetics.'
          ]
        };

      case 'BIOLOGICAL':
      default:
        return {
          cbrneClass: 'BIOLOGICAL',
          agentName: input.agentName,
          toxicityMechanism: 'Bacterial/viral weaponization (Anthrax, Smallpox, Botulinum neurotoxin, Plague, Tularemia).',
          antidoteRecommended: agent.includes('botulinum')
            ? 'Heptavalent Botulinum Antitoxin (HBAT)'
            : 'Ciprofloxacin / Doxycycline Post-Exposure Prophylaxis',
          antidoteDosingProtocol: agent.includes('botulinum')
            ? 'HBAT 1 vial IV infusion diluted 1:10 in normal saline. Binds free circulating neurotoxin types A-G.'
            : 'Ciprofloxacin 500 mg PO BID or Doxycycline 100 mg PO BID for 60 days with Anthrax vaccine adsorbed (AVA).',
          chempackDeploymentTriggered: true,
          decontaminationProcedure: 'Contact & Airborne isolation with N95/PAPR. Soap and water hand hygiene (spores resist alcohol-based hand sanitizer).',
          ppeLevelRequired: 'Level C',
          specialCautions: [
            'Enforce strict cohorting and negative pressure isolation.',
            'Notify CDC and state public health laboratory immediately.'
          ]
        };
    }
  }

  /**
   * Database: Create MCI Triage Encounter
   */
  public static async createEncounter(input: {
    incidentName: string;
    patientIdentifier: string;
    isPediatric: boolean;
    triageCategory: MCICategory;
    canWalk: boolean;
    respiratoryRate?: number;
    perfusionIntact: boolean;
    mentalStatus: string;
    airwayInterventionNeeded: boolean;
    decontaminationStatus?: string;
    destinationFacilityZone?: string;
  }): Promise<any> {
    const result = await pool.query(
      `INSERT INTO mci_triage_encounters (
        incident_name, patient_identifier, is_pediatric, triage_category,
        can_walk, respiratory_rate, perfusion_intact, mental_status,
        airway_intervention_needed, decontamination_status, destination_facility_zone
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        input.incidentName,
        input.patientIdentifier,
        input.isPediatric,
        input.triageCategory,
        input.canWalk,
        input.respiratoryRate || null,
        input.perfusionIntact,
        input.mentalStatus,
        input.airwayInterventionNeeded,
        input.decontaminationStatus || 'pending',
        input.destinationFacilityZone || 'acute_red_tent'
      ]
    );
    return result.rows[0];
  }

  /**
   * Database: List Encounters
   */
  public static async listEncounters(incidentName?: string): Promise<any[]> {
    if (incidentName) {
      const res = await pool.query(
        `SELECT * FROM mci_triage_encounters
         WHERE incident_name = $1
         ORDER BY triaged_at DESC`,
        [incidentName]
      );
      return res.rows;
    }
    const res = await pool.query(
      `SELECT * FROM mci_triage_encounters
       ORDER BY triaged_at DESC
       LIMIT 100`
    );
    return res.rows;
  }

  /**
   * Database: Record CBRNE Exposure
   */
  public static async recordExposure(input: {
    encounterId: number;
    cbrneClass: string;
    agentIdentified: string;
    antidoteRecommended: string;
    antidoteDoseInstructions: string;
    chempackRequested: boolean;
    deconMethodRecommended: string;
  }): Promise<any> {
    const result = await pool.query(
      `INSERT INTO cbrne_agent_exposures (
        encounter_id, cbrne_class, agent_identified, antidote_recommended,
        antidote_dose_instructions, chempack_requested, decon_method_recommended
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        input.encounterId,
        input.cbrneClass,
        input.agentIdentified,
        input.antidoteRecommended,
        input.antidoteDoseInstructions,
        input.chempackRequested,
        input.deconMethodRecommended
      ]
    );
    return result.rows[0];
  }

  /**
   * Database: Get Exposures for Encounter
   */
  public static async getExposuresByEncounter(encounterId: number): Promise<any[]> {
    const res = await pool.query(
      `SELECT * FROM cbrne_agent_exposures
       WHERE encounter_id = $1
       ORDER BY recorded_at DESC`,
      [encounterId]
    );
    return res.rows;
  }

  /**
   * Computes Live Disaster Surge Capacity & Triage Distribution
   */
  public static async getSurgeCapacityStats(incidentName?: string): Promise<any> {
    const query = incidentName
      ? `SELECT triage_category, COUNT(*) as count FROM mci_triage_encounters WHERE incident_name = $1 GROUP BY triage_category`
      : `SELECT triage_category, COUNT(*) as count FROM mci_triage_encounters GROUP BY triage_category`;
    const params = incidentName ? [incidentName] : [];

    const res = await pool.query(query, params);
    const breakdown: Record<string, number> = { RED: 0, YELLOW: 0, GREEN: 0, BLACK: 0 };
    let total = 0;

    res.rows.forEach(r => {
      breakdown[r.triage_category] = parseInt(r.count, 10);
      total += parseInt(r.count, 10);
    });

    return {
      incidentName: incidentName || 'All Incidents',
      totalTriaged: total,
      breakdown,
      surgeAlertLevel: breakdown.RED >= 10 ? 'CRISIS_SURGE' : breakdown.RED >= 5 ? 'ELEVATED_SURGE' : 'MANAGED'
    };
  }
}

export default CBRNETriageService;
