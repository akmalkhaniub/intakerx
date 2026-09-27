import React, { useState, useEffect, useCallback } from 'react';
import {
  Bed, ShieldAlert, CheckSquare, Square,
  Clock, AlertTriangle, Users, RefreshCw, Send, ShieldCheck, Activity
} from 'lucide-react';

export interface ActionItem {
  id: string;
  task: string;
  completed: boolean;
  priority: 'stat' | 'routine';
  assignee?: string;
}

export interface ContingencyPlan {
  trigger: string;
  plan: string;
}

export interface LineTubeDrain {
  type: string;
  location: string;
  insertedDate: string;
  daysInPlace: number;
  infectionRiskTier: 'low' | 'moderate' | 'high_clabsi_cauti_risk';
}

export interface IPassHandoff {
  id: number;
  patient_id: number;
  session_id?: string;
  illness_severity: 'stable' | 'watcher' | 'unstable';
  patient_summary: string;
  action_items: ActionItem[];
  contingency_plans: ContingencyPlan[];
  lines_tubes_drains: LineTubeDrain[];
  discharge_barriers: string[];
  outgoing_clinician_id?: number;
  incoming_clinician_id?: number;
  synthesis_notes?: string;
  signed_off_at?: string;
  created_at: string;
}

export interface RoundingCensus {
  censusList: any[];
  metrics: {
    totalPatients: number;
    unstableCount: number;
    watcherCount: number;
    stableCount: number;
    highRiskLinesCount: number;
  };
}

interface IpassRoundingSuiteProps {
  sessionId?: string;
  patientId?: number;
  token?: string;
  backendUrl?: string;
  patientName?: string;
}

export const IpassRoundingSuite: React.FC<IpassRoundingSuiteProps> = ({
  sessionId,
  patientId,
  token,
  backendUrl = '',
  patientName = 'Encounter Patient'
}) => {
  const [activeTab, setActiveTab] = useState<'handoff' | 'census' | 'lines_tubes'>('handoff');
  const [handoff, setHandoff] = useState<IPassHandoff | null>(null);
  const [census, setCensus] = useState<RoundingCensus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');

  // Synthesis Sign-Off Form
  const [synthesisNotes, setSynthesisNotes] = useState<string>('');
  const [isSigning, setIsSigning] = useState<boolean>(false);

  // New Handoff Form
  const [severity, setSeverity] = useState<'stable' | 'watcher' | 'unstable'>('watcher');
  const [summary, setSummary] = useState<string>('72yo F POD#2 s/p right total hip arthroplasty. Hemodynamically compensated.');
  const [newActionTask, setNewActionTask] = useState<string>('');
  const [newActionPriority, setNewActionPriority] = useState<'stat' | 'routine'>('routine');

  const fetchData = useCallback(async () => {
    if (!patientId) return;
    setIsLoading(true);
    try {
      const [handRes, censusRes] = await Promise.all([
        fetch(`${backendUrl}/api/clinician/ipass/patient/${patientId}/latest`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${backendUrl}/api/clinician/ipass/rounding/census`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (handRes.ok) {
        const data = await handRes.json();
        setHandoff(data);
      }
      if (censusRes.ok) {
        const cData = await censusRes.json();
        setCensus(cData);
      }
    } catch (err) {
      console.error('Failed to load I-PASS rounding data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [patientId, backendUrl, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleActionItem = async (itemId: string, currentStatus: boolean) => {
    if (!handoff) return;
    try {
      const res = await fetch(`${backendUrl}/api/clinician/ipass/handoffs/${handoff.id}/action-item`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          actionItemId: itemId,
          completed: !currentStatus
        })
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Error toggling action item:', err);
    }
  };

  const handleSignOffTransfer = async () => {
    if (!handoff) return;
    setIsSigning(true);
    try {
      const res = await fetch(`${backendUrl}/api/clinician/ipass/handoffs/${handoff.id}/sign-off`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          synthesisNotes: synthesisNotes.trim() || 'Synthesis completed. Read-back confirmed, contingency actions agreed.'
        })
      });
      if (res.ok) {
        setSynthesisNotes('');
        await fetchData();
        setStatusMsg('Incoming Clinician Synthesis Sign-Off Verified & Cryptographically Stamped!');
        setTimeout(() => setStatusMsg(''), 4500);
      }
    } catch (err) {
      console.error('Error signing off handoff:', err);
    } finally {
      setIsSigning(false);
    }
  };

  const handleCreateHandoff = async () => {
    if (!patientId || !summary.trim()) return;
    try {
      const res = await fetch(`${backendUrl}/api/clinician/ipass/handoffs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId,
          sessionId,
          illnessSeverity: severity,
          patientSummary: summary,
          actionItems: [
            {
              id: `act-${Date.now()}`,
              task: newActionTask || 'Confirm morning labs and physical therapy clearance',
              completed: false,
              priority: newActionPriority
            }
          ],
          contingencyPlans: [
            {
              trigger: 'If Temp >= 38.5C or HR > 105 bpm',
              plan: 'Draw blood cultures x 2 sets, send urinalysis, notify cross-cover team.'
            }
          ],
          linesTubesDrains: [
            {
              type: 'Foley Urinary Catheter',
              location: 'Urethral',
              insertedDate: '2026-09-24',
              daysInPlace: 4,
              infectionRiskTier: 'high_clabsi_cauti_risk'
            }
          ],
          dischargeBarriers: ['Physical therapy clearance', 'Discontinue Foley catheter']
        })
      });
      if (res.ok) {
        await fetchData();
        setStatusMsg('New I-PASS Handoff recorded successfully!');
        setTimeout(() => setStatusMsg(''), 4000);
      }
    } catch (err) {
      console.error('Error creating handoff:', err);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-100 shadow-xl space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
              <Bed className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold tracking-tight text-white">
              Inpatient Bedside Rounding &amp; Shift Handoff (I-PASS)
            </h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Standardized Multi-Disciplinary Handoff • Device Day Tracker (CLABSI/CAUTI) • Patient: <span className="text-amber-300 font-semibold">{patientName}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          {statusMsg}
        </div>
      )}

      {/* Census Metrics Ribbon */}
      {census && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-400">Unit Census</span>
            <div className="text-xl font-bold text-white flex items-center gap-1.5 mt-0.5">
              <Users className="w-4 h-4 text-slate-400" />
              {census.metrics.totalPatients} Beds
            </div>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-lg border border-red-500/20">
            <span className="text-xs text-red-400">Unstable</span>
            <div className="text-xl font-bold text-red-400 mt-0.5">
              {census.metrics.unstableCount}
            </div>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-lg border border-amber-500/20">
            <span className="text-xs text-amber-400">Watchers</span>
            <div className="text-xl font-bold text-amber-400 mt-0.5">
              {census.metrics.watcherCount}
            </div>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-lg border border-emerald-500/20">
            <span className="text-xs text-emerald-400">Stable</span>
            <div className="text-xl font-bold text-emerald-400 mt-0.5">
              {census.metrics.stableCount}
            </div>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-lg border border-purple-500/20">
            <span className="text-xs text-purple-400">Indwelling &gt;3d</span>
            <div className="text-xl font-bold text-purple-400 flex items-center gap-1 mt-0.5">
              <AlertTriangle className="w-4 h-4 text-purple-400" />
              {census.metrics.highRiskLinesCount} Devices
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-6 text-sm">
        <button
          onClick={() => setActiveTab('handoff')}
          className={`pb-3 font-medium transition flex items-center gap-1.5 ${activeTab === 'handoff' ? 'text-amber-400 border-b-2 border-amber-500' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <span>I-PASS Shift Handoff</span>
          {handoff && (
            <span className={`px-1.5 py-0.2 rounded-full text-xs font-bold uppercase ${
              handoff.illness_severity === 'unstable' ? 'bg-red-500/20 text-red-400' :
              handoff.illness_severity === 'watcher' ? 'bg-amber-500/20 text-amber-400' :
              'bg-emerald-500/20 text-emerald-400'
            }`}>
              {handoff.illness_severity}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('lines_tubes')}
          className={`pb-3 font-medium transition flex items-center gap-1.5 ${activeTab === 'lines_tubes' ? 'text-amber-400 border-b-2 border-amber-500' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <span>Lines, Tubes &amp; Drains</span>
          <span className="px-1.5 py-0.2 rounded-full text-xs font-bold bg-slate-800 text-slate-300">
            {handoff?.lines_tubes_drains?.length || 0}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('census')}
          className={`pb-3 font-medium transition ${activeTab === 'census' ? 'text-amber-400 border-b-2 border-amber-500' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Inpatient Unit Census Board ({census?.censusList.length || 0})
        </button>
      </div>

      {/* Tab 1: I-PASS Standardized Handoff */}
      {activeTab === 'handoff' && (
        <div className="space-y-4">
          {!handoff ? (
            <div className="bg-slate-950/60 p-6 rounded-lg border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Initiate I-PASS Transfer Protocol
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Illness Severity</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"
                  >
                    <option value="stable">Stable (Routine care, low likelihood of decompensation)</option>
                    <option value="watcher">Watcher (High risk of deterioration, frequent checks required)</option>
                    <option value="unstable">Unstable (Active decompensation / ICU transfer risk)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Key Action Item</label>
                  <input
                    type="text"
                    value={newActionTask}
                    onChange={(e) => setNewActionTask(e.target.value)}
                    placeholder="e.g. Check morning CBC/BMP and follow up chest radiograph"
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Action Priority</label>
                  <select
                    value={newActionPriority}
                    onChange={(e) => setNewActionPriority(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"
                  >
                    <option value="routine">Routine</option>
                    <option value="stat">STAT / Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Patient Summary (Brief Clinical Course)</label>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-xs text-white"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleCreateHandoff}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg text-xs transition"
                >
                  Create I-PASS Record
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Illness Severity Banner */}
              <div className={`p-4 rounded-lg border flex items-center justify-between ${
                handoff.illness_severity === 'unstable' ? 'bg-red-950/40 border-red-500/40 text-red-200' :
                handoff.illness_severity === 'watcher' ? 'bg-amber-950/40 border-amber-500/40 text-amber-200' :
                'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
              }`}>
                <div className="flex items-center gap-3">
                  <Activity className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <span className="font-bold text-xs uppercase tracking-wider">
                      I - Illness Severity: {handoff.illness_severity.toUpperCase()}
                    </span>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {handoff.illness_severity === 'unstable' ? 'High risk patient: bedside evaluation every 2h mandated.' :
                       handoff.illness_severity === 'watcher' ? 'Close clinical monitoring: contingency orders activated.' :
                       'Standard ward floor monitoring.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Patient Summary */}
              <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800 space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  P - Patient Summary
                </span>
                <p className="text-sm text-slate-200 leading-relaxed font-sans">
                  {handoff.patient_summary}
                </p>
              </div>

              {/* Action List */}
              <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>A - Action List &amp; Task Checklist</span>
                  <span className="text-xs font-normal text-slate-500">Click to toggle completion</span>
                </span>
                <div className="space-y-2">
                  {handoff.action_items.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleToggleActionItem(item.id, item.completed)}
                      className="p-2.5 rounded bg-slate-900 border border-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-800/60 transition"
                    >
                      <div className="flex items-center gap-2.5">
                        {item.completed ? (
                          <CheckSquare className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-500" />
                        )}
                        <span className={`text-xs ${item.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                          {item.task}
                        </span>
                      </div>
                      <span className={`text-xs uppercase font-bold px-2 py-0.5 rounded ${
                        item.priority === 'stat' ? 'bg-red-500/20 text-red-400' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {item.priority}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Situation Awareness & Contingency Plans */}
              <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  S - Situation Awareness &amp; Contingency Planning
                </span>
                <div className="space-y-2">
                  {handoff.contingency_plans.map((cp, idx) => (
                    <div key={idx} className="p-3 bg-slate-900 rounded border border-slate-800 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>TRIGGER: &quot;{cp.trigger}&quot;</span>
                      </div>
                      <div className="text-slate-300 pl-5">
                        <span className="text-emerald-400 font-medium">ACTION PLAN: </span>
                        {cp.plan}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Synthesis by Receiver */}
              <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>S - Synthesis by Receiver &amp; Transfer Sign-Off</span>
                  {handoff.signed_off_at && (
                    <span className="text-emerald-400 text-xs flex items-center gap-1 font-mono">
                      <Clock className="w-3.5 h-3.5" />
                      Signed: {new Date(handoff.signed_off_at).toLocaleTimeString()}
                    </span>
                  )}
                </span>

                {handoff.synthesis_notes ? (
                  <div className="p-3 bg-emerald-950/30 rounded border border-emerald-500/20 text-xs text-emerald-200">
                    <span className="font-semibold block text-emerald-400 mb-0.5">Incoming Provider Synthesis Confirmation:</span>
                    <p className="leading-relaxed text-slate-200">{handoff.synthesis_notes}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      value={synthesisNotes}
                      onChange={(e) => setSynthesisNotes(e.target.value)}
                      placeholder="Incoming clinician: Enter read-back synthesis, confirm contingency understanding, and complete transfer..."
                      rows={2}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={handleSignOffTransfer}
                        disabled={isSigning}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {isSigning ? 'Signing...' : 'Sign Off & Accept Transfer'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Lines, Tubes & Drains (LTD Tracker) */}
      {activeTab === 'lines_tubes' && (
        <div className="space-y-4">
          <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-lg text-xs text-slate-400">
            <strong className="text-white">Healthcare-Associated Infection Prevention:</strong> Indwelling devices exceeding 3 days trigger CAUTI / CLABSI reduction protocols for early discontinuation.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {handoff?.lines_tubes_drains?.map((ltd, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-lg border space-y-2 ${
                  ltd.infectionRiskTier === 'high_clabsi_cauti_risk'
                    ? 'bg-purple-950/30 border-purple-500/40'
                    : 'bg-slate-950/60 border-slate-800'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-white text-sm">{ltd.type}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">Anatomical Site: {ltd.location}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded font-mono font-bold ${
                    ltd.daysInPlace > 3 ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-slate-800 text-slate-300'
                  }`}>
                    Day {ltd.daysInPlace} in place
                  </span>
                </div>

                {ltd.infectionRiskTier === 'high_clabsi_cauti_risk' && (
                  <div className="p-2 bg-purple-900/30 rounded border border-purple-500/20 text-xs text-purple-200 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0 text-purple-400" />
                    <span>CAUTI/CLABSI Risk Alert: Evaluate daily indication for catheter removal.</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {handoff?.discharge_barriers && handoff.discharge_barriers.length > 0 && (
            <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800 space-y-2 mt-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                Identified Discharge Barriers
              </span>
              <ul className="list-disc pl-5 text-xs text-slate-300 space-y-1">
                {handoff.discharge_barriers.map((barrier, bIdx) => (
                  <li key={bIdx}>{barrier}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Census Board */}
      {activeTab === 'census' && (
        <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/40">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="p-3">Patient</th>
                <th className="p-3">Illness Severity</th>
                <th className="p-3">Clinical Summary</th>
                <th className="p-3">Action Items</th>
                <th className="p-3">Transfer Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {census?.censusList.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-900/50">
                  <td className="p-3">
                    <span className="font-bold text-white block">{row.patient_name}</span>
                    <span className="text-slate-500 text-xs">{row.sex}, {row.dob}</span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded font-bold uppercase text-xs ${
                      row.illness_severity === 'unstable' ? 'bg-red-500/20 text-red-400' :
                      row.illness_severity === 'watcher' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {row.illness_severity}
                    </span>
                  </td>
                  <td className="p-3 max-w-xs truncate text-slate-300">
                    {row.patient_summary}
                  </td>
                  <td className="p-3 font-mono">
                    {row.action_items?.length || 0} tasks
                  </td>
                  <td className="p-3">
                    {row.signed_off_at ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Signed
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Pending Read-back
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default IpassRoundingSuite;
