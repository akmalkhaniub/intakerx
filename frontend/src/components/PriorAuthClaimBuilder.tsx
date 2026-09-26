import React, { useState, useEffect } from 'react';
import { 
  CreditCard, CheckCircle2, AlertTriangle, FileText, 
  Send, RefreshCw, PlusCircle, Check, Copy,
  DollarSign
} from 'lucide-react';

export interface PriorAuth {
  id: number;
  session_id: string;
  payer_name: string;
  procedure_cpt: string;
  procedure_name: string;
  diagnosis_icd10: string;
  diagnosis_name: string;
  clinical_justification: string;
  denial_risk_score: number;
  denial_risk_rationale: string;
  packet_data: any;
  status: 'draft' | 'pending_payer_review' | 'approved' | 'peer_to_peer_required' | 'denied';
  auth_number?: string;
  created_at: string;
  updated_at: string;
}

export interface ServiceLineItem {
  dateOfService: string;
  placeOfService: string;
  cptCode: string;
  procedureDescription: string;
  modifier?: string;
  diagnosisPointers: string[];
  charge: number;
  units: number;
}

export interface InsuranceClaim {
  id: number;
  session_id: string;
  pa_id?: number;
  patient_name: string;
  insured_id: string;
  payer_id: string;
  payer_name: string;
  billing_provider: string;
  rendering_npi: string;
  place_of_service: string;
  icd10_codes: string[];
  service_lines: ServiceLineItem[];
  total_billed: string | number;
  cms1500_rendered_text?: string;
  status: 'scrubbed_clean' | 'needs_review' | 'submitted' | 'accepted' | 'rejected';
  clearinghouse_batch_id?: string;
  created_at: string;
  updated_at: string;
}

interface PriorAuthClaimBuilderProps {
  sessionId?: string;
  token?: string;
  backendUrl?: string;
  patientName?: string;
}

export const PriorAuthClaimBuilder: React.FC<PriorAuthClaimBuilderProps> = ({
  sessionId,
  token,
  backendUrl = '',
  patientName = 'Encounter Patient'
}) => {
  const [priorAuths, setPriorAuths] = useState<PriorAuth[]>([]);
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'pa' | 'claims'>('pa');

  // New PA Form State
  const [showNewPaModal, setShowNewPaModal] = useState(false);
  const [formPayer, setFormPayer] = useState('Aetna Open Choice PPO');
  const [formCpt, setFormCpt] = useState('70553');
  const [formIcd10, setFormIcd10] = useState('G43.909');
  const [formUrgency, setFormUrgency] = useState<'standard' | 'expedited' | 'urgent'>('expedited');
  const [formJustification, setFormJustification] = useState(
    'Patient presents with refractory severe headaches accompanied by focal neurological paresthesias. Prior oral preventative pharmacotherapy failed to achieve symptom control.'
  );

  // View Letter Modal State
  const [selectedPaForLetter, setSelectedPaForLetter] = useState<PriorAuth | null>(null);
  const [copiedLetter, setCopiedLetter] = useState(false);

  // View CMS-1500 Modal State
  const [selectedClaimForView, setSelectedClaimForView] = useState<InsuranceClaim | null>(null);

  useEffect(() => {
    if (sessionId) {
      fetchBillingData();
    }
  }, [sessionId]);

  const fetchBillingData = async () => {
    if (!sessionId) return;
    setIsLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [paRes, claimsRes] = await Promise.all([
        fetch(`${backendUrl}/api/clinician/sessions/${sessionId}/prior-auths`, { headers }),
        fetch(`${backendUrl}/api/clinician/sessions/${sessionId}/claims`, { headers })
      ]);

      if (paRes.ok) {
        const paData = await paRes.json();
        setPriorAuths(paData);
      }
      if (claimsRes.ok) {
        const claimsData = await claimsRes.json();
        setClaims(claimsData);
      }
    } catch (err) {
      console.error('Failed to fetch billing data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeneratePa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${backendUrl}/api/clinician/sessions/${sessionId}/prior-auths/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          payerName: formPayer,
          procedureCpt: formCpt,
          diagnosisIcd10: formIcd10,
          urgency: formUrgency,
          customJustification: formJustification,
          failedTherapies: [
            'Documented failure of first-line anti-inflammatory & abortive therapy (4+ weeks)',
            'Specialist clinical consultation completed with persistent refractory functional impairment'
          ]
        })
      });

      if (res.ok) {
        setShowNewPaModal(false);
        fetchBillingData();
      }
    } catch (err) {
      console.error('Failed to generate PA:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePaStatus = async (paId: number, status: string) => {
    try {
      const res = await fetch(`${backendUrl}/api/clinician/prior-auths/${paId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchBillingData();
      }
    } catch (err) {
      console.error('Failed to update PA status:', err);
    }
  };

  const handleCompileClaim = async (paId?: number) => {
    if (!sessionId) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${backendUrl}/api/clinician/sessions/${sessionId}/claims/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ paId, placeOfService: '11' })
      });
      if (res.ok) {
        setActiveSubTab('claims');
        fetchBillingData();
      }
    } catch (err) {
      console.error('Failed to compile claim:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitClaim = async (claimId: number) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`${backendUrl}/api/clinician/claims/${claimId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        fetchBillingData();
      }
    } catch (err) {
      console.error('Failed to submit claim:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLetter = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLetter(true);
    setTimeout(() => setCopiedLetter(false), 2000);
  };

  const getRiskColor = (score: number) => {
    if (score <= 20) return '#10b981'; // Green
    if (score <= 50) return '#f59e0b'; // Amber
    return '#ef4444'; // Red
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
      case 'accepted':
      case 'scrubbed_clean':
        return { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '#10b981' };
      case 'submitted':
      case 'pending_payer_review':
        return { bg: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '#38bdf8' };
      case 'peer_to_peer_required':
      case 'needs_review':
        return { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '#f59e0b' };
      case 'denied':
      case 'rejected':
        return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '#ef4444' };
      default:
        return { bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', border: '#94a3b8' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Top Banner & Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px',
        borderRadius: '12px',
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(56, 189, 248, 0.08) 100%)',
        border: '1px solid rgba(16, 185, 129, 0.3)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            padding: '12px',
            borderRadius: '10px',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <CreditCard size={28} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: 'var(--text-main, #f8fafc)' }}>
              Autonomous Prior-Authorization & CMS-1500 Claim Engine
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted, #94a3b8)' }}>
              Encounter: <strong style={{ color: '#38bdf8' }}>{patientName}</strong> &bull; AI Denial Risk Scoring &bull; LCD/NCD Medical Necessity Scrubber &bull; EDI 837P Batch Pipeline
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setShowNewPaModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '8px',
              background: '#10b981',
              color: '#fff',
              border: 'none',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            <PlusCircle size={16} />
            Request Prior-Auth
          </button>
          <button
            onClick={() => handleCompileClaim()}
            disabled={isSubmitting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '8px',
              background: '#0284c7',
              color: '#fff',
              border: 'none',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            <DollarSign size={16} />
            Compile CMS-1500
          </button>
          <button
            onClick={fetchBillingData}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '8px',
              padding: '10px',
              color: 'var(--text-muted, #94a3b8)',
              cursor: 'pointer'
            }}
            title="Refresh Billing Data"
          >
            <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
        <button
          onClick={() => setActiveSubTab('pa')}
          style={{
            background: 'none',
            border: 'none',
            color: activeSubTab === 'pa' ? '#10b981' : 'var(--text-muted, #94a3b8)',
            borderBottom: activeSubTab === 'pa' ? '2.5px solid #10b981' : 'none',
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          📋 Prior-Authorizations ({priorAuths.length})
        </button>
        <button
          onClick={() => setActiveSubTab('claims')}
          style={{
            background: 'none',
            border: 'none',
            color: activeSubTab === 'claims' ? '#38bdf8' : 'var(--text-muted, #94a3b8)',
            borderBottom: activeSubTab === 'claims' ? '2.5px solid #38bdf8' : 'none',
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          🧾 CMS-1500 Claims ({claims.length})
        </button>
      </div>

      {/* Tab Content: Prior-Authorizations */}
      {activeSubTab === 'pa' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {priorAuths.length === 0 ? (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '12px',
              border: '1px dashed rgba(255,255,255,0.15)'
            }}>
              <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '15px' }}>
                No prior-authorization requests on file for this encounter.
              </p>
              <button
                onClick={() => setShowNewPaModal(true)}
                style={{
                  marginTop: '12px',
                  padding: '8px 18px',
                  borderRadius: '6px',
                  background: '#10b981',
                  color: '#fff',
                  border: 'none',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Create High-Cost Procedure PA
              </button>
            </div>
          ) : (
            priorAuths.map(pa => {
              const badge = getStatusBadge(pa.status);
              const riskColor = getRiskColor(pa.denial_risk_score);

              return (
                <div key={pa.id} style={{
                  padding: '20px',
                  borderRadius: '12px',
                  background: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          fontSize: '12px',
                          fontWeight: 'bold',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`
                        }}>
                          {pa.status.replace(/_/g, ' ').toUpperCase()}
                        </span>
                        {pa.auth_number && (
                          <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 'bold' }}>
                            Auth #: {pa.auth_number}
                          </span>
                        )}
                        <span style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)' }}>
                          Payer: <strong style={{ color: '#f8fafc' }}>{pa.payer_name}</strong>
                        </span>
                      </div>
                      <h3 style={{ margin: '8px 0 4px', fontSize: '16px', color: '#f8fafc' }}>
                        CPT {pa.procedure_cpt}: {pa.procedure_name}
                      </h3>
                      <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted, #94a3b8)' }}>
                        Indication: <strong style={{ color: '#38bdf8' }}>{pa.diagnosis_icd10}</strong> &bull; {pa.diagnosis_name}
                      </p>
                    </div>

                    {/* Denial Risk Gauge */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: `1px solid ${riskColor}40`
                    }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Payer Denial Risk
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: riskColor }}>
                          {pa.denial_risk_score}%
                        </div>
                      </div>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        border: `3px solid ${riskColor}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: riskColor
                      }}>
                        {pa.denial_risk_score <= 20 ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                      </div>
                    </div>
                  </div>

                  {/* Denial Rationale */}
                  <div style={{
                    fontSize: '12.5px',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    background: 'rgba(15, 23, 42, 0.4)',
                    color: 'var(--text-muted, #94a3b8)',
                    lineHeight: '1.4'
                  }}>
                    <strong style={{ color: '#f8fafc' }}>Clinical Risk Evaluation:</strong> {pa.denial_risk_rationale}
                  </div>

                  {/* Actions Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => setSelectedPaForLetter(pa)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          background: 'rgba(255,255,255,0.06)',
                          color: '#f8fafc',
                          border: '1px solid rgba(255,255,255,0.15)',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        <FileText size={14} />
                        View Letter of Necessity
                      </button>

                      <button
                        onClick={() => handleCompileClaim(pa.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          background: 'rgba(56, 189, 248, 0.15)',
                          color: '#38bdf8',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        <DollarSign size={14} />
                        Generate Linked CMS-1500
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      {pa.status !== 'approved' && (
                        <button
                          onClick={() => handleUpdatePaStatus(pa.id, 'approved')}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            background: '#10b981',
                            color: '#fff',
                            border: 'none',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          Approve PA
                        </button>
                      )}
                      {pa.status !== 'peer_to_peer_required' && (
                        <button
                          onClick={() => handleUpdatePaStatus(pa.id, 'peer_to_peer_required')}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            background: 'rgba(245, 158, 11, 0.2)',
                            color: '#f59e0b',
                            border: '1px solid rgba(245, 158, 11, 0.4)',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          Peer-to-Peer
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab Content: CMS-1500 Claims */}
      {activeSubTab === 'claims' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {claims.length === 0 ? (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '12px',
              border: '1px dashed rgba(255,255,255,0.15)'
            }}>
              <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '15px' }}>
                No CMS-1500 insurance claims compiled for this session yet.
              </p>
              <button
                onClick={() => handleCompileClaim()}
                style={{
                  marginTop: '12px',
                  padding: '8px 18px',
                  borderRadius: '6px',
                  background: '#0284c7',
                  color: '#fff',
                  border: 'none',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Compile 100% Clean Claim
              </button>
            </div>
          ) : (
            claims.map(claim => {
              const badge = getStatusBadge(claim.status);
              const serviceLines: ServiceLineItem[] = Array.isArray(claim.service_lines) 
                ? claim.service_lines 
                : typeof claim.service_lines === 'string' 
                ? JSON.parse(claim.service_lines) 
                : [];

              return (
                <div key={claim.id} style={{
                  padding: '20px',
                  borderRadius: '12px',
                  background: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          fontSize: '12px',
                          fontWeight: 'bold',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`
                        }}>
                          {claim.status.replace(/_/g, ' ').toUpperCase()}
                        </span>
                        {claim.clearinghouse_batch_id && (
                          <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 'bold' }}>
                            Batch ID: {claim.clearinghouse_batch_id}
                          </span>
                        )}
                        <span style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)' }}>
                          Payer: <strong style={{ color: '#f8fafc' }}>{claim.payer_name}</strong> ({claim.payer_id})
                        </span>
                      </div>
                      <h3 style={{ margin: '8px 0 4px', fontSize: '16px', color: '#f8fafc' }}>
                        CMS-1500 Claim #{claim.id} &bull; Insured ID: {claim.insured_id}
                      </h3>
                      <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted, #94a3b8)' }}>
                        Billing Provider: {claim.billing_provider} &bull; Rendering NPI: <strong style={{ color: '#10b981' }}>{claim.rendering_npi}</strong> &bull; POS: {claim.place_of_service}
                      </p>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase' }}>
                        Total Billed
                      </div>
                      <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#10b981' }}>
                        ${Number(claim.total_billed).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Service Lines Table Preview */}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted, #94a3b8)' }}>
                          <th style={{ padding: '6px' }}>DOS</th>
                          <th style={{ padding: '6px' }}>POS</th>
                          <th style={{ padding: '6px' }}>CPT / HCPCS</th>
                          <th style={{ padding: '6px' }}>Description</th>
                          <th style={{ padding: '6px' }}>Mod</th>
                          <th style={{ padding: '6px' }}>Dx Pointers</th>
                          <th style={{ padding: '6px', textAlign: 'right' }}>Charge</th>
                        </tr>
                      </thead>
                      <tbody>
                        {serviceLines.map((line, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '8px 6px' }}>{line.dateOfService}</td>
                            <td style={{ padding: '8px 6px' }}>{line.placeOfService}</td>
                            <td style={{ padding: '8px 6px', fontWeight: 'bold', color: '#38bdf8' }}>{line.cptCode}</td>
                            <td style={{ padding: '8px 6px', color: 'var(--text-muted, #94a3b8)' }}>{line.procedureDescription}</td>
                            <td style={{ padding: '8px 6px' }}>{line.modifier || '--'}</td>
                            <td style={{ padding: '8px 6px' }}>{line.diagnosisPointers.join(', ')}</td>
                            <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 'bold', color: '#f8fafc' }}>
                              ${line.charge.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Claim Actions */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                    <button
                      onClick={() => setSelectedClaimForView(claim)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        background: 'rgba(255,255,255,0.06)',
                        color: '#f8fafc',
                        border: '1px solid rgba(255,255,255,0.15)',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      <FileText size={14} />
                      View CMS-1500 Layout (Box 1-33)
                    </button>

                    {claim.status !== 'submitted' && claim.status !== 'accepted' && (
                      <button
                        onClick={() => handleSubmitClaim(claim.id)}
                        disabled={isSubmitting}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 14px',
                          borderRadius: '6px',
                          background: '#10b981',
                          color: '#fff',
                          border: 'none',
                          fontWeight: '600',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        <Send size={14} />
                        Transmit Claim to Clearinghouse
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Modal: Create New Prior-Authorization */}
      {showNewPaModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '600px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#f8fafc' }}>
                Initiate Autonomous Prior-Authorization
              </h3>
              <button
                onClick={() => setShowNewPaModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleGeneratePa} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted, #94a3b8)', marginBottom: '4px' }}>
                  Commercial / Medicare Payer:
                </label>
                <select
                  value={formPayer}
                  onChange={(e) => setFormPayer(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: '#1e293b',
                    color: '#f8fafc',
                    border: '1px solid rgba(255,255,255,0.15)'
                  }}
                >
                  <option value="Aetna Open Choice PPO">Aetna Open Choice PPO</option>
                  <option value="Blue Cross Blue Shield of Texas">Blue Cross Blue Shield of Texas</option>
                  <option value="UnitedHealthcare Choice Plus">UnitedHealthcare Choice Plus</option>
                  <option value="Cigna Open Access Plus">Cigna Open Access Plus</option>
                  <option value="Humana Medicare Advantage">Humana Medicare Advantage</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted, #94a3b8)', marginBottom: '4px' }}>
                    Requested CPT / HCPCS:
                  </label>
                  <select
                    value={formCpt}
                    onChange={(e) => setFormCpt(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      background: '#1e293b',
                      color: '#f8fafc',
                      border: '1px solid rgba(255,255,255,0.15)'
                    }}
                  >
                    <option value="70553">CPT 70553: MRI Brain w/wo Contrast</option>
                    <option value="72148">CPT 72148: MRI Lumbar Spine w/o Contrast</option>
                    <option value="93458">CPT 93458: Left Heart Cath / Angiogram</option>
                    <option value="78815">CPT 78815: PET-CT Systemic Tumor Imaging</option>
                    <option value="27447">CPT 27447: Total Knee Arthroplasty</option>
                    <option value="J0178">HCPCS J0178: Eylea (Aflibercept) 1mg</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted, #94a3b8)', marginBottom: '4px' }}>
                    Primary ICD-10 Diagnosis:
                  </label>
                  <select
                    value={formIcd10}
                    onChange={(e) => setFormIcd10(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      background: '#1e293b',
                      color: '#f8fafc',
                      border: '1px solid rgba(255,255,255,0.15)'
                    }}
                  >
                    <option value="G43.909">G43.909: Migraine, Unspecified</option>
                    <option value="M54.5">M54.5: Low Back Pain</option>
                    <option value="I25.10">I25.10: Coronary Artery Disease</option>
                    <option value="C34.90">C34.90: Malignant Neoplasm Bronchus/Lung</option>
                    <option value="M17.11">M17.11: Primary Osteoarthritis, Right Knee</option>
                    <option value="H35.3211">H35.3211: Wet Macular Degeneration</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted, #94a3b8)', marginBottom: '4px' }}>
                  Review Urgency:
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {(['standard', 'expedited', 'urgent'] as const).map(u => (
                    <label key={u} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      color: formUrgency === u ? '#38bdf8' : 'var(--text-muted, #94a3b8)',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="radio"
                        name="urgency"
                        checked={formUrgency === u}
                        onChange={() => setFormUrgency(u)}
                      />
                      {u.charAt(0).toUpperCase() + u.slice(1)}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted, #94a3b8)', marginBottom: '4px' }}>
                  Clinical Justification & Medical Necessity Rationale:
                </label>
                <textarea
                  value={formJustification}
                  onChange={(e) => setFormJustification(e.target.value)}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: '#1e293b',
                    color: '#f8fafc',
                    border: '1px solid rgba(255,255,255,0.15)',
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowNewPaModal(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    background: 'transparent',
                    color: '#94a3b8',
                    border: '1px solid rgba(255,255,255,0.15)',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '6px',
                    background: '#10b981',
                    color: '#fff',
                    border: 'none',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  {isSubmitting ? 'Evaluating & Compiling...' : 'Submit & Score PA'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Letter of Medical Necessity */}
      {selectedPaForLetter && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '750px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.1)'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#f8fafc' }}>
                  Letter of Medical Necessity (CMS / LCD Compliant)
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)' }}>
                  Prior-Auth ID #{selectedPaForLetter.id} &bull; {selectedPaForLetter.payer_name}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={() => {
                    const packetData = typeof selectedPaForLetter.packet_data === 'string'
                      ? JSON.parse(selectedPaForLetter.packet_data)
                      : selectedPaForLetter.packet_data;
                    handleCopyLetter(packetData?.letterOfMedicalNecessity || '');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: 'rgba(56, 189, 248, 0.2)',
                    color: '#38bdf8',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  {copiedLetter ? <Check size={14} /> : <Copy size={14} />}
                  {copiedLetter ? 'Copied!' : 'Copy Letter'}
                </button>
                <button
                  onClick={() => setSelectedPaForLetter(null)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
                >
                  &times;
                </button>
              </div>
            </div>

            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              <pre style={{
                background: '#1e293b',
                padding: '16px',
                borderRadius: '8px',
                color: '#e2e8f0',
                fontSize: '12.5px',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                margin: 0
              }}>
                {(typeof selectedPaForLetter.packet_data === 'string'
                  ? JSON.parse(selectedPaForLetter.packet_data)
                  : selectedPaForLetter.packet_data)?.letterOfMedicalNecessity || 'No letter content available.'}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Modal: View CMS-1500 Layout */}
      {selectedClaimForView && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '820px',
            maxHeight: '88vh',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.1)'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#f8fafc' }}>
                  Standard Health Insurance Claim Form (CMS-1500 / EDI 837P)
                </h3>
                <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 'bold' }}>
                  Clean Claim Box 1 - Box 33 Verification &bull; Total: ${Number(selectedClaimForView.total_billed).toFixed(2)}
                </span>
              </div>
              <button
                onClick={() => setSelectedClaimForView(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              <pre style={{
                background: '#030712',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '16px',
                borderRadius: '8px',
                color: '#38bdf8',
                fontSize: '11.5px',
                lineHeight: '1.45',
                whiteSpace: 'pre-wrap',
                fontFamily: 'Courier New, monospace',
                margin: 0
              }}>
                {selectedClaimForView.cms1500_rendered_text || 'No rendered text available.'}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PriorAuthClaimBuilder;
