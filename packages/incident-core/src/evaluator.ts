import { TelemetryMetric, Incident, IncidentSeverity, IncidentCategory } from '@apex/shared';

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

export function evaluateMetric(metric: TelemetryMetric, rules: MetricRule[] = DEFAULT_RULES): Omit<Incident, 'id' | 'detectedAt' | 'updatedAt'> | null {
  const rule = rules.find((r) => r.metric === metric.metric);
  if (!rule) return null;

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
        id: 'rec-' + Math.random().toString(36).substring(2, 9),
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

