# 🏥 IntakeRx: Enterprise AI Voice & Chat Patient Intake, Triage & Pre-Screening Platform

<p align="center">
  <img src="https://img.shields.io/badge/React-18%20Vite-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React 18">
  <img src="https://img.shields.io/badge/Express-5.0%20TypeScript-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Express 5">
  <img src="https://img.shields.io/badge/PostgreSQL-18%20%2B%20pgvector-336791?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL pgvector">
  <img src="https://img.shields.io/badge/FastAPI-0.109%2B-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/Compliance-HIPAA%20%2B%20HL7%20FHIR%20R4-purple?style=for-the-badge" alt="HIPAA & FHIR">
  <img src="https://img.shields.io/badge/AI%20Safety-ShieldGuard%E2%84%A2%20Hardened-red?style=for-the-badge" alt="AI Safety">
  <img src="https://img.shields.io/badge/Tests-8%2F8%20E2E%20Stages%20Passing-success?style=for-the-badge" alt="Tests">
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License MIT">
</p>

> **IntakeRx** is a production-grade clinical AI platform built with safety hardening, prompt injection defense, and HIPAA compliance at its core. It automates patient history collection through real-time voice and streaming chat, performs Retrieval-Augmented Generation (RAG) over clinical triage protocols, screens for life-threatening red flags, detects drug-drug and allergen conflicts, and exports standard HL7 FHIR R4 bundles into electronic health record (EHR) systems.

---

## 📐 Enterprise Architecture

```mermaid
graph TD
    classDef client fill:#f3e8ff,stroke:#7c3aed,stroke-width:2px,color:#5b21b6;
    classDef api fill:#e0f2fe,stroke:#0284c7,stroke-width:2px,color:#0369a1;
    classDef safety fill:#fef2f2,stroke:#ef4444,stroke-width:2px,color:#991b1b;
    classDef ai fill:#fff7ed,stroke:#ea580c,stroke-width:2px,color:#9a3412;
    classDef storage fill:#dcfce7,stroke:#16a34a,stroke-width:2px,color:#166534;
    classDef interop fill:#f0fdf4,stroke:#059669,stroke-width:2px,color:#065f46;

    subgraph FrontendApp [Patient & Clinician Portal :3000]
        ConsentGate[Pre-Intake Clinical Consent Gate]:::client
        PatientChat[Streaming Chat & Native Web Speech Voice Mode]:::client
        ClinicianPortal[Clinician Review & Interactive SOAP Diff Editor]:::client
        AnalyticsDash[Intake Funnel & Triage Analytics Dashboard]:::client
        SecurityCenter[Security Threat Heat Map & Safety Deflection Log]:::client
        PushAlerts[Push Notification Bell & Web Audio Chimes]:::client
    end

    subgraph Gateway [Express 5 TypeScript API Gateway :5001]
        Auth[JWT RBAC Middleware: Patient / Clinician]:::api
        SSEServer[Server-Sent Events Real-Time Alert Stream]:::api
        
        subgraph SafetyShield [ShieldGuard™ Dual-Layer AI Defense]
            InputGuard[Input Guardrail: Heuristic Regex + Semantic AI Classifier]:::safety
            OutputGuard[Output Guardrail: Diagnostic Liability Redirection]:::safety
            RedFlagRouter[Emergency Red-Flag Auto-Escalation Engine]:::safety
            PHIScrubber[HIPAA PHI Redactor & Encryption Audit Logger]:::safety
        end

        CDSEngine[Clinical Decision Support: Drug-Drug & Allergen Engine]:::ai
        AIService[AI Engine: Groq LLaMA 3.3 70B / Gemini Embeddings]:::ai
        FHIRGenerator[HL7 FHIR R4 JSON & XML Bundle Serializer]:::interop
    end

    subgraph IngestionService [FastAPI Microservice :8002]
        ProtocolRAG[Protocol Chunker & pgvector Cosine Search]:::ai
        EHRAgent[Playwright Headless Browser Form Injector]:::interop
    end

    subgraph StorageLayer [Secure Database Layer]
        DB[(PostgreSQL 18 + pgvector HNSW Embeddings)]:::storage
    end

    ConsentGate -->|Terms Accepted| PatientChat
    PatientChat -->|1. Intake Stream| Auth
    Auth --> InputGuard
    InputGuard --> PHIScrubber
    PHIScrubber --> AIService
    AIService --> ProtocolRAG
    ProtocolRAG --> DB
    AIService --> OutputGuard
    OutputGuard --> RedFlagRouter
    RedFlagRouter -->|Alert Trigger| SSEServer
    SSEServer -->|Push Notification| PushAlerts
    RedFlagRouter --> ClinicianPortal
    ClinicianPortal --> CDSEngine
    CDSEngine --> DB
    ClinicianPortal --> FHIRGenerator
    ClinicianPortal -->|Approved SOAP Summary| EHRAgent
    ClinicianPortal --> AnalyticsDash
    ClinicianPortal --> SecurityCenter
```

---

## 🌟 Comprehensive Feature Matrix

| Phase | Capability | Description | Verification |
|---|---|---|---|
| **Phase 1** | **HIPAA PHI Redactor** | Scans and redacts names, SSNs, and sensitive demographics prior to LLM transmission; maintains HIPAA compliance logs. | `test_phi.ts` (100% Redaction) |
| **Phase 2** | **Live Vitals Simulator** | Streams simulated patient biometrics (Heart Rate, SpO2, Blood Pressure) with auditory alarms on critical thresholds. | `test_vitals.ts` (Passed) |
| **Phase 3** | **Longitudinal Severity Trends** | Visualizes historical symptom severity across sequential encounters using custom responsive SVG line graphs. | `test_history.ts` (Passed) |
| **Phase 4** | **Patient Discharge Generator** | Generates layperson-friendly, multilingual post-visit care plans with home care guidance and emergency warning signs. | `test_discharge.ts` (Passed) |
| **Phase 5** | **CDS Clinical Care Gaps** | Evaluates regimens against standard guidelines (Hypertension, Diabetes, Heart Failure) and surfaces omitted therapies. | `test_cds.ts` (Passed) |
| **Phase 6** | **AI Protocol Copilot** | Clinician slide-out drawer utilizing RAG vector search over clinical protocols for on-demand clinical guidelines. | `test_copilot.ts` (Passed) |
| **Phase 7** | **SOAP Print & Canvas Sign-off** | Stylus and touch-responsive digital signature canvas with print CSS formatting for paper and PDF medical charts. | `test_print.ts` (Passed) |
| **Phase 8** | **Interactive Drug Graph** | Circular SVG network graph mapping active medications and allergies with pulsating glows and contraindication tooltips. | `test_interactions.ts` (Passed) |
| **Phase 9** | **Vitals Telemetry Playback** | Time-scrubbing telemetry playback console with variable speeds (1x–10x), heart sparklines, and hypoxia alerts. | `test_telemetry.ts` (Passed) |
| **Phase 10** | **Security Threat Heat Map** | Observability dashboard tracking prompt injection vectors, block rates, threat levels, and classified safety logs. | `test_security.ts` (Passed) |
| **Phase 11** | **Session Analytics Dashboard** | Intake funnel visualization, triage distribution donut chart, 24-hour peak intake heatmap, and daily volume trends. | `GET /api/clinician/analytics` |
| **Phase 12** | **Real-Time Push Notifications** | SSE stream with Web Audio oscillator chimes, portal bell badge counter, and floating actionable toast popups. | `test_notifications.ts` (Passed) |
| **Phase 13** | **Patient Consent Gate** | Pre-intake compliance gate requiring explicit patient agreement to AI disclosures, HIPAA terms, and 911 disclaimers. | `test_consent.ts` (Passed) |
| **Phase 14** | **End-to-End Test Suite** | Unified 8-stage integration test exercising auth, consent, intake, guardrails, triage, CDS, FHIR, and teardown. | `npm run test:e2e` (All 8 Passed) |
| **Phase 15** | **Documentation & Setup Overhaul** | Comprehensive architectural specifications, deployment instructions, test documentation, and diagrams. | Verified & Deployed |
| **Phase 16** | **Interactive EHR Sandbox** | Epic, Cerner, and AthenaHealth sandbox gateway simulator, audit logs, and bidirectional FHIR webhook explorer. | `test_ehr_sandbox.ts` (Passed) |
| **Phase 17** | **Differential Diagnosis Matrix** | Bayesian clinical likelihood ranker with ICD-10 diagnostic mapping, rule-out workups, and 1-click SOAP insertion. | `test_differential.ts` (Passed) |
| **Phase 18** | **Anatomical Body Map & Pain Locator** | Interactive SVG anterior/posterior body diagram with 1-10 VAS sliders, quality selector, and radiation logging. | `test_body_map.ts` (Passed) |
| **Phase 19** | **Ambient Clinical AI Scribe** | Multi-speaker conversational diarization with real-time entity recognition and automated synthesis into SOAP notes. | `test_ambient_scribe.ts` (Passed) |
| **Phase 20** | **Follow-Up & Remote Monitoring** | Automated post-visit protocols (Day 1, 3, 7, 14), patient check-in surveys, and real-time deterioration alert escalation. | `test_followup.ts` (Passed) |

---

## 🛡️ AI Safety & Prompt Injection Hardening

IntakeRx implements a **multi-tiered defense in depth** architecture to safeguard clinical operations:

1. **Input Guardrail (`GuardrailsService.scanInputForInjection`)**:
   - **Regex Heuristics**: Blocks known instruction escapes (`ignore previous instructions`, `you are now a doctor`, `developer mode`, `system override`).
   - **Semantic AI Classifier**: Evaluates contextual intent with zero-temperature JSON classification to intercept novel jailbreaks before downstream processing.
2. **Output Guardrail (`GuardrailsService.scanOutputForMedicalAdvice`)**:
   - Actively intercepts unauthorized diagnostic assertions, medication dosages, and speculative treatment advice, redirecting with a standard refusal.
3. **Emergency Red-Flag Router (`GuardrailsService.evaluateRedFlags`)**:
   - Continuously evaluates complaints against emergency clinical criteria (crushing chest pain, severe dyspnea, acute neurological deficit), auto-escalating the session and issuing immediate 911 directives.
4. **Adversarial Safety Evaluation**:
   - Verified against a 30-case adversarial benchmark achieving a **100% injection block rate**.

---

## ⚡ Interoperability: HL7 FHIR R4 Standard

IntakeRx serializes finalized pre-screening notes into standard **HL7 FHIR R4 Bundles** (`Bundle.type: collection`):

* **Patient**: Demographics (name, gender, birthDate).
* **Coverage**: Insurance carrier and policy mapping.
* **Condition**: Active symptoms with SNOMED CT severity codes (`Mild`, `Moderate`, `Severe`).
* **MedicationStatement**: Current medications, dosages, and schedules.
* **DocumentReference**: Finalized clinical SOAP summary note, base64-encoded as a plain text attachment.
* **Formats Supported**:
  - `application/fhir+json`
  - `application/fhir+xml` (custom dependency-free recursive serializer conforming to HL7 XML schemas)

---

## 🚀 Quickstart & Setup

### Prerequisites
* **Node.js** (v18+)
* **PostgreSQL** (v15+ with `pgvector` extension)
* **Python** (v3.10+ for FastAPI microservice)

### 1. Environment Configuration

Create a `.env` file in the root directory:

```env
PORT=5001
NODE_ENV=development
DATABASE_URL=postgresql://intakerx:password@localhost:5432/intakerx?sslmode=disable
JWT_SECRET=your_jwt_secret_here

# AI Service Keys (At least one required)
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=AIza...
```

### 2. Database Initialization
```bash
cd backend
npm install
npm run db:init
```

### 3. Start Backend Services
```bash
cd backend
npm run dev
```

### 4. Start Frontend Portal
```bash
cd frontend
npm install
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser:
* **Patient Intake**: Register a patient account, accept the clinical consent gate, and speak or chat.
* **Clinician Portal**: Sign in with `dr.smith@clinic.com` / `admin2026` to inspect triage, CDS alerts, telemetry playback, analytics, and security deflection logs.

---

## 🧪 Automated Testing & Evaluation

IntakeRx includes a comprehensive suite of automated tests and evaluation gates:

```bash
# 1. Full 8-Stage End-to-End System Test
cd backend
npm run test:e2e

# 2. Adversarial AI Safety Evaluation (30 attack vectors)
npm run eval:safety

# 3. Clinical Triage Accuracy Evaluation (15 gold-standard cases)
npm run eval:triage

# 4. Individual Subsystem Integration Tests
npx ts-node src/test_notifications.ts  # Real-time SSE push alerts
npx ts-node src/test_consent.ts        # Patient consent workflow
npx ts-node src/test_security.ts       # Security threat observability
npx ts-node src/test_telemetry.ts      # Vitals telemetry playback
npx ts-node src/test_interactions.ts   # CDS drug-drug & allergen warnings
npx ts-node src/test_fhir.ts           # HL7 FHIR R4 JSON & XML serialization
npx ts-node src/test_ehr_sandbox.ts    # EHR sandbox & webhook simulator
npx ts-node src/test_differential.ts   # AI differential diagnosis matrix
npx ts-node src/test_body_map.ts       # Anatomical body map & pain locator
npx ts-node src/test_ambient_scribe.ts # Ambient scribe & speaker diarization
npx ts-node src/test_followup.ts       # Automated post-visit follow-up protocols
```

---

## 📜 Compliance & Security Disclaimer

IntakeRx is an artificial intelligence pre-screening and clinical decision support system designed to assist healthcare providers. It does not provide medical diagnoses, prescribe treatments, or substitute for the clinical judgment of licensed physicians. All Protected Health Information (PHI) is processed in accordance with HIPAA standards.

---

## 📄 License

MIT License — free for educational, research, and healthcare technology development.
