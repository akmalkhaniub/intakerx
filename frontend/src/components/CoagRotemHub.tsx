import React, { useState, useEffect } from 'react';

interface RotemProduct {
  product: string;
  product_name: string;
  dosage: string;
  rationale: string;
  target_goal: string;
}

interface RotemEvaluation {
  deficiency_pattern: string;
  pattern_description: string;
  urgency: string;
  heparin_effect_detected: boolean;
  recommended_products: RotemProduct[];
  hemostatic_summary: string;
}

interface ReversalEvaluation {
  target_agent: string;
  reversal_agent: string;
  prescribed_dose: string;
  administration_instructions: string[];
  monitoring_and_precautions: string[];
  rebound_anticoagulation_risk: string;
}

export const CoagRotemHub: React.FC = () => {
  const [patientId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'rotem' | 'reversal'>('rotem');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // ROTEM inputs
  const [scenario, setScenario] = useState<'trauma_mhp' | 'postpartum_hemorrhage' | 'cardiovascular_or' | 'liver_transplant'>('trauma_mhp');
  const [extemCt, setExtemCt] = useState<number>(88.0);
  const [intemCt, setIntemCt] = useState<number>(185.0);
  const [heptemCt, setHeptemCt] = useState<number>(180.0);
  const [fibtemMcf, setFibtemMcf] = useState<number>(7.5);
  const [extemMcf, setExtemMcf] = useState<number>(41.0);
  const [maxLysis, setMaxLysis] = useState<number>(18.5);
  const [rotemResult, setRotemResult] = useState<RotemEvaluation | null>(null);

  // Reversal inputs
  const [targetAgent, setTargetAgent] = useState<'dabigatran' | 'apixaban' | 'rivaroxaban' | 'warfarin' | 'unfractionated_heparin'>('apixaban');
  const [lastDoseHours, setLastDoseHours] = useState<number>(3.5);
  const [lastDoseMg, setLastDoseMg] = useState<number>(10);
  const [inr, setInr] = useState<number>(1.2);
  const [antiXa, setAntiXa] = useState<number>(1.8);
  const [bleedingSeverity, setBleedingSeverity] = useState<'life_threatening_ich' | 'major_surgical_gastrointestinal' | 'minor_non_life_threatening'>('life_threatening_ich');
  const [reversalResult, setReversalResult] = useState<ReversalEvaluation | null>(null);

  // History state
  const [history, setHistory] = useState<any>({ assays: [], reversals: [] });

  const fetchHistory = async () => {
    try {
      const res = await fetch(`/api/clinician/coag-rotem/patients/${patientId}/history`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err: any) {
      console.error('Fetch coag history error:', err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [patientId]);

  // Evaluate ROTEM
  const handleEvaluateRotem = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/coag-rotem/evaluate-rotem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assay_type: 'ROTEM_DELTA',
          clinical_scenario: scenario,
          extem_ct_sec: extemCt,
          intem_ct_sec: intemCt,
          heptem_ct_sec: heptemCt,
          fibtem_mcf_mm: fibtemMcf,
          extem_mcf_mm: extemMcf,
          maximum_lysis_percent: maxLysis,
          patient_weight_kg: 70
        })
      });
      if (res.ok) {
        const data = await res.json();
        setRotemResult(data);
        setStatusMessage(`ROTEM evaluated: ${data.deficiency_pattern}`);
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Save ROTEM Assay
  const handleSaveAssay = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/coag-rotem/assays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          assay_type: 'ROTEM_DELTA',
          clinical_scenario: scenario,
          extem_ct_sec: extemCt,
          intem_ct_sec: intemCt,
          fibtem_mcf_mm: fibtemMcf,
          extem_mcf_mm: extemMcf,
          maximum_lysis_percent: maxLysis,
          heptem_ct_sec: heptemCt,
          patient_weight_kg: 70
        })
      });
      if (res.ok) {
        const data = await res.json();
        setRotemResult(data.evaluation);
        setStatusMessage('Viscoelastic assay saved to patient record.');
        fetchHistory();
      }
    } catch (err: any) {
      setStatusMessage(`Error saving assay: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Evaluate Reversal
  const handleEvaluateReversal = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/coag-rotem/evaluate-reversal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_agent: targetAgent,
          last_dose_hours_ago: lastDoseHours,
          last_dose_mg: lastDoseMg,
          inr: inr,
          anti_xa_level_iu_ml: antiXa,
          bleeding_severity: bleedingSeverity,
          patient_weight_kg: 70
        })
      });
      if (res.ok) {
        const data = await res.json();
        setReversalResult(data);
        setStatusMessage(`Reversal protocol: ${data.reversal_agent}`);
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 text-slate-100 p-6 rounded-xl border border-slate-800 space-y-6 shadow-2xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded">
              Hemostasis & Resuscitation
            </span>
            <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded">
              Phase 74
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white mt-1">
            COAG-ROTEM Command: Viscoelastic Hemostasis & DOAC Reversal
          </h2>
          <p className="text-xs text-slate-400">
            ROTEM Delta & TEG Viscoelastic Clot Kinetics with Targeted DOAC Reversal Fleet
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('rotem')}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition ${
              activeTab === 'rotem'
                ? 'bg-rose-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            ROTEM / TEG Kinetics
          </button>
          <button
            onClick={() => setActiveTab('reversal')}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition ${
              activeTab === 'reversal'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            Anticoagulant Reversal
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="px-4 py-2 bg-slate-800/80 border border-rose-500/30 text-rose-300 text-xs rounded flex items-center justify-between">
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage('')} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Tab 1: Viscoelastic ROTEM / TEG Guided Resuscitation */}
      {activeTab === 'rotem' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/80 space-y-3 text-xs">
            <h3 className="text-sm font-semibold text-rose-400 uppercase tracking-wider">
              Viscoelastic Assay Input
            </h3>

            <div>
              <label className="text-slate-300 block mb-1">Clinical Scenario</label>
              <select
                value={scenario}
                onChange={(e) => setScenario(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
              >
                <option value="trauma_mhp">Trauma Massive Hemorrhage Protocol</option>
                <option value="postpartum_hemorrhage">Postpartum Hemorrhage (PPH)</option>
                <option value="cardiovascular_or">Cardiovascular Post-CPB</option>
                <option value="liver_transplant">Liver Transplantation Coagulopathy</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-300 block mb-1">EXTEM CT (sec)</label>
                <input
                  type="number"
                  value={extemCt}
                  onChange={(e) => setExtemCt(parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono"
                />
                <span className="text-[10px] text-slate-500">Normal: 38-79s</span>
              </div>
              <div>
                <label className="text-slate-300 block mb-1">FIBTEM MCF (mm)</label>
                <input
                  type="number"
                  step="0.5"
                  value={fibtemMcf}
                  onChange={(e) => setFibtemMcf(parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono text-amber-400 font-bold"
                />
                <span className="text-[10px] text-slate-500">Normal: 9-25 mm</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-300 block mb-1">EXTEM MCF (mm)</label>
                <input
                  type="number"
                  step="0.5"
                  value={extemMcf}
                  onChange={(e) => setExtemMcf(parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono"
                />
                <span className="text-[10px] text-slate-500">Normal: 50-72 mm</span>
              </div>
              <div>
                <label className="text-slate-300 block mb-1">Max Lysis ML (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={maxLysis}
                  onChange={(e) => setMaxLysis(parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono text-red-400 font-bold"
                />
                <span className="text-[10px] text-slate-500">Normal: &lt; 15%</span>
              </div>
            </div>

            <div className="border-t border-slate-700/60 pt-2 space-y-2">
              <span className="text-slate-400 block text-[11px] font-semibold">Heparinase Neutralization Check:</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block text-[10px]">INTEM CT (sec)</label>
                  <input
                    type="number"
                    value={intemCt}
                    onChange={(e) => setIntemCt(parseFloat(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block text-[10px]">HEPTEM CT (sec)</label>
                  <input
                    type="number"
                    value={heptemCt}
                    onChange={(e) => setHeptemCt(parseFloat(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={handleEvaluateRotem}
                disabled={isLoading}
                className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded transition"
              >
                Evaluate Assay
              </button>
              <button
                onClick={handleSaveAssay}
                disabled={isLoading}
                className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded shadow transition"
              >
                Record Assay
              </button>
            </div>
          </div>

          {/* Results Display */}
          <div className="lg:col-span-2 space-y-4">
            {rotemResult ? (
              <div className="space-y-4">
                <div className="bg-slate-800/70 p-4 rounded-lg border border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs uppercase text-slate-400 font-medium">Deficiency Pattern</span>
                      <h4 className="text-lg font-bold text-white">{rotemResult.deficiency_pattern}</h4>
                    </div>
                    <span className={`px-3 py-1 rounded text-xs font-bold border ${
                      rotemResult.urgency === 'STAT_HEMORRHAGE_CONTROL'
                        ? 'bg-red-500/20 text-red-400 border-red-500/50 animate-pulse'
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                    }`}>
                      {rotemResult.urgency}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 bg-slate-900/80 p-3 rounded border border-slate-800">
                    {rotemResult.pattern_description}
                  </p>

                  {roparinEffectNotice(rotemResult.heparin_effect_detected)}

                  {/* Product Recommendations */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-rose-400 uppercase tracking-wider block">
                      Targeted Hemostatic Product Prescriptions:
                    </span>
                    <div className="space-y-2">
                      {rotemResult.recommended_products.map((p, idx) => (
                        <div key={idx} className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-amber-300 text-sm">{p.product_name}</span>
                            <span className="font-mono text-emerald-400 font-bold">{p.dosage}</span>
                          </div>
                          <p className="text-slate-400">{p.rationale}</p>
                          <span className="text-[10px] text-teal-400 block font-mono">Target: {p.target_goal}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-800/30 border border-slate-800 rounded-lg p-8 text-center text-slate-400 text-xs">
                Enter ROTEM parameters (EXTEM, FIBTEM, Maximum Lysis) and click <strong>Evaluate Assay</strong> to generate transfusion guidance.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Anticoagulant & DOAC Reversal Console */}
      {activeTab === 'reversal' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/80 space-y-3 text-xs">
            <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">
              Anticoagulant Presentation
            </h3>

            <div>
              <label className="text-slate-300 block mb-1">Target Anticoagulant</label>
              <select
                value={targetAgent}
                onChange={(e) => setTargetAgent(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
              >
                <option value="apixaban">Apixaban (Eliquis) - Factor Xa</option>
                <option value="rivaroxaban">Rivaroxaban (Xarelto) - Factor Xa</option>
                <option value="dabigatran">Dabigatran (Pradaxa) - Direct Thrombin</option>
                <option value="warfarin">Warfarin (Coumadin) - Vitamin K Antagonist</option>
                <option value="unfractionated_heparin">Unfractionated Heparin (UFH)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-300 block mb-1">Last Dose (Hours Ago)</label>
                <input
                  type="number"
                  step="0.5"
                  value={lastDoseHours}
                  onChange={(e) => setLastDoseHours(parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-slate-300 block mb-1">Last Dose (mg)</label>
                <input
                  type="number"
                  value={lastDoseMg}
                  onChange={(e) => setLastDoseMg(parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-300 block mb-1">INR (Warfarin)</label>
                <input
                  type="number"
                  step="0.1"
                  value={inr}
                  onChange={(e) => setInr(parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-slate-300 block mb-1">Anti-Xa (IU/mL)</label>
                <input
                  type="number"
                  step="0.1"
                  value={antiXa}
                  onChange={(e) => setAntiXa(parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-300 block mb-1">Bleeding Severity</label>
              <select
                value={bleedingSeverity}
                onChange={(e) => setBleedingSeverity(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
              >
                <option value="life_threatening_ich">Life-Threatening Intracranial Hemorrhage</option>
                <option value="major_surgical_gastrointestinal">Major Surgical / GI Bleeding</option>
                <option value="minor_non_life_threatening">Minor / Non-Life Threatening</option>
              </select>
            </div>

            <button
              onClick={handleEvaluateReversal}
              disabled={isLoading}
              className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded shadow transition mt-2"
            >
              Evaluate Reversal Protocol
            </button>
          </div>

          {/* Results */}
          <div className="lg:col-span-2 space-y-4">
            {reversalResult ? (
              <div className="space-y-4">
                <div className="bg-slate-800/70 p-4 rounded-lg border border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs uppercase text-slate-400 font-medium">Specific Reversal Agent</span>
                      <h4 className="text-lg font-bold text-amber-400">{reversalResult.reversal_agent}</h4>
                    </div>
                    <span className="px-2.5 py-1 rounded text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/50">
                      EMERGENT
                    </span>
                  </div>

                  <div className="bg-slate-950 p-3 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase block mb-0.5">Prescribed Dosing Directive:</span>
                    <p className="text-sm font-mono font-bold text-emerald-400">{reversalResult.prescribed_dose}</p>
                  </div>

                  <div className="space-y-2 text-xs">
                    <span className="font-semibold text-slate-300 block">Administration Protocol:</span>
                    <ul className="space-y-1 text-slate-400">
                      {reversalResult.administration_instructions.map((inst, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-amber-400 font-bold">&#10003;</span>
                          <span>{inst}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-red-950/40 border border-red-500/40 p-3 rounded text-xs space-y-1">
                    <span className="font-bold text-red-300 uppercase text-[10px] block">
                      Black Box Warnings & Thrombotic Precautions:
                    </span>
                    <ul className="space-y-1 text-red-200 text-[11px]">
                      {reversalResult.monitoring_and_precautions.map((prec, i) => (
                        <li key={i}>&bull; {prec}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-800/30 border border-slate-800 rounded-lg p-8 text-center text-slate-400 text-xs">
                Select anticoagulant agent and clinical parameters to formulate specific reversal regimen.
              </div>
            )}
          </div>
        </div>
      )}

      {/* History */}
      {history.assays && history.assays.length > 0 && (
        <div className="space-y-2 pt-4 border-t border-slate-800 text-xs">
          <h4 className="font-semibold text-slate-400 uppercase tracking-wider">
            Patient Coagulation & Viscoelastic Records
          </h4>
          <div className="overflow-x-auto rounded border border-slate-800">
            <table className="w-full text-left">
              <thead className="bg-slate-950 text-slate-500 text-[11px]">
                <tr>
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Scenario</th>
                  <th className="py-2 px-3 text-center">EXTEM CT</th>
                  <th className="py-2 px-3 text-center">FIBTEM MCF</th>
                  <th className="py-2 px-3 text-center">Max Lysis</th>
                  <th className="py-2 px-3">Pattern</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/40 text-slate-300">
                {history.assays.map((a: any) => (
                  <tr key={a.id}>
                    <td className="py-2 px-3 text-slate-500 font-mono text-[10px]">
                      {new Date(a.created_at).toLocaleTimeString()}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-200">{a.clinical_scenario}</td>
                    <td className="py-2 px-3 text-center font-mono">{a.extem_ct_sec}s</td>
                    <td className="py-2 px-3 text-center font-mono text-amber-400">{a.fibtem_mcf_mm} mm</td>
                    <td className="py-2 px-3 text-center font-mono text-red-400">{a.maximum_lysis_percent}%</td>
                    <td className="py-2 px-3 text-rose-300 font-semibold">{a.deficiency_pattern}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

function roparinEffectNotice(heparinDetected: boolean) {
  if (!heparinDetected) return null;
  return (
    <div className="bg-amber-950/60 border border-amber-500/60 p-2.5 rounded text-xs text-amber-200">
      ⚡ <strong>Heparin Neutralization Alert:</strong> INTEM/HEPTEM ratio &gt; 1.25 demonstrates circulating heparin effect. Administer Protamine Sulfate.
    </div>
  );
}
