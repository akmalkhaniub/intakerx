import React, { useState, useEffect } from 'react';
import {
  Dna,
  Activity,
  Award,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Search,
  Plus,
  ShieldCheck,
  CheckCircle,
  X,
  Target,
  FileText
} from 'lucide-react';

interface GenomicVariant {
  id: number;
  patientId: number;
  patientName: string;
  geneSymbol: string;
  variantNomenclature: string;
  variantAlleleFrequency: number;
  ampTier: string;
  actionableDrugTarget: string;
  evidenceLevel: string;
  createdAt: string;
}

interface ClinicalTrialMatch {
  trialId: string;
  title: string;
  phase: string;
  matchedBiomarker: string;
  mechanism: string;
  recruitingStatus: string;
}

interface PathwayRecord {
  id: number;
  patientId: number;
  patientName: string;
  cancerType: string;
  histology: string;
  clinicalStage: string;
  biomarkerProfile: Record<string, any>;
  proposedRegimen: string;
  nccnConcordance: 'concordant' | 'concordant_with_modifications' | 'non_concordant_review_required';
  bsaM2: number;
  calvertAucDoseMg?: number | null;
  mtbRecommendation: string;
  clinicalTrialMatches: ClinicalTrialMatch[];
  status: string;
  oncologistSignature: string;
  createdAt: string;
}

interface OncologySummaryData {
  metrics: {
    totalTumorBoardCases: number;
    nccnConcordanceRate: number;
    tierIActionableVariants: number;
    precisionTrialsMatched: number;
    activeRegimensOnboarded: number;
  };
  recentPathways: PathwayRecord[];
  recentVariants: GenomicVariant[];
}

const PRESET_ONCOLOGY_CASES = [
  {
    title: 'Stage IVB NSCLC - EGFR Sensitizing Mutation',
    patientName: 'Genevieve Moreau (60F)',
    patientId: 1,
    cancerType: 'Non-Small Cell Lung Cancer',
    histology: 'Adenocarcinoma',
    stage: 'Stage IVB',
    regimen: 'Osimertinib 80mg daily monotherapy',
    biomarkers: { egfrMutation: 'p.L858R', pdl1Tps: '65%', alkFusion: false },
    heightCm: 168,
    weightKg: 62,
    gfr: 90,
    targetAuc: 0
  },
  {
    title: 'Stage IV Colorectal - RAS Mutation Anti-EGFR Divergence Test',
    patientName: 'Arthur Pendelton (67M)',
    patientId: 2,
    cancerType: 'Colorectal Adenocarcinoma',
    histology: 'Adenocarcinoma',
    stage: 'Stage IV',
    regimen: 'Cetuximab 400mg/m2 IV monotherapy',
    biomarkers: { krasStatus: 'mutant', msiStatus: 'MSS', brafStatus: 'wild-type' },
    heightCm: 178,
    weightKg: 82,
    gfr: 75,
    targetAuc: 0
  },
  {
    title: 'Stage IIIB Triple-Negative Breast - BRCA1 Loss-of-Function',
    patientName: 'Helena Rostova (44F)',
    patientId: 3,
    cancerType: 'Invasive Breast Carcinoma',
    histology: 'Triple-Negative (ER-/PR-/HER2-)',
    stage: 'Stage IIIB',
    regimen: 'Carboplatin (AUC 5) + Paclitaxel weekly + Olaparib',
    biomarkers: { brca1Status: 'pathogenic_mutation', pdl1Cps: 12 },
    heightCm: 164,
    weightKg: 58,
    gfr: 80,
    targetAuc: 5
  }
];

export const GenomicTumorBoard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pathways' | 'variants'>('pathways');
  const [summaryData, setSummaryData] = useState<OncologySummaryData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);

  // Form State for Pathway Navigator
  const [selectedCaseIdx, setSelectedCaseIdx] = useState<number>(0);
  const [patientIdInput, setPatientIdInput] = useState<number>(1);
  const [cancerTypeInput, setCancerTypeInput] = useState<string>(PRESET_ONCOLOGY_CASES[0].cancerType);
  const [histologyInput, setHistologyInput] = useState<string>(PRESET_ONCOLOGY_CASES[0].histology);
  const [stageInput, setStageInput] = useState<string>(PRESET_ONCOLOGY_CASES[0].stage);
  const [regimenInput, setRegimenInput] = useState<string>(PRESET_ONCOLOGY_CASES[0].regimen);
  const [heightInput, setHeightInput] = useState<number>(PRESET_ONCOLOGY_CASES[0].heightCm);
  const [weightInput, setWeightInput] = useState<number>(PRESET_ONCOLOGY_CASES[0].weightKg);
  const [gfrInput, setGfrInput] = useState<number>(PRESET_ONCOLOGY_CASES[0].gfr);
  const [targetAucInput, setTargetAucInput] = useState<number>(PRESET_ONCOLOGY_CASES[0].targetAuc);
  const [evaluatedResult, setEvaluatedResult] = useState<PathwayRecord | null>(null);

  // New Variant Modal State
  const [showVariantModal, setShowVariantModal] = useState<boolean>(false);
  const [variantGene, setVariantGene] = useState<string>('EGFR');
  const [variantNomenclature, setVariantNomenclature] = useState<string>('p.L858R');
  const [variantVaf, setVariantVaf] = useState<number>(42.0);

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/clinician/oncology/summary');
      if (res.ok) {
        const data = await res.json();
        setSummaryData(data);
      }
    } catch (err) {
      console.error('Failed to fetch oncology summary:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCase = (idx: number) => {
    setSelectedCaseIdx(idx);
    const c = PRESET_ONCOLOGY_CASES[idx];
    setPatientIdInput(c.patientId);
    setCancerTypeInput(c.cancerType);
    setHistologyInput(c.histology);
    setStageInput(c.stage);
    setRegimenInput(c.regimen);
    setHeightInput(c.heightCm);
    setWeightInput(c.weightKg);
    setGfrInput(c.gfr);
    setTargetAucInput(c.targetAuc);
    setEvaluatedResult(null);
  };

  const handleEvaluatePathway = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsEvaluating(true);
      const activeCase = PRESET_ONCOLOGY_CASES[selectedCaseIdx];
      const res = await fetch('/api/clinician/oncology/pathway-evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: patientIdInput,
          cancerType: cancerTypeInput,
          histology: histologyInput,
          clinicalStage: stageInput,
          proposedRegimen: regimenInput,
          biomarkerProfile: activeCase.biomarkers,
          heightCm: heightInput,
          weightKg: weightInput,
          gfr: gfrInput,
          targetCarboplatinAuc: targetAucInput > 0 ? targetAucInput : undefined,
          oncologistSignature: 'Dr. Alexander Vance, MD (Thoracic/Genomic Oncology)'
        })
      });

      if (res.ok) {
        const data = await res.json();
        setEvaluatedResult(data);
        fetchSummary();
      }
    } catch (err) {
      console.error('Pathway evaluation error:', err);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleAddVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/clinician/oncology/variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: patientIdInput,
          geneSymbol: variantGene,
          variantNomenclature: variantNomenclature,
          variantAlleleFrequency: variantVaf
        })
      });

      if (res.ok) {
        setShowVariantModal(false);
        fetchSummary();
      }
    } catch (err) {
      console.error('Add variant error:', err);
    }
  };

  const getConcordanceBadge = (status: string) => {
    switch (status) {
      case 'concordant':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
            <CheckCircle className="h-3.5 w-3.5" /> NCCN Concordant (Category 1)
          </span>
        );
      case 'concordant_with_modifications':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" /> Concordant With Modifications
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-950 text-rose-300 border border-rose-800 flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" /> NCCN Divergence - Review Required
          </span>
        );
    }
  };

  // Real-time Mosteller BSA calculation
  const calculatedBsa = Math.round(Math.sqrt((heightInput * weightInput) / 3600) * 100) / 100;
  // Real-time Calvert Carboplatin calculation
  const calculatedCarboplatin = targetAucInput > 0 ? Math.round(targetAucInput * (Math.min(gfrInput, 125) + 25)) : null;

  const metrics = summaryData?.metrics || {
    totalTumorBoardCases: 0,
    nccnConcordanceRate: 100,
    tierIActionableVariants: 0,
    precisionTrialsMatched: 0,
    activeRegimensOnboarded: 0
  };

  return (
    <div className="flex flex-col gap-6 p-6 bg-slate-950 text-slate-100 min-h-screen">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-xl bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 border border-purple-800/40 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl">
            <Dna className="h-8 w-8 text-purple-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Genomic Tumor Board & NCCN Pathway Navigator
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                Phase 44 Enterprise
              </span>
            </div>
            <p className="text-sm text-slate-300 mt-1">
              Next-Gen Sequencing (NGS) Actionability Matching, NCCN Guideline Concordance & Calvert/Mosteller Dose Optimization
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
            Refresh MTB Data
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Total MTB Cases</span>
          <div className="text-2xl font-extrabold text-white mt-1">{metrics.totalTumorBoardCases}</div>
          <span className="text-[10px] text-purple-400 mt-1 flex items-center gap-1">
            <Activity className="h-3 w-3" /> Multidisciplinary Reviewed
          </span>
        </div>

        <div className="p-4 bg-slate-900/90 border border-emerald-900/40 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-emerald-400">NCCN Concordance Rate</span>
          <div className="text-2xl font-extrabold text-emerald-300 mt-1">{metrics.nccnConcordanceRate}%</div>
          <span className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" /> Guideline Aligned
          </span>
        </div>

        <div className="p-4 bg-slate-900/90 border border-purple-900/40 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-purple-400">Tier I Actionable Biomarkers</span>
          <div className="text-2xl font-extrabold text-purple-300 mt-1">{metrics.tierIActionableVariants}</div>
          <span className="text-[10px] text-purple-400 mt-1 flex items-center gap-1">
            <Target className="h-3 w-3" /> FDA Approved Targets
          </span>
        </div>

        <div className="p-4 bg-slate-900/90 border border-indigo-900/40 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-indigo-400">Precision Trials Matched</span>
          <div className="text-2xl font-extrabold text-indigo-300 mt-1">{metrics.precisionTrialsMatched}</div>
          <span className="text-[10px] text-indigo-400 mt-1 flex items-center gap-1">
            <Award className="h-3 w-3" /> Active Basket / Biomarker Trials
          </span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab('pathways')}
          className={`pb-3 font-semibold text-sm transition flex items-center gap-2 ${
            activeTab === 'pathways'
              ? 'text-purple-400 border-b-2 border-purple-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Target className="h-4 w-4" />
          NCCN Clinical Pathway Navigator
        </button>
        <button
          onClick={() => setActiveTab('variants')}
          className={`pb-3 font-semibold text-sm transition flex items-center gap-2 ${
            activeTab === 'variants'
              ? 'text-purple-400 border-b-2 border-purple-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Dna className="h-4 w-4" />
          NGS Genomic Biomarkers Catalog
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-purple-500 text-slate-950 font-bold">
            {summaryData?.recentVariants.length || 0}
          </span>
        </button>
      </div>

      {/* Tab 1: Pathway Navigator */}
      {activeTab === 'pathways' && (
        <div className="space-y-6">
          {/* Preset Case Cards */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-3 block">
              Load Tumor Board Case Scenario:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PRESET_ONCOLOGY_CASES.map((c, idx) => (
                <button
                  key={c.title}
                  onClick={() => loadCase(idx)}
                  className={`p-3 rounded-lg border text-left transition text-xs ${
                    selectedCaseIdx === idx
                      ? 'bg-purple-950/60 border-purple-500 text-purple-200 shadow-md'
                      : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="font-bold text-white flex items-center justify-between">
                    <span>{c.cancerType}</span>
                    <Sparkles className="h-3 w-3 text-purple-400" />
                  </div>
                  <div className="mt-1 text-slate-400 font-mono">{c.stage} • {c.histology}</div>
                  <div className="text-[11px] text-purple-300 mt-1">Patient: {c.patientName}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Form & Live Calculations */}
          <form onSubmit={handleEvaluatePathway} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <FileText className="h-4 w-4 text-purple-400" />
                Case Pathway & Dosing Parameters
              </h3>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="text-slate-300">
                  Calculated Mosteller BSA: <strong className="text-purple-400">{calculatedBsa} m²</strong>
                </span>
                {calculatedCarboplatin !== null && (
                  <span className="text-slate-300">
                    Calvert Carboplatin: <strong className="text-teal-400">{calculatedCarboplatin} mg</strong>
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Malignancy / Cancer Type:</label>
                <input
                  type="text"
                  value={cancerTypeInput}
                  onChange={(e) => setCancerTypeInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  required
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Tumor Histology:</label>
                <input
                  type="text"
                  value={histologyInput}
                  onChange={(e) => setHistologyInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  required
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Clinical AJCC TNM Stage:</label>
                <input
                  type="text"
                  value={stageInput}
                  onChange={(e) => setStageInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-slate-400 block mb-1">Proposed Chemotherapy / Targeted Regimen:</label>
                <input
                  type="text"
                  value={regimenInput}
                  onChange={(e) => setRegimenInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Target Carboplatin AUC (if applicable):</label>
                <input
                  type="number"
                  step="0.5"
                  value={targetAucInput}
                  onChange={(e) => setTargetAucInput(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Patient Height (cm):</label>
                <input
                  type="number"
                  value={heightInput}
                  onChange={(e) => setHeightInput(parseFloat(e.target.value) || 170)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Patient Weight (kg):</label>
                <input
                  type="number"
                  value={weightInput}
                  onChange={(e) => setWeightInput(parseFloat(e.target.value) || 70)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Serum GFR / CrCl (mL/min):</label>
                <input
                  type="number"
                  value={gfrInput}
                  onChange={(e) => setGfrInput(parseFloat(e.target.value) || 90)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono"
                  required
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="submit"
                disabled={isEvaluating}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-lg shadow-lg transition"
              >
                <Sparkles className="h-4 w-4" />
                {isEvaluating ? 'Evaluating Pathway...' : 'Evaluate NCCN Concordance & MTB Consensus'}
              </button>
            </div>
          </form>

          {/* Evaluated Pathway Results Display */}
          {evaluatedResult && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-purple-400" />
                  <h3 className="text-base font-bold text-white">
                    Tumor Board Clinical Recommendation
                  </h3>
                </div>
                {getConcordanceBadge(evaluatedResult.nccnConcordance)}
              </div>

              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 text-xs space-y-2">
                <div className="font-semibold text-slate-200">{evaluatedResult.mtbRecommendation}</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-slate-400">
                  <div>BSA: <strong className="text-white font-mono">{evaluatedResult.bsaM2} m²</strong></div>
                  {evaluatedResult.calvertAucDoseMg && (
                    <div>Carboplatin Dose: <strong className="text-teal-400 font-mono">{evaluatedResult.calvertAucDoseMg} mg</strong></div>
                  )}
                  <div>Stage: <strong className="text-white">{evaluatedResult.clinicalStage}</strong></div>
                  <div>Attending: <strong className="text-purple-300">{evaluatedResult.oncologistSignature}</strong></div>
                </div>
              </div>

              {/* Matched Precision Clinical Trials */}
              {evaluatedResult.clinicalTrialMatches?.length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="text-xs uppercase font-bold text-indigo-400 tracking-wider flex items-center gap-1.5">
                    <Search className="h-3.5 w-3.5" />
                    Matched Precision Oncology Clinical Trials:
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {evaluatedResult.clinicalTrialMatches.map((t, idx) => (
                      <div key={idx} className="p-3 bg-slate-950 border border-indigo-900/40 rounded-lg text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-indigo-300 font-mono">{t.trialId}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800">
                            {t.phase}
                          </span>
                        </div>
                        <div className="font-semibold text-white mt-1">{t.title}</div>
                        <div className="text-slate-400 mt-1">Biomarker: <strong className="text-purple-400">{t.matchedBiomarker}</strong></div>
                        <div className="text-[11px] text-teal-400 mt-1">{t.mechanism}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Historical Pathway Records Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="font-bold text-sm text-slate-200 mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-400" />
              Recent Molecular Tumor Board Reviews
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-[11px] uppercase bg-slate-800/60 text-slate-400">
                  <tr>
                    <th className="p-2.5">ID</th>
                    <th className="p-2.5">Patient</th>
                    <th className="p-2.5">Cancer / Histology</th>
                    <th className="p-2.5">Proposed Regimen</th>
                    <th className="p-2.5">NCCN Concordance</th>
                    <th className="p-2.5">BSA / Dose</th>
                    <th className="p-2.5">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {summaryData?.recentPathways.map((path) => (
                    <tr key={path.id} className="hover:bg-slate-800/40">
                      <td className="p-2.5 font-mono text-slate-400">#{path.id}</td>
                      <td className="p-2.5 font-bold text-white">{path.patientName}</td>
                      <td className="p-2.5 text-slate-300">
                        {path.cancerType} ({path.clinicalStage})
                      </td>
                      <td className="p-2.5 font-mono text-purple-300">{path.proposedRegimen}</td>
                      <td className="p-2.5">{getConcordanceBadge(path.nccnConcordance)}</td>
                      <td className="p-2.5 text-slate-400 font-mono">
                        {path.bsaM2} m² {path.calvertAucDoseMg ? `• ${path.calvertAucDoseMg}mg` : ''}
                      </td>
                      <td className="p-2.5 text-slate-400">
                        {new Date(path.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Genomic Variants Catalog */}
      {activeTab === 'variants' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Dna className="h-5 w-5 text-purple-400" />
              Somatic NGS Biomarker Catalog
            </h3>
            <button
              onClick={() => setShowVariantModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition shadow"
            >
              <Plus className="h-3.5 w-3.5" />
              Log Somatic Variant
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {summaryData?.recentVariants.map((v) => (
              <div
                key={v.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 hover:border-purple-800/60 transition"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-base text-purple-300 font-mono">{v.geneSymbol}</span>
                    <span className="text-xs text-white font-mono">{v.variantNomenclature}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    v.ampTier === 'Tier_I' ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {v.ampTier.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Patient:</span>
                    <span className="text-slate-200 font-semibold">{v.patientName}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Variant Allele Freq (VAF):</span>
                    <span className="text-teal-400 font-mono font-bold">{v.variantAlleleFrequency}%</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Evidence Level:</span>
                    <span className="text-white capitalize">{v.evidenceLevel.replace(/_/g, ' ')}</span>
                  </div>
                </div>

                <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-xs">
                  <span className="text-[10px] text-slate-400 block mb-0.5">Matched Targeted Agent:</span>
                  <span className="font-bold text-emerald-400">{v.actionableDrugTarget}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Log Genomic Variant */}
      {showVariantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Dna className="h-5 w-5 text-purple-400" />
                Ingest NGS Somatic Mutation
              </h3>
              <button onClick={() => setShowVariantModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddVariant} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Gene Symbol:</label>
                <select
                  value={variantGene}
                  onChange={(e) => setVariantGene(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono"
                >
                  <option value="EGFR">EGFR</option>
                  <option value="KRAS">KRAS</option>
                  <option value="BRAF">BRAF</option>
                  <option value="ERBB2">ERBB2 / HER2</option>
                  <option value="BRCA1">BRCA1</option>
                  <option value="ALK">ALK</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Variant Nomenclature (cDNA / Protein):</label>
                <input
                  type="text"
                  value={variantNomenclature}
                  onChange={(e) => setVariantNomenclature(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono"
                  placeholder="e.g. p.L858R or p.G12C"
                  required
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Variant Allele Frequency (% VAF):</label>
                <input
                  type="number"
                  step="0.1"
                  value={variantVaf}
                  onChange={(e) => setVariantVaf(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowVariantModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded font-bold shadow"
                >
                  Save Biomarker
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
