import React, { useState, useEffect } from 'react';

interface ClinicalAction {
  step: number;
  action: string;
  urgency: 'STAT_EMERGENT' | 'URGENT' | 'ROUTINE';
  rationale: string;
}

interface CongenitalHeartResult {
  lesionCategory: 'DUCTAL_DEPENDENT_SYSTEMIC' | 'DUCTAL_DEPENDENT_PULMONARY' | 'DUCTAL_DEPENDENT_MIXING' | 'NON_DUCTAL_OR_PULMONARY';
  suspectedLesions: string[];
  hyperoxiaTestInterpretation: {
    result: 'POSITIVE_CYANOTIC_CHD' | 'NEGATIVE_PULMONARY' | 'EQUIVOCAL';
    pao2Value: number;
    explanation: string;
  };
  differentialCyanosisPattern: 'NORMAL' | 'TRUE_DIFFERENTIAL' | 'REVERSE_DIFFERENTIAL';
  pge1Indicated: boolean;
  pge1Dosing: string;
  oxygenationTargetStrategy: string;
  rashkindIndicated: boolean;
  apneaRiskAlert: {
    alert: boolean;
    recommendation: string;
  };
  clinicalActions: ClinicalAction[];
}

interface Pge1MonitoringResult {
  infusionStatus: 'EFFECTIVE_DUCTAL_PATENCY' | 'SUBTHERAPEUTIC_CLOSED_DUCTUS' | 'EXCESSIVE_SIDE_EFFECTS';
  hemodynamicStability: string;
  apneaGuardDirectives: string[];
  recommendedInfusionAdjustment: string;
}

export const CongenitalHeartHub: React.FC = () => {
  const [patientId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'cchd_evaluator' | 'pge1_monitor' | 'history'>('cchd_evaluator');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Tab 1: CCHD Evaluation State
  const [postnatalAgeHours, setPostnatalAgeHours] = useState<number>(24);
  const [preDuctalSpo2, setPreDuctalSpo2] = useState<number>(85);
  const [postDuctalSpo2, setPostDuctalSpo2] = useState<number>(75);
  const [hyperoxiaPao2, setHyperoxiaPao2] = useState<number>(92);
  const [femoralPulses, setFemoralPulses] = useState<'NORMAL' | 'DIMINISHED' | 'ABSENT'>('DIMINISHED');
  const [bpGradient, setBpGradient] = useState<number>(18);
  const [selectedEchoLesions, setSelectedEchoLesions] = useState<string[]>(['COA']);
  const [hasAcidosis, setHasAcidosis] = useState<boolean>(true);
  const [lactate, setLactate] = useState<number>(4.8);
  const [cchdResult, setCchdResult] = useState<CongenitalHeartResult | null>(null);

  // Tab 2: PGE1 Monitoring State
  const [pge1Rate, setPge1Rate] = useState<number>(0.05);
  const [patientWeightKg, setPatientWeightKg] = useState<number>(3.1);
  const [apneaObserved, setApneaObserved] = useState<boolean>(false);
  const [tempCelsius, setTempCelsius] = useState<number>(37.6);
  const [sbp, setSbp] = useState<number>(56);
  const [dbp, setDbp] = useState<number>(32);
  const [pge1PreSpo2, setPge1PreSpo2] = useState<number>(84);
  const [pge1PostSpo2, setPge1PostSpo2] = useState<number>(82);
  const [pge1Result, setPge1Result] = useState<Pge1MonitoringResult | null>(null);

  // Tab 3: History State
  const [cchdHistory, setCchdHistory] = useState<any[]>([]);
  const [pge1History, setPge1History] = useState<any[]>([]);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [resCchd, resPge1] = await Promise.all([
        fetch(`/api/clinician/congenital-heart/evaluations/${patientId}`, { headers }),
        fetch(`/api/clinician/congenital-heart/pge1-logs/${patientId}`, { headers })
      ]);

      if (resCchd.ok) {
        const data = await resCchd.json();
        setCchdHistory(data);
      }
      if (resPge1.ok) {
        const data = await resPge1.json();
        setPge1History(data);
      }
    } catch (err) {
      console.error('Failed to fetch CCHD history:', err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [patientId]);

  // Handle CCHD Evaluation
  const handleEvaluateCchd = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/clinician/congenital-heart/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId,
          postnatalAgeHours,
          preDuctalSpo2,
          postDuctalSpo2,
          hyperoxiaPao2,
          femoralPulses,
          fourExtremityBpGradientMmhg: bpGradient,
          echocardiogramFindings: selectedEchoLesions,
          hasMetabolicAcidosis: hasAcidosis,
          lactateMmolL: lactate,
          saveEvaluation: true
        })
      });

      if (!res.ok) throw new Error('Failed to evaluate CCHD');
      const data = await res.json();
      setCchdResult(data.evaluation);
      setStatusMessage('Critical congenital heart disease & ductal dependency evaluated.');
      fetchHistory();
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle PGE1 Monitoring
  const handleMonitorPge1 = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/clinician/congenital-heart/pge1/monitor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId,
          infusionRateMcgKgMin: pge1Rate,
          apneaObserved,
          temperatureCelsius: tempCelsius,
          bloodPressureSystolic: sbp,
          bloodPressureDiastolic: dbp,
          preDuctalSpo2: pge1PreSpo2,
          postDuctalSpo2: pge1PostSpo2,
          patientWeightKg,
          saveLog: true
        })
      });

      if (!res.ok) throw new Error('Failed to evaluate PGE1 infusion');
      const data = await res.json();
      setPge1Result(data.monitoring);
      setStatusMessage('PGE1 infusion response & apnea guard evaluated.');
      fetchHistory();
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleEchoLesion = (lesion: string) => {
    if (selectedEchoLesions.includes(lesion)) {
      setSelectedEchoLesions(selectedEchoLesions.filter(l => l !== lesion));
    } else {
      setSelectedEchoLesions([...selectedEchoLesions, lesion]);
    }
  };

  return (
    <div style={{ backgroundColor: '#0f172a', color: '#f8fafc', padding: '24px', borderRadius: '12px', minHeight: '800px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #334155', paddingBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#f43f5e', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <span>❤️</span> CONGENITAL-HEART: Critical Congenital Heart Disease & Ductal Patency Engine
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: '4px 0 0 0' }}>
            Ductal-Dependent Lesion Classification, Hyperoxia Test, PGE1 (Alprostadil) Rescue & Sub-Ambient Oxygen Strategy
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span style={{ backgroundColor: '#1e293b', border: '1px solid #475569', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', color: '#cbd5e1' }}>
            Patient ID: <strong>#{patientId}</strong>
          </span>
          <span style={{ backgroundColor: '#1e293b', border: '1px solid #475569', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', color: '#cbd5e1' }}>
            Age: <strong>{postnatalAgeHours} hrs</strong>
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('cchd_evaluator')}
          style={{
            padding: '10px 16px',
            backgroundColor: activeTab === 'cchd_evaluator' ? '#e11d48' : '#1e293b',
            color: activeTab === 'cchd_evaluator' ? '#ffffff' : '#94a3b8',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          🫀 Ductal Dependency & Hyperoxia Evaluator
        </button>
        <button
          onClick={() => setActiveTab('pge1_monitor')}
          style={{
            padding: '10px 16px',
            backgroundColor: activeTab === 'pge1_monitor' ? '#e11d48' : '#1e293b',
            color: activeTab === 'pge1_monitor' ? '#ffffff' : '#94a3b8',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          💉 PGE1 Infusion Dynamics & Apnea Guard
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            padding: '10px 16px',
            backgroundColor: activeTab === 'history' ? '#e11d48' : '#1e293b',
            color: activeTab === 'history' ? '#ffffff' : '#94a3b8',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          📋 CCHD Evaluations & Infusion Logs
        </button>
      </div>

      {statusMessage && (
        <div style={{ backgroundColor: '#4c0519', color: '#fecdd3', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>ℹ️</span> {statusMessage}
        </div>
      )}

      {/* Tab 1: CCHD EVALUATOR */}
      {activeTab === 'cchd_evaluator' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Inputs Panel */}
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
            <h3 style={{ fontSize: '16px', color: '#fb7185', marginTop: 0, marginBottom: '16px' }}>
              Hemodynamic, Oximetry & Blood Gas Data
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  Pre-Ductal SpO2 (Right Hand %)
                </label>
                <input
                  type="number"
                  value={preDuctalSpo2}
                  onChange={e => setPreDuctalSpo2(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  Post-Ductal SpO2 (Foot %)
                </label>
                <input
                  type="number"
                  value={postDuctalSpo2}
                  onChange={e => setPostDuctalSpo2(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  Hyperoxia PaO2 (100% FiO2 x 10m)
                </label>
                <input
                  type="number"
                  value={hyperoxiaPao2}
                  onChange={e => setHyperoxiaPao2(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  Femoral Pulses Quality
                </label>
                <select
                  value={femoralPulses}
                  onChange={e => setFemoralPulses(e.target.value as any)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                >
                  <option value="NORMAL">Normal 2+ bilateral</option>
                  <option value="DIMINISHED">Diminished / Threaded</option>
                  <option value="ABSENT">Absent / Non-palpable</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>
                  BP Gradient (Arm-Leg)
                </label>
                <input
                  type="number"
                  value={bpGradient}
                  onChange={e => setBpGradient(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '4px', color: '#f8fafc' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>
                  Postnatal Age (hrs)
                </label>
                <input
                  type="number"
                  value={postnatalAgeHours}
                  onChange={e => setPostnatalAgeHours(parseInt(e.target.value) || 0)}
                  style={{ width: '100%', padding: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '4px', color: '#f8fafc' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>
                  Lactate (mmol/L)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={lactate}
                  onChange={e => setLactate(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '4px', color: '#f8fafc' }}
                />
              </div>
            </div>

            {/* Echo Lesions selection */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Suspected / Echo Anatomical Findings:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {['HLHS', 'COA', 'IAA', 'TGA', 'PA/IVS', 'TOF', 'CRITICAL PS', 'RESTRICTIVE ATRIAL SEPTUM'].map(lesion => (
                  <button
                    key={lesion}
                    type="button"
                    onClick={() => toggleEchoLesion(lesion)}
                    style={{
                      fontSize: '11px',
                      padding: '4px 8px',
                      backgroundColor: selectedEchoLesions.includes(lesion) ? '#e11d48' : '#0f172a',
                      border: '1px solid #475569',
                      color: selectedEchoLesions.includes(lesion) ? '#ffffff' : '#cbd5e1',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    {selectedEchoLesions.includes(lesion) ? '✓ ' : '+ '}{lesion}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={hasAcidosis}
                  onChange={e => setHasAcidosis(e.target.checked)}
                />
                Metabolic Acidosis (pH &lt; 7.25, BE &lt; -6, signs of cardiogenic hypoperfusion)
              </label>
            </div>

            <button
              onClick={handleEvaluateCchd}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#e11d48',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '14px'
              }}
            >
              {isLoading ? 'Classifying Ductal Dependency...' : 'Evaluate CCHD & Ductal Rescue Protocol'}
            </button>
          </div>

          {/* Results Panel */}
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
            <h3 style={{ fontSize: '16px', color: '#fb7185', marginTop: 0, marginBottom: '16px' }}>
              Critical Congenital Heart Directives
            </h3>

            {cchdResult ? (
              <div>
                {/* Category Banner */}
                <div
                  style={{
                    padding: '14px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    backgroundColor:
                      cchdResult.lesionCategory === 'NON_DUCTAL_OR_PULMONARY'
                        ? 'rgba(16, 185, 129, 0.15)'
                        : 'rgba(244, 63, 94, 0.2)',
                    border: `1px solid ${
                      cchdResult.lesionCategory === 'NON_DUCTAL_OR_PULMONARY'
                        ? '#10b981'
                        : '#f43f5e'
                    }`
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '15px' }}>
                    {cchdResult.lesionCategory.replace(/_/g, ' ')}
                  </div>
                  <div style={{ fontSize: '12px', color: '#e2e8f0', marginTop: '4px' }}>
                    Suspected: {cchdResult.suspectedLesions.join(', ')}
                  </div>
                </div>

                {/* Rashkind Alert if indicated */}
                {cchdResult.rashkindIndicated && (
                  <div style={{ backgroundColor: '#881337', border: '1px solid #f43f5e', padding: '10px 12px', borderRadius: '6px', marginBottom: '14px', fontSize: '13px' }}>
                    <div style={{ fontWeight: 'bold', color: '#fecdd3' }}>🚨 STAT RASHKIND BALLOON ATRIAL SEPTOSTOMY INDICATED</div>
                    <div style={{ color: '#ffe4e6', marginTop: '2px', fontSize: '12px' }}>
                      Restrictive interatrial communication in D-TGA prevents oxygenated mixing. Alert Cath Lab immediately.
                    </div>
                  </div>
                )}

                {/* Hyperoxia & Differential Cyanosis */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ backgroundColor: '#0f172a', padding: '10px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>Hyperoxia Test (100% FiO2)</div>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: cchdResult.hyperoxiaTestInterpretation.result === 'POSITIVE_CYANOTIC_CHD' ? '#fb7185' : '#34d399', marginTop: '2px' }}>
                      PaO2 {cchdResult.hyperoxiaTestInterpretation.pao2Value} mmHg ({cchdResult.hyperoxiaTestInterpretation.result.replace(/_/g, ' ')})
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#0f172a', padding: '10px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>Differential Cyanosis Pattern</div>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: cchdResult.differentialCyanosisPattern === 'REVERSE_DIFFERENTIAL' ? '#f43f5e' : '#fb7185', marginTop: '2px' }}>
                      {cchdResult.differentialCyanosisPattern.replace(/_/g, ' ')}
                    </div>
                  </div>
                </div>

                {/* PGE1 Dosing Directives */}
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Alprostadil (PGE1) Protocol:</div>
                  <div style={{ backgroundColor: '#0f172a', padding: '8px 12px', borderRadius: '4px', fontSize: '13px', color: '#f8fafc', marginTop: '4px' }}>
                    {cchdResult.pge1Dosing}
                  </div>
                </div>

                {/* Oxygenation Strategy Alert */}
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Oxygenation Strategy (Qp:Qs Balance):</div>
                  <div style={{ backgroundColor: '#0f172a', padding: '8px 12px', borderRadius: '4px', fontSize: '12px', color: '#38bdf8', marginTop: '4px' }}>
                    {cchdResult.oxygenationTargetStrategy}
                  </div>
                </div>

                {/* Clinical Actions */}
                <div>
                  <h4 style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 8px 0' }}>Prioritized Clinical Directives</h4>
                  {cchdResult.clinicalActions.map(action => (
                    <div key={action.step} style={{ backgroundColor: '#0f172a', padding: '8px 10px', borderRadius: '4px', marginBottom: '6px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', color: '#f8fafc' }}>Step {action.step}: {action.action}</span>
                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: action.urgency === 'STAT_EMERGENT' ? '#e11d48' : '#0284c7', color: '#fff' }}>
                          {action.urgency}
                        </span>
                      </div>
                      <div style={{ color: '#94a3b8', marginTop: '2px' }}><em>Rationale:</em> {action.rationale}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', marginTop: '60px' }}>
                Enter oximetry, hyperoxia PaO2, and pulse exam, then click "Evaluate CCHD & Ductal Rescue Protocol".
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: PGE1 MONITOR */}
      {activeTab === 'pge1_monitor' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
            <h3 style={{ fontSize: '16px', color: '#fb7185', marginTop: 0, marginBottom: '16px' }}>
              PGE1 Infusion Parameters & Patient Vitals
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  PGE1 Infusion Rate (mcg/kg/min)
                </label>
                <input
                  type="number"
                  step="0.005"
                  value={pge1Rate}
                  onChange={e => setPge1Rate(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  Patient Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={patientWeightKg}
                  onChange={e => setPatientWeightKg(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>
                  Temperature (°C)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={tempCelsius}
                  onChange={e => setTempCelsius(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '4px', color: '#f8fafc' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>
                  Systolic BP (mmHg)
                </label>
                <input
                  type="number"
                  value={sbp}
                  onChange={e => setSbp(parseInt(e.target.value) || 0)}
                  style={{ width: '100%', padding: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '4px', color: '#f8fafc' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>
                  Diastolic BP (mmHg)
                </label>
                <input
                  type="number"
                  value={dbp}
                  onChange={e => setDbp(parseInt(e.target.value) || 0)}
                  style={{ width: '100%', padding: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '4px', color: '#f8fafc' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  Current Pre-Ductal SpO2 (%)
                </label>
                <input
                  type="number"
                  value={pge1PreSpo2}
                  onChange={e => setPge1PreSpo2(parseInt(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  Current Post-Ductal SpO2 (%)
                </label>
                <input
                  type="number"
                  value={pge1PostSpo2}
                  onChange={e => setPge1PostSpo2(parseInt(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: '#f87171' }}>
                <input
                  type="checkbox"
                  checked={apneaObserved}
                  onChange={e => setApneaObserved(e.target.checked)}
                />
                <strong>Apnea episode observed (&gt; 20 seconds or with bradycardia)</strong>
              </label>
            </div>

            <button
              onClick={handleMonitorPge1}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#e11d48',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '14px'
              }}
            >
              {isLoading ? 'Assessing...' : 'Monitor PGE1 Infusion & Adverse Effects'}
            </button>
          </div>

          {/* Results Panel */}
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
            <h3 style={{ fontSize: '16px', color: '#fb7185', marginTop: 0, marginBottom: '16px' }}>
              Infusion Dynamics & Apnea Sentinel
            </h3>

            {pge1Result ? (
              <div>
                <div
                  style={{
                    padding: '14px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    backgroundColor:
                      pge1Result.infusionStatus === 'EFFECTIVE_DUCTAL_PATENCY'
                        ? 'rgba(16, 185, 129, 0.15)'
                        : 'rgba(239, 68, 68, 0.2)',
                    border: `1px solid ${
                      pge1Result.infusionStatus === 'EFFECTIVE_DUCTAL_PATENCY'
                        ? '#10b981'
                        : '#ef4444'
                    }`
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '15px' }}>
                    Status: {pge1Result.infusionStatus.replace(/_/g, ' ')}
                  </div>
                  <div style={{ fontSize: '13px', color: '#e2e8f0', marginTop: '4px' }}>
                    {pge1Result.hemodynamicStability}
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Dose Titration Directives:</div>
                  <div style={{ backgroundColor: '#0f172a', padding: '10px 12px', borderRadius: '6px', fontSize: '13px', color: '#fbbf24', marginTop: '4px' }}>
                    {pge1Result.recommendedInfusionAdjustment}
                  </div>
                </div>

                {/* Apnea Directives */}
                <div>
                  <h4 style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 8px 0' }}>Airway & Apnea Guard</h4>
                  {pge1Result.apneaGuardDirectives.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#f87171', lineHeight: '1.5' }}>
                      {pge1Result.apneaGuardDirectives.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  ) : (
                    <div style={{ color: '#10b981', fontSize: '13px' }}>✅ Stable spontaneous breathing without apnea or significant vasodilation.</div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', marginTop: '60px' }}>
                Enter infusion rate, weight, and vitals, then click "Monitor PGE1 Infusion & Adverse Effects".
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: HISTORY */}
      {activeTab === 'history' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
            <h3 style={{ fontSize: '16px', color: '#fb7185', marginTop: 0, marginBottom: '16px' }}>
              CCHD Diagnostic Evaluations
            </h3>
            {cchdHistory.length > 0 ? (
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {cchdHistory.map((h, i) => (
                  <div key={i} style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', marginBottom: '10px', borderLeft: `4px solid ${h.lesion_category.includes('DUCTAL') ? '#f43f5e' : '#10b981'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}>
                      <span>{h.lesion_category.replace(/_/g, ' ')}</span>
                      <span style={{ color: '#fb7185' }}>PGE1: {h.pge1_indicated ? 'YES' : 'NO'}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                      PGE1: {h.pge1_dosing}
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
                      {new Date(h.evaluated_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#64748b', fontSize: '13px' }}>No CCHD evaluations found.</div>
            )}
          </div>

          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
            <h3 style={{ fontSize: '16px', color: '#fb7185', marginTop: 0, marginBottom: '16px' }}>
              PGE1 Infusion Monitoring Logs
            </h3>
            {pge1History.length > 0 ? (
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {pge1History.map((p, i) => (
                  <div key={i} style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', marginBottom: '10px', borderLeft: `4px solid ${p.apnea_observed ? '#ef4444' : '#10b981'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}>
                      <span>Rate: {p.infusion_rate_mcg_kg_min} mcg/kg/min</span>
                      <span style={{ color: p.apnea_observed ? '#ef4444' : '#10b981' }}>{p.apnea_observed ? 'APNEA OBSERVED' : 'STABLE'}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                      BP: {p.blood_pressure_systolic}/{p.blood_pressure_diastolic} | SpO2: {p.pre_ductal_spo2}% / {p.post_ductal_spo2}% | Temp: {p.temperature_celsius}°C
                    </div>
                    <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '4px' }}>
                      {p.airway_status}
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
                      {new Date(p.logged_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#64748b', fontSize: '13px' }}>No PGE1 infusion logs recorded.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
export default CongenitalHeartHub;
