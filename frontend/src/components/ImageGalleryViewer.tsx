import React, { useState } from 'react';
import { Camera, ZoomIn, ZoomOut, X, AlertTriangle } from 'lucide-react';

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

interface ImageGalleryViewerProps {
  attachments: MedicalAttachment[];
  onRefresh?: () => void;
}

export const ImageGalleryViewer: React.FC<ImageGalleryViewerProps> = ({ attachments }) => {
  const [selectedImage, setSelectedImage] = useState<MedicalAttachment | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  const handleOpenLightbox = (item: MedicalAttachment) => {
    setSelectedImage(item);
    setZoomLevel(1);
  };

  const handleZoom = (delta: number) => {
    setZoomLevel(prev => Math.min(3, Math.max(0.5, prev + delta)));
  };

  if (!attachments || attachments.length === 0) {
    return (
      <div style={{
        padding: '24px',
        textAlign: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        borderRadius: '10px',
        border: '1px dashed var(--glass-border)',
        color: 'var(--text-muted)'
      }}>
        <Camera size={32} color="#64748b" style={{ margin: '0 auto 8px' }} />
        <p style={{ margin: 0, fontSize: '13px' }}>No medical photos attached for this encounter.</p>
        <p style={{ margin: '4px 0 0', fontSize: '11px' }}>
          When patients capture or attach visual symptoms, they will appear here with automated visual triage.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Camera size={16} color="#a855f7" />
          <h5 style={{ margin: 0, color: 'white', fontSize: '13px' }}>
            Attached Clinical Photos ({attachments.length})
          </h5>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          Click photo to open high-resolution diagnostic lightbox
        </span>
      </div>

      {/* Grid of Photo Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '12px'
      }}>
        {attachments.map(att => (
          <div
            key={att.id}
            onClick={() => handleOpenLightbox(att)}
            style={{
              borderRadius: '10px',
              overflow: 'hidden',
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              border: `1px solid ${att.isRedFlag ? 'rgba(239, 68, 68, 0.4)' : 'var(--glass-border)'}`,
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Image Thumbnail Container */}
            <div style={{
              height: '130px',
              backgroundColor: '#0a0f1d',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}>
              <img
                src={att.dataUrl}
                alt={att.fileName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              {att.isRedFlag && (
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.5)'
                }}>
                  <AlertTriangle size={11} /> Red Flag
                </div>
              )}
            </div>

            {/* Meta details */}
            <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {att.fileName}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {new Date(att.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {att.caption && (
                <p style={{ margin: 0, fontSize: '11px', color: '#cbd5e1', lineHeight: '1.3' }}>
                  "{att.caption}"
                </p>
              )}

              {/* Tags */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: 'auto', paddingTop: '4px' }}>
                {att.visualTags.map((tag, idx) => (
                  <span
                    key={idx}
                    style={{
                      fontSize: '9px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: att.isRedFlag ? 'rgba(239, 68, 68, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                      border: `1px solid ${att.isRedFlag ? 'rgba(239, 68, 68, 0.3)' : 'rgba(168, 85, 247, 0.3)'}`,
                      color: att.isRedFlag ? '#f87171' : '#c084fc',
                      fontWeight: 600
                    }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox Full-Screen Modal */}
      {selectedImage && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.88)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 2000,
          padding: '20px'
        }}>
          {/* Top Bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: '14px',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div>
              <h4 style={{ margin: 0, color: 'white', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {selectedImage.fileName}
                {selectedImage.isRedFlag && (
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#ef4444', color: 'white', fontWeight: 'bold' }}>
                    🚨 EMERGENCY VISUAL FINDING
                  </span>
                )}
              </h4>
              <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '12px' }}>
                {selectedImage.caption || 'No caption provided by patient.'}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={() => handleZoom(0.25)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px'
                }}
              >
                <ZoomIn size={14} /> Zoom In
              </button>
              <button
                type="button"
                onClick={() => handleZoom(-0.25)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px'
                }}
              >
                <ZoomOut size={14} /> Zoom Out
              </button>
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid #ef4444',
                  color: '#ef4444',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px'
                }}
              >
                <X size={14} /> Close
              </button>
            </div>
          </div>

          {/* Central Image Viewport */}
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'auto',
            padding: '20px'
          }}>
            <img
              src={selectedImage.dataUrl}
              alt={selectedImage.fileName}
              style={{
                maxWidth: '90%',
                maxHeight: '75vh',
                objectFit: 'contain',
                borderRadius: '8px',
                transform: `scale(${zoomLevel})`,
                transition: 'transform 0.15s ease-out',
                boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
              }}
            />
          </div>

          {/* Bottom Bar: Tags & Observations */}
          <div style={{
            paddingTop: '12px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Visual Triage Classifications:</span>
              {selectedImage.visualTags.map((tag, idx) => (
                <span
                  key={idx}
                  style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    color: '#e2e8f0',
                    fontSize: '11px',
                    fontWeight: 500
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
            <span style={{ color: 'var(--text-muted)' }}>
              Zoom: {Math.round(zoomLevel * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageGalleryViewer;
