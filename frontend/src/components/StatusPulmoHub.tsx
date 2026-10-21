import React, { useState, useEffect } from 'react';

interface AsthmaAssessmentResult {
  severity: 'MILD' | 'MODERATE' | 'SEVERE' | 'IMPENDING_ARREST';
  pseudonormalPaco2Alert: boolean;
  hypercapnicAcidosisAlert: boolean;
  silentChestAlert: boolean;
  hemodynamicPulsusAlert: boolean;
  intubationRisk: 'LOW' | 'INTERMEDIATE' | 'HIGH' | 'EMERGENT';
  summary: string;
  recommendedActions: string[];
}

interface VentPhysicsResult {
  ibwKg: number;
  vtPerKgIbw: number;
  vtSafe: boolean;
  totalPeepCmh2o: number;
  drivingPressureCmh2o: number;
  airwayResistancePressureCmh2o: number;
  tiSeconds: number;
  teSeconds: number;
  calculatedIeRatio: string;
  prolongedExpiratoryTimeCompliant: boolean;
  dynamicHyperinflationAlert: boolean;
  permissiveHypercapniaStatus: {
    permitted: boolean;
    phSafe: boolean;
    rationale: string;
    contraindicationWarning?: string;
  };
  emergencyDecompressionProtocol: {
    indicated: boolean;
    steps: string[];
  };
  recommendations: string[];
}

interface MedicalOrder {
  drug: string;
  dose: string;
  route: string;
  frequency: string;
  indication: string;
  monitoring: string;
}

interface MedicalEscalationPlan {
  tier: 1 | 2 | 3 | 4;
  tierName: string;
  orders: MedicalOrder[];
  criticalWarnings: string[];
  rescueOptions: string[];
}

export const StatusPulmoHub: React.FC = () => {
  const [patientId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'assessment' | 'vent' | 'escalation' | 'history'>('assessment');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Assessment Form State
  const [pefPercent, setPefPercent] = useState<number>(38);
  const [speech, setSpeech] = useState<'FULL_SENTENCES' | 'PHRASES' | 'WORDS' | 'UNABLE_TO_SPEAK'>('WORDS');
  const [accessoryMuscleUse, setAccessoryMuscleUse] = useState<boolean>(true);
  const [silentChest, setSilentChest] = useState<boolean>(false);
  const [pulsusParadoxusMmhg, setPulsusParadoxusMmhg] = useState<number>(18);
  const [paco2Mmhg, setPaco2Mmhg] = useState<number>(44);
  const [ph, setPh] = useState<number>(7.32);
  const [pao2Mmhg, setPao2Mmhg] = useState<number>(72);
  const [fio2Percent, setFio2Percent] = useState<number>(50);
  const [mentalStatus, setMentalStatus] = useState<'ALERT' | 'AGITATED' | 'LETHARGIC' | 'CONFUSED' | 'COMATOSE'>('AGITATED');
  const [heartRate, setHeartRate] = useState<number>(126);
  const [respiratoryRate, setRespiratoryRate] = useState<number>(32);
  const [spo2Percent, setSpo2Percent] = useState<number>(91);
  const [intubated, setIntubated] = useState<boolean>(false);
  const [assessmentResult, setAssessmentResult] = useState<AsthmaAssessmentResult | null>(null);

  // Ventilator Physics State
  const [weightKg, setWeightKg] = useState<number>(78);
  const [heightCm, setHeightCm] = useState<number>(175);
  const [gender, setGender] = useState<'MALE' | 'FEMALE'>('MALE');
  const [tidalVolumeMl, setTidalVolumeMl] = useState<number>(450);
  const [ventRrBpm, setVentRrBpm] = useState<number>(10);
  const [inspFlowLpm, setInspFlowLpm] = useState<number>(80);
  const [appliedPeep, setAppliedPeep] = useState<number>(5);
  const [autoPeepCmh2o, setAutoPeepCmh2o] = useState<number>(8);
  const [plateauPressureCmh2o, setPlateauPressureCmh2o] = useState<number>(26);
  const [peakPressureCmh2o, setPeakPressureCmh2o] = useState<number>(46);
  const [hasTbi, setHasTbi] = useState<boolean>(false);
  const [ventResult, setVentResult] = useState<VentPhysicsResult | null>(null);

  // Escalation State
  const [escalationSeverity, setEscalationSeverity] = useState<'MILD' | 'MODERATE' | 'SEVERE' | 'IMPENDING_ARREST'>('SEVERE');
  const [refractoryMinutes, setRefractoryMinutes] = useState<number>(30);
  const [escalationPlan, setEscalationPlan] = useState<MedicalEscalationPlan | null>(null);

  // History State
  const [historyEncounters, setHistoryEncounters] = useState<any[]>([]);

  // Evaluate Asthma Severity
  const handleAssessAsthma = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const res = await fetch('/api/pulmo/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          pefPercent,
          speech,
          accessoryMuscleUse,
          silentChest,
          pulsusParadoxusMmhg,
          paco2Mmhg,
          ph,
          pao2Mmhg,
          fio2Percent,
          mentalStatus,
          heartRate,
          respiratoryRate,
          spo2Percent,
          intubated
        })
      });
      if (!res.ok) throw new Error('Failed to evaluate status asthmaticus');
      const data = await res.json();
      setAssessmentResult(data);
      setEscalationSeverity(data.severity);
      setStatusMessage('Asthma severity evaluation complete.');
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Save Encounter
  const handleSaveEncounter = async () => {
    if (!assessmentResult) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/pulmo/encounter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          severity: assessmentResult.severity,
          pefPercent,
          silentChest,
          pulsusParadoxusMmhg,
          paco2Mmhg,
          ph,
          pao2Mmhg,
          fio2Percent,
          intubated,
          dynamicHyperinflationRisk: assessmentResult.silentChestAlert ? 'EXTREME' : 'HIGH',
          clinicalNotes: assessmentResult.summary
        })
      });
      if (!res.ok) throw new Error('Failed to record pulmo encounter');
      setStatusMessage('Pulmo encounter saved to medical record.');
      fetchHistory();
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate Ventilator Dynamics
  const handleCalculateVent = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const res = await fetch('/api/pulmo/vent-physics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          weightKg,
          heightCm,
          gender,
          tidalVolumeMl,
          respiratoryRateBpm: ventRrBpm,
          inspiratoryFlowLpm: inspFlowLpm,
          appliedPeep,
          autoPeepCmh2o,
          plateauPressureCmh2o,
          peakPressureCmh2o,
          ph,
          paco2Mmhg,
          hasAcuteTbiOrElevatedIcp: hasTbi
        })
      });
      if (!res.ok) throw new Error('Failed to calculate ventilator physics');
      const data = await res.json();
      setVentResult(data);
      setStatusMessage('Ventilator physics calculation complete.');
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Evaluate Escalation Plan
  const handleEvaluateEscalation = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/pulmo/escalation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          severity: escalationSeverity,
          refractoryDurationMin: refractoryMinutes,
          intubated,
          spo2Percent
        })
      });
      if (!res.ok) throw new Error('Failed to retrieve medical escalation plan');
      const data = await res.json();
      setEscalationPlan(data);
      setStatusMessage('Pharmacotherapy escalation plan generated.');
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch History
  const fetchHistory = async () => {
    try {
      const res = await fetch(`/api/pulmo/patient/${patientId}/history`);
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
    // Run initial assessment & vent calculation
    handleAssessAsthma();
    handleCalculateVent();
    handleEvaluateEscalation();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', color: '#f8fafc' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0c4a6e 0%, #0369a1 100%)',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid #0284c7',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>🫁</span> STATUS-PULMO: Severe Asthmaticus & Dynamic Hyperinflation
          </h2>
          <p style={{ margin: '6px 0 0', color: '#bae6fd', fontSize: '14px' }}>
            Permissive Hypercapnia Protocol, Auto-PEEP & Breath-Stacking Watchdog, Bronchospasm Escalation Tiers
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{
            background: 'rgba(56, 189, 248, 0.2)',
            padding: '6px 14px',
            borderRadius: '20px',
            border: '1px solid #38bdf8',
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

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('assessment')}
          style={{
            background: activeTab === 'assessment' ? '#0284c7' : '#1e293b',
            color: '#f8fafc',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          Clinical Severity & ABG
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('vent')}
          style={{
            background: activeTab === 'vent' ? '#0284c7' : '#1e293b',
            color: '#f8fafc',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          Ventilator Physics & Auto-PEEP
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('escalation')}
          style={{
            background: activeTab === 'escalation' ? '#0284c7' : '#1e293b',
            color: '#f8fafc',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          Medical Escalation Tiers
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          style={{
            background: activeTab === 'history' ? '#0284c7' : '#1e293b',
            color: '#f8fafc',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          Encounter Logs
        </button>
      </div>

      {/* Tab 1: Clinical Severity & ABG */}
      {activeTab === 'assessment' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '20px' }}>
          {/* Controls Panel */}
          <div style={{ background: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#38bdf8' }}>Clinical Presentation & ABG</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Peak Expiratory Flow (% Best)</label>
                <input
                  type="number"
                  value={pefPercent}
                  onChange={(e) => setPefPercent(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Speech Capacity</label>
                <select
                  value={speech}
                  onChange={(e) => setSpeech(e.target.value as any)}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                >
                  <option value="FULL_SENTENCES">Full Sentences</option>
                  <option value="PHRASES">Phrases Only</option>
                  <option value="WORDS">Single Words</option>
                  <option value="UNABLE_TO_SPEAK">Unable to Speak</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Pulsus Paradoxus (mmHg)</label>
                <input
                  type="number"
                  value={pulsusParadoxusMmhg}
                  onChange={(e) => setPulsusParadoxusMmhg(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Mental Status</label>
                <select
                  value={mentalStatus}
                  onChange={(e) => setMentalStatus(e.target.value as any)}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                >
                  <option value="ALERT">Alert</option>
                  <option value="AGITATED">Agitated</option>
                  <option value="LETHARGIC">Lethargic (Ominous)</option>
                  <option value="CONFUSED">Confused</option>
                  <option value="COMATOSE">Comatose</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>PaCO2 (mmHg)</label>
                <input
                  type="number"
                  value={paco2Mmhg}
                  onChange={(e) => setPaco2Mmhg(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Arterial pH</label>
                <input
                  type="number"
                  step="0.01"
                  value={ph}
                  onChange={(e) => setPh(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>PaO2 (mmHg)</label>
                <input
                  type="number"
                  value={pao2Mmhg}
                  onChange={(e) => setPao2Mmhg(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>SpO2 (%)</label>
                <input
                  type="number"
                  value={spo2Percent}
                  onChange={(e) => setSpo2Percent(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>FiO2 (%)</label>
                <input
                  type="number"
                  value={fio2Percent}
                  onChange={(e) => setFio2Percent(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Respiratory Rate (bpm)</label>
                <input
                  type="number"
                  value={respiratoryRate}
                  onChange={(e) => setRespiratoryRate(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Heart Rate (bpm)</label>
                <input
                  type="number"
                  value={heartRate}
                  onChange={(e) => setHeartRate(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                />
              </div>
            </div>

            <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={accessoryMuscleUse}
                  onChange={(e) => setAccessoryMuscleUse(e.target.checked)}
                />
                Accessory Muscle Use / Sternocleidomastoid Retraction
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: '#f87171' }}>
                <input
                  type="checkbox"
                  checked={silentChest}
                  onChange={(e) => setSilentChest(e.target.checked)}
                />
                ⚠️ Silent Chest (Absence of wheezing due to zero air movement)
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={intubated}
                  onChange={(e) => setIntubated(e.target.checked)}
                />
                Patient Currently Endotracheally Intubated
              </label>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={handleAssessAsthma}
                disabled={isLoading}
                style={{
                  flex: 1,
                  background: '#0284c7',
                  color: '#fff',
                  border: 'none',
                  padding: '10px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {isLoading ? 'Assessing...' : 'Assess Asthma Severity'}
              </button>
              {assessmentResult && (
                <button
                  type="button"
                  onClick={handleSaveEncounter}
                  disabled={isLoading}
                  style={{
                    background: '#10b981',
                    color: '#fff',
                    border: 'none',
                    padding: '10px 16px',
                    borderRadius: '6px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Save Encounter
                </button>
              )}
            </div>
          </div>

          {/* Assessment Output Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {assessmentResult && (
              <>
                <div style={{
                  background: '#1e293b',
                  padding: '20px',
                  borderRadius: '10px',
                  border: `2px solid ${
                    assessmentResult.severity === 'IMPENDING_ARREST'
                      ? '#ef4444'
                      : assessmentResult.severity === 'SEVERE'
                      ? '#f59e0b'
                      : '#10b981'
                  }`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', color: '#94a3b8' }}>Classification</span>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontWeight: 700,
                      fontSize: '12px',
                      background: assessmentResult.severity === 'IMPENDING_ARREST' ? '#ef4444' : '#f59e0b',
                      color: '#fff'
                    }}>
                      {assessmentResult.severity}
                    </span>
                  </div>

                  <p style={{ margin: '14px 0', fontSize: '15px', fontWeight: 600, lineHeight: 1.5 }}>
                    {assessmentResult.summary}
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', margin: '12px 0' }}>
                    <div style={{ background: '#0f172a', padding: '10px', borderRadius: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>Pseudonormal PaCO2 Alert</span>
                      <p style={{ margin: '4px 0 0', fontWeight: 700, color: assessmentResult.pseudonormalPaco2Alert ? '#ef4444' : '#10b981' }}>
                        {assessmentResult.pseudonormalPaco2Alert ? 'FATIGUE DETECTED' : 'Normal / Low'}
                      </p>
                    </div>

                    <div style={{ background: '#0f172a', padding: '10px', borderRadius: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>Intubation Risk</span>
                      <p style={{ margin: '4px 0 0', fontWeight: 700, color: assessmentResult.intubationRisk === 'EMERGENT' ? '#ef4444' : '#f59e0b' }}>
                        {assessmentResult.intubationRisk}
                      </p>
                    </div>
                  </div>

                  <h4 style={{ margin: '16px 0 8px', fontSize: '13px', color: '#38bdf8' }}>Recommended Actions</h4>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {assessmentResult.recommendedActions.map((action, i) => (
                      <li key={i}>{action}</li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Ventilator Physics & Auto-PEEP */}
      {activeTab === 'vent' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '20px' }}>
          {/* Vent Parameters */}
          <div style={{ background: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#38bdf8' }}>Obstructive Mechanical Ventilator Settings</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Height (cm)</label>
                <input
                  type="number"
                  value={heightCm}
                  onChange={(e) => setHeightCm(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Biological Sex</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as any)}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Actual Weight (kg)</label>
                <input
                  type="number"
                  value={weightKg}
                  onChange={(e) => setWeightKg(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Tidal Volume (mL)</label>
                <input
                  type="number"
                  value={tidalVolumeMl}
                  onChange={(e) => setTidalVolumeMl(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Ventilator RR (bpm)</label>
                <input
                  type="number"
                  value={ventRrBpm}
                  onChange={(e) => setVentRrBpm(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Inspiratory Flow (L/min)</label>
                <input
                  type="number"
                  value={inspFlowLpm}
                  onChange={(e) => setInspFlowLpm(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Applied Extrinsic PEEP</label>
                <input
                  type="number"
                  value={appliedPeep}
                  onChange={(e) => setAppliedPeep(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Auto-PEEP (Intrinsic PEEP)</label>
                <input
                  type="number"
                  value={autoPeepCmh2o}
                  onChange={(e) => setAutoPeepCmh2o(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Plateau Pressure (Pplat)</label>
                <input
                  type="number"
                  value={plateauPressureCmh2o}
                  onChange={(e) => setPlateauPressureCmh2o(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Peak Pressure (Ppeak)</label>
                <input
                  type="number"
                  value={peakPressureCmh2o}
                  onChange={(e) => setPeakPressureCmh2o(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                />
              </div>
            </div>

            <div style={{ marginTop: '14px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: '#fbbf24' }}>
                <input
                  type="checkbox"
                  checked={hasTbi}
                  onChange={(e) => setHasTbi(e.target.checked)}
                />
                Patient Has Acute TBI or Intracranial Hypertension (Prohibits Hypercapnia)
              </label>
            </div>

            <button
              type="button"
              onClick={handleCalculateVent}
              disabled={isLoading}
              style={{
                marginTop: '16px',
                width: '100%',
                background: '#0284c7',
                color: '#fff',
                border: 'none',
                padding: '10px',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Recalculate Dynamics & Airway Pressures
            </button>
          </div>

          {/* Vent Results Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {ventResult && (
              <>
                {ventResult.dynamicHyperinflationAlert && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '2px solid #ef4444',
                    padding: '16px',
                    borderRadius: '8px'
                  }}>
                    <h4 style={{ margin: '0 0 8px', color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>⚠️</span> DYNAMIC HYPERINFLATION & GAS TRAPPING ALERT
                    </h4>
                    <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5 }}>
                      Plateau pressure or Auto-PEEP is critically elevated ({ventResult.totalPeepCmh2o} cmH2O total PEEP). Extreme risk of tension pneumothorax and sudden circulatory collapse.
                    </p>
                  </div>
                )}

                <div style={{ background: '#1e293b', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: '14px', color: '#38bdf8' }}>Ventilator Physics Metrics</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    <div style={{ background: '#0f172a', padding: '10px', borderRadius: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>Devine IBW</span>
                      <p style={{ margin: '4px 0 0', fontWeight: 700 }}>{ventResult.ibwKg} kg</p>
                    </div>
                    <div style={{ background: '#0f172a', padding: '10px', borderRadius: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>Vt / kg IBW</span>
                      <p style={{ margin: '4px 0 0', fontWeight: 700, color: ventResult.vtSafe ? '#10b981' : '#f59e0b' }}>
                        {ventResult.vtPerKgIbw} mL/kg
                      </p>
                    </div>
                    <div style={{ background: '#0f172a', padding: '10px', borderRadius: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>Calculated I:E</span>
                      <p style={{ margin: '4px 0 0', fontWeight: 700, color: ventResult.prolongedExpiratoryTimeCompliant ? '#10b981' : '#ef4444' }}>
                        {ventResult.calculatedIeRatio}
                      </p>
                    </div>
                    <div style={{ background: '#0f172a', padding: '10px', borderRadius: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>Total PEEP</span>
                      <p style={{ margin: '4px 0 0', fontWeight: 700 }}>{ventResult.totalPeepCmh2o} cmH2O</p>
                    </div>
                    <div style={{ background: '#0f172a', padding: '10px', borderRadius: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>Driving Pressure</span>
                      <p style={{ margin: '4px 0 0', fontWeight: 700 }}>{ventResult.drivingPressureCmh2o} cmH2O</p>
                    </div>
                    <div style={{ background: '#0f172a', padding: '10px', borderRadius: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>Airway Resistance (Ppeak-Pplat)</span>
                      <p style={{ margin: '4px 0 0', fontWeight: 700, color: '#f59e0b' }}>{ventResult.airwayResistancePressureCmh2o} cmH2O</p>
                    </div>
                  </div>
                </div>

                {/* Permissive Hypercapnia Protocol */}
                <div style={{ background: '#1e293b', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '14px', color: '#38bdf8' }}>Permissive Hypercapnia Assessment</h4>
                  <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5 }}>
                    {ventResult.permissiveHypercapniaStatus.rationale}
                  </p>
                  {ventResult.permissiveHypercapniaStatus.contraindicationWarning && (
                    <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#ef4444', fontWeight: 600 }}>
                      {ventResult.permissiveHypercapniaStatus.contraindicationWarning}
                    </p>
                  )}
                </div>

                {/* Emergency Protocol */}
                {ventResult.emergencyDecompressionProtocol.indicated && (
                  <div style={{ background: '#1e293b', padding: '16px', borderRadius: '8px', border: '1px solid #ef4444' }}>
                    <h4 style={{ margin: '0 0 10px', fontSize: '14px', color: '#ef4444' }}>🚨 Emergency Apnea Decompression Protocol</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {ventResult.emergencyDecompressionProtocol.steps.map((step, idx) => (
                        <div key={idx} style={{ fontSize: '12px', lineHeight: 1.4 }}>{step}</div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Medical Escalation Tiers */}
      {activeTab === 'escalation' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px' }}>
          {/* Controls */}
          <div style={{ background: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#38bdf8' }}>Escalation Decision Engine</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Current Asthma Severity</label>
                <select
                  value={escalationSeverity}
                  onChange={(e) => setEscalationSeverity(e.target.value as any)}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                >
                  <option value="MILD">Mild</option>
                  <option value="MODERATE">Moderate</option>
                  <option value="SEVERE">Severe</option>
                  <option value="IMPENDING_ARREST">Impending Arrest</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Duration Refractory to First-Line (Minutes)</label>
                <input
                  type="number"
                  value={refractoryMinutes}
                  onChange={(e) => setRefractoryMinutes(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                />
              </div>

              <button
                type="button"
                onClick={handleEvaluateEscalation}
                style={{
                  marginTop: '10px',
                  background: '#0284c7',
                  color: '#fff',
                  border: 'none',
                  padding: '10px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Generate Pharmacotherapy Orders
              </button>
            </div>
          </div>

          {/* Pharmacotherapy Orders */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {escalationPlan && (
              <>
                <div style={{ background: '#1e293b', padding: '16px', borderRadius: '8px', border: '1px solid #0284c7' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#38bdf8' }}>{escalationPlan.tierName}</h3>
                    <span style={{ background: '#0284c7', color: '#fff', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 700 }}>
                      Tier {escalationPlan.tier}
                    </span>
                  </div>

                  <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {escalationPlan.orders.map((ord, idx) => (
                      <div key={idx} style={{ background: '#0f172a', padding: '12px', borderRadius: '6px', borderLeft: '4px solid #38bdf8' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 700, fontSize: '14px' }}>{ord.drug}</span>
                          <span style={{ color: '#38bdf8', fontSize: '12px', fontWeight: 600 }}>{ord.dose} ({ord.route})</span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0' }}>
                          Frequency: {ord.frequency} | Indication: {ord.indication}
                        </div>
                        <div style={{ fontSize: '11px', color: '#f59e0b', marginTop: '4px' }}>
                          Monitoring: {ord.monitoring}
                        </div>
                      </div>
                    ))}
                  </div>

                  {escalationPlan.criticalWarnings.length > 0 && (
                    <div style={{ marginTop: '16px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b', padding: '12px', borderRadius: '6px' }}>
                      <h5 style={{ margin: '0 0 6px', color: '#fbbf24', fontSize: '13px' }}>Critical Safety Alerts</h5>
                      {escalationPlan.criticalWarnings.map((w, i) => (
                        <p key={i} style={{ margin: 0, fontSize: '12px', color: '#f8fafc' }}>• {w}</p>
                      ))}
                    </div>
                  )}

                  {escalationPlan.rescueOptions.length > 0 && (
                    <div style={{ marginTop: '12px', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid #a855f7', padding: '12px', borderRadius: '6px' }}>
                      <h5 style={{ margin: '0 0 6px', color: '#c084fc', fontSize: '13px' }}>Refractory / ECMO Rescues</h5>
                      {escalationPlan.rescueOptions.map((r, i) => (
                        <p key={i} style={{ margin: 0, fontSize: '12px', color: '#f8fafc' }}>• {r}</p>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: History Logs */}
      {activeTab === 'history' && (
        <div style={{ background: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#38bdf8' }}>Prior Status Asthmaticus Encounters</h3>
          {historyEncounters.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>No recorded encounters for this patient.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {historyEncounters.map((enc) => (
                <div key={enc.id} style={{ background: '#0f172a', padding: '14px', borderRadius: '6px', border: '1px solid #334155' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px' }}>Encounter #{enc.id} - Severity: {enc.severity}</span>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>{new Date(enc.created_at).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', margin: '10px 0', fontSize: '12px' }}>
                    <div>PEF: {enc.pef_percent ? `${enc.pef_percent}%` : 'N/A'}</div>
                    <div>PaCO2: {enc.paco2_mmhg ? `${enc.paco2_mmhg} mmHg` : 'N/A'}</div>
                    <div>pH: {enc.ph || 'N/A'}</div>
                    <div>Intubated: {enc.intubated ? 'YES' : 'NO'}</div>
                  </div>
                  {enc.clinical_notes && (
                    <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#cbd5e1' }}>{enc.clinical_notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default StatusPulmoHub;
