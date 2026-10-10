import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  Plus,
  CheckCircle2,
  ShieldAlert,
  Radio,
  Biohazard,
  Flame,
  Gauge,
  Layers,
  Sliders,
  Users
} from 'lucide-react';

interface MCITriageResult {
  patientIdentifier: string;
  isPediatric: boolean;
  triageCategory: 'RED' | 'YELLOW' | 'GREEN' | 'BLACK';
  categoryLabel: string;
  destinationZone: string;
  rationale: string;
  immediateInterventions: string[];
}

interface CBRNEThreatAssessment {
  cbrneClass: string;
  agentName: string;
  toxicityMechanism: string;
  antidoteRecommended: string;
  antidoteDosingProtocol: string;
  chempackDeploymentTriggered: boolean;
  decontaminationProcedure: string;
  ppeLevelRequired: string;
  specialCautions: string[];
}

interface MCIEncounter {
  id: number;
  incident_name: string;
  patient_identifier: string;
  is_pediatric: boolean;
  triage_category: string;
  can_walk: boolean;
  respiratory_rate?: number;
  perfusion_intact: boolean;
  mental_status: string;
  decontamination_status: string;
  destination_facility_zone: string;
  triaged_at: string;
}

export const CbrneTriageHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'triage' | 'cbrne' | 'surge' | 'registry'>('triage');
  const [encounters, setEncounters] = useState<MCIEncounter[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form State
  const [incidentName, setIncidentName] = useState<string>('Industrial Complex Incident');
  const [tagId, setTagId] = useState<string>('TAG-RED-014');
  const [isPediatric, setIsPediatric] = useState<boolean>(false);
  const [canWalk, setCanWalk] = useState<boolean>(false);
  const [spontaneousBreathing, setSpontaneousBreathing] = useState<boolean>(true);
  const [airwayManeuverResumes, setAirwayManeuverResumes] = useState<boolean>(true);
  const [respiratoryRate, setRespiratoryRate] = useState<number>(34);
  const [radialPulsePresent, setRadialPulsePresent] = useState<boolean>(false);
  const [capillaryRefill, setCapillaryRefill] = useState<number>(3.5);
  const [obeysCommands, setObeysCommands] = useState<boolean>(false);
  const [avpuScore, setAvpuScore] = useState<'A' | 'V' | 'P' | 'U'>('P');

  // Computed Triage Result
  const [triageResult, setTriageResult] = useState<MCITriageResult | null>(null);

  // CBRNE State
  const [cbrneClass, setCbrneClass] = useState<string>('CHEMICAL_NERVE');
  const [agentName, setAgentName] = useState<string>('Sarin (GB)');
  const [cbrneAssessment, setCbrneAssessment] = useState<CBRNEThreatAssessment | null>(null);

  useEffect(() => {
    handleEvaluateTriage();
  }, [
    isPediatric, canWalk, spontaneousBreathing, airwayManeuverResumes,
    respiratoryRate, radialPulsePresent, capillaryRefill, obeysCommands, avpuScore
  ]);

  useEffect(() => {
    handleMatchCbrne();
  }, [cbrneClass, agentName]);

  useEffect(() => {
    fetchEncounters();
  }, [incidentName]);

  const handleEvaluateTriage = async () => {
    try {
      const token = localStorage.getItem('token');
      const endpoint = isPediatric ? '/api/clinician/cbrne/triage/jumpstart' : '/api/clinician/cbrne/triage/start';
      const body = isPediatric
        ? {
            incidentName,
            patientIdentifier: tagId,
            canWalk,
            spontaneousBreathing,
            repositionsAirwayResumesBreathing: airwayManeuverResumes,
            palpablePulse: radialPulsePresent,
            gaveRescueBreathsResumedBreathing: airwayManeuverResumes,
            respiratoryRate,
            avpuScore
          }
        : {
            incidentName,
            patientIdentifier: tagId,
            canWalk,
            spontaneousBreathing,
            repositionsAirwayResumesBreathing: airwayManeuverResumes,
            respiratoryRate,
            radialPulsePresent,
            capillaryRefillSeconds: capillaryRefill,
            obeysCommands
          };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        const data = await res.json();
        setTriageResult(data);
      }
    } catch {
      // offline fallback
      let category: 'RED' | 'YELLOW' | 'GREEN' | 'BLACK' = 'RED';
      if (canWalk) category = 'GREEN';
      else if (!spontaneousBreathing && !airwayManeuverResumes) category = 'BLACK';
      else if (respiratoryRate > 30 || !radialPulsePresent || !obeysCommands) category = 'RED';
      else category = 'YELLOW';

      setTriageResult({
        patientIdentifier: tagId,
        isPediatric,
        triageCategory: category,
        categoryLabel: category === 'RED' ? 'Immediate (Life Threatening)' : category === 'GREEN' ? 'Minor' : category === 'BLACK' ? 'Expectant' : 'Delayed',
        destinationZone: category === 'RED' ? 'acute_red_tent' : 'general_assembly',
        rationale: 'Computed via disaster triage algorithm.',
        immediateInterventions: ['Airway management', 'Hemorrhage control']
      });
    }
  };

  const handleMatchCbrne = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/clinician/cbrne/agents/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          cbrneClass,
          agentName,
          patientWeightKg: 70,
          symptomsObserved: ['miosis', 'secretions']
        })
      });
      if (res.ok) {
        const data = await res.json();
        setCbrneAssessment(data);
      }
    } catch {
      // offline fallback
    }
  };

  const handleSaveEncounter = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/clinician/cbrne/encounters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          incidentName,
          patientIdentifier: tagId,
          isPediatric,
          triageCategory: triageResult?.triageCategory || 'RED',
          canWalk,
          respiratoryRate,
          perfusionIntact: radialPulsePresent,
          mentalStatus: obeysCommands ? 'Alert' : 'Altered',
          airwayInterventionNeeded: !spontaneousBreathing || respiratoryRate > 30,
          decontaminationStatus: 'pending',
          destinationFacilityZone: triageResult?.destinationZone || 'acute_red_tent'
        })
      });
      if (res.ok) {
        setMessage({ text: `Triage Tag ${tagId} committed to Disaster Incident Registry.`, type: 'success' });
        fetchEncounters();
      } else {
        setMessage({ text: 'Failed to record encounter.', type: 'error' });
      }
    } catch {
      setMessage({ text: 'Network error saving triage encounter.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchEncounters = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/clinician/cbrne/encounters?incidentName=${encodeURIComponent(incidentName)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEncounters(data);
      }
    } catch {
      // fallback
    }
  };

  // Live Counts
  const redCount = encounters.filter(e => e.triage_category === 'RED').length;
  const yellowCount = encounters.filter(e => e.triage_category === 'YELLOW').length;
  const greenCount = encounters.filter(e => e.triage_category === 'GREEN').length;
  const blackCount = encounters.filter(e => e.triage_category === 'BLACK').length;
  const totalCount = encounters.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-600/20 border border-red-500/30 rounded-xl text-red-400">
            <Biohazard className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-white">CBRNE-TRIAGE Hub</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/30">
                Phase 63
              </span>
            </div>
            <p className="text-sm text-slate-400">
              Mass Casualty Disaster Incident Command, START/JumpSTART Triage & CBRNE Agent Antidotes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchEncounters}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm flex items-center gap-2 border border-slate-700"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={handleSaveEncounter}
            disabled={loading}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-semibold flex items-center gap-2 shadow-lg shadow-red-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            Commit Triage Tag
          </button>
        </div>
      </div>

      {/* Status banner */}
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
          { id: 'triage', label: 'START / JumpSTART Engine', icon: ShieldAlert },
          { id: 'cbrne', label: 'CBRNE Threat & Antidote', icon: Biohazard },
          { id: 'surge', label: 'Disaster Surge & Decon Zones', icon: Users },
          { id: 'registry', label: 'MCI Encounter Registry', icon: Gauge }
        ].map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                active
                  ? 'border-red-500 text-red-400 bg-red-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: START / JUMPSTART TRIAGE */}
      {activeTab === 'triage' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-red-400" />
                Rapid Triage Inputs
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsPediatric(false)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold ${
                    !isPediatric ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  START (Adult)
                </button>
                <button
                  onClick={() => setIsPediatric(true)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold ${
                    isPediatric ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  JumpSTART (Pediatric)
                </button>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400">Incident Name</label>
                  <input
                    type="text"
                    value={incidentName}
                    onChange={e => setIncidentName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400">Triage Tag ID</label>
                  <input
                    type="text"
                    value={tagId}
                    onChange={e => setTagId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white font-mono"
                  />
                </div>
              </div>

              {/* 1. Ambulatory Check */}
              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700">
                <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canWalk}
                    onChange={e => setCanWalk(e.target.checked)}
                    className="rounded border-slate-700 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span>Can Walk / Ambulatory (Walking Wounded)</span>
                </label>
                <span className="text-[10px] text-slate-400 block mt-1">If yes, immediately categorizes as GREEN.</span>
              </div>

              {/* 2. Respiration Check */}
              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700 space-y-2">
                <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={spontaneousBreathing}
                    onChange={e => setSpontaneousBreathing(e.target.checked)}
                    className="rounded border-slate-700 text-red-600 focus:ring-red-500 w-4 h-4"
                  />
                  <span>Spontaneous Breathing Present</span>
                </label>

                {!spontaneousBreathing && (
                  <label className="flex items-center gap-2 text-xs text-amber-300 cursor-pointer pt-1 border-t border-slate-700">
                    <input
                      type="checkbox"
                      checked={airwayManeuverResumes}
                      onChange={e => setAirwayManeuverResumes(e.target.checked)}
                      className="rounded border-slate-700 text-amber-500 focus:ring-amber-400 w-4 h-4"
                    />
                    <span>{isPediatric ? 'Resumes breathing after 5 rescue breaths' : 'Resumes breathing after airway repositioning'}</span>
                  </label>
                )}

                {spontaneousBreathing && (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Respiratory Rate (bpm)</span>
                      <span className={`font-bold ${respiratoryRate > 30 ? 'text-red-400' : 'text-white'}`}>
                        {respiratoryRate} bpm
                      </span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="60"
                      value={respiratoryRate}
                      onChange={e => setRespiratoryRate(Number(e.target.value))}
                      className="w-full accent-red-500"
                    />
                    <span className="text-[10px] text-slate-500">Normal Adult: 10-30 bpm | Pediatric: 15-45 bpm</span>
                  </div>
                )}
              </div>

              {/* 3. Perfusion Check */}
              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700 space-y-2">
                <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={radialPulsePresent}
                    onChange={e => setRadialPulsePresent(e.target.checked)}
                    className="rounded border-slate-700 text-red-600 focus:ring-red-500 w-4 h-4"
                  />
                  <span>Radial / Peripheral Pulse Palpable</span>
                </label>

                {!isPediatric && (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Capillary Refill (seconds)</span>
                      <span className={`font-bold ${capillaryRefill > 2 ? 'text-red-400' : 'text-white'}`}>
                        {capillaryRefill}s
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="5.0"
                      step="0.5"
                      value={capillaryRefill}
                      onChange={e => setCapillaryRefill(Number(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                  </div>
                )}
              </div>

              {/* 4. Mental Status Check */}
              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700">
                {!isPediatric ? (
                  <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={obeysCommands}
                      onChange={e => setObeysCommands(e.target.checked)}
                      className="rounded border-slate-700 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <span>Obeys Simple Commands (e.g. Squeeze hand, open eyes)</span>
                  </label>
                ) : (
                  <div>
                    <label className="text-slate-400 block mb-1">Pediatric AVPU Score</label>
                    <select
                      value={avpuScore}
                      onChange={e => setAvpuScore(e.target.value as any)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
                    >
                      <option value="A">Alert (Age-appropriate)</option>
                      <option value="V">Responds to Voice</option>
                      <option value="P">Responds to Pain (Inappropriate/Posturing) : RED</option>
                      <option value="U">Unresponsive : RED</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Triage Output Card */}
          <div className="lg:col-span-7 space-y-4">
            {triageResult && (
              <>
                <div className={`p-6 rounded-2xl border ${
                  triageResult.triageCategory === 'RED'
                    ? 'bg-red-950/60 border-red-500 text-red-200 shadow-xl shadow-red-500/20'
                    : triageResult.triageCategory === 'YELLOW'
                    ? 'bg-amber-950/60 border-amber-500 text-amber-200'
                    : triageResult.triageCategory === 'GREEN'
                    ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200'
                    : 'bg-zinc-950/80 border-zinc-700 text-zinc-300'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs uppercase font-extrabold tracking-wider opacity-80">
                        {isPediatric ? 'JumpSTART Pediatric Disaster Classification' : 'Adult START Triage Priority'}
                      </span>
                      <h4 className="text-3xl font-black mt-1">{triageResult.categoryLabel}</h4>
                      <div className="text-xs opacity-90 mt-1">
                        Destination: <strong>{triageResult.destinationZone}</strong>
                      </div>
                    </div>
                    <div className={`text-4xl font-black px-5 py-3 rounded-2xl ${
                      triageResult.triageCategory === 'RED'
                        ? 'bg-red-600 text-white'
                        : triageResult.triageCategory === 'YELLOW'
                        ? 'bg-amber-500 text-black'
                        : triageResult.triageCategory === 'GREEN'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-zinc-800 text-white'
                    }`}>
                      {triageResult.triageCategory}
                    </div>
                  </div>
                  <p className="text-xs mt-3 pt-3 border-t border-white/20 opacity-90">
                    <strong>Rationale:</strong> {triageResult.rationale}
                  </p>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-400" />
                    Immediate Mass Casualty Field Interventions
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {triageResult.immediateInterventions.map((intv, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-red-400 font-bold">•</span>
                        <span>{intv}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CBRNE THREAT & ANTIDOTE */}
      {activeTab === 'cbrne' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
            <h3 className="text-md font-bold text-white flex items-center gap-2">
              <Biohazard className="w-5 h-5 text-red-400" />
              CBRNE Agent Selector
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400">CBRNE Threat Class</label>
                <select
                  value={cbrneClass}
                  onChange={e => {
                    setCbrneClass(e.target.value);
                    if (e.target.value === 'CHEMICAL_NERVE') setAgentName('Sarin (GB)');
                    else if (e.target.value === 'CHEMICAL_CYANIDE') setAgentName('Hydrogen Cyanide');
                    else if (e.target.value === 'CHEMICAL_VESICANT') setAgentName('Lewisite (L)');
                    else if (e.target.value === 'CHEMICAL_PULMONARY') setAgentName('Phosgene (CG)');
                    else if (e.target.value === 'RADIOLOGICAL') setAgentName('Cesium-137 Dirty Bomb');
                    else setAgentName('Anthrax (B. anthracis)');
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
                >
                  <option value="CHEMICAL_NERVE">Chemical: Nerve Agents (G & V Series)</option>
                  <option value="CHEMICAL_CYANIDE">Chemical: Blood / Cyanide Agents</option>
                  <option value="CHEMICAL_VESICANT">Chemical: Blister / Vesicants (Mustard / Lewisite)</option>
                  <option value="CHEMICAL_PULMONARY">Chemical: Choking / Pulmonary (Chlorine / Phosgene)</option>
                  <option value="RADIOLOGICAL">Radiological / Dirty Bomb Contamination</option>
                  <option value="BIOLOGICAL">Biological Weaponization</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400">Agent Identifier</label>
                <input
                  type="text"
                  value={agentName}
                  onChange={e => setAgentName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white font-mono"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-4">
            {cbrneAssessment && (
              <>
                {cbrneAssessment.chempackDeploymentTriggered && (
                  <div className="p-4 bg-red-950/80 border-2 border-red-500 rounded-2xl text-red-200 flex items-center gap-3 animate-pulse">
                    <Radio className="w-8 h-8 text-red-400 flex-shrink-0" />
                    <div>
                      <h4 className="font-black text-sm uppercase tracking-wide">
                        FEDERAL CHEMPACK CACHE DEPLOYMENT TRIGGERED
                      </h4>
                      <p className="text-xs">
                        Emergency autoinjector and multi-dose antidote cache mobilized for mass casualty exposure.
                      </p>
                    </div>
                  </div>
                )}

                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs text-slate-400 uppercase font-bold">{cbrneAssessment.cbrneClass}</span>
                      <h4 className="text-xl font-bold text-white">{cbrneAssessment.agentName}</h4>
                    </div>
                    <span className="px-3 py-1 bg-red-600/20 text-red-300 border border-red-500/30 rounded-xl text-xs font-bold">
                      {cbrneAssessment.ppeLevelRequired} PPE Required
                    </span>
                  </div>

                  <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/60 space-y-2">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Antidote Protocol</span>
                    <div className="text-md font-bold text-white">{cbrneAssessment.antidoteRecommended}</div>
                    <p className="text-xs text-slate-300 font-mono">{cbrneAssessment.antidoteDosingProtocol}</p>
                  </div>

                  <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/60 space-y-1">
                    <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Decontamination Procedure</span>
                    <p className="text-xs text-slate-300">{cbrneAssessment.decontaminationProcedure}</p>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-800">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Special Cautions</span>
                    {cbrneAssessment.specialCautions.map((caution, i) => (
                      <div key={i} className="text-xs text-slate-300 flex items-start gap-2">
                        <span className="text-amber-400 font-bold">•</span>
                        <span>{caution}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SURGE & DECON */}
      {activeTab === 'surge' && (
        <div className="space-y-6">
          {/* Surge Breakdown Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-red-950/40 border border-red-500/50 p-5 rounded-2xl">
              <span className="text-xs text-red-300 font-bold uppercase">Immediate (RED)</span>
              <div className="text-4xl font-black text-red-400 my-1">{redCount}</div>
              <span className="text-[11px] text-red-300/80">Acute Resuscitation Tent</span>
            </div>

            <div className="bg-amber-950/40 border border-amber-500/50 p-5 rounded-2xl">
              <span className="text-xs text-amber-300 font-bold uppercase">Delayed (YELLOW)</span>
              <div className="text-4xl font-black text-amber-400 my-1">{yellowCount}</div>
              <span className="text-[11px] text-amber-300/80">Observation Area</span>
            </div>

            <div className="bg-emerald-950/40 border border-emerald-500/50 p-5 rounded-2xl">
              <span className="text-xs text-emerald-300 font-bold uppercase">Minor (GREEN)</span>
              <div className="text-4xl font-black text-emerald-400 my-1">{greenCount}</div>
              <span className="text-[11px] text-emerald-300/80">Walking Wounded Assembly</span>
            </div>

            <div className="bg-zinc-900 border border-zinc-700 p-5 rounded-2xl">
              <span className="text-xs text-zinc-400 font-bold uppercase">Expectant (BLACK)</span>
              <div className="text-4xl font-black text-zinc-200 my-1">{blackCount}</div>
              <span className="text-[11px] text-zinc-400">Morgue Staging</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-red-400" />
                Decontamination Zone Telemetry
              </h3>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-xl">
                  <div className="font-bold text-red-300 mb-0.5">HOT ZONE (Exclusion Area)</div>
                  <p className="text-slate-300">Gross chemical/radiological contamination. Strict Level A/B PPE with SCBA. No patient treatment except immediate antidotes and gross tourniquets.</p>
                </div>

                <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-xl">
                  <div className="font-bold text-amber-300 mb-0.5">WARM ZONE (Contamination Reduction Corridor)</div>
                  <p className="text-slate-300">Level C PPE with PAPR. Ambulatory and non-ambulatory decontaminating lanes. Removal of clothing into hazardous waste disposal followed by high-volume water flush.</p>
                </div>

                <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl">
                  <div className="font-bold text-emerald-300 mb-0.5">COLD ZONE (Support & Treatment Area)</div>
                  <p className="text-slate-300">Standard hospital precautions. Patient cleared of secondary contamination. Advanced airway, surgical stabilization, and definitive intensive care.</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-400" />
                Hospital Surge Capacity Status
              </h3>

              <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/60 space-y-2">
                <div className="text-xs text-slate-400">Current Disaster Load</div>
                <div className="text-2xl font-black text-white">{totalCount} Triaged Patients</div>
                <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-red-500 h-full"
                    style={{ width: `${Math.min((totalCount / 50) * 100, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Baseline</span>
                  <span>Surge 25%</span>
                  <span>Crisis Standard of Care (&gt;50)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ENCOUNTER REGISTRY */}
      {activeTab === 'registry' && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
          <h3 className="text-md font-bold text-white flex items-center gap-2">
            <Gauge className="w-5 h-5 text-red-400" />
            Active MCI Triage Encounters for {incidentName}
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="p-3">Tag ID</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Demographic</th>
                  <th className="p-3">Can Walk</th>
                  <th className="p-3">RR (bpm)</th>
                  <th className="p-3">Perfusion</th>
                  <th className="p-3">Destination</th>
                  <th className="p-3">Decon Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {encounters.length > 0 ? (
                  encounters.map(e => (
                    <tr key={e.id} className="hover:bg-slate-800/30">
                      <td className="p-3 font-mono font-bold text-white">{e.patient_identifier}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          e.triage_category === 'RED'
                            ? 'bg-red-600 text-white'
                            : e.triage_category === 'YELLOW'
                            ? 'bg-amber-500 text-black'
                            : e.triage_category === 'GREEN'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-zinc-800 text-white'
                        }`}>
                          {e.triage_category}
                        </span>
                      </td>
                      <td className="p-3">{e.is_pediatric ? 'Pediatric (<8y)' : 'Adult'}</td>
                      <td className="p-3">{e.can_walk ? 'Yes' : 'No'}</td>
                      <td className="p-3">{e.respiratory_rate ? `${e.respiratory_rate} bpm` : 'Apneic'}</td>
                      <td className="p-3">{e.perfusion_intact ? 'Intact' : 'Compromised'}</td>
                      <td className="p-3 font-mono text-slate-400">{e.destination_facility_zone}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {e.decontamination_status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-500">
                      No triage encounters recorded yet for {incidentName}.
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

export default CbrneTriageHub;
