import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db';
import { generateFhirBundle } from './fhir';
import { notificationBus } from '../notifications';

export interface EHRTransaction {
  id: string;
  sessionId?: string;
  patientName: string;
  targetEhr: 'Epic Systems' | 'Cerner Millennium' | 'AthenaHealth';
  direction: 'outbound' | 'inbound';
  protocol: 'FHIR_R4' | 'HL7_V2';
  messageType: string;
  status: 'delivered' | 'failed' | 'retrying';
  httpStatus: number;
  latencyMs: number;
  payload: any;
  timestamp: string;
}

class EHRSandboxService {
  private transactions: EHRTransaction[] = [];

  constructor() {
    this.seedInitialTransactions();
  }

  private seedInitialTransactions() {
    const now = Date.now();
    this.transactions = [
      {
        id: 'tx-epic-' + (now - 3600000),
        sessionId: 'sim-session-001',
        patientName: 'Eleanor Vance',
        targetEhr: 'Epic Systems',
        direction: 'outbound',
        protocol: 'FHIR_R4',
        messageType: 'Bundle: DocumentReference (SOAP)',
        status: 'delivered',
        httpStatus: 201,
        latencyMs: 142,
        payload: {
          resourceType: 'Bundle',
          type: 'transaction',
          entry: [
            {
              resource: {
                resourceType: 'Patient',
                id: 'epic-pat-991',
                name: [{ family: 'Vance', given: ['Eleanor'] }],
                gender: 'female'
              }
            },
            {
              resource: {
                resourceType: 'DocumentReference',
                status: 'current',
                docStatus: 'final',
                description: 'Pre-Screening Intake Note (SOAP)'
              }
            }
          ]
        },
        timestamp: new Date(now - 3600000).toISOString()
      },
      {
        id: 'tx-cerner-' + (now - 1800000),
        sessionId: 'sim-session-002',
        patientName: 'Marcus Brody',
        targetEhr: 'Cerner Millennium',
        direction: 'outbound',
        protocol: 'HL7_V2',
        messageType: 'MDM^T02 (Document Notification)',
        status: 'delivered',
        httpStatus: 200,
        latencyMs: 188,
        payload: `MSH|^~\\&|IntakeRx|ClinicGateway|Cerner|HospitalER|${new Date(now - 1800000).toISOString()}|SEC|MDM^T02|MSG00982|P|2.5\rEVN|T02|${new Date(now - 1800000).toISOString()}\rPID|1||MRN98211^^^HOSPITAL||Brody^Marcus||19780415|M\rPV1|1|O|||||12345^Smith^John^Dr||||||||||||ADM99812\rTXA|1|CN|TX|${new Date(now - 1800000).toISOString()}||||||||DOC99812||||IntakeRx Pre-Screening Summary`,
        timestamp: new Date(now - 1800000).toISOString()
      },
      {
        id: 'tx-athena-' + (now - 600000),
        sessionId: 'sim-session-003',
        patientName: 'Sophia Lin',
        targetEhr: 'AthenaHealth',
        direction: 'inbound',
        protocol: 'FHIR_R4',
        messageType: 'Webhook: appointment.checked_in',
        status: 'delivered',
        httpStatus: 200,
        latencyMs: 96,
        payload: {
          event: 'appointment.checked_in',
          practiceId: 'ATH-771',
          patientId: 'PAT-4401',
          appointmentId: 'APT-10029',
          department: 'Cardiology Clinic',
          checkInTime: new Date(now - 600000).toISOString()
        },
        timestamp: new Date(now - 600000).toISOString()
      }
    ];
  }

  public getTransactions(): EHRTransaction[] {
    return this.transactions;
  }

  public async simulateSync(
    sessionId: string,
    targetEhr: 'Epic Systems' | 'Cerner Millennium' | 'AthenaHealth',
    protocol: 'FHIR_R4' | 'HL7_V2'
  ): Promise<EHRTransaction> {
    const sessionRes = await pool.query(
      `SELECT s.id, p.name as "patientName" 
       FROM intake_sessions s
       JOIN patients p ON s.patient_id = p.id
       WHERE s.id = $1`,
      [sessionId]
    );

    const patientName = sessionRes.rows[0]?.patientName || 'Intake Patient';
    let payload: any = null;
    let messageType = '';

    if (protocol === 'FHIR_R4') {
      try {
        payload = await generateFhirBundle(sessionId);
        messageType = `Bundle: ${payload.entry?.length || 1} FHIR Resources`;
      } catch (err) {
        payload = {
          resourceType: 'Bundle',
          type: 'collection',
          timestamp: new Date().toISOString(),
          entry: [{ resource: { resourceType: 'Patient', name: [{ text: patientName }] } }]
        };
        messageType = 'Bundle: Patient Demographic';
      }
    } else {
      const nowStr = new Date().toISOString();
      payload = `MSH|^~\\&|IntakeRx|ClinicGateway|${targetEhr.split(' ')[0]}|HospitalHIS|${nowStr}||MDM^T02|MSG-${Date.now()}|P|2.5\rPID|1||MRN-${sessionId.slice(0, 6)}||${patientName.replace(' ', '^')}||19850101|U\rTXA|1|CN|TX|${nowStr}||||||||DOC-${sessionId.slice(0, 8)}||||IntakeRx Pre-Screening Document`;
      messageType = 'MDM^T02 (Document Notification)';
    }

    const latency = Math.floor(Math.random() * 120) + 80;
    const tx: EHRTransaction = {
      id: `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      sessionId,
      patientName,
      targetEhr,
      direction: 'outbound',
      protocol,
      messageType,
      status: 'delivered',
      httpStatus: 201,
      latencyMs: latency,
      payload,
      timestamp: new Date().toISOString()
    };

    this.transactions.unshift(tx);

    // Push notification to bus
    notificationBus.push(
      'intake_completed',
      `EHR Sync Successful (${targetEhr})`,
      `Finalized pre-screening records synced via ${protocol} in ${latency}ms for ${patientName}.`,
      { sessionId, patientName, severity: 'info' }
    );

    return tx;
  }

  public simulateWebhook(
    eventType: 'bed_assigned' | 'lab_ready' | 'chart_cosigned',
    customTarget?: 'Epic Systems' | 'Cerner Millennium' | 'AthenaHealth'
  ): EHRTransaction {
    const targetEhr = customTarget || (eventType === 'bed_assigned' ? 'Epic Systems' : eventType === 'lab_ready' ? 'Cerner Millennium' : 'AthenaHealth');
    let messageType = '';
    let payload: any = {};
    const now = new Date().toISOString();

    switch (eventType) {
      case 'bed_assigned':
        messageType = 'Webhook: encounter.bed_assigned';
        payload = {
          event: 'encounter.bed_assigned',
          ehr: targetEhr,
          location: 'Acute Care Pavilion - Room 304-B',
          acuityLevel: 'High / Telemetry Monitored',
          admittingPhysician: 'Dr. John Watson, MD',
          assignedAt: now
        };
        notificationBus.push(
          'emergency_triage',
          'Hospital Bed Assigned',
          `Hospital telemetry bed confirmed: Room 304-B via ${targetEhr} gateway.`,
          { severity: 'warning' }
        );
        break;

      case 'lab_ready':
        messageType = 'Webhook: diagnostic_report.troponin_ready';
        payload = {
          event: 'diagnostic_report.troponin_ready',
          ehr: targetEhr,
          testName: 'STAT High-Sensitivity Troponin I',
          result: '0.04 ng/mL',
          referenceRange: '< 0.03 ng/mL',
          status: 'ELEVATED - ALERT',
          reportedAt: now
        };
        notificationBus.push(
          'emergency_triage',
          'STAT Lab Result Available',
          `STAT High-Sensitivity Troponin I reported: 0.04 ng/mL (ELEVATED) via ${targetEhr}.`,
          { severity: 'critical' }
        );
        break;

      case 'chart_cosigned':
        messageType = 'Webhook: document.cosigned';
        payload = {
          event: 'document.cosigned',
          ehr: targetEhr,
          documentTitle: 'IntakeRx AI Pre-Screening SOAP Note',
          cosigningAttending: 'Dr. Sarah Smith, MD (Chief of Medicine)',
          digitalSignatureVerification: 'VERIFIED_CRYPTOGRAPHIC_RSA256',
          signedAt: now
        };
        notificationBus.push(
          'intake_completed',
          'Chart Co-Signed by Attending',
          `SOAP note co-signed by Dr. Sarah Smith via ${targetEhr}.`,
          { severity: 'info' }
        );
        break;
    }

    const tx: EHRTransaction = {
      id: `tx-inbound-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      patientName: 'Hospital Integration Hook',
      targetEhr,
      direction: 'inbound',
      protocol: 'FHIR_R4',
      messageType,
      status: 'delivered',
      httpStatus: 200,
      latencyMs: Math.floor(Math.random() * 80) + 40,
      payload,
      timestamp: now
    };

    this.transactions.unshift(tx);
    return tx;
  }
}

export const ehrSandboxService = new EHRSandboxService();
