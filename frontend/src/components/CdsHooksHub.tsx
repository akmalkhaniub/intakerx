import React, { useState } from 'react';

interface CdsCardSuggestion {
  label: string;
  actions: { type: string; description: string }[];
}

interface CdsCardLink {
  label: string;
  url: string;
  type: string;
}

interface CdsCard {
  summary: string;
  detail?: string;
  indicator: 'info' | 'warning' | 'critical';
  source: { label: string; url?: string };
  suggestions?: CdsCardSuggestion[];
  links?: CdsCardLink[];
}

export const CdsHooksHub: React.FC = () => {
  const [patientId] = useState<number>(1);
  const [selectedHook, setSelectedHook] = useState<'patient-view' | 'order-select' | 'order-sign'>('patient-view');
  const [selectedMed, setSelectedMed] = useState<string>('Vancomycin 1g IV q12h');
  const [renalImpairment, setRenalImpairment] = useState<boolean>(true);
  const [orderName, setOrderName] = useState<string>('Meropenem 1g IV q8h');
  
  // Results
  const [cards, setCards] = useState<CdsCard[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [tokenResponse, setTokenResponse] = useState<any | null>(null);

  const invokeCdsHook = async () => {
    try {
      let contextPayload: any = {
        userId: 'Practitioner/dr-smith',
        patientId: String(patientId)
      };

      if (selectedHook === 'patient-view') {
        contextPayload.renalImpairment = renalImpairment;
      } else if (selectedHook === 'order-select') {
        contextPayload.draftOrders = { medicationName: selectedMed };
      } else if (selectedHook === 'order-sign') {
        contextPayload.draftOrders = [{ medicationName: orderName }];
      }

      const res = await fetch(`/api/clinician/cds-services/${selectedHook}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hook: selectedHook,
          hookInstance: `inst-${Date.now()}`,
          context: contextPayload
        })
      });

      if (res.ok) {
        const data = await res.json();
        setCards(data.cards || []);
        setStatusMessage(`CDS Hook '${selectedHook}' evaluated successfully (${data.cards?.length || 0} cards returned).`);
      }
    } catch (e: any) {
      setStatusMessage('Error invoking CDS Hook: ' + e.message);
    }
  };

  const simulateSmartLaunch = async () => {
    try {
      const res = await fetch('/api/clinician/smart/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: String(patientId),
          user_id: 'dr-smith',
          client_id: 'client-teleicu-bedside-v1',
          scope: 'launch/patient patient/*.read patient/Observation.write'
        })
      });
      if (res.ok) {
        const data = await res.json();
        setTokenResponse(data);
        setStatusMessage('SMART OAuth2 token exchanged successfully.');
      }
    } catch (e: any) {
      setStatusMessage('Error simulating SMART launch: ' + e.message);
    }
  };

  return (
    <div className="p-6 bg-slate-900 text-slate-100 rounded-xl shadow-2xl border border-slate-800 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg text-xl font-bold">⚡ CDS-HOOKS</span>
            <h2 className="text-2xl font-bold tracking-tight text-white">SMART-on-FHIR & CDS Hooks 2.0 Integration Hub</h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Enterprise EHR Clinical Decision Support, Hook Lifecycle Invocations, and SMART App Launch Protocol
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={simulateSmartLaunch}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-indigo-300 font-semibold rounded-lg shadow-md transition-colors text-sm"
          >
            Simulate SMART Token Launch
          </button>
          <button
            onClick={invokeCdsHook}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow-md transition-colors text-sm"
          >
            Invoke CDS Hook
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="px-4 py-2 bg-slate-800 border border-slate-700 text-xs text-indigo-300 rounded">
          {statusMessage}
        </div>
      )}

      {/* Simulator Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Hook Configuration */}
        <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700/80 space-y-3">
          <h3 className="text-sm font-semibold text-indigo-400 uppercase tracking-wider">Hook Trigger Configuration</h3>
          
          <div>
            <label className="text-xs text-slate-300 block mb-1">CDS Hook Type</label>
            <select
              value={selectedHook}
              onChange={(e) => setSelectedHook(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-sm text-white"
            >
              <option value="patient-view">patient-view (Chart Open & Surveillance)</option>
              <option value="order-select">order-select (Drug Selection & DDI)</option>
              <option value="order-sign">order-sign (Signing Validation & Stewardship)</option>
            </select>
          </div>

          {selectedHook === 'patient-view' && (
            <div className="space-y-2 pt-2 border-t border-slate-700/60">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={renalImpairment}
                  onChange={(e) => setRenalImpairment(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0"
                />
                Simulate eGFR &lt; 30 mL/min Renal Impairment
              </label>
            </div>
          )}

          {selectedHook === 'order-select' && (
            <div className="space-y-2 pt-2 border-t border-slate-700/60">
              <label className="text-xs text-slate-300 block mb-1">Draft Medication</label>
              <select
                value={selectedMed}
                onChange={(e) => setSelectedMed(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-sm text-white"
              >
                <option value="Vancomycin 1g IV q12h">Vancomycin 1g IV q12h (Narrow Therapeutic Index)</option>
                <option value="Gentamicin 5mg/kg IV q24h">Gentamicin 5mg/kg IV q24h (Oto/Nephrotoxic)</option>
                <option value="Amiodarone 150mg IV bolus">Amiodarone 150mg IV bolus (QTc prolonging)</option>
                <option value="Acetaminophen 650mg PO q6h">Acetaminophen 650mg PO q6h (Standard Tier 1)</option>
              </select>
            </div>
          )}

          {selectedHook === 'order-sign' && (
            <div className="space-y-2 pt-2 border-t border-slate-700/60">
              <label className="text-xs text-slate-300 block mb-1">Restricted Order Set</label>
              <select
                value={orderName}
                onChange={(e) => setOrderName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-sm text-white"
              >
                <option value="Meropenem 1g IV q8h">Meropenem 1g IV q8h (Restricted Carbapenem)</option>
                <option value="Linezolid 600mg IV q12h">Linezolid 600mg IV q12h (Restricted Oxazolidinone)</option>
                <option value="Lactated Ringers 100mL/hr">Lactated Ringers 100mL/hr (Standard Crystaloid)</option>
              </select>
            </div>
          )}
        </div>

        {/* Discovery Catalog Details */}
        <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700/80 space-y-3">
          <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider">CDS Catalog Registry</h3>
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded text-xs space-y-2">
            <div>
              <span className="text-indigo-400 font-semibold">Discovery URI:</span>
              <p className="font-mono text-slate-300">/api/clinician/cds-services</p>
            </div>
            <div>
              <span className="text-indigo-400 font-semibold">Active Services:</span>
              <p className="text-slate-300">3 Registered CDS Services (HL7 CDS Hooks 2.0)</p>
            </div>
            <div>
              <span className="text-indigo-400 font-semibold">EHR Interoperability:</span>
              <p className="text-slate-300">Epic Systems, Cerner Millennium, SMART on FHIR R4</p>
            </div>
            <div>
              <span className="text-indigo-400 font-semibold">Security:</span>
              <p className="text-slate-300">OAuth2 Bearer Token + OpenID Connect Discovery</p>
            </div>
          </div>
        </div>

        {/* SMART Token Output */}
        <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700/80 space-y-3">
          <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider">SMART OAuth2 Session</h3>
          {tokenResponse ? (
            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded text-xs space-y-1.5 font-mono text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">Token Type:</span>
                <span className="text-emerald-400">{tokenResponse.token_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Expires:</span>
                <span className="text-cyan-300">{tokenResponse.expires_in}s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Patient:</span>
                <span className="text-white">{tokenResponse.patient}</span>
              </div>
              <div className="truncate">
                <span className="text-slate-500">Access Token: </span>
                <span className="text-indigo-300">{tokenResponse.access_token}</span>
              </div>
              <div className="truncate">
                <span className="text-slate-500">Scopes: </span>
                <span className="text-amber-300">{tokenResponse.scope}</span>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-slate-950/50 rounded border border-slate-800/60 text-xs text-slate-500 text-center">
              No active SMART token session. Click 'Simulate SMART Token Launch' above.
            </div>
          )}
        </div>
      </div>

      {/* Decision Cards Rendering */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
          <span>Decision Support Cards</span>
          <span className="px-2 py-0.5 bg-slate-800 text-xs text-slate-400 rounded-full font-normal">
            {cards.length} returned
          </span>
        </h3>

        {cards.length === 0 ? (
          <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg text-sm">
            No CDS cards generated yet. Click 'Invoke CDS Hook' to trigger decision rules.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cards.map((card, idx) => {
              const isCrit = card.indicator === 'critical';
              const isWarn = card.indicator === 'warning';
              const borderClass = isCrit
                ? 'border-rose-600/70 bg-rose-950/30'
                : isWarn
                ? 'border-amber-600/70 bg-amber-950/30'
                : 'border-indigo-600/50 bg-slate-800/80';

              const badgeClass = isCrit
                ? 'bg-rose-600 text-white'
                : isWarn
                ? 'bg-amber-600 text-white'
                : 'bg-indigo-600 text-white';

              return (
                <div key={idx} className={`p-4 rounded-lg border ${borderClass} space-y-3 shadow-lg`}>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-sm text-white leading-snug">{card.summary}</h4>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase shrink-0 ${badgeClass}`}>
                      {card.indicator}
                    </span>
                  </div>

                  {card.detail && (
                    <p className="text-xs text-slate-300 leading-relaxed">{card.detail}</p>
                  )}

                  {card.suggestions && card.suggestions.length > 0 && (
                    <div className="pt-2 border-t border-slate-700/60 space-y-1.5">
                      <span className="text-[11px] font-semibold text-indigo-300 uppercase">Suggested Actions:</span>
                      {card.suggestions.map((sug, sIdx) => (
                        <div key={sIdx} className="p-2 bg-slate-900/80 rounded border border-slate-700/60 flex items-center justify-between text-xs">
                          <span className="text-slate-200">{sug.label}</span>
                          <button
                            type="button"
                            className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] rounded font-semibold"
                          >
                            Accept
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span>Source: {card.source.label}</span>
                    {card.links && card.links.length > 0 && (
                      <span className="text-cyan-400 hover:underline cursor-pointer">
                        {card.links[0].label} &rarr;
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
