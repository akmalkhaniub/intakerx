import React, { useState, useEffect } from 'react';

interface TensionPneumoResult {
  tension_pneumothorax_confirmed: boolean;
  immediate_decompression_required: boolean;
  needle_decompression_location: string;
  finger_thoracostomy_protocol: string;
  definitive_chest_tube_size: string;
  critical_action_checklist: string[];
}

interface PleuralDrainageResult {
  massive_hemothorax_detected: boolean;
  emergent_thoracotomy_indicated: boolean;
  air_leak_severity: 'RESOLVED' | 'MILD_INTERMITTENT' | 'MODERATE' | 'SEVERE_CONTINUOUS' | 'BRONCHOPLEURAL_FISTULA';
  suction_vs_water_seal_recommendation: string;
  chest_tube_removal_readiness: boolean;
  clinical_action_checklist: string[];
}

interface RibFractureFlailResult {
  flail_chest_confirmed: boolean;
  thoracic_trauma_severity: 'MILD' | 'MODERATE' | 'SEVERE_HIGH_RISK';
  ssrf_surgical_stabilization_indicated: boolean;
  regional_analgesia_recommendation: string;
  pulmonary_hygiene_protocol: string[];
  clinical_management_plan: string[];
}

export const PneumoDrainHub: React.FC = () => {
  const [patientId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'tension' | 'drainage' | 'ribs' | 'history'>('tension');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Tension Pneumo State
  const [hemoInstability, setHemoInstability] = useState<boolean>(true);
  const [absentBreathSounds, setAbsentBreathSounds] = useState<boolean>(true);
  const [trachealDeviation, setTrachealDeviation] = useState<boolean>(true);
  const [severeDyspnea, setSevereDyspnea] = useState<boolean>(true);
  const [anatomicalSide, setAnatomicalSide] = useState<'LEFT' | 'RIGHT'>('RIGHT');
  const [subcutEmphysema, setSubcutEmphysema] = useState<boolean>(true);
  const [tensionResult, setTensionResult] = useState<TensionPneumoResult | null>(null);

  // Pleural Drainage State
  const [initialOutput, setInitialOutput] = useState<number>(1650);
  const [hourlyDrainage, setHourlyDrainage] = useState<number>(120);
  const [hoursMonitored, setHoursMonitored] = useState<number>(2);
  const [fluidType, setFluidType] = useState<'FRANK_BLOOD' | 'SEROSANGUINOUS' | 'SEROUS' | 'PURULENT'>('FRANK_BLOOD');
  const [airLeakGrade, setAirLeakGrade] = useState<'NONE' | 'GRADE_1_COUGH' | 'GRADE_2_EXPIRATION' | 'GRADE_3_CONTINUOUS' | 'GRADE_4_BRONCHOPLEURAL'>('GRADE_1_COUGH');
  const [suctionVal, setSuctionVal] = useState<number>(-20);
  const [waterSealActive, setWaterSealActive] = useState<boolean>(false);
  const [drainageResult, setDrainageResult] = useState<PleuralDrainageResult | null>(null);

  // Rib Fractures & Flail State
  const [ribCount, setRibCount] = useState<number>(6);
  const [flailSegment, setFlailSegment] = useState<boolean>(true);
  const [bilateralRibs, setBilateralRibs] = useState<boolean>(false);
  const [contusionPresent, setContusionPresent] = useState<boolean>(true);
  const [patientAge, setPatientAge] = useState<number>(58);
  const [painScore, setPainScore] = useState<number>(8);
  const [intubatedRespFailure, setIntubatedRespFailure] = useState<boolean>(true);
  const [ribResult, setRibResult] = useState<RibFractureFlailResult | null>(null);

  // History State
  const [history, setHistory] = useState<{ tubes: any[]; drainage_logs: any[] }>({
    tubes: [],
    drainage_logs: []
  });

  const fetchHistory = async () => {
    try {
      const res = await fetch(`/api/clinician/thoracic/patients/${patientId}/history`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error('Failed to load thoracic history:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  const handleEvaluateTension = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const res = await fetch('/api/clinician/thoracic/evaluate-tension', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hemodynamic_instability: hemoInstability,
          unilateral_absent_breath_sounds: absentBreathSounds,
          tracheal_deviation: trachealDeviation,
          severe_dyspnea_cyanosis: severeDyspnea,
          anatomical_side: anatomicalSide,
          subcutaneous_emphysema: subcutEmphysema
        })
      });
      if (res.ok) {
        const data = await res.json();
        setTensionResult(data);
        setStatusMessage('Tension pneumothorax evaluated successfully.');
      } else {
        const err = await res.json();
        setStatusMessage(`Error: ${err.error || 'Failed to evaluate tension'}`);
      }
    } catch (err) {
      setStatusMessage('Network error evaluating tension pneumothorax.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEvaluateDrainage = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const res = await fetch('/api/clinician/thoracic/evaluate-drainage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initial_insertion_output_ml: Number(initialOutput),
          hourly_drainage_ml: Number(hourlyDrainage),
          hours_monitoring: Number(hoursMonitored),
          fluid_character: fluidType,
          air_leak_grade: airLeakGrade,
          current_suction_cmh2o: Number(suctionVal),
          water_seal_trial_active: waterSealActive
        })
      });
      if (res.ok) {
        const data = await res.json();
        setDrainageResult(data);
        setStatusMessage('Pleural drainage and thoracotomy triggers assessed.');
      } else {
        const err = await res.json();
        setStatusMessage(`Error: ${err.error || 'Failed to evaluate drainage'}`);
      }
    } catch (err) {
      setStatusMessage('Network error evaluating pleural drainage.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEvaluateRibs = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const res = await fetch('/api/clinician/thoracic/evaluate-rib-fractures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fractured_ribs_count: Number(ribCount),
          flail_segment_present: flailSegment,
          bilateral_fractures: bilateralRibs,
          pulmonary_contusion_present: contusionPresent,
          patient_age: Number(patientAge),
          pain_score_10: Number(painScore),
          respiratory_failure_intubated: intubatedRespFailure
        })
      });
      if (res.ok) {
        const data = await res.json();
        setRibResult(data);
        setStatusMessage('Rib fractures and flail chest evaluated.');
      } else {
        const err = await res.json();
        setStatusMessage(`Error: ${err.error || 'Failed to evaluate rib fractures'}`);
      }
    } catch (err) {
      setStatusMessage('Network error evaluating rib fractures.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px', backgroundColor: '#0f172a', minHeight: '100vh', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header Banner */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#06b6d4', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🫁</span> PNEUMO-DRAIN: Thoracic Trauma & Tube Thoracostomy Command
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
            Tension Pneumothorax Decompression • Massive Hemothorax / Thoracotomy Sentinel • Air Leak Grading & Water Seal Trials
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '6px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#67e8f9' }}>
            Active Patient: #{patientId}
          </span>
          <span style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '6px', backgroundColor: '#164e63', color: '#cffafe', fontWeight: 'bold' }}>
            Thoracic Trauma Protocol
          </span>
        </div>
      </div>

      {statusMessage && (
        <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', backgroundColor: statusMessage.startsWith('Error') ? '#7f1d1d' : '#14532d', color: '#f8fafc', fontSize: '13px' }}>
          {statusMessage}
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #334155', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('tension')}
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            border: 'none',
            background: 'none',
            color: activeTab === 'tension' ? '#06b6d4' : '#94a3b8',
            borderBottom: activeTab === 'tension' ? '2px solid #06b6d4' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          🚨 Tension Pneumo Decompression
        </button>
        <button
          onClick={() => setActiveTab('drainage')}
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            border: 'none',
            background: 'none',
            color: activeTab === 'drainage' ? '#06b6d4' : '#94a3b8',
            borderBottom: activeTab === 'drainage' ? '2px solid #06b6d4' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          🩸 Pleural Drainage & Thoracotomy
        </button>
        <button
          onClick={() => setActiveTab('ribs')}
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            border: 'none',
            background: 'none',
            color: activeTab === 'ribs' ? '#06b6d4' : '#94a3b8',
            borderBottom: activeTab === 'ribs' ? '2px solid #06b6d4' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          🦴 Flail Chest & SSRF Plating
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            border: 'none',
            background: 'none',
            color: activeTab === 'history' ? '#06b6d4' : '#94a3b8',
            borderBottom: activeTab === 'history' ? '2px solid #06b6d4' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          📋 Tube Registry & History
        </button>
      </div>

      {/* Tab 1: Tension Pneumo Decompression */}
      {activeTab === 'tension' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#67e8f9', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🚨</span> Tension Pneumothorax Assessment
            </h3>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Anatomical Side of Injury</label>
              <select
                value={anatomicalSide}
                onChange={(e) => setAnatomicalSide(e.target.value as any)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc', fontWeight: 'bold' }}
              >
                <option value="RIGHT">Right Hemithorax</option>
                <option value="LEFT">Left Hemithorax</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#f87171' }}>
                <input type="checkbox" checked={hemoInstability} onChange={(e) => setHemoInstability(e.target.checked)} />
                <span>Hemodynamic Instability / Obstructive Shock (SBP &lt; 90 mmHg)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#38bdf8' }}>
                <input type="checkbox" checked={absentBreathSounds} onChange={(e) => setAbsentBreathSounds(e.target.checked)} />
                <span>Unilateral Absent / Markedly Decreased Breath Sounds</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#f43f5e' }}>
                <input type="checkbox" checked={trachealDeviation} onChange={(e) => setTrachealDeviation(e.target.checked)} />
                <span>Tracheal Deviation Contralateral to Injured Side</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#fbbf24' }}>
                <input type="checkbox" checked={severeDyspnea} onChange={(e) => setSevereDyspnea(e.target.checked)} />
                <span>Severe Respiratory Distress / Agonal Cyanosis</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#cbd5e1' }}>
                <input type="checkbox" checked={subcutEmphysema} onChange={(e) => setSubcutEmphysema(e.target.checked)} />
                <span>Palpable Subcutaneous Emphysema (Chest Wall Crepitus)</span>
              </label>
            </div>

            <button
              onClick={handleEvaluateTension}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: '#0891b2',
                color: 'white',
                border: 'none',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {isLoading ? 'Assessing...' : 'Assess Tension Physiology & Decompression Plan'}
            </button>
          </div>

          {/* Tension Results */}
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#67e8f9' }}>
              ⚡ Emergent Decompression Directives
            </h3>

            {tensionResult ? (
              <div>
                <div style={{
                  padding: '14px',
                  borderRadius: '8px',
                  backgroundColor: tensionResult.tension_pneumothorax_confirmed ? '#7f1d1d' : '#14532d',
                  border: tensionResult.tension_pneumothorax_confirmed ? '2px solid #ef4444' : '1px solid #334155',
                  marginBottom: '16px'
                }}>
                  <span style={{ fontSize: '11px', color: '#cbd5e1', display: 'block' }}>Clinical Diagnosis</span>
                  <strong style={{ fontSize: '18px', color: '#f8fafc' }}>
                    {tensionResult.tension_pneumothorax_confirmed ? '🚨 TENSION PNEUMOTHORAX CONFIRMED' : 'STABLE / NON-TENSION'}
                  </strong>
                </div>

                <div style={{ marginBottom: '14px', padding: '12px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155' }}>
                  <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>Needle Decompression Landmark:</span>
                  <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1' }}>{tensionResult.needle_decompression_location}</p>
                </div>

                <div style={{ marginBottom: '14px', padding: '12px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155' }}>
                  <span style={{ fontSize: '11px', color: '#f43f5e', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>Finger Thoracostomy Protocol:</span>
                  <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1' }}>{tensionResult.finger_thoracostomy_protocol}</p>
                </div>

                <div style={{ marginBottom: '14px', padding: '10px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #334155' }}>
                  <span style={{ fontSize: '11px', color: '#a7f3d0' }}>Definitive Chest Tube Size:</span>
                  <strong style={{ display: 'block', fontSize: '14px', color: '#f8fafc' }}>{tensionResult.definitive_chest_tube_size}</strong>
                </div>

                {tensionResult.critical_action_checklist.length > 0 && (
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fbbf24', display: 'block', marginBottom: '6px' }}>
                      ⚡ Immediate Action Checklist:
                    </span>
                    <ul style={{ margin: 0, paddingLeft: '18px', color: '#fef08a', fontSize: '12px', lineHeight: '1.5' }}>
                      {tensionResult.critical_action_checklist.map((act, idx) => (
                        <li key={idx}>{act}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                <span style={{ fontSize: '40px', display: 'block', marginBottom: '12px' }}>🫁</span>
                Check physical exam and hemodynamic signs to generate tension pneumothorax decompression protocols.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Pleural Drainage & Thoracotomy Triggers */}
      {activeTab === 'drainage' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#67e8f9', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🩸</span> Drainage Telemetry & Air Leak Tracker
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Initial Output (mL)</label>
                <input
                  type="number"
                  value={initialOutput}
                  onChange={(e) => setInitialOutput(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                />
                <span style={{ fontSize: '11px', color: '#64748b' }}>Massive hemothorax: &ge; 1500 mL</span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Current Hourly Rate (mL/hr)</label>
                <input
                  type="number"
                  value={hourlyDrainage}
                  onChange={(e) => setHourlyDrainage(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                />
                <span style={{ fontSize: '11px', color: '#64748b' }}>Thoracotomy if &gt; 200 mL/hr for &ge; 2h</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Fluid Character</label>
                <select
                  value={fluidType}
                  onChange={(e) => setFluidType(e.target.value as any)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                >
                  <option value="FRANK_BLOOD">Frank Blood (Hemothorax)</option>
                  <option value="SEROSANGUINOUS">Serosanguinous</option>
                  <option value="SEROUS">Serous (Effusion)</option>
                  <option value="PURULENT">Purulent (Empyema)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Air Leak Grade</label>
                <select
                  value={airLeakGrade}
                  onChange={(e) => setAirLeakGrade(e.target.value as any)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                >
                  <option value="NONE">None (Resolved)</option>
                  <option value="GRADE_1_COUGH">Grade 1: Cough / Forced Expiration Only</option>
                  <option value="GRADE_2_EXPIRATION">Grade 2: Normal Expiration</option>
                  <option value="GRADE_3_CONTINUOUS">Grade 3: Continuous (Insp + Exp)</option>
                  <option value="GRADE_4_BRONCHOPLEURAL">Grade 4: Bronchopleural Fistula</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Hours of Monitoring</label>
                <input
                  type="number"
                  min="1"
                  value={hoursMonitored}
                  onChange={(e) => setHoursMonitored(parseInt(e.target.value, 10) || 1)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Suction Level (cmH2O)</label>
                <input
                  type="number"
                  value={suctionVal}
                  onChange={(e) => setSuctionVal(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '18px', padding: '10px', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#a7f3d0' }}>
                <input
                  type="checkbox"
                  checked={waterSealActive}
                  onChange={(e) => setWaterSealActive(e.target.checked)}
                />
                <span>Water-Seal Trial Active (Suction discontinued, gravity drainage)</span>
              </label>
            </div>

            <button
              onClick={handleEvaluateDrainage}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: '#0891b2',
                color: 'white',
                border: 'none',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              {isLoading ? 'Assessing...' : 'Evaluate Drainage & Thoracotomy Thresholds'}
            </button>
          </div>

          {/* Drainage Assessment Results */}
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#67e8f9' }}>
              🩺 Thoracotomy Triggers & Removal Status
            </h3>

            {drainageResult ? (
              <div>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <div style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: drainageResult.emergent_thoracotomy_indicated ? '#7f1d1d' : '#0f172a',
                    border: drainageResult.emergent_thoracotomy_indicated ? '2px solid #ef4444' : '1px solid #334155'
                  }}>
                    <span style={{ fontSize: '11px', color: '#cbd5e1', display: 'block' }}>OR Thoracotomy</span>
                    <strong style={{ fontSize: '16px', color: drainageResult.emergent_thoracotomy_indicated ? '#fca5a5' : '#10b981' }}>
                      {drainageResult.emergent_thoracotomy_indicated ? 'STAT THORACOTOMY' : 'CONSERVATIVE'}
                    </strong>
                  </div>

                  <div style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: drainageResult.chest_tube_removal_readiness ? '#14532d' : '#0f172a',
                    border: '1px solid #334155'
                  }}>
                    <span style={{ fontSize: '11px', color: '#cbd5e1', display: 'block' }}>Removal Readiness</span>
                    <strong style={{ fontSize: '16px', color: drainageResult.chest_tube_removal_readiness ? '#86efac' : '#94a3b8' }}>
                      {drainageResult.chest_tube_removal_readiness ? 'READY TO PULL' : 'KEEP IN PLACE'}
                    </strong>
                  </div>
                </div>

                <div style={{ marginBottom: '14px', padding: '12px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155' }}>
                  <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>Suction / Water-Seal Recommendation:</span>
                  <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1' }}>{drainageResult.suction_vs_water_seal_recommendation}</p>
                </div>

                <div style={{ marginBottom: '14px', padding: '10px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #334155' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>Air Leak Severity:</span>
                  <strong style={{ display: 'block', fontSize: '14px', color: '#67e8f9' }}>{drainageResult.air_leak_severity}</strong>
                </div>

                {drainageResult.clinical_action_checklist.length > 0 && (
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fb7185', display: 'block', marginBottom: '6px' }}>
                      📋 Clinical Actions & Safeguards:
                    </span>
                    <ul style={{ margin: 0, paddingLeft: '18px', color: '#fca5a5', fontSize: '12px', lineHeight: '1.5' }}>
                      {drainageResult.clinical_action_checklist.map((act, idx) => (
                        <li key={idx}>{act}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                <span style={{ fontSize: '40px', display: 'block', marginBottom: '12px' }}>🩸</span>
                Enter chest tube output and air leak grade to screen for massive hemothorax and evaluate removal readiness.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Flail Chest & SSRF Plating */}
      {activeTab === 'ribs' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#67e8f9', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🦴</span> Thoracic Wall Trauma & Rib Fractures
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Fractured Ribs Count</label>
                <input
                  type="number"
                  min="0"
                  value={ribCount}
                  onChange={(e) => setRibCount(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Patient Age</label>
                <input
                  type="number"
                  value={patientAge}
                  onChange={(e) => setPatientAge(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                <span>Inspiratory Pain Score (NRS 0-10)</span>
                <span style={{ color: painScore >= 7 ? '#ef4444' : '#67e8f9', fontWeight: 'bold' }}>{painScore}/10</span>
              </label>
              <input
                type="range"
                min="0"
                max="10"
                value={painScore}
                onChange={(e) => setPainScore(parseInt(e.target.value, 10))}
                style={{ width: '100%', accentColor: '#06b6d4' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#f87171' }}>
                <input type="checkbox" checked={flailSegment} onChange={(e) => setFlailSegment(e.target.checked)} />
                <span>Flail Segment Present (Paradoxical inward motion on inspiration)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#38bdf8' }}>
                <input type="checkbox" checked={bilateralRibs} onChange={(e) => setBilateralRibs(e.target.checked)} />
                <span>Bilateral Rib Fractures</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#fbbf24' }}>
                <input type="checkbox" checked={contusionPresent} onChange={(e) => setContusionPresent(e.target.checked)} />
                <span>Pulmonary Contusion on Chest CT</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#f43f5e' }}>
                <input type="checkbox" checked={intubatedRespFailure} onChange={(e) => setIntubatedRespFailure(e.target.checked)} />
                <span>Respiratory Failure / Mechanical Ventilation</span>
              </label>
            </div>

            <button
              onClick={handleEvaluateRibs}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: '#0891b2',
                color: 'white',
                border: 'none',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              {isLoading ? 'Assessing...' : 'Evaluate Flail Chest & SSRF Plating'}
            </button>
          </div>

          {/* Rib Results */}
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#67e8f9' }}>
              🔩 Surgical Stabilization (SSRF) & Regional Blocks
            </h3>

            {ribResult ? (
              <div>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <div style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: ribResult.flail_chest_confirmed ? '#7f1d1d' : '#0f172a',
                    border: '1px solid #334155'
                  }}>
                    <span style={{ fontSize: '11px', color: '#cbd5e1', display: 'block' }}>Flail Chest</span>
                    <strong style={{ fontSize: '16px', color: '#f8fafc' }}>
                      {ribResult.flail_chest_confirmed ? 'FLAIL CHEST' : 'SIMPLE FRACTURES'}
                    </strong>
                  </div>

                  <div style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: ribResult.ssrf_surgical_stabilization_indicated ? '#164e63' : '#0f172a',
                    border: ribResult.ssrf_surgical_stabilization_indicated ? '2px solid #06b6d4' : '1px solid #334155'
                  }}>
                    <span style={{ fontSize: '11px', color: '#cbd5e1', display: 'block' }}>SSRF Plating</span>
                    <strong style={{ fontSize: '14px', color: ribResult.ssrf_surgical_stabilization_indicated ? '#67e8f9' : '#94a3b8' }}>
                      {ribResult.ssrf_surgical_stabilization_indicated ? 'SURGERY INDICATED' : 'CONSERVATIVE'}
                    </strong>
                  </div>
                </div>

                <div style={{ marginBottom: '14px', padding: '12px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155' }}>
                  <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>Regional Analgesia Recommendation:</span>
                  <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1' }}>{ribResult.regional_analgesia_recommendation}</p>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#a7f3d0', display: 'block', marginBottom: '4px' }}>
                    Pulmonary Hygiene Protocol:
                  </span>
                  <ul style={{ margin: 0, paddingLeft: '18px', color: '#d1fae5', fontSize: '12px', lineHeight: '1.5' }}>
                    {ribResult.pulmonary_hygiene_protocol.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ul>
                </div>

                {ribResult.clinical_management_plan.length > 0 && (
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fbbf24', display: 'block', marginBottom: '4px' }}>
                      Clinical Directives:
                    </span>
                    <ul style={{ margin: 0, paddingLeft: '18px', color: '#fef08a', fontSize: '12px', lineHeight: '1.5' }}>
                      {ribResult.clinical_management_plan.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                <span style={{ fontSize: '40px', display: 'block', marginBottom: '12px' }}>🦴</span>
                Enter rib fracture details to assess flail chest severity, surgical stabilization (SSRF), and regional analgesia.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Tube Registry & History */}
      {activeTab === 'history' && (
        <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: '#67e8f9' }}>
              📋 Thoracic Drainage Tubes & Output Logs
            </h3>
            <button
              onClick={fetchHistory}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                backgroundColor: '#334155',
                color: '#f8fafc',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              🔄 Refresh Logs
            </button>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ fontSize: '14px', color: '#38bdf8', margin: '0 0 10px 0' }}>Active Thoracic Drainage Tubes</h4>
            {history.tubes.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #475569', color: '#94a3b8' }}>
                    <th style={{ padding: '8px' }}>ID</th>
                    <th style={{ padding: '8px' }}>Side</th>
                    <th style={{ padding: '8px' }}>Size</th>
                    <th style={{ padding: '8px' }}>Indication</th>
                    <th style={{ padding: '8px' }}>Initial (mL)</th>
                    <th style={{ padding: '8px' }}>Suction</th>
                    <th style={{ padding: '8px' }}>Water Seal</th>
                  </tr>
                </thead>
                <tbody>
                  {history.tubes.map((tb: any) => (
                    <tr key={tb.id} style={{ borderBottom: '1px solid #334155', color: '#f8fafc' }}>
                      <td style={{ padding: '8px' }}>#{tb.id}</td>
                      <td style={{ padding: '8px', color: '#67e8f9', fontWeight: 'bold' }}>{tb.anatomical_side}</td>
                      <td style={{ padding: '8px' }}>{tb.tube_size_fr} Fr</td>
                      <td style={{ padding: '8px' }}>{tb.indication}</td>
                      <td style={{ padding: '8px' }}>{tb.initial_output_ml} mL</td>
                      <td style={{ padding: '8px' }}>{tb.current_suction_cmh2o} cmH2O</td>
                      <td style={{ padding: '8px', color: tb.water_seal_trial_active ? '#86efac' : '#94a3b8' }}>
                        {tb.water_seal_trial_active ? 'ACTIVE TRIAL' : 'NO'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: '#64748b', fontSize: '13px' }}>No thoracic drainage tubes recorded for this patient.</p>
            )}
          </div>

          <div>
            <h4 style={{ fontSize: '14px', color: '#f87171', margin: '0 0 10px 0' }}>Hourly Pleural Drainage Logs</h4>
            {history.drainage_logs.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #475569', color: '#94a3b8' }}>
                    <th style={{ padding: '8px' }}>Logged At</th>
                    <th style={{ padding: '8px' }}>Tube</th>
                    <th style={{ padding: '8px' }}>Hourly (mL)</th>
                    <th style={{ padding: '8px' }}>24h Total (mL)</th>
                    <th style={{ padding: '8px' }}>Character</th>
                    <th style={{ padding: '8px' }}>Air Leak</th>
                    <th style={{ padding: '8px' }}>Thoracotomy</th>
                  </tr>
                </thead>
                <tbody>
                  {history.drainage_logs.map((log: any) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #334155', color: '#f8fafc' }}>
                      <td style={{ padding: '8px' }}>{new Date(log.logged_at).toLocaleTimeString()}</td>
                      <td style={{ padding: '8px' }}>#{log.tube_id} ({log.anatomical_side})</td>
                      <td style={{ padding: '8px', color: '#f87171', fontWeight: 'bold' }}>{log.hourly_output_ml} mL/hr</td>
                      <td style={{ padding: '8px' }}>{log.cumulative_24h_output_ml} mL</td>
                      <td style={{ padding: '8px' }}>{log.fluid_character}</td>
                      <td style={{ padding: '8px' }}>{log.air_leak_grade}</td>
                      <td style={{ padding: '8px', color: log.emergent_thoracotomy_indicated ? '#ef4444' : '#10b981' }}>
                        {log.emergent_thoracotomy_indicated ? 'YES' : 'NO'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: '#64748b', fontSize: '13px' }}>No drainage logs recorded for this patient.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
