import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle2, AlertTriangle, Clock, RefreshCw, Heart, Activity } from 'lucide-react';

export interface FollowUpItem {
  id: number;
  sessionId: string;
  patientId: number;
  scheduledAt: string;
  intervalDays: number;
  surveyType: 'symptom_resolution' | 'medication_adherence' | 'wound_check' | 'cardiac_vital_check' | 'satisfaction';
  status: 'pending' | 'sent' | 'responded' | 'overdue' | 'escalated';
  patientResponse?: {
    severityChange: 'much_better' | 'slightly_better' | 'unchanged' | 'worse' | 'much_worse';
    symptomsResolved: boolean;
    takingMedsAsPrescribed: boolean;
    adverseEffectsReported?: string;
    notes?: string;
  };
  clinicianNotes?: string;
  createdAt: string;
  patientName?: string;
}

interface FollowUpTrackerProps {
  token?: string;
  backendUrl?: string;
  currentSessionId?: string;
}

export const FollowUpTracker: React.FC<FollowUpTrackerProps> = ({
  token,
  backendUrl = '',
  currentSessionId
}) => {
  const [followups, setFollowups] = useState<FollowUpItem[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [isSimulatingResponse, setIsSimulatingResponse] = useState<number | null>(null);

  useEffect(() => {
    loadFollowups();
  }, [filterStatus]);

  const loadFollowups = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const url = `${backendUrl}/api/clinician/followups/all${filterStatus !== 'all' ? `?status=${filterStatus}` : ''}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFollowups(data);
      }
    } catch (err) {
      console.error('Failed to load follow-ups:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleScheduleProtocol = async (protocolType: 'standard_48h' | 'cardiac_intensive' | 'surgical_wound') => {
    if (!currentSessionId || !token) {
      alert('Please select an active session in the workspace first, or use an existing encounter.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/clinician/sessions/${currentSessionId}/followups/protocol`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ protocolType })
      });
      if (res.ok) {
        await loadFollowups();
        alert(`Successfully scheduled ${protocolType} follow-up protocol!`);
      }
    } catch (err) {
      console.error('Failed to schedule protocol:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSimulateResponse = async (followupId: number, isDeteriorating: boolean) => {
    setIsSimulatingResponse(followupId);
    try {
      const payload = isDeteriorating ? {
        severityChange: 'much_worse',
        symptomsResolved: false,
        takingMedsAsPrescribed: false,
        adverseEffectsReported: 'Severe palpitations and orthostatic dizziness',
        notes: 'Pain worsening significantly since morning.'
      } : {
        severityChange: 'much_better',
        symptomsResolved: true,
        takingMedsAsPrescribed: true,
        notes: 'Feeling great, resting well and taking medications without issues.'
      };

      const res = await fetch(`${backendUrl}/api/clinician/followups/${followupId}/respond`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        await loadFollowups();
      }
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setIsSimulatingResponse(null);
    }
  };

  const getStatusBadge = (status: FollowUpItem['status']) => {
    switch (status) {
      case 'escalated':
        return (
          <span style={{
            fontSize: '11px',
            padding: '3px 8px',
            borderRadius: '12px',
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            color: '#ef4444',
            border: '1px solid #ef4444',
            fontWeight: 'bold',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <AlertTriangle size={12} /> Deterioration Escalated
          </span>
        );
      case 'responded':
        return (
          <span style={{
            fontSize: '11px',
            padding: '3px 8px',
            borderRadius: '12px',
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
            color: '#10b981',
            border: '1px solid #10b981',
            fontWeight: 'bold',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <CheckCircle2 size={12} /> Responded
          </span>
        );
      case 'overdue':
        return (
          <span style={{
            fontSize: '11px',
            padding: '3px 8px',
            borderRadius: '12px',
            backgroundColor: 'rgba(245, 158, 11, 0.2)',
            color: '#f59e0b',
            border: '1px solid #f59e0b',
            fontWeight: 'bold',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <Clock size={12} /> Overdue
          </span>
        );
      default:
        return (
          <span style={{
            fontSize: '11px',
            padding: '3px 8px',
            borderRadius: '12px',
            backgroundColor: 'rgba(148, 163, 184, 0.15)',
            color: '#94a3b8',
            border: '1px solid #94a3b8',
            fontWeight: 'bold',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <Clock size={12} /> Pending Check-In
          </span>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner & Fast Protocol Schedulers */}
      <div style={{
        padding: '18px 22px',
        borderRadius: '12px',
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.7), rgba(30, 27, 75, 0.6))',
        border: '1px solid var(--glass-border)',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '14px'
      }}>
        <div>
          <h4 style={{ margin: 0, color: 'white', fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={20} color="#a855f7" />
            Automated Post-Visit Follow-Up & Remote Patient Monitoring
          </h4>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '12px' }}>
            Proactive clinical check-ins (Day 1, 3, 7, 14) with real-time deterioration detection and triage escalation.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => handleScheduleProtocol('cardiac_intensive')}
            disabled={isLoading}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Heart size={14} /> + Cardiac Intensive (Day 1, 3, 14)
          </button>

          <button
            type="button"
            onClick={() => handleScheduleProtocol('standard_48h')}
            disabled={isLoading}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              color: '#93c5fd',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Activity size={14} /> + Standard 48h (Day 2, 7)
          </button>

          <button
            type="button"
            onClick={() => handleScheduleProtocol('surgical_wound')}
            disabled={isLoading}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#6ee7b7',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            🩹 + Post-Op Wound (Day 3, 7, 14)
          </button>
        </div>
      </div>

      {/* Filter Tabs Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 14px',
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderRadius: '8px',
        border: '1px solid var(--glass-border)'
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['all', 'pending', 'responded', 'escalated'].map(st => (
            <button
              key={st}
              type="button"
              onClick={() => setFilterStatus(st)}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: filterStatus === st ? '#7c3aed' : 'transparent',
                color: filterStatus === st ? 'white' : 'var(--text-muted)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {st.toUpperCase()}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={loadFollowups}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px'
          }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Follow-Up Records Table / Cards */}
      <div style={{
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        border: '1px solid var(--glass-border)',
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        {followups.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Calendar size={36} color="#64748b" style={{ margin: '0 auto 12px' }} />
            <p style={{ margin: 0, fontSize: '14px' }}>No follow-up check-ins match the active filter.</p>
            <p style={{ margin: '4px 0 0', fontSize: '12px' }}>
              Select a clinical protocol above to schedule check-ins for the active patient encounter.
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 16px' }}>Patient & Encounter</th>
                <th style={{ padding: '12px 16px' }}>Interval</th>
                <th style={{ padding: '12px 16px' }}>Check-In Survey</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px' }}>Patient Response & Notes</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {followups.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontWeight: 600, color: 'white' }}>{item.patientName || 'Encounter Patient'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ID: {item.sessionId.slice(0, 8)}</div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      fontSize: '11px',
                      fontWeight: 600
                    }}>
                      Day {item.intervalDays}
                    </span>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {new Date(item.scheduledAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ textTransform: 'capitalize', color: '#e2e8f0', fontWeight: 500 }}>
                      {item.surveyType.replace(/_/g, ' ')}
                    </div>
                    {item.clinicianNotes && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.clinicianNotes}</div>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {getStatusBadge(item.status)}
                  </td>
                  <td style={{ padding: '14px 16px', maxWidth: '300px' }}>
                    {item.patientResponse ? (
                      <div style={{
                        padding: '8px 10px',
                        borderRadius: '6px',
                        backgroundColor: item.status === 'escalated' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${item.status === 'escalated' ? 'rgba(239, 68, 68, 0.3)' : 'var(--glass-border)'}`,
                        fontSize: '12px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                          <span style={{ color: item.status === 'escalated' ? '#f87171' : '#34d399', fontWeight: 600 }}>
                            Trend: {item.patientResponse.severityChange.replace(/_/g, ' ')}
                          </span>
                          <span style={{ color: item.patientResponse.takingMedsAsPrescribed ? '#10b981' : '#ef4444' }}>
                            {item.patientResponse.takingMedsAsPrescribed ? '● Meds OK' : '● Non-adherent'}
                          </span>
                        </div>
                        {item.patientResponse.notes && (
                          <div style={{ color: '#cbd5e1', fontSize: '11px', fontStyle: 'italic' }}>
                            "{item.patientResponse.notes}"
                          </div>
                        )}
                        {item.patientResponse.adverseEffectsReported && (
                          <div style={{ color: '#f87171', fontSize: '11px', marginTop: '2px', fontWeight: 500 }}>
                            ⚠️ Adverse: {item.patientResponse.adverseEffectsReported}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Awaiting patient submission</span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    {item.status === 'pending' && (
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => handleSimulateResponse(item.id, false)}
                          disabled={isSimulatingResponse === item.id}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(16, 185, 129, 0.2)',
                            border: '1px solid #10b981',
                            color: '#10b981',
                            fontSize: '11px',
                            cursor: 'pointer'
                          }}
                          title="Simulate patient reporting improvement"
                        >
                          Simulate Recovery
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSimulateResponse(item.id, true)}
                          disabled={isSimulatingResponse === item.id}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(239, 68, 68, 0.2)',
                            border: '1px solid #ef4444',
                            color: '#ef4444',
                            fontSize: '11px',
                            cursor: 'pointer'
                          }}
                          title="Simulate patient reporting deterioration"
                        >
                          Simulate Worsening
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default FollowUpTracker;
