import React, { useState } from 'react';

// ============================================================================
// PHASE 101: MASS-CASUALTY-TRIAGE SUB-HUB
// ============================================================================
export const MassCasualtyTriageHub: React.FC = () => {
  const [incidentId, setIncidentId] = useState<string>('MCI-METRO-01');
  const [casualtyNumber, setCasualtyNumber] = useState<number>(1);
  const [canWalk, setCanWalk] = useState<boolean>(false);
  const [spontaneousBreathing, setSpontaneousBreathing] = useState<boolean>(true);
  const [respiratoryRate, setRespiratoryRate] = useState<number>(34);
  const [radialPulsePresent, setRadialPulsePresent] = useState<boolean>(false);
  const [obeysCommands, setObeysCommands] = useState<boolean>(false);
  const [hasChestDecompressionNeeded, setHasChestDecompressionNeeded] = useState<boolean>(true);
  const [result, setResult] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleTriage = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/mci/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incidentId,
          casualtyNumber,
          canWalk,
          spontaneousBreathing,
          respiratoryRate,
          radialPulsePresent,
          obeysCommands,
          hasChestDecompressionNeeded
        })
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
        // Refresh summary
        const sumRes = await fetch(`/api/clinician/mci/summary/${incidentId}`);
        if (sumRes.ok) setSummary(await sumRes.json());
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#1e293b', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>🚨</span> Phase 101: MASS-CASUALTY-TRIAGE (SALT / START Algorithm)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>INCIDENT ID</label>
              <input type="text" value={incidentId} onChange={e => setIncidentId(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>CASUALTY #</label>
              <input type="number" value={casualtyNumber} onChange={e => setCasualtyNumber(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '12px', marginBottom: '14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1' }}>
              <input type="checkbox" checked={canWalk} onChange={e => setCanWalk(e.target.checked)} />
              Can Walk (Minor / Walking Wounded)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1' }}>
              <input type="checkbox" checked={spontaneousBreathing} onChange={e => setSpontaneousBreathing(e.target.checked)} />
              Spontaneous Breathing Present
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1' }}>
              <input type="checkbox" checked={radialPulsePresent} onChange={e => setRadialPulsePresent(e.target.checked)} />
              Radial Pulse Present (Perfusion)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1' }}>
              <input type="checkbox" checked={obeysCommands} onChange={e => setObeysCommands(e.target.checked)} />
              Obeys Simple Commands (Mental Status)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1' }}>
              <input type="checkbox" checked={hasChestDecompressionNeeded} onChange={e => setHasChestDecompressionNeeded(e.target.checked)} />
              Needle Thoracostomy Needed
            </label>
            <div>
              <span style={{ color: '#94a3b8' }}>Resp Rate: </span>
              <input type="number" value={respiratoryRate} onChange={e => setRespiratoryRate(Number(e.target.value))} style={{ width: '60px', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '4px', borderRadius: '4px' }} /> /min
            </div>
          </div>

          <button
            onClick={handleTriage}
            disabled={isLoading}
            style={{ width: '100%', backgroundColor: '#ef4444', color: '#ffffff', fontWeight: 'bold', border: 'none', padding: '10px', borderRadius: '6px', cursor: 'pointer' }}
          >
            🏷️ Classify SALT Triage Tag
          </button>
        </div>

        {/* Triage Output */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', padding: '12px' }}>
          {result ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>TRIAGE DECISION</span>
                <span style={{ backgroundColor: `${result.colorCode}22`, color: result.colorCode, border: `1px solid ${result.colorCode}`, padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px' }}>
                  {result.triageCategory} (Rank #{result.priorityRank})
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#cbd5e1', marginBottom: '8px' }}>{result.clinicalRationale}</div>
              <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 600 }}>Destination: {result.transportDestination}</div>
              {result.lifeSavingInterventions?.length > 0 && (
                <div style={{ marginTop: '8px', fontSize: '11px', color: '#ef4444' }}>
                  <b>LSI Required:</b> {result.lifeSavingInterventions.join(', ')}
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
              Select casualty parameters and classify.
            </div>
          )}

          {summary && (
            <div style={{ marginTop: '12px', borderTop: '1px solid #334155', paddingTop: '8px', fontSize: '11px' }}>
              <div style={{ fontWeight: 'bold', color: '#cbd5e1', marginBottom: '4px' }}>ICS-201 INCIDENT SUMMARY</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{ color: '#ef4444' }}>RED: {summary.categoryBreakdown.RED_IMMEDIATE}</span>
                <span style={{ color: '#f59e0b' }}>YEL: {summary.categoryBreakdown.YELLOW_DELAYED}</span>
                <span style={{ color: '#10b981' }}>GRN: {summary.categoryBreakdown.GREEN_MINIMAL}</span>
                <span style={{ color: '#64748b' }}>BLK: {summary.categoryBreakdown.BLACK_EXPECTANT}</span>
              </div>
              <div style={{ color: '#94a3b8', marginTop: '4px' }}>{summary.surgeRecommendation}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PHASE 102: FLIGHT-CRIT SUB-HUB
// ============================================================================
export const FlightCritHub: React.FC = () => {
  const [cruisingAltitudeFt, setCruisingAltitudeFt] = useState<number>(8000);
  const [paO2SeaLevelMmhg, setPaO2SeaLevelMmhg] = useState<number>(92);
  const [fiO2, setFiO2] = useState<number>(0.21);
  const [baselineMapMmhg, setBaselineMapMmhg] = useState<number>(80);
  const [pneumothoraxPresent, setPneumothoraxPresent] = useState<boolean>(true);
  const [chestTubeInPlace, setChestTubeInPlace] = useState<boolean>(false);
  const [ettCuffAirFilled, setEttCuffAirFilled] = useState<boolean>(true);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleEvaluateFlight = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/flight-crit/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: 1,
          aircraftType: 'ROTARY_WING',
          cruisingAltitudeFt,
          paO2SeaLevelMmhg,
          fiO2,
          baselineMapMmhg,
          pneumothoraxPresent,
          chestTubeInPlace,
          ettCuffAirFilled
        })
      });
      if (res.ok) setResult(await res.json());
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#1e293b', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#0ea5e9', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>🚁</span> Phase 102: FLIGHT-CRIT (Aeromedical Flight Physiology)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>CABIN ALTITUDE (FT)</label>
              <input type="number" value={cruisingAltitudeFt} onChange={e => setCruisingAltitudeFt(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>SEA-LEVEL PaO2 (MMHG)</label>
              <input type="number" value={paO2SeaLevelMmhg} onChange={e => setPaO2SeaLevelMmhg(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '12px', marginBottom: '14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1' }}>
              <input type="checkbox" checked={pneumothoraxPresent} onChange={e => setPneumothoraxPresent(e.target.checked)} />
              Pneumothorax Present
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1' }}>
              <input type="checkbox" checked={chestTubeInPlace} onChange={e => setChestTubeInPlace(e.target.checked)} />
              Chest Tube Placed & Open
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1' }}>
              <input type="checkbox" checked={ettCuffAirFilled} onChange={e => setEttCuffAirFilled(e.target.checked)} />
              ETT Cuff Air-Filled (Needs Saline)
            </label>
            <div>
              <span style={{ color: '#94a3b8' }}>FiO2: </span>
              <input type="number" step="0.05" value={fiO2} onChange={e => setFiO2(Number(e.target.value))} style={{ width: '60px', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '4px', borderRadius: '4px' }} />
            </div>
          </div>

          <button
            onClick={handleEvaluateFlight}
            disabled={isLoading}
            style={{ width: '100%', backgroundColor: '#0ea5e9', color: '#0f172a', fontWeight: 'bold', border: 'none', padding: '10px', borderRadius: '6px', cursor: 'pointer' }}
          >
            ✈️ Calculate Boyle & Dalton Gas Shifts
          </button>
        </div>

        {/* Flight Output */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', padding: '12px' }}>
          {result ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>FLIGHT RISK TIER</span>
                <span style={{ backgroundColor: result.flightRiskTier === 'CRITICAL' ? '#7f1d1d' : '#0369a1', color: '#ffffff', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '11px' }}>
                  {result.flightRiskTier}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', fontSize: '11px', marginBottom: '10px' }}>
                <div>Barometric: <b>{result.barometricPressureMmhg} mmHg</b></div>
                <div>Gas Expansion: <b style={{ color: '#f59e0b' }}>{result.gasExpansionRatio}x (+{Math.round((result.gasExpansionRatio - 1) * 100)}%)</b></div>
                <div>Pred PaO2: <b style={{ color: result.predictedPaO2AltitudeMmhg < 60 ? '#ef4444' : '#10b981' }}>{result.predictedPaO2AltitudeMmhg} mmHg</b></div>
                <div>Pred CPP: <b>{result.predictedCppMmhg} mmHg</b></div>
              </div>

              <div style={{ fontSize: '11px', color: '#cbd5e1' }}>
                {result.flightDirectives.map((d: string, idx: number) => (
                  <div key={idx} style={{ marginBottom: '4px', color: d.includes('CRITICAL') ? '#ef4444' : '#38bdf8' }}>• {d}</div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
              Configure flight altitude and physiological inputs.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PHASE 103: DIVING-HYPERBARIC SUB-HUB
// ============================================================================
export const DivingHyperbaricHub: React.FC = () => {
  const [diagnosis, setDiagnosis] = useState<string>('ARTERIAL_GAS_EMBOLISM');
  const [diveDepthMsw, setDiveDepthMsw] = useState<number>(32);
  const [bottomTimeMin, setBottomTimeMin] = useState<number>(45);
  const [timeToSymptomOnsetMin, setTimeToSymptomOnsetMin] = useState<number>(5);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleEvaluateDiving = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/diving-hyperbaric/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: 2,
          diagnosis,
          diveDepthMsw,
          bottomTimeMin,
          timeToSymptomOnsetMin,
          symptoms: ['Neurologic deficits', 'Hemiplegia'],
          rapidAscentReported: true
        })
      });
      if (res.ok) setResult(await res.json());
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#1e293b', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#06b6d4', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>🤿</span> Phase 103: DIVING-HYPERBARIC (US Navy Recompression Tables)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '12px', marginBottom: '10px' }}>
            <label style={{ display: 'block', color: '#94a3b8', marginBottom: '4px' }}>DIVING DISORDER DIAGNOSIS</label>
            <select value={diagnosis} onChange={e => setDiagnosis(e.target.value)} style={{ width: '100%', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }}>
              <option value="ARTERIAL_GAS_EMBOLISM">Arterial Gas Embolism (AGE)</option>
              <option value="DCS_TYPE_II">Decompression Sickness Type II (Neurologic / Spinal)</option>
              <option value="DCS_TYPE_I">Decompression Sickness Type I (Pain-Only Bends)</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '12px', marginBottom: '14px' }}>
            <div>
              <span style={{ color: '#94a3b8' }}>Depth (msw):</span>
              <input type="number" value={diveDepthMsw} onChange={e => setDiveDepthMsw(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '4px', borderRadius: '4px' }} />
            </div>
            <div>
              <span style={{ color: '#94a3b8' }}>Time (min):</span>
              <input type="number" value={bottomTimeMin} onChange={e => setBottomTimeMin(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '4px', borderRadius: '4px' }} />
            </div>
            <div>
              <span style={{ color: '#94a3b8' }}>Onset (min):</span>
              <input type="number" value={timeToSymptomOnsetMin} onChange={e => setTimeToSymptomOnsetMin(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '4px', borderRadius: '4px' }} />
            </div>
          </div>

          <button
            onClick={handleEvaluateDiving}
            disabled={isLoading}
            style={{ width: '100%', backgroundColor: '#06b6d4', color: '#0f172a', fontWeight: 'bold', border: 'none', padding: '10px', borderRadius: '6px', cursor: 'pointer' }}
          >
            ⚓ Assign US Navy Chamber Treatment Table
          </button>
        </div>

        <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', padding: '12px' }}>
          {result ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>RECOMMENDED PROTOCOL</span>
                <span style={{ backgroundColor: '#0e7490', color: '#ffffff', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '11px' }}>
                  {result.recommendedTable}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', fontSize: '11px', marginBottom: '8px' }}>
                <div>Max Depth: <b>{result.maximumChamberDepthFsw} fsw ({result.maximumChamberPressureAta} ATA)</b></div>
                <div>Duration: <b>{result.totalChamberDurationMin} min</b></div>
                <div>O2 Periods: <b>{result.oxygenBreathingPeriodsCount} periods</b></div>
                <div style={{ color: '#ef4444' }}>Flight Ban: <b>{result.flyingBanHours} hours</b></div>
              </div>
              <div style={{ fontSize: '11px', color: '#cbd5e1' }}>
                {result.clinicalDirectives.map((d: string, idx: number) => (
                  <div key={idx} style={{ marginBottom: '4px' }}>• {d}</div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
              Select diving profile to compute recompression chamber parameters.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PHASE 104: TACTICAL-PROLONGED-FIELD-CARE SUB-HUB
// ============================================================================
export const ProlongedFieldCareHub: React.FC = () => {
  const [fieldHour, setFieldHour] = useState<number>(18);
  const [meanArterialPressure, setMeanArterialPressure] = useState<number>(58);
  const [hourlyUrineOutputMlKgH, setHourlyUrineOutputMlKgH] = useState<number>(0.3);
  const [coreTempCelsius, setCoreTempCelsius] = useState<number>(35.0);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleEvaluatePfc = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/prolonged-field-care/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: 3,
          fieldHour,
          systolicBp: 85,
          meanArterialPressure,
          hourlyUrineOutputMlKgH,
          coreTempCelsius,
          wholeBloodUnitsTransfused: 1,
          activeWarmingApplied: false,
          wbbDonorsAvailable: [
            { donorId: 'D1', name: 'SGT Miller', bloodType: 'O', rhFactor: '+', eldonCardVerified: true, transfusionStatus: 'AVAILABLE' }
          ]
        })
      });
      if (res.ok) setResult(await res.json());
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#1e293b', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#eab308', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>🪖</span> Phase 104: TACTICAL-PROLONGED-FIELD-CARE (PFC 72h Austere)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>PFC FIELD HOUR (0-72h)</label>
              <input type="number" value={fieldHour} onChange={e => setFieldHour(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>MAP (TARGET &ge; 65)</label>
              <input type="number" value={meanArterialPressure} onChange={e => setMeanArterialPressure(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>URINE OUTPUT (ML/KG/H)</label>
              <input type="number" step="0.1" value={hourlyUrineOutputMlKgH} onChange={e => setHourlyUrineOutputMlKgH(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8' }}>CORE TEMP (°C)</label>
              <input type="number" step="0.1" value={coreTempCelsius} onChange={e => setCoreTempCelsius(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px', borderRadius: '4px' }} />
            </div>
          </div>

          <button
            onClick={handleEvaluatePfc}
            disabled={isLoading}
            style={{ width: '100%', backgroundColor: '#eab308', color: '#0f172a', fontWeight: 'bold', border: 'none', padding: '10px', borderRadius: '6px', cursor: 'pointer' }}
          >
            🩸 Evaluate PFC Titration & Walking Blood Bank
          </button>
        </div>

        <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', padding: '12px' }}>
          {result ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>RESUSCITATION STATUS</span>
                <span style={{ backgroundColor: result.resuscitationStatus === 'HYPOTHERMIC_COAGULOPATHIC' ? '#7f1d1d' : '#854d0e', color: '#ffffff', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '11px' }}>
                  {result.resuscitationStatus}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#f59e0b', marginBottom: '8px' }}>{result.fluidTitrationDirective}</div>
              {result.wbbActivationMandated && (
                <div style={{ backgroundColor: '#7f1d1d', color: '#fca5a5', padding: '6px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', marginBottom: '8px' }}>
                  ⚠️ WALKING BLOOD BANK ACTIVATION MANDATED ({result.wbbEligibleDonorsCount} eligible donors)
                </div>
              )}
              {result.hypothermiaAlert && (
                <div style={{ color: '#ef4444', fontSize: '11px', marginBottom: '6px' }}>• {result.hypothermiaAlert}</div>
              )}
              <div style={{ fontSize: '11px', color: '#10b981' }}>• Antibiotic: {result.antibioticDirective}</div>
            </div>
          ) : (
            <div style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
              Input austere vital signs and urine output.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PHASE 105: CYBER-GRID-BLACKOUT SUB-HUB
// ============================================================================
export const CyberGridBlackoutHub: React.FC = () => {
  const [generatorFuelGallons, setGeneratorFuelGallons] = useState<number>(380);
  const [generatorLoadKw, setGeneratorLoadKw] = useState<number>(140);
  const [upsBatteryMinutes, setUpsBatteryMinutes] = useState<number>(85);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleEvaluateBlackout = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clinician/cyber-blackout/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: 'NODE-ICU-01',
          facilityZone: 'IntakeRx ICU & Surgical Wing',
          isGridPowerAvailable: false,
          generatorFuelGallons,
          generatorLoadKw,
          upsBatteryCapacityMinutes: upsBatteryMinutes,
          activeIcuVentilators: 12,
          ventilatorsOnPneumaticFallback: 6
        })
      });
      if (res.ok) setResult(await res.json());
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#1e293b', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#a855f7', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>⚡</span> Phase 105: CYBER-GRID-BLACKOUT (Zero-Trust Offline Resilience)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '12px', marginBottom: '14px' }}>
            <div>
              <span style={{ color: '#94a3b8' }}>Fuel (Gallons):</span>
              <input type="number" value={generatorFuelGallons} onChange={e => setGeneratorFuelGallons(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '4px', borderRadius: '4px' }} />
            </div>
            <div>
              <span style={{ color: '#94a3b8' }}>Load (kW):</span>
              <input type="number" value={generatorLoadKw} onChange={e => setGeneratorLoadKw(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '4px', borderRadius: '4px' }} />
            </div>
            <div>
              <span style={{ color: '#94a3b8' }}>UPS Battery (min):</span>
              <input type="number" value={upsBatteryMinutes} onChange={e => setUpsBatteryMinutes(Number(e.target.value))} style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '4px', borderRadius: '4px' }} />
            </div>
          </div>

          <button
            onClick={handleEvaluateBlackout}
            disabled={isLoading}
            style={{ width: '100%', backgroundColor: '#a855f7', color: '#ffffff', fontWeight: 'bold', border: 'none', padding: '10px', borderRadius: '6px', cursor: 'pointer' }}
          >
            🔒 Calculate Power Budget & Manual Gravity Drips
          </button>
        </div>

        <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', padding: '12px' }}>
          {result ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>ALERT LEVEL</span>
                <span style={{ backgroundColor: '#7e22ce', color: '#ffffff', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '11px' }}>
                  {result.systemAlertLevel}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#cbd5e1', marginBottom: '8px' }}>
                Est. Generator Runtime: <b style={{ color: '#22c55e' }}>{result.estimatedGeneratorRuntimeHours} hours</b>
              </div>
              <div style={{ fontSize: '11px', color: '#38bdf8', marginBottom: '8px' }}>
                Mesh Sync Hash: <code>{result.meshSyncState.syncHash}</code> ({result.meshSyncState.peerNodesConnected} peers verified)
              </div>
              <div style={{ fontSize: '11px', color: '#cbd5e1', borderTop: '1px solid #334155', paddingTop: '6px' }}>
                <b>Sample Gravity IV Drips (No electric pumps):</b>
                {result.sampleGravityDrips?.slice(0, 2).map((d: any, idx: number) => (
                  <div key={idx} style={{ color: '#94a3b8' }}>• {d.medicationName}: <b>{d.calculatedDripsPerMinute} gtt/min</b> ({d.secondsPerDrip}s/drop)</div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
              Simulate grid failure and offline mesh load shedding.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MASTER SUITE 6 UNIFIED WRAPPER
// ============================================================================
export const ExtremeMedicineSuiteHub: React.FC = () => {
  const [subTab, setSubTab] = useState<'mci' | 'flight' | 'diving' | 'pfc' | 'blackout'>('mci');

  return (
    <div style={{ backgroundColor: '#0f172a', color: '#f8fafc', padding: '24px', borderRadius: '12px', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <div style={{ borderBottom: '1px solid #334155', paddingBottom: '16px', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '24px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🛰️</span> Suite 6: Disaster, Flight & Extreme-Environment Medicine (Phases 101–105)
        </h2>
        <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '14px' }}>
          Mass-Casualty Incident Triage • Aeromedical Flight Critical Care • Diving Hyperbaric Tables • Prolonged Field Care (72h) • Zero-Trust Blackout Mesh
        </p>
      </div>

      {/* Sub-tab Navigation */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setSubTab('mci')}
          style={{
            backgroundColor: subTab === 'mci' ? '#ef4444' : '#1e293b',
            color: '#ffffff',
            fontWeight: 'bold',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          🚨 Phase 101: MCI Triage
        </button>
        <button
          onClick={() => setSubTab('flight')}
          style={{
            backgroundColor: subTab === 'flight' ? '#0ea5e9' : '#1e293b',
            color: '#ffffff',
            fontWeight: 'bold',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          🚁 Phase 102: Flight-Crit
        </button>
        <button
          onClick={() => setSubTab('diving')}
          style={{
            backgroundColor: subTab === 'diving' ? '#06b6d4' : '#1e293b',
            color: '#ffffff',
            fontWeight: 'bold',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          🤿 Phase 103: Diving-Hyperbaric
        </button>
        <button
          onClick={() => setSubTab('pfc')}
          style={{
            backgroundColor: subTab === 'pfc' ? '#eab308' : '#1e293b',
            color: '#0f172a',
            fontWeight: 'bold',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          🪖 Phase 104: Prolonged Field Care
        </button>
        <button
          onClick={() => setSubTab('blackout')}
          style={{
            backgroundColor: subTab === 'blackout' ? '#a855f7' : '#1e293b',
            color: '#ffffff',
            fontWeight: 'bold',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          ⚡ Phase 105: Cyber Blackout
        </button>
      </div>

      {subTab === 'mci' && <MassCasualtyTriageHub />}
      {subTab === 'flight' && <FlightCritHub />}
      {subTab === 'diving' && <DivingHyperbaricHub />}
      {subTab === 'pfc' && <ProlongedFieldCareHub />}
      {subTab === 'blackout' && <CyberGridBlackoutHub />}
    </div>
  );
};
