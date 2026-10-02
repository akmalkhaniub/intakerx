import React, { useState, useEffect } from 'react';
import {
  Activity,
  Heart,
  Wind,
  Gauge,
  AlertTriangle,
  RefreshCw,
  Plus,
  Zap,
  Sliders,
  XCircle,
  Flame
} from 'lucide-react';

interface EcmoRun {
  id: number;
  patient_id: number;
  ecmo_type: string;
  cannulation_config: string;
  cannula_size_drainage_fr: number;
  cannula_size_return_fr: number;
  distal_perfusion_cannula_placed: boolean;
  indication_diagnosis: string;
  baseline_pf_ratio?: number | null;
  resp_score?: number | null;
  save_score?: number | null;
  survival_risk_class?: string | null;
  pump_rpm: number;
  blood_flow_lpm: number;
  sweep_gas_lpm: number;
  sweep_fio2_percent: number;
  circuit_status: string;
  cannulated_at: string;
  decannulated_at?: string | null;
}

interface TelemetryRecord {
  preMembranePressure: number;
  postMembranePressure: number;
  venousDrainagePressure: number;
  pfHb: number;
  antiXa: number;
  aptt: number;
  transmembraneDeltaP: number;
  chatterDetected: boolean;
  membraneClotRisk: string;
  hemolysisSeverity: string;
  anticoagulationStatus: string;
  alerts: string[];
}

export const McsHub: React.FC = () => {
  const [runs, setRuns] = useState<EcmoRun[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedRun, setSelectedRun] = useState<EcmoRun | null>(null);
  const [showNewModal, setShowNewModal] = useState<boolean>(false);
  const [showCalcModal, setShowCalcModal] = useState<'none' | 'resp' | 'save'>('none');

  // Form State: New ECMO Run
  const [patientId, setPatientId] = useState<number>(1);
  const [ecmoType, setEcmoType] = useState<string>('VV_ECMO');
  const [cannulationConfig, setCannulationConfig] = useState<string>('Right Internal Jugular 31Fr Avalon Dual-Lumen');
  const [drainageFr, setDrainageFr] = useState<number>(25);
  const [returnFr, setReturnFr] = useState<number>(19);
  const [distalPerfusion, setDistalPerfusion] = useState<boolean>(true);
  const [diagnosis, setDiagnosis] = useState<string>('Severe ARDS secondary to Viral Pneumonia');
  const [initRpm, setInitRpm] = useState<number>(3600);
  const [initFlow, setInitFlow] = useState<number>(4.2);
  const [initSweep, setInitSweep] = useState<number>(3.5);
  const [initFio2, setInitFio2] = useState<number>(100);

  // Form State: Live Telemetry
  const [preMembrane, setPreMembrane] = useState<number>(215);
  const [postMembrane, setPostMembrane] = useState<number>(178);
  const [venousPressure, setVenousPressure] = useState<number>(-48);
  const [pfHb, setPfHb] = useState<number>(16.5);
  const [antiXa, setAntiXa] = useState<number>(0.36);
  const [aptt, setAptt] = useState<number>(66);
  const [telemetryAnalysis, setTelemetryAnalysis] = useState<TelemetryRecord | null>(null);

  // Parameter Adjustment
  const [adjustRpm, setAdjustRpm] = useState<number>(3600);
  const [adjustFlow, setAdjustFlow] = useState<number>(4.2);
  const [adjustSweep, setAdjustSweep] = useState<number>(3.5);
  const [adjustFio2, setAdjustFio2] = useState<number>(100);

  // RESP Calculator State
  const [respAge, setRespAge] = useState<number>(44);
  const [respImmunocompromised, setRespImmunocompromised] = useState<boolean>(false);
  const [respVentHours, setRespVentHours] = useState<number>(32);
  const [respDiag, setRespDiag] = useState<'viral_pneumonia' | 'bacterial_pneumonia' | 'asthma' | 'trauma_burn' | 'other_acute_respiratory'>('viral_pneumonia');
  const [respCns, setRespCns] = useState<boolean>(false);
  const [respBicarb, setRespBicarb] = useState<number>(22);
  const [respPip, setRespPip] = useState<number>(36);
  const [respPfRatio, setRespPfRatio] = useState<number>(68);
  const [respScoreOutput, setRespScoreOutput] = useState<any | null>(null);

  // SAVE Calculator State
  const [saveEtiology, setSaveEtiology] = useState<'myocarditis' | 'refractory_vt_vf' | 'post_cardiotomy' | 'cardiogenic_shock_ami' | 'other'>('cardiogenic_shock_ami');
  const [saveAge, setSaveAge] = useState<number>(58);
  const [saveWeight, setSaveWeight] = useState<number>(78);
  const [saveArf, setSaveArf] = useState<boolean>(false);
  const [saveLiver, setSaveLiver] = useState<boolean>(false);
  const [saveCns, setSaveCns] = useState<boolean>(false);
  const [savePulsePressure, setSavePulsePressure] = useState<number>(24);
  const [saveBicarb, setSaveBicarb] = useState<number>(18);
  const [saveScoreOutput, setSaveScoreOutput] = useState<any | null>(null);

  const fetchRuns = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/clinician/ecmo/runs', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRuns(data);
        if (data.length > 0 && !selectedRun) {
          setSelectedRun(data[0]);
          setAdjustRpm(data[0].pump_rpm);
          setAdjustFlow(data[0].blood_flow_lpm);
          setAdjustSweep(data[0].sweep_gas_lpm);
          setAdjustFio2(data[0].sweep_fio2_percent);
        }
      }
    } catch (err) {
      console.error('Failed to fetch ECMO runs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, []);

  const handleSelectRun = (run: EcmoRun) => {
    setSelectedRun(run);
    setAdjustRpm(run.pump_rpm);
    setAdjustFlow(run.blood_flow_lpm);
    setAdjustSweep(run.sweep_gas_lpm);
    setAdjustFio2(run.sweep_fio2_percent);
    setTelemetryAnalysis(null);
  };

  const handleCalculateResp = async () => {
    try {
      const res = await fetch('/api/clinician/ecmo/evaluate-resp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          age: respAge,
          immunocompromised: respImmunocompromised,
          hoursVentilatedPriorToEcmo: respVentHours,
          diagnosis: respDiag,
          cnsDysfunction: respCns,
          nonPulmonaryInfection: false,
          bicarbonateMeqL: respBicarb,
          pipCmH2o: respPip,
          pao2Fio2Ratio: respPfRatio
        })
      });
      if (res.ok) {
        const data = await res.json();
        setRespScoreOutput(data);
      }
    } catch (err) {
      console.error('Evaluate RESP error:', err);
    }
  };

  const handleCalculateSave = async () => {
    try {
      const res = await fetch('/api/clinician/ecmo/evaluate-save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          etiology: saveEtiology,
          age: saveAge,
          weightKg: saveWeight,
          acuteRenalFailure: saveArf,
          liverFailure: saveLiver,
          cnsDysfunction: saveCns,
          pulsePressureMmHg: savePulsePressure,
          bicarbonateMeqL: saveBicarb
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSaveScoreOutput(data);
      }
    } catch (err) {
      console.error('Evaluate SAVE error:', err);
    }
  };

  const handleCreateRun = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/clinician/ecmo/runs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          patientId,
          runData: {
            ecmoType,
            cannulationConfig,
            cannulaSizeDrainageFr: drainageFr,
            cannulaSizeReturnFr: returnFr,
            distalPerfusionCannulaPlaced: distalPerfusion,
            indicationDiagnosis: diagnosis,
            pumpRpm: initRpm,
            bloodFlowLpm: initFlow,
            sweepGasLpm: initSweep,
            sweepFio2Percent: initFio2
          }
        })
      });
      if (res.ok) {
        setShowNewModal(false);
        fetchRuns();
      }
    } catch (err) {
      console.error('Initiate ECMO run error:', err);
    }
  };

  const handleRecordTelemetry = async () => {
    if (!selectedRun) return;
    try {
      const res = await fetch(`/api/clinician/ecmo/runs/${selectedRun.id}/telemetry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          preMembranePressureMmHg: preMembrane,
          postMembranePressureMmHg: postMembrane,
          venousDrainagePressureMmHg: venousPressure,
          plasmaFreeHemoglobinMgDl: pfHb,
          antiXaIuMl: antiXa,
          apttSeconds: aptt
        })
      });
      if (res.ok) {
        const data = await res.json();
        setTelemetryAnalysis({
          preMembranePressure: preMembrane,
          postMembranePressure: postMembrane,
          venousDrainagePressure: venousPressure,
          pfHb,
          antiXa,
          aptt,
          transmembraneDeltaP: data.analysis.transmembraneDeltaP,
          chatterDetected: data.analysis.chatterDetected,
          membraneClotRisk: data.analysis.membraneClotRisk,
          hemolysisSeverity: data.analysis.hemolysisSeverity,
          anticoagulationStatus: data.analysis.anticoagulationStatus,
          alerts: data.analysis.alerts
        });
      }
    } catch (err) {
      console.error('Record telemetry error:', err);
    }
  };

  const handleUpdateParameters = async () => {
    if (!selectedRun) return;
    try {
      const res = await fetch(`/api/clinician/ecmo/runs/${selectedRun.id}/parameters`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          pumpRpm: adjustRpm,
          bloodFlowLpm: adjustFlow,
          sweepGasLpm: adjustSweep,
          sweepFio2Percent: adjustFio2
        })
      });
      if (res.ok) {
        fetchRuns();
      }
    } catch (err) {
      console.error('Adjust parameters error:', err);
    }
  };

  const handleDecannulate = async (outcome: string) => {
    if (!selectedRun) return;
    try {
      const res = await fetch(`/api/clinician/ecmo/runs/${selectedRun.id}/decannulate`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ outcome })
      });
      if (res.ok) {
        fetchRuns();
      }
    } catch (err) {
      console.error('Decannulate error:', err);
    }
  };

  const deltaP = preMembrane - postMembrane;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-cyan-900 to-slate-900 text-white rounded-xl p-6 shadow-lg border border-teal-700/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-500/20 rounded-lg border border-teal-400/40">
              <Activity className="h-7 w-7 text-teal-300 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">MCS Hub & ECMO Command Fleet</h1>
              <p className="text-xs text-teal-200/80">
                Phase 54: Extracorporeal Membrane Oxygenation, ΔP Transmembrane Clot Watchdog & Mechanical Circulatory Fleet
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowCalcModal('resp')}
            className="px-3 py-2 bg-teal-800/60 hover:bg-teal-700 text-teal-200 border border-teal-600/50 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Wind className="h-4 w-4 text-teal-300" />
            RESP Score (VV)
          </button>
          <button
            onClick={() => setShowCalcModal('save')}
            className="px-3 py-2 bg-cyan-800/60 hover:bg-cyan-700 text-cyan-200 border border-cyan-600/50 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Heart className="h-4 w-4 text-rose-300" />
            SAVE Score (VA)
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 shadow transition"
          >
            <Plus className="h-4 w-4" />
            Initiate ECMO Circuit
          </button>
          <button
            onClick={fetchRuns}
            disabled={loading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-teal-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Grid: Runs List & Detailed Telemetry Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Runs List Sidebar */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Active Circuits & Runs</h2>
            <span className="text-xs bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full font-mono">
              {runs.length} Runs
            </span>
          </div>

          <div className="space-y-2 max-h-[680px] overflow-y-auto pr-1">
            {runs.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-slate-300 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
                No active ECMO runs logged.
              </div>
            ) : (
              runs.map((run) => {
                const isSelected = selectedRun?.id === run.id;
                const isActive = run.circuit_status === 'active_run';
                return (
                  <div
                    key={run.id}
                    onClick={() => handleSelectRun(run)}
                    className={`p-4 rounded-xl border cursor-pointer transition ${
                      isSelected
                        ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/20 shadow-sm ring-1 ring-teal-500/50'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-xs font-mono font-bold rounded ${
                          run.ecmo_type.startsWith('VA')
                            ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800'
                            : 'bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 border border-teal-300 dark:border-teal-800'
                        }`}>
                          {run.ecmo_type}
                        </span>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          Pt #{run.patient_id}
                        </span>
                      </div>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                        isActive
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 animate-pulse'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}>
                        {run.circuit_status}
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 line-clamp-1">
                      {run.indication_diagnosis}
                    </p>

                    <div className="mt-3 flex items-center justify-between text-xs font-mono text-slate-500 border-t border-slate-100 dark:border-slate-800/80 pt-2">
                      <span>Flow: {run.blood_flow_lpm} L/m</span>
                      <span>RPM: {run.pump_rpm}</span>
                      <span>Sweep: {run.sweep_gas_lpm} L</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Run Circuit Cockpit */}
        <div className="lg:col-span-8 space-y-6">
          {selectedRun ? (
            <>
              {/* Circuit HUD Panel */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        Run #{selectedRun.id}: {selectedRun.ecmo_type} Support Circuit
                      </h3>
                      <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500 font-mono">
                        Cannulated: {new Date(selectedRun.cannulated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Config: {selectedRun.cannulation_config} (Drainage: {selectedRun.cannula_size_drainage_fr}Fr | Return: {selectedRun.cannula_size_return_fr}Fr)
                    </p>
                  </div>

                  {selectedRun.circuit_status === 'active_run' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDecannulate('weaned_recovered')}
                        className="px-2.5 py-1 text-xs bg-emerald-100 dark:bg-emerald-950/50 hover:bg-emerald-200 text-emerald-800 dark:text-emerald-300 font-semibold rounded border border-emerald-300 dark:border-emerald-700 transition"
                      >
                        Weaned & Recovered
                      </button>
                      <button
                        onClick={() => handleDecannulate('transitioned_lvad_or_transplant')}
                        className="px-2.5 py-1 text-xs bg-blue-100 dark:bg-blue-950/50 hover:bg-blue-200 text-blue-800 dark:text-blue-300 font-semibold rounded border border-blue-300 dark:border-blue-700 transition"
                      >
                        LVAD / OHT Bridge
                      </button>
                    </div>
                  )}
                </div>

                {/* 4 Metric Gauges */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Blood Flow</span>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-2xl font-black font-mono text-teal-600 dark:text-teal-400">
                        {selectedRun.blood_flow_lpm.toFixed(2)}
                      </span>
                      <span className="text-xs text-slate-500">L/min</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">Cardiac Index ~2.4 L/m²</span>
                  </div>

                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Pump Head Speed</span>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
                        {selectedRun.pump_rpm}
                      </span>
                      <span className="text-xs text-slate-500">RPM</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">Centrifugal Mag-Lev</span>
                  </div>

                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Sweep Gas Flow</span>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-2xl font-black font-mono text-cyan-600 dark:text-cyan-400">
                        {selectedRun.sweep_gas_lpm.toFixed(1)}
                      </span>
                      <span className="text-xs text-slate-500">L/min</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">FiO₂: {selectedRun.sweep_fio2_percent}%</span>
                  </div>

                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Transmembrane ΔP</span>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className={`text-2xl font-black font-mono ${
                        deltaP >= 55
                          ? 'text-rose-600 dark:text-rose-400 animate-pulse'
                          : deltaP >= 40
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {deltaP}
                      </span>
                      <span className="text-xs text-slate-500">mmHg</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">Target &lt; 40 mmHg</span>
                  </div>
                </div>

                {/* Real-time Telemetry & Pressure Watchdog Console */}
                <div className="p-4 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sliders className="h-4 w-4 text-teal-400" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                        Circuit Pressure Watchdog & Biomarker Telemetry
                      </h4>
                    </div>
                    <button
                      onClick={handleRecordTelemetry}
                      className="px-3 py-1 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded transition flex items-center gap-1"
                    >
                      <Zap className="h-3.5 w-3.5" />
                      Sample & Audit Telemetry
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-xs">
                    <div>
                      <label className="text-slate-400 text-[10px] block mb-1">Pre-Membrane (mmHg)</label>
                      <input
                        type="number"
                        value={preMembrane}
                        onChange={(e) => setPreMembrane(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 font-mono text-slate-200 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 text-[10px] block mb-1">Post-Membrane (mmHg)</label>
                      <input
                        type="number"
                        value={postMembrane}
                        onChange={(e) => setPostMembrane(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 font-mono text-slate-200 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 text-[10px] block mb-1">Venous Drainage (mmHg)</label>
                      <input
                        type="number"
                        value={venousPressure}
                        onChange={(e) => setVenousPressure(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 font-mono text-slate-200 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 text-[10px] block mb-1">pfHb (mg/dL)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={pfHb}
                        onChange={(e) => setPfHb(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 font-mono text-slate-200 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 text-[10px] block mb-1">Anti-Xa (IU/mL)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={antiXa}
                        onChange={(e) => setAntiXa(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 font-mono text-slate-200 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 text-[10px] block mb-1">aPTT (seconds)</label>
                      <input
                        type="number"
                        value={aptt}
                        onChange={(e) => setAptt(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 font-mono text-slate-200 text-xs"
                      />
                    </div>
                  </div>

                  {/* Telemetry Analysis Output */}
                  {telemetryAnalysis && (
                    <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800 space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className={`px-2 py-0.5 rounded font-mono font-bold ${
                          telemetryAnalysis.membraneClotRisk === 'critical_failure'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50'
                            : telemetryAnalysis.membraneClotRisk === 'moderate_thrombus'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                        }`}>
                          ΔP Clot: {telemetryAnalysis.membraneClotRisk} ({telemetryAnalysis.transmembraneDeltaP} mmHg)
                        </span>

                        <span className={`px-2 py-0.5 rounded font-mono font-bold ${
                          telemetryAnalysis.chatterDetected
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 animate-bounce'
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          Chatter: {telemetryAnalysis.chatterDetected ? 'Suckdown Active!' : 'Laminar Flow'}
                        </span>

                        <span className={`px-2 py-0.5 rounded font-mono font-bold ${
                          telemetryAnalysis.hemolysisSeverity === 'severe_pump_head_shear'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50'
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          Hemolysis: {telemetryAnalysis.hemolysisSeverity}
                        </span>

                        <span className={`px-2 py-0.5 rounded font-mono font-bold ${
                          telemetryAnalysis.anticoagulationStatus === 'therapeutic'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          Heparin: {telemetryAnalysis.anticoagulationStatus}
                        </span>
                      </div>

                      {telemetryAnalysis.alerts.length > 0 && (
                        <div className="space-y-1 pt-1">
                          {telemetryAnalysis.alerts.map((alert, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 text-xs text-rose-300">
                              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-rose-400" />
                              <span>{alert}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Sweep Gas & RPM Quick Titration Toolbar */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Gauge className="h-4 w-4 text-cyan-500" />
                      Circuit Parameter Titration
                    </h4>
                    <button
                      onClick={handleUpdateParameters}
                      className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs rounded transition"
                    >
                      Apply Titration Changes
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div>
                      <label className="text-slate-500 block mb-1 font-medium">Target RPM</label>
                      <input
                        type="number"
                        step="50"
                        value={adjustRpm}
                        onChange={(e) => setAdjustRpm(Number(e.target.value))}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block mb-1 font-medium">Target Flow (L/min)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={adjustFlow}
                        onChange={(e) => setAdjustFlow(Number(e.target.value))}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block mb-1 font-medium">Sweep Gas (L/min)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={adjustSweep}
                        onChange={(e) => setAdjustSweep(Number(e.target.value))}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block mb-1 font-medium">Sweep FiO₂ (%)</label>
                      <input
                        type="number"
                        step="5"
                        min="21"
                        max="100"
                        value={adjustFio2}
                        onChange={(e) => setAdjustFio2(Number(e.target.value))}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-sm">
              Select an ECMO run from the left or initiate a new circuit.
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Initiate New ECMO Run */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Flame className="h-5 w-5 text-teal-500" />
                Initiate Extracorporeal Life Support
              </h3>
              <button onClick={() => setShowNewModal(false)} className="text-slate-400 hover:text-slate-200">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRun} className="space-y-3 text-xs">
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
                  <label className="block text-slate-500 font-semibold mb-1">ECMO Support Modality</label>
                  <select
                    value={ecmoType}
                    onChange={(e) => setEcmoType(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-semibold"
                  >
                    <option value="VV_ECMO">VV-ECMO (Severe ARDS / Lung Rest)</option>
                    <option value="VA_ECMO">VA-ECMO (Cardiogenic Shock)</option>
                    <option value="ECPR">ECPR (Extracorporeal CPR)</option>
                    <option value="Impella_CP">Impella CP (LV Venting)</option>
                    <option value="ECPELLA">ECPELLA (VA-ECMO + Impella)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Cannulation Configuration</label>
                <input
                  type="text"
                  value={cannulationConfig}
                  onChange={(e) => setCannulationConfig(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Drainage Cannula (Fr)</label>
                  <input
                    type="number"
                    value={drainageFr}
                    onChange={(e) => setDrainageFr(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Return Cannula (Fr)</label>
                  <input
                    type="number"
                    value={returnFr}
                    onChange={(e) => setReturnFr(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Distal Perfusion (7Fr)</label>
                  <select
                    value={distalPerfusion ? 'yes' : 'no'}
                    onChange={(e) => setDistalPerfusion(e.target.value === 'yes')}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs"
                  >
                    <option value="yes">Placed (Prevent Limb Ischemia)</option>
                    <option value="no">Not Placed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Indication / Etiology</label>
                <input
                  type="text"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-4 gap-3 pt-2">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Start RPM</label>
                  <input
                    type="number"
                    value={initRpm}
                    onChange={(e) => setInitRpm(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Flow (L/m)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={initFlow}
                    onChange={(e) => setInitFlow(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Sweep (L/m)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={initSweep}
                    onChange={(e) => setInitSweep(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Sweep FiO₂</label>
                  <input
                    type="number"
                    value={initFio2}
                    onChange={(e) => setInitFio2(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-mono"
                  />
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
                  className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded text-xs shadow"
                >
                  Initiate Circuit Run
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESP Score Calculator */}
      {showCalcModal === 'resp' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Wind className="h-5 w-5 text-teal-500" />
                RESP Score Calculator (VV-ECMO Survival)
              </h3>
              <button onClick={() => setShowCalcModal('none')} className="text-slate-400 hover:text-slate-200">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Age (Years)</label>
                  <input
                    type="number"
                    value={respAge}
                    onChange={(e) => setRespAge(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Vent Duration Prior (Hours)</label>
                  <input
                    type="number"
                    value={respVentHours}
                    onChange={(e) => setRespVentHours(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Primary Diagnosis</label>
                <select
                  value={respDiag}
                  onChange={(e: any) => setRespDiag(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-semibold"
                >
                  <option value="viral_pneumonia">Viral Pneumonia (+3 pts)</option>
                  <option value="bacterial_pneumonia">Bacterial Pneumonia (+3 pts)</option>
                  <option value="asthma">Severe Refractory Asthma (+11 pts)</option>
                  <option value="trauma_burn">Trauma / Burn (+3 pts)</option>
                  <option value="other_acute_respiratory">Other Acute Respiratory (+1 pt)</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">HCO₃⁻ (mEq/L)</label>
                  <input
                    type="number"
                    value={respBicarb}
                    onChange={(e) => setRespBicarb(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">PIP (cmH₂O)</label>
                  <input
                    type="number"
                    value={respPip}
                    onChange={(e) => setRespPip(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">PaO₂/FiO₂</label>
                  <input
                    type="number"
                    value={respPfRatio}
                    onChange={(e) => setRespPfRatio(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={respImmunocompromised}
                    onChange={(e) => setRespImmunocompromised(e.target.checked)}
                    className="rounded text-teal-600"
                  />
                  <span>Immunocompromised</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={respCns}
                    onChange={(e) => setRespCns(e.target.checked)}
                    className="rounded text-teal-600"
                  />
                  <span>CNS Dysfunction</span>
                </label>
              </div>

              <button
                type="button"
                onClick={handleCalculateResp}
                className="w-full mt-2 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded text-xs transition"
              >
                Compute RESP Score & Predicted Survival
              </button>

              {respScoreOutput && (
                <div className="p-3 bg-teal-50 dark:bg-teal-950/40 rounded-lg border border-teal-300 dark:border-teal-800 text-teal-900 dark:text-teal-200">
                  <div className="flex items-center justify-between font-bold">
                    <span>RESP Score: {respScoreOutput.score} ({respScoreOutput.riskClass})</span>
                    <span className="text-base text-teal-600 dark:text-teal-400">{respScoreOutput.predictedSurvivalPercent}% Survival</span>
                  </div>
                  <p className="mt-1 text-[11px] text-teal-700 dark:text-teal-300">{respScoreOutput.interpretation}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SAVE Score Calculator */}
      {showCalcModal === 'save' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Heart className="h-5 w-5 text-rose-500" />
                SAVE Score Calculator (VA-ECMO Cardiogenic Shock)
              </h3>
              <button onClick={() => setShowCalcModal('none')} className="text-slate-400 hover:text-slate-200">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Etiology of Shock</label>
                <select
                  value={saveEtiology}
                  onChange={(e: any) => setSaveEtiology(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-semibold"
                >
                  <option value="myocarditis">Acute Myocarditis (+3 pts)</option>
                  <option value="refractory_vt_vf">Refractory VT / VF (+2 pts)</option>
                  <option value="cardiogenic_shock_ami">Cardiogenic Shock secondary to AMI (0 pts)</option>
                  <option value="post_cardiotomy">Post-Cardiotomy Shock (-2 pts)</option>
                  <option value="other">Other Etiology (0 pts)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Age (Years)</label>
                  <input
                    type="number"
                    value={saveAge}
                    onChange={(e) => setSaveAge(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    value={saveWeight}
                    onChange={(e) => setSaveWeight(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Pulse Pressure (mmHg)</label>
                  <input
                    type="number"
                    value={savePulsePressure}
                    onChange={(e) => setSavePulsePressure(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">HCO₃⁻ (mEq/L)</label>
                  <input
                    type="number"
                    value={saveBicarb}
                    onChange={(e) => setSaveBicarb(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveArf}
                    onChange={(e) => setSaveArf(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span>Renal Failure</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveLiver}
                    onChange={(e) => setSaveLiver(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span>Liver Failure</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveCns}
                    onChange={(e) => setSaveCns(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span>CNS Deficit</span>
                </label>
              </div>

              <button
                type="button"
                onClick={handleCalculateSave}
                className="w-full mt-2 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded text-xs transition"
              >
                Compute SAVE Score & Predicted Survival
              </button>

              {saveScoreOutput && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200">
                  <div className="flex items-center justify-between font-bold">
                    <span>SAVE Score: {saveScoreOutput.score} ({saveScoreOutput.riskClass})</span>
                    <span className="text-base text-rose-600 dark:text-rose-400">{saveScoreOutput.predictedSurvivalPercent}% Survival</span>
                  </div>
                  <p className="mt-1 text-[11px] text-rose-700 dark:text-rose-300">{saveScoreOutput.interpretation}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
