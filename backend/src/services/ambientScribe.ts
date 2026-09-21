import { v4 as uuidv4 } from 'uuid';

export interface ClinicalEntity {
  type: 'symptom' | 'medication' | 'vital' | 'exam' | 'plan';
  text: string;
}

export interface DiarizedTurn {
  id: string;
  speaker: 'clinician' | 'patient';
  text: string;
  timestamp: string;
  entities: ClinicalEntity[];
  sentiment?: 'calm' | 'anxious' | 'distressed' | 'reassured';
}

export interface SynthesizedSOAP {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  confidenceScore: number;
  highlightedKeywords: string[];
}

export interface AmbientTranscript {
  sessionId: string;
  status: 'idle' | 'recording' | 'completed';
  startTime: string;
  endTime?: string;
  turns: DiarizedTurn[];
  synthesizedSoap?: SynthesizedSOAP;
}

// In-memory active ambient scribe transcripts per session
const transcriptsStore = new Map<string, AmbientTranscript>();

export class AmbientScribeService {
  /**
   * Get or initialize transcript for an encounter session
   */
  static getTranscript(sessionId: string): AmbientTranscript {
    if (!transcriptsStore.has(sessionId)) {
      transcriptsStore.set(sessionId, {
        sessionId,
        status: 'idle',
        startTime: new Date().toISOString(),
        turns: []
      });
    }
    return transcriptsStore.get(sessionId)!;
  }

  /**
   * Add a diarized speaker turn
   */
  static addTurn(
    sessionId: string,
    speaker: 'clinician' | 'patient',
    text: string,
    sentiment?: 'calm' | 'anxious' | 'distressed' | 'reassured'
  ): DiarizedTurn {
    const transcript = this.getTranscript(sessionId);
    transcript.status = 'recording';

    const entities = this.extractEntities(text);
    const turn: DiarizedTurn = {
      id: uuidv4(),
      speaker,
      text,
      timestamp: new Date().toISOString(),
      entities,
      sentiment: sentiment || this.inferSentiment(text, speaker)
    };

    transcript.turns.push(turn);
    return turn;
  }

  /**
   * Extract clinical entities with pattern heuristics
   */
  static extractEntities(text: string): ClinicalEntity[] {
    const entities: ClinicalEntity[] = [];
    const lower = text.toLowerCase();

    // Symptoms
    const symptomPatterns = [
      'chest pain', 'chest pressure', 'shortness of breath', 'dyspnea', 'throbbing headache',
      'migraine', 'dizziness', 'lightheaded', 'palpitations', 'nausea', 'vomiting',
      'fatigue', 'radiating pain', 'cough', 'wheezing', 'fever', 'tightness'
    ];
    for (const pat of symptomPatterns) {
      if (lower.includes(pat)) {
        entities.push({ type: 'symptom', text: pat });
      }
    }

    // Medications
    const medPatterns = [
      'aspirin', 'nitroglycerin', 'lisinopril', 'metoprolol', 'atorvastatin',
      'sumatriptan', 'ibuprofen', 'acetaminophen', 'albuterol', 'amoxicillin',
      'ozempic', 'metformin', 'hydrochlorothiazide'
    ];
    for (const pat of medPatterns) {
      if (lower.includes(pat)) {
        entities.push({ type: 'medication', text: pat });
      }
    }

    // Vitals / Exam
    const examPatterns = [
      'blood pressure', 'bp 1', 'pulse', 'heart rate', 'spo2', 'oxygen sat',
      'regular rhythm', 'lungs clear', 'pupils equal', 'no murmurs', 'tenderness'
    ];
    for (const pat of examPatterns) {
      if (lower.includes(pat)) {
        entities.push({ type: 'exam', text: pat });
      }
    }

    // Plan / Directives
    const planPatterns = [
      'order ekg', 'ecg', 'troponin', 'chest x-ray', 'ct scan', 'mri',
      'prescribe', 'follow-up', 'referral to cardiology', 'hydration', 'rest'
    ];
    for (const pat of planPatterns) {
      if (lower.includes(pat)) {
        entities.push({ type: 'plan', text: pat });
      }
    }

    return entities;
  }

  /**
   * Infer conversational tone / sentiment
   */
  private static inferSentiment(
    text: string,
    speaker: 'clinician' | 'patient'
  ): 'calm' | 'anxious' | 'distressed' | 'reassured' {
    const lower = text.toLowerCase();
    if (speaker === 'patient') {
      if (lower.includes('severe') || lower.includes('unbearable') || lower.includes('scared') || lower.includes('hurts so much')) {
        return 'distressed';
      }
      if (lower.includes('worried') || lower.includes('concerned') || lower.includes('anxious') || lower.includes('what if')) {
        return 'anxious';
      }
      if (lower.includes('better') || lower.includes('thank you') || lower.includes('glad')) {
        return 'reassured';
      }
    } else {
      if (lower.includes('don\'t worry') || lower.includes('we will take care') || lower.includes('completely treatable')) {
        return 'reassured';
      }
    }
    return 'calm';
  }

  /**
   * Synthesize diarized conversation into a structured clinical SOAP note
   */
  static synthesizeSOAP(sessionId: string): SynthesizedSOAP {
    const transcript = this.getTranscript(sessionId);
    const patientUtterances = transcript.turns.filter(t => t.speaker === 'patient').map(t => t.text);
    const clinicianUtterances = transcript.turns.filter(t => t.speaker === 'clinician').map(t => t.text);

    // Collect all detected entities
    const allEntities = transcript.turns.flatMap(t => t.entities);
    const symptoms = Array.from(new Set(allEntities.filter(e => e.type === 'symptom').map(e => e.text)));
    const meds = Array.from(new Set(allEntities.filter(e => e.type === 'medication').map(e => e.text)));
    const exams = Array.from(new Set(allEntities.filter(e => e.type === 'exam').map(e => e.text)));
    const plans = Array.from(new Set(allEntities.filter(e => e.type === 'plan').map(e => e.text)));

    // Synthesize Subjective
    const chiefComplaint = symptoms.length > 0 ? symptoms.slice(0, 2).join(' and ') : 'Medical consultation';
    const subjective = `CHIEF COMPLAINT: ${chiefComplaint}.\n\nHISTORY OF PRESENT ILLNESS:\nPatient presents for evaluation. Key statements captured via ambient dialogue:\n` +
      (patientUtterances.length > 0
        ? patientUtterances.map(u => `• "${u}"`).join('\n')
        : '• Patient attended consultation and reviewed current clinical status.') +
      (meds.length > 0 ? `\n\nREPORTED MEDICATIONS:\n${meds.map(m => `• ${m}`).join('\n')}` : '');

    // Synthesize Objective
    const objective = `CLINICAL EXAMINATION & OBSERVATIONS (AMBIENT RECORDING):\n` +
      (exams.length > 0
        ? exams.map(e => `• Observed/Discussed: ${e}`).join('\n')
        : '• General appearance: Awake, alert, conversant.\n• Vital signs and direct examination reviewed during encounter.') +
      `\n• Clinician direct remarks during physical assessment:\n` +
      (clinicianUtterances.slice(0, 3).map(c => `  - "${c}"`).join('\n') || '  - Exam consistent with patient dialogue.');

    // Synthesize Assessment
    const assessment = `CLINICAL IMPRESSION & ASSESSMENT:\n` +
      `1. Primary Presentation: Evaluation of ${chiefComplaint}.\n` +
      `2. Differential Considerations: Synthesized from patient discussion and clinical entities [${symptoms.join(', ') || 'unspecified'}].\n` +
      `3. Risk Stratification: Discussion reviewed with patient; standard clinical precautions initiated.`;

    // Synthesize Plan
    const plan = `MANAGEMENT PLAN & DIRECTIVES:\n` +
      (plans.length > 0
        ? plans.map(p => `• ${p.charAt(0).toUpperCase() + p.slice(1)}`).join('\n')
        : '• Continue current symptomatic management.\n• Return precautions given for acute symptom worsening.') +
      `\n• Follow-up as scheduled or PRN for red flag symptom development.`;

    const result: SynthesizedSOAP = {
      subjective,
      objective,
      assessment,
      plan,
      confidenceScore: Math.min(98, 75 + transcript.turns.length * 2),
      highlightedKeywords: Array.from(new Set([...symptoms, ...meds, ...exams, ...plans]))
    };

    transcript.synthesizedSoap = result;
    transcript.status = 'completed';
    transcript.endTime = new Date().toISOString();

    return result;
  }

  /**
   * Simulate realistic clinical dialogue scenarios (Cardiology, Migraine, or Respiratory)
   */
  static simulateDialogue(sessionId: string, scenario: 'cardiac' | 'migraine' | 'respiratory' = 'cardiac'): AmbientTranscript {
    const transcript = this.getTranscript(sessionId);
    transcript.turns = [];
    transcript.status = 'recording';
    transcript.startTime = new Date().toISOString();

    if (scenario === 'cardiac') {
      this.addTurn(sessionId, 'clinician', 'Good morning Mr. Davis. Can you tell me what brought you into the clinic today?');
      this.addTurn(sessionId, 'patient', 'Doctor, about an hour ago I started feeling this heavy chest pressure and tightness right behind my breastbone, and it feels like it is radiating into my left shoulder.', 'distressed');
      this.addTurn(sessionId, 'clinician', 'I understand. Are you having any shortness of breath, lightheadedness, or nausea along with it?');
      this.addTurn(sessionId, 'patient', 'Yes, I am feeling quite short of breath and a little dizzy when I try to walk.', 'anxious');
      this.addTurn(sessionId, 'clinician', 'Have you taken any medications like aspirin or nitroglycerin recently?');
      this.addTurn(sessionId, 'patient', 'I take lisinopril and metoprolol daily for blood pressure, but I chewed one baby aspirin when this started.');
      this.addTurn(sessionId, 'clinician', 'Good instinct. Your blood pressure is elevated at 155/94, pulse is 98 regular rhythm, oxygen sat is 97%.');
      this.addTurn(sessionId, 'clinician', 'We are going to immediately order an stat EKG and blood work for troponin levels, and consult cardiology.');
      this.addTurn(sessionId, 'patient', 'Thank you doctor, I was really worried about having a heart attack.', 'reassured');
      this.addTurn(sessionId, 'clinician', 'You are in good hands. We will get the tests running right now.');
    } else if (scenario === 'migraine') {
      this.addTurn(sessionId, 'clinician', 'Hello Sarah, what symptoms have you been dealing with?');
      this.addTurn(sessionId, 'patient', 'I have had a severe throbbing headache on the right side of my head for two days, with nausea and extreme sensitivity to bright light.', 'distressed');
      this.addTurn(sessionId, 'clinician', 'Does it worsen with physical activity? Have you had migraines before?');
      this.addTurn(sessionId, 'patient', 'Yes, physical movement makes it pound worse. I tried ibuprofen with no relief.');
      this.addTurn(sessionId, 'clinician', 'Neurological exam shows pupils equal and reactive, neck supple, no focal deficits.');
      this.addTurn(sessionId, 'clinician', 'We will prescribe sumatriptan 50mg for acute migraine abortive therapy and recommend quiet dark room rest and hydration.');
      this.addTurn(sessionId, 'patient', 'That sounds wonderful, thank you so much.', 'reassured');
    } else {
      this.addTurn(sessionId, 'clinician', 'Hi Robert, tell me about how your breathing has been feeling.');
      this.addTurn(sessionId, 'patient', 'I have had a persistent wheezing cough and shortness of breath whenever I climb the stairs for the last 3 days.', 'anxious');
      this.addTurn(sessionId, 'clinician', 'Let me listen to your lungs. Auscultation shows diffuse expiratory wheezing bilaterally, oxygen sat 95%.');
      this.addTurn(sessionId, 'clinician', 'We will prescribe an albuterol inhaler for bronchospasm relief, order a chest x-ray, and schedule follow-up in one week.');
      this.addTurn(sessionId, 'patient', 'Understood, I will pick up the inhaler right away.', 'calm');
    }

    return transcript;
  }

  /**
   * Clear or reset transcript
   */
  static clearTranscript(sessionId: string): void {
    transcriptsStore.delete(sessionId);
  }
}
