import React, { useState, useEffect } from 'react';

interface AsfaGuidance {
  indication: string;
  category: 'CATEGORY_I' | 'CATEGORY_II' | 'CATEGORY_III';
  evidence_grade: string;
  first_line_indication: boolean;
  recommended_replacement_fluid: string;
  recommended_tpv_range: string;
  recommended_frequency: string;
  clinical_summary: string;
}

interface PlasmicResult {
  score: number;
  risk_category: 'LOW' | 'INTERMEDIATE' | 'HIGH';
  severe_adamts13_deficiency_probability_percent: number;
  immediate_tpe_required: boolean;
  platelet_transfusion_contraindicated: boolean;
  black_box_warning?: string;
  management_plan: string[];
}

interface VolumeResult {
  total_blood_volume_ml: number;
  total_plasma_volume_ml: number;
  target_exchange_volume_ml: number;
  solute_removal_fraction_percent: number;
  formula_basis: string;
}

interface CalciumResult {
  hypocalcemia_alert: boolean;
  calcium_status: 'NORMAL' | 'MILD_HYPOCALCEMIA' | 'SEVERE_CRITICAL_HYPOCALCEMIA';
  emergency_calcium_bolus_required: boolean;
  bolus_dose_instructions?: string;
  continuous_infusion_adjustment: string;
  cardiac_warning?: string;
  actionable_checklist: string[];
}

export const PheresisCmdHub: React.FC = () => {
  const [patientId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'asfa' | 'plasmic' | 'tpv' | 'calcium' | 'history'>('asfa');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // ASFA State
  const [selectedIndication, setSelectedIndication] = useState<string>('TTP');
  const [asfaData, setAsfaData] = useState<AsfaGuidance | null>(null);

  // PLASMIC State
  const [plateletCount, setPlateletCount] = useState<number>(18);
  const [hemolysisPresent, setHemolysisPresent] = useState<boolean>(true);
  const [activeCancer, setActiveCancer] = useState<boolean>(false);
  const [transplantHistory, setTransplantHistory] = useState<boolean>(false);
  const [mcv, setMcv] = useState<number>(86);
  const [inr, setInr] = useState<number>(1.1);
  const [creatinine, setCreatinine] = useState<number>(1.2);
  const [adamts13Activity, setAdamts13Activity] = useState<number>(3.0);
  const [plasmicResult, setPlasmicResult] = useState<PlasmicResult | null>(null);

  // TPV State
  const [weightKg, setWeightKg] = useState<number>(70);
  const [gender, setGender] = useState<'MALE' | 'FEMALE'>('MALE');
  const [hctPercent, setHctPercent] = useState<number>(38.0);
  const [tpvFraction, setTpvFraction] = useState<number>(1.0);
  const [volumeResult, setVolumeResult] = useState<VolumeResult | null>(null);

  // Calcium State
  const [ionizedCalcium, setIonizedCalcium] = useState<number>(0.88);
  const [hypocalcemiaSymptoms, setHypocalcemiaSymptoms] = useState<boolean>(true);
  const [calciumResult, setCalciumResult] = useState<CalciumResult | null>(null);

  // History State
  const [history, setHistory] = useState<{ procedures: any[]; telemetry_logs: any[] }>({
    procedures: [],
    telemetry_logs: []
  });

  const fetchHistory = async () => {
    try {
      const res = await fetch(`/api/clinician/apheresis/patients/${patientId}/history`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  useEffect(() => {
    fetchHistory();
    handleFetchAsfa(selectedIndication);
  }, [patientId]);

  const handleFetchAsfa = async (ind: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/apheresis/evaluate-asfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ indication: ind })
      });
      if (res.ok) {
        const data = await res.json();
        setAsfaData(data);
      }
    } catch (err: any) {
      console.error('ASFA fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEvaluatePlasmic = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const res = await fetch('/api/clinician/apheresis/evaluate-plasmic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platelet_count_k: plateletCount,
          hemolysis_present: hemolysisPresent,
          active_cancer_in_past_year: activeCancer,
          stem_cell_or_organ_transplant: transplantHistory,
          mcv_fl: mcv,
          inr,
          creatinine_mg_dl: creatinine,
          adamts13_activity_percent: adamts13Activity
        })
      });
      if (res.ok) {
        const data = await res.json();
        setPlasmicResult(data);
        setStatusMessage('PLASMIC score and TTP risk evaluated.');
      } else {
        setStatusMessage('Evaluation failed.');
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCalculateVolume = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const res = await fetch('/api/clinician/apheresis/calculate-volume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weight_kg: weightKg,
          gender,
          hematocrit_percent: hctPercent,
          prescribed_tpv_fraction: tpvFraction
        })
      });
      if (res.ok) {
        const data = await res.json();
        setVolumeResult(data);
        setStatusMessage('Total Plasma Volume calculated.');
      } else {
        setStatusMessage('Calculation failed.');
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEvaluateCalcium = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const res = await fetch('/api/clinician/apheresis/evaluate-calcium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemic_ionized_calcium_mmol_l: ionizedCalcium,
          clinical_symptoms_present: hypocalcemiaSymptoms
        })
      });
      if (res.ok) {
        const data = await res.json();
        setCalciumResult(data);
        setStatusMessage('Citrate anticoagulation & calcium safety evaluated.');
      } else {
        setStatusMessage('Evaluation failed.');
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProcedure = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const volRes = await fetch('/api/clinician/apheresis/calculate-volume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weight_kg: weightKg,
          gender,
          hematocrit_percent: hctPercent,
          prescribed_tpv_fraction: tpvFraction
        })
      });
      const volData = await volRes.json();

      const asfaRes = await fetch('/api/clinician/apheresis/evaluate-asfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ indication: selectedIndication })
      });
      const asfaResData = await asfaRes.json();

      const res = await fetch('/api/clinician/apheresis/procedures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          asfa_indication: selectedIndication,
          asfa_category: asfaResData.category,
          plasmic_score: plasmicResult?.score || 6,
          adamts13_activity_percent: adamts13Activity,
          total_plasma_volume_ml: volData.total_plasma_volume_ml,
          prescribed_exchange_tpv_fraction: tpvFraction,
          total_exchange_volume_ml: volData.target_exchange_volume_ml,
          replacement_fluid: asfaResData.recommended_replacement_fluid,
          platelet_transfusion_contraindicated: selectedIndication === 'TTP',
          calcium_infusion_active: true
        })
      });

      if (res.ok) {
        setStatusMessage('Apheresis procedure order recorded.');
        fetchHistory();
      } else {
        setStatusMessage('Failed to save procedure.');
      }
    } catch (err: any) {
      setStatusMessage(`Error saving procedure: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogTelemetry = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const procId = history.procedures.length > 0 ? history.procedures[0].id : 1;

      const res = await fetch('/api/clinician/apheresis/telemetry-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          procedure_id: procId,
          patient_id: patientId,
          blood_processed_ml: 4500,
          plasma_removed_ml: 2950,
          replacement_administered_ml: 2950,
          acda_citrate_volume_ml: 310,
          systemic_ionized_calcium_mmol_l: ionizedCalcium,
          calcium_gluconate_infused_g: 1.5,
          hypocalcemia_alert: ionizedCalcium < 1.0,
          circuit_pressure_inlet_mmhg: -75
        })
      });

      if (res.ok) {
        setStatusMessage('Exchange telemetry logged.');
        fetchHistory();
      } else {
        setStatusMessage('Failed to log telemetry.');
      }
    } catch (err: any) {
      setStatusMessage(`Error logging telemetry: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-cyan-500/30 rounded-xl p-6 text-slate-100 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-cyan-500/20 text-cyan-400 rounded-lg text-2xl">🩸</span>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
                PHERESIS-CMD: Therapeutic Plasma Exchange & Apheresis
                <span className="text-xs bg-cyan-500/20 text-cyan-300 font-mono px-2 py-0.5 rounded border border-cyan-500/30">
                  PHASE 77
                </span>
              </h2>
              <p className="text-sm text-slate-400">
                ASFA Category I/II Indications, PLASMIC Score / TTP Interlock, TPV Calculation, ACD-A Citrate & Calcium Sentinel
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchHistory}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm border border-slate-700 transition"
            title="Refresh History"
          >
            🔄 Sync
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('asfa')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition flex items-center gap-2 ${
            activeTab === 'asfa'
              ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
          }`}
        >
          <span>📜</span> ASFA Guidelines
        </button>
        <button
          onClick={() => setActiveTab('plasmic')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition flex items-center gap-2 ${
            activeTab === 'plasmic'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/20'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
          }`}
        >
          <span>🚨</span> PLASMIC & TTP Protocol
        </button>
        <button
          onClick={() => setActiveTab('tpv')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition flex items-center gap-2 ${
            activeTab === 'tpv'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
          }`}
        >
          <span>🧪</span> TPV Dosing Calculator
        </button>
        <button
          onClick={() => setActiveTab('calcium')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition flex items-center gap-2 ${
            activeTab === 'calcium'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/20'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
          }`}
        >
          <span>⚡</span> Citrate & Calcium Sentinel
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition flex items-center gap-2 ${
            activeTab === 'history'
              ? 'bg-slate-700 text-white shadow-lg shadow-slate-500/20'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
          }`}
        >
          <span>📑</span> Registry ({history.procedures.length + history.telemetry_logs.length})
        </button>
      </div>

      {statusMessage && (
        <div className="p-3 bg-cyan-950/80 border border-cyan-500/40 text-cyan-200 text-sm rounded-lg flex items-center justify-between">
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage('')} className="text-cyan-400 hover:text-white ml-2">✕</button>
        </div>
      )}

      {/* TAB 1: ASFA GUIDELINES */}
      {activeTab === 'asfa' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-cyan-400 border-b border-slate-700/60 pb-2">
                Select Disease Indication (ASFA 8th/9th Edition)
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-400 block mb-1">Target Indication:</span>
                  <select
                    value={selectedIndication}
                    onChange={(e) => {
                      setSelectedIndication(e.target.value);
                      handleFetchAsfa(e.target.value);
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-200 font-medium"
                  >
                    <option value="TTP">Thrombotic Thrombocytopenic Purpura (TTP - Category I)</option>
                    <option value="guillain_barre">Guillain-Barré Syndrome (AIDP - Category I)</option>
                    <option value="myasthenic_crisis">Myasthenia Gravis Crisis (Category I)</option>
                    <option value="anti_gbm_goodpasture">Anti-GBM / Goodpasture Disease (Category I)</option>
                    <option value="cidp">Chronic Inflammatory Demyelinating Polyradiculoneuropathy (CIDP - Category I)</option>
                    <option value="catastrophic_aps">Catastrophic Antiphospholipid Syndrome (CAPS - Category I)</option>
                    <option value="hyperviscosity_myeloma">Hyperviscosity Syndrome in Myeloma/Waldenström (Category I)</option>
                    <option value="nmosd">Neuromyelitis Optica Spectrum Disorder (NMOSD - Category II)</option>
                    <option value="severe_sle_cerebritis">Severe SLE Cerebritis / Alveolar Hemorrhage (Category II)</option>
                    <option value="hashimoto_encephalopathy">Hashimoto Encephalopathy (Category II)</option>
                  </select>
                </div>

                {asfaData && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700 space-y-1">
                      <span className="text-slate-400 block text-[11px]">ASFA Category & Grade</span>
                      <span className="font-bold text-cyan-300 text-sm">{asfaData.category}</span>
                      <span className="text-slate-400 block text-[11px] mt-1">Grade: {asfaData.evidence_grade}</span>
                    </div>

                    <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700 space-y-1">
                      <span className="text-slate-400 block text-[11px]">Replacement Fluid</span>
                      <span className="font-bold text-cyan-300 text-sm">{asfaData.recommended_replacement_fluid.replace(/_/g, ' ')}</span>
                      <span className="text-slate-400 block text-[11px] mt-1">Dose: {asfaData.recommended_tpv_range}</span>
                    </div>

                    <div className="col-span-2 p-3 bg-slate-900/60 rounded-lg border border-slate-700 space-y-1">
                      <span className="text-slate-400 block text-[11px]">Recommended Treatment Schedule</span>
                      <span className="text-slate-200">{asfaData.recommended_frequency}</span>
                    </div>

                    <div className="col-span-2 p-3 bg-slate-900/60 rounded-lg border border-slate-700 space-y-1">
                      <span className="text-slate-400 block text-[11px]">Clinical Rationale</span>
                      <p className="text-slate-300 text-xs">{asfaData.clinical_summary}</p>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleSaveProcedure}
                disabled={isLoading}
                className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-xs transition flex items-center justify-center gap-2"
              >
                📝 Order Apheresis Procedure for Patient #{patientId}
              </button>
            </div>
          </div>

          {/* ASFA Summary Box */}
          <div className="space-y-4">
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-cyan-400 border-b border-slate-700/60 pb-2">
                Procedure Protocols
              </h3>
              <div className="text-xs text-slate-300 space-y-2">
                <p>• <strong>Category I:</strong> Disorders for which apheresis is accepted as first-line therapy, either as primary standalone treatment or in conjunction with other initial modes of therapy.</p>
                <p>• <strong>Category II:</strong> Disorders for which apheresis is accepted as second-line therapy, either as standalone or adjunctive.</p>
                <p>• <strong>Vascular Access:</strong> Dual-lumen hemodialysis catheter (12-14 Fr) typically required for flow rates of 50-100 mL/min.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PLASMIC & TTP PROTOCOL */}
      {activeTab === 'plasmic' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-rose-400 border-b border-slate-700/60 pb-2 flex items-center justify-between">
                <span>PLASMIC Diagnostic Scoring & Safety Engine</span>
                <span className="text-xs text-slate-400 font-normal">7-Variable Prediction of Severe ADAMTS13 Deficiency</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-1">Platelet Count (x10^3/uL):</span>
                  <input
                    type="number"
                    value={plateletCount}
                    onChange={(e) => setPlateletCount(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 font-mono text-rose-300"
                  />
                  <span className="text-[11px] text-slate-400">&lt; 30k = 1 point</span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Mean Corpuscular Volume (MCV, fL):</span>
                  <input
                    type="number"
                    value={mcv}
                    onChange={(e) => setMcv(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 font-mono text-rose-300"
                  />
                  <span className="text-[11px] text-slate-400">&lt; 90 fL = 1 point</span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">International Normalized Ratio (INR):</span>
                  <input
                    type="number"
                    step="0.1"
                    value={inr}
                    onChange={(e) => setInr(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 font-mono text-rose-300"
                  />
                  <span className="text-[11px] text-slate-400">&lt; 1.5 = 1 point</span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Serum Creatinine (mg/dL):</span>
                  <input
                    type="number"
                    step="0.1"
                    value={creatinine}
                    onChange={(e) => setCreatinine(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 font-mono text-rose-300"
                  />
                  <span className="text-[11px] text-slate-400">&lt; 2.0 mg/dL = 1 point</span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">ADAMTS13 Activity (%):</span>
                  <input
                    type="number"
                    step="0.5"
                    value={adamts13Activity}
                    onChange={(e) => setAdamts13Activity(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 font-mono text-cyan-300"
                  />
                  <span className="text-[11px] text-slate-400">&lt; 10% diagnostic of TTP</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
                <label className="flex items-center gap-2 p-2.5 bg-slate-900/60 rounded border border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hemolysisPresent}
                    onChange={(e) => setHemolysisPresent(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-600 text-rose-500"
                  />
                  <span>Hemolysis Present (Retics &gt; 2.5%, low hapto)</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 bg-slate-900/60 rounded border border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!activeCancer}
                    onChange={(e) => setActiveCancer(!e.target.checked)}
                    className="rounded bg-slate-800 border-slate-600 text-rose-500"
                  />
                  <span>No Active Cancer in Past Year</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 bg-slate-900/60 rounded border border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!transplantHistory}
                    onChange={(e) => setTransplantHistory(!e.target.checked)}
                    className="rounded bg-slate-800 border-slate-600 text-rose-500"
                  />
                  <span>No Solid Organ / Stem Cell Transplant</span>
                </label>
              </div>

              <button
                onClick={handleEvaluatePlasmic}
                disabled={isLoading}
                className="w-full bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-xs transition"
              >
                {isLoading ? 'Evaluating...' : '🚨 Calculate PLASMIC Score & Verify Safety Interlocks'}
              </button>
            </div>
          </div>

          {/* PLASMIC Results Card */}
          <div className="space-y-4">
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-rose-400 border-b border-slate-700/60 pb-2">
                TTP Risk & Safety Interlock
              </h3>

              {plasmicResult ? (
                <div className="space-y-4">
                  <div className={`p-4 rounded-lg border text-center ${
                    plasmicResult.risk_category === 'HIGH'
                      ? 'bg-rose-950/70 border-rose-600 text-rose-200'
                      : plasmicResult.risk_category === 'INTERMEDIATE'
                      ? 'bg-amber-950/70 border-amber-600 text-amber-200'
                      : 'bg-emerald-950/70 border-emerald-600 text-emerald-200'
                  }`}>
                    <span className="text-xs uppercase tracking-wider opacity-80 block mb-1">PLASMIC Score</span>
                    <div className="text-3xl font-black font-mono">
                      {plasmicResult.score} / 7
                    </div>
                    <span className="text-xs mt-1 block">
                      Category: <strong>{plasmicResult.risk_category} RISK</strong> (~{plasmicResult.severe_adamts13_deficiency_probability_percent}% severe ADAMTS13 deficiency)
                    </span>
                  </div>

                  {plasmicResult.platelet_transfusion_contraindicated && (
                    <div className="p-3 bg-red-950/80 border-2 border-red-600 rounded-lg text-xs text-red-200 space-y-1">
                      <span className="font-bold flex items-center gap-1.5 text-red-100 text-sm">
                        <span>🛑</span> BLACK-BOX CONTRAINDICATION
                      </span>
                      <p>{plasmicResult.black_box_warning}</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1">
                      <span>📋</span> Urgent Clinical Actions
                    </h4>
                    <div className="space-y-1.5">
                      {plasmicResult.management_plan.map((p, i) => (
                        <div key={i} className="p-2 bg-rose-950/30 border border-rose-800/40 rounded text-xs text-rose-200">
                          • {p}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 text-xs">
                  Run the PLASMIC assessment to verify TTP risk and contraindications.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TPV DOSING CALCULATOR */}
      {activeTab === 'tpv' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-blue-400 border-b border-slate-700/60 pb-2">
                Total Plasma Volume (TPV) Solver
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-1">Patient Weight (kg):</span>
                  <input
                    type="number"
                    value={weightKg}
                    onChange={(e) => setWeightKg(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 font-mono text-blue-300"
                  />
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Biological Gender:</span>
                  <select
                    value={gender}
                    onChange={(e: any) => setGender(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-200"
                  >
                    <option value="MALE">Male (70 mL/kg TBV)</option>
                    <option value="FEMALE">Female (65 mL/kg TBV)</option>
                  </select>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Current Hematocrit (%):</span>
                  <input
                    type="number"
                    step="0.1"
                    value={hctPercent}
                    onChange={(e) => setHctPercent(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 font-mono text-blue-300"
                  />
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Prescribed Exchange TPV Fraction:</span>
                  <select
                    value={tpvFraction}
                    onChange={(e) => setTpvFraction(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-200"
                  >
                    <option value={1.0}>1.0 TPV (~63.2% solute clearance)</option>
                    <option value={1.25}>1.25 TPV (~71.3% solute clearance)</option>
                    <option value={1.5}>1.5 TPV (~77.7% solute clearance)</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleCalculateVolume}
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-xs transition"
              >
                {isLoading ? 'Calculating...' : '🧪 Calculate Total Plasma Volume & Exchange Target'}
              </button>
            </div>
          </div>

          {/* Volume Results Card */}
          <div className="space-y-4">
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-blue-400 border-b border-slate-700/60 pb-2">
                Prescription Volumes
              </h3>

              {volumeResult ? (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-900/60 rounded border border-slate-700 text-center">
                    <span className="text-slate-400 block text-[11px]">Total Blood Volume (TBV)</span>
                    <span className="text-xl font-bold font-mono text-blue-300">{volumeResult.total_blood_volume_ml} mL</span>
                  </div>

                  <div className="p-3 bg-slate-900/60 rounded border border-slate-700 text-center">
                    <span className="text-slate-400 block text-[11px]">Total Plasma Volume (TPV)</span>
                    <span className="text-2xl font-bold font-mono text-cyan-300">{volumeResult.total_plasma_volume_ml} mL</span>
                  </div>

                  <div className="p-4 bg-blue-950/60 rounded border border-blue-600 text-center">
                    <span className="text-slate-400 block text-xs">Target Exchange Volume</span>
                    <span className="text-3xl font-black font-mono text-white">{volumeResult.target_exchange_volume_ml} mL</span>
                    <span className="text-xs text-blue-300 block mt-1">
                      Expected Solute Removal: <strong>{volumeResult.solute_removal_fraction_percent}%</strong>
                    </span>
                  </div>

                  <span className="text-[11px] text-slate-400 block">{volumeResult.formula_basis}</span>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 text-xs">
                  Calculate plasma volume to establish exact infusion replacement targets.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CITRATE & CALCIUM SENTINEL */}
      {activeTab === 'calcium' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-400 border-b border-slate-700/60 pb-2">
                ACD-A Citrate & Ionized Hypocalcemia Monitor
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-1">Systemic Ionized Calcium (mmol/L):</span>
                  <input
                    type="number"
                    step="0.02"
                    value={ionizedCalcium}
                    onChange={(e) => setIonizedCalcium(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 font-mono text-amber-300"
                  />
                  <span className="text-[11px] text-slate-400">Target Range: 1.10 - 1.30 mmol/L</span>
                </div>

                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-200">
                    <input
                      type="checkbox"
                      checked={hypocalcemiaSymptoms}
                      onChange={(e) => setHypocalcemiaSymptoms(e.target.checked)}
                      className="rounded bg-slate-800 border-slate-600 text-amber-500"
                    />
                    <span>Hypocalcemia Symptoms Present</span>
                  </label>
                  <span className="text-[11px] text-slate-400 block mt-1">Perioral tingling, finger paresthesias, muscle cramping, prolonged QTc</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleEvaluateCalcium}
                  disabled={isLoading}
                  className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-xs transition"
                >
                  {isLoading ? 'Evaluating...' : '⚡ Assess Citrate Anticoagulation & Calcium Status'}
                </button>
                <button
                  onClick={handleLogTelemetry}
                  disabled={isLoading}
                  className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-amber-300 border border-amber-500/40 px-4 py-2 rounded-lg text-xs transition"
                >
                  📝 Log Telemetry
                </button>
              </div>
            </div>
          </div>

          {/* Calcium Output Card */}
          <div className="space-y-4">
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-400 border-b border-slate-700/60 pb-2">
                Calcium Replacement Directives
              </h3>

              {calciumResult ? (
                <div className="space-y-4">
                  <div className={`p-4 rounded-lg border text-center ${
                    calciumResult.calcium_status === 'SEVERE_CRITICAL_HYPOCALCEMIA'
                      ? 'bg-rose-950/70 border-rose-600 text-rose-200'
                      : calciumResult.calcium_status === 'MILD_HYPOCALCEMIA'
                      ? 'bg-amber-950/70 border-amber-600 text-amber-200'
                      : 'bg-emerald-950/70 border-emerald-600 text-emerald-200'
                  }`}>
                    <span className="text-xs uppercase tracking-wider opacity-80 block mb-1">Status</span>
                    <div className="text-xl font-black font-mono">
                      {calciumResult.calcium_status.replace(/_/g, ' ')}
                    </div>
                    {calciumResult.emergency_calcium_bolus_required && (
                      <div className="mt-2 inline-block bg-rose-600 text-white font-bold px-3 py-1 rounded-full text-xs animate-pulse">
                        ⚠️ STAT IV CALCIUM BOLUS REQUIRED
                      </div>
                    )}
                  </div>

                  {calciumResult.bolus_dose_instructions && (
                    <div className="p-3 bg-red-950/60 border border-red-700 rounded text-xs text-red-200">
                      <strong>Bolus Directive:</strong> {calciumResult.bolus_dose_instructions}
                    </div>
                  )}

                  <div className="p-3 bg-slate-900/60 rounded border border-slate-700 text-xs">
                    <span className="text-slate-400 block mb-1">Continuous Infusion Adjustment:</span>
                    <p className="text-slate-200">{calciumResult.continuous_infusion_adjustment}</p>
                  </div>

                  <div className="space-y-1.5">
                    {calciumResult.actionable_checklist.map((c, i) => (
                      <div key={i} className="p-2 bg-amber-950/30 border border-amber-800/40 rounded text-xs text-amber-200">
                        • {c}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 text-xs">
                  Run the calcium assessment to determine IV repletion boluses and infusion titrations.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: REGISTRY & HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Procedures Table */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-cyan-400 border-b border-slate-700/60 pb-2">
              Apheresis Orders & Configurations ({history.procedures.length})
            </h3>
            {history.procedures.length === 0 ? (
              <p className="text-xs text-slate-400">No apheresis procedures logged yet for this patient.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400">
                      <th className="p-2">Indication</th>
                      <th className="p-2">ASFA Category</th>
                      <th className="p-2">PLASMIC</th>
                      <th className="p-2">TPV (mL)</th>
                      <th className="p-2">Target Volume</th>
                      <th className="p-2">Replacement Fluid</th>
                      <th className="p-2">No Platelets</th>
                      <th className="p-2">Ordered At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {history.procedures.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-800/40">
                        <td className="p-2 font-mono text-cyan-300">{p.asfa_indication}</td>
                        <td className="p-2 font-mono">{p.asfa_category}</td>
                        <td className="p-2 font-mono font-bold text-rose-400">{p.plasmic_score !== null ? `${p.plasmic_score} / 7` : '—'}</td>
                        <td className="p-2 font-mono">{p.total_plasma_volume_ml} mL</td>
                        <td className="p-2 font-mono">{p.total_exchange_volume_ml} mL</td>
                        <td className="p-2 font-mono text-[11px]">{p.replacement_fluid}</td>
                        <td className="p-2">
                          {p.platelet_transfusion_contraindicated ? (
                            <span className="text-rose-400 font-bold">🛑 CONTRAINDICATED</span>
                          ) : (
                            <span className="text-slate-400">Standard</span>
                          )}
                        </td>
                        <td className="p-2 text-slate-400 font-mono text-[11px]">{new Date(p.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Telemetry Table */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-400 border-b border-slate-700/60 pb-2">
              Exchange Telemetry Logs ({history.telemetry_logs.length})
            </h3>
            {history.telemetry_logs.length === 0 ? (
              <p className="text-xs text-slate-400">No telemetry logs saved yet for this patient.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400">
                      <th className="p-2">Blood Processed</th>
                      <th className="p-2">Plasma Removed</th>
                      <th className="p-2">Replacement</th>
                      <th className="p-2">ACD-A Vol</th>
                      <th className="p-2">Ionized Ca2+</th>
                      <th className="p-2">Ca Infused</th>
                      <th className="p-2">Alert</th>
                      <th className="p-2">Logged At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {history.telemetry_logs.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-800/40">
                        <td className="p-2 font-mono">{t.blood_processed_ml} mL</td>
                        <td className="p-2 font-mono">{t.plasma_removed_ml} mL</td>
                        <td className="p-2 font-mono">{t.replacement_administered_ml} mL</td>
                        <td className="p-2 font-mono">{t.acda_citrate_volume_ml} mL</td>
                        <td className="p-2 font-mono font-bold text-amber-300">{t.systemic_ionized_calcium_mmol_l} mmol/L</td>
                        <td className="p-2 font-mono">{t.calcium_gluconate_infused_g} g</td>
                        <td className="p-2">
                          {t.hypocalcemia_alert ? (
                            <span className="text-rose-400 font-bold">⚠️ HYPOCALCEMIA</span>
                          ) : (
                            <span className="text-emerald-400">Normal</span>
                          )}
                        </td>
                        <td className="p-2 text-slate-400 font-mono text-[11px]">{new Date(t.logged_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
export default PheresisCmdHub;
