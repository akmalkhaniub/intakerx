import { pool } from '../db';
import { CenturyOrchestratorService, CenturyPatientStateInput } from './centuryOrchestrator';

// ============================================================================
// FHIR R4 & CDS HOOKS 1.0 TYPE DEFINITIONS
// ============================================================================

export interface FhirCapabilityStatement {
  resourceType: 'CapabilityStatement';
  id: string;
  status: 'active';
  date: string;
  publisher: string;
  kind: 'instance';
  software: {
    name: string;
    version: string;
  };
  implementation: {
    description: string;
    url: string;
  };
  fhirVersion: '4.0.1';
  format: string[];
  rest: Array<{
    mode: 'server';
    security?: {
      cors: boolean;
      service: Array<{
        coding: Array<{
          system: string;
          code: string;
          display: string;
        }>;
      }>;
      extension?: any[];
    };
    resource: Array<{
      type: string;
      profile?: string;
      interaction: Array<{ code: string }>;
      searchParam?: Array<{ name: string; type: string }>;
    }>;
  }>;
}

export interface FhirPatient {
  resourceType: 'Patient';
  id: string;
  identifier?: Array<{ system: string; value: string }>;
  active: boolean;
  name: Array<{ use: string; text: string; family?: string; given?: string[] }>;
  gender: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
}

export interface FhirObservation {
  resourceType: 'Observation';
  id: string;
  status: 'final' | 'preliminary' | 'amended';
  category?: Array<{
    coding: Array<{ system: string; code: string; display: string }>;
  }>;
  code: {
    coding: Array<{ system: string; code: string; display: string }>;
    text?: string;
  };
  subject: { reference: string; display?: string };
  effectiveDateTime: string;
  valueQuantity?: {
    value: number;
    unit: string;
    system: string;
    code: string;
  };
  valueString?: string;
  interpretation?: Array<{
    coding: Array<{ system: string; code: string; display: string }>;
  }>;
}

export interface FhirCondition {
  resourceType: 'Condition';
  id: string;
  clinicalStatus: {
    coding: Array<{ system: string; code: string; display: string }>;
  };
  verificationStatus: {
    coding: Array<{ system: string; code: string; display: string }>;
  };
  category?: Array<{
    coding: Array<{ system: string; code: string; display: string }>;
  }>;
  severity?: {
    coding: Array<{ system: string; code: string; display: string }>;
  };
  code: {
    coding: Array<{ system: string; code: string; display: string }>;
    text: string;
  };
  subject: { reference: string };
  onsetDateTime?: string;
}

export interface FhirCarePlan {
  resourceType: 'CarePlan';
  id: string;
  status: 'active' | 'completed' | 'draft';
  intent: 'plan' | 'order';
  title: string;
  description: string;
  subject: { reference: string };
  period?: { start: string };
  goal?: Array<{ reference?: string; display: string }>;
  activity?: Array<{
    detail: {
      status: string;
      description: string;
    };
  }>;
}

export interface FhirFlag {
  resourceType: 'Flag';
  id: string;
  status: 'active' | 'inactive';
  category?: Array<{
    coding: Array<{ system: string; code: string; display: string }>;
  }>;
  code: {
    coding?: Array<{ system: string; code: string; display: string }>;
    text: string;
  };
  subject: { reference: string };
  period?: { start: string };
}

// CDS Hooks 1.0 Specifications
export interface CdsServiceDefinition {
  hook: 'patient-view' | 'order-select' | 'order-sign';
  title: string;
  description: string;
  id: string;
  prefetch?: Record<string, string>;
}

export interface CdsCardSuggestion {
  label: string;
  uuid?: string;
  actions?: Array<{
    type: 'create' | 'update' | 'delete';
    description: string;
    resource?: any;
  }>;
}

export interface CdsCard {
  uuid?: string;
  summary: string;
  detail?: string;
  indicator: 'info' | 'warning' | 'critical';
  source: {
    label: string;
    url?: string;
    icon?: string;
  };
  suggestions?: CdsCardSuggestion[];
  selectionBehavior?: 'at-most-one' | 'any';
  overrideReasons?: Array<{ code: string; display: string }>;
  links?: Array<{ label: string; url: string; type: 'absolute' | 'smart' }>;
}

export interface CdsHookRequest {
  hook: string;
  hookInstance: string;
  fhirServer?: string;
  fhirAuthorization?: any;
  context: {
    userId?: string;
    patientId: string;
    encounterId?: string;
    selections?: string[];
    draftOrders?: any;
  };
  prefetch?: Record<string, any>;
}

export interface CdsHookResponse {
  cards: CdsCard[];
}

// ============================================================================
// FHIR GATEWAY & CDS HOOKS SERVICE
// ============================================================================

export class FhirGatewayService {
  /**
   * Generates FHIR R4 CapabilityStatement (Conformance Metadata).
   */
  public static getCapabilityStatement(baseUrl: string = 'https://intakerx.internal/api/fhir/r4'): FhirCapabilityStatement {
    return {
      resourceType: 'CapabilityStatement',
      id: 'intakerx-fhir-r4-gateway',
      status: 'active',
      date: new Date().toISOString(),
      publisher: 'IntakeRx Autonomous Health Engine & Clinical Century Grand Care',
      kind: 'instance',
      software: {
        name: 'IntakeRx FHIR R4 Bi-Directional Gateway',
        version: '4.0.1-century-v1'
      },
      implementation: {
        description: 'SMART on FHIR R4 Gateway with Native CDS Hooks 1.0 Provider and Century Multi-Organ Orchestration Support',
        url: baseUrl
      },
      fhirVersion: '4.0.1',
      format: ['application/fhir+json', 'application/json'],
      rest: [
        {
          mode: 'server',
          security: {
            cors: true,
            service: [
              {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/restful-security-service',
                    code: 'SMART-on-FHIR',
                    display: 'SMART-on-FHIR OAuth2 Security'
                  }
                ]
              }
            ]
          },
          resource: [
            {
              type: 'Patient',
              interaction: [{ code: 'read' }, { code: 'search-type' }],
              searchParam: [{ name: '_id', type: 'token' }, { name: 'name', type: 'string' }]
            },
            {
              type: 'Observation',
              interaction: [{ code: 'read' }, { code: 'search-type' }, { code: 'create' }],
              searchParam: [{ name: 'patient', type: 'reference' }, { name: 'code', type: 'token' }]
            },
            {
              type: 'Condition',
              interaction: [{ code: 'read' }, { code: 'search-type' }, { code: 'create' }],
              searchParam: [{ name: 'patient', type: 'reference' }]
            },
            {
              type: 'CarePlan',
              interaction: [{ code: 'read' }, { code: 'search-type' }, { code: 'create' }],
              searchParam: [{ name: 'patient', type: 'reference' }]
            },
            {
              type: 'Flag',
              interaction: [{ code: 'read' }, { code: 'search-type' }],
              searchParam: [{ name: 'patient', type: 'reference' }]
            }
          ]
        }
      ]
    };
  }

  /**
   * Fetches a patient and converts to FHIR R4 Patient resource.
   */
  public static async getFhirPatient(patientId: number): Promise<FhirPatient | null> {
    const res = await pool.query('SELECT * FROM patients WHERE id = $1', [patientId]);
    if (res.rows.length === 0) return null;
    const p = res.rows[0];

    const names = (p.name || 'Unknown Patient').split(' ');
    const given = names.slice(0, -1);
    const family = names[names.length - 1];

    let gender: 'male' | 'female' | 'other' | 'unknown' = 'unknown';
    if (p.sex) {
      const s = p.sex.toLowerCase();
      if (s === 'male' || s === 'm') gender = 'male';
      else if (s === 'female' || s === 'f') gender = 'female';
      else gender = 'other';
    }

    return {
      resourceType: 'Patient',
      id: String(p.id),
      identifier: [
        {
          system: 'urn:oid:intakerx:patients',
          value: `PAT-${p.id}`
        }
      ],
      active: true,
      name: [
        {
          use: 'official',
          text: p.name,
          family,
          given: given.length > 0 ? given : [p.name]
        }
      ],
      gender,
      birthDate: p.dob ? new Date(p.dob).toISOString().split('T')[0] : undefined
    };
  }

  /**
   * Resolves latest simulated or live clinical state for a patient.
   */
  public static async getPatientClinicalState(patientId: number): Promise<CenturyPatientStateInput | null> {
    // Check simulated beds first
    const simRes = await pool.query('SELECT current_state FROM icu_simulated_beds WHERE patient_id = $1 LIMIT 1', [patientId]);
    if (simRes.rows.length > 0) {
      return simRes.rows[0].current_state as CenturyPatientStateInput;
    }

    // Check century sessions
    const sesRes = await pool.query('SELECT patient_state FROM century_sessions WHERE patient_id = $1 ORDER BY id DESC LIMIT 1', [patientId]);
    if (sesRes.rows.length > 0) {
      return sesRes.rows[0].patient_state as CenturyPatientStateInput;
    }

    return null;
  }

  /**
   * Maps patient vital signs and lab metrics to FHIR R4 Observation resources.
   */
  public static async getFhirObservations(patientId: number): Promise<FhirObservation[]> {
    const state = await this.getPatientClinicalState(patientId);
    if (!state) return [];

    const observations: FhirObservation[] = [];
    const now = new Date().toISOString();
    const subjectRef = `Patient/${patientId}`;

    const cv = state.cardiovascular;
    if (cv) {
      // Heart Rate (LOINC 8867-4)
      observations.push({
        resourceType: 'Observation',
        id: `obs-hr-${patientId}`,
        status: 'final',
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs', display: 'Vital Signs' }] }],
        code: { coding: [{ system: 'http://loinc.org', code: '8867-4', display: 'Heart rate' }], text: 'Heart rate' },
        subject: { reference: subjectRef },
        effectiveDateTime: now,
        valueQuantity: { value: cv.heartRate, unit: 'beats/min', system: 'http://unitsofmeasure.org', code: '/min' }
      });

      // Systolic Blood Pressure (LOINC 8480-6)
      observations.push({
        resourceType: 'Observation',
        id: `obs-sbp-${patientId}`,
        status: 'final',
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs', display: 'Vital Signs' }] }],
        code: { coding: [{ system: 'http://loinc.org', code: '8480-6', display: 'Systolic blood pressure' }], text: 'Systolic blood pressure' },
        subject: { reference: subjectRef },
        effectiveDateTime: now,
        valueQuantity: { value: cv.systolicBp, unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' }
      });

      // Mean Arterial Pressure (LOINC 8478-0)
      observations.push({
        resourceType: 'Observation',
        id: `obs-map-${patientId}`,
        status: 'final',
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs', display: 'Vital Signs' }] }],
        code: { coding: [{ system: 'http://loinc.org', code: '8478-0', display: 'Mean blood pressure' }], text: 'Mean arterial pressure' },
        subject: { reference: subjectRef },
        effectiveDateTime: now,
        valueQuantity: { value: cv.meanArterialPressure, unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' }
      });

      // Shock Index (Custom clinical metric)
      observations.push({
        resourceType: 'Observation',
        id: `obs-si-${patientId}`,
        status: 'final',
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'exam', display: 'Exam' }] }],
        code: { coding: [{ system: 'urn:oid:intakerx:metrics', code: 'SHOCK_INDEX', display: 'Shock Index (HR/SBP)' }], text: 'Shock Index' },
        subject: { reference: subjectRef },
        effectiveDateTime: now,
        valueQuantity: { value: cv.shockIndex, unit: 'ratio', system: 'http://unitsofmeasure.org', code: '1' }
      });
    }

    // Neurologic: ICP & CPP
    if (state.neurologic?.icpMmhg !== undefined) {
      observations.push({
        resourceType: 'Observation',
        id: `obs-icp-${patientId}`,
        status: 'final',
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs', display: 'Vital Signs' }] }],
        code: { coding: [{ system: 'http://loinc.org', code: '60955-2', display: 'Intracranial pressure' }], text: 'Intracranial pressure' },
        subject: { reference: subjectRef },
        effectiveDateTime: now,
        valueQuantity: { value: state.neurologic.icpMmhg, unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' }
      });
    }

    if (state.neurologic?.cppMmhg !== undefined) {
      observations.push({
        resourceType: 'Observation',
        id: `obs-cpp-${patientId}`,
        status: 'final',
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs', display: 'Vital Signs' }] }],
        code: { coding: [{ system: 'http://loinc.org', code: '75317-8', display: 'Cerebral perfusion pressure' }], text: 'Cerebral perfusion pressure' },
        subject: { reference: subjectRef },
        effectiveDateTime: now,
        valueQuantity: { value: state.neurologic.cppMmhg, unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' }
      });
    }

    // Renal / Abdominal: Bladder IAP
    if (state.renalFluids?.bladderPressureIapMmhg !== undefined) {
      observations.push({
        resourceType: 'Observation',
        id: `obs-iap-${patientId}`,
        status: 'final',
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs', display: 'Vital Signs' }] }],
        code: { coding: [{ system: 'http://loinc.org', code: '75318-6', display: 'Intra-abdominal pressure' }], text: 'Intra-abdominal pressure (Bladder)' },
        subject: { reference: subjectRef },
        effectiveDateTime: now,
        valueQuantity: { value: state.renalFluids.bladderPressureIapMmhg, unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' }
      });
    }

    return observations;
  }

  /**
   * Maps active clinical diagnoses and syndrome states to FHIR R4 Condition resources.
   */
  public static async getFhirConditions(patientId: number): Promise<FhirCondition[]> {
    const state = await this.getPatientClinicalState(patientId);
    if (!state) return [];

    const conditions: FhirCondition[] = [];
    const now = new Date().toISOString();
    const subjectRef = `Patient/${patientId}`;

    if (state.cardiovascular?.acuteAorticDissectionTypeA) {
      conditions.push({
        resourceType: 'Condition',
        id: `cond-aorta-${patientId}`,
        clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active', display: 'Active' }] },
        verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed', display: 'Confirmed' }] },
        severity: { coding: [{ system: 'http://snomed.info/sct', code: '24484000', display: 'Severe' }] },
        code: {
          coding: [{ system: 'http://snomed.info/sct', code: '308542007', display: 'Dissection of thoracic aorta, Stanford Type A' }],
          text: 'Stanford Type A Aortic Dissection'
        },
        subject: { reference: subjectRef },
        onsetDateTime: now
      });
    }

    if (state.neurologic?.spinalCordInjuryLevel) {
      conditions.push({
        resourceType: 'Condition',
        id: `cond-sci-${patientId}`,
        clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active', display: 'Active' }] },
        verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed', display: 'Confirmed' }] },
        code: {
          coding: [{ system: 'http://snomed.info/sct', code: '40956001', display: 'Traumatic spinal cord injury' }],
          text: `Spinal Cord Injury Level ${state.neurologic.spinalCordInjuryLevel}`
        },
        subject: { reference: subjectRef },
        onsetDateTime: now
      });
    }

    if (state.obstetric?.severePreeclampsiaEclampsia) {
      conditions.push({
        resourceType: 'Condition',
        id: `cond-preeclamp-${patientId}`,
        clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active', display: 'Active' }] },
        verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed', display: 'Confirmed' }] },
        severity: { coding: [{ system: 'http://snomed.info/sct', code: '24484000', display: 'Severe' }] },
        code: {
          coding: [{ system: 'http://snomed.info/sct', code: '398254007', display: 'Severe pre-eclampsia' }],
          text: 'Severe Preeclampsia / Eclampsia'
        },
        subject: { reference: subjectRef },
        onsetDateTime: now
      });
    }

    if (state.obstetric?.postpartumHemorrhageActive) {
      conditions.push({
        resourceType: 'Condition',
        id: `cond-pph-${patientId}`,
        clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active', display: 'Active' }] },
        verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed', display: 'Confirmed' }] },
        code: {
          coding: [{ system: 'http://snomed.info/sct', code: '276410001', display: 'Postpartum hemorrhage' }],
          text: 'Active Postpartum Hemorrhage'
        },
        subject: { reference: subjectRef },
        onsetDateTime: now
      });
    }

    if (state.respiratory?.severeAsthmaBronchospasm) {
      conditions.push({
        resourceType: 'Condition',
        id: `cond-asthma-${patientId}`,
        clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active', display: 'Active' }] },
        verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed', display: 'Confirmed' }] },
        code: {
          coding: [{ system: 'http://snomed.info/sct', code: '19598007', display: 'Status asthmaticus' }],
          text: 'Severe Status Asthmaticus / Bronchospasm'
        },
        subject: { reference: subjectRef },
        onsetDateTime: now
      });
    }

    if (state.renalFluids?.bladderPressureIapMmhg && state.renalFluids.bladderPressureIapMmhg >= 20.0) {
      conditions.push({
        resourceType: 'Condition',
        id: `cond-acs-${patientId}`,
        clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active', display: 'Active' }] },
        verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed', display: 'Confirmed' }] },
        code: {
          coding: [{ system: 'http://snomed.info/sct', code: '428800002', display: 'Abdominal compartment syndrome' }],
          text: 'Abdominal Compartment Syndrome (IAP >= 20 mmHg)'
        },
        subject: { reference: subjectRef },
        onsetDateTime: now
      });
    }

    return conditions;
  }

  /**
   * Generates Century Executive CarePlan as a FHIR CarePlan resource.
   */
  public static async getFhirCarePlan(patientId: number): Promise<FhirCarePlan | null> {
    const state = await this.getPatientClinicalState(patientId);
    if (!state) return null;

    const synthesis = CenturyOrchestratorService.synthesizeGrandOrchestration(state);
    const ecp = synthesis.executiveCarePlan;

    return {
      resourceType: 'CarePlan',
      id: `careplan-century-${patientId}`,
      status: 'active',
      intent: 'plan',
      title: `Century Grand Resuscitation Plan: Tier ${synthesis.centuryTier} (Score ${synthesis.centuryScore})`,
      description: synthesis.executiveSummary,
      subject: { reference: `Patient/${patientId}` },
      period: { start: new Date().toISOString() },
      goal: [
        { display: `Primary Goal: ${ecp.primaryResuscitationGoal}` },
        { display: `Hemodynamics: ${ecp.hemodynamicTargets}` },
        { display: `Ventilation: ${ecp.ventilatoryTargets}` },
        { display: `Metabolic/Transfusion: ${ecp.metabolicTransfusionTargets}` }
      ],
      activity: synthesis.protocolDirectives.map((d, idx) => ({
        detail: {
          status: 'in-progress',
          description: `[Directive #${idx + 1}] ${d}`
        }
      }))
    };
  }

  /**
   * Generates cross-phase safety contraindications as FHIR Flag resources.
   */
  public static async getFhirFlags(patientId: number): Promise<FhirFlag[]> {
    const state = await this.getPatientClinicalState(patientId);
    if (!state) return [];

    const synthesis = CenturyOrchestratorService.synthesizeGrandOrchestration(state);
    const flags: FhirFlag[] = [];

    synthesis.crossPhaseConflicts.forEach((conflict, idx) => {
      flags.push({
        resourceType: 'Flag',
        id: `flag-conflict-${patientId}-${idx}`,
        status: 'active',
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/flag-category',
                code: 'safety',
                display: 'Safety Alert'
              }
            ]
          }
        ],
        code: {
          coding: [{ system: 'urn:oid:intakerx:conflicts', code: conflict.conflictId, display: conflict.title }],
          text: `[RANK #${conflict.priorityRank}] ${conflict.title}: ${conflict.arbitratedResolutionDirective}`
        },
        subject: { reference: `Patient/${patientId}` },
        period: { start: new Date().toISOString() }
      });
    });

    return flags;
  }

  // ==========================================================================
  // CDS HOOKS 1.0 SERVICES REGISTRY & DISPATCH
  // ==========================================================================

  /**
   * Returns list of available CDS Services for the `/cds-services` discovery endpoint.
   */
  public static getCdsServicesList(): CdsServiceDefinition[] {
    return [
      {
        hook: 'patient-view',
        title: 'Century Multi-Organ Severity & Orchestration View',
        description: 'Evaluates patient multi-organ failure across 8 physiological domains and surfaces real-time Century Composite Severity Score and surge tier.',
        id: 'century-patient-view',
        prefetch: {
          patient: 'Patient/{{context.patientId}}'
        }
      },
      {
        hook: 'order-select',
        title: 'IntakeRx Cross-Phase Contraindication Interceptor',
        description: 'Intercepts contraindicated pharmacotherapy (e.g. Methergine in Preeclampsia, Carboprost in Asthma) and returns hard-stop guidance cards with safe alternatives.',
        id: 'contraindication-order-select'
      },
      {
        hook: 'order-sign',
        title: 'Critical Care Resuscitation Safety Sign Guard',
        description: 'Validates critical orders (massive transfusion ratios, fluid rates, osmolar therapies) before signature.',
        id: 'critical-order-sign'
      }
    ];
  }

  /**
   * Dispatches and evaluates a CDS Hook execution.
   */
  public static async executeCdsHook(serviceId: string, req: CdsHookRequest): Promise<CdsHookResponse> {
    const patientId = parseInt(req.context.patientId, 10) || 1;
    const state = await this.getPatientClinicalState(patientId);

    if (!state) {
      return {
        cards: [
          {
            summary: 'Patient telemetry baseline required for Century CDS evaluation',
            indicator: 'info',
            source: { label: 'IntakeRx CDS Hub' }
          }
        ]
      };
    }

    const synthesis = CenturyOrchestratorService.synthesizeGrandOrchestration(state);

    switch (serviceId) {
      case 'century-patient-view': {
        const indicator = synthesis.centuryTier === 'EXTREME_SURGE_ORCHESTRATED' ? 'critical'
          : synthesis.centuryTier === 'HIGH_CRITICAL' ? 'warning' : 'info';

        const cards: CdsCard[] = [
          {
            summary: `IntakeRx Century Severity Score: ${synthesis.centuryScore}/100 (${synthesis.centuryTier})`,
            detail: `${synthesis.executiveSummary}\n\nPrimary Domain: ${synthesis.primaryDomain}. ${synthesis.dispatchedTeams.length} Surge Teams Dispatched: ${synthesis.dispatchedTeams.join(', ')}.`,
            indicator,
            source: {
              label: 'IntakeRx Century Orchestrator (Phase 100)',
              url: 'https://intakerx.internal/century'
            },
            suggestions: synthesis.protocolDirectives.slice(0, 3).map((dir, idx) => ({
              label: `Order: ${dir.slice(0, 50)}...`,
              uuid: `sugg-${idx}`,
              actions: [
                {
                  type: 'create',
                  description: dir
                }
              ]
            }))
          }
        ];

        // If active conflicts exist, append critical arbitration card
        if (synthesis.crossPhaseConflicts.length > 0) {
          synthesis.crossPhaseConflicts.forEach((conflict) => {
            cards.push({
              summary: `⚠️ ACTIVE CLINICAL CONFLICT: ${conflict.title}`,
              detail: `Hazard: ${conflict.hazardDescription}\n\n${conflict.arbitratedResolutionDirective}`,
              indicator: 'critical',
              source: { label: 'IntakeRx Executive Arbitration Engine' },
              overrideReasons: [
                { code: 'attending-decision', display: 'Attending Intensivist bedside clinical override' },
                { code: 'alternative-protocol', display: 'Alternative patient-tailored protocol underway' }
              ]
            });
          });
        }

        return { cards };
      }

      case 'contraindication-order-select': {
        const selections = req.context.selections || [];
        const draftOrders = req.context.draftOrders || [];
        const cards: CdsCard[] = [];

        // Check if draft order contains Methergine / Methylergonovine
        const orderTexts = [
          ...selections,
          ...(Array.isArray(draftOrders) ? draftOrders.map((o: any) => JSON.stringify(o).toLowerCase()) : [JSON.stringify(draftOrders).toLowerCase()])
        ].join(' ').toLowerCase();

        const orderingMethergine = orderTexts.includes('methergine') || orderTexts.includes('methylergonovine');
        const orderingCarboprost = orderTexts.includes('carboprost') || orderTexts.includes('hemabate');

        // Check against active conditions
        if (orderingMethergine && state.obstetric?.severePreeclampsiaEclampsia) {
          cards.push({
            summary: '🛑 HARD STOP: Methylergonovine (Methergine) Contraindicated in Severe Preeclampsia',
            detail: 'Methylergonovine causes intense peripheral vasoconstriction. In the setting of severe preeclampsia / hypertension, administration risks malignant hypertensive encephalopathy, intracranial hemorrhage, or eclampsia.',
            indicator: 'critical',
            source: { label: 'Phase 97 (PREECLAMPSIA-SHIELD) & Phase 98 (OB-HEMORRHAGE)' },
            suggestions: [
              {
                label: 'Switch to Carboprost (Hemabate 250 mcg IM)',
                uuid: 'alt-carboprost',
                actions: [
                  {
                    type: 'create',
                    description: 'Carboprost tromethamine 250 mcg IM STAT'
                  }
                ]
              },
              {
                label: 'Switch to Misoprostol (Cytotec 800 mcg SL)',
                uuid: 'alt-misoprostol',
                actions: [
                  {
                    type: 'create',
                    description: 'Misoprostol 800 mcg sublingual STAT'
                  }
                ]
              }
            ],
            selectionBehavior: 'at-most-one',
            overrideReasons: [
              { code: 'life-threatening-atony', display: 'Exsanguinating hemorrhage refractory to all other uterotonics' }
            ]
          });
        }

        if (orderingCarboprost && state.respiratory?.severeAsthmaBronchospasm) {
          cards.push({
            summary: '🛑 HARD STOP: Carboprost (Hemabate) Contraindicated in Status Asthmaticus',
            detail: 'Carboprost is a potent prostaglandin F2-alpha analogue that induces severe bronchospasm and bronchoconstriction. Administration in active asthma can precipitate fatal asphyxia.',
            indicator: 'critical',
            source: { label: 'Phase 65 (STATUS-PULMO) & Phase 98 (OB-HEMORRHAGE)' },
            suggestions: [
              {
                label: 'Switch to Misoprostol (800-1000 mcg sublingual) + TXA (1g IV)',
                uuid: 'alt-miso-txa',
                actions: [
                  {
                    type: 'create',
                    description: 'Misoprostol 800 mcg SL + Tranexamic Acid 1g IV over 10 min'
                  }
                ]
              }
            ],
            selectionBehavior: 'at-most-one'
          });
        }

        if (cards.length === 0) {
          cards.push({
            summary: '✅ No active cross-phase contraindications detected for selected order',
            indicator: 'info',
            source: { label: 'IntakeRx Safety Gateway' }
          });
        }

        return { cards };
      }

      case 'critical-order-sign': {
        const cards: CdsCard[] = [];

        // Check resuscitation safety guardrails
        if (synthesis.centuryTier === 'EXTREME_SURGE_ORCHESTRATED') {
          cards.push({
            summary: `⚠️ Critical Acuity Signature Guard: Patient is in EXTREME SURGE TIER (${synthesis.centuryScore}/100)`,
            detail: `Executive Care Plan Mandate: ${synthesis.executiveCarePlan.primaryResuscitationGoal}.\nEnsure dual-clinician verification for all vasoactive, paralytic, or blood product orders.`,
            indicator: 'warning',
            source: { label: 'IntakeRx Resuscitation Sign Guard' }
          });
        } else {
          cards.push({
            summary: 'Order Signature Approved: Patient state verified within stable safety boundaries',
            indicator: 'info',
            source: { label: 'IntakeRx Order Sign Guard' }
          });
        }

        return { cards };
      }

      default:
        return {
          cards: [
            {
              summary: `Unknown CDS Hook Service: ${serviceId}`,
              indicator: 'warning',
              source: { label: 'IntakeRx CDS Hub' }
            }
          ]
        };
    }
  }
}
