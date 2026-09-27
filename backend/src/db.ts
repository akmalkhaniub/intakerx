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

    // Column updates
    await migrationPool.query(`
      ALTER TABLE intake_sessions 
      ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(50) DEFAULT 'en-US',
      ADD COLUMN IF NOT EXISTS is_disaster_intake BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS start_triage_tag VARCHAR(16),
      ADD COLUMN IF NOT EXISTS offline_sync_id VARCHAR(64),
      ADD COLUMN IF NOT EXISTS field_responder VARCHAR(128);
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

    // Create phi_redaction_logs table
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS phi_redaction_logs (
        id SERIAL PRIMARY KEY,
        session_id UUID REFERENCES intake_sessions(id) ON DELETE SET NULL,
        phi_type VARCHAR(50) NOT NULL,
        original_content TEXT NOT NULL,
        redacted_content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create session_vitals table
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS session_vitals (
        id SERIAL PRIMARY KEY,
        session_id UUID REFERENCES intake_sessions(id) ON DELETE CASCADE,
        heart_rate INTEGER,
        spo2 INTEGER,
        bp_systolic INTEGER,
        bp_diastolic INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create discharge_summaries table
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS discharge_summaries (
        id SERIAL PRIMARY KEY,
        session_id UUID UNIQUE REFERENCES intake_sessions(id) ON DELETE CASCADE,
        discharge_summary TEXT NOT NULL,
        preferred_language VARCHAR(50) DEFAULT 'en-US',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create clinical_guidelines table
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS clinical_guidelines (
        id SERIAL PRIMARY KEY,
        condition_name VARCHAR(255) NOT NULL,
        recommended_protocol TEXT NOT NULL,
        required_meds VARCHAR(255)[] DEFAULT '{}',
        contraindicated_meds VARCHAR(255)[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed clinical_guidelines if empty
    const guidelinesCheck = await migrationPool.query('SELECT COUNT(*) FROM clinical_guidelines');
    if (parseInt(guidelinesCheck.rows[0].count, 10) === 0) {
      console.log('Seeding clinical guidelines...');
      await migrationPool.query(`
        INSERT INTO clinical_guidelines (condition_name, recommended_protocol, required_meds, contraindicated_meds)
        VALUES
          ('Hypertension', 'Initiate ACE inhibitor (Lisinopril) or ARB (Losartan). Contraindicated with NSAIDs due to decreased efficacy and increased renal risk.', ARRAY['Lisinopril', 'Losartan', 'Amlodipine'], ARRAY['Ibuprofen', 'Naproxen']),
          ('Diabetes', 'Initiate Metformin first-line unless contraindicated. Monitor HbA1c every 3-6 months. Discontinue Contrast Dye 48h before/after imaging.', ARRAY['Metformin', 'Glipizide', 'Insulin'], ARRAY['Contrast Dye']),
          ('Heart Failure', 'Initiate Beta-Blocker (Metoprolol) or ACE inhibitor (Lisinopril). Avoid NSAIDs (Ibuprofen, Naproxen) due to fluid retention hazard.', ARRAY['Metoprolol', 'Carvedilol', 'Lisinopril'], ARRAY['Ibuprofen', 'Naproxen'])
      `);
      console.log('Clinical guidelines seeded.');
    }

    // Create interaction_rules table
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS interaction_rules (
        id SERIAL PRIMARY KEY,
        rule_type VARCHAR(50) NOT NULL,
        trigger_item VARCHAR(255) NOT NULL,
        conflict_item VARCHAR(255) NOT NULL,
        severity VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed interaction_rules if empty
    const rulesCheck = await migrationPool.query('SELECT COUNT(*) FROM interaction_rules');
    if (parseInt(rulesCheck.rows[0].count, 10) === 0) {
      console.log('Seeding clinical interaction rules...');
      await migrationPool.query(`
        INSERT INTO interaction_rules (rule_type, trigger_item, conflict_item, severity, description)
        VALUES
          ('drug_drug', 'Lisinopril', 'Spironolactone', 'high', 'Risk of severe hyperkalemia (high potassium levels). Monitor potassium closely.'),
          ('drug_drug', 'Aspirin', 'Warfarin', 'high', 'Increased risk of major gastrointestinal and systemic bleeding.'),
          ('drug_drug', 'Sildenafil', 'Nitroglycerin', 'high', 'Concomitant use causes severe, potentially fatal hypotension. Do not combine.'),
          ('drug_drug', 'Ibuprofen', 'Aspirin', 'moderate', 'NSAID duplication; increased risk of GI irritation and bleeding.'),
          ('drug_drug', 'Metformin', 'Contrast Dye', 'high', 'Risk of lactic acidosis. Temporarily suspend Metformin before/after imaging procedures.'),
          ('drug_allergy', 'Amoxicillin', 'Penicillin', 'high', 'Patient has Penicillin allergy; Amoxicillin is a penicillin derivative (cross-allergy).'),
          ('drug_allergy', 'Penicillin', 'Penicillin', 'high', 'Patient has Penicillin allergy; drug is contra-indicated.'),
          ('drug_allergy', 'Cephalexin', 'Penicillin', 'moderate', 'Potential cross-sensitivity (~3-5% risk of cross-reaction with cephalosporins).'),
          ('drug_allergy', 'Sulfamethoxazole', 'Sulfa', 'high', 'Patient has Sulfa allergy; Sulfamethoxazole is a sulfonamide (severe allergic reaction risk).'),
          ('drug_allergy', 'Ibuprofen', 'NSAID', 'high', 'Patient has NSAID allergy; Ibuprofen is contra-indicated.'),
          ('drug_allergy', 'Naproxen', 'NSAID', 'high', 'Patient has NSAID allergy; Naproxen is contra-indicated.'),
          ('drug_allergy', 'Ibuprofen', 'Aspirin', 'high', 'Patient has Aspirin allergy; cross-reaction risk with NSAIDs like Ibuprofen.'),
          ('drug_allergy', 'Naproxen', 'Aspirin', 'high', 'Patient has Aspirin allergy; cross-reaction risk with NSAIDs like Naproxen.')
      `);
      console.log('Clinical interaction rules seeded.');
    }

    // Create consent_records table
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS consent_records (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        session_id UUID REFERENCES intake_sessions(id) ON DELETE CASCADE,
        consent_type VARCHAR(100) NOT NULL,
        version VARCHAR(20) NOT NULL DEFAULT 'v1.0',
        agreed BOOLEAN DEFAULT TRUE,
        ip_address VARCHAR(100),
        signed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create index on embeddings for fast retrieval
    await migrationPool.query(`
      CREATE INDEX IF NOT EXISTS protocol_embeddings_vector_idx 
      ON protocol_embeddings USING hnsw (embedding vector_cosine_ops);
    `);

    // Create followup_schedules table
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS followup_schedules (
        id SERIAL PRIMARY KEY,
        session_id UUID REFERENCES intake_sessions(id) ON DELETE CASCADE,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        scheduled_at TIMESTAMP NOT NULL,
        interval_days INTEGER NOT NULL DEFAULT 1,
        survey_type VARCHAR(100) NOT NULL DEFAULT 'symptom_resolution',
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        patient_response JSONB,
        clinician_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create medical_attachments table
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS medical_attachments (
        id SERIAL PRIMARY KEY,
        session_id UUID REFERENCES intake_sessions(id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        file_size INTEGER NOT NULL,
        data_url TEXT NOT NULL,
        caption TEXT,
        visual_tags TEXT[] DEFAULT '{}',
        is_red_flag BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create clinical_orders table
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS clinical_orders (
        id SERIAL PRIMARY KEY,
        session_id UUID REFERENCES intake_sessions(id) ON DELETE CASCADE,
        order_type VARCHAR(50) NOT NULL,
        code_system VARCHAR(50) NOT NULL,
        code VARCHAR(50) NOT NULL,
        display_name VARCHAR(255) NOT NULL,
        clinical_indication TEXT NOT NULL,
        urgency VARCHAR(50) DEFAULT 'routine',
        patient_prep_instructions TEXT,
        status VARCHAR(50) DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create telehealth_sessions table
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS telehealth_sessions (
        id SERIAL PRIMARY KEY,
        room_id VARCHAR(100) UNIQUE NOT NULL,
        session_id UUID REFERENCES intake_sessions(id) ON DELETE CASCADE,
        host_clinician_id INTEGER,
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP,
        duration_seconds INTEGER DEFAULT 0,
        live_notes TEXT,
        recording_url TEXT,
        call_quality JSONB DEFAULT '{"latencyMs": 28, "packetLoss": 0, "resolution": "1080p", "fps": 30}'::jsonb,
        transcript JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create patient_wearables_telemetry table
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS patient_wearables_telemetry (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        source_device VARCHAR(100) NOT NULL,
        recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        hrv_ms DOUBLE PRECISION,
        resting_hr INTEGER,
        step_count INTEGER,
        sleep_hours DOUBLE PRECISION,
        sleep_score INTEGER,
        nightly_spo2 DOUBLE PRECISION,
        ecg_classification VARCHAR(100) DEFAULT 'sinus_rhythm',
        raw_payload JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create clinical_trials table
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS clinical_trials (
        id SERIAL PRIMARY KEY,
        nct_id VARCHAR(50) UNIQUE NOT NULL,
        title TEXT NOT NULL,
        phase VARCHAR(50) NOT NULL,
        sponsor VARCHAR(255) NOT NULL,
        condition TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'RECRUITING',
        min_age INTEGER DEFAULT 18,
        max_age INTEGER DEFAULT 85,
        gender VARCHAR(20) DEFAULT 'ALL',
        inclusion_criteria TEXT[] DEFAULT '{}',
        exclusion_criteria TEXT[] DEFAULT '{}',
        biomarker_requirements JSONB DEFAULT '{}',
        study_locations TEXT[] DEFAULT '{}',
        contact_email VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create patient_trial_matches table
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS patient_trial_matches (
        id SERIAL PRIMARY KEY,
        session_id UUID REFERENCES intake_sessions(id) ON DELETE CASCADE,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        trial_id INTEGER REFERENCES clinical_trials(id) ON DELETE CASCADE,
        match_score DOUBLE PRECISION NOT NULL,
        matched_inclusions TEXT[] DEFAULT '{}',
        matched_exclusions TEXT[] DEFAULT '{}',
        status VARCHAR(50) DEFAULT 'identified',
        clinician_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create case_conferences table
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS case_conferences (
        id SERIAL PRIMARY KEY,
        session_id UUID REFERENCES intake_sessions(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        specialty_focus VARCHAR(100) NOT NULL,
        status VARCHAR(50) DEFAULT 'open',
        consensus_summary TEXT,
        consensus_diagnosis VARCHAR(255),
        finalized_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create case_conference_notes table
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS case_conference_notes (
        id SERIAL PRIMARY KEY,
        conference_id INTEGER REFERENCES case_conferences(id) ON DELETE CASCADE,
        clinician_name VARCHAR(100) NOT NULL,
        specialty VARCHAR(100) NOT NULL,
        recommendation TEXT NOT NULL,
        vote_diagnosis VARCHAR(255),
        urgency VARCHAR(50) DEFAULT 'routine',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create prior_authorizations table (Phase 28)
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS prior_authorizations (
        id SERIAL PRIMARY KEY,
        session_id UUID REFERENCES intake_sessions(id) ON DELETE CASCADE,
        payer_name VARCHAR(128) NOT NULL,
        procedure_cpt VARCHAR(32) NOT NULL,
        procedure_name VARCHAR(255) NOT NULL,
        diagnosis_icd10 VARCHAR(32) NOT NULL,
        diagnosis_name VARCHAR(255) NOT NULL,
        clinical_justification TEXT NOT NULL,
        denial_risk_score INTEGER NOT NULL DEFAULT 15,
        denial_risk_rationale TEXT,
        packet_data JSONB DEFAULT '{}'::jsonb,
        status VARCHAR(32) NOT NULL DEFAULT 'draft',
        auth_number VARCHAR(64),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create insurance_claims table (CMS-1500 EDI-837P compatible) (Phase 28)
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS insurance_claims (
        id SERIAL PRIMARY KEY,
        session_id UUID REFERENCES intake_sessions(id) ON DELETE CASCADE,
        pa_id INTEGER REFERENCES prior_authorizations(id) ON DELETE SET NULL,
        patient_name VARCHAR(128) NOT NULL,
        insured_id VARCHAR(64) NOT NULL,
        payer_id VARCHAR(64) NOT NULL,
        payer_name VARCHAR(128) NOT NULL,
        billing_provider VARCHAR(128) NOT NULL,
        rendering_npi VARCHAR(32) NOT NULL,
        place_of_service VARCHAR(16) NOT NULL DEFAULT '11',
        icd10_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
        service_lines JSONB NOT NULL DEFAULT '[]'::jsonb,
        total_billed NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
        cms1500_rendered_text TEXT,
        status VARCHAR(32) NOT NULL DEFAULT 'scrubbed_clean',
        clearinghouse_batch_id VARCHAR(64),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create disaster_mode_events table (Phase 29)
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS disaster_mode_events (
        id SERIAL PRIMARY KEY,
        is_active BOOLEAN NOT NULL DEFAULT FALSE,
        activated_by VARCHAR(128) NOT NULL,
        incident_name VARCHAR(255) NOT NULL,
        casualty_count INTEGER DEFAULT 0,
        guidelines TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create caregiver_proxies table (Phase 30)
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS caregiver_proxies (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        proxy_name VARCHAR(128) NOT NULL,
        relationship VARCHAR(64) NOT NULL,
        phone VARCHAR(32) NOT NULL,
        email VARCHAR(128),
        access_level VARCHAR(32) NOT NULL DEFAULT 'full',
        consent_verified BOOLEAN DEFAULT TRUE,
        hipaa_disclosure_acknowledged BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create specialized_triage_assessments table (Phase 30)
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS specialized_triage_assessments (
        id SERIAL PRIMARY KEY,
        session_id UUID REFERENCES intake_sessions(id) ON DELETE CASCADE,
        patient_type VARCHAR(32) NOT NULL,
        pews_score INTEGER,
        pews_data JSONB DEFAULT '{}'::jsonb,
        morse_fall_score INTEGER,
        morse_data JSONB DEFAULT '{}'::jsonb,
        frailty_score INTEGER,
        delirium_detected BOOLEAN DEFAULT FALSE,
        atypical_presentation_flags JSONB DEFAULT '[]'::jsonb,
        proxy_id INTEGER REFERENCES caregiver_proxies(id) ON DELETE SET NULL,
        clinician_recommendations TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create cac_coding_sessions table (Phase 31)
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS cac_coding_sessions (
        id SERIAL PRIMARY KEY,
        session_id UUID REFERENCES intake_sessions(id) ON DELETE CASCADE,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        status VARCHAR(32) DEFAULT 'draft',
        suggested_codes JSONB DEFAULT '[]'::jsonb,
        accepted_codes JSONB DEFAULT '[]'::jsonb,
        downcoding_risk_score INTEGER DEFAULT 0,
        revenue_impact_estimate NUMERIC(10,2) DEFAULT 0.00,
        specificity_recommendations JSONB DEFAULT '[]'::jsonb,
        clinician_feedback TEXT,
        reviewed_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create patient_pgx_profiles table (Phase 32)
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS patient_pgx_profiles (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        gene VARCHAR(32) NOT NULL,
        diplotype VARCHAR(64) NOT NULL,
        phenotype VARCHAR(64) NOT NULL,
        test_date DATE DEFAULT CURRENT_DATE,
        lab_source VARCHAR(128) DEFAULT 'Standard PGx NGS Panel',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create antimicrobial_stewardship_audits table (Phase 32)
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS antimicrobial_stewardship_audits (
        id SERIAL PRIMARY KEY,
        session_id UUID REFERENCES intake_sessions(id) ON DELETE CASCADE,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        infection_site VARCHAR(64) NOT NULL,
        creatinine_clearance NUMERIC(6,2),
        prescribed_regimen VARCHAR(128),
        stewardship_recommendation JSONB DEFAULT '{}'::jsonb,
        pgx_alerts JSONB DEFAULT '[]'::jsonb,
        approval_status VARCHAR(32) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create specialist_referrals table (Phase 33)
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS specialist_referrals (
        id SERIAL PRIMARY KEY,
        session_id UUID REFERENCES intake_sessions(id) ON DELETE CASCADE,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        specialty VARCHAR(64) NOT NULL,
        priority VARCHAR(32) DEFAULT 'routine',
        reason_for_referral TEXT NOT NULL,
        provisional_diagnosis_code VARCHAR(32),
        target_facility VARCHAR(128),
        target_specialist VARCHAR(128),
        status VARCHAR(32) DEFAULT 'submitted',
        appointment_date TIMESTAMP,
        consult_summary_notes TEXT,
        referring_clinician_id INTEGER,
        specialist_signature VARCHAR(128),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create e_consult_requests table (Phase 33)
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS e_consult_requests (
        id SERIAL PRIMARY KEY,
        session_id UUID REFERENCES intake_sessions(id) ON DELETE CASCADE,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        specialty VARCHAR(64) NOT NULL,
        clinical_question TEXT NOT NULL,
        urgency VARCHAR(32) DEFAULT 'standard_48h',
        specialist_response TEXT,
        status VARCHAR(32) DEFAULT 'pending',
        cpt_billing_code VARCHAR(16) DEFAULT '99451',
        answering_specialist_id INTEGER,
        answered_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
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
