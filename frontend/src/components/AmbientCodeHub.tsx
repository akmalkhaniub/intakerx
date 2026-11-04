import React, { useState, useEffect, useRef } from 'react';

interface AmbientSession {
  id: number;
  patientId: number;
  bedNumber: number;
  codeType: string;
  codeLeader: string;
  codeRecorder: string;
  startedAt: string;
  endedAt?: string;
  isActive: boolean;
  totalEpinephrineMg: number;
  totalDefibrillations: number;
  roscAchieved: boolean;
  pmcsPerformed: boolean;
  mtpUnitsPrbc: number;
  mtpUnitsFfp: number;
  mtpUnitsPlatelets: number;
  debriefSummary?: string;
}

interface ResusEvent {
  id?: number;
  sessionId: number;
  elapsedSeconds: number;
  eventType: string;
  utteranceText: string;
  structuredPayload: Record<string, any>;
  speakerRole: string;
  createdAt?: string;
}

export const AmbientCodeHub: React.FC = () => {
  const [session, setSession] = useState<AmbientSession | null>(null);
  const [events, setEvents] = useState<ResusEvent[]>([]);
  const [codeType, setCodeType] = useState<string>('MATERNAL_CODE_PMCS');
  const [bedNumber, setBedNumber] = useState<number>(1);
  const [codeLeader, setCodeLeader] = useState<string>('Dr. Sarah Connor, MD');
  const [codeRecorder, setCodeRecorder] = useState<string>('RN Michael Scott');
  const [customUtterance, setCustomUtterance] = useState<string>('');
  const [speakerRole, setSpeakerRole] = useState<string>('CODE_LEADER');
  const [lastVoiceAnswer, setLastVoiceAnswer] = useState<string>('');
  const [activeAlert, setActiveAlert] = useState<string>('');
  const [elapsedDisplay, setElapsedDisplay] = useState<string>('00:00');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'live_hud' | 'debrief'>('live_hud');

  const recognitionRef = useRef<any>(null);
  const sseRef = useRef<EventSource | null>(null);

  // Timer loop for stopwatch
  useEffect(() => {
    if (!session || !session.isActive) return;

    const interval = setInterval(() => {
      const startMs = new Date(session.startedAt).getTime();
      const diffSecs = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      const mins = Math.floor(diffSecs / 60);
      const secs = diffSecs % 60;
      setElapsedDisplay(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [session]);

  // SSE Stream
  useEffect(() => {
    const es = new EventSource('/api/clinician/ambient-code/stream');
    sseRef.current = es;

    es.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.session && payload.event) {
          setSession(payload.session);
          setEvents(prev => [...prev, payload.event]);
          if (payload.voiceAnswer) {
            setLastVoiceAnswer(payload.voiceAnswer);
            speak(payload.voiceAnswer);
          }
          if (payload.activeAlert) {
            setActiveAlert(payload.activeAlert);
          }
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    return () => es.close();
  }, []);

  // Web Speech API initialization
  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Web Speech API is not supported in this browser. You can use the Quick Audio Utterance buttons below.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (e: any) => console.error('Speech recognition error:', e);

    recognition.onresult = (event: any) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      if (transcript && session) {
        handleProcessUtterance(transcript, 'AMBIENT_MIC');
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.05;
      utter.pitch = 1.0;
      window.speechSynthesis.speak(utter);
    }
  };

  // Start Code Session
  const handleStartCode = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/ambient-code/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: bedNumber, bedNumber, codeLeader, codeRecorder, codeType })
      });
      if (res.ok) {
        const data = await res.json();
        setSession(data.session);
        setEvents([]);
        setActiveAlert('');
        setLastVoiceAnswer('');
        speak(`Code Blue initiated on Bed ${bedNumber}. Scribe active.`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Process Utterance
  const handleProcessUtterance = async (text: string, role: string = speakerRole) => {
    if (!session || !text.trim()) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/clinician/ambient-code/session/${session.id}/utterance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ utteranceText: text, speakerRole: role })
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(prev => [...prev, data.event]);
        if (data.voiceAnswer) {
          setLastVoiceAnswer(data.voiceAnswer);
          speak(data.voiceAnswer);
        }
        if (data.activeAlert) {
          setActiveAlert(data.activeAlert);
        }
        setCustomUtterance('');
        // Refresh session tallies
        const sessRes = await fetch(`/api/clinician/ambient-code/session/${session.id}`);
        if (sessRes.ok) {
          const sessData = await sessRes.json();
          setSession(sessData.session);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Stop Code
  const handleStopCode = async () => {
    if (!session) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/clinician/ambient-code/session/${session.id}/stop`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSession(data.session);
        setActiveTab('debrief');
        speak(`Code event concluded. Legal debrief record generated.`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getEventBadgeColor = (type: string) => {
    switch (type) {
      case 'RHYTHM_CHECK': return '#38bdf8';
      case 'DEFIBRILLATION': return '#ef4444';
      case 'MEDICATION_GIVEN': return '#10b981';
      case 'PROCEDURE_PERFORMED': return '#f59e0b';
      case 'MTP_BLOOD_HANG': return '#ec4899';
      case 'ROSC_ACHIEVED': return '#22c55e';
      case 'VOICE_QUERY_RESOLVED': return '#a855f7';
      default: return '#64748b';
    }
  };

  return (
    <div style={{ backgroundColor: '#0f172a', color: '#f8fafc', padding: '24px', borderRadius: '12px', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '16px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px', color: '#ec4899', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🎙️</span> Ambient Code-Resuscitation Audio Scribe & Bedside Voice HUD
          </h2>
          <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '14px' }}>
            Hands-Free Continuous Resuscitation Audio Parser • AHA ACLS Multi-Modal Debrief Generator
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('live_hud')}
            style={{
              backgroundColor: activeTab === 'live_hud' ? '#ec4899' : '#1e293b',
              color: activeTab === 'live_hud' ? '#ffffff' : '#cbd5e1',
              fontWeight: 'bold',
              border: 'none',
              padding: '8px 14px',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            🫀 Live Code HUD
          </button>
          <button
            onClick={() => setActiveTab('debrief')}
            style={{
              backgroundColor: activeTab === 'debrief' ? '#ec4899' : '#1e293b',
              color: activeTab === 'debrief' ? '#ffffff' : '#cbd5e1',
              fontWeight: 'bold',
              border: 'none',
              padding: '8px 14px',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            📋 Legal Code Debrief
          </button>
        </div>
      </div>

      {/* Code Status HUD Ribbon */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px', marginBottom: '20px' }}>
        {/* Stopwatch Card */}
        <div style={{ backgroundColor: '#1e293b', padding: '14px', borderRadius: '8px', borderLeft: '4px solid #ec4899', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>ELAPSED RESUSCITATION TIME</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: session?.isActive ? '#ec4899' : '#64748b', fontFamily: 'monospace' }}>
            {session?.isActive ? elapsedDisplay : '00:00'}
          </div>
          <div style={{ fontSize: '11px', color: session?.isActive ? '#22c55e' : '#94a3b8' }}>
            {session?.isActive ? '● CODE BLUE ACTIVE' : 'NO ACTIVE CODE'}
          </div>
        </div>

        {/* Epinephrine Tally */}
        <div style={{ backgroundColor: '#1e293b', padding: '14px', borderRadius: '8px', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>TOTAL EPINEPHRINE GIVEN</div>
          <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#10b981' }}>
            {session?.totalEpinephrineMg ?? 0} mg
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>1mg IV push / q3-5m</div>
        </div>

        {/* Defibrillation Shocks */}
        <div style={{ backgroundColor: '#1e293b', padding: '14px', borderRadius: '8px', borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>DEFIBRILLATION SHOCKS</div>
          <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#ef4444' }}>
            {session?.totalDefibrillations ?? 0}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>200J Biphasic</div>
        </div>

        {/* MTP Blood Transfused */}
        <div style={{ backgroundColor: '#1e293b', padding: '14px', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>MTP BLOOD PRODUCTS</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#f59e0b', marginTop: '4px' }}>
            {session?.mtpUnitsPrbc ?? 0} : {session?.mtpUnitsFfp ?? 0} : {session?.mtpUnitsPlatelets ?? 0}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>PRBC : FFP : PLT (1:1:1)</div>
        </div>

        {/* ROSC / PMCS Sentinel */}
        <div style={{ backgroundColor: '#1e293b', padding: '14px', borderRadius: '8px', borderLeft: '4px solid #38bdf8' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>CRITICAL SENTINELS</div>
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '6px' }}>
            {session?.roscAchieved ? (
              <span style={{ color: '#22c55e' }}>✅ ROSC ACHIEVED</span>
            ) : (
              <span style={{ color: '#ef4444' }}>⏳ CPR In Progress</span>
            )}
          </div>
          {session?.pmcsPerformed && (
            <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 'bold', marginTop: '2px' }}>
              👶 PMCS DELIVERED
            </div>
          )}
        </div>
      </div>

      {/* Critical Alert Banner */}
      {activeAlert && (
        <div style={{ backgroundColor: '#7f1d1d', border: '1px solid #ef4444', padding: '12px 16px', borderRadius: '6px', color: '#fca5a5', fontSize: '14px', fontWeight: 'bold', marginBottom: '20px' }}>
          {activeAlert}
        </div>
      )}

      {/* Voice HUD Audio Answer Bubble */}
      {lastVoiceAnswer && (
        <div style={{ backgroundColor: 'rgba(168, 85, 247, 0.15)', border: '1px solid #a855f7', padding: '12px 16px', borderRadius: '6px', color: '#e9d5ff', fontSize: '14px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>🔊</span>
          <div>
            <div style={{ fontSize: '11px', color: '#c084fc', fontWeight: 'bold' }}>INTAKERX BEDSIDE VOICE HUD ANSWER:</div>
            <div style={{ fontWeight: 600 }}>{lastVoiceAnswer}</div>
          </div>
        </div>
      )}

      {activeTab === 'live_hud' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
          {/* Left Column: Scribe Controls & Quick Resuscitation Actions */}
          <div>
            {/* Session Controller Box */}
            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#cbd5e1' }}>Code Blue Session Controller</h3>
                {session?.isActive ? (
                  <button
                    onClick={handleStopCode}
                    disabled={isLoading}
                    style={{ backgroundColor: '#ef4444', color: '#ffffff', fontWeight: 'bold', border: 'none', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    ⏹ Conclude Code Blue
                  </button>
                ) : (
                  <button
                    onClick={handleStartCode}
                    disabled={isLoading}
                    style={{ backgroundColor: '#ec4899', color: '#ffffff', fontWeight: 'bold', border: 'none', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    🚨 INITIATE CODE BLUE
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '12px' }}>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', marginBottom: '4px' }}>CODE PROTOCOL TYPE</label>
                  <select
                    value={codeType}
                    onChange={(e) => setCodeType(e.target.value)}
                    disabled={session?.isActive}
                    style={{ width: '100%', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }}
                  >
                    <option value="MATERNAL_CODE_PMCS">Maternal Cardiac Arrest & PMCS (Phase 96)</option>
                    <option value="CARDIAC_ARREST_ACLS">Standard Adult ACLS Cardiac Arrest</option>
                    <option value="TRAUMA_MTP_EXSANGUINATION">Trauma Exsanguination & MTP (Phase 98)</option>
                    <option value="SEISMIC_SURGE_CODE">Disaster Surge Multi-Organ Code</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', color: '#94a3b8', marginBottom: '4px' }}>ICU BED LOCATION</label>
                  <select
                    value={bedNumber}
                    onChange={(e) => setBedNumber(Number(e.target.value))}
                    disabled={session?.isActive}
                    style={{ width: '100%', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }}
                  >
                    <option value={1}>Bed #1: Elena Rostova (Maternal Code)</option>
                    <option value={2}>Bed #2: Marcus Vance (Aorta Dissection)</option>
                    <option value={3}>Bed #3: Sophia Lin (Severe Preeclampsia)</option>
                    <option value={4}>Bed #4: David Miller (Burn Shock 45% TBSA)</option>
                    <option value={5}>Bed #5: Rachel Green (Status Asthmaticus)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', color: '#94a3b8', marginBottom: '4px' }}>CODE LEADER</label>
                  <input
                    type="text"
                    value={codeLeader}
                    onChange={(e) => setCodeLeader(e.target.value)}
                    disabled={session?.isActive}
                    style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', color: '#94a3b8', marginBottom: '4px' }}>CODE RECORDER</label>
                  <input
                    type="text"
                    value={codeRecorder}
                    onChange={(e) => setCodeRecorder(e.target.value)}
                    disabled={session?.isActive}
                    style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }}
                  />
                </div>
              </div>
            </div>

            {/* Ambient Speech Recognition & Mic Toggle */}
            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#cbd5e1' }}>HANDS-FREE AMBIENT MICROPHONE</span>
                <button
                  onClick={toggleListening}
                  style={{
                    backgroundColor: isListening ? '#ef4444' : '#10b981',
                    color: '#ffffff',
                    fontWeight: 'bold',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>{isListening ? '🔴' : '🎤'}</span>
                  {isListening ? 'MIC LISTENING (Speak now)' : 'ENABLE AMBIENT MIC'}
                </button>
              </div>

              {/* Custom Utterance Input */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <input
                  type="text"
                  value={customUtterance}
                  onChange={(e) => setCustomUtterance(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleProcessUtterance(customUtterance)}
                  placeholder="Type or speak resuscitation verbal order..."
                  style={{ flex: 1, backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '8px 12px', borderRadius: '6px', fontSize: '13px' }}
                />
                <select
                  value={speakerRole}
                  onChange={(e) => setSpeakerRole(e.target.value)}
                  style={{ backgroundColor: '#0f172a', color: '#cbd5e1', border: '1px solid #334155', padding: '8px', borderRadius: '6px', fontSize: '12px' }}
                >
                  <option value="CODE_LEADER">Code Leader</option>
                  <option value="AIRWAY">Airway Team</option>
                  <option value="MED_NURSE">Medication RN</option>
                  <option value="SURGEON">OB/Trauma Surgeon</option>
                </select>
                <button
                  onClick={() => handleProcessUtterance(customUtterance)}
                  disabled={isLoading || !session?.isActive}
                  style={{ backgroundColor: '#ec4899', color: '#ffffff', fontWeight: 'bold', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                >
                  Log
                </button>
              </div>
            </div>

            {/* Quick Simulated Audio Actions */}
            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '16px' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold', marginBottom: '8px' }}>
                QUICK CLINICAL RESUSCITATION ACTIONS (Simulate Spoken Vernacular):
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                <button
                  onClick={() => handleProcessUtterance('Two minutes elapsed, rhythm check: PEA', 'CODE_LEADER')}
                  disabled={!session?.isActive}
                  style={{ backgroundColor: '#0f172a', color: '#38bdf8', border: '1px solid #38bdf855', padding: '8px', borderRadius: '4px', fontSize: '12px', textAlign: 'left', cursor: 'pointer' }}
                >
                  🩺 "Rhythm check: PEA"
                </button>
                <button
                  onClick={() => handleProcessUtterance('Shock delivered at 200 Joules biphasic', 'CODE_TEAM')}
                  disabled={!session?.isActive}
                  style={{ backgroundColor: '#0f172a', color: '#ef4444', border: '1px solid #ef444455', padding: '8px', borderRadius: '4px', fontSize: '12px', textAlign: 'left', cursor: 'pointer' }}
                >
                  ⚡ "Shock delivered 200J"
                </button>
                <button
                  onClick={() => handleProcessUtterance('Epinephrine 1 milligram IV push given and flushed', 'MED_NURSE')}
                  disabled={!session?.isActive}
                  style={{ backgroundColor: '#0f172a', color: '#10b981', border: '1px solid #10b98155', padding: '8px', borderRadius: '4px', fontSize: '12px', textAlign: 'left', cursor: 'pointer' }}
                >
                  💉 "Epi 1mg IV push given"
                </button>
                <button
                  onClick={() => handleProcessUtterance('Amiodarone 300 milligrams IV push administered', 'MED_NURSE')}
                  disabled={!session?.isActive}
                  style={{ backgroundColor: '#0f172a', color: '#10b981', border: '1px solid #10b98155', padding: '8px', borderRadius: '4px', fontSize: '12px', textAlign: 'left', cursor: 'pointer' }}
                >
                  🧪 "Amiodarone 300mg given"
                </button>
                <button
                  onClick={() => handleProcessUtterance('Manual LUD applied on flat backboard to relieve aortocaval compression', 'CODE_TEAM')}
                  disabled={!session?.isActive}
                  style={{ backgroundColor: '#0f172a', color: '#f59e0b', border: '1px solid #f59e0b55', padding: '8px', borderRadius: '4px', fontSize: '12px', textAlign: 'left', cursor: 'pointer' }}
                >
                  👶 "Manual LUD applied"
                </button>
                <button
                  onClick={() => handleProcessUtterance('Minute 4 reached without ROSC. Scalpel in hand, PMCS hysterotomy started!', 'SURGEON')}
                  disabled={!session?.isActive}
                  style={{ backgroundColor: '#0f172a', color: '#f59e0b', border: '1px solid #f59e0b55', padding: '8px', borderRadius: '4px', fontSize: '12px', textAlign: 'left', cursor: 'pointer' }}
                >
                  🔪 "Scalpel in hand, PMCS started!"
                </button>
                <button
                  onClick={() => handleProcessUtterance('Pack 1 MTP hanging: 4 units PRBC, 4 units FFP, 1 pack platelets', 'MED_NURSE')}
                  disabled={!session?.isActive}
                  style={{ backgroundColor: '#0f172a', color: '#ec4899', border: '1px solid #ec489955', padding: '8px', borderRadius: '4px', fontSize: '12px', textAlign: 'left', cursor: 'pointer' }}
                >
                  🩸 "Pack 1 MTP hanging (4:4:1)"
                </button>
                <button
                  onClick={() => handleProcessUtterance('Palpable femoral and carotid pulse returned! We have ROSC, BP 94/58', 'CODE_LEADER')}
                  disabled={!session?.isActive}
                  style={{ backgroundColor: '#0f172a', color: '#22c55e', border: '1px solid #22c55e55', padding: '8px', borderRadius: '4px', fontSize: '12px', textAlign: 'left', cursor: 'pointer' }}
                >
                  🫀 "Palpable pulse, ROSC!"
                </button>
              </div>

              {/* Voice HUD Query Bar */}
              <div style={{ marginTop: '14px', borderTop: '1px solid #334155', paddingTop: '10px' }}>
                <span style={{ fontSize: '11px', color: '#a855f7', fontWeight: 'bold' }}>BEDSIDE VOICE HUD QUERIES:</span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                  <button
                    onClick={() => handleProcessUtterance('IntakeRx, what is the elapsed code time?', 'CODE_LEADER')}
                    disabled={!session?.isActive}
                    style={{ backgroundColor: '#581c87', color: '#f3e8ff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                  >
                    🗣️ "IntakeRx, elapsed code time?"
                  </button>
                  <button
                    onClick={() => handleProcessUtterance('IntakeRx, when was the last epinephrine given?', 'CODE_LEADER')}
                    disabled={!session?.isActive}
                    style={{ backgroundColor: '#581c87', color: '#f3e8ff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                  >
                    🗣️ "IntakeRx, last epinephrine dose?"
                  </button>
                  <button
                    onClick={() => handleProcessUtterance('IntakeRx, what is the current MTP blood ratio?', 'CODE_LEADER')}
                    disabled={!session?.isActive}
                    style={{ backgroundColor: '#581c87', color: '#f3e8ff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                  >
                    🗣️ "IntakeRx, MTP blood ratio?"
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Live Chronological Resuscitation Event Log */}
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#cbd5e1' }}>
              Chronological Resuscitation Timeline ({events.length} Events)
            </h3>

            <div style={{ flex: 1, maxHeight: '550px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {events.length === 0 ? (
                <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>
                  No resuscitation events recorded yet. Initiate Code Blue to begin ambient scribing.
                </div>
              ) : (
                events.map((e, idx) => {
                  const mins = Math.floor(e.elapsedSeconds / 60);
                  const secs = e.elapsedSeconds % 60;
                  const timeStr = `+${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                  const badgeColor = getEventBadgeColor(e.eventType);

                  return (
                    <div
                      key={idx}
                      style={{
                        backgroundColor: '#0f172a',
                        borderLeft: `3px solid ${badgeColor}`,
                        padding: '10px',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontFamily: 'monospace', color: '#94a3b8', fontWeight: 'bold' }}>{timeStr}</span>
                        <span style={{ backgroundColor: `${badgeColor}22`, color: badgeColor, padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                          {e.eventType}
                        </span>
                      </div>
                      <div style={{ color: '#f8fafc', fontWeight: 500, margin: '2px 0' }}>{e.utteranceText}</div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>Speaker: {e.speakerRole}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Legal Resuscitation Debrief */}
      {activeTab === 'debrief' && (
        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#ec4899' }}>
              Legal Resuscitation Code Event Record & Debrief
            </h3>
            {session?.debriefSummary && (
              <button
                onClick={() => navigator.clipboard.writeText(session.debriefSummary || '')}
                style={{ backgroundColor: '#334155', color: '#cbd5e1', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
              >
                📋 Copy Debrief Markdown
              </button>
            )}
          </div>

          {session?.debriefSummary ? (
            <pre style={{ backgroundColor: '#090d16', padding: '16px', borderRadius: '8px', color: '#f8fafc', fontSize: '13px', whiteSpace: 'pre-wrap', lineHeight: 1.5, maxHeight: '600px', overflowY: 'auto' }}>
              {session.debriefSummary}
            </pre>
          ) : (
            <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>
              Debrief record will generate automatically upon concluding the active Code Blue session.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
