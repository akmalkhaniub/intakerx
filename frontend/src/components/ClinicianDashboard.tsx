import React, { useState, useEffect, useRef } from 'react';
import { FileText, Play, CheckCircle2, ShieldCheck, Edit3, RefreshCw, Phone, Printer } from 'lucide-react';

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
  const [cdsTab, setCdsTab] = useState<'alerts' | 'graph'>('alerts');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Active Telephony Call Monitor State
  const [activeCalls, setActiveCalls] = useState<any[]>([]);
  const [bargeInText, setBargeInText] = useState('');
  const [isSendingBargeIn, setIsSendingBargeIn] = useState(false);

  // Longitudinal patient history state for SVG trend charting
  const [patientHistory, setPatientHistory] = useState<any[]>([]);

  // Vitals Telemetry Playback Slider State
  const [playbackIndex, setPlaybackIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  // Discharge summary state
  const [dischargeSummary, setDischargeSummary] = useState<string>('');
  const [isGeneratingDischarge, setIsGeneratingDischarge] = useState<boolean>(false);

  // Care gaps state
  const [careGaps, setCareGaps] = useState<any[]>([]);

  // Print Summary Attestation States
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [attestSoap, setAttestSoap] = useState(false);
  const [attestTimeline, setAttestTimeline] = useState(false);
  const [attestCds, setAttestCds] = useState(false);
  const [isSigned, setIsSigned] = useState(false);

  // Clinical Copilot state
  const [copilotQuery, setCopilotQuery] = useState('');
  const [copilotHistory, setCopilotHistory] = useState<Array<{ sender: 'user' | 'copilot', text: string, citations?: any[] }>>([]);
  const [isCopilotLoading, setIsCopilotLoading] = useState(false);
  const [showCopilotSidebar, setShowCopilotSidebar] = useState(false);

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

  // Poll active voice telephony calls
  useEffect(() => {
    let activeCallInterval: any;
    if (token) {
      const fetchActiveCalls = async () => {
        try {
          const res = await fetch(`${backendUrl}/api/clinician/active-calls`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            setActiveCalls(data.activeCalls || []);
          }
        } catch (err) {
          console.error('Failed to poll active calls:', err);
        }
      };
      fetchActiveCalls();
      activeCallInterval = setInterval(fetchActiveCalls, 3000);
    }
    return () => clearInterval(activeCallInterval);
  }, [token]);

  // Handle auditory clinical alarms for telemetry distress
  useEffect(() => {
    const playAlertSound = () => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } catch (e) {
        console.error('AudioContext alarm error:', e);
      }
    };

    const hasAlarm = activeCalls.some(c => c.vitals && (c.vitals.spo2 < 92 || c.vitals.heartRate > 130));
    if (hasAlarm) {
      playAlertSound();
    }
  }, [activeCalls]);

  // Vitals Telemetry Playback Slider animation loop
  useEffect(() => {
    let timer: any;
    if (isPlaying && sessionDetail?.vitals && sessionDetail.vitals.length > 0) {
      const intervalMs = Math.max(100, 1000 / playbackSpeed);
      timer = setInterval(() => {
        setPlaybackIndex((prev) => {
          if (prev >= sessionDetail.vitals.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, intervalMs);
    }
    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, sessionDetail]);

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
    setCopilotQuery('');
    setCopilotHistory([]);
    setShowCopilotSidebar(false);
    setShowPrintModal(false);
    setAttestSoap(false);
    setAttestTimeline(false);
    setAttestCds(false);
    setIsSigned(false);
    setCdsTab('alerts');
    setHoveredNodeId(null);
    setSelectedNodeId(null);
    setPlaybackIndex(0);
    setIsPlaying(false);
    setPlaybackSpeed(1);
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

      // Load patient history for symptom tracking charts
      if (data.session.patientId) {
        loadPatientHistory(data.session.patientId);
      }

      // Load discharge summary
      try {
        const dischargeRes = await fetch(`${backendUrl}/api/clinician/sessions/${id}/discharge`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (dischargeRes.ok) {
          const dischargeData = await dischargeRes.json();
          setDischargeSummary(dischargeData.dischargeSummary || '');
        } else {
          setDischargeSummary('');
        }
      } catch (e) {
        setDischargeSummary('');
      }

      // Load care gaps alerts
      try {
        const gapsRes = await fetch(`${backendUrl}/api/clinician/sessions/${id}/care-gaps`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (gapsRes.ok) {
          const gapsData = await gapsRes.json();
          setCareGaps(gapsData.alerts || []);
        } else {
          setCareGaps([]);
        }
      } catch (e) {
        setCareGaps([]);
      }
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

  const loadPatientHistory = async (patientId: number) => {
    try {
      const res = await fetch(`${backendUrl}/api/clinician/patients/${patientId}/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPatientHistory(data.history || []);
      }
    } catch (err) {
      console.error('Failed to load patient history:', err);
    }
  };

  const handleGenerateDischarge = async () => {
    setIsGeneratingDischarge(true);
    try {
      const res = await fetch(`${backendUrl}/api/clinician/sessions/${selectedSessionId}/discharge`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setDischargeSummary(data.dischargeSummary);
      } else {
        alert('Failed to generate discharge summary: ' + (data.error || 'Unknown error'));
      }
    } catch (err: any) {
      alert('Generation error: ' + err.message);
    } finally {
      setIsGeneratingDischarge(false);
    }
  };

  const handleDownloadDischarge = () => {
    if (!dischargeSummary || !sessionDetail) return;
    const blob = new Blob([dischargeSummary], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Discharge_Summary_${sessionDetail.session.patientName.replace(/\s+/g, '_')}_${sessionDetail.session.preferredLanguage}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);
  const lastX = useRef(0);
  const lastY = useRef(0);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    isDrawing.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    lastX.current = clientX - rect.left;
    lastY.current = clientY - rect.top;
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;
    if ('touches' in e) {
      if (e.cancelable) e.preventDefault();
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const currentX = clientX - rect.left;
    const currentY = clientY - rect.top;

    ctx.beginPath();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(lastX.current, lastY.current);
    ctx.lineTo(currentX, currentY);
    ctx.stroke();

    lastX.current = currentX;
    lastY.current = currentY;
    setIsSigned(true);
  };

  const stopDrawing = () => {
    isDrawing.current = false;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsSigned(false);
  };

  const handleSendCopilotQuery = async (queryText?: string) => {
    const textToSend = queryText || copilotQuery;
    if (!textToSend.trim()) return;

    const userMsg = { sender: 'user' as const, text: textToSend };
    setCopilotHistory(prev => [...prev, userMsg]);
    if (!queryText) setCopilotQuery('');
    
    setIsCopilotLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/clinician/sessions/${selectedSessionId}/copilot/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ query: textToSend })
      });
      const data = await res.json();
      if (res.ok) {
        setCopilotHistory(prev => [...prev, {
          sender: 'copilot' as const,
          text: data.answer,
          citations: data.citations
        }]);
      } else {
        setCopilotHistory(prev => [...prev, {
          sender: 'copilot' as const,
          text: `Error: ${data.error || 'Failed to get answer.'}`
        }]);
      }
    } catch (err: any) {
      setCopilotHistory(prev => [...prev, {
        sender: 'copilot' as const,
        text: `Connection failed: ${err.message}`
      }]);
    } finally {
      setIsCopilotLoading(false);
    }
  };

  const getSeverityScore = (severity: string | number): number => {
    if (typeof severity === 'number') return severity;
    if (!severity) return 0;
    const lower = String(severity).toLowerCase();
    if (lower === 'severe' || lower === 'high') return 9;
    if (lower === 'moderate' || lower === 'medium') return 6;
    if (lower === 'mild' || lower === 'low') return 3;
    const num = parseInt(lower, 10);
    return isNaN(num) ? 1 : num;
  };

  const getSessionMaxSeverity = (session: any): number => {
    if (!session.symptoms || session.symptoms.length === 0) return 0;
    return Math.max(...session.symptoms.map((s: any) => getSeverityScore(s.severity)));
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

  // Send clinician override text to active voice session
  const handleSendBargeIn = async () => {
    if (!bargeInText.trim() || !selectedSessionId) return;
    setIsSendingBargeIn(true);
    try {
      const res = await fetch(`${backendUrl}/api/clinician/active-calls/${selectedSessionId}/barge-in`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: bargeInText })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to send barge-in message.');
      }

      setBargeInText('');
      // Force refresh of details to show the updated dialogue log
      await loadSessionDetails(selectedSessionId, false);
    } catch (err: any) {
      alert('Barge-in failed: ' + err.message);
    } finally {
      setIsSendingBargeIn(false);
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

  const renderCDSGraph = () => {
    if (!sessionDetail) return null;

    // 1. Normalize medications and allergies
    const graphMeds = editMeds.map((m: any) => {
      const name = typeof m === 'string' ? m : m.name || '';
      return { id: `med-${name.toLowerCase().trim()}`, label: name, type: 'med' as const };
    }).filter(n => n.label.trim() !== '');

    const graphAllergies = editAllergies.map((allergy: any) => {
      const name = typeof allergy === 'string' ? allergy : allergy.name || '';
      return { id: `allergy-${name.toLowerCase().trim()}`, label: name, type: 'allergy' as const };
    }).filter(n => n.label.trim() !== '');

    // Eliminate duplicates by id
    const seenIds = new Set<string>();
    const allNodes: Array<{ id: string; label: string; type: 'med' | 'allergy' }> = [];
    [...graphMeds, ...graphAllergies].forEach(n => {
      if (!seenIds.has(n.id)) {
        seenIds.add(n.id);
        allNodes.push(n);
      }
    });

    if (allNodes.length === 0) {
      return (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
          No active medications or allergies logged for this patient.
        </div>
      );
    }

    // 2. Identify links from interactions list
    const findMedNode = (itemName: string) => {
      const itemLower = itemName.toLowerCase().trim();
      return graphMeds.find(n => n.label.toLowerCase().includes(itemLower) || itemLower.includes(n.label.toLowerCase()));
    };

    const findAllergyNode = (itemName: string) => {
      const itemLower = itemName.toLowerCase().trim();
      return graphAllergies.find(n => n.label.toLowerCase().includes(itemLower) || itemLower.includes(n.label.toLowerCase()));
    };

    const graphLinks: Array<{ source: string; target: string; alert: any; key: string }> = [];
    const conflictingNodeIds = new Set<string>();

    interactions.forEach((alert) => {
      if (alert.ruleType === 'drug_drug') {
        const srcNode = findMedNode(alert.triggerItem);
        const tgtNode = findMedNode(alert.conflictItem);
        if (srcNode && tgtNode) {
          graphLinks.push({
            source: srcNode.id,
            target: tgtNode.id,
            alert,
            key: `${srcNode.id}-${tgtNode.id}`
          });
          conflictingNodeIds.add(srcNode.id);
          conflictingNodeIds.add(tgtNode.id);
        }
      } else if (alert.ruleType === 'drug_allergy') {
        const srcNode = findMedNode(alert.triggerItem);
        const tgtNode = findAllergyNode(alert.conflictItem);
        if (srcNode && tgtNode) {
          graphLinks.push({
            source: srcNode.id,
            target: tgtNode.id,
            alert,
            key: `${srcNode.id}-${tgtNode.id}`
          });
          conflictingNodeIds.add(srcNode.id);
          conflictingNodeIds.add(tgtNode.id);
        }
      }
    });

    // 3. Arrange nodes in a circular layout
    const CX = 225;
    const CY = 120;
    const radius = 75;
    const nodesWithCoords = allNodes.map((node, idx) => {
      const angle = (idx / allNodes.length) * 2 * Math.PI - Math.PI / 2; // Start from top
      const x = CX + radius * Math.cos(angle);
      const y = CY + radius * Math.sin(angle);
      const isConflicting = conflictingNodeIds.has(node.id);
      return { ...node, x, y, isConflicting };
    });

    const coordsMap: Record<string, { x: number; y: number }> = {};
    nodesWithCoords.forEach(n => {
      coordsMap[n.id] = { x: n.x, y: n.y };
    });

    const isHoverActive = hoveredNodeId !== null;
    const hoveredNode = nodesWithCoords.find(n => n.id === hoveredNodeId);
    
    const connectedToHovered = new Set<string>();
    if (hoveredNode) {
      connectedToHovered.add(hoveredNode.id);
      graphLinks.forEach(l => {
        if (l.source === hoveredNode.id) connectedToHovered.add(l.target);
        if (l.target === hoveredNode.id) connectedToHovered.add(l.source);
      });
    }

    const getLinkStyle = (link: any) => {
      const isHigh = link.alert.severity === 'high';
      const color = isHigh ? '#ef4444' : '#f59e0b';
      let opacity = 0.85;
      if (isHoverActive) {
        const isRelated = link.source === hoveredNodeId || link.target === hoveredNodeId;
        opacity = isRelated ? 1.0 : 0.15;
      }
      return {
        stroke: color,
        strokeWidth: isHoverActive && (link.source === hoveredNodeId || link.target === hoveredNodeId) ? 4.5 : 3,
        opacity,
        transition: 'all 0.2s ease'
      };
    };

    const getNodeStyle = (node: any) => {
      let opacity = 1.0;
      if (isHoverActive) {
        opacity = connectedToHovered.has(node.id) ? 1.0 : 0.25;
      }
      return {
        opacity,
        transition: 'all 0.25s ease',
        cursor: 'pointer'
      };
    };

    const activeDetailId = selectedNodeId || hoveredNodeId;
    const activeDetailNode = nodesWithCoords.find(n => n.id === activeDetailId);
    const activeDetailAlerts = activeDetailNode 
      ? graphLinks.filter(l => l.source === activeDetailNode.id || l.target === activeDetailNode.id).map(l => l.alert)
      : [];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{
          position: 'relative',
          backgroundColor: '#090d16',
          border: '1px solid var(--glass-border)',
          borderRadius: '8px',
          overflow: 'hidden',
          padding: '10px'
        }}>
          <svg viewBox="0 0 450 240" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
            <defs>
              <filter id="glow-red-node" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="glow-amber-node" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id="grad-med-safe" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1e3a8a" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
              <linearGradient id="grad-allergy-safe" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#581c87" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
              <linearGradient id="grad-conflict-high" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7f1d1d" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
              <linearGradient id="grad-conflict-mod" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#78350f" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
            </defs>

            <circle cx={CX} cy={CY} r={radius} fill="none" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="1" strokeDasharray="3 3" />
            
            {graphLinks.length === 0 && graphMeds.length > 1 && (
              <path
                d={graphMeds.map((m, i) => {
                  const coord = coordsMap[m.id];
                  if (!coord) return '';
                  return `${i === 0 ? 'M' : 'L'} ${coord.x} ${coord.y}`;
                }).join(' ') + ' Z'}
                fill="none"
                stroke="rgba(16, 185, 129, 0.12)"
                strokeWidth="1.5"
                strokeDasharray="2 3"
              />
            )}

            {graphLinks.map((link) => {
              const p1 = coordsMap[link.source];
              const p2 = coordsMap[link.target];
              if (!p1 || !p2) return null;
              const style = getLinkStyle(link);
              const isHigh = link.alert.severity === 'high';
              const filterId = isHigh ? 'url(#glow-red-node)' : 'url(#glow-amber-node)';
              return (
                <g key={link.key}>
                  <line
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke={style.stroke}
                    strokeWidth={style.strokeWidth + 4}
                    opacity={style.opacity * 0.4}
                    filter={filterId}
                  />
                  <line
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke={style.stroke}
                    strokeWidth={style.strokeWidth}
                    opacity={style.opacity}
                    strokeDasharray={link.alert.severity === 'high' ? undefined : '5 3'}
                  />
                </g>
              );
            })}

            {nodesWithCoords.map((node) => {
              const style = getNodeStyle(node);
              const isSelected = selectedNodeId === node.id;
              let gradId = node.type === 'med' ? 'url(#grad-med-safe)' : 'url(#grad-allergy-safe)';
              let strokeColor = node.type === 'med' ? '#60a5fa' : '#c084fc';
              let filterUrl = undefined;

              if (node.isConflicting) {
                const nodeAlerts = graphLinks.filter(l => l.source === node.id || l.target === node.id);
                const hasHigh = nodeAlerts.some(l => l.alert.severity === 'high');
                gradId = hasHigh ? 'url(#grad-conflict-high)' : 'url(#grad-conflict-mod)';
                strokeColor = hasHigh ? '#ef4444' : '#f59e0b';
                filterUrl = hasHigh ? 'url(#glow-red-node)' : 'url(#glow-amber-node)';
              }

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  style={style}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  onClick={() => setSelectedNodeId(isSelected ? null : node.id)}
                >
                  {isSelected && (
                    <circle
                      r="21"
                      fill="none"
                      stroke="#a855f7"
                      strokeWidth="2"
                      strokeDasharray="3 2"
                    />
                  )}
                  {node.isConflicting && (
                    <circle
                      r="18"
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth="1.5"
                      className="pulse-red-ring"
                      opacity="0.6"
                    />
                  )}
                  <circle
                    r="13"
                    fill={gradId}
                    stroke={strokeColor}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    filter={filterUrl}
                  />
                  <text
                    y="3"
                    fill="white"
                    fontSize="9px"
                    fontWeight="bold"
                    textAnchor="middle"
                    style={{ userSelect: 'none', pointerEvents: 'none' }}
                  >
                    {node.type === 'med' ? '💊' : '🛡️'}
                  </text>
                  <text
                    y={node.y > CY ? 24 : -18}
                    fill={isSelected ? '#c084fc' : node.isConflicting ? strokeColor : '#94a3b8'}
                    fontSize="9px"
                    fontWeight={isSelected || node.isConflicting ? 'bold' : 'normal'}
                    textAnchor="middle"
                    style={{ userSelect: 'none', pointerEvents: 'none' }}
                  >
                    {node.label.length > 13 ? node.label.substring(0, 11) + '..' : node.label}
                  </text>
                </g>
              );
            })}
          </svg>

          {hoveredNode && (
            <div style={{
              position: 'absolute',
              bottom: '8px',
              left: '8px',
              right: '8px',
              backgroundColor: 'rgba(9, 13, 22, 0.95)',
              border: `1px solid ${hoveredNode.isConflicting ? '#ef4444' : 'var(--glass-border)'}`,
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '11px',
              color: 'white',
              textAlign: 'left',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              pointerEvents: 'none',
              zIndex: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: '1px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', color: hoveredNode.type === 'med' ? '#60a5fa' : '#c084fc' }}>
                  {hoveredNode.type === 'med' ? 'Medication' : 'Allergen'}: {hoveredNode.label}
                </span>
                <span style={{
                  fontSize: '8px',
                  padding: '1px 3px',
                  borderRadius: '2px',
                  backgroundColor: hoveredNode.isConflicting ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                  color: hoveredNode.isConflicting ? '#ef4444' : '#10b981'
                }}>
                  {hoveredNode.isConflicting ? 'WARNING' : 'CLEAR'}
                </span>
              </div>
              <span style={{ color: '#94a3b8', fontSize: '9px' }}>
                {hoveredNode.isConflicting 
                  ? `Clinical alert detected. Hover/click for details.`
                  : 'No active clinical interactions detected.'}
              </span>
            </div>
          )}
        </div>

        {activeDetailNode ? (
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.01)',
            border: `1px solid ${activeDetailNode.isConflicting ? 'rgba(239, 68, 68, 0.2)' : 'var(--glass-border)'}`,
            borderRadius: '6px',
            padding: '10px',
            textAlign: 'left'
          }}>
            <h5 style={{ margin: '0 0 6px 0', fontSize: '12px', color: 'white', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
              <span>Clinical Record: {activeDetailNode.label}</span>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                {activeDetailNode.type === 'med' ? 'Medication' : 'Allergen'}
              </span>
            </h5>
            
            {activeDetailAlerts.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                {activeDetailAlerts.map((alert: any, idx: number) => (
                  <div key={idx} style={{
                    padding: '6px 8px',
                    borderLeft: `2.5px solid ${alert.severity === 'high' ? '#ef4444' : '#f59e0b'}`,
                    backgroundColor: 'rgba(0, 0, 0, 0.15)',
                    borderRadius: '0 4px 4px 0'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 'bold', marginBottom: '2px' }}>
                      <span style={{ color: alert.severity === 'high' ? '#ef4444' : '#f59e0b' }}>
                        {alert.severity.toUpperCase()} RISK
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {alert.ruleType === 'drug_drug' ? 'Drug-Drug Conflict' : 'Allergen Conflict'}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '10.5px', color: 'var(--text)', lineHeight: '1.4' }}>{alert.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: '4px 0 0 0', fontSize: '10.5px', color: '#10b981' }}>
                🟢 No warning flags matching active clinical rules.
              </p>
            )}
          </div>
        ) : (
          <div style={{ padding: '6px', border: '1px dashed var(--glass-border)', borderRadius: '6px', fontSize: '10.5px', color: 'var(--text-muted)' }}>
            💡 Hint: Hover or click on any node to analyze clinical safety warnings.
          </div>
        )}
      </div>
    );
  };

  const renderVitalsPlayback = () => {
    const vitals = sessionDetail?.vitals || [];
    if (vitals.length === 0) {
      return (
        <div style={styles.timelineCard} className="glass-panel">
          <div style={styles.cardHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} color="#ef4444" />
              <h3 style={{ margin: 0 }}>Vitals Telemetry Playback</h3>
            </div>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', margin: '20px 0', textAlign: 'center' }}>
            No recorded vitals telemetry for this intake session.
          </p>
        </div>
      );
    }

    const idx = Math.min(playbackIndex, vitals.length - 1);
    const activeVital = vitals[idx] || { heartRate: 72, spo2: 98, bpSystolic: 120, bpDiastolic: 80, createdAt: new Date() };

    const t0 = new Date(vitals[0].createdAt).getTime();
    const tActive = new Date(activeVital.createdAt).getTime();
    const elapsedSeconds = Math.max(0, Math.floor((tActive - t0) / 1000));
    const pad = (num: number) => String(num).padStart(2, '0');
    const elapsedLabel = `${Math.floor(elapsedSeconds / 60)}m ${pad(elapsedSeconds % 60)}s`;

    const isHrHigh = activeVital.heartRate > 130;
    const isHrLow = activeVital.heartRate < 50;
    const isSpo2Low = activeVital.spo2 < 92;
    const isBpHigh = activeVital.bpSystolic > 140 || activeVital.bpDiastolic > 90;

    const sparklineWidth = 140;
    const sparklineHeight = 35;
    const sparkPoints = vitals.slice(0, idx + 1);
    
    let sparklinePathD = '';
    if (sparkPoints.length > 1) {
      const hrs = vitals.map((v: any) => v.heartRate);
      const minHr = Math.min(...hrs);
      const maxHr = Math.max(...hrs);
      const hrRange = Math.max(10, maxHr - minHr);
      
      sparkPoints.forEach((p: any, i: number) => {
        const x = (i / (vitals.length - 1)) * sparklineWidth;
        const y = sparklineHeight - 2 - ((p.heartRate - minHr) / hrRange) * (sparklineHeight - 4);
        sparklinePathD += `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      });
    }

    return (
      <div style={styles.timelineCard} className="glass-panel">
        <div style={styles.cardHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} color="#ef4444" />
            <h3 style={{ margin: 0 }}>Vitals Telemetry Playback</h3>
          </div>
          <span style={{
            fontSize: '10px',
            backgroundColor: isPlaying ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.05)',
            color: isPlaying ? '#ef4444' : 'var(--text-muted)',
            padding: '2px 6px',
            borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.05)',
            fontWeight: 'bold'
          }}>
            {isPlaying ? '● PLAYING' : 'PAUSED'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '10px', marginTop: '12px' }}>
          {/* Heart Rate Display */}
          <div style={{
            background: 'rgba(0,0,0,0.15)',
            borderRadius: '6px',
            border: `1px solid ${isHrHigh || isHrLow ? 'rgba(239, 68, 68, 0.25)' : 'var(--glass-border)'}`,
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative'
          }}>
            <span 
              className={isPlaying ? "pulse-heart-icon" : ""}
              style={{
                fontSize: '20px',
                animation: isPlaying ? `heartbeat ${Math.max(0.3, 60 / activeVital.heartRate)}s infinite ease-in-out` : 'none',
                display: 'block',
                marginBottom: '4px'
              }}
            >
              ❤️
            </span>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: isHrHigh || isHrLow ? '#ef4444' : 'white', fontFamily: 'monospace' }}>
              {activeVital.heartRate} <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'normal' }}>bpm</span>
            </div>
            <div style={{ fontSize: '9px', color: isHrHigh || isHrLow ? '#ef4444' : 'var(--text-muted)', marginTop: '2px', textAlign: 'center' }}>
              {isHrHigh ? 'Tachycardia' : isHrLow ? 'Bradycardia' : 'Normal Pulse'}
            </div>
            
            <style>
              {`
                @keyframes heartbeat {
                  0% { transform: scale(1); }
                  25% { transform: scale(1.15); }
                  50% { transform: scale(1); }
                  75% { transform: scale(1.1); }
                  100% { transform: scale(1); }
                }
              `}
            </style>
          </div>

          {/* SpO2 Display */}
          <div style={{
            background: 'rgba(0,0,0,0.15)',
            borderRadius: '6px',
            border: `1px solid ${isSpo2Low ? 'rgba(239, 68, 68, 0.25)' : 'var(--glass-border)'}`,
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: '18px', marginBottom: '4px' }}>🩸</span>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: isSpo2Low ? '#ef4444' : '#10b981', fontFamily: 'monospace' }}>
              {activeVital.spo2}%
            </div>
            <div style={{ fontSize: '9px', color: isSpo2Low ? '#ef4444' : 'var(--text-muted)', marginTop: '2px', textAlign: 'center' }}>
              {isSpo2Low ? '🚨 Hypoxemia' : 'Normal O2'}
            </div>
            <div style={{ width: '80%', height: '4px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '2px', marginTop: '6px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${activeVital.spo2}%`,
                backgroundColor: isSpo2Low ? '#ef4444' : '#10b981',
                transition: 'width 0.3s ease'
              }}></div>
            </div>
          </div>

          {/* Blood Pressure Display */}
          <div style={{
            background: 'rgba(0,0,0,0.15)',
            borderRadius: '6px',
            border: `1px solid ${isBpHigh ? 'rgba(245, 158, 11, 0.25)' : 'var(--glass-border)'}`,
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: '18px', marginBottom: '4px' }}>⚡</span>
            <div style={{ fontSize: '17px', fontWeight: 'bold', color: isBpHigh ? '#f59e0b' : 'white', fontFamily: 'monospace', marginTop: '2px' }}>
              {activeVital.bpSystolic}/{activeVital.bpDiastolic}
            </div>
            <div style={{ fontSize: '9px', color: isBpHigh ? '#f59e0b' : 'var(--text-muted)', marginTop: '4px', textAlign: 'center' }}>
              {isBpHigh ? 'BP High' : 'BP Normal'}
            </div>
          </div>
        </div>

        {/* Rolling Heart Rate Sparkline & Time Indicator */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', padding: '6px 10px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.02)' }}>
          <div style={{ textAlign: 'left' }}>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block' }}>Playback Time</span>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'white', fontFamily: 'monospace' }}>
              +{elapsedLabel}
            </span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '8px', color: 'var(--text-muted)', marginBottom: '2px' }}>Heart Rate Trend</span>
            <div style={{ width: `${sparklineWidth}px`, height: `${sparklineHeight}px` }}>
              {sparklinePathD ? (
                <svg width={sparklineWidth} height={sparklineHeight}>
                  <path
                    d={sparklinePathD}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx={(idx / (vitals.length - 1)) * sparklineWidth}
                    cy={sparklineHeight - 2 - ((activeVital.heartRate - Math.min(...vitals.map((v: any) => v.heartRate))) / Math.max(10, Math.max(...vitals.map((v: any) => v.heartRate)) - Math.min(...vitals.map((v: any) => v.heartRate)))) * (sparklineHeight - 4)}
                    r="2.5"
                    fill="white"
                    stroke="#ef4444"
                    strokeWidth="1"
                  />
                </svg>
              ) : (
                <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Calibrating...</span>
              )}
            </div>
          </div>
        </div>

        {/* Timeline Slider Track */}
        <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <input
            type="range"
            min={0}
            max={vitals.length - 1}
            value={idx}
            onChange={(e) => {
              setPlaybackIndex(parseInt(e.target.value, 10));
              setIsPlaying(false);
            }}
            style={{
              width: '100%',
              accentColor: '#ef4444',
              cursor: 'pointer',
              height: '4px',
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: '2px',
              border: 'none',
              outline: 'none'
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)' }}>
            <span>Start (0s)</span>
            <span>Index {idx}</span>
            <span>End ({Math.floor((new Date(vitals[vitals.length - 1].createdAt).getTime() - t0) / 1000)}s)</span>
          </div>
        </div>

        {/* Playback Actions */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
          <button
            type="button"
            onClick={() => {
              if (idx >= vitals.length - 1) {
                setPlaybackIndex(0);
              }
              setIsPlaying(!isPlaying);
            }}
            className="btn"
            style={{ flex: 1, padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
          >
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', padding: '2px 8px', borderRadius: '6px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Speed:</span>
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="1" style={{ backgroundColor: '#0f172a' }}>1x</option>
              <option value="2" style={{ backgroundColor: '#0f172a' }}>2x</option>
              <option value="5" style={{ backgroundColor: '#0f172a' }}>5x</option>
              <option value="10" style={{ backgroundColor: '#0f172a' }}>10x</option>
            </select>
          </div>
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

            {/* Active Telephony Live Monitor subpanel */}
            <div style={styles.activeCallsSection}>
              <div style={styles.sectionSubHeader}>
                <span className="pulse-red-dot" style={{ marginRight: '6px' }}></span>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#ef4444' }}>Active Voice Calls ({activeCalls.length})</span>
              </div>
              <div style={styles.activeCallsScroll}>
                {activeCalls.length === 0 ? (
                  <p style={styles.emptySubListText}>No live phone calls currently.</p>
                ) : (
                  activeCalls.map(c => {
                    const isSelected = selectedSessionId === c.sessionId;
                    const hasAlarm = c.vitals && (c.vitals.spo2 < 92 || c.vitals.heartRate > 130);
                    return (
                      <div 
                        key={c.sessionId}
                        onClick={() => loadSessionDetails(c.sessionId)}
                        style={{
                          ...styles.activeCallRow,
                          backgroundColor: isSelected 
                            ? (hasAlarm ? 'rgba(239, 68, 68, 0.1)' : 'rgba(168, 85, 247, 0.1)') 
                            : 'rgba(255,255,255,0.02)',
                          borderColor: isSelected 
                            ? (hasAlarm ? '#ef4444' : '#a855f7') 
                            : (hasAlarm ? 'rgba(239, 68, 68, 0.4)' : 'var(--glass-border)'),
                        }}
                        className={hasAlarm ? "pulse-border-red active-telemetry-alarm" : "pulse-border-purple"}
                      >
                        <div style={styles.activeCallInfo}>
                          <span style={styles.activeCallName}>{c.patientName}</span>
                          <span style={styles.activeCallId}>ID: {c.sessionId.slice(0, 8)}...</span>
                          {c.vitals && (
                            <div style={{ display: 'flex', gap: '8px', fontSize: '10px', marginTop: '4px' }}>
                              <span style={{ color: c.vitals.heartRate > 130 ? '#ef4444' : '#10b981', fontWeight: 'bold' }}>
                                HR: {c.vitals.heartRate}
                              </span>
                              <span style={{ color: c.vitals.spo2 < 92 ? '#ef4444' : '#3b82f6', fontWeight: 'bold' }}>
                                SpO2: {c.vitals.spo2}%
                              </span>
                              <span style={{ color: 'var(--text-muted)' }}>
                                BP: {c.vitals.bpSystolic}/{c.vitals.bpDiastolic}
                              </span>
                            </div>
                          )}
                        </div>
                        <span style={{
                          ...styles.activeCallStatus,
                          backgroundColor: hasAlarm ? 'rgba(239, 68, 68, 0.1)' : 'rgba(168, 85, 247, 0.1)',
                          borderColor: hasAlarm ? 'rgba(239, 68, 68, 0.2)' : 'rgba(168, 85, 247, 0.2)',
                          color: hasAlarm ? '#ef4444' : '#a855f7'
                        }}>
                          {hasAlarm ? 'ALARM' : 'Live'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
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
              <>
                {(() => {
                  const liveCall = activeCalls.find(c => c.sessionId === selectedSessionId);
                  const hasAlert = liveCall?.vitals && (liveCall.vitals.spo2 < 92 || liveCall.vitals.heartRate > 130);
                  if (!hasAlert) return null;
                  
                  return (
                    <div className="telemetry-emergency-banner animate-pulse" style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid #ef4444',
                      color: '#ef4444',
                      padding: '10px 16px',
                      borderRadius: '8px',
                      margin: '0 20px 15px 20px',
                      fontWeight: 'bold',
                      fontSize: '12px',
                      textAlign: 'left'
                    }}>
                      <span>
                        🚨 CLINICAL ALERT: TELEMETRY DISTRESS ALARM - CRITICAL METRICS (
                        {liveCall.vitals.heartRate > 130 ? `HR: ${liveCall.vitals.heartRate} bpm ` : ''}
                        {liveCall.vitals.spo2 < 92 ? `SpO2: ${liveCall.vitals.spo2}% ` : ''}
                        ) - IMMEDIATE INTERVENTION REQUIRED
                      </span>
                    </div>
                  );
                })()}

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

                      {/* Tab Navigation for CDS */}
                      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '6px', marginBottom: '4px' }}>
                        <button
                          type="button"
                          onClick={() => setCdsTab('alerts')}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: cdsTab === 'alerts' ? '#a855f7' : 'var(--text-muted)',
                            borderBottom: cdsTab === 'alerts' ? '2.5px solid #a855f7' : 'none',
                            padding: '4px 6px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            outline: 'none'
                          }}
                        >
                          Alert Logs ({interactions.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setCdsTab('graph')}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: cdsTab === 'graph' ? '#a855f7' : 'var(--text-muted)',
                            borderBottom: cdsTab === 'graph' ? '2.5px solid #a855f7' : 'none',
                            padding: '4px 6px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            outline: 'none'
                          }}
                        >
                          Live Interaction Map 🌐
                        </button>
                      </div>
                      
                      {cdsTab === 'graph' ? (
                        renderCDSGraph()
                      ) : isCheckingInteractions ? (
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

                      {/* Care Gaps Alerts */}
                      {careGaps.length > 0 && (
                        <div style={{ marginTop: '12px', borderTop: '1px solid var(--glass-border)', paddingTop: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                            <ShieldCheck size={16} color="#f59e0b" />
                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#f59e0b' }}>Protocol Care Gaps ({careGaps.length})</span>
                          </div>
                          <div style={styles.cdsAlertsList}>
                            {careGaps.map((gap: any, index: number) => (
                              <div 
                                key={index} 
                                style={{
                                  ...styles.cdsAlertItem,
                                  borderColor: gap.severity === 'high' ? '#ef4444' : '#f59e0b',
                                  backgroundColor: gap.severity === 'high' ? 'rgba(239, 68, 68, 0.05)' : 'rgba(245, 158, 11, 0.05)',
                                  marginBottom: '8px'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ 
                                    ...styles.cdsAlertBadge, 
                                    backgroundColor: gap.severity === 'high' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                    color: gap.severity === 'high' ? '#ef4444' : '#f59e0b'
                                  }}>
                                    {gap.type.toUpperCase().replace('_', ' ')}
                                  </span>
                                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                    CDS Guidelines Match
                                  </span>
                                </div>
                                <div style={{ fontWeight: 'bold', fontSize: '12px', marginTop: '4px', textAlign: 'left', color: 'white' }}>
                                  {gap.conditionName} Protocol Deviation
                                </div>
                                <p style={{ fontSize: '11px', margin: '4px 0 0 0', color: 'var(--text)', textAlign: 'left' }}>
                                  {gap.message}
                                </p>
                                <div style={{ fontSize: '10px', marginTop: '6px', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'left', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '4px' }}>
                                  Protocol: {gap.recommendedProtocol}
                                </div>
                              </div>
                            ))}
                          </div>
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

                    {/* Vertical Timeline Card */}
                    {(() => {
                      const buildTimelineEvents = (symptoms: any[], meds: any[], summaryAllergies: string[]) => {
                        const events: { title: string; description: string; type: 'symptom' | 'medication' | 'allergy'; daysAgo: number; isRedFlag?: boolean }[] = [];

                        const parseDurationToDays = (dur: string): number => {
                          if (!dur) return 999;
                          const match = dur.match(/(\d+)\s*(day|week|month|year|hour)/i);
                          if (!match) return 999;
                          const val = parseInt(match[1], 10);
                          const unit = match[2].toLowerCase();
                          if (unit.startsWith('hour')) return 0.1;
                          if (unit.startsWith('day')) return val;
                          if (unit.startsWith('week')) return val * 7;
                          if (unit.startsWith('month')) return val * 30;
                          if (unit.startsWith('year')) return val * 365;
                          return 999;
                        };

                        symptoms.forEach(s => {
                          const daysAgo = parseDurationToDays(s.duration || '');
                          events.push({
                            title: `Onset: ${s.name}`,
                            description: `Severity: ${s.severity} (Duration: ${s.duration || 'Unspecified'})`,
                            type: 'symptom',
                            daysAgo,
                            isRedFlag: s.isRedFlag
                          });
                        });

                        meds.forEach(m => {
                          events.push({
                            title: `Active Medication: ${m.name}`,
                            description: `${m.dosage || ''} ${m.frequency || ''}`.trim(),
                            type: 'medication',
                            daysAgo: 1000
                          });
                        });

                        if (summaryAllergies && Array.isArray(summaryAllergies)) {
                          summaryAllergies.forEach(a => {
                            events.push({
                              title: `Allergy: ${a}`,
                              description: `Contraindicated allergen group`,
                              type: 'allergy',
                              daysAgo: 1001
                            });
                          });
                        }

                        return events.sort((a, b) => a.daysAgo - b.daysAgo);
                      };

                      const timelineEvents = buildTimelineEvents(
                        sessionDetail.symptoms || [],
                        sessionDetail.medications || [],
                        sessionDetail.summary?.summaryData?.allergies || []
                      );

                      return (
                        <div style={styles.timelineCard} className="glass-panel">
                          <div style={styles.cardHeader}>
                            <FileText size={18} color="#3b82f6" />
                            <h3>Patient Intake & History Timeline</h3>
                          </div>
                          
                          <div style={styles.timelineScroll}>
                            {timelineEvents.length === 0 ? (
                              <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>No timeline details extracted.</p>
                            ) : (
                              <div style={styles.timelineContainer}>
                                <div style={styles.timelineLine}></div>
                                
                                {timelineEvents.map((ev, index) => {
                                  const isRed = ev.isRedFlag || ev.type === 'allergy';
                                  return (
                                    <div key={index} style={styles.timelineItem}>
                                      <div style={{
                                        ...styles.timelineNode,
                                        backgroundColor: isRed ? '#ef4444' : ev.type === 'medication' ? '#a855f7' : '#3b82f6',
                                        boxShadow: isRed ? '0 0 8px #ef4444' : 'none'
                                      }}></div>
                                      
                                      <div style={styles.timelineContent}>
                                        <span style={{ 
                                          ...styles.timelineTitle,
                                          color: isRed ? '#ef4444' : 'white'
                                        }}>
                                          {ev.title}
                                        </span>
                                        <span style={styles.timelineDesc}>{ev.description}</span>
                                        {ev.daysAgo !== 999 && ev.daysAgo < 1000 && (
                                          <span style={styles.timelineTimeTag}>
                                            {ev.daysAgo === 0.1 ? 'Hours ago' : ev.daysAgo === 1 ? '1 day ago' : `${ev.daysAgo} days ago`}
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
                    })()}

                    {/* Longitudinal Symptom Severity Trend Chart */}
                    {(() => {
                      if (patientHistory.length < 2) {
                        return (
                          <div style={styles.timelineCard} className="glass-panel">
                            <div style={styles.cardHeader}>
                              <FileText size={18} color="#a855f7" />
                              <h3>Longitudinal Symptom Severity Trend</h3>
                            </div>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', margin: '20px 0', textAlign: 'center' }}>
                              Additional historical sessions required to chart trend (Current: {patientHistory.length}).
                            </p>
                          </div>
                        );
                      }

                      const width = 360;
                      const height = 155;
                      const paddingLeft = 30;
                      const paddingRight = 15;
                      const paddingTop = 15;
                      const paddingBottom = 25;

                      const chartWidth = width - paddingLeft - paddingRight;
                      const chartHeight = height - paddingTop - paddingBottom;

                      const points = patientHistory.map((h) => {
                        const maxSev = getSessionMaxSeverity(h);
                        const date = new Date(h.createdAt);
                        const label = `${date.getMonth() + 1}/${date.getDate()}`;
                        return { maxSev, label, h };
                      });

                      const maxVal = 10;
                      const minVal = 0;

                      const coords = points.map((p, idx) => {
                        const x = paddingLeft + (idx / (points.length - 1)) * chartWidth;
                        const y = paddingTop + chartHeight - ((p.maxSev - minVal) / (maxVal - minVal)) * chartHeight;
                        return { x, y, label: p.label, maxSev: p.maxSev, h: p.h };
                      });

                      let pathD = '';
                      coords.forEach((c, idx) => {
                        if (idx === 0) {
                          pathD += `M ${c.x} ${c.y}`;
                        } else {
                          pathD += ` L ${c.x} ${c.y}`;
                        }
                      });

                      let areaD = pathD;
                      if (coords.length > 0) {
                        areaD += ` L ${coords[coords.length - 1].x} ${paddingTop + chartHeight}`;
                        areaD += ` L ${coords[0].x} ${paddingTop + chartHeight} Z`;
                      }

                      return (
                        <div style={styles.timelineCard} className="glass-panel">
                          <div style={styles.cardHeader}>
                            <FileText size={18} color="#a855f7" />
                            <h3>Longitudinal Symptom Severity Trend</h3>
                          </div>

                          <div style={{ marginTop: '10px', position: 'relative' }}>
                            <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                              <defs>
                                <linearGradient id="line-gradient" x1="0" y1="0" x2="1" y2="0">
                                  <stop offset="0%" stopColor="#3b82f6" />
                                  <stop offset="100%" stopColor="#a855f7" />
                                </linearGradient>
                                <linearGradient id="area-gradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="rgba(168, 85, 247, 0.2)" />
                                  <stop offset="100%" stopColor="rgba(168, 85, 247, 0.0)" />
                                </linearGradient>
                              </defs>

                              {[0, 2.5, 5, 7.5, 10].map((v) => {
                                const y = paddingTop + chartHeight - (v / 10) * chartHeight;
                                return (
                                  <g key={v}>
                                    <line 
                                      x1={paddingLeft} 
                                      y1={y} 
                                      x2={width - paddingRight} 
                                      y2={y} 
                                      stroke="rgba(255, 255, 255, 0.05)" 
                                      strokeWidth="1" 
                                      strokeDasharray="4"
                                    />
                                    <text 
                                      x={paddingLeft - 8} 
                                      y={y + 3} 
                                      fill="rgba(255, 255, 255, 0.3)" 
                                      fontSize="8" 
                                      textAnchor="end"
                                    >
                                      {v}
                                    </text>
                                  </g>
                                );
                              })}

                              <path d={areaD} fill="url(#area-gradient)" />

                              <path 
                                d={pathD} 
                                fill="none" 
                                stroke="url(#line-gradient)" 
                                strokeWidth="2.5" 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                              />

                              {coords.map((c, idx) => (
                                <g key={idx}>
                                  <circle 
                                    cx={c.x} 
                                    cy={c.y} 
                                    r="4.5" 
                                    fill="#a855f7" 
                                    stroke="#0f172a" 
                                    strokeWidth="1.5" 
                                    style={{ cursor: 'pointer' }}
                                  />
                                  <title>
                                    {`Session: ${c.label}\nMax Severity: ${c.maxSev}/10\nSymptoms: ${c.h.symptoms.map((s: any) => s.name).join(', ') || 'None'}\n${c.h.vitals ? `Vitals: HR=${c.h.vitals.heartRate} bpm, SpO2=${c.h.vitals.spo2}%` : 'No vitals logged'}`}
                                  </title>
                                  <text 
                                    x={c.x} 
                                    y={paddingTop + chartHeight + 14} 
                                    fill="rgba(255,255,255,0.4)" 
                                    fontSize="8" 
                                    textAnchor="middle"
                                  >
                                    {c.label}
                                  </text>
                                </g>
                              ))}
                            </svg>
                            <p style={{ color: 'var(--text-muted)', fontSize: '9px', marginTop: '6px', textAlign: 'center', fontStyle: 'italic' }}>
                              * Hover over data nodes to review symptoms and vitals.
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Vitals Telemetry Playback Slider Card */}
                    {renderVitalsPlayback()}

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

                        <button 
                          onClick={() => {
                            setShowPrintModal(true);
                            setAttestSoap(false);
                            setAttestTimeline(false);
                            setAttestCds(false);
                            setIsSigned(false);
                          }} 
                          className="btn btn-secondary" 
                          style={{ width: '100%', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                        >
                          <Printer size={16} /> Sign & Print SOAP Note
                        </button>
                      </div>
                    )}

                    {/* Patient discharge instructions card */}
                    {sessionDetail.summary && (
                      <div style={{ ...styles.syncContainer, marginTop: '20px' }} className="glass-panel">
                        <div style={styles.syncStatusBlock}>
                          <span>Patient Care Instructions:</span>
                          <span style={{ 
                            ...styles.syncStatusBadge,
                            backgroundColor: dischargeSummary ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                            color: dischargeSummary ? '#10b981' : '#f59e0b',
                            borderColor: dischargeSummary ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'
                          }}>
                            {dischargeSummary ? 'READY' : 'NOT GENERATED'}
                          </span>
                        </div>

                        {!dischargeSummary ? (
                          <button 
                            onClick={handleGenerateDischarge} 
                            className="btn" 
                            disabled={isGeneratingDischarge}
                            style={{ width: '100%' }}
                          >
                            {isGeneratingDischarge 
                              ? 'Generating translated instructions...' 
                              : `Generate Post-Visit Discharge Summary (${sessionDetail.session.preferredLanguage || 'en-US'})`}
                          </button>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{
                              background: 'rgba(0,0,0,0.25)',
                              padding: '12px',
                              borderRadius: '6px',
                              maxHeight: '180px',
                              overflowY: 'auto',
                              fontSize: '12px',
                              textAlign: 'left',
                              whiteSpace: 'pre-wrap',
                              border: '1px solid var(--glass-border)',
                              fontFamily: 'sans-serif',
                              color: 'var(--text-main)'
                            }}>
                              {dischargeSummary}
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <button 
                                onClick={handleGenerateDischarge} 
                                className="btn btn-secondary" 
                                style={{ flex: 1, fontSize: '12px', padding: '6px 12px' }}
                                disabled={isGeneratingDischarge}
                              >
                                {isGeneratingDischarge ? 'Regenerating...' : 'Regenerate'}
                              </button>
                              <button 
                                onClick={handleDownloadDischarge} 
                                className="btn" 
                                style={{ flex: 1, fontSize: '12px', padding: '6px 12px' }}
                              >
                                Download Guidelines
                              </button>
                            </div>
                          </div>
                        )}
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

                  {/* Clinician live telephony override barge-in console */}
                  {(() => {
                    const isCallLive = activeCalls.some(c => c.sessionId === selectedSessionId);
                    if (!isCallLive) return null;
                    return (
                      <div style={styles.bargeInConsole}>
                        <div style={styles.bargeInHeader}>
                          <span className="pulse-red-dot" style={{ marginRight: '6px' }}></span>
                          <span style={styles.liveLabel}>LIVE TELEPHONY BARGE-IN CONSOLE</span>
                        </div>
                        <div style={styles.bargeInRow}>
                          <input 
                            type="text" 
                            placeholder="Speak direct clinician intervention to patient..." 
                            value={bargeInText}
                            onChange={e => setBargeInText(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSendBargeIn(); }}
                            className="input-text"
                            style={styles.bargeInInput}
                            disabled={isSendingBargeIn}
                          />
                          <button 
                            onClick={handleSendBargeIn} 
                            className="btn" 
                            style={styles.bargeInBtn}
                            disabled={isSendingBargeIn || !bargeInText.trim()}
                          >
                            <Phone size={14} style={{ marginRight: '4px' }} /> Speak
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Floating Toggle Button */}
                <button 
                  onClick={() => setShowCopilotSidebar(prev => !prev)}
                  style={{
                    position: 'fixed',
                    bottom: '24px',
                    right: '24px',
                    width: '56px',
                    height: '56px',
                    borderRadius: '28px',
                    backgroundColor: '#a855f7',
                    border: 'none',
                    color: 'white',
                    boxShadow: '0 4px 16px rgba(168, 85, 247, 0.4)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 999,
                    fontSize: '22px'
                  }}
                  title="AI Clinical Copilot Sidebar"
                >
                  💬
                </button>

                {/* Copilot Sidebar Panel */}
                <div style={{
                  position: 'fixed',
                  top: 0,
                  right: showCopilotSidebar ? 0 : '-370px',
                  width: '350px',
                  height: '100vh',
                  backgroundColor: '#0f172a',
                  borderLeft: '1px solid var(--glass-border)',
                  boxShadow: '-4px 0 24px rgba(0,0,0,0.5)',
                  transition: 'right 0.3s ease-in-out',
                  display: 'flex',
                  flexDirection: 'column',
                  zIndex: 1000,
                  fontFamily: 'sans-serif'
                }}>
                  {/* Sidebar Header */}
                  <div style={{
                    padding: '16px',
                    borderBottom: '1px solid var(--glass-border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'rgba(255,255,255,0.02)'
                  }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '14px', color: 'white', fontWeight: 'bold' }}>Clinical Protocol Copilot</h4>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>RAG Guidelines Assistant</span>
                    </div>
                    <button 
                      onClick={() => setShowCopilotSidebar(false)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        fontSize: '18px',
                        cursor: 'pointer'
                      }}
                    >
                      &times;
                    </button>
                  </div>

                  {/* Message History list */}
                  <div style={{
                    flex: 1,
                    padding: '16px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    {copilotHistory.length === 0 ? (
                      <div style={{ margin: 'auto', textAlign: 'center', padding: '20px' }}>
                        <span style={{ fontSize: '32px' }}>🩺</span>
                        <h5 style={{ margin: '10px 0 4px 0', fontSize: '13px', color: 'white' }}>Ask Copilot Clinical Questions</h5>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                          Ask questions about treatment guidelines, drug dosages, or protocol pathways for this patient.
                        </p>
                        
                        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {[
                            'What is the recommended asthma protocol?',
                            'Hypertension medication contraindications?',
                            'Is chewable aspirin required for chest pain?'
                          ].map((prompt, pIdx) => (
                            <button
                              key={pIdx}
                              onClick={() => handleSendCopilotQuery(prompt)}
                              style={{
                                padding: '8px 12px',
                                borderRadius: '6px',
                                border: '1px solid var(--glass-border)',
                                backgroundColor: 'rgba(255,255,255,0.03)',
                                color: 'var(--text)',
                                fontSize: '11px',
                                textAlign: 'left',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s'
                              }}
                              onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
                              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'}
                            >
                              {prompt}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      copilotHistory.map((msg, idx) => {
                        const isUser = msg.sender === 'user';
                        return (
                          <div key={idx} style={{
                            alignSelf: isUser ? 'flex-end' : 'flex-start',
                            maxWidth: '85%',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px'
                          }}>
                            <div style={{
                              padding: '10px 12px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              lineHeight: '1.4',
                              color: 'white',
                              textAlign: 'left',
                              backgroundColor: isUser ? '#3b82f6' : 'rgba(255,255,255,0.06)',
                              border: isUser ? 'none' : '1px solid var(--glass-border)',
                              whiteSpace: 'pre-wrap'
                            }}>
                              {msg.text}
                            </div>
                            {!isUser && msg.citations && msg.citations.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                                {msg.citations.map((cit, cIdx) => (
                                  <span 
                                    key={cIdx} 
                                    style={{
                                      fontSize: '9px',
                                      color: '#a855f7',
                                      backgroundColor: 'rgba(168, 85, 247, 0.1)',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      border: '1px solid rgba(168, 85, 247, 0.2)'
                                    }}
                                    title={`Matching score: ${(cit.similarity * 100).toFixed(1)}%`}
                                  >
                                    📄 {cit.title} ({(cit.similarity * 100).toFixed(0)}%)
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                    {isCopilotLoading && (
                      <div style={{ alignSelf: 'flex-start', display: 'flex', gap: '4px', padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Copilot is thinking...</span>
                      </div>
                    )}
                  </div>

                  {/* Input Footer */}
                  <div style={{
                    padding: '12px',
                    borderTop: '1px solid var(--glass-border)',
                    backgroundColor: 'rgba(255,255,255,0.01)',
                    display: 'flex',
                    gap: '8px'
                  }}>
                    <input
                      type="text"
                      placeholder="Type clinical question..."
                      value={copilotQuery}
                      onChange={(e) => setCopilotQuery(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSendCopilotQuery(); }}
                      disabled={isCopilotLoading}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--glass-border)',
                        backgroundColor: 'rgba(0,0,0,0.2)',
                        color: 'white',
                        fontSize: '12px'
                      }}
                    />
                    <button 
                      onClick={() => handleSendCopilotQuery()}
                      disabled={isCopilotLoading || !copilotQuery.trim()}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        backgroundColor: '#a855f7',
                        border: 'none',
                        color: 'white',
                        fontSize: '12px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      Ask
                    </button>
                  </div>
                </div>
              </div>
            </>
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

      {showPrintModal && (
        <div style={styles.modalOverlay} className="no-print">
          <div style={{ ...styles.modalContent, maxWidth: '800px', backgroundColor: '#0f172a' }} className="glass-panel">
            <div style={styles.modalHeader} className="no-print">
              <h4 style={{ margin: 0, fontSize: '15px', color: 'white' }}>Clinical SOAP Note Export & Sign-Off</h4>
              <button onClick={() => setShowPrintModal(false)} style={styles.closeBtn}>&times;</button>
            </div>
            
            <div style={{ ...styles.modalBody, maxHeight: '70vh', overflowY: 'auto', padding: '24px', backgroundColor: '#0f172a' }}>
              
              <div id="clinical-note-print-area" style={{
                backgroundColor: 'white',
                color: '#0f172a',
                padding: '40px',
                borderRadius: '8px',
                fontFamily: 'Georgia, serif',
                textAlign: 'left',
                lineHeight: '1.6',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
              }}>
                <style>
                  {`
                    @media print {
                      body * {
                        visibility: hidden;
                      }
                      #clinical-note-print-area, #clinical-note-print-area * {
                        visibility: visible;
                      }
                      #clinical-note-print-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        box-shadow: none !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        background: white !important;
                        color: #0f172a !important;
                      }
                      .no-print {
                        display: none !important;
                      }
                      h1, h2, h3, h4, h5, h6, p, div, span, li, strong, td, th {
                        color: #0f172a !important;
                      }
                      @page {
                        size: A4;
                        margin: 20mm;
                      }
                    }
                  `}
                </style>

                <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: '15px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h1 style={{ margin: 0, fontSize: '20px', color: '#0f172a', fontFamily: 'Georgia, serif', fontWeight: 'bold' }}>INTAKERX CLINICAL PORTAL</h1>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Automated Patient Intake & Triage Summary</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', fontWeight: 'bold' }}>Date: {new Date(sessionDetail.session.createdAt).toLocaleDateString()}</div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>Session: {selectedSessionId.substring(0, 8).toUpperCase()}</div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '25px', padding: '15px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
                  <div>
                    <strong>Patient Name:</strong> {sessionDetail.session.patientName} <br />
                    <strong>Date of Birth:</strong> {sessionDetail.session.patientDob ? new Date(sessionDetail.session.patientDob).toLocaleDateString() : 'N/A'} <br />
                    <strong>Gender:</strong> {sessionDetail.session.patientSex || 'N/A'}
                  </div>
                  <div>
                    <strong>Insurance Provider:</strong> {sessionDetail.session.insuranceProvider || 'N/A'} <br />
                    <strong>Policy Number:</strong> {sessionDetail.session.insurancePolicy || 'N/A'} <br />
                    <strong>Preferred Language:</strong> {sessionDetail.session.preferredLanguage || 'en-US'}
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', fontSize: '14px', fontWeight: 'bold', color: '#0f172a', marginBottom: '8px' }}>SUBJECTIVE</h3>
                  <div style={{ fontSize: '12px', marginBottom: '15px' }}>
                    <p style={{ margin: '0 0 6px 0' }}><strong>Chief Complaint:</strong> {editChiefComplaint || 'None recorded'}</p>
                    <p style={{ margin: '0 0 6px 0' }}><strong>History of Present Illness (HPI):</strong> {editHpi || 'None recorded'}</p>
                    <p style={{ margin: '0' }}><strong>Past Medical History:</strong> {editPastHistory || 'None recorded'}</p>
                  </div>

                  <h3 style={{ borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', fontSize: '14px', fontWeight: 'bold', color: '#0f172a', marginBottom: '8px' }}>OBJECTIVE (VITALS & TELEMETRY)</h3>
                  <div style={{ fontSize: '12px', marginBottom: '15px' }}>
                    {(() => {
                      const latestVitals = sessionDetail.vitals && sessionDetail.vitals.length > 0 
                        ? sessionDetail.vitals[sessionDetail.vitals.length - 1] 
                        : null;
                      if (!latestVitals) {
                        return <p style={{ margin: '0 0 6px 0', fontStyle: 'italic', color: '#64748b' }}>No live vitals telemetry logged during this intake session.</p>;
                      }
                      return (
                        <p style={{ margin: '0 0 6px 0' }}>
                          <strong>Heart Rate:</strong> {latestVitals.heartRate} bpm | 
                          <strong> SpO2:</strong> {latestVitals.spo2}% | 
                          <strong> Blood Pressure:</strong> {latestVitals.bpSystolic}/{latestVitals.bpDiastolic} mmHg
                        </p>
                      );
                    })()}
                    <p style={{ margin: '0' }}><strong>Extracted Symptoms:</strong> {sessionDetail.symptoms?.map((s: any) => `${s.name} (${s.severity})`).join(', ') || 'None recorded'}</p>
                  </div>

                  <h3 style={{ borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', fontSize: '14px', fontWeight: 'bold', color: '#0f172a', marginBottom: '8px' }}>ASSESSMENT</h3>
                  <div style={{ fontSize: '12px', marginBottom: '15px' }}>
                    <p style={{ margin: '0 0 4px 0' }}><strong>Triage Level:</strong> {sessionDetail.session.triageLevel?.toUpperCase() || 'ROUTINE'}</p>
                    <p style={{ margin: '0' }}><strong>Clinical Rationale:</strong> {sessionDetail.session.triageRationale || 'Standard triage protocol matched.'}</p>
                  </div>

                  <h3 style={{ borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', fontSize: '14px', fontWeight: 'bold', color: '#0f172a', marginBottom: '8px' }}>PLAN</h3>
                  <div style={{ fontSize: '12px', marginBottom: '20px' }}>
                    <p style={{ margin: '0 0 6px 0' }}><strong>Active Medications:</strong> {editMeds?.map((m: any) => `${m.name} ${m.dosage || ''} ${m.frequency || ''}`).join(', ') || 'None reported'}</p>
                    {dischargeSummary && (
                      <div style={{ marginTop: '8px' }}>
                        <strong>Discharge Instructions ({sessionDetail.session.preferredLanguage || 'en-US'}):</strong>
                        <div style={{ whiteSpace: 'pre-wrap', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '4px', border: '1px solid #e2e8f0', marginTop: '4px', fontSize: '11px', fontFamily: 'sans-serif' }}>
                          {dischargeSummary}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '10px', marginTop: '20px', fontSize: '10px', color: '#475569' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px' }}>☑</span>
                      <span>I attest that I have reviewed this AI-generated intake note, verified all biometrics, and confirmed the diagnosis and plan.</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px' }}>☑</span>
                      <span>I confirm that all safety checks and clinical protocols have been verified.</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '30px' }}>
                  <div style={{ fontSize: '12px' }}>
                    <strong>Clinician:</strong> {clinician?.name || 'Dr. Smith'} <br />
                    <strong>Attested Date/Time:</strong> {new Date().toLocaleString()}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    {isSigned && canvasRef.current ? (
                      <img 
                        src={canvasRef.current.toDataURL()} 
                        alt="Clinician Signature" 
                        style={{ maxHeight: '45px', borderBottom: '1px solid #0f172a', paddingBottom: '3px' }}
                      />
                    ) : (
                      <div style={{ width: '150px', height: '40px', borderBottom: '1px dashed #cbd5e1' }}></div>
                    )}
                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '3px' }}>Clinician Authorized Signature</div>
                  </div>
                </div>
              </div>

              <div className="no-print" style={{ marginTop: '20px', padding: '15px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid var(--glass-border)', textAlign: 'left' }}>
                <h5 style={{ margin: '0 0 10px 0', fontSize: '13px', color: 'white', fontWeight: 'bold' }}>1. Attestation Checklist</h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: 'var(--text-main)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={attestSoap} onChange={(e) => setAttestSoap(e.target.checked)} />
                    I attest that I have reviewed the clinical SOAP note sections.
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={attestTimeline} onChange={(e) => setAttestTimeline(e.target.checked)} />
                    I verify all patient demographics, timeline details, and vital biometrics.
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={attestCds} onChange={(e) => setAttestCds(e.target.checked)} />
                    I confirm that clinical decision support warnings (drug conflicts, allergens) have been evaluated.
                  </label>
                </div>

                <h5 style={{ margin: '20px 0 10px 0', fontSize: '13px', color: 'white', fontWeight: 'bold' }}>2. Draw Signature Pad (Stylus/Mouse)</h5>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                  <div style={{ border: '1px solid var(--glass-border)', borderRadius: '4px', overflow: 'hidden' }}>
                    <canvas
                      ref={canvasRef}
                      width={300}
                      height={100}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      style={{
                        backgroundColor: '#f1f5f9',
                        cursor: 'crosshair',
                        display: 'block'
                      }}
                    />
                  </div>
                  <button onClick={clearSignature} className="btn btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }}>
                    Clear Signature
                  </button>
                </div>
              </div>

            </div>
            
            <div style={styles.modalFooter} className="no-print">
              <button onClick={() => setShowPrintModal(false)} className="btn btn-secondary" style={{ fontSize: '13px', padding: '8px 16px' }}>
                Cancel
              </button>
              <button 
                onClick={() => window.print()} 
                className="btn" 
                disabled={!attestSoap || !attestTimeline || !attestCds || !isSigned}
                style={{ fontSize: '13px', padding: '8px 16px' }}
              >
                Print SOAP Note to PDF
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
  },
  timelineCard: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '15px'
  },
  timelineScroll: {
    maxHeight: '260px',
    overflowY: 'auto',
    paddingRight: '5px'
  },
  timelineContainer: {
    position: 'relative',
    paddingLeft: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    textAlign: 'left'
  },
  timelineLine: {
    position: 'absolute',
    left: '4px',
    top: '5px',
    bottom: '5px',
    width: '2px',
    backgroundColor: 'var(--glass-border)'
  },
  timelineItem: {
    position: 'relative',
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start'
  },
  timelineNode: {
    position: 'absolute',
    left: '-20px',
    top: '5px',
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    zIndex: 2
  },
  timelineContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px'
  },
  timelineTitle: {
    fontSize: '13px',
    fontWeight: 'bold'
  },
  timelineDesc: {
    fontSize: '11px',
    color: 'var(--text-muted)'
  },
  timelineTimeTag: {
    fontSize: '9px',
    color: '#3b82f6',
    background: 'rgba(59, 130, 246, 0.1)',
    borderRadius: '3px',
    padding: '1px 4px',
    width: 'fit-content',
    marginTop: '2px'
  },
  activeCallsSection: {
    borderTop: '1px solid var(--glass-border)',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxHeight: '40%',
    minHeight: '180px',
    textAlign: 'left'
  },
  sectionSubHeader: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '4px'
  },
  activeCallsScroll: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  emptySubListText: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: '10px',
    width: '100%'
  },
  activeCallRow: {
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid var(--glass-border)',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    transition: 'all 0.2s ease'
  },
  activeCallInfo: {
    display: 'flex',
    flexDirection: 'column',
    textAlign: 'left'
  },
  activeCallName: {
    fontSize: '13px',
    fontWeight: 'bold'
  },
  activeCallId: {
    fontSize: '10px',
    color: 'var(--text-muted)'
  },
  activeCallStatus: {
    fontSize: '10px',
    fontWeight: 'bold',
    color: '#a855f7',
    background: 'rgba(168, 85, 247, 0.1)',
    border: '1px solid rgba(168, 85, 247, 0.2)',
    padding: '2px 6px',
    borderRadius: '4px'
  },
  bargeInConsole: {
    borderTop: '1px solid var(--glass-border)',
    padding: '16px',
    backgroundColor: 'rgba(168, 85, 247, 0.02)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  bargeInHeader: {
    display: 'flex',
    alignItems: 'center',
    textAlign: 'left'
  },
  liveLabel: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#ef4444',
    letterSpacing: '0.5px'
  },
  bargeInRow: {
    display: 'flex',
    gap: '8px'
  },
  bargeInInput: {
    flex: 1,
    padding: '8px 12px',
    fontSize: '13px'
  },
  bargeInBtn: {
    padding: '8px 16px',
    fontSize: '13px',
    backgroundColor: '#a855f7',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center'
  }
};
