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

    // Create ipass_handoffs table (Phase 34)
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS ipass_handoffs (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        session_id UUID REFERENCES intake_sessions(id) ON DELETE SET NULL,
        illness_severity VARCHAR(32) NOT NULL DEFAULT 'stable',
        patient_summary TEXT NOT NULL,
        action_items JSONB DEFAULT '[]'::jsonb,
        contingency_plans JSONB DEFAULT '[]'::jsonb,
        lines_tubes_drains JSONB DEFAULT '[]'::jsonb,
        discharge_barriers JSONB DEFAULT '[]'::jsonb,
        outgoing_clinician_id INTEGER,
        incoming_clinician_id INTEGER,
        synthesis_notes TEXT,
        signed_off_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create population_patient_raf table (Phase 35)
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS population_patient_raf (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        raf_score NUMERIC(5,3) NOT NULL DEFAULT 1.000,
        hcc_categories JSONB DEFAULT '[]'::jsonb,
        disease_interactions JSONB DEFAULT '[]'::jsonb,
        annual_capitation_benchmark NUMERIC(10,2) DEFAULT 0.00,
        calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create hedis_care_gaps table (Phase 35)
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS hedis_care_gaps (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        measure_code VARCHAR(32) NOT NULL,
        measure_name VARCHAR(128) NOT NULL,
        status VARCHAR(32) DEFAULT 'open',
        due_date DATE,
        last_completed_date DATE,
        recommended_action TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create sepsis_surveillance_events table (Phase 36)
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS sepsis_surveillance_events (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        session_id UUID REFERENCES intake_sessions(id) ON DELETE SET NULL,
        sirs_score INTEGER NOT NULL DEFAULT 0,
        qsofa_score INTEGER NOT NULL DEFAULT 0,
        news2_score INTEGER NOT NULL DEFAULT 0,
        deterioration_tier VARCHAR(32) NOT NULL DEFAULT 'low',
        vitals_snapshot JSONB DEFAULT '{}'::jsonb,
        labs_snapshot JSONB DEFAULT '{}'::jsonb,
        source_infection VARCHAR(128),
        status VARCHAR(32) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create sep1_bundle_actions table (Phase 36)
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS sep1_bundle_actions (
        id SERIAL PRIMARY KEY,
        surveillance_id INTEGER REFERENCES sepsis_surveillance_events(id) ON DELETE CASCADE,
        bundle_window VARCHAR(16) NOT NULL DEFAULT '3_hour',
        lactate_measured BOOLEAN DEFAULT FALSE,
        lactate_value NUMERIC(4,1),
        blood_cultures_drawn BOOLEAN DEFAULT FALSE,
        broad_spectrum_abx_ordered BOOLEAN DEFAULT FALSE,
        abx_regimen VARCHAR(128),
        fluid_resuscitation_administered BOOLEAN DEFAULT FALSE,
        fluid_volume_ml INTEGER DEFAULT 0,
        vasopressors_initiated BOOLEAN DEFAULT FALSE,
        repeat_lactate_measured BOOLEAN DEFAULT FALSE,
        bundle_completed_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create claims_revcycle_records table (Phase 37)
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS claims_revcycle_records (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        session_id UUID REFERENCES intake_sessions(id) ON DELETE SET NULL,
        claim_type VARCHAR(16) NOT NULL DEFAULT 'CMS-1500',
        payer_name VARCHAR(128) NOT NULL,
        total_billed_cents INTEGER NOT NULL DEFAULT 0,
        status VARCHAR(32) NOT NULL DEFAULT 'scrubbed_clean',
        cpt_codes JSONB DEFAULT '[]'::jsonb,
        icd10_codes JSONB DEFAULT '[]'::jsonb,
        cci_edits_detected JSONB DEFAULT '[]'::jsonb,
        ncd_lcd_compliance BOOLEAN DEFAULT TRUE,
        denial_reason_code VARCHAR(32),
        denial_reason_description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create claim_appeal_letters table (Phase 37)
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS claim_appeal_letters (
        id SERIAL PRIMARY KEY,
        claim_id INTEGER REFERENCES claims_revcycle_records(id) ON DELETE CASCADE,
        appeal_level VARCHAR(32) DEFAULT 'first_level_reconsideration',
        letter_content TEXT NOT NULL,
        clinical_evidence JSONB DEFAULT '[]'::jsonb,
        generated_by VARCHAR(64) DEFAULT 'ai_clinical_appeals_engine',
        submitted_at TIMESTAMP,
        status VARCHAR(32) DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create hah_enrollments table (Phase 38)
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS hah_enrollments (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        session_id UUID REFERENCES intake_sessions(id) ON DELETE SET NULL,
        admission_diagnosis VARCHAR(128) NOT NULL,
        acuity_tier VARCHAR(32) DEFAULT 'moderate',
        primary_virtual_nurse_id INTEGER,
        status VARCHAR(32) DEFAULT 'active',
        daily_checkin_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        discharged_at TIMESTAMP
      );
    `);

    // Create rpm_device_fleet table (Phase 38)
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS rpm_device_fleet (
        id SERIAL PRIMARY KEY,
        enrollment_id INTEGER REFERENCES hah_enrollments(id) ON DELETE CASCADE,
        device_type VARCHAR(64) NOT NULL,
        serial_number VARCHAR(64) NOT NULL UNIQUE,
        battery_percent INTEGER DEFAULT 100,
        cellular_signal_strength VARCHAR(16) DEFAULT 'strong',
        sync_frequency_minutes INTEGER DEFAULT 15,
        last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(32) DEFAULT 'online'
      );
    `);

    // Create rpm_telemetry_readings table (Phase 38)
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS rpm_telemetry_readings (
        id SERIAL PRIMARY KEY,
        device_id INTEGER REFERENCES rpm_device_fleet(id) ON DELETE CASCADE,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        reading_type VARCHAR(64) NOT NULL,
        reading_data JSONB NOT NULL,
        is_out_of_bounds BOOLEAN DEFAULT FALSE,
        alert_severity VARCHAR(32) DEFAULT 'normal',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create rpm_billing_logs table (Phase 38)
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS rpm_billing_logs (
        id SERIAL PRIMARY KEY,
        enrollment_id INTEGER REFERENCES hah_enrollments(id) ON DELETE CASCADE,
        cpt_code VARCHAR(16) NOT NULL,
        qualified_days_count INTEGER DEFAULT 1,
        minutes_logged INTEGER DEFAULT 20,
        status VARCHAR(32) DEFAULT 'billable',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create voice_biomarker_sessions table (Phase 39)
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS voice_biomarker_sessions (
        id SERIAL PRIMARY KEY,
        session_id UUID REFERENCES intake_sessions(id) ON DELETE SET NULL,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        audio_duration_seconds REAL NOT NULL,
        fundamental_frequency_f0 REAL NOT NULL,
        f0_std_dev REAL NOT NULL,
        jitter_percent REAL NOT NULL,
        shimmer_percent REAL NOT NULL,
        hnr_db REAL NOT NULL,
        speech_rate_wpm INTEGER NOT NULL,
        pause_ratio REAL NOT NULL,
        respiratory_pause_count INTEGER DEFAULT 0,
        affective_tone VARCHAR(64) NOT NULL,
        clinical_screen_flags JSONB DEFAULT '[]'::jsonb,
        ai_vocal_summary TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_voice_bio_patient ON voice_biomarker_sessions(patient_id);
      CREATE INDEX IF NOT EXISTS idx_voice_bio_session ON voice_biomarker_sessions(session_id);
    `);

    // Create hospital_bed_inventory table (Phase 40)
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS hospital_bed_inventory (
        id SERIAL PRIMARY KEY,
        facility_name VARCHAR(128) NOT NULL,
        unit_name VARCHAR(64) NOT NULL,
        bed_number VARCHAR(32) NOT NULL,
        bed_type VARCHAR(32) NOT NULL,
        status VARCHAR(32) DEFAULT 'available',
        acuity_capabilities JSONB DEFAULT '[]'::jsonb,
        assigned_patient_name VARCHAR(128),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_bed_status ON hospital_bed_inventory(status);
      CREATE INDEX IF NOT EXISTS idx_bed_unit ON hospital_bed_inventory(unit_name);
    `);

    // Create facility_transfer_requests table (Phase 40)
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS facility_transfer_requests (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        session_id UUID REFERENCES intake_sessions(id) ON DELETE SET NULL,
        sending_facility VARCHAR(128) NOT NULL,
        receiving_facility VARCHAR(128) NOT NULL,
        service_needed VARCHAR(64) NOT NULL,
        urgency_level VARCHAR(32) NOT NULL,
        sending_physician_name VARCHAR(128) NOT NULL,
        receiving_physician_name VARCHAR(128),
        receiving_physician_accepted BOOLEAN DEFAULT FALSE,
        bed_assigned_id INTEGER REFERENCES hospital_bed_inventory(id) ON DELETE SET NULL,
        transport_mode VARCHAR(32) DEFAULT 'ground_als',
        transport_eta_minutes INTEGER,
        emtala_compliance_status VARCHAR(32) DEFAULT 'pending_acceptance',
        clinical_rationale TEXT NOT NULL,
        status VARCHAR(32) DEFAULT 'requested',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_transfer_patient ON facility_transfer_requests(patient_id);
      CREATE INDEX IF NOT EXISTS idx_transfer_status ON facility_transfer_requests(status);
    `);

    // Create surgical_cases table (Phase 41)
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS surgical_cases (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        session_id UUID REFERENCES intake_sessions(id) ON DELETE SET NULL,
        procedure_name VARCHAR(255) NOT NULL,
        operating_room VARCHAR(64) NOT NULL,
        primary_surgeon VARCHAR(128) NOT NULL,
        anesthesiologist VARCHAR(128) NOT NULL,
        asa_class VARCHAR(16) NOT NULL DEFAULT 'ASA_II',
        rcri_score INTEGER DEFAULT 0,
        mallampati_class VARCHAR(16) DEFAULT 'Class_I',
        npo_status_verified BOOLEAN DEFAULT TRUE,
        status VARCHAR(32) DEFAULT 'scheduled',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_surg_patient ON surgical_cases(patient_id);
      CREATE INDEX IF NOT EXISTS idx_surg_status ON surgical_cases(status);
      CREATE INDEX IF NOT EXISTS idx_surg_or ON surgical_cases(operating_room);
    `);

    // Create anesthesia_records table (Phase 41)
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS anesthesia_records (
        id SERIAL PRIMARY KEY,
        case_id INTEGER REFERENCES surgical_cases(id) ON DELETE CASCADE,
        anesthesia_type VARCHAR(64) NOT NULL,
        airway_grade VARCHAR(32) DEFAULT 'Grade_1',
        tof_twitch_count INTEGER DEFAULT 4,
        reversal_agent VARCHAR(64),
        ebl_ml INTEGER DEFAULT 50,
        fluids_administered_ml INTEGER DEFAULT 1000,
        aldrete_score INTEGER DEFAULT 10,
        ponv_apfel_score INTEGER DEFAULT 1,
        eras_protocol_adherence JSONB DEFAULT '[]'::jsonb,
        anesthesia_summary TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_anesthesia_case ON anesthesia_records(case_id);
    `);

    // Create device_line_days table (Phase 42)
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS device_line_days (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        session_id UUID REFERENCES intake_sessions(id) ON DELETE SET NULL,
        device_type VARCHAR(64) NOT NULL,
        insertion_date DATE NOT NULL,
        removal_date DATE,
        line_days_count INTEGER DEFAULT 1,
        anatomical_site VARCHAR(64) NOT NULL,
        necessity_justification VARCHAR(255) NOT NULL,
        bundle_checklist JSONB DEFAULT '[]'::jsonb,
        status VARCHAR(32) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_device_patient ON device_line_days(patient_id);
      CREATE INDEX IF NOT EXISTS idx_device_status ON device_line_days(status);
    `);

    // Create hai_surveillance_events table (Phase 42)
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS hai_surveillance_events (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        device_line_id INTEGER REFERENCES device_line_days(id) ON DELETE SET NULL,
        infection_type VARCHAR(32) NOT NULL,
        nhsn_criteria_met BOOLEAN DEFAULT TRUE,
        identified_organism VARCHAR(128) NOT NULL,
        colony_count VARCHAR(64),
        isolation_precautions VARCHAR(64) NOT NULL,
        hacrp_domain VARCHAR(32) DEFAULT 'Domain_2_NHSN',
        hacrp_penalty_risk VARCHAR(32) DEFAULT 'elevated',
        infection_prevention_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_hai_patient ON hai_surveillance_events(patient_id);
      CREATE INDEX IF NOT EXISTS idx_hai_type ON hai_surveillance_events(infection_type);
    `);

    // Create med_reconciliations table (Phase 43)
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS med_reconciliations (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        session_id UUID REFERENCES intake_sessions(id) ON DELETE SET NULL,
        reconciliation_type VARCHAR(64) DEFAULT 'inpatient_to_discharge',
        home_medications JSONB DEFAULT '[]'::jsonb,
        inpatient_medications JSONB DEFAULT '[]'::jsonb,
        discharge_medications JSONB DEFAULT '[]'::jsonb,
        discrepancies JSONB DEFAULT '[]'::jsonb,
        formulary_alternatives JSONB DEFAULT '[]'::jsonb,
        status VARCHAR(32) DEFAULT 'pending_review',
        reviewed_by VARCHAR(128),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_medrec_patient ON med_reconciliations(patient_id);
      CREATE INDEX IF NOT EXISTS idx_medrec_status ON med_reconciliations(status);
    `);

    // Create bedside_delivery_orders table (Phase 43)
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS bedside_delivery_orders (
        id SERIAL PRIMARY KEY,
        reconciliation_id INTEGER REFERENCES med_reconciliations(id) ON DELETE CASCADE,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        room_bed VARCHAR(64) NOT NULL,
        target_discharge_time TIMESTAMP,
        delivery_status VARCHAR(32) DEFAULT 'order_placed',
        courier_name VARCHAR(128) DEFAULT 'Pharmacy Courier Team',
        copay_amount NUMERIC(8, 2) DEFAULT 0.00,
        copay_collected BOOLEAN DEFAULT FALSE,
        teach_back_completed BOOLEAN DEFAULT FALSE,
        medication_list JSONB DEFAULT '[]'::jsonb,
        pharmacist_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_bedside_patient ON bedside_delivery_orders(patient_id);
      CREATE INDEX IF NOT EXISTS idx_bedside_status ON bedside_delivery_orders(delivery_status);
    `);

    // Create tumor_genomic_variants table (Phase 44)
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS tumor_genomic_variants (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        session_id UUID REFERENCES intake_sessions(id) ON DELETE SET NULL,
        gene_symbol VARCHAR(32) NOT NULL,
        variant_nomenclature VARCHAR(64) NOT NULL,
        variant_allele_frequency NUMERIC(5, 2) DEFAULT 0.00,
        amp_tier VARCHAR(16) DEFAULT 'Tier_I',
        actionable_drug_target VARCHAR(128) NOT NULL,
        evidence_level VARCHAR(32) DEFAULT 'FDA_approved',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_variant_patient ON tumor_genomic_variants(patient_id);
      CREATE INDEX IF NOT EXISTS idx_variant_gene ON tumor_genomic_variants(gene_symbol);
    `);

    // Create oncology_pathway_records table (Phase 44)
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS oncology_pathway_records (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        session_id UUID REFERENCES intake_sessions(id) ON DELETE SET NULL,
        cancer_type VARCHAR(64) NOT NULL,
        histology VARCHAR(64) NOT NULL,
        clinical_stage VARCHAR(32) NOT NULL,
        biomarker_profile JSONB DEFAULT '{}'::jsonb,
        proposed_regimen VARCHAR(128) NOT NULL,
        nccn_concordance VARCHAR(32) DEFAULT 'concordant',
        bsa_m2 NUMERIC(4, 2),
        calvert_auc_dose_mg NUMERIC(7, 2),
        mtb_recommendation TEXT,
        clinical_trial_matches JSONB DEFAULT '[]'::jsonb,
        status VARCHAR(32) DEFAULT 'tumor_board_approved',
        oncologist_signature VARCHAR(128),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_oncology_patient ON oncology_pathway_records(patient_id);
      CREATE INDEX IF NOT EXISTS idx_oncology_cancer ON oncology_pathway_records(cancer_type);
    `);

    // Create psych_crisis_evaluations table (Phase 45)
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS psych_crisis_evaluations (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        session_id UUID REFERENCES intake_sessions(id) ON DELETE SET NULL,
        bvc_score INTEGER NOT NULL DEFAULT 0,
        bvc_items JSONB DEFAULT '[]'::jsonb,
        violence_risk_level VARCHAR(32) NOT NULL DEFAULT 'low',
        suicide_risk_level VARCHAR(32) DEFAULT 'low',
        observation_level VARCHAR(32) DEFAULT 'standard_safety_rounds',
        de_escalation_protocol VARCHAR(64) DEFAULT 'verbal_trauma_informed',
        sensory_room_utilized BOOLEAN DEFAULT FALSE,
        chemical_restraint_administered BOOLEAN DEFAULT FALSE,
        evaluating_clinician VARCHAR(128),
        clinical_narrative TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_psych_patient ON psych_crisis_evaluations(patient_id);
      CREATE INDEX IF NOT EXISTS idx_psych_violence ON psych_crisis_evaluations(violence_risk_level);
    `);

    // Create involuntary_hold_records table (Phase 45)
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS involuntary_hold_records (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        crisis_evaluation_id INTEGER REFERENCES psych_crisis_evaluations(id) ON DELETE CASCADE,
        statutory_hold_type VARCHAR(64) NOT NULL,
        hold_criteria JSONB DEFAULT '[]'::jsonb,
        rights_advisement_delivered BOOLEAN DEFAULT TRUE,
        initiated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        hold_status VARCHAR(32) DEFAULT 'active_hold',
        initiating_clinician VARCHAR(128),
        destination_facility VARCHAR(128),
        bed_placement_status VARCHAR(32) DEFAULT 'searching',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_hold_patient ON involuntary_hold_records(patient_id);
      CREATE INDEX IF NOT EXISTS idx_hold_status ON involuntary_hold_records(hold_status);
    `);

    // Create icu_shock_records table (Phase 46)
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS icu_shock_records (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        session_id UUID REFERENCES intake_sessions(id) ON DELETE SET NULL,
        icu_bed VARCHAR(64) NOT NULL,
        shock_phenotype VARCHAR(32) NOT NULL,
        mean_arterial_pressure NUMERIC(5, 1) NOT NULL,
        cardiac_index NUMERIC(4, 2),
        systemic_vascular_resistance INTEGER,
        fluid_responsiveness_index VARCHAR(64),
        ultrasound_pattern VARCHAR(32) DEFAULT 'A_lines_dry',
        serum_lactate_mmol_l NUMERIC(4, 1) NOT NULL,
        lactate_clearance_percent NUMERIC(5, 1) DEFAULT 0.0,
        primary_vasopressor VARCHAR(64) DEFAULT 'Norepinephrine',
        current_dose_mcg_kg_min NUMERIC(5, 2) DEFAULT 0.00,
        resuscitation_status VARCHAR(32) DEFAULT 'active_resuscitation',
        attending_intensivist VARCHAR(128),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_shock_patient ON icu_shock_records(patient_id);
      CREATE INDEX IF NOT EXISTS idx_shock_phenotype ON icu_shock_records(shock_phenotype);
    `);

    // Create vasopressor_titrations table (Phase 46)
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS vasopressor_titrations (
        id SERIAL PRIMARY KEY,
        shock_record_id INTEGER REFERENCES icu_shock_records(id) ON DELETE CASCADE,
        agent_name VARCHAR(64) NOT NULL,
        dose_rate NUMERIC(6, 3) NOT NULL,
        dose_units VARCHAR(32) NOT NULL DEFAULT 'mcg/kg/min',
        target_map INTEGER DEFAULT 65,
        resulting_map INTEGER NOT NULL,
        titration_reason VARCHAR(128),
        titrated_by VARCHAR(128),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_titration_shock ON vasopressor_titrations(shock_record_id);
      CREATE INDEX IF NOT EXISTS idx_titration_agent ON vasopressor_titrations(agent_name);
    `);

    // Create cdi_chart_reviews table (Phase 47)
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS cdi_chart_reviews (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        session_id VARCHAR(100),
        admission_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        principal_diagnosis VARCHAR(255) NOT NULL,
        secondary_diagnoses TEXT[] DEFAULT ARRAY[]::TEXT[],
        clinical_indicators JSONB NOT NULL DEFAULT '{}'::jsonb,
        identified_discrepancies JSONB NOT NULL DEFAULT '[]'::jsonb,
        base_ms_drg VARCHAR(50),
        base_drg_weight NUMERIC(6, 4) DEFAULT 1.0000,
        projected_ms_drg VARCHAR(50),
        projected_drg_weight NUMERIC(6, 4) DEFAULT 1.0000,
        estimated_reimbursement_delta NUMERIC(10, 2) DEFAULT 0.00,
        review_status VARCHAR(50) DEFAULT 'discrepancy_detected',
        reviewer_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_cdi_patient ON cdi_chart_reviews(patient_id);
      CREATE INDEX IF NOT EXISTS idx_cdi_status ON cdi_chart_reviews(review_status);
    `);

    // Create physician_queries table (Phase 47)
    await migrationPool.query(`
      CREATE TABLE IF NOT EXISTS physician_queries (
        id SERIAL PRIMARY KEY,
        cdi_review_id INTEGER NOT NULL REFERENCES cdi_chart_reviews(id) ON DELETE CASCADE,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        query_type VARCHAR(100) NOT NULL,
        clinical_rationale TEXT NOT NULL,
        objective_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
        query_options JSONB NOT NULL DEFAULT '[]'::jsonb,
        compliance_audit_passed BOOLEAN DEFAULT TRUE,
        status VARCHAR(50) DEFAULT 'drafted',
        physician_response TEXT,
        selected_diagnosis VARCHAR(255),
        physician_response_notes TEXT,
        impact_summary TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        responded_at TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_query_cdi ON physician_queries(cdi_review_id);
      CREATE INDEX IF NOT EXISTS idx_query_status ON physician_queries(status);
      CREATE INDEX IF NOT EXISTS idx_query_type ON physician_queries(query_type);
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
