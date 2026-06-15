export interface User {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  dob: string;
  sex: string;
  insuranceProvider?: string;
  insurancePolicy?: string;
  createdAt: string;
}

export type TriageLevel = 'routine' | 'urgent' | 'emergency';
export type SessionStatus = 'active' | 'completed' | 'escalated';
export type FlowStep = 'complaint' | 'history' | 'meds' | 'allergies' | 'insurance' | 'review';

export interface IntakeSession {
  id: string;
  patientId: number;
  status: SessionStatus;
  currentStep: FlowStep;
  triageLevel?: TriageLevel;
  triageRationale?: string;
  createdAt: string;
  updatedAt: string;
}

export type MessageSender = 'patient' | 'agent' | 'system';

export interface Message {
  id: number;
  sessionId: string;
  sender: MessageSender;
  content: string;
  rawContent?: string;
  wasFlagged: boolean;
  blockedByGuardrail: boolean;
  createdAt: string;
}

export interface Symptom {
  id: number;
  sessionId: string;
  name: string;
  severity: 'mild' | 'moderate' | 'severe';
  duration: string;
  isRedFlag: boolean;
  createdAt: string;
}

export interface Medication {
  id: number;
  sessionId: string;
  name: string;
  dosage?: string;
  frequency?: string;
  createdAt: string;
}

export interface SOAPSummary {
  chiefComplaint: string;
  historyOfPresentIllness: string;
  pastMedicalHistory?: string;
  medications: Array<{ name: string; dosage?: string; frequency?: string }>;
  allergies: string[];
  insurance: {
    provider?: string;
    policyNumber?: string;
  };
  triageLevel: TriageLevel;
  triageRationale: string;
  redFlagsIdentified: string[];
}

export interface SafetyEvent {
  id: number;
  sessionId?: string;
  eventType: 'prompt_injection' | 'medical_advice_attempt' | 'bypass_attempt';
  inputContent: string;
  responseBlocked: boolean;
  confidenceScore: number;
  createdAt: string;
}
