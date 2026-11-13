import React, { useState } from 'react';

// ============================================================================
// PHASE 106: SPACE-SANS SUB-HUB
// ============================================================================
export const SpaceSansHub: React.FC = () => {
  const [patientId] = useState<number>(1);
  const [missionDay, setMissionDay] = useState<number>(180);
  const [onsdMm, setOnsdMm] = useState<number>(6.4);
  const [choroidalFolds, setChoroidalFolds] = useState<boolean>(true);
  const [hyperopicShiftDiopters, setHyperopicShiftDiopters] = useState<number>(1.5);
  const [cottonWoolSpots, setCottonWoolSpots] = useState<boolean>(true);
  const [ijvFlowPattern, setIjvFlowPattern] = useState<string>('OCCLUSIVE_THROMBOSIS');
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleEvaluate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/space-sans/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          missionDay,
          onsdMm,
          choroidalFolds,
          hyperopicShiftDiopters,
          cottonWoolSpots,
          ijvFlowPattern
        })
      });
      if (res.ok) {
        setResult(await res.json());
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#1e293b', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>👁️</span> Phase 106: SPACE-SANS (Cephalad Fluid Shift & LBNP Countermeasures)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>MISSION DAY (μG)</label>
              <input type="number" value={missionDay} onChange={e => setMissionDay(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>ONSD (mm, norm ≤5.0)</label>
              <input type="number" step="0.1" value={onsdMm} onChange={e => setOnsdMm(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>HYPEROPIC SHIFT (D)</label>
              <input type="number" step="0.25" value={hyperopicShiftDiopters} onChange={e => setHyperopicShiftDiopters(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ marginBottom: '12px', fontSize: '12px' }}>
            <label style={{ display: 'block', color: '#94a3b8', marginBottom: '4px' }}>INTERNAL JUGULAR VEIN (IJV) DOPPLER FLOW</label>
            <select value={ijvFlowPattern} onChange={e => setIjvFlowPattern(e.target.value)} style={{ width: '100%', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }}>
              <option value="NORMAL_ANTEROGRADE">Normal Anterograde Pulsatile</option>
              <option value="STAGNANT">Stagnant / Low Velocity Pool</option>
              <option value="RETROGRADE_FLOW">Retrograde Cephalad Flow</option>
              <option value="OCCLUSIVE_THROMBOSIS">Occlusive Luminal Thrombosis</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '16px', fontSize: '12px', marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f8fafc', cursor: 'pointer' }}>
              <input type="checkbox" checked={choroidalFolds} onChange={e => setChoroidalFolds(e.target.checked)} />
              Choroidal Folds Present
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f8fafc', cursor: 'pointer' }}>
              <input type="checkbox" checked={cottonWoolSpots} onChange={e => setCottonWoolSpots(e.target.checked)} />
              Cotton Wool Spots Present
            </label>
          </div>

          <button onClick={handleEvaluate} disabled={isLoading} style={{ backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, width: '100%' }}>
            {isLoading ? 'EVALUATING SANS...' : 'RUN SANS & LBNP COUNTERMEASURE PROTOCOL'}
          </button>
        </div>

        <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #1e293b', fontSize: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#38bdf8' }}>SANS Staging & Lower Body Negative Pressure (LBNP)</h4>
          {result ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>SANS Clinical Grade:</span>
                <span style={{ fontWeight: 'bold', color: result.sansGrade === 'GRADE_4' ? '#ef4444' : '#f59e0b' }}>{result.sansGrade}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Fluid Shift Severity Score:</span>
                <span style={{ fontWeight: 'bold', color: '#f8fafc' }}>{result.fluidShiftSeverityScore} / 100</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Prescribed LBNP Vacuum:</span>
                <span style={{ fontWeight: 'bold', color: '#38bdf8' }}>{result.lbnpTargetMmhg} mmHg</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Daily LBNP Duration:</span>
                <span style={{ fontWeight: 'bold', color: '#38bdf8' }}>{result.lbnpDurationMinutes} min/day</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Anticoagulation Indicated:</span>
                <span style={{ fontWeight: 'bold', color: result.anticoagulationRequired ? '#ef4444' : '#10b981' }}>
                  {result.anticoagulationRequired ? 'MANDATORY (IJV RISK)' : 'NOT REQUIRED'}
                </span>
              </div>

              {result.clinicalAlerts.length > 0 && (
                <div style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d', borderRadius: '4px', padding: '6px', marginBottom: '8px', color: '#fca5a5' }}>
                  {result.clinicalAlerts.map((a: string, i: number) => <div key={i}>⚠️ {a}</div>)}
                </div>
              )}

              <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '6px' }}>
                <strong>Anticoagulation:</strong> {result.countermeasurePlan.anticoagulation}
              </div>
            </div>
          ) : (
            <div style={{ color: '#64748b' }}>Awaiting evaluation parameters.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PHASE 107: SOLAR-RAD SUB-HUB
// ============================================================================
export const SolarRadHub: React.FC = () => {
  const [missionPhase, setMissionPhase] = useState<string>('TRANSIT_MARS');
  const [speProtonFluxPfu, setSpeProtonFluxPfu] = useState<number>(12000);
  const [gcrDoseRateMsvDay, setGcrDoseRateMsvDay] = useState<number>(1.6);
  const [cumulativeMissionDoseMsv, setCumulativeMissionDoseMsv] = useState<number>(180);
  const [evaActive, setEvaActive] = useState<boolean>(true);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleEvaluate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/solar-rad/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          missionPhase,
          speProtonFluxPfu,
          gcrDoseRateMsvDay,
          cumulativeMissionDoseMsv,
          evaActive
        })
      });
      if (res.ok) {
        setResult(await res.json());
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#1e293b', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>☢️</span> Phase 107: SOLAR-RAD (Space Radiation & Solar Particle Event Sentinel)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>MISSION REGIME</label>
              <select value={missionPhase} onChange={e => setMissionPhase(e.target.value)} style={{ width: '100%', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }}>
                <option value="LEO">Low Earth Orbit (LEO Geomagnetic)</option>
                <option value="LUNAR_SURFACE">Lunar Surface (2π Shadowing)</option>
                <option value="TRANSIT_MARS">Deep Space Transit (Interplanetary)</option>
                <option value="MARTIAN_SURFACE">Martian Surface (CO2 Atmosphere)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>SPE PROTON FLUX (&gt;10 MeV pfu)</label>
              <input type="number" value={speProtonFluxPfu} onChange={e => setSpeProtonFluxPfu(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>GCR BACKGROUND (mSv/day)</label>
              <input type="number" step="0.1" value={gcrDoseRateMsvDay} onChange={e => setGcrDoseRateMsvDay(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>CUMULATIVE DOSE (mSv)</label>
              <input type="number" value={cumulativeMissionDoseMsv} onChange={e => setCumulativeMissionDoseMsv(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ marginBottom: '16px', fontSize: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f8fafc', cursor: 'pointer' }}>
              <input type="checkbox" checked={evaActive} onChange={e => setEvaActive(e.target.checked)} />
              Spacewalk (EVA) In Progress
            </label>
          </div>

          <button onClick={handleEvaluate} disabled={isLoading} style={{ backgroundColor: '#d97706', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, width: '100%' }}>
            {isLoading ? 'CALCULATING RADIATION RISKS...' : 'EVALUATE RADIATION STORM & ARS DIRECTIVES'}
          </button>
        </div>

        <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #1e293b', fontSize: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#fbbf24' }}>Dosimetric Assessment & Storm Protection</h4>
          {result ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Storm Alert Tier:</span>
                <span style={{ fontWeight: 'bold', color: result.stormTier.includes('BLACK') || result.stormTier.includes('RED') ? '#ef4444' : '#10b981' }}>
                  {result.stormTier}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Current Total Dose Rate:</span>
                <span style={{ fontWeight: 'bold', color: '#f8fafc' }}>{result.currentDoseRateMsvHour} mSv/h</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Projected 24h Dose:</span>
                <span style={{ fontWeight: 'bold', color: '#fbbf24' }}>{result.projected24hDoseMsv} mSv</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>ARS Projected Syndrome:</span>
                <span style={{ fontWeight: 'bold', color: result.arsSyndromeStage !== 'NONE' ? '#ef4444' : '#10b981' }}>{result.arsSyndromeStage}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Storm Shelter Retreat:</span>
                <span style={{ fontWeight: 'bold', color: result.shelterInPlaceRequired ? '#ef4444' : '#10b981' }}>
                  {result.shelterInPlaceRequired ? 'MANDATORY (POLYETHYLENE/WATER)' : 'NOMINAL'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8' }}>G-CSF (Filgrastim) Prophylaxis:</span>
                <span style={{ fontWeight: 'bold', color: result.filgrastimIndicated ? '#ef4444' : '#94a3b8' }}>
                  {result.filgrastimIndicated ? 'INDICATED (5 mcg/kg/day)' : 'NOT REQUIRED'}
                </span>
              </div>

              {result.clinicalDirectives.length > 0 && (
                <div style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d', borderRadius: '4px', padding: '6px', marginBottom: '8px', color: '#fca5a5' }}>
                  {result.clinicalDirectives.map((d: string, i: number) => <div key={i}>🚨 {d}</div>)}
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: '#64748b' }}>Awaiting radiation telemetry.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PHASE 108: MICROGRAV-RESUS SUB-HUB
// ============================================================================
export const MicrogravResusHub: React.FC = () => {
  const [patientId] = useState<number>(1);
  const [cardiacArrestPresent, setCardiacArrestPresent] = useState<boolean>(true);
  const [rhythm, setRhythm] = useState<string>('VFIB');
  const [ceilingAnchorAvailable, setCeilingAnchorAvailable] = useState<boolean>(true);
  const [confinedSpaceCapsule, setConfinedSpaceCapsule] = useState<boolean>(false);
  const [hemorrhagePresent, setHemorrhagePresent] = useState<boolean>(true);
  const [hemorrhageType, setHemorrhageType] = useState<string>('ARTERIAL_BLEED');
  const [estimatedBloodLossMl, setEstimatedBloodLossMl] = useState<number>(650);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleEvaluate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/micrograv-resus/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          cardiacArrestPresent,
          rhythm,
          ceilingAnchorAvailable,
          confinedSpaceCapsule,
          hemorrhagePresent,
          hemorrhageType,
          estimatedBloodLossMl
        })
      });
      if (res.ok) {
        setResult(await res.json());
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#1e293b', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#ec4899', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>🚀</span> Phase 108: MICROGRAV-RESUS (Zero-G CPR Biomechanics & Hermetic Canopy)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>CARDIAC RHYTHM</label>
              <select value={rhythm} onChange={e => setRhythm(e.target.value)} style={{ width: '100%', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }}>
                <option value="VFIB">Ventricular Fibrillation (Shockable)</option>
                <option value="VTACH">Pulseless V-Tach (Shockable)</option>
                <option value="PEA">PEA (Non-Shockable)</option>
                <option value="ASYSTOLE">Asystole (Non-Shockable)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>HEMORRHAGE TYPE</label>
              <select value={hemorrhageType} onChange={e => setHemorrhageType(e.target.value)} style={{ width: '100%', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }}>
                <option value="ARTERIAL_BLEED">Arterial Bleed (Aerosol Risk)</option>
                <option value="LUNG_LACERATION">Lung Laceration (Airway Contamination)</option>
                <option value="VENOUS_SHEARING">Venous Shearing</option>
                <option value="NONE">None</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '14px', fontSize: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f8fafc', cursor: 'pointer' }}>
              <input type="checkbox" checked={cardiacArrestPresent} onChange={e => setCardiacArrestPresent(e.target.checked)} />
              Cardiac Arrest Present
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f8fafc', cursor: 'pointer' }}>
              <input type="checkbox" checked={hemorrhagePresent} onChange={e => setHemorrhagePresent(e.target.checked)} />
              Active Hemorrhage
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f8fafc', cursor: 'pointer' }}>
              <input type="checkbox" checked={ceilingAnchorAvailable} onChange={e => setCeilingAnchorAvailable(e.target.checked)} />
              Overhead Bulkhead Available
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f8fafc', cursor: 'pointer' }}>
              <input type="checkbox" checked={confinedSpaceCapsule} onChange={e => setConfinedSpaceCapsule(e.target.checked)} />
              Confined Space Capsule
            </label>
          </div>

          <div style={{ marginBottom: '14px', fontSize: '12px' }}>
            <label style={{ display: 'block', color: '#94a3b8' }}>ESTIMATED BLOOD LOSS (mL)</label>
            <input type="number" value={estimatedBloodLossMl} onChange={e => setEstimatedBloodLossMl(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
          </div>

          <button onClick={handleEvaluate} disabled={isLoading} style={{ backgroundColor: '#db2777', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, width: '100%' }}>
            {isLoading ? 'CALCULATING BIOMECHANICS...' : 'EXECUTE ZERO-G CPR & SURGICAL CANOPY PROTOCOL'}
          </button>
        </div>

        <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #1e293b', fontSize: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#ec4899' }}>Resuscitation Mechanics & Containment Status</h4>
          {result ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>CPR Biomechanical Method:</span>
                <span style={{ fontWeight: 'bold', color: '#38bdf8' }}>{result.cprTechnique}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Chest Compression Rate:</span>
                <span style={{ fontWeight: 'bold', color: '#f8fafc' }}>{result.compressionRateCpm} cpm (Depth: {result.compressionDepthCm} cm)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Hermetic Suction Canopy:</span>
                <span style={{ fontWeight: 'bold', color: result.hermeticCanopyDeployed ? '#10b981' : '#94a3b8' }}>
                  {result.hermeticCanopyDeployed ? `DEPLOYED (${result.laminarSuctionFlowLpm} LPM)` : 'STANDBY'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Autotransfused RBC Volume:</span>
                <span style={{ fontWeight: 'bold', color: '#ec4899' }}>{result.autotransfusionVolumeMl} mL recovered</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Defibrillation Energy:</span>
                <span style={{ fontWeight: 'bold', color: result.defibrillationGuidance.energyJoules > 0 ? '#fbbf24' : '#94a3b8' }}>
                  {result.defibrillationGuidance.energyJoules} J (Hands-Free Pads)
                </span>
              </div>

              {result.clinicalAlerts.length > 0 && (
                <div style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d', borderRadius: '4px', padding: '6px', marginBottom: '8px', color: '#fca5a5' }}>
                  {result.clinicalAlerts.map((a: string, i: number) => <div key={i}>⚠️ {a}</div>)}
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: '#64748b' }}>Awaiting microgravity inputs.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PHASE 109: ECLSS-HABITAT SUB-HUB
// ============================================================================
export const EclssHabitatHub: React.FC = () => {
  const [habitatModule, setHabitatModule] = useState<string>('HAB_CORE_ALPHA');
  const [cabinPressurePsia, setCabinPressurePsia] = useState<number>(8.2);
  const [pco2Mmhg, setPco2Mmhg] = useState<number>(3.6);
  const [o2Percentage, setO2Percentage] = useState<number>(34.0);
  const [liohSaturationPct, setLiohSaturationPct] = useState<number>(88.0);
  const [ammoniaCoolantPpm, setAmmoniaCoolantPpm] = useState<number>(0.0);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleEvaluate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/eclss-habitat/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          habitatModule,
          cabinPressurePsia,
          pco2Mmhg,
          o2Percentage,
          liohSaturationPct,
          ammoniaCoolantPpm
        })
      });
      if (res.ok) {
        setResult(await res.json());
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#1e293b', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>🌿</span> Phase 109: ECLSS-HABITAT (Closed-Loop Life Support & Toxic Atmosphere Sentinel)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ marginBottom: '12px', fontSize: '12px' }}>
            <label style={{ display: 'block', color: '#94a3b8', marginBottom: '4px' }}>HABITAT MODULE</label>
            <select value={habitatModule} onChange={e => setHabitatModule(e.target.value)} style={{ width: '100%', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }}>
              <option value="HAB_CORE_ALPHA">Hab Core Alpha (Primary Crew Quarters)</option>
              <option value="AIRLOCK">EVA Equipment Airlock</option>
              <option value="ORION_CAPSULE">Orion Exploration Capsule</option>
              <option value="LAB_MODULE_BETA">Science Lab Module Beta</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>CABIN PRESSURE (psia)</label>
              <input type="number" step="0.1" value={cabinPressurePsia} onChange={e => setCabinPressurePsia(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>PCO2 (mmHg, norm &lt;2.0)</label>
              <input type="number" step="0.1" value={pco2Mmhg} onChange={e => setPco2Mmhg(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>O2 PERCENTAGE (%)</label>
              <input type="number" step="0.5" value={o2Percentage} onChange={e => setO2Percentage(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>LiOH SATURATION (%)</label>
              <input type="number" value={liohSaturationPct} onChange={e => setLiohSaturationPct(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>AMMONIA LOOP (ppm, norm 0)</label>
              <input type="number" value={ammoniaCoolantPpm} onChange={e => setAmmoniaCoolantPpm(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <button onClick={handleEvaluate} disabled={isLoading} style={{ backgroundColor: '#059669', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, width: '100%' }}>
            {isLoading ? 'ANALYZING HABITAT...' : 'EVALUATE ECLSS ATMOSPHERE & CONTAMINANT ENVELOPE'}
          </button>
        </div>

        <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #1e293b', fontSize: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#10b981' }}>Life Support Diagnostics & Scrubber Control</h4>
          {result ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Atmosphere Status:</span>
                <span style={{ fontWeight: 'bold', color: result.atmosphereStatus === 'OPTIMAL_NOMINAL' ? '#10b981' : '#ef4444' }}>
                  {result.atmosphereStatus}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>PCO2 Index:</span>
                <span style={{ fontWeight: 'bold', color: result.pco2Mmhg >= 3.0 ? '#f59e0b' : '#f8fafc' }}>
                  {result.respiratoryIndex.inspiredCo2Severity}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Flammability Risk:</span>
                <span style={{ fontWeight: 'bold', color: result.respiratoryIndex.flammabilityRisk.includes('HIGH') ? '#ef4444' : '#10b981' }}>
                  {result.respiratoryIndex.flammabilityRisk}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Ammonia Toxicity Tier:</span>
                <span style={{ fontWeight: 'bold', color: result.ammoniaCoolantPpm > 0 ? '#ef4444' : '#10b981' }}>
                  {result.respiratoryIndex.ammoniaToxicityTier}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Scrubber Mode:</span>
                <span style={{ fontWeight: 'bold', color: '#38bdf8' }}>{result.systemDirectives.scrubberMode}</span>
              </div>

              {result.correctiveActions.length > 0 && (
                <div style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d', borderRadius: '4px', padding: '6px', marginBottom: '8px', color: '#fca5a5' }}>
                  {result.correctiveActions.map((a: string, i: number) => <div key={i}>⚠️ {a}</div>)}
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: '#64748b' }}>Awaiting ECLSS telemetry.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PHASE 110: DELAYED-COMMS-TELEMED SUB-HUB
// ============================================================================
export const DeepSpaceTelemedHub: React.FC = () => {
  const [patientId] = useState<number>(1);
  const [missionDistanceAu, setMissionDistanceAu] = useState<number>(1.524);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([
    'severe_right_flank_pain',
    'microscopic_hematuria',
    'bone_density_loss',
    'nausea'
  ]);
  const [hydronephrosisPocus, setHydronephrosisPocus] = useState<boolean>(true);
  const [serumCalciumMgDl, setSerumCalciumMgDl] = useState<number>(11.2);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const toggleSymptom = (sym: string) => {
    if (selectedSymptoms.includes(sym)) {
      setSelectedSymptoms(selectedSymptoms.filter(s => s !== sym));
    } else {
      setSelectedSymptoms([...selectedSymptoms, sym]);
    }
  };

  const handleEvaluate = async () => {
    setIsLoading(true);
    try {
      const pocusFindings = hydronephrosisPocus
        ? ['hydronephrosis_right_kidney', 'acoustic_shadowing_ureteral_calculus']
        : [];

      const res = await fetch('/api/clinician/deep-space-telemed/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          missionDistanceAu,
          symptoms: selectedSymptoms,
          vitals: {
            heartRate: 102,
            systolicBp: 138,
            diastolicBp: 86,
            tempCelsius: 37.2,
            spo2Pct: 98
          },
          pocusFindings,
          onboardLabFindings: {
            serumCalciumMgDl,
            hematuriaDipstick: selectedSymptoms.includes('microscopic_hematuria')
          }
        })
      });
      if (res.ok) {
        setResult(await res.json());
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#1e293b', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#a855f7', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>🛰️</span> Phase 110: DELAYED-COMMS-TELEMED (Deep Space Autonomous Bayesian Diagnostic Engine)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>DISTANCE FROM EARTH (AU)</label>
              <input type="number" step="0.1" value={missionDistanceAu} onChange={e => setMissionDistanceAu(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>SERUM CALCIUM (mg/dL)</label>
              <input type="number" step="0.1" value={serumCalciumMgDl} onChange={e => setSerumCalciumMgDl(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ marginBottom: '12px', fontSize: '12px' }}>
            <label style={{ display: 'block', color: '#94a3b8', marginBottom: '4px' }}>ASTRONAUT SYMPTOM MANIFEST</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
              {[
                { id: 'severe_right_flank_pain', label: 'Severe Right Flank Pain' },
                { id: 'microscopic_hematuria', label: 'Microscopic Hematuria' },
                { id: 'bone_density_loss', label: 'Microgravity Bone Resorption' },
                { id: 'nausea', label: 'Visceral Nausea & Vomiting' },
                { id: 'joint_pain_post_eva', label: 'Post-EVA Joint Pain (Bends)' },
                { id: 'fever_chills', label: 'Fever & Peritoneal Rebound' }
              ].map(s => (
                <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f8fafc', cursor: 'pointer' }}>
                  <input type="checkbox" checked={selectedSymptoms.includes(s.id)} onChange={() => toggleSymptom(s.id)} />
                  {s.label}
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '14px', fontSize: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f8fafc', cursor: 'pointer' }}>
              <input type="checkbox" checked={hydronephrosisPocus} onChange={e => setHydronephrosisPocus(e.target.checked)} />
              Onboard POCUS Confirms Hydronephrosis / Shadowing Calculus
            </label>
          </div>

          <button onClick={handleEvaluate} disabled={isLoading} style={{ backgroundColor: '#9333ea', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, width: '100%' }}>
            {isLoading ? 'RESOLVING BAYESIAN DIFFERENTIALS...' : 'RUN AUTONOMOUS DEEP SPACE DIAGNOSTIC ARBITER'}
          </button>
        </div>

        <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #1e293b', fontSize: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#a855f7' }}>Interplanetary Telemedicine & Bayesian Output</h4>
          {result ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Speed-of-Light One-Way Delay:</span>
                <span style={{ fontWeight: 'bold', color: '#fbbf24' }}>{result.oneWayLatencyMinutes} min (Round-trip: {result.roundTripDelayMinutes} min)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Clinical Autonomy Mandated:</span>
                <span style={{ fontWeight: 'bold', color: result.clinicalAutonomyMandated ? '#a855f7' : '#10b981' }}>
                  {result.clinicalAutonomyMandated ? 'YES (AUTONOMOUS AI DECISION)' : 'TERRESTRIAL ACTIVE'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Primary Assessment:</span>
                <span style={{ fontWeight: 'bold', color: '#10b981' }}>{result.primaryDiagnosis}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Bayesian Confidence:</span>
                <span style={{ fontWeight: 'bold', color: '#38bdf8' }}>{result.confidenceScorePct}%</span>
              </div>

              <div style={{ marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Autonomous Pharmacotherapy:</span>
                <ul style={{ margin: '0', paddingLeft: '16px', color: '#f8fafc' }}>
                  {result.onboardTreatmentPlan.pharmacotherapy.map((p: string, i: number) => <li key={i}>{p}</li>)}
                </ul>
              </div>

              <div style={{ backgroundColor: '#022c22', border: '1px solid #065f46', borderRadius: '4px', padding: '6px', fontSize: '11px', color: '#6ee7b7' }}>
                <strong>SHA-256 Burst Signature:</strong> {result.cryptographicSignature.slice(0, 24)}... (Verified for DSN Downlink)
              </div>
            </div>
          ) : (
            <div style={{ color: '#64748b' }}>Awaiting deep-space telemetry input.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// SUITE 7 MASTER HUB
// ============================================================================
export const SpaceMedicineSuiteHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'p106' | 'p107' | 'p108' | 'p109' | 'p110'>('p106');

  return (
    <div style={{ padding: '20px', backgroundColor: '#0b0f19', color: '#f8fafc', minHeight: '100%', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: '20px', borderBottom: '1px solid #1e293b', paddingBottom: '16px' }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>🌌</span> Suite 7: Spaceflight, Planetary & Deep-Space Exploration Medicine
        </h2>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>
          Autonomous aerospace critical care for orbital, lunar, and deep-space interplanetary missions (Phases 106–110).
        </p>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { id: 'p106', label: '👁️ Phase 106: SPACE-SANS', color: '#38bdf8' },
          { id: 'p107', label: '☢️ Phase 107: SOLAR-RAD', color: '#fbbf24' },
          { id: 'p108', label: '🚀 Phase 108: MICROGRAV-RESUS', color: '#ec4899' },
          { id: 'p109', label: '🌿 Phase 109: ECLSS-HABITAT', color: '#10b981' },
          { id: 'p110', label: '🛰️ Phase 110: DELAYED-COMMS-TELEMED', color: '#a855f7' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '10px 16px',
              backgroundColor: activeTab === tab.id ? '#1e293b' : '#0f172a',
              color: activeTab === tab.id ? tab.color : '#94a3b8',
              border: activeTab === tab.id ? `2px solid ${tab.color}` : '1px solid #334155',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontSize: '13px'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'p106' && <SpaceSansHub />}
        {activeTab === 'p107' && <SolarRadHub />}
        {activeTab === 'p108' && <MicrogravResusHub />}
        {activeTab === 'p109' && <EclssHabitatHub />}
        {activeTab === 'p110' && <DeepSpaceTelemedHub />}
      </div>
    </div>
  );
};
export default SpaceMedicineSuiteHub;
