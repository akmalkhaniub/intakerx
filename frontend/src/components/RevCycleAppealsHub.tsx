import React, { useState, useEffect, useCallback } from 'react';
import {
  FileSpreadsheet,
  AlertOctagon,
  CheckCircle2,
  ShieldCheck,
  DollarSign,
  TrendingUp,
  FileText,
  AlertTriangle,
  Send,
  Sparkles,
  Layers
} from 'lucide-react';

export interface CptLineItem {
  code: string;
  description: string;
  modifiers?: string[];
  units: number;
  chargeCents: number;
}

export interface CciEdit {
  primaryCode: string;
  bundledCode: string;
  rationale: string;
  allowedWithModifier: boolean;
  recommendedModifier?: string;
}

export interface NcdLcdValidation {
  cptCode: string;
  isCovered: boolean;
  requiredIcd10Prefixes: string[];
  matchedIcd10?: string;
  rationale: string;
}

export interface ClaimRecord {
  id: number;
  patient_id: number;
  patient_name: string;
  claim_type: string;
  payer_name: string;
  total_billed_cents: number;
  status: 'scrubbed_clean' | 'flagged_pre_submission' | 'denied' | 'appealed' | 'adjudicated_paid';
  cpt_codes: CptLineItem[];
  icd10_codes: string[];
  cci_edits_detected: CciEdit[];
  ncd_lcd_compliance: boolean;
  denial_reason_code?: string;
  denial_reason_description?: string;
  appeal_id?: number;
  appeal_status?: string;
  created_at: string;
}

interface RevCycleAppealsHubProps {
  patientId?: number;
  sessionId?: string;
  token?: string;
  backendUrl?: string;
  patientName?: string;
}

export const RevCycleAppealsHub: React.FC<RevCycleAppealsHubProps> = ({
  patientId,
  sessionId,
  token,
  backendUrl = '',
  patientName = 'Encounter Patient'
}) => {
  const [activeTab, setActiveTab] = useState<'claims_ledger' | 'claim_scrubber' | 'appeal_writer'>('claims_ledger');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');

  // Claims List State
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // New Claim Form State
  const [payerName, setPayerName] = useState<string>('UnitedHealthcare Commercial');
  const [claimType, setClaimType] = useState<'CMS-1500' | 'UB-04'>('CMS-1500');
  const [cptList] = useState<CptLineItem[]>([
    { code: '99214', description: 'Office Visit Level 4 (Outpatient)', modifiers: ['25'], units: 1, chargeCents: 21500 },
    { code: '99451', description: 'Interprofessional e-Consultation', units: 1, chargeCents: 7500 },
    { code: '83036', description: 'Glycated Hemoglobin (HbA1c)', units: 1, chargeCents: 4200 }
  ]);
  const [icd10Input, setIcd10Input] = useState<string>('E11.22 Type 2 diabetes with diabetic nephropathy\nI10 Essential hypertension');
  const [scrubResult, setScrubResult] = useState<any | null>(null);

  // Appeal Letter State
  const [activeAppealClaim, setActiveAppealClaim] = useState<ClaimRecord | null>(null);
  const [appealContent, setAppealContent] = useState<string>('');
  const [appealId, setAppealId] = useState<number | null>(null);
  const [appealStatus, setAppealStatus] = useState<string>('');

  const fetchClaims = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/clinician/revcycle/claims?status=${statusFilter}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setClaims(data);
      }
    } catch (err) {
      console.error('Fetch claims error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [backendUrl, statusFilter, token]);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  const handleScrubClaim = async () => {
    setIsLoading(true);
    try {
      const icdLines = icd10Input.split('\n').map(s => s.trim()).filter(Boolean);
      const res = await fetch(`${backendUrl}/api/clinician/revcycle/scrub`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          cptCodes: cptList,
          icd10Codes: icdLines
        })
      });

      if (!res.ok) throw new Error('Scrub failed');
      const data = await res.json();
      setScrubResult(data);
      setStatusMsg(`Claim Scrubbed: Denial Risk = ${data.denialProbabilityPercent}%`);
    } catch (err: any) {
      console.error('Scrub error:', err);
      setStatusMsg('Error running pre-submission scrubber.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateClaim = async () => {
    if (!patientId) {
      setStatusMsg('Select an active patient encounter first.');
      return;
    }
    setIsLoading(true);
    try {
      const icdLines = icd10Input.split('\n').map(s => s.trim()).filter(Boolean);
      const res = await fetch(`${backendUrl}/api/clinician/revcycle/claims`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId,
          sessionId,
          claimType,
          payerName,
          cptCodes: cptList,
          icd10Codes: icdLines
        })
      });

      if (!res.ok) throw new Error('Claim submission failed');
      await fetchClaims();
      setActiveTab('claims_ledger');
      setStatusMsg('Claim successfully generated and added to revenue cycle ledger.');
    } catch (err: any) {
      console.error('Create claim error:', err);
      setStatusMsg('Failed to create claim.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSimulateDenial = async (claimId: number) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/clinician/revcycle/claims/${claimId}/simulate-denial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          denialCode: 'CO-50',
          denialDescription: 'Commercial Payer Medical Policy Bulletin: Service deemed not medically necessary.'
        })
      });

      if (!res.ok) throw new Error('Denial simulation failed');
      await fetchClaims();
      setStatusMsg(`Claim #${claimId} marked as Denied (CARC CO-50). Ready for AI appeal generation.`);
    } catch (err: any) {
      console.error('Denial simulation error:', err);
      setStatusMsg('Failed to simulate claim denial.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAppealWriter = async (claim: ClaimRecord) => {
    setActiveAppealClaim(claim);
    setActiveTab('appeal_writer');
    setIsLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/clinician/revcycle/claims/${claim.id}/generate-appeal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error('Appeal generation failed');
      const data = await res.json();
      setAppealId(data.id);
      setAppealContent(data.letter_content);
      setAppealStatus(data.status);
      setStatusMsg('Autonomous clinical appeal letter compiled with cited evidence guidelines.');
    } catch (err: any) {
      console.error('Generate appeal error:', err);
      setStatusMsg('Failed to draft appeal letter.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitAppeal = async () => {
    if (!appealId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/clinician/revcycle/appeals/${appealId}/submit`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error('Appeal submission failed');
      setAppealStatus('submitted');
      await fetchClaims();
      setStatusMsg('✔ Formal clinical appeal dispatched to payer grievance department.');
    } catch (err: any) {
      console.error('Submit appeal error:', err);
      setStatusMsg('Failed to submit appeal.');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scrubbed_clean':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-600';
      case 'denied':
        return 'bg-rose-950/80 text-rose-300 border-rose-600';
      case 'appealed':
        return 'bg-indigo-950/80 text-indigo-300 border-indigo-600';
      case 'adjudicated_paid':
        return 'bg-cyan-950/80 text-cyan-300 border-cyan-600';
      default:
        return 'bg-amber-950/80 text-amber-300 border-amber-600';
    }
  };

  return (
    <div className="bg-slate-900 text-slate-100 rounded-xl border border-slate-800 p-6 space-y-6 shadow-2xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold tracking-tight text-white">
              Zero-Click Revenue Cycle & Denial Appeals AI Engine
            </h2>
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              CMS-1500 • UB-04 • NCCI/CCI • NCD/LCD
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Autonomous institutional claim scrubbing, unbundling conflict prevention, and evidence-backed appeal letter drafting for <strong className="text-slate-200">{patientName}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchClaims}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            Refresh Ledger
          </button>
        </div>
      </div>

      {/* Notifications */}
      {statusMsg && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-700/50 rounded-lg text-xs text-emerald-200 flex items-center justify-between">
          <span>{statusMsg}</span>
          <button onClick={() => setStatusMsg('')} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* RevCycle HUD Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Total Ledger Volume</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">
              ${(claims.reduce((acc, c) => acc + c.total_billed_cents, 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">{claims.length} claims in revenue cycle ledger</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Clean Claim Pass Rate</span>
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-cyan-300">
              {claims.length > 0
                ? Math.round((claims.filter(c => c.status === 'scrubbed_clean' || c.status === 'adjudicated_paid').length / claims.length) * 100)
                : 96}%
            </span>
            <span className="text-xs text-cyan-400 font-bold">First-pass clean</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Passing NCCI & coverage rules</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Active Denial Exposure</span>
            <AlertOctagon className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-400">
              ${(claims.filter(c => c.status === 'denied').reduce((acc, c) => acc + c.total_billed_cents, 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Pending clinical reconsideration</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Appeals in Recovery</span>
            <TrendingUp className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-indigo-300">
              {claims.filter(c => c.status === 'appealed').length}
            </span>
            <span className="text-xs text-slate-400 font-medium">disputed claims</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">AI clinical appeal letters submitted</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 space-x-4">
        <button
          onClick={() => setActiveTab('claims_ledger')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'claims_ledger'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Claims & Adjudication Ledger ({claims.length})
        </button>
        <button
          onClick={() => setActiveTab('claim_scrubber')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'claim_scrubber'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          Pre-Submission Scrubber & CCI Checker
        </button>
        <button
          onClick={() => setActiveTab('appeal_writer')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'appeal_writer'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          AI Clinical Appeal Letter Writer
        </button>
      </div>

      {/* Tab 1: Claims Ledger */}
      {activeTab === 'claims_ledger' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex gap-2">
              {(['all', 'scrubbed_clean', 'denied', 'appealed'] as const).map(filter => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition ${
                    statusFilter === filter
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                  }`}
                >
                  {filter.replace('_', ' ')}
                </button>
              ))}
            </div>

            <button
              onClick={() => setActiveTab('claim_scrubber')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 text-xs font-semibold border border-emerald-500/40 transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Build & Scrub New Claim
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700">
                <tr>
                  <th className="p-3">Claim ID</th>
                  <th className="p-3">Patient</th>
                  <th className="p-3">Payer</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Billed</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Denial / Recovery</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {claims.map(claim => (
                  <tr key={claim.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-3 font-mono font-bold text-white">CLM-{claim.id.toString().padStart(5, '0')}</td>
                    <td className="p-3 font-medium text-slate-200">{claim.patient_name}</td>
                    <td className="p-3">{claim.payer_name}</td>
                    <td className="p-3">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-bold">
                        {claim.claim_type}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold text-emerald-400">
                      ${(claim.total_billed_cents / 100).toFixed(2)}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${getStatusBadge(claim.status)}`}>
                        {claim.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3">
                      {claim.denial_reason_code ? (
                        <div>
                          <span className="text-rose-400 font-bold">{claim.denial_reason_code}</span>
                          <p className="text-[10px] text-slate-400 truncate max-w-xs">{claim.denial_reason_description}</p>
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="p-3 text-right space-x-2">
                      {claim.status === 'scrubbed_clean' && (
                        <button
                          onClick={() => handleSimulateDenial(claim.id)}
                          className="px-2 py-1 text-[11px] font-semibold rounded bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 border border-rose-600/40 transition"
                        >
                          Simulate Denial
                        </button>
                      )}
                      {(claim.status === 'denied' || claim.status === 'appealed') && (
                        <button
                          onClick={() => handleOpenAppealWriter(claim)}
                          className="px-2 py-1 text-[11px] font-semibold rounded bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-1 inline-flex"
                        >
                          <FileText className="w-3 h-3" />
                          {claim.status === 'appealed' ? 'View Appeal' : 'Draft AI Appeal'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                {claims.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 text-sm">
                      No claims found matching current filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Pre-Submission Scrubber */}
      {activeTab === 'claim_scrubber' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-slate-800/50 border border-slate-700/80 rounded-lg p-4 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              Claim Configuration
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400">Target Insurance Payer</label>
                <input
                  type="text"
                  value={payerName}
                  onChange={(e) => setPayerName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 mt-1"
                />
              </div>

              <div>
                <label className="text-slate-400">Claim Standard Format</label>
                <select
                  value={claimType}
                  onChange={(e) => setClaimType(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 mt-1"
                >
                  <option value="CMS-1500">CMS-1500 (Professional / Physician Services)</option>
                  <option value="UB-04">UB-04 / CMS-1450 (Institutional / Hospital Services)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400">Documented ICD-10 Indications</label>
                <textarea
                  rows={4}
                  value={icd10Input}
                  onChange={(e) => setIcd10Input(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs font-mono text-slate-200 mt-1"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleScrubClaim}
                disabled={isLoading}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-2 px-3 rounded transition flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Scrub Line Items
              </button>
              <button
                onClick={handleCreateClaim}
                disabled={isLoading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-2 px-3 rounded transition flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Post to Ledger
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-800/50 border border-slate-700/80 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  Billed CPT Procedure Line Items
                </h3>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  Total: ${(cptList.reduce((sum, item) => sum + item.chargeCents, 0) / 100).toFixed(2)}
                </span>
              </div>

              <div className="space-y-2">
                {cptList.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-900/70 border border-slate-700/60 rounded flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-indigo-300">CPT {item.code}</span>
                        {item.modifiers && item.modifiers.map(m => (
                          <span key={m} className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                            Mod -{m}
                          </span>
                        ))}
                        <span className="font-semibold text-white">{item.description}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{item.units} unit(s) • Standard Fee Schedule</p>
                    </div>
                    <span className="font-mono font-bold text-emerald-400">${(item.chargeCents / 100).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Scrubber Diagnostics */}
              {scrubResult && (
                <div className="mt-4 p-4 bg-slate-900/80 rounded border border-slate-700 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-white">Scrubber Adjudication Probability</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${scrubResult.isValid ? 'bg-emerald-950 text-emerald-300 border-emerald-600' : 'bg-rose-950 text-rose-300 border-rose-600'}`}>
                      {scrubResult.denialProbabilityPercent}% Denial Risk
                    </span>
                  </div>

                  {scrubResult.cciEdits.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        NCCI Unbundling Edits Detected:
                      </span>
                      {scrubResult.cciEdits.map((e: CciEdit, i: number) => (
                        <div key={i} className="text-xs text-slate-300 bg-amber-950/20 p-2 rounded border border-amber-800/30">
                          <strong>Conflict:</strong> CPT {e.primaryCode} and {e.bundledCode} — {e.rationale}
                        </div>
                      ))}
                    </div>
                  )}

                  {scrubResult.recommendations.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <span className="text-xs font-bold text-indigo-300">Scrubber Corrections:</span>
                      <ul className="text-xs text-slate-300 list-disc list-inside space-y-0.5">
                        {scrubResult.recommendations.map((r: string, i: number) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: AI Appeal Letter Writer */}
      {activeTab === 'appeal_writer' && (
        <div className="bg-slate-800/50 border border-slate-700/80 rounded-lg p-6 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-700/60 pb-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                Autonomous Clinical Reconsideration & Appeal Compiler {activeAppealClaim && `(Claim #CLM-${activeAppealClaim.id.toString().padStart(5, '0')})`}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Citing clinical trial evidence, CMS NCD/LCD determinations, and ADA/AHA clinical consensus guidelines.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 text-xs font-bold uppercase rounded border ${appealStatus === 'submitted' ? 'bg-emerald-950 text-emerald-300 border-emerald-600' : 'bg-amber-950 text-amber-300 border-amber-600'}`}>
                {appealStatus || 'DRAFT'}
              </span>
              <button
                onClick={handleSubmitAppeal}
                disabled={isLoading || appealStatus === 'submitted'}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-1.5 px-3 rounded transition flex items-center gap-1.5 shadow"
              >
                <Send className="w-3.5 h-3.5" />
                {appealStatus === 'submitted' ? 'Appeal Submitted' : 'Submit Formal Appeal to Payer'}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <textarea
              rows={18}
              value={appealContent}
              onChange={(e) => setAppealContent(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-4 font-mono text-xs text-slate-200 leading-relaxed focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      )}
    </div>
  );
};
export default RevCycleAppealsHub;
