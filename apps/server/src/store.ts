import { Incident, TelemetryMetric } from '@apex/shared';

class ApexStore {
  private incidents: Map<string, Incident> = new Map();
  private telemetryHistory: TelemetryMetric[] = [];

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData() {
    const sampleIncident: Incident = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Elevated Latency on Payment Gateway',
      description: 'API p99 latency spiked past 1800ms following high checkout traffic.',
      severity: 'high',
      status: 'detected',
      category: 'performance',
      affectedService: 'payment-gateway',
      detectedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
      rootCauseAnalysis: 'Database connection pool starvation during batch settlement processing.',
      recommendedActions: [
        {
          id: 'rec-001',
          title: 'Increase connection pool ceiling',
          description: 'Scale connection pool max limit from 20 to 50.',
          isSafeToAutomate: false,
          estimatedRisk: 'low'
        },
        {
          id: 'rec-002',
          title: 'Throttle non-critical reconciliation jobs',
          description: 'Pause async reconciliation cron until checkout traffic subsides.',
          isSafeToAutomate: true,
          estimatedRisk: 'medium'
        }
      ],
      metadata: {
        latencyP99Ms: 1850,
        baselineLatencyMs: 120,
        cluster: 'us-east-prod'
      }
    };

    this.incidents.set(sampleIncident.id, sampleIncident);
  }

  public getAllIncidents(): Incident[] {
    return Array.from(this.incidents.values()).sort(
      (a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
    );
  }

  public getIncidentById(id: string): Incident | undefined {
    return this.incidents.get(id);
  }

  public setIncident(incident: Incident): void {
    this.incidents.set(incident.id, incident);
  }

  public recordTelemetry(metric: TelemetryMetric): void {
    this.telemetryHistory.push(metric);
    if (this.telemetryHistory.length > 500) {
      this.telemetryHistory.shift();
    }
  }

  public getRecentTelemetry(): TelemetryMetric[] {
    return [...this.telemetryHistory];
  }
}

export const store = new ApexStore();

