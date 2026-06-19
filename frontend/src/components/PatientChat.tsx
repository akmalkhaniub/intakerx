import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, MicOff, AlertTriangle, ShieldCheck, HeartPulse, User, LogIn, FileText, CheckCircle } from 'lucide-react';

interface VisualizerProps {
  isRecording: boolean;
}

function AudioWaveformVisualizer({ isRecording }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isRecordingRef = useRef(isRecording);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!isRecording) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
      return;
    }

    let fallbackAngle = 0;

    const startAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        analyserRef.current = analyser;

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
          if (!isRecordingRef.current) return;
          animationFrameRef.current = requestAnimationFrame(draw);

          analyser.getByteFrequencyData(dataArray);

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = 'rgba(15, 23, 42, 0.3)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          const barWidth = (canvas.width / bufferLength) * 0.9;
          let x = 0;

          for (let i = 0; i < bufferLength; i++) {
            const value = dataArray[i];
            const percent = value / 255;
            const barHeight = Math.max(4, percent * (canvas.height - 8));

            const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
            gradient.addColorStop(0, 'rgba(124, 58, 237, 0.4)');
            gradient.addColorStop(0.5, 'rgba(168, 85, 247, 0.8)');
            gradient.addColorStop(1, 'rgba(236, 72, 153, 1)');

            ctx.fillStyle = gradient;
            const y = (canvas.height - barHeight) / 2;
            
            ctx.beginPath();
            if (ctx.roundRect) {
              ctx.roundRect(x, y, barWidth - 2, barHeight, 3);
            } else {
              ctx.rect(x, y, barWidth - 2, barHeight);
            }
            ctx.fill();

            x += barWidth;
          }
        };

        draw();
      } catch (err) {
        console.warn('Microphone access blocked/unavailable, falling back to sine wave simulation:', err);
        
        const drawFallback = () => {
          if (!isRecordingRef.current) return;
          animationFrameRef.current = requestAnimationFrame(drawFallback);

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = 'rgba(15, 23, 42, 0.3)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          ctx.beginPath();
          ctx.moveTo(0, canvas.height / 2);
          ctx.lineWidth = 3;
          
          const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
          gradient.addColorStop(0, '#7c3aed');
          gradient.addColorStop(0.5, '#a855f7');
          gradient.addColorStop(1, '#ec4899');
          ctx.strokeStyle = gradient;

          for (let i = 0; i < canvas.width; i++) {
            const amplitude = 12 * Math.sin(fallbackAngle + i * 0.05) * Math.sin(fallbackAngle * 0.5);
            ctx.lineTo(i, canvas.height / 2 + amplitude);
          }
          ctx.stroke();
          fallbackAngle += 0.15;
        };

        drawFallback();
      }
    };

    startAudio();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [isRecording]);

  return (
    <canvas 
      ref={canvasRef} 
      width={400} 
      height={46} 
      style={{
        flex: 1,
        borderRadius: '8px',
        border: '1px solid var(--glass-border)',
        boxShadow: '0 0 10px rgba(168, 85, 247, 0.15)',
        background: 'rgba(15, 23, 42, 0.4)',
      }}
    />
  );
}

interface PatientChatProps {
  backendUrl: string;
}

export default function PatientChat({ backendUrl }: PatientChatProps) {
  // Authentication State
  const [token, setToken] = useState<string>(localStorage.getItem('intakerx_token') || '');
  const [user, setUser] = useState<any>(JSON.parse(localStorage.getItem('intakerx_user') || 'null'));
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [sex, setSex] = useState('Male');
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [insurancePolicy, setInsurancePolicy] = useState('');
  const [authError, setAuthError] = useState('');

  // Active Session State
  const [sessionId, setSessionId] = useState<string>('');
  const [sessionStatus, setSessionStatus] = useState<string>('');
  const [currentStep, setCurrentStep] = useState<string>('');
  const [triageLevel, setTriageLevel] = useState<string>('');
  
  const [messages, setMessages] = useState<any[]>([]);
  const [symptoms, setSymptoms] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  
  // UI Control State
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);

  const messageEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const synthesisUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Auto-scroll chat
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Sync token to storage
  useEffect(() => {
    if (token) {
      localStorage.setItem('intakerx_token', token);
      localStorage.setItem('intakerx_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('intakerx_token');
      localStorage.removeItem('intakerx_user');
      setSessionId('');
    }
  }, [token, user]);

  // WebSocket lifecycle for Voice Mode
  useEffect(() => {
    if (sessionId && token) {
      // Connect to WebSocket backend
      const wsUrl = backendUrl.replace(/^http/, 'ws');
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log('[WS] Connected to backend');
        socket.send(JSON.stringify({
          type: 'start_session',
          sessionId,
          patientId: user.id,
          currentStep: currentStep || 'complaint'
        }));
      };

      socket.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'agent_speech') {
          // Speak out loud
          speakText(msg.text);
          // Refresh session details to pull message list, symptoms, and meds
          loadSessionDetails(sessionId);
        } else if (msg.type === 'error') {
          console.error('[WS] Error:', msg.message);
        }
      };

      socket.onclose = () => {
        console.log('[WS] Disconnected');
      };

      setWs(socket);

      return () => {
        socket.close();
      };
    }
  }, [sessionId]);

  // Initialize Web Speech Recognition API
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsRecording(true);
        // Stop any active speaking
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      };

      rec.onresult = (event: any) => {
        const speechToText = event.results[0][0].transcript;
        console.log('[Speech] Captured:', speechToText);
        sendSpeechInput(speechToText);
      };

      rec.onerror = (err: any) => {
        console.error('[Speech] Error:', err);
        setIsRecording(false);
      };

      rec.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = rec;
    }
  }, [ws, sessionId]);

  // Auth Handlers
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsLoading(true);

    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const body = authMode === 'login' 
      ? { email, password }
      : { name, email, password, dob, sex, insuranceProvider, insurancePolicy };

    try {
      const res = await fetch(`${backendUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed.');

      setToken(data.token);
      setUser(data.user);
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setToken('');
    setUser(null);
    setMessages([]);
    setSymptoms([]);
    setMedications([]);
    window.speechSynthesis.cancel();
  };

  // Session Handlers
  const startNewSession = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/intake/sessions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSessionId(data.id);
      setSessionStatus('active');
      setCurrentStep('complaint');
      setTriageLevel('routine');
      
      // Load messages
      await loadSessionDetails(data.id);
    } catch (err: any) {
      console.error(err);
      alert('Failed to start session: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSessionDetails = async (id: string) => {
    try {
      const res = await fetch(`${backendUrl}/api/intake/sessions/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessages(data.messages);
      setSymptoms(data.symptoms);
      setMedications(data.medications);
      setSessionStatus(data.session.status);
      setCurrentStep(data.session.currentStep);
      setTriageLevel(data.session.triageLevel);
    } catch (err) {
      console.error('Failed to load session details:', err);
    }
  };

  // Text message send
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const textToSend = inputValue;
    setInputValue('');
    setIsLoading(true);

    // Stop speaking
    window.speechSynthesis.cancel();
    setIsSpeaking(false);

    // Optimistically add patient message
    setMessages(prev => [...prev, { sender: 'patient', content: textToSend, createdAt: new Date().toISOString() }]);

    try {
      const res = await fetch(`${backendUrl}/api/intake/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: textToSend })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Reload state
      await loadSessionDetails(sessionId);
    } catch (err: any) {
      console.error(err);
      setMessages(prev => [...prev, { sender: 'system', content: `Error: ${err.message}`, createdAt: new Date().toISOString() }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Voice/Speech Actions
  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert('Speech Recognition is not supported or active in your browser. Please try Chrome or Edge.');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  const sendSpeechInput = (text: string) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      // Optimistically add text
      setMessages(prev => [...prev, { sender: 'patient', content: text, createdAt: new Date().toISOString() }]);
      setIsLoading(true);
      
      ws.send(JSON.stringify({
        type: 'user_speech',
        text
      }));
    } else {
      // Fallback to REST API if WebSocket isn't connected
      setInputValue(text);
      handleSendMessage();
    }
  };

  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    
    // Cancel any active speaking
    window.speechSynthesis.cancel();

    // Standard Speech Synthesis configuration
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Choose a calm medical voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Natural') || v.lang.startsWith('en-US'));
    if (preferredVoice) utterance.voice = preferredVoice;
    
    utterance.rate = 1.05; // Slightly faster for natural latency feel
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
    };

    synthesisUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%' }}>
      {/* Auth Screen */}
      {!token ? (
        <div style={styles.authContainer} className="glass-panel">
          <div style={styles.authHeader}>
            <span style={styles.authIcon}>{authMode === 'login' ? <LogIn size={32} color="#3b82f6" /> : <User size={32} color="#a855f7" />}</span>
            <h2>{authMode === 'login' ? 'Patient Login' : 'Register Patient Account'}</h2>
            <p style={{ color: 'var(--text-muted)' }}>Secure symptom screening & intake registration</p>
          </div>

          <form onSubmit={handleAuthSubmit} style={styles.form}>
            {authError && <div style={styles.errorAlert}>{authError}</div>}
            
            {authMode === 'register' && (
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label>Full Name</label>
                  <input type="text" className="input-text" value={name} onChange={e => setName(e.target.value)} placeholder="Jane Doe" required />
                </div>
              </div>
            )}

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label>Email Address</label>
                <input type="email" className="input-text" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@example.com" required />
              </div>
              <div style={styles.formGroup}>
                <label>Password</label>
                <input type="password" className="input-text" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
            </div>

            {authMode === 'register' && (
              <>
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label>Date of Birth</label>
                    <input type="date" className="input-text" value={dob} onChange={e => setDob(e.target.value)} required />
                  </div>
                  <div style={styles.formGroup}>
                    <label>Sex</label>
                    <select className="input-text" value={sex} onChange={e => setSex(e.target.value)}>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label>Insurance Provider</label>
                    <input type="text" className="input-text" value={insuranceProvider} onChange={e => setInsuranceProvider(e.target.value)} placeholder="Blue Cross Blue Shield" />
                  </div>
                  <div style={styles.formGroup}>
                    <label>Policy / Member ID</label>
                    <input type="text" className="input-text" value={insurancePolicy} onChange={e => setInsurancePolicy(e.target.value)} placeholder="XYZ123456789" />
                  </div>
                </div>
              </>
            )}

            <button type="submit" className="btn" disabled={isLoading} style={{ width: '100%', marginTop: '10px' }}>
              {isLoading ? 'Processing...' : authMode === 'login' ? 'Sign In' : 'Create Patient Record'}
            </button>
          </form>

          <div style={styles.authFooter}>
            <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} style={styles.switchModeBtn}>
              {authMode === 'login' ? "Don't have an account? Sign up" : 'Already registered? Log in'}
            </button>
          </div>
        </div>
      ) : (
        /* Logged In Intake Flow */
        <div style={styles.mainLayout}>
          {/* Left panel: Chat Interface */}
          <div style={styles.chatSection} className="glass-panel">
            {/* Session Header */}
            <div style={styles.chatHeader}>
              <div style={styles.patientProfile}>
                <div style={styles.profileAvatar}><User size={18} /></div>
                <div>
                  <h4>{user.name}</h4>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Role: Patient Intake</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {sessionId && (
                  <span className={`triage-badge triage-${triageLevel}`}>
                    Triage: {triageLevel}
                  </span>
                )}
                <button onClick={handleLogout} style={styles.logoutBtn}>Sign Out</button>
              </div>
            </div>

            {/* Chat Body */}
            {!sessionId ? (
              <div style={styles.startSessionScreen}>
                <div style={styles.startBadge}><HeartPulse size={48} color="#3b82f6" /></div>
                <h3>Welcome to Clinic Patient Intake</h3>
                <p>Register your chief complaint, symptoms, medications, and details with our AI nurse assistant before meeting your doctor.</p>
                <button onClick={startNewSession} className="btn" disabled={isLoading}>
                  <FileText size={18} />
                  Start AI Symptom Screen
                </button>
              </div>
            ) : (
              <>
                <div style={styles.messagesList}>
                  {messages.map((msg, index) => {
                    const isAgent = msg.sender === 'agent';
                    const isSys = msg.sender === 'system';
                    
                    return (
                      <div 
                        key={index} 
                        style={{
                          ...styles.messageWrapper,
                          justifyContent: isAgent ? 'flex-start' : 'flex-end'
                        }}
                      >
                        <div 
                          style={{
                            ...styles.messageBubble,
                            backgroundColor: isAgent 
                              ? 'rgba(30, 41, 59, 0.7)' 
                              : isSys 
                                ? 'rgba(239, 68, 68, 0.1)'
                                : '#2563eb',
                            border: isAgent ? '1px solid var(--glass-border)' : 'none',
                            color: isSys ? '#ef4444' : 'white',
                            borderRadius: isAgent ? '16px 16px 16px 4px' : '16px 16px 4px 16px',
                          }}
                        >
                          <p>{msg.content}</p>
                          <span style={styles.msgTime}>
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  
                  {isLoading && (
                    <div style={styles.messageWrapper}>
                      <div style={{ ...styles.messageBubble, backgroundColor: 'rgba(30, 41, 59, 0.4)', border: '1px solid var(--glass-border)', borderRadius: '16px 16px 16px 4px' }}>
                        <div className="loading-dots">
                          <span></span><span></span><span></span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Speech speaking animation overlay */}
                  {isSpeaking && (
                    <div style={styles.speakingWaveWrapper}>
                      <div style={styles.waveBar} className="wave-active"></div>
                      <div style={styles.waveBar} className="wave-active"></div>
                      <div style={styles.waveBar} className="wave-active"></div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '10px' }}>AI nurse is speaking...</span>
                    </div>
                  )}

                  <div ref={messageEndRef} />
                </div>

                {/* Emergency Block Banners */}
                {sessionStatus === 'escalated' ? (
                  <div style={styles.escalatedAlert} className="emergency-panel-glow">
                    <AlertTriangle size={24} color="#ef4444" />
                    <div>
                      <h5>Emergency Handoff Action Triggered</h5>
                      <p>Critical red flags detected. Symptom collection is halted. Please call 911 or visit the nearest ER immediately.</p>
                    </div>
                  </div>
                ) : (
                  /* Chat Input Controls */
                  <form onSubmit={handleSendMessage} style={styles.chatInputBar}>
                    <button 
                      type="button" 
                      onClick={toggleRecording} 
                      style={{
                        ...styles.micBtn,
                        backgroundColor: isRecording ? '#ef4444' : 'rgba(255, 255, 255, 0.05)',
                        borderColor: isRecording ? '#ef4444' : 'var(--glass-border)'
                      }}
                    >
                      {isRecording ? <MicOff size={20} color="white" /> : <Mic size={20} color="#a855f7" />}
                    </button>
                    
                    {isRecording ? (
                      <AudioWaveformVisualizer isRecording={isRecording} />
                    ) : (
                      <input 
                        type="text" 
                        className="input-text" 
                        style={styles.chatInput} 
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        placeholder="Describe symptoms or type here..."
                      />
                    )}
                    
                    <button type="submit" className="btn" disabled={!inputValue.trim() || isLoading}>
                      <Send size={18} />
                    </button>
                  </form>
                )}
              </>
            )}
          </div>

          {/* Right panel: Extracted Clinical Card */}
          {sessionId && (
            <div style={styles.clinicalCard} className="glass-panel">
              <div style={styles.cardHeader}>
                <ShieldCheck size={20} color="#10b981" />
                <h3>Intake State Tracker</h3>
              </div>

              {/* Progress Stepper */}
              <div style={styles.stepperContainer}>
                {['complaint', 'history', 'meds', 'allergies', 'insurance', 'review'].map((step, idx) => {
                  const isActive = currentStep === step;
                  const isPast = ['complaint', 'history', 'meds', 'allergies', 'insurance', 'review'].indexOf(currentStep) > idx;
                  return (
                    <div key={step} style={styles.stepIndicator}>
                      <div 
                        style={{
                          ...styles.stepNode,
                          backgroundColor: isPast ? '#10b981' : isActive ? '#3b82f6' : 'rgba(255,255,255,0.05)',
                          borderColor: isPast ? '#10b981' : isActive ? '#3b82f6' : 'var(--glass-border)'
                        }}
                      >
                        {isPast ? <CheckCircle size={12} color="white" /> : idx + 1}
                      </div>
                      <span style={{
                        ...styles.stepLabel,
                        color: isActive ? 'white' : 'var(--text-muted)'
                      }}>
                        {step.charAt(0).toUpperCase() + step.slice(1)}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div style={styles.cardDivider}></div>

              {/* Extracted Symptoms */}
              <div style={styles.cardSection}>
                <h4>Extracted Symptoms</h4>
                {symptoms.length === 0 ? (
                  <p style={styles.emptyText}>No symptoms detected yet.</p>
                ) : (
                  <div style={styles.tagGrid}>
                    {symptoms.map((s, idx) => (
                      <span key={idx} style={{
                        ...styles.symptomTag,
                        backgroundColor: s.isRedFlag ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.05)',
                        borderColor: s.isRedFlag ? 'rgba(239, 68, 68, 0.3)' : 'var(--glass-border)',
                        color: s.isRedFlag ? '#ef4444' : '#60a5fa'
                      }}>
                        {s.name} ({s.severity})
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Extracted Medications */}
              <div style={styles.cardSection}>
                <h4>Extracted Medications</h4>
                {medications.length === 0 ? (
                  <p style={styles.emptyText}>No medications reported yet.</p>
                ) : (
                  <div style={styles.medsListContainer}>
                    {medications.map((m, idx) => (
                      <div key={idx} style={styles.medicationRow}>
                        <span style={styles.medName}>{m.name}</span>
                        {m.dosage && <span style={styles.medDosage}>{m.dosage}</span>}
                        {m.frequency && <span style={styles.medFreq}>{m.frequency}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  authContainer: {
    maxWidth: '500px',
    width: '100%',
    margin: '80px auto',
    padding: '40px',
  },
  authHeader: {
    textAlign: 'center',
    marginBottom: '30px',
  },
  authIcon: {
    display: 'inline-flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: 'rgba(255,255,255,0.02)',
    border: '1px solid var(--glass-border)',
    marginBottom: '15px'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px'
  },
  formRow: {
    display: 'flex',
    gap: '15px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    gap: '5px'
  },
  errorAlert: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    color: '#ef4444',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '6px',
    padding: '12px',
    fontSize: '14px',
    textAlign: 'center'
  },
  authFooter: {
    textAlign: 'center',
    marginTop: '20px',
  },
  switchModeBtn: {
    background: 'none',
    border: 'none',
    color: '#3b82f6',
    cursor: 'pointer',
    fontSize: '14px',
  },
  mainLayout: {
    display: 'flex',
    flex: 1,
    gap: '20px',
    height: '100%',
    minHeight: '0' // flex children scroll container fix
  },
  chatSection: {
    flex: 2,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: '0'
  },
  chatHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--glass-border)'
  },
  patientProfile: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  profileAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#3b82f6'
  },
  logoutBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '13px',
  },
  startSessionScreen: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    padding: '40px',
    textAlign: 'center',
    gap: '15px'
  },
  startBadge: {
    width: '90px',
    height: '90px',
    borderRadius: '50%',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '10px'
  },
  messagesList: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  messageWrapper: {
    display: 'flex',
    width: '100%'
  },
  messageBubble: {
    maxWidth: '70%',
    padding: '12px 18px',
    fontSize: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '5px'
  },
  msgTime: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.4)',
    alignSelf: 'flex-end'
  },
  speakingWaveWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '10px 15px',
    background: 'rgba(168,85,247,0.05)',
    border: '1px dashed rgba(168,85,247,0.2)',
    borderRadius: '8px',
    width: 'fit-content'
  },
  waveBar: {
    width: '3px',
    height: '15px',
    backgroundColor: '#a855f7',
    borderRadius: '2px',
    animation: 'sound-wave 1s infinite alternate'
  },
  escalatedAlert: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderTop: '1px solid rgba(239, 68, 68, 0.3)',
    display: 'flex',
    gap: '15px',
    alignItems: 'center',
    padding: '20px',
    borderRadius: '0 0 12px 12px'
  },
  chatInputBar: {
    display: 'flex',
    gap: '12px',
    padding: '16px 20px',
    borderTop: '1px solid var(--glass-border)'
  },
  micBtn: {
    border: '1px solid var(--glass-border)',
    borderRadius: '8px',
    width: '46px',
    height: '46px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  chatInput: {
    flex: 1,
    height: '46px'
  },
  clinicalCard: {
    flex: 1,
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    height: '100%',
    overflowY: 'auto'
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    borderBottom: '1px solid var(--glass-border)',
    paddingBottom: '12px'
  },
  stepperContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '8px 0'
  },
  stepIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  stepNode: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    border: '1px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 'bold'
  },
  stepLabel: {
    fontSize: '13px',
    fontWeight: '600'
  },
  cardDivider: {
    height: '1px',
    backgroundColor: 'var(--glass-border)'
  },
  cardSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  emptyText: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    fontStyle: 'italic'
  },
  tagGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px'
  },
  symptomTag: {
    fontSize: '12px',
    fontWeight: '600',
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid'
  },
  medsListContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  medicationRow: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid var(--glass-border)',
    borderRadius: '6px',
    padding: '10px 14px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '13px'
  },
  medName: {
    fontWeight: '600',
    color: '#c084fc'
  },
  medDosage: {
    color: 'var(--text-muted)'
  },
  medFreq: {
    color: 'var(--text-muted)'
  }
};
