import React, { useState, useEffect } from 'react';
import { 
  Users, AlertTriangle, Clock, RefreshCw, 
  ArrowRight, HeartPulse, Activity
} from 'lucide-react';

export interface ESIAssessment {
  esiLevel: 1 | 2 | 3 | 4 | 5;
  levelName: 'Resuscitation' | 'Emergent' | 'Urgent' | 'Less Urgent' | 'Non-Urgent';
  priorityScore: number;
  rationale: string;
  recommendedMaxWaitMinutes: number;
  estimatedResourceCount: number;
  clinicalFlags: string[];
  vitalsWarning: boolean;
  requiresRapidIntervention: boolean;
}

export interface WaitingRoomPatient {
  sessionId: string;
  patientId: number;
  patientName: string;
  age: number;
  gender: string;
  checkInTime: string;
  waitDurationMinutes: number;
  esi: ESIAssessment;
  isBreached: boolean;
  lwbsRisk: 'low' | 'moderate' | 'high';
  assignedRoom?: string;
  chiefComplaint: string;
  vitalsSummary?: string;
}

interface WaitingRoomQueueManagerProps {
  token?: string;
  backendUrl?: string;
  onSelectSession?: (sessionId: string) => void;
}

export const WaitingRoomQueueManager: React.FC<WaitingRoomQueueManagerProps> = ({
  token,
  backendUrl = '',
  onSelectSession
}) => {
  const [queue, setQueue] = useState<WaitingRoomPatient[]>([]);
  const [stats, setStats] = useState({
    totalWaiting: 0,
    esi1Count: 0,
    esi2Count: 0,
    esi3Count: 0,
    esi4Count: 0,
    esi5Count: 0,
    breachedCount: 0,
    avgWaitMinutes: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'critical' | 'breaches' | 'fast_track'>('all');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [callingSessionId, setCallingSessionId] = useState<string | null>(null);

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 20000);
    return () => clearInterval(interval);
  }, []);

  const loadQueue = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/clinician/waiting-room`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setQueue(data.queue || []);
        setStats(data.stats || {
          totalWaiting: 0,
          esi1Count: 0,
          esi2Count: 0,
          esi3Count: 0,
          esi4Count: 0,
          esi5Count: 0,
          breachedCount: 0,
          avgWaitMinutes: 0
        });
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Failed to load waiting room queue:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCallToExamRoom = (patient: WaitingRoomPatient) => {
    setCallingSessionId(patient.sessionId);
    setTimeout(() => {
      setCallingSessionId(null);
      if (onSelectSession) {
        onSelectSession(patient.sessionId);
      }
    }, 800);
  };

  const filteredQueue = queue.filter(p => {
    if (filterMode === 'critical') return p.esi.esiLevel <= 2;
    if (filterMode === 'breaches') return p.isBreached;
    if (filterMode === 'fast_track') return p.esi.esiLevel >= 4;
    return true;
  });

  const getEsiBadgeStyle = (level: number) => {
    switch (level) {
      case 1:
        return {
          bg: '#ef4444',
          text: 'white',
          label: 'ESI 1: RESUSCITATION',
          border: '#b91c1c',
          glow: '0 0 12px rgba(239, 68, 68, 0.7)'
        };
      case 2:
        return {
          bg: '#f97316',
          text: 'white',
          label: 'ESI 2: EMERGENT',
          border: '#c2410c',
          glow: '0 0 8px rgba(249, 115, 22, 0.5)'
        };
      case 3:
        return {
          bg: '#eab308',
          text: '#000',
          label: 'ESI 3: URGENT',
          border: '#a16207',
          glow: 'none'
        };
      case 4:
        return {
          bg: '#0ea5e9',
          text: 'white',
          label: 'ESI 4: LESS URGENT',
          border: '#0284c7',
          glow: 'none'
        };
      case 5:
      default:
        return {
          bg: '#10b981',
          text: 'white',
          label: 'ESI 5: NON-URGENT',
          border: '#047857',
          glow: 'none'
        };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Banner */}
      <div style={{
        padding: '16px 20px',
        borderRadius: '12px',
        background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.6), rgba(15, 23, 42, 0.7))',
        border: '1px solid var(--glass-border)',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #f97316, #ef4444)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(249, 115, 22, 0.4)'
          }}>
            <HeartPulse size={22} color="white" />
          </div>
          <div>
            <h4 style={{ margin: 0, color: 'white', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Intelligent ESI 1–5 Triage & Dynamic Waiting Room
            </h4>
            <p style={{ margin: '3px 0 0', color: 'var(--text-muted)', fontSize: '12px' }}>
              Emergency Severity Index v4 algorithmic queuing with real-time wait threshold breach detection and LWBS risk modeling.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Updated: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <button
            type="button"
            onClick={loadQueue}
            disabled={isLoading}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--glass-border)',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px'
            }}
          >
            <RefreshCw size={13} style={{ animation: isLoading ? 'spin 1s linear infinite' : undefined }} />
            Refresh Queue
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
        <div className="glass-panel" style={{ padding: '14px', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total In Waiting Room</span>
          <span style={{ fontSize: '26px', fontWeight: 800, color: 'white', marginTop: '4px' }}>
            {stats.totalWaiting}
          </span>
          <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Active Patients</span>
        </div>

        <div className="glass-panel" style={{ padding: '14px', display: 'flex', flexDirection: 'column', border: stats.esi1Count > 0 ? '1px solid #ef4444' : undefined }}>
          <span style={{ fontSize: '11px', color: '#ef4444', textTransform: 'uppercase', fontWeight: 700 }}>ESI 1: Resuscitation</span>
          <span style={{ fontSize: '26px', fontWeight: 800, color: stats.esi1Count > 0 ? '#ef4444' : 'white', marginTop: '4px' }}>
            {stats.esi1Count}
          </span>
          <span style={{ fontSize: '11px', color: '#ef4444', marginTop: '2px' }}>0 min wait target</span>
        </div>

        <div className="glass-panel" style={{ padding: '14px', display: 'flex', flexDirection: 'column', border: stats.esi2Count > 0 ? '1px solid #f97316' : undefined }}>
          <span style={{ fontSize: '11px', color: '#f97316', textTransform: 'uppercase', fontWeight: 700 }}>ESI 2: Emergent</span>
          <span style={{ fontSize: '26px', fontWeight: 800, color: stats.esi2Count > 0 ? '#f97316' : 'white', marginTop: '4px' }}>
            {stats.esi2Count}
          </span>
          <span style={{ fontSize: '11px', color: '#f97316', marginTop: '2px' }}>&lt; 10 min target</span>
        </div>

        <div className="glass-panel" style={{ padding: '14px', display: 'flex', flexDirection: 'column', border: stats.breachedCount > 0 ? '1px solid #ef4444' : undefined }}>
          <span style={{ fontSize: '11px', color: stats.breachedCount > 0 ? '#ef4444' : 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
            SLA Wait Breaches
          </span>
          <span style={{ fontSize: '26px', fontWeight: 800, color: stats.breachedCount > 0 ? '#ef4444' : '#10b981', marginTop: '4px' }}>
            {stats.breachedCount}
          </span>
          <span style={{ fontSize: '11px', color: stats.breachedCount > 0 ? '#ef4444' : '#10b981', marginTop: '2px' }}>
            {stats.breachedCount > 0 ? '⚠️ Exceeded Max Wait' : '✓ All within SLA'}
          </span>
        </div>

        <div className="glass-panel" style={{ padding: '14px', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Avg Door-To-Exam</span>
          <span style={{ fontSize: '26px', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>
            {stats.avgWaitMinutes} <span style={{ fontSize: '14px', fontWeight: 400 }}>min</span>
          </span>
          <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Queue Average</span>
        </div>
      </div>

      {/* Filter Navigation */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
        <button
          type="button"
          onClick={() => setFilterMode('all')}
          style={{
            padding: '6px 14px',
            borderRadius: '20px',
            backgroundColor: filterMode === 'all' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
            border: `1px solid ${filterMode === 'all' ? '#3b82f6' : 'rgba(255,255,255,0.1)'}`,
            color: filterMode === 'all' ? '#60a5fa' : 'var(--text-muted)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          All Waiting ({queue.length})
        </button>

        <button
          type="button"
          onClick={() => setFilterMode('critical')}
          style={{
            padding: '6px 14px',
            borderRadius: '20px',
            backgroundColor: filterMode === 'critical' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
            border: `1px solid ${filterMode === 'critical' ? '#ef4444' : 'rgba(255,255,255,0.1)'}`,
            color: filterMode === 'critical' ? '#f87171' : 'var(--text-muted)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          🚨 ESI 1 & 2 Critical ({stats.esi1Count + stats.esi2Count})
        </button>

        <button
          type="button"
          onClick={() => setFilterMode('breaches')}
          style={{
            padding: '6px 14px',
            borderRadius: '20px',
            backgroundColor: filterMode === 'breaches' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
            border: `1px solid ${filterMode === 'breaches' ? '#f59e0b' : 'rgba(255,255,255,0.1)'}`,
            color: filterMode === 'breaches' ? '#fbbf24' : 'var(--text-muted)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          ⚠️ Wait Time Breaches ({stats.breachedCount})
        </button>

        <button
          type="button"
          onClick={() => setFilterMode('fast_track')}
          style={{
            padding: '6px 14px',
            borderRadius: '20px',
            backgroundColor: filterMode === 'fast_track' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
            border: `1px solid ${filterMode === 'fast_track' ? '#10b981' : 'rgba(255,255,255,0.1)'}`,
            color: filterMode === 'fast_track' ? '#34d399' : 'var(--text-muted)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          ⚡ Fast-Track / Low Acuity ({stats.esi4Count + stats.esi5Count})
        </button>
      </div>

      {/* Queue List Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredQueue.length === 0 ? (
          <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Users size={36} color="var(--text-muted)" style={{ margin: '0 auto 10px', opacity: 0.5 }} />
            <p style={{ margin: 0, fontSize: '14px' }}>No patients currently waiting under this filter.</p>
          </div>
        ) : (
          filteredQueue.map((patient, index) => {
            const badge = getEsiBadgeStyle(patient.esi.esiLevel);
            const isCalling = callingSessionId === patient.sessionId;

            return (
              <div
                key={patient.sessionId}
                className="glass-panel"
                style={{
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  border: patient.isBreached ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid var(--glass-border)',
                  backgroundColor: patient.isBreached ? 'rgba(239, 68, 68, 0.04)' : undefined,
                  boxShadow: patient.esi.esiLevel === 1 ? badge.glow : undefined
                }}
              >
                {/* Left: Queue Position & ESI Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: '220px' }}>
                  <div style={{
                    fontSize: '18px',
                    fontWeight: 800,
                    color: 'var(--text-muted)',
                    width: '32px',
                    textAlign: 'center'
                  }}>
                    #{index + 1}
                  </div>

                  <div style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    backgroundColor: badge.bg,
                    color: badge.text,
                    fontWeight: 800,
                    fontSize: '12px',
                    letterSpacing: '0.5px',
                    boxShadow: badge.glow,
                    textAlign: 'center'
                  }}>
                    {badge.label}
                  </div>
                </div>

                {/* Center: Patient Information & Clinical Presentation */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: 'white' }}>
                      {patient.patientName}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {patient.age}y / {patient.gender}
                    </span>

                    {patient.lwbsRisk === 'high' && (
                      <span style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(239, 68, 68, 0.2)',
                        color: '#f87171',
                        border: '1px solid #ef4444'
                      }}>
                        HIGH LWBS RISK
                      </span>
                    )}
                  </div>

                  <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1' }}>
                    <strong>Complaint:</strong> {patient.chiefComplaint}
                  </p>

                  {patient.vitalsSummary && (
                    <div style={{ fontSize: '11px', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Activity size={12} /> {patient.vitalsSummary}
                    </div>
                  )}

                  {patient.esi.clinicalFlags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
                      {patient.esi.clinicalFlags.map((flag, fi) => (
                        <span
                          key={fi}
                          style={{
                            fontSize: '10px',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            color: '#94a3b8'
                          }}
                        >
                          • {flag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: Wait Time Indicator & Call Button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      justifyContent: 'flex-end',
                      color: patient.isBreached ? '#ef4444' : '#94a3b8',
                      fontSize: '13px',
                      fontWeight: 700
                    }}>
                      <Clock size={14} />
                      <span>{patient.waitDurationMinutes} min wait</span>
                    </div>

                    <div style={{ fontSize: '11px', marginTop: '2px' }}>
                      {patient.isBreached ? (
                        <span style={{ color: '#ef4444', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <AlertTriangle size={12} /> BREACH (Target: {patient.esi.recommendedMaxWaitMinutes}m)
                        </span>
                      ) : (
                        <span style={{ color: '#10b981' }}>
                          Max Target: {patient.esi.recommendedMaxWaitMinutes}m
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCallToExamRoom(patient)}
                    disabled={isCalling}
                    style={{
                      padding: '9px 16px',
                      borderRadius: '8px',
                      backgroundColor: patient.esi.esiLevel === 1 ? '#dc2626' : '#2563eb',
                      border: 'none',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: patient.esi.esiLevel === 1 ? '0 0 15px rgba(220, 38, 38, 0.5)' : undefined,
                      transition: 'all 0.2s'
                    }}
                  >
                    {isCalling ? (
                      'Assigning Room...'
                    ) : (
                      <>
                        <span>Call to Exam</span>
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default WaitingRoomQueueManager;
