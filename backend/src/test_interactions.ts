import { pool } from './db';
import { v4 as uuidv4 } from 'uuid';

async function runInteractionsTest() {
  console.log('==================================================');
  console.log('       IntakeRx Clinical Interactions Test        ');
  console.log('==================================================\n');

  const testSessionId = uuidv4();
  let testPatientId: number | null = null;

  try {
    // 1. Seed a mock patient
    console.log('1. Seeding mock patient...');
    const patientRes = await pool.query(
      `INSERT INTO patients (name, email, password_hash, dob, sex, insurance_provider, insurance_policy)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        'Jane Doe',
        `jane.doe.${Date.now()}@example.com`,
        'hashed_password',
        '1990-08-20',
        'Female',
        'Cigna',
        'CG-7766551'
      ]
    );
    testPatientId = patientRes.rows[0].id;

    // 2. Seed a mock session
    console.log('2. Seeding mock session...');
    await pool.query(
      `INSERT INTO intake_sessions (id, patient_id, status, current_step, triage_level, triage_rationale)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        testSessionId,
        testPatientId,
        'completed',
        'completed',
        'routine',
        'Routine review for medication refill.'
      ]
    );

    // 3. Seed conflicting active medications: Lisinopril and Spironolactone
    console.log('3. Seeding conflicting medications (Lisinopril + Spironolactone)...');
    await pool.query(
      `INSERT INTO medications (session_id, name, dosage, frequency)
       VALUES 
         ($1, $2, $3, $4),
         ($5, $6, $7, $8),
         ($9, $10, $11, $12)`,
      [
        testSessionId, 'Lisinopril 10mg', '1 tablet', 'daily',
        testSessionId, 'Spironolactone 25mg', '1 tablet', 'daily',
        testSessionId, 'Amoxicillin 500mg', '1 capsule', 'three times daily'
      ]
    );

    // 4. Seed mock SOAP summary with conflicting Penicillin allergy
    console.log('4. Seeding Penicillin allergy in SOAP summary...');
    const soapSummary = {
      chiefComplaint: 'Routine blood pressure review',
      historyOfPresentIllness: 'Patient requests refills of daily meds.',
      pastMedicalHistory: 'Hypertension, acne.',
      allergies: ['Penicillin', 'Dust mites'],
      medications: [
        { name: 'Lisinopril 10mg', dosage: '1 tablet', frequency: 'daily' },
        { name: 'Spironolactone 25mg', dosage: '1 tablet', frequency: 'daily' },
        { name: 'Amoxicillin 500mg', dosage: '1 capsule', frequency: 'three times daily' }
      ]
    };
    await pool.query(
      `INSERT INTO intake_summaries (session_id, summary_data, status)
       VALUES ($1, $2, $3)`,
      [testSessionId, JSON.stringify(soapSummary), 'pending']
    );

    // 5. Evaluate interactions (Query the same business logic as the endpoint)
    console.log('\n5. Evaluating Clinical Alerts...');

    // Fetch meds
    const medsRes = await pool.query(
      'SELECT name FROM medications WHERE session_id = $1',
      [testSessionId]
    );

    // Fetch summary
    const summaryRes = await pool.query(
      'SELECT summary_data as "summaryData" FROM intake_summaries WHERE session_id = $1',
      [testSessionId]
    );

    const activeMeds: string[] = medsRes.rows.map(m => m.name);
    const activeAllergies: string[] = [];

    if (summaryRes.rows.length > 0 && summaryRes.rows[0].summaryData) {
      const soap = summaryRes.rows[0].summaryData;
      if (Array.isArray(soap.medications)) {
        soap.medications.forEach((med: any) => {
          const medName = typeof med === 'string' ? med : med.name;
          if (medName && !activeMeds.some(m => m.toLowerCase() === medName.toLowerCase())) {
            activeMeds.push(medName);
          }
        });
      }
      if (Array.isArray(soap.allergies)) {
        soap.allergies.forEach((allergy: any) => {
          if (typeof allergy === 'string' && allergy) {
            activeAllergies.push(allergy);
          }
        });
      }
    }

    // Fetch rules
    const rulesRes = await pool.query(
      'SELECT id, rule_type as "ruleType", trigger_item as "triggerItem", conflict_item as "conflictItem", severity, description FROM interaction_rules'
    );

    const alerts: any[] = [];

    rulesRes.rows.forEach(rule => {
      const triggerLower = rule.triggerItem.toLowerCase();
      const conflictLower = rule.conflictItem.toLowerCase();

      if (rule.ruleType === 'drug_drug') {
        const hasTrigger = activeMeds.some(med => med.toLowerCase().includes(triggerLower));
        const hasConflict = activeMeds.some(med => med.toLowerCase().includes(conflictLower));
        if (hasTrigger && hasConflict) {
          alerts.push({
            ruleId: rule.id,
            ruleType: 'drug_drug',
            severity: rule.severity,
            triggerItem: rule.triggerItem,
            conflictItem: rule.conflictItem,
            description: rule.description
          });
        }
      } else if (rule.ruleType === 'drug_allergy') {
        const hasTrigger = activeMeds.some(med => med.toLowerCase().includes(triggerLower));
        const hasAllergyConflict = activeAllergies.some(allergy => allergy.toLowerCase().includes(conflictLower));
        if (hasTrigger && hasAllergyConflict) {
          alerts.push({
            ruleId: rule.id,
            ruleType: 'drug_allergy',
            severity: rule.severity,
            triggerItem: rule.triggerItem,
            conflictItem: rule.conflictItem,
            description: rule.description
          });
        }
      }
    });

    // Verify warnings count and properties
    console.log('Checking Interaction Warnings:');
    console.log(`- Total Alerts Flagged: ${alerts.length} (Expected: 2)`);
    
    const drugDrugAlert = alerts.find(a => a.ruleType === 'drug_drug');
    const drugAllergyAlert = alerts.find(a => a.ruleType === 'drug_allergy');

    console.log(`- Drug-Drug Alert triggered: ${drugDrugAlert ? 'YES' : 'NO'}`);
    console.log(`  Items: ${drugDrugAlert?.triggerItem} + ${drugDrugAlert?.conflictItem}`);
    console.log(`  Severity: ${drugDrugAlert?.severity} (Expected: high)`);
    console.log(`  Description: ${drugDrugAlert?.description}`);

    console.log(`- Drug-Allergy Alert triggered: ${drugAllergyAlert ? 'YES' : 'NO'}`);
    console.log(`  Items: Allergen ${drugAllergyAlert?.conflictItem} vs Med ${drugAllergyAlert?.triggerItem}`);
    console.log(`  Severity: ${drugAllergyAlert?.severity} (Expected: high)`);
    console.log(`  Description: ${drugAllergyAlert?.description}`);

    if (alerts.length !== 2) {
      throw new Error('Incorrect number of alerts flagged!');
    }
    if (!drugDrugAlert || drugDrugAlert.severity !== 'high') {
      throw new Error('Drug-Drug alert check failed!');
    }
    if (!drugAllergyAlert || drugAllergyAlert.severity !== 'high') {
      throw new Error('Drug-Allergy alert check failed!');
    }

    console.log('\n\x1b[32m✔ CLINICAL DECISION SUPPORT WARNINGS TESTS PASSED SUCCESSFULLY.\x1b[0m');

  } catch (err) {
    console.error('\n\x1b[31m✘ INTERACTIONS TEST FAILED:\x1b[0m', err);
    process.exit(1);
  } finally {
    // Clean up seeded database entries
    console.log('\n6. Cleaning up test DB entries...');
    try {
      if (testPatientId !== null) {
        await pool.query('DELETE FROM patients WHERE id = $1', [testPatientId]);
      }
      console.log('Cleanup complete.');
    } catch (cleanErr) {
      console.error('Error during database cleanup:', cleanErr);
    }
    await pool.end();
  }
}

runInteractionsTest();
