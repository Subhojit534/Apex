import { z } from 'zod';

export const IncidentSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export type IncidentSeverity = z.infer<typeof IncidentSeveritySchema>;

export const IncidentStatusSchema = z.enum([
  'detected',
  'investigating',
  'mitigating',
  'resolved',
  'closed'
]);
export type IncidentStatus = z.infer<typeof IncidentStatusSchema>;

export const IncidentCategorySchema = z.enum([
  'performance',
  'availability',
  'error_rate',
  'resource_exhaustion',
  'security_anomaly',
  'system_crash'
]);
export type IncidentCategory = z.infer<typeof IncidentCategorySchema>;

export const RemediationActionSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string(),
  isSafeToAutomate: z.boolean().default(false),
  estimatedRisk: z.enum(['low', 'medium', 'high']),
  recommendedCommandOrStep: z.string().optional()
});
export type RemediationAction = z.infer<typeof RemediationActionSchema>;

export const IncidentSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(3),
  description: z.string(),
  severity: IncidentSeveritySchema,
  status: IncidentStatusSchema,
  category: IncidentCategorySchema,
  affectedService: z.string(),
  detectedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().optional(),
  rootCauseAnalysis: z.string().optional(),
  recommendedActions: z.array(RemediationActionSchema).default([]),
  metadata: z.record(z.string(), z.unknown()).default({})
});
export type Incident = z.infer<typeof IncidentSchema>;

export const CreateIncidentPayloadSchema = IncidentSchema.omit({
  id: true,
  detectedAt: true,
  updatedAt: true
}).extend({
  metadata: z.record(z.string(), z.unknown()).optional()
});
export type CreateIncidentPayload = z.infer<typeof CreateIncidentPayloadSchema>;

