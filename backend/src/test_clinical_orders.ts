import { pool, bootstrap } from './db';
import { ClinicalOrdersService } from './services/clinicalOrders';
import { v4 as uuidv4 } from 'uuid';

async function runClinicalOrdersTest() {
  console.log('====================================================');
  console.log('  IntakeRx Smart Clinical Orders & LOINC Test       ');
  console.log('====================================================\n');

  let testPatientId: number | null = null;
  const testSessionId = uuidv4();

  try {
    await bootstrap();

    // 1. Setup Patient and Encounter
    console.log('1. Setting up test patient and cardiac encounter...');
    const patientRes = await pool.query(
      `INSERT INTO patients (name, email, password_hash, dob, sex)
       VALUES ($1, $2, 'dummyhash', '1968-11-04', 'Male')
       RETURNING id`,
      ['Howard Vance', `howard.${Date.now()}@example.com`]
    );
    testPatientId = patientRes.rows[0].id;

    await pool.query(
      `INSERT INTO intake_sessions (id, patient_id, status, triage_level, current_step)
       VALUES ($1, $2, 'active', 'emergency', 'complaint')`,
      [testSessionId, testPatientId]
    );

    await pool.query(
      `INSERT INTO messages (session_id, sender, content)
       VALUES ($1, 'patient', 'Severe substernal crushing chest pain radiating to left arm with diaphoresis.')`,
      [testSessionId]
    );

    await pool.query(
      `INSERT INTO symptoms (session_id, name, severity, duration, is_red_flag)
       VALUES ($1, 'Crushing substernal chest pain', 'severe', '1 hour', true)`,
      [testSessionId]
    );
    console.log(`   ✔ Encounter initialized [ID: ${testSessionId.slice(0, 8)}]`);

    // 2. Generate Smart Diagnostic Order Suggestions
    console.log('\n2. Generating Smart Diagnostic Order Suggestions...');
    const suggestions = await ClinicalOrdersService.suggestOrders(testSessionId);
    console.log(`   - Generated ${suggestions.length} order recommendations:`);

    suggestions.forEach(s => {
      console.log(`     • [${s.codeSystem} ${s.code}] ${s.displayName} (${s.urgency.toUpperCase()})`);
      console.log(`       Indication: ${s.clinicalIndication}`);
    });

    const hasTroponin = suggestions.some(s => s.code === '49563-0' && s.urgency === 'stat');
    const hasEKG = suggestions.some(s => s.code === '8601-7');
    const hasChestXRay = suggestions.some(s => s.code === '30746-2');

    if (!hasTroponin || !hasEKG || !hasChestXRay) {
      throw new Error('Expected cardiac suggestions to include Troponin I (STAT), 12-Lead EKG, and Chest X-Ray!');
    }
    console.log('   ✔ Accurate LOINC diagnostic recommendations generated.');

    // 3. Place Batch Clinical Orders
    console.log('\n3. Placing Approved Batch Clinical Orders...');
    const approvedOrders = await ClinicalOrdersService.createBatchOrders(testSessionId, suggestions.slice(0, 3));
    console.log(`   - Successfully committed ${approvedOrders.length} orders to database.`);

    if (approvedOrders.length !== 3) {
      throw new Error(`Expected 3 orders created, got ${approvedOrders.length}`);
    }

    // 4. Retrieve Orders from Database
    console.log('\n4. Verifying Orders Retrieval...');
    const retrieved = await ClinicalOrdersService.getOrdersForSession(testSessionId);
    if (retrieved.length !== 3) {
      throw new Error(`Expected 3 retrieved orders, got ${retrieved.length}`);
    }
    console.log(`   - Stored Order #1: ${retrieved[0].displayName} [Status: ${retrieved[0].status}]`);

    // 5. Export Standard HL7 FHIR R4 ServiceRequest Bundle
    console.log('\n5. Generating HL7 FHIR R4 ServiceRequest Bundle...');
    const fhirBundle = await ClinicalOrdersService.exportFhirServiceRequests(testSessionId);

    console.log(`   - FHIR ResourceType: ${fhirBundle.resourceType}`);
    console.log(`   - Bundle Type: ${fhirBundle.type}`);
    console.log(`   - Total ServiceRequest Entries: ${fhirBundle.entry.length}`);

    if (fhirBundle.resourceType !== 'Bundle' || fhirBundle.entry.length !== 3) {
      throw new Error('Invalid FHIR ServiceRequest bundle structure');
    }

    const firstEntry = fhirBundle.entry[0].resource;
    console.log(`   - First ServiceRequest: ${firstEntry.code.text} [LOINC: ${firstEntry.code.coding[0].code}]`);
    console.log(`   - Subject: ${firstEntry.subject.display}`);
    console.log(`   - Priority: ${firstEntry.priority}`);

    if (firstEntry.code.coding[0].system !== 'http://loinc.org') {
      throw new Error('Expected LOINC coding system in FHIR ServiceRequest');
    }

    console.log('\n✔ SMART CLINICAL ORDERS & LOINC REQUISITIONS TEST PASSED 100%!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Clinical orders test failed:', err);
    process.exit(1);
  } finally {
    console.log('Cleaning up test data...');
    if (testPatientId) {
      await pool.query(`DELETE FROM patients WHERE id = $1`, [testPatientId]);
    }
    await pool.end();
  }
}

runClinicalOrdersTest();
