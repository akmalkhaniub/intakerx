import React, { useState, useEffect } from 'react';
import {
  Mic,
  Activity,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Volume2,
  Play,
  RotateCcw,
  Sparkles,
  Zap
} from 'lucide-react';

interface ClinicalScreenFlag {
  category: 'dysphonia' | 'respiratory' | 'affective' | 'prosodic';
  marker: string;
  severity: 'low' | 'moderate' | 'high';
  finding: string;
  clinicalSignificance: string;
}

interface VoiceSession {
  id?: number;
  sessionId?: string | null;
  patientId: number;
  audioDurationSeconds: number;
  fundamentalFrequencyF0: number;
  f0StdDev: number;
  jitterPercent: number;
  shimmerPercent: number;
  hnrDb: number;
  speechRateWpm: number;
  pauseRatio: number;
  respiratoryPauseCount: number;
  affectiveTone: string;
  clinicalScreenFlags: ClinicalScreenFlag[];
  compositeScores?: {
    dysphoniaSeverityIndex: number;
    respiratoryStressIndex: number;
    psychomotorSlowingScore: number;
  };
  aiVocalSummary: string;
  createdAt?: string;
}

const PRESET_PROFILES = [
  {
    name: 'Normal Conversational Voice',
    subtitle: 'Healthy Adult Control',
    duration: 35.0,
    f0: 195.0,
    f0Sd: 26.5,
    jitter: 0.65,
    shimmer: 2.2,
    hnr: 25.2,
    wpm: 142,
    pauseRatio: 0.18,
    respPauses: 0,
    tone: 'normal_expressive',
    transcript: "Good morning doctor. I have been following the exercise plan and feeling quite well overall."
  },
  {
    name: 'Vocal Cord Dysphonia & Glottal Leakage',
    subtitle: 'Laryngeal Strain / Suspected Cord Edema',
    duration: 28.4,
    f0: 142.0,
    f0Sd: 17.5,
    jitter: 3.25,
    shimmer: 7.95,
    hnr: 10.8,
    wpm: 115,
    pauseRatio: 0.25,
    respPauses: 1,
    tone: 'normal_expressive',
    transcript: "My voice has become intensely raspy and scratchy. It hurts when I talk continuously for more than a minute."
  },
  {
    name: 'Acute COPD Dyspneic Speech Compromise',
    subtitle: 'Air Hunger & Phonation Fragmentation',
    duration: 24.0,
    f0: 218.0,
    f0Sd: 34.0,
    jitter: 1.15,
    shimmer: 3.45,
    hnr: 19.8,
    wpm: 102,
    pauseRatio: 0.46,
    respPauses: 5,
    tone: 'dyspneic_interrupted',
    transcript: "I can't... finish... a full sentence... without needing... to stop... and catch my breath..."
  },
  {
    name: 'Major Depressive Monotone Prosody',
    subtitle: 'Blunted Affect & Psychomotor Bradylalia',
    duration: 42.0,
    f0: 112.0,
    f0Sd: 8.8,
    jitter: 0.70,
    shimmer: 2.10,
    hnr: 22.0,
    wpm: 76,
    pauseRatio: 0.32,
    respPauses: 0,
    tone: 'flat_monotone',
    transcript: "I have no motivation to get up. Everything feels completely empty and gray. Nothing changes."
  }
];

export const VoiceBiomarkersConsole: React.FC = () => {
  const [sessions, setSessions] = useState<VoiceSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeSession, setActiveSession] = useState<VoiceSession | null>(null);
  const [isAudioVisualizerActive, setIsAudioVisualizerActive] = useState(false);

  // Form State
  const [patientId, setPatientId] = useState<number>(1);
  const [f0, setF0] = useState<number>(195.0);
  const [f0Sd, setF0Sd] = useState<number>(26.5);
  const [jitter, setJitter] = useState<number>(0.65);
  const [shimmer, setShimmer] = useState<number>(2.2);
  const [hnr, setHnr] = useState<number>(25.2);
  const [wpm, setWpm] = useState<number>(142);
  const [pauseRatio, setPauseRatio] = useState<number>(0.18);
  const [respPauses, setRespPauses] = useState<number>(0);
  const [duration, setDuration] = useState<number>(35.0);
  const [transcript, setTranscript] = useState<string>(PRESET_PROFILES[0].transcript);

  useEffect(() => {
    fetchSessions();
  }, [patientId]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/clinician/acoustic-biomarkers?patientId=${patientId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
        if (data.length > 0 && !activeSession) {
          setActiveSession(data[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching voice biomarker sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyPreset = (idx: number) => {
    const p = PRESET_PROFILES[idx];
    setF0(p.f0);
    setF0Sd(p.f0Sd);
    setJitter(p.jitter);
    setShimmer(p.shimmer);
    setHnr(p.hnr);
    setWpm(p.wpm);
    setPauseRatio(p.pauseRatio);
    setRespPauses(p.respPauses);
    setDuration(p.duration);
    setTranscript(p.transcript);
  };

  const handleAnalyzeVoice = async () => {
    setAnalyzing(true);
    setIsAudioVisualizerActive(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        patientId,
        audioDurationSeconds: duration,
        fundamentalFrequencyF0: f0,
        f0StdDev: f0Sd,
        jitterPercent: jitter,
        shimmerPercent: shimmer,
        hnrDb: hnr,
        speechRateWpm: wpm,
        pauseRatio,
        respiratoryPauseCount: respPauses,
        transcriptSample: transcript
      };

      const res = await fetch('/api/clinician/acoustic-biomarkers/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const saved = await res.json();
        setActiveSession(saved);
        fetchSessions();
      }
    } catch (err) {
      console.error('Failed to run voice biomarker analysis:', err);
    } finally {
      setAnalyzing(false);
      setTimeout(() => setIsAudioVisualizerActive(false), 1200);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white rounded-xl p-6 shadow-xl border border-teal-700/40">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Phase 39 Diagnostic Acoustic AI
              </span>
              <span className="text-xs text-slate-400">Harmonics / Jitter / Shimmer / Prosodic Monotonicity</span>
            </div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Mic className="h-6 w-6 text-emerald-400" />
              Acoustic Biomarkers & Voice Affect Console
            </h1>
            <p className="text-slate-300 text-sm mt-1">
              Phoniatric laryngeal stability tracking, respiratory phonation fragmentation, and psychomotor vocal affect screening.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 text-xs">
              <span className="text-slate-400">Target Patient ID:</span>
              <input
                type="number"
                value={patientId}
                onChange={(e) => setPatientId(parseInt(e.target.value, 10) || 1)}
                className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-white font-mono text-center focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button
              onClick={fetchSessions}
              disabled={loading}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 border border-slate-700 transition"
              title="Refresh Biomarker Records"
            >
              <RotateCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Grid Layout: Simulator Panel & Results Display */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Preset Selector & Acoustic Controls */}
        <div className="lg:col-span-5 space-y-6">
          {/* Preset Clinical Audio Profiles */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-400" />
                Diagnostic Audio Archetypes
              </h2>
              <span className="text-xs text-slate-400">Click to load</span>
            </div>
            <div className="space-y-2">
              {PRESET_PROFILES.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleApplyPreset(idx)}
                  className="w-full text-left p-3 rounded-lg border border-slate-700 bg-slate-900/60 hover:border-emerald-500/50 hover:bg-slate-900 transition flex items-center justify-between group"
                >
                  <div>
                    <div className="text-xs font-semibold text-white group-hover:text-emerald-300 transition">
                      {p.name}
                    </div>
                    <div className="text-[11px] text-slate-400">{p.subtitle}</div>
                  </div>
                  <Play className="h-3.5 w-3.5 text-slate-500 group-hover:text-emerald-400 transition" />
                </button>
              ))}
            </div>
          </div>

          {/* Acoustic Measurement Parameters */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-teal-400" />
              Acoustic Feature Telemetry
            </h2>

            {/* Simulated Audio Visualizer Bar */}
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-700/60">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${isAudioVisualizerActive ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'}`} />
                  {isAudioVisualizerActive ? 'Live Audio Stream Ingestion' : 'Audio Stream Ingested'}
                </span>
                <span className="font-mono text-emerald-400">{duration}s duration</span>
              </div>
              <div className="flex items-end justify-between h-12 gap-1 px-1">
                {[12, 28, 45, 80, 60, 32, 70, 95, 55, 40, 25, 68, 88, 48, 22, 60, 78, 30].map((h, i) => (
                  <div
                    key={i}
                    style={{
                      height: isAudioVisualizerActive ? `${(h * (0.8 + Math.random() * 0.4))}%` : `${h * 0.7}%`
                    }}
                    className={`flex-1 rounded-t transition-all duration-150 ${
                      isAudioVisualizerActive ? 'bg-gradient-to-t from-emerald-600 to-teal-400' : 'bg-slate-700'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Metric Sliders / Values */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-700/60">
                <div className="text-slate-400 mb-1 flex justify-between">
                  <span>Pitch (F0):</span>
                  <span className="text-white font-mono">{f0} Hz</span>
                </div>
                <input
                  type="range"
                  min="80"
                  max="300"
                  value={f0}
                  onChange={(e) => setF0(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 h-1 bg-slate-700 rounded"
                />
              </div>

              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-700/60">
                <div className="text-slate-400 mb-1 flex justify-between">
                  <span>Pitch SD:</span>
                  <span className="text-white font-mono">{f0Sd} Hz</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="50"
                  step="0.5"
                  value={f0Sd}
                  onChange={(e) => setF0Sd(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 h-1 bg-slate-700 rounded"
                />
              </div>

              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-700/60">
                <div className="text-slate-400 mb-1 flex justify-between">
                  <span>Jitter (norm &lt;1.04%):</span>
                  <span className={`font-mono ${jitter > 1.04 ? 'text-amber-400 font-bold' : 'text-emerald-400'}`}>
                    {jitter}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="6.0"
                  step="0.05"
                  value={jitter}
                  onChange={(e) => setJitter(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 h-1 bg-slate-700 rounded"
                />
              </div>

              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-700/60">
                <div className="text-slate-400 mb-1 flex justify-between">
                  <span>Shimmer (norm &lt;3.81%):</span>
                  <span className={`font-mono ${shimmer > 3.81 ? 'text-amber-400 font-bold' : 'text-emerald-400'}`}>
                    {shimmer}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="12.0"
                  step="0.1"
                  value={shimmer}
                  onChange={(e) => setShimmer(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 h-1 bg-slate-700 rounded"
                />
              </div>

              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-700/60">
                <div className="text-slate-400 mb-1 flex justify-between">
                  <span>HNR (norm &gt;20 dB):</span>
                  <span className={`font-mono ${hnr < 15 ? 'text-rose-400 font-bold' : 'text-emerald-400'}`}>
                    {hnr} dB
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="35"
                  step="0.5"
                  value={hnr}
                  onChange={(e) => setHnr(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 h-1 bg-slate-700 rounded"
                />
              </div>

              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-700/60">
                <div className="text-slate-400 mb-1 flex justify-between">
                  <span>Speech Rate:</span>
                  <span className="text-white font-mono">{wpm} WPM</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="220"
                  value={wpm}
                  onChange={(e) => setWpm(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-500 h-1 bg-slate-700 rounded"
                />
              </div>

              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-700/60">
                <div className="text-slate-400 mb-1 flex justify-between">
                  <span>Pause Ratio:</span>
                  <span className={`font-mono ${pauseRatio > 0.35 ? 'text-amber-400 font-bold' : 'text-slate-300'}`}>
                    {(pauseRatio * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.65"
                  step="0.01"
                  value={pauseRatio}
                  onChange={(e) => setPauseRatio(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 h-1 bg-slate-700 rounded"
                />
              </div>

              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-700/60">
                <div className="text-slate-400 mb-1 flex justify-between">
                  <span>Resp Pauses / Gasps:</span>
                  <span className={`font-mono ${respPauses >= 4 ? 'text-rose-400 font-bold' : 'text-slate-300'}`}>
                    {respPauses}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={respPauses}
                  onChange={(e) => setRespPauses(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-500 h-1 bg-slate-700 rounded"
                />
              </div>
            </div>

            {/* Transcript Preview */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">Ambient Phonation Transcript:</label>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={2}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 resize-none font-mono"
              />
            </div>

            {/* Ingest & Analyze Action Button */}
            <button
              onClick={handleAnalyzeVoice}
              disabled={analyzing}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg font-semibold text-xs flex items-center justify-center gap-2 shadow-lg transition disabled:opacity-50"
            >
              <Zap className="h-4 w-4" />
              {analyzing ? 'Extracting Acoustic Biomarkers...' : 'Analyze Acoustic Biomarkers & Affect'}
            </button>
          </div>
        </div>

        {/* Right Column: Diagnostic Interpretation & Session History */}
        <div className="lg:col-span-7 space-y-6">
          {activeSession ? (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl space-y-6">
              {/* Top Banner: Affective Classification & Key Indexes */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-700 pb-5">
                <div>
                  <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Classified Vocal Affect</span>
                  <div className="text-xl font-bold text-white capitalize mt-0.5 flex items-center gap-2">
                    {activeSession.affectiveTone.replace('_', ' ')}
                    {activeSession.affectiveTone === 'normal_expressive' && (
                      <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
                        Normative
                      </span>
                    )}
                    {activeSession.affectiveTone === 'dyspneic_interrupted' && (
                      <span className="px-2 py-0.5 rounded text-xs bg-rose-500/20 text-rose-400 border border-rose-500/30 font-medium">
                        Respiratory Strain
                      </span>
                    )}
                    {activeSession.affectiveTone === 'flat_monotone' && (
                      <span className="px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 font-medium">
                        Psychomotor Monotone
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-400">Analysis Session ID</span>
                  <div className="text-sm font-mono text-emerald-400 font-bold">#{activeSession.id}</div>
                </div>
              </div>

              {/* Composite Quantitative Indexes */}
              <div>
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-400" />
                  Clinical Acoustic Composite Scores (0 - 100)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-700">
                    <div className="text-xs text-slate-400 mb-1">Dysphonia Severity</div>
                    <div className="flex items-end justify-between mb-2">
                      <span className="text-lg font-bold text-white font-mono">
                        {activeSession.compositeScores?.dysphoniaSeverityIndex ?? 0}%
                      </span>
                      <span className="text-[11px] text-slate-400">Laryngeal Strain</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${(activeSession.compositeScores?.dysphoniaSeverityIndex ?? 0) > 60 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                        style={{ width: `${activeSession.compositeScores?.dysphoniaSeverityIndex ?? 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-700">
                    <div className="text-xs text-slate-400 mb-1">Respiratory Stress Index</div>
                    <div className="flex items-end justify-between mb-2">
                      <span className="text-lg font-bold text-white font-mono">
                        {activeSession.compositeScores?.respiratoryStressIndex ?? 0}%
                      </span>
                      <span className="text-[11px] text-slate-400">Phonation Dyspnea</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${(activeSession.compositeScores?.respiratoryStressIndex ?? 0) > 60 ? 'bg-rose-500' : 'bg-teal-500'}`}
                        style={{ width: `${activeSession.compositeScores?.respiratoryStressIndex ?? 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-700">
                    <div className="text-xs text-slate-400 mb-1">Psychomotor Slowing</div>
                    <div className="flex items-end justify-between mb-2">
                      <span className="text-lg font-bold text-white font-mono">
                        {activeSession.compositeScores?.psychomotorSlowingScore ?? 0}%
                      </span>
                      <span className="text-[11px] text-slate-400">Monotone / Blunting</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${(activeSession.compositeScores?.psychomotorSlowingScore ?? 0) > 60 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                        style={{ width: `${activeSession.compositeScores?.psychomotorSlowingScore ?? 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Clinical Flags List */}
              <div>
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  Actionable Clinical Alerts ({activeSession.clinicalScreenFlags.length})
                </h3>
                {activeSession.clinicalScreenFlags.length === 0 ? (
                  <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-lg flex items-center gap-2.5 text-xs text-emerald-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    <span>No acoustic biomarkers breached pathological thresholds. Laryngeal stability and phonatory prosody within normal limits.</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeSession.clinicalScreenFlags.map((flag, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border text-xs space-y-1 ${
                          flag.severity === 'high'
                            ? 'bg-rose-950/40 border-rose-800/60 text-rose-200'
                            : 'bg-amber-950/40 border-amber-800/60 text-amber-200'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span className="flex items-center gap-1.5">
                            <span className={`h-2 w-2 rounded-full ${flag.severity === 'high' ? 'bg-rose-400' : 'bg-amber-400'}`} />
                            {flag.marker}
                          </span>
                          <span className="uppercase text-[10px] tracking-wider px-2 py-0.5 rounded font-mono bg-black/40">
                            {flag.severity} risk
                          </span>
                        </div>
                        <div className="text-slate-300 text-[11px] font-mono">{flag.finding}</div>
                        <div className="text-slate-400 text-[11px] italic">{flag.clinicalSignificance}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* AI Physician Vocal Impression Summary */}
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <FileText className="h-4 w-4 text-emerald-400" />
                    Automated Phoniatric & Affective AI Impression
                  </h4>
                  <span className="text-[10px] font-mono text-slate-400">Zero-Click Documentation</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-slate-800 font-sans">
                  {activeSession.aiVocalSummary}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center text-slate-400">
              <Mic className="h-10 w-10 mx-auto text-slate-600 mb-3" />
              <div className="text-sm font-medium text-slate-300">No Voice Biomarker Session Loaded</div>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Select an audio preset archetype and trigger acoustic feature extraction to compute phoniatric stability metrics.
              </p>
            </div>
          )}

          {/* Historical Sessions Table */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>Patient Acoustic Session History ({sessions.length})</span>
              <span className="text-slate-400 font-mono text-[11px]">Patient #{patientId}</span>
            </h3>

            {sessions.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">No previous voice biomarker sessions found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400 font-semibold">
                      <th className="pb-2">Session ID</th>
                      <th className="pb-2">Vocal Affect</th>
                      <th className="pb-2">Jitter / Shimmer</th>
                      <th className="pb-2">HNR</th>
                      <th className="pb-2">Alerts</th>
                      <th className="pb-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60 text-slate-300 font-mono">
                    {sessions.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-700/30 transition">
                        <td className="py-2.5 text-emerald-400 font-bold">#{s.id}</td>
                        <td className="py-2.5 capitalize font-sans">{s.affectiveTone.replace('_', ' ')}</td>
                        <td className="py-2.5">
                          {s.jitterPercent.toFixed(2)}% / {s.shimmerPercent.toFixed(2)}%
                        </td>
                        <td className="py-2.5">{s.hnrDb.toFixed(1)} dB</td>
                        <td className="py-2.5 font-sans">
                          {s.clinicalScreenFlags.length > 0 ? (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400 font-semibold">
                              {s.clinicalScreenFlags.length} flags
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 font-semibold">
                              Normal
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-right font-sans">
                          <button
                            onClick={() => setActiveSession(s)}
                            className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-[11px] transition"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
