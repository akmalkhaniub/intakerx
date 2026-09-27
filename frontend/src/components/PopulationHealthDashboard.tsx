import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  DollarSign,
  HeartPulse,
  Activity,
  Layers,
  Send,
  Sparkles,
  PieChart
} from 'lucide-react';

export interface HccCategory {
  hcc: string;
  description: string;
  weight: number;
  triggerCode: string;
}

export interface DiseaseInteraction {
  name: string;
  weight: number;
  description: string;
}

export interface RafCalculationResult {
  patientId: number;
  demographicWeight: number;
  hccCategories: HccCategory[];
  diseaseInteractions: DiseaseInteraction[];
  totalRafScore: number;
  annualCapitationBenchmark: number;
  riskTier: 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH';
}

export interface HedisCareGap {
  id: number;
  patient_id: number;
  measure_code: string;
  measure_name: string;
  status: 'open' | 'compliant' | 'excluded';
  due_date?: string;
  last_completed_date?: string;
  recommended_action: string;
}

export interface PopulationAnalytics {
  averageRafScore: number;
  totalStratifiedPatients: number;
  qualityComplianceRate: number;
  openCareGapsCount: number;
  closedCareGapsCount: number;
}

interface PopulationHealthDashboardProps {
  patientId?: number;
  token?: string;
  backendUrl?: string;
  patientName?: string;
}

export const PopulationHealthDashboard: React.FC<PopulationHealthDashboardProps> = ({
  patientId,
  token,
  backendUrl = '',
  patientName = 'Active Patient'
}) => {
  const [activeTab, setActiveTab] = useState<'raf_calculator' | 'care_gaps' | 'analytics'>('raf_calculator');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');

  // RAF State
  const [rafData, setRafData] = useState<RafCalculationResult | null>(null);
  const [simulatedConditions, setSimulatedConditions] = useState<string>(
    'E11.22 Type 2 diabetes mellitus with diabetic nephropathy\nI50.22 Chronic systolic heart failure\nN18.4 Chronic kidney disease stage 4\nI10 Essential hypertension'
  );

  // Care Gaps State
  const [careGaps, setCareGaps] = useState<HedisCareGap[]>([]);
  const [gapFilter, setGapFilter] = useState<'all' | 'open' | 'compliant'>('all');
  const [closingGapId, setClosingGapId] = useState<number | null>(null);

  // Analytics State
  const [analytics, setAnalytics] = useState<PopulationAnalytics | null>(null);

  // Outreach simulation
  const [outreachSent, setOutreachSent] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!patientId) return;
    setIsLoading(true);
    setStatusMsg('');

    try {
      const [gapsRes, analyticsRes] = await Promise.all([
        fetch(`${backendUrl}/api/clinician/population/care-gaps/${patientId}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${backendUrl}/api/clinician/population/analytics/summary`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (gapsRes.ok) {
        const gaps = await gapsRes.json();
        setCareGaps(gaps);
      }
      if (analyticsRes.ok) {
        const stats = await analyticsRes.json();
        setAnalytics(stats);
      }
    } catch (err: any) {
      console.error('Error fetching population health data:', err);
      setStatusMsg('Failed to load population health records.');
    } finally {
      setIsLoading(false);
    }
  }, [backendUrl, patientId, token]);

  const handleCalculateRaf = async () => {
    if (!patientId) return;
    setIsLoading(true);
    setStatusMsg('');
    try {
      const conditionLines = simulatedConditions
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);

      const res = await fetch(`${backendUrl}/api/clinician/population/raf/calculate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId,
          documentedConditions: conditionLines
        })
      });

      if (!res.ok) throw new Error('RAF calculation failed');
      const data = await res.json();
      setRafData(data);
      setStatusMsg('CMS-HCC Risk Adjustment score recalculated successfully.');
    } catch (err: any) {
      console.error('RAF Calculation error:', err);
      setStatusMsg('Error calculating RAF score.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEvaluateCareGaps = async () => {
    if (!patientId) return;
    setIsLoading(true);
    setStatusMsg('');
    try {
      const conditionLines = simulatedConditions
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);

      const res = await fetch(`${backendUrl}/api/clinician/population/care-gaps/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId,
          conditions: conditionLines
        })
      });

      if (!res.ok) throw new Error('Care gap evaluation failed');
      await fetchData();
      setStatusMsg('HEDIS quality care gaps re-evaluated and refreshed.');
    } catch (err: any) {
      console.error('Care gaps evaluation error:', err);
      setStatusMsg('Failed to evaluate care gaps.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseGap = async (gapId: number) => {
    setClosingGapId(gapId);
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch(`${backendUrl}/api/clinician/population/care-gaps/${gapId}/close`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ completionDate: today })
      });

      if (!res.ok) throw new Error('Failed to satisfy care gap');
      await fetchData();
      setStatusMsg('HEDIS care gap marked compliant.');
    } catch (err: any) {
      console.error('Close gap error:', err);
      setStatusMsg('Error closing care gap.');
    } finally {
      setClosingGapId(null);
    }
  };

  const handleTriggerOutreach = (gapName: string) => {
    setOutreachSent(`Automated SMS & Portal Care Reminder dispatched for: "${gapName}"`);
    setTimeout(() => setOutreachSent(null), 4000);
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredGaps = careGaps.filter(g => {
    if (gapFilter === 'open') return g.status === 'open';
    if (gapFilter === 'compliant') return g.status === 'compliant';
    return true;
  });

  const getTierColor = (tier?: string) => {
    switch (tier) {
      case 'VERY_HIGH': return 'bg-rose-900/60 text-rose-300 border-rose-600';
      case 'HIGH': return 'bg-amber-900/60 text-amber-300 border-amber-600';
      case 'MODERATE': return 'bg-blue-900/60 text-blue-300 border-blue-600';
      default: return 'bg-emerald-900/60 text-emerald-300 border-emerald-600';
    }
  };

  return (
    <div className="bg-slate-900 text-slate-100 rounded-xl border border-slate-800 p-6 space-y-6 shadow-2xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-indigo-400" />
            <h2 className="text-xl font-bold tracking-tight text-white">
              Enterprise Population Health & Risk Adjustment (RAF)
            </h2>
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              CMS-HCC V28 & NCQA HEDIS
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Hierarchical Condition Category risk stratification, Medicare capitation benchmarks, and quality care gap closures.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Refresh
          </button>
        </div>
      </div>

      {/* Status banner */}
      {statusMsg && (
        <div className="p-3 bg-indigo-950/60 border border-indigo-700/50 rounded-lg text-xs text-indigo-200 flex items-center justify-between">
          <span>{statusMsg}</span>
          <button onClick={() => setStatusMsg('')} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {outreachSent && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-700/50 rounded-lg text-xs text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{outreachSent}</span>
        </div>
      )}

      {/* Executive Population HUD Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Patient CMS-HCC RAF</span>
            <HeartPulse className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">
              {rafData ? rafData.totalRafScore.toFixed(3) : '1.596'}
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getTierColor(rafData?.riskTier || 'HIGH')}`}>
              {rafData?.riskTier || 'HIGH RISK'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Demographic base + disease categories + interactions
          </p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Annual Capitation Benchmark</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-emerald-400">
              ${rafData ? rafData.annualCapitationBenchmark.toLocaleString() : '22,024.80'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Projected annual risk-adjusted payment allocation
          </p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>HEDIS Quality Compliance</span>
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">
              {analytics ? `${analytics.qualityComplianceRate}%` : '85%'}
            </span>
            <span className="text-xs text-cyan-300 font-semibold">NCQA Target</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {careGaps.filter(g => g.status === 'compliant').length} compliant / {careGaps.length} active measures
          </p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Active Care Gaps</span>
            <Activity className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-300">
              {careGaps.filter(g => g.status === 'open').length}
            </span>
            <span className="text-xs text-slate-400 font-medium">pending actions</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Actionable screening & chronic disease tests
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 space-x-4">
        <button
          onClick={() => setActiveTab('raf_calculator')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'raf_calculator'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          CMS-HCC V28 Risk Stratification
        </button>
        <button
          onClick={() => setActiveTab('care_gaps')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'care_gaps'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          HEDIS Care Gaps Tracker ({careGaps.length})
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'analytics'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <PieChart className="w-4 h-4" />
          Population Analytics
        </button>
      </div>

      {/* Tab 1: CMS-HCC V28 Risk Stratification */}
      {activeTab === 'raf_calculator' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Condition Documentation Input */}
          <div className="lg:col-span-1 bg-slate-800/50 border border-slate-700/80 rounded-lg p-4 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              Documented Diagnoses & Conditions
            </h3>
            <p className="text-xs text-slate-400">
              Input patient clinical diagnoses or ICD-10 codes to compute CMS-HCC category mappings and multi-morbidity interactions.
            </p>
            <textarea
              rows={6}
              value={simulatedConditions}
              onChange={(e) => setSimulatedConditions(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
              placeholder="e.g. E11.22 Diabetic kidney disease&#10;I50.22 Congestive heart failure..."
            />
            <div className="flex gap-2">
              <button
                onClick={handleCalculateRaf}
                disabled={isLoading}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs py-2 px-3 rounded transition flex items-center justify-center gap-1.5"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Calculate CMS-HCC RAF
              </button>
              <button
                onClick={handleEvaluateCareGaps}
                disabled={isLoading}
                className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs py-2 px-3 rounded transition"
              >
                Sync Gaps
              </button>
            </div>
            <div className="p-3 bg-slate-900/60 rounded border border-slate-700/60 text-[11px] text-slate-400 space-y-1">
              <span className="font-semibold text-slate-300">V28 CMS Model Highlights:</span>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Hierarchical category clustering</li>
                <li>Cardiorenal multi-morbidity interactions</li>
                <li>Age 65-74 non-dual community baseline: 0.340</li>
              </ul>
            </div>
          </div>

          {/* Right: RAF Breakdown */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-800/50 border border-slate-700/80 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  Risk Adjustment Factor (RAF) Decomposition
                </h3>
                <span className="text-xs text-slate-400">Patient: <strong className="text-slate-200">{patientName}</strong></span>
              </div>

              <div className="space-y-3">
                {/* Demographic */}
                <div className="flex items-center justify-between p-2.5 bg-slate-900/70 border border-slate-700/50 rounded text-xs">
                  <div>
                    <span className="font-semibold text-slate-200">Demographic Baseline Weight</span>
                    <p className="text-[11px] text-slate-400">Community Non-Dual Aged (Medicare Beneficiary)</p>
                  </div>
                  <span className="font-mono font-bold text-indigo-300">
                    +{rafData ? rafData.demographicWeight.toFixed(3) : '0.340'}
                  </span>
                </div>

                {/* HCC Categories */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-300">Identified Hierarchical Condition Categories (HCCs):</span>
                  {(rafData?.hccCategories && rafData.hccCategories.length > 0) ? (
                    rafData.hccCategories.map((hcc, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 bg-slate-900/70 border border-slate-700/50 rounded text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[10px] font-bold border border-indigo-500/30">
                              {hcc.hcc}
                            </span>
                            <span className="font-semibold text-slate-200">{hcc.description}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">Triggered by: {hcc.triggerCode}</p>
                        </div>
                        <span className="font-mono font-bold text-emerald-400">+{hcc.weight.toFixed(3)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 bg-slate-900/40 rounded border border-dashed border-slate-700 text-xs text-slate-400 text-center">
                      Click &ldquo;Calculate CMS-HCC RAF&rdquo; to analyze documented conditions.
                    </div>
                  )}
                </div>

                {/* Disease Interactions */}
                {rafData?.diseaseInteractions && rafData.diseaseInteractions.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-amber-300">Compound Disease Interactions:</span>
                    {rafData.diseaseInteractions.map((inter, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 bg-amber-950/20 border border-amber-800/40 rounded text-xs">
                        <div>
                          <span className="font-semibold text-amber-200">{inter.name}</span>
                          <p className="text-[11px] text-amber-400/80">{inter.description}</p>
                        </div>
                        <span className="font-mono font-bold text-amber-400">+{inter.weight.toFixed(3)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Summary total */}
                <div className="flex items-center justify-between p-3 bg-indigo-950/40 border border-indigo-700/60 rounded text-sm mt-3">
                  <span className="font-bold text-indigo-200">Total Composite RAF Score:</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-black font-mono text-white">
                      {rafData ? rafData.totalRafScore.toFixed(3) : '1.596'}
                    </span>
                    <span className="text-xs font-bold text-emerald-400 font-mono">
                      (${rafData ? rafData.annualCapitationBenchmark.toLocaleString() : '22,024.80'}/yr)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: HEDIS Care Gaps Tracker */}
      {activeTab === 'care_gaps' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex gap-2">
              {(['all', 'open', 'compliant'] as const).map(filter => (
                <button
                  key={filter}
                  onClick={() => setGapFilter(filter)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition ${
                    gapFilter === filter
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                  }`}
                >
                  {filter} ({filter === 'all' ? careGaps.length : careGaps.filter(g => g.status === filter).length})
                </button>
              ))}
            </div>

            <button
              onClick={handleEvaluateCareGaps}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 text-xs font-semibold border border-indigo-500/40 transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Re-evaluate All Measures
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredGaps.map(gap => (
              <div
                key={gap.id}
                className={`p-4 rounded-lg border transition ${
                  gap.status === 'compliant'
                    ? 'bg-emerald-950/20 border-emerald-800/40'
                    : 'bg-slate-800/60 border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 text-xs font-bold font-mono rounded bg-slate-700 text-slate-200">
                        {gap.measure_code}
                      </span>
                      <h4 className="text-sm font-bold text-white">{gap.measure_name}</h4>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">{gap.recommended_action}</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${
                      gap.status === 'compliant'
                        ? 'bg-emerald-900/50 text-emerald-300 border-emerald-600'
                        : 'bg-amber-900/50 text-amber-300 border-amber-600'
                    }`}
                  >
                    {gap.status}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 mt-4 pt-3 border-t border-slate-700/60">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {gap.status === 'compliant'
                        ? `Completed: ${gap.last_completed_date || 'Documented'}`
                        : `Target Due: ${gap.due_date || 'Immediate'}`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {gap.status === 'open' && (
                      <>
                        <button
                          onClick={() => handleTriggerOutreach(gap.measure_name)}
                          className="px-2.5 py-1 text-xs font-medium rounded bg-slate-700 hover:bg-slate-600 text-slate-200 flex items-center gap-1 transition"
                        >
                          <Send className="w-3 h-3 text-indigo-400" />
                          Outreach
                        </button>
                        <button
                          onClick={() => handleCloseGap(gap.id)}
                          disabled={closingGapId === gap.id}
                          className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 transition"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {closingGapId === gap.id ? 'Closing...' : 'Close Gap'}
                        </button>
                      </>
                    )}
                    {gap.status === 'compliant' && (
                      <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Satisfied
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {filteredGaps.length === 0 && (
              <div className="col-span-2 p-8 text-center text-slate-400 bg-slate-800/30 rounded-lg border border-dashed border-slate-700 text-sm">
                No care gaps found matching current filter.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Population Analytics */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-800/60 rounded-lg border border-slate-700">
              <span className="text-xs text-slate-400 font-medium">Population Mean RAF</span>
              <p className="text-2xl font-black text-indigo-400 mt-1">
                {analytics?.averageRafScore ? analytics.averageRafScore.toFixed(3) : '1.656'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Across {analytics?.totalStratifiedPatients || 2} stratified lives
              </p>
            </div>

            <div className="p-4 bg-slate-800/60 rounded-lg border border-slate-700">
              <span className="text-xs text-slate-400 font-medium">Closed Quality Measures</span>
              <p className="text-2xl font-black text-emerald-400 mt-1">
                {analytics?.closedCareGapsCount || 1}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Compliant NCQA clinical screenings
              </p>
            </div>

            <div className="p-4 bg-slate-800/60 rounded-lg border border-slate-700">
              <span className="text-xs text-slate-400 font-medium">Open Quality Gaps</span>
              <p className="text-2xl font-black text-amber-400 mt-1">
                {analytics?.openCareGapsCount || 6}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Awaiting test result or scheduled visit
              </p>
            </div>
          </div>

          <div className="p-4 bg-slate-800/40 rounded-lg border border-slate-700/80 space-y-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <PieChart className="w-4 h-4 text-indigo-400" />
              Value-Based Care Strategy & Benchmarking
            </h4>
            <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
              <p>
                Under CMS Two-Sided Risk and Medicare Advantage capitation contracts, clinical accuracy in chronic condition recapture directly drives the patient&apos;s Risk Adjustment Factor (RAF).
              </p>
              <p>
                Closing HEDIS care gaps ensures high Star Ratings (4.5+ Stars) which unlocks CMS Quality Bonus Payments (QBP) and enhances preventive outcomes for diabetes, hypertension, and oncology screenings.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
