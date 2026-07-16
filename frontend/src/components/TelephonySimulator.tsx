import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Volume2, Mic, User, Server, Terminal } from 'lucide-react';

interface TelephonySimulatorProps {
  backendUrl: string;
}

export default function TelephonySimulator({ backendUrl }: TelephonySimulatorProps) {
  // Simulator Configurations
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState('+1 (555) 839-2918');
  
  // Call States
  const [callStatus, setCallStatus] = useState<'idle' | 'dialing' | 'ringing' | 'active' | 'ended'>('idle');
  const [sessionId, setSessionId] = useState<string>('');
  const [callDuration, setCallDuration] = useState(0);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [liveVitals, setLiveVitals] = useState<any>(null);
  const [isDistressActive, setIsDistressActive] = useState(false);
  
  // Webhook Test Logger
  const [webhookLogs, setWebhookLogs] = useState<string>('');
  const [wsLogs, setWsLogs] = useState<any[]>([]);
  const [transcript, setTranscript] = useState<any[]>([]);
  
  // References
  const wsRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<any>(null);
  const durationIntervalRef = useRef<any>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Fetch mock patients on load
  useEffect(() => {
    fetchPatients();
    initSpeechRecognition();

    return () => {
      endCall();
    };
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [wsLogs]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  useEffect(() => {
    if (callStatus === 'active') {
      durationIntervalRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(durationIntervalRef.current);
      setCallDuration(0);
    }

    return () => clearInterval(durationIntervalRef.current);
  }, [callStatus]);

  const fetchPatients = async () => {
    try {
      const token = localStorage.getItem('intakerx_clinician_token') || localStorage.getItem('intakerx_token') || '';
      const res = await fetch(`${backendUrl}/api/intake/sessions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const sessionsData = await res.json();
        // Extract unique patients from sessions list
        const uniquePatientsMap = new Map();
        sessionsData.forEach((s: any) => {
          if (s.patientName && s.patientDob) {
            uniquePatientsMap.set(s.patientName, { id: s.patientId || 1, name: s.patientName });
          }
        });
        const patientsList = Array.from(uniquePatientsMap.values());
        setPatients(patientsList);
        if (patientsList.length > 0) setSelectedPatientId(patientsList[0].id.toString());
      }
    } catch (err) {
      console.error('Failed to load patients for simulator:', err);
    }
  };

  const initSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onresult = (event: any) => {
        const speechToText = event.results[event.results.length - 1][0].transcript;
        console.log('[Telephony Speech Input]:', speechToText);
        
        // Add to transcript
        setTranscript(prev => [...prev, { sender: 'patient', content: speechToText }]);
        
        // Log WebSocket frame sent
        logWebSocketFrame('OUTGOING', { type: 'user_speech', text: speechToText });
        
        // Send to WebSocket server
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'user_speech',
            text: speechToText
          }));
        }
      };

      rec.onerror = (err: any) => {
        console.error('[Speech Recognition Error]:', err);
      };

      recognitionRef.current = rec;
    }
  };

  const logWebSocketFrame = (direction: 'INCOMING' | 'OUTGOING', data: any) => {
    setWsLogs(prev => [...prev, {
      timestamp: new Date().toLocaleTimeString(),
      direction,
      data: JSON.stringify(data, null, 2)
    }]);
  };

  const triggerWebhookCall = async () => {
    setWebhookLogs('Triggering inbound call webhook POST /api/telephony/inbound-call...\n');
    try {
      const res = await fetch(`${backendUrl}/api/telephony/inbound-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: selectedPatientId ? parseInt(selectedPatientId, 10) : undefined,
          fromPhone: phoneNumber
        })
      });
      const data = await res.json();
      setWebhookLogs(prev => prev + `Status: ${res.status}\nResponse:\n${JSON.stringify(data, null, 2)}`);
      
      if (res.ok && data.callDetails) {
        setSessionId(data.callDetails.sessionId);
        return data.callDetails;
      }
    } catch (err: any) {
      setWebhookLogs(prev => prev + `Error: ${err.message}`);
    }
    return null;
  };

  const startCall = async () => {
    setTranscript([]);
    setWsLogs([]);
    setLiveVitals(null);
    setIsDistressActive(false);
    setCallStatus('dialing');

    // 1. Simulate inbound webhook first
    const callDetails = await triggerWebhookCall();
    if (!callDetails) {
      setCallStatus('idle');
      return;
    }

    setCallStatus('ringing');
    await new Promise(resolve => setTimeout(resolve, 1500)); // simulate phone ring delay

    // 2. Open WebSocket link
    const wsUrl = backendUrl.replace(/^http/, 'ws');
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      setCallStatus('active');
      logWebSocketFrame('OUTGOING', {
        type: 'start_session',
        sessionId: callDetails.sessionId,
        patientId: callDetails.patientId,
        currentStep: 'complaint'
      });

      socket.send(JSON.stringify({
        type: 'start_session',
        sessionId: callDetails.sessionId,
        patientId: callDetails.patientId,
        currentStep: 'complaint'
      }));

      // Start recording mic
      if (recognitionRef.current && !isMuted) {
        recognitionRef.current.start();
      }

      // Add system greeting to transcript
      setTranscript([{ sender: 'agent', content: callDetails.greeting }]);
      speakGreeting(callDetails.greeting);
    };

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      logWebSocketFrame('INCOMING', msg);

      if (msg.type === 'agent_speech') {
        setTranscript(prev => [...prev, { sender: 'agent', content: msg.text }]);
        speakGreeting(msg.text);
      } else if (msg.type === 'barge_in') {
        setTranscript(prev => [...prev, { sender: 'agent', content: `🚨 CLINICIAN INTERVENTION: ${msg.text}` }]);
        speakGreeting(`Clinician Intervention. ${msg.text}`);
      } else if (msg.type === 'ready') {
        console.log('[Telephony WS] Session ready.');
      } else if (msg.type === 'vitals') {
        setLiveVitals(msg.vitals);
      }
    };

    socket.onclose = () => {
      console.log('[Telephony WS] Session closed.');
      setCallStatus('ended');
      setTimeout(() => setCallStatus('idle'), 2000);
    };

    wsRef.current = socket;
  };

  const toggleDistress = () => {
    const newValue = !isDistressActive;
    setIsDistressActive(newValue);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'simulate_distress',
        value: newValue
      }));
    }
  };

  const speakGreeting = (text: string) => {
    if (!isSpeakerOn || !('speechSynthesis' in window)) return;
    
    // Stop speaking first
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const phoneVoice = voices.find(v => v.lang.startsWith('en-US') && v.name.includes('Natural')) || voices.find(v => v.lang.startsWith('en-US'));
    
    if (phoneVoice) utterance.voice = phoneVoice;
    utterance.rate = 1.0;
    utterance.pitch = 0.95; // Telephone voice slightly deeper/warmer

    window.speechSynthesis.speak(utterance);
  };

  const endCall = () => {
    // Stop recording
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {}
    }

    // Stop speaking
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setCallStatus('ended');
    setTimeout(() => setCallStatus('idle'), 2000);
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={styles.container}>
      {/* Top Banner Row */}
      <div style={styles.topRow}>
        <h2>Inbound Telephony Simulator & Webhook Mock Panel</h2>
        <span style={styles.badge}>SIP/Vapi WebSocket Simulator</span>
      </div>

      <div style={styles.dashboardLayout}>
        {/* Left pane: Configurations & Webhook Mock response */}
        <div style={styles.configPane} className="glass-panel">
          <div style={styles.paneHeader}>
            <Server size={18} color="#a855f7" />
            <h3>Call Settings & Webhook Simulator</h3>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Select Caller Profile</label>
            <select 
              value={selectedPatientId} 
              onChange={e => setSelectedPatientId(e.target.value)} 
              className="input-text" 
              style={styles.selectInput}
              disabled={callStatus !== 'idle'}
            >
              <option value="">-- Create/Select New Mock Call Patient --</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.name} (ID: {p.id})</option>
              ))}
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Simulated Phone Line Number</label>
            <input 
              type="text" 
              value={phoneNumber} 
              onChange={e => setPhoneNumber(e.target.value)} 
              className="input-text" 
              style={styles.selectInput}
              disabled={callStatus !== 'idle'}
            />
          </div>

          <button 
            onClick={triggerWebhookCall} 
            className="btn btn-secondary" 
            style={{ width: '100%', marginTop: '10px' }}
            disabled={callStatus !== 'idle'}
          >
            Test Webhook (POST /api/telephony/inbound-call)
          </button>

          {callStatus === 'active' && (
            <button 
              onClick={toggleDistress} 
              className={isDistressActive ? "btn btn-danger" : "btn btn-secondary"} 
              style={{ width: '100%', marginTop: '10px', fontWeight: 'bold' }}
            >
              {isDistressActive ? '🔴 Clear Distress Alarm' : '🚨 Trigger Distress Alarm'}
            </button>
          )}

          <div style={{ marginTop: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <span style={styles.label}>Inbound Webhook HTTP Audit Log</span>
            <pre style={styles.webhookCodeBlock}>
              {webhookLogs || 'No webhook logs yet. Click test webhook or dial-in.'}
            </pre>
          </div>
        </div>

        {/* Middle pane: Interactive Smartphone mockup */}
        <div style={styles.phonePane}>
          <div style={styles.phoneMockup}>
            {/* Camera notch */}
            <div style={styles.phoneDynamicIsland}></div>
            
            {/* Screen */}
            <div style={styles.phoneScreen}>
              {callStatus === 'idle' && (
                <div style={styles.idleScreen}>
                  <Phone size={48} color="#a855f7" style={{ marginBottom: '15px' }} />
                  <h4>Inbound Line Active</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center', margin: '5px 20px 20px 20px' }}>
                    Connect call simulator to feed speech via microphone and listen to the AI nurse assistant response.
                  </p>
                  <button onClick={startCall} style={styles.dialBtn}>
                    <Phone size={24} color="white" />
                  </button>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#10b981', marginTop: '10px' }}>Tap to Connect Call</span>
                </div>
              )}

              {(callStatus === 'dialing' || callStatus === 'ringing') && (
                <div style={styles.ringingScreen}>
                  <div style={styles.callerAvatar}>
                    <User size={32} color="#a855f7" />
                  </div>
                  <h4>AI Intake Assistant</h4>
                  <span style={styles.dialingStatus}>{callStatus.toUpperCase()}...</span>
                  <button onClick={endCall} style={styles.hangupBtn}>
                    <PhoneOff size={24} color="white" />
                  </button>
                </div>
              )}

              {callStatus === 'active' && (
                <div style={styles.activeScreen}>
                  <div style={styles.activeHeader}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={styles.activeTime}>{formatDuration(callDuration)}</span>
                      <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 'bold' }}>SECURE LINE CONNECTED</span>
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>ID: {sessionId.slice(0, 8)}...</span>
                    </div>
                  </div>

                  {/* Real-time Telemetry HUD */}
                  {liveVitals && (
                    <div style={styles.telemetryOverlay}>
                      <div style={styles.telemetryStat}>
                        <span style={styles.telemetryLabel}>HR</span>
                        <span style={{ 
                          ...styles.telemetryValue, 
                          color: liveVitals.heartRate > 130 ? '#ef4444' : '#10b981',
                        }}>
                          {liveVitals.heartRate} <span style={{ fontSize: '8px' }}>bpm</span>
                        </span>
                      </div>
                      <div style={styles.telemetryStat}>
                        <span style={styles.telemetryLabel}>SPO2</span>
                        <span style={{ 
                          ...styles.telemetryValue, 
                          color: liveVitals.spo2 < 92 ? '#ef4444' : '#3b82f6',
                        }}>
                          {liveVitals.spo2}%
                        </span>
                      </div>
                      <div style={styles.telemetryStat}>
                        <span style={styles.telemetryLabel}>BP</span>
                        <span style={{ 
                          ...styles.telemetryValue, 
                          color: liveVitals.bpSystolic > 150 ? '#ef4444' : 'white' 
                        }}>
                          {liveVitals.bpSystolic}/{liveVitals.bpDiastolic}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Active Transcript view */}
                  <div style={styles.phoneTranscriptContainer}>
                    {transcript.map((t, idx) => (
                      <div 
                        key={idx} 
                        style={{
                          ...styles.phoneMsgWrapper,
                          justifyContent: t.sender === 'agent' ? 'flex-start' : 'flex-end'
                        }}
                      >
                        <div 
                          style={{
                            ...styles.phoneMsgBubble,
                            backgroundColor: t.sender === 'agent' ? 'rgba(255,255,255,0.06)' : '#2563eb',
                            border: t.sender === 'agent' ? '1px solid var(--glass-border)' : 'none',
                            borderRadius: t.sender === 'agent' ? '10px 10px 10px 2px' : '10px 10px 2px 10px'
                          }}
                        >
                          {t.content}
                        </div>
                      </div>
                    ))}
                    <div ref={transcriptEndRef} />
                  </div>

                  {/* Waveform visualizer simulation in call */}
                  <div style={styles.pulseContainer}>
                    <div className="wave-active" style={{ ...styles.pulseBar, animationDelay: '0.1s' }}></div>
                    <div className="wave-active" style={{ ...styles.pulseBar, animationDelay: '0.3s' }}></div>
                    <div className="wave-active" style={{ ...styles.pulseBar, animationDelay: '0.5s' }}></div>
                    <div className="wave-active" style={{ ...styles.pulseBar, animationDelay: '0.2s' }}></div>
                  </div>

                  {/* Audio Controls */}
                  <div style={styles.callControlsRow}>
                    <button 
                      onClick={() => setIsSpeakerOn(!isSpeakerOn)} 
                      style={{ 
                        ...styles.callCtrlBtn, 
                        backgroundColor: isSpeakerOn ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
                        borderColor: isSpeakerOn ? '#a855f7' : 'var(--glass-border)'
                      }}
                    >
                      <Volume2 size={18} color={isSpeakerOn ? '#a855f7' : 'white'} />
                    </button>
                    
                    <button onClick={endCall} style={styles.hangupActiveBtn}>
                      <PhoneOff size={22} color="white" />
                    </button>

                    <button 
                      onClick={() => {
                        if (isMuted) {
                          recognitionRef.current?.start();
                          setIsMuted(false);
                        } else {
                          recognitionRef.current?.stop();
                          setIsMuted(true);
                        }
                      }} 
                      style={{ 
                        ...styles.callCtrlBtn,
                        backgroundColor: isMuted ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                        borderColor: isMuted ? '#ef4444' : 'var(--glass-border)'
                      }}
                    >
                      <Mic size={18} color={isMuted ? '#ef4444' : 'white'} />
                    </button>
                  </div>
                </div>
              )}

              {callStatus === 'ended' && (
                <div style={styles.endedScreen}>
                  <PhoneOff size={48} color="#ef4444" style={{ marginBottom: '15px' }} />
                  <h4>Call Disconnected</h4>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Session closed. Summarizing details...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right pane: WebSockets raw event logger */}
        <div style={styles.logsPane} className="glass-panel">
          <div style={styles.paneHeader}>
            <Terminal size={18} color="#10b981" />
            <h3>Real-Time SIP WebSocket Frame Logger</h3>
          </div>
          
          <div style={styles.logsContainer}>
            {wsLogs.length === 0 ? (
              <p style={styles.emptyLogsText}>WebSocket disconnected. Initiate call to monitor protocol exchange frames.</p>
            ) : (
              wsLogs.map((log, idx) => (
                <div key={idx} style={styles.logFrame}>
                  <div style={styles.logFrameHeader}>
                    <span style={styles.logTimestamp}>{log.timestamp}</span>
                    <span style={{
                      ...styles.logDirectionBadge,
                      backgroundColor: log.direction === 'INCOMING' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                      color: log.direction === 'INCOMING' ? '#10b981' : '#c084fc'
                    }}>
                      {log.direction}
                    </span>
                  </div>
                  <pre style={styles.logCodeBlock}>{log.data}</pre>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    height: '100%',
    overflowY: 'auto'
  },
  topRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  badge: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#a855f7',
    background: 'rgba(168, 85, 247, 0.15)',
    border: '1px solid rgba(168, 85, 247, 0.3)',
    borderRadius: '4px',
    padding: '2px 6px',
    textTransform: 'uppercase'
  },
  dashboardLayout: {
    display: 'flex',
    gap: '20px',
    flex: 1,
    flexWrap: 'wrap',
    minHeight: '0'
  },
  configPane: {
    flex: 1,
    minWidth: '320px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '15px'
  },
  phonePane: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '10px 20px',
    minWidth: '340px'
  },
  logsPane: {
    flex: 1.5,
    minWidth: '360px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
    height: '100%'
  },
  paneHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    borderBottom: '1px solid var(--glass-border)',
    paddingBottom: '12px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px'
  },
  label: {
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--text-muted)'
  },
  selectInput: {
    width: '100%',
    padding: '10px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--glass-border)',
    borderRadius: '6px',
    color: 'white'
  },
  webhookCodeBlock: {
    flex: 1,
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid var(--glass-border)',
    borderRadius: '6px',
    padding: '12px',
    fontFamily: 'monospace',
    fontSize: '11px',
    color: '#34d399',
    overflowY: 'auto',
    maxHeight: '260px'
  },
  phoneMockup: {
    width: '320px',
    height: '560px',
    backgroundColor: '#0f172a',
    borderRadius: '40px',
    border: '12px solid #334155',
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 40px rgba(168, 85, 247, 0.2)',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  phoneDynamicIsland: {
    width: '110px',
    height: '25px',
    backgroundColor: '#000',
    borderRadius: '15px',
    position: 'absolute',
    top: '12px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 10
  },
  phoneScreen: {
    flex: 1,
    background: 'linear-gradient(to bottom, #1e1b4b, #0f172a)',
    padding: '30px 15px 15px 15px',
    display: 'flex',
    flexDirection: 'column'
  },
  idleScreen: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1
  },
  dialBtn: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: '#10b981',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 0 20px rgba(16, 185, 129, 0.4)',
    transition: 'all 0.2s ease'
  },
  ringingScreen: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: '10px'
  },
  callerAvatar: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'rgba(168,85,247,0.1)',
    border: '2px solid #a855f7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    animation: 'pulse 1.5s infinite'
  },
  dialingStatus: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    letterSpacing: '2px'
  },
  hangupBtn: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: '#ef4444',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 0 20px rgba(239, 68, 68, 0.4)',
    marginTop: '40px'
  },
  activeScreen: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    justifyContent: 'space-between'
  },
  activeHeader: {
    textAlign: 'center',
    padding: '10px 0'
  },
  activeTime: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: 'white'
  },
  phoneTranscriptContainer: {
    flex: 1,
    overflowY: 'auto',
    margin: '15px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    paddingRight: '4px',
    maxHeight: '260px'
  },
  phoneMsgWrapper: {
    display: 'flex',
    width: '100%'
  },
  phoneMsgBubble: {
    maxWidth: '85%',
    padding: '8px 12px',
    fontSize: '12px',
    color: 'white',
    lineHeight: '1.4'
  },
  pulseContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '4px',
    height: '30px',
    marginBottom: '10px'
  },
  pulseBar: {
    width: '3px',
    height: '15px',
    backgroundColor: '#a855f7',
    borderRadius: '2px',
    animation: 'sound-wave 1s infinite alternate'
  },
  callControlsRow: {
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: '10px 0'
  },
  callCtrlBtn: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: '1px solid var(--glass-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  hangupActiveBtn: {
    width: '54px',
    height: '54px',
    borderRadius: '50%',
    backgroundColor: '#ef4444',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 0 15px rgba(239, 68, 68, 0.4)'
  },
  endedScreen: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1
  },
  logsContainer: {
    flex: 1,
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid var(--glass-border)',
    borderRadius: '6px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
    overflowY: 'auto',
    maxHeight: '440px'
  },
  emptyLogsText: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    textAlign: 'center',
    margin: 'auto 0'
  },
  logFrame: {
    borderBottom: '1px solid rgba(255,255,255,0.03)',
    paddingBottom: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '5px'
  },
  logFrameHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  logTimestamp: {
    fontSize: '10px',
    color: 'var(--text-muted)'
  },
  logDirectionBadge: {
    fontSize: '9px',
    fontWeight: 'bold',
    padding: '2px 6px',
    borderRadius: '4px'
  },
  logCodeBlock: {
    margin: 0,
    fontFamily: 'monospace',
    fontSize: '11px',
    color: '#cbd5e1',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    background: 'rgba(255,255,255,0.01)',
    padding: '8px',
    borderRadius: '4px'
  },
  telemetryOverlay: {
    display: 'flex',
    justifyContent: 'space-around',
    background: 'rgba(0, 0, 0, 0.4)',
    border: '1px solid var(--glass-border)',
    borderRadius: '8px',
    padding: '8px 4px',
    margin: '0 10px 10px 10px'
  },
  telemetryStat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  telemetryLabel: {
    fontSize: '9px',
    fontWeight: 'bold',
    color: 'var(--text-muted)'
  },
  telemetryValue: {
    fontSize: '13px',
    fontWeight: 'bold'
  }
};
