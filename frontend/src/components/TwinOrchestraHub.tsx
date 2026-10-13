import React, { useState, useEffect } from 'react';

interface HospitalUnit {
  id: number;
  unit_name: string;
  unit_type: 'ED' | 'ICU' | 'STEPDOWN' | 'MEDSURG' | 'PACU' | 'OR';
  total_beds: number;
  occupied_beds: number;
  staffed_nurses: number;
  target_nurse_to_patient_ratio: number;
  pending_admissions: number;
  pending_discharges: number;
  diversion_status: boolean;
  surge_capacity_available: number;
  occupancy_rate_percent?: number;
  effective_capacity?: number;
  staffing_deficit?: number;
}

interface ErlangCMetric {
  traffic_intensity: number;
  utilization: number;
  probability_of_delay: number;
  average_wait_hours: number;
}

interface SimulationResult {
  scenario_name: string;
  ed_arrival_rate_per_hr: number;
  icu_stepdown_transfer_rate: number;
  or_addon_surgeries_count: number;
  simulation_duration_hours: number;
  projected_divert_hours: number;
  predicted_boarding_time_hours: number;
  bottleneck_unit: string;
  divert_risk_probability: number;
  alert_level: string;
  erlang_c_metrics: Record<string, ErlangCMetric>;
  surgical_reallocations: {
    elective_blocks_to_defer: number;
    freed_or_minutes: number;
    recovered_icu_beds: number;
    recommended_actions: string[];
  };
  actionable_mitigations: string[];
}

export const TwinOrchestraHub: React.FC = () => {
  const [units, setUnits] = useState<HospitalUnit[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Simulation parameters
  const [scenarioName, setScenarioName] = useState<string>('Mass Casualty & Multi-Unit Boarding Surge');
  const [edArrivalRate, setEdArrivalRate] = useState<number>(14.0);
  const [icuTransferRate, setIcuTransferRate] = useState<number>(2.5);
  const [orAddons, setOrAddons] = useState<number>(5);
  const [simDuration, setSimDuration] = useState<number>(24);

  // Simulation outputs
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  // Fetch hospital units
  const fetchUnits = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/digital-twin/units');
      if (res.ok) {
        const data = await res.json();
        setUnits(data);
      }
    } catch (err: any) {
      console.error('Failed to fetch hospital units:', err);
      setStatusMessage('Error loading hospital units.');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch simulation history
  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/clinician/digital-twin/history?limit=5');
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err: any) {
      console.error('Failed to fetch history:', err);
    }
  };

  useEffect(() => {
    fetchUnits();
    fetchHistory();
  }, []);

  // Run simulation
  const handleRunSimulation = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const res = await fetch('/api/clinician/digital-twin/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario_name: scenarioName,
          ed_arrival_rate_per_hr: edArrivalRate,
          icu_stepdown_transfer_rate: icuTransferRate,
          or_addon_surgeries_count: orAddons,
          simulation_duration_hours: simDuration
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSimulationResult(data);
        setStatusMessage(`Simulation executed: ${data.scenario_name}`);
        fetchUnits();
        fetchHistory();
      } else {
        const errData = await res.json();
        setStatusMessage(`Simulation failed: ${errData.error || 'Server error'}`);
      }
    } catch (err: any) {
      console.error('Simulation error:', err);
      setStatusMessage(`Simulation error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle unit diversion status
  const handleToggleDiversion = async (unit: HospitalUnit) => {
    try {
      const res = await fetch(`/api/clinician/digital-twin/units/${unit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diversion_status: !unit.diversion_status
        })
      });
      if (res.ok) {
        fetchUnits();
        setStatusMessage(`Updated diversion status for ${unit.unit_name}`);
      }
    } catch (err: any) {
      console.error('Toggle diversion error:', err);
    }
  };

  // Helper for alert colors
  const getAlertBadge = (level: string) => {
    switch (level) {
      case 'CRITICAL_DIVERT_IMMINENT':
        return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'HIGH_SURGE':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/50';
      case 'ELEVATED':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      default:
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
    }
  };

  const getOccupancyColor = (occ?: number) => {
    if (!occ) return 'text-slate-400';
    if (occ >= 90) return 'text-red-400 font-bold';
    if (occ >= 80) return 'text-amber-400 font-semibold';
    return 'text-emerald-400';
  };

  return (
    <div className="bg-slate-900 text-slate-100 p-6 rounded-xl border border-slate-800 space-y-6 shadow-2xl">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-teal-500/20 text-teal-300 border border-teal-500/40 rounded">
              Digital Twin Operations
            </span>
            <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded">
              Phase 71
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white mt-1">
            TWIN-ORCHESTRA Hub: Hospital Operations Master Digital Twin
          </h2>
          <p className="text-xs text-slate-400">
            Erlang-C Multi-Server Queuing, Dynamic Surgical Block Reallocation, & 6-Hour Predictive ED Divert Risk
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchUnits}
            disabled={isLoading}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 transition"
          >
            Refresh Census
          </button>
          <button
            onClick={handleRunSimulation}
            disabled={isLoading}
            className="px-4 py-1.5 bg-teal-600 hover:bg-teal-500 text-white font-medium text-xs rounded shadow transition"
          >
            {isLoading ? 'Simulating...' : 'Run Digital Twin Simulation'}
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="px-4 py-2 bg-slate-800/80 border border-teal-500/30 text-teal-300 text-xs rounded flex items-center justify-between">
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage('')} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Grid: Hospital Digital Twin Census & Simulation Controller */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Real-Time Unit Digital Twin */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-teal-400">
              Live Hospital Unit Digital Twin Board
            </h3>
            <span className="text-[11px] text-slate-400">
              Active Units: {units.length}
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-medium">
                <tr>
                  <th className="py-2.5 px-3">Unit</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 text-center">Beds</th>
                  <th className="py-2.5 px-3 text-center">Occupancy</th>
                  <th className="py-2.5 px-3 text-center">Staffed Nurses</th>
                  <th className="py-2.5 px-3 text-center">Pending Adm / Disch</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/50">
                {units.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-3 font-medium text-slate-200">
                      {u.unit_name}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-mono">
                        {u.unit_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="text-slate-200 font-semibold">{u.occupied_beds}</span>
                      <span className="text-slate-500"> / {u.total_beds}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={getOccupancyColor(u.occupancy_rate_percent)}>
                        {u.occupancy_rate_percent}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-300">
                      {u.staffed_nurses}
                      <span className="text-[10px] text-slate-500 ml-1">
                        (1:{Math.round(1 / u.target_nurse_to_patient_ratio)})
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="text-amber-400">+{u.pending_admissions}</span>
                      <span className="text-slate-500"> / </span>
                      <span className="text-emerald-400">-{u.pending_discharges}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => handleToggleDiversion(u)}
                        className={`px-2 py-0.5 text-[10px] font-semibold rounded border transition ${
                          u.diversion_status
                            ? 'bg-red-500/20 text-red-400 border-red-500/50 hover:bg-red-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 hover:bg-emerald-500/30'
                        }`}
                      >
                        {u.diversion_status ? 'DIVERSION' : 'OPEN'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Quick presets for Simulation */}
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400 font-medium">Scenario Presets:</span>
            <button
              onClick={() => {
                setScenarioName('Mass Casualty & Multi-Unit Boarding Surge');
                setEdArrivalRate(15.5);
                setIcuTransferRate(3.0);
                setOrAddons(6);
              }}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-teal-300 rounded border border-slate-700 transition"
            >
              Mass Casualty Multi-Trauma
            </button>
            <button
              onClick={() => {
                setScenarioName('Winter Respiratory Epidemic (High ED Flow)');
                setEdArrivalRate(12.0);
                setIcuTransferRate(1.8);
                setOrAddons(2);
              }}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-teal-300 rounded border border-slate-700 transition"
            >
              Winter Respiratory Surge
            </button>
            <button
              onClick={() => {
                setScenarioName('Baseline Operations Cadence');
                setEdArrivalRate(6.5);
                setIcuTransferRate(1.2);
                setOrAddons(1);
              }}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-teal-300 rounded border border-slate-700 transition"
            >
              Baseline Standard Day
            </button>
          </div>
        </div>

        {/* Right Col: Simulation Parameter Controller */}
        <div className="bg-slate-800/40 p-4 rounded-lg border border-slate-700/70 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-teal-400">
            Flow Simulation Parameters
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-300 block mb-1">Scenario Title</label>
              <input
                type="text"
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>ED Arrival Rate (&lambda;)</span>
                <span className="font-mono text-teal-400">{edArrivalRate} pts/hr</span>
              </div>
              <input
                type="range"
                min="3"
                max="25"
                step="0.5"
                value={edArrivalRate}
                onChange={(e) => setEdArrivalRate(parseFloat(e.target.value))}
                className="w-full accent-teal-500"
              />
              <span className="text-[10px] text-slate-500">Poisson-distributed presentation velocity</span>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>ICU Stepdown Transfer Rate</span>
                <span className="font-mono text-teal-400">{icuTransferRate} pts/hr</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="8"
                step="0.25"
                value={icuTransferRate}
                onChange={(e) => setIcuTransferRate(parseFloat(e.target.value))}
                className="w-full accent-teal-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Emergent OR Add-On Surgeries</span>
                <span className="font-mono text-amber-400">{orAddons} cases</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={orAddons}
                onChange={(e) => setOrAddons(parseInt(e.target.value, 10))}
                className="w-full accent-amber-500"
              />
            </div>

            <div>
              <label className="text-slate-300 block mb-1">Horizon Duration (Hours)</label>
              <select
                value={simDuration}
                onChange={(e) => setSimDuration(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
              >
                <option value={12}>12 Hours (Next Shift)</option>
                <option value={24}>24 Hours (Full Cycle)</option>
                <option value={48}>48 Hours (Weekend Surge)</option>
              </select>
            </div>

            <button
              onClick={handleRunSimulation}
              disabled={isLoading}
              className="w-full py-2 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-semibold rounded shadow-md transition text-xs mt-2"
            >
              {isLoading ? 'Running Simulation...' : 'Execute Digital Twin Model'}
            </button>
          </div>
        </div>
      </div>

      {/* Simulation Results & Predictive Analytics */}
      {simulationResult && (
        <div className="space-y-4 pt-4 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-teal-400">
              Digital Twin Flow Simulation Results & Mitigations
            </h3>
            <span className={`px-2.5 py-1 text-xs font-bold rounded border ${getAlertBadge(simulationResult.alert_level)}`}>
              {simulationResult.alert_level}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700">
              <span className="text-[11px] text-slate-400 uppercase font-medium block">6-Hour Divert Risk</span>
              <span className="text-2xl font-black text-red-400">
                {Math.round(simulationResult.divert_risk_probability * 100)}%
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">
                Threshold: &gt;70% triggers regional EMS diversion
              </span>
            </div>

            <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700">
              <span className="text-[11px] text-slate-400 uppercase font-medium block">Projected Boarding Time</span>
              <span className="text-2xl font-black text-amber-400">
                {simulationResult.predicted_boarding_time_hours} hrs
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">
                Erlang-C queue wait in ED before floor placement
              </span>
            </div>

            <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700">
              <span className="text-[11px] text-slate-400 uppercase font-medium block">Primary Bottleneck</span>
              <span className="text-sm font-bold text-white block mt-1">
                {simulationResult.bottleneck_unit}
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">
                Targeted constraint for discharge velocity
              </span>
            </div>

            <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700">
              <span className="text-[11px] text-slate-400 uppercase font-medium block">Surgical Reallocation</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-black text-teal-400">
                  {simulationResult.surgical_reallocations.elective_blocks_to_defer}
                </span>
                <span className="text-xs text-slate-300">blocks deferred</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">
                Recovers {simulationResult.surgical_reallocations.recovered_icu_beds} ICU beds / {simulationResult.surgical_reallocations.freed_or_minutes} OR min
              </span>
            </div>
          </div>

          {/* Erlang-C & Surgical Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Queuing Theory Metrics */}
            <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800 space-y-2">
              <h4 className="font-semibold text-teal-300">Queuing Theory (Erlang-C Multi-Server) Metrics</h4>
              {Object.entries(simulationResult.erlang_c_metrics).map(([key, val]) => (
                <div key={key} className="bg-slate-900 p-2.5 rounded border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-300 font-medium">{key}</span>
                  <div className="text-right space-x-3">
                    <span className="text-slate-400">
                      Traffic: <strong className="text-teal-400">{val.traffic_intensity}</strong> Erlangs
                    </span>
                    <span className="text-slate-400">
                      &rho;: <strong className="text-amber-400">{Math.round(val.utilization * 100)}%</strong>
                    </span>
                    <span className="text-slate-400">
                      P(Delay): <strong className="text-red-400">{Math.round(val.probability_of_delay * 100)}%</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Actionable Operational Mitigations */}
            <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800 space-y-2">
              <h4 className="font-semibold text-teal-300">Actionable Operational Mitigations</h4>
              <ul className="space-y-1.5">
                {simulationResult.actionable_mitigations.map((mit, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-slate-300 bg-slate-900/80 p-2 rounded border border-slate-800/80">
                    <span className="text-teal-400 font-bold">#{idx + 1}</span>
                    <span>{mit}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Past Runs History */}
      {history.length > 0 && (
        <div className="space-y-2 pt-4 border-t border-slate-800 text-xs">
          <h4 className="font-semibold text-slate-400 uppercase tracking-wider">
            Recent Operations Simulation Runs
          </h4>
          <div className="overflow-x-auto rounded border border-slate-800">
            <table className="w-full text-left">
              <thead className="bg-slate-950 text-slate-500 font-medium text-[11px]">
                <tr>
                  <th className="py-2 px-3">Timestamp</th>
                  <th className="py-2 px-3">Scenario</th>
                  <th className="py-2 px-3 text-center">ED Arrival Rate</th>
                  <th className="py-2 px-3 text-center">Divert Probability</th>
                  <th className="py-2 px-3 text-center">Boarding Time</th>
                  <th className="py-2 px-3">Bottleneck</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/40 text-slate-300">
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="py-2 px-3 text-slate-500 font-mono text-[10px]">
                      {new Date(h.created_at).toLocaleTimeString()}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-200">
                      {h.scenario_name}
                    </td>
                    <td className="py-2 px-3 text-center font-mono">
                      {h.ed_arrival_rate_per_hr}/hr
                    </td>
                    <td className="py-2 px-3 text-center font-bold text-red-400">
                      {Math.round(h.divert_risk_probability * 100)}%
                    </td>
                    <td className="py-2 px-3 text-center font-mono text-amber-400">
                      {h.predicted_boarding_time_hours}h
                    </td>
                    <td className="py-2 px-3 text-slate-400">
                      {h.bottleneck_unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
