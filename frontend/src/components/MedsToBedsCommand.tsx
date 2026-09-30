import React, { useState, useEffect } from 'react';
import {
  Pill,
  Truck,
  DollarSign,
  UserCheck,
  AlertOctagon,
  RefreshCw,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  X,
  Plus
} from 'lucide-react';

interface MedicationItem {
  name: string;
  dose: string;
  frequency: string;
  route?: string;
  indication?: string;
}

interface DiscrepancyItem {
  medicationName: string;
  discrepancyType: string;
  severity: string;
  clinicalRationale: string;
  suggestedAction: string;
  resolved: boolean;
}

interface FormularyItem {
  brandMedication: string;
  suggestedGeneric: string;
  brandCopayEst: number;
  genericCopayEst: number;
  monthlySavings: number;
  formularyTier: string;
}

interface ReconciliationRecord {
  id: number;
  patientId: number;
  patientName: string;
  mrn?: string;
  reconciliationType: string;
  homeMedCount: number;
  inpatientMedCount: number;
  dischargeMedCount: number;
  discrepancies: DiscrepancyItem[];
  formularyAlternatives: FormularyItem[];
  status: string;
  reviewedBy: string;
  createdAt: string;
}

interface DeliveryOrderRecord {
  id: number;
  reconciliationId: number;
  patientId: number;
  patientName: string;
  roomBed: string;
  targetDischargeTime?: string;
  deliveryStatus: 'order_placed' | 'dispensed' | 'in_transit_courier' | 'delivered_to_bedside' | 'counseling_completed';
  courierName: string;
  copayAmount: number;
  copayCollected: boolean;
  teachBackCompleted: boolean;
  medicationCount: number;
  pharmacistNotes: string;
  createdAt: string;
}

interface MedRecSummaryData {
  metrics: {
    totalReconciliations: number;
    discrepanciesFlagged: number;
    activeDeliveriesInQueue: number;
    deliveriesCompleted: number;
    teachBackSuccessRate: number;
    totalMonthlyFormularySavings: number;
    estimatedReadmissionsAverted: number;
  };
  recentReconciliations: ReconciliationRecord[];
  recentDeliveries: DeliveryOrderRecord[];
}

const PRESET_SCENARIOS = [
  {
    title: 'Post-PCI Acute Coronary Discharge',
    patientName: 'Eleanor Vance (76F)',
    patientId: 1,
    eGfr: 48,
    homeMeds: [
      { name: 'Metoprolol Succinate', dose: '50mg', frequency: 'daily', route: 'oral' },
      { name: 'Apixaban', dose: '5mg', frequency: 'BID', route: 'oral' },
      { name: 'Nexium', dose: '40mg', frequency: 'daily', route: 'oral' }
    ],
    inpatientMeds: [
      { name: 'Metoprolol Tartrate', dose: '25mg', frequency: 'BID', route: 'oral' },
      { name: 'Heparin Infusion', dose: '1000u/hr', frequency: 'IV continuous', route: 'IV' },
      { name: 'Pantoprazole', dose: '40mg', frequency: 'daily', route: 'IV' }
    ],
    dischargeMeds: [
      { name: 'Apixaban (Eliquis)', dose: '5mg', frequency: 'BID', route: 'oral' },
      { name: 'Enoxaparin', dose: '40mg', frequency: 'daily', route: 'subcutaneous' },
      { name: 'Nexium', dose: '40mg', frequency: 'daily', route: 'oral' }
    ]
  },
  {
    title: 'Heart Failure Guideline Optimization',
    patientName: 'Marcus Reynolds (68M)',
    patientId: 2,
    eGfr: 52,
    homeMeds: [
      { name: 'Carvedilol', dose: '12.5mg', frequency: 'BID', route: 'oral' },
      { name: 'Lisinopril', dose: '20mg', frequency: 'daily', route: 'oral' },
      { name: 'Furosemide', dose: '40mg', frequency: 'daily', route: 'oral' }
    ],
    inpatientMeds: [
      { name: 'IV Furosemide', dose: '80mg', frequency: 'BID', route: 'IV' },
      { name: 'Carvedilol', dose: '12.5mg', frequency: 'BID', route: 'oral' }
    ],
    dischargeMeds: [
      { name: 'Carvedilol', dose: '25mg', frequency: 'BID', route: 'oral' },
      { name: 'Losartan', dose: '50mg', frequency: 'daily', route: 'oral' },
      { name: 'Lisinopril', dose: '20mg', frequency: 'daily', route: 'oral' }, // Dual RAAS Blockade!
      { name: 'Torsemide', dose: '20mg', frequency: 'daily', route: 'oral' }
    ]
  },
  {
    title: 'Severe Renal Impairment Transition',
    patientName: 'Clara Oswald (81F)',
    patientId: 3,
    eGfr: 24,
    homeMeds: [
      { name: 'Metformin', dose: '1000mg', frequency: 'BID', route: 'oral' },
      { name: 'Gabapentin', dose: '600mg', frequency: 'TID', route: 'oral' },
      { name: 'Lipitor', dose: '40mg', frequency: 'daily', route: 'oral' }
    ],
    inpatientMeds: [
      { name: 'Insulin Glargine', dose: '14 units', frequency: 'nightly', route: 'subcutaneous' },
      { name: 'Gabapentin', dose: '100mg', frequency: 'daily', route: 'oral' }
    ],
    dischargeMeds: [
      { name: 'Metformin', dose: '1000mg', frequency: 'BID', route: 'oral' }, // Lactic Acidosis risk!
      { name: 'Gabapentin', dose: '600mg', frequency: 'TID', route: 'oral' }, // Severe renal overdose
      { name: 'Lipitor', dose: '40mg', frequency: 'daily', route: 'oral' } // Brand formulary savings
    ]
  }
];

export const MedsToBedsCommand: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'auditor' | 'courier_dispatch'>('auditor');
  const [summaryData, setSummaryData] = useState<MedRecSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);

  // Active Audit Form State
  const [selectedScenarioIdx, setSelectedScenarioIdx] = useState<number>(0);
  const [patientIdInput, setPatientIdInput] = useState<number>(1);
  const [eGfrInput, setEGfrInput] = useState<number>(48);
  const [homeMeds, setHomeMeds] = useState<MedicationItem[]>(PRESET_SCENARIOS[0].homeMeds);
  const [inpatientMeds, setInpatientMeds] = useState<MedicationItem[]>(PRESET_SCENARIOS[0].inpatientMeds);
  const [dischargeMeds, setDischargeMeds] = useState<MedicationItem[]>(PRESET_SCENARIOS[0].dischargeMeds);
  const [auditResult, setAuditResult] = useState<any | null>(null);

  // New Bedside Order Modal State
  const [showOrderModal, setShowOrderModal] = useState<boolean>(false);
  const [selectedRecId, setSelectedRecId] = useState<number | null>(null);
  const [roomBedInput, setRoomBedInput] = useState<string>('Stepdown 4W - Bed 412B');
  const [courierInput, setCourierInput] = useState<string>('Courier Marcus Bell');
  const [copayInput, setCopayInput] = useState<number>(15.00);
  const [notesInput, setNotesInput] = useState<string>('High-risk anticoagulant discharge teach-back required.');

  // Update Status Modal State
  const [showStatusModal, setShowStatusModal] = useState<boolean>(false);
  const [selectedOrder, setSelectedOrder] = useState<DeliveryOrderRecord | null>(null);
  const [newStatus, setNewStatus] = useState<string>('counseling_completed');
  const [copayCollectedCheck, setCopayCollectedCheck] = useState<boolean>(true);
  const [teachBackCheck, setTeachBackCheck] = useState<boolean>(true);
  const [statusNotes, setStatusNotes] = useState<string>('Patient demonstrated proper medication schedule and bleeding precautions.');

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/clinician/med-rec/summary');
      if (res.ok) {
        const data = await res.json();
        setSummaryData(data);
      }
    } catch (err) {
      console.error('Failed to fetch MedRec summary:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadScenario = (idx: number) => {
    setSelectedScenarioIdx(idx);
    const scen = PRESET_SCENARIOS[idx];
    setPatientIdInput(scen.patientId);
    setEGfrInput(scen.eGfr);
    setHomeMeds(scen.homeMeds);
    setInpatientMeds(scen.inpatientMeds);
    setDischargeMeds(scen.dischargeMeds);
    setAuditResult(null);
  };

  const handleRunAudit = async () => {
    try {
      setIsAuditing(true);
      const res = await fetch('/api/clinician/med-rec/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: patientIdInput,
          reconciliationType: 'inpatient_to_discharge',
          homeMedications: homeMeds,
          inpatientMedications: inpatientMeds,
          dischargeMedications: dischargeMeds,
          eGfr: eGfrInput,
          reviewedBy: 'PharmD Specialist (Autonomous MedRec Engine)'
        })
      });

      if (res.ok) {
        const result = await res.json();
        setAuditResult(result);
        fetchSummary();
      }
    } catch (err) {
      console.error('MedRec audit execution error:', err);
    } finally {
      setIsAuditing(false);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecId) return;

    try {
      const res = await fetch('/api/clinician/med-rec/delivery-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reconciliationId: selectedRecId,
          patientId: patientIdInput,
          roomBed: roomBedInput,
          courierName: courierInput,
          copayAmount: copayInput,
          medicationList: dischargeMeds,
          pharmacistNotes: notesInput
        })
      });

      if (res.ok) {
        setShowOrderModal(false);
        setActiveTab('courier_dispatch');
        fetchSummary();
      }
    } catch (err) {
      console.error('Create delivery order error:', err);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    try {
      const res = await fetch(`/api/clinician/med-rec/delivery-orders/${selectedOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryStatus: newStatus,
          copayCollected: copayCollectedCheck,
          teachBackCompleted: teachBackCheck,
          pharmacistNotes: statusNotes
        })
      });

      if (res.ok) {
        setShowStatusModal(false);
        fetchSummary();
      }
    } catch (err) {
      console.error('Update delivery order status error:', err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'counseling_completed':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1 w-fit"><ShieldCheck className="h-3 w-3" /> Bedside Delivered & Counseled</span>;
      case 'delivered_to_bedside':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-950 text-blue-300 border border-blue-800 flex items-center gap-1 w-fit"><Truck className="h-3 w-3" /> At Patient Bedside</span>;
      case 'in_transit_courier':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1 w-fit"><Truck className="h-3 w-3" /> Courier In-Transit</span>;
      case 'dispensed':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-950 text-purple-300 border border-purple-800 flex items-center gap-1 w-fit"><Pill className="h-3 w-3" /> Pharmacy Dispensed</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1 w-fit">Order Placed</span>;
    }
  };

  const metrics = summaryData?.metrics || {
    totalReconciliations: 0,
    discrepanciesFlagged: 0,
    activeDeliveriesInQueue: 0,
    deliveriesCompleted: 0,
    teachBackSuccessRate: 100,
    totalMonthlyFormularySavings: 0,
    estimatedReadmissionsAverted: 0
  };

  return (
    <div className="flex flex-col gap-6 p-6 bg-slate-950 text-slate-100 min-h-screen">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-xl bg-gradient-to-r from-teal-950 via-slate-900 to-indigo-950 border border-teal-800/40 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-teal-500/10 border border-teal-500/30 rounded-xl">
            <Pill className="h-8 w-8 text-teal-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Discharge MedRec & Meds-to-Beds Command
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/40">
                Phase 43 Enterprise
              </span>
            </div>
            <p className="text-sm text-slate-300 mt-1">
              Autonomous Discrepancy Auditing (Omission, Duplication, Renal Dosing) & Inpatient Bedside Pharmacy Delivery Tracker
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchSummary}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Total Audited</span>
          <div className="text-2xl font-extrabold text-white mt-1">{metrics.totalReconciliations}</div>
          <span className="text-[10px] text-teal-400 mt-1 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" /> 100% EHR Synced
          </span>
        </div>

        <div className="p-3.5 bg-slate-900/90 border border-amber-900/40 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-amber-400">Discrepancies Flagged</span>
          <div className="text-2xl font-extrabold text-amber-300 mt-1">{metrics.discrepanciesFlagged}</div>
          <span className="text-[10px] text-amber-400 mt-1 flex items-center gap-1">
            <AlertOctagon className="h-3 w-3" /> Omissions & Duplicates
          </span>
        </div>

        <div className="p-3.5 bg-slate-900/90 border border-blue-900/40 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-blue-400">Active Bedside Orders</span>
          <div className="text-2xl font-extrabold text-blue-300 mt-1">{metrics.activeDeliveriesInQueue}</div>
          <span className="text-[10px] text-blue-400 mt-1 flex items-center gap-1">
            <Truck className="h-3 w-3" /> In Courier Dispatch
          </span>
        </div>

        <div className="p-3.5 bg-slate-900/90 border border-emerald-900/40 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-emerald-400">Teach-Back Rate</span>
          <div className="text-2xl font-extrabold text-emerald-300 mt-1">{metrics.teachBackSuccessRate}%</div>
          <span className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
            <UserCheck className="h-3 w-3" /> High-Risk Counseling
          </span>
        </div>

        <div className="p-3.5 bg-slate-900/90 border border-indigo-900/40 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-indigo-400">Readmissions Averted</span>
          <div className="text-2xl font-extrabold text-indigo-300 mt-1">{metrics.estimatedReadmissionsAverted}</div>
          <span className="text-[10px] text-indigo-400 mt-1 flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" /> 30-Day Risk Reduction
          </span>
        </div>

        <div className="p-3.5 bg-slate-900/90 border border-teal-900/40 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-teal-400">Formulary Savings</span>
          <div className="text-2xl font-extrabold text-teal-300 mt-1">${metrics.totalMonthlyFormularySavings}</div>
          <span className="text-[10px] text-teal-400 mt-1 flex items-center gap-1">
            <DollarSign className="h-3 w-3" /> Monthly Patient Delta
          </span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab('auditor')}
          className={`pb-3 font-semibold text-sm transition flex items-center gap-2 ${
            activeTab === 'auditor'
              ? 'text-teal-400 border-b-2 border-teal-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Pill className="h-4 w-4" />
          Autonomous Discharge MedRec Auditor
        </button>
        <button
          onClick={() => setActiveTab('courier_dispatch')}
          className={`pb-3 font-semibold text-sm transition flex items-center gap-2 ${
            activeTab === 'courier_dispatch'
              ? 'text-teal-400 border-b-2 border-teal-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Truck className="h-4 w-4" />
          Meds-to-Beds Bedside Delivery Tracking
          {metrics.activeDeliveriesInQueue > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-teal-500 text-slate-950 font-bold">
              {metrics.activeDeliveriesInQueue}
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Auditor View */}
      {activeTab === 'auditor' && (
        <div className="space-y-6">
          {/* Quick Scenario Selector */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-3 block">
              Load Inpatient Discharge Scenario:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PRESET_SCENARIOS.map((scen, idx) => (
                <button
                  key={scen.title}
                  onClick={() => loadScenario(idx)}
                  className={`p-3 rounded-lg border text-left transition text-xs ${
                    selectedScenarioIdx === idx
                      ? 'bg-teal-950/60 border-teal-500 text-teal-200 shadow-md'
                      : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="font-bold text-white flex items-center justify-between">
                    <span>{scen.title}</span>
                    <Sparkles className="h-3 w-3 text-teal-400" />
                  </div>
                  <div className="mt-1 text-slate-400">Patient: {scen.patientName}</div>
                  <div className="text-[11px] text-teal-400 mt-1">eGFR: {scen.eGfr} mL/min</div>
                </button>
              ))}
            </div>
          </div>

          {/* Triple Medication Comparison Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Home Meds Column */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  Pre-Admission Home Regimen
                </h3>
                <span className="text-xs text-slate-400 font-mono">{homeMeds.length} Meds</span>
              </div>
              <div className="space-y-2">
                {homeMeds.map((med, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs">
                    <div className="font-bold text-slate-200">{med.name}</div>
                    <div className="text-slate-400 mt-0.5">{med.dose} • {med.frequency} ({med.route || 'oral'})</div>
                    {med.indication && (
                      <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                        {med.indication}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Inpatient Meds Column */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  Active Inpatient Hospital Orders
                </h3>
                <span className="text-xs text-slate-400 font-mono">{inpatientMeds.length} Meds</span>
              </div>
              <div className="space-y-2">
                {inpatientMeds.map((med, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs">
                    <div className="font-bold text-slate-200">{med.name}</div>
                    <div className="text-slate-400 mt-0.5">{med.dose} • {med.frequency} ({med.route || 'oral'})</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Proposed Discharge Orders Column */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                  Proposed Discharge Prescriptions
                </h3>
                <span className="text-xs text-slate-400 font-mono">{dischargeMeds.length} Orders</span>
              </div>
              <div className="space-y-2">
                {dischargeMeds.map((med, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs">
                    <div className="font-bold text-teal-300">{med.name}</div>
                    <div className="text-slate-400 mt-0.5">{med.dose} • {med.frequency} ({med.route || 'oral'})</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Button: Run Audit */}
          <div className="flex items-center justify-between bg-slate-900 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center gap-3 text-xs text-slate-300">
              <span>Patient ID: <strong>#{patientIdInput}</strong></span>
              <span>•</span>
              <span>Serum eGFR: <strong className="font-mono text-teal-400">{eGfrInput} mL/min/1.73m²</strong></span>
            </div>
            <button
              onClick={handleRunAudit}
              disabled={isAuditing}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs rounded-lg shadow-lg transition"
            >
              <Sparkles className="h-4 w-4" />
              {isAuditing ? 'Running MedRec Engine...' : 'Run Autonomous Discrepancy & Formulary Audit'}
            </button>
          </div>

          {/* Audit Results Presentation */}
          {auditResult && (
            <div className="space-y-4 animate-fade-in">
              {/* Discrepancies Alert List */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <AlertOctagon className="h-5 w-5 text-amber-400" />
                    <h2 className="text-base font-bold text-white">
                      MedRec Discrepancies Flagged ({auditResult.discrepancyCount})
                    </h2>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    auditResult.discrepancyCount > 0 ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  }`}>
                    {auditResult.reconciliation.status.toUpperCase()}
                  </span>
                </div>

                {auditResult.reconciliation.discrepancies.length === 0 ? (
                  <div className="p-4 bg-emerald-950/20 border border-emerald-900/40 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    No medication discrepancies detected. Regimen is 100% reconciled and safe for discharge fulfillment.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {auditResult.reconciliation.discrepancies.map((disc: DiscrepancyItem, idx: number) => (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-lg border text-xs ${
                          disc.severity === 'critical'
                            ? 'bg-rose-950/30 border-rose-800/80 text-rose-200'
                            : disc.severity === 'high'
                            ? 'bg-amber-950/30 border-amber-800/80 text-amber-200'
                            : 'bg-yellow-950/30 border-yellow-800/80 text-yellow-200'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold mb-1">
                          <span className="flex items-center gap-2">
                            <span className="uppercase text-[10px] px-1.5 py-0.2 rounded bg-black/40 border border-current font-mono">
                              {disc.discrepancyType.replace(/_/g, ' ')}
                            </span>
                            <span className="text-white">{disc.medicationName}</span>
                          </span>
                          <span className="capitalize text-[10px] px-2 py-0.5 rounded bg-black/30">
                            {disc.severity} Severity
                          </span>
                        </div>
                        <p className="mt-1 text-slate-300">{disc.clinicalRationale}</p>
                        <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between">
                          <span className="text-teal-300 font-semibold flex items-center gap-1">
                            <ArrowRight className="h-3 w-3" /> Suggested Action: {disc.suggestedAction}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Formulary Savings Card */}
              {auditResult.reconciliation.formulary_alternatives?.length > 0 && (
                <div className="bg-slate-900 border border-teal-800/40 rounded-xl p-5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-teal-400" />
                      <h3 className="text-base font-bold text-white">
                        Formulary Tier Optimization & Out-of-Pocket Savings
                      </h3>
                    </div>
                    <span className="text-xs text-teal-300 font-bold bg-teal-950 px-2.5 py-1 rounded border border-teal-800">
                      ${auditResult.savingsIdentified}/mo Savings
                    </span>
                  </div>

                  <div className="space-y-2">
                    {auditResult.reconciliation.formulary_alternatives.map((f: FormularyItem, idx: number) => (
                      <div key={idx} className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between text-xs">
                        <div>
                          <div className="text-slate-400 line-through">{f.brandMedication} (Est. ${f.brandCopayEst}/mo)</div>
                          <div className="font-bold text-teal-300 mt-0.5 flex items-center gap-1.5">
                            <ArrowRight className="h-3 w-3 text-teal-400" />
                            {f.suggestedGeneric} (Est. ${f.genericCopayEst}/mo)
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                            {f.formularyTier}
                          </span>
                          <div className="text-xs font-bold text-emerald-400 mt-1">Save ${f.monthlySavings}/mo</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dispatch Meds-to-Beds Order Button */}
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setSelectedRecId(auditResult.reconciliation.id);
                    setShowOrderModal(true);
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg transition"
                >
                  <Truck className="h-4 w-4" />
                  Order Bedside Meds-to-Beds Delivery
                </button>
              </div>
            </div>
          )}

          {/* Historical Reconciliations Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="font-bold text-sm text-slate-200 mb-3 flex items-center gap-2">
              <Pill className="h-4 w-4 text-teal-400" />
              Recent Pharmacotherapy Reconciliations
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-[11px] uppercase bg-slate-800/60 text-slate-400">
                  <tr>
                    <th className="p-2.5">ID</th>
                    <th className="p-2.5">Patient</th>
                    <th className="p-2.5">Home/Inp/Disch Meds</th>
                    <th className="p-2.5">Discrepancies</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Reviewer</th>
                    <th className="p-2.5">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {summaryData?.recentReconciliations.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-800/40">
                      <td className="p-2.5 font-mono text-slate-400">#{rec.id}</td>
                      <td className="p-2.5 font-bold text-white">{rec.patientName}</td>
                      <td className="p-2.5 text-slate-300 font-mono">
                        {rec.homeMedCount} / {rec.inpatientMedCount} / {rec.dischargeMedCount}
                      </td>
                      <td className="p-2.5">
                        {rec.discrepancies.length > 0 ? (
                          <span className="px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800 text-[11px] font-semibold">
                            {rec.discrepancies.length} Flagged
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800 text-[11px] font-semibold">
                            Reconciled
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 capitalize">{rec.status.replace(/_/g, ' ')}</td>
                      <td className="p-2.5 text-slate-400">{rec.reviewedBy}</td>
                      <td className="p-2.5 text-slate-400">
                        {new Date(rec.createdAt).toLocaleDateString()} {new Date(rec.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Courier Dispatch View */}
      {activeTab === 'courier_dispatch' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Truck className="h-5 w-5 text-teal-400" />
              Active Bedside Meds-to-Beds Dispatches ({summaryData?.recentDeliveries.length || 0})
            </h3>
            <button
              onClick={() => {
                if (summaryData?.recentReconciliations && summaryData.recentReconciliations.length > 0) {
                  setSelectedRecId(summaryData.recentReconciliations[0].id);
                  setShowOrderModal(true);
                } else {
                  alert('Please run a medication reconciliation audit first.');
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold transition shadow"
            >
              <Plus className="h-3.5 w-3.5" />
              New Bedside Order
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {summaryData?.recentDeliveries.map((order) => (
              <div
                key={order.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 hover:border-slate-700 transition"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <div className="text-base font-bold text-white">{order.patientName}</div>
                    <div className="text-xs text-teal-400 font-mono mt-0.5">{order.roomBed}</div>
                  </div>
                  {getStatusBadge(order.deliveryStatus)}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-slate-950 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Assigned Courier</span>
                    <span className="font-semibold text-slate-200">{order.courierName}</span>
                  </div>
                  <div className="p-2 bg-slate-950 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Patient Copay</span>
                    <span className="font-semibold text-emerald-400">${order.copayAmount.toFixed(2)}</span>
                    <span className="text-[10px] ml-1 text-slate-400">({order.copayCollected ? 'Collected' : 'Pending'})</span>
                  </div>
                </div>

                {/* Teach-Back Verification Status */}
                <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-300 flex items-center gap-1.5">
                    <UserCheck className="h-4 w-4 text-teal-400" />
                    High-Risk Teach-Back Counseling:
                  </span>
                  <span className={`font-bold ${order.teachBackCompleted ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {order.teachBackCompleted ? 'Verified Complete' : 'Pending Hand-off'}
                  </span>
                </div>

                {order.pharmacistNotes && (
                  <p className="text-xs text-slate-400 italic bg-slate-950/60 p-2.5 rounded border border-slate-800/80">
                    "{order.pharmacistNotes}"
                  </p>
                )}

                <div className="pt-2 border-t border-slate-800 flex justify-end">
                  <button
                    onClick={() => {
                      setSelectedOrder(order);
                      setNewStatus(order.deliveryStatus);
                      setCopayCollectedCheck(order.copayCollected);
                      setTeachBackCheck(order.teachBackCompleted);
                      setStatusNotes(order.pharmacistNotes || '');
                      setShowStatusModal(true);
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-teal-300 font-semibold text-xs rounded border border-slate-700 transition"
                  >
                    Update Delivery & Teach-Back Status
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Create Bedside Order */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Truck className="h-5 w-5 text-teal-400" />
                Dispatch Meds-to-Beds Delivery
              </h3>
              <button onClick={() => setShowOrderModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Inpatient Room & Bed Number:</label>
                <input
                  type="text"
                  value={roomBedInput}
                  onChange={(e) => setRoomBedInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  required
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Assigned Pharmacy Courier:</label>
                <input
                  type="text"
                  value={courierInput}
                  onChange={(e) => setCourierInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  required
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Total Patient Copay ($):</label>
                <input
                  type="number"
                  step="0.01"
                  value={copayInput}
                  onChange={(e) => setCopayInput(parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Pharmacist Clinical Notes & High-Risk Alerts:</label>
                <textarea
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded font-bold shadow"
                >
                  Confirm Dispatch Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Update Courier & Counseling Status */}
      {showStatusModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Truck className="h-5 w-5 text-teal-400" />
                Update Bedside Hand-Off Status
              </h3>
              <button onClick={() => setShowStatusModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateStatus} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Delivery State:</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                >
                  <option value="order_placed">1. Order Placed</option>
                  <option value="dispensed">2. Pharmacy Dispensed</option>
                  <option value="in_transit_courier">3. In-Transit Courier</option>
                  <option value="delivered_to_bedside">4. Delivered to Bedside</option>
                  <option value="counseling_completed">5. Counseling & Teach-Back Completed</option>
                </select>
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="copayCheck"
                    checked={copayCollectedCheck}
                    onChange={(e) => setCopayCollectedCheck(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-teal-500"
                  />
                  <label htmlFor="copayCheck" className="text-slate-300">
                    Patient Copay Collected (${selectedOrder.copayAmount.toFixed(2)})
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="teachBackCheck"
                    checked={teachBackCheck}
                    onChange={(e) => setTeachBackCheck(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-teal-500"
                  />
                  <label htmlFor="teachBackCheck" className="text-slate-300">
                    High-Risk Teach-Back Verified (Bleed warning, schedule adherence)
                  </label>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Pharmacist Counseling Notes:</label>
                <textarea
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded font-bold shadow"
                >
                  Save Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
