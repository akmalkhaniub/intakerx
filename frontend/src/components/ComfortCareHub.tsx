import React, { useState, useEffect } from 'react';

interface EsasRAssessmentResult {
  total_distress_score: number;
  physical_symptom_score: number;
  psychological_symptom_score: number;
  overall_distress_severity: 'MILD' | 'MODERATE' | 'SEVERE';
  severe_symptoms: string[];
  targeted_interventions: string[];
}

interface OpioidConversionResult {
  baseline_oral_morphine_equivalent_mg_24h: number;
  unadjusted_target_dose_24h: number;
  cross_tolerance_reduction_applied_percent: number;
  recommended_daily_dose: number;
  unit: string;
  breakthrough_prn_dose: number;
  breakthrough_frequency_and_route: string;
  clinical_warnings: string[];
  conversion_formula_notes: string;
}

interface TerminalSymptomAssessmentResult {
  pps_trajectory_classification: 'FULL_FUNCTION' | 'PROGRESSIVE_DISEASE' | 'ADVANCED_DISEASE' | 'TRANSITIONAL_TERMINAL' | 'IMMINENT_END_OF_LIFE';
  median_survival_prognosis: string;
  polst_concordance_review: string;
  dyspnea_protocol: string[];
  secretions_protocol: string[];
  agitation_delirium_protocol: string[];
  care_plan_action_items: string[];
}

export const ComfortCareHub: React.FC = () => {
  const [patientId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'esas_r' | 'converter' | 'terminal' | 'history'>('esas_r');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // ESAS-r State
  const [pain, setPain] = useState<number>(8);
  const [tiredness, setTiredness] = useState<number>(7);
  const [drowsiness, setDrowsiness] = useState<number>(6);
  const [nausea, setNausea] = useState<number>(8);
  const [appetite, setAppetite] = useState<number>(9);
  const [sob, setSob] = useState<number>(8);
  const [depression, setDepression] = useState<number>(5);
  const [anxiety, setAnxiety] = useState<number>(8);
  const [wellbeing, setWellbeing] = useState<number>(8);
  const [esasResult, setEsasResult] = useState<EsasRAssessmentResult | null>(null);

  // Opioid Converter State
  const [fromOpioid, setFromOpioid] = useState<'MORPHINE' | 'OXYCODONE' | 'HYDROMORPHONE' | 'FENTANYL'>('MORPHINE');
  const [fromDose, setFromDose] = useState<number>(120);
  const [fromRoute, setFromRoute] = useState<'ORAL' | 'IV' | 'SC' | 'TRANSDERMAL_MCG_HR'>('ORAL');
  const [toOpioid, setToOpioid] = useState<'MORPHINE' | 'OXYCODONE' | 'HYDROMORPHONE' | 'FENTANYL'>('HYDROMORPHONE');
  const [toRoute, setToRoute] = useState<'ORAL' | 'IV' | 'SC' | 'TRANSDERMAL_MCG_HR'>('ORAL');
  const [crossToleranceReduction, setCrossToleranceReduction] = useState<number>(25);
  const [organImpairment, setOrganImpairment] = useState<boolean>(false);
  const [converterResult, setConverterResult] = useState<OpioidConversionResult | null>(null);

  // Terminal Protocols & PPS State
  const [ppsPercent, setPpsPercent] = useState<number>(20);
  const [polstStatus, setPolstStatus] = useState<'FULL_CODE' | 'DNR_COMFORT_FOCUSED' | 'DNR_LIMITED_INTERVENTIONS'>('DNR_COMFORT_FOCUSED');
  const [hasDyspnea, setHasDyspnea] = useState<boolean>(true);
  const [respRate, setRespRate] = useState<number>(26);
  const [spo2, setSpo2] = useState<number>(88);
  const [hasSecretions, setHasSecretions] = useState<boolean>(true);
  const [hasAgitation, setHasAgitation] = useState<boolean>(true);
  const [retentionRuledOut, setRetentionRuledOut] = useState<boolean>(false);
  const [impactionRuledOut, setImpactionRuledOut] = useState<boolean>(false);
  const [terminalResult, setTerminalResult] = useState<TerminalSymptomAssessmentResult | null>(null);

  // History State
  const [history, setHistory] = useState<{ encounters: any[]; opioid_rotations: any[] }>({
    encounters: [],
    opioid_rotations: []
  });

  const fetchHistory = async () => {
    try {
      const res = await fetch(`/api/clinician/palliative/patients/${patientId}/history`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error('Failed to load palliative history:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  const handleEvaluateEsas = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const res = await fetch('/api/clinician/palliative/evaluate-esas-r', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scores: {
            pain: Number(pain),
            tiredness: Number(tiredness),
            drowsiness: Number(drowsiness),
            nausea: Number(nausea),
            appetite: Number(appetite),
            shortness_of_breath: Number(sob),
            depression: Number(depression),
            anxiety: Number(anxiety),
            wellbeing: Number(wellbeing)
          }
        })
      });
      if (res.ok) {
        const data = await res.json();
        setEsasResult(data);
        setStatusMessage('ESAS-r multi-domain symptoms assessed.');
      } else {
        const err = await res.json();
        setStatusMessage(`Error: ${err.error || 'Failed to evaluate ESAS-r'}`);
      }
    } catch (err) {
      setStatusMessage('Network error evaluating ESAS-r.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConvertOpioid = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const res = await fetch('/api/clinician/palliative/convert-opioid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_opioid: fromOpioid,
          from_dose_mg_24h: Number(fromDose),
          from_route: fromRoute,
          to_opioid: toOpioid,
          to_route: toRoute,
          cross_tolerance_reduction_percent: Number(crossToleranceReduction),
          renal_hepatic_impairment: organImpairment
        })
      });
      if (res.ok) {
        const data = await res.json();
        setConverterResult(data);
        setStatusMessage('Opioid equianalgesic rotation calculated.');
      } else {
        const err = await res.json();
        setStatusMessage(`Error: ${err.error || 'Failed to convert opioid'}`);
      }
    } catch (err) {
      setStatusMessage('Network error calculating opioid conversion.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEvaluateTerminal = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const res = await fetch('/api/clinician/palliative/evaluate-terminal-symptoms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refractory_dyspnea_present: hasDyspnea,
          respiratory_rate_breaths_min: Number(respRate),
          spo2_percent: Number(spo2),
          death_rattle_secretions_present: hasSecretions,
          terminal_agitation_delirium_present: hasAgitation,
          urinary_retention_ruled_out: retentionRuledOut,
          bowel_impaction_ruled_out: impactionRuledOut,
          pps_v2_percent: Number(ppsPercent),
          polst_code_status: polstStatus
        })
      });
      if (res.ok) {
        const data = await res.json();
        setTerminalResult(data);
        setStatusMessage('Terminal symptom and PPS trajectory protocol generated.');
      } else {
        const err = await res.json();
        setStatusMessage(`Error: ${err.error || 'Failed to assess terminal symptoms'}`);
      }
    } catch (err) {
      setStatusMessage('Network error evaluating terminal symptoms.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px', backgroundColor: '#0f172a', minHeight: '100vh', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header Banner */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#a855f7', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🕊️</span> COMFORT-CARE: Inpatient Palliative & Symptom Control Command
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
            ESAS-r Symptom Tracker • Opioid Equianalgesic Converter (Cross-Tolerance) • Terminal Symptom Protocols & PPS Trajectory
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '6px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#c084fc' }}>
            Active Patient: #{patientId}
          </span>
          <span style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '6px', backgroundColor: '#581c87', color: '#f3e8ff', fontWeight: 'bold' }}>
            Palliative Concordance Active
          </span>
        </div>
      </div>

      {statusMessage && (
        <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', backgroundColor: statusMessage.startsWith('Error') ? '#7f1d1d' : '#14532d', color: '#f8fafc', fontSize: '13px' }}>
          {statusMessage}
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #334155', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('esas_r')}
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            border: 'none',
            background: 'none',
            color: activeTab === 'esas_r' ? '#a855f7' : '#94a3b8',
            borderBottom: activeTab === 'esas_r' ? '2px solid #a855f7' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          📊 ESAS-r Multi-Domain Tracker
        </button>
        <button
          onClick={() => setActiveTab('converter')}
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            border: 'none',
            background: 'none',
            color: activeTab === 'converter' ? '#a855f7' : '#94a3b8',
            borderBottom: activeTab === 'converter' ? '2px solid #a855f7' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          💊 Opioid Equianalgesic Converter
        </button>
        <button
          onClick={() => setActiveTab('terminal')}
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            border: 'none',
            background: 'none',
            color: activeTab === 'terminal' ? '#a855f7' : '#94a3b8',
            borderBottom: activeTab === 'terminal' ? '2px solid #a855f7' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          🕊️ Terminal Protocols & PPS Trajectory
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            border: 'none',
            background: 'none',
            color: activeTab === 'history' ? '#a855f7' : '#94a3b8',
            borderBottom: activeTab === 'history' ? '2px solid #a855f7' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          📋 Palliative Logs & History
        </button>
      </div>

      {/* Tab 1: ESAS-r Multi-Domain Tracker */}
      {activeTab === 'esas_r' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>📝</span> Edmonton Symptom Assessment Scale (0 = None, 10 = Worst)
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  <span>Pain</span>
                  <span style={{ color: pain >= 7 ? '#ef4444' : '#a855f7', fontWeight: 'bold' }}>{pain}/10</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={pain}
                  onChange={(e) => setPain(parseInt(e.target.value, 10))}
                  style={{ width: '100%', accentColor: '#a855f7' }}
                />
              </div>

              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  <span>Tiredness (Fatigue)</span>
                  <span style={{ color: tiredness >= 7 ? '#ef4444' : '#a855f7', fontWeight: 'bold' }}>{tiredness}/10</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={tiredness}
                  onChange={(e) => setTiredness(parseInt(e.target.value, 10))}
                  style={{ width: '100%', accentColor: '#a855f7' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  <span>Drowsiness</span>
                  <span style={{ color: drowsiness >= 7 ? '#ef4444' : '#a855f7', fontWeight: 'bold' }}>{drowsiness}/10</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={drowsiness}
                  onChange={(e) => setDrowsiness(parseInt(e.target.value, 10))}
                  style={{ width: '100%', accentColor: '#a855f7' }}
                />
              </div>

              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  <span>Nausea</span>
                  <span style={{ color: nausea >= 7 ? '#ef4444' : '#a855f7', fontWeight: 'bold' }}>{nausea}/10</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={nausea}
                  onChange={(e) => setNausea(parseInt(e.target.value, 10))}
                  style={{ width: '100%', accentColor: '#a855f7' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  <span>Lack of Appetite</span>
                  <span style={{ color: appetite >= 7 ? '#ef4444' : '#a855f7', fontWeight: 'bold' }}>{appetite}/10</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={appetite}
                  onChange={(e) => setAppetite(parseInt(e.target.value, 10))}
                  style={{ width: '100%', accentColor: '#a855f7' }}
                />
              </div>

              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  <span>Shortness of Breath (Dyspnea)</span>
                  <span style={{ color: sob >= 7 ? '#ef4444' : '#a855f7', fontWeight: 'bold' }}>{sob}/10</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={sob}
                  onChange={(e) => setSob(parseInt(e.target.value, 10))}
                  style={{ width: '100%', accentColor: '#a855f7' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  <span>Depression</span>
                  <span style={{ color: depression >= 7 ? '#ef4444' : '#a855f7', fontWeight: 'bold' }}>{depression}/10</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={depression}
                  onChange={(e) => setDepression(parseInt(e.target.value, 10))}
                  style={{ width: '100%', accentColor: '#a855f7' }}
                />
              </div>

              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  <span>Anxiety</span>
                  <span style={{ color: anxiety >= 7 ? '#ef4444' : '#a855f7', fontWeight: 'bold' }}>{anxiety}/10</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={anxiety}
                  onChange={(e) => setAnxiety(parseInt(e.target.value, 10))}
                  style={{ width: '100%', accentColor: '#a855f7' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                <span>Worst Overall Wellbeing</span>
                <span style={{ color: wellbeing >= 7 ? '#ef4444' : '#a855f7', fontWeight: 'bold' }}>{wellbeing}/10</span>
              </label>
              <input
                type="range"
                min="0"
                max="10"
                value={wellbeing}
                onChange={(e) => setWellbeing(parseInt(e.target.value, 10))}
                style={{ width: '100%', accentColor: '#a855f7' }}
              />
            </div>

            <button
              onClick={handleEvaluateEsas}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: '#9333ea',
                color: 'white',
                border: 'none',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {isLoading ? 'Assessing...' : 'Compute ESAS-r Distress & Comfort Plan'}
            </button>
          </div>

          {/* ESAS-r Results */}
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#c084fc' }}>
              📈 Symptom Distress Indices & Targeted Interventions
            </h3>

            {esasResult ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
                  <div style={{
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: esasResult.overall_distress_severity === 'SEVERE' ? '#7f1d1d' : esasResult.overall_distress_severity === 'MODERATE' ? '#78350f' : '#14532d',
                    border: '1px solid #334155',
                    textAlign: 'center'
                  }}>
                    <span style={{ fontSize: '11px', color: '#cbd5e1', display: 'block' }}>Total Distress</span>
                    <strong style={{ fontSize: '20px', color: '#f8fafc' }}>{esasResult.total_distress_score}/90</strong>
                    <span style={{ fontSize: '10px', color: '#cbd5e1', display: 'block', marginTop: '2px' }}>{esasResult.overall_distress_severity}</span>
                  </div>

                  <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155', textAlign: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>Physical Domain</span>
                    <strong style={{ fontSize: '18px', color: '#38bdf8' }}>{esasResult.physical_symptom_score}/60</strong>
                  </div>

                  <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155', textAlign: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>Psych Domain</span>
                    <strong style={{ fontSize: '18px', color: '#c084fc' }}>{esasResult.psychological_symptom_score}/20</strong>
                  </div>
                </div>

                {esasResult.severe_symptoms.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#ef4444', display: 'block', marginBottom: '8px' }}>
                      🚨 High-Distress Symptom Triggers (Score &ge; 7):
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {esasResult.severe_symptoms.map((s, idx) => (
                        <span key={idx} style={{ padding: '4px 10px', borderRadius: '6px', backgroundColor: '#450a0a', border: '1px solid #ef4444', fontSize: '12px', color: '#fca5a5' }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#a7f3d0', display: 'block', marginBottom: '8px' }}>
                    🩺 Targeted Comfort Interventions:
                  </span>
                  <ul style={{ margin: 0, paddingLeft: '20px', color: '#e2e8f0', fontSize: '13px', lineHeight: '1.6' }}>
                    {esasResult.targeted_interventions.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                <span style={{ fontSize: '40px', display: 'block', marginBottom: '12px' }}>📊</span>
                Adjust ESAS-r sliders to evaluate total symptom distress and generate targeted palliative interventions.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Opioid Equianalgesic Converter */}
      {activeTab === 'converter' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>💊</span> Opioid Rotation & Equianalgesic Parameters
            </h3>

            <div style={{ marginBottom: '14px' }}>
              <h4 style={{ fontSize: '13px', color: '#38bdf8', margin: '0 0 8px 0' }}>Current Baseline Opioid Regimen</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>From Drug</label>
                  <select
                    value={fromOpioid}
                    onChange={(e) => setFromOpioid(e.target.value as any)}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                  >
                    <option value="MORPHINE">Morphine</option>
                    <option value="OXYCODONE">Oxycodone</option>
                    <option value="HYDROMORPHONE">Hydromorphone (Dilaudid)</option>
                    <option value="FENTANYL">Fentanyl</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>From Route</label>
                  <select
                    value={fromRoute}
                    onChange={(e) => setFromRoute(e.target.value as any)}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                  >
                    <option value="ORAL">Oral (PO)</option>
                    <option value="IV">Intravenous (IV)</option>
                    <option value="SC">Subcutaneous (SC)</option>
                    <option value="TRANSDERMAL_MCG_HR">Transdermal (mcg/hr)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>24h Total Dose</label>
                  <input
                    type="number"
                    value={fromDose}
                    onChange={(e) => setFromDose(parseFloat(e.target.value) || 0)}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <h4 style={{ fontSize: '13px', color: '#c084fc', margin: '0 0 8px 0' }}>Target Rotation Regimen</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>To Drug</label>
                  <select
                    value={toOpioid}
                    onChange={(e) => setToOpioid(e.target.value as any)}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                  >
                    <option value="MORPHINE">Morphine</option>
                    <option value="OXYCODONE">Oxycodone</option>
                    <option value="HYDROMORPHONE">Hydromorphone (Dilaudid)</option>
                    <option value="FENTANYL">Fentanyl</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>To Route</label>
                  <select
                    value={toRoute}
                    onChange={(e) => setToRoute(e.target.value as any)}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                  >
                    <option value="ORAL">Oral (PO)</option>
                    <option value="IV">Intravenous (IV)</option>
                    <option value="SC">Subcutaneous (SC)</option>
                    <option value="TRANSDERMAL_MCG_HR">Transdermal (mcg/hr)</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                <span>Incomplete Cross-Tolerance Reduction</span>
                <span style={{ color: '#c084fc', fontWeight: 'bold' }}>{crossToleranceReduction}%</span>
              </label>
              <input
                type="range"
                min="15"
                max="50"
                step="5"
                value={crossToleranceReduction}
                onChange={(e) => setCrossToleranceReduction(parseInt(e.target.value, 10))}
                style={{ width: '100%', accentColor: '#c084fc' }}
              />
              <span style={{ fontSize: '11px', color: '#64748b' }}>Standard: 25% for pain control; 33-50% for frail or elderly</span>
            </div>

            <div style={{ marginBottom: '18px', padding: '10px', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#f59e0b', fontWeight: 'bold' }}>
                <input
                  type="checkbox"
                  checked={organImpairment}
                  onChange={(e) => setOrganImpairment(e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                Renal / Hepatic Impairment (Enforce &ge; 33% reduction & metabolite warning)
              </label>
            </div>

            <button
              onClick={handleConvertOpioid}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: '#9333ea',
                color: 'white',
                border: 'none',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {isLoading ? 'Converting...' : 'Calculate Equianalgesic Rotation & PRN Dose'}
            </button>
          </div>

          {/* Opioid Conversion Results */}
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#c084fc' }}>
              🎯 Equianalgesic Prescription & Breakthrough Guidance
            </h3>

            {converterResult ? (
              <div>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155', flex: 1 }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>Baseline OME:</span>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#38bdf8' }}>
                      {converterResult.baseline_oral_morphine_equivalent_mg_24h} mg/day
                    </div>
                  </div>

                  <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#581c87', border: '1px solid #a855f7', flex: 1 }}>
                    <span style={{ fontSize: '11px', color: '#e9d5ff' }}>Recommended 24h Dose:</span>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#f8fafc' }}>
                      {converterResult.recommended_daily_dose} {converterResult.unit}
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '14px', padding: '12px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#f43f5e', display: 'block', marginBottom: '4px' }}>
                    Breakthrough PRN Dose (10-15% of 24h Total):
                  </span>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#fda4af', marginBottom: '4px' }}>
                    {converterResult.breakthrough_prn_dose} mg
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1' }}>{converterResult.breakthrough_frequency_and_route}</p>
                </div>

                <div style={{ marginBottom: '14px', padding: '10px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #334155' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>Conversion Summary:</span>
                  <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1' }}>{converterResult.conversion_formula_notes}</p>
                </div>

                {converterResult.clinical_warnings.length > 0 && (
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fbbf24', display: 'block', marginBottom: '8px' }}>
                      ⚠️ Clinical Warnings & Pharmacokinetics:
                    </span>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#fef08a', fontSize: '12px', lineHeight: '1.6' }}>
                      {converterResult.clinical_warnings.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                <span style={{ fontSize: '40px', display: 'block', marginBottom: '12px' }}>💊</span>
                Select current opioid and route to calculate equianalgesic rotation with incomplete cross-tolerance reduction.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Terminal Protocols & PPS Trajectory */}
      {activeTab === 'terminal' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🕊️</span> End-of-Life Trajectory & Symptom Assessment
            </h3>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                <span>Palliative Performance Scale (PPS v2)</span>
                <span style={{ color: ppsPercent <= 30 ? '#ef4444' : '#38bdf8', fontWeight: 'bold' }}>{ppsPercent}%</span>
              </label>
              <input
                type="range"
                min="10"
                max="100"
                step="10"
                value={ppsPercent}
                onChange={(e) => setPpsPercent(parseInt(e.target.value, 10))}
                style={{ width: '100%', accentColor: '#a855f7' }}
              />
              <span style={{ fontSize: '11px', color: '#64748b' }}>&le; 20% = Imminent dying (hours-days); 30-40% = Transitional terminal (days-weeks)</span>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>POLST / Code Status</label>
              <select
                value={polstStatus}
                onChange={(e) => setPolstStatus(e.target.value as any)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
              >
                <option value="DNR_COMFORT_FOCUSED">DNR / Comfort-Focused Care Only</option>
                <option value="DNR_LIMITED_INTERVENTIONS">DNR / Limited Additional Interventions</option>
                <option value="FULL_CODE">Full Code (CPR / Intubation)</option>
              </select>
            </div>

            <h4 style={{ margin: '14px 0 8px 0', fontSize: '13px', color: '#cbd5e1' }}>Terminal Symptom Check</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#f43f5e' }}>
                <input
                  type="checkbox"
                  checked={hasDyspnea}
                  onChange={(e) => setHasDyspnea(e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                Refractory Terminal Dyspnea (Air Hunger)
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#38bdf8' }}>
                <input
                  type="checkbox"
                  checked={hasSecretions}
                  onChange={(e) => setHasSecretions(e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                Terminal Retained Secretions ("Death Rattle")
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#fbbf24' }}>
                <input
                  type="checkbox"
                  checked={hasAgitation}
                  onChange={(e) => setHasAgitation(e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                Terminal Restlessness & Agitation / Hyperactive Delirium
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8' }}>Resp Rate (breaths/min)</label>
                <input
                  type="number"
                  value={respRate}
                  onChange={(e) => setRespRate(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%', padding: '6px', borderRadius: '4px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8' }}>SpO2 (%)</label>
                <input
                  type="number"
                  value={spo2}
                  onChange={(e) => setSpo2(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%', padding: '6px', borderRadius: '4px', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f8fafc' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '18px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: '#94a3b8' }}>
                <input
                  type="checkbox"
                  checked={retentionRuledOut}
                  onChange={(e) => setRetentionRuledOut(e.target.checked)}
                />
                Urinary retention ruled out (Bladder scan / catheter)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: '#94a3b8' }}>
                <input
                  type="checkbox"
                  checked={impactionRuledOut}
                  onChange={(e) => setImpactionRuledOut(e.target.checked)}
                />
                Fecal impaction ruled out (Abdominal / rectal exam)
              </label>
            </div>

            <button
              onClick={handleEvaluateTerminal}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: '#9333ea',
                color: 'white',
                border: 'none',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {isLoading ? 'Assessing...' : 'Generate Terminal Comfort Protocols'}
            </button>
          </div>

          {/* Terminal Protocol Results */}
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#c084fc' }}>
              🕯️ Trajectory Guidance & Care Plan
            </h3>

            {terminalResult ? (
              <div>
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>PPS Trajectory:</span>
                    <strong style={{ fontSize: '13px', color: '#c084fc' }}>{terminalResult.pps_trajectory_classification}</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1' }}>{terminalResult.median_survival_prognosis}</p>
                </div>

                <div style={{ marginBottom: '14px', padding: '10px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #334155' }}>
                  <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>POLST Concordance:</span>
                  <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1' }}>{terminalResult.polst_concordance_review}</p>
                </div>

                {terminalResult.dyspnea_protocol.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#f43f5e', display: 'block', marginBottom: '4px' }}>
                      🫁 Terminal Dyspnea Protocol:
                    </span>
                    <ul style={{ margin: 0, paddingLeft: '18px', color: '#fca5a5', fontSize: '12px', lineHeight: '1.5' }}>
                      {terminalResult.dyspnea_protocol.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {terminalResult.secretions_protocol.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#38bdf8', display: 'block', marginBottom: '4px' }}>
                      💧 Retained Secretions Protocol:
                    </span>
                    <ul style={{ margin: 0, paddingLeft: '18px', color: '#bae6fd', fontSize: '12px', lineHeight: '1.5' }}>
                      {terminalResult.secretions_protocol.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {terminalResult.agitation_delirium_protocol.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fbbf24', display: 'block', marginBottom: '4px' }}>
                      ⚡ Terminal Agitation / Delirium Protocol:
                    </span>
                    <ul style={{ margin: 0, paddingLeft: '18px', color: '#fef08a', fontSize: '12px', lineHeight: '1.5' }}>
                      {terminalResult.agitation_delirium_protocol.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {terminalResult.care_plan_action_items.length > 0 && (
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#a7f3d0', display: 'block', marginBottom: '4px' }}>
                      📋 Immediate Care Plan Actions:
                    </span>
                    <ul style={{ margin: 0, paddingLeft: '18px', color: '#d1fae5', fontSize: '12px', lineHeight: '1.5' }}>
                      {terminalResult.care_plan_action_items.map((action, idx) => (
                        <li key={idx}>{action}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                <span style={{ fontSize: '40px', display: 'block', marginBottom: '12px' }}>🕯️</span>
                Set PPS score and check active terminal symptoms to generate end-of-life comfort protocols.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: History & Logs */}
      {activeTab === 'history' && (
        <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: '#c084fc' }}>
              📋 Palliative Encounters & Opioid Rotations History
            </h3>
            <button
              onClick={fetchHistory}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                backgroundColor: '#334155',
                color: '#f8fafc',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              🔄 Refresh Logs
            </button>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ fontSize: '14px', color: '#38bdf8', margin: '0 0 10px 0' }}>Palliative Care Encounters</h4>
            {history.encounters.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #475569', color: '#94a3b8' }}>
                    <th style={{ padding: '8px' }}>Date</th>
                    <th style={{ padding: '8px' }}>PPS %</th>
                    <th style={{ padding: '8px' }}>POLST Status</th>
                    <th style={{ padding: '8px' }}>Goals of Care</th>
                    <th style={{ padding: '8px' }}>Pain</th>
                    <th style={{ padding: '8px' }}>Dyspnea</th>
                  </tr>
                </thead>
                <tbody>
                  {history.encounters.map((enc: any) => (
                    <tr key={enc.id} style={{ borderBottom: '1px solid #334155', color: '#f8fafc' }}>
                      <td style={{ padding: '8px' }}>{new Date(enc.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: '8px', color: '#c084fc', fontWeight: 'bold' }}>{enc.pps_v2_score}%</td>
                      <td style={{ padding: '8px' }}>{enc.polst_code_status}</td>
                      <td style={{ padding: '8px' }}>{enc.goals_of_care_trajectory}</td>
                      <td style={{ padding: '8px' }}>{enc.esas_r_scores?.pain ?? '—'}/10</td>
                      <td style={{ padding: '8px' }}>{enc.esas_r_scores?.shortness_of_breath ?? '—'}/10</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: '#64748b', fontSize: '13px' }}>No palliative encounters recorded yet for this patient.</p>
            )}
          </div>

          <div>
            <h4 style={{ fontSize: '14px', color: '#c084fc', margin: '0 0 10px 0' }}>Opioid Equianalgesic Rotations</h4>
            {history.opioid_rotations.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #475569', color: '#94a3b8' }}>
                    <th style={{ padding: '8px' }}>Logged At</th>
                    <th style={{ padding: '8px' }}>From Regimen</th>
                    <th style={{ padding: '8px' }}>To Regimen</th>
                    <th style={{ padding: '8px' }}>Cross-Tolerance Red.</th>
                    <th style={{ padding: '8px' }}>Prescribed Dose</th>
                    <th style={{ padding: '8px' }}>Breakthrough PRN</th>
                  </tr>
                </thead>
                <tbody>
                  {history.opioid_rotations.map((rot: any) => (
                    <tr key={rot.id} style={{ borderBottom: '1px solid #334155', color: '#f8fafc' }}>
                      <td style={{ padding: '8px' }}>{new Date(rot.logged_at).toLocaleString()}</td>
                      <td style={{ padding: '8px' }}>{rot.from_dose_mg_24h} mg ({rot.from_route}) {rot.from_opioid}</td>
                      <td style={{ padding: '8px', color: '#38bdf8', fontWeight: 'bold' }}>{rot.to_opioid} ({rot.to_route})</td>
                      <td style={{ padding: '8px' }}>-{rot.cross_tolerance_reduction_percent}%</td>
                      <td style={{ padding: '8px', color: '#a7f3d0', fontWeight: 'bold' }}>{rot.prescribed_dose_mg_24h} mg/24h</td>
                      <td style={{ padding: '8px' }}>{rot.breakthrough_dose_mg} mg {rot.breakthrough_interval_hours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: '#64748b', fontSize: '13px' }}>No opioid rotations logged yet for this patient.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
