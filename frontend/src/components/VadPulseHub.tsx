import React, { useState, useEffect } from 'react';

interface ImpellaAssessmentResult {
  status: 'OPTIMAL' | 'SUCTION_EVENT' | 'PURGE_SYSTEM_ALARM' | 'MALPOSITION_SUSPECTED' | 'HYPOVOLEMIA';
  recommended_p_level: string;
  purge_system_action: string;
  hemodynamic_guidance: string[];
  bedside_interventions: string[];
}

interface DurableLvadTelemetryResult {
  alarm_classification: 'NORMAL' | 'LOW_FLOW' | 'PUMP_THROMBOSIS_SUSPECTED' | 'HYPERTENSION_HIGH_AFTERLOAD' | 'SUCTION_COLLAPSE';
  thrombosis_risk_level: 'LOW' | 'MODERATE' | 'HIGH_CRITICAL';
  afterload_status: 'OPTIMAL_70_80' | 'HYPERTENSIVE_HIGH_RISK' | 'HYPOTENSIVE';
  power_differential_watts: number;
  pi_differential: number;
  anticoagulation_recommendation: string;
  blood_pressure_recommendation: string;
  actionable_checklist: string[];
}

interface PostLvadRvFailureResult {
  rv_failure_detected: boolean;
  rvf_severity: 'NONE' | 'MILD_MODERATE' | 'SEVERE_REFRACTORY';
  cvp_pcwp_ratio: number;
  papi_score: number;
  inotropic_optimization: string;
  pulmonary_vasodilator_advice: string;
  rvad_mechanical_support_indicated: boolean;
  hemodynamic_action_plan: string[];
}

export const VadPulseHub: React.FC = () => {
  const [patientId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'impella' | 'durable' | 'rv_failure' | 'history'>('impella');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Impella State
  const [deviceModel, setDeviceModel] = useState<'IMPELLA_2_5' | 'IMPELLA_CP' | 'IMPELLA_5_0' | 'IMPELLA_5_5' | 'IMPELLA_RP'>('IMPELLA_CP');
  const [currentPLevel, setCurrentPLevel] = useState<string>('P-8');
  const [impellaFlow, setImpellaFlow] = useState<number>(1.8);
  const [motorCurrent, setMotorCurrent] = useState<number>(620);
  const [purgePressure, setPurgePressure] = useState<number>(550);
  const [purgeFlow, setPurgeFlow] = useState<number>(12);
  const [suctionAlarm, setSuctionAlarm] = useState<boolean>(true);
  const [impellaMap, setImpellaMap] = useState<number>(68);
  const [impellaCvp, setImpellaCvp] = useState<number>(6);
  const [impellaPcwp, setImpellaPcwp] = useState<number>(8);
  const [impellaResult, setImpellaResult] = useState<ImpellaAssessmentResult | null>(null);

  // Durable LVAD State
  const [durableType, setDurableType] = useState<'HEARTMATE_3' | 'HEARTWARE_HVAD'>('HEARTMATE_3');
  const [speedRpm, setSpeedRpm] = useState<number>(5600);
  const [durableFlow, setDurableFlow] = useState<number>(5.2);
  const [powerWatts, setPowerWatts] = useState<number>(8.8);
  const [baselinePowerWatts, setBaselinePowerWatts] = useState<number>(5.2);
  const [pulsatilityIndex, setPulsatilityIndex] = useState<number>(2.8);
  const [baselinePi, setBaselinePi] = useState<number>(4.0);
  const [dopplerMap, setDopplerMap] = useState<number>(74);
  const [ldhValue, setLdhValue] = useState<number>(890);
  const [plasmaFreeHgb, setPlasmaFreeHgb] = useState<number>(58);
  const [darkUrine, setDarkUrine] = useState<boolean>(true);
  const [durableResult, setDurableResult] = useState<DurableLvadTelemetryResult | null>(null);

  // RV Failure State
  const [rvCvp, setRvCvp] = useState<number>(20);
  const [rvPcwp, setRvPcwp] = useState<number>(16);
  const [systolicPap, setSystolicPap] = useState<number>(32);
  const [diastolicPap, setDiastolicPap] = useState<number>(14);
  const [inotropicSupport, setInotropicSupport] = useState<boolean>(true);
  const [systemicCongestion, setSystemicCongestion] = useState<boolean>(true);
  const [rvfResult, setRvfResult] = useState<PostLvadRvFailureResult | null>(null);

  // History / Registry State
  const [history, setHistory] = useState<{ devices: any[]; telemetry_alarms: any[] }>({
    devices: [],
    telemetry_alarms: []
  });

  const fetchHistory = async () => {
    try {
      const res = await fetch(`/api/clinician/vad/patients/${patientId}/history`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error('Failed to load VAD history:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  const handleEvaluateImpella = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const res = await fetch('/api/clinician/vad/evaluate-impella', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_model: deviceModel,
          current_p_level: currentPLevel,
          flow_rate_l_min: Number(impellaFlow),
          motor_current_ma: Number(motorCurrent),
          purge_pressure_mmhg: Number(purgePressure),
          purge_flow_ml_hr: Number(purgeFlow),
          suction_alarm_active: suctionAlarm,
          map_mmhg: Number(impellaMap),
          cvp_mmhg: Number(impellaCvp),
          pcwp_mmhg: Number(impellaPcwp)
        })
      });
      if (res.ok) {
        const data = await res.json();
        setImpellaResult(data);
        setStatusMessage('Impella telemetry assessed successfully.');
      } else {
        const err = await res.json();
        setStatusMessage(`Error: ${err.error || 'Failed to assess Impella'}`);
      }
    } catch (err) {
      setStatusMessage('Network error evaluating Impella.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEvaluateDurable = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const res = await fetch('/api/clinician/vad/evaluate-durable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_type: durableType,
          speed_rpm: Number(speedRpm),
          flow_l_min: Number(durableFlow),
          power_watts: Number(powerWatts),
          baseline_power_watts: Number(baselinePowerWatts),
          pulsatility_index: Number(pulsatilityIndex),
          baseline_pi: Number(baselinePi),
          doppler_map_mmhg: Number(dopplerMap),
          ldh_u_l: Number(ldhValue),
          plasma_free_hgb_mg_dl: Number(plasmaFreeHgb),
          hematuria_or_dark_urine: darkUrine
        })
      });
      if (res.ok) {
        const data = await res.json();
        setDurableResult(data);
        setStatusMessage('Durable LVAD telemetry evaluated successfully.');
      } else {
        const err = await res.json();
        setStatusMessage(`Error: ${err.error || 'Failed to evaluate durable LVAD'}`);
      }
    } catch (err) {
      setStatusMessage('Network error evaluating durable LVAD.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEvaluateRvFailure = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const res = await fetch('/api/clinician/vad/evaluate-rv-failure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cvp_mmhg: Number(rvCvp),
          pcwp_mmhg: Number(rvPcwp),
          systolic_pap_mmhg: Number(systolicPap),
          diastolic_pap_mmhg: Number(diastolicPap),
          inotropic_support_active: inotropicSupport,
          signs_of_systemic_congestion: systemicCongestion
        })
      });
      if (res.ok) {
        const data = await res.json();
        setRvfResult(data);
        setStatusMessage('Post-LVAD RV failure index computed successfully.');
      } else {
        const err = await res.json();
        setStatusMessage(`Error: ${err.error || 'Failed to evaluate RV failure'}`);
      }
    } catch (err) {
      setStatusMessage('Network error evaluating RV failure.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px', backgroundColor: '#0f172a', minHeight: '100vh', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header Banner */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#ec4899', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🫀</span> VAD-PULSE: Mechanical Circulatory Support & Thrombosis Sentinel
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
            Impella Microaxial Flow Navigator • HeartMate 3 / HVAD Thrombosis Watchdog • Post-LVAD RV Failure Hemodynamic Indexes
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '6px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f472b6' }}>
            Active Patient: #{patientId}
          </span>
          <span style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '6px', backgroundColor: '#831843', color: '#fbcfe8', fontWeight: 'bold' }}>
            INTERMACS Profile 1-3
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
          onClick={() => setActiveTab('impella')}
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            border: 'none',
            background: 'none',
            color: activeTab === 'impella' ? '#ec4899' : '#94a3b8',
            borderBottom: activeTab === 'impella' ? '2px solid #ec4899' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          🔄 Impella Microaxial Monitor
        </button>
        <button
          onClick={() => setActiveTab('durable')}
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            border: 'none',
            background: 'none',
            color: activeTab === 'durable' ? '#ec4899' : '#94a3b8',
            borderBottom: activeTab === 'durable' ? '2px solid #ec4899' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          ⚡ Durable LVAD & Thrombosis Sentinel
        </button>
        <button
          onClick={() => setActiveTab('rv_failure')}
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            border: 'none',
            background: 'none',
            color: activeTab === 'rv_failure' ? '#ec4899' : '#94a3b8',
            borderBottom: activeTab === 'rv_failure' ? '2px solid #ec4899' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          🫁 Post-LVAD RV Failure Watchdog
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
            color: activeTab === 'history' ? '#ec4899' : '#94a3b8',
            borderBottom: activeTab === 'history' ? '2px solid #ec4899' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          📋 VAD Registry & Alarms
        </button>
      </div>

      {/* Tab 1: Impella Microaxial Monitor */}
      {activeTab === 'impella' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#f472b6', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⚙️</span> Impella Telemetry & Controller Status
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Device Model</label>
                <select
                  value={deviceModel}
                  onChange={(e) => setDeviceModel(e.target.value as any)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                >
                  <option value="IMPELLA_CP">Impella CP (SmartAssist)</option>
                  <option value="IMPELLA_2_5">Impella 2.5</option>
                  <option value="IMPELLA_5_0">Impella 5.0</option>
                  <option value="IMPELLA_5_5">Impella 5.5 SmartAssist</option>
                  <option value="IMPELLA_RP">Impella RP (Right Ventricular)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Current P-Level</label>
                <select
                  value={currentPLevel}
                  onChange={(e) => setCurrentPLevel(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                >
                  {['P-1', 'P-2', 'P-3', 'P-4', 'P-5', 'P-6', 'P-7', 'P-8', 'P-9'].map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Forward Flow Rate (L/min)</label>
                <input
                  type="number"
                  step="0.1"
                  value={impellaFlow}
                  onChange={(e) => setImpellaFlow(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Motor Current (mA)</label>
                <input
                  type="number"
                  value={motorCurrent}
                  onChange={(e) => setMotorCurrent(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Purge Pressure (mmHg)</label>
                <input
                  type="number"
                  value={purgePressure}
                  onChange={(e) => setPurgePressure(parseInt(e.target.value, 10) || 0)}
                  placeholder="300 - 1100 mmHg"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                />
                <span style={{ fontSize: '11px', color: '#64748b' }}>Normal: 300 - 1100 mmHg</span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Purge Flow Rate (mL/hr)</label>
                <input
                  type="number"
                  step="0.5"
                  value={purgeFlow}
                  onChange={(e) => setPurgeFlow(parseFloat(e.target.value) || 0)}
                  placeholder="2 - 30 mL/hr"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                />
                <span style={{ fontSize: '11px', color: '#64748b' }}>Normal: 2 - 30 mL/hr</span>
              </div>
            </div>

            <div style={{ marginBottom: '16px', padding: '10px', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#ef4444', fontWeight: 'bold' }}>
                <input
                  type="checkbox"
                  checked={suctionAlarm}
                  onChange={(e) => setSuctionAlarm(e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                🚨 Automated Suction Alarm Active (Inlet Cavity Collapse)
              </label>
            </div>

            <h4 style={{ margin: '14px 0 8px 0', fontSize: '13px', color: '#cbd5e1' }}>Hemodynamic Context</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8' }}>MAP (mmHg)</label>
                <input
                  type="number"
                  value={impellaMap}
                  onChange={(e) => setImpellaMap(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%', padding: '6px', borderRadius: '4px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8' }}>CVP (mmHg)</label>
                <input
                  type="number"
                  value={impellaCvp}
                  onChange={(e) => setImpellaCvp(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%', padding: '6px', borderRadius: '4px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8' }}>PCWP (mmHg)</label>
                <input
                  type="number"
                  value={impellaPcwp}
                  onChange={(e) => setImpellaPcwp(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%', padding: '6px', borderRadius: '4px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                />
              </div>
            </div>

            <button
              onClick={handleEvaluateImpella}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: '#db2777',
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
              {isLoading ? 'Assessing...' : 'Assess Impella Controller & Suction Status'}
            </button>
          </div>

          {/* Impella Assessment Results */}
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#f472b6' }}>
              📊 Clinical Guidance & Microaxial Action Plan
            </h3>

            {impellaResult ? (
              <div>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <div style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: impellaResult.status === 'OPTIMAL' ? '#14532d' : '#7f1d1d',
                    border: '1px solid #334155'
                  }}>
                    <span style={{ fontSize: '11px', color: '#cbd5e1', display: 'block' }}>Operational Status</span>
                    <strong style={{ fontSize: '16px', color: '#f8fafc' }}>{impellaResult.status}</strong>
                  </div>

                  <div style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: '#0f172a',
                    border: '1px solid #ec4899'
                  }}>
                    <span style={{ fontSize: '11px', color: '#cbd5e1', display: 'block' }}>Recommended P-Level</span>
                    <strong style={{ fontSize: '20px', color: '#f472b6' }}>{impellaResult.recommended_p_level}</strong>
                  </div>
                </div>

                <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#38bdf8', display: 'block', marginBottom: '4px' }}>
                    Purge System Assessment:
                  </span>
                  <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1' }}>{impellaResult.purge_system_action}</p>
                </div>

                {impellaResult.bedside_interventions.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fb7185', display: 'block', marginBottom: '8px' }}>
                      🚨 Bedside Suction & Technical Interventions:
                    </span>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#e2e8f0', fontSize: '13px', lineHeight: '1.6' }}>
                      {impellaResult.bedside_interventions.map((action, idx) => (
                        <li key={idx}>{action}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {impellaResult.hemodynamic_guidance.length > 0 && (
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#a7f3d0', display: 'block', marginBottom: '8px' }}>
                      🩺 Hemodynamic Optimization:
                    </span>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#e2e8f0', fontSize: '13px', lineHeight: '1.6' }}>
                      {impellaResult.hemodynamic_guidance.map((g, idx) => (
                        <li key={idx}>{g}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                <span style={{ fontSize: '40px', display: 'block', marginBottom: '12px' }}>🔄</span>
                Select Impella model, current P-level, and telemetry parameters to assess suction and purge status.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Durable LVAD & Thrombosis Sentinel */}
      {activeTab === 'durable' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#f472b6', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⚡</span> Durable LVAD Telemetry & Hemolysis Screen
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Device Platform</label>
                <select
                  value={durableType}
                  onChange={(e) => setDurableType(e.target.value as any)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                >
                  <option value="HEARTMATE_3">Abbott HeartMate 3 (Full MagLev)</option>
                  <option value="HEARTWARE_HVAD">Medtronic HVAD (Centrifugal)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Fixed Speed (RPM)</label>
                <input
                  type="number"
                  value={speedRpm}
                  onChange={(e) => setSpeedRpm(parseInt(e.target.value, 10) || 0)}
                  placeholder="e.g. 5400"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Estimated Flow (L/min)</label>
                <input
                  type="number"
                  step="0.1"
                  value={durableFlow}
                  onChange={(e) => setDurableFlow(parseFloat(e.target.value) || 0)}
                  placeholder="Target 4.0 - 6.0"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Doppler MAP (mmHg)</label>
                <input
                  type="number"
                  value={dopplerMap}
                  onChange={(e) => setDopplerMap(parseInt(e.target.value, 10) || 0)}
                  placeholder="Target 70 - 80"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Current Power (Watts)</label>
                <input
                  type="number"
                  step="0.1"
                  value={powerWatts}
                  onChange={(e) => setPowerWatts(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Baseline Power (Watts)</label>
                <input
                  type="number"
                  step="0.1"
                  value={baselinePowerWatts}
                  onChange={(e) => setBaselinePowerWatts(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Pulsatility Index (PI)</label>
                <input
                  type="number"
                  step="0.1"
                  value={pulsatilityIndex}
                  onChange={(e) => setPulsatilityIndex(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Baseline PI</label>
                <input
                  type="number"
                  step="0.1"
                  value={baselinePi}
                  onChange={(e) => setBaselinePi(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                />
              </div>
            </div>

            <h4 style={{ margin: '14px 0 8px 0', fontSize: '13px', color: '#cbd5e1' }}>Hemolysis Biomarkers</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8' }}>LDH (U/L) [ULN ~ 250]</label>
                <input
                  type="number"
                  value={ldhValue}
                  onChange={(e) => setLdhValue(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%', padding: '6px', borderRadius: '4px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8' }}>Plasma Free Hgb (mg/dL)</label>
                <input
                  type="number"
                  value={plasmaFreeHgb}
                  onChange={(e) => setPlasmaFreeHgb(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%', padding: '6px', borderRadius: '4px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px', padding: '10px', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#f59e0b', fontWeight: 'bold' }}>
                <input
                  type="checkbox"
                  checked={darkUrine}
                  onChange={(e) => setDarkUrine(e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                🩸 Gross Hematuria or Tea-Colored Dark Urine (Hemoglobinuria)
              </label>
            </div>

            <button
              onClick={handleEvaluateDurable}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: '#ec4899',
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
              {isLoading ? 'Screening...' : 'Evaluate Durable LVAD & Thrombosis Risk'}
            </button>
          </div>

          {/* Durable LVAD Assessment Results */}
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#f472b6' }}>
              🛡️ Thrombosis Risk & Hemodynamic Evaluation
            </h3>

            {durableResult ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div style={{
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: durableResult.thrombosis_risk_level === 'HIGH_CRITICAL' ? '#831843' : durableResult.thrombosis_risk_level === 'MODERATE' ? '#78350f' : '#14532d',
                    border: '1px solid #334155'
                  }}>
                    <span style={{ fontSize: '11px', color: '#cbd5e1', display: 'block' }}>Thrombosis Risk</span>
                    <strong style={{ fontSize: '16px', color: '#f8fafc' }}>{durableResult.thrombosis_risk_level}</strong>
                  </div>

                  <div style={{
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155'
                  }}>
                    <span style={{ fontSize: '11px', color: '#cbd5e1', display: 'block' }}>Alarm Classification</span>
                    <strong style={{ fontSize: '14px', color: '#ec4899' }}>{durableResult.alarm_classification}</strong>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ padding: '10px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #334155' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>Power Delta (Δ):</span>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: durableResult.power_differential_watts >= 2.0 ? '#ef4444' : '#10b981' }}>
                      {durableResult.power_differential_watts > 0 ? `+${durableResult.power_differential_watts}` : durableResult.power_differential_watts} W
                    </div>
                  </div>

                  <div style={{ padding: '10px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #334155' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>PI Delta (Δ):</span>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: durableResult.pi_differential <= -1.5 ? '#ef4444' : '#10b981' }}>
                      {durableResult.pi_differential > 0 ? `+${durableResult.pi_differential}` : durableResult.pi_differential}
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '14px', padding: '12px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#f43f5e', display: 'block', marginBottom: '4px' }}>
                    Anticoagulation & Thrombolysis Protocol:
                  </span>
                  <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1' }}>{durableResult.anticoagulation_recommendation}</p>
                </div>

                <div style={{ marginBottom: '14px', padding: '12px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#38bdf8', display: 'block', marginBottom: '4px' }}>
                    Blood Pressure & Afterload Target:
                  </span>
                  <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1' }}>{durableResult.blood_pressure_recommendation}</p>
                </div>

                {durableResult.actionable_checklist.length > 0 && (
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fbbf24', display: 'block', marginBottom: '8px' }}>
                      📋 Actionable Clinical Checklist:
                    </span>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#e2e8f0', fontSize: '13px', lineHeight: '1.6' }}>
                      {durableResult.actionable_checklist.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                <span style={{ fontSize: '40px', display: 'block', marginBottom: '12px' }}>⚡</span>
                Enter Durable LVAD telemetry, power baselines, and LDH values to screen for pump thrombosis.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Post-LVAD RV Failure Watchdog */}
      {activeTab === 'rv_failure' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#f472b6', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🫁</span> Hemodynamic Pressures & RV Indices
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Central Venous Pressure (CVP, mmHg)</label>
                <input
                  type="number"
                  value={rvCvp}
                  onChange={(e) => setRvCvp(parseInt(e.target.value, 10) || 0)}
                  placeholder="Target < 12 mmHg"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                />
                <span style={{ fontSize: '11px', color: '#64748b' }}>High risk if &gt; 15 mmHg</span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Pulmonary Capillary Wedge (PCWP, mmHg)</label>
                <input
                  type="number"
                  value={rvPcwp}
                  onChange={(e) => setRvPcwp(parseInt(e.target.value, 10) || 0)}
                  placeholder="e.g. 15 mmHg"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                />
                <span style={{ fontSize: '11px', color: '#64748b' }}>CVP/PCWP ratio &gt; 0.63 indicates RVF</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Systolic PAP (sPAP, mmHg)</label>
                <input
                  type="number"
                  value={systolicPap}
                  onChange={(e) => setSystolicPap(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Diastolic PAP (dPAP, mmHg)</label>
                <input
                  type="number"
                  value={diastolicPap}
                  onChange={(e) => setDiastolicPap(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '14px', padding: '10px', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#f43f5e', fontWeight: 'bold' }}>
                <input
                  type="checkbox"
                  checked={inotropicSupport}
                  onChange={(e) => setInotropicSupport(e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                Active IV Inotrope Infusion (Milrinone / Dobutamine / Epinephrine)
              </label>
            </div>

            <div style={{ marginBottom: '18px', padding: '10px', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#fb923c', fontWeight: 'bold' }}>
                <input
                  type="checkbox"
                  checked={systemicCongestion}
                  onChange={(e) => setSystemicCongestion(e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                Signs of Systemic Congestion (JVD, Peripheral Edema, Hepatosplenomegaly)
              </label>
            </div>

            <button
              onClick={handleEvaluateRvFailure}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: '#ec4899',
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
              {isLoading ? 'Computing...' : 'Calculate PAPi & Evaluate RV Failure'}
            </button>
          </div>

          {/* RV Failure Results */}
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#f472b6' }}>
              📉 Right Ventricular Hemodynamic Analysis
            </h3>

            {rvfResult ? (
              <div>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <div style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: rvfResult.rv_failure_detected ? '#7f1d1d' : '#14532d',
                    border: '1px solid #334155'
                  }}>
                    <span style={{ fontSize: '11px', color: '#cbd5e1', display: 'block' }}>RV Failure Status</span>
                    <strong style={{ fontSize: '16px', color: '#f8fafc' }}>
                      {rvfResult.rv_failure_detected ? rvfResult.rvf_severity : 'NORMAL FUNCTION'}
                    </strong>
                  </div>

                  <div style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: '#0f172a',
                    border: rvfResult.rvad_mechanical_support_indicated ? '2px solid #ef4444' : '1px solid #334155'
                  }}>
                    <span style={{ fontSize: '11px', color: '#cbd5e1', display: 'block' }}>Temporary RVAD Indicated</span>
                    <strong style={{ fontSize: '16px', color: rvfResult.rvad_mechanical_support_indicated ? '#ef4444' : '#10b981' }}>
                      {rvfResult.rvad_mechanical_support_indicated ? 'YES - STAT SURGERY' : 'NO'}
                    </strong>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #334155' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>PAPi Score:</span>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: rvfResult.papi_score < 2.0 ? '#ef4444' : '#10b981' }}>
                      {rvfResult.papi_score}
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Normal &ge; 2.0; RVF &lt; 1.85</span>
                  </div>

                  <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #334155' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>CVP / PCWP Ratio:</span>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: rvfResult.cvp_pcwp_ratio > 0.63 ? '#ef4444' : '#10b981' }}>
                      {rvfResult.cvp_pcwp_ratio}
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Normal &le; 0.63</span>
                  </div>
                </div>

                <div style={{ marginBottom: '14px', padding: '12px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#38bdf8', display: 'block', marginBottom: '4px' }}>
                    Inotropic Optimization Strategy:
                  </span>
                  <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1' }}>{rvfResult.inotropic_optimization}</p>
                </div>

                <div style={{ marginBottom: '14px', padding: '12px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#a7f3d0', display: 'block', marginBottom: '4px' }}>
                    Pulmonary Vasodilator Protocol:
                  </span>
                  <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1' }}>{rvfResult.pulmonary_vasodilator_advice}</p>
                </div>

                {rvfResult.hemodynamic_action_plan.length > 0 && (
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fb7185', display: 'block', marginBottom: '8px' }}>
                      🩺 Hemodynamic Action Plan:
                    </span>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#e2e8f0', fontSize: '13px', lineHeight: '1.6' }}>
                      {rvfResult.hemodynamic_action_plan.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                <span style={{ fontSize: '40px', display: 'block', marginBottom: '12px' }}>🫁</span>
                Enter right heart catheterization pressures (CVP, PCWP, PAP) to calculate PAPi and assess post-LVAD RV failure.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Registry & History */}
      {activeTab === 'history' && (
        <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: '#f472b6' }}>
              📋 Patient VAD Devices & Telemetry Alarm History
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
            <h4 style={{ fontSize: '14px', color: '#38bdf8', margin: '0 0 10px 0' }}>Registered Mechanical VAD Devices</h4>
            {history.devices.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #475569', color: '#94a3b8' }}>
                    <th style={{ padding: '8px' }}>ID</th>
                    <th style={{ padding: '8px' }}>Category</th>
                    <th style={{ padding: '8px' }}>Implant Date</th>
                    <th style={{ padding: '8px' }}>Speed / P-Level</th>
                    <th style={{ padding: '8px' }}>Purge Fluid</th>
                    <th style={{ padding: '8px' }}>Baseline Power</th>
                    <th style={{ padding: '8px' }}>Baseline PI</th>
                  </tr>
                </thead>
                <tbody>
                  {history.devices.map((dev: any) => (
                    <tr key={dev.id} style={{ borderBottom: '1px solid #334155', color: '#f8fafc' }}>
                      <td style={{ padding: '8px' }}>#{dev.id}</td>
                      <td style={{ padding: '8px', color: '#f472b6', fontWeight: 'bold' }}>{dev.device_category}</td>
                      <td style={{ padding: '8px' }}>{new Date(dev.implant_date).toLocaleDateString()}</td>
                      <td style={{ padding: '8px' }}>{dev.current_p_level || `${dev.set_speed_rpm} RPM`}</td>
                      <td style={{ padding: '8px' }}>{dev.purge_fluid_type || 'N/A'}</td>
                      <td style={{ padding: '8px' }}>{dev.baseline_power_watts ? `${dev.baseline_power_watts} W` : '—'}</td>
                      <td style={{ padding: '8px' }}>{dev.baseline_pi || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: '#64748b', fontSize: '13px' }}>No VAD devices registered yet for this patient.</p>
            )}
          </div>

          <div>
            <h4 style={{ fontSize: '14px', color: '#fb7185', margin: '0 0 10px 0' }}>Telemetry Alarms & Watchdog Logs</h4>
            {history.telemetry_alarms.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #475569', color: '#94a3b8' }}>
                    <th style={{ padding: '8px' }}>Logged At</th>
                    <th style={{ padding: '8px' }}>Alarm Type</th>
                    <th style={{ padding: '8px' }}>Flow (L/min)</th>
                    <th style={{ padding: '8px' }}>Power (W)</th>
                    <th style={{ padding: '8px' }}>Doppler MAP</th>
                    <th style={{ padding: '8px' }}>LDH (U/L)</th>
                    <th style={{ padding: '8px' }}>Thrombosis Alert</th>
                    <th style={{ padding: '8px' }}>RV Failure Alert</th>
                  </tr>
                </thead>
                <tbody>
                  {history.telemetry_alarms.map((alarm: any) => (
                    <tr key={alarm.id} style={{ borderBottom: '1px solid #334155', color: '#f8fafc' }}>
                      <td style={{ padding: '8px' }}>{new Date(alarm.logged_at).toLocaleString()}</td>
                      <td style={{ padding: '8px', color: '#fbbf24', fontWeight: 'bold' }}>{alarm.alarm_type}</td>
                      <td style={{ padding: '8px' }}>{alarm.flow_l_min}</td>
                      <td style={{ padding: '8px' }}>{alarm.power_watts}</td>
                      <td style={{ padding: '8px' }}>{alarm.doppler_map_mmhg}</td>
                      <td style={{ padding: '8px' }}>{alarm.ldh_u_l || '—'}</td>
                      <td style={{ padding: '8px', color: alarm.thrombosis_risk_alert ? '#ef4444' : '#10b981' }}>
                        {alarm.thrombosis_risk_alert ? 'YES (HIGH)' : 'NO'}
                      </td>
                      <td style={{ padding: '8px', color: alarm.rv_failure_alert ? '#ef4444' : '#10b981' }}>
                        {alarm.rv_failure_alert ? 'YES (ALERT)' : 'NO'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: '#64748b', fontSize: '13px' }}>No telemetry alarms logged yet for this patient.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
