import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, ShieldCheck, 
  ExternalLink, RefreshCw, Send,
  Search, Dna
} from 'lucide-react';

export interface ClinicalTrial {
  id: number;
  nctId: string;
  title: string;
  phase: string;
  sponsor: string;
  condition: string;
  status: string;
  minAge: number;
  maxAge: number;
  gender: string;
  inclusionCriteria: string[];
  exclusionCriteria: string[];
  biomarkerRequirements: Record<string, any>;
  studyLocations: string[];
  contactEmail: string;
}

export interface PatientTrialMatch {
  id: number;
  sessionId: string;
  patientId: number;
  trialId: number;
  matchScore: number;
  matchedInclusions: string[];
  matchedExclusions: string[];
  status: 'identified' | 'clinician_reviewed' | 'patient_contacted' | 'enrolled' | 'declined';
  clinicianNotes?: string;
  trial: ClinicalTrial;
  createdAt: string;
}

interface ClinicalTrialMatcherProps {
  sessionId?: string;
  token?: string;
  backendUrl?: string;
  patientName?: string;
}

export const ClinicalTrialMatcher: React.FC<ClinicalTrialMatcherProps> = ({
  sessionId,
  token,
  backendUrl = '',
  patientName = 'Encounter Patient'
}) => {
  const [matches, setMatches] = useState<PatientTrialMatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'high_match' | 'reviewed'>('all');
  const [savingMatchId, setSavingMatchId] = useState<number | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<number, string>>({});

  useEffect(() => {
    if (sessionId) {
      loadMatches();
    }
  }, [sessionId]);

  const loadMatches = async () => {
    if (!sessionId || !token) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/clinician/sessions/${sessionId}/trials/matches`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMatches(data);
        // Pre-fill notes draft
        const draft: Record<number, string> = {};
        data.forEach((m: PatientTrialMatch) => {
          if (m.clinicianNotes) draft[m.id] = m.clinicianNotes;
        });
        setNotesDraft(draft);
      }
    } catch (err) {
      console.error('Failed to load clinical trial matches:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (matchId: number, newStatus: PatientTrialMatch['status']) => {
    if (!token) return;
    setSavingMatchId(matchId);
    try {
      const res = await fetch(`${backendUrl}/api/clinician/trials/matches/${matchId}/status`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: newStatus,
          notes: notesDraft[matchId] || ''
        })
      });
      if (res.ok) {
        setMatches(prev => prev.map(m => m.id === matchId ? { ...m, status: newStatus, clinicianNotes: notesDraft[matchId] } : m));
      }
    } catch (err) {
      console.error('Failed to update trial match status:', err);
    } finally {
      setSavingMatchId(null);
    }
  };

  const filteredMatches = matches.filter(m => {
    if (activeFilter === 'high_match') return m.matchScore >= 70;
    if (activeFilter === 'reviewed') return m.status !== 'identified';
    return true;
  });

  const topMatch = matches.length > 0 ? matches[0] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner Header */}
      <div style={{
        padding: '18px 22px',
        borderRadius: '12px',
        background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.7), rgba(15, 23, 42, 0.8))',
        border: '1px solid var(--glass-border)',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(14, 165, 233, 0.4)'
          }}>
            <Dna size={22} color="white" />
          </div>
          <div>
            <h4 style={{ margin: 0, color: 'white', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              AI Clinical Trial Matching & Protocol Discovery
            </h4>
            <p style={{ margin: '3px 0 0', color: 'var(--text-muted)', fontSize: '12px' }}>
              Automated screening against ClinicalTrials.gov protocols matching {patientName}'s diagnoses, symptoms, age, and biomarkers.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadMatches}
          disabled={isLoading}
          style={{
            padding: '8px 14px',
            borderRadius: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid var(--glass-border)',
            color: 'white',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <RefreshCw size={13} style={{ animation: isLoading ? 'spin 1s linear infinite' : undefined }} />
          Re-evaluate Matches
        </button>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Highest Match Score</span>
          <span style={{ fontSize: '28px', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>
            {topMatch ? `${topMatch.matchScore}%` : 'N/A'}
          </span>
          <span style={{ fontSize: '11px', color: '#10b981', marginTop: '2px' }}>
            {topMatch ? `● ${topMatch.trial.nctId} (${topMatch.trial.phase})` : 'Awaiting analysis'}
          </span>
        </div>

        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Recruiting Protocols</span>
          <span style={{ fontSize: '28px', fontWeight: 800, color: 'white', marginTop: '4px' }}>
            {matches.length}
          </span>
          <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Active Trials Evaluated</span>
        </div>

        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Inclusions Verified</span>
          <span style={{ fontSize: '28px', fontWeight: 800, color: '#34d399', marginTop: '4px' }}>
            {topMatch ? topMatch.matchedInclusions.length : 0}
          </span>
          <span style={{ fontSize: '11px', color: '#10b981', marginTop: '2px' }}>Criteria Met by Patient</span>
        </div>

        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Clinician Status</span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: topMatch?.status !== 'identified' ? '#a855f7' : '#f59e0b', marginTop: '6px' }}>
            {topMatch?.status === 'clinician_reviewed' ? 'REVIEWED' : topMatch?.status === 'patient_contacted' ? 'CONTACTED' : 'PENDING'}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Action Workflow</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
        <button
          type="button"
          onClick={() => setActiveFilter('all')}
          style={{
            padding: '6px 14px',
            borderRadius: '20px',
            backgroundColor: activeFilter === 'all' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
            border: `1px solid ${activeFilter === 'all' ? '#38bdf8' : 'rgba(255,255,255,0.1)'}`,
            color: activeFilter === 'all' ? '#38bdf8' : 'var(--text-muted)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          All Qualified Matches ({matches.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('high_match')}
          style={{
            padding: '6px 14px',
            borderRadius: '20px',
            backgroundColor: activeFilter === 'high_match' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
            border: `1px solid ${activeFilter === 'high_match' ? '#10b981' : 'rgba(255,255,255,0.1)'}`,
            color: activeFilter === 'high_match' ? '#34d399' : 'var(--text-muted)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          ★ High Compatibility (&gt;= 70%) ({matches.filter(m => m.matchScore >= 70).length})
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('reviewed')}
          style={{
            padding: '6px 14px',
            borderRadius: '20px',
            backgroundColor: activeFilter === 'reviewed' ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
            border: `1px solid ${activeFilter === 'reviewed' ? '#a855f7' : 'rgba(255,255,255,0.1)'}`,
            color: activeFilter === 'reviewed' ? '#c084fc' : 'var(--text-muted)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          ✓ Clinician Actioned ({matches.filter(m => m.status !== 'identified').length})
        </button>
      </div>

      {/* Matches List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {filteredMatches.length === 0 ? (
          <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Search size={36} color="var(--text-muted)" style={{ margin: '0 auto 10px', opacity: 0.5 }} />
            <p style={{ margin: 0, fontSize: '14px' }}>No trials matching this filter criterion.</p>
          </div>
        ) : (
          filteredMatches.map((m, idx) => {
            const isTop = idx === 0;
            const isSaving = savingMatchId === m.id;

            return (
              <div
                key={m.id}
                className="glass-panel"
                style={{
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  border: isTop ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid var(--glass-border)',
                  backgroundColor: isTop ? 'rgba(56, 189, 248, 0.03)' : undefined
                }}
              >
                {/* Header row: Match score, Title, NCT ID */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                    {/* Score Badge */}
                    <div style={{
                      padding: '8px 12px',
                      borderRadius: '10px',
                      backgroundColor: m.matchScore >= 80 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                      border: `1px solid ${m.matchScore >= 80 ? '#10b981' : '#38bdf8'}`,
                      color: m.matchScore >= 80 ? '#34d399' : '#38bdf8',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      minWidth: '70px',
                      textAlign: 'center'
                    }}>
                      <span style={{ fontSize: '20px', fontWeight: 800 }}>{m.matchScore}%</span>
                      <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.5px' }}>COMPATIBLE</span>
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(255, 255, 255, 0.08)',
                          color: '#cbd5e1',
                          fontFamily: 'monospace',
                          fontWeight: 700
                        }}>
                          {m.trial.nctId}
                        </span>
                        <span style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(99, 102, 241, 0.2)',
                          color: '#818cf8',
                          fontWeight: 700
                        }}>
                          {m.trial.phase}
                        </span>
                        <span style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(16, 185, 129, 0.15)',
                          color: '#34d399',
                          fontWeight: 700
                        }}>
                          {m.trial.status}
                        </span>
                      </div>

                      <h4 style={{ margin: '6px 0 2px', color: 'white', fontSize: '15px', fontWeight: 700, lineHeight: 1.3 }}>
                        {m.trial.title}
                      </h4>
                      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '12px' }}>
                        Sponsor: {m.trial.sponsor} | Target: <strong>{m.trial.condition}</strong>
                      </p>
                    </div>
                  </div>

                  <a
                    href={`https://clinicaltrials.gov/study/${m.trial.nctId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid var(--glass-border)',
                      color: '#94a3b8',
                      fontSize: '11px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      textDecoration: 'none'
                    }}
                  >
                    <span>ClinicalTrials.gov</span>
                    <ExternalLink size={12} />
                  </a>
                </div>

                {/* Eligibility Breakdown */}
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1fr',
                  gap: '14px'
                }}>
                  {/* Inclusions Met */}
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={13} /> Met Inclusion Criteria ({m.matchedInclusions.length})
                    </span>
                    <ul style={{ margin: '6px 0 0', paddingLeft: '18px', fontSize: '12px', color: '#cbd5e1', lineHeight: 1.4 }}>
                      {m.matchedInclusions.map((inc, i) => (
                        <li key={i}>{inc}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Exclusions Cleared */}
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ShieldCheck size={13} /> Evaluated & Cleared Exclusions
                    </span>
                    <ul style={{ margin: '6px 0 0', paddingLeft: '18px', fontSize: '12px', color: '#cbd5e1', lineHeight: 1.4 }}>
                      {m.matchedExclusions.length > 0 ? (
                        m.matchedExclusions.map((exc, i) => (
                          <li key={i}>{exc}</li>
                        ))
                      ) : (
                        <li style={{ color: 'var(--text-muted)' }}>Standard exclusion checklist applies</li>
                      )}
                    </ul>
                  </div>
                </div>

                {/* Study Locations & Clinician Action Workflow */}
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  paddingTop: '8px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)'
                }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    📍 Trial Sites: {m.trial.studyLocations.join(' • ')}
                  </div>

                  {/* Clinician Review & Status Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Add note for clinical trial coordinator..."
                      value={notesDraft[m.id] !== undefined ? notesDraft[m.id] : (m.clinicianNotes || '')}
                      onChange={(e) => setNotesDraft({ ...notesDraft, [m.id]: e.target.value })}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: 'white',
                        fontSize: '11px',
                        width: '260px'
                      }}
                    />

                    <select
                      value={m.status}
                      onChange={(e) => handleUpdateStatus(m.id, e.target.value as any)}
                      disabled={isSaving}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        backgroundColor: '#1e293b',
                        color: 'white',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        fontSize: '11px',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="identified">Identified (Pending Review)</option>
                      <option value="clinician_reviewed">Approve for Patient Discussion</option>
                      <option value="patient_contacted">Patient Contacted</option>
                      <option value="enrolled">Enrolled in Study</option>
                      <option value="declined">Declined / Not Suitable</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(m.id, m.status)}
                      disabled={isSaving}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        backgroundColor: '#2563eb',
                        border: 'none',
                        color: 'white',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {isSaving ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
                      Save
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ClinicalTrialMatcher;
