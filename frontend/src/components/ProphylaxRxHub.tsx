import React, { useState, useEffect } from 'react';

interface SurveillanceItem {
  test: string;
  frequency: string;
  rationale: string;
}

interface CytopeniaAlert {
  alert: boolean;
  neutropenia: boolean;
  thrombocytopenia: boolean;
  guidance: string;
}

interface ProphylaxisPlanResult {
  organType: string;
  cmvDrStatus: string;
  cmvRiskLevel: 'HIGH' | 'INTERMEDIATE' | 'LOW';
  valganciclovirDosing: string;
  valganciclovirDurationMonths: number;
  cytopeniaAlert: CytopeniaAlert;
  pcpRegimen: string;
  pcpDuration: string;
  fungalRegimen: string;
  fungalDuration: string;
  ebvPtldRisk: 'HIGH' | 'INTERMEDIATE' | 'LOW';
  surveillanceSchedule: SurveillanceItem[];
  clinicalChecklist: string[];
}

interface ViralLoadResult {
  virusType: 'CMV' | 'EBV' | 'BKV' | 'ADV';
  copiesPerMl: number;
  log10Value: number;
  interpretation: 'UNDETECTABLE_OR_TRACE' | 'LOW_LEVEL_DNAEMIA' | 'MODERATE_DNAEMIA' | 'HIGH_BURDEN_INFECTION' | 'CRITICAL_HIGH_DNAEMIA';
  viralKinetics: string;
  clinicalAction: string;
  immunosuppressionAdjustment: string;
  recommendedMonitoring: string;
}

export const ProphylaxRxHub: React.FC = () => {
  const [patientId] = useState<number>(1);
  const [transplantId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'prophylaxis_planner' | 'viral_load_sentinel' | 'history'>('prophylaxis_planner');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Tab 1: Prophylaxis Planner State
  const [organType, setOrganType] = useState<'HEART' | 'LUNG' | 'HEART_LUNG'>('HEART');
  const [cmvDonorStatus, setCmvDonorStatus] = useState<'POSITIVE' | 'NEGATIVE'>('POSITIVE');
  const [cmvRecipientStatus, setCmvRecipientStatus] = useState<'POSITIVE' | 'NEGATIVE'>('NEGATIVE');
  const [ebvDonorStatus, setEbvDonorStatus] = useState<'POSITIVE' | 'NEGATIVE'>('POSITIVE');
  const [ebvRecipientStatus, setEbvRecipientStatus] = useState<'POSITIVE' | 'NEGATIVE'>('NEGATIVE');
  const [crClMlMin, setCrClMlMin] = useState<number>(75);
  const [ancCells, setAncCells] = useState<number>(2400);
  const [platelets, setPlatelets] = useState<number>(185000);
  const [sulfaAllergy, setSulfaAllergy] = useState<boolean>(false);
  const [g6pdDeficiency, setG6pdDeficiency] = useState<boolean>(false);
  const [atgUsed, setAtgUsed] = useState<boolean>(false);
  const [planResult, setPlanResult] = useState<ProphylaxisPlanResult | null>(null);

  // Tab 2: Viral Load Sentinel State
  const [virusType, setVirusType] = useState<'CMV' | 'EBV' | 'BKV' | 'ADV'>('CMV');
  const [copiesPerMl, setCopiesPerMl] = useState<number>(2800);
  const [prevCopiesPerMl, setPrevCopiesPerMl] = useState<number>(450);
  const [onProphylaxis, setOnProphylaxis] = useState<boolean>(true);
  const [viralResult, setViralResult] = useState<ViralLoadResult | null>(null);

  // Tab 3: History State
  const [plansHistory, setPlansHistory] = useState<any[]>([]);
  const [viralHistory, setViralHistory] = useState<any[]>([]);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [resPlans, resViral] = await Promise.all([
        fetch(`/api/clinician/prophylaxis/plans/${patientId}?transplantId=${transplantId}`, { headers }),
        fetch(`/api/clinician/prophylaxis/viral-load/${patientId}`, { headers })
      ]);

      if (resPlans.ok) {
        const data = await resPlans.json();
        setPlansHistory(data);
      }
      if (resViral.ok) {
        const data = await resViral.json();
        setViralHistory(data);
      }
    } catch (err) {
      console.error('Failed to fetch prophylaxis history:', err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [patientId, transplantId]);

  // Handle Plan Generation
  const handleGeneratePlan = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/clinician/prophylaxis/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          transplantId,
          patientId,
          organType,
          cmvDonorStatus,
          cmvRecipientStatus,
          ebvDonorStatus,
          ebvRecipientStatus,
          crClMlMin,
          ancCellsPerUl: ancCells,
          plateletsPerUl: platelets,
          sulfaAllergy,
          g6pdDeficiency,
          antithymocyteGlobulinUsed: atgUsed,
          savePlan: true
        })
      });

      if (!res.ok) throw new Error('Failed to generate prophylaxis plan');
      const data = await res.json();
      setPlanResult(data.plan);
      setStatusMessage('Opportunistic infection prophylaxis plan computed & recorded.');
      fetchHistory();
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Viral Load Interpretation
  const handleInterpretViralLoad = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/clinician/prophylaxis/viral-load', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          transplantId,
          patientId,
          virusType,
          copiesPerMl,
          previousCopiesPerMl: prevCopiesPerMl > 0 ? prevCopiesPerMl : undefined,
          onProphylaxis,
          saveRecord: true
        })
      });

      if (!res.ok) throw new Error('Failed to evaluate viral load assay');
      const data = await res.json();
      setViralResult(data.evaluation);
      setStatusMessage('Quantitative viral load kinetics evaluated & logged.');
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
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <span>🛡️</span> PROPHYLAX-RX: Post-Transplant Infection Sentinel
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: '4px 0 0 0' }}>
            CMV D/R Risk Stratification, Renal-Adjusted Valganciclovir, PCP & Mold Prophylaxis, and EBV / PTLD Viral Sentinel
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
          onClick={() => setActiveTab('prophylaxis_planner')}
          style={{
            padding: '10px 16px',
            backgroundColor: activeTab === 'prophylaxis_planner' ? '#059669' : '#1e293b',
            color: activeTab === 'prophylaxis_planner' ? '#ffffff' : '#94a3b8',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          🛡️ Opportunistic Infection Prophylaxis Planner
        </button>
        <button
          onClick={() => setActiveTab('viral_load_sentinel')}
          style={{
            padding: '10px 16px',
            backgroundColor: activeTab === 'viral_load_sentinel' ? '#059669' : '#1e293b',
            color: activeTab === 'viral_load_sentinel' ? '#ffffff' : '#94a3b8',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          📈 Viral Load Quantitative qPCR Sentinel
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            padding: '10px 16px',
            backgroundColor: activeTab === 'history' ? '#059669' : '#1e293b',
            color: activeTab === 'history' ? '#ffffff' : '#94a3b8',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          📋 Prophylaxis History & Viral Logs
        </button>
      </div>

      {statusMessage && (
        <div style={{ backgroundColor: '#064e3b', color: '#a7f3d0', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>ℹ️</span> {statusMessage}
        </div>
      )}

      {/* Tab 1: PROPHYLAXIS PLANNER */}
      {activeTab === 'prophylaxis_planner' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
            <h3 style={{ fontSize: '16px', color: '#34d399', marginTop: 0, marginBottom: '16px' }}>
              Host, Allograft & Serostatus Parameters
            </h3>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                Allograft Organ Type
              </label>
              <select
                value={organType}
                onChange={e => setOrganType(e.target.value as any)}
                style={{ width: '100%', padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
              >
                <option value="HEART">Orthotopic Heart Transplant (OHT)</option>
                <option value="LUNG">Lung Transplant (Single or Bilateral)</option>
                <option value="HEART_LUNG">Combined Heart-Lung Transplant</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  CMV Donor (D) Serostatus
                </label>
                <select
                  value={cmvDonorStatus}
                  onChange={e => setCmvDonorStatus(e.target.value as any)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                >
                  <option value="POSITIVE">D+ (Positive)</option>
                  <option value="NEGATIVE">D- (Negative)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  CMV Recipient (R) Serostatus
                </label>
                <select
                  value={cmvRecipientStatus}
                  onChange={e => setCmvRecipientStatus(e.target.value as any)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                >
                  <option value="NEGATIVE">R- (Negative)</option>
                  <option value="POSITIVE">R+ (Positive)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  EBV Donor (D) Serostatus
                </label>
                <select
                  value={ebvDonorStatus}
                  onChange={e => setEbvDonorStatus(e.target.value as any)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                >
                  <option value="POSITIVE">D+ (Positive)</option>
                  <option value="NEGATIVE">D- (Negative)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  EBV Recipient (R) Serostatus
                </label>
                <select
                  value={ebvRecipientStatus}
                  onChange={e => setEbvRecipientStatus(e.target.value as any)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                >
                  <option value="NEGATIVE">R- (Negative, High PTLD risk)</option>
                  <option value="POSITIVE">R+ (Positive)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  CrCl (mL/min)
                </label>
                <input
                  type="number"
                  value={crClMlMin}
                  onChange={e => setCrClMlMin(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  ANC (/uL)
                </label>
                <input
                  type="number"
                  value={ancCells}
                  onChange={e => setAncCells(parseInt(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  Platelets (/uL)
                </label>
                <input
                  type="number"
                  value={platelets}
                  onChange={e => setPlatelets(parseInt(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Clinical Risk Modifiers:</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={sulfaAllergy}
                  onChange={e => setSulfaAllergy(e.target.checked)}
                />
                Sulfa Allergy (Contraindicates TMP-SMX)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={g6pdDeficiency}
                  onChange={e => setG6pdDeficiency(e.target.checked)}
                />
                G6PD Deficiency (Contraindicates Dapsone & Sulfa)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={atgUsed}
                  onChange={e => setAtgUsed(e.target.checked)}
                />
                Thymoglobulin (rATG) / Alemtuzumab T-cell depletion used
              </label>
            </div>

            <button
              onClick={handleGeneratePlan}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#059669',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '14px'
              }}
            >
              {isLoading ? 'Generating Protocol...' : 'Generate Prophylaxis & Surveillance Plan'}
            </button>
          </div>

          {/* Results Panel */}
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
            <h3 style={{ fontSize: '16px', color: '#34d399', marginTop: 0, marginBottom: '16px' }}>
              Precision Prophylaxis Directives
            </h3>

            {planResult ? (
              <div>
                {/* Risk Badges */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ flex: 1, backgroundColor: '#0f172a', padding: '10px', borderRadius: '6px', borderLeft: `4px solid ${planResult.cmvRiskLevel === 'HIGH' ? '#ef4444' : planResult.cmvRiskLevel === 'INTERMEDIATE' ? '#f59e0b' : '#10b981'}` }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>CMV Risk ({planResult.cmvDrStatus})</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#f8fafc' }}>{planResult.cmvRiskLevel} RISK</div>
                    <div style={{ fontSize: '11px', color: '#34d399', marginTop: '2px' }}>Duration: {planResult.valganciclovirDurationMonths} months</div>
                  </div>
                  <div style={{ flex: 1, backgroundColor: '#0f172a', padding: '10px', borderRadius: '6px', borderLeft: `4px solid ${planResult.ebvPtldRisk === 'HIGH' ? '#ef4444' : '#10b981'}` }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>EBV / PTLD Risk</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#f8fafc' }}>{planResult.ebvPtldRisk} RISK</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Monthly qPCR surveillance</div>
                  </div>
                </div>

                {/* Cytopenia Alert Banner */}
                {planResult.cytopeniaAlert.alert && (
                  <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', padding: '12px', borderRadius: '6px', marginBottom: '14px', fontSize: '13px' }}>
                    <div style={{ fontWeight: 'bold', color: '#f87171' }}>⚠️ BONE MARROW SUPPRESSION DETECTED</div>
                    <div style={{ color: '#fecaca', marginTop: '4px' }}>{planResult.cytopeniaAlert.guidance}</div>
                  </div>
                )}

                {/* Regimens */}
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Valganciclovir (CMV Prophylaxis):</div>
                  <div style={{ backgroundColor: '#0f172a', padding: '8px 12px', borderRadius: '4px', fontSize: '13px', color: '#f8fafc', marginTop: '4px' }}>
                    {planResult.valganciclovirDosing}
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>PCP (Pneumocystis) Regimen:</div>
                  <div style={{ backgroundColor: '#0f172a', padding: '8px 12px', borderRadius: '4px', fontSize: '13px', color: '#f8fafc', marginTop: '4px' }}>
                    {planResult.pcpRegimen}
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Fungal Coverage:</div>
                  <div style={{ backgroundColor: '#0f172a', padding: '8px 12px', borderRadius: '4px', fontSize: '13px', color: '#f8fafc', marginTop: '4px' }}>
                    {planResult.fungalRegimen}
                  </div>
                </div>

                {/* Surveillance schedule */}
                <div>
                  <h4 style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 8px 0' }}>Surveillance Protocol</h4>
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {planResult.surveillanceSchedule.map((item, idx) => (
                      <div key={idx} style={{ backgroundColor: '#0f172a', padding: '8px 10px', borderRadius: '4px', marginBottom: '6px', fontSize: '12px' }}>
                        <div style={{ fontWeight: 'bold', color: '#34d399' }}>{item.test} ({item.frequency})</div>
                        <div style={{ color: '#94a3b8', marginTop: '2px' }}>{item.rationale}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', marginTop: '60px' }}>
                Set transplant organ and serostatus pairs, then click "Generate Prophylaxis & Surveillance Plan".
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: VIRAL LOAD SENTINEL */}
      {activeTab === 'viral_load_sentinel' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
            <h3 style={{ fontSize: '16px', color: '#34d399', marginTop: 0, marginBottom: '16px' }}>
              Quantitative PCR Assay Entry
            </h3>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                Virus Type
              </label>
              <select
                value={virusType}
                onChange={e => setVirusType(e.target.value as any)}
                style={{ width: '100%', padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
              >
                <option value="CMV">CMV (Cytomegalovirus)</option>
                <option value="EBV">EBV (Epstein-Barr Virus - PTLD)</option>
                <option value="BKV">BKV (BK Polyomavirus)</option>
                <option value="ADV">ADV (Adenovirus)</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  Current Copies / mL (Plasma)
                </label>
                <input
                  type="number"
                  value={copiesPerMl}
                  onChange={e => setCopiesPerMl(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  Prior Assay Copies / mL
                </label>
                <input
                  type="number"
                  value={prevCopiesPerMl}
                  onChange={e => setPrevCopiesPerMl(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={onProphylaxis}
                  onChange={e => setOnProphylaxis(e.target.checked)}
                />
                Patient currently taking maintenance antiviral prophylaxis (e.g. Valganciclovir)
              </label>
            </div>

            <button
              onClick={handleInterpretViralLoad}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#059669',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '14px'
              }}
            >
              {isLoading ? 'Analyzing Kinetics...' : 'Analyze Quantitative Viral Load & Directives'}
            </button>
          </div>

          {/* Results Panel */}
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
            <h3 style={{ fontSize: '16px', color: '#34d399', marginTop: 0, marginBottom: '16px' }}>
              Viral Kinetics & Clinical Directives
            </h3>

            {viralResult ? (
              <div>
                <div
                  style={{
                    padding: '14px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    backgroundColor:
                      viralResult.interpretation === 'UNDETECTABLE_OR_TRACE'
                        ? 'rgba(16, 185, 129, 0.15)'
                        : viralResult.interpretation.includes('HIGH')
                        ? 'rgba(239, 68, 68, 0.2)'
                        : 'rgba(245, 158, 11, 0.15)',
                    border: `1px solid ${
                      viralResult.interpretation === 'UNDETECTABLE_OR_TRACE'
                        ? '#10b981'
                        : viralResult.interpretation.includes('HIGH')
                        ? '#ef4444'
                        : '#f59e0b'
                    }`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '15px' }}>
                      {viralResult.virusType}: {viralResult.interpretation.replace(/_/g, ' ')}
                    </span>
                    <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '4px', backgroundColor: '#0f172a' }}>
                      {viralResult.copiesPerMl.toLocaleString()} c/mL ({viralResult.log10Value} log10)
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '6px' }}>
                    {viralResult.viralKinetics}
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Mandatory Clinical Action:</div>
                  <div style={{ backgroundColor: '#0f172a', padding: '10px 12px', borderRadius: '6px', fontSize: '13px', color: '#f8fafc', marginTop: '4px' }}>
                    {viralResult.clinicalAction}
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Immunosuppression Adjustment:</div>
                  <div style={{ backgroundColor: '#0f172a', padding: '10px 12px', borderRadius: '6px', fontSize: '13px', color: '#f59e0b', marginTop: '4px' }}>
                    {viralResult.immunosuppressionAdjustment}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Next Monitoring Interval:</div>
                  <div style={{ backgroundColor: '#0f172a', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', color: '#38bdf8', marginTop: '4px' }}>
                    {viralResult.recommendedMonitoring}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', marginTop: '60px' }}>
                Enter quantitative copies/mL and run analysis to evaluate replication kinetics.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: HISTORY */}
      {activeTab === 'history' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
            <h3 style={{ fontSize: '16px', color: '#34d399', marginTop: 0, marginBottom: '16px' }}>
              Prophylaxis Plans History
            </h3>
            {plansHistory.length > 0 ? (
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {plansHistory.map((p, i) => (
                  <div key={i} style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', marginBottom: '10px', borderLeft: `4px solid ${p.cmv_risk_level === 'HIGH' ? '#ef4444' : '#10b981'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}>
                      <span>CMV {p.cmv_d_r_status} ({p.cmv_risk_level})</span>
                      <span style={{ color: '#34d399' }}>EBV: {p.ebv_ptld_risk}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                      Valganciclovir: {p.valganciclovir_dosing}
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
                      {new Date(p.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#64748b', fontSize: '13px' }}>No past prophylaxis plans found.</div>
            )}
          </div>

          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
            <h3 style={{ fontSize: '16px', color: '#34d399', marginTop: 0, marginBottom: '16px' }}>
              Viral Load Surveillance Logs
            </h3>
            {viralHistory.length > 0 ? (
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {viralHistory.map((v, i) => (
                  <div key={i} style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', marginBottom: '10px', borderLeft: '4px solid #10b981' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}>
                      <span>{v.virus_type} ({v.copies_per_ml} c/mL)</span>
                      <span style={{ color: '#34d399' }}>{v.interpretation}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '4px' }}>
                      {v.clinical_action}
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
                      {new Date(v.tested_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#64748b', fontSize: '13px' }}>No viral load records found.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
export default ProphylaxRxHub;
