import { useState } from 'react';

export interface PainPoint {
  regionId: string;
  regionName: string;
  intensity: number; // 1 to 10
  quality: 'Sharp / Stabbing' | 'Dull / Aching' | 'Burning' | 'Throbbing' | 'Pressure / Tightness' | 'Radiating';
  radiationDetails?: string;
  view: 'anterior' | 'posterior';
}

interface BodyMapProps {
  onSavePainPoint: (point: PainPoint) => void;
  onClose: () => void;
  existingPoints?: PainPoint[];
}

export const ANATOMICAL_REGIONS: Record<string, { name: string; x: number; y: number; view: 'anterior' | 'posterior' }> = {
  // Anterior
  head: { name: 'Head & Neck', x: 100, y: 35, view: 'anterior' },
  chest: { name: 'Chest / Sternum', x: 100, y: 85, view: 'anterior' },
  abdomen: { name: 'Abdomen / Stomach', x: 100, y: 135, view: 'anterior' },
  pelvis: { name: 'Pelvis / Groin', x: 100, y: 175, view: 'anterior' },
  left_shoulder: { name: 'Left Shoulder / Arm', x: 145, y: 95, view: 'anterior' },
  right_shoulder: { name: 'Right Shoulder / Arm', x: 55, y: 95, view: 'anterior' },
  left_leg: { name: 'Left Thigh / Knee', x: 125, y: 240, view: 'anterior' },
  right_leg: { name: 'Right Thigh / Knee', x: 75, y: 240, view: 'anterior' },

  // Posterior
  neck_back: { name: 'Cervical Spine / Neck', x: 100, y: 45, view: 'posterior' },
  upper_back: { name: 'Upper Back / Scapula', x: 100, y: 95, view: 'posterior' },
  lower_back: { name: 'Lumbar Spine / Lower Back', x: 100, y: 155, view: 'posterior' },
  posterior_left_leg: { name: 'Left Hamstring / Calf', x: 125, y: 245, view: 'posterior' },
  posterior_right_leg: { name: 'Right Hamstring / Calf', x: 75, y: 245, view: 'posterior' }
};

export default function BodyMap({ onSavePainPoint, onClose, existingPoints = [] }: BodyMapProps) {
  const [activeView, setActiveView] = useState<'anterior' | 'posterior'>('anterior');
  const [selectedRegion, setSelectedRegion] = useState<string>('chest');
  const [intensity, setIntensity] = useState<number>(7);
  const [quality, setQuality] = useState<PainPoint['quality']>('Sharp / Stabbing');
  const [radiation, setRadiation] = useState<string>('Left shoulder and arm');

  const getIntensityColor = (score: number) => {
    if (score <= 3) return '#10b981'; // Mild
    if (score <= 6) return '#f59e0b'; // Moderate
    return '#ef4444'; // Severe
  };

  const handleSave = () => {
    const region = ANATOMICAL_REGIONS[selectedRegion];
    if (!region) return;

    onSavePainPoint({
      regionId: selectedRegion,
      regionName: region.name,
      intensity,
      quality,
      radiationDetails: radiation.trim() ? radiation.trim() : undefined,
      view: region.view
    });
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '780px',
        backgroundColor: '#0f172a',
        border: '1px solid var(--glass-border)',
        borderRadius: '14px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 20px 50px rgba(0,0,0,0.7)'
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
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: 'white' }}>
              🧍 Interactive Anatomical Pain Locator
            </h3>
            <p style={{ margin: '3px 0 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
              Click directly on the anatomical diagram to pinpoint pain location, intensity (1–10 VAS), and radiation.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '22px', cursor: 'pointer' }}
          >
            &times;
          </button>
        </div>

        {/* Content Body */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', padding: '20px', gap: '20px' }}>
          {/* Left: SVG Anatomical Diagram */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button
                type="button"
                onClick={() => setActiveView('anterior')}
                style={{
                  padding: '5px 14px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  backgroundColor: activeView === 'anterior' ? '#3b82f6' : 'rgba(255, 255, 255, 0.05)',
                  color: 'white',
                  border: '1px solid var(--glass-border)',
                  cursor: 'pointer'
                }}
              >
                Anterior (Front)
              </button>
              <button
                type="button"
                onClick={() => setActiveView('posterior')}
                style={{
                  padding: '5px 14px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  backgroundColor: activeView === 'posterior' ? '#3b82f6' : 'rgba(255, 255, 255, 0.05)',
                  color: 'white',
                  border: '1px solid var(--glass-border)',
                  cursor: 'pointer'
                }}
              >
                Posterior (Back)
              </button>
            </div>

            {/* SVG Silhouette */}
            <div style={{
              position: 'relative',
              width: '200px',
              height: '320px',
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              borderRadius: '10px',
              border: '1px solid var(--glass-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg width="200" height="320" viewBox="0 0 200 320">
                {/* Silhouette Body Outline */}
                <path
                  d="M 100 15 C 88 15 85 25 85 35 C 85 45 92 50 92 55 C 80 58 72 65 65 80 L 45 135 C 42 142 48 146 54 142 L 72 105 L 75 160 L 70 240 L 68 300 C 68 305 76 308 80 300 L 92 210 L 100 210 L 108 210 L 120 300 C 124 308 132 305 132 300 L 130 240 L 125 160 L 128 105 L 146 142 C 152 146 158 142 155 135 L 135 80 C 128 65 120 58 108 55 C 108 50 115 45 115 35 C 115 25 112 15 100 15 Z"
                  fill="rgba(255, 255, 255, 0.04)"
                  stroke="rgba(168, 85, 247, 0.4)"
                  strokeWidth="2"
                />

                {/* Clickable Region Targets */}
                {Object.entries(ANATOMICAL_REGIONS)
                  .filter(([_, reg]) => reg.view === activeView)
                  .map(([key, reg]) => {
                    const isSelected = selectedRegion === key;
                    const existing = existingPoints.find(p => p.regionId === key);
                    const circleColor = isSelected
                      ? getIntensityColor(intensity)
                      : existing
                      ? getIntensityColor(existing.intensity)
                      : '#a855f7';

                    return (
                      <g key={key} onClick={() => setSelectedRegion(key)} style={{ cursor: 'pointer' }}>
                        {isSelected && (
                          <circle
                            cx={reg.x}
                            cy={reg.y}
                            r={18}
                            fill="none"
                            stroke={circleColor}
                            strokeWidth="2"
                            strokeDasharray="3 3"
                            className="pulse-red"
                          />
                        )}
                        <circle
                          cx={reg.x}
                          cy={reg.y}
                          r={10}
                          fill={circleColor}
                          fillOpacity={isSelected ? 0.9 : 0.4}
                          stroke="white"
                          strokeWidth={isSelected ? 2 : 1}
                        />
                        <text
                          x={reg.x}
                          y={reg.y + 3}
                          textAnchor="middle"
                          fill="white"
                          fontSize="8"
                          fontWeight="bold"
                        >
                          {isSelected ? intensity : existing ? existing.intensity : '+'}
                        </text>
                      </g>
                    );
                  })}
              </svg>
            </div>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px' }}>
              Selected: <strong style={{ color: '#38bdf8' }}>{ANATOMICAL_REGIONS[selectedRegion]?.name}</strong>
            </span>
          </div>

          {/* Right: Pain Properties Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
            {/* Active Region Name */}
            <div style={{
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.2)'
            }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Anatomical Target:</span>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'white' }}>
                {ANATOMICAL_REGIONS[selectedRegion]?.name}
              </div>
            </div>

            {/* Pain Intensity Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'white' }}>
                  Pain Intensity (VAS 1–10):
                </label>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: getIntensityColor(intensity),
                  fontFamily: 'monospace'
                }}>
                  {intensity} / 10 ({intensity <= 3 ? 'Mild' : intensity <= 6 ? 'Moderate' : 'Severe'})
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={intensity}
                onChange={e => setIntensity(parseInt(e.target.value, 10))}
                style={{ width: '100%', accentColor: getIntensityColor(intensity), cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>
                <span>1 - Minimal</span>
                <span>5 - Distracting</span>
                <span>10 - Worst Possible</span>
              </div>
            </div>

            {/* Pain Quality Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'white', marginBottom: '6px' }}>
                Pain Character / Quality:
              </label>
              <select
                value={quality}
                onChange={e => setQuality(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(15, 23, 42, 0.8)',
                  color: 'white',
                  border: '1px solid var(--glass-border)',
                  fontSize: '12px'
                }}
              >
                <option value="Sharp / Stabbing">Sharp / Stabbing</option>
                <option value="Dull / Aching">Dull / Aching</option>
                <option value="Pressure / Tightness">Pressure / Tightness (Crushing)</option>
                <option value="Burning">Burning / Heat</option>
                <option value="Throbbing">Throbbing / Pulsatile</option>
                <option value="Radiating">Radiating / Shooting</option>
              </select>
            </div>

            {/* Radiation Details */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'white', marginBottom: '6px' }}>
                Radiation Pattern (Optional):
              </label>
              <input
                type="text"
                value={radiation}
                onChange={e => setRadiation(e.target.value)}
                placeholder="e.g., Radiating to left shoulder, jaw, or flank"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(15, 23, 42, 0.8)',
                  color: 'white',
                  border: '1px solid var(--glass-border)',
                  fontSize: '12px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-muted)',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                style={{
                  flex: 2,
                  padding: '10px',
                  borderRadius: '6px',
                  backgroundColor: '#3b82f6',
                  border: 'none',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Save Pain Location →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
