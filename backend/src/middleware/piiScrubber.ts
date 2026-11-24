import { NextFunction, Request, Response } from 'express';
import { scrubPii } from '../services/piiScrubber';

const SCRUB_BODY_FIELDS = new Set([
  'content',
  'query',
  'input',
  'caption',
  'radiationDetails',
  'chiefComplaint',
  'fieldNotes',
  'text',
  'message',
  'prompt',
]);

function scrubBodyValue(val: unknown): unknown {
  if (typeof val === 'string') {
    return scrubPii(val).scrubbedText;
  }
  if (Array.isArray(val)) {
    return val.map(scrubBodyValue);
  }
  if (val && typeof val === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      out[k] = SCRUB_BODY_FIELDS.has(k) || typeof v === 'object' ? scrubBodyValue(v) : v;
    }
    return out;
  }
  return val;
}

/**
 * Express middleware that scrubs PII patterns in incoming free-text fields
 * before downstream route handlers or LLM services process them.
 */
export function scrubIncomingPiiMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    for (const key of Object.keys(req.body)) {
      if (SCRUB_BODY_FIELDS.has(key) || Array.isArray(req.body[key])) {
        req.body[key] = scrubBodyValue(req.body[key]);
      }
    }
  }
  next();
}
