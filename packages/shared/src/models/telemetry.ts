import { z } from 'zod';

export const MetricTypeSchema = z.enum([
  'cpu_percent',
  'memory_usage_mb',
  'disk_io_wait_percent',
  'network_rx_kbps',
  'network_tx_kbps',
  'api_latency_ms',
  'http_error_rate_percent'
]);
export type MetricType = z.infer<typeof MetricTypeSchema>;

export const TelemetryMetricSchema = z.object({
  id: z.string().uuid(),
  service: z.string(),
  metric: MetricTypeSchema,
  value: z.number(),
  unit: z.string(),
  timestamp: z.string().datetime(),
  host: z.string().optional()
});
export type TelemetryMetric = z.infer<typeof TelemetryMetricSchema>;

export const LogLevelSchema = z.enum(['debug', 'info', 'warn', 'error', 'fatal']);
export type LogLevel = z.infer<typeof LogLevelSchema>;

export const LogEntrySchema = z.object({
  id: z.string().uuid(),
  service: z.string(),
  level: LogLevelSchema,
  message: z.string(),
  timestamp: z.string().datetime(),
  traceId: z.string().optional(),
  context: z.record(z.string(), z.unknown()).optional()
});
export type LogEntry = z.infer<typeof LogEntrySchema>;

export const SystemInfoSchema = z.object({
  platform: z.string(),
  arch: z.string(),
  totalMemoryMb: z.number(),
  freeMemoryMb: z.number()
});
export type SystemInfo = z.infer<typeof SystemInfoSchema>;
