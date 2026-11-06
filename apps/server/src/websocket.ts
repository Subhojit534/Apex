import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { WsClientMessageSchema, WsServerMessage, Incident } from '@apex/shared';
import { store } from './store';
import { analyzeIncident } from './gemini';
import { transitionIncident } from '@apex/incident-core';

export class ApexWebSocketManager {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();
  private startTime = Date.now();

  constructor(server: HttpServer) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.setupListeners();
  }

  private setupListeners() {
    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);

      // Send connection acknowledgement
      const ackMsg: WsServerMessage = {
        type: 'connection_ack',
        clientId: 'client-' + Math.random().toString(36).substring(2, 9),
        serverVersion: '0.1.0-phase0',
        connectedClients: this.clients.size
      };
      this.send(ws, ackMsg);

      // Send initial health status
      this.sendSystemHealth(ws);

      ws.on('message', async (data: string | Buffer) => {
        try {
          const raw = JSON.parse(data.toString());
          const parseResult = WsClientMessageSchema.safeParse(raw);
          if (!parseResult.success) {
            console.warn('[WS] Invalid client message:', parseResult.error.format());
            return;
          }

          const msg = parseResult.data;

          switch (msg.type) {
            case 'ping':
              this.send(ws, {
                type: 'pong',
                clientTimestamp: msg.clientTimestamp,
                serverTimestamp: Date.now()
              });
              break;

            case 'subscribe_incidents':
              // Deliver all existing incidents to subscriber
              for (const incident of store.getAllIncidents()) {
                this.send(ws, {
                  type: 'incident_created',
                  incident
                });
              }
              break;

            case 'acknowledge_incident': {
              const target = store.getIncidentById(msg.incidentId);
              if (target) {
                const updated = transitionIncident(target, msg.status);
                store.setIncident(updated);
                this.broadcast({
                  type: 'incident_updated',
                  incident: updated
                });
              }
              break;
            }

            case 'request_ai_analysis': {
              const target = store.getIncidentById(msg.incidentId);
              if (target) {
                const diagnosis = await analyzeIncident(target);
                // Also update incident with the root cause
                const updated: Incident = {
                  ...target,
                  rootCauseAnalysis: diagnosis.suggestedRootCause,
                  updatedAt: new Date().toISOString()
                };
                store.setIncident(updated);

                this.broadcast({
                  type: 'ai_analysis_result',
                  incidentId: target.id,
                  analysis: diagnosis.analysis,
                  suggestedRootCause: diagnosis.suggestedRootCause,
                  recommendedMitigations: diagnosis.recommendedMitigations
                });

                this.broadcast({
                  type: 'incident_updated',
                  incident: updated
                });
              }
              break;
            }
          }
        } catch (err) {
          console.error('[WS] Error processing message:', err);
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', (err) => {
        console.error('[WS] Client socket error:', err);
        this.clients.delete(ws);
      });
    });
  }

  public send(ws: WebSocket, message: WsServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  public broadcast(message: WsServerMessage): void {
    const payload = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  public sendSystemHealth(target?: WebSocket): void {
    const activeCount = store.getAllIncidents().filter(i => i.status !== 'resolved' && i.status !== 'closed').length;
    const msg: WsServerMessage = {
      type: 'system_health',
      status: activeCount > 2 ? 'degraded' : 'ok',
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      activeIncidentsCount: activeCount
    };

    if (target) {
      this.send(target, msg);
    } else {
      this.broadcast(msg);
    }
  }

  public getConnectedClientsCount(): number {
    return this.clients.size;
  }
}

