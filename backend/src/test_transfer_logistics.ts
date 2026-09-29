import { pool, bootstrap } from './db';
import { transferLogisticsService } from './services/transferLogistics';

async function runTransferLogisticsTest() {
  console.log('====================================================');
  console.log('  IntakeRx Phase 40: Transfer Logistics & EMTALA    ');
  console.log('====================================================\n');

  try {
    console.log('Initializing database bootstrap...');
    await bootstrap();

    // 1. Setup Patient and Session
    console.log('1. Setting up Critical Care Transfer Patient...');
    const patientEmail = `transfer.patient.${Date.now()}@example.com`;
    const patientRes = await pool.query(`
      INSERT INTO patients (name, email, password_hash, dob, sex)
      VALUES ('Franklin Miller', $1, 'hash_pass', '1962-09-18', 'Male')
      RETURNING id, name;
    `, [patientEmail]);
    const patient = patientRes.rows[0];

    const sessionRes = await pool.query(`
      INSERT INTO intake_sessions (id, patient_id, status, triage_level, triage_rationale)
      VALUES (gen_random_uuid(), $1, 'active', 'emergency', 'Acute Left MCA Large Vessel Occlusion - NIHSS 18')
      RETURNING id;
    `, [patient.id]);
    const session = sessionRes.rows[0];

    console.log(`   ✔ Critical Patient Created [ID: ${patient.id}, Name: ${patient.name}]`);
    console.log(`   ✔ Encounter Session Initialized [UUID: ${session.id.substring(0, 8)}]`);

    // 2. Query Bed Inventory Pre-Transfer
    console.log('\n2. Inspecting Receiving Hospital Bed Inventory...');
    const initialBeds = await transferLogisticsService.getBedInventory();
    console.log(`   ✔ Total Tracked Beds: ${initialBeds.metrics.total}`);
    console.log(`   ✔ Available Capacity: ${initialBeds.metrics.available} beds`);
    console.log(`   ✔ Current Occupancy: ${initialBeds.metrics.occupancyPercent}%`);

    if (initialBeds.beds.length === 0) {
      throw new Error('Expected bed inventory to be seeded with initial ICU/telemetry beds');
    }

    // 3. Initiate STAT Emergent Inter-Facility Transfer
    console.log('\n3. Creating STAT Emergent Inter-Facility Transfer Request...');
    const transferReq = await transferLogisticsService.createTransferRequest({
      patientId: patient.id,
      sessionId: session.id,
      sendingFacility: 'Valley Community Hospital ED',
      receivingFacility: 'Metropolitan Medical Center Comprehensive Stroke Center',
      serviceNeeded: 'neuro_interventional_stroke',
      urgencyLevel: 'stat_emergent',
      sendingPhysicianName: 'Dr. Raymond Adams, MD (ED Attending)',
      clinicalRationale: 'Acute left M1 cutoff verified on CTA. Onset 75 min ago. tPA infused; candidate for emergent mechanical thrombectomy.',
      transportMode: 'rotor_air_ambulance'
    });

    console.log(`   ✔ Transfer Request Created: ID = #${transferReq.id}`);
    console.log(`   ✔ Urgency: ${transferReq.urgencyLevel}`);
    console.log(`   ✔ Matched Bed Assigned ID: ${transferReq.bedAssignedId}`);
    console.log(`   ✔ EMTALA Pre-Compliance Status: ${transferReq.emtalaComplianceStatus}`);

    if (transferReq.emtalaComplianceStatus !== 'pending_acceptance') {
      throw new Error('Expected initial EMTALA status to be pending_acceptance');
    }

    // 4. Receiving Physician Acceptance (EMTALA Safe Harbor)
    console.log('\n4. Executing Receiving Physician Acceptance & EMTALA Sign-Off...');
    const acceptedReq = await transferLogisticsService.acceptTransfer(
      transferReq.id,
      'Dr. Sarah Chen, MD (Neuro-Interventionalist)',
      transferReq.bedAssignedId || undefined
    );

    console.log(`   ✔ Transfer Accepted: Status = ${acceptedReq.status}`);
    console.log(`   ✔ Receiving Physician: ${acceptedReq.receivingPhysicianName}`);
    console.log(`   ✔ EMTALA Compliance: ${acceptedReq.emtalaComplianceStatus} (Expected: compliant_accepted)`);

    if (acceptedReq.emtalaComplianceStatus !== 'compliant_accepted') {
      throw new Error('Expected EMTALA status to be compliant_accepted');
    }

    // Verify bed is reserved in inventory
    const reservedBedRes = await pool.query('SELECT * FROM hospital_bed_inventory WHERE id = $1', [acceptedReq.bedAssignedId]);
    console.log(`   ✔ Bed Status in Inventory: ${reservedBedRes.rows[0].status} (Expected: reserved_inbound)`);

    if (reservedBedRes.rows[0].status !== 'reserved_inbound') {
      throw new Error('Expected bed status to be reserved_inbound');
    }

    // 5. Dispatch Medevac Rotor Air Ambulance
    console.log('\n5. Dispatching Medevac Rotor Air Ambulance...');
    const dispatchedReq = await transferLogisticsService.dispatchTransport(
      transferReq.id,
      'rotor_air_ambulance',
      18 // ETA 18 minutes
    );

    console.log(`   ✔ Transport Dispatched: Mode = ${dispatchedReq.transportMode}, ETA = ${dispatchedReq.transportEtaMinutes} mins`);
    console.log(`   ✔ Transfer Lifecycle Status: ${dispatchedReq.status} (Expected: en_route)`);

    if (dispatchedReq.status !== 'en_route') {
      throw new Error('Expected status to be en_route');
    }

    // 6. Complete Transfer (Arrival at Receiving Facility)
    console.log('\n6. Completing Transfer upon Patient Arrival at Angiography Suite...');
    const completedReq = await transferLogisticsService.completeTransfer(transferReq.id);

    console.log(`   ✔ Transfer Status: ${completedReq.status} (Expected: arrived)`);

    const occupiedBedRes = await pool.query('SELECT * FROM hospital_bed_inventory WHERE id = $1', [acceptedReq.bedAssignedId]);
    console.log(`   ✔ Final Bed Status: ${occupiedBedRes.rows[0].status} (Expected: occupied)`);
    console.log(`   ✔ Assigned Patient on Bed: ${occupiedBedRes.rows[0].assigned_patient_name}`);

    if (occupiedBedRes.rows[0].status !== 'occupied') {
      throw new Error('Expected bed status to be occupied upon patient arrival');
    }

    // 7. Query Active Queue and Bed Telemetry
    console.log('\n7. Querying Central Transfer Center Dashboard Queue...');
    const allTransfers = await transferLogisticsService.getTransferRequests();
    console.log(`   ✔ Total Transfer Records: ${allTransfers.length}`);

    const finalBeds = await transferLogisticsService.getBedInventory();
    console.log(`   ✔ Final Available Beds: ${finalBeds.metrics.available}`);
    console.log(`   ✔ Final Occupancy: ${finalBeds.metrics.occupancyPercent}%`);

    console.log('\n====================================================');
    console.log('  Phase 40 Test Passed: 100% SUCCESS               ');
    console.log('====================================================\n');
  } catch (err) {
    console.error('\n❌ Test failed with error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTransferLogisticsTest();
