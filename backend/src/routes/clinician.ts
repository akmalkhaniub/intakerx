import { Router, Response } from 'express';
import { pool } from '../db';
import { AuthenticatedRequest, authenticateToken, requireRole } from '../middleware/auth';
import { QueueService } from '../services/queue';

const router = Router();

// Apply clinician role check to all routes here
router.use(authenticateToken as any);
router.use(requireRole('clinician') as any);

// Get dashboard stats
router.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const totalSessions = await pool.query('SELECT COUNT(*) FROM intake_sessions');
    const activeSessions = await pool.query("SELECT COUNT(*) FROM intake_sessions WHERE status = 'active'");
    const escalatedSessions = await pool.query("SELECT COUNT(*) FROM intake_sessions WHERE status = 'escalated'");
    const completedSessions = await pool.query("SELECT COUNT(*) FROM intake_sessions WHERE status = 'completed'");
    
    const triageLevels = await pool.query(
      `SELECT triage_level as "level", COUNT(*) as count 
       FROM intake_sessions 
       WHERE triage_level IS NOT NULL 
       GROUP BY triage_level`
    );

    const safetyStats = await pool.query(
      `SELECT event_type as "type", COUNT(*) as count 
       FROM safety_events 
       GROUP BY event_type`
    );

    const recentSafetyEvents = await pool.query(
      `SELECT id, session_id as "sessionId", event_type as "eventType", 
              input_content as "inputContent", response_blocked as "responseBlocked", 
              confidence_score as "confidenceScore", created_at as "createdAt"
       FROM safety_events
       ORDER BY created_at DESC
       LIMIT 10`
    );

    res.json({
      counts: {
        total: parseInt(totalSessions.rows[0].count, 10),
        active: parseInt(activeSessions.rows[0].count, 10),
        escalated: parseInt(escalatedSessions.rows[0].count, 10),
        completed: parseInt(completedSessions.rows[0].count, 10),
      },
      triage: triageLevels.rows,
      safety: {
        counts: safetyStats.rows,
        recent: recentSafetyEvents.rows,
      }
    });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ error: 'Failed to retrieve stats.' });
  }
});

// Update/Edit SOAP summary
router.put('/sessions/:id/summary', async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;
  const { summaryData } = req.body;

  if (!summaryData) {
    res.status(400).json({ error: 'Summary data is required.' });
    return;
  }

  try {
    // Check if session exists
    const sessionRes = await pool.query('SELECT 1 FROM intake_sessions WHERE id = $1', [id]);
    if (sessionRes.rowCount === 0) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }

    // Save summary edits
    const result = await pool.query(
      `INSERT INTO intake_summaries (session_id, summary_data, status)
       VALUES ($1, $2, 'pending')
       ON CONFLICT (session_id) 
       DO UPDATE SET summary_data = EXCLUDED.summary_data, status = 'pending'
       RETURNING *`,
      [id, JSON.stringify(summaryData)]
    );

    // Update session step to completed
    await pool.query(
      `UPDATE intake_sessions SET status = 'completed', current_step = 'completed', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (session_id, user_id, action, details)
       VALUES ($1, $2, $3, $4)`,
      [id, req.user?.id, 'summary_update', JSON.stringify({ summaryData })]
    );

    res.json({ success: true, summary: result.rows[0] });
  } catch (err) {
    console.error('Update summary error:', err);
    res.status(500).json({ error: 'Failed to update summary.' });
  }
});

// Trigger EHR Sync
router.post('/sessions/:id/sync', async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;

  try {
    const summaryRes = await pool.query(
      `SELECT summary_data as "summaryData", status
       FROM intake_summaries
       WHERE session_id = $1`,
      [id]
    );

    if (summaryRes.rowCount === 0) {
      res.status(404).json({ error: 'SOAP summary not found for this session. Complete the intake first.' });
      return;
    }

    const { summaryData, status } = summaryRes.rows[0];

    if (status === 'synced') {
      res.status(400).json({ error: 'This summary has already been synced to the EHR.' });
      return;
    }

    // Trigger queue worker
    await QueueService.enqueueSync(id, summaryData);

    res.json({ success: true, message: 'EHR sync job enqueued successfully.' });
  } catch (err) {
    console.error('Trigger sync error:', err);
    res.status(500).json({ error: 'Failed to initiate EHR sync.' });
  }
});

export default router;
