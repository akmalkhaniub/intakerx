import React, { useState, useEffect } from 'react';

interface MetabolicEvaluation {
  presentation_type: string;
  presentation_title: string;
  anion_gap: number;
  corrected_sodium: number;
  effective_osmolality: number;
  potassium_safety: {
    status: 'INSULIN_HOLD_CRITICAL' | 'NORMAL_REPLACE' | 'ELEVATED_MONITOR';
    action: string;
    potassium_repletion_directive: string;
  };
  insulin_protocol: {
    initial_rate_units_hr: number;
    hourly_drop_target_mg_dl: string;
    cerebral_edema_precautions: string[];
  };
  fluid_protocol: {
    bag_1_composition: string;
    bag_1_rate_ml_hr: number;
    bag_2_composition: string;
    bag_2_rate_ml_hr: number;
    target_glucose_window_mg_dl: string;
    potassium_additive_meq_l: number;
  };
  transition_criteria: {
    ready_for_subq_bridge: boolean;
    unmet_criteria: string[];
    bridge_instructions: string;
  };
}

interface TitrationEvaluation {
  glucose_drop_rate_mg_dl_hr: number;
  adjusted_insulin_rate_units_hr: number;
  dextrose_required: boolean;
  potassium_action: string;
  drop_rate_assessment: 'OPTIMAL' | 'TOO_SLOW_INCREASE' | 'TOO_FAST_RISK_CEREBRAL_EDEMA';
  recommendations: string[];
}

export const MetabolicKetoHub: React.FC = () => {
  const [patientId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'assessment' | 'titration'>('assessment');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Initial Assessment States
  const [glucose, setGlucose] = useState<number>(480);
  const [ph, setPh] = useState<number>(7.12);
  const [bicarb, setBicarb] = useState<number>(11.0);
  const [betaOhb, setBetaOhb] = useState<number>(5.4);
  const [sodium, setSodium] = useState<number>(134);
  const [potassium, setPotassium] = useState<number>(4.4);
  const [chloride, setChloride] = useState<number>(97);
  const [bun, setBun] = useState<number>(26);
  const [weight, setWeight] = useState<number>(72);
  const [sglt2i, setSglt2i] = useState<boolean>(false);
  const [assessmentResult, setAssessmentResult] = useState<MetabolicEvaluation | null>(null);

  // Titration Console States
  const [currentGlucose, setCurrentGlucose] = useState<number>(420);
  const [prevGlucose, setPrevGlucose] = useState<number>(480);
  const [currentInsulinRate, setCurrentInsulinRate] = useState<number>(7.2);
  const [currentK, setCurrentK] = useState<number>(4.2);
  const [currentAg, setCurrentAg] = useState<number>(24);
  const [titrationResult, setTitrationResult] = useState<TitrationEvaluation | null>(null);

  // History state
  const [history, setHistory] = useState<any>({ encounters: [], titration_logs: [] });

  const fetchHistory = async () => {
    try {
      const res = await fetch(`/api/clinician/metabolic-keto/patients/${patientId}/history`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err: any) {
      console.error('Fetch metabolic history error:', err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [patientId]);

  // Evaluate Presentation
  const handleEvaluatePresentation = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/metabolic-keto/evaluate-presentation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blood_glucose_mg_dl: glucose,
          arterial_ph: ph,
          serum_bicarbonate_meq_l: bicarb,
          beta_hydroxybutyrate_mmol_l: betaOhb,
          serum_sodium_meq_l: sodium,
          serum_potassium_meq_l: potassium,
          serum_chloride_meq_l: chloride,
          bun_mg_dl: bun,
          patient_weight_kg: weight,
          sglt2i_exposure: sglt2i
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAssessmentResult(data);
        setStatusMessage(`Evaluation complete: ${data.presentation_title}`);
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Save Encounter
  const handleSaveEncounter = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/metabolic-keto/encounters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          blood_glucose_mg_dl: glucose,
          arterial_ph: ph,
          serum_bicarbonate_meq_l: bicarb,
          beta_hydroxybutyrate_mmol_l: betaOhb,
          serum_sodium_meq_l: sodium,
          serum_potassium_meq_l: potassium,
          serum_chloride_meq_l: chloride,
          bun_mg_dl: bun,
          patient_weight_kg: weight,
          sglt2i_exposure: sglt2i
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAssessmentResult(data.evaluation);
        setStatusMessage('Metabolic keto encounter saved to patient chart.');
        fetchHistory();
      }
    } catch (err: any) {
      setStatusMessage(`Error saving encounter: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Evaluate Hourly Titration
  const handleEvaluateTitration = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/metabolic-keto/evaluate-titration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_glucose_mg_dl: currentGlucose,
          previous_glucose_mg_dl: prevGlucose,
          current_insulin_rate_units_hr: currentInsulinRate,
          current_potassium_meq_l: currentK,
          anion_gap: currentAg
        })
      });
      if (res.ok) {
        const data = await res.json();
        setTitrationResult(data);
        setStatusMessage(`Titration evaluated: Drop rate ${data.glucose_drop_rate_mg_dl_hr} mg/dL/hr`);
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
            <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-orange-500/20 text-orange-300 border border-orange-500/40 rounded">
              Endocrine Critical Care
            </span>
            <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-red-500/20 text-red-300 border border-red-500/40 rounded">
              Phase 73
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white mt-1">
            METABOLIC-KETO Command: Complex DKA, HHS & Dynamic Insulin Fleet
          </h2>
          <p className="text-xs text-slate-400">
            ADA DKA vs. HHS Classifier, Potassium Safety Interlock, Two-Bag System, & SubQ Transition Bridge
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('assessment')}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition ${
              activeTab === 'assessment'
                ? 'bg-orange-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            Diagnostic & Protocols
          </button>
          <button
            onClick={() => setActiveTab('titration')}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition ${
              activeTab === 'titration'
                ? 'bg-red-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            Hourly Titration Console
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="px-4 py-2 bg-slate-800/80 border border-orange-500/30 text-orange-300 text-xs rounded flex items-center justify-between">
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage('')} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Tab 1: Diagnostic Assessment & Protocols */}
      {activeTab === 'assessment' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/80 space-y-3 text-xs">
            <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider">
              Admission Labs & Presentation
            </h3>

            <div>
              <label className="text-slate-300 block mb-1">Blood Glucose (mg/dL)</label>
              <input
                type="number"
                value={glucose}
                onChange={(e) => setGlucose(parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-300 block mb-1">Arterial pH</label>
                <input
                  type="number"
                  step="0.01"
                  value={ph}
                  onChange={(e) => setPh(parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-slate-300 block mb-1">HCO3 (mEq/L)</label>
                <input
                  type="number"
                  step="0.5"
                  value={bicarb}
                  onChange={(e) => setBicarb(parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-300 block mb-1">&beta;-OHB (mmol/L)</label>
                <input
                  type="number"
                  step="0.1"
                  value={betaOhb}
                  onChange={(e) => setBetaOhb(parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-slate-300 block mb-1">Weight (kg)</label>
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-slate-300 block mb-1">Na+ (mEq/L)</label>
                <input
                  type="number"
                  value={sodium}
                  onChange={(e) => setSodium(parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-slate-300 block mb-1">K+ (mEq/L)</label>
                <input
                  type="number"
                  step="0.1"
                  value={potassium}
                  onChange={(e) => setPotassium(parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white font-bold text-amber-400"
                />
              </div>
              <div>
                <label className="text-slate-300 block mb-1">Cl- (mEq/L)</label>
                <input
                  type="number"
                  value={chloride}
                  onChange={(e) => setChloride(parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-300 block mb-1">BUN (mg/dL)</label>
              <input
                type="number"
                value={bun}
                onChange={(e) => setBun(parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={sglt2i}
                onChange={(e) => setSglt2i(e.target.checked)}
                className="rounded bg-slate-950 border-slate-700 text-orange-500"
              />
              <span>SGLT2 Inhibitor Exposure (Empa/Dapa)</span>
            </label>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={handleEvaluatePresentation}
                disabled={isLoading}
                className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded transition"
              >
                Evaluate
              </button>
              <button
                onClick={handleSaveEncounter}
                disabled={isLoading}
                className="w-full py-2 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded shadow transition"
              >
                Record Encounter
              </button>
            </div>
          </div>

          {/* Results display */}
          <div className="lg:col-span-2 space-y-4">
            {assessmentResult ? (
              <div className="space-y-4">
                {/* Potassium Alert Banner */}
                {assessmentResult.potassium_safety.status === 'INSULIN_HOLD_CRITICAL' && (
                  <div className="bg-red-950/80 border-2 border-red-500 p-4 rounded-lg text-red-200 animate-pulse space-y-1">
                    <span className="font-bold text-sm uppercase tracking-wider block">
                      ⚠️ CRITICAL SAFETY LOCKOUT: INSULIN HOLD REQUIRED
                    </span>
                    <p className="text-xs">{assessmentResult.potassium_safety.action}</p>
                    <p className="text-[11px] text-red-300 font-mono">
                      {assessmentResult.potassium_safety.potassium_repletion_directive}
                    </p>
                  </div>
                )}

                {/* Main diagnostic card */}
                <div className="bg-slate-800/70 p-4 rounded-lg border border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs uppercase text-slate-400 font-medium">Diagnosis</span>
                      <h4 className="text-lg font-bold text-white">{assessmentResult.presentation_title}</h4>
                    </div>
                    <span className="px-3 py-1 rounded text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/50">
                      {assessmentResult.presentation_type}
                    </span>
                  </div>

                  {/* Calculated Key Metrics */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase block">Anion Gap</span>
                      <span className={`text-xl font-black ${
                        assessmentResult.anion_gap > 12 ? 'text-red-400' : 'text-emerald-400'
                      }`}>
                        {assessmentResult.anion_gap} mEq/L
                      </span>
                    </div>
                    <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase block">Corrected Sodium</span>
                      <span className="text-xl font-black text-amber-400">
                        {assessmentResult.corrected_sodium} mEq/L
                      </span>
                    </div>
                    <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase block">Effective Osmolality</span>
                      <span className={`text-xl font-black ${
                        assessmentResult.effective_osmolality >= 320 ? 'text-purple-400' : 'text-slate-200'
                      }`}>
                        {assessmentResult.effective_osmolality} mOsm/kg
                      </span>
                    </div>
                  </div>

                  {/* Two-Bag Fluid System */}
                  <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-2">
                    <span className="text-xs font-semibold text-teal-400 uppercase tracking-wider block">
                      Two-Bag Resuscitation Protocol
                    </span>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-slate-900 p-2 rounded border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">Bag 1 (Saline Core):</span>
                        <span className="font-semibold text-white block">{assessmentResult.fluid_protocol.bag_1_composition}</span>
                        <span className="text-teal-400 font-mono text-xs">{assessmentResult.fluid_protocol.bag_1_rate_ml_hr} mL/hr</span>
                      </div>
                      <div className="bg-slate-900 p-2 rounded border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">Bag 2 (Dextrose Guard):</span>
                        <span className="font-semibold text-white block">{assessmentResult.fluid_protocol.bag_2_composition}</span>
                        <span className="text-amber-400 font-mono text-xs">{assessmentResult.fluid_protocol.bag_2_rate_ml_hr} mL/hr</span>
                      </div>
                    </div>
                  </div>

                  {/* Subcutaneous Transition Bridge */}
                  <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-400 uppercase text-[11px]">
                        Subcutaneous Insulin Bridge Readiness
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        assessmentResult.transition_criteria.ready_for_subq_bridge
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                          : 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                      }`}>
                        {assessmentResult.transition_criteria.ready_for_subq_bridge ? 'READY FOR BRIDGE' : 'CONTINUE IV INFUSION'}
                      </span>
                    </div>
                    <p className="text-slate-300 text-xs">
                      {assessmentResult.transition_criteria.bridge_instructions}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-800/30 border border-slate-800 rounded-lg p-8 text-center text-slate-400 text-xs">
                Enter admission metabolic labs and click <strong>Evaluate</strong> to calculate DKA/HHS status and resuscitation protocols.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Hourly Titration Console */}
      {activeTab === 'titration' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/80 space-y-3 text-xs">
            <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider">
              Hourly Titration Parameters
            </h3>

            <div>
              <label className="text-slate-300 block mb-1">Previous Glucose (mg/dL)</label>
              <input
                type="number"
                value={prevGlucose}
                onChange={(e) => setPrevGlucose(parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
              />
            </div>

            <div>
              <label className="text-slate-300 block mb-1">Current Glucose (mg/dL)</label>
              <input
                type="number"
                value={currentGlucose}
                onChange={(e) => setCurrentGlucose(parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-bold text-amber-400"
              />
            </div>

            <div>
              <label className="text-slate-300 block mb-1">Current Insulin Rate (units/hr)</label>
              <input
                type="number"
                step="0.5"
                value={currentInsulinRate}
                onChange={(e) => setCurrentInsulinRate(parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
              />
            </div>

            <div>
              <label className="text-slate-300 block mb-1">Current Serum Potassium (mEq/L)</label>
              <input
                type="number"
                step="0.1"
                value={currentK}
                onChange={(e) => setCurrentK(parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
              />
            </div>

            <div>
              <label className="text-slate-300 block mb-1">Current Anion Gap (mEq/L)</label>
              <input
                type="number"
                value={currentAg}
                onChange={(e) => setCurrentAg(parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
              />
            </div>

            <button
              onClick={handleEvaluateTitration}
              disabled={isLoading}
              className="w-full py-2 bg-red-600 hover:bg-red-500 text-white font-semibold rounded shadow transition mt-2"
            >
              Analyze Hourly Titration
            </button>
          </div>

          {/* Results */}
          <div className="lg:col-span-2 space-y-4">
            {titrationResult ? (
              <div className="space-y-4">
                <div className="bg-slate-800/70 p-4 rounded-lg border border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs uppercase text-slate-400 font-medium">Hourly Drop Velocity</span>
                      <h4 className="text-2xl font-black text-white">
                        {titrationResult.glucose_drop_rate_mg_dl_hr} mg/dL/hr
                      </h4>
                    </div>
                    <span className={`px-3 py-1 rounded text-xs font-bold border ${
                      titrationResult.drop_rate_assessment === 'OPTIMAL'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                        : titrationResult.drop_rate_assessment === 'TOO_FAST_RISK_CEREBRAL_EDEMA'
                          ? 'bg-red-500/20 text-red-400 border-red-500/50 animate-pulse'
                          : 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                    }`}>
                      {titrationResult.drop_rate_assessment}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-900/80 p-3 rounded border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">Adjusted Insulin Rate</span>
                      <span className="text-xl font-black text-amber-400">
                        {titrationResult.adjusted_insulin_rate_units_hr} units/hr
                      </span>
                    </div>
                    <div className="bg-slate-900/80 p-3 rounded border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">Dextrose Fluid Status</span>
                      <span className={`text-sm font-bold ${
                        titrationResult.dextrose_required ? 'text-amber-400' : 'text-slate-400'
                      }`}>
                        {titrationResult.dextrose_required ? 'ACTIVE (D5W / D10W)' : 'SALINE ONLY'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-1 text-xs">
                    <span className="font-semibold text-slate-400 uppercase text-[11px] block">
                      Titration Recommendations
                    </span>
                    <ul className="space-y-1.5 text-slate-300">
                      {titrationResult.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-orange-400">&bull;</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-800/30 border border-slate-800 rounded-lg p-8 text-center text-slate-400 text-xs">
                Enter current and previous blood glucose to evaluate hourly drop velocity and adjust insulin infusion.
              </div>
            )}
          </div>
        </div>
      )}

      {/* History */}
      {history.encounters && history.encounters.length > 0 && (
        <div className="space-y-2 pt-4 border-t border-slate-800 text-xs">
          <h4 className="font-semibold text-slate-400 uppercase tracking-wider">
            Patient Metabolic Encounter History
          </h4>
          <div className="overflow-x-auto rounded border border-slate-800">
            <table className="w-full text-left">
              <thead className="bg-slate-950 text-slate-500 text-[11px]">
                <tr>
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3 text-center">Glucose</th>
                  <th className="py-2 px-3 text-center">pH / HCO3</th>
                  <th className="py-2 px-3 text-center">Anion Gap</th>
                  <th className="py-2 px-3 text-center">Insulin Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/40 text-slate-300">
                {history.encounters.map((e: any) => (
                  <tr key={e.id}>
                    <td className="py-2 px-3 text-slate-500 font-mono text-[10px]">
                      {new Date(e.created_at).toLocaleTimeString()}
                    </td>
                    <td className="py-2 px-3 font-medium text-orange-300">{e.presentation_type}</td>
                    <td className="py-2 px-3 text-center font-bold text-white">{e.blood_glucose_mg_dl}</td>
                    <td className="py-2 px-3 text-center text-slate-400">
                      {e.arterial_ph} / {e.serum_bicarbonate_meq_l}
                    </td>
                    <td className="py-2 px-3 text-center font-bold text-red-400">{e.anion_gap}</td>
                    <td className="py-2 px-3 text-center font-mono text-amber-400">{e.insulin_rate_units_hr} u/hr</td>
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
