import { pool } from './db';
import { CBRNETriageService } from './services/cbrneTriage';

async function runCBRNETriageTests() {
  console.log('====================================================');
  console.log('🧪 Starting Phase 63: CBRNE-TRIAGE & Disaster MCI Tests');
  console.log('====================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Adult START Triage
    console.log('\n--- 1. Adult START Triage Algorithm ---');
    // Green (Walking wounded)
    const startGreen = CBRNETriageService.evaluateSTART({
      incidentName: 'Downtown Explosion',
      patientIdentifier: 'TAG-001',
      canWalk: true,
      spontaneousBreathing: true
    });
    console.log(`START Walking Wounded: ${startGreen.triageCategory}`);
    assert(startGreen.triageCategory === 'GREEN', 'Walking wounded tagged GREEN');

    // Red (Resumes breathing with airway maneuver)
    const startRedAirway = CBRNETriageService.evaluateSTART({
      incidentName: 'Downtown Explosion',
      patientIdentifier: 'TAG-002',
      canWalk: false,
      spontaneousBreathing: false,
      repositionsAirwayResumesBreathing: true
    });
    console.log(`START Airway Reposition: ${startRedAirway.triageCategory}`);
    assert(startRedAirway.triageCategory === 'RED', 'Apnea resolving with airway reposition tagged RED');

    // Black (Apnea persists after airway maneuver)
    const startBlack = CBRNETriageService.evaluateSTART({
      incidentName: 'Downtown Explosion',
      patientIdentifier: 'TAG-003',
      canWalk: false,
      spontaneousBreathing: false,
      repositionsAirwayResumesBreathing: false
    });
    console.log(`START Unresponsive Apnea: ${startBlack.triageCategory}`);
    assert(startBlack.triageCategory === 'BLACK', 'Persistent apnea tagged BLACK');

    // Red (Tachypnea RR > 30)
    const startRedRR = CBRNETriageService.evaluateSTART({
      incidentName: 'Downtown Explosion',
      patientIdentifier: 'TAG-004',
      canWalk: false,
      spontaneousBreathing: true,
      respiratoryRate: 36,
      radialPulsePresent: true,
      obeysCommands: true
    });
    assert(startRedRR.triageCategory === 'RED', 'Tachypnea RR 36 tagged RED');

    // Red (Absent radial pulse)
    const startRedPulse = CBRNETriageService.evaluateSTART({
      incidentName: 'Downtown Explosion',
      patientIdentifier: 'TAG-005',
      canWalk: false,
      spontaneousBreathing: true,
      respiratoryRate: 22,
      radialPulsePresent: false,
      obeysCommands: true
    });
    assert(startRedPulse.triageCategory === 'RED', 'Absent radial pulse tagged RED');

    // Yellow (Delayed)
    const startYellow = CBRNETriageService.evaluateSTART({
      incidentName: 'Downtown Explosion',
      patientIdentifier: 'TAG-006',
      canWalk: false,
      spontaneousBreathing: true,
      respiratoryRate: 18,
      radialPulsePresent: true,
      capillaryRefillSeconds: 1.5,
      obeysCommands: true
    });
    assert(startYellow.triageCategory === 'YELLOW', 'Hemodynamically stable non-ambulatory adult tagged YELLOW');

    // 2. Pediatric JumpSTART Triage
    console.log('\n--- 2. Pediatric JumpSTART Triage ---');
    // Green
    const jumpGreen = CBRNETriageService.evaluateJumpSTART({
      incidentName: 'School Collapse',
      patientIdentifier: 'PED-001',
      canWalk: true,
      spontaneousBreathing: true
    });
    assert(jumpGreen.triageCategory === 'GREEN', 'Ambulatory pediatric tagged GREEN');

    // Red (Apneic with pulse, breathing after 5 rescue breaths)
    const jumpRedRescueBreaths = CBRNETriageService.evaluateJumpSTART({
      incidentName: 'School Collapse',
      patientIdentifier: 'PED-002',
      canWalk: false,
      spontaneousBreathing: false,
      repositionsAirwayResumesBreathing: false,
      palpablePulse: true,
      gaveRescueBreathsResumedBreathing: true
    });
    console.log(`JumpSTART Rescue Breaths: ${jumpRedRescueBreaths.triageCategory}`);
    assert(jumpRedRescueBreaths.triageCategory === 'RED', 'Child resuming breathing after 5 rescue breaths tagged RED');

    // Black (Apneic and pulseless)
    const jumpBlack = CBRNETriageService.evaluateJumpSTART({
      incidentName: 'School Collapse',
      patientIdentifier: 'PED-003',
      canWalk: false,
      spontaneousBreathing: false,
      palpablePulse: false
    });
    assert(jumpBlack.triageCategory === 'BLACK', 'Apneic and pulseless pediatric tagged BLACK');

    // Red (Pediatric respiratory distress RR 48 > 45)
    const jumpRedRR = CBRNETriageService.evaluateJumpSTART({
      incidentName: 'School Collapse',
      patientIdentifier: 'PED-004',
      canWalk: false,
      spontaneousBreathing: true,
      respiratoryRate: 50,
      palpablePulse: true,
      avpuScore: 'A'
    });
    assert(jumpRedRR.triageCategory === 'RED', 'Pediatric tachypnea RR 50 tagged RED');

    // 3. CBRNE Threat & Antidote Matching
    console.log('\n--- 3. CBRNE Threat & Antidote Protocols ---');
    // Nerve Agent (Sarin)
    const sarinMatch = CBRNETriageService.matchCBRNEAgent({
      cbrneClass: 'CHEMICAL_NERVE',
      agentName: 'Sarin (GB)',
      patientWeightKg: 75,
      symptomsObserved: ['miosis', 'rhinorrhea', 'bronchospasm', 'muscle_fasciculations']
    });
    console.log(`Sarin Antidote: ${sarinMatch.antidoteRecommended}`);
    assert(sarinMatch.antidoteRecommended.includes('DuoDote') || sarinMatch.antidoteRecommended.includes('Atropine'), 'DuoDote/Atropine matched for Sarin');
    assert(sarinMatch.chempackDeploymentTriggered === true, 'CHEMPACK federal cache deployment triggered for Sarin');
    assert(sarinMatch.ppeLevelRequired === 'Level C', 'Level C PPE recommended');

    // Cyanide
    const cyanideMatch = CBRNETriageService.matchCBRNEAgent({
      cbrneClass: 'CHEMICAL_CYANIDE',
      agentName: 'Hydrogen Cyanide',
      patientWeightKg: 70,
      symptomsObserved: ['severe_metabolic_acidosis', 'cherry_red_skin', 'seizures']
    });
    console.log(`Cyanide Antidote: ${cyanideMatch.antidoteRecommended}`);
    assert(cyanideMatch.antidoteRecommended.includes('Cyanokit') || cyanideMatch.antidoteRecommended.includes('Hydroxocobalamin'), 'Hydroxocobalamin matched for Cyanide');
    assert(cyanideMatch.specialCautions.some(c => c.includes('dark red/purple')), 'Chromaturic skin/urine color change warning present');

    // Vesicant (Lewisite)
    const lewisiteMatch = CBRNETriageService.matchCBRNEAgent({
      cbrneClass: 'CHEMICAL_VESICANT',
      agentName: 'Lewisite (L)',
      patientWeightKg: 80,
      symptomsObserved: ['immediate_stinging_skin_pain', 'erythema', 'corneal_burns']
    });
    console.log(`Lewisite Antidote: ${lewisiteMatch.antidoteRecommended}`);
    assert(lewisiteMatch.antidoteRecommended.includes('Dimercaprol') || lewisiteMatch.antidoteRecommended.includes('BAL'), 'British Anti-Lewisite (BAL) matched');

    // Radiation (Cesium-137)
    const cesiumMatch = CBRNETriageService.matchCBRNEAgent({
      cbrneClass: 'RADIOLOGICAL',
      agentName: 'Cesium-137 Dirty Bomb',
      patientWeightKg: 70,
      symptomsObserved: ['external_contamination', 'nausea']
    });
    console.log(`Cesium Antidote: ${cesiumMatch.antidoteRecommended}`);
    assert(cesiumMatch.antidoteRecommended.includes('Prussian Blue'), 'Prussian Blue decorporation matched for Cesium-137');

    // 4. Database Persistence Verification
    console.log('\n--- 4. Database Persistence Verification ---');
    // Save MCI Encounter
    const encounter = await CBRNETriageService.createEncounter({
      incidentName: 'Metro Industrial Disaster',
      patientIdentifier: 'TAG-RED-099',
      isPediatric: false,
      triageCategory: 'RED',
      canWalk: false,
      respiratoryRate: 34,
      perfusionIntact: false,
      mentalStatus: 'Confused',
      airwayInterventionNeeded: true,
      decontaminationStatus: 'in_progress',
      destinationFacilityZone: 'acute_red_tent'
    });
    assert(encounter && encounter.id > 0, 'MCI triage encounter persisted');

    // List Encounters
    const encounters = await CBRNETriageService.listEncounters('Metro Industrial Disaster');
    assert(encounters.length > 0, 'Retrieved MCI encounters by incident name');

    // Record CBRNE Exposure
    const exposure = await CBRNETriageService.recordExposure({
      encounterId: encounter.id,
      cbrneClass: 'CHEMICAL_NERVE',
      agentIdentified: 'Sarin (GB)',
      antidoteRecommended: 'DuoDote (Atropine 2mg + 2-PAM 600mg)',
      antidoteDoseInstructions: 'Repeat Q5-10m until pulmonary secretions dry',
      chempackRequested: true,
      deconMethodRecommended: 'Strip clothing, RSDL dermal lotion'
    });
    assert(exposure && exposure.id > 0, 'CBRNE exposure logged to encounter');

    const exposures = await CBRNETriageService.getExposuresByEncounter(encounter.id);
    assert(exposures.length > 0, 'Retrieved exposures by encounter ID');

    // Surge Capacity Stats
    const stats = await CBRNETriageService.getSurgeCapacityStats('Metro Industrial Disaster');
    assert(stats && stats.totalTriaged > 0, 'Calculated live disaster surge capacity metrics');

    console.log('\n====================================================');
    console.log(`📊 Phase 63 Test Results: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Unhandled test failure:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runCBRNETriageTests();
