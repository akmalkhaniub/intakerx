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
| **Phase 21** | **Visual Dermatological & Wound Triage** | Multi-modal dermatological image analyzer with Fitzpatrick skin typing, ABCDE melanoma checks, and wound area tracking. | `test_visual_triage.ts` (Passed) |
| **Phase 22** | **Clinical Order Sets & LOINC/RxNorm** | Pre-bundled order sets for high-frequency presentations with standardized LOINC lab codes, RxNorm meds, and CPT imaging. | `test_clinical_orders.ts` (Passed) |
| **Phase 23** | **Integrated Telehealth Video Room** | HIPAA-compliant WebRTC telehealth consult suite with live ambient scribe sidebar, screen sharing, and post-call SOAP auto-save. | `test_telehealth.ts` (Passed) |
| **Phase 24** | **Intelligent Waiting Room & ESI Dynamic Queue** | Dynamic Emergency Severity Index (ESI Level 1-5) sorting engine with real-time wait time forecasts and bed management. | `test_esi_triage.ts` (Passed) |
| **Phase 25** | **Architecture Hardening & Stress Benchmarking** | High-concurrency throughput stress testing, database connection pooling optimization, and automated health telemetry. | `test_performance_benchmarks.ts` (Passed) |
| **Phase 26** | **AI Clinical Trial Matching & Protocol Screening** | Autonomous ClinicalTrials.gov matcher querying NCT protocols against patient demographics, ICD-10s, and eligibility criteria. | `test_clinical_trials.ts` (Passed) |
| **Phase 27** | **Multidisciplinary Team (MDT) Conferencing** | Tumor Board & Complex Case Review room with differential voting breakdown, specialist notes feed, and consensus sign-off. | `test_case_conferencing.ts` (Passed) |
| **Phase 28** | **Autonomous Prior-Auth & CMS-1500 Generator** | Payer medical policy denial risk scoring, automated Letter of Medical Necessity compiler, and 100% clean CMS-1500 claim scrubber. | `test_billing_prior_auth.ts` (Passed) |
| **Phase 29** | **Offline-First Field Triage & Disaster Mode** | Local START triage classification engine, offline client queue, idempotent batch sync, and facility-wide Disaster Mode toggle. | `test_offline_sync.ts` (Passed) |
| **Phase 30** | **Pediatric & Geriatric Specialized Protocols** | PEWS pediatric scoring with rapid response escalation, Morse Fall Risk assessment, atypical delirium screening, and caregiver proxy access. | `test_specialized_triage.ts` (Passed) |
| **Phase 31** | **Computer-Assisted Coding (CAC) & Cross-Mapping** | Dual ICD-10-CM / ICD-11 & SNOMED CT clinical cross-mapping engine with specificity analysis, HCC risk flags, and 1-click SOAP insertion. | `test_clinical_coding.ts` (Passed) |
| **Phase 32** | **Antimicrobial Stewardship & PGx Safety Engine** | Renal CrCl-adjusted dosing calculator, pathogen de-escalation, CYP2C19/CYP2D6/SLCO1B1 pharmacogenomics (PGx) CPIC guideline alerts. | `test_antimicrobial_pgx.ts` (Passed) |
| **Phase 33** | **Closed-Loop Specialist Referrals & e-Consults** | Inter-facility referral routing, provisional ICD-10s, specialist consultation feedback loop, and CPT 99451 asynchronous e-Consult exchange. | `test_referral_management.ts` (Passed) |
| **Phase 34** | **Inpatient Bedside Rounding & I-PASS Shift Handoff** | Standardized I-PASS handoff suite (Illness severity, Patient summary, Action items, Contingency, Synthesis), lines/tubes/drains infection monitor. | `test_ipass_rounding.ts` (Passed) |
| **Phase 35** | **Population Health, CMS-HCC RAF & HEDIS Care Gaps** | CMS-HCC V28 risk adjustment factor (RAF) engine with disease interactions, annual Medicare capitation benchmarks, and NCQA HEDIS care gap closer. | `test_population_health.ts` (Passed) |
| **Phase 36** | **Sepsis Watchdog & SEP-1 Quality Bundle** | Multi-modal clinical deterioration surveillance computing NEWS2, qSOFA, and SIRS scores with automated CMS SEP-1 3h/6h bundle countdown timers. | `test_sepsis_watchdog.ts` (Passed) |
| **Phase 37** | **Zero-Click RevCycle & Denial Appeals Engine** | Institutional UB-04 and CMS-1500 claim scrubber detecting NCCI/CCI unbundling and NCD/LCD policy breaches with 1-click evidence-backed appeal letters. | `test_revcycle_appeals.ts` (Passed) |
| **Phase 38** | **Hospital-at-Home (HaH) & Continuous RPM Fleet** | In-home biometric telemetry surveillance (cellular scales, cuffs, pulse-ox) with acute decompensation alerting and CPT 99453–99458 automated billing. | `test_hospital_at_home.ts` (Passed) |
| **Phase 39** | **Acoustic Biomarkers & Voice Affect Analyzer** | Ambient voice acoustic feature extractor (F0 pitch modulation, jitter %, shimmer %, HNR dB) screening for vocal cord strain, dyspnea, and psychomotor blunting. | `test_acoustic_biomarkers.ts` (Passed) |
| **Phase 40** | **Inter-Facility Transfer Center & EMTALA Hub** | Centralized acute transfer command matching hospital bed capacity (ICU, Neuro, Burn), managing physician-to-physician sign-offs, and dispatching aeromedical medevacs. | `test_transfer_logistics.ts` (Passed) |
| **Phase 41** | **Operating Room & Perioperative Care Suite** | Comprehensive perioperative command with ERAS enhanced recovery bundles, ASA physical status scoring, RCRI cardiac risk, Mallampati airway classification, Train-of-Four (TOF) neuromuscular blockade, and Aldrete PACU discharge criteria. | `test_perioperative_suite.ts` (Passed) |
| **Phase 42** | **Infection Prevention & Hospital Acquired Condition (HAI / CDC NHSN) Surveillance** | Real-time surveillance of invasive device-days (CVC, Foley, Ventilators), NHSN criteria matching for CLABSI, CAUTI, SSI, C. difficile LabID, automated Contact/Enteric isolation, and CMS HACRP Domain 2 Standardized Infection Ratio (SIR) forecasting. | `test_infection_surveillance.ts` (Passed) |
| **Phase 43** | **Autonomous Pharmacotherapy Reconciliation & Meds-to-Beds Delivery Engine** | Automated triple-comparison (Home vs Inpatient vs Discharge) detecting unintended omissions, therapeutic duplications, and renal dose adjustments; formulary Tier 1 generic substitution with copay savings; and bedside courier hand-off with high-risk teach-back verification. | `test_discharge_medrec.ts` (Passed) |
| **Phase 44** | **Oncology Clinical Pathway Navigator & Genomic Tumor Board Precision Engine** | Molecular Tumor Board (MTB) engine with AMP/ASCO/CAP Tier I/II NGS somatic variant actionability matching (EGFR, KRAS, BRAF, HER2, BRCA), NCCN guideline concordance checker, Mosteller BSA, and Calvert Carboplatin AUC dosing calculator. | `test_precision_oncology.ts` (Passed) |
| **Phase 45** | **Behavioral Health Emergency Command & Crisis De-Escalation (B-SAFE Hub)** | Emergency psychiatry command featuring the 6-item Brøset Violence Checklist (BVC), automated 1:1 constant observation stratification, trauma-informed sensory room de-escalation protocols, statutory involuntary hold tracking (5150/Baker Act/Section 12), and regional psychiatric crisis bed locator. | `test_behavioral_crisis.ts` (Passed) |
| **Phase 46** | **Critical Care ICU Shock & Vasopressor Titration (ICU-SHOCK Hub)** | Multi-subtype shock classifier (Septic, Cardiogenic, Hypovolemic, Obstructive, Anaphylactic), Surviving Sepsis Campaign 30 mL/kg balanced crystalloids, weight-based vasoactive titration (Norepinephrine, Vasopressin, Epinephrine, Dobutamine), and Dynamic Arterial Elastance (Ea_dyn) fluid responsiveness. | `test_critical_care_shock.ts` (Passed) |
| **Phase 47** | **Autonomous Clinical Documentation Improvement (CDI) & Physician Query Hub** | Natural language chart discrepancy auditor scanning clinical notes, lab results, and medications; AHIMA/ACDIS compliant non-leading physician queries; MCC/CC diagnostic specificity optimization; and DRG payment weight lift forecasting. | `test_autonomous_cdi.ts` (Passed) |
| **Phase 48** | **Solid Organ Transplant Logistics & HLA Virtual Crossmatch Engine (OrganMatch Hub)** | UNOS waitlist allocation with MELD-Na, KDPI, and cPRA computation; high-resolution HLA allele virtual crossmatching (HLA-A, B, C, DRB1, DQB1) with DSA MFI threshold warnings; and live Cold Ischemia Time (CIT) countdown clocks. | `test_organ_transplant.ts` (Passed) |
| **Phase 49** | **Labor & Delivery / Obstetric Emergency Command (OB-SAFE Hub)** | NICHD 3-tier continuous fetal heart rate (FHR) interpretation, Maternal Early Warning Criteria (MEWC) surveillance, ACOG Stage 1-3 postpartum hemorrhage (PPH) gravimetric QBL management, and urgent severe preeclampsia antihypertensive/MgSO4 protocols. | `test_obstetric_safety.ts` (Passed) |
| **Phase 50** | **Pharmacy Sterile Compounding & USP <797>/<800> Cleanroom IV Automation** | USP <797> Beyond-Use Date (BUD) risk tier calculator, density-adjusted gravimetric check with strict ±3% mass tolerance lockout, USP <800> hazardous closed-system drug transfer (CSTD) enforcement, and negative pressure differential telemetry surveillance. | `test_cleanroom_compounding.ts` (Passed) |
| **Phase 51** | **Stroke & Neurovascular Acute Code Command (CODE-STROKE Hub)** | Automated NIHSS 0-42 neuro scoring, ASPECTS CT ischemia rating, Tenecteplase/Alteplase weight-adjusted dosing, Door-to-Needle <= 45m stopwatch, and early/extended (DAWN/DEFUSE-3) EVT mechanical thrombectomy eligibility watchdog. | `test_stroke_command.ts` (Passed) |
| **Phase 52** | **Blood Bank & Massive Transfusion Protocol (HEMO-SURGE Command)** | Assessment of Assessment of Blood Consumption (ABC) score, Shock Index >= 1.0, balanced 1:1:1 PRBC/FFP/Platelet component tracker, Viscoelastic TEG/ROTEM parameter guidance (R, K, alpha-angle, MA, LY30), and hypocalcemia / citrate toxicity calcium chloride sentinel. | `test_massive_transfusion.ts` (Passed) |
| **Phase 53** | **Cardiac Catheterization Lab & STEMI Door-to-Balloon Fleet (CATH-ALERT Hub)** | Door-to-Balloon <= 90m target countdown clock, Smith-Modified Sgarbossa LBBB criteria, Wellens Syndrome Type A/B, de Winter T-waves, Mehran 2.0 Contrast-Induced Nephropathy (CIN) risk scoring with hydration targets, and post-PCI arteriotomy closure bed-rest watchdog. | `test_cath_alert.ts` (Passed) |
| **Phase 54** | **Extracorporeal Membrane Oxygenation (ECMO) & Mechanical Circulatory Support (MCS Hub)** | RESP score survival calculator for VV-ECMO (ARDS), SAVE score for VA-ECMO (cardiogenic shock), continuous Delta-P transmembrane pressure gradient clot alert (>= 55 mmHg), venous chatter suckdown watchdog (<= -90 mmHg), and plasma free hemoglobin (pfHb >= 50 mg/dL) pump shear hemolysis sentinel. | `test_ecmo_support.ts` (Passed) |
| **Phase 55** | **Burn & Complex Trauma Resuscitation Command (TRAUMA-ONE Hub)** | Lund-Browder & Rule of Nines %TBSA burn surface estimator, Consensus Parkland (4 mL * kg * %TBSA) and Modified Brooke formulas, closed-loop hourly urine output (UOP) titration watchdog (0.5-1.0 mL/kg/hr), fluid creep (>250 mL/kg) abdominal compartment syndrome (ACS) warning, and carboxyhemoglobin (COHb) inhalation kinetics with Hydroxocobalamin (Cyanokit) antidote protocol. | `test_burn_trauma.ts` (Passed) |
| **Phase 56** | **Pediatric Intensive Care (PICU) & Neonatal Resuscitation Program (NRP-SAFE Hub)** | APGAR scoring (0-10), NRP 8th Edition preductal SpO2 titration, Broselow tape pediatric weight-based airway sizing & defibrillation (2 J/kg, 4 J/kg), Bhutani total serum bilirubin hyperbilirubinemia phototherapy nomogram, and PELOD-2 pediatric multiorgan dysfunction score. | `test_pediatric_resuscitation.ts` (Passed) |
| **Phase 57** | **Emergency Airway Management & Rapid Sequence Intubation (AIRWAY-CODE Hub)** | LEMON 0-10 difficult airway assessment, MACOCHA ICU intubation difficulty score, weight-based RSI induction/paralytic dosing, Succinylcholine hyperkalemia safety check, Sugammadex immediate rescue reversal (16 mg/kg), and Can't Intubate Can't Oxygenate (CICO) surgical cricothyroidotomy protocol watchdog. | `test_airway_intubation.ts` (Passed) |
| **Phase 58** | **Medical Toxicology & Poison Control Command (TOX-ALERT Hub)** | Multi-toxidrome classifier (Anticholinergic, Cholinergic/SLUDGEM, Sympathomimetic, Opioid, Sedative-Hypnotic), Hunter Serotonin Toxicity Criteria, Rumack-Matthew APAP nomogram with 21-hour IV NAC protocol, Salicylate Done nomogram with NaHCO3 urine alkalinization (target pH 7.5-8.0) and hemodialysis sentinel, Toxic alcohol osmolar gap with Fomepizole dosing, and DigiFab vial calculator. | `test_medical_toxicology.ts` (Passed) |
| **Phase 59** | **Continuous Renal Replacement Therapy & Nephrology (CRRT-NAVIGATOR Hub)** | KDIGO Acute Kidney Injury staging, CVVHDF/CVVH/CVVHD/SCUF modality selection with delivered effluent target (20-25 mL/kg/h) and filtration fraction sentinel, Transmembrane Pressure (TMP) and hollow-fiber drop (Delta-P) filter clotting watchdog, and Regional Citrate Anticoagulation (RCA) with Total:Ionized Calcium ratio (>2.5) citrate toxicity sentinel. | `test_crrt_navigator.ts` (Passed) |
| **Phase 60** | **Radiation Oncology & Nuclear Medicine Theranostics (THERANOSTICS Hub)** | Linear-Quadratic radiobiology model (BED & EQD2) with tumor and late-responding OAR alpha/beta ratios, QUANTEC normal tissue complication probability (NTCP) organ constraints (spinal cord, lungs, kidneys, heart, rectum), targeted radioligand theranostics (177Lu-PSMA-617 Pluvicto, 177Lu-DOTATATE Lutathera with mandatory amino acid nephroprotection, 131I, 90Y SIRT), and radioactive decay countdown with NRC Regulatory Guide 8.39 ALARA patient release watchdog. | `test_radiation_theranostics.ts` (Passed) |

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
npx ts-node src/test_image_attachments.ts # Multi-modal medical photo & visual triage (Phase 21)
npx ts-node src/test_clinical_orders.ts   # Smart LOINC/CPT requisitions & FHIR ServiceRequests (Phase 22)
npx ts-node src/test_telehealth.ts        # Telehealth video consult & live clinical HUD (Phase 23)
npx ts-node src/test_esi_triage.ts        # Intelligent ESI 1-5 triage & waiting room manager (Phase 24)
npx ts-node src/test_patient_portal.ts    # Patient health portal & wearables biometric ingestion (Phase 25)
npx ts-node src/test_perioperative_suite.ts # OR, ERAS & Anesthesia PACU Suite (Phase 41)
npx ts-node src/test_infection_surveillance.ts # Infection Prevention & HAI / NHSN Surveillance (Phase 42)
npx ts-node src/test_discharge_medrec.ts   # Autonomous MedRec & Meds-to-Beds Delivery (Phase 43)
npx ts-node src/test_precision_oncology.ts # Precision Oncology & Genomic Tumor Board (Phase 44)
npx ts-node src/test_behavioral_crisis.ts  # Behavioral Health Crisis & B-SAFE ED Command (Phase 45)
npx ts-node src/test_critical_care_shock.ts   # Critical Care ICU Shock & Pressor Titration (Phase 46)
npx ts-node src/test_autonomous_cdi.ts        # Autonomous Clinical Documentation Improvement (Phase 47)
npx ts-node src/test_organ_transplant.ts      # Solid Organ Transplant & HLA Crossmatch (Phase 48)
npx ts-node src/test_obstetric_safety.ts      # Labor & Delivery / Obstetric Emergency Command (Phase 49)
npx ts-node src/test_cleanroom_compounding.ts # Pharmacy Sterile Compounding & USP <797>/<800> (Phase 50)
npx ts-node src/test_stroke_command.ts        # Stroke & Neurovascular Acute Code Command (Phase 51)
npx ts-node src/test_massive_transfusion.ts    # Blood Bank & Massive Transfusion Protocol (Phase 52)
npx ts-node src/test_cath_alert.ts            # Cath Lab & STEMI Door-to-Balloon Fleet (Phase 53)
npx ts-node src/test_ecmo_support.ts          # ECMO & Mechanical Circulatory Support (Phase 54)
npx ts-node src/test_burn_trauma.ts           # Burn & Complex Trauma Resuscitation Command (Phase 55)
npx ts-node src/test_pediatric_resuscitation.ts # PICU & Neonatal Resuscitation Program (Phase 56)
npx ts-node src/test_airway_intubation.ts       # Emergency Airway & Rapid Sequence Intubation (Phase 57)
npx ts-node src/test_medical_toxicology.ts      # Medical Toxicology & Poison Control Command (Phase 58)
npx ts-node src/test_crrt_navigator.ts          # CRRT & Acute Nephrology Navigator (Phase 59)
npx ts-node src/test_radiation_theranostics.ts  # Radiation Oncology & Theranostics Hub (Phase 60)
```

---

## 📜 Compliance & Security Disclaimer

IntakeRx is an artificial intelligence pre-screening and clinical decision support system designed to assist healthcare providers. It does not provide medical diagnoses, prescribe treatments, or substitute for the clinical judgment of licensed physicians. All Protected Health Information (PHI) is processed in accordance with HIPAA standards.

---

## 📄 License

MIT License — free for educational, research, and healthcare technology development.
