import { z } from 'zod';

export const ProjectEnvironmentSchema = z.enum(['production', 'staging', 'development']);
export type ProjectEnvironment = z.infer<typeof ProjectEnvironmentSchema>;

export const ProjectHealthSchema = z.enum(['healthy', 'degraded', 'critical', 'offline']);
export type ProjectHealth = z.infer<typeof ProjectHealthSchema>;

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2),
  description: z.string().optional(),
  environment: ProjectEnvironmentSchema,
  health: ProjectHealthSchema.default('healthy'),
  repositoryPath: z.string().optional(),
  healthEndpoint: z.string().url().optional(),
  tags: z.array(z.string()).default([]),
  activeIncidentsCount: z.number().default(0),
  lastHeartbeatAt: z.string().datetime().optional(),
  createdAt: z.string().datetime()
});
export type Project = z.infer<typeof ProjectSchema>;

export const CreateProjectPayloadSchema = ProjectSchema.omit({
  id: true,
  health: true,
  activeIncidentsCount: true,
  lastHeartbeatAt: true,
  createdAt: true
});
export type CreateProjectPayload = z.infer<typeof CreateProjectPayloadSchema>;
