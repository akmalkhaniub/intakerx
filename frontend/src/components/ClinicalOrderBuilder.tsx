import React, { useState, useEffect } from 'react';
import { ClipboardList, CheckCircle, Plus, Download, Printer, RefreshCw, Zap } from 'lucide-react';

export interface OrderSuggestion {
  orderType: 'laboratory' | 'radiology' | 'cardiac_diagnostic' | 'nursing';
  codeSystem: 'LOINC' | 'CPT';
  code: string;
  displayName: string;
  clinicalIndication: string;
  urgency: 'stat' | 'urgent' | 'routine';
  patientPrepInstructions?: string;
}

export interface ClinicalOrder extends OrderSuggestion {
  id: number;
  sessionId: string;
  status: 'draft' | 'ordered' | 'completed' | 'cancelled';
  createdAt: string;
}

interface ClinicalOrderBuilderProps {
  sessionId?: string;
  token?: string;
  backendUrl?: string;
  patientName?: string;
}

export const ClinicalOrderBuilder: React.FC<ClinicalOrderBuilderProps> = ({
  sessionId,
  token,
  backendUrl = '',
  patientName = 'Howard Vance'
}) => {
  const [suggestions, setSuggestions] = useState<OrderSuggestion[]>([]);
  const [orders, setOrders] = useState<ClinicalOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [customIndication, setCustomIndication] = useState('');
  const [customUrgency, setCustomUrgency] = useState<'stat' | 'urgent' | 'routine'>('routine');
  const [customType, setCustomType] = useState<OrderSuggestion['orderType']>('laboratory');

  useEffect(() => {
    if (sessionId) {
      loadData();
    }
  }, [sessionId]);

  const loadData = async () => {
    if (!sessionId || !token) return;
    setIsLoading(true);
    try {
      // 1. Load active orders
      const ordRes = await fetch(`${backendUrl}/api/clinician/sessions/${sessionId}/orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (ordRes.ok) {
        const ordData = await ordRes.json();
        setOrders(ordData);
      }

      // 2. Load suggestions
      const sugRes = await fetch(`${backendUrl}/api/clinician/sessions/${sessionId}/orders/suggestions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (sugRes.ok) {
        const sugData = await sugRes.json();
        setSuggestions(sugData);
      }
    } catch (err) {
      console.error('Failed to load orders data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlaceOrder = async (suggestion: OrderSuggestion) => {
    if (!sessionId || !token) return;
    setIsOrdering(true);
    try {
      const res = await fetch(`${backendUrl}/api/clinician/sessions/${sessionId}/orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(suggestion)
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(prev => [...prev, data.order]);
        // Remove from suggestions
        setSuggestions(prev => prev.filter(s => s.code !== suggestion.code));
      }
    } catch (err) {
      console.error('Place order failed:', err);
    } finally {
      setIsOrdering(false);
    }
  };

  const handleApproveAll = async () => {
    if (!sessionId || !token || suggestions.length === 0) return;
    setIsOrdering(true);
    try {
      const res = await fetch(`${backendUrl}/api/clinician/sessions/${sessionId}/orders/batch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orders: suggestions })
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(prev => [...prev, ...data.orders]);
        setSuggestions([]);
      }
    } catch (err) {
      console.error('Batch approve failed:', err);
    } finally {
      setIsOrdering(false);
    }
  };

  const handleAddCustomOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !sessionId || !token) return;

    const newOrder: OrderSuggestion = {
      orderType: customType,
      codeSystem: 'LOINC',
      code: customCode.trim() || 'CUSTOM-01',
      displayName: customName.trim(),
      clinicalIndication: customIndication.trim() || 'Clinical indication specified by provider',
      urgency: customUrgency,
      patientPrepInstructions: 'Standard clinical prep'
    };

    await handlePlaceOrder(newOrder);
    setCustomName('');
    setCustomCode('');
    setCustomIndication('');
  };

  const handleExportFhir = async () => {
    if (!sessionId || !token) return;
    try {
      const res = await fetch(`${backendUrl}/api/clinician/sessions/${sessionId}/orders/fhir`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const bundle = await res.json();
        const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fhir-servicerequests-${sessionId.slice(0, 8)}.json`;
        a.click();
      }
    } catch (err) {
      console.error('Failed to export FHIR ServiceRequests:', err);
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'stat':
        return (
          <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid #ef4444', fontWeight: 'bold' }}>
            ● STAT
          </span>
        );
      case 'urgent':
        return (
          <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', border: '1px solid #f59e0b', fontWeight: 'bold' }}>
            ● URGENT
          </span>
        );
      default:
        return (
          <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid #60a5fa', fontWeight: 'bold' }}>
            ● ROUTINE
          </span>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Controls Banner */}
      <div style={{
        padding: '16px 20px',
        borderRadius: '12px',
        background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.6), rgba(15, 23, 42, 0.7))',
        border: '1px solid var(--glass-border)',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(59, 130, 246, 0.35)'
          }}>
            <ClipboardList size={22} color="white" />
          </div>
          <div>
            <h4 style={{ margin: 0, color: 'white', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Smart Clinical Orders & LOINC Requisitions
            </h4>
            <p style={{ margin: '3px 0 0', color: 'var(--text-muted)', fontSize: '12px' }}>
              Automated computerized physician order entry (CPOE) mapped to LOINC standard codes with FHIR ServiceRequest export.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleApproveAll}
            disabled={suggestions.length === 0 || isOrdering}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              border: 'none',
              color: 'white',
              cursor: suggestions.length > 0 ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 600,
              opacity: suggestions.length > 0 ? 1 : 0.5
            }}
          >
            <Zap size={14} /> Approve All AI Suggestions ({suggestions.length})
          </button>

          <button
            type="button"
            onClick={handleExportFhir}
            disabled={orders.length === 0}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--glass-border)',
              color: 'white',
              cursor: orders.length > 0 ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 600,
              opacity: orders.length > 0 ? 1 : 0.5
            }}
          >
            <Download size={14} /> FHIR ServiceRequest Bundle
          </button>

          <button
            type="button"
            onClick={loadData}
            style={{
              padding: '8px 10px',
              borderRadius: '8px',
              backgroundColor: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--text-muted)',
              cursor: 'pointer'
            }}
            title="Refresh order suggestions"
          >
            <RefreshCw size={14} style={{ animation: isLoading ? 'spin 1s linear infinite' : undefined }} />
          </button>
        </div>
      </div>

      {/* Main Grid: AI Suggestions vs Active Orders & Requisition Slip */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: '20px' }}>
        {/* Left: AI Suggestions Panel */}
        <div style={{
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          border: '1px solid var(--glass-border)',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '480px'
        }}>
          <div style={{
            padding: '12px 18px',
            borderBottom: '1px solid var(--glass-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.02)'
          }}>
            <strong style={{ fontSize: '13px', color: 'white' }}>
              🧠 Differential-Derived Order Suggestions ({suggestions.length})
            </strong>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>LOINC Standardized</span>
          </div>

          <div style={{ padding: '16px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {suggestions.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', margin: 'auto', padding: '30px' }}>
                <CheckCircle size={36} color="#10b981" style={{ margin: '0 auto 8px' }} />
                <p style={{ margin: 0, fontSize: '13px', color: 'white' }}>All suggested orders have been approved!</p>
                <p style={{ margin: '4px 0 0', fontSize: '11px' }}>
                  Use the manual entry form below to place any supplementary specialized orders.
                </p>
              </div>
            ) : (
              suggestions.map((sug, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '14px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--glass-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        {getUrgencyBadge(sug.urgency)}
                        <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>
                          {sug.codeSystem}: {sug.code}
                        </span>
                      </div>
                      <strong style={{ fontSize: '13px', color: 'white' }}>{sug.displayName}</strong>
                    </div>

                    <button
                      type="button"
                      onClick={() => handlePlaceOrder(sug)}
                      disabled={isOrdering}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        backgroundColor: '#2563eb',
                        border: 'none',
                        color: 'white',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Plus size={12} /> Approve
                    </button>
                  </div>

                  <p style={{ margin: 0, fontSize: '11px', color: '#cbd5e1' }}>
                    <strong>Indication:</strong> {sug.clinicalIndication}
                  </p>

                  {sug.patientPrepInstructions && (
                    <p style={{ margin: 0, fontSize: '10px', color: '#94a3b8', fontStyle: 'italic' }}>
                      📋 Prep: {sug.patientPrepInstructions}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Quick Custom Order Entry */}
          <form onSubmit={handleAddCustomOrder} style={{
            padding: '14px',
            borderTop: '1px solid var(--glass-border)',
            backgroundColor: 'rgba(255,255,255,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
              + ADD CUSTOM DIAGNOSTIC ORDER:
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={customType}
                onChange={e => setCustomType(e.target.value as any)}
                style={{ padding: '6px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid var(--glass-border)', color: 'white', fontSize: '12px' }}
              >
                <option value="laboratory">Laboratory</option>
                <option value="radiology">Radiology</option>
                <option value="cardiac_diagnostic">Cardiac Diagnostic</option>
                <option value="nursing">Nursing / Bedside</option>
              </select>

              <select
                value={customUrgency}
                onChange={e => setCustomUrgency(e.target.value as any)}
                style={{ padding: '6px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid var(--glass-border)', color: 'white', fontSize: '12px' }}
              >
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="stat">STAT</option>
              </select>

              <input
                type="text"
                placeholder="Order Name (e.g. Serum Ferritin)"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid var(--glass-border)', color: 'white', fontSize: '12px' }}
              />

              <button type="submit" className="btn" disabled={!customName.trim()} style={{ padding: '6px 12px', fontSize: '11px' }}>
                Add
              </button>
            </div>
          </form>
        </div>

        {/* Right: Active Encounter Orders & Printable Requisition Slip */}
        <div style={{
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          border: '1px solid var(--glass-border)',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '480px'
        }}>
          <div style={{
            padding: '12px 18px',
            borderBottom: '1px solid var(--glass-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.02)'
          }}>
            <strong style={{ fontSize: '13px', color: 'white' }}>
              📑 Approved Clinical Requisition Slip ({orders.length} orders placed)
            </strong>
            <button
              type="button"
              onClick={() => window.print()}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: 'rgba(255,255,255,0.08)',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px'
              }}
            >
              <Printer size={12} /> Print Requisition
            </button>
          </div>

          <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Requisition Header Badge */}
            <div style={{
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontWeight: 'bold', color: 'white', fontSize: '13px' }}>
                  Patient: {patientName}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Encounter: {sessionId ? sessionId.slice(0, 8) : 'Pending'} | Ordering Clinician: Dr. Smith, MD
                </div>
              </div>
              <span style={{ fontSize: '11px', color: '#60a5fa', fontWeight: 600 }}>
                Status: {orders.length > 0 ? 'Active Orders Transmitted' : 'Drafting'}
              </span>
            </div>

            {/* Orders Table */}
            {orders.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', margin: 'auto', padding: '30px' }}>
                <ClipboardList size={32} color="#64748b" style={{ margin: '0 auto 8px' }} />
                <p style={{ margin: 0, fontSize: '13px' }}>No diagnostic orders placed yet.</p>
                <p style={{ margin: '4px 0 0', fontSize: '11px' }}>
                  Click "Approve" on any AI recommendation on the left to include it on this requisition slip.
                </p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '8px 10px' }}>Code</th>
                    <th style={{ padding: '8px 10px' }}>Order Description</th>
                    <th style={{ padding: '8px 10px' }}>Urgency</th>
                    <th style={{ padding: '8px 10px' }}>Clinical Indication</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(ord => (
                    <tr key={ord.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px', color: '#a855f7', fontWeight: 600 }}>
                        {ord.code}
                      </td>
                      <td style={{ padding: '10px', color: 'white', fontWeight: 500 }}>
                        {ord.displayName}
                        {ord.patientPrepInstructions && (
                          <div style={{ fontSize: '10px', color: '#94a3b8', fontStyle: 'italic' }}>
                            Prep: {ord.patientPrepInstructions}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px' }}>
                        {getUrgencyBadge(ord.urgency)}
                      </td>
                      <td style={{ padding: '10px', color: '#cbd5e1', fontSize: '11px' }}>
                        {ord.clinicalIndication}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClinicalOrderBuilder;
