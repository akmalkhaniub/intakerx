import React, { useState, useEffect } from 'react';

interface ClinicalActionStep {
  step: number;
  action: string;
  urgency: 'STAT_EMERGENT' | 'URGENT' | 'ROUTINE';
  rationale: string;
}

interface SubarachnoidEvaluationResult {
  huntHessGrade: number;
  modifiedFisherGrade: number;
  wfnsGrade: number;
  dciRiskCategory: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  bloodPressureTarget: string;
  nimodipineRegimen: string;
  hyponatremiaManagement?: string;
  hydrocephalusGuidance?: string;
  clinicalActionPlan: ClinicalActionStep[];
}

interface TcdVasospasmResult {
  maxMcaVelocity: number;
  lindegaardRatio: number;
  vasospasmSeverity: 'NO_VASOSPASM' | 'HYPEREMIA_NOT_VASOSPASM' | 'MILD_VASOSPASM' | 'MODERATE_VASOSPASM' | 'SEVERE_CRITICAL_VASOSPASM';
  endovascularRescueIndicated: boolean;
  inducedHypertensionTarget: string;
  directives: string[];
}

export const SubarachNavHub: React.FC = () => {
  const [patientId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'sah_evaluator' | 'tcd_monitor' | 'history'>('sah_evaluator');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Tab 1: SAH Evaluator State
  const [huntHessGrade, setHuntHessGrade] = useState<number>(3);
  const [modifiedFisherGrade, setModifiedFisherGrade] = useState<number>(4);
  const [gcsScore, setGcsScore] = useState<number>(12);
  const [hasFocalDeficit, setHasFocalDeficit] = useState<boolean>(true);
  const [aneurysmSecured, setAneurysmSecured] = useState<boolean>(false);
  const [treatmentType, setTreatmentType] = useState<'COILED' | 'CLIPPED' | 'FLOW_DIVERTER' | 'UNSECURED'>('UNSECURED');
  const [postBleedDay, setPostBleedDay] = useState<number>(4);
  const [hasHydrocephalus, setHasHydrocephalus] = useState<boolean>(false);
  const [currentSbp, setCurrentSbp] = useState<number>(155);
  const [currentMap, setCurrentMap] = useState<number>(92);
  const [serumSodium, setSerumSodium] = useState<number>(134);
  const [sahResult, setSahResult] = useState<SubarachnoidEvaluationResult | null>(null);

  // Tab 2: TCD Vasospasm State
  const [tcdPostBleedDay, setTcdPostBleedDay] = useState<number>(7);
  const [mcaLeft, setMcaLeft] = useState<number>(210);
  const [mcaRight, setMcaRight] = useState<number>(165);
  const [icaExtracranial, setIcaExtracranial] = useState<number>(34);
  const [tcdMap, setTcdMap] = useState<number>(88);
  const [newDeficit, setNewDeficit] = useState<boolean>(true);
  const [onNorepinephrine, setOnNorepinephrine] = useState<boolean>(false);
  const [tcdResult, setTcdResult] = useState<TcdVasospasmResult | null>(null);

  // Tab 3: History State
  const [sahHistory, setSahHistory] = useState<any[]>([]);
  const [tcdHistory, setTcdHistory] = useState<any[]>([]);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [resSah, resTcd] = await Promise.all([
        fetch(`/api/clinician/subarach/evaluations/${patientId}`, { headers }),
        fetch(`/api/clinician/subarach/tcd-logs/${patientId}`, { headers })
      ]);

      if (resSah.ok) {
        const data = await resSah.json();
        setSahHistory(data);
      }
      if (resTcd.ok) {
        const data = await resTcd.json();
        setTcdHistory(data);
      }
    } catch (err) {
      console.error('Failed to fetch SAH history:', err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [patientId]);

  // Handle SAH Evaluation
  const handleEvaluateSah = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/clinician/subarach/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId,
          huntHessGrade,
          modifiedFisherGrade,
          gcsScore,
          hasFocalDeficit,
          aneurysmSecured,
          aneurysmTreatmentType: treatmentType,
          postBleedDay,
          hasHydrocephalus,
          currentSbpMmhg: currentSbp || undefined,
          currentMapMmhg: currentMap || undefined,
          serumSodiumMeqL: serumSodium || undefined,
          saveEvaluation: true
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Evaluation failed');
      }

      const data = await res.json();
      setSahResult(data.evaluation);
      setStatusMessage('Subarachnoid hemorrhage clinical plan evaluated and saved successfully.');
      fetchHistory();
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle TCD Surveillance
  const handleMonitorTcd = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/clinician/subarach/tcd/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId,
          postBleedDay: tcdPostBleedDay,
          mcaMfvLeft: mcaLeft,
          mcaMfvRight: mcaRight,
          icaExtracranialMfv: icaExtracranial,
          currentMapMmhg: tcdMap,
          newFocalDeficitOrDropInGcs: newDeficit,
          onNorepinephrine,
          saveLog: true
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'TCD monitoring failed');
      }

      const data = await res.json();
      setTcdResult(data.monitoring);
      setStatusMessage('TCD vasospasm surveillance assessed and logged.');
      fetchHistory();
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const calculatedLr = icaExtracranial > 0 ? Math.round((Math.max(mcaLeft, mcaRight) / icaExtracranial) * 100) / 100 : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <div className="flex items-center space-x-3">
            <span className="text-3xl">⚡</span>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              SUBARACH-NAV: Aneurysmal SAH &amp; Vasospasm Sentinel
            </h1>
            <span className="px-2.5 py-1 text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 rounded-full">
              Phase 93
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Hunt-Hess / Modified Fisher / WFNS Stratification, TCD Lindegaard Ratio Vasospasm Surveillance, Nimodipine Dosing, Induced Hypertension &amp; Endovascular Rescue
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="mt-4 md:mt-0 flex space-x-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('sah_evaluator')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'sah_evaluator'
                ? 'bg-white dark:bg-gray-700 text-amber-600 dark:text-amber-300 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            🩺 SAH Severity &amp; DCI Risk
          </button>
          <button
            onClick={() => setActiveTab('tcd_monitor')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'tcd_monitor'
                ? 'bg-white dark:bg-gray-700 text-amber-600 dark:text-amber-300 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            📡 TCD Vasospasm &amp; Rescue
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'history'
                ? 'bg-white dark:bg-gray-700 text-amber-600 dark:text-amber-300 shadow-sm'
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

      {/* TAB 1: SAH EVALUATOR */}
      {activeTab === 'sah_evaluator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Input Panel */}
          <div className="lg:col-span-5 bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
              <span>🩺</span>
              <span>aSAH Presentation &amp; Grading Scores</span>
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Hunt &amp; Hess Grade (1-5)
                </label>
                <select
                  value={huntHessGrade}
                  onChange={(e) => setHuntHessGrade(parseInt(e.target.value) || 1)}
                  className="mt-1 block w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border rounded-lg text-gray-900 dark:text-white font-semibold"
                >
                  <option value={1}>Grade 1: Asymptomatic / mild headache</option>
                  <option value={2}>Grade 2: Severe headache, nuchal rigidity</option>
                  <option value={3}>Grade 3: Drowsy, confused, mild deficit</option>
                  <option value={4}>Grade 4: Stupor, hemiparesis</option>
                  <option value={5}>Grade 5: Deep coma, decerebrate</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Modified Fisher Grade (1-4)
                </label>
                <select
                  value={modifiedFisherGrade}
                  onChange={(e) => setModifiedFisherGrade(parseInt(e.target.value) || 1)}
                  className="mt-1 block w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border rounded-lg text-gray-900 dark:text-white font-semibold"
                >
                  <option value={1}>Grade 1: Thin SAH (&lt;1mm), no IVH</option>
                  <option value={2}>Grade 2: Thin SAH (&lt;1mm) with IVH</option>
                  <option value={3}>Grade 3: Thick SAH (&gt;=1mm), no IVH</option>
                  <option value={4}>Grade 4: Thick SAH (&gt;=1mm) with IVH</option>
                </select>
              </div>
            </div>

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
                  Post-Bleed Day
                </label>
                <input
                  type="number"
                  min="1"
                  max="21"
                  value={postBleedDay}
                  onChange={(e) => setPostBleedDay(parseInt(e.target.value) || 1)}
                  className="mt-1 block w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border rounded-lg text-gray-900 dark:text-white font-mono"
                />
                <span className="text-[10px] text-gray-400">Peak vasospasm: Days 4-14</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Current SBP (mmHg)
                </label>
                <input
                  type="number"
                  value={currentSbp}
                  onChange={(e) => setCurrentSbp(parseInt(e.target.value) || 0)}
                  className="mt-1 block w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border rounded-lg text-gray-900 dark:text-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Aneurysm Security Status
                </label>
                <div className="mt-2 flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="aneurysmSecuredCheck"
                    checked={aneurysmSecured}
                    onChange={(e) => {
                      setAneurysmSecured(e.target.checked);
                      if (!e.target.checked) setTreatmentType('UNSECURED');
                      else setTreatmentType('COILED');
                    }}
                    className="h-4 w-4 text-amber-600 rounded"
                  />
                  <label htmlFor="aneurysmSecuredCheck" className="text-xs font-bold text-gray-900 dark:text-white">
                    Aneurysm Secured
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Securement Modality
                </label>
                <select
                  disabled={!aneurysmSecured}
                  value={treatmentType}
                  onChange={(e) => setTreatmentType(e.target.value as any)}
                  className="mt-1 block w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border rounded text-gray-900 dark:text-white disabled:opacity-50"
                >
                  <option value="UNSECURED">Unsecured</option>
                  <option value="COILED">Endovascular Coiling</option>
                  <option value="CLIPPED">Microsurgical Clipping</option>
                  <option value="FLOW_DIVERTER">Flow Diverter Stent</option>
                </select>
              </div>
            </div>

            {/* Clinical Complications Checkboxes */}
            <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                Clinical Examination &amp; Complications
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={hasFocalDeficit}
                    onChange={(e) => setHasFocalDeficit(e.target.checked)}
                    className="rounded text-amber-600"
                  />
                  <span>Focal Neurological Deficit</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={hasHydrocephalus}
                    onChange={(e) => setHasHydrocephalus(e.target.checked)}
                    className="rounded text-amber-600"
                  />
                  <span className="text-rose-600 font-semibold">Acute Hydrocephalus</span>
                </label>
              </div>
            </div>

            {/* Labs & Blood Pressure */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Mean Arterial Pressure (mmHg)
                </label>
                <input
                  type="number"
                  value={currentMap}
                  onChange={(e) => setCurrentMap(parseInt(e.target.value) || 0)}
                  className="mt-1 block w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border rounded font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Serum Sodium (mEq/L)
                </label>
                <input
                  type="number"
                  value={serumSodium}
                  onChange={(e) => setSerumSodium(parseFloat(e.target.value) || 0)}
                  className="mt-1 block w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border rounded font-mono"
                />
                <span className="text-[10px] text-gray-400">&lt; 135 CSW risk</span>
              </div>
            </div>

            <button
              onClick={handleEvaluateSah}
              disabled={isLoading}
              className="w-full mt-2 py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-colors flex items-center justify-center space-x-2"
            >
              <span>{isLoading ? 'Stratifying...' : '⚡ Compute aSAH WFNS & DCI Action Plan'}</span>
            </button>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-7 space-y-4">
            {sahResult ? (
              <div className="space-y-4">
                {/* Risk Badges */}
                <div
                  className={`p-5 rounded-xl border ${
                    sahResult.dciRiskCategory === 'CRITICAL'
                      ? 'bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800'
                      : sahResult.dciRiskCategory === 'HIGH'
                      ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800'
                      : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400">
                        Delayed Cerebral Ischemia (DCI) Risk
                      </span>
                      <h3 className="text-2xl font-black text-gray-900 dark:text-white">
                        {sahResult.dciRiskCategory} RISK
                      </h3>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                        Post-Bleed Day {postBleedDay} | Modified Fisher {sahResult.modifiedFisherGrade}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold text-gray-500 uppercase">WFNS Classification</div>
                      <div className="text-xl font-bold font-mono text-gray-900 dark:text-white">
                        Grade {sahResult.wfnsGrade}
                      </div>
                      <div className="text-xs text-gray-500">Hunt &amp; Hess: {sahResult.huntHessGrade}</div>
                    </div>
                  </div>
                </div>

                {/* Blood Pressure Target Card */}
                <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm space-y-1.5">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase flex items-center space-x-1.5">
                    <span>🎯</span>
                    <span>Hemodynamic &amp; Blood Pressure Target</span>
                  </h4>
                  <p className={`text-xs leading-relaxed font-medium ${
                    !aneurysmSecured ? 'text-rose-700 dark:text-rose-300' : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {sahResult.bloodPressureTarget}
                  </p>
                </div>

                {/* Nimodipine Regimen */}
                <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm space-y-1.5">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase flex items-center space-x-1.5">
                    <span>💊</span>
                    <span>Nimodipine Neuroprotection Protocol</span>
                  </h4>
                  <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-mono">
                    {sahResult.nimodipineRegimen}
                  </p>
                </div>

                {/* Hydrocephalus Guidance */}
                {sahResult.hydrocephalusGuidance && (
                  <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl space-y-1">
                    <h4 className="text-xs font-bold text-rose-900 dark:text-rose-200 uppercase tracking-wider flex items-center space-x-1.5">
                      <span>🚨</span>
                      <span>Hydrocephalus Directive</span>
                    </h4>
                    <p className="text-xs text-rose-800 dark:text-rose-300">
                      {sahResult.hydrocephalusGuidance}
                    </p>
                  </div>
                )}

                {/* Hyponatremia / CSW Guidance */}
                {sahResult.hyponatremiaManagement && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl space-y-1">
                    <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider flex items-center space-x-1.5">
                      <span>⚠️</span>
                      <span>Cerebral Salt Wasting Sentinel</span>
                    </h4>
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                      {sahResult.hyponatremiaManagement}
                    </p>
                  </div>
                )}

                {/* Step-by-Step Clinical Action Plan */}
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                    <span>⚡</span>
                    <span>Stat Management &amp; Vasospasm Prophylaxis</span>
                  </h4>
                  <div className="space-y-2">
                    {sahResult.clinicalActionPlan.map((step) => (
                      <div
                        key={step.step}
                        className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 flex items-start space-x-3"
                      >
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center justify-center">
                          {step.step}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-900 dark:text-white">
                              {step.action}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                step.urgency === 'STAT_EMERGENT'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                              }`}
                            >
                              {step.urgency}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                            {step.rationale}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[350px] flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-800/40 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-center">
                <span className="text-4xl">⚡</span>
                <h3 className="mt-2 text-base font-medium text-gray-900 dark:text-white">
                  No Active SAH Evaluation
                </h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-sm">
                  Specify Hunt-Hess and Modified Fisher grades, aneurysm securement status, and post-bleed day to compute DCI risk.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: TCD VASOSPASM MONITOR */}
      {activeTab === 'tcd_monitor' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Input Panel */}
          <div className="lg:col-span-5 bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
              <span>📡</span>
              <span>Transcranial Doppler Sonography &amp; Lindegaard</span>
            </h2>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Post-Bleed Day
                </label>
                <input
                  type="number"
                  min="1"
                  max="21"
                  value={tcdPostBleedDay}
                  onChange={(e) => setTcdPostBleedDay(parseInt(e.target.value) || 1)}
                  className="mt-1 block w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border rounded-lg text-gray-900 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Left MCA MFV
                </label>
                <input
                  type="number"
                  value={mcaLeft}
                  onChange={(e) => setMcaLeft(parseFloat(e.target.value) || 0)}
                  className="mt-1 block w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border rounded-lg text-gray-900 dark:text-white font-mono"
                />
                <span className="text-[10px] text-gray-400">cm/s</span>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Right MCA MFV
                </label>
                <input
                  type="number"
                  value={mcaRight}
                  onChange={(e) => setMcaRight(parseFloat(e.target.value) || 0)}
                  className="mt-1 block w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border rounded-lg text-gray-900 dark:text-white font-mono"
                />
                <span className="text-[10px] text-gray-400">cm/s</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Extracranial ICA MFV
                </label>
                <input
                  type="number"
                  value={icaExtracranial}
                  onChange={(e) => setIcaExtracranial(parseFloat(e.target.value) || 0)}
                  className="mt-1 block w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border rounded-lg text-gray-900 dark:text-white font-mono"
                />
                <span className="text-[10px] text-gray-400">Submandibular ICA</span>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Current MAP (mmHg)
                </label>
                <input
                  type="number"
                  value={tcdMap}
                  onChange={(e) => setTcdMap(parseInt(e.target.value) || 0)}
                  className="mt-1 block w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border rounded-lg text-gray-900 dark:text-white font-mono"
                />
              </div>
            </div>

            {/* Live Lindegaard Ratio Display */}
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-between">
              <div>
                <span className="text-xs text-amber-800 dark:text-amber-300 font-semibold">
                  Lindegaard Ratio (Max MCA / Extracranial ICA)
                </span>
                <div className="text-[11px] text-gray-500">&lt; 3.0 Hyperemia | 3.0-6.0 Moderate | &gt; 6.0 Severe</div>
              </div>
              <div className={`text-xl font-mono font-black ${
                calculatedLr >= 6.0 ? 'text-rose-600' : calculatedLr >= 3.0 ? 'text-amber-600' : 'text-emerald-600'
              }`}>
                {calculatedLr}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                Clinical Deterioration Markers
              </span>
              <div className="space-y-1.5 text-xs">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={newDeficit}
                    onChange={(e) => setNewDeficit(e.target.checked)}
                    className="rounded text-amber-600"
                  />
                  <span className="text-rose-600 font-semibold">New Focal Deficit or Drop in GCS &gt;= 2</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={onNorepinephrine}
                    onChange={(e) => setOnNorepinephrine(e.target.checked)}
                    className="rounded text-amber-600"
                  />
                  <span>Currently on Vasopressor (Induced Hypertension)</span>
                </label>
              </div>
            </div>

            <button
              onClick={handleMonitorTcd}
              disabled={isLoading}
              className="w-full mt-2 py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-colors flex items-center justify-center space-x-2"
            >
              <span>{isLoading ? 'Assessing...' : '🔍 Evaluate TCD Vasospasm & Rescue'}</span>
            </button>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-7 space-y-4">
            {tcdResult ? (
              <div className="space-y-4">
                <div
                  className={`p-5 rounded-xl border ${
                    tcdResult.vasospasmSeverity === 'SEVERE_CRITICAL_VASOSPASM' || tcdResult.endovascularRescueIndicated
                      ? 'bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800'
                      : tcdResult.vasospasmSeverity === 'MODERATE_VASOSPASM'
                      ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800'
                      : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400">
                        Vasospasm Stratification
                      </span>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {tcdResult.vasospasmSeverity.replace(/_/g, ' ')}
                      </h3>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                        Max MCA: {tcdResult.maxMcaVelocity} cm/s | Lindegaard: {tcdResult.lindegaardRatio}
                      </p>
                    </div>
                    {tcdResult.endovascularRescueIndicated && (
                      <div className="text-right">
                        <span className="px-3 py-1 bg-rose-600 text-white text-xs font-bold rounded-full">
                          🚨 STAT DSA &amp; RESCUE
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Induced Hypertension Target */}
                <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm space-y-1">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase flex items-center space-x-1.5">
                    <span>📈</span>
                    <span>Hemodynamic Target for Vasospasm</span>
                  </h4>
                  <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-semibold">
                    {tcdResult.inducedHypertensionTarget}
                  </p>
                </div>

                {/* Directives List */}
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                    <span>📋</span>
                    <span>TCD Surveillance &amp; Endovascular Directives</span>
                  </h4>
                  <div className="space-y-2">
                    {tcdResult.directives.map((dir, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border text-xs leading-relaxed ${
                          dir.includes('CRITICAL') || dir.includes('STAT')
                            ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 font-semibold'
                            : dir.includes('MODERATE')
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
                <span className="text-4xl">📡</span>
                <h3 className="mt-2 text-base font-medium text-gray-900 dark:text-white">
                  No Active TCD Surveillance
                </h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-sm">
                  Enter bilateral MCA mean flow velocities and extracranial ICA flow to compute the Lindegaard ratio and vasospasm severity.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: LOGS & HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* SAH Evaluations */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
              <span>🩺</span>
              <span>Past aSAH Severity Evaluations</span>
            </h3>
            {sahHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs text-left">
                  <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 uppercase border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-3 py-2">Timestamp</th>
                      <th className="px-3 py-2">Hunt-Hess</th>
                      <th className="px-3 py-2">Mod Fisher</th>
                      <th className="px-3 py-2">WFNS</th>
                      <th className="px-3 py-2">DCI Risk</th>
                      <th className="px-3 py-2">Secured</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {sahHistory.map((row) => (
                      <tr key={row.id}>
                        <td className="px-3 py-2 text-gray-500">
                          {new Date(row.evaluated_at).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 font-bold">
                          Grade {row.hunt_hess_grade}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          Grade {row.modified_fisher_grade}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          Grade {row.wfns_grade}
                        </td>
                        <td className="px-3 py-2 font-semibold text-amber-600">
                          {row.dci_risk_category}
                        </td>
                        <td className="px-3 py-2">
                          {row.aneurysm_secured ? (
                            <span className="text-emerald-600 font-bold">Yes ({row.aneurysm_treatment_type})</span>
                          ) : (
                            <span className="text-rose-600 font-bold">Unsecured</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-400">No past aSAH evaluations found for Patient #{patientId}.</p>
            )}
          </div>

          {/* TCD Logs */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
              <span>📡</span>
              <span>Past TCD Vasospasm Surveillance Logs</span>
            </h3>
            {tcdHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs text-left">
                  <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 uppercase border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-3 py-2">Timestamp</th>
                      <th className="px-3 py-2">Day</th>
                      <th className="px-3 py-2">MCA Left/Right</th>
                      <th className="px-3 py-2">Lindegaard</th>
                      <th className="px-3 py-2">Severity</th>
                      <th className="px-3 py-2">Rescue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {tcdHistory.map((row) => (
                      <tr key={row.id}>
                        <td className="px-3 py-2 text-gray-500">
                          {new Date(row.logged_at).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          Day {row.post_bleed_day}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {row.mca_mfv_left} / {row.mca_mfv_right} cm/s
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-amber-600">
                          {row.lindegaard_ratio}
                        </td>
                        <td className="px-3 py-2 font-medium">
                          {row.vasospasm_severity}
                        </td>
                        <td className="px-3 py-2">
                          {row.endovascular_rescue_indicated ? (
                            <span className="text-rose-600 font-bold">STAT Rescue</span>
                          ) : (
                            <span className="text-gray-400">None</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-400">No past TCD logs found for Patient #{patientId}.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SubarachNavHub;
