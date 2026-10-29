import React, { useState, useEffect } from 'react';

interface ParklandFormula {
  coefficientMlPerKgPct: number;
  total24hVolumeMl: number;
  first8hVolumeTotalMl: number;
  remainingFirst8hVolumeMl: number;
  remainingFirst8hHours: number;
  first8hRateMlH: number;
  next16hVolumeMl: number;
  next16hRateMlH: number;
}

interface BurnEvaluationResult {
  patientId: number;
  weightKg: number;
  calculatedTbsa: number;
  firstDegreeTbsaExcluded: number;
  mechanism: string;
  hoursSinceInjury: number;
  carboxyhemoglobinPct?: number;
  parklandFormula: ParklandFormula;
  targetUrineOutput: {
    targetRangeMlKgH: string;
    targetMinMlH: number;
    targetMaxMlH: number;
    specialRationale: string;
  };
  inhalationInjuryPlan: {
    suspected: boolean;
    intubationIndicated: boolean;
    fio2Protocol: string;
    coHalfLifeEstimate: string;
    cyanideAntidoteIndicated: boolean;
    cyanideAntidoteDose?: string;
  };
  compartmentSyndromeAndEscharotomy: {
    escharotomyIndicated: boolean;
    locationGuidance: string[];
    bladderPressureMonitoringIndicated: boolean;
  };
  protocolDirectives: string[];
  clinicalSummary: string;
}

interface HourlyTitrationResult {
  patientId: number;
  encounterId?: number;
  hourPostBurn: number;
  currentLrRateMlH: number;
  urineOutputMl: number;
  urineOutputMlKgH: number;
  bladderPressureMmhg?: number;
  cumulativeFluidMl: number;
  fluidCreepFlag: 'NORMAL' | 'CAUTION_CREEP' | 'SEVERE_ACS_RISK';
  titrationAction: string;
  newLrRateMlH: number;
  clinicalDirective: string;
}

export const BurnResusHub: React.FC = () => {
  const [patientId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'evaluator' | 'titration' | 'history'>('evaluator');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Tab 1: Evaluator State
  const [weightKg, setWeightKg] = useState<number>(75);
  const [isPediatric, setIsPediatric] = useState<boolean>(false);
  const [mechanism, setMechanism] = useState<string>('THERMAL_FLAME');
  const [hoursSinceInjury, setHoursSinceInjury] = useState<number>(2.0);
  const [prehospitalFluidReceivedMl, setPrehospitalFluidReceivedMl] = useState<number>(1000);

  // Rule of Nines
  const [headNeck, setHeadNeck] = useState<number>(9);
  const [anteriorTrunk, setAnteriorTrunk] = useState<number>(18);
  const [posteriorTrunk, setPosteriorTrunk] = useState<number>(9);
  const [rightArm, setRightArm] = useState<number>(9);
  const [leftArm, setLeftArm] = useState<number>(4.5);
  const [rightLeg, setRightLeg] = useState<number>(18);
  const [leftLeg, setLeftLeg] = useState<number>(9);
  const [perineum, setPerineum] = useState<number>(1);
  const [firstDegreeSunburnTbsa, setFirstDegreeSunburnTbsa] = useState<number>(10);

  // Comorbidities / Inhalation
  const [enclosedSpace, setEnclosedSpace] = useState<boolean>(true);
  const [carbonaceousSputum, setCarbonaceousSputum] = useState<boolean>(true);
  const [stridorHoarseness, setStridorHoarseness] = useState<boolean>(false);
  const [carboxyhemoglobinPct, setCarboxyhemoglobinPct] = useState<number>(22);
  const [serumLactateMmolL, setSerumLactateMmolL] = useState<number>(8.5);
  const [circumferentialBurn, setCircumferentialBurn] = useState<boolean>(true);
  const [pigmenturiaOrRhabdo, setPigmenturiaOrRhabdo] = useState<boolean>(false);

  const [evaluationResult, setEvaluationResult] = useState<BurnEvaluationResult | null>(null);

  // Tab 2: Hourly Titration State
  const [hourPostBurn, setHourPostBurn] = useState<number>(4);
  const [currentLrRateMlH, setCurrentLrRateMlH] = useState<number>(950);
  const [urineOutputMl, setUrineOutputMl] = useState<number>(28);
  const [bladderPressureMmhg, setBladderPressureMmhg] = useState<number>(14);
  const [cumulativeFluidMl, setCumulativeFluidMl] = useState<number>(4800);
  const [titrationPigmenturia, setTitrationPigmenturia] = useState<boolean>(false);
  const [titrationResult, setTitrationResult] = useState<HourlyTitrationResult | null>(null);

  // Tab 3: History State
  const [encountersHistory, setEncountersHistory] = useState<any[]>([]);
  const [titrationLogsHistory, setTitrationLogsHistory] = useState<any[]>([]);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const headers = { Authorization: `Bearer ${token}` };

      const [encRes, logRes] = await Promise.all([
        fetch(`/api/clinician/burns/encounters/${patientId}`, { headers }),
        fetch(`/api/clinician/burns/titration-logs/${patientId}`, { headers })
      ]);

      if (encRes.ok) {
        setEncountersHistory(await encRes.json());
      }
      if (logRes.ok) {
        setTitrationLogsHistory(await logRes.json());
      }
    } catch (err: any) {
      console.error('Failed to load history:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  const handleEvaluate = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const inhalationSigns: string[] = [];
      if (enclosedSpace) inhalationSigns.push('enclosed_space');
      if (carbonaceousSputum) inhalationSigns.push('carbonaceous_sputum');
      if (stridorHoarseness) inhalationSigns.push('stridor_hoarseness');

      const body = {
        patientId,
        weightKg,
        isPediatric,
        mechanism,
        hoursSinceInjury,
        prehospitalFluidReceivedMl,
        tbsaBreakdown: {
          headNeck,
          anteriorTrunk,
          posteriorTrunk,
          rightArm,
          leftArm,
          rightLeg,
          leftLeg,
          perineum,
          firstDegreeSunburnTbsa
        },
        circumferentialBurnLimbsOrTorso: circumferentialBurn,
        inhalationInjurySigns: inhalationSigns,
        carboxyhemoglobinPct: carboxyhemoglobinPct || undefined,
        serumLactateMmolL: serumLactateMmolL || undefined,
        pigmenturiaOrRhabdo
      };

      const res = await fetch('/api/clinician/burns/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to evaluate burn shock.');
      }

      const data = await res.json();
      setEvaluationResult(data.evaluation);
      setStatusMessage('Burn shock and Parkland resuscitation plan computed successfully.');
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogTitration = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const token = localStorage.getItem('intakerx_clinician_token');
      const body = {
        patientId,
        weightKg,
        hourPostBurn,
        currentLrRateMlH,
        urineOutputMl,
        bladderPressureMmhg: bladderPressureMmhg || undefined,
        cumulativeFluidMl,
        pigmenturiaPresent: titrationPigmenturia
      };

      const res = await fetch('/api/clinician/burns/titration/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to log burn fluid titration.');
      }

      const data = await res.json();
      setTitrationResult(data.titration);
      setStatusMessage('Hourly urine output and fluid creep analyzed.');
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px', backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '16px', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '32px' }}>🔥</span>
            <div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#ea580c', letterSpacing: '-0.02em' }}>
                BURN-RESUS
              </h1>
              <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '14px' }}>
                Critical Burn Shock, Inhalation Cyanide/CO Sentinel & Parkland-Baxter Dynamic Titration
              </p>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ display: 'inline-block', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, backgroundColor: '#9a3412', color: '#ffedd5' }}>
            PHASE 99 ACTIVE
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('evaluator')}
          style={{
            padding: '10px 18px',
            borderRadius: '6px',
            border: 'none',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            backgroundColor: activeTab === 'evaluator' ? '#ea580c' : '#1e293b',
            color: activeTab === 'evaluator' ? '#ffffff' : '#94a3b8'
          }}
        >
          🔥 TBSA & Parkland-Baxter Resuscitation
        </button>
        <button
          onClick={() => setActiveTab('titration')}
          style={{
            padding: '10px 18px',
            borderRadius: '6px',
            border: 'none',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            backgroundColor: activeTab === 'titration' ? '#ea580c' : '#1e293b',
            color: activeTab === 'titration' ? '#ffffff' : '#94a3b8'
          }}
        >
          🧪 Hourly UO Titration & Fluid Creep Sentinel
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            padding: '10px 18px',
            borderRadius: '6px',
            border: 'none',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            backgroundColor: activeTab === 'history' ? '#ea580c' : '#1e293b',
            color: activeTab === 'history' ? '#ffffff' : '#94a3b8'
          }}
        >
          📋 Resuscitation History
        </button>
      </div>

      {statusMessage && (
        <div style={{ padding: '12px 16px', borderRadius: '6px', backgroundColor: statusMessage.startsWith('Error') ? '#7f1d1d' : '#064e3b', color: '#f8fafc', marginBottom: '20px', fontSize: '14px' }}>
          {statusMessage}
        </div>
      )}

      {/* TAB 1: EVALUATOR */}
      {activeTab === 'evaluator' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* Controls */}
          <div style={{ backgroundColor: '#1e293b', borderRadius: '8px', padding: '20px', border: '1px solid #334155' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: 0, marginBottom: '16px', color: '#f8fafc', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
              Burn Trauma Parameters & Rule of Nines
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Weight (kg)</label>
                <input
                  type="number"
                  value={weightKg}
                  onChange={(e) => setWeightKg(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Mechanism</label>
                <select
                  value={mechanism}
                  onChange={(e) => setMechanism(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                >
                  <option value="THERMAL_FLAME">Thermal Flame</option>
                  <option value="SCALD">Scald</option>
                  <option value="ELECTRICAL_HIGH_VOLTAGE">Electrical (High Voltage &gt; 1000V)</option>
                  <option value="CHEMICAL">Chemical Burn</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Hours Since Injury (Burn Clock)</label>
                <input
                  type="number"
                  step="0.5"
                  value={hoursSinceInjury}
                  onChange={(e) => setHoursSinceInjury(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Prehospital Fluid Received (mL)</label>
                <input
                  type="number"
                  value={prehospitalFluidReceivedMl}
                  onChange={(e) => setPrehospitalFluidReceivedMl(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#38bdf8', cursor: 'pointer' }}>
                <input type="checkbox" checked={isPediatric} onChange={(e) => setIsPediatric(e.target.checked)} />
                Pediatric Burn Patient (&lt; 30 kg, 3 mL/kg/%TBSA formula)
              </label>
            </div>

            {/* Rule of Nines Anatomical Breakdown */}
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#ea580c', margin: '16px 0 8px 0' }}>
              Rule of Nines (% TBSA 2nd & 3rd Degree Burns Only)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #334155', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8' }}>Head/Neck (9%)</label>
                <input type="number" step="0.5" value={headNeck} onChange={(e) => setHeadNeck(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '4px 6px', backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8' }}>Ant. Trunk (18%)</label>
                <input type="number" step="0.5" value={anteriorTrunk} onChange={(e) => setAnteriorTrunk(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '4px 6px', backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8' }}>Post. Trunk (18%)</label>
                <input type="number" step="0.5" value={posteriorTrunk} onChange={(e) => setPosteriorTrunk(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '4px 6px', backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8' }}>Right Arm (9%)</label>
                <input type="number" step="0.5" value={rightArm} onChange={(e) => setRightArm(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '4px 6px', backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8' }}>Left Arm (9%)</label>
                <input type="number" step="0.5" value={leftArm} onChange={(e) => setLeftArm(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '4px 6px', backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8' }}>Perineum (1%)</label>
                <input type="number" step="0.5" value={perineum} onChange={(e) => setPerineum(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '4px 6px', backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8' }}>Right Leg (18%)</label>
                <input type="number" step="0.5" value={rightLeg} onChange={(e) => setRightLeg(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '4px 6px', backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8' }}>Left Leg (18%)</label>
                <input type="number" step="0.5" value={leftLeg} onChange={(e) => setLeftLeg(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '4px 6px', backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#f87171' }}>1st Deg. Sunburn (0%)</label>
                <input type="number" step="0.5" value={firstDegreeSunburnTbsa} onChange={(e) => setFirstDegreeSunburnTbsa(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '4px 6px', backgroundColor: '#1e293b', border: '1px solid #7f1d1d', borderRadius: '4px', color: '#fca5a5', fontSize: '12px' }} />
              </div>
            </div>

            {/* Inhalation Injury & Special Risks */}
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#f59e0b', margin: '16px 0 8px 0' }}>
              Inhalation Injury, Carbon Monoxide & Cyanide Sentinel
            </h3>
            <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input type="checkbox" checked={enclosedSpace} onChange={(e) => setEnclosedSpace(e.target.checked)} />
                  Enclosed Space Fire
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input type="checkbox" checked={carbonaceousSputum} onChange={(e) => setCarbonaceousSputum(e.target.checked)} />
                  Carbonaceous Sputum
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input type="checkbox" checked={stridorHoarseness} onChange={(e) => setStridorHoarseness(e.target.checked)} />
                  Stridor / Hoarseness
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444' }}>
                  <input type="checkbox" checked={circumferentialBurn} onChange={(e) => setCircumferentialBurn(e.target.checked)} />
                  Circumferential Full-Thickness Burn
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '4px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8' }}>Carboxyhemoglobin (COHb %)</label>
                  <input type="number" step="0.1" value={carboxyhemoglobinPct} onChange={(e) => setCarboxyhemoglobinPct(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '4px 6px', backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8' }}>Serum Lactate (mmol/L)</label>
                  <input type="number" step="0.1" value={serumLactateMmolL} onChange={(e) => setSerumLactateMmolL(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '4px 6px', backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '4px', color: '#fff', fontSize: '12px' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#f59e0b' }}>
                  <input type="checkbox" checked={pigmenturiaOrRhabdo} onChange={(e) => setPigmenturiaOrRhabdo(e.target.checked)} />
                  Pigmenturia / Hemoglobinuria / Rhabdomyolysis (Target UO 1.5 - 2.0 mL/kg/h)
                </label>
              </div>
            </div>

            <button
              onClick={handleEvaluate}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#ea580c',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 700,
                fontSize: '15px',
                cursor: 'pointer'
              }}
            >
              {isLoading ? 'Computing Resuscitation...' : '🚀 Compute TBSA & Parkland-Baxter Resuscitation Protocol'}
            </button>
          </div>

          {/* Results Panel */}
          <div style={{ backgroundColor: '#1e293b', borderRadius: '8px', padding: '20px', border: '1px solid #334155' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: 0, marginBottom: '16px', color: '#f8fafc', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
              Parkland-Baxter Plan & Critical Burn Directives
            </h2>

            {evaluationResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* TBSA & Parkland 24h Badges */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: evaluationResult.calculatedTbsa >= 40 ? '#7c2d12' : evaluationResult.calculatedTbsa >= 20 ? '#9a3412' : '#14532d' }}>
                    <div style={{ fontSize: '11px', color: '#cbd5e1', textTransform: 'uppercase', fontWeight: 600 }}>Calculated 2nd/3rd Deg. TBSA</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                      {evaluationResult.calculatedTbsa}% TBSA
                    </div>
                    {evaluationResult.firstDegreeTbsaExcluded > 0 && (
                      <div style={{ fontSize: '11px', color: '#fca5a5', marginTop: '2px' }}>
                        ({evaluationResult.firstDegreeTbsaExcluded}% 1st degree sunburn excluded)
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569' }}>
                    <div style={{ fontSize: '11px', color: '#cbd5e1', textTransform: 'uppercase', fontWeight: 600 }}>Total 24h Lactated Ringer's</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#38bdf8', marginTop: '2px' }}>
                      {evaluationResult.parklandFormula.total24hVolumeMl} mL
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                      ({evaluationResult.parklandFormula.coefficientMlPerKgPct} mL x {evaluationResult.weightKg} kg x {evaluationResult.calculatedTbsa}%)
                    </div>
                  </div>
                </div>

                {/* Parkland Burn Clock Schedule */}
                <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '6px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#ea580c', marginBottom: '8px' }}>
                    ⏱️ Parkland Fluid Clock Schedule
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px', color: '#cbd5e1' }}>
                    <div style={{ padding: '10px', backgroundColor: '#1e293b', borderRadius: '4px' }}>
                      <div style={{ fontWeight: 600, color: '#f8fafc' }}>First 8 Hours from Injury:</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#f59e0b', marginTop: '4px' }}>
                        {evaluationResult.parklandFormula.first8hRateMlH} mL/h
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                        {evaluationResult.parklandFormula.remainingFirst8hHours.toFixed(1)}h remaining ({evaluationResult.parklandFormula.remainingFirst8hVolumeMl} mL)
                      </div>
                    </div>
                    <div style={{ padding: '10px', backgroundColor: '#1e293b', borderRadius: '4px' }}>
                      <div style={{ fontWeight: 600, color: '#f8fafc' }}>Next 16 Hours:</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#38bdf8', marginTop: '4px' }}>
                        {evaluationResult.parklandFormula.next16hRateMlH} mL/h
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                        Total 16h: {evaluationResult.parklandFormula.next16hVolumeMl} mL
                      </div>
                    </div>
                  </div>
                </div>

                {/* Target Urine Output */}
                <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '6px', border: '1px solid #334155' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#ea580c' }}>🧪 Target Urine Output (Gold Standard Endpoint)</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#34d399' }}>{evaluationResult.targetUrineOutput.targetRangeMlKgH}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#f8fafc', marginBottom: '2px' }}>
                    <strong>Hourly Target:</strong> {evaluationResult.targetUrineOutput.targetMinMlH} - {evaluationResult.targetUrineOutput.targetMaxMlH} mL/h
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    {evaluationResult.targetUrineOutput.specialRationale}
                  </div>
                </div>

                {/* Inhalation Injury & Antidote Alert */}
                {evaluationResult.inhalationInjuryPlan.suspected && (
                  <div style={{ backgroundColor: '#450a0a', padding: '16px', borderRadius: '6px', border: '1px solid #ef4444' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#fecaca' }}>🫁 Inhalation Injury & Toxic Gas Sentinel</span>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: evaluationResult.inhalationInjuryPlan.intubationIndicated ? '#dc2626' : '#d97706', color: '#fff', fontWeight: 600 }}>
                        {evaluationResult.inhalationInjuryPlan.intubationIndicated ? 'INTUBATION MANDATORY' : 'HIGH RISK'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#fee2e2', marginBottom: '4px' }}>
                      <strong>Oxygen:</strong> {evaluationResult.inhalationInjuryPlan.fio2Protocol}
                    </div>
                    <div style={{ fontSize: '12px', color: '#fca5a5', marginBottom: '4px' }}>
                      <strong>CO Half-Life:</strong> {evaluationResult.inhalationInjuryPlan.coHalfLifeEstimate}
                    </div>
                    {evaluationResult.inhalationInjuryPlan.cyanideAntidoteIndicated && (
                      <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#7f1d1d', borderRadius: '4px', fontSize: '12px', color: '#fef2f2' }}>
                        🚨 <strong>CYANIDE ANTIDOTE ORDERED:</strong> {evaluationResult.inhalationInjuryPlan.cyanideAntidoteDose}
                      </div>
                    )}
                  </div>
                )}

                {/* Escharotomy Alert */}
                {evaluationResult.compartmentSyndromeAndEscharotomy.escharotomyIndicated && (
                  <div style={{ backgroundColor: '#7c2d12', padding: '16px', borderRadius: '6px', border: '1px solid #ea580c' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffedd5', marginBottom: '6px' }}>
                      🔪 Circumferential Burn Escharotomy Guidance
                    </div>
                    <ul style={{ margin: '0 0 0 16px', padding: 0, fontSize: '12px', color: '#fed7aa' }}>
                      {evaluationResult.compartmentSyndromeAndEscharotomy.locationGuidance.map((g, i) => (
                        <li key={i} style={{ marginBottom: '4px' }}>{g}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Directives */}
                <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '6px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>Protocol Directives:</div>
                  <ul style={{ margin: '0 0 0 16px', padding: 0, fontSize: '12px', color: '#cbd5e1' }}>
                    {evaluationResult.protocolDirectives.map((d, i) => (
                      <li key={i} style={{ marginBottom: '4px' }}>{d}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div style={{ color: '#94a3b8', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>
                Complete burn trauma parameters and click "Compute TBSA & Parkland Resuscitation" to generate the fluid titration plan.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: HOURLY TITRATION */}
      {activeTab === 'titration' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div style={{ backgroundColor: '#1e293b', borderRadius: '8px', padding: '20px', border: '1px solid #334155' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: 0, marginBottom: '16px', color: '#f8fafc', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
              Hourly Fluid Titration & Bladder Pressure Watchdog
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Hour Post-Burn</label>
                <input
                  type="number"
                  value={hourPostBurn}
                  onChange={(e) => setHourPostBurn(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Current LR Rate (mL/h)</label>
                <input
                  type="number"
                  value={currentLrRateMlH}
                  onChange={(e) => setCurrentLrRateMlH(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Hourly Urine Output (mL)</label>
                <input
                  type="number"
                  value={urineOutputMl}
                  onChange={(e) => setUrineOutputMl(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Bladder Pressure (IAP mmHg)</label>
                <input
                  type="number"
                  step="0.5"
                  value={bladderPressureMmhg}
                  onChange={(e) => setBladderPressureMmhg(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Cumulative Fluid Infused (mL)</label>
                <input
                  type="number"
                  value={cumulativeFluidMl}
                  onChange={(e) => setCumulativeFluidMl(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#f59e0b', cursor: 'pointer' }}>
                  <input type="checkbox" checked={titrationPigmenturia} onChange={(e) => setTitrationPigmenturia(e.target.checked)} />
                  Pigmenturia Active (Requires 1.5 - 2.0 mL/kg/h)
                </label>
              </div>
            </div>

            <button
              onClick={handleLogTitration}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#ea580c',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 700,
                fontSize: '15px',
                cursor: 'pointer'
              }}
            >
              {isLoading ? 'Analyzing Titration...' : '🧪 Log Hourly Data & Validate Safe Renal Perfusion'}
            </button>
          </div>

          <div style={{ backgroundColor: '#1e293b', borderRadius: '8px', padding: '20px', border: '1px solid #334155' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: 0, marginBottom: '16px', color: '#f8fafc', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
              Dynamic Rate Adjustment & ACS Feedback
            </h2>

            {titrationResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: titrationResult.fluidCreepFlag === 'SEVERE_ACS_RISK' ? '#7f1d1d' : titrationResult.fluidCreepFlag === 'CAUTION_CREEP' ? '#78350f' : '#14532d' }}>
                    <div style={{ fontSize: '11px', color: '#cbd5e1', textTransform: 'uppercase', fontWeight: 600 }}>Fluid Creep Status</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                      {titrationResult.fluidCreepFlag}
                    </div>
                  </div>
                  <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569' }}>
                    <div style={{ fontSize: '11px', color: '#cbd5e1', textTransform: 'uppercase', fontWeight: 600 }}>Hourly UO (mL/kg/h)</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: titrationResult.urineOutputMlKgH < 0.5 ? '#f87171' : '#10b981', marginTop: '2px' }}>
                      {titrationResult.urineOutputMlKgH} mL/kg/h
                    </div>
                  </div>
                </div>

                <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '6px', border: '1px solid #334155' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#ea580c' }}>💉 Titration Action</span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#38bdf8' }}>
                      New Rate: {titrationResult.newLrRateMlH} mL/h
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#f8fafc', lineHeight: 1.5 }}>
                    {titrationResult.clinicalDirective}
                  </div>
                </div>

                <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '6px', border: '1px solid #334155', fontSize: '12px', color: '#94a3b8' }}>
                  <div style={{ fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>Fluid Creep Milestones:</div>
                  <div>• &gt; 180 mL/kg in 24h: Intra-abdominal hypertension risk. Measure bladder pressure Q4H.</div>
                  <div>• &gt; 250 mL/kg in 24h: Abdominal Compartment Syndrome (ACS). Initiate 5% Albumin rescue.</div>
                  <div>• Bladder pressure &ge; 20 mmHg: Emergent surgical decompression / escharotomy.</div>
                </div>
              </div>
            ) : (
              <div style={{ color: '#94a3b8', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>
                Log hourly urine output and bladder pressure to dynamically titrate Lactated Ringer's and prevent fluid creep.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: HISTORY */}
      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Encounters History */}
          <div style={{ backgroundColor: '#1e293b', borderRadius: '8px', padding: '20px', border: '1px solid #334155' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: 0, marginBottom: '16px', color: '#f8fafc', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
              Past Burn Resuscitation Encounters
            </h2>
            {encountersHistory.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: '14px' }}>No burn resuscitation encounters on record for Patient #{patientId}.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>Encounter</th>
                      <th style={{ padding: '8px' }}>Weight</th>
                      <th style={{ padding: '8px' }}>TBSA</th>
                      <th style={{ padding: '8px' }}>Mechanism</th>
                      <th style={{ padding: '8px' }}>Total 24h LR</th>
                      <th style={{ padding: '8px' }}>First 8h Rate</th>
                      <th style={{ padding: '8px' }}>Inhalation</th>
                      <th style={{ padding: '8px' }}>Escharotomy</th>
                      <th style={{ padding: '8px' }}>Evaluated At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {encountersHistory.map((row) => (
                      <tr key={row.id} style={{ borderBottom: '1px solid #1e293b' }}>
                        <td style={{ padding: '8px', fontWeight: 600 }}>#{row.id}</td>
                        <td style={{ padding: '8px' }}>{row.weight_kg} kg</td>
                        <td style={{ padding: '8px', color: row.tbsa_percentage >= 30 ? '#ef4444' : '#f59e0b', fontWeight: 600 }}>
                          {row.tbsa_percentage}%
                        </td>
                        <td style={{ padding: '8px' }}>{row.mechanism_type}</td>
                        <td style={{ padding: '8px', color: '#38bdf8' }}>{row.parkland_total_24h_ml} mL</td>
                        <td style={{ padding: '8px', fontWeight: 600 }}>{row.first_8h_rate_ml_h} mL/h</td>
                        <td style={{ padding: '8px', color: row.inhalation_injury_suspected ? '#ef4444' : '#10b981' }}>
                          {row.inhalation_injury_suspected ? 'YES' : 'No'}
                        </td>
                        <td style={{ padding: '8px', color: row.escharotomy_indicated ? '#ef4444' : '#94a3b8' }}>
                          {row.escharotomy_indicated ? 'INDICATED' : 'No'}
                        </td>
                        <td style={{ padding: '8px', color: '#94a3b8' }}>{new Date(row.evaluated_at).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Titration Logs History */}
          <div style={{ backgroundColor: '#1e293b', borderRadius: '8px', padding: '20px', border: '1px solid #334155' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: 0, marginBottom: '16px', color: '#f8fafc', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
              Hourly Parkland Titration Logs
            </h2>
            {titrationLogsHistory.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: '14px' }}>No titration logs on record for Patient #{patientId}.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>Hour</th>
                      <th style={{ padding: '8px' }}>Rate (mL/h)</th>
                      <th style={{ padding: '8px' }}>UO (mL)</th>
                      <th style={{ padding: '8px' }}>UO (mL/kg/h)</th>
                      <th style={{ padding: '8px' }}>IAP (mmHg)</th>
                      <th style={{ padding: '8px' }}>Cumulative</th>
                      <th style={{ padding: '8px' }}>Fluid Creep</th>
                      <th style={{ padding: '8px' }}>Action</th>
                      <th style={{ padding: '8px' }}>New Rate</th>
                      <th style={{ padding: '8px' }}>Logged At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {titrationLogsHistory.map((log) => (
                      <tr key={log.id} style={{ borderBottom: '1px solid #1e293b' }}>
                        <td style={{ padding: '8px', fontWeight: 600 }}>{log.hour_post_burn}h</td>
                        <td style={{ padding: '8px' }}>{log.current_lr_rate_ml_h}</td>
                        <td style={{ padding: '8px' }}>{log.urine_output_ml}</td>
                        <td style={{ padding: '8px', color: log.urine_output_ml_kg_h < 0.5 ? '#ef4444' : '#10b981' }}>
                          {log.urine_output_ml_kg_h}
                        </td>
                        <td style={{ padding: '8px', color: log.bladder_pressure_mmhg >= 20 ? '#ef4444' : '#f8fafc' }}>
                          {log.bladder_pressure_mmhg || 'N/A'}
                        </td>
                        <td style={{ padding: '8px' }}>{log.cumulative_fluid_ml} mL</td>
                        <td style={{ padding: '8px', color: log.fluid_creep_flag === 'NORMAL' ? '#10b981' : '#f59e0b' }}>
                          {log.fluid_creep_flag}
                        </td>
                        <td style={{ padding: '8px', fontWeight: 600 }}>{log.titration_action}</td>
                        <td style={{ padding: '8px', color: '#38bdf8', fontWeight: 600 }}>{log.new_lr_rate_ml_h} mL/h</td>
                        <td style={{ padding: '8px', color: '#94a3b8' }}>{new Date(log.logged_at).toLocaleTimeString()}</td>
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
