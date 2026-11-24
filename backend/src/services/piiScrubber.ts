export interface PiiScrubResult {
  scrubbedText: string;
  redactedCount: number;
  categories: string[];
}

export const REDACTED_PII_TOKEN = '[REDACTED_PII]';

function passesLuhn(digits: string): boolean {
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number.parseInt(digits[i], 10);
    if (Number.isNaN(digit)) return false;
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Deterministically scrub SSNs, Luhn-validated credit cards, emails, phones,
 * MRN/policy IDs, DOBs, street addresses, and named-entity direct identifiers
 * with `[REDACTED_PII]` before LLM transmission.
 */
export function scrubPii(input: string, knownIdentifiers: string[] = []): PiiScrubResult {
  if (!input) {
    return { scrubbedText: input, redactedCount: 0, categories: [] };
  }

  let text = input;
  let redactedCount = 0;
  const categories = new Set<string>();

  const replaceMatches = (regex: RegExp, category: string, replacer?: (m: string) => string) => {
    text = text.replace(regex, (match) => {
      if (match.includes(REDACTED_PII_TOKEN)) return match;
      if (replacer) {
        const next = replacer(match);
        if (next === match) return match;
        redactedCount++;
        categories.add(category);
        return next;
      }
      redactedCount++;
      categories.add(category);
      return REDACTED_PII_TOKEN;
    });
  };

  // 1. Known patient identifiers passed explicitly (name, DOB, policy ID)
  for (const ident of knownIdentifiers) {
    const trimmed = ident?.trim();
    if (trimmed && trimmed.length >= 3) {
      replaceMatches(new RegExp(`\\b${escapeRegex(trimmed)}\\b`, 'gi'), 'known_identifier');
    }
  }

  // 2. SSNs (XXX-XX-XXXX, XXX XX XXXX, or explicitly labeled 9-digit SSN)
  replaceMatches(/\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/g, 'ssn');
  replaceMatches(/\b(SSN|Social\s+Security(?:\s+Number)?)\s*[:#-]?\s*\d{9}\b/gi, 'ssn', (m) => {
    const prefix = m.split(/\d{9}/)[0];
    return `${prefix}${REDACTED_PII_TOKEN}`;
  });

  // 3. Credit Card numbers (13-19 digits with optional separators, Luhn validated)
  replaceMatches(/\b(?:\d[ -]*?){13,19}\b/g, 'credit_card', (match) => {
    const digits = match.replace(/[^0-9]/g, '');
    if (digits.length < 13 || digits.length > 19) return match;
    if (!passesLuhn(digits)) return match;
    return REDACTED_PII_TOKEN;
  });

  // 4. Email addresses
  replaceMatches(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, 'email');

  // 5. Phone numbers
  replaceMatches(/(?:\+?1[-.\s]?)?(?:\(\d{3}\)|\b\d{3})[-.\s]\d{3}[-.\s]\d{4}\b/g, 'phone');

  // 6. MRN / Insurance Policy / Member IDs
  replaceMatches(
    /\b(?:MRN|Medical\s+Record(?:\s+Number)?|Policy(?:\s+ID)?|Member\s*ID)\s*[:#-]?\s*[A-Z0-9-]{4,}\b/gi,
    'medical_id'
  );

  // 7. Labeled Dates of Birth
  replaceMatches(
    /\b(?:DOB|Date\s+of\s+Birth|born\s+on)\s*[:#-]?\s*(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2}|[A-Za-z]+\s+\d{1,2},?\s+\d{4})\b/gi,
    'dob'
  );

  // 8. Street addresses
  replaceMatches(
    /\b\d{1,5}\s+(?:[A-Z][a-z]+\s+){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way)\b\.?/g,
    'address'
  );

  // 9. Named-Entity direct identifiers (labeled names, introductions, titled names)
  replaceMatches(
    /\b(?:Patient\s+Name|Full\s+Name)\s*:\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}/g,
    'named_entity',
    (m) => `${m.split(':')[0]}: ${REDACTED_PII_TOKEN}`
  );
  replaceMatches(
    /\b(?:my\s+name\s+is|i\s+am|this\s+is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/gi,
    'named_entity',
    (m) => {
      const idx = m.search(/\s+[A-Z]/);
      return idx > 0 ? `${m.slice(0, idx + 1)}${REDACTED_PII_TOKEN}` : REDACTED_PII_TOKEN;
    }
  );
  replaceMatches(
    /\b(?:Mr|Mrs|Ms|Miss|Dr|Prof)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\b/g,
    'named_entity'
  );

  return {
    scrubbedText: text,
    redactedCount,
    categories: Array.from(categories),
  };
}
