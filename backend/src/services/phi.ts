import { pool } from '../db';

export class PHIService {
  /**
   * Scans and redacts PHI (Name, Phone, Email, SSN, DOB) from user input.
   * Logs any detected redactions to the `phi_redaction_logs` table.
   */
  static async redactAndLog(text: string, sessionId?: string): Promise<string> {
    if (!text) return text;
    
    let redactedText = text;
    const redactionLogs: { type: string; original: string; redacted: string }[] = [];

    // 1. Generic Email Redaction
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = text.match(emailRegex);
    if (emails) {
      for (const email of emails) {
        redactedText = redactedText.replace(email, '[REDACTED_EMAIL]');
        redactionLogs.push({ type: 'email', original: email, redacted: '[REDACTED_EMAIL]' });
      }
    }

    // 2. Generic SSN Redaction
    const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
    const ssns = text.match(ssnRegex);
    if (ssns) {
      for (const ssn of ssns) {
        redactedText = redactedText.replace(ssn, '[REDACTED_SSN]');
        redactionLogs.push({ type: 'ssn', original: ssn, redacted: '[REDACTED_SSN]' });
      }
    }

    // 3. Generic Phone Redaction
    const phoneRegex = /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
    const phones = text.match(phoneRegex);
    if (phones) {
      for (const phone of phones) {
        redactedText = redactedText.replace(phone, '[REDACTED_PHONE]');
        redactionLogs.push({ type: 'phone', original: phone, redacted: '[REDACTED_PHONE]' });
      }
    }

    // 4. Generic DOB / Date Redaction
    const dateRegex = /\b(?:0[1-9]|1[0-2])[-/](?:0[1-9]|[12]\d|3[01])[-/](?:19|20)\d{2}\b/g;
    const dates = text.match(dateRegex);
    if (dates) {
      for (const date of dates) {
        redactedText = redactedText.replace(date, '[REDACTED_DOB]');
        redactionLogs.push({ type: 'dob', original: date, redacted: '[REDACTED_DOB]' });
      }
    }

    // 5. Dynamic Redaction using Database Demographics
    if (sessionId) {
      try {
        const patientRes = await pool.query(
          `SELECT p.name, p.email, p.dob 
           FROM patients p
           JOIN intake_sessions s ON s.patient_id = p.id
           WHERE s.id = $1`,
          [sessionId]
        );
        
        if (patientRes.rowCount && patientRes.rows[0]) {
          const { name, email, dob } = patientRes.rows[0];
          
          // Redact exact name matches
          if (name) {
            const nameParts = name.split(/\s+/).filter((part: string) => part.length > 2);
            const sortedNames = [name, ...nameParts].sort((a, b) => b.length - a.length);
            
            for (const part of sortedNames) {
              const escapedPart = part.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
              const namePartRegex = new RegExp(`\\b${escapedPart}\\b`, 'gi');
              if (namePartRegex.test(redactedText)) {
                redactedText = redactedText.replace(namePartRegex, '[REDACTED_NAME]');
                redactionLogs.push({ type: 'name', original: part, redacted: '[REDACTED_NAME]' });
              }
            }
          }

          // Redact email
          if (email && redactedText.toLowerCase().includes(email.toLowerCase())) {
            const emailRegexEscaped = new RegExp(email.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
            redactedText = redactedText.replace(emailRegexEscaped, '[REDACTED_EMAIL]');
            redactionLogs.push({ type: 'email', original: email, redacted: '[REDACTED_EMAIL]' });
          }

          // Redact DOB
          if (dob) {
            let dobStr = '';
            let formattedDob = '';

            const dobDate = new Date(dob);
            if (!isNaN(dobDate.getTime())) {
              const y = dobDate.getFullYear();
              const m = String(dobDate.getMonth() + 1).padStart(2, '0');
              const d = String(dobDate.getDate()).padStart(2, '0');
              dobStr = `${y}-${m}-${d}`;
              formattedDob = `${m}/${d}/${y}`;
            }

            if (dobStr && redactedText.includes(dobStr)) {
              redactedText = redactedText.replace(new RegExp(dobStr, 'g'), '[REDACTED_DOB]');
              redactionLogs.push({ type: 'dob', original: dobStr, redacted: '[REDACTED_DOB]' });
            }
            
            if (formattedDob && redactedText.includes(formattedDob)) {
              redactedText = redactedText.replace(new RegExp(formattedDob, 'g'), '[REDACTED_DOB]');
              redactionLogs.push({ type: 'dob', original: formattedDob, redacted: '[REDACTED_DOB]' });
            }
          }
        }
      } catch (dbErr) {
        console.error('PHI database search error:', dbErr);
      }
    }

    // 6. Generic Heuristic Name Patterns (e.g. "my name is Alice")
    const nameHeuristicRegex = /\b(?:my name is|i am|called|this is|i'm)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/gi;
    let match;
    const heuristicText = redactedText;
    while ((match = nameHeuristicRegex.exec(heuristicText)) !== null) {
      const candidateName = match[1];
      if (candidateName !== '[REDACTED_NAME]' && !candidateName.toLowerCase().includes('redacted')) {
        redactedText = redactedText.replace(new RegExp(`\\b${candidateName}\\b`, 'g'), '[REDACTED_NAME]');
        redactionLogs.push({ type: 'name', original: candidateName, redacted: '[REDACTED_NAME]' });
      }
    }

    // Write logs to database
    if (redactionLogs.length > 0 && sessionId) {
      try {
        for (const log of redactionLogs) {
          // Check for duplicate log in the same session to avoid bloat
          const checkDup = await pool.query(
            `SELECT 1 FROM phi_redaction_logs 
             WHERE session_id = $1 AND phi_type = $2 AND original_content = $3 
             LIMIT 1`,
            [sessionId, log.type, log.original]
          );
          if (checkDup.rowCount === 0) {
            await pool.query(
              `INSERT INTO phi_redaction_logs (session_id, phi_type, original_content, redacted_content)
               VALUES ($1, $2, $3, $4)`,
              [sessionId, log.type, log.original, log.redacted]
            );
          }
        }
      } catch (logErr) {
        console.error('Failed to save PHI logs to database:', logErr);
      }
    }

    return redactedText;
  }
}
