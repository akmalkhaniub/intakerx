import React, { useState, useEffect } from 'react';
import { FileText, Play, CheckCircle2, AlertTriangle, ShieldCheck, HelpCircle, Edit3, ArrowRight, RotateCw, RefreshCw } from 'lucide-react';

interface ClinicianDashboardProps {
  backendUrl: string;
}

export default function ClinicianDashboard({ backendUrl }: ClinicianDashboardProps) {
  // Auth Simulation State
  const [token, setToken] = useState<string>(localStorage.getItem('intakerx_clinician_token') || '');
  const [clinician, setClinician] = useState<any>(JSON.parse(localStorage.getItem('intakerx_clinician_user') || 'null'));
  const [email, setEmail] = useState('dr.smith@clinic.com');
  const [password, setPassword] = useState('admin2026');
  const [authError, setAuthError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Dashboard Data State
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [sessionDetail, setSessionDetail] = useState<any | null>(null);
  
  // SOAP Edit State
  const [editChiefComplaint, setEditChiefComplaint] = useState('');
  const [editHpi, setEditHpi] = useState('');
  const [editPastHistory, setEditPastHistory] = useState('');
  const [editAllergies, setEditAllergies] = useState<string[]>([]);
  const [editMeds, setEditMeds] = useState<any[]>([]);
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // FHIR Export State
  const [showFhirModal, setShowFhirModal] = useState(false);
  const [fhirContent, setFhirContent] = useState('');
  const [fhirFormat, setFhirFormat] = useState<'json' | 'xml'>('json');
  const [isExporting, setIsExporting] = useState(false);

  // Clinical Decision Support State
  const [interactions, setInteractions] = useState<any[]>([]);
  const [isCheckingInteractions, setIsCheckingInteractions] = useState(false);

  // Sync token to storage
  useEffect(() => {
    if (token) {
      localStorage.setItem('intakerx_clinician_token', token);
      localStorage.setItem('intakerx_clinician_user', JSON.stringify(clinician));
      loadSessionsList();
    } else {
      localStorage.removeItem('intakerx_clinician_token');
      localStorage.removeItem('intakerx_clinician_user');
      setSessions([]);
      setSelectedSessionId('');
      setSessionDetail(null);
    }
  }, [token]);

  // Periodic polling for status changes (every 5 seconds)
  useEffect(() => {
    let interval: any;
    if (token) {
      interval = setInterval(() => {
        loadSessionsList();
        if (selectedSessionId) {
          loadSessionDetails(selectedSessionId, false); // silent refresh
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [token, selectedSessionId]);

  // Auth Handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsLoading(true);

    try {
      const res = await fetch(`${backendUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role: 'clinician' }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed.');

      setToken(data.token);
      setClinician(data.user);
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Data Fetching
  const loadSessionsList = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/intake/sessions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setSessions(data);
    } catch (err) {
      console.error('Failed to load sessions list:', err);
    }
  };

  const loadSessionDetails = async (id: string, showLoadingSpinner = true) => {
    if (showLoadingSpinner) setIsLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/intake/sessions/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSessionDetail(data);
      setSelectedSessionId(id);

      // Populate edit fields with summary data (fallback to defaults if summary not generated yet)
      const summary = data.summary?.summaryData || {};
      setEditChiefComplaint(summary.chiefComplaint || data.symptoms?.[0]?.name || '');
      setEditHpi(summary.historyOfPresentIllness || 'Chief complaint description: ' + (data.symptoms?.[0]?.name || 'Pending'));
      setEditPastHistory(summary.pastMedicalHistory || '');
      setEditAllergies(summary.allergies || []);
      setEditMeds(summary.medications || data.medications || []);
      setIsEditing(false);

      // Load active interactions
      await loadInteractions(id);
    } catch (err: any) {
      console.error(err);
      alert('Error loading session details: ' + err.message);
    } finally {
      if (showLoadingSpinner) setIsLoading(false);
    }
  };

  const loadInteractions = async (id: string) => {
    setIsCheckingInteractions(true);
    try {
      const res = await fetch(`${backendUrl}/api/clinician/sessions/${id}/interactions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setInteractions(data.alerts || []);
      }
    } catch (err) {
      console.error('Failed to load clinical interactions:', err);
    } finally {
      setIsCheckingInteractions(false);
    }
  };

  // SOAP Save
  const handleSaveSummary = async () => {
    setIsSaving(true);
    try {
      const summaryData = {
        ...sessionDetail.summary?.summaryData,
        chiefComplaint: editChiefComplaint,
        historyOfPresentIllness: editHpi,
        pastMedicalHistory: editPastHistory,
        allergies: editAllergies,
        medications: editMeds,
        triageLevel: sessionDetail.session.triageLevel,
        triageRationale: sessionDetail.session.triageRationale,
        redFlagsIdentified: sessionDetail.symptoms.filter((s: any) => s.isRedFlag).map((s: any) => s.name)
      };

      const res = await fetch(`${backendUrl}/api/clinician/sessions/${selectedSessionId}/summary`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ summaryData })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error);
      }

      setIsEditing(false);
      await loadSessionDetails(selectedSessionId);
      await loadSessionsList();
    } catch (err: any) {
      alert('Save failed: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // EHR Sync Handoff
  const handleSyncToEHR = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(`${backendUrl}/api/clinician/sessions/${selectedSessionId}/sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error);
      }

      // Refresh to update sync status indicator
      await loadSessionDetails(selectedSessionId);
    } catch (err: any) {
      alert('Sync enqueue failed: ' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // FHIR Export Handlers
  const handleExportFhir = async (format: 'json' | 'xml') => {
    setIsExporting(true);
    setFhirFormat(format);
    try {
      const res = await fetch(`${backendUrl}/api/clinician/sessions/${selectedSessionId}/fhir?format=${format}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to export FHIR bundle.');
      }

      if (format === 'json') {
        const data = await res.json();
        setFhirContent(JSON.stringify(data, null, 2));
      } else {
        const text = await res.text();
        setFhirContent(text);
      }
      setShowFhirModal(true);
    } catch (err: any) {
      alert('FHIR export failed: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadFhirFile = () => {
    const mimeType = fhirFormat === 'json' ? 'application/fhir+json' : 'application/fhir+xml';
    const blob = new Blob([fhirContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fhir-bundle-${selectedSessionId}.${fhirFormat}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(fhirContent);
    alert('Copied to clipboard!');
  };

  // Helpers for text diff indicators
  const renderFieldDiff = (fieldKey: string, currentValue: string) => {
    const original = sessionDetail?.summary?.summaryData?.[fieldKey] || '';
    if (currentValue === original) return null;
    return (
      <div style={styles.diffPanel}>
        <span style={styles.diffHeader}>Clinician Edit Preview:</span>
        <div style={styles.diffComparison}>
          <div style={styles.diffDeleted}>- {original || '(empty)'}</div>
          <div style={styles.diffAdded}>+ {currentValue}</div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%' }}>
      {!token ? (
        /* Clinician Authentication */
        <div style={styles.authContainer} className="glass-panel">
          <div style={styles.authHeader}>
            <span style={styles.authIcon}><ShieldCheck size={32} color="#10b981" /></span>
            <h2>Clinician Access Portal</h2>
            <p style={{ color: 'var(--text-muted)' }}>HIPAA Compliant Clinician Review Dashboard</p>
          </div>

          <form onSubmit={handleLogin} style={styles.form}>
            {authError && <div style={styles.errorAlert}>{authError}</div>}
            
            <div style={styles.formGroup}>
              <label>Clinician Email</label>
              <input type="email" className="input-text" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>

            <div style={styles.formGroup}>
              <label>Password</label>
              <input type="password" className="input-text" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>

            <button type="submit" className="btn" disabled={isLoading} style={{ width: '100%', marginTop: '10px' }}>
              {isLoading ? 'Authenticating...' : 'Access Clinician Panel'}
            </button>
          </form>
        </div>
      ) : (
        /* Clinician Workspace */
        <div style={styles.workspace}>
          {/* Left Panel: Sessions List */}
          <div style={styles.listSection} className="glass-panel">
            <div style={styles.sectionHeader}>
              <h3>Intake Sessions</h3>
              <button onClick={() => setToken('')} style={styles.signoutLink}>Portal Sign Out</button>
            </div>
            
            <div style={styles.sessionListScroll}>
              {sessions.length === 0 ? (
                <p style={styles.emptyListText}>No active patient intake sessions.</p>
              ) : (
                sessions.map(s => {
                  const isSelected = selectedSessionId === s.id;
                  const hasEmergency = s.triageLevel === 'emergency';
                  return (
                    <div 
                      key={s.id}
                      onClick={() => loadSessionDetails(s.id)}
                      style={{
                        ...styles.sessionRow,
                        backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.02)',
                        borderColor: isSelected 
                          ? '#3b82f6' 
                          : hasEmergency 
                            ? 'rgba(239, 68, 68, 0.4)' 
                            : 'var(--glass-border)',
                      }}
                      className={hasEmergency ? 'emergency-panel-glow' : ''}
                    >
                      <div style={styles.rowTop}>
                        <span style={styles.patientName}>{s.patientName}</span>
                        <span className={`triage-badge triage-${s.triageLevel}`}>
                          {s.triageLevel}
                        </span>
                      </div>
                      <div style={styles.rowMiddle}>
                        <span style={styles.dobText}>DOB: {new Date(s.patientDob).toLocaleDateString()}</span>
                        <span style={styles.stepBadge}>Step: {s.currentStep}</span>
                      </div>
                      <div style={styles.rowBottom}>
                        <span style={styles.timeText}>Updated: {new Date(s.updatedAt).toLocaleTimeString()}</span>
                        <span style={{
                          ...styles.statusDot,
                          backgroundColor: s.status === 'escalated' ? '#ef4444' : s.status === 'completed' ? '#10b981' : '#f59e0b'
                        }}></span>
                        <span style={styles.statusLabel}>{s.status}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Panel: Split Workspace details */}
          <div style={styles.detailSection}>
            {isLoading && (
              <div style={styles.spinnerOverlay}>
                <RefreshCw className="pulse-red" size={48} color="#3b82f6" />
                <p style={{ marginTop: '15px', color: 'var(--text-muted)' }}>Loading clinical patient workspace...</p>
              </div>
            )}

            {!sessionDetail ? (
              <div style={styles.emptyWorkspace} className="glass-panel">
                <FileText size={48} color="var(--text-muted)" />
                <h3>No Session Selected</h3>
                <p>Select a patient intake session from the list on the left to review logs, edit summaries, and push charts to the EHR system.</p>
              </div>
            ) : (
              <div style={styles.splitGrid}>
                {/* SOAP Editor workspace */}
                <div style={styles.soapWorkspace} className="glass-panel">
                  <div style={styles.workspaceHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={20} color="#3b82f6" />
                      <h3>Clinical Summary (SOAP Format)</h3>
                    </div>
                    
                    {!isEditing ? (
                      <button onClick={() => setIsEditing(true)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px' }}>
                        <Edit3 size={14} /> Edit Summary
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setIsEditing(false)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px' }}>Cancel</button>
                        <button onClick={handleSaveSummary} className="btn" disabled={isSaving} style={{ padding: '6px 12px', fontSize: '13px' }}>
                          {isSaving ? 'Saving...' : 'Save SOAP Note'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Form fields */}
                  <div style={styles.formWorkspaceScroll}>
                    {/* Clinical Decision Support Warnings */}
                    <div style={styles.cdsContainer}>
                      <div style={styles.cdsHeader}>
                        <ShieldCheck size={18} color={interactions.length > 0 ? '#f59e0b' : '#10b981'} />
                        <h4 style={{ margin: 0, fontSize: '14px', color: interactions.length > 0 ? '#f59e0b' : '#10b981' }}>Clinical Decision Support Alerts</h4>
                      </div>
                      
                      {isCheckingInteractions ? (
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, textAlign: 'left' }}>Evaluating clinical interactions...</p>
                      ) : interactions.length === 0 ? (
                        <div style={styles.cdsAlertOk}>
                          <CheckCircle2 size={16} color="#10b981" />
                          <span style={{ fontSize: '12px', color: '#10b981', textAlign: 'left' }}>
                            No drug-drug conflicts or allergen contraindications detected for this patient.
                          </span>
                        </div>
                      ) : (
                        <div style={styles.cdsAlertsList}>
                          {interactions.map((alert: any) => {
                            const isHigh = alert.severity === 'high';
                            return (
                              <div 
                                key={alert.ruleId} 
                                style={{
                                  ...styles.cdsAlertItem,
                                  borderColor: isHigh ? '#ef4444' : '#f59e0b',
                                  backgroundColor: isHigh ? 'rgba(239, 68, 68, 0.05)' : 'rgba(245, 158, 11, 0.05)'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ 
                                    ...styles.cdsAlertBadge, 
                                    backgroundColor: isHigh ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                    color: isHigh ? '#ef4444' : '#f59e0b'
                                  }}>
                                    {alert.severity.toUpperCase()} RISK
                                  </span>
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                    {alert.ruleType === 'drug_drug' ? 'Drug-Drug Conflict' : 'Allergy Contraindication'}
                                  </span>
                                </div>
                                <div style={{ fontWeight: 'bold', fontSize: '13px', marginTop: '6px', textAlign: 'left' }}>
                                  {alert.ruleType === 'drug_drug' 
                                    ? `${alert.triggerItem} + ${alert.conflictItem}`
                                    : `Allergen: ${alert.conflictItem} vs. Med: ${alert.triggerItem}`}
                                </div>
                                <p style={{ fontSize: '12px', margin: '4px 0 0 0', color: 'var(--text)', textAlign: 'left' }}>
                                  {alert.description}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div style={styles.formGroup}>
                      <label>Chief Complaint</label>
                      <input 
                        type="text" 
                        className="input-text" 
                        value={editChiefComplaint} 
                        onChange={e => setEditChiefComplaint(e.target.value)} 
                        disabled={!isEditing} 
                      />
                      {isEditing && renderFieldDiff('chiefComplaint', editChiefComplaint)}
                    </div>

                    <div style={styles.formGroup}>
                      <label>History of Present Illness (HPI)</label>
                      <textarea 
                        className="input-text" 
                        style={styles.textarea} 
                        value={editHpi} 
                        onChange={e => setEditHpi(e.target.value)} 
                        disabled={!isEditing}
                      />
                      {isEditing && renderFieldDiff('historyOfPresentIllness', editHpi)}
                    </div>

                    <div style={styles.formGroup}>
                      <label>Past Medical History</label>
                      <textarea 
                        className="input-text" 
                        style={styles.textarea} 
                        value={editPastHistory} 
                        onChange={e => setEditPastHistory(e.target.value)} 
                        disabled={!isEditing}
                      />
                      {isEditing && renderFieldDiff('pastMedicalHistory', editPastHistory)}
                    </div>

                    <div style={styles.formRow}>
                      <div style={styles.formGroup}>
                        <label>Triage Rationale</label>
                        <div style={styles.rationaleContainer}>
                          <p style={{ fontSize: '13px' }}>{sessionDetail.session.triageRationale || 'No rationale logged.'}</p>
                        </div>
                      </div>
                    </div>

                    {/* EHR Sync Action Block */}
                    {sessionDetail.summary && (
                      <div style={styles.syncContainer} className="glass-panel">
                        <div style={styles.syncStatusBlock}>
                          <span>EHR Handoff Status:</span>
                          <span style={{ 
                            ...styles.syncStatusBadge,
                            backgroundColor: sessionDetail.summary.status === 'synced' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                            color: sessionDetail.summary.status === 'synced' ? '#10b981' : '#f59e0b',
                            borderColor: sessionDetail.summary.status === 'synced' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'
                          }}>
                            {sessionDetail.summary.status.toUpperCase()}
                          </span>
                        </div>
                        {sessionDetail.summary.ehrSyncId && (
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                            Ingestion Confirmation ID: <strong>{sessionDetail.summary.ehrSyncId}</strong>
                          </div>
                        )}
                        
                        {sessionDetail.summary.status !== 'synced' && (
                          <button 
                            onClick={handleSyncToEHR} 
                            className="btn" 
                            disabled={isSyncing || sessionDetail.summary.status === 'syncing'}
                            style={{ width: '100%' }}
                          >
                            <Play size={16} /> Sync SOAP to patient EHR portal
                          </button>
                        )}

                        <div style={styles.fhirActionsRow}>
                          <button 
                            onClick={() => handleExportFhir('json')} 
                            className="btn btn-secondary" 
                            disabled={isExporting}
                            style={styles.fhirBtn}
                          >
                            {isExporting && fhirFormat === 'json' ? 'Exporting...' : 'Export FHIR JSON'}
                          </button>
                          <button 
                            onClick={() => handleExportFhir('xml')} 
                            className="btn btn-secondary" 
                            disabled={isExporting}
                            style={styles.fhirBtn}
                          >
                            {isExporting && fhirFormat === 'xml' ? 'Exporting...' : 'Export FHIR XML'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dialog Transcript panel */}
                <div style={styles.transcriptWorkspace} className="glass-panel">
                  <div style={styles.workspaceHeader}>
                    <h3>Dialogue Log & Audits</h3>
                  </div>

                  <div style={styles.transcriptScroll}>
                    {sessionDetail.messages.map((m: any, idx: number) => {
                      const isAgent = m.sender === 'agent';
                      const isFlagged = m.wasFlagged;
                      const isBlocked = m.blockedByGuardrail;
                      
                      return (
                        <div key={idx} style={{
                          ...styles.transcriptRow,
                          borderLeft: isBlocked 
                            ? '3px solid #ef4444' 
                            : isFlagged 
                              ? '3px solid #f59e0b' 
                              : '3px solid transparent',
                          backgroundColor: isBlocked 
                            ? 'rgba(239, 68, 68, 0.05)' 
                            : isFlagged 
                              ? 'rgba(245, 158, 11, 0.05)'
                              : 'transparent'
                        }}>
                          <div style={styles.transcriptMeta}>
                            <span style={{ 
                              fontWeight: 'bold',
                              color: isAgent ? '#60a5fa' : '#c084fc'
                            }}>
                              {isAgent ? 'AI Nurse' : 'Patient'}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {new Date(m.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                          
                          <p style={{ fontSize: '13px', margin: '4px 0 0 0' }}>{m.content}</p>
                          
                          {isBlocked && (
                            <span style={styles.safetyFlagBadge}>
                              🚨 Prompt Injection Blocked
                            </span>
                          )}
                          {isFlagged && !isBlocked && (
                            <span style={{ ...styles.safetyFlagBadge, color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.2)' }}>
                              ⚠️ Emergency Red Flag Triggered
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showFhirModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent} className="glass-panel">
            <div style={styles.modalHeader}>
              <h4 style={{ margin: 0, fontSize: '15px' }}>HL7 FHIR R4 Bundle Export Preview ({fhirFormat.toUpperCase()})</h4>
              <button onClick={() => setShowFhirModal(false)} style={styles.closeBtn}>&times;</button>
            </div>
            <div style={styles.modalBody}>
              <pre style={styles.codeBlock}>
                <code>{fhirContent}</code>
              </pre>
            </div>
            <div style={styles.modalFooter}>
              <button onClick={handleCopyToClipboard} className="btn btn-secondary" style={{ fontSize: '13px', padding: '8px 16px' }}>
                Copy to Clipboard
              </button>
              <button onClick={handleDownloadFhirFile} className="btn" style={{ fontSize: '13px', padding: '8px 16px' }}>
                Download .{fhirFormat} File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  authContainer: {
    maxWidth: '450px',
    width: '100%',
    margin: '120px auto',
    padding: '40px',
  },
  authHeader: {
    textAlign: 'center',
    marginBottom: '30px',
  },
  authIcon: {
    display: 'inline-flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: 'rgba(16,185,129,0.1)',
    border: '1px solid rgba(16,185,129,0.2)',
    marginBottom: '15px'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  errorAlert: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    color: '#ef4444',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '6px',
    padding: '12px',
    fontSize: '14px',
    textAlign: 'center'
  },
  workspace: {
    display: 'flex',
    flex: 1,
    gap: '20px',
    height: '100%',
    minHeight: '0'
  },
  listSection: {
    flex: 1,
    maxWidth: '350px',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: '0'
  },
  sectionHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid var(--glass-border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  signoutLink: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '12px'
  },
  sessionListScroll: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  sessionRow: {
    padding: '14px',
    borderRadius: '8px',
    border: '1px solid',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    transition: 'all 0.2s ease'
  },
  rowTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  patientName: {
    fontWeight: 'bold',
    fontSize: '14px'
  },
  rowMiddle: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: 'var(--text-muted)'
  },
  dobText: {},
  stepBadge: {
    background: 'rgba(255,255,255,0.03)',
    padding: '2px 6px',
    borderRadius: '4px',
    border: '1px solid var(--glass-border)'
  },
  rowBottom: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '11px',
    color: 'var(--text-muted)',
    gap: '6px'
  },
  timeText: {
    flex: 1
  },
  statusDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%'
  },
  statusLabel: {
    textTransform: 'capitalize'
  },
  detailSection: {
    flex: 3,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: '0',
    position: 'relative'
  },
  emptyWorkspace: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    textAlign: 'center',
    gap: '15px'
  },
  splitGrid: {
    display: 'flex',
    gap: '20px',
    height: '100%',
    minHeight: '0'
  },
  soapWorkspace: {
    flex: 1.2,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: '0'
  },
  workspaceHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid var(--glass-border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  formWorkspaceScroll: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px'
  },
  textarea: {
    height: '120px',
    fontFamily: 'inherit'
  },
  rationaleContainer: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid var(--glass-border)',
    borderRadius: '6px',
    padding: '12px'
  },
  syncContainer: {
    padding: '16px',
    border: '1px solid var(--glass-border-glow)',
    backgroundColor: 'rgba(59, 130, 246, 0.02)'
  },
  syncStatusBlock: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '13px',
    fontWeight: 'bold',
    marginBottom: '10px'
  },
  syncStatusBadge: {
    fontSize: '11px',
    padding: '3px 8px',
    borderRadius: '4px',
    border: '1px solid'
  },
  transcriptWorkspace: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: '0'
  },
  transcriptScroll: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  transcriptRow: {
    padding: '10px 14px',
    borderRadius: '6px',
    borderLeftWidth: '3px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    background: 'rgba(255,255,255,0.01)',
    border: '1px solid var(--glass-border)'
  },
  transcriptMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px'
  },
  safetyFlagBadge: {
    fontSize: '10px',
    fontWeight: 'bold',
    color: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: '4px',
    padding: '2px 6px',
    marginTop: '6px',
    width: 'fit-content'
  },
  diffPanel: {
    marginTop: '6px',
    padding: '8px',
    background: 'rgba(0,0,0,0.2)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '6px'
  },
  diffHeader: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontWeight: 'bold',
    display: 'block',
    marginBottom: '4px'
  },
  diffComparison: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    fontSize: '12px',
    fontFamily: 'monospace'
  },
  diffDeleted: {
    color: '#f87171',
    textDecoration: 'line-through'
  },
  diffAdded: {
    color: '#4ade80'
  },
  emptyListText: {
    color: 'var(--text-muted)',
    fontSize: '13px',
    textAlign: 'center',
    padding: '20px'
  },
  spinnerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(9, 13, 22, 0.85)',
    zIndex: 10,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center'
  },
  fhirActionsRow: {
    display: 'flex',
    gap: '10px',
    marginTop: '10px',
    width: '100%'
  },
  fhirBtn: {
    flex: 1,
    padding: '8px 12px',
    fontSize: '12px'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    zIndex: 999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px'
  },
  modalContent: {
    width: '100%',
    maxWidth: '800px',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#0f172a',
    border: '1px solid var(--glass-border-glow)',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
  },
  modalHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid var(--glass-border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  modalBody: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    backgroundColor: 'rgba(0, 0, 0, 0.3)'
  },
  modalFooter: {
    padding: '16px 20px',
    borderTop: '1px solid var(--glass-border)',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '24px',
    cursor: 'pointer',
    lineHeight: '1'
  },
  codeBlock: {
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#818cf8',
    backgroundColor: '#0a0d16',
    padding: '16px',
    borderRadius: '6px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    textAlign: 'left'
  },
  cdsContainer: {
    padding: '16px',
    backgroundColor: 'rgba(255,255,255,0.02)',
    border: '1px solid var(--glass-border)',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '10px'
  },
  cdsHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    borderBottom: '1px solid var(--glass-border)',
    paddingBottom: '8px'
  },
  cdsAlertOk: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: 'rgba(16,185,129,0.05)',
    border: '1px solid rgba(16,185,129,0.15)',
    borderRadius: '6px'
  },
  cdsAlertsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  cdsAlertItem: {
    padding: '12px',
    borderRadius: '6px',
    borderLeftWidth: '4px',
    borderLeftStyle: 'solid',
    borderTop: '1px solid rgba(255,255,255,0.02)',
    borderRight: '1px solid rgba(255,255,255,0.02)',
    borderBottom: '1px solid rgba(255,255,255,0.02)',
    display: 'flex',
    flexDirection: 'column',
    textAlign: 'left'
  },
  cdsAlertBadge: {
    fontSize: '10px',
    fontWeight: 'bold',
    padding: '2px 6px',
    borderRadius: '4px',
    width: 'fit-content'
  }
};
