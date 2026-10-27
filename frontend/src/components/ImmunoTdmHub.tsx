import React, { useState, useEffect } from 'react';

interface TdmEvaluationResult {
  drugName: 'TACROLIMUS' | 'CYCLOSPORINE';
  levelType: 'C0_TROUGH' | 'C2_PEAK';
  measuredLevel: number;
  postOpMonths: number;
  targetRangeLow: number;
  targetRangeHigh: number;
  status: 'SUBTHERAPEUTIC' | 'THERAPEUTIC' | 'SUPRATHERAPEUTIC' | 'CRITICAL_TOXIC';
  doseAdjustmentPct: number;
  recommendedDoseMgPerDay?: number;
  doseRecommendation: string;
  clinicalActionChecklist: string[];
  monitoringInterval: string;
}

interface Cyp3aInteractionItem {
  drugName: string;
  interactionType: 'STRONG_INHIBITOR' | 'MODERATE_INHIBITOR' | 'STRONG_INDUCER' | 'MODERATE_INDUCER';
  cyp3aEffect: string;
  expectedCniShift: string;
  recommendedDoseAdjustmentPct: number;
  clinicalInstruction: string;
}

interface Cyp3aReport {
  cniDrug: string;
  concurrentDrugsChecked: string[];
  identifiedInteractions: Cyp3aInteractionItem[];
  overallRiskLevel: 'NONE' | 'MODERATE' | 'HIGH' | 'CRITICAL_INDUCER_REJECTION' | 'CRITICAL_INHIBITOR_TOXICITY';
  suggestedImmediateCniAdjustmentPct: number;
  pharmacistRecommendations: string[];
}

interface ActionPlanItem {
  step: number;
  action: string;
  urgency: 'IMMEDIATE' | 'WITHIN_24H' | 'ROUTINE';
  rationale: string;
}

interface DifferentialResult {
  cniToxicityProbability: 'LOW' | 'INTERMEDIATE' | 'HIGH';
  rejectionProbability: 'LOW' | 'INTERMEDIATE' | 'HIGH';
  primarySuspect: 'CNI_NEPHROTOXICITY' | 'ACUTE_ALLOGRAFT_REJECTION' | 'MIXED_ETIOLOGY' | 'INDETERMINATE';
  differentialScore: { cniScore: number; rejectionScore: number };
  diagnosticDifferentiation: string;
  actionPlan: ActionPlanItem[];
}

export const ImmunoTdmHub: React.FC = () => {
  const [patientId] = useState<number>(1);
  const [transplantId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'tdm_calculator' | 'cyp3a_screen' | 'nephro_differential' | 'history'>('tdm_calculator');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Tab 1: TDM Calculator Form
  const [drugName, setDrugName] = useState<'TACROLIMUS' | 'CYCLOSPORINE'>('TACROLIMUS');
  const [levelType, setLevelType] = useState<'C0_TROUGH' | 'C2_PEAK'>('C0_TROUGH');
  const [measuredLevel, setMeasuredLevel] = useState<number>(13.8);
  const [postOpMonths, setPostOpMonths] = useState<number>(2.5);
  const [currentDoseMgPerDay, setCurrentDoseMgPerDay] = useState<number>(6.0);
  const [tdmResult, setTdmResult] = useState<TdmEvaluationResult | null>(null);

  // Tab 2: CYP3A Screen Form
  const [cyp3aCniDrug, setCyp3aCniDrug] = useState<'TACROLIMUS' | 'CYCLOSPORINE'>('TACROLIMUS');
  const [selectedConcurrentDrugs, setSelectedConcurrentDrugs] = useState<string[]>([
    'Voriconazole 200mg BID',
    'Diltiazem 120mg daily'
  ]);
  const [newDrugInput, setNewDrugInput] = useState<string>('');
  const [cyp3aReport, setCyp3aReport] = useState<Cyp3aReport | null>(null);

  // Tab 3: Nephrotoxicity vs. Rejection Form
  const [baselineCr, setBaselineCr] = useState<number>(1.1);
  const [currentCr, setCurrentCr] = useState<number>(2.3);
  const [tacTrough, setTacTrough] = useState<number>(16.2);
  const [fenaPercent, setFenaPercent] = useState<number>(0.4);
  const [dsaPositive, setDsaPositive] = useState<boolean>(false);
  const [highestMfi, setHighestMfi] = useState<number>(450);
  const [hasNeuroSymptoms, setHasNeuroSymptoms] = useState<boolean>(true);
  const [hasHypertension, setHasHypertension] = useState<boolean>(true);
  const [hasFeverTenderness, setHasFeverTenderness] = useState<boolean>(false);
  const [graftDysfunction, setGraftDysfunction] = useState<boolean>(false);
  const [diffResult, setDiffResult] = useState<DifferentialResult | null>(null);

  // Tab 4: History
  const [tdmHistory, setTdmHistory] = useState<any[]>([]);
  const [nephroHistory, setNephroHistory] = useState<any[]>([]);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [resTdm, resNephro] = await Promise.all([
        fetch(`/api/clinician/tdm/records/${patientId}?transplantId=${transplantId}`, { headers }),
        fetch(`/api/clinician/tdm/nephrotoxicity/${patientId}?transplantId=${transplantId}`, { headers })
      ]);

      if (resTdm.ok) {
        const data = await resTdm.json();
        setTdmHistory(data);
      }
      if (resNephro.ok) {
        const data = await resNephro.json();
        setNephroHistory(data);
      }
    } catch (err) {
      console.error('Failed to fetch TDM history:', err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [patientId, transplantId]);

  // 1. Evaluate TDM
  const handleEvaluateTdm = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/clinician/tdm/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          transplantId,
          patientId,
          drugName,
          levelType,
          measuredLevel,
          postOpMonths,
          currentDoseMgPerDay,
          saveRecord: true
        })
      });

      if (!res.ok) throw new Error('Failed to evaluate TDM level');
      const data = await res.json();
      setTdmResult(data.evaluation);
      setStatusMessage('TDM Level evaluated & logged to surveillance history.');
      fetchHistory();
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Screen CYP3A4
  const handleScreenCyp3a = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/clinician/tdm/cyp3a-screen', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          cniDrug: cyp3aCniDrug,
          concurrentDrugs: selectedConcurrentDrugs
        })
      });

      if (!res.ok) throw new Error('Failed to screen CYP3A interactions');
      const data = await res.json();
      setCyp3aReport(data);
      setStatusMessage('CYP3A4 & P-gp drug interaction analysis complete.');
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const addConcurrentDrug = (name: string) => {
    if (name.trim() && !selectedConcurrentDrugs.includes(name.trim())) {
      setSelectedConcurrentDrugs([...selectedConcurrentDrugs, name.trim()]);
      setNewDrugInput('');
    }
  };

  const removeConcurrentDrug = (index: number) => {
    const updated = [...selectedConcurrentDrugs];
    updated.splice(index, 1);
    setSelectedConcurrentDrugs(updated);
  };

  // 3. Differentiate CNI vs Rejection
  const handleDifferentiate = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/clinician/tdm/nephrotoxicity/differentiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          transplantId,
          patientId,
          baselineCreatinine: baselineCr,
          currentCreatinine: currentCr,
          tacrolimusTrough: tacTrough,
          postOpMonths,
          fenaPercent,
          dsaPositive,
          highestMfi,
          hasNeurologicalSymptoms: hasNeuroSymptoms,
          hasHypertensionOrHyperkalemia: hasHypertension,
          hasFeverOrGraftTenderness: hasFeverTenderness,
          graftDysfunctionSigns: graftDysfunction,
          logEvaluation: true
        })
      });

      if (!res.ok) throw new Error('Failed to differentiate nephrotoxicity');
      const data = await res.json();
      setDiffResult(data.differential);
      setStatusMessage('Diagnostic differentiation completed & logged.');
      fetchHistory();
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#0f172a', color: '#f8fafc', padding: '24px', borderRadius: '12px', minHeight: '800px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #334155', paddingBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <span>💊</span> IMMUNO-TDM: Therapeutic Drug Monitoring & Calcineurin Shield
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: '4px 0 0 0' }}>
            Precision Pharmacokinetics, CYP3A4/P-gp Interaction Engine & CNI Toxicity vs. Acute Rejection Differential
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span style={{ backgroundColor: '#1e293b', border: '1px solid #475569', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', color: '#cbd5e1' }}>
            Patient ID: <strong>#{patientId}</strong>
          </span>
          <span style={{ backgroundColor: '#1e293b', border: '1px solid #475569', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', color: '#cbd5e1' }}>
            Transplant ID: <strong>#{transplantId}</strong>
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('tdm_calculator')}
          style={{
            padding: '10px 16px',
            backgroundColor: activeTab === 'tdm_calculator' ? '#0284c7' : '#1e293b',
            color: activeTab === 'tdm_calculator' ? '#ffffff' : '#94a3b8',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          🎯 CNI Level & TDM Target Calculator
        </button>
        <button
          onClick={() => setActiveTab('cyp3a_screen')}
          style={{
            padding: '10px 16px',
            backgroundColor: activeTab === 'cyp3a_screen' ? '#0284c7' : '#1e293b',
            color: activeTab === 'cyp3a_screen' ? '#ffffff' : '#94a3b8',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          ⚡ CYP3A4 & P-gp Interaction Guard
        </button>
        <button
          onClick={() => setActiveTab('nephro_differential')}
          style={{
            padding: '10px 16px',
            backgroundColor: activeTab === 'nephro_differential' ? '#0284c7' : '#1e293b',
            color: activeTab === 'nephro_differential' ? '#ffffff' : '#94a3b8',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          🔬 CNI Toxicity vs. Rejection Differential
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            padding: '10px 16px',
            backgroundColor: activeTab === 'history' ? '#0284c7' : '#1e293b',
            color: activeTab === 'history' ? '#ffffff' : '#94a3b8',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          📋 Surveillance History & Audit Logs
        </button>
      </div>

      {statusMessage && (
        <div style={{ backgroundColor: '#1e3a8a', color: '#93c5fd', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>ℹ️</span> {statusMessage}
        </div>
      )}

      {/* Tab 1: TDM CALCULATOR */}
      {activeTab === 'tdm_calculator' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Input Panel */}
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
            <h3 style={{ fontSize: '16px', color: '#38bdf8', marginTop: 0, marginBottom: '16px' }}>
              Immunosuppressant Concentration Input
            </h3>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                Calcineurin Inhibitor Drug
              </label>
              <select
                value={drugName}
                onChange={e => {
                  const val = e.target.value as 'TACROLIMUS' | 'CYCLOSPORINE';
                  setDrugName(val);
                  if (val === 'TACROLIMUS') setLevelType('C0_TROUGH');
                }}
                style={{ width: '100%', padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
              >
                <option value="TACROLIMUS">Tacrolimus (Prograf / Envarsus XR)</option>
                <option value="CYCLOSPORINE">Cyclosporine (Neoral / Sandimmune)</option>
              </select>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                Level Type
              </label>
              <select
                value={levelType}
                onChange={e => setLevelType(e.target.value as 'C0_TROUGH' | 'C2_PEAK')}
                style={{ width: '100%', padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
              >
                <option value="C0_TROUGH">C0 Trough (Pre-dose 12-hour level)</option>
                {drugName === 'CYCLOSPORINE' && <option value="C2_PEAK">C2 Peak (2 hours post-dose)</option>}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  Measured Level ({drugName === 'TACROLIMUS' ? 'ng/mL' : 'ng/mL'})
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={measuredLevel}
                  onChange={e => setMeasuredLevel(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  Post-Transplant Time (Months)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={postOpMonths}
                  onChange={e => setPostOpMonths(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                Current Total Daily Dose (mg/day)
              </label>
              <input
                type="number"
                step="0.5"
                value={currentDoseMgPerDay}
                onChange={e => setCurrentDoseMgPerDay(parseFloat(e.target.value) || 0)}
                style={{ width: '100%', padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
              />
            </div>

            <button
              onClick={handleEvaluateTdm}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#0284c7',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '14px'
              }}
            >
              {isLoading ? 'Computing Target...' : 'Evaluate Therapeutic Exposure & Dose'}
            </button>
          </div>

          {/* Results Panel */}
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
            <h3 style={{ fontSize: '16px', color: '#38bdf8', marginTop: 0, marginBottom: '16px' }}>
              Pharmacokinetic TDM Analysis
            </h3>

            {tdmResult ? (
              <div>
                {/* Status Card */}
                <div
                  style={{
                    padding: '14px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    backgroundColor:
                      tdmResult.status === 'THERAPEUTIC'
                        ? 'rgba(16, 185, 129, 0.15)'
                        : tdmResult.status === 'CRITICAL_TOXIC'
                        ? 'rgba(239, 68, 68, 0.2)'
                        : 'rgba(245, 158, 11, 0.15)',
                    border: `1px solid ${
                      tdmResult.status === 'THERAPEUTIC'
                        ? '#10b981'
                        : tdmResult.status === 'CRITICAL_TOXIC'
                        ? '#ef4444'
                        : '#f59e0b'
                    }`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '15px' }}>
                      Status: {tdmResult.status.replace(/_/g, ' ')}
                    </span>
                    <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '4px', backgroundColor: '#0f172a' }}>
                      Target: {tdmResult.targetRangeLow} - {tdmResult.targetRangeHigh} ng/mL
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', margin: '8px 0 0 0', color: '#e2e8f0' }}>
                    {tdmResult.doseRecommendation}
                  </p>
                </div>

                {/* Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ backgroundColor: '#0f172a', padding: '10px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>Dose Adjustment</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: tdmResult.doseAdjustmentPct >= 0 ? '#10b981' : '#f59e0b' }}>
                      {tdmResult.doseAdjustmentPct > 0 ? `+${tdmResult.doseAdjustmentPct}%` : `${tdmResult.doseAdjustmentPct}%`}
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#0f172a', padding: '10px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>Next Monitoring</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#38bdf8', marginTop: '4px' }}>
                      {tdmResult.monitoringInterval}
                    </div>
                  </div>
                </div>

                {/* Checklist */}
                <div>
                  <h4 style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 8px 0' }}>Clinical Action Protocol</h4>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#cbd5e1', lineHeight: '1.6' }}>
                    {tdmResult.clinicalActionChecklist.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', marginTop: '60px' }}>
                Enter measured concentration and post-transplant months, then click "Evaluate Therapeutic Exposure".
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: CYP3A4 & P-GP SCREEN */}
      {activeTab === 'cyp3a_screen' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
            <h3 style={{ fontSize: '16px', color: '#38bdf8', marginTop: 0, marginBottom: '16px' }}>
              Concurrent Regimen Drug-Drug Interaction Screen
            </h3>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                Prescribed Calcineurin Inhibitor
              </label>
              <select
                value={cyp3aCniDrug}
                onChange={e => setCyp3aCniDrug(e.target.value as 'TACROLIMUS' | 'CYCLOSPORINE')}
                style={{ width: '100%', padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
              >
                <option value="TACROLIMUS">Tacrolimus</option>
                <option value="CYCLOSPORINE">Cyclosporine</option>
              </select>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                Add Concurrent Medication
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="e.g. Voriconazole, Fluconazole, Rifampin, Diltiazem..."
                  value={newDrugInput}
                  onChange={e => setNewDrugInput(e.target.value)}
                  style={{ flex: 1, padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
                <button
                  onClick={() => addConcurrentDrug(newDrugInput)}
                  style={{ padding: '8px 14px', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Add
                </button>
              </div>
            </div>

            {/* Quick add chips */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>Quick Add Common High-Risk Agents:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {['Voriconazole', 'Posaconazole', 'Fluconazole', 'Diltiazem', 'Rifampin', 'Carbamazepine', "St John's Wort"].map(d => (
                  <button
                    key={d}
                    onClick={() => addConcurrentDrug(d)}
                    style={{ fontSize: '11px', padding: '4px 8px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#cbd5e1', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    + {d}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Active Concurrent Medications List:</div>
              {selectedConcurrentDrugs.map((drug, index) => (
                <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', padding: '6px 10px', borderRadius: '4px', marginBottom: '6px', fontSize: '13px' }}>
                  <span>{drug}</span>
                  <button
                    onClick={() => removeConcurrentDrug(index)}
                    style={{ backgroundColor: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={handleScreenCyp3a}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#0284c7',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '14px'
              }}
            >
              {isLoading ? 'Screening CYP3A...' : 'Run CYP3A4 & P-gp Interaction Engine'}
            </button>
          </div>

          {/* Results Panel */}
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
            <h3 style={{ fontSize: '16px', color: '#38bdf8', marginTop: 0, marginBottom: '16px' }}>
              Pharmacokinetic Interaction Surveillance
            </h3>

            {cyp3aReport ? (
              <div>
                <div
                  style={{
                    padding: '14px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    backgroundColor:
                      cyp3aReport.overallRiskLevel === 'NONE'
                        ? 'rgba(16, 185, 129, 0.15)'
                        : cyp3aReport.overallRiskLevel.includes('CRITICAL')
                        ? 'rgba(239, 68, 68, 0.2)'
                        : 'rgba(245, 158, 11, 0.15)',
                    border: `1px solid ${
                      cyp3aReport.overallRiskLevel === 'NONE'
                        ? '#10b981'
                        : cyp3aReport.overallRiskLevel.includes('CRITICAL')
                        ? '#ef4444'
                        : '#f59e0b'
                    }`
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '15px' }}>
                    Risk: {cyp3aReport.overallRiskLevel.replace(/_/g, ' ')}
                  </div>
                  {cyp3aReport.suggestedImmediateCniAdjustmentPct !== 0 && (
                    <div style={{ fontSize: '13px', marginTop: '4px', color: '#f8fafc' }}>
                      Suggested Pre-Emptive Dose Shift: <strong>{cyp3aReport.suggestedImmediateCniAdjustmentPct > 0 ? `+${cyp3aReport.suggestedImmediateCniAdjustmentPct}%` : `${cyp3aReport.suggestedImmediateCniAdjustmentPct}%`}</strong>
                    </div>
                  )}
                </div>

                {/* Identified interactions */}
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 8px 0' }}>Identified High-Risk Pathways</h4>
                  {cyp3aReport.identifiedInteractions.length > 0 ? (
                    cyp3aReport.identifiedInteractions.map((item, idx) => (
                      <div key={idx} style={{ backgroundColor: '#0f172a', padding: '10px', borderRadius: '6px', marginBottom: '8px', borderLeft: '4px solid #ef4444' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px', color: '#f8fafc' }}>
                          <span>{item.drugName}</span>
                          <span style={{ fontSize: '11px', color: '#f59e0b' }}>{item.interactionType}</span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#38bdf8', marginTop: '2px' }}>{item.cyp3aEffect} ({item.expectedCniShift})</div>
                        <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '4px' }}>👉 {item.clinicalInstruction}</div>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: '#10b981', fontSize: '13px' }}>✅ No major CYP3A4/P-gp inhibitors or inducers matched.</div>
                  )}
                </div>

                {/* Pharmacist Recommendations */}
                <div>
                  <h4 style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 8px 0' }}>Transplant Pharmacotherapy Directives</h4>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#cbd5e1', lineHeight: '1.5' }}>
                    {cyp3aReport.pharmacistRecommendations.map((rec, idx) => (
                      <li key={idx}>{rec}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', marginTop: '60px' }}>
                Add concurrent medications and run the CYP3A4 interaction engine to screen for bioavailability shifts.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: CNI TOXICITY VS REJECTION */}
      {activeTab === 'nephro_differential' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
            <h3 style={{ fontSize: '16px', color: '#38bdf8', marginTop: 0, marginBottom: '16px' }}>
              Renal Dysfunction & Allograft Biomarkers
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  Baseline Creatinine (mg/dL)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={baselineCr}
                  onChange={e => setBaselineCr(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  Current Creatinine (mg/dL)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={currentCr}
                  onChange={e => setCurrentCr(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  Tacrolimus Trough (ng/mL)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={tacTrough}
                  onChange={e => setTacTrough(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  FeNa (%) Fractional Excretion Na
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={fenaPercent}
                  onChange={e => setFenaPercent(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  DSA Positive (Luminex)
                </label>
                <select
                  value={dsaPositive ? 'true' : 'false'}
                  onChange={e => setDsaPositive(e.target.value === 'true')}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                >
                  <option value="false">Negative (MFI &lt; 1000)</option>
                  <option value="true">Positive (Donor-Specific)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  Peak DSA MFI
                </label>
                <input
                  type="number"
                  step="100"
                  value={highestMfi}
                  onChange={e => setHighestMfi(parseInt(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>Clinical Syndrome & Physical Signs:</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={hasNeuroSymptoms}
                  onChange={e => setHasNeuroSymptoms(e.target.checked)}
                />
                Tremors, headache, or visual disturbance (CNI neurotoxicity)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={hasHypertension}
                  onChange={e => setHasHypertension(e.target.checked)}
                />
                New hypertension or hyperkalemia (aff. arteriolar vasoconstriction)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={hasFeverTenderness}
                  onChange={e => setHasFeverTenderness(e.target.checked)}
                />
                Fever, malaise, or allograft tenderness (acute rejection)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={graftDysfunction}
                  onChange={e => setGraftDysfunction(e.target.checked)}
                />
                Decline in graft function (drop in EF / FEV1, sudden oliguria)
              </label>
            </div>

            <button
              onClick={handleDifferentiate}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#0284c7',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '14px'
              }}
            >
              {isLoading ? 'Computing Differential...' : 'Differentiate CNI Toxicity vs. Acute Rejection'}
            </button>
          </div>

          {/* Differential Result Panel */}
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
            <h3 style={{ fontSize: '16px', color: '#38bdf8', marginTop: 0, marginBottom: '16px' }}>
              Diagnostic Differential & Action Plan
            </h3>

            {diffResult ? (
              <div>
                <div
                  style={{
                    padding: '14px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    backgroundColor:
                      diffResult.primarySuspect === 'CNI_NEPHROTOXICITY'
                        ? 'rgba(2, 132, 199, 0.2)'
                        : diffResult.primarySuspect === 'ACUTE_ALLOGRAFT_REJECTION'
                        ? 'rgba(239, 68, 68, 0.2)'
                        : 'rgba(245, 158, 11, 0.15)',
                    border: `1px solid ${
                      diffResult.primarySuspect === 'CNI_NEPHROTOXICITY'
                        ? '#0284c7'
                        : diffResult.primarySuspect === 'ACUTE_ALLOGRAFT_REJECTION'
                        ? '#ef4444'
                        : '#f59e0b'
                    }`
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
                    Primary Suspect: {diffResult.primarySuspect.replace(/_/g, ' ')}
                  </div>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '13px' }}>
                    <span>CNI Toxicity Probability: <strong>{diffResult.cniToxicityProbability}</strong></span>
                    <span>Rejection Probability: <strong>{diffResult.rejectionProbability}</strong></span>
                  </div>
                </div>

                <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.5', marginBottom: '16px' }}>
                  {diffResult.diagnosticDifferentiation}
                </p>

                {/* Action Plan */}
                <div>
                  <h4 style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 10px 0' }}>Immediate Clinical Action Plan</h4>
                  {diffResult.actionPlan.map(item => (
                    <div key={item.step} style={{ backgroundColor: '#0f172a', padding: '10px 12px', borderRadius: '6px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#38bdf8' }}>Step {item.step}: {item.action}</span>
                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: item.urgency === 'IMMEDIATE' ? '#ef4444' : '#0284c7', color: '#fff' }}>
                          {item.urgency}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                        <em>Rationale:</em> {item.rationale}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', marginTop: '60px' }}>
                Enter renal biomarkers and clinical presentation, then click "Differentiate CNI Toxicity vs. Acute Rejection".
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: HISTORY & AUDIT LOGS */}
      {activeTab === 'history' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* TDM History */}
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
            <h3 style={{ fontSize: '16px', color: '#38bdf8', marginTop: 0, marginBottom: '16px' }}>
              TDM Concentration Log
            </h3>
            {tdmHistory.length > 0 ? (
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {tdmHistory.map((rec, i) => (
                  <div key={i} style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', marginBottom: '10px', borderLeft: `4px solid ${rec.status === 'THERAPEUTIC' ? '#10b981' : '#f59e0b'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}>
                      <span>{rec.drug_name} ({rec.level_type})</span>
                      <span style={{ color: rec.status === 'THERAPEUTIC' ? '#10b981' : '#f59e0b' }}>{rec.status}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                      Level: <strong>{rec.measured_level} ng/mL</strong> | Target: {rec.target_range_low} - {rec.target_range_high} ng/mL | Mo: {rec.post_op_months}
                    </div>
                    <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '4px' }}>
                      {rec.dose_recommendation}
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
                      {new Date(rec.logged_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#64748b', fontSize: '13px' }}>No TDM records found for this patient.</div>
            )}
          </div>

          {/* Nephrotoxicity Logs */}
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
            <h3 style={{ fontSize: '16px', color: '#38bdf8', marginTop: 0, marginBottom: '16px' }}>
              Nephrotoxicity Differential Logs
            </h3>
            {nephroHistory.length > 0 ? (
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {nephroHistory.map((log, i) => (
                  <div key={i} style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', marginBottom: '10px', borderLeft: '4px solid #38bdf8' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}>
                      <span>Cr: {log.baseline_creatinine} ➔ {log.current_creatinine} mg/dL</span>
                      <span style={{ color: '#38bdf8' }}>Tac: {log.tacrolimus_trough} ng/mL</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '4px' }}>
                      {log.diagnostic_differentiation}
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#64748b', fontSize: '13px' }}>No nephrotoxicity evaluations logged yet.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
export default ImmunoTdmHub;
