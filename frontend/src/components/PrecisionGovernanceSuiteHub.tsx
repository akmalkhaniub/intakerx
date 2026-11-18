import React, { useState } from 'react';

// ============================================================================
// PHASE 116: DIGITAL-TWIN-VENT SUB-HUB
// ============================================================================
export const VentDigitalTwinHub: React.FC = () => {
  const [tidalVolumeMl, setTidalVolumeMl] = useState<number>(450);
  const [respiratoryRate, setRespiratoryRate] = useState<number>(26);
  const [setPeepCmH2O, setSetPeepCmH2O] = useState<number>(14);
  const [plateauPressureCmH2O, setPlateauPressureCmH2O] = useState<number>(33);
  const [peakPressureCmH2O, setPeakPressureCmH2O] = useState<number>(40);
  const [pao2Mmhg, setPao2Mmhg] = useState<number>(74);
  const [fio2, setFio2] = useState<number>(0.8);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleEvaluate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/vent-digital-twin/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: 1,
          sex: 'F',
          heightCm: 165,
          tidalVolumeMl,
          respiratoryRate,
          setPeepCmH2O,
          autoPeepCmH2O: 1.5,
          plateauPressureCmH2O,
          peakPressureCmH2O,
          fio2,
          pao2Mmhg,
          arterialPh: 7.22
        })
      });
      if (res.ok) setResult(await res.json());
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#1e293b', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>🫁</span> Phase 116: DIGITAL-TWIN-VENT (Mechanical Power & Driving Pressure)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>TIDAL VOL (mL)</label>
              <input type="number" value={tidalVolumeMl} onChange={e => setTidalVolumeMl(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>RESP RATE (bpm)</label>
              <input type="number" value={respiratoryRate} onChange={e => setRespiratoryRate(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>SET PEEP (cmH2O)</label>
              <input type="number" value={setPeepCmH2O} onChange={e => setSetPeepCmH2O(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>Pplat</label>
              <input type="number" value={plateauPressureCmH2O} onChange={e => setPlateauPressureCmH2O(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>Ppeak</label>
              <input type="number" value={peakPressureCmH2O} onChange={e => setPeakPressureCmH2O(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>PaO2 (mmHg)</label>
              <input type="number" value={pao2Mmhg} onChange={e => setPao2Mmhg(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>FiO2 (0.21-1)</label>
              <input type="number" step="0.05" value={fio2} onChange={e => setFio2(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <button onClick={handleEvaluate} disabled={isLoading} style={{ backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, width: '100%' }}>
            {isLoading ? 'SIMULATING VENT TWIN...' : 'SIMULATE PULMONARY MECHANICS & MECHANICAL POWER'}
          </button>
        </div>

        <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #1e293b', fontSize: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#38bdf8' }}>Digital Twin Output</h4>
          {result ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Safety Tier:</span>
                <span style={{ fontWeight: 'bold', color: result.ventSafetyTier.includes('CRITICAL') ? '#ef4444' : '#10b981' }}>{result.ventSafetyTier}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Driving Pressure (ΔP):</span>
                <span style={{ fontWeight: 'bold', color: result.drivingPressureCmH2O >= 15 ? '#ef4444' : '#38bdf8' }}>{result.drivingPressureCmH2O} cmH2O (Target &lt;15)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Mechanical Power:</span>
                <span style={{ fontWeight: 'bold', color: result.mechanicalPowerJMin > 17 ? '#ef4444' : '#f8fafc' }}>{result.mechanicalPowerJMin} J/min (Limit 17)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8' }}>P/F Ratio / Prone:</span>
                <span style={{ fontWeight: 'bold', color: result.pronePositioningIndicated ? '#fbbf24' : '#94a3b8' }}>{result.pao2Fio2Ratio} {result.pronePositioningIndicated ? '(PRONE INDICATED)' : ''}</span>
              </div>
              {result.digitalTwinRecommendations.map((r: string, i: number) => (
                <div key={i} style={{ backgroundColor: '#1e293b', padding: '6px', borderRadius: '4px', marginBottom: '4px', color: '#fca5a5', fontSize: '11px' }}>⚠️ {r}</div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#64748b' }}>Awaiting ventilator mechanics.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PHASE 117: ELECTROLYTE-OSMOLALITY SUB-HUB
// ============================================================================
export const ElectrolyteOsmolalityHub: React.FC = () => {
  const [measuredSodiumMeqL, setMeasuredSodiumMeqL] = useState<number>(126);
  const [previousSodium24hAgoMeqL, setPreviousSodium24hAgoMeqL] = useState<number>(115);
  const [bicarbonateMeqL, setBicarbonateMeqL] = useState<number>(12);
  const [albuminGDl, setAlbuminGDl] = useState<number>(2.0);
  const [paco2Mmhg, setPaco2Mmhg] = useState<number>(38);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleEvaluate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/electrolyte-osmolality/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: 1,
          weightKg: 70,
          sex: 'M',
          measuredSodiumMeqL,
          previousSodium24hAgoMeqL,
          potassiumMeqL: 3.1,
          chlorideMeqL: 92,
          bicarbonateMeqL,
          albuminGDl,
          glucoseMgDl: 110,
          bunMgDl: 14,
          measuredOsmolalityMOsmKg: 310,
          arterialPh: 7.20,
          paco2Mmhg,
          highOdsRiskFactors: true
        })
      });
      if (res.ok) setResult(await res.json());
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#1e293b', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>🧪</span> Phase 117: ELECTROLYTE-OSMOLALITY (ODS Guard & Winter's Solver)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>CURRENT Na+ (mEq/L)</label>
              <input type="number" value={measuredSodiumMeqL} onChange={e => setMeasuredSodiumMeqL(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>Na+ 24H AGO (mEq/L)</label>
              <input type="number" value={previousSodium24hAgoMeqL} onChange={e => setPreviousSodium24hAgoMeqL(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>HCO3- (mEq/L)</label>
              <input type="number" value={bicarbonateMeqL} onChange={e => setBicarbonateMeqL(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>ALBUMIN (g/dL)</label>
              <input type="number" step="0.1" value={albuminGDl} onChange={e => setAlbuminGDl(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>PaCO2 (mmHg)</label>
              <input type="number" value={paco2Mmhg} onChange={e => setPaco2Mmhg(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <button onClick={handleEvaluate} disabled={isLoading} style={{ backgroundColor: '#059669', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, width: '100%' }}>
            {isLoading ? 'SOLVING ACID-BASE...' : 'RUN DYSNATREMIA ODS GUARD & ACID-BASE SOLVER'}
          </button>
        </div>

        <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #1e293b', fontSize: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#10b981' }}>Chemistry & Acid-Base Arbitration</h4>
          {result ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>ODS Overcorrection Risk:</span>
                <span style={{ fontWeight: 'bold', color: result.odsOvercorrectionRisk ? '#ef4444' : '#10b981' }}>
                  {result.odsOvercorrectionRisk ? `CRITICAL (+${result.deltaSodium24h} mEq/L)` : 'SAFE'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Corrected AG / Osm Gap:</span>
                <span style={{ fontWeight: 'bold', color: '#38bdf8' }}>{result.correctedAnionGap} / {result.osmolarGap} mOsm/kg</span>
              </div>
              <div style={{ marginBottom: '8px', color: '#fbbf24', fontWeight: 600 }}>
                {result.acidBaseDiagnosis}
              </div>
              {result.clinicalDirectives.map((d: string, i: number) => (
                <div key={i} style={{ backgroundColor: '#1e293b', padding: '6px', borderRadius: '4px', marginBottom: '4px', color: '#fca5a5', fontSize: '11px' }}>⚠️ {d}</div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#64748b' }}>Awaiting chemistry panel.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PHASE 118: CARDIO-ARRHYTHMIA-EP SUB-HUB
// ============================================================================
export const ArrhythmiaEpHub: React.FC = () => {
  const [heartRate, setHeartRate] = useState<number>(54);
  const [rawQtMs, setRawQtMs] = useState<number>(510);
  const [wpwPreExcitation, setWpwPreExcitation] = useState<boolean>(true);
  const [structuralCad, setStructuralCad] = useState<boolean>(true);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleEvaluate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/arrhythmia-ep/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: 1,
          ageYears: 72,
          sex: 'F',
          heartRate,
          rawQtMs,
          qrsDurationMs: 92,
          serumPotassiumMeqL: 3.2,
          serumMagnesiumMgDl: 1.5,
          onLoopDiuretic: true,
          acuteMiOrSepsis: false,
          heartFailureEfLt40: true,
          structuralCad,
          wpwPreExcitation,
          activeQtProlongingDrugs: ['Amiodarone', 'Ondansetron']
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
        <span>⚡</span> Phase 118: CARDIO-ARRHYTHMIA-EP (Fridericia QTc & Vaughan-Williams Guard)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>HEART RATE (bpm)</label>
              <input type="number" value={heartRate} onChange={e => setHeartRate(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>RAW QT INTERVAL (ms)</label>
              <input type="number" value={rawQtMs} onChange={e => setRawQtMs(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', fontSize: '12px', marginBottom: '14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f8fafc', cursor: 'pointer' }}>
              <input type="checkbox" checked={wpwPreExcitation} onChange={e => setWpwPreExcitation(e.target.checked)} />
              WPW Pre-Excitation
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f8fafc', cursor: 'pointer' }}>
              <input type="checkbox" checked={structuralCad} onChange={e => setStructuralCad(e.target.checked)} />
              Structural CAD / Scar
            </label>
          </div>

          <button onClick={handleEvaluate} disabled={isLoading} style={{ backgroundColor: '#db2777', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, width: '100%' }}>
            {isLoading ? 'EVALUATING EP RISK...' : 'RUN TISDALE QTc & ANTIARRHYTHMIC SAFETY CHECK'}
          </button>
        </div>

        <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #1e293b', fontSize: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#ec4899' }}>Electrophysiology Guardrail</h4>
          {result ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Fridericia QTc / Bazett:</span>
                <span style={{ fontWeight: 'bold', color: '#38bdf8' }}>{result.qtcFridericiaMs} ms / {result.qtcBazettMs} ms</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Tisdale Score / TdP Risk:</span>
                <span style={{ fontWeight: 'bold', color: result.tdpStormRisk.includes('CRITICAL') ? '#ef4444' : '#fbbf24' }}>
                  {result.tisdaleRiskScore} ({result.tdpStormRisk})
                </span>
              </div>
              <div style={{ marginBottom: '8px', color: '#fca5a5', fontSize: '11px' }}>
                <strong>Strictly Contraindicated:</strong> {result.contraindicatedDrugs.join(', ')}
              </div>
            </div>
          ) : (
            <div style={{ color: '#64748b' }}>Awaiting ECG parameters.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PHASE 119: ETHICS-TRIAGE-ALLOC SUB-HUB
// ============================================================================
export const ScarceEthicsHub: React.FC = () => {
  const [sofaScore, setSofaScore] = useState<number>(11);
  const [comorbidityPrognosis, setComorbidityPrognosis] = useState<string>('FIVE_YEAR_LIFE_LIMITING');
  const [crisisSurgeLevel, setCrisisSurgeLevel] = useState<number>(2);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleEvaluate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/scarce-ethics/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: 1,
          scarceResourceType: 'MECHANICAL_VENTILATOR',
          sofaScore,
          comorbidityPrognosis,
          isEssentialResponder: false,
          crisisSurgeLevel,
          hoursOnTrialAlready: 24,
          sofaDeltaSinceAdmission: 0
        })
      });
      if (res.ok) setResult(await res.json());
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#1e293b', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>⚖️</span> Phase 119: ETHICS-TRIAGE-ALLOC (Crisis Standards of Care)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>SOFA SCORE (0-24)</label>
              <input type="number" value={sofaScore} onChange={e => setSofaScore(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>PROGNOSIS</label>
              <select value={comorbidityPrognosis} onChange={e => setComorbidityPrognosis(e.target.value)} style={{ width: '100%', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }}>
                <option value="NONE">None (+0)</option>
                <option value="FIVE_YEAR_LIFE_LIMITING">5-Year Limiting (+2)</option>
                <option value="ONE_YEAR_SEVERE_LIMITING">1-Year Limiting (+4)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>SURGE LEVEL (1-3)</label>
              <input type="number" min={1} max={3} value={crisisSurgeLevel} onChange={e => setCrisisSurgeLevel(Number(e.target.value) as 1 | 2 | 3)} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <button onClick={handleEvaluate} disabled={isLoading} style={{ backgroundColor: '#d97706', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, width: '100%' }}>
            {isLoading ? 'COMPUTING CSC ALLOCATION...' : 'COMPUTE MULTI-PRINCIPLE CSC PRIORITY SCORE'}
          </button>
        </div>

        <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #1e293b', fontSize: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#fbbf24' }}>Allocation & Time-Limited Trial</h4>
          {result ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Priority Score / Tier:</span>
                <span style={{ fontWeight: 'bold', color: '#38bdf8' }}>{result.allocationPriorityScore}/8 ({result.priorityTier})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Time-Limited Trial Window:</span>
                <span style={{ fontWeight: 'bold', color: '#10b981' }}>{result.timeLimitedTrialHours} Hours</span>
              </div>
              <div style={{ color: '#cbd5e1', fontSize: '11px' }}>
                <strong>Palliative Guard:</strong> {result.palliativeSymptomBundle.dyspneaPain}
              </div>
            </div>
          ) : (
            <div style={{ color: '#64748b' }}>Awaiting allocation inputs.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PHASE 120: FEDERATED-PRIVACY-AUDIT SUB-HUB
// ============================================================================
export const FederatedPrivacyHub: React.FC = () => {
  const [clinicalTextPayload, setClinicalTextPayload] = useState<string>('Patient MRN-884120 SSN 123-45-6789 DOB 1930-04-12 email alice@clinic.org');
  const [epsilonRequested, setEpsilonRequested] = useState<number>(0.5);
  const [patientAge, setPatientAge] = useState<number>(92);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleAudit = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/federated-privacy/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: 'SEPSIS-SUBPHENOTYPE-V4',
          clinicalTextPayload,
          patientAge,
          aggregateMetricValue: 0.86,
          sensitivityDeltaF: 0.05,
          epsilonRequested,
          previousEpsilonSpent: 1.5,
          maxEpsilonBudget: 5.0,
          expectedBinDist: [0.5, 0.3, 0.2],
          actualBinDist: [0.2, 0.35, 0.45]
        })
      });
      if (res.ok) setResult(await res.json());
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#1e293b', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#a855f7', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>🔐</span> Phase 120: FEDERATED-PRIVACY-AUDIT (HIPAA Safe Harbor, DP & PSI Drift)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ marginBottom: '10px', fontSize: '12px' }}>
            <label style={{ display: 'block', color: '#94a3b8', marginBottom: '4px' }}>RAW CLINICAL TELEMETRY PAYLOAD</label>
            <textarea rows={2} value={clinicalTextPayload} onChange={e => setClinicalTextPayload(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>EPSILON REQUESTED (ε)</label>
              <input type="number" step="0.1" value={epsilonRequested} onChange={e => setEpsilonRequested(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>PATIENT AGE (YRS)</label>
              <input type="number" value={patientAge} onChange={e => setPatientAge(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <button onClick={handleAudit} disabled={isLoading} style={{ backgroundColor: '#9333ea', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, width: '100%' }}>
            {isLoading ? 'AUDITING PRIVACY & DRIFT...' : 'RUN HIPAA SAFE HARBOR, DP & PSI DRIFT AUDIT'}
          </button>
        </div>

        <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #1e293b', fontSize: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#a855f7' }}>Governance & Privacy Output</h4>
          {result ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Governance Status:</span>
                <span style={{ fontWeight: 'bold', color: result.governanceStatus === 'COMPLIANT_ACTIVE' ? '#10b981' : '#ef4444' }}>{result.governanceStatus}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>PHI Scrubbed / Age:</span>
                <span style={{ fontWeight: 'bold', color: '#38bdf8' }}>{result.phiLeakCount} items / {result.ageGeneralized}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8' }}>PSI Drift / ε Spent:</span>
                <span style={{ fontWeight: 'bold', color: result.psiDriftScore >= 0.25 ? '#ef4444' : '#10b981' }}>{result.psiDriftScore} / {result.epsilonSpentTotal}</span>
              </div>
              <div style={{ backgroundColor: '#1e293b', padding: '6px', borderRadius: '4px', color: '#6ee7b7', fontSize: '11px' }}>
                <strong>Scrubbed Text:</strong> {result.redactedPayload}
              </div>
            </div>
          ) : (
            <div style={{ color: '#64748b' }}>Awaiting governance audit.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// SUITE 9 MASTER HUB
// ============================================================================
export const PrecisionGovernanceSuiteHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'p116' | 'p117' | 'p118' | 'p119' | 'p120'>('p116');

  return (
    <div style={{ padding: '20px', backgroundColor: '#0b0f19', color: '#f8fafc', minHeight: '100%', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: '20px', borderBottom: '1px solid #1e293b', paddingBottom: '16px' }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>⚖️</span> Suite 9: Digital Twin, EP, Acid-Base, CSC Ethics & AI Governance
        </h2>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>
          Ventilator Mechanical Power Digital Twin, Dysnatremia ODS Guard, Fridericia EP Safety, Crisis Standards of Care Ethics, and HIPAA/DP AI Auditing (Phases 116–120).
        </p>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { id: 'p116', label: '🫁 Phase 116: DIGITAL-TWIN-VENT', color: '#38bdf8' },
          { id: 'p117', label: '🧪 Phase 117: ELECTROLYTE-OSMOLALITY', color: '#10b981' },
          { id: 'p118', label: '⚡ Phase 118: CARDIO-ARRHYTHMIA-EP', color: '#ec4899' },
          { id: 'p119', label: '⚖️ Phase 119: ETHICS-TRIAGE-ALLOC', color: '#fbbf24' },
          { id: 'p120', label: '🔐 Phase 120: FEDERATED-PRIVACY', color: '#a855f7' }
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
        {activeTab === 'p116' && <VentDigitalTwinHub />}
        {activeTab === 'p117' && <ElectrolyteOsmolalityHub />}
        {activeTab === 'p118' && <ArrhythmiaEpHub />}
        {activeTab === 'p119' && <ScarceEthicsHub />}
        {activeTab === 'p120' && <FederatedPrivacyHub />}
      </div>
    </div>
  );
};
export default PrecisionGovernanceSuiteHub;
