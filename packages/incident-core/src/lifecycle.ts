import { Incident, IncidentStatus } from '@apex/shared';

const VALID_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  detected: ['investigating', 'mitigating', 'resolved', 'closed'],
  investigating: ['mitigating', 'resolved', 'closed'],
  mitigating: ['investigating', 'resolved', 'closed'],
  resolved: ['investigating', 'closed'],
  closed: ['investigating'] // allow reopen
};

export function canTransition(current: IncidentStatus, target: IncidentStatus): boolean {
  if (current === target) return true;
  return VALID_TRANSITIONS[current]?.includes(target) ?? false;
}

export function transitionIncident(
  incident: Incident,
  newStatus: IncidentStatus,
  nowIso = new Date().toISOString()
): Incident {
  if (!canTransition(incident.status, newStatus)) {
    throw new Error(
      `Illegal incident status transition from '${incident.status}' to '${newStatus}' for incident ${incident.id}`
    );
  }

  return {
    ...incident,
    status: newStatus,
    updatedAt: nowIso,
    resolvedAt: newStatus === 'resolved' || newStatus === 'closed' ? nowIso : incident.resolvedAt
  };
}

