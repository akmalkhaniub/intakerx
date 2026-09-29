import React, { useState, useEffect } from 'react';
import {
  Building2,
  Ambulance,
  Bed,
  CheckCircle2,
  Clock,
  Send,
  RotateCcw,
  Sparkles,
  Check,
  Compass,
  Plus
} from 'lucide-react';

interface HospitalBed {
  id: number;
  facilityName: string;
  unitName: string;
  bedNumber: string;
  bedType: 'icu' | 'telemetry' | 'med_surg' | 'peds' | 'isolation' | 'burn';
  status: 'available' | 'occupied' | 'reserved_inbound' | 'cleaning';
  acuityCapabilities: string[];
  assignedPatientName?: string | null;
}

interface TransferRequestRecord {
  id: number;
  patientId: number;
  sessionId?: string | null;
  sendingFacility: string;
  receivingFacility: string;
  serviceNeeded: string;
  urgencyLevel: string;
  sendingPhysicianName: string;
  receivingPhysicianName?: string | null;
  receivingPhysicianAccepted: boolean;
  bedAssignedId?: number | null;
  transportMode: string;
  transportEtaMinutes?: number | null;
  emtalaComplianceStatus: string;
  clinicalRationale: string;
  status: string;
  createdAt: string;
  patientName?: string;
  assignedBedNumber?: string;
  assignedUnitName?: string;
}

const TEMPLATE_TRANSFERS = [
  {
    title: 'Acute LVO Stroke / Thrombectomy',
    serviceNeeded: 'neuro_interventional_stroke',
    urgencyLevel: 'stat_emergent',
    sendingFacility: 'Mercy Community Hospital ED',
    sendingPhysician: 'Dr. Robert Torres, MD',
    rationale: 'CTA shows dense left M1 occlusion. IV tenecteplase infused 20m ago. Rapidly deteriorating NIHSS 19. Emergent endovascular thrombectomy candidate.',
    transportMode: 'rotor_air_ambulance'
  },
  {
    title: 'Anterior STEMI / Emergent Cath',
    serviceNeeded: 'cardiology_cath_lab',
    urgencyLevel: 'stat_emergent',
    sendingFacility: 'Highland Regional Hospital',
    sendingPhysician: 'Dr. Alicia Gomez, MD',
    rationale: 'ECG demonstrates 4mm ST elevations V1-V4 with cardiogenic shock physiology. Needs urgent primary percutaneous coronary intervention (PCI).',
    transportMode: 'ground_als'
  },
  {
    title: 'Refractory ARDS / ECMO Resuscitation',
    serviceNeeded: 'ecmo_resuscitation',
    urgencyLevel: 'stat_emergent',
    sendingFacility: 'St. Jude General Hospital ICU',
    sendingPhysician: 'Dr. Kevin Patel, MD',
    rationale: 'Severe viral pneumonia ARDS. P/F ratio 68 on 100% FiO2 with proning. Inadequate oxygenation; requesting veno-venous ECMO cannulation and transfer.',
    transportMode: 'critical_care_transport'
  }
];

export const TransferCenterHub: React.FC = () => {
  const [beds, setBeds] = useState<HospitalBed[]>([]);
  const [transfers, setTransfers] = useState<TransferRequestRecord[]>([]);
  const [metrics, setMetrics] = useState({ total: 0, available: 0, occupied: 0, reserved: 0, occupancyPercent: 0 });
  const [loading, setLoading] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);

  // Form State for Acceptance
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [receivingPhysicianInput, setReceivingPhysicianInput] = useState('Dr. Sarah Chen, MD');

  // Form State for Dispatch
  const [dispatchingId, setDispatchingId] = useState<number | null>(null);
  const [dispatchMode, setDispatchMode] = useState('rotor_air_ambulance');
  const [dispatchEta, setDispatchEta] = useState(20);

  // New Transfer Modal State
  const [patientIdInput, setPatientIdInput] = useState('1');
  const [sendingFacilityInput, setSendingFacilityInput] = useState(TEMPLATE_TRANSFERS[0].sendingFacility);
  const [serviceNeededInput, setServiceNeededInput] = useState(TEMPLATE_TRANSFERS[0].serviceNeeded);
  const [urgencyLevelInput, setUrgencyLevelInput] = useState(TEMPLATE_TRANSFERS[0].urgencyLevel);
  const [sendingPhysicianInput, setSendingPhysicianInput] = useState(TEMPLATE_TRANSFERS[0].sendingPhysician);
  const [clinicalRationaleInput, setClinicalRationaleInput] = useState(TEMPLATE_TRANSFERS[0].rationale);
  const [transportModeInput, setTransportModeInput] = useState(TEMPLATE_TRANSFERS[0].transportMode);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const [bedsRes, transfersRes] = await Promise.all([
        fetch('/api/clinician/transfers/beds', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/clinician/transfers/requests', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (bedsRes.ok) {
        const bedData = await bedsRes.json();
        setBeds(bedData.beds || []);
        setMetrics(bedData.metrics || { total: 0, available: 0, occupied: 0, reserved: 0, occupancyPercent: 0 });
      }

      if (transfersRes.ok) {
        const transferData = await transfersRes.json();
        setTransfers(transferData || []);
      }
    } catch (err) {
      console.error('Error fetching transfer center data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyTemplate = (tpl: typeof TEMPLATE_TRANSFERS[0]) => {
    setSendingFacilityInput(tpl.sendingFacility);
    setServiceNeededInput(tpl.serviceNeeded);
    setUrgencyLevelInput(tpl.urgencyLevel);
    setSendingPhysicianInput(tpl.sendingPhysician);
    setClinicalRationaleInput(tpl.rationale);
    setTransportModeInput(tpl.transportMode);
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/clinician/transfers/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId: parseInt(patientIdInput, 10) || 1,
          sendingFacility: sendingFacilityInput,
          receivingFacility: 'Metropolitan Medical Center Comprehensive Care Hub',
          serviceNeeded: serviceNeededInput,
          urgencyLevel: urgencyLevelInput,
          sendingPhysicianName: sendingPhysicianInput,
          clinicalRationale: clinicalRationaleInput,
          transportMode: transportModeInput
        })
      });

      if (res.ok) {
        setShowRequestModal(false);
        fetchData();
      }
    } catch (err) {
      console.error('Failed to create transfer request:', err);
    }
  };

  const handleAcceptTransfer = async (id: number) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/clinician/transfers/${id}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          receivingPhysician: receivingPhysicianInput
        })
      });

      if (res.ok) {
        setAcceptingId(null);
        fetchData();
      }
    } catch (err) {
      console.error('Failed to accept transfer:', err);
    }
  };

  const handleDispatchTransport = async (id: number) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/clinician/transfers/${id}/dispatch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          transportMode: dispatchMode,
          etaMinutes: dispatchEta
        })
      });

      if (res.ok) {
        setDispatchingId(null);
        fetchData();
      }
    } catch (err) {
      console.error('Failed to dispatch transport:', err);
    }
  };

  const handleCompleteTransfer = async (id: number) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/clinician/transfers/${id}/complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Failed to complete transfer:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-cyan-950 via-slate-900 to-blue-950 text-white rounded-xl p-6 shadow-xl border border-cyan-700/40">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Phase 40 Transfer Logistics & Bed Board
              </span>
              <span className="text-xs text-slate-400">EMTALA § 1395dd Safe Harbor Compliance</span>
            </div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="h-6 w-6 text-cyan-400" />
              Inter-Facility Acute Transfer Center
            </h1>
            <p className="text-slate-300 text-sm mt-1">
              Physician-to-physician acceptance, automated ICU bed capacity matching, and emergency aeromedical transport dispatch.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowRequestModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg transition"
            >
              <Plus className="h-4 w-4" />
              New Transfer Request
            </button>
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 border border-slate-700 transition"
              title="Refresh Queue & Beds"
            >
              <RotateCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Telemetry Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800">
          <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
            <div className="text-slate-400 text-xs">Available Beds</div>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-0.5">{metrics.available}</div>
            <div className="text-[11px] text-slate-500">of {metrics.total} tracked units</div>
          </div>
          <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
            <div className="text-slate-400 text-xs">Current Occupancy</div>
            <div className="text-2xl font-bold font-mono text-cyan-400 mt-0.5">{metrics.occupancyPercent}%</div>
            <div className="text-[11px] text-slate-500">{metrics.occupied} occupied</div>
          </div>
          <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
            <div className="text-slate-400 text-xs">Reserved Inbounds</div>
            <div className="text-2xl font-bold font-mono text-blue-400 mt-0.5">{metrics.reserved}</div>
            <div className="text-[11px] text-slate-500">Awaiting arrival</div>
          </div>
          <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
            <div className="text-slate-400 text-xs">Active Transfers</div>
            <div className="text-2xl font-bold font-mono text-amber-400 mt-0.5">
              {transfers.filter(t => t.status !== 'arrived').length}
            </div>
            <div className="text-[11px] text-slate-500">In coordination pipeline</div>
          </div>
        </div>
      </div>

      {/* Main Grid: Transfer Queue & Bed Board */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Bed Inventory Matrix */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Bed className="h-4 w-4 text-cyan-400" />
                Hospital Bed Board & Capacity
              </h2>
              <span className="text-xs font-mono text-emerald-400">{metrics.available} Available</span>
            </div>

            <div className="space-y-3">
              {beds.map((b) => (
                <div
                  key={b.id}
                  className={`p-3.5 rounded-lg border text-xs transition ${
                    b.status === 'available'
                      ? 'bg-slate-900/70 border-emerald-500/40'
                      : b.status === 'reserved_inbound'
                      ? 'bg-blue-950/40 border-blue-500/50'
                      : 'bg-slate-900/40 border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold mb-1">
                    <span className="text-white flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          b.status === 'available'
                            ? 'bg-emerald-400'
                            : b.status === 'reserved_inbound'
                            ? 'bg-blue-400 animate-pulse'
                            : 'bg-slate-500'
                        }`}
                      />
                      {b.unitName} - <span className="font-mono text-cyan-300">{b.bedNumber}</span>
                    </span>
                    <span
                      className={`uppercase text-[10px] tracking-wider px-2 py-0.5 rounded font-mono ${
                        b.status === 'available'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : b.status === 'reserved_inbound'
                          ? 'bg-blue-500/20 text-blue-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {b.status.replace('_', ' ')}
                    </span>
                  </div>

                  {b.assignedPatientName && (
                    <div className="text-[11px] text-slate-300 mb-1.5 font-medium">
                      Patient: <span className="text-white">{b.assignedPatientName}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1 mt-2">
                    {b.acuityCapabilities.map((cap, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-mono">
                        {cap.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Active Transfer Request Queue */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Ambulance className="h-4 w-4 text-cyan-400" />
                Inter-Facility Transfer Pipeline ({transfers.length})
              </h2>
              <span className="text-xs text-slate-400">Real-Time Coordination</span>
            </div>

            {transfers.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No active transfer requests in pipeline. Click "New Transfer Request" to initiate.
              </div>
            ) : (
              <div className="space-y-4">
                {transfers.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 bg-slate-900 border border-slate-700/80 rounded-xl space-y-3 relative overflow-hidden"
                  >
                    {/* Top row: Urgency & Status */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded font-mono text-[10px] uppercase font-bold tracking-wider ${
                            req.urgencyLevel === 'stat_emergent'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          }`}
                        >
                          {req.urgencyLevel.replace('_', ' ')}
                        </span>
                        <span className="text-xs font-bold text-white">Transfer #{req.id}</span>
                        {req.patientName && (
                          <span className="text-xs text-slate-300 font-medium">({req.patientName})</span>
                        )}
                      </div>

                      {/* EMTALA Safe Harbor Badge */}
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 border ${
                          req.emtalaComplianceStatus === 'compliant_accepted'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        EMTALA: {req.emtalaComplianceStatus.replace('_', ' ')}
                      </span>
                    </div>

                    {/* Facility & Clinical Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                      <div>
                        <div className="text-slate-400">Sending Facility:</div>
                        <div className="text-white font-medium">{req.sendingFacility}</div>
                        <div className="text-[11px] text-slate-400 italic">Attending: {req.sendingPhysicianName}</div>
                      </div>
                      <div>
                        <div className="text-slate-400">Service Needed:</div>
                        <div className="text-cyan-300 font-semibold capitalize">
                          {req.serviceNeeded.replace(/_/g, ' ')}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Assigned Bed: {req.assignedBedNumber ? `${req.assignedBedNumber} (${req.assignedUnitName})` : 'Pending Match'}
                        </div>
                      </div>
                    </div>

                    {/* Clinical Rationale Preview */}
                    <div className="text-xs text-slate-300 bg-slate-950/40 p-2.5 rounded border border-slate-800/80">
                      <span className="text-slate-400 font-semibold">Clinical Indication: </span>
                      {req.clinicalRationale}
                    </div>

                    {/* Transport & Lifecycle Status Bar */}
                    <div className="flex flex-wrap items-center justify-between text-xs pt-1 border-t border-slate-800 gap-2">
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Compass className="h-3.5 w-3.5 text-cyan-400" />
                          <span className="capitalize">{req.transportMode.replace(/_/g, ' ')}</span>
                        </span>
                        {typeof req.transportEtaMinutes === 'number' && req.transportEtaMinutes > 0 && (
                          <span className="text-emerald-400 font-mono flex items-center gap-1 font-bold">
                            <Clock className="h-3.5 w-3.5" />
                            ETA: {req.transportEtaMinutes} mins
                          </span>
                        )}
                        <span className="text-slate-500 font-mono">Status: {req.status.replace('_', ' ')}</span>
                      </div>

                      {/* Lifecycle Action Buttons */}
                      <div className="flex items-center gap-2">
                        {req.status === 'requested' && (
                          <button
                            onClick={() => setAcceptingId(req.id)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition shadow"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Physician Accept (EMTALA)
                          </button>
                        )}

                        {req.status === 'physician_accepted' && (
                          <button
                            onClick={() => setDispatchingId(req.id)}
                            className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition shadow"
                          >
                            <Send className="h-3.5 w-3.5" />
                            Dispatch Transport
                          </button>
                        )}

                        {req.status === 'en_route' && (
                          <button
                            onClick={() => handleCompleteTransfer(req.id)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition shadow"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Confirm Patient Arrival
                          </button>
                        )}

                        {req.status === 'arrived' && (
                          <span className="px-2.5 py-0.5 rounded text-[11px] bg-slate-800 text-slate-400 font-medium">
                            Completed & Bedded
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Inline Acceptance Dialog */}
                    {acceptingId === req.id && (
                      <div className="p-3 bg-slate-950 border border-emerald-500/50 rounded-lg space-y-2 mt-2">
                        <div className="text-xs font-bold text-emerald-300">
                          Confirm Physician-to-Physician Safe Harbor Acceptance
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={receivingPhysicianInput}
                            onChange={(e) => setReceivingPhysicianInput(e.target.value)}
                            placeholder="Receiving Physician Name"
                            className="flex-1 bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
                          />
                          <button
                            onClick={() => handleAcceptTransfer(req.id)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold"
                          >
                            Confirm Accept
                          </button>
                          <button
                            onClick={() => setAcceptingId(null)}
                            className="px-2 py-1 bg-slate-800 text-slate-400 rounded text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Inline Dispatch Dialog */}
                    {dispatchingId === req.id && (
                      <div className="p-3 bg-slate-950 border border-cyan-500/50 rounded-lg space-y-2 mt-2">
                        <div className="text-xs font-bold text-cyan-300">Dispatch Aeromedical / Ground Transport</div>
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={dispatchMode}
                            onChange={(e) => setDispatchMode(e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                          >
                            <option value="rotor_air_ambulance">Rotor Air Ambulance (Medevac)</option>
                            <option value="fixed_wing_air">Fixed Wing Air Ambulance</option>
                            <option value="ground_als">Ground Advanced Life Support (ALS)</option>
                            <option value="critical_care_transport">Mobile ECMO / CCT Transport</option>
                          </select>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              value={dispatchEta}
                              onChange={(e) => setDispatchEta(parseInt(e.target.value, 10) || 15)}
                              placeholder="ETA (min)"
                              className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                            />
                            <button
                              onClick={() => handleDispatchTransport(req.id)}
                              className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-bold"
                            >
                              Dispatch
                            </button>
                            <button
                              onClick={() => setDispatchingId(null)}
                              className="px-2 py-1 bg-slate-800 text-slate-400 rounded text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: New Transfer Request */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-xl w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Ambulance className="h-5 w-5 text-cyan-400" />
                Initiate Inter-Facility Transfer Request
              </h3>
              <button
                onClick={() => setShowRequestModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Quick Templates */}
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2 block">
                Quick Clinical Scenarios:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {TEMPLATE_TRANSFERS.map((tpl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleApplyTemplate(tpl)}
                    className="p-2 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-cyan-500 rounded text-left text-xs text-slate-200 transition"
                  >
                    <div className="font-semibold text-cyan-300 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      {tpl.title}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreateTransfer} className="space-y-3 text-xs">
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
                  <label className="text-slate-400 block mb-1">Urgency Level:</label>
                  <select
                    value={urgencyLevelInput}
                    onChange={(e) => setUrgencyLevelInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  >
                    <option value="stat_emergent">STAT Emergent</option>
                    <option value="urgent_under_2hr">Urgent (&lt;2hr)</option>
                    <option value="priority_under_6hr">Priority (&lt;6hr)</option>
                    <option value="routine">Routine</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Sending Facility:</label>
                <input
                  type="text"
                  value={sendingFacilityInput}
                  onChange={(e) => setSendingFacilityInput(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Specialty Service Required:</label>
                  <select
                    value={serviceNeededInput}
                    onChange={(e) => setServiceNeededInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  >
                    <option value="neuro_interventional_stroke">Neuro-Interventional Stroke (LVO)</option>
                    <option value="cardiology_cath_lab">Interventional Cardiology / Cath Lab</option>
                    <option value="ecmo_resuscitation">ECMO Resuscitation</option>
                    <option value="burn_critical_care">Burn Critical Care</option>
                    <option value="trauma_surgery">Level 1 Trauma Surgery</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Transport Vehicle Mode:</label>
                  <select
                    value={transportModeInput}
                    onChange={(e) => setTransportModeInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  >
                    <option value="rotor_air_ambulance">Rotor Air Ambulance (Medevac)</option>
                    <option value="ground_als">Ground ALS</option>
                    <option value="critical_care_transport">Critical Care Transport</option>
                    <option value="fixed_wing_air">Fixed Wing Air</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Sending Physician Name:</label>
                <input
                  type="text"
                  value={sendingPhysicianInput}
                  onChange={(e) => setSendingPhysicianInput(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">EMTALA Clinical Rationale & Status:</label>
                <textarea
                  value={clinicalRationaleInput}
                  onChange={(e) => setClinicalRationaleInput(e.target.value)}
                  rows={3}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded font-bold shadow"
                >
                  Submit Transfer Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
