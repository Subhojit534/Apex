import { z } from 'zod';
import { IncidentSchema, IncidentStatusSchema } from './incident';
import { TelemetryMetricSchema, LogEntrySchema } from './telemetry';
import { ProjectSchema } from './project';

export const ClientMessageTypeSchema = z.enum([
  'ping',
  'subscribe_incidents',
  'subscribe_telemetry',
  'subscribe_projects',
  'acknowledge_incident',
  'request_ai_analysis'
]);
export type ClientMessageType = z.infer<typeof ClientMessageTypeSchema>;

export const ServerMessageTypeSchema = z.enum([
  'pong',
  'connection_ack',
  'incident_created',
  'incident_updated',
  'telemetry_broadcast',
  'log_broadcast',
  'project_registered',
  'project_updated',
  'ai_analysis_result',
  'system_health'
]);
export type ServerMessageType = z.infer<typeof ServerMessageTypeSchema>;

export const WsClientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ping'),
    clientTimestamp: z.number()
  }),
  z.object({
    type: z.literal('subscribe_incidents')
  }),
  z.object({
    type: z.literal('subscribe_projects')
  }),
  z.object({
    type: z.literal('subscribe_telemetry'),
    service: z.string().optional()
  }),
  z.object({
    type: z.literal('acknowledge_incident'),
    incidentId: z.string().uuid(),
    status: IncidentStatusSchema
  }),
  z.object({
    type: z.literal('request_ai_analysis'),
    incidentId: z.string().uuid()
  })
]);
export type WsClientMessage = z.infer<typeof WsClientMessageSchema>;

export const WsServerMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('pong'),
    clientTimestamp: z.number(),
    serverTimestamp: z.number()
  }),
  z.object({
    type: z.literal('connection_ack'),
    clientId: z.string(),
    serverVersion: z.string(),
    connectedClients: z.number()
  }),
  z.object({
    type: z.literal('incident_created'),
    incident: IncidentSchema
  }),
  z.object({
    type: z.literal('incident_updated'),
    incident: IncidentSchema
  }),
  z.object({
    type: z.literal('project_registered'),
    project: ProjectSchema
  }),
  z.object({
    type: z.literal('project_updated'),
    project: ProjectSchema
  }),
  z.object({
    type: z.literal('telemetry_broadcast'),
    metric: TelemetryMetricSchema
  }),
  z.object({
    type: z.literal('log_broadcast'),
    log: LogEntrySchema
  }),
  z.object({
    type: z.literal('ai_analysis_result'),
    incidentId: z.string().uuid(),
    analysis: z.string(),
    suggestedRootCause: z.string(),
    recommendedMitigations: z.array(z.string())
  }),
  z.object({
    type: z.literal('system_health'),
    status: z.enum(['ok', 'degraded', 'error']),
    uptimeSeconds: z.number(),
    activeIncidentsCount: z.number()
  })
]);
export type WsServerMessage = z.infer<typeof WsServerMessageSchema>;
