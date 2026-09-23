import { pool } from '../db';
import { notificationBus } from '../notifications';

export interface VisualTriageResult {
  visualTags: string[];
  isRedFlag: boolean;
  triageSeverity: 'mild' | 'moderate' | 'severe' | 'emergency';
  clinicalObservations: string[];
}

export interface MedicalAttachment {
  id: number;
  sessionId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  dataUrl: string;
  caption?: string;
  visualTags: string[];
  isRedFlag: boolean;
  createdAt: string;
}

export class VisualTriageService {
  /**
   * Evaluate medical image caption and context for visual clinical red flags
   */
  static evaluateVisualTriage(caption: string = '', fileName: string = ''): VisualTriageResult {
    const combined = `${caption} ${fileName}`.toLowerCase();
    const visualTags: string[] = [];
    const clinicalObservations: string[] = [];
    let isRedFlag = false;
    let triageSeverity: VisualTriageResult['triageSeverity'] = 'mild';

    // 1. Critical Red-Flag Patterns
    const criticalPatterns = [
      { trigger: 'necrotic', tag: 'Necrotic Tissue', obs: 'Black necrotic margins observed; urgent surgical eval needed' },
      { trigger: 'black tissue', tag: 'Gangrenous Change', obs: 'Potential ischemia or necrotizing infection' },
      { trigger: 'purpura', tag: 'Purpuric Rash', obs: 'Non-blanching purpura; rule out meningococcemia or vasculitis' },
      { trigger: 'petechiae', tag: 'Petechial Hemorrhage', obs: 'Petechiae noted; assess platelet count and bleeding risk' },
      { trigger: 'exposed bone', tag: 'Open Fracture / Exposed Structure', obs: 'Open structural wound; emergency orthopedic consult' },
      { trigger: 'arterial', tag: 'Active Arterial Bleeding', obs: 'Pulsatile bleeding reported; immediate pressure/tourniquet' },
      { trigger: 'spreading erythema', tag: 'Rapidly Spreading Cellulitis', obs: 'Erythema spreading quickly; mark borders and assess systemic signs' },
      { trigger: 'anaphylaxis', tag: 'Angioedema / Airway Threat', obs: 'Periorbital or lip swelling with respiratory compromise' },
      { trigger: 'pus draining', tag: 'Purulent Abscess', obs: 'Active purulent exudate; evaluate for drainage/culture' }
    ];

    for (const item of criticalPatterns) {
      if (combined.includes(item.trigger)) {
        isRedFlag = true;
        triageSeverity = 'emergency';
        visualTags.push(item.tag);
        clinicalObservations.push(item.obs);
      }
    }

    // 2. Urgent / Moderate Patterns
    if (!isRedFlag) {
      const moderatePatterns = [
        { trigger: 'rash', tag: 'Cutaneous Rash', obs: 'Erythematous eruption requiring dermatologic assessment' },
        { trigger: 'swelling', tag: 'Edema / Swelling', obs: 'Localized soft tissue swelling' },
        { trigger: 'redness', tag: 'Localized Erythema', obs: 'Inflammatory erythema without systemic toxicity' },
        { trigger: 'bite', tag: 'Arthropod / Animal Bite', obs: 'Bite mark; check rabies/tetanus status' },
        { trigger: 'wound', tag: 'Cutaneous Wound', obs: 'Skin breach; assess depth and healing edges' },
        { trigger: 'burn', tag: 'Thermal / Chemical Burn', obs: 'Burn injury; classify depth (1st, 2nd, 3rd degree)' },
        { trigger: 'bruise', tag: 'Ecchymosis', obs: 'Subcutaneous hematoma' }
      ];

      for (const item of moderatePatterns) {
        if (combined.includes(item.trigger)) {
          triageSeverity = 'moderate';
          visualTags.push(item.tag);
          clinicalObservations.push(item.obs);
        }
      }
    }

    // Default category tags
    if (visualTags.length === 0) {
      visualTags.push('General Medical Photography', 'Clinical Review Pending');
      clinicalObservations.push('Image uploaded for provider visual inspection');
    }

    return {
      visualTags: Array.from(new Set(visualTags)),
      isRedFlag,
      triageSeverity,
      clinicalObservations
    };
  }

  /**
   * Save attachment, evaluate triage, and update session if red flag is detected
   */
  static async attachImage(
    sessionId: string,
    fileData: {
      fileName: string;
      mimeType: string;
      fileSize: number;
      dataUrl: string;
      caption?: string;
    }
  ): Promise<{ attachment: MedicalAttachment; triage: VisualTriageResult }> {
    const triage = this.evaluateVisualTriage(fileData.caption, fileData.fileName);

    const insertRes = await pool.query(
      `INSERT INTO medical_attachments 
       (session_id, file_name, mime_type, file_size, data_url, caption, visual_tags, is_red_flag)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        sessionId,
        fileData.fileName,
        fileData.mimeType,
        fileData.fileSize,
        fileData.dataUrl,
        fileData.caption || '',
        triage.visualTags,
        triage.isRedFlag
      ]
    );

    const attachment: MedicalAttachment = {
      id: insertRes.rows[0].id,
      sessionId: insertRes.rows[0].session_id,
      fileName: insertRes.rows[0].file_name,
      mimeType: insertRes.rows[0].mime_type,
      fileSize: insertRes.rows[0].file_size,
      dataUrl: insertRes.rows[0].data_url,
      caption: insertRes.rows[0].caption,
      visualTags: insertRes.rows[0].visual_tags,
      isRedFlag: insertRes.rows[0].is_red_flag,
      createdAt: insertRes.rows[0].created_at
    };

    // Record entry into chat message stream
    const messageContent = `[📷 Medical Photo Attached]: ${attachment.fileName}${attachment.caption ? ` — "${attachment.caption}"` : ''} (Visual Triage: ${triage.visualTags.join(', ')})${triage.isRedFlag ? ' ⚠️ RED FLAG VISUAL FINDING' : ''}`;
    await pool.query(
      `INSERT INTO messages (session_id, sender, content)
       VALUES ($1, 'patient', $2)`,
      [sessionId, messageContent]
    );

    // If red-flag, escalate encounter and dispatch notification
    if (triage.isRedFlag) {
      await pool.query(
        `UPDATE intake_sessions 
         SET triage_level = 'emergency', status = 'escalated', updated_at = NOW() 
         WHERE id = $1`,
        [sessionId]
      );

      notificationBus.push(
        'emergency_triage',
        'Critical Visual Symptom Flagged',
        `Patient photo upload flagged visual emergency [${triage.visualTags.join(', ')}]: "${attachment.caption || attachment.fileName}". Immediate clinical review recommended.`,
        { sessionId, severity: 'critical' }
      );
    }

    return { attachment, triage };
  }

  /**
   * Get all attachments for an encounter session
   */
  static async getAttachmentsForSession(sessionId: string): Promise<MedicalAttachment[]> {
    const res = await pool.query(
      `SELECT * FROM medical_attachments WHERE session_id = $1 ORDER BY created_at ASC`,
      [sessionId]
    );
    return res.rows.map(r => ({
      id: r.id,
      sessionId: r.session_id,
      fileName: r.file_name,
      mimeType: r.mime_type,
      fileSize: r.file_size,
      dataUrl: r.data_url,
      caption: r.caption,
      visualTags: r.visual_tags,
      isRedFlag: r.is_red_flag,
      createdAt: r.created_at
    }));
  }
}
