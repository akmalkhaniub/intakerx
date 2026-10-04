import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  RefreshCw,
  Plus,
  CheckCircle2,
  Droplets,
  HeartPulse,
  Gauge,
  Layers,
  ShieldCheck,
  AlertOctagon
} from 'lucide-react';

interface CrrtSession {
  id: number;
  patient_id: number;
  kdigo_stage: number;
  modality: string;
  prescribed_effluent_dose_ml_kg_hr: number;
  patient_weight_kg: number;
  blood_flow_rate_ml_min: number;
  dialysate_flow_rate_ml_hr: number;
  replacement_fluid_flow_rate_ml_hr: number;
  replacement_predilution_percent: number;
  net_ultrafiltration_target_ml_hr: number;
  anticoagulation_type: string;
  filter_type: string;
  session_status: string;
  started_at: string;
  ended_at?: string | null;
  hourlyTelemetry?: any[];
}

export const CrrtNavigatorHub: React.FC = () => {
  const [sessions, setSessions] = useState<CrrtSession[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedSession, setSelectedSession] = useState<CrrtSession | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'sessions' | 'kdigo' | 'prescribe' | 'tmp_watchdog' | 'rca_citrate'>('sessions');

  // Modals
  const [showNewSessionModal, setShowNewSessionModal] = useState<boolean>(false);
  const [showTelemetryModal, setShowTelemetryModal] = useState<boolean>(false);

  // 1. KDIGO State
  const [baselineScr, setBaselineScr] = useState<number>(1.0);
  const [currentScr, setCurrentScr] = useState<number>(3.2);
  const [rise48h, setRise48h] = useState<number>(2.2);
  const [uoRate, setUoRate] = useState<number>(0.25);
  const [uoHours, setUoHours] = useState<number>(18);
  const [onRrt, setOnRrt] = useState<boolean>(false);
  const [kdigoResult, setKdigoResult] = useState<any | null>(null);

  // 2. Prescription State
  const [modality, setModality] = useState<'CVVHDF' | 'CVVH' | 'CVVHD' | 'SCUF'>('CVVHDF');
  const [patientWeight, setPatientWeight] = useState<number>(80);
  const [targetDose, setTargetDose] = useState<number>(22);
  const [downtimePct, setDowntimePct] = useState<number>(15);
  const [netUfRate, setNetUfRate] = useState<number>(150);
  const [predilutionPct, setPredilutionPct] = useState<number>(50);
  const [prescriptionResult, setPrescriptionResult] = useState<any | null>(null);

  // 3. TMP Watchdog State
  const [pPre, setPPre] = useState<number>(180);
  const [pVen, setPVen] = useState<number>(110);
  const [pEff, setPEff] = useState<number>(-40);
  const [tmpResult, setTmpResult] = useState<any | null>(null);

  // 4. RCA Citrate State
  const [postFilterIca, setPostFilterIca] = useState<number>(0.30);
  const [systemicIca, setSystemicIca] = useState<number>(1.18);
  const [totalCa, setTotalCa] = useState<number>(9.2);
  const [artPh, setArtPh] = useState<number>(7.38);
  const [rcaResult, setRcaResult] = useState<any | null>(null);

  // New Session Form State
  const [newKdigo, setNewKdigo] = useState<number>(3);
  const [newModality, setNewModality] = useState<string>('CVVHDF');
  const [newWeight, setNewWeight] = useState<number>(80);
  const [newDose, setNewDose] = useState<number>(25.8);
  const [newBfr, setNewBfr] = useState<number>(200);
  const [newDialysate, setNewDialysate] = useState<number>(950);
  const [newReplacement, setNewReplacement] = useState<number>(960);
  const [newNetUf, setNewNetUf] = useState<number>(150);
  const [newAnticoag, setNewAnticoag] = useState<string>('Regional_Citrate');

  // New Telemetry Form State
  const [teleHour, setTeleHour] = useState<number>(1);
  const [teleTmp, setTeleTmp] = useState<number>(165);
  const [teleDeltaP, setTeleDeltaP] = useState<number>(70);
  const [telePostIca, setTelePostIca] = useState<number>(0.31);
  const [teleSysIca, setTeleSysIca] = useState<number>(1.18);
  const [teleTotalCa, setTeleTotalCa] = useState<number>(9.2);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const res = await fetch('/api/clinician/crrt/sessions?limit=30', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
        if (data.length > 0 && !selectedSession) {
          fetchSessionDetails(data[0].id);
        }
      }
    } catch (e) {
      console.error('Error fetching CRRT sessions:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchSessionDetails = async (sessionId: number) => {
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const res = await fetch(`/api/clinician/crrt/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedSession(data);
      }
    } catch (e) {
      console.error('Error fetching CRRT session details:', e);
    }
  };

  useEffect(() => {
    fetchSessions();
    handleEvaluateKdigo();
    handleCalculatePrescription();
    handleEvaluateTmp();
    handleEvaluateRca();
  }, []);

  const handleEvaluateKdigo = async () => {
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const res = await fetch('/api/clinician/crrt/kdigo-stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          baselineCreatinineMgPerDl: baselineScr,
          currentCreatinineMgPerDl: currentScr,
          creatinineRise48hMgPerDl: rise48h,
          urineOutputMlPerKgPerHour: uoRate,
          urineOutputDurationHours: uoHours,
          alreadyOnRrt: onRrt
        })
      });
      if (res.ok) {
        const data = await res.json();
        setKdigoResult(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCalculatePrescription = async () => {
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const res = await fetch('/api/clinician/crrt/prescribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          modality,
          patientWeightKg: patientWeight,
          targetDeliveredDoseMlKgHr: targetDose,
          anticipatedDowntimePercent: downtimePct,
          netUltrafiltrationRateMlHr: netUfRate,
          replacementPredilutionPercent: predilutionPct
        })
      });
      if (res.ok) {
        const data = await res.json();
        setPrescriptionResult(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleEvaluateTmp = async () => {
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const res = await fetch('/api/clinician/crrt/filter-pressures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          filterInflowPressureMmhg: pPre,
          venousReturnPressureMmhg: pVen,
          effluentPressureMmhg: pEff
        })
      });
      if (res.ok) {
        const data = await res.json();
        setTmpResult(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleEvaluateRca = async () => {
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const res = await fetch('/api/clinician/crrt/rca-protocol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          postFilterIonizedCaMmolL: postFilterIca,
          systemicIonizedCaMmolL: systemicIca,
          totalSerumCalciumMgPerDl: totalCa,
          arterialPh: artPh
        })
      });
      if (res.ok) {
        const data = await res.json();
        setRcaResult(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const res = await fetch('/api/clinician/crrt/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          patientId: 1,
          kdigoStage: newKdigo,
          modality: newModality,
          prescribedEffluentDoseMlKgHr: newDose,
          patientWeightKg: newWeight,
          bloodFlowRateMlMin: newBfr,
          dialysateFlowRateMlHr: newDialysate,
          replacementFluidFlowRateMlHr: newReplacement,
          replacementPredilutionPercent: 50,
          netUltrafiltrationTargetMlHr: newNetUf,
          anticoagulationType: newAnticoag
        })
      });
      if (res.ok) {
        setShowNewSessionModal(false);
        fetchSessions();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRecordTelemetry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession) return;
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const totalMmol = teleTotalCa * 0.25;
      const ratio = Math.round((totalMmol / Math.max(teleSysIca, 0.1)) * 100) / 100;
      const isToxic = ratio >= 2.5;

      const res = await fetch(`/api/clinician/crrt/sessions/${selectedSession.id}/telemetry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          hourNumber: teleHour,
          transmembranePressureMmhg: teleTmp,
          filterPressureDropMmhg: teleDeltaP,
          postFilterIonizedCaMmolL: telePostIca,
          systemicIonizedCaMmolL: teleSysIca,
          totalSerumCaMgDl: teleTotalCa,
          totalToIonizedCaRatio: ratio,
          citrateToxicityAlert: isToxic,
          filterClottingRisk: teleTmp > 250 ? 'high' : 'low'
        })
      });
      if (res.ok) {
        setShowTelemetryModal(false);
        fetchSessionDetails(selectedSession.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col gap-5 p-6 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-800 dark:text-slate-100 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-gradient-to-r from-cyan-900 via-teal-900 to-slate-900 text-white rounded-2xl shadow-xl border border-cyan-700/50">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/10 rounded-xl backdrop-blur-md border border-white/20">
            <Droplets className="h-8 w-8 text-cyan-300 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-xs font-black tracking-widest bg-cyan-500/30 border border-cyan-400/40 rounded-full text-cyan-200 uppercase">
                ACUTE NEPHROLOGY & CRRT COMMAND
              </span>
              <span className="text-xs bg-teal-500/20 text-teal-200 border border-teal-400/30 px-2 py-0.5 rounded-full font-mono">
                KDIGO 2026 GUIDELINES
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white mt-1">
              CRRT-NAVIGATOR™ Dialysis & Nephrology Suite
            </h1>
            <p className="text-xs text-cyan-200/90 mt-0.5">
              KDIGO AKI Staging, CVVHDF/CVVH/CVVHD Modality Dose Solver, TMP Filter Clotting Sentinel & Regional Citrate Anticoagulation (RCA) Protocol
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewSessionModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all"
          >
            <Plus className="h-4 w-4" />
            New CRRT Session
          </button>
          <button
            onClick={fetchSessions}
            disabled={loading}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all"
            title="Refresh Sessions"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('sessions')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'sessions'
              ? 'bg-cyan-600 text-white shadow-md'
              : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          <Activity className="h-3.5 w-3.5" />
          Active CRRT Sessions ({sessions.length})
        </button>

        <button
          onClick={() => setActiveTab('kdigo')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'kdigo'
              ? 'bg-cyan-600 text-white shadow-md'
              : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          <HeartPulse className="h-3.5 w-3.5" />
          KDIGO AKI Staging
        </button>

        <button
          onClick={() => setActiveTab('prescribe')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'prescribe'
              ? 'bg-cyan-600 text-white shadow-md'
              : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          Effluent Dose & Modality Solver
        </button>

        <button
          onClick={() => setActiveTab('tmp_watchdog')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'tmp_watchdog'
              ? 'bg-cyan-600 text-white shadow-md'
              : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          <Gauge className="h-3.5 w-3.5" />
          TMP & Clotting Watchdog
        </button>

        <button
          onClick={() => setActiveTab('rca_citrate')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'rca_citrate'
              ? 'bg-cyan-600 text-white shadow-md'
              : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Regional Citrate Anticoagulation (RCA)
        </button>
      </div>

      {/* TAB 1: SESSIONS REGISTRY */}
      {activeTab === 'sessions' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Active Session List */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center justify-between">
              <span>CRRT Sessions</span>
              <span className="text-xs bg-cyan-100 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 px-2 py-0.5 rounded-full font-mono">
                {sessions.length} Active
              </span>
            </h2>

            {sessions.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                No active CRRT sessions recorded. Click &quot;New CRRT Session&quot; to begin.
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[600px] overflow-y-auto pr-1">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => {
                      setSelectedSession(s);
                      fetchSessionDetails(s.id);
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedSession?.id === s.id
                        ? 'border-cyan-500 bg-cyan-50/50 dark:bg-cyan-950/20 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-cyan-700 dark:text-cyan-300">
                        {s.modality}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        KDIGO Stage {s.kdigo_stage}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500">
                      <span>{s.patient_weight_kg} kg</span>
                      <span>•</span>
                      <span>Dose: {s.prescribed_effluent_dose_ml_kg_hr} mL/kg/h</span>
                      <span>•</span>
                      <span>BFR: {s.blood_flow_rate_ml_min} mL/min</span>
                    </div>

                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="px-2 py-0.5 text-[9px] font-bold bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 rounded border border-teal-300 dark:border-teal-800">
                        {s.anticoagulation_type.replace(/_/g, ' ')}
                      </span>
                      <span className="px-2 py-0.5 text-[9px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded">
                        {s.session_status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Selected Session Dossier & Telemetry */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {selectedSession ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-slate-900 dark:text-white">
                        {selectedSession.modality} Continuous Therapy
                      </h3>
                      <span className="text-xs bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 px-2 py-0.5 rounded font-mono font-bold">
                        Filter: {selectedSession.filter_type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Patient Weight: {selectedSession.patient_weight_kg} kg | Started: {new Date(selectedSession.started_at).toLocaleString()}
                    </p>
                  </div>

                  <button
                    onClick={() => setShowTelemetryModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg shadow-sm"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Log Telemetry Hour
                  </button>
                </div>

                {/* Machine Parameters Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Effluent Dose</span>
                    <span className="text-sm font-black text-cyan-600 dark:text-cyan-400">
                      {selectedSession.prescribed_effluent_dose_ml_kg_hr} mL/kg/h
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Blood Flow (BFR)</span>
                    <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                      {selectedSession.blood_flow_rate_ml_min} mL/min
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Dialysate Flow</span>
                    <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                      {selectedSession.dialysate_flow_rate_ml_hr} mL/hr
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Net Ultrafiltration</span>
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                      {selectedSession.net_ultrafiltration_target_ml_hr} mL/hr
                    </span>
                  </div>
                </div>

                {/* Hourly Telemetry Table */}
                <div className="mt-5">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-2">
                    Circuit Pressure & Ionized Calcium Telemetry
                  </h4>
                  {selectedSession.hourlyTelemetry && selectedSession.hourlyTelemetry.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 uppercase font-mono">
                            <th className="pb-2">Hour</th>
                            <th className="pb-2">TMP</th>
                            <th className="pb-2">ΔP (Drop)</th>
                            <th className="pb-2">Post-Filter iCa</th>
                            <th className="pb-2">Systemic iCa</th>
                            <th className="pb-2">Total:iCa Ratio</th>
                            <th className="pb-2">Alerts</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {selectedSession.hourlyTelemetry.map((t: any) => (
                            <tr key={t.id} className="text-slate-700 dark:text-slate-300">
                              <td className="py-2.5 font-bold">Hour {t.hour_number}</td>
                              <td className="py-2.5 font-mono">{t.transmembrane_pressure_mmhg} mmHg</td>
                              <td className="py-2.5 font-mono">{t.filter_pressure_drop_mmhg} mmHg</td>
                              <td className="py-2.5 font-mono text-cyan-600 dark:text-cyan-400 font-bold">
                                {t.post_filter_ionized_ca_mmol_l || '--'} mmol/L
                              </td>
                              <td className="py-2.5 font-mono">
                                {t.systemic_ionized_ca_mmol_l || '--'} mmol/L
                              </td>
                              <td className="py-2.5 font-mono font-bold">
                                {t.total_to_ionized_ca_ratio || '--'}
                              </td>
                              <td className="py-2.5">
                                {t.citrate_toxicity_alert ? (
                                  <span className="px-2 py-0.5 text-[9px] font-black bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 rounded border border-rose-300">
                                    CITRATE LOCK
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-emerald-600 font-semibold">Optimal</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 py-3 italic">
                      No hourly telemetry logged yet for this session.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center text-slate-400 text-xs">
                Select an active CRRT session to view continuous telemetry and prescription details.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: KDIGO AKI STAGING */}
      {activeTab === 'kdigo' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
              <HeartPulse className="h-4 w-4 text-cyan-500" />
              Renal Function & Urine Output
            </h2>

            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Baseline SCr (mg/dL)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={baselineScr}
                    onChange={(e) => setBaselineScr(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Current SCr (mg/dL)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={currentScr}
                    onChange={(e) => setCurrentScr(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">48-Hour SCr Rise (mg/dL)</label>
                <input
                  type="number"
                  step="0.1"
                  value={rise48h}
                  onChange={(e) => setRise48h(Number(e.target.value))}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Urine Output (mL/kg/h)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={uoRate}
                    onChange={(e) => setUoRate(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Duration (hours)</label>
                  <input
                    type="number"
                    value={uoHours}
                    onChange={(e) => setUoHours(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={onRrt}
                  onChange={(e) => setOnRrt(e.target.checked)}
                  className="rounded text-cyan-600"
                />
                Patient already receiving RRT
              </label>

              <button
                onClick={handleEvaluateKdigo}
                className="w-full mt-2 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg shadow-sm"
              >
                Compute KDIGO AKI Stage
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-4">
            {kdigoResult && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest">
                      KDIGO CLASSIFICATION
                    </span>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                      {kdigoResult.stageName}
                    </h3>
                  </div>

                  <div>
                    <span className={`px-3 py-1 font-black text-xs rounded-lg uppercase ${
                      kdigoResult.stage === 3
                        ? 'bg-rose-100 dark:bg-rose-950/60 border border-rose-300 text-rose-700 dark:text-rose-300 animate-pulse'
                        : kdigoResult.stage === 2
                        ? 'bg-amber-100 dark:bg-amber-950/60 border border-amber-300 text-amber-700 dark:text-amber-300'
                        : 'bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 text-emerald-700 dark:text-emerald-300'
                    }`}>
                      Stage {kdigoResult.stage}
                    </span>
                  </div>
                </div>

                <div className="mt-4">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                    Criteria Met:
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {kdigoResult.criteriaTriggered.map((c: string, idx: number) => (
                      <div key={idx} className="p-2 text-xs bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-cyan-500 shrink-0" />
                        {c}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                    Urgent Indications for Continuous Renal Replacement (AEIOU Checklist):
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {kdigoResult.crrtUrgentIndications.map((ind: string, idx: number) => (
                      <div key={idx} className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-xs text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {ind}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: EFFLUENT DOSE & MODALITY SOLVER */}
      {activeTab === 'prescribe' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Layers className="h-4 w-4 text-cyan-500" />
              Prescription Parameters
            </h2>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Modality</label>
                <select
                  value={modality}
                  onChange={(e: any) => setModality(e.target.value)}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                >
                  <option value="CVVHDF">CVVHDF (Hemodiafiltration - Diffusion + Convection)</option>
                  <option value="CVVH">CVVH (Hemofiltration - Pure Convection)</option>
                  <option value="CVVHD">CVVHD (Hemodialysis - Pure Diffusion)</option>
                  <option value="SCUF">SCUF (Slow Continuous Ultrafiltration - Pure UF)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Patient Weight (kg)</label>
                  <input
                    type="number"
                    value={patientWeight}
                    onChange={(e) => setPatientWeight(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Delivered Target (mL/kg/h)</label>
                  <input
                    type="number"
                    value={targetDose}
                    onChange={(e) => setTargetDose(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">KDIGO standard: 20-25</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Downtime Buffer (%)</label>
                  <input
                    type="number"
                    value={downtimePct}
                    onChange={(e) => setDowntimePct(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Standard: 15%</span>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Net UF Rate (mL/hr)</label>
                  <input
                    type="number"
                    value={netUfRate}
                    onChange={(e) => setNetUfRate(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Replacement Predilution (%)</label>
                <input
                  type="number"
                  value={predilutionPct}
                  onChange={(e) => setPredilutionPct(Number(e.target.value))}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">50% pre / 50% post balances clearance & filter life</span>
              </div>

              <button
                onClick={handleCalculatePrescription}
                className="w-full mt-2 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg shadow-sm"
              >
                Solve CRRT Fluid Prescription
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-4">
            {prescriptionResult && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest">
                      CALCULATED EFFLUENT PRESCRIPTION
                    </span>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                      {prescriptionResult.prescribedEffluentDoseMlKgHr} mL/kg/h ({prescriptionResult.totalEffluentRateMlHr} mL/hr Total)
                    </h3>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block font-mono">FILTRATION FRACTION</span>
                    <span className={`text-lg font-black ${prescriptionResult.filtrationFractionPercent > 20 ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {prescriptionResult.filtrationFractionPercent}%
                    </span>
                  </div>
                </div>

                {prescriptionResult.filtrationFractionWarning && (
                  <div className="my-4 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl flex items-start gap-2.5">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold text-amber-800 dark:text-amber-300 block">
                        CIRCUIT HEMOCONCENTRATION ALERT
                      </span>
                      <p className="text-xs text-amber-700 dark:text-amber-300/90 mt-0.5">
                        {prescriptionResult.filtrationFractionWarning}
                      </p>
                    </div>
                  </div>
                )}

                {/* Machine Flow Settings Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Blood Flow (BFR)</span>
                    <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                      {prescriptionResult.bloodFlowRateMlMin} mL/min
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Dialysate Flow</span>
                    <span className="text-sm font-black text-cyan-600 dark:text-cyan-400">
                      {prescriptionResult.dialysateFlowRateMlHr} mL/hr
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Replacement Flow</span>
                    <span className="text-sm font-black text-teal-600 dark:text-teal-400">
                      {prescriptionResult.replacementFluidRateMlHr} mL/hr
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Net Removal (UF)</span>
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                      {prescriptionResult.netUltrafiltrationRateMlHr} mL/hr
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                    Implementation Directives:
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {prescriptionResult.dosingRecommendations.map((d: string, idx: number) => (
                      <div key={idx} className="p-2 text-xs bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-cyan-500 shrink-0" />
                        {d}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: TMP & CLOTTING WATCHDOG */}
      {activeTab === 'tmp_watchdog' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Gauge className="h-4 w-4 text-cyan-500" />
              Circuit Pressure Sensors
            </h2>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Filter Inflow Pressure (P-pre, mmHg)
                </label>
                <input
                  type="number"
                  value={pPre}
                  onChange={(e) => setPPre(Number(e.target.value))}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Venous Return Pressure (P-ven, mmHg)
                </label>
                <input
                  type="number"
                  value={pVen}
                  onChange={(e) => setPVen(Number(e.target.value))}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Effluent Fluid Pressure (P-eff, mmHg)
                </label>
                <input
                  type="number"
                  value={pEff}
                  onChange={(e) => setPEff(Number(e.target.value))}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Typically negative due to ultrafiltration pump suction</span>
              </div>

              <button
                onClick={handleEvaluateTmp}
                className="w-full mt-2 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg shadow-sm"
              >
                Compute TMP & Hollow Fiber Gradient
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-4">
            {tmpResult && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest">
                      TRANSMEMBRANE PRESSURE (TMP)
                    </span>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                      {tmpResult.transmembranePressureMmhg} mmHg
                    </h3>
                  </div>

                  <div>
                    <span className={`px-3 py-1 font-black text-xs rounded-lg uppercase ${
                      tmpResult.clottingRisk === 'critical_clot_immediate_change'
                        ? 'bg-rose-100 dark:bg-rose-950/60 border border-rose-300 text-rose-700 dark:text-rose-300 animate-pulse'
                        : tmpResult.clottingRisk === 'high_clotting_risk'
                        ? 'bg-amber-100 dark:bg-amber-950/60 border border-amber-300 text-amber-700 dark:text-amber-300'
                        : 'bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 text-emerald-700 dark:text-emerald-300'
                    }`}>
                      {tmpResult.clottingRisk.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 my-4">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Filter Drop (ΔP)</span>
                    <span className="text-base font-black text-slate-800 dark:text-slate-200">
                      {tmpResult.pressureDropMmhg} mmHg
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Threshold: &gt; 150-200 mmHg</span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Suggested Clinical Action</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mt-0.5">
                      {tmpResult.suggestedAction}
                    </span>
                  </div>
                </div>

                {tmpResult.warnings.length > 0 && (
                  <div className="mt-4">
                    <span className="text-xs font-bold text-rose-700 dark:text-rose-300 block mb-2">
                      Pressure Alarm Sentinel:
                    </span>
                    <div className="flex flex-col gap-1.5">
                      {tmpResult.warnings.map((w: string, idx: number) => (
                        <div key={idx} className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-lg text-xs font-semibold text-rose-800 dark:text-rose-200 flex items-center gap-2">
                          <AlertOctagon className="h-4 w-4 text-rose-600 shrink-0" />
                          {w}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: RCA CITRATE PROTOCOL */}
      {activeTab === 'rca_citrate' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-cyan-500" />
              Ionized & Total Calcium Levels
            </h2>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Post-Filter Circuit iCa (mmol/L)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={postFilterIca}
                  onChange={(e) => setPostFilterIca(Number(e.target.value))}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                />
                <span className="text-[10px] text-cyan-600 dark:text-cyan-400 mt-0.5 block font-bold">Target: 0.25 - 0.35 mmol/L</span>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Systemic Patient iCa (mmol/L)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={systemicIca}
                  onChange={(e) => setSystemicIca(Number(e.target.value))}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                />
                <span className="text-[10px] text-teal-600 dark:text-teal-400 mt-0.5 block font-bold">Target: 1.10 - 1.30 mmol/L</span>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Total Serum Calcium (mg/dL)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={totalCa}
                  onChange={(e) => setTotalCa(Number(e.target.value))}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Arterial Blood Gas pH
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={artPh}
                  onChange={(e) => setArtPh(Number(e.target.value))}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                />
              </div>

              <button
                onClick={handleEvaluateRca}
                className="w-full mt-2 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg shadow-sm"
              >
                Assess Citrate Accumulation & Titration
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-4">
            {rcaResult && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest">
                      TOTAL-TO-IONIZED CALCIUM RATIO
                    </span>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                      {rcaResult.totalToIonizedCaRatio}
                    </h3>
                  </div>

                  <div>
                    {rcaResult.citrateToxicityDetected ? (
                      <span className="px-3 py-1 bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-black text-xs rounded-lg animate-pulse">
                        CITRATE LOCK / TOXICITY (RATIO &ge; 2.5)
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-black text-xs rounded-lg">
                        Normal Citrate Metabolism
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 my-4">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Circuit Status</span>
                    <span className="text-xs font-black text-cyan-700 dark:text-cyan-300 mt-1 block">
                      {rcaResult.circuitAnticoagulationStatus}
                    </span>
                    <p className="text-[11px] text-slate-500 mt-1">{rcaResult.citrateTitrationDirective}</p>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Systemic Calcium Status</span>
                    <span className="text-xs font-black text-teal-700 dark:text-teal-300 mt-1 block">
                      {rcaResult.systemicCalciumStatus}
                    </span>
                    <p className="text-[11px] text-slate-500 mt-1">{rcaResult.calciumTitrationDirective}</p>
                  </div>
                </div>

                {rcaResult.emergencyActions.length > 0 && (
                  <div className="mt-4">
                    <span className="text-xs font-bold text-rose-700 dark:text-rose-300 block mb-2">
                      Emergency Citrate Toxicity Actions:
                    </span>
                    <div className="flex flex-col gap-1.5">
                      {rcaResult.emergencyActions.map((act: string, idx: number) => (
                        <div key={idx} className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-lg text-xs font-semibold text-rose-800 dark:text-rose-200 flex items-center gap-2">
                          <AlertOctagon className="h-4 w-4 text-rose-600 shrink-0" />
                          {act}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* NEW SESSION MODAL */}
      {showNewSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl">
            <h3 className="text-base font-black text-slate-900 dark:text-white mb-3">
              Initiate New CRRT Treatment Session
            </h3>

            <form onSubmit={handleCreateSession} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">KDIGO Stage</label>
                  <select
                    value={newKdigo}
                    onChange={(e) => setNewKdigo(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  >
                    <option value={3}>Stage 3 (Severe)</option>
                    <option value={2}>Stage 2</option>
                    <option value={1}>Stage 1</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Modality</label>
                  <select
                    value={newModality}
                    onChange={(e) => setNewModality(e.target.value)}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  >
                    <option value="CVVHDF">CVVHDF</option>
                    <option value="CVVH">CVVH</option>
                    <option value="CVVHD">CVVHD</option>
                    <option value="SCUF">SCUF</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Weight (kg)</label>
                  <input
                    type="number"
                    value={newWeight}
                    onChange={(e) => setNewWeight(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Prescribed Dose (mL/kg/h)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newDose}
                    onChange={(e) => setNewDose(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Blood Flow (mL/min)</label>
                  <input
                    type="number"
                    value={newBfr}
                    onChange={(e) => setNewBfr(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Net UF Target (mL/hr)</label>
                  <input
                    type="number"
                    value={newNetUf}
                    onChange={(e) => setNewNetUf(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Dialysate Flow (mL/hr)</label>
                  <input
                    type="number"
                    value={newDialysate}
                    onChange={(e) => setNewDialysate(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Replacement Flow (mL/hr)</label>
                  <input
                    type="number"
                    value={newReplacement}
                    onChange={(e) => setNewReplacement(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Anticoagulation</label>
                <select
                  value={newAnticoag}
                  onChange={(e) => setNewAnticoag(e.target.value)}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                >
                  <option value="Regional_Citrate">Regional Citrate (Pre-filter)</option>
                  <option value="Systemic_Heparin">Systemic Unfractionated Heparin</option>
                  <option value="None_Saline_Flushes">None (Frequent Saline Flushes)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewSessionModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg shadow-sm"
                >
                  Start CRRT Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HOURLY TELEMETRY MODAL */}
      {showTelemetryModal && selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl">
            <h3 className="text-base font-black text-slate-900 dark:text-white mb-1">
              Log Hourly Telemetry
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Session #{selectedSession.id} ({selectedSession.modality})
            </p>

            <form onSubmit={handleRecordTelemetry} className="flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Hour #</label>
                  <input
                    type="number"
                    value={teleHour}
                    onChange={(e) => setTeleHour(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">TMP (mmHg)</label>
                  <input
                    type="number"
                    value={teleTmp}
                    onChange={(e) => setTeleTmp(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">ΔP Drop (mmHg)</label>
                  <input
                    type="number"
                    value={teleDeltaP}
                    onChange={(e) => setTeleDeltaP(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Post iCa (mmol/L)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={telePostIca}
                    onChange={(e) => setTelePostIca(Number(e.target.value))}
                    className="w-full mt-1 p-1.5 text-xs border rounded bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Sys iCa (mmol/L)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={teleSysIca}
                    onChange={(e) => setTeleSysIca(Number(e.target.value))}
                    className="w-full mt-1 p-1.5 text-xs border rounded bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Total Ca (mg/dL)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={teleTotalCa}
                    onChange={(e) => setTeleTotalCa(Number(e.target.value))}
                    className="w-full mt-1 p-1.5 text-xs border rounded bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTelemetryModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg shadow-sm"
                >
                  Save Telemetry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
