import { pool } from '../db';

/**
 * Maps a patient's sex to a FHIR administrative gender code.
 */
function mapGender(sex: string): string {
  const normalized = sex.toLowerCase().trim();
  if (normalized === 'male' || normalized === 'm') return 'male';
  if (normalized === 'female' || normalized === 'f') return 'female';
  if (normalized === 'other' || normalized === 'o') return 'other';
  return 'unknown';
}

/**
 * Maps symptom severity to FHIR severity CodeableConcept structures.
 */
function mapSeverity(severity: string) {
  const norm = severity.toLowerCase().trim();
  let code = '255604002'; // default mild
  let display = 'Mild';

  if (norm === 'severe' || norm === 'high') {
    code = '24484000';
    display = 'Severe';
  } else if (norm === 'moderate' || norm === 'medium') {
    code = '6736007';
    display = 'Moderate';
  }

  return {
    coding: [
      {
        system: 'http://snomed.info/sct',
        code: code,
        display: display
      }
    ],
    text: severity
  };
}

/**
 * Generates an HL7 FHIR R4 Bundle for an intake session.
 */
export async function generateFhirBundle(sessionId: string): Promise<any> {
  // 1. Fetch Session and Patient details
  const sessionQuery = await pool.query(
    `SELECT s.id as "sessionId", s.status, s.triage_level as "triageLevel", 
            s.triage_rationale as "triageRationale", s.created_at as "createdAt",
            p.id as "patientId", p.name, p.dob, p.sex, 
            p.insurance_provider as "insuranceProvider", p.insurance_policy as "insurancePolicy"
     FROM intake_sessions s
     JOIN patients p ON s.patient_id = p.id
     WHERE s.id = $1`,
    [sessionId]
  );

  if (sessionQuery.rowCount === 0) {
    throw new Error('Session not found');
  }

  const session = sessionQuery.rows[0];

  // 2. Fetch Symptoms
  const symptomsQuery = await pool.query(
    `SELECT id, name, severity, duration, is_red_flag as "isRedFlag"
     FROM symptoms
     WHERE session_id = $1`,
    [sessionId]
  );

  // 3. Fetch Medications
  const medsQuery = await pool.query(
    `SELECT id, name, dosage, frequency
     FROM medications
     WHERE session_id = $1`,
    [sessionId]
  );

  // 4. Fetch Summary/SOAP Note
  const summaryQuery = await pool.query(
    `SELECT summary_data as "summaryData", created_at as "createdAt"
     FROM intake_summaries
     WHERE session_id = $1`,
    [sessionId]
  );

  const patientId = `pat-${session.patientId}`;
  const fhirEntries: any[] = [];

  // --- Patient Resource ---
  const patientResource = {
    resourceType: 'Patient',
    id: patientId,
    active: true,
    name: [
      {
        use: 'official',
        text: session.name
      }
    ],
    gender: mapGender(session.sex),
    birthDate: new Date(session.dob).toISOString().split('T')[0]
  };

  fhirEntries.push({
    fullUrl: `urn:uuid:${patientId}`,
    resource: patientResource
  });

  // --- Coverage Resource (Insurance) ---
  if (session.insuranceProvider) {
    const coverageId = `cov-${session.sessionId}`;
    const coverageResource = {
      resourceType: 'Coverage',
      id: coverageId,
      status: 'active',
      type: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            code: 'IPCOP',
            display: 'individual policy cooperation'
          }
        ],
        text: 'Private Insurance Policy'
      },
      subscriber: {
        reference: `Patient/${patientId}`
      },
      beneficiary: {
        reference: `Patient/${patientId}`
      },
      relationship: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
            code: 'self'
          }
        ]
      },
      payor: [
        {
          display: session.insuranceProvider
        }
      ],
      subscriberId: session.insurancePolicy || 'N/A'
    };

    fhirEntries.push({
      fullUrl: `urn:uuid:${coverageId}`,
      resource: coverageResource
    });
  }

  // --- Condition Resources (Symptoms) ---
  symptomsQuery.rows.forEach((symptom: any) => {
    const conditionId = `cond-${symptom.id}`;
    const conditionResource = {
      resourceType: 'Condition',
      id: conditionId,
      clinicalStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
            code: 'active',
            display: 'Active'
          }
        ]
      },
      verificationStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
            code: 'provisional',
            display: 'Provisional'
          }
        ]
      },
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/condition-category',
              code: 'encounter-diagnosis',
              display: 'Encounter Diagnosis'
            }
          ]
        }
      ],
      severity: mapSeverity(symptom.severity),
      code: {
        text: symptom.name
      },
      subject: {
        reference: `Patient/${patientId}`
      },
      note: [
        {
          text: `Duration: ${symptom.duration || 'Not specified'}.${symptom.isRedFlag ? ' [CRITICAL RED FLAG ESCALATION]' : ''}`
        }
      ]
    };

    fhirEntries.push({
      fullUrl: `urn:uuid:${conditionId}`,
      resource: conditionResource
    });
  });

  // --- MedicationStatement Resources (Medications) ---
  medsQuery.rows.forEach((med: any) => {
    const medId = `med-${med.id}`;
    const medResource = {
      resourceType: 'MedicationStatement',
      id: medId,
      status: 'active',
      medicationCodeableConcept: {
        text: med.name
      },
      subject: {
        reference: `Patient/${patientId}`
      },
      dosage: [
        {
          text: `${med.dosage || ''} ${med.frequency || ''}`.trim() || 'Dosage not specified'
        }
      ]
    };

    fhirEntries.push({
      fullUrl: `urn:uuid:${medId}`,
      resource: medResource
    });
  });

  // --- DocumentReference Resource (SOAP Summary) ---
  if (summaryQuery.rows.length > 0) {
    const summary = summaryQuery.rows[0];
    const docId = `doc-${session.sessionId}`;
    
    // Construct standard SOAP text block from JSON structure
    const soap = summary.summaryData;
    const soapText = `
INTAKERX PRE-VISIT INTAKE SUMMARY (SOAP NOTE)
==============================================
SESSION ID: ${session.sessionId}
DATE: ${new Date(session.createdAt).toLocaleString()}
TRIAGE LEVEL: ${session.triageLevel?.toUpperCase() || 'UNKNOWN'}
TRIAGE RATIONALE: ${session.triageRationale || 'N/A'}

SUBJECTIVE:
${soap.subjective || 'No subjective report available.'}

OBJECTIVE:
- Extracted Symptoms: ${symptomsQuery.rows.map(s => `${s.name} (${s.severity})`).join(', ') || 'None reported'}
- Active Medications: ${medsQuery.rows.map(m => `${m.name} (${m.dosage || 'N/A'}, ${m.frequency || 'N/A'})`).join(', ') || 'None reported'}
${soap.objective || ''}

ASSESSMENT:
${soap.assessment || 'Initial patient pre-screening conducted by IntakeRx AI.'}

PLAN:
${soap.plan || 'Refer to clinician for standard examination and diagnostic protocol.'}
    `.trim();

    const base64Data = Buffer.from(soapText).toString('base64');

    const docResource = {
      resourceType: 'DocumentReference',
      id: docId,
      status: 'current',
      docStatus: 'final',
      type: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '34117-2',
            display: 'History and physical note'
          }
        ],
        text: 'IntakeRx Clinical Intake Summary (SOAP)'
      },
      subject: {
        reference: `Patient/${patientId}`
      },
      date: new Date(summary.createdAt || session.createdAt).toISOString(),
      content: [
        {
          attachment: {
            contentType: 'text/plain',
            data: base64Data,
            title: 'Pre-Visit SOAP Note Attachment'
          }
        }
      ]
    };

    fhirEntries.push({
      fullUrl: `urn:uuid:${docId}`,
      resource: docResource
    });
  }

  // --- Bundle ---
  return {
    resourceType: 'Bundle',
    id: session.sessionId,
    type: 'collection',
    timestamp: new Date(session.createdAt).toISOString(),
    entry: fhirEntries
  };
}

/**
 * Serializes a FHIR JSON resource into fully compliant FHIR XML.
 */
export function fhirJsonToXml(json: any): string {
  const resourceType = json.resourceType || 'Resource';

  function toXml(obj: any, name: string, isRoot = false): string {
    if (obj === null || obj === undefined) return '';

    // If it's a simple scalar value, return escaped XML content
    if (typeof obj !== 'object') {
      const val = String(obj)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
      return `<${name}>${val}</${name}>`;
    }

    // If it's an array, map each item recursively using the same property name
    if (Array.isArray(obj)) {
      return obj.map(item => toXml(item, name)).join('');
    }

    // Handle nested resources in Bundle entries
    // In FHIR XML, nested resources inside Bundle.entry.resource are wrapped inside
    // the name of the resource type directly (e.g. <resource><Patient>...</Patient></resource>)
    if (name === 'resource' && obj.resourceType) {
      let nestedXml = `<resource>`;
      nestedXml += toXml(obj, obj.resourceType, false);
      nestedXml += `</resource>`;
      return nestedXml;
    }

    // Object serialization
    let xml = isRoot
      ? `<${name} xmlns="http://hl7.org/fhir">`
      : `<${name}>`;

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (key === 'resourceType') continue; // Handled as XML tag name
        xml += toXml(obj[key], key);
      }
    }

    xml += `</${name}>`;
    return xml;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n` + toXml(json, resourceType, true);
}
