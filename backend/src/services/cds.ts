import { pool } from '../db';

export interface CareGapAlert {
  conditionName: string;
  type: 'missing_therapy' | 'contraindicated_therapy';
  severity: 'high' | 'moderate' | 'info';
  message: string;
  recommendedProtocol: string;
}

export class CDSService {
  static async analyzeSession(sessionId: string): Promise<CareGapAlert[]> {
    const alerts: CareGapAlert[] = [];

    try {
      // 1. Fetch session symptoms (current conditions)
      const symptomsRes = await pool.query(
        `SELECT name FROM symptoms WHERE session_id = $1`,
        [sessionId]
      );
      const symptoms = symptomsRes.rows.map(r => r.name.toLowerCase());

      // 2. Fetch session medications
      const medsRes = await pool.query(
        `SELECT name FROM medications WHERE session_id = $1`,
        [sessionId]
      );
      const medications = medsRes.rows.map(r => r.name.toLowerCase());

      // 3. Fetch all clinical guidelines
      const guidelinesRes = await pool.query(
        `SELECT condition_name as "conditionName", recommended_protocol as "recommendedProtocol", required_meds as "requiredMeds", contraindicated_meds as "contraindicatedMeds"
         FROM clinical_guidelines`
      );

      for (const rule of guidelinesRes.rows) {
        const conditionLower = rule.conditionName.toLowerCase();
        
        // Match condition name with symptom names
        const hasCondition = symptoms.some(s => s.includes(conditionLower) || conditionLower.includes(s));

        if (hasCondition) {
          const requiredMeds = (rule.requiredMeds || []).map((m: string) => m.toLowerCase());
          const contraindicatedMeds = (rule.contraindicatedMeds || []).map((m: string) => m.toLowerCase());

          // Check 1: Contraindicated therapy
          const takenContraindicated = medications.filter(m => 
            contraindicatedMeds.some((cm: string) => m.includes(cm) || cm.includes(m))
          );

          for (const badMed of takenContraindicated) {
            alerts.push({
              conditionName: rule.conditionName,
              type: 'contraindicated_therapy',
              severity: 'high',
              message: `Contraindication Flagged: Patient has ${rule.conditionName} symptoms and is taking contraindicated medication "${badMed}".`,
              recommendedProtocol: rule.recommendedProtocol
            });
          }

          // Check 2: Missing therapy (Care Gap)
          const isTakingRecommended = medications.some(m =>
            requiredMeds.some((rm: string) => m.includes(rm) || rm.includes(m))
          );

          if (!isTakingRecommended && requiredMeds.length > 0) {
            alerts.push({
              conditionName: rule.conditionName,
              type: 'missing_therapy',
              severity: 'moderate',
              message: `Clinical Care Gap: Patient has ${rule.conditionName} symptoms but is NOT taking any guideline-recommended therapy (${rule.requiredMeds.join(', ')}).`,
              recommendedProtocol: rule.recommendedProtocol
            });
          }
        }
      }
    } catch (err) {
      console.error('Error analyzing care gaps:', err);
    }

    return alerts;
  }
}
