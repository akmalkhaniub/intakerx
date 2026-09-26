import React, { useState, useEffect } from 'react';
import { 
  Users, CheckCircle2, RefreshCw, Send,
  Vote, Award, Stethoscope
} from 'lucide-react';

export interface CaseConferenceNote {
  id: number;
  conferenceId: number;
  clinicianName: string;
  specialty: string;
  recommendation: string;
  voteDiagnosis?: string;
  urgency: 'stat' | 'urgent' | 'routine';
  createdAt: string;
}

export interface CaseConference {
  id: number;
  sessionId: string;
  title: string;
  specialtyFocus: string;
  status: 'open' | 'in_review' | 'consensus_reached' | 'finalized';
  consensusSummary?: string;
  consensusDiagnosis?: string;
  finalizedAt?: string;
  createdAt: string;
  notes: CaseConferenceNote[];
  votingBreakdown: { diagnosis: string; voteCount: number; percentage: number }[];
}

interface CaseConferenceRoomProps {
  sessionId?: string;
  token?: string;
  backendUrl?: string;
  patientName?: string;
  clinicianRole?: string;
}

export const CaseConferenceRoom: React.FC<CaseConferenceRoomProps> = ({
  sessionId,
  token,
  backendUrl = '',
  patientName = 'Encounter Patient',
  clinicianRole = 'Cardiology'
}) => {
  const [conference, setConference] = useState<CaseConference | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Note State
  const [clinicianName, setClinicianName] = useState('Dr. Marcus Brody, MD');
  const [specialty, setSpecialty] = useState(clinicianRole || 'Cardiology');
  const [voteDiagnosis, setVoteDiagnosis] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [urgency, setUrgency] = useState<'stat' | 'urgent' | 'routine'>('urgent');

  // Finalize Consensus State
  const [consensusDiag, setConsensusDiag] = useState('');
  const [consensusSumm, setConsensusSumm] = useState('');
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);

  useEffect(() => {
    if (sessionId) {
      loadConference();
    }
  }, [sessionId]);

  const loadConference = async () => {
    if (!sessionId || !token) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/clinician/sessions/${sessionId}/conference`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConference(data);
        if (data.votingBreakdown && data.votingBreakdown.length > 0 && !consensusDiag) {
          setConsensusDiag(data.votingBreakdown[0].diagnosis);
        }
      }
    } catch (err) {
      console.error('Failed to load case conference:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conference || !recommendation.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`${backendUrl}/api/clinician/conference/${conference.id}/notes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clinicianName,
          specialty,
          recommendation,
          voteDiagnosis: voteDiagnosis.trim() || undefined,
          urgency
        })
      });

      if (res.ok) {
        setRecommendation('');
        loadConference();
      }
    } catch (err) {
      console.error('Failed to add specialist note:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinalizeConsensus = async () => {
    if (!conference || !consensusDiag.trim() || !consensusSumm.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`${backendUrl}/api/clinician/conference/${conference.id}/finalize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          consensusDiagnosis: consensusDiag,
          consensusSummary: consensusSumm
        })
      });

      if (res.ok) {
        setShowFinalizeModal(false);
        loadConference();
      }
    } catch (err) {
      console.error('Failed to finalize consensus:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Banner */}
      <div style={{
        padding: '18px 22px',
        borderRadius: '12px',
        background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.7), rgba(15, 23, 42, 0.8))',
        border: '1px solid var(--glass-border)',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #a855f7, #6366f1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(168, 85, 247, 0.4)'
          }}>
            <Users size={22} color="white" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h4 style={{ margin: 0, color: 'white', fontSize: '16px' }}>
                {conference?.title || `${patientName} — MDT Case Conference`}
              </h4>
              <span style={{
                fontSize: '10px',
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: conference?.status === 'consensus_reached' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(168, 85, 247, 0.2)',
                color: conference?.status === 'consensus_reached' ? '#34d399' : '#c084fc',
                fontWeight: 700,
                border: `1px solid ${conference?.status === 'consensus_reached' ? '#10b981' : '#a855f7'}`
              }}>
                {conference?.status === 'consensus_reached' ? 'CONSENSUS SIGNED' : 'OPEN MDT BOARD'}
              </span>
            </div>
            <p style={{ margin: '3px 0 0', color: 'var(--text-muted)', fontSize: '12px' }}>
              Multidisciplinary specialist conferencing, diagnostic voting, and shared clinical case consensus for {patientName}.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {conference?.status !== 'consensus_reached' && (
            <button
              type="button"
              onClick={() => setShowFinalizeModal(true)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                border: 'none',
                color: 'white',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
              }}
            >
              <Award size={15} />
              Finalize Consensus Note
            </button>
          )}

          <button
            type="button"
            onClick={loadConference}
            disabled={isLoading}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid var(--glass-border)',
              color: 'white',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={13} style={{ animation: isLoading ? 'spin 1s linear infinite' : undefined }} />
          </button>
        </div>
      </div>

      {/* Consensus Finalized Callout (if signed off) */}
      {conference?.status === 'consensus_reached' && (
        <div style={{
          padding: '18px 22px',
          borderRadius: '12px',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399', fontWeight: 700, fontSize: '14px' }}>
            <CheckCircle2 size={18} />
            <span>Official Multidisciplinary Consensus Note Finalized</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>
              (Signed At: {new Date(conference.finalizedAt || '').toLocaleString()})
            </span>
          </div>
          <div style={{ fontSize: '13px', color: 'white' }}>
            <strong>Consensus Working Diagnosis:</strong> {conference.consensusDiagnosis}
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5 }}>
            {conference.consensusSummary}
          </p>
        </div>
      )}

      {/* Main Grid: Diagnostic Voting Matrix (Left) & Specialist Opinion Thread (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '20px' }}>
        
        {/* Left Column: Differential Diagnosis Voting Matrix & Add Review Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Voting Matrix Card */}
          <div className="glass-panel" style={{ padding: '18px' }}>
            <h5 style={{ margin: '0 0 12px', color: 'white', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Vote size={16} color="#a855f7" />
              Differential Diagnosis Consensus Voting
            </h5>

            {conference?.votingBreakdown && conference.votingBreakdown.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {conference.votingBreakdown.map((vb, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: idx === 0 ? '#38bdf8' : 'white', fontWeight: idx === 0 ? 700 : 500 }}>
                        {idx + 1}. {vb.diagnosis}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                        {vb.voteCount} votes ({vb.percentage}%)
                      </span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: '8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${vb.percentage}%`,
                        height: '100%',
                        backgroundColor: idx === 0 ? '#38bdf8' : '#a855f7',
                        borderRadius: '4px',
                        transition: 'width 0.4s ease'
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                No diagnostic votes logged yet. Add your vote below!
              </p>
            )}
          </div>

          {/* New Specialist Contribution Form */}
          <form onSubmit={handleAddNote} className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h5 style={{ margin: 0, color: 'white', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Stethoscope size={16} color="#38bdf8" />
              Post Specialist Consultation
            </h5>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Clinician Name & Role</label>
                <input
                  type="text"
                  value={clinicianName}
                  onChange={(e) => setClinicianName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--glass-border)',
                    color: 'white',
                    fontSize: '12px'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Specialty</label>
                <select
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    backgroundColor: '#1e293b',
                    border: '1px solid var(--glass-border)',
                    color: 'white',
                    fontSize: '12px'
                  }}
                >
                  <option value="Cardiology">Cardiology</option>
                  <option value="Radiology">Radiology</option>
                  <option value="Critical Care">Critical Care</option>
                  <option value="Pulmonology">Pulmonology</option>
                  <option value="Internal Medicine">Internal Medicine</option>
                  <option value="Neurology">Neurology</option>
                  <option value="Infectious Disease">Infectious Disease</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Diagnostic Vote (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Acute Myocarditis, ACS, etc."
                  value={voteDiagnosis}
                  onChange={(e) => setVoteDiagnosis(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--glass-border)',
                    color: 'white',
                    fontSize: '12px'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Urgency</label>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    backgroundColor: '#1e293b',
                    border: '1px solid var(--glass-border)',
                    color: 'white',
                    fontSize: '12px'
                  }}
                >
                  <option value="routine">Routine</option>
                  <option value="urgent">Urgent</option>
                  <option value="stat">STAT / Emergent</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Clinical Assessment & Action Plan</label>
              <textarea
                rows={3}
                required
                placeholder="Detail imaging findings, lab interpretation, or medication recommendations..."
                value={recommendation}
                onChange={(e) => setRecommendation(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--glass-border)',
                  color: 'white',
                  fontSize: '12px',
                  resize: 'none'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !recommendation.trim()}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                backgroundColor: '#2563eb',
                border: 'none',
                color: 'white',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <Send size={14} />
              {isSubmitting ? 'Posting...' : 'Post Specialist Recommendation'}
            </button>
          </form>
        </div>

        {/* Right Column: Specialist Consultation Thread */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
            <h5 style={{ margin: 0, color: 'white', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={16} color="#38bdf8" />
              Specialist Multi-Provider Thread ({conference?.notes.length || 0})
            </h5>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Chronological Feed</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '560px', overflowY: 'auto' }}>
            {conference?.notes.map((note) => (
              <div
                key={note.id}
                style={{
                  padding: '14px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>
                        {note.clinicianName}
                      </span>
                      <span style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(56, 189, 248, 0.2)',
                        color: '#38bdf8',
                        fontWeight: 600
                      }}>
                        {note.specialty}
                      </span>
                      {note.urgency === 'stat' && (
                        <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '3px', backgroundColor: '#ef4444', color: 'white', fontWeight: 800 }}>
                          STAT
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(note.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {note.voteDiagnosis && (
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(168, 85, 247, 0.15)',
                      border: '1px solid rgba(168, 85, 247, 0.3)',
                      color: '#c084fc',
                      fontWeight: 600
                    }}>
                      Voted: {note.voteDiagnosis}
                    </span>
                  )}
                </div>

                <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5 }}>
                  {note.recommendation}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Finalize Consensus Modal */}
      {showFinalizeModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            width: '480px',
            backgroundColor: '#1e293b',
            borderRadius: '12px',
            padding: '24px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <h4 style={{ margin: 0, color: 'white', fontSize: '16px' }}>Sign Off MDT Case Consensus</h4>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '12px' }}>
              Finalize the agreed working diagnosis and multidisciplinary care plan. This consensus note will be published into the patient's EHR chart.
            </p>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Consensus Working Diagnosis</label>
              <input
                type="text"
                value={consensusDiag}
                onChange={(e) => setConsensusDiag(e.target.value)}
                placeholder="e.g. Acute Viral Myocarditis"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--glass-border)',
                  color: 'white',
                  fontSize: '12px'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Consensus Summary & Action Plan</label>
              <textarea
                rows={4}
                value={consensusSumm}
                onChange={(e) => setConsensusSumm(e.target.value)}
                placeholder="Synthesize specialist input, imaging correlations, and treatment pathway agreed by the MDT board..."
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--glass-border)',
                  color: 'white',
                  fontSize: '12px',
                  resize: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowFinalizeModal(false)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  backgroundColor: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#94a3b8',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFinalizeConsensus}
                disabled={isSubmitting || !consensusDiag.trim() || !consensusSumm.trim()}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  backgroundColor: '#10b981',
                  border: 'none',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                {isSubmitting ? 'Signing...' : 'Sign Off & Concur'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CaseConferenceRoom;
