import { LogEntry, Incident, IncidentSeverity, IncidentCategory } from '@apex/shared';

export interface LogSignature {
  pattern: RegExp;
  category: IncidentCategory;
  severity: IncidentSeverity;
  title: string;
}

export const KNOWN_LOG_SIGNATURES: LogSignature[] = [
  {
    pattern: /OOMKilled|heap out of memory|JavaScript heap out of memory/i,
    category: 'resource_exhaustion',
    severity: 'critical',
    title: 'Process Out of Memory (OOM)'
  },
  {
    pattern: /Deadlock detected|Lock wait timeout exceeded/i,
    category: 'availability',
    severity: 'high',
    title: 'Database Deadlock / Lock Timeout'
  },
  {
    pattern: /ECONNREFUSED|connect ECONNREFUSED|Connection refused/i,
    category: 'availability',
    severity: 'high',
    title: 'Upstream Connection Refused'
  },
  {
    pattern: /UnhandledPromiseRejection|FATAL EXCEPTION|SIGSEGV|Segmentation fault/i,
    category: 'system_crash',
    severity: 'critical',
    title: 'Unhandled Exception / Process Crash'
  },
  {
    pattern: /Unauthorized access spike|Token authentication failure threshold exceeded/i,
    category: 'security_anomaly',
    severity: 'medium',
    title: 'Authentication Anomaly Detected'
  }
];

export function analyzeLogEntry(
  entry: LogEntry,
  signatures: LogSignature[] = KNOWN_LOG_SIGNATURES
): Omit<Incident, 'id' | 'detectedAt' | 'updatedAt'> | null {
  // Check known signatures first
  for (const sig of signatures) {
    if (sig.pattern.test(entry.message)) {
      return {
        title: `${sig.title} on ${entry.service}`,
        description: `Service '${entry.service}' logged signature match: "${entry.message}"`,
        severity: sig.severity,
        status: 'detected',
        category: sig.category,
        affectedService: entry.service,
        recommendedActions: [
          {
            id: 'rec-' + Math.random().toString(36).substring(2, 9),
            title: `Inspect log context for ${entry.service}`,
            description: `TraceId: ${entry.traceId || 'N/A'}. Log level: ${entry.level}. Check container health and core dumps.`,
            isSafeToAutomate: false,
            estimatedRisk: 'low'
          }
        ],
        metadata: {
          traceId: entry.traceId,
          matchedLog: entry.message,
          logLevel: entry.level,
          logTimestamp: entry.timestamp
        }
      };
    }
  }

  // If fatal level without specific signature
  if (entry.level === 'fatal') {
    return {
      title: `Fatal Log Event on ${entry.service}`,
      description: `Service '${entry.service}' emitted a fatal log: "${entry.message}"`,
      severity: 'critical',
      status: 'detected',
      category: 'system_crash',
      affectedService: entry.service,
      recommendedActions: [
        {
          id: 'rec-' + Math.random().toString(36).substring(2, 9),
          title: `Inspect fatal event on ${entry.service}`,
          description: `Check traceId ${entry.traceId || 'unknown'}. Restart pod if health probes fail.`,
          isSafeToAutomate: false,
          estimatedRisk: 'medium'
        }
      ],
      metadata: {
        traceId: entry.traceId,
        matchedLog: entry.message,
        logLevel: entry.level
      }
    };
  }

  return null;
}
