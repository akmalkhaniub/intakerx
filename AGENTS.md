# AGENTS.md — Autonomous Agent Operating Contract

## 🎯 Repository Purpose & Architecture
`IntakeRx` is an AI voice and chat clinical patient intake and pre-screening platform. It uses Retrieval-Augmented Generation (RAG) over medical guideline protocols, enforces dual-layer safety guardrails (anti-jailbreak and anti-diagnostic liability), and synchronizes structured SOAP notes to Electronic Health Records (EHR) portals via Playwright automation.

### Tech Stack
- **Frontend**: React + Vite (Port 3000), Web Speech API
- **Backend API**: Express 5 + TypeScript (Port 5001), PostgreSQL 18 + pgvector
- **Ingestion & EHR Service**: FastAPI (Port 8002), Playwright browser agent
- **Guardrails**: Regex heuristics + semantic LLM classifiers

---

## ⚡ Autonomous Execution Protocol
1. Read assigned task from `TASKS.json`.
2. Inspect target service (`backend/`, `frontend/`, or `fastapi-service/`).
3. Adhere strictly to HIPAA-compliant data handling and AI safety rules.
4. Execute verification command:
   ```bash
   npm run typecheck && npm run test
   ```
5. Self-heal any errors until exit code is 0.
6. Commit with: `feat(task-id): description`.

---

## 🛡️ Non-Negotiable Safety & Quality Rules
- **Zero Diagnostic Statements**: The AI intake agent must NEVER formulate clinical diagnoses or prescribe treatments; all generated outputs must be framed as subjective triage data for clinician review.
- **Client-Side PII Scrubbing**: Ensure all patient identifiers (SSN, MRN, full phone numbers) are masked before text is sent to external LLM endpoints.
- **Strict FHIR Output Structure**: SOAP summaries and triage reports must conform to FHIR-compliant JSON structures.
