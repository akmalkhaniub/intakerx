import React, { useState } from 'react';

interface CpotResult {
  total_score: number;
  pain_level: string;
  actionable_intervention: string;
}

interface SoapResult {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string[];
  critical_care_time_minutes: number;
}

export const TeleIcuHub: React.FC = () => {
  const [patientId] = useState<number>(1);
  const [bedNumber, setBedNumber] = useState<string>('ICU-BED-04');
  const [intensivist, setIntensivist] = useState<string>('Dr. Stone, MD, FCCM');
  const [highAcuity, setHighAcuity] = useState<boolean>(true);
  
  // CPOT Pain domain inputs
  const [facial, setFacial] = useState<number>(2); // Grimacing
  const [movements, setMovements] = useState<number>(1); // Protection
  const [tension, setTension] = useState<number>(2); // Rigid
  const [ventCompliance, setVentCompliance] = useState<number>(2); // Fighting vent

  // Ambient Scribe audio input
  const [transcript, setTranscript] = useState<string>(
    'Bedside RN: Patient is coughing and fighting the ventilator with increased peak pressures of 38 cmH2O. SpO2 dipping to 91%.\n' +
    'Intensivist: Perform inline suctioning, verify endotracheal tube depth at 22 cm at teeth, bolus fentanyl 50 mcg IV, and increase PEEP to 10.'
  );

  // States
  const [cpotResult, setCpotResult] = useState<CpotResult | null>(null);
  const [soapResult, setSoapResult] = useState<SoapResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(true);

  const evaluateCpot = async () => {
    try {
      const res = await fetch('/api/clinician/tele-icu/evaluate-cpot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facial_expression: facial,
          body_movements: movements,
          muscle_tension: tension,
          ventilator_compliance_or_vocalization: ventCompliance
        })
      });
      if (res.ok) {
        const data = await res.json();
        setCpotResult(data);
        setStatusMessage('CPOT Pain Score evaluated.');
      }
    } catch (e: any) {
      setStatusMessage('Error evaluating CPOT: ' + e.message);
    }
  };

  const extractSoap = async () => {
    try {
      const res = await fetch('/api/clinician/tele-icu/extract-soap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawTranscript: transcript,
          vitalsContext: {
            hr: 114,
            bp: '148/88',
            spo2: 91,
            temp: 38.2,
            pressor: 'Norepinephrine 0.08 mcg/kg/min'
          }
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSoapResult(data);
        setStatusMessage('Ambient conversation extracted into clinical SOAP format.');
      }
    } catch (e: any) {
      setStatusMessage('Error extracting SOAP: ' + e.message);
    }
  };

  const saveTeleIcuSession = async () => {
    try {
      const res = await fetch('/api/clinician/tele-icu/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          bed_number: bedNumber,
          virtual_intensivist_name: intensivist,
          webrtc_channel_id: `channel-${bedNumber}-${Date.now()}`,
          high_acuity_alert: highAcuity,
          cpot_pain_score: cpotResult?.total_score || 0
        })
      });
      if (res.ok) {
        setStatusMessage('Tele-ICU session synchronized to clinical registry.');
      }
    } catch (e: any) {
      setStatusMessage('Error saving Tele-ICU session: ' + e.message);
    }
  };

  const runAllCommandActions = async () => {
    await evaluateCpot();
    await extractSoap();
    await saveTeleIcuSession();
  };

  return (
    <div className="p-6 bg-slate-900 text-slate-100 rounded-xl shadow-2xl border border-slate-800 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-xl font-bold">📡 TELE-ICU</span>
            <h2 className="text-2xl font-bold tracking-tight text-white">Ambient Bedside Scribe & Tele-ICU Virtual Command</h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Real-Time WebRTC Audio/Video Telepresence, Ambient Conversation SOAP Scribe, and CPOT Critical Care Pain Scoring
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-950/80 border border-emerald-600/60 rounded-full text-xs text-emerald-300 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            WebRTC Live
          </div>
          <button
            onClick={runAllCommandActions}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-md transition-colors text-sm"
          >
            Process Ambient ICU Session
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="px-4 py-2 bg-slate-800 border border-slate-700 text-xs text-emerald-300 rounded">
          {statusMessage}
        </div>
      )}

      {/* Grid Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Telepresence Session State */}
        <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700/80 space-y-3">
          <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider">Tele-ICU Feed</h3>

          <div>
            <label className="text-xs text-slate-300 block mb-1">ICU Bed Location</label>
            <input
              type="text"
              value={bedNumber}
              onChange={(e) => setBedNumber(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-sm text-white font-mono"
            />
          </div>

          <div>
            <label className="text-xs text-slate-300 block mb-1">Virtual Intensivist</label>
            <input
              type="text"
              value={intensivist}
              onChange={(e) => setIntensivist(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-sm text-white"
            />
          </div>

          <div className="pt-2 border-t border-slate-700/60 space-y-2">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={highAcuity}
                onChange={(e) => setHighAcuity(e.target.checked)}
                className="rounded bg-slate-950 border-slate-700 text-rose-600 focus:ring-0"
              />
              Flag High-Acuity Sepsis/Shock Watchdog
            </label>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isConnected}
                onChange={(e) => setIsConnected(e.target.checked)}
                className="rounded bg-slate-950 border-slate-700 text-emerald-600 focus:ring-0"
              />
              Continuous Bi-directional Audio Bridge Active
            </label>
          </div>
        </div>

        {/* CPOT Pain Scoring */}
        <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700/80 space-y-3">
          <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider">CPOT Pain Assessment</h3>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-300 block mb-1">Facial Expression</label>
              <select
                value={facial}
                onChange={(e) => setFacial(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
              >
                <option value={0}>0: Relaxed</option>
                <option value={1}>1: Tense / Brow furrow</option>
                <option value={2}>2: Grimacing / Eye tightly closed</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-300 block mb-1">Body Movements</label>
              <select
                value={movements}
                onChange={(e) => setMovements(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
              >
                <option value={0}>0: Absence of movements</option>
                <option value={1}>1: Protection / Slow movements</option>
                <option value={2}>2: Restlessness / Pulling tubes</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-300 block mb-1">Muscle Tension</label>
              <select
                value={tension}
                onChange={(e) => setTension(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
              >
                <option value={0}>0: Relaxed</option>
                <option value={1}>1: Tense / Resistant to passive</option>
                <option value={2}>2: Rigid / Strong resistance</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-300 block mb-1">Vent Compliance</label>
              <select
                value={ventCompliance}
                onChange={(e) => setVentCompliance(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
              >
                <option value={0}>0: Tolerating ventilator</option>
                <option value={1}>1: Coughing / Asynchrony</option>
                <option value={2}>2: Fighting ventilator / Alarms</option>
              </select>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={evaluateCpot}
              className="w-full py-1.5 bg-cyan-900/60 hover:bg-cyan-800 border border-cyan-600/50 text-cyan-200 text-xs font-medium rounded"
            >
              Evaluate CPOT Score
            </button>
          </div>
        </div>

        {/* Ambient Audio Feed */}
        <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700/80 space-y-3">
          <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">Ambient Conversation Stream</h3>
          
          <div>
            <label className="text-xs text-slate-300 block mb-1">Live Multi-speaker Audio Transcript</label>
            <textarea
              rows={4}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-white font-mono leading-relaxed"
            />
          </div>

          <button
            onClick={extractSoap}
            className="w-full py-1.5 bg-amber-900/60 hover:bg-amber-800 border border-amber-600/50 text-amber-200 text-xs font-medium rounded"
          >
            Synthesize Clinical SOAP Note
          </button>
        </div>
      </div>

      {/* Output Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CPOT Pain Evaluation Card */}
        {cpotResult && (
          <div className={`p-4 rounded-lg border ${cpotResult.pain_level === 'severe' ? 'bg-rose-950/40 border-rose-600/70' : cpotResult.pain_level === 'moderate' ? 'bg-amber-950/40 border-amber-600/70' : 'bg-emerald-950/30 border-emerald-600/50'} space-y-3`}>
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-white">Critical-Care Pain Score (CPOT)</h4>
              <span className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase ${
                cpotResult.pain_level === 'severe' ? 'bg-rose-600 text-white animate-pulse' :
                cpotResult.pain_level === 'moderate' ? 'bg-amber-600 text-white' :
                'bg-emerald-600 text-white'
              }`}>
                Score {cpotResult.total_score}/8 &bull; {cpotResult.pain_level} pain
              </span>
            </div>

            <p className="text-xs text-slate-300">{cpotResult.actionable_intervention}</p>
          </div>
        )}

        {/* Ambient SOAP Note Card */}
        {soapResult && (
          <div className="p-4 bg-slate-800/80 rounded-lg border border-slate-700 space-y-3 md:col-span-2">
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
              <h4 className="font-bold text-sm text-emerald-400">Synthesized Ambient ICU Progress Note (SOAP)</h4>
              <span className="text-xs text-slate-400 font-mono">
                Attested Critical Care Time: {soapResult.critical_care_time_minutes} mins (CPT 99291)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                <div>
                  <span className="font-bold text-slate-300">SUBJECTIVE:</span>
                  <p className="text-slate-400 mt-0.5 leading-relaxed">{soapResult.subjective}</p>
                </div>
                <div>
                  <span className="font-bold text-slate-300">OBJECTIVE:</span>
                  <p className="text-slate-400 mt-0.5 leading-relaxed">{soapResult.objective}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <span className="font-bold text-slate-300">ASSESSMENT:</span>
                  <p className="text-slate-400 mt-0.5 leading-relaxed">{soapResult.assessment}</p>
                </div>
                <div>
                  <span className="font-bold text-slate-300">PLAN & ACTION ITEMS:</span>
                  <ul className="list-disc list-inside mt-0.5 space-y-1 text-slate-300">
                    {soapResult.plan.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
