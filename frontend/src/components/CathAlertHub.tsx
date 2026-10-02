import React, { useState, useEffect } from 'react';
import {
  Heart,
  Timer,
  Activity,
  Zap,
  Plus,
  RefreshCw,
  ShieldAlert,
  ChevronRight,
  XCircle,
  Gauge,
  Droplets,
  Layers,
  CircleDot
} from 'lucide-react';

interface StemiActivation {
  id: number;
  patient_id: number;
  ekg_pattern_type: string;
  culprit_vessel_presumed: string;
  ed_arrival_time: string;
  cath_lab_activation_time: string;
  sheath_insertion_time?: string | null;
  balloon_inflation_time?: string | null;
  door_to_balloon_minutes?: number | null;
  d2b_target_met?: boolean | null;
  contrast_volume_ml?: number | null;
  mehran_cin_risk_score?: number | null;
  hydration_target_ml_per_hr?: number | null;
  vascular_access_site: string;
  closure_device_used?: string | null;
  closure_time?: string | null;
  bed_rest_duration_hours?: number | null;
  activation_status: string;
  created_at: string;
}

export const CathAlertHub: React.FC = () => {
  const [activations, setActivations] = useState<StemiActivation[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedCase, setSelectedCase] = useState<StemiActivation | null>(null);
  const [showNewModal, setShowNewModal] = useState<boolean>(false);

  // New STEMI Case Form
  const [patientId, setPatientId] = useState<number>(1);
  const [ekgPattern, setEkgPattern] = useState<string>('Classic_STEMI');
  const [leads, setLeads] = useState<string>('V1, V2, V3, V4');
  const [accessSite, setAccessSite] = useState<'Right_Radial' | 'Left_Radial' | 'Right_Femoral' | 'Left_Femoral'>('Right_Radial');
  const [edArrival, setEdArrival] = useState<string>(
    new Date(Date.now() - 45 * 60 * 1000).toISOString().slice(0, 16)
  );
  const [cathActivationTime, setCathActivationTime] = useState<string>(
    new Date(Date.now() - 35 * 60 * 1000).toISOString().slice(0, 16)
  );

  // Interventional PCI Logging State
  const [lesionLocation, setLesionLocation] = useState<string>('Proximal_LAD_95%_Stenosis');
  const [preTimi, setPreTimi] = useState<number>(0);
  const [postTimi, setPostTimi] = useState<number>(3);
  const [stentType, setStentType] = useState<string>('DES_Everolimus');
  const [stentDiam, setStentDiam] = useState<number>(3.5);
  const [stentLen, setStentLen] = useState<number>(24.0);
  const [actSeconds, setActSeconds] = useState<number>(280);

  // CIN Nephropathy Risk State
  const [age, setAge] = useState<number>(72);
  const [hasDiabetes, setHasDiabetes] = useState<boolean>(true);
  const [hasChf, setHasChf] = useState<boolean>(true);
  const [hasHypotension, setHasHypotension] = useState<boolean>(false);
  const [baselineEgfr, setBaselineEgfr] = useState<number>(42);
  const [contrastMl, setContrastMl] = useState<number>(180);
  const [patientWeightKg, setPatientWeightKg] = useState<number>(78);
  const [cinResult, setCinResult] = useState<any | null>(null);

  // Closure device state
  const [closureDevice, setClosureDevice] = useState<string>('Angio-Seal_8F');

  const fetchActivations = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/clinician/stemi/activations', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setActivations(data);
        if (data.length > 0 && !selectedCase) {
          setSelectedCase(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch STEMI activations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivations();
  }, []);

  const handleCreateCase = async () => {
    try {
      const res = await fetch('/api/clinician/stemi/activations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          patientId,
          activationData: {
            ekgPattern: {
              patternType: ekgPattern,
              leadsWithElevation: leads.split(',').map((l) => l.trim())
            },
            edArrivalTime: edArrival,
            cathLabActivationTime: cathActivationTime,
            vascularAccessSite: accessSite
          }
        })
      });

      if (res.ok) {
        setShowNewModal(false);
        await fetchActivations();
      }
    } catch (err) {
      console.error('Error creating STEMI case:', err);
    }
  };

  const handleBalloonInflation = async () => {
    if (!selectedCase) return;
    try {
      const res = await fetch(`/api/clinician/stemi/activations/${selectedCase.id}/balloon-inflation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          balloonInflationTime: new Date().toISOString()
        })
      });

      if (res.ok) {
        await fetchActivations();
      }
    } catch (err) {
      console.error('Error recording balloon inflation:', err);
    }
  };

  const handleRecordPci = async () => {
    if (!selectedCase) return;
    try {
      const res = await fetch(`/api/clinician/stemi/activations/${selectedCase.id}/pci-log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          lesionLocation,
          prePciTimiFlow: preTimi,
          postPciTimiFlow: postTimi,
          stentType,
          stentDiameterMm: stentDiam,
          stentLengthMm: stentLen,
          anticoagulantAgent: 'Unfractionated_Heparin',
          peakActSeconds: actSeconds
        })
      });

      if (res.ok) {
        await fetchActivations();
      }
    } catch (err) {
      console.error('Error recording PCI log:', err);
    }
  };

  const handleEvaluateCin = async () => {
    if (!selectedCase) return;
    try {
      const res = await fetch(`/api/clinician/stemi/activations/${selectedCase.id}/cin-risk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          age,
          diabetes: hasDiabetes,
          congestiveHeartFailure: hasChf,
          hypotensionOrShock: hasHypotension,
          baselineEgfr,
          contrastVolumeMl: contrastMl,
          patientWeightKg
        })
      });

      if (res.ok) {
        const data = await res.json();
        setCinResult(data.cinAnalysis);
        await fetchActivations();
      }
    } catch (err) {
      console.error('Error evaluating CIN risk:', err);
    }
  };

  const handleUpdateClosure = async () => {
    if (!selectedCase) return;
    try {
      const res = await fetch(`/api/clinician/stemi/activations/${selectedCase.id}/closure`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          closureDeviceUsed: closureDevice,
          closureTime: new Date().toISOString()
        })
      });

      if (res.ok) {
        await fetchActivations();
      }
    } catch (err) {
      console.error('Error updating closure device:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-red-950 via-slate-900 to-amber-950 border border-red-800/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-red-600/20 border border-red-500/40 rounded-xl text-red-400 shadow-inner">
              <Heart className="w-8 h-8 animate-pulse text-red-500 fill-red-500/20" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  CATH-ALERT: Cath Lab &amp; STEMI Door-to-Balloon Command
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse">
                  PHASE 53
                </span>
              </div>
              <p className="text-sm text-slate-300 mt-1">
                AHA/ACC statutory Door-to-Balloon countdowns, Smith-Modified Sgarbossa &amp; Wellens OMI recognition, Mehran 2.0 CIN nephropathy risk, and vascular closure dwell tracking.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchActivations()}
              disabled={loading}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Sync
            </button>
            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-lg shadow-red-900/30 transition"
            >
              <Plus className="w-4 h-4" />
              Activate STEMI Code
            </button>
          </div>
        </div>

        {/* Clinical Milestones Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800">
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
            <Timer className="w-6 h-6 text-amber-400" />
            <div>
              <div className="text-xs text-slate-400">Door-to-Balloon Target</div>
              <div className="text-base font-bold text-amber-300">≤ 90 Minutes (Goal &lt;60)</div>
            </div>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
            <Activity className="w-6 h-6 text-red-400" />
            <div>
              <div className="text-xs text-slate-400">Preferred Access Route</div>
              <div className="text-base font-bold text-red-300">Right Radial (AHA Class I)</div>
            </div>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
            <Gauge className="w-6 h-6 text-cyan-400" />
            <div>
              <div className="text-xs text-slate-400">Target Heparin ACT</div>
              <div className="text-base font-bold text-cyan-300">250 – 300 Seconds</div>
            </div>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
            <Droplets className="w-6 h-6 text-emerald-400" />
            <div>
              <div className="text-xs text-slate-400">CIN Renal Hydration</div>
              <div className="text-base font-bold text-emerald-300">1.0 mL/kg/h Post-PCI</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cases Column */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-red-400" />
            Active STEMI Activations ({activations.length})
          </h2>

          <div className="space-y-3">
            {activations.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/40 border border-slate-800/80 rounded-xl text-slate-400 text-sm">
                No active STEMI cases. Activate an emergency code above.
              </div>
            ) : (
              activations.map((a) => {
                const isSelected = selectedCase?.id === a.id;
                const isReperfused = a.activation_status === 'reperfusion_achieved';
                return (
                  <div
                    key={a.id}
                    onClick={() => {
                      setSelectedCase(a);
                      setCinResult(null);
                    }}
                    className={`p-4 rounded-xl border cursor-pointer transition ${
                      isSelected
                        ? 'bg-slate-850 border-red-500/80 shadow-lg shadow-red-950/20'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                          STEMI #{a.id} • Patient #{a.patient_id}
                          {isReperfused && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800 rounded">
                              REPERFUSED
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {a.ekg_pattern_type.replace(/_/g, ' ')} • Culprit: {a.culprit_vessel_presumed}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-950/60 text-red-300 border border-red-800">
                        {a.vascular_access_site.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-slate-500">Door-to-Balloon: </span>
                        <span
                          className={`font-bold ${
                            a.d2b_target_met ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {a.door_to_balloon_minutes ? `${a.door_to_balloon_minutes} min` : 'In Progress'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">CIN Score: </span>
                        <span className="text-slate-300 font-semibold">{a.mehran_cin_risk_score ?? 'Pending'}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Case Detail Cockpit */}
        <div className="lg:col-span-2 space-y-6">
          {selectedCase ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
              {/* Header with Case Info */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-white">
                      PCI Interventional Fleet: Case #{selectedCase.id}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-950/60 text-red-300 border border-red-800">
                      Culprit: {selectedCase.culprit_vessel_presumed}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    ED Arrival:{' '}
                    <span className="text-slate-200">
                      {new Date(selectedCase.ed_arrival_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>{' '}
                    • Cath Activated:{' '}
                    <span className="text-slate-200">
                      {new Date(selectedCase.cath_lab_activation_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>{' '}
                    • Route:{' '}
                    <span className="text-slate-200">{selectedCase.vascular_access_site.replace(/_/g, ' ')}</span>
                  </p>
                </div>

                {!selectedCase.balloon_inflation_time && (
                  <button
                    onClick={handleBalloonInflation}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/40 transition flex items-center gap-2"
                  >
                    <Zap className="w-4 h-4" />
                    Log Balloon Inflation / Wire Cross
                  </button>
                )}
              </div>

              {/* Statutory D2B Countdown & Status */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-slate-400">Statutory Door-to-Balloon Metric:</div>
                  <div className="text-2xl font-black text-white mt-1">
                    {selectedCase.door_to_balloon_minutes ? (
                      <span className={selectedCase.d2b_target_met ? 'text-emerald-400' : 'text-rose-400'}>
                        {selectedCase.door_to_balloon_minutes} Minutes ({selectedCase.d2b_target_met ? 'Goal ≤90m Achieved' : 'Delayed'})
                      </span>
                    ) : (
                      <span className="text-amber-400 animate-pulse">Running In Cath Lab...</span>
                    )}
                  </div>
                </div>

                <div className="text-xs text-right">
                  <span className="text-slate-500 block">Reperfusion Status:</span>
                  <span className="font-semibold text-slate-200 uppercase">
                    {selectedCase.activation_status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              {/* Interventional PCI Stenting Form */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CircleDot className="w-5 h-5 text-red-400" />
                    <h3 className="text-sm font-bold text-white">Culprit Lesion &amp; Drug-Eluting Stent (DES) Log</h3>
                  </div>
                  <span className="text-xs text-slate-400">Target TIMI 3 Flow</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Lesion Location</label>
                    <input
                      type="text"
                      value={lesionLocation}
                      onChange={(e) => setLesionLocation(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">TIMI Flow (Pre / Post)</label>
                    <div className="flex items-center gap-1">
                      <select
                        value={preTimi}
                        onChange={(e) => setPreTimi(Number(e.target.value))}
                        className="w-1/2 bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                      >
                        <option value={0}>0 (No flow)</option>
                        <option value={1}>1 (Faint)</option>
                        <option value={2}>2 (Sluggish)</option>
                      </select>
                      <span className="text-slate-500">→</span>
                      <select
                        value={postTimi}
                        onChange={(e) => setPostTimi(Number(e.target.value))}
                        className="w-1/2 bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                      >
                        <option value={3}>3 (Normal)</option>
                        <option value={2}>2 (Slow)</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Stent Size (Diam × Len)</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.25"
                        value={stentDiam}
                        onChange={(e) => setStentDiam(Number(e.target.value))}
                        className="w-1/2 bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                        placeholder="Diam mm"
                      />
                      <span className="text-slate-500">×</span>
                      <input
                        type="number"
                        step="1"
                        value={stentLen}
                        onChange={(e) => setStentLen(Number(e.target.value))}
                        className="w-1/2 bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                        placeholder="Len mm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Peak ACT (Seconds)</label>
                    <input
                      type="number"
                      value={actSeconds}
                      onChange={(e) => setActSeconds(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>Stent Type:</span>
                    <select
                      value={stentType}
                      onChange={(e) => setStentType(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
                    >
                      <option value="DES_Everolimus">DES Everolimus-Eluting</option>
                      <option value="DES_Zotarolimus">DES Zotarolimus-Eluting</option>
                      <option value="DES_Sirolimus">DES Sirolimus-Eluting</option>
                      <option value="Drug_Eluting_Balloon">Drug-Eluting Balloon (DEB)</option>
                    </select>
                  </div>
                  <button
                    onClick={handleRecordPci}
                    className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition"
                  >
                    Save Interventional Log
                  </button>
                </div>
              </div>

              {/* Mehran 2.0 CIN Nephropathy Risk Calculator */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Droplets className="w-5 h-5 text-cyan-400" />
                    <h3 className="text-sm font-bold text-white">
                      Mehran 2.0 Contrast-Induced Nephropathy (CIN) Sentinel
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400">Weight-Adjusted Hydration Engine</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Age / Weight (kg)</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={age}
                        onChange={(e) => setAge(Number(e.target.value))}
                        className="w-1/2 bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                      />
                      <input
                        type="number"
                        value={patientWeightKg}
                        onChange={(e) => setPatientWeightKg(Number(e.target.value))}
                        className="w-1/2 bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Baseline eGFR</label>
                    <input
                      type="number"
                      value={baselineEgfr}
                      onChange={(e) => setBaselineEgfr(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Contrast Given (mL)</label>
                    <input
                      type="number"
                      value={contrastMl}
                      onChange={(e) => setContrastMl(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                    />
                  </div>
                  <div className="flex flex-col justify-end">
                    <button
                      onClick={handleEvaluateCin}
                      className="w-full px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition"
                    >
                      Calculate CIN Risk
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                  <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasDiabetes}
                      onChange={(e) => setHasDiabetes(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-cyan-500"
                    />
                    Diabetes Mellitus
                  </label>
                  <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasChf}
                      onChange={(e) => setHasChf(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-cyan-500"
                    />
                    CHF / NYHA III-IV
                  </label>
                  <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasHypotension}
                      onChange={(e) => setHasHypotension(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-cyan-500"
                    />
                    Hypotension / Shock
                  </label>
                </div>

                {cinResult && (
                  <div className="p-3.5 bg-slate-900 border border-cyan-800/60 rounded-xl space-y-1 text-xs">
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-cyan-300">
                        Mehran Score: {cinResult.riskScore} ({cinResult.riskTier} Tier)
                      </span>
                      <span className="text-amber-400">
                        Post-PCI AKI Risk: {cinResult.postPciAkiRiskPercent}% • Dialysis: {cinResult.dialysisRiskPercent}%
                      </span>
                    </div>
                    <div className="text-slate-300 pt-1 flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                      <span>{cinResult.hydrationGuideline}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Vascular Access Site & Bed Rest Dwell Timer */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                    <h4 className="text-xs font-bold text-white">Arteriotomy Closure &amp; Bed Rest Dwell</h4>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Closure Device:{' '}
                    <strong className="text-slate-200">{selectedCase.closure_device_used || 'None (In Procedure)'}</strong> • Mandatory Flat Bed Rest:{' '}
                    <strong className="text-amber-300">{selectedCase.bed_rest_duration_hours ?? 2.0} Hours</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={closureDevice}
                    onChange={(e) => setClosureDevice(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  >
                    <option value="Angio-Seal_8F">Angio-Seal 8F (2h Bed Rest)</option>
                    <option value="Perclose_ProGlide">Perclose ProGlide (2h Bed Rest)</option>
                    <option value="TR_Band_Radial">TR Band Radial (1h Air Titration)</option>
                    <option value="Manual_Compression">Manual Compression (6h Strict Bed Rest)</option>
                  </select>
                  <button
                    onClick={handleUpdateClosure}
                    className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs border border-slate-700"
                  >
                    Apply Closure
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-2xl text-slate-400">
              Select a STEMI case to view cath lab telemetry.
            </div>
          )}
        </div>
      </div>

      {/* New STEMI Activation Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Heart className="w-6 h-6 text-red-500" />
                <h3 className="text-lg font-bold text-white">Emergency STEMI / OMI Code Activation</h3>
              </div>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1">Patient ID</label>
                  <input
                    type="number"
                    value={patientId}
                    onChange={(e) => setPatientId(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1">Vascular Access Site</label>
                  <select
                    value={accessSite}
                    onChange={(e) => setAccessSite(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value="Right_Radial">Right Radial (Preferred)</option>
                    <option value="Left_Radial">Left Radial</option>
                    <option value="Right_Femoral">Right Femoral</option>
                    <option value="Left_Femoral">Left Femoral</option>
                  </select>
                </div>
              </div>

              {/* EKG Pattern Recognition */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <h4 className="font-semibold text-slate-200 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-red-400" />
                  ECG Morphology &amp; Occlusion MI Equivalent
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">Pattern Type</label>
                    <select
                      value={ekgPattern}
                      onChange={(e) => setEkgPattern(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white"
                    >
                      <option value="Classic_STEMI">Classic STEMI</option>
                      <option value="Smith_Sgarbossa_LBBB">Smith-Modified Sgarbossa (LBBB/Pacer)</option>
                      <option value="Wellens_Type_B">Wellens Syndrome Type B (Deep Inversions)</option>
                      <option value="Wellens_Type_A">Wellens Syndrome Type A (Biphasic)</option>
                      <option value="de_Winter">de Winter T-Waves</option>
                      <option value="Posterior_STEMI">Isolated Posterior STEMI (V7-V9)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Leads with Injury Current</label>
                    <input
                      type="text"
                      value={leads}
                      onChange={(e) => setLeads(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white"
                      placeholder="e.g. V1, V2, V3, V4"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1">ED Arrival Timestamp</label>
                  <input
                    type="datetime-local"
                    value={edArrival}
                    onChange={(e) => setEdArrival(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1">Cath Lab Activated</label>
                  <input
                    type="datetime-local"
                    value={cathActivationTime}
                    onChange={(e) => setCathActivationTime(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={() => setShowNewModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCase}
                className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-xs shadow-lg shadow-red-950/40 transition flex items-center gap-1.5"
              >
                Page Interventionalist &amp; Launch D2B <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CathAlertHub;
