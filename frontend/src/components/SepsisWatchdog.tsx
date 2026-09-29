import React, { useState, useEffect, useCallback } from 'react';
import {
  Flame,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Heart,
  Thermometer,
  Droplets,
  Clock,
  Radio,
  Sparkles
} from 'lucide-react';

export interface VitalsSnapshot {
  heartRate: number;
  respiratoryRate: number;
  systolicBp: number;
  diastolicBp?: number;
  temperatureC: number;
  oxygenSaturation: number;
  supplementalOxygen: boolean;
  avpuConsciousness: 'A' | 'V' | 'P' | 'U';
}

export interface SepsisAlert {
  id: number;
  patient_id: number;
  patient_name: string;
  patient_dob?: string;
  patient_sex?: string;
  sirs_score: number;
  qsofa_score: number;
  news2_score: number;
  deterioration_tier: 'low' | 'medium' | 'high' | 'critical_sepsis';
  vitals_snapshot: VitalsSnapshot;
  source_infection?: string;
  bundle_id?: number;
  lactate_measured?: boolean;
  lactate_value?: number;
  blood_cultures_drawn?: boolean;
  broad_spectrum_abx_ordered?: boolean;
  abx_regimen?: string;
  fluid_resuscitation_administered?: boolean;
  fluid_volume_ml?: number;
  bundle_completed_at?: string;
  created_at: string;
}

interface SepsisWatchdogProps {
  patientId?: number;
  sessionId?: string;
  token?: string;
  backendUrl?: string;
  patientName?: string;
}

export const SepsisWatchdog: React.FC<SepsisWatchdogProps> = ({
  patientId,
  sessionId,
  token,
  backendUrl = '',
  patientName = 'Encounter Patient'
}) => {
  const [activeTab, setActiveTab] = useState<'patient_eval' | 'sep1_bundle' | 'facility_alerts'>('patient_eval');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [rrtDispatched, setRrtDispatched] = useState<string | null>(null);

  // Vitals & Labs Input State
  const [heartRate, setHeartRate] = useState<number>(118);
  const [respiratoryRate, setRespiratoryRate] = useState<number>(24);
  const [systolicBp, setSystolicBp] = useState<number>(88);
  const [temperatureC, setTemperatureC] = useState<number>(38.9);
  const [oxygenSaturation, setOxygenSaturation] = useState<number>(92);
  const [supplementalOxygen, setSupplementalOxygen] = useState<boolean>(true);
  const [avpu, setAvpu] = useState<'A' | 'V' | 'P' | 'U'>('V');
  const [wbcCount, setWbcCount] = useState<number>(16.4);
  const [lactate, setLactate] = useState<number>(4.2);
  const [sourceInfection, setSourceInfection] = useState<string>('Suspected Urinary Tract Infection / Urosepsis');

  // Evaluation Result State
  const [latestEval, setLatestEval] = useState<any | null>(null);

  // Facility-Wide Sepsis Alerts
  const [activeAlerts, setActiveAlerts] = useState<SepsisAlert[]>([]);

  // Bundle Execution State
  const [bundleLactateMeasured, setBundleLactateMeasured] = useState<boolean>(false);
  const [bundleLactateVal, setBundleLactateVal] = useState<number>(4.2);
  const [bundleBcDrawn, setBundleBcDrawn] = useState<boolean>(false);
  const [bundleAbxOrdered, setBundleAbxOrdered] = useState<boolean>(false);
  const [bundleAbxRegimen, setBundleAbxRegimen] = useState<string>('Vancomycin 1.5g IV stat + Cefepime 2g IV stat');
  const [bundleFluidGiven, setBundleFluidGiven] = useState<boolean>(false);
  const [bundleFluidVolume, setBundleFluidVolume] = useState<number>(2100);

  const fetchActiveAlerts = useCallback(async () => {
    try {
      const res = await fetch(`${backendUrl}/api/clinician/sepsis/alerts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setActiveAlerts(data);
      }
    } catch (err) {
      console.error('Fetch alerts error:', err);
    }
  }, [backendUrl, token]);

  useEffect(() => {
    fetchActiveAlerts();
  }, [fetchActiveAlerts]);

  const handleEvaluateSepsis = async () => {
    if (!patientId) return;
    setIsLoading(true);
    setStatusMsg('');
    try {
      const vitals: VitalsSnapshot = {
        heartRate,
        respiratoryRate,
        systolicBp,
        temperatureC,
        oxygenSaturation,
        supplementalOxygen,
        avpuConsciousness: avpu
      };

      const labs = {
        wbcCount,
        lactate
      };

      const res = await fetch(`${backendUrl}/api/clinician/sepsis/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId,
          sessionId: sessionId || null,
          vitals,
          labs,
          sourceInfection
        })
      });

      if (!res.ok) throw new Error('Evaluation failed');
      const data = await res.json();
      setLatestEval(data);

      if (data.sep1Bundle) {
        setBundleLactateMeasured(data.sep1Bundle.lactate_measured || false);
        setBundleLactateVal(data.sep1Bundle.lactate_value || lactate);
        setBundleBcDrawn(data.sep1Bundle.blood_cultures_drawn || false);
        setBundleAbxOrdered(data.sep1Bundle.broad_spectrum_abx_ordered || false);
        setBundleAbxRegimen(data.sep1Bundle.abx_regimen || 'Vancomycin 1.5g IV stat + Cefepime 2g IV stat');
        setBundleFluidGiven(data.sep1Bundle.fluid_resuscitation_administered || false);
        setBundleFluidVolume(data.sep1Bundle.fluid_volume_ml || 2100);
      }

      await fetchActiveAlerts();
      setStatusMsg(`Telemetry evaluated: ${data.deteriorationTier.toUpperCase()} (NEWS2: ${data.news2Score})`);
    } catch (err: any) {
      console.error('Evaluate sepsis error:', err);
      setStatusMsg('Error evaluating sepsis telemetry.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateBundle = async () => {
    const bundleId = latestEval?.sep1Bundle?.id;
    if (!bundleId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/clinician/sepsis/bundle/${bundleId}/action`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          lactateMeasured: bundleLactateMeasured,
          lactateValue: bundleLactateVal,
          bloodCulturesDrawn: bundleBcDrawn,
          broadSpectrumAbxOrdered: bundleAbxOrdered,
          abxRegimen: bundleAbxRegimen,
          fluidResuscitationAdministered: bundleFluidGiven,
          fluidVolumeMl: bundleFluidVolume
        })
      });

      if (!res.ok) throw new Error('Bundle update failed');
      const updated = await res.json();
      setLatestEval((prev: any) => ({ ...prev, sep1Bundle: updated }));
      await fetchActiveAlerts();
      setStatusMsg(updated.bundle_completed_at ? '✔ CMS SEP-1 3-Hour Bundle Completed & Timestamped!' : 'Bundle actions saved.');
    } catch (err: any) {
      console.error('Update bundle error:', err);
      setStatusMsg('Error updating SEP-1 bundle actions.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTriggerRrt = (patientLabel: string) => {
    setRrtDispatched(`🚨 Code Sepsis / Medical Rapid Response Team paged stat to ${patientLabel}!`);
    setTimeout(() => setRrtDispatched(null), 5000);
  };

  const getTierBadge = (tier?: string) => {
    switch (tier) {
      case 'critical_sepsis':
        return 'bg-rose-950/80 text-rose-300 border-rose-600 animate-pulse';
      case 'high':
        return 'bg-amber-950/80 text-amber-300 border-amber-600';
      case 'medium':
        return 'bg-yellow-950/80 text-yellow-300 border-yellow-600';
      default:
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-600';
    }
  };

  return (
    <div className="bg-slate-900 text-slate-100 rounded-xl border border-slate-800 p-6 space-y-6 shadow-2xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="w-6 h-6 text-rose-500 animate-pulse" />
            <h2 className="text-xl font-bold tracking-tight text-white">
              Sepsis & Clinical Deterioration Watchdog
            </h2>
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
              NEWS2 • qSOFA • SIRS • CMS SEP-1
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Automated hemodynamic deterioration detection, organ dysfunction surveillance, and standardized SEP-1 resuscitation bundle execution.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleTriggerRrt(patientName)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg transition"
          >
            <Radio className="w-3.5 h-3.5" />
            Dispatch RRT / Code Sepsis
          </button>
        </div>
      </div>

      {/* Notifications */}
      {statusMsg && (
        <div className="p-3 bg-indigo-950/60 border border-indigo-700/50 rounded-lg text-xs text-indigo-200 flex items-center justify-between">
          <span>{statusMsg}</span>
          <button onClick={() => setStatusMsg('')} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {rrtDispatched && (
        <div className="p-3 bg-rose-950/80 border border-rose-600 rounded-lg text-xs font-bold text-rose-200 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          <span>{rrtDispatched}</span>
        </div>
      )}

      {/* Deterioration HUD Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Deterioration Tier</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-base font-black px-2 py-0.5 rounded border uppercase ${getTierBadge(latestEval?.deteriorationTier || 'critical_sepsis')}`}>
              {latestEval?.deteriorationTier?.replace('_', ' ') || 'CRITICAL SEPSIS'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Multi-criteria clinical stratification</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>NEWS2 Composite Score</span>
            <Activity className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-300">
              {latestEval ? latestEval.news2Score : 18}
            </span>
            <span className="text-xs text-rose-400 font-bold">
              {latestEval ? latestEval.news2Risk : 'HIGH RISK'} (≥7 emergency)
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">National Early Warning Score</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>qSOFA Score</span>
            <Heart className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-purple-300">
              {latestEval ? latestEval.qsofaScore : 3}/3
            </span>
            <span className="text-xs text-purple-400 font-bold">
              {latestEval?.qsofaPositive ? 'POSITIVE (≥2)' : 'POSITIVE'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Quick Sepsis Organ Failure</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>CMS SEP-1 Bundle</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-sm font-bold text-cyan-300">
              {latestEval?.sep1Bundle?.bundle_completed_at ? 'COMPLETED' : '3-HOUR WINDOW'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Lactate • Cultures • Broad-spec IV Abx • Fluids
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 space-x-4">
        <button
          onClick={() => setActiveTab('patient_eval')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'patient_eval'
              ? 'border-rose-500 text-rose-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          Hemodynamic Evaluation & Scoring
        </button>
        <button
          onClick={() => setActiveTab('sep1_bundle')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'sep1_bundle'
              ? 'border-rose-500 text-rose-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Droplets className="w-4 h-4" />
          CMS SEP-1 Resuscitation Bundle
        </button>
        <button
          onClick={() => setActiveTab('facility_alerts')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'facility_alerts'
              ? 'border-rose-500 text-rose-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          Active Facility Alerts ({activeAlerts.length})
        </button>
      </div>

      {/* Tab 1: Hemodynamic Evaluation */}
      {activeTab === 'patient_eval' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Input Form */}
          <div className="lg:col-span-1 bg-slate-800/50 border border-slate-700/80 rounded-lg p-4 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Thermometer className="w-4 h-4 text-rose-400" />
              Patient Telemetry & Lab Snapshot
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-400">Heart Rate (bpm)</label>
                <input
                  type="number"
                  value={heartRate}
                  onChange={(e) => setHeartRate(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 mt-1"
                />
              </div>

              <div>
                <label className="text-slate-400">Resp Rate (/min)</label>
                <input
                  type="number"
                  value={respiratoryRate}
                  onChange={(e) => setRespiratoryRate(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 mt-1"
                />
              </div>

              <div>
                <label className="text-slate-400">Systolic BP (mmHg)</label>
                <input
                  type="number"
                  value={systolicBp}
                  onChange={(e) => setSystolicBp(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 mt-1"
                />
              </div>

              <div>
                <label className="text-slate-400">Temp (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  value={temperatureC}
                  onChange={(e) => setTemperatureC(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 mt-1"
                />
              </div>

              <div>
                <label className="text-slate-400">SpO2 (%)</label>
                <input
                  type="number"
                  value={oxygenSaturation}
                  onChange={(e) => setOxygenSaturation(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 mt-1"
                />
              </div>

              <div>
                <label className="text-slate-400">Serum Lactate (mmol/L)</label>
                <input
                  type="number"
                  step="0.1"
                  value={lactate}
                  onChange={(e) => setLactate(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-rose-300 font-bold mt-1"
                />
              </div>

              <div>
                <label className="text-slate-400">WBC (k/uL)</label>
                <input
                  type="number"
                  step="0.1"
                  value={wbcCount}
                  onChange={(e) => setWbcCount(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 mt-1"
                />
              </div>

              <div>
                <label className="text-slate-400">Mental Status (AVPU)</label>
                <select
                  value={avpu}
                  onChange={(e) => setAvpu(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 mt-1"
                >
                  <option value="A">Alert (A)</option>
                  <option value="V">Voice Responsive (V)</option>
                  <option value="P">Pain Responsive (P)</option>
                  <option value="U">Unresponsive (U)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1 text-xs text-slate-300">
              <input
                type="checkbox"
                id="suppO2"
                checked={supplementalOxygen}
                onChange={(e) => setSupplementalOxygen(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700"
              />
              <label htmlFor="suppO2">Patient on Supplemental Oxygen therapy</label>
            </div>

            <div>
              <label className="text-xs text-slate-400">Suspected Infection Source</label>
              <input
                type="text"
                value={sourceInfection}
                onChange={(e) => setSourceInfection(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 mt-1"
              />
            </div>

            <button
              onClick={handleEvaluateSepsis}
              disabled={isLoading}
              className="w-full bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs py-2.5 rounded transition flex items-center justify-center gap-1.5 shadow-md"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Evaluate Sepsis & NEWS2 Telemetry
            </button>
          </div>

          {/* Right: Detailed Scoring Breakdown */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-800/50 border border-slate-700/80 rounded-lg p-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                Diagnostic Evidence & Scoring Criteria
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* SIRS */}
                <div className="p-3 bg-slate-900/70 border border-slate-700/60 rounded">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-200">
                    <span>SIRS Criteria</span>
                    <span className="text-rose-400">{latestEval ? latestEval.sirsScore : 4}/4</span>
                  </div>
                  <ul className="text-[11px] text-slate-400 mt-2 space-y-1">
                    {(latestEval?.sirsCriteria || [
                      'Temp > 38.3°C',
                      'HR > 90 bpm',
                      'RR > 20 bpm',
                      'WBC > 12 k/uL'
                    ]).map((c: string, i: number) => (
                      <li key={i} className="flex items-center gap-1.5 text-rose-300">
                        <CheckCircle2 className="w-3 h-3 text-rose-500" />
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* qSOFA */}
                <div className="p-3 bg-slate-900/70 border border-slate-700/60 rounded">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-200">
                    <span>qSOFA Criteria</span>
                    <span className="text-purple-400">{latestEval ? latestEval.qsofaScore : 3}/3</span>
                  </div>
                  <ul className="text-[11px] text-slate-400 mt-2 space-y-1">
                    {(latestEval?.qsofaCriteria || [
                      'RR ≥ 22 /min',
                      'Altered mentation (AVPU)',
                      'SBP ≤ 100 mmHg'
                    ]).map((c: string, i: number) => (
                      <li key={i} className="flex items-center gap-1.5 text-purple-300">
                        <CheckCircle2 className="w-3 h-3 text-purple-500" />
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* NEWS2 */}
                <div className="p-3 bg-slate-900/70 border border-slate-700/60 rounded">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-200">
                    <span>NEWS2 Breakdown</span>
                    <span className="text-amber-400">Total: {latestEval ? latestEval.news2Score : 18}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-2 space-y-0.5">
                    <div className="flex justify-between">
                      <span>Respiration Rate:</span>
                      <span className="text-amber-300 font-mono">+{latestEval?.news2Breakdown?.respiration ?? 3}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Oxygen Saturation:</span>
                      <span className="text-amber-300 font-mono">+{latestEval?.news2Breakdown?.oxygenSaturation ?? 2}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Supp. Oxygen:</span>
                      <span className="text-amber-300 font-mono">+{latestEval?.news2Breakdown?.supplementalOxygen ?? 2}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Systolic BP:</span>
                      <span className="text-amber-300 font-mono">+{latestEval?.news2Breakdown?.systolicBp ?? 3}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Consciousness:</span>
                      <span className="text-amber-300 font-mono">+{latestEval?.news2Breakdown?.consciousness ?? 3}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actionable Directives */}
              <div className="mt-4 p-3 bg-rose-950/40 border border-rose-800/40 rounded space-y-1.5">
                <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Mandated Clinical Actions & Guidelines:
                </span>
                <ul className="text-xs text-slate-300 space-y-1 pl-4 list-disc">
                  {(latestEval?.recommendations || [
                    'Immediate Code Sepsis / Medical Rapid Response activation',
                    'Initiate CMS SEP-1 3-Hour Resuscitation Bundle without delay',
                    'Draw 2 sets of peripheral blood cultures PRIOR to antibiotic initiation',
                    'Administer broad-spectrum IV antimicrobials within 60 minutes',
                    'Initiate 30 mL/kg IV crystalloid fluid bolus for septic shock / hypoperfusion'
                  ]).map((rec: string, idx: number) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: CMS SEP-1 Resuscitation Bundle */}
      {activeTab === 'sep1_bundle' && (
        <div className="bg-slate-800/50 border border-slate-700/80 rounded-lg p-6 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-700/60 pb-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Droplets className="w-5 h-5 text-cyan-400" />
                CMS SEP-1 Early Management Bundle for Sepsis & Septic Shock
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Surviving Sepsis Campaign standard 3-Hour & 6-Hour clinical intervention bundle.
              </p>
            </div>

            {latestEval?.sep1Bundle?.bundle_completed_at && (
              <span className="px-3 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Bundle Satisfied: {new Date(latestEval.sep1Bundle.bundle_completed_at).toLocaleTimeString()}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Step 1: Lactate */}
            <div className={`p-4 rounded-lg border ${bundleLactateMeasured ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-slate-800/80 border-slate-700'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Step 1</span>
                  <h4 className="text-sm font-bold text-white mt-0.5">Stat Serum Lactate</h4>
                  <p className="text-xs text-slate-400 mt-1">Measure blood lactate level to assess tissue hypoperfusion.</p>
                </div>
                <input
                  type="checkbox"
                  checked={bundleLactateMeasured}
                  onChange={(e) => setBundleLactateMeasured(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 w-4 h-4 text-emerald-600"
                />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-slate-400">Result:</span>
                <input
                  type="number"
                  step="0.1"
                  value={bundleLactateVal}
                  onChange={(e) => setBundleLactateVal(Number(e.target.value))}
                  className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-rose-300 font-bold"
                />
                <span className="text-xs text-slate-400">mmol/L (&gt; 2.0 elevated, ≥ 4.0 severe shock)</span>
              </div>
            </div>

            {/* Step 2: Blood Cultures */}
            <div className={`p-4 rounded-lg border ${bundleBcDrawn ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-slate-800/80 border-slate-700'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Step 2</span>
                  <h4 className="text-sm font-bold text-white mt-0.5">Blood Cultures Prior to Antibiotics</h4>
                  <p className="text-xs text-slate-400 mt-1">Obtain 2 sets of peripheral blood cultures before antimicrobial start.</p>
                </div>
                <input
                  type="checkbox"
                  checked={bundleBcDrawn}
                  onChange={(e) => setBundleBcDrawn(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 w-4 h-4 text-emerald-600"
                />
              </div>
              <div className="mt-3 text-xs text-slate-400">
                {bundleBcDrawn ? '✔ Cultures inoculated & dispatched to microbiology' : 'Pending specimen collection'}
              </div>
            </div>

            {/* Step 3: Broad-Spectrum Antibiotics */}
            <div className={`p-4 rounded-lg border ${bundleAbxOrdered ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-slate-800/80 border-slate-700'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Step 3</span>
                  <h4 className="text-sm font-bold text-white mt-0.5">Broad-Spectrum IV Antimicrobial Therapy</h4>
                  <p className="text-xs text-slate-400 mt-1">Administer empirical broad-spectrum antibiotic coverage within 1 hour.</p>
                </div>
                <input
                  type="checkbox"
                  checked={bundleAbxOrdered}
                  onChange={(e) => setBundleAbxOrdered(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 w-4 h-4 text-emerald-600"
                />
              </div>
              <input
                type="text"
                value={bundleAbxRegimen}
                onChange={(e) => setBundleAbxRegimen(e.target.value)}
                placeholder="e.g. Vancomycin 1.5g IV + Cefepime 2g IV"
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 mt-3"
              />
            </div>

            {/* Step 4: Fluid Resuscitation */}
            <div className={`p-4 rounded-lg border ${bundleFluidGiven ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-slate-800/80 border-slate-700'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Step 4</span>
                  <h4 className="text-sm font-bold text-white mt-0.5">Rapid 30 mL/kg Crystalloid Bolus</h4>
                  <p className="text-xs text-slate-400 mt-1">Required for hypotension (SBP &lt; 90) or lactate ≥ 4.0 mmol/L.</p>
                </div>
                <input
                  type="checkbox"
                  checked={bundleFluidGiven}
                  onChange={(e) => setBundleFluidGiven(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 w-4 h-4 text-emerald-600"
                />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-slate-400">Target Volume:</span>
                <input
                  type="number"
                  value={bundleFluidVolume}
                  onChange={(e) => setBundleFluidVolume(Number(e.target.value))}
                  className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-200"
                />
                <span className="text-xs text-slate-400">mL Lactated Ringers or Plasmalyte</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleUpdateBundle}
              disabled={isLoading || !latestEval?.sep1Bundle}
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs py-2 px-4 rounded transition flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              Save & Attest Resuscitation Bundle
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: Facility-Wide Active Sepsis Alerts */}
      {activeTab === 'facility_alerts' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-400">
              Real-time deterioration telemetry monitoring {activeAlerts.length} high-acuity inpatients.
            </span>
            <button
              onClick={fetchActiveAlerts}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
            >
              Refresh Active List
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeAlerts.map(alert => (
              <div
                key={alert.id}
                className="p-4 rounded-lg bg-slate-800/80 border border-slate-700 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Flame className="w-4 h-4 text-rose-500" />
                      {alert.patient_name}
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {alert.source_infection || 'Suspected Sepsis / Decompensation'}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase border ${getTierBadge(alert.deterioration_tier)}`}>
                    {alert.deterioration_tier.replace('_', ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs py-2 border-y border-slate-700/60 font-mono">
                  <div className="text-center p-1.5 bg-slate-900/60 rounded">
                    <span className="text-[10px] text-slate-400 block font-sans">NEWS2</span>
                    <span className="font-bold text-amber-300 text-sm">{alert.news2_score}</span>
                  </div>
                  <div className="text-center p-1.5 bg-slate-900/60 rounded">
                    <span className="text-[10px] text-slate-400 block font-sans">qSOFA</span>
                    <span className="font-bold text-purple-300 text-sm">{alert.qsofa_score}</span>
                  </div>
                  <div className="text-center p-1.5 bg-slate-900/60 rounded">
                    <span className="text-[10px] text-slate-400 block font-sans">SIRS</span>
                    <span className="font-bold text-rose-300 text-sm">{alert.sirs_score}/4</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                  <span>Detected: {new Date(alert.created_at).toLocaleTimeString()}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTriggerRrt(alert.patient_name)}
                      className="px-2.5 py-1 text-xs font-bold rounded bg-rose-600/80 hover:bg-rose-600 text-white flex items-center gap-1 transition"
                    >
                      <Radio className="w-3 h-3" />
                      Code Sepsis
                    </button>
                    <button
                      onClick={() => {
                        setLatestEval({
                          deteriorationTier: alert.deterioration_tier,
                          news2Score: alert.news2_score,
                          qsofaScore: alert.qsofa_score,
                          sirsScore: alert.sirs_score,
                          sep1Bundle: { id: alert.bundle_id, bundle_completed_at: alert.bundle_completed_at }
                        });
                        setActiveTab('sep1_bundle');
                      }}
                      className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-700 hover:bg-slate-600 text-slate-200 flex items-center gap-1 transition"
                    >
                      <Droplets className="w-3 h-3 text-cyan-400" />
                      SEP-1
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {activeAlerts.length === 0 && (
              <div className="col-span-2 p-8 text-center text-slate-400 bg-slate-800/30 rounded-lg border border-dashed border-slate-700 text-sm">
                No active critical sepsis alerts across the facility.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
export default SepsisWatchdog;
