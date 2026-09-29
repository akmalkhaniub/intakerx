import { pool, bootstrap } from './db';
import { hospitalAtHomeService } from './services/hospitalAtHome';

async function runHospitalAtHomeTest() {
  console.log('====================================================');
  console.log('  IntakeRx Phase 38: Hospital-at-Home & RPM Fleet   ');
  console.log('====================================================\n');

  try {
    await bootstrap();

    // 1. Setup Inpatient Transitioning to Hospital-at-Home
    console.log('1. Setting up Hospital-at-Home Transition Encounter...');
    const patientEmail = `hah.patient.${Date.now()}@example.com`;
    const patientRes = await pool.query(`
      INSERT INTO patients (name, email, password_hash, dob, sex)
      VALUES ('Walter Bradford', $1, 'hah_pw', '1954-10-12', 'Male')
      RETURNING *
    `, [patientEmail]);
    const patient = patientRes.rows[0];

    const sessionRes = await pool.query(`
      INSERT INTO intake_sessions (id, patient_id, status, triage_level, triage_rationale)
      VALUES (gen_random_uuid(), $1, 'active', 'orange', 'Hospital-at-Home Acute Admission - CHF Exacerbation')
      RETURNING *
    `, [patient.id]);
    const session = sessionRes.rows[0];
    console.log(`   ✔ Encounter initialized [Session: ${session.id.substring(0, 8)}, Patient: ${patient.name}]`);

    // 2. Enroll in Hospital-at-Home Program
    console.log('\n2. Enrolling Patient in Hospital-at-Home (HaH) Command...');
    const enrollment = await hospitalAtHomeService.enrollPatient(
      patient.id,
      session.id,
      'Acute Exacerbation of Congestive Heart Failure (NYHA Class III)',
      'moderate',
      105
    );
    console.log(`   ✔ Enrollment ID: ${enrollment.id}, Diagnosis: ${enrollment.admission_diagnosis}, Tier: ${enrollment.acuity_tier}`);

    if (enrollment.status !== 'active') {
      throw new Error(`Expected enrollment status 'active', got ${enrollment.status}`);
    }

    // 3. Provision Cellular RPM Device Kit
    console.log('\n3. Provisioning Cellular RPM Device Fleet Kit...');
    const scaleSerial = `SCALE-${Date.now()}`;
    const bpSerial = `BP-${Date.now()}`;

    const scaleDevice = await hospitalAtHomeService.provisionDevice({
      enrollmentId: enrollment.id,
      deviceType: 'smart_scale_chf',
      serialNumber: scaleSerial,
      syncFrequencyMinutes: 60
    });
    console.log(`   ✔ Smart Scale Provisioned: Serial = ${scaleDevice.serial_number}, Status = ${scaleDevice.status}`);

    const bpDevice = await hospitalAtHomeService.provisionDevice({
      enrollmentId: enrollment.id,
      deviceType: 'cellular_bp_cuff',
      serialNumber: bpSerial,
      syncFrequencyMinutes: 15
    });
    console.log(`   ✔ Cellular BP Cuff Provisioned: Serial = ${bpDevice.serial_number}, Status = ${bpDevice.status}`);

    // 4. Ingest Baseline Telemetry
    console.log('\n4. Ingesting Baseline In-Home Biometric Telemetry...');
    const baselineReading = await hospitalAtHomeService.ingestTelemetry({
      serialNumber: scaleSerial,
      readingType: 'weight_kg',
      readingData: { weightKg: 80.2, changeOver48hKg: 0.2 }
    });
    console.log(`   ✔ Baseline Weight Reading: ${baselineReading.evaluation.alertSeverity} (${baselineReading.evaluation.clinicalDirective})`);
    if (baselineReading.evaluation.isOutOfBounds) {
      throw new Error('Expected baseline weight to be within normal limits');
    }

    // 5. Ingest Critical Out-of-Bounds Decompensation Telemetry
    console.log('\n5. Ingesting Acute CHF Decompensation Biometric Telemetry...');
    const abnormalWeight = await hospitalAtHomeService.ingestTelemetry({
      serialNumber: scaleSerial,
      readingType: 'weight_kg',
      readingData: { weightKg: 82.8, changeOver48hKg: 2.6 } // Rapid +2.6kg retention
    });
    console.log(`   ✔ Fluid Retention Alert: ${abnormalWeight.evaluation.alertSeverity}`);
    console.log(`     Directive: ${abnormalWeight.evaluation.clinicalDirective}`);

    if (!abnormalWeight.evaluation.isOutOfBounds || abnormalWeight.evaluation.alertSeverity !== 'urgent_call_required') {
      throw new Error(`Expected urgent_call_required for 2.6kg fluid gain, got ${abnormalWeight.evaluation.alertSeverity}`);
    }

    const abnormalBp = await hospitalAtHomeService.ingestTelemetry({
      serialNumber: bpSerial,
      readingType: 'blood_pressure',
      readingData: { systolic: 188, diastolic: 104, hr: 98 }
    });
    console.log(`   ✔ Hypertensive Crisis Alert: ${abnormalBp.evaluation.alertSeverity}`);
    console.log(`     Directive: ${abnormalBp.evaluation.clinicalDirective}`);

    if (!abnormalBp.evaluation.isOutOfBounds || abnormalBp.evaluation.alertSeverity !== 'emergency_ems_dispatch') {
      throw new Error(`Expected emergency_ems_dispatch for SBP 188, got ${abnormalBp.evaluation.alertSeverity}`);
    }

    // 6. Test CMS RPM Billing Calculations (CPT 99453, 99454, 99457)
    console.log('\n6. Calculating CMS Remote Patient Monitoring (RPM) Billable Units...');
    const rpmBilling = await hospitalAtHomeService.calculateRpmBilling(enrollment.id, 19, 25);
    console.log(`   ✔ Qualified Transmission Days: ${rpmBilling.transmissionDaysCount}/30 (Threshold ≥16: ${rpmBilling.transmissionDaysCount >= 16})`);
    console.log(`   ✔ Clinical Time Logged: ${rpmBilling.clinicalMinutesSpent} minutes (Threshold ≥20)`);
    console.log(`   ✔ Billable CPT Line Items: ${rpmBilling.billableItems.map(b => b.cpt).join(', ')}`);
    console.log(`   ✔ Total RPM Reimbursement: $${rpmBilling.totalBillableDollars}`);

    if (rpmBilling.billableItems.length < 3) {
      throw new Error(`Expected at least 3 CPT codes (99453, 99454, 99457), got ${rpmBilling.billableItems.length}`);
    }
    if (rpmBilling.totalBillableCents !== 12450) {
      throw new Error(`Expected total billable cents 12450 ($124.50), got ${rpmBilling.totalBillableCents}`);
    }

    // 7. Verify Fleet Overview
    console.log('\n7. Querying Central Hospital-at-Home Fleet Command Overview...');
    const fleet = await hospitalAtHomeService.getFleetOverview();
    console.log(`   ✔ Active Enrolled Patients at Home: ${fleet.activeEnrollments.length}`);
    console.log(`   ✔ Open Out-of-Bounds Biometric Alerts: ${fleet.activeAlerts.length}`);

    const foundInAlerts = fleet.activeAlerts.some(a => a.patient_id === patient.id);
    if (!foundInAlerts) {
      throw new Error('Patient alert not found in active fleet alerts');
    }

    console.log('\n====================================================');
    console.log('  Phase 38 Test Passed: 100% SUCCESS               ');
    console.log('====================================================');
  } catch (err) {
    console.error('\n❌ Phase 38 Test Failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runHospitalAtHomeTest();
