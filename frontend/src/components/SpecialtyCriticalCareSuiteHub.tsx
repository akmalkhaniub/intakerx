import React, { useState } from 'react';

// ============================================================================
// PHASE 121: TMA-HEMATOLOGY-GUARD SUB-HUB
// ============================================================================
export const TmaHematologyHub: React.FC = () => {
  const [plateletsK, setPlateletsK] = useState<number>(16);
  const [inr, setInr] = useState<number>(1.1);
  const [creatinineMgDl, setCreatinineMgDl] = useState<number>(1.4);
  const [fibrinogenMgDl, setFibrinogenMgDl] = useState<number>(310);
  const [hemolysisPresent, setHemolysisPresent] = useState<boolean>(true);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleEvaluate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/tma-hematology/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: 1,
          plateletsK,
          hemolysisPresent,
          activeCancer: false,
          solidOrganOrStemCellTransplant: false,
          mcvFl: 86,
          inr,
          creatinineMgDl,
          ptProlongationSec: inr >= 1.5 ? 6.5 : 1.0,
          fibrinogenMgDl,
          dDimerElevation: inr >= 1.5 ? 'SEVERE' : 'MODERATE'
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
        <span>🩸</span> Phase 121: TMA-HEMATOLOGY-GUARD (PLASMIC Score vs ISTH DIC)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>PLATELETS (K)</label>
              <input type="number" value={plateletsK} onChange={e => setPlateletsK(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>INR</label>
              <input type="number" step="0.1" value={inr} onChange={e => setInr(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>CREATININE</label>
              <input type="number" step="0.1" value={creatinineMgDl} onChange={e => setCreatinineMgDl(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>FIBRINOGEN</label>
              <input type="number" value={fibrinogenMgDl} onChange={e => setFibrinogenMgDl(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ marginBottom: '14px', fontSize: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f8fafc', cursor: 'pointer' }}>
              <input type="checkbox" checked={hemolysisPresent} onChange={e => setHemolysisPresent(e.target.checked)} />
              Microangiopathic Hemolysis Present (Schistocytes / Undetectable Haptoglobin)
            </label>
          </div>

          <button onClick={handleEvaluate} disabled={isLoading} style={{ backgroundColor: '#dc2626', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, width: '100%' }}>
            {isLoading ? 'EVALUATING TMA...' : 'ARBITRATE TTP (PLASMIC) vs DIC (ISTH) vs aHUS'}
          </button>
        </div>

        <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #1e293b', fontSize: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#ef4444' }}>TMA Arbitration</h4>
          {result ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Primary Syndrome:</span>
                <span style={{ fontWeight: 'bold', color: '#fbbf24' }}>{result.primaryTmaSyndrome}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>PLASMIC / ISTH DIC:</span>
                <span style={{ fontWeight: 'bold', color: '#38bdf8' }}>{result.plasmicScore}/7 ({result.plasmicRiskTier}) | DIC {result.isthDicScore}/8</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Platelet Transfusion:</span>
                <span style={{ fontWeight: 'bold', color: result.plateletTransfusionProhibited ? '#ef4444' : '#10b981' }}>
                  {result.plateletTransfusionProhibited ? 'STRICTLY PROHIBITED (TTP)' : 'ALLOWED IF INDICATED'}
                </span>
              </div>
              {result.hematologyDirectives.map((d: string, i: number) => (
                <div key={i} style={{ backgroundColor: '#1e293b', padding: '6px', borderRadius: '4px', marginBottom: '4px', color: '#fca5a5', fontSize: '11px' }}>⚠️ {d}</div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#64748b' }}>Awaiting hematology labs.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PHASE 122: GERIATRIC-DELIRIUM-BEERS SUB-HUB
// ============================================================================
export const GeriatricDeliriumHub: React.FC = () => {
  const [ageYears, setAgeYears] = useState<number>(78);
  const [rassScore, setRassScore] = useState<number>(2);
  const [medsCsv, setMedsCsv] = useState<string>('Diphenhydramine, Lorazepam, Oxybutynin');
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleEvaluate = async () => {
    setIsLoading(true);
    try {
      const activeMedications = medsCsv.split(',').map(s => s.trim()).filter(Boolean);
      const res = await fetch('/api/clinician/geriatric-delirium/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: 1,
          ageYears,
          rassScore,
          acuteOnsetOrFluctuating: true,
          inattentionPresent: true,
          disorganizedThinking: true,
          activeMedications
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
        <span>🧠</span> Phase 122: GERIATRIC-DELIRIUM-BEERS (CAM-ICU, ACB & AGS Beers)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>AGE (YRS)</label>
              <input type="number" value={ageYears} onChange={e => setAgeYears(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>RASS (-5 to +4)</label>
              <input type="number" min={-5} max={4} value={rassScore} onChange={e => setRassScore(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ marginBottom: '14px', fontSize: '12px' }}>
            <label style={{ display: 'block', color: '#94a3b8', marginBottom: '4px' }}>ACTIVE MEDICATIONS (COMMA SEPARATED)</label>
            <input type="text" value={medsCsv} onChange={e => setMedsCsv(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
          </div>

          <button onClick={handleEvaluate} disabled={isLoading} style={{ backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, width: '100%' }}>
            {isLoading ? 'AUDITING BEERS & ACB...' : 'RUN CAM-ICU, ACB & BEERS DEPRESCRIBING AUDIT'}
          </button>
        </div>

        <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #1e293b', fontSize: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#38bdf8' }}>Delirium & Deprescribing Output</h4>
          {result ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>CAM-ICU / Risk Tier:</span>
                <span style={{ fontWeight: 'bold', color: result.camIcuPositive ? '#ef4444' : '#10b981' }}>
                  {result.camIcuPositive ? 'POSITIVE' : 'NEGATIVE'} ({result.deliriumRiskTier})
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8' }}>ACB Score / Beers Flags:</span>
                <span style={{ fontWeight: 'bold', color: '#fbbf24' }}>{result.acbTotalScore} / {result.beersViolationCount} violations</span>
              </div>
              {result.beersViolations.map((v: any, i: number) => (
                <div key={i} style={{ backgroundColor: '#1e293b', padding: '6px', borderRadius: '4px', marginBottom: '4px', fontSize: '11px', color: '#e2e8f0' }}>
                  <strong>{v.medication} (ACB {v.acbWeight}):</strong> Switch to {v.saferAlternative}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#64748b' }}>Awaiting geriatric medication list.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PHASE 123: ENVENOMATION-TOX-ANTIVENOM SUB-HUB
// ============================================================================
export const EnvenomationAntivenomHub: React.FC = () => {
  const [venomClass, setVenomClass] = useState<string>('CROTALIDAE_PIT_VIPER');
  const [preferredAntivenom, setPreferredAntivenom] = useState<string>('CROFAB');
  const [fibrinogenMgDl, setFibrinogenMgDl] = useState<number>(85);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleEvaluate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/envenomation-antivenom/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: 1,
          venomClass,
          preferredAntivenom,
          leadingEdgeAdvancing: true,
          fibrinogenMgDl,
          plateletsK: 48,
          inr: 1.7,
          systolicBp: 86,
          ptosisOrBulbarWeakness: venomClass === 'ELAPID_CORAL_COBRA',
          nifCmH2O: venomClass === 'ELAPID_CORAL_COBRA' ? -14 : -40
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
        <span>🐍</span> Phase 123: ENVENOMATION-TOX-ANTIVENOM (CroFab / Anavip / Elapid)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>VENOM CLASS</label>
              <select value={venomClass} onChange={e => setVenomClass(e.target.value)} style={{ width: '100%', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }}>
                <option value="CROTALIDAE_PIT_VIPER">Crotalidae (Pit Viper)</option>
                <option value="ELAPID_CORAL_COBRA">Elapid (Coral / Cobra)</option>
                <option value="SCORPION_CENTRUROIDES">Centruroides Scorpion</option>
                <option value="MARINE_STONEFISH_BOX_JELLY">Marine (Box Jelly / Stonefish)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>ANTIVENOM</label>
              <select value={preferredAntivenom} onChange={e => setPreferredAntivenom(e.target.value)} style={{ width: '100%', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }}>
                <option value="CROFAB">CroFab (Fab)</option>
                <option value="ANAVIP">Anavip (F(ab')2)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>FIBRINOGEN</label>
              <input type="number" value={fibrinogenMgDl} onChange={e => setFibrinogenMgDl(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <button onClick={handleEvaluate} disabled={isLoading} style={{ backgroundColor: '#059669', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, width: '100%' }}>
            {isLoading ? 'CALCULATING ANTIVENOM...' : 'COMPUTE ANTIVENOM VIAL DOSE & SAFETY GUARDRAILS'}
          </button>
        </div>

        <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #1e293b', fontSize: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#10b981' }}>Antivenom Protocol</h4>
          {result ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Severity Grade:</span>
                <span style={{ fontWeight: 'bold', color: '#ef4444' }}>{result.severityGrade}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Initial Load:</span>
                <span style={{ fontWeight: 'bold', color: '#38bdf8' }}>{result.initialVials} Vials — {result.recommendedAntivenom}</span>
              </div>
              {result.clinicalDirectives.map((d: string, i: number) => (
                <div key={i} style={{ backgroundColor: '#1e293b', padding: '6px', borderRadius: '4px', marginBottom: '4px', color: '#6ee7b7', fontSize: '11px' }}>• {d}</div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#64748b' }}>Awaiting envenomation details.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PHASE 124: TROPICAL-MALARIA-DENGUE SUB-HUB
// ============================================================================
export const TropicalCriticalCareHub: React.FC = () => {
  const [syndrome, setSyndrome] = useState<string>('FALCIPARUM_MALARIA');
  const [weightKg, setWeightKg] = useState<number>(70);
  const [parasitemiaPct, setParasitemiaPct] = useState<number>(8.5);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleEvaluate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/tropical-critical-care/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: 1,
          syndrome,
          weightKg,
          parasitemiaPct,
          gcsScore: syndrome === 'FALCIPARUM_MALARIA' ? 10 : 15,
          lactateMmolL: 5.5,
          glucoseMgDl: 38,
          hemoglobinGDl: 6.8,
          bilirubinMgDl: 3.8,
          creatinineMgDl: 1.9,
          systolicBp: 92,
          diastolicBp: 76,
          hematocritRisePct: 24,
          plateletsK: 32,
          mucosalBleedingPresent: true
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
        <span>🦟</span> Phase 124: TROPICAL-MALARIA-DENGUE (WHO Artesunate & Dengue Shock)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>SYNDROME</label>
              <select value={syndrome} onChange={e => setSyndrome(e.target.value)} style={{ width: '100%', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }}>
                <option value="FALCIPARUM_MALARIA">P. falciparum Malaria</option>
                <option value="DENGUE_FEVER">Dengue Hemorrhagic / Shock</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>WEIGHT (kg)</label>
              <input type="number" value={weightKg} onChange={e => setWeightKg(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>PARASITEMIA (%)</label>
              <input type="number" step="0.5" value={parasitemiaPct} onChange={e => setParasitemiaPct(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <button onClick={handleEvaluate} disabled={isLoading} style={{ backgroundColor: '#d97706', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, width: '100%' }}>
            {isLoading ? 'EVALUATING WHO PROTOCOL...' : 'RUN WHO SEVERE MALARIA / DENGUE SHOCK PROTOCOL'}
          </button>
        </div>

        <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #1e293b', fontSize: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#fbbf24' }}>Tropical Critical Care Directives</h4>
          {result ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>WHO Severity Tier:</span>
                <span style={{ fontWeight: 'bold', color: '#ef4444' }}>{result.severityTier}</span>
              </div>
              {result.ivArtesunateIndicated && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#94a3b8' }}>STAT IV Artesunate:</span>
                  <span style={{ fontWeight: 'bold', color: '#10b981' }}>{result.artesunateDoseMg} mg IV (0h, 12h, 24h)</span>
                </div>
              )}
              {result.clinicalDirectives.map((d: string, i: number) => (
                <div key={i} style={{ backgroundColor: '#1e293b', padding: '6px', borderRadius: '4px', marginBottom: '4px', color: '#e2e8f0', fontSize: '11px' }}>• {d}</div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#64748b' }}>Awaiting tropical syndrome data.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PHASE 125: NEURO-PROGNOSIS-MULTIMODAL SUB-HUB
// ============================================================================
export const NeuroPrognosisHub: React.FC = () => {
  const [hoursPostRoscOrRewarming, setHoursPostRoscOrRewarming] = useState<number>(80);
  const [coreTempCelsius, setCoreTempCelsius] = useState<number>(36.7);
  const [sedativesCleared5HalfLives, setSedativesCleared5HalfLives] = useState<boolean>(true);
  const [nseUgL, setNseUgL] = useState<number>(92);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleEvaluate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/neuro-prognostication/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: 1,
          hoursPostRoscOrRewarming,
          coreTempCelsius,
          systolicBp: 112,
          mapMmhg: 80,
          sedativesCleared5HalfLives,
          neuromuscularBlockerCleared: true,
          severeMetabolicConfounderAbsent: true,
          bilateralAbsentPupillaryCorneal: true,
          bilateralAbsentN20Ssep: true,
          highlyMalignantEeg: true,
          nseUgL,
          statusMyoclonusWithin72h: false,
          diffuseAnoxicMriCtInjury: true,
          apneaTestPerformed: true,
          apneaBaselinePaco2Mmhg: 40,
          apneaFinalPaco2Mmhg: 64,
          respiratoryEffortObserved: false
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
        <span>🧬</span> Phase 125: NEURO-PROGNOSIS-MULTIMODAL (72h Guard & AAN 2023 BD/DNC)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>HOURS POST-ROSC</label>
              <input type="number" value={hoursPostRoscOrRewarming} onChange={e => setHoursPostRoscOrRewarming(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>CORE TEMP (°C)</label>
              <input type="number" step="0.1" value={coreTempCelsius} onChange={e => setCoreTempCelsius(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>NSE (ug/L)</label>
              <input type="number" value={nseUgL} onChange={e => setNseUgL(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ marginBottom: '14px', fontSize: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f8fafc', cursor: 'pointer' }}>
              <input type="checkbox" checked={sedativesCleared5HalfLives} onChange={e => setSedativesCleared5HalfLives(e.target.checked)} />
              Sedatives Cleared (&ge; 5 Half-Lives Verified)
            </label>
          </div>

          <button onClick={handleEvaluate} disabled={isLoading} style={{ backgroundColor: '#9333ea', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, width: '100%' }}>
            {isLoading ? 'VERIFYING MULTIMODAL CRITERIA...' : 'RUN 72H NEUROPROGNOSTICATION & AAN 2023 CHECK'}
          </button>
        </div>

        <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #1e293b', fontSize: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#a855f7' }}>Neuroprognostic Verification</h4>
          {result ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Prognosis Status:</span>
                <span style={{ fontWeight: 'bold', color: result.confoundersCleared ? '#fbbf24' : '#ef4444' }}>{result.prognosisStatus}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Concordant Predictors:</span>
                <span style={{ fontWeight: 'bold', color: '#38bdf8' }}>{result.concordantPoorPredictors} / 6</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8' }}>AAN 2023 BD/DNC:</span>
                <span style={{ fontWeight: 'bold', color: result.aanBdDncEligible ? '#ef4444' : '#94a3b8' }}>
                  {result.aanBdDncEligible ? 'CRITERIA SATISFIED' : 'NOT MET'}
                </span>
              </div>
              {result.clinicalDirectives.map((d: string, i: number) => (
                <div key={i} style={{ backgroundColor: '#1e293b', padding: '6px', borderRadius: '4px', marginBottom: '4px', color: '#e2e8f0', fontSize: '11px' }}>• {d}</div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#64748b' }}>Awaiting multimodal neuro data.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// SUITE 10 MASTER HUB
// ============================================================================
export const SpecialtyCriticalCareSuiteHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'p121' | 'p122' | 'p123' | 'p124' | 'p125'>('p121');

  return (
    <div style={{ padding: '20px', backgroundColor: '#0b0f19', color: '#f8fafc', minHeight: '100%', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: '20px', borderBottom: '1px solid #1e293b', paddingBottom: '16px' }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>🩸</span> Suite 10: Hematology TMA, Geriatric Delirium, Envenomation, Tropical & Neuro-Prognosis
        </h2>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>
          PLASMIC TTP/DIC Arbitration, CAM-ICU & AGS Beers Deprescribing, Antivenom Titration, WHO Severe Malaria/Dengue, and AAN 2023 Neuroprognostication (Phases 121–125).
        </p>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { id: 'p121', label: '🩸 Phase 121: TMA-HEMATOLOGY', color: '#ef4444' },
          { id: 'p122', label: '🧠 Phase 122: GERIATRIC-BEERS', color: '#38bdf8' },
          { id: 'p123', label: '🐍 Phase 123: ENVENOMATION-TOX', color: '#10b981' },
          { id: 'p124', label: '🦟 Phase 124: TROPICAL-WHO', color: '#fbbf24' },
          { id: 'p125', label: '🧬 Phase 125: NEURO-PROGNOSIS', color: '#a855f7' }
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
        {activeTab === 'p121' && <TmaHematologyHub />}
        {activeTab === 'p122' && <GeriatricDeliriumHub />}
        {activeTab === 'p123' && <EnvenomationAntivenomHub />}
        {activeTab === 'p124' && <TropicalCriticalCareHub />}
        {activeTab === 'p125' && <NeuroPrognosisHub />}
      </div>
    </div>
  );
};
export default SpecialtyCriticalCareSuiteHub;
