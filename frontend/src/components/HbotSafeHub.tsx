import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  RefreshCw,
  Plus,
  CheckCircle2,
  Gauge,
  Sliders,
  Wind,
  ShieldAlert,
  Flame,
  Zap,
  Timer
} from 'lucide-react';

interface COKineticProfile {
  initialCohbPercent: number;
  elapsedMinutes: number;
  ambientCondition: string;
  halfLifeMinutes: number;
  projectedCurrentCohbPercent: number;
  uhmsEmergentHbotIndicated: boolean;
  indicationCriteriaMet: string[];
  recommendedTable: string;
}

interface TreatmentTableProfile {
  indication: string;
  treatmentTable: string;
  maxDepthFsw: number;
  maxPressureAta: number;
  totalDurationMinutes: number;
  o2BreathingPeriodsCount: number;
  airBreaksMinutes: number;
  description: string;
  chamberOperationalRules: string[];
}

interface OxygenToxicityAssessment {
  cumulativeUptd: number;
  dailyUptdCeilingExceeded: boolean;
  pulmonaryToxicityRisk: string;
  cnsToxicityRisk: string;
  cnsProdromeDetected: boolean;
  observedProdromalSymptoms: string[];
  mandatoryEmergencyActions: string[];
}

interface HBOTSession {
  id: number;
  patient_id: number;
  indication: string;
  treatment_table: string;
  chamber_type: string;
  max_depth_fsw: number;
  pressure_ata: number;
  total_duration_minutes: number;
  initial_cohb_percent?: number;
  final_cohb_percent?: number;
  session_status: string;
  started_at: string;
}

export const HbotSafeHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'co_kinetics' | 'tables' | 'toxicity' | 'sessions'>('co_kinetics');
  const [sessions, setSessions] = useState<HBOTSession[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form State
  const [patientId, setPatientId] = useState<number>(1);
  const [initialCohb, setInitialCohb] = useState<number>(32.0);
  const [elapsedMinutes, setElapsedMinutes] = useState<number>(45);
  const [pressureAta, setPressureAta] = useState<number>(2.8);
  const [fio2Fraction, setFio2Fraction] = useState<number>(1.0);
  const [lossOfConsciousness, setLossOfConsciousness] = useState<boolean>(true);
  const [cardiacIschemia, setCardiacIschemia] = useState<boolean>(false);
  const [pregnancy, setPregnancy] = useState<boolean>(false);
  const [neurologicalDeficit, setNeurologicalDeficit] = useState<boolean>(true);

  // Computed CO Profile
  const [coProfile, setCoProfile] = useState<COKineticProfile | null>(null);

  // Treatment Table Selector
  const [selectedIndication, setSelectedIndication] = useState<string>('ARTERIAL_GAS_EMBOLISM');
  const [isSevereDeep, setIsSevereDeep] = useState<boolean>(false);
  const [tableProfile, setTableProfile] = useState<TreatmentTableProfile | null>(null);

  // Toxicity State
  const [diveDurationMinutes, setDiveDurationMinutes] = useState<number>(90);
  const [cnsSymptoms, setCnsSymptoms] = useState<string[]>(['facial_twitching']);
  const [toxicityAssessment, setToxicityAssessment] = useState<OxygenToxicityAssessment | null>(null);

  useEffect(() => {
    handleCalculateCO();
  }, [initialCohb, elapsedMinutes, pressureAta, fio2Fraction, lossOfConsciousness, cardiacIschemia, pregnancy, neurologicalDeficit]);

  useEffect(() => {
    handleSelectTable();
  }, [selectedIndication, isSevereDeep]);

  useEffect(() => {
    handleCalculateToxicity();
  }, [pressureAta, diveDurationMinutes, cnsSymptoms]);

  useEffect(() => {
    fetchSessions();
  }, [patientId]);

  const handleCalculateCO = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/clinician/hbot/co-kinetics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          initialCohbPercent: initialCohb,
          elapsedMinutes,
          fio2Fraction,
          pressureAta,
          lossOfConsciousness,
          cardiacIschemia,
          pregnancy,
          neurologicalDeficit
        })
      });
      if (res.ok) {
        const data = await res.json();
        setCoProfile(data);
      }
    } catch {
      // offline fallback
      const halfLife = pressureAta >= 2.0 ? 20 : fio2Fraction >= 0.9 ? 80 : 320;
      const proj = Math.round(initialCohb * Math.pow(0.5, elapsedMinutes / halfLife) * 10) / 10;
      setCoProfile({
        initialCohbPercent: initialCohb,
        elapsedMinutes,
        ambientCondition: pressureAta >= 2.0 ? 'Hyperbaric 100% O2 (2.5-3.0 ATA)' : 'Normobaric 100% O2 (1.0 ATA)',
        halfLifeMinutes: halfLife,
        projectedCurrentCohbPercent: proj,
        uhmsEmergentHbotIndicated: initialCohb >= 25 || lossOfConsciousness || neurologicalDeficit,
        indicationCriteriaMet: ['COHb >= 25%', 'Loss of consciousness'],
        recommendedTable: 'UHMS CO Protocol (2.5 - 3.0 ATA for 90m)'
      });
    }
  };

  const handleSelectTable = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/clinician/hbot/tables/select', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          indication: selectedIndication,
          isSevereOrAGE: isSevereDeep
        })
      });
      if (res.ok) {
        const data = await res.json();
        setTableProfile(data);
      }
    } catch {
      // offline fallback
    }
  };

  const handleCalculateToxicity = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/clinician/hbot/toxicity/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          segments: [{ po2Ata: pressureAta, durationMinutes: diveDurationMinutes }],
          cnsSymptoms
        })
      });
      if (res.ok) {
        const data = await res.json();
        setToxicityAssessment(data);
      }
    } catch {
      // offline fallback
    }
  };

  const handleSaveSession = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/clinician/hbot/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId,
          indication: selectedIndication,
          treatmentTable: tableProfile?.treatmentTable || 'US_NAVY_TT6',
          chamberType: 'multiplace',
          maxDepthFsw: tableProfile?.maxDepthFsw || 60,
          pressureAta: tableProfile?.maxPressureAta || 2.8,
          totalDurationMinutes: tableProfile?.totalDurationMinutes || 285,
          airBreaksCount: tableProfile?.o2BreathingPeriodsCount || 3,
          initialCohbPercent: initialCohb,
          finalCohbPercent: coProfile?.projectedCurrentCohbPercent || 8.0,
          sessionStatus: 'completed'
        })
      });
      if (res.ok) {
        setMessage({ text: 'Hyperbaric treatment session logged to clinical EHR.', type: 'success' });
        fetchSessions();
      } else {
        setMessage({ text: 'Failed to record session.', type: 'error' });
      }
    } catch {
      setMessage({ text: 'Network error saving HBOT session.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/clinician/hbot/patients/${patientId}/sessions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch {
      // offline fallback
    }
  };

  const hasTwitching = cnsSymptoms.some(s => s.includes('twitch'));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyan-600/20 border border-cyan-500/30 rounded-xl text-cyan-400">
            <Gauge className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-white">HBOT-SAFE Hub</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Phase 64
              </span>
            </div>
            <p className="text-sm text-slate-400">
              Hyperbaric Medicine, US Navy Treatment Tables, CO Poisoning Half-Life & Oxygen Toxicity Watchdogs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchSessions}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm flex items-center gap-2 border border-slate-700"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={handleSaveSession}
            disabled={loading}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-semibold flex items-center gap-2 shadow-lg shadow-cyan-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            Log Treatment Dive
          </button>
        </div>
      </div>

      {/* Status Banner */}
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
          { id: 'co_kinetics', label: 'CO Elimination Kinetics', icon: Flame },
          { id: 'tables', label: 'US Navy Treatment Tables', icon: Wind },
          { id: 'toxicity', label: 'Oxygen Toxicity (UPTD & CNS)', icon: ShieldAlert },
          { id: 'sessions', label: 'Chamber Dive Registry', icon: Activity }
        ].map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                active
                  ? 'border-cyan-500 text-cyan-400 bg-cyan-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: CO KINETICS */}
      {activeTab === 'co_kinetics' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
            <h3 className="text-md font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-cyan-400" />
              CO Exposure & Oxygen Dosing
            </h3>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400">Patient ID</label>
                  <input
                    type="number"
                    value={patientId}
                    onChange={e => setPatientId(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400">Chamber Pressure (ATA)</label>
                  <select
                    value={pressureAta}
                    onChange={e => {
                      const val = Number(e.target.value);
                      setPressureAta(val);
                      if (val >= 2.0) setFio2Fraction(1.0);
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
                  >
                    <option value={1.0}>1.0 ATA (Sea level room air / NRB)</option>
                    <option value={2.0}>2.0 ATA (33 fsw)</option>
                    <option value={2.5}>2.5 ATA (50 fsw - CO Protocol)</option>
                    <option value={2.8}>2.8 ATA (60 fsw - US Navy Table 6)</option>
                    <option value={3.0}>3.0 ATA (66 fsw - Maximum clinical O2)</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Initial Carboxyhemoglobin (COHb %)</span>
                  <span className={`font-bold ${initialCohb >= 25 ? 'text-red-400' : 'text-white'}`}>
                    {initialCohb}%
                  </span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="60"
                  step="1"
                  value={initialCohb}
                  onChange={e => setInitialCohb(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Elapsed Treatment Time (minutes)</span>
                  <span className="font-bold text-white">{elapsedMinutes} mins</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="240"
                  step="5"
                  value={elapsedMinutes}
                  onChange={e => setElapsedMinutes(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>

              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700 space-y-2">
                <span className="font-bold text-cyan-300 block mb-1">UHMS Clinical High-Risk Indicators</span>
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lossOfConsciousness}
                    onChange={e => setLossOfConsciousness(e.target.checked)}
                    className="rounded border-slate-700 text-cyan-600 focus:ring-cyan-500 w-4 h-4"
                  />
                  <span>Documented Syncope / Loss of Consciousness</span>
                </label>

                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cardiacIschemia}
                    onChange={e => setCardiacIschemia(e.target.checked)}
                    className="rounded border-slate-700 text-cyan-600 focus:ring-cyan-500 w-4 h-4"
                  />
                  <span>Myocardial Ischemia / Elevated Troponin</span>
                </label>

                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pregnancy}
                    onChange={e => setPregnancy(e.target.checked)}
                    className="rounded border-slate-700 text-cyan-600 focus:ring-cyan-500 w-4 h-4"
                  />
                  <span>Pregnancy (Fetal HbF High Affinity: Threshold &gt; 15%)</span>
                </label>

                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={neurologicalDeficit}
                    onChange={e => setNeurologicalDeficit(e.target.checked)}
                    className="rounded border-slate-700 text-cyan-600 focus:ring-cyan-500 w-4 h-4"
                  />
                  <span>Objective Neurological or Cognitive Deficit</span>
                </label>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-4">
            {coProfile && (
              <>
                <div className={`p-6 rounded-2xl border ${
                  coProfile.uhmsEmergentHbotIndicated
                    ? 'bg-red-950/60 border-red-500 text-red-200 shadow-xl shadow-red-500/20'
                    : 'bg-emerald-950/60 border-emerald-500 text-emerald-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs uppercase font-extrabold tracking-wider opacity-80">
                        Undersea and Hyperbaric Medical Society (UHMS) Directive
                      </span>
                      <h4 className="text-2xl font-black mt-1">
                        {coProfile.uhmsEmergentHbotIndicated ? 'EMERGENT HBOT DIVE INDICATED' : 'NORMOBARIC THERAPY ADEQUATE'}
                      </h4>
                      <p className="text-xs opacity-90 mt-1">
                        Recommended: <strong>{coProfile.recommendedTable}</strong>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs opacity-80">Half-Life (t1/2)</span>
                      <div className="text-3xl font-black">{coProfile.halfLifeMinutes}m</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                    <span className="text-xs text-slate-400">Baseline COHb</span>
                    <div className="text-3xl font-black text-white">{coProfile.initialCohbPercent}%</div>
                    <span className="text-[10px] text-slate-500">Upon admission</span>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                    <span className="text-xs text-slate-400">Projected Current COHb</span>
                    <div className={`text-3xl font-black ${coProfile.projectedCurrentCohbPercent < 5.0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {coProfile.projectedCurrentCohbPercent}%
                    </div>
                    <span className="text-[10px] text-slate-500">After {elapsedMinutes} mins treatment</span>
                  </div>
                </div>

                {coProfile.indicationCriteriaMet.length > 0 && (
                  <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
                    <h5 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                      UHMS Trigger Criteria Present:
                    </h5>
                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {coProfile.indicationCriteriaMet.map((crit, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-red-400 font-bold">•</span>
                          <span>{crit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: US NAVY TABLES */}
      {activeTab === 'tables' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
            <h3 className="text-md font-bold text-white flex items-center gap-2">
              <Wind className="w-5 h-5 text-cyan-400" />
              Treatment Table Protocol Selector
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400">Clinical Indication</label>
                <select
                  value={selectedIndication}
                  onChange={e => setSelectedIndication(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
                >
                  <option value="ARTERIAL_GAS_EMBOLISM">Arterial Gas Embolism (AGE)</option>
                  <option value="DCS_TYPE_II">Decompression Sickness Type II (Neurologic / Inner Ear)</option>
                  <option value="DCS_TYPE_I">Decompression Sickness Type I (Pain only)</option>
                  <option value="CARBON_MONOXIDE">Acute Carbon Monoxide Poisoning</option>
                  <option value="CLOSTRIDIAL_MYONECROSIS">Clostridial Myonecrosis (Gas Gangrene)</option>
                  <option value="PROBLEM_WOUND">Refractory Diabetic Foot Ulcer (Wagner 3-4)</option>
                </select>
              </div>

              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700">
                <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSevereDeep}
                    onChange={e => setIsSevereDeep(e.target.checked)}
                    className="rounded border-slate-700 text-cyan-600 focus:ring-cyan-500 w-4 h-4"
                  />
                  <span>Severe Refractory AGE / Deep Air Compression (US Navy 6A)</span>
                </label>
                <span className="text-[10px] text-slate-400 block mt-1">Compresses to 165 fsw (6.0 ATA) on air for 30 mins to rapidly reduce bubble diameter.</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-4">
            {tableProfile && (
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs text-cyan-400 uppercase font-bold tracking-wider">Protocol Specification</span>
                    <h4 className="text-2xl font-black text-white mt-0.5">{tableProfile.treatmentTable}</h4>
                    <p className="text-xs text-slate-400 mt-1">{tableProfile.description}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700">
                    <span className="text-[10px] text-slate-400">Max Depth</span>
                    <div className="text-xl font-bold text-white">{tableProfile.maxDepthFsw} fsw</div>
                    <span className="text-[10px] text-cyan-400">{tableProfile.maxPressureAta} ATA</span>
                  </div>

                  <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700">
                    <span className="text-[10px] text-slate-400">Total Run Time</span>
                    <div className="text-xl font-bold text-white">{tableProfile.totalDurationMinutes} mins</div>
                    <span className="text-[10px] text-slate-400">~{Math.round(tableProfile.totalDurationMinutes / 60 * 10) / 10} hrs</span>
                  </div>

                  <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700">
                    <span className="text-[10px] text-slate-400">O2 Cycles</span>
                    <div className="text-xl font-bold text-white">{tableProfile.o2BreathingPeriodsCount}</div>
                    <span className="text-[10px] text-slate-400">20-25m each</span>
                  </div>

                  <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700">
                    <span className="text-[10px] text-slate-400">Air Breaks</span>
                    <div className="text-xl font-bold text-white">{tableProfile.airBreaksMinutes} mins</div>
                    <span className="text-[10px] text-amber-400">CNS safeguard</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Chamber Operational Directives</span>
                  {tableProfile.chamberOperationalRules.map((rule, i) => (
                    <div key={i} className="text-xs text-slate-300 flex items-start gap-2">
                      <span className="text-cyan-400 font-bold">•</span>
                      <span>{rule}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: OXYGEN TOXICITY */}
      {activeTab === 'toxicity' && (
        <div className="space-y-6">
          {hasTwitching && (
            <div className="p-5 bg-red-950/90 border-2 border-red-500 rounded-2xl text-red-200 flex items-center gap-4 animate-pulse">
              <Zap className="w-10 h-10 text-red-400 flex-shrink-0" />
              <div>
                <h4 className="text-lg font-black tracking-wide">
                  CRITICAL CNS OXYGEN TOXICITY WATCHDOG: FACIAL TWITCHING DETECTED
                </h4>
                <p className="text-sm">
                  Remove 100% O2 mask/hood immediately. Switch to chamber ambient air.
                  <strong> STRICT LOCKOUT: DO NOT DECOMPRESS OR ASCEND DURING ACTIVE CONVULSION</strong> (Fatal pulmonary barotrauma / massive AGE risk).
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <Timer className="w-5 h-5 text-cyan-400" />
                Hyperbaric Exposure Parameters
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Dive Duration (minutes)</span>
                    <span className="font-bold text-white">{diveDurationMinutes} mins</span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="300"
                    step="15"
                    value={diveDurationMinutes}
                    onChange={e => setDiveDurationMinutes(Number(e.target.value))}
                    className="w-full accent-cyan-500"
                  />
                </div>

                <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700 space-y-2">
                  <span className="font-bold text-amber-300 block mb-1">CNS Prodromal Checklist (VENTID)</span>
                  {[
                    { id: 'facial_twitching', label: 'Twitching (Lip, eyelid, facial fasciculations) -> CRITICAL' },
                    { id: 'tinnitus', label: 'Ear ringing / Tinnitus / Auditory hallucinations' },
                    { id: 'visual_tunneling', label: 'Visual disturbances / Tunnel vision' },
                    { id: 'nausea', label: 'Nausea / Epigastric malaise' },
                    { id: 'dizziness', label: 'Dizziness / Vertigo' }
                  ].map(s => (
                    <label key={s.id} className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cnsSymptoms.includes(s.id)}
                        onChange={e => {
                          if (e.target.checked) setCnsSymptoms([...cnsSymptoms, s.id]);
                          else setCnsSymptoms(cnsSymptoms.filter(x => x !== s.id));
                        }}
                        className="rounded border-slate-700 text-red-600 focus:ring-red-500 w-4 h-4"
                      />
                      <span>{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                Oxygen Toxicity Risk Metrics
              </h3>

              {toxicityAssessment && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400">Unit Pulmonary Toxic Dose (UPTD)</span>
                      <span className="text-xl font-bold text-white">{toxicityAssessment.cumulativeUptd} UPTD</span>
                    </div>
                    <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${toxicityAssessment.cumulativeUptd > 615 ? 'bg-red-500' : 'bg-cyan-500'}`}
                        style={{ width: `${Math.min((toxicityAssessment.cumulativeUptd / 615) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>Safe (0)</span>
                      <span>Warning (450)</span>
                      <span>Daily Limit (615 UPTD)</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Mandatory Actions</span>
                    {toxicityAssessment.mandatoryEmergencyActions.map((act, i) => (
                      <div key={i} className="p-2.5 bg-red-950/40 border border-red-500/40 rounded-lg text-xs text-red-200">
                        {act}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SESSIONS REGISTRY */}
      {activeTab === 'sessions' && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
          <h3 className="text-md font-bold text-white flex items-center gap-2">
            <Gauge className="w-5 h-5 text-cyan-400" />
            Hyperbaric Treatment Dive History for Patient ID {patientId}
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="p-3">Session ID</th>
                  <th className="p-3">Indication</th>
                  <th className="p-3">Treatment Table</th>
                  <th className="p-3">Max Depth</th>
                  <th className="p-3">Pressure</th>
                  <th className="p-3">Duration</th>
                  <th className="p-3">COHb Pre/Post</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {sessions.length > 0 ? (
                  sessions.map(s => (
                    <tr key={s.id} className="hover:bg-slate-800/30">
                      <td className="p-3 font-mono font-bold text-white">#{s.id}</td>
                      <td className="p-3 font-semibold text-cyan-300">{s.indication}</td>
                      <td className="p-3 font-mono">{s.treatment_table}</td>
                      <td className="p-3">{s.max_depth_fsw} fsw</td>
                      <td className="p-3">{s.pressure_ata} ATA</td>
                      <td className="p-3">{s.total_duration_minutes}m</td>
                      <td className="p-3">
                        {s.initial_cohb_percent ? `${s.initial_cohb_percent}% -> ${s.final_cohb_percent}%` : 'N/A'}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-300">
                          {s.session_status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-500">
                      No hyperbaric treatment dives recorded on file for patient ID {patientId}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default HbotSafeHub;
