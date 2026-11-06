import { TelemetryMetric, Incident, IncidentSeverity, IncidentCategory } from '@apex/shared';
import { generateUuid } from './uuid';

export interface MetricRule {
  metric: string;
  warningThreshold: number;
  criticalThreshold: number;
  category: IncidentCategory;
  titleTemplate: (service: string, value: number, unit: string) => string;
}

export const DEFAULT_RULES: MetricRule[] = [
  {
    metric: 'cpu_percent',
    warningThreshold: 80,
    criticalThreshold: 95,
    category: 'resource_exhaustion',
    titleTemplate: (svc, val, unit) => `High CPU Utilization on ${svc} (${val}${unit})`
  },
  {
    metric: 'memory_usage_mb',
    warningThreshold: 4096,
    criticalThreshold: 7168,
    category: 'resource_exhaustion',
    titleTemplate: (svc, val, unit) => `Memory usage elevated on ${svc} (${val} ${unit})`
  },
  {
    metric: 'http_error_rate_percent',
    warningThreshold: 5,
    criticalThreshold: 20,
    category: 'error_rate',
    titleTemplate: (svc, val, unit) => `HTTP Error spike on ${svc} (${val}${unit})`
  },
  {
    metric: 'api_latency_ms',
    warningThreshold: 500,
    criticalThreshold: 2000,
    category: 'performance',
    titleTemplate: (svc, val, unit) => `Elevated API response latency on ${svc} (${val}${unit})`
  }
];

export function isValidRule(rule: MetricRule): boolean {
  return (
    typeof rule === 'object' &&
    rule !== null &&
    typeof rule.metric === 'string' &&
    rule.metric.trim().length > 0 &&
    typeof rule.warningThreshold === 'number' &&
    Number.isFinite(rule.warningThreshold) &&
    rule.warningThreshold >= 0 &&
    typeof rule.criticalThreshold === 'number' &&
    Number.isFinite(rule.criticalThreshold) &&
    rule.criticalThreshold >= rule.warningThreshold &&
    typeof rule.titleTemplate === 'function'
  );
}

export function evaluateMetric(
  metric: TelemetryMetric,
  rules: MetricRule[] = DEFAULT_RULES
): Omit<Incident, 'id' | 'detectedAt' | 'updatedAt'> | null {
  // Reject missing or malformed metric object
  if (!metric || typeof metric !== 'object') {
    return null;
  }

  // Reject invalid, non-finite, or negative metric values
  if (typeof metric.value !== 'number' || !Number.isFinite(metric.value) || metric.value < 0) {
    return null;
  }

  // Ensure service is a valid string
  if (!metric.service || typeof metric.service !== 'string' || metric.service.trim().length === 0) {
    return null;
  }

  // Find matching rule
  const rule = rules.find((r) => r.metric === metric.metric);
  if (!rule) {
    return null;
  }

  // Validate threshold rule configuration
  if (!isValidRule(rule)) {
    return null;
  }

  // Deterministic severity evaluation
  let severity: IncidentSeverity | null = null;
  if (metric.value >= rule.criticalThreshold) {
    severity = 'critical';
  } else if (metric.value >= rule.warningThreshold) {
    severity = 'medium';
  }

  if (!severity) {
    return null;
  }

  return {
    title: rule.titleTemplate(metric.service, metric.value, metric.unit),
    description: `Service '${metric.service}' recorded ${metric.metric} = ${metric.value}${metric.unit}, exceeding threshold (${severity === 'critical' ? rule.criticalThreshold : rule.warningThreshold}${metric.unit}).`,
    severity,
    status: 'detected',
    category: rule.category,
    affectedService: metric.service,
    recommendedActions: [
      {
        id: generateUuid(),
        title: `Inspect ${metric.service} telemetry and logs`,
        description: `Check recent deployments and active connections on ${metric.service}.`,
        isSafeToAutomate: false,
        estimatedRisk: 'low'
      }
    ],
    metadata: {
      observedMetric: metric.metric,
      observedValue: metric.value,
      thresholdBreached: severity === 'critical' ? rule.criticalThreshold : rule.warningThreshold,
      unit: metric.unit
    }
  };
}
