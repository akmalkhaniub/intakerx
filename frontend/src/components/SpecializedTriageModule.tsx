import React, { useState, useEffect } from 'react';
import { 
  Baby, AlertTriangle, ShieldCheck, 
  Users, RefreshCw, Save, UserCheck, HeartPulse
} from 'lucide-react';

export interface SpecializedAssessment {
  id: number;
  session_id: string;
  patient_type: 'pediatric' | 'geriatric' | 'standard';
  pews_score?: number;
  pews_data?: any;
  morse_fall_score?: number;
  morse_data?: any;
  frailty_score?: number;
  delirium_detected?: boolean;
  atypical_presentation_flags?: string[];
  proxy_id?: number;
  proxy_name?: string;
  relationship?: string;
  proxy_phone?: string;
  access_level?: string;
  clinician_recommendations?: string;
  created_at: string;
}

export interface CaregiverProxy {
  id: number;
  patient_id: number;
  proxy_name: string;
  relationship: string;
  phone: string;
  email?: string;
  access_level: string;
  consent_verified: boolean;
}

interface SpecializedTriageModuleProps {
  sessionId?: string;
  patientId?: number;
  token?: string;
  backendUrl?: string;
  patientName?: string;
  patientDob?: string;
}

export const SpecializedTriageModule: React.FC<SpecializedTriageModuleProps> = ({
  sessionId,
  patientId,
  token,
  backendUrl = '',
  patientName = 'Encounter Patient'
}) => {
  const [activeCategory, setActiveCategory] = useState<'pediatric' | 'geriatric'>('pediatric');
  const [assessment, setAssessment] = useState<SpecializedAssessment | null>(null);
  const [proxies, setProxies] = useState<CaregiverProxy[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Pediatric PEWS State
  const [pewsBehavior, setPewsBehavior] = useState<0 | 1 | 2 | 3>(0);
  const [pewsCardio, setPewsCardio] = useState<0 | 1 | 2 | 3>(0);
  const [pewsResp, setPewsResp] = useState<0 | 1 | 2 | 3>(0);
  const [pewsNeb, setPewsNeb] = useState(false);
  const [pewsVomit, setPewsVomit] = useState(false);

  // Geriatric Morse State
  const [morseHistoryFalls, setMorseHistoryFalls] = useState(false);
  const [morseSecondaryDx, setMorseSecondaryDx] = useState(false);
  const [morseAid, setMorseAid] = useState<'none_bedrest' | 'crutches_cane_walker' | 'furniture_support'>('none_bedrest');
  const [morseIv, setMorseIv] = useState(false);
  const [morseGait, setMorseGait] = useState<'normal_bedrest' | 'weak' | 'impaired_hesitant'>('normal_bedrest');
  const [morseMental, setMorseMental] = useState<'knows_own_limits' | 'overestimates_or_forgets'>('knows_own_limits');

  // Geriatric Syndromes & Delirium
  const [hasAcuteConfusion, setHasAcuteConfusion] = useState(false);
  const [cfsScore, setCfsScore] = useState<number>(3);
  const [selectedProxyId, setSelectedProxyId] = useState<number | undefined>(undefined);

  // Proxy Registration Modal
  const [showProxyModal, setShowProxyModal] = useState(false);
  const [newProxyName, setNewProxyName] = useState('');
  const [newProxyRel, setNewProxyRel] = useState('Parent (Mother)');
  const [newProxyPhone, setNewProxyPhone] = useState('555-019-3382');
  const [newProxyEmail, setNewProxyEmail] = useState('');
  const [newProxyAccess, setNewProxyAccess] = useState<'full' | 'intake_only' | 'view_only'>('full');

  useEffect(() => {
    if (sessionId) {
      fetchAssessment();
    }
    if (patientId) {
      fetchProxies();
    }
  }, [sessionId, patientId]);

  const fetchAssessment = async () => {
    if (!sessionId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/clinician/sessions/${sessionId}/specialized-triage`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setAssessment(data);
          if (data.patient_type === 'pediatric' || data.patient_type === 'geriatric') {
            setActiveCategory(data.patient_type);
          }
          if (data.proxy_id) {
            setSelectedProxyId(data.proxy_id);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch specialized assessment:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProxies = async () => {
    if (!patientId) return;
    try {
      const res = await fetch(`${backendUrl}/api/clinician/patients/${patientId}/proxies`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProxies(data);
        if (data.length > 0 && !selectedProxyId) {
          setSelectedProxyId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch proxies:', err);
    }
  };

  // Local PEWS Calculation
  const computedPewsScore = pewsBehavior + pewsCardio + pewsResp + (pewsNeb ? 2 : 0) + (pewsVomit ? 2 : 0);
  const pewsTier = computedPewsScore >= 5 ? 'HIGH' : computedPewsScore >= 3 ? 'MEDIUM' : 'LOW';
  const pewsColor = pewsTier === 'HIGH' ? '#ef4444' : pewsTier === 'MEDIUM' ? '#f59e0b' : '#10b981';

  // Local Morse Calculation
  let computedMorseScore = 0;
  if (morseHistoryFalls) computedMorseScore += 25;
  if (morseSecondaryDx) computedMorseScore += 15;
  if (morseAid === 'furniture_support') computedMorseScore += 30;
  else if (morseAid === 'crutches_cane_walker') computedMorseScore += 15;
  if (morseIv) computedMorseScore += 20;
  if (morseGait === 'impaired_hesitant') computedMorseScore += 20;
  else if (morseGait === 'weak') computedMorseScore += 10;
  if (morseMental === 'overestimates_or_forgets') computedMorseScore += 15;

  const morseTier = computedMorseScore >= 51 ? 'HIGH' : computedMorseScore >= 25 ? 'MODERATE' : 'LOW';
  const morseColor = morseTier === 'HIGH' ? '#ef4444' : morseTier === 'MODERATE' ? '#f59e0b' : '#10b981';

  const handleSaveAssessment = async () => {
    if (!sessionId) return;
    setIsSaving(true);
    try {
      const payload: any = {
        patientType: activeCategory,
        proxyId: selectedProxyId
      };

      if (activeCategory === 'pediatric') {
        payload.pewsCriteria = {
          behavior: pewsBehavior,
          cardiovascular: pewsCardio,
          respiratory: pewsResp,
          nebulizerFrequent: pewsNeb,
          persistentVomitingPostOp: pewsVomit
        };
      } else {
        payload.morseCriteria = {
          historyOfFalls: morseHistoryFalls,
          secondaryDiagnosis: morseSecondaryDx,
          ambulatoryAid: morseAid,
          ivSalineLock: morseIv,
          gait: morseGait,
          mentalStatus: morseMental
        };
        payload.geriatricScreen = {
          hasAcuteConfusion,
          cfsScore,
          symptoms: hasAcuteConfusion ? ['acute confusion', 'unsteady gait'] : []
        };
      }

      const res = await fetch(`${backendUrl}/api/clinician/sessions/${sessionId}/specialized-triage/assess`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSaveSuccessMsg('Assessment recorded & precautions broadcasted.');
        setTimeout(() => setSaveSuccessMsg(''), 4000);
        fetchAssessment();
      }
    } catch (err) {
      console.error('Failed to save assessment:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegisterProxy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) return;
    try {
      const res = await fetch(`${backendUrl}/api/clinician/patients/${patientId}/proxies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          proxyName: newProxyName,
          relationship: newProxyRel,
          phone: newProxyPhone,
          email: newProxyEmail || undefined,
          accessLevel: newProxyAccess
        })
      });
      if (res.ok) {
        const data = await res.json();
        setShowProxyModal(false);
        fetchProxies();
        setSelectedProxyId(data.proxy.id);
      }
    } catch (err) {
      console.error('Failed to register proxy:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Top Banner & Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px',
        borderRadius: '12px',
        background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.12) 0%, rgba(56, 189, 248, 0.08) 100%)',
        border: '1px solid rgba(236, 72, 153, 0.3)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
            padding: '12px',
            borderRadius: '10px',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <HeartPulse size={28} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: 'var(--text-main, #f8fafc)' }}>
              Pediatric & Geriatric Specialized Triage Protocols
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted, #94a3b8)' }}>
              Encounter: <strong style={{ color: '#38bdf8' }}>{patientName}</strong> &bull; PEWS Vital Scoring &bull; Morse Fall Risk &bull; Delirium / Atypical Syndromes &bull; Caregiver Proxy Delegation
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {saveSuccessMsg && (
            <span style={{ color: '#10b981', fontSize: '13px', fontWeight: '600' }}>
              {saveSuccessMsg}
            </span>
          )}
          <button
            onClick={handleSaveAssessment}
            disabled={isSaving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '8px',
              background: '#ec4899',
              color: '#fff',
              border: 'none',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            <Save size={16} />
            {isSaving ? 'Broadcasting...' : 'Save & Broadcast Precautions'}
          </button>
          <button
            onClick={fetchAssessment}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '8px',
              padding: '10px',
              color: 'var(--text-muted, #94a3b8)',
              cursor: 'pointer'
            }}
            title="Refresh Assessment"
          >
            <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Protocol Category Toggle */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
        <button
          onClick={() => setActiveCategory('pediatric')}
          style={{
            background: 'none',
            border: 'none',
            color: activeCategory === 'pediatric' ? '#ec4899' : 'var(--text-muted, #94a3b8)',
            borderBottom: activeCategory === 'pediatric' ? '2.5px solid #ec4899' : 'none',
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Baby size={18} />
          Pediatric Triage (PEWS Protocol)
        </button>
        <button
          onClick={() => setActiveCategory('geriatric')}
          style={{
            background: 'none',
            border: 'none',
            color: activeCategory === 'geriatric' ? '#f59e0b' : 'var(--text-muted, #94a3b8)',
            borderBottom: activeCategory === 'geriatric' ? '2.5px solid #f59e0b' : 'none',
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <AlertTriangle size={18} />
          Geriatric Vulnerability (Morse Fall Risk & Delirium)
        </button>
      </div>

      {/* Caregiver Proxy Card */}
      <div style={{
        padding: '16px 20px',
        borderRadius: '10px',
        background: 'rgba(30, 41, 59, 0.6)',
        border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'rgba(56, 189, 248, 0.15)',
            color: '#38bdf8',
            padding: '8px',
            borderRadius: '8px'
          }}>
            <Users size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase' }}>
              Designated Caregiver Proxy / Legal Guardian
            </div>
            {proxies.length > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px' }}>
                <select
                  value={selectedProxyId}
                  onChange={(e) => setSelectedProxyId(Number(e.target.value))}
                  style={{
                    background: '#1e293b',
                    color: '#f8fafc',
                    border: '1px solid rgba(255,255,255,0.15)',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '13px'
                  }}
                >
                  {proxies.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.proxy_name} &bull; {p.relationship} ({p.access_level.toUpperCase()})
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '12px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ShieldCheck size={14} /> HIPAA Authorized
                </span>
              </div>
            ) : (
              <span style={{ fontSize: '13px', color: 'var(--text-muted, #94a3b8)' }}>
                No proxy registered. Self-represented encounter or pediatric caregiver pending intake verification.
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => setShowProxyModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '6px',
            background: 'rgba(255,255,255,0.06)',
            color: '#f8fafc',
            border: '1px solid rgba(255,255,255,0.15)',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          <UserCheck size={14} />
          {proxies.length > 0 ? 'Add Additional Proxy' : 'Designate Caregiver Proxy'}
        </button>
      </div>

      {assessment && (
        <div style={{
          padding: '10px 16px',
          borderRadius: '8px',
          background: 'rgba(15, 23, 42, 0.5)',
          border: '1px solid rgba(255,255,255,0.08)',
          fontSize: '12.5px',
          color: 'var(--text-muted, #94a3b8)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>
            Last Recorded Assessment: <strong style={{ color: '#f8fafc' }}>{assessment.patient_type.toUpperCase()}</strong> (PEWS: {assessment.pews_score ?? 'N/A'}, Morse: {assessment.morse_fall_score ?? 'N/A'})
          </span>
          <span style={{ fontSize: '11.5px', color: '#64748b' }}>
            {new Date(assessment.created_at).toLocaleString()}
          </span>
        </div>
      )}

      {/* PEDIATRIC PEWS PROTOCOL VIEW */}
      {activeCategory === 'pediatric' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* PEWS Real-Time Gauge Banner */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderRadius: '12px',
            background: 'rgba(15, 23, 42, 0.8)',
            border: `2px solid ${pewsColor}`
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  background: `${pewsColor}25`,
                  color: pewsColor,
                  fontWeight: 'bold',
                  fontSize: '12px'
                }}>
                  {pewsTier} RISK
                </span>
                <span style={{ fontSize: '13px', color: 'var(--text-muted, #94a3b8)' }}>
                  Pediatric Early Warning Score
                </span>
              </div>
              <h3 style={{ margin: '6px 0 2px', fontSize: '18px', color: '#f8fafc' }}>
                {pewsTier === 'HIGH' 
                  ? '🚨 STAT CRITICAL: Activate Pediatric Rapid Response Team (PRRT)' 
                  : pewsTier === 'MEDIUM' 
                  ? '⚠️ MEDIUM RISK: Increase Observations to Hourly & Notify Senior Nurse' 
                  : '✅ LOW RISK: Routine 4-Hour Pediatric Vital Observations'}
              </h3>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase' }}>
                Calculated PEWS
              </div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: pewsColor }}>
                {computedPewsScore}<span style={{ fontSize: '16px', color: 'var(--text-muted, #94a3b8)' }}>/11</span>
              </div>
            </div>
          </div>

          {/* PEWS Multi-Domain Inputs */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '14px'
          }}>
            {/* Behavior Domain */}
            <div style={{
              padding: '16px',
              borderRadius: '10px',
              background: 'rgba(30, 41, 59, 0.7)',
              border: '1px solid rgba(255,255,255,0.08)'
            }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#f8fafc', marginBottom: '8px' }}>
                1. Behavior & Neurological State
              </label>
              {[
                { val: 0, label: '0: Playing / Appropriate for age' },
                { val: 1, label: '1: Sleeping / Easily rousable' },
                { val: 2, label: '2: Irritable / Inconsolable crying' },
                { val: 3, label: '3: Lethargic / Floppy / Reduced pain response' }
              ].map(opt => (
                <label key={opt.val} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 0',
                  fontSize: '12.5px',
                  color: pewsBehavior === opt.val ? '#ec4899' : 'var(--text-muted, #94a3b8)',
                  cursor: 'pointer'
                }}>
                  <input
                    type="radio"
                    name="pewsBehavior"
                    checked={pewsBehavior === opt.val}
                    onChange={() => setPewsBehavior(opt.val as any)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>

            {/* Cardiovascular Domain */}
            <div style={{
              padding: '16px',
              borderRadius: '10px',
              background: 'rgba(30, 41, 59, 0.7)',
              border: '1px solid rgba(255,255,255,0.08)'
            }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#f8fafc', marginBottom: '8px' }}>
                2. Cardiovascular & Perfusion
              </label>
              {[
                { val: 0, label: '0: Pink, Capillary Refill 1-2 sec' },
                { val: 1, label: '1: Pale, Capillary Refill 3 sec' },
                { val: 2, label: '2: Grey, Capillary Refill 4 sec, or Tachycardia' },
                { val: 3, label: '3: Grey/Mottled, Cap Refill >=5s, or Bradycardia' }
              ].map(opt => (
                <label key={opt.val} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 0',
                  fontSize: '12.5px',
                  color: pewsCardio === opt.val ? '#ec4899' : 'var(--text-muted, #94a3b8)',
                  cursor: 'pointer'
                }}>
                  <input
                    type="radio"
                    name="pewsCardio"
                    checked={pewsCardio === opt.val}
                    onChange={() => setPewsCardio(opt.val as any)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>

            {/* Respiratory Domain */}
            <div style={{
              padding: '16px',
              borderRadius: '10px',
              background: 'rgba(30, 41, 59, 0.7)',
              border: '1px solid rgba(255,255,255,0.08)'
            }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#f8fafc', marginBottom: '8px' }}>
                3. Respiratory Effort & Work of Breathing
              </label>
              {[
                { val: 0, label: '0: Normal respiration for age, no retractions' },
                { val: 1, label: '1: RR >10 above normal or mild subcostal retractions' },
                { val: 2, label: '2: RR >20 above normal or moderate intercostal retractions' },
                { val: 3, label: '3: RR >30 above normal, sternal recession, tug, or grunting' }
              ].map(opt => (
                <label key={opt.val} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 0',
                  fontSize: '12.5px',
                  color: pewsResp === opt.val ? '#ec4899' : 'var(--text-muted, #94a3b8)',
                  cursor: 'pointer'
                }}>
                  <input
                    type="radio"
                    name="pewsResp"
                    checked={pewsResp === opt.val}
                    onChange={() => setPewsResp(opt.val as any)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Pediatric High-Risk Modifiers */}
          <div style={{
            padding: '14px 18px',
            borderRadius: '10px',
            background: 'rgba(15, 23, 42, 0.5)',
            border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            gap: '24px'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#f8fafc', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={pewsNeb}
                onChange={(e) => setPewsNeb(e.target.checked)}
              />
              <span>Continuous or Q15m Nebulizer Therapy (+2 pts)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#f8fafc', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={pewsVomit}
                onChange={(e) => setPewsVomit(e.target.checked)}
              />
              <span>Persistent Post-Operative Emesis (+2 pts)</span>
            </label>
          </div>
        </div>
      )}

      {/* GERIATRIC MORSE FALL RISK & DELIRIUM VIEW */}
      {activeCategory === 'geriatric' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Morse Score Gauge Banner */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderRadius: '12px',
            background: 'rgba(15, 23, 42, 0.8)',
            border: `2px solid ${morseColor}`
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  background: `${morseColor}25`,
                  color: morseColor,
                  fontWeight: 'bold',
                  fontSize: '12px'
                }}>
                  {morseTier} FALL RISK
                </span>
                <span style={{ fontSize: '13px', color: 'var(--text-muted, #94a3b8)' }}>
                  Morse Fall Scale Standard Protocol
                </span>
              </div>
              <h3 style={{ margin: '6px 0 2px', fontSize: '17px', color: '#f8fafc' }}>
                {morseTier === 'HIGH' 
                  ? '🚨 RED BAND: Floor Mat, Bed Alarm & 1-to-1 Assisted Transfers' 
                  : morseTier === 'MODERATE' 
                  ? '⚠️ YELLOW BAND: Non-Skid Footwear & Assisted Ambulation' 
                  : '✅ LOW RISK: Standard Environmental Fall Precautions'}
              </h3>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase' }}>
                Morse Score
              </div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: morseColor }}>
                {computedMorseScore}<span style={{ fontSize: '16px', color: 'var(--text-muted, #94a3b8)' }}>/125</span>
              </div>
            </div>
          </div>

          {/* Morse Criteria Form */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '14px'
          }}>
            <div style={{
              padding: '14px',
              borderRadius: '10px',
              background: 'rgba(30, 41, 59, 0.7)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#f8fafc', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={morseHistoryFalls}
                  onChange={(e) => setMorseHistoryFalls(e.target.checked)}
                />
                <span>History of Falling in past 3 months (+25 pts)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#f8fafc', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={morseSecondaryDx}
                  onChange={(e) => setMorseSecondaryDx(e.target.checked)}
                />
                <span>Secondary Diagnosis documented (+15 pts)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#f8fafc', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={morseIv}
                  onChange={(e) => setMorseIv(e.target.checked)}
                />
                <span>IV Heparin Lock or Continuous Infusion (+20 pts)</span>
              </label>
            </div>

            <div style={{
              padding: '14px',
              borderRadius: '10px',
              background: 'rgba(30, 41, 59, 0.7)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <label style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#f8fafc' }}>
                Ambulatory Aid:
              </label>
              <select
                value={morseAid}
                onChange={(e) => setMorseAid(e.target.value as any)}
                style={{
                  padding: '6px 8px',
                  borderRadius: '6px',
                  background: '#1e293b',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.15)',
                  fontSize: '12.5px'
                }}
              >
                <option value="none_bedrest">None / Bedrest / Wheelchair (+0)</option>
                <option value="crutches_cane_walker">Crutches, Cane, or Walker (+15)</option>
                <option value="furniture_support">Clutches Furniture for Balance (+30)</option>
              </select>

              <label style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#f8fafc', marginTop: '6px' }}>
                Gait / Transferring:
              </label>
              <select
                value={morseGait}
                onChange={(e) => setMorseGait(e.target.value as any)}
                style={{
                  padding: '6px 8px',
                  borderRadius: '6px',
                  background: '#1e293b',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.15)',
                  fontSize: '12.5px'
                }}
              >
                <option value="normal_bedrest">Normal / Bedrest / Immobile (+0)</option>
                <option value="weak">Weak / Short stooped steps (+10)</option>
                <option value="impaired_hesitant">Impaired / Hesitant / Needs assistance (+20)</option>
              </select>

              <label style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#f8fafc', marginTop: '6px' }}>
                Mental Status:
              </label>
              <select
                value={morseMental}
                onChange={(e) => setMorseMental(e.target.value as any)}
                style={{
                  padding: '6px 8px',
                  borderRadius: '6px',
                  background: '#1e293b',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.15)',
                  fontSize: '12.5px'
                }}
              >
                <option value="knows_own_limits">Oriented to own abilities (+0)</option>
                <option value="overestimates_or_forgets">Overestimates or forgets limitations (+15)</option>
              </select>
            </div>
          </div>

          {/* Geriatric Delirium & Frailty Screening */}
          <div style={{
            padding: '16px',
            borderRadius: '10px',
            background: 'rgba(30, 41, 59, 0.7)',
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', color: '#f8fafc', fontWeight: 'bold', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={hasAcuteConfusion}
                  onChange={(e) => setHasAcuteConfusion(e.target.checked)}
                />
                <span style={{ color: hasAcuteConfusion ? '#ef4444' : '#f8fafc' }}>
                  4AT Screen: Acute Fluctuating Cognitive Alteration / Delirium Flagged
                </span>
              </label>
              {hasAcuteConfusion && (
                <span style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  background: 'rgba(239, 68, 68, 0.2)',
                  color: '#ef4444',
                  fontSize: '11px',
                  fontWeight: 'bold'
                }}>
                  ATYPICAL OCCULT INFECTION / SEPSIS PROTOCOL
                </span>
              )}
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted, #94a3b8)', marginBottom: '4px' }}>
                <span>Clinical Frailty Scale (CFS): <strong>Level {cfsScore}</strong></span>
                <span>{cfsScore <= 3 ? 'Managing Well' : cfsScore <= 6 ? 'Mild-Moderate Frail' : 'Severe Frailty'}</span>
              </div>
              <input
                type="range"
                min={1}
                max={9}
                value={cfsScore}
                onChange={(e) => setCfsScore(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#f59e0b' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal: Designate Caregiver Proxy */}
      {showProxyModal && (
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
            maxWidth: '520px',
            padding: '22px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={20} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: '17px', color: '#f8fafc' }}>
                  Register Caregiver Proxy / Guardian
                </h3>
              </div>
              <button
                onClick={() => setShowProxyModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleRegisterProxy} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '3px' }}>
                  Caregiver / Proxy Full Name:
                </label>
                <input
                  type="text"
                  value={newProxyName}
                  onChange={(e) => setNewProxyName(e.target.value)}
                  placeholder="e.g. Elena Martinez / Claire Pendelton"
                  required
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '3px' }}>
                    Legal Relationship:
                  </label>
                  <select
                    value={newProxyRel}
                    onChange={(e) => setNewProxyRel(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      background: '#1e293b',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.15)'
                    }}
                  >
                    <option value="Parent (Mother)">Parent (Mother)</option>
                    <option value="Parent (Father)">Parent (Father)</option>
                    <option value="Court-Appointed Legal Guardian">Court-Appointed Legal Guardian</option>
                    <option value="Adult Child (DPOA for Healthcare)">Adult Child (DPOA for Healthcare)</option>
                    <option value="Spouse / Legal Partner">Spouse / Legal Partner</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '3px' }}>
                    Contact Phone:
                  </label>
                  <input
                    type="tel"
                    value={newProxyPhone}
                    onChange={(e) => setNewProxyPhone(e.target.value)}
                    required
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '3px' }}>
                    Email (Optional):
                  </label>
                  <input
                    type="email"
                    value={newProxyEmail}
                    onChange={(e) => setNewProxyEmail(e.target.value)}
                    placeholder="proxy@example.com"
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
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '3px' }}>
                    Authorization Scope:
                  </label>
                  <select
                    value={newProxyAccess}
                    onChange={(e) => setNewProxyAccess(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      background: '#1e293b',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.15)'
                    }}
                  >
                    <option value="full">Full Medical Representation</option>
                    <option value="intake_only">Intake & Scheduling Only</option>
                    <option value="view_only">View-Only Patient Record</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowProxyModal(false)}
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
                    padding: '7px 18px',
                    borderRadius: '6px',
                    background: '#38bdf8',
                    color: '#000',
                    border: 'none',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  Authorize Proxy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpecializedTriageModule;
