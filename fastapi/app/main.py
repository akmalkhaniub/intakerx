import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from .ehr import sync_to_ehr_portal
from .parser import ingest_default_protocols, parse_and_ingest_pdf

app = FastAPI(title="IntakeRx FastAPI Service", description="Clinical Document Parser & EHR Auto-Ingester")

class MedicationItem(BaseModel):
    name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None

class InsuranceData(BaseModel):
    provider: Optional[str] = None
    policyNumber: Optional[str] = None

class SOAPSummaryInput(BaseModel):
    chiefComplaint: str
    historyOfPresentIllness: str
    pastMedicalHistory: Optional[str] = None
    medications: List[MedicationItem]
    allergies: List[str]
    insurance: Optional[InsuranceData] = None
    triageLevel: str
    triageRationale: str
    redFlagsIdentified: List[str]

class SyncRequest(BaseModel):
    sessionId: str
    summary: SOAPSummaryInput

@app.get("/health")
def health_check():
    return {"status": "OK", "service": "fastapi"}

@app.post("/api/ehr/sync")
async def sync_ehr(request: SyncRequest):
    try:
      summary = request.summary
      
      # Look up patient name by query to backend or simulate/fetch. 
      # Since we pass the structured summary, let's extract patient name (e.g. John Doe fallback or pass in request).
      # We'll pass patientName inside request or use a default since we simulate EHR.
      # To be robust, let's look for a name or extract it. We can add a fallback.
      patient_name = "Patient (ID: " + request.sessionId[:6] + ")"
      
      # Convert medications list to a human readable string
      meds_list = []
      for m in summary.medications:
          item = m.name
          if m.dosage:
              item += f" {m.dosage}"
          if m.frequency:
              item += f" ({m.frequency})"
          meds_list.append(item)
      meds_str = ", ".join(meds_list) if meds_list else "None reported"
      
      allergies_str = ", ".join(summary.allergies) if summary.allergies else "NKDA (No Known Drug Allergies)"
      
      ehr_id = await sync_to_ehr_portal(
          patient_name=patient_name,
          chief_complaint=summary.chiefComplaint,
          hpi=summary.historyOfPresentIllness,
          triage_level=summary.triageLevel,
          meds=meds_str,
          allergies=allergies_str
      )
      
      return {"success": True, "ehrId": ehr_id}
    except Exception as e:
      raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/protocols/bootstrap")
def bootstrap_protocols():
    try:
        # Ingest the default gold-standard protocols (Cardiac, Asthma, GI)
        ingest_default_protocols()
        return {"success": True, "message": "Clinical protocols embedded and ingested successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/protocols/parse-file")
def parse_protocol_file(file_path: str):
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")
        
    if not file_path.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
        
    try:
        uploaded_chunks = parse_and_ingest_pdf(file_path)
        return {"success": True, "uploadedChunks": uploaded_chunks}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
