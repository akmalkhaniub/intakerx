import React, { useState, useEffect } from 'react';
import { 
  Wifi, WifiOff, AlertOctagon, RefreshCw, Plus, Check,
  Radio, ShieldAlert
} from 'lucide-react';
import { OfflineSyncEngine, OfflineFieldIntake, StartCriteria } from '../services/offlineSync';

interface DisasterModeBannerProps {
  backendUrl?: string;
  token?: string;
  clinicianName?: string;
  onSyncComplete?: () => void;
}

export const DisasterModeBanner: React.FC<DisasterModeBannerProps> = ({
  backendUrl = '',
  clinicianName = 'Dr. Sarah Jenkins, MD',
  onSyncComplete
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [disasterModeActive, setDisasterModeActive] = useState<boolean>(false);
  const [incidentName, setIncidentName] = useState<string>('');
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string>('');

  // Rapid Triage Modal State
  const [showTriageModal, setShowTriageModal] = useState<boolean>(false);
  const [victimName, setVictimName] = useState<string>('');
  const [chiefComplaint, setChiefComplaint] = useState<string>('');
  const [responderId, setResponderId] = useState<string>(clinicianName || 'EMT Field Responder');
  
  // START Criteria State
  const [canWalk, setCanWalk] = useState<boolean>(false);
  const [hasBreathing, setHasBreathing] = useState<boolean>(true);
  const [airwayPositioned, setAirwayPositioned] = useState<boolean>(false);
  const [respiratoryRate, setRespiratoryRate] = useState<number>(20);
  const [hasRadialPulse, setHasRadialPulse] = useState<boolean>(true);
  const [capRefillFast, setCapRefillFast] = useState<boolean>(true);
  const [followsCommands, setFollowsCommands] = useState<boolean>(true);
  const [tagOverride, setTagOverride] = useState<'RED' | 'YELLOW' | 'GREEN' | 'BLACK' | ''>('');

  // Toggle Disaster Mode Modal State
  const [showToggleModal, setShowToggleModal] = useState<boolean>(false);
  const [toggleIncidentInput, setToggleIncidentInput] = useState<string>('Mass Casualty Incident Surge');

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      autoSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    updatePendingCount();
    fetchDisasterStatus();

    const interval = setInterval(() => {
      fetchDisasterStatus();
      updatePendingCount();
    }, 15000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const updatePendingCount = () => {
    const pending = OfflineSyncEngine.getPendingIntakes();
    setPendingCount(pending.length);
  };

  const fetchDisasterStatus = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/intake/disaster-mode/status`);
      if (res.ok) {
        const data = await res.json();
        setDisasterModeActive(Boolean(data.isActive));
        setIncidentName(data.incidentName || '');
      }
    } catch {
      // Offline fallback: keep existing state
    }
  };

  const autoSync = async () => {
    if (!navigator.onLine) return;
    setIsSyncing(true);
    try {
      const report = await OfflineSyncEngine.syncPendingIntakes(backendUrl);
      updatePendingCount();
      if (report.syncedCount > 0) {
        setSyncStatusMsg(`Synced ${report.syncedCount} offline record(s)`);
        setTimeout(() => setSyncStatusMsg(''), 4000);
        if (onSyncComplete) onSyncComplete();
      }
    } catch (err) {
      console.error('Auto sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const report = await OfflineSyncEngine.syncPendingIntakes(backendUrl);
      updatePendingCount();
      setSyncStatusMsg(`Successfully uploaded ${report.syncedCount} field record(s).`);
      setTimeout(() => setSyncStatusMsg(''), 4000);
      if (onSyncComplete) onSyncComplete();
    } catch (err) {
      setSyncStatusMsg('Sync failed: Network host unreachable.');
      setTimeout(() => setSyncStatusMsg(''), 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  const currentCriteria: StartCriteria = {
    canWalk,
    hasSpontaneousBreathing: hasBreathing,
    airwayRepositioned: airwayPositioned,
    respiratoryRate,
    hasRadialPulse,
    capillaryRefillSec: capRefillFast ? 1.5 : 3.5,
    followsCommands
  };

  const computedStart = OfflineSyncEngine.computeLocalStartTriage(currentCriteria);
  const activeTag = tagOverride || computedStart.tag;

  const getTagColor = (tag: string) => {
    switch (tag) {
      case 'RED': return '#ef4444';
      case 'YELLOW': return '#eab308';
      case 'GREEN': return '#22c55e';
      case 'BLACK': return '#64748b';
      default: return '#38bdf8';
    }
  };

  const handleSaveFieldIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    const offlineIntake: Omit<OfflineFieldIntake, 'localComputedTag'> = {
      offlineId: `FLD-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      timestamp: new Date().toISOString(),
      fieldResponder: responderId,
      patientName: victimName || undefined,
      chiefComplaint: chiefComplaint || 'Disaster Trauma / Medical Assessment',
      startCriteria: currentCriteria,
      triageTagOverride: tagOverride ? tagOverride : undefined,
      vitalSigns: {
        respiratoryRate
      }
    };

    OfflineSyncEngine.saveOfflineIntake(offlineIntake);
    updatePendingCount();
    setShowTriageModal(false);

    // Reset Form
    setVictimName('');
    setChiefComplaint('');
    setCanWalk(false);
    setHasBreathing(true);
    setTagOverride('');

    // If online, immediately push
    if (navigator.onLine) {
      autoSync();
    }
  };

  const handleToggleDisasterMode = async () => {
    const nextState = !disasterModeActive;
    try {
      const res = await fetch(`${backendUrl}/api/intake/disaster-mode/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isActive: nextState,
          activatedBy: clinicianName,
          incidentName: toggleIncidentInput
        })
      });
      if (res.ok) {
        setDisasterModeActive(nextState);
        setIncidentName(toggleIncidentInput);
        setShowToggleModal(false);
      }
    } catch (err) {
      console.error('Failed to toggle disaster mode:', err);
    }
  };

  return (
    <>
      {/* Top Banner Bar */}
      <div style={{
        background: disasterModeActive 
          ? 'linear-gradient(90deg, #7f1d1d 0%, #991b1b 50%, #7f1d1d 100%)' 
          : !isOnline 
          ? 'linear-gradient(90deg, #78350f 0%, #b45309 100%)'
          : 'rgba(15, 23, 42, 0.95)',
        borderBottom: disasterModeActive 
          ? '2px solid #ef4444' 
          : !isOnline 
          ? '2px solid #f59e0b' 
          : '1px solid rgba(255,255,255,0.08)',
        color: '#fff',
        padding: '8px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '13px',
        boxShadow: disasterModeActive ? '0 2px 15px rgba(239, 68, 68, 0.3)' : 'none',
        transition: 'all 0.3s ease'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Network Indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '3px 8px',
            borderRadius: '12px',
            background: isOnline ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.3)',
            color: isOnline ? '#4ade80' : '#fca5a5',
            fontWeight: 'bold',
            fontSize: '11px'
          }}>
            {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
            {isOnline ? 'ONLINE' : 'OFFLINE FIELD MODE'}
          </div>

          {/* Disaster Mode Title */}
          {disasterModeActive ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="pulse-red" style={{ display: 'inline-flex' }}>
                <AlertOctagon size={16} color="#fca5a5" />
              </span>
              <strong style={{ letterSpacing: '0.5px' }}>
                EMERGENCY DISASTER MODE ACTIVE:
              </strong>
              <span style={{ color: '#fed7aa' }}>{incidentName || 'MCI Protocol Engaged'}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted, #94a3b8)' }}>
              <Radio size={14} color="#38bdf8" />
              <span>Normal Facility Operations</span>
            </div>
          )}

          {/* Pending Queue Tag */}
          {pendingCount > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              borderRadius: '12px',
              background: 'rgba(245, 158, 11, 0.25)',
              border: '1px solid #f59e0b',
              color: '#fef08a',
              fontSize: '11px',
              fontWeight: 'bold'
            }}>
              <span>⚡ {pendingCount} Field Intake(s) Queued Offline</span>
            </div>
          )}

          {syncStatusMsg && (
            <span style={{ color: '#4ade80', fontSize: '12px', fontStyle: 'italic' }}>
              {syncStatusMsg}
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setShowTriageModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 12px',
              borderRadius: '6px',
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              fontWeight: 'bold',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            <Plus size={14} />
            MCI START Triage
          </button>

          {pendingCount > 0 && isOnline && (
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 12px',
                borderRadius: '6px',
                background: '#0284c7',
                color: '#fff',
                border: 'none',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={13} className={isSyncing ? 'spin' : ''} />
              Sync Queue ({pendingCount})
            </button>
          )}

          <button
            onClick={() => setShowToggleModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 10px',
              borderRadius: '6px',
              background: 'rgba(255,255,255,0.1)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.2)',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            <ShieldAlert size={13} />
            {disasterModeActive ? 'Deactivate Disaster' : 'Engage Disaster'}
          </button>
        </div>
      </div>

      {/* Modal: Rapid START Triage Form */}
      {showTriageModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '20px'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '580px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            padding: '22px',
            gap: '16px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertOctagon size={22} color="#ef4444" />
                <h3 style={{ margin: 0, fontSize: '18px', color: '#f8fafc' }}>
                  START Field Triage Rapid Classifier
                </h3>
              </div>
              <button
                onClick={() => setShowTriageModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '22px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            {/* Live Computed START Tag Card */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              borderRadius: '8px',
              background: 'rgba(15, 23, 42, 0.8)',
              border: `2px solid ${getTagColor(activeTag)}`
            }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase' }}>
                  Recommended START Classification
                </div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: getTagColor(activeTag) }}>
                  TAG {activeTag}: {computedStart.label}
                </div>
              </div>

              {/* Tag Override Pills */}
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['RED', 'YELLOW', 'GREEN', 'BLACK'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTagOverride(tagOverride === t ? '' : t)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      border: `1px solid ${getTagColor(t)}`,
                      background: activeTag === t ? getTagColor(t) : 'transparent',
                      color: activeTag === t ? (t === 'YELLOW' ? '#000' : '#fff') : getTagColor(t),
                      fontSize: '11px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSaveFieldIntake} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: '#94a3b8', marginBottom: '3px' }}>
                    Victim Name / Identifier (or leave blank for alias):
                  </label>
                  <input
                    type="text"
                    value={victimName}
                    onChange={(e) => setVictimName(e.target.value)}
                    placeholder="e.g. Victim #42 / John Doe"
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      background: '#1e293b',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.15)',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: '#94a3b8', marginBottom: '3px' }}>
                    Field Responder ID:
                  </label>
                  <input
                    type="text"
                    value={responderId}
                    onChange={(e) => setResponderId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      background: '#1e293b',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.15)',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* START Criteria Checklist */}
              <div style={{
                background: 'rgba(30, 41, 59, 0.5)',
                padding: '12px',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#f8fafc', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={canWalk}
                    onChange={(e) => setCanWalk(e.target.checked)}
                  />
                  <span>1. Ambulatory (Able to walk when instructed) &rarr; <strong>GREEN</strong></span>
                </label>

                {!canWalk && (
                  <>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#f8fafc', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={hasBreathing}
                        onChange={(e) => setHasBreathing(e.target.checked)}
                      />
                      <span>2. Spontaneous Breathing Present</span>
                    </label>

                    {!hasBreathing && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#fca5a5', marginLeft: '20px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={airwayPositioned}
                          onChange={(e) => setAirwayPositioned(e.target.checked)}
                        />
                        <span>Airway opened/repositioned (Breathing restored &rarr; RED, Apneic &rarr; BLACK)</span>
                      </label>
                    )}

                    {hasBreathing && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#f8fafc' }}>
                        <span>3. Respiratory Rate (bpm):</span>
                        <input
                          type="number"
                          value={respiratoryRate}
                          onChange={(e) => setRespiratoryRate(Number(e.target.value))}
                          style={{
                            width: '70px',
                            padding: '4px 6px',
                            borderRadius: '4px',
                            background: '#0f172a',
                            color: respiratoryRate > 30 || respiratoryRate < 10 ? '#ef4444' : '#fff',
                            border: '1px solid rgba(255,255,255,0.2)'
                          }}
                        />
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>(&gt;30 or &lt;10 = RED)</span>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#f8fafc', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={hasRadialPulse}
                          onChange={(e) => setHasRadialPulse(e.target.checked)}
                        />
                        <span>Radial Pulse Present</span>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#f8fafc', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={capRefillFast}
                          onChange={(e) => setCapRefillFast(e.target.checked)}
                        />
                        <span>Capillary Refill &le; 2 sec</span>
                      </label>
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#f8fafc', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={followsCommands}
                        onChange={(e) => setFollowsCommands(e.target.checked)}
                      />
                      <span>4. Follows Simple Verbal Commands (Intact Cognition)</span>
                    </label>
                  </>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', color: '#94a3b8', marginBottom: '3px' }}>
                  Injuries / Rapid Chief Complaint:
                </label>
                <input
                  type="text"
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  placeholder="e.g. Open femur fracture with active bleeding / Flail chest"
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: '6px',
                    background: '#1e293b',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.15)',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowTriageModal(false)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '6px',
                    background: 'transparent',
                    color: '#94a3b8',
                    border: '1px solid rgba(255,255,255,0.15)',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 18px',
                    borderRadius: '6px',
                    background: getTagColor(activeTag),
                    color: activeTag === 'YELLOW' ? '#000' : '#fff',
                    border: 'none',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  <Check size={16} />
                  Queue Tag [{activeTag}]
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Commander Toggle Disaster Mode */}
      {showToggleModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '20px'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '480px',
            padding: '22px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '17px', color: '#f8fafc' }}>
                {disasterModeActive ? 'Deactivate Disaster Mode' : 'Activate Disaster Mode'}
              </h3>
              <button
                onClick={() => setShowToggleModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted, #94a3b8)', lineHeight: '1.4' }}>
              {disasterModeActive 
                ? 'Deactivating will restore standard clinical intake workflows, enable routine non-urgent questionnaires, and clear mass casualty priority routing.'
                : 'Activating Disaster Mode engages streamlined START field triage tags, alerts all connected provider workstations, and bypasses non-critical registration questions.'}
            </p>

            {!disasterModeActive && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                  Incident Name / Code:
                </label>
                <input
                  type="text"
                  value={toggleIncidentInput}
                  onChange={(e) => setToggleIncidentInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: '#1e293b',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.15)',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                onClick={() => setShowToggleModal(false)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '6px',
                  background: 'transparent',
                  color: '#94a3b8',
                  border: '1px solid rgba(255,255,255,0.15)',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleToggleDisasterMode}
                style={{
                  padding: '7px 18px',
                  borderRadius: '6px',
                  background: disasterModeActive ? '#22c55e' : '#ef4444',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                {disasterModeActive ? 'Restore Normal Mode' : 'Activate MCI Protocol'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DisasterModeBanner;
