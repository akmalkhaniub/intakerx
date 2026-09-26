export interface StartCriteria {
  canWalk: boolean;
  hasSpontaneousBreathing: boolean;
  airwayRepositioned?: boolean;
  respiratoryRate?: number;
  hasRadialPulse?: boolean;
  capillaryRefillSec?: number;
  followsCommands?: boolean;
}

export interface OfflineFieldIntake {
  offlineId: string;
  timestamp: string;
  fieldResponder: string;
  patientName?: string;
  estimatedAge?: number;
  sex?: string;
  chiefComplaint: string;
  startCriteria: StartCriteria;
  vitalSigns?: {
    heartRate?: number;
    respiratoryRate?: number;
    oxygenSat?: number;
    bloodPressure?: string;
  };
  fieldNotes?: string;
  triageTagOverride?: 'RED' | 'YELLOW' | 'GREEN' | 'BLACK';
  localComputedTag: 'RED' | 'YELLOW' | 'GREEN' | 'BLACK';
}

const STORAGE_KEY = 'intakerx_offline_field_intakes';

export class OfflineSyncEngine {
  /**
   * Evaluates START triage locally on device without network connection.
   */
  public static computeLocalStartTriage(criteria: StartCriteria): {
    tag: 'RED' | 'YELLOW' | 'GREEN' | 'BLACK';
    label: string;
  } {
    if (criteria.canWalk) {
      return { tag: 'GREEN', label: 'Minor (Walking Wounded)' };
    }
    if (!criteria.hasSpontaneousBreathing) {
      if (criteria.airwayRepositioned) {
        return { tag: 'RED', label: 'Immediate (Airway Cleared)' };
      }
      return { tag: 'BLACK', label: 'Expectant / Deceased' };
    }
    if (criteria.respiratoryRate !== undefined && (criteria.respiratoryRate > 30 || criteria.respiratoryRate < 10)) {
      return { tag: 'RED', label: 'Immediate (Severe Respiratory Failure)' };
    }
    if (criteria.hasRadialPulse === false || (criteria.capillaryRefillSec !== undefined && criteria.capillaryRefillSec > 2)) {
      return { tag: 'RED', label: 'Immediate (Severe Shock / Hypoperfusion)' };
    }
    if (criteria.followsCommands === false) {
      return { tag: 'RED', label: 'Immediate (Altered Mental Status)' };
    }
    return { tag: 'YELLOW', label: 'Delayed (Stable Non-Ambulatory)' };
  }

  /**
   * Retrieves pending offline field intakes from local storage
   */
  public static getPendingIntakes(): OfflineFieldIntake[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (err) {
      console.error('Failed to read offline intakes:', err);
      return [];
    }
  }

  /**
   * Saves an intake locally into offline queue
   */
  public static saveOfflineIntake(intake: Omit<OfflineFieldIntake, 'localComputedTag'>): OfflineFieldIntake {
    const computed = this.computeLocalStartTriage(intake.startCriteria);
    const fullIntake: OfflineFieldIntake = {
      ...intake,
      localComputedTag: intake.triageTagOverride || computed.tag
    };

    const current = this.getPendingIntakes();
    current.push(fullIntake);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch (err) {
      console.error('Failed to write to localStorage:', err);
    }

    return fullIntake;
  }

  /**
   * Transmits pending offline intakes to backend batch sync endpoint
   */
  public static async syncPendingIntakes(backendUrl: string): Promise<{
    syncedCount: number;
    remainingCount: number;
    results: any[];
  }> {
    const pending = this.getPendingIntakes();
    if (pending.length === 0) {
      return { syncedCount: 0, remainingCount: 0, results: [] };
    }

    try {
      const res = await fetch(`${backendUrl}/api/intake/offline/batch-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intakes: pending })
      });

      if (!res.ok) {
        throw new Error(`Sync server responded with ${res.status}`);
      }

      const report = await res.json();
      // Remove successfully synced or already synced items from local queue
      const syncedIds = new Set(report.results.map((r: any) => r.offlineId));
      const remaining = pending.filter(p => !syncedIds.has(p.offlineId));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));

      return {
        syncedCount: report.syncedCount,
        remainingCount: remaining.length,
        results: report.results
      };
    } catch (err) {
      console.warn('[OfflineSync] Server sync failed (network unreachable). Retaining local queue.', err);
      return {
        syncedCount: 0,
        remainingCount: pending.length,
        results: []
      };
    }
  }

  /**
   * Clears pending queue
   */
  public static clearQueue(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}
