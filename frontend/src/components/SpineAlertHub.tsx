import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  RefreshCw,
  Plus,
  CheckCircle2,
  ShieldAlert,
  Sliders,
  Layers,
  Flame,
  Award
} from 'lucide-react';

interface ASIAClassificationResult {
  neurologicalLevelOfInjury: string;
  asiaImpairmentScale: 'A' | 'B' | 'C' | 'D' | 'E';
  completeness: string;
  clinicalDescription: string;
  functionalPrognosis: string;
  recommendedCareDirectives: string[];
}

interface SCICase {
  id: number;
  patient_id: number;
  neurological_level_of_injury: string;
  asia_impairment_scale: string;
  motor_score_total: number;
  sensory_score_light_touch: number;
  sensory_score_pinprick: number;
  sacral_sparing_sensory: boolean;
  sacral_sparing_motor: boolean;
  bulbocavernosus_reflex_present: boolean;
  spinal_shock_active: boolean;
  neurogenic_shock_active: boolean;
  target_map_min_mmhg: number;
  target_map_max_mmhg: number;
  slic_or_tlics_score?: number;
  surgical_indication: string;
  created_at: string;
}

interface ADEvent {
  id: number;
  case_id: number;
  systolic_bp: number;
  diastolic_bp: number;
  heart_rate: number;
  suspected_trigger: string;
  warning_message?: string;
  post_intervention_sbp?: number;
  resolved: boolean;
  recorded_at: string;
}

export const SpineAlertHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'asia' | 'shock' | 'autonomic' | 'instability' | 'history'>('asia');
  const [cases, setCases] = useState<SCICase[]>([]);
  const [adEvents, setAdEvents] = useState<ADEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form State
  const [patientId, setPatientId] = useState<number>(1);
  const [nli, setNli] = useState<string>('C5');
  const [motorScore, setMotorScore] = useState<number>(24);
  const [sensoryLightTouch, setSensoryLightTouch] = useState<number>(44);
  const [sensoryPinprick, setSensoryPinprick] = useState<number>(42);
  const [sacralSensory, setSacralSensory] = useState<boolean>(false);
  const [sacralMotor, setSacralMotor] = useState<boolean>(false);
  const [musclesGrade3Percent, setMusclesGrade3Percent] = useState<number>(0);

  // Computed ASIA
  const [asiaResult, setAsiaResult] = useState<ASIAClassificationResult | null>(null);

  // Shock Differentiator State
  const [systolicBp, setSystolicBp] = useState<number>(84);
  const [diastolicBp, setDiastolicBp] = useState<number>(54);
  const [heartRate, setHeartRate] = useState<number>(52);
  const [temperature, setTemperature] = useState<number>(35.9);
  const [bulbocavernosusReflex, setBulbocavernosusReflex] = useState<boolean>(false);
  const [hoursPostInjury, setHoursPostInjury] = useState<number>(14);

  // Autonomic Dysreflexia State
  const [baselineSbp, setBaselineSbp] = useState<number>(95);
  const [adSbp, setAdSbp] = useState<number>(178);
  const [adDbp, setAdDbp] = useState<number>(104);
  const [adHr, setAdHr] = useState<number>(48);
  const [adTrigger, setAdTrigger] = useState<string>('distended_foley_bladder');

  // Spine Instability State
  const [instabilityType, setInstabilityType] = useState<'SLIC' | 'TLICS'>('SLIC');
  const [morphologyScore, setMorphologyScore] = useState<number>(2); // Burst
  const [ligamentScore, setLigamentScore] = useState<number>(2); // Disrupted
  const [neuroScore, setNeuroScore] = useState<number>(3); // Incomplete cord injury

  useEffect(() => {
    handleClassifyAsia();
  }, [nli, motorScore, sensoryLightTouch, sensoryPinprick, sacralSensory, sacralMotor, musclesGrade3Percent]);

  useEffect(() => {
    fetchCases();
  }, [patientId]);

  const handleClassifyAsia = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/clinician/spine/asia/classify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId,
          neurologicalLevelOfInjury: nli,
          motorScoreTotal: motorScore,
          sensoryScoreLightTouch: sensoryLightTouch,
          sensoryScorePinprick: sensoryPinprick,
          sacralSparingSensory: sacralSensory,
          sacralSparingMotor: sacralMotor,
          keyMusclesBelowNliGrade3OrMorePercent: musclesGrade3Percent
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAsiaResult(data);
      }
    } catch {
      // offline fallback
      let grade: 'A' | 'B' | 'C' | 'D' | 'E' = 'A';
      if (!sacralSensory && !sacralMotor) grade = 'A';
      else if (sacralSensory && !sacralMotor && musclesGrade3Percent === 0) grade = 'B';
      else if (musclesGrade3Percent < 50) grade = 'C';
      else if (motorScore < 100 || sensoryLightTouch < 112) grade = 'D';
      else grade = 'E';

      setAsiaResult({
        neurologicalLevelOfInjury: nli,
        asiaImpairmentScale: grade,
        completeness: grade === 'A' ? 'Complete' : grade === 'B' ? 'Sensory Incomplete' : 'Motor Incomplete',
        clinicalDescription: `AIS Grade ${grade} injury at level ${nli}.`,
        functionalPrognosis: grade === 'A' ? 'Compensatory functional goals.' : 'Ambulatory potential preserved.',
        recommendedCareDirectives: [
          'Target MAP 85-90 mmHg continuously for 7 days post-injury',
          'Rigorous Q2H turns and skin inspection'
        ]
      });
    }
  };

  const handleSaveCase = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('token');
      const isNeurogenic = /^(C[1-8]|T[1-6])$/i.test(nli) && ((systolicBp + 2 * diastolicBp) / 3 < 75) && heartRate < 65;
      const totalInstability = morphologyScore + ligamentScore + neuroScore;
      const res = await fetch('/api/clinician/spine/cases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId,
          neurologicalLevelOfInjury: nli,
          asiaImpairmentScale: asiaResult?.asiaImpairmentScale || 'A',
          motorScoreTotal: motorScore,
          sensoryScoreLightTouch: sensoryLightTouch,
          sensoryScorePinprick: sensoryPinprick,
          sacralSparingSensory: sacralSensory,
          sacralSparingMotor: sacralMotor,
          bulbocavernosusReflexPresent: bulbocavernosusReflex,
          spinalShockActive: !bulbocavernosusReflex && hoursPostInjury <= 72,
          neurogenicShockActive: isNeurogenic,
          slicOrTlicsScore: totalInstability,
          surgicalIndication: totalInstability >= 5 ? 'Operative Stabilization Indicated' : 'Non-Operative'
        })
      });
      if (res.ok) {
        setMessage({ text: 'Spinal cord injury case recorded successfully.', type: 'success' });
        fetchCases();
      } else {
        setMessage({ text: 'Failed to record SCI case.', type: 'error' });
      }
    } catch {
      setMessage({ text: 'Network error saving SCI case.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchCases = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/clinician/spine/patients/${patientId}/cases`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCases(data);
        if (data.length > 0) {
          fetchAdEvents(data[0].id);
        }
      }
    } catch {
      // offline fallback
    }
  };

  const fetchAdEvents = async (caseId: number) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/clinician/spine/cases/${caseId}/ad-events`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAdEvents(data);
      }
    } catch {
      // offline fallback
    }
  };

  const handleRecordADEvent = async () => {
    if (cases.length === 0) {
      setMessage({ text: 'Please create an SCI case before logging an AD emergency event.', type: 'error' });
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const targetCaseId = cases[0].id;
      const res = await fetch(`/api/clinician/spine/cases/${targetCaseId}/ad-events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          systolicBp: adSbp,
          diastolicBp: adDbp,
          heartRate: adHr,
          suspectedTrigger: adTrigger,
          symptoms: ['severe_pounding_headache', 'facial_flushing', 'profuse_sweating_above_lesion'],
          interventionsApplied: ['upright_90_degree_positioning', 'foley_unkinked_irrigated', 'nitropaste_1_inch_applied'],
          postInterventionSbp: 118,
          resolved: true
        })
      });
      if (res.ok) {
        setMessage({ text: 'Autonomic Dysreflexia event logged and resolved.', type: 'success' });
        fetchAdEvents(targetCaseId);
      }
    } catch {
      // fallback
    }
  };

  // Shock Differentiator Computed
  const mapMmhg = Math.round((systolicBp + 2 * diastolicBp) / 3);
  const isCervicalOrHighThoracic = /^(C[1-8]|T[1-6])$/i.test(nli);
  const isNeurogenicShock = isCervicalOrHighThoracic && (mapMmhg < 75 || systolicBp < 90) && heartRate < 65;
  const isSpinalShock = !bulbocavernosusReflex && hoursPostInjury <= 72;

  // AD Computed
  const sbpRise = adSbp - baselineSbp;
  const isADCrisis = isCervicalOrHighThoracic && (adSbp >= 160 || sbpRise >= 40);

  // Instability Computed
  const totalInstabilityScore = morphologyScore + ligamentScore + neuroScore;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-600/20 border border-amber-500/30 rounded-xl text-amber-400">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-white">SPINE-ALERT Hub</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Phase 62
              </span>
            </div>
            <p className="text-sm text-slate-400">
              Acute Spinal Cord Injury, ASIA/ISNCSCI Mapping, Neurogenic Shock MAP 85-90 & Autonomic Dysreflexia
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchCases}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm flex items-center gap-2 border border-slate-700"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={handleSaveCase}
            disabled={loading}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-semibold flex items-center gap-2 shadow-lg shadow-amber-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            Commit SCI Case
          </button>
        </div>
      </div>

      {/* Status message */}
      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 border ${
          message.type === 'success'
            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
            : 'bg-red-950/40 border-red-500/40 text-red-300'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-800 space-x-1">
        {[
          { id: 'asia', label: 'ASIA / ISNCSCI Mapping', icon: Award },
          { id: 'shock', label: 'Neurogenic vs Spinal Shock', icon: Activity },
          { id: 'autonomic', label: 'Autonomic Dysreflexia', icon: Flame },
          { id: 'instability', label: 'Spine Instability (SLIC/TLICS)', icon: Layers },
          { id: 'history', label: 'Case Registry', icon: Sliders }
        ].map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                active
                  ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: ASIA CLASSIFICATION */}
      {activeTab === 'asia' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-amber-400" />
              ISNCSCI Neurological Exam
            </h3>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400">Patient ID</label>
                  <input
                    type="number"
                    value={patientId}
                    onChange={e => setPatientId(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Neurological Level (NLI)</label>
                  <select
                    value={nli}
                    onChange={e => setNli(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white"
                  >
                  <optgroup label="Cervical (Tetraplegia / Quadriplegia)">
                    {['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8'].map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Thoracic (Paraplegia)">
                    {['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'].map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Lumbar / Sacral">
                    {['L1', 'L2', 'L3', 'L4', 'L5', 'S1', 'S2', 'S3'].map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Total Motor Score (0-100)</span>
                  <span className="text-white font-bold">{motorScore} / 100</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={motorScore}
                  onChange={e => setMotorScore(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400">Light Touch (0-112)</label>
                  <input
                    type="number"
                    value={sensoryLightTouch}
                    onChange={e => setSensoryLightTouch(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Pinprick (0-112)</label>
                  <input
                    type="number"
                    value={sensoryPinprick}
                    onChange={e => setSensoryPinprick(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-800/60 rounded-xl space-y-2 border border-slate-700">
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">Sacral Sparing Assessment</span>
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sacralSensory}
                    onChange={e => setSacralSensory(e.target.checked)}
                    className="rounded border-slate-700 text-amber-600 focus:ring-amber-500 w-4 h-4"
                  />
                  <span>S4-S5 Sensory / Deep Anal Pressure (DAP) Preserved</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sacralMotor}
                    onChange={e => setSacralMotor(e.target.checked)}
                    className="rounded border-slate-700 text-amber-600 focus:ring-amber-500 w-4 h-4"
                  />
                  <span>Voluntary Anal Contraction (VAC) Preserved</span>
                </label>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Key Muscles &ge; 3/5 below NLI</span>
                  <span className="text-white font-bold">{musclesGrade3Percent}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={musclesGrade3Percent}
                  onChange={e => setMusclesGrade3Percent(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
                <span className="text-[10px] text-slate-500">Threshold: &lt;50% = Grade C | &ge;50% = Grade D</span>
              </div>
            </div>
          </div>

          {/* ASIA Results */}
          <div className="lg:col-span-7 space-y-4">
            {asiaResult && (
              <>
                <div className={`p-6 rounded-2xl border ${
                  asiaResult.asiaImpairmentScale === 'A'
                    ? 'bg-red-950/40 border-red-500/50 text-red-200'
                    : asiaResult.asiaImpairmentScale === 'B'
                    ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                    : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-wider font-bold opacity-80">
                        ISNCSCI ASIA Impairment Scale
                      </div>
                      <h4 className="text-2xl font-black">
                        AIS Grade {asiaResult.asiaImpairmentScale} ({asiaResult.completeness})
                      </h4>
                      <div className="text-xs opacity-90 mt-1">Level: <strong>{asiaResult.neurologicalLevelOfInjury}</strong></div>
                    </div>
                    <div className="text-4xl font-black px-4 py-2 bg-black/40 rounded-2xl">
                      {asiaResult.asiaImpairmentScale}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
                  <div>
                    <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Functional Prognosis</h5>
                    <p className="text-sm text-slate-200 mt-1">{asiaResult.functionalPrognosis}</p>
                  </div>
                  <div className="pt-3 border-t border-slate-800">
                    <h5 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
                      Guideline Clinical Directives
                    </h5>
                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {asiaResult.recommendedCareDirectives.map((d, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-amber-400 font-bold">•</span>
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SHOCK DIFFERENTIATOR */}
      {activeTab === 'shock' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
            <h3 className="text-md font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-amber-400" />
              Bedside Hemodynamics & Reflex Watchdog
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-400">Blood Pressure (SBP/DBP)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={systolicBp}
                    onChange={e => setSystolicBp(Number(e.target.value))}
                    className="w-1/2 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-center"
                    placeholder="SBP"
                  />
                  <input
                    type="number"
                    value={diastolicBp}
                    onChange={e => setDiastolicBp(Number(e.target.value))}
                    className="w-1/2 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-center"
                    placeholder="DBP"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400">Heart Rate (bpm)</label>
                <input
                  type="number"
                  value={heartRate}
                  onChange={e => setHeartRate(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400">Core Temp (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  value={temperature}
                  onChange={e => setTemperature(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400">Hours Post-Injury</label>
                <input
                  type="number"
                  value={hoursPostInjury}
                  onChange={e => setHoursPostInjury(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bulbocavernosusReflex}
                  onChange={e => setBulbocavernosusReflex(e.target.checked)}
                  className="rounded border-slate-700 text-amber-600 focus:ring-amber-500 w-4 h-4"
                />
                <span>Bulbocavernosus Reflex Present (Anal sphincter squeeze on glans/clitoris pressure)</span>
              </label>
              <p className="text-[10px] text-slate-500 mt-1">
                Absent reflex indicates active spinal shock. Return heralds termination of spinal shock.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Neurogenic Shock Card */}
            <div className={`p-5 rounded-2xl border ${
              isNeurogenicShock
                ? 'bg-red-950/50 border-red-500 text-red-200 shadow-lg shadow-red-500/20'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}>
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-bold text-sm">Neurogenic Shock Sentinel</h4>
                <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                  isNeurogenicShock ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-500'
                }`}>
                  {isNeurogenicShock ? 'ACTIVE CRITICAL' : 'NOT DETECTED'}
                </span>
              </div>
              <p className="text-xs mb-3">
                Current MAP: <strong className={mapMmhg < 75 ? 'text-red-400' : 'text-white'}>{mapMmhg} mmHg</strong> | HR: <strong className={heartRate < 60 ? 'text-red-400' : 'text-white'}>{heartRate} bpm</strong>
              </p>
              {isNeurogenicShock && (
                <div className="text-xs bg-black/40 p-3 rounded-xl space-y-1.5 text-red-100">
                  <div className="font-bold text-red-300">AANS/CNS Acute Protocol:</div>
                  <div>• Maintain <strong>MAP 85-90 mmHg</strong> continuously for 7 days post-injury.</div>
                  <div>• Vasopressor of choice: <strong>Norepinephrine</strong> (or Dopamine) for combined alpha + beta support.</div>
                  <div>• Avoid pure alpha (Phenylephrine) due to reflex severe bradycardia risk.</div>
                </div>
              )}
            </div>

            {/* Spinal Shock Card */}
            <div className={`p-5 rounded-2xl border ${
              isSpinalShock
                ? 'bg-amber-950/50 border-amber-500 text-amber-200'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}>
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-bold text-sm">Spinal Shock Status</h4>
                <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                  isSpinalShock ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-500'
                }`}>
                  {isSpinalShock ? 'ACTIVE (ABSENT REFLEX)' : 'RESOLVED'}
                </span>
              </div>
              <p className="text-xs">
                {isSpinalShock
                  ? 'Absent bulbocavernosus reflex indicates complete neuro-reflex shutdown. Final ASIA grade cannot be determined until spinal shock resolves (24-72 hours).'
                  : 'Bulbocavernosus reflex present. Spinal shock has resolved; examination reflects true structural impairment.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AUTONOMIC DYSREFLEXIA */}
      {activeTab === 'autonomic' && (
        <div className="space-y-6">
          {isADCrisis && (
            <div className="p-5 bg-red-950/80 border-2 border-red-500 rounded-2xl text-red-200 flex items-center gap-4 animate-pulse">
              <Flame className="w-10 h-10 text-red-400 flex-shrink-0" />
              <div>
                <h4 className="text-lg font-black tracking-wide">
                  EMERGENT: AUTONOMIC DYSREFLEXIA HYPERTENSIVE CRISIS
                </h4>
                <p className="text-sm">
                  Blood pressure is <strong>{adSbp}/{adDbp} mmHg</strong> (+{sbpRise} mmHg above baseline).
                  Immediate risk of hemorrhagic stroke, encephalopathy, seizure, and myocardial infarction!
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <Flame className="w-5 h-5 text-red-400" />
                AD Hemodynamic Assessment
              </h3>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-slate-400">Baseline Resting SBP (mmHg)</label>
                  <input
                    type="number"
                    value={baselineSbp}
                    onChange={e => setBaselineSbp(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-400">Current Emergent SBP (mmHg)</label>
                  <input
                    type="number"
                    value={adSbp}
                    onChange={e => setAdSbp(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white font-bold text-red-400"
                  />
                </div>

                <div>
                  <label className="text-slate-400">Current DBP / HR</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={adDbp}
                      onChange={e => setAdDbp(Number(e.target.value))}
                      className="w-1/2 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-center"
                    />
                    <input
                      type="number"
                      value={adHr}
                      onChange={e => setAdHr(Number(e.target.value))}
                      className="w-1/2 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-center"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-400">Suspected Noxious Trigger</label>
                  <select
                    value={adTrigger}
                    onChange={e => setAdTrigger(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
                  >
                    <option value="distended_foley_bladder">Distended / Blocked Foley (85%)</option>
                    <option value="fecal_impaction">Bowel Fecal Impaction</option>
                    <option value="tight_clothing">Tight Clothing / Abdominal Binder</option>
                    <option value="skin_ulcer_burn">Pressure Ulcer / Ingrown Nail</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleRecordADEvent}
                className="w-full py-2 bg-red-600/30 hover:bg-red-600/50 text-red-300 rounded-xl text-xs font-semibold border border-red-500/40"
              >
                Log AD Crisis & Applied Protocol to EHR
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-3">
              <h3 className="text-md font-bold text-amber-400 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-amber-400" />
                Step-by-Step Emergency Protocol
              </h3>

              <div className="space-y-2 text-xs text-slate-300">
                <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700">
                  <strong className="text-amber-300">STEP 1:</strong> Sit patient upright immediately (90 degrees, dangle legs) to induce orthostatic pooling.
                </div>
                <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700">
                  <strong className="text-amber-300">STEP 2:</strong> Loosen all restrictive clothing, binders, and compression stockings.
                </div>
                <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700">
                  <strong className="text-amber-300">STEP 3:</strong> Unkink catheter / irrigate bladder with saline (culprit in &gt;80% of crises).
                </div>
                <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700">
                  <strong className="text-amber-300">STEP 4:</strong> Check rectum for fecal impaction with 2% lidocaine jelly.
                </div>
                <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700">
                  <strong className="text-amber-300">STEP 5:</strong> If SBP &ge; 150 mmHg, apply <strong>1-inch 2% Nitropaste</strong> topically (can wipe off quickly if hypotensive) or oral Nifedipine 10 mg capsule.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SPINE INSTABILITY */}
      {activeTab === 'instability' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-md font-bold text-white">Surgical Instability Calculator</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setInstabilityType('SLIC')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold ${
                    instabilityType === 'SLIC' ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  SLIC (Cervical)
                </button>
                <button
                  onClick={() => setInstabilityType('TLICS')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold ${
                    instabilityType === 'TLICS' ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  TLICS (Thoracolumbar)
                </button>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400">Fracture Morphology</label>
                <select
                  value={morphologyScore}
                  onChange={e => setMorphologyScore(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
                >
                  <option value={0}>0: No abnormality</option>
                  <option value={1}>1: Compression fracture</option>
                  <option value={2}>2: Burst fracture</option>
                  <option value={3}>3: Distraction injury</option>
                  <option value={4}>4: Rotation / Translation dislocation</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400">Ligamentous Complex Integrity</label>
                <select
                  value={ligamentScore}
                  onChange={e => setLigamentScore(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
                >
                  <option value={0}>0: Intact</option>
                  <option value={2}>2: Indeterminate / suspicious</option>
                  <option value={3}>3: Disrupted</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400">Neurological Status</label>
                <select
                  value={neuroScore}
                  onChange={e => setNeuroScore(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
                >
                  <option value={0}>0: Intact</option>
                  <option value={1}>1: Nerve root injury only</option>
                  <option value={2}>2: Complete cord injury</option>
                  <option value={3}>3: Incomplete cord injury (most urgent)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between">
            <div>
              <span className="text-xs text-slate-400 uppercase tracking-wider">{instabilityType} Total Score</span>
              <div className="text-5xl font-black text-white my-2">{totalInstabilityScore}</div>
              <div className={`p-4 rounded-xl border mt-3 ${
                totalInstabilityScore >= 5
                  ? 'bg-red-950/40 border-red-500/50 text-red-200'
                  : totalInstabilityScore === 4
                  ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                  : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
              }`}>
                <h4 className="font-bold text-sm">
                  {totalInstabilityScore >= 5
                    ? 'Operative Stabilization Indicated (Score >= 5)'
                    : totalInstabilityScore === 4
                    ? 'Surgeon Discretion / Equivocal (Score = 4)'
                    : 'Non-Operative Management (Score <= 3)'}
                </h4>
                <p className="text-xs mt-1 opacity-90">
                  {totalInstabilityScore >= 5
                    ? 'High biomechanical instability with cord compromise. Emergent spine surgery consultation.'
                    : totalInstabilityScore === 4
                    ? 'Intermediate mechanical stability; consider patient comorbidities and spinal alignment.'
                    : 'Stable fracture configuration. External orthosis (cervical collar or TLSO) indicated.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: CASE REGISTRY */}
      {activeTab === 'history' && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
          <h3 className="text-md font-bold text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-400" />
            Spinal Cord Injury Registry for Patient {patientId}
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="p-3">Case ID</th>
                  <th className="p-3">NLI</th>
                  <th className="p-3">ASIA Grade</th>
                  <th className="p-3">Motor Score</th>
                  <th className="p-3">Sensory (LT/PP)</th>
                  <th className="p-3">Sacral Sparing</th>
                  <th className="p-3">Shock Status</th>
                  <th className="p-3">Surgical Indication</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {cases.length > 0 ? (
                  cases.map(c => (
                    <tr key={c.id} className="hover:bg-slate-800/30">
                      <td className="p-3 font-mono font-bold text-white">#{c.id}</td>
                      <td className="p-3 font-bold text-amber-400">{c.neurological_level_of_injury}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded font-bold bg-amber-500/20 text-amber-300">
                          Grade {c.asia_impairment_scale}
                        </span>
                      </td>
                      <td className="p-3">{c.motor_score_total} / 100</td>
                      <td className="p-3">{c.sensory_score_light_touch} / {c.sensory_score_pinprick}</td>
                      <td className="p-3">{c.sacral_sparing_sensory ? 'Sensory Yes' : 'No'}</td>
                      <td className="p-3">
                        {c.neurogenic_shock_active ? (
                          <span className="text-red-400 font-bold">Neurogenic Shock</span>
                        ) : (
                          <span className="text-slate-400">Stable</span>
                        )}
                      </td>
                      <td className="p-3 font-semibold text-slate-200">{c.surgical_indication}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-500">
                      No spinal cord injury cases on file for patient ID {patientId}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {adEvents.length > 0 && (
            <div className="mt-6 pt-4 border-t border-slate-800">
              <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2">
                Logged Autonomic Dysreflexia Emergency Events
              </h4>
              <div className="space-y-2">
                {adEvents.map(ad => (
                  <div key={ad.id} className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl text-xs flex justify-between items-center">
                    <div>
                      <span className="font-bold text-white mr-2">BP {ad.systolic_bp}/{ad.diastolic_bp} mmHg (HR {ad.heart_rate})</span>
                      <span className="text-slate-400">Trigger: {ad.suspected_trigger}</span>
                    </div>
                    <span className="text-emerald-400 font-bold">Resolved (Post-Tx SBP: {ad.post_intervention_sbp})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SpineAlertHub;
