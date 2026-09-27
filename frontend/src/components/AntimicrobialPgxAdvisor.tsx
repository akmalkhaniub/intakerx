import React, { useState, useEffect, useCallback } from 'react';
import {
  Dna, ShieldAlert, AlertTriangle, CheckCircle2,
  RefreshCw, Plus, Activity, ShieldCheck
} from 'lucide-react';

export interface PgxProfile {
  id?: number;
  patientId: number;
  gene: 'CYP2D6' | 'CYP2C19' | 'HLA-B*5701' | 'TPMT' | 'SLCO1B1' | 'DPYD';
  diplotype: string;
  phenotype: string;
  testDate?: string;
  labSource?: string;
}

export interface PgxAlert {
  gene: string;
  drug: string;
  patientDiplotype: string;
  patientPhenotype: string;
  severity: 'CRITICAL_CONTRAINDICATION' | 'DOSAGE_ADJUSTMENT_REQUIRED' | 'EFFICACY_WARNING' | 'INFORMATIONAL';
  cpicLevel: string;
  clinicalImpact: string;
  recommendedAlternative: string;
}

export interface StewardshipAdvice {
  infectionSite: string;
  firstLineRegimen: string;
  secondLineRegimen: string;
  antibiogramSusceptibility: string;
  durationDays: number;
  renalAdvice: {
    crClMlMin: number;
    renalImpairmentTier: string;
    isDoseAdjusted: boolean;
    dosageAdjustmentAdvice: string;
  };
  contraindications: string[];
}

interface AntimicrobialPgxAdvisorProps {
  sessionId?: string;
  patientId?: number;
  token?: string;
  backendUrl?: string;
  patientName?: string;
}

export const AntimicrobialPgxAdvisor: React.FC<AntimicrobialPgxAdvisorProps> = ({
  sessionId,
  patientId,
  token,
  backendUrl = '',
  patientName = 'Encounter Patient'
}) => {
  const [activeTab, setActiveTab] = useState<'stewardship' | 'pgx_profile' | 'screener'>('stewardship');
  const [profiles, setProfiles] = useState<PgxProfile[]>([]);
  const [infectionSite, setInfectionSite] = useState<string>('Uncomplicated UTI');
  const [serumCr, setSerumCr] = useState<string>('1.2');
  const [weightKg, setWeightKg] = useState<string>('70');
  const [stewardshipData, setStewardshipData] = useState<StewardshipAdvice | null>(null);
  const [pgxAlerts, setPgxAlerts] = useState<PgxAlert[]>([]);
  const [overallTier, setOverallTier] = useState<string>('SAFE');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [proposedMedInput, setProposedMedInput] = useState<string>('Codeine 30mg, Clopidogrel 75mg, Nitrofurantoin 100mg');

  // New Gene Modal / Input State
  const [showAddGene, setShowAddGene] = useState(false);
  const [newGene, setNewGene] = useState<'CYP2D6' | 'CYP2C19' | 'HLA-B*5701' | 'TPMT' | 'SLCO1B1'>('CYP2D6');
  const [newDiplotype, setNewDiplotype] = useState('*4/*4');
  const [newPhenotype, setNewPhenotype] = useState('Poor Metabolizer');

  const fetchPgxAndEvaluate = useCallback(async () => {
    if (!patientId) return;
    setIsLoading(true);
    try {
      // 1. Fetch profiles
      const profRes = await fetch(`${backendUrl}/api/clinician/pgx/profiles/${patientId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (profRes.ok) {
        const profList = await profRes.json();
        setProfiles(profList);
      }

      // 2. Evaluate
      const medsArray = proposedMedInput.split(',').map(m => m.trim()).filter(Boolean);
      const evalRes = await fetch(`${backendUrl}/api/clinician/antimicrobial/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId,
          sessionId,
          proposedMeds: medsArray,
          infectionSite,
          serumCrMgDl: serumCr,
          weightKg
        })
      });
      if (evalRes.ok) {
        const data = await evalRes.json();
        setStewardshipData(data.stewardshipAdvice);
        setPgxAlerts(data.pgxAlerts || []);
        setOverallTier(data.overallSafetyTier);
      }
    } catch (err) {
      console.error('Failed to evaluate antimicrobial/pgx:', err);
    } finally {
      setIsLoading(false);
    }
  }, [patientId, sessionId, backendUrl, token, proposedMedInput, infectionSite, serumCr, weightKg]);

  useEffect(() => {
    fetchPgxAndEvaluate();
  }, [fetchPgxAndEvaluate]);

  const handleAddGeneProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) return;
    try {
      const res = await fetch(`${backendUrl}/api/clinician/pgx/profiles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId,
          gene: newGene,
          diplotype: newDiplotype,
          phenotype: newPhenotype,
          labSource: 'Clinical NGS Panel'
        })
      });
      if (res.ok) {
        setShowAddGene(false);
        await fetchPgxAndEvaluate();
      }
    } catch (err) {
      console.error('Error adding PGx profile:', err);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-100 shadow-xl space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
              <Dna className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold tracking-tight text-white">
              Antimicrobial Stewardship &amp; Pharmacogenomics (PGx)
            </h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Antibiogram-Guided Regimens • Cockcroft-Gault Renal Clearance • CPIC Level 1A Precision Genomic Safety • Patient: <span className="text-emerald-300 font-semibold">{patientName}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border flex items-center gap-1.5 ${
            overallTier === 'CRITICAL_HAZARD' ? 'bg-red-500/10 text-red-400 border-red-500/30 animate-pulse' :
            overallTier === 'WARNING' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
            'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
          }`}>
            <Activity className="w-3.5 h-3.5" />
            {overallTier.replace('_', ' ')}
          </div>
          <button
            onClick={fetchPgxAndEvaluate}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Re-Evaluate
          </button>
        </div>
      </div>

      {/* Renal Clearance Parameter Strip */}
      <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
        <div>
          <label className="text-xs text-slate-400 block mb-1">Infection Site</label>
          <select
            value={infectionSite}
            onChange={(e) => setInfectionSite(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white"
          >
            <option value="Uncomplicated UTI">Uncomplicated UTI (Cystitis)</option>
            <option value="Community-Acquired Pneumonia">Community-Acquired Pneumonia (CAP)</option>
            <option value="Sepsis of Undetermined Source">Hospital Sepsis / Bacteremia</option>
            <option value="Cellulitis">Skin &amp; Soft Tissue (Cellulitis)</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1">Serum Creatinine (mg/dL)</label>
          <input
            type="number"
            step="0.1"
            value={serumCr}
            onChange={(e) => setSerumCr(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white"
          />
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1">Patient Weight (kg)</label>
          <input
            type="number"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white"
          />
        </div>

        <div className="bg-slate-900 p-2.5 rounded border border-slate-800 flex flex-col justify-center">
          <span className="text-xs text-slate-400">Calculated CrCl</span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-cyan-400">
              {stewardshipData?.renalAdvice.crClMlMin || '--'}
            </span>
            <span className="text-xs text-slate-400">mL/min</span>
          </div>
          <span className="text-xs text-amber-400 font-medium mt-0.5">
            {stewardshipData?.renalAdvice.renalImpairmentTier}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-6 text-sm">
        <button
          onClick={() => setActiveTab('stewardship')}
          className={`pb-3 font-medium transition ${activeTab === 'stewardship' ? 'text-emerald-400 border-b-2 border-emerald-500' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Antimicrobial Regimen &amp; Antibiogram
        </button>
        <button
          onClick={() => setActiveTab('screener')}
          className={`pb-3 font-medium transition flex items-center gap-1.5 ${activeTab === 'screener' ? 'text-emerald-400 border-b-2 border-emerald-500' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <span>PGx Gene-Drug Screener</span>
          {pgxAlerts.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30">
              {pgxAlerts.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('pgx_profile')}
          className={`pb-3 font-medium transition ${activeTab === 'pgx_profile' ? 'text-emerald-400 border-b-2 border-emerald-500' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Patient Genomic Profile ({profiles.length})
        </button>
      </div>

      {/* Tab 1: Antimicrobial Stewardship */}
      {activeTab === 'stewardship' && stewardshipData && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                1st Line Empiric Choice
              </span>
              <span className="text-xs text-slate-400">Duration: {stewardshipData.durationDays} days</span>
            </div>
            <p className="text-base font-semibold text-white font-mono">
              {stewardshipData.firstLineRegimen}
            </p>
            <p className="text-xs text-slate-400 bg-slate-900 p-2.5 rounded border border-slate-800">
              <span className="font-semibold text-slate-300">Local Antibiogram: </span>
              {stewardshipData.antibiogramSusceptibility}
            </p>
          </div>

          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-lg space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
              Alternative / 2nd Line Regimen
            </span>
            <p className="text-sm font-medium text-slate-300 font-mono">
              {stewardshipData.secondLineRegimen}
            </p>
          </div>

          {stewardshipData.renalAdvice.dosageAdjustmentAdvice && (
            <div className={`p-4 rounded-lg border ${
              stewardshipData.contraindications.length > 0
                ? 'bg-red-500/10 border-red-500/30 text-red-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            }`}>
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm">Renal Dosing &amp; Contraindication Notice</h4>
                  <p className="text-xs mt-1 leading-relaxed">
                    {stewardshipData.renalAdvice.dosageAdjustmentAdvice}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: PGx Screener */}
      {activeTab === 'screener' && (
        <div className="space-y-4">
          <div className="bg-slate-950/40 p-4 rounded-lg border border-slate-800 space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Screen Proposed Medications Against Genomic Variants
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={proposedMedInput}
                onChange={(e) => setProposedMedInput(e.target.value)}
                placeholder="e.g. Codeine, Clopidogrel, Abacavir, Simvastatin"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={fetchPgxAndEvaluate}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs transition"
              >
                Screen Meds
              </button>
            </div>
          </div>

          {pgxAlerts.length === 0 ? (
            <div className="p-8 text-center bg-slate-950/40 border border-slate-800 rounded-lg text-slate-400">
              <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="font-semibold text-white">Zero High-Risk Gene-Drug Toxicities Detected</p>
              <p className="text-xs text-slate-500 mt-1">
                Proposed medications are compatible with patient&apos;s current PGx profile.
              </p>
            </div>
          ) : (
            pgxAlerts.map((alert, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-lg border space-y-3 ${
                  alert.severity === 'CRITICAL_CONTRAINDICATION'
                    ? 'bg-red-950/40 border-red-500/40'
                    : 'bg-amber-950/40 border-amber-500/40'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className={`p-2 rounded-lg mt-0.5 ${
                      alert.severity === 'CRITICAL_CONTRAINDICATION' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      <ShieldAlert className="w-5 h-5" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white uppercase font-mono">
                          {alert.drug}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded font-mono bg-slate-900 text-cyan-300 border border-slate-800">
                          Gene: {alert.gene} ({alert.patientDiplotype})
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                          CPIC {alert.cpicLevel}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-red-300 mt-1">
                        Phenotype: {alert.patientPhenotype}
                      </p>
                    </div>
                  </div>

                  <span className={`text-xs uppercase font-bold px-2 py-1 rounded ${
                    alert.severity === 'CRITICAL_CONTRAINDICATION' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    {alert.severity.replace('_', ' ')}
                  </span>
                </div>

                <div className="pl-12 space-y-2 text-xs">
                  <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800 text-slate-300">
                    <span className="font-semibold text-slate-200">Clinical Impact: </span>
                    {alert.clinicalImpact}
                  </div>
                  <div className="bg-emerald-950/30 p-2.5 rounded border border-emerald-500/20 text-emerald-300">
                    <span className="font-semibold text-emerald-200">Safe Alternative Recommendation: </span>
                    {alert.recommendedAlternative}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Patient Genomic Profile */}
      {activeTab === 'pgx_profile' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
              Documented Genomic Variants ({profiles.length})
            </span>
            <button
              onClick={() => setShowAddGene(!showAddGene)}
              className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Variant Record
            </button>
          </div>

          {showAddGene && (
            <form onSubmit={handleAddGeneProfile} className="bg-slate-950/80 p-4 rounded-lg border border-slate-700 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Gene</label>
                <select
                  value={newGene}
                  onChange={(e) => setNewGene(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white"
                >
                  <option value="CYP2D6">CYP2D6</option>
                  <option value="CYP2C19">CYP2C19</option>
                  <option value="HLA-B*5701">HLA-B*5701</option>
                  <option value="TPMT">TPMT</option>
                  <option value="SLCO1B1">SLCO1B1</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Diplotype</label>
                <input
                  type="text"
                  value={newDiplotype}
                  onChange={(e) => setNewDiplotype(e.target.value)}
                  placeholder="e.g. *4/*4 or Positive"
                  className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Phenotype</label>
                <input
                  type="text"
                  value={newPhenotype}
                  onChange={(e) => setNewPhenotype(e.target.value)}
                  placeholder="e.g. Poor Metabolizer"
                  className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded text-xs transition"
              >
                Save Variant
              </button>
            </form>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {profiles.map((p, idx) => (
              <div key={idx} className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-mono font-bold text-white text-sm">{p.gene}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono">
                    {p.diplotype}
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-medium">{p.phenotype}</p>
                <div className="text-xs text-slate-500 pt-1 border-t border-slate-800 flex items-center justify-between">
                  <span>{p.labSource}</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AntimicrobialPgxAdvisor;
