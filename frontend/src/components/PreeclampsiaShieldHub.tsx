import React, { useState, useEffect } from 'react';

interface AntihypertensivePlan {
  indicated: boolean;
  targetBp: string;
  firstLineDrug: string;
  dosingRoadmap: string[];
  contraindicatedAgents: string[];
}

interface Mgso4Plan {
  indicated: boolean;
  loadingDose: string;
  maintenanceInfusion: string;
  recurrentSeizureDose: string;
  antidoteOrder: string;
}

interface DeliveryTimingGuidance {
  recommendation: string;
  urgency: 'EMERGENT_STAT' | 'URGENT_WITHIN_24_48H' | 'EXPECTANT_MANAGEMENT';
  corticosteroidsIndicated: boolean;
}

interface PreeclampsiaEvaluationResult {
  patientId: number;
  gestationalAgeWeeks: number;
  systolicBp: number;
  diastolicBp: number;
  severeHypertension: boolean;
  neurologicalSymptoms: string[];
  pulmonaryEdema: boolean;
  plateletCount: number;
  serumCreatinine: number;
  astUL: number;
  altUL: number;
  ldhUL: number;
  totalBilirubinMgDl: number;
  preeclampsiaSeverity: string;
  hellpClass: string;
  swanseaAflpScore: number;
  aflpSuspected: boolean;
  emergencyAntihypertensivePlan: AntihypertensivePlan;
  mgso4Plan: Mgso4Plan;
  deliveryTimingGuidance: DeliveryTimingGuidance;
  protocolDirectives: string[];
  clinicalSummary: string;
}

interface MagnesiumSurveillanceResult {
  patientId: number;
  encounterId?: number;
  hoursOnMgso4: number;
  currentInfusionRateGH: number;
  serumMagnesiumMgDl?: number;
  patellarReflexIntact: boolean;
  respiratoryRate: number;
  hourlyUrineOutputMl: number;
  toxicityFlag: 'NONE_THERAPEUTIC' | 'SUBTHERAPEUTIC' | 'LOSS_OF_REFLEXES' | 'RESPIRATORY_DEPRESSION' | 'OLIGURIA_ACCUMULATION_RISK';
  titrationAction: 'MAINTAIN' | 'UPTITRATE' | 'HOLD_AND_REDUCE' | 'STAT_CALCIUM_GLUCONATE';
  clinicalDirective: string;
}

export const PreeclampsiaShieldHub: React.FC = () => {
  const [patientId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'evaluator' | 'magnesium' | 'history'>('evaluator');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Tab 1: Evaluator State
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState<number>(33.5);
  const [systolicBp, setSystolicBp] = useState<number>(168);
  const [diastolicBp, setDiastolicBp] = useState<number>(112);
  const [priorConfirmedSevereBp, setPriorConfirmedSevereBp] = useState<boolean>(true);
  const [headache, setHeadache] = useState<boolean>(true);
  const [visualScotomata, setVisualScotomata] = useState<boolean>(true);
  const [hyperreflexia, setHyperreflexia] = useState<boolean>(false);
  const [pulmonaryEdema, setPulmonaryEdema] = useState<boolean>(false);
  const [activeEclampticSeizure, setActiveEclampticSeizure] = useState<boolean>(false);
  const [plateletCount, setPlateletCount] = useState<number>(68000);
  const [serumCreatinine, setSerumCreatinine] = useState<number>(1.2);
  const [astUL, setAstUL] = useState<number>(120);
  const [altUL, setAltUL] = useState<number>(110);
  const [ldhUL, setLdhUL] = useState<number>(720);
  const [totalBilirubinMgDl, setTotalBilirubinMgDl] = useState<number>(1.4);
  const [hasAsthmaOrBradycardia, setHasAsthmaOrBradycardia] = useState<boolean>(false);

  // Swansea AFLP Flags
  const [vomitingOrAbdominalPain, setVomitingOrAbdominalPain] = useState<boolean>(true);
  const [encephalopathy, setEncephalopathy] = useState<boolean>(false);
  const [hypoglycemiaMgDl, setHypoglycemiaMgDl] = useState<number>(65);
  const [elevatedUricAcidMgDl, setElevatedUricAcidMgDl] = useState<number>(6.5);
  const [coagulopathyPtSec, setCoagulopathyPtSec] = useState<number>(15.2);

  const [evaluationResult, setEvaluationResult] = useState<PreeclampsiaEvaluationResult | null>(null);

  // Tab 2: Magnesium Surveillance State
  const [hoursOnMgso4, setHoursOnMgso4] = useState<number>(3);
  const [currentInfusionRateGH, setCurrentInfusionRateGH] = useState<number>(2.0);
  const [serumMagnesiumMgDl, setSerumMagnesiumMgDl] = useState<number>(5.6);
  const [patellarReflexIntact, setPatellarReflexIntact] = useState<boolean>(true);
  const [respiratoryRate, setRespiratoryRate] = useState<number>(14);
  const [hourlyUrineOutputMl, setHourlyUrineOutputMl] = useState<number>(45);
  const [magnesiumResult, setMagnesiumResult] = useState<MagnesiumSurveillanceResult | null>(null);

  // Tab 3: History State
  const [evalHistory, setEvalHistory] = useState<any[]>([]);
  const [magLogsHistory, setMagLogsHistory] = useState<any[]>([]);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const headers = { Authorization: `Bearer ${token}` };

      const [evalRes, magRes] = await Promise.all([
        fetch(`/api/clinician/preeclampsia/evaluations/${patientId}`, { headers }),
        fetch(`/api/clinician/preeclampsia/magnesium-logs/${patientId}`, { headers })
      ]);

      if (evalRes.ok) {
        setEvalHistory(await evalRes.json());
      }
      if (magRes.ok) {
        setMagLogsHistory(await magRes.json());
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

  const handleEvaluate = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const neuroSymptoms: string[] = [];
      if (headache) neuroSymptoms.push('severe_headache');
      if (visualScotomata) neuroSymptoms.push('visual_scotomata');
      if (hyperreflexia) neuroSymptoms.push('hyperreflexia_clonus');

      const body = {
        patientId,
        gestationalAgeWeeks,
        systolicBp,
        diastolicBp,
        priorConfirmedSevereBp,
        neurologicalSymptoms: neuroSymptoms,
        pulmonaryEdema,
        activeEclampticSeizure,
        plateletCount,
        serumCreatinine,
        astUL,
        altUL,
        ldhUL,
        totalBilirubinMgDl,
        hypoglycemiaMgDl,
        elevatedUricAcidMgDl,
        coagulopathyPtSec,
        vomitingOrAbdominalPain,
        encephalopathy,
        hasAsthmaOrBradycardia
      };

      const res = await fetch('/api/clinician/preeclampsia/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to evaluate preeclampsia.');
      }

      const data = await res.json();
      setEvaluationResult(data.evaluation);
      setStatusMessage('Preeclampsia & HELLP Evaluation generated and persisted successfully.');
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogMagnesium = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const body = {
        patientId,
        hoursOnMgso4,
        currentInfusionRateGH,
        serumMagnesiumMgDl: serumMagnesiumMgDl || undefined,
        patellarReflexIntact,
        respiratoryRate,
        hourlyUrineOutputMl
      };

      const res = await fetch('/api/clinician/preeclampsia/magnesium/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to log magnesium surveillance.');
      }

      const data = await res.json();
      setMagnesiumResult(data.surveillance);
      setStatusMessage('Magnesium Surveillance logged and analyzed.');
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
            <span style={{ fontSize: '32px' }}>🛡️</span>
            <div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#f59e0b', letterSpacing: '-0.02em' }}>
                PREECLAMPSIA-SHIELD
              </h1>
              <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '14px' }}>
                Severe Preeclampsia, Eclampsia Seizure & Mississippi HELLP Triple-Class Sentinel
              </p>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ display: 'inline-block', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, backgroundColor: '#b45309', color: '#fef3c7' }}>
            PHASE 97 ACTIVE
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('evaluator')}
          style={{
            padding: '10px 18px',
            borderRadius: '6px',
            border: 'none',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            backgroundColor: activeTab === 'evaluator' ? '#f59e0b' : '#1e293b',
            color: activeTab === 'evaluator' ? '#0f172a' : '#94a3b8'
          }}
        >
          ⚖️ Severity & Antihypertensive Evaluator
        </button>
        <button
          onClick={() => setActiveTab('magnesium')}
          style={{
            padding: '10px 18px',
            borderRadius: '6px',
            border: 'none',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            backgroundColor: activeTab === 'magnesium' ? '#f59e0b' : '#1e293b',
            color: activeTab === 'magnesium' ? '#0f172a' : '#94a3b8'
          }}
        >
          🧪 MgSO4 & Toxicity Surveillance
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
            backgroundColor: activeTab === 'history' ? '#f59e0b' : '#1e293b',
            color: activeTab === 'history' ? '#0f172a' : '#94a3b8'
          }}
        >
          📋 Clinical Encounter History
        </button>
      </div>

      {statusMessage && (
        <div style={{ padding: '12px 16px', borderRadius: '6px', backgroundColor: statusMessage.startsWith('Error') ? '#7f1d1d' : '#064e3b', color: '#f8fafc', marginBottom: '20px', fontSize: '14px' }}>
          {statusMessage}
        </div>
      )}

      {/* TAB 1: EVALUATOR */}
      {activeTab === 'evaluator' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* Controls */}
          <div style={{ backgroundColor: '#1e293b', borderRadius: '8px', padding: '20px', border: '1px solid #334155' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: 0, marginBottom: '16px', color: '#f8fafc', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
              Obstetric Assessment & Clinical Metrics
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Gestational Age (Weeks)</label>
                <input
                  type="number"
                  step="0.1"
                  value={gestationalAgeWeeks}
                  onChange={(e) => setGestationalAgeWeeks(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Prior Confirmed Severe BP</label>
                <select
                  value={priorConfirmedSevereBp ? 'yes' : 'no'}
                  onChange={(e) => setPriorConfirmedSevereBp(e.target.value === 'yes')}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                >
                  <option value="yes">Yes (&gt;=15m apart)</option>
                  <option value="no">No (Single reading)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Systolic BP (mmHg)</label>
                <input
                  type="number"
                  value={systolicBp}
                  onChange={(e) => setSystolicBp(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Diastolic BP (mmHg)</label>
                <input
                  type="number"
                  value={diastolicBp}
                  onChange={(e) => setDiastolicBp(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>Neurological & Severe Symptoms</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #334155' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={headache} onChange={(e) => setHeadache(e.target.checked)} />
                  Persistent Severe Frontal/Occipital Headache
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={visualScotomata} onChange={(e) => setVisualScotomata(e.target.checked)} />
                  Visual Scotomata / Photopsia / Blurred Vision
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={hyperreflexia} onChange={(e) => setHyperreflexia(e.target.checked)} />
                  Hyperreflexia (&gt;= 3+ patellar reflexes) or Sustained Clonus
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={pulmonaryEdema} onChange={(e) => setPulmonaryEdema(e.target.checked)} />
                  Pulmonary Edema (Bilateral crackles / Hypoxemia)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#ef4444', fontWeight: 600, cursor: 'pointer' }}>
                  <input type="checkbox" checked={activeEclampticSeizure} onChange={(e) => setActiveEclampticSeizure(e.target.checked)} />
                  ACTIVE ECLAMPTIC SEIZURE (Generalized Tonic-Clonic)
                </label>
              </div>
            </div>

            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#f59e0b', margin: '16px 0 8px 0' }}>
              Laboratory & HELLP Profile
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '2px' }}>Platelets (/mcL)</label>
                <input
                  type="number"
                  value={plateletCount}
                  onChange={(e) => setPlateletCount(parseInt(e.target.value) || 0)}
                  style={{ width: '100%', padding: '6px 10px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '2px' }}>Creatinine (mg/dL)</label>
                <input
                  type="number"
                  step="0.1"
                  value={serumCreatinine}
                  onChange={(e) => setSerumCreatinine(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '6px 10px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '2px' }}>LDH (U/L)</label>
                <input
                  type="number"
                  value={ldhUL}
                  onChange={(e) => setLdhUL(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '6px 10px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc', fontSize: '13px' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '2px' }}>AST (U/L)</label>
                <input
                  type="number"
                  value={astUL}
                  onChange={(e) => setAstUL(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '6px 10px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '2px' }}>ALT (U/L)</label>
                <input
                  type="number"
                  value={altUL}
                  onChange={(e) => setAltUL(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '6px 10px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '2px' }}>Total Bili (mg/dL)</label>
                <input
                  type="number"
                  step="0.1"
                  value={totalBilirubinMgDl}
                  onChange={(e) => setTotalBilirubinMgDl(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '6px 10px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc', fontSize: '13px' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px', backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #334155' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#f59e0b', fontWeight: 600, cursor: 'pointer', marginBottom: '8px' }}>
                <input type="checkbox" checked={hasAsthmaOrBradycardia} onChange={(e) => setHasAsthmaOrBradycardia(e.target.checked)} />
                Asthma, Heart Block, or Severe Bradycardia (Contraindicates Labetalol)
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input type="checkbox" checked={vomitingOrAbdominalPain} onChange={(e) => setVomitingOrAbdominalPain(e.target.checked)} />
                  Nausea / Vomiting / RUQ Pain
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input type="checkbox" checked={encephalopathy} onChange={(e) => setEncephalopathy(e.target.checked)} />
                  Hepatic Encephalopathy
                </label>
              </div>
            </div>

            <button
              onClick={handleEvaluate}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#f59e0b',
                color: '#0f172a',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 700,
                fontSize: '15px',
                cursor: 'pointer'
              }}
            >
              {isLoading ? 'Computing Classification...' : '🚀 Evaluate Preeclampsia, HELLP & Antihypertensive Ladder'}
            </button>
          </div>

          {/* Results Panel */}
          <div style={{ backgroundColor: '#1e293b', borderRadius: '8px', padding: '20px', border: '1px solid #334155' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: 0, marginBottom: '16px', color: '#f8fafc', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
              Diagnostic Synthesis & Treatment Roadmap
            </h2>

            {evaluationResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Severity Badges */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: evaluationResult.preeclampsiaSeverity.includes('ECLAMPSIA') ? '#7f1d1d' : evaluationResult.preeclampsiaSeverity.includes('SEVERE') ? '#78350f' : '#14532d', border: '1px solid #475569' }}>
                    <div style={{ fontSize: '11px', color: '#cbd5e1', textTransform: 'uppercase', fontWeight: 600 }}>Severity Stage</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                      {evaluationResult.preeclampsiaSeverity}
                    </div>
                  </div>
                  <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: evaluationResult.hellpClass.includes('CLASS_1') ? '#7f1d1d' : evaluationResult.hellpClass.includes('CLASS_2') ? '#78350f' : '#0f172a', border: '1px solid #475569' }}>
                    <div style={{ fontSize: '11px', color: '#cbd5e1', textTransform: 'uppercase', fontWeight: 600 }}>HELLP Syndrome Status</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: evaluationResult.hellpClass === 'NO_HELLP' ? '#10b981' : '#f87171', marginTop: '2px' }}>
                      {evaluationResult.hellpClass}
                    </div>
                  </div>
                </div>

                {/* Swansea Alert */}
                {evaluationResult.aflpSuspected && (
                  <div style={{ padding: '12px', backgroundColor: '#7f1d1d', border: '1px solid #ef4444', borderRadius: '6px' }}>
                    <div style={{ fontWeight: 700, color: '#fecaca', fontSize: '14px' }}>⚠️ SWANSEA CRITERIA MET (Score {evaluationResult.swanseaAflpScore}/14)</div>
                    <div style={{ fontSize: '13px', color: '#f8fafc', marginTop: '4px' }}>
                      Acute Fatty Liver of Pregnancy (AFLP) suspected. Risk of fulminant hepatic necrosis, profound hypoglycemia, and DIC. Immediate ICU care & delivery indicated.
                    </div>
                  </div>
                )}

                {/* Emergency Antihypertensive Plan */}
                <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '6px', border: '1px solid #334155' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#f59e0b' }}>💊 Emergency Antihypertensive Protocol</span>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: evaluationResult.emergencyAntihypertensivePlan.indicated ? '#dc2626' : '#059669', color: '#f8fafc', fontWeight: 600 }}>
                      {evaluationResult.emergencyAntihypertensivePlan.indicated ? 'TREATMENT MANDATORY' : 'NOT INDICATED'}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#cbd5e1', marginBottom: '6px' }}>
                    <strong>First-Line Drug:</strong> <span style={{ color: '#38bdf8' }}>{evaluationResult.emergencyAntihypertensivePlan.firstLineDrug}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#cbd5e1', marginBottom: '6px' }}>
                    <strong>Target BP:</strong> {evaluationResult.emergencyAntihypertensivePlan.targetBp}
                  </div>
                  <div style={{ marginTop: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Dosing Ladder:</span>
                    <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: '12px', color: '#f1f5f9' }}>
                      {evaluationResult.emergencyAntihypertensivePlan.dosingRoadmap.map((step, idx) => (
                        <li key={idx} style={{ marginBottom: '4px' }}>{step}</li>
                      ))}
                    </ul>
                  </div>
                  {evaluationResult.emergencyAntihypertensivePlan.contraindicatedAgents.length > 0 && (
                    <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#450a0a', borderRadius: '4px', fontSize: '12px', color: '#fca5a5' }}>
                      {evaluationResult.emergencyAntihypertensivePlan.contraindicatedAgents.join('; ')}
                    </div>
                  )}
                </div>

                {/* MgSO4 Plan */}
                <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '6px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#f59e0b', marginBottom: '8px' }}>
                    ⚡ Magnesium Sulfate Seizure Prophylaxis
                  </div>
                  <div style={{ fontSize: '12px', color: '#cbd5e1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div><strong>Loading Dose:</strong> {evaluationResult.mgso4Plan.loadingDose}</div>
                    <div><strong>Maintenance:</strong> {evaluationResult.mgso4Plan.maintenanceInfusion}</div>
                    <div><strong>Recurrent Seizure:</strong> {evaluationResult.mgso4Plan.recurrentSeizureDose}</div>
                    <div style={{ color: '#f87171' }}><strong>Bedside Antidote:</strong> {evaluationResult.mgso4Plan.antidoteOrder}</div>
                  </div>
                </div>

                {/* Delivery Timing */}
                <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '6px', border: '1px solid #334155' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#f59e0b' }}>👶 Delivery Timing & Corticosteroids</span>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: evaluationResult.deliveryTimingGuidance.urgency === 'EMERGENT_STAT' ? '#dc2626' : '#d97706', color: '#fff', fontWeight: 600 }}>
                      {evaluationResult.deliveryTimingGuidance.urgency}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#f1f5f9' }}>
                    {evaluationResult.deliveryTimingGuidance.recommendation}
                  </div>
                </div>

                {/* Directives List */}
                <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '6px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>Protocol Directives:</div>
                  <ul style={{ margin: '0 0 0 16px', padding: 0, fontSize: '12px', color: '#cbd5e1' }}>
                    {evaluationResult.protocolDirectives.map((d, i) => (
                      <li key={i} style={{ marginBottom: '4px' }}>{d}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div style={{ color: '#94a3b8', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>
                Complete clinical assessment inputs and click "Evaluate Preeclampsia" to compute severity, HELLP class, and antihypertensive roadmap.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: MAGNESIUM SURVEILLANCE */}
      {activeTab === 'magnesium' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div style={{ backgroundColor: '#1e293b', borderRadius: '8px', padding: '20px', border: '1px solid #334155' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: 0, marginBottom: '16px', color: '#f8fafc', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
              Hourly MgSO4 Toxicity & Surveillance Monitor
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Hours on MgSO4 Infusion</label>
                <input
                  type="number"
                  value={hoursOnMgso4}
                  onChange={(e) => setHoursOnMgso4(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Current Infusion Rate (g/h)</label>
                <input
                  type="number"
                  step="0.5"
                  value={currentInfusionRateGH}
                  onChange={(e) => setCurrentInfusionRateGH(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Serum Magnesium (mg/dL)</label>
                <input
                  type="number"
                  step="0.1"
                  value={serumMagnesiumMgDl}
                  onChange={(e) => setSerumMagnesiumMgDl(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Patellar Reflex Intact</label>
                <select
                  value={patellarReflexIntact ? 'true' : 'false'}
                  onChange={(e) => setPatellarReflexIntact(e.target.value === 'true')}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                >
                  <option value="true">Intact (+2)</option>
                  <option value="false">Absent / Depressed (Loss of DTR)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Respiratory Rate (/min)</label>
                <input
                  type="number"
                  value={respiratoryRate}
                  onChange={(e) => setRespiratoryRate(parseInt(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Hourly Urine Output (mL/h)</label>
                <input
                  type="number"
                  value={hourlyUrineOutputMl}
                  onChange={(e) => setHourlyUrineOutputMl(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
            </div>

            <button
              onClick={handleLogMagnesium}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#f59e0b',
                color: '#0f172a',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 700,
                fontSize: '15px',
                cursor: 'pointer'
              }}
            >
              {isLoading ? 'Analyzing Toxicity...' : '🧪 Log Surveillance & Validate Safe Clearance'}
            </button>
          </div>

          <div style={{ backgroundColor: '#1e293b', borderRadius: '8px', padding: '20px', border: '1px solid #334155' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: 0, marginBottom: '16px', color: '#f8fafc', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
              Toxicity Feedback & Titration Directive
            </h2>

            {magnesiumResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: magnesiumResult.toxicityFlag === 'RESPIRATORY_DEPRESSION' ? '#7f1d1d' : magnesiumResult.toxicityFlag !== 'NONE_THERAPEUTIC' ? '#78350f' : '#14532d' }}>
                    <div style={{ fontSize: '11px', color: '#cbd5e1', textTransform: 'uppercase', fontWeight: 600 }}>Toxicity Status</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                      {magnesiumResult.toxicityFlag}
                    </div>
                  </div>
                  <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: magnesiumResult.titrationAction === 'STAT_CALCIUM_GLUCONATE' ? '#7f1d1d' : magnesiumResult.titrationAction === 'HOLD_AND_REDUCE' ? '#78350f' : '#0f172a', border: '1px solid #475569' }}>
                    <div style={{ fontSize: '11px', color: '#cbd5e1', textTransform: 'uppercase', fontWeight: 600 }}>Titration Action</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: magnesiumResult.titrationAction === 'MAINTAIN' ? '#10b981' : '#f59e0b', marginTop: '2px' }}>
                      {magnesiumResult.titrationAction}
                    </div>
                  </div>
                </div>

                <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '6px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#f59e0b', marginBottom: '6px' }}>Clinical Directive:</div>
                  <div style={{ fontSize: '13px', color: '#f1f5f9', lineHeight: 1.5 }}>
                    {magnesiumResult.clinicalDirective}
                  </div>
                </div>

                <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '6px', border: '1px solid #334155', fontSize: '12px', color: '#94a3b8' }}>
                  <div style={{ fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>Magnesium Toxicity Milestones:</div>
                  <div>• 4.8 - 8.4 mg/dL: Therapeutic anticonvulsant level</div>
                  <div>• 9 - 12 mg/dL: Loss of deep tendon patellar reflexes</div>
                  <div>• 12 - 15 mg/dL: Respiratory depression (RR &lt; 12)</div>
                  <div>• &gt; 15 - 20 mg/dL: Cardiac arrest & SA/AV nodal block</div>
                </div>
              </div>
            ) : (
              <div style={{ color: '#94a3b8', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>
                Log hourly magnesium surveillance data to check patellar reflexes, respiratory rate, and urine output thresholds.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: HISTORY */}
      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Evaluations History */}
          <div style={{ backgroundColor: '#1e293b', borderRadius: '8px', padding: '20px', border: '1px solid #334155' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: 0, marginBottom: '16px', color: '#f8fafc', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
              Past Preeclampsia & HELLP Evaluations
            </h2>
            {evalHistory.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: '14px' }}>No preeclampsia evaluations on record for Patient #{patientId}.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>Encounter</th>
                      <th style={{ padding: '8px' }}>GA</th>
                      <th style={{ padding: '8px' }}>BP (mmHg)</th>
                      <th style={{ padding: '8px' }}>Severity</th>
                      <th style={{ padding: '8px' }}>HELLP</th>
                      <th style={{ padding: '8px' }}>Swansea AFLP</th>
                      <th style={{ padding: '8px' }}>Antihypertensive</th>
                      <th style={{ padding: '8px' }}>Evaluated At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evalHistory.map((row) => (
                      <tr key={row.id} style={{ borderBottom: '1px solid #1e293b' }}>
                        <td style={{ padding: '8px', fontWeight: 600 }}>#{row.id}</td>
                        <td style={{ padding: '8px' }}>{row.gestational_age_weeks}w</td>
                        <td style={{ padding: '8px', color: row.severe_hypertension ? '#ef4444' : '#f8fafc' }}>
                          {row.systolic_bp}/{row.diastolic_bp}
                        </td>
                        <td style={{ padding: '8px', color: row.preeclampsia_severity.includes('SEVERE') ? '#f59e0b' : '#94a3b8' }}>
                          {row.preeclampsia_severity}
                        </td>
                        <td style={{ padding: '8px', color: row.hellp_class === 'NO_HELLP' ? '#10b981' : '#f87171' }}>
                          {row.hellp_class}
                        </td>
                        <td style={{ padding: '8px' }}>{row.swansea_aflp_score}/14</td>
                        <td style={{ padding: '8px' }}>{row.recommended_antihypertensive}</td>
                        <td style={{ padding: '8px', color: '#94a3b8' }}>{new Date(row.evaluated_at).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Magnesium Surveillance History */}
          <div style={{ backgroundColor: '#1e293b', borderRadius: '8px', padding: '20px', border: '1px solid #334155' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: 0, marginBottom: '16px', color: '#f8fafc', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
              Hourly Magnesium Surveillance Logs
            </h2>
            {magLogsHistory.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: '14px' }}>No magnesium surveillance logs on record for Patient #{patientId}.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>Hours</th>
                      <th style={{ padding: '8px' }}>Rate (g/h)</th>
                      <th style={{ padding: '8px' }}>Mg (mg/dL)</th>
                      <th style={{ padding: '8px' }}>Reflexes</th>
                      <th style={{ padding: '8px' }}>RR (/min)</th>
                      <th style={{ padding: '8px' }}>UO (mL/h)</th>
                      <th style={{ padding: '8px' }}>Toxicity Flag</th>
                      <th style={{ padding: '8px' }}>Action</th>
                      <th style={{ padding: '8px' }}>Logged At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {magLogsHistory.map((log) => (
                      <tr key={log.id} style={{ borderBottom: '1px solid #1e293b' }}>
                        <td style={{ padding: '8px', fontWeight: 600 }}>{log.hours_on_mgso4}h</td>
                        <td style={{ padding: '8px' }}>{log.current_infusion_rate_g_h}</td>
                        <td style={{ padding: '8px' }}>{log.serum_magnesium_mg_dl || 'N/A'}</td>
                        <td style={{ padding: '8px', color: log.patellar_reflex_intact ? '#10b981' : '#ef4444' }}>
                          {log.patellar_reflex_intact ? 'Intact' : 'Loss'}
                        </td>
                        <td style={{ padding: '8px', color: log.respiratory_rate < 12 ? '#ef4444' : '#f8fafc' }}>
                          {log.respiratory_rate}
                        </td>
                        <td style={{ padding: '8px', color: log.hourly_urine_output_ml < 30 ? '#ef4444' : '#f8fafc' }}>
                          {log.hourly_urine_output_ml}
                        </td>
                        <td style={{ padding: '8px', color: log.toxicity_flag === 'NONE_THERAPEUTIC' ? '#10b981' : '#f59e0b' }}>
                          {log.toxicity_flag}
                        </td>
                        <td style={{ padding: '8px', fontWeight: 600 }}>{log.titration_action}</td>
                        <td style={{ padding: '8px', color: '#94a3b8' }}>{new Date(log.logged_at).toLocaleTimeString()}</td>
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
