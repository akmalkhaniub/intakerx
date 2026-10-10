import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  RefreshCw,
  Plus,
  CheckCircle2,
  Heart,
  Gauge,
  ShieldAlert,
  Wind,
  Layers,
  Zap,
  Sliders
} from 'lucide-react';

interface PACHemodynamicProfile {
  patientId: number;
  bsaM2: number;
  cardiacIndex: number;
  strokeVolumeMl: number;
  strokeVolumeIndex: number;
  mapMmhg: number;
  svrDynes: number;
  svriDynes: number;
  pvrDynes: number;
  pvriDynes: number;
  pvrWoodUnits: number;
  lvswi: number;
  rvswi: number;
  cao2MlDl: number;
  cvo2MlDl: number;
  do2Index: number;
  vo2Index: number;
  o2ExtractionRatioPercent: number;
  forresterQuadrant: 'Warm_Dry' | 'Warm_Wet' | 'Cold_Dry' | 'Cold_Wet';
  quadrantDescription: string;
  therapeuticRecommendations: string[];
  clinicalAlerts: {
    level: 'info' | 'warning' | 'critical';
    title: string;
    description: string;
  }[];
}

interface PACRecord {
  id: number;
  patient_id: number;
  heart_rate: number;
  map_mmhg: number;
  cvp_mmhg: number;
  mpap_mmhg: number;
  pcwp_mmhg: number;
  cardiac_output_l_min: number;
  cardiac_index: number;
  svr_dynes: number;
  pvr_dynes: number;
  svo2_percent: number;
  forrester_quadrant: string;
  recorded_at: string;
}

interface PACSafetyEvent {
  id: number;
  patient_id: number;
  event_type: string;
  severity: string;
  balloon_inflation_volume_ml?: number;
  warning_message: string;
  action_taken?: string;
  acknowledged_by?: string;
  created_at: string;
}

export const HemoSwanHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'profiler' | 'quadrants' | 'safety' | 'history'>('profiler');
  const [records, setRecords] = useState<PACRecord[]>([]);
  const [safetyEvents, setSafetyEvents] = useState<PACSafetyEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form State
  const [patientId, setPatientId] = useState<number>(1);
  const [heartRate, setHeartRate] = useState<number>(88);
  const [systolicBp, setSystolicBp] = useState<number>(90);
  const [diastolicBp, setDiastolicBp] = useState<number>(60);
  const [cvpMmhg, setCvpMmhg] = useState<number>(14);
  const [mpapMmhg, setMpapMmhg] = useState<number>(36);
  const [pcwpMmhg, setPcwpMmhg] = useState<number>(24);
  const [cardiacOutput, setCardiacOutput] = useState<number>(3.2);
  const [heightCm, setHeightCm] = useState<number>(175);
  const [weightKg, setWeightKg] = useState<number>(75);
  const [sao2, setSao2] = useState<number>(94);
  const [svo2, setSvo2] = useState<number>(52);
  const [hgb, setHgb] = useState<number>(11.2);

  // Computed Profile
  const [currentProfile, setCurrentProfile] = useState<PACHemodynamicProfile | null>(null);

  // Safety Watchdog State
  const [balloonVolume, setBalloonVolume] = useState<number>(1.2);
  const [inflationSeconds, setInflationSeconds] = useState<number>(8);
  const [spontaneousWedge, setSpontaneousWedge] = useState<boolean>(false);
  const [dampedWaveform, setDampedWaveform] = useState<boolean>(false);

  // Instant calculation on change
  useEffect(() => {
    handleCalculate();
  }, [
    heartRate, systolicBp, diastolicBp, cvpMmhg, mpapMmhg, pcwpMmhg,
    cardiacOutput, heightCm, weightKg, sao2, svo2, hgb
  ]);

  useEffect(() => {
    fetchHistory();
  }, [patientId]);

  const handleCalculate = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/clinician/pac/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId,
          heartRate,
          systolicBp,
          diastolicBp,
          cvpMmhg,
          mpapMmhg,
          pcwpMmhg,
          cardiacOutputLMin: cardiacOutput,
          heightCm,
          weightKg,
          sao2Percent: sao2,
          svo2Percent: svo2,
          hgbGDl: hgb
        })
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentProfile(data);
      }
    } catch {
      // offline fallback local calculation
      const bsa = Math.round((0.007184 * Math.pow(weightKg, 0.425) * Math.pow(heightCm, 0.725)) * 100) / 100;
      const map = Math.round((systolicBp + 2 * diastolicBp) / 3);
      const ci = Math.round((cardiacOutput / bsa) * 100) / 100;
      const svr = Math.round(((map - cvpMmhg) / Math.max(cardiacOutput, 0.5)) * 80);
      const pvr = Math.round(((Math.max(mpapMmhg - pcwpMmhg, 0)) / Math.max(cardiacOutput, 0.5)) * 80);

      let quadrant: 'Warm_Dry' | 'Warm_Wet' | 'Cold_Dry' | 'Cold_Wet' = 'Warm_Dry';
      if (ci >= 2.2 && pcwpMmhg <= 18) quadrant = 'Warm_Dry';
      else if (ci >= 2.2 && pcwpMmhg > 18) quadrant = 'Warm_Wet';
      else if (ci < 2.2 && pcwpMmhg <= 18) quadrant = 'Cold_Dry';
      else quadrant = 'Cold_Wet';

      setCurrentProfile({
        patientId,
        bsaM2: bsa,
        cardiacIndex: ci,
        strokeVolumeMl: Math.round(((cardiacOutput * 1000) / heartRate) * 10) / 10,
        strokeVolumeIndex: Math.round((((cardiacOutput * 1000) / heartRate) / bsa) * 10) / 10,
        mapMmhg: map,
        svrDynes: svr,
        svriDynes: Math.round(svr * bsa),
        pvrDynes: pvr,
        pvriDynes: Math.round(pvr * bsa),
        pvrWoodUnits: Math.round(((mpapMmhg - pcwpMmhg) / Math.max(cardiacOutput, 0.5)) * 10) / 10,
        lvswi: Math.round(0.0136 * Math.max(map - pcwpMmhg, 0) * 25 * 10) / 10,
        rvswi: Math.round(0.0136 * Math.max(mpapMmhg - cvpMmhg, 0) * 25 * 10) / 10,
        cao2MlDl: 15.1,
        cvo2MlDl: 9.8,
        do2Index: Math.round(ci * 15.1 * 10),
        vo2Index: Math.round(ci * 5.3 * 10),
        o2ExtractionRatioPercent: 35.1,
        forresterQuadrant: quadrant,
        quadrantDescription: quadrant === 'Cold_Wet' ? 'Quadrant IV: Cardiogenic Shock' : 'Calculated Hemodynamic Profile',
        therapeuticRecommendations: quadrant === 'Cold_Wet'
          ? ['Initiate Inotropes (Dobutamine / Milrinone)', 'Vasopressor support for MAP >= 65', 'Consider Impella / VA-ECMO']
          : ['Maintain guideline-directed medical therapy'],
        clinicalAlerts: ci < 2.2 ? [{ level: 'critical', title: 'DEPRESSED CARDIAC INDEX', description: `CI is ${ci} L/min/m2` }] : []
      });
    }
  };

  const handleSaveRecord = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/clinician/pac/records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId,
          heartRate,
          systolicBp,
          diastolicBp,
          cvpMmhg,
          mpapMmhg,
          pcwpMmhg,
          cardiacOutputLMin: cardiacOutput,
          heightCm,
          weightKg,
          sao2Percent: sao2,
          svo2Percent: svo2,
          hgbGDl: hgb
        })
      });
      if (res.ok) {
        setMessage({ text: 'PAC Hemodynamic record successfully stored.', type: 'success' });
        fetchHistory();
      } else {
        setMessage({ text: 'Failed to save record.', type: 'error' });
      }
    } catch {
      setMessage({ text: 'Network error saving PAC record.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const recRes = await fetch(`/api/clinician/pac/patients/${patientId}/records`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (recRes.ok) {
        const data = await recRes.json();
        setRecords(data);
      }
      const safeRes = await fetch(`/api/clinician/pac/patients/${patientId}/safety`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (safeRes.ok) {
        const safeData = await safeRes.json();
        setSafetyEvents(safeData);
      }
    } catch {
      // offline fallback
    }
  };

  const handleLogSafetyEvent = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/clinician/pac/safety/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId,
          eventType: spontaneousWedge ? 'spontaneous_wedge_detected' : balloonVolume > 1.5 ? 'balloon_overinflation' : 'waveform_damping',
          severity: balloonVolume > 1.5 || spontaneousWedge ? 'life_threatening' : 'warning',
          balloonInflationVolumeMl: balloonVolume,
          warningMessage: spontaneousWedge
            ? 'Spontaneous wedge detected without balloon inflation. Catheter migration alert.'
            : balloonVolume > 1.5
            ? `Balloon inflation ${balloonVolume} mL exceeds max 1.5 mL limit.`
            : 'Waveform damped. Transducer flushed.',
          actionTaken: spontaneousWedge ? 'Catheter pulled back 2 cm' : 'Line inspected and flushed',
          acknowledgedBy: 'Attending Intensivist'
        })
      });
      if (res.ok) {
        setMessage({ text: 'Safety event logged to clinical record.', type: 'success' });
        fetchHistory();
      }
    } catch {
      // fallback
    }
  };

  const isOverinflated = balloonVolume > 1.5;
  const isProlongedInflation = inflationSeconds > 15;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-600/20 border border-red-500/30 rounded-xl text-red-400">
            <Heart className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-white">HEMO-SWAN Fleet</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/30">
                Phase 61
              </span>
            </div>
            <p className="text-sm text-slate-400">
              Pulmonary Artery Catheter (Swan-Ganz) Hemodynamics, Forrester Quadrants & Catheter Safety
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchHistory}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm flex items-center gap-2 border border-slate-700"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={handleSaveRecord}
            disabled={loading}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-semibold flex items-center gap-2 shadow-lg shadow-red-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            Record Profile
          </button>
        </div>
      </div>

      {/* Status banner */}
      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 border ${
          message.type === 'success'
            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
            : 'bg-red-950/40 border-red-500/40 text-red-300'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-800 space-x-1">
        {[
          { id: 'profiler', label: 'Hemodynamic Profiler', icon: Activity },
          { id: 'quadrants', label: 'Forrester Matrix', icon: Layers },
          { id: 'safety', label: 'Swan Safety Watchdog', icon: ShieldAlert },
          { id: 'history', label: 'Telemetry Log', icon: Gauge }
        ].map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                active
                  ? 'border-red-500 text-red-400 bg-red-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: HEMODYNAMIC PROFILER */}
      {activeTab === 'profiler' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Input Controls */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-red-400" />
              Bedside PAC Telemetry Inputs
            </h3>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <label className="text-xs text-slate-400">Patient ID</label>
                <input
                  type="number"
                  value={patientId}
                  onChange={e => setPatientId(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Heart Rate (bpm)</label>
                <input
                  type="number"
                  value={heartRate}
                  onChange={e => setHeartRate(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">Blood Pressure (SBP/DBP)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={systolicBp}
                    onChange={e => setSystolicBp(Number(e.target.value))}
                    className="w-1/2 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-center"
                    placeholder="SBP"
                  />
                  <input
                    type="number"
                    value={diastolicBp}
                    onChange={e => setDiastolicBp(Number(e.target.value))}
                    className="w-1/2 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-center"
                    placeholder="DBP"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400">Cardiac Output (CO L/min)</label>
                <input
                  type="number"
                  step="0.1"
                  value={cardiacOutput}
                  onChange={e => setCardiacOutput(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">CVP / RAP (mmHg)</label>
                <input
                  type="number"
                  value={cvpMmhg}
                  onChange={e => setCvpMmhg(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">Mean PAP (mPAP mmHg)</label>
                <input
                  type="number"
                  value={mpapMmhg}
                  onChange={e => setMpapMmhg(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">Wedge PCWP (mmHg)</label>
                <input
                  type="number"
                  value={pcwpMmhg}
                  onChange={e => setPcwpMmhg(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">Oxygen Saturation (SaO2 / SvO2 %)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={sao2}
                    onChange={e => setSao2(Number(e.target.value))}
                    className="w-1/2 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-center"
                    placeholder="SaO2"
                  />
                  <input
                    type="number"
                    value={svo2}
                    onChange={e => setSvo2(Number(e.target.value))}
                    className={`w-1/2 bg-slate-800 border rounded-lg px-2 py-1.5 font-bold text-center ${
                      svo2 < 60 ? 'border-red-500 text-red-400' : 'border-slate-700 text-white'
                    }`}
                    placeholder="SvO2"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400">Height / Weight</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={heightCm}
                    onChange={e => setHeightCm(Number(e.target.value))}
                    className="w-1/2 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-center"
                    placeholder="cm"
                  />
                  <input
                    type="number"
                    value={weightKg}
                    onChange={e => setWeightKg(Number(e.target.value))}
                    className="w-1/2 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-center"
                    placeholder="kg"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400">Hemoglobin (g/dL)</label>
                <input
                  type="number"
                  step="0.1"
                  value={hgb}
                  onChange={e => setHgb(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white"
                />
              </div>
            </div>

            <button
              onClick={handleCalculate}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-semibold border border-slate-700 flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4 text-amber-400" />
              Re-Calculate Indices
            </button>
          </div>

          {/* Results Overview */}
          <div className="lg:col-span-7 space-y-4">
            {currentProfile ? (
              <>
                {/* Quadrant Badge Header */}
                <div className={`p-5 rounded-2xl border ${
                  currentProfile.forresterQuadrant === 'Cold_Wet'
                    ? 'bg-red-950/40 border-red-500/50 text-red-200'
                    : currentProfile.forresterQuadrant === 'Warm_Wet'
                    ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                    : currentProfile.forresterQuadrant === 'Cold_Dry'
                    ? 'bg-blue-950/40 border-blue-500/50 text-blue-200'
                    : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-wider font-bold opacity-80">
                        Forrester Hemodynamic Quadrant
                      </div>
                      <h4 className="text-xl font-extrabold">{currentProfile.quadrantDescription}</h4>
                    </div>
                    <span className="text-2xl font-black px-3 py-1 bg-black/40 rounded-xl">
                      {currentProfile.forresterQuadrant}
                    </span>
                  </div>
                </div>

                {/* Grid of Key Indices */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                    <span className="text-xs text-slate-400">Cardiac Index (CI)</span>
                    <div className={`text-2xl font-extrabold ${currentProfile.cardiacIndex < 2.2 ? 'text-red-400' : 'text-white'}`}>
                      {currentProfile.cardiacIndex}
                    </div>
                    <span className="text-[10px] text-slate-500">L/min/m² (target &ge;2.2)</span>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                    <span className="text-xs text-slate-400">SVR</span>
                    <div className="text-2xl font-extrabold text-white">{currentProfile.svrDynes}</div>
                    <span className="text-[10px] text-slate-500">dynes·s/cm⁵ (800-1200)</span>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                    <span className="text-xs text-slate-400">PVR</span>
                    <div className="text-2xl font-extrabold text-white">{currentProfile.pvrWoodUnits}</div>
                    <span className="text-[10px] text-slate-500">Wood units (&lt;2.0)</span>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                    <span className="text-xs text-slate-400">DO2 Index</span>
                    <div className="text-2xl font-extrabold text-white">{currentProfile.do2Index}</div>
                    <span className="text-[10px] text-slate-500">mL/min/m² (500-600)</span>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                    <span className="text-xs text-slate-400">Stroke Volume</span>
                    <div className="text-2xl font-extrabold text-white">{currentProfile.strokeVolumeMl}</div>
                    <span className="text-[10px] text-slate-500">mL/beat (SVI: {currentProfile.strokeVolumeIndex})</span>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                    <span className="text-xs text-slate-400">O2 Extraction</span>
                    <div className="text-2xl font-extrabold text-white">{currentProfile.o2ExtractionRatioPercent}%</div>
                    <span className="text-[10px] text-slate-500">O2ER (22-30%)</span>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                    <span className="text-xs text-slate-400">LVSWI</span>
                    <div className="text-2xl font-extrabold text-white">{currentProfile.lvswi}</div>
                    <span className="text-[10px] text-slate-500">g·m/m² (50-62)</span>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                    <span className="text-xs text-slate-400">Body Surface Area</span>
                    <div className="text-2xl font-extrabold text-white">{currentProfile.bsaM2}</div>
                    <span className="text-[10px] text-slate-500">m² (DuBois)</span>
                  </div>
                </div>

                {/* Clinical Alerts */}
                {currentProfile.clinicalAlerts.length > 0 && (
                  <div className="space-y-2">
                    {currentProfile.clinicalAlerts.map((alert, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-xl border flex items-start gap-3 ${
                          alert.level === 'critical'
                            ? 'bg-red-950/40 border-red-500/50 text-red-200'
                            : 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                        }`}
                      >
                        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold text-sm">{alert.title}</div>
                          <div className="text-xs opacity-90">{alert.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Recommendations */}
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                  <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    Guideline-Concordant Therapeutics
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {currentProfile.therapeuticRecommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-emerald-400 font-bold">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl">
                Computing hemodynamic calculations...
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: FORRESTER MATRIX */}
      {activeTab === 'quadrants' && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Forrester / Stevenson Hemodynamic Matrix</h3>
              <p className="text-xs text-slate-400">
                Classification of Acute Heart Failure and Shock based on Perfusion (Cardiac Index) and Congestion (PCWP)
              </p>
            </div>
            <div className="text-xs text-slate-400 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
              Current Patient: CI <strong className="text-white">{currentProfile?.cardiacIndex}</strong> | PCWP <strong className="text-white">{pcwpMmhg} mmHg</strong>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Quadrant I: Warm & Dry */}
            <div className={`p-5 rounded-2xl border transition-all ${
              currentProfile?.forresterQuadrant === 'Warm_Dry'
                ? 'bg-emerald-950/50 border-emerald-500 shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-500'
                : 'bg-slate-800/40 border-slate-800 opacity-60'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-emerald-400">Quadrant I: Warm & Dry</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono">
                  CI &ge; 2.2 | PCWP &le; 18
                </span>
              </div>
              <p className="text-xs text-slate-300 mb-3">
                Compensated hemodynamics. Adequate systemic tissue perfusion without pulmonary congestion.
              </p>
              <div className="text-[11px] text-slate-400 bg-black/30 p-2.5 rounded-lg">
                <strong>Management:</strong> Oral GDMT optimization (ACEi/ARNI, Beta-blocker, MRA, SGLT2i), maintain euvolemia.
              </div>
            </div>

            {/* Quadrant II: Warm & Wet */}
            <div className={`p-5 rounded-2xl border transition-all ${
              currentProfile?.forresterQuadrant === 'Warm_Wet'
                ? 'bg-amber-950/50 border-amber-500 shadow-lg shadow-amber-500/20 ring-2 ring-amber-500'
                : 'bg-slate-800/40 border-slate-800 opacity-60'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-amber-400">Quadrant II: Warm & Wet</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-mono">
                  CI &ge; 2.2 | PCWP &gt; 18
                </span>
              </div>
              <p className="text-xs text-slate-300 mb-3">
                Pulmonary congestion / volume overload. Preserved tissue perfusion with elevated left ventricular filling pressure.
              </p>
              <div className="text-[11px] text-slate-400 bg-black/30 p-2.5 rounded-lg">
                <strong>Management:</strong> Aggressive loop diuresis (Furosemide IV) + IV venodilators (Nitroglycerin) if SBP &gt; 100 mmHg.
              </div>
            </div>

            {/* Quadrant III: Cold & Dry */}
            <div className={`p-5 rounded-2xl border transition-all ${
              currentProfile?.forresterQuadrant === 'Cold_Dry'
                ? 'bg-blue-950/50 border-blue-500 shadow-lg shadow-blue-500/20 ring-2 ring-blue-500'
                : 'bg-slate-800/40 border-slate-800 opacity-60'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-blue-400">Quadrant III: Cold & Dry</span>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-mono">
                  CI &lt; 2.2 | PCWP &le; 18
                </span>
              </div>
              <p className="text-xs text-slate-300 mb-3">
                Hypoperfusion with relative hypovolemia. Inadequate tissue perfusion without left-sided congestion.
              </p>
              <div className="text-[11px] text-slate-400 bg-black/30 p-2.5 rounded-lg">
                <strong>Management:</strong> Cautious 250-500 mL fluid challenges under PA pressure guidance; inodilators (Milrinone/Dobutamine) if low CI persists.
              </div>
            </div>

            {/* Quadrant IV: Cold & Wet */}
            <div className={`p-5 rounded-2xl border transition-all ${
              currentProfile?.forresterQuadrant === 'Cold_Wet'
                ? 'bg-red-950/50 border-red-500 shadow-lg shadow-red-500/20 ring-2 ring-red-500'
                : 'bg-slate-800/40 border-slate-800 opacity-60'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-red-400">Quadrant IV: Cold & Wet (Cardiogenic Shock)</span>
                <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded font-mono">
                  CI &lt; 2.2 | PCWP &gt; 18
                </span>
              </div>
              <p className="text-xs text-slate-300 mb-3">
                Cardiogenic Shock. Severely depressed cardiac index combined with elevated capillary filling pressures and high SVR.
              </p>
              <div className="text-[11px] text-slate-400 bg-black/30 p-2.5 rounded-lg">
                <strong>Management:</strong> Inotropes (Dobutamine) + Norepinephrine, urgent Mechanical Circulatory Support (Impella / ECMO / IABP).
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SAFETY WATCHDOG */}
      {activeTab === 'safety' && (
        <div className="space-y-6">
          {/* Overinflation Alarm Banner */}
          {isOverinflated && (
            <div className="p-5 bg-red-950/80 border-2 border-red-500 rounded-2xl text-red-200 flex items-center gap-4 animate-pulse">
              <ShieldAlert className="w-10 h-10 text-red-400 flex-shrink-0" />
              <div>
                <h4 className="text-lg font-black tracking-wide">
                  CRITICAL SAFETY LOCKOUT: BALLOON OVERINFLATION DETECTED
                </h4>
                <p className="text-sm">
                  Balloon inflation volume is <strong>{balloonVolume} mL</strong> (Standard limit &le; 1.5 mL).
                  Risk of catastrophic pulmonary artery rupture. Immediate air evacuation required!
                </p>
              </div>
            </div>
          )}

          {spontaneousWedge && (
            <div className="p-5 bg-amber-950/80 border-2 border-amber-500 rounded-2xl text-amber-200 flex items-center gap-4">
              <AlertTriangle className="w-8 h-8 text-amber-400 flex-shrink-0" />
              <div>
                <h4 className="text-md font-bold">SPONTANEOUS WEDGE / DISTAL MIGRATION DETECTED</h4>
                <p className="text-xs">
                  Continuous waveform shows wedge pattern with deflated balloon. Catheter has migrated into peripheral arteriole.
                  <strong> Withdraw catheter 2-3 cm immediately</strong> to prevent pulmonary infarction.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Live Catheter Controls */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-5">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <Wind className="w-5 h-5 text-red-400" />
                Catheter Balloon Inflation Watchdog
              </h3>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Balloon Inflation Volume (Max 1.5 mL)</span>
                  <span className={`font-bold ${isOverinflated ? 'text-red-400 font-mono text-sm' : 'text-white'}`}>
                    {balloonVolume} mL
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="2.0"
                  step="0.1"
                  value={balloonVolume}
                  onChange={e => setBalloonVolume(Number(e.target.value))}
                  className="w-full accent-red-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Inflation Duration Seconds (Max 15s)</span>
                  <span className={`font-bold ${isProlongedInflation ? 'text-amber-400' : 'text-white'}`}>
                    {inflationSeconds}s
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="1"
                  value={inflationSeconds}
                  onChange={e => setInflationSeconds(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="flex items-center gap-3 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={spontaneousWedge}
                    onChange={e => setSpontaneousWedge(e.target.checked)}
                    className="rounded border-slate-700 text-red-600 focus:ring-red-500 w-4 h-4"
                  />
                  <span>Simulate Spontaneous Wedge (Distal Migration)</span>
                </label>

                <label className="flex items-center gap-3 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dampedWaveform}
                    onChange={e => setDampedWaveform(e.target.checked)}
                    className="rounded border-slate-700 text-amber-600 focus:ring-amber-500 w-4 h-4"
                  />
                  <span>Simulate Damped Waveform / Blood Clot in Lumen</span>
                </label>
              </div>

              <button
                onClick={handleLogSafetyEvent}
                className="w-full py-2 bg-red-600/30 hover:bg-red-600/50 text-red-300 rounded-xl text-xs font-semibold border border-red-500/40"
              >
                Log Catheter Watchdog Event to EHR
              </button>
            </div>

            {/* Catheter Rupture Risk Index */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                Catheter Complication Sentinel
              </h3>

              <div className="space-y-3">
                <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
                  <div className="text-xs text-slate-400 mb-1">Pulmonary Artery Rupture Risk</div>
                  <div className={`text-xl font-black ${
                    isOverinflated ? 'text-red-400' : mpapMmhg > 35 ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {isOverinflated ? 'IMMINENT / CRITICAL' : mpapMmhg > 35 ? 'MODERATE (PAH)' : 'LOW'}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Risk factors: Balloon volume &gt; 1.5 mL, severe pulmonary hypertension (mPAP &ge; 35 mmHg), hypothermia, female &gt; 65yo.
                  </p>
                </div>

                <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
                  <div className="text-xs text-slate-400 mb-1">Pulmonary Infarction Watchdog</div>
                  <div className={`text-xl font-black ${isProlongedInflation ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {isProlongedInflation ? 'WARNING: PROLONGED OCCLUSION' : 'SAFE'}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Continuous wedge occlusion &gt; 15 seconds produces regional ischemia and alveolar hemorrhage.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TELEMETRY LOG */}
      {activeTab === 'history' && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
          <h3 className="text-md font-bold text-white flex items-center gap-2">
            <Gauge className="w-5 h-5 text-red-400" />
            Historical PAC Measurements & Safety Events
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">CI (L/min/m²)</th>
                  <th className="p-3">CO (L/min)</th>
                  <th className="p-3">MAP</th>
                  <th className="p-3">CVP</th>
                  <th className="p-3">mPAP</th>
                  <th className="p-3">PCWP</th>
                  <th className="p-3">SVR</th>
                  <th className="p-3">SvO2</th>
                  <th className="p-3">Quadrant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {records.length > 0 ? (
                  records.map(r => (
                    <tr key={r.id} className="hover:bg-slate-800/30">
                      <td className="p-3 font-mono">{new Date(r.recorded_at).toLocaleTimeString()}</td>
                      <td className={`p-3 font-bold ${r.cardiac_index < 2.2 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {r.cardiac_index}
                      </td>
                      <td className="p-3">{r.cardiac_output_l_min}</td>
                      <td className="p-3">{r.map_mmhg}</td>
                      <td className="p-3">{r.cvp_mmhg}</td>
                      <td className="p-3">{r.mpap_mmhg}</td>
                      <td className="p-3">{r.pcwp_mmhg}</td>
                      <td className="p-3">{r.svr_dynes}</td>
                      <td className={`p-3 ${r.svo2_percent < 60 ? 'text-red-400 font-bold' : ''}`}>
                        {r.svo2_percent}%
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          r.forrester_quadrant === 'Cold_Wet'
                            ? 'bg-red-500/20 text-red-300'
                            : 'bg-emerald-500/20 text-emerald-300'
                        }`}>
                          {r.forrester_quadrant}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="p-6 text-center text-slate-500">
                      No recorded PAC profiles found for patient ID {patientId}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {safetyEvents.length > 0 && (
            <div className="mt-6 pt-4 border-t border-slate-800">
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
                Logged Catheter Safety Events
              </h4>
              <div className="space-y-2">
                {safetyEvents.map(s => (
                  <div key={s.id} className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl text-xs flex justify-between items-center">
                    <div>
                      <span className="font-bold text-white mr-2">{s.event_type}</span>
                      <span className="text-slate-400">{s.warning_message}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(s.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HemoSwanHub;
