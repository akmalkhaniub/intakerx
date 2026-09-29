import { pool } from '../db';

export interface VoiceBiomarkerInput {
  sessionId?: string | null;
  patientId: number;
  audioDurationSeconds: number;
  fundamentalFrequencyF0: number; // Hz
  f0StdDev: number; // Hz (pitch modulation)
  jitterPercent: number; // % (vocal frequency perturbation)
  shimmerPercent: number; // % (vocal amplitude perturbation)
  hnrDb: number; // Harmonics-to-Noise Ratio (dB)
  speechRateWpm: number; // Words Per Minute
  pauseRatio: number; // Silence/pause duration ratio (0.0 - 1.0)
  respiratoryPauseCount?: number;
  affectiveTone?: string;
  transcriptSample?: string;
}

export interface ClinicalScreenFlag {
  category: 'dysphonia' | 'respiratory' | 'affective' | 'prosodic';
  marker: string;
  severity: 'low' | 'moderate' | 'high';
  finding: string;
  clinicalSignificance: string;
}

export interface AcousticBiomarkerResult {
  id?: number;
  sessionId?: string | null;
  patientId: number;
  audioDurationSeconds: number;
  fundamentalFrequencyF0: number;
  f0StdDev: number;
  jitterPercent: number;
  shimmerPercent: number;
  hnrDb: number;
  speechRateWpm: number;
  pauseRatio: number;
  respiratoryPauseCount: number;
  affectiveTone: string;
  clinicalScreenFlags: ClinicalScreenFlag[];
  compositeScores: {
    dysphoniaSeverityIndex: number; // 0 - 100
    respiratoryStressIndex: number; // 0 - 100
    psychomotorSlowingScore: number; // 0 - 100
  };
  aiVocalSummary: string;
  createdAt?: string;
}

/**
 * Evaluates raw acoustic voice metrics against clinical phoniatric & psychiatric norms.
 */
export function evaluateAcousticBiomarkers(input: VoiceBiomarkerInput): {
  flags: ClinicalScreenFlag[];
  tone: string;
  compositeScores: {
    dysphoniaSeverityIndex: number;
    respiratoryStressIndex: number;
    psychomotorSlowingScore: number;
  };
  summary: string;
} {
  const flags: ClinicalScreenFlag[] = [];
  const respPauseCount = input.respiratoryPauseCount ?? 0;

  // 1. Phonation / Dysphonia Assessment (Jitter, Shimmer, HNR)
  const isJitterElevated = input.jitterPercent > 1.04;
  const isShimmerElevated = input.shimmerPercent > 3.81;
  const isHnrLow = input.hnrDb < 15.0;

  if (isJitterElevated || isShimmerElevated || isHnrLow) {
    const dysphoniaCount = (isJitterElevated ? 1 : 0) + (isShimmerElevated ? 1 : 0) + (isHnrLow ? 1 : 0);
    const severity = dysphoniaCount >= 2 ? 'high' : 'moderate';
    flags.push({
      category: 'dysphonia',
      marker: 'Pathologic Vocal Perturbation / Dysphonia',
      severity,
      finding: `Jitter: ${input.jitterPercent.toFixed(2)}% (norm <1.04%), Shimmer: ${input.shimmerPercent.toFixed(2)}% (norm <3.81%), HNR: ${input.hnrDb.toFixed(1)} dB (norm >20 dB)`,
      clinicalSignificance: dysphoniaCount >= 2
        ? 'Marked glottic turbulence and vocal cord irregularity. High clinical suspicion for vocal cord edema, paresis, or structural mucosal lesion.'
        : 'Mild glottal breathiness or vocal fold strain.'
    });
  }

  // 2. Respiratory Dynamics & Speech Fragmentation
  const isPauseRatioHigh = input.pauseRatio > 0.35;
  const isRespPauseFrequent = respPauseCount >= 4;

  if (isPauseRatioHigh || isRespPauseFrequent) {
    const severity = isPauseRatioHigh && isRespPauseFrequent ? 'high' : 'moderate';
    flags.push({
      category: 'respiratory',
      marker: 'Speech Dyspnea & Respiratory Phonation Pause',
      severity,
      finding: `Pause ratio: ${(input.pauseRatio * 100).toFixed(0)}%, Mid-sentence respiratory gasps: ${respPauseCount}`,
      clinicalSignificance: 'Frequent non-syntactic breath pauses during connected speech suggest air hunger, reduced vital capacity, or acute bronchospastic distress.'
    });
  }

  // 3. Neuro-Affective Prosody & Psychomotor Rhythm
  const isMonotone = input.f0StdDev < 15.0;
  const isBradylalia = input.speechRateWpm < 105;
  const isHyperfluent = input.speechRateWpm > 175 && input.f0StdDev > 45;

  if (isMonotone && isBradylalia) {
    flags.push({
      category: 'affective',
      marker: 'Monotone Prosody & Psychomotor Retardation',
      severity: 'moderate',
      finding: `F0 SD: ${input.f0StdDev.toFixed(1)} Hz (attenuated pitch contour), Speech Rate: ${input.speechRateWpm} WPM (bradylalic)`,
      clinicalSignificance: 'Restricted vocal prosodic range and verbal latency. Diagnostic acoustic marker frequently seen in Major Depressive Disorder (MDD) or Parkinsonian hypophonia.'
    });
  } else if (isHyperfluent) {
    flags.push({
      category: 'affective',
      marker: 'Tachylalic / Pressured Speech Rhythm',
      severity: 'low',
      finding: `Speech Rate: ${input.speechRateWpm} WPM, F0 SD: ${input.f0StdDev.toFixed(1)} Hz`,
      clinicalSignificance: 'Rapid, heightened pitch variance and high verbal output. Correlates with acute anxiety, panic, or autonomic adrenergic arousal.'
    });
  }

  // Determine Primary Affective Tone
  let tone = input.affectiveTone || 'normal_expressive';
  if (!input.affectiveTone) {
    if (isPauseRatioHigh && isRespPauseFrequent) {
      tone = 'dyspneic_interrupted';
    } else if (isMonotone && isBradylalia) {
      tone = 'flat_monotone';
    } else if (isHyperfluent) {
      tone = 'anxious_hyperfluent';
    } else {
      tone = 'normal_expressive';
    }
  }

  // Calculate Composite Quantitative Indices (0 - 100 scale)
  const dysphoniaSeverityIndex = Math.min(100, Math.round(
    ((input.jitterPercent / 1.04) * 30) +
    ((input.shimmerPercent / 3.81) * 30) +
    (Math.max(0, 20 - input.hnrDb) / 20 * 40)
  ));

  const respiratoryStressIndex = Math.min(100, Math.round(
    (Math.min(1.0, input.pauseRatio / 0.5) * 50) +
    (Math.min(6, respPauseCount) / 6 * 50)
  ));

  const psychomotorSlowingScore = Math.min(100, Math.round(
    (Math.max(0, 25 - input.f0StdDev) / 20 * 50) +
    (Math.max(0, 140 - input.speechRateWpm) / 70 * 50)
  ));

  // Synthesize Physician AI Summary
  let summary = `Acoustic voice analysis of ${input.audioDurationSeconds.toFixed(1)}s sample reveals `;
  if (flags.length === 0) {
    summary += `normal vocal fold harmonic stability (HNR ${input.hnrDb.toFixed(1)} dB, Jitter ${input.jitterPercent.toFixed(2)}%), smooth respiratory flow, and normative expressive prosody (Tone: ${tone.replace('_', ' ')}).`;
  } else {
    const flagNames = flags.map(f => f.marker).join('; ');
    summary += `actionable vocal acoustic alerts: [${flagNames}]. Classified vocal affect: ${tone.replace('_', ' ')}. `;
    if (dysphoniaSeverityIndex > 65) {
      summary += 'Significant dysphonia index indicates laryngeal vibration instability; consider indirect laryngoscopy or ENT consult if hoarseness persists. ';
    }
    if (respiratoryStressIndex > 60) {
      summary += 'Elevated respiratory stress index with frequent phonation gasps signals functional dyspnea; correlate with pulse oximetry and peak expiratory flow. ';
    }
    if (psychomotorSlowingScore > 60) {
      summary += 'Prosodic blunting and speech slowing noted; screen with PHQ-9 or evaluate for extrapyramidal symptoms.';
    }
  }

  return {
    flags,
    tone,
    compositeScores: {
      dysphoniaSeverityIndex,
      respiratoryStressIndex,
      psychomotorSlowingScore
    },
    summary
  };
}

/**
 * Persists an acoustic voice biomarker session into the database.
 */
export async function analyzeAndRecordAcousticSession(input: VoiceBiomarkerInput): Promise<AcousticBiomarkerResult> {
  const evaluated = evaluateAcousticBiomarkers(input);

  const query = `
    INSERT INTO voice_biomarker_sessions (
      session_id,
      patient_id,
      audio_duration_seconds,
      fundamental_frequency_f0,
      f0_std_dev,
      jitter_percent,
      shimmer_percent,
      hnr_db,
      speech_rate_wpm,
      pause_ratio,
      respiratory_pause_count,
      affective_tone,
      clinical_screen_flags,
      ai_vocal_summary
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING *;
  `;

  const values = [
    input.sessionId || null,
    input.patientId,
    input.audioDurationSeconds,
    input.fundamentalFrequencyF0,
    input.f0StdDev,
    input.jitterPercent,
    input.shimmerPercent,
    input.hnrDb,
    input.speechRateWpm,
    input.pauseRatio,
    input.respiratoryPauseCount || 0,
    evaluated.tone,
    JSON.stringify(evaluated.flags),
    evaluated.summary
  ];

  const { rows } = await pool.query(query, values);
  const row = rows[0];

  return {
    id: row.id,
    sessionId: row.session_id,
    patientId: Number(row.patient_id),
    audioDurationSeconds: Number(row.audio_duration_seconds),
    fundamentalFrequencyF0: Number(row.fundamental_frequency_f0),
    f0StdDev: Number(row.f0_std_dev),
    jitterPercent: Number(row.jitter_percent),
    shimmerPercent: Number(row.shimmer_percent),
    hnrDb: Number(row.hnr_db),
    speechRateWpm: Number(row.speech_rate_wpm),
    pauseRatio: Number(row.pause_ratio),
    respiratoryPauseCount: Number(row.respiratory_pause_count),
    affectiveTone: row.affective_tone,
    clinicalScreenFlags: typeof row.clinical_screen_flags === 'string'
      ? JSON.parse(row.clinical_screen_flags)
      : row.clinical_screen_flags,
    compositeScores: evaluated.compositeScores,
    aiVocalSummary: row.ai_vocal_summary,
    createdAt: row.created_at
  };
}

/**
 * Retrieves biomarker sessions for a patient or session.
 */
export async function getAcousticSessions(patientId?: number, sessionId?: string): Promise<AcousticBiomarkerResult[]> {
  let query = 'SELECT * FROM voice_biomarker_sessions';
  const values: any[] = [];
  const conditions: string[] = [];

  if (patientId) {
    conditions.push(`patient_id = $${values.length + 1}`);
    values.push(patientId);
  }

  if (sessionId) {
    conditions.push(`session_id = $${values.length + 1}`);
    values.push(sessionId);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  query += ' ORDER BY created_at DESC LIMIT 50;';

  const { rows } = await pool.query(query, values);

  return rows.map(row => {
    const flags: ClinicalScreenFlag[] = typeof row.clinical_screen_flags === 'string'
      ? JSON.parse(row.clinical_screen_flags)
      : (row.clinical_screen_flags || []);

    const evalRes = evaluateAcousticBiomarkers({
      sessionId: row.session_id,
      patientId: Number(row.patient_id),
      audioDurationSeconds: Number(row.audio_duration_seconds),
      fundamentalFrequencyF0: Number(row.fundamental_frequency_f0),
      f0StdDev: Number(row.f0_std_dev),
      jitterPercent: Number(row.jitter_percent),
      shimmerPercent: Number(row.shimmer_percent),
      hnrDb: Number(row.hnr_db),
      speechRateWpm: Number(row.speech_rate_wpm),
      pauseRatio: Number(row.pause_ratio),
      respiratoryPauseCount: Number(row.respiratory_pause_count),
      affectiveTone: row.affective_tone
    });

    return {
      id: row.id,
      sessionId: row.session_id,
      patientId: Number(row.patient_id),
      audioDurationSeconds: Number(row.audio_duration_seconds),
      fundamentalFrequencyF0: Number(row.fundamental_frequency_f0),
      f0StdDev: Number(row.f0_std_dev),
      jitterPercent: Number(row.jitter_percent),
      shimmerPercent: Number(row.shimmer_percent),
      hnrDb: Number(row.hnr_db),
      speechRateWpm: Number(row.speech_rate_wpm),
      pauseRatio: Number(row.pause_ratio),
      respiratoryPauseCount: Number(row.respiratory_pause_count),
      affectiveTone: row.affective_tone,
      clinicalScreenFlags: flags,
      compositeScores: evalRes.compositeScores,
      aiVocalSummary: row.ai_vocal_summary,
      createdAt: row.created_at
    };
  });
}

/**
 * Retrieves a single acoustic session by ID.
 */
export async function getAcousticSessionById(id: number): Promise<AcousticBiomarkerResult | null> {
  const query = 'SELECT * FROM voice_biomarker_sessions WHERE id = $1';
  const { rows } = await pool.query(query, [id]);
  if (rows.length === 0) return null;

  const row = rows[0];
  const evalRes = evaluateAcousticBiomarkers({
    sessionId: row.session_id,
    patientId: Number(row.patient_id),
    audioDurationSeconds: Number(row.audio_duration_seconds),
    fundamentalFrequencyF0: Number(row.fundamental_frequency_f0),
    f0StdDev: Number(row.f0_std_dev),
    jitterPercent: Number(row.jitter_percent),
    shimmerPercent: Number(row.shimmer_percent),
    hnrDb: Number(row.hnr_db),
    speechRateWpm: Number(row.speech_rate_wpm),
    pauseRatio: Number(row.pause_ratio),
    respiratoryPauseCount: Number(row.respiratory_pause_count),
    affectiveTone: row.affective_tone
  });

  return {
    id: row.id,
    sessionId: row.session_id,
    patientId: Number(row.patient_id),
    audioDurationSeconds: Number(row.audio_duration_seconds),
    fundamentalFrequencyF0: Number(row.fundamental_frequency_f0),
    f0StdDev: Number(row.f0_std_dev),
    jitterPercent: Number(row.jitter_percent),
    shimmerPercent: Number(row.shimmer_percent),
    hnrDb: Number(row.hnr_db),
    speechRateWpm: Number(row.speech_rate_wpm),
    pauseRatio: Number(row.pause_ratio),
    respiratoryPauseCount: Number(row.respiratory_pause_count),
    affectiveTone: row.affective_tone,
    clinicalScreenFlags: typeof row.clinical_screen_flags === 'string'
      ? JSON.parse(row.clinical_screen_flags)
      : row.clinical_screen_flags,
    compositeScores: evalRes.compositeScores,
    aiVocalSummary: row.ai_vocal_summary,
    createdAt: row.created_at
  };
}
