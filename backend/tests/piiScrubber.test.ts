import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { scrubPii, REDACTED_PII_TOKEN } from '../src/services/piiScrubber';
import { scrubIncomingPiiMiddleware } from '../src/middleware/piiScrubber';
import { AIService } from '../src/services/ai';

describe('Pre-Prompt & Middleware PII Scrubber (IRX-002)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('redacts SSNs, Luhn-validated credit cards, emails, phones, MRNs, and direct identifiers with [REDACTED_PII]', () => {
    const sample =
      'Patient Name: Alice Johnson. My name is Alice Johnson, SSN 123-45-6789, ' +
      'Card 4532-0151-1283-0366, Email alice@example.com, Phone (555) 234-5678, ' +
      'MRN: MRN-88210, DOB: 1988-04-12, Address: 742 Evergreen Terrace Street. ' +
      'Blood pressure reading 120/80 and pulse 72 bpm.';

    const result = scrubPii(sample, ['Alice Johnson']);
    expect(result.redactedCount).toBeGreaterThanOrEqual(7);
    expect(result.scrubbedText).toContain(REDACTED_PII_TOKEN);
    expect(result.scrubbedText).not.toContain('123-45-6789');
    expect(result.scrubbedText).not.toContain('4532-0151-1283-0366');
    expect(result.scrubbedText).not.toContain('alice@example.com');
    expect(result.scrubbedText).not.toContain('234-5678');
    expect(result.scrubbedText).not.toContain('MRN-88210');
    expect(result.scrubbedText).not.toContain('Alice Johnson');
    // Clinical vitals are preserved
    expect(result.scrubbedText).toContain('120/80');
    expect(result.scrubbedText).toContain('72 bpm');
  });

  it('scrubs PII from AIService.generateText payloads before external fetch transmission', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Intake noted.' }] } }],
      }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    await AIService.generateText(
      'Patient Name: Bob Carter\nDOB: 1979-11-03',
      [{ role: 'user', content: 'My SSN is 987-65-4321 and email is bob@clinic.org' }],
      { provider: 'gemini' }
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const bodyStr = String(fetchSpy.mock.calls[0][1].body);
    expect(bodyStr).not.toContain('Bob Carter');
    expect(bodyStr).not.toContain('1979-11-03');
    expect(bodyStr).not.toContain('987-65-4321');
    expect(bodyStr).not.toContain('bob@clinic.org');
    expect(bodyStr).toContain(REDACTED_PII_TOKEN);
  });

  it('scrubs incoming Express request bodies via scrubIncomingPiiMiddleware', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/intake', scrubIncomingPiiMiddleware);
    app.post('/api/intake/echo', (req, res) => {
      res.json(req.body);
    });

    const res = await request(app)
      .post('/api/intake/echo')
      .send({ content: 'Call me at 555-867-5309, SSN 111-22-3333' })
      .expect(200);

    expect(res.body.content).not.toContain('555-867-5309');
    expect(res.body.content).not.toContain('111-22-3333');
    expect(res.body.content).toContain(REDACTED_PII_TOKEN);
  });
});
