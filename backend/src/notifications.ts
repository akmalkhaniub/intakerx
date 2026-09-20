import { EventEmitter } from 'events';

export interface ClinicianNotification {
  id: string;
  type: 'emergency_triage' | 'guardrail_deflection' | 'intake_completed' | 'session_escalated';
  title: string;
  message: string;
  sessionId?: string;
  patientName?: string;
  severity: 'critical' | 'warning' | 'info';
  timestamp: string;
}

class NotificationBus extends EventEmitter {
  private counter = 0;

  emit(event: 'notification', notification: ClinicianNotification): boolean {
    return super.emit(event, notification);
  }

  on(event: 'notification', listener: (notification: ClinicianNotification) => void): this {
    return super.on(event, listener);
  }

  push(type: ClinicianNotification['type'], title: string, message: string, opts?: Partial<ClinicianNotification>) {
    this.counter++;
    const notification: ClinicianNotification = {
      id: `notif-${Date.now()}-${this.counter}`,
      type,
      title,
      message,
      severity: opts?.severity || 'info',
      sessionId: opts?.sessionId,
      patientName: opts?.patientName,
      timestamp: new Date().toISOString()
    };
    console.log(`[Notification] ${type}: ${title}`);
    this.emit('notification', notification);
  }
}

export const notificationBus = new NotificationBus();
