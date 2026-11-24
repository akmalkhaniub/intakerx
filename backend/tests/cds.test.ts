import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CDSService } from '../src/services/cds';
import { pool } from '../src/db';

describe('CDSService.analyzeSession (offline fixtures)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('flags missing_therapy and contraindicated_therapy alerts for Hypertension and Diabetes + Contrast Dye', async () => {
    const querySpy = vi.spyOn(pool, 'query').mockImplementation(async (sql: any) => {
      const q = String(sql);
      if (q.includes('FROM symptoms')) {
        return {
          rows: [{ name: 'Hypertension' }, { name: 'Diabetes' }],
          rowCount: 2,
        } as any;
      }
      if (q.includes('FROM medications')) {
        return {
          rows: [{ name: 'Contrast Dye' }],
          rowCount: 1,
        } as any;
      }
      if (q.includes('FROM clinical_guidelines')) {
        return {
          rows: [
            {
              conditionName: 'Hypertension',
              recommendedProtocol: 'ACC/AHA Blood Pressure Management',
              requiredMeds: ['Lisinopril', 'Amlodipine'],
              contraindicatedMeds: ['Pseudoephedrine'],
            },
            {
              conditionName: 'Diabetes',
              recommendedProtocol: 'ADA Glycemic Control Protocol',
              requiredMeds: ['Metformin', 'Insulin'],
              contraindicatedMeds: ['Contrast Dye'],
            },
          ],
          rowCount: 2,
        } as any;
      }
      return { rows: [], rowCount: 0 } as any;
    });

    const alerts = await CDSService.analyzeSession('sess-cds-001');
    expect(querySpy).toHaveBeenCalledTimes(3);
    expect(alerts).toHaveLength(3);

    expect(alerts.some((a) => a.conditionName === 'Hypertension' && a.type === 'missing_therapy')).toBe(true);
    expect(alerts.some((a) => a.conditionName === 'Diabetes' && a.type === 'missing_therapy')).toBe(true);
    const contra = alerts.find((a) => a.conditionName === 'Diabetes' && a.type === 'contraindicated_therapy');
    expect(contra).toBeDefined();
    expect(contra?.severity).toBe('high');
  });
});
