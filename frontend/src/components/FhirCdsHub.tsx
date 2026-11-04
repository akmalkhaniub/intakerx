import React, { useState, useEffect } from 'react';

interface CdsService {
  hook: string;
  title: string;
  description: string;
  id: string;
  prefetch?: Record<string, string>;
}

interface CdsCard {
  uuid?: string;
  summary: string;
  detail?: string;
  indicator: 'info' | 'warning' | 'critical';
  source: {
    label: string;
    url?: string;
    icon?: string;
  };
  suggestions?: Array<{
    label: string;
    uuid?: string;
    actions?: Array<{
      type: string;
      description: string;
    }>;
  }>;
  selectionBehavior?: string;
  overrideReasons?: Array<{ code: string; display: string }>;
}

export const FhirCdsHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'cds_sandbox' | 'fhir_resources' | 'conformance'>('cds_sandbox');
  const [patientId, setPatientId] = useState<number>(3); // Default to Bed 3 (Preeclampsia + Hemorrhage)
  const [cdsServices, setCdsServices] = useState<CdsService[]>([]);
  const [selectedHook, setSelectedHook] = useState<string>('order-select');
  const [orderQuery, setOrderQuery] = useState<string>('Methergine 0.2mg IM');
  const [cdsCards, setCdsCards] = useState<CdsCard[]>([]);
  const [fhirData, setFhirData] = useState<any>(null);
  const [fhirResourceType, setFhirResourceType] = useState<'Patient' | 'Observation' | 'Condition' | 'CarePlan' | 'Flag'>('Condition');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Fetch CDS Services Discovery
  useEffect(() => {
    fetch('/cds-services')
      .then(r => r.json())
      .then(data => {
        if (data.services) setCdsServices(data.services);
      })
      .catch(err => console.error('Failed to fetch CDS discovery:', err));
  }, []);

  // Fetch FHIR Resource
  const fetchFhirResource = async (type: string, id: number) => {
    setIsLoading(true);
    try {
      let url = `/api/fhir/r4/${type}?patient=${id}`;
      if (type === 'Patient') url = `/api/fhir/r4/Patient/${id}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setFhirData(json);
        setStatusMessage(`Retrieved FHIR R4 ${type} resource(s) for Patient #${id}.`);
      } else {
        setFhirData({ error: `HTTP ${res.status}: Failed to retrieve ${type}` });
      }
    } catch (err: any) {
      setFhirData({ error: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'fhir_resources') {
      fetchFhirResource(fhirResourceType, patientId);
    }
  }, [activeTab, fhirResourceType, patientId]);

  // Execute CDS Hook
  const handleExecuteCdsHook = async (serviceId: string) => {
    setIsLoading(true);
    setCdsCards([]);
    try {
      const payload = {
        hook: selectedHook,
        hookInstance: `test-inst-${Date.now()}`,
        context: {
          patientId: String(patientId),
          selections: [orderQuery],
          draftOrders: [{ name: orderQuery }]
        }
      };

      const res = await fetch(`/cds-services/${serviceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const json = await res.json();
        setCdsCards(json.cards || []);
        setStatusMessage(`CDS Service ${serviceId} executed. Returned ${json.cards?.length || 0} card(s).`);
      } else {
        setStatusMessage(`CDS Execution failed: HTTP ${res.status}`);
      }
    } catch (err: any) {
      setStatusMessage(`Error executing CDS Hook: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getIndicatorColor = (ind: string) => {
    if (ind === 'critical') return '#ef4444';
    if (ind === 'warning') return '#f97316';
    return '#38bdf8';
  };

  return (
    <div style={{ backgroundColor: '#0f172a', color: '#f8fafc', padding: '24px', borderRadius: '12px', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '16px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚡</span> SMART-on-FHIR R4 Bi-Directional Gateway & CDS Hooks 1.0 Provider
          </h2>
          <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '14px' }}>
            HL7 FHIR Release 4 Conformance (Patient, Observation, Condition, CarePlan, Flag) • CDS Hooks 1.0 Interceptor
          </p>
        </div>

        {/* Tab Controls */}
        <div style={{ display: 'flex', gap: '8px', backgroundColor: '#1e293b', padding: '4px', borderRadius: '8px' }}>
          <button
            onClick={() => setActiveTab('cds_sandbox')}
            style={{
              backgroundColor: activeTab === 'cds_sandbox' ? '#10b981' : 'transparent',
              color: activeTab === 'cds_sandbox' ? '#0f172a' : '#cbd5e1',
              fontWeight: 'bold',
              border: 'none',
              padding: '8px 14px',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            🛡️ CDS Hooks 1.0 Sandbox
          </button>
          <button
            onClick={() => setActiveTab('fhir_resources')}
            style={{
              backgroundColor: activeTab === 'fhir_resources' ? '#10b981' : 'transparent',
              color: activeTab === 'fhir_resources' ? '#0f172a' : '#cbd5e1',
              fontWeight: 'bold',
              border: 'none',
              padding: '8px 14px',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            📂 FHIR R4 Resources
          </button>
          <button
            onClick={() => setActiveTab('conformance')}
            style={{
              backgroundColor: activeTab === 'conformance' ? '#10b981' : 'transparent',
              color: activeTab === 'conformance' ? '#0f172a' : '#cbd5e1',
              fontWeight: 'bold',
              border: 'none',
              padding: '8px 14px',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            📜 CapabilityStatement
          </button>
        </div>
      </div>

      {/* Patient Selector Bar */}
      <div style={{ backgroundColor: '#1e293b', padding: '14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
        <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#cbd5e1' }}>SELECT ICU BED PATIENT:</span>
        <select
          value={patientId}
          onChange={(e) => setPatientId(Number(e.target.value))}
          style={{ backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '6px 12px', borderRadius: '6px', fontSize: '13px' }}
        >
          <option value={1}>Bed 1: Elena Rostova (Maternal Cardiac Arrest)</option>
          <option value={2}>Bed 2: Marcus Vance (Aortic Dissection vs Spinal Cord)</option>
          <option value={3}>Bed 3: Sophia Lin (Severe Preeclampsia + PPH Atony)</option>
          <option value={4}>Bed 4: David Miller (Burn Shock 45% TBSA + ACS IAP 25)</option>
          <option value={5}>Bed 5: Rachel Green (Status Asthmaticus + PPH Atony)</option>
          <option value={6}>Bed 6: Arthur Pendelton (Status Epilepticus)</option>
          <option value={8}>Bed 8: Gabriel Santos (TBI Herniation ICP 28)</option>
        </select>
        <span style={{ fontSize: '12px', color: '#94a3b8' }}>FHIR Identifier: urn:oid:intakerx:patients/PAT-{patientId}</span>
      </div>

      {statusMessage && (
        <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '10px 16px', borderRadius: '6px', color: '#10b981', fontSize: '13px', marginBottom: '20px' }}>
          ℹ️ {statusMessage}
        </div>
      )}

      {/* Tab 1: CDS Hooks Sandbox */}
      {activeTab === 'cds_sandbox' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
          {/* CDS Hook Dispatcher */}
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#10b981' }}>CDS Hooks Trigger Console</h3>
            
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>DISCOVERED CDS SERVICES (CDS Hooks 1.0)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {cdsServices.map((svc) => (
                  <div key={svc.id} style={{ backgroundColor: '#0f172a', border: '1px solid #334155', padding: '10px', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#38bdf8' }}>{svc.title}</span>
                      <span style={{ backgroundColor: '#334155', color: '#cbd5e1', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>
                        Hook: {svc.hook}
                      </span>
                    </div>
                    <p style={{ margin: '4px 0 8px 0', fontSize: '12px', color: '#94a3b8' }}>{svc.description}</p>
                    <button
                      onClick={() => {
                        setSelectedHook(svc.hook);
                        handleExecuteCdsHook(svc.id);
                      }}
                      disabled={isLoading}
                      style={{ backgroundColor: '#10b981', color: '#0f172a', fontWeight: 'bold', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
                    >
                      🚀 Fire Hook: {svc.id}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Simulated Pending Order Input for order-select */}
            <div style={{ borderTop: '1px solid #334155', paddingTop: '14px', marginTop: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#f59e0b', fontWeight: 'bold', marginBottom: '4px' }}>
                PENDING MEDICATION ORDER (For order-select Interception):
              </label>
              <input
                type="text"
                value={orderQuery}
                onChange={(e) => setOrderQuery(e.target.value)}
                placeholder="e.g. Methergine 0.2mg IM or Carboprost 250mcg IM"
                style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid #475569', padding: '8px', borderRadius: '6px', fontSize: '13px', marginBottom: '8px' }}
              />

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setPatientId(3);
                    setOrderQuery('Methylergonovine (Methergine) 0.2mg IM STAT');
                  }}
                  style={{ backgroundColor: '#334155', color: '#cbd5e1', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                >
                  ⚡ Preset: Methergine in Preeclampsia (Bed 3)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPatientId(5);
                    setOrderQuery('Carboprost (Hemabate) 250 mcg IM STAT');
                  }}
                  style={{ backgroundColor: '#334155', color: '#cbd5e1', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                >
                  ⚡ Preset: Carboprost in Asthma (Bed 5)
                </button>
              </div>

              <button
                onClick={() => {
                  setSelectedHook('order-select');
                  handleExecuteCdsHook('contraindication-order-select');
                }}
                disabled={isLoading}
                style={{ width: '100%', backgroundColor: '#f59e0b', color: '#0f172a', fontWeight: 'bold', border: 'none', padding: '10px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}
              >
                🔍 Intercept Order Against Active Patient State
              </button>
            </div>
          </div>

          {/* Returned CDS Cards View */}
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#cbd5e1' }}>
              Returned CDS Cards ({cdsCards.length})
            </h3>

            {cdsCards.length === 0 ? (
              <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>
                No active CDS cards returned. Fire a hook on the left to evaluate clinical state.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {cdsCards.map((card, idx) => {
                  const indColor = getIndicatorColor(card.indicator);
                  return (
                    <div
                      key={idx}
                      style={{
                        backgroundColor: '#0f172a',
                        border: `1.5px solid ${indColor}`,
                        borderLeft: `6px solid ${indColor}`,
                        borderRadius: '6px',
                        padding: '14px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '14px', color: indColor }}>
                          {card.summary}
                        </div>
                        <span style={{ backgroundColor: `${indColor}22`, color: indColor, padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                          {card.indicator.toUpperCase()}
                        </span>
                      </div>

                      {card.detail && (
                        <div style={{ fontSize: '12px', color: '#cbd5e1', whiteSpace: 'pre-line', margin: '8px 0', lineHeight: 1.5 }}>
                          {card.detail}
                        </div>
                      )}

                      {/* Suggestions */}
                      {card.suggestions && card.suggestions.length > 0 && (
                        <div style={{ marginTop: '10px', borderTop: '1px solid #334155', paddingTop: '8px' }}>
                          <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 'bold' }}>RECOMMENDED SAFE ALTERNATIVES:</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                            {card.suggestions.map((sugg, sIdx) => (
                              <button
                                key={sIdx}
                                onClick={() => setOrderQuery(sugg.label)}
                                style={{ backgroundColor: '#064e3b', color: '#6ee7b7', border: '1px solid #10b981', padding: '6px 10px', borderRadius: '4px', fontSize: '12px', textAlign: 'left', cursor: 'pointer' }}
                              >
                                ✅ {sugg.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Override reasons */}
                      {card.overrideReasons && card.overrideReasons.length > 0 && (
                        <div style={{ marginTop: '10px', fontSize: '11px', color: '#94a3b8' }}>
                          <span style={{ fontWeight: 'bold' }}>Permitted Clinical Override Reasons:</span>
                          <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                            {card.overrideReasons.map((r, rIdx) => (
                              <li key={rIdx}>{r.display} ({r.code})</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div style={{ marginTop: '8px', fontSize: '10px', color: '#64748b' }}>
                        Source: {card.source.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: FHIR R4 Resources Inspector */}
      {activeTab === 'fhir_resources' && (
        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '16px' }}>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
            {(['Patient', 'Observation', 'Condition', 'CarePlan', 'Flag'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFhirResourceType(type)}
                style={{
                  backgroundColor: fhirResourceType === type ? '#10b981' : '#0f172a',
                  color: fhirResourceType === type ? '#0f172a' : '#cbd5e1',
                  fontWeight: 'bold',
                  border: '1px solid #334155',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                {type}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', color: '#94a3b8' }}>
              Endpoint: <code style={{ color: '#38bdf8' }}>GET /api/fhir/r4/{fhirResourceType}?patient={patientId}</code>
            </span>
            <button
              onClick={() => fetchFhirResource(fhirResourceType, patientId)}
              disabled={isLoading}
              style={{ backgroundColor: '#334155', color: '#cbd5e1', border: 'none', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
            >
              🔄 Refresh
            </button>
          </div>

          <pre style={{ backgroundColor: '#090d16', padding: '16px', borderRadius: '8px', color: '#38bdf8', fontSize: '12px', overflowX: 'auto', maxHeight: '550px' }}>
            {JSON.stringify(fhirData, null, 2)}
          </pre>
        </div>
      )}

      {/* Tab 3: CapabilityStatement Conformance */}
      {activeTab === 'conformance' && (
        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '16px' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#10b981' }}>
            FHIR R4 CapabilityStatement (GET /api/fhir/r4/metadata)
          </h3>
          <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '14px' }}>
            Standard conformance metadata for EHR interoperability (Epic Systems, Cerner / Oracle Health, SMART Health IT).
          </p>
          <pre style={{ backgroundColor: '#090d16', padding: '16px', borderRadius: '8px', color: '#a7f3d0', fontSize: '12px', overflowX: 'auto', maxHeight: '550px' }}>
            {JSON.stringify(
              {
                resourceType: 'CapabilityStatement',
                id: 'intakerx-fhir-r4-gateway',
                status: 'active',
                fhirVersion: '4.0.1',
                software: { name: 'IntakeRx FHIR R4 Bi-Directional Gateway', version: '4.0.1-century-v1' },
                rest: [
                  {
                    mode: 'server',
                    security: { cors: true, service: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/restful-security-service', code: 'SMART-on-FHIR' }] }] },
                    resource: [
                      { type: 'Patient', interaction: [{ code: 'read' }, { code: 'search-type' }] },
                      { type: 'Observation', interaction: [{ code: 'read' }, { code: 'search-type' }] },
                      { type: 'Condition', interaction: [{ code: 'read' }, { code: 'search-type' }] },
                      { type: 'CarePlan', interaction: [{ code: 'read' }, { code: 'search-type' }] },
                      { type: 'Flag', interaction: [{ code: 'read' }, { code: 'search-type' }] }
                    ]
                  }
                ]
              },
              null,
              2
            )}
          </pre>
        </div>
      )}
    </div>
  );
};
