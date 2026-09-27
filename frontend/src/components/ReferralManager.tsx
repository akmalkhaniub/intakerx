import React, { useState, useEffect, useCallback } from 'react';
import {
  GitPullRequest, Send, Calendar, CheckCircle2, Clock,
  MessageSquare, UserPlus, RefreshCw, FileText
} from 'lucide-react';

export interface SpecialistReferral {
  id: number;
  session_id: string;
  patient_id: number;
  specialty: string;
  priority: 'routine' | 'urgent' | 'emergent';
  reason_for_referral: string;
  provisional_diagnosis_code?: string;
  target_facility?: string;
  target_specialist?: string;
  status: 'submitted' | 'scheduled' | 'completed' | 'consult_note_returned';
  appointment_date?: string;
  consult_summary_notes?: string;
  specialist_signature?: string;
  created_at: string;
}

export interface EConsultRequest {
  id: number;
  session_id: string;
  patient_id: number;
  specialty: string;
  clinical_question: string;
  urgency: 'standard_48h' | 'stat_24h';
  specialist_response?: string;
  status: 'pending' | 'answered' | 'converted_to_in_person';
  cpt_billing_code: string;
  answered_at?: string;
  created_at: string;
}

interface ReferralManagerProps {
  sessionId?: string;
  patientId?: number;
  token?: string;
  backendUrl?: string;
  patientName?: string;
}

export const ReferralManager: React.FC<ReferralManagerProps> = ({
  sessionId,
  patientId,
  token,
  backendUrl = '',
  patientName = 'Encounter Patient'
}) => {
  const [activeTab, setActiveTab] = useState<'referrals' | 'econsults' | 'new_referral'>('referrals');
  const [referrals, setReferrals] = useState<SpecialistReferral[]>([]);
  const [eConsults, setEConsults] = useState<EConsultRequest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusSuccessMsg, setStatusSuccessMsg] = useState<string>('');

  // New Referral Form State
  const [specialty, setSpecialty] = useState<string>('Cardiology');
  const [priority, setPriority] = useState<'routine' | 'urgent' | 'emergent'>('routine');
  const [reason, setReason] = useState<string>('');
  const [diagCode, setDiagCode] = useState<string>('I25.10');
  const [facility, setFacility] = useState<string>('Regional Academic Medical Center');
  const [specialist, setSpecialist] = useState<string>('Next Available Specialist');

  // New e-Consult Form State
  const [eConsultSpecialty, setEConsultSpecialty] = useState<string>('Dermatology');
  const [clinicalQuestion, setClinicalQuestion] = useState<string>('');
  const [urgency, setUrgency] = useState<'standard_48h' | 'stat_24h'>('standard_48h');
  const [triageSuggestion, setTriageSuggestion] = useState<any | null>(null);

  // Specialist Response Simulation State
  const [selectedEConsultId, setSelectedEConsultId] = useState<number | null>(null);
  const [responseText, setResponseText] = useState<string>('');

  const fetchData = useCallback(async () => {
    if (!sessionId) return;
    setIsLoading(true);
    try {
      const [refRes, eRes] = await Promise.all([
        fetch(`${backendUrl}/api/clinician/referrals/session/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${backendUrl}/api/clinician/econsults/session/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (refRes.ok) setReferrals(await refRes.json());
      if (eRes.ok) setEConsults(await eRes.json());
    } catch (err) {
      console.error('Failed to load referrals/eConsults:', err);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, backendUrl, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) return;
    try {
      const res = await fetch(`${backendUrl}/api/clinician/referrals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          sessionId,
          patientId,
          specialty,
          priority,
          reasonForReferral: reason,
          provisionalDiagnosisCode: diagCode,
          targetFacility: facility,
          targetSpecialist: specialist
        })
      });
      if (res.ok) {
        setReason('');
        setActiveTab('referrals');
        await fetchData();
        setStatusSuccessMsg('Specialist referral submitted successfully!');
        setTimeout(() => setStatusSuccessMsg(''), 4000);
      }
    } catch (err) {
      console.error('Error submitting referral:', err);
    }
  };

  const handleTriageCheck = async (text: string) => {
    setClinicalQuestion(text);
    if (!text.trim() || text.length < 10) {
      setTriageSuggestion(null);
      return;
    }
    try {
      const res = await fetch(`${backendUrl}/api/clinician/econsults/triage-check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          specialty: eConsultSpecialty,
          clinicalContext: text
        })
      });
      if (res.ok) {
        const data = await res.json();
        setTriageSuggestion(data);
      }
    } catch (err) {
      console.error('Triage check error:', err);
    }
  };

  const handleCreateEConsult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !clinicalQuestion.trim()) return;
    try {
      const res = await fetch(`${backendUrl}/api/clinician/econsults`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          sessionId,
          patientId,
          specialty: eConsultSpecialty,
          clinicalQuestion,
          urgency
        })
      });
      if (res.ok) {
        setClinicalQuestion('');
        setTriageSuggestion(null);
        await fetchData();
        setStatusSuccessMsg('e-Consultation request submitted! Awaiting specialist response.');
        setTimeout(() => setStatusSuccessMsg(''), 4000);
      }
    } catch (err) {
      console.error('Error creating eConsult:', err);
    }
  };

  const handleRespondEConsult = async (eConsultId: number) => {
    if (!responseText.trim()) return;
    try {
      const res = await fetch(`${backendUrl}/api/clinician/econsults/${eConsultId}/respond`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          specialistResponse: responseText,
          convertToInPerson: false
        })
      });
      if (res.ok) {
        setSelectedEConsultId(null);
        setResponseText('');
        await fetchData();
        setStatusSuccessMsg('Specialist e-Consult response recorded and signed off!');
        setTimeout(() => setStatusSuccessMsg(''), 4000);
      }
    } catch (err) {
      console.error('Error responding to eConsult:', err);
    }
  };

  const handleAdvanceReferralStatus = async (
    referralId: number,
    nextStatus: 'scheduled' | 'consult_note_returned'
  ) => {
    try {
      const body: any = { status: nextStatus };
      if (nextStatus === 'scheduled') {
        body.appointmentDate = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString();
      } else if (nextStatus === 'consult_note_returned') {
        body.consultSummaryNotes = 'Specialist evaluation completed. Comprehensive management plan established and sent to referring provider.';
        body.specialistSignature = 'Dr. Robert Vance, MD (Attending)';
      }

      const res = await fetch(`${backendUrl}/api/clinician/referrals/${referralId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        await fetchData();
        setStatusSuccessMsg(`Referral updated to ${nextStatus.replace(/_/g, ' ')}!`);
        setTimeout(() => setStatusSuccessMsg(''), 4000);
      }
    } catch (err) {
      console.error('Error advancing referral status:', err);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-100 shadow-xl space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-sky-500/10 text-sky-400 rounded-lg border border-sky-500/20">
              <GitPullRequest className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold tracking-tight text-white">
              Closed-Loop Specialist Referrals &amp; e-Consults
            </h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            End-to-End Specialist Tracking • Asynchronous Interprofessional Review (CPT 99451) • Patient: <span className="text-sky-300 font-semibold">{patientName}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setActiveTab('new_referral')}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow-lg transition"
          >
            <UserPlus className="w-4 h-4" />
            New Referral
          </button>
        </div>
      </div>

      {statusSuccessMsg && (
        <div className="p-3 bg-sky-500/10 border border-sky-500/30 rounded-lg text-sky-300 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {statusSuccessMsg}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-6 text-sm">
        <button
          onClick={() => setActiveTab('referrals')}
          className={`pb-3 font-medium transition flex items-center gap-1.5 ${activeTab === 'referrals' ? 'text-sky-400 border-b-2 border-sky-500' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <span>Active Specialist Referrals</span>
          <span className="px-1.5 py-0.2 rounded-full text-xs font-bold bg-slate-800 text-slate-300">
            {referrals.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('econsults')}
          className={`pb-3 font-medium transition flex items-center gap-1.5 ${activeTab === 'econsults' ? 'text-sky-400 border-b-2 border-sky-500' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <span>Asynchronous e-Consults</span>
          <span className="px-1.5 py-0.2 rounded-full text-xs font-bold bg-sky-500/20 text-sky-400">
            {eConsults.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('new_referral')}
          className={`pb-3 font-medium transition ${activeTab === 'new_referral' ? 'text-sky-400 border-b-2 border-sky-500' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Submit Formal Referral
        </button>
      </div>

      {/* Tab 1: Formal Referrals List */}
      {activeTab === 'referrals' && (
        <div className="space-y-4">
          {referrals.length === 0 ? (
            <div className="p-8 text-center bg-slate-950/40 border border-slate-800 rounded-lg text-slate-400">
              <GitPullRequest className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="font-semibold text-white">No Outgoing Specialist Referrals</p>
              <p className="text-xs text-slate-500 mt-1">Submit a formal referral to initiate closed-loop tracking.</p>
            </div>
          ) : (
            referrals.map((r, idx) => (
              <div key={idx} className="p-4 bg-slate-950/60 border border-slate-800 rounded-lg space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-base">{r.specialty}</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold uppercase ${
                      r.priority === 'emergent' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                      r.priority === 'urgent' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                      'bg-slate-800 text-slate-300'
                    }`}>
                      {r.priority}
                    </span>
                    {r.provisional_diagnosis_code && (
                      <span className="text-xs font-mono bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-sky-300">
                        {r.provisional_diagnosis_code}
                      </span>
                    )}
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 ${
                      r.status === 'consult_note_returned' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                      r.status === 'scheduled' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      <Clock className="w-3 h-3" />
                      {r.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-300">
                  <span className="text-slate-400 font-semibold">Reason: </span>
                  {r.reason_for_referral}
                </p>

                <div className="text-xs text-slate-400 flex flex-wrap gap-4 pt-2 border-t border-slate-800/80">
                  <span>Facility: <strong className="text-slate-200">{r.target_facility}</strong></span>
                  <span>Specialist: <strong className="text-slate-200">{r.target_specialist}</strong></span>
                  {r.appointment_date && (
                    <span className="text-sky-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Appt: {new Date(r.appointment_date).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {r.consult_summary_notes && (
                  <div className="p-3 bg-slate-900 rounded border border-slate-800 text-xs text-emerald-300 space-y-1">
                    <div className="flex justify-between items-center text-slate-400">
                      <span className="font-semibold text-emerald-400">Specialist Return Consult Note:</span>
                      <span className="italic">{r.specialist_signature}</span>
                    </div>
                    <p className="leading-relaxed text-slate-200">{r.consult_summary_notes}</p>
                  </div>
                )}

                {/* Workflow Action Buttons */}
                <div className="flex gap-2 justify-end pt-1">
                  {r.status === 'submitted' && (
                    <button
                      onClick={() => handleAdvanceReferralStatus(r.id, 'scheduled')}
                      className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-semibold flex items-center gap-1 transition"
                    >
                      <Calendar className="w-3 h-3" />
                      Mark Scheduled
                    </button>
                  )}
                  {r.status === 'scheduled' && (
                    <button
                      onClick={() => handleAdvanceReferralStatus(r.id, 'consult_note_returned')}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center gap-1 transition"
                    >
                      <FileText className="w-3 h-3" />
                      Record Return Consult Note
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: Asynchronous e-Consults */}
      {activeTab === 'econsults' && (
        <div className="space-y-4">
          {/* Create eConsult Box */}
          <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4" />
              Request Asynchronous Specialist e-Consultation (CPT 99451)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Specialty</label>
                <select
                  value={eConsultSpecialty}
                  onChange={(e) => setEConsultSpecialty(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"
                >
                  <option value="Dermatology">Dermatology</option>
                  <option value="Cardiology">Cardiology</option>
                  <option value="Endocrinology">Endocrinology</option>
                  <option value="Neurology">Neurology</option>
                  <option value="Nephrology">Nephrology</option>
                  <option value="Gastroenterology">Gastroenterology</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Urgency</label>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"
                >
                  <option value="standard_48h">Standard (within 48 hours)</option>
                  <option value="stat_24h">Priority / STAT (within 24 hours)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Clinical Question / Case Presentation</label>
              <textarea
                value={clinicalQuestion}
                onChange={(e) => handleTriageCheck(e.target.value)}
                placeholder="e.g. 52-year-old male with persistent annular scaly plaque on trunk for 6 weeks. Non-pruritic, failed topical hydrocortisone. Suspect tinea corporis vs eczema. Recommended next-line topical agent?"
                rows={3}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Smart Triage Screener Badge */}
            {triageSuggestion && (
              <div className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                triageSuggestion.recommendedPathway === 'e_consult'
                  ? 'bg-sky-500/10 border-sky-500/30 text-sky-200'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
              }`}>
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold uppercase tracking-wider">
                    Smart Pathway: {triageSuggestion.recommendedPathway === 'e_consult' ? 'Appropriate for Asynchronous e-Consult' : 'Consider In-Person Referral'}
                  </span>
                  <p className="mt-0.5 text-slate-300">{triageSuggestion.rationale}</p>
                  <span className="font-mono text-xs opacity-75 mt-1 block">
                    Turnaround: ~{triageSuggestion.estimatedTurnaroundHours}h • CPT: {triageSuggestion.billingCode}
                  </span>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleCreateEConsult}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 transition"
              >
                <Send className="w-3.5 h-3.5" />
                Send e-Consult Request
              </button>
            </div>
          </div>

          {/* eConsults Stream */}
          <div className="space-y-3">
            {eConsults.map((ec, idx) => (
              <div key={idx} className="p-4 bg-slate-950/60 border border-slate-800 rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{ec.specialty}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 font-mono text-sky-400">
                      CPT {ec.cpt_billing_code}
                    </span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase ${
                    ec.status === 'answered' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {ec.status}
                  </span>
                </div>

                <p className="text-xs text-slate-300">
                  <span className="text-slate-400 font-semibold">Question: </span>
                  {ec.clinical_question}
                </p>

                {ec.specialist_response ? (
                  <div className="p-3 bg-emerald-950/30 rounded border border-emerald-500/30 text-xs text-emerald-200 mt-2">
                    <span className="font-bold block text-emerald-400 mb-1">Specialist Consultation Response:</span>
                    <p className="leading-relaxed">{ec.specialist_response}</p>
                    <span className="text-slate-400 text-xs mt-1 block">Answered: {new Date(ec.answered_at || '').toLocaleString()}</span>
                  </div>
                ) : (
                  <div className="pt-2 flex justify-end">
                    {selectedEConsultId === ec.id ? (
                      <div className="w-full space-y-2">
                        <textarea
                          value={responseText}
                          onChange={(e) => setResponseText(e.target.value)}
                          placeholder="Provide clinical diagnostic synthesis, recommended pharmacotherapy, and follow-up guidance..."
                          rows={2}
                          className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => setSelectedEConsultId(null)}
                            className="px-2.5 py-1 text-xs text-slate-400 hover:text-white"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleRespondEConsult(ec.id)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold"
                          >
                            Submit Response
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setSelectedEConsultId(ec.id)}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs transition"
                      >
                        Respond as Specialist
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Formal Referral Form */}
      {activeTab === 'new_referral' && (
        <form onSubmit={handleCreateReferral} className="bg-slate-950/60 p-5 rounded-lg border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Create Outpatient Specialist Referral Order
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Target Specialty</label>
              <select
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"
              >
                <option value="Cardiology">Cardiology</option>
                <option value="Oncology">Oncology</option>
                <option value="Orthopedics">Orthopedics</option>
                <option value="Neurology">Neurology</option>
                <option value="Gastroenterology">Gastroenterology</option>
                <option value="Dermatology">Dermatology</option>
                <option value="Nephrology">Nephrology</option>
                <option value="Pulmonology">Pulmonology</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Priority Tier</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"
              >
                <option value="routine">Routine (within 30 days)</option>
                <option value="urgent">Urgent (within 72 hours)</option>
                <option value="emergent">Emergent (within 24 hours)</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Provisional ICD-10 Code</label>
              <input
                type="text"
                value={diagCode}
                onChange={(e) => setDiagCode(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"
                placeholder="e.g. I25.10"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Target Facility</label>
              <input
                type="text"
                value={facility}
                onChange={(e) => setFacility(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Target Specialist / Provider</label>
              <input
                type="text"
                value={specialist}
                onChange={(e) => setSpecialist(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Reason for Referral &amp; Pertinent History</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="State clear clinical question, physical exam findings, prior conservative therapies attempted, and specific diagnostic/interventional procedure requested..."
              rows={3}
              className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-xs text-white focus:outline-none focus:border-sky-500"
              required
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('referrals')}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 transition"
            >
              <Send className="w-3.5 h-3.5" />
              Submit Referral Order
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default ReferralManager;
