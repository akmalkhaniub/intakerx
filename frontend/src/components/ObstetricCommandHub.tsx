import React, { useState, useEffect } from 'react';
import {
  Baby,
  AlertTriangle,
  RefreshCw,
  Plus,
  ShieldCheck,
  CheckCircle,
  X,
  HeartPulse,
  Syringe,
  Droplet
} from 'lucide-react';

interface FetalMonitoringLog {
  id: number;
  patient_id: number;
  patient_name?: string;
  gestational_age_weeks: number;
  fhr_baseline_bpm: number;
  variability: 'absent' | 'minimal' | 'moderate' | 'marked';
  accelerations_present: boolean;
  decelerations_type: 'none' | 'early' | 'variable' | 'late_recurrent' | 'prolonged' | 'sinusoidal';
  uterine_contractions_per_10min: number;
  tachysystole: boolean;
  nichd_tier: 'Tier_I' | 'Tier_II' | 'Tier_III';
  interventions_performed: string[];
  logged_by: string;
  created_at: string;
}

interface ObstetricEmergency {
  id: number;
  patient_id: number;
  patient_name?: string;
  emergency_type: string;
  severity_stage: string;
  quantitative_blood_loss_ml: number;
  mewc_triggers: string[];
  current_vitals: {
    sbp?: number;
    dbp?: number;
    hr?: number;
    rr?: number;
    spo2?: number;
    urineOutputMlHr?: number;
  };
  active_medications_administered: Array<{
    name: string;
    dose: string;
    route: string;
    timestamp: string;
  }>;
  magnesium_infusion_active: boolean;
  magnesium_rate_g_hr: number;
  protocol_checklist: Array<{
    step: string;
    completed: boolean;
  }>;
  emergency_status: string;
  lead_obstetrician: string;
  declared_at: string;
  resolved_at?: string;
}

interface ObAnalytics {
  activeEmergenciesCount: number;
  tier3FetalTracingsCount: number;
  activeMagnesiumInfusions: number;
  pphIncidentsToday: number;
  meanQblHemorrhageMl: number;
}

export const ObstetricCommandHub: React.FC = () => {
  const [fetalLogs, setFetalLogs] = useState<FetalMonitoringLog[]>([]);
  const [emergencies, setEmergencies] = useState<ObstetricEmergency[]>([]);
  const [analytics, setAnalytics] = useState<ObAnalytics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'fetal_monitoring' | 'emergencies'>('fetal_monitoring');

  // New FHR Log Modal
  const [showFhrModal, setShowFhrModal] = useState<boolean>(false);
  const [patientIdInput, setPatientIdInput] = useState<string>('84');
  const [gestationalAgeInput, setGestationalAgeInput] = useState<string>('39.4');
  const [fhrBaselineInput, setFhrBaselineInput] = useState<string>('140');
  const [variabilityInput, setVariabilityInput] = useState<'absent' | 'minimal' | 'moderate' | 'marked'>('moderate');
  const [accelerationsInput, setAccelerationsInput] = useState<boolean>(true);
  const [decelerationsInput, setDecelerationsInput] = useState<'none' | 'early' | 'variable' | 'late_recurrent' | 'prolonged' | 'sinusoidal'>('none');
  const [contractionsInput, setContractionsInput] = useState<string>('3');

  // Declare Emergency Modal
  const [showEmergencyModal, setShowEmergencyModal] = useState<boolean>(false);
  const [emergencyTypeInput, setEmergencyTypeInput] = useState<string>('postpartum_hemorrhage');
  const [qblInput, setQblInput] = useState<string>('750');
  const [sbpInput, setSbpInput] = useState<string>('165');
  const [dbpInput, setDbpInput] = useState<string>('112');
  const [hrInput, setHrInput] = useState<string>('122');
  const [leadObInput, setLeadObInput] = useState<string>('Dr. Katherine Bell, MD');

  // Medication Modal
  const [selectedEmergencyForMed, setSelectedEmergencyForMed] = useState<ObstetricEmergency | null>(null);
  const [medNameInput, setMedNameInput] = useState<string>('Oxytocin (Pitocin)');
  const [medDoseInput, setMedDoseInput] = useState<string>('30 units in 500mL LR');
  const [medRouteInput, setMedRouteInput] = useState<string>('IV infusion wide open');

  const token = localStorage.getItem('token') || '';

  const fetchData = async () => {
    setLoading(true);
    try {
      const [fhrRes, emRes, aRes] = await Promise.all([
        fetch('/api/clinician/obstetric/fetal-logs?limit=50', { credentials: 'include', headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/clinician/obstetric/emergencies', { credentials: 'include', headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/clinician/obstetric/analytics', { credentials: 'include', headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (fhrRes.ok) setFetalLogs(await fhrRes.json());
      if (emRes.ok) setEmergencies(await emRes.json());
      if (aRes.ok) setAnalytics(await aRes.json());
    } catch (err) {
      console.error('Failed to load obstetric data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRecordFhr = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/clinician/obstetric/fetal-logs', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId: parseInt(patientIdInput, 10),
          gestationalAgeWeeks: parseFloat(gestationalAgeInput),
          fhrBaselineBpm: parseInt(fhrBaselineInput, 10),
          variability: variabilityInput,
          accelerationsPresent: accelerationsInput,
          decelerationsType: decelerationsInput,
          uterineContractionsPer10min: parseInt(contractionsInput, 10),
          loggedBy: 'L&D Staff Nurse'
        })
      });

      if (res.ok) {
        setShowFhrModal(false);
        fetchData();
      } else {
        const err = await res.json();
        alert(`Recording failed: ${err.error || 'Server error'}`);
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    }
  };

  const handleDeclareEmergency = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/clinician/obstetric/emergencies/declare', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId: parseInt(patientIdInput, 10),
          emergencyType: emergencyTypeInput,
          quantitativeBloodLossMl: parseInt(qblInput, 10),
          currentVitals: {
            sbp: sbpInput ? parseInt(sbpInput, 10) : undefined,
            dbp: dbpInput ? parseInt(dbpInput, 10) : undefined,
            hr: hrInput ? parseInt(hrInput, 10) : undefined
          },
          leadObstetrician: leadObInput
        })
      });

      if (res.ok) {
        setShowEmergencyModal(false);
        setActiveTab('emergencies');
        fetchData();
      } else {
        const err = await res.json();
        alert(`Declaration failed: ${err.error || 'Server error'}`);
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    }
  };

  const handleAdministerMed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmergencyForMed) return;

    try {
      const res = await fetch(`/api/clinician/obstetric/emergencies/${selectedEmergencyForMed.id}/medications`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          medicationName: medNameInput,
          dose: medDoseInput,
          route: medRouteInput
        })
      });

      if (res.ok) {
        setSelectedEmergencyForMed(null);
        fetchData();
      } else {
        const err = await res.json();
        alert(`Medication administration failed: ${err.error || 'Server error'}`);
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    }
  };

  const handleResolveEmergency = async (emergencyId: number, status: string) => {
    try {
      const res = await fetch(`/api/clinician/obstetric/emergencies/${emergencyId}/resolve`, {
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
            <Baby style={{ color: '#f43f5e', width: '28px', height: '28px' }} />
            <h2 style={{ fontSize: '22px', fontWeight: 'bold', margin: 0, color: '#f8fafc' }}>
              Labor &amp; Delivery / Obstetric Emergency Command (OB-SAFE)
            </h2>
          </div>
          <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '13px' }}>
            NICHD 3-Tier Fetal Monitoring, MEWC maternal surveillance, QBL Stage 1-3 PPH &amp; Preeclampsia emergency response
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
            onClick={() => setShowFhrModal(true)}
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
            <Plus size={16} /> Log Fetal Heart Tracing
          </button>
          <button
            type="button"
            onClick={() => setShowEmergencyModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#e11d48',
              color: '#ffffff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600
            }}
          >
            <AlertTriangle size={16} /> Declare OB Emergency
          </button>
        </div>
      </div>

      {/* Analytics KPI Bar */}
      {analytics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>ACTIVE OB EMERGENCIES</span>
              <AlertTriangle size={18} style={{ color: analytics.activeEmergenciesCount > 0 ? '#ef4444' : '#10b981' }} />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '6px', color: analytics.activeEmergenciesCount > 0 ? '#ef4444' : '#f8fafc' }}>
              {analytics.activeEmergenciesCount}
            </div>
            <div style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>
              Rapid response mobilized
            </div>
          </div>

          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>TIER III ABNORMAL FETAL TRACINGS</span>
              <HeartPulse size={18} style={{ color: '#f43f5e' }} />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '6px', color: '#f43f5e' }}>
              {analytics.tier3FetalTracingsCount}
            </div>
            <div style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>
              STAT C-Section / Resuscitation alert
            </div>
          </div>

          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>MAGNESIUM INFUSIONS ACTIVE</span>
              <Syringe size={18} style={{ color: '#38bdf8' }} />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '6px', color: '#38bdf8' }}>
              {analytics.activeMagnesiumInfusions}
            </div>
            <div style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>
              Preeclampsia seizure prophylaxis
            </div>
          </div>

          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>PPH CASES &amp; MEAN QBL</span>
              <Droplet size={18} style={{ color: '#fb7185' }} />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '6px', color: '#fb7185' }}>
              {analytics.pphIncidentsToday} <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#94a3b8' }}>({analytics.meanQblHemorrhageMl} mL avg)</span>
            </div>
            <div style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>
              Quantitative Blood Loss surveillance
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #334155', marginBottom: '16px', gap: '8px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('fetal_monitoring')}
          style={{
            background: 'none',
            border: 'none',
            padding: '10px 18px',
            color: activeTab === 'fetal_monitoring' ? '#f43f5e' : '#94a3b8',
            borderBottom: activeTab === 'fetal_monitoring' ? '2px solid #f43f5e' : 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px'
          }}
        >
          Electronic Fetal Monitoring (EFM) Tracings ({fetalLogs.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('emergencies')}
          style={{
            background: 'none',
            border: 'none',
            padding: '10px 18px',
            color: activeTab === 'emergencies' ? '#f43f5e' : '#94a3b8',
            borderBottom: activeTab === 'emergencies' ? '2px solid #f43f5e' : 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px'
          }}
        >
          Active Obstetric Emergencies ({emergencies.length})
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Loading obstetric records...</div>
      ) : activeTab === 'fetal_monitoring' ? (
        /* Fetal Tracings Table */
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155', backgroundColor: '#1e293b', color: '#94a3b8' }}>
                <th style={{ padding: '12px 16px' }}>Patient / Gestational Age</th>
                <th style={{ padding: '12px 16px' }}>NICHD Tier</th>
                <th style={{ padding: '12px 16px' }}>Baseline FHR</th>
                <th style={{ padding: '12px 16px' }}>Variability</th>
                <th style={{ padding: '12px 16px' }}>Decelerations</th>
                <th style={{ padding: '12px 16px' }}>Contractions / 10m</th>
                <th style={{ padding: '12px 16px' }}>Tachysystole</th>
                <th style={{ padding: '12px 16px' }}>Interventions</th>
              </tr>
            </thead>
            <tbody>
              {fetalLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                    No fetal monitoring logs recorded. Click "Log Fetal Heart Tracing" above.
                  </td>
                </tr>
              ) : (
                fetalLogs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #1e293b', color: '#e2e8f0' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#f8fafc' }}>{log.patient_name || `Patient #${log.patient_id}`}</div>
                      <div style={{ color: '#64748b', fontSize: '11px' }}>{log.gestational_age_weeks} weeks • {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
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
                            log.nichd_tier === 'Tier_III'
                              ? 'rgba(239, 68, 68, 0.2)'
                              : log.nichd_tier === 'Tier_II'
                              ? 'rgba(245, 158, 11, 0.2)'
                              : 'rgba(34, 197, 94, 0.2)',
                          color:
                            log.nichd_tier === 'Tier_III'
                              ? '#f87171'
                              : log.nichd_tier === 'Tier_II'
                              ? '#fcd34d'
                              : '#4ade80'
                        }}
                      >
                        {log.nichd_tier.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: log.fhr_baseline_bpm < 110 || log.fhr_baseline_bpm > 160 ? '#ef4444' : '#f8fafc' }}>
                      {log.fhr_baseline_bpm} bpm
                    </td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8' }}>
                      {log.variability}
                    </td>
                    <td style={{ padding: '12px 16px', color: log.decelerations_type !== 'none' && log.decelerations_type !== 'early' ? '#f59e0b' : '#94a3b8' }}>
                      {log.decelerations_type.replace('_', ' ')}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8' }}>
                      {log.uterine_contractions_per_10min}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {log.tachysystole ? (
                        <span style={{ color: '#ef4444', fontWeight: 600, fontSize: '11px' }}>⚠️ TACHYSYSTOLE</span>
                      ) : (
                        <span style={{ color: '#10b981', fontSize: '11px' }}>Normal</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', maxWidth: '240px', color: '#cbd5e1', fontSize: '12px' }}>
                      {log.interventions_performed && log.interventions_performed.length > 0 ? (
                        log.interventions_performed.join(', ')
                      ) : (
                        <span style={{ color: '#64748b' }}>Routine care</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Active Emergencies Console */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {emergencies.length === 0 ? (
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '32px', textAlign: 'center', color: '#64748b' }}>
              No active obstetric emergencies declared. Unit is currently stable.
            </div>
          ) : (
            emergencies.map((em) => (
              <div key={em.id} style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '10px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ textTransform: 'uppercase', backgroundColor: '#e11d48', color: 'white', fontSize: '11px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '4px' }}>
                        {em.emergency_type.replace(/_/g, ' ')}
                      </span>
                      <h3 style={{ margin: 0, fontSize: '16px', color: '#f8fafc' }}>
                        {em.patient_name || `Patient #${em.patient_id}`}
                      </h3>
                      <span style={{ color: '#94a3b8', fontSize: '12px' }}>• Severity: <strong>{em.severity_stage.toUpperCase()}</strong></span>
                    </div>
                    <div style={{ color: '#64748b', fontSize: '11px', marginTop: '4px' }}>
                      Lead Obstetrician: {em.lead_obstetrician} • Declared at: {new Date(em.declared_at).toLocaleTimeString()}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEmergencyForMed(em);
                        if (em.emergency_type === 'postpartum_hemorrhage') {
                          setMedNameInput('Tranexamic Acid (TXA)');
                          setMedDoseInput('1g in 100mL NS');
                          setMedRouteInput('IV over 10 min');
                        } else {
                          setMedNameInput('Magnesium Sulfate');
                          setMedDoseInput('4g bolus then 2g/hr');
                          setMedRouteInput('IV infusion');
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        backgroundColor: '#0284c7',
                        color: 'white',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 600
                      }}
                    >
                      <Syringe size={13} /> Administer Medication
                    </button>
                    {em.emergency_status === 'active_emergency' && (
                      <button
                        type="button"
                        onClick={() => handleResolveEmergency(em.id, 'stabilized')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          backgroundColor: '#10b981',
                          color: 'white',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 600
                        }}
                      >
                        <CheckCircle size={13} /> Mark Stabilized
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', backgroundColor: '#1e293b', padding: '14px', borderRadius: '8px', marginBottom: '14px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>QUANTITATIVE BLOOD LOSS</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: em.quantitative_blood_loss_ml > 1000 ? '#ef4444' : '#f8fafc', marginTop: '2px' }}>
                      {em.quantitative_blood_loss_ml} mL
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>MAGNESIUM INFUSION STATUS</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: em.magnesium_infusion_active ? '#38bdf8' : '#94a3b8', marginTop: '4px' }}>
                      {em.magnesium_infusion_active ? `Active @ ${em.magnesium_rate_g_hr} g/hr` : 'Inactive'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>MEWC CRITERIA TRIGGERED</div>
                    <div style={{ fontSize: '12px', color: '#f59e0b', marginTop: '4px' }}>
                      {em.mewc_triggers && em.mewc_triggers.length > 0 ? em.mewc_triggers.join('; ') : 'None active'}
                    </div>
                  </div>
                </div>

                {/* Protocol Checklist */}
                <div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldCheck size={14} style={{ color: '#10b981' }} /> Evidence-Based Protocol Checklist:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '20px', color: '#e2e8f0', fontSize: '12px' }}>
                    {em.protocol_checklist.map((step, sIdx) => (
                      <li key={sIdx} style={{ marginBottom: '4px' }}>{step.step}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal: Log Fetal Tracing */}
      {showFhrModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '24px', width: '560px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#f8fafc' }}>Log Electronic Fetal Monitoring (EFM)</h3>
              <button type="button" onClick={() => setShowFhrModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRecordFhr}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Patient ID</label>
                  <input
                    type="number"
                    value={patientIdInput}
                    onChange={(e) => setPatientIdInput(e.target.value)}
                    style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Gestational Age (Weeks)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={gestationalAgeInput}
                    onChange={(e) => setGestationalAgeInput(e.target.value)}
                    style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Baseline FHR (bpm)</label>
                  <input
                    type="number"
                    value={fhrBaselineInput}
                    onChange={(e) => setFhrBaselineInput(e.target.value)}
                    style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>FHR Baseline Variability</label>
                  <select
                    value={variabilityInput}
                    onChange={(e: any) => setVariabilityInput(e.target.value)}
                    style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                  >
                    <option value="moderate">Moderate (6-25 bpm - Normal)</option>
                    <option value="minimal">Minimal (&lt;= 5 bpm)</option>
                    <option value="absent">Absent (Flatline - High Risk)</option>
                    <option value="marked">Marked (&gt; 25 bpm)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Decelerations Type</label>
                  <select
                    value={decelerationsInput}
                    onChange={(e: any) => setDecelerationsInput(e.target.value)}
                    style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                  >
                    <option value="none">None</option>
                    <option value="early">Early (Head compression - Benign)</option>
                    <option value="variable">Variable (Cord compression)</option>
                    <option value="late_recurrent">Late Recurrent (Uteroplacental insufficiency)</option>
                    <option value="prolonged">Prolonged (&gt;= 2 min, &lt; 10 min)</option>
                    <option value="sinusoidal">Sinusoidal (Fetal anemia/acidosis)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Contractions / 10 min</label>
                  <input
                    type="number"
                    value={contractionsInput}
                    onChange={(e) => setContractionsInput(e.target.value)}
                    style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#e2e8f0', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={accelerationsInput}
                    onChange={(e) => setAccelerationsInput(e.target.checked)}
                  />
                  Accelerations Present (&gt;= 15 bpm for &gt;= 15s)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowFhrModal(false)}
                  style={{ backgroundColor: '#1e293b', color: '#94a3b8', border: '1px solid #334155', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: '#0284c7', color: '#ffffff', border: 'none', padding: '8px 18px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Save Tracing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Declare Emergency */}
      {showEmergencyModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '24px', width: '560px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#f8fafc' }}>Declare Obstetric Emergency</h3>
              <button type="button" onClick={() => setShowEmergencyModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleDeclareEmergency}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Emergency Protocol Type</label>
                <select
                  value={emergencyTypeInput}
                  onChange={(e) => setEmergencyTypeInput(e.target.value)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                >
                  <option value="postpartum_hemorrhage">Postpartum Hemorrhage (PPH Stage 1-3)</option>
                  <option value="severe_preeclampsia_eclampsia">Severe Preeclampsia / Impending Eclampsia</option>
                  <option value="shoulder_dystocia">Shoulder Dystocia Protocol</option>
                  <option value="uterine_rupture">Suspected Uterine Rupture</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Quantitative Blood Loss (QBL mL)</label>
                  <input
                    type="number"
                    value={qblInput}
                    onChange={(e) => setQblInput(e.target.value)}
                    style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Lead Obstetrician</label>
                  <input
                    type="text"
                    value={leadObInput}
                    onChange={(e) => setLeadObInput(e.target.value)}
                    style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>SBP (mmHg)</label>
                  <input
                    type="number"
                    value={sbpInput}
                    onChange={(e) => setSbpInput(e.target.value)}
                    style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>DBP (mmHg)</label>
                  <input
                    type="number"
                    value={dbpInput}
                    onChange={(e) => setDbpInput(e.target.value)}
                    style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>HR (bpm)</label>
                  <input
                    type="number"
                    value={hrInput}
                    onChange={(e) => setHrInput(e.target.value)}
                    style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowEmergencyModal(false)}
                  style={{ backgroundColor: '#1e293b', color: '#94a3b8', border: '1px solid #334155', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: '#e11d48', color: '#ffffff', border: 'none', padding: '8px 18px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Activate Emergency Protocol
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Administer Medication */}
      {selectedEmergencyForMed && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '24px', width: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#f8fafc' }}>Administer Emergency Medication</h3>
              <button type="button" onClick={() => setSelectedEmergencyForMed(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAdministerMed}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Medication Name</label>
                <input
                  type="text"
                  value={medNameInput}
                  onChange={(e) => setMedNameInput(e.target.value)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                  required
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Dosage</label>
                <input
                  type="text"
                  value={medDoseInput}
                  onChange={(e) => setMedDoseInput(e.target.value)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                  required
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Administration Route</label>
                <input
                  type="text"
                  value={medRouteInput}
                  onChange={(e) => setMedRouteInput(e.target.value)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedEmergencyForMed(null)}
                  style={{ backgroundColor: '#1e293b', color: '#94a3b8', border: '1px solid #334155', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: '#0284c7', color: '#ffffff', border: 'none', padding: '8px 18px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Log Administration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ObstetricCommandHub;
