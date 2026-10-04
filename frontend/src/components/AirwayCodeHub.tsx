import React, { useState, useEffect } from 'react';
import {
  Wind,
  Zap,
  Activity,
  ShieldAlert,
  RefreshCw,
  Plus,
  XCircle,
  Sliders,
  CheckCircle2,
  SlidersHorizontal,
  Flame
} from 'lucide-react';

interface AirwayEvent {
  id: number;
  patient_id: number;
  indication: string;
  patient_weight_kg: number;
  lemon_score: number;
  lemon_details: any;
  macocha_score?: number | null;
  device_used: string;
  blade_size: string;
  bougie_used: boolean;
  ett_size_mm: number;
  ett_depth_cm: number;
  cormack_lehane_grade: number;
  attempts_count: number;
  lowest_spo2_percent: number;
  etco2_confirmed: boolean;
  cico_emergency_triggered: boolean;
  surgical_airway_performed: boolean;
  intubation_status: string;
  operator_name?: string | null;
  recorded_at: string;
}

export const AirwayCodeHub: React.FC = () => {
  const [events, setEvents] = useState<AirwayEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedEvent, setSelectedEvent] = useState<AirwayEvent | null>(null);

  // Modals
  const [showLemonModal, setShowLemonModal] = useState<boolean>(false);
  const [showRsiModal, setShowRsiModal] = useState<boolean>(false);
  const [showNewModal, setShowNewModal] = useState<boolean>(false);

  // LEMON Calculator State
  const [lookExternal, setLookExternal] = useState<boolean>(true);
  const [gap3Fingers, setGap3Fingers] = useState<boolean>(false);
  const [hyomental3Fingers, setHyomental3Fingers] = useState<boolean>(false);
  const [thyrohyoid2Fingers, setThyrohyoid2Fingers] = useState<boolean>(false);
  const [mallampati, setMallampati] = useState<1 | 2 | 3 | 4>(3);
  const [obstruction, setObstruction] = useState<boolean>(false);
  const [neckMobility, setNeckMobility] = useState<boolean>(true);
  const [lemonResult, setLemonResult] = useState<any | null>(null);

  // RSI Calculator State
  const [rsiWeight, setRsiWeight] = useState<number>(75);
  const [rsiShock, setRsiShock] = useState<boolean>(false);
  const [rsiAsthma, setRsiAsthma] = useState<boolean>(false);
  const [rsiIcp, setRsiIcp] = useState<boolean>(false);
  const [rsiSuxContra, setRsiSuxContra] = useState<boolean>(true);
  const [rsiInductionPref, setRsiInductionPref] = useState<'Etomidate' | 'Ketamine' | 'Propofol'>('Etomidate');
  const [rsiResult, setRsiResult] = useState<any | null>(null);

  // Form: New Intubation Event
  const [newPatientId, setNewPatientId] = useState<number>(1);
  const [newIndication, setNewIndication] = useState<string>('failure_oxygenation');
  const [newWeight, setNewWeight] = useState<number>(75);
  const [newDevice, setNewDevice] = useState<string>('video_laryngoscope_hyperangulated');
  const [newBlade, setNewBlade] = useState<string>('GlideScope #3');
  const [newBougie, setNewBougie] = useState<boolean>(true);
  const [newEttSize, setNewEttSize] = useState<number>(8.0);
  const [newEttDepth, setNewEttDepth] = useState<number>(23.0);
  const [newGrade, setNewGrade] = useState<number>(2);
  const [newAttempts, setNewAttempts] = useState<number>(1);
  const [newLowestSpo2, setNewLowestSpo2] = useState<number>(93);
  const [newOperator, setNewOperator] = useState<string>('Dr. Alex Cross, MD');

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/clinician/airway/events', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
        if (data.length > 0 && !selectedEvent) {
          setSelectedEvent(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch airway events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleCalculateLemon = async () => {
    try {
      const res = await fetch('/api/clinician/airway/evaluate-lemon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          lookExternallyAbnormal: lookExternal,
          interIncisorGapLessThan3Fingers: gap3Fingers,
          hyomentalDistanceLessThan3Fingers: hyomental3Fingers,
          thyrohyoidDistanceLessThan2Fingers: thyrohyoid2Fingers,
          mallampatiClass: mallampati,
          airwayObstructionPresent: obstruction,
          neckMobilityLimited: neckMobility
        })
      });
      if (res.ok) {
        const data = await res.json();
        setLemonResult(data);
      }
    } catch (err) {
      console.error('Calculate LEMON error:', err);
    }
  };

  const handleCalculateRsi = async () => {
    try {
      const res = await fetch('/api/clinician/airway/calculate-rsi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          patientWeightKg: rsiWeight,
          hemodynamicallyUnstableOrShock: rsiShock,
          severeBronchospasmOrAsthma: rsiAsthma,
          elevatedIcpOrAorticDissection: rsiIcp,
          succinylcholineContraindicated: rsiSuxContra,
          preferredInduction: rsiInductionPref
        })
      });
      if (res.ok) {
        const data = await res.json();
        setRsiResult(data);
      }
    } catch (err) {
      console.error('Calculate RSI error:', err);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/clinician/airway/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          patientId: newPatientId,
          eventData: {
            indication: newIndication,
            patientWeightKg: newWeight,
            lemonScore: 4,
            lemonDetails: { mallampati: 3 },
            deviceUsed: newDevice,
            bladeSize: newBlade,
            bougieUsed: newBougie,
            ettSizeMm: newEttSize,
            ettDepthCm: newEttDepth,
            cormackLehaneGrade: newGrade,
            attemptsCount: newAttempts,
            lowestSpo2Percent: newLowestSpo2,
            etco2Confirmed: true,
            operatorName: newOperator
          }
        })
      });
      if (res.ok) {
        setShowNewModal(false);
        fetchEvents();
      }
    } catch (err) {
      console.error('Create intubation event error:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-red-950 via-slate-900 to-indigo-950 text-white rounded-xl p-6 shadow-lg border border-red-700/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-500/20 rounded-lg border border-red-400/40">
              <Wind className="h-7 w-7 text-red-400 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">AIRWAY-CODE Hub: Emergency Airway & RSI Command</h1>
              <p className="text-xs text-red-200/80">
                Phase 57: LEMON Difficult Airway Score, MACOCHA ICU Risk, Weight-Based RSI Pharmacology & CICO Surgical Rescue
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowLemonModal(true)}
            className="px-3 py-2 bg-red-800/60 hover:bg-red-700 text-red-200 border border-red-600/50 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Activity className="h-4 w-4 text-red-300" />
            LEMON Score
          </button>
          <button
            onClick={() => setShowRsiModal(true)}
            className="px-3 py-2 bg-indigo-800/60 hover:bg-indigo-700 text-indigo-200 border border-indigo-600/50 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <SlidersHorizontal className="h-4 w-4 text-indigo-300" />
            RSI Dosing
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="px-4 py-2 bg-red-500 hover:bg-red-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 shadow transition"
          >
            <Plus className="h-4 w-4" />
            Log Intubation
          </button>
          <button
            onClick={fetchEvents}
            disabled={loading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-red-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Grid: Events List & Central Cockpit */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar: Events List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Airway Encounters</h2>
            <span className="text-xs bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full font-mono">
              {events.length} Events
            </span>
          </div>

          <div className="space-y-2 max-h-[680px] overflow-y-auto pr-1">
            {events.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-slate-300 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
                No airway intubation events logged.
              </div>
            ) : (
              events.map((ev) => {
                const isSelected = selectedEvent?.id === ev.id;
                return (
                  <div
                    key={ev.id}
                    onClick={() => setSelectedEvent(ev)}
                    className={`p-4 rounded-xl border cursor-pointer transition ${
                      isSelected
                        ? 'border-red-500 bg-red-50/50 dark:bg-red-950/20 shadow-sm ring-1 ring-red-500/50'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800">
                          LEMON: {ev.lemon_score}
                        </span>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          Pt #{ev.patient_id}
                        </span>
                      </div>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                        ev.cico_emergency_triggered
                          ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 animate-pulse font-bold'
                          : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                      }`}>
                        {ev.cico_emergency_triggered ? 'CICO Emergency!' : ev.intubation_status}
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 line-clamp-1 capitalize">
                      {ev.indication.replace(/_/g, ' ')} ({ev.patient_weight_kg} kg)
                    </p>

                    <div className="mt-3 flex items-center justify-between text-xs font-mono text-slate-500 border-t border-slate-100 dark:border-slate-800/80 pt-2">
                      <span>ETT: {ev.ett_size_mm}mm @ {ev.ett_depth_cm}cm</span>
                      <span>Grade {ev.cormack_lehane_grade}</span>
                      <span>SpO₂: {ev.lowest_spo2_percent}%</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Central Deck: Selected Airway Cockpit */}
        <div className="lg:col-span-8 space-y-6">
          {selectedEvent ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Intubation Case #{selectedEvent.id}: {selectedEvent.indication.replace(/_/g, ' ').toUpperCase()}
                    </h3>
                    <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500 font-mono">
                      Operator: {selectedEvent.operator_name || 'Staff'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Device: {selectedEvent.device_used.replace(/_/g, ' ')} ({selectedEvent.blade_size}) | Weight: {selectedEvent.patient_weight_kg} kg
                  </p>
                </div>

                {selectedEvent.etco2_confirmed ? (
                  <div className="flex items-center gap-1 px-2.5 py-1 text-xs bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold rounded-lg border border-emerald-300 dark:border-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    ETCO₂ Waveform Confirmed
                  </div>
                ) : (
                  <div className="flex items-center gap-1 px-2.5 py-1 text-xs bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 font-bold rounded-lg">
                    <ShieldAlert className="h-4 w-4" />
                    ETCO₂ Unconfirmed
                  </div>
                )}
              </div>

              {/* 4 Metrics Gauges */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">LEMON Score</span>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className={`text-2xl font-black font-mono ${selectedEvent.lemon_score >= 4 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-100'}`}>
                      {selectedEvent.lemon_score}
                    </span>
                    <span className="text-xs text-slate-500">/ 10</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    {selectedEvent.lemon_score >= 4 ? 'High Difficulty' : 'Standard Airway'}
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Glottic View</span>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400">
                      Grade {selectedEvent.cormack_lehane_grade}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">Cormack-Lehane Scale</span>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Tube Sizing</span>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-2xl font-black font-mono text-cyan-600 dark:text-cyan-400">
                      {selectedEvent.ett_size_mm}
                    </span>
                    <span className="text-xs text-slate-500">mm ETT</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">Depth: {selectedEvent.ett_depth_cm} cm at lip</span>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Lowest SpO₂</span>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className={`text-2xl font-black font-mono ${selectedEvent.lowest_spo2_percent < 85 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {selectedEvent.lowest_spo2_percent}%
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">During Intubation</span>
                </div>
              </div>

              {/* Difficult Airway & CICO Rescue Card */}
              <div className="p-4 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                    <Flame className="h-4 w-4 text-red-400" />
                    Difficult Airway &amp; CICO Rescue Protocol Watchdog
                  </h4>
                  <span className="text-xs font-mono text-slate-400">
                    Attempts: {selectedEvent.attempts_count} | Bougie: {selectedEvent.bougie_used ? 'YES' : 'NO'}
                  </span>
                </div>

                <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-semibold">Primary Device:</span>
                    <span className="font-mono text-indigo-300">{selectedEvent.device_used} ({selectedEvent.blade_size})</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-semibold">CICO Emergency Status:</span>
                    <span className={`font-mono font-bold ${selectedEvent.cico_emergency_triggered ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
                      {selectedEvent.cico_emergency_triggered ? 'CICO DECLARED (Cannot Intubate / Cannot Oxygenate)' : 'Normal Transition / Oxygenation Maintained'}
                    </span>
                  </div>
                  {selectedEvent.cico_emergency_triggered && (
                    <div className="p-2.5 bg-rose-950/50 border border-rose-600/50 rounded text-rose-200 text-xs">
                      <strong>CICO PROTOCOL:</strong> Scalpel-Bougie-Tube Cricothyroidotomy (#10 scalpel incision, bougie placement, 6.0mm cuffed ETT over bougie).
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-sm">
              Select an airway intubation event from the left or log a new procedure.
            </div>
          )}
        </div>
      </div>

      {/* MODAL: LEMON Calculator */}
      {showLemonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Activity className="h-5 w-5 text-red-500" />
                LEMON Difficult Airway Assessment
              </h3>
              <button onClick={() => setShowLemonModal(false)} className="text-slate-400 hover:text-slate-200">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lookExternal}
                    onChange={(e) => setLookExternal(e.target.checked)}
                    className="rounded text-red-600"
                  />
                  <span>Look externally: Facial trauma / beard / large tongue (+1)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gap3Fingers}
                    onChange={(e) => setGap3Fingers(e.target.checked)}
                    className="rounded text-red-600"
                  />
                  <span>Evaluate: Inter-incisor mouth gap &lt; 3 fingers (+1)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hyomental3Fingers}
                    onChange={(e) => setHyomental3Fingers(e.target.checked)}
                    className="rounded text-red-600"
                  />
                  <span>Evaluate: Hyoid-mental distance &lt; 3 fingers (+1)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={thyrohyoid2Fingers}
                    onChange={(e) => setThyrohyoid2Fingers(e.target.checked)}
                    className="rounded text-red-600"
                  />
                  <span>Evaluate: Thyroid-hyoid distance &lt; 2 fingers (+1)</span>
                </label>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Mallampati Classification</label>
                <select
                  value={mallampati}
                  onChange={(e: any) => setMallampati(Number(e.target.value) as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-semibold"
                >
                  <option value={1}>Class I: Soft palate, fauces, uvula, pillars visible (0 pts)</option>
                  <option value={2}>Class II: Soft palate, fauces, uvula visible (+1 pt)</option>
                  <option value={3}>Class III: Soft palate, base of uvula visible (+2 pts)</option>
                  <option value={4}>Class IV: Hard palate only visible (+3 pts)</option>
                </select>
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={obstruction}
                    onChange={(e) => setObstruction(e.target.checked)}
                    className="rounded text-red-600"
                  />
                  <span>Obstruction: Upper airway pathology / stridor (+1)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={neckMobility}
                    onChange={(e) => setNeckMobility(e.target.checked)}
                    className="rounded text-red-600"
                  />
                  <span>Neck: Limited cervical spine mobility / C-collar (+1)</span>
                </label>
              </div>

              <button
                type="button"
                onClick={handleCalculateLemon}
                className="w-full mt-2 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-xs transition"
              >
                Compute LEMON Score &amp; Equipment Strategy
              </button>

              {lemonResult && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-lg border border-red-300 dark:border-red-800 text-red-900 dark:text-red-200 space-y-2">
                  <div className="flex items-center justify-between font-bold">
                    <span>LEMON Score: {lemonResult.score} / 10</span>
                    <span className="text-xs bg-red-200 dark:bg-red-900 px-2 py-0.5 rounded">
                      {lemonResult.difficultyTier}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-[11px] block mb-1">Recommended Airway Setup:</span>
                    <ul className="text-[11px] text-red-800 dark:text-red-300 list-disc list-inside space-y-0.5">
                      {lemonResult.recommendedEquipment.map((eq: string, idx: number) => (
                        <li key={idx}>{eq}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RSI Dosing Calculator */}
      {showRsiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="h-5 w-5 text-indigo-500" />
                RSI Weight-Based Pharmacology
              </h3>
              <button onClick={() => setShowRsiModal(false)} className="text-slate-400 hover:text-slate-200">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    value={rsiWeight}
                    onChange={(e) => setRsiWeight(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Induction Choice</label>
                  <select
                    value={rsiInductionPref}
                    onChange={(e: any) => setRsiInductionPref(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-semibold"
                  >
                    <option value="Etomidate">Etomidate (0.3 mg/kg)</option>
                    <option value="Ketamine">Ketamine (1.5 mg/kg)</option>
                    <option value="Propofol">Propofol (1.5 mg/kg)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rsiShock}
                    onChange={(e) => setRsiShock(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Hemodynamically Unstable / Shock</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rsiAsthma}
                    onChange={(e) => setRsiAsthma(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Severe Bronchospasm / Asthma</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rsiIcp}
                    onChange={(e) => setRsiIcp(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Elevated ICP / Aortic Dissection</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rsiSuxContra}
                    onChange={(e) => setRsiSuxContra(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Succinylcholine Contraindicated (Hyperkalemia / Burn &gt;24h)</span>
                </label>
              </div>

              <button
                type="button"
                onClick={handleCalculateRsi}
                className="w-full mt-2 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded text-xs transition"
              >
                Compute Exact Dosing &amp; Sugammadex
              </button>

              {rsiResult && (
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg border border-indigo-300 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 space-y-2">
                  <div className="font-bold border-b border-indigo-200 dark:border-indigo-800 pb-1">
                    Induction: {rsiResult.selectedInductionAgent} {rsiResult.inductionDoseMg} mg
                  </div>
                  <div className="font-bold border-b border-indigo-200 dark:border-indigo-800 pb-1">
                    Paralytic: {rsiResult.selectedParalyticAgent} {rsiResult.paralyticDoseMg} mg
                  </div>
                  <div className="text-[11px] text-indigo-800 dark:text-indigo-300">
                    <strong>Sugammadex Emergency Rescue:</strong> {rsiResult.sugammadexImmediateRescueDoseMg} mg (16 mg/kg)
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Log Intubation */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Zap className="h-5 w-5 text-red-500" />
                Log Emergency Airway Intubation
              </h3>
              <button onClick={() => setShowNewModal(false)} className="text-slate-400 hover:text-slate-200">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Patient ID</label>
                  <input
                    type="number"
                    value={newPatientId}
                    onChange={(e) => setNewPatientId(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newWeight}
                    onChange={(e) => setNewWeight(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Indication</label>
                  <select
                    value={newIndication}
                    onChange={(e) => setNewIndication(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-semibold"
                  >
                    <option value="failure_oxygenation">Failure of Oxygenation</option>
                    <option value="failure_ventilation">Failure of Ventilation</option>
                    <option value="airway_protection">Airway Protection (GCS &lt; 8)</option>
                    <option value="anticipated_course">Anticipated Clinical Deterioration</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Device Used</label>
                  <select
                    value={newDevice}
                    onChange={(e) => setNewDevice(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-semibold"
                  >
                    <option value="video_laryngoscope_hyperangulated">Hyperangulated Video Laryngoscope</option>
                    <option value="video_macintosh">Macintosh Video Laryngoscope</option>
                    <option value="direct_laryngoscope">Direct Laryngoscope</option>
                    <option value="fiberoptic">Flexible Fiberoptic Scope</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Blade Size</label>
                  <input
                    type="text"
                    value={newBlade}
                    onChange={(e) => setNewBlade(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">ETT Size (mm)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newEttSize}
                    onChange={(e) => setNewEttSize(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Depth at Lip (cm)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newEttDepth}
                    onChange={(e) => setNewEttDepth(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Glottic Grade (1-4)</label>
                  <select
                    value={newGrade}
                    onChange={(e) => setNewGrade(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs"
                  >
                    <option value={1}>Grade 1: Full glottis</option>
                    <option value={2}>Grade 2: Posterior cords</option>
                    <option value={3}>Grade 3: Epiglottis only</option>
                    <option value={4}>Grade 4: Soft palate only</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Attempts</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={newAttempts}
                    onChange={(e) => setNewAttempts(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Lowest SpO₂ (%)</label>
                  <input
                    type="number"
                    value={newLowestSpo2}
                    onChange={(e) => setNewLowestSpo2(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs font-mono"
                  />
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newBougie}
                      onChange={(e) => setNewBougie(e.target.checked)}
                      className="rounded text-red-600"
                    />
                    <span>Bougie Used</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Operator Name</label>
                <input
                  type="text"
                  value={newOperator}
                  onChange={(e) => setNewOperator(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs"
                />
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
                  className="px-4 py-2 bg-red-500 hover:bg-red-400 text-slate-950 font-bold rounded text-xs shadow"
                >
                  Record Intubation Procedure
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
