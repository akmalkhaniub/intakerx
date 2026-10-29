import React, { useState, useEffect } from 'react';

interface UterotonicStep {
  agent: string;
  dose: string;
  route: string;
  contraindicated: boolean;
  reason?: string;
}

interface PphEvaluationResult {
  patientId: number;
  deliveryMode: 'VAGINAL' | 'CESAREAN';
  qblMl: number;
  heartRate: number;
  systolicBp: number;
  diastolicBp: number;
  shockIndex: number;
  shockIndexElevated: boolean;
  pphStage: string;
  etiology: string;
  atonyPresent: boolean;
  accretaSuspected: boolean;
  pasRiskPercentage: number;
  uterotonicCascade: {
    firstLine: string;
    orderedLadder: UterotonicStep[];
    activeWarning?: string;
  };
  txaGuidance: {
    indicated: boolean;
    withinWindow: boolean;
    dose: string;
    repeatDoseProtocol: string;
    cautionNote: string;
  };
  bakriBalloonGuidance: {
    indicated: boolean;
    targetVolumeMl: string;
    tamponadeTestCriteria: string;
    concomitantAction: string;
  };
  mtpAndSurgicalPlan: {
    mtpActivated: boolean;
    ratioProtocol: string;
    surgicalInterventions: string[];
  };
  protocolDirectives: string[];
  clinicalSummary: string;
}

interface UterotonicLogResult {
  patientId: number;
  encounterId?: number;
  agent: string;
  dose: string;
  route: string;
  cumulativeDose: string;
  responseObserved: string;
  nextStepAction: string;
  clinicalFeedback: string;
}

export const ObHemorrhageHub: React.FC = () => {
  const [patientId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'evaluator' | 'uterotonics' | 'history'>('evaluator');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Tab 1: Evaluator State
  const [deliveryMode, setDeliveryMode] = useState<'VAGINAL' | 'CESAREAN'>('VAGINAL');
  const [qblMl, setQblMl] = useState<number>(1200);
  const [heartRate, setHeartRate] = useState<number>(115);
  const [systolicBp, setSystolicBp] = useState<number>(92);
  const [diastolicBp, setDiastolicBp] = useState<number>(58);
  const [minutesPostpartum, setMinutesPostpartum] = useState<number>(35);
  const [fundusBoggyOrAtonic, setFundusBoggyOrAtonic] = useState<boolean>(true);
  const [hasHypertensionOrPreeclampsia, setHasHypertensionOrPreeclampsia] = useState<boolean>(false);
  const [hasAsthmaOrBronchospasm, setHasAsthmaOrBronchospasm] = useState<boolean>(false);
  const [suspectedPlacentaAccreta, setSuspectedPlacentaAccreta] = useState<boolean>(false);
  const [priorCesareansCount, setPriorCesareansCount] = useState<number>(0);
  const [placentaPreviaPresent, setPlacentaPreviaPresent] = useState<boolean>(false);
  const [suspectedGenitalTrauma, setSuspectedGenitalTrauma] = useState<boolean>(false);
  const [activeTransfusionUnitsPrbc, setActiveTransfusionUnitsPrbc] = useState<number>(0);
  const [fibrinogenMgDl, setFibrinogenMgDl] = useState<number>(240);

  const [evaluationResult, setEvaluationResult] = useState<PphEvaluationResult | null>(null);

  // Tab 2: Uterotonic Administration State
  const [logAgent, setLogAgent] = useState<string>('OXYTOCIN');
  const [logDose, setLogDose] = useState<string>('30 units in 500 mL NS');
  const [logRoute, setLogRoute] = useState<string>('IV Infusion');
  const [logCumulativeDose, setLogCumulativeDose] = useState<string>('30 units');
  const [logResponse, setLogResponse] = useState<string>('ONGOING_ATONY');
  const [uterotonicResult, setUterotonicResult] = useState<UterotonicLogResult | null>(null);

  // Tab 3: History State
  const [encountersHistory, setEncountersHistory] = useState<any[]>([]);
  const [uterotonicLogsHistory, setUterotonicLogsHistory] = useState<any[]>([]);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const headers = { Authorization: `Bearer ${token}` };

      const [encRes, logRes] = await Promise.all([
        fetch(`/api/clinician/obhemorrhage/encounters/${patientId}`, { headers }),
        fetch(`/api/clinician/obhemorrhage/uterotonic-logs/${patientId}`, { headers })
      ]);

      if (encRes.ok) {
        setEncountersHistory(await encRes.json());
      }
      if (logRes.ok) {
        setUterotonicLogsHistory(await logRes.json());
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
      const body = {
        patientId,
        deliveryMode,
        qblMl,
        heartRate,
        systolicBp,
        diastolicBp,
        minutesPostpartum,
        fundusBoggyOrAtonic,
        suspectedPlacentaAccreta,
        priorCesareansCount,
        placentaPreviaPresent,
        suspectedGenitalTrauma,
        hasHypertensionOrPreeclampsia,
        hasAsthmaOrBronchospasm,
        activeTransfusionUnitsPrbc,
        fibrinogenMgDl
      };

      const res = await fetch('/api/clinician/obhemorrhage/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to evaluate obstetric hemorrhage.');
      }

      const data = await res.json();
      setEvaluationResult(data.evaluation);
      setStatusMessage('Obstetric Hemorrhage staged and cascade generated.');
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogUterotonic = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const body = {
        patientId,
        agent: logAgent,
        dose: logDose,
        route: logRoute,
        cumulativeDose: logCumulativeDose,
        responseObserved: logResponse
      };

      const res = await fetch('/api/clinician/obhemorrhage/uterotonic/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to log uterotonic administration.');
      }

      const data = await res.json();
      setUterotonicResult(data.uterotonicLog);
      setStatusMessage('Uterotonic response analyzed.');
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
            <span style={{ fontSize: '32px' }}>🩸</span>
            <div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#e11d48', letterSpacing: '-0.02em' }}>
                OB-HEMORRHAGE
              </h1>
              <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '14px' }}>
                Postpartum Hemorrhage QBL Staging, Placenta Accreta Spectrum & Uterotonic Cascade Sentinel
              </p>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ display: 'inline-block', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, backgroundColor: '#881337', color: '#fecdd3' }}>
            PHASE 98 ACTIVE
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
            backgroundColor: activeTab === 'evaluator' ? '#e11d48' : '#1e293b',
            color: activeTab === 'evaluator' ? '#ffffff' : '#94a3b8'
          }}
        >
          🩸 QBL Staging & Uterotonic Cascade
        </button>
        <button
          onClick={() => setActiveTab('uterotonics')}
          style={{
            padding: '10px 18px',
            borderRadius: '6px',
            border: 'none',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            backgroundColor: activeTab === 'uterotonics' ? '#e11d48' : '#1e293b',
            color: activeTab === 'uterotonics' ? '#ffffff' : '#94a3b8'
          }}
        >
          💉 Uterotonic & Adverse Response Sentinel
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
            backgroundColor: activeTab === 'history' ? '#e11d48' : '#1e293b',
            color: activeTab === 'history' ? '#ffffff' : '#94a3b8'
          }}
        >
          📋 Resuscitation History
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
              Quantitative Blood Loss (QBL) & Hemodynamic Status
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Delivery Mode</label>
                <select
                  value={deliveryMode}
                  onChange={(e) => setDeliveryMode(e.target.value as any)}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                >
                  <option value="VAGINAL">Vaginal Delivery (Normal &le; 500 mL)</option>
                  <option value="CESAREAN">Cesarean Delivery (Normal &le; 1000 mL)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Quantitative Blood Loss (QBL mL)</label>
                <input
                  type="number"
                  value={qblMl}
                  onChange={(e) => setQblMl(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '2px' }}>Heart Rate (bpm)</label>
                <input
                  type="number"
                  value={heartRate}
                  onChange={(e) => setHeartRate(parseInt(e.target.value) || 0)}
                  style={{ width: '100%', padding: '6px 10px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '2px' }}>Systolic BP (mmHg)</label>
                <input
                  type="number"
                  value={systolicBp}
                  onChange={(e) => setSystolicBp(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '6px 10px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '2px' }}>Diastolic BP (mmHg)</label>
                <input
                  type="number"
                  value={diastolicBp}
                  onChange={(e) => setDiastolicBp(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '6px 10px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc', fontSize: '13px' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Minutes Postpartum</label>
                <input
                  type="number"
                  value={minutesPostpartum}
                  onChange={(e) => setMinutesPostpartum(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Uterine Tone</label>
                <select
                  value={fundusBoggyOrAtonic ? 'true' : 'false'}
                  onChange={(e) => setFundusBoggyOrAtonic(e.target.value === 'true')}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                >
                  <option value="true">Boggy / Atonic Uterus (Primary 4T Tone)</option>
                  <option value="false">Firm / Contracted Uterus</option>
                </select>
              </div>
            </div>

            {/* Contraindication Flags */}
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#e11d48', margin: '16px 0 8px 0' }}>
              Uterotonic Contraindication Safety Watchdog
            </h3>
            <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#fca5a5', cursor: 'pointer' }}>
                <input type="checkbox" checked={hasHypertensionOrPreeclampsia} onChange={(e) => setHasHypertensionOrPreeclampsia(e.target.checked)} />
                Hypertension / Preeclampsia / SBP &ge; 140 (CONTRAINDICATES METHERGINE)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#fca5a5', cursor: 'pointer' }}>
                <input type="checkbox" checked={hasAsthmaOrBronchospasm} onChange={(e) => setHasAsthmaOrBronchospasm(e.target.checked)} />
                Asthma / Active Bronchospasm (CONTRAINDICATES CARBOPROST / HEMABATE)
              </label>
            </div>

            {/* Placenta Accreta Spectrum (PAS) */}
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#f59e0b', margin: '16px 0 8px 0' }}>
              Placenta Accreta Spectrum (PAS) Risk Modifiers
            </h3>
            <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #334155', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '2px' }}>Prior Cesareans</label>
                <select
                  value={priorCesareansCount}
                  onChange={(e) => setPriorCesareansCount(parseInt(e.target.value) || 0)}
                  style={{ width: '100%', padding: '6px 10px', backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '4px', color: '#f8fafc', fontSize: '13px' }}
                >
                  <option value={0}>0 Prior Cesareans</option>
                  <option value={1}>1 Prior Cesarean</option>
                  <option value={2}>2 Prior Cesareans (40% if previa)</option>
                  <option value={3}>3+ Prior Cesareans (61% if previa)</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', marginBottom: '4px' }}>
                  <input type="checkbox" checked={placentaPreviaPresent} onChange={(e) => setPlacentaPreviaPresent(e.target.checked)} />
                  Placenta Previa Present
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={suspectedPlacentaAccreta} onChange={(e) => setSuspectedPlacentaAccreta(e.target.checked)} />
                  Suspected Morbidly Adherent
                </label>
              </div>
            </div>

            {/* Other etiologies & labs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '2px' }}>Fibrinogen (mg/dL)</label>
                <input
                  type="number"
                  value={fibrinogenMgDl}
                  onChange={(e) => setFibrinogenMgDl(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '6px 10px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '2px' }}>PRBC Units Transfused</label>
                <input
                  type="number"
                  value={activeTransfusionUnitsPrbc}
                  onChange={(e) => setActiveTransfusionUnitsPrbc(parseInt(e.target.value) || 0)}
                  style={{ width: '100%', padding: '6px 10px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc', fontSize: '13px' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input type="checkbox" checked={suspectedGenitalTrauma} onChange={(e) => setSuspectedGenitalTrauma(e.target.checked)} />
                Suspected Genital Laceration / Cervical Tear / Expanding Hematoma
              </label>
            </div>

            <button
              onClick={handleEvaluate}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#e11d48',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 700,
                fontSize: '15px',
                cursor: 'pointer'
              }}
            >
              {isLoading ? 'Staging Hemorrhage...' : '🚀 Evaluate PPH Staging, Uterotonics & TXA Protocol'}
            </button>
          </div>

          {/* Results Panel */}
          <div style={{ backgroundColor: '#1e293b', borderRadius: '8px', padding: '20px', border: '1px solid #334155' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: 0, marginBottom: '16px', color: '#f8fafc', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
              Hemorrhage Severity Synthesis & Intervention Roadmap
            </h2>

            {evaluationResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Stage & Shock Index Badges */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: evaluationResult.pphStage.includes('STAGE_3') ? '#881337' : evaluationResult.pphStage.includes('STAGE_2') ? '#7c2d12' : evaluationResult.pphStage.includes('STAGE_1') ? '#713f12' : '#14532d' }}>
                    <div style={{ fontSize: '11px', color: '#cbd5e1', textTransform: 'uppercase', fontWeight: 600 }}>PPH Stage</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                      {evaluationResult.pphStage}
                    </div>
                  </div>
                  <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: evaluationResult.shockIndexElevated ? '#881337' : '#0f172a', border: '1px solid #475569' }}>
                    <div style={{ fontSize: '11px', color: '#cbd5e1', textTransform: 'uppercase', fontWeight: 600 }}>Shock Index (HR / SBP)</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: evaluationResult.shockIndexElevated ? '#f87171' : '#10b981', marginTop: '2px' }}>
                      {evaluationResult.shockIndex} {evaluationResult.shockIndexElevated ? '(&ge; 0.9 CRITICAL)' : '(Normal)'}
                    </div>
                  </div>
                </div>

                {/* PAS Risk Alert */}
                {evaluationResult.pasRiskPercentage > 0 && (
                  <div style={{ padding: '12px', backgroundColor: evaluationResult.pasRiskPercentage >= 40 ? '#881337' : '#7c2d12', border: '1px solid #f43f5e', borderRadius: '6px' }}>
                    <div style={{ fontWeight: 700, color: '#fecdd3', fontSize: '14px' }}>
                      ⚠️ PLACENTA ACCRETA SPECTRUM (PAS) RISK: {evaluationResult.pasRiskPercentage}%
                    </div>
                    <div style={{ fontSize: '13px', color: '#f8fafc', marginTop: '4px' }}>
                      Placenta previa in setting of prior cesarean. Strict directive: DO NOT peel or attempt manual extraction. Prepare for peripartum hysterectomy & cell salvage.
                    </div>
                  </div>
                )}

                {/* Stepped Uterotonic Cascade */}
                <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '6px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#e11d48', marginBottom: '8px' }}>
                    💊 Stepped Uterotonic Cascade
                  </div>
                  {evaluationResult.uterotonicCascade.activeWarning && (
                    <div style={{ padding: '8px 12px', backgroundColor: '#7f1d1d', border: '1px solid #ef4444', borderRadius: '4px', fontSize: '12px', color: '#fecaca', marginBottom: '10px' }}>
                      ⚠️ {evaluationResult.uterotonicCascade.activeWarning}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {evaluationResult.uterotonicCascade.orderedLadder.map((step, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '6px',
                          backgroundColor: step.contraindicated ? '#450a0a' : '#1e293b',
                          border: step.contraindicated ? '1px solid #ef4444' : '1px solid #334155',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13px', color: step.contraindicated ? '#f87171' : '#f8fafc' }}>
                            {idx + 1}. {step.agent}
                          </div>
                          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                            {step.dose} ({step.route})
                          </div>
                          {step.reason && (
                            <div style={{ fontSize: '11px', color: '#fca5a5', marginTop: '4px', fontWeight: 600 }}>
                              🚫 {step.reason}
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: step.contraindicated ? '#ef4444' : '#059669', color: '#ffffff', fontWeight: 600 }}>
                          {step.contraindicated ? 'CONTRAINDICATED' : 'SAFE'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tranexamic Acid (TXA) Protocol */}
                <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '6px', border: '1px solid #334155' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#e11d48' }}>🧪 WOMAN Trial Tranexamic Acid (TXA)</span>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: evaluationResult.txaGuidance.withinWindow ? '#059669' : '#dc2626', color: '#fff', fontWeight: 600 }}>
                      {evaluationResult.txaGuidance.withinWindow ? 'WITHIN 3H WINDOW' : '>3H POSTPARTUM'}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#f8fafc', marginBottom: '4px' }}>
                    <strong>Dose:</strong> {evaluationResult.txaGuidance.dose}
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                    <strong>Repeat Protocol:</strong> {evaluationResult.txaGuidance.repeatDoseProtocol}
                  </div>
                  <div style={{ fontSize: '12px', color: '#cbd5e1', fontStyle: 'italic' }}>
                    {evaluationResult.txaGuidance.cautionNote}
                  </div>
                </div>

                {/* Bakri Balloon & Tamponade Test */}
                <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '6px', border: '1px solid #334155' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#e11d48' }}>🎈 Intrauterine Bakri Balloon Tamponade</span>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: evaluationResult.bakriBalloonGuidance.indicated ? '#059669' : '#475569', color: '#fff', fontWeight: 600 }}>
                      {evaluationResult.bakriBalloonGuidance.indicated ? 'INDICATED' : 'NOT INDICATED'}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
                    <div><strong>Target Volume:</strong> {evaluationResult.bakriBalloonGuidance.targetVolumeMl}</div>
                    <div style={{ marginTop: '4px' }}><strong>Tamponade Test:</strong> {evaluationResult.bakriBalloonGuidance.tamponadeTestCriteria}</div>
                    <div style={{ marginTop: '4px' }}><strong>Foley & Packing:</strong> {evaluationResult.bakriBalloonGuidance.concomitantAction}</div>
                  </div>
                </div>

                {/* MTP & Surgical Plan */}
                {evaluationResult.mtpAndSurgicalPlan.mtpActivated && (
                  <div style={{ backgroundColor: '#450a0a', padding: '16px', borderRadius: '6px', border: '1px solid #ef4444' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#fecaca', marginBottom: '6px' }}>
                      🚨 Massive Transfusion Protocol (MTP) Active
                    </div>
                    <div style={{ fontSize: '12px', color: '#f8fafc', marginBottom: '8px' }}>
                      {evaluationResult.mtpAndSurgicalPlan.ratioProtocol}
                    </div>
                    <div style={{ fontSize: '12px', color: '#fca5a5', fontWeight: 600 }}>Surgical Escalations:</div>
                    <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: '12px', color: '#fee2e2' }}>
                      {evaluationResult.mtpAndSurgicalPlan.surgicalInterventions.map((s, idx) => (
                        <li key={idx} style={{ marginBottom: '2px' }}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Directives */}
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
                Enter delivery mode, quantitative blood loss (QBL), and vital signs to stage postpartum hemorrhage and synthesize the uterotonic ladder.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: UTEROTONICS LOG */}
      {activeTab === 'uterotonics' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div style={{ backgroundColor: '#1e293b', borderRadius: '8px', padding: '20px', border: '1px solid #334155' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: 0, marginBottom: '16px', color: '#f8fafc', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
              Log Uterotonic Administration & Check Response
            </h2>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Uterotonic Agent</label>
              <select
                value={logAgent}
                onChange={(e) => setLogAgent(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
              >
                <option value="OXYTOCIN">Oxytocin (Pitocin)</option>
                <option value="METHERGINE">Methylergonovine (Methergine)</option>
                <option value="CARBOPROST_HEMABATE">15-methyl PGF2α (Carboprost / Hemabate)</option>
                <option value="MISOPROSTOL">Misoprostol (Cytotec)</option>
                <option value="TRANEXAMIC_ACID">Tranexamic Acid (TXA)</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Dose Administered</label>
                <input
                  type="text"
                  value={logDose}
                  onChange={(e) => setLogDose(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Route</label>
                <input
                  type="text"
                  value={logRoute}
                  onChange={(e) => setLogRoute(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Cumulative Dose</label>
                <input
                  type="text"
                  value={logCumulativeDose}
                  onChange={(e) => setLogCumulativeDose(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Response Observed</label>
                <select
                  value={logResponse}
                  onChange={(e) => setLogResponse(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                >
                  <option value="ONGOING_ATONY">Ongoing Atony / Bleeding Continues</option>
                  <option value="ATONY_RESOLVED">Atony Resolved / Uterus Firm</option>
                  <option value="ADVERSE_HYPERTENSION">Adverse Hypertensive Surge (Ergot Vasospasm)</option>
                  <option value="ADVERSE_BRONCHOSPASM">Adverse Bronchospasm (Prostaglandin Constriction)</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleLogUterotonic}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#e11d48',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 700,
                fontSize: '15px',
                cursor: 'pointer'
              }}
            >
              {isLoading ? 'Analyzing Response...' : '💉 Record Administration & Check Escalation Directive'}
            </button>
          </div>

          <div style={{ backgroundColor: '#1e293b', borderRadius: '8px', padding: '20px', border: '1px solid #334155' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: 0, marginBottom: '16px', color: '#f8fafc', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
              Escalation Feedback & Safety Directives
            </h2>

            {uterotonicResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: uterotonicResult.responseObserved.startsWith('ADVERSE') ? '#881337' : uterotonicResult.responseObserved === 'ATONY_RESOLVED' ? '#14532d' : '#7c2d12' }}>
                  <div style={{ fontSize: '11px', color: '#cbd5e1', textTransform: 'uppercase', fontWeight: 600 }}>Response Status</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                    {uterotonicResult.responseObserved}
                  </div>
                </div>

                <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '6px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#e11d48', marginBottom: '6px' }}>Next Step Action:</div>
                  <div style={{ fontSize: '13px', color: '#f1f5f9', lineHeight: 1.5 }}>
                    {uterotonicResult.nextStepAction}
                  </div>
                </div>

                <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '6px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>Clinical Feedback:</div>
                  <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5 }}>
                    {uterotonicResult.clinicalFeedback}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ color: '#94a3b8', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>
                Select an administered uterotonic agent and observe uterine tone or adverse reactions to generate next-step escalation guidance.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: HISTORY */}
      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Encounters History */}
          <div style={{ backgroundColor: '#1e293b', borderRadius: '8px', padding: '20px', border: '1px solid #334155' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: 0, marginBottom: '16px', color: '#f8fafc', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
              Past Obstetric Hemorrhage Evaluations
            </h2>
            {encountersHistory.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: '14px' }}>No hemorrhage evaluations on record for Patient #{patientId}.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>Encounter</th>
                      <th style={{ padding: '8px' }}>Mode</th>
                      <th style={{ padding: '8px' }}>QBL (mL)</th>
                      <th style={{ padding: '8px' }}>Shock Index</th>
                      <th style={{ padding: '8px' }}>Stage</th>
                      <th style={{ padding: '8px' }}>Etiology</th>
                      <th style={{ padding: '8px' }}>MTP</th>
                      <th style={{ padding: '8px' }}>Evaluated At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {encountersHistory.map((row) => (
                      <tr key={row.id} style={{ borderBottom: '1px solid #1e293b' }}>
                        <td style={{ padding: '8px', fontWeight: 600 }}>#{row.id}</td>
                        <td style={{ padding: '8px' }}>{row.delivery_mode}</td>
                        <td style={{ padding: '8px', color: row.qbl_ml > 1000 ? '#ef4444' : '#f8fafc', fontWeight: 600 }}>
                          {row.qbl_ml} mL
                        </td>
                        <td style={{ padding: '8px', color: row.vital_shock_index >= 0.9 ? '#ef4444' : '#10b981' }}>
                          {row.vital_shock_index}
                        </td>
                        <td style={{ padding: '8px', color: row.pph_stage.includes('STAGE_3') ? '#ef4444' : '#f59e0b' }}>
                          {row.pph_stage}
                        </td>
                        <td style={{ padding: '8px' }}>{row.etiology_category}</td>
                        <td style={{ padding: '8px', color: row.mtp_activated ? '#ef4444' : '#94a3b8', fontWeight: 600 }}>
                          {row.mtp_activated ? 'ACTIVE' : 'No'}
                        </td>
                        <td style={{ padding: '8px', color: '#94a3b8' }}>{new Date(row.evaluated_at).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Uterotonic Logs History */}
          <div style={{ backgroundColor: '#1e293b', borderRadius: '8px', padding: '20px', border: '1px solid #334155' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: 0, marginBottom: '16px', color: '#f8fafc', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
              Uterotonic Administration Logs
            </h2>
            {uterotonicLogsHistory.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: '14px' }}>No uterotonic logs on record for Patient #{patientId}.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>Log #</th>
                      <th style={{ padding: '8px' }}>Agent</th>
                      <th style={{ padding: '8px' }}>Route & Dose</th>
                      <th style={{ padding: '8px' }}>Cumulative</th>
                      <th style={{ padding: '8px' }}>Response</th>
                      <th style={{ padding: '8px' }}>Next Action</th>
                      <th style={{ padding: '8px' }}>Administered At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uterotonicLogsHistory.map((log) => (
                      <tr key={log.id} style={{ borderBottom: '1px solid #1e293b' }}>
                        <td style={{ padding: '8px', fontWeight: 600 }}>#{log.id}</td>
                        <td style={{ padding: '8px', color: '#38bdf8' }}>{log.agent_administered}</td>
                        <td style={{ padding: '8px' }}>{log.route_and_dosage}</td>
                        <td style={{ padding: '8px' }}>{log.cumulative_dose}</td>
                        <td style={{ padding: '8px', color: log.response_observed === 'ATONY_RESOLVED' ? '#10b981' : log.response_observed.startsWith('ADVERSE') ? '#ef4444' : '#f59e0b', fontWeight: 600 }}>
                          {log.response_observed}
                        </td>
                        <td style={{ padding: '8px', fontSize: '12px' }}>{log.next_step_action}</td>
                        <td style={{ padding: '8px', color: '#94a3b8' }}>{new Date(log.administered_at).toLocaleTimeString()}</td>
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
