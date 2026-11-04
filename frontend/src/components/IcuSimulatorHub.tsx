import React, { useState, useEffect, useRef } from 'react';

interface SimulatedBed {
  id?: number;
  wardId?: number;
  bedNumber: number;
  patientId: number;
  patientName: string;
  age: number;
  sex: string;
  clinicalProfileId: string;
  primaryDiagnosis: string;
  state: {
    patientId: number;
    cardiovascular: {
      heartRate: number;
      systolicBp: number;
      diastolicBp: number;
      meanArterialPressure: number;
      shockIndex: number;
      vasoactiveInotropicScore?: number;
      activeMcsDevice?: string;
      acuteAorticDissectionTypeA?: boolean;
    };
    neurologic?: {
      gcsScore?: number;
      icpMmhg?: number;
      cppMmhg?: number;
      statusEpilepticusActive?: boolean;
      spinalCordInjuryLevel?: string;
      subarachnoidVasospasmActive?: boolean;
    };
    respiratory?: {
      paO2FiO2Ratio?: number;
      mechanicalVentilation?: boolean;
      drivingPressureCmH2O?: number;
      severeAsthmaBronchospasm?: boolean;
    };
    renalFluids?: {
      crrtActive?: boolean;
      bladderPressureIapMmhg?: number;
      hourlyUrineOutputMlKgH?: number;
    };
    obstetric?: {
      isPregnantOrPostpartum?: boolean;
      gestationalAgeWeeks?: number;
      activeMaternalCardiacArrest?: boolean;
      postpartumHemorrhageActive?: boolean;
      severePreeclampsiaEclampsia?: boolean;
    };
    traumaAndBurns?: {
      burnTbsaPercentage?: number;
    };
  };
  centuryScore: number;
  centuryTier: 'STABLE_OBSERVATION' | 'MODERATE_MONITORED' | 'HIGH_CRITICAL' | 'EXTREME_SURGE_ORCHESTRATED';
  primaryDomain: string;
  activeConflicts: Array<{
    conflictId: string;
    title: string;
    hazardDescription: string;
    involvedPhases: string;
    arbitratedResolutionDirective: string;
    priorityRank: number;
  }>;
  dispatchedTeams: string[];
  isCrashing: boolean;
  trend: 'STABLE' | 'DETERIORATING' | 'IMPROVING';
  lastIntervention?: string;
  lastUpdated: string;
}

export const IcuSimulatorHub: React.FC = () => {
  const [beds, setBeds] = useState<SimulatedBed[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [selectedBedNumber, setSelectedBedNumber] = useState<number>(1);
  const [statusMessage, setStatusMessage] = useState<string>('Connecting to telemetry stream...');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Load initial beds
  const fetchBeds = async () => {
    try {
      const res = await fetch('/api/clinician/simulator/beds');
      if (res.ok) {
        const data = await res.json();
        setBeds(data.beds || []);
        setIsRunning(Boolean(data.isRunning));
        setStatusMessage('Telemetry synchronized.');
      }
    } catch (err) {
      console.error('Failed to fetch simulator beds:', err);
      setStatusMessage('Error connecting to backend.');
    }
  };

  // SSE Stream listener
  useEffect(() => {
    fetchBeds();

    const connectSSE = () => {
      try {
        const es = new EventSource('/api/clinician/simulator/stream');
        eventSourceRef.current = es;

        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (Array.isArray(data)) {
              setBeds(data);
            }
          } catch (e) {
            console.error('SSE JSON parse error:', e);
          }
        };

        es.onerror = () => {
          es.close();
          // Retry after 5s
          setTimeout(connectSSE, 5000);
        };
      } catch (err) {
        console.error('SSE initialization error:', err);
      }
    };

    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const handleStart = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/simulator/start', { method: 'POST' });
      if (res.ok) {
        setIsRunning(true);
        setStatusMessage('Telemetry simulation engine RUNNING.');
      }
    } catch {
      setStatusMessage('Failed to start simulation.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/simulator/stop', { method: 'POST' });
      if (res.ok) {
        setIsRunning(false);
        setStatusMessage('Telemetry simulation engine PAUSED.');
      }
    } catch {
      setStatusMessage('Failed to pause simulation.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/simulator/reset', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setBeds(data.beds || []);
        setStatusMessage('Ward reset to baseline canonical state.');
      }
    } catch {
      setStatusMessage('Failed to reset ward.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTriggerCrisis = async (bedNumber: number, crisisType: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/clinician/simulator/bed/${bedNumber}/crisis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crisisType })
      });
      if (res.ok) {
        const updated = await res.json();
        setBeds(prev => prev.map(b => b.bedNumber === bedNumber ? updated.bed : b));
        setStatusMessage(`CRISIS TRIGGERED on Bed #${bedNumber}: ${crisisType}`);
      }
    } catch {
      setStatusMessage(`Failed to trigger crisis on Bed #${bedNumber}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyIntervention = async (bedNumber: number, interventionType: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/clinician/simulator/bed/${bedNumber}/intervene`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interventionType })
      });
      if (res.ok) {
        const updated = await res.json();
        setBeds(prev => prev.map(b => b.bedNumber === bedNumber ? updated.bed : b));
        setStatusMessage(`INTERVENTION APPLIED on Bed #${bedNumber}: ${interventionType}`);
      }
    } catch {
      setStatusMessage(`Failed to apply intervention on Bed #${bedNumber}`);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedBed = beds.find(b => b.bedNumber === selectedBedNumber) || beds[0];

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'EXTREME_SURGE_ORCHESTRATED': return '#ef4444'; // Red
      case 'HIGH_CRITICAL': return '#f97316'; // Orange
      case 'MODERATE_MONITORED': return '#eab308'; // Yellow
      case 'STABLE_OBSERVATION': return '#10b981'; // Green
      default: return '#64748b';
    }
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'DETERIORATING') return '🔻 CRASHING';
    if (trend === 'IMPROVING') return '🔺 IMPROVING';
    return '🟢 STABLE';
  };

  // Ward counts
  const extremeCount = beds.filter(b => b.centuryTier === 'EXTREME_SURGE_ORCHESTRATED').length;
  const highCount = beds.filter(b => b.centuryTier === 'HIGH_CRITICAL').length;
  const conflictCount = beds.reduce((acc, b) => acc + (b.activeConflicts?.length || 0), 0);

  return (
    <div style={{ backgroundColor: '#0f172a', color: '#f8fafc', padding: '24px', borderRadius: '12px', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      {/* Header & Simulation Control Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '16px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🏥</span> Real-Time Multi-Patient ICU Telemetry Simulator & Stress Engine
          </h2>
          <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '14px' }}>
            Century Grand ICU Ward (12 Canonical High-Acuity Beds) • Multi-Organ Dynamic Stress & Conflict Arbitration
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: isRunning ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${isRunning ? '#10b981' : '#ef4444'}`,
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: 600,
            color: isRunning ? '#10b981' : '#ef4444'
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isRunning ? '#10b981' : '#ef4444' }}></span>
            {isRunning ? 'ENGINE STREAMING (2s)' : 'ENGINE PAUSED'}
          </div>

          {isRunning ? (
            <button
              onClick={handleStop}
              disabled={isLoading}
              style={{ backgroundColor: '#eab308', color: '#0f172a', fontWeight: 'bold', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
            >
              ⏸ Pause
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={isLoading}
              style={{ backgroundColor: '#10b981', color: '#ffffff', fontWeight: 'bold', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
            >
              ▶ Start Live Tick
            </button>
          )}

          <button
            onClick={handleReset}
            disabled={isLoading}
            style={{ backgroundColor: '#334155', color: '#cbd5e1', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
          >
            🔄 Reset Ward
          </button>
        </div>
      </div>

      {/* Ward Telemetry Summary Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '20px' }}>
        <div style={{ backgroundColor: '#1e293b', padding: '14px', borderRadius: '8px', borderLeft: '4px solid #38bdf8' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>TOTAL MONITORED BEDS</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f8fafc' }}>{beds.length} / 12</div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Canonical Spectrum</div>
        </div>

        <div style={{ backgroundColor: '#1e293b', padding: '14px', borderRadius: '8px', borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>EXTREME SURGE TIER</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>{extremeCount}</div>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>Century Score &ge; 75</div>
        </div>

        <div style={{ backgroundColor: '#1e293b', padding: '14px', borderRadius: '8px', borderLeft: '4px solid #f97316' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>HIGH CRITICAL TIER</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f97316' }}>{highCount}</div>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>Century Score 50-74</div>
        </div>

        <div style={{ backgroundColor: '#1e293b', padding: '14px', borderRadius: '8px', borderLeft: '4px solid #a855f7' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>ACTIVE CONFLICTS</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#a855f7' }}>{conflictCount}</div>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>Arbitrated in Real-Time</div>
        </div>
      </div>

      {statusMessage && (
        <div style={{ backgroundColor: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '10px 16px', borderRadius: '6px', color: '#38bdf8', fontSize: '13px', marginBottom: '20px' }}>
          ℹ️ {statusMessage}
        </div>
      )}

      {/* Main Workspace: 12-Bed Telemetry Grid + Inspector Sidecar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px' }}>
        {/* 12-Bed Visual Tile Grid */}
        <div>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#cbd5e1' }}>ICU Bed Matrix (Click to Inspect & Intervene)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {beds.map((bed) => {
              const tierColor = getTierColor(bed.centuryTier);
              const isSelected = bed.bedNumber === selectedBedNumber;

              return (
                <div
                  key={bed.bedNumber}
                  onClick={() => setSelectedBedNumber(bed.bedNumber)}
                  style={{
                    backgroundColor: isSelected ? '#1e293b' : '#0b1329',
                    border: isSelected ? `2px solid ${tierColor}` : '1px solid #334155',
                    borderRadius: '8px',
                    padding: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease-in-out',
                    boxShadow: isSelected ? `0 0 12px rgba(56, 189, 248, 0.2)` : 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#f8fafc' }}>
                      Bed #{bed.bedNumber}
                    </div>
                    <span style={{
                      backgroundColor: `${tierColor}22`,
                      color: tierColor,
                      border: `1px solid ${tierColor}55`,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 'bold'
                    }}>
                      SCORE {bed.centuryScore}
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#93c5fd', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {bed.patientName}
                  </div>

                  <div style={{ fontSize: '11px', color: '#94a3b8', margin: '4px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {bed.primaryDiagnosis}
                  </div>

                  {/* Vitals Ribbon */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', backgroundColor: '#090d16', padding: '6px', borderRadius: '4px', margin: '6px 0', fontSize: '11px' }}>
                    <div>
                      <span style={{ color: '#64748b' }}>HR: </span>
                      <span style={{ fontWeight: 'bold', color: bed.state.cardiovascular.heartRate === 0 ? '#ef4444' : '#38bdf8' }}>
                        {bed.state.cardiovascular.heartRate}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>BP: </span>
                      <span style={{ fontWeight: 'bold', color: '#f8fafc' }}>
                        {bed.state.cardiovascular.systolicBp}/{bed.state.cardiovascular.diastolicBp}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>MAP: </span>
                      <span style={{ fontWeight: 'bold', color: bed.state.cardiovascular.meanArterialPressure < 65 ? '#ef4444' : '#10b981' }}>
                        {bed.state.cardiovascular.meanArterialPressure}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', marginTop: '6px' }}>
                    <span style={{ color: bed.trend === 'DETERIORATING' ? '#ef4444' : bed.trend === 'IMPROVING' ? '#10b981' : '#94a3b8' }}>
                      {getTrendIcon(bed.trend)}
                    </span>
                    {bed.activeConflicts?.length > 0 && (
                      <span style={{ color: '#a855f7', fontWeight: 'bold' }}>
                        ⚠️ {bed.activeConflicts.length} Conflict{bed.activeConflicts.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Bed Inspector & Stress Engine Commander */}
        {selectedBed && (
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #334155', paddingBottom: '12px', marginBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 'bold' }}>BED #{selectedBed.bedNumber} INSPECTOR</span>
                <h3 style={{ margin: '2px 0', fontSize: '18px', color: '#f8fafc' }}>{selectedBed.patientName}</h3>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>{selectedBed.age} y/o {selectedBed.sex} • Profile: {selectedBed.clinicalProfileId}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: getTierColor(selectedBed.centuryTier) }}>
                  {selectedBed.centuryScore}
                </div>
                <div style={{ fontSize: '11px', color: getTierColor(selectedBed.centuryTier), fontWeight: 'bold' }}>
                  {selectedBed.centuryTier}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>PRIMARY CLINICAL DIAGNOSIS</div>
              <div style={{ backgroundColor: '#0f172a', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', borderLeft: `3px solid ${getTierColor(selectedBed.centuryTier)}` }}>
                {selectedBed.primaryDiagnosis}
              </div>
            </div>

            {/* Detailed Organ Telemetry */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>ORGAN TELEMETRY METRICS</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '12px' }}>
                <div style={{ backgroundColor: '#0f172a', padding: '8px', borderRadius: '4px' }}>
                  <div style={{ color: '#64748b' }}>Cardiovascular:</div>
                  <div>HR: {selectedBed.state.cardiovascular.heartRate} bpm | Shock Idx: {selectedBed.state.cardiovascular.shockIndex}</div>
                  <div>BP: {selectedBed.state.cardiovascular.systolicBp}/{selectedBed.state.cardiovascular.diastolicBp} (MAP {selectedBed.state.cardiovascular.meanArterialPressure})</div>
                  {selectedBed.state.cardiovascular.activeMcsDevice && <div style={{ color: '#eab308' }}>MCS: {selectedBed.state.cardiovascular.activeMcsDevice}</div>}
                </div>

                <div style={{ backgroundColor: '#0f172a', padding: '8px', borderRadius: '4px' }}>
                  <div style={{ color: '#64748b' }}>Neurologic & ICP:</div>
                  <div>GCS: {selectedBed.state.neurologic?.gcsScore ?? 'N/A'}</div>
                  <div>ICP: {selectedBed.state.neurologic?.icpMmhg ?? 'N/A'} mmHg | CPP: {selectedBed.state.neurologic?.cppMmhg ?? 'N/A'} mmHg</div>
                  {selectedBed.state.neurologic?.statusEpilepticusActive && <div style={{ color: '#ef4444' }}>Status Epilepticus: ACTIVE</div>}
                </div>

                <div style={{ backgroundColor: '#0f172a', padding: '8px', borderRadius: '4px' }}>
                  <div style={{ color: '#64748b' }}>Respiratory & Gas:</div>
                  <div>P/F Ratio: {selectedBed.state.respiratory?.paO2FiO2Ratio ?? 'N/A'}</div>
                  <div>Vent: {selectedBed.state.respiratory?.mechanicalVentilation ? 'YES (Invasive)' : 'None'}</div>
                </div>

                <div style={{ backgroundColor: '#0f172a', padding: '8px', borderRadius: '4px' }}>
                  <div style={{ color: '#64748b' }}>Renal, Fluids & Abdomen:</div>
                  <div>IAP (Bladder): {selectedBed.state.renalFluids?.bladderPressureIapMmhg ?? 'N/A'} mmHg</div>
                  <div>UOP: {selectedBed.state.renalFluids?.hourlyUrineOutputMlKgH ?? 'N/A'} mL/kg/h</div>
                </div>
              </div>
            </div>

            {/* Active Cross-Phase Conflicts */}
            {selectedBed.activeConflicts && selectedBed.activeConflicts.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', color: '#a855f7', fontWeight: 'bold', marginBottom: '6px' }}>
                  ⚠️ ARBITRATED CROSS-PHASE CLINICAL CONFLICTS ({selectedBed.activeConflicts.length})
                </div>
                {selectedBed.activeConflicts.map((c, idx) => (
                  <div key={idx} style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '6px', padding: '10px', marginBottom: '6px', fontSize: '12px' }}>
                    <div style={{ fontWeight: 'bold', color: '#c084fc' }}>{c.title}</div>
                    <div style={{ color: '#94a3b8', margin: '4px 0' }}>{c.hazardDescription}</div>
                    <div style={{ color: '#38bdf8', fontWeight: 600 }}>{c.arbitratedResolutionDirective}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Dispatched Teams */}
            {selectedBed.dispatchedTeams && selectedBed.dispatchedTeams.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>ACTIVE SURGE TEAMS MOBILIZED</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {selectedBed.dispatchedTeams.map((team, idx) => (
                    <span key={idx} style={{ backgroundColor: '#334155', color: '#f1f5f9', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500 }}>
                      🚑 {team}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Stress Engine Commander: Crisis Injection & Protocol Interventions */}
            <div style={{ borderTop: '1px solid #334155', paddingTop: '14px' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#38bdf8', marginBottom: '8px' }}>
                ⚡ STRESS ENGINE COMMANDER (BED #{selectedBed.bedNumber})
              </div>

              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600, marginBottom: '4px' }}>TRIGGER ACUTE CRISIS:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  <button
                    onClick={() => handleTriggerCrisis(selectedBed.bedNumber, 'MATERNAL_ARREST')}
                    disabled={isLoading}
                    style={{ backgroundColor: '#7f1d1d', color: '#fca5a5', border: '1px solid #ef4444', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                  >
                    🚨 Maternal Arrest
                  </button>
                  <button
                    onClick={() => handleTriggerCrisis(selectedBed.bedNumber, 'ACS_BLADDER_SPIKE')}
                    disabled={isLoading}
                    style={{ backgroundColor: '#7f1d1d', color: '#fca5a5', border: '1px solid #ef4444', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                  >
                    💥 ACS Bladder Spike (IAP 25)
                  </button>
                  <button
                    onClick={() => handleTriggerCrisis(selectedBed.bedNumber, 'AORTIC_DISSECTION_SPIKE')}
                    disabled={isLoading}
                    style={{ backgroundColor: '#7f1d1d', color: '#fca5a5', border: '1px solid #ef4444', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                  >
                    📈 SBP Spike (Aorta Dissection)
                  </button>
                  <button
                    onClick={() => handleTriggerCrisis(selectedBed.bedNumber, 'HERNIATION_ICP_CRISIS')}
                    disabled={isLoading}
                    style={{ backgroundColor: '#7f1d1d', color: '#fca5a5', border: '1px solid #ef4444', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                  >
                    🧠 Herniation (ICP 34)
                  </button>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 600, marginBottom: '4px' }}>APPLY PROTOCOL INTERVENTION:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  <button
                    onClick={() => handleApplyIntervention(selectedBed.bedNumber, 'MANUAL_LUD_PMCS')}
                    disabled={isLoading}
                    style={{ backgroundColor: '#064e3b', color: '#6ee7b7', border: '1px solid #10b981', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                  >
                    🩺 Manual LUD / PMCS
                  </button>
                  <button
                    onClick={() => handleApplyIntervention(selectedBed.bedNumber, 'ALBUMIN_ESCHAROTOMY')}
                    disabled={isLoading}
                    style={{ backgroundColor: '#064e3b', color: '#6ee7b7', border: '1px solid #10b981', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                  >
                    💧 5% Albumin + Escharotomy
                  </button>
                  <button
                    onClick={() => handleApplyIntervention(selectedBed.bedNumber, 'ESMOLOL_ANTI_IMPULSE')}
                    disabled={isLoading}
                    style={{ backgroundColor: '#064e3b', color: '#6ee7b7', border: '1px solid #10b981', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                  >
                    💉 Esmolol Anti-Impulse
                  </button>
                  <button
                    onClick={() => handleApplyIntervention(selectedBed.bedNumber, 'HYPERTONIC_SALINE_OSMOTHERAPY')}
                    disabled={isLoading}
                    style={{ backgroundColor: '#064e3b', color: '#6ee7b7', border: '1px solid #10b981', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                  >
                    🧪 3% Hypertonic Saline
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
