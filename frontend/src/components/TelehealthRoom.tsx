import React, { useState, useEffect, useRef } from 'react';
import { 
  Video, VideoOff, Mic, MicOff, PhoneOff, AlertTriangle, 
  Activity, Heart, ShieldAlert, Sparkles, Send,
  FileText, Clock, Users, ArrowUpRight, CheckCircle2
} from 'lucide-react';

export interface TelehealthTranscriptEntry {
  id: string;
  speaker: 'clinician' | 'patient' | 'ambient_ai';
  text: string;
  timestamp: string;
  clinicalEntities?: {
    category: 'symptom' | 'medication' | 'vital' | 'allergy' | 'order_suggestion';
    term: string;
    confidence: number;
  }[];
}

interface TelehealthRoomProps {
  sessionId: string;
  token?: string;
  backendUrl?: string;
  patientName?: string;
  onClose?: () => void;
}

export const TelehealthRoom: React.FC<TelehealthRoomProps> = ({
  sessionId,
  token,
  backendUrl = '',
  patientName = 'Evelyn Miller',
  onClose
}) => {
  const [roomId, setRoomId] = useState<string>('');
  const [callStatus, setCallStatus] = useState<'connecting' | 'active' | 'ended'>('connecting');
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // HUD Telemetry
  const [vitals, setVitals] = useState({
    heartRate: 102,
    heartRateTrend: 'rising' as 'stable' | 'rising' | 'falling',
    bloodPressure: '152/94 mmHg',
    bloodPressureCategory: 'elevated' as 'normal' | 'elevated' | 'hypertensive_urgency',
    spo2: 95,
    respiratoryRate: 22,
    temperatureF: 98.6
  });
  const [redFlags, setRedFlags] = useState<{ id: string; severity: string; title: string; recommendedAction: string }[]>([
    {
      id: 'rf-1',
      severity: 'critical',
      title: 'Tachycardia & Elevated Afterload',
      recommendedAction: 'Order STAT 12-lead ECG and hs-Troponin serial protocol'
    }
  ]);
  const [differential, setDifferential] = useState<string[]>([
    'Acute Coronary Syndrome (NSTEMI / STEMI)',
    'Unstable Angina Pectoris',
    'Aortic Dissection (rule out)'
  ]);

  // Transcripts & Chat
  const [transcripts, setTranscripts] = useState<TelehealthTranscriptEntry[]>([]);
  const [spokenInput, setSpokenInput] = useState('');
  const [speakerRole, setSpeakerRole] = useState<'clinician' | 'patient'>('clinician');
  const [liveNotes, setLiveNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [activeTab, setActiveTab] = useState<'hud' | 'scribe' | 'notes'>('scribe');
  const [showEndModal, setShowEndModal] = useState(false);
  const [emsDispatched, setEmsDispatched] = useState(false);

  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Call timer
  useEffect(() => {
    let timer: any;
    if (callStatus === 'active') {
      timer = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [callStatus]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  // Initialize room & fetch initial telemetry
  useEffect(() => {
    if (!sessionId || !token) return;
    initTelehealth();
  }, [sessionId, token]);

  const initTelehealth = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/clinician/sessions/${sessionId}/telehealth/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setRoomId(data.room.roomId);
        setCallStatus('active');
        if (data.room.transcript && data.room.transcript.length > 0) {
          setTranscripts(data.room.transcript);
        }
        if (data.room.liveNotes) {
          setLiveNotes(data.room.liveNotes);
        }
      }

      // Fetch live telemetry HUD
      const telRes = await fetch(`${backendUrl}/api/clinician/sessions/${sessionId}/telehealth/telemetry`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (telRes.ok) {
        const telData = await telRes.json();
        if (telData.vitals) setVitals(telData.vitals);
        if (telData.redFlags) setRedFlags(telData.redFlags);
        if (telData.aiDifferentialShortlist) setDifferential(telData.aiDifferentialShortlist);
        if (telData.recentTranscript && telData.recentTranscript.length > 0) {
          setTranscripts(prev => [...prev, ...telData.recentTranscript]);
        }
      }
    } catch (err) {
      console.error('Failed to init telehealth:', err);
      setCallStatus('active'); // fallback to simulate mode
    }
  };

  const handleSendSpeech = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!spokenInput.trim()) return;

    const text = spokenInput.trim();
    setSpokenInput('');

    // Optimistic entry
    const tempEntry: TelehealthTranscriptEntry = {
      id: `local-${Date.now()}`,
      speaker: speakerRole,
      text,
      timestamp: new Date().toISOString(),
      clinicalEntities: []
    };
    setTranscripts(prev => [...prev, tempEntry]);

    try {
      const res = await fetch(`${backendUrl}/api/clinician/sessions/${sessionId}/telehealth/transcript`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ roomId, speaker: speakerRole, text })
      });
      if (res.ok) {
        const data = await res.json();
        setTranscripts(prev => prev.map(entry => entry.id === tempEntry.id ? data.entry : entry));
      }
    } catch (err) {
      console.error('Failed to post speech:', err);
    }
  };

  const handleSaveNotes = async () => {
    if (!roomId) return;
    setIsSavingNotes(true);
    try {
      await fetch(`${backendUrl}/api/clinician/sessions/${sessionId}/telehealth/notes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ roomId, liveNotes })
      });
    } catch (err) {
      console.error('Failed to save live notes:', err);
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleEndCall = async () => {
    if (!roomId) {
      setCallStatus('ended');
      setShowEndModal(false);
      if (onClose) onClose();
      return;
    }
    try {
      await fetch(`${backendUrl}/api/clinician/sessions/${sessionId}/telehealth/end`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ roomId, finalNotes: liveNotes })
      });
    } catch (err) {
      console.error('Failed to end call:', err);
    }
    setCallStatus('ended');
    setShowEndModal(false);
    if (onClose) onClose();
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '840px',
      backgroundColor: '#0a0d14',
      borderRadius: '16px',
      overflow: 'hidden',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
      position: 'relative'
    }}>
      {/* Top Bar Header */}
      <div style={{
        padding: '12px 20px',
        backgroundColor: '#0f172a',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 10px',
            borderRadius: '20px',
            backgroundColor: callStatus === 'active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${callStatus === 'active' ? '#10b981' : '#ef4444'}`,
            fontSize: '12px',
            fontWeight: 700,
            color: callStatus === 'active' ? '#34d399' : '#f87171'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: callStatus === 'active' ? '#10b981' : '#ef4444',
              boxShadow: callStatus === 'active' ? '0 0 8px #10b981' : 'none'
            }} />
            {callStatus === 'active' ? 'LIVE TELEHEALTH CONSULT' : 'CALL ENDED'}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '13px' }}>
            <Clock size={15} />
            <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'white' }}>
              {formatTimer(callDuration)}
            </span>
          </div>

          <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#e2e8f0', fontSize: '13px', fontWeight: 600 }}>
            <Users size={15} color="#38bdf8" />
            <span>Patient: {patientName}</span>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>({roomId || 'Connecting...'})</span>
          </div>
        </div>

        {/* Emergency Dispatch Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => setEmsDispatched(true)}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              backgroundColor: emsDispatched ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              border: `1px solid ${emsDispatched ? '#10b981' : '#ef4444'}`,
              color: emsDispatched ? '#34d399' : '#f87171',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <ShieldAlert size={14} />
            {emsDispatched ? 'EMS UNIT DISPATCHED' : 'RAPID 911 / EMS ESCALATE'}
          </button>

          {onClose && (
            <button
              type="button"
              onClick={() => setShowEndModal(true)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#94a3b8',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Minimize
            </button>
          )}
        </div>
      </div>

      {/* Main Body: Video Stage (Left) & Clinical Copilot Scribe (Right) */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        
        {/* Video Stage with Live Clinical HUD */}
        <div style={{
          flex: 1.4,
          position: 'relative',
          backgroundColor: '#05070d',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflow: 'hidden'
        }}>
          {/* Top Video HUD Ribbon: Vital Signs Bar */}
          <div style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            right: '16px',
            zIndex: 5,
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            pointerEvents: 'none'
          }}>
            {/* Heart Rate Widget */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(8px)',
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: 'white',
              boxShadow: '0 4px 15px rgba(0,0,0,0.4)'
            }}>
              <Heart size={18} color="#ef4444" style={{ animation: 'pulse 1s infinite' }} />
              <div>
                <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>HEART RATE</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#f87171' }}>
                  {vitals.heartRate} <span style={{ fontSize: '11px', fontWeight: 400, color: '#94a3b8' }}>BPM ({vitals.heartRateTrend})</span>
                </div>
              </div>
            </div>

            {/* Blood Pressure Widget */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(8px)',
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: 'white',
              boxShadow: '0 4px 15px rgba(0,0,0,0.4)'
            }}>
              <Activity size={18} color="#f59e0b" />
              <div>
                <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>BLOOD PRESSURE</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#fbbf24' }}>
                  {vitals.bloodPressure} <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '3px', backgroundColor: 'rgba(245,158,11,0.2)', color: '#fbbf24', marginLeft: '4px' }}>STAGE 2 HTN</span>
                </div>
              </div>
            </div>

            {/* SpO2 Widget */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(8px)',
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: 'white',
              boxShadow: '0 4px 15px rgba(0,0,0,0.4)'
            }}>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#60a5fa' }}>O₂</div>
              <div>
                <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>OXYGEN SAT (SPO2)</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#93c5fd' }}>
                  {vitals.spo2}% <span style={{ fontSize: '11px', fontWeight: 400, color: '#94a3b8' }}>Room Air</span>
                </div>
              </div>
            </div>

            {/* Respiration Rate Widget */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(8px)',
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: 'white',
              boxShadow: '0 4px 15px rgba(0,0,0,0.4)'
            }}>
              <div>
                <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>RESP RATE / TEMP</div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#34d399' }}>
                  {vitals.respiratoryRate} rpm | {vitals.temperatureF}°F
                </div>
              </div>
            </div>
          </div>

          {/* Primary Patient Video Stream Canvas */}
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative'
          }}>
            {/* Background simulated video frame */}
            <div style={{
              width: '100%',
              height: '100%',
              background: 'radial-gradient(circle at center, #1e293b 0%, #0a0f1d 75%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}>
              {/* Patient Avatar & Video Simulation */}
              <div style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  width: '130px',
                  height: '130px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 35px rgba(59, 130, 246, 0.45)',
                  border: '3px solid rgba(255, 255, 255, 0.2)'
                }}>
                  <span style={{ fontSize: '42px', fontWeight: 700, color: 'white' }}>
                    {patientName.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: 'white', fontSize: '16px', fontWeight: 600 }}>{patientName}</div>
                  <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '2px' }}>
                    WebRTC Encrypted Peer Feed (1080p @ 30fps)
                  </div>
                </div>

                {/* Simulated Audio Waveform Bar */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  height: '24px',
                  marginTop: '8px'
                }}>
                  {[12, 22, 16, 26, 18, 24, 14, 20, 28, 15, 21].map((h, idx) => (
                    <div
                      key={idx}
                      style={{
                        width: '4px',
                        height: `${h}px`,
                        backgroundColor: '#38bdf8',
                        borderRadius: '2px',
                        animation: `pulse ${0.6 + (idx % 4) * 0.2}s infinite alternate`
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Floating Red-Flag Safety Alert HUD Banner */}
              {redFlags.length > 0 && (
                <div style={{
                  position: 'absolute',
                  bottom: '80px',
                  left: '20px',
                  right: '20px',
                  backgroundColor: 'rgba(239, 68, 68, 0.9)',
                  backdropFilter: 'blur(8px)',
                  borderRadius: '10px',
                  padding: '10px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 8px 25px rgba(239, 68, 68, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.2)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <AlertTriangle color="white" size={20} />
                    <div>
                      <div style={{ color: 'white', fontSize: '13px', fontWeight: 700 }}>
                        {redFlags[0].title}
                      </div>
                      <div style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '11px' }}>
                        {redFlags[0].recommendedAction}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'white', color: '#b91c1c', fontWeight: 800 }}>
                    ACTIVE RED FLAG
                  </span>
                </div>
              )}

              {/* Clinician PiP Inset (Bottom Right) */}
              <div style={{
                position: 'absolute',
                bottom: '16px',
                right: '16px',
                width: '140px',
                height: '95px',
                borderRadius: '8px',
                backgroundColor: '#1e293b',
                border: '2px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
              }}>
                <div style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 600 }}>Clinician Self-View</div>
                <div style={{ fontSize: '10px', color: '#64748b' }}>{isVideoOn ? 'HD Cam Active' : 'Cam Muted'}</div>
                <div style={{
                  position: 'absolute',
                  bottom: '4px',
                  left: '6px',
                  display: 'flex',
                  gap: '4px'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Video Controls Bar */}
          <div style={{
            padding: '14px 20px',
            backgroundColor: '#090d16',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            zIndex: 10
          }}>
            <button
              type="button"
              onClick={() => setIsMicOn(!isMicOn)}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: isMicOn ? 'rgba(255, 255, 255, 0.1)' : '#ef4444',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              title={isMicOn ? 'Mute Microphone' : 'Unmute Microphone'}
            >
              {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
            </button>

            <button
              type="button"
              onClick={() => setIsVideoOn(!isVideoOn)}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: isVideoOn ? 'rgba(255, 255, 255, 0.1)' : '#ef4444',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              title={isVideoOn ? 'Stop Camera' : 'Start Camera'}
            >
              {isVideoOn ? <Video size={20} /> : <VideoOff size={20} />}
            </button>

            <button
              type="button"
              onClick={() => setIsScreenSharing(!isScreenSharing)}
              style={{
                padding: '8px 14px',
                borderRadius: '20px',
                backgroundColor: isScreenSharing ? '#2563eb' : 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: 'white',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <ArrowUpRight size={15} />
              {isScreenSharing ? 'Sharing Screen' : 'Share Screen'}
            </button>

            <button
              type="button"
              onClick={() => setShowEndModal(true)}
              style={{
                padding: '8px 20px',
                borderRadius: '20px',
                backgroundColor: '#dc2626',
                border: 'none',
                color: 'white',
                fontSize: '13px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(220, 38, 38, 0.4)'
              }}
            >
              <PhoneOff size={16} /> End Call
            </button>
          </div>
        </div>

        {/* Right Panel: Ambient AI Clinical Copilot & Live Scribe */}
        <div style={{
          flex: 1.1,
          backgroundColor: '#0c101c',
          borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Tabs */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: '#0f172a'
          }}>
            <button
              type="button"
              onClick={() => setActiveTab('scribe')}
              style={{
                flex: 1,
                padding: '12px 14px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'scribe' ? '2px solid #38bdf8' : '2px solid transparent',
                color: activeTab === 'scribe' ? '#38bdf8' : '#94a3b8',
                fontWeight: 600,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <Sparkles size={15} /> Ambient Scribe
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('hud')}
              style={{
                flex: 1,
                padding: '12px 14px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'hud' ? '2px solid #38bdf8' : '2px solid transparent',
                color: activeTab === 'hud' ? '#38bdf8' : '#94a3b8',
                fontWeight: 600,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <Activity size={15} /> Differential & CDS
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('notes')}
              style={{
                flex: 1,
                padding: '12px 14px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'notes' ? '2px solid #38bdf8' : '2px solid transparent',
                color: activeTab === 'notes' ? '#38bdf8' : '#94a3b8',
                fontWeight: 600,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <FileText size={15} /> Quick Notes
            </button>
          </div>

          {/* Tab 1: Ambient Scribe Feed */}
          {activeTab === 'scribe' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  fontSize: '11px',
                  color: '#7dd3fc',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Sparkles size={14} />
                  <span>Real-time ambient speech transcription with medical NLP token tagging.</span>
                </div>

                {transcripts.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      backgroundColor: entry.speaker === 'clinician'
                        ? 'rgba(37, 99, 235, 0.15)'
                        : entry.speaker === 'patient'
                        ? 'rgba(255, 255, 255, 0.05)'
                        : 'rgba(16, 185, 129, 0.1)',
                      border: entry.speaker === 'clinician'
                        ? '1px solid rgba(59, 130, 246, 0.3)'
                        : '1px solid rgba(255, 255, 255, 0.08)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: entry.speaker === 'clinician' ? '#60a5fa' : entry.speaker === 'patient' ? '#34d399' : '#a78bfa',
                        textTransform: 'uppercase'
                      }}>
                        {entry.speaker === 'clinician' ? '👨‍⚕️ Clinician' : entry.speaker === 'patient' ? `👤 ${patientName}` : '🤖 Ambient AI'}
                      </span>
                      <span style={{ fontSize: '10px', color: '#64748b' }}>
                        {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>

                    <div style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: 1.4 }}>
                      {entry.text}
                    </div>

                    {/* Extracted Clinical Entity Tags */}
                    {entry.clinicalEntities && entry.clinicalEntities.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                        {entry.clinicalEntities.map((ent, i) => (
                          <span
                            key={i}
                            style={{
                              fontSize: '10px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: ent.category === 'symptom'
                                ? 'rgba(239, 68, 68, 0.2)'
                                : ent.category === 'medication'
                                ? 'rgba(59, 130, 246, 0.2)'
                                : 'rgba(16, 185, 129, 0.2)',
                              color: ent.category === 'symptom' ? '#f87171' : ent.category === 'medication' ? '#93c5fd' : '#6ee7b7',
                              border: '1px solid rgba(255, 255, 255, 0.1)'
                            }}
                          >
                            🏷️ {ent.term}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={transcriptEndRef} />
              </div>

              {/* Speech simulator input */}
              <form onSubmit={handleSendSpeech} style={{
                padding: '12px',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                backgroundColor: '#090d16',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <label style={{ fontSize: '11px', color: '#94a3b8' }}>Speaking as:</label>
                  <select
                    value={speakerRole}
                    onChange={(e) => setSpeakerRole(e.target.value as any)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      backgroundColor: '#1e293b',
                      color: 'white',
                      border: '1px solid rgba(255,255,255,0.15)',
                      fontSize: '11px'
                    }}
                  >
                    <option value="clinician">👨‍⚕️ Clinician</option>
                    <option value="patient">👤 Patient</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={spokenInput}
                    onChange={(e) => setSpokenInput(e.target.value)}
                    placeholder="Simulate live spoken statement during call..."
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: 'white',
                      fontSize: '12px'
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      backgroundColor: '#2563eb',
                      border: 'none',
                      color: 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Send size={14} />
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tab 2: Differential & CDS */}
          {activeTab === 'hud' && (
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
              <div>
                <h5 style={{ margin: '0 0 8px', color: '#38bdf8', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Activity size={15} /> Real-time Differential Ranking
                </h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {differential.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        backgroundColor: idx === 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                        border: idx === 0 ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.08)',
                        color: 'white',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <span>{idx + 1}. {item}</span>
                      <span style={{ fontSize: '10px', color: idx === 0 ? '#f87171' : '#94a3b8', fontWeight: 600 }}>
                        {idx === 0 ? 'TOP MATCH' : 'CONSIDER'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h5 style={{ margin: '0 0 8px', color: '#fbbf24', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={15} /> Clinical Red Flags & Actions
                </h5>
                {redFlags.map(rf => (
                  <div
                    key={rf.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      color: 'white',
                      marginBottom: '8px'
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#fbbf24' }}>{rf.title}</div>
                    <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '3px' }}>{rf.recommendedAction}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: Quick Notes */}
          {activeTab === 'notes' && (
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Live Clinician Scratchpad (Autosaving)</span>
                <button
                  type="button"
                  onClick={handleSaveNotes}
                  disabled={isSavingNotes}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    backgroundColor: '#10b981',
                    border: 'none',
                    color: 'white',
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <CheckCircle2 size={12} />
                  {isSavingNotes ? 'Saving...' : 'Save Notes'}
                </button>
              </div>

              <textarea
                value={liveNotes}
                onChange={(e) => setLiveNotes(e.target.value)}
                onBlur={handleSaveNotes}
                placeholder="Type real-time clinical impressions, orders planned, patient demeanor, etc..."
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: 'white',
                  fontSize: '13px',
                  resize: 'none',
                  outline: 'none',
                  lineHeight: 1.5
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* End Call Confirmation Modal */}
      {showEndModal && (
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50
        }}>
          <div style={{
            width: '420px',
            backgroundColor: '#1e293b',
            borderRadius: '12px',
            padding: '24px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
          }}>
            <h4 style={{ margin: '0 0 10px', color: 'white', fontSize: '16px' }}>Conclude Telehealth Consultation?</h4>
            <p style={{ margin: '0 0 16px', color: '#94a3b8', fontSize: '13px', lineHeight: 1.4 }}>
              Ending this consultation will finalize ambient transcript logging, record total call duration ({formatTimer(callDuration)}), and save your clinical encounter notes.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowEndModal(false)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#cbd5e1',
                  cursor: 'pointer'
                }}
              >
                Continue Call
              </button>
              <button
                type="button"
                onClick={handleEndCall}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#dc2626',
                  border: 'none',
                  color: 'white',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Conclude & Sign Off
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TelehealthRoom;
