import React, { useState, useEffect } from 'react';

interface AtlantaResult {
  severity: 'MILD' | 'MODERATELY_SEVERE' | 'SEVERE';
  organ_failure_type: 'NONE' | 'TRANSIENT' | 'PERSISTENT';
  marshall_score: number;
  organ_failure_systems: string[];
  icu_admission_indicated: boolean;
  clinical_recommendations: string[];
}

interface BisapResult {
  score: number;
  criteria_met: string[];
  mortality_risk_category: 'LOW' | 'INTERMEDIATE' | 'HIGH';
  estimated_mortality_percent: number;
  clinical_guidance: string[];
}

interface FluidResult {
  recommended_rate_ml_hr: number;
  fluid_choice: string;
  hematocrit_status: 'HEMOCONCENTRATED' | 'TARGET_RANGE' | 'OVERDILUTED';
  bun_trajectory: 'IMPROVING' | 'STATIONARY' | 'WORSENING';
  resuscitation_adequacy: 'OPTIMAL' | 'UNDER_RESUSCITATED' | 'OVER_RESUSCITATED_AT_RISK';
  clinical_actions: string[];
}

interface StepUpResult {
  infection_confirmed_or_strongly_suspected: boolean;
  recommended_step: string;
  antimicrobial_guidance: string;
  procedure_timing: string;
  surgical_consultation_required: boolean;
  action_plan: string[];
}

interface Tg18Result {
  suspected_acute_cholangitis: boolean;
  tg18_severity: 'GRADE_I_MILD' | 'GRADE_II_MODERATE' | 'GRADE_III_SEVERE' | 'NOT_CHOLANGITIS';
  ercp_timing: 'EMERGENT_WITHIN_24H' | 'URGENT_WITHIN_48H' | 'ELECTIVE_INDEX_ADMISSION' | 'NOT_INDICATED';
  cholecystectomy_recommendation: string;
  antimicrobial_coverage: string[];
}

export const PancreasAlertHub: React.FC = () => {
  const [patientId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'atlanta_bisap' | 'fluids' | 'stepup' | 'biliary' | 'history'>('atlanta_bisap');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Atlanta & BISAP State
  const [etiology, setEtiology] = useState<string>('biliary_gallstone');
  const [pao2Fio2, setPao2Fio2] = useState<number>(280);
  const [creatinine, setCreatinine] = useState<number>(2.1);
  const [systolicBp, setSystolicBp] = useState<number>(88);
  const [durationHours, setDurationHours] = useState<number>(52);
  const [localComplication, setLocalComplication] = useState<string>('acute_necrotic_collection');
  const [bun, setBun] = useState<number>(34);
  const [impairedGcs, setImpairedGcs] = useState<boolean>(true);
  const [sirsCount, setSirsCount] = useState<number>(3);
  const [age, setAge] = useState<number>(65);
  const [pleuralEffusion, setPleuralEffusion] = useState<boolean>(true);

  const [atlantaResult, setAtlantaResult] = useState<AtlantaResult | null>(null);
  const [bisapResult, setBisapResult] = useState<BisapResult | null>(null);

  // Fluid State
  const [patientWeight, setPatientWeight] = useState<number>(75);
  const [fluidType, setFluidType] = useState<'Lactated_Ringers' | 'Normal_Saline'>('Lactated_Ringers');
  const [currentFluidRate, setCurrentFluidRate] = useState<number>(150);
  const [hct, setHct] = useState<number>(46.2);
  const [prevBun, setPrevBun] = useState<number>(26);
  const [urineOutput, setUrineOutput] = useState<number>(0.35);
  const [fluidOverloadSigns, setFluidOverloadSigns] = useState<boolean>(false);
  const [fluidResult, setFluidResult] = useState<FluidResult | null>(null);

  // Dutch Step-Up State
  const [necrosisPresent, setNecrosisPresent] = useState<boolean>(true);
  const [necrosisType, setNecrosisType] = useState<'STERILE' | 'SUSPECTED_INFECTED' | 'CONFIRMED_INFECTED'>('CONFIRMED_INFECTED');
  const [gasOnCt, setGasOnCt] = useState<boolean>(true);
  const [daysSinceOnset, setDaysSinceOnset] = useState<number>(14);
  const [currentStep, setCurrentStep] = useState<'CONSERVATIVE_MEDICAL' | 'PERCUTANEOUS_CATHETER_DRAINAGE' | 'ENDOSCOPIC_TRANSMURAL_DRAINAGE' | 'VARD_MINIMALLY_INVASIVE' | 'OPEN_NECROSECTOMY'>('CONSERVATIVE_MEDICAL');
  const [hoursAtStep, setHoursAtStep] = useState<number>(48);
  const [clinicalResponse, setClinicalResponse] = useState<'IMPROVING' | 'STABLE' | 'DETERIORATING'>('DETERIORATING');
  const [drainageMl, setDrainageMl] = useState<number>(150);
  const [stepUpResult, setStepUpResult] = useState<StepUpResult | null>(null);

  // Tokyo TG18 State
  const [tempCelsius, setTempCelsius] = useState<number>(39.2);
  const [bilirubin, setBilirubin] = useState<number>(5.8);
  const [ruqPain, setRuqPain] = useState<boolean>(true);
  const [wbcCount, setWbcCount] = useState<number>(17.2);
  const [organDysfunctionTg18, setOrganDysfunctionTg18] = useState<boolean>(true);
  const [gallstonesPresent, setGallstonesPresent] = useState<boolean>(true);
  const [tg18Result, setTg18Result] = useState<Tg18Result | null>(null);

  // History State
  const [history, setHistory] = useState<{ encounters: any[]; step_up_interventions: any[] }>({
    encounters: [],
    step_up_interventions: []
  });

  const fetchHistory = async () => {
    try {
      const res = await fetch(`/api/clinician/pancreatitis/patients/${patientId}/history`);
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
  }, [patientId]);

  const handleEvaluateAtlantaBisap = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const [atlantaRes, bisapRes] = await Promise.all([
        fetch('/api/clinician/pancreatitis/evaluate-atlanta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organ_failure_present: durationHours > 0 && (pao2Fio2 <= 300 || creatinine >= 1.9 || systolicBp < 90),
            organ_failure_duration_hours: durationHours,
            respiratory_pao2_fio2: pao2Fio2,
            renal_creatinine_mg_dl: creatinine,
            cardiovascular_systolic_bp: systolicBp,
            local_complications: localComplication !== 'none' ? [localComplication] : [],
            systemic_complications: false
          })
        }),
        fetch('/api/clinician/pancreatitis/evaluate-bisap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bun_mg_dl: bun,
            impaired_mental_status: impairedGcs,
            sirs_criteria_count: sirsCount,
            age,
            pleural_effusion: pleuralEffusion
          })
        })
      ]);

      if (atlantaRes.ok && bisapRes.ok) {
        const atData = await atlantaRes.json();
        const biData = await bisapRes.json();
        setAtlantaResult(atData);
        setBisapResult(biData);
        setStatusMessage('Atlanta Classification & BISAP score calculated.');
      } else {
        setStatusMessage('Evaluation failed.');
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEvaluateFluid = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const res = await fetch('/api/clinician/pancreatitis/evaluate-fluid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weight_kg: patientWeight,
          fluid_type: fluidType,
          current_rate_ml_hr: currentFluidRate,
          hematocrit_percent: hct,
          bun_mg_dl: bun,
          previous_bun_mg_dl: prevBun,
          urine_output_ml_kg_hr: urineOutput,
          signs_of_fluid_overload: fluidOverloadSigns
        })
      });
      if (res.ok) {
        const data = await res.json();
        setFluidResult(data);
        setStatusMessage('Fluid resuscitation kinetics evaluated.');
      } else {
        setStatusMessage('Fluid evaluation failed.');
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEvaluateStepUp = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const res = await fetch('/api/clinician/pancreatitis/evaluate-stepup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          necrosis_present: necrosisPresent,
          necrosis_type: necrosisType,
          gas_on_ct: gasOnCt,
          days_since_onset: daysSinceOnset,
          current_step: currentStep,
          hours_at_current_step: hoursAtStep,
          clinical_response: clinicalResponse,
          drainage_output_ml_24h: drainageMl
        })
      });
      if (res.ok) {
        const data = await res.json();
        setStepUpResult(data);
        setStatusMessage('Dutch Step-Up trajectory evaluated.');
      } else {
        setStatusMessage('Step-Up evaluation failed.');
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEvaluateTg18 = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const res = await fetch('/api/clinician/pancreatitis/evaluate-tg18', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fever_temp_celsius: tempCelsius,
          jaundice_or_bilirubin_mg_dl: bilirubin,
          ruq_pain: ruqPain,
          wbc_count_k: wbcCount,
          organ_dysfunction_present: organDysfunctionTg18,
          gallstones_or_biliary_dilation: gallstonesPresent
        })
      });
      if (res.ok) {
        const data = await res.json();
        setTg18Result(data);
        setStatusMessage('Tokyo TG18 biliary guidelines evaluated.');
      } else {
        setStatusMessage('TG18 evaluation failed.');
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveEncounter = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const atRes = await fetch('/api/clinician/pancreatitis/evaluate-atlanta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organ_failure_present: durationHours > 0 && (pao2Fio2 <= 300 || creatinine >= 1.9 || systolicBp < 90),
          organ_failure_duration_hours: durationHours,
          respiratory_pao2_fio2: pao2Fio2,
          renal_creatinine_mg_dl: creatinine,
          cardiovascular_systolic_bp: systolicBp,
          local_complications: localComplication !== 'none' ? [localComplication] : []
        })
      });
      const atData = await atRes.json();

      const biRes = await fetch('/api/clinician/pancreatitis/evaluate-bisap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bun_mg_dl: bun,
          impaired_mental_status: impairedGcs,
          sirs_criteria_count: sirsCount,
          age,
          pleural_effusion: pleuralEffusion
        })
      });
      const biData = await biRes.json();

      const tgRes = await fetch('/api/clinician/pancreatitis/evaluate-tg18', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fever_temp_celsius: tempCelsius,
          jaundice_or_bilirubin_mg_dl: bilirubin,
          ruq_pain: ruqPain,
          wbc_count_k: wbcCount,
          organ_dysfunction_present: organDysfunctionTg18,
          gallstones_or_biliary_dilation: gallstonesPresent
        })
      });
      const tgData = await tgRes.json();

      const res = await fetch('/api/clinician/pancreatitis/encounters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          etiology,
          atlanta_severity: atData.severity,
          bisap_score: biData.score,
          sirs_present: sirsCount >= 2,
          organ_failure_persistent: atData.organ_failure_type === 'PERSISTENT',
          fluid_rate_ml_hr: currentFluidRate,
          fluid_type: fluidType,
          hematocrit_percent: hct,
          bun_mg_dl: bun,
          urine_output_ml_kg_hr: urineOutput,
          gallstone_cholangitis_suspected: tgData.suspected_acute_cholangitis,
          tg18_severity: tgData.tg18_severity,
          ercp_recommended_within_24h: tgData.ercp_timing === 'EMERGENT_WITHIN_24H'
        })
      });

      if (res.ok) {
        setStatusMessage('Acute pancreatitis encounter saved to chart.');
        fetchHistory();
      } else {
        setStatusMessage('Failed to save encounter.');
      }
    } catch (err: any) {
      setStatusMessage(`Error saving encounter: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveStepUp = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const stepRes = await fetch('/api/clinician/pancreatitis/evaluate-stepup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          necrosis_present: necrosisPresent,
          necrosis_type: necrosisType,
          gas_on_ct: gasOnCt,
          days_since_onset: daysSinceOnset,
          current_step: currentStep,
          hours_at_current_step: hoursAtStep,
          clinical_response: clinicalResponse,
          drainage_output_ml_24h: drainageMl
        })
      });
      const stepData = await stepRes.json();

      const encounterId = history.encounters.length > 0 ? history.encounters[0].id : 1;

      const res = await fetch('/api/clinician/pancreatitis/stepup-interventions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encounter_id: encounterId,
          patient_id: patientId,
          necrosis_type: necrosisType,
          gas_on_ct: gasOnCt,
          current_step: currentStep,
          clinical_response: clinicalResponse,
          drainage_output_ml_24h: drainageMl,
          next_recommended_step: stepData.recommended_step,
          antimicrobial_regimen: stepData.antimicrobial_guidance
        })
      });

      if (res.ok) {
        setStatusMessage('Dutch Step-Up intervention logged to registry.');
        fetchHistory();
      } else {
        setStatusMessage('Failed to log step-up intervention.');
      }
    } catch (err: any) {
      setStatusMessage(`Error logging intervention: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-orange-500/30 rounded-xl p-6 text-slate-100 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-orange-500/20 text-orange-400 rounded-lg text-2xl">🔥</span>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
                PANCREAS-ALERT: Acute Pancreatitis & Step-Up Command
                <span className="text-xs bg-orange-500/20 text-orange-300 font-mono px-2 py-0.5 rounded border border-orange-500/30">
                  PHASE 76
                </span>
              </h2>
              <p className="text-sm text-slate-400">
                Revised Atlanta (2012), BISAP Scoring, Goal-Directed LR Resuscitation, Dutch Step-Up Necrosectomy, Tokyo TG18 Biliary/ERCP
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
          onClick={() => setActiveTab('atlanta_bisap')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition flex items-center gap-2 ${
            activeTab === 'atlanta_bisap'
              ? 'bg-orange-600 text-white shadow-lg shadow-orange-500/20'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
          }`}
        >
          <span>📊</span> Atlanta & BISAP Severity
        </button>
        <button
          onClick={() => setActiveTab('fluids')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition flex items-center gap-2 ${
            activeTab === 'fluids'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
          }`}
        >
          <span>💧</span> Goal-Directed Hydration
        </button>
        <button
          onClick={() => setActiveTab('stepup')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition flex items-center gap-2 ${
            activeTab === 'stepup'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/20'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
          }`}
        >
          <span>🪜</span> Dutch Step-Up & Necrosis
        </button>
        <button
          onClick={() => setActiveTab('biliary')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition flex items-center gap-2 ${
            activeTab === 'biliary'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
          }`}
        >
          <span>🩺</span> Tokyo TG18 Biliary/ERCP
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition flex items-center gap-2 ${
            activeTab === 'history'
              ? 'bg-slate-700 text-white shadow-lg shadow-slate-500/20'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
          }`}
        >
          <span>📑</span> History ({history.encounters.length + history.step_up_interventions.length})
        </button>
      </div>

      {statusMessage && (
        <div className="p-3 bg-orange-950/80 border border-orange-500/40 text-orange-200 text-sm rounded-lg flex items-center justify-between">
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage('')} className="text-orange-400 hover:text-white ml-2">✕</button>
        </div>
      )}

      {/* TAB 1: ATLANTA & BISAP SEVERITY */}
      {activeTab === 'atlanta_bisap' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-orange-400 border-b border-slate-700/60 pb-2 flex items-center justify-between">
                <span>Clinical & Physiological Staging Parameters</span>
                <span className="text-xs text-slate-400 font-normal">Modified Marshall & BISAP Models</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-1">Etiology:</span>
                  <select
                    value={etiology}
                    onChange={(e) => setEtiology(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-200"
                  >
                    <option value="biliary_gallstone">Biliary / Gallstone Pancreatitis</option>
                    <option value="alcohol_induced">Alcohol-Induced Pancreatitis</option>
                    <option value="hypertriglyceridemia">Severe Hypertriglyceridemia (&gt; 1000 mg/dL)</option>
                    <option value="post_ercp">Post-ERCP Pancreatitis</option>
                    <option value="drug_induced">Drug-Induced Pancreatitis</option>
                    <option value="idiopathic">Idiopathic Pancreatitis</option>
                  </select>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Organ Failure Duration (Hours):</span>
                  <input
                    type="number"
                    value={durationHours}
                    onChange={(e) => setDurationHours(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 font-mono text-orange-300"
                  />
                  <span className="text-[11px] text-slate-400">&gt;= 48h = Persistent Organ Failure (Severe)</span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Respiratory PaO2 / FiO2 Ratio:</span>
                  <input
                    type="number"
                    value={pao2Fio2}
                    onChange={(e) => setPao2Fio2(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 font-mono text-orange-300"
                  />
                  <span className="text-[11px] text-slate-400">&lt;= 300 signifies organ failure</span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Renal Serum Creatinine (mg/dL):</span>
                  <input
                    type="number"
                    step="0.1"
                    value={creatinine}
                    onChange={(e) => setCreatinine(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 font-mono text-orange-300"
                  />
                  <span className="text-[11px] text-slate-400">&gt;= 1.9 mg/dL signifies organ failure</span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Cardiovascular Systolic BP (mmHg):</span>
                  <input
                    type="number"
                    value={systolicBp}
                    onChange={(e) => setSystolicBp(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 font-mono text-orange-300"
                  />
                  <span className="text-[11px] text-slate-400">&lt; 90 mmHg fluid-unresponsive failure</span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Local Pancreatic Complications:</span>
                  <select
                    value={localComplication}
                    onChange={(e) => setLocalComplication(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-200"
                  >
                    <option value="none">None (Interstitial edematous only)</option>
                    <option value="acute_peripancreatic_fluid_collection">Acute Peripancreatic Fluid Collection (APFC)</option>
                    <option value="acute_necrotic_collection">Acute Necrotic Collection (ANC)</option>
                    <option value="walled_off_necrosis">Walled-Off Necrosis (WON, &gt; 4 weeks)</option>
                    <option value="pseudocyst">Pancreatic Pseudocyst (&gt; 4 weeks)</option>
                  </select>
                </div>

                {/* BISAP Inputs */}
                <div>
                  <span className="text-slate-400 block mb-1">Blood Urea Nitrogen (BUN, mg/dL):</span>
                  <input
                    type="number"
                    value={bun}
                    onChange={(e) => setBun(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 font-mono text-orange-300"
                  />
                  <span className="text-[11px] text-slate-400">&gt; 25 mg/dL earns 1 BISAP point</span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Patient Age (Years):</span>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 font-mono text-orange-300"
                  />
                  <span className="text-[11px] text-slate-400">&gt; 60 yo earns 1 BISAP point</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
                <label className="flex items-center gap-2 p-2.5 bg-slate-900/60 rounded border border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={impairedGcs}
                    onChange={(e) => setImpairedGcs(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-600 text-orange-500"
                  />
                  <span>Impaired Mental Status (GCS &lt; 15)</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 bg-slate-900/60 rounded border border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sirsCount >= 2}
                    onChange={(e) => setSirsCount(e.target.checked ? 2 : 0)}
                    className="rounded bg-slate-800 border-slate-600 text-orange-500"
                  />
                  <span>SIRS Criteria Present (&gt;= 2)</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 bg-slate-900/60 rounded border border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pleuralEffusion}
                    onChange={(e) => setPleuralEffusion(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-600 text-orange-500"
                  />
                  <span>Pleural Effusion on Imaging</span>
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleEvaluateAtlantaBisap}
                  disabled={isLoading}
                  className="flex-1 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-xs transition"
                >
                  {isLoading ? 'Evaluating...' : '⚡ Evaluate Atlanta Classification & BISAP'}
                </button>
                <button
                  onClick={handleSaveEncounter}
                  disabled={isLoading}
                  className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-orange-300 border border-orange-500/40 px-4 py-2 rounded-lg text-xs transition flex items-center gap-1.5"
                >
                  💾 Save Encounter
                </button>
              </div>
            </div>
          </div>

          {/* Staging Results Card */}
          <div className="space-y-4">
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-orange-400 border-b border-slate-700/60 pb-2">
                Severity & Risk Prognosis
              </h3>

              {atlantaResult && bisapResult ? (
                <div className="space-y-4">
                  {/* Atlanta Classification Badge */}
                  <div className={`p-4 rounded-lg border text-center ${
                    atlantaResult.severity === 'SEVERE'
                      ? 'bg-rose-950/70 border-rose-600 text-rose-200'
                      : atlantaResult.severity === 'MODERATELY_SEVERE'
                      ? 'bg-amber-950/70 border-amber-600 text-amber-200'
                      : 'bg-emerald-950/70 border-emerald-600 text-emerald-200'
                  }`}>
                    <span className="text-xs uppercase tracking-wider opacity-80 block mb-1">Revised Atlanta Classification</span>
                    <div className="text-2xl font-black font-mono">
                      {atlantaResult.severity.replace('_', ' ')}
                    </div>
                    <span className="text-xs mt-1 block">
                      Organ Failure: <strong>{atlantaResult.organ_failure_type}</strong> (Marshall: {atlantaResult.marshall_score})
                    </span>
                    {atlantaResult.icu_admission_indicated && (
                      <div className="mt-2 inline-block bg-rose-600 text-white font-bold px-3 py-1 rounded-full text-xs animate-pulse">
                        🚨 IMMEDIATE ICU ADMISSION MANDATORY
                      </div>
                    )}
                  </div>

                  {/* BISAP Score Box */}
                  <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700 text-center">
                    <span className="text-xs text-slate-400 block mb-1">BISAP Mortality Score</span>
                    <div className="text-3xl font-black font-mono text-orange-400">
                      {bisapResult.score} / 5
                    </div>
                    <span className="text-xs text-slate-300 block mt-1">
                      Risk Category: <strong>{bisapResult.mortality_risk_category}</strong> (~{bisapResult.estimated_mortality_percent}% in-hospital mortality)
                    </span>
                  </div>

                  {/* Recommendations */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-orange-300 flex items-center gap-1">
                      <span>📋</span> Evidence-Based Action Items
                    </h4>
                    <div className="space-y-1.5">
                      {atlantaResult.clinical_recommendations.map((rec, i) => (
                        <div key={i} className="p-2 bg-orange-950/30 border border-orange-800/40 rounded text-xs text-orange-200">
                          • {rec}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 text-xs">
                  Run the Atlanta & BISAP evaluation to see prognostic risk scoring and ICU triaging.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: GOAL-DIRECTED HYDRATION */}
      {activeTab === 'fluids' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-blue-400 border-b border-slate-700/60 pb-2 flex items-center justify-between">
                <span>Microvascular Perfusion & Fluid Kinetics</span>
                <span className="text-xs text-slate-400 font-normal">Target Hct 35-44% & Urine &gt;= 0.5 mL/kg/h</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-1">Patient Weight (kg):</span>
                  <input
                    type="number"
                    value={patientWeight}
                    onChange={(e) => setPatientWeight(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 font-mono text-blue-300"
                  />
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Crystalloid Solution Choice:</span>
                  <select
                    value={fluidType}
                    onChange={(e: any) => setFluidType(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-200"
                  >
                    <option value="Lactated_Ringers">Lactated Ringers (Preferred: lowers SIRS & acidosis)</option>
                    <option value="Normal_Saline">Normal Saline 0.9% (Hyperchloremic acidosis risk)</option>
                  </select>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Current Infusion Rate (mL/hr):</span>
                  <input
                    type="number"
                    value={currentFluidRate}
                    onChange={(e) => setCurrentFluidRate(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 font-mono text-blue-300"
                  />
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Current Hematocrit (%):</span>
                  <input
                    type="number"
                    step="0.1"
                    value={hct}
                    onChange={(e) => setHct(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 font-mono text-blue-300"
                  />
                  <span className="text-[11px] text-slate-400">&gt; 44% = hemoconcentration</span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Current BUN vs Previous (mg/dL):</span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={bun}
                      onChange={(e) => setBun(Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-2 font-mono text-blue-300"
                      placeholder="Current"
                    />
                    <input
                      type="number"
                      value={prevBun}
                      onChange={(e) => setPrevBun(Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-2 font-mono text-slate-300"
                      placeholder="Previous"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Hourly Urine Output (mL/kg/hr):</span>
                  <input
                    type="number"
                    step="0.05"
                    value={urineOutput}
                    onChange={(e) => setUrineOutput(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 font-mono text-blue-300"
                  />
                  <span className="text-[11px] text-slate-400">Target &gt;= 0.5 - 1.0 mL/kg/hr</span>
                </div>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fluidOverloadSigns}
                    onChange={(e) => setFluidOverloadSigns(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-600 text-rose-500 w-4 h-4"
                  />
                  <span className="text-rose-300 font-bold">
                    Signs of Fluid Overload Present (Hypoxemia, pulmonary edema, CVP &gt; 12 mmHg, abdominal distension)
                  </span>
                </label>
              </div>

              <button
                onClick={handleEvaluateFluid}
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-xs transition"
              >
                {isLoading ? 'Evaluating...' : '💧 Calculate Goal-Directed Fluid Adequacy'}
              </button>
            </div>
          </div>

          {/* Fluid Adequacy Card */}
          <div className="space-y-4">
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-blue-400 border-b border-slate-700/60 pb-2">
                Resuscitation Adequacy
              </h3>

              {fluidResult ? (
                <div className="space-y-4">
                  <div className={`p-4 rounded-lg border text-center ${
                    fluidResult.resuscitation_adequacy === 'UNDER_RESUSCITATED'
                      ? 'bg-amber-950/70 border-amber-600 text-amber-200'
                      : fluidResult.resuscitation_adequacy === 'OVER_RESUSCITATED_AT_RISK'
                      ? 'bg-rose-950/70 border-rose-600 text-rose-200'
                      : 'bg-emerald-950/70 border-emerald-600 text-emerald-200'
                  }`}>
                    <span className="text-xs uppercase tracking-wider opacity-80 block mb-1">Hemodynamic Volume Status</span>
                    <div className="text-2xl font-black font-mono">
                      {fluidResult.resuscitation_adequacy.replace(/_/g, ' ')}
                    </div>
                    <div className="mt-2 text-sm">
                      Recommended Rate: <strong className="font-mono text-white text-lg">{fluidResult.recommended_rate_ml_hr} mL/hr</strong>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 bg-slate-900/60 rounded border border-slate-700 text-center">
                      <span className="text-slate-400 block text-[11px]">Hct Status</span>
                      <span className="font-bold font-mono text-blue-300">{fluidResult.hematocrit_status}</span>
                    </div>
                    <div className="p-2.5 bg-slate-900/60 rounded border border-slate-700 text-center">
                      <span className="text-slate-400 block text-[11px]">BUN Trajectory</span>
                      <span className="font-bold font-mono text-blue-300">{fluidResult.bun_trajectory}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-blue-300 flex items-center gap-1">
                      <span>⚡</span> Fluid Directives
                    </h4>
                    <div className="space-y-1.5">
                      {fluidResult.clinical_actions.map((act, i) => (
                        <div key={i} className="p-2 bg-blue-950/30 border border-blue-800/40 rounded text-xs text-blue-200">
                          • {act}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 text-xs">
                  Evaluate fluid parameters to calculate optimal Lactated Ringer infusion rates.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DUTCH STEP-UP & NECROSIS */}
      {activeTab === 'stepup' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-400 border-b border-slate-700/60 pb-2 flex items-center justify-between">
                <span>Dutch Step-Up Necrosectomy Algorithm</span>
                <span className="text-xs text-slate-400 font-normal">PANTER & TENSION Trials Protocol</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-1">Necrosis Classification:</span>
                  <select
                    value={necrosisType}
                    onChange={(e: any) => setNecrosisType(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-200"
                  >
                    <option value="STERILE">Sterile Pancreatic Necrosis</option>
                    <option value="SUSPECTED_INFECTED">Suspected Infected (Fever, rising leukocytosis &gt; 10-14d)</option>
                    <option value="CONFIRMED_INFECTED">Confirmed Infected (Gas bubbles on CT / positive FNA)</option>
                  </select>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Current Step in Pathway:</span>
                  <select
                    value={currentStep}
                    onChange={(e: any) => setCurrentStep(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-200"
                  >
                    <option value="CONSERVATIVE_MEDICAL">Step 0: Medical Resuscitation</option>
                    <option value="PERCUTANEOUS_CATHETER_DRAINAGE">Step 1: Percutaneous Catheter Drainage (PCD)</option>
                    <option value="ENDOSCOPIC_TRANSMURAL_DRAINAGE">Step 1: Endoscopic Transmural Drainage (ETD)</option>
                    <option value="VARD_MINIMALLY_INVASIVE">Step 2: Video-Assisted Retroperitoneal Debridement (VARD)</option>
                    <option value="OPEN_NECROSECTOMY">Step 3: Open Laparotomy Necrosectomy</option>
                  </select>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Duration at Current Step (Hours):</span>
                  <input
                    type="number"
                    value={hoursAtStep}
                    onChange={(e) => setHoursAtStep(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 font-mono text-amber-300"
                  />
                  <span className="text-[11px] text-slate-400">&gt;= 72h without improvement triggers escalation</span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Clinical Sepsis Trajectory:</span>
                  <select
                    value={clinicalResponse}
                    onChange={(e: any) => setClinicalResponse(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-200"
                  >
                    <option value="IMPROVING">Improving (Afebrile, decreasing WBC, weaning pressors)</option>
                    <option value="STABLE">Stable (No worsening, but persistent low-grade fever)</option>
                    <option value="DETERIORATING">Deteriorating (Persistent sepsis, shock, worsening organ failure)</option>
                  </select>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Days Since Pancreatitis Onset:</span>
                  <input
                    type="number"
                    value={daysSinceOnset}
                    onChange={(e) => setDaysSinceOnset(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 font-mono text-amber-300"
                  />
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Catheter Drainage Output (mL/24h):</span>
                  <input
                    type="number"
                    value={drainageMl}
                    onChange={(e) => setDrainageMl(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 font-mono text-amber-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                <label className="flex items-center gap-2 p-2.5 bg-slate-900/60 rounded border border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gasOnCt}
                    onChange={(e) => setGasOnCt(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-600 text-amber-500"
                  />
                  <span>Gas Bubbles in Retroperitoneum on CT</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 bg-slate-900/60 rounded border border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={necrosisPresent}
                    onChange={(e) => setNecrosisPresent(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-600 text-amber-500"
                  />
                  <span>Parenchymal Necrosis on CECT Abdomen</span>
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleEvaluateStepUp}
                  disabled={isLoading}
                  className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-xs transition"
                >
                  {isLoading ? 'Evaluating...' : '🪜 Determine Next Step-Up Intervention'}
                </button>
                <button
                  onClick={handleSaveStepUp}
                  disabled={isLoading}
                  className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-amber-300 border border-amber-500/40 px-4 py-2 rounded-lg text-xs transition"
                >
                  📝 Log Step-Up
                </button>
              </div>
            </div>
          </div>

          {/* Step-Up Plan Card */}
          <div className="space-y-4">
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-400 border-b border-slate-700/60 pb-2">
                Surgical Pathway & Antibiotics
              </h3>

              {stepUpResult ? (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-900/70 border border-amber-600 rounded-lg text-center">
                    <span className="text-xs uppercase tracking-wider text-amber-400 block mb-1">Next Recommended Step</span>
                    <div className="text-xl font-black font-mono text-white">
                      {stepUpResult.recommended_step.replace(/_/g, ' ')}
                    </div>
                    <span className="text-xs text-amber-300 block mt-1">
                      Timing: <strong>{stepUpResult.procedure_timing}</strong>
                    </span>
                  </div>

                  <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700 text-xs space-y-1">
                    <span className="font-bold text-amber-300 block">💊 Antimicrobial Penetration</span>
                    <p className="text-slate-300 text-[11px]">{stepUpResult.antimicrobial_guidance}</p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1">
                      <span>📋</span> Step-Up Action Protocol
                    </h4>
                    <div className="space-y-1.5">
                      {stepUpResult.action_plan.map((p, i) => (
                        <div key={i} className="p-2 bg-amber-950/30 border border-amber-800/40 rounded text-xs text-amber-200">
                          • {p}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 text-xs">
                  Run the Dutch Step-Up algorithm to determine PCD vs VARD surgical escalations.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TOKYO TG18 BILIARY & ERCP */}
      {activeTab === 'biliary' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-400 border-b border-slate-700/60 pb-2 flex items-center justify-between">
                <span>Tokyo Guidelines (TG18) Cholangitis & Gallstone Pancreatitis</span>
                <span className="text-xs text-slate-400 font-normal">Charcot Triad & Reynolds Pentad Diagnostic Matrix</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-1">Peak Body Temperature (°C):</span>
                  <input
                    type="number"
                    step="0.1"
                    value={tempCelsius}
                    onChange={(e) => setTempCelsius(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 font-mono text-emerald-300"
                  />
                  <span className="text-[11px] text-slate-400">&gt;= 38.0°C fever criterion</span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Total Bilirubin (mg/dL):</span>
                  <input
                    type="number"
                    step="0.1"
                    value={bilirubin}
                    onChange={(e) => setBilirubin(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 font-mono text-emerald-300"
                  />
                  <span className="text-[11px] text-slate-400">&gt;= 2.5 mg/dL jaundice criterion</span>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">White Blood Cell Count (WBC, x10^3/uL):</span>
                  <input
                    type="number"
                    step="0.1"
                    value={wbcCount}
                    onChange={(e) => setWbcCount(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 font-mono text-emerald-300"
                  />
                  <span className="text-[11px] text-slate-400">&gt; 12k or &lt; 4k abnormal</span>
                </div>

                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-200">
                    <input
                      type="checkbox"
                      checked={ruqPain}
                      onChange={(e) => setRuqPain(e.target.checked)}
                      className="rounded bg-slate-800 border-slate-600 text-emerald-500"
                    />
                    <span>Right Upper Quadrant (RUQ) Abdominal Pain</span>
                  </label>
                  <span className="text-[11px] text-slate-400 block mt-1">Completes Charcot's Triad with fever & jaundice</span>
                </div>

                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-200">
                    <input
                      type="checkbox"
                      checked={organDysfunctionTg18}
                      onChange={(e) => setOrganDysfunctionTg18(e.target.checked)}
                      className="rounded bg-slate-800 border-slate-600 text-rose-500"
                    />
                    <span>Organ Dysfunction (Hypotension, GCS &lt; 15, PaO2/FiO2 &lt; 300)</span>
                  </label>
                  <span className="text-[11px] text-slate-400 block mt-1">Grade III Severe Acute Cholangitis trigger</span>
                </div>

                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-200">
                    <input
                      type="checkbox"
                      checked={gallstonesPresent}
                      onChange={(e) => setGallstonesPresent(e.target.checked)}
                      className="rounded bg-slate-800 border-slate-600 text-emerald-500"
                    />
                    <span>Cholelithiasis or Dilated CBD (&gt; 6 mm) on Ultrasound/MRCP</span>
                  </label>
                  <span className="text-[11px] text-slate-400 block mt-1">Confirms biliary origin etiology</span>
                </div>
              </div>

              <button
                onClick={handleEvaluateTg18}
                disabled={isLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-xs transition"
              >
                {isLoading ? 'Evaluating...' : '🩺 Evaluate TG18 Severity & Urgent ERCP Timing'}
              </button>
            </div>
          </div>

          {/* TG18 Results Card */}
          <div className="space-y-4">
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-400 border-b border-slate-700/60 pb-2">
                Biliary Decompression Directives
              </h3>

              {tg18Result ? (
                <div className="space-y-4">
                  <div className={`p-4 rounded-lg border text-center ${
                    tg18Result.tg18_severity === 'GRADE_III_SEVERE'
                      ? 'bg-rose-950/70 border-rose-600 text-rose-200'
                      : tg18Result.tg18_severity === 'GRADE_II_MODERATE'
                      ? 'bg-amber-950/70 border-amber-600 text-amber-200'
                      : tg18Result.tg18_severity === 'GRADE_I_MILD'
                      ? 'bg-emerald-950/70 border-emerald-600 text-emerald-200'
                      : 'bg-slate-800 border-slate-600 text-slate-300'
                  }`}>
                    <span className="text-xs uppercase tracking-wider opacity-80 block mb-1">TG18 Classification</span>
                    <div className="text-2xl font-black font-mono">
                      {tg18Result.tg18_severity.replace(/_/g, ' ')}
                    </div>
                    {tg18Result.ercp_timing === 'EMERGENT_WITHIN_24H' && (
                      <div className="mt-2 inline-block bg-rose-600 text-white font-bold px-3 py-1 rounded-full text-xs animate-pulse">
                        ⚡ EMERGENT ERCP WITHIN 24 HOURS REQUIRED
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700 text-xs space-y-1">
                    <span className="font-bold text-emerald-300 block">🏥 Surgical Cholecystectomy Strategy</span>
                    <p className="text-slate-300 text-[11px]">{tg18Result.cholecystectomy_recommendation}</p>
                  </div>

                  {tg18Result.antimicrobial_coverage.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1">
                        <span>💊</span> Biliary Sepsis Regimen
                      </h4>
                      <div className="space-y-1.5">
                        {tg18Result.antimicrobial_coverage.map((med, i) => (
                          <div key={i} className="p-2 bg-emerald-950/30 border border-emerald-800/40 rounded text-xs text-emerald-200">
                            • {med}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 text-xs">
                  Run the TG18 assessment to determine ERCP decompression and lap chole timing.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: REGISTRY & HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Encounters Table */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-orange-400 border-b border-slate-700/60 pb-2">
              Recent Pancreatitis Clinical Encounters ({history.encounters.length})
            </h3>
            {history.encounters.length === 0 ? (
              <p className="text-xs text-slate-400">No acute pancreatitis encounters saved yet for this patient.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400">
                      <th className="p-2">Etiology</th>
                      <th className="p-2">Atlanta Severity</th>
                      <th className="p-2">BISAP</th>
                      <th className="p-2">Organ Failure</th>
                      <th className="p-2">Fluid Rate</th>
                      <th className="p-2">Hct / BUN</th>
                      <th className="p-2">ERCP &lt; 24h</th>
                      <th className="p-2">Logged At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {history.encounters.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-800/40">
                        <td className="p-2 font-mono text-orange-300">{e.etiology}</td>
                        <td className="p-2">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            e.atlanta_severity === 'SEVERE'
                              ? 'bg-rose-950 text-rose-300'
                              : e.atlanta_severity === 'MODERATELY_SEVERE'
                              ? 'bg-amber-950 text-amber-300'
                              : 'bg-emerald-950 text-emerald-300'
                          }`}>
                            {e.atlanta_severity}
                          </span>
                        </td>
                        <td className="p-2 font-mono font-bold text-orange-400">{e.bisap_score} / 5</td>
                        <td className="p-2">{e.organ_failure_persistent ? 'Persistent (>48h)' : 'None/Transient'}</td>
                        <td className="p-2 font-mono">{e.fluid_rate_ml_hr} mL/h</td>
                        <td className="p-2 font-mono">{e.hematocrit_percent ? `${e.hematocrit_percent}%` : '—'} / {e.bun_mg_dl ? `${e.bun_mg_dl} mg/dL` : '—'}</td>
                        <td className="p-2">{e.ercp_recommended_within_24h ? '🚨 REQUIRED' : 'No'}</td>
                        <td className="p-2 text-slate-400 font-mono text-[11px]">{new Date(e.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Step-Up Interventions Table */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-400 border-b border-slate-700/60 pb-2">
              Pancreatic Step-Up Interventions ({history.step_up_interventions.length})
            </h3>
            {history.step_up_interventions.length === 0 ? (
              <p className="text-xs text-slate-400">No step-up interventions logged yet for this patient.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400">
                      <th className="p-2">Necrosis Type</th>
                      <th className="p-2">Current Step</th>
                      <th className="p-2">Clinical Response</th>
                      <th className="p-2">Drainage (24h)</th>
                      <th className="p-2">Next Step</th>
                      <th className="p-2">Logged At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {history.step_up_interventions.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-800/40">
                        <td className="p-2 font-mono text-amber-300">{s.necrosis_type}</td>
                        <td className="p-2 font-mono">{s.current_step}</td>
                        <td className="p-2">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            s.clinical_response === 'DETERIORATING'
                              ? 'bg-rose-950 text-rose-300'
                              : s.clinical_response === 'STABLE'
                              ? 'bg-amber-950 text-amber-300'
                              : 'bg-emerald-950 text-emerald-300'
                          }`}>
                            {s.clinical_response}
                          </span>
                        </td>
                        <td className="p-2 font-mono">{s.drainage_output_ml_24h ? `${s.drainage_output_ml_24h} mL` : '—'}</td>
                        <td className="p-2 font-mono text-orange-300 font-bold">{s.next_recommended_step}</td>
                        <td className="p-2 text-slate-400 font-mono text-[11px]">{new Date(s.logged_at).toLocaleString()}</td>
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
export default PancreasAlertHub;
