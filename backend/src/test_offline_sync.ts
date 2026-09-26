import { bootstrap } from './db';
import { DisasterFieldTriageService, OfflineFieldIntake } from './services/disasterFieldTriage';

async function runOfflineSyncTest() {
  console.log('====================================================');
  console.log('  IntakeRx Offline Field Triage & Disaster Mode     ');
  console.log('====================================================\n');

  try {
    await bootstrap();

    // 1. Evaluate START Triage Protocol
    console.log('1. Testing START Triage Physiological Classifier...');
    
    // Case A: Ambulatory
    const greenResult = DisasterFieldTriageService.evaluateStartTriage({
      canWalk: true,
      hasSpontaneousBreathing: true
    });
    console.log(`   ✔ Walking Wounded: ${greenResult.tag} (${greenResult.label})`);
    if (greenResult.tag !== 'GREEN') throw new Error('Expected GREEN tag for walking patient.');

    // Case B: Severe Tachypnea
    const redResultTachypnea = DisasterFieldTriageService.evaluateStartTriage({
      canWalk: false,
      hasSpontaneousBreathing: true,
      respiratoryRate: 36,
      hasRadialPulse: true,
      followsCommands: true
    });
    console.log(`   ✔ Tachypnea (RR 36): ${redResultTachypnea.tag} (${redResultTachypnea.label})`);
    if (redResultTachypnea.tag !== 'RED') throw new Error('Expected RED tag for tachypnea >30.');

    // Case C: Unstable Perfusion
    const redResultShock = DisasterFieldTriageService.evaluateStartTriage({
      canWalk: false,
      hasSpontaneousBreathing: true,
      respiratoryRate: 22,
      hasRadialPulse: false,
      capillaryRefillSec: 4,
      followsCommands: true
    });
    console.log(`   ✔ Decompensated Shock: ${redResultShock.tag} (${redResultShock.label})`);
    if (redResultShock.tag !== 'RED') throw new Error('Expected RED tag for absent radial pulse.');

    // Case D: Apneic
    const blackResult = DisasterFieldTriageService.evaluateStartTriage({
      canWalk: false,
      hasSpontaneousBreathing: false,
      airwayRepositioned: false
    });
    console.log(`   ✔ Apneic / Expectant: ${blackResult.tag} (${blackResult.label})`);
    if (blackResult.tag !== 'BLACK') throw new Error('Expected BLACK tag for uncorrectable apnea.');

    // Case E: Stable Non-Ambulatory
    const yellowResult = DisasterFieldTriageService.evaluateStartTriage({
      canWalk: false,
      hasSpontaneousBreathing: true,
      respiratoryRate: 18,
      hasRadialPulse: true,
      capillaryRefillSec: 1.5,
      followsCommands: true
    });
    console.log(`   ✔ Stable Delayed: ${yellowResult.tag} (${yellowResult.label})`);
    if (yellowResult.tag !== 'YELLOW') throw new Error('Expected YELLOW tag for stable patient.');

    // 2. Test Facility Disaster Mode Activation
    console.log('\n2. Testing Disaster Mode Activation...');
    const activation = await DisasterFieldTriageService.toggleDisasterMode({
      isActive: true,
      activatedBy: 'Incident Commander Capt. Vance, MD',
      incidentName: 'Code Black: Structural Collapse & Mass Casualty Surge',
      guidelines: 'Execute rapid START field sorting. All units prioritize immediate RED tags.'
    });
    console.log(`   ✔ Disaster Mode Activated: "${activation.incident_name}" [ID: ${activation.id}]`);

    const statusAfterActivation = await DisasterFieldTriageService.getDisasterModeStatus();
    if (!statusAfterActivation.isActive) {
      throw new Error('Disaster Mode status should be active.');
    }
    console.log(`   ✔ Verified Active Status: ${statusAfterActivation.isActive}`);

    // 3. Test Offline Field Intake Batch Ingestion
    console.log('\n3. Ingesting Offline Field Triage Batch (3 Casualties)...');
    const batchTimestamp = new Date().toISOString();
    const mockBatch: OfflineFieldIntake[] = [
      {
        offlineId: `FLD-${Date.now()}-001`,
        timestamp: batchTimestamp,
        fieldResponder: 'Paramedic EMT-P Jenkins (Unit 4)',
        patientName: 'Jane Doe (Trauma Victim #1)',
        estimatedAge: 32,
        sex: 'Female',
        chiefComplaint: 'Blunt thoracic trauma with paradoxical chest wall movement',
        startCriteria: {
          canWalk: false,
          hasSpontaneousBreathing: true,
          respiratoryRate: 34,
          hasRadialPulse: true,
          followsCommands: false
        },
        vitalSigns: { heartRate: 128, respiratoryRate: 34, oxygenSat: 84 },
        fieldNotes: 'Flail chest segment. High-flow O2 applied via non-rebreather.'
      },
      {
        offlineId: `FLD-${Date.now()}-002`,
        timestamp: batchTimestamp,
        fieldResponder: 'Paramedic EMT-P Jenkins (Unit 4)',
        patientName: 'Marcus Vance',
        estimatedAge: 48,
        sex: 'Male',
        chiefComplaint: 'Deformity right lower extremity with localized pain',
        startCriteria: {
          canWalk: false,
          hasSpontaneousBreathing: true,
          respiratoryRate: 18,
          hasRadialPulse: true,
          followsCommands: true
        },
        vitalSigns: { heartRate: 88, respiratoryRate: 18, oxygenSat: 98 },
        fieldNotes: 'Traction splint applied to closed mid-shaft femur injury.'
      },
      {
        offlineId: `FLD-${Date.now()}-003`,
        timestamp: batchTimestamp,
        fieldResponder: 'Paramedic EMT-P Jenkins (Unit 4)',
        patientName: 'Timothy Gable',
        estimatedAge: 25,
        sex: 'Male',
        chiefComplaint: 'Superficial forearm lacerations and minor contusions',
        startCriteria: {
          canWalk: true,
          hasSpontaneousBreathing: true
        },
        vitalSigns: { heartRate: 76, respiratoryRate: 16, oxygenSat: 99 },
        fieldNotes: 'Walking wounded. Bandaged and directed to secondary triage area.'
      }
    ];

    const syncReport = await DisasterFieldTriageService.processBatchSync(mockBatch);
    console.log(`   ✔ Batch Synced: ${syncReport.syncedCount} created, ${syncReport.duplicateCount} duplicates`);
    syncReport.results.forEach((r, idx) => {
      console.log(`     (${idx + 1}) [${r.tag}] OfflineID: ${r.offlineId} -> Session: ${r.sessionId.substring(0, 8)} (${r.status})`);
    });

    if (syncReport.syncedCount !== 3 || syncReport.duplicateCount !== 0) {
      throw new Error('Initial sync batch did not process all 3 intakes properly.');
    }

    // 4. Test Idempotency on Re-Sync
    console.log('\n4. Testing Sync Idempotency (Re-submitting duplicate batch)...');
    const duplicateReport = await DisasterFieldTriageService.processBatchSync(mockBatch);
    console.log(`   ✔ Duplicate Re-Sync: ${duplicateReport.syncedCount} created, ${duplicateReport.duplicateCount} duplicates`);
    if (duplicateReport.syncedCount !== 0 || duplicateReport.duplicateCount !== 3) {
      throw new Error('Duplicate re-sync failed idempotency check.');
    }
    console.log('   ✔ Idempotency verified: Zero duplicate rows created.');

    // 5. Test Disaster Mode Deactivation
    console.log('\n5. Deactivating Disaster Mode (Restoring Normal Operations)...');
    const deactivation = await DisasterFieldTriageService.toggleDisasterMode({
      isActive: false,
      activatedBy: 'Medical Director Dr. Brody, MD'
    });
    console.log(`   ✔ Status: ${deactivation.is_active ? 'ACTIVE' : 'INACTIVE'} (Incident: ${deactivation.incident_name})`);

    const finalStatus = await DisasterFieldTriageService.getDisasterModeStatus();
    if (finalStatus.isActive) {
      throw new Error('Disaster mode should now be inactive.');
    }

    console.log('\n✔ OFFLINE-FIRST FIELD TRIAGE & DISASTER MODE SUITE PASSED 100%!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  }
}

runOfflineSyncTest();
