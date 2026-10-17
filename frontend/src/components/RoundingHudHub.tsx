import React, { useState, useEffect } from 'react';

interface FastHugEvaluation {
  total_elements: number;
  compliant_elements: number;
  compliance_percent: number;
  safety_gaps: string[];
  recommendations: string[];
}

interface CamIcuEvaluation {
  delirium_status: 'POSITIVE' | 'NEGATIVE' | 'UNASSESSABLE_COMA';
  subtype: 'HYPERACTIVE' | 'HYPOACTIVE' | 'MIXED' | 'NONE';
  feature_1_acute_fluctuation: boolean;
  feature_2_inattention_positive: boolean;
  feature_3_altered_consciousness_positive: boolean;
  feature_4_disorganized_thinking_positive: boolean;
  qtc_alert: boolean;
  clinical_summary: string;
  antipsychotic_safety_warning?: string;
  interventions: string[];
}

interface DeviceEvaluation {
  device_type: string;
  device_days: number;
  daily_indication_present: boolean;
  infection_bundle_compliant: boolean;
  removal_recommended: boolean;
  infection_risk_level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  actionable_guidance: string[];
}

export const RoundingHudHub: React.FC = () => {
  const [patientId] = useState<number>(1);
  const [bedNumber, setBedNumber] = useState<string>('ICU-BED-04B');
  const [activeTab, setActiveTab] = useState<'fasthug' | 'camicu' | 'devices' | 'history'>('fasthug');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // FAST-HUG-BID state
  const [feedingStatus, setFeedingStatus] = useState<'ENTERAL' | 'PARENTERAL' | 'NPO_WITH_CONTRAINDICATION' | 'NPO_WITHOUT_REASON'>('ENTERAL');
  const [feedingCompliant, setFeedingCompliant] = useState<boolean>(true);

  const [painScore, setPainScore] = useState<number>(1);
  const [analgesiaAdequate, setAnalgesiaAdequate] = useState<boolean>(true);
  const [opioidSparing, setOpioidSparing] = useState<boolean>(true);

  const [rassTarget, setRassTarget] = useState<number>(-1);
  const [rassActual, setRassActual] = useState<number>(-1);
  const [sedationVacation, setSedationVacation] = useState<boolean>(true);

  const [vteModality, setVteModality] = useState<'PHARMACOLOGICAL_LMWH' | 'PHARMACOLOGICAL_UFH' | 'MECHANICAL_IPC_SCD' | 'NONE'>('PHARMACOLOGICAL_LMWH');
  const [vteContraindicated, setVteContraindicated] = useState<boolean>(false);

  const [hobDegrees, setHobDegrees] = useState<number>(35);
  const [hobContraindicated, setHobContraindicated] = useState<boolean>(false);

  const [ulcerIndicated, setUlcerIndicated] = useState<boolean>(true);
  const [ulcerAgent, setUlcerAgent] = useState<'PPI' | 'H2RA' | 'NONE'>('PPI');

  const [glucoseMgDl, setGlucoseMgDl] = useState<number>(145);
  const [insulinProtocol, setInsulinProtocol] = useState<boolean>(true);

  const [intubated, setIntubated] = useState<boolean>(true);
  const [sbtPerformed, setSbtPerformed] = useState<boolean>(true);

  const [deviceReviewConducted, setDeviceReviewConducted] = useState<boolean>(true);
  const [foleyPresent, setFoleyPresent] = useState<boolean>(true);
  const [cvcPresent, setCvcPresent] = useState<boolean>(true);
  const [artLinePresent, setArtLinePresent] = useState<boolean>(false);

  const [antibioticsActive, setAntibioticsActive] = useState<boolean>(true);
  const [timeout48hPerformed, setTimeout48hPerformed] = useState<boolean>(true);
  const [culturesReviewed, setCulturesReviewed] = useState<boolean>(true);

  const [fastHugResult, setFastHugResult] = useState<FastHugEvaluation | null>(null);

  // CAM-ICU state
  const [camAcuteOnset, setCamAcuteOnset] = useState<boolean>(true);
  const [inattentionErrors, setInattentionErrors] = useState<number>(3);
  const [camRass, setCamRass] = useState<number>(1);
  const [disorganizedErrors, setDisorganizedErrors] = useState<number>(2);
  const [qtcInterval, setQtcInterval] = useState<number>(515);
  const [baselineQtc, setBaselineQtc] = useState<number>(430);
  const [camIcuResult, setCamIcuResult] = useState<CamIcuEvaluation | null>(null);

  // Invasive Device state
  const [deviceType, setDeviceType] = useState<'foley_urinary_catheter' | 'central_venous_catheter' | 'endotracheal_tube' | 'arterial_line'>('foley_urinary_catheter');
  const [deviceDays, setDeviceDays] = useState<number>(3.5);
  const [indicationPresent, setIndicationPresent] = useState<boolean>(false);
  const [infectionBundleCompliant, setInfectionBundleCompliant] = useState<boolean>(true);
  const [deviceResult, setDeviceResult] = useState<DeviceEvaluation | null>(null);

  // History state
  const [history, setHistory] = useState<{ checklists: any[]; devices: any[] }>({ checklists: [], devices: [] });

  const fetchHistory = async () => {
    try {
      const res = await fetch(`/api/clinician/icu-rounding/patients/${patientId}/history`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [patientId]);

  const constructBundle = () => {
    return {
      feeding: {
        status: feedingStatus,
        compliant: feedingCompliant && feedingStatus !== 'NPO_WITHOUT_REASON'
      },
      analgesia: {
        assessed: true,
        score: painScore,
        adequate_control: analgesiaAdequate,
        opioid_sparing_used: opioidSparing,
        compliant: analgesiaAdequate
      },
      sedation: {
        rass_target: rassTarget,
        rass_actual: rassActual,
        sedation_vacation_attempted: sedationVacation,
        compliant: (rassActual === rassTarget || Math.abs(rassActual - rassTarget) <= 1) && sedationVacation
      },
      thromboembolism: {
        modality: vteModality,
        contraindication_documented: vteContraindicated,
        compliant: vteModality !== 'NONE' || vteContraindicated
      },
      head_of_bed: {
        elevation_degrees: hobDegrees,
        contraindicated: hobContraindicated,
        compliant: hobDegrees >= 30 || hobContraindicated
      },
      ulcer_prophylaxis: {
        indicated: ulcerIndicated,
        agent: ulcerAgent,
        compliant: !ulcerIndicated || ulcerAgent !== 'NONE'
      },
      glucose_control: {
        current_glucose_mg_dl: glucoseMgDl,
        within_target_range: glucoseMgDl >= 140 && glucoseMgDl <= 180,
        insulin_protocol_active: insulinProtocol,
        compliant: (glucoseMgDl >= 140 && glucoseMgDl <= 180) || insulinProtocol
      },
      breathing_trial: {
        intubated,
        sbt_performed_or_screened: sbtPerformed,
        compliant: !intubated || sbtPerformed
      },
      indwelling_devices: {
        daily_review_conducted: deviceReviewConducted,
        foley_in_place: foleyPresent,
        cvc_in_place: cvcPresent,
        art_line_in_place: artLinePresent,
        compliant: deviceReviewConducted
      },
      deescalation: {
        antibiotics_active: antibioticsActive,
        timeout_48h_performed: timeout48hPerformed,
        cultures_reviewed: culturesReviewed,
        compliant: !antibioticsActive || (timeout48hPerformed && culturesReviewed)
      }
    };
  };

  const handleEvaluateFastHug = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const bundle = constructBundle();
      const res = await fetch('/api/clinician/icu-rounding/evaluate-fasthug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundle })
      });
      if (res.ok) {
        const data = await res.json();
        setFastHugResult(data);
        setStatusMessage('FAST-HUG-BID bundle evaluated successfully.');
      } else {
        setStatusMessage('Evaluation failed.');
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveRoundingChecklist = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const bundle = constructBundle();
      const evalRes = await fetch('/api/clinician/icu-rounding/evaluate-fasthug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundle })
      });
      const evalData = await evalRes.json();

      const camRes = await fetch('/api/clinician/icu-rounding/evaluate-camicu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          features: {
            acute_onset_or_fluctuating: camAcuteOnset,
            inattention_errors: inattentionErrors,
            current_rass: camRass,
            disorganized_thinking_errors: disorganizedErrors
          },
          qtc_interval_ms: qtcInterval,
          baseline_qtc_ms: baselineQtc
        })
      });
      const camData = await camRes.json();

      const res = await fetch('/api/clinician/icu-rounding/checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          bed_number: bedNumber,
          fast_hug_bid_bundle: bundle,
          compliance_score_percent: evalData.compliance_percent,
          cam_icu_delirium_status: camData.delirium_status,
          cam_icu_subtype: camData.subtype,
          qtc_interval_ms: qtcInterval,
          qtc_risk_alert: camData.qtc_alert,
          antimicrobial_timeout_due: antibioticsActive && !timeout48hPerformed
        })
      });

      if (res.ok) {
        setStatusMessage('ICU Rounding Checklist permanently recorded in EHR chart.');
        fetchHistory();
      } else {
        setStatusMessage('Failed to save checklist.');
      }
    } catch (err: any) {
      setStatusMessage(`Error saving checklist: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEvaluateCamIcu = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const res = await fetch('/api/clinician/icu-rounding/evaluate-camicu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          features: {
            acute_onset_or_fluctuating: camAcuteOnset,
            inattention_errors: inattentionErrors,
            current_rass: camRass,
            disorganized_thinking_errors: disorganizedErrors
          },
          qtc_interval_ms: qtcInterval,
          baseline_qtc_ms: baselineQtc
        })
      });
      if (res.ok) {
        const data = await res.json();
        setCamIcuResult(data);
        setStatusMessage('CAM-ICU Delirium & QTc evaluation complete.');
      } else {
        setStatusMessage('Evaluation failed.');
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEvaluateDevice = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const res = await fetch('/api/clinician/icu-rounding/evaluate-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_type: deviceType,
          insertion_timestamp: new Date().toISOString(),
          device_days: deviceDays,
          daily_indication_present: indicationPresent,
          infection_bundle_compliant: infectionBundleCompliant
        })
      });
      if (res.ok) {
        const data = await res.json();
        setDeviceResult(data);
        setStatusMessage('Invasive device infection risk evaluated.');
      } else {
        setStatusMessage('Evaluation failed.');
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogDevice = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const evalRes = await fetch('/api/clinician/icu-rounding/evaluate-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_type: deviceType,
          insertion_timestamp: new Date().toISOString(),
          device_days: deviceDays,
          daily_indication_present: indicationPresent,
          infection_bundle_compliant: infectionBundleCompliant
        })
      });
      const evalData = await evalRes.json();

      const res = await fetch('/api/clinician/icu-rounding/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          device_type: deviceType,
          insertion_timestamp: new Date().toISOString(),
          device_days: deviceDays,
          daily_indication_present: indicationPresent,
          infection_bundle_compliant: infectionBundleCompliant,
          removal_recommended: evalData.removal_recommended
        })
      });

      if (res.ok) {
        setStatusMessage('Invasive device logged to surveillance registry.');
        fetchHistory();
      } else {
        setStatusMessage('Failed to log device.');
      }
    } catch (err: any) {
      setStatusMessage(`Error logging device: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-teal-500/30 rounded-xl p-6 text-slate-100 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-teal-500/20 text-teal-400 rounded-lg text-2xl">📋</span>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
                ROUNDING-HUD: Multidisciplinary Virtual-ICU Rounds
                <span className="text-xs bg-teal-500/20 text-teal-300 font-mono px-2 py-0.5 rounded border border-teal-500/30">
                  PHASE 75
                </span>
              </h2>
              <p className="text-sm text-slate-400">
                FAST-HUG-BID Safety Bundle, CAM-ICU Delirium & QTc Interlock, Device-Days Stewardship (CAUTI/CLABSI/VAP)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col text-right text-xs">
            <span className="text-slate-400">Target Bed</span>
            <input
              type="text"
              value={bedNumber}
              onChange={(e) => setBedNumber(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-teal-300 font-mono w-28 text-right focus:outline-none focus:border-teal-500"
            />
          </div>
          <button
            onClick={fetchHistory}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm border border-slate-700 transition"
            title="Refresh History"
          >
            🔄 Sync
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('fasthug')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition flex items-center gap-2 ${
            activeTab === 'fasthug'
              ? 'bg-teal-600 text-white shadow-lg shadow-teal-500/20'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
          }`}
        >
          <span>🛡️</span> FAST-HUG-BID Checklist
        </button>
        <button
          onClick={() => setActiveTab('camicu')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition flex items-center gap-2 ${
            activeTab === 'camicu'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/20'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
          }`}
        >
          <span>🧠</span> CAM-ICU Delirium & QTc
        </button>
        <button
          onClick={() => setActiveTab('devices')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition flex items-center gap-2 ${
            activeTab === 'devices'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
          }`}
        >
          <span>🩺</span> Invasive Lines (CAUTI/CLABSI)
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition flex items-center gap-2 ${
            activeTab === 'history'
              ? 'bg-slate-700 text-white shadow-lg shadow-slate-500/20'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
          }`}
        >
          <span>📑</span> Rounding History ({history.checklists.length + history.devices.length})
        </button>
      </div>

      {statusMessage && (
        <div className="p-3 bg-teal-950/80 border border-teal-500/40 text-teal-200 text-sm rounded-lg flex items-center justify-between">
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage('')} className="text-teal-400 hover:text-white ml-2">✕</button>
        </div>
      )}

      {/* TAB 1: FAST-HUG-BID CHECKLIST */}
      {activeTab === 'fasthug' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-teal-400 border-b border-slate-700/60 pb-2 flex items-center justify-between">
                <span>10-Point Core Safety Verification</span>
                <span className="text-xs text-slate-400 font-normal">Vincent JL (2005) & Crit Care Consensuses</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* F - Feeding */}
                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700/70 space-y-2">
                  <div className="flex justify-between items-center font-bold text-slate-200">
                    <span>[F] Feeding</span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={feedingCompliant}
                        onChange={(e) => setFeedingCompliant(e.target.checked)}
                        className="rounded bg-slate-800 border-slate-600 text-teal-500"
                      />
                      <span className="text-slate-300 font-normal">Compliant</span>
                    </label>
                  </div>
                  <select
                    value={feedingStatus}
                    onChange={(e: any) => setFeedingStatus(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-200"
                  >
                    <option value="ENTERAL">Enteral (Preferred trophic/full)</option>
                    <option value="PARENTERAL">Total Parenteral Nutrition (TPN)</option>
                    <option value="NPO_WITH_CONTRAINDICATION">NPO with Contraindication (Bowel obstruction/ischemia)</option>
                    <option value="NPO_WITHOUT_REASON">NPO without Active Indication (Gaps!)</option>
                  </select>
                </div>

                {/* A - Analgesia */}
                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700/70 space-y-2">
                  <div className="flex justify-between items-center font-bold text-slate-200">
                    <span>[A] Analgesia (Pain Score: {painScore})</span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={analgesiaAdequate}
                        onChange={(e) => setAnalgesiaAdequate(e.target.checked)}
                        className="rounded bg-slate-800 border-slate-600 text-teal-500"
                      />
                      <span className="text-slate-300 font-normal">Controlled</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Score (0-10):</span>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      value={painScore}
                      onChange={(e) => setPainScore(Number(e.target.value))}
                      className="w-full accent-teal-500"
                    />
                    <span className="font-mono text-teal-400 font-bold">{painScore}</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={opioidSparing}
                      onChange={(e) => setOpioidSparing(e.target.checked)}
                      className="rounded bg-slate-800 border-slate-600 text-teal-500"
                    />
                    <span>Multimodal opioid-sparing adjuncts used</span>
                  </label>
                </div>

                {/* S - Sedation */}
                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700/70 space-y-2">
                  <div className="flex justify-between items-center font-bold text-slate-200">
                    <span>[S] Sedation (RASS Target vs Actual)</span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sedationVacation}
                        onChange={(e) => setSedationVacation(e.target.checked)}
                        className="rounded bg-slate-800 border-slate-600 text-teal-500"
                      />
                      <span className="text-slate-300 font-normal">Daily SAT Done</span>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-400 block">Target RASS:</span>
                      <select
                        value={rassTarget}
                        onChange={(e) => setRassTarget(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-slate-200"
                      >
                        <option value={0}>0 (Alert & Calm)</option>
                        <option value={-1}>-1 (Drowsy)</option>
                        <option value={-2}>-2 (Light sedation)</option>
                        <option value={-3}>-3 (Moderate sedation)</option>
                        <option value={-4}>-4 (Deep sedation)</option>
                      </select>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Actual RASS:</span>
                      <select
                        value={rassActual}
                        onChange={(e) => setRassActual(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-slate-200"
                      >
                        <option value={1}>+1 (Restless)</option>
                        <option value={0}>0 (Alert & Calm)</option>
                        <option value={-1}>-1 (Drowsy)</option>
                        <option value={-2}>-2 (Light sedation)</option>
                        <option value={-3}>-3 (Moderate sedation)</option>
                        <option value={-4}>-4 (Deep sedation)</option>
                        <option value={-5}>-5 (Unarousable)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* T - Thromboembolism */}
                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700/70 space-y-2">
                  <div className="flex justify-between items-center font-bold text-slate-200">
                    <span>[T] Thromboembolism Prophylaxis</span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={vteContraindicated}
                        onChange={(e) => setVteContraindicated(e.target.checked)}
                        className="rounded bg-slate-800 border-slate-600 text-teal-500"
                      />
                      <span className="text-slate-300 font-normal">Bleed Risk</span>
                    </label>
                  </div>
                  <select
                    value={vteModality}
                    onChange={(e: any) => setVteModality(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-200"
                  >
                    <option value="PHARMACOLOGICAL_LMWH">LMWH (Enoxaparin 40mg SC daily)</option>
                    <option value="PHARMACOLOGICAL_UFH">UFH (Heparin 5000U SC q8h / CrCl &lt; 30)</option>
                    <option value="MECHANICAL_IPC_SCD">Mechanical IPC/SCD Boots Only</option>
                    <option value="NONE">None Prescribed (Safety Gap!)</option>
                  </select>
                </div>

                {/* H - Head of Bed */}
                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700/70 space-y-2">
                  <div className="flex justify-between items-center font-bold text-slate-200">
                    <span>[H] Head of Bed Elevation</span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hobContraindicated}
                        onChange={(e) => setHobContraindicated(e.target.checked)}
                        className="rounded bg-slate-800 border-slate-600 text-teal-500"
                      />
                      <span className="text-slate-300 font-normal">Contraindicated</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={60}
                      step={5}
                      value={hobDegrees}
                      onChange={(e) => setHobDegrees(Number(e.target.value))}
                      className="w-full accent-teal-500"
                    />
                    <span className={`font-mono font-bold ${hobDegrees >= 30 ? 'text-teal-400' : 'text-rose-400'}`}>
                      {hobDegrees}°
                    </span>
                  </div>
                  <span className="text-slate-400 text-[11px] block">Standard: 30° - 45° to reduce VAP & aspiration</span>
                </div>

                {/* U - Ulcer Prophylaxis */}
                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700/70 space-y-2">
                  <div className="flex justify-between items-center font-bold text-slate-200">
                    <span>[U] Stress Ulcer Prophylaxis</span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ulcerIndicated}
                        onChange={(e) => setUlcerIndicated(e.target.checked)}
                        className="rounded bg-slate-800 border-slate-600 text-teal-500"
                      />
                      <span className="text-slate-300 font-normal">Indicated</span>
                    </label>
                  </div>
                  <select
                    value={ulcerAgent}
                    onChange={(e: any) => setUlcerAgent(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-200"
                  >
                    <option value="PPI">Proton Pump Inhibitor (Pantoprazole 40mg IV/PO)</option>
                    <option value="H2RA">H2-Receptor Antagonist (Famotidine 20mg IV)</option>
                    <option value="NONE">None Active</option>
                  </select>
                </div>

                {/* G - Glucose Control */}
                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700/70 space-y-2">
                  <div className="flex justify-between items-center font-bold text-slate-200">
                    <span>[G] Glucose Control (mg/dL)</span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={insulinProtocol}
                        onChange={(e) => setInsulinProtocol(e.target.checked)}
                        className="rounded bg-slate-800 border-slate-600 text-teal-500"
                      />
                      <span className="text-slate-300 font-normal">Protocol Active</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={glucoseMgDl}
                      onChange={(e) => setGlucoseMgDl(Number(e.target.value))}
                      className="w-24 bg-slate-800 border border-slate-700 rounded p-1 font-mono text-teal-300"
                    />
                    <span className="text-slate-400 text-xs">Target: 140 - 180 mg/dL</span>
                  </div>
                </div>

                {/* B - Breathing Trial */}
                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700/70 space-y-2">
                  <div className="flex justify-between items-center font-bold text-slate-200">
                    <span>[B] Spontaneous Breathing (SBT)</span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={intubated}
                        onChange={(e) => setIntubated(e.target.checked)}
                        className="rounded bg-slate-800 border-slate-600 text-teal-500"
                      />
                      <span className="text-slate-300 font-normal">Intubated</span>
                    </label>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={sbtPerformed}
                      onChange={(e) => setSbtPerformed(e.target.checked)}
                      className="rounded bg-slate-800 border-slate-600 text-teal-500"
                    />
                    <span>Daily SBT conducted or readiness screened</span>
                  </label>
                </div>

                {/* I - Indwelling Devices */}
                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700/70 space-y-2">
                  <div className="flex justify-between items-center font-bold text-slate-200">
                    <span>[I] Indwelling Catheters Review</span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={deviceReviewConducted}
                        onChange={(e) => setDeviceReviewConducted(e.target.checked)}
                        className="rounded bg-slate-800 border-slate-600 text-teal-500"
                      />
                      <span className="text-slate-300 font-normal">Reviewed Today</span>
                    </label>
                  </div>
                  <div className="flex gap-3 text-[11px] text-slate-300">
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={foleyPresent} onChange={(e) => setFoleyPresent(e.target.checked)} />
                      <span>Foley</span>
                    </label>
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={cvcPresent} onChange={(e) => setCvcPresent(e.target.checked)} />
                      <span>CVC</span>
                    </label>
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={artLinePresent} onChange={(e) => setArtLinePresent(e.target.checked)} />
                      <span>A-Line</span>
                    </label>
                  </div>
                </div>

                {/* D - De-escalation */}
                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700/70 space-y-2">
                  <div className="flex justify-between items-center font-bold text-slate-200">
                    <span>[D] De-escalation & Culture Review</span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={antibioticsActive}
                        onChange={(e) => setAntibioticsActive(e.target.checked)}
                        className="rounded bg-slate-800 border-slate-600 text-teal-500"
                      />
                      <span className="text-slate-300 font-normal">Abx Active</span>
                    </label>
                  </div>
                  <div className="flex gap-3 text-[11px] text-slate-300">
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={timeout48hPerformed} onChange={(e) => setTimeout48hPerformed(e.target.checked)} />
                      <span>48h Timeout</span>
                    </label>
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={culturesReviewed} onChange={(e) => setCulturesReviewed(e.target.checked)} />
                      <span>Cultures Checked</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleEvaluateFastHug}
                  disabled={isLoading}
                  className="flex-1 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-xs transition"
                >
                  {isLoading ? 'Evaluating...' : '⚡ Calculate Compliance & Gaps'}
                </button>
                <button
                  onClick={handleSaveRoundingChecklist}
                  disabled={isLoading}
                  className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-teal-300 border border-teal-500/40 px-4 py-2 rounded-lg text-xs transition flex items-center gap-1.5"
                >
                  💾 Save to Chart
                </button>
              </div>
            </div>
          </div>

          {/* Evaluation Results Card */}
          <div className="space-y-4">
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-teal-400 border-b border-slate-700/60 pb-2">
                Safety & Compliance Analytics
              </h3>

              {fastHugResult ? (
                <div className="space-y-4">
                  {/* Gauge */}
                  <div className="text-center p-4 bg-slate-900/60 rounded-lg border border-slate-700/70">
                    <span className="text-xs text-slate-400 block mb-1">Bundle Compliance Score</span>
                    <div className="text-4xl font-black font-mono">
                      <span className={fastHugResult.compliance_percent >= 80 ? 'text-emerald-400' : 'text-amber-400'}>
                        {fastHugResult.compliance_percent}%
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 block mt-1">
                      {fastHugResult.compliant_elements} / {fastHugResult.total_elements} Elements Compliant
                    </span>
                  </div>

                  {/* Safety Gaps */}
                  {fastHugResult.safety_gaps.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1">
                        <span>⚠️</span> Safety Gaps Identified ({fastHugResult.safety_gaps.length})
                      </h4>
                      <div className="space-y-1.5">
                        {fastHugResult.safety_gaps.map((gap, i) => (
                          <div key={i} className="p-2 bg-rose-950/40 border border-rose-800/60 rounded text-xs text-rose-200">
                            • {gap}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {fastHugResult.recommendations.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-teal-300 flex items-center gap-1">
                        <span>💡</span> Multidisciplinary Action Items
                      </h4>
                      <div className="space-y-1.5">
                        {fastHugResult.recommendations.map((rec, i) => (
                          <div key={i} className="p-2 bg-teal-950/30 border border-teal-800/50 rounded text-xs text-teal-200">
                            → {rec}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 text-xs">
                  Click "Calculate Compliance & Gaps" to analyze the FAST-HUG-BID bundle.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CAM-ICU DELIRIUM & QTC */}
      {activeTab === 'camicu' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-400 border-b border-slate-700/60 pb-2 flex items-center justify-between">
                <span>CAM-ICU 4-Feature Assessment & Drug Safety</span>
                <span className="text-xs text-slate-400 font-normal">Ely EW et al. / SCCM PADIS Guidelines</span>
              </h3>

              <div className="space-y-3 text-xs">
                {/* Feature 1 */}
                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700/70 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-slate-200 block">Feature 1: Acute Onset or Fluctuating Course</span>
                    <span className="text-slate-400 text-[11px]">
                      Did mental status fluctuate from baseline or vary over the last 24 hours?
                    </span>
                  </div>
                  <button
                    onClick={() => setCamAcuteOnset(!camAcuteOnset)}
                    className={`px-3 py-1.5 rounded font-bold text-xs transition ${
                      camAcuteOnset ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {camAcuteOnset ? 'YES (Abnormal)' : 'NO (Normal)'}
                  </button>
                </div>

                {/* Feature 2 */}
                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700/70 space-y-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-bold text-slate-200 block">Feature 2: Inattention (SAVEAHAART Test)</span>
                      <span className="text-slate-400 text-[11px]">
                        Squeeze on letter 'A'. Total errors out of 10 (&gt; 2 errors is abnormal).
                      </span>
                    </div>
                    <span className={`font-mono font-bold px-2 py-0.5 rounded ${inattentionErrors > 2 ? 'bg-rose-950 text-rose-300' : 'bg-emerald-950 text-emerald-300'}`}>
                      {inattentionErrors} Errors {inattentionErrors > 2 ? '(Positive)' : '(Normal)'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={inattentionErrors}
                    onChange={(e) => setInattentionErrors(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>

                {/* Feature 3 */}
                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700/70 space-y-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-bold text-slate-200 block">Feature 3: Altered Level of Consciousness</span>
                      <span className="text-slate-400 text-[11px]">
                        Current Richmond Agitation-Sedation Scale (RASS). RASS != 0 is abnormal.
                      </span>
                    </div>
                    <span className={`font-mono font-bold px-2 py-0.5 rounded ${camRass !== 0 ? 'bg-amber-950 text-amber-300' : 'bg-emerald-950 text-emerald-300'}`}>
                      RASS {camRass > 0 ? `+${camRass}` : camRass}
                    </span>
                  </div>
                  <select
                    value={camRass}
                    onChange={(e) => setCamRass(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-200"
                  >
                    <option value={4}>+4: Combative (Violent, immediate danger)</option>
                    <option value={3}>+3: Very Agitated (Pulls tubes/lines)</option>
                    <option value={2}>+2: Agitated (Frequent non-purposeful movement)</option>
                    <option value={1}>+1: Restless (Anxious, apprehensive)</option>
                    <option value={0}>0: Alert and Calm (Normal baseline)</option>
                    <option value={-1}>-1: Drowsy (Awakens to voice &gt; 10s)</option>
                    <option value={-2}>-2: Light Sedation (Awakens to voice &lt; 10s)</option>
                    <option value={-3}>-3: Moderate Sedation (Movement, no eye contact)</option>
                    <option value={-4}>-4: Deep Sedation (Physical stimulation only - Unassessable)</option>
                    <option value={-5}>-5: Unarousable (No response - Coma)</option>
                  </select>
                </div>

                {/* Feature 4 */}
                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700/70 space-y-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-bold text-slate-200 block">Feature 4: Disorganized Thinking</span>
                      <span className="text-slate-400 text-[11px]">
                        4 Questions (e.g., Stone float? Fish in sea?) + 1 Command. (&gt; 1 error is abnormal).
                      </span>
                    </div>
                    <span className={`font-mono font-bold px-2 py-0.5 rounded ${disorganizedErrors > 1 ? 'bg-rose-950 text-rose-300' : 'bg-emerald-950 text-emerald-300'}`}>
                      {disorganizedErrors} Errors {disorganizedErrors > 1 ? '(Positive)' : '(Normal)'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={5}
                    value={disorganizedErrors}
                    onChange={(e) => setDisorganizedErrors(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>

                {/* QTc Interlock Section */}
                <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-lg space-y-2">
                  <span className="font-bold text-amber-300 block flex items-center gap-1.5">
                    <span>⚡</span> QTc Pharmacological Safety Interlock
                  </span>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-slate-400 block mb-1">Current QTc (ms):</span>
                      <input
                        type="number"
                        value={qtcInterval}
                        onChange={(e) => setQtcInterval(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 font-mono text-amber-300"
                      />
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-1">Baseline QTc (ms):</span>
                      <input
                        type="number"
                        value={baselineQtc}
                        onChange={(e) => setBaselineQtc(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 font-mono text-slate-300"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleEvaluateCamIcu}
                disabled={isLoading}
                className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-xs transition"
              >
                {isLoading ? 'Evaluating...' : '🧠 Run CAM-ICU & Drug Safety Algorithm'}
              </button>
            </div>
          </div>

          {/* CAM-ICU Output Card */}
          <div className="space-y-4">
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-400 border-b border-slate-700/60 pb-2">
                Delirium Status & Stewardship
              </h3>

              {camIcuResult ? (
                <div className="space-y-4">
                  {/* Status Box */}
                  <div className={`p-4 rounded-lg border text-center ${
                    camIcuResult.delirium_status === 'POSITIVE'
                      ? 'bg-rose-950/50 border-rose-700 text-rose-200'
                      : camIcuResult.delirium_status === 'UNASSESSABLE_COMA'
                      ? 'bg-slate-800 border-slate-600 text-slate-300'
                      : 'bg-emerald-950/50 border-emerald-700 text-emerald-200'
                  }`}>
                    <span className="text-xs uppercase tracking-wider opacity-80 block mb-1">Diagnostic Classification</span>
                    <div className="text-2xl font-black font-mono">
                      {camIcuResult.delirium_status === 'POSITIVE' && `POSITIVE (${camIcuResult.subtype})`}
                      {camIcuResult.delirium_status === 'NEGATIVE' && 'NEGATIVE'}
                      {camIcuResult.delirium_status === 'UNASSESSABLE_COMA' && 'UNASSESSABLE (COMA)'}
                    </div>
                    <p className="text-xs mt-2 text-slate-300">
                      {camIcuResult.clinical_summary}
                    </p>
                  </div>

                  {/* QTc Black-box Alert */}
                  {camIcuResult.qtc_alert && camIcuResult.antipsychotic_safety_warning && (
                    <div className="p-3 bg-red-950/70 border-2 border-red-600 rounded-lg text-xs text-red-200 space-y-1">
                      <span className="font-bold flex items-center gap-1.5 text-red-100 text-sm">
                        <span>🛑</span> BLACK-BOX QTc ALERT
                      </span>
                      <p>{camIcuResult.antipsychotic_safety_warning}</p>
                    </div>
                  )}

                  {/* Interventions */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1">
                      <span>📋</span> Recommended ABCDEF Bundle Actions
                    </h4>
                    <div className="space-y-1.5">
                      {camIcuResult.interventions.map((intv, i) => (
                        <div key={i} className="p-2 bg-amber-950/30 border border-amber-800/40 rounded text-xs text-amber-200">
                          • {intv}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 text-xs">
                  Run the CAM-ICU algorithm to determine delirium state and drug contraindications.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: INVASIVE LINES & DEVICE TRACKER */}
      {activeTab === 'devices' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-purple-400 border-b border-slate-700/60 pb-2">
                Invasive Device Surveillance & HAI Prevention
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-1 font-medium">Device Modality:</span>
                  <select
                    value={deviceType}
                    onChange={(e: any) => setDeviceType(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-200"
                  >
                    <option value="foley_urinary_catheter">Foley Indwelling Urinary Catheter (CAUTI)</option>
                    <option value="central_venous_catheter">Central Venous Catheter (CLABSI)</option>
                    <option value="endotracheal_tube">Endotracheal Tube / Ventilator (VAP)</option>
                    <option value="arterial_line">Arterial Catheter Line</option>
                  </select>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1 font-medium">Device Duration (Days):</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={deviceDays}
                    onChange={(e) => setDeviceDays(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 font-mono text-purple-300"
                  />
                </div>

                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700/70 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-slate-200 block">Daily Clinical Indication Present</span>
                    <span className="text-slate-400 text-[11px]">Strict medical necessity documented today</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={indicationPresent}
                    onChange={(e) => setIndicationPresent(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-600 text-purple-500 w-4 h-4 cursor-pointer"
                  />
                </div>

                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700/70 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-slate-200 block">Infection Bundle Compliance</span>
                    <span className="text-slate-400 text-[11px]">Dressing intact, clean port scrub, proper positioning</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={infectionBundleCompliant}
                    onChange={(e) => setInfectionBundleCompliant(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-600 text-purple-500 w-4 h-4 cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleEvaluateDevice}
                  disabled={isLoading}
                  className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-xs transition"
                >
                  {isLoading ? 'Evaluating...' : '🔍 Evaluate Infection Hazard'}
                </button>
                <button
                  onClick={handleLogDevice}
                  disabled={isLoading}
                  className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-purple-300 border border-purple-500/40 px-4 py-2 rounded-lg text-xs transition"
                >
                  📝 Log Device to Registry
                </button>
              </div>
            </div>
          </div>

          {/* Device Risk Card */}
          <div className="space-y-4">
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-purple-400 border-b border-slate-700/60 pb-2">
                Device Hazard & Removal Order
              </h3>

              {deviceResult ? (
                <div className="space-y-4">
                  <div className={`p-4 rounded-lg border text-center ${
                    deviceResult.infection_risk_level === 'CRITICAL'
                      ? 'bg-rose-950/70 border-rose-600 text-rose-200'
                      : deviceResult.infection_risk_level === 'HIGH'
                      ? 'bg-orange-950/70 border-orange-600 text-orange-200'
                      : deviceResult.infection_risk_level === 'MODERATE'
                      ? 'bg-amber-950/50 border-amber-600 text-amber-200'
                      : 'bg-emerald-950/50 border-emerald-600 text-emerald-200'
                  }`}>
                    <span className="text-xs uppercase tracking-wider opacity-80 block mb-1">Infection Risk Stratification</span>
                    <div className="text-2xl font-black font-mono">
                      {deviceResult.infection_risk_level} RISK
                    </div>
                    {deviceResult.removal_recommended && (
                      <div className="mt-2 inline-block bg-rose-600 text-white font-bold px-3 py-1 rounded-full text-xs animate-pulse">
                        ⚠️ CATHETER REMOVAL RECOMMENDED TODAY
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1">
                      <span>📋</span> Evidence-Based Guidance
                    </h4>
                    <div className="space-y-1.5">
                      {deviceResult.actionable_guidance.map((g, i) => (
                        <div key={i} className="p-2 bg-purple-950/30 border border-purple-800/40 rounded text-xs text-purple-200">
                          • {g}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 text-xs">
                  Evaluate device parameters to calculate CAUTI/CLABSI/VAP risk.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ROUNDING HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Checklists Table */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-teal-400 border-b border-slate-700/60 pb-2">
              Recent Multidisciplinary Rounding Checklists ({history.checklists.length})
            </h3>
            {history.checklists.length === 0 ? (
              <p className="text-xs text-slate-400">No rounding checklists saved yet for this patient.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400">
                      <th className="p-2">Bed</th>
                      <th className="p-2">Compliance</th>
                      <th className="p-2">CAM-ICU Delirium</th>
                      <th className="p-2">Subtype</th>
                      <th className="p-2">QTc</th>
                      <th className="p-2">Abx Timeout</th>
                      <th className="p-2">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {history.checklists.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-800/40">
                        <td className="p-2 font-mono text-teal-300 font-bold">{c.bed_number}</td>
                        <td className="p-2 font-mono">{c.compliance_score_percent}%</td>
                        <td className="p-2">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            c.cam_icu_delirium_status === 'POSITIVE'
                              ? 'bg-rose-950 text-rose-300'
                              : 'bg-emerald-950 text-emerald-300'
                          }`}>
                            {c.cam_icu_delirium_status}
                          </span>
                        </td>
                        <td className="p-2 font-mono">{c.cam_icu_subtype || 'NONE'}</td>
                        <td className="p-2 font-mono">{c.qtc_interval_ms ? `${c.qtc_interval_ms} ms` : '—'}</td>
                        <td className="p-2">{c.antimicrobial_timeout_due ? '⚠️ DUE' : '✅ Cleared'}</td>
                        <td className="p-2 text-slate-400 font-mono text-[11px]">{new Date(c.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Invasive Devices Table */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-purple-400 border-b border-slate-700/60 pb-2">
              Invasive Line & Catheter Registry ({history.devices.length})
            </h3>
            {history.devices.length === 0 ? (
              <p className="text-xs text-slate-400">No invasive devices logged yet for this patient.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400">
                      <th className="p-2">Device Type</th>
                      <th className="p-2">Device Days</th>
                      <th className="p-2">Indication Present</th>
                      <th className="p-2">Infection Bundle</th>
                      <th className="p-2">Removal Recommended</th>
                      <th className="p-2">Logged At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {history.devices.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-800/40">
                        <td className="p-2 font-mono text-purple-300">{d.device_type}</td>
                        <td className="p-2 font-mono">{d.device_days} d</td>
                        <td className="p-2">{d.daily_indication_present ? 'Yes' : 'No'}</td>
                        <td className="p-2">{d.infection_bundle_compliant ? 'Compliant' : 'Non-compliant'}</td>
                        <td className="p-2">
                          {d.removal_recommended ? (
                            <span className="text-rose-400 font-bold">YES (PULL LINE)</span>
                          ) : (
                            <span className="text-emerald-400">Continue</span>
                          )}
                        </td>
                        <td className="p-2 text-slate-400 font-mono text-[11px]">{new Date(d.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
export default RoundingHudHub;
