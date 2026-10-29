import React, { useState, useEffect } from 'react';

interface PMCSGuidance {
  indicated: boolean;
  countdownMinutesToIncision: number;
  countdownMinutesToDelivery: number;
  actionRequired: 'PREPARE_BEDSIDE_TRAY' | 'STAT_PMCS_INCISION_NOW' | 'CONTINUE_RESUSCITATION_POST_DELIVERY' | 'NOT_INDICATED_PREVIABLE';
  locationDirective: string;
  rationale: string;
}

interface AokPlan {
  indicated: boolean;
  atropineDose: string;
  ondansetronDose: string;
  ketorolacDose: string;
  rvProtectiveDirectives: string[];
}

interface CoagulopathyPlan {
  dicSuspected: boolean;
  cryoprecipitateRecommended: boolean;
  targetFibrinogenMgDl: number;
  txaRecommended: boolean;
  transfusionDirectives: string[];
}

interface MaternalCodeEvaluationResult {
  patientId: number;
  gestationalAgeWeeks: number;
  fundalHeightCm?: number;
  arrestRhythm: string;
  etiologySuspected: string;
  minutesSinceArrest: number;
  aortocavalCompressionRisk: boolean;
  ludGuidance: {
    ludActive: boolean;
    technique: string;
    warning?: string;
  };
  pmcsGuidance: PMCSGuidance;
  aokPlan?: AokPlan;
  coagulopathyPlan?: CoagulopathyPlan;
  protocolDirectives: string[];
  actionSummary: string;
}

interface MaternalInterventionResult {
  elapsedMinutes: number;
  interventionType: string;
  agentOrAction: string;
  dosageOrDetails: string;
  hemodynamicResponse: string;
  clinicalFeedback: string;
}

export const MaternalCodeHub: React.FC = () => {
  const [patientId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'evaluator' | 'interventions' | 'history'>('evaluator');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Tab 1: Evaluator State
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState<number>(34);
  const [fundalHeightCm, setFundalHeightCm] = useState<number>(34);
  const [arrestRhythm, setArrestRhythm] = useState<string>('PEA');
  const [etiologySuspected, setEtiologySuspected] = useState<string>('AMNIOTIC_FLUID_EMBOLISM');
  const [minutesSinceArrest, setMinutesSinceArrest] = useState<number>(2.5);
  const [ludActive, setLudActive] = useState<boolean>(true);
  const [hysterotomyInitiated, setHysterotomyInitiated] = useState<boolean>(false);
  const [roscAchieved, setRoscAchieved] = useState<boolean>(false);
  const [fibrinogenLevel, setFibrinogenLevel] = useState<number>(140);
  const [activeBleeding, setActiveBleeding] = useState<boolean>(true);

  const [evaluationResult, setEvaluationResult] = useState<MaternalCodeEvaluationResult | null>(null);

  // Tab 2: Intervention Logging State
  const [logElapsedMin, setLogElapsedMin] = useState<number>(2.5);
  const [logInterventionType, setLogInterventionType] = useState<string>('LUD_POSITIONING');
  const [logAgentAction, setLogAgentAction] = useState<string>('Manual Two-Handed LUD');
  const [logDosageDetails, setLogDosageDetails] = useState<string>('Displaced fundus leftward on firm backboard');
  const [logResponse, setLogResponse] = useState<string>('Palpable carotid pulse during compressions');
  const [loggedIntervention, setLoggedIntervention] = useState<MaternalInterventionResult | null>(null);

  // Tab 3: History State
  const [evalHistory, setEvalHistory] = useState<any[]>([]);
  const [interventionHistory, setInterventionHistory] = useState<any[]>([]);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const headers = { Authorization: `Bearer ${token}` };

      const [evalRes, intRes] = await Promise.all([
        fetch(`/api/clinician/maternal/evaluations/${patientId}`, { headers }),
        fetch(`/api/clinician/maternal/interventions/${patientId}`, { headers })
      ]);

      if (evalRes.ok) {
        setEvalHistory(await evalRes.json());
      }
      if (intRes.ok) {
        setInterventionHistory(await intRes.json());
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
      const res = await fetch('/api/clinician/maternal/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId,
          gestationalAgeWeeks,
          fundalHeightCm: fundalHeightCm > 0 ? fundalHeightCm : undefined,
          arrestRhythm,
          etiologySuspected,
          minutesSinceArrest,
          ludActive,
          hysterotomyInitiated,
          roscAchieved,
          fibrinogenLevelMgDl: fibrinogenLevel > 0 ? fibrinogenLevel : undefined,
          activeBleedingFromLinesOrSites: activeBleeding,
          persist: true
        })
      });

      if (!res.ok) {
        throw new Error(`Evaluation failed with status ${res.status}`);
      }

      const data = await res.json();
      setEvaluationResult(data.evaluation);
      setStatusMessage('Maternal Code & AFE protocols evaluated successfully.');
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogIntervention = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const res = await fetch('/api/clinician/maternal/intervention/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId,
          elapsedMinutes: logElapsedMin,
          interventionType: logInterventionType,
          agentOrAction: logAgentAction,
          dosageOrDetails: logDosageDetails,
          hemodynamicResponse: logResponse,
          persist: true
        })
      });

      if (!res.ok) {
        throw new Error(`Intervention log failed with status ${res.status}`);
      }

      const data = await res.json();
      setLoggedIntervention(data.intervention);
      setStatusMessage('Resuscitation intervention logged successfully.');
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getPmcsBadgeStyle = (action: string) => {
    switch (action) {
      case 'STAT_PMCS_INCISION_NOW':
        return { bg: '#7f1d1d', border: '#ef4444', color: '#fca5a5', label: '⚡ STAT PMCS INCISION NOW (4-MIN RULE)' };
      case 'PREPARE_BEDSIDE_TRAY':
        return { bg: '#78350f', border: '#f59e0b', color: '#fde68a', label: '⚠️ PREPARE SCALPEL & TRAY AT BEDSIDE (< 4 MIN)' };
      case 'CONTINUE_RESUSCITATION_POST_DELIVERY':
        return { bg: '#4c1d95', border: '#a855f7', color: '#e9d5ff', label: 'INFANT DELIVERED - CONTINUE MATERNAL CPR' };
      case 'NOT_INDICATED_PREVIABLE':
        return { bg: '#1e293b', border: '#64748b', color: '#cbd5e1', label: 'PMCS NOT INDICATED (< 20 WEEKS)' };
      default:
        return { bg: '#1e293b', border: '#64748b', color: '#cbd5e1', label: action };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #4c0519 0%, #1e1b4b 100%)',
        padding: '20px 24px',
        borderRadius: '12px',
        border: '1px solid #f43f5e',
        boxShadow: '0 4px 20px rgba(244, 63, 94, 0.15)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '10px' }}>
              🤰 MATERNAL-CODE
              <span style={{ fontSize: '13px', background: '#be123c', color: '#ffe4e6', padding: '3px 10px', borderRadius: '12px', fontWeight: '600' }}>
                AHA / SMFM Obstetric ACLS
              </span>
            </h2>
            <p style={{ margin: '6px 0 0', color: '#fecdd3', fontSize: '14px' }}>
              Manual Left Uterine Displacement (LUD), 4-Minute Bedside PMCS Countdown & AFE "A-OK" Resuscitation
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>Patient Bed / MRN:</span>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#e0e7ff' }}>L&amp;D-CRIT-{patientId.toString().padStart(3, '0')}</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
          <button
            onClick={() => setActiveTab('evaluator')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: activeTab === 'evaluator' ? '1px solid #fb7185' : '1px solid #374151',
              background: activeTab === 'evaluator' ? '#881337' : '#1e1e2f',
              color: activeTab === 'evaluator' ? '#ffffff' : '#9ca3af',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '13px'
            }}
          >
            ⏱️ 4-Minute PMCS & AFE Console
          </button>
          <button
            onClick={() => setActiveTab('interventions')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: activeTab === 'interventions' ? '1px solid #fb7185' : '1px solid #374151',
              background: activeTab === 'interventions' ? '#881337' : '#1e1e2f',
              color: activeTab === 'interventions' ? '#ffffff' : '#9ca3af',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '13px'
            }}
          >
            💉 Intervention & Drug Logger
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: activeTab === 'history' ? '1px solid #fb7185' : '1px solid #374151',
              background: activeTab === 'history' ? '#881337' : '#1e1e2f',
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

      {/* Tab 1: Evaluator */}
      {activeTab === 'evaluator' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
          <div style={{ background: '#111827', padding: '20px', borderRadius: '12px', border: '1px solid #1f2937' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#f3f4f6', fontWeight: '700' }}>
              Arrest Dynamics & Gestational Parameters
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>Gestational Age (Weeks)</label>
                <input
                  type="number"
                  step="0.5"
                  value={gestationalAgeWeeks}
                  onChange={e => setGestationalAgeWeeks(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px 10px', marginTop: '4px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#ffffff' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>Fundal Height (cm)</label>
                <input
                  type="number"
                  value={fundalHeightCm}
                  onChange={e => setFundalHeightCm(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px 10px', marginTop: '4px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#ffffff' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>Arrest / Collapse Rhythm</label>
                <select
                  value={arrestRhythm}
                  onChange={e => setArrestRhythm(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', marginTop: '4px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#ffffff' }}
                >
                  <option value="PEA">PEA (Pulseless Electrical Activity)</option>
                  <option value="ASYSTOLE">Asystole</option>
                  <option value="VF_VT">Ventricular Fibrillation / Pulseless VT</option>
                  <option value="SEVERE_COLLAPSE_PRE_ARREST">Severe Collapse / Pre-Arrest Shock</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>Suspected Etiology</label>
                <select
                  value={etiologySuspected}
                  onChange={e => setEtiologySuspected(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', marginTop: '4px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#ffffff' }}
                >
                  <option value="AMNIOTIC_FLUID_EMBOLISM">Amniotic Fluid Embolism (AFE)</option>
                  <option value="MASSIVE_OB_HEMORRHAGE">Massive Obstetric Hemorrhage</option>
                  <option value="PREECLAMPSIA_ECLAMPSIA">Severe Preeclampsia / Eclampsia</option>
                  <option value="SEPSIS_CHORIOAMNIONITIS">Maternal Sepsis / Chorioamnionitis</option>
                  <option value="PULMONARY_EMBOLISM">Thromboembolic Pulmonary Embolism</option>
                  <option value="CARDIAC_DISEASE">Underlying Cardiac Disease</option>
                  <option value="MAGNESIUM_TOXICITY">Magnesium Sulfate Toxicity</option>
                </select>
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>
                  Minutes Elapsed Since Arrest Onset: <strong style={{ color: minutesSinceArrest >= 4 ? '#ef4444' : '#fbbf24' }}>{minutesSinceArrest} Minutes</strong>
                </label>
                <input
                  type="range"
                  min="0"
                  max="15"
                  step="0.5"
                  value={minutesSinceArrest}
                  onChange={e => setMinutesSinceArrest(Number(e.target.value))}
                  style={{ width: '100%', marginTop: '6px' }}
                />
              </div>
            </div>

            {/* Critical Resuscitation Flags */}
            <div style={{ marginTop: '16px', padding: '12px', background: '#1f2937', borderRadius: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#e5e7eb' }}>Maternal Positioning & Coagulation State</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#cbd5e1' }}>
                  <input
                    type="checkbox"
                    checked={ludActive}
                    onChange={e => setLudActive(e.target.checked)}
                  />
                  Manual Left Uterine Displacement Active
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#cbd5e1' }}>
                  <input
                    type="checkbox"
                    checked={hysterotomyInitiated}
                    onChange={e => setHysterotomyInitiated(e.target.checked)}
                  />
                  Hysterotomy (PMCS) Initiated
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#cbd5e1' }}>
                  <input
                    type="checkbox"
                    checked={roscAchieved}
                    onChange={e => setRoscAchieved(e.target.checked)}
                  />
                  Maternal ROSC Achieved
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#cbd5e1' }}>
                  <input
                    type="checkbox"
                    checked={activeBleeding}
                    onChange={e => setActiveBleeding(e.target.checked)}
                  />
                  Active Bleeding from Lines / Sites (DIC)
                </label>
              </div>

              <div style={{ marginTop: '12px' }}>
                <label style={{ fontSize: '11px', color: '#94a3b8' }}>Fibrinogen Level (mg/dL - Normal in pregnancy 400-500, critical &lt; 200)</label>
                <input
                  type="number"
                  value={fibrinogenLevel}
                  onChange={e => setFibrinogenLevel(Number(e.target.value))}
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
                background: '#be123c',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              {isLoading ? 'Evaluating Protocols...' : '⚡ Generate Maternal Code & PMCS Directives'}
            </button>
          </div>

          {/* Results Panel */}
          <div style={{ background: '#111827', padding: '20px', borderRadius: '12px', border: '1px solid #1f2937' }}>
            {evaluationResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* PMCS Action Required Banner */}
                <div style={{
                  padding: '14px 18px',
                  borderRadius: '10px',
                  background: getPmcsBadgeStyle(evaluationResult.pmcsGuidance.actionRequired).bg,
                  border: `2px solid ${getPmcsBadgeStyle(evaluationResult.pmcsGuidance.actionRequired).border}`,
                  color: getPmcsBadgeStyle(evaluationResult.pmcsGuidance.actionRequired).color,
                  fontWeight: 'bold',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: '15px' }}>{getPmcsBadgeStyle(evaluationResult.pmcsGuidance.actionRequired).label}</span>
                  <span style={{ fontSize: '12px', opacity: 0.9 }}>Elapsed: {evaluationResult.minutesSinceArrest} min</span>
                </div>

                {/* Countdown Timer Display */}
                {evaluationResult.pmcsGuidance.indicated && !evaluationResult.pmcsGuidance.actionRequired.includes('DELIVERY') && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ background: '#1f2937', padding: '12px', borderRadius: '8px', textAlign: 'center', borderLeft: '4px solid #f59e0b' }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>COUNTDOWN TO INCISION</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: evaluationResult.pmcsGuidance.countdownMinutesToIncision === 0 ? '#ef4444' : '#fbbf24' }}>
                        {evaluationResult.pmcsGuidance.countdownMinutesToIncision} min
                      </div>
                      <div style={{ fontSize: '10px', color: '#cbd5e1' }}>4:00 minute rule cutoff</div>
                    </div>
                    <div style={{ background: '#1f2937', padding: '12px', borderRadius: '8px', textAlign: 'center', borderLeft: '4px solid #ef4444' }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>TARGET FETAL DELIVERY</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: evaluationResult.pmcsGuidance.countdownMinutesToDelivery === 0 ? '#ef4444' : '#f87171' }}>
                        {evaluationResult.pmcsGuidance.countdownMinutesToDelivery} min
                      </div>
                      <div style={{ fontSize: '10px', color: '#cbd5e1' }}>5:00 minute delivery target</div>
                    </div>
                  </div>
                )}

                {/* LUD Warning Banner */}
                {evaluationResult.ludGuidance.warning && (
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    background: '#7f1d1d',
                    border: '2px solid #ef4444',
                    color: '#fee2e2'
                  }}>
                    <strong style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      ⚠️ INEFFECTIVE CPR WARNING:
                    </strong>
                    <p style={{ margin: '4px 0 0', fontSize: '12px' }}>
                      {evaluationResult.ludGuidance.warning}
                    </p>
                  </div>
                )}

                {/* AFE A-OK Regimen */}
                {evaluationResult.aokPlan && (
                  <div style={{ background: '#1f2937', padding: '14px', borderRadius: '8px', borderLeft: '4px solid #f43f5e' }}>
                    <span style={{ fontSize: '12px', color: '#fb7185', fontWeight: 'bold' }}>AMNIOTIC FLUID EMBOLISM (A-OK REGIMEN)</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                      <div style={{ padding: '6px', background: '#111827', borderRadius: '4px', fontSize: '12px', color: '#ffffff' }}>
                        <strong>A:</strong> {evaluationResult.aokPlan.atropineDose}
                      </div>
                      <div style={{ padding: '6px', background: '#111827', borderRadius: '4px', fontSize: '12px', color: '#ffffff' }}>
                        <strong>O:</strong> {evaluationResult.aokPlan.ondansetronDose}
                      </div>
                      <div style={{ padding: '6px', background: '#111827', borderRadius: '4px', fontSize: '12px', color: '#ffffff' }}>
                        <strong>K:</strong> {evaluationResult.aokPlan.ketorolacDose}
                      </div>
                    </div>
                  </div>
                )}

                {/* DIC & Cryoprecipitate Protocol */}
                {evaluationResult.coagulopathyPlan && (
                  <div style={{ background: '#1f2937', padding: '14px', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>
                    <span style={{ fontSize: '12px', color: '#fbbf24', fontWeight: 'bold' }}>CONSUMPTIVE COAGULOPATHY (DIC) MANAGEMENT</span>
                    <ul style={{ margin: '6px 0 0', paddingLeft: '18px', fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5 }}>
                      {evaluationResult.coagulopathyPlan.transfusionDirectives.map((t, idx) => (
                        <li key={idx}>{t}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action Directives */}
                <div style={{ background: '#1f2937', padding: '14px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 'bold' }}>OBSTETRIC ACLS DIRECTIVES</span>
                  <ul style={{ margin: '8px 0 0', paddingLeft: '18px', fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5 }}>
                    {evaluationResult.protocolDirectives.map((d, i) => (
                      <li key={i} style={{ marginBottom: '4px' }}>{d}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                <p>Input maternal collapse details and click "Generate Directives" to initialize Obstetric ACLS guidance.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Intervention Logger */}
      {activeTab === 'interventions' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ background: '#111827', padding: '20px', borderRadius: '12px', border: '1px solid #1f2937' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#f3f4f6', fontWeight: '700' }}>
              Log Immediate Resuscitation Intervention
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>Elapsed Minutes from Arrest</label>
                <input
                  type="number"
                  step="0.5"
                  value={logElapsedMin}
                  onChange={e => setLogElapsedMin(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#ffffff' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>Intervention Category</label>
                <select
                  value={logInterventionType}
                  onChange={e => setLogInterventionType(e.target.value)}
                  style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#ffffff' }}
                >
                  <option value="LUD_POSITIONING">Manual Left Uterine Displacement (LUD)</option>
                  <option value="AOK_REGIMEN">A-OK Regimen (Atropine + Ondansetron + Ketorolac)</option>
                  <option value="PMCS_INCISION">Resuscitative Hysterotomy Incision</option>
                  <option value="PMCS_DELIVERY">Infant Extraction & Cord Clamping</option>
                  <option value="CRYOPRECIPITATE_TXA">Cryoprecipitate & Tranexamic Acid (TXA)</option>
                  <option value="EPINEPHRINE_DOSE">Epinephrine 1 mg IV</option>
                  <option value="DEFIBRILLATION">Defibrillation 200J Biphasic</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>Agent / Procedure Details</label>
                <input
                  type="text"
                  value={logAgentAction}
                  onChange={e => setLogAgentAction(e.target.value)}
                  style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#ffffff' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>Dosage or Anatomical Site</label>
                <input
                  type="text"
                  value={logDosageDetails}
                  onChange={e => setLogDosageDetails(e.target.value)}
                  style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#ffffff' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>Hemodynamic / Clinical Response</label>
                <input
                  type="text"
                  value={logResponse}
                  onChange={e => setLogResponse(e.target.value)}
                  style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#ffffff' }}
                />
              </div>

              <button
                onClick={handleLogIntervention}
                disabled={isLoading}
                style={{
                  width: '100%',
                  marginTop: '10px',
                  padding: '12px',
                  background: '#f43f5e',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                {isLoading ? 'Recording Intervention...' : '💉 Commit Resuscitation Event'}
              </button>
            </div>
          </div>

          <div style={{ background: '#111827', padding: '20px', borderRadius: '12px', border: '1px solid #1f2937' }}>
            {loggedIntervention ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{
                  padding: '16px',
                  borderRadius: '10px',
                  background: '#064e3b',
                  border: '2px solid #10b981',
                  color: '#ffffff'
                }}>
                  <div style={{ fontSize: '15px', fontWeight: 'bold' }}>✓ EVENT COMMITTED TO TIMELINE</div>
                  <p style={{ margin: '8px 0 0', fontSize: '13px' }}>
                    {loggedIntervention.clinicalFeedback}
                  </p>
                </div>

                <div style={{ background: '#1f2937', padding: '14px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 'bold' }}>EVENT DETAILS</span>
                  <div style={{ marginTop: '6px', fontSize: '13px', color: '#ffffff' }}>
                    <strong>Type:</strong> {loggedIntervention.interventionType}
                  </div>
                  <div style={{ marginTop: '4px', fontSize: '13px', color: '#ffffff' }}>
                    <strong>Action:</strong> {loggedIntervention.agentOrAction}
                  </div>
                  <div style={{ marginTop: '4px', fontSize: '13px', color: '#ffffff' }}>
                    <strong>Response:</strong> {loggedIntervention.hemodynamicResponse}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                <p>Log resuscitation actions to preserve precise legal and clinical chronology of maternal code events.</p>
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
              Historical Maternal Code Evaluations
            </h3>
            {evalHistory.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '13px' }}>No recorded maternal code evaluations for this patient yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {evalHistory.map(item => (
                  <div key={item.id} style={{ padding: '12px', background: '#1f2937', borderRadius: '8px', borderLeft: '4px solid #f43f5e' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}>
                      <span style={{ color: '#ffffff' }}>Etiology: {item.etiology_suspected} | Rhythm: {item.arrest_rhythm}</span>
                      <span style={{ color: '#9ca3af' }}>{new Date(item.evaluated_at).toLocaleString()}</span>
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#cbd5e1' }}>{item.action_summary}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: '#111827', padding: '20px', borderRadius: '12px', border: '1px solid #1f2937' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '16px', color: '#f3f4f6', fontWeight: '700' }}>
              Resuscitation Intervention Timeline Logs
            </h3>
            {interventionHistory.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '13px' }}>No recorded interventions yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {interventionHistory.map(item => (
                  <div key={item.id} style={{ padding: '12px', background: '#1f2937', borderRadius: '8px', borderLeft: '4px solid #10b981' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}>
                      <span style={{ color: '#ffffff' }}>Minute {item.elapsed_minutes}: {item.intervention_type}</span>
                      <span style={{ color: '#9ca3af' }}>{new Date(item.recorded_at).toLocaleString()}</span>
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#cbd5e1' }}>
                      {item.agent_or_action} ({item.dosage_or_details}) - Response: {item.hemodynamic_response}
                    </p>
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
