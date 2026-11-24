import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import clinicianRoutes from '../src/routes/clinician';
import { config } from '../src/config';
import { pool } from '../src/db';
import { AIService } from '../src/services/ai';

describe('Clinician Discharge Summary Routes (offline mock LLM & DB)', () => {
  const clinicianToken = jwt.sign(
    { id: 1, email: 'dr.smith@clinic.com', role: 'clinician' },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/clinician', clinicianRoutes);
    return app;
  }

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('generates and retrieves Spanish (es-ES) discharge guidelines via mocked AIService', async () => {
    const stored: { summary?: string; lang?: string } = {};

    vi.spyOn(pool, 'query').mockImplementation(async (sql: any, params?: any[]) => {
      const q = String(sql);
      if (q.includes('SELECT s.id, s.preferred_language')) {
        return { rowCount: 1, rows: [{ id: 'sess-dis-1', preferredLanguage: 'es-ES', patientName: 'Maria Lopez' }] } as any;
      }
      if (q.includes('FROM intake_summaries')) {
        return {
          rowCount: 1,
          rows: [{ summaryData: { chiefComplaint: 'Severe cough and mild fever' } }],
        } as any;
      }
      if (q.includes('INSERT INTO discharge_summaries')) {
        stored.summary = params?.[1];
        stored.lang = params?.[2];
        return { rowCount: 1, rows: [] } as any;
      }
      if (q.includes('FROM discharge_summaries')) {
        return {
          rowCount: 1,
          rows: [{ dischargeSummary: stored.summary, preferredLanguage: stored.lang, createdAt: '2026-11-24T12:00:00Z' }],
        } as any;
      }
      return { rowCount: 0, rows: [] } as any;
    });

    const aiMock = vi.spyOn(AIService, 'generateText').mockResolvedValue(
      `# Instrucciones de Cuidado del Paciente\n\n## 1. Lo que discutimos hoy\nRevisamos su tos severa.\n\n## 2. Pautas de Cuidado en el Hogar\n- Descanse.\n\n## 3. 🚨 ADVERTENCIAS\n- Llame al 911 si hay dolor en el pecho.`
    );

    const app = createApp();
    const postRes = await request(app)
      .post('/api/clinician/sessions/sess-dis-1/discharge')
      .set('Authorization', `Bearer ${clinicianToken}`)
      .expect(200);

    expect(aiMock).toHaveBeenCalledTimes(1);
    expect(postRes.body.preferredLanguage).toBe('es-ES');
    expect(postRes.body.dischargeSummary).toContain('# Instrucciones de Cuidado del Paciente');

    const getRes = await request(app)
      .get('/api/clinician/sessions/sess-dis-1/discharge')
      .set('Authorization', `Bearer ${clinicianToken}`)
      .expect(200);

    expect(getRes.body.dischargeSummary).toBe(postRes.body.dischargeSummary);
    expect(getRes.body.preferredLanguage).toBe('es-ES');
  });

  it('falls back cleanly to structured Spanish template when AIService fails', async () => {
    vi.spyOn(pool, 'query').mockImplementation(async (sql: any) => {
      const q = String(sql);
      if (q.includes('SELECT s.id, s.preferred_language')) {
        return { rowCount: 1, rows: [{ id: 'sess-dis-2', preferredLanguage: 'es-ES', patientName: 'Carlos Ruiz' }] } as any;
      }
      if (q.includes('FROM intake_summaries')) {
        return { rowCount: 1, rows: [{ summaryData: { chiefComplaint: 'Fiebre' } }] } as any;
      }
      return { rowCount: 1, rows: [] } as any;
    });
    vi.spyOn(AIService, 'generateText').mockRejectedValue(new Error('Simulated offline LLM'));

    const app = createApp();
    const res = await request(app)
      .post('/api/clinician/sessions/sess-dis-2/discharge')
      .set('Authorization', `Bearer ${clinicianToken}`)
      .expect(200);

    expect(res.body.preferredLanguage).toBe('es-ES');
    expect(res.body.dischargeSummary).toContain('Lo que discutimos hoy (es-ES)');
  });
});
