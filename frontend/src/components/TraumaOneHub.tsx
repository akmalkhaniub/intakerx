import React, { useState, useEffect } from 'react';
import {
  Flame,
  Activity,
  AlertTriangle,
  RefreshCw,
  Plus,
  Zap,
  Sliders,
  Wind,
  XCircle,
  Timer,
  ShieldAlert
} from 'lucide-react';

interface BurnCase {
  id: number;
  patient_id: number;
  injury_timestamp: string;
  ed_arrival_timestamp: string;
  patient_weight_kg: number;
  is_pediatric: boolean;
  tbsa_percentage: number;
  partial_thickness_tbsa: number;
  full_thickness_tbsa: number;
  burn_mechanism: string;
  inhalation_injury_present: boolean;
  formula_type: string;
  calculated_24h_volume_ml: number;
  first_8h_rate_ml_hr: number;
  next_16h_rate_ml_hr: number;
  current_infusion_rate_ml_hr: number;
  cumulative_fluid_infused_ml: number;
  fluid_creep_warning: boolean;
  co_hemoglobin_percent?: number | null;
  cyanide_suspected: boolean;
  case_status: string;
  created_at: string;
}

interface TitrationRecord {
  id: number;
  burn_case_id: number;
  post_burn_hour: number;
  urine_output_ml: number;
  uop_ml_kg_hr: number;
  mean_arterial_pressure_mmhg?: number | null;
  bladder_pressure_mmhg?: number | null;
  infusion_rate_prescribed_ml_hr: number;
  volume_infused_this_hour_ml: number;
  rate_adjustment_recommendation: string;
  clinical_notes?: string | null;
  recorded_at: string;
}

export const TraumaOneHub: React.FC = () => {
  const [cases, setCases] = useState<BurnCase[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedCase, setSelectedCase] = useState<BurnCase | null>(null);
  const [titrations, setTitrations] = useState<TitrationRecord[]>([]);
  const [showNewModal, setShowNewModal] = useState<boolean>(false);
  const [showTbsaModal, setShowTbsaModal] = useState<boolean>(false);
  const [showInhalationModal, setShowInhalationModal] = useState<boolean>(false);

  // Form: New Burn Case
  const [patientId, setPatientId] = useState<number>(1);
  const [weightKg, setWeightKg] = useState<number>(75);
  const [isPediatric, setIsPediatric] = useState<boolean>(false);
  const [tbsaPercent, setTbsaPercent] = useState<number>(35);
  const [partialTbsa, setPartialTbsa] = useState<number>(20);
  const [fullTbsa, setFullTbsa] = useState<number>(15);
  const [mechanism, setMechanism] = useState<string>('flame');
  const [inhalationInjury, setInhalationInjury] = useState<boolean>(true);
  const [formulaType, setFormulaType] = useState<'Parkland' | 'Modified_Brooke'>('Parkland');
  const [injuryTime, setInjuryTime] = useState<string>(
    new Date(Date.now() - 90 * 60 * 1000).toISOString().slice(0, 16)
  );
  const [edArrivalTime, setEdArrivalTime] = useState<string>(
    new Date(Date.now() - 30 * 60 * 1000).toISOString().slice(0, 16)
  );
  const [coPercent, setCoPercent] = useState<number>(18.5);
  const [cyanideSuspect, setCyanideSuspect] = useState<boolean>(false);

  // Form: Hourly Titration
  const [titrationHour, setTitrationHour] = useState<number>(2);
  const [hourlyUopMl, setHourlyUopMl] = useState<number>(45);
  const [hourlyMap, setHourlyMap] = useState<number>(76);
  const [bladderPressure, setBladderPressure] = useState<number>(9.0);
  const [hourlyInfusedMl, setHourlyInfusedMl] = useState<number>(650);
  const [titrationNotes, setTitrationNotes] = useState<string>('');
  const [lastTitrationAdvisory, setLastTitrationAdvisory] = useState<any | null>(null);

  // TBSA Calculator State
  const [headNeck, setHeadNeck] = useState<number>(9.0);
  const [antTorso, setAntTorso] = useState<number>(18.0);
  const [postTorso, setPostTorso] = useState<number>(18.0);
  const [rightArm, setRightArm] = useState<number>(9.0);
  const [leftArm, setLeftArm] = useState<number>(4.5);
  const [rightLeg, setRightLeg] = useState<number>(9.0);
  const [leftLeg, setLeftLeg] = useState<number>(0);
  const [perineum, setPerineum] = useState<number>(0);
  const [calcTbsaOutput, setCalcTbsaOutput] = useState<any | null>(null);

  // Inhalation Calculator State
  const [inhalCo, setInhalCo] = useState<number>(24.0);
  const [inhalFio2, setInhalFio2] = useState<number>(100);
  const [inhalLactate, setInhalLactate] = useState<number>(8.6);
  const [inhalFacial, setInhalFacial] = useState<boolean>(true);
  const [inhalSputum, setInhalSputum] = useState<boolean>(true);
  const [inhalStridor, setInhalStridor] = useState<boolean>(true);
  const [inhalBronch, setInhalBronch] = useState<0 | 1 | 2 | 3 | 4>(3);
  const [inhalationOutput, setInhalationOutput] = useState<any | null>(null);

  const fetchCases = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/clinician/burn/cases', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCases(data);
        if (data.length > 0 && !selectedCase) {
          setSelectedCase(data[0]);
          fetchTitrations(data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch burn cases:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTitrations = async (caseId: number) => {
    try {
      const res = await fetch(`/api/clinician/burn/cases/${caseId}/titrations`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTitrations(data);
        setTitrationHour(data.length + 1);
      }
    } catch (err) {
      console.error('Failed to fetch titrations:', err);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const handleSelectCase = (c: BurnCase) => {
    setSelectedCase(c);
    fetchTitrations(c.id);
    setLastTitrationAdvisory(null);
  };

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/clinician/burn/cases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          patientId,
          caseData: {
            injuryTimestamp: injuryTime,
            edArrivalTimestamp: edArrivalTime,
            patientWeightKg: weightKg,
            isPediatric,
            tbsaPercentage: tbsaPercent,
            partialThicknessTbsa: partialTbsa,
            fullThicknessTbsa: fullTbsa,
            burnMechanism: mechanism,
            inhalationInjuryPresent: inhalationInjury,
            formulaType,
            coHemoglobinPercent: coPercent,
            cyanideSuspected: cyanideSuspect
          }
        })
      });
      if (res.ok) {
        setShowNewModal(false);
        fetchCases();
      }
    } catch (err) {
      console.error('Create burn case error:', err);
    }
  };

  const handleRecordTitration = async () => {
    if (!selectedCase) return;
    try {
      const res = await fetch(`/api/clinician/burn/cases/${selectedCase.id}/titration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          postBurnHour: titrationHour,
          urineOutputMl: hourlyUopMl,
          meanArterialPressureMmhg: hourlyMap,
          bladderPressureMmhg: bladderPressure,
          volumeInfusedThisHourMl: hourlyInfusedMl,
          clinicalNotes: titrationNotes
        })
      });
      if (res.ok) {
        const data = await res.json();
        setLastTitrationAdvisory(data.evaluation);
        setSelectedCase(data.updatedCase);
        fetchTitrations(selectedCase.id);
        setTitrationNotes('');
      }
    } catch (err) {
      console.error('Record titration error:', err);
    }
  };

  const handleCalculateTbsa = async () => {
    try {
      const res = await fetch('/api/clinician/burn/evaluate-tbsa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          map: {
            headNeckPercent: headNeck,
            anteriorTorsoPercent: antTorso,
            posteriorTorsoPercent: postTorso,
            rightArmPercent: rightArm,
            leftArmPercent: leftArm,
            rightLegPercent: rightLeg,
            leftLegPercent: leftLeg,
            perineumPercent: perineum,
            partialThicknessPercent: 20,
            fullThicknessPercent: 15
          },
          isPediatric
        })
      });
      if (res.ok) {
        const data = await res.json();
        setCalcTbsaOutput(data);
        setTbsaPercent(data.totalTbsaPercentage);
      }
    } catch (err) {
      console.error('Calculate TBSA error:', err);
    }
  };

  const handleCalculateInhalation = async () => {
    try {
      const res = await fetch('/api/clinician/burn/evaluate-inhalation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          coHemoglobinPercent: inhalCo,
          fio2DeliveredPercent: inhalFio2,
          serumLactateMmolL: inhalLactate,
          facialBurns: inhalFacial,
          carbonaceousSputum: inhalSputum,
          stridorOrHoarseness: inhalStridor,
          bronchoscopyGrade: inhalBronch
        })
      });
      if (res.ok) {
        const data = await res.json();
        setInhalationOutput(data);
      }
    } catch (err) {
      console.error('Calculate inhalation error:', err);
    }
  };

  // Fluid creep threshold: 250 mL/kg
  const creepThresholdMl = selectedCase ? Math.round(250 * selectedCase.patient_weight_kg) : 17500;
  const cumulativeInfused = selectedCase ? Number(selectedCase.cumulative_fluid_infused_ml) : 0;
  const creepProgressPercent = Math.min(100, Math.round((cumulativeInfused / creepThresholdMl) * 100));

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-950 via-orange-950 to-stone-900 text-white rounded-xl p-6 shadow-lg border border-amber-700/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 rounded-lg border border-amber-400/40">
              <Flame className="h-7 w-7 text-amber-400 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">TRAUMA-ONE Hub: Burn & Complex Trauma</h1>
              <p className="text-xs text-amber-200/80">
                Phase 55: Consensus Parkland Resuscitation, %TBSA Lund-Browder Estimator & Closed-Loop UOP Titration Watchdog
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowTbsaModal(true)}
            className="px-3 py-2 bg-amber-800/60 hover:bg-amber-700 text-amber-200 border border-amber-600/50 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Activity className="h-4 w-4 text-amber-300" />
            %TBSA Estimator
          </button>
          <button
            onClick={() => setShowInhalationModal(true)}
            className="px-3 py-2 bg-orange-800/60 hover:bg-orange-700 text-orange-200 border border-orange-600/50 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Wind className="h-4 w-4 text-cyan-300" />
            Inhalation & COHb
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-lg text-xs flex items-center gap-1.5 shadow transition"
          >
            <Plus className="h-4 w-4" />
            New Burn Case
          </button>
          <button
            onClick={fetchCases}
            disabled={loading}
            className="p-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg border border-stone-700 transition"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Grid: Cases List & Resuscitation Cockpit */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Cases Sidebar */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Resuscitation Cohort</h2>
            <span className="text-xs bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full font-mono">
              {cases.length} Cases
            </span>
          </div>

          <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1">
            {cases.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-slate-300 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
                No active burn resuscitation cases logged.
              </div>
            ) : (
              cases.map((c) => {
                const isSelected = selectedCase?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => handleSelectCase(c)}
                    className={`p-4 rounded-xl border cursor-pointer transition ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm ring-1 ring-amber-500/50'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                          {c.tbsa_percentage}% TBSA
                        </span>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          Pt #{c.patient_id}
                        </span>
                      </div>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                        c.fluid_creep_warning
                          ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 animate-pulse'
                          : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                      }`}>
                        {c.fluid_creep_warning ? 'Fluid Creep!' : c.case_status}
                      </span>
                    </div>

                    <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between">
                      <span className="capitalize">{c.burn_mechanism} Burn ({c.patient_weight_kg} kg)</span>
                      {c.inhalation_injury_present && (
                        <span className="text-[10px] text-orange-600 dark:text-orange-400 font-bold uppercase">
                          + Inhalation
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs font-mono text-slate-500 border-t border-slate-100 dark:border-slate-800/80 pt-2">
                      <span>Rate: {c.current_infusion_rate_ml_hr} mL/h</span>
                      <span>Target: {c.calculated_24h_volume_ml} mL</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Case Cockpit */}
        <div className="lg:col-span-8 space-y-6">
          {selectedCase ? (
            <>
              {/* Resuscitation HUD Panel */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        Case #{selectedCase.id}: {selectedCase.tbsa_percentage}% TBSA Resuscitation
                      </h3>
                      <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500 font-mono">
                        {selectedCase.formula_type} Formula
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Burn Time: {new Date(selectedCase.injury_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} | Weight: {selectedCase.patient_weight_kg} kg | Mechanism: {selectedCase.burn_mechanism}
                    </p>
                  </div>

                  {selectedCase.fluid_creep_warning && (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800 rounded-lg text-xs font-bold animate-pulse">
                      <ShieldAlert className="h-4 w-4" />
                      Fluid Creep Alert (&gt;250 mL/kg)
                    </div>
                  )}
                </div>

                {/* 4 Fluid Metrics Gauges */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Infusion Rate</span>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
                        {selectedCase.current_infusion_rate_ml_hr}
                      </span>
                      <span className="text-xs text-slate-500">mL/hr</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">Lactated Ringer's</span>
                  </div>

                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">24h Planned Volume</span>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
                        {selectedCase.calculated_24h_volume_ml}
                      </span>
                      <span className="text-xs text-slate-500">mL</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">First 8h: {selectedCase.first_8h_rate_ml_hr} mL/h</span>
                  </div>

                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Cumulative Infused</span>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-2xl font-black font-mono text-cyan-600 dark:text-cyan-400">
                        {cumulativeInfused}
                      </span>
                      <span className="text-xs text-slate-500">mL</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">Progress: {creepProgressPercent}% to creep</span>
                  </div>

                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Creep Ceiling</span>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-2xl font-black font-mono text-stone-600 dark:text-stone-300">
                        {creepThresholdMl}
                      </span>
                      <span className="text-xs text-slate-500">mL</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">250 mL/kg Max Threshold</span>
                  </div>
                </div>

                {/* Closed-Loop Hourly Titration Logger Console */}
                <div className="p-4 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sliders className="h-4 w-4 text-amber-400" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                        Closed-Loop Hourly Urine Output (UOP) Watchdog
                      </h4>
                    </div>
                    <button
                      onClick={handleRecordTitration}
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs rounded transition flex items-center gap-1"
                    >
                      <Zap className="h-3.5 w-3.5" />
                      Log Hour {titrationHour} & Titrate
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                    <div>
                      <label className="text-slate-400 text-[10px] block mb-1">Post-Burn Hour</label>
                      <input
                        type="number"
                        min="1"
                        max="24"
                        value={titrationHour}
                        onChange={(e) => setTitrationHour(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 font-mono text-slate-200 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 text-[10px] block mb-1">Urine Output (mL)</label>
                      <input
                        type="number"
                        value={hourlyUopMl}
                        onChange={(e) => setHourlyUopMl(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 font-mono text-slate-200 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 text-[10px] block mb-1">MAP (mmHg)</label>
                      <input
                        type="number"
                        value={hourlyMap}
                        onChange={(e) => setHourlyMap(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 font-mono text-slate-200 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 text-[10px] block mb-1">Bladder Press (mmHg)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={bladderPressure}
                        onChange={(e) => setBladderPressure(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 font-mono text-slate-200 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 text-[10px] block mb-1">Volume Given (mL)</label>
                      <input
                        type="number"
                        value={hourlyInfusedMl}
                        onChange={(e) => setHourlyInfusedMl(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 font-mono text-slate-200 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 text-[10px] block mb-1">Clinical Titration Notes</label>
                    <input
                      type="text"
                      placeholder="e.g., Clear urine, warm extremities, responsive to verbal stimuli..."
                      value={titrationNotes}
                      onChange={(e) => setTitrationNotes(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"
                    />
                  </div>

                  {/* Titration Advisory Banner */}
                  {lastTitrationAdvisory && (
                    <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className={`px-2 py-0.5 rounded font-mono font-bold ${
                          lastTitrationAdvisory.isUopAdequate
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                        }`}>
                          UOP: {lastTitrationAdvisory.uopMlKgHr} mL/kg/hr (Target: {lastTitrationAdvisory.targetUopRange})
                        </span>

                        <span className={`px-2 py-0.5 rounded font-mono font-bold ${
                          lastTitrationAdvisory.rateAdjustmentRecommendation === 'maintain'
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-orange-500/20 text-orange-300 animate-pulse'
                        }`}>
                          Action: {lastTitrationAdvisory.rateAdjustmentRecommendation.toUpperCase()} ({lastTitrationAdvisory.newRecommendedRateMlHr} mL/hr)
                        </span>

                        {lastTitrationAdvisory.intraAbdominalHypertensionAlert && (
                          <span className="px-2 py-0.5 rounded font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/50 animate-bounce">
                            IAH Bladder Alert!
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-amber-200/90">{lastTitrationAdvisory.clinicalAdvisory}</p>
                    </div>
                  )}
                </div>

                {/* Hourly Titration Logs Table */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Timer className="h-4 w-4 text-amber-500" />
                    Hourly Titration Protocol Logs
                  </h4>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px]">
                        <tr>
                          <th className="p-2.5">Hour</th>
                          <th className="p-2.5">UOP (mL)</th>
                          <th className="p-2.5">Rate (mL/kg/h)</th>
                          <th className="p-2.5">MAP</th>
                          <th className="p-2.5">Bladder</th>
                          <th className="p-2.5">Infused</th>
                          <th className="p-2.5">Recommendation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {titrations.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-4 text-center text-slate-400 text-xs">
                              No hourly titrations logged for this case.
                            </td>
                          </tr>
                        ) : (
                          titrations.map((t) => (
                            <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                              <td className="p-2.5 font-mono font-bold text-slate-900 dark:text-white">#{t.post_burn_hour}</td>
                              <td className="p-2.5 font-mono">{t.urine_output_ml}</td>
                              <td className="p-2.5 font-mono">{t.uop_ml_kg_hr}</td>
                              <td className="p-2.5 font-mono">{t.mean_arterial_pressure_mmhg ?? '-'}</td>
                              <td className="p-2.5 font-mono">{t.bladder_pressure_mmhg ?? '-'}</td>
                              <td className="p-2.5 font-mono">{t.volume_infused_this_hour_ml}</td>
                              <td className="p-2.5">
                                <span className={`px-1.5 py-0.5 text-[10px] font-mono rounded ${
                                  t.rate_adjustment_recommendation === 'maintain'
                                    ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
                                }`}>
                                  {t.rate_adjustment_recommendation}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-sm">
              Select a burn case from the left or create a new resuscitation case.
            </div>
          )}
        </div>
      </div>

      {/* MODAL: New Burn Case Form */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Flame className="h-5 w-5 text-amber-500" />
                Initiate Burn Resuscitation Protocol
              </h3>
              <button onClick={() => setShowNewModal(false)} className="text-slate-400 hover:text-slate-200">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCase} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Patient ID</label>
                  <input
                    type="number"
                    value={patientId}
                    onChange={(e) => setPatientId(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={weightKg}
                    onChange={(e) => setWeightKg(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Total %TBSA</label>
                  <input
                    type="number"
                    step="0.5"
                    value={tbsaPercent}
                    onChange={(e) => setTbsaPercent(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Partial Thick (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={partialTbsa}
                    onChange={(e) => setPartialTbsa(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Full Thick (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={fullTbsa}
                    onChange={(e) => setFullTbsa(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Burn Mechanism</label>
                  <select
                    value={mechanism}
                    onChange={(e) => setMechanism(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-semibold"
                  >
                    <option value="flame">Flame / Thermal</option>
                    <option value="scald">Scald / Hot Liquid</option>
                    <option value="contact">Contact Thermal</option>
                    <option value="electrical">Electrical (High-Voltage)</option>
                    <option value="chemical">Chemical / Acid-Alkali</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Resuscitation Formula</label>
                  <select
                    value={formulaType}
                    onChange={(e: any) => setFormulaType(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-semibold"
                  >
                    <option value="Parkland">Consensus Parkland (4 mL/kg/%)</option>
                    <option value="Modified_Brooke">Modified Brooke (2 mL/kg/%)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Injury Timestamp</label>
                  <input
                    type="datetime-local"
                    value={injuryTime}
                    onChange={(e) => setInjuryTime(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">ED Arrival Timestamp</label>
                  <input
                    type="datetime-local"
                    value={edArrivalTime}
                    onChange={(e) => setEdArrivalTime(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inhalationInjury}
                    onChange={(e) => setInhalationInjury(e.target.checked)}
                    className="rounded text-amber-600"
                  />
                  <span>Inhalation Injury Present</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPediatric}
                    onChange={(e) => setIsPediatric(e.target.checked)}
                    className="rounded text-amber-600"
                  />
                  <span>Pediatric Patient</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">COHb Level (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={coPercent}
                    onChange={(e) => setCoPercent(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-mono"
                  />
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cyanideSuspect}
                      onChange={(e) => setCyanideSuspect(e.target.checked)}
                      className="rounded text-amber-600"
                    />
                    <span>Cyanide Suspected</span>
                  </label>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded text-xs shadow"
                >
                  Launch Resuscitation Protocol
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: %TBSA Estimator */}
      {showTbsaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Activity className="h-5 w-5 text-amber-500" />
                %TBSA Lund-Browder / Rule of Nines
              </h3>
              <button onClick={() => setShowTbsaModal(false)} className="text-slate-400 hover:text-slate-200">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Head & Neck (max 9)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={headNeck}
                    onChange={(e) => setHeadNeck(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Anterior Torso (max 18)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={antTorso}
                    onChange={(e) => setAntTorso(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Posterior Torso (max 18)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={postTorso}
                    onChange={(e) => setPostTorso(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Perineum (max 1)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={perineum}
                    onChange={(e) => setPerineum(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Right Arm (max 9)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={rightArm}
                    onChange={(e) => setRightArm(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Left Arm (max 9)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={leftArm}
                    onChange={(e) => setLeftArm(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Right Leg (max 18)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={rightLeg}
                    onChange={(e) => setRightLeg(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Left Leg (max 18)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={leftLeg}
                    onChange={(e) => setLeftLeg(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-mono"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleCalculateTbsa}
                className="w-full mt-2 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded text-xs transition"
              >
                Compute %TBSA & ABA Referral Criteria
              </button>

              {calcTbsaOutput && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200">
                  <div className="flex items-center justify-between font-bold">
                    <span>Computed %TBSA: {calcTbsaOutput.totalTbsaPercentage}%</span>
                    <span className="text-xs bg-amber-200 dark:bg-amber-900 px-2 py-0.5 rounded">
                      {calcTbsaOutput.burnSeverityCategory}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                    ABA Referral Met: {calcTbsaOutput.abaBurnCenterReferralCriteriaMet ? 'YES' : 'NO'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Inhalation & COHb */}
      {showInhalationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Wind className="h-5 w-5 text-orange-500" />
                Smoke Inhalation & COHb Kinetics
              </h3>
              <button onClick={() => setShowInhalationModal(false)} className="text-slate-400 hover:text-slate-200">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">COHb (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={inhalCo}
                    onChange={(e) => setInhalCo(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">FiO₂ Delivered (%)</label>
                  <select
                    value={inhalFio2}
                    onChange={(e) => setInhalFio2(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs"
                  >
                    <option value={21}>Room Air (21% FiO₂)</option>
                    <option value={100}>100% FiO₂ (NRB / Vent)</option>
                    <option value={300}>Hyperbaric O₂ (3.0 ATA HBOT)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Serum Lactate (mmol/L)</label>
                <input
                  type="number"
                  step="0.1"
                  value={inhalLactate}
                  onChange={(e) => setInhalLactate(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inhalFacial}
                    onChange={(e) => setInhalFacial(e.target.checked)}
                    className="rounded text-orange-600"
                  />
                  <span>Facial Burns / Singed Nasal Vibrissae</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inhalSputum}
                    onChange={(e) => setInhalSputum(e.target.checked)}
                    className="rounded text-orange-600"
                  />
                  <span>Carbonaceous Sputum</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inhalStridor}
                    onChange={(e) => setInhalStridor(e.target.checked)}
                    className="rounded text-orange-600"
                  />
                  <span>Stridor / Hoarseness (Impending Obstruction)</span>
                </label>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Bronchoscopy Grade</label>
                <select
                  value={inhalBronch}
                  onChange={(e: any) => setInhalBronch(Number(e.target.value) as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs"
                >
                  <option value={0}>Grade 0: Normal mucosa</option>
                  <option value={1}>Grade 1: Mild erythema / slight edema</option>
                  <option value={2}>Grade 2: Moderate edema / carbon deposition</option>
                  <option value={3}>Grade 3: Severe edema / mucosal sloughing</option>
                  <option value={4}>Grade 4: Massive necrosis / occlusion</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleCalculateInhalation}
                className="w-full mt-2 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded text-xs transition"
              >
                Assess Airway & Cyanide Antidote
              </button>

              {inhalationOutput && (
                <div className="p-3 bg-orange-50 dark:bg-orange-950/40 rounded-lg border border-orange-300 dark:border-orange-800 text-orange-900 dark:text-orange-200 space-y-2">
                  <div className="flex items-center justify-between font-bold">
                    <span>COHb Half-Life: {inhalationOutput.estimatedCoHbHalfLifeHours} hrs</span>
                    <span className="text-xs bg-orange-200 dark:bg-orange-900 px-2 py-0.5 rounded">
                      Cyanide: {inhalationOutput.cyanideToxicityRisk}
                    </span>
                  </div>
                  {inhalationOutput.hydroxocobalaminIndicated && (
                    <div className="flex items-center gap-1.5 text-xs text-rose-700 dark:text-rose-400 font-bold">
                      <AlertTriangle className="h-4 w-4" />
                      Hydroxocobalamin (Cyanokit 5g IV) Indicated Immediately!
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
