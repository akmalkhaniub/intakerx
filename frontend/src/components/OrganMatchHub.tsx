import React, { useState, useEffect } from 'react';
import {
  Heart,
  Activity,
  RefreshCw,
  Plus,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Navigation,
  FileCheck,
  X,
  Stethoscope,
  Sparkles,
  CheckCircle2,
  XCircle,
  Truck
} from 'lucide-react';

interface DsaMatch {
  locus: string;
  allele: string;
  mfi: number;
  c1qPositive: boolean;
  isUnacceptableAntigen: boolean;
}

interface VirtualCrossmatch {
  id: number;
  transplant_case_id: number;
  crossmatch_type: string;
  detected_dsas: DsaMatch[];
  peak_mfi: number;
  crossmatch_prediction: 'negative_compatible' | 'low_positive_permissible' | 'high_positive_contraindicated';
  rejection_risk_level: 'low' | 'moderate' | 'high_hyperacute';
  recommended_induction_protocol: string;
  desensitization_required: boolean;
  reviewed_by_director?: string;
  evaluated_at: string;
}

interface TransplantCase {
  id: number;
  patient_id: number;
  patient_name?: string;
  organ_type: 'kidney' | 'liver' | 'heart' | 'lung' | 'pancreas';
  listing_status: 'active_listed' | 'match_pending' | 'in_transit' | 'in_operating_room' | 'transplanted' | 'delisted';
  recipient_blood_group: string;
  meld_na_score?: number | null;
  kdpi_score?: number | null;
  cpra_percentage: number;
  recipient_hla: any;
  unacceptable_antigens: string[];
  donor_unos_id?: string | null;
  donor_blood_group?: string | null;
  donor_hla?: any;
  preservation_method: 'static_cold_storage' | 'hypothermic_machine_perfusion' | 'normothermic_regional_perfusion';
  cross_clamp_timestamp?: string | null;
  max_acceptable_cit_hours: number;
  transit_courier_eta?: string | null;
  assigned_surgeon?: string | null;
  created_at: string;
  elapsedCitHours?: number;
  citRiskStatus?: 'optimal' | 'caution_approaching_limit' | 'critical_risk';
  crossmatches?: VirtualCrossmatch[];
}

interface TransplantAnalytics {
  activeListedCount: number;
  inTransitCount: number;
  inOrCount: number;
  totalCrossmatches: number;
  compatibleRate: string;
  organBreakdown: Record<string, number>;
}

export const OrganMatchHub: React.FC = () => {
  const [cases, setCases] = useState<TransplantCase[]>([]);
  const [analytics, setAnalytics] = useState<TransplantAnalytics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'pipeline' | 'calculator'>('pipeline');

  // New Case Modal
  const [showNewCaseModal, setShowNewCaseModal] = useState<boolean>(false);
  const [newPatientId, setNewPatientId] = useState<string>('83');
  const [newOrganType, setNewOrganType] = useState<'kidney' | 'liver' | 'heart' | 'lung'>('kidney');
  const [newBloodGroup, setNewBloodGroup] = useState<string>('O+');
  const [newCpra, setNewCpra] = useState<string>('45');
  const [newUnacceptables, setNewUnacceptables] = useState<string>('A*02:01, B*07:02');
  const [newSurgeon, setNewSurgeon] = useState<string>('Dr. Rebecca Chen, FACS');

  // Crossmatch Modal
  const [selectedCaseForXm, setSelectedCaseForXm] = useState<TransplantCase | null>(null);
  const [donorUnosIdInput, setDonorUnosIdInput] = useState<string>('DONOR-IL-442');
  const [donorBloodInput, setDonorBloodInput] = useState<string>('O+');
  const [donorAlleleA, setDonorAlleleA] = useState<string>('A*01:01, A*03:01');
  const [donorAlleleB, setDonorAlleleB] = useState<string>('B*08:01, B*35:01');
  const [donorAlleleDr, setDonorAlleleDr] = useState<string>('DRB1*03:01, DRB1*11:01');
  const [preservationMethodInput, setPreservationMethodInput] = useState<'static_cold_storage' | 'hypothermic_machine_perfusion' | 'normothermic_regional_perfusion'>('hypothermic_machine_perfusion');
  const [etaMinutesInput, setEtaMinutesInput] = useState<string>('75');
  const [recentXmResult, setRecentXmResult] = useState<VirtualCrossmatch | null>(null);

  // MELD-Na Calculator Tab State
  const [calcCr, setCalcCr] = useState<string>('2.4');
  const [calcBili, setCalcBili] = useState<string>('3.5');
  const [calcInr, setCalcInr] = useState<string>('2.0');
  const [calcNa, setCalcNa] = useState<string>('128');
  const [calcDialysis, setCalcDialysis] = useState<boolean>(false);
  const [calculatedMeld, setCalculatedMeld] = useState<{ meldInitial: number; meldNa: number } | null>(null);

  const token = localStorage.getItem('token') || '';

  const fetchData = async () => {
    setLoading(true);
    try {
      const [casesRes, analyticsRes] = await Promise.all([
        fetch('/api/clinician/transplant/cases', { credentials: 'include', headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/clinician/transplant/analytics', { credentials: 'include', headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (casesRes.ok) setCases(await casesRes.json());
      if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
    } catch (err) {
      console.error('Failed to load transplant data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const unaccArray = newUnacceptables.split(',').map(s => s.trim()).filter(Boolean);
      const res = await fetch('/api/clinician/transplant/cases', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId: parseInt(newPatientId, 10),
          organType: newOrganType,
          recipientBloodGroup: newBloodGroup,
          cpraPercentage: parseFloat(newCpra),
          unacceptableAntigens: unaccArray,
          assignedSurgeon: newSurgeon,
          recipientHla: {
            a: ['A*01:01', 'A*24:02'],
            b: ['B*08:01', 'B*44:02'],
            dr: ['DRB1*03:01', 'DRB1*15:01'],
            specificAntibodies: unaccArray.map(u => ({ locus: u.charAt(0), allele: u, mfi: 5500, c1qPositive: true }))
          }
        })
      });

      if (res.ok) {
        setShowNewCaseModal(false);
        fetchData();
      } else {
        const err = await res.json();
        alert(`Listing failed: ${err.error || 'Server error'}`);
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    }
  };

  const handleRunCrossmatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseForXm) return;

    try {
      const aList = donorAlleleA.split(',').map(s => s.trim()).filter(Boolean);
      const bList = donorAlleleB.split(',').map(s => s.trim()).filter(Boolean);
      const drList = donorAlleleDr.split(',').map(s => s.trim()).filter(Boolean);

      const res = await fetch('/api/clinician/transplant/crossmatch', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          transplantCaseId: selectedCaseForXm.id,
          donorUnosId: donorUnosIdInput,
          donorBloodGroup: donorBloodInput,
          donorHla: { a: aList, b: bList, dr: drList },
          preservationMethod: preservationMethodInput,
          crossClampTimestamp: new Date().toISOString(),
          transitEtaMinutes: parseInt(etaMinutesInput, 10)
        })
      });

      if (res.ok) {
        const data = await res.json();
        setRecentXmResult(data.crossmatch);
        fetchData();
      } else {
        const err = await res.json();
        alert(`Crossmatch failed: ${err.error || 'Server error'}`);
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    }
  };

  const handleCalcMeld = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/clinician/transplant/calc/meld-na', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          creatinine: parseFloat(calcCr),
          bilirubin: parseFloat(calcBili),
          inr: parseFloat(calcInr),
          sodium: parseFloat(calcNa),
          onDialysisTwicePastWeek: calcDialysis
        })
      });

      if (res.ok) {
        setCalculatedMeld(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async (caseId: number, status: string) => {
    try {
      const res = await fetch(`/api/clinician/transplant/cases/${caseId}/status`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', color: '#f8fafc' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Heart style={{ color: '#ec4899', width: '28px', height: '28px' }} />
            <h2 style={{ fontSize: '22px', fontWeight: 'bold', margin: 0, color: '#f8fafc' }}>
              Solid Organ Transplant &amp; Virtual Crossmatch Hub
            </h2>
          </div>
          <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '13px' }}>
            UNOS match logistics, MELD-Na / KDPI scoring, HLA DSA flow-cytometry predictions &amp; Cold Ischemia Time monitoring
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
            onClick={() => setShowNewCaseModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#db2777',
              color: '#ffffff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600
            }}
          >
            <Plus size={16} /> List Transplant Candidate
          </button>
        </div>
      </div>

      {/* Analytics KPI Bar */}
      {analytics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>ACTIVE LISTED</span>
              <Activity size={18} style={{ color: '#38bdf8' }} />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '6px', color: '#f8fafc' }}>
              {analytics.activeListedCount}
            </div>
            <div style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>
              Awaiting matching offer
            </div>
          </div>

          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>ORGANS IN TRANSIT</span>
              <Truck size={18} style={{ color: '#f59e0b' }} />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '6px', color: '#f59e0b' }}>
              {analytics.inTransitCount}
            </div>
            <div style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>
              CIT timers actively running
            </div>
          </div>

          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>IN OPERATING ROOM</span>
              <Stethoscope size={18} style={{ color: '#ec4899' }} />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '6px', color: '#ec4899' }}>
              {analytics.inOrCount}
            </div>
            <div style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>
              Reperfusion &amp; anastomosis
            </div>
          </div>

          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>VIRTUAL XM COMPATIBILITY</span>
              <ShieldCheck size={18} style={{ color: '#10b981' }} />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '6px', color: '#10b981' }}>
              {analytics.compatibleRate}
            </div>
            <div style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>
              {analytics.totalCrossmatches} evaluated total
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #334155', marginBottom: '16px', gap: '8px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('pipeline')}
          style={{
            background: 'none',
            border: 'none',
            padding: '10px 18px',
            color: activeTab === 'pipeline' ? '#ec4899' : '#94a3b8',
            borderBottom: activeTab === 'pipeline' ? '2px solid #ec4899' : 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px'
          }}
        >
          Transplant Candidates &amp; Matches ({cases.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('calculator')}
          style={{
            background: 'none',
            border: 'none',
            padding: '10px 18px',
            color: activeTab === 'calculator' ? '#ec4899' : '#94a3b8',
            borderBottom: activeTab === 'calculator' ? '2px solid #ec4899' : 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px'
          }}
        >
          MELD-Na &amp; Organ Scoring Calculator
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Loading transplant cases...</div>
      ) : activeTab === 'pipeline' ? (
        /* Candidates Table */
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155', backgroundColor: '#1e293b', color: '#94a3b8' }}>
                <th style={{ padding: '12px 16px' }}>Organ / Patient</th>
                <th style={{ padding: '12px 16px' }}>Blood / cPRA</th>
                <th style={{ padding: '12px 16px' }}>Donor / UNOS ID</th>
                <th style={{ padding: '12px 16px' }}>Cold Ischemia Time (CIT)</th>
                <th style={{ padding: '12px 16px' }}>Preservation</th>
                <th style={{ padding: '12px 16px' }}>Listing Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {cases.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                    No transplant cases listed. Click "List Transplant Candidate" to initiate.
                  </td>
                </tr>
              ) : (
                cases.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #1e293b', color: '#e2e8f0' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ textTransform: 'uppercase', color: '#ec4899', fontSize: '11px', border: '1px solid #ec4899', padding: '1px 6px', borderRadius: '4px' }}>
                          {c.organ_type}
                        </span>
                        <span>{c.patient_name || `Patient #${c.patient_id}`}</span>
                      </div>
                      <div style={{ color: '#64748b', fontSize: '11px' }}>Case #{c.id} • Surgeon: {c.assigned_surgeon}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600 }}>{c.recipient_blood_group}</div>
                      <div style={{ color: '#94a3b8', fontSize: '11px' }}>
                        cPRA: {c.cpra_percentage}% {c.meld_na_score ? `• MELD-Na: ${c.meld_na_score}` : ''}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {c.donor_unos_id ? (
                        <div>
                          <div style={{ fontWeight: 600, color: '#38bdf8' }}>{c.donor_unos_id}</div>
                          <div style={{ color: '#94a3b8', fontSize: '11px' }}>Blood: {c.donor_blood_group || 'O'}</div>
                        </div>
                      ) : (
                        <span style={{ color: '#64748b', fontStyle: 'italic' }}>Pending offer</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {c.cross_clamp_timestamp ? (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: c.citRiskStatus === 'critical_risk' ? '#ef4444' : c.citRiskStatus === 'caution_approaching_limit' ? '#f59e0b' : '#10b981', fontWeight: 600 }}>
                            <Clock size={13} />
                            <span>{c.elapsedCitHours}h / {c.max_acceptable_cit_hours}h</span>
                          </div>
                          <div style={{ color: '#64748b', fontSize: '11px' }}>
                            {c.citRiskStatus === 'optimal' ? 'Optimal Tissue Viability' : c.citRiskStatus}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: '#64748b' }}>N/A (Pre-clamp)</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '12px' }}>
                      {c.preservation_method.replace(/_/g, ' ')}
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
                            c.listing_status === 'in_operating_room'
                              ? 'rgba(236, 72, 153, 0.2)'
                              : c.listing_status === 'in_transit'
                              ? 'rgba(245, 158, 11, 0.2)'
                              : c.listing_status === 'transplanted'
                              ? 'rgba(34, 197, 94, 0.2)'
                              : 'rgba(56, 189, 248, 0.2)',
                          color:
                            c.listing_status === 'in_operating_room'
                              ? '#f472b6'
                              : c.listing_status === 'in_transit'
                              ? '#fcd34d'
                              : c.listing_status === 'transplanted'
                              ? '#4ade80'
                              : '#38bdf8'
                        }}
                      >
                        {c.listing_status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCaseForXm(c);
                            setRecentXmResult(null);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: '#0284c7',
                            color: '#ffffff',
                            border: 'none',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            cursor: 'pointer'
                          }}
                        >
                          <Navigation size={11} /> Match &amp; XM
                        </button>
                        {c.listing_status === 'in_transit' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(c.id, 'in_operating_room')}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              backgroundColor: '#db2777',
                              color: '#ffffff',
                              border: 'none',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              cursor: 'pointer'
                            }}
                          >
                            To OR
                          </button>
                        )}
                        {c.listing_status === 'in_operating_room' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(c.id, 'transplanted')}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              backgroundColor: '#10b981',
                              color: '#ffffff',
                              border: 'none',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              cursor: 'pointer'
                            }}
                          >
                            Reperfused
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* MELD-Na Calculator Tab */
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '24px', maxWidth: '700px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileCheck size={20} style={{ color: '#ec4899' }} /> OPTN MELD-Na Scoring Calculator
          </h3>
          <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '20px' }}>
            Calculates standard Model for End-Stage Liver Disease (MELD-Na) incorporating serum sodium kinetics:
            MELD(i) = 9.57*ln(Cr) + 3.78*ln(Bili) + 11.2*ln(INR) + 6.43
          </p>

          <form onSubmit={handleCalcMeld}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Serum Creatinine (mg/dL)</label>
                <input
                  type="number"
                  step="0.1"
                  value={calcCr}
                  onChange={(e) => setCalcCr(e.target.value)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Total Bilirubin (mg/dL)</label>
                <input
                  type="number"
                  step="0.1"
                  value={calcBili}
                  onChange={(e) => setCalcBili(e.target.value)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>INR (Prothrombin Time)</label>
                <input
                  type="number"
                  step="0.1"
                  value={calcInr}
                  onChange={(e) => setCalcInr(e.target.value)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Serum Sodium (mEq/L)</label>
                <input
                  type="number"
                  value={calcNa}
                  onChange={(e) => setCalcNa(e.target.value)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#e2e8f0', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={calcDialysis}
                  onChange={(e) => setCalcDialysis(e.target.checked)}
                />
                Dialysis twice in past 7 days (caps Cr at 4.0 mg/dL)
              </label>
            </div>

            <button
              type="submit"
              style={{ backgroundColor: '#db2777', color: '#ffffff', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              Calculate MELD-Na
            </button>
          </form>

          {calculatedMeld && (
            <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>MELD INITIAL</div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#38bdf8' }}>{calculatedMeld.meldInitial}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>MELD-Na SCORE</div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ec4899' }}>{calculatedMeld.meldNa}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: List Candidate */}
      {showNewCaseModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '24px', width: '560px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#f8fafc' }}>List Solid Organ Candidate</h3>
              <button type="button" onClick={() => setShowNewCaseModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateCase}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Patient ID</label>
                <input
                  type="number"
                  value={newPatientId}
                  onChange={(e) => setNewPatientId(e.target.value)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Organ Type</label>
                  <select
                    value={newOrganType}
                    onChange={(e: any) => setNewOrganType(e.target.value)}
                    style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                  >
                    <option value="kidney">Kidney</option>
                    <option value="liver">Liver</option>
                    <option value="heart">Heart</option>
                    <option value="lung">Lung</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Blood Group (ABO)</label>
                  <select
                    value={newBloodGroup}
                    onChange={(e) => setNewBloodGroup(e.target.value)}
                    style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                  >
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Calculated PRA (cPRA %)</label>
                  <input
                    type="number"
                    value={newCpra}
                    onChange={(e) => setNewCpra(e.target.value)}
                    style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Lead Transplant Surgeon</label>
                  <input
                    type="text"
                    value={newSurgeon}
                    onChange={(e) => setNewSurgeon(e.target.value)}
                    style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Unacceptable HLA Antigens (Comma separated)</label>
                <input
                  type="text"
                  value={newUnacceptables}
                  onChange={(e) => setNewUnacceptables(e.target.value)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowNewCaseModal(false)}
                  style={{ backgroundColor: '#1e293b', color: '#94a3b8', border: '1px solid #334155', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: '#db2777', color: '#ffffff', border: 'none', padding: '8px 18px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  List Candidate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Virtual Crossmatch Engine */}
      {selectedCaseForXm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '24px', width: '650px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#f8fafc' }}>Virtual Flow Crossmatch Simulator</h3>
                <span style={{ color: '#ec4899', fontSize: '12px', fontWeight: 600 }}>Candidate #{selectedCaseForXm.id} • {selectedCaseForXm.patient_name || `Patient #${selectedCaseForXm.patient_id}`} ({selectedCaseForXm.organ_type.toUpperCase()})</span>
              </div>
              <button type="button" onClick={() => setSelectedCaseForXm(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRunCrossmatch}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Donor UNOS ID</label>
                  <input
                    type="text"
                    value={donorUnosIdInput}
                    onChange={(e) => setDonorUnosIdInput(e.target.value)}
                    style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Donor Blood Group</label>
                  <input
                    type="text"
                    value={donorBloodInput}
                    onChange={(e) => setDonorBloodInput(e.target.value)}
                    style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Donor HLA-A Alleles</label>
                <input
                  type="text"
                  value={donorAlleleA}
                  onChange={(e) => setDonorAlleleA(e.target.value)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                  required
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Donor HLA-B Alleles</label>
                <input
                  type="text"
                  value={donorAlleleB}
                  onChange={(e) => setDonorAlleleB(e.target.value)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                  required
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Donor HLA-DR Alleles</label>
                <input
                  type="text"
                  value={donorAlleleDr}
                  onChange={(e) => setDonorAlleleDr(e.target.value)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Preservation Method</label>
                  <select
                    value={preservationMethodInput}
                    onChange={(e: any) => setPreservationMethodInput(e.target.value)}
                    style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                  >
                    <option value="static_cold_storage">Static Cold Storage (SCS)</option>
                    <option value="hypothermic_machine_perfusion">Hypothermic Machine Perfusion (HMP)</option>
                    <option value="normothermic_regional_perfusion">Normothermic Regional Perfusion (NRP)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Transit Courier ETA (Minutes)</label>
                  <input
                    type="number"
                    value={etaMinutesInput}
                    onChange={(e) => setEtaMinutesInput(e.target.value)}
                    style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedCaseForXm(null)}
                  style={{ backgroundColor: '#1e293b', color: '#94a3b8', border: '1px solid #334155', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Close
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: '#0284c7', color: '#ffffff', border: 'none', padding: '8px 18px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Execute Virtual Crossmatch
                </button>
              </div>
            </form>

            {/* Results display */}
            {recentXmResult && (
              <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  {recentXmResult.crossmatch_prediction === 'negative_compatible' ? (
                    <CheckCircle2 style={{ color: '#10b981' }} size={20} />
                  ) : recentXmResult.crossmatch_prediction === 'low_positive_permissible' ? (
                    <AlertTriangle style={{ color: '#f59e0b' }} size={20} />
                  ) : (
                    <XCircle style={{ color: '#ef4444' }} size={20} />
                  )}
                  <h4 style={{ margin: 0, fontSize: '15px', color: '#f8fafc' }}>
                    Prediction: {recentXmResult.crossmatch_prediction.replace(/_/g, ' ').toUpperCase()}
                  </h4>
                </div>

                <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '10px' }}>
                  Peak MFI: <strong style={{ color: '#f8fafc' }}>{recentXmResult.peak_mfi}</strong> • Rejection Risk: <strong style={{ color: '#f8fafc' }}>{recentXmResult.rejection_risk_level.toUpperCase()}</strong> • Desensitization: {recentXmResult.desensitization_required ? 'REQUIRED' : 'Standard'}
                </div>

                <div style={{ fontSize: '12px', color: '#e2e8f0', backgroundColor: '#0f172a', padding: '10px', borderRadius: '6px', border: '1px solid #334155' }}>
                  <div style={{ fontWeight: 600, color: '#38bdf8', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Sparkles size={12} /> Recommended Induction &amp; Immunosuppression:
                  </div>
                  {recentXmResult.recommended_induction_protocol}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganMatchHub;
