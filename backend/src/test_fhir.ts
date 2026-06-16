import { pool } from './db';
import { generateFhirBundle, fhirJsonToXml } from './services/fhir';
import { v4 as uuidv4 } from 'uuid';

async function runFhirTest() {
  console.log('==================================================');
  console.log('            IntakeRx FHIR Export Test             ');
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
        'Johnathan Doe',
        `john.doe.${Date.now()}@example.com`,
        'hashed_password',
        '1985-05-12',
        'Male',
        'Blue Cross Shield',
        'BCX-9988223'
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
        'urgent',
        'Patient reports moderate wheezing and shortness of breath with mild history of asthma.'
      ]
    );

    // 3. Seed mock symptoms
    console.log('3. Seeding mock symptoms...');
    await pool.query(
      `INSERT INTO symptoms (session_id, name, severity, duration, is_red_flag)
       VALUES 
         ($1, $2, $3, $4, $5),
         ($6, $7, $8, $9, $10)`,
      [
        testSessionId, 'Moderate wheezing', 'moderate', '2 days', false,
        testSessionId, 'Dry cough', 'mild', '3 days', false
      ]
    );

    // 4. Seed mock medications
    console.log('4. Seeding mock medications...');
    await pool.query(
      `INSERT INTO medications (session_id, name, dosage, frequency)
       VALUES ($1, $2, $3, $4)`,
      [testSessionId, 'Albuterol Inhaler', '2 puffs', 'every 4 hours as needed']
    );

    // 5. Seed mock SOAP summary
    console.log('5. Seeding mock SOAP summary...');
    const soapSummary = {
      chiefComplaint: 'Moderate wheezing and cough',
      historyOfPresentIllness: 'Patient is a 41-year-old male reporting moderate wheezing for 2 days. Symptoms are worse in the evening.',
      pastMedicalHistory: 'Childhood asthma, last attack 10 years ago.',
      allergies: ['Penicillin'],
      medications: [{ name: 'Albuterol Inhaler', dosage: '2 puffs', frequency: 'every 4 hours as needed' }],
      assessment: 'Provisional asthma exacerbation, urgent care indicated.',
      plan: 'Advised client to visit urgent care clinic. Continue Albuterol as prescribed.'
    };
    await pool.query(
      `INSERT INTO intake_summaries (session_id, summary_data, status)
       VALUES ($1, $2, $3)`,
      [testSessionId, JSON.stringify(soapSummary), 'pending']
    );

    // 6. Generate FHIR JSON Bundle
    console.log('\n6. Generating FHIR JSON Bundle...');
    const fhirBundle = await generateFhirBundle(testSessionId);
    
    // Assert structural requirements
    console.log('Checking JSON Bundle properties:');
    console.log(`- ResourceType: ${fhirBundle.resourceType} (Expected: Bundle)`);
    console.log(`- Bundle Type: ${fhirBundle.type} (Expected: collection)`);
    console.log(`- Total Entry Count: ${fhirBundle.entry.length} (Expected: 6 -> 1 Patient, 1 Coverage, 2 Conditions, 1 MedicationStatement, 1 DocumentReference)`);
    
    if (fhirBundle.resourceType !== 'Bundle' || fhirBundle.entry.length !== 6) {
      throw new Error('FHIR JSON Bundle structure is invalid!');
    }
    console.log('\x1b[32m✔ JSON Bundle Validation Passed!\x1b[0m');

    // Check specific resources inside entries
    const resources = fhirBundle.entry.map((e: any) => e.resource);
    const patient = resources.find((r: any) => r.resourceType === 'Patient');
    const coverage = resources.find((r: any) => r.resourceType === 'Coverage');
    const conditions = resources.filter((r: any) => r.resourceType === 'Condition');
    const medStatement = resources.find((r: any) => r.resourceType === 'MedicationStatement');
    const docRef = resources.find((r: any) => r.resourceType === 'DocumentReference');

    console.log('\nValidating Mapped Fields:');
    console.log(`- Patient Gender: ${patient.gender} (Expected: male)`);
    console.log(`- Patient Birthdate: ${patient.birthDate} (Expected: 1985-05-12)`);
    console.log(`- Coverage Subscriber: ${coverage.subscriber.reference} (Expected: Patient/pat-${testPatientId})`);
    console.log(`- Coverage Payor: ${coverage.payor[0].display} (Expected: Blue Cross Shield)`);
    console.log(`- Mapped Conditions Count: ${conditions.length} (Expected: 2)`);
    console.log(`- Medication Name: ${medStatement.medicationCodeableConcept.text} (Expected: Albuterol Inhaler)`);
    console.log(`- Document Base64 attachment length: ${docRef.content[0].attachment.data.length} chars`);

    // 7. Generate FHIR XML
    console.log('\n7. Generating FHIR XML Serialized Output...');
    const fhirXml = fhirJsonToXml(fhirBundle);

    console.log('Checking XML schema:');
    console.log(`- XML Declaration present: ${fhirXml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')}`);
    console.log(`- Root Bundle element with namespace present: ${fhirXml.includes('<Bundle xmlns="http://hl7.org/fhir">')}`);
    console.log(`- Patient resource tag nested in entry resource container: ${fhirXml.includes('<resource><Patient>')}`);
    console.log(`- End tag </Bundle> present: ${fhirXml.endsWith('</Bundle>')}`);

    if (
      !fhirXml.startsWith('<?xml version="1.0" encoding="UTF-8"?>') ||
      !fhirXml.includes('<Bundle xmlns="http://hl7.org/fhir">') ||
      !fhirXml.includes('<resource><Patient>') ||
      !fhirXml.endsWith('</Bundle>')
    ) {
      throw new Error('FHIR XML Serialization failed validation constraints!');
    }
    console.log('\x1b[32m✔ XML Schema Validation Passed!\x1b[0m');
    
    console.log('\nXML Payload Preview (First 500 chars):');
    console.log('--------------------------------------------------');
    console.log(fhirXml.substring(0, 500) + '\n...');
    console.log('--------------------------------------------------');

    console.log('\n\x1b[32m✔ ALL FHIR EXPORT TESTS PASSED SUCCESSFULLY.\x1b[0m');

  } catch (err) {
    console.error('\n\x1b[31m✘ FHIR TEST FAILED:\x1b[0m', err);
    process.exit(1);
  } finally {
    // Clean up seeded database entries
    console.log('\n8. Cleaning up test DB entries...');
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

runFhirTest();
