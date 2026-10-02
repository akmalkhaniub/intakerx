import React, { useState, useEffect } from 'react';
import {
  FileCheck2,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Plus,
  X,
  HelpCircle,
  Stethoscope,
  Sparkles,
  ClipboardList
} from 'lucide-react';

interface ClinicalIndicators {
  creatinine?: number;
  baselineCreatinine?: number;
  feNa?: number;
  muddyBrownCasts?: boolean;
  fluidChallengeGivenMl?: number;
  ejectionFraction?: number;
  bnp?: number;
  chfDocumented?: boolean;
  chfType?: string;
  bmi?: number;
  weightLossPercentage?: number;
  weightLossTimeframeMonths?: number;
  temporalWasting?: boolean;
  alteredMentalStatus?: boolean;
  ammoniaLevel?: number;
  lactate?: number;
  clinicalNotesSummary?: string;
}

interface DiscrepancyFinding {
  queryType: string;
  conditionName: string;
  missingSpecificity: string;
  clinicalRationale: string;
  objectiveEvidence: string[];
  suggestedClassification: 'CC' | 'MCC';
  projectedWeightDelta: number;
}

interface CdiReview {
  id: number;
  patient_id: number;
  patient_name?: string;
  session_id?: string;
  admission_date: string;
  principal_diagnosis: string;
  secondary_diagnoses: string[];
  clinical_indicators: ClinicalIndicators;
  identified_discrepancies: DiscrepancyFinding[];
  base_ms_drg: string;
  base_drg_weight: number;
  projected_ms_drg: string;
  projected_drg_weight: number;
  estimated_reimbursement_delta: number;
  review_status: string;
  reviewer_notes?: string;
  created_at: string;
}

interface PhysicianQuery {
  id: number;
  cdi_review_id: number;
  patient_id: number;
  patient_name?: string;
  query_type: string;
  clinical_rationale: string;
  objective_evidence: string[];
  query_options: string[];
  compliance_audit_passed: boolean;
  status: 'drafted' | 'pending_physician_response' | 'agreed_and_documented' | 'disagreed' | 'closed';
  physician_response?: string;
  selected_diagnosis?: string;
  physician_response_notes?: string;
  impact_summary?: string;
  created_at: string;
  responded_at?: string;
}

interface CdiAnalytics {
  totalAudits: number;
  openQueries: number;
  agreedQueries: number;
  disagreedQueries: number;
  physicianAgreementRate: string;
  totalProjectedRevenueLift: number;
  averageWeightLift: number;
  mccCaptureCount: number;
}

export const CdiCommandHub: React.FC = () => {
  const [reviews, setReviews] = useState<CdiReview[]>([]);
  const [queries, setQueries] = useState<PhysicianQuery[]>([]);
  const [analytics, setAnalytics] = useState<CdiAnalytics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'audits' | 'queries'>('audits');

  // New Audit Modal state
  const [showAuditModal, setShowAuditModal] = useState<boolean>(false);
  const [patientIdInput, setPatientIdInput] = useState<string>('82');
  const [principalDiagInput, setPrincipalDiagInput] = useState<string>('Acute Kidney Failure, unspecified (N17.9)');
  const [creatinineInput, setCreatinineInput] = useState<string>('3.2');
  const [feNaInput, setFeNaInput] = useState<string>('2.5');
  const [muddyCastsInput, setMuddyCastsInput] = useState<boolean>(true);
  const [fluidsInput, setFluidsInput] = useState<string>('2500');
  const [efInput, setEfInput] = useState<string>('30');
  const [bnpInput, setBnpInput] = useState<string>('2800');
  const [weightLossInput, setWeightLossInput] = useState<string>('10.5');
  const [bmiInput, setBmiInput] = useState<string>('17.8');
  const [temporalWastingInput, setTemporalWastingInput] = useState<boolean>(true);
  const [notesInput, setNotesInput] = useState<string>('Refractory oliguria and muscle wasting noted.');

  // Respond Modal state
  const [selectedQueryForResponse, setSelectedQueryForResponse] = useState<PhysicianQuery | null>(null);
  const [selectedDiagnosisOption, setSelectedDiagnosisOption] = useState<string>('');
  const [physicianAgreementChoice, setPhysicianAgreementChoice] = useState<'agree' | 'disagree' | 'undetermined'>('agree');
  const [physicianNotesInput, setPhysicianNotesInput] = useState<string>('');

  const token = localStorage.getItem('token') || '';

  const fetchData = async () => {
    setLoading(true);
    try {
      const [revRes, qRes, aRes] = await Promise.all([
        fetch('/api/clinician/cdi/reviews?limit=50', { credentials: 'include', headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/clinician/cdi/queries?limit=50', { credentials: 'include', headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/clinician/cdi/analytics', { credentials: 'include', headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (revRes.ok) setReviews(await revRes.json());
      if (qRes.ok) setQueries(await qRes.json());
      if (aRes.ok) setAnalytics(await aRes.json());
    } catch (err) {
      console.error('Failed to load CDI data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRunAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/clinician/cdi/audit', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId: parseInt(patientIdInput, 10),
          principalDiagnosis: principalDiagInput,
          secondaryDiagnoses: ['Hypertension', 'Type 2 Diabetes'],
          clinicalIndicators: {
            creatinine: creatinineInput ? parseFloat(creatinineInput) : undefined,
            feNa: feNaInput ? parseFloat(feNaInput) : undefined,
            muddyBrownCasts: muddyCastsInput,
            fluidChallengeGivenMl: fluidsInput ? parseInt(fluidsInput, 10) : undefined,
            ejectionFraction: efInput ? parseInt(efInput, 10) : undefined,
            bnp: bnpInput ? parseInt(bnpInput, 10) : undefined,
            chfDocumented: !!efInput,
            bmi: bmiInput ? parseFloat(bmiInput) : undefined,
            weightLossPercentage: weightLossInput ? parseFloat(weightLossInput) : undefined,
            temporalWasting: temporalWastingInput,
            clinicalNotesSummary: notesInput
          },
          reviewerNotes: notesInput
        })
      });

      if (res.ok) {
        setShowAuditModal(false);
        fetchData();
      } else {
        const err = await res.json();
        alert(`Audit failed: ${err.error || 'Server error'}`);
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    }
  };

  const handleGenerateQuery = async (reviewId: number, queryType: string) => {
    try {
      const res = await fetch('/api/clinician/cdi/queries/generate', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          cdiReviewId: reviewId,
          queryType
        })
      });

      if (res.ok) {
        alert('ACDIS/AHIMA compliant non-leading physician query generated successfully!');
        fetchData();
        setActiveTab('queries');
      } else {
        const err = await res.json();
        alert(`Query generation failed: ${err.error || 'Server error'}`);
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    }
  };

  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQueryForResponse) return;

    try {
      const res = await fetch(`/api/clinician/cdi/queries/${selectedQueryForResponse.id}/respond`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          selectedDiagnosis: selectedDiagnosisOption,
          physicianResponse: physicianAgreementChoice,
          physicianNotes: physicianNotesInput
        })
      });

      if (res.ok) {
        setSelectedQueryForResponse(null);
        fetchData();
      } else {
        const err = await res.json();
        alert(`Response submission failed: ${err.error || 'Server error'}`);
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', color: '#f8fafc' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileCheck2 style={{ color: '#38bdf8', width: '28px', height: '28px' }} />
            <h2 style={{ fontSize: '22px', fontWeight: 'bold', margin: 0, color: '#f8fafc' }}>
              Autonomous CDI & Physician Query Hub
            </h2>
          </div>
          <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '13px' }}>
            Real-time chart discrepancy detection (ATN vs AKI, HFrEF/HFpEF, Malnutrition) & ACDIS/AHIMA non-leading physician queries
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={fetchData}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#1e293b',
              color: '#94a3b8',
              border: '1px solid #334155',
              padding: '8px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            <RefreshCw size={15} /> Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowAuditModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600
            }}
          >
            <Plus size={16} /> Run Chart Discrepancy Audit
          </button>
        </div>
      </div>

      {/* Analytics KPI Row */}
      {analytics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>CHARTS AUDITED</span>
              <ClipboardList size={18} style={{ color: '#38bdf8' }} />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '6px', color: '#f8fafc' }}>
              {analytics.totalAudits}
            </div>
            <div style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>
              Audited in real-time
            </div>
          </div>

          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>OPEN QUERIES</span>
              <HelpCircle size={18} style={{ color: '#f59e0b' }} />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '6px', color: '#f59e0b' }}>
              {analytics.openQueries}
            </div>
            <div style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>
              Awaiting physician response
            </div>
          </div>

          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>AGREEMENT RATE</span>
              <TrendingUp size={18} style={{ color: '#10b981' }} />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '6px', color: '#10b981' }}>
              {analytics.physicianAgreementRate}
            </div>
            <div style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>
              {analytics.agreedQueries} MCC/CC captured
            </div>
          </div>

          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>REVENUE LIFT RECONCILED</span>
              <DollarSign size={18} style={{ color: '#22c55e' }} />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '6px', color: '#22c55e' }}>
              +${analytics.totalProjectedRevenueLift.toLocaleString()}
            </div>
            <div style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>
              Avg CMI Weight Lift: +{analytics.averageWeightLift}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #334155', marginBottom: '16px', gap: '8px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('audits')}
          style={{
            background: 'none',
            border: 'none',
            padding: '10px 18px',
            color: activeTab === 'audits' ? '#38bdf8' : '#94a3b8',
            borderBottom: activeTab === 'audits' ? '2px solid #38bdf8' : 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px'
          }}
        >
          Active Chart Reviews ({reviews.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('queries')}
          style={{
            background: 'none',
            border: 'none',
            padding: '10px 18px',
            color: activeTab === 'queries' ? '#38bdf8' : '#94a3b8',
            borderBottom: activeTab === 'queries' ? '2px solid #38bdf8' : 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px'
          }}
        >
          ACDIS Physician Queries ({queries.length})
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Loading CDI records...</div>
      ) : activeTab === 'audits' ? (
        /* Chart Reviews Table */
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155', backgroundColor: '#1e293b', color: '#94a3b8' }}>
                <th style={{ padding: '12px 16px' }}>Review ID / Patient</th>
                <th style={{ padding: '12px 16px' }}>Principal Diagnosis</th>
                <th style={{ padding: '12px 16px' }}>Detected Discrepancies</th>
                <th style={{ padding: '12px 16px' }}>Base MS-DRG</th>
                <th style={{ padding: '12px 16px' }}>Projected MS-DRG (MCC)</th>
                <th style={{ padding: '12px 16px' }}>Rev Delta</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reviews.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                    No CDI chart reviews recorded yet. Run a chart discrepancy audit above.
                  </td>
                </tr>
              ) : (
                reviews.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #1e293b', color: '#e2e8f0' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#f8fafc' }}>{r.patient_name || `Patient #${r.patient_id}`}</div>
                      <div style={{ color: '#64748b', fontSize: '11px' }}>Review #{r.id} • {new Date(r.created_at).toLocaleDateString()}</div>
                    </td>
                    <td style={{ padding: '12px 16px', maxWidth: '200px' }}>
                      <div style={{ fontWeight: 500 }}>{r.principal_diagnosis}</div>
                      {r.secondary_diagnoses && r.secondary_diagnoses.length > 0 && (
                        <div style={{ color: '#94a3b8', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          Sec: {r.secondary_diagnoses.join(', ')}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {r.identified_discrepancies.map((d, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              backgroundColor: d.suggestedClassification === 'MCC' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                              color: d.suggestedClassification === 'MCC' ? '#f87171' : '#fbbf24',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px'
                            }}
                          >
                            <AlertTriangle size={12} />
                            <span>{d.conditionName} ({d.suggestedClassification})</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8' }}>
                      <div>{r.base_ms_drg}</div>
                      <div style={{ fontSize: '11px' }}>Wt: {r.base_drg_weight}</div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#38bdf8' }}>
                      <div style={{ fontWeight: 600 }}>{r.projected_ms_drg}</div>
                      <div style={{ fontSize: '11px' }}>Wt: {r.projected_drg_weight}</div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#22c55e', fontWeight: 600 }}>
                      +${Number(r.estimated_reimbursement_delta).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor:
                            r.review_status === 'resolved_cc_mcc'
                              ? 'rgba(34, 197, 94, 0.2)'
                              : r.review_status === 'query_open'
                              ? 'rgba(245, 158, 11, 0.2)'
                              : 'rgba(56, 189, 248, 0.2)',
                          color:
                            r.review_status === 'resolved_cc_mcc'
                              ? '#4ade80'
                              : r.review_status === 'query_open'
                              ? '#fcd34d'
                              : '#38bdf8'
                        }}
                      >
                        {r.review_status.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {r.identified_discrepancies.length > 0 && r.review_status !== 'resolved_cc_mcc' && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                          {r.identified_discrepancies.map((d, dIdx) => (
                            <button
                              key={dIdx}
                              type="button"
                              onClick={() => handleGenerateQuery(r.id, d.queryType)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                backgroundColor: '#0369a1',
                                color: '#ffffff',
                                border: 'none',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                cursor: 'pointer'
                              }}
                              title={`Generate ${d.conditionName} Query`}
                            >
                              <Sparkles size={11} /> Query {d.queryType.split('_')[0].toUpperCase()}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Queries Table */
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155', backgroundColor: '#1e293b', color: '#94a3b8' }}>
                <th style={{ padding: '12px 16px' }}>Query ID / Patient</th>
                <th style={{ padding: '12px 16px' }}>Query Focus</th>
                <th style={{ padding: '12px 16px' }}>Objective Clinical Evidence</th>
                <th style={{ padding: '12px 16px' }}>Compliance</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px' }}>Documented Outcome</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {queries.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                    No physician queries generated yet.
                  </td>
                </tr>
              ) : (
                queries.map((q) => (
                  <tr key={q.id} style={{ borderBottom: '1px solid #1e293b', color: '#e2e8f0' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#f8fafc' }}>{q.patient_name || `Patient #${q.patient_id}`}</div>
                      <div style={{ color: '#64748b', fontSize: '11px' }}>Query #{q.id} • Review #{q.cdi_review_id}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#38bdf8' }}>{q.query_type.replace(/_/g, ' ').toUpperCase()}</div>
                      <div style={{ color: '#94a3b8', fontSize: '11px', maxWidth: '240px' }}>{q.clinical_rationale}</div>
                    </td>
                    <td style={{ padding: '12px 16px', maxWidth: '300px' }}>
                      <ul style={{ margin: 0, paddingLeft: '16px', color: '#cbd5e1', fontSize: '12px' }}>
                        {q.objective_evidence.map((ev, eIdx) => (
                          <li key={eIdx}>{ev}</li>
                        ))}
                      </ul>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                        ACDIS/AHIMA Non-Leading
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor:
                            q.status === 'agreed_and_documented'
                              ? 'rgba(34, 197, 94, 0.2)'
                              : q.status === 'disagreed'
                              ? 'rgba(239, 68, 68, 0.2)'
                              : 'rgba(245, 158, 11, 0.2)',
                          color:
                            q.status === 'agreed_and_documented'
                              ? '#4ade80'
                              : q.status === 'disagreed'
                              ? '#f87171'
                              : '#fcd34d'
                        }}
                      >
                        {q.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', maxWidth: '240px' }}>
                      {q.selected_diagnosis ? (
                        <div>
                          <div style={{ fontWeight: 500, color: '#4ade80' }}>{q.selected_diagnosis}</div>
                          <div style={{ color: '#64748b', fontSize: '11px' }}>{q.impact_summary}</div>
                        </div>
                      ) : (
                        <span style={{ color: '#64748b', fontStyle: 'italic' }}>Pending physician response</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {q.status === 'pending_physician_response' && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedQueryForResponse(q);
                            setSelectedDiagnosisOption(q.query_options[0] || '');
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: '#2563eb',
                            color: '#ffffff',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 600
                          }}
                        >
                          <Stethoscope size={13} /> Respond / Sign
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Run Chart Discrepancy Audit */}
      {showAuditModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '24px', width: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#f8fafc' }}>Run Inpatient Chart Discrepancy Audit</h3>
              <button type="button" onClick={() => setShowAuditModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRunAudit}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Patient ID</label>
                <input
                  type="number"
                  value={patientIdInput}
                  onChange={(e) => setPatientIdInput(e.target.value)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                  required
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Current Principal Diagnosis on Chart</label>
                <input
                  type="text"
                  value={principalDiagInput}
                  onChange={(e) => setPrincipalDiagInput(e.target.value)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Serum Creatinine (mg/dL)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={creatinineInput}
                    onChange={(e) => setCreatinineInput(e.target.value)}
                    style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Fractional Excretion of Sodium (FeNa %)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={feNaInput}
                    onChange={(e) => setFeNaInput(e.target.value)}
                    style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Echocardiogram LVEF (%)</label>
                  <input
                    type="number"
                    value={efInput}
                    onChange={(e) => setEfInput(e.target.value)}
                    placeholder="e.g. 28"
                    style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>NT-proBNP / BNP (pg/mL)</label>
                  <input
                    type="number"
                    value={bnpInput}
                    onChange={(e) => setBnpInput(e.target.value)}
                    placeholder="e.g. 3400"
                    style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Weight Loss (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={weightLossInput}
                    onChange={(e) => setWeightLossInput(e.target.value)}
                    placeholder="e.g. 11.5"
                    style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Body Mass Index (BMI)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={bmiInput}
                    onChange={(e) => setBmiInput(e.target.value)}
                    placeholder="e.g. 17.5"
                    style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '20px', marginBottom: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#e2e8f0', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={muddyCastsInput}
                    onChange={(e) => setMuddyCastsInput(e.target.checked)}
                  />
                  Muddy brown granular casts on urine sediment
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#e2e8f0', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={temporalWastingInput}
                    onChange={(e) => setTemporalWastingInput(e.target.checked)}
                  />
                  Temporal / clavicular muscle wasting
                </label>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Fluid Challenge Administered (mL)</label>
                <input
                  type="number"
                  value={fluidsInput}
                  onChange={(e) => setFluidsInput(e.target.value)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Clinical Notes / Observations</label>
                <textarea
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  rows={2}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAuditModal(false)}
                  style={{ backgroundColor: '#1e293b', color: '#94a3b8', border: '1px solid #334155', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: '#0284c7', color: '#ffffff', border: 'none', padding: '8px 18px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Execute Audit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Respond to Physician Query */}
      {selectedQueryForResponse && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '24px', width: '650px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#f8fafc' }}>ACDIS/AHIMA Compliant Physician Query</h3>
                <span style={{ color: '#38bdf8', fontSize: '12px', fontWeight: 600 }}>Query #{selectedQueryForResponse.id} • {selectedQueryForResponse.query_type.replace(/_/g, ' ').toUpperCase()}</span>
              </div>
              <button type="button" onClick={() => setSelectedQueryForResponse(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ backgroundColor: '#1e293b', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginBottom: '6px' }}>OBJECTIVE CLINICAL EVIDENCE PRESENTED</div>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '13px', color: '#e2e8f0' }}>
                {selectedQueryForResponse.objective_evidence.map((ev, i) => (
                  <li key={i}>{ev}</li>
                ))}
              </ul>
            </div>

            <form onSubmit={handleSubmitResponse}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#f8fafc', fontWeight: 600, marginBottom: '8px' }}>
                  Select Diagnostic Clarification (Non-Leading Options):
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedQueryForResponse.query_options.map((opt, oIdx) => (
                    <label
                      key={oIdx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        backgroundColor: selectedDiagnosisOption === opt ? 'rgba(56, 189, 248, 0.15)' : '#1e293b',
                        border: selectedDiagnosisOption === opt ? '1px solid #38bdf8' : '1px solid #334155',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        color: '#f8fafc'
                      }}
                    >
                      <input
                        type="radio"
                        name="diagnosis_option"
                        value={opt}
                        checked={selectedDiagnosisOption === opt}
                        onChange={() => setSelectedDiagnosisOption(opt)}
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Attending Physician Decision</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f8fafc', fontSize: '13px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="agreement_choice"
                      value="agree"
                      checked={physicianAgreementChoice === 'agree'}
                      onChange={() => setPhysicianAgreementChoice('agree')}
                    />
                    Agree & Document Specificity (Reconcile CC/MCC)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f8fafc', fontSize: '13px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="agreement_choice"
                      value="disagree"
                      checked={physicianAgreementChoice === 'disagree'}
                      onChange={() => setPhysicianAgreementChoice('disagree')}
                    />
                    Disagree (Maintain Existing Diagnosis)
                  </label>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Physician Clinical Rationale / Notes</label>
                <textarea
                  value={physicianNotesInput}
                  onChange={(e) => setPhysicianNotesInput(e.target.value)}
                  rows={3}
                  placeholder="Document clinical judgment regarding kidney injury etiology / volume responsiveness..."
                  style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedQueryForResponse(null)}
                  style={{ backgroundColor: '#1e293b', color: '#94a3b8', border: '1px solid #334155', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: '#10b981', color: '#ffffff', border: 'none', padding: '8px 18px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Sign & Submit Documentation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CdiCommandHub;
