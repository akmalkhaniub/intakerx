import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db';

const router = Router();

// Mock Telephony Inbound Webhook / Simulation route
router.post('/inbound-call', async (req, res: Response) => {
  const { patientId, fromPhone } = req.body;
  
  try {
    let activePatientId = patientId;

    // If patientId is not provided, fetch the first patient or create a mock patient
    if (!activePatientId) {
      const patientCheck = await pool.query('SELECT id, name FROM patients LIMIT 1');
      if (patientCheck.rows.length > 0) {
        activePatientId = patientCheck.rows[0].id;
      } else {
        // Create mock patient for telephony sandbox
        const passwordHash = 'simulated_pass';
        const newPatient = await pool.query(
          `INSERT INTO patients (name, email, password_hash, dob, sex, insurance_provider, insurance_policy)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          ['Telephony Test Patient', 'telephony@sandbox.com', passwordHash, '1980-01-01', 'Male', 'BCBS', 'MOCK12345']
        );
        activePatientId = newPatient.rows[0].id;
      }
    }

    const patientRes = await pool.query('SELECT name FROM patients WHERE id = $1', [activePatientId]);
    const patientName = patientRes.rows[0]?.name || 'Unknown Patient';

    const sessionId = uuidv4();

    // Create session in database
    await pool.query(
      `INSERT INTO intake_sessions (id, patient_id, status, current_step)
       VALUES ($1, $2, $3, $4)`,
      [sessionId, activePatientId, 'active', 'complaint']
    );

    // Initial system greeting message
    const welcomeText = "Hello! I am IntakeRx, your clinic's AI patient intake assistant. I will help gather your medical history, chief complaint, and basic details before your visit. To start, please describe what symptoms or issues you are experiencing today.";
    await pool.query(
      `INSERT INTO messages (session_id, sender, content)
       VALUES ($1, $2, $3)`,
      [sessionId, 'agent', welcomeText]
    );

    res.status(201).json({
      success: true,
      message: 'Mock inbound call registered successfully.',
      callDetails: {
        sessionId,
        patientId: activePatientId,
        patientName,
        fromPhone: fromPhone || '+1 (555) 019-2834',
        greeting: welcomeText,
        system_instructions: 'Trigger intake chat workflow. Extract symptoms and daily medications.'
      }
    });
  } catch (err: any) {
    console.error('Telephony inbound mock error:', err);
    res.status(500).json({ error: 'Failed to simulate inbound call: ' + err.message });
  }
});

export default router;
