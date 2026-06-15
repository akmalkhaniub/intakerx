import { Pool } from 'pg';
import { config } from './config';

// Create a connection pool pointing to the target database
export const pool = new Pool({
  connectionString: config.databaseUrl,
});

// A helper to query the database
export const query = (text: string, params?: any[]) => pool.query(text, params);

export async function bootstrap() {
  console.log('Initializing database bootstrap...');
  
  // 1. Connect to default 'postgres' database to check if 'intakerx' exists
  const pgUrl = config.databaseUrl.replace(/\/intakerx(\?.*)?$/, '/postgres$1');
  const bootstrapPool = new Pool({ connectionString: pgUrl });
  
  try {
    const dbCheck = await bootstrapPool.query(
      "SELECT 1 FROM pg_database WHERE datname = 'intakerx'"
    );
    
    if (dbCheck.rowCount === 0) {
      console.log("Database 'intakerx' not found. Creating...");
      // CREATE DATABASE cannot run inside a transaction block or with active transactions
      await bootstrapPool.query('CREATE DATABASE intakerx');
      console.log("Database 'intakerx' created successfully.");
    } else {
      console.log("Database 'intakerx' already exists.");
    }
  } catch (error) {
    console.error('Error checking/creating database:', error);
    throw error;
  } finally {
    await bootstrapPool.end();
  }

  // 2. Connect to the 'intakerx' database and run migrations
  const migrationPool = new Pool({ connectionString: config.databaseUrl });
  
  try {
    console.log('Enabling vector extension...');
    await migrationPool.query('CREATE EXTENSION IF NOT EXISTS vector;');
    
    console.log('Creating database tables...');
    
    // Create patients table
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS patients (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        dob DATE NOT NULL,
        sex VARCHAR(50) NOT NULL,
        insurance_provider VARCHAR(255),
        insurance_policy VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create intake_sessions table
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS intake_sessions (
        id UUID PRIMARY KEY,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'active',
        current_step VARCHAR(50) DEFAULT 'complaint',
        triage_level VARCHAR(50),
        triage_rationale TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create messages table
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        session_id UUID REFERENCES intake_sessions(id) ON DELETE CASCADE,
        sender VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        raw_content TEXT,
        was_flagged BOOLEAN DEFAULT FALSE,
        blocked_by_guardrail BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create symptoms table
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS symptoms (
        id SERIAL PRIMARY KEY,
        session_id UUID REFERENCES intake_sessions(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        severity VARCHAR(50) NOT NULL,
        duration VARCHAR(100),
        is_red_flag BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create medications table
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS medications (
        id SERIAL PRIMARY KEY,
        session_id UUID REFERENCES intake_sessions(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        dosage VARCHAR(100),
        frequency VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create protocol_embeddings table
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS protocol_embeddings (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        embedding vector(768) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create intake_summaries table
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS intake_summaries (
        id SERIAL PRIMARY KEY,
        session_id UUID UNIQUE REFERENCES intake_sessions(id) ON DELETE CASCADE,
        clinician_id INTEGER,
        summary_data JSONB NOT NULL,
        confirmed_at TIMESTAMP,
        status VARCHAR(50) DEFAULT 'pending',
        ehr_sync_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create safety_events table
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS safety_events (
        id SERIAL PRIMARY KEY,
        session_id UUID REFERENCES intake_sessions(id) ON DELETE SET NULL,
        event_type VARCHAR(50) NOT NULL,
        input_content TEXT NOT NULL,
        response_blocked BOOLEAN DEFAULT TRUE,
        confidence_score DOUBLE PRECISION,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create audit_logs table
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        session_id UUID,
        user_id INTEGER,
        action VARCHAR(255) NOT NULL,
        ip_address VARCHAR(100),
        user_agent TEXT,
        details JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create index on embeddings for fast retrieval
    await migrationPool.query(`
      CREATE INDEX IF NOT EXISTS protocol_embeddings_vector_idx 
      ON protocol_embeddings USING hnsw (embedding vector_cosine_ops);
    `);

    console.log('Database tables and indexes verified/created.');
  } catch (error) {
    console.error('Error running migrations:', error);
    throw error;
  } finally {
    await migrationPool.end();
  }
}

// If run directly, bootstrap the database
if (require.main === module) {
  bootstrap()
    .then(() => {
      console.log('Bootstrap completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Bootstrap failed:', err);
      process.exit(1);
    });
}
