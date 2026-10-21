import { CodeNavigatorService } from './services/codeNavigator';
import { pool } from './db';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('--- Phase 80: CODE-NAVIGATOR Command Integration Tests ---');
  console.log('======================================================\n');

  try {
    // 1. Shockable VF Cycle 1 (First Shock, Immediate CPR)
    console.log('Test Group 1: Shockable VF Rhythm (Cycle 1)');
    const vfCycle1 = CodeNavigatorService.evaluateCodeCycle({
      current_rhythm: 'VF',
      cycle_number: 1,
      time_in_code_seconds: 120,
      etco2_mmhg: 18,
      compression_fraction_percent: 88,
      epinephrine_doses_given: 0,
      amiodarone_mg_given: 0,
      lidocaine_mg_given: 0
    });

    assert(vfCycle1.rhythm_type === 'SHOCKABLE', 'Rhythm classified as SHOCKABLE');
    assert(vfCycle1.immediate_shock_indicated === true, 'Immediate shock indicated');
    assert(vfCycle1.shock_energy_joules === 200, 'Shock energy set to 200J biphasic');
    assert(vfCycle1.actionable_checklist.some(a => a.includes('Deliver immediate asynchronous shock')), 'Actionable checklist recommends immediate shock');

    // 2. Shockable VF Cycle 2 (Second Shock + Epinephrine 1mg)
    console.log('\nTest Group 2: Shockable VF Rhythm (Cycle 2 - Epinephrine Due)');
    const vfCycle2 = CodeNavigatorService.evaluateCodeCycle({
      current_rhythm: 'VF',
      cycle_number: 2,
      time_in_code_seconds: 240,
      etco2_mmhg: 20,
      compression_fraction_percent: 85,
      epinephrine_doses_given: 0,
      last_epinephrine_cycle: undefined,
      amiodarone_mg_given: 0,
      lidocaine_mg_given: 0
    });

    assert(vfCycle2.immediate_shock_indicated === true, 'Shock indicated on Cycle 2');
    assert(vfCycle2.drug_recommendation.includes('Epinephrine 1 mg'), 'Recommends Epinephrine 1mg IV/IO on Cycle 2');
    assert(vfCycle2.next_drug_due_cycle === 4, 'Next epinephrine scheduled for Cycle 4 (every 3-5m / alternate cycles)');

    // 3. Shockable Refractory VF Cycle 3 (Third Shock + Amiodarone 300mg)
    console.log('\nTest Group 3: Shockable VF Rhythm (Cycle 3 - Amiodarone 300mg Due)');
    const vfCycle3 = CodeNavigatorService.evaluateCodeCycle({
      current_rhythm: 'VF',
      cycle_number: 3,
      time_in_code_seconds: 360,
      etco2_mmhg: 22,
      compression_fraction_percent: 86,
      epinephrine_doses_given: 1,
      last_epinephrine_cycle: 2,
      amiodarone_mg_given: 0,
      lidocaine_mg_given: 0
    });

    assert(vfCycle3.immediate_shock_indicated === true, 'Shock indicated on Cycle 3');
    assert(vfCycle3.drug_recommendation.includes('Amiodarone 300 mg'), 'Recommends Amiodarone 300mg IV/IO bolus');

    // 4. Shockable Refractory VF Cycle 5 (Fifth Shock + Amiodarone 150mg Second Dose)
    console.log('\nTest Group 4: Shockable VF Rhythm (Cycle 5 - Amiodarone 150mg Second Dose)');
    const vfCycle5 = CodeNavigatorService.evaluateCodeCycle({
      current_rhythm: 'VF',
      cycle_number: 5,
      time_in_code_seconds: 600,
      etco2_mmhg: 24,
      compression_fraction_percent: 84,
      epinephrine_doses_given: 2,
      last_epinephrine_cycle: 4,
      amiodarone_mg_given: 300,
      lidocaine_mg_given: 0
    });

    assert(vfCycle5.immediate_shock_indicated === true, 'Shock indicated on Cycle 5');
    assert(vfCycle5.drug_recommendation.includes('Amiodarone 150 mg'), 'Recommends second dose Amiodarone 150mg IV/IO');

    // 5. Non-Shockable PEA / Asystole (No Shock, STAT Epinephrine, H's & T's)
    console.log('\nTest Group 5: Non-Shockable PEA Rhythm');
    const peaCycle1 = CodeNavigatorService.evaluateCodeCycle({
      current_rhythm: 'PEA',
      cycle_number: 1,
      time_in_code_seconds: 120,
      etco2_mmhg: 14,
      compression_fraction_percent: 82,
      epinephrine_doses_given: 0,
      amiodarone_mg_given: 0,
      lidocaine_mg_given: 0,
      h_and_t_findings: {
        hypovolemia: true,
        hyperkalemia: true
      }
    });

    assert(peaCycle1.rhythm_type === 'NON_SHOCKABLE', 'Rhythm is NON_SHOCKABLE');
    assert(peaCycle1.immediate_shock_indicated === false, 'Shock is contraindicated for PEA');
    assert(peaCycle1.drug_recommendation.includes('Epinephrine 1 mg IV/IO STAT'), 'Recommends STAT Epinephrine 1mg');
    assert(peaCycle1.reversible_cause_actions.some(r => r.includes('Hypovolemia')), 'Recommends rapid crystalloids for hypovolemia');
    assert(peaCycle1.reversible_cause_actions.some(r => r.includes('Calcium Chloride')), 'Recommends Calcium Chloride & Insulin-Dextrose for hyperkalemia');

    // 6. EtCO2 Evaluation: ROSC vs Poor CPR Quality
    console.log('\nTest Group 6: EtCO2 Monitoring (ROSC Spike vs CPR Quality)');
    const roscEval = CodeNavigatorService.evaluateCodeCycle({
      current_rhythm: 'PEA',
      cycle_number: 3,
      time_in_code_seconds: 360,
      etco2_mmhg: 42, // Spike >= 35 mmHg
      compression_fraction_percent: 85,
      epinephrine_doses_given: 2,
      amiodarone_mg_given: 0,
      lidocaine_mg_given: 0
    });

    assert(roscEval.etco2_status === 'ROSC_DETECTED', 'EtCO2 42 mmHg classified as ROSC_DETECTED');
    assert(roscEval.actionable_checklist.some(a => a.includes('ROSC DETECTED')), 'Flags immediate ROSC detection alert');

    const poorCprEval = CodeNavigatorService.evaluateCodeCycle({
      current_rhythm: 'ASYSTOLE',
      cycle_number: 2,
      time_in_code_seconds: 240,
      etco2_mmhg: 8, // < 10 mmHg
      compression_fraction_percent: 65, // < 80%
      epinephrine_doses_given: 1,
      amiodarone_mg_given: 0,
      lidocaine_mg_given: 0
    });

    assert(poorCprEval.etco2_status === 'POOR_CPR_QUALITY', 'EtCO2 8 mmHg classified as POOR_CPR_QUALITY');
    assert(poorCprEval.cpr_quality_alert.includes('below the 80% AHA target'), 'CCF 65% triggers CPR fraction warning');
    assert(poorCprEval.actionable_checklist.some(a => a.includes('Rotate compressor immediately')), 'Recommends immediate compressor rotation');

    // 7. Reversible Causes H's and T's Interventions
    console.log('\nTest Group 7: H\'s and T\'s Reversible Interventions');
    const htEval = CodeNavigatorService.evaluateCodeCycle({
      current_rhythm: 'PEA',
      cycle_number: 2,
      time_in_code_seconds: 240,
      etco2_mmhg: 15,
      compression_fraction_percent: 88,
      epinephrine_doses_given: 1,
      amiodarone_mg_given: 0,
      lidocaine_mg_given: 0,
      h_and_t_findings: {
        tension_pneumothorax: true,
        cardiac_tamponade: true,
        pulmonary_thrombosis: true
      }
    });

    assert(htEval.reversible_cause_actions.some(r => r.includes('needle decompression') || r.includes('finger thoracostomy')), 'Recommends needle decompression / finger thoracostomy');
    assert(htEval.reversible_cause_actions.some(r => r.includes('pericardiocentesis')), 'Recommends ultrasound-guided pericardiocentesis');
    assert(htEval.reversible_cause_actions.some(r => r.includes('Alteplase')), 'Recommends rescue Alteplase for massive PE');

    // 8. Post-Cardiac Arrest Care Bundle
    console.log('\nTest Group 8: Post-Cardiac Arrest Care Bundle');
    const postArrest = CodeNavigatorService.evaluatePostArrestCare({
      map_mmhg: 56, // Hypotensive (< 65)
      sbp_mmhg: 82, // (< 90)
      spo2_percent: 94,
      paco2_mmhg: 40,
      core_temperature_celsius: 37.2,
      stemi_on_12lead: true,
      comatose_unresponsive: true
    });

    assert(postArrest.ttm_protocol_indicated === true, 'TTM indicated for comatose post-ROSC patient');
    assert(postArrest.target_temperature_range.includes('32°C to 36°C'), 'Target temperature set to 32-36°C');
    assert(postArrest.hemodynamic_status === 'HYPOTENSIVE_PRESSOR_REQUIRED', 'Identified post-ROSC hypotension');
    assert(postArrest.pressor_guidance.includes('Norepinephrine'), 'Recommends Norepinephrine infusion');
    assert(postArrest.cath_lab_activation_indicated === true, 'Emergency Cath Lab activation indicated for STEMI');
    assert(postArrest.ventilation_targets.some(v => v.includes('SpO2 92% - 98%')), 'Normoxia targets specified (SpO2 92-98%)');
    assert(postArrest.ventilation_targets.some(v => v.includes('PaCO2 35 - 45 mmHg')), 'Normocapnia targets specified (PaCO2 35-45 mmHg)');

    // 9. Database Persistence & History Retrieval
    console.log('\nTest Group 9: Database Persistence & History Retrieval');
    let patientId = 1;
    const patRes = await pool.query('SELECT id FROM patients LIMIT 1');
    if (patRes.rows.length > 0) {
      patientId = patRes.rows[0].id;
    }

    // Start code event
    const codeEvent = await CodeNavigatorService.startCodeEvent({
      patient_id: patientId,
      initial_rhythm: 'VF',
      current_etco2_mmhg: 18,
      compression_fraction_percent: 85,
      h_and_t_checklist: { hypovolemia: false, hyperkalemia: false }
    });

    assert(Boolean(codeEvent.id), 'Successfully started and persisted code arrest event');
    assert(codeEvent.initial_rhythm === 'VF', 'Initial rhythm correctly recorded');
    assert(codeEvent.code_status === 'ACTIVE', 'Code status initialized to ACTIVE');

    // Log cycle 1
    const cycle1Log = await CodeNavigatorService.logCodeCycle({
      code_id: codeEvent.id,
      cycle_number: 1,
      rhythm_assessed: 'VF',
      shock_delivered: true,
      shock_energy_joules: 200,
      cycle_etco2_mmhg: 19,
      cycle_ccf_percent: 86,
      notes: 'First shock delivered at 200J; CPR resumed'
    });

    assert(Boolean(cycle1Log.id), 'Successfully recorded cycle 1 log');
    assert(cycle1Log.shock_delivered === true, 'Recorded shock delivery');

    // Log cycle 2 with Epinephrine
    const cycle2Log = await CodeNavigatorService.logCodeCycle({
      code_id: codeEvent.id,
      cycle_number: 2,
      rhythm_assessed: 'VF',
      shock_delivered: true,
      shock_energy_joules: 200,
      drug_administered: 'EPINEPHRINE_1MG',
      cycle_etco2_mmhg: 22,
      cycle_ccf_percent: 88,
      notes: 'Second shock delivered; Epinephrine 1mg IV given'
    });

    assert(Boolean(cycle2Log.id), 'Successfully recorded cycle 2 log');
    assert(cycle2Log.drug_administered === 'EPINEPHRINE_1MG', 'Recorded drug administration');

    // Update status to ROSC_ACHIEVED
    const updatedCode = await CodeNavigatorService.updateCodeStatus(codeEvent.id, 'ROSC_ACHIEVED', new Date());
    assert(updatedCode.code_status === 'ROSC_ACHIEVED', 'Updated code status to ROSC_ACHIEVED');
    assert(updatedCode.rosc_achieved === true, 'ROSC achieved boolean is true');

    // Retrieve patient history
    const history = await CodeNavigatorService.getPatientCodeHistory(patientId);
    assert(Array.isArray(history.code_events) && history.code_events.length > 0, 'Retrieved code arrest events');
    assert(Array.isArray(history.cycle_logs) && history.cycle_logs.length > 0, 'Retrieved code cycle logs');
    assert(history.code_events.some(c => c.id === codeEvent.id), 'Created code event present in history');

    console.log(`\n======================================================`);
    console.log(`Phase 80 CODE-NAVIGATOR Tests Complete: ${passedTests}/${totalTests} Passed (100%)`);
    console.log(`======================================================\n`);
  } catch (error) {
    console.error('Test execution failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
