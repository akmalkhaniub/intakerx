import React, { useState } from 'react';

interface KingsEvaluation {
  etiology: 'Acetaminophen' | 'Non-Acetaminophen';
  arterial_ph: number;
  inr: number;
  serum_creatinine_mg_dl: number;
  serum_bilirubin_mg_dl: number;
  west_haven_he_grade: string;
  arterial_lactate_mmol_l?: number;
  criteria_met: boolean;
  criteria_triggers: string[];
  recommendation: string;
}

interface MarsClearance {
  bilirubin_clearance_percent: number;
  ammonia_clearance_percent: number;
  target_clearance_achieved: boolean;
  clinical_recommendations: string[];
}

interface CerebralRisk {
  icp_elevation_risk: string;
  icp_monitoring_indicated: boolean;
  cerebral_perfusion_pressure_target_mmhg: string;
  hyperosmolar_therapy_indicated: boolean;
  interventions: string[];
}

export const LiverAliveHub: React.FC = () => {
  const [patientId] = useState<number>(1);
  const [etiology, setEtiology] = useState<'Acetaminophen' | 'Non-Acetaminophen'>('Acetaminophen');
  const [heGrade, setHeGrade] = useState<string>('Grade_III');
  const [inr, setInr] = useState<number>(6.8);
  const [bilirubin, setBilirubin] = useState<number>(14.5);
  const [creatinine, setCreatinine] = useState<number>(3.6);
  const [arterialPh, setArterialPh] = useState<number>(7.28);
  const [lactate, setLactate] = useState<number>(4.2);
  const [ammonia, setAmmonia] = useState<number>(185);

  // MARS dialysis parameters
  const [dialysisSystem, setDialysisSystem] = useState<'MARS' | 'Prometheus'>('MARS');
  const [prescribedHours, setPrescribedHours] = useState<number>(6.0);
  const [bloodFlow, setBloodFlow] = useState<number>(180);
  const [albuminFlow, setAlbuminFlow] = useState<number>(150);
  const [finalBilirubin, setFinalBilirubin] = useState<number>(9.5);
  const [finalAmmonia, setFinalAmmonia] = useState<number>(95);

  // Results
  const [kingsResult, setKingsResult] = useState<KingsEvaluation | null>(null);
  const [marsResult, setMarsResult] = useState<MarsClearance | null>(null);
  const [cerebralResult, setCerebralResult] = useState<CerebralRisk | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const evaluateKingsCriteria = async () => {
    try {
      const res = await fetch('/api/clinician/liver/evaluate-kings-college', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          etiology,
          arterial_ph: arterialPh,
          inr,
          serum_creatinine_mg_dl: creatinine,
          serum_bilirubin_mg_dl: bilirubin,
          west_haven_he_grade: heGrade,
          arterial_lactate_mmol_l: lactate,
          patient_age_years: 38
        })
      });
      if (res.ok) {
        const data = await res.json();
        setKingsResult(data);
        setStatusMessage('King\'s College evaluation computed successfully.');
      }
    } catch (e: any) {
      setStatusMessage('Error evaluating King\'s College: ' + e.message);
    }
  };

  const evaluateMars = async () => {
    try {
      const res = await fetch('/api/clinician/liver/evaluate-mars-clearance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          dialysis_system: dialysisSystem,
          prescribed_hours: prescribedHours,
          blood_flow_rate_ml_min: bloodFlow,
          albumin_dialysate_flow_ml_min: albuminFlow,
          initial_total_bilirubin_mg_dl: bilirubin,
          final_total_bilirubin_mg_dl: finalBilirubin,
          initial_ammonia_umol_l: ammonia,
          final_ammonia_umol_l: finalAmmonia
        })
      });
      if (res.ok) {
        const data = await res.json();
        setMarsResult(data);
        setStatusMessage('MARS Albumin clearance evaluated.');
      }
    } catch (e: any) {
      setStatusMessage('Error evaluating MARS clearance: ' + e.message);
    }
  };

  const evaluateCerebralEdema = async () => {
    try {
      const res = await fetch('/api/clinician/liver/evaluate-cerebral-edema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          serum_ammonia_umol_l: ammonia,
          west_haven_he_grade: heGrade
        })
      });
      if (res.ok) {
        const data = await res.json();
        setCerebralResult(data);
        setStatusMessage('Cerebral edema & ICP risk evaluated.');
      }
    } catch (e: any) {
      setStatusMessage('Error evaluating cerebral edema risk: ' + e.message);
    }
  };

  const runAllEvaluations = async () => {
    await evaluateKingsCriteria();
    await evaluateMars();
    await evaluateCerebralEdema();
  };

  return (
    <div className="p-6 bg-slate-900 text-slate-100 rounded-xl shadow-2xl border border-slate-800 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2 bg-amber-500/20 text-amber-400 rounded-lg text-xl font-bold">🧪 LIVER-ALIVE</span>
            <h2 className="text-2xl font-bold tracking-tight text-white">Molecular Adsorbent Liver Support & ALF Command</h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            King's College Hospital Criteria, MARS/Prometheus Albumin Dialysis, and Neuroprotective ICP Watchdog
          </p>
        </div>
        <button
          onClick={runAllEvaluations}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg shadow-md transition-colors"
        >
          Run Full Liver Assessment
        </button>
      </div>

      {statusMessage && (
        <div className="px-4 py-2 bg-slate-800 border border-slate-700 text-xs text-amber-300 rounded">
          {statusMessage}
        </div>
      )}

      {/* Input Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Acute Liver Failure Markers */}
        <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700/80 space-y-3">
          <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">Acute Liver Failure Profile</h3>
          
          <div>
            <label className="text-xs text-slate-300 block mb-1">Etiology</label>
            <select
              value={etiology}
              onChange={(e) => setEtiology(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-sm text-white"
            >
              <option value="Acetaminophen">Acetaminophen (APAP) Toxicity</option>
              <option value="Non-Acetaminophen">Non-Acetaminophen (Viral/Idiosyncratic/Autoimmune)</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-300 block mb-1">West Haven HE Grade</label>
            <select
              value={heGrade}
              onChange={(e) => setHeGrade(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-sm text-white"
            >
              <option value="Grade_0">Grade 0: Normal / Minimal</option>
              <option value="Grade_I">Grade I: Mild confusion, euphoria/anxiety</option>
              <option value="Grade_II">Grade II: Lethargy, asterixis, disorientation</option>
              <option value="Grade_III">Grade III: Somnolence, marked confusion</option>
              <option value="Grade_IV">Grade IV: Coma (unresponsive to stimuli)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-300 block">INR</label>
              <input
                type="number"
                step="0.1"
                value={inr}
                onChange={(e) => setInr(parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-300 block">Creatinine (mg/dL)</label>
              <input
                type="number"
                step="0.1"
                value={creatinine}
                onChange={(e) => setCreatinine(parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-300 block">Arterial pH</label>
              <input
                type="number"
                step="0.01"
                value={arterialPh}
                onChange={(e) => setArterialPh(parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-300 block">Lactate (mmol/L)</label>
              <input
                type="number"
                step="0.1"
                value={lactate}
                onChange={(e) => setLactate(parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-white"
              />
            </div>
          </div>
        </div>

        {/* Albumin Dialysis (MARS) Inputs */}
        <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700/80 space-y-3">
          <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider">Albumin Dialysis Prescriptions</h3>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-300 block mb-1">System</label>
              <select
                value={dialysisSystem}
                onChange={(e) => setDialysisSystem(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-sm text-white"
              >
                <option value="MARS">MARS (AlbuMax)</option>
                <option value="Prometheus">Prometheus (FPSA)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-300 block mb-1">Hours</label>
              <input
                type="number"
                step="0.5"
                value={prescribedHours}
                onChange={(e) => setPrescribedHours(parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-300 block">Blood Flow (mL/min)</label>
              <input
                type="number"
                value={bloodFlow}
                onChange={(e) => setBloodFlow(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-300 block">Albumin Flow (mL/min)</label>
              <input
                type="number"
                value={albuminFlow}
                onChange={(e) => setAlbuminFlow(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-300 block">Initial Bilirubin</label>
              <input
                type="number"
                step="0.1"
                value={bilirubin}
                onChange={(e) => setBilirubin(parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-300 block">Post-MARS Bilirubin</label>
              <input
                type="number"
                step="0.1"
                value={finalBilirubin}
                onChange={(e) => setFinalBilirubin(parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-300 block">Initial NH3 (µmol/L)</label>
              <input
                type="number"
                value={ammonia}
                onChange={(e) => setAmmonia(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-300 block">Post-MARS NH3</label>
              <input
                type="number"
                value={finalAmmonia}
                onChange={(e) => setFinalAmmonia(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-white"
              />
            </div>
          </div>
        </div>

        {/* Neuroprotection & Cerebral Watchdog */}
        <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700/80 space-y-3">
          <h3 className="text-sm font-semibold text-rose-400 uppercase tracking-wider">Cerebral Edema & ICP Targets</h3>
          
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Current NH3 Level:</span>
              <span className={`font-bold ${ammonia >= 150 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {ammonia} µmol/L
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Encephalopathy Tier:</span>
              <span className="font-semibold text-amber-300">{heGrade.replace('_', ' ')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Target MAP:</span>
              <span className="font-semibold text-white">&gt; 75 mmHg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Target CPP:</span>
              <span className="font-semibold text-white">60 - 80 mmHg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Serum Na+ Target:</span>
              <span className="font-semibold text-cyan-300">145 - 150 mEq/L (Hypertonic 3%)</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={evaluateKingsCriteria}
              className="flex-1 py-1.5 bg-amber-900/60 hover:bg-amber-800 border border-amber-600/50 text-amber-200 text-xs font-medium rounded"
            >
              King's Criteria
            </button>
            <button
              onClick={evaluateMars}
              className="flex-1 py-1.5 bg-blue-900/60 hover:bg-blue-800 border border-blue-600/50 text-blue-200 text-xs font-medium rounded"
            >
              MARS Clearance
            </button>
            <button
              onClick={evaluateCerebralEdema}
              className="flex-1 py-1.5 bg-rose-900/60 hover:bg-rose-800 border border-rose-600/50 text-rose-200 text-xs font-medium rounded"
            >
              ICP Risk
            </button>
          </div>
        </div>
      </div>

      {/* Analytics & Decision Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* King's College Card */}
        {kingsResult && (
          <div className={`p-4 rounded-lg border ${kingsResult.criteria_met ? 'bg-rose-950/40 border-rose-600/60' : 'bg-emerald-950/30 border-emerald-600/40'} space-y-3`}>
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-white">King's College Evaluation</h4>
              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${kingsResult.criteria_met ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>
                {kingsResult.criteria_met ? 'TRANSPLANT CRITERIA MET' : 'CRITERIA NOT MET'}
              </span>
            </div>

            <div className="text-xs space-y-1">
              <p className="text-slate-300">{kingsResult.recommendation}</p>
              {kingsResult.criteria_triggers.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-700/60">
                  <span className="font-semibold text-rose-300">Triggers detected:</span>
                  <ul className="list-disc list-inside mt-1 space-y-0.5 text-slate-300">
                    {kingsResult.criteria_triggers.map((t, idx) => (
                      <li key={idx}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MARS Clearance Card */}
        {marsResult && (
          <div className="p-4 bg-slate-800/80 rounded-lg border border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-white">Albumin Dialysis Kinetics</h4>
              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${marsResult.target_clearance_achieved ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'}`}>
                {marsResult.target_clearance_achieved ? 'TARGET ACHIEVED' : 'SUBOPTIMAL'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2 bg-slate-900 rounded border border-slate-800">
                <div className="text-xs text-slate-400">Bilirubin Clearance</div>
                <div className="text-lg font-bold text-amber-400">{marsResult.bilirubin_clearance_percent}%</div>
                <div className="text-[10px] text-slate-500">Target &ge; 25%</div>
              </div>
              <div className="p-2 bg-slate-900 rounded border border-slate-800">
                <div className="text-xs text-slate-400">Ammonia Clearance</div>
                <div className="text-lg font-bold text-cyan-400">{marsResult.ammonia_clearance_percent}%</div>
                <div className="text-[10px] text-slate-500">Target &ge; 30%</div>
              </div>
            </div>

            <div className="text-xs text-slate-300 space-y-1">
              {marsResult.clinical_recommendations.map((rec, idx) => (
                <p key={idx} className="text-slate-300">&bull; {rec}</p>
              ))}
            </div>
          </div>
        )}

        {/* Cerebral Edema Risk Card */}
        {cerebralResult && (
          <div className="p-4 bg-slate-800/80 rounded-lg border border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-white">Intracranial Pressure Risk</h4>
              <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                cerebralResult.icp_elevation_risk === 'critical' ? 'bg-red-600 text-white animate-pulse' :
                cerebralResult.icp_elevation_risk === 'high' ? 'bg-orange-600 text-white' :
                cerebralResult.icp_elevation_risk === 'moderate' ? 'bg-yellow-600 text-slate-900' :
                'bg-emerald-600 text-white'
              }`}>
                {cerebralResult.icp_elevation_risk} RISK
              </span>
            </div>

            <div className="text-xs space-y-1">
              <div className="flex justify-between py-1 border-b border-slate-700/60">
                <span className="text-slate-400">ICP Monitor Indicated:</span>
                <span className="font-semibold text-white">{cerebralResult.icp_monitoring_indicated ? 'YES' : 'NO'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-700/60">
                <span className="text-slate-400">Hyperosmolar Therapy:</span>
                <span className="font-semibold text-white">{cerebralResult.hyperosmolar_therapy_indicated ? 'STAT' : 'STANDBY'}</span>
              </div>
            </div>

            <div className="text-xs space-y-1 text-slate-300">
              <div className="font-semibold text-rose-300">Protocol Actions:</div>
              {cerebralResult.interventions.map((action, idx) => (
                <p key={idx} className="text-slate-300 text-[11px]">&bull; {action}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
