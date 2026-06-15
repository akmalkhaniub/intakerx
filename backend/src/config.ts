import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/intakerx',
  jwtSecret: process.env.JWT_SECRET || 'intakerx-super-secret-jwt-key-2026',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  groqApiKey: process.env.GROQ_API_KEY || '',
  openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  aiProvider: process.env.AI_PROVIDER || 'gemini',
  aiModel: process.env.AI_MODEL || 'gemini-2.0-flash',
  embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-004',
  fastapiUrl: process.env.FASTAPI_URL || 'http://localhost:8002',
};
