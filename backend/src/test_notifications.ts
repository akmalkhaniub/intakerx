import { notificationBus, ClinicianNotification } from './notifications';

async function runNotificationTest() {
  console.log('==================================================');
  console.log('       IntakeRx Real-time Notification Test       ');
  console.log('==================================================\n');

  let receivedNotif: ClinicianNotification | null = null;

  // 1. Subscribe to notificationBus
  notificationBus.on('notification', (n) => {
    receivedNotif = n;
  });

  // 2. Emit an emergency triage event
  console.log('1. Pushing emergency triage notification to bus...');
  notificationBus.push(
    'emergency_triage',
    'CRITICAL Emergency Triage Alert',
    'Patient triggered acute red-flag symptoms: sudden severe chest pain',
    { sessionId: 'test-session-1234', severity: 'critical', patientName: 'John Doe' }
  );

  // Small delay to ensure event processing
  await new Promise(r => setTimeout(r, 50));

  if (!receivedNotif) {
    throw new Error('Notification listener did not receive the emitted event!');
  }

  const notif = receivedNotif as ClinicianNotification;
  console.log('2. Validating notification payload:');
  console.log(`   - ID: ${notif.id}`);
  console.log(`   - Type: ${notif.type} (Expected: emergency_triage)`);
  console.log(`   - Title: ${notif.title}`);
  console.log(`   - Severity: ${notif.severity} (Expected: critical)`);
  console.log(`   - SessionId: ${notif.sessionId}`);
  console.log(`   - Timestamp: ${notif.timestamp}`);

  if (notif.type !== 'emergency_triage' || notif.severity !== 'critical' || notif.sessionId !== 'test-session-1234') {
    throw new Error('Notification payload validation failed!');
  }

  // 3. Emit a guardrail deflection event
  console.log('\n3. Pushing guardrail deflection notification...');
  receivedNotif = null;
  notificationBus.push(
    'guardrail_deflection',
    'Prompt Injection Deflected',
    'Heuristic regex flagged jailbreak pattern',
    { sessionId: 'test-session-5678', severity: 'warning' }
  );

  await new Promise(r => setTimeout(r, 50));
  if (!receivedNotif) {
    throw new Error('Guardrail deflection notification was not received!');
  }
  const notif2 = receivedNotif as ClinicianNotification;
  console.log(`   - Type: ${notif2.type} (Expected: guardrail_deflection)`);
  console.log(`   - Severity: ${notif2.severity} (Expected: warning)`);

  if (notif2.type !== 'guardrail_deflection' || notif2.severity !== 'warning') {
    throw new Error('Guardrail deflection payload validation failed!');
  }

  console.log('\n✔ NOTIFICATION EVENT BUS PIPELINE PASSED SUCCESSFULLY.');
}

runNotificationTest().catch(err => {
  console.error('\n❌ Notification test failed:', err);
  process.exit(1);
});
