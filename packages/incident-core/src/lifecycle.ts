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
  // Repeating the same status should not create unnecessary lifecycle changes
  if (incident.status === newStatus) {
    return incident;
  }

  // Validate status transition
  if (!canTransition(incident.status, newStatus)) {
    throw new Error(
      `Illegal incident status transition from '${incident.status}' to '${newStatus}' for incident ${incident.id}`
    );
  }

  // Determine resolution timestamp according to lifecycle rules
  let resolvedAt: string | undefined;

  if (newStatus === 'resolved') {
    // Resolving an incident sets resolvedAt (or preserves existing if already set)
    resolvedAt = incident.resolvedAt ?? nowIso;
  } else if (newStatus === 'closed') {
    // Closing an already resolved incident preserves its original resolution timestamp;
    // Closing an unresolved incident preserves undefined without incorrectly marking as resolved
    resolvedAt = incident.resolvedAt;
  } else {
    // Reopening a resolved or closed incident clears the previous resolution timestamp
    resolvedAt = undefined;
  }

  return {
    ...incident,
    status: newStatus,
    updatedAt: nowIso,
    resolvedAt
  };
}
