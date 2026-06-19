import { WebSocket } from 'ws';

export interface ActiveCall {
  ws: WebSocket;
  patientName: string;
  messages: any[];
}

export const activeCallSockets = new Map<string, ActiveCall>();
