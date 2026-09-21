import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Sparkles, Trash2, Activity, Volume2, Stethoscope, User, Copy, Check } from 'lucide-react';

export interface ClinicalEntity {
  type: 'symptom' | 'medication' | 'vital' | 'exam' | 'plan';
  text: string;
}

export interface DiarizedTurn {
  id: string;
  speaker: 'clinician' | 'patient';
  text: string;
  timestamp: string;
  entities: ClinicalEntity[];
  sentiment?: 'calm' | 'anxious' | 'distressed' | 'reassured';
}

export interface SynthesizedSOAP {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  confidenceScore: number;
  highlightedKeywords: string[];
}

interface AmbientScribeProps {
  sessionId?: string;
  token?: string;
  backendUrl?: string;
  onAcceptSoap?: (soap: SynthesizedSOAP) => void;
}

export const AmbientScribe: React.FC<AmbientScribeProps> = ({
  sessionId = 'demo-encounter-01',
  token,
  backendUrl = '',
  onAcceptSoap
}) => {
  const [turns, setTurns] = useState<DiarizedTurn[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<'clinician' | 'patient'>('clinician');
  const [manualText, setManualText] = useState('');
  const [synthesizedSoap, setSynthesizedSoap] = useState<SynthesizedSOAP | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  // Load existing transcript on mount
  useEffect(() => {
    fetchTranscript();
  }, [sessionId]);

  const fetchTranscript = async () => {
    if (!sessionId || !token) return;
    try {
      const res = await fetch(`${backendUrl}/api/clinician/sessions/${sessionId}/ambient-scribe`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTurns(data.turns || []);
        if (data.synthesizedSoap) setSynthesizedSoap(data.synthesizedSoap);
      }
    } catch (err) {
      console.warn('Failed to load ambient transcript:', err);
    }
  };

  const handleSimulate = async (scenario: 'cardiac' | 'migraine' | 'respiratory') => {
    setIsLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/clinician/sessions/${sessionId}/ambient-scribe/simulate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ scenario })
      });
      if (res.ok) {
        const data = await res.json();
        setTurns(data.transcript?.turns || []);
        setSynthesizedSoap(null);
      }
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTurn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!manualText.trim()) return;

    const textToSend = manualText;
    setManualText('');
    try {
      const res = await fetch(`${backendUrl}/api/clinician/sessions/${sessionId}/ambient-scribe/turn`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ speaker: activeSpeaker, text: textToSend })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.turn) {
          setTurns(prev => [...prev, data.turn]);
        }
      }
    } catch (err) {
      console.error('Failed to add turn:', err);
    }
  };

  const handleSynthesize = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/clinician/sessions/${sessionId}/ambient-scribe/synthesize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setSynthesizedSoap(data.soap);
      }
    } catch (err) {
      console.error('Failed to synthesize SOAP note:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = async () => {
    try {
      await fetch(`${backendUrl}/api/clinician/sessions/${sessionId}/ambient-scribe/clear`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setTurns([]);
      setSynthesizedSoap(null);
    } catch (err) {
      console.error('Failed to clear transcript:', err);
    }
  };

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const getEntityBadgeStyle = (type: ClinicalEntity['type']) => {
    switch (type) {
      case 'symptom': return { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)', color: '#f87171' };
      case 'medication': return { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)', color: '#34d399' };
      case 'vital':
      case 'exam': return { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.3)', color: '#60a5fa' };
      case 'plan': return { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)', color: '#fbbf24' };
    }
  };

  const getSentimentBadge = (sentiment?: DiarizedTurn['sentiment']) => {
    if (!sentiment) return null;
    let color = '#94a3b8';
    if (sentiment === 'distressed') color = '#ef4444';
    if (sentiment === 'anxious') color = '#f59e0b';
    if (sentiment === 'reassured') color = '#10b981';
    return (
      <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.06)', color, fontWeight: 600 }}>
        Tone: {sentiment}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Control Banner */}
      <div style={{
        padding: '16px 20px',
        borderRadius: '12px',
        background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.6), rgba(15, 23, 42, 0.7))',
        border: '1px solid rgba(168, 85, 247, 0.25)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(168, 85, 247, 0.35)'
          }}>
            <Volume2 size={22} color="white" />
          </div>
          <div>
            <h4 style={{ margin: 0, color: 'white', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Ambient AI Clinical Scribe
              <span style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: isRecording ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                color: isRecording ? '#ef4444' : '#10b981',
                border: `1px solid ${isRecording ? '#ef4444' : '#10b981'}`
              }}>
                {isRecording ? '● Live Scribing' : '● Ready'}
              </span>
            </h4>
            <p style={{ margin: '3px 0 0 0', color: 'var(--text-muted)', fontSize: '12px' }}>
              Multi-speaker conversational diarization with real-time clinical entity recognition & SOAP note auto-synthesis.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setIsRecording(!isRecording)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: isRecording ? '#ef4444' : 'rgba(255, 255, 255, 0.08)',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 600
            }}
          >
            {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
            {isRecording ? 'Mute Mic' : 'Ambient Mic'}
          </button>

          {/* Quick Simulation Presets */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={() => handleSimulate('cardiac')}
              disabled={isLoading}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#fca5a5',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600
              }}
            >
              ❤️ Cardiac Case
            </button>
            <button
              type="button"
              onClick={() => handleSimulate('migraine')}
              disabled={isLoading}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                backgroundColor: 'rgba(168, 85, 247, 0.1)',
                color: '#d8b4fe',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600
              }}
            >
              🧠 Migraine Case
            </button>
            <button
              type="button"
              onClick={() => handleSimulate('respiratory')}
              disabled={isLoading}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                color: '#93c5fd',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600
              }}
            >
              🫁 Resp Case
            </button>
          </div>

          <button
            type="button"
            onClick={handleClear}
            style={{
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Reset transcript"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Main Grid: Transcript vs Synthesized SOAP */}
      <div style={{ display: 'grid', gridTemplateColumns: synthesizedSoap ? '1.1fr 1fr' : '1fr', gap: '20px' }}>
        {/* Left: Diarized Live Stream */}
        <div style={{
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          border: '1px solid var(--glass-border)',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '440px',
          maxHeight: '620px'
        }}>
          {/* Transcript Header */}
          <div style={{
            padding: '12px 18px',
            borderBottom: '1px solid var(--glass-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={16} color="#a855f7" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>
                Multi-Speaker Diarized Stream ({turns.length} utterances)
              </span>
            </div>
            <button
              type="button"
              onClick={handleSynthesize}
              disabled={turns.length === 0 || isLoading}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                border: 'none',
                color: 'white',
                cursor: turns.length > 0 ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 600,
                opacity: turns.length > 0 ? 1 : 0.5
              }}
            >
              <Sparkles size={14} />
              {isLoading ? 'Synthesizing...' : 'Synthesize SOAP Note'}
            </button>
          </div>

          {/* Transcript Feed */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {turns.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', margin: 'auto', padding: '40px' }}>
                <Volume2 size={36} color="#64748b" style={{ margin: '0 auto 12px' }} />
                <p style={{ margin: 0, fontSize: '14px' }}>No dialogue recorded in this encounter yet.</p>
                <p style={{ margin: '4px 0 0', fontSize: '12px' }}>
                  Click one of the simulation presets above or type a turn below to start scribing.
                </p>
              </div>
            ) : (
              turns.map(turn => {
                const isClinician = turn.speaker === 'clinician';
                return (
                  <div
                    key={turn.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isClinician ? 'flex-start' : 'flex-end',
                      maxWidth: '85%',
                      alignSelf: isClinician ? 'flex-start' : 'flex-end'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginBottom: '4px',
                      fontSize: '11px',
                      color: isClinician ? '#93c5fd' : '#d8b4fe'
                    }}>
                      {isClinician ? <Stethoscope size={12} /> : <User size={12} />}
                      <strong>{isClinician ? 'Clinician' : 'Patient'}</strong>
                      {getSentimentBadge(turn.sentiment)}
                      <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                        {new Date(turn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>

                    <div style={{
                      padding: '12px 14px',
                      borderRadius: isClinician ? '4px 14px 14px 14px' : '14px 4px 14px 14px',
                      backgroundColor: isClinician ? 'rgba(30, 58, 138, 0.3)' : 'rgba(88, 28, 135, 0.3)',
                      border: `1px solid ${isClinician ? 'rgba(59, 130, 246, 0.3)' : 'rgba(168, 85, 247, 0.3)'}`,
                      color: 'white',
                      fontSize: '13px',
                      lineHeight: '1.5'
                    }}>
                      {turn.text}

                      {/* Detected Clinical Entities */}
                      {turn.entities.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          {turn.entities.map((ent, idx) => {
                            const badge = getEntityBadgeStyle(ent.type);
                            return (
                              <span
                                key={idx}
                                style={{
                                  fontSize: '10px',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: badge.bg,
                                  border: `1px solid ${badge.border}`,
                                  color: badge.color,
                                  fontWeight: 600
                                }}
                              >
                                {ent.type.toUpperCase()}: {ent.text}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Manual Input Bar */}
          <form onSubmit={handleAddTurn} style={{
            padding: '12px',
            borderTop: '1px solid var(--glass-border)',
            display: 'flex',
            gap: '8px',
            backgroundColor: 'rgba(255,255,255,0.02)'
          }}>
            <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
              <button
                type="button"
                onClick={() => setActiveSpeaker('clinician')}
                style={{
                  padding: '6px 10px',
                  backgroundColor: activeSpeaker === 'clinician' ? '#2563eb' : 'rgba(255,255,255,0.04)',
                  color: 'white',
                  border: 'none',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Stethoscope size={12} /> MD
              </button>
              <button
                type="button"
                onClick={() => setActiveSpeaker('patient')}
                style={{
                  padding: '6px 10px',
                  backgroundColor: activeSpeaker === 'patient' ? '#7c3aed' : 'rgba(255,255,255,0.04)',
                  color: 'white',
                  border: 'none',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <User size={12} /> Patient
              </button>
            </div>

            <input
              type="text"
              className="input-text"
              value={manualText}
              onChange={e => setManualText(e.target.value)}
              placeholder={`Add utterance as ${activeSpeaker === 'clinician' ? 'Clinician' : 'Patient'}...`}
              style={{ flex: 1, padding: '8px 12px', fontSize: '13px' }}
            />

            <button type="submit" className="btn" disabled={!manualText.trim()} style={{ padding: '8px 14px', fontSize: '12px' }}>
              Add Turn
            </button>
          </form>
        </div>

        {/* Right: Synthesized SOAP Note */}
        {synthesizedSoap && (
          <div style={{
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '14px 18px',
              borderBottom: '1px solid rgba(16, 185, 129, 0.2)',
              backgroundColor: 'rgba(16, 185, 129, 0.05)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h5 style={{ margin: 0, color: '#34d399', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={16} /> Synthesized SOAP Clinical Note
                </h5>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Auto-mapped from {turns.length} utterances (Confidence: {synthesizedSoap.confidenceScore}%)
                </span>
              </div>

              {onAcceptSoap && (
                <button
                  type="button"
                  onClick={() => onAcceptSoap(synthesizedSoap)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    backgroundColor: '#10b981',
                    border: 'none',
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Accept into Encounter
                </button>
              )}
            </div>

            <div style={{ padding: '16px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Keywords Tag Cloud */}
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  KEY CLINICAL ENTITIES DETECTED:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {synthesizedSoap.highlightedKeywords.map((kw, i) => (
                    <span key={i} style={{
                      fontSize: '10px',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--glass-border)',
                      color: '#e2e8f0'
                    }}>
                      #{kw}
                    </span>
                  ))}
                </div>
              </div>

              {/* Subjective */}
              <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <strong style={{ fontSize: '12px', color: '#60a5fa' }}>[S] SUBJECTIVE</strong>
                  <button type="button" onClick={() => handleCopy(synthesizedSoap.subjective, 'S')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    {copiedSection === 'S' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  </button>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                  {synthesizedSoap.subjective}
                </p>
              </div>

              {/* Objective */}
              <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <strong style={{ fontSize: '12px', color: '#34d399' }}>[O] OBJECTIVE</strong>
                  <button type="button" onClick={() => handleCopy(synthesizedSoap.objective, 'O')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    {copiedSection === 'O' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  </button>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                  {synthesizedSoap.objective}
                </p>
              </div>

              {/* Assessment */}
              <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <strong style={{ fontSize: '12px', color: '#fbbf24' }}>[A] ASSESSMENT</strong>
                  <button type="button" onClick={() => handleCopy(synthesizedSoap.assessment, 'A')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    {copiedSection === 'A' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  </button>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                  {synthesizedSoap.assessment}
                </p>
              </div>

              {/* Plan */}
              <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <strong style={{ fontSize: '12px', color: '#f87171' }}>[P] PLAN</strong>
                  <button type="button" onClick={() => handleCopy(synthesizedSoap.plan, 'P')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    {copiedSection === 'P' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  </button>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                  {synthesizedSoap.plan}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AmbientScribe;
