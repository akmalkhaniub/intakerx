import { query } from '../db';

export interface FederatedPrivacyInput {
  modelId: string;
  clinicalTextPayload: string;
  patientAge?: number;
  aggregateMetricValue: number;
  sensitivityDeltaF: number;
  epsilonRequested: number;
  previousEpsilonSpent: number;
  maxEpsilonBudget: number;
  expectedBinDist: number[]; // sums to 1.0
  actualBinDist: number[]; // sums to 1.0
}

export interface FederatedPrivacyResult {
  id?: number;
  modelId: string;
  phiLeakCount: number;
  phiCategoriesDetected: string[];
  redactedPayload: string;
  ageGeneralized: string;
  epsilonSpentTotal: number;
  privacyBudgetExhausted: boolean;
  dpNoisedMetricValue: number | null;
  psiDriftScore: number;
  driftTier: 'NO_DRIFT_OPTIMAL' | 'MODERATE_SHIFT_MONITOR' | 'CRITICAL_COVARIATE_DRIFT_RETRAIN';
  governanceStatus: 'COMPLIANT_ACTIVE' | 'PRIVACY_BUDGET_EXHAUSTED' | 'DRIFT_SHADOW_FALLBACK';
  governanceDirectives: string[];
}

export class FederatedPrivacyAuditService {
  public static runAudit(input: FederatedPrivacyInput): FederatedPrivacyResult {
    const directives: string[] = [];
    const phiCategories: string[] = [];
    let phiLeakCount = 0;
    let redacted = input.clinicalTextPayload;

    // 1. HIPAA Safe Harbor 18-Identifier Redaction
    const patterns: Array<{ label: string; regex: RegExp; replacement: string }> = [
      { label: 'SSN', regex: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[REDACTED_SSN]' },
      { label: 'EMAIL', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replacement: '[REDACTED_EMAIL]' },
      { label: 'PHONE', regex: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, replacement: '[REDACTED_PHONE]' },
      { label: 'IPV4', regex: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, replacement: '[REDACTED_IP]' },
      { label: 'MRN', regex: /\bMRN[-:\s]?\d{4,12}\b/gi, replacement: '[REDACTED_MRN]' },
      { label: 'DATE', regex: /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})\b/g, replacement: '[REDACTED_DATE]' }
    ];

    for (const p of patterns) {
      const matches = redacted.match(p.regex);
      if (matches && matches.length > 0) {
        phiLeakCount += matches.length;
        phiCategories.push(p.label);
        redacted = redacted.replace(p.regex, p.replacement);
      }
    }

    const ageGeneralized =
      input.patientAge !== undefined
        ? input.patientAge > 89
          ? '90+ (Safe Harbor Aggregated)'
          : `${input.patientAge}`
        : 'UNSPECIFIED';

    if (input.patientAge !== undefined && input.patientAge > 89) {
      directives.push('HIPAA Safe Harbor §164.514(b): Patient age > 89 aggregated to "90+" category.');
    }
    if (phiLeakCount > 0) {
      directives.push(`PHI REDACTION APPLIED: Scrubbed ${phiLeakCount} identifier(s) [${phiCategories.join(', ')}].`);
    }

    // 2. Differential Privacy Budget & Laplace Mechanism
    const epsilonSpentTotal = parseFloat((input.previousEpsilonSpent + input.epsilonRequested).toFixed(3));
    const privacyBudgetExhausted = epsilonSpentTotal > input.maxEpsilonBudget;

    let dpNoisedMetricValue: number | null = null;
    if (privacyBudgetExhausted) {
      directives.push(
        `PRIVACY BUDGET EXHAUSTED: Requested epsilon (${epsilonSpentTotal} > ${input.maxEpsilonBudget}). Federated query BLOCKED to prevent reconstruction attack.`
      );
    } else {
      const scaleB = input.sensitivityDeltaF / Math.max(0.01, input.epsilonRequested);
      const u = Math.random() - 0.5;
      const laplaceNoise = -scaleB * Math.sign(u || 1) * Math.log(1 - 2 * Math.abs(u));
      dpNoisedMetricValue = parseFloat((input.aggregateMetricValue + laplaceNoise).toFixed(3));
    }

    // 3. Population Stability Index (PSI) Covariate Drift
    let psi = 0;
    const len = Math.min(input.expectedBinDist.length, input.actualBinDist.length);
    for (let i = 0; i < len; i++) {
      const exp = Math.max(0.0001, input.expectedBinDist[i]);
      const act = Math.max(0.0001, input.actualBinDist[i]);
      psi += (act - exp) * Math.log(act / exp);
    }
    const psiDriftScore = parseFloat(psi.toFixed(3));

    let driftTier: FederatedPrivacyResult['driftTier'] = 'NO_DRIFT_OPTIMAL';
    if (psiDriftScore >= 0.25) {
      driftTier = 'CRITICAL_COVARIATE_DRIFT_RETRAIN';
      directives.push(`CRITICAL MODEL DRIFT (PSI ${psiDriftScore} >= 0.25): Demote ${input.modelId} to Shadow Mode and trigger federated recalibration.`);
    } else if (psiDriftScore >= 0.1) {
      driftTier = 'MODERATE_SHIFT_MONITOR';
      directives.push(`MODERATE COVARIATE SHIFT (PSI ${psiDriftScore}): Increase calibration monitoring frequency.`);
    }

    const governanceStatus: FederatedPrivacyResult['governanceStatus'] = privacyBudgetExhausted
      ? 'PRIVACY_BUDGET_EXHAUSTED'
      : driftTier === 'CRITICAL_COVARIATE_DRIFT_RETRAIN'
      ? 'DRIFT_SHADOW_FALLBACK'
      : 'COMPLIANT_ACTIVE';

    return {
      modelId: input.modelId,
      phiLeakCount,
      phiCategoriesDetected: phiCategories,
      redactedPayload: redacted,
      ageGeneralized,
      epsilonSpentTotal,
      privacyBudgetExhausted,
      dpNoisedMetricValue,
      psiDriftScore,
      driftTier,
      governanceStatus,
      governanceDirectives: directives
    };
  }

  public static async recordAudit(input: FederatedPrivacyInput): Promise<FederatedPrivacyResult> {
    const result = this.runAudit(input);
    const res = await query(
      `INSERT INTO federated_privacy_audits (
        model_id, phi_leak_count, epsilon_spent, psi_drift_score, governance_status, audit_output
      ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;`,
      [
        result.modelId,
        result.phiLeakCount,
        result.epsilonSpentTotal,
        result.psiDriftScore,
        result.governanceStatus,
        JSON.stringify(result)
      ]
    );
    if (res.rows.length > 0) {
      result.id = res.rows[0].id;
    }
    return result;
  }
}
