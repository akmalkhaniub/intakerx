import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  RefreshCw,
  Plus,
  CheckCircle2,
  Droplets,
  Layers,
  ShieldCheck,
  Radio,
  Zap,
  Clock,
  Crosshair,
  Timer
} from 'lucide-react';

interface RadiationPlan {
  id: number;
  patient_id: number;
  tumor_site: string;
  prescribed_physical_dose_gy: number;
  fraction_count: number;
  dose_per_fraction_gy: number;
  alpha_beta_ratio_tumor: number;
  bed_tumor_gy: number;
  eqd2_tumor_gy: number;
  quantec_constraints_checked?: any;
  plan_status: string;
  created_at: string;
}

interface TheranosticCycle {
  id: number;
  patient_id: number;
  radiopharmaceutical: string;
  cycle_number: number;
  administered_activity_gbq: number;
  administered_activity_mci: number;
  administration_timestamp: string;
  amino_acid_nephroprotection_used: boolean;
  post_admin_1m_dose_rate_usv_hr?: number | null;
  nrc_release_criteria_met: boolean;
  isolation_precautions_hours: number;
  status: string;
}

export const TheranosticsHub: React.FC = () => {
  const [plans, setPlans] = useState<RadiationPlan[]>([]);
  const [cycles, setCycles] = useState<TheranosticCycle[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedCycle, setSelectedCycle] = useState<TheranosticCycle | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'cycles' | 'radiobiology' | 'quantec' | 'protocols' | 'decay_release'>('cycles');

  // Modals
  const [showNewPlanModal, setShowNewPlanModal] = useState<boolean>(false);
  const [showNewCycleModal, setShowNewCycleModal] = useState<boolean>(false);

  // 1. Radiobiology State
  const [physicalDose, setPhysicalDose] = useState<number>(40);
  const [fractionCount, setFractionCount] = useState<number>(5);
  const [abTumor, setAbTumor] = useState<number>(1.5);
  const [abOar, setAbOar] = useState<number>(3.0);
  const [radiobioResult, setRadiobioResult] = useState<any | null>(null);

  // 2. QUANTEC State
  const [selectedOrgan, setSelectedOrgan] = useState<'Spinal_Cord' | 'Brainstem' | 'Optic_Chiasm_Nerve' | 'Kidneys_Bilateral' | 'Lungs' | 'Heart' | 'Rectum'>('Spinal_Cord');
  const [maxDose, setMaxDose] = useState<number>(44);
  const [meanDose, setMeanDose] = useState<number>(15);
  const [volAboveThreshold, setVolAboveThreshold] = useState<number>(18);
  const [quantecResult, setQuantecResult] = useState<any | null>(null);

  // 3. Theranostic Protocol State
  const [radiopharm, setRadiopharm] = useState<'177Lu-PSMA-617_Pluvicto' | '177Lu-DOTATATE_Lutathera' | '131I-Sodium_Iodide' | '90Y-Microspheres_SIRT'>('177Lu-PSMA-617_Pluvicto');
  const [cycleNum, setCycleNum] = useState<number>(1);
  const [eGfr, setEGfr] = useState<number>(68);
  const [platelets, setPlatelets] = useState<number>(195);
  const [anc, setAnc] = useState<number>(3.2);
  const [tsh, setTsh] = useState<number>(45);
  const [lungShunt, setLungShunt] = useState<number>(6.5);
  const [protocolResult, setProtocolResult] = useState<any | null>(null);

  // 4. Radioactive Decay & Release State
  const [decayIsotope, setDecayIsotope] = useState<'177Lu' | '131I' | '90Y' | '68Ga'>('177Lu');
  const [initialGbq, setInitialGbq] = useState<number>(7.4);
  const [hoursElapsed, setHoursElapsed] = useState<number>(24);
  const [initial1mRate, setInitial1mRate] = useState<number>(85);
  const [decayResult, setDecayResult] = useState<any | null>(null);

  // New Plan Form State
  const [newTumorSite, setNewTumorSite] = useState<string>('Prostate_Carcinoma');
  const [newPlanDose, setNewPlanDose] = useState<number>(40);
  const [newPlanFractions, setNewPlanFractions] = useState<number>(5);
  const [newPlanAb, setNewPlanAb] = useState<number>(1.5);

  // New Cycle Form State
  const [newCycleAgent, setNewCycleAgent] = useState<string>('177Lu-PSMA-617_Pluvicto');
  const [newCycleNum, setNewCycleNum] = useState<number>(1);
  const [newCycleGbq, setNewCycleGbq] = useState<number>(7.4);
  const [newCycleMci, setNewCycleMci] = useState<number>(200);
  const [newCycleNephro, setNewCycleNephro] = useState<boolean>(true);
  const [newCycleRate, setNewCycleRate] = useState<number>(45.2);
  const [newCyclePrecautions, setNewCyclePrecautions] = useState<number>(72);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const [pRes, cRes] = await Promise.all([
        fetch('/api/clinician/radonc/plans?limit=20', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/clinician/radonc/cycles?limit=20', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (pRes.ok) {
        const pData = await pRes.json();
        setPlans(pData);
      }
      if (cRes.ok) {
        const cData = await cRes.json();
        setCycles(cData);
        if (cData.length > 0 && !selectedCycle) {
          setSelectedCycle(cData[0]);
        }
      }
    } catch (e) {
      console.error('Error fetching RadOnc records:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
    handleCalculateRadiobio();
    handleEvaluateQuantec();
    handleEvaluateProtocol();
    handleCalculateDecay();
  }, []);

  const handleCalculateRadiobio = async () => {
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const res = await fetch('/api/clinician/radonc/radiobiology', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          physicalDoseGy: physicalDose,
          fractionCount: fractionCount,
          alphaBetaRatioTumor: abTumor,
          alphaBetaRatioOar: abOar
        })
      });
      if (res.ok) {
        const data = await res.json();
        setRadiobioResult(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleEvaluateQuantec = async () => {
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const res = await fetch('/api/clinician/radonc/quantec-eval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          organ: selectedOrgan,
          maxDoseGy: maxDose,
          meanDoseGy: meanDose,
          volumeAboveThresholdPercent: volAboveThreshold
        })
      });
      if (res.ok) {
        const data = await res.json();
        setQuantecResult(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleEvaluateProtocol = async () => {
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const res = await fetch('/api/clinician/radonc/theranostic-protocol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          radiopharmaceutical: radiopharm,
          cycleNumber: cycleNum,
          eGfrMlMin: eGfr,
          plateletsKPerUl: platelets,
          ancKPerUl: anc,
          tshMiuPerL: tsh,
          lungShuntFractionPercent: lungShunt
        })
      });
      if (res.ok) {
        const data = await res.json();
        setProtocolResult(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCalculateDecay = async () => {
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const res = await fetch('/api/clinician/radonc/decay-release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          radiopharmaceutical: decayIsotope,
          initialActivityGbq: initialGbq,
          hoursElapsed: hoursElapsed,
          initial1mDoseRateUsvHr: initial1mRate
        })
      });
      if (res.ok) {
        const data = await res.json();
        setDecayResult(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const d = newPlanDose / newPlanFractions;
      const bed = newPlanDose * (1 + (d / newPlanAb));
      const eqd2 = newPlanDose * ((d + newPlanAb) / (2 + newPlanAb));

      const res = await fetch('/api/clinician/radonc/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          patientId: 1,
          tumorSite: newTumorSite,
          prescribedPhysicalDoseGy: newPlanDose,
          fractionCount: newPlanFractions,
          dosePerFractionGy: d,
          alphaBetaRatioTumor: newPlanAb,
          bedTumorGy: Math.round(bed * 10) / 10,
          eqd2TumorGy: Math.round(eqd2 * 10) / 10,
          quantecConstraintsChecked: { compliant: true }
        })
      });
      if (res.ok) {
        setShowNewPlanModal(false);
        fetchRecords();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const res = await fetch('/api/clinician/radonc/cycles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          patientId: 1,
          radiopharmaceutical: newCycleAgent,
          cycleNumber: newCycleNum,
          administeredActivityGbq: newCycleGbq,
          administeredActivityMci: newCycleMci,
          aminoAcidNephroprotectionUsed: newCycleNephro,
          postAdmin1mDoseRateUsvHr: newCycleRate,
          nrcReleaseCriteriaMet: newCycleRate <= 50,
          isolationPrecautionsHours: newCyclePrecautions
        })
      });
      if (res.ok) {
        setShowNewCycleModal(false);
        fetchRecords();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col gap-5 p-6 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-800 dark:text-slate-100 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-gradient-to-r from-violet-950 via-purple-900 to-indigo-950 text-white rounded-2xl shadow-xl border border-purple-700/50">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/10 rounded-xl backdrop-blur-md border border-white/20">
            <Radio className="h-8 w-8 text-purple-300 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-xs font-black tracking-widest bg-purple-500/30 border border-purple-400/40 rounded-full text-purple-200 uppercase">
                RADIATION ONCOLOGY & NUCLEAR MEDICINE
              </span>
              <span className="text-xs bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 px-2 py-0.5 rounded-full font-mono">
                QUANTEC / ASTRO / SNMMI 2026
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white mt-1">
              THERANOSTICS™ Precision Radiation & Radioligand Command
            </h1>
            <p className="text-xs text-purple-200/90 mt-0.5">
              LQ Radiobiology (BED & EQD2), QUANTEC Normal Tissue OAR Constraints, 177Lu-PSMA-617 & 177Lu-DOTATATE Theranostics, and ALARA Decay Watchdog
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewCycleModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all"
          >
            <Plus className="h-4 w-4" />
            Infuse Radioligand Cycle
          </button>
          <button
            onClick={() => setShowNewPlanModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-md transition-all"
          >
            <Crosshair className="h-4 w-4" />
            New EBRT Plan
          </button>
          <button
            onClick={fetchRecords}
            disabled={loading}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all"
            title="Refresh Records"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Navigation Pills */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('cycles')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'cycles'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          <Activity className="h-3.5 w-3.5" />
          Active Theranostic Cycles ({cycles.length})
        </button>

        <button
          onClick={() => setActiveTab('radiobiology')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'radiobiology'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          <Zap className="h-3.5 w-3.5" />
          LQ Radiobiology (BED / EQD2)
        </button>

        <button
          onClick={() => setActiveTab('quantec')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'quantec'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          QUANTEC OAR Constraints
        </button>

        <button
          onClick={() => setActiveTab('protocols')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'protocols'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          Theranostics Protocol Solver
        </button>

        <button
          onClick={() => setActiveTab('decay_release')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'decay_release'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          <Timer className="h-3.5 w-3.5" />
          Decay & NRC Release Watchdog
        </button>
      </div>

      {/* TAB 1: ACTIVE THERANOSTIC CYCLES & PLANS */}
      {activeTab === 'cycles' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center justify-between">
              <span>Administered Cycles</span>
              <span className="text-xs bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full font-mono">
                {cycles.length} Cycles
              </span>
            </h2>

            {cycles.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                No active theranostic cycles recorded. Click &quot;Infuse Radioligand Cycle&quot; to begin.
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[600px] overflow-y-auto pr-1">
                {cycles.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCycle(c)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedCycle?.id === c.id
                        ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/20 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-purple-700 dark:text-purple-300">
                        {c.radiopharmaceutical}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        Cycle #{c.cycle_number}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500">
                      <span>{c.administered_activity_gbq} GBq ({c.administered_activity_mci} mCi)</span>
                      <span>•</span>
                      <span>{new Date(c.administration_timestamp).toLocaleDateString()}</span>
                    </div>

                    <div className="flex items-center gap-1.5 mt-2">
                      {c.amino_acid_nephroprotection_used && (
                        <span className="px-2 py-0.5 text-[9px] font-bold bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 rounded border border-teal-300 dark:border-teal-800">
                          NEPHROPROTECTION CO-INFUSED
                        </span>
                      )}
                      <span className={`px-2 py-0.5 text-[9px] font-semibold rounded ${
                        c.nrc_release_criteria_met
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                      }`}>
                        {c.nrc_release_criteria_met ? 'NRC Discharged' : 'Isolation Required'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Selected Cycle & Radiation Plans */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {selectedCycle ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-slate-900 dark:text-white">
                        {selectedCycle.radiopharmaceutical}
                      </h3>
                      <span className="text-xs bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded font-mono font-bold">
                        Cycle {selectedCycle.cycle_number}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Administered: {new Date(selectedCycle.administration_timestamp).toLocaleString()}
                    </p>
                  </div>

                  <span className={`px-3 py-1 font-black text-xs rounded-lg uppercase ${
                    selectedCycle.nrc_release_criteria_met
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 text-emerald-700 dark:text-emerald-300'
                      : 'bg-rose-100 dark:bg-rose-950/60 border border-rose-300 text-rose-700 dark:text-rose-300 animate-pulse'
                  }`}>
                    {selectedCycle.nrc_release_criteria_met ? 'NRC Discharge Cleared' : 'Inpatient Isolation'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Administered Activity</span>
                    <span className="text-sm font-black text-purple-600 dark:text-purple-400">
                      {selectedCycle.administered_activity_gbq} GBq
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">{selectedCycle.administered_activity_mci} mCi</span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">1m Dose Rate</span>
                    <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                      {selectedCycle.post_admin_1m_dose_rate_usv_hr || '--'} µSv/hr
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">NRC Limit: 50 µSv/hr</span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Nephroprotection</span>
                    <span className={`text-sm font-black ${selectedCycle.amino_acid_nephroprotection_used ? 'text-teal-600 dark:text-teal-400' : 'text-slate-500'}`}>
                      {selectedCycle.amino_acid_nephroprotection_used ? 'Co-Infused' : 'None'}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Precaution Timer</span>
                    <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                      {selectedCycle.isolation_precautions_hours} Hours
                    </span>
                  </div>
                </div>

                {/* Approved Radiation Treatment Plans */}
                <div className="mt-5">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-2">
                    Approved External Beam Plans ({plans.length})
                  </h4>
                  {plans.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {plans.map((p) => (
                        <div key={p.id} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-100">{p.tumor_site.replace(/_/g, ' ')}</span>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {p.prescribed_physical_dose_gy} Gy in {p.fraction_count} fx ({p.dose_per_fraction_gy} Gy/fx) | α/β: {p.alpha_beta_ratio_tumor}
                            </p>
                          </div>
                          <div className="text-right font-mono">
                            <span className="font-bold text-purple-600 dark:text-purple-400 block">EQD2: {p.eqd2_tumor_gy} Gy</span>
                            <span className="text-[10px] text-slate-400">BED: {p.bed_tumor_gy} Gy</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 py-2 italic">No external beam plans created yet.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center text-slate-400 text-xs">
                Select an active theranostic cycle to review radiopharmaceutical administration details.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: LINEAR-QUADRATIC RADIOBIOLOGY (BED / EQD2) */}
      {activeTab === 'radiobiology' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Zap className="h-4 w-4 text-purple-500" />
              Fractionation & Radiosensitivity Inputs
            </h2>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Total Physical Dose (Gy)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={physicalDose}
                  onChange={(e) => setPhysicalDose(Number(e.target.value))}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Fraction Count (n)
                </label>
                <input
                  type="number"
                  value={fractionCount}
                  onChange={(e) => setFractionCount(Number(e.target.value))}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Dose per fraction: {fractionCount > 0 ? (physicalDose / fractionCount).toFixed(2) : 0} Gy
                </span>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Tumor α/β Ratio (Gy)
                </label>
                <div className="flex gap-2 mt-1">
                  <input
                    type="number"
                    step="0.1"
                    value={abTumor}
                    onChange={(e) => setAbTumor(Number(e.target.value))}
                    className="w-2/3 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  />
                  <select
                    onChange={(e) => setAbTumor(Number(e.target.value))}
                    className="w-1/3 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500"
                  >
                    <option value="">Preset...</option>
                    <option value="1.5">Prostate (1.5)</option>
                    <option value="10">Head/Neck, Lung (10)</option>
                    <option value="4">Melanoma (4)</option>
                    <option value="4">Breast (4)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Normal Tissue / OAR α/β Ratio (Gy)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={abOar}
                  onChange={(e) => setAbOar(Number(e.target.value))}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Standard: 3.0 Gy for late toxicities</span>
              </div>

              <button
                onClick={handleCalculateRadiobio}
                className="w-full mt-2 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg shadow-sm"
              >
                Compute LQ Radiobiology Potency
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-4">
            {radiobioResult && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] font-bold text-purple-500 uppercase tracking-widest">
                      RADIOBIOLOGY RESULTS
                    </span>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                      EQD2: {radiobioResult.eqd2TumorGy} Gy₂ (BED: {radiobioResult.bedTumorGy} Gy)
                    </h3>
                  </div>

                  <span className={`px-3 py-1 font-black text-xs rounded-lg uppercase ${
                    radiobioResult.dosePerFractionGy >= 5
                      ? 'bg-purple-100 dark:bg-purple-950/60 border border-purple-300 text-purple-700 dark:text-purple-300'
                      : 'bg-indigo-100 dark:bg-indigo-950/60 border border-indigo-300 text-indigo-700 dark:text-indigo-300'
                  }`}>
                    {radiobioResult.dosePerFractionGy >= 5 ? 'SABR / SBRT' : 'Standard / Moderate'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4 text-xs">
                  <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-xl border border-purple-200 dark:border-purple-800">
                    <span className="text-slate-500 font-semibold block">Fractional Dose:</span>
                    <span className="text-lg font-black text-purple-700 dark:text-purple-300">
                      {radiobioResult.dosePerFractionGy} Gy
                    </span>
                  </div>

                  <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-xl border border-purple-200 dark:border-purple-800">
                    <span className="text-slate-500 font-semibold block">Tumor EQD2:</span>
                    <span className="text-lg font-black text-purple-700 dark:text-purple-300">
                      {radiobioResult.eqd2TumorGy} Gy₂
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500 font-semibold block">Late OAR EQD2:</span>
                    <span className="text-lg font-black text-slate-800 dark:text-slate-200">
                      {radiobioResult.eqd2OarGy} Gy₃
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500 font-semibold block">Late OAR BED:</span>
                    <span className="text-lg font-black text-slate-800 dark:text-slate-200">
                      {radiobioResult.bedOarGy} Gy₃
                    </span>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                  <span className="text-slate-500 font-bold block mb-1">Clinical Interpretation:</span>
                  <p className="text-slate-700 dark:text-slate-300">
                    {radiobioResult.clinicalInterpretation}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: QUANTEC OAR CONSTRAINTS */}
      {activeTab === 'quantec' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-purple-500" />
              Organ-at-Risk (OAR) Parameters
            </h2>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Target Organ</label>
                <select
                  value={selectedOrgan}
                  onChange={(e: any) => setSelectedOrgan(e.target.value)}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                >
                  <option value="Spinal_Cord">Spinal Cord (Max &lt; 45-50 Gy)</option>
                  <option value="Brainstem">Brainstem (Max &lt; 54 Gy)</option>
                  <option value="Optic_Chiasm_Nerve">Optic Chiasm / Nerve (Max &lt; 55 Gy)</option>
                  <option value="Kidneys_Bilateral">Bilateral Kidneys (Mean &lt; 18 Gy, V20 &lt; 30%)</option>
                  <option value="Lungs">Lungs (Mean &lt; 20 Gy, V20 &lt; 30%)</option>
                  <option value="Heart">Heart (Mean &lt; 26 Gy, V30 &lt; 46%)</option>
                  <option value="Rectum">Rectum (V50 &lt; 50%, V70 &lt; 20%)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Max Dose (Dmax, Gy)</label>
                <input
                  type="number"
                  step="0.5"
                  value={maxDose}
                  onChange={(e) => setMaxDose(Number(e.target.value))}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Mean Dose (Dmean, Gy)</label>
                <input
                  type="number"
                  step="0.5"
                  value={meanDose}
                  onChange={(e) => setMeanDose(Number(e.target.value))}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Volume Above Threshold (% Vxx)</label>
                <input
                  type="number"
                  value={volAboveThreshold}
                  onChange={(e) => setVolAboveThreshold(Number(e.target.value))}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                />
              </div>

              <button
                onClick={handleEvaluateQuantec}
                className="w-full mt-2 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg shadow-sm"
              >
                Evaluate QUANTEC Safety
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-4">
            {quantecResult && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] font-bold text-purple-500 uppercase tracking-widest">
                      QUANTEC ASSESSMENT
                    </span>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                      {quantecResult.organ}
                    </h3>
                  </div>

                  <div>
                    {quantecResult.isCompliant ? (
                      <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-black text-xs rounded-lg">
                        QUANTEC COMPLIANT
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-black text-xs rounded-lg animate-pulse">
                        CONSTRAINT VIOLATED
                      </span>
                    )}
                  </div>
                </div>

                {quantecResult.riskAlert && (
                  <div className="my-4 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl flex items-start gap-2.5">
                    <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold text-rose-800 dark:text-rose-300 block">
                        NORMAL TISSUE COMPLICATION WARNING
                      </span>
                      <p className="text-xs text-rose-700 dark:text-rose-300/90 mt-0.5">
                        {quantecResult.riskAlert}
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 my-3 text-xs">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500 font-semibold block">QUANTEC Guideline:</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200 block mt-0.5">
                      {quantecResult.quantecStandard}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500 font-semibold block">Measured Value:</span>
                    <span className="font-mono text-purple-600 dark:text-purple-400 font-bold block mt-0.5">
                      {quantecResult.measuredMetric}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: THERANOSTICS PROTOCOL SOLVER */}
      {activeTab === 'protocols' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Layers className="h-4 w-4 text-purple-500" />
              Radiopharmaceutical & Lab Parameters
            </h2>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Agent</label>
                <select
                  value={radiopharm}
                  onChange={(e: any) => setRadiopharm(e.target.value)}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                >
                  <option value="177Lu-PSMA-617_Pluvicto">177Lu-PSMA-617 (Pluvicto - mCRPC)</option>
                  <option value="177Lu-DOTATATE_Lutathera">177Lu-DOTATATE (Lutathera - GEP-NET)</option>
                  <option value="131I-Sodium_Iodide">131I-Sodium Iodide (Radioiodine - Thyroid)</option>
                  <option value="90Y-Microspheres_SIRT">90Y-Microspheres (SIRT - Liver)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Cycle Number</label>
                  <input
                    type="number"
                    value={cycleNum}
                    onChange={(e) => setCycleNum(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">eGFR (mL/min)</label>
                  <input
                    type="number"
                    value={eGfr}
                    onChange={(e) => setEGfr(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Threshold: &gt; 30</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Platelets (k/uL)</label>
                  <input
                    type="number"
                    value={platelets}
                    onChange={(e) => setPlatelets(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">ANC (k/uL)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={anc}
                    onChange={(e) => setAnc(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  />
                </div>
              </div>

              {radiopharm === '131I-Sodium_Iodide' && (
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">TSH (mIU/L)</label>
                  <input
                    type="number"
                    value={tsh}
                    onChange={(e) => setTsh(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Target: &gt; 30 mIU/L</span>
                </div>
              )}

              {radiopharm === '90Y-Microspheres_SIRT' && (
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Lung Shunt Fraction (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={lungShunt}
                    onChange={(e) => setLungShunt(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Threshold: &lt; 20%</span>
                </div>
              )}

              <button
                onClick={handleEvaluateProtocol}
                className="w-full mt-2 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg shadow-sm"
              >
                Verify Theranostic Eligibility & Dosing
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-4">
            {protocolResult && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] font-bold text-purple-500 uppercase tracking-widest">
                      THERANOSTIC DOSING REGIMEN
                    </span>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                      {protocolResult.radiopharmaceutical}
                    </h3>
                  </div>

                  <div>
                    {protocolResult.isEligibleForDosing ? (
                      <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-black text-xs rounded-lg">
                        ELIGIBLE FOR CYCLE {protocolResult.cycleNumber}
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-black text-xs rounded-lg animate-pulse">
                        CONTRAINDICATED
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-4 text-xs">
                  <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-xl border border-purple-200 dark:border-purple-800">
                    <span className="text-slate-500 font-semibold block">Prescribed Activity:</span>
                    <span className="text-lg font-black text-purple-700 dark:text-purple-300">
                      {protocolResult.standardDoseGbq} GBq
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">{protocolResult.standardDoseMci} mCi</span>
                  </div>

                  <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-xl border border-purple-200 dark:border-purple-800">
                    <span className="text-slate-500 font-semibold block">Dosing Interval:</span>
                    <span className="text-lg font-black text-purple-700 dark:text-purple-300">
                      Every {protocolResult.intervalWeeks} Weeks
                    </span>
                  </div>

                  <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-xl border border-purple-200 dark:border-purple-800">
                    <span className="text-slate-500 font-semibold block">Cycle Number:</span>
                    <span className="text-lg font-black text-purple-700 dark:text-purple-300">
                      #{protocolResult.cycleNumber}
                    </span>
                  </div>
                </div>

                {protocolResult.mandatoryNephroprotection && (
                  <div className="my-3 p-3.5 bg-teal-50 dark:bg-teal-950/40 border border-teal-300 dark:border-teal-800 rounded-xl flex items-start gap-2.5">
                    <Droplets className="h-5 w-5 text-teal-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold text-teal-800 dark:text-teal-300 block">
                        MANDATORY AMINO ACID NEPHROPROTECTION
                      </span>
                      <p className="text-xs text-teal-700 dark:text-teal-300/90 mt-0.5">
                        {protocolResult.mandatoryNephroprotection}
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                    Mandatory Premedications:
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {protocolResult.mandatoryPremedications.map((m: string, idx: number) => (
                      <div key={idx} className="p-2 text-xs bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-purple-500 shrink-0" />
                        {m}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: DECAY & NRC RELEASE WATCHDOG */}
      {activeTab === 'decay_release' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-500" />
              Decay Kinetics & Exposure
            </h2>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Radionuclide</label>
                <select
                  value={decayIsotope}
                  onChange={(e: any) => setDecayIsotope(e.target.value)}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                >
                  <option value="177Lu">177-Lutetium (T1/2 = 159.5 hrs / 6.65 d)</option>
                  <option value="131I">131-Iodine (T1/2 = 192.5 hrs / 8.02 d)</option>
                  <option value="90Y">90-Yttrium (T1/2 = 64.1 hrs / 2.67 d)</option>
                  <option value="68Ga">68-Gallium (T1/2 = 1.13 hrs / 68 min)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Initial Activity (GBq)</label>
                <input
                  type="number"
                  step="0.1"
                  value={initialGbq}
                  onChange={(e) => setInitialGbq(Number(e.target.value))}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Hours Elapsed Since Infusion</label>
                <input
                  type="number"
                  value={hoursElapsed}
                  onChange={(e) => setHoursElapsed(Number(e.target.value))}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Initial 1-Meter Dose Rate (µSv/hr)</label>
                <input
                  type="number"
                  value={initial1mRate}
                  onChange={(e) => setInitial1mRate(Number(e.target.value))}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">NRC Release limit: ≤ 50 µSv/hr (5 mrem/hr)</span>
              </div>

              <button
                onClick={handleCalculateDecay}
                className="w-full mt-2 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg shadow-sm"
              >
                Compute Radioactive Decay & Release
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-4">
            {decayResult && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] font-bold text-purple-500 uppercase tracking-widest">
                      1-METER EXPOSURE RATE
                    </span>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                      {decayResult.current1mDoseRateUsvHr} µSv/hr
                    </h3>
                  </div>

                  <div>
                    {decayResult.nrcReleaseCriteriaMet ? (
                      <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-black text-xs rounded-lg">
                        NRC DISCHARGE CRITERIA MET (&le; 50 µSv/hr)
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-black text-xs rounded-lg animate-pulse">
                        ISOLATION REQUIRED ({decayResult.hoursUntilNrcRelease} hrs remaining)
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-4 text-xs">
                  <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-xl border border-purple-200 dark:border-purple-800">
                    <span className="text-slate-500 font-semibold block">Retained Activity:</span>
                    <span className="text-base font-black text-purple-700 dark:text-purple-300">
                      {decayResult.retainedActivityGbq} GBq
                    </span>
                    <span className="text-[10px] text-slate-400 block">{decayResult.retainedActivityMci} mCi</span>
                  </div>

                  <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-xl border border-purple-200 dark:border-purple-800">
                    <span className="text-slate-500 font-semibold block">Isotope Half-Life:</span>
                    <span className="text-base font-black text-purple-700 dark:text-purple-300">
                      {decayResult.halfLifeHours} Hours
                    </span>
                  </div>

                  <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-xl border border-purple-200 dark:border-purple-800">
                    <span className="text-slate-500 font-semibold block">Time to Release:</span>
                    <span className="text-base font-black text-purple-700 dark:text-purple-300">
                      {decayResult.hoursUntilNrcRelease} Hours
                    </span>
                  </div>
                </div>

                <div className="mt-4">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                    Radiation Safety Precautions (ALARA Discharge Guidance):
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {decayResult.radiationSafetyPrecautions.map((p: string, idx: number) => (
                      <div key={idx} className="p-2 text-xs bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-purple-500 shrink-0" />
                        {p}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* NEW CYCLE MODAL */}
      {showNewCycleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl">
            <h3 className="text-base font-black text-slate-900 dark:text-white mb-3">
              Record Theranostic Radiopharmaceutical Cycle
            </h3>

            <form onSubmit={handleCreateCycle} className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Radiopharmaceutical</label>
                <select
                  value={newCycleAgent}
                  onChange={(e) => setNewCycleAgent(e.target.value)}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                >
                  <option value="177Lu-PSMA-617_Pluvicto">177Lu-PSMA-617 (Pluvicto)</option>
                  <option value="177Lu-DOTATATE_Lutathera">177Lu-DOTATATE (Lutathera)</option>
                  <option value="131I-Sodium_Iodide">131I-Sodium Iodide</option>
                  <option value="90Y-Microspheres_SIRT">90Y-Microspheres (SIRT)</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Cycle #</label>
                  <input
                    type="number"
                    value={newCycleNum}
                    onChange={(e) => setNewCycleNum(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Dose (GBq)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newCycleGbq}
                    onChange={(e) => setNewCycleGbq(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Dose (mCi)</label>
                  <input
                    type="number"
                    value={newCycleMci}
                    onChange={(e) => setNewCycleMci(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">1m Rate (µSv/hr)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newCycleRate}
                    onChange={(e) => setNewCycleRate(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Isolation (hours)</label>
                  <input
                    type="number"
                    value={newCyclePrecautions}
                    onChange={(e) => setNewCyclePrecautions(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                    required
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={newCycleNephro}
                  onChange={(e) => setNewCycleNephro(e.target.checked)}
                  className="rounded text-purple-600"
                />
                Amino Acid Nephroprotection Co-Infused
              </label>

              <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewCycleModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg shadow-sm"
                >
                  Save Infusion Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NEW PLAN MODAL */}
      {showNewPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl">
            <h3 className="text-base font-black text-slate-900 dark:text-white mb-3">
              Create External Beam Radiation Plan
            </h3>

            <form onSubmit={handleCreatePlan} className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Tumor Target Site</label>
                <input
                  type="text"
                  value={newTumorSite}
                  onChange={(e) => setNewTumorSite(e.target.value)}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Dose (Gy)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newPlanDose}
                    onChange={(e) => setNewPlanDose(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Fractions</label>
                  <input
                    type="number"
                    value={newPlanFractions}
                    onChange={(e) => setNewPlanFractions(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">α/β (Gy)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newPlanAb}
                    onChange={(e) => setNewPlanAb(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewPlanModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-sm"
                >
                  Approve Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
