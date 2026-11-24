import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateFhirBundle, fhirJsonToXml } from '../src/services/fhir';
import { pool } from '../src/db';

describe('HL7 FHIR R4 Bundle & XML Serialization (offline fixtures)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('generates a 6-entry FHIR R4 Bundle and valid HL7 XML without PostgreSQL', async () => {
    vi.spyOn(pool, 'query').mockImplementation(async (sql: any) => {
      const q = String(sql);
      if (q.includes('FROM intake_sessions s')) {
        return {
          rowCount: 1,
          rows: [
            {
              sessionId: 'sess-fhir-001',
              status: 'completed',
              triageLevel: 'urgent',
              triageRationale: 'Moderate wheezing and shortness of breath.',
              createdAt: '2026-11-24T12:00:00Z',
              patientId: 42,
              name: 'Johnathan Doe',
              dob: '1985-05-12',
              sex: 'Male',
              insuranceProvider: 'Blue Cross Shield',
              insurancePolicy: 'BCX-9988223',
            },
          ],
        } as any;
      }
      if (q.includes('FROM symptoms')) {
        return {
          rowCount: 2,
          rows: [
            { id: 1, name: 'Moderate wheezing', severity: 'moderate', duration: '2 days', isRedFlag: false },
            { id: 2, name: 'Dry cough', severity: 'mild', duration: '3 days', isRedFlag: false },
          ],
        } as any;
      }
      if (q.includes('FROM medications')) {
        return {
          rowCount: 1,
          rows: [{ id: 10, name: 'Albuterol Inhaler', dosage: '2 puffs', frequency: 'every 4 hours as needed' }],
        } as any;
      }
      if (q.includes('FROM intake_summaries')) {
        return {
          rowCount: 1,
          rows: [
            {
              summaryData: {
                subjective: 'Moderate wheezing for 2 days.',
                objective: 'Alert, mild expiratory wheeze.',
                assessment: 'Provisional asthma exacerbation.',
                plan: 'Continue Albuterol as prescribed.',
              },
              createdAt: '2026-11-24T12:15:00Z',
            },
          ],
        } as any;
      }
      return { rowCount: 0, rows: [] } as any;
    });

    const bundle = await generateFhirBundle('sess-fhir-001');
    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.type).toBe('collection');
    expect(bundle.entry).toHaveLength(6);

    const resources = bundle.entry.map((e: any) => e.resource);
    const patient = resources.find((r: any) => r.resourceType === 'Patient');
    const coverage = resources.find((r: any) => r.resourceType === 'Coverage');
    const conditions = resources.filter((r: any) => r.resourceType === 'Condition');
    const medStatement = resources.find((r: any) => r.resourceType === 'MedicationStatement');
    const docRef = resources.find((r: any) => r.resourceType === 'DocumentReference');

    expect(patient.gender).toBe('male');
    expect(patient.birthDate).toBe('1985-05-12');
    expect(coverage.subscriber.reference).toBe('Patient/pat-42');
    expect(coverage.payor[0].display).toBe('Blue Cross Shield');
    expect(conditions).toHaveLength(2);
    expect(medStatement.medicationCodeableConcept.text).toBe('Albuterol Inhaler');
    expect(docRef.content[0].attachment.data.length).toBeGreaterThan(10);

    const xml = fhirJsonToXml(bundle);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<Bundle xmlns="http://hl7.org/fhir">');
    expect(xml).toContain('<resource><Patient>');
    expect(xml.endsWith('</Bundle>')).toBe(true);
  });
});
