import React, { useState } from 'react';

interface InclusionResult {
  inclusion_criteria_met: boolean;
  eligibility_reasons: string[];
  contraindications: string[];
  recommendation: string;
}

interface TtmResult {
  cooling_phase: string;
  rewarming_rate_c_per_hr: number;
  interventions: string[];
}

export const EcprCommandHub: React.FC = () => {
  const [patientId] = useState<number>(1);
  const [age, setAge] = useState<number>(54);
  const [witnessed, setWitnessed] = useState<boolean>(true);
  const [noFlowTime, setNoFlowTime] = useState<number>(2);
  const [bystanderCprTime] = useState<number>(15);
  const [initialRhythm, setInitialRhythm] = useState<'VF' | 'pVT' | 'PEA' | 'Asystole'>('VF');
  const [etco2, setEtco2] = useState<number>(19.5);
  
  // TTM states
  const [targetTemp, setTargetTemp] = useState<33.0 | 36.0>(33.0);
  const [coreTemp, setCoreTemp] = useState<number>(33.2);
  const [coolingPhase, setCoolingPhase] = useState<'induction' | 'maintenance' | 'rewarming'>('maintenance');
  const [bsasScore, setBsasScore] = useState<number>(1);

  // Cannulation metrics
  const [cannulationTime, setCannulationTime] = useState<number>(45);
  const [ecmoFlow, setEcmoFlow] = useState<number>(3.8);

  // Results
  const [inclusionResult, setInclusionResult] = useState<InclusionResult | null>(null);
  const [ttmResult, setTtmResult] = useState<TtmResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const evaluateInclusion = async () => {
    try {
      const res = await fetch('/api/clinician/ecpr/evaluate-inclusion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_age_years: age,
          arrest_witnessed: witnessed,
          no_flow_time_minutes: noFlowTime,
          bystander_cpr_minutes: bystanderCprTime,
          initial_rhythm: initialRhythm,
          end_tidal_co2_mmhg: etco2
        })
      });
      if (res.ok) {
        const data = await res.json();
        setInclusionResult(data);
        setStatusMessage('E-CPR ELSO inclusion criteria evaluated.');
      }
    } catch (e: any) {
      setStatusMessage('Error evaluating E-CPR criteria: ' + e.message);
    }
  };

  const evaluateTtm = async () => {
    try {
      const res = await fetch('/api/clinician/ecpr/evaluate-ttm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_temperature_celsius: targetTemp,
          current_core_temperature_celsius: coreTemp,
          cooling_phase: coolingPhase,
          bsas_shivering_score: bsasScore
        })
      });
      if (res.ok) {
        const data = await res.json();
        setTtmResult(data);
        setStatusMessage('Targeted Temperature Management protocol evaluated.');
      }
    } catch (e: any) {
      setStatusMessage('Error evaluating TTM: ' + e.message);
    }
  };

  const recordEcpr = async () => {
    try {
      const res = await fetch('/api/clinician/ecpr/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          arrest_witnessed: witnessed,
          bystander_cpr_duration_minutes: bystanderCprTime,
          initial_rhythm: initialRhythm,
          end_tidal_co2_mmhg: etco2,
          arterial_ph: 7.21,
          arterial_lactate_mmol_l: 7.8,
          cannulation_time_to_flow_minutes: cannulationTime,
          va_ecmo_flow_l_min: ecmoFlow,
          target_temperature_celsius: targetTemp,
          bsas_shivering_score: bsasScore
        })
      });
      if (res.ok) {
        setStatusMessage('E-CPR resuscitation case saved to registry.');
      }
    } catch (e: any) {
      setStatusMessage('Error recording E-CPR case: ' + e.message);
    }
  };

  const runAllCommandActions = async () => {
    await evaluateInclusion();
    await evaluateTtm();
    await recordEcpr();
  };

  return (
    <div className="p-6 bg-slate-900 text-slate-100 rounded-xl shadow-2xl border border-slate-800 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2 bg-red-500/20 text-red-400 rounded-lg text-xl font-bold">⚡ E-CPR</span>
            <h2 className="text-2xl font-bold tracking-tight text-white">Extracorporeal CPR & Targeted Temperature Hub</h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            ELSO Refractory Arrest Cannulation Stopwatch, VA-ECMO Flow, and Closed-Loop TTM Shivering Suppression Protocol
          </p>
        </div>
        <button
          onClick={runAllCommandActions}
          className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg shadow-md transition-colors text-sm"
        >
          Evaluate & Record E-CPR Resuscitation
        </button>
      </div>

      {statusMessage && (
        <div className="px-4 py-2 bg-slate-800 border border-slate-700 text-xs text-red-300 rounded">
          {statusMessage}
        </div>
      )}

      {/* Grid Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Arrest & Eligibility Profile */}
        <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700/80 space-y-3">
          <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider">Arrest Presentation</h3>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-300 block">Patient Age</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-300 block">Initial Rhythm</label>
              <select
                value={initialRhythm}
                onChange={(e) => setInitialRhythm(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
              >
                <option value="VF">VF (Ventricular Fibrillation)</option>
                <option value="pVT">pVT (Pulseless VT)</option>
                <option value="PEA">PEA</option>
                <option value="Asystole">Asystole</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-300 block">No-Flow (min)</label>
              <input
                type="number"
                value={noFlowTime}
                onChange={(e) => setNoFlowTime(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
              />
              <span className="text-[10px] text-slate-400">Collapse to CPR &le; 5m</span>
            </div>
            <div>
              <label className="text-xs text-slate-300 block">End-Tidal CO2</label>
              <input
                type="number"
                step="0.5"
                value={etco2}
                onChange={(e) => setEtco2(parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
              />
              <span className="text-[10px] text-slate-400">Target &gt; 10 mmHg</span>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={witnessed}
              onChange={(e) => setWitnessed(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-red-600 focus:ring-0"
            />
            Witnessed Cardiac Arrest Confirmed
          </label>

          <button
            onClick={evaluateInclusion}
            className="w-full py-1.5 bg-red-900/60 hover:bg-red-800 border border-red-600/50 text-red-200 text-xs font-medium rounded mt-2"
          >
            Check E-CPR Inclusion
          </button>
        </div>

        {/* VA-ECMO Cannulation Stopwatch */}
        <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700/80 space-y-3">
          <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider">Cannulation & Flow Fleet</h3>

          <div>
            <label className="text-xs text-slate-300 block mb-1">Time to ECMO Flow (minutes from collapse)</label>
            <input
              type="number"
              value={cannulationTime}
              onChange={(e) => setCannulationTime(parseInt(e.target.value, 10))}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono"
            />
            <span className="text-[10px] text-slate-400">ELSO target: Flow achieved &lt; 60 minutes</span>
          </div>

          <div>
            <label className="text-xs text-slate-300 block mb-1">VA-ECMO Pump Flow (L/min)</label>
            <input
              type="number"
              step="0.1"
              value={ecmoFlow}
              onChange={(e) => setEcmoFlow(parseFloat(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
            />
          </div>

          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Mechanical CPR:</span>
              <span className="font-semibold text-emerald-400">LUCAS 3 Synchronized</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Cannulation Site:</span>
              <span className="font-semibold text-white">Percutaneous Femoral V/A</span>
            </div>
          </div>
        </div>

        {/* TTM Protocol Inputs */}
        <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700/80 space-y-3">
          <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider">Targeted Temperature Management</h3>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-300 block mb-1">Target Temp</label>
              <select
                value={targetTemp}
                onChange={(e) => setTargetTemp(parseFloat(e.target.value) as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
              >
                <option value={33.0}>33.0°C (Hypothermia)</option>
                <option value={36.0}>36.0°C (Normothermia)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-300 block mb-1">Current Core Temp</label>
              <input
                type="number"
                step="0.1"
                value={coreTemp}
                onChange={(e) => setCoreTemp(parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-300 block mb-1">Phase</label>
              <select
                value={coolingPhase}
                onChange={(e) => setCoolingPhase(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
              >
                <option value="induction">Induction</option>
                <option value="maintenance">Maintenance (24h)</option>
                <option value="rewarming">Rewarming (0.25°/h)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-300 block mb-1">BSAS Shivering</label>
              <select
                value={bsasScore}
                onChange={(e) => setBsasScore(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
              >
                <option value={0}>0: None</option>
                <option value={1}>1: Mild (neck/chest)</option>
                <option value={2}>2: Moderate (upper limb)</option>
                <option value={3}>3: Severe (generalized)</option>
              </select>
            </div>
          </div>

          <button
            onClick={evaluateTtm}
            className="w-full py-1.5 bg-blue-900/60 hover:bg-blue-800 border border-blue-600/50 text-blue-200 text-xs font-medium rounded mt-2"
          >
            Evaluate TTM Protocol
          </button>
        </div>
      </div>

      {/* Decision Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Inclusion Card */}
        {inclusionResult && (
          <div className={`p-4 rounded-lg border ${inclusionResult.inclusion_criteria_met ? 'bg-emerald-950/40 border-emerald-600/70' : 'bg-rose-950/40 border-rose-600/70'} space-y-3`}>
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-white">E-CPR Eligibility Decision</h4>
              <span className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase ${inclusionResult.inclusion_criteria_met ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                {inclusionResult.inclusion_criteria_met ? 'CANDIDATE ELIGIBLE' : 'NOT ELIGIBLE'}
              </span>
            </div>

            <p className="text-xs text-slate-300 font-medium">{inclusionResult.recommendation}</p>

            {inclusionResult.contraindications.length > 0 && (
              <div className="pt-2 border-t border-slate-700/60">
                <span className="text-[11px] font-semibold text-rose-300">Exclusion Flags:</span>
                <ul className="text-xs text-slate-300 space-y-1 mt-1">
                  {inclusionResult.contraindications.map((c, i) => (
                    <li key={i}>&bull; {c}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* TTM Card */}
        {ttmResult && (
          <div className="p-4 bg-slate-800/80 rounded-lg border border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-white">Targeted Temperature Management</h4>
              <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase bg-blue-600 text-white">
                {ttmResult.cooling_phase}
              </span>
            </div>

            <ul className="text-xs text-slate-300 space-y-1">
              {ttmResult.interventions.map((inv, i) => (
                <li key={i}>&bull; {inv}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
