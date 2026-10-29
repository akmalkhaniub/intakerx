import { pool } from '../db';

export type OrganDomain =
  | 'NEUROLOGIC'
  | 'CARDIOVASCULAR'
  | 'RESPIRATORY'
  | 'RENAL_FLUIDS'
  | 'HEPATIC_METABOLIC'
  | 'HEMATOLOGIC'
  | 'OBSTETRIC_NEONATAL'
  | 'TRAUMA_BURNS_SPECIAL';

export type CenturyTier =
  | 'STABLE_OBSERVATION'
  | 'MODERATE_MONITORED'
  | 'HIGH_CRITICAL'
  | 'EXTREME_SURGE_ORCHESTRATED';

export interface CenturyPatientStateInput {
  patientId: number;
  neurologic?: {
    gcsScore?: number;
    icpMmhg?: number;
    cppMmhg?: number;
    statusEpilepticusActive?: boolean;
    spinalCordInjuryLevel?: string;
    subarachnoidVasospasmActive?: boolean;
  };
  cardiovascular: {
    heartRate: number;
    systolicBp: number;
    diastolicBp: number;
    meanArterialPressure: number;
    shockIndex: number;
    vasoactiveInotropicScore?: number;
    acuteAorticDissectionTypeA?: boolean;
    cardiogenicShockEtiology?: string;
    activeMcsDevice?: string;
  };
  respiratory?: {
    paO2FiO2Ratio?: number;
    mechanicalVentilation?: boolean;
    drivingPressureCmH2O?: number;
    inhalationInjurySuspected?: boolean;
    carboxyhemoglobinPct?: number;
    severeAsthmaBronchospasm?: boolean;
  };
  renalFluids?: {
    serumCreatinineMgDl?: number;
    hourlyUrineOutputMlKgH?: number;
    crrtActive?: boolean;
    bladderPressureIapMmhg?: number;
    cumulativeFluidBalanceLiters?: number;
  };
  hepaticMetabolic?: {
    totalBilirubinMgDl?: number;
    dkaOrHhsActive?: boolean;
    swanseaAflpScore?: number;
    pancreatitisNecrotizing?: boolean;
    serumLactateMmolL?: number;
  };
  hematologic?: {
    plateletCountK?: number;
    fibrinogenMgDl?: number;
    inr?: number;
    activeMtpProtocol?: boolean;
    activeDic?: boolean;
  };
  obstetric?: {
    isPregnantOrPostpartum?: boolean;
    gestationalAgeWeeks?: number;
    activeMaternalCardiacArrest?: boolean;
    severePreeclampsiaEclampsia?: boolean;
    postpartumHemorrhageActive?: boolean;
    qblMl?: number;
  };
  traumaAndBurns?: {
    burnTbsaPercentage?: number;
    traumaIssScore?: number;
    cbrneExposureType?: string;
  };
}

export interface CrossPhaseConflict {
  conflictId: string;
  title: string;
  hazardDescription: string;
  involvedPhases: string;
  arbitratedResolutionDirective: string;
  priorityRank: number;
}

export interface CenturySynthesisResult {
  patientId: number;
  centuryScore: number;
  centuryTier: CenturyTier;
  primaryDomain: OrganDomain;
  domainScores: Record<OrganDomain, number>;
  crossPhaseConflicts: CrossPhaseConflict[];
  dispatchedTeams: string[];
  executiveCarePlan: {
    primaryResuscitationGoal: string;
    hemodynamicTargets: string;
    ventilatoryTargets: string;
    metabolicTransfusionTargets: string;
    safetyContraindicationsActive: string[];
  };
  protocolDirectives: string[];
  executiveSummary: string;
}

export class CenturyOrchestratorService {
  /**
   * The Phase 100 Grand Meta-Executive Synthesizer:
   * Aggregates organ scores across all 8 domains, detects cross-phase guideline conflicts,
   * arbitrates contradictions, and issues high-command directives.
   */
  public static synthesizeGrandOrchestration(input: CenturyPatientStateInput): CenturySynthesisResult {
    const directives: string[] = [];
    const conflicts: CrossPhaseConflict[] = [];
    const dispatchedTeams: string[] = [];
    const safetyContraindications: string[] = [];

    // Initialize Domain Scores (0 to 10 scale for each)
    const domainScores: Record<OrganDomain, number> = {
      NEUROLOGIC: 0,
      CARDIOVASCULAR: 0,
      RESPIRATORY: 0,
      RENAL_FLUIDS: 0,
      HEPATIC_METABOLIC: 0,
      HEMATOLOGIC: 0,
      OBSTETRIC_NEONATAL: 0,
      TRAUMA_BURNS_SPECIAL: 0
    };

    // 1. NEUROLOGIC DOMAIN
    if (input.neurologic) {
      const n = input.neurologic;
      if (n.gcsScore !== undefined && n.gcsScore <= 8) domainScores.NEUROLOGIC += 4;
      if (n.icpMmhg !== undefined && n.icpMmhg > 20.0) domainScores.NEUROLOGIC += 3;
      if (n.cppMmhg !== undefined && n.cppMmhg < 60.0) domainScores.NEUROLOGIC += 2;
      if (n.statusEpilepticusActive) {
        domainScores.NEUROLOGIC += 5;
        dispatchedTeams.push('Neuro-Intensive Care Team (Status Epilepticus Protocol)');
      }
      if (n.spinalCordInjuryLevel) {
        domainScores.NEUROLOGIC += 4;
        directives.push(`Spinal Cord Trauma (${n.spinalCordInjuryLevel}): Target MAP 85-90 mmHg to maintain cord perfusion.`);
      }
      if (n.subarachnoidVasospasmActive) domainScores.NEUROLOGIC += 3;
    }
    domainScores.NEUROLOGIC = Math.min(10, domainScores.NEUROLOGIC);

    // 2. CARDIOVASCULAR DOMAIN
    const cv = input.cardiovascular;
    if (cv.shockIndex >= 1.0) domainScores.CARDIOVASCULAR += 4;
    else if (cv.shockIndex >= 0.8) domainScores.CARDIOVASCULAR += 2;
    if (cv.meanArterialPressure < 65.0) domainScores.CARDIOVASCULAR += 3;
    if (cv.vasoactiveInotropicScore !== undefined && cv.vasoactiveInotropicScore >= 15.0) domainScores.CARDIOVASCULAR += 4;
    if (cv.activeMcsDevice) {
      domainScores.CARDIOVASCULAR += 5;
      dispatchedTeams.push(`Mechanical Circulatory Support Team (${cv.activeMcsDevice})`);
    }
    if (cv.acuteAorticDissectionTypeA) {
      domainScores.CARDIOVASCULAR += 6;
      dispatchedTeams.push('Cardiovascular Surgery (STAT Type A Aortic Dissection)');
      directives.push('Type A Aortic Dissection: Anti-impulse dP/dt therapy mandatory (Target SBP < 120, HR < 60).');
    }
    domainScores.CARDIOVASCULAR = Math.min(10, domainScores.CARDIOVASCULAR);

    // 3. RESPIRATORY DOMAIN
    if (input.respiratory) {
      const r = input.respiratory;
      if (r.paO2FiO2Ratio !== undefined && r.paO2FiO2Ratio < 100.0) domainScores.RESPIRATORY += 5;
      else if (r.paO2FiO2Ratio !== undefined && r.paO2FiO2Ratio < 200.0) domainScores.RESPIRATORY += 3;
      if (r.drivingPressureCmH2O !== undefined && r.drivingPressureCmH2O > 15.0) domainScores.RESPIRATORY += 2;
      if (r.inhalationInjurySuspected) {
        domainScores.RESPIRATORY += 4;
        directives.push('Inhalation Injury: Early intubation and continuous 100% FiO2.');
      }
      if (r.severeAsthmaBronchospasm) {
        domainScores.RESPIRATORY += 3;
        safetyContraindications.push('Carboprost / PGF2alpha (Asthma bronchospasm risk)');
      }
    }
    domainScores.RESPIRATORY = Math.min(10, domainScores.RESPIRATORY);

    // 4. RENAL & FLUIDS DOMAIN
    if (input.renalFluids) {
      const rf = input.renalFluids;
      if (rf.hourlyUrineOutputMlKgH !== undefined && rf.hourlyUrineOutputMlKgH < 0.5) domainScores.RENAL_FLUIDS += 3;
      if (rf.serumCreatinineMgDl !== undefined && rf.serumCreatinineMgDl > 2.0) domainScores.RENAL_FLUIDS += 3;
      if (rf.crrtActive) domainScores.RENAL_FLUIDS += 4;
      if (rf.bladderPressureIapMmhg !== undefined && rf.bladderPressureIapMmhg >= 20.0) {
        domainScores.RENAL_FLUIDS += 5;
        dispatchedTeams.push('Surgical Team (Abdominal Compartment Syndrome Decompression)');
      }
    }
    domainScores.RENAL_FLUIDS = Math.min(10, domainScores.RENAL_FLUIDS);

    // 5. HEPATIC & METABOLIC DOMAIN
    if (input.hepaticMetabolic) {
      const hm = input.hepaticMetabolic;
      if (hm.serumLactateMmolL !== undefined && hm.serumLactateMmolL >= 4.0) domainScores.HEPATIC_METABOLIC += 4;
      if (hm.dkaOrHhsActive) domainScores.HEPATIC_METABOLIC += 3;
      if (hm.swanseaAflpScore !== undefined && hm.swanseaAflpScore >= 6) domainScores.HEPATIC_METABOLIC += 4;
      if (hm.pancreatitisNecrotizing) domainScores.HEPATIC_METABOLIC += 3;
      if (hm.totalBilirubinMgDl !== undefined && hm.totalBilirubinMgDl > 3.0) domainScores.HEPATIC_METABOLIC += 2;
    }
    domainScores.HEPATIC_METABOLIC = Math.min(10, domainScores.HEPATIC_METABOLIC);

    // 6. HEMATOLOGIC DOMAIN
    if (input.hematologic) {
      const h = input.hematologic;
      if (h.activeMtpProtocol) {
        domainScores.HEMATOLOGIC += 5;
        dispatchedTeams.push('Massive Transfusion Protocol (Blood Bank Command)');
      }
      if (h.fibrinogenMgDl !== undefined && h.fibrinogenMgDl < 150.0) domainScores.HEMATOLOGIC += 4;
      if (h.plateletCountK !== undefined && h.plateletCountK < 50.0) domainScores.HEMATOLOGIC += 3;
      if (h.activeDic) domainScores.HEMATOLOGIC += 4;
    }
    domainScores.HEMATOLOGIC = Math.min(10, domainScores.HEMATOLOGIC);

    // 7. OBSTETRIC & NEONATAL DOMAIN
    if (input.obstetric) {
      const ob = input.obstetric;
      if (ob.activeMaternalCardiacArrest) {
        domainScores.OBSTETRIC_NEONATAL += 6;
        dispatchedTeams.push('Code Obstetric Resuscitation Team (4-Min PMCS Scalpel Alert)');
        directives.push('STAT MATERNAL ARREST: Manual LUD on flat backboard. PMCS scalpel bedside.');
      }
      if (ob.severePreeclampsiaEclampsia) {
        domainScores.OBSTETRIC_NEONATAL += 4;
        safetyContraindications.push('Methergine / Ergot alkaloids (Hypertensive crisis risk)');
      }
      if (ob.postpartumHemorrhageActive || (ob.qblMl !== undefined && ob.qblMl > 1000.0)) {
        domainScores.OBSTETRIC_NEONATAL += 5;
        dispatchedTeams.push('OB-Hemorrhage Surgical Response Team');
      }
    }
    domainScores.OBSTETRIC_NEONATAL = Math.min(10, domainScores.OBSTETRIC_NEONATAL);

    // 8. TRAUMA, BURNS & SPECIAL DOMAIN
    if (input.traumaAndBurns) {
      const tb = input.traumaAndBurns;
      if (tb.burnTbsaPercentage !== undefined && tb.burnTbsaPercentage >= 30.0) {
        domainScores.TRAUMA_BURNS_SPECIAL += 5;
        dispatchedTeams.push('Burn Intensive Care Unit Team');
      }
      if (tb.traumaIssScore !== undefined && tb.traumaIssScore >= 25) {
        domainScores.TRAUMA_BURNS_SPECIAL += 5;
        dispatchedTeams.push('Trauma One Resuscitation Team');
      }
      if (tb.cbrneExposureType) {
        domainScores.TRAUMA_BURNS_SPECIAL += 5;
        dispatchedTeams.push(`CBRNE Hazmat Response (${tb.cbrneExposureType})`);
      }
    }
    domainScores.TRAUMA_BURNS_SPECIAL = Math.min(10, domainScores.TRAUMA_BURNS_SPECIAL);

    // =========================================================================
    // CROSS-PHASE CONFLICT RESOLUTION ARBITRATION MATRIX
    // =========================================================================

    // Conflict 1: Aortic Dissection vs. Spinal Cord Perfusion (Phases 66 vs 95)
    if (cv.acuteAorticDissectionTypeA && input.neurologic?.spinalCordInjuryLevel) {
      conflicts.push({
        conflictId: 'CONFLICT_AORTIC_VS_SPINAL_MAP',
        title: 'Aortic Dissection (Anti-Impulse SBP < 120) vs. Spinal Cord Perfusion (MAP > 85)',
        hazardDescription: 'Aortic dissection rupture is uniformly fatal if SBP spikes, while spinal cord ischemia risks permanent paraplegia if MAP drops.',
        involvedPhases: 'Phase 66 (AORTA-CODE) vs. Phase 95 (SPINAL-CORD)',
        arbitratedResolutionDirective: 'EXECUTIVE ARBITRATION: Anti-impulse control takes absolute survival precedence over spinal cord MAP augmentation. Prioritize Esmolol infusion to keep SBP 110-120 and HR < 60 to prevent catastrophic aortic exsanguination. Place lumbar drain for CSF pressure reduction to augment spinal cord perfusion pressure without raising systemic arterial pressure.',
        priorityRank: 1
      });
      directives.push('ARBITRATION MANDATE: Aortic rupture risk > Cord ischemia. Keep SBP < 120 with Esmolol. Place CSF lumbar drain.');
    }

    // Conflict 2: Preeclampsia / HTN vs. PPH Atony (Phases 97 vs 98)
    if (input.obstetric?.severePreeclampsiaEclampsia && input.obstetric?.postpartumHemorrhageActive) {
      conflicts.push({
        conflictId: 'CONFLICT_PREECLAMPSIA_VS_METHERGINE',
        title: 'Preeclampsia / Severe HTN vs. Postpartum Hemorrhage (Methergine)',
        hazardDescription: 'Methylergonovine causes profound systemic vasoconstriction which can trigger stroke, intracranial hemorrhage, or eclampsia in preeclampsia.',
        involvedPhases: 'Phase 97 (PREECLAMPSIA-SHIELD) vs. Phase 98 (OB-HEMORRHAGE)',
        arbitratedResolutionDirective: 'EXECUTIVE ARBITRATION: Methylergonovine (Methergine) is STRICTLY CONTRAINDICATED. Skip directly to 15-methyl PGF2alpha (Carboprost 250 mcg IM) or Misoprostol (800-1000 mcg sublingual) + early Bakri intrauterine balloon tamponade.',
        priorityRank: 2
      });
      directives.push('ARBITRATION MANDATE: Methergine strictly contraindicated due to preeclampsia. Escalate to Carboprost/Misoprostol + Bakri balloon.');
    }

    // Conflict 3: Severe Asthma vs. PPH Atony (Phases 65 vs 98)
    if (input.respiratory?.severeAsthmaBronchospasm && input.obstetric?.postpartumHemorrhageActive) {
      conflicts.push({
        conflictId: 'CONFLICT_ASTHMA_VS_CARBOPROST',
        title: 'Severe Asthma / Bronchospasm vs. Postpartum Hemorrhage (Carboprost / Hemabate)',
        hazardDescription: 'Carboprost (PGF2alpha) is a potent bronchoconstrictor that can trigger catastrophic, fatal status asthmaticus.',
        involvedPhases: 'Phase 65 (STATUS-PULMO) vs. Phase 98 (OB-HEMORRHAGE)',
        arbitratedResolutionDirective: 'EXECUTIVE ARBITRATION: Carboprost (Hemabate) is STRICTLY CONTRAINDICATED in active asthma. Use Methergine (if not hypertensive), Misoprostol 800-1000 mcg, Tranexamic Acid (TXA 1g IV), and intrauterine balloon tamponade.',
        priorityRank: 2
      });
      directives.push('ARBITRATION MANDATE: Carboprost strictly contraindicated due to asthma. Escalate to Methergine/Misoprostol + TXA.');
    }

    // Conflict 4: ARDS Fluid Restriction vs. Cerebral Salt Wasting (Phases 54 vs 92)
    if (input.respiratory?.paO2FiO2Ratio !== undefined && input.respiratory.paO2FiO2Ratio < 150.0 && input.hepaticMetabolic?.serumLactateMmolL !== undefined && input.neurologic?.cppMmhg !== undefined && input.neurologic.cppMmhg < 60.0) {
      conflicts.push({
        conflictId: 'CONFLICT_ARDS_VS_CEREBRAL_PERFUSION',
        title: 'ARDS Lung-Protective Fluid Restriction vs. Neurotrauma CPP Augmentation',
        hazardDescription: 'Aggressive volume expansion worsens alveolar flooding in ARDS, while fluid restriction precipitates cerebral ischemia.',
        involvedPhases: 'Phase 54 (NEURO-CRIT) vs. Phase 65 (STATUS-PULMO / ARDS)',
        arbitratedResolutionDirective: 'EXECUTIVE ARBITRATION: Restrict isotonic crystalloids. Use Hypertonic Saline (3% NaCl) to drive serum osmolarity and maintain sodium >= 145 mEq/L while utilizing Norepinephrine and Vasopressin to maintain CPP >= 60-70 mmHg without pulmonary capillary overload.',
        priorityRank: 3
      });
      directives.push('ARBITRATION MANDATE: Hypertonic Saline (3%) + Norepinephrine to achieve CPP >= 60 without pulmonary capillary overload.');
    }

    // Conflict 5: Burn Shock Parkland Resuscitation vs. Abdominal Compartment Syndrome (Phases 99 vs 44)
    if (input.traumaAndBurns?.burnTbsaPercentage !== undefined && input.traumaAndBurns.burnTbsaPercentage >= 30.0 && input.renalFluids?.bladderPressureIapMmhg !== undefined && input.renalFluids.bladderPressureIapMmhg >= 20.0) {
      conflicts.push({
        conflictId: 'CONFLICT_BURN_PARKLAND_VS_ACS',
        title: 'Parkland Fluid Resuscitation vs. Abdominal Compartment Syndrome (IAP >= 20 mmHg)',
        hazardDescription: 'Continuing large-volume crystalloid resuscitation will cause visceral ischemic necrosis and fatal ventilatory arrest.',
        involvedPhases: 'Phase 99 (BURN-RESUS) vs. Phase 44 (CRRT-NAVIGATOR / ACS)',
        arbitratedResolutionDirective: 'EXECUTIVE ARBITRATION: Stop crystalloid rate escalation. Reduce Lactated Ringers by 25% and initiate 5% Albumin colloid rescue (0.5-1.0 mL/kg/%TBSA) to pull edema out of third spaces. Perform immediate bedside torso/limb escharotomy and evaluate for surgical decompressive laparotomy.',
        priorityRank: 1
      });
      directives.push('ARBITRATION MANDATE: Cease crystalloid escalation. Administer 5% Albumin colloid rescue + bedside surgical escharotomy.');
    }

    // Calculate Century Composite Severity Score (0 to 100)
    const rawSum = Object.values(domainScores).reduce((acc, score) => acc + score, 0);
    const severeDomainsCount = Object.values(domainScores).filter(s => s >= 5).length;
    const moderateDomainsCount = Object.values(domainScores).filter(s => s >= 3 && s < 5).length;
    
    // Multi-Organ Failure (MOF) synergy multiplier
    let mofMultiplier = 1.0;
    if (severeDomainsCount >= 4) mofMultiplier = 1.6;
    else if (severeDomainsCount >= 3) mofMultiplier = 1.45;
    else if (severeDomainsCount >= 2) mofMultiplier = 1.3;
    else if (severeDomainsCount >= 1 && moderateDomainsCount >= 2) mofMultiplier = 1.2;

    const baseScore = (rawSum / 50.0) * 65.0;
    const conflictPenalty = conflicts.length * 6;
    const centuryScore = Math.min(100, Math.round(baseScore * mofMultiplier + conflictPenalty));

    // Determine Century Tier
    let centuryTier: CenturyTier = 'STABLE_OBSERVATION';
    if (centuryScore >= 75) centuryTier = 'EXTREME_SURGE_ORCHESTRATED';
    else if (centuryScore >= 50) centuryTier = 'HIGH_CRITICAL';
    else if (centuryScore >= 25) centuryTier = 'MODERATE_MONITORED';
    else centuryTier = 'STABLE_OBSERVATION';

    // Primary Organ Instability Domain
    let primaryDomain: OrganDomain = 'CARDIOVASCULAR';
    let maxDomainScore = -1;
    (Object.keys(domainScores) as OrganDomain[]).forEach((domain) => {
      if (domainScores[domain] > maxDomainScore) {
        maxDomainScore = domainScores[domain];
        primaryDomain = domain;
      }
    });

    // Executive Care Plan Synthesis
    const executiveCarePlan = {
      primaryResuscitationGoal:
        centuryTier === 'EXTREME_SURGE_ORCHESTRATED'
          ? 'EMERGENCY MULTI-ORGAN SALVAGE: Simultaneous surgical & pharmacological stabilization across critical domains.'
          : centuryTier === 'HIGH_CRITICAL'
          ? 'CRITICAL ORGAN PRESERVATION: Titrate vasoactives, protect end-organs, and resolve physiological conflicts.'
          : 'ORGAN HOMEOSTASIS MAINTENANCE: Standard hemodynamic and metabolic monitoring.',
      hemodynamicTargets:
        cv.acuteAorticDissectionTypeA
          ? 'SBP 100 - 120 mmHg, HR < 60 bpm (Anti-impulse Esmolol)'
          : input.neurologic?.spinalCordInjuryLevel
          ? 'MAP 85 - 90 mmHg (Cord Perfusion Goal)'
          : 'MAP >= 65 mmHg, Shock Index < 0.8',
      ventilatoryTargets:
        input.respiratory?.paO2FiO2Ratio && input.respiratory.paO2FiO2Ratio < 200
          ? 'Lung-protective: Vt 4-6 mL/kg PBW, Driving Pressure < 15 cmH2O, PEEP titration'
          : 'Maintain SpO2 92-96% (100% FiO2 if CO/cyanide suspected)',
      metabolicTransfusionTargets:
        input.hematologic?.activeMtpProtocol
          ? 'MTP 1:1:1 Balanced Transfusion. Fibrinogen >= 200 mg/dL, Platelets >= 50k, Ca2+ >= 1.1'
          : 'Fibrinogen >= 150 mg/dL, Lactate < 2.0 mmol/L, Glucose 140-180 mg/dL',
      safetyContraindicationsActive: Array.from(new Set(safetyContraindications))
    };

    const executiveSummary = `CENTURY META-EXECUTIVE: Century Score ${centuryScore}/100 (${centuryTier}). Primary domain: ${primaryDomain}. ${conflicts.length} cross-phase conflict(s) arbitrated. ${dispatchedTeams.length} specialized team(s) mobilized.`;

    return {
      patientId: input.patientId,
      centuryScore,
      centuryTier,
      primaryDomain,
      domainScores,
      crossPhaseConflicts: conflicts,
      dispatchedTeams: Array.from(new Set(dispatchedTeams)),
      executiveCarePlan,
      protocolDirectives: directives,
      executiveSummary
    };
  }

  /**
   * Persists grand orchestration session and individual conflict alerts.
   */
  public static async persistOrchestratorSession(result: CenturySynthesisResult): Promise<number> {
    const sessionQuery = `
      INSERT INTO century_orchestrator_sessions (
        patient_id,
        century_score,
        primary_instability_domain,
        organ_system_scores,
        active_conflicts_detected,
        arbitrated_orders,
        dispatched_teams,
        executive_summary
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id;
    `;

    const sessionValues = [
      result.patientId,
      result.centuryScore,
      result.primaryDomain,
      JSON.stringify(result.domainScores),
      JSON.stringify(result.crossPhaseConflicts),
      JSON.stringify(result.executiveCarePlan),
      JSON.stringify(result.dispatchedTeams),
      result.executiveSummary
    ];

    const sessionRes = await pool.query(sessionQuery, sessionValues);
    const sessionId = sessionRes.rows[0].id;

    // Persist individual alerts
    for (const conflict of result.crossPhaseConflicts) {
      const alertQuery = `
        INSERT INTO cross_phase_clinical_alerts (
          session_id,
          patient_id,
          alert_title,
          contradicting_phases,
          clinical_hazard,
          arbitration_mandate,
          resolution_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7);
      `;
      await pool.query(alertQuery, [
        sessionId,
        result.patientId,
        conflict.title,
        conflict.involvedPhases,
        conflict.hazardDescription,
        conflict.arbitratedResolutionDirective,
        'ACTIVE'
      ]);
    }

    return sessionId;
  }

  /**
   * Retrieves orchestrator sessions for a patient.
   */
  public static async getOrchestratorSessions(patientId: number): Promise<any[]> {
    const query = `
      SELECT * FROM century_orchestrator_sessions
      WHERE patient_id = $1
      ORDER BY created_at DESC;
    `;
    const res = await pool.query(query, [patientId]);
    return res.rows;
  }

  /**
   * Retrieves cross-phase clinical alerts for a patient.
   */
  public static async getClinicalAlerts(patientId: number): Promise<any[]> {
    const query = `
      SELECT * FROM cross_phase_clinical_alerts
      WHERE patient_id = $1
      ORDER BY generated_at DESC;
    `;
    const res = await pool.query(query, [patientId]);
    return res.rows;
  }
}
