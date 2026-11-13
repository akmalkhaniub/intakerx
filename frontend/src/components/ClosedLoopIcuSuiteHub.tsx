import React, { useState } from 'react';

// ============================================================================
// PHASE 111: CLOSED-LOOP-TITRATION SUB-HUB
// ============================================================================
export const ClosedLoopTitrationHub: React.FC = () => {
  const [currentMapMmhg, setCurrentMapMmhg] = useState<number>(54);
  const [previousMapMmhg, setPreviousMapMmhg] = useState<number>(58);
  const [currentNorepiRateMcgKgMin, setCurrentNorepiRateMcgKgMin] = useState<number>(0.28);
  const [currentPropofolRateMcgKgMin, setCurrentPropofolRateMcgKgMin] = useState<number>(85);
  const [propofolInfusionHours, setPropofolInfusionHours] = useState<number>(50);
  const [lactateMmolL, setLactateMmolL] = useState<number>(4.5);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleEvaluate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/closed-loop-titration/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: 1,
          currentMapMmhg,
          previousMapMmhg,
          targetMapMmhg: 65,
          integralErrorMap: 20,
          currentNorepiRateMcgKgMin,
          vasopressinActive: false,
          currentRass: -2,
          targetRass: -1,
          currentPropofolRateMcgKgMin,
          propofolInfusionHours,
          lactateMmolL,
          triglyceridesMgDl: 520
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
        <span>🎛️</span> Phase 111: CLOSED-LOOP-TITRATION (PID Vasopressor & PRIS Watchdog)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>CURRENT MAP (mmHg)</label>
              <input type="number" value={currentMapMmhg} onChange={e => setCurrentMapMmhg(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>PREVIOUS MAP (mmHg)</label>
              <input type="number" value={previousMapMmhg} onChange={e => setPreviousMapMmhg(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>NOREPI (mcg/kg/min)</label>
              <input type="number" step="0.01" value={currentNorepiRateMcgKgMin} onChange={e => setCurrentNorepiRateMcgKgMin(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>PROPOFOL (mcg/kg/min)</label>
              <input type="number" value={currentPropofolRateMcgKgMin} onChange={e => setCurrentPropofolRateMcgKgMin(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>INFUSION HOURS</label>
              <input type="number" value={propofolInfusionHours} onChange={e => setPropofolInfusionHours(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>LACTATE (mmol/L)</label>
              <input type="number" step="0.1" value={lactateMmolL} onChange={e => setLactateMmolL(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <button onClick={handleEvaluate} disabled={isLoading} style={{ backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, width: '100%' }}>
            {isLoading ? 'COMPUTING PID STEP...' : 'RUN CLOSED-LOOP PID & PRIS SAFETY STEP'}
          </button>
        </div>

        <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #1e293b', fontSize: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#38bdf8' }}>Controller Output & Guardrails</h4>
          {result ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Controller Status:</span>
                <span style={{ fontWeight: 'bold', color: result.prisRiskFlagged ? '#ef4444' : '#10b981' }}>{result.controllerStatus}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Recommended Norepi:</span>
                <span style={{ fontWeight: 'bold', color: '#38bdf8' }}>{result.recommendedNorepiRateMcgKgMin} mcg/kg/min ({result.norepiDeltaMcgKgMin >= 0 ? '+' : ''}{result.norepiDeltaMcgKgMin})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Recommended Propofol:</span>
                <span style={{ fontWeight: 'bold', color: result.prisRiskFlagged ? '#ef4444' : '#f8fafc' }}>{result.recommendedPropofolRateMcgKgMin} mcg/kg/min</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Vasopressin 0.03 U/min:</span>
                <span style={{ fontWeight: 'bold', color: result.vasopressinRecommended ? '#fbbf24' : '#94a3b8' }}>{result.vasopressinRecommended ? 'INITIATE ADJUNCT' : 'NOT INDICATED'}</span>
              </div>
              {result.clinicalDirectives.map((d: string, i: number) => (
                <div key={i} style={{ backgroundColor: '#1e293b', padding: '6px', borderRadius: '4px', marginBottom: '4px', color: '#e2e8f0' }}>• {d}</div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#64748b' }}>Awaiting closed-loop step.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PHASE 112: BAYESIAN-PK-PD SUB-HUB
// ============================================================================
export const BayesianPkPdHub: React.FC = () => {
  const [drugName, setDrugName] = useState<string>('VANCOMYCIN');
  const [ageYears, setAgeYears] = useState<number>(28);
  const [weightKg, setWeightKg] = useState<number>(80);
  const [serumCreatinineMgDl, setSerumCreatinineMgDl] = useState<number>(0.6);
  const [pathogenMicMgL, setPathogenMicMgL] = useState<number>(1.0);
  const [sepsisThirdSpacing, setSepsisThirdSpacing] = useState<boolean>(true);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleEvaluate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/bayesian-pkpd/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: 1,
          drugName,
          ageYears,
          sex: 'M',
          weightKg,
          serumCreatinineMgDl,
          sepsisThirdSpacing,
          pathogenMicMgL
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
        <span>💊</span> Phase 112: BAYESIAN-PK-PD (Precision AUC24/MIC & ARC Dosing)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>ANTIMICROBIAL</label>
              <select value={drugName} onChange={e => setDrugName(e.target.value)} style={{ width: '100%', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }}>
                <option value="VANCOMYCIN">Vancomycin (AUC24/MIC Target)</option>
                <option value="MEROPENEM">Meropenem (100% fT&gt;MIC)</option>
                <option value="PIPERACILLIN_TAZOBACTAM">Piperacillin-Tazobactam</option>
                <option value="GENTAMICIN">Gentamicin (Hartford Nomogram)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>PATHOGEN MIC (mg/L)</label>
              <input type="number" step="0.5" value={pathogenMicMgL} onChange={e => setPathogenMicMgL(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>AGE (YRS)</label>
              <input type="number" value={ageYears} onChange={e => setAgeYears(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>WEIGHT (kg)</label>
              <input type="number" value={weightKg} onChange={e => setWeightKg(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>SERUM Cr (mg/dL)</label>
              <input type="number" step="0.1" value={serumCreatinineMgDl} onChange={e => setSerumCreatinineMgDl(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ marginBottom: '14px', fontSize: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f8fafc', cursor: 'pointer' }}>
              <input type="checkbox" checked={sepsisThirdSpacing} onChange={e => setSepsisThirdSpacing(e.target.checked)} />
              Sepsis Capillary Leak / Expanded Vd (0.85 L/kg)
            </label>
          </div>

          <button onClick={handleEvaluate} disabled={isLoading} style={{ backgroundColor: '#059669', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, width: '100%' }}>
            {isLoading ? 'COMPUTING PK/PD...' : 'OPTIMIZE BAYESIAN ANTIMICROBIAL REGIMEN'}
          </button>
        </div>

        <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #1e293b', fontSize: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#10b981' }}>Pharmacokinetic Profile</h4>
          {result ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>CrCl / ARC Status:</span>
                <span style={{ fontWeight: 'bold', color: result.arcDetected ? '#fbbf24' : '#f8fafc' }}>
                  {result.estimatedCrClMlMin} mL/min {result.arcDetected ? '(ARC DETECTED)' : ''}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Predicted AUC24 / MIC:</span>
                <span style={{ fontWeight: 'bold', color: '#38bdf8' }}>{result.predictedAuc24} mg·h/L (Ratio: {result.targetAucMicRatio})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Nephrotoxicity Risk:</span>
                <span style={{ fontWeight: 'bold', color: result.nephrotoxicityRisk === 'HIGH' ? '#ef4444' : '#10b981' }}>{result.nephrotoxicityRisk}</span>
              </div>
              <div style={{ backgroundColor: '#022c22', border: '1px solid #065f46', padding: '8px', borderRadius: '4px', color: '#6ee7b7', marginBottom: '8px' }}>
                <strong>Regimen:</strong> {result.recommendedRegimen}
              </div>
              {result.clinicalAlerts.map((a: string, i: number) => (
                <div key={i} style={{ color: '#fca5a5', fontSize: '11px' }}>⚠️ {a}</div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#64748b' }}>Awaiting PK/PD parameters.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PHASE 113: SEPSIS-SUBPHENOTYPE SUB-HUB
// ============================================================================
export const SepsisSubphenotypeHub: React.FC = () => {
  const [lactateMmolL, setLactateMmolL] = useState<number>(4.8);
  const [pao2Fio2Ratio, setPao2Fio2Ratio] = useState<number>(175);
  const [plateletsK, setPlateletsK] = useState<number>(72);
  const [vasopressorActive, setVasopressorActive] = useState<boolean>(true);
  const [antibioticsGiven, setAntibioticsGiven] = useState<boolean>(false);
  const [minutesSinceTimeZero, setMinutesSinceTimeZero] = useState<number>(65);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleEvaluate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/sepsis-subphenotype/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: 1,
          ageYears: 66,
          heartRate: 128,
          systolicBp: 84,
          mapMmhg: 58,
          respiratoryRate: 26,
          spo2Pct: 92,
          supplementalO2: true,
          tempCelsius: 38.9,
          gcsScore: 13,
          pao2Fio2Ratio,
          plateletsK,
          bilirubinMgDl: 2.3,
          creatinineMgDl: 2.2,
          lactateMmolL,
          vasopressorActive,
          minutesSinceTimeZero,
          lactateDrawn: true,
          culturesDrawn: true,
          antibioticsGiven,
          fluidBolusStarted: true
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
        <span>🧬</span> Phase 113: SEPSIS-SUBPHENOTYPE (Seymour α/β/γ/δ & 1-Hour Bundle)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>LACTATE (mmol/L)</label>
              <input type="number" step="0.1" value={lactateMmolL} onChange={e => setLactateMmolL(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>PaO2 / FiO2 RATIO</label>
              <input type="number" value={pao2Fio2Ratio} onChange={e => setPao2Fio2Ratio(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>PLATELETS (K/uL)</label>
              <input type="number" value={plateletsK} onChange={e => setPlateletsK(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>MINUTES SINCE TIME-ZERO</label>
              <input type="number" value={minutesSinceTimeZero} onChange={e => setMinutesSinceTimeZero(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', fontSize: '12px', marginBottom: '14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f8fafc', cursor: 'pointer' }}>
              <input type="checkbox" checked={vasopressorActive} onChange={e => setVasopressorActive(e.target.checked)} />
              Vasopressor Active
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f8fafc', cursor: 'pointer' }}>
              <input type="checkbox" checked={antibioticsGiven} onChange={e => setAntibioticsGiven(e.target.checked)} />
              Broad-Spectrum Abx Given
            </label>
          </div>

          <button onClick={handleEvaluate} disabled={isLoading} style={{ backgroundColor: '#d97706', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, width: '100%' }}>
            {isLoading ? 'CLASSIFYING PHENOTYPE...' : 'CLASSIFY SEPSIS SUBPHENOTYPE & BUNDLE'}
          </button>
        </div>

        <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #1e293b', fontSize: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#fbbf24' }}>Host-Response Stratification</h4>
          {result ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Subphenotype:</span>
                <span style={{ fontWeight: 'bold', color: '#ef4444' }}>{result.subphenotype}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>SOFA / qSOFA / NEWS2:</span>
                <span style={{ fontWeight: 'bold', color: '#f8fafc' }}>{result.sofaScore} / {result.qsofaScore} / {result.news2Score}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8' }}>1-Hour Bundle Status:</span>
                <span style={{ fontWeight: 'bold', color: result.bundle1hCompliant ? '#10b981' : '#ef4444' }}>
                  {result.bundle1hCompliant ? 'COMPLIANT' : `OVERDUE (${result.missingBundleItems.join(', ')})`}
                </span>
              </div>
              <div style={{ color: '#cbd5e1', fontSize: '11px', marginBottom: '4px' }}>
                <strong>Steroids:</strong> {result.immunomodulationPlan.corticosteroidDirective}
              </div>
              <div style={{ color: '#cbd5e1', fontSize: '11px' }}>
                <strong>Fluids:</strong> {result.immunomodulationPlan.fluidStrategy}
              </div>
            </div>
          ) : (
            <div style={{ color: '#64748b' }}>Awaiting sepsis clinical parameters.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PHASE 114: POCUS-VEXUS-SHOCK SUB-HUB
// ============================================================================
export const PocusVexusHub: React.FC = () => {
  const [ivcDiameterCm, setIvcDiameterCm] = useState<number>(2.4);
  const [hepaticVeinPattern, setHepaticVeinPattern] = useState<string>('SEVERE_S_REVERSAL');
  const [portalVmaxCmS, setPortalVmaxCmS] = useState<number>(30);
  const [portalVminCmS, setPortalVminCmS] = useState<number>(10);
  const [intrarenalVeinPattern, setIntrarenalVeinPattern] = useState<string>('MONOPHASIC_DIASTOLIC');
  const [lvEjectionFractionPct, setLvEjectionFractionPct] = useState<number>(25);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleEvaluate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/pocus-vexus/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: 1,
          ivcDiameterCm,
          ivcCollapsibilityPct: 10,
          hepaticVeinPattern,
          portalVmaxCmS,
          portalVminCmS,
          intrarenalVeinPattern,
          lvEjectionFractionPct,
          rvDilatedMcConnell: false,
          pericardialEffusionWithCollapse: false,
          lungSlidingPresent: true,
          bilateralBLinesPresent: true
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
        <span>🩺</span> Phase 114: POCUS-VEXUS-SHOCK (Venous Excess & RUSH Classifier)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>IVC DIAMETER (cm)</label>
              <input type="number" step="0.1" value={ivcDiameterCm} onChange={e => setIvcDiameterCm(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>PORTAL Vmax / Vmin</label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <input type="number" value={portalVmaxCmS} onChange={e => setPortalVmaxCmS(Number(e.target.value))} style={{ width: '50%', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
                <input type="number" value={portalVminCmS} onChange={e => setPortalVminCmS(Number(e.target.value))} style={{ width: '50%', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>LV EF (%)</label>
              <input type="number" value={lvEjectionFractionPct} onChange={e => setLvEjectionFractionPct(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>HEPATIC VEIN DOPPLER</label>
              <select value={hepaticVeinPattern} onChange={e => setHepaticVeinPattern(e.target.value)} style={{ width: '100%', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }}>
                <option value="NORMAL_S_GT_D">Normal (S &gt; D)</option>
                <option value="MILD_S_LT_D">Mildly Abnormal (S &lt; D)</option>
                <option value="SEVERE_S_REVERSAL">Severe (Systolic Reversal)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>INTRARENAL VEIN DOPPLER</label>
              <select value={intrarenalVeinPattern} onChange={e => setIntrarenalVeinPattern(e.target.value)} style={{ width: '100%', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }}>
                <option value="CONTINUOUS">Continuous (Normal)</option>
                <option value="BIPHASIC">Biphasic (Mildly Abnormal)</option>
                <option value="MONOPHASIC_DIASTOLIC">Monophasic Diastolic (Severe)</option>
              </select>
            </div>
          </div>

          <button onClick={handleEvaluate} disabled={isLoading} style={{ backgroundColor: '#db2777', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, width: '100%' }}>
            {isLoading ? 'GRADING VEXUS...' : 'COMPUTE VExUS CONGESTION GRADE & RUSH PHENOTYPE'}
          </button>
        </div>

        <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #1e293b', fontSize: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#ec4899' }}>Ultrasound Hemodynamic Synthesis</h4>
          {result ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>VExUS Grade:</span>
                <span style={{ fontWeight: 'bold', color: result.vexusGrade >= 2 ? '#ef4444' : '#10b981' }}>GRADE {result.vexusGrade} / 3 (Portal PI: {result.portalPulsatilityPct}%)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>RUSH Shock Phenotype:</span>
                <span style={{ fontWeight: 'bold', color: '#38bdf8' }}>{result.shockPhenotype}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Fluid Tolerance:</span>
                <span style={{ fontWeight: 'bold', color: result.fluidToleranceStatus.includes('INTOLERANT') ? '#ef4444' : '#10b981' }}>{result.fluidToleranceStatus}</span>
              </div>
              {result.clinicalDirectives.map((d: string, i: number) => (
                <div key={i} style={{ backgroundColor: '#1e293b', padding: '6px', borderRadius: '4px', marginBottom: '4px', color: '#fca5a5' }}>⚠️ {d}</div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#64748b' }}>Awaiting POCUS measurements.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PHASE 115: HANDOFF-HALLUCINATION-GUARD SUB-HUB
// ============================================================================
export const HandoffGuardHub: React.FC = () => {
  const [handoffCodeStatus, setHandoffCodeStatus] = useState<string>('FULL_CODE');
  const [norepiUnit, setNorepiUnit] = useState<string>('mg/min');
  const [reportedMapMmhg, setReportedMapMmhg] = useState<number>(82);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleVerify = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/handoff-guard/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: 1,
          canonicalRecord: {
            codeStatus: 'DNR_DNI',
            allergies: ['Penicillin', 'Sulfa'],
            activeMedications: [{ name: 'Norepinephrine', dose: '10', unit: 'mcg/min', route: 'IV' }],
            pendingCriticalLabs: ['Troponin 4h repeat'],
            latestMapMmhg: 64
          },
          proposedHandoff: {
            codeStatus: handoffCodeStatus,
            allergies: ['Penicillin', 'Sulfa'],
            activeMedications: [{ name: 'Norepinephrine', dose: '10', unit: norepiUnit, route: 'IV' }],
            pendingCriticalLabs: ['Troponin 4h repeat'],
            reportedMapMmhg,
            contingencyPlan: 'If MAP < 65 mmHg, call ICU attending and uptitrate Norepinephrine.'
          }
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
        <span>🛡️</span> Phase 115: HANDOFF-HALLUCINATION-GUARD (Zero-Tolerance Sign-Out Auditor)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px', backgroundColor: '#0f172a', padding: '8px', borderRadius: '4px' }}>
            <strong>Canonical Ground Truth:</strong> DNR_DNI | Allergies: Penicillin, Sulfa | Norepinephrine 10 mcg/min IV | Latest MAP: 64 mmHg
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>HANDOFF CODE STATUS</label>
              <select value={handoffCodeStatus} onChange={e => setHandoffCodeStatus(e.target.value)} style={{ width: '100%', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }}>
                <option value="DNR_DNI">DNR_DNI (Matches)</option>
                <option value="FULL_CODE">FULL_CODE (Mismatch)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>NOREPI UNIT</label>
              <select value={norepiUnit} onChange={e => setNorepiUnit(e.target.value)} style={{ width: '100%', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }}>
                <option value="mcg/min">mcg/min (Matches)</option>
                <option value="mg/min">mg/min (1000x Error)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>REPORTED MAP (mmHg)</label>
              <input type="number" value={reportedMapMmhg} onChange={e => setReportedMapMmhg(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <button onClick={handleVerify} disabled={isLoading} style={{ backgroundColor: '#9333ea', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, width: '100%' }}>
            {isLoading ? 'AUDITING SIGN-OUT...' : 'RUN ZERO-TOLERANCE HANDOFF VERIFICATION'}
          </button>
        </div>

        <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #1e293b', fontSize: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#a855f7' }}>Sign-Out Integrity Audit</h4>
          {result ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Verification Status:</span>
                <span style={{ fontWeight: 'bold', color: result.safeToSignOut ? '#10b981' : '#ef4444' }}>{result.verificationStatus}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Safety Integrity Score:</span>
                <span style={{ fontWeight: 'bold', color: '#38bdf8' }}>{result.safetyIntegrityScore} / 100</span>
              </div>
              {result.discrepancies.map((d: any, i: number) => (
                <div key={i} style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d', padding: '6px', borderRadius: '4px', marginBottom: '4px', color: '#fca5a5', fontSize: '11px' }}>
                  <strong>[{d.severity}] {d.category}:</strong> {d.rationale}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#64748b' }}>Awaiting handoff verification.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// SUITE 8 MASTER HUB
// ============================================================================
export const ClosedLoopIcuSuiteHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'p111' | 'p112' | 'p113' | 'p114' | 'p115'>('p111');

  return (
    <div style={{ padding: '20px', backgroundColor: '#0b0f19', color: '#f8fafc', minHeight: '100%', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: '20px', borderBottom: '1px solid #1e293b', paddingBottom: '16px' }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>🤖</span> Suite 8: Autonomous Closed-Loop ICU & Precision Therapeutics
        </h2>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>
          Closed-loop PID titration, Bayesian PK/PD antimicrobial dosing, Sepsis subphenotyping, POCUS VExUS shock grading, and zero-tolerance handoff auditing (Phases 111–115).
        </p>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { id: 'p111', label: '🎛️ Phase 111: CLOSED-LOOP-TITRATION', color: '#38bdf8' },
          { id: 'p112', label: '💊 Phase 112: BAYESIAN-PK-PD', color: '#10b981' },
          { id: 'p113', label: '🧬 Phase 113: SEPSIS-SUBPHENOTYPE', color: '#fbbf24' },
          { id: 'p114', label: '🩺 Phase 114: POCUS-VEXUS-SHOCK', color: '#ec4899' },
          { id: 'p115', label: '🛡️ Phase 115: HANDOFF-GUARD', color: '#a855f7' }
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
        {activeTab === 'p111' && <ClosedLoopTitrationHub />}
        {activeTab === 'p112' && <BayesianPkPdHub />}
        {activeTab === 'p113' && <SepsisSubphenotypeHub />}
        {activeTab === 'p114' && <PocusVexusHub />}
        {activeTab === 'p115' && <HandoffGuardHub />}
      </div>
    </div>
  );
};
export default ClosedLoopIcuSuiteHub;
