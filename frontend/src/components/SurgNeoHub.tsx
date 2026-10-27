import React, { useState, useEffect } from 'react';

interface ContraindicationAlert {
  intervention: string;
  hazard: string;
  absoluteContraindication: boolean;
}

interface ClinicalActionPlanStep {
  step: number;
  action: string;
  urgency: 'STAT_EMERGENT' | 'URGENT' | 'PRIORITY';
  rationale: string;
}

interface SurgicalEvaluationResult {
  emergencyType: 'CDH' | 'GASTROSCHISIS' | 'OMPHALOCELE' | 'TEF_EA' | 'NEC';
  bellStage?: string;
  surgicalUrgency: 'EMERGENT_OPERATING_ROOM' | 'URGENT_BEDSIDE_DRAIN' | 'STAGED_SILO_OR_REDUCTION' | 'CONSERVATIVE_MEDICAL_STABILIZATION';
  airwayVentStrategy: string;
  decompressionRegimen: string;
  fluidResuscitationTarget: string;
  antimicrobialRegimen?: string;
  contraindicatedInterventions: ContraindicationAlert[];
  syndromicAndCoAnomalyScreen: string[];
  clinicalActionPlan: ClinicalActionPlanStep[];
}

interface DecompressionMonitoringResult {
  decompressionEffective: boolean;
  suctionStatus: 'OPTIMAL_CONTINUOUS_DRAIN' | 'EXCESSIVE_PRESSURE_RISK' | 'INSUFFICIENT_SUCTION' | 'LUMEN_OCCLUSION_SUSPECTED';
  aspirateRiskAssessment: string;
  directives: string[];
}

export const SurgNeoHub: React.FC = () => {
  const [patientId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'surgical_evaluator' | 'decompression_tracker' | 'history'>('surgical_evaluator');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Tab 1: Surgical Evaluator State
  const [emergencyType, setEmergencyType] = useState<'CDH' | 'GASTROSCHISIS' | 'OMPHALOCELE' | 'TEF_EA' | 'NEC'>('CDH');
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState<number>(38.5);
  const [currentWeightGrams, setCurrentWeightGrams] = useState<number>(3200);

  // Clinical presentation
  const [scaphoidAbdomen, setScaphoidAbdomen] = useState<boolean>(true);
  const [bowelSoundsInChest, setBowelSoundsInChest] = useState<boolean>(true);
  const [excessiveDrooling, setExcessiveDrooling] = useState<boolean>(false);
  const [chokingWithFeeds, setChokingWithFeeds] = useState<boolean>(false);
  const [inabilityToPassNgt, setInabilityToPassNgt] = useState<boolean>(false);
  const [exposedViscera, setExposedViscera] = useState<boolean>(false);
  const [umbilicalCordOnSac, setUmbilicalCordOnSac] = useState<boolean>(false);
  const [sacRuptured, setSacRuptured] = useState<boolean>(false);
  const [abdominalDistention, setAbdominalDistention] = useState<boolean>(false);
  const [abdominalErythema, setAbdominalErythema] = useState<boolean>(false);
  const [grosslyBloodyStool, setGrosslyBloodyStool] = useState<boolean>(false);
  const [septicShock, setSepticShock] = useState<boolean>(false);

  // Radiographic findings
  const [bowelInChest, setBowelInChest] = useState<boolean>(true);
  const [coiledNgtPouch, setCoiledNgtPouch] = useState<boolean>(false);
  const [pneumatosis, setPneumatosis] = useState<boolean>(false);
  const [portalVenousGas, setPortalVenousGas] = useState<boolean>(false);
  const [pneumoperitoneumFreeAir, setPneumoperitoneumFreeAir] = useState<boolean>(false);

  // Labs
  const [plateletCount, setPlateletCount] = useState<number>(180000);
  const [serumLactate, setSerumLactate] = useState<number>(2.1);
  const [bloodPh, setBloodPh] = useState<number>(7.32);

  const [surgResult, setSurgResult] = useState<SurgicalEvaluationResult | null>(null);

  // Tab 2: Decompression Tracker State
  const [decompEmergency, setDecompEmergency] = useState<'CDH' | 'GASTROSCHISIS' | 'OMPHALOCELE' | 'TEF_EA' | 'NEC'>('CDH');
  const [replogleSizeFr, setReplogleSizeFr] = useState<number>(10);
  const [suctionPressureMmhg, setSuctionPressureMmhg] = useState<number>(-25);
  const [aspirateVolumeMl, setAspirateVolumeMl] = useState<number>(18);
  const [aspirateCharacter, setAspirateCharacter] = useState<string>('Bilio-viscous green drainage');
  const [abdominalExam, setAbdominalExam] = useState<string>('Soft, scaphoid, non-tender');
  const [abdominalGirthCm, setAbdominalGirthCm] = useState<number>(28);
  const [decompResult, setDecompResult] = useState<DecompressionMonitoringResult | null>(null);

  // Tab 3: History State
  const [surgHistory, setSurgHistory] = useState<any[]>([]);
  const [decompHistory, setDecompHistory] = useState<any[]>([]);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [resSurg, resDecomp] = await Promise.all([
        fetch(`/api/clinician/surgneo/evaluations/${patientId}`, { headers }),
        fetch(`/api/clinician/surgneo/decompression-logs/${patientId}`, { headers })
      ]);

      if (resSurg.ok) {
        const data = await resSurg.json();
        setSurgHistory(data);
      }
      if (resDecomp.ok) {
        const data = await resDecomp.json();
        setDecompHistory(data);
      }
    } catch (err) {
      console.error('Failed to fetch surgical history:', err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [patientId]);

  // Adjust defaults when changing emergency type
  const handleEmergencyTypeChange = (type: 'CDH' | 'GASTROSCHISIS' | 'OMPHALOCELE' | 'TEF_EA' | 'NEC') => {
    setEmergencyType(type);
    setDecompEmergency(type);
    if (type === 'CDH') {
      setScaphoidAbdomen(true);
      setBowelSoundsInChest(true);
      setBowelInChest(true);
      setExposedViscera(false);
      setUmbilicalCordOnSac(false);
      setPneumatosis(false);
      setPneumoperitoneumFreeAir(false);
      setCoiledNgtPouch(false);
    } else if (type === 'GASTROSCHISIS') {
      setExposedViscera(true);
      setUmbilicalCordOnSac(false);
      setScaphoidAbdomen(false);
      setBowelSoundsInChest(false);
      setBowelInChest(false);
      setPneumatosis(false);
      setPneumoperitoneumFreeAir(false);
      setCoiledNgtPouch(false);
    } else if (type === 'OMPHALOCELE') {
      setExposedViscera(false);
      setUmbilicalCordOnSac(true);
      setSacRuptured(false);
      setScaphoidAbdomen(false);
      setBowelSoundsInChest(false);
      setBowelInChest(false);
      setPneumatosis(false);
      setPneumoperitoneumFreeAir(false);
      setCoiledNgtPouch(false);
    } else if (type === 'TEF_EA') {
      setExcessiveDrooling(true);
      setChokingWithFeeds(true);
      setInabilityToPassNgt(true);
      setCoiledNgtPouch(true);
      setExposedViscera(false);
      setUmbilicalCordOnSac(false);
      setScaphoidAbdomen(false);
      setBowelSoundsInChest(false);
      setBowelInChest(false);
      setPneumatosis(false);
      setPneumoperitoneumFreeAir(false);
    } else if (type === 'NEC') {
      setAbdominalDistention(true);
      setAbdominalErythema(true);
      setGrosslyBloodyStool(true);
      setPneumatosis(true);
      setPortalVenousGas(true);
      setPneumoperitoneumFreeAir(false);
      setScaphoidAbdomen(false);
      setBowelSoundsInChest(false);
      setBowelInChest(false);
      setExposedViscera(false);
      setUmbilicalCordOnSac(false);
      setCoiledNgtPouch(false);
    }
  };

  // Handle Surgical Evaluation
  const handleEvaluateSurg = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/clinician/surgneo/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId,
          gestationalAgeWeeks,
          currentWeightGrams,
          emergencyType,
          clinicalPresentation: {
            scaphoidAbdomen,
            bowelSoundsInChest,
            excessiveSalivationDrooling: excessiveDrooling,
            chokingWithFeeds,
            inabilityToPassNgt,
            exposedEvisceratedBowel: exposedViscera,
            umbilicalCordOnSac,
            sacRuptured,
            abdominalDistention,
            abdominalErythemaOrDiscoloration: abdominalErythema,
            grosslyBloodyStools: grosslyBloodyStool,
            septicShockOrAcidosis: septicShock
          },
          radiographicFindings: {
            bowelLoopsInHemithorax: bowelInChest,
            coiledNgtInUpperPouch: coiledNgtPouch,
            pneumatosisIntestinalis: pneumatosis,
            portalVenousGas,
            pneumoperitoneumFreeAir
          },
          plateletCount: plateletCount || undefined,
          serumLactateMmolL: serumLactate || undefined,
          bloodPh: bloodPh || undefined,
          saveEvaluation: true
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Evaluation failed');
      }

      const data = await res.json();
      setSurgResult(data.evaluation);
      setStatusMessage('Neonatal surgical emergency evaluated and saved successfully.');
      fetchHistory();
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Decompression Monitoring
  const handleMonitorDecomp = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/clinician/surgneo/decompression/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId,
          emergencyType: decompEmergency,
          replogleSizeFr,
          suctionPressureMmhg,
          aspirateVolumeMl,
          aspirateCharacter,
          abdominalExam,
          abdominalGirthCm: abdominalGirthCm || undefined,
          saveLog: true
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Decompression monitoring failed');
      }

      const data = await res.json();
      setDecompResult(data.monitoring);
      setStatusMessage('Surgical decompression assessed and logged successfully.');
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
            <span className="text-3xl">👶</span>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              SURG-NEO: Neonatal Surgical Emergencies & Visceral Decompression
            </h1>
            <span className="px-2.5 py-1 text-xs font-semibold bg-pink-100 text-pink-800 dark:bg-pink-900/60 dark:text-pink-300 rounded-full">
              Phase 91
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Emergency Stabilization for CDH, Gastroschisis, Omphalocele, TEF/EA, and Necrotizing Enterocolitis (Bell's I-III) with Contraindication Sentinels
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="mt-4 md:mt-0 flex space-x-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('surgical_evaluator')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'surgical_evaluator'
                ? 'bg-white dark:bg-gray-700 text-pink-600 dark:text-pink-300 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            🩺 Surgical Evaluator
          </button>
          <button
            onClick={() => setActiveTab('decompression_tracker')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'decompression_tracker'
                ? 'bg-white dark:bg-gray-700 text-pink-600 dark:text-pink-300 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            🪠 Decompression Tracker
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'history'
                ? 'bg-white dark:bg-gray-700 text-pink-600 dark:text-pink-300 shadow-sm'
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

      {/* TAB 1: SURGICAL EVALUATOR */}
      {activeTab === 'surgical_evaluator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Input Panel */}
          <div className="lg:col-span-5 bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
              <span>🩺</span>
              <span>Neonatal Emergency Presentation</span>
            </h2>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Emergency Pathology Type
              </label>
              <select
                value={emergencyType}
                onChange={(e) => handleEmergencyTypeChange(e.target.value as any)}
                className="mt-1 block w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white font-semibold"
              >
                <option value="CDH">🫁 Congenital Diaphragmatic Hernia (CDH)</option>
                <option value="GASTROSCHISIS">🩹 Gastroschisis (Eviscerated Bowel)</option>
                <option value="OMPHALOCELE">🛡️ Omphalocele (Membrane-Covered Defect)</option>
                <option value="TEF_EA">管 Tracheoesophageal Fistula & Atresia (TEF/EA)</option>
                <option value="NEC">🦠 Necrotizing Enterocolitis (NEC Bell's I-III)</option>
              </select>
            </div>

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
                  Current Weight (grams)
                </label>
                <input
                  type="number"
                  value={currentWeightGrams}
                  onChange={(e) => setCurrentWeightGrams(parseInt(e.target.value) || 0)}
                  className="mt-1 block w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                />
                <span className="text-[10px] text-gray-400">
                  {currentWeightGrams < 1000 ? 'ELBW Micropreemie (< 1000g)' : 'VLBW / Term'}
                </span>
              </div>
            </div>

            {/* Path-specific Clinical Checkboxes */}
            <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                Clinical Signs
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {emergencyType === 'CDH' && (
                  <>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={scaphoidAbdomen}
                        onChange={(e) => setScaphoidAbdomen(e.target.checked)}
                        className="rounded text-pink-600"
                      />
                      <span>Scaphoid Abdomen</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={bowelSoundsInChest}
                        onChange={(e) => setBowelSoundsInChest(e.target.checked)}
                        className="rounded text-pink-600"
                      />
                      <span>Bowel Sounds in Chest</span>
                    </label>
                  </>
                )}

                {emergencyType === 'GASTROSCHISIS' && (
                  <>
                    <label className="flex items-center space-x-2 col-span-2">
                      <input
                        type="checkbox"
                        checked={exposedViscera}
                        onChange={(e) => setExposedViscera(e.target.checked)}
                        className="rounded text-pink-600"
                      />
                      <span>Eviscerated Bowel Lateral to Cord (No Sac)</span>
                    </label>
                  </>
                )}

                {emergencyType === 'OMPHALOCELE' && (
                  <>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={umbilicalCordOnSac}
                        onChange={(e) => setUmbilicalCordOnSac(e.target.checked)}
                        className="rounded text-pink-600"
                      />
                      <span>Cord Origin on Sac</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={sacRuptured}
                        onChange={(e) => setSacRuptured(e.target.checked)}
                        className="rounded text-pink-600"
                      />
                      <span className="text-rose-600 font-semibold">Sac Ruptured</span>
                    </label>
                  </>
                )}

                {emergencyType === 'TEF_EA' && (
                  <>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={excessiveDrooling}
                        onChange={(e) => setExcessiveDrooling(e.target.checked)}
                        className="rounded text-pink-600"
                      />
                      <span>Excessive Salivation / Drooling</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={chokingWithFeeds}
                        onChange={(e) => setChokingWithFeeds(e.target.checked)}
                        className="rounded text-pink-600"
                      />
                      <span>Coughing / Choking</span>
                    </label>
                    <label className="flex items-center space-x-2 col-span-2">
                      <input
                        type="checkbox"
                        checked={inabilityToPassNgt}
                        onChange={(e) => setInabilityToPassNgt(e.target.checked)}
                        className="rounded text-pink-600"
                      />
                      <span>Inability to pass NGT (coils ~9-11 cm)</span>
                    </label>
                  </>
                )}

                {emergencyType === 'NEC' && (
                  <>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={abdominalDistention}
                        onChange={(e) => setAbdominalDistention(e.target.checked)}
                        className="rounded text-pink-600"
                      />
                      <span>Abdominal Distention</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={abdominalErythema}
                        onChange={(e) => setAbdominalErythema(e.target.checked)}
                        className="rounded text-pink-600"
                      />
                      <span>Abdominal Wall Erythema</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={grosslyBloodyStool}
                        onChange={(e) => setGrosslyBloodyStool(e.target.checked)}
                        className="rounded text-pink-600"
                      />
                      <span>Grossly Bloody Stool</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={septicShock}
                        onChange={(e) => setSepticShock(e.target.checked)}
                        className="rounded text-pink-600"
                      />
                      <span className="text-rose-600 font-bold">Septic Shock / Acidosis</span>
                    </label>
                  </>
                )}
              </div>
            </div>

            {/* Radiographic Checkboxes */}
            <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                Radiographic Findings (CXR / AXR)
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {emergencyType === 'CDH' && (
                  <label className="flex items-center space-x-2 col-span-2">
                    <input
                      type="checkbox"
                      checked={bowelInChest}
                      onChange={(e) => setBowelInChest(e.target.checked)}
                      className="rounded text-pink-600"
                    />
                    <span>Bowel Loops in Hemithorax &amp; Mediastinal Shift</span>
                  </label>
                )}

                {emergencyType === 'TEF_EA' && (
                  <label className="flex items-center space-x-2 col-span-2">
                    <input
                      type="checkbox"
                      checked={coiledNgtPouch}
                      onChange={(e) => setCoiledNgtPouch(e.target.checked)}
                      className="rounded text-pink-600"
                    />
                    <span>Coiled Tube in Upper Esophageal Pouch</span>
                  </label>
                )}

                {emergencyType === 'NEC' && (
                  <>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={pneumatosis}
                        onChange={(e) => setPneumatosis(e.target.checked)}
                        className="rounded text-pink-600"
                      />
                      <span>Pneumatosis Intestinalis</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={portalVenousGas}
                        onChange={(e) => setPortalVenousGas(e.target.checked)}
                        className="rounded text-pink-600"
                      />
                      <span>Portal Venous Gas</span>
                    </label>
                    <label className="flex items-center space-x-2 col-span-2">
                      <input
                        type="checkbox"
                        checked={pneumoperitoneumFreeAir}
                        onChange={(e) => setPneumoperitoneumFreeAir(e.target.checked)}
                        className="rounded text-pink-600"
                      />
                      <span className="text-rose-600 font-bold">
                        Pneumoperitoneum (Rigler / Football Sign)
                      </span>
                    </label>
                  </>
                )}
              </div>
            </div>

            {/* Labs for NEC / Shock */}
            {emergencyType === 'NEC' && (
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700 grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-gray-500">Platelets (/mcL)</label>
                  <input
                    type="number"
                    value={plateletCount}
                    onChange={(e) => setPlateletCount(parseInt(e.target.value) || 0)}
                    className="mt-1 block w-full px-2 py-1 text-xs bg-gray-50 dark:bg-gray-900 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500">Lactate (mmol/L)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={serumLactate}
                    onChange={(e) => setSerumLactate(parseFloat(e.target.value) || 0)}
                    className="mt-1 block w-full px-2 py-1 text-xs bg-gray-50 dark:bg-gray-900 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500">pH</label>
                  <input
                    type="number"
                    step="0.01"
                    value={bloodPh}
                    onChange={(e) => setBloodPh(parseFloat(e.target.value) || 0)}
                    className="mt-1 block w-full px-2 py-1 text-xs bg-gray-50 dark:bg-gray-900 border rounded"
                  />
                </div>
              </div>
            )}

            <button
              onClick={handleEvaluateSurg}
              disabled={isLoading}
              className="w-full mt-2 py-2.5 px-4 bg-pink-600 hover:bg-pink-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-colors flex items-center justify-center space-x-2"
            >
              <span>{isLoading ? 'Processing...' : '⚡ Generate Surgical Resuscitation Plan'}</span>
            </button>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-7 space-y-4">
            {surgResult ? (
              <div className="space-y-4">
                {/* Urgency Badge */}
                <div
                  className={`p-5 rounded-xl border ${
                    surgResult.surgicalUrgency === 'EMERGENT_OPERATING_ROOM' || surgResult.surgicalUrgency === 'URGENT_BEDSIDE_DRAIN'
                      ? 'bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800'
                      : surgResult.surgicalUrgency === 'STAGED_SILO_OR_REDUCTION'
                      ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800'
                      : 'bg-sky-50 border-sky-200 dark:bg-sky-950/40 dark:border-sky-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400">
                        Surgical Management Directive
                      </span>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {surgResult.surgicalUrgency.replace(/_/g, ' ')}
                      </h3>
                      {surgResult.bellStage && (
                        <span className="inline-block mt-1 px-2.5 py-0.5 text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300 rounded-full">
                          Bell's Criteria: {surgResult.bellStage.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-mono font-bold text-gray-900 dark:text-white">
                        {surgResult.emergencyType}
                      </div>
                      <div className="text-xs text-gray-500">{currentWeightGrams}g ({gestationalAgeWeeks}w)</div>
                    </div>
                  </div>
                </div>

                {/* Absolute Contraindications Warning */}
                {surgResult.contraindicatedInterventions.length > 0 && (
                  <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl space-y-2">
                    <h4 className="text-xs font-bold text-rose-900 dark:text-rose-200 uppercase tracking-wider flex items-center space-x-1.5">
                      <span>⛔</span>
                      <span>CRITICAL RESUSCITATION CONTRAINDICATIONS</span>
                    </h4>
                    <div className="space-y-1.5">
                      {surgResult.contraindicatedInterventions.map((c, idx) => (
                        <div key={idx} className="p-2.5 bg-white/80 dark:bg-gray-900/80 rounded-lg text-xs">
                          <span className="font-bold text-rose-800 dark:text-rose-300">{c.intervention}:</span>{' '}
                          <span className="text-gray-700 dark:text-gray-300">{c.hazard}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Airway & Decompression Strategies */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase flex items-center space-x-1">
                      <span>🫁</span>
                      <span>Airway &amp; Ventilation Protocol</span>
                    </h4>
                    <p className="mt-1.5 text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                      {surgResult.airwayVentStrategy}
                    </p>
                  </div>

                  <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase flex items-center space-x-1">
                      <span>🪠</span>
                      <span>Replogle Decompression Regimen</span>
                    </h4>
                    <p className="mt-1.5 text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                      {surgResult.decompressionRegimen}
                    </p>
                  </div>
                </div>

                {/* Fluids & Antimicrobials */}
                <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm space-y-2">
                  <div className="text-xs">
                    <span className="font-bold text-gray-900 dark:text-white">💧 Fluid Resuscitation Target:</span>{' '}
                    <span className="text-gray-700 dark:text-gray-300">{surgResult.fluidResuscitationTarget}</span>
                  </div>
                  {surgResult.antimicrobialRegimen && (
                    <div className="text-xs pt-1 border-t border-gray-100 dark:border-gray-700">
                      <span className="font-bold text-gray-900 dark:text-white">💊 Antimicrobial Coverage:</span>{' '}
                      <span className="text-sky-700 dark:text-sky-300 font-mono">{surgResult.antimicrobialRegimen}</span>
                    </div>
                  )}
                </div>

                {/* Syndromic Screening */}
                {surgResult.syndromicAndCoAnomalyScreen.length > 0 && (
                  <div className="p-4 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl space-y-1.5">
                    <h4 className="text-xs font-bold text-purple-900 dark:text-purple-200 uppercase tracking-wider flex items-center space-x-1.5">
                      <span>🧬</span>
                      <span>Syndromic &amp; Co-Anomaly Screening Protocol</span>
                    </h4>
                    <ul className="list-disc list-inside text-xs text-purple-800 dark:text-purple-300 space-y-1">
                      {surgResult.syndromicAndCoAnomalyScreen.map((s, idx) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Step-by-Step Clinical Action Plan */}
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                    <span>⚡</span>
                    <span>Stat Resuscitation &amp; Surgical Action Plan</span>
                  </h4>
                  <div className="space-y-2">
                    {surgResult.clinicalActionPlan.map((p) => (
                      <div
                        key={p.step}
                        className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 flex items-start space-x-3"
                      >
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-pink-100 dark:bg-pink-900/60 text-pink-700 dark:text-pink-300 text-xs font-bold flex items-center justify-center">
                          {p.step}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-900 dark:text-white">
                              {p.action}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                p.urgency === 'STAT_EMERGENT'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                              }`}
                            >
                              {p.urgency}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                            {p.rationale}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[350px] flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-800/40 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-center">
                <span className="text-4xl">👶</span>
                <h3 className="mt-2 text-base font-medium text-gray-900 dark:text-white">
                  No Active Surgical Evaluation
                </h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-sm">
                  Select an emergency pathology type, specify clinical and radiographic markers, and click 'Generate Surgical Resuscitation Plan'.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DECOMPRESSION TRACKER */}
      {activeTab === 'decompression_tracker' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Input Panel */}
          <div className="lg:col-span-5 bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
              <span>🪠</span>
              <span>Replogle Tube &amp; Enteric Decompression Sentinel</span>
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Emergency Condition
                </label>
                <select
                  value={decompEmergency}
                  onChange={(e) => setDecompEmergency(e.target.value as any)}
                  className="mt-1 block w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-900 border rounded-lg text-gray-900 dark:text-white"
                >
                  <option value="CDH">CDH</option>
                  <option value="GASTROSCHISIS">Gastroschisis</option>
                  <option value="OMPHALOCELE">Omphalocele</option>
                  <option value="TEF_EA">TEF/EA</option>
                  <option value="NEC">NEC</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Replogle Size (Fr)
                </label>
                <select
                  value={replogleSizeFr}
                  onChange={(e) => setReplogleSizeFr(parseInt(e.target.value) || 10)}
                  className="mt-1 block w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-900 border rounded-lg text-gray-900 dark:text-white font-mono"
                >
                  <option value={8}>8 Fr (ELBW &lt; 1500g)</option>
                  <option value={10}>10 Fr (Standard &gt;= 1500g)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Suction Pressure (mmHg)
                </label>
                <input
                  type="number"
                  value={suctionPressureMmhg}
                  onChange={(e) => setSuctionPressureMmhg(parseInt(e.target.value) || 0)}
                  className="mt-1 block w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border rounded-lg text-gray-900 dark:text-white font-mono"
                />
                <span className="text-[10px] text-gray-400">Target: -20 to -30 mmHg</span>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Aspirate Volume (mL / 4h)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={aspirateVolumeMl}
                  onChange={(e) => setAspirateVolumeMl(parseFloat(e.target.value) || 0)}
                  className="mt-1 block w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border rounded-lg text-gray-900 dark:text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                Aspirate Character
              </label>
              <select
                value={aspirateCharacter}
                onChange={(e) => setAspirateCharacter(e.target.value)}
                className="mt-1 block w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border rounded-lg text-gray-900 dark:text-white"
              >
                <option value="Clear gastric secretions">Clear gastric secretions</option>
                <option value="Bilio-viscous green drainage">Bilio-viscous green drainage</option>
                <option value="Salivary secretions (upper pouch)">Salivary secretions (upper pouch)</option>
                <option value="Feculent drainage">Feculent drainage (distal obstruction)</option>
                <option value="Hemorrhagic / gross blood">Hemorrhagic / gross blood</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Abdominal Exam
                </label>
                <input
                  type="text"
                  value={abdominalExam}
                  onChange={(e) => setAbdominalExam(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-900 border rounded-lg text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Abdominal Girth (cm)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={abdominalGirthCm}
                  onChange={(e) => setAbdominalGirthCm(parseFloat(e.target.value) || 0)}
                  className="mt-1 block w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-900 border rounded-lg text-gray-900 dark:text-white font-mono"
                />
              </div>
            </div>

            <button
              onClick={handleMonitorDecomp}
              disabled={isLoading}
              className="w-full mt-2 py-2.5 px-4 bg-pink-600 hover:bg-pink-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-colors flex items-center justify-center space-x-2"
            >
              <span>{isLoading ? 'Assessing...' : '🔍 Evaluate Decompression & Suction Safety'}</span>
            </button>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-7 space-y-4">
            {decompResult ? (
              <div className="space-y-4">
                <div
                  className={`p-5 rounded-xl border ${
                    decompResult.suctionStatus === 'EXCESSIVE_PRESSURE_RISK' || !decompResult.decompressionEffective
                      ? 'bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800'
                      : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400">
                        Suction Status &amp; Efficacy
                      </span>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {decompResult.suctionStatus.replace(/_/g, ' ')}
                      </h3>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                        {decompResult.decompressionEffective ? '✅ Visceral decompression active & effective' : '⚠️ Suboptimal decompression or occlusion hazard'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Aspirate Assessment */}
                <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase flex items-center space-x-1.5">
                    <span>🧪</span>
                    <span>Enteric Aspirate Pathophysiology</span>
                  </h4>
                  <p className="mt-1.5 text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                    {decompResult.aspirateRiskAssessment}
                  </p>
                </div>

                {/* Directives List */}
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                    <span>📋</span>
                    <span>Clinical Directives &amp; Replogle Maintenance</span>
                  </h4>
                  <div className="space-y-2">
                    {decompResult.directives.map((dir, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border text-xs leading-relaxed ${
                          dir.includes('HAZARD') || dir.includes('STAT')
                            ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 font-semibold'
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
                <span className="text-4xl">🪠</span>
                <h3 className="mt-2 text-base font-medium text-gray-900 dark:text-white">
                  No Active Decompression Log Evaluated
                </h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-sm">
                  Enter Replogle tube size, suction manometer pressure, aspirate characteristics, and abdominal exam to check for mucosal adherence risks.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: LOGS & HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Surgical Evaluation Logs */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
              <span>🩺</span>
              <span>Past Surgical Emergency Assessments</span>
            </h3>
            {surgHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs text-left">
                  <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 uppercase border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-3 py-2">Timestamp</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Urgency</th>
                      <th className="px-3 py-2">Bell's Stage</th>
                      <th className="px-3 py-2">Weight</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {surgHistory.map((row) => (
                      <tr key={row.id}>
                        <td className="px-3 py-2 text-gray-500">
                          {new Date(row.evaluated_at).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 font-bold text-gray-900 dark:text-white">
                          {row.surgical_emergency_type}
                        </td>
                        <td className="px-3 py-2 font-medium">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              row.surgical_urgency.includes('OPERATING_ROOM') || row.surgical_urgency.includes('DRAIN')
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {row.surgical_urgency}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-purple-600 font-medium">
                          {row.bell_stage || 'N/A'}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {row.current_weight_grams}g
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-400">No past surgical evaluation records found for Patient #{patientId}.</p>
            )}
          </div>

          {/* Decompression Logs */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
              <span>🪠</span>
              <span>Past Decompression &amp; Enteric Drainage Logs</span>
            </h3>
            {decompHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs text-left">
                  <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 uppercase border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-3 py-2">Timestamp</th>
                      <th className="px-3 py-2">Replogle</th>
                      <th className="px-3 py-2">Suction (mmHg)</th>
                      <th className="px-3 py-2">Aspirate (mL)</th>
                      <th className="px-3 py-2">Character</th>
                      <th className="px-3 py-2">Effective</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {decompHistory.map((row) => (
                      <tr key={row.id}>
                        <td className="px-3 py-2 text-gray-500">
                          {new Date(row.logged_at).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {row.replogle_size_fr} Fr
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-gray-900 dark:text-white">
                          {row.suction_pressure_mmhg} mmHg
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {row.aspirate_volume_ml} mL
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {row.aspirate_character}
                        </td>
                        <td className="px-3 py-2 font-semibold">
                          {row.decompression_effective ? (
                            <span className="text-emerald-600">Yes</span>
                          ) : (
                            <span className="text-rose-600">No</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-400">No past decompression logs found for Patient #{patientId}.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SurgNeoHub;
