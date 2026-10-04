import React, { useState, useEffect } from 'react';
import {
  Baby,
  Heart,
  Activity,
  Zap,
  RefreshCw,
  Plus,
  Wind,
  XCircle,
  Sliders,
  Scale
} from 'lucide-react';

interface NeonatalEvent {
  id: number;
  patient_id: number;
  birth_timestamp: string;
  gestational_age_weeks: number;
  birth_weight_grams: number;
  apgar_1min: number;
  apgar_5min: number;
  apgar_10min?: number | null;
  apgar_details: any;
  ppv_required: boolean;
  intubation_required: boolean;
  chest_compressions_required: boolean;
  epinephrine_administered: boolean;
  uvc_placed: boolean;
  target_preductal_spo2_met: boolean;
  serum_bilirubin_mg_dl?: number | null;
  postnatal_age_hours?: number | null;
  phototherapy_indicated: boolean;
  exchange_transfusion_indicated: boolean;
  resuscitation_status: string;
  created_at: string;
}

interface PediatricCode {
  id: number;
  patient_id: number;
  patient_age_months: number;
  patient_weight_kg: number;
  broselow_color: string;
  ett_size_uncuffed_mm: number;
  ett_size_cuffed_mm: number;
  ett_insertion_depth_cm: number;
  defibrillation_joules: number;
  cardioversion_joules: number;
  epinephrine_dose_mg: number;
  amiodarone_dose_mg: number;
  normal_saline_bolus_ml: number;
  pim3_mortality_percent?: number | null;
  pelod2_score?: number | null;
  clinical_notes?: string | null;
  created_at: string;
}

export const NrpSafeHub: React.FC = () => {
  const [neonatalEvents, setNeonatalEvents] = useState<NeonatalEvent[]>([]);
  const [pediatricCodes, setPediatricCodes] = useState<PediatricCode[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedEvent, setSelectedEvent] = useState<NeonatalEvent | null>(null);
  const [selectedCode, setSelectedCode] = useState<PediatricCode | null>(null);

  // Modals
  const [showApgarModal, setShowApgarModal] = useState<boolean>(false);
  const [showBroselowModal, setShowBroselowModal] = useState<boolean>(false);
  const [showBhutaniModal, setShowBhutaniModal] = useState<boolean>(false);
  const [showNewNeoModal, setShowNewNeoModal] = useState<boolean>(false);

  // APGAR Calculator State
  const [apgarHr, setApgarHr] = useState<0 | 1 | 2>(2);
  const [apgarResp, setApgarResp] = useState<0 | 1 | 2>(2);
  const [apgarTone, setApgarTone] = useState<0 | 1 | 2>(1);
  const [apgarReflex, setApgarReflex] = useState<0 | 1 | 2>(1);
  const [apgarColor, setApgarColor] = useState<0 | 1 | 2>(1);
  const [apgarResult, setApgarResult] = useState<any | null>(null);

  // Broselow Calculator State
  const [calcAgeMonths, setCalcAgeMonths] = useState<number>(36);
  const [calcWeightKg, setCalcWeightKg] = useState<number>(14.0);
  const [broselowResult, setBroselowResult] = useState<any | null>(null);

  // Bhutani Nomogram State
  const [bhutaniAgeHours, setBhutaniAgeHours] = useState<number>(48);
  const [bhutaniTsb, setBhutaniTsb] = useState<number>(13.5);
  const [bhutaniGa, setBhutaniGa] = useState<number>(38);
  const [bhutaniHemolysis, setBhutaniHemolysis] = useState<boolean>(false);
  const [bhutaniResult, setBhutaniResult] = useState<any | null>(null);

  // Form: New Neonatal Event
  const [patientId, setPatientId] = useState<number>(1);
  const [gestAge, setGestAge] = useState<number>(39.0);
  const [birthWt, setBirthWt] = useState<number>(3200);
  const [score1m, setScore1m] = useState<number>(4);
  const [score5m, setScore5m] = useState<number>(8);
  const [ppvReq, setPpvReq] = useState<boolean>(true);
  const [compressionsReq, setCompressionsReq] = useState<boolean>(false);
  const [epiAdmin, setEpiAdmin] = useState<boolean>(false);
  const [uvcPlaced, setUvcPlaced] = useState<boolean>(false);

  // Live NRP evaluation state
  const [nrpMinutes, setNrpMinutes] = useState<number>(2);
  const [nrpHr, setNrpHr] = useState<number>(85);
  const [nrpSpo2, setNrpSpo2] = useState<number>(68);
  const [nrpOutput, setNrpOutput] = useState<any | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [neoRes, pedsRes] = await Promise.all([
        fetch('/api/clinician/pediatric/neonatal-events', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch('/api/clinician/pediatric/code-cases', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
      ]);
      if (neoRes.ok) {
        const neoData = await neoRes.json();
        setNeonatalEvents(neoData);
        if (neoData.length > 0 && !selectedEvent) {
          setSelectedEvent(neoData[0]);
        }
      }
      if (pedsRes.ok) {
        const pedsData = await pedsRes.json();
        setPediatricCodes(pedsData);
        if (pedsData.length > 0 && !selectedCode) {
          setSelectedCode(pedsData[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch pediatric data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCalculateApgar = async () => {
    try {
      const res = await fetch('/api/clinician/pediatric/evaluate-apgar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          heartRate: apgarHr,
          respiratoryEffort: apgarResp,
          muscleTone: apgarTone,
          reflexIrritability: apgarReflex,
          color: apgarColor
        })
      });
      if (res.ok) {
        const data = await res.json();
        setApgarResult(data);
      }
    } catch (err) {
      console.error('Calculate APGAR error:', err);
    }
  };

  const handleCalculateBroselow = async () => {
    try {
      const res = await fetch('/api/clinician/pediatric/calculate-broselow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          patientAgeMonths: calcAgeMonths,
          patientWeightKg: calcWeightKg
        })
      });
      if (res.ok) {
        const data = await res.json();
        setBroselowResult(data);
      }
    } catch (err) {
      console.error('Calculate Broselow error:', err);
    }
  };

  const handleCalculateBhutani = async () => {
    try {
      const res = await fetch('/api/clinician/pediatric/evaluate-bhutani', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          postnatalAgeHours: bhutaniAgeHours,
          totalSerumBilirubinMgDl: bhutaniTsb,
          gestationalAgeWeeks: bhutaniGa,
          hasHemolysisOrG6pd: bhutaniHemolysis
        })
      });
      if (res.ok) {
        const data = await res.json();
        setBhutaniResult(data);
      }
    } catch (err) {
      console.error('Calculate Bhutani error:', err);
    }
  };

  const handleEvaluateNrp = async () => {
    try {
      const res = await fetch('/api/clinician/pediatric/evaluate-nrp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          gestationalAgeWeeks: selectedEvent ? Number(selectedEvent.gestational_age_weeks) : 39,
          postnatalAgeMinutes: nrpMinutes,
          heartRateBpm: nrpHr,
          isBreathingOrCrying: nrpHr >= 100,
          preductalSpo2Percent: nrpSpo2,
          muscleToneAdequate: true
        })
      });
      if (res.ok) {
        const data = await res.json();
        setNrpOutput(data);
      }
    } catch (err) {
      console.error('Evaluate NRP error:', err);
    }
  };

  const handleCreateNeonatalEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/clinician/pediatric/neonatal-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          patientId,
          eventData: {
            birthTimestamp: new Date().toISOString(),
            gestationalAgeWeeks: gestAge,
            birthWeightGrams: birthWt,
            apgar1min: score1m,
            apgar5min: score5m,
            apgarDetails: { '1min': score1m, '5min': score5m },
            ppvRequired: ppvReq,
            chestCompressionsRequired: compressionsReq,
            epinephrineAdministered: epiAdmin,
            uvcPlaced: uvcPlaced
          }
        })
      });
      if (res.ok) {
        setShowNewNeoModal(false);
        fetchData();
      }
    } catch (err) {
      console.error('Create neonatal event error:', err);
    }
  };

  const getBroselowBg = (colorName: string) => {
    switch (colorName.toLowerCase()) {
      case 'pink': return 'bg-pink-500 text-white';
      case 'red': return 'bg-rose-600 text-white';
      case 'purple': return 'bg-purple-600 text-white';
      case 'yellow': return 'bg-amber-400 text-slate-950';
      case 'white': return 'bg-slate-100 text-slate-900 border border-slate-300';
      case 'blue': return 'bg-blue-600 text-white';
      case 'orange': return 'bg-orange-500 text-white';
      case 'green': return 'bg-emerald-600 text-white';
      default: return 'bg-slate-500 text-white';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-sky-950 via-indigo-950 to-slate-900 text-white rounded-xl p-6 shadow-lg border border-sky-700/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-500/20 rounded-lg border border-sky-400/40">
              <Baby className="h-7 w-7 text-sky-400 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">NRP-SAFE Hub & PICU Resuscitation Command</h1>
              <p className="text-xs text-sky-200/80">
                Phase 56: Neonatal Resuscitation Program (8th Ed), APGAR Scoring, Broselow Tape & Bhutani Hyperbilirubinemia
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowApgarModal(true)}
            className="px-3 py-2 bg-sky-800/60 hover:bg-sky-700 text-sky-200 border border-sky-600/50 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Activity className="h-4 w-4 text-sky-300" />
            APGAR Calculator
          </button>
          <button
            onClick={() => setShowBroselowModal(true)}
            className="px-3 py-2 bg-indigo-800/60 hover:bg-indigo-700 text-indigo-200 border border-indigo-600/50 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Scale className="h-4 w-4 text-indigo-300" />
            Broselow Sizing
          </button>
          <button
            onClick={() => setShowBhutaniModal(true)}
            className="px-3 py-2 bg-amber-800/60 hover:bg-amber-700 text-amber-200 border border-amber-600/50 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Wind className="h-4 w-4 text-amber-300" />
            Bhutani Nomogram
          </button>
          <button
            onClick={() => setShowNewNeoModal(true)}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 shadow transition"
          >
            <Plus className="h-4 w-4" />
            New Neonatal Event
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-sky-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Grid: Cohort Sidebar & Resuscitation Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar: Events & Code Cases */}
        <div className="lg:col-span-4 space-y-4">
          <div>
            <div className="flex items-center justify-between px-1 mb-2">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Neonatal Resuscitation</h2>
              <span className="text-xs bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full font-mono">
                {neonatalEvents.length} Events
              </span>
            </div>

            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {neonatalEvents.length === 0 ? (
                <div className="p-4 text-center border border-dashed border-slate-300 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
                  No neonatal resuscitation events logged.
                </div>
              ) : (
                neonatalEvents.map((ev) => {
                  const isSelected = selectedEvent?.id === ev.id;
                  return (
                    <div
                      key={ev.id}
                      onClick={() => setSelectedEvent(ev)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition ${
                        isSelected
                          ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/20 shadow-sm ring-1 ring-sky-500/50'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                            {ev.gestational_age_weeks}w GA
                          </span>
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                            Pt #{ev.patient_id}
                          </span>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          ev.apgar_1min < 4 ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                        }`}>
                          APGAR: {ev.apgar_1min} / {ev.apgar_5min}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
                        <span>Weight: {ev.birth_weight_grams}g</span>
                        <span>{ev.ppv_required ? 'PPV Required' : 'Spontaneous'}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between px-1 mb-2">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Peds Code & Broselow</h2>
              <span className="text-xs bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full font-mono">
                {pediatricCodes.length} Codes
              </span>
            </div>

            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {pediatricCodes.length === 0 ? (
                <div className="p-4 text-center border border-dashed border-slate-300 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
                  No pediatric code cases logged.
                </div>
              ) : (
                pediatricCodes.map((code) => {
                  const isSelected = selectedCode?.id === code.id;
                  return (
                    <div
                      key={code.id}
                      onClick={() => setSelectedCode(code)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-sm ring-1 ring-indigo-500/50'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 text-xs font-mono font-bold rounded ${getBroselowBg(code.broselow_color)}`}>
                            {code.broselow_color} Zone
                          </span>
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {code.patient_weight_kg} kg
                          </span>
                        </div>
                        <span className="text-xs font-mono text-slate-500">
                          {code.patient_age_months}m old
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
                        <span>ETT: {code.ett_size_cuffed_mm}mm cuffed</span>
                        <span>Defib: {code.defibrillation_joules}J</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Central Deck */}
        <div className="lg:col-span-8 space-y-6">
          {selectedEvent ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Neonatal Resuscitation Case #{selectedEvent.id}
                    </h3>
                    <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500 font-mono">
                      {selectedEvent.gestational_age_weeks} Weeks Gestation ({selectedEvent.birth_weight_grams}g)
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Birth Time: {new Date(selectedEvent.birth_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 text-xs rounded-full font-bold ${
                    selectedEvent.apgar_1min < 4 ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                  }`}>
                    APGAR: 1m={selectedEvent.apgar_1min} | 5m={selectedEvent.apgar_5min}
                  </span>
                </div>
              </div>

              {/* 4 Metric Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">1-Min APGAR</span>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className={`text-2xl font-black font-mono ${selectedEvent.apgar_1min < 4 ? 'text-rose-600 dark:text-rose-400' : 'text-sky-600 dark:text-sky-400'}`}>
                      {selectedEvent.apgar_1min}
                    </span>
                    <span className="text-xs text-slate-500">/ 10</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">Depression Severity</span>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">5-Min APGAR</span>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                      {selectedEvent.apgar_5min}
                    </span>
                    <span className="text-xs text-slate-500">/ 10</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">Transition Response</span>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Airway Support</span>
                  <div className="mt-1">
                    <span className="text-base font-bold font-mono text-indigo-600 dark:text-indigo-400">
                      {selectedEvent.ppv_required ? 'PPV Delivered' : 'Spontaneous'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    {selectedEvent.intubation_required ? 'ETT Intubated' : 'Mask Resuscitator'}
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Preductal SpO₂</span>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-2xl font-black font-mono text-sky-600 dark:text-sky-400">
                      {selectedEvent.target_preductal_spo2_met ? 'Met' : 'Low'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">Right Wrist Sensor</span>
                </div>
              </div>

              {/* Interactive NRP 8th Edition Algorithm Console */}
              <div className="p-4 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-sky-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      NRP 8th Edition Real-Time Resuscitation Watchdog
                    </h4>
                  </div>
                  <button
                    onClick={handleEvaluateNrp}
                    className="px-3 py-1 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded transition flex items-center gap-1"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Evaluate NRP Step
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="text-slate-400 text-[10px] block mb-1">Postnatal Age (Minutes)</label>
                    <input
                      type="number"
                      min="1"
                      max="15"
                      value={nrpMinutes}
                      onChange={(e) => setNrpMinutes(Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 font-mono text-slate-200 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-[10px] block mb-1">Heart Rate (BPM)</label>
                    <input
                      type="number"
                      value={nrpHr}
                      onChange={(e) => setNrpHr(Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 font-mono text-slate-200 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-[10px] block mb-1">Preductal SpO₂ (%)</label>
                    <input
                      type="number"
                      value={nrpSpo2}
                      onChange={(e) => setNrpSpo2(Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 font-mono text-slate-200 text-xs"
                    />
                  </div>
                </div>

                {nrpOutput && (
                  <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="px-2 py-0.5 rounded font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/50">
                        Target SpO₂: {nrpOutput.targetPreductalSpo2Range}
                      </span>
                      <span className="px-2 py-0.5 rounded font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/50">
                        FiO₂ Target: {nrpOutput.recommendedFiO2}%
                      </span>
                      {nrpOutput.epinephrineUvcDoseMg && (
                        <span className="px-2 py-0.5 rounded font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/50 animate-pulse">
                          Epinephrine UVC: {nrpOutput.epinephrineUvcDoseMg} mg ({nrpOutput.epinephrineUvcDoseMl} mL)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-sky-200/90 font-medium">{nrpOutput.clinicalDirective}</p>
                    {nrpOutput.requiredInterventions.length > 0 && (
                      <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside pt-1">
                        {nrpOutput.requiredInterventions.map((step: string, idx: number) => (
                          <li key={idx}>{step}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-sm">
              Select a neonatal resuscitation event or pediatric code case.
            </div>
          )}

          {/* Broselow PALS Emergency Reference Deck for Selected Code */}
          {selectedCode && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-rose-500" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    PALS Emergency Drug & Defibrillation Sheet (Pt #{selectedCode.patient_id})
                  </h3>
                </div>
                <span className={`px-2.5 py-0.5 text-xs font-mono font-bold rounded ${getBroselowBg(selectedCode.broselow_color)}`}>
                  {selectedCode.broselow_color} Zone ({selectedCode.patient_weight_kg} kg)
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 font-semibold block">Airway (ETT)</span>
                  <p className="text-sm font-bold font-mono text-slate-900 dark:text-white mt-1">
                    {selectedCode.ett_size_cuffed_mm} mm cuffed
                  </p>
                  <span className="text-[10px] text-slate-400">Depth: {selectedCode.ett_insertion_depth_cm} cm at lip</span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 font-semibold block">Defibrillation</span>
                  <p className="text-sm font-bold font-mono text-rose-600 dark:text-rose-400 mt-1">
                    {selectedCode.defibrillation_joules} Joules (2 J/kg)
                  </p>
                  <span className="text-[10px] text-slate-400">Cardioversion: {selectedCode.cardioversion_joules} J</span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 font-semibold block">Epinephrine 1:10,000</span>
                  <p className="text-sm font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
                    {selectedCode.epinephrine_dose_mg} mg
                  </p>
                  <span className="text-[10px] text-slate-400">Volume: {(selectedCode.epinephrine_dose_mg / 0.1).toFixed(2)} mL IV/IO</span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 font-semibold block">Fluid Resuscitation</span>
                  <p className="text-sm font-bold font-mono text-blue-600 dark:text-blue-400 mt-1">
                    {selectedCode.normal_saline_bolus_ml} mL
                  </p>
                  <span className="text-[10px] text-slate-400">20 mL/kg Normal Saline bolus</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: APGAR Calculator */}
      {showApgarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Activity className="h-5 w-5 text-sky-500" />
                APGAR Score Calculator
              </h3>
              <button onClick={() => setShowApgarModal(false)} className="text-slate-400 hover:text-slate-200">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Heart Rate</label>
                <select
                  value={apgarHr}
                  onChange={(e: any) => setApgarHr(Number(e.target.value) as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-semibold"
                >
                  <option value={0}>0: Absent</option>
                  <option value={1}>1: &lt; 100 BPM</option>
                  <option value={2}>2: &gt;= 100 BPM</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Respiratory Effort</label>
                <select
                  value={apgarResp}
                  onChange={(e: any) => setApgarResp(Number(e.target.value) as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-semibold"
                >
                  <option value={0}>0: Absent</option>
                  <option value={1}>1: Slow, irregular, or weak cry</option>
                  <option value={2}>2: Good, vigorous crying</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Muscle Tone</label>
                <select
                  value={apgarTone}
                  onChange={(e: any) => setApgarTone(Number(e.target.value) as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-semibold"
                >
                  <option value={0}>0: Flaccid / limp</option>
                  <option value={1}>1: Some flexion of extremities</option>
                  <option value={2}>2: Active motion</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Reflex Irritability</label>
                <select
                  value={apgarReflex}
                  onChange={(e: any) => setApgarReflex(Number(e.target.value) as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-semibold"
                >
                  <option value={0}>0: No response</option>
                  <option value={1}>1: Grimace</option>
                  <option value={2}>2: Vigorous cry, cough, or sneeze</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Color</label>
                <select
                  value={apgarColor}
                  onChange={(e: any) => setApgarColor(Number(e.target.value) as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-semibold"
                >
                  <option value={0}>0: Blue, pale all over</option>
                  <option value={1}>1: Body pink, extremities blue (Acrocyanosis)</option>
                  <option value={2}>2: Completely pink</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleCalculateApgar}
                className="w-full mt-2 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded text-xs transition"
              >
                Compute APGAR Score & Interpretation
              </button>

              {apgarResult && (
                <div className="p-3 bg-sky-50 dark:bg-sky-950/40 rounded-lg border border-sky-300 dark:border-sky-800 text-sky-900 dark:text-sky-200 space-y-1">
                  <div className="flex items-center justify-between font-bold">
                    <span>APGAR Score: {apgarResult.totalScore} / 10</span>
                    <span className="text-xs bg-sky-200 dark:bg-sky-900 px-2 py-0.5 rounded">
                      {apgarResult.clinicalCategory}
                    </span>
                  </div>
                  <ul className="text-[11px] text-sky-800 dark:text-sky-300 list-disc list-inside">
                    {apgarResult.immediateActions.map((action: string, idx: number) => (
                      <li key={idx}>{action}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Broselow PALS Sizing */}
      {showBroselowModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Scale className="h-5 w-5 text-indigo-500" />
                Broselow Pediatric Tape Calculator
              </h3>
              <button onClick={() => setShowBroselowModal(false)} className="text-slate-400 hover:text-slate-200">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Age (Months)</label>
                  <input
                    type="number"
                    value={calcAgeMonths}
                    onChange={(e) => setCalcAgeMonths(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={calcWeightKg}
                    onChange={(e) => setCalcWeightKg(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleCalculateBroselow}
                className="w-full mt-2 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded text-xs transition"
              >
                Compute Broselow Zone & Doses
              </button>

              {broselowResult && (
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg border border-indigo-300 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 space-y-2">
                  <div className="flex items-center justify-between font-bold">
                    <span className={`px-2 py-0.5 rounded ${getBroselowBg(broselowResult.broselowColor)}`}>
                      {broselowResult.broselowColor} Zone
                    </span>
                    <span className="text-xs">{broselowResult.weightTierDescription}</span>
                  </div>
                  <div className="text-[11px] grid grid-cols-2 gap-1 pt-1 border-t border-indigo-200 dark:border-indigo-800">
                    <span>ETT: {broselowResult.ettSizeCuffedMm}mm cuffed</span>
                    <span>Depth: {broselowResult.ettDepthLipCm} cm</span>
                    <span>Defib: {broselowResult.defibrillationJoules} J</span>
                    <span>Epinephrine: {broselowResult.epinephrineDoseMg} mg</span>
                    <span>NS Bolus: {broselowResult.normalSalineBolusMl} mL</span>
                    <span>Amiodarone: {broselowResult.amiodaroneDoseMg} mg</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Bhutani Nomogram */}
      {showBhutaniModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Wind className="h-5 w-5 text-amber-500" />
                Bhutani Hyperbilirubinemia Nomogram
              </h3>
              <button onClick={() => setShowBhutaniModal(false)} className="text-slate-400 hover:text-slate-200">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Postnatal Age (Hours)</label>
                  <input
                    type="number"
                    min="12"
                    max="120"
                    value={bhutaniAgeHours}
                    onChange={(e) => setBhutaniAgeHours(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Total Bilirubin (mg/dL)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={bhutaniTsb}
                    onChange={(e) => setBhutaniTsb(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Gestational Age (Weeks)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={bhutaniGa}
                    onChange={(e) => setBhutaniGa(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs"
                  />
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bhutaniHemolysis}
                      onChange={(e) => setBhutaniHemolysis(e.target.checked)}
                      className="rounded text-amber-600"
                    />
                    <span>Hemolysis / G6PD</span>
                  </label>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCalculateBhutani}
                className="w-full mt-2 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded text-xs transition"
              >
                Assess Bilirubin Risk & Phototherapy
              </button>

              {bhutaniResult && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-2">
                  <div className="flex items-center justify-between font-bold">
                    <span>{bhutaniResult.riskZone} ({bhutaniResult.percentileEst})</span>
                    <span className="text-xs bg-amber-200 dark:bg-amber-900 px-2 py-0.5 rounded">
                      Phototherapy: {bhutaniResult.phototherapyIndicated ? 'YES' : 'NO'}
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300">{bhutaniResult.recommendation}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: New Neonatal Event */}
      {showNewNeoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Baby className="h-5 w-5 text-sky-500" />
                Record Neonatal Delivery & Resuscitation
              </h3>
              <button onClick={() => setShowNewNeoModal(false)} className="text-slate-400 hover:text-slate-200">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNeonatalEvent} className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-3">
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
                  <label className="block text-slate-500 font-semibold mb-1">Gest Age (Weeks)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={gestAge}
                    onChange={(e) => setGestAge(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Birth Wt (g)</label>
                  <input
                    type="number"
                    value={birthWt}
                    onChange={(e) => setBirthWt(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">1-Min APGAR</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={score1m}
                    onChange={(e) => setScore1m(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">5-Min APGAR</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={score5m}
                    onChange={(e) => setScore5m(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ppvReq}
                    onChange={(e) => setPpvReq(e.target.checked)}
                    className="rounded text-sky-600"
                  />
                  <span>PPV Required</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={compressionsReq}
                    onChange={(e) => setCompressionsReq(e.target.checked)}
                    className="rounded text-sky-600"
                  />
                  <span>Chest Compressions</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={epiAdmin}
                    onChange={(e) => setEpiAdmin(e.target.checked)}
                    className="rounded text-sky-600"
                  />
                  <span>Epinephrine Given</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={uvcPlaced}
                    onChange={(e) => setUvcPlaced(e.target.checked)}
                    className="rounded text-sky-600"
                  />
                  <span>UVC Placed</span>
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewNeoModal(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded text-xs shadow"
                >
                  Log Delivery & Resuscitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
