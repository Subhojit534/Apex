import { Incident } from '@apex/shared';

export interface IncidentCorrelationGroup {
  primaryIncidentId: string;
  affectedService: string;
  incidents: Incident[];
  highestSeverity: Incident['severity'];
}

const SEVERITY_WEIGHT: Record<Incident['severity'], number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

export function correlateIncidents(incidents: Incident[]): IncidentCorrelationGroup[] {
  const groupsByService = new Map<string, Incident[]>();

  for (const incident of incidents) {
    if (incident.status === 'resolved' || incident.status === 'closed') {
      continue;
    }
    const current = groupsByService.get(incident.affectedService) || [];
    current.push(incident);
    groupsByService.set(incident.affectedService, current);
  }

  const results: IncidentCorrelationGroup[] = [];

  for (const [service, groupIncidents] of groupsByService.entries()) {
    // Sort descending by severity then date
    const sorted = [...groupIncidents].sort((a, b) => {
      const diff = SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
      if (diff !== 0) return diff;
      return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
    });

    results.push({
      primaryIncidentId: sorted[0].id,
      affectedService: service,
      incidents: sorted,
      highestSeverity: sorted[0].severity
    });
  }

  // Rank groups by highest severity
  return results.sort((a, b) => SEVERITY_WEIGHT[b.highestSeverity] - SEVERITY_WEIGHT[a.highestSeverity]);
}

