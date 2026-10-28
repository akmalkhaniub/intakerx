import React, { useState, useEffect } from 'react';

interface ClinicalAction {
  step: number;
  action: string;
  urgency: 'STAT_EMERGENT' | 'URGENT' | 'ROUTINE';
  rationale: string;
}

interface IcpCrisisResult {
  icpMmhg: number;
  mapMmhg: number;
  cppMmhg: number;
  cppStatus: 'ISCHEMIC_COMPROMISE' | 'OPTIMAL_TARGET' | 'HYPEREMIC_RISK';
  tierLevel: 'TIER_0' | 'TIER_1' | 'TIER_2' | 'TIER_3';
  herniationSyndrome: string;
  pupilReactivityAssessment: string;
  multimodalNeuromonitoringAlerts: string[];
  osmotherapyRegimen: {
    recommendedAgent: 'HYPERTONIC_SALINE_3' | 'HYPERTONIC_SALINE_23_4' | 'MANNITOL_20' | 'HOLD_OSMOTHERAPY';
    dosingDirective: string;
    targetSodiumMeqL: string;
    serumOsmolalityCeiling: string;
    contraindicationsOrPrecautions: string[];
  };
  targetParameters: {
    targetIcp: string;
    targetCpp: string;
    targetPaco2: string;
    targetPbto2: string;
    targetSerumSodium: string;
  };
  clinicalActions: ClinicalAction[];
}

interface OsmotherapyResult {
  safetyStatus: 'SAFE_TO_ADMINISTER' | 'CAUTION_BORDERLINE_OSMOLALITY' | 'CONTRAINDICATED_HYPEROSMOLAR';
  deltaIcp?: number;
  directives: string[];
}

export const IcpCrisisHub: React.FC = () => {
  const [patientId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'icp_evaluator' | 'osmo_tracker' | 'history'>('icp_evaluator');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Tab 1: ICP Evaluator State
  const [gcsScore, setGcsScore] = useState<number>(6);
  const [icpMmhg, setIcpMmhg] = useState<number>(24);
  const [mapMmhg, setMapMmhg] = useState<number>(82);
  const [pbto2Mmhg, setPbto2Mmhg] = useState<number>(18);
  const [sjvo2Percent, setSjvo2Percent] = useState<number>(58);
  const [npiLeft, setNpiLeft] = useState<number>(2.4);
  const [npiRight, setNpiRight] = useState<number>(3.8);
  const [pupilAsymmetryMm, setPupilAsymmetryMm] = useState<number>(1.5);
  const [cushingTriad, setCushingTriad] = useState<boolean>(false);
  const [unilateralDilation, setUnilateralDilation] = useState<boolean>(true);
  const [bilateralFixed, setBilateralFixed] = useState<boolean>(false);
  const [decerebratePosturing, setDecerebratePosturing] = useState<boolean>(false);
  const [evdInPlace, setEvdInPlace] = useState<boolean>(true);
  const [currentSodium, setCurrentSodium] = useState<number>(144);
  const [currentOsmolality, setCurrentOsmolality] = useState<number>(302);
  const [icpResult, setIcpResult] = useState<IcpCrisisResult | null>(null);

  // Tab 2: Osmotherapy Tracker State
  const [osmoAgent, setOsmoAgent] = useState<'HYPERTONIC_SALINE_3' | 'HYPERTONIC_SALINE_23_4' | 'MANNITOL_20'>('HYPERTONIC_SALINE_3');
  const [osmoDoseVolumeMl, setOsmoDoseVolumeMl] = useState<number>(250);
  const [osmoSodium, setOsmoSodium] = useState<number>(148);
  const [osmoOsmolality, setOsmoOsmolality] = useState<number>(308);
  const [osmolarGap, setOsmolarGap] = useState<number>(8);
  const [preIcp, setPreIcp] = useState<number>(25);
  const [postIcp, setPostIcp] = useState<number>(18);
  const [osmoResult, setOsmoResult] = useState<OsmotherapyResult | null>(null);

  // Tab 3: History State
  const [icpHistory, setIcpHistory] = useState<any[]>([]);
  const [osmoHistory, setOsmoHistory] = useState<any[]>([]);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [resIcp, resOsmo] = await Promise.all([
        fetch(`/api/clinician/icp/evaluations/${patientId}`, { headers }),
        fetch(`/api/clinician/icp/osmotherapy-logs/${patientId}`, { headers })
      ]);

      if (resIcp.ok) {
        const data = await resIcp.json();
        setIcpHistory(data);
      }
      if (resOsmo.ok) {
        const data = await resOsmo.json();
        setOsmoHistory(data);
      }
    } catch (err) {
      console.error('Failed to fetch ICP crisis history:', err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [patientId]);

  // Handle ICP Evaluation
  const handleEvaluateIcp = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/clinician/icp/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId,
          gcsScore,
          icpMmhg,
          mapMmhg,
          pbto2Mmhg: pbto2Mmhg || undefined,
          sjvo2Percent: sjvo2Percent || undefined,
          npiLeft: npiLeft || undefined,
          npiRight: npiRight || undefined,
          pupilAsymmetryMm: pupilAsymmetryMm || undefined,
          cushingTriadPresent: cushingTriad,
          unilateralPupilDilation: unilateralDilation,
          bilateralFixedDilated: bilateralFixed,
          decerebratePosturing,
          evdInPlace,
          currentSodiumMeqL: currentSodium || undefined,
          currentOsmolalityMosmKg: currentOsmolality || undefined,
          saveEvaluation: true
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Evaluation failed');
      }

      const data = await res.json();
      setIcpResult(data.evaluation);
      setStatusMessage('ICP Crisis & SIBICC protocol evaluated and saved successfully.');
      fetchHistory();
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Osmotherapy Log
  const handleLogOsmotherapy = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/clinician/icp/osmotherapy/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId,
          agent: osmoAgent,
          doseVolumeMl: osmoDoseVolumeMl,
          serumSodiumMeqL: osmoSodium,
          serumOsmolalityMosmKg: osmoOsmolality,
          osmolarGap: osmolarGap || undefined,
          preIcp,
          postIcp: postIcp || undefined,
          saveLog: true
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Osmotherapy logging failed');
      }

      const data = await res.json();
      setOsmoResult(data.monitoring);
      setStatusMessage('Osmotherapy verified and administration logged.');
      fetchHistory();
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const calculatedCpp = Math.round((mapMmhg - icpMmhg) * 10) / 10;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <div className="flex items-center space-x-3">
            <span className="text-3xl">🧠</span>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              ICP-CRISIS: Intracranial Hypertension &amp; Herniation Sentinel
            </h1>
            <span className="px-2.5 py-1 text-xs font-semibold bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-300 rounded-full">
              Phase 92
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            SIBICC Tier 1–3 Algorithmic Resuscitation, CPP Auto-Regulation, Multimodal Neuromonitoring (PbtO2, SjvO2, NPi Pupillometry), and Osmotherapy Safety Shield
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="mt-4 md:mt-0 flex space-x-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('icp_evaluator')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'icp_evaluator'
                ? 'bg-white dark:bg-gray-700 text-violet-600 dark:text-violet-300 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            ⚡ ICP &amp; Tier Evaluator
          </button>
          <button
            onClick={() => setActiveTab('osmo_tracker')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'osmo_tracker'
                ? 'bg-white dark:bg-gray-700 text-violet-600 dark:text-violet-300 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            🧪 Osmotherapy Tracker
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'history'
                ? 'bg-white dark:bg-gray-700 text-violet-600 dark:text-violet-300 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            📋 Logs &amp; History
          </button>
        </div>
      </div>

      {/* Global Status Message */}
      {statusMessage && (
        <div
          className={`p-4 rounded-lg text-sm font-medium ${
            statusMessage.startsWith('Error')
              ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800'
              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
          }`}
        >
          {statusMessage}
        </div>
      )}

      {/* TAB 1: ICP EVALUATOR */}
      {activeTab === 'icp_evaluator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Input Panel */}
          <div className="lg:col-span-5 bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
              <span>🩺</span>
              <span>Intracranial Hemodynamics &amp; Monitoring</span>
            </h2>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  GCS Score (3-15)
                </label>
                <input
                  type="number"
                  min="3"
                  max="15"
                  value={gcsScore}
                  onChange={(e) => setGcsScore(parseInt(e.target.value) || 3)}
                  className="mt-1 block w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border rounded-lg text-gray-900 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  ICP (mmHg)
                </label>
                <input
                  type="number"
                  value={icpMmhg}
                  onChange={(e) => setIcpMmhg(parseFloat(e.target.value) || 0)}
                  className="mt-1 block w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border rounded-lg text-gray-900 dark:text-white font-mono font-bold"
                />
                <span className="text-[10px] text-gray-400">&gt; 20-22 abnormal</span>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  MAP (mmHg)
                </label>
                <input
                  type="number"
                  value={mapMmhg}
                  onChange={(e) => setMapMmhg(parseFloat(e.target.value) || 0)}
                  className="mt-1 block w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border rounded-lg text-gray-900 dark:text-white font-mono font-bold"
                />
                <span className="text-[10px] text-gray-400">Arterial line</span>
              </div>
            </div>

            {/* Live CPP Banner */}
            <div className="p-3 bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 rounded-lg flex items-center justify-between">
              <div>
                <span className="text-xs text-violet-700 dark:text-violet-300 font-semibold">
                  Cerebral Perfusion Pressure (CPP = MAP - ICP)
                </span>
                <div className="text-xs text-gray-500">Target: 60 - 70 mmHg</div>
              </div>
              <div className={`text-xl font-mono font-extrabold ${
                calculatedCpp < 60 ? 'text-rose-600' : calculatedCpp > 70 ? 'text-amber-600' : 'text-emerald-600'
              }`}>
                {calculatedCpp} mmHg
              </div>
            </div>

            {/* Multimodal Monitoring */}
            <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                Multimodal Neuromonitoring (PbtO2, SjvO2, NPi)
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                    PbtO2 (mmHg)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={pbto2Mmhg}
                    onChange={(e) => setPbto2Mmhg(parseFloat(e.target.value) || 0)}
                    className="mt-1 block w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border rounded font-mono"
                  />
                  <span className="text-[10px] text-gray-400">Hypoxia &lt; 20 | Ischemia &lt; 15</span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                    SjvO2 (%)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={sjvo2Percent}
                    onChange={(e) => setSjvo2Percent(parseFloat(e.target.value) || 0)}
                    className="mt-1 block w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border rounded font-mono"
                  />
                  <span className="text-[10px] text-gray-400">Normal: 55 - 75%</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400">
                    Left NPi
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={npiLeft}
                    onChange={(e) => setNpiLeft(parseFloat(e.target.value) || 0)}
                    className="mt-1 block w-full px-2 py-1 text-xs bg-gray-50 dark:bg-gray-900 border rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400">
                    Right NPi
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={npiRight}
                    onChange={(e) => setNpiRight(parseFloat(e.target.value) || 0)}
                    className="mt-1 block w-full px-2 py-1 text-xs bg-gray-50 dark:bg-gray-900 border rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400">
                    Pupil Asym (mm)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={pupilAsymmetryMm}
                    onChange={(e) => setPupilAsymmetryMm(parseFloat(e.target.value) || 0)}
                    className="mt-1 block w-full px-2 py-1 text-xs bg-gray-50 dark:bg-gray-900 border rounded font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Herniation & Clinical Markers */}
            <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                Herniation Syndromes &amp; Mechanical Factors
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={unilateralDilation}
                    onChange={(e) => setUnilateralDilation(e.target.checked)}
                    className="rounded text-violet-600"
                  />
                  <span className="text-rose-600 font-semibold">Unilateral Dilated Pupil</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={cushingTriad}
                    onChange={(e) => setCushingTriad(e.target.checked)}
                    className="rounded text-violet-600"
                  />
                  <span className="text-rose-600 font-semibold">Cushing Triad</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={bilateralFixed}
                    onChange={(e) => setBilateralFixed(e.target.checked)}
                    className="rounded text-violet-600"
                  />
                  <span>Bilateral Fixed / Dilated</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={decerebratePosturing}
                    onChange={(e) => setDecerebratePosturing(e.target.checked)}
                    className="rounded text-violet-600"
                  />
                  <span>Decerebrate Posturing</span>
                </label>
                <label className="flex items-center space-x-2 col-span-2">
                  <input
                    type="checkbox"
                    checked={evdInPlace}
                    onChange={(e) => setEvdInPlace(e.target.checked)}
                    className="rounded text-violet-600"
                  />
                  <span>External Ventricular Drain (EVD) In Place</span>
                </label>
              </div>
            </div>

            {/* Serum Osmolality & Sodium */}
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Serum Sodium (mEq/L)
                </label>
                <input
                  type="number"
                  value={currentSodium}
                  onChange={(e) => setCurrentSodium(parseFloat(e.target.value) || 0)}
                  className="mt-1 block w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border rounded font-mono"
                />
                <span className="text-[10px] text-gray-400">Target 145-155 | Limit 160</span>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Serum Osmolality (mOsm/kg)
                </label>
                <input
                  type="number"
                  value={currentOsmolality}
                  onChange={(e) => setCurrentOsmolality(parseFloat(e.target.value) || 0)}
                  className="mt-1 block w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border rounded font-mono"
                />
                <span className="text-[10px] text-gray-400">Safety Ceiling &lt; 320</span>
              </div>
            </div>

            <button
              onClick={handleEvaluateIcp}
              disabled={isLoading}
              className="w-full mt-2 py-2.5 px-4 bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-colors flex items-center justify-center space-x-2"
            >
              <span>{isLoading ? 'Computing...' : '⚡ Compute SIBICC Tier & Herniation Directives'}</span>
            </button>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-7 space-y-4">
            {icpResult ? (
              <div className="space-y-4">
                {/* SIBICC Tier Badge Card */}
                <div
                  className={`p-5 rounded-xl border ${
                    icpResult.tierLevel === 'TIER_3'
                      ? 'bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800'
                      : icpResult.tierLevel === 'TIER_2'
                      ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800'
                      : icpResult.tierLevel === 'TIER_1'
                      ? 'bg-sky-50 border-sky-200 dark:bg-sky-950/40 dark:border-sky-800'
                      : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400">
                        SIBICC Protocol Escalation
                      </span>
                      <h3 className="text-2xl font-black text-gray-900 dark:text-white">
                        {icpResult.tierLevel.replace(/_/g, ' ')}
                      </h3>
                      {icpResult.herniationSyndrome !== 'NONE_MONITORED' && (
                        <div className="mt-1 inline-block px-2.5 py-0.5 text-xs font-bold bg-rose-600 text-white rounded-full">
                          🚨 Herniation: {icpResult.herniationSyndrome.replace(/_/g, ' ')}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold text-gray-500 uppercase">CPP Status</div>
                      <div className={`text-lg font-bold ${
                        icpResult.cppStatus === 'ISCHEMIC_COMPROMISE'
                          ? 'text-rose-600'
                          : icpResult.cppStatus === 'HYPEREMIC_RISK'
                          ? 'text-amber-600'
                          : 'text-emerald-600'
                      }`}>
                        {icpResult.cppMmhg} mmHg ({icpResult.cppStatus.replace(/_/g, ' ')})
                      </div>
                      <div className="text-xs text-gray-500">ICP {icpResult.icpMmhg} / MAP {icpResult.mapMmhg} mmHg</div>
                    </div>
                  </div>

                  {/* Pupil Reactivity Banner */}
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs">
                    <span className="font-bold text-gray-900 dark:text-white">Pupillary Status:</span>{' '}
                    <span className="text-gray-700 dark:text-gray-300">{icpResult.pupilReactivityAssessment}</span>
                  </div>
                </div>

                {/* Multimodal Monitoring Alerts */}
                {icpResult.multimodalNeuromonitoringAlerts.length > 0 && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl space-y-1.5">
                    <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider flex items-center space-x-1.5">
                      <span>🔬</span>
                      <span>Multimodal Neuromonitoring Surveillance</span>
                    </h4>
                    <div className="space-y-1 text-xs">
                      {icpResult.multimodalNeuromonitoringAlerts.map((alt, idx) => (
                        <div key={idx} className="p-2 bg-white/70 dark:bg-gray-900/70 rounded text-amber-900 dark:text-amber-200">
                          {alt}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Osmotherapy Directive Card */}
                <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm space-y-2">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase flex items-center space-x-1.5">
                    <span>🧪</span>
                    <span>Osmotherapy Prescription &amp; Safety Thresholds</span>
                  </h4>
                  <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 text-xs leading-relaxed">
                    <div className="font-bold text-violet-700 dark:text-violet-300 mb-1">
                      {icpResult.osmotherapyRegimen.recommendedAgent.replace(/_/g, ' ')}
                    </div>
                    <p className="text-gray-700 dark:text-gray-300">{icpResult.osmotherapyRegimen.dosingDirective}</p>
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-2 text-[11px] text-gray-500">
                      <div>Target Na: {icpResult.osmotherapyRegimen.targetSodiumMeqL}</div>
                      <div>Osmolality Ceiling: {icpResult.osmotherapyRegimen.serumOsmolalityCeiling}</div>
                    </div>
                  </div>
                </div>

                {/* Target Parameters Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
                  <div className="p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="text-[10px] text-gray-500">Target ICP</div>
                    <div className="text-sm font-bold font-mono text-emerald-600">{icpResult.targetParameters.targetIcp}</div>
                  </div>
                  <div className="p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="text-[10px] text-gray-500">Target CPP</div>
                    <div className="text-sm font-bold font-mono text-sky-600">{icpResult.targetParameters.targetCpp}</div>
                  </div>
                  <div className="p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="text-[10px] text-gray-500">Target PaCO2</div>
                    <div className="text-sm font-bold font-mono text-violet-600">{icpResult.targetParameters.targetPaco2}</div>
                  </div>
                  <div className="p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="text-[10px] text-gray-500">Target PbtO2</div>
                    <div className="text-sm font-bold font-mono text-purple-600">{icpResult.targetParameters.targetPbto2}</div>
                  </div>
                </div>

                {/* Clinical Action Plan */}
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                    <span>⚡</span>
                    <span>Stat Tiered Resuscitation &amp; Surgical Plan</span>
                  </h4>
                  <div className="space-y-2">
                    {icpResult.clinicalActions.map((act) => (
                      <div
                        key={act.step}
                        className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 flex items-start space-x-3"
                      >
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300 text-xs font-bold flex items-center justify-center">
                          {act.step}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-900 dark:text-white">
                              {act.action}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                act.urgency === 'STAT_EMERGENT'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                              }`}
                            >
                              {act.urgency}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                            {act.rationale}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[350px] flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-800/40 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-center">
                <span className="text-4xl">🧠</span>
                <h3 className="mt-2 text-base font-medium text-gray-900 dark:text-white">
                  No Active ICP Evaluation
                </h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-sm">
                  Adjust neuromonitoring parameters on the left and click 'Compute SIBICC Tier & Herniation Directives' to calculate tiered rescue plans.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: OSMOTHERAPY TRACKER */}
      {activeTab === 'osmo_tracker' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Input Panel */}
          <div className="lg:col-span-5 bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
              <span>🧪</span>
              <span>Osmotherapy Administration &amp; Serum Osmolality</span>
            </h2>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Hyperosmolar Agent
              </label>
              <select
                value={osmoAgent}
                onChange={(e) => setOsmoAgent(e.target.value as any)}
                className="mt-1 block w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border rounded-lg text-gray-900 dark:text-white font-semibold"
              >
                <option value="HYPERTONIC_SALINE_3">Hypertonic Saline 3% (250 mL bolus)</option>
                <option value="HYPERTONIC_SALINE_23_4">Hypertonic Saline 23.4% (30 mL Central Push)</option>
                <option value="MANNITOL_20">Mannitol 20% (0.5 - 1.0 g/kg)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Dose Volume (mL)
                </label>
                <input
                  type="number"
                  value={osmoDoseVolumeMl}
                  onChange={(e) => setOsmoDoseVolumeMl(parseInt(e.target.value) || 0)}
                  className="mt-1 block w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border rounded-lg text-gray-900 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Serum Sodium (mEq/L)
                </label>
                <input
                  type="number"
                  value={osmoSodium}
                  onChange={(e) => setOsmoSodium(parseFloat(e.target.value) || 0)}
                  className="mt-1 block w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border rounded-lg text-gray-900 dark:text-white font-mono"
                />
                <span className="text-[10px] text-gray-400">Ceiling: 160 mEq/L</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Serum Osmolality (mOsm/kg)
                </label>
                <input
                  type="number"
                  value={osmoOsmolality}
                  onChange={(e) => setOsmoOsmolality(parseFloat(e.target.value) || 0)}
                  className="mt-1 block w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border rounded-lg text-gray-900 dark:text-white font-mono"
                />
                <span className="text-[10px] text-gray-400">Ceiling: 320 mOsm/kg</span>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Osmolar Gap (mOsm/kg)
                </label>
                <input
                  type="number"
                  value={osmolarGap}
                  onChange={(e) => setOsmolarGap(parseFloat(e.target.value) || 0)}
                  className="mt-1 block w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border rounded-lg text-gray-900 dark:text-white font-mono"
                />
                <span className="text-[10px] text-gray-400">Mannitol ceiling &lt; 20</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Pre-Dose ICP (mmHg)
                </label>
                <input
                  type="number"
                  value={preIcp}
                  onChange={(e) => setPreIcp(parseFloat(e.target.value) || 0)}
                  className="mt-1 block w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border rounded-lg text-gray-900 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Post-Dose ICP (mmHg)
                </label>
                <input
                  type="number"
                  value={postIcp}
                  onChange={(e) => setPostIcp(parseFloat(e.target.value) || 0)}
                  className="mt-1 block w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border rounded-lg text-gray-900 dark:text-white font-mono"
                />
              </div>
            </div>

            <button
              onClick={handleLogOsmotherapy}
              disabled={isLoading}
              className="w-full mt-2 py-2.5 px-4 bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-colors flex items-center justify-center space-x-2"
            >
              <span>{isLoading ? 'Verifying...' : '🔍 Validate Osmotherapy & Record'}</span>
            </button>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-7 space-y-4">
            {osmoResult ? (
              <div className="space-y-4">
                <div
                  className={`p-5 rounded-xl border ${
                    osmoResult.safetyStatus === 'CONTRAINDICATED_HYPEROSMOLAR'
                      ? 'bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800'
                      : osmoResult.safetyStatus === 'CAUTION_BORDERLINE_OSMOLALITY'
                      ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800'
                      : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400">
                        Osmotherapy Safety Clearance
                      </span>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {osmoResult.safetyStatus.replace(/_/g, ' ')}
                      </h3>
                      {osmoResult.deltaIcp !== undefined && (
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                          ICP Reduction: &Delta; {osmoResult.deltaIcp} mmHg
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Directives List */}
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                    <span>📋</span>
                    <span>Safety Directives &amp; Guardrails</span>
                  </h4>
                  <div className="space-y-2">
                    {osmoResult.directives.map((dir, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border text-xs leading-relaxed ${
                          dir.includes('CRITICAL') || dir.includes('MUST be infused')
                            ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 font-semibold'
                            : dir.includes('BORDERLINE')
                            ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                            : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-300'
                        }`}
                      >
                        {dir}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[350px] flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-800/40 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-center">
                <span className="text-4xl">🧪</span>
                <h3 className="mt-2 text-base font-medium text-gray-900 dark:text-white">
                  No Active Osmotherapy Assessment
                </h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-sm">
                  Enter hypertonic saline or mannitol dosing parameters to verify against hypernatremia and hyperosmolality safety ceilings.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: LOGS & HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* ICP Crisis Evaluations */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
              <span>🧠</span>
              <span>Past ICP Evaluations &amp; SIBICC Tiers</span>
            </h3>
            {icpHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs text-left">
                  <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 uppercase border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-3 py-2">Timestamp</th>
                      <th className="px-3 py-2">Tier</th>
                      <th className="px-3 py-2">ICP / MAP</th>
                      <th className="px-3 py-2">CPP</th>
                      <th className="px-3 py-2">Herniation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {icpHistory.map((row) => (
                      <tr key={row.id}>
                        <td className="px-3 py-2 text-gray-500">
                          {new Date(row.evaluated_at).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 font-bold text-gray-900 dark:text-white">
                          {row.tier_level}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {row.icp_mmhg} / {row.map_mmhg} mmHg
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-violet-600">
                          {row.cpp_mmhg} mmHg
                        </td>
                        <td className="px-3 py-2 text-rose-600 font-medium">
                          {row.herniation_syndrome}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-400">No past ICP evaluation records found for Patient #{patientId}.</p>
            )}
          </div>

          {/* Osmotherapy Logs */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
              <span>🧪</span>
              <span>Past Osmotherapy Administration Logs</span>
            </h3>
            {osmoHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs text-left">
                  <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 uppercase border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-3 py-2">Timestamp</th>
                      <th className="px-3 py-2">Agent</th>
                      <th className="px-3 py-2">Dose (mL)</th>
                      <th className="px-3 py-2">Serum Na</th>
                      <th className="px-3 py-2">Osmolality</th>
                      <th className="px-3 py-2">Pre / Post ICP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {osmoHistory.map((row) => (
                      <tr key={row.id}>
                        <td className="px-3 py-2 text-gray-500">
                          {new Date(row.logged_at).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 font-semibold">
                          {row.agent}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {row.dose_volume_ml} mL
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {row.serum_sodium_meq_l} mEq/L
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {row.serum_osmolality_mosm_kg} mOsm/kg
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-violet-600">
                          {row.pre_icp} &rarr; {row.post_icp !== null ? `${row.post_icp} mmHg` : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-400">No past osmotherapy logs found for Patient #{patientId}.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default IcpCrisisHub;
