import React, { useState } from 'react';
import { Camera, Upload, X, AlertCircle } from 'lucide-react';

interface ImageAttachmentModalProps {
  onClose: () => void;
  onUpload: (attachment: {
    fileName: string;
    mimeType: string;
    fileSize: number;
    dataUrl: string;
    caption: string;
  }) => Promise<void>;
}

// Preset clinical test photo samples for instant testing without requiring physical file uploads
const CLINICAL_PRESETS = [
  {
    name: 'Spreading Erythema / Cellulitis',
    fileName: 'erythema_lower_leg.png',
    caption: 'Rapidly spreading erythema across lower leg with black necrotic center and severe pain',
    color: '#ef4444',
    isRedFlag: true
  },
  {
    name: 'Cutaneous Rash / Hives',
    fileName: 'urticaria_chest.png',
    caption: 'Itchy erythematous rash on anterior chest following new medication',
    color: '#f59e0b',
    isRedFlag: false
  },
  {
    name: 'Localized Insect Bite',
    fileName: 'forearm_insect_bite.png',
    caption: 'Mild red bite on left forearm with slight itch, no fever',
    color: '#3b82f6',
    isRedFlag: false
  },
  {
    name: 'Post-Surgical Incision',
    fileName: 'surgical_incision_day3.png',
    caption: 'Day 3 post-op abdominal incision, edges well-approximated, minimal serous drainage',
    color: '#10b981',
    isRedFlag: false
  }
];

export const ImageAttachmentModal: React.FC<ImageAttachmentModalProps> = ({ onClose, onUpload }) => {
  const [selectedFile, setSelectedFile] = useState<{
    fileName: string;
    mimeType: string;
    fileSize: number;
    dataUrl: string;
  } | null>(null);
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Generate a high-contrast clinical SVG placeholder dataURL for the presets
  const generatePresetDataUrl = (label: string, color: string) => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
        <rect width="600" height="400" fill="#0f172a" />
        <rect x="20" y="20" width="560" height="360" rx="12" fill="#1e293b" stroke="${color}" stroke-width="2" />
        <circle cx="300" cy="180" r="60" fill="${color}" fill-opacity="0.25" stroke="${color}" stroke-width="3" />
        <text x="300" y="185" font-family="sans-serif" font-size="28" fill="${color}" font-weight="bold" text-anchor="middle">📷</text>
        <text x="300" y="270" font-family="sans-serif" font-size="18" fill="#f8fafc" font-weight="bold" text-anchor="middle">${label}</text>
        <text x="300" y="300" font-family="sans-serif" font-size="12" fill="#94a3b8" text-anchor="middle">IntakeRx Visual Triage Pre-Screening Image</text>
      </svg>
    `;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  };

  const handleSelectPreset = (preset: typeof CLINICAL_PRESETS[0]) => {
    setSelectedFile({
      fileName: preset.fileName,
      mimeType: 'image/svg+xml',
      fileSize: 4096,
      dataUrl: generatePresetDataUrl(preset.name, preset.color)
    });
    setCaption(preset.caption);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedFile({
        fileName: file.name,
        mimeType: file.type || 'image/jpeg',
        fileSize: file.size,
        dataUrl: reader.result as string
      });
      if (!caption) {
        setCaption(`Clinical photo: ${file.name}`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      await onUpload({
        fileName: selectedFile.fileName,
        mimeType: selectedFile.mimeType,
        fileSize: selectedFile.fileSize,
        dataUrl: selectedFile.dataUrl,
        caption: caption.trim()
      });
      onClose();
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '560px',
        width: '100%',
        backgroundColor: '#0f172a',
        borderRadius: '16px',
        border: '1px solid var(--glass-border)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--glass-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Camera size={20} color="#a855f7" />
            <h3 style={{ margin: 0, color: 'white', fontSize: '16px' }}>Attach Medical Photo / Document</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Preset Buttons */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
              QUICK CLINICAL SIMULATION PRESETS:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {CLINICAL_PRESETS.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelectPreset(p)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${selectedFile?.fileName === p.fileName ? p.color : 'var(--glass-border)'}`,
                    color: 'white',
                    fontSize: '11px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }}
                >
                  <span style={{ fontWeight: 600, color: p.color }}>{p.name}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{p.isRedFlag ? '⚠️ Emergency Test' : 'Routine Check'}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Or File Upload Drop Area */}
          <div style={{
            border: '2px dashed var(--glass-border)',
            borderRadius: '12px',
            padding: '20px',
            textAlign: 'center',
            backgroundColor: 'rgba(255,255,255,0.02)',
            position: 'relative',
            cursor: 'pointer'
          }}>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: 'pointer'
              }}
            />
            {selectedFile ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <img
                  src={selectedFile.dataUrl}
                  alt="Preview"
                  style={{ maxHeight: '140px', maxWidth: '100%', borderRadius: '8px', objectFit: 'contain' }}
                />
                <span style={{ fontSize: '12px', color: '#a855f7', fontWeight: 600 }}>
                  ✓ {selectedFile.fileName}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Click to choose a different photo
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <Upload size={28} color="#94a3b8" />
                <span style={{ fontSize: '13px', color: 'white', fontWeight: 500 }}>
                  Click to upload from device or drag photo here
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Supports JPEG, PNG, WEBP (Max 5MB)
                </span>
              </div>
            )}
          </div>

          {/* Caption Input */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Symptom Description / Caption:
            </label>
            <input
              type="text"
              className="input-text"
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="e.g. When did it start, is it spreading, does it itch or hurt?"
              style={{ width: '100%', padding: '10px 12px', fontSize: '13px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#94a3b8' }}>
            <AlertCircle size={14} color="#60a5fa" />
            <span>Images are processed securely in accordance with clinic HIPAA pre-screening safeguards.</span>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ flex: 1, padding: '10px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedFile || isUploading}
              className="btn"
              style={{ flex: 2, padding: '10px', fontWeight: 600 }}
            >
              {isUploading ? 'Analyzing & Uploading...' : 'Attach & Run Visual Triage →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ImageAttachmentModal;
