import React, { useState, useEffect } from 'react';
import {
  HeartPulse,
  Activity,
  Droplet,
  RefreshCw,
  Sparkles,
  Plus,
  ShieldCheck,
  CheckCircle,
  X,
  Zap,
  Waves,
  ArrowUpRight,
  TrendingDown
} from 'lucide-react';

interface ShockRecord {
  id: number;
  patientId: number;
  patientName: string;
  icuBed: string;
  shockPhenotype: 'distributive_septic' | 'cardiogenic' | 'hypovolemic' | 'obstructive';
  meanArterialPressure: number;
  cardiacIndex?: number | null;
  systemicVascularResistance?: number | null;
  fluidResponsivenessIndex: string;
  ultrasoundPattern: string;
  serumLactateMmolL: number;
  lactateClearancePercent: number;
  primaryVasopressor: string;
  currentDoseMcgKgMin: number;
  resuscitationStatus: 'active_resuscitation' | 'stabilized' | 'escalated_ecmo_device' | 'weaned';
  attendingIntensivist: string;
  createdAt: string;
}

interface VasopressorTitration {
  id: number;
  shockRecordId: number;
  patientName: string;
  icuBed: string;
  shockPhenotype: string;
  agentName: string;
  doseRate: number;
  doseUnits: string;
  targetMap: number;
  resultingMap: number;
  titrationReason: string;
  titratedBy: string;
  createdAt: string;
}

interface IcuShockSummaryData {
  metrics: {
    activeShockCases: number;
    septicShockCount: number;
    cardiogenicShockCount: number;
    multiPressorRefractoryCount: number;
    meanLactateClearanceRate: number;
    targetMapAttainmentRate: number;
  };
  recentRecords: ShockRecord[];
  recentTitrations: VasopressorTitration[];
}

const PRESET_SHOCK_CASES = [
  {
    title: 'Severe Septic Shock (Pneumosepsis)',
    patientName: 'Victor Thorne (65M)',
    patientId: 1,
    bed: 'MICU Bed 08',
    phenotype: 'distributive_septic' as const,
    map: 54,
    ci: 3.8,
    svr: 580,
    fluidIndex: 'PPV 16% (Fluid Responsive)',
    usPattern: 'A_lines_dry',
    lactate: 4.5,
    baselineLactate: 4.5,
    agent: 'Norepinephrine',
    dose: 0.14
  },
  {
    title: 'Acute Cardiogenic Shock (Post-Anterior STEMI)',
    patientName: 'Miriam Al-Hassan (71F)',
    patientId: 2,
    bed: 'CCU Bed 04',
    phenotype: 'cardiogenic' as const,
    map: 58,
    ci: 1.6,
    svr: 1850,
    fluidIndex: 'PPV 4% (Fluid Refractory - High CVP)',
    usPattern: 'B_lines_interstitial_edema',
    lactate: 3.8,
    baselineLactate: 4.2,
    agent: 'Norepinephrine + Dobutamine',
    dose: 0.18
  },
  {
    title: 'Massive Hemorrhagic Shock (Trauma)',
    patientName: 'Cole Jackson (34M)',
    patientId: 3,
    bed: 'SICU Bed 01',
    phenotype: 'hypovolemic' as const,
    map: 48,
    ci: 2.1,
    svr: 1400,
    fluidIndex: 'PLR +18% (MTP Resuscitation Active)',
    usPattern: 'A_lines_dry',
    lactate: 6.2,
    baselineLactate: 7.5,
    agent: 'Norepinephrine',
    dose: 0.25
  }
];

export const IcuShockNavigator: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'navigator' | 'titrations'>('navigator');
  const [summaryData, setSummaryData] = useState<IcuShockSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);

  // Form State for Shock Evaluator
  const [selectedCaseIdx, setSelectedCaseIdx] = useState<number>(0);
  const [patientIdInput, setPatientIdInput] = useState<number>(1);
  const [bedInput, setBedInput] = useState<string>(PRESET_SHOCK_CASES[0].bed);
  const [phenotypeInput, setPhenotypeInput] = useState<'distributive_septic' | 'cardiogenic' | 'hypovolemic' | 'obstructive'>('distributive_septic');
  const [mapInput, setMapInput] = useState<number>(54);
  const [ciInput, setCiInput] = useState<number>(3.8);
  const [svrInput, setSvrInput] = useState<number>(580);
  const [fluidIndexInput, setFluidIndexInput] = useState<string>('PPV 16% (Fluid Responsive)');
  const [usPatternInput, setUsPatternInput] = useState<'A_lines_dry' | 'B_lines_interstitial_edema' | 'RV_strain_PE' | 'pericardial_effusion'>('A_lines_dry');
  const [lactateInput, setLactateInput] = useState<number>(4.5);
  const [baselineLactateInput, setBaselineLactateInput] = useState<number>(4.5);
  const [agentInput, setAgentInput] = useState<string>('Norepinephrine');
  const [doseInput, setDoseInput] = useState<number>(0.14);
  const [evaluatedRecord, setEvaluatedRecord] = useState<ShockRecord | null>(null);

  // Modal State for Vasopressor Titration
  const [showTitrationModal, setShowTitrationModal] = useState<boolean>(false);
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
  const [titrationAgent, setTitrationAgent] = useState<string>('Norepinephrine');
  const [titrationDose, setTitrationDose] = useState<number>(0.22);
  const [resultingMapInput, setResultingMapInput] = useState<number>(68);
  const [titrationReasonInput, setTitrationReasonInput] = useState<string>('Target MAP < 65 mmHg; escalated infusion');

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/clinician/icu-shock/summary');
      if (res.ok) {
        const data = await res.json();
        setSummaryData(data);
      }
    } catch (err) {
      console.error('Failed to fetch ICU shock summary:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCase = (idx: number) => {
    setSelectedCaseIdx(idx);
    const c = PRESET_SHOCK_CASES[idx];
    setPatientIdInput(c.patientId);
    setBedInput(c.bed);
    setPhenotypeInput(c.phenotype);
    setMapInput(c.map);
    setCiInput(c.ci);
    setSvrInput(c.svr);
    setFluidIndexInput(c.fluidIndex);
    setUsPatternInput(c.usPattern as any);
    setLactateInput(c.lactate);
    setBaselineLactateInput(c.baselineLactate);
    setAgentInput(c.agent);
    setDoseInput(c.dose);
    setEvaluatedRecord(null);
  };

  const handleEvaluateShock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsEvaluating(true);
      const res = await fetch('/api/clinician/icu-shock/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: patientIdInput,
          icuBed: bedInput,
          shockPhenotype: phenotypeInput,
          meanArterialPressure: mapInput,
          cardiacIndex: ciInput,
          systemicVascularResistance: svrInput,
          fluidResponsivenessIndex: fluidIndexInput,
          ultrasoundPattern: usPatternInput,
          serumLactateMmolL: lactateInput,
          baselineLactate: baselineLactateInput,
          primaryVasopressor: agentInput,
          currentDoseMcgKgMin: doseInput,
          attendingIntensivist: 'Dr. Marcus Webb, MD (Critical Care)'
        })
      });

      if (res.ok) {
        const data = await res.json();
        setEvaluatedRecord(data);
        fetchSummary();
      }
    } catch (err) {
      console.error('Evaluate shock error:', err);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleRecordTitration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecordId) return;

    try {
      const res = await fetch('/api/clinician/icu-shock/titrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shockRecordId: selectedRecordId,
          agentName: titrationAgent,
          doseRate: titrationDose,
          doseUnits: 'mcg/kg/min',
          targetMap: 65,
          resultingMap: resultingMapInput,
          titrationReason: titrationReasonInput,
          titratedBy: 'Critical Care RN & Titration Protocol'
        })
      });

      if (res.ok) {
        setShowTitrationModal(false);
        setActiveTab('titrations');
        fetchSummary();
      }
    } catch (err) {
      console.error('Titration error:', err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'stabilized':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1 w-fit">
            <CheckCircle className="h-3 w-3" /> Stabilized (MAP ≥ 65)
          </span>
        );
      case 'weaned':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-950 text-blue-300 border border-blue-800 flex items-center gap-1 w-fit">
            <TrendingDown className="h-3 w-3" /> Vasopressors Weaned
          </span>
        );
      case 'escalated_ecmo_device':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-950 text-rose-300 border border-rose-800 flex items-center gap-1 w-fit">
            <Zap className="h-3 w-3" /> Refractory Shock (ECMO/MCS Alert)
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1 w-fit">
            <Activity className="h-3 w-3" /> Active Resuscitation
          </span>
        );
    }
  };

  const metrics = summaryData?.metrics || {
    activeShockCases: 0,
    septicShockCount: 0,
    cardiogenicShockCount: 0,
    multiPressorRefractoryCount: 0,
    meanLactateClearanceRate: 0,
    targetMapAttainmentRate: 100
  };

  return (
    <div className="flex flex-col gap-6 p-6 bg-slate-950 text-slate-100 min-h-screen">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-xl bg-gradient-to-r from-red-950 via-slate-900 to-cyan-950 border border-red-800/40 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
            <HeartPulse className="h-8 w-8 text-red-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Critical Care & ICU Hemodynamic Shock Navigator (ICU-SHOCK Hub)
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-500/20 text-red-300 border border-red-500/40">
                Phase 46 Enterprise
              </span>
            </div>
            <p className="text-sm text-slate-300 mt-1">
              Multi-Phenotype Shock Classification, Dynamic Fluid Responsiveness (PPV/SVV), POCUS BLUE Protocol & Vasoactive Titration Cascades
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchSummary}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh ICU Data
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Active Shock Cases</span>
          <div className="text-2xl font-extrabold text-white mt-1">{metrics.activeShockCases}</div>
          <span className="text-[10px] text-red-400 mt-1 flex items-center gap-1">
            <Activity className="h-3 w-3" /> ICU Resuscitation
          </span>
        </div>

        <div className="p-3.5 bg-slate-900/90 border border-amber-900/40 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-amber-400">Septic / Distributive</span>
          <div className="text-2xl font-extrabold text-amber-300 mt-1">{metrics.septicShockCount}</div>
          <span className="text-[10px] text-amber-400 mt-1 flex items-center gap-1">
            <Droplet className="h-3 w-3" /> Vasodilation & Cap Leak
          </span>
        </div>

        <div className="p-3.5 bg-slate-900/90 border border-blue-900/40 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-blue-400">Cardiogenic Shock</span>
          <div className="text-2xl font-extrabold text-blue-300 mt-1">{metrics.cardiogenicShockCount}</div>
          <span className="text-[10px] text-blue-400 mt-1 flex items-center gap-1">
            <HeartPulse className="h-3 w-3" /> Low Cardiac Index
          </span>
        </div>

        <div className="p-3.5 bg-slate-900/90 border border-rose-900/40 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-rose-400">High-Dose Pressor Risk</span>
          <div className="text-2xl font-extrabold text-rose-300 mt-1">{metrics.multiPressorRefractoryCount}</div>
          <span className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
            <Zap className="h-3 w-3" /> Dose ≥ 0.25 mcg/kg/min
          </span>
        </div>

        <div className="p-3.5 bg-slate-900/90 border border-teal-900/40 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-teal-400">Mean Lactate Clearance</span>
          <div className="text-2xl font-extrabold text-teal-300 mt-1">{metrics.meanLactateClearanceRate}%</div>
          <span className="text-[10px] text-teal-400 mt-1 flex items-center gap-1">
            <TrendingDown className="h-3 w-3" /> Cellular Reperfusion
          </span>
        </div>

        <div className="p-3.5 bg-slate-900/90 border border-emerald-900/40 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-emerald-400">MAP ≥ 65 Attainment</span>
          <div className="text-2xl font-extrabold text-emerald-300 mt-1">{metrics.targetMapAttainmentRate}%</div>
          <span className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" /> Perfusion Target Met
          </span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab('navigator')}
          className={`pb-3 font-semibold text-sm transition flex items-center gap-2 ${
            activeTab === 'navigator'
              ? 'text-red-400 border-b-2 border-red-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <HeartPulse className="h-4 w-4" />
          Hemodynamic Shock Resuscitation Navigator
        </button>
        <button
          onClick={() => setActiveTab('titrations')}
          className={`pb-3 font-semibold text-sm transition flex items-center gap-2 ${
            activeTab === 'titrations'
              ? 'text-red-400 border-b-2 border-red-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="h-4 w-4" />
          Vasoactive & Inotrope Titration Log
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-red-500 text-slate-950 font-bold">
            {summaryData?.recentTitrations.length || 0}
          </span>
        </button>
      </div>

      {/* Tab 1: Navigator View */}
      {activeTab === 'navigator' && (
        <div className="space-y-6">
          {/* Preset Scenario Cards */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-3 block">
              Load Critical Care Shock Scenario:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PRESET_SHOCK_CASES.map((scen, idx) => (
                <button
                  key={scen.title}
                  onClick={() => loadCase(idx)}
                  className={`p-3 rounded-lg border text-left transition text-xs ${
                    selectedCaseIdx === idx
                      ? 'bg-red-950/60 border-red-500 text-red-200 shadow-md'
                      : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="font-bold text-white flex items-center justify-between">
                    <span>{scen.patientName}</span>
                    <Sparkles className="h-3 w-3 text-red-400" />
                  </div>
                  <div className="mt-1 text-slate-400">{scen.title}</div>
                  <div className="text-[11px] text-red-300 mt-1 font-mono">{scen.bed} • MAP: {scen.map} mmHg</div>
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Shock Form */}
          <form onSubmit={handleEvaluateShock} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-red-400" />
                <h3 className="font-bold text-sm text-white">
                  Hemodynamic & Fluid Responsiveness Assessor
                </h3>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span>Target MAP: <strong className="text-emerald-400">≥ 65 mmHg</strong></span>
                <span>Current MAP: <strong className={mapInput >= 65 ? 'text-emerald-400' : 'text-red-400'}>{mapInput} mmHg</strong></span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">ICU Bed Location:</label>
                <input
                  type="text"
                  value={bedInput}
                  onChange={(e) => setBedInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Shock Phenotype:</label>
                <select
                  value={phenotypeInput}
                  onChange={(e) => setPhenotypeInput(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                >
                  <option value="distributive_septic">Distributive (Septic / Anaphylactic)</option>
                  <option value="cardiogenic">Cardiogenic (Myocardial Infarction / CHF)</option>
                  <option value="hypovolemic">Hypovolemic (Hemorrhagic / Dehydration)</option>
                  <option value="obstructive">Obstructive (PE / Tamponade / Pneumothorax)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Mean Arterial Pressure (MAP mmHg):</label>
                <input
                  type="number"
                  value={mapInput}
                  onChange={(e) => setMapInput(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Cardiac Index (CI L/min/m²):</label>
                <input
                  type="number"
                  step="0.1"
                  value={ciInput}
                  onChange={(e) => setCiInput(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Systemic Vascular Resist (SVR dynes):</label>
                <input
                  type="number"
                  value={svrInput}
                  onChange={(e) => setSvrInput(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Fluid Responsiveness Index:</label>
                <input
                  type="text"
                  value={fluidIndexInput}
                  onChange={(e) => setFluidIndexInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">POCUS Lung Pattern (BLUE Protocol):</label>
                <select
                  value={usPatternInput}
                  onChange={(e) => setUsPatternInput(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono"
                >
                  <option value="A_lines_dry">A-Lines (Dry Lungs - Safe for Bolus)</option>
                  <option value="B_lines_interstitial_edema">B-Lines (Interstitial Edema - Hold Fluid)</option>
                  <option value="RV_strain_PE">RV Strain (Suspect Pulmonary Embolism)</option>
                  <option value="pericardial_effusion">Pericardial Effusion / Tamponade</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Serum Lactate (mmol/L):</label>
                <input
                  type="number"
                  step="0.1"
                  value={lactateInput}
                  onChange={(e) => setLactateInput(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Baseline Lactate (mmol/L):</label>
                <input
                  type="number"
                  step="0.1"
                  value={baselineLactateInput}
                  onChange={(e) => setBaselineLactateInput(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Primary Vasopressor:</label>
                <input
                  type="text"
                  value={agentInput}
                  onChange={(e) => setAgentInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Infusion Rate (mcg/kg/min):</label>
                <input
                  type="number"
                  step="0.01"
                  value={doseInput}
                  onChange={(e) => setDoseInput(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                type="submit"
                disabled={isEvaluating}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-xs rounded-lg shadow-lg transition"
              >
                <Sparkles className="h-4 w-4" />
                {isEvaluating ? 'Evaluating Shock Status...' : 'Evaluate Hemodynamics & Resuscitation'}
              </button>
            </div>
          </form>

          {/* Evaluated Shock Results Presentation */}
          {evaluatedRecord && (
            <div className="bg-slate-900 border border-red-900/60 rounded-xl p-5 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Waves className="h-5 w-5 text-red-400" />
                  <h3 className="text-base font-bold text-white">
                    ICU Hemodynamic Resuscitation Plan
                  </h3>
                </div>
                {getStatusBadge(evaluatedRecord.resuscitationStatus)}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Current MAP</span>
                  <span className={`text-base font-mono font-bold ${evaluatedRecord.meanArterialPressure >= 65 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {evaluatedRecord.meanArterialPressure} mmHg
                  </span>
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Lactate Clearance</span>
                  <span className="text-base font-mono font-bold text-teal-400">
                    {evaluatedRecord.lactateClearancePercent}%
                  </span>
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Active Vasopressor</span>
                  <span className="text-xs font-semibold text-amber-300">
                    {evaluatedRecord.primaryVasopressor} ({evaluatedRecord.currentDoseMcgKgMin} mcg/kg/min)
                  </span>
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Fluid Responsiveness</span>
                  <span className="text-xs font-semibold text-cyan-300">
                    {evaluatedRecord.fluidResponsivenessIndex}
                  </span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => {
                    setSelectedRecordId(evaluatedRecord.id);
                    setTitrationAgent(evaluatedRecord.primaryVasopressor);
                    setTitrationDose(evaluatedRecord.currentDoseMcgKgMin + 0.05);
                    setShowTitrationModal(true);
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-white font-bold text-xs rounded-lg shadow-lg transition"
                >
                  <ArrowUpRight className="h-4 w-4" />
                  Titrate Vasopressor / Inotrope
                </button>
              </div>
            </div>
          )}

          {/* Historical Shock Records Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="font-bold text-sm text-slate-200 mb-3 flex items-center gap-2">
              <HeartPulse className="h-4 w-4 text-red-400" />
              Active ICU Shock Surveillance
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-[11px] uppercase bg-slate-800/60 text-slate-400">
                  <tr>
                    <th className="p-2.5">ID</th>
                    <th className="p-2.5">Patient</th>
                    <th className="p-2.5">Bed</th>
                    <th className="p-2.5">Phenotype</th>
                    <th className="p-2.5">MAP / Lactate</th>
                    <th className="p-2.5">Pressor Rate</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {summaryData?.recentRecords.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-800/40">
                      <td className="p-2.5 font-mono text-slate-400">#{rec.id}</td>
                      <td className="p-2.5 font-bold text-white">{rec.patientName}</td>
                      <td className="p-2.5 font-mono text-red-300">{rec.icuBed}</td>
                      <td className="p-2.5 capitalize">{rec.shockPhenotype.replace(/_/g, ' ')}</td>
                      <td className="p-2.5 font-mono">
                        <span className={rec.meanArterialPressure >= 65 ? 'text-emerald-400' : 'text-red-400'}>
                          {rec.meanArterialPressure} mmHg
                        </span>{' '}
                        • {rec.serumLactateMmolL} mmol/L
                      </td>
                      <td className="p-2.5 text-amber-300 font-mono">
                        {rec.primaryVasopressor} @ {rec.currentDoseMcgKgMin}
                      </td>
                      <td className="p-2.5">{getStatusBadge(rec.resuscitationStatus)}</td>
                      <td className="p-2.5 text-slate-400">{new Date(rec.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Titrations View */}
      {activeTab === 'titrations' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-400" />
              Vasopressor & Inotrope Titration Event Log ({summaryData?.recentTitrations.length || 0})
            </h3>
            <button
              onClick={() => {
                if (summaryData?.recentRecords && summaryData.recentRecords.length > 0) {
                  setSelectedRecordId(summaryData.recentRecords[0].id);
                  setShowTitrationModal(true);
                } else {
                  alert('Please evaluate a patient shock case first.');
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold transition shadow"
            >
              <Plus className="h-3.5 w-3.5" />
              Log Titration Event
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {summaryData?.recentTitrations.map((t) => (
              <div
                key={t.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 hover:border-slate-700 transition"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div>
                    <div className="text-base font-bold text-white">{t.patientName}</div>
                    <div className="text-xs text-red-400 font-mono">{t.icuBed} • {t.shockPhenotype}</div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-amber-950 text-amber-300 border border-amber-800 font-mono">
                    {t.agentName}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Titrated Dose Rate</span>
                    <span className="font-bold text-white font-mono">{t.doseRate} {t.doseUnits}</span>
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Resulting MAP</span>
                    <span className={`font-bold font-mono ${t.resultingMap >= 65 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {t.resultingMap} mmHg
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 italic bg-slate-950/60 p-2.5 rounded border border-slate-800/80">
                  "{t.titrationReason}"
                </p>

                <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                  <span>Logged by: {t.titratedBy}</span>
                  <span>{new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Log Titration */}
      {showTitrationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-400" />
                Log Vasoactive Titration
              </h3>
              <button onClick={() => setShowTitrationModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleRecordTitration} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Vasoactive / Inotropic Agent:</label>
                <select
                  value={titrationAgent}
                  onChange={(e) => setTitrationAgent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                >
                  <option value="Norepinephrine">Norepinephrine (mcg/kg/min)</option>
                  <option value="Vasopressin">Vasopressin (units/min)</option>
                  <option value="Dobutamine">Dobutamine (mcg/kg/min)</option>
                  <option value="Epinephrine">Epinephrine (mcg/kg/min)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">New Infusion Dose Rate:</label>
                <input
                  type="number"
                  step="0.01"
                  value={titrationDose}
                  onChange={(e) => setTitrationDose(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Resulting Post-Titration MAP (mmHg):</label>
                <input
                  type="number"
                  value={resultingMapInput}
                  onChange={(e) => setResultingMapInput(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Titration Rationale & Hemodynamic Response:</label>
                <textarea
                  value={titrationReasonInput}
                  onChange={(e) => setTitrationReasonInput(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white resize-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTitrationModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white rounded font-bold shadow"
                >
                  Save Titration Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
