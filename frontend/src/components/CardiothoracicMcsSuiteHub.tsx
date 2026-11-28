import React, { useState } from 'react';

// ============================================================================
// PHASE 131: IMPELLA-MICROAXIAL-FLOW SUB-HUB
// ============================================================================
export const ImpellaMicroaxialHub: React.FC = () => {
  const [deviceModel, setDeviceModel] = useState<'Impella CP' | 'Impella 5.0' | 'Impella 5.5' | 'Impella RP'>('Impella CP');
  const [pLevel, setPLevel] = useState<string>('P-8');
  const [flowRateLpm, setFlowRateLpm] = useState<number>(3.2);
  const [motorCurrentMa, setMotorCurrentMa] = useState<number>(620);
  const [purgePressureMmhg, setPurgePressureMmhg] = useState<number>(550);
  const [purgeFlowMlHr, setPurgeFlowMlHr] = useState<number>(11.0);
  const [meanArterialPressureMmhg, setMeanArterialPressureMmhg] = useState<number>(72);
  const [centralVenousPressureMmhg, setCentralVenousPressureMmhg] = useState<number>(11);
  const [cardiacOutputLpm, setCardiacOutputLpm] = useState<number>(4.8);
  const [echocardiographicMalposition, setEchocardiographicMalposition] = useState<boolean>(false);
  const [systemicHypovolemiaSuspected, setSystemicHypovolemiaSuspected] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleEvaluate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/impella-microaxial/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: 1,
          deviceModel,
          pLevel,
          flowRateLpm,
          motorCurrentMa,
          purgePressureMmhg,
          purgeFlowMlHr,
          meanArterialPressureMmhg,
          centralVenousPressureMmhg,
          cardiacOutputLpm,
          echocardiographicMalposition,
          systemicHypovolemiaSuspected
        })
      });
      if (res.ok) setResult(await res.json());
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#1e293b', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#06b6d4', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>🌀</span> Phase 131: IMPELLA-MICROAXIAL-FLOW (Microaxial Hemodynamics & Purge Sentinel)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>DEVICE MODEL</label>
              <select
                value={deviceModel}
                onChange={e => setDeviceModel(e.target.value as any)}
                style={{ width: '100%', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }}
              >
                <option value="Impella CP">Impella CP</option>
                <option value="Impella 5.0">Impella 5.0</option>
                <option value="Impella 5.5">Impella 5.5</option>
                <option value="Impella RP">Impella RP</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>P-LEVEL</label>
              <input type="text" value={pLevel} onChange={e => setPLevel(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>FLOW (L/min)</label>
              <input type="number" step="0.1" value={flowRateLpm} onChange={e => setFlowRateLpm(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>MOTOR (mA)</label>
              <input type="number" value={motorCurrentMa} onChange={e => setMotorCurrentMa(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>PURGE (mmHg)</label>
              <input type="number" value={purgePressureMmhg} onChange={e => setPurgePressureMmhg(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>PURGE FLOW</label>
              <input type="number" step="0.5" value={purgeFlowMlHr} onChange={e => setPurgeFlowMlHr(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>MAP (mmHg)</label>
              <input type="number" value={meanArterialPressureMmhg} onChange={e => setMeanArterialPressureMmhg(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>CVP (mmHg)</label>
              <input type="number" value={centralVenousPressureMmhg} onChange={e => setCentralVenousPressureMmhg(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>TOTAL CO (L/min)</label>
              <input type="number" step="0.1" value={cardiacOutputLpm} onChange={e => setCardiacOutputLpm(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f8fafc', cursor: 'pointer' }}>
                <input type="checkbox" checked={echocardiographicMalposition} onChange={e => setEchocardiographicMalposition(e.target.checked)} />
                Cannula Wall Abutment / Malposition
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f8fafc', cursor: 'pointer' }}>
                <input type="checkbox" checked={systemicHypovolemiaSuspected} onChange={e => setSystemicHypovolemiaSuspected(e.target.checked)} />
                Systemic Hypovolemia / Underfilled LV
              </label>
            </div>
          </div>

          <button onClick={handleEvaluate} disabled={isLoading} style={{ backgroundColor: '#0891b2', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, width: '100%' }}>
            {isLoading ? 'ANALYZING IMPELLA...' : 'EVALUATE IMPELLA CPO, SUCTION & PURGE'}
          </button>
        </div>

        <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #1e293b', fontSize: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#06b6d4' }}>Impella Circulatory Support Status</h4>
          {result ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Cardiac Power Output (CPO):</span>
                <span style={{ fontWeight: 'bold', color: result.cpoShockStatus === 'ADEQUATE_PERFUSION' ? '#10b981' : '#ef4444' }}>
                  {result.cardiacPowerOutputWatts} W ({result.cpoShockStatus})
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Suction Alarm:</span>
                <span style={{ fontWeight: 'bold', color: result.suctionAlarmPresent ? '#ef4444' : '#10b981' }}>
                  {result.suctionAlarmPresent ? `SUCTION ACTIVE (${result.suctionEtiology})` : 'NO SUCTION (STABLE)'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Purge System:</span>
                <span style={{ fontWeight: 'bold', color: result.purgeStatus === 'PURGE_NORMAL' ? '#10b981' : '#f59e0b' }}>
                  {result.purgeStatus}
                </span>
              </div>
              {result.hemodynamicDirectives.map((d: string, i: number) => (
                <div key={i} style={{ backgroundColor: '#1e293b', padding: '6px', borderRadius: '4px', marginBottom: '4px', color: '#cffafe', fontSize: '11px' }}>🌀 {d}</div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#64748b' }}>Configure Impella microaxial flow rates, motor current, and purge telemetry.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PHASE 132: ECMO-RECIRCULATION-HARLEQUIN SUB-HUB
// ============================================================================
export const EcmoRecirculationHub: React.FC = () => {
  const [ecmoMode, setEcmoMode] = useState<'VV_ECMO' | 'VA_ECMO' | 'VAV_ECMO'>('VV_ECMO');
  const [preOxygenatorSatPct, setPreOxygenatorSatPct] = useState<number>(84);
  const [postOxygenatorSatPct, setPostOxygenatorSatPct] = useState<number>(99);
  const [mixedVenousSatPct, setMixedVenousSatPct] = useState<number>(68);
  const [rightRadialSpo2Pct, setRightRadialSpo2Pct] = useState<number>(76);
  const [femoralArterialSpo2Pct, setFemoralArterialSpo2Pct] = useState<number>(98);
  const [sweepGasFlowLpm, setSweepGasFlowLpm] = useState<number>(6.0);
  const [pumpFlowLpm, setPumpFlowLpm] = useState<number>(4.2);
  const [nativeLungTidalVolumeMl, setNativeLungTidalVolumeMl] = useState<number>(180);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleEvaluate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/ecmo-recirculation/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: 1,
          ecmoMode,
          preOxygenatorSatPct,
          postOxygenatorSatPct,
          mixedVenousSatPct,
          rightRadialSpo2Pct,
          femoralArterialSpo2Pct,
          sweepGasFlowLpm,
          pumpFlowLpm,
          nativeLungTidalVolumeMl
        })
      });
      if (res.ok) setResult(await res.json());
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#1e293b', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#ec4899', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>🫁</span> Phase 132: ECMO-RECIRCULATION-HARLEQUIN (Dual-Lumen RF & Harlequin Syndrome)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ marginBottom: '12px', fontSize: '12px' }}>
            <label style={{ display: 'block', color: '#94a3b8', marginBottom: '4px' }}>ECMO CONFIGURATION</label>
            <select
              value={ecmoMode}
              onChange={e => setEcmoMode(e.target.value as any)}
              style={{ width: '100%', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }}
            >
              <option value="VV_ECMO">Veno-Venous (VV) ECMO (Recirculation Fraction Analysis)</option>
              <option value="VA_ECMO">Veno-Arterial (VA) ECMO (Harlequin / North-South Syndrome)</option>
              <option value="VAV_ECMO">Veno-Arterio-Venous (V-AV) ECMO (Hybrid Drainage/Perfusion)</option>
            </select>
          </div>

          {ecmoMode === 'VV_ECMO' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', color: '#94a3b8' }}>PRE-OXY SAT (%)</label>
                <input type="number" value={preOxygenatorSatPct} onChange={e => setPreOxygenatorSatPct(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
              </div>
              <div>
                <label style={{ display: 'block', color: '#94a3b8' }}>POST-OXY SAT (%)</label>
                <input type="number" value={postOxygenatorSatPct} onChange={e => setPostOxygenatorSatPct(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
              </div>
              <div>
                <label style={{ display: 'block', color: '#94a3b8' }}>MIXED VENOUS (%)</label>
                <input type="number" value={mixedVenousSatPct} onChange={e => setMixedVenousSatPct(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', color: '#94a3b8' }}>R-RADIAL SpO2 (%) [BRAIN]</label>
                <input type="number" value={rightRadialSpo2Pct} onChange={e => setRightRadialSpo2Pct(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
              </div>
              <div>
                <label style={{ display: 'block', color: '#94a3b8' }}>FEMORAL SpO2 (%) [ECMO]</label>
                <input type="number" value={femoralArterialSpo2Pct} onChange={e => setFemoralArterialSpo2Pct(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>SWEEP (L/min)</label>
              <input type="number" step="0.5" value={sweepGasFlowLpm} onChange={e => setSweepGasFlowLpm(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>PUMP (L/min)</label>
              <input type="number" step="0.1" value={pumpFlowLpm} onChange={e => setPumpFlowLpm(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>NATIVE VT (mL)</label>
              <input type="number" value={nativeLungTidalVolumeMl} onChange={e => setNativeLungTidalVolumeMl(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <button onClick={handleEvaluate} disabled={isLoading} style={{ backgroundColor: '#db2777', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, width: '100%' }}>
            {isLoading ? 'ANALYZING ECMO...' : 'EVALUATE RECIRCULATION & DIFFERENTIAL HYPOXEMIA'}
          </button>
        </div>

        <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #1e293b', fontSize: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#ec4899' }}>Oxygenation & Shunt Status</h4>
          {result ? (
            <div>
              {result.recirculationFractionPct !== undefined && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#94a3b8' }}>Recirculation Fraction:</span>
                  <span style={{ fontWeight: 'bold', color: result.recirculationFractionPct >= 30 ? '#ef4444' : '#10b981' }}>
                    {result.recirculationFractionPct}% ({result.recirculationRiskTier})
                  </span>
                </div>
              )}
              {result.differentialHypoxemiaPresent && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#94a3b8' }}>Differential Hypoxemia:</span>
                  <span style={{ fontWeight: 'bold', color: '#ef4444' }}>
                    CRITICAL HARLEQUIN SYNDROME (Δ {result.radialToFemoralGradientPct}%)
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Risk Tier:</span>
                <span style={{ fontWeight: 'bold', color: result.recirculationRiskTier.includes('CRITICAL') || result.recirculationRiskTier.includes('SEVERE') ? '#ef4444' : '#10b981' }}>
                  {result.recirculationRiskTier}
                </span>
              </div>
              {result.ecmoDirectives.map((d: string, i: number) => (
                <div key={i} style={{ backgroundColor: '#1e293b', padding: '6px', borderRadius: '4px', marginBottom: '4px', color: '#fbcfe8', fontSize: '11px' }}>🫁 {d}</div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#64748b' }}>Configure circuit blood gases and dual-pulse oximetry markers.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PHASE 133: VENTILATOR-ASYNCHRONY-NEUROMUSCULAR SUB-HUB
// ============================================================================
export const VentilatorAsynchronyHub: React.FC = () => {
  const [totalBreathsAnalyzed, setTotalBreathsAnalyzed] = useState<number>(100);
  const [reverseTriggeringEvents, setReverseTriggeringEvents] = useState<number>(12);
  const [doubleTriggeringEvents, setDoubleTriggeringEvents] = useState<number>(6);
  const [ineffectiveTriggeringEvents, setIneffectiveTriggeringEvents] = useState<number>(4);
  const [ventilatorSetRateBpm, setVentilatorSetRateBpm] = useState<number>(18);
  const [measuredPatientRateBpm, setMeasuredPatientRateBpm] = useState<number>(24);
  const [intrinsicPeepCmH2O, setIntrinsicPeepCmH2O] = useState<number>(4.0);
  const [inspiratoryTimeSec, setInspiratoryTimeSec] = useState<number>(0.85);
  const [patientOnNeuromuscularBlockade, setPatientOnNeuromuscularBlockade] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleEvaluate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/ventilator-asynchrony/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: 1,
          totalBreathsAnalyzed,
          reverseTriggeringEvents,
          doubleTriggeringEvents,
          ineffectiveTriggeringEvents,
          ventilatorSetRateBpm,
          measuredPatientRateBpm,
          intrinsicPeepCmH2O,
          inspiratoryTimeSec,
          patientOnNeuromuscularBlockade
        })
      });
      if (res.ok) setResult(await res.json());
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#1e293b', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>🫁</span> Phase 133: VENTILATOR-ASYNCHRONY-NEUROMUSCULAR (Reverse Triggering & AI Index)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>TOTAL BREATHS</label>
              <input type="number" value={totalBreathsAnalyzed} onChange={e => setTotalBreathsAnalyzed(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>REVERSE TRIG (#)</label>
              <input type="number" value={reverseTriggeringEvents} onChange={e => setReverseTriggeringEvents(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>DOUBLE TRIG (#)</label>
              <input type="number" value={doubleTriggeringEvents} onChange={e => setDoubleTriggeringEvents(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>INEFFECTIVE (#)</label>
              <input type="number" value={ineffectiveTriggeringEvents} onChange={e => setIneffectiveTriggeringEvents(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>SET RATE (bpm)</label>
              <input type="number" value={ventilatorSetRateBpm} onChange={e => setVentilatorSetRateBpm(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>ACTUAL RATE</label>
              <input type="number" value={measuredPatientRateBpm} onChange={e => setMeasuredPatientRateBpm(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>AUTO-PEEP (cm)</label>
              <input type="number" step="0.5" value={intrinsicPeepCmH2O} onChange={e => setIntrinsicPeepCmH2O(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>Ti (sec)</label>
              <input type="number" step="0.05" value={inspiratoryTimeSec} onChange={e => setInspiratoryTimeSec(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ marginBottom: '14px', fontSize: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f8fafc', cursor: 'pointer' }}>
              <input type="checkbox" checked={patientOnNeuromuscularBlockade} onChange={e => setPatientOnNeuromuscularBlockade(e.target.checked)} />
              Patient Currently on Neuromuscular Blockade Infusion
            </label>
          </div>

          <button onClick={handleEvaluate} disabled={isLoading} style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, width: '100%' }}>
            {isLoading ? 'ANALYZING ASYNCHRONY...' : 'COMPUTE ASYNCHRONY INDEX & PROTOCOL'}
          </button>
        </div>

        <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #1e293b', fontSize: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#8b5cf6' }}>Patient-Ventilator Interaction</h4>
          {result ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Asynchrony Index (AI):</span>
                <span style={{ fontWeight: 'bold', color: result.asynchronyIndexPct >= 10 ? '#ef4444' : '#10b981' }}>
                  {result.asynchronyIndexPct}% ({result.asynchronySeverityTier})
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Volutrauma Risk:</span>
                <span style={{ fontWeight: 'bold', color: result.breathStackingVolutraumaRisk === 'CRITICAL_VOLUTRAUMA' ? '#ef4444' : '#f59e0b' }}>
                  {result.breathStackingVolutraumaRisk}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8' }}>NMBA Indication:</span>
                <span style={{ fontWeight: 'bold', color: result.neuromuscularBlockadeIndicated ? '#ef4444' : '#10b981' }}>
                  {result.neuromuscularBlockadeIndicated ? 'CISATRACURIUM RECOMMENDED' : 'CONSERVATIVE ADJUSTMENT'}
                </span>
              </div>
              {result.ventilatorDirectives.map((d: string, i: number) => (
                <div key={i} style={{ backgroundColor: '#1e293b', padding: '6px', borderRadius: '4px', marginBottom: '4px', color: '#ddd6fe', fontSize: '11px' }}>⚡ {d}</div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#64748b' }}>Input breath count and asynchronous event tallies to identify entrainment dyssynchrony.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PHASE 134: POST-CARDIOTOMY-VASOPLEGIA SUB-HUB
// ============================================================================
export const VasoplegicShockRescueHub: React.FC = () => {
  const [meanArterialPressureMmhg, setMeanArterialPressureMmhg] = useState<number>(54);
  const [norepinephrineEquivalentMcgKgMin, setNorepinephrineEquivalentMcgKgMin] = useState<number>(0.42);
  const [systemicVascularResistanceDynes, setSystemicVascularResistanceDynes] = useState<number>(480);
  const [cardiacIndexLMinM2, setCardiacIndexLMinM2] = useState<number>(3.2);
  const [hoursPostCardiopulmonaryBypass, setHoursPostCardiopulmonaryBypass] = useState<number>(3);
  const [currentVasopressinUPerMin, setCurrentVasopressinUPerMin] = useState<number>(0.0);
  const [methyleneBlueGiven, setMethyleneBlueGiven] = useState<boolean>(false);
  const [angiotensinIiGiven, setAngiotensinIiGiven] = useState<boolean>(false);
  const [refractoryToHighDoseCatecholamines, setRefractoryToHighDoseCatecholamines] = useState<boolean>(true);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleEvaluate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/vasoplegic-shock/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: 1,
          meanArterialPressureMmhg,
          norepinephrineEquivalentMcgKgMin,
          systemicVascularResistanceDynes,
          cardiacIndexLMinM2,
          hoursPostCardiopulmonaryBypass,
          currentVasopressinUPerMin,
          methyleneBlueGiven,
          angiotensinIiGiven,
          refractoryToHighDoseCatecholamines
        })
      });
      if (res.ok) setResult(await res.json());
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#1e293b', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>🩸</span> Phase 134: POST-CARDIOTOMY-VASOPLEGIA (Stepped Non-Adrenergic Rescue Ladder)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>MAP (mmHg)</label>
              <input type="number" value={meanArterialPressureMmhg} onChange={e => setMeanArterialPressureMmhg(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>NE EQUIV (mcg)</label>
              <input type="number" step="0.05" value={norepinephrineEquivalentMcgKgMin} onChange={e => setNorepinephrineEquivalentMcgKgMin(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>SVR (dynes)</label>
              <input type="number" value={systemicVascularResistanceDynes} onChange={e => setSystemicVascularResistanceDynes(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>CI (L/min/m²)</label>
              <input type="number" step="0.1" value={cardiacIndexLMinM2} onChange={e => setCardiacIndexLMinM2(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>HOURS POST-CPB</label>
              <input type="number" value={hoursPostCardiopulmonaryBypass} onChange={e => setHoursPostCardiopulmonaryBypass(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>CURRENT AVP (U/min)</label>
              <input type="number" step="0.01" value={currentVasopressinUPerMin} onChange={e => setCurrentVasopressinUPerMin(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px', fontSize: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f8fafc', cursor: 'pointer' }}>
              <input type="checkbox" checked={methyleneBlueGiven} onChange={e => setMethyleneBlueGiven(e.target.checked)} />
              Methylene Blue Already Administered
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f8fafc', cursor: 'pointer' }}>
              <input type="checkbox" checked={angiotensinIiGiven} onChange={e => setAngiotensinIiGiven(e.target.checked)} />
              Angiotensin II (Giapreza) Active
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f8fafc', cursor: 'pointer' }}>
              <input type="checkbox" checked={refractoryToHighDoseCatecholamines} onChange={e => setRefractoryToHighDoseCatecholamines(e.target.checked)} />
              Refractory to High-Dose Norepinephrine / Epinephrine
            </label>
          </div>

          <button onClick={handleEvaluate} disabled={isLoading} style={{ backgroundColor: '#d97706', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, width: '100%' }}>
            {isLoading ? 'ANALYZING VASOPLEGIA...' : 'EXECUTE NON-ADRENERGIC RESCUE PROTOCOL'}
          </button>
        </div>

        <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #1e293b', fontSize: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#f59e0b' }}>Vasoplegia Rescue Ladder</h4>
          {result ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Severity Tier:</span>
                <span style={{ fontWeight: 'bold', color: result.vasoplegiaSeverityTier === 'EXTREMIS_CATASTROPHIC' ? '#ef4444' : '#f59e0b' }}>
                  {result.vasoplegiaSeverityTier} (Step {result.rescueLadderStep})
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {result.vasopressinIndicated && (
                  <span style={{ backgroundColor: '#065f46', color: '#6ee7b7', padding: '3px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                    STEP 1: VASOPRESSIN 0.03 U/min
                  </span>
                )}
                {result.methyleneBlueIndicated && (
                  <span style={{ backgroundColor: '#1e3a8a', color: '#93c5fd', padding: '3px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                    STEP 2: METHYLENE BLUE 2 mg/kg
                  </span>
                )}
                {result.hydroxocobalaminIndicated && (
                  <span style={{ backgroundColor: '#831843', color: '#fbcfe8', padding: '3px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                    STEP 3: HYDROXOCOBALAMIN 5g
                  </span>
                )}
                {result.angiotensinIiIndicated && (
                  <span style={{ backgroundColor: '#7c2d12', color: '#fed7aa', padding: '3px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                    STEP 4: ANGIOTENSIN II
                  </span>
                )}
              </div>
              {result.shockDirectives.map((d: string, i: number) => (
                <div key={i} style={{ backgroundColor: '#1e293b', padding: '6px', borderRadius: '4px', marginBottom: '4px', color: '#fef3c7', fontSize: '11px' }}>🩸 {d}</div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#64748b' }}>Input SVR, pressor requirement, and CPB time to activate the non-adrenergic ladder.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PHASE 135: CARDIAC-SURGERY-DRAINAGE-TAMPONADE SUB-HUB
// ============================================================================
export const CardiacTamponadeDrainageHub: React.FC = () => {
  const [chestTubeRateMlHr, setChestTubeRateMlHr] = useState<number>(350);
  const [cumulativeDrainage4hMl, setCumulativeDrainage4hMl] = useState<number>(680);
  const [hoursPostop, setHoursPostop] = useState<number>(2);
  const [meanArterialPressureMmhg, setMeanArterialPressureMmhg] = useState<number>(60);
  const [centralVenousPressureMmhg, setCentralVenousPressureMmhg] = useState<number>(16);
  const [pulmonaryArteryDiastolicMmhg, setPulmonaryArteryDiastolicMmhg] = useState<number>(15);
  const [pulsusParadoxusMmhg, setPulsusParadoxusMmhg] = useState<number>(8);
  const [echoRightAtrialCollapse, setEchoRightAtrialCollapse] = useState<boolean>(false);
  const [suddenCessationOfDrainage, setSuddenCessationOfDrainage] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleEvaluate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/cardiac-tamponade/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: 1,
          chestTubeRateMlHr,
          cumulativeDrainage4hMl,
          hoursPostop,
          meanArterialPressureMmhg,
          centralVenousPressureMmhg,
          pulmonaryArteryDiastolicMmhg,
          pulsusParadoxusMmhg,
          echoRightAtrialCollapse,
          suddenCessationOfDrainage
        })
      });
      if (res.ok) setResult(await res.json());
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#1e293b', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>🫀</span> Phase 135: CARDIAC-SURGERY-DRAINAGE-TAMPONADE (Chest Tubes & Resternotomy)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>TUBE RATE (mL/h)</label>
              <input type="number" value={chestTubeRateMlHr} onChange={e => setChestTubeRateMlHr(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>4H TOTAL (mL)</label>
              <input type="number" value={cumulativeDrainage4hMl} onChange={e => setCumulativeDrainage4hMl(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>HOURS POSTOP</label>
              <input type="number" value={hoursPostop} onChange={e => setHoursPostop(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>MAP (mmHg)</label>
              <input type="number" value={meanArterialPressureMmhg} onChange={e => setMeanArterialPressureMmhg(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>CVP (mmHg)</label>
              <input type="number" value={centralVenousPressureMmhg} onChange={e => setCentralVenousPressureMmhg(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>PA DIASTOLIC (mmHg)</label>
              <input type="number" value={pulmonaryArteryDiastolicMmhg} onChange={e => setPulmonaryArteryDiastolicMmhg(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>PULSUS PARADOX (mmHg)</label>
              <input type="number" value={pulsusParadoxusMmhg} onChange={e => setPulsusParadoxusMmhg(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px', fontSize: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f8fafc', cursor: 'pointer' }}>
              <input type="checkbox" checked={suddenCessationOfDrainage} onChange={e => setSuddenCessationOfDrainage(e.target.checked)} />
              Sudden Cessation of Previously Active Chest Tube Drainage
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f8fafc', cursor: 'pointer' }}>
              <input type="checkbox" checked={echoRightAtrialCollapse} onChange={e => setEchoRightAtrialCollapse(e.target.checked)} />
              Echocardiographic Diastolic RA/RV Collapse / Pericardial Hematoma
            </label>
          </div>

          <button onClick={handleEvaluate} disabled={isLoading} style={{ backgroundColor: '#dc2626', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, width: '100%' }}>
            {isLoading ? 'ANALYZING HEMORRHAGE & TAMPONADE...' : 'ARBITRATE RE-EXPLORATION vs OCCULT TAMPONADE'}
          </button>
        </div>

        <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #1e293b', fontSize: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#ef4444' }}>Surgical Hemorrhage & Resternotomy Decision</h4>
          {result ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Re-exploration Indicated:</span>
                <span style={{ fontWeight: 'bold', color: result.surgicalReexplorationIndicated ? '#ef4444' : '#10b981' }}>
                  {result.surgicalReexplorationIndicated ? 'YES - OPERATIVE BLEEDING' : 'NO - CONSERVATIVE MONITOR'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Occult Tamponade:</span>
                <span style={{ fontWeight: 'bold', color: result.occultTamponadeSuspected ? '#ef4444' : '#10b981' }}>
                  {result.occultTamponadeSuspected ? 'SUSPECTED (CLOTTED TUBES)' : 'NOT DETECTED'}
                </span>
              </div>
              {result.emergencyBedsideResternotomyAlert && (
                <div style={{ backgroundColor: '#7f1d1d', color: '#fecaca', padding: '8px', borderRadius: '4px', marginBottom: '8px', fontWeight: 'bold' }}>
                  🚨 EMERGENCY BEDSIDE RESTERNOTOMY ALERT: Diastolic pressure equalization and cardiogenic collapse!
                </div>
              )}
              {result.cardiacSurgicalDirectives.map((d: string, i: number) => (
                <div key={i} style={{ backgroundColor: '#1e293b', padding: '6px', borderRadius: '4px', marginBottom: '4px', color: '#fca5a5', fontSize: '11px' }}>⚠️ {d}</div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#64748b' }}>Monitor chest tube output kinetics and filling pressure equalization.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// SUITE 12 MASTER HUB
// ============================================================================
export const CardiothoracicMcsSuiteHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'p131' | 'p132' | 'p133' | 'p134' | 'p135'>('p131');

  return (
    <div style={{ padding: '20px', backgroundColor: '#0b0f19', color: '#f8fafc', minHeight: '100%', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: '20px', borderBottom: '1px solid #1e293b', paddingBottom: '16px' }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>🫀</span> Suite 12: Cardiothoracic ICU, Mechanical Circulatory Support & ECLS
        </h2>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>
          Impella Microaxial Flow & Purge Sentinel, ECMO Recirculation & Harlequin Syndrome, Ventilator Reverse Triggering Dyssynchrony, Post-Cardiotomy Vasoplegic Shock Ladder, and Mediastinal Hemorrhage / Resternotomy (Phases 131–135).
        </p>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { id: 'p131', label: '🌀 Phase 131: IMPELLA-MICROAXIAL', color: '#06b6d4' },
          { id: 'p132', label: '🫁 Phase 132: ECMO-RECIRCULATION', color: '#ec4899' },
          { id: 'p133', label: '🫁 Phase 133: VENT-ASYNCHRONY', color: '#8b5cf6' },
          { id: 'p134', label: '🩸 Phase 134: POST-CPB-VASOPLEGIA', color: '#f59e0b' },
          { id: 'p135', label: '🫀 Phase 135: TAMPONADE-DRAINAGE', color: '#ef4444' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '10px 16px',
              backgroundColor: activeTab === tab.id ? '#1e293b' : '#0f172a',
              color: activeTab === tab.id ? tab.color : '#94a3b8',
              border: activeTab === tab.id ? `2px solid ${tab.color}` : '1px solid #334155',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontSize: '13px'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'p131' && <ImpellaMicroaxialHub />}
        {activeTab === 'p132' && <EcmoRecirculationHub />}
        {activeTab === 'p133' && <VentilatorAsynchronyHub />}
        {activeTab === 'p134' && <VasoplegicShockRescueHub />}
        {activeTab === 'p135' && <CardiacTamponadeDrainageHub />}
      </div>
    </div>
  );
};

export default CardiothoracicMcsSuiteHub;
