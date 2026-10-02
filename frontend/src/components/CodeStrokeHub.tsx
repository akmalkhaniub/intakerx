import React, { useState, useEffect } from 'react';
import {
  Brain,
  Timer,
  Activity,
  AlertOctagon,
  CheckCircle2,
  XCircle,
  Plus,
  RefreshCw,
  Zap,
  Clock,
  Crosshair,
  ShieldAlert,
  ChevronRight,
  Layers
} from 'lucide-react';

interface StrokeCodeCase {
  id: number;
  patient_id: number;
  last_known_well: string;
  ed_arrival_time: string;
  ct_completion_time?: string | null;
  nihss_total_score: number;
  nihss_details: any;
  stroke_subtype: string;
  aspects_score?: number | null;
  lvo_detected: boolean;
  lvo_location?: string | null;
  thrombolytic_candidate: boolean;
  thrombolytic_administered: boolean;
  thrombolytic_agent?: string | null;
  door_to_needle_minutes?: number | null;
  dtn_target_met?: boolean | null;
  thrombectomy_candidate: boolean;
  thrombectomy_status: string;
  case_status: string;
  created_at: string;
}

export const CodeStrokeHub: React.FC = () => {
  const [cases, setCases] = useState<StrokeCodeCase[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [showNewModal, setShowNewModal] = useState<boolean>(false);
  const [selectedCase, setSelectedCase] = useState<StrokeCodeCase | null>(null);

  // New Case Form State
  const [patientId, setPatientId] = useState<number>(1);
  const [lkwTime, setLkwTime] = useState<string>(
    new Date(Date.now() - 75 * 60 * 1000).toISOString().slice(0, 16)
  );
  const [edArrival, setEdArrival] = useState<string>(
    new Date(Date.now() - 20 * 60 * 1000).toISOString().slice(0, 16)
  );
  const [strokeSubtype, setStrokeSubtype] = useState<'Ischemic' | 'Hemorrhagic' | 'TIA'>('Ischemic');
  const [aspectsScore, setAspectsScore] = useState<number>(8);
  const [lvoDetected, setLvoDetected] = useState<boolean>(true);
  const [lvoLocation, setLvoLocation] = useState<'ICA' | 'MCA_M1' | 'MCA_M2' | 'Basilar' | 'None'>('MCA_M1');

  // Interactive NIHSS State
  const [nihss, setNihss] = useState({
    loc1a: 0,
    loc1b: 0,
    loc1c: 0,
    bestGaze: 1,
    visualFields: 1,
    facialPalsy: 2,
    motorLeftArm: 0,
    motorRightArm: 3,
    motorLeftLeg: 0,
    motorRightLeg: 2,
    limbAtaxia: 0,
    sensoryLoss: 1,
    bestLanguage: 2,
    dysarthria: 1,
    extinctionInattention: 0
  });

  // Thrombolysis Checklist State
  const [patientWeightKg, setPatientWeightKg] = useState<number>(75);
  const [systolicBp, setSystolicBp] = useState<number>(168);
  const [diastolicBp, setDiastolicBp] = useState<number>(94);
  const [bloodGlucose, setBloodGlucose] = useState<number>(128);
  const [platelets, setPlatelets] = useState<number>(240000);
  const [inr, setInr] = useState<number>(1.05);
  const [onAnticoagulants, setOnAnticoagulants] = useState<boolean>(false);
  const [recentSurgery, setRecentSurgery] = useState<boolean>(false);
  const [activeBleeding, setActiveBleeding] = useState<boolean>(false);
  const [evalResult, setEvalResult] = useState<any | null>(null);

  const fetchCases = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/clinician/stroke/cases', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCases(data);
        if (data.length > 0 && !selectedCase) {
          setSelectedCase(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch stroke cases:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const totalNihssScore =
    nihss.loc1a +
    nihss.loc1b +
    nihss.loc1c +
    nihss.bestGaze +
    nihss.visualFields +
    nihss.facialPalsy +
    nihss.motorLeftArm +
    nihss.motorRightArm +
    nihss.motorLeftLeg +
    nihss.motorRightLeg +
    nihss.limbAtaxia +
    nihss.sensoryLoss +
    nihss.bestLanguage +
    nihss.dysarthria +
    nihss.extinctionInattention;

  const getNihssSeverity = (score: number) => {
    if (score === 0) return { label: 'No Stroke', color: 'text-slate-400 bg-slate-800/60 border-slate-700' };
    if (score <= 4) return { label: 'Minor Stroke', color: 'text-emerald-400 bg-emerald-950/40 border-emerald-800' };
    if (score <= 15) return { label: 'Moderate Stroke', color: 'text-amber-400 bg-amber-950/40 border-amber-800' };
    if (score <= 20) return { label: 'Mod-Severe Stroke', color: 'text-orange-400 bg-orange-950/40 border-orange-800' };
    return { label: 'Severe Stroke', color: 'text-rose-400 bg-rose-950/40 border-rose-800' };
  };

  const handleCreateCase = async () => {
    try {
      const res = await fetch('/api/clinician/stroke/cases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          patientId,
          caseData: {
            lastKnownWell: lkwTime,
            edArrivalTime: edArrival,
            nihssDetails: nihss,
            strokeSubtype,
            aspectsScore,
            lvoDetected,
            lvoLocation,
            thrombolyticCandidate: true,
            thrombectomyCandidate: lvoDetected && aspectsScore >= 6
          }
        })
      });

      if (res.ok) {
        setShowNewModal(false);
        await fetchCases();
      }
    } catch (err) {
      console.error('Error creating stroke case:', err);
    }
  };

  const handleEvaluateThrombolysis = async () => {
    if (!selectedCase) return;
    try {
      const res = await fetch(`/api/clinician/stroke/cases/${selectedCase.id}/thrombolytic-eval`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          patientWeightKg,
          systolicBp,
          diastolicBp,
          bloodGlucoseMgDl: bloodGlucose,
          plateletCount: platelets,
          inr,
          onOralAnticoagulants: onAnticoagulants,
          recentMajorSurgeryOrHeadTrauma: recentSurgery,
          activeInternalBleeding: activeBleeding,
          ctHemorrhagePresent: selectedCase.stroke_subtype === 'Hemorrhagic',
          preferredAgent: 'tenecteplase'
        })
      });

      if (res.ok) {
        const data = await res.json();
        setEvalResult(data.analysis);
        await fetchCases();
      }
    } catch (err) {
      console.error('Error evaluating thrombolysis:', err);
    }
  };

  const handleAdministerThrombolytic = async () => {
    if (!selectedCase) return;
    try {
      const res = await fetch(`/api/clinician/stroke/cases/${selectedCase.id}/administer-thrombolytic`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          administeredAt: new Date().toISOString()
        })
      });

      if (res.ok) {
        await fetchCases();
      }
    } catch (err) {
      console.error('Error administering thrombolytic:', err);
    }
  };

  const handleUpdateThrombectomy = async (status: string) => {
    if (!selectedCase) return;
    try {
      const res = await fetch(`/api/clinician/stroke/cases/${selectedCase.id}/thrombectomy-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        await fetchCases();
      }
    } catch (err) {
      console.error('Error updating thrombectomy status:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-red-950/60 via-slate-900 to-indigo-950/60 border border-red-800/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-red-600/20 border border-red-500/40 rounded-xl text-red-400 shadow-inner">
              <Brain className="w-8 h-8 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  CODE-STROKE Command & Neurovascular Resuscitation Hub
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse">
                  PHASE 51
                </span>
              </div>
              <p className="text-sm text-slate-300 mt-1">
                Real-time NIHSS scoring, Door-to-Needle thrombolytic countdowns, ASPECTS evaluation, and EVT mechanical thrombectomy navigation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchCases()}
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
              Activate Acute Stroke Code
            </button>
          </div>
        </div>

        {/* Quick Statutory Metrics Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800">
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
            <Timer className="w-6 h-6 text-amber-400" />
            <div>
              <div className="text-xs text-slate-400">Target Door-to-Needle</div>
              <div className="text-base font-bold text-amber-300">≤ 45 Minutes</div>
            </div>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
            <Clock className="w-6 h-6 text-emerald-400" />
            <div>
              <div className="text-xs text-slate-400">IV Thrombolytic Window</div>
              <div className="text-base font-bold text-emerald-300">0 – 4.5 Hours</div>
            </div>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
            <Zap className="w-6 h-6 text-cyan-400" />
            <div>
              <div className="text-xs text-slate-400">EVT Thrombectomy Window</div>
              <div className="text-base font-bold text-cyan-300">0 – 24 Hours (DAWN)</div>
            </div>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-purple-400" />
            <div>
              <div className="text-xs text-slate-400">First-Line Fibrinolytic</div>
              <div className="text-base font-bold text-purple-300">Tenecteplase 0.25 mg/kg</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Cases Column */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-red-400" />
              Active Stroke Cases ({cases.length})
            </h2>
          </div>

          <div className="space-y-3">
            {cases.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/40 border border-slate-800/80 rounded-xl text-slate-400 text-sm">
                No active stroke cases logged. Activate a code above.
              </div>
            ) : (
              cases.map((c) => {
                const sev = getNihssSeverity(c.nihss_total_score);
                const isSelected = selectedCase?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      setSelectedCase(c);
                      setEvalResult(null);
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
                          Case #{c.id} • Patient #{c.patient_id}
                          {c.thrombolytic_administered && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800 rounded">
                              IVT GIVEN
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {c.stroke_subtype} • Arrival:{' '}
                          {new Date(c.ed_arrival_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${sev.color}`}>
                        NIHSS {c.nihss_total_score}
                      </span>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-800/60 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500">LVO: </span>
                        <span className={c.lvo_detected ? 'text-rose-400 font-semibold' : 'text-slate-300'}>
                          {c.lvo_detected ? `${c.lvo_location || 'Yes'}` : 'None'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">ASPECTS: </span>
                        <span className="text-slate-300 font-semibold">{c.aspects_score ? `${c.aspects_score}/10` : 'N/A'}</span>
                      </div>
                    </div>

                    {c.door_to_needle_minutes !== null && c.door_to_needle_minutes !== undefined && (
                      <div className="mt-2 text-xs flex items-center justify-between text-slate-300 bg-slate-950/50 p-1.5 rounded border border-slate-800">
                        <span>Door-to-Needle:</span>
                        <span
                          className={`font-bold ${
                            c.dtn_target_met ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {c.door_to_needle_minutes} min ({c.dtn_target_met ? '≤45m Met' : 'Delayed'})
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Case Detail & Clinical Resuscitation Cockpit */}
        <div className="lg:col-span-2 space-y-6">
          {selectedCase ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
              {/* Header with Case Info */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-white">
                      Stroke Code Cockpit: Case #{selectedCase.id}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                      {selectedCase.stroke_subtype}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Last Known Well:{' '}
                    <span className="text-slate-200">
                      {new Date(selectedCase.last_known_well).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>{' '}
                    • ED Arrival:{' '}
                    <span className="text-slate-200">
                      {new Date(selectedCase.ed_arrival_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">EVT Status:</span>
                  <select
                    value={selectedCase.thrombectomy_status}
                    onChange={(e) => handleUpdateThrombectomy(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="not_indicated">Not Indicated</option>
                    <option value="angio_suite_prepped">Angio Suite Prepped</option>
                    <option value="groin_puncture">Groin Puncture Started</option>
                    <option value="tici_2b_recanalization">mTICI 2b Recanalization</option>
                    <option value="tici_3_recanalization">mTICI 3 Full Recanalization</option>
                  </select>
                </div>
              </div>

              {/* NIHSS Breakdown Cards */}
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-indigo-400" />
                  NIH Stroke Scale Breakdown ({selectedCase.nihss_total_score}/42)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                    <div className="text-[11px] text-slate-400">Consciousness (1a-c)</div>
                    <div className="text-base font-bold text-white mt-1">
                      {(selectedCase.nihss_details?.loc1a || 0) +
                        (selectedCase.nihss_details?.loc1b || 0) +
                        (selectedCase.nihss_details?.loc1c || 0)}
                      /7
                    </div>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                    <div className="text-[11px] text-slate-400">Motor Arm R / L</div>
                    <div className="text-base font-bold text-white mt-1">
                      {selectedCase.nihss_details?.motorRightArm || 0} / {selectedCase.nihss_details?.motorLeftArm || 0}
                    </div>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                    <div className="text-[11px] text-slate-400">Language / Speech</div>
                    <div className="text-base font-bold text-white mt-1">
                      Aphasia: {selectedCase.nihss_details?.bestLanguage || 0} | Dys: {selectedCase.nihss_details?.dysarthria || 0}
                    </div>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                    <div className="text-[11px] text-slate-400">ASPECTS / Core</div>
                    <div className="text-base font-bold text-cyan-400 mt-1">
                      {selectedCase.aspects_score ? `${selectedCase.aspects_score}/10` : 'None'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Thrombolysis (Tenecteplase / Alteplase) Checklist & Dosing Engine */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-400" />
                    <h3 className="text-sm font-bold text-white">
                      Intravenous Thrombolysis Safety Sentinel (AHA/ASA Criteria)
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400">
                    Tenecteplase: <strong className="text-amber-300">0.25 mg/kg (Max 25mg)</strong>
                  </span>
                </div>

                {/* Vitals & Labs Inputs for Thrombolysis */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Weight (kg)</label>
                    <input
                      type="number"
                      value={patientWeightKg}
                      onChange={(e) => setPatientWeightKg(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">BP (SBP / DBP)</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={systolicBp}
                        onChange={(e) => setSystolicBp(Number(e.target.value))}
                        className={`w-1/2 bg-slate-900 border rounded-lg px-2 py-1.5 text-white ${
                          systolicBp >= 185 ? 'border-rose-500 text-rose-300' : 'border-slate-700'
                        }`}
                        placeholder="SBP"
                      />
                      <span className="text-slate-500">/</span>
                      <input
                        type="number"
                        value={diastolicBp}
                        onChange={(e) => setDiastolicBp(Number(e.target.value))}
                        className={`w-1/2 bg-slate-900 border rounded-lg px-2 py-1.5 text-white ${
                          diastolicBp >= 110 ? 'border-rose-500 text-rose-300' : 'border-slate-700'
                        }`}
                        placeholder="DBP"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Blood Glucose (mg/dL)</label>
                    <input
                      type="number"
                      value={bloodGlucose}
                      onChange={(e) => setBloodGlucose(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Platelets / INR</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={platelets}
                        onChange={(e) => setPlatelets(Number(e.target.value))}
                        className="w-2/3 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
                        placeholder="Plt"
                      />
                      <input
                        type="number"
                        step="0.05"
                        value={inr}
                        onChange={(e) => setInr(Number(e.target.value))}
                        className="w-1/3 bg-slate-900 border border-slate-700 rounded-lg px-1.5 py-1.5 text-white"
                        placeholder="INR"
                      />
                    </div>
                  </div>
                </div>

                {/* Contraindication Toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-xs">
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={onAnticoagulants}
                      onChange={(e) => setOnAnticoagulants(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-red-500 focus:ring-0"
                    />
                    DOAC / Heparin &lt; 48h
                  </label>
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={recentSurgery}
                      onChange={(e) => setRecentSurgery(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-red-500 focus:ring-0"
                    />
                    Surgery/Trauma &lt; 3 Mo
                  </label>
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeBleeding}
                      onChange={(e) => setActiveBleeding(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-red-500 focus:ring-0"
                    />
                    Active Internal Bleeding
                  </label>
                </div>

                {/* Evaluation Trigger & Result Display */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3">
                  <button
                    onClick={handleEvaluateThrombolysis}
                    className="w-full sm:w-auto px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition"
                  >
                    Run Fibrinolytic Safety Evaluation
                  </button>

                  {evalResult && (
                    <div className="flex items-center gap-3">
                      {evalResult.safetyCleared ? (
                        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-950/60 px-3 py-1.5 rounded-lg border border-emerald-800">
                          <CheckCircle2 className="w-4 h-4" />
                          CLEARED FOR {evalResult.agentRecommended.toUpperCase()} ({evalResult.recommendedDoseMg} mg)
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs font-semibold text-rose-400 bg-rose-950/60 px-3 py-1.5 rounded-lg border border-rose-800">
                          <XCircle className="w-4 h-4" />
                          CONTRAINDICATED ({evalResult.contraindications.length} Warning(s))
                        </div>
                      )}

                      {evalResult.safetyCleared && !selectedCase.thrombolytic_administered && (
                        <button
                          onClick={handleAdministerThrombolytic}
                          className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/40 transition"
                        >
                          1-Click Administer Bolus
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {evalResult && evalResult.contraindications.length > 0 && (
                  <div className="p-3 bg-rose-950/40 border border-rose-900/60 rounded-lg text-xs space-y-1">
                    <div className="font-semibold text-rose-300">Safety Contraindications Identified:</div>
                    {evalResult.contraindications.map((c: string, idx: number) => (
                      <div key={idx} className="text-rose-400 flex items-center gap-1.5">
                        <AlertOctagon className="w-3.5 h-3.5 flex-shrink-0" />
                        {c}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Endovascular Mechanical Thrombectomy (EVT) Card */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Crosshair className="w-5 h-5 text-cyan-400" />
                    <h3 className="text-sm font-bold text-white">
                      Endovascular Thrombectomy (EVT) Gateway
                    </h3>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800">
                    LVO: {selectedCase.lvo_location || 'None'}
                  </span>
                </div>

                <div className="text-xs text-slate-300 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block">ASPECTS Non-Contrast CT:</span>
                    <strong className="text-white text-sm">
                      {selectedCase.aspects_score ? `${selectedCase.aspects_score}/10` : 'Pending'}
                    </strong>
                    <span className="text-[10px] text-slate-400 block mt-0.5">≥ 6 required for EVT</span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block">Current EVT Phase:</span>
                    <strong className="text-cyan-300 text-sm capitalize">
                      {selectedCase.thrombectomy_status.replace(/_/g, ' ')}
                    </strong>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block">Procedure Goal:</span>
                    <strong className="text-emerald-400 text-sm">mTICI 2b / 3</strong>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Complete revascularization</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-2xl text-slate-400">
              Select a stroke case to view detailed resuscitation metrics.
            </div>
          )}
        </div>
      </div>

      {/* New Acute Stroke Code Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Brain className="w-6 h-6 text-red-400" />
                <h3 className="text-lg font-bold text-white">Activate Acute Stroke Code</h3>
              </div>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                  <label className="text-slate-300 block mb-1">Last Known Well (LKW)</label>
                  <input
                    type="datetime-local"
                    value={lkwTime}
                    onChange={(e) => setLkwTime(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1">ED Arrival Time</label>
                  <input
                    type="datetime-local"
                    value={edArrival}
                    onChange={(e) => setEdArrival(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              {/* Subtype & Imaging */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1">Stroke Subtype</label>
                  <select
                    value={strokeSubtype}
                    onChange={(e) => setStrokeSubtype(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value="Ischemic">Ischemic Stroke</option>
                    <option value="Hemorrhagic">Intracerebral Hemorrhage</option>
                    <option value="TIA">Transient Ischemic Attack</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 block mb-1">ASPECTS Score (0-10)</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={aspectsScore}
                    onChange={(e) => setAspectsScore(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1">LVO Location (CTA)</label>
                  <select
                    value={lvoLocation}
                    onChange={(e) => {
                      const loc = e.target.value as any;
                      setLvoLocation(loc);
                      setLvoDetected(loc !== 'None');
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value="MCA_M1">MCA M1 Segment</option>
                    <option value="ICA">Internal Carotid Artery (ICA)</option>
                    <option value="MCA_M2">MCA M2 Branch</option>
                    <option value="Basilar">Basilar Artery</option>
                    <option value="None">None (No LVO)</option>
                  </select>
                </div>
              </div>

              {/* Fast NIHSS Selector */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-slate-200 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    Quick NIHSS Assessment
                  </h4>
                  <span className="text-amber-400 font-bold">Total: {totalNihssScore}/42</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">Motor Arm Drift (R)</label>
                    <select
                      value={nihss.motorRightArm}
                      onChange={(e) => setNihss({ ...nihss, motorRightArm: Number(e.target.value) })}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white"
                    >
                      <option value={0}>0: No drift</option>
                      <option value={1}>1: Drift before 10s</option>
                      <option value={2}>2: Some effort</option>
                      <option value={3}>3: No effort vs gravity</option>
                      <option value={4}>4: No movement</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Aphasia / Language</label>
                    <select
                      value={nihss.bestLanguage}
                      onChange={(e) => setNihss({ ...nihss, bestLanguage: Number(e.target.value) })}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white"
                    >
                      <option value={0}>0: Normal</option>
                      <option value={1}>1: Mild-mod aphasia</option>
                      <option value={2}>2: Severe aphasia</option>
                      <option value={3}>3: Mute / Global</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Facial Palsy</label>
                    <select
                      value={nihss.facialPalsy}
                      onChange={(e) => setNihss({ ...nihss, facialPalsy: Number(e.target.value) })}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white"
                    >
                      <option value={0}>0: Normal</option>
                      <option value={1}>1: Minor paralysis</option>
                      <option value={2}>2: Partial paralysis</option>
                      <option value={3}>3: Complete paralysis</option>
                    </select>
                  </div>
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
                Launch Code Case <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CodeStrokeHub;
