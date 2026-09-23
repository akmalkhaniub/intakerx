import { Router, Request, Response } from 'express';
import { pool } from '../db';
import * as PatientPortalService from '../services/patientPortal';

const router = Router();

// GET /api/portal/dashboard - Retrieve full patient portal overview
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    let patientId = req.query.patientId ? Number(req.query.patientId) : undefined;

    // Fallback: Pick the first or most recent patient if not provided
    if (!patientId || isNaN(patientId)) {
      const pRes = await pool.query('SELECT id FROM patients ORDER BY id ASC LIMIT 1');
      if (pRes.rows.length === 0) {
        res.status(404).json({ error: 'No patient record found.' });
        return;
      }
      patientId = pRes.rows[0].id;
    }

    const data = await PatientPortalService.getPatientPortalDashboard(patientId as number);
    res.json(data);
  } catch (err) {
    console.error('Get portal dashboard error:', err);
    res.status(500).json({ error: 'Failed to retrieve patient portal dashboard.' });
  }
});

// POST /api/portal/wearables/sync - Ingest or sync Apple Health / Health Connect data
router.post('/wearables/sync', async (req: Request, res: Response) => {
  const { patientId, sourceDevice, data } = req.body;
  if (!patientId || !sourceDevice) {
    res.status(400).json({ error: 'patientId and sourceDevice are required.' });
    return;
  }
  try {
    const record = await PatientPortalService.syncWearableBiometrics(Number(patientId), sourceDevice, data);
    res.json({ success: true, record });
  } catch (err) {
    console.error('Sync wearable biometrics error:', err);
    res.status(500).json({ error: 'Failed to sync wearable biometrics.' });
  }
});

// POST /api/portal/wearables/seed - Initialize 7-day realistic biometric history
router.post('/wearables/seed', async (req: Request, res: Response) => {
  const { patientId, sourceDevice } = req.body;
  if (!patientId) {
    res.status(400).json({ error: 'patientId is required.' });
    return;
  }
  try {
    await PatientPortalService.seedRealisticWearableHistory(Number(patientId), sourceDevice);
    res.json({ success: true, message: '7-day biometric trend history successfully generated.' });
  } catch (err) {
    console.error('Seed wearable history error:', err);
    res.status(500).json({ error: 'Failed to seed wearable biometric trajectory.' });
  }
});

export default router;
