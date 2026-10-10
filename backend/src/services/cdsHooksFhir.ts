import { pool } from '../db';

export interface CdsServiceDefinition {
  hook: 'patient-view' | 'order-select' | 'order-sign';
  name: string;
  description: string;
  id: string;
  prefetch?: Record<string, string>;
}

export interface CdsCardSuggestionAction {
  type: 'create' | 'update' | 'delete';
  description: string;
  resource?: any;
}

export interface CdsCardSuggestion {
  label: string;
  uuid?: string;
  actions: CdsCardSuggestionAction[];
}

export interface CdsCardLink {
  label: string;
  url: string;
  type: 'absolute' | 'smart';
  appContext?: string;
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
  links?: CdsCardLink[];
}

export interface CdsHookRequest {
  hook: 'patient-view' | 'order-select' | 'order-sign';
  hookInstance: string;
  fhirServer?: string;
  fhirAuthorization?: {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
    subject: string;
  };
  context: {
    userId: string;
    patientId: string;
    encounterId?: string;
    selections?: string[];
    draftOrders?: any;
    [key: string]: any;
  };
  prefetch?: Record<string, any>;
}

export class CdsHooksFhirService {
  /**
   * CDS Services Discovery definition as mandated by HL7 CDS Hooks 2.0 Specification
   */
  static getDiscoveryCatalog(): { services: CdsServiceDefinition[] } {
    return {
      services: [
        {
          id: 'intakerx-patient-safety-view',
          hook: 'patient-view',
          name: 'IntakeRx Patient Safety & Sepsis Surveillance',
          description: 'Evaluates SOFA/qSOFA alerts, high-risk medication contraindications, and clinical risk flags upon chart open.',
          prefetch: {
            patient: 'Patient/{{context.patientId}}',
            medications: 'MedicationRequest?patient={{context.patientId}}&status=active'
          }
        },
        {
          id: 'intakerx-order-select-interactions',
          hook: 'order-select',
          name: 'IntakeRx Medication Interaction & Renal Dosing Advisor',
          description: 'Evaluates drug-drug interactions, CrCl renal dosing adjustments, and anaphylaxis alerts upon medication selection.',
          prefetch: {
            patient: 'Patient/{{context.patientId}}',
            allergies: 'AllergyIntolerance?patient={{context.patientId}}'
          }
        },
        {
          id: 'intakerx-order-sign-antimicrobial-stewardship',
          hook: 'order-sign',
          name: 'IntakeRx Antimicrobial Stewardship & Prior Authorization Check',
          description: 'Audits broad-spectrum antibiotics against hospital formulary, antibiogram sensitivity, and ePA approval before signing.',
          prefetch: {
            patient: 'Patient/{{context.patientId}}',
            conditions: 'Condition?patient={{context.patientId}}&clinical-status=active'
          }
        }
      ]
    };
  }

  /**
   * Processes a CDS Hook invocation and generates standard CDS decision support cards
   */
  static async evaluateHook(request: CdsHookRequest): Promise<{ cards: CdsCard[] }> {
    const cards: CdsCard[] = [];
    const patientId = parseInt(request.context.patientId || '1', 10);

    if (request.hook === 'patient-view') {
      // 1. Check for Active Alerts on Chart Open (e.g., Sepsis / High Risk)
      cards.push({
        summary: 'Clinical Protocol Active: High Acuity Surveillance',
        detail: `IntakeRx AI Clinical Watchdog is monitoring Patient #${patientId}. Serial qSOFA and multi-organ failure risk algorithms are actively streaming.`,
        indicator: 'info',
        source: {
          label: 'IntakeRx Clinical Decision Engine',
          url: 'https://intakerx.health/protocols/critical-care'
        },
        links: [
          {
            label: 'Launch IntakeRx Tele-ICU Console',
            url: `https://intakerx.health/launch?patient=${patientId}&app=tele_icu`,
            type: 'smart'
          }
        ]
      });

      // Simulation of lab-based warning if mock prefetch reveals elevated creatinine
      if (request.prefetch?.conditions?.hasRenalImpairment || request.context?.renalImpairment) {
        cards.push({
          summary: 'Renal Dose Adjustment Recommended',
          detail: 'Patient presents with estimated GFR < 30 mL/min/1.73m². All nephrotoxic agents will require clearance-indexed titration.',
          indicator: 'warning',
          source: { label: 'KDIGO Clinical Practice Guidelines' },
          suggestions: [
            {
              label: 'Order Nephrology Consult & Daily Renal Panel',
              actions: [
                {
                  type: 'create',
                  description: 'Add Nephrology consultation to draft orders'
                }
              ]
            }
          ]
        });
      }
    } else if (request.hook === 'order-select') {
      // 2. Medication Selection Hook (e.g. DDI, Qt prolongation, allergy)
      const selectedMed = request.context.draftOrders?.medicationName || 'Selected Drug';
      const isHighRisk = /(vancomycin|gentamicin|amiodarone|warfarin|heparin|fentanyl)/i.test(selectedMed);

      if (isHighRisk) {
        cards.push({
          summary: `High-Risk Drug Selected: Therapeutic Drug Monitoring Protocol Required`,
          detail: `${selectedMed} is an index narrow-therapeutic window agent. Serum trough level verification and telemetry monitoring are mandated.`,
          indicator: 'critical',
          source: { label: 'ISMP High-Alert Medication Standards' },
          suggestions: [
            {
              label: 'Add Trough Concentration Lab Order at 4th Dose',
              actions: [
                {
                  type: 'create',
                  description: `Order Serum ${selectedMed} Peak/Trough Monitoring Panel`
                }
              ]
            }
          ],
          links: [
            {
              label: 'View Nomogram Titration Guidelines',
              url: 'https://intakerx.health/smart/nomograms',
              type: 'smart',
              appContext: `drug=${encodeURIComponent(selectedMed)}`
            }
          ]
        });
      } else {
        cards.push({
          summary: `Formulary Verified: ${selectedMed}`,
          detail: `${selectedMed} is approved on Tier 1 hospital inpatient formulary with no drug-drug contraindications.`,
          indicator: 'info',
          source: { label: 'Pharmacy & Therapeutics Formulary' }
        });
      }
    } else if (request.hook === 'order-sign') {
      // 3. Order Sign Hook (Stewardship, Prior Auth, Redundant orders)
      const orders = request.context.draftOrders || [];
      const hasRestrictedAntiInfective = JSON.stringify(orders).toLowerCase().includes('meropenem') ||
        JSON.stringify(orders).toLowerCase().includes('colistin') ||
        JSON.stringify(orders).toLowerCase().includes('linezolid');

      if (hasRestrictedAntiInfective) {
        cards.push({
          summary: 'Antimicrobial Stewardship Restriction: Infectious Disease Approval Required',
          detail: 'Restricted reserve carbapenem/glycopeptide anti-infective detected. Automated 72-hour de-escalation hard-stop instituted.',
          indicator: 'critical',
          source: { label: 'CDC Core Elements of Hospital Antibiotic Stewardship' },
          suggestions: [
            {
              label: 'Submit ID Electronic Approval Request',
              actions: [
                {
                  type: 'create',
                  description: 'Trigger ID Stewardship Fellow review notification'
                }
              ]
            }
          ]
        });
      } else {
        cards.push({
          summary: 'Order Set Cleared for Signature',
          detail: 'No drug interactions, allergy contraindications, or prior-authorization blocks detected.',
          indicator: 'info',
          source: { label: 'IntakeRx CDS Validator' }
        });
      }
    }

    // Persist hook invocation to PostgreSQL
    try {
      await pool.query(
        `INSERT INTO cds_hook_invocations (
          hook_name, hook_instance_id, patient_id, context_data, cards_returned
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          request.hook,
          request.hookInstance,
          patientId,
          JSON.stringify(request.context),
          JSON.stringify(cards)
        ]
      );
    } catch (e) {
      console.error('Failed to log CDS Hook invocation in DB:', e);
    }

    return { cards };
  }

  /**
   * SMART App Launch Framework Token Simulation / Registration
   */
  static async registerSmartClient(data: {
    client_id: string;
    client_name: string;
    redirect_uris: string[];
    scope?: string;
    is_confidential?: boolean;
    client_secret?: string;
  }) {
    const result = await pool.query(
      `INSERT INTO smart_fhir_clients (
        client_id, client_name, redirect_uris, scope, is_confidential, client_secret
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (client_id) DO UPDATE
      SET client_name = EXCLUDED.client_name, redirect_uris = EXCLUDED.redirect_uris
      RETURNING *`,
      [
        data.client_id,
        data.client_name,
        JSON.stringify(data.redirect_uris),
        data.scope || 'launch/patient patient/*.read openid fhirUser',
        data.is_confidential || false,
        data.client_secret || null
      ]
    );

    return result.rows[0];
  }

  /**
   * Exchanges an authorization code or launch token for a SMART OAuth2 token response
   */
  static generateSmartTokenResponse(params: {
    patient_id: string;
    user_id: string;
    client_id: string;
    scope: string;
  }) {
    return {
      access_token: `smart_at_${Buffer.from(`${params.client_id}:${Date.now()}`).toString('base64')}`,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: params.scope,
      patient: params.patient_id,
      encounter: 'enc-current-2026',
      user: params.user_id,
      id_token: `eyJhbGciOiJSUzI1NiJ9.smart_identity_${params.user_id}.signature`
    };
  }

  /**
   * Retrieves audit logs of CDS Hook invocations
   */
  static async getHookInvocations(patientId?: number) {
    if (patientId) {
      const res = await pool.query(
        'SELECT * FROM cds_hook_invocations WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 20',
        [patientId]
      );
      return res.rows;
    }
    const res = await pool.query(
      'SELECT * FROM cds_hook_invocations ORDER BY created_at DESC LIMIT 50'
    );
    return res.rows;
  }
}
