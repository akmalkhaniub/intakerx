import React, { useState, useEffect } from 'react';

interface AdjunctiveTherapy {
  agent: string;
  dosing: string;
  rationale: string;
}

interface ClinicalManagementStep {
  step: number;
  action: string;
  urgency: 'STAT_EMERGENT' | 'URGENT' | 'ROUTINE';
  rationale: string;
}

interface PphnEvaluationResult {
  paspMmhg: number;
  systemicSbpMmhg: number;
  paspSbpRatio: number;
  pphnSeverity: 'SUBSYSTEMIC_MILD' | 'ISOSYSTEMIC_MODERATE' | 'SUPRASYSTEMIC_SEVERE';
  shuntingPattern: string;
  oxygenationIndex: number;
  inoIndicated: boolean;
  inoDosePpm?: number;
  inoGuidance: string;
  adjunctiveTherapies: AdjunctiveTherapy[];
  ecmoEligibility: {
    eligibleByAgeAndWeight: boolean;
    ecmoCriteriaMet: boolean;
    alertStatus: 'CRITICAL_ECMO_CANDIDATE' | 'WATCHFUL_SURVEILLANCE' | 'INELIGIBLE';
    rationale: string;
  };
  clinicalManagementPlan: ClinicalManagementStep[];
}

interface InoMonitoringResult {
  oxygenationIndex: number;
  responderStatus: 'POSITIVE_RESPONDER' | 'NON_RESPONDER' | 'WEANING_CANDIDATE';
  methemoglobinStatus: 'NORMAL' | 'ELEVATED_WEAN_DOSE' | 'TOXIC_HOLD_METHYLENE_BLUE';
  reboundWarning: boolean;
  weaningDirectives: string[];
}

export const PphnResidualHub: React.FC = () => {
  const [patientId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'pphn_evaluator' | 'ino_monitor' | 'history'>('pphn_evaluator');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Tab 1: PPHN Evaluator State
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState<number>(39.0);
  const [birthWeightGrams, setBirthWeightGrams] = useState<number>(3400);
  const [etiology, setEtiology] = useState<'MAS' | 'RDS' | 'CDH' | 'SEPSIS_PNEUMONIA' | 'IDIOPATHIC'>('MAS');
  const [paspMmhg, setPaspMmhg] = useState<number>(75);
  const [systemicSbpMmhg, setSystemicSbpMmhg] = useState<number>(60);
  const [ductalShunt, setDuctalShunt] = useState<'PURE_RIGHT_TO_LEFT' | 'BIDIRECTIONAL' | 'PURE_LEFT_TO_RIGHT' | 'CLOSED'>('PURE_RIGHT_TO_LEFT');
  const [foramenOvaleShunt, setForamenOvaleShunt] = useState<'RIGHT_TO_LEFT' | 'BIDIRECTIONAL' | 'LEFT_TO_RIGHT'>('RIGHT_TO_LEFT');
  const [hasIvsFlattening, setHasIvsFlattening] = useState<boolean>(true);
  const [meanAirwayPressure, setMeanAirwayPressure] = useState<number>(18);
  const [fio2, setFio2] = useState<number>(100);
  const [pao2Mmhg, setPao2Mmhg] = useState<number>(45);
  const [lactateMmolL, setLactateMmolL] = useState<number>(4.8);
  const [ph, setPh] = useState<number>(7.22);
  const [pphnResult, setPphnResult] = useState<PphnEvaluationResult | null>(null);

  // Tab 2: iNO Monitoring State
  const [inoDosePpm, setInoDosePpm] = useState<number>(20);
  const [inoFio2, setInoFio2] = useState<number>(70);
  const [inoPao2, setInoPao2] = useState<number>(95);
  const [inoMap, setInoMap] = useState<number>(14);
  const [preInoPao2, setPreInoPao2] = useState<number>(45);
  const [methemoglobinPercent, setMethemoglobinPercent] = useState<number>(1.2);
  const [nitrogenDioxidePpm, setNitrogenDioxidePpm] = useState<number>(0.3);
  const [inoResult, setInoResult] = useState<InoMonitoringResult | null>(null);

  // Tab 3: History State
  const [evalHistory, setEvalHistory] = useState<any[]>([]);
  const [inoHistory, setInoHistory] = useState<any[]>([]);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [resEval, resIno] = await Promise.all([
        fetch(`/api/clinician/pphn/evaluations/${patientId}`, { headers }),
        fetch(`/api/clinician/pphn/ino-logs/${patientId}`, { headers })
      ]);

      if (resEval.ok) {
        const data = await resEval.json();
        setEvalHistory(data);
      }
      if (resIno.ok) {
        const data = await resIno.json();
        setInoHistory(data);
      }
    } catch (err) {
      console.error('Failed to fetch PPHN history:', err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [patientId]);

  // Handle PPHN Evaluation
  const handleEvaluatePphn = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/clinician/pphn/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId,
          gestationalAgeWeeks,
          birthWeightGrams,
          etiology,
          paspMmhg,
          systemicSbpMmhg,
          ductalShunt,
          foramenOvaleShunt,
          hasIvsFlatteningOrDShapedLv: hasIvsFlattening,
          meanAirwayPressureMmh2o: meanAirwayPressure,
          fio2,
          pao2Mmhg,
          lactateMmolL: lactateMmolL || undefined,
          ph: ph || undefined,
          saveEvaluation: true
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Evaluation failed');
      }

      const data = await res.json();
      setPphnResult(data.evaluation);
      setStatusMessage('PPHN hemodynamic evaluation calculated and saved successfully.');
      fetchHistory();
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle iNO Monitoring
  const handleMonitorIno = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/clinician/pphn/ino/monitor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId,
          inoDosePpm,
          fio2: inoFio2,
          pao2Mmhg: inoPao2,
          meanAirwayPressureMmh2o: inoMap,
          preInoPao2: preInoPao2 || undefined,
          methemoglobinPercent,
          nitrogenDioxidePpm: nitrogenDioxidePpm || undefined,
          saveLog: true
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Monitoring calculation failed');
      }

      const data = await res.json();
      setInoResult(data.monitoring);
      setStatusMessage('iNO monitoring status evaluated and recorded successfully.');
      fetchHistory();
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <div className="flex items-center space-x-3">
            <span className="text-3xl">💨</span>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              PPHN-RESIDUAL: Persistent Pulmonary Hypertension & iNO Sentinel
            </h1>
            <span className="px-2.5 py-1 text-xs font-semibold bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-300 rounded-full">
              Phase 90
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            PASP/SBP Shunt Hemodynamics, Oxygenation Index (OI), iNO Response & Weaning Protocol, Methemoglobinemia Toxicity Sentinel, and VA-ECMO Decision Engine
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="mt-4 md:mt-0 flex space-x-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('pphn_evaluator')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'pphn_evaluator'
                ? 'bg-white dark:bg-gray-700 text-sky-600 dark:text-sky-300 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            🫀 PPHN Evaluator
          </button>
          <button
            onClick={() => setActiveTab('ino_monitor')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'ino_monitor'
                ? 'bg-white dark:bg-gray-700 text-sky-600 dark:text-sky-300 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            🧪 iNO & MetHb Sentinel
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'history'
                ? 'bg-white dark:bg-gray-700 text-sky-600 dark:text-sky-300 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            📋 Logs & History
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

      {/* TAB 1: PPHN EVALUATOR */}
      {activeTab === 'pphn_evaluator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Input Panel */}
          <div className="lg:col-span-5 bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
              <span>🩺</span>
              <span>PPHN Clinical & Hemodynamic Parameters</span>
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Gestational Age (weeks)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={gestationalAgeWeeks}
                  onChange={(e) => setGestationalAgeWeeks(parseFloat(e.target.value) || 0)}
                  className="mt-1 block w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Birth Weight (g)
                </label>
                <input
                  type="number"
                  value={birthWeightGrams}
                  onChange={(e) => setBirthWeightGrams(parseInt(e.target.value) || 0)}
                  className="mt-1 block w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                Underlying Etiology
              </label>
              <select
                value={etiology}
                onChange={(e) => setEtiology(e.target.value as any)}
                className="mt-1 block w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
              >
                <option value="MAS">Meconium Aspiration Syndrome (MAS)</option>
                <option value="RDS">Respiratory Distress Syndrome (RDS)</option>
                <option value="CDH">Congenital Diaphragmatic Hernia (CDH)</option>
                <option value="SEPSIS_PNEUMONIA">Neonatal Sepsis / Bacterial Pneumonia</option>
                <option value="IDIOPATHIC">Idiopathic / Persistent Pulmonary Vasospasm</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Estimated PASP (mmHg)
                </label>
                <input
                  type="number"
                  value={paspMmhg}
                  onChange={(e) => setPaspMmhg(parseInt(e.target.value) || 0)}
                  className="mt-1 block w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white font-mono"
                />
                <span className="text-[10px] text-gray-400">TR Jet gradient + RAP</span>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Systemic SBP (mmHg)
                </label>
                <input
                  type="number"
                  value={systemicSbpMmhg}
                  onChange={(e) => setSystemicSbpMmhg(parseInt(e.target.value) || 0)}
                  className="mt-1 block w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white font-mono"
                />
                <span className="text-[10px] text-gray-400">Arterial line / cuff</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Ductal Shunting (PDA)
                </label>
                <select
                  value={ductalShunt}
                  onChange={(e) => setDuctalShunt(e.target.value as any)}
                  className="mt-1 block w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                >
                  <option value="PURE_RIGHT_TO_LEFT">Pure Right-to-Left</option>
                  <option value="BIDIRECTIONAL">Bidirectional</option>
                  <option value="PURE_LEFT_TO_RIGHT">Pure Left-to-Right</option>
                  <option value="CLOSED">Closed / Restrictive</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Foramen Ovale (PFO)
                </label>
                <select
                  value={foramenOvaleShunt}
                  onChange={(e) => setForamenOvaleShunt(e.target.value as any)}
                  className="mt-1 block w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                >
                  <option value="RIGHT_TO_LEFT">Right-to-Left</option>
                  <option value="BIDIRECTIONAL">Bidirectional</option>
                  <option value="LEFT_TO_RIGHT">Left-to-Right</option>
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id="ivsFlattening"
                checked={hasIvsFlattening}
                onChange={(e) => setHasIvsFlattening(e.target.checked)}
                className="h-4 w-4 text-sky-600 rounded border-gray-300 dark:border-gray-600"
              />
              <label htmlFor="ivsFlattening" className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Interventricular Septum Flattening (D-Shaped LV)
              </label>
            </div>

            <div className="pt-2 border-t border-gray-100 dark:border-gray-700 grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  MAP (cmH2O)
                </label>
                <input
                  type="number"
                  value={meanAirwayPressure}
                  onChange={(e) => setMeanAirwayPressure(parseFloat(e.target.value) || 0)}
                  className="mt-1 block w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  FiO2 (%)
                </label>
                <input
                  type="number"
                  value={fio2}
                  onChange={(e) => setFio2(parseFloat(e.target.value) || 0)}
                  className="mt-1 block w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  PaO2 (mmHg)
                </label>
                <input
                  type="number"
                  value={pao2Mmhg}
                  onChange={(e) => setPao2Mmhg(parseFloat(e.target.value) || 0)}
                  className="mt-1 block w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  pH (ABG)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={ph}
                  onChange={(e) => setPh(parseFloat(e.target.value) || 0)}
                  className="mt-1 block w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Lactate (mmol/L)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={lactateMmolL}
                  onChange={(e) => setLactateMmolL(parseFloat(e.target.value) || 0)}
                  className="mt-1 block w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white font-mono"
                />
              </div>
            </div>

            <button
              onClick={handleEvaluatePphn}
              disabled={isLoading}
              className="w-full mt-2 py-2.5 px-4 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-colors flex items-center justify-center space-x-2"
            >
              <span>{isLoading ? 'Calculating...' : '⚡ Compute PPHN Severity & Directives'}</span>
            </button>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-7 space-y-4">
            {pphnResult ? (
              <div className="space-y-4">
                {/* Severity Card */}
                <div
                  className={`p-5 rounded-xl border ${
                    pphnResult.pphnSeverity === 'SUPRASYSTEMIC_SEVERE'
                      ? 'bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800'
                      : pphnResult.pphnSeverity === 'ISOSYSTEMIC_MODERATE'
                      ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800'
                      : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400">
                        PPHN Hemodynamic Classification
                      </span>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {pphnResult.pphnSeverity.replace(/_/g, ' ')}
                      </h3>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                        {pphnResult.shuntingPattern}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black font-mono text-gray-900 dark:text-white">
                        PASP/SBP: {pphnResult.paspSbpRatio}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {pphnResult.paspMmhg} / {pphnResult.systemicSbpMmhg} mmHg
                      </div>
                    </div>
                  </div>

                  {/* Metrics Badges */}
                  <div className="mt-4 pt-4 border-t border-gray-200/60 dark:border-gray-700/60 grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="p-2.5 bg-white/70 dark:bg-gray-800/70 rounded-lg">
                      <div className="text-[10px] text-gray-500">Oxygenation Index (OI)</div>
                      <div className={`text-lg font-bold font-mono ${
                        pphnResult.oxygenationIndex >= 40
                          ? 'text-rose-600 dark:text-rose-400'
                          : pphnResult.oxygenationIndex >= 25
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-sky-600 dark:text-sky-400'
                      }`}>
                        {pphnResult.oxygenationIndex}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {pphnResult.oxygenationIndex >= 40 ? 'Critical ECMO Trigger' : pphnResult.oxygenationIndex >= 15 ? 'iNO Threshold Met' : 'Adequate'}
                      </div>
                    </div>

                    <div className="p-2.5 bg-white/70 dark:bg-gray-800/70 rounded-lg">
                      <div className="text-[10px] text-gray-500">Inhaled Nitric Oxide (iNO)</div>
                      <div className={`text-lg font-bold ${
                        pphnResult.inoIndicated ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500'
                      }`}>
                        {pphnResult.inoIndicated ? `${pphnResult.inoDosePpm} ppm (Indicated)` : 'Not Indicated'}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {pphnResult.inoIndicated ? 'Selective Vasodilator' : 'OI < 15 & Subsystemic'}
                      </div>
                    </div>

                    <div className="p-2.5 bg-white/70 dark:bg-gray-800/70 rounded-lg col-span-2 md:col-span-1">
                      <div className="text-[10px] text-gray-500">Neonatal ECMO Status</div>
                      <div className={`text-sm font-bold ${
                        pphnResult.ecmoEligibility.alertStatus === 'CRITICAL_ECMO_CANDIDATE'
                          ? 'text-rose-600 dark:text-rose-400'
                          : pphnResult.ecmoEligibility.alertStatus === 'INELIGIBLE'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {pphnResult.ecmoEligibility.alertStatus.replace(/_/g, ' ')}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {pphnResult.ecmoEligibility.eligibleByAgeAndWeight ? 'GA & Wt Eligible' : 'Age/Wt Ineligible'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* iNO Guidance Alert */}
                <div className="p-4 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-xl">
                  <h4 className="text-sm font-semibold text-sky-900 dark:text-sky-200 flex items-center space-x-1.5">
                    <span>🧪</span>
                    <span>iNO Administration Guidance</span>
                  </h4>
                  <p className="mt-1 text-xs text-sky-800 dark:text-sky-300 leading-relaxed">
                    {pphnResult.inoGuidance}
                  </p>
                </div>

                {/* Adjunctive Inotropic & Vasodilator Strategy */}
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                    <span>💊</span>
                    <span>Adjunctive Hemodynamic & Inotropic Support (Target SBP &gt; PASP)</span>
                  </h4>
                  <div className="space-y-2">
                    {pphnResult.adjunctiveTherapies.map((tx, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-900 dark:text-white">{tx.agent}</span>
                          <span className="text-[11px] font-mono text-sky-600 dark:text-sky-400">{tx.dosing}</span>
                        </div>
                        <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-1">{tx.rationale}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Step-by-Step Clinical Action Plan */}
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                    <span>⚡</span>
                    <span>Stat Clinical Management Directives</span>
                  </h4>
                  <div className="space-y-2">
                    {pphnResult.clinicalManagementPlan.map((plan) => (
                      <div
                        key={plan.step}
                        className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 flex items-start space-x-3"
                      >
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 text-xs font-bold flex items-center justify-center">
                          {plan.step}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-900 dark:text-white">
                              {plan.action}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                plan.urgency === 'STAT_EMERGENT'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                              }`}
                            >
                              {plan.urgency}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                            {plan.rationale}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[350px] flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-800/40 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-center">
                <span className="text-4xl">💨</span>
                <h3 className="mt-2 text-base font-medium text-gray-900 dark:text-white">
                  No Active PPHN Evaluation
                </h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-sm">
                  Adjust clinical parameters on the left and click 'Compute PPHN Severity & Directives' to calculate shunting dynamics and iNO guidelines.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: INO MONITORING & METHEMOGLOBIN */}
      {activeTab === 'ino_monitor' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Input Panel */}
          <div className="lg:col-span-5 bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
              <span>🧪</span>
              <span>iNO Titration & Toxic Byproduct Surveillance</span>
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Current iNO Dose (ppm)
                </label>
                <input
                  type="number"
                  value={inoDosePpm}
                  onChange={(e) => setInoDosePpm(parseInt(e.target.value) || 0)}
                  className="mt-1 block w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Current FiO2 (%)
                </label>
                <input
                  type="number"
                  value={inoFio2}
                  onChange={(e) => setInoFio2(parseFloat(e.target.value) || 0)}
                  className="mt-1 block w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Current PaO2 (mmHg)
                </label>
                <input
                  type="number"
                  value={inoPao2}
                  onChange={(e) => setInoPao2(parseFloat(e.target.value) || 0)}
                  className="mt-1 block w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Mean Airway Pressure (cmH2O)
                </label>
                <input
                  type="number"
                  value={inoMap}
                  onChange={(e) => setInoMap(parseFloat(e.target.value) || 0)}
                  className="mt-1 block w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                Pre-iNO Baseline PaO2 (mmHg, optional)
              </label>
              <input
                type="number"
                value={preInoPao2}
                onChange={(e) => setPreInoPao2(parseFloat(e.target.value) || 0)}
                className="mt-1 block w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white font-mono"
              />
              <span className="text-[10px] text-gray-400">Used to confirm &ge; 20 mmHg responder criteria</span>
            </div>

            <div className="pt-2 border-t border-gray-100 dark:border-gray-700 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Methemoglobin (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={methemoglobinPercent}
                  onChange={(e) => setMethemoglobinPercent(parseFloat(e.target.value) || 0)}
                  className="mt-1 block w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white font-mono"
                />
                <span className="text-[10px] text-gray-400">Target &lt; 2.5% | Toxic &ge; 5.0%</span>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Nitrogen Dioxide NO2 (ppm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={nitrogenDioxidePpm}
                  onChange={(e) => setNitrogenDioxidePpm(parseFloat(e.target.value) || 0)}
                  className="mt-1 block w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white font-mono"
                />
                <span className="text-[10px] text-gray-400">Ceiling &lt; 0.5 ppm</span>
              </div>
            </div>

            <button
              onClick={handleMonitorIno}
              disabled={isLoading}
              className="w-full mt-2 py-2.5 px-4 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-colors flex items-center justify-center space-x-2"
            >
              <span>{isLoading ? 'Monitoring...' : '🔍 Assess iNO Response & MetHb Safety'}</span>
            </button>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-7 space-y-4">
            {inoResult ? (
              <div className="space-y-4">
                {/* Header Status */}
                <div
                  className={`p-5 rounded-xl border ${
                    inoResult.methemoglobinStatus === 'TOXIC_HOLD_METHYLENE_BLUE'
                      ? 'bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800'
                      : inoResult.responderStatus === 'WEANING_CANDIDATE'
                      ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800'
                      : inoResult.responderStatus === 'POSITIVE_RESPONDER'
                      ? 'bg-sky-50 border-sky-200 dark:bg-sky-950/40 dark:border-sky-800'
                      : 'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400">
                        iNO Response Status
                      </span>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {inoResult.responderStatus.replace(/_/g, ' ')}
                      </h3>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                        Oxygenation Index on iNO: {inoResult.oxygenationIndex}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400">
                        Methemoglobin Alert
                      </span>
                      <div className={`text-base font-bold ${
                        inoResult.methemoglobinStatus === 'TOXIC_HOLD_METHYLENE_BLUE'
                          ? 'text-rose-600 dark:text-rose-400'
                          : inoResult.methemoglobinStatus === 'ELEVATED_WEAN_DOSE'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {inoResult.methemoglobinStatus.replace(/_/g, ' ')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rebound PPHN Warning */}
                {inoResult.reboundWarning && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl">
                    <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200 flex items-center space-x-1.5">
                      <span>⚠️</span>
                      <span>CRITICAL REBOUND PPHN SAFEGUARD</span>
                    </h4>
                    <p className="mt-1 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                      DO NOT abruptly discontinue iNO under any circumstances. Abrupt withdrawal causes acute, severe rebound pulmonary vasoconstriction, catastrophic right heart failure, and hypoxemic arrest. Always taper gradually down to 1 ppm before cessation.
                    </p>
                  </div>
                )}

                {/* Directives List */}
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                    <span>📋</span>
                    <span>Clinical Titration & Weaning Directives</span>
                  </h4>
                  <div className="space-y-2">
                    {inoResult.weaningDirectives.map((dir, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border text-xs leading-relaxed ${
                          dir.includes('Methylene Blue') || dir.includes('CRITICAL')
                            ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 font-semibold'
                            : dir.includes('ELEVATED METHEMOGLOBIN')
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
                  No Active iNO Log Evaluated
                </h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-sm">
                  Enter current iNO titration parameters, MetHb, and blood gases to calculate responder status and safety weaning directives.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: LOGS & HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* PPHN Evaluation Logs */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
              <span>🩺</span>
              <span>Past PPHN Hemodynamic Assessments</span>
            </h3>
            {evalHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs text-left">
                  <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 uppercase border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-3 py-2">Timestamp</th>
                      <th className="px-3 py-2">Severity</th>
                      <th className="px-3 py-2">PASP / SBP</th>
                      <th className="px-3 py-2">OI</th>
                      <th className="px-3 py-2">iNO Indicated</th>
                      <th className="px-3 py-2">ECMO Alert</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {evalHistory.map((row) => (
                      <tr key={row.id}>
                        <td className="px-3 py-2 text-gray-500">
                          {new Date(row.evaluated_at).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 font-semibold text-gray-900 dark:text-white">
                          {row.pphn_severity}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {row.pasp_mmhg} / {row.systemic_sbp_mmhg} ({row.pasp_sbp_ratio})
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-sky-600">
                          {row.oxygenation_index}
                        </td>
                        <td className="px-3 py-2">
                          {row.ino_indicated ? (
                            <span className="text-emerald-600 font-semibold">Yes ({row.ino_dose_ppm} ppm)</span>
                          ) : (
                            <span className="text-gray-400">No</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {row.ecmo_criteria_met ? (
                            <span className="text-rose-600 font-bold">CRITICAL ECMO</span>
                          ) : (
                            <span className="text-gray-500">None</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-400">No past PPHN evaluation records found for Patient #{patientId}.</p>
            )}
          </div>

          {/* iNO Monitoring Logs */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
              <span>🧪</span>
              <span>Past iNO Titration & MetHb Logs</span>
            </h3>
            {inoHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs text-left">
                  <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 uppercase border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-3 py-2">Timestamp</th>
                      <th className="px-3 py-2">iNO Dose</th>
                      <th className="px-3 py-2">FiO2 / PaO2</th>
                      <th className="px-3 py-2">OI</th>
                      <th className="px-3 py-2">MetHb (%)</th>
                      <th className="px-3 py-2">Responder Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {inoHistory.map((row) => (
                      <tr key={row.id}>
                        <td className="px-3 py-2 text-gray-500">
                          {new Date(row.logged_at).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-gray-900 dark:text-white">
                          {row.ino_dose_ppm} ppm
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {row.fio2}% / {row.pao2_mmhg} mmHg
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-sky-600">
                          {row.oxygenation_index}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          <span className={Number(row.methemoglobin_percent) >= 5.0 ? 'text-rose-600 font-bold' : ''}>
                            {row.methemoglobin_percent}%
                          </span>
                        </td>
                        <td className="px-3 py-2 font-medium">
                          {row.responder_status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-400">No past iNO monitoring logs found for Patient #{patientId}.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PphnResidualHub;
