import React, { useState, useEffect } from 'react';

interface LungPgdResult {
  pao2Fio2Ratio: number;
  pgdGrade: 'GRADE_0' | 'GRADE_1' | 'GRADE_2' | 'GRADE_3';
  ecmoIndicated: boolean;
  inhaledVasodilatorRecommended: 'NONE' | 'INO' | 'EPOPROSTENOL';
  suggestedVasodilatorDose: string;
  protectiveVentProtocol: string[];
  clinicalSummary: string;
}

interface HeartPgdResult {
  visScore: number;
  papi?: number;
  pgdSeverity: 'NONE' | 'PGD_LV_MILD' | 'PGD_LV_MODERATE' | 'PGD_LV_SEVERE' | 'PGD_RV';
  rvFailurePresent: boolean;
  mechanicalSupportIndicated: boolean;
  inhaledVasodilatorRecommended: 'NONE' | 'INO' | 'EPOPROSTENOL';
  suggestedVasodilatorDose: string;
  hemodynamicActionPlan: string[];
  clinicalSummary: string;
}

export const GraftPulseHub: React.FC = () => {
  const [patientId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'lung_pgd' | 'heart_pgd' | 'vasodilators' | 'history'>('lung_pgd');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Transplant Context
  const [organType, setOrganType] = useState<'HEART' | 'LUNG_SINGLE' | 'LUNG_BILATERAL' | 'HEART_LUNG'>('LUNG_BILATERAL');
  const [timepoint, setTimepoint] = useState<'T0' | 'T24' | 'T48' | 'T72'>('T24');
  const [donorAge, setDonorAge] = useState<number>(34);
  const [ischemicTimeMinutes, setIschemicTimeMinutes] = useState<number>(290);
  const [transplantId, setTransplantId] = useState<number>(1);

  // Lung PGD Form State
  const [pao2Mmhg, setPao2Mmhg] = useState<number>(145);
  const [fio2, setFio2] = useState<number>(0.6);
  const [radiographicInfiltrates, setRadiographicInfiltrates] = useState<boolean>(true);
  const [lungEcmoActive, setLungEcmoActive] = useState<boolean>(false);
  const [lungResult, setLungResult] = useState<LungPgdResult | null>(null);

  // Heart PGD & Inotrope Form State
  const [lvefPercent, setLvefPercent] = useState<number>(35);
  const [cvpMmhg, setCvpMmhg] = useState<number>(16);
  const [pcwpMmhg, setPcwpMmhg] = useState<number>(18);
  const [cardiacIndex, setCardiacIndex] = useState<number>(1.9);
  const [paspMmhg, setPaspMmhg] = useState<number>(32);
  const [padpMmhg, setPadpMmhg] = useState<number>(16);
  const [rvDysfunction, setRvDysfunction] = useState<boolean>(true);
  const [mcsActive, setMcsActive] = useState<boolean>(false);
  const [dobutamine, setDobutamine] = useState<number>(5.0);
  const [milrinone, setMilrinone] = useState<number>(0.375);
  const [epinephrine, setEpinephrine] = useState<number>(0.04);
  const [norepinephrine, setNorepinephrine] = useState<number>(0.08);
  const [vasopressin, setVasopressin] = useState<number>(0.0003);
  const [heartResult, setHeartResult] = useState<HeartPgdResult | null>(null);

  // History State
  const [transplantHistory, setTransplantHistory] = useState<any[]>([]);

  // Evaluate Lung PGD
  const handleAssessLungPgd = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const res = await fetch('/api/transplant/pgd/lung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pao2Mmhg,
          fio2,
          radiographicInfiltrates,
          ecmoActive: lungEcmoActive,
          ecmoType: lungEcmoActive ? 'VV_ECMO' : 'NONE'
        })
      });
      if (!res.ok) throw new Error('Failed to evaluate ISHLT lung PGD');
      const data = await res.json();
      setLungResult(data);
      setStatusMessage('Lung allograft PGD evaluation complete.');
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Evaluate Heart PGD
  const handleAssessHeartPgd = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const res = await fetch('/api/transplant/pgd/heart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lvefPercent,
          cvpMmhg,
          pcwpMmhg,
          cardiacIndexLMinM2: cardiacIndex,
          pulmonaryArterySystolicMmhg: paspMmhg,
          pulmonaryArteryDiastolicMmhg: padpMmhg,
          rvDysfunctionPresent: rvDysfunction,
          mechanicalCirculatorySupportActive: mcsActive,
          mcsType: mcsActive ? 'VA_ECMO' : 'NONE',
          vasoactives: {
            dobutamineMcgKgMin: dobutamine,
            milrinoneMcgKgMin: milrinone,
            epinephrineMcgKgMin: epinephrine,
            norepinephrineMcgKgMin: norepinephrine,
            vasopressinUnitsKgMin: vasopressin
          }
        })
      });
      if (!res.ok) throw new Error('Failed to evaluate ISHLT heart PGD');
      const data = await res.json();
      setHeartResult(data);
      setStatusMessage('Heart allograft PGD & VIS score calculated.');
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Save Surveillance Log
  const handleLogSurveillance = async () => {
    setIsLoading(true);
    try {
      const currentGrade = organType.includes('LUNG')
        ? (lungResult ? lungResult.pgdGrade : 'GRADE_0')
        : (heartResult ? heartResult.pgdSeverity : 'NONE');

      const res = await fetch('/api/transplant/pgd/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transplantId,
          patientId,
          timepoint,
          pao2Fio2Ratio: lungResult?.pao2Fio2Ratio,
          radiographicInfiltrates,
          lvefPercent,
          cvpMmhg,
          pcwpMmhg,
          cardiacIndex,
          papi: heartResult?.papi,
          visScore: heartResult?.visScore,
          ecmoActive: organType.includes('LUNG') ? lungEcmoActive : mcsActive,
          ecmoType: lungEcmoActive ? 'VV_ECMO' : mcsActive ? 'VA_ECMO' : 'NONE',
          pgdGrade: currentGrade,
          inhaledVasodilator: lungResult?.inhaledVasodilatorRecommended || heartResult?.inhaledVasodilatorRecommended,
          inhaledVasodilatorDose: lungResult?.suggestedVasodilatorDose || heartResult?.suggestedVasodilatorDose,
          recommendations: {
            organType,
            lungProtocol: lungResult?.protectiveVentProtocol,
            heartPlan: heartResult?.hemodynamicActionPlan
          }
        })
      });
      if (!res.ok) throw new Error('Failed to save PGD surveillance log');
      setStatusMessage(`Surveillance log (${timepoint}) recorded successfully.`);
      fetchHistory();
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Register New Transplant
  const handleRegisterTransplant = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/transplant/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          organType,
          donorAge,
          ischemicTimeMinutes,
          surgicalNotes: `Initial baseline transplant record for ${organType}`
        })
      });
      if (!res.ok) throw new Error('Failed to record transplant');
      const data = await res.json();
      setTransplantId(data.id);
      setStatusMessage(`Allograft record created (Transplant #${data.id}).`);
      fetchHistory();
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`/api/transplant/patient/${patientId}/history`);
      if (res.ok) {
        const data = await res.json();
        setTransplantHistory(data);
        if (data.length > 0 && !transplantId) {
          setTransplantId(data[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchHistory();
    handleAssessLungPgd();
    handleAssessHeartPgd();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', color: '#f8fafc' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid #2dd4bf',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>🫀</span> GRAFT-PULSE: Cardiopulmonary Allograft & Primary Graft Dysfunction Command
          </h2>
          <p style={{ margin: '6px 0 0', color: '#ccfbf1', fontSize: '14px' }}>
            ISHLT Consensus PGD Grading (T0–T72), Vasoactive-Inotropic Score (VIS), Inhaled Vasodilator Titration (iNO/Flolan)
          </p>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
          <span style={{
            background: 'rgba(255, 255, 255, 0.2)',
            padding: '4px 12px',
            borderRadius: '16px',
            fontSize: '12px',
            fontWeight: 700
          }}>
            Transplant #{transplantId} | Patient #{patientId}
          </span>
          <span style={{ fontSize: '11px', color: '#e6fffa' }}>
            Allograft: {organType.replace('_', ' ')}
          </span>
        </div>
      </div>

      {statusMessage && (
        <div style={{
          padding: '10px 16px',
          borderRadius: '8px',
          background: statusMessage.startsWith('Error') ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
          border: `1px solid ${statusMessage.startsWith('Error') ? '#ef4444' : '#10b981'}`,
          fontSize: '13px',
          color: '#f8fafc'
        }}>
          {statusMessage}
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('lung_pgd')}
          style={{
            background: activeTab === 'lung_pgd' ? '#0f766e' : '#1e293b',
            color: '#f8fafc',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          Lung PGD Surveillance (ISHLT)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('heart_pgd')}
          style={{
            background: activeTab === 'heart_pgd' ? '#0f766e' : '#1e293b',
            color: '#f8fafc',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          Heart PGD & Inotrope Scoring (VIS)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('vasodilators')}
          style={{
            background: activeTab === 'vasodilators' ? '#0f766e' : '#1e293b',
            color: '#f8fafc',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          Inhaled Vasodilator Protocol
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          style={{
            background: activeTab === 'history' ? '#0f766e' : '#1e293b',
            color: '#f8fafc',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          Allograft Registry & Trajectory
        </button>
      </div>

      {/* Tab 1: Lung PGD Surveillance */}
      {activeTab === 'lung_pgd' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '20px' }}>
          {/* Inputs */}
          <div style={{ background: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#2dd4bf' }}>Lung Allograft Oxygenation & Infiltrates</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>ISHLT Post-Reperfusion Timepoint</label>
                <select
                  value={timepoint}
                  onChange={(e) => setTimepoint(e.target.value as any)}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                >
                  <option value="T0">T0 (Within 6h post-reperfusion)</option>
                  <option value="T24">T24 (24 hours post-reperfusion)</option>
                  <option value="T48">T48 (48 hours post-reperfusion)</option>
                  <option value="T72">T72 (72 hours post-reperfusion)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>PaO2 (mmHg)</label>
                <input
                  type="number"
                  value={pao2Mmhg}
                  onChange={(e) => setPao2Mmhg(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>FiO2 (Fraction, e.g. 0.60)</label>
                <input
                  type="number"
                  step="0.05"
                  value={fio2}
                  onChange={(e) => setFio2(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                />
              </div>

              <div style={{ borderTop: '1px solid #334155', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={radiographicInfiltrates}
                    onChange={(e) => setRadiographicInfiltrates(e.target.checked)}
                  />
                  Radiographic Infiltrates Present (Diffuse Alveolar Infiltrates / Edema)
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: '#f87171' }}>
                  <input
                    type="checkbox"
                    checked={lungEcmoActive}
                    onChange={(e) => setLungEcmoActive(e.target.checked)}
                  />
                  Patient on VV-ECMO for Allograft Dysfunction (Automatic Grade 3)
                </label>
              </div>

              <div style={{ marginTop: '14px', display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleAssessLungPgd}
                  disabled={isLoading}
                  style={{
                    flex: 1,
                    background: '#0f766e',
                    color: '#fff',
                    border: 'none',
                    padding: '10px',
                    borderRadius: '6px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {isLoading ? 'Assessing...' : 'Assess Lung PGD Grade'}
                </button>
                <button
                  type="button"
                  onClick={handleLogSurveillance}
                  disabled={isLoading}
                  style={{
                    background: '#10b981',
                    color: '#fff',
                    border: 'none',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Log Surveillance
                </button>
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {lungResult && (
              <>
                <div style={{
                  background: '#1e293b',
                  padding: '20px',
                  borderRadius: '10px',
                  border: `2px solid ${lungResult.pgdGrade === 'GRADE_3' ? '#ef4444' : lungResult.pgdGrade === 'GRADE_2' ? '#f59e0b' : '#10b981'}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: '#94a3b8' }}>ISHLT Consensus Grade ({timepoint})</span>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontWeight: 700,
                      fontSize: '13px',
                      background: lungResult.pgdGrade === 'GRADE_3' ? '#ef4444' : lungResult.pgdGrade === 'GRADE_2' ? '#f59e0b' : '#10b981',
                      color: '#fff'
                    }}>
                      {lungResult.pgdGrade.replace('_', ' ')}
                    </span>
                  </div>

                  <p style={{ margin: '14px 0', fontSize: '15px', fontWeight: 600, lineHeight: 1.5 }}>
                    {lungResult.clinicalSummary}
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', margin: '12px 0' }}>
                    <div style={{ background: '#0f172a', padding: '10px', borderRadius: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>PaO2 / FiO2 Ratio</span>
                      <p style={{ margin: '4px 0 0', fontWeight: 700, color: lungResult.pao2Fio2Ratio < 200 ? '#ef4444' : '#2dd4bf' }}>
                        {lungResult.pao2Fio2Ratio}
                      </p>
                    </div>

                    <div style={{ background: '#0f172a', padding: '10px', borderRadius: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>Inhaled Vasodilator (iNO)</span>
                      <p style={{ margin: '4px 0 0', fontWeight: 700, color: lungResult.inhaledVasodilatorRecommended !== 'NONE' ? '#f59e0b' : '#10b981' }}>
                        {lungResult.suggestedVasodilatorDose}
                      </p>
                    </div>
                  </div>

                  <h4 style={{ margin: '14px 0 8px', fontSize: '13px', color: '#2dd4bf' }}>Protective Allograft Ventilation Protocol</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {lungResult.protectiveVentProtocol.map((proto, idx) => (
                      <div key={idx} style={{ fontSize: '12px', lineHeight: 1.4, background: '#0f172a', padding: '8px', borderRadius: '6px' }}>
                        • {proto}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Heart PGD & Inotrope Scoring (VIS) */}
      {activeTab === 'heart_pgd' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
          {/* Hemodynamics & Inotropes */}
          <div style={{ background: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#2dd4bf' }}>Hemodynamics & Inotrope Titration</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8' }}>LVEF (%)</label>
                <input
                  type="number"
                  value={lvefPercent}
                  onChange={(e) => setLvefPercent(Number(e.target.value))}
                  style={{ width: '100%', padding: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8' }}>CVP (mmHg)</label>
                <input
                  type="number"
                  value={cvpMmhg}
                  onChange={(e) => setCvpMmhg(Number(e.target.value))}
                  style={{ width: '100%', padding: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8' }}>PCWP (mmHg)</label>
                <input
                  type="number"
                  value={pcwpMmhg}
                  onChange={(e) => setPcwpMmhg(Number(e.target.value))}
                  style={{ width: '100%', padding: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8' }}>Cardiac Index (L/min/m²)</label>
                <input
                  type="number"
                  step="0.1"
                  value={cardiacIndex}
                  onChange={(e) => setCardiacIndex(Number(e.target.value))}
                  style={{ width: '100%', padding: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8' }}>PASP (mmHg)</label>
                <input
                  type="number"
                  value={paspMmhg}
                  onChange={(e) => setPaspMmhg(Number(e.target.value))}
                  style={{ width: '100%', padding: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8' }}>PADP (mmHg)</label>
                <input
                  type="number"
                  value={padpMmhg}
                  onChange={(e) => setPadpMmhg(Number(e.target.value))}
                  style={{ width: '100%', padding: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                />
              </div>
            </div>

            <h4 style={{ margin: '14px 0 8px', fontSize: '13px', color: '#2dd4bf' }}>Vasoactive Infusion Rates</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8' }}>Dobutamine (mcg/kg/min)</label>
                <input
                  type="number"
                  step="0.5"
                  value={dobutamine}
                  onChange={(e) => setDobutamine(Number(e.target.value))}
                  style={{ width: '100%', padding: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8' }}>Milrinone (mcg/kg/min)</label>
                <input
                  type="number"
                  step="0.05"
                  value={milrinone}
                  onChange={(e) => setMilrinone(Number(e.target.value))}
                  style={{ width: '100%', padding: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8' }}>Epinephrine (mcg/kg/min)</label>
                <input
                  type="number"
                  step="0.01"
                  value={epinephrine}
                  onChange={(e) => setEpinephrine(Number(e.target.value))}
                  style={{ width: '100%', padding: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8' }}>Norepinephrine (mcg/kg/min)</label>
                <input
                  type="number"
                  step="0.01"
                  value={norepinephrine}
                  onChange={(e) => setNorepinephrine(Number(e.target.value))}
                  style={{ width: '100%', padding: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '11px', color: '#94a3b8' }}>Vasopressin (units/kg/min)</label>
                <input
                  type="number"
                  step="0.0001"
                  value={vasopressin}
                  onChange={(e) => setVasopressin(Number(e.target.value))}
                  style={{ width: '100%', padding: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                />
              </div>
            </div>

            <div style={{ borderTop: '1px solid #334155', marginTop: '12px', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={rvDysfunction}
                  onChange={(e) => setRvDysfunction(e.target.checked)}
                />
                Right Ventricular Dilation / Hypokinesia on Echo
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', color: '#f87171' }}>
                <input
                  type="checkbox"
                  checked={mcsActive}
                  onChange={(e) => setMcsActive(e.target.checked)}
                />
                Mechanical Circulatory Support Active (VA-ECMO / Impella / CentriMag)
              </label>
            </div>

            <div style={{ marginTop: '14px', display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={handleAssessHeartPgd}
                disabled={isLoading}
                style={{
                  flex: 1,
                  background: '#0f766e',
                  color: '#fff',
                  border: 'none',
                  padding: '10px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Calculate VIS & Stratify PGD
              </button>
              <button
                type="button"
                onClick={handleLogSurveillance}
                disabled={isLoading}
                style={{
                  background: '#10b981',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Log Event
              </button>
            </div>
          </div>

          {/* Results */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {heartResult && (
              <>
                <div style={{
                  background: '#1e293b',
                  padding: '20px',
                  borderRadius: '10px',
                  border: `2px solid ${heartResult.pgdSeverity === 'PGD_LV_SEVERE' ? '#ef4444' : heartResult.pgdSeverity === 'PGD_LV_MODERATE' || heartResult.pgdSeverity === 'PGD_RV' ? '#f59e0b' : '#10b981'}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: '#94a3b8' }}>Heart PGD Status</span>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontWeight: 700,
                      fontSize: '12px',
                      background: heartResult.pgdSeverity === 'PGD_LV_SEVERE' ? '#ef4444' : heartResult.pgdSeverity === 'PGD_LV_MODERATE' || heartResult.pgdSeverity === 'PGD_RV' ? '#f59e0b' : '#10b981',
                      color: '#fff'
                    }}>
                      {heartResult.pgdSeverity.replace('_', ' ')}
                    </span>
                  </div>

                  <p style={{ margin: '14px 0', fontSize: '15px', fontWeight: 600, lineHeight: 1.5 }}>
                    {heartResult.clinicalSummary}
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', margin: '12px 0' }}>
                    <div style={{ background: '#0f172a', padding: '10px', borderRadius: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>Vasoactive-Inotropic Score (VIS)</span>
                      <p style={{ margin: '4px 0 0', fontWeight: 700, color: heartResult.visScore >= 10 ? '#f59e0b' : '#10b981' }}>
                        {heartResult.visScore}
                      </p>
                    </div>

                    <div style={{ background: '#0f172a', padding: '10px', borderRadius: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>PAPi (Pulmonary Artery Index)</span>
                      <p style={{ margin: '4px 0 0', fontWeight: 700, color: heartResult.papi && heartResult.papi < 1.5 ? '#ef4444' : '#2dd4bf' }}>
                        {heartResult.papi !== undefined ? heartResult.papi : 'N/A'}
                      </p>
                    </div>
                  </div>

                  <h4 style={{ margin: '14px 0 8px', fontSize: '13px', color: '#2dd4bf' }}>Hemodynamic Action Plan</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {heartResult.hemodynamicActionPlan.map((plan, idx) => (
                      <div key={idx} style={{ fontSize: '12px', lineHeight: 1.4, background: '#0f172a', padding: '8px', borderRadius: '6px' }}>
                        • {plan}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Inhaled Vasodilator Protocol */}
      {activeTab === 'vasodilators' && (
        <div style={{ background: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#2dd4bf' }}>Inhaled Pulmonary Vasodilator Administration</h3>
          <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#94a3b8' }}>
            Selective pulmonary vasodilation without systemic hypotension for PGD Grade 2/3 (Lung) or acute RV dysfunction / pulmonary hypertension (Heart).
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div style={{ background: '#0f172a', padding: '16px', borderRadius: '8px', border: '1px solid #0f766e' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '15px', color: '#2dd4bf' }}>Inhaled Nitric Oxide (iNO)</h4>
                <span style={{ background: '#0f766e', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700 }}>First-Line</span>
              </div>
              <div style={{ margin: '12px 0', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div><strong>Starting Dose:</strong> 20 ppm inline inhalation</div>
                <div><strong>Titration Range:</strong> 20 - 40 ppm (max 40 ppm; doses &gt; 40 ppm lack clinical benefit)</div>
                <div><strong>Monitoring:</strong> Serial Methemoglobin checks q8-12h (Target MetHb &lt; 2.5%), inline NO2 monitoring (&lt; 2 ppm)</div>
                <div><strong>Weaning Protocol:</strong> Wean by 5 ppm q4-6h down to 5 ppm, then by 1 ppm increments to prevent rebound pulmonary hypertension</div>
              </div>
            </div>

            <div style={{ background: '#0f172a', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '15px', color: '#38bdf8' }}>Inhaled Epoprostenol (Flolan / PGI2)</h4>
                <span style={{ background: '#334155', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700 }}>Cost-Effective Alt</span>
              </div>
              <div style={{ margin: '12px 0', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div><strong>Starting Dose:</strong> 10 - 20 ng/kg/min continuous vibrating mesh nebulization</div>
                <div><strong>Titration Range:</strong> 10 - 50 ng/kg/min</div>
                <div><strong>Monitoring:</strong> Expiratory filter resistance checks q2-4h (prolonged aerosolization can clog ventilator expiratory valves)</div>
                <div><strong>Weaning Protocol:</strong> Wean gradually by 5-10 ng/kg/min increments; avoid abrupt cessation</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Allograft Registry & Trajectory */}
      {activeTab === 'history' && (
        <div style={{ background: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: '#2dd4bf' }}>Allograft Registry & Surveillance History</h3>
            <button
              type="button"
              onClick={handleRegisterTransplant}
              style={{
                background: '#0f766e',
                color: '#fff',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              + Create New Transplant Record
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#94a3b8' }}>Organ Type</label>
              <select
                value={organType}
                onChange={(e) => setOrganType(e.target.value as any)}
                style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
              >
                <option value="LUNG_BILATERAL">Bilateral Lung</option>
                <option value="LUNG_SINGLE">Single Lung</option>
                <option value="HEART">Orthotopic Heart</option>
                <option value="HEART_LUNG">Heart-Lung En Bloc</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#94a3b8' }}>Donor Age (Years)</label>
              <input
                type="number"
                value={donorAge}
                onChange={(e) => setDonorAge(Number(e.target.value))}
                style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#94a3b8' }}>Total Ischemic Time (Minutes)</label>
              <input
                type="number"
                value={ischemicTimeMinutes}
                onChange={(e) => setIschemicTimeMinutes(Number(e.target.value))}
                style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
              />
            </div>
          </div>

          {transplantHistory.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>No recorded transplants for this patient.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {transplantHistory.map((tx) => (
                <div key={tx.id} style={{ background: '#0f172a', padding: '14px', borderRadius: '6px', border: '1px solid #334155' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px' }}>
                      Transplant #{tx.id} - {tx.organ_type.replace('_', ' ')}
                    </span>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>{new Date(tx.transplant_timestamp).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', margin: '8px 0', fontSize: '12px' }}>
                    <div>Donor Age: {tx.donor_age || 'N/A'} yrs</div>
                    <div>Ischemic Time: {tx.ischemic_time_minutes} min</div>
                    <div>Active: YES</div>
                  </div>
                  {tx.surgical_notes && (
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#cbd5e1' }}>{tx.surgical_notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default GraftPulseHub;
