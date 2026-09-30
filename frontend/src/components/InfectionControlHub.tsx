import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Plus,
  Biohazard,
  Check,
  X
} from 'lucide-react';

interface DeviceLineRecord {
  id: number;
  patientId: number;
  sessionId?: string | null;
  deviceType: string;
  insertionDate: string;
  removalDate?: string | null;
  lineDaysCount: number;
  anatomicalSite: string;
  necessityJustification: string;
  bundleChecklist: string[];
  status: string;
  dwellTimeAlert: boolean;
  patientName?: string;
  createdAt: string;
}

interface HaiSurveillanceRecord {
  id: number;
  patientId: number;
  deviceLineId?: number | null;
  infectionType: string;
  nhsnCriteriaMet: boolean;
  identifiedOrganism: string;
  colonyCount?: string | null;
  isolationPrecautions: string;
  hacrpDomain: string;
  hacrpPenaltyRisk: string;
  infectionPreventionNotes: string;
  patientName?: string;
  createdAt: string;
}

interface InfectionSummaryData {
  activeLines: DeviceLineRecord[];
  haiEvents: HaiSurveillanceRecord[];
  metrics: {
    totalActiveLines: number;
    linesExceedingDwellLimit: number;
    confirmedHais: number;
    patientsInIsolation: number;
    hacrpSirEstimate: number;
  };
}

const TEMPLATE_LINES = [
  {
    type: 'central_venous_catheter',
    site: 'right_internal_jugular',
    days: 6,
    justification: 'Vasoactive infusion titration and central venous monitoring in septic shock',
    bundle: ['Maximal sterile barrier precautions', 'Chlorhexidine skin antisepsis', 'Dressing intact within 7 days']
  },
  {
    type: 'foley_urinary_catheter',
    site: 'urethral',
    days: 5,
    justification: 'Hourly strict urine output monitoring in acute decompensated heart failure',
    bundle: ['Aseptic insertion technique maintained', 'Catheter secured to thigh', 'Closed drainage system intact']
  },
  {
    type: 'arterial_line',
    site: 'radial_artery',
    days: 2,
    justification: 'Continuous beat-to-beat hemodynamic blood pressure monitoring',
    bundle: ['Sterile drape placed', 'Waveform transducer zeroed to phlebostatic axis']
  }
];

export const InfectionControlHub: React.FC = () => {
  const [data, setData] = useState<InfectionSummaryData | null>(null);
  const [loading, setLoading] = useState(false);

  // Line Modal State
  const [showLineModal, setShowLineModal] = useState(false);
  const [patientIdInput, setPatientIdInput] = useState('1');
  const [deviceTypeInput, setDeviceTypeInput] = useState<'central_venous_catheter' | 'foley_urinary_catheter' | 'endotracheal_tube' | 'arterial_line'>('central_venous_catheter');
  const [insertionDateInput, setInsertionDateInput] = useState(new Date().toISOString().split('T')[0]);
  const [lineDaysInput, setLineDaysInput] = useState(1);
  const [anatomicalSiteInput, setAnatomicalSiteInput] = useState('right_internal_jugular');
  const [necessityInput, setNecessityInput] = useState(TEMPLATE_LINES[0].justification);
  const [bundleChecklist] = useState<string[]>(TEMPLATE_LINES[0].bundle);

  // HAI Evaluation Modal State
  const [showHaiModal, setShowHaiModal] = useState(false);
  const [haiPatientId, setHaiPatientId] = useState('1');
  const [infectionType, setInfectionType] = useState<'CLABSI' | 'CAUTI' | 'SSI' | 'C_DIFFICILE' | 'MRSA_BACTEREMIA'>('CLABSI');
  const [organismInput, setOrganismInput] = useState('Enterococcus faecalis');
  const [colonyCountInput, setColonyCountInput] = useState('2/2 Blood Cultures Positive');
  const [feverPresent, setFeverPresent] = useState(true);
  const [signsDescription, setSignsDescription] = useState('Temperature 39.1C, chills, erythema around insertion site');

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/clinician/infection/surveillance/summary', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch (err) {
      console.error('Error fetching infection surveillance summary:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyTemplate = (tpl: typeof TEMPLATE_LINES[0]) => {
    setDeviceTypeInput(tpl.type as any);
    setAnatomicalSiteInput(tpl.site);
    setLineDaysInput(tpl.days);
    setNecessityInput(tpl.justification);
  };

  const handleCreateLine = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/clinician/infection/lines', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId: parseInt(patientIdInput, 10) || 1,
          deviceType: deviceTypeInput,
          insertionDate: insertionDateInput,
          lineDaysCount: lineDaysInput,
          anatomicalSite: anatomicalSiteInput,
          necessityJustification: necessityInput,
          bundleChecklist
        })
      });

      if (res.ok) {
        setShowLineModal(false);
        fetchSummary();
      }
    } catch (err) {
      console.error('Failed to log device line:', err);
    }
  };

  const handleEvaluateHai = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/clinician/infection/surveillance/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId: parseInt(haiPatientId, 10) || 1,
          infectionType,
          identifiedOrganism: organismInput,
          colonyCount: colonyCountInput,
          feverPresent,
          clinicalSignsDescription: signsDescription
        })
      });

      if (res.ok) {
        setShowHaiModal(false);
        fetchSummary();
      }
    } catch (err) {
      console.error('Failed to evaluate HAI:', err);
    }
  };

  const handleDiscontinueLine = async (id: number) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/clinician/infection/lines/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status: 'discontinued',
          removalDate: new Date().toISOString().split('T')[0]
        })
      });

      if (res.ok) {
        fetchSummary();
      }
    } catch (err) {
      console.error('Failed to discontinue device line:', err);
    }
  };

  const getIsolationBadge = (isolation: string) => {
    switch (isolation) {
      case 'contact_enteric_isolation':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold';
      case 'contact_isolation':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
      case 'droplet_isolation':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
      case 'airborne_isolation':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40 animate-pulse';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const metrics = data?.metrics || {
    totalActiveLines: 0,
    linesExceedingDwellLimit: 0,
    confirmedHais: 0,
    patientsInIsolation: 0,
    hacrpSirEstimate: 0.65
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-950 via-slate-900 to-emerald-950 text-white rounded-xl p-6 shadow-xl border border-teal-700/40">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                Phase 42 CDC NHSN & HACRP Hub
              </span>
              <span className="text-xs text-slate-400">CLABSI / CAUTI / SSI Surveillance & MDRO Isolation</span>
            </div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-teal-400" />
              Infection Prevention & Hospital Acquired Condition Command
            </h1>
            <p className="text-slate-300 text-sm mt-1">
              Autonomous device-day tracking, CDC NHSN infection algorithms, and automated contact isolation precautions.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowLineModal(true)}
              className="px-3.5 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition"
            >
              <Plus className="h-4 w-4" />
              Log Device Line
            </button>
            <button
              onClick={() => setShowHaiModal(true)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Biohazard className="h-4 w-4" />
              Evaluate HAI Event
            </button>
            <button
              onClick={fetchSummary}
              disabled={loading}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 border border-slate-700 transition"
              title="Refresh Surveillance Board"
            >
              <RotateCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Telemetry HUD Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6 pt-5 border-t border-slate-800">
          <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
            <div className="text-slate-400 text-xs">Active Invasive Lines</div>
            <div className="text-2xl font-bold font-mono text-white mt-0.5">{metrics.totalActiveLines}</div>
            <div className="text-[11px] text-slate-500">Under daily monitoring</div>
          </div>
          <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
            <div className="text-slate-400 text-xs">Dwell Limit Alerts</div>
            <div className="text-2xl font-bold font-mono text-amber-400 mt-0.5">
              {metrics.linesExceedingDwellLimit}
            </div>
            <div className="text-[11px] text-slate-500">Line removal suggested</div>
          </div>
          <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
            <div className="text-slate-400 text-xs">Confirmed HAIs</div>
            <div className="text-2xl font-bold font-mono text-rose-400 mt-0.5">{metrics.confirmedHais}</div>
            <div className="text-[11px] text-slate-500">CDC NHSN criteria met</div>
          </div>
          <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
            <div className="text-slate-400 text-xs">Patients in Isolation</div>
            <div className="text-2xl font-bold font-mono text-yellow-300 mt-0.5">{metrics.patientsInIsolation}</div>
            <div className="text-[11px] text-slate-500">Contact / Enteric PPE</div>
          </div>
          <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
            <div className="text-slate-400 text-xs">HACRP SIR Estimate</div>
            <div className={`text-2xl font-bold font-mono mt-0.5 ${metrics.hacrpSirEstimate > 1.0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {metrics.hacrpSirEstimate}
            </div>
            <div className="text-[11px] text-slate-500">{metrics.hacrpSirEstimate > 1.0 ? 'Penalty Risk Zone' : 'Safe Benchmark (<1.0)'}</div>
          </div>
        </div>
      </div>

      {/* Main Grid: Device Lines & Active HAI/Isolation Roster */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Invasive Lines Matrix */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-teal-400" />
                Invasive Device Line Days Matrix ({data?.activeLines.length || 0})
              </h2>
              <span className="text-xs text-slate-400">Daily Necessity Audits</span>
            </div>

            {(!data || data.activeLines.length === 0) ? (
              <div className="p-8 text-center text-slate-500 text-xs">No active invasive lines tracked.</div>
            ) : (
              <div className="space-y-3">
                {data.activeLines.map((line) => (
                  <div
                    key={line.id}
                    className={`p-3.5 rounded-lg border text-xs space-y-2.5 transition ${
                      line.dwellTimeAlert
                        ? 'bg-amber-950/20 border-amber-500/50'
                        : 'bg-slate-900/70 border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-white capitalize flex items-center gap-1.5">
                        {line.deviceType.replace(/_/g, ' ')}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider ${
                          line.dwellTimeAlert
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        }`}
                      >
                        {line.lineDaysCount} Line Days
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-slate-300 text-[11px]">
                      <div>
                        <span className="text-slate-500">Patient: </span>
                        <span className="font-semibold text-white">{line.patientName || `Patient #${line.patientId}`}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Site: </span>
                        <span className="font-mono text-cyan-300">{line.anatomicalSite.replace(/_/g, ' ')}</span>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400 italic bg-slate-950/60 p-2 rounded border border-slate-800">
                      Justification: {line.necessityJustification}
                    </div>

                    {line.dwellTimeAlert && (
                      <div className="p-2 rounded bg-amber-950/40 border border-amber-800/60 text-amber-300 text-[11px] flex items-center justify-between gap-2 font-medium">
                        <span className="flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
                          Prolonged Dwell Time: Line removal recommended to mitigate CLABSI/CAUTI.
                        </span>
                        <button
                          onClick={() => handleDiscontinueLine(line.id)}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded text-[10px] transition"
                        >
                          Discontinue
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Active HAI Surveillance & Isolation Precautions Roster */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Biohazard className="h-4 w-4 text-amber-400" />
                Active HAI Surveillance & Isolation Roster ({data?.haiEvents.length || 0})
              </h2>
              <span className="text-xs text-slate-400">CDC NHSN Diagnostic Flags</span>
            </div>

            {(!data || data.haiEvents.length === 0) ? (
              <div className="p-8 text-center text-slate-500 text-xs">No active HAI surveillance events reported.</div>
            ) : (
              <div className="space-y-3">
                {data.haiEvents.map((hai) => (
                  <div
                    key={hai.id}
                    className="p-4 bg-slate-900 border border-slate-700/80 rounded-xl text-xs space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold">
                        <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 uppercase">
                          {hai.infectionType}
                        </span>
                        <span className="text-white text-xs">{hai.identifiedOrganism}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono border uppercase tracking-wider ${getIsolationBadge(hai.isolationPrecautions)}`}>
                        {hai.isolationPrecautions.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                      <span>Patient: <span className="text-white font-medium">{hai.patientName || `Patient #${hai.patientId}`}</span></span>
                      {hai.colonyCount && (
                        <span className="font-mono text-slate-300">{hai.colonyCount}</span>
                      )}
                    </div>

                    <div className="bg-slate-950/80 p-2.5 rounded border border-slate-800 text-slate-300 text-[11px] leading-relaxed">
                      {hai.infectionPreventionNotes}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px] text-slate-400 font-mono">
                      <span>NHSN Validated: {hai.nhsnCriteriaMet ? 'YES (Reportable)' : 'NO'}</span>
                      <span className="text-rose-400 font-bold uppercase">{hai.hacrpPenaltyRisk.replace(/_/g, ' ')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Log Invasive Line */}
      {showLineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-teal-400" />
                Log Invasive Device Line Placement
              </h3>
              <button onClick={() => setShowLineModal(false)} className="text-slate-400 hover:text-white text-lg font-bold">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Templates */}
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2 block">
                Quick Line Profiles:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {TEMPLATE_LINES.map((tpl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleApplyTemplate(tpl)}
                    className="p-2 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-teal-500 rounded text-left text-xs text-slate-200 transition"
                  >
                    <div className="font-semibold text-teal-300 flex items-center gap-1 capitalize">
                      <Sparkles className="h-3 w-3" />
                      {tpl.type.split('_')[0]}
                    </div>
                    <div className="text-[10px] text-slate-400">{tpl.days} Days</div>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreateLine} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Patient ID:</label>
                  <input
                    type="number"
                    value={patientIdInput}
                    onChange={(e) => setPatientIdInput(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Device Type:</label>
                  <select
                    value={deviceTypeInput}
                    onChange={(e) => setDeviceTypeInput(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  >
                    <option value="central_venous_catheter">Central Venous Catheter (CVC)</option>
                    <option value="foley_urinary_catheter">Indwelling Foley Catheter</option>
                    <option value="endotracheal_tube">Endotracheal Tube (ETT)</option>
                    <option value="arterial_line">Arterial Catheter</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Insertion Date:</label>
                  <input
                    type="date"
                    value={insertionDateInput}
                    onChange={(e) => setInsertionDateInput(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Elapsed Line Days:</label>
                  <input
                    type="number"
                    min="1"
                    value={lineDaysInput}
                    onChange={(e) => setLineDaysInput(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Anatomical Insertion Site:</label>
                <input
                  type="text"
                  value={anatomicalSiteInput}
                  onChange={(e) => setAnatomicalSiteInput(e.target.value)}
                  placeholder="e.g. right_internal_jugular, subclavian, femoral, urethral"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Clinical Necessity Justification:</label>
                <textarea
                  value={necessityInput}
                  onChange={(e) => setNecessityInput(e.target.value)}
                  rows={2}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowLineModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded font-bold shadow"
                >
                  Save Device Line
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Evaluate HAI Surveillance Event */}
      {showHaiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Biohazard className="h-5 w-5 text-amber-400" />
                Evaluate HAI & Isolation Precautions (CDC NHSN)
              </h3>
              <button onClick={() => setShowHaiModal(false)} className="text-slate-400 hover:text-white text-lg font-bold">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEvaluateHai} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Patient ID:</label>
                  <input
                    type="number"
                    value={haiPatientId}
                    onChange={(e) => setHaiPatientId(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Suspected HAI Type:</label>
                  <select
                    value={infectionType}
                    onChange={(e) => setInfectionType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  >
                    <option value="CLABSI">CLABSI (Central Line Bloodstream)</option>
                    <option value="CAUTI">CAUTI (Catheter Urinary Tract)</option>
                    <option value="SSI">SSI (Surgical Site Infection)</option>
                    <option value="C_DIFFICILE">C. difficile (LabID Colitis)</option>
                    <option value="MRSA_BACTEREMIA">MRSA Bacteremia</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Identified Pathogen / PCR Result:</label>
                <input
                  type="text"
                  value={organismInput}
                  onChange={(e) => setOrganismInput(e.target.value)}
                  placeholder="e.g. Clostridioides difficile, MRSA, Enterococcus faecalis"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Colony Count / Bottle Positivity:</label>
                  <input
                    type="text"
                    value={colonyCountInput}
                    onChange={(e) => setColonyCountInput(e.target.value)}
                    placeholder="e.g. 2/2 Blood Bottles, >=10^5 CFU/mL"
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono"
                  />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="feverCheck"
                    checked={feverPresent}
                    onChange={(e) => setFeverPresent(e.target.checked)}
                    className="accent-amber-500"
                  />
                  <label htmlFor="feverCheck" className="text-slate-300">
                    Fever Present (&gt;38.0°C)
                  </label>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Clinical Signs & Infection Narrative:</label>
                <textarea
                  value={signsDescription}
                  onChange={(e) => setSignsDescription(e.target.value)}
                  rows={2}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowHaiModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-slate-950 rounded font-bold shadow"
                >
                  <Check className="h-4 w-4 inline mr-1" />
                  Evaluate HAI & Trigger Isolation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
