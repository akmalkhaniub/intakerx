import { Router, Response } from 'express';
import { pool } from '../db';

const router = Router();

// Ingest chunked protocol and its vector embedding
router.post('/', async (req: any, res: Response) => {
  const { title, content, chunkIndex, embedding } = req.body;

  if (!title || !content || chunkIndex === undefined || !embedding) {
    res.status(400).json({ error: 'Title, content, chunkIndex, and embedding are required.' });
    return;
  }

  if (!Array.isArray(embedding) || embedding.length !== 768) {
    res.status(400).json({ error: `Embedding must be a numeric array of size 768 (got ${embedding?.length || 0}).` });
    return;
  }

  try {
    const vectorStr = '[' + embedding.join(',') + ']';
    
    await pool.query(
      `INSERT INTO protocol_embeddings (title, content, chunk_index, embedding)
       VALUES ($1, $2, $3, $4::vector)`,
      [title, content, chunkIndex, vectorStr]
    );

    res.status(201).json({ success: true, message: `Uploaded chunk ${chunkIndex} for protocol '${title}'.` });
  } catch (err: any) {
    console.error('Ingest protocol error:', err);
    res.status(500).json({ error: 'Failed to ingest protocol embedding.' });
  }
});

export default router;
