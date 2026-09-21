import { pool, bootstrap } from './db';
import { ehrSandboxService } from './services/ehrSandbox';
import { v4 as uuidv4 } from 'uuid';

async function runEhrSandboxTest() {
  console.log('==================================================');
  console.log('    IntakeRx EHR Sandbox & Webhook Engine Test    ');
  console.log('==================================================\n');

  let testPatientId: number | null = null;
  const testSessionId = uuidv4();

  try {
    // 1. Verify initial seeded transactions
    console.log('1. Checking initial EHR transactions...');
    const initialTxs = ehrSandboxService.getTransactions();
    console.log(`   - Retrieved ${initialTxs.length} initial transactions:`);
    initialTxs.forEach(tx => {
      console.log(`     • [${tx.targetEhr}] ${tx.direction.toUpperCase()} ${tx.protocol} -> ${tx.messageType} (${tx.status})`);
    });

    if (initialTxs.length < 3) {
      throw new Error('Expected at least 3 initial seeded EHR transactions!');
    }

    // 2. Seed a test patient and session for sync testing
    console.log('\n2. Setting up test encounter for simulated outbound sync...');
    await bootstrap();
    const patientRes = await pool.query(
      `INSERT INTO patients (name, email, password_hash, dob, sex)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      ['Diana Prince', `diana.prince.${Date.now()}@example.com`, 'hash', '1988-03-22', 'Female']
    );
    testPatientId = patientRes.rows[0].id;

    await pool.query(
      `INSERT INTO intake_sessions (id, patient_id, status, current_step)
       VALUES ($1, $2, $3, $4)`,
      [testSessionId, testPatientId, 'completed', 'completed']
    );

    // 3. Test Outbound FHIR R4 Sync Simulation to Epic
    console.log('\n3. Simulating Outbound FHIR R4 Sync to Epic Systems...');
    const epicTx = await ehrSandboxService.simulateSync(testSessionId, 'Epic Systems', 'FHIR_R4');
    console.log(`   - Transaction ID: ${epicTx.id}`);
    console.log(`   - HTTP Status: ${epicTx.httpStatus}`);
    console.log(`   - Latency: ${epicTx.latencyMs}ms`);
    console.log(`   - Message Type: ${epicTx.messageType}`);

    if (epicTx.targetEhr !== 'Epic Systems' || epicTx.httpStatus !== 201 || !epicTx.payload) {
      throw new Error('Epic FHIR R4 sync simulation failed validation!');
    }

    // 4. Test Outbound HL7 v2 Sync Simulation to Cerner
    console.log('\n4. Simulating Outbound HL7 v2 Sync to Cerner Millennium...');
    const cernerTx = await ehrSandboxService.simulateSync(testSessionId, 'Cerner Millennium', 'HL7_V2');
    console.log(`   - Transaction ID: ${cernerTx.id}`);
    console.log(`   - Payload Snippet: ${String(cernerTx.payload).slice(0, 60)}...`);

    if (cernerTx.targetEhr !== 'Cerner Millennium' || !String(cernerTx.payload).includes('MSH|')) {
      throw new Error('Cerner HL7 v2 sync simulation failed validation!');
    }

    // 5. Test Inbound Webhook Simulation
    console.log('\n5. Simulating Inbound Hospital Webhooks...');
    
    // Webhook A: Bed Assigned
    const bedTx = ehrSandboxService.simulateWebhook('bed_assigned');
    console.log(`   - [Bed Assigned] Target: ${bedTx.targetEhr}, Type: ${bedTx.messageType}`);
    if (bedTx.payload.event !== 'encounter.bed_assigned') {
      throw new Error('Bed assigned webhook simulation failed!');
    }

    // Webhook B: STAT Lab Ready
    const labTx = ehrSandboxService.simulateWebhook('lab_ready');
    console.log(`   - [STAT Lab Ready] Result: ${labTx.payload.result}, Status: ${labTx.payload.status}`);
    if (labTx.payload.event !== 'diagnostic_report.troponin_ready') {
      throw new Error('Lab ready webhook simulation failed!');
    }

    // Webhook C: Chart Co-Signed
    const signTx = ehrSandboxService.simulateWebhook('chart_cosigned');
    console.log(`   - [Chart Co-Signed] Signer: ${signTx.payload.cosigningAttending}`);
    if (signTx.payload.event !== 'document.cosigned') {
      throw new Error('Chart cosign webhook simulation failed!');
    }

    console.log('\n✔ EHR SANDBOX & WEBHOOK DISPATCHER SUITE PASSED.');
  } catch (err) {
    console.error('\n❌ EHR Sandbox Test Failed:', err);
    process.exit(1);
  } finally {
    console.log('\nCleaning up test encounter records...');
    if (testPatientId) {
      await pool.query('DELETE FROM patients WHERE id = $1', [testPatientId]);
      console.log('Cleanup complete.');
    }
    await pool.end();
  }
}

runEhrSandboxTest();
