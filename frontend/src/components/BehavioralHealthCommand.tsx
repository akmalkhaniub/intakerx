import React, { useState, useEffect } from 'react';
import {
  Brain,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Plus,
  ShieldCheck,
  CheckCircle,
  X,
  Clock,
  Building,
  UserCheck,
  HeartHandshake
} from 'lucide-react';

interface BvcItems {
  confused: boolean;
  irritable: boolean;
  boisterous: boolean;
  physicallyThreatening: boolean;
  verballyThreatening: boolean;
  attackingObjects: boolean;
}

interface CrisisEvaluation {
  id: number;
  patientId: number;
  patientName: string;
  bvcScore: number;
  bvcItems: BvcItems;
  violenceRiskLevel: 'low' | 'moderate' | 'high_imminent';
  suicideRiskLevel: string;
  observationLevel: string;
  deEscalationProtocol: string;
  sensoryRoomUtilized: boolean;
  chemicalRestraintAdministered: boolean;
  evaluatingClinician: string;
  clinicalNarrative: string;
  createdAt: string;
}

interface InvoluntaryHold {
  id: number;
  patientId: number;
  patientName: string;
  crisisEvaluationId?: number;
  statutoryHoldType: string;
  holdCriteria: string[];
  rightsAdvisementDelivered: boolean;
  initiatedAt: string;
  expiresAt: string;
  hoursRemaining: number;
  holdStatus: string;
  initiatingClinician: string;
  destinationFacility?: string;
  bedPlacementStatus: 'searching' | 'bed_reserved' | 'transport_en_route' | 'admitted';
  createdAt: string;
}

interface BehavioralSummaryData {
  metrics: {
    activeCrises: number;
    constantObserversRequired: number;
    activeLegalHolds: number;
    bedPlacementQueue: number;
    deEscalationSuccessRate: number;
    sensoryRoomUsageCount: number;
  };
  recentEvaluations: CrisisEvaluation[];
  activeHolds: InvoluntaryHold[];
}

const PRESET_CRISIS_SCENARIOS = [
  {
    title: 'Severe Agitation & Paranoia (Code Grey Standby)',
    patientName: 'Raymond Vance (51M)',
    patientId: 1,
    bvc: {
      confused: true,
      irritable: true,
      boisterous: true,
      physicallyThreatening: false,
      verballyThreatening: true,
      attackingObjects: false
    },
    suicideRisk: 'high_active_intent' as const,
    sensoryRoom: false,
    narrative: 'Patient pacing ED hallway shouting paranoid delusions. Required 1:1 security standby and calm verbal de-escalation.'
  },
  {
    title: 'Substance-Induced Agitation Responsive to Sensory Room',
    patientName: 'Kaitlyn Ross (29F)',
    patientId: 2,
    bvc: {
      confused: true,
      irritable: true,
      boisterous: false,
      physicallyThreatening: false,
      verballyThreatening: false,
      attackingObjects: false
    },
    suicideRisk: 'low' as const,
    sensoryRoom: true,
    narrative: 'Agitation secondary to stimulant withdrawal. Offered weighted blanket and low lighting in sensory modulation room; settled within 40 mins.'
  },
  {
    title: 'Depressive Crisis with Acute Self-Harm Threat (5150 Candidate)',
    patientName: 'Derek Holloway (38M)',
    patientId: 3,
    bvc: {
      confused: false,
      irritable: false,
      boisterous: false,
      physicallyThreatening: false,
      verballyThreatening: false,
      attackingObjects: false
    },
    suicideRisk: 'high_active_intent' as const,
    sensoryRoom: false,
    narrative: 'Patient brought in by EMS with severe suicidal ideation, plan, and intent. Danger to self confirmed; voluntary admission declined.'
  }
];

export const BehavioralHealthCommand: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'evaluations' | 'holds'>('evaluations');
  const [summaryData, setSummaryData] = useState<BehavioralSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);

  // Form State for BVC Evaluation
  const [selectedScenarioIdx, setSelectedScenarioIdx] = useState<number>(0);
  const [patientIdInput, setPatientIdInput] = useState<number>(1);
  const [bvcConfused, setBvcConfused] = useState<boolean>(true);
  const [bvcIrritable, setBvcIrritable] = useState<boolean>(true);
  const [bvcBoisterous, setBvcBoisterous] = useState<boolean>(true);
  const [bvcPhysThreat, setBvcPhysThreat] = useState<boolean>(false);
  const [bvcVerbThreat, setBvcVerbThreat] = useState<boolean>(true);
  const [bvcAttacking, setBvcAttacking] = useState<boolean>(false);
  const [suicideRiskInput, setSuicideRiskInput] = useState<string>('high_active_intent');
  const [sensoryRoomInput, setSensoryRoomInput] = useState<boolean>(false);
  const [narrativeInput, setNarrativeInput] = useState<string>('Patient pacing ED hallway shouting paranoid delusions. Required 1:1 security standby and calm verbal de-escalation.');
  const [evaluatedCrisis, setEvaluatedCrisis] = useState<CrisisEvaluation | null>(null);

  // Modal State for New Hold
  const [showHoldModal, setShowHoldModal] = useState<boolean>(false);
  const [holdTypeInput, setHoldTypeInput] = useState<string>('California 5150 (72h)');
  const [criterionDts, setCriterionDts] = useState<boolean>(true);
  const [criterionDto, setCriterionDto] = useState<boolean>(true);
  const [criterionGd, setCriterionGd] = useState<boolean>(false);
  const [destinationInput, setDestinationInput] = useState<string>('Cedars-Sinai Inpatient Psychiatric Pavilion');

  // Modal State for Updating Bed Placement
  const [showPlacementModal, setShowPlacementModal] = useState<boolean>(false);
  const [selectedHold, setSelectedHold] = useState<InvoluntaryHold | null>(null);
  const [newBedStatus, setNewBedStatus] = useState<string>('bed_reserved');
  const [updatedFacility, setUpdatedFacility] = useState<string>('');

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/clinician/behavioral/summary');
      if (res.ok) {
        const data = await res.json();
        setSummaryData(data);
      }
    } catch (err) {
      console.error('Failed to fetch behavioral summary:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadScenario = (idx: number) => {
    setSelectedScenarioIdx(idx);
    const scen = PRESET_CRISIS_SCENARIOS[idx];
    setPatientIdInput(scen.patientId);
    setBvcConfused(scen.bvc.confused);
    setBvcIrritable(scen.bvc.irritable);
    setBvcBoisterous(scen.bvc.boisterous);
    setBvcPhysThreat(scen.bvc.physicallyThreatening);
    setBvcVerbThreat(scen.bvc.verballyThreatening);
    setBvcAttacking(scen.bvc.attackingObjects);
    setSuicideRiskInput(scen.suicideRisk);
    setSensoryRoomInput(scen.sensoryRoom);
    setNarrativeInput(scen.narrative);
    setEvaluatedCrisis(null);
  };

  const calculateCurrentBvc = () => {
    let score = 0;
    if (bvcConfused) score++;
    if (bvcIrritable) score++;
    if (bvcBoisterous) score++;
    if (bvcPhysThreat) score++;
    if (bvcVerbThreat) score++;
    if (bvcAttacking) score++;
    return score;
  };

  const currentBvc = calculateCurrentBvc();

  const handleEvaluateCrisis = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsEvaluating(true);
      const res = await fetch('/api/clinician/behavioral/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: patientIdInput,
          bvcItems: {
            confused: bvcConfused,
            irritable: bvcIrritable,
            boisterous: bvcBoisterous,
            physicallyThreatening: bvcPhysThreat,
            verballyThreatening: bvcVerbThreat,
            attackingObjects: bvcAttacking
          },
          suicideRiskLevel: suicideRiskInput,
          sensoryRoomUtilized: sensoryRoomInput,
          chemicalRestraintAdministered: false,
          evaluatingClinician: 'Emergency Psychiatric Response Team',
          clinicalNarrative: narrativeInput
        })
      });

      if (res.ok) {
        const data = await res.json();
        setEvaluatedCrisis(data);
        fetchSummary();
      }
    } catch (err) {
      console.error('Evaluate crisis error:', err);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleInitiateHold = async (e: React.FormEvent) => {
    e.preventDefault();
    const criteria: string[] = [];
    if (criterionDts) criteria.push('danger_to_self');
    if (criterionDto) criteria.push('danger_to_others');
    if (criterionGd) criteria.push('gravely_disabled');

    if (criteria.length === 0) {
      alert('Please select at least one statutory legal hold criterion.');
      return;
    }

    try {
      const res = await fetch('/api/clinician/behavioral/holds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: patientIdInput,
          crisisEvaluationId: evaluatedCrisis?.id,
          statutoryHoldType: holdTypeInput,
          holdCriteria: criteria,
          rightsAdvisementDelivered: true,
          destinationFacility: destinationInput
        })
      });

      if (res.ok) {
        setShowHoldModal(false);
        setActiveTab('holds');
        fetchSummary();
      }
    } catch (err) {
      console.error('Initiate hold error:', err);
    }
  };

  const handleUpdatePlacement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHold) return;

    try {
      const res = await fetch(`/api/clinician/behavioral/holds/${selectedHold.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bedPlacementStatus: newBedStatus,
          destinationFacility: updatedFacility || selectedHold.destinationFacility
        })
      });

      if (res.ok) {
        setShowPlacementModal(false);
        fetchSummary();
      }
    } catch (err) {
      console.error('Update placement error:', err);
    }
  };

  const getObservationBadge = (level: string) => {
    switch (level) {
      case '1_to_1_constant_sitter':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-950 text-rose-300 border border-rose-800 flex items-center gap-1 w-fit">
            <ShieldAlert className="h-3 w-3" /> 1:1 Constant Observer
          </span>
        );
      case '15_min_q15':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1 w-fit">
            <Clock className="h-3 w-3" /> Q15 Minute Safety Rounds
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1 w-fit">
            Standard Safety Observations
          </span>
        );
    }
  };

  const getPlacementBadge = (status: string) => {
    switch (status) {
      case 'admitted':
        return <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">Admitted</span>;
      case 'transport_en_route':
        return <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-blue-950 text-blue-300 border border-blue-800">Transport En Route</span>;
      case 'bed_reserved':
        return <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-purple-950 text-purple-300 border border-purple-800">Bed Reserved</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-950 text-amber-300 border border-amber-800">Searching Bed Queue</span>;
    }
  };

  const metrics = summaryData?.metrics || {
    activeCrises: 0,
    constantObserversRequired: 0,
    activeLegalHolds: 0,
    bedPlacementQueue: 0,
    deEscalationSuccessRate: 100,
    sensoryRoomUsageCount: 0
  };

  return (
    <div className="flex flex-col gap-6 p-6 bg-slate-950 text-slate-100 min-h-screen">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-xl bg-gradient-to-r from-rose-950 via-slate-900 to-amber-950 border border-rose-800/40 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl">
            <Brain className="h-8 w-8 text-rose-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Behavioral Emergency Command & Crisis De-Escalation (B-SAFE Hub)
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                Phase 45 Enterprise
              </span>
            </div>
            <p className="text-sm text-slate-300 mt-1">
              Brøset Violence Checklist (BVC), Trauma-Informed De-escalation Protocol, Statutory Legal Holds (5150/Baker Act) & Psych Bed Placement
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
            Refresh B-SAFE
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Active Crises</span>
          <div className="text-2xl font-extrabold text-white mt-1">{metrics.activeCrises}</div>
          <span className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Under ED Surveillance
          </span>
        </div>

        <div className="p-3.5 bg-slate-900/90 border border-rose-900/40 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-rose-400">1:1 Constant Sitters</span>
          <div className="text-2xl font-extrabold text-rose-300 mt-1">{metrics.constantObserversRequired}</div>
          <span className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
            <UserCheck className="h-3 w-3" /> High Violence / Self-Harm
          </span>
        </div>

        <div className="p-3.5 bg-slate-900/90 border border-amber-900/40 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-amber-400">Active Legal Holds</span>
          <div className="text-2xl font-extrabold text-amber-300 mt-1">{metrics.activeLegalHolds}</div>
          <span className="text-[10px] text-amber-400 mt-1 flex items-center gap-1">
            <Clock className="h-3 w-3" /> 5150 / Baker Act Expiration
          </span>
        </div>

        <div className="p-3.5 bg-slate-900/90 border border-blue-900/40 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-blue-400">Psych Bed Queue</span>
          <div className="text-2xl font-extrabold text-blue-300 mt-1">{metrics.bedPlacementQueue}</div>
          <span className="text-[10px] text-blue-400 mt-1 flex items-center gap-1">
            <Building className="h-3 w-3" /> Regional Locator
          </span>
        </div>

        <div className="p-3.5 bg-slate-900/90 border border-emerald-900/40 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-emerald-400">De-escalation Rate</span>
          <div className="text-2xl font-extrabold text-emerald-300 mt-1">{metrics.deEscalationSuccessRate}%</div>
          <span className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" /> Restraint-Free Outcomes
          </span>
        </div>

        <div className="p-3.5 bg-slate-900/90 border border-teal-900/40 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-teal-400">Sensory Room Use</span>
          <div className="text-2xl font-extrabold text-teal-300 mt-1">{metrics.sensoryRoomUsageCount}</div>
          <span className="text-[10px] text-teal-400 mt-1 flex items-center gap-1">
            <HeartHandshake className="h-3 w-3" /> Low-Stimulus Environment
          </span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab('evaluations')}
          className={`pb-3 font-semibold text-sm transition flex items-center gap-2 ${
            activeTab === 'evaluations'
              ? 'text-rose-400 border-b-2 border-rose-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldAlert className="h-4 w-4" />
          Brøset Violence Triage & De-escalation
        </button>
        <button
          onClick={() => setActiveTab('holds')}
          className={`pb-3 font-semibold text-sm transition flex items-center gap-2 ${
            activeTab === 'holds'
              ? 'text-rose-400 border-b-2 border-rose-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="h-4 w-4" />
          Involuntary Legal Holds & Psych Bed Locator
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-500 text-slate-950 font-bold">
            {metrics.activeLegalHolds}
          </span>
        </button>
      </div>

      {/* Tab 1: Crisis Evaluation & BVC Scorer */}
      {activeTab === 'evaluations' && (
        <div className="space-y-6">
          {/* Preset Scenario Cards */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-3 block">
              Load Emergency Behavioral Scenario:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PRESET_CRISIS_SCENARIOS.map((scen, idx) => (
                <button
                  key={scen.title}
                  onClick={() => loadScenario(idx)}
                  className={`p-3 rounded-lg border text-left transition text-xs ${
                    selectedScenarioIdx === idx
                      ? 'bg-rose-950/60 border-rose-500 text-rose-200 shadow-md'
                      : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="font-bold text-white flex items-center justify-between">
                    <span>{scen.patientName}</span>
                    <Sparkles className="h-3 w-3 text-rose-400" />
                  </div>
                  <div className="mt-1 text-slate-400">{scen.title}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Interactive BVC Scorer Form */}
          <form onSubmit={handleEvaluateCrisis} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-rose-400" />
                <h3 className="font-bold text-sm text-white">
                  Brøset Violence Checklist (BVC) Dynamic Assessor
                </h3>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span>Current Score: <strong className={`font-mono text-base ${currentBvc >= 3 ? 'text-rose-400' : currentBvc >= 1 ? 'text-amber-400' : 'text-emerald-400'}`}>{currentBvc} / 6</strong></span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  currentBvc >= 3 ? 'bg-rose-950 text-rose-300 border border-rose-800' : currentBvc >= 1 ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                }`}>
                  {currentBvc >= 3 ? 'HIGH / IMMINENT' : currentBvc >= 1 ? 'MODERATE' : 'LOW RISK'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <label className={`p-3 rounded-lg border flex items-center gap-2.5 cursor-pointer transition ${
                bvcConfused ? 'bg-rose-950/40 border-rose-500 text-rose-200' : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}>
                <input
                  type="checkbox"
                  checked={bvcConfused}
                  onChange={(e) => setBvcConfused(e.target.checked)}
                  className="rounded bg-slate-900 text-rose-500"
                />
                <span>1. Confused / Disoriented</span>
              </label>

              <label className={`p-3 rounded-lg border flex items-center gap-2.5 cursor-pointer transition ${
                bvcIrritable ? 'bg-rose-950/40 border-rose-500 text-rose-200' : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}>
                <input
                  type="checkbox"
                  checked={bvcIrritable}
                  onChange={(e) => setBvcIrritable(e.target.checked)}
                  className="rounded bg-slate-900 text-rose-500"
                />
                <span>2. Irritable / Agitated</span>
              </label>

              <label className={`p-3 rounded-lg border flex items-center gap-2.5 cursor-pointer transition ${
                bvcBoisterous ? 'bg-rose-950/40 border-rose-500 text-rose-200' : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}>
                <input
                  type="checkbox"
                  checked={bvcBoisterous}
                  onChange={(e) => setBvcBoisterous(e.target.checked)}
                  className="rounded bg-slate-900 text-rose-500"
                />
                <span>3. Boisterous / Loud</span>
              </label>

              <label className={`p-3 rounded-lg border flex items-center gap-2.5 cursor-pointer transition ${
                bvcPhysThreat ? 'bg-rose-950/40 border-rose-500 text-rose-200' : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}>
                <input
                  type="checkbox"
                  checked={bvcPhysThreat}
                  onChange={(e) => setBvcPhysThreat(e.target.checked)}
                  className="rounded bg-slate-900 text-rose-500"
                />
                <span>4. Physically Threatening</span>
              </label>

              <label className={`p-3 rounded-lg border flex items-center gap-2.5 cursor-pointer transition ${
                bvcVerbThreat ? 'bg-rose-950/40 border-rose-500 text-rose-200' : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}>
                <input
                  type="checkbox"
                  checked={bvcVerbThreat}
                  onChange={(e) => setBvcVerbThreat(e.target.checked)}
                  className="rounded bg-slate-900 text-rose-500"
                />
                <span>5. Verbally Threatening</span>
              </label>

              <label className={`p-3 rounded-lg border flex items-center gap-2.5 cursor-pointer transition ${
                bvcAttacking ? 'bg-rose-950/40 border-rose-500 text-rose-200' : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}>
                <input
                  type="checkbox"
                  checked={bvcAttacking}
                  onChange={(e) => setBvcAttacking(e.target.checked)}
                  className="rounded bg-slate-900 text-rose-500"
                />
                <span>6. Attacking Objects</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
              <div>
                <label className="text-slate-400 block mb-1">C-SSRS Suicide Risk Tier:</label>
                <select
                  value={suicideRiskInput}
                  onChange={(e) => setSuicideRiskInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                >
                  <option value="none">None / Negative Screen</option>
                  <option value="low">Low (Passive ideation, no intent)</option>
                  <option value="moderate">Moderate (Ideation with method, no intent)</option>
                  <option value="high_active_intent">High / Active Intent with Plan</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="sensoryCheck"
                  checked={sensoryRoomInput}
                  onChange={(e) => setSensoryRoomInput(e.target.checked)}
                  className="rounded bg-slate-900 text-rose-500"
                />
                <label htmlFor="sensoryCheck" className="text-slate-300">
                  Sensory Modulation / De-Stimulation Room Utilized
                </label>
              </div>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Clinical Agitation & Narrative Observation:</label>
              <textarea
                value={narrativeInput}
                onChange={(e) => setNarrativeInput(e.target.value)}
                rows={2}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white resize-none text-xs"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isEvaluating}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs rounded-lg shadow-lg transition"
              >
                <Sparkles className="h-4 w-4" />
                {isEvaluating ? 'Evaluating Crisis...' : 'Evaluate BVC & De-escalation Plan'}
              </button>
            </div>
          </form>

          {/* Evaluated Crisis Result Display */}
          {evaluatedCrisis && (
            <div className="bg-slate-900 border border-rose-900/60 rounded-xl p-5 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-rose-400" />
                  <h3 className="text-base font-bold text-white">
                    Emergency De-Escalation Care Plan
                  </h3>
                </div>
                {getObservationBadge(evaluatedCrisis.observationLevel)}
              </div>

              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Violence Risk Tier:</span>
                  <span className="font-bold text-white uppercase">{evaluatedCrisis.violenceRiskLevel.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Assigned Protocol:</span>
                  <span className="font-bold text-amber-300 font-mono">{evaluatedCrisis.deEscalationProtocol.replace(/_/g, ' ')}</span>
                </div>
                <div className="pt-2 text-slate-300">
                  {evaluatedCrisis.clinicalNarrative}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setShowHoldModal(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-bold text-xs rounded-lg shadow-lg transition"
                >
                  <Clock className="h-4 w-4" />
                  Initiate Statutory Involuntary Hold (5150)
                </button>
              </div>
            </div>
          )}

          {/* Historical Crisis Evaluations Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="font-bold text-sm text-slate-200 mb-3 flex items-center gap-2">
              <Brain className="h-4 w-4 text-rose-400" />
              Recent Behavioral Health Crisis Assessments
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-[11px] uppercase bg-slate-800/60 text-slate-400">
                  <tr>
                    <th className="p-2.5">ID</th>
                    <th className="p-2.5">Patient</th>
                    <th className="p-2.5">BVC Score</th>
                    <th className="p-2.5">Violence Risk</th>
                    <th className="p-2.5">Observation Level</th>
                    <th className="p-2.5">De-escalation Protocol</th>
                    <th className="p-2.5">Clinician</th>
                    <th className="p-2.5">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {summaryData?.recentEvaluations.map((ev) => (
                    <tr key={ev.id} className="hover:bg-slate-800/40">
                      <td className="p-2.5 font-mono text-slate-400">#{ev.id}</td>
                      <td className="p-2.5 font-bold text-white">{ev.patientName}</td>
                      <td className="p-2.5 font-mono font-bold text-rose-400">{ev.bvcScore} / 6</td>
                      <td className="p-2.5 capitalize">{ev.violenceRiskLevel.replace(/_/g, ' ')}</td>
                      <td className="p-2.5">{getObservationBadge(ev.observationLevel)}</td>
                      <td className="p-2.5 text-slate-300 font-mono text-[11px]">{ev.deEscalationProtocol.replace(/_/g, ' ')}</td>
                      <td className="p-2.5 text-slate-400">{ev.evaluatingClinician}</td>
                      <td className="p-2.5 text-slate-400">
                        {new Date(ev.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Involuntary Legal Holds & Bed Locator */}
      {activeTab === 'holds' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-400" />
              Active Involuntary Psychiatric Holds ({summaryData?.activeHolds.length || 0})
            </h3>
            <button
              onClick={() => setShowHoldModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition shadow"
            >
              <Plus className="h-3.5 w-3.5" />
              New Involuntary Hold
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {summaryData?.activeHolds.map((h) => (
              <div
                key={h.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 hover:border-slate-700 transition"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <div className="text-base font-bold text-white">{h.patientName}</div>
                    <div className="text-xs text-rose-400 font-semibold mt-0.5">{h.statutoryHoldType}</div>
                  </div>
                  {getPlacementBadge(h.bedPlacementStatus)}
                </div>

                {/* Expiration Countdown Bar */}
                <div className="p-3 bg-slate-950 rounded-lg border border-amber-900/40 flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-amber-400" />
                    Statutory Window Remaining:
                  </span>
                  <span className="font-extrabold text-amber-300 font-mono text-sm">
                    {h.hoursRemaining} Hours
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Legal Criteria:</span>
                    <div className="flex gap-1">
                      {h.holdCriteria.map((c, i) => (
                        <span key={i} className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 capitalize font-mono">
                          {c.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between text-slate-400">
                    <span>Patient Rights Delivered:</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> Form 1403 Signed
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-400">
                    <span>Target Facility:</span>
                    <span className="text-slate-200 font-semibold">{h.destinationFacility || 'Locating regional bed...'}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex justify-end">
                  <button
                    onClick={() => {
                      setSelectedHold(h);
                      setNewBedStatus(h.bedPlacementStatus);
                      setUpdatedFacility(h.destinationFacility || '');
                      setShowPlacementModal(true);
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-rose-300 font-semibold text-xs rounded border border-slate-700 transition"
                  >
                    Update Bed Placement & Transport
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: New Involuntary Hold */}
      {showHoldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-400" />
                Initiate Statutory Involuntary Hold
              </h3>
              <button onClick={() => setShowHoldModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleInitiateHold} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">State Statutory Hold Type:</label>
                <select
                  value={holdTypeInput}
                  onChange={(e) => setHoldTypeInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                >
                  <option value="California 5150 (72h)">California 5150 (72-Hour Hold)</option>
                  <option value="Florida Baker Act (Chapter 394)">Florida Baker Act (72h)</option>
                  <option value="Massachusetts Section 12">Massachusetts Section 12</option>
                  <option value="New York MHL 9.39">New York Mental Hygiene Law 9.39</option>
                  <option value="Emergency Psychiatric 72h Hold">Emergency Psychiatric 72h Hold</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Statutory Criteria (select all that apply):</label>
                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-2 text-slate-300">
                    <input
                      type="checkbox"
                      checked={criterionDts}
                      onChange={(e) => setCriterionDts(e.target.checked)}
                      className="rounded bg-slate-950 text-rose-500"
                    />
                    Danger to Self (DTS)
                  </label>
                  <label className="flex items-center gap-2 text-slate-300">
                    <input
                      type="checkbox"
                      checked={criterionDto}
                      onChange={(e) => setCriterionDto(e.target.checked)}
                      className="rounded bg-slate-950 text-rose-500"
                    />
                    Danger to Others (DTO)
                  </label>
                  <label className="flex items-center gap-2 text-slate-300">
                    <input
                      type="checkbox"
                      checked={criterionGd}
                      onChange={(e) => setCriterionGd(e.target.checked)}
                      className="rounded bg-slate-950 text-rose-500"
                    />
                    Gravely Disabled (GD)
                  </label>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Target Inpatient Psychiatric Facility:</label>
                <input
                  type="text"
                  value={destinationInput}
                  onChange={(e) => setDestinationInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowHoldModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white rounded font-bold shadow"
                >
                  Execute 72h Hold
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Update Bed Placement */}
      {showPlacementModal && selectedHold && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building className="h-5 w-5 text-rose-400" />
                Update Bed Placement & Transport
              </h3>
              <button onClick={() => setShowPlacementModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdatePlacement} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Bed Placement Status:</label>
                <select
                  value={newBedStatus}
                  onChange={(e) => setNewBedStatus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                >
                  <option value="searching">1. Searching Regional Bed Queue</option>
                  <option value="bed_reserved">2. Bed Reserved at Receiving Center</option>
                  <option value="transport_en_route">3. Secure Medical Transport En Route</option>
                  <option value="admitted">4. Patient Admitted to Inpatient Psych</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Receiving Psychiatric Facility:</label>
                <input
                  type="text"
                  value={updatedFacility}
                  onChange={(e) => setUpdatedFacility(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPlacementModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white rounded font-bold shadow"
                >
                  Save Placement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
