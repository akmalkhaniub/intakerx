import React, { useState, useEffect, useCallback } from 'react';
import {
  FileCode, CheckCircle2, AlertTriangle, ArrowUpRight,
  TrendingUp, RefreshCw, Save, ShieldCheck, HelpCircle
} from 'lucide-react';

export interface CodeMappingItem {
  code: string;
  codeSystem: 'ICD-10-CM' | 'ICD-11' | 'SNOMED-CT' | 'CPT';
  description: string;
  confidenceScore: number;
  evidenceExcerpt: string;
  specificityLevel: 'high' | 'moderate' | 'unspecified_risk';
  category: 'primary_diagnosis' | 'secondary_diagnosis' | 'procedure' | 'comorbidity';
  laterality?: 'right' | 'left' | 'bilateral' | 'unspecified';
  crossMappings: {
    icd11?: { code: string; title: string };
    snomedCt?: { code: string; title: string };
    cptSuggested?: { code: string; title: string };
  };
  accepted?: boolean;
}

export interface SpecificityRecommendationItem {
  originalCode: string;
  codeSystem: string;
  issue: string;
  recommendation: string;
  clarificationQuery: string;
  suggestedUpgrades: Array<{ code: string; description: string; revenueDelta: number }>;
}

export interface CacAnalysisData {
  sessionId: string;
  suggestedCodes: CodeMappingItem[];
  specificityRecommendations: SpecificityRecommendationItem[];
  downcodingRiskScore: number;
  revenueImpactEstimate: number;
  documentationCompleteness: number;
  summary: string;
}

interface ComputerAssistedCodingProps {
  sessionId?: string;
  token?: string;
  backendUrl?: string;
  patientName?: string;
}

export const ComputerAssistedCoding: React.FC<ComputerAssistedCodingProps> = ({
  sessionId,
  token,
  backendUrl = '',
  patientName = 'Encounter Patient'
}) => {
  const [analysis, setAnalysis] = useState<CacAnalysisData | null>(null);
  const [selectedCodes, setSelectedCodes] = useState<Record<string, boolean>>({});
  const [customNotes, setCustomNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'codes' | 'cdi' | 'crosswalk'>('codes');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [cacDbId, setCacDbId] = useState<number | null>(null);

  const fetchCacData = useCallback(async () => {
    if (!sessionId) return;
    setIsLoading(true);
    try {
      // Check existing CAC records
      const existingRes = await fetch(`${backendUrl}/api/clinician/cac/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (existingRes.ok) {
        const data = await existingRes.json();
        if (data && data.length > 0) {
          const latest = data[0];
          setCacDbId(latest.id);
          const initialCodes: CodeMappingItem[] = latest.suggested_codes || [];
          setAnalysis({
            sessionId,
            suggestedCodes: initialCodes,
            specificityRecommendations: latest.specificity_recommendations || [],
            downcodingRiskScore: latest.downcoding_risk_score || 0,
            revenueImpactEstimate: parseFloat(latest.revenue_impact_estimate || '0'),
            documentationCompleteness: Math.max(40, 100 - (latest.downcoding_risk_score || 0)),
            summary: `Retrieved saved CAC record #${latest.id} with ${initialCodes.length} billable suggestions.`
          });
          const initialSelection: Record<string, boolean> = {};
          initialCodes.forEach(c => {
            initialSelection[c.code] = true;
          });
          setSelectedCodes(initialSelection);
          setIsLoading(false);
          return;
        }
      }

      // If no existing record, run autonomous analysis
      await runAnalysis();
    } catch (err) {
      console.error('Failed to load CAC data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, backendUrl, token]);

  useEffect(() => {
    fetchCacData();
  }, [fetchCacData]);

  const runAnalysis = async () => {
    if (!sessionId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/clinician/cac/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          sessionId,
          customClinicalText: customNotes.trim() ? customNotes : undefined
        })
      });
      if (res.ok) {
        const data: CacAnalysisData = await res.json();
        setAnalysis(data);
        const sel: Record<string, boolean> = {};
        data.suggestedCodes.forEach(c => {
          sel[c.code] = true;
        });
        setSelectedCodes(sel);

        // Fetch back DB ID
        const existingRes = await fetch(`${backendUrl}/api/clinician/cac/sessions/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (existingRes.ok) {
          const list = await existingRes.json();
          if (list && list.length > 0) setCacDbId(list[0].id);
        }
      }
    } catch (err) {
      console.error('Error running CAC analysis:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCodeSelection = (codeStr: string) => {
    setSelectedCodes(prev => ({
      ...prev,
      [codeStr]: !prev[codeStr]
    }));
  };

  const applyUpgrade = (originalCode: string, upgradeCode: string, upgradeDesc: string) => {
    if (!analysis) return;
    const updatedCodes = analysis.suggestedCodes.map(c => {
      if (c.code === originalCode) {
        return {
          ...c,
          code: upgradeCode,
          description: upgradeDesc,
          specificityLevel: 'high' as const,
          confidenceScore: 98
        };
      }
      return c;
    });

    const updatedRecs = analysis.specificityRecommendations.filter(r => r.originalCode !== originalCode);
    const newRisk = Math.max(0, analysis.downcodingRiskScore - 25);

    setAnalysis({
      ...analysis,
      suggestedCodes: updatedCodes,
      specificityRecommendations: updatedRecs,
      downcodingRiskScore: newRisk,
      documentationCompleteness: Math.min(100, 100 - newRisk),
      revenueImpactEstimate: Math.max(0, analysis.revenueImpactEstimate - 65)
    });

    setSelectedCodes(prev => ({
      ...prev,
      [originalCode]: false,
      [upgradeCode]: true
    }));
  };

  const handleReviewAndSign = async () => {
    if (!cacDbId || !analysis) return;
    setIsSaving(true);
    try {
      const acceptedList = analysis.suggestedCodes.filter(c => selectedCodes[c.code]);
      const res = await fetch(`${backendUrl}/api/clinician/cac/review/${cacDbId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          acceptedCodes: acceptedList,
          clinicianFeedback: `Clinician approved ${acceptedList.length} billable codes with CDI crosswalk verified.`
        })
      });
      if (res.ok) {
        setSaveSuccessMsg(`Signed off ${acceptedList.length} billable codes successfully!`);
        setTimeout(() => setSaveSuccessMsg(''), 4000);
      }
    } catch (err) {
      console.error('Failed to sign off codes:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-100 shadow-xl space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
              <FileCode className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold tracking-tight text-white">
              Autonomous Computer-Assisted Coding (CAC)
            </h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Dual ICD-10-CM / ICD-11 &amp; SNOMED CT Semantic Crosswalk Engine • Patient: <span className="text-indigo-300 font-semibold">{patientName}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={runAnalysis}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Extracting...' : 'Re-Run CAC'}
          </button>
          <button
            onClick={handleReviewAndSign}
            disabled={isSaving || !analysis}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg transition"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Signing...' : 'Sign & Approve Codes'}
          </button>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          {saveSuccessMsg}
        </div>
      )}

      {/* KPI Metrics Strip */}
      {analysis && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Suggested Codes</span>
              <FileCode className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {analysis.suggestedCodes.length}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {analysis.suggestedCodes.filter(c => selectedCodes[c.code]).length} approved for claim
            </div>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Completeness</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400">
              {analysis.documentationCompleteness}%
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Clinical specificity score
            </div>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Downcoding Risk</span>
              <AlertTriangle className={`w-4 h-4 ${analysis.downcodingRiskScore > 20 ? 'text-amber-400' : 'text-emerald-400'}`} />
            </div>
            <div className={`text-2xl font-bold ${analysis.downcodingRiskScore > 20 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {analysis.downcodingRiskScore}/100
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {analysis.downcodingRiskScore > 20 ? 'Actionable CDI alerts pending' : 'Low audit/denial risk'}
            </div>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Reimbursement Delta</span>
              <TrendingUp className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-cyan-400">
              +${analysis.revenueImpactEstimate.toFixed(2)}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Potential gain via CDI upgrades
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-6 text-sm">
        <button
          onClick={() => setActiveTab('codes')}
          className={`pb-3 font-medium transition ${activeTab === 'codes' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Extracted Codes &amp; Acceptance ({analysis?.suggestedCodes.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('cdi')}
          className={`pb-3 font-medium transition ${activeTab === 'cdi' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-400 hover:text-slate-200'}`}
        >
          CDI Specificity Queries ({analysis?.specificityRecommendations.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('crosswalk')}
          className={`pb-3 font-medium transition ${activeTab === 'crosswalk' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Dual Crosswalk Matrix (ICD-11 &amp; SNOMED CT)
        </button>
      </div>

      {/* Tab 1: Extracted Codes */}
      {activeTab === 'codes' && (
        <div className="space-y-4">
          <div className="divide-y divide-slate-800/60 border border-slate-800 rounded-lg overflow-hidden bg-slate-950/40">
            {analysis?.suggestedCodes.map((item, idx) => {
              const isSelected = !!selectedCodes[item.code];
              return (
                <div key={idx} className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-slate-900/60 transition">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleCodeSelection(item.code)}
                      className={`mt-1 p-1 rounded transition ${isSelected ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-600 hover:text-slate-400'}`}
                    >
                      <CheckCircle2 className={`w-5 h-5 ${isSelected ? 'fill-indigo-500/20' : ''}`} />
                    </button>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded text-sm">
                          {item.code}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 font-medium">
                          {item.codeSystem}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                          item.specificityLevel === 'high' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {item.specificityLevel === 'high' ? 'High Specificity' : 'Unspecified Risk'}
                        </span>
                        <span className="text-xs text-slate-500 font-mono">
                          Confidence: {item.confidenceScore}%
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-200 mt-1">
                        {item.description}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 italic">
                        &quot;{item.evidenceExcerpt}&quot;
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center">
                    <span className="text-xs text-slate-400 uppercase tracking-wider bg-slate-900 border border-slate-800 px-2 py-1 rounded">
                      {item.category.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Custom Text Re-Analysis */}
          <div className="bg-slate-950/40 p-4 rounded-lg border border-slate-800 space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Test Free-Text Clinical Note or Pathology Excerpt for CAC Extraction
            </label>
            <textarea
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              placeholder="e.g., Patient with progressive severe right knee gonarthrosis. Known essential hypertension and type 2 diabetes with peripheral neuropathy..."
              rows={2}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            />
            <div className="flex justify-end">
              <button
                onClick={runAnalysis}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              >
                Extract from Custom Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: CDI Specificity Queries */}
      {activeTab === 'cdi' && (
        <div className="space-y-4">
          {(!analysis?.specificityRecommendations || analysis.specificityRecommendations.length === 0) ? (
            <div className="p-8 text-center bg-slate-950/40 border border-slate-800 rounded-lg text-slate-400">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="font-semibold text-white">No Clinical Documentation Ambiguities Detected</p>
              <p className="text-xs text-slate-500 mt-1">All billable codes meet high laterality and clinical specificity standards.</p>
            </div>
          ) : (
            analysis.specificityRecommendations.map((rec, idx) => (
              <div key={idx} className="p-4 bg-slate-950/60 border border-amber-500/30 rounded-lg space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="p-1.5 bg-amber-500/10 text-amber-400 rounded border border-amber-500/20 mt-0.5">
                      <HelpCircle className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="font-semibold text-amber-200 text-sm">{rec.issue}</h4>
                      <p className="text-xs text-slate-400 mt-1 font-mono bg-slate-900/80 p-2 rounded border border-slate-800">
                        Query: &quot;{rec.clarificationQuery}&quot;
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pl-9 space-y-2">
                  <span className="text-xs text-slate-400 font-semibold block">Suggested High-Specificity Upgrades:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {rec.suggestedUpgrades.map((u, uIdx) => (
                      <div key={uIdx} className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-white bg-slate-800 px-1.5 py-0.5 rounded">
                              {u.code}
                            </span>
                            <span className="text-xs text-emerald-400 font-semibold">
                              +${u.revenueDelta.toFixed(2)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 mt-0.5">{u.description}</p>
                        </div>
                        <button
                          onClick={() => applyUpgrade(rec.originalCode, u.code, u.description)}
                          className="px-2.5 py-1 text-xs rounded bg-indigo-600/80 hover:bg-indigo-600 text-white flex items-center gap-1 transition"
                        >
                          Upgrade <ArrowUpRight className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Dual Crosswalk Matrix */}
      {activeTab === 'crosswalk' && (
        <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/40">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="p-3">ICD-10-CM (US Billing)</th>
                <th className="p-3">ICD-11 (WHO Standard)</th>
                <th className="p-3">SNOMED CT (Semantic EHR)</th>
                <th className="p-3">E&amp;M CPT Pairing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {analysis?.suggestedCodes.map((c, i) => (
                <tr key={i} className="hover:bg-slate-900/50">
                  <td className="p-3">
                    <span className="text-white font-bold">{c.code}</span>
                    <span className="block text-slate-400 font-sans text-xs mt-0.5">{c.description}</span>
                  </td>
                  <td className="p-3 text-cyan-300">
                    {c.crossMappings.icd11 ? (
                      <>
                        <span className="font-bold">{c.crossMappings.icd11.code}</span>
                        <span className="block text-slate-400 font-sans text-xs mt-0.5">{c.crossMappings.icd11.title}</span>
                      </>
                    ) : (
                      <span className="text-slate-600">--</span>
                    )}
                  </td>
                  <td className="p-3 text-indigo-300">
                    {c.crossMappings.snomedCt ? (
                      <>
                        <span className="font-bold">{c.crossMappings.snomedCt.code}</span>
                        <span className="block text-slate-400 font-sans text-xs mt-0.5">{c.crossMappings.snomedCt.title}</span>
                      </>
                    ) : (
                      <span className="text-slate-600">--</span>
                    )}
                  </td>
                  <td className="p-3 text-emerald-300">
                    {c.crossMappings.cptSuggested ? (
                      <>
                        <span className="font-bold">{c.crossMappings.cptSuggested.code}</span>
                        <span className="block text-slate-400 font-sans text-xs mt-0.5">{c.crossMappings.cptSuggested.title}</span>
                      </>
                    ) : (
                      <span className="text-slate-600">--</span>
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
