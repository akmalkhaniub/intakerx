import { pool } from '../db';
import { config } from '../config';

interface SyncJob {
  sessionId: string;
  summaryData: any;
  retryCount: number;
}

export class QueueService {
  private static queue: SyncJob[] = [];
  private static processing = false;

  /**
   * Enqueues a sync job to transmit SOAP data to the EHR portal
   */
  static async enqueueSync(sessionId: string, summaryData: any) {
    // 1. Update status in database to 'syncing'
    await pool.query(
      `UPDATE intake_summaries 
       SET status = 'syncing', confirmed_at = NOW()
       WHERE session_id = $1`,
      [sessionId]
    );

    // 2. Add to queue
    this.queue.push({
      sessionId,
      summaryData,
      retryCount: 0,
    });

    console.log(`[Queue] Enqueued EHR Sync for session: ${sessionId}`);
    
    // 3. Trigger queue processor
    this.processQueue();
  }

  /**
   * Processes jobs in the queue sequentially
   */
  private static async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) continue;

      console.log(`[Queue] Processing sync for session: ${job.sessionId} (Attempt ${job.retryCount + 1})`);
      
      try {
        // Send request to FastAPI EHR automation script
        const response = await fetch(`${config.fastapiUrl}/api/ehr/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: job.sessionId,
            summary: job.summaryData,
          }),
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`FastAPI response error: ${text}`);
        }

        const result = await response.json() as any;
        console.log(`[Queue] EHR Sync success for session: ${job.sessionId}, EHR ID: ${result.ehrId}`);

        // Update database to 'synced'
        await pool.query(
          `UPDATE intake_summaries 
           SET status = 'synced', ehr_sync_id = $2
           WHERE session_id = $1`,
          [job.sessionId, result.ehrId]
        );

        // Audit log
        await pool.query(
          `INSERT INTO audit_logs (session_id, action, details)
           VALUES ($1, $2, $3)`,
          [job.sessionId, 'ehr_sync_success', JSON.stringify({ ehrId: result.ehrId })]
        );

      } catch (err: any) {
        console.error(`[Queue] EHR Sync failed for session: ${job.sessionId}:`, err.message);

        if (job.retryCount < 2) {
          // Retry with backoff (e.g., 2 seconds * retryCount)
          job.retryCount++;
          const delay = 2000 * job.retryCount;
          console.log(`[Queue] Scheduling retry in ${delay}ms for session: ${job.sessionId}`);
          
          setTimeout(() => {
            this.queue.push(job);
            this.processQueue();
          }, delay);
        } else {
          console.error(`[Queue] Max retries reached. EHR Sync failed for session: ${job.sessionId}`);

          // Update database to 'failed'
          await pool.query(
            `UPDATE intake_summaries 
             SET status = 'failed'
             WHERE session_id = $1`,
            [job.sessionId]
          );

          // Audit log
          await pool.query(
            `INSERT INTO audit_logs (session_id, action, details)
             VALUES ($1, $2, $3)`,
            [job.sessionId, 'ehr_sync_failure', JSON.stringify({ error: err.message })]
          );
        }
      }
    }

    this.processing = false;
  }
}
