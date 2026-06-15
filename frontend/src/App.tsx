import React, { useState } from 'react';
import { HeartPulse, ShieldAlert, ClipboardList } from 'lucide-react';
import PatientChat from './components/PatientChat';
import ClinicianDashboard from './components/ClinicianDashboard';
import ObservabilityPanel from './components/ObservabilityPanel';

const BACKEND_URL = 'http://localhost:5001';

type AppTab = 'patient' | 'clinician' | 'observability';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('patient');

  return (
    <div className="app-container">
      {/* Premium Header */}
      <header className="header">
        <div className="logo-section">
          <span className="logo-icon">🩺</span>
          <h1>IntakeRx</h1>
          <span style={styles.badge}>Founding AI Stack</span>
        </div>

        {/* Tab Switcher */}
        <nav className="nav-tabs">
          <button 
            className={`tab-btn ${activeTab === 'patient' ? 'active' : ''}`}
            onClick={() => setActiveTab('patient')}
          >
            <HeartPulse size={16} />
            Patient Screen
          </button>
          
          <button 
            className={`tab-btn ${activeTab === 'clinician' ? 'active' : ''}`}
            onClick={() => setActiveTab('clinician')}
          >
            <ClipboardList size={16} />
            Clinician Portal
          </button>
          
          <button 
            className={`tab-btn ${activeTab === 'observability' ? 'active' : ''}`}
            onClick={() => setActiveTab('observability')}
          >
            <ShieldAlert size={16} />
            Safety & Evals
          </button>
        </nav>
      </header>

      {/* Main Panel Content */}
      <main style={styles.mainContent}>
        {activeTab === 'patient' && <PatientChat backendUrl={BACKEND_URL} />}
        {activeTab === 'clinician' && <ClinicianDashboard backendUrl={BACKEND_URL} />}
        {activeTab === 'observability' && <ObservabilityPanel backendUrl={BACKEND_URL} />}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  badge: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#a855f7',
    background: 'rgba(168, 85, 247, 0.15)',
    border: '1px solid rgba(168, 85, 247, 0.3)',
    borderRadius: '4px',
    padding: '2px 6px',
    marginLeft: '5px',
    textTransform: 'uppercase'
  },
  mainContent: {
    flex: 1,
    minHeight: '0', // scrolling container fix
    display: 'flex',
    flexDirection: 'column'
  }
};
