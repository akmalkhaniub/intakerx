import React, { useState } from 'react';

interface AutoregulationResult {
  mean_icp_mmhg: number;
  map_mmhg: number;
  cpp_mmhg: number;
  prx_autoregulation_index: number;
  autoregulation_status: string;
  optimal_cpp_target_mmhg: number;
  clinical_recommendations: string[];
}

interface MetabolismResult {
  pbto2_brain_oxygen_mmhg?: number;
  lactate_pyruvate_ratio?: number;
  hypoxia_detected: boolean;
  cellular_energy_crisis_detected: boolean;
  metabolic_alerts: string[];
}

interface VasospasmResult {
  lindegaard_ratio: number;
  vasospasm_severity: string;
  interventions: string[];
}

interface EegResult {
  burst_suppression_ratio_percent: number;
  sedation_depth_adequate: boolean;
  recommendations: string[];
}

export const NeuroCritHub: React.FC = () => {
  const [patientId] = useState<number>(1);
  const [diagnosis, setDiagnosis] = useState<string>('Severe Traumatic Brain Injury');
  
  // Hemodynamics & ICP
  const [icp, setIcp] = useState<number>(24.0);
  const [map, setMap] = useState<number>(86.0);
  const [prx, setPrx] = useState<number>(0.42);

  // Multimodal Metabolism
  const [pbto2, setPbto2] = useState<number>(13.5);
  const [lpr, setLpr] = useState<number>(44.0);

  // TCD Vasospasm
  const [mcaVelocity, setMcaVelocity] = useState<number>(210);
  const [icaVelocity, setIcaVelocity] = useState<number>(30);

  // EEG Burst Suppression
  const [salzburgMet, setSalzburgMet] = useState<boolean>(true);
  const [burstRatio, setBurstRatio] = useState<number>(75);

  // Evaluation states
  const [autoResult, setAutoResult] = useState<AutoregulationResult | null>(null);
  const [metabResult, setMetabResult] = useState<MetabolismResult | null>(null);
  const [spasmResult, setSpasmResult] = useState<VasospasmResult | null>(null);
  const [eegResult, setEegResult] = useState<EegResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const evaluateAutoregulation = async () => {
    try {
      const res = await fetch('/api/clinician/neurocrit/evaluate-autoregulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mean_icp_mmhg: icp,
          map_mmhg: map,
          prx_autoregulation_index: prx
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAutoResult(data);
        setStatusMessage('Cerebral autoregulation & PRx index evaluated.');
      }
    } catch (e: any) {
      setStatusMessage('Error evaluating autoregulation: ' + e.message);
    }
  };

  const evaluateMetabolism = async () => {
    try {
      const res = await fetch('/api/clinician/neurocrit/evaluate-metabolism', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pbto2_brain_oxygen_mmhg: pbto2,
          lactate_pyruvate_ratio: lpr
        })
      });
      if (res.ok) {
        const data = await res.json();
        setMetabResult(data);
        setStatusMessage('Multimodal PbtO2 / LPR metabolism evaluated.');
      }
    } catch (e: any) {
      setStatusMessage('Error evaluating metabolism: ' + e.message);
    }
  };

  const evaluateVasospasm = async () => {
    try {
      const res = await fetch('/api/clinician/neurocrit/evaluate-sah-vasospasm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mca_mean_velocity_cm_s: mcaVelocity,
          ica_mean_velocity_cm_s: icaVelocity
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSpasmResult(data);
        setStatusMessage('TCD Lindegaard vasospasm evaluated.');
      }
    } catch (e: any) {
      setStatusMessage('Error evaluating vasospasm: ' + e.message);
    }
  };

  const evaluateEeg = async () => {
    try {
      const res = await fetch('/api/clinician/neurocrit/evaluate-eeg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salzburg_criteria_met: salzburgMet,
          burst_suppression_ratio_percent: burstRatio
        })
      });
      if (res.ok) {
        const data = await res.json();
        setEegResult(data);
        setStatusMessage('Status epilepticus continuous EEG evaluated.');
      }
    } catch (e: any) {
      setStatusMessage('Error evaluating EEG: ' + e.message);
    }
  };

  const saveMonitoringSession = async () => {
    try {
      const res = await fetch('/api/clinician/neurocrit/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          diagnosis_category: diagnosis,
          mean_icp_mmhg: icp,
          map_mmhg: map,
          prx_autoregulation_index: prx,
          pbto2_brain_oxygen_mmhg: pbto2,
          lactate_pyruvate_ratio: lpr,
          eeg_burst_suppression_ratio: burstRatio
        })
      });
      if (res.ok) {
        setStatusMessage('Neurocritical monitoring telemetry recorded to database.');
      }
    } catch (e: any) {
      setStatusMessage('Error recording session: ' + e.message);
    }
  };

  const runAllEvaluations = async () => {
    await evaluateAutoregulation();
    await evaluateMetabolism();
    await evaluateVasospasm();
    await evaluateEeg();
    await saveMonitoringSession();
  };

  return (
    <div className="p-6 bg-slate-900 text-slate-100 rounded-xl shadow-2xl border border-slate-800 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2 bg-purple-500/20 text-purple-400 rounded-lg text-xl font-bold">🧠 NEURO-CRIT</span>
            <h2 className="text-2xl font-bold tracking-tight text-white">Acute Neurological Resuscitation & Multimodal Fleet</h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            ICP/CPP Autoregulation (PRx), Brain Oxygenation ($PbtO_2$), TCD Lindegaard Ratio, and Status Epilepticus Burst Suppression
          </p>
        </div>
        <button
          onClick={runAllEvaluations}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg shadow-md transition-colors text-sm"
        >
          Execute Comprehensive Neuro Assessment
        </button>
      </div>

      {statusMessage && (
        <div className="px-4 py-2 bg-slate-800 border border-slate-700 text-xs text-purple-300 rounded">
          {statusMessage}
        </div>
      )}

      {/* Input Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* ICP & Autoregulation */}
        <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700/80 space-y-3">
          <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider">ICP & CPP Autoregulation</h3>

          <div>
            <label className="text-xs text-slate-300 block mb-1">Diagnosis</label>
            <input
              type="text"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-300 block">ICP (mmHg)</label>
              <input
                type="number"
                step="0.5"
                value={icp}
                onChange={(e) => setIcp(parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-300 block">MAP (mmHg)</label>
              <input
                type="number"
                step="1"
                value={map}
                onChange={(e) => setMap(parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-300 block">PRx Index (-1.0 to +1.0)</label>
            <input
              type="number"
              step="0.05"
              value={prx}
              onChange={(e) => setPrx(parseFloat(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
            />
          </div>

          <button
            onClick={evaluateAutoregulation}
            className="w-full py-1 bg-purple-900/60 hover:bg-purple-800 border border-purple-600/50 text-purple-200 text-xs font-medium rounded"
          >
            Evaluate PRx & CPP
          </button>
        </div>

        {/* Brain Oxygenation & Microdialysis */}
        <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700/80 space-y-3">
          <h3 className="text-sm font-semibold text-rose-400 uppercase tracking-wider">Brain Tissue Metabolism</h3>

          <div>
            <label className="text-xs text-slate-300 block">PbtO2 Brain Oxygen (mmHg)</label>
            <input
              type="number"
              step="0.5"
              value={pbto2}
              onChange={(e) => setPbto2(parseFloat(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
            />
            <span className="text-[10px] text-slate-400">Target &gt; 20 mmHg</span>
          </div>

          <div>
            <label className="text-xs text-slate-300 block">Lactate/Pyruvate Ratio (LPR)</label>
            <input
              type="number"
              step="1"
              value={lpr}
              onChange={(e) => setLpr(parseFloat(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
            />
            <span className="text-[10px] text-slate-400">Energy Crisis threshold &gt; 40</span>
          </div>

          <button
            onClick={evaluateMetabolism}
            className="w-full py-1 bg-rose-900/60 hover:bg-rose-800 border border-rose-600/50 text-rose-200 text-xs font-medium rounded mt-2"
          >
            Check Neurometabolism
          </button>
        </div>

        {/* TCD & Vasospasm */}
        <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700/80 space-y-3">
          <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider">TCD Lindegaard Ratio</h3>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-300 block">MCA Velocity</label>
              <input
                type="number"
                value={mcaVelocity}
                onChange={(e) => setMcaVelocity(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-300 block">ICA Velocity</label>
              <input
                type="number"
                value={icaVelocity}
                onChange={(e) => setIcaVelocity(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
              />
            </div>
          </div>

          <div className="text-[10px] text-slate-400">
            Lindegaard Ratio = MCA / ICA. Severe vasospasm if LR &gt; 6.
          </div>

          <button
            onClick={evaluateVasospasm}
            className="w-full py-1 bg-cyan-900/60 hover:bg-cyan-800 border border-cyan-600/50 text-cyan-200 text-xs font-medium rounded mt-2"
          >
            Calculate Lindegaard
          </button>
        </div>

        {/* Continuous EEG & Burst Suppression */}
        <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700/80 space-y-3">
          <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">cEEG Status Epilepticus</h3>

          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={salzburgMet}
              onChange={(e) => setSalzburgMet(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-amber-600 focus:ring-0"
            />
            Salzburg Criteria NCSE Met
          </label>

          <div>
            <label className="text-xs text-slate-300 block">Burst Suppression Ratio (%)</label>
            <input
              type="number"
              value={burstRatio}
              onChange={(e) => setBurstRatio(parseInt(e.target.value, 10))}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
            />
            <span className="text-[10px] text-slate-400">Therapeutic target &ge; 80%</span>
          </div>

          <button
            onClick={evaluateEeg}
            className="w-full py-1 bg-amber-900/60 hover:bg-amber-800 border border-amber-600/50 text-amber-200 text-xs font-medium rounded mt-2"
          >
            Evaluate cEEG Depth
          </button>
        </div>
      </div>

      {/* Analytics & Alerts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Autoregulation Card */}
        {autoResult && (
          <div className="p-4 bg-slate-800/80 rounded-lg border border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs text-white uppercase">Cerebral Autoregulation</h4>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                autoResult.autoregulation_status === 'severely_dysfunctional' ? 'bg-rose-600 text-white' :
                autoResult.autoregulation_status === 'impaired' ? 'bg-amber-600 text-white' :
                'bg-emerald-600 text-white'
              }`}>
                {autoResult.autoregulation_status.replace('_', ' ')}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center py-1">
              <div className="p-1.5 bg-slate-900 rounded border border-slate-800">
                <div className="text-[10px] text-slate-400">Current CPP</div>
                <div className="text-base font-bold text-purple-400">{autoResult.cpp_mmhg}</div>
              </div>
              <div className="p-1.5 bg-slate-900 rounded border border-slate-800">
                <div className="text-[10px] text-slate-400">Optimal Target</div>
                <div className="text-base font-bold text-emerald-400">{autoResult.optimal_cpp_target_mmhg}</div>
              </div>
            </div>

            <ul className="text-[11px] text-slate-300 space-y-1">
              {autoResult.clinical_recommendations.map((r, i) => (
                <li key={i}>&bull; {r}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Metabolism Card */}
        {metabResult && (
          <div className="p-4 bg-slate-800/80 rounded-lg border border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs text-white uppercase">Neurometabolic Status</h4>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                metabResult.hypoxia_detected || metabResult.cellular_energy_crisis_detected ? 'bg-rose-600 text-white animate-pulse' : 'bg-emerald-600 text-white'
              }`}>
                {metabResult.hypoxia_detected ? 'CRITICAL ISCHEMIA' : 'ADEQUATE'}
              </span>
            </div>

            <ul className="text-[11px] text-slate-300 space-y-1 pt-1">
              {metabResult.metabolic_alerts.map((a, i) => (
                <li key={i} className="text-rose-300">&bull; {a}</li>
              ))}
              {metabResult.metabolic_alerts.length === 0 && (
                <li className="text-emerald-400">PbtO2 &gt; 20 mmHg and LPR &lt; 25 intact. No secondary metabolic insult detected.</li>
              )}
            </ul>
          </div>
        )}

        {/* Vasospasm Card */}
        {spasmResult && (
          <div className="p-4 bg-slate-800/80 rounded-lg border border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs text-white uppercase">SAH Vasospasm</h4>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                spasmResult.vasospasm_severity === 'severe' ? 'bg-rose-600 text-white' :
                spasmResult.vasospasm_severity === 'moderate' ? 'bg-amber-600 text-white' :
                'bg-emerald-600 text-white'
              }`}>
                {spasmResult.vasospasm_severity}
              </span>
            </div>

            <div className="p-2 bg-slate-900 rounded border border-slate-800 text-center">
              <div className="text-[10px] text-slate-400">Lindegaard Ratio</div>
              <div className="text-lg font-bold text-cyan-400">{spasmResult.lindegaard_ratio}</div>
            </div>

            <ul className="text-[11px] text-slate-300 space-y-1">
              {spasmResult.interventions.map((inv, i) => (
                <li key={i}>&bull; {inv}</li>
              ))}
            </ul>
          </div>
        )}

        {/* EEG Burst Suppression Card */}
        {eegResult && (
          <div className="p-4 bg-slate-800/80 rounded-lg border border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs text-white uppercase">cEEG Suppression Depth</h4>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                eegResult.sedation_depth_adequate ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
              }`}>
                {eegResult.sedation_depth_adequate ? 'ADEQUATE' : 'TITRATE UP'}
              </span>
            </div>

            <div className="p-2 bg-slate-900 rounded border border-slate-800 text-center">
              <div className="text-[10px] text-slate-400">Suppression Ratio</div>
              <div className="text-lg font-bold text-amber-400">{eegResult.burst_suppression_ratio_percent}%</div>
            </div>

            <ul className="text-[11px] text-slate-300 space-y-1">
              {eegResult.recommendations.map((rec, i) => (
                <li key={i}>&bull; {rec}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
