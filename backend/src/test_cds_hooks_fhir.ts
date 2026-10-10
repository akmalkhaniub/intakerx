import { CdsHooksFhirService, CdsHookRequest } from './services/cdsHooksFhir';

async function runTests() {
  console.log('--- STARTING PHASE 66 CDS HOOKS & SMART-ON-FHIR INTEGRATION TESTS ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    // Test 1: CDS Services Discovery Endpoint Catalog
    const catalog = CdsHooksFhirService.getDiscoveryCatalog();
    assert(catalog.services.length >= 3, 'Discovery: Returns at least 3 CDS services');
    assert(catalog.services.some(s => s.hook === 'patient-view'), 'Discovery: Includes patient-view hook');
    assert(catalog.services.some(s => s.hook === 'order-select'), 'Discovery: Includes order-select hook');
    assert(catalog.services.some(s => s.hook === 'order-sign'), 'Discovery: Includes order-sign hook');

    // Test 2: patient-view Hook (Routine Surveillance Card)
    const patientViewReq: CdsHookRequest = {
      hook: 'patient-view',
      hookInstance: 'hook-inst-patient-view-001',
      context: {
        userId: 'Practitioner/dr-smith',
        patientId: '1'
      }
    };
    const patientViewRes = await CdsHooksFhirService.evaluateHook(patientViewReq);
    assert(patientViewRes.cards.length >= 1, 'patient-view: Generates safety surveillance card');
    assert(patientViewRes.cards[0].indicator === 'info', 'patient-view: Surveillance card indicator is info');
    assert(patientViewRes.cards[0].links?.[0]?.type === 'smart', 'patient-view: Provides SMART app launch link');

    // Test 3: patient-view Hook with Renal Impairment (Warning Card)
    const patientViewRenalReq: CdsHookRequest = {
      hook: 'patient-view',
      hookInstance: 'hook-inst-patient-view-002',
      context: {
        userId: 'Practitioner/dr-smith',
        patientId: '1',
        renalImpairment: true
      }
    };
    const patientViewRenalRes = await CdsHooksFhirService.evaluateHook(patientViewRenalReq);
    assert(patientViewRenalRes.cards.some(c => c.indicator === 'warning'), 'patient-view: Detects renal impairment and emits warning card');

    // Test 4: order-select Hook with High Risk Drug (Vancomycin)
    const orderSelectVancoReq: CdsHookRequest = {
      hook: 'order-select',
      hookInstance: 'hook-inst-order-select-001',
      context: {
        userId: 'Practitioner/dr-smith',
        patientId: '1',
        draftOrders: { medicationName: 'Vancomycin 1g IV q12h' }
      }
    };
    const orderSelectVancoRes = await CdsHooksFhirService.evaluateHook(orderSelectVancoReq);
    assert(orderSelectVancoRes.cards.some(c => c.indicator === 'critical'), 'order-select: High-risk Vancomycin emits critical TDM card');
    assert(orderSelectVancoRes.cards[0].suggestions?.length! > 0, 'order-select: High-risk card includes trough order suggestion');

    // Test 5: order-select Hook with Standard Formulary Drug (Acetaminophen)
    const orderSelectSafeReq: CdsHookRequest = {
      hook: 'order-select',
      hookInstance: 'hook-inst-order-select-002',
      context: {
        userId: 'Practitioner/dr-smith',
        patientId: '1',
        draftOrders: { medicationName: 'Acetaminophen 650mg PO q6h' }
      }
    };
    const orderSelectSafeRes = await CdsHooksFhirService.evaluateHook(orderSelectSafeReq);
    assert(orderSelectSafeRes.cards[0].indicator === 'info', 'order-select: Standard drug passes formulary check');

    // Test 6: order-sign Hook with Restricted Reserve Antibiotic (Meropenem)
    const orderSignRestrictedReq: CdsHookRequest = {
      hook: 'order-sign',
      hookInstance: 'hook-inst-order-sign-001',
      context: {
        userId: 'Practitioner/dr-smith',
        patientId: '1',
        draftOrders: [{ medicationName: 'Meropenem 1g IV q8h' }]
      }
    };
    const orderSignRestrictedRes = await CdsHooksFhirService.evaluateHook(orderSignRestrictedReq);
    assert(orderSignRestrictedRes.cards.some(c => c.indicator === 'critical'), 'order-sign: Restricted carbapenem triggers antimicrobial stewardship hard-stop');

    // Test 7: order-sign Hook with Routine Order
    const orderSignRoutineReq: CdsHookRequest = {
      hook: 'order-sign',
      hookInstance: 'hook-inst-order-sign-002',
      context: {
        userId: 'Practitioner/dr-smith',
        patientId: '1',
        draftOrders: [{ medicationName: 'Lactated Ringers 100mL/hr' }]
      }
    };
    const orderSignRoutineRes = await CdsHooksFhirService.evaluateHook(orderSignRoutineReq);
    assert(orderSignRoutineRes.cards[0].indicator === 'info', 'order-sign: Routine fluid order clears CDS signing validation');

    // Test 8: SMART Client Registration
    const smartClient = await CdsHooksFhirService.registerSmartClient({
      client_id: 'client-teleicu-bedside-v1',
      client_name: 'IntakeRx Tele-ICU Bedside Tablet App',
      redirect_uris: ['https://intakerx.health/smart/callback', 'http://localhost:5173/smart/callback'],
      scope: 'launch/patient patient/*.read patient/Observation.write'
    });
    assert(Boolean(smartClient.id), 'SMART: Client registered successfully with ID');
    assert(smartClient.client_id === 'client-teleicu-bedside-v1', 'SMART: Client ID matched');

    // Test 9: SMART OAuth2 Token Exchange
    const tokenRes = CdsHooksFhirService.generateSmartTokenResponse({
      patient_id: '1',
      user_id: 'Practitioner/dr-smith',
      client_id: 'client-teleicu-bedside-v1',
      scope: 'launch/patient patient/*.read'
    });
    assert(tokenRes.token_type === 'Bearer', 'SMART Token: Bearer token type returned');
    assert(tokenRes.patient === '1', 'SMART Token: Patient context preserved');
    assert(Boolean(tokenRes.access_token), 'SMART Token: Access token returned');
    assert(Boolean(tokenRes.id_token), 'SMART Token: OpenID connect ID token returned');

    // Test 10: Retrieve Invocations Audit Log
    const invocations = await CdsHooksFhirService.getHookInvocations(1);
    assert(invocations.length > 0, 'DB Audit: CDS Hook invocations retrieved for patient 1');

    console.log(`\nPHASE 66 SUMMARY: ${passed} passed, ${failed} failed.`);
    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Test execution failed with unhandled error:', error);
    process.exit(1);
  }
}

runTests().then(() => {
  process.exit(0);
});
