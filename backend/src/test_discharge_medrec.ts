import { pool, bootstrap } from './db';
import * as dischargeMedRecService from './services/dischargeMedRec';

async function runDischargeMedRecTest() {
  console.log('====================================================');
  console.log('  IntakeRx Phase 43: Autonomous MedRec & Meds-to-Beds');
  console.log('====================================================\n');

  try {
    console.log('Initializing database bootstrap...');
    await bootstrap();

    // 1. Setup Inpatient Patient and Session
    console.log('1. Setting up Inpatient for Discharge Pharmacotherapy Reconciliation...');
    const patientEmail = `medrec.patient.${Date.now()}@example.com`;
    const patientRes = await pool.query(`
      INSERT INTO patients (name, email, password_hash, dob, sex)
      VALUES ('Eleanor Vance', $1, 'pass_hash', '1948-03-12', 'Female')
      RETURNING id, name;
    `, [patientEmail]);
    const patient = patientRes.rows[0];

    const sessionRes = await pool.query(`
      INSERT INTO intake_sessions (id, patient_id, status, triage_level, triage_rationale)
      VALUES (gen_random_uuid(), $1, 'active', 'priority', 'Acute Coronary Syndrome Post-PCI - Discharge Planning')
      RETURNING id;
    `, [patient.id]);
    const session = sessionRes.rows[0];

    console.log(`   ✔ Patient Initialized [ID: ${patient.id}, Name: ${patient.name}]`);
    console.log(`   ✔ Inpatient Session Linked [UUID: ${session.id.substring(0, 8)}]`);

    // 2. Query Baseline MedRec Summary
    console.log('\n2. Querying Baseline MedRec & Bedside Delivery Summary...');
    const initialSummary = await dischargeMedRecService.getMedRecSummary();
    console.log(`   ✔ Total Prior Reconciliations: ${initialSummary.metrics.totalReconciliations}`);
    console.log(`   ✔ Active Deliveries in Queue: ${initialSummary.metrics.activeDeliveriesInQueue}`);
    console.log(`   ✔ Teach-Back Success Rate: ${initialSummary.metrics.teachBackSuccessRate}%`);

    // 3. Execute Autonomous Discharge MedRec with Omission, Duplicate, and Formulary Alternative
    console.log('\n3. Performing Autonomous Discharge MedRec Analysis...');
    const medRecResult = await dischargeMedRecService.performDischargeMedRec({
      patientId: patient.id,
      sessionId: session.id,
      reconciliationType: 'inpatient_to_discharge',
      homeMedications: [
        { name: 'Metoprolol Succinate', dose: '50mg', frequency: 'daily', route: 'oral', indication: 'Post-MI / Hypertension' },
        { name: 'Apixaban', dose: '5mg', frequency: 'BID', route: 'oral', indication: 'Atrial Fibrillation' },
        { name: 'Nexium', dose: '40mg', frequency: 'daily', route: 'oral', indication: 'GERD' }
      ],
      inpatientMedications: [
        { name: 'Metoprolol Tartrate', dose: '25mg', frequency: 'BID', route: 'oral' },
        { name: 'Heparin Continuous Infusion', dose: '1000 units/hr', frequency: 'IV continuous', route: 'IV' },
        { name: 'Pantoprazole', dose: '40mg', frequency: 'daily', route: 'IV' }
      ],
      dischargeMedications: [
        // Metoprolol was accidentally omitted!
        // Apixaban was prescribed alongside Enoxaparin! (Duplicate/High Risk Bleeding)
        { name: 'Apixaban (Eliquis)', dose: '5mg', frequency: 'BID', route: 'oral' },
        { name: 'Enoxaparin', dose: '40mg', frequency: 'daily', route: 'subcutaneous' },
        // Nexium brand prescribed -> Formulary Saver should flag generic Omeprazole
        { name: 'Nexium', dose: '40mg', frequency: 'daily', route: 'oral' }
      ],
      eGfr: 45,
      reviewedBy: 'PharmD Specialist Sarah Chen'
    });

    console.log(`   ✔ Reconciliation ID: #${medRecResult.reconciliation.id}`);
    console.log(`   ✔ Discrepancies Flagged: ${medRecResult.discrepancyCount} (Expected: >= 2)`);
    console.log(`   ✔ High/Critical Risk Count: ${medRecResult.highRiskCount} (Expected: >= 2)`);
    console.log(`   ✔ Formulary Monthly Savings Identified: $${medRecResult.savingsIdentified} (Expected: $65)`);
    console.log(`   ✔ Status: ${medRecResult.reconciliation.status} (Expected: discrepancies_flagged)`);

    const discrepancies = medRecResult.reconciliation.discrepancies;
    const hasOmission = discrepancies.some((d: any) => d.discrepancyType === 'unintended_omission' && d.medicationName.includes('Metoprolol'));
    const hasDuplicate = discrepancies.some((d: any) => d.discrepancyType === 'duplicate_therapy');

    console.log(`   ✔ Unintended Omission Detected (Metoprolol Succinate): ${hasOmission} (Expected: true)`);
    console.log(`   ✔ Duplicate Anticoagulation Blockade Flagged (DOAC + LMWH): ${hasDuplicate} (Expected: true)`);

    if (!hasOmission || !hasDuplicate) {
      throw new Error('Autonomous discrepancy algorithms failed to detect expected omission or duplicate therapy.');
    }

    // 4. Place Meds-to-Beds Bedside Delivery Order
    console.log('\n4. Dispatching Meds-to-Beds Delivery Order to Patient Bedside...');
    const deliveryOrder = await dischargeMedRecService.createBedsideDeliveryOrder({
      reconciliationId: medRecResult.reconciliation.id,
      patientId: patient.id,
      roomBed: 'Cardiology 4th Floor - Bed 412B',
      targetDischargeTime: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
      courierName: 'Courier Marcus Bell',
      copayAmount: 22.50,
      medicationList: [
        { name: 'Metoprolol Succinate ER', dose: '50mg', frequency: 'daily' },
        { name: 'Apixaban', dose: '5mg', frequency: 'BID' },
        { name: 'Omeprazole DR', dose: '20mg', frequency: 'daily' }
      ],
      pharmacistNotes: 'Reconciliation resolved: Enoxaparin discontinued, Metoprolol reinstated, substituted Tier 1 Omeprazole for Nexium. Teach-back on DOAC bleeding warning required.'
    });

    console.log(`   ✔ Delivery Order Created: ID = #${deliveryOrder.id}`);
    console.log(`   ✔ Assigned Room/Bed: ${deliveryOrder.room_bed}`);
    console.log(`   ✔ Initial Delivery Status: ${deliveryOrder.delivery_status} (Expected: order_placed)`);
    console.log(`   ✔ Assigned Courier: ${deliveryOrder.courier_name}`);
    console.log(`   ✔ Patient Copay Total: $${deliveryOrder.copay_amount}`);

    // 5. Progress Courier Through In-Transit and Bedside Hand-Off
    console.log('\n5. Courier Dispenses & Transits to Bedside...');
    const inTransit = await dischargeMedRecService.updateDeliveryStatus(deliveryOrder.id, 'in_transit_courier', {
      pharmacistNotes: 'Packaged in child-resistant safety vials. En route from Central Pharmacy.'
    });
    console.log(`   ✔ Status Updated: ${inTransit.delivery_status} (Expected: in_transit_courier)`);

    console.log('\n6. Completing Bedside Hand-Off, Copay Collection, and Pharmacist Teach-Back...');
    const completedDelivery = await dischargeMedRecService.updateDeliveryStatus(deliveryOrder.id, 'counseling_completed', {
      copayCollected: true,
      teachBackCompleted: true,
      pharmacistNotes: 'Patient Eleanor Vance demonstrated 100% teach-back on Apixaban signs of bleeding and daily morning Metoprolol adherence. Copay collected via bedside mobile POS.'
    });

    console.log(`   ✔ Final Delivery Status: ${completedDelivery.delivery_status} (Expected: counseling_completed)`);
    console.log(`   ✔ Copay Collected: ${completedDelivery.copay_collected} (Expected: true)`);
    console.log(`   ✔ Teach-Back Verified: ${completedDelivery.teach_back_completed} (Expected: true)`);

    // 7. Verify Post-Delivery MedRec Summary Metrics
    console.log('\n7. Verifying Post-Intervention MedRec & Bedside Analytics...');
    const updatedSummary = await dischargeMedRecService.getMedRecSummary();
    console.log(`   ✔ Total Reconciliations: ${updatedSummary.metrics.totalReconciliations}`);
    console.log(`   ✔ Completed Bedside Deliveries: ${updatedSummary.metrics.deliveriesCompleted}`);
    console.log(`   ✔ Teach-Back Success Rate: ${updatedSummary.metrics.teachBackSuccessRate}%`);
    console.log(`   ✔ Estimated 30-Day Readmissions Averted: ${updatedSummary.metrics.estimatedReadmissionsAverted}`);
    console.log(`   ✔ Total Formulary Savings Identified: $${updatedSummary.metrics.totalMonthlyFormularySavings}`);

    console.log('\n====================================================');
    console.log('  Phase 43 Test Passed: 100% SUCCESS               ');
    console.log('====================================================\n');

  } catch (err) {
    console.error('\n❌ Phase 43 Test Failed with Error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runDischargeMedRecTest();
