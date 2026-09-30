import React, { useState, useEffect } from 'react';
import {
  Scissors,
  CheckCircle2,
  Clock,
  RotateCcw,
  Sparkles,
  HeartPulse,
  Plus,
  Zap,
  ShieldCheck,
  X
} from 'lucide-react';

interface AnesthesiaRecord {
  id: number;
  caseId: number;
  anesthesiaType: string;
  airwayGrade: string;
  tofTwitchCount: number;
  reversalAgent?: string | null;
  eblMl: number;
  fluidsAdministeredMl: number;
  aldreteScore: number;
  ponvApfelScore: number;
  erasProtocolAdherence: string[];
  anesthesiaSummary: string;
  pacuDischargeEligible: boolean;
  createdAt: string;
}

interface SurgicalCaseRecord {
  id: number;
  patientId: number;
  sessionId?: string | null;
  procedureName: string;
  operatingRoom: string;
  primarySurgeon: string;
  anesthesiologist: string;
  asaClass: string;
  rcriScore: number;
  rcriRiskPercentage: number;
  mallampatiClass: string;
  npoStatusVerified: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  patientName?: string;
  anesthesiaRecord?: AnesthesiaRecord | null;
}

const TEMPLATE_SURGERIES = [
  {
    procedure: 'Laparoscopic Low Anterior Resection (ERAS)',
    room: 'OR-3 (General & Colorectal)',
    surgeon: 'Dr. Cynthia Hayes, MD',
    anesthesiologist: 'Dr. Chloe Kim, MD',
    asa: 'ASA_III',
    rcri: { highRiskSurgery: true, ischemicHeartDisease: false, congestiveHeartFailure: false, cerebrovascularDisease: false, insulinTherapy: false, preopCreatinineOverTwo: false },
    mallampati: 'Class_II'
  },
  {
    procedure: 'Total Knee Arthroplasty (Robotic-Assisted)',
    room: 'OR-2 (Orthopedics)',
    surgeon: 'Dr. Gregory Stone, MD',
    anesthesiologist: 'Dr. Alan Drake, MD',
    asa: 'ASA_II',
    rcri: { highRiskSurgery: false, ischemicHeartDisease: false, congestiveHeartFailure: false, cerebrovascularDisease: false, insulinTherapy: false, preopCreatinineOverTwo: false },
    mallampati: 'Class_I'
  },
  {
    procedure: 'Off-Pump Coronary Artery Bypass (OPCAB)',
    room: 'OR-1 (Cardiovascular)',
    surgeon: 'Dr. Marcus Vance, MD',
    anesthesiologist: 'Dr. Elena Rostova, MD',
    asa: 'ASA_IV',
    rcri: { highRiskSurgery: true, ischemicHeartDisease: true, congestiveHeartFailure: true, cerebrovascularDisease: false, insulinTherapy: false, preopCreatinineOverTwo: false },
    mallampati: 'Class_III'
  }
];

export const OperatingRoomHub: React.FC = () => {
  const [cases, setCases] = useState<SurgicalCaseRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCase, setSelectedCase] = useState<SurgicalCaseRecord | null>(null);

  // Booking Modal State
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [patientIdInput, setPatientIdInput] = useState('1');
  const [procedureInput, setProcedureInput] = useState(TEMPLATE_SURGERIES[0].procedure);
  const [roomInput, setRoomInput] = useState(TEMPLATE_SURGERIES[0].room);
  const [surgeonInput, setSurgeonInput] = useState(TEMPLATE_SURGERIES[0].surgeon);
  const [anesthesiologistInput, setAnesthesiologistInput] = useState(TEMPLATE_SURGERIES[0].anesthesiologist);
  const [asaClassInput, setAsaClassInput] = useState<'ASA_I' | 'ASA_II' | 'ASA_III' | 'ASA_IV' | 'ASA_V_E'>('ASA_III');
  const [rcriHighRisk, setRcriHighRisk] = useState(true);
  const [rcriIhd, setRcriIhd] = useState(false);
  const [rcriChf, setRcriChf] = useState(false);
  const [rcriCvd, setRcriCvd] = useState(false);
  const [rcriInsulin, setRcriInsulin] = useState(false);
  const [rcriCrOverTwo, setRcriCrOverTwo] = useState(false);
  const [mallampatiInput, setMallampatiInput] = useState<'Class_I' | 'Class_II' | 'Class_III' | 'Class_IV'>('Class_II');
  const [npoVerified, setNpoVerified] = useState(true);

  // Anesthesia / PACU Logging Modal State
  const [showAnesthesiaModal, setShowAnesthesiaModal] = useState(false);
  const [anesthType, setAnesthType] = useState<'general_endotracheal' | 'spinal_epidural' | 'mac_sedation' | 'regional_block'>('general_endotracheal');
  const [airwayGrade, setAirwayGrade] = useState('Grade_1');
  const [tofTwitches, setTofTwitches] = useState(4);
  const [reversalAgent, setReversalAgent] = useState('sugammadex_200mg');
  const [ebl, setEbl] = useState(100);
  const [fluids, setFluids] = useState(1500);
  const [aldrete, setAldrete] = useState(9);
  const [apfel, setApfel] = useState(1);
  const [erasItems] = useState<string[]>([
    'Preoperative carbohydrate loading drink',
    'Multimodal opioid-sparing analgesia protocol',
    'Regional nerve/fascial plane block administered',
    'Intraoperative normothermia maintenance',
    'Early post-operative mobilization orders'
  ]);
  const [anesthesiologistNotes, setAnesthesiologistNotes] = useState('');

  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/clinician/perioperative/cases', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCases(data);
        if (data.length > 0 && !selectedCase) {
          setSelectedCase(data[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching surgical cases:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyTemplate = (tpl: typeof TEMPLATE_SURGERIES[0]) => {
    setProcedureInput(tpl.procedure);
    setRoomInput(tpl.room);
    setSurgeonInput(tpl.surgeon);
    setAnesthesiologistInput(tpl.anesthesiologist);
    setAsaClassInput(tpl.asa as any);
    setRcriHighRisk(tpl.rcri.highRiskSurgery);
    setRcriIhd(tpl.rcri.ischemicHeartDisease);
    setRcriChf(tpl.rcri.congestiveHeartFailure);
    setRcriCvd(tpl.rcri.cerebrovascularDisease);
    setRcriInsulin(tpl.rcri.insulinTherapy);
    setRcriCrOverTwo(tpl.rcri.preopCreatinineOverTwo);
    setMallampatiInput(tpl.mallampati as any);
  };

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const payload = {
        patientId: parseInt(patientIdInput, 10) || 1,
        procedureName: procedureInput,
        operatingRoom: roomInput,
        primarySurgeon: surgeonInput,
        anesthesiologist: anesthesiologistInput,
        asaClass: asaClassInput,
        rcriFactors: {
          highRiskSurgery: rcriHighRisk,
          ischemicHeartDisease: rcriIhd,
          congestiveHeartFailure: rcriChf,
          cerebrovascularDisease: rcriCvd,
          insulinTherapy: rcriInsulin,
          preopCreatinineOverTwo: rcriCrOverTwo
        },
        mallampatiClass: mallampatiInput,
        npoStatusVerified: npoVerified
      };

      const res = await fetch('/api/clinician/perioperative/cases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setShowBookingModal(false);
        fetchCases();
      }
    } catch (err) {
      console.error('Failed to create surgical case:', err);
    }
  };

  const handleUpdateStatus = async (caseId: number, nextStatus: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/clinician/perioperative/cases/${caseId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });

      if (res.ok) {
        fetchCases();
        if (selectedCase?.id === caseId) {
          const updated = await res.json();
          setSelectedCase(prev => prev ? { ...prev, status: updated.status } : null);
        }
      }
    } catch (err) {
      console.error('Failed to update case status:', err);
    }
  };

  const handleRecordAnesthesia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/clinician/perioperative/cases/${selectedCase.id}/anesthesia`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          anesthesiaType: anesthType,
          airwayGrade,
          tofTwitchCount: tofTwitches,
          reversalAgent,
          eblMl: ebl,
          fluidsAdministeredMl: fluids,
          aldreteScore: aldrete,
          ponvApfelScore: apfel,
          erasAdherenceItems: erasItems,
          anesthesiologistNotes
        })
      });

      if (res.ok) {
        setShowAnesthesiaModal(false);
        fetchCases();
      }
    } catch (err) {
      console.error('Failed to log anesthesia record:', err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_or':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse';
      case 'preop_ready':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'pacu_recovery':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
      case 'discharged':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-sky-950 via-slate-900 to-indigo-950 text-white rounded-xl p-6 shadow-xl border border-sky-700/40">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                Phase 41 Perioperative & ERAS Command
              </span>
              <span className="text-xs text-slate-400">ASA Physical Status / RCRI Cardiac / Aldrete Recovery</span>
            </div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Scissors className="h-6 w-6 text-sky-400" />
              OR & Perioperative Care Command Suite
            </h1>
            <p className="text-slate-300 text-sm mt-1">
              End-to-end surgical journey tracking from pre-op risk stratification to PACU Phase II recovery discharge.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowBookingModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg transition"
            >
              <Plus className="h-4 w-4" />
              Book Surgical Case
            </button>
            <button
              onClick={fetchCases}
              disabled={loading}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 border border-slate-700 transition"
              title="Refresh OR Schedule"
            >
              <RotateCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* OR Schedule Metric Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800">
          <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
            <div className="text-slate-400 text-xs">Total Tracked Cases</div>
            <div className="text-2xl font-bold font-mono text-white mt-0.5">{cases.length}</div>
            <div className="text-[11px] text-slate-500">Across all suites</div>
          </div>
          <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
            <div className="text-slate-400 text-xs">Active In-OR</div>
            <div className="text-2xl font-bold font-mono text-amber-400 mt-0.5">
              {cases.filter(c => c.status === 'in_or').length}
            </div>
            <div className="text-[11px] text-slate-500">Under surgical anesthesia</div>
          </div>
          <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
            <div className="text-slate-400 text-xs">Pre-Op Ready</div>
            <div className="text-2xl font-bold font-mono text-sky-400 mt-0.5">
              {cases.filter(c => c.status === 'preop_ready').length}
            </div>
            <div className="text-[11px] text-slate-500">Cleared for transfer</div>
          </div>
          <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
            <div className="text-slate-400 text-xs">PACU Recovery</div>
            <div className="text-2xl font-bold font-mono text-cyan-400 mt-0.5">
              {cases.filter(c => c.status === 'pacu_recovery').length}
            </div>
            <div className="text-[11px] text-slate-500">Aldrete tracking active</div>
          </div>
        </div>
      </div>

      {/* Main Grid: OR Schedule List & Case Detail Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Operating Room Schedule */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Scissors className="h-4 w-4 text-sky-400" />
                Live Operating Room Schedule
              </h2>
              <span className="text-xs text-slate-400">{cases.length} cases booked</span>
            </div>

            <div className="space-y-3">
              {cases.map((c) => {
                const isSelected = selectedCase?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCase(c)}
                    className={`p-3.5 rounded-lg border text-xs cursor-pointer transition ${
                      isSelected
                        ? 'bg-slate-900 border-sky-500 shadow-md ring-1 ring-sky-500/50'
                        : 'bg-slate-900/60 border-slate-700/80 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold mb-1">
                      <span className="text-white flex items-center gap-1.5">
                        <span className="text-sky-300 font-mono">{c.operatingRoom}</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono border uppercase tracking-wider ${getStatusBadge(c.status)}`}>
                        {c.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="font-semibold text-slate-200 text-xs mt-1">{c.procedureName}</div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 font-mono">
                      <span>Surgeon: <span className="text-slate-300 font-sans">{c.primarySurgeon.split(',')[0]}</span></span>
                      <span className="text-amber-300 font-bold">{c.asaClass.replace('_', ' ')}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Case Clinical Dossier & Anesthesia Log */}
        <div className="lg:col-span-7 space-y-4">
          {selectedCase ? (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl space-y-6">
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-700 pb-4">
                <div>
                  <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Active Surgical Dossier</div>
                  <h3 className="text-lg font-bold text-white mt-0.5">{selectedCase.procedureName}</h3>
                  <div className="text-xs text-sky-400 font-mono mt-0.5">{selectedCase.operatingRoom}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded text-xs font-mono uppercase tracking-wider border font-bold ${getStatusBadge(selectedCase.status)}`}>
                    {selectedCase.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              {/* Patient & Surgical Team Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/80 p-3.5 rounded-lg border border-slate-700 text-xs">
                <div>
                  <span className="text-slate-400">Patient:</span>
                  <div className="font-bold text-white">{selectedCase.patientName || `Patient #${selectedCase.patientId}`}</div>
                </div>
                <div>
                  <span className="text-slate-400">Surgeon:</span>
                  <div className="text-slate-200 font-medium">{selectedCase.primarySurgeon}</div>
                </div>
                <div>
                  <span className="text-slate-400">Anesthesiologist:</span>
                  <div className="text-slate-200 font-medium">{selectedCase.anesthesiologist}</div>
                </div>
                <div>
                  <span className="text-slate-400">NPO Fasting Status:</span>
                  <div className="font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {selectedCase.npoStatusVerified ? 'Verified' : 'Pending'}
                  </div>
                </div>
              </div>

              {/* Pre-Op Risk Evaluation Cards */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <HeartPulse className="h-4 w-4 text-rose-400" />
                  Pre-Operative Risk Stratification
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
                    <span className="text-slate-400 text-xs">ASA Physical Status</span>
                    <div className="text-base font-bold text-amber-300 font-mono mt-0.5">
                      {selectedCase.asaClass.replace('_', ' ')}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Operative mortality marker</div>
                  </div>

                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
                    <span className="text-slate-400 text-xs">RCRI Cardiac Risk</span>
                    <div className="text-base font-bold text-rose-400 font-mono mt-0.5">
                      {selectedCase.rcriScore} factors ({selectedCase.rcriRiskPercentage}% risk)
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Major adverse cardiac events</div>
                  </div>

                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
                    <span className="text-slate-400 text-xs">Mallampati Airway</span>
                    <div className="text-base font-bold text-sky-300 font-mono mt-0.5">
                      {selectedCase.mallampatiClass.replace('_', ' ')}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Intubation difficulty rating</div>
                  </div>
                </div>
              </div>

              {/* Anesthesia Log & PACU Recovery Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    Intra-Op Anesthesia & PACU Aldrete Scoring
                  </h4>
                  <button
                    onClick={() => setShowAnesthesiaModal(true)}
                    className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-semibold flex items-center gap-1 transition"
                  >
                    <Zap className="h-3 w-3" />
                    Log Anesthesia & PACU
                  </button>
                </div>

                {selectedCase.anesthesiaRecord ? (
                  <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-700/80 space-y-3 text-xs">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <span className="text-slate-400">Modality:</span>
                        <div className="font-semibold text-white capitalize">
                          {selectedCase.anesthesiaRecord.anesthesiaType.replace(/_/g, ' ')}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400">TOF Recovery:</span>
                        <div className="font-mono font-bold text-emerald-400">
                          {selectedCase.anesthesiaRecord.tofTwitchCount}/4 twitches
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400">EBL / Fluids:</span>
                        <div className="font-mono text-slate-200">
                          {selectedCase.anesthesiaRecord.eblMl} mL / {selectedCase.anesthesiaRecord.fluidsAdministeredMl} mL
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400">Modified Aldrete Score:</span>
                        <div className="font-mono font-bold text-sky-400 flex items-center gap-1.5">
                          {selectedCase.anesthesiaRecord.aldreteScore}/10
                          {selectedCase.anesthesiaRecord.pacuDischargeEligible && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-sans">
                              Discharge Ready
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-950 p-2.5 rounded border border-slate-800 text-slate-300">
                      <span className="text-slate-400 font-semibold">Anesthesia Narrative: </span>
                      {selectedCase.anesthesiaRecord.anesthesiaSummary}
                    </div>

                    {/* ERAS Adherence Checklist */}
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                        ERAS Protocol Adherence Elements ({selectedCase.anesthesiaRecord.erasProtocolAdherence.length}):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedCase.anesthesiaRecord.erasProtocolAdherence.map((item, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-[11px] flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-900/40 rounded-lg border border-slate-700/60 text-center text-xs text-slate-400">
                    No anesthesia record logged yet. Click "Log Anesthesia & PACU" to document airway, TOF neuromuscular blockade, and Aldrete recovery.
                  </div>
                )}
              </div>

              {/* Lifecycle Progress Bar Buttons */}
              <div className="pt-3 border-t border-slate-700 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Advance Case Lifecycle:
                </span>
                <div className="flex items-center gap-2">
                  {selectedCase.status === 'scheduled' && (
                    <button
                      onClick={() => handleUpdateStatus(selectedCase.id, 'preop_ready')}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold"
                    >
                      Clear for OR (Pre-Op Ready)
                    </button>
                  )}
                  {selectedCase.status === 'preop_ready' && (
                    <button
                      onClick={() => handleUpdateStatus(selectedCase.id, 'in_or')}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold"
                    >
                      Patient In Operating Room
                    </button>
                  )}
                  {selectedCase.status === 'in_or' && (
                    <button
                      onClick={() => handleUpdateStatus(selectedCase.id, 'pacu_recovery')}
                      className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold"
                    >
                      Transfer to PACU Recovery
                    </button>
                  )}
                  {selectedCase.status === 'pacu_recovery' && (
                    <button
                      onClick={() => handleUpdateStatus(selectedCase.id, 'discharged')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold"
                    >
                      Discharge from PACU
                    </button>
                  )}
                  {selectedCase.status === 'discharged' && (
                    <span className="px-2.5 py-1 rounded bg-slate-700 text-slate-300 text-xs font-mono">
                      Completed & Transferred to Ward
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center text-slate-400">
              <Scissors className="h-10 w-10 mx-auto text-slate-600 mb-3" />
              <div className="text-sm font-medium text-slate-300">Select a surgical case from the schedule</div>
              <p className="text-xs text-slate-500 mt-1">Review pre-op cardiac risks, airway grading, and intra-op anesthesia recovery logs.</p>
            </div>
          )}
        </div>
      </div>

      {/* Booking Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-xl w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Scissors className="h-5 w-5 text-sky-400" />
                Book Surgical Case & Pre-Op Risk Evaluation
              </h3>
              <button
                onClick={() => setShowBookingModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Templates */}
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2 block">
                Quick Surgery Scenarios:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {TEMPLATE_SURGERIES.map((tpl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleApplyTemplate(tpl)}
                    className="p-2 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-sky-500 rounded text-left text-xs text-slate-200 transition"
                  >
                    <div className="font-semibold text-sky-300 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      {tpl.procedure.split('(')[0]}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreateCase} className="space-y-3 text-xs">
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
                  <label className="text-slate-400 block mb-1">Operating Room Suite:</label>
                  <select
                    value={roomInput}
                    onChange={(e) => setRoomInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  >
                    <option value="OR-1 (Cardiovascular)">OR-1 (Cardiovascular)</option>
                    <option value="OR-2 (Orthopedics)">OR-2 (Orthopedics)</option>
                    <option value="OR-3 (General & Colorectal)">OR-3 (General & Colorectal)</option>
                    <option value="OR-4 (Colorectal MIS)">OR-4 (Colorectal MIS)</option>
                    <option value="OR-5 (Neurotrauma)">OR-5 (Neurotrauma)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Procedure Name:</label>
                <input
                  type="text"
                  value={procedureInput}
                  onChange={(e) => setProcedureInput(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Primary Surgeon:</label>
                  <input
                    type="text"
                    value={surgeonInput}
                    onChange={(e) => setSurgeonInput(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Anesthesiologist:</label>
                  <input
                    type="text"
                    value={anesthesiologistInput}
                    onChange={(e) => setAnesthesiologistInput(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">ASA Physical Status:</label>
                  <select
                    value={asaClassInput}
                    onChange={(e) => setAsaClassInput(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  >
                    <option value="ASA_I">ASA I - Normal Healthy</option>
                    <option value="ASA_II">ASA II - Mild Systemic Disease</option>
                    <option value="ASA_III">ASA III - Severe Systemic Disease</option>
                    <option value="ASA_IV">ASA IV - Life-Threatening Disease</option>
                    <option value="ASA_V_E">ASA V-E - Moribund Emergency</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Mallampati Airway Grade:</label>
                  <select
                    value={mallampatiInput}
                    onChange={(e) => setMallampatiInput(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  >
                    <option value="Class_I">Class I - Full uvula/tonsillar pillars</option>
                    <option value="Class_II">Class II - Partial uvula visible</option>
                    <option value="Class_III">Class III - Soft palate only</option>
                    <option value="Class_IV">Class IV - Hard palate only (Difficult)</option>
                  </select>
                </div>
              </div>

              {/* RCRI Risk Factors Checklist */}
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
                <span className="text-[11px] font-semibold text-slate-300 block">
                  Revised Cardiac Risk Index (RCRI) Factors:
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <label className="flex items-center gap-1.5 text-slate-300">
                    <input type="checkbox" checked={rcriHighRisk} onChange={(e) => setRcriHighRisk(e.target.checked)} className="accent-sky-500" />
                    High-Risk Intraperitoneal/Vascular
                  </label>
                  <label className="flex items-center gap-1.5 text-slate-300">
                    <input type="checkbox" checked={rcriIhd} onChange={(e) => setRcriIhd(e.target.checked)} className="accent-sky-500" />
                    Ischemic Heart Disease
                  </label>
                  <label className="flex items-center gap-1.5 text-slate-300">
                    <input type="checkbox" checked={rcriChf} onChange={(e) => setRcriChf(e.target.checked)} className="accent-sky-500" />
                    Congestive Heart Failure
                  </label>
                  <label className="flex items-center gap-1.5 text-slate-300">
                    <input type="checkbox" checked={rcriCvd} onChange={(e) => setRcriCvd(e.target.checked)} className="accent-sky-500" />
                    Cerebrovascular Disease
                  </label>
                  <label className="flex items-center gap-1.5 text-slate-300">
                    <input type="checkbox" checked={rcriInsulin} onChange={(e) => setRcriInsulin(e.target.checked)} className="accent-sky-500" />
                    Pre-Op Insulin Therapy
                  </label>
                  <label className="flex items-center gap-1.5 text-slate-300">
                    <input type="checkbox" checked={rcriCrOverTwo} onChange={(e) => setRcriCrOverTwo(e.target.checked)} className="accent-sky-500" />
                    Creatinine &gt; 2.0 mg/dL
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="npoCheck"
                  checked={npoVerified}
                  onChange={(e) => setNpoVerified(e.target.checked)}
                  className="accent-sky-500"
                />
                <label htmlFor="npoCheck" className="text-slate-300 text-xs">
                  NPO Fasting Status Verified (Solids $\ge 8$h, Clear Liquids $\ge 2$h)
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white rounded font-bold shadow"
                >
                  Book Surgical Case
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Anesthesia & PACU Modal */}
      {showAnesthesiaModal && selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-xl w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                Intra-Op Anesthesia, TOF & PACU Recovery Logging
              </h3>
              <button
                onClick={() => setShowAnesthesiaModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleRecordAnesthesia} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Anesthesia Modality:</label>
                  <select
                    value={anesthType}
                    onChange={(e) => setAnesthType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  >
                    <option value="general_endotracheal">General Endotracheal (GETA)</option>
                    <option value="spinal_epidural">Spinal / Epidural Neuraxial</option>
                    <option value="mac_sedation">Monitored Anesthesia Care (MAC)</option>
                    <option value="regional_block">Regional Nerve Block</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Cormack-Lehane Airway Grade:</label>
                  <select
                    value={airwayGrade}
                    onChange={(e) => setAirwayGrade(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  >
                    <option value="Grade_1">Grade 1 - Full glottis visible</option>
                    <option value="Grade_2">Grade 2 - Posterior glottis only</option>
                    <option value="Grade_3">Grade 3 - Epiglottis only</option>
                    <option value="Grade_4">Grade 4 - Soft palate only</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Neuromuscular TOF Twitches (0 - 4):</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="4"
                      value={tofTwitches}
                      onChange={(e) => setTofTwitches(parseInt(e.target.value, 10))}
                      className="w-full accent-emerald-500"
                    />
                    <span className="font-mono text-emerald-400 font-bold w-8">{tofTwitches}/4</span>
                  </div>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Reversal Agent:</label>
                  <select
                    value={reversalAgent}
                    onChange={(e) => setReversalAgent(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  >
                    <option value="sugammadex_200mg">Sugammadex 200mg</option>
                    <option value="sugammadex_400mg">Sugammadex 400mg (Deep Block)</option>
                    <option value="neostigmine_glycopyrrolate">Neostigmine + Glycopyrrolate</option>
                    <option value="spontaneous">Spontaneous Recovery (No Reversal)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Estimated Blood Loss (mL):</label>
                  <input
                    type="number"
                    value={ebl}
                    onChange={(e) => setEbl(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Crystalloid/Colloid Fluids (mL):</label>
                  <input
                    type="number"
                    value={fluids}
                    onChange={(e) => setFluids(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Modified Aldrete Score (0 - 10):</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="4"
                      max="10"
                      value={aldrete}
                      onChange={(e) => setAldrete(parseInt(e.target.value, 10))}
                      className="w-full accent-sky-500"
                    />
                    <span className="font-mono text-sky-400 font-bold w-12">{aldrete}/10</span>
                  </div>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">PONV Apfel Score (0 - 4):</label>
                  <input
                    type="number"
                    min="0"
                    max="4"
                    value={apfel}
                    onChange={(e) => setApfel(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono"
                  />
                </div>
              </div>

              {/* ERAS Protocol Checklist */}
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-1">
                <span className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Active ERAS Multimodal Opioid-Sparing Checklist:
                </span>
                {erasItems.map((item, i) => (
                  <div key={i} className="text-slate-400 flex items-center gap-1.5 text-[11px]">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Anesthesiologist Clinical Summary:</label>
                <textarea
                  value={anesthesiologistNotes}
                  onChange={(e) => setAnesthesiologistNotes(e.target.value)}
                  rows={2}
                  placeholder="Extubation trajectory, hemodynamics, regional block success..."
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAnesthesiaModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded font-bold shadow"
                >
                  Save Anesthesia & PACU Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
