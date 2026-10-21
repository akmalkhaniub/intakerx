import React, { useState, useEffect } from 'react';

interface MalperfusionFlags {
  coronary?: boolean;
  cerebral?: boolean;
  spinalCord?: boolean;
  mesenteric?: boolean;
  renal?: boolean;
  lowerExtremity?: boolean;
}

interface AortaEvaluationResult {
  stanfordType: 'TYPE_A' | 'TYPE_B';
  debakeyType: 'I' | 'II' | 'IIIa' | 'IIIb';
  emergentSurgeryIndicated: boolean;
  tevarIndicated: boolean;
  complicatedTypeB: boolean;
  clinicalDisposition: string;
  malperfusionSyndromesDetected: string[];
  immediateCriticalChecklist: string[];
  contraindicatedTherapies: string[];
}

interface AntiImpulseResult {
  meanArterialPressureMmhg: number;
  hrControlled: boolean;
  sbpControlled: boolean;
  dpDtControlled: boolean;
  reflexTachycardiaAlert: boolean;
  shearStressStatus: 'CRITICAL_HIGH_RISK' | 'SUBOPTIMAL' | 'CONTROLLED';
  protocolNextStep: string;
  recommendedOrders: {
    drug: string;
    dose: string;
    route: string;
    rationale: string;
  }[];
  warnings: string[];
}

export const AortaCodeHub: React.FC = () => {
  const [patientId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'classification' | 'anti_impulse' | 'malperfusion' | 'history'>('classification');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Classification State
  const [involvesAscending, setInvolvesAscending] = useState<boolean>(true);
  const [involvesArch, setInvolvesArch] = useState<boolean>(true);
  const [involvesDescending, setInvolvesDescending] = useState<boolean>(true);
  const [extendsBelowDiaphragm, setExtendsBelowDiaphragm] = useState<boolean>(false);
  const [aorticDiameterMm, setAorticDiameterMm] = useState<number>(54);
  const [intimalTearLocation, setIntimalTearLocation] = useState<string>('Sinotubular Junction');
  const [cardiacTamponade, setCardiacTamponade] = useState<boolean>(false);
  const [aorticRegurg, setAorticRegurg] = useState<'NONE' | 'MILD' | 'MODERATE' | 'SEVERE'>('MODERATE');
  const [refractoryPain, setRefractoryPain] = useState<boolean>(false);
  const [refractoryHypertension, setRefractoryHypertension] = useState<boolean>(false);
  const [rapidExpansion, setRapidExpansion] = useState<boolean>(false);
  const [pericardialEffusion, setPericardialEffusion] = useState<boolean>(false);

  // Malperfusion State
  const [malperfCoronary, setMalperfCoronary] = useState<boolean>(false);
  const [malperfCerebral, setMalperfCerebral] = useState<boolean>(false);
  const [malperfSpinal, setMalperfSpinal] = useState<boolean>(false);
  const [malperfMesenteric, setMalperfMesenteric] = useState<boolean>(false);
  const [malperfRenal, setMalperfRenal] = useState<boolean>(false);
  const [malperfLimb, setMalperfLimb] = useState<boolean>(false);

  // Results
  const [evalResult, setEvalResult] = useState<AortaEvaluationResult | null>(null);

  // Telemetry Anti-Impulse State
  const [heartRate, setHeartRate] = useState<number>(84);
  const [systolicBp, setSystolicBp] = useState<number>(168);
  const [diastolicBp, setDiastolicBp] = useState<number>(94);
  const [betaBlockerActive, setBetaBlockerActive] = useState<boolean>(false);
  const [vasodilatorActive, setVasodilatorActive] = useState<boolean>(false);
  const [telemetryResult, setTelemetryResult] = useState<AntiImpulseResult | null>(null);

  // History State
  const [historyEncounters, setHistoryEncounters] = useState<any[]>([]);

  // Evaluate Aorta Classification
  const handleEvaluateAorta = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const malperfusion: MalperfusionFlags = {
        coronary: malperfCoronary,
        cerebral: malperfCerebral,
        spinalCord: malperfSpinal,
        mesenteric: malperfMesenteric,
        renal: malperfRenal,
        lowerExtremity: malperfLimb
      };

      const res = await fetch('/api/aorta/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          involvesAscendingAorta: involvesAscending,
          involvesAorticArch: involvesArch,
          involvesDescendingAorta: involvesDescending,
          extendsBelowDiaphragm,
          aorticDiameterMm,
          intimalTearLocation,
          cardiacTamponadePresent: cardiacTamponade,
          aorticRegurgSeverity: aorticRegurg,
          refractoryPain,
          refractoryHypertension,
          rapidExpansion,
          pericardialEffusionOrRupture: pericardialEffusion,
          malperfusion
        })
      });
      if (!res.ok) throw new Error('Failed to evaluate aortic dissection');
      const data = await res.json();
      setEvalResult(data);
      setStatusMessage('Aortic dissection classification updated.');
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Analyze Anti-Impulse Hemodynamics
  const handleAnalyzeAntiImpulse = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const res = await fetch('/api/aorta/anti-impulse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          heartRateBpm: heartRate,
          systolicBpMmhg: systolicBp,
          diastolicBpMmhg: diastolicBp,
          betaBlockerActive,
          vasodilatorActive,
          activeMedications: [
            betaBlockerActive ? 'IV Esmolol / Labetalol' : null,
            vasodilatorActive ? 'IV Nicardipine / Clevidipine' : null
          ].filter(Boolean)
        })
      });
      if (!res.ok) throw new Error('Failed to analyze anti-impulse hemodynamics');
      const data = await res.json();
      setTelemetryResult(data);
      setStatusMessage('Hemodynamic shear stress analyzed.');
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Save Encounter
  const handleSaveEncounter = async () => {
    if (!evalResult) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/aorta/encounter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          stanfordType: evalResult.stanfordType,
          debakeyType: evalResult.debakeyType,
          aorticDiameterMm,
          intimalTearLocation,
          cardiacTamponadePresent: cardiacTamponade,
          aorticRegurgSeverity: aorticRegurg,
          coronaryInvolvement: malperfCoronary,
          refractoryPain,
          rapidExpansion,
          malperfusionSyndromes: evalResult.malperfusionSyndromesDetected,
          tevarIndicated: evalResult.tevarIndicated,
          clinicalDisposition: evalResult.clinicalDisposition
        })
      });
      if (!res.ok) throw new Error('Failed to save aortic encounter');
      setStatusMessage('Aortic dissection encounter saved to medical record.');
      fetchHistory();
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch History
  const fetchHistory = async () => {
    try {
      const res = await fetch(`/api/aorta/patient/${patientId}/history`);
      if (res.ok) {
        const data = await res.json();
        setHistoryEncounters(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchHistory();
    handleEvaluateAorta();
    handleAnalyzeAntiImpulse();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', color: '#f8fafc' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #881337 0%, #be123c 100%)',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid #f43f5e',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>🩸</span> AORTA-CODE: Acute Aortic Dissection & Anti-Impulse Command
          </h2>
          <p style={{ margin: '6px 0 0', color: '#fecdd3', fontSize: '14px' }}>
            Stanford A vs B, Anti-Impulse Shear Stress (dP/dt) Protocol, Malperfusion Screen & TEVAR Triggers
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{
            background: 'rgba(244, 63, 94, 0.25)',
            padding: '6px 14px',
            borderRadius: '20px',
            border: '1px solid #fb7185',
            fontSize: '13px',
            fontWeight: 600
          }}>
            Patient ID: #{patientId}
          </span>
        </div>
      </div>

      {statusMessage && (
        <div style={{
          padding: '10px 16px',
          borderRadius: '8px',
          background: statusMessage.startsWith('Error') ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
          border: `1px solid ${statusMessage.startsWith('Error') ? '#ef4444' : '#10b981'}`,
          fontSize: '13px',
          color: '#f8fafc'
        }}>
          {statusMessage}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('classification')}
          style={{
            background: activeTab === 'classification' ? '#be123c' : '#1e293b',
            color: '#f8fafc',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          Stanford & Anatomical Triage
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('anti_impulse')}
          style={{
            background: activeTab === 'anti_impulse' ? '#be123c' : '#1e293b',
            color: '#f8fafc',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          Anti-Impulse (dP/dt) Command
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('malperfusion')}
          style={{
            background: activeTab === 'malperfusion' ? '#be123c' : '#1e293b',
            color: '#f8fafc',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          Malperfusion Syndrome Screen
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          style={{
            background: activeTab === 'history' ? '#be123c' : '#1e293b',
            color: '#f8fafc',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          Encounter History
        </button>
      </div>

      {/* Tab 1: Stanford & Anatomical Triage */}
      {activeTab === 'classification' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '20px' }}>
          {/* Anatomical Inputs */}
          <div style={{ background: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#fb7185' }}>Anatomical Extent & Features</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Max Aortic Diameter (mm)</label>
                <input
                  type="number"
                  value={aorticDiameterMm}
                  onChange={(e) => setAorticDiameterMm(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Primary Intimal Tear Location</label>
                <input
                  type="text"
                  value={intimalTearLocation}
                  onChange={(e) => setIntimalTearLocation(e.target.value)}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Aortic Regurgitation Severity</label>
                <select
                  value={aorticRegurg}
                  onChange={(e) => setAorticRegurg(e.target.value as any)}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                >
                  <option value="NONE">None</option>
                  <option value="MILD">Mild</option>
                  <option value="MODERATE">Moderate</option>
                  <option value="SEVERE">Severe (Acute LV Volume Overload)</option>
                </select>
              </div>

              <div style={{ borderTop: '1px solid #334155', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: '#f87171', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={involvesAscending}
                    onChange={(e) => setInvolvesAscending(e.target.checked)}
                  />
                  Involves Ascending Aorta (Proximal to Innominate Artery)
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={involvesArch}
                    onChange={(e) => setInvolvesArch(e.target.checked)}
                  />
                  Involves Transverse Aortic Arch
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={involvesDescending}
                    onChange={(e) => setInvolvesDescending(e.target.checked)}
                  />
                  Involves Descending Thoracic Aorta
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={extendsBelowDiaphragm}
                    onChange={(e) => setExtendsBelowDiaphragm(e.target.checked)}
                  />
                  Extends Below Diaphragm into Abdominal Aorta / Iliacs
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: '#ef4444' }}>
                  <input
                    type="checkbox"
                    checked={cardiacTamponade}
                    onChange={(e) => setCardiacTamponade(e.target.checked)}
                  />
                  ⚠️ Pericardial Tamponade Present (Hemopericardium)
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={refractoryPain}
                    onChange={(e) => setRefractoryPain(e.target.checked)}
                  />
                  Refractory / Recurrent Severe Pain (Complicated Indicator)
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={refractoryHypertension}
                    onChange={(e) => setRefractoryHypertension(e.target.checked)}
                  />
                  Refractory Hypertension (3+ IV Agents Required)
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={rapidExpansion}
                    onChange={(e) => setRapidExpansion(e.target.checked)}
                  />
                  Rapid Aortic Expansion or Peri-Aortic Hematoma
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={pericardialEffusion}
                    onChange={(e) => setPericardialEffusion(e.target.checked)}
                  />
                  Pericardial / Pleural Fluid Leak
                </label>
              </div>

              <div style={{ marginTop: '14px', display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleEvaluateAorta}
                  disabled={isLoading}
                  style={{
                    flex: 1,
                    background: '#be123c',
                    color: '#fff',
                    border: 'none',
                    padding: '10px',
                    borderRadius: '6px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {isLoading ? 'Evaluating...' : 'Update Classification'}
                </button>
                {evalResult && (
                  <button
                    type="button"
                    onClick={handleSaveEncounter}
                    disabled={isLoading}
                    style={{
                      background: '#10b981',
                      color: '#fff',
                      border: 'none',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Save Record
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {evalResult && (
              <>
                <div style={{
                  background: '#1e293b',
                  padding: '20px',
                  borderRadius: '10px',
                  border: `2px solid ${evalResult.emergentSurgeryIndicated ? '#ef4444' : evalResult.tevarIndicated ? '#f59e0b' : '#10b981'}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontWeight: 700,
                        fontSize: '13px',
                        background: evalResult.stanfordType === 'TYPE_A' ? '#ef4444' : '#0284c7',
                        color: '#fff'
                      }}>
                        Stanford {evalResult.stanfordType}
                      </span>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontWeight: 700,
                        fontSize: '13px',
                        background: '#334155',
                        color: '#f8fafc'
                      }}>
                        DeBakey {evalResult.debakeyType}
                      </span>
                    </div>

                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontWeight: 700,
                      fontSize: '12px',
                      background: evalResult.emergentSurgeryIndicated
                        ? '#ef4444'
                        : evalResult.tevarIndicated
                        ? '#f59e0b'
                        : '#10b981',
                      color: '#fff'
                    }}>
                      {evalResult.emergentSurgeryIndicated
                        ? 'EMERGENT OPEN SURGERY'
                        : evalResult.tevarIndicated
                        ? 'URGENT TEVAR'
                        : 'ICU MEDICAL'}
                    </span>
                  </div>

                  <p style={{ margin: '14px 0', fontSize: '15px', fontWeight: 600, lineHeight: 1.5 }}>
                    {evalResult.clinicalDisposition}
                  </p>

                  {/* Immediate Checklist */}
                  <h4 style={{ margin: '14px 0 8px', fontSize: '13px', color: '#fb7185' }}>Immediate Critical Action Checklist</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {evalResult.immediateCriticalChecklist.map((c, i) => (
                      <div key={i} style={{ fontSize: '12px', lineHeight: 1.4, background: '#0f172a', padding: '8px', borderRadius: '6px' }}>
                        • {c}
                      </div>
                    ))}
                  </div>

                  {/* Contraindicated Therapies */}
                  <h4 style={{ margin: '14px 0 8px', fontSize: '13px', color: '#ef4444' }}>Strict Contraindications</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {evalResult.contraindicatedTherapies.map((c, i) => (
                      <div key={i} style={{ fontSize: '12px', lineHeight: 1.4, color: '#fca5a5' }}>
                        🚫 {c}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Anti-Impulse (dP/dt) Command */}
      {activeTab === 'anti_impulse' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '20px' }}>
          {/* Telemetry Input */}
          <div style={{ background: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#fb7185' }}>Arterial Telemetry & Anti-Impulse Titration</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Heart Rate (bpm) - Goal &lt; 60 bpm</label>
                <input
                  type="number"
                  value={heartRate}
                  onChange={(e) => setHeartRate(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Systolic Blood Pressure (mmHg) - Goal 100-120 mmHg</label>
                <input
                  type="number"
                  value={systolicBp}
                  onChange={(e) => setSystolicBp(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Diastolic Blood Pressure (mmHg)</label>
                <input
                  type="number"
                  value={diastolicBp}
                  onChange={(e) => setDiastolicBp(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                />
              </div>

              <div style={{ borderTop: '1px solid #334155', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={betaBlockerActive}
                    onChange={(e) => setBetaBlockerActive(e.target.checked)}
                  />
                  IV Beta-Blocker Active (Esmolol / Labetalol)
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={vasodilatorActive}
                    onChange={(e) => setVasodilatorActive(e.target.checked)}
                  />
                  IV Vasodilator Active (Nicardipine / Clevidipine)
                </label>
              </div>

              <button
                type="button"
                onClick={handleAnalyzeAntiImpulse}
                disabled={isLoading}
                style={{
                  marginTop: '10px',
                  background: '#be123c',
                  color: '#fff',
                  border: 'none',
                  padding: '10px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Analyze dP/dt Shear Stress
              </button>
            </div>
          </div>

          {/* Telemetry Output */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {telemetryResult && (
              <>
                {telemetryResult.reflexTachycardiaAlert && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.25)',
                    border: '2px solid #ef4444',
                    padding: '16px',
                    borderRadius: '8px'
                  }}>
                    <h4 style={{ margin: '0 0 8px', color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>⚠️</span> CRITICAL ALERT: REFLEX TACHYCARDIA RISK
                    </h4>
                    <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5 }}>
                      Vasodilator running without rate control! Pure vasodilation causes reflex sympathetic tachycardia, accelerating dP/dt shear stress and extending the dissection flap. Titrate beta-blocker immediately.
                    </p>
                  </div>
                )}

                <div style={{ background: '#1e293b', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: '14px', color: '#fb7185' }}>Anti-Impulse Target Metrics</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    <div style={{ background: '#0f172a', padding: '10px', borderRadius: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>Heart Rate</span>
                      <p style={{ margin: '4px 0 0', fontWeight: 700, color: telemetryResult.hrControlled ? '#10b981' : '#ef4444' }}>
                        {heartRate} bpm ({telemetryResult.hrControlled ? 'Target Met' : 'Above Target'})
                      </p>
                    </div>

                    <div style={{ background: '#0f172a', padding: '10px', borderRadius: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>Systolic BP</span>
                      <p style={{ margin: '4px 0 0', fontWeight: 700, color: telemetryResult.sbpControlled ? '#10b981' : '#ef4444' }}>
                        {systolicBp} mmHg ({telemetryResult.sbpControlled ? 'Target Met' : 'Above Target'})
                      </p>
                    </div>

                    <div style={{ background: '#0f172a', padding: '10px', borderRadius: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>Mean Arterial Pressure</span>
                      <p style={{ margin: '4px 0 0', fontWeight: 700 }}>
                        {telemetryResult.meanArterialPressureMmhg} mmHg
                      </p>
                    </div>
                  </div>

                  <div style={{ marginTop: '12px', background: '#0f172a', padding: '12px', borderRadius: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>Protocol Next Action</span>
                    <p style={{ margin: '4px 0 0', fontWeight: 700, color: '#f8fafc' }}>
                      {telemetryResult.protocolNextStep}
                    </p>
                  </div>
                </div>

                {/* Recommended Orders */}
                <div style={{ background: '#1e293b', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: '14px', color: '#fb7185' }}>Anti-Impulse Titration Orders</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {telemetryResult.recommendedOrders.map((ord, idx) => (
                      <div key={idx} style={{ background: '#0f172a', padding: '10px', borderRadius: '6px', borderLeft: '4px solid #f43f5e' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 700, fontSize: '13px' }}>{ord.drug}</span>
                          <span style={{ color: '#fb7185', fontSize: '12px', fontWeight: 600 }}>{ord.dose}</span>
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>{ord.rationale}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Malperfusion Syndrome Screen */}
      {activeTab === 'malperfusion' && (
        <div style={{ background: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#fb7185' }}>End-Organ Malperfusion Syndrome Screen</h3>
          <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#94a3b8' }}>
            Check any vascular territory experiencing dynamic or static branch vessel obstruction. Any positive finding in Type B immediately converts the case to Complicated Type B (TEVAR Indicated).
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div style={{ background: '#0f172a', padding: '14px', borderRadius: '8px', border: malperfCoronary ? '1px solid #f43f5e' : '1px solid #334155' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={malperfCoronary}
                  onChange={(e) => setMalperfCoronary(e.target.checked)}
                />
                Coronary Malperfusion
              </label>
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                Right or Left coronary ostial occlusion, inferior/anterior ST-elevation, acute severe cardiogenic shock.
              </p>
            </div>

            <div style={{ background: '#0f172a', padding: '14px', borderRadius: '8px', border: malperfCerebral ? '1px solid #f43f5e' : '1px solid #334155' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={malperfCerebral}
                  onChange={(e) => setMalperfCerebral(e.target.checked)}
                />
                Cerebral Malperfusion
              </label>
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                Innominate or left carotid flap extension, acute focal hemispheric stroke, syncope, altered consciousness.
              </p>
            </div>

            <div style={{ background: '#0f172a', padding: '14px', borderRadius: '8px', border: malperfSpinal ? '1px solid #f43f5e' : '1px solid #334155' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={malperfSpinal}
                  onChange={(e) => setMalperfSpinal(e.target.checked)}
                />
                Spinal Cord Malperfusion
              </label>
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                Intercostal artery avulsion (Adamkiewicz), acute paraplegia or paraparesis (Anterior Spinal Artery syndrome).
              </p>
            </div>

            <div style={{ background: '#0f172a', padding: '14px', borderRadius: '8px', border: malperfMesenteric ? '1px solid #f43f5e' : '1px solid #334155' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={malperfMesenteric}
                  onChange={(e) => setMalperfMesenteric(e.target.checked)}
                />
                Mesenteric Malperfusion
              </label>
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                Celiac or superior mesenteric artery (SMA) true lumen collapse, severe abdominal pain out of proportion, lactate &gt; 2.5 mmol/L.
              </p>
            </div>

            <div style={{ background: '#0f172a', padding: '14px', borderRadius: '8px', border: malperfRenal ? '1px solid #f43f5e' : '1px solid #334155' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={malperfRenal}
                  onChange={(e) => setMalperfRenal(e.target.checked)}
                />
                Renal Malperfusion
              </label>
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                Renal artery ostial dissection, acute oliguria/anuria, sudden refractory renin-mediated hypertension, creatinine doubling.
              </p>
            </div>

            <div style={{ background: '#0f172a', padding: '14px', borderRadius: '8px', border: malperfLimb ? '1px solid #f43f5e' : '1px solid #334155' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={malperfLimb}
                  onChange={(e) => setMalperfLimb(e.target.checked)}
                />
                Lower Extremity Malperfusion
              </label>
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                Iliac / femoral artery occlusion, cold pulseless lower extremity, sensory or motor neurological loss.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleEvaluateAorta}
            style={{
              marginTop: '16px',
              background: '#be123c',
              color: '#fff',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Update Malperfusion Risk Profile
          </button>
        </div>
      )}

      {/* Tab 4: History */}
      {activeTab === 'history' && (
        <div style={{ background: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#fb7185' }}>Patient Aortic Encounters History</h3>
          {historyEncounters.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>No recorded aortic encounters for this patient.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {historyEncounters.map((enc) => (
                <div key={enc.id} style={{ background: '#0f172a', padding: '14px', borderRadius: '6px', border: '1px solid #334155' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px' }}>
                      Encounter #{enc.id} - Stanford {enc.stanford_type} (DeBakey {enc.debakey_type})
                    </span>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>{new Date(enc.created_at).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', margin: '10px 0', fontSize: '12px' }}>
                    <div>Diameter: {enc.aortic_diameter_mm} mm</div>
                    <div>Tear: {enc.intimal_tear_location}</div>
                    <div>TEVAR: {enc.tevar_indicated ? 'YES' : 'NO'}</div>
                    <div>Tamponade: {enc.cardiac_tamponade_present ? 'YES' : 'NO'}</div>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#cbd5e1' }}>{enc.clinical_disposition}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default AortaCodeHub;
