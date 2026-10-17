import React, { useState, useEffect } from 'react';

interface RutherfordResult {
  category: 'I' | 'IIa' | 'IIb' | 'III';
  category_name: string;
  limb_viability: 'VIABLE' | 'MARGINALLY_THREATENED' | 'IMMEDIATELY_THREATENED' | 'IRREVERSIBLE';
  urgency: string;
  recommended_intervention: string;
  thrombolysis_eligible: boolean;
  contraindications: string[];
  clinical_pearls: string[];
}

interface CompartmentResult {
  compartment_name: string;
  measured_pressure_mmhg: number;
  diastolic_bp_mmhg: number;
  delta_p_mmhg: number;
  fasciotomy_indicated: boolean;
  alert_level: 'NORMAL' | 'BORDERLINE_OBSERVE' | 'CRITICAL_FASCIOTOMY_REQUIRED';
  surgical_directive: string;
  rehabilitation_and_rhabdo_prevention: string[];
}

interface FlapResult {
  perfusion_status: 'HEALTHY' | 'ARTERIAL_OCCLUSION' | 'VENOUS_CONGESTION' | 'INDETERMINATE_OBSERVE';
  salvage_urgency: string;
  clinical_diagnosis: string;
  actions: string[];
}

export const VascularLimbHub: React.FC = () => {
  const [patientId] = useState<number>(1);
  const [activeSection, setActiveSection] = useState<'rutherford' | 'compartment' | 'free_flap'>('rutherford');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Rutherford inputs
  const [limbAffected, setLimbAffected] = useState<string>('Right Lower Extremity');
  const [sensoryLoss, setSensoryLoss] = useState<'none' | 'minimal_toes' | 'rest_pain_forefoot' | 'profound_anesthetic'>('rest_pain_forefoot');
  const [motorDeficit, setMotorDeficit] = useState<'none' | 'mild_toe_weakness' | 'paralysis_rigor'>('mild_toe_weakness');
  const [arterialDoppler, setArterialDoppler] = useState<boolean>(false);
  const [venousDoppler, setVenousDoppler] = useState<boolean>(true);
  const [activeBleeding, setActiveBleeding] = useState<boolean>(false);
  const [cvaTrauma, setCvaTrauma] = useState<boolean>(false);
  const [systolicBp, setSystolicBp] = useState<number>(140);
  const [rutherfordResult, setRutherfordResult] = useState<RutherfordResult | null>(null);

  // Compartment pressure inputs
  const [compartmentName, setCompartmentName] = useState<'anterior' | 'lateral' | 'superficial_posterior' | 'deep_posterior' | 'volar' | 'dorsal'>('anterior');
  const [measuredPressure, setMeasuredPressure] = useState<number>(36.0);
  const [diastolicBp, setDiastolicBp] = useState<number>(65.0);
  const [compartmentResult, setCompartmentResult] = useState<CompartmentResult | null>(null);

  // Free-flap inputs
  const [sto2, setSto2] = useState<number>(42);
  const [laserFlux, setLaserFlux] = useState<number>(2.4);
  const [flapColor, setFlapColor] = useState<'pink' | 'pale' | 'cyanotic_mottled' | 'violaceous_purple'>('violaceous_purple');
  const [capRefill, setCapRefill] = useState<number>(0.8);
  const [tempDiff, setTempDiff] = useState<number>(-1.2);
  const [pinprickBleeding, setPinprickBleeding] = useState<'normal_bright_red' | 'absent_no_bleeding' | 'brisk_dark_purple'>('brisk_dark_purple');
  const [flapResult, setFlapResult] = useState<FlapResult | null>(null);

  // History state
  const [history, setHistory] = useState<any>({ encounters: [], compartment_logs: [] });

  const fetchHistory = async () => {
    try {
      const res = await fetch(`/api/clinician/vascular-limb/patients/${patientId}/history`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err: any) {
      console.error('Fetch vascular history error:', err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [patientId]);

  // Evaluate Rutherford
  const handleEvaluateRutherford = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/vascular-limb/evaluate-rutherford', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          limb_affected: limbAffected,
          sensory_loss: sensoryLoss,
          motor_deficit: motorDeficit,
          arterial_doppler_audible: arterialDoppler,
          venous_doppler_audible: venousDoppler,
          active_bleeding_within_10_days: activeBleeding,
          cva_or_head_trauma_within_3_months: cvaTrauma,
          systolic_bp: systolicBp
        })
      });
      if (res.ok) {
        const data = await res.json();
        setRutherfordResult(data);
        setStatusMessage(`Evaluated Rutherford: ${data.category_name}`);
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Save Rutherford Encounter to DB
  const handleSaveEncounter = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/vascular-limb/encounters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          limb_affected: limbAffected,
          sensory_loss: sensoryLoss,
          motor_deficit: motorDeficit,
          arterial_doppler_audible: arterialDoppler,
          venous_doppler_audible: venousDoppler,
          active_bleeding_within_10_days: activeBleeding,
          cva_or_head_trauma_within_3_months: cvaTrauma,
          systolic_bp: systolicBp
        })
      });
      if (res.ok) {
        const data = await res.json();
        setRutherfordResult(data.evaluation);
        setStatusMessage('Vascular limb encounter recorded successfully.');
        fetchHistory();
      }
    } catch (err: any) {
      setStatusMessage(`Error saving encounter: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Evaluate Compartment Pressure
  const handleEvaluateCompartment = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/vascular-limb/evaluate-compartment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compartment_name: compartmentName,
          measured_pressure_mmhg: measuredPressure,
          diastolic_bp_mmhg: diastolicBp
        })
      });
      if (res.ok) {
        const data = await res.json();
        setCompartmentResult(data);
        setStatusMessage(`Compartment evaluated: Delta-P = ${data.delta_p_mmhg} mmHg`);
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Evaluate Free Flap
  const handleEvaluateFlap = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/vascular-limb/evaluate-free-flap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sto2_percent: sto2,
          laser_doppler_flux_pu: laserFlux,
          flap_color: flapColor,
          capillary_refill_seconds: capRefill,
          temp_difference_celsius: tempDiff,
          pinprick_bleeding: pinprickBleeding
        })
      });
      if (res.ok) {
        const data = await res.json();
        setFlapResult(data);
        setStatusMessage(`Free flap evaluated: ${data.perfusion_status}`);
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Delta-P Calculation
  const currentDeltaP = Math.round((diastolicBp - measuredPressure) * 10) / 10;

  return (
    <div className="bg-slate-900 text-slate-100 p-6 rounded-xl border border-slate-800 space-y-6 shadow-2xl">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded">
              Vascular & Microvascular Surgery
            </span>
            <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-red-500/20 text-red-300 border border-red-500/40 rounded">
              Phase 72
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white mt-1">
            VASCULAR-LIMB Command: Acute Limb Ischemia & Compartment Hub
          </h2>
          <p className="text-xs text-slate-400">
            Rutherford ALI Revascularization, Compartment Delta-P Fasciotomy, & Free-Flap NIRS Salvage
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSection('rutherford')}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition ${
              activeSection === 'rutherford'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            Rutherford ALI
          </button>
          <button
            onClick={() => setActiveSection('compartment')}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition ${
              activeSection === 'compartment'
                ? 'bg-red-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            Compartment Delta-P
          </button>
          <button
            onClick={() => setActiveSection('free_flap')}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition ${
              activeSection === 'free_flap'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            Free-Flap Salvage
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="px-4 py-2 bg-slate-800/80 border border-amber-500/30 text-amber-300 text-xs rounded flex items-center justify-between">
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage('')} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Section 1: Rutherford Acute Limb Ischemia */}
      {activeSection === 'rutherford' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Inputs */}
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/80 space-y-3 text-xs">
            <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">
              ALI Presentation Parameters
            </h3>

            <div>
              <label className="text-slate-300 block mb-1">Affected Limb</label>
              <input
                type="text"
                value={limbAffected}
                onChange={(e) => setLimbAffected(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
              />
            </div>

            <div>
              <label className="text-slate-300 block mb-1">Sensory Examination</label>
              <select
                value={sensoryLoss}
                onChange={(e) => setSensoryLoss(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
              >
                <option value="none">None (Intact Sensation)</option>
                <option value="minimal_toes">Minimal (Toes numbness only)</option>
                <option value="rest_pain_forefoot">Rest Pain &gt; Toes (Forefoot/Glove)</option>
                <option value="profound_anesthetic">Profound Anesthetic / Numb</option>
              </select>
            </div>

            <div>
              <label className="text-slate-300 block mb-1">Motor Examination</label>
              <select
                value={motorDeficit}
                onChange={(e) => setMotorDeficit(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
              >
                <option value="none">None (Normal Intact Strength)</option>
                <option value="mild_toe_weakness">Mild/Moderate (Toe flexion weakness)</option>
                <option value="paralysis_rigor">Paralysis / Muscle Rigor / Foot Drop</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={arterialDoppler}
                  onChange={(e) => setArterialDoppler(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-amber-500"
                />
                <span>Arterial Doppler Audible</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={venousDoppler}
                  onChange={(e) => setVenousDoppler(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-amber-500"
                />
                <span>Venous Doppler Audible</span>
              </label>
            </div>

            <div className="border-t border-slate-700/60 pt-2 space-y-2">
              <span className="font-semibold text-slate-300 block">Thrombolysis Bleeding Risks:</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeBleeding}
                  onChange={(e) => setActiveBleeding(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-red-500"
                />
                <span>Internal bleed within 10 days</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cvaTrauma}
                  onChange={(e) => setCvaTrauma(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-red-500"
                />
                <span>CVA or head trauma within 3 months</span>
              </label>
              <div>
                <label className="text-slate-400 block text-[11px]">Systolic BP (mmHg)</label>
                <input
                  type="number"
                  value={systolicBp}
                  onChange={(e) => setSystolicBp(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={handleEvaluateRutherford}
                disabled={isLoading}
                className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded transition"
              >
                Evaluate
              </button>
              <button
                onClick={handleSaveEncounter}
                disabled={isLoading}
                className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded shadow transition"
              >
                Record Encounter
              </button>
            </div>
          </div>

          {/* Results Display */}
          <div className="lg:col-span-2 space-y-4">
            {rutherfordResult ? (
              <div className="space-y-4">
                <div className="bg-slate-800/70 p-4 rounded-lg border border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs uppercase text-slate-400 font-medium">Classification</span>
                      <h4 className="text-lg font-bold text-white">{rutherfordResult.category_name}</h4>
                    </div>
                    <span className={`px-3 py-1 rounded text-xs font-bold border ${
                      rutherfordResult.category === 'IIb'
                        ? 'bg-red-500/20 text-red-400 border-red-500/50 animate-pulse'
                        : rutherfordResult.category === 'III'
                          ? 'bg-slate-700 text-slate-300 border-slate-600'
                          : 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                    }`}>
                      {rutherfordResult.urgency}
                    </span>
                  </div>

                  <div className="bg-slate-900/80 p-3 rounded border border-slate-800">
                    <span className="text-[11px] uppercase text-amber-400 font-bold block mb-1">
                      Recommended Surgical / Interventional Pathway
                    </span>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      {rutherfordResult.recommended_intervention}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">Thrombolysis (CDT) Status:</span>
                      <span className={`font-bold ${rutherfordResult.thrombolysis_eligible ? 'text-emerald-400' : 'text-red-400'}`}>
                        {rutherfordResult.thrombolysis_eligible ? 'ELIGIBLE (CDT tPA)' : 'CONTRAINDICATED / BYPASS'}
                      </span>
                      {rutherfordResult.contraindications.length > 0 && (
                        <ul className="text-[10px] text-red-300 mt-1 list-disc list-inside">
                          {rutherfordResult.contraindications.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">Limb Viability:</span>
                      <span className="font-bold text-white">{rutherfordResult.limb_viability}</span>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-1">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase">
                      Clinical Pearls & Immediate Directives:
                    </span>
                    <ul className="text-xs text-slate-300 space-y-1">
                      {rutherfordResult.clinical_pearls.map((p, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-amber-400">&bull;</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-800/30 border border-slate-800 rounded-lg p-8 text-center text-slate-400 text-xs">
                Select sensory, motor, and Doppler findings, then click <strong>Evaluate</strong> to calculate Rutherford classification.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section 2: Compartment Syndrome Delta-P */}
      {activeSection === 'compartment' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/80 space-y-3 text-xs">
            <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider">
              Compartment Pressure Input
            </h3>

            <div>
              <label className="text-slate-300 block mb-1">Target Compartment</label>
              <select
                value={compartmentName}
                onChange={(e) => setCompartmentName(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
              >
                <option value="anterior">Anterior Compartment (Leg)</option>
                <option value="lateral">Lateral Compartment (Leg)</option>
                <option value="superficial_posterior">Superficial Posterior (Calf)</option>
                <option value="deep_posterior">Deep Posterior (Calf)</option>
                <option value="volar">Volar Compartment (Forearm)</option>
                <option value="dorsal">Dorsal Compartment (Forearm)</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Measured Needle Pressure</span>
                <span className="font-mono text-amber-400">{measuredPressure} mmHg</span>
              </div>
              <input
                type="range"
                min="5"
                max="80"
                step="0.5"
                value={measuredPressure}
                onChange={(e) => setMeasuredPressure(parseFloat(e.target.value))}
                className="w-full accent-amber-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Diastolic Blood Pressure</span>
                <span className="font-mono text-teal-400">{diastolicBp} mmHg</span>
              </div>
              <input
                type="range"
                min="40"
                max="120"
                step="1"
                value={diastolicBp}
                onChange={(e) => setDiastolicBp(parseFloat(e.target.value))}
                className="w-full accent-teal-500"
              />
            </div>

            <div className="bg-slate-950 p-3 rounded border border-slate-800 text-center">
              <span className="text-[11px] text-slate-400 uppercase block">Perfusion Gradient (&Delta;P)</span>
              <span className={`text-2xl font-black ${
                currentDeltaP <= 30 ? 'text-red-400' : 'text-emerald-400'
              }`}>
                {currentDeltaP} mmHg
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                Threshold: &le; 30 mmHg indicates critical ischemia
              </span>
            </div>

            <button
              onClick={handleEvaluateCompartment}
              disabled={isLoading}
              className="w-full py-2 bg-red-600 hover:bg-red-500 text-white font-semibold rounded shadow transition"
            >
              Evaluate Fasciotomy Threshold
            </button>
          </div>

          {/* Results */}
          <div className="lg:col-span-2 space-y-4">
            {compartmentResult ? (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg border ${
                  compartmentResult.fasciotomy_indicated
                    ? 'bg-red-950/40 border-red-500/60'
                    : 'bg-slate-800/60 border-slate-700'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
                      Surgical Assessment
                    </span>
                    <span className={`px-2.5 py-1 text-xs font-bold rounded border ${
                      compartmentResult.fasciotomy_indicated
                        ? 'bg-red-500/30 text-red-300 border-red-500'
                        : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                    }`}>
                      {compartmentResult.alert_level}
                    </span>
                  </div>

                  <p className="text-xs text-white leading-relaxed font-medium">
                    {compartmentResult.surgical_directive}
                  </p>
                </div>

                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2 text-xs">
                  <h4 className="font-semibold text-amber-400 uppercase tracking-wider text-[11px]">
                    Rhabdomyolysis & Reperfusion Injury Protocol
                  </h4>
                  <ul className="space-y-1.5 text-slate-300">
                    {compartmentResult.rehabilitation_and_rhabdo_prevention.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 bg-slate-900 p-2 rounded border border-slate-800">
                        <span className="text-amber-400 font-bold">#{idx + 1}</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="bg-slate-800/30 border border-slate-800 rounded-lg p-8 text-center text-slate-400 text-xs">
                Adjust measured intracompartmental pressure and diastolic BP to evaluate Delta-P.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section 3: Microvascular Free-Flap Perfusion */}
      {activeSection === 'free_flap' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/80 space-y-3 text-xs">
            <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider">
              Free-Flap Perfusion Telemetry
            </h3>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Tissue O2 Saturation (StO2)</span>
                <span className="font-mono text-purple-400">{sto2}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="95"
                step="1"
                value={sto2}
                onChange={(e) => setSto2(parseInt(e.target.value, 10))}
                className="w-full accent-purple-500"
              />
              <span className="text-[10px] text-slate-500">NIRS probe reading (&lt;50% critical)</span>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Laser Doppler Flux</span>
                <span className="font-mono text-purple-400">{laserFlux} PU</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="15.0"
                step="0.1"
                value={laserFlux}
                onChange={(e) => setLaserFlux(parseFloat(e.target.value))}
                className="w-full accent-purple-500"
              />
            </div>

            <div>
              <label className="text-slate-300 block mb-1">Flap Color</label>
              <select
                value={flapColor}
                onChange={(e) => setFlapColor(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
              >
                <option value="pink">Crisp Pink (Normal)</option>
                <option value="pale">Pale / Ghost White (Arterial Inflow Deficit)</option>
                <option value="violaceous_purple">Violaceous / Dark Purple (Venous Congestion)</option>
                <option value="cyanotic_mottled">Cyanotic / Mottled</option>
              </select>
            </div>

            <div>
              <label className="text-slate-300 block mb-1">Pinprick Bleeding Test</label>
              <select
                value={pinprickBleeding}
                onChange={(e) => setPinprickBleeding(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
              >
                <option value="normal_bright_red">Normal Bright Red Bleeding (3-5s)</option>
                <option value="absent_no_bleeding">Absent Bleeding (No reflow / Dry)</option>
                <option value="brisk_dark_purple">Brisk Dark Purple Rapid Bleeding</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-300 block mb-1">Cap Refill (sec)</label>
                <input
                  type="number"
                  step="0.2"
                  value={capRefill}
                  onChange={(e) => setCapRefill(parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-slate-300 block mb-1">&Delta;T vs Control (&deg;C)</label>
                <input
                  type="number"
                  step="0.5"
                  value={tempDiff}
                  onChange={(e) => setTempDiff(parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                />
              </div>
            </div>

            <button
              onClick={handleEvaluateFlap}
              disabled={isLoading}
              className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded shadow transition"
            >
              Analyze Flap Viability
            </button>
          </div>

          {/* Results */}
          <div className="lg:col-span-2 space-y-4">
            {flapResult ? (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg border ${
                  flapResult.perfusion_status === 'HEALTHY'
                    ? 'bg-emerald-950/30 border-emerald-500/50'
                    : flapResult.perfusion_status === 'ARTERIAL_OCCLUSION'
                      ? 'bg-red-950/40 border-red-500/70'
                      : 'bg-purple-950/40 border-purple-500/70'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
                      Perfusion Diagnosis
                    </span>
                    <span className={`px-2.5 py-1 text-xs font-bold rounded border ${
                      flapResult.perfusion_status === 'HEALTHY'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                        : 'bg-red-500/20 text-red-400 border-red-500/50 animate-pulse'
                    }`}>
                      {flapResult.salvage_urgency}
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-white mb-1">
                    {flapResult.clinical_diagnosis}
                  </h4>
                </div>

                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2 text-xs">
                  <h4 className="font-semibold text-purple-400 uppercase tracking-wider text-[11px]">
                    Flap Salvage Action Plan
                  </h4>
                  <ul className="space-y-1.5 text-slate-300">
                    {flapResult.actions.map((act, idx) => (
                      <li key={idx} className="flex items-start gap-2 bg-slate-900 p-2 rounded border border-slate-800">
                        <span className="text-purple-400 font-bold">#{idx + 1}</span>
                        <span>{act}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="bg-slate-800/30 border border-slate-800 rounded-lg p-8 text-center text-slate-400 text-xs">
                Set tissue oxygen saturation (StO2), Doppler flux, and clinical signs to evaluate free-flap viability.
              </div>
            )}
          </div>
        </div>
      )}

      {/* History table */}
      {history.encounters && history.encounters.length > 0 && (
        <div className="space-y-2 pt-4 border-t border-slate-800 text-xs">
          <h4 className="font-semibold text-slate-400 uppercase tracking-wider">
            Patient Vascular & Compartment History
          </h4>
          <div className="overflow-x-auto rounded border border-slate-800">
            <table className="w-full text-left">
              <thead className="bg-slate-950 text-slate-500 text-[11px]">
                <tr>
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Limb</th>
                  <th className="py-2 px-3 text-center">Rutherford</th>
                  <th className="py-2 px-3 text-center">Motor / Sensory</th>
                  <th className="py-2 px-3">Intervention</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/40 text-slate-300">
                {history.encounters.map((e: any) => (
                  <tr key={e.id}>
                    <td className="py-2 px-3 text-slate-500 font-mono text-[10px]">
                      {new Date(e.created_at).toLocaleTimeString()}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-200">{e.limb_affected}</td>
                    <td className="py-2 px-3 text-center font-bold text-amber-400">{e.rutherford_category}</td>
                    <td className="py-2 px-3 text-center text-slate-400 text-[11px]">
                      {e.motor_deficit} / {e.sensory_loss}
                    </td>
                    <td className="py-2 px-3 text-slate-300 truncate max-w-xs">{e.recommended_intervention}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
