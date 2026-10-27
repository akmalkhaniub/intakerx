import React, { useState, useEffect } from 'react';

interface RecommendedTherapy {
  category: 'PULSE_STEROID' | 'CYTOLYTIC_ANTIBODY' | 'PLASMAPHERESIS_IVIG' | 'TARGETED_B_CELL' | 'OPTIMIZATION';
  agent: string;
  dosing: string;
  rationale: string;
}

interface BiopsyEvaluationResult {
  organType: string;
  acrGrade: string;
  pamrGrade: string;
  cellularRejectionSeverity: 'NONE' | 'MILD' | 'MODERATE' | 'SEVERE';
  antibodyRejectionSeverity: 'NEGATIVE' | 'SUSPECTED' | 'CONFIRMED' | 'SEVERE';
  treatmentIndicated: boolean;
  recommendedTherapies: RecommendedTherapy[];
  clinicalActionChecklist: string[];
  summary: string;
}

interface DsaEvaluationResult {
  maxMfi: number;
  dsaStatus: 'NEGATIVE' | 'WEAK' | 'MODERATE' | 'STRONG';
  riskStratification: 'LOW' | 'INTERMEDIATE' | 'HIGH' | 'CRITICAL';
  complementFixingAlert: boolean;
  immunologicSummary: string;
  recommendedInterventions: string[];
}

export const RejectGuardHub: React.FC = () => {
  const [patientId] = useState<number>(1);
  const [transplantId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'biopsy' | 'dsa' | 'protocols' | 'history'>('biopsy');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Biopsy Form State
  const [organType, setOrganType] = useState<'HEART' | 'LUNG_BILATERAL' | 'LUNG_SINGLE'>('HEART');
  const [heartAcrGrade, setHeartAcrGrade] = useState<'0R' | '1R' | '2R' | '3R'>('2R');
  const [lungAcrGrade, setLungAcrGrade] = useState<'A0' | 'A1' | 'A2' | 'A3' | 'A4'>('A0');
  const [pamrGrade, setPamrGrade] = useState<'pAMR 0' | 'pAMR 1(H)' | 'pAMR 1(I)' | 'pAMR 2' | 'pAMR 3'>('pAMR 0');
  const [c4dStaining, setC4dStaining] = useState<'NEGATIVE' | 'FOCAL' | 'DIFFUSE'>('NEGATIVE');
  const [cd68Macrophages, setCd68Macrophages] = useState<boolean>(false);
  const [myocyteDamage, setMyocyteDamage] = useState<boolean>(true);
  const [allograftDysfunction, setAllograftDysfunction] = useState<boolean>(false);
  const [biopsyResult, setBiopsyResult] = useState<BiopsyEvaluationResult | null>(null);

  // DSA Form State
  const [hlaClass, setHlaClass] = useState<'CLASS_I' | 'CLASS_II' | 'BOTH'>('CLASS_II');
  const [locusA, setLocusA] = useState<number>(450);
  const [locusB, setLocusB] = useState<number>(320);
  const [locusDr, setLocusDr] = useState<number>(4200);
  const [locusDq, setLocusDq] = useState<number>(12800);
  const [c1qFixing, setC1qFixing] = useState<boolean>(true);
  const [dsaResult, setDsaResult] = useState<DsaEvaluationResult | null>(null);

  // History State
  const [biopsyHistory, setBiopsyHistory] = useState<any[]>([]);
  const [dsaHistory, setDsaHistory] = useState<any[]>([]);

  // Evaluate Biopsy
  const handleEvaluateBiopsy = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const res = await fetch('/api/rejection/biopsy/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transplantId,
          patientId,
          organType,
          heartAcrGrade,
          lungAcrGrade,
          pamrGrade,
          c4dStaining,
          cd68MacrophagesPositive: cd68Macrophages,
          myocyteDamagePresent: myocyteDamage,
          allograftDysfunctionPresent: allograftDysfunction
        })
      });
      if (!res.ok) throw new Error('Failed to evaluate biopsy histopathology');
      const data = await res.json();
      setBiopsyResult(data);
      setStatusMessage('Biopsy histopathology evaluated successfully.');
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Save Biopsy
  const handleSaveBiopsy = async () => {
    if (!biopsyResult) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/rejection/biopsy/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transplantId,
          patientId,
          organType,
          acrGrade: biopsyResult.acrGrade,
          pamrGrade: biopsyResult.pamrGrade,
          c4dStaining,
          cd68Macrophages: cd68Macrophages ? 'POSITIVE' : 'NEGATIVE',
          myocyteDamagePresent: myocyteDamage,
          allograftDysfunctionPresent: allograftDysfunction,
          treatmentIndicated: biopsyResult.treatmentIndicated,
          pathologyNotes: biopsyResult.summary
        })
      });
      if (!res.ok) throw new Error('Failed to save biopsy record');
      setStatusMessage('Biopsy record saved to allograft chart.');
      fetchHistory();
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Evaluate DSA
  const handleEvaluateDsa = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const specificHlaLoci = [
        { locus: 'HLA-A', allele: 'A*02:01', mfi: locusA },
        { locus: 'HLA-B', allele: 'B*07:02', mfi: locusB },
        { locus: 'HLA-DR', allele: 'DRB1*04:01', mfi: locusDr },
        { locus: 'HLA-DQ', allele: 'DQB1*03:01', mfi: locusDq }
      ];

      const res = await fetch('/api/rejection/dsa/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transplantId,
          patientId,
          hlaClass,
          specificHlaLoci,
          c1qComplementFixing: c1qFixing
        })
      });
      if (!res.ok) throw new Error('Failed to evaluate DSA surveillance');
      const data = await res.json();
      setDsaResult(data);
      setStatusMessage('DSA risk stratification updated.');
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Save DSA
  const handleSaveDsa = async () => {
    if (!dsaResult) return;
    setIsLoading(true);
    try {
      const specificHlaLoci = [
        { locus: 'HLA-A', allele: 'A*02:01', mfi: locusA },
        { locus: 'HLA-B', allele: 'B*07:02', mfi: locusB },
        { locus: 'HLA-DR', allele: 'DRB1*04:01', mfi: locusDr },
        { locus: 'HLA-DQ', allele: 'DQB1*03:01', mfi: locusDq }
      ];

      const res = await fetch('/api/rejection/dsa/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transplantId,
          patientId,
          hlaClass,
          specificHlaLoci,
          maxMfi: dsaResult.maxMfi,
          c1qComplementFixing: c1qFixing,
          dsaStatus: dsaResult.dsaStatus,
          riskStratification: dsaResult.riskStratification,
          recommendedInterventions: dsaResult.recommendedInterventions
        })
      });
      if (!res.ok) throw new Error('Failed to save DSA surveillance');
      setStatusMessage('DSA surveillance record saved to patient history.');
      fetchHistory();
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const [bioRes, dsaRes] = await Promise.all([
        fetch(`/api/rejection/patient/${patientId}/biopsies`),
        fetch(`/api/rejection/patient/${patientId}/dsa`)
      ]);
      if (bioRes.ok) setBiopsyHistory(await bioRes.json());
      if (dsaRes.ok) setDsaHistory(await dsaRes.json());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchHistory();
    handleEvaluateBiopsy();
    handleEvaluateDsa();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', color: '#f8fafc' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #4c0519 0%, #9f1239 100%)',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid #fb7185',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>🛡️</span> REJECT-GUARD: Acute Allograft Rejection Surveillance & Donor-Specific Antibodies
          </h2>
          <p style={{ margin: '6px 0 0', color: '#fecdd3', fontSize: '14px' }}>
            ISHLT ACR (0R–3R / A0–A4), Antibody-Mediated Rejection (pAMR 0–3), Luminex SAB MFI & C1q Cytotoxicity Watchdog
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{
            background: 'rgba(255, 255, 255, 0.2)',
            padding: '4px 12px',
            borderRadius: '16px',
            fontSize: '12px',
            fontWeight: 700
          }}>
            Transplant #{transplantId} | Patient #{patientId}
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

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('biopsy')}
          style={{
            background: activeTab === 'biopsy' ? '#9f1239' : '#1e293b',
            color: '#f8fafc',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          Biopsy Histopathology (ACR & pAMR)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('dsa')}
          style={{
            background: activeTab === 'dsa' ? '#9f1239' : '#1e293b',
            color: '#f8fafc',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          Luminex SAB & C1q DSA Surveillance
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('protocols')}
          style={{
            background: activeTab === 'protocols' ? '#9f1239' : '#1e293b',
            color: '#f8fafc',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          Anti-Rejection Rescue Protocols
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          style={{
            background: activeTab === 'history' ? '#9f1239' : '#1e293b',
            color: '#f8fafc',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          Surveillance Timeline & Logs
        </button>
      </div>

      {/* Tab 1: Biopsy Histopathology */}
      {activeTab === 'biopsy' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.3fr', gap: '20px' }}>
          {/* Controls */}
          <div style={{ background: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#fb7185' }}>Biopsy Histopathology Criteria</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8' }}>Organ Allograft</label>
                <select
                  value={organType}
                  onChange={(e) => setOrganType(e.target.value as any)}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                >
                  <option value="HEART">Orthotopic Heart</option>
                  <option value="LUNG_BILATERAL">Bilateral Lung</option>
                  <option value="LUNG_SINGLE">Single Lung</option>
                </select>
              </div>

              {organType === 'HEART' ? (
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8' }}>Heart ACR Grade (ISHLT 2004)</label>
                  <select
                    value={heartAcrGrade}
                    onChange={(e) => setHeartAcrGrade(e.target.value as any)}
                    style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                  >
                    <option value="0R">Grade 0R - No Rejection</option>
                    <option value="1R">Grade 1R - Mild (Interstital/1 focus damage)</option>
                    <option value="2R">Grade 2R - Moderate (&gt;= 2 foci damage) [Treat]</option>
                    <option value="3R">Grade 3R - Severe (Diffuse + necrosis/edema) [STAT Treat]</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8' }}>Lung ACR Grade (ISHLT 2007)</label>
                  <select
                    value={lungAcrGrade}
                    onChange={(e) => setLungAcrGrade(e.target.value as any)}
                    style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                  >
                    <option value="A0">Grade A0 - None</option>
                    <option value="A1">Grade A1 - Minimal perivascular</option>
                    <option value="A2">Grade A2 - Mild perivascular</option>
                    <option value="A3">Grade A3 - Moderate (Dense/alveolar septal) [Treat]</option>
                    <option value="A4">Grade A4 - Severe (Diffuse alveolar damage) [STAT Treat]</option>
                  </select>
                </div>
              )}

              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8' }}>Antibody-Mediated Rejection (pAMR Grade)</label>
                <select
                  value={pamrGrade}
                  onChange={(e) => setPamrGrade(e.target.value as any)}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                >
                  <option value="pAMR 0">pAMR 0 - Negative (histologic and immunopathologic negative)</option>
                  <option value="pAMR 1(H)">pAMR 1(H) - Histopathologic only (capillary histiocytosis)</option>
                  <option value="pAMR 1(I)">pAMR 1(I) - Immunopathologic only (C4d or CD68+)</option>
                  <option value="pAMR 2">pAMR 2 - Histopathologic AND Immunopathologic Positive [Treat]</option>
                  <option value="pAMR 3">pAMR 3 - Severe AMR (Interstital hemorrhage/capillary loss) [STAT Treat]</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8' }}>Capillary C4d Immunofluorescence Staining</label>
                <select
                  value={c4dStaining}
                  onChange={(e) => setC4dStaining(e.target.value as any)}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                >
                  <option value="NEGATIVE">Negative (&lt; 10% capillary staining)</option>
                  <option value="FOCAL">Focal (10% - 50% capillary staining)</option>
                  <option value="DIFFUSE">Diffuse (&gt; 50% capillary staining)</option>
                </select>
              </div>

              <div style={{ borderTop: '1px solid #334155', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={cd68Macrophages}
                    onChange={(e) => setCd68Macrophages(e.target.checked)}
                  />
                  CD68 Macrophage Infiltration in Capillaries Positive
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={myocyteDamage}
                    onChange={(e) => setMyocyteDamage(e.target.checked)}
                  />
                  Myocyte Damage / Cytolysis Present
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', color: '#fb7185' }}>
                  <input
                    type="checkbox"
                    checked={allograftDysfunction}
                    onChange={(e) => setAllograftDysfunction(e.target.checked)}
                  />
                  Clinical / Hemodynamic Allograft Dysfunction Present (LVEF drop / Wedge rise)
                </label>
              </div>

              <div style={{ marginTop: '12px', display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleEvaluateBiopsy}
                  disabled={isLoading}
                  style={{
                    flex: 1,
                    background: '#9f1239',
                    color: '#fff',
                    border: 'none',
                    padding: '10px',
                    borderRadius: '6px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Evaluate Histopathology
                </button>
                <button
                  type="button"
                  onClick={handleSaveBiopsy}
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
                  Save Biopsy
                </button>
              </div>
            </div>
          </div>

          {/* Results */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {biopsyResult && (
              <>
                <div style={{
                  background: '#1e293b',
                  padding: '20px',
                  borderRadius: '10px',
                  border: `2px solid ${biopsyResult.treatmentIndicated ? '#ef4444' : '#10b981'}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontWeight: 700,
                        fontSize: '12px',
                        background: biopsyResult.cellularRejectionSeverity === 'SEVERE' ? '#ef4444' : biopsyResult.cellularRejectionSeverity === 'MODERATE' ? '#f59e0b' : '#334155',
                        color: '#fff'
                      }}>
                        ACR: {biopsyResult.acrGrade} ({biopsyResult.cellularRejectionSeverity})
                      </span>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontWeight: 700,
                        fontSize: '12px',
                        background: biopsyResult.antibodyRejectionSeverity === 'CONFIRMED' || biopsyResult.antibodyRejectionSeverity === 'SEVERE' ? '#ef4444' : biopsyResult.antibodyRejectionSeverity === 'SUSPECTED' ? '#f59e0b' : '#334155',
                        color: '#fff'
                      }}>
                        pAMR: {biopsyResult.pamrGrade}
                      </span>
                    </div>

                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontWeight: 700,
                      fontSize: '12px',
                      background: biopsyResult.treatmentIndicated ? '#ef4444' : '#10b981',
                      color: '#fff'
                    }}>
                      {biopsyResult.treatmentIndicated ? 'TREATMENT REQUIRED' : 'NO ACUTE TREATMENT'}
                    </span>
                  </div>

                  <p style={{ margin: '14px 0', fontSize: '14px', fontWeight: 600, lineHeight: 1.5 }}>
                    {biopsyResult.summary}
                  </p>

                  {/* Therapies */}
                  <h4 style={{ margin: '14px 0 8px', fontSize: '13px', color: '#fb7185' }}>Recommended Intervention Protocol</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {biopsyResult.recommendedTherapies.map((rx, idx) => (
                      <div key={idx} style={{ background: '#0f172a', padding: '10px', borderRadius: '6px', borderLeft: '4px solid #fb7185' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 700, fontSize: '13px' }}>{rx.agent}</span>
                          <span style={{ color: '#fb7185', fontSize: '11px', fontWeight: 600 }}>{rx.category}</span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#cbd5e1', margin: '4px 0' }}>{rx.dosing}</div>
                        <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>{rx.rationale}</p>
                      </div>
                    ))}
                  </div>

                  {/* Checklist */}
                  <h4 style={{ margin: '14px 0 8px', fontSize: '13px', color: '#38bdf8' }}>Clinical Action Checklist</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {biopsyResult.clinicalActionChecklist.map((act, idx) => (
                      <div key={idx} style={{ fontSize: '12px', lineHeight: 1.4, background: '#0f172a', padding: '8px', borderRadius: '6px' }}>
                        • {act}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Luminex SAB & C1q DSA Surveillance */}
      {activeTab === 'dsa' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '20px' }}>
          {/* Inputs */}
          <div style={{ background: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#fb7185' }}>Luminex Single-Antigen Bead (SAB) Assays</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8' }}>HLA Class</label>
                <select
                  value={hlaClass}
                  onChange={(e) => setHlaClass(e.target.value as any)}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                >
                  <option value="CLASS_I">Class I (HLA-A, B, C)</option>
                  <option value="CLASS_II">Class II (HLA-DR, DQ, DP)</option>
                  <option value="BOTH">Class I & Class II</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8' }}>HLA-A MFI (e.g. A*02:01)</label>
                  <input
                    type="number"
                    value={locusA}
                    onChange={(e) => setLocusA(Number(e.target.value))}
                    style={{ width: '100%', padding: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8' }}>HLA-B MFI (e.g. B*07:02)</label>
                  <input
                    type="number"
                    value={locusB}
                    onChange={(e) => setLocusB(Number(e.target.value))}
                    style={{ width: '100%', padding: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8' }}>HLA-DR MFI (e.g. DRB1*04)</label>
                  <input
                    type="number"
                    value={locusDr}
                    onChange={(e) => setLocusDr(Number(e.target.value))}
                    style={{ width: '100%', padding: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8' }}>HLA-DQ MFI (e.g. DQB1*03)</label>
                  <input
                    type="number"
                    value={locusDq}
                    onChange={(e) => setLocusDq(Number(e.target.value))}
                    style={{ width: '100%', padding: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div style={{ borderTop: '1px solid #334155', paddingTop: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', color: '#fb7185', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={c1qFixing}
                    onChange={(e) => setC1qFixing(e.target.checked)}
                  />
                  C1q Complement-Fixing Assay Positive (Cytotoxic Cascade Activation)
                </label>
              </div>

              <div style={{ marginTop: '12px', display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleEvaluateDsa}
                  disabled={isLoading}
                  style={{
                    flex: 1,
                    background: '#9f1239',
                    color: '#fff',
                    border: 'none',
                    padding: '10px',
                    borderRadius: '6px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Analyze DSA MFI & Risk
                </button>
                <button
                  type="button"
                  onClick={handleSaveDsa}
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
                  Save DSA
                </button>
              </div>
            </div>
          </div>

          {/* Results */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {dsaResult && (
              <>
                <div style={{
                  background: '#1e293b',
                  padding: '20px',
                  borderRadius: '10px',
                  border: `2px solid ${dsaResult.riskStratification === 'CRITICAL' ? '#ef4444' : dsaResult.riskStratification === 'HIGH' ? '#f59e0b' : '#10b981'}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: '#94a3b8' }}>DSA Stratification</span>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontWeight: 700,
                      fontSize: '12px',
                      background: dsaResult.riskStratification === 'CRITICAL' ? '#ef4444' : dsaResult.riskStratification === 'HIGH' ? '#f59e0b' : '#10b981',
                      color: '#fff'
                    }}>
                      {dsaResult.riskStratification} RISK ({dsaResult.dsaStatus})
                    </span>
                  </div>

                  <p style={{ margin: '14px 0', fontSize: '14px', fontWeight: 600, lineHeight: 1.5 }}>
                    {dsaResult.immunologicSummary}
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', margin: '12px 0' }}>
                    <div style={{ background: '#0f172a', padding: '10px', borderRadius: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>Peak DSA MFI</span>
                      <p style={{ margin: '4px 0 0', fontWeight: 700, color: dsaResult.maxMfi > 3000 ? '#ef4444' : '#10b981' }}>
                        {dsaResult.maxMfi}
                      </p>
                    </div>

                    <div style={{ background: '#0f172a', padding: '10px', borderRadius: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>C1q Complement Fixation</span>
                      <p style={{ margin: '4px 0 0', fontWeight: 700, color: dsaResult.complementFixingAlert ? '#ef4444' : '#10b981' }}>
                        {dsaResult.complementFixingAlert ? 'POSITIVE (Active Cytotoxicity)' : 'Negative'}
                      </p>
                    </div>
                  </div>

                  <h4 style={{ margin: '14px 0 8px', fontSize: '13px', color: '#fb7185' }}>Recommended Immunologic Interventions</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {dsaResult.recommendedInterventions.map((int, idx) => (
                      <div key={idx} style={{ fontSize: '12px', lineHeight: 1.4, background: '#0f172a', padding: '8px', borderRadius: '6px' }}>
                        • {int}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Anti-Rejection Rescue Protocols */}
      {activeTab === 'protocols' && (
        <div style={{ background: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#fb7185' }}>ISHLT Acute Rejection Treatment Protocols</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
            <div style={{ background: '#0f172a', padding: '14px', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>
              <h4 style={{ margin: '0 0 8px', fontSize: '14px', color: '#f59e0b' }}>1. Pulse Steroid Regimen (ACR 2R / A3)</h4>
              <div style={{ fontSize: '12px', lineHeight: 1.5, color: '#cbd5e1' }}>
                <div>• <strong>Agent:</strong> Methylprednisolone 1000 mg IV infusion daily x 3 days.</div>
                <div>• <strong>Precaution:</strong> Check blood glucose q6h (insulin coverage) and monitor for acute leukocytosis.</div>
                <div>• <strong>Follow-up:</strong> Oral prednisone taper from 1.0 mg/kg/day down to maintenance over 4 weeks. Repeat biopsy at 3-4 weeks.</div>
              </div>
            </div>

            <div style={{ background: '#0f172a', padding: '14px', borderRadius: '8px', borderLeft: '4px solid #ef4444' }}>
              <h4 style={{ margin: '0 0 8px', fontSize: '14px', color: '#ef4444' }}>2. Antithymocyte Globulin (rATG) (ACR 3R / A4 / Steroid-Refractory)</h4>
              <div style={{ fontSize: '12px', lineHeight: 1.5, color: '#cbd5e1' }}>
                <div>• <strong>Agent:</strong> Thymoglobulin 1.5 mg/kg/day IV infusion over 6h via central line x 3-5 days.</div>
                <div>• <strong>Premedication:</strong> Acetaminophen 650 mg, Diphenhydramine 50 mg, Hydrocortisone 100 mg 30 min prior.</div>
                <div>• <strong>Monitoring:</strong> Target daily CD3 count &lt; 20-50 cells/mcL. Hold if platelets &lt; 50k or WBC &lt; 2k.</div>
              </div>
            </div>

            <div style={{ background: '#0f172a', padding: '14px', borderRadius: '8px', borderLeft: '4px solid #38bdf8' }}>
              <h4 style={{ margin: '0 0 8px', fontSize: '14px', color: '#38bdf8' }}>3. Therapeutic Plasma Exchange (TPE) + IVIG (pAMR &gt;= 2 / High DSA)</h4>
              <div style={{ fontSize: '12px', lineHeight: 1.5, color: '#cbd5e1' }}>
                <div>• <strong>Regimen:</strong> 1.0 - 1.5 plasma volume exchange using 5% Albumin (with FFP at end of procedure) every other day x 5-7 sessions.</div>
                <div>• <strong>IVIG Replacement:</strong> IVIG 100 mg/kg after each TPE run to prevent rebound, followed by 1-2 g/kg total post-series.</div>
              </div>
            </div>

            <div style={{ background: '#0f172a', padding: '14px', borderRadius: '8px', borderLeft: '4px solid #a855f7' }}>
              <h4 style={{ margin: '0 0 8px', fontSize: '14px', color: '#a855f7' }}>4. B-Cell & Plasma Cell Targeted Therapy</h4>
              <div style={{ fontSize: '12px', lineHeight: 1.5, color: '#cbd5e1' }}>
                <div>• <strong>Rituximab:</strong> 375 mg/m2 IV single dose 48h after last TPE session (clears CD20+ pre-B/mature B-cells).</div>
                <div>• <strong>Bortezomib:</strong> 1.3 mg/m2 SQ/IV on days 1, 4, 8, 11 (proteasome inhibitor depleting mature plasma cells).</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: History */}
      {activeTab === 'history' && (
        <div style={{ background: '#1e293b', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#fb7185' }}>Patient Surveillance History</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <h4 style={{ margin: '0 0 10px', fontSize: '14px', color: '#fecdd3' }}>Biopsy History</h4>
              {biopsyHistory.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '13px' }}>No biopsies recorded.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {biopsyHistory.map((b) => (
                    <div key={b.id} style={{ background: '#0f172a', padding: '10px', borderRadius: '6px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700 }}>Biopsy #{b.id} - ACR {b.acr_grade} | {b.pamr_grade}</span>
                        <span style={{ color: '#94a3b8' }}>{new Date(b.biopsy_date).toLocaleDateString()}</span>
                      </div>
                      <div style={{ color: '#cbd5e1', marginTop: '4px' }}>C4d: {b.c4d_staining} | Treat: {b.treatment_indicated ? 'YES' : 'NO'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4 style={{ margin: '0 0 10px', fontSize: '14px', color: '#fecdd3' }}>DSA Surveillance History</h4>
              {dsaHistory.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '13px' }}>No DSA assays recorded.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {dsaHistory.map((d) => (
                    <div key={d.id} style={{ background: '#0f172a', padding: '10px', borderRadius: '6px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700 }}>DSA #{d.id} - Max MFI: {d.max_mfi} ({d.dsa_status})</span>
                        <span style={{ color: '#94a3b8' }}>{new Date(d.sample_date).toLocaleDateString()}</span>
                      </div>
                      <div style={{ color: '#cbd5e1', marginTop: '4px' }}>Risk: {d.risk_stratification} | C1q: {d.c1q_complement_fixing ? 'POS' : 'NEG'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default RejectGuardHub;
