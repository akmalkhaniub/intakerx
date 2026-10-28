import React, { useState, useEffect } from 'react';

interface FirstLineDosing {
  recommendedDrug: string;
  route: 'IV' | 'IM' | 'INTRABUCCAL' | 'RECTAL';
  calculatedDoseMg: number;
  maxDoseMg: number;
  repeatInstruction: string;
}

interface SecondLineAgent {
  drug: string;
  dosePerKg: string;
  calculatedDoseMg: number;
  maxDoseMg: number;
  infusionTimeMins: number;
  cautions: string;
}

interface CivaRescuePlan {
  recommendedCiva: string;
  loadingDose: string;
  maintenanceRate: string;
  targetEegGoal: string;
  durationTargetHours: number;
}

interface SuperRefractoryPlan {
  ketogenicDietDirective: string;
  immunomodulationDirective: string;
  rescueAgents: string[];
}

interface StatusEpilepticusEvaluationResult {
  stage: 'STAGE_1_EARLY' | 'STAGE_2_ESTABLISHED' | 'STAGE_3_REFRACTORY' | 'STAGE_4_SUPER_REFRACTORY';
  seizureDurationMins: number;
  seizureType: string;
  weightKg: number;
  salzburgNcseMet: boolean;
  autoimmuneNorseSuspected: boolean;
  prisRiskFlag: boolean;
  firstLineDosing: FirstLineDosing;
  secondLineDosing: {
    agentOptions: SecondLineAgent[];
    preferredAgent: string;
  };
  civaRescuePlan?: CivaRescuePlan;
  superRefractoryRescuePlan?: SuperRefractoryPlan;
  protocolDirectives: string[];
  recommendedAction: string;
}

interface CeegTitrationResult {
  eegPattern: string;
  burstSuppressionRatioPct?: number;
  burstsPerMinute?: number;
  interburstIntervalSec?: number;
  targetAchieved: boolean;
  civaDrug: string;
  civaRateUnit: string;
  civaRate: number;
  titrationDirective: string;
  actionRequired: 'UPTITRATE' | 'MAINTAIN' | 'DOWNTITRATE_WEAN' | 'CHANGE_AGENT';
}

export const StatusEpilepticusHub: React.FC = () => {
  const [patientId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'evaluator' | 'ceeg_titrator' | 'history'>('evaluator');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Tab 1: Evaluator State
  const [seizureDurationMins, setSeizureDurationMins] = useState<number>(12);
  const [seizureType, setSeizureType] = useState<string>('CONVULSIVE_GENERALIZED');
  const [weightKg, setWeightKg] = useState<number>(70);
  const [ivAccess, setIvAccess] = useState<boolean>(true);
  const [firstLineBenzoGiven, setFirstLineBenzoGiven] = useState<string>('Lorazepam 4mg IV');
  const [firstLineResponse, setFirstLineResponse] = useState<'RESOLVED' | 'REFRACTORY' | 'PENDING'>('REFRACTORY');
  const [secondLineAsmGiven, setSecondLineAsmGiven] = useState<string>('None');
  const [secondLineResponse, setSecondLineResponse] = useState<'RESOLVED' | 'REFRACTORY' | 'PENDING'>('PENDING');
  const [intubated, setIntubated] = useState<boolean>(false);
  const [activeCivaInfusion, setActiveCivaInfusion] = useState<string>('');
  const [civaDurationHours, setCivaDurationHours] = useState<number>(0);
  // Salzburg & NORSE flags
  const [eegDischargesHz, setEegDischargesHz] = useState<number>(0);
  const [evolutionWithAsm, setEvolutionWithAsm] = useState<boolean>(false);
  const [noPriorEpilepsy, setNoPriorEpilepsy] = useState<boolean>(false);
  const [feverPreceding, setFeverPreceding] = useState<boolean>(false);
  // PRIS metrics
  const [propofolDose, setPropofolDose] = useState<number>(0);
  const [propofolHours, setPropofolHours] = useState<number>(0);
  const [triglycerides, setTriglycerides] = useState<number>(150);
  const [ckLevel, setCkLevel] = useState<number>(300);

  const [evaluationResult, setEvaluationResult] = useState<StatusEpilepticusEvaluationResult | null>(null);

  // Tab 2: cEEG Titrator State
  const [eegPattern, setEegPattern] = useState<string>('BURST_SUPPRESSION');
  const [bsrPct, setBsrPct] = useState<number>(65);
  const [burstsPerMin, setBurstsPerMin] = useState<number>(4);
  const [interburstSec, setInterburstSec] = useState<number>(12);
  const [civaDrug, setCivaDrug] = useState<string>('Propofol');
  const [civaRate, setCivaRate] = useState<number>(3.5);
  const [civaRateUnit, setCivaRateUnit] = useState<string>('mg/kg/h');
  const [ceegResult, setCeegResult] = useState<CeegTitrationResult | null>(null);

  // Tab 3: History State
  const [evalHistory, setEvalHistory] = useState<any[]>([]);
  const [ceegHistory, setCeegHistory] = useState<any[]>([]);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const headers = { Authorization: `Bearer ${token}` };

      const [evalRes, ceegRes] = await Promise.all([
        fetch(`/api/clinician/epilepsy/evaluations/${patientId}`, { headers }),
        fetch(`/api/clinician/epilepsy/ceeg-logs/${patientId}`, { headers })
      ]);

      if (evalRes.ok) {
        setEvalHistory(await evalRes.json());
      }
      if (ceegRes.ok) {
        setCeegHistory(await ceegRes.json());
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  const handleEvaluate = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const res = await fetch('/api/clinician/epilepsy/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId,
          seizureDurationMins,
          seizureType,
          weightKg,
          ivAccess,
          firstLineBenzoGiven,
          firstLineResponse,
          secondLineAsmGiven,
          secondLineResponse,
          intubated,
          activeCivaInfusion: activeCivaInfusion || undefined,
          civaDurationHours: civaDurationHours > 0 ? civaDurationHours : undefined,
          eegDischargesHz: eegDischargesHz > 0 ? eegDischargesHz : undefined,
          evolutionOrImprovementWithAsm: evolutionWithAsm,
          feverOrProdromePreceding: feverPreceding,
          noPriorEpilepsyHistory: noPriorEpilepsy,
          propofolDoseMgKgH: propofolDose > 0 ? propofolDose : undefined,
          propofolInfusionHours: propofolHours > 0 ? propofolHours : undefined,
          triglyceridesMgDl: triglycerides > 0 ? triglycerides : undefined,
          ckLevelUL: ckLevel > 0 ? ckLevel : undefined,
          persist: true
        })
      });

      if (!res.ok) {
        throw new Error(`Evaluation failed with status ${res.status}`);
      }

      const data = await res.json();
      setEvaluationResult(data.evaluation);
      setStatusMessage('Status Epilepticus evaluated and guidelines updated successfully.');
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTitrateCeeg = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const res = await fetch('/api/clinician/epilepsy/ceeg/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId,
          eegPattern,
          burstSuppressionRatioPct: bsrPct,
          burstsPerMinute: burstsPerMin,
          interburstIntervalSec: interburstSec,
          civaDrug,
          civaRateUnit,
          civaRate,
          persist: true
        })
      });

      if (!res.ok) {
        throw new Error(`Titration failed with status ${res.status}`);
      }

      const data = await res.json();
      setCeegResult(data.titration);
      setStatusMessage('cEEG titration directive logged successfully.');
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getStageBadgeStyle = (stage: string) => {
    switch (stage) {
      case 'STAGE_1_EARLY':
        return { bg: '#064e3b', border: '#10b981', color: '#6ee7b7', label: 'STAGE 1: IMPENDING (0-5 MIN)' };
      case 'STAGE_2_ESTABLISHED':
        return { bg: '#78350f', border: '#f59e0b', color: '#fde68a', label: 'STAGE 2: ESTABLISHED (5-20 MIN)' };
      case 'STAGE_3_REFRACTORY':
        return { bg: '#7f1d1d', border: '#ef4444', color: '#fca5a5', label: 'STAGE 3: REFRACTORY (RSE)' };
      case 'STAGE_4_SUPER_REFRACTORY':
        return { bg: '#4c1d95', border: '#a855f7', color: '#e9d5ff', label: 'STAGE 4: SUPER-REFRACTORY (SRSE)' };
      default:
        return { bg: '#1e293b', border: '#64748b', color: '#cbd5e1', label: stage };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #311042 100%)',
        padding: '20px 24px',
        borderRadius: '12px',
        border: '1px solid #6366f1',
        boxShadow: '0 4px 20px rgba(99, 102, 241, 0.15)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '10px' }}>
              ⚡ STATUS-EPILEPTICUS
              <span style={{ fontSize: '13px', background: '#4338ca', color: '#c7d2fe', padding: '3px 10px', borderRadius: '12px', fontWeight: '600' }}>
                AES / NCS Guidelines Sentinel
              </span>
            </h2>
            <p style={{ margin: '6px 0 0', color: '#a5b4fc', fontSize: '14px' }}>
              Refractory & Super-Refractory Protocol, Weight-Based ASMs, PRIS Watchdog & cEEG Burst-Suppression Titration
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>Patient Bed / MRN:</span>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#e0e7ff' }}>ICU-NEURO-{patientId.toString().padStart(3, '0')}</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
          <button
            onClick={() => setActiveTab('evaluator')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: activeTab === 'evaluator' ? '1px solid #818cf8' : '1px solid #374151',
              background: activeTab === 'evaluator' ? '#3730a3' : '#1e1e2f',
              color: activeTab === 'evaluator' ? '#ffffff' : '#9ca3af',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '13px'
            }}
          >
            📋 Stage & Medication Staging
          </button>
          <button
            onClick={() => setActiveTab('ceeg_titrator')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: activeTab === 'ceeg_titrator' ? '1px solid #818cf8' : '1px solid #374151',
              background: activeTab === 'ceeg_titrator' ? '#3730a3' : '#1e1e2f',
              color: activeTab === 'ceeg_titrator' ? '#ffffff' : '#9ca3af',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '13px'
            }}
          >
            📉 cEEG Burst-Suppression Titrator
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: activeTab === 'history' ? '1px solid #818cf8' : '1px solid #374151',
              background: activeTab === 'history' ? '#3730a3' : '#1e1e2f',
              color: activeTab === 'history' ? '#ffffff' : '#9ca3af',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '13px'
            }}
          >
            🕒 Audit Trail & Logs
          </button>
        </div>
      </div>

      {statusMessage && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          background: statusMessage.includes('Error') ? '#7f1d1d' : '#064e3b',
          color: '#ffffff',
          fontSize: '14px',
          fontWeight: '500'
        }}>
          {statusMessage}
        </div>
      )}

      {/* Tab 1: Stage Evaluator & ASMs */}
      {activeTab === 'evaluator' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
          {/* Controls Panel */}
          <div style={{ background: '#111827', padding: '20px', borderRadius: '12px', border: '1px solid #1f2937' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#f3f4f6', fontWeight: '700' }}>
              Seizure Presentation & Clinical Metrics
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>Seizure Duration (Minutes)</label>
                <input
                  type="number"
                  value={seizureDurationMins}
                  onChange={e => setSeizureDurationMins(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px 10px', marginTop: '4px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#ffffff' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>Patient Weight (kg)</label>
                <input
                  type="number"
                  value={weightKg}
                  onChange={e => setWeightKg(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px 10px', marginTop: '4px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#ffffff' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>Seizure Type</label>
                <select
                  value={seizureType}
                  onChange={e => setSeizureType(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', marginTop: '4px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#ffffff' }}
                >
                  <option value="CONVULSIVE_GENERALIZED">Convulsive Generalized</option>
                  <option value="FOCAL_MOTOR">Focal Motor with Impaired Awareness</option>
                  <option value="NON_CONVULSIVE_NCSE">Non-Convulsive Status (NCSE)</option>
                  <option value="MYOCLONIC_POST_ANOXIC">Post-Anoxic Myoclonus</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>Intravenous (IV) Access</label>
                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                  <button
                    onClick={() => setIvAccess(true)}
                    style={{ flex: 1, padding: '7px', borderRadius: '6px', border: ivAccess ? '1px solid #10b981' : '1px solid #374151', background: ivAccess ? '#064e3b' : '#1f2937', color: '#fff', cursor: 'pointer', fontSize: '12px' }}
                  >
                    Yes (IV)
                  </button>
                  <button
                    onClick={() => setIvAccess(false)}
                    style={{ flex: 1, padding: '7px', borderRadius: '6px', border: !ivAccess ? '1px solid #ef4444' : '1px solid #374151', background: !ivAccess ? '#7f1d1d' : '#1f2937', color: '#fff', cursor: 'pointer', fontSize: '12px' }}
                  >
                    No (IM Only)
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>First-Line Benzo Given</label>
                <input
                  type="text"
                  value={firstLineBenzoGiven}
                  onChange={e => setFirstLineBenzoGiven(e.target.value)}
                  placeholder="e.g. Lorazepam 4mg IV"
                  style={{ width: '100%', padding: '8px 10px', marginTop: '4px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#ffffff' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>First-Line Response</label>
                <select
                  value={firstLineResponse}
                  onChange={e => setFirstLineResponse(e.target.value as any)}
                  style={{ width: '100%', padding: '8px 10px', marginTop: '4px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#ffffff' }}
                >
                  <option value="PENDING">Pending / In Progress</option>
                  <option value="RESOLVED">Resolved (Cessation)</option>
                  <option value="REFRACTORY">Refractory (Ongoing)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>Second-Line ASM Given</label>
                <input
                  type="text"
                  value={secondLineAsmGiven}
                  onChange={e => setSecondLineAsmGiven(e.target.value)}
                  placeholder="e.g. Levetiracetam 4500mg IV"
                  style={{ width: '100%', padding: '8px 10px', marginTop: '4px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#ffffff' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>Second-Line Response</label>
                <select
                  value={secondLineResponse}
                  onChange={e => setSecondLineResponse(e.target.value as any)}
                  style={{ width: '100%', padding: '8px 10px', marginTop: '4px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#ffffff' }}
                >
                  <option value="PENDING">Pending / Not Given</option>
                  <option value="RESOLVED">Resolved (Cessation)</option>
                  <option value="REFRACTORY">Refractory (Ongoing)</option>
                </select>
              </div>
            </div>

            {/* Advanced Triggers Section */}
            <div style={{ marginTop: '16px', padding: '12px', background: '#1f2937', borderRadius: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#e5e7eb' }}>Critical Sentinel Risk Flags</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#cbd5e1' }}>
                  <input
                    type="checkbox"
                    checked={intubated}
                    onChange={e => setIntubated(e.target.checked)}
                  />
                  Patient Intubated / ETT
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#cbd5e1' }}>
                  <input
                    type="checkbox"
                    checked={noPriorEpilepsy}
                    onChange={e => setNoPriorEpilepsy(e.target.checked)}
                  />
                  No Prior Epilepsy History
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#cbd5e1' }}>
                  <input
                    type="checkbox"
                    checked={feverPreceding}
                    onChange={e => setFeverPreceding(e.target.checked)}
                  />
                  Preceding Fever / Illness (NORSE)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#cbd5e1' }}>
                  <input
                    type="checkbox"
                    checked={evolutionWithAsm}
                    onChange={e => setEvolutionWithAsm(e.target.checked)}
                  />
                  ASM Trial Evolution (Salzburg)
                </label>
              </div>

              {/* PRIS / CIVA Parameters */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8' }}>Active CIVA Infusion</label>
                  <input
                    type="text"
                    value={activeCivaInfusion}
                    onChange={e => setActiveCivaInfusion(e.target.value)}
                    placeholder="e.g. Midazolam 1.2 mg/kg/h"
                    style={{ width: '100%', padding: '6px', marginTop: '2px', background: '#111827', border: '1px solid #4b5563', borderRadius: '4px', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8' }}>Total CIVA Duration (Hours)</label>
                  <input
                    type="number"
                    value={civaDurationHours}
                    onChange={e => setCivaDurationHours(Number(e.target.value))}
                    style={{ width: '100%', padding: '6px', marginTop: '2px', background: '#111827', border: '1px solid #4b5563', borderRadius: '4px', color: '#fff' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', marginTop: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8' }}>Propofol (mg/kg/h)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={propofolDose}
                    onChange={e => setPropofolDose(Number(e.target.value))}
                    style={{ width: '100%', padding: '6px', marginTop: '2px', background: '#111827', border: '1px solid #4b5563', borderRadius: '4px', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8' }}>Propofol Hours</label>
                  <input
                    type="number"
                    value={propofolHours}
                    onChange={e => setPropofolHours(Number(e.target.value))}
                    style={{ width: '100%', padding: '6px', marginTop: '2px', background: '#111827', border: '1px solid #4b5563', borderRadius: '4px', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8' }}>Triglycerides</label>
                  <input
                    type="number"
                    value={triglycerides}
                    onChange={e => setTriglycerides(Number(e.target.value))}
                    style={{ width: '100%', padding: '6px', marginTop: '2px', background: '#111827', border: '1px solid #4b5563', borderRadius: '4px', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8' }}>CK Level (U/L)</label>
                  <input
                    type="number"
                    value={ckLevel}
                    onChange={e => setCkLevel(Number(e.target.value))}
                    style={{ width: '100%', padding: '6px', marginTop: '2px', background: '#111827', border: '1px solid #4b5563', borderRadius: '4px', color: '#fff' }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '10px' }}>
                <label style={{ fontSize: '11px', color: '#94a3b8' }}>EEG Discharges Frequency (Hz - Salzburg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={eegDischargesHz}
                  onChange={e => setEegDischargesHz(Number(e.target.value))}
                  placeholder="e.g. 2.8"
                  style={{ width: '100%', padding: '6px', marginTop: '2px', background: '#111827', border: '1px solid #4b5563', borderRadius: '4px', color: '#fff' }}
                />
              </div>
            </div>

            <button
              onClick={handleEvaluate}
              disabled={isLoading}
              style={{
                width: '100%',
                marginTop: '18px',
                padding: '12px',
                background: '#4f46e5',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
            >
              {isLoading ? 'Processing Guidelines...' : '⚡ Generate AES/NCS Protocol Directives'}
            </button>
          </div>

          {/* Results Panel */}
          <div style={{ background: '#111827', padding: '20px', borderRadius: '12px', border: '1px solid #1f2937' }}>
            {evaluationResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Stage Badge */}
                <div style={{
                  padding: '14px 18px',
                  borderRadius: '10px',
                  background: getStageBadgeStyle(evaluationResult.stage).bg,
                  border: `2px solid ${getStageBadgeStyle(evaluationResult.stage).border}`,
                  color: getStageBadgeStyle(evaluationResult.stage).color,
                  fontWeight: 'bold',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: '15px' }}>{getStageBadgeStyle(evaluationResult.stage).label}</span>
                  <span style={{ fontSize: '12px', opacity: 0.9 }}>Duration: {evaluationResult.seizureDurationMins} min</span>
                </div>

                {/* PRIS Warning Box */}
                {evaluationResult.prisRiskFlag && (
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    background: '#7f1d1d',
                    border: '2px solid #ef4444',
                    color: '#fee2e2'
                  }}>
                    <strong style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      ⚠️ PRIS (Propofol Infusion Syndrome) WARNING:
                    </strong>
                    <p style={{ margin: '4px 0 0', fontSize: '12px' }}>
                      High-dose propofol (&gt;4 mg/kg/h) with elevated triglycerides or prolonged infusion. Immediately taper and bridge to Midazolam or Ketamine infusion.
                    </p>
                  </div>
                )}

                {/* NORSE Warning Box */}
                {evaluationResult.autoimmuneNorseSuspected && (
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    background: '#4c1d95',
                    border: '2px solid #a855f7',
                    color: '#f3e8ff'
                  }}>
                    <strong style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      🧬 NORSE / FIRES Autoimmune Encephalitis Protocol:
                    </strong>
                    <p style={{ margin: '4px 0 0', fontSize: '12px' }}>
                      New-onset refractory status in patient without epilepsy preceded by febrile illness. Order CSF panel (NMDA, LGI1, CASPR2) and begin high-dose IV methylprednisolone 1g daily x 5 days + IVIG.
                    </p>
                  </div>
                )}

                {/* First-Line Dosing */}
                <div style={{ background: '#1f2937', padding: '14px', borderRadius: '8px', borderLeft: '4px solid #10b981' }}>
                  <span style={{ fontSize: '12px', color: '#34d399', fontWeight: 'bold' }}>FIRST-LINE BENZODIAZEPINE (T1 WINDOW)</span>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#ffffff', marginTop: '4px' }}>
                    {evaluationResult.firstLineDosing.recommendedDrug} {evaluationResult.firstLineDosing.calculatedDoseMg} mg {evaluationResult.firstLineDosing.route}
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#cbd5e1' }}>
                    {evaluationResult.firstLineDosing.repeatInstruction}
                  </p>
                </div>

                {/* Second-Line Dosing */}
                <div style={{ background: '#1f2937', padding: '14px', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>
                  <span style={{ fontSize: '12px', color: '#fbbf24', fontWeight: 'bold' }}>SECOND-LINE URGENT ASMs (ESETT TRIAL)</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                    {evaluationResult.secondLineDosing.agentOptions.map((opt, idx) => (
                      <div key={idx} style={{ padding: '8px', background: '#111827', borderRadius: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600', fontSize: '13px' }}>
                          <span style={{ color: '#ffffff' }}>{opt.drug}</span>
                          <span style={{ color: '#fbbf24' }}>{opt.calculatedDoseMg} mg IV ({opt.dosePerKg})</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{opt.cautions}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CIVA Plan */}
                {evaluationResult.civaRescuePlan && (
                  <div style={{ background: '#1f2937', padding: '14px', borderRadius: '8px', borderLeft: '4px solid #ef4444' }}>
                    <span style={{ fontSize: '12px', color: '#f87171', fontWeight: 'bold' }}>CONTINUOUS ANESTHETIC INFUSION (CIVA)</span>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#ffffff', marginTop: '4px' }}>
                      {evaluationResult.civaRescuePlan.recommendedCiva}
                    </div>
                    <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '4px' }}>
                      Load: {evaluationResult.civaRescuePlan.loadingDose} | Maintenance: {evaluationResult.civaRescuePlan.maintenanceRate}
                    </div>
                    <div style={{ fontSize: '11px', color: '#a5b4fc', marginTop: '4px' }}>
                      Target: {evaluationResult.civaRescuePlan.targetEegGoal}
                    </div>
                  </div>
                )}

                {/* Super-Refractory Rescue Plan */}
                {evaluationResult.superRefractoryRescuePlan && (
                  <div style={{ background: '#1f2937', padding: '14px', borderRadius: '8px', borderLeft: '4px solid #a855f7' }}>
                    <span style={{ fontSize: '12px', color: '#c084fc', fontWeight: 'bold' }}>SRSE MULTIMODAL RESCUE DIRECTIVES</span>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#e9d5ff' }}>
                      {evaluationResult.superRefractoryRescuePlan.ketogenicDietDirective}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#e9d5ff' }}>
                      {evaluationResult.superRefractoryRescuePlan.immunomodulationDirective}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                <p>Enter patient seizure characteristics and click "Generate Directives" to calculate AES/NCS consensus treatment roadmap.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: cEEG Titration */}
      {activeTab === 'ceeg_titrator' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ background: '#111827', padding: '20px', borderRadius: '12px', border: '1px solid #1f2937' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#f3f4f6', fontWeight: '700' }}>
              Continuous EEG Pattern & Anesthetic Parameters
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>Current EEG Pattern</label>
                <select
                  value={eegPattern}
                  onChange={e => setEegPattern(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', marginTop: '4px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#ffffff' }}
                >
                  <option value="BURST_SUPPRESSION">Burst Suppression (Target State)</option>
                  <option value="ELECTROGRAPHIC_SEIZURES">Ongoing Electrographic Seizures</option>
                  <option value="PERIODIC_DISCHARGES_GPD_LPD">Periodic Discharges (GPD / LPD)</option>
                  <option value="RHYTHMIC_DELTA_ACTIVITY">Rhythmic Delta Activity (RDA)</option>
                  <option value="CONTINUOUS_SLOWING_ISOLATED">Continuous Diffuse Slowing</option>
                  <option value="COMPLETE_SUPPRESSION">Complete Suppression (Isoelectric / Flat-Line)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>
                  Burst-Suppression Ratio (BSR %): <strong style={{ color: '#818cf8' }}>{bsrPct}%</strong> (Target 50-80%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={bsrPct}
                  onChange={e => setBsrPct(Number(e.target.value))}
                  style={{ width: '100%', marginTop: '6px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>Bursts / Min (Target 3-5)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={burstsPerMin}
                    onChange={e => setBurstsPerMin(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 10px', marginTop: '4px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#ffffff' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>Interburst Interval (sec, &ge; 10s)</label>
                  <input
                    type="number"
                    step="1"
                    value={interburstSec}
                    onChange={e => setInterburstSec(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 10px', marginTop: '4px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#ffffff' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>CIVA Drug</label>
                  <select
                    value={civaDrug}
                    onChange={e => setCivaDrug(e.target.value)}
                    style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#ffffff' }}
                  >
                    <option value="Propofol">Propofol</option>
                    <option value="Midazolam">Midazolam</option>
                    <option value="Ketamine">Ketamine</option>
                    <option value="Pentobarbital">Pentobarbital</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>Rate</label>
                  <input
                    type="number"
                    step="0.1"
                    value={civaRate}
                    onChange={e => setCivaRate(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#ffffff' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>Unit</label>
                  <input
                    type="text"
                    value={civaRateUnit}
                    onChange={e => setCivaRateUnit(e.target.value)}
                    style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#ffffff' }}
                  />
                </div>
              </div>

              <button
                onClick={handleTitrateCeeg}
                disabled={isLoading}
                style={{
                  width: '100%',
                  marginTop: '10px',
                  padding: '12px',
                  background: '#6366f1',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                {isLoading ? 'Titrating Infusion...' : '📉 Evaluate cEEG & Log Titration Directive'}
              </button>
            </div>
          </div>

          {/* cEEG Analysis Panel */}
          <div style={{ background: '#111827', padding: '20px', borderRadius: '12px', border: '1px solid #1f2937' }}>
            {ceegResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{
                  padding: '16px',
                  borderRadius: '10px',
                  background: ceegResult.targetAchieved ? '#064e3b' : ceegResult.actionRequired === 'DOWNTITRATE_WEAN' ? '#7f1d1d' : '#78350f',
                  border: `2px solid ${ceegResult.targetAchieved ? '#10b981' : ceegResult.actionRequired === 'DOWNTITRATE_WEAN' ? '#ef4444' : '#f59e0b'}`,
                  color: '#ffffff'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
                      {ceegResult.targetAchieved ? '✓ TARGET BURST SUPPRESSION ACHIEVED' : `ACTION REQUIRED: ${ceegResult.actionRequired}`}
                    </span>
                    <span style={{ fontSize: '12px', background: 'rgba(0,0,0,0.3)', padding: '4px 8px', borderRadius: '4px' }}>
                      {ceegResult.civaDrug} @ {ceegResult.civaRate} {ceegResult.civaRateUnit}
                    </span>
                  </div>
                  <p style={{ margin: '10px 0 0', fontSize: '13px', lineHeight: 1.5 }}>
                    {ceegResult.titrationDirective}
                  </p>
                </div>

                <div style={{ background: '#1f2937', padding: '14px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 'bold' }}>TITRATION METRICS SUMMARY</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '10px' }}>
                    <div style={{ background: '#111827', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>BSR Depth</div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#818cf8' }}>{ceegResult.burstSuppressionRatioPct}%</div>
                    </div>
                    <div style={{ background: '#111827', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>Burst Rate</div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#818cf8' }}>{ceegResult.burstsPerMinute} /min</div>
                    </div>
                    <div style={{ background: '#111827', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>Interburst Interval</div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#818cf8' }}>{ceegResult.interburstIntervalSec} s</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                <p>Adjust the continuous EEG parameters and click "Evaluate cEEG" to generate actionable titration guidance.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: History */}
      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: '#111827', padding: '20px', borderRadius: '12px', border: '1px solid #1f2937' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '16px', color: '#f3f4f6', fontWeight: '700' }}>
              Historical Status Epilepticus Evaluations
            </h3>
            {evalHistory.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '13px' }}>No recorded evaluations for this patient yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {evalHistory.map(item => (
                  <div key={item.id} style={{ padding: '12px', background: '#1f2937', borderRadius: '8px', borderLeft: '4px solid #6366f1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}>
                      <span style={{ color: '#ffffff' }}>Stage: {item.stage}</span>
                      <span style={{ color: '#9ca3af' }}>{new Date(item.evaluated_at).toLocaleString()}</span>
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#cbd5e1' }}>{item.recommended_action}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: '#111827', padding: '20px', borderRadius: '12px', border: '1px solid #1f2937' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '16px', color: '#f3f4f6', fontWeight: '700' }}>
              Continuous EEG Titration Logs
            </h3>
            {ceegHistory.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '13px' }}>No cEEG titration logs recorded yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {ceegHistory.map(item => (
                  <div key={item.id} style={{ padding: '12px', background: '#1f2937', borderRadius: '8px', borderLeft: `4px solid ${item.target_achieved ? '#10b981' : '#f59e0b'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}>
                      <span style={{ color: '#ffffff' }}>Pattern: {item.eeg_pattern} | Drug: {item.civa_drug} ({item.civa_rate} {item.civa_rate_unit})</span>
                      <span style={{ color: '#9ca3af' }}>{new Date(item.logged_at).toLocaleString()}</span>
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#cbd5e1' }}>{item.titration_directive}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
