import { query } from '../db';

export interface CanonicalMedication {
  name: string;
  dose: string;
  unit: string;
  route: string;
}

export interface HandoffVerificationInput {
  patientId: number;
  canonicalRecord: {
    codeStatus: 'FULL_CODE' | 'DNR' | 'DNI' | 'DNR_DNI';
    allergies: string[];
    activeMedications: CanonicalMedication[];
    pendingCriticalLabs: string[];
    latestMapMmhg: number;
  };
  proposedHandoff: {
    codeStatus: string;
    allergies: string[];
    activeMedications: CanonicalMedication[];
    pendingCriticalLabs: string[];
    reportedMapMmhg: number;
    contingencyPlan: string;
  };
}

export interface HandoffDiscrepancy {
  category:
    | 'CODE_STATUS_MISMATCH'
    | 'OMITTED_ALLERGY'
    | 'OMITTED_MEDICATION'
    | 'HALLUCINATED_MEDICATION'
    | 'DOSE_OR_UNIT_ERROR'
    | 'OMITTED_PENDING_LAB'
    | 'VITAL_SIGN_FABRICATION'
    | 'MISSING_CONTINGENCY_PLAN';
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE';
  field: string;
  canonicalValue: string;
  handoffValue: string;
  rationale: string;
}

export interface HandoffVerificationResult {
  id?: number;
  patientId: number;
  safetyIntegrityScore: number;
  verificationStatus: 'VERIFIED_SAFE' | 'NEEDS_REVIEW' | 'BLOCKED_CRITICAL_DISCREPANCY';
  discrepancyCount: number;
  discrepancies: HandoffDiscrepancy[];
  safeToSignOut: boolean;
}

export class HandoffHallucinationGuardService {
  public static verifyHandoff(input: HandoffVerificationInput): HandoffVerificationResult {
    const discrepancies: HandoffDiscrepancy[] = [];
    let score = 100;

    const { canonicalRecord: canon, proposedHandoff: handoff } = input;

    // 1. Code Status Check
    if (canon.codeStatus.toUpperCase() !== handoff.codeStatus.trim().toUpperCase()) {
      score -= 40;
      discrepancies.push({
        category: 'CODE_STATUS_MISMATCH',
        severity: 'CRITICAL',
        field: 'codeStatus',
        canonicalValue: canon.codeStatus,
        handoffValue: handoff.codeStatus,
        rationale: 'Code status mismatch poses immediate life-safety / unwanted resuscitation hazard.'
      });
    }

    // 2. Allergy Omission Check
    const handoffAllergiesNorm = handoff.allergies.map(a => a.trim().toLowerCase());
    for (const allergy of canon.allergies) {
      if (!handoffAllergiesNorm.includes(allergy.trim().toLowerCase())) {
        score -= 25;
        discrepancies.push({
          category: 'OMITTED_ALLERGY',
          severity: 'CRITICAL',
          field: 'allergies',
          canonicalValue: allergy,
          handoffValue: 'OMITTED',
          rationale: `Canonical allergy "${allergy}" omitted from shift handoff.`
        });
      }
    }

    // 3. Medication Reconciliation (Omissions, Hallucinations, Dose/Unit Errors)
    const canonMedMap = new Map<string, CanonicalMedication>();
    for (const m of canon.activeMedications) {
      canonMedMap.set(m.name.trim().toLowerCase(), m);
    }

    const handoffMedMap = new Map<string, CanonicalMedication>();
    for (const m of handoff.activeMedications) {
      handoffMedMap.set(m.name.trim().toLowerCase(), m);
    }

    for (const [key, canonMed] of canonMedMap.entries()) {
      const hm = handoffMedMap.get(key);
      if (!hm) {
        score -= 20;
        discrepancies.push({
          category: 'OMITTED_MEDICATION',
          severity: 'CRITICAL',
          field: `activeMedications.${canonMed.name}`,
          canonicalValue: `${canonMed.dose} ${canonMed.unit} ${canonMed.route}`,
          handoffValue: 'OMITTED',
          rationale: `Active medication ${canonMed.name} missing from handoff summary.`
        });
      } else {
        const unitMismatch = canonMed.unit.trim().toLowerCase() !== hm.unit.trim().toLowerCase();
        const doseMismatch = canonMed.dose.trim().toLowerCase() !== hm.dose.trim().toLowerCase();
        if (unitMismatch || doseMismatch) {
          score -= 30;
          discrepancies.push({
            category: 'DOSE_OR_UNIT_ERROR',
            severity: 'CRITICAL',
            field: `activeMedications.${canonMed.name}`,
            canonicalValue: `${canonMed.dose} ${canonMed.unit} ${canonMed.route}`,
            handoffValue: `${hm.dose} ${hm.unit} ${hm.route}`,
            rationale: unitMismatch
              ? `DANGEROUS UNIT MISMATCH (${canonMed.unit} vs ${hm.unit}) — potential 1000x dosing error.`
              : `Medication dose discrepancy (${canonMed.dose} vs ${hm.dose}).`
          });
        }
      }
    }

    for (const [key, hm] of handoffMedMap.entries()) {
      if (!canonMedMap.has(key)) {
        score -= 25;
        discrepancies.push({
          category: 'HALLUCINATED_MEDICATION',
          severity: 'CRITICAL',
          field: `activeMedications.${hm.name}`,
          canonicalValue: 'NOT_ORDERED',
          handoffValue: `${hm.dose} ${hm.unit} ${hm.route}`,
          rationale: `Medication "${hm.name}" appears in handoff but is NOT present in canonical MAR.`
        });
      }
    }

    // 4. Pending Critical Labs Check
    const handoffLabsNorm = handoff.pendingCriticalLabs.map(l => l.trim().toLowerCase());
    for (const lab of canon.pendingCriticalLabs) {
      if (!handoffLabsNorm.includes(lab.trim().toLowerCase())) {
        score -= 10;
        discrepancies.push({
          category: 'OMITTED_PENDING_LAB',
          severity: 'MODERATE',
          field: 'pendingCriticalLabs',
          canonicalValue: lab,
          handoffValue: 'OMITTED',
          rationale: `Pending critical action/lab "${lab}" omitted from handoff action list.`
        });
      }
    }

    // 5. Hemodynamic Vital Sign Drift Check
    if (Math.abs(canon.latestMapMmhg - handoff.reportedMapMmhg) > 10) {
      score -= 15;
      discrepancies.push({
        category: 'VITAL_SIGN_FABRICATION',
        severity: 'HIGH',
        field: 'reportedMapMmhg',
        canonicalValue: `${canon.latestMapMmhg} mmHg`,
        handoffValue: `${handoff.reportedMapMmhg} mmHg`,
        rationale: `Reported MAP deviates by >10 mmHg from latest canonical arterial line telemetry.`
      });
    }

    // 6. Contingency Plan Check
    if (!handoff.contingencyPlan || handoff.contingencyPlan.trim().length < 15) {
      score -= 10;
      discrepancies.push({
        category: 'MISSING_CONTINGENCY_PLAN',
        severity: 'MODERATE',
        field: 'contingencyPlan',
        canonicalValue: 'Actionable "If/Then" contingency required',
        handoffValue: handoff.contingencyPlan || 'EMPTY',
        rationale: 'I-PASS Situation Awareness requires explicit "If/Then" escalation instructions.'
      });
    }

    const safetyIntegrityScore = Math.max(0, score);
    const hasCritical = discrepancies.some(d => d.severity === 'CRITICAL');
    const verificationStatus = hasCritical
      ? 'BLOCKED_CRITICAL_DISCREPANCY'
      : discrepancies.length > 0
      ? 'NEEDS_REVIEW'
      : 'VERIFIED_SAFE';

    return {
      patientId: input.patientId,
      safetyIntegrityScore,
      verificationStatus,
      discrepancyCount: discrepancies.length,
      discrepancies,
      safeToSignOut: verificationStatus === 'VERIFIED_SAFE'
    };
  }

  public static async recordVerification(input: HandoffVerificationInput): Promise<HandoffVerificationResult> {
    const result = this.verifyHandoff(input);
    const res = await query(
      `INSERT INTO handoff_verification_audits (
        patient_id, safety_integrity_score, verification_status, discrepancy_count, audit_report
      ) VALUES ($1, $2, $3, $4, $5) RETURNING id;`,
      [
        result.patientId,
        result.safetyIntegrityScore,
        result.verificationStatus,
        result.discrepancyCount,
        JSON.stringify(result)
      ]
    );
    if (res.rows.length > 0) {
      result.id = res.rows[0].id;
    }
    return result;
  }
}
