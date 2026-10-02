import React, { useState, useEffect } from 'react';
import {
  Droplet,
  Flame,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Plus,
  RefreshCw,
  ShieldAlert,
  ChevronRight,
  XCircle,
  Thermometer,
  Zap,
  Layers
} from 'lucide-react';

interface MtpActivation {
  id: number;
  patient_id: number;
  activation_trigger: string;
  abc_score: number;
  shock_index: number;
  temperature_celsius: number;
  txa_administered: boolean;
  calcium_repleted_grams: number;
  prbc_units_transfused: number;
  ffp_units_transfused: number;
  platelet_units_transfused: number;
  cryo_units_transfused: number;
  current_ratio: string;
  mtp_status: string;
  activated_at: string;
  deactivated_at?: string | null;
}

export const HemoSurgeCommand: React.FC = () => {
  const [activations, setActivations] = useState<MtpActivation[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedMtp, setSelectedMtp] = useState<MtpActivation | null>(null);
  const [showNewModal, setShowNewModal] = useState<boolean>(false);

  // New MTP Modal State
  const [patientId, setPatientId] = useState<number>(1);
  const [trigger, setTrigger] = useState<string>('Trauma_Exsanguinating_Hemorrhage');
  const [penetratingMech, setPenetratingMech] = useState<boolean>(true);
  const [systolicBp, setSystolicBp] = useState<number>(84);
  const [heartRate, setHeartRate] = useState<number>(132);
  const [fastPositive, setFastPositive] = useState<boolean>(true);
  const [tempCelsius, setTempCelsius] = useState<number>(35.6);
  const [txaGiven, setTxaGiven] = useState<boolean>(true);

  // Transfusion Quick Logging State
  const [unitBarcode, setUnitBarcode] = useState<string>('');
  const [componentType, setComponentType] = useState<'PRBC' | 'FFP' | 'Platelets' | 'Cryoprecipitate'>('PRBC');
  const [bloodGroup, setBloodGroup] = useState<string>('O_NEG');
  const [isUncrossed, setIsUncrossed] = useState<boolean>(true);

  // TEG Input State
  const [rTime, setRTime] = useState<number>(11.5);
  const [kTime, setKTime] = useState<number>(3.8);
  const [alphaAngle, setAlphaAngle] = useState<number>(47.0);
  const [maxAmp, setMaxAmp] = useState<number>(43.0);
  const [ly30, setLy30] = useState<number>(4.4);
  const [ionizedCalcium, setIonizedCalcium] = useState<number>(1.06);
  const [tegAnalysis, setTegAnalysis] = useState<any | null>(null);

  const fetchActivations = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/clinician/mtp/activations', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setActivations(data);
        if (data.length > 0 && !selectedMtp) {
          setSelectedMtp(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch MTP activations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivations();
  }, []);

  const handleActivateMtp = async () => {
    try {
      const res = await fetch('/api/clinician/mtp/activations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          patientId,
          activationData: {
            activationTrigger: trigger,
            penetratingMechanism: penetratingMech,
            systolicBp,
            heartRate,
            fastPositive,
            temperatureCelsius: tempCelsius,
            txaAdministered: txaGiven
          }
        })
      });

      if (res.ok) {
        setShowNewModal(false);
        await fetchActivations();
      }
    } catch (err) {
      console.error('Error activating MTP:', err);
    }
  };

  const handleTransfuseUnit = async () => {
    if (!selectedMtp) return;
    const barcode = unitBarcode.trim() || `UNIT-${Date.now().toString().slice(-6)}`;
    try {
      const res = await fetch(`/api/clinician/mtp/activations/${selectedMtp.id}/transfuse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          bloodUnitBarcode: barcode,
          componentType,
          bloodGroupRh: bloodGroup,
          isUncrossed,
          rapidInfuserUsed: true,
          bloodWarmerVerified: true
        })
      });

      if (res.ok) {
        setUnitBarcode('');
        await fetchActivations();
      }
    } catch (err) {
      console.error('Error logging transfusion unit:', err);
    }
  };

  const handleRecordTeg = async () => {
    if (!selectedMtp) return;
    try {
      const res = await fetch(`/api/clinician/mtp/activations/${selectedMtp.id}/teg`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          rTimeMin: rTime,
          kTimeMin: kTime,
          alphaAngleDeg: alphaAngle,
          maximumAmplitudeMm: maxAmp,
          ly30Percent: ly30,
          ionizedCalciumMmolL: ionizedCalcium
        })
      });

      if (res.ok) {
        const data = await res.json();
        setTegAnalysis(data.analysis);
      }
    } catch (err) {
      console.error('Error recording TEG analysis:', err);
    }
  };

  const handleRepleteCalcium = async () => {
    if (!selectedMtp) return;
    try {
      const res = await fetch(`/api/clinician/mtp/activations/${selectedMtp.id}/replete-calcium`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ grams: 1.0 })
      });
      if (res.ok) {
        await fetchActivations();
      }
    } catch (err) {
      console.error('Error repleting calcium:', err);
    }
  };

  const handleDeescalate = async (status: string) => {
    if (!selectedMtp) return;
    try {
      const res = await fetch(`/api/clinician/mtp/activations/${selectedMtp.id}/deescalate`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        await fetchActivations();
      }
    } catch (err) {
      console.error('Error de-escalating MTP:', err);
    }
  };

  // Calculations for display
  const prbc = selectedMtp?.prbc_units_transfused || 0;
  const ffp = selectedMtp?.ffp_units_transfused || 0;
  const plt = selectedMtp?.platelet_units_transfused || 0;
  const cryo = selectedMtp?.cryo_units_transfused || 0;
  const totalCitrateUnits = prbc + ffp;
  const recommendedCalcium = Number((totalCitrateUnits / 4.0).toFixed(1));
  const calciumRepleted = Number(selectedMtp?.calcium_repleted_grams || 0);
  const calciumDeficit = Math.max(0, Number((recommendedCalcium - calciumRepleted).toFixed(1)));
  const dilutionalRisk = prbc >= 4 && ffp / Math.max(1, prbc) < 0.6;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-red-950 border border-rose-800/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-rose-600/20 border border-rose-500/40 rounded-xl text-rose-400 shadow-inner">
              <Droplet className="w-8 h-8 animate-pulse text-rose-500 fill-rose-500/20" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  HEMO-SURGE: Blood Bank & Massive Transfusion Command
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                  PHASE 52
                </span>
              </div>
              <p className="text-sm text-slate-300 mt-1">
                Real-time 1:1:1 balanced resuscitation tracking, TEG/ROTEM viscoelastic coagulation guidance, ABC scoring, and hypocalcemia citrate surveillance.
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
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-900/40 transition"
            >
              <Plus className="w-4 h-4" />
              Activate MTP Protocol
            </button>
          </div>
        </div>

        {/* Resuscitation Standard Badges */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800">
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
            <Flame className="w-6 h-6 text-rose-400" />
            <div>
              <div className="text-xs text-slate-400">Target Transfusion Ratio</div>
              <div className="text-base font-bold text-rose-300">1 PRBC : 1 FFP : 1 PLT</div>
            </div>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
            <Activity className="w-6 h-6 text-amber-400" />
            <div>
              <div className="text-xs text-slate-400">Shock Index Cutoff</div>
              <div className="text-base font-bold text-amber-300">HR / SBP ≥ 1.0 (Critical ≥ 1.3)</div>
            </div>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
            <Zap className="w-6 h-6 text-cyan-400" />
            <div>
              <div className="text-xs text-slate-400">Antifibrinolytic Protocol</div>
              <div className="text-base font-bold text-cyan-300">TXA 1g IV &lt; 3h of Injury</div>
            </div>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-emerald-400" />
            <div>
              <div className="text-xs text-slate-400">Citrate Calcium Sentinel</div>
              <div className="text-base font-bold text-emerald-300">1g CaCl₂ per 4 Blood Units</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active MTP Sessions Column */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-rose-400" />
            Active MTP Activations ({activations.length})
          </h2>

          <div className="space-y-3">
            {activations.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/40 border border-slate-800/80 rounded-xl text-slate-400 text-sm">
                No active MTP sessions. Trigger an emergency activation above.
              </div>
            ) : (
              activations.map((a) => {
                const isSelected = selectedMtp?.id === a.id;
                const isActive = a.mtp_status === 'active_transfusion';
                return (
                  <div
                    key={a.id}
                    onClick={() => {
                      setSelectedMtp(a);
                      setTegAnalysis(null);
                    }}
                    className={`p-4 rounded-xl border cursor-pointer transition ${
                      isSelected
                        ? 'bg-slate-850 border-rose-500/80 shadow-lg shadow-rose-950/20'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                          MTP #{a.id} • Patient #{a.patient_id}
                          {isActive && (
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]">
                          {a.activation_trigger.replace(/_/g, ' ')}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${
                          isActive
                            ? 'text-rose-400 bg-rose-950/60 border-rose-800'
                            : 'text-emerald-400 bg-emerald-950/60 border-emerald-800'
                        }`}
                      >
                        {a.mtp_status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-800/60 grid grid-cols-3 gap-1 text-center text-xs">
                      <div className="bg-slate-950/60 p-1.5 rounded">
                        <span className="text-slate-500 block text-[10px]">PRBC</span>
                        <strong className="text-rose-400 font-bold">{a.prbc_units_transfused}</strong>
                      </div>
                      <div className="bg-slate-950/60 p-1.5 rounded">
                        <span className="text-slate-500 block text-[10px]">FFP</span>
                        <strong className="text-amber-400 font-bold">{a.ffp_units_transfused}</strong>
                      </div>
                      <div className="bg-slate-950/60 p-1.5 rounded">
                        <span className="text-slate-500 block text-[10px]">PLT</span>
                        <strong className="text-cyan-400 font-bold">{a.platelet_units_transfused}</strong>
                      </div>
                    </div>

                    <div className="mt-2 text-xs flex items-center justify-between text-slate-400 bg-slate-950/40 p-1.5 rounded border border-slate-800/60">
                      <span>Resuscitation Ratio:</span>
                      <strong className="text-white font-mono">{a.current_ratio}</strong>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected MTP Detail & Hemostatic Cockpit */}
        <div className="lg:col-span-2 space-y-6">
          {selectedMtp ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
              {/* Header with MTP Status & De-escalation */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-white">
                      Transfusion Cockpit: MTP #{selectedMtp.id}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950/60 text-rose-300 border border-rose-800">
                      ABC {selectedMtp.abc_score}/4 • SI {selectedMtp.shock_index}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Activated:{' '}
                    <span className="text-slate-200">
                      {new Date(selectedMtp.activated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>{' '}
                    • Temperature:{' '}
                    <span className="text-slate-200">{selectedMtp.temperature_celsius}°C</span>{' '}
                    • TXA Bolus:{' '}
                    <span className={selectedMtp.txa_administered ? 'text-emerald-400' : 'text-slate-400'}>
                      {selectedMtp.txa_administered ? 'Given (1g IV)' : 'Not Given'}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Protocol State:</span>
                  <select
                    value={selectedMtp.mtp_status}
                    onChange={(e) => handleDeescalate(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500"
                  >
                    <option value="active_transfusion">Active Transfusion</option>
                    <option value="controlled">Surgical Hemostasis Controlled</option>
                    <option value="de_escalated">De-escalated / Stable</option>
                  </select>
                </div>
              </div>

              {/* 1:1:1 Live Component Resuscitation Grid */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Droplet className="w-4 h-4 text-rose-400" />
                    Balanced 1:1:1 Blood Component Resuscitation
                  </h3>
                  <span className="text-xs font-mono text-slate-300">
                    Ratio: <strong className="text-rose-400">{selectedMtp.current_ratio}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-rose-950/30 border border-rose-900/60 rounded-xl p-3 text-center">
                    <div className="text-xs text-rose-300 font-semibold">Packed RBCs</div>
                    <div className="text-2xl font-black text-rose-400 mt-1">{prbc}</div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Target: 1 unit</span>
                  </div>
                  <div className="bg-amber-950/30 border border-amber-900/60 rounded-xl p-3 text-center">
                    <div className="text-xs text-amber-300 font-semibold">Fresh Frozen Plasma</div>
                    <div className="text-2xl font-black text-amber-400 mt-1">{ffp}</div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Target: 1 unit</span>
                  </div>
                  <div className="bg-cyan-950/30 border border-cyan-900/60 rounded-xl p-3 text-center">
                    <div className="text-xs text-cyan-300 font-semibold">Platelets (Apheresis)</div>
                    <div className="text-2xl font-black text-cyan-400 mt-1">{plt}</div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Target: 1 pack</span>
                  </div>
                  <div className="bg-purple-950/30 border border-purple-900/60 rounded-xl p-3 text-center">
                    <div className="text-xs text-purple-300 font-semibold">Cryoprecipitate</div>
                    <div className="text-2xl font-black text-purple-400 mt-1">{cryo}</div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Fibrinogen support</span>
                  </div>
                </div>

                {dilutionalRisk && (
                  <div className="mt-3 p-3 bg-amber-950/40 border border-amber-800/80 rounded-xl flex items-center gap-3 text-xs text-amber-300">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-400" />
                    <div>
                      <strong>Dilutional Coagulopathy Alert:</strong> FFP and Platelet infusions are lagging behind Packed Red Blood Cells. Rapidly infuse plasma to prevent factor dilution.
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Unit Transfusion Logger */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <Plus className="w-4 h-4 text-rose-400" />
                    Log Infused Blood Product Unit
                  </h4>
                  <span className="text-[11px] text-slate-400">Rapid Level-1 Infuser Active</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Component Type</label>
                    <select
                      value={componentType}
                      onChange={(e) => setComponentType(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                    >
                      <option value="PRBC">PRBC (Red Blood Cells)</option>
                      <option value="FFP">FFP (Fresh Frozen Plasma)</option>
                      <option value="Platelets">Platelets (Apheresis)</option>
                      <option value="Cryoprecipitate">Cryoprecipitate (10pk)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Blood Group &amp; Rh</label>
                    <select
                      value={bloodGroup}
                      onChange={(e) => setBloodGroup(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                    >
                      <option value="O_NEG">O Negative (Universal RBC)</option>
                      <option value="O_POS">O Positive</option>
                      <option value="AB_POS">AB Positive (Universal Plasma)</option>
                      <option value="A_POS">A Positive</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Unit Barcode / DIN</label>
                    <input
                      type="text"
                      placeholder="e.g. W03452600101"
                      value={unitBarcode}
                      onChange={(e) => setUnitBarcode(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={handleTransfuseUnit}
                      className="w-full px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold transition shadow-md shadow-rose-900/40"
                    >
                      Record Infusion
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs pt-1 text-slate-400">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isUncrossed}
                      onChange={(e) => setIsUncrossed(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-rose-500"
                    />
                    Emergency Uncrossed Unit
                  </label>
                  <span className="text-slate-600">•</span>
                  <span className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Inline Fluid Warmer Verified
                  </span>
                </div>
              </div>

              {/* Citrate Toxicity & Calcium Repletion Sentinel */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold text-white">Citrate Toxicity &amp; Calcium Sentinel</h4>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Total Citrate Load:{' '}
                    <strong className="text-slate-200">{totalCitrateUnits} units</strong> • Repleted:{' '}
                    <strong className="text-emerald-400">{calciumRepleted}g CaCl₂</strong> • Deficit:{' '}
                    <strong className={calciumDeficit > 0 ? 'text-amber-400' : 'text-slate-400'}>
                      {calciumDeficit}g CaCl₂
                    </strong>
                  </p>
                </div>

                <button
                  onClick={handleRepleteCalcium}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-md shadow-emerald-900/30 flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Replete 1g CaCl₂ IV
                </button>
              </div>

              {/* Viscoelastic Hemostatic Guidance (TEG / ROTEM) Cockpit */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-sm font-bold text-white">
                      Viscoelastic Coagulation Guidance (TEG Cockpit)
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400">Point-of-Care Whole Blood Assay</span>
                </div>

                {/* TEG Inputs */}
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <label className="text-slate-400 block text-[10px]">R-Time (min)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={rTime}
                      onChange={(e) => setRTime(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-white text-center font-bold"
                    />
                    <span className="text-[9px] text-slate-500 block text-center mt-0.5">5 - 10 min</span>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <label className="text-slate-400 block text-[10px]">K-Time (min)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={kTime}
                      onChange={(e) => setKTime(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-white text-center font-bold"
                    />
                    <span className="text-[9px] text-slate-500 block text-center mt-0.5">1 - 3 min</span>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <label className="text-slate-400 block text-[10px]">Alpha Angle (°)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={alphaAngle}
                      onChange={(e) => setAlphaAngle(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-white text-center font-bold"
                    />
                    <span className="text-[9px] text-slate-500 block text-center mt-0.5">53 - 72°</span>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <label className="text-slate-400 block text-[10px]">Max Amp (mm)</label>
                    <input
                      type="number"
                      step="1"
                      value={maxAmp}
                      onChange={(e) => setMaxAmp(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-white text-center font-bold"
                    />
                    <span className="text-[9px] text-slate-500 block text-center mt-0.5">50 - 70 mm</span>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <label className="text-slate-400 block text-[10px]">LY30 (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={ly30}
                      onChange={(e) => setLy30(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-white text-center font-bold"
                    />
                    <span className="text-[9px] text-slate-500 block text-center mt-0.5">&lt; 3.0%</span>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <label className="text-slate-400 block text-[10px]">Ionized Ca²⁺</label>
                    <input
                      type="number"
                      step="0.02"
                      value={ionizedCalcium}
                      onChange={(e) => setIonizedCalcium(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-white text-center font-bold"
                    />
                    <span className="text-[9px] text-slate-500 block text-center mt-0.5">1.15-1.33</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={handleRecordTeg}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition"
                  >
                    Analyze Viscoelastic Parameters
                  </button>

                  {tegAnalysis && (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-950/60 text-indigo-300 border border-indigo-800">
                      Diagnosis: {tegAnalysis.coagulopathyClassification}
                    </span>
                  )}
                </div>

                {tegAnalysis && (
                  <div className="p-3 bg-slate-900 border border-indigo-900/50 rounded-xl space-y-2 text-xs">
                    <div className="font-semibold text-indigo-300">Targeted Factor Recommendations:</div>
                    {tegAnalysis.recommendations.map((r: string, idx: number) => (
                      <div key={idx} className="text-slate-300 flex items-center gap-2">
                        <ChevronRight className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                        {r}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-2xl text-slate-400">
              Select an MTP activation to view real-time blood bank metrics.
            </div>
          )}
        </div>
      </div>

      {/* New MTP Activation Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Flame className="w-6 h-6 text-rose-500" />
                <h3 className="text-lg font-bold text-white">Emergency MTP Activation</h3>
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
                  <label className="text-slate-300 block mb-1">Trigger / Etiology</label>
                  <select
                    value={trigger}
                    onChange={(e) => setTrigger(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value="Trauma_Exsanguinating_Hemorrhage">Trauma / Exsanguinating Hemorrhage</option>
                    <option value="Obstetric_Massive_PPH">Obstetric Massive PPH</option>
                    <option value="Ruptured_Abdominal_Aortic_Aneurysm">Ruptured AAA</option>
                    <option value="Major_Surgical_Bleeding">Major Intraoperative Bleeding</option>
                  </select>
                </div>
              </div>

              {/* ABC Score Checklist */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <h4 className="font-semibold text-slate-200 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-rose-400" />
                  ABC Score &amp; Hemodynamic Criteria
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">Systolic BP (mmHg)</label>
                    <input
                      type="number"
                      value={systolicBp}
                      onChange={(e) => setSystolicBp(Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Heart Rate (bpm)</label>
                    <input
                      type="number"
                      value={heartRate}
                      onChange={(e) => setHeartRate(Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={penetratingMech}
                      onChange={(e) => setPenetratingMech(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-rose-500"
                    />
                    Penetrating Mechanism (1pt)
                  </label>
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fastPositive}
                      onChange={(e) => setFastPositive(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-rose-500"
                    />
                    FAST Exam Positive (1pt)
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 flex items-center gap-1">
                    <Thermometer className="w-3.5 h-3.5 text-cyan-400" /> Core Temp (°C)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={tempCelsius}
                    onChange={(e) => setTempCelsius(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={txaGiven}
                      onChange={(e) => setTxaGiven(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-rose-500"
                    />
                    Administer TXA 1g IV Immediately
                  </label>
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
                onClick={handleActivateMtp}
                className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-lg shadow-rose-950/40 transition flex items-center gap-1.5"
              >
                Activate MTP Pack 1 <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HemoSurgeCommand;
