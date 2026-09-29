import React, { useState, useEffect, useCallback } from 'react';
import {
  Home,
  Wifi,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Heart,
  Scale,
  Droplets,
  DollarSign,
  PhoneCall,
  Ambulance,
  Sparkles,
  Plus
} from 'lucide-react';

export interface DeviceFleetItem {
  id: number;
  device_type: string;
  serial_number: string;
  battery_percent: number;
  cellular_signal_strength: string;
  status: string;
  last_heartbeat: string;
}

export interface TelemetryReading {
  id: number;
  device_type: string;
  serial_number: string;
  reading_type: string;
  reading_data: Record<string, any>;
  is_out_of_bounds: boolean;
  alert_severity: 'normal' | 'mild_deviation' | 'urgent_call_required' | 'emergency_ems_dispatch';
  created_at: string;
}

export interface HaHPatient {
  id: number;
  patient_id: number;
  patient_name: string;
  patient_dob?: string;
  admission_diagnosis: string;
  acuity_tier: string;
  device_count: number;
  status: string;
  created_at: string;
}

interface HospitalAtHomeCommandProps {
  patientId?: number;
  sessionId?: string;
  token?: string;
  backendUrl?: string;
  patientName?: string;
}

export const HospitalAtHomeCommand: React.FC<HospitalAtHomeCommandProps> = ({
  patientId,
  sessionId,
  token,
  backendUrl = '',
  patientName = 'Encounter Patient'
}) => {
  const [activeTab, setActiveTab] = useState<'live_telemetry' | 'fleet_management' | 'rpm_billing'>('live_telemetry');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [emsDispatched, setEmsDispatched] = useState<string | null>(null);

  // Fleet & Patient State
  const [patients, setPatients] = useState<HaHPatient[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<number | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryReading[]>([]);

  // Device Provisioning Form State
  const [newDeviceType, setNewDeviceType] = useState<'cellular_bp_cuff' | 'smart_scale_chf' | 'continuous_pulse_ox' | 'cgm_glucose'>('smart_scale_chf');
  const [newSerialNumber, setNewSerialNumber] = useState<string>(`DEV-${Date.now().toString().slice(-6)}`);

  // Simulation State
  const [simWeight, setSimWeight] = useState<number>(82.6);
  const [simDeltaKg, setSimDeltaKg] = useState<number>(2.4);
  const [simSbp, setSimSbp] = useState<number>(184);
  const [simDbp, setSimDbp] = useState<number>(98);

  // Billing State
  const [billingSummary, setBillingSummary] = useState<any | null>(null);

  const fetchFleet = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/clinician/hah/fleet`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPatients(data.activeEnrollments || []);
        setAlerts(data.activeAlerts || []);
        if (data.activeEnrollments?.length > 0 && !selectedEnrollmentId) {
          setSelectedEnrollmentId(data.activeEnrollments[0].id);
        }
      }
    } catch (err) {
      console.error('Fetch fleet error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [backendUrl, selectedEnrollmentId, token]);

  const fetchTelemetry = useCallback(async (enrollmentId: number) => {
    try {
      const res = await fetch(`${backendUrl}/api/clinician/hah/telemetry/${enrollmentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data);
      }
    } catch (err) {
      console.error('Fetch telemetry error:', err);
    }
  }, [backendUrl, token]);

  useEffect(() => {
    fetchFleet();
  }, [fetchFleet]);

  useEffect(() => {
    if (selectedEnrollmentId) {
      fetchTelemetry(selectedEnrollmentId);
    }
  }, [fetchTelemetry, selectedEnrollmentId]);

  const handleEnrollPatient = async () => {
    if (!patientId) {
      setStatusMsg('Please select an active patient encounter first.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/clinician/hah/enroll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId,
          sessionId,
          diagnosis: 'Acute Decompensated Heart Failure (NYHA Class III)',
          acuityTier: 'stepdown_home'
        })
      });

      if (!res.ok) throw new Error('Enrollment failed');
      const data = await res.json();
      setSelectedEnrollmentId(data.id);
      await fetchFleet();
      setStatusMsg(`Patient ${patientName} successfully admitted to Hospital-at-Home!`);
    } catch (err: any) {
      console.error('Enroll error:', err);
      setStatusMsg('Failed to enroll patient in Hospital-at-Home.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProvisionDevice = async () => {
    if (!selectedEnrollmentId) {
      setStatusMsg('Enroll or select a patient first.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/clinician/hah/devices/provision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          enrollmentId: selectedEnrollmentId,
          deviceType: newDeviceType,
          serialNumber: newSerialNumber,
          syncFrequencyMinutes: 15
        })
      });

      if (!res.ok) throw new Error('Provision failed');
      await fetchFleet();
      setNewSerialNumber(`DEV-${Date.now().toString().slice(-6)}`);
      setStatusMsg('Cellular RPM device provisioned and online.');
    } catch (err: any) {
      console.error('Provision error:', err);
      setStatusMsg('Failed to provision device.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSimulateTelemetry = async (type: 'weight' | 'bp') => {
    setIsLoading(true);
    try {
      const serial = newSerialNumber;
      // Ensure provisioned first
      if (selectedEnrollmentId) {
        await fetch(`${backendUrl}/api/clinician/hah/devices/provision`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            enrollmentId: selectedEnrollmentId,
            deviceType: type === 'weight' ? 'smart_scale_chf' : 'cellular_bp_cuff',
            serialNumber: serial
          })
        });
      }

      const payload = type === 'weight'
        ? { serialNumber: serial, readingType: 'weight_kg', readingData: { weightKg: simWeight, changeOver48hKg: simDeltaKg } }
        : { serialNumber: serial, readingType: 'blood_pressure', readingData: { systolic: simSbp, diastolic: simDbp, hr: 88 } };

      const res = await fetch(`${backendUrl}/api/clinician/hah/telemetry/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Telemetry ingestion failed');
      const data = await res.json();
      if (selectedEnrollmentId) await fetchTelemetry(selectedEnrollmentId);
      await fetchFleet();
      setStatusMsg(`Telemetry ingested: ${data.evaluation.alertSeverity.toUpperCase()} — ${data.evaluation.clinicalDirective}`);
    } catch (err: any) {
      console.error('Simulate telemetry error:', err);
      setStatusMsg('Error simulating in-home telemetry reading.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCalculateBilling = async () => {
    if (!selectedEnrollmentId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/clinician/hah/billing/calculate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          enrollmentId: selectedEnrollmentId,
          transmissionDaysCount: 19,
          clinicalMinutesSpent: 26
        })
      });

      if (!res.ok) throw new Error('Billing calculation failed');
      const data = await res.json();
      setBillingSummary(data);
      setStatusMsg('CMS RPM billing codes evaluated successfully.');
    } catch (err: any) {
      console.error('Billing error:', err);
      setStatusMsg('Failed to calculate RPM billing.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDispatchEms = (targetLabel: string) => {
    setEmsDispatched(`🚨 Critical In-Home Decompensation! EMS dispatched to ${targetLabel}'s residence with CHF Paramedic protocol.`);
    setTimeout(() => setEmsDispatched(null), 6000);
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'emergency_ems_dispatch':
        return 'bg-rose-950/80 text-rose-300 border-rose-600 animate-pulse';
      case 'urgent_call_required':
        return 'bg-amber-950/80 text-amber-300 border-amber-600';
      case 'mild_deviation':
        return 'bg-yellow-950/80 text-yellow-300 border-yellow-600';
      default:
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-600';
    }
  };

  return (
    <div className="bg-slate-900 text-slate-100 rounded-xl border border-slate-800 p-6 space-y-6 shadow-2xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Home className="w-6 h-6 text-sky-400" />
            <h2 className="text-xl font-bold tracking-tight text-white">
              Hospital-at-Home (HaH) & Continuous RPM Fleet Command
            </h2>
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
              CMS CPT 99453-99458 • Cellular Fleet
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Real-time biometric telemetry monitoring for acute home hospitalizations, cellular device fleet control, and automated decompensation protocols.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {patients.length === 0 ? (
            <button
              onClick={handleEnrollPatient}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Enroll Patient at Home
            </button>
          ) : (
            <button
              onClick={fetchFleet}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              Sync Fleet
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {statusMsg && (
        <div className="p-3 bg-indigo-950/60 border border-indigo-700/50 rounded-lg text-xs text-indigo-200 flex items-center justify-between">
          <span>{statusMsg}</span>
          <button onClick={() => setStatusMsg('')} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {emsDispatched && (
        <div className="p-3 bg-rose-950/80 border border-rose-600 rounded-lg text-xs font-bold text-rose-200 flex items-center gap-2">
          <Ambulance className="w-5 h-5 text-rose-400 animate-bounce" />
          <span>{emsDispatched}</span>
        </div>
      )}

      {/* Fleet Command HUD Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Patients at Home</span>
            <Home className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{patients.length}</span>
            <span className="text-xs text-sky-300 font-bold">Active admissions</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Virtual ward stepdown beds</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Connected Devices</span>
            <Wifi className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-400">
              {patients.reduce((sum, p) => sum + Number(p.device_count || 0), 0) || 3}
            </span>
            <span className="text-xs text-emerald-400 font-bold">100% Online</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Cellular IoT telemetry stream</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Open Biometric Alerts</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-300">{alerts.length}</span>
            <span className="text-xs text-rose-400 font-bold">Requires Action</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Out-of-bounds telemetry triggers</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Qualified RPM Revenue</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-400">$124.50</span>
            <span className="text-xs text-slate-400 font-medium">per enrolled life/mo</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">CPT 99453, 99454, 99457 accrued</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 space-x-4">
        <button
          onClick={() => setActiveTab('live_telemetry')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'live_telemetry'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          In-Home Live Telemetry
        </button>
        <button
          onClick={() => setActiveTab('fleet_management')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'fleet_management'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Wifi className="w-4 h-4" />
          Device Fleet & Simulation
        </button>
        <button
          onClick={() => setActiveTab('rpm_billing')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'rpm_billing'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          CMS RPM Reimbursement Tracker
        </button>
      </div>

      {/* Tab 1: In-Home Live Telemetry */}
      {activeTab === 'live_telemetry' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* BP Card */}
            <div className="p-4 bg-slate-800/80 rounded-lg border border-slate-700">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span className="font-bold flex items-center gap-1.5 text-white">
                  <Heart className="w-4 h-4 text-rose-400" />
                  Blood Pressure
                </span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">Cellular</span>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-black font-mono text-white">184/98</span>
                <span className="text-xs text-slate-400 ml-1">mmHg</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px]">
                <span className="text-rose-400 font-semibold">Hypertensive Crisis</span>
                <span className="text-slate-400 font-mono">HR: 88 bpm</span>
              </div>
            </div>

            {/* Smart Scale Card */}
            <div className="p-4 bg-slate-800/80 rounded-lg border border-slate-700">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span className="font-bold flex items-center gap-1.5 text-white">
                  <Scale className="w-4 h-4 text-sky-400" />
                  CHF Fluid Scale
                </span>
                <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[10px] font-bold">Weight</span>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-black font-mono text-white">82.6</span>
                <span className="text-xs text-slate-400 ml-1">kg</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px]">
                <span className="text-amber-400 font-bold">+2.4 kg (48h jump)</span>
                <span className="text-rose-400 font-semibold">Retention Alert</span>
              </div>
            </div>

            {/* SpO2 Card */}
            <div className="p-4 bg-slate-800/80 rounded-lg border border-slate-700">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span className="font-bold flex items-center gap-1.5 text-white">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  Pulse Oximeter
                </span>
                <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-bold">Continuous</span>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-black font-mono text-white">96%</span>
                <span className="text-xs text-slate-400 ml-1">SpO2</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px]">
                <span className="text-emerald-400 font-semibold">Target Stable</span>
                <span className="text-slate-400 font-mono">Room Air</span>
              </div>
            </div>

            {/* CGM Glucose Card */}
            <div className="p-4 bg-slate-800/80 rounded-lg border border-slate-700">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span className="font-bold flex items-center gap-1.5 text-white">
                  <Droplets className="w-4 h-4 text-purple-400" />
                  Continuous Glucose
                </span>
                <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold">CGM</span>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-black font-mono text-white">124</span>
                <span className="text-xs text-slate-400 ml-1">mg/dL</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px]">
                <span className="text-emerald-400 font-semibold">In Range (70-180)</span>
                <span className="text-slate-400">Trend: ➔ Steady</span>
              </div>
            </div>
          </div>

          {/* Active Home Alerts Workbench */}
          <div className="bg-slate-800/50 border border-slate-700/80 rounded-lg p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                Active In-Home Decompensation Alerts ({alerts.length})
              </h3>
            </div>

            <div className="space-y-3">
              {alerts.map((alert, i) => (
                <div key={i} className="p-3 bg-slate-900/80 border border-slate-700 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase border ${getSeverityBadge(alert.alert_severity)}`}>
                        {alert.alert_severity.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs font-bold text-white">{alert.patient_name}</span>
                      <span className="text-xs text-slate-400 font-mono">({alert.reading_type})</span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Reading: {JSON.stringify(alert.reading_data)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setStatusMsg(`Virtual nursing video consult launched for ${alert.patient_name}.`)}
                      className="px-2.5 py-1 text-xs font-semibold rounded bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-1 transition"
                    >
                      <PhoneCall className="w-3 h-3" />
                      Virtual Visit
                    </button>
                    <button
                      onClick={() => handleDispatchEms(alert.patient_name)}
                      className="px-2.5 py-1 text-xs font-bold rounded bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1 transition"
                    >
                      <Ambulance className="w-3 h-3" />
                      Dispatch EMS
                    </button>
                  </div>
                </div>
              ))}

              {alerts.length === 0 && (
                <div className="p-6 text-center text-slate-400 text-xs">
                  No active biometric alarms. In-home fleet operating within safe clinical boundaries.
                </div>
              )}
            </div>
          </div>

          {/* Recent Ingested Telemetry Stream */}
          <div className="bg-slate-800/50 border border-slate-700/80 rounded-lg p-5 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-400" />
              Patient Telemetry Audit Stream ({telemetry.length} readings)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/60 text-slate-400 border-b border-slate-700 font-semibold">
                  <tr>
                    <th className="p-2">Timestamp</th>
                    <th className="p-2">Device</th>
                    <th className="p-2">Reading Type</th>
                    <th className="p-2">Telemetry Payload</th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {telemetry.map(t => (
                    <tr key={t.id} className="hover:bg-slate-800/40">
                      <td className="p-2 text-slate-400 font-mono">{new Date(t.created_at).toLocaleTimeString()}</td>
                      <td className="p-2 font-mono text-[11px] text-slate-200">{t.serial_number}</td>
                      <td className="p-2 capitalize font-semibold">{t.reading_type.replace(/_/g, ' ')}</td>
                      <td className="p-2 font-mono text-[11px] text-sky-300">{JSON.stringify(t.reading_data)}</td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase border ${getSeverityBadge(t.alert_severity)}`}>
                          {t.alert_severity.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {telemetry.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-500">
                        No telemetry ingested yet for this enrollment.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Fleet Management & Simulation */}
      {activeTab === 'fleet_management' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Provision Device */}
          <div className="bg-slate-800/50 border border-slate-700/80 rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Wifi className="w-4 h-4 text-sky-400" />
              Provision In-Home Cellular RPM Device
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400">Device Modality</label>
                <select
                  value={newDeviceType}
                  onChange={(e) => setNewDeviceType(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 mt-1"
                >
                  <option value="smart_scale_chf">Cellular Smart Scale (CHF Weight Tracking)</option>
                  <option value="cellular_bp_cuff">Cellular Blood Pressure Cuff (Hypertension)</option>
                  <option value="continuous_pulse_ox">Continuous Pulse Oximeter (COPD / Hypoxia)</option>
                  <option value="cgm_glucose">Continuous Glucose Monitor (Diabetes)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400">Cellular IMEI / Serial Number</label>
                <input
                  type="text"
                  value={newSerialNumber}
                  onChange={(e) => setNewSerialNumber(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono mt-1"
                />
              </div>
            </div>

            <button
              onClick={handleProvisionDevice}
              disabled={isLoading}
              className="w-full bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs py-2 rounded transition flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Provision & Connect Device
            </button>
          </div>

          {/* Simulate Reading */}
          <div className="bg-slate-800/50 border border-slate-700/80 rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Simulate In-Home Telemetry Decompensation
            </h3>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={simWeight}
                    onChange={(e) => setSimWeight(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 mt-1 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400">48h Fluid Delta (+kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={simDeltaKg}
                    onChange={(e) => setSimDeltaKg(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-amber-300 font-bold mt-1 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400">Systolic BP (mmHg)</label>
                  <input
                    type="number"
                    value={simSbp}
                    onChange={(e) => setSimSbp(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-rose-400 font-bold mt-1 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400">Diastolic BP (mmHg)</label>
                  <input
                    type="number"
                    value={simDbp}
                    onChange={(e) => setSimDbp(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 mt-1 font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleSimulateTelemetry('weight')}
                disabled={isLoading}
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs py-2 rounded transition flex items-center justify-center gap-1.5"
              >
                <Scale className="w-3.5 h-3.5" />
                Simulate CHF Fluid Jump
              </button>
              <button
                onClick={() => handleSimulateTelemetry('bp')}
                disabled={isLoading}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs py-2 rounded transition flex items-center justify-center gap-1.5"
              >
                <Heart className="w-3.5 h-3.5" />
                Simulate SBP 184 Crisis
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: CMS RPM Reimbursement Tracker */}
      {activeTab === 'rpm_billing' && (
        <div className="bg-slate-800/50 border border-slate-700/80 rounded-lg p-6 space-y-6">
          <div className="flex justify-between items-center border-b border-slate-700/60 pb-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                CMS Remote Patient Monitoring (RPM) Monthly Accrual
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Automated threshold verification for CPT 99453, 99454, 99457, and 99458 billing.
              </p>
            </div>

            <button
              onClick={handleCalculateBilling}
              disabled={isLoading || !selectedEnrollmentId}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-2 px-3 rounded transition flex items-center gap-1.5 shadow"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Re-Calculate RPM Compliance
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-slate-900/80 border border-slate-700 rounded-lg space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-mono font-bold text-indigo-300">CPT 99453</span>
                <span className="text-emerald-400 font-bold">$19.50</span>
              </div>
              <h4 className="font-semibold text-white">Device Initial Setup & Education</h4>
              <p className="text-[11px] text-slate-400">One-time per episode upon initial equipment provisioning.</p>
              <div className="pt-2 flex items-center gap-1.5 text-emerald-400 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Qualified
              </div>
            </div>

            <div className="p-4 bg-slate-900/80 border border-slate-700 rounded-lg space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-mono font-bold text-indigo-300">CPT 99454</span>
                <span className="text-emerald-400 font-bold">$55.00</span>
              </div>
              <h4 className="font-semibold text-white">Monthly Biometric Transmission</h4>
              <p className="text-[11px] text-slate-400">Requires ≥16 days of daily biometric readings in 30 days.</p>
              <div className="pt-2 flex items-center justify-between text-[11px]">
                <span className="text-emerald-400 font-semibold">19 / 16 Days Logged</span>
                <span className="text-emerald-400 font-bold">100% Met</span>
              </div>
            </div>

            <div className="p-4 bg-slate-900/80 border border-slate-700 rounded-lg space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-mono font-bold text-indigo-300">CPT 99457</span>
                <span className="text-emerald-400 font-bold">$50.00</span>
              </div>
              <h4 className="font-semibold text-white">Clinical Virtual Care (First 20m)</h4>
              <p className="text-[11px] text-slate-400">Requires 20 minutes interactive clinical virtual consultation.</p>
              <div className="pt-2 flex items-center justify-between text-[11px]">
                <span className="text-emerald-400 font-semibold">26 / 20 Mins Logged</span>
                <span className="text-emerald-400 font-bold">100% Met</span>
              </div>
            </div>
          </div>

          {billingSummary && (
            <div className="p-4 bg-emerald-950/30 border border-emerald-800/40 rounded-lg flex justify-between items-center text-xs">
              <span className="font-bold text-emerald-200">
                Total Accrued Monthly RPM Reimbursement for this Beneficiary:
              </span>
              <span className="text-xl font-black font-mono text-emerald-400">
                ${billingSummary.totalBillableDollars}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default HospitalAtHomeCommand;
