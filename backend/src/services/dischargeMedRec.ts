import { pool } from '../db';

export interface MedicationItem {
  name: string;
  dose: string;
  frequency: string;
  route?: string;
  indication?: string;
  prescriber?: string;
}

export interface MedRecDiscrepancy {
  medicationName: string;
  discrepancyType: 'unintended_omission' | 'duplicate_therapy' | 'dose_route_frequency' | 'renal_dose_warning' | 'drug_interaction';
  severity: 'low' | 'moderate' | 'high' | 'critical';
  clinicalRationale: string;
  suggestedAction: string;
  resolved: boolean;
}

export interface FormularyAlternative {
  brandMedication: string;
  suggestedGeneric: string;
  brandCopayEst: number;
  genericCopayEst: number;
  monthlySavings: number;
  formularyTier: string;
}

export interface DischargeMedRecParams {
  patientId: number;
  sessionId?: string;
  reconciliationType?: string;
  homeMedications: MedicationItem[];
  inpatientMedications: MedicationItem[];
  dischargeMedications: MedicationItem[];
  eGfr?: number;
  reviewedBy?: string;
}

export interface BedsideDeliveryOrderParams {
  reconciliationId: number;
  patientId: number;
  roomBed: string;
  targetDischargeTime?: string;
  courierName?: string;
  copayAmount?: number;
  medicationList: MedicationItem[];
  pharmacistNotes?: string;
}

// Chronic drug classes prone to accidental omission upon hospital discharge
const CRITICAL_CHRONIC_KEYWORDS = [
  { name: 'lisinopril', class: 'ACE-Inhibitor (Antihypertensive)' },
  { name: 'losartan', class: 'ARB (Antihypertensive)' },
  { name: 'amlodipine', class: 'CCB (Antihypertensive)' },
  { name: 'metoprolol', class: 'Beta-Blocker (Cardioprotective)' },
  { name: 'carvedilol', class: 'Beta-Blocker (Heart Failure/Cardioprotective)' },
  { name: 'atorvastatin', class: 'Statin (Lipid-lowering)' },
  { name: 'rosuvastatin', class: 'Statin (Lipid-lowering)' },
  { name: 'apixaban', class: 'DOAC (Anticoagulant - Stroke Prevention)' },
  { name: 'rivaroxaban', class: 'DOAC (Anticoagulant)' },
  { name: 'warfarin', class: 'VKA (Anticoagulant)' },
  { name: 'metformin', class: 'Biguanide (Antidiabetic)' },
  { name: 'empagliflozin', class: 'SGLT2 Inhibitor (Heart Failure/Diabetes)' },
  { name: 'dapagliflozin', class: 'SGLT2 Inhibitor (Heart Failure/Diabetes)' },
  { name: 'levothyroxine', class: 'Thyroid Replacement' },
  { name: 'sertraline', class: 'SSRI (Antidepressant)' },
  { name: 'escitalopram', class: 'SSRI (Antidepressant)' },
  { name: 'insulin', class: 'Insulin (Antidiabetic)' }
];

// Brand vs Generic Formulary Database
const FORMULARY_CATALOG = [
  { brand: 'nexium', generic: 'Omeprazole 20mg Delayed-Release', brandCost: 75, genericCost: 10, tier: 'Tier 1 Preferred Generic' },
  { brand: 'lipitor', generic: 'Atorvastatin 40mg Oral Tablet', brandCost: 90, genericCost: 12, tier: 'Tier 1 Preferred Generic' },
  { brand: 'crestor', generic: 'Rosuvastatin 20mg Oral Tablet', brandCost: 85, genericCost: 15, tier: 'Tier 1 Preferred Generic' },
  { brand: 'plavix', generic: 'Clopidogrel 75mg Oral Tablet', brandCost: 70, genericCost: 8, tier: 'Tier 1 Preferred Generic' },
  { brand: 'protonix', generic: 'Pantoprazole 40mg Delayed-Release', brandCost: 65, genericCost: 10, tier: 'Tier 1 Preferred Generic' },
  { brand: 'norvasc', generic: 'Amlodipine 10mg Oral Tablet', brandCost: 55, genericCost: 6, tier: 'Tier 1 Preferred Generic' },
  { brand: 'zestril', generic: 'Lisinopril 20mg Oral Tablet', brandCost: 50, genericCost: 5, tier: 'Tier 1 Preferred Generic' }
];

export async function performDischargeMedRec(params: DischargeMedRecParams) {
  const {
    patientId,
    sessionId,
    reconciliationType = 'inpatient_to_discharge',
    homeMedications = [],
    inpatientMedications = [],
    dischargeMedications = [],
    eGfr,
    reviewedBy = 'Clinical Pharmacist'
  } = params;

  const discrepancies: MedRecDiscrepancy[] = [];
  const formularyAlternatives: FormularyAlternative[] = [];

  const dischargeNames = dischargeMedications.map(m => m.name.toLowerCase());

  // 1. Detection of Unintended Omissions from Home Meds
  for (const homeMed of homeMedications) {
    const homeName = homeMed.name.toLowerCase();
    const isDischarged = dischargeNames.some(d => d.includes(homeName) || homeName.includes(d));

    if (!isDischarged) {
      // Check if critical chronic therapy
      const matchedChronic = CRITICAL_CHRONIC_KEYWORDS.find(k => homeName.includes(k.name));
      if (matchedChronic) {
        discrepancies.push({
          medicationName: homeMed.name,
          discrepancyType: 'unintended_omission',
          severity: 'high',
          clinicalRationale: `Home chronic ${matchedChronic.class} was active prior to admission but omitted from discharge orders without explicit discontinuation documentation.`,
          suggestedAction: `Verify whether ${homeMed.name} ${homeMed.dose} was deliberately discontinued or inadvertently omitted. Reinstate if clinically indicated.`,
          resolved: false
        });
      }
    }
  }

  // 2. Detection of Duplicate Therapy in Discharge Orders
  const lowerDischarge = dischargeMedications.map(m => ({ ...m, lower: m.name.toLowerCase() }));

  // Check PPI duplicates
  const ppis = lowerDischarge.filter(m => m.lower.includes('prazole') || m.lower.includes('nexium') || m.lower.includes('protonix') || m.lower.includes('prilosec'));
  if (ppis.length > 1) {
    discrepancies.push({
      medicationName: ppis.map(p => p.name).join(' + '),
      discrepancyType: 'duplicate_therapy',
      severity: 'moderate',
      clinicalRationale: `Simultaneous prescribing of multiple proton pump inhibitors (${ppis.map(p => p.name).join(', ')}).`,
      suggestedAction: `Select a single PPI agent for discharge therapy and discontinue redundant orders.`,
      resolved: false
    });
  }

  // Check ACEi + ARB duplicate RAS blockade
  const acei = lowerDischarge.filter(m => m.lower.includes('pril'));
  const arb = lowerDischarge.filter(m => m.lower.includes('sartan'));
  if (acei.length > 0 && arb.length > 0) {
    discrepancies.push({
      medicationName: `${acei[0].name} + ${arb[0].name}`,
      discrepancyType: 'duplicate_therapy',
      severity: 'critical',
      clinicalRationale: `Dual renin-angiotensin-aldosterone system (RAAS) blockade increases risk of acute kidney injury, severe hyperkalemia, and syncope without clinical benefit.`,
      suggestedAction: `Discontinue either ${acei[0].name} or ${arb[0].name}.`,
      resolved: false
    });
  }

  // Check Dual Anticoagulation / DOAC + LMWH
  const doac = lowerDischarge.filter(m => m.lower.includes('xaban') || m.lower.includes('eliquis') || m.lower.includes('xarelto') || m.lower.includes('pradaxa'));
  const lmwh = lowerDischarge.filter(m => m.lower.includes('enoxaparin') || m.lower.includes('heparin') || m.lower.includes('lovenox'));
  if (doac.length > 0 && lmwh.length > 0) {
    discrepancies.push({
      medicationName: `${doac[0].name} + ${lmwh[0].name}`,
      discrepancyType: 'duplicate_therapy',
      severity: 'critical',
      clinicalRationale: `Concurrent therapeutic DOAC and injectable LMWH/heparin creates extreme major hemorrhage risk unless bridging under tight monitoring.`,
      suggestedAction: `Stop parenteral anticoagulation upon initiation of full-dose oral DOAC.`,
      resolved: false
    });
  }

  // 3. Renal Dosing Checks
  if (typeof eGfr === 'number' && eGfr < 60) {
    for (const med of dischargeMedications) {
      const medLower = med.name.toLowerCase();
      if (medLower.includes('metformin') && eGfr < 30) {
        discrepancies.push({
          medicationName: med.name,
          discrepancyType: 'renal_dose_warning',
          severity: 'critical',
          clinicalRationale: `Metformin is contraindicated when eGFR is below 30 mL/min/1.73m² due to high risk of fatal lactic acidosis. Current eGFR: ${eGfr}.`,
          suggestedAction: `Discontinue metformin immediately; substitute with renal-safe anti-hyperglycemic regimen (e.g., insulin or linagliptin).`,
          resolved: false
        });
      } else if (medLower.includes('gabapentin') && eGfr < 60) {
        discrepancies.push({
          medicationName: med.name,
          discrepancyType: 'renal_dose_warning',
          severity: 'moderate',
          clinicalRationale: `Gabapentin is renally eliminated. Clearance is significantly reduced with eGFR of ${eGfr} mL/min. Risk of severe sedation, ataxia, and respiratory depression.`,
          suggestedAction: `Dose-reduce gabapentin according to creatinine clearance guidelines (e.g. max 300-600mg daily).`,
          resolved: false
        });
      }
    }
  }

  // 4. Formulary Tier Optimization & Brand-to-Generic Equivalents
  for (const med of dischargeMedications) {
    const medLower = med.name.toLowerCase();
    const matchedCatalog = FORMULARY_CATALOG.find(cat => medLower.includes(cat.brand));
    if (matchedCatalog) {
      formularyAlternatives.push({
        brandMedication: med.name,
        suggestedGeneric: matchedCatalog.generic,
        brandCopayEst: matchedCatalog.brandCost,
        genericCopayEst: matchedCatalog.genericCost,
        monthlySavings: matchedCatalog.brandCost - matchedCatalog.genericCost,
        formularyTier: matchedCatalog.tier
      });
    }
  }

  const status = discrepancies.length > 0 ? 'discrepancies_flagged' : 'pharmacist_approved';

  const insertQuery = `
    INSERT INTO med_reconciliations (
      patient_id,
      session_id,
      reconciliation_type,
      home_medications,
      inpatient_medications,
      discharge_medications,
      discrepancies,
      formulary_alternatives,
      status,
      reviewed_by,
      created_at,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING *;
  `;

  const res = await pool.query(insertQuery, [
    patientId,
    sessionId || null,
    reconciliationType,
    JSON.stringify(homeMedications),
    JSON.stringify(inpatientMedications),
    JSON.stringify(dischargeMedications),
    JSON.stringify(discrepancies),
    JSON.stringify(formularyAlternatives),
    status,
    reviewedBy
  ]);

  return {
    reconciliation: res.rows[0],
    discrepancyCount: discrepancies.length,
    highRiskCount: discrepancies.filter(d => d.severity === 'critical' || d.severity === 'high').length,
    savingsIdentified: formularyAlternatives.reduce((sum, f) => sum + f.monthlySavings, 0)
  };
}

export async function createBedsideDeliveryOrder(params: BedsideDeliveryOrderParams) {
  const {
    reconciliationId,
    patientId,
    roomBed,
    targetDischargeTime,
    courierName = 'Clinical Courier Team',
    copayAmount = 0.00,
    medicationList = [],
    pharmacistNotes = ''
  } = params;

  const insertQuery = `
    INSERT INTO bedside_delivery_orders (
      reconciliation_id,
      patient_id,
      room_bed,
      target_discharge_time,
      delivery_status,
      courier_name,
      copay_amount,
      copay_collected,
      teach_back_completed,
      medication_list,
      pharmacist_notes,
      created_at,
      updated_at
    ) VALUES ($1, $2, $3, $4, 'order_placed', $5, $6, FALSE, FALSE, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING *;
  `;

  const res = await pool.query(insertQuery, [
    reconciliationId,
    patientId,
    roomBed,
    targetDischargeTime ? new Date(targetDischargeTime) : null,
    courierName,
    copayAmount,
    JSON.stringify(medicationList),
    pharmacistNotes
  ]);

  return res.rows[0];
}

export async function updateDeliveryStatus(
  orderId: number,
  status: 'order_placed' | 'dispensed' | 'in_transit_courier' | 'delivered_to_bedside' | 'counseling_completed',
  updates?: {
    copayCollected?: boolean;
    teachBackCompleted?: boolean;
    courierName?: string;
    pharmacistNotes?: string;
  }
) {
  const currentRes = await pool.query('SELECT * FROM bedside_delivery_orders WHERE id = $1', [orderId]);
  if (currentRes.rows.length === 0) {
    throw new Error(`Bedside delivery order #${orderId} not found`);
  }

  const existing = currentRes.rows[0];
  const copayCollected = updates?.copayCollected !== undefined ? updates.copayCollected : existing.copay_collected;
  const teachBackCompleted = updates?.teachBackCompleted !== undefined ? updates.teachBackCompleted : existing.teach_back_completed;
  const courierName = updates?.courierName || existing.courier_name;
  const pharmacistNotes = updates?.pharmacistNotes || existing.pharmacist_notes;

  const updateQuery = `
    UPDATE bedside_delivery_orders
    SET delivery_status = $1,
        copay_collected = $2,
        teach_back_completed = $3,
        courier_name = $4,
        pharmacist_notes = $5,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $6
    RETURNING *;
  `;

  const res = await pool.query(updateQuery, [
    status,
    copayCollected,
    teachBackCompleted,
    courierName,
    pharmacistNotes,
    orderId
  ]);

  return res.rows[0];
}

async function seedInitialMedRecDataIfEmpty() {
  const countRes = await pool.query('SELECT COUNT(*) FROM med_reconciliations');
  if (parseInt(countRes.rows[0].count, 10) > 0) return;

  const patientRes = await pool.query('SELECT id, name FROM patients LIMIT 1');
  if (patientRes.rows.length === 0) return;
  const p = patientRes.rows[0];

  const recQuery = `
    INSERT INTO med_reconciliations (
      patient_id, reconciliation_type, home_medications, inpatient_medications, discharge_medications,
      discrepancies, formulary_alternatives, status, reviewed_by, created_at
    ) VALUES ($1, 'inpatient_to_discharge', $2, $3, $4, $5, $6, 'pharmacist_approved', 'PharmD Clinical Team', CURRENT_TIMESTAMP - INTERVAL '1 day')
    RETURNING id;
  `;

  const rec = await pool.query(recQuery, [
    p.id,
    JSON.stringify([{ name: 'Atorvastatin', dose: '40mg', frequency: 'daily' }, { name: 'Metformin', dose: '500mg', frequency: 'BID' }]),
    JSON.stringify([{ name: 'Atorvastatin', dose: '40mg', frequency: 'daily' }, { name: 'Regular Insulin Sliding Scale', dose: 'titrate', frequency: 'QAC' }]),
    JSON.stringify([{ name: 'Atorvastatin', dose: '40mg', frequency: 'daily' }, { name: 'Metformin', dose: '500mg', frequency: 'BID' }]),
    JSON.stringify([]),
    JSON.stringify([{ brandMedication: 'Lipitor 40mg', suggestedGeneric: 'Atorvastatin 40mg Oral Tablet', brandCopayEst: 90, genericCopayEst: 12, monthlySavings: 78, formularyTier: 'Tier 1 Preferred Generic' }])
  ]);

  if (rec.rows.length > 0) {
    await pool.query(`
      INSERT INTO bedside_delivery_orders (
        reconciliation_id, patient_id, room_bed, target_discharge_time, delivery_status,
        courier_name, copay_amount, copay_collected, teach_back_completed, medication_list, pharmacist_notes, created_at
      ) VALUES ($1, $2, 'Telemetry 3B - Bed 304', CURRENT_TIMESTAMP - INTERVAL '6 hours', 'counseling_completed',
        'Courier Marcus Bell', 12.00, TRUE, TRUE, $3, 'Patient demonstrated full adherence and teach-back.', CURRENT_TIMESTAMP - INTERVAL '6 hours')
    `, [
      rec.rows[0].id,
      p.id,
      JSON.stringify([{ name: 'Atorvastatin', dose: '40mg', frequency: 'daily' }, { name: 'Metformin', dose: '500mg', frequency: 'BID' }])
    ]);
  }
}

export async function getMedRecSummary() {
  await seedInitialMedRecDataIfEmpty();

  const recsRes = await pool.query(`
    SELECT r.*, p.name as patient_name
    FROM med_reconciliations r
    LEFT JOIN patients p ON r.patient_id = p.id
    ORDER BY r.created_at DESC
    LIMIT 20;
  `);

  const deliveriesRes = await pool.query(`
    SELECT b.*, p.name as patient_name
    FROM bedside_delivery_orders b
    LEFT JOIN patients p ON b.patient_id = p.id
    ORDER BY b.created_at DESC
    LIMIT 20;
  `);

  const activeDeliveries = deliveriesRes.rows.filter(d => d.delivery_status !== 'counseling_completed');
  const completedDeliveries = deliveriesRes.rows.filter(d => d.delivery_status === 'counseling_completed');
  const discrepanciesPending = recsRes.rows.filter(r => r.status === 'discrepancies_flagged');

  // Calculate total monthly savings identified
  let totalMonthlySavings = 0;
  recsRes.rows.forEach(r => {
    const alts = Array.isArray(r.formulary_alternatives) ? r.formulary_alternatives : [];
    alts.forEach((a: any) => {
      totalMonthlySavings += (a.monthlySavings || 0);
    });
  });

  return {
    metrics: {
      totalReconciliations: recsRes.rows.length,
      discrepanciesFlagged: discrepanciesPending.length,
      activeDeliveriesInQueue: activeDeliveries.length,
      deliveriesCompleted: completedDeliveries.length,
      teachBackSuccessRate: completedDeliveries.length > 0
        ? Math.round((completedDeliveries.filter(d => d.teach_back_completed).length / completedDeliveries.length) * 100)
        : 100,
      totalMonthlyFormularySavings: totalMonthlySavings,
      estimatedReadmissionsAverted: Math.round(completedDeliveries.length * 0.18 * 10) / 10
    },
    recentReconciliations: recsRes.rows.map(r => ({
      id: r.id,
      patientId: r.patient_id,
      patientName: r.patient_name || `Patient #${r.patient_id}`,
      reconciliationType: r.reconciliation_type,
      homeMedCount: (r.home_medications || []).length,
      inpatientMedCount: (r.inpatient_medications || []).length,
      dischargeMedCount: (r.discharge_medications || []).length,
      discrepancies: r.discrepancies || [],
      formularyAlternatives: r.formulary_alternatives || [],
      status: r.status,
      reviewedBy: r.reviewed_by,
      createdAt: r.created_at
    })),
    recentDeliveries: deliveriesRes.rows.map(d => ({
      id: d.id,
      reconciliationId: d.reconciliation_id,
      patientId: d.patient_id,
      patientName: d.patient_name || `Patient #${d.patient_id}`,
      roomBed: d.room_bed,
      targetDischargeTime: d.target_discharge_time,
      deliveryStatus: d.delivery_status,
      courierName: d.courier_name,
      copayAmount: Number(d.copay_amount),
      copayCollected: d.copay_collected,
      teachBackCompleted: d.teach_back_completed,
      medicationCount: (d.medication_list || []).length,
      pharmacistNotes: d.pharmacist_notes,
      createdAt: d.created_at,
      updatedAt: d.updated_at
    }))
  };
}

export async function getPatientMedRecs(patientId: number) {
  const recs = await pool.query(
    'SELECT * FROM med_reconciliations WHERE patient_id = $1 ORDER BY created_at DESC',
    [patientId]
  );
  const orders = await pool.query(
    'SELECT * FROM bedside_delivery_orders WHERE patient_id = $1 ORDER BY created_at DESC',
    [patientId]
  );

  return {
    reconciliations: recs.rows,
    deliveryOrders: orders.rows
  };
}
