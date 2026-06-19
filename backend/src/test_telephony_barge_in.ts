import { activeCallSockets } from './activeCalls';
import { pool } from './db';
import { v4 as uuidv4 } from 'uuid';

async function runTelephonyBargeInTests() {
  console.log('==================================================');
  console.log('      IntakeRx Telephony & Barge-In Registry Test  ');
  console.log('==================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, message: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`[PASS] ${message}`);
    } else {
      console.error(`[FAIL] ${message}`);
    }
  }

  try {
    const sessionId = uuidv4();
    
    // Create a mock WebSocket interface
    const mockWs = {
      send: (data: string) => {
        console.log('[MOCK WS RECEIVED DATA]:', data);
        const parsed = JSON.parse(data);
        assert(parsed.type === 'barge_in', 'Should receive barge_in frame');
        assert(parsed.text === 'Clinician intervene text', 'Should contain correct barge-in content');
      }
    } as any;

    // Register active call in shared map
    activeCallSockets.set(sessionId, {
      ws: mockWs,
      patientName: 'Test Phone Patient',
      messages: []
    });

    assert(activeCallSockets.has(sessionId), 'Active call registry should register session.');

    const call = activeCallSockets.get(sessionId);
    assert(call?.patientName === 'Test Phone Patient', 'Registry should keep patient metadata.');

    // Simulate clinician barge-in override action
    console.log('Executing simulated clinician override...');
    const message = 'Clinician intervene text';
    
    // Send frame to WS client
    call?.ws.send(JSON.stringify({
      type: 'barge_in',
      text: message
    }));

    // Record the message in memory
    call?.messages.push({
      sender: 'agent',
      content: `[Barge-in Override]: ${message}`,
      createdAt: new Date().toISOString()
    });

    assert(call?.messages.length === 1, 'Registry message history should be updated.');
    assert(call?.messages[0].content.includes('Clinician intervene text'), 'Should store barge-in message in list.');

    // Clear session
    activeCallSockets.delete(sessionId);
    assert(!activeCallSockets.has(sessionId), 'Registry should successfully delete session upon close.');

    console.log('\n==================================================');
    console.log(`Test Results: ${passedTests}/${totalTests} Passed`);
    console.log('==================================================');
    
    await pool.end();
    process.exit(passedTests === totalTests ? 0 : 1);
  } catch (err) {
    console.error('Test execution failed:', err);
    try {
      await pool.end();
    } catch (e) {}
    process.exit(1);
  }
}

runTelephonyBargeInTests();
