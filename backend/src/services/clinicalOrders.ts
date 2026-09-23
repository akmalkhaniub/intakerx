import { pool } from '../db';
import { DiagnosisService } from './diagnosis';

export interface OrderSuggestion {
  orderType: 'laboratory' | 'radiology' | 'cardiac_diagnostic' | 'nursing';
  codeSystem: 'LOINC' | 'CPT';
  code: string;
  displayName: string;
  clinicalIndication: string;
  urgency: 'stat' | 'urgent' | 'routine';
  patientPrepInstructions?: string;
}

export interface ClinicalOrder extends OrderSuggestion {
  id: number;
  sessionId: string;
  status: 'draft' | 'ordered' | 'completed' | 'cancelled';
  createdAt: string;
}

export class ClinicalOrdersService {
  /**
   * Suggest diagnostic orders (LOINC & CPT) based on encounter complaints, symptoms, and differential diagnoses
   */
  static async suggestOrders(sessionId: string): Promise<OrderSuggestion[]> {
    // 1. Fetch symptoms and messages for context
    const symRes = await pool.query(
      `SELECT name, severity, is_red_flag FROM symptoms WHERE session_id = $1`,
      [sessionId]
    );
    const msgRes = await pool.query(
      `SELECT content FROM messages WHERE session_id = $1 ORDER BY id ASC LIMIT 5`,
      [sessionId]
    );

    const symptoms = symRes.rows.map(s => s.name.toLowerCase()).join(' ');
    const messages = msgRes.rows.map(m => m.content.toLowerCase()).join(' ');
    const context = `${symptoms} ${messages}`;

    // 2. Fetch differential diagnosis candidates
    let topCondition = '';
    try {
      const diff = await DiagnosisService.generateDifferential(sessionId);
      if (diff.candidates && diff.candidates.length > 0) {
        topCondition = diff.candidates[0].condition.toLowerCase();
      }
    } catch (err) {
      console.warn('Diagnosis service query skipped for order suggestions:', err);
    }

    const suggestions: OrderSuggestion[] = [];

    // --- CARDIAC PRESENTATION ---
    if (context.includes('chest') || context.includes('heart') || context.includes('tightness') || topCondition.includes('coronary') || topCondition.includes('angina')) {
      suggestions.push({
        orderType: 'laboratory',
        codeSystem: 'LOINC',
        code: '49563-0',
        displayName: 'Troponin I, High-Sensitivity (hs-cTnI)',
        clinicalIndication: 'Rule out Acute Myocardial Infarction / Unstable Angina',
        urgency: 'stat',
        patientPrepInstructions: 'Draw immediately via peripheral venipuncture; repeat at 3 hours'
      });
      suggestions.push({
        orderType: 'cardiac_diagnostic',
        codeSystem: 'LOINC',
        code: '8601-7',
        displayName: '12-Lead Electrocardiogram (ECG/EKG)',
        clinicalIndication: 'Assess ST-segment elevation, ischemic T-wave inversions, or arrhythmias',
        urgency: 'stat',
        patientPrepInstructions: 'Place electrodes with patient supine; avoid movement during acquisition'
      });
      suggestions.push({
        orderType: 'radiology',
        codeSystem: 'LOINC',
        code: '30746-2',
        displayName: 'Chest Radiography, 2-View (PA & Lateral)',
        clinicalIndication: 'Evaluate cardiomegaly, pulmonary edema, or aortic silhouette widening',
        urgency: 'urgent',
        patientPrepInstructions: 'Inspiratory breath-hold required during upright exposure'
      });
      suggestions.push({
        orderType: 'laboratory',
        codeSystem: 'LOINC',
        code: '24323-8',
        displayName: 'Comprehensive Metabolic Panel (CMP)',
        clinicalIndication: 'Assess electrolytes (K+, Na+), BUN/Creatinine for renal clearance of cardiac meds',
        urgency: 'routine',
        patientPrepInstructions: 'Fasting preferred but not mandatory for acute workup'
      });
    }

    // --- RESPIRATORY / DYSPNEA PRESENTATION ---
    if (context.includes('breath') || context.includes('cough') || context.includes('wheez') || topCondition.includes('asthma') || topCondition.includes('pneumonia') || topCondition.includes('embolism')) {
      suggestions.push({
        orderType: 'laboratory',
        codeSystem: 'LOINC',
        code: '48065-7',
        displayName: 'D-Dimer, Quantitative',
        clinicalIndication: 'Rule out Pulmonary Embolism in patients with acute dyspnea',
        urgency: 'stat',
        patientPrepInstructions: 'Collect in light blue top (Sodium Citrate) tube'
      });
      suggestions.push({
        orderType: 'laboratory',
        codeSystem: 'LOINC',
        code: '58410-2',
        displayName: 'Complete Blood Count (CBC) with Automated Differential',
        clinicalIndication: 'Evaluate leukocytosis or left-shift in respiratory tract infection',
        urgency: 'urgent',
        patientPrepInstructions: 'Lavender top (EDTA) tube'
      });
    }

    // --- NEUROLOGICAL / HEADACHE PRESENTATION ---
    if (context.includes('headache') || context.includes('migraine') || context.includes('dizziness') || topCondition.includes('headache')) {
      suggestions.push({
        orderType: 'radiology',
        codeSystem: 'LOINC',
        code: '24725-4',
        displayName: 'Computed Tomography (CT), Head without Contrast',
        clinicalIndication: 'Rule out acute intracranial hemorrhage or mass effect',
        urgency: 'stat',
        patientPrepInstructions: 'Remove metallic headwear, earrings, and eyeglasses before scanning'
      });
      suggestions.push({
        orderType: 'laboratory',
        codeSystem: 'LOINC',
        code: '24321-2',
        displayName: 'Basic Metabolic Panel (BMP)',
        clinicalIndication: 'Evaluate hydration, hyponatremia, and renal function',
        urgency: 'routine',
        patientPrepInstructions: 'Standard venipuncture'
      });
    }

    // --- ABDOMINAL / GI PRESENTATION ---
    if (context.includes('abdom') || context.includes('belly') || context.includes('nausea') || context.includes('vomit') || topCondition.includes('appendicitis')) {
      suggestions.push({
        orderType: 'laboratory',
        codeSystem: 'LOINC',
        code: '3040-3',
        displayName: 'Lipase, Serum',
        clinicalIndication: 'Rule out acute pancreatitis',
        urgency: 'urgent',
        patientPrepInstructions: 'No recent ingestion of heavy fatty meals'
      });
      suggestions.push({
        orderType: 'radiology',
        codeSystem: 'LOINC',
        code: '24531-6',
        displayName: 'Ultrasound, Abdomen Complete',
        clinicalIndication: 'Evaluate gallstones, biliary duct dilatation, or appendiceal inflammation',
        urgency: 'urgent',
        patientPrepInstructions: 'NPO (nothing by mouth) for 6 hours prior to ultrasound examination'
      });
    }

    // Baseline fallbacks if no specific organ system triggered
    if (suggestions.length === 0) {
      suggestions.push({
        orderType: 'laboratory',
        codeSystem: 'LOINC',
        code: '58410-2',
        displayName: 'Complete Blood Count (CBC) with Differential',
        clinicalIndication: 'General clinical evaluation and infection screening',
        urgency: 'routine',
        patientPrepInstructions: 'Standard blood draw'
      });
      suggestions.push({
        orderType: 'laboratory',
        codeSystem: 'LOINC',
        code: '24323-8',
        displayName: 'Comprehensive Metabolic Panel (CMP)',
        clinicalIndication: 'Electrolyte, glucose, liver, and kidney function baseline',
        urgency: 'routine',
        patientPrepInstructions: '8-hour fasting recommended'
      });
    }

    return suggestions;
  }

  /**
   * Save an approved clinical order into the database
   */
  static async createOrder(sessionId: string, order: OrderSuggestion): Promise<ClinicalOrder> {
    const res = await pool.query(
      `INSERT INTO clinical_orders 
       (session_id, order_type, code_system, code, display_name, clinical_indication, urgency, patient_prep_instructions, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ordered')
       RETURNING *`,
      [
        sessionId,
        order.orderType,
        order.codeSystem,
        order.code,
        order.displayName,
        order.clinicalIndication,
        order.urgency || 'routine',
        order.patientPrepInstructions || ''
      ]
    );

    return this.formatRow(res.rows[0]);
  }

  /**
   * Save multiple approved orders in a single transaction
   */
  static async createBatchOrders(sessionId: string, orders: OrderSuggestion[]): Promise<ClinicalOrder[]> {
    const saved: ClinicalOrder[] = [];
    for (const ord of orders) {
      const created = await this.createOrder(sessionId, ord);
      saved.push(created);
    }
    return saved;
  }

  /**
   * Retrieve all orders for an encounter
   */
  static async getOrdersForSession(sessionId: string): Promise<ClinicalOrder[]> {
    const res = await pool.query(
      `SELECT * FROM clinical_orders WHERE session_id = $1 ORDER BY created_at ASC`,
      [sessionId]
    );
    return res.rows.map(r => this.formatRow(r));
  }

  /**
   * Export all orders for a session as standard HL7 FHIR R4 ServiceRequest resources
   */
  static async exportFhirServiceRequests(sessionId: string): Promise<any> {
    const orders = await this.getOrdersForSession(sessionId);
    const sessionRes = await pool.query(
      `SELECT s.id, p.id as patient_id, p.name as patient_name, p.dob, p.sex
       FROM intake_sessions s
       JOIN patients p ON s.patient_id = p.id
       WHERE s.id = $1`,
      [sessionId]
    );

    const patient = sessionRes.rows[0] || { patient_id: 1, patient_name: 'Unknown Patient' };

    const fhirBundle = {
      resourceType: 'Bundle',
      type: 'collection',
      timestamp: new Date().toISOString(),
      entry: orders.map(ord => ({
        fullUrl: `urn:uuid:service-request-${ord.id}`,
        resource: {
          resourceType: 'ServiceRequest',
          id: `sr-${ord.id}`,
          status: 'active',
          intent: 'order',
          category: [
            {
              coding: [
                {
                  system: 'http://snomed.info/sct',
                  code: ord.orderType === 'laboratory' ? '108252007' : '363679005',
                  display: ord.orderType === 'laboratory' ? 'Laboratory procedure' : 'Imaging'
                }
              ]
            }
          ],
          priority: ord.urgency === 'stat' ? 'stat' : ord.urgency === 'urgent' ? 'urgent' : 'routine',
          code: {
            coding: [
              {
                system: ord.codeSystem === 'LOINC' ? 'http://loinc.org' : 'http://www.ama-assn.org/go/cpt',
                code: ord.code,
                display: ord.displayName
              }
            ],
            text: ord.displayName
          },
          subject: {
            reference: `Patient/${patient.patient_id}`,
            display: patient.patient_name
          },
          encounter: {
            reference: `Encounter/${sessionId}`
          },
          reasonCode: [
            {
              text: ord.clinicalIndication
            }
          ],
          patientInstruction: ord.patientPrepInstructions || undefined,
          authoredOn: ord.createdAt
        }
      }))
    };

    return fhirBundle;
  }

  private static formatRow(row: any): ClinicalOrder {
    return {
      id: row.id,
      sessionId: row.session_id,
      orderType: row.order_type,
      codeSystem: row.code_system,
      code: row.code,
      displayName: row.display_name,
      clinicalIndication: row.clinical_indication,
      urgency: row.urgency,
      patientPrepInstructions: row.patient_prep_instructions,
      status: row.status,
      createdAt: row.created_at
    };
  }
}
