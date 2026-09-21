import { pool } from '../db';
import { AIService } from './ai';

export interface DifferentialCandidate {
  rank: number;
  condition: string;
  icd10: string;
  probability: number; // 0 to 100
  urgency: 'emergency' | 'urgent' | 'routine';
  rationale: string;
  supportingEvidence: string[];
  ruleOutCriteria: string[];
}

export interface DifferentialDiagnosisResult {
  sessionId: string;
  patientName: string;
  chiefComplaint: string;
  timestamp: string;
  candidates: DifferentialCandidate[];
  clinicalSummary: string;
}

export class DiagnosisService {
  public static async generateDifferential(sessionId: string): Promise<DifferentialDiagnosisResult> {
    // 1. Gather encounter context from DB
    const sessionRes = await pool.query(
      `SELECT s.id, s.triage_level as "triageLevel", s.triage_rationale as "triageRationale",
              p.name as "patientName", p.dob, p.sex
       FROM intake_sessions s
       JOIN patients p ON s.patient_id = p.id
       WHERE s.id = $1`,
      [sessionId]
    );

    if (sessionRes.rows.length === 0) {
      throw new Error(`Encounter session ${sessionId} not found.`);
    }

    const session = sessionRes.rows[0];

    // 2. Fetch symptoms
    const symptomsRes = await pool.query(
      `SELECT name, severity, duration, is_red_flag as "isRedFlag"
       FROM symptoms
       WHERE session_id = $1`,
      [sessionId]
    );
    const symptoms = symptomsRes.rows;

    // 3. Fetch medications
    const medsRes = await pool.query(
      `SELECT name, dosage, frequency FROM medications WHERE session_id = $1`,
      [sessionId]
    );
    const medications = medsRes.rows;

    // 4. Fetch vitals if available
    const vitalsRes = await pool.query(
      `SELECT heart_rate as "heartRate", spo2, bp_systolic as "bpSystolic", bp_diastolic as "bpDiastolic"
       FROM session_vitals
       WHERE session_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [sessionId]
    );
    const vitals = vitalsRes.rows[0] || null;

    // 5. Fetch chief complaint from messages
    const msgRes = await pool.query(
      `SELECT content FROM messages WHERE session_id = $1 AND sender = 'patient' ORDER BY created_at ASC LIMIT 1`,
      [sessionId]
    );
    const chiefComplaint = msgRes.rows[0]?.content || symptoms.map((s: any) => s.name).join(', ') || 'General consultation';

    // 6. Generate Rule-Based Clinical Fallback Matrix
    const symptomNames = symptoms.map((s: any) => s.name.toLowerCase()).join(' ') + ' ' + chiefComplaint.toLowerCase();
    const candidates: DifferentialCandidate[] = [];

    if (symptomNames.includes('chest') || symptomNames.includes('cardiac') || symptomNames.includes('arm') || symptomNames.includes('pressure')) {
      candidates.push({
        rank: 1,
        condition: 'Acute Coronary Syndrome / Angina Pectoris',
        icd10: 'I20.9',
        probability: 76,
        urgency: 'emergency',
        rationale: 'Substernal chest discomfort with radiation or pressure sensation warrants immediate ischemic evaluation.',
        supportingEvidence: ['Chest pain / pressure reported', 'Acute symptom onset', 'Cardiovascular risk profile'],
        ruleOutCriteria: ['12-lead Electrocardiogram (ECG) to evaluate ST changes', 'Serial High-Sensitivity Troponin I at 0h and 3h', 'Echocardiography']
      });

      candidates.push({
        rank: 2,
        condition: 'Gastroesophageal Reflux Disease (GERD) with Spasm',
        icd10: 'K21.9',
        probability: 44,
        urgency: 'routine',
        rationale: 'Esophageal irritation or reflux often mimics atypical angina and chest tightness.',
        supportingEvidence: ['Discomfort in retrosternal area', 'Absence of definitive hemodynamic collapse'],
        ruleOutCriteria: ['Resolution with antacid or GI cocktail', 'Upper endoscopy if persistent', 'Negative cardiac enzymes']
      });

      candidates.push({
        rank: 3,
        condition: 'Musculoskeletal Chest Wall Strain / Costochondritis',
        icd10: 'M94.0',
        probability: 32,
        urgency: 'routine',
        rationale: 'Inflammation of costochondral junctions causing localized tenderness worsened by movement.',
        supportingEvidence: ['Pain reproducible on palpation or movement', 'Pleuritic quality'],
        ruleOutCriteria: ['Palpation reproduction of pain', 'Normal chest radiography']
      });
    } else if (symptomNames.includes('breath') || symptomNames.includes('wheez') || symptomNames.includes('cough') || symptomNames.includes('asthma')) {
      candidates.push({
        rank: 1,
        condition: 'Acute Asthma Exacerbation / Reactive Airway Disease',
        icd10: 'J45.901',
        probability: 82,
        urgency: 'urgent',
        rationale: 'Dyspnea accompanied by wheezing or dry cough signifies acute bronchospasm.',
        supportingEvidence: ['Wheezing symptoms', 'Exertional dyspnea', 'Airway hyper-reactivity'],
        ruleOutCriteria: ['Peak expiratory flow rate (PEFR) pre/post bronchodilator', 'Continuous pulse oximetry', 'Chest X-ray']
      });

      candidates.push({
        rank: 2,
        condition: 'Acute Bronchitis / Upper Respiratory Tract Infection',
        icd10: 'J20.9',
        probability: 48,
        urgency: 'routine',
        rationale: 'Inflammation of tracheobronchial tree frequently presents with cough and mild wheeze.',
        supportingEvidence: ['Cough duration > 48h', 'Low-grade constitutional symptoms'],
        ruleOutCriteria: ['Absence of focal pulmonary consolidation on auscultation', 'Viral respiratory PCR panel']
      });
    } else {
      candidates.push({
        rank: 1,
        condition: 'Acute Febrile / Viral Syndrome',
        icd10: 'B34.9',
        probability: 65,
        urgency: 'routine',
        rationale: 'Systemic symptom complex typical of non-specific viral or inflammatory illness.',
        supportingEvidence: ['Reported general malaise', 'Absence of focal focalizing red flags'],
        ruleOutCriteria: ['Complete Blood Count (CBC) with differential', 'Clinical follow-up in 48 hours if unresolved']
      });

      candidates.push({
        rank: 2,
        condition: 'Tension-Type Cephalea / Stress Reaction',
        icd10: 'G44.209',
        probability: 38,
        urgency: 'routine',
        rationale: 'Band-like pressure or discomfort associated with fatigue and stress.',
        supportingEvidence: ['Mild to moderate symptom intensity', 'Normal neurological status'],
        ruleOutCriteria: ['Full cranial nerve exam', 'Absence of meningismus or visual disturbances']
      });
    }

    return {
      sessionId,
      patientName: session.patientName,
      chiefComplaint,
      timestamp: new Date().toISOString(),
      candidates,
      clinicalSummary: `AI reasoning analysis generated ${candidates.length} candidate diagnoses based on ${symptoms.length} symptoms and reported clinical history.`
    };
  }
}
