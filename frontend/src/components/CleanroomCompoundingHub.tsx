import React, { useState, useEffect } from 'react';
import {
  Scale,
  RefreshCw,
  Plus,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  X,
  Wind,
  Thermometer,
  Sparkles,
  Droplets
} from 'lucide-react';

interface CompoundingBatch {
  id: number;
  patient_id?: number | null;
  patient_name?: string;
  prescription_order_id?: string;
  medication_name: string;
  base_solution: string;
  drug_dose_mg: number;
  drug_volume_ml: number;
  drug_specific_gravity: number;
  empty_bag_tare_grams: number;
  expected_final_weight_grams: number;
  actual_scale_weight_grams?: number | null;
  weight_variance_percent?: number | null;
  gravimetric_passed?: boolean | null;
  usp_category: string;
  storage_condition: string;
  beyond_use_date: string;
  is_hazardous_usp800: boolean;
  cstd_verified: boolean;
  compounding_hood_id: string;
  compounded_by_pharmacist: string;
  batch_status: 'compounded' | 'quarantined_out_of_spec' | 'verified_dispensed' | 'wasted';
  created_at: string;
}

interface CleanroomTelemetry {
  id: number;
  cleanroom_zone: string;
  differential_pressure_in_wg: number;
  pressure_status: 'normal' | 'warning' | 'critical_breach';
  hepa_particle_count_0_5um: number;
  iso_class: string;
  air_changes_per_hour: number;
  temperature_celsius: number;
  relative_humidity_percent: number;
  sensor_timestamp: string;
}

interface CleanroomAnalytics {
  totalBatchesPrepared: number;
  verifiedDispensedCount: number;
  quarantinedCount: number;
  gravimetricPassRate: string;
  hazardousChemoBatches: number;
  activeCleanroomAlerts: number;
}

export const CleanroomCompoundingHub: React.FC = () => {
  const [batches, setBatches] = useState<CompoundingBatch[]>([]);
  const [telemetry, setTelemetry] = useState<CleanroomTelemetry[]>([]);
  const [analytics, setAnalytics] = useState<CleanroomAnalytics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'batches' | 'cleanroom_telemetry' | 'bud_calculator'>('batches');

  // New Batch Modal
  const [showBatchModal, setShowBatchModal] = useState<boolean>(false);
  const [patientIdInput, setPatientIdInput] = useState<string>('85');
  const [medNameInput, setMedNameInput] = useState<string>('Paclitaxel Injection');
  const [baseSolutionInput, setBaseSolutionInput] = useState<string>('5% Dextrose in Water (D5W) 500mL');
  const [doseMgInput, setDoseMgInput] = useState<string>('300');
  const [volumeMlInput, setVolumeMlInput] = useState<string>('50');
  const [tareGramsInput, setTareGramsInput] = useState<string>('525');
  const [specGravityInput, setSpecGravityInput] = useState<string>('1.050');
  const [uspCategoryInput, setUspCategoryInput] = useState<string>('Category_2');
  const [storageInput, setStorageInput] = useState<string>('refrigerated');
  const [isHazardousInput, setIsHazardousInput] = useState<boolean>(true);
  const [cstdInput, setCstdInput] = useState<boolean>(true);
  const [pharmacistInput, setPharmacistInput] = useState<string>('Elena Rostova, PharmD, BCOP');

  // Scale Verification Modal
  const [selectedBatchForScale, setSelectedBatchForScale] = useState<CompoundingBatch | null>(null);
  const [scaleWeightInput, setScaleWeightInput] = useState<string>('');

  // Interactive BUD Calculator State
  const [calcCategory, setCalcCategory] = useState<'Category_1' | 'Category_2' | 'Category_3'>('Category_2');
  const [calcStorage, setCalcStorage] = useState<'room_temp' | 'refrigerated' | 'frozen'>('refrigerated');

  const token = localStorage.getItem('token') || '';

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bRes, tRes, aRes] = await Promise.all([
        fetch('/api/clinician/cleanroom/batches?limit=50', { credentials: 'include', headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/clinician/cleanroom/telemetry/latest', { credentials: 'include', headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/clinician/cleanroom/analytics', { credentials: 'include', headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (bRes.ok) setBatches(await bRes.json());
      if (tRes.ok) setTelemetry(await tRes.json());
      if (aRes.ok) setAnalytics(await aRes.json());
    } catch (err) {
      console.error('Failed to load cleanroom data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/clinician/cleanroom/batches', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId: parseInt(patientIdInput, 10),
          prescriptionOrderId: `RX-${Date.now().toString().slice(-6)}`,
          medicationName: medNameInput,
          baseSolution: baseSolutionInput,
          drugDoseMg: parseFloat(doseMgInput),
          drugVolumeMl: parseFloat(volumeMlInput),
          emptyBagTareGrams: parseFloat(tareGramsInput),
          drugSpecificGravity: parseFloat(specGravityInput),
          uspCategory: uspCategoryInput,
          storageCondition: storageInput,
          isHazardousUsp800: isHazardousInput,
          cstdVerified: cstdInput,
          compoundedByPharmacist: pharmacistInput,
          compoundingHoodId: isHazardousInput ? 'BSC-C-PEC-HOOD-03' : 'LAFW-ISO5-01'
        })
      });

      if (res.ok) {
        setShowBatchModal(false);
        fetchData();
      } else {
        const err = await res.json();
        alert(`Batch creation failed: ${err.error || 'Server error'}`);
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    }
  };

  const handleVerifyScaleWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchForScale) return;

    try {
      const res = await fetch(`/api/clinician/cleanroom/batches/${selectedBatchForScale.id}/verify-gravimetric`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          actualScaleWeightGrams: parseFloat(scaleWeightInput)
        })
      });

      if (res.ok) {
        setSelectedBatchForScale(null);
        fetchData();
      } else {
        const err = await res.json();
        alert(`Verification failed: ${err.error || 'Server error'}`);
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    }
  };

  const getBudDescription = (cat: string, stor: string) => {
    if (cat === 'Category_1') {
      return stor === 'room_temp' ? '12 Hours (Room Temperature)' : '24 Hours (Refrigerated)';
    } else if (cat === 'Category_2') {
      return stor === 'room_temp' ? '4 Days (Room Temperature)' : stor === 'refrigerated' ? '10 Days (Refrigerated)' : '45 Days (Frozen -20°C)';
    } else {
      return stor === 'room_temp' ? '45 Days (Room Temperature)' : stor === 'refrigerated' ? '60 Days (Refrigerated)' : '90 Days (Frozen)';
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', color: '#f8fafc' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Scale style={{ color: '#06b6d4', width: '28px', height: '28px' }} />
            <h2 style={{ fontSize: '22px', fontWeight: 'bold', margin: 0, color: '#f8fafc' }}>
              Cleanroom Sterile Compounding &amp; USP &lt;797&gt;/&lt;800&gt; Hub
            </h2>
          </div>
          <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '13px' }}>
            Gravimetric density verification, Beyond-Use Date (BUD) automation, C-PEC hazardous chemo CSTD &amp; cleanroom differential pressure
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={fetchData}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#1e293b',
              color: '#94a3b8',
              border: '1px solid #334155',
              padding: '8px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            <RefreshCw size={15} /> Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowBatchModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#0891b2',
              color: '#ffffff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600
            }}
          >
            <Plus size={16} /> Compound IV Bag
          </button>
        </div>
      </div>

      {/* Analytics KPI Bar */}
      {analytics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>TOTAL BATCHES COMPOUNDED</span>
              <Scale size={18} style={{ color: '#06b6d4' }} />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '6px', color: '#f8fafc' }}>
              {analytics.totalBatchesPrepared}
            </div>
            <div style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>
              IV infusions &amp; piggybacks
            </div>
          </div>

          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>GRAVIMETRIC PASS RATE</span>
              <ShieldCheck size={18} style={{ color: '#10b981' }} />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '6px', color: '#10b981' }}>
              {analytics.gravimetricPassRate}
            </div>
            <div style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>
              Strict ±3.0% mass tolerance
            </div>
          </div>

          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>SAFETY LOCKOUTS / QUARANTINE</span>
              <AlertTriangle size={18} style={{ color: analytics.quarantinedCount > 0 ? '#ef4444' : '#64748b' }} />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '6px', color: analytics.quarantinedCount > 0 ? '#ef4444' : '#f8fafc' }}>
              {analytics.quarantinedCount}
            </div>
            <div style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>
              Prevented clinician administration
            </div>
          </div>

          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>HAZARDOUS CHEMO (USP 800)</span>
              <Droplets size={18} style={{ color: '#f59e0b' }} />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '6px', color: '#f59e0b' }}>
              {analytics.hazardousChemoBatches}
            </div>
            <div style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>
              C-PEC hood &amp; CSTD verified
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #334155', marginBottom: '16px', gap: '8px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('batches')}
          style={{
            background: 'none',
            border: 'none',
            padding: '10px 18px',
            color: activeTab === 'batches' ? '#06b6d4' : '#94a3b8',
            borderBottom: activeTab === 'batches' ? '2px solid #06b6d4' : 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px'
          }}
        >
          IV Sterile Batches ({batches.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('cleanroom_telemetry')}
          style={{
            background: 'none',
            border: 'none',
            padding: '10px 18px',
            color: activeTab === 'cleanroom_telemetry' ? '#06b6d4' : '#94a3b8',
            borderBottom: activeTab === 'cleanroom_telemetry' ? '2px solid #06b6d4' : 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px'
          }}
        >
          Cleanroom Telemetry &amp; Air Quality ({telemetry.length} Zones)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('bud_calculator')}
          style={{
            background: 'none',
            border: 'none',
            padding: '10px 18px',
            color: activeTab === 'bud_calculator' ? '#06b6d4' : '#94a3b8',
            borderBottom: activeTab === 'bud_calculator' ? '2px solid #06b6d4' : 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px'
          }}
        >
          USP &lt;797&gt; BUD Calculator
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Loading cleanroom records...</div>
      ) : activeTab === 'batches' ? (
        /* Batches Table */
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155', backgroundColor: '#1e293b', color: '#94a3b8' }}>
                <th style={{ padding: '12px 16px' }}>Batch / Medication</th>
                <th style={{ padding: '12px 16px' }}>Base Solution</th>
                <th style={{ padding: '12px 16px' }}>Expected vs Actual Mass</th>
                <th style={{ padding: '12px 16px' }}>Variance (±3%)</th>
                <th style={{ padding: '12px 16px' }}>USP &lt;797&gt; BUD</th>
                <th style={{ padding: '12px 16px' }}>Safety Controls</th>
                <th style={{ padding: '12px 16px' }}>Batch Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                    No IV compounding batches recorded yet. Click "Compound IV Bag" above.
                  </td>
                </tr>
              ) : (
                batches.map((b) => (
                  <tr key={b.id} style={{ borderBottom: '1px solid #1e293b', color: '#e2e8f0' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#f8fafc' }}>{b.medication_name}</div>
                      <div style={{ color: '#64748b', fontSize: '11px' }}>
                        Batch #{b.id} • {b.prescription_order_id} • {b.patient_name || `Patient #${b.patient_id}`}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div>{b.base_solution}</div>
                      <div style={{ color: '#94a3b8', fontSize: '11px' }}>{b.drug_dose_mg} mg in {b.drug_volume_ml} mL</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div>Exp: <strong>{b.expected_final_weight_grams} g</strong></div>
                      <div style={{ color: b.actual_scale_weight_grams ? '#38bdf8' : '#64748b', fontSize: '11px' }}>
                        {b.actual_scale_weight_grams ? `Act: ${b.actual_scale_weight_grams} g` : 'Awaiting scale verification'}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {b.weight_variance_percent !== null && b.weight_variance_percent !== undefined ? (
                        <span style={{ fontWeight: 600, color: b.gravimetric_passed ? '#10b981' : '#ef4444' }}>
                          {b.weight_variance_percent > 0 ? `+${b.weight_variance_percent}%` : `${b.weight_variance_percent}%`}
                        </span>
                      ) : (
                        <span style={{ color: '#64748b' }}>Pending</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 500 }}>{new Date(b.beyond_use_date).toLocaleDateString()}</div>
                      <div style={{ color: '#94a3b8', fontSize: '11px' }}>{b.usp_category} • {b.storage_condition}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {b.is_hazardous_usp800 && (
                          <span style={{ color: '#f59e0b', fontSize: '11px', fontWeight: 600 }}>⚠️ USP 800 Chemo</span>
                        )}
                        {b.cstd_verified && (
                          <span style={{ color: '#10b981', fontSize: '11px' }}>✓ CSTD Verified</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor:
                            b.batch_status === 'verified_dispensed'
                              ? 'rgba(34, 197, 94, 0.2)'
                              : b.batch_status === 'quarantined_out_of_spec'
                              ? 'rgba(239, 68, 68, 0.2)'
                              : 'rgba(56, 189, 248, 0.2)',
                          color:
                            b.batch_status === 'verified_dispensed'
                              ? '#4ade80'
                              : b.batch_status === 'quarantined_out_of_spec'
                              ? '#f87171'
                              : '#38bdf8'
                        }}
                      >
                        {b.batch_status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {b.batch_status === 'compounded' && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBatchForScale(b);
                            setScaleWeightInput(b.expected_final_weight_grams.toString());
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: '#0891b2',
                            color: '#ffffff',
                            border: 'none',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            cursor: 'pointer'
                          }}
                        >
                          <Scale size={11} /> Scale Verify
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : activeTab === 'cleanroom_telemetry' ? (
        /* Telemetry Cards Grid */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {telemetry.map((t) => (
            <div key={t.id} style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '10px', padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '15px', color: '#f8fafc' }}>{t.cleanroom_zone.replace(/_/g, ' ')}</h4>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    backgroundColor: t.pressure_status === 'normal' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: t.pressure_status === 'normal' ? '#4ade80' : '#f87171'
                  }}
                >
                  {t.pressure_status.toUpperCase()}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>DIFFERENTIAL PRESSURE</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#38bdf8' }}>
                    {t.differential_pressure_in_wg > 0 ? `+${t.differential_pressure_in_wg}` : t.differential_pressure_in_wg} in. w.g.
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>ISO AIR CLASS</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f8fafc' }}>
                    {t.iso_class.replace('_', ' ')}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px', color: '#cbd5e1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Wind size={14} style={{ color: '#94a3b8' }} />
                  <span>{t.air_changes_per_hour} ACPH</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Thermometer size={14} style={{ color: '#94a3b8' }} />
                  <span>{t.temperature_celsius}°C ({t.relative_humidity_percent}% RH)</span>
                </div>
              </div>

              <div style={{ marginTop: '10px', fontSize: '11px', color: '#64748b' }}>
                HEPA Particles (&gt;= 0.5 µm): {t.hepa_particle_count_0_5um} particles/m³
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* BUD Calculator Tab */
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '24px', maxWidth: '700px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={20} style={{ color: '#06b6d4' }} /> USP &lt;797&gt; Beyond-Use Date Calculator
          </h3>
          <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '20px' }}>
            Standardized BUD assigned based on compounding environment ISO classification and ingredient sterility verification:
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Compounding Risk Category</label>
              <select
                value={calcCategory}
                onChange={(e: any) => setCalcCategory(e.target.value)}
                style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
              >
                <option value="Category_1">Category 1 (Segregated Compounding Area)</option>
                <option value="Category_2">Category 2 (ISO 7 Buffer with ISO 5 LAFW/BSC)</option>
                <option value="Category_3">Category 3 (Sterility Tested &amp; Validated)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Storage Condition</label>
              <select
                value={calcStorage}
                onChange={(e: any) => setCalcStorage(e.target.value)}
                style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
              >
                <option value="room_temp">Controlled Room Temperature (20°C to 25°C)</option>
                <option value="refrigerated">Refrigerated (2°C to 8°C)</option>
                <option value="frozen">Frozen Solid (-25°C to -10°C)</option>
              </select>
            </div>
          </div>

          <div style={{ padding: '16px', backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>MAXIMUM PERMISSIBLE BEYOND-USE DATE (BUD)</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#06b6d4' }}>
              {getBudDescription(calcCategory, calcStorage)}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
              Compliant with USP &lt;797&gt; sterile preparations standards (Table 13).
            </div>
          </div>
        </div>
      )}

      {/* Modal: Compound IV Bag */}
      {showBatchModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '24px', width: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#f8fafc' }}>Prepare IV Compounding Batch</h3>
              <button type="button" onClick={() => setShowBatchModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateBatch}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Patient ID</label>
                  <input
                    type="number"
                    value={patientIdInput}
                    onChange={(e) => setPatientIdInput(e.target.value)}
                    style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Medication Name</label>
                  <input
                    type="text"
                    value={medNameInput}
                    onChange={(e) => setMedNameInput(e.target.value)}
                    style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Base Solution Bag</label>
                <input
                  type="text"
                  value={baseSolutionInput}
                  onChange={(e) => setBaseSolutionInput(e.target.value)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Drug Dose (mg)</label>
                  <input
                    type="number"
                    value={doseMgInput}
                    onChange={(e) => setDoseMgInput(e.target.value)}
                    style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Drug Volume (mL)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={volumeMlInput}
                    onChange={(e) => setVolumeMlInput(e.target.value)}
                    style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Empty Bag Tare Mass (g)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={tareGramsInput}
                    onChange={(e) => setTareGramsInput(e.target.value)}
                    style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Drug Specific Gravity</label>
                  <input
                    type="number"
                    step="0.001"
                    value={specGravityInput}
                    onChange={(e) => setSpecGravityInput(e.target.value)}
                    style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>USP &lt;797&gt; Category</label>
                  <select
                    value={uspCategoryInput}
                    onChange={(e) => setUspCategoryInput(e.target.value)}
                    style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                  >
                    <option value="Category_1">Category 1</option>
                    <option value="Category_2">Category 2</option>
                    <option value="Category_3">Category 3</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Storage Condition</label>
                  <select
                    value={storageInput}
                    onChange={(e) => setStorageInput(e.target.value)}
                    style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                  >
                    <option value="room_temp">Room Temp</option>
                    <option value="refrigerated">Refrigerated</option>
                    <option value="frozen">Frozen</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Compounding Pharmacist (PharmD)</label>
                <input
                  type="text"
                  value={pharmacistInput}
                  onChange={(e) => setPharmacistInput(e.target.value)}
                  style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '20px', marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#e2e8f0', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isHazardousInput}
                    onChange={(e) => setIsHazardousInput(e.target.checked)}
                  />
                  USP &lt;800&gt; Hazardous Antineoplastic
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#e2e8f0', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={cstdInput}
                    onChange={(e) => setCstdInput(e.target.checked)}
                  />
                  CSTD Closed-System Device Verified
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  style={{ backgroundColor: '#1e293b', color: '#94a3b8', border: '1px solid #334155', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: '#0891b2', color: '#ffffff', border: 'none', padding: '8px 18px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Create Batch &amp; Assign Expected Weight
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Scale Verification */}
      {selectedBatchForScale && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '24px', width: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#f8fafc' }}>Gravimetric Scale Verification</h3>
              <button type="button" onClick={() => setSelectedBatchForScale(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ backgroundColor: '#1e293b', padding: '14px', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>EXPECTED FINAL WEIGHT (DENSITY-ADJUSTED)</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#06b6d4', marginTop: '2px' }}>
                {selectedBatchForScale.expected_final_weight_grams} g
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                Acceptable Range (±3.0%): {(selectedBatchForScale.expected_final_weight_grams * 0.97).toFixed(2)} g to {(selectedBatchForScale.expected_final_weight_grams * 1.03).toFixed(2)} g
              </div>
            </div>

            <form onSubmit={handleVerifyScaleWeight}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Actual Scale Weight (Grams)</label>
                <input
                  type="number"
                  step="0.1"
                  value={scaleWeightInput}
                  onChange={(e) => setScaleWeightInput(e.target.value)}
                  style={{ width: '100%', padding: '10px', fontSize: '16px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc' }}
                  required
                />
              </div>

              {scaleWeightInput && (
                <div style={{ marginBottom: '16px', fontSize: '13px' }}>
                  {Math.abs(((parseFloat(scaleWeightInput) - selectedBatchForScale.expected_final_weight_grams) / selectedBatchForScale.expected_final_weight_grams) * 100) <= 3.0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981' }}>
                      <CheckCircle2 size={16} /> Within ±3.0% tolerance. Ready for dispense.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444' }}>
                      <XCircle size={16} /> Out of tolerance. Safety lockout will trigger.
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedBatchForScale(null)}
                  style={{ backgroundColor: '#1e293b', color: '#94a3b8', border: '1px solid #334155', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: '#0891b2', color: '#ffffff', border: 'none', padding: '8px 18px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Confirm Gravimetric Weight
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CleanroomCompoundingHub;
