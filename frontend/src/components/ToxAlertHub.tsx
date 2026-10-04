import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Zap,
  Activity,
  AlertTriangle,
  RefreshCw,
  Plus,
  CheckCircle2,
  SlidersHorizontal,
  Flame,
  Droplets,
  HeartPulse,
  Brain,
  Syringe
} from 'lucide-react';

interface ToxCase {
  id: number;
  patient_id: number;
  substance_name: string;
  ingestion_category: string;
  ingestion_time_hours_ago: number;
  amount_ingested_mg_or_units?: number | null;
  patient_weight_kg: number;
  serum_level?: number | null;
  serum_level_unit?: string | null;
  measured_osmolality?: number | null;
  calculated_osmolar_gap?: number | null;
  toxidrome_identified?: string | null;
  hunter_serotonin_positive: boolean;
  recommended_antidote?: string | null;
  antidote_dosing_plan?: any;
  hemodialysis_indicated: boolean;
  poison_control_case_number?: string | null;
  case_status: string;
  created_at: string;
  antidoteAdministrations?: any[];
}

export const ToxAlertHub: React.FC = () => {
  const [cases, setCases] = useState<ToxCase[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedCase, setSelectedCase] = useState<ToxCase | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'registry' | 'toxidrome' | 'apap' | 'salicylate' | 'toxic_alcohol' | 'hunter' | 'digifab'>('registry');

  // Modals
  const [showNewCaseModal, setShowNewCaseModal] = useState<boolean>(false);
  const [showAntidoteModal, setShowAntidoteModal] = useState<boolean>(false);

  // 1. Toxidrome Evaluator State
  const [hr, setHr] = useState<number>(115);
  const [sbp, setSbp] = useState<number>(145);
  const [dbp, setDbp] = useState<number>(90);
  const [rr, setRr] = useState<number>(20);
  const [temp, setTemp] = useState<number>(38.5);
  const [pupils, setPupils] = useState<'miosis' | 'normal' | 'mydriasis'>('mydriasis');
  const [skin, setSkin] = useState<'dry_warm' | 'diaphoretic' | 'normal' | 'cyanotic'>('dry_warm');
  const [bowel, setBowel] = useState<'hyperactive' | 'normoactive' | 'hypoactive' | 'absent'>('absent');
  const [mental, setMental] = useState<'alert' | 'somnolent' | 'coma' | 'delirium' | 'agitated'>('delirium');
  const [toxidromeResult, setToxidromeResult] = useState<any | null>(null);

  // 2. APAP Nomogram State
  const [apapHours, setApapHours] = useState<number>(6);
  const [apapLevel, setApapLevel] = useState<number>(140);
  const [apapWeight, setApapWeight] = useState<number>(70);
  const [apapResult, setApapResult] = useState<any | null>(null);

  // 3. Salicylate State
  const [salLevel, setSalLevel] = useState<number>(65);
  const [salPh, setSalPh] = useState<number>(7.42);
  const [salK, setSalK] = useState<number>(3.6);
  const [salAms, setSalAms] = useState<boolean>(false);
  const [salEdema, setSalEdema] = useState<boolean>(false);
  const [salRenal, setSalRenal] = useState<boolean>(false);
  const [salWeight, setSalWeight] = useState<number>(75);
  const [salResult, setSalResult] = useState<any | null>(null);

  // 4. Toxic Alcohol State
  const [suspectedAlcohol, setSuspectedAlcohol] = useState<'METHANOL' | 'ETHYLENE_GLYCOL' | 'ISOPROPANOL' | 'UNKNOWN'>('METHANOL');
  const [measOsm, setMeasOsm] = useState<number>(330);
  const [naVal, setNaVal] = useState<number>(140);
  const [gluVal, setGluVal] = useState<number>(95);
  const [bunVal, setBunVal] = useState<number>(14);
  const [etohVal, setEtohVal] = useState<number>(0);
  const [alcWeight, setAlcWeight] = useState<number>(70);
  const [alcPh, setAlcPh] = useState<number>(7.26);
  const [alcoholResult, setAlcoholResult] = useState<any | null>(null);

  // 5. Hunter Serotonin State
  const [serotonergicAgent, setSerotonergicAgent] = useState<boolean>(true);
  const [spontaneousClonus, setSpontaneousClonus] = useState<boolean>(false);
  const [inducibleClonus, setInducibleClonus] = useState<boolean>(true);
  const [ocularClonus, setOcularClonus] = useState<boolean>(false);
  const [hunterAgitation, setHunterAgitation] = useState<boolean>(true);
  const [hunterDiaphoresis, setHunterDiaphoresis] = useState<boolean>(true);
  const [hunterTremor, setHunterTremor] = useState<boolean>(true);
  const [hunterHyperreflexia, setHunterHyperreflexia] = useState<boolean>(true);
  const [hunterHypertonia, setHunterHypertonia] = useState<boolean>(false);
  const [hunterTemp, setHunterTemp] = useState<number>(38.4);
  const [hunterResult, setHunterResult] = useState<any | null>(null);

  // 6. DigiFab State
  const [digiScenario, setDigiScenario] = useState<'KNOWN_INGESTION_AMOUNT' | 'STEADY_STATE_SERUM_LEVEL' | 'EMPIRIC_ARREST'>('KNOWN_INGESTION_AMOUNT');
  const [digiAmount, setDigiAmount] = useState<number>(10);
  const [digiLevel, setDigiLevel] = useState<number>(4.2);
  const [digiWeight, setDigiWeight] = useState<number>(70);
  const [digiResult, setDigiResult] = useState<any | null>(null);

  // New Case Form State
  const [newSubstance, setNewSubstance] = useState<string>('Acetaminophen 500mg');
  const [newCategory, setNewCategory] = useState<string>('ACETAMINOPHEN');
  const [newHoursAgo, setNewHoursAgo] = useState<number>(4.5);
  const [newAmount, setNewAmount] = useState<number>(20000);
  const [newWeight, setNewWeight] = useState<number>(70);
  const [newLevel, setNewLevel] = useState<number>(180);
  const [newLevelUnit, setNewLevelUnit] = useState<string>('mcg/mL');

  // Antidote Form State
  const [adminAntidote, setAdminAntidote] = useState<string>('N-Acetylcysteine (IV 21-Hour Regimen)');
  const [adminDose, setAdminDose] = useState<number>(10500);
  const [adminUnit, setAdminUnit] = useState<string>('mg');
  const [adminRoute, setAdminRoute] = useState<string>('IV');
  const [adminNotes, setAdminNotes] = useState<string>('Loading bag 1 initiated in 200 mL D5W at 200 mL/hr.');

  const fetchCases = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const res = await fetch('/api/clinician/toxicology/cases?limit=30', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCases(data);
        if (data.length > 0 && !selectedCase) {
          fetchCaseDetails(data[0].id);
        }
      }
    } catch (e) {
      console.error('Error fetching toxicology cases:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchCaseDetails = async (caseId: number) => {
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const res = await fetch(`/api/clinician/toxicology/cases/${caseId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedCase(data);
      }
    } catch (e) {
      console.error('Error fetching case details:', e);
    }
  };

  useEffect(() => {
    fetchCases();
    handleClassifyToxidrome();
    handleCalculateApap();
    handleCalculateSalicylate();
    handleCalculateToxicAlcohol();
    handleEvaluateHunter();
    handleCalculateDigiFab();
  }, []);

  const handleClassifyToxidrome = async () => {
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const res = await fetch('/api/clinician/toxicology/classify-toxidrome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          heartRate: hr,
          systolicBp: sbp,
          diastolicBp: dbp,
          respiratoryRate: rr,
          temperatureC: temp,
          pupilSize: pupils,
          skinExam: skin,
          bowelSounds: bowel,
          mentalStatus: mental
        })
      });
      if (res.ok) {
        const data = await res.json();
        setToxidromeResult(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCalculateApap = async () => {
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const res = await fetch('/api/clinician/toxicology/apap-nomogram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          hoursPostIngestion: apapHours,
          apapConcentrationMcgPerMl: apapLevel,
          weightKg: apapWeight
        })
      });
      if (res.ok) {
        const data = await res.json();
        setApapResult(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCalculateSalicylate = async () => {
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const res = await fetch('/api/clinician/toxicology/salicylate-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          salicylateLevelMgPerDl: salLevel,
          arterialPh: salPh,
          serumPotassiumMeqPerL: salK,
          hasAlteredMentalStatus: salAms,
          hasPulmonaryEdema: salEdema,
          hasRenalFailure: salRenal,
          weightKg: salWeight
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSalResult(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCalculateToxicAlcohol = async () => {
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const res = await fetch('/api/clinician/toxicology/toxic-alcohol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          suspectedAlcohol,
          measuredSerumOsmolality: measOsm,
          sodiumMeqPerL: naVal,
          glucoseMgPerDl: gluVal,
          bunMgPerDl: bunVal,
          ethanolMgPerDl: etohVal,
          weightKg: alcWeight,
          arterialPh: alcPh
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAlcoholResult(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleEvaluateHunter = async () => {
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const res = await fetch('/api/clinician/toxicology/hunter-criteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          serotonergicAgentPresent: serotonergicAgent,
          spontaneousClonus,
          inducibleClonus,
          ocularClonus,
          agitation: hunterAgitation,
          diaphoresis: hunterDiaphoresis,
          tremor: hunterTremor,
          hyperreflexia: hunterHyperreflexia,
          hypertonia: hunterHypertonia,
          temperatureC: hunterTemp
        })
      });
      if (res.ok) {
        const data = await res.json();
        setHunterResult(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCalculateDigiFab = async () => {
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const res = await fetch('/api/clinician/toxicology/digifab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          scenario: digiScenario,
          amountIngestedMg: digiAmount,
          serumDigoxinNgPerMl: digiLevel,
          patientWeightKg: digiWeight
        })
      });
      if (res.ok) {
        const data = await res.json();
        setDigiResult(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const res = await fetch('/api/clinician/toxicology/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          patientId: 1,
          substanceName: newSubstance,
          ingestionCategory: newCategory,
          ingestionTimeHoursAgo: newHoursAgo,
          amountIngestedMgOrUnits: newAmount,
          patientWeightKg: newWeight,
          serumLevel: newLevel,
          serumLevelUnit: newLevelUnit,
          toxidromeIdentified: toxidromeResult?.toxidrome || 'Undifferentiated',
          recommendedAntidote: apapResult?.nacIndicated ? 'N-Acetylcysteine (IV 21h)' : 'Supportive care',
          antidoteDosingPlan: apapResult?.nacIvRegimen21Hour || null,
          hemodialysisIndicated: salResult?.hemodialysisIndicated || false
        })
      });
      if (res.ok) {
        setShowNewCaseModal(false);
        fetchCases();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRecordAntidote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const res = await fetch(`/api/clinician/toxicology/cases/${selectedCase.id}/antidote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          antidoteName: adminAntidote,
          doseAdministered: adminDose,
          doseUnit: adminUnit,
          route: adminRoute,
          administeredBy: 'Clinical Specialist',
          notes: adminNotes
        })
      });
      if (res.ok) {
        setShowAntidoteModal(false);
        fetchCaseDetails(selectedCase.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col gap-5 p-6 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-800 dark:text-slate-100 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-gradient-to-r from-rose-900 via-rose-800 to-amber-900 text-white rounded-2xl shadow-xl border border-rose-700/50">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/10 rounded-xl backdrop-blur-md border border-white/20">
            <Flame className="h-8 w-8 text-rose-300 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-xs font-black tracking-widest bg-rose-500/30 border border-rose-400/40 rounded-full text-rose-200 uppercase">
                EMERGENCY POISON CONTROL
              </span>
              <span className="text-xs bg-amber-500/20 text-amber-200 border border-amber-400/30 px-2 py-0.5 rounded-full font-mono">
                AAPCC / ACMT ALGORITHMS
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white mt-1">
              TOX-ALERT™ Clinical Toxicology Command
            </h1>
            <p className="text-xs text-rose-200/90 mt-0.5">
              Toxidrome Classifier, Rumack-Matthew APAP Nomogram, Salicylate Alkalinization, Toxic Alcohol Osmolar Gap, Hunter Serotonin & DigiFab Protocol
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewCaseModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all"
          >
            <Plus className="h-4 w-4" />
            New Poison Case
          </button>
          <button
            onClick={fetchCases}
            disabled={loading}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all"
            title="Refresh Cases"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Navigation Pills */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('registry')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'registry'
              ? 'bg-rose-600 text-white shadow-md'
              : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          <Activity className="h-3.5 w-3.5" />
          Active Tox Cases ({cases.length})
        </button>

        <button
          onClick={() => setActiveTab('toxidrome')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'toxidrome'
              ? 'bg-rose-600 text-white shadow-md'
              : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Toxidrome Classifier
        </button>

        <button
          onClick={() => setActiveTab('apap')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'apap'
              ? 'bg-rose-600 text-white shadow-md'
              : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          <HeartPulse className="h-3.5 w-3.5" />
          Rumack-Matthew (APAP)
        </button>

        <button
          onClick={() => setActiveTab('salicylate')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'salicylate'
              ? 'bg-rose-600 text-white shadow-md'
              : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          <Droplets className="h-3.5 w-3.5" />
          Salicylate Alkalinization
        </button>

        <button
          onClick={() => setActiveTab('toxic_alcohol')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'toxic_alcohol'
              ? 'bg-rose-600 text-white shadow-md'
              : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          <Zap className="h-3.5 w-3.5" />
          Toxic Alcohol Osmolar Gap
        </button>

        <button
          onClick={() => setActiveTab('hunter')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'hunter'
              ? 'bg-rose-600 text-white shadow-md'
              : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          <Brain className="h-3.5 w-3.5" />
          Hunter Serotonin Toxicity
        </button>

        <button
          onClick={() => setActiveTab('digifab')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'digifab'
              ? 'bg-rose-600 text-white shadow-md'
              : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          <Syringe className="h-3.5 w-3.5" />
          DigiFab Calculator
        </button>
      </div>

      {/* TAB 1: REGISTRY & CASE DOSSIER */}
      {activeTab === 'registry' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Case List */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center justify-between">
              <span>Ingestion Cases</span>
              <span className="text-xs bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-full font-mono">
                {cases.length} Total
              </span>
            </h2>

            {cases.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                No active ingestion cases recorded. Click &quot;New Poison Case&quot; to begin.
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[600px] overflow-y-auto pr-1">
                {cases.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      setSelectedCase(c);
                      fetchCaseDetails(c.id);
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedCase?.id === c.id
                        ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {c.substance_name}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {c.poison_control_case_number}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500">
                      <span>{c.ingestion_time_hours_ago}h ago</span>
                      <span>•</span>
                      <span>{c.patient_weight_kg} kg</span>
                      {c.serum_level && (
                        <>
                          <span>•</span>
                          <span className="font-semibold text-rose-600 dark:text-rose-400">
                            {c.serum_level} {c.serum_level_unit}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 mt-2">
                      {c.hemodialysis_indicated && (
                        <span className="px-2 py-0.5 text-[9px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 rounded border border-purple-300 dark:border-purple-800">
                          DIALYSIS INDICATED
                        </span>
                      )}
                      {c.hunter_serotonin_positive && (
                        <span className="px-2 py-0.5 text-[9px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 rounded border border-amber-300 dark:border-amber-800">
                          SEROTONIN POSITIVE
                        </span>
                      )}
                      <span className="px-2 py-0.5 text-[9px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded">
                        {c.case_status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Selected Case Details & Antidote Administrations */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {selectedCase ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-slate-900 dark:text-white">
                        {selectedCase.substance_name}
                      </h3>
                      <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded font-mono">
                        Case #{selectedCase.poison_control_case_number}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Category: {selectedCase.ingestion_category} | Patient Weight: {selectedCase.patient_weight_kg} kg | Ingestion: {selectedCase.ingestion_time_hours_ago} hours ago
                    </p>
                  </div>

                  <button
                    onClick={() => setShowAntidoteModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg shadow-sm"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Administer Antidote
                  </button>
                </div>

                {/* Status Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Serum Level</span>
                    <span className="text-sm font-black text-rose-600 dark:text-rose-400">
                      {selectedCase.serum_level ? `${selectedCase.serum_level} ${selectedCase.serum_level_unit}` : 'Pending / Not Drawn'}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Toxidrome</span>
                    <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                      {selectedCase.toxidrome_identified || 'Undifferentiated'}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Hemodialysis</span>
                    <span className={`text-sm font-black ${selectedCase.hemodialysis_indicated ? 'text-purple-600 dark:text-purple-400' : 'text-emerald-600'}`}>
                      {selectedCase.hemodialysis_indicated ? 'INDICATED' : 'Not Required'}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Target Antidote</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {selectedCase.recommended_antidote || 'Supportive Care'}
                    </span>
                  </div>
                </div>

                {/* Antidote Administration Log */}
                <div className="mt-5">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-2">
                    Antidote Administration History
                  </h4>
                  {selectedCase.antidoteAdministrations && selectedCase.antidoteAdministrations.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {selectedCase.antidoteAdministrations.map((adm: any) => (
                        <div key={adm.id} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                {adm.antidote_name}
                              </span>
                              <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400">
                                {adm.dose_administered} {adm.dose_unit} ({adm.route})
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Administered by {adm.administered_by} • {new Date(adm.administered_at).toLocaleTimeString()}
                            </p>
                            {adm.notes && <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 italic">&quot;{adm.notes}&quot;</p>}
                          </div>
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-1" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 py-3 italic">
                      No antidote doses administered yet for this case.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center text-slate-400 text-xs">
                Select an ingestion case from the registry to review poisoning details and antidote logs.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: TOXIDROME CLASSIFIER */}
      {activeTab === 'toxidrome' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-rose-500" />
              Physical Exam & Vital Signs
            </h2>

            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Heart Rate (bpm)</label>
                  <input
                    type="number"
                    value={hr}
                    onChange={(e) => setHr(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Resp Rate (/min)</label>
                  <input
                    type="number"
                    value={rr}
                    onChange={(e) => setRr(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Blood Pressure</label>
                  <div className="flex gap-1 mt-1">
                    <input
                      type="number"
                      value={sbp}
                      onChange={(e) => setSbp(Number(e.target.value))}
                      placeholder="SBP"
                      className="w-1/2 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                    />
                    <input
                      type="number"
                      value={dbp}
                      onChange={(e) => setDbp(Number(e.target.value))}
                      placeholder="DBP"
                      className="w-1/2 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Temp (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={temp}
                    onChange={(e) => setTemp(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Pupils</label>
                <select
                  value={pupils}
                  onChange={(e: any) => setPupils(e.target.value)}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                >
                  <option value="mydriasis">Mydriasis (Dilated &gt; 5mm)</option>
                  <option value="miosis">Miosis (Pinpoint &lt; 2mm)</option>
                  <option value="normal">Normal (3-4mm reactive)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Skin & Axillae</label>
                <select
                  value={skin}
                  onChange={(e: any) => setSkin(e.target.value)}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                >
                  <option value="dry_warm">Dry, warm, flushed (Anhidrotic)</option>
                  <option value="diaphoretic">Diaphoretic / Wet</option>
                  <option value="normal">Normal</option>
                  <option value="cyanotic">Cyanotic</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Bowel Sounds</label>
                <select
                  value={bowel}
                  onChange={(e: any) => setBowel(e.target.value)}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                >
                  <option value="absent">Absent / Silent</option>
                  <option value="hypoactive">Hypoactive</option>
                  <option value="normoactive">Normoactive</option>
                  <option value="hyperactive">Hyperactive / Diarrhea</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Mental Status</label>
                <select
                  value={mental}
                  onChange={(e: any) => setMental(e.target.value)}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                >
                  <option value="delirium">Delirium / Hallucinations / Agitated</option>
                  <option value="somnolent">Somnolent / Lethargic</option>
                  <option value="coma">Coma / Unresponsive</option>
                  <option value="alert">Alert & Oriented</option>
                </select>
              </div>

              <button
                onClick={handleClassifyToxidrome}
                className="w-full mt-2 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg shadow-sm"
              >
                Compute Toxidrome Match
              </button>
            </div>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {toxidromeResult && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">
                      CLASSIFIED TOXIDROME
                    </span>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                      {toxidromeResult.toxidrome} Toxidrome
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block font-mono">CONFIDENCE</span>
                    <span className="text-lg font-black text-rose-600 dark:text-rose-400">
                      {toxidromeResult.confidence}%
                    </span>
                  </div>
                </div>

                {toxidromeResult.contraindicationsAlert && (
                  <div className="my-4 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl flex items-start gap-2.5">
                    <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold text-rose-800 dark:text-rose-300 block">
                        CRITICAL SAFETY CONTRAINDICATION
                      </span>
                      <p className="text-xs text-rose-700 dark:text-rose-300/90 mt-0.5">
                        {toxidromeResult.contraindicationsAlert}
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    First-Line Antidote / Reversal:
                  </span>
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    {toxidromeResult.primaryAntidote}
                  </div>
                </div>

                <div className="mt-4">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                    Classic Manifestations:
                  </span>
                  <ul className="flex flex-col gap-1.5">
                    {toxidromeResult.classicFeatures.map((f: string, idx: number) => (
                      <li key={idx} className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                    Direct Clinical Directives:
                  </span>
                  <div className="flex flex-col gap-2">
                    {toxidromeResult.treatmentRecommendations.map((r: string, idx: number) => (
                      <div key={idx} className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-xs text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {r}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: RUMACK-MATTHEW APAP NOMOGRAM */}
      {activeTab === 'apap' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
              <HeartPulse className="h-4 w-4 text-rose-500" />
              Acetaminophen Parameters
            </h2>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Hours Post-Acute Ingestion (4 - 24 hrs)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="4"
                  max="24"
                  value={apapHours}
                  onChange={(e) => setApapHours(Number(e.target.value))}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Serum APAP Concentration (mcg/mL)
                </label>
                <input
                  type="number"
                  value={apapLevel}
                  onChange={(e) => setApapLevel(Number(e.target.value))}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Patient Weight (kg)
                </label>
                <input
                  type="number"
                  value={apapWeight}
                  onChange={(e) => setApapWeight(Number(e.target.value))}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Dose capped at 100 kg</span>
              </div>

              <button
                onClick={handleCalculateApap}
                className="w-full mt-2 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg shadow-sm"
              >
                Plot On Rumack-Matthew Nomogram
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-4">
            {apapResult && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">
                      RUMACK-MATTHEW EVALUATION
                    </span>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                      {apapResult.riskCategory.replace(/_/g, ' ')}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    {apapResult.nacIndicated ? (
                      <span className="px-3 py-1 bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-black text-xs rounded-lg animate-pulse">
                        NAC INFUSION INDICATED
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-black text-xs rounded-lg">
                        BELOW TREATMENT LINE
                      </span>
                    )}
                  </div>
                </div>

                {/* SVG Nomogram Representation */}
                <div className="my-4 p-4 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400 mb-2 font-mono flex items-center justify-between">
                    <span>Rumack-Matthew Nomogram (4 to 24h)</span>
                    <span className="text-rose-400">■ Patient Point: {apapHours}h / {apapLevel} mcg/mL</span>
                  </div>
                  <svg viewBox="0 0 400 160" className="w-full h-36">
                    {/* Grid Lines */}
                    <line x1="40" y1="130" x2="380" y2="130" stroke="#334155" strokeWidth="1" />
                    <line x1="40" y1="20" x2="40" y2="130" stroke="#334155" strokeWidth="1" />

                    {/* Time ticks */}
                    <text x="40" y="145" fill="#64748b" fontSize="8">4h</text>
                    <text x="125" y="145" fill="#64748b" fontSize="8">8h</text>
                    <text x="210" y="145" fill="#64748b" fontSize="8">12h</text>
                    <text x="295" y="145" fill="#64748b" fontSize="8">16h</text>
                    <text x="370" y="145" fill="#64748b" fontSize="8">24h</text>

                    {/* Concentration ticks */}
                    <text x="15" y="30" fill="#64748b" fontSize="8">300</text>
                    <text x="15" y="65" fill="#64748b" fontSize="8">150</text>
                    <text x="25" y="125" fill="#64748b" fontSize="8">0</text>

                    {/* High Risk Line (300 at 4h, 150 at 8h, 75 at 12h, 37.5 at 16h, 9.4 at 24h) */}
                    <path
                      d="M 40 30 Q 180 85 375 125"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="2"
                      strokeDasharray="4 2"
                    />

                    {/* Treatment Line (150 at 4h, 75 at 8h, 37.5 at 12h, 18.8 at 16h, 4.7 at 24h) */}
                    <path
                      d="M 40 65 Q 180 105 375 128"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2"
                    />

                    {/* Patient point */}
                    {(() => {
                      const px = 40 + ((apapHours - 4) / 20) * 335;
                      const py = Math.max(20, Math.min(130, 130 - (apapLevel / 300) * 100));
                      return (
                        <circle cx={px} cy={py} r="5" fill="#ec4899" stroke="#fff" strokeWidth="1.5" />
                      );
                    })()}
                  </svg>
                  <div className="flex items-center gap-4 text-[10px] text-slate-400 mt-2 font-mono">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-0.5 bg-amber-500 inline-block" /> Treatment Line (150 mcg/mL @ 4h)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-0.5 bg-rose-500 inline-block" /> High-Risk Line (300 mcg/mL @ 4h)
                    </span>
                  </div>
                </div>

                {/* 21-Hour IV NAC Protocol */}
                {apapResult.nacIndicated && (
                  <div className="mt-4">
                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-2">
                      Standard 21-Hour 3-Bag Intravenous NAC Protocol
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl">
                        <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase">
                          Bag 1: Loading (1 hr)
                        </span>
                        <div className="text-base font-black text-rose-800 dark:text-rose-200 mt-1">
                          {apapResult.nacIvRegimen21Hour.bag1Loading.doseMg} mg
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {apapResult.nacIvRegimen21Hour.bag1Loading.fluid} @ {apapResult.nacIvRegimen21Hour.bag1Loading.rateMlPerHour} mL/hr
                        </div>
                      </div>

                      <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl">
                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase">
                          Bag 2: Second (4 hrs)
                        </span>
                        <div className="text-base font-black text-amber-800 dark:text-amber-200 mt-1">
                          {apapResult.nacIvRegimen21Hour.bag2Second.doseMg} mg
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {apapResult.nacIvRegimen21Hour.bag2Second.fluid} @ {apapResult.nacIvRegimen21Hour.bag2Second.rateMlPerHour} mL/hr
                        </div>
                      </div>

                      <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800 rounded-xl">
                        <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase">
                          Bag 3: Maintenance (16 hrs)
                        </span>
                        <div className="text-base font-black text-blue-800 dark:text-blue-200 mt-1">
                          {apapResult.nacIvRegimen21Hour.bag3Maintenance.doseMg} mg
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {apapResult.nacIvRegimen21Hour.bag3Maintenance.fluid} @ {apapResult.nacIvRegimen21Hour.bag3Maintenance.rateMlPerHour} mL/hr
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: SALICYLATE ALKALINIZATION */}
      {activeTab === 'salicylate' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Droplets className="h-4 w-4 text-rose-500" />
              Salicylate Toxicity Inputs
            </h2>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Salicylate Level (mg/dL)
                </label>
                <input
                  type="number"
                  value={salLevel}
                  onChange={(e) => setSalLevel(Number(e.target.value))}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Arterial pH
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={salPh}
                  onChange={(e) => setSalPh(Number(e.target.value))}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Serum Potassium (mEq/L)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={salK}
                  onChange={(e) => setSalK(Number(e.target.value))}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Patient Weight (kg)
                </label>
                <input
                  type="number"
                  value={salWeight}
                  onChange={(e) => setSalWeight(Number(e.target.value))}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                />
              </div>

              <div className="flex flex-col gap-1.5 mt-2">
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={salAms}
                    onChange={(e) => setSalAms(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  Altered Mental Status / CNS Toxicity
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={salEdema}
                    onChange={(e) => setSalEdema(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  Non-Cardiogenic Pulmonary Edema
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={salRenal}
                    onChange={(e) => setSalRenal(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  Acute Kidney Injury / Renal Failure
                </label>
              </div>

              <button
                onClick={handleCalculateSalicylate}
                className="w-full mt-2 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg shadow-sm"
              >
                Compute Alkalinization & Dialysis Plan
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-4">
            {salResult && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">
                      SALICYLATE SEVERITY
                    </span>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                      {salResult.severity} Toxicity
                    </h3>
                  </div>

                  <div>
                    {salResult.hemodialysisIndicated ? (
                      <span className="px-3 py-1 bg-purple-100 dark:bg-purple-950/60 border border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300 font-black text-xs rounded-lg animate-pulse">
                        EMERGENT HEMODIALYSIS INDICATED
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-black text-xs rounded-lg">
                        Medical Alkalinization Sufficient
                      </span>
                    )}
                  </div>
                </div>

                {salResult.hemodialysisReasons.length > 0 && (
                  <div className="my-4 p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl">
                    <span className="text-xs font-bold text-purple-800 dark:text-purple-300 block mb-1">
                      Hemodialysis Thresholds Triggered:
                    </span>
                    <ul className="flex flex-col gap-1">
                      {salResult.hemodialysisReasons.map((r: string, idx: number) => (
                        <li key={idx} className="text-xs text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Bicarbonate Regimen */}
                <div className="my-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-2">
                    Urine Alkalinization Protocol (Ion Trapping)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 font-semibold block">IV Bicarbonate Bolus:</span>
                      <span className="text-base font-black text-rose-600 dark:text-rose-400">
                        {salResult.bicarbonateAlkalinizationRegimen.bolusDoseMeq} mEq (1.5 mEq/kg)
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-semibold block">Target Urine pH:</span>
                      <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                        {salResult.bicarbonateAlkalinizationRegimen.targetUrinePh}
                      </span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-slate-500 font-semibold block">Maintenance Infusion:</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">
                        {salResult.bicarbonateAlkalinizationRegimen.infusionDrip}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                    Clinical Directives:
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {salResult.clinicalDirectives.map((d: string, idx: number) => (
                      <div key={idx} className="p-2 text-xs bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300">
                        {d}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: TOXIC ALCOHOL OSMOLAR GAP */}
      {activeTab === 'toxic_alcohol' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Zap className="h-4 w-4 text-rose-500" />
              Osmolar Gap Laboratory Inputs
            </h2>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Suspected Agent
                </label>
                <select
                  value={suspectedAlcohol}
                  onChange={(e: any) => setSuspectedAlcohol(e.target.value)}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                >
                  <option value="METHANOL">Methanol (Windshield fluid, Moonshine)</option>
                  <option value="ETHYLENE_GLYCOL">Ethylene Glycol (Antifreeze)</option>
                  <option value="ISOPROPANOL">Isopropanol (Rubbing alcohol)</option>
                  <option value="UNKNOWN">Unknown Volatile Toxic Alcohol</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Measured Serum Osmolality (mOsm/kg)
                </label>
                <input
                  type="number"
                  value={measOsm}
                  onChange={(e) => setMeasOsm(Number(e.target.value))}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Sodium (Na+)</label>
                  <input
                    type="number"
                    value={naVal}
                    onChange={(e) => setNaVal(Number(e.target.value))}
                    className="w-full mt-1 p-1.5 text-xs border rounded bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Glucose (mg/dL)</label>
                  <input
                    type="number"
                    value={gluVal}
                    onChange={(e) => setGluVal(Number(e.target.value))}
                    className="w-full mt-1 p-1.5 text-xs border rounded bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">BUN (mg/dL)</label>
                  <input
                    type="number"
                    value={bunVal}
                    onChange={(e) => setBunVal(Number(e.target.value))}
                    className="w-full mt-1 p-1.5 text-xs border rounded bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Ethanol (mg/dL)</label>
                  <input
                    type="number"
                    value={etohVal}
                    onChange={(e) => setEtohVal(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Arterial pH</label>
                  <input
                    type="number"
                    step="0.01"
                    value={alcPh}
                    onChange={(e) => setAlcPh(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Patient Weight (kg)</label>
                <input
                  type="number"
                  value={alcWeight}
                  onChange={(e) => setAlcWeight(Number(e.target.value))}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                />
              </div>

              <button
                onClick={handleCalculateToxicAlcohol}
                className="w-full mt-2 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg shadow-sm"
              >
                Compute Osmolar Gap & Fomepizole Dosing
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-4">
            {alcoholResult && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">
                      OSMOLAR GAP RESULT
                    </span>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                      {alcoholResult.osmolarGap} mOsm/kg
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    {alcoholResult.isElevatedOsmolarGap ? (
                      <span className="px-3 py-1 bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-black text-xs rounded-lg animate-pulse">
                        ELEVATED GAP (&gt; 10)
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-black text-xs rounded-lg">
                        Normal Osmolar Gap
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-4">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Calculated Osm</span>
                    <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                      {alcoholResult.calculatedOsmolality} mOsm/kg
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Fomepizole Loading</span>
                    <span className="text-sm font-black text-rose-600 dark:text-rose-400">
                      {alcoholResult.fomepizoleLoadingDoseMg} mg (15 mg/kg)
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Hemodialysis</span>
                    <span className={`text-sm font-black ${alcoholResult.hemodialysisIndicated ? 'text-purple-600 dark:text-purple-400' : 'text-slate-600'}`}>
                      {alcoholResult.hemodialysisIndicated ? 'INDICATED' : 'Not Immediate'}
                    </span>
                  </div>
                </div>

                <div className="mt-4">
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-2">
                    Metabolic Co-Factor / Adjunctive Therapies:
                  </h4>
                  <div className="flex flex-col gap-1.5">
                    {alcoholResult.adjunctiveTherapies.map((adj: string, idx: number) => (
                      <div key={idx} className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-lg text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        {adj}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: HUNTER SEROTONIN TOXICITY */}
      {activeTab === 'hunter' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Brain className="h-4 w-4 text-rose-500" />
              Hunter Decision Nodes
            </h2>

            <div className="flex flex-col gap-2.5">
              <label className="flex items-center gap-2 text-xs font-bold text-rose-600 dark:text-rose-400 cursor-pointer p-2 bg-rose-50 dark:bg-rose-950/30 rounded-lg border border-rose-200 dark:border-rose-900">
                <input
                  type="checkbox"
                  checked={serotonergicAgent}
                  onChange={(e) => setSerotonergicAgent(e.target.checked)}
                  className="rounded text-rose-600"
                />
                Serotonergic Agent Ingested / Present
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={spontaneousClonus}
                  onChange={(e) => setSpontaneousClonus(e.target.checked)}
                  className="rounded text-rose-600"
                />
                Spontaneous Clonus (Pathognomonic)
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={inducibleClonus}
                  onChange={(e) => setInducibleClonus(e.target.checked)}
                  className="rounded text-rose-600"
                />
                Inducible Clonus (Ankles / Patella)
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ocularClonus}
                  onChange={(e) => setOcularClonus(e.target.checked)}
                  className="rounded text-rose-600"
                />
                Ocular Clonus (Slow rhythmic ocular oscillation)
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hunterAgitation}
                  onChange={(e) => setHunterAgitation(e.target.checked)}
                  className="rounded text-rose-600"
                />
                Agitation
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hunterDiaphoresis}
                  onChange={(e) => setHunterDiaphoresis(e.target.checked)}
                  className="rounded text-rose-600"
                />
                Diaphoresis
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hunterTremor}
                  onChange={(e) => setHunterTremor(e.target.checked)}
                  className="rounded text-rose-600"
                />
                Tremor
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hunterHyperreflexia}
                  onChange={(e) => setHunterHyperreflexia(e.target.checked)}
                  className="rounded text-rose-600"
                />
                Hyperreflexia
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hunterHypertonia}
                  onChange={(e) => setHunterHypertonia(e.target.checked)}
                  className="rounded text-rose-600"
                />
                Hypertonia (Lead-pipe / Cogwheel)
              </label>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Core Temp (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  value={hunterTemp}
                  onChange={(e) => setHunterTemp(Number(e.target.value))}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                />
              </div>

              <button
                onClick={handleEvaluateHunter}
                className="w-full mt-2 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg shadow-sm"
              >
                Assess Hunter Toxicity
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-4">
            {hunterResult && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">
                      HUNTER SEROTONIN CRITERIA
                    </span>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                      {hunterResult.isSerotoninSyndrome ? 'SEROTONIN TOXICITY CONFIRMED' : 'Hunter Criteria Negative'}
                    </h3>
                  </div>

                  <div>
                    {hunterResult.isSerotoninSyndrome ? (
                      <span className="px-3 py-1 bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-black text-xs rounded-lg animate-pulse uppercase">
                        {hunterResult.severity.replace(/_/g, ' ')}
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-black text-xs rounded-lg">
                        Rule-Out Serotonin Syndrome
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                    Diagnostic Rules Triggered:
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {hunterResult.criteriaMet.map((c: string, idx: number) => (
                      <div key={idx} className="p-2 text-xs bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-rose-500 shrink-0" />
                        {c}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                    Direct Interventions (Cyproheptadine & Sedation):
                  </span>
                  <div className="flex flex-col gap-2">
                    {hunterResult.interventions.map((iv: string, idx: number) => (
                      <div key={idx} className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-xs text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {iv}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 7: DIGIFAB CALCULATOR */}
      {activeTab === 'digifab' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Syringe className="h-4 w-4 text-rose-500" />
              Digoxin Overdose Scenario
            </h2>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Clinical Scenario</label>
                <select
                  value={digiScenario}
                  onChange={(e: any) => setDigiScenario(e.target.value)}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                >
                  <option value="KNOWN_INGESTION_AMOUNT">Acute Known Amount Ingested (mg)</option>
                  <option value="STEADY_STATE_SERUM_LEVEL">Chronic Steady-State Serum Level (ng/mL)</option>
                  <option value="EMPIRIC_ARREST">Acute Cardiac Arrest / Hemodynamic Collapse</option>
                </select>
              </div>

              {digiScenario === 'KNOWN_INGESTION_AMOUNT' && (
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Amount Ingested (mg)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={digiAmount}
                    onChange={(e) => setDigiAmount(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Vials = (mg ingested × 0.8) / 0.5 mg</span>
                </div>
              )}

              {digiScenario === 'STEADY_STATE_SERUM_LEVEL' && (
                <>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Digoxin Serum Level (ng/mL)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={digiLevel}
                      onChange={(e) => setDigiLevel(Number(e.target.value))}
                      className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Patient Weight (kg)</label>
                    <input
                      type="number"
                      value={digiWeight}
                      onChange={(e) => setDigiWeight(Number(e.target.value))}
                      className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Vials = (Level × Weight) / 100</span>
                  </div>
                </>
              )}

              <button
                onClick={handleCalculateDigiFab}
                className="w-full mt-2 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg shadow-sm"
              >
                Compute DigiFab Vials
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-4">
            {digiResult && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">
                      DIGIFAB DOSING RECOMMENDATION
                    </span>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                      {digiResult.vialsRecommended} Vials ({digiResult.mgFabTotal} mg Fab)
                    </h3>
                  </div>

                  <span className="px-3 py-1 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 font-black text-xs rounded-lg">
                    1 Vial binds 0.5 mg Digoxin
                  </span>
                </div>

                {digiResult.hyperkalemiaWarning && (
                  <div className="my-4 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl flex items-start gap-2.5">
                    <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold text-rose-800 dark:text-rose-300 block">
                        POTASSIUM & CALCIUM SAFETY WARNING
                      </span>
                      <p className="text-xs text-rose-700 dark:text-rose-300/90 mt-0.5">
                        {digiResult.hyperkalemiaWarning}
                      </p>
                    </div>
                  </div>
                )}

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                  <span className="text-slate-500 font-bold block mb-1">Administration Protocol:</span>
                  <p className="text-slate-800 dark:text-slate-200">
                    {digiResult.administrationInstructions}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* NEW CASE MODAL */}
      {showNewCaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl">
            <h3 className="text-base font-black text-slate-900 dark:text-white mb-3">
              Record New Toxicology Ingestion Case
            </h3>

            <form onSubmit={handleCreateCase} className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Substance Name</label>
                <input
                  type="text"
                  value={newSubstance}
                  onChange={(e) => setNewSubstance(e.target.value)}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  >
                    <option value="ACETAMINOPHEN">Acetaminophen</option>
                    <option value="SALICYLATE">Salicylate (Aspirin)</option>
                    <option value="TOXIC_ALCOHOL">Toxic Alcohol</option>
                    <option value="DIGOXIN">Digoxin</option>
                    <option value="ANTICHOLINERGIC">Anticholinergic</option>
                    <option value="ORGANOPHOSPHATE">Organophosphate</option>
                    <option value="OPIOID">Opioid</option>
                    <option value="UNKNOWN">Unknown / Polypharmacy</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Hours Ago</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newHoursAgo}
                    onChange={(e) => setNewHoursAgo(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Amount (mg or units)</label>
                  <input
                    type="number"
                    value={newAmount}
                    onChange={(e) => setNewAmount(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Patient Weight (kg)</label>
                  <input
                    type="number"
                    value={newWeight}
                    onChange={(e) => setNewWeight(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Serum Level</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newLevel}
                    onChange={(e) => setNewLevel(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Unit</label>
                  <input
                    type="text"
                    value={newLevelUnit}
                    onChange={(e) => setNewLevelUnit(e.target.value)}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewCaseModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg shadow-sm"
                >
                  Save Ingestion Case
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ANTIDOTE ADMINISTRATION MODAL */}
      {showAntidoteModal && selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl">
            <h3 className="text-base font-black text-slate-900 dark:text-white mb-1">
              Administer Antidote
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Case #{selectedCase.poison_control_case_number} ({selectedCase.substance_name})
            </p>

            <form onSubmit={handleRecordAntidote} className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Antidote Name</label>
                <input
                  type="text"
                  value={adminAntidote}
                  onChange={(e) => setAdminAntidote(e.target.value)}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Dose</label>
                  <input
                    type="number"
                    value={adminDose}
                    onChange={(e) => setAdminDose(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Unit</label>
                  <input
                    type="text"
                    value={adminUnit}
                    onChange={(e) => setAdminUnit(e.target.value)}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Route</label>
                  <select
                    value={adminRoute}
                    onChange={(e) => setAdminRoute(e.target.value)}
                    className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                  >
                    <option value="IV">IV</option>
                    <option value="PO">PO</option>
                    <option value="IM">IM</option>
                    <option value="IN">IN</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Clinical Notes</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={2}
                  className="w-full mt-1 p-2 text-xs border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                />
              </div>

              <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAntidoteModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg shadow-sm"
                >
                  Record Administration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
