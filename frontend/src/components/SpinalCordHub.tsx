import React, { useState, useEffect } from 'react';

interface MapTargetGoal {
  minMapMmhg: number;
  maxMapMmhg: number;
  durationDays: number;
  durationHoursTotal: number;
  recommendedVasopressor: string;
  contraindicatedAgents: string[];
}

interface SpinalCordEvaluationResult {
  neurologicalLevelOfInjury: string;
  hoursSinceInjury: number;
  asiaGrade: 'A' | 'B' | 'C' | 'D' | 'E';
  completeness: 'COMPLETE' | 'SENSORY_INCOMPLETE' | 'MOTOR_INCOMPLETE' | 'NORMAL';
  motorScoreTotal: number;
  sensoryScoreTotal: number;
  sacralSparingSensory: boolean;
  sacralSparingMotor: boolean;
  bulbocavernosusReflexPresent: boolean;
  spinalShockActive: boolean;
  neurogenicShockActive: boolean;
  concomitantHemorrhagicShockSuspected: boolean;
  lesionAboveT6: boolean;
  surgicalCandidate: boolean;
  decompressionWindowStatus: 'ULTRA_EARLY_OPTIMAL' | 'EARLY_ACCEPTABLE' | 'DELAYED';
  mapTargetGoal: MapTargetGoal;
  autonomicDysreflexiaRisk: boolean;
  protocolDirectives: string[];
  recommendedAction: string;
}

interface MapAugmentationLogResult {
  postInjuryHour: number;
  systolicBp: number;
  diastolicBp: number;
  mapMmhg: number;
  heartRate: number;
  targetMet: boolean;
  activeVasopressor?: string;
  vasopressorDoseMcgMin?: number;
  vasopressorAction: 'UPTITRATE' | 'MAINTAIN' | 'WEAN' | 'SWITCH_AGENT';
  ischemiaRiskAlert: boolean;
  actionPlan: string;
}

export const SpinalCordHub: React.FC = () => {
  const [patientId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'evaluator' | 'map_titrator' | 'history'>('evaluator');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Tab 1: Evaluator State
  const [nli, setNli] = useState<string>('C5');
  const [hoursSinceInjury, setHoursSinceInjury] = useState<number>(4);
  const [motorScoreTotal, setMotorScoreTotal] = useState<number>(24);
  const [sensoryScoreTotal, setSensoryScoreTotal] = useState<number>(56);
  const [sacralSparingSensory, setSacralSparingSensory] = useState<boolean>(false);
  const [sacralSparingMotor, setSacralSparingMotor] = useState<boolean>(false);
  const [keyMusclesGrade3Percent, setKeyMusclesGrade3Percent] = useState<number>(0);
  const [bulbocavernosusReflex, setBulbocavernosusReflex] = useState<boolean>(false);
  const [currentSbp, setCurrentSbp] = useState<number>(84);
  const [currentDbp, setCurrentDbp] = useState<number>(50);
  const [currentMap, setCurrentMap] = useState<number>(61);
  const [currentHeartRate, setCurrentHeartRate] = useState<number>(50);
  const [cordCompression, setCordCompression] = useState<boolean>(true);
  const [spinalInstability, setSpinalInstability] = useState<boolean>(true);
  const [baselineSbp, setBaselineSbp] = useState<number>(115);

  const [evaluationResult, setEvaluationResult] = useState<SpinalCordEvaluationResult | null>(null);

  // Tab 2: MAP Augmentation Titrator State
  const [postInjuryHour, setPostInjuryHour] = useState<number>(8);
  const [titrationSbp, setTitrationSbp] = useState<number>(118);
  const [titrationDbp, setTitrationDbp] = useState<number>(72);
  const [titrationMap, setTitrationMap] = useState<number>(87);
  const [titrationHeartRate, setTitrationHeartRate] = useState<number>(64);
  const [activeVasopressor, setActiveVasopressor] = useState<string>('Norepinephrine');
  const [vasopressorDose, setVasopressorDose] = useState<number>(10);
  const [mapTitrationResult, setMapTitrationResult] = useState<MapAugmentationLogResult | null>(null);

  // Tab 3: History State
  const [evalHistory, setEvalHistory] = useState<any[]>([]);
  const [mapHistory, setMapHistory] = useState<any[]>([]);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const headers = { Authorization: `Bearer ${token}` };

      const [evalRes, mapRes] = await Promise.all([
        fetch(`/api/clinician/spinalcord/evaluations/${patientId}`, { headers }),
        fetch(`/api/clinician/spinalcord/map-logs/${patientId}`, { headers })
      ]);

      if (evalRes.ok) {
        setEvalHistory(await evalRes.json());
      }
      if (mapRes.ok) {
        setMapHistory(await mapRes.json());
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
      const res = await fetch('/api/clinician/spinalcord/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId,
          neurologicalLevelOfInjury: nli,
          hoursSinceInjury,
          motorScoreTotal,
          sensoryScoreTotal,
          sacralSparingSensory,
          sacralSparingMotor,
          keyMusclesBelowNliGrade3Percent: keyMusclesGrade3Percent,
          bulbocavernosusReflexPresent: bulbocavernosusReflex,
          currentSbp,
          currentDbp,
          currentMap,
          currentHeartRate,
          cordCompressionOnMri: cordCompression,
          spinalInstabilityPresent: spinalInstability,
          baselineSbp: baselineSbp > 0 ? baselineSbp : undefined,
          persist: true
        })
      });

      if (!res.ok) {
        throw new Error(`Evaluation failed with status ${res.status}`);
      }

      const data = await res.json();
      setEvaluationResult(data.evaluation);
      setStatusMessage('Spinal Cord Injury evaluated and AANS/CNS guidelines updated.');
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTitrateMap = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const res = await fetch('/api/clinician/spinalcord/map/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId,
          postInjuryHour,
          systolicBp: titrationSbp,
          diastolicBp: titrationDbp,
          mapMmhg: titrationMap,
          heartRate: titrationHeartRate,
          activeVasopressor,
          vasopressorDoseMcgMin: vasopressorDose,
          persist: true
        })
      });

      if (!res.ok) {
        throw new Error(`MAP Titration failed with status ${res.status}`);
      }

      const data = await res.json();
      setMapTitrationResult(data.titration);
      setStatusMessage('Hourly MAP augmentation logged successfully.');
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getAsiaBadgeStyle = (grade: string) => {
    switch (grade) {
      case 'A':
        return { bg: '#7f1d1d', border: '#ef4444', color: '#fca5a5', label: 'ASIA GRADE A (COMPLETE)' };
      case 'B':
        return { bg: '#78350f', border: '#f59e0b', color: '#fde68a', label: 'ASIA GRADE B (SENSORY INCOMPLETE)' };
      case 'C':
        return { bg: '#4c1d95', border: '#a855f7', color: '#e9d5ff', label: 'ASIA GRADE C (MOTOR INCOMPLETE < 50%)' };
      case 'D':
        return { bg: '#1e3a8a', border: '#3b82f6', color: '#bfdbfe', label: 'ASIA GRADE D (MOTOR INCOMPLETE >= 50%)' };
      case 'E':
        return { bg: '#064e3b', border: '#10b981', color: '#6ee7b7', label: 'ASIA GRADE E (NORMAL RECOVERY)' };
      default:
        return { bg: '#1e293b', border: '#64748b', color: '#cbd5e1', label: grade };
    }
  };

  const getSurgicalWindowBadge = (windowStatus: string) => {
    switch (windowStatus) {
      case 'ULTRA_EARLY_OPTIMAL':
        return { bg: '#064e3b', border: '#10b981', color: '#6ee7b7', label: 'ULTRA-EARLY (< 12H OPTIMAL)' };
      case 'EARLY_ACCEPTABLE':
        return { bg: '#78350f', border: '#f59e0b', color: '#fde68a', label: 'EARLY (< 24H ACCEPTABLE)' };
      case 'DELAYED':
        return { bg: '#7f1d1d', border: '#ef4444', color: '#fca5a5', label: 'DELAYED (> 24H WINDOW ELAPSED)' };
      default:
        return { bg: '#1e293b', border: '#64748b', color: '#cbd5e1', label: windowStatus };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #042f2e 0%, #0f172a 100%)',
        padding: '20px 24px',
        borderRadius: '12px',
        border: '1px solid #14b8a6',
        boxShadow: '0 4px 20px rgba(20, 184, 166, 0.15)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '10px' }}>
              🦴 SPINAL-CORD
              <span style={{ fontSize: '13px', background: '#0d9488', color: '#ccfbf1', padding: '3px 10px', borderRadius: '12px', fontWeight: '600' }}>
                AANS / CNS Guidelines Sentinel
              </span>
            </h2>
            <p style={{ margin: '6px 0 0', color: '#99f6e4', fontSize: '14px' }}>
              Acute Spinal Cord Injury, ASIA Scale, Neurogenic Shock Sentinel & 7-Day MAP Augmentation Protocol
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>Patient Bed / MRN:</span>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#e0e7ff' }}>ICU-TRAUMA-{patientId.toString().padStart(3, '0')}</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
          <button
            onClick={() => setActiveTab('evaluator')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: activeTab === 'evaluator' ? '1px solid #2dd4bf' : '1px solid #374151',
              background: activeTab === 'evaluator' ? '#115e59' : '#1e1e2f',
              color: activeTab === 'evaluator' ? '#ffffff' : '#9ca3af',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '13px'
            }}
          >
            📋 ASIA Scale & Injury Assessment
          </button>
          <button
            onClick={() => setActiveTab('map_titrator')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: activeTab === 'map_titrator' ? '1px solid #2dd4bf' : '1px solid #374151',
              background: activeTab === 'map_titrator' ? '#115e59' : '#1e1e2f',
              color: activeTab === 'map_titrator' ? '#ffffff' : '#9ca3af',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '13px'
            }}
          >
            📈 MAP Augmentation Titrator (85-90 mmHg)
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: activeTab === 'history' ? '1px solid #2dd4bf' : '1px solid #374151',
              background: activeTab === 'history' ? '#115e59' : '#1e1e2f',
              color: activeTab === 'history' ? '#ffffff' : '#9ca3af',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '13px'
            }}
          >
            🕒 Audit Trail & Surveillance Logs
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
              Neurological Level & Examination Parameters
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>Neurological Level of Injury (NLI)</label>
                <select
                  value={nli}
                  onChange={e => setNli(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', marginTop: '4px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#ffffff' }}
                >
                  <optgroup label="Cervical (Tetraplegia, High Sympathetic Risk)">
                    <option value="C1">C1</option>
                    <option value="C2">C2</option>
                    <option value="C3">C3 (Diaphragm Risk)</option>
                    <option value="C4">C4</option>
                    <option value="C5">C5 (Biceps)</option>
                    <option value="C6">C6 (Wrist Extensors)</option>
                    <option value="C7">C7 (Triceps)</option>
                    <option value="C8">C8 (Finger Flexors)</option>
                  </optgroup>
                  <optgroup label="Thoracic (Paraplegia, Autonomic Risk T1-T6)">
                    <option value="T1">T1 (Hand Intrinsics)</option>
                    <option value="T2">T2</option>
                    <option value="T3">T3</option>
                    <option value="T4">T4 (Nipple Line)</option>
                    <option value="T6">T6 (Xiphoid / Sympathetic Cutoff)</option>
                    <option value="T10">T10 (Umbilicus)</option>
                    <option value="T12">T12</option>
                  </optgroup>
                  <optgroup label="Lumbar / Sacral">
                    <option value="L1">L1</option>
                    <option value="L2">L2 (Hip Flexors)</option>
                    <option value="L3">L3 (Knee Extensors)</option>
                    <option value="L4">L4 (Ankle Dorsiflexors)</option>
                    <option value="L5">L5 (Long Toe Extensors)</option>
                    <option value="S1">S1 (Ankle Plantarflexors)</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>Hours Since Acute Injury</label>
                <input
                  type="number"
                  value={hoursSinceInjury}
                  onChange={e => setHoursSinceInjury(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px 10px', marginTop: '4px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#ffffff' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>Motor Score Total (0-100)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={motorScoreTotal}
                  onChange={e => setMotorScoreTotal(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px 10px', marginTop: '4px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#ffffff' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>Sensory Score Total (0-224)</label>
                <input
                  type="number"
                  min="0"
                  max="224"
                  value={sensoryScoreTotal}
                  onChange={e => setSensoryScoreTotal(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px 10px', marginTop: '4px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#ffffff' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>Key Muscles Below NLI &ge; 3/5 (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={keyMusclesGrade3Percent}
                  onChange={e => setKeyMusclesGrade3Percent(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px 10px', marginTop: '4px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#ffffff' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>Baseline SBP (mmHg)</label>
                <input
                  type="number"
                  value={baselineSbp}
                  onChange={e => setBaselineSbp(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px 10px', marginTop: '4px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#ffffff' }}
                />
              </div>
            </div>

            {/* Sacral Sparing & Reflexes Toggles */}
            <div style={{ marginTop: '16px', padding: '12px', background: '#1f2937', borderRadius: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#e5e7eb' }}>Sacral Sparing & Reflex Status</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#cbd5e1' }}>
                  <input
                    type="checkbox"
                    checked={sacralSparingSensory}
                    onChange={e => setSacralSparingSensory(e.target.checked)}
                  />
                  S4-S5 Sensation / Deep Anal Pressure (DAP)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#cbd5e1' }}>
                  <input
                    type="checkbox"
                    checked={sacralSparingMotor}
                    onChange={e => setSacralSparingMotor(e.target.checked)}
                  />
                  Voluntary Anal Contraction (VAC)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#cbd5e1' }}>
                  <input
                    type="checkbox"
                    checked={bulbocavernosusReflex}
                    onChange={e => setBulbocavernosusReflex(e.target.checked)}
                  />
                  Bulbocavernosus Reflex Present
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#cbd5e1' }}>
                  <input
                    type="checkbox"
                    checked={cordCompression}
                    onChange={e => setCordCompression(e.target.checked)}
                  />
                  MRI Cord Compression Present
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#cbd5e1' }}>
                  <input
                    type="checkbox"
                    checked={spinalInstability}
                    onChange={e => setSpinalInstability(e.target.checked)}
                  />
                  Spinal Instability / Fracture Dislocation
                </label>
              </div>

              {/* Hemodynamics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', marginTop: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8' }}>SBP (mmHg)</label>
                  <input
                    type="number"
                    value={currentSbp}
                    onChange={e => setCurrentSbp(Number(e.target.value))}
                    style={{ width: '100%', padding: '6px', marginTop: '2px', background: '#111827', border: '1px solid #4b5563', borderRadius: '4px', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8' }}>DBP (mmHg)</label>
                  <input
                    type="number"
                    value={currentDbp}
                    onChange={e => setCurrentDbp(Number(e.target.value))}
                    style={{ width: '100%', padding: '6px', marginTop: '2px', background: '#111827', border: '1px solid #4b5563', borderRadius: '4px', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8' }}>MAP (mmHg)</label>
                  <input
                    type="number"
                    value={currentMap}
                    onChange={e => setCurrentMap(Number(e.target.value))}
                    style={{ width: '100%', padding: '6px', marginTop: '2px', background: '#111827', border: '1px solid #4b5563', borderRadius: '4px', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8' }}>Heart Rate (bpm)</label>
                  <input
                    type="number"
                    value={currentHeartRate}
                    onChange={e => setCurrentHeartRate(Number(e.target.value))}
                    style={{ width: '100%', padding: '6px', marginTop: '2px', background: '#111827', border: '1px solid #4b5563', borderRadius: '4px', color: '#fff' }}
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleEvaluate}
              disabled={isLoading}
              style={{
                width: '100%',
                marginTop: '18px',
                padding: '12px',
                background: '#0d9488',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              {isLoading ? 'Classifying Injury...' : '⚡ Classify ASIA & Formulate MAP Protocol'}
            </button>
          </div>

          {/* Results Panel */}
          <div style={{ background: '#111827', padding: '20px', borderRadius: '12px', border: '1px solid #1f2937' }}>
            {evaluationResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* ASIA Grade Badge */}
                <div style={{
                  padding: '14px 18px',
                  borderRadius: '10px',
                  background: getAsiaBadgeStyle(evaluationResult.asiaGrade).bg,
                  border: `2px solid ${getAsiaBadgeStyle(evaluationResult.asiaGrade).border}`,
                  color: getAsiaBadgeStyle(evaluationResult.asiaGrade).color,
                  fontWeight: 'bold',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: '16px' }}>{getAsiaBadgeStyle(evaluationResult.asiaGrade).label}</span>
                  <span style={{ fontSize: '13px' }}>NLI: {evaluationResult.neurologicalLevelOfInjury}</span>
                </div>

                {/* Surgical Decompression Window Badge */}
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: getSurgicalWindowBadge(evaluationResult.decompressionWindowStatus).bg,
                  border: `1.5px solid ${getSurgicalWindowBadge(evaluationResult.decompressionWindowStatus).border}`,
                  color: getSurgicalWindowBadge(evaluationResult.decompressionWindowStatus).color,
                  fontSize: '13px',
                  fontWeight: 'bold',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <span>SURGICAL DECOMPRESSION:</span>
                  <span>{getSurgicalWindowBadge(evaluationResult.decompressionWindowStatus).label}</span>
                </div>

                {/* Neurogenic Shock Box */}
                {evaluationResult.neurogenicShockActive && (
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    background: '#7f1d1d',
                    border: '2px solid #ef4444',
                    color: '#fee2e2'
                  }}>
                    <strong style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      ⚠️ NEUROGENIC SHOCK ACTIVE:
                    </strong>
                    <p style={{ margin: '4px 0 0', fontSize: '12px' }}>
                      Hypotension with relative bradycardia due to sympathetic disruption ({evaluationResult.neurologicalLevelOfInjury}). Initiate {evaluationResult.mapTargetGoal.recommendedVasopressor}.
                    </p>
                    <div style={{ marginTop: '6px', fontSize: '11px', color: '#fca5a5' }}>
                      {evaluationResult.mapTargetGoal.contraindicatedAgents.join(' | ')}
                    </div>
                  </div>
                )}

                {/* Hemorrhagic Shock Warning */}
                {evaluationResult.concomitantHemorrhagicShockSuspected && (
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    background: '#78350f',
                    border: '2px solid #f59e0b',
                    color: '#fef3c7'
                  }}>
                    <strong>⚠️ CONCOMITANT OCCULT HEMORRHAGE SUSPECTED:</strong>
                    <p style={{ margin: '4px 0 0', fontSize: '12px' }}>
                      Tachycardia with hypotension suggests occult bleeding (pelvic/abdominal) rather than pure neurogenic shock. Order emergent eFAST ultrasound and blood products.
                    </p>
                  </div>
                )}

                {/* MAP Augmentation Target Goal */}
                <div style={{ background: '#1f2937', padding: '14px', borderRadius: '8px', borderLeft: '4px solid #14b8a6' }}>
                  <span style={{ fontSize: '12px', color: '#2dd4bf', fontWeight: 'bold' }}>7-DAY MAP AUGMENTATION PROTOCOL</span>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ffffff', marginTop: '4px' }}>
                    Target MAP &ge; {evaluationResult.mapTargetGoal.minMapMmhg} - {evaluationResult.mapTargetGoal.maxMapMmhg} mmHg
                  </div>
                  <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '4px' }}>
                    Duration: {evaluationResult.mapTargetGoal.durationDays} days ({evaluationResult.mapTargetGoal.durationHoursTotal} hours continuously)
                  </div>
                  <div style={{ fontSize: '12px', color: '#99f6e4', marginTop: '2px' }}>
                    Preferred Agent: {evaluationResult.mapTargetGoal.recommendedVasopressor}
                  </div>
                </div>

                {/* Directives Checklist */}
                <div style={{ background: '#1f2937', padding: '14px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 'bold' }}>CLINICAL ACTION DIRECTIVES</span>
                  <ul style={{ margin: '8px 0 0', paddingLeft: '18px', fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5 }}>
                    {evaluationResult.protocolDirectives.map((d, i) => (
                      <li key={i} style={{ marginBottom: '4px' }}>{d}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                <p>Complete the neurological assessment and click "Classify ASIA" to generate AANS/CNS consensus protocols.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: MAP Augmentation Titrator */}
      {activeTab === 'map_titrator' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ background: '#111827', padding: '20px', borderRadius: '12px', border: '1px solid #1f2937' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#f3f4f6', fontWeight: '700' }}>
              Hourly Hemodynamic MAP Surveillance
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>
                  Post-Injury Hour: <strong style={{ color: '#2dd4bf' }}>Hour {postInjuryHour}</strong> (Target 168 Hours Total)
                </label>
                <input
                  type="range"
                  min="1"
                  max="168"
                  value={postInjuryHour}
                  onChange={e => setPostInjuryHour(Number(e.target.value))}
                  style={{ width: '100%', marginTop: '6px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>Systolic BP (mmHg)</label>
                  <input
                    type="number"
                    value={titrationSbp}
                    onChange={e => setTitrationSbp(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#ffffff' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>Diastolic BP (mmHg)</label>
                  <input
                    type="number"
                    value={titrationDbp}
                    onChange={e => setTitrationDbp(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#ffffff' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>Mean Arterial Pressure (MAP, mmHg)</label>
                  <input
                    type="number"
                    value={titrationMap}
                    onChange={e => setTitrationMap(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#ffffff' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>Heart Rate (bpm)</label>
                  <input
                    type="number"
                    value={titrationHeartRate}
                    onChange={e => setTitrationHeartRate(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#ffffff' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>Active Vasopressor</label>
                  <select
                    value={activeVasopressor}
                    onChange={e => setActiveVasopressor(e.target.value)}
                    style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#ffffff' }}
                  >
                    <option value="Norepinephrine">Norepinephrine (First-Line)</option>
                    <option value="Phenylephrine">Phenylephrine (Low Lesions Only)</option>
                    <option value="Epinephrine">Epinephrine</option>
                    <option value="Dopamine">Dopamine</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>Dose (&mu;g/min)</label>
                  <input
                    type="number"
                    step="1"
                    value={vasopressorDose}
                    onChange={e => setVasopressorDose(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#ffffff' }}
                  />
                </div>
              </div>

              <button
                onClick={handleTitrateMap}
                disabled={isLoading}
                style={{
                  width: '100%',
                  marginTop: '10px',
                  padding: '12px',
                  background: '#0d9488',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                {isLoading ? 'Titrating...' : '📈 Evaluate MAP & Log Titration Directive'}
              </button>
            </div>
          </div>

          {/* MAP Titration Analysis Panel */}
          <div style={{ background: '#111827', padding: '20px', borderRadius: '12px', border: '1px solid #1f2937' }}>
            {mapTitrationResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{
                  padding: '16px',
                  borderRadius: '10px',
                  background: mapTitrationResult.targetMet ? '#064e3b' : mapTitrationResult.ischemiaRiskAlert ? '#7f1d1d' : '#78350f',
                  border: `2px solid ${mapTitrationResult.targetMet ? '#10b981' : mapTitrationResult.ischemiaRiskAlert ? '#ef4444' : '#f59e0b'}`,
                  color: '#ffffff'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
                      {mapTitrationResult.targetMet ? '✓ TARGET MAP ACHIEVED (85-95 mmHg)' : `ACTION REQUIRED: ${mapTitrationResult.vasopressorAction}`}
                    </span>
                    <span style={{ fontSize: '12px', background: 'rgba(0,0,0,0.3)', padding: '4px 8px', borderRadius: '4px' }}>
                      Hour {mapTitrationResult.postInjuryHour}
                    </span>
                  </div>
                  <p style={{ margin: '10px 0 0', fontSize: '13px', lineHeight: 1.5 }}>
                    {mapTitrationResult.actionPlan}
                  </p>
                </div>

                <div style={{ background: '#1f2937', padding: '14px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 'bold' }}>HEMODYNAMIC TITRATION METRICS</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '10px' }}>
                    <div style={{ background: '#111827', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>MAP</div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2dd4bf' }}>{mapTitrationResult.mapMmhg} mmHg</div>
                    </div>
                    <div style={{ background: '#111827', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>Heart Rate</div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2dd4bf' }}>{mapTitrationResult.heartRate} bpm</div>
                    </div>
                    <div style={{ background: '#111827', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>Vasopressor</div>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#2dd4bf', marginTop: '3px' }}>
                        {mapTitrationResult.vasopressorDoseMcgMin || 0} &mu;g/min
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                <p>Input hourly blood pressure and vasopressor parameters to evaluate spinal cord perfusion targets.</p>
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
              Historical Spinal Cord Evaluations
            </h3>
            {evalHistory.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '13px' }}>No recorded evaluations for this patient yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {evalHistory.map(item => (
                  <div key={item.id} style={{ padding: '12px', background: '#1f2937', borderRadius: '8px', borderLeft: '4px solid #14b8a6' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}>
                      <span style={{ color: '#ffffff' }}>ASIA Grade {item.asia_grade} | NLI: {item.neurological_level_of_injury}</span>
                      <span style={{ color: '#9ca3af' }}>{new Date(item.evaluated_at).toLocaleString()}</span>
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#cbd5e1' }}>
                      Decompression: {item.decompression_window_status} | Vasopressor: {item.recommended_vasopressor}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: '#111827', padding: '20px', borderRadius: '12px', border: '1px solid #1f2937' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '16px', color: '#f3f4f6', fontWeight: '700' }}>
              Hourly MAP Augmentation Logs
            </h3>
            {mapHistory.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '13px' }}>No hourly MAP logs recorded yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {mapHistory.map(item => (
                  <div key={item.id} style={{ padding: '12px', background: '#1f2937', borderRadius: '8px', borderLeft: `4px solid ${item.target_met ? '#10b981' : '#f59e0b'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}>
                      <span style={{ color: '#ffffff' }}>Hour {item.post_injury_hour}: MAP {item.map_mmhg} mmHg ({item.active_vasopressor || 'None'})</span>
                      <span style={{ color: '#9ca3af' }}>{new Date(item.logged_at).toLocaleString()}</span>
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#cbd5e1' }}>{item.action_plan}</p>
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
