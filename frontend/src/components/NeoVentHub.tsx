import React, { useState, useEffect } from 'react';

interface VentilatoryAdjustment {
  parameter: string;
  currentValue: string | number;
  recommendedChange: string;
  rationale: string;
}

interface NeoVentEvaluationResult {
  gestationalCategory: string;
  weightCategory: string;
  oxygenationIndex?: number;
  oxygenationIndexSeverity?: 'NORMAL_OR_MILD' | 'MODERATE' | 'SEVERE_INO_INDICATION' | 'CRITICAL_ECMO_THRESHOLD';
  targetSpo2Range: string;
  targetPco2Range: string;
  bloodGasInterpretation: string;
  ventAdjustments: VentilatoryAdjustment[];
  clinicalDirectives: string[];
}

interface SurfactantCalculationResult {
  surfactantType: string;
  doseNumber: number;
  doseMgPerKg: number;
  totalMg: number;
  concentrationMgPerMl: number;
  totalVolumeMl: number;
  deliveryTechnique: string;
  lisaFeasibility: {
    feasible: boolean;
    criteria: string;
  };
  postAdministrationChecklist: string[];
}

export const NeoVentHub: React.FC = () => {
  const [patientId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'vent_optimizer' | 'surfactant_protocol' | 'history'>('vent_optimizer');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Tab 1: Neonatal Vent State
  const [gaWeeks, setGaWeeks] = useState<number>(26.4);
  const [birthWeightGrams, setBirthWeightGrams] = useState<number>(850);
  const [currentWeightGrams, setCurrentWeightGrams] = useState<number>(820);
  const [postnatalDays, setPostnatalDays] = useState<number>(2);
  const [diagnosis, setDiagnosis] = useState<'RDS' | 'TTN' | 'MAS' | 'BPD' | 'PNEUMONIA' | 'PPHN'>('RDS');
  const [ventMode, setVentMode] = useState<'SIMV_VG' | 'HFOV' | 'HFJV' | 'CPAP' | 'NIPPV'>('SIMV_VG');

  // Vent settings
  const [fio2Pct, setFio2Pct] = useState<number>(35);
  const [peep, setPeep] = useState<number>(6);
  const [pip, setPip] = useState<number>(20);
  const [mapVal, setMapVal] = useState<number>(11);
  const [vtMlPerKg, setVtMlPerKg] = useState<number>(4.5);
  const [rateBpm, setRateBpm] = useState<number>(45);
  const [freqHz, setFreqHz] = useState<number>(12);
  const [amplitude, setAmplitude] = useState<number>(26);

  // Blood Gas
  const [gasPh, setGasPh] = useState<number>(7.28);
  const [gasPco2, setGasPco2] = useState<number>(54);
  const [gasPo2, setGasPo2] = useState<number>(58);
  const [gasSpo2, setGasSpo2] = useState<number>(92);
  const [ventResult, setVentResult] = useState<NeoVentEvaluationResult | null>(null);

  // Tab 2: Surfactant State
  const [surfWeightKg, setSurfWeightKg] = useState<number>(0.85);
  const [surfactantType, setSurfactantType] = useState<'PORACTANT_ALFA' | 'BERACTANT' | 'CALFACTANT'>('PORACTANT_ALFA');
  const [doseNumber, setDoseNumber] = useState<1 | 2 | 3>(1);
  const [deliveryTechnique, setDeliveryTechnique] = useState<'LISA' | 'INSURE' | 'STANDARD_ETT'>('LISA');
  const [preFio2, setPreFio2] = useState<number>(0.35);
  const [onCpap, setOnCpap] = useState<boolean>(true);
  const [surfResult, setSurfResult] = useState<SurfactantCalculationResult | null>(null);

  // Tab 3: History State
  const [ventHistory, setVentHistory] = useState<any[]>([]);
  const [surfHistory, setSurfHistory] = useState<any[]>([]);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [resVent, resSurf] = await Promise.all([
        fetch(`/api/clinician/neovent/records/${patientId}`, { headers }),
        fetch(`/api/clinician/neovent/surfactant/${patientId}`, { headers })
      ]);

      if (resVent.ok) {
        const data = await resVent.json();
        setVentHistory(data);
      }
      if (resSurf.ok) {
        const data = await resSurf.json();
        setSurfHistory(data);
      }
    } catch (err) {
      console.error('Failed to fetch neovent history:', err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [patientId]);

  // Evaluate Ventilation
  const handleEvaluateVent = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/clinician/neovent/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId,
          gestationalAgeWeeks: gaWeeks,
          birthWeightGrams,
          currentWeightGrams,
          postnatalAgeDays: postnatalDays,
          diagnosis,
          settings: {
            mode: ventMode,
            fio2: fio2Pct / 100,
            peepMmh2o: peep,
            pipMmh2o: pip,
            mapMmh2o: ventMode === 'HFOV' ? mapVal : undefined,
            tidalVolumeMlPerKg: vtMlPerKg,
            rateBpm,
            frequencyHz: freqHz,
            amplitudeDeltaP: amplitude
          },
          bloodGas: {
            pH: gasPh,
            pCO2: gasPco2,
            pO2: gasPo2,
            spO2: gasSpo2
          },
          saveRecord: true
        })
      });

      if (!res.ok) throw new Error('Failed to evaluate ventilation');
      const data = await res.json();
      setVentResult(data.evaluation);
      setStatusMessage('Neonatal ventilation & gas exchange targets evaluated & recorded.');
      fetchHistory();
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate Surfactant
  const handleCalculateSurfactant = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/clinician/neovent/surfactant/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId,
          currentWeightKg: surfWeightKg,
          surfactantType,
          doseNumber,
          deliveryTechnique,
          preFio2,
          onCpap,
          saveLog: true
        })
      });

      if (!res.ok) throw new Error('Failed to calculate surfactant replacement');
      const data = await res.json();
      setSurfResult(data.calculation);
      setStatusMessage('Surfactant replacement dose & administration protocol generated.');
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
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#06b6d4', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <span>🫁</span> NEO-VENT: Neonatal Mechanical Ventilation & Surfactant Replacement
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: '4px 0 0 0' }}>
            Volume Guarantee (SIMV-VG), HFOV Oscillator Physics, Permissive Hypercapnia, Oxygenation Index (OI) & LISA Surfactant
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span style={{ backgroundColor: '#1e293b', border: '1px solid #475569', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', color: '#cbd5e1' }}>
            NICU Patient ID: <strong>#{patientId}</strong>
          </span>
          <span style={{ backgroundColor: '#1e293b', border: '1px solid #475569', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', color: '#cbd5e1' }}>
            GA: <strong>{gaWeeks} wks</strong> ({birthWeightGrams}g)
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('vent_optimizer')}
          style={{
            padding: '10px 16px',
            backgroundColor: activeTab === 'vent_optimizer' ? '#0891b2' : '#1e293b',
            color: activeTab === 'vent_optimizer' ? '#ffffff' : '#94a3b8',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          🫁 Ventilator Physics & ABG Optimizer
        </button>
        <button
          onClick={() => setActiveTab('surfactant_protocol')}
          style={{
            padding: '10px 16px',
            backgroundColor: activeTab === 'surfactant_protocol' ? '#0891b2' : '#1e293b',
            color: activeTab === 'surfactant_protocol' ? '#ffffff' : '#94a3b8',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          💧 Surfactant Replacement & LISA Protocol
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            padding: '10px 16px',
            backgroundColor: activeTab === 'history' ? '#0891b2' : '#1e293b',
            color: activeTab === 'history' ? '#ffffff' : '#94a3b8',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          📋 NICU Ventilation & Surfactant Logs
        </button>
      </div>

      {statusMessage && (
        <div style={{ backgroundColor: '#164e63', color: '#a5f3fc', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>ℹ️</span> {statusMessage}
        </div>
      )}

      {/* Tab 1: VENT OPTIMIZER */}
      {activeTab === 'vent_optimizer' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Inputs */}
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
            <h3 style={{ fontSize: '16px', color: '#22d3ee', marginTop: 0, marginBottom: '16px' }}>
              Patient Demographics & Ventilation Parameters
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                  GA (weeks)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={gaWeeks}
                  onChange={e => setGaWeeks(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '4px', color: '#f8fafc' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                  Birth Wt (g)
                </label>
                <input
                  type="number"
                  value={birthWeightGrams}
                  onChange={e => {
                    const bw = parseFloat(e.target.value) || 0;
                    setBirthWeightGrams(bw);
                    setSurfWeightKg(Math.round((bw / 1000) * 100) / 100);
                  }}
                  style={{ width: '100%', padding: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '4px', color: '#f8fafc' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                  Current Wt (g)
                </label>
                <input
                  type="number"
                  value={currentWeightGrams}
                  onChange={e => setCurrentWeightGrams(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '4px', color: '#f8fafc' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                  Postnatal (days)
                </label>
                <input
                  type="number"
                  value={postnatalDays}
                  onChange={e => setPostnatalDays(parseInt(e.target.value) || 0)}
                  style={{ width: '100%', padding: '6px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '4px', color: '#f8fafc' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  Primary Diagnosis
                </label>
                <select
                  value={diagnosis}
                  onChange={e => setDiagnosis(e.target.value as any)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                >
                  <option value="RDS">Respiratory Distress Syndrome (RDS)</option>
                  <option value="TTN">Transient Tachypnea of the Newborn (TTN)</option>
                  <option value="MAS">Meconium Aspiration Syndrome (MAS)</option>
                  <option value="BPD">Bronchopulmonary Dysplasia (BPD)</option>
                  <option value="PPHN">Persistent Pulmonary Hypertension (PPHN)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  Ventilation Mode
                </label>
                <select
                  value={ventMode}
                  onChange={e => setVentMode(e.target.value as any)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                >
                  <option value="SIMV_VG">SIMV + Volume Guarantee (SIMV-VG)</option>
                  <option value="HFOV">High-Frequency Oscillator (HFOV)</option>
                  <option value="HFJV">High-Frequency Jet (HFJV)</option>
                  <option value="CPAP">Nasal CPAP</option>
                  <option value="NIPPV">Nasal IPPV (NIPPV)</option>
                </select>
              </div>
            </div>

            {/* Mode-specific settings */}
            <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', marginBottom: '14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#22d3ee', marginBottom: '8px' }}>
                Ventilator Machine Settings
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>
                    FiO2 (%)
                  </label>
                  <input
                    type="number"
                    value={fio2Pct}
                    onChange={e => setFio2Pct(parseFloat(e.target.value) || 0)}
                    style={{ width: '100%', padding: '6px', backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '4px', color: '#f8fafc' }}
                  />
                </div>
                {ventMode === 'SIMV_VG' && (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>
                        Set Vt (mL/kg)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={vtMlPerKg}
                        onChange={e => setVtMlPerKg(parseFloat(e.target.value) || 0)}
                        style={{ width: '100%', padding: '6px', backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '4px', color: '#f8fafc' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>
                        PEEP (cmH2O)
                      </label>
                      <input
                        type="number"
                        value={peep}
                        onChange={e => setPeep(parseFloat(e.target.value) || 0)}
                        style={{ width: '100%', padding: '6px', backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '4px', color: '#f8fafc' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>
                        PIP Limit (cmH2O)
                      </label>
                      <input
                        type="number"
                        value={pip}
                        onChange={e => setPip(parseFloat(e.target.value) || 0)}
                        style={{ width: '100%', padding: '6px', backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '4px', color: '#f8fafc' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>
                        Rate (bpm)
                      </label>
                      <input
                        type="number"
                        value={rateBpm}
                        onChange={e => setRateBpm(parseFloat(e.target.value) || 0)}
                        style={{ width: '100%', padding: '6px', backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '4px', color: '#f8fafc' }}
                      />
                    </div>
                  </>
                )}
                {ventMode === 'HFOV' && (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>
                        Mean Airway Pressure (MAP)
                      </label>
                      <input
                        type="number"
                        value={mapVal}
                        onChange={e => setMapVal(parseFloat(e.target.value) || 0)}
                        style={{ width: '100%', padding: '6px', backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '4px', color: '#f8fafc' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>
                        Frequency (Hz)
                      </label>
                      <input
                        type="number"
                        value={freqHz}
                        onChange={e => setFreqHz(parseFloat(e.target.value) || 0)}
                        style={{ width: '100%', padding: '6px', backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '4px', color: '#f8fafc' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>
                        Amplitude (Delta P cmH2O)
                      </label>
                      <input
                        type="number"
                        value={amplitude}
                        onChange={e => setAmplitude(parseFloat(e.target.value) || 0)}
                        style={{ width: '100%', padding: '6px', backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '4px', color: '#f8fafc' }}
                      />
                    </div>
                  </>
                )}
                {(ventMode === 'CPAP' || ventMode === 'NIPPV') && (
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>
                      CPAP Pressure (cmH2O)
                    </label>
                    <input
                      type="number"
                      value={peep}
                      onChange={e => setPeep(parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', padding: '6px', backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '4px', color: '#f8fafc' }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Blood Gas */}
            <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#22d3ee', marginBottom: '8px' }}>
                Arterial / Capillary Blood Gas (ABG/CBG)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>pH</label>
                  <input
                    type="number"
                    step="0.01"
                    value={gasPh}
                    onChange={e => setGasPh(parseFloat(e.target.value) || 0)}
                    style={{ width: '100%', padding: '6px', backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '4px', color: '#f8fafc' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>pCO2</label>
                  <input
                    type="number"
                    value={gasPco2}
                    onChange={e => setGasPco2(parseFloat(e.target.value) || 0)}
                    style={{ width: '100%', padding: '6px', backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '4px', color: '#f8fafc' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>pO2</label>
                  <input
                    type="number"
                    value={gasPo2}
                    onChange={e => setGasPo2(parseFloat(e.target.value) || 0)}
                    style={{ width: '100%', padding: '6px', backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '4px', color: '#f8fafc' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>SpO2 (%)</label>
                  <input
                    type="number"
                    value={gasSpo2}
                    onChange={e => setGasSpo2(parseFloat(e.target.value) || 0)}
                    style={{ width: '100%', padding: '6px', backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '4px', color: '#f8fafc' }}
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleEvaluateVent}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#0891b2',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '14px'
              }}
            >
              {isLoading ? 'Optimizing Vent Physics...' : 'Optimize Ventilation & Blood Gas Targets'}
            </button>
          </div>

          {/* Results */}
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
            <h3 style={{ fontSize: '16px', color: '#22d3ee', marginTop: 0, marginBottom: '16px' }}>
              Precision Neonatal Gas Exchange Analysis
            </h3>

            {ventResult ? (
              <div>
                {/* Badges */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                  <span style={{ backgroundColor: '#0f172a', border: '1px solid #06b6d4', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', color: '#22d3ee' }}>
                    {ventResult.gestationalCategory}
                  </span>
                  <span style={{ backgroundColor: '#0f172a', border: '1px solid #06b6d4', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', color: '#22d3ee' }}>
                    {ventResult.weightCategory}
                  </span>
                  {ventResult.oxygenationIndex !== undefined && (
                    <span style={{
                      backgroundColor: ventResult.oxygenationIndexSeverity?.includes('CRITICAL') ? '#ef4444' : ventResult.oxygenationIndexSeverity?.includes('SEVERE') ? '#f59e0b' : '#059669',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      color: '#fff'
                    }}>
                      OI: {ventResult.oxygenationIndex} ({ventResult.oxygenationIndexSeverity?.replace(/_/g, ' ')})
                    </span>
                  )}
                </div>

                {/* Targets Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ backgroundColor: '#0f172a', padding: '10px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>Target SpO2 (ROP/BPD Guard)</div>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#22d3ee', marginTop: '2px' }}>
                      {ventResult.targetSpo2Range}
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#0f172a', padding: '10px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>Target pCO2 (Permissive Target)</div>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#22d3ee', marginTop: '2px' }}>
                      {ventResult.targetPco2Range}
                    </div>
                  </div>
                </div>

                {/* Blood gas interpretation */}
                <div style={{ backgroundColor: 'rgba(6, 182, 212, 0.1)', border: '1px solid #0891b2', padding: '10px 12px', borderRadius: '6px', marginBottom: '14px', fontSize: '13px' }}>
                  <strong>Blood Gas Status:</strong> {ventResult.bloodGasInterpretation}
                </div>

                {/* Adjustments */}
                <div style={{ marginBottom: '14px' }}>
                  <h4 style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 8px 0' }}>Actionable Ventilator Adjustments</h4>
                  {ventResult.ventAdjustments.length > 0 ? (
                    ventResult.ventAdjustments.map((adj, idx) => (
                      <div key={idx} style={{ backgroundColor: '#0f172a', padding: '8px 10px', borderRadius: '4px', marginBottom: '6px', fontSize: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: '#22d3ee' }}>
                          <span>{adj.parameter} (Current: {adj.currentValue})</span>
                          <span style={{ color: '#f59e0b' }}>➔ {adj.recommendedChange}</span>
                        </div>
                        <div style={{ color: '#94a3b8', marginTop: '2px' }}><em>Rationale:</em> {adj.rationale}</div>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: '#10b981', fontSize: '13px' }}>✅ Current ventilator settings achieve all targeted gas exchange parameters.</div>
                  )}
                </div>

                {/* Directives */}
                {ventResult.clinicalDirectives.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 8px 0' }}>Critical Clinical Directives</h4>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#f87171', lineHeight: '1.5' }}>
                      {ventResult.clinicalDirectives.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', marginTop: '60px' }}>
                Enter baby's gestational age, settings, and blood gas values, then click "Optimize Ventilation & Blood Gas Targets".
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: SURFACTANT PROTOCOL */}
      {activeTab === 'surfactant_protocol' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
            <h3 style={{ fontSize: '16px', color: '#22d3ee', marginTop: 0, marginBottom: '16px' }}>
              Surfactant Dosing & Administration Protocol
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  Current Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={surfWeightKg}
                  onChange={e => setSurfWeightKg(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  Surfactant Preparation
                </label>
                <select
                  value={surfactantType}
                  onChange={e => setSurfactantType(e.target.value as any)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                >
                  <option value="PORACTANT_ALFA">Poractant alfa (Curosurf, 80 mg/mL)</option>
                  <option value="BERACTANT">Beractant (Survanta, 25 mg/mL)</option>
                  <option value="CALFACTANT">Calfactant (Infasurf, 35 mg/mL)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  Dose Sequence
                </label>
                <select
                  value={doseNumber}
                  onChange={e => setDoseNumber(parseInt(e.target.value) as any)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                >
                  <option value={1}>Dose #1 (Initial)</option>
                  <option value={2}>Dose #2 (Repeat)</option>
                  <option value={3}>Dose #3 (Repeat)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  Delivery Technique
                </label>
                <select
                  value={deliveryTechnique}
                  onChange={e => setDeliveryTechnique(e.target.value as any)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                >
                  <option value="LISA">LISA (Less Invasive via Thin Catheter on CPAP)</option>
                  <option value="INSURE">INSURE (Intubate-SURfactant-Extubate)</option>
                  <option value="STANDARD_ETT">Standard ETT Instillation</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', marginBottom: '8px' }}>
                <input
                  type="checkbox"
                  checked={onCpap}
                  onChange={e => setOnCpap(e.target.checked)}
                />
                Infant is breathing spontaneously on nasal CPAP
              </label>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  Pre-Surfactant FiO2 Requirement
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={preFio2}
                  onChange={e => setPreFio2(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
            </div>

            <button
              onClick={handleCalculateSurfactant}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#0891b2',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '14px'
              }}
            >
              {isLoading ? 'Calculating...' : 'Calculate Surfactant Dose & Protocol'}
            </button>
          </div>

          {/* Results */}
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
            <h3 style={{ fontSize: '16px', color: '#22d3ee', marginTop: 0, marginBottom: '16px' }}>
              Surfactant Administration Directives
            </h3>

            {surfResult ? (
              <div>
                {/* Dose Card */}
                <div style={{ backgroundColor: '#0f172a', padding: '14px', borderRadius: '8px', marginBottom: '16px', borderLeft: '4px solid #06b6d4' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#22d3ee' }}>
                      Total Volume: {surfResult.totalVolumeMl} mL
                    </span>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                      {surfResult.totalMg} mg ({surfResult.doseMgPerKg} mg/kg)
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '4px' }}>
                    {surfResult.surfactantType} ({surfResult.concentrationMgPerMl} mg/mL) - Dose #{surfResult.doseNumber}
                  </div>
                </div>

                {/* LISA Feasibility */}
                <div style={{ backgroundColor: surfResult.lisaFeasibility.feasible ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)', border: `1px solid ${surfResult.lisaFeasibility.feasible ? '#10b981' : '#f59e0b'}`, padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>
                  <div style={{ fontWeight: 'bold', color: surfResult.lisaFeasibility.feasible ? '#34d399' : '#fbbf24' }}>
                    {surfResult.lisaFeasibility.feasible ? '✅ LISA TECHNIQUE FEASIBLE' : '⚠️ DELIVERY TECHNIQUE DIRECTIVE'}
                  </div>
                  <div style={{ marginTop: '4px', color: '#e2e8f0' }}>
                    {surfResult.lisaFeasibility.criteria}
                  </div>
                </div>

                {/* Checklist */}
                <div>
                  <h4 style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 8px 0' }}>Administration & Weaning Protocol</h4>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#cbd5e1', lineHeight: '1.6' }}>
                    {surfResult.postAdministrationChecklist.map((item, idx) => (
                      <li key={idx} style={{ color: item.includes('WARNING') ? '#f87171' : '#cbd5e1' }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', marginTop: '60px' }}>
                Set weight and surfactant product, then click "Calculate Surfactant Dose & Protocol".
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: HISTORY */}
      {activeTab === 'history' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
            <h3 style={{ fontSize: '16px', color: '#22d3ee', marginTop: 0, marginBottom: '16px' }}>
              Ventilation Evaluations Log
            </h3>
            {ventHistory.length > 0 ? (
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {ventHistory.map((v, i) => (
                  <div key={i} style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', marginBottom: '10px', borderLeft: '4px solid #06b6d4' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}>
                      <span>{v.vent_mode} ({v.diagnosis})</span>
                      <span style={{ color: '#22d3ee' }}>GA: {v.gestational_age_weeks}w</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                      pH {v.blood_gas?.pH} | pCO2 {v.blood_gas?.pCO2} | SpO2 {v.blood_gas?.spO2}% {v.oxygenation_index ? `| OI: ${v.oxygenation_index}` : ''}
                    </div>
                    <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '4px' }}>
                      {v.clinical_recommendations}
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
                      {new Date(v.logged_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#64748b', fontSize: '13px' }}>No ventilation records found.</div>
            )}
          </div>

          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
            <h3 style={{ fontSize: '16px', color: '#22d3ee', marginTop: 0, marginBottom: '16px' }}>
              Surfactant Administration Logs
            </h3>
            {surfHistory.length > 0 ? (
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {surfHistory.map((s, i) => (
                  <div key={i} style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', marginBottom: '10px', borderLeft: '4px solid #10b981' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}>
                      <span>{s.surfactant_type} (Dose #{s.dose_number})</span>
                      <span style={{ color: '#10b981' }}>{s.delivery_technique}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                      Dose: {s.dose_mg_per_kg} mg/kg | Volume: {s.total_dose_ml} mL | Pre-FiO2: {s.pre_fio2}
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
                      {new Date(s.administered_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#64748b', fontSize: '13px' }}>No surfactant logs recorded.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
export default NeoVentHub;
