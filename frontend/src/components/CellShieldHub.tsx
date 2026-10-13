import React, { useState } from 'react';

interface CrsResult {
  crs_grade: string;
  clinical_management: string[];
}

interface IcansResult {
  icans_grade: string;
  clinical_management: string[];
}

interface HScoreResult {
  total_hscore: number;
  hlh_probability_percent: number;
  hlh_suspected: boolean;
  interventions: string[];
}

export const CellShieldHub: React.FC = () => {
  const [patientId] = useState<number>(1);
  const [productName, setProductName] = useState<string>('Axicabtagene ciloleucel (Yescarta)');
  
  // CRS States
  const [temp, setTemp] = useState<number>(39.2);
  const [sbp, setSbp] = useState<number>(88);
  const [pressors, setPressors] = useState<'none' | 'single_low_dose' | 'multiple_or_high_dose'>('single_low_dose');
  const [fio2, setFio2] = useState<'room_air' | 'low_flow_nasal_cannula' | 'high_flow_or_mask' | 'positive_pressure_vent'>('low_flow_nasal_cannula');

  // ICANS States
  const [iceScore, setIceScore] = useState<number>(6);
  const [consciousness, setConsciousness] = useState<'alert' | 'awakens_to_voice' | 'awakens_only_to_tactile' | 'unresponsive_or_coma'>('awakens_to_voice');
  const [motor, setMotor] = useState<'none' | 'mild_tremor' | 'myoclonus' | 'status_epilepticus_or_paresis'>('mild_tremor');
  const [papilledema, setPapilledema] = useState<boolean>(false);

  // HScore States
  const [ferritin, setFerritin] = useState<number>(7500);
  const [triglycerides, setTriglycerides] = useState<number>(380);
  const [fibrinogen, setFibrinogen] = useState<number>(190);
  const [ast, setAst] = useState<number>(65);
  const [organomegaly, setOrganomegaly] = useState<'none' | 'hepatomegaly_or_splenomegaly' | 'both'>('hepatomegaly_or_splenomegaly');
  const [lineages, setLineages] = useState<number>(3);

  // Evaluation Results
  const [crsResult, setCrsResult] = useState<CrsResult | null>(null);
  const [icansResult, setIcansResult] = useState<IcansResult | null>(null);
  const [hscoreResult, setHscoreResult] = useState<HScoreResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const evaluateCrs = async () => {
    try {
      const res = await fetch('/api/clinician/cart/evaluate-crs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          temperature_celsius: temp,
          systolic_bp_mmhg: sbp,
          vasopressors_required: pressors,
          fio2_oxygen_delivery: fio2
        })
      });
      if (res.ok) {
        const data = await res.json();
        setCrsResult(data);
        setStatusMessage('ASTCT CRS Grade evaluated.');
      }
    } catch (e: any) {
      setStatusMessage('Error evaluating CRS: ' + e.message);
    }
  };

  const evaluateIcans = async () => {
    try {
      const res = await fetch('/api/clinician/cart/evaluate-icans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ice_score: iceScore,
          depressed_consciousness: consciousness,
          motor_findings: motor,
          elevated_icp_papilledema: papilledema
        })
      });
      if (res.ok) {
        const data = await res.json();
        setIcansResult(data);
        setStatusMessage('ASTCT ICANS Grade evaluated.');
      }
    } catch (e: any) {
      setStatusMessage('Error evaluating ICANS: ' + e.message);
    }
  };

  const evaluateHScore = async () => {
    try {
      const res = await fetch('/api/clinician/cart/evaluate-hscore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          temperature_celsius: temp,
          organomegaly,
          cytopenias_lineages: lineages,
          ferritin_ng_ml: ferritin,
          triglycerides_mg_dl: triglycerides,
          fibrinogen_mg_dl: fibrinogen,
          ast_u_l: ast
        })
      });
      if (res.ok) {
        const data = await res.json();
        setHscoreResult(data);
        setStatusMessage('HScore Secondary HLH/MAS evaluated.');
      }
    } catch (e: any) {
      setStatusMessage('Error evaluating HScore: ' + e.message);
    }
  };

  const saveCartCase = async () => {
    try {
      const res = await fetch('/api/clinician/cart/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          product_name: productName,
          infusion_date: '2026-10-10',
          crs_grade: crsResult?.crs_grade || 'Grade_0',
          icans_grade: icansResult?.icans_grade || 'Grade_0',
          ice_neuro_score: iceScore,
          hscore_hlh_risk: hscoreResult?.total_hscore || 0
        })
      });
      if (res.ok) {
        setStatusMessage('CAR-T therapy encounter saved to clinical registry.');
      }
    } catch (e: any) {
      setStatusMessage('Error saving CAR-T case: ' + e.message);
    }
  };

  const runAllCommandActions = async () => {
    await evaluateCrs();
    await evaluateIcans();
    await evaluateHScore();
    await saveCartCase();
  };

  return (
    <div className="p-6 bg-slate-900 text-slate-100 rounded-xl shadow-2xl border border-slate-800 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2 bg-pink-500/20 text-pink-400 rounded-lg text-xl font-bold">🛡️ CELL-SHIELD</span>
            <h2 className="text-2xl font-bold tracking-tight text-white">Cellular Immunotherapy, CAR-T & Cytokine Release Hub</h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            ASTCT Consensus CRS Grading, ICANS Neurotoxicity Staging, and Secondary HLH/MAS HScore Protocol
          </p>
        </div>
        <button
          onClick={runAllCommandActions}
          className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white font-semibold rounded-lg shadow-md transition-colors text-sm"
        >
          Evaluate Cellular Toxicity Profile
        </button>
      </div>

      {statusMessage && (
        <div className="px-4 py-2 bg-slate-800 border border-slate-700 text-xs text-pink-300 rounded">
          {statusMessage}
        </div>
      )}

      {/* Input Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Cytokine Release Syndrome Input */}
        <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700/80 space-y-3">
          <h3 className="text-sm font-semibold text-rose-400 uppercase tracking-wider">Cytokine Release Syndrome (CRS)</h3>

          <div>
            <label className="text-xs text-slate-300 block mb-1">Cellular Product</label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-300 block">Temp (°C)</label>
              <input
                type="number"
                step="0.1"
                value={temp}
                onChange={(e) => setTemp(parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-300 block">Systolic BP</label>
              <input
                type="number"
                value={sbp}
                onChange={(e) => setSbp(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-300 block mb-1">Vasopressor Requirement</label>
            <select
              value={pressors}
              onChange={(e) => setPressors(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
            >
              <option value="none">None (Normotensive / Fluid responsive)</option>
              <option value="single_low_dose">Single Vasopressor (e.g. Norepinephrine &le; 0.1)</option>
              <option value="multiple_or_high_dose">Multiple Vasopressors or High Dose</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-300 block mb-1">Oxygen Requirement</label>
            <select
              value={fio2}
              onChange={(e) => setFio2(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
            >
              <option value="room_air">Room Air (SpO2 &ge; 92%)</option>
              <option value="low_flow_nasal_cannula">Low-Flow Nasal Cannula (&le; 6 L/min)</option>
              <option value="high_flow_or_mask">High-Flow Nasal Cannula or Face Mask</option>
              <option value="positive_pressure_vent">Positive Pressure / BiPAP / ETT Intubation</option>
            </select>
          </div>

          <button
            onClick={evaluateCrs}
            className="w-full py-1.5 bg-rose-900/60 hover:bg-rose-800 border border-rose-600/50 text-rose-200 text-xs font-medium rounded"
          >
            Grade CRS
          </button>
        </div>

        {/* ICANS Neurotoxicity Input */}
        <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700/80 space-y-3">
          <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider">ICANS Neurotoxicity</h3>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-300 block">ICE Score (0-10)</label>
              <input
                type="number"
                min="0"
                max="10"
                value={iceScore}
                onChange={(e) => setIceScore(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-300 block">Consciousness</label>
              <select
                value={consciousness}
                onChange={(e) => setConsciousness(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
              >
                <option value="alert">Alert</option>
                <option value="awakens_to_voice">Awakens to voice</option>
                <option value="awakens_only_to_tactile">Tactile only</option>
                <option value="unresponsive_or_coma">Unresponsive / Coma</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-300 block mb-1">Motor Findings</label>
            <select
              value={motor}
              onChange={(e) => setMotor(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
            >
              <option value="none">None</option>
              <option value="mild_tremor">Mild Tremor</option>
              <option value="myoclonus">Myoclonus</option>
              <option value="status_epilepticus_or_paresis">Status Epilepticus / Paresis</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={papilledema}
              onChange={(e) => setPapilledema(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-purple-600 focus:ring-0"
            />
            Cerebral Edema / Papilledema on Neuroimaging
          </label>

          <button
            onClick={evaluateIcans}
            className="w-full py-1.5 bg-purple-900/60 hover:bg-purple-800 border border-purple-600/50 text-purple-200 text-xs font-medium rounded mt-2"
          >
            Stage ICANS
          </button>
        </div>

        {/* HScore Secondary HLH/MAS */}
        <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700/80 space-y-3">
          <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">HScore (Secondary HLH/MAS)</h3>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-300 block">Ferritin (ng/mL)</label>
              <input
                type="number"
                value={ferritin}
                onChange={(e) => setFerritin(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-300 block">Triglycerides</label>
              <input
                type="number"
                value={triglycerides}
                onChange={(e) => setTriglycerides(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-300 block">Fibrinogen (mg/dL)</label>
              <input
                type="number"
                value={fibrinogen}
                onChange={(e) => setFibrinogen(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-300 block">AST (U/L)</label>
              <input
                type="number"
                value={ast}
                onChange={(e) => setAst(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-300 block">Organomegaly</label>
              <select
                value={organomegaly}
                onChange={(e) => setOrganomegaly(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
              >
                <option value="none">None</option>
                <option value="hepatomegaly_or_splenomegaly">Hepato or Spleen</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-300 block">Cytopenic Lineages</label>
              <select
                value={lineages}
                onChange={(e) => setLineages(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
              >
                <option value={1}>1 Lineage</option>
                <option value={2}>2 Lineages</option>
                <option value={3}>3 Lineages (Pancytopenia)</option>
              </select>
            </div>
          </div>

          <button
            onClick={evaluateHScore}
            className="w-full py-1.5 bg-amber-900/60 hover:bg-amber-800 border border-amber-600/50 text-amber-200 text-xs font-medium rounded mt-2"
          >
            Calculate HScore
          </button>
        </div>
      </div>

      {/* Analytics Outputs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CRS Output Card */}
        {crsResult && (
          <div className={`p-4 rounded-lg border ${crsResult.crs_grade === 'Grade_4' || crsResult.crs_grade === 'Grade_3' ? 'bg-rose-950/40 border-rose-600/70' : crsResult.crs_grade === 'Grade_2' ? 'bg-amber-950/40 border-amber-600/70' : 'bg-emerald-950/30 border-emerald-600/50'} space-y-3`}>
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-white">ASTCT CRS Grade</h4>
              <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase bg-rose-600 text-white">
                {crsResult.crs_grade.replace('_', ' ')}
              </span>
            </div>

            <ul className="text-xs text-slate-300 space-y-1">
              {crsResult.clinical_management.map((m, i) => (
                <li key={i}>&bull; {m}</li>
              ))}
            </ul>
          </div>
        )}

        {/* ICANS Output Card */}
        {icansResult && (
          <div className={`p-4 rounded-lg border ${icansResult.icans_grade === 'Grade_4' || icansResult.icans_grade === 'Grade_3' ? 'bg-purple-950/40 border-purple-600/70' : 'bg-slate-800/80 border-slate-700'} space-y-3`}>
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-white">ASTCT ICANS Grade</h4>
              <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase bg-purple-600 text-white">
                {icansResult.icans_grade.replace('_', ' ')}
              </span>
            </div>

            <ul className="text-xs text-slate-300 space-y-1">
              {icansResult.clinical_management.map((m, i) => (
                <li key={i}>&bull; {m}</li>
              ))}
            </ul>
          </div>
        )}

        {/* HScore Output Card */}
        {hscoreResult && (
          <div className={`p-4 rounded-lg border ${hscoreResult.hlh_suspected ? 'bg-amber-950/50 border-amber-600/80' : 'bg-slate-800/80 border-slate-700'} space-y-3`}>
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-white">Secondary HLH / MAS HScore</h4>
              <span className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase ${hscoreResult.hlh_suspected ? 'bg-amber-600 text-black' : 'bg-emerald-600 text-white'}`}>
                Score: {hscoreResult.total_hscore} ({hscoreResult.hlh_probability_percent}% Prob)
              </span>
            </div>

            <ul className="text-xs text-slate-300 space-y-1">
              {hscoreResult.interventions.map((inv, i) => (
                <li key={i}>&bull; {inv}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
