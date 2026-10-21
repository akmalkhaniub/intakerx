import React, { useState, useEffect } from 'react';

interface CodeEvaluationResult {
  rhythm_type: 'SHOCKABLE' | 'NON_SHOCKABLE';
  immediate_shock_indicated: boolean;
  shock_energy_joules?: number;
  drug_recommendation: string;
  next_drug_due_cycle?: number;
  etco2_status: 'ROSC_DETECTED' | 'ADEQUATE_CPR' | 'POOR_CPR_QUALITY';
  etco2_action: string;
  cpr_quality_alert: string;
  reversible_cause_actions: string[];
  actionable_checklist: string[];
}

interface PostArrestCareResult {
  ttm_protocol_indicated: boolean;
  target_temperature_range: string;
  hemodynamic_status: 'OPTIMAL' | 'HYPOTENSIVE_PRESSOR_REQUIRED';
  pressor_guidance: string;
  cath_lab_activation_indicated: boolean;
  ventilation_targets: string[];
  post_arrest_action_plan: string[];
}

export const CodeNavigatorHub: React.FC = () => {
  const [patientId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'acls' | 'h_and_t' | 'post_arrest' | 'history'>('acls');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Active Code State
  const [currentRhythm, setCurrentRhythm] = useState<'VF' | 'PVT' | 'PEA' | 'ASYSTOLE'>('VF');
  const [cycleNumber, setCycleNumber] = useState<number>(1);
  const [etco2, setEtco2] = useState<number>(22);
  const [ccfPercent, setCcfPercent] = useState<number>(85);
  const [epiDoses, setEpiDoses] = useState<number>(0);
  const [amiodaroneMg, setAmiodaroneMg] = useState<number>(0);
  const [lidocaineMg, setLidocaineMg] = useState<number>(0);

  // H's and T's findings
  const [hypovolemia, setHypovolemia] = useState<boolean>(false);
  const [hypoxia, setHypoxia] = useState<boolean>(false);
  const [acidosis, setAcidosis] = useState<boolean>(false);
  const [hyperkalemia, setHyperkalemia] = useState<boolean>(false);
  const [hypothermia, setHypothermia] = useState<boolean>(false);
  const [tensionPneumo, setTensionPneumo] = useState<boolean>(false);
  const [tamponade, setTamponade] = useState<boolean>(false);
  const [toxins, setToxins] = useState<boolean>(false);
  const [peThrombosis, setPeThrombosis] = useState<boolean>(false);
  const [coronaryThrombosis, setCoronaryThrombosis] = useState<boolean>(false);

  const [codeResult, setCodeResult] = useState<CodeEvaluationResult | null>(null);

  // Post-Arrest State
  const [mapVal, setMapVal] = useState<number>(58);
  const [sbpVal, setSbpVal] = useState<number>(84);
  const [spo2Val, setSpo2Val] = useState<number>(94);
  const [paco2Val, setPaco2Val] = useState<number>(40);
  const [coreTempVal, setCoreTempVal] = useState<number>(37.1);
  const [stemiEcg, setStemiEcg] = useState<boolean>(true);
  const [comatose, setComatose] = useState<boolean>(true);
  const [postArrestResult, setPostArrestResult] = useState<PostArrestCareResult | null>(null);

  // History State
  const [history, setHistory] = useState<{ code_events: any[]; cycle_logs: any[] }>({
    code_events: [],
    cycle_logs: []
  });

  const fetchHistory = async () => {
    try {
      const res = await fetch(`/api/clinician/code/patients/${patientId}/history`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error('Failed to load code history:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  const handleEvaluateCycle = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const res = await fetch('/api/clinician/code/evaluate-cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_rhythm: currentRhythm,
          cycle_number: Number(cycleNumber),
          time_in_code_seconds: cycleNumber * 120,
          etco2_mmhg: Number(etco2),
          compression_fraction_percent: Number(ccfPercent),
          epinephrine_doses_given: Number(epiDoses),
          amiodarone_mg_given: Number(amiodaroneMg),
          lidocaine_mg_given: Number(lidocaineMg),
          h_and_t_findings: {
            hypovolemia,
            hypoxia,
            acidosis,
            hyperkalemia,
            hypothermia,
            tension_pneumothorax: tensionPneumo,
            cardiac_tamponade: tamponade,
            toxins,
            pulmonary_thrombosis: peThrombosis,
            coronary_thrombosis: coronaryThrombosis
          }
        })
      });
      if (res.ok) {
        const data = await res.json();
        setCodeResult(data);
        setStatusMessage(`Cycle #${cycleNumber} evaluated successfully.`);
      } else {
        const err = await res.json();
        setStatusMessage(`Error: ${err.error || 'Failed to evaluate cycle'}`);
      }
    } catch (err) {
      setStatusMessage('Network error evaluating code cycle.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEvaluatePostArrest = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const res = await fetch('/api/clinician/code/evaluate-post-arrest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          map_mmhg: Number(mapVal),
          sbp_mmhg: Number(sbpVal),
          spo2_percent: Number(spo2Val),
          paco2_mmhg: Number(paco2Val),
          core_temperature_celsius: Number(coreTempVal),
          stemi_on_12lead: stemiEcg,
          comatose_unresponsive: comatose
        })
      });
      if (res.ok) {
        const data = await res.json();
        setPostArrestResult(data);
        setStatusMessage('Post-arrest care bundle calculated successfully.');
      } else {
        const err = await res.json();
        setStatusMessage(`Error: ${err.error || 'Failed to evaluate post-arrest bundle'}`);
      }
    } catch (err) {
      setStatusMessage('Network error evaluating post-arrest bundle.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px', backgroundColor: '#0f172a', minHeight: '100vh', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header Banner */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚡</span> CODE-NAVIGATOR: Advanced Cardiac Life Support (ACLS 2025)
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
            AHA ACLS Real-Time Cycle Stopwatch • EtCO2 ROSC Sentinel • Compression Fraction (CCF) • Reversible H's & T's
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '6px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f87171' }}>
            Active Patient: #{patientId}
          </span>
          <span style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '6px', backgroundColor: '#7f1d1d', color: '#fecaca', fontWeight: 'bold' }}>
            CODE BLUE ACTIVE
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
          onClick={() => setActiveTab('acls')}
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            border: 'none',
            background: 'none',
            color: activeTab === 'acls' ? '#ef4444' : '#94a3b8',
            borderBottom: activeTab === 'acls' ? '2px solid #ef4444' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          ⏱️ Real-Time 2-Min Cycle Navigator
        </button>
        <button
          onClick={() => setActiveTab('h_and_t')}
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            border: 'none',
            background: 'none',
            color: activeTab === 'h_and_t' ? '#ef4444' : '#94a3b8',
            borderBottom: activeTab === 'h_and_t' ? '2px solid #ef4444' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          🔍 Reversible Causes (H's & T's)
        </button>
        <button
          onClick={() => setActiveTab('post_arrest')}
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            border: 'none',
            background: 'none',
            color: activeTab === 'post_arrest' ? '#ef4444' : '#94a3b8',
            borderBottom: activeTab === 'post_arrest' ? '2px solid #ef4444' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          🧊 Post-ROSC Care & TTM
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
            color: activeTab === 'history' ? '#ef4444' : '#94a3b8',
            borderBottom: activeTab === 'history' ? '2px solid #ef4444' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          📋 Code History & Logs
        </button>
      </div>

      {/* Tab 1: ACLS Real-Time Cycle Navigator */}
      {activeTab === 'acls' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⚡</span> Rhythm & CPR Telemetry Inputs
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Current Rhythm</label>
                <select
                  value={currentRhythm}
                  onChange={(e) => setCurrentRhythm(e.target.value as any)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc', fontWeight: 'bold' }}
                >
                  <option value="VF">Ventricular Fibrillation (VF) - Shockable</option>
                  <option value="PVT">Pulseless VT (pVT) - Shockable</option>
                  <option value="PEA">Pulseless Electrical Activity (PEA) - Non-shockable</option>
                  <option value="ASYSTOLE">Asystole - Non-shockable</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Current 2-Min Cycle #</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="number"
                    min="1"
                    value={cycleNumber}
                    onChange={(e) => setCycleNumber(parseInt(e.target.value, 10) || 1)}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc', fontWeight: 'bold' }}
                  />
                  <button
                    onClick={() => setCycleNumber(c => c + 1)}
                    style={{ padding: '0 12px', borderRadius: '6px', backgroundColor: '#334155', color: '#f8fafc', border: 'none', cursor: 'pointer' }}
                  >
                    +1
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>EtCO2 (mmHg)</label>
                <input
                  type="number"
                  value={etco2}
                  onChange={(e) => setEtco2(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                />
                <span style={{ fontSize: '11px', color: '#64748b' }}>&ge; 35: ROSC | &lt; 10: Ineffective CPR</span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Chest Compression Fraction (%)</label>
                <input
                  type="number"
                  value={ccfPercent}
                  onChange={(e) => setCcfPercent(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                />
                <span style={{ fontSize: '11px', color: '#64748b' }}>AHA Quality Target: &ge; 80%</span>
              </div>
            </div>

            <h4 style={{ margin: '14px 0 8px 0', fontSize: '13px', color: '#cbd5e1' }}>Cumulative Resuscitation Drugs Administered</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8' }}>Epi Doses (1mg)</label>
                <input
                  type="number"
                  value={epiDoses}
                  onChange={(e) => setEpiDoses(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%', padding: '6px', borderRadius: '4px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8' }}>Amiodarone (mg)</label>
                <input
                  type="number"
                  value={amiodaroneMg}
                  onChange={(e) => setAmiodaroneMg(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%', padding: '6px', borderRadius: '4px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8' }}>Lidocaine (mg)</label>
                <input
                  type="number"
                  value={lidocaineMg}
                  onChange={(e) => setLidocaineMg(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%', padding: '6px', borderRadius: '4px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                />
              </div>
            </div>

            <button
              onClick={handleEvaluateCycle}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: '#dc2626',
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
              {isLoading ? 'Assessing...' : `Evaluate ACLS Cycle #${cycleNumber} Action Plan`}
            </button>
          </div>

          {/* ACLS Real-Time Recommendations */}
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#f87171' }}>
              🚨 Real-Time ACLS Clinical Directives
            </h3>

            {codeResult ? (
              <div>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <div style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: codeResult.immediate_shock_indicated ? '#7f1d1d' : '#0f172a',
                    border: codeResult.immediate_shock_indicated ? '2px solid #ef4444' : '1px solid #334155'
                  }}>
                    <span style={{ fontSize: '11px', color: '#cbd5e1', display: 'block' }}>Defibrillation</span>
                    <strong style={{ fontSize: '18px', color: codeResult.immediate_shock_indicated ? '#fca5a5' : '#94a3b8' }}>
                      {codeResult.immediate_shock_indicated ? `⚡ SHOCK (${codeResult.shock_energy_joules}J)` : '⛔ NO SHOCK'}
                    </strong>
                  </div>

                  <div style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: codeResult.etco2_status === 'ROSC_DETECTED' ? '#14532d' : codeResult.etco2_status === 'POOR_CPR_QUALITY' ? '#7f1d1d' : '#0f172a',
                    border: '1px solid #334155'
                  }}>
                    <span style={{ fontSize: '11px', color: '#cbd5e1', display: 'block' }}>EtCO2 Telemetry</span>
                    <strong style={{ fontSize: '16px', color: '#f8fafc' }}>{codeResult.etco2_status}</strong>
                  </div>
                </div>

                <div style={{ marginBottom: '14px', padding: '12px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#38bdf8', display: 'block', marginBottom: '4px' }}>
                    Pharmacology Recommendation:
                  </span>
                  <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1' }}>{codeResult.drug_recommendation}</p>
                </div>

                <div style={{ marginBottom: '14px', padding: '10px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #334155' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>CPR Performance Alert:</span>
                  <p style={{ margin: 0, fontSize: '12px', color: '#fef08a' }}>{codeResult.cpr_quality_alert}</p>
                </div>

                {codeResult.actionable_checklist.length > 0 && (
                  <div style={{ marginBottom: '14px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fb7185', display: 'block', marginBottom: '6px' }}>
                      ⚡ Immediate Bedside Directives:
                    </span>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#fca5a5', fontSize: '13px', lineHeight: '1.5' }}>
                      {codeResult.actionable_checklist.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {codeResult.reversible_cause_actions.length > 0 && (
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#a7f3d0', display: 'block', marginBottom: '6px' }}>
                      🔍 Active H's and T's Interventions:
                    </span>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#d1fae5', fontSize: '12px', lineHeight: '1.5' }}>
                      {codeResult.reversible_cause_actions.map((act, idx) => (
                        <li key={idx}>{act}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                <span style={{ fontSize: '40px', display: 'block', marginBottom: '12px' }}>⏱️</span>
                Select rhythm and cycle parameters to evaluate real-time ACLS 2025 directives.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Reversible Causes (H's & T's) */}
      {activeTab === 'h_and_t' && (
        <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#f87171' }}>
            🔍 Reversible Causes Differential Matrix (H's & T's Checklist)
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* The 5 H's */}
            <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#38bdf8' }}>The 5 H's</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={hypovolemia} onChange={(e) => setHypovolemia(e.target.checked)} />
                  <span>Hypovolemia (Bleeding, severe dehydration)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={hypoxia} onChange={(e) => setHypoxia(e.target.checked)} />
                  <span>Hypoxia (Airway obstruction, acute respiratory failure)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={acidosis} onChange={(e) => setAcidosis(e.target.checked)} />
                  <span>Hydrogen Ion / Acidosis (Severe metabolic acidemia)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={hyperkalemia} onChange={(e) => setHyperkalemia(e.target.checked)} />
                  <span>Hyperkalemia / Hypokalemia (Renal failure, dialysis gap)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={hypothermia} onChange={(e) => setHypothermia(e.target.checked)} />
                  <span>Hypothermia (Accidental environmental exposure)</span>
                </label>
              </div>
            </div>

            {/* The 5 T's */}
            <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#f43f5e' }}>The 5 T's</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={tensionPneumo} onChange={(e) => setTensionPneumo(e.target.checked)} />
                  <span>Tension Pneumothorax (Tracheal deviation, absent breath sounds)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={tamponade} onChange={(e) => setTamponade(e.target.checked)} />
                  <span>Tamponade (Cardiac - muffled heart sounds, JVD)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={toxins} onChange={(e) => setToxins(e.target.checked)} />
                  <span>Toxins (Opioids, CCB/beta-blockers, tricyclics)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={peThrombosis} onChange={(e) => setPeThrombosis(e.target.checked)} />
                  <span>Thrombosis (Pulmonary Embolism - Massive PE)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={coronaryThrombosis} onChange={(e) => setCoronaryThrombosis(e.target.checked)} />
                  <span>Thrombosis (Coronary - Acute Myocardial Infarction)</span>
                </label>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <button
              onClick={() => setActiveTab('acls')}
              style={{
                padding: '10px 24px',
                borderRadius: '8px',
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Apply Findings & Return to Cycle Navigator
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: Post-ROSC Care & TTM */}
      {activeTab === 'post_arrest' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#f87171' }}>
              🧊 Post-Cardiac Arrest Hemodynamics & Physiology
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>MAP (mmHg)</label>
                <input
                  type="number"
                  value={mapVal}
                  onChange={(e) => setMapVal(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>SBP (mmHg)</label>
                <input
                  type="number"
                  value={sbpVal}
                  onChange={(e) => setSbpVal(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>SpO2 (%)</label>
                <input
                  type="number"
                  value={spo2Val}
                  onChange={(e) => setSpo2Val(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>PaCO2 (mmHg)</label>
                <input
                  type="number"
                  value={paco2Val}
                  onChange={(e) => setPaco2Val(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Core Temperature (°C)</label>
              <input
                type="number"
                step="0.1"
                value={coreTempVal}
                onChange={(e) => setCoreTempVal(parseFloat(e.target.value) || 0)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#f87171' }}>
                <input type="checkbox" checked={stemiEcg} onChange={(e) => setStemiEcg(e.target.checked)} />
                <span>12-Lead ECG Confirms ST-Elevation Myocardial Infarction (STEMI)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#38bdf8' }}>
                <input type="checkbox" checked={comatose} onChange={(e) => setComatose(e.target.checked)} />
                <span>Comatose / Unresponsive Post-ROSC (Candidate for TTM)</span>
              </label>
            </div>

            <button
              onClick={handleEvaluatePostArrest}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              {isLoading ? 'Assessing...' : 'Generate Post-ROSC Care Bundle'}
            </button>
          </div>

          {/* Post-Arrest Results */}
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#f87171' }}>
              🧊 Post-ROSC Neuro-Protection & Hemodynamic Protocol
            </h3>

            {postArrestResult ? (
              <div>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <div style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: postArrestResult.ttm_protocol_indicated ? '#1e3a8a' : '#0f172a',
                    border: '1px solid #3b82f6'
                  }}>
                    <span style={{ fontSize: '11px', color: '#cbd5e1', display: 'block' }}>TTM Protocol</span>
                    <strong style={{ fontSize: '14px', color: '#93c5fd' }}>
                      {postArrestResult.ttm_protocol_indicated ? 'ACTIVE TTM (32-36°C)' : 'NORMOTHERMIA'}
                    </strong>
                  </div>

                  <div style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: postArrestResult.cath_lab_activation_indicated ? '#7f1d1d' : '#0f172a',
                    border: '1px solid #ef4444'
                  }}>
                    <span style={{ fontSize: '11px', color: '#cbd5e1', display: 'block' }}>Cath Lab</span>
                    <strong style={{ fontSize: '14px', color: postArrestResult.cath_lab_activation_indicated ? '#fca5a5' : '#10b981' }}>
                      {postArrestResult.cath_lab_activation_indicated ? 'STAT CATH LAB' : 'ELECTIVE / EVAL'}
                    </strong>
                  </div>
                </div>

                <div style={{ marginBottom: '14px', padding: '12px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#f87171', display: 'block', marginBottom: '4px' }}>
                    Hemodynamic & Pressor Strategy:
                  </span>
                  <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1' }}>{postArrestResult.pressor_guidance}</p>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#38bdf8', display: 'block', marginBottom: '4px' }}>
                    Ventilation & Oxygenation Safeguards:
                  </span>
                  <ul style={{ margin: 0, paddingLeft: '18px', color: '#bae6fd', fontSize: '12px', lineHeight: '1.5' }}>
                    {postArrestResult.ventilation_targets.map((tgt, idx) => (
                      <li key={idx}>{tgt}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#a7f3d0', display: 'block', marginBottom: '4px' }}>
                    Action Plan & Next Steps:
                  </span>
                  <ul style={{ margin: 0, paddingLeft: '18px', color: '#d1fae5', fontSize: '12px', lineHeight: '1.5' }}>
                    {postArrestResult.post_arrest_action_plan.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                <span style={{ fontSize: '40px', display: 'block', marginBottom: '12px' }}>🧊</span>
                Enter post-ROSC vitals and ECG findings to calculate targeted temperature management and cath lab routing.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Code History & Logs */}
      {activeTab === 'history' && (
        <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: '#f87171' }}>
              📋 Patient Cardiac Arrest Code Logs
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
            <h4 style={{ fontSize: '14px', color: '#38bdf8', margin: '0 0 10px 0' }}>Code Arrest Encounters</h4>
            {history.code_events.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #475569', color: '#94a3b8' }}>
                    <th style={{ padding: '8px' }}>Start Time</th>
                    <th style={{ padding: '8px' }}>Initial Rhythm</th>
                    <th style={{ padding: '8px' }}>Cycles</th>
                    <th style={{ padding: '8px' }}>Shocks</th>
                    <th style={{ padding: '8px' }}>Status</th>
                    <th style={{ padding: '8px' }}>ROSC</th>
                  </tr>
                </thead>
                <tbody>
                  {history.code_events.map((ev: any) => (
                    <tr key={ev.id} style={{ borderBottom: '1px solid #334155', color: '#f8fafc' }}>
                      <td style={{ padding: '8px' }}>{new Date(ev.code_start_time).toLocaleTimeString()}</td>
                      <td style={{ padding: '8px', color: '#f87171', fontWeight: 'bold' }}>{ev.initial_rhythm}</td>
                      <td style={{ padding: '8px' }}>{ev.cycle_count}</td>
                      <td style={{ padding: '8px' }}>{ev.total_shocks_delivered}</td>
                      <td style={{ padding: '8px' }}>{ev.code_status}</td>
                      <td style={{ padding: '8px', color: ev.rosc_achieved ? '#10b981' : '#ef4444' }}>
                        {ev.rosc_achieved ? 'YES (ROSC)' : 'NO'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: '#64748b', fontSize: '13px' }}>No code arrest events recorded for this patient.</p>
            )}
          </div>

          <div>
            <h4 style={{ fontSize: '14px', color: '#f87171', margin: '0 0 10px 0' }}>2-Minute Cycle Interventions</h4>
            {history.cycle_logs.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #475569', color: '#94a3b8' }}>
                    <th style={{ padding: '8px' }}>Cycle #</th>
                    <th style={{ padding: '8px' }}>Rhythm</th>
                    <th style={{ padding: '8px' }}>Shock</th>
                    <th style={{ padding: '8px' }}>Drug Administered</th>
                    <th style={{ padding: '8px' }}>EtCO2</th>
                    <th style={{ padding: '8px' }}>CCF %</th>
                  </tr>
                </thead>
                <tbody>
                  {history.cycle_logs.map((cy: any) => (
                    <tr key={cy.id} style={{ borderBottom: '1px solid #334155', color: '#f8fafc' }}>
                      <td style={{ padding: '8px' }}>Cycle #{cy.cycle_number}</td>
                      <td style={{ padding: '8px', color: '#f87171', fontWeight: 'bold' }}>{cy.rhythm_assessed}</td>
                      <td style={{ padding: '8px', color: cy.shock_delivered ? '#f87171' : '#94a3b8' }}>
                        {cy.shock_delivered ? `${cy.shock_energy_joules}J` : 'None'}
                      </td>
                      <td style={{ padding: '8px', color: '#38bdf8' }}>{cy.drug_administered || 'None'}</td>
                      <td style={{ padding: '8px' }}>{cy.cycle_etco2_mmhg ? `${cy.cycle_etco2_mmhg} mmHg` : '—'}</td>
                      <td style={{ padding: '8px' }}>{cy.cycle_ccf_percent ? `${cy.cycle_ccf_percent}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: '#64748b', fontSize: '13px' }}>No cycle logs recorded for this patient.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
