import React, { useState } from 'react';

// ============================================================================
// PHASE 126: DAMAGE-CONTROL-SURGERY SUB-HUB
// ============================================================================
export const DamageControlSurgeryHub: React.FC = () => {
  const [coreTemperatureC, setCoreTemperatureC] = useState<number>(34.4);
  const [arterialPh, setArterialPh] = useState<number>(7.14);
  const [baseDeficitMeqL, setBaseDeficitMeqL] = useState<number>(12.5);
  const [inr, setInr] = useState<number>(1.9);
  const [plateletsK, setPlateletsK] = useState<number>(45);
  const [packedRbcUnitsTransfused, setPackedRbcUnitsTransfused] = useState<number>(10);
  const [estimatedBloodLossMl, setEstimatedBloodLossMl] = useState<number>(3500);
  const [intraAbdominalPressureMmhg, setIntraAbdominalPressureMmhg] = useState<number>(20);
  const [activeAbdominalPacking, setActiveAbdominalPacking] = useState<boolean>(true);
  const [bowelEdemaOrVisceralSwelling, setBowelEdemaOrVisceralSwelling] = useState<boolean>(true);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleEvaluate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/damage-control-surgery/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: 1,
          coreTemperatureC,
          arterialPh,
          baseDeficitMeqL,
          inr,
          plateletsK,
          packedRbcUnitsTransfused,
          estimatedBloodLossMl,
          activeAbdominalPacking,
          bowelEdemaOrVisceralSwelling,
          intraAbdominalPressureMmhg
        })
      });
      if (res.ok) setResult(await res.json());
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#1e293b', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#f43f5e', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>🩹</span> Phase 126: DAMAGE-CONTROL-SURGERY (Lethal Triad & Open Abdomen TAC)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>CORE TEMP (°C)</label>
              <input type="number" step="0.1" value={coreTemperatureC} onChange={e => setCoreTemperatureC(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>ART. pH</label>
              <input type="number" step="0.01" value={arterialPh} onChange={e => setArterialPh(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>BASE DEFICIT</label>
              <input type="number" step="0.5" value={baseDeficitMeqL} onChange={e => setBaseDeficitMeqL(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>INR</label>
              <input type="number" step="0.1" value={inr} onChange={e => setInr(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>PLATELETS (K)</label>
              <input type="number" value={plateletsK} onChange={e => setPlateletsK(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>PRBC UNITS</label>
              <input type="number" value={packedRbcUnitsTransfused} onChange={e => setPackedRbcUnitsTransfused(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>EST. EBL (mL)</label>
              <input type="number" value={estimatedBloodLossMl} onChange={e => setEstimatedBloodLossMl(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>IAP (mmHg)</label>
              <input type="number" value={intraAbdominalPressureMmhg} onChange={e => setIntraAbdominalPressureMmhg(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', marginBottom: '14px', fontSize: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f8fafc', cursor: 'pointer' }}>
              <input type="checkbox" checked={activeAbdominalPacking} onChange={e => setActiveAbdominalPacking(e.target.checked)} />
              Abdominal Packing In Situ
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f8fafc', cursor: 'pointer' }}>
              <input type="checkbox" checked={bowelEdemaOrVisceralSwelling} onChange={e => setBowelEdemaOrVisceralSwelling(e.target.checked)} />
              Severe Visceral/Bowel Edema
            </label>
          </div>

          <button onClick={handleEvaluate} disabled={isLoading} style={{ backgroundColor: '#e11d48', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, width: '100%' }}>
            {isLoading ? 'EVALUATING DCS...' : 'EXECUTE DAMAGE CONTROL ARBITRATION'}
          </button>
        </div>

        <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #1e293b', fontSize: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#f43f5e' }}>Laparotomy & TAC Guidance</h4>
          {result ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Lethal Triad:</span>
                <span style={{ fontWeight: 'bold', color: result.lethalTriadPresent ? '#f43f5e' : '#10b981' }}>
                  {result.lethalTriadPresent ? 'PRESENT (Lethal Hypothermia/Acidosis/Coagulopathy)' : 'NOT DETECTED'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Exhaustion Tier:</span>
                <span style={{ fontWeight: 'bold', color: '#fbbf24' }}>{result.physiologicalExhaustionTier}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Open Abdomen:</span>
                <span style={{ fontWeight: 'bold', color: result.openAbdomenIndicated ? '#f43f5e' : '#10b981' }}>
                  {result.openAbdomenIndicated ? 'MANDATED (Leave Open)' : 'PRIMARY CLOSURE ALLOWED'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>TAC Technique:</span>
                <span style={{ fontWeight: 'bold', color: '#38bdf8' }}>{result.tacTechnique}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Planned ICU Resus:</span>
                <span style={{ fontWeight: 'bold', color: '#a78bfa' }}>{result.plannedIcuResuscitationHrs} Hours Before Take-back</span>
              </div>
              {result.surgicalDirectives.map((d: string, i: number) => (
                <div key={i} style={{ backgroundColor: '#1e293b', padding: '6px', borderRadius: '4px', marginBottom: '4px', color: '#fecdd3', fontSize: '11px' }}>⚠️ {d}</div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#64748b' }}>Configure trauma vitals and laboratory markers to evaluate lethal triad.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PHASE 127: REBOA-TRAUMA-HEMODYNAMICS SUB-HUB
// ============================================================================
export const ReboaTraumaHub: React.FC = () => {
  const [hemorrhageAnatomy, setHemorrhageAnatomy] = useState<'SUBDIAPHRAGMATIC_ABDOMINAL' | 'PELVIC_FRACTURE_OR_GROIN' | 'THORACIC_SUSPECTED'>('SUBDIAPHRAGMATIC_ABDOMINAL');
  const [systolicBpMmhg, setSystolicBpMmhg] = useState<number>(62);
  const [elapsedOcclusionMinutes, setElapsedOcclusionMinutes] = useState<number>(18);
  const [isPartialReboa, setIsPartialReboa] = useState<boolean>(false);
  const [balloonVolumeMl, setBalloonVolumeMl] = useState<number>(16);
  const [proximalMapMmhg, setProximalMapMmhg] = useState<number>(75);
  const [distalPulsePalpable, setDistalPulsePalpable] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleEvaluate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/reboa-trauma/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: 1,
          hemorrhageAnatomy,
          systolicBpMmhg,
          occlusionStartTime: new Date().toISOString(),
          elapsedOcclusionMinutes,
          isPartialReboa,
          balloonVolumeMl,
          proximalMapMmhg,
          distalPulsePalpable
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
        <span>🎈</span> Phase 127: REBOA-TRAUMA-HEMODYNAMICS (Zone 1/3 Occlusion & pREBOA)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ marginBottom: '12px', fontSize: '12px' }}>
            <label style={{ display: 'block', color: '#94a3b8', marginBottom: '4px' }}>HEMORRHAGE SOURCE / ANATOMY</label>
            <select
              value={hemorrhageAnatomy}
              onChange={e => setHemorrhageAnatomy(e.target.value as any)}
              style={{ width: '100%', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }}
            >
              <option value="SUBDIAPHRAGMATIC_ABDOMINAL">Subdiaphragmatic Torso / Severe Abdominal Hemorrhage (Zone 1)</option>
              <option value="PELVIC_FRACTURE_OR_GROIN">Pelvic Fracture / Junctional Inguinal Hemorrhage (Zone 3)</option>
              <option value="THORACIC_SUSPECTED">Suspected Thoracic Aortic Disruption / Tamponade (Contraindicated)</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>SYS BP (mmHg)</label>
              <input type="number" value={systolicBpMmhg} onChange={e => setSystolicBpMmhg(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>ELAPSED (min)</label>
              <input type="number" value={elapsedOcclusionMinutes} onChange={e => setElapsedOcclusionMinutes(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>BALLOON (mL)</label>
              <input type="number" value={balloonVolumeMl} onChange={e => setBalloonVolumeMl(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>PROX MAP (mmHg)</label>
              <input type="number" value={proximalMapMmhg} onChange={e => setProximalMapMmhg(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', marginBottom: '14px', fontSize: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f8fafc', cursor: 'pointer' }}>
              <input type="checkbox" checked={isPartialReboa} onChange={e => setIsPartialReboa(e.target.checked)} />
              Partial REBOA (pREBOA Titration)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f8fafc', cursor: 'pointer' }}>
              <input type="checkbox" checked={distalPulsePalpable} onChange={e => setDistalPulsePalpable(e.target.checked)} />
              Distal Femoral Pulse Palpable
            </label>
          </div>

          <button onClick={handleEvaluate} disabled={isLoading} style={{ backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, width: '100%' }}>
            {isLoading ? 'EVALUATING AORTIC OCCLUSION...' : 'CALCULATE ISCHEMIA TIME BUDGET & PROTOCOL'}
          </button>
        </div>

        <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #1e293b', fontSize: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#38bdf8' }}>Occlusion Hemodynamics</h4>
          {result ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Aortic Zone:</span>
                <span style={{ fontWeight: 'bold', color: result.aorticZone === 'CONTRAINDICATED' ? '#ef4444' : '#38bdf8' }}>{result.aorticZone}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Max Safe Ischemia:</span>
                <span style={{ fontWeight: 'bold', color: '#fbbf24' }}>{result.maxIschemiaDurationMin} Minutes</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Safe Window Remaining:</span>
                <span style={{ fontWeight: 'bold', color: result.remainingSafeTimeMin <= 5 ? '#ef4444' : '#10b981' }}>
                  {result.remainingSafeTimeMin} Minutes Left
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Risk Tier:</span>
                <span style={{ fontWeight: 'bold', color: result.ischemiaRiskTier === 'CRITICAL_ISCHEMIA_EXCEEDED' ? '#ef4444' : '#38bdf8' }}>
                  {result.ischemiaRiskTier}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Reperfusion Shock Risk:</span>
                <span style={{ fontWeight: 'bold', color: result.reperfusionShockRisk === 'IMMINENT_LETHAL_WASHOUT' ? '#ef4444' : '#10b981' }}>
                  {result.reperfusionShockRisk}
                </span>
              </div>
              {result.reboaDirectives.map((d: string, i: number) => (
                <div key={i} style={{ backgroundColor: '#1e293b', padding: '6px', borderRadius: '4px', marginBottom: '4px', color: '#bae6fd', fontSize: '11px' }}>⏱️ {d}</div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#64748b' }}>Configure balloon volume and occlusion duration to assess ischemia.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PHASE 128: SUBCLINICAL-MICROCIRCULATION-NIRS SUB-HUB
// ============================================================================
export const MicrocirculationNirsHub: React.FC = () => {
  const [macroMapMmhg, setMacroMapMmhg] = useState<number>(75);
  const [sto2Percentage, setSto2Percentage] = useState<number>(60);
  const [mfiScore, setMfiScore] = useState<number>(1.9);
  const [ppvPercentage, setPpvPercentage] = useState<number>(64);
  const [perfusedVesselDensityMm2, setPerfusedVesselDensityMm2] = useState<number>(7.8);
  const [norepinephrineDoseMcgKgMin, setNorepinephrineDoseMcgKgMin] = useState<number>(0.42);
  const [hematocritPct, setHematocritPct] = useState<number>(31);
  const [cvpMmhg, setCvpMmhg] = useState<number>(11);
  const [fluidBalance24hLiters, setFluidBalance24hLiters] = useState<number>(2.0);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleEvaluate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/microcirculation-nirs/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: 1,
          macroMapMmhg,
          sto2Percentage,
          mfiScore,
          ppvPercentage,
          perfusedVesselDensityMm2,
          norepinephrineDoseMcgKgMin,
          hematocritPct,
          cvpMmhg,
          fluidBalance24hLiters
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
        <span>🔬</span> Phase 128: SUBCLINICAL-MICROCIRCULATION-NIRS (Ince Decoupling Sentinel)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>MACRO MAP (mmHg)</label>
              <input type="number" value={macroMapMmhg} onChange={e => setMacroMapMmhg(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>StO2 (%)</label>
              <input type="number" value={sto2Percentage} onChange={e => setSto2Percentage(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>MFI SCORE (0-3)</label>
              <input type="number" step="0.1" value={mfiScore} onChange={e => setMfiScore(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>PPV (%)</label>
              <input type="number" value={ppvPercentage} onChange={e => setPpvPercentage(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>PVD (mm/mm²)</label>
              <input type="number" step="0.1" value={perfusedVesselDensityMm2} onChange={e => setPerfusedVesselDensityMm2(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>NOREPI (mcg/kg/m)</label>
              <input type="number" step="0.05" value={norepinephrineDoseMcgKgMin} onChange={e => setNorepinephrineDoseMcgKgMin(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>HEMATOCRIT (%)</label>
              <input type="number" value={hematocritPct} onChange={e => setHematocritPct(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>CVP (mmHg)</label>
              <input type="number" value={cvpMmhg} onChange={e => setCvpMmhg(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>FLUID BAL (L/24h)</label>
              <input type="number" step="0.5" value={fluidBalance24hLiters} onChange={e => setFluidBalance24hLiters(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <button onClick={handleEvaluate} disabled={isLoading} style={{ backgroundColor: '#059669', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, width: '100%' }}>
            {isLoading ? 'ANALYZING COHERENCE...' : 'EVALUATE HEMODYNAMIC COHERENCE (INCE CLASSIFICATION)'}
          </button>
        </div>

        <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #1e293b', fontSize: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#10b981' }}>Microcirculatory Perfusion Status</h4>
          {result ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Hemodynamic Coherence:</span>
                <span style={{ fontWeight: 'bold', color: result.hemodynamicCoherenceLoss === 'COHERENT' ? '#10b981' : '#f59e0b' }}>
                  {result.hemodynamicCoherenceLoss}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Cellular Shock State:</span>
                <span style={{ fontWeight: 'bold', color: result.microcirculatoryShockState === 'NORMAL_PERFUSED' ? '#10b981' : '#ef4444' }}>
                  {result.microcirculatoryShockState}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Fluid Resuscitation Caution:</span>
                <span style={{ fontWeight: 'bold', color: result.fluidResponsiveCaution ? '#ef4444' : '#10b981' }}>
                  {result.fluidResponsiveCaution ? 'CAUTION: STOP CRYSTALLOID DROWNING' : 'SAFE FOR VOLUME'}
                </span>
              </div>
              <div style={{ backgroundColor: '#1e293b', padding: '8px', borderRadius: '4px', marginBottom: '8px', color: '#6ee7b7' }}>
                {result.resuscitationGuidance}
              </div>
              {result.clinicalDirectives.map((d: string, i: number) => (
                <div key={i} style={{ backgroundColor: '#1e293b', padding: '6px', borderRadius: '4px', marginBottom: '4px', color: '#a7f3d0', fontSize: '11px' }}>🔬 {d}</div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#64748b' }}>Enter NIRS StO2 and sublingual MFI indices to detect hidden microvascular shock.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PHASE 129: TRANSPLANT-DONOR-OPTIMIZATION SUB-HUB
// ============================================================================
export const TransplantDonorMgmtHub: React.FC = () => {
  const [meanArterialPressureMmhg, setMeanArterialPressureMmhg] = useState<number>(74);
  const [systolicBpMmhg, setSystolicBpMmhg] = useState<number>(115);
  const [cvpMmhg, setCvpMmhg] = useState<number>(8);
  const [urineOutputMlKgHr, setUrineOutputMlKgHr] = useState<number>(2.0);
  const [serumSodiumMeqL, setSerumSodiumMeqL] = useState<number>(144);
  const [bloodGlucoseMgDl, setBloodGlucoseMgDl] = useState<number>(138);
  const [pao2Fio2Ratio, setPao2Fio2Ratio] = useState<number>(340);
  const [vasopressorCount, setVasopressorCount] = useState<number>(1);
  const [coreTemperatureC, setCoreTemperatureC] = useState<number>(36.8);
  const [tripleHormoneTherapyActive, setTripleHormoneTherapyActive] = useState<boolean>(true);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleEvaluate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/transplant-donor-mgmt/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: 1,
          meanArterialPressureMmhg,
          systolicBpMmhg,
          cvpMmhg,
          urineOutputMlKgHr,
          serumSodiumMeqL,
          bloodGlucoseMgDl,
          pao2Fio2Ratio,
          vasopressorCount,
          tripleHormoneTherapyActive,
          coreTemperatureC
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
        <span>🫀</span> Phase 129: TRANSPLANT-DONOR-OPTIMIZATION (OPTN/UNOS DMG Bundle)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>MAP (mmHg)</label>
              <input type="number" value={meanArterialPressureMmhg} onChange={e => setMeanArterialPressureMmhg(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>CVP (mmHg)</label>
              <input type="number" value={cvpMmhg} onChange={e => setCvpMmhg(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>UO (mL/kg/h)</label>
              <input type="number" step="0.1" value={urineOutputMlKgHr} onChange={e => setUrineOutputMlKgHr(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>SODIUM (mEq)</label>
              <input type="number" value={serumSodiumMeqL} onChange={e => setSerumSodiumMeqL(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>GLUCOSE (mg)</label>
              <input type="number" value={bloodGlucoseMgDl} onChange={e => setBloodGlucoseMgDl(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>PaO2/FiO2</label>
              <input type="number" value={pao2Fio2Ratio} onChange={e => setPao2Fio2Ratio(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>PRESSORS (#)</label>
              <input type="number" value={vasopressorCount} onChange={e => setVasopressorCount(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>TEMP (°C)</label>
              <input type="number" step="0.1" value={coreTemperatureC} onChange={e => setCoreTemperatureC(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ marginBottom: '14px', fontSize: '12px', display: 'flex', gap: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f8fafc', cursor: 'pointer' }}>
              <input type="checkbox" checked={tripleHormoneTherapyActive} onChange={e => setTripleHormoneTherapyActive(e.target.checked)} />
              Triple Hormone Therapy Active (Methylprednisolone + T4 + Insulin)
            </label>
            <input type="hidden" value={systolicBpMmhg} onChange={e => setSystolicBpMmhg(Number(e.target.value))} />
          </div>

          <button onClick={handleEvaluate} disabled={isLoading} style={{ backgroundColor: '#9333ea', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, width: '100%' }}>
            {isLoading ? 'OPTIMIZING ALLOGRAFTS...' : 'EVALUATE DONOR MANAGEMENT GOALS (DMGs)'}
          </button>
        </div>

        <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #1e293b', fontSize: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#a855f7' }}>OPTN/UNOS DMG Compliance</h4>
          {result ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>DMG Goals Met:</span>
                <span style={{ fontWeight: 'bold', color: result.donorMgmtGoalsMet >= 7 ? '#10b981' : '#f59e0b' }}>
                  {result.donorMgmtGoalsMet} / {result.totalDmgTargets} Targets ({result.optnBundleComplianceTier})
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Diabetes Insipidus:</span>
                <span style={{ fontWeight: 'bold', color: result.diabetesInsipidusActive ? '#ef4444' : '#10b981' }}>
                  {result.diabetesInsipidusActive ? 'ACTIVE (DDAVP + Vasopressin Needed)' : 'CONTROLLED'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px', marginBottom: '8px' }}>
                {result.checklist.map((item: any, i: number) => (
                  <div key={i} style={{ backgroundColor: '#1e293b', padding: '4px 6px', borderRadius: '4px', fontSize: '10px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#cbd5e1' }}>{item.target.split(' ')[0]}:</span>
                    <span style={{ color: item.achieved ? '#34d399' : '#f87171', fontWeight: 600 }}>{item.value}</span>
                  </div>
                ))}
              </div>
              {result.organProcurementDirectives.map((d: string, i: number) => (
                <div key={i} style={{ backgroundColor: '#1e293b', padding: '6px', borderRadius: '4px', marginBottom: '4px', color: '#e9d5ff', fontSize: '11px' }}>🫀 {d}</div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#64748b' }}>Assess hemodynamics, hormone replacement, and lung protective targets for brain death donor.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PHASE 130: ANAPHYLAXIS-PERIOPERATIVE-MAST-CELL SUB-HUB
// ============================================================================
export const AnaphylaxisMastCellHub: React.FC = () => {
  const [suspectedTrigger, setSuspectedTrigger] = useState<string>('Rocuronium bromide');
  const [systolicBpMmhg, setSystolicBpMmhg] = useState<number>(60);
  const [heartRateBpm, setHeartRateBpm] = useState<number>(132);
  const [cutaneousSignsPresent, setCutaneousSignsPresent] = useState<boolean>(true);
  const [bronchospasmOrStridor, setBronchospasmOrStridor] = useState<boolean>(true);
  const [cardiacArrestPresent, setCardiacArrestPresent] = useState<boolean>(false);
  const [patientOnBetaBlocker, setPatientOnBetaBlocker] = useState<boolean>(true);
  const [epinephrineDosesGivenCount, setEpinephrineDosesGivenCount] = useState<number>(3);
  const [totalEpinephrineMgGiven, setTotalEpinephrineMgGiven] = useState<number>(0.3);
  const [shockPersistsAfterEpinephrine, setShockPersistsAfterEpinephrine] = useState<boolean>(true);
  const [measuredTryptaseUgL, setMeasuredTryptaseUgL] = useState<number>(26.5);
  const [baselineTryptaseUgL, setBaselineTryptaseUgL] = useState<number>(5.4);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleEvaluate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/anaphylaxis-mast-cell/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: 1,
          suspectedTrigger,
          cutaneousSignsPresent,
          systolicBpMmhg,
          heartRateBpm,
          bronchospasmOrStridor,
          cardiacArrestPresent,
          patientOnBetaBlocker,
          epinephrineDosesGivenCount,
          totalEpinephrineMgGiven,
          shockPersistsAfterEpinephrine,
          measuredTryptaseUgL,
          baselineTryptaseUgL
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
        <span>⚡</span> Phase 130: ANAPHYLAXIS-PERIOPERATIVE-MAST-CELL (Ring & Messmer Grading & Tryptase)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ marginBottom: '12px', fontSize: '12px' }}>
            <label style={{ display: 'block', color: '#94a3b8', marginBottom: '4px' }}>SUSPECTED TRIGGER / PERIOPERATIVE DRUG</label>
            <input
              type="text"
              value={suspectedTrigger}
              onChange={e => setSuspectedTrigger(e.target.value)}
              placeholder="e.g. Rocuronium, Cefazolin, Chlorhexidine, Latex"
              style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>SYS BP (mmHg)</label>
              <input type="number" value={systolicBpMmhg} onChange={e => setSystolicBpMmhg(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>HEART RATE (bpm)</label>
              <input type="number" value={heartRateBpm} onChange={e => setHeartRateBpm(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>EPI DOSES (#)</label>
              <input type="number" value={epinephrineDosesGivenCount} onChange={e => setEpinephrineDosesGivenCount(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>TOTAL EPI (mg)</label>
              <input type="number" step="0.1" value={totalEpinephrineMgGiven} onChange={e => setTotalEpinephrineMgGiven(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>PEAK TRYPTASE (µg/L)</label>
              <input type="number" step="0.1" value={measuredTryptaseUgL} onChange={e => setMeasuredTryptaseUgL(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>BASELINE TRYPTASE (µg/L)</label>
              <input type="number" step="0.1" value={baselineTryptaseUgL} onChange={e => setBaselineTryptaseUgL(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '14px', fontSize: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f8fafc', cursor: 'pointer' }}>
              <input type="checkbox" checked={cutaneousSignsPresent} onChange={e => setCutaneousSignsPresent(e.target.checked)} />
              Cutaneous Flushing / Urticaria
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f8fafc', cursor: 'pointer' }}>
              <input type="checkbox" checked={bronchospasmOrStridor} onChange={e => setBronchospasmOrStridor(e.target.checked)} />
              Severe Bronchospasm / Stridor
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f8fafc', cursor: 'pointer' }}>
              <input type="checkbox" checked={patientOnBetaBlocker} onChange={e => setPatientOnBetaBlocker(e.target.checked)} />
              Chronic Beta-Blocker Therapy
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f8fafc', cursor: 'pointer' }}>
              <input type="checkbox" checked={shockPersistsAfterEpinephrine} onChange={e => setShockPersistsAfterEpinephrine(e.target.checked)} />
              Refractory to Repeated Epinephrine
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f8fafc', cursor: 'pointer' }}>
              <input type="checkbox" checked={cardiacArrestPresent} onChange={e => setCardiacArrestPresent(e.target.checked)} />
              Cardiac Arrest / PEA Collapse
            </label>
          </div>

          <button onClick={handleEvaluate} disabled={isLoading} style={{ backgroundColor: '#d97706', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, width: '100%' }}>
            {isLoading ? 'ANALYZING REACTION...' : 'EVALUATE ANAPHYLAXIS SEVERITY & RESCUE PROTOCOL'}
          </button>
        </div>

        <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #1e293b', fontSize: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#f59e0b' }}>Anaphylaxis Shock Guidance</h4>
          {result ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Ring & Messmer Grade:</span>
                <span style={{ fontWeight: 'bold', color: result.ringMessmerGrade === 'Grade IV' ? '#ef4444' : '#f59e0b' }}>
                  {result.ringMessmerGrade}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Refractory Shock:</span>
                <span style={{ fontWeight: 'bold', color: result.refractoryShock ? '#ef4444' : '#10b981' }}>
                  {result.refractoryShock ? 'CRITICAL REFRACTORY STATE' : 'RESPONSIVE'}
                </span>
              </div>
              <div style={{ backgroundColor: '#1e293b', padding: '8px', borderRadius: '4px', marginBottom: '8px', color: '#fde68a' }}>
                ⚡ {result.firstLineEpinephrineRecommendation}
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {result.glucagonIndicated && (
                  <span style={{ backgroundColor: '#7c2d12', color: '#fdba74', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                    GLUCAGON RESCUE
                  </span>
                )}
                {result.methyleneBlueIndicated && (
                  <span style={{ backgroundColor: '#1e3a8a', color: '#93c5fd', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                    METHYLENE BLUE VASOPLEGIA
                  </span>
                )}
                {result.sugammadexIndicated && (
                  <span style={{ backgroundColor: '#14532d', color: '#86efac', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                    SUGAMMADEX 16 mg/kg ENCAPSULATION
                  </span>
                )}
              </div>
              {result.anaphylaxisDirectives.map((d: string, i: number) => (
                <div key={i} style={{ backgroundColor: '#1e293b', padding: '6px', borderRadius: '4px', marginBottom: '4px', color: '#fed7aa', fontSize: '11px' }}>⚠️ {d}</div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#64748b' }}>Classify perioperative allergic reactions and calculate targeted adrenaline and antidote regimens.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// SUITE 11 MASTER HUB
// ============================================================================
export const TraumaMicrovascularSuiteHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'p126' | 'p127' | 'p128' | 'p129' | 'p130'>('p126');

  return (
    <div style={{ padding: '20px', backgroundColor: '#0b0f19', color: '#f8fafc', minHeight: '100%', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: '20px', borderBottom: '1px solid #1e293b', paddingBottom: '16px' }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>🩹</span> Suite 11: Complex Surgical Critical Care, Trauma & Microvascular Monitoring
        </h2>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>
          Damage Control Laparotomy Lethal Triad & TAC, REBOA Aortic Occlusion, Subclinical Microcirculation NIRS (Ince Types 1-4), Transplant Donor Optimization (OPTN/UNOS), and Refractory Perioperative Anaphylaxis (Phases 126–130).
        </p>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { id: 'p126', label: '🩹 Phase 126: DAMAGE-CONTROL-SURGERY', color: '#f43f5e' },
          { id: 'p127', label: '🎈 Phase 127: REBOA-TRAUMA', color: '#38bdf8' },
          { id: 'p128', label: '🔬 Phase 128: MICROCIRCULATION-NIRS', color: '#10b981' },
          { id: 'p129', label: '🫀 Phase 129: TRANSPLANT-DONOR', color: '#a855f7' },
          { id: 'p130', label: '⚡ Phase 130: ANAPHYLAXIS-MAST-CELL', color: '#f59e0b' }
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
        {activeTab === 'p126' && <DamageControlSurgeryHub />}
        {activeTab === 'p127' && <ReboaTraumaHub />}
        {activeTab === 'p128' && <MicrocirculationNirsHub />}
        {activeTab === 'p129' && <TransplantDonorMgmtHub />}
        {activeTab === 'p130' && <AnaphylaxisMastCellHub />}
      </div>
    </div>
  );
};

export default TraumaMicrovascularSuiteHub;
