import { FhirGatewayService, CdsHookRequest } from './services/fhirGateway';
import { IcuSimulatorService } from './services/icuSimulator';
import { pool } from './db';

async function runTests() {
  console.log('=== RUNNING SMART-ON-FHIR R4 GATEWAY & CDS HOOKS 1.0 (PILLAR 2) INTEGRATION TESTS ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // Ensure simulated beds are loaded for patient IDs 1-12
    await IcuSimulatorService.initializeWard('Century FHIR Gateway Ward');

    // -------------------------------------------------------------
    // Test 1: FHIR R4 CapabilityStatement Conformance
    // -------------------------------------------------------------
    console.log('[Test 1] FHIR R4 CapabilityStatement Conformance');
    const cap = FhirGatewayService.getCapabilityStatement();
    assert(cap.resourceType === 'CapabilityStatement', 'resourceType is CapabilityStatement');
    assert(cap.fhirVersion === '4.0.1', 'FHIR Version is 4.0.1');
    assert(cap.rest[0].security?.service[0]?.coding[0]?.code === 'SMART-on-FHIR', 'SMART-on-FHIR security profile declared');
    const resourceTypes = cap.rest[0].resource.map(r => r.type);
    assert(resourceTypes.includes('Patient') && resourceTypes.includes('Observation') && resourceTypes.includes('Condition') && resourceTypes.includes('CarePlan') && resourceTypes.includes('Flag'), 'All 5 core resources declared in conformance statement');

    // -------------------------------------------------------------
    // Test 2: FHIR R4 Patient Resource Mapping
    // -------------------------------------------------------------
    console.log('\n[Test 2] FHIR R4 Patient Mapping');
    const fhirPatient = await FhirGatewayService.getFhirPatient(1);
    assert(!!fhirPatient, 'Patient 1 retrieved');
    assert(fhirPatient?.resourceType === 'Patient', 'resourceType is Patient');
    assert(fhirPatient?.id === '1', 'Patient ID matches');
    assert(Boolean(fhirPatient?.name && fhirPatient.name.length > 0), 'Patient name structure populated');

    // -------------------------------------------------------------
    // Test 3: FHIR R4 Observations (LOINC Mapped Vitals)
    // -------------------------------------------------------------
    console.log('\n[Test 3] FHIR R4 Observation Generation');
    const obsList = await FhirGatewayService.getFhirObservations(2);
    assert(obsList.length >= 4, `At least 4 observations returned for Bed 2 (actual: ${obsList.length})`);
    
    const hrObs = obsList.find(o => o.code.coding[0]?.code === '8867-4');
    assert(!!hrObs, 'Heart rate mapped to LOINC 8867-4');
    assert(hrObs?.valueQuantity?.unit === 'beats/min', 'Heart rate unit is beats/min');

    const sbpObs = obsList.find(o => o.code.coding[0]?.code === '8480-6');
    assert(!!sbpObs, 'Systolic BP mapped to LOINC 8480-6');

    const mapObs = obsList.find(o => o.code.coding[0]?.code === '8478-0');
    assert(!!mapObs, 'MAP mapped to LOINC 8478-0');

    // -------------------------------------------------------------
    // Test 4: FHIR R4 Condition Generation (SNOMED-CT Mapped)
    // -------------------------------------------------------------
    console.log('\n[Test 4] FHIR R4 Condition Generation');
    const condBed3 = await FhirGatewayService.getFhirConditions(3);
    assert(condBed3.length >= 2, `Bed 3 conditions include Preeclampsia and Hemorrhage (actual: ${condBed3.length})`);
    
    const preclampCond = condBed3.find(c => c.code.coding[0]?.code === '398254007');
    assert(!!preclampCond, 'Preeclampsia mapped to SNOMED 398254007');
    assert(preclampCond?.clinicalStatus.coding[0]?.code === 'active', 'Condition clinical status is active');

    // -------------------------------------------------------------
    // Test 5: FHIR R4 CarePlan (Century Grand Executive Plan)
    // -------------------------------------------------------------
    console.log('\n[Test 5] FHIR R4 CarePlan Mapping');
    const carePlan = await FhirGatewayService.getFhirCarePlan(1);
    assert(!!carePlan, 'CarePlan generated for patient 1');
    assert(carePlan?.resourceType === 'CarePlan', 'resourceType is CarePlan');
    assert(carePlan?.status === 'active', 'CarePlan status is active');
    assert(Boolean(carePlan?.goal && carePlan.goal.length >= 4), 'CarePlan includes multidimensional resuscitation goals');
    assert(Boolean(carePlan?.activity && carePlan.activity.length > 0), 'CarePlan includes active protocol directives');

    // -------------------------------------------------------------
    // Test 6: FHIR R4 Flags (Cross-Phase Conflict Alerts)
    // -------------------------------------------------------------
    console.log('\n[Test 6] FHIR R4 Safety Flags');
    const flagsBed2 = await FhirGatewayService.getFhirFlags(2);
    assert(flagsBed2.length >= 1, `Bed 2 has active safety flags (actual: ${flagsBed2.length})`);
    assert(flagsBed2[0].category?.[0]?.coding[0]?.code === 'safety', 'Flag category is safety');
    assert(flagsBed2[0].code.coding?.[0]?.code === 'CONFLICT_AORTIC_VS_SPINAL_MAP', 'Flag contains CONFLICT_AORTIC_VS_SPINAL_MAP');

    // -------------------------------------------------------------
    // Test 7: CDS Hooks 1.0 Discovery Endpoint
    // -------------------------------------------------------------
    console.log('\n[Test 7] CDS Hooks 1.0 Discovery');
    const cdsServices = FhirGatewayService.getCdsServicesList();
    assert(cdsServices.length === 3, 'Exactly 3 CDS services registered');
    assert(cdsServices.some(s => s.id === 'century-patient-view' && s.hook === 'patient-view'), 'century-patient-view hook registered');
    assert(cdsServices.some(s => s.id === 'contraindication-order-select' && s.hook === 'order-select'), 'contraindication-order-select hook registered');
    assert(cdsServices.some(s => s.id === 'critical-order-sign' && s.hook === 'order-sign'), 'critical-order-sign hook registered');

    // -------------------------------------------------------------
    // Test 8: CDS Hook Execution - century-patient-view
    // -------------------------------------------------------------
    console.log('\n[Test 8] CDS Hook Execution: century-patient-view');
    const pvReq: CdsHookRequest = {
      hook: 'patient-view',
      hookInstance: 'inst-1',
      context: { patientId: '1' }
    };
    const pvRes = await FhirGatewayService.executeCdsHook('century-patient-view', pvReq);
    assert(pvRes.cards.length >= 1, 'Returns at least 1 CDS Card');
    assert(pvRes.cards[0].summary.includes('Century Severity Score'), 'Primary card summarizes Century Severity Score');
    assert(pvRes.cards[0].indicator === 'critical', 'Indicator is critical for Bed 1');

    // -------------------------------------------------------------
    // Test 9: CDS Hook Execution - contraindication-order-select (Methergine in Preeclampsia)
    // -------------------------------------------------------------
    console.log('\n[Test 9] CDS Hook: Intercept Methergine in Severe Preeclampsia (Bed 3)');
    const orderReq1: CdsHookRequest = {
      hook: 'order-select',
      hookInstance: 'inst-2',
      context: {
        patientId: '3',
        selections: ['MedicationRequest/methergine-0.2mg-im']
      }
    };
    const orderRes1 = await FhirGatewayService.executeCdsHook('contraindication-order-select', orderReq1);
    assert(orderRes1.cards.length >= 1, 'Returns intercept card');
    assert(orderRes1.cards[0].indicator === 'critical', 'Indicator is CRITICAL');
    assert(orderRes1.cards[0].summary.includes('HARD STOP'), 'Summary flags HARD STOP');
    assert(Boolean(orderRes1.cards[0].suggestions && orderRes1.cards[0].suggestions.length >= 2), 'Provides alternative uterotonic suggestions (Carboprost / Misoprostol)');
    assert(Boolean(orderRes1.cards[0].overrideReasons && orderRes1.cards[0].overrideReasons.length > 0), 'Provides documented clinical override reasons');

    // -------------------------------------------------------------
    // Test 10: CDS Hook Execution - contraindication-order-select (Carboprost in Asthma)
    // -------------------------------------------------------------
    console.log('\n[Test 10] CDS Hook: Intercept Carboprost in Status Asthmaticus (Bed 5)');
    const orderReq2: CdsHookRequest = {
      hook: 'order-select',
      hookInstance: 'inst-3',
      context: {
        patientId: '5',
        selections: ['MedicationRequest/carboprost-250mcg-im']
      }
    };
    const orderRes2 = await FhirGatewayService.executeCdsHook('contraindication-order-select', orderReq2);
    assert(orderRes2.cards.length >= 1, 'Returns intercept card for asthma');
    assert(orderRes2.cards[0].indicator === 'critical', 'Indicator is CRITICAL');
    assert(orderRes2.cards[0].summary.includes('HARD STOP'), 'Summary flags HARD STOP for bronchospasm');

    console.log(`\n=============================================================`);
    console.log(`FHIR & CDS HOOKS TESTS COMPLETE: ${passed} passed, ${failed} failed.`);
    console.log(`=============================================================`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during FHIR Gateway test execution:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
