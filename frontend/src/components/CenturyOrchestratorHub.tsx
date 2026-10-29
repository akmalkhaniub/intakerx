import React, { useState, useEffect } from 'react';

interface CrossPhaseConflict {
  conflictId: string;
  title: string;
  hazardDescription: string;
  involvedPhases: string;
  arbitratedResolutionDirective: string;
  priorityRank: number;
}

interface ExecutiveCarePlan {
  primaryResuscitationGoal: string;
  hemodynamicTargets: string;
  ventilatoryTargets: string;
  metabolicTransfusionTargets: string;
  safetyContraindicationsActive: string[];
}

interface CenturySynthesisResult {
  patientId: number;
  centuryScore: number;
  centuryTier: 'STABLE_OBSERVATION' | 'MODERATE_MONITORED' | 'HIGH_CRITICAL' | 'EXTREME_SURGE_ORCHESTRATED';
  primaryDomain: string;
  domainScores: Record<string, number>;
  crossPhaseConflicts: CrossPhaseConflict[];
  dispatchedTeams: string[];
  executiveCarePlan: ExecutiveCarePlan;
  protocolDirectives: string[];
  executiveSummary: string;
}

export const CenturyOrchestratorHub: React.FC = () => {
  const [patientId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'telemetry' | 'conflicts' | 'history'>('telemetry');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Tab 1: Telemetry Form State
  // Neurologic
  const [gcsScore, setGcsScore] = useState<number>(14);
  const [icpMmhg, setIcpMmhg] = useState<number>(15);
  const [cppMmhg, setCppMmhg] = useState<number>(65);
  const [statusEpilepticus, setStatusEpilepticus] = useState<boolean>(false);
  const [spinalCordInjuryLevel, setSpinalCordInjuryLevel] = useState<string>('');

  // Cardiovascular
  const [heartRate, setHeartRate] = useState<number>(95);
  const [systolicBp, setSystolicBp] = useState<number>(118);
  const [diastolicBp, setDiastolicBp] = useState<number>(72);
  const [typeADissection, setTypeADissection] = useState<boolean>(false);
  const [activeMcsDevice, setActiveMcsDevice] = useState<string>('');
  const [vasoactiveInotropicScore, setVasoactiveInotropicScore] = useState<number>(5);

  // Respiratory
  const [paO2FiO2Ratio, setPaO2FiO2Ratio] = useState<number>(280);
  const [mechanicalVent, setMechanicalVent] = useState<boolean>(false);
  const [severeAsthma, setSevereAsthma] = useState<boolean>(false);
  const [inhalationInjury, setInhalationInjury] = useState<boolean>(false);

  // Renal & Fluids
  const [serumCreatinine, setSerumCreatinine] = useState<number>(1.1);
  const [urineOutputMlKgH, setUrineOutputMlKgH] = useState<number>(0.8);
  const [crrtActive, setCrrtActive] = useState<boolean>(false);
  const [bladderPressureIap, setBladderPressureIap] = useState<number>(12);

  // Hepatic & Metabolic
  const [serumLactate, setSerumLactate] = useState<number>(1.8);
  const [totalBili, setTotalBili] = useState<number>(1.0);
  const [dkaOrHhs, setDkaOrHhs] = useState<boolean>(false);

  // Hematologic
  const [fibrinogen, setFibrinogen] = useState<number>(240);
  const [platelets, setPlatelets] = useState<number>(180);
  const [mtpProtocol, setMtpProtocol] = useState<boolean>(false);

  // Obstetric
  const [isPregnantOrPostpartum, setIsPregnantOrPostpartum] = useState<boolean>(false);
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState<number>(34);
  const [maternalArrest, setMaternalArrest] = useState<boolean>(false);
  const [preeclampsiaEclampsia, setPreeclampsiaEclampsia] = useState<boolean>(false);
  const [postpartumHemorrhage, setPostpartumHemorrhage] = useState<boolean>(false);
  const [qblMl, setQblMl] = useState<number>(0);

  // Trauma & Burns
  const [burnTbsa, setBurnTbsa] = useState<number>(0);
  const [traumaIss, setTraumaIss] = useState<number>(0);

  const [synthesisResult, setSynthesisResult] = useState<CenturySynthesisResult | null>(null);

  // Tab 3: History State
  const [sessionsHistory, setSessionsHistory] = useState<any[]>([]);
  const [alertsHistory, setAlertsHistory] = useState<any[]>([]);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const headers = { Authorization: `Bearer ${token}` };

      const [sessRes, alertRes] = await Promise.all([
        fetch(`/api/clinician/century/sessions/${patientId}`, { headers }),
        fetch(`/api/clinician/century/alerts/${patientId}`, { headers })
      ]);

      if (sessRes.ok) {
        setSessionsHistory(await sessRes.json());
      }
      if (alertRes.ok) {
        setAlertsHistory(await alertRes.json());
      }
    } catch (err: any) {
      console.error('Failed to load history:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  const handleSynthesize = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const mapVal = Number(((systolicBp + 2 * diastolicBp) / 3).toFixed(1));
      const siVal = systolicBp > 0 ? Number((heartRate / systolicBp).toFixed(2)) : 0;

      const body = {
        patientId,
        neurologic: {
          gcsScore,
          icpMmhg,
          cppMmhg,
          statusEpilepticusActive: statusEpilepticus,
          spinalCordInjuryLevel: spinalCordInjuryLevel || undefined
        },
        cardiovascular: {
          heartRate,
          systolicBp,
          diastolicBp,
          meanArterialPressure: mapVal,
          shockIndex: siVal,
          vasoactiveInotropicScore,
          acuteAorticDissectionTypeA: typeADissection,
          activeMcsDevice: activeMcsDevice || undefined
        },
        respiratory: {
          paO2FiO2Ratio,
          mechanicalVentilation: mechanicalVent,
          severeAsthmaBronchospasm: severeAsthma,
          inhalationInjurySuspected: inhalationInjury
        },
        renalFluids: {
          serumCreatinineMgDl: serumCreatinine,
          hourlyUrineOutputMlKgH: urineOutputMlKgH,
          crrtActive,
          bladderPressureIapMmhg: bladderPressureIap
        },
        hepaticMetabolic: {
          serumLactateMmolL: serumLactate,
          totalBilirubinMgDl: totalBili,
          dkaOrHhsActive: dkaOrHhs
        },
        hematologic: {
          fibrinogenMgDl: fibrinogen,
          plateletCountK: platelets,
          activeMtpProtocol: mtpProtocol
        },
        obstetric: isPregnantOrPostpartum ? {
          isPregnantOrPostpartum: true,
          gestationalAgeWeeks,
          activeMaternalCardiacArrest: maternalArrest,
          severePreeclampsiaEclampsia: preeclampsiaEclampsia,
          postpartumHemorrhageActive: postpartumHemorrhage,
          qblMl: qblMl || undefined
        } : undefined,
        traumaAndBurns: {
          burnTbsaPercentage: burnTbsa > 0 ? burnTbsa : undefined,
          traumaIssScore: traumaIss > 0 ? traumaIss : undefined
        }
      };

      const res = await fetch('/api/clinician/century/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to synthesize grand orchestration.');
      }

      const data = await res.json();
      setSynthesisResult(data.synthesis);
      setStatusMessage('Century Meta-Executive Grand Synthesis executed successfully.');
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px', backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '16px', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '36px' }}>👑</span>
            <div>
              <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800, color: '#8b5cf6', letterSpacing: '-0.02em' }}>
                CENTURY-ORCHESTRATOR
              </h1>
              <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '14px' }}>
                The Phase 100 Grand Autonomous Critical Care Meta-Executive & Multi-Organ Arbiter
              </p>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ display: 'inline-block', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, backgroundColor: '#5b21b6', color: '#ede9fe', border: '1px solid #7c3aed' }}>
            PHASE 100 MILESTONE ACTIVE
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('telemetry')}
          style={{
            padding: '10px 18px',
            borderRadius: '6px',
            border: 'none',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            backgroundColor: activeTab === 'telemetry' ? '#8b5cf6' : '#1e293b',
            color: activeTab === 'telemetry' ? '#ffffff' : '#94a3b8'
          }}
        >
          🌐 Global Telemetry HUD & Multi-Organ Synthesis
        </button>
        <button
          onClick={() => setActiveTab('conflicts')}
          style={{
            padding: '10px 18px',
            borderRadius: '6px',
            border: 'none',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            backgroundColor: activeTab === 'conflicts' ? '#8b5cf6' : '#1e293b',
            color: activeTab === 'conflicts' ? '#ffffff' : '#94a3b8'
          }}
        >
          ⚖️ Cross-Phase Conflict Resolution Matrix
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            padding: '10px 18px',
            borderRadius: '6px',
            border: 'none',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            backgroundColor: activeTab === 'history' ? '#8b5cf6' : '#1e293b',
            color: activeTab === 'history' ? '#ffffff' : '#94a3b8'
          }}
        >
          📋 Orchestrator Audit Trail & History
        </button>
      </div>

      {statusMessage && (
        <div style={{ padding: '12px 16px', borderRadius: '6px', backgroundColor: statusMessage.startsWith('Error') ? '#7f1d1d' : '#064e3b', color: '#f8fafc', marginBottom: '20px', fontSize: '14px' }}>
          {statusMessage}
        </div>
      )}

      {/* TAB 1: TELEMETRY & SYNTHESIS */}
      {activeTab === 'telemetry' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '24px' }}>
          {/* Controls Panel */}
          <div style={{ backgroundColor: '#1e293b', borderRadius: '8px', padding: '20px', border: '1px solid #334155' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: 0, marginBottom: '16px', color: '#f8fafc', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
              Multi-System Critical Care Inputs (Phases 1 - 99 Synthesis)
            </h2>

            {/* Neuro & Cardiovasc */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#38bdf8', fontWeight: 600, marginBottom: '4px' }}>🧠 NEUROLOGIC</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input type="number" placeholder="GCS (3-15)" value={gcsScore} onChange={(e) => setGcsScore(parseInt(e.target.value) || 0)} style={{ padding: '6px 8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
                  <input type="number" placeholder="ICP (mmHg)" value={icpMmhg} onChange={(e) => setIcpMmhg(parseFloat(e.target.value) || 0)} style={{ padding: '6px 8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
                </div>
                <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
                  <label><input type="checkbox" checked={statusEpilepticus} onChange={(e) => setStatusEpilepticus(e.target.checked)} /> Status Epilepticus</label>
                  <input type="text" placeholder="Spinal Cord (e.g. T4, C5)" value={spinalCordInjuryLevel} onChange={(e) => setSpinalCordInjuryLevel(e.target.value)} style={{ padding: '4px 6px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '4px', color: '#fff', fontSize: '11px' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#f43f5e', fontWeight: 600, marginBottom: '4px' }}>🫀 CARDIOVASCULAR</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                  <input type="number" placeholder="HR" value={heartRate} onChange={(e) => setHeartRate(parseInt(e.target.value) || 0)} style={{ padding: '6px 6px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
                  <input type="number" placeholder="SBP" value={systolicBp} onChange={(e) => setSystolicBp(parseFloat(e.target.value) || 0)} style={{ padding: '6px 6px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
                  <input type="number" placeholder="DBP" value={diastolicBp} onChange={(e) => setDiastolicBp(parseFloat(e.target.value) || 0)} style={{ padding: '6px 6px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
                </div>
                <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
                  <label style={{ color: '#f87171' }}><input type="checkbox" checked={typeADissection} onChange={(e) => setTypeADissection(e.target.checked)} /> Type A Aortic Dissection</label>
                  <input type="text" placeholder="Active MCS (ECMO, Impella)" value={activeMcsDevice} onChange={(e) => setActiveMcsDevice(e.target.value)} style={{ padding: '4px 6px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '4px', color: '#fff', fontSize: '11px' }} />
                </div>
              </div>
            </div>

            {/* Resp & Renal */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#4ade80', fontWeight: 600, marginBottom: '4px' }}>🫁 RESPIRATORY</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input type="number" placeholder="P/F Ratio" value={paO2FiO2Ratio} onChange={(e) => setPaO2FiO2Ratio(parseFloat(e.target.value) || 0)} style={{ padding: '6px 8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '11px' }}><input type="checkbox" checked={mechanicalVent} onChange={(e) => setMechanicalVent(e.target.checked)} /> Ventilated</label>
                </div>
                <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
                  <label><input type="checkbox" checked={severeAsthma} onChange={(e) => setSevereAsthma(e.target.checked)} /> Severe Asthma / Bronchospasm</label>
                  <label><input type="checkbox" checked={inhalationInjury} onChange={(e) => setInhalationInjury(e.target.checked)} /> Inhalation Injury / Smoke</label>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#a78bfa', fontWeight: 600, marginBottom: '4px' }}>💧 RENAL & FLUIDS</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input type="number" step="0.1" placeholder="Creatinine" value={serumCreatinine} onChange={(e) => setSerumCreatinine(parseFloat(e.target.value) || 0)} style={{ padding: '6px 8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
                  <input type="number" step="0.1" placeholder="UO (mL/kg/h)" value={urineOutputMlKgH} onChange={(e) => setUrineOutputMlKgH(parseFloat(e.target.value) || 0)} style={{ padding: '6px 8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
                </div>
                <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
                  <label><input type="checkbox" checked={crrtActive} onChange={(e) => setCrrtActive(e.target.checked)} /> CRRT Active</label>
                  <input type="number" placeholder="Bladder Pressure (IAP mmHg)" value={bladderPressureIap} onChange={(e) => setBladderPressureIap(parseFloat(e.target.value) || 0)} style={{ padding: '4px 6px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '4px', color: '#fff', fontSize: '11px' }} />
                </div>
              </div>
            </div>

            {/* Metabolic & Hematologic */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#fbbf24', fontWeight: 600, marginBottom: '4px' }}>🧪 HEPATIC & METABOLIC</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input type="number" step="0.1" placeholder="Lactate" value={serumLactate} onChange={(e) => setSerumLactate(parseFloat(e.target.value) || 0)} style={{ padding: '6px 8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
                  <input type="number" step="0.1" placeholder="Total Bili" value={totalBili} onChange={(e) => setTotalBili(parseFloat(e.target.value) || 0)} style={{ padding: '6px 8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
                </div>
                <div style={{ marginTop: '6px', fontSize: '11px' }}>
                  <label><input type="checkbox" checked={dkaOrHhs} onChange={(e) => setDkaOrHhs(e.target.checked)} /> DKA / HHS Active</label>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#f87171', fontWeight: 600, marginBottom: '4px' }}>🩸 HEMATOLOGIC & TRANSFUSION</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input type="number" placeholder="Fibrinogen" value={fibrinogen} onChange={(e) => setFibrinogen(parseFloat(e.target.value) || 0)} style={{ padding: '6px 8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
                  <input type="number" placeholder="Platelets (k)" value={platelets} onChange={(e) => setPlatelets(parseFloat(e.target.value) || 0)} style={{ padding: '6px 8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
                </div>
                <div style={{ marginTop: '6px', fontSize: '11px' }}>
                  <label style={{ color: '#f87171', fontWeight: 600 }}><input type="checkbox" checked={mtpProtocol} onChange={(e) => setMtpProtocol(e.target.checked)} /> MTP (1:1:1) Active</label>
                </div>
              </div>
            </div>

            {/* Obstetric & Burns */}
            <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #334155', marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#f43f5e', fontWeight: 600, cursor: 'pointer', marginBottom: '6px' }}>
                <input type="checkbox" checked={isPregnantOrPostpartum} onChange={(e) => setIsPregnantOrPostpartum(e.target.checked)} />
                🤰 Pregnant or Postpartum Patient (Phases 96 - 98)
              </label>
              {isPregnantOrPostpartum && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px', marginTop: '6px' }}>
                  <label style={{ color: '#ef4444' }}><input type="checkbox" checked={maternalArrest} onChange={(e) => setMaternalArrest(e.target.checked)} /> Maternal Cardiac Arrest (4-Min PMCS)</label>
                  <label><input type="checkbox" checked={preeclampsiaEclampsia} onChange={(e) => setPreeclampsiaEclampsia(e.target.checked)} /> Severe Preeclampsia / Eclampsia</label>
                  <label style={{ color: '#f43f5e' }}><input type="checkbox" checked={postpartumHemorrhage} onChange={(e) => setPostpartumHemorrhage(e.target.checked)} /> Active PPH Hemorrhage</label>
                  <input type="number" placeholder="QBL (mL)" value={qblMl} onChange={(e) => setQblMl(parseFloat(e.target.value) || 0)} style={{ padding: '2px 6px', backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '4px', color: '#fff', fontSize: '11px' }} />
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#ea580c' }}>🔥 Burn TBSA % (Phase 99)</label>
                <input type="number" value={burnTbsa} onChange={(e) => setBurnTbsa(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1' }}>💥 Trauma ISS Score</label>
                <input type="number" value={traumaIss} onChange={(e) => setTraumaIss(parseInt(e.target.value) || 0)} style={{ width: '100%', padding: '6px 8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
              </div>
            </div>

            <button
              onClick={handleSynthesize}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: '#8b5cf6',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 800,
                fontSize: '16px',
                cursor: 'pointer',
                letterSpacing: '0.02em'
              }}
            >
              {isLoading ? 'Orchestrating 100 Phases...' : '👑 Execute Century Grand Meta-Executive Synthesis'}
            </button>
          </div>

          {/* Results HUD */}
          <div style={{ backgroundColor: '#1e293b', borderRadius: '8px', padding: '20px', border: '1px solid #334155' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: 0, marginBottom: '16px', color: '#f8fafc', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
              Century Meta-Executive HUD & Global Action Matrix
            </h2>

            {synthesisResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Score & Tier Header */}
                <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: synthesisResult.centuryTier === 'EXTREME_SURGE_ORCHESTRATED' ? '#581c87' : synthesisResult.centuryTier === 'HIGH_CRITICAL' ? '#881337' : '#14532d', border: '1px solid #7c3aed' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#e9d5ff', textTransform: 'uppercase', fontWeight: 700 }}>Century Composite Score</div>
                      <div style={{ fontSize: '28px', fontWeight: 900, color: '#ffffff', marginTop: '2px' }}>
                        {synthesisResult.centuryScore} / 100
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ display: 'inline-block', padding: '6px 12px', borderRadius: '6px', backgroundColor: '#ffffff', color: '#581c87', fontWeight: 800, fontSize: '12px' }}>
                        {synthesisResult.centuryTier}
                      </span>
                      <div style={{ fontSize: '11px', color: '#e9d5ff', marginTop: '4px' }}>
                        Primary: <strong>{synthesisResult.primaryDomain}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 8-Domain Radar Grid */}
                <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginBottom: '8px' }}>8-Domain Organ Instability Trajectory:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                    {Object.entries(synthesisResult.domainScores).map(([domain, score]) => (
                      <div key={domain} style={{ padding: '6px', backgroundColor: '#1e293b', borderRadius: '4px', textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>{domain.replace('_', ' ').slice(0, 8)}</div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: score >= 5 ? '#f87171' : score >= 3 ? '#f59e0b' : '#10b981' }}>
                          {score}/10
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cross-Phase Conflicts Alert Banner */}
                {synthesisResult.crossPhaseConflicts.length > 0 && (
                  <div style={{ backgroundColor: '#450a0a', padding: '14px', borderRadius: '6px', border: '1px solid #ef4444' }}>
                    <div style={{ fontWeight: 800, color: '#fecaca', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>⚠️</span> ACTIVE CROSS-PHASE CONFLICTS ARBITRATED ({synthesisResult.crossPhaseConflicts.length})
                    </div>
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {synthesisResult.crossPhaseConflicts.map((c) => (
                        <div key={c.conflictId} style={{ padding: '8px', backgroundColor: '#7f1d1d', borderRadius: '4px', fontSize: '12px', color: '#fff' }}>
                          <div style={{ fontWeight: 700, color: '#fef08a' }}>{c.title}</div>
                          <div style={{ fontSize: '11px', color: '#fecdd3', marginTop: '2px' }}>{c.involvedPhases}</div>
                          <div style={{ marginTop: '4px', fontStyle: 'italic', color: '#f1f5f9' }}>{c.arbitratedResolutionDirective}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Executive Care Plan */}
                <div style={{ backgroundColor: '#0f172a', padding: '14px', borderRadius: '6px', border: '1px solid #334155', fontSize: '12px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#8b5cf6', marginBottom: '6px' }}>Executive Care Plan:</div>
                  <div style={{ marginBottom: '4px' }}><strong>Goal:</strong> {synthesisResult.executiveCarePlan.primaryResuscitationGoal}</div>
                  <div style={{ marginBottom: '4px' }}><strong>Hemodynamics:</strong> {synthesisResult.executiveCarePlan.hemodynamicTargets}</div>
                  <div style={{ marginBottom: '4px' }}><strong>Ventilatory:</strong> {synthesisResult.executiveCarePlan.ventilatoryTargets}</div>
                  <div style={{ marginBottom: '4px' }}><strong>Transfusion/Metabolic:</strong> {synthesisResult.executiveCarePlan.metabolicTransfusionTargets}</div>
                  {synthesisResult.executiveCarePlan.safetyContraindicationsActive.length > 0 && (
                    <div style={{ marginTop: '6px', color: '#f87171', fontWeight: 600 }}>
                      🚫 Active Contraindications: {synthesisResult.executiveCarePlan.safetyContraindicationsActive.join('; ')}
                    </div>
                  )}
                </div>

                {/* Mobilized Multi-Disciplinary Teams */}
                {synthesisResult.dispatchedTeams.length > 0 && (
                  <div style={{ backgroundColor: '#0f172a', padding: '14px', borderRadius: '6px', border: '1px solid #334155' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#38bdf8', marginBottom: '6px' }}>🚨 Mobilized Specialized Teams:</div>
                    <ul style={{ margin: '0 0 0 16px', padding: 0, fontSize: '12px', color: '#cbd5e1' }}>
                      {synthesisResult.dispatchedTeams.map((team, i) => (
                        <li key={i} style={{ marginBottom: '2px', fontWeight: 600 }}>{team}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ color: '#94a3b8', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>
                Enter multi-organ parameters and click "Execute Century Grand Meta-Executive Synthesis" to compute the global severity score and cross-phase arbitrations.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CROSS-PHASE CONFLICTS */}
      {activeTab === 'conflicts' && (
        <div style={{ backgroundColor: '#1e293b', borderRadius: '8px', padding: '24px', border: '1px solid #334155' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginTop: 0, marginBottom: '8px', color: '#8b5cf6' }}>
            Cross-Phase Clinical Conflict Resolution Matrix (The 100-Phase Arbiter)
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '20px' }}>
            Autonomous clinical decision support arbitrates contradictory medical guidelines when multi-organ disease states collide.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '6px', border: '1px solid #334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#f59e0b' }}>
                  1. Aortic Dissection Anti-Impulse vs. Spinal Cord Perfusion
                </span>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Phase 66 vs. Phase 95</span>
              </div>
              <div style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '6px' }}>
                <strong>Contradiction:</strong> Type A aortic dissection requires strict SBP &lt; 120 and HR &lt; 60 to prevent catastrophic rupture, whereas acute spinal cord trauma mandates MAP &gt; 85-90 mmHg to prevent permanent ischemic paraplegia.
              </div>
              <div style={{ fontSize: '13px', color: '#38bdf8', marginTop: '6px' }}>
                <strong>Century Arbitration:</strong> Aortic rupture is acutely fatal and takes precedence over MAP elevation. Maintain strict anti-impulse control (SBP 100-120 with Esmolol) while placing an immediate CSF lumbar drain to reduce intrathecal pressure, thereby augmenting spinal cord perfusion pressure without raising systemic arterial pressure.
              </div>
            </div>

            <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '6px', border: '1px solid #334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#f59e0b' }}>
                  2. Severe Preeclampsia / HTN vs. Postpartum Hemorrhage Atony
                </span>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Phase 97 vs. Phase 98</span>
              </div>
              <div style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '6px' }}>
                <strong>Contradiction:</strong> Standard PPH algorithm recommends Methylergonovine (Methergine) as step 2 uterotonic, but ergot alkaloids cause potent peripheral vasoconstriction triggering hypertensive encephalopathy and cerebral hemorrhage in preeclampsia.
              </div>
              <div style={{ fontSize: '13px', color: '#38bdf8', marginTop: '6px' }}>
                <strong>Century Arbitration:</strong> Methergine is strictly prohibited. Escalate directly from Oxytocin to Carboprost (Hemabate 250 mcg IM) or Misoprostol (800-1000 mcg) + early Bakri balloon tamponade.
              </div>
            </div>

            <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '6px', border: '1px solid #334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#f59e0b' }}>
                  3. Severe Asthma / Bronchospasm vs. Postpartum Hemorrhage Atony
                </span>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Phase 65 vs. Phase 98</span>
              </div>
              <div style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '6px' }}>
                <strong>Contradiction:</strong> 15-methyl PGF2alpha (Carboprost / Hemabate) is standard second-line uterotonic, but prostaglandins induce profound bronchoconstriction and fatal status asthmaticus in patients with reactive airways.
              </div>
              <div style={{ fontSize: '13px', color: '#38bdf8', marginTop: '6px' }}>
                <strong>Century Arbitration:</strong> Carboprost is strictly prohibited. Use Methergine (if not hypertensive), Misoprostol, Tranexamic Acid (TXA 1g IV), and intrauterine balloon tamponade.
              </div>
            </div>

            <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '6px', border: '1px solid #334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#f59e0b' }}>
                  4. ARDS Fluid Restriction vs. Neurotrauma CPP Augmentation
                </span>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Phase 65 vs. Phase 54</span>
              </div>
              <div style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '6px' }}>
                <strong>Contradiction:</strong> ARDS protocols enforce dry, conservative fluid management, whereas neurotrauma and cerebral salt wasting require volume expansion to maintain CPP &ge; 60 mmHg.
              </div>
              <div style={{ fontSize: '13px', color: '#38bdf8', marginTop: '6px' }}>
                <strong>Century Arbitration:</strong> Avoid crystalloid volume expansion. Utilize Hypertonic Saline (3% NaCl) to drive serum osmolarity without alveolar fluid extravasation, while using Norepinephrine and Vasopressin to achieve CPP &ge; 60-70 mmHg.
              </div>
            </div>

            <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '6px', border: '1px solid #334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#f59e0b' }}>
                  5. Critical Burn Parkland Resuscitation vs. Abdominal Compartment Syndrome
                </span>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Phase 99 vs. Phase 44</span>
              </div>
              <div style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '6px' }}>
                <strong>Contradiction:</strong> Parkland formula dictates escalating crystalloid fluids for oliguria, while fluid creep precipitates bladder pressure &ge; 20 mmHg and fatal abdominal compartment syndrome.
              </div>
              <div style={{ fontSize: '13px', color: '#38bdf8', marginTop: '6px' }}>
                <strong>Century Arbitration:</strong> Cease crystalloid escalation. Reduce Lactated Ringer's rate by 25% and initiate 5% Albumin colloid rescue infusion to pull third-spaced edema back into the intravascular space, while performing bedside torso/limb escharotomy.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: HISTORY */}
      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Sessions History */}
          <div style={{ backgroundColor: '#1e293b', borderRadius: '8px', padding: '20px', border: '1px solid #334155' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: 0, marginBottom: '16px', color: '#f8fafc', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
              Century Meta-Executive Sessions
            </h2>
            {sessionsHistory.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: '14px' }}>No century sessions on record for Patient #{patientId}.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>Session</th>
                      <th style={{ padding: '8px' }}>Score</th>
                      <th style={{ padding: '8px' }}>Primary Domain</th>
                      <th style={{ padding: '8px' }}>Executive Summary</th>
                      <th style={{ padding: '8px' }}>Synthesized At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionsHistory.map((row) => (
                      <tr key={row.id} style={{ borderBottom: '1px solid #1e293b' }}>
                        <td style={{ padding: '8px', fontWeight: 600 }}>#{row.id}</td>
                        <td style={{ padding: '8px', color: row.century_score >= 70 ? '#c084fc' : row.century_score >= 40 ? '#f59e0b' : '#10b981', fontWeight: 700 }}>
                          {row.century_score}/100
                        </td>
                        <td style={{ padding: '8px', fontWeight: 600 }}>{row.primary_instability_domain}</td>
                        <td style={{ padding: '8px', fontSize: '12px' }}>{row.executive_summary}</td>
                        <td style={{ padding: '8px', color: '#94a3b8' }}>{new Date(row.created_at).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Alerts History */}
          <div style={{ backgroundColor: '#1e293b', borderRadius: '8px', padding: '20px', border: '1px solid #334155' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: 0, marginBottom: '16px', color: '#f8fafc', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
              Cross-Phase Clinical Conflict Alerts
            </h2>
            {alertsHistory.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: '14px' }}>No cross-phase alerts logged for Patient #{patientId}.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>Alert #</th>
                      <th style={{ padding: '8px' }}>Conflict Title</th>
                      <th style={{ padding: '8px' }}>Involved Phases</th>
                      <th style={{ padding: '8px' }}>Arbitration Mandate</th>
                      <th style={{ padding: '8px' }}>Status</th>
                      <th style={{ padding: '8px' }}>Logged At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alertsHistory.map((alert) => (
                      <tr key={alert.id} style={{ borderBottom: '1px solid #1e293b' }}>
                        <td style={{ padding: '8px', fontWeight: 600 }}>#{alert.id}</td>
                        <td style={{ padding: '8px', color: '#f59e0b', fontWeight: 600 }}>{alert.alert_title}</td>
                        <td style={{ padding: '8px', color: '#cbd5e1' }}>{alert.contradicting_phases}</td>
                        <td style={{ padding: '8px', fontSize: '12px', color: '#38bdf8' }}>{alert.arbitration_mandate}</td>
                        <td style={{ padding: '8px', color: '#10b981', fontWeight: 600 }}>{alert.resolution_status}</td>
                        <td style={{ padding: '8px', color: '#94a3b8' }}>{new Date(alert.generated_at).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
