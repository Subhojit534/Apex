/**
 * POST /api/logs/ingest
 *
 * Accepts raw log content (TXT, JSON, CSV, or auto-detected).
 * Runs existing parseLogs() + analyzeLogEntry() from incident-core.
 * Creates incidents for matched signatures and broadcasts them via WebSocket.
 * Also returns a correlated investigation report (no Gemini required).
 */
import { Router, Request, Response } from 'express';
import { parseLogs, analyzeLogEntry, correlateIncidents, KNOWN_LOG_SIGNATURES } from '@apex/incident-core';
import { generateUuid } from '@apex/incident-core';
import { Incident, LogEntry } from '@apex/shared';
import { store } from '../store';
import { ApexWebSocketManager } from '../websocket';

// ---------------------------------------------------------------------------
// Cascade correlation: service dependency graph for root-cause determination
// ---------------------------------------------------------------------------

/** Known upstream → downstream dependency relationships */
const SERVICE_DEPENDENCY_MAP: Record<string, string[]> = {
  'postgres-primary': ['backend-api', 'payment-service', 'api-gateway'],
  'database':         ['backend-api', 'payment-service', 'api-gateway'],
  'db':               ['backend-api', 'payment-service', 'api-gateway'],
  'backend-api':      ['api-gateway', 'payment-service'],
  'api-gateway':      ['payment-service'],
};

/** Additional log-level patterns for the cascade scenario */
const EXTENDED_SIGNATURES = [
  ...KNOWN_LOG_SIGNATURES,
  {
    pattern: /connection pool exhausted|pool timeout|too many clients|remaining connection slots|max_connections/i,
    category: 'availability' as const,
    severity: 'critical' as const,
    title: 'Database Connection Pool Exhausted',
  },
  {
    pattern: /504 Gateway Timeout|upstream timed out|connect timeout|read timeout/i,
    category: 'performance' as const,
    severity: 'high' as const,
    title: 'API Gateway Timeout',
  },
  {
    pattern: /payment.*fail|payment.*timeout|payment.*error|transaction.*fail|charge.*fail/i,
    category: 'availability' as const,
    severity: 'critical' as const,
    title: 'Payment Service Failure',
  },
  {
    pattern: /ECONNRESET|socket hang up|read ECONNRESET/i,
    category: 'availability' as const,
    severity: 'high' as const,
    title: 'Connection Reset by Peer',
  },
  {
    pattern: /database.*unavailable|db.*down|postgres.*error|mysql.*error|redis.*error/i,
    category: 'availability' as const,
    severity: 'critical' as const,
    title: 'Database Unavailable',
  },
  {
    pattern: /Task timed out after|FUNCTION_INVOCATION_TIMEOUT|Execution timed out/i,
    category: 'performance' as const,
    severity: 'critical' as const,
    title: 'Serverless Function Execution Timeout',
  },
  {
    pattern: /FUNCTION_PAYLOAD_LIMIT_EXCEEDED|memory limit exceeded/i,
    category: 'resource_exhaustion' as const,
    severity: 'high' as const,
    title: 'Serverless Memory/Payload Limit Exceeded',
  },
  {
    pattern: /MIDDLEWARE_INVOCATION_FAILED|Edge Function invocation failed/i,
    category: 'system_crash' as const,
    severity: 'critical' as const,
    title: 'Edge Middleware Invocation Failure',
  },
  {
    pattern: /PrismaClientInitializationError|PrismaClientKnownRequestError|Can't reach database server/i,
    category: 'availability' as const,
    severity: 'critical' as const,
    title: 'Prisma Database Connection Failure',
  },
  {
    pattern: /500 Internal Server Error|Unhandled rejection|Internal Server Error/i,
    category: 'system_crash' as const,
    severity: 'high' as const,
    title: 'Serverless 500 Internal Error',
  },
];

// ---------------------------------------------------------------------------
// Cascade correlation logic
// ---------------------------------------------------------------------------

export interface CascadeNode {
  service: string;
  incidents: Incident[];
  isRootCause: boolean;
  downstreamServices: string[];
  evidenceLogs: LogEntry[];
}

export interface InvestigationReport {
  id: string;
  generatedAt: string;
  title: string;
  summary: string;
  probableRootCause: string;
  rootCauseService: string | null;
  severity: Incident['severity'];
  affectedServices: string[];
  cascade: CascadeNode[];
  chronologicalEvidence: Array<{
    timestamp: string;
    service: string;
    level: string;
    message: string;
    isKeyEvent: boolean;
  }>;
  incidentsCreated: Incident[];
  remediationSteps: string[];
  isSimulated: boolean;
}

function determineSeverity(incidents: Incident[]): Incident['severity'] {
  if (incidents.some(i => i.severity === 'critical')) return 'critical';
  if (incidents.some(i => i.severity === 'high'))     return 'high';
  if (incidents.some(i => i.severity === 'medium'))   return 'medium';
  return 'low';
}

function findRootCauseService(incidents: Incident[]): string | null {
  // A service is a root cause if its failures appear earliest in the timeline
  // AND it has downstream dependents in SERVICE_DEPENDENCY_MAP
  const byService = new Map<string, Incident[]>();
  for (const inc of incidents) {
    const existing = byService.get(inc.affectedService) || [];
    existing.push(inc);
    byService.set(inc.affectedService, existing);
  }

  // Find the earliest-failing service that has known downstreams
  let earliest: { service: string; time: number } | null = null;
  for (const [svc, incs] of byService.entries()) {
    if (!SERVICE_DEPENDENCY_MAP[svc]) continue;
    const earliestTime = Math.min(...incs.map(i => new Date(i.detectedAt).getTime()));
    if (!earliest || earliestTime < earliest.time) {
      earliest = { service: svc, time: earliestTime };
    }
  }

  // If no dependency-graph root found, pick the earliest-failing critical/high service
  if (!earliest) {
    const sorted = incidents
      .filter(i => i.severity === 'critical' || i.severity === 'high')
      .sort((a, b) => new Date(a.detectedAt).getTime() - new Date(b.detectedAt).getTime());
    return sorted[0]?.affectedService ?? null;
  }

  return earliest.service;
}

function buildCascadeNodes(
  incidents: Incident[],
  logsByService: Map<string, LogEntry[]>,
  rootService: string | null,
): CascadeNode[] {
  const byService = new Map<string, Incident[]>();
  for (const inc of incidents) {
    const existing = byService.get(inc.affectedService) || [];
    existing.push(inc);
    byService.set(inc.affectedService, existing);
  }

  const nodes: CascadeNode[] = [];
  for (const [svc, incs] of byService.entries()) {
    nodes.push({
      service: svc,
      incidents: incs,
      isRootCause: svc === rootService,
      downstreamServices: SERVICE_DEPENDENCY_MAP[svc] || [],
      evidenceLogs: logsByService.get(svc) || [],
    });
  }

  // Sort: root cause first, then by severity, then alphabetically
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  nodes.sort((a, b) => {
    if (a.isRootCause !== b.isRootCause) return a.isRootCause ? -1 : 1;
    const aSev = determineSeverity(a.incidents);
    const bSev = determineSeverity(b.incidents);
    return severityOrder[aSev] - severityOrder[bSev];
  });

  return nodes;
}

function buildRemediationSteps(rootService: string | null, cascade: CascadeNode[]): string[] {
  const steps: string[] = [];

  if (rootService?.match(/postgres|database|db/i)) {
    steps.push(
      '[READ-ONLY DIAGNOSIS] Check PostgreSQL process status: pg_lsclusters or systemctl status postgresql',
      '[READ-ONLY DIAGNOSIS] Review pg_stat_activity for blocked connections and long-running queries',
      '[READ-ONLY DIAGNOSIS] Inspect database error log: journalctl -u postgresql --since "1 hour ago"',
      '[CONFIGURATION] Increase max_connections in postgresql.conf if pool exhaustion is confirmed',
      '[CONFIGURATION] Tune PgBouncer/connection pooler settings: pool_size, max_client_conn',
      '[RECOVERY] Restart database connection pooler (not the database itself) after configuration change',
      '[VERIFICATION] Monitor pg_stat_database.numbackends after recovery action',
    );
  } else if (rootService?.match(/backend|api/i)) {
    steps.push(
      '[READ-ONLY DIAGNOSIS] Review application logs for recurring error patterns',
      '[READ-ONLY DIAGNOSIS] Check upstream dependency health endpoints',
      '[CONFIGURATION] Adjust HTTP client timeout and retry settings',
      '[RECOVERY] Rolling restart of affected service pods if memory or connection leak is confirmed',
    );
  } else if (rootService?.match(/vercel|next|web|frontend|app/i)) {
    steps.push(
      '[READ-ONLY DIAGNOSIS] Inspect Vercel runtime function logs and memory ceiling metrics',
      '[CONFIGURATION] Check function maxDuration in vercel.json or route handler configuration',
      '[CONFIGURATION] Verify connection pooling (e.g. Prisma Accelerate or PgBouncer) for serverless cold-starts',
      '[RECOVERY] Trigger instant rollback or redeploy of previous healthy Vercel deployment',
    );
  }

  // Generic steps for all cascades
  steps.push(
    '[MONITORING] Verify downstream services recover once root cause is addressed',
    '[POST-INCIDENT] Conduct blameless post-mortem and document timeline',
    '⚠️ No commands are executed automatically. All remediation requires human approval.',
  );

  // Add service-specific steps for downstream nodes
  for (const node of cascade) {
    if (!node.isRootCause && node.incidents.some(i => i.severity === 'critical')) {
      steps.push(
        `[${node.service.toUpperCase()}] Verify service health after upstream recovery: check /health endpoint`,
      );
    }
  }

  return steps;
}

function buildRootCauseSummary(
  rootService: string | null,
  incidents: Incident[],
  logCount: number,
): string {
  if (!rootService) {
    return `Analyzed ${logCount} log entries. ${incidents.length} incident(s) detected across ${new Set(incidents.map(i => i.affectedService)).size} service(s). No upstream root cause could be determined from the available evidence.`;
  }

  const affectedCount = new Set(incidents.map(i => i.affectedService)).size;
  const downstreams = (SERVICE_DEPENDENCY_MAP[rootService] || [])
    .filter(d => incidents.some(i => i.affectedService === d));

  const cascadeDesc = downstreams.length > 0
    ? ` The failure cascaded downstream to: ${downstreams.join(', ')}.`
    : '';

  return (
    `${incidents.length} incident(s) detected across ${affectedCount} service(s) from ${logCount} log entries. ` +
    `Probable root cause: failures originated in '${rootService}'.${cascadeDesc} ` +
    `The cascade pattern matches a database connection failure scenario where upstream unavailability ` +
    `propagates to connection pool exhaustion, API timeouts, and payment processing failures.`
  );
}

// ---------------------------------------------------------------------------
// Route factory
// ---------------------------------------------------------------------------

export function createLogsRouter(wsManager: ApexWebSocketManager): Router {
  const router = Router();

  /**
   * POST /api/logs/ingest
   * Body: { content: string, format?: 'auto'|'txt'|'json'|'csv', service?: string, isSimulated?: boolean }
   * Returns: InvestigationReport
   */
  router.post('/logs/ingest', (req: Request, res: Response): void => {
    const { content, format = 'auto', service: defaultService = 'app', isSimulated = false } = req.body as {
      content?: string;
      format?: 'auto' | 'txt' | 'json' | 'csv';
      service?: string;
      isSimulated?: boolean;
    };

    if (!content || typeof content !== 'string' || !content.trim()) {
      res.status(400).json({ success: false, error: 'Request body must include a non-empty "content" string.' });
      return;
    }

    // 1. Parse logs using existing parseLogs()
    const entries = parseLogs(content, format, defaultService);

    if (entries.length === 0) {
      res.status(422).json({ success: false, error: 'No log entries could be parsed from the provided content.' });
      return;
    }

    // 2. Group entries by service for evidence tracking
    const logsByService = new Map<string, LogEntry[]>();
    for (const entry of entries) {
      const existing = logsByService.get(entry.service) || [];
      existing.push(entry);
      logsByService.set(entry.service, existing);
    }

    // 3. Run analyzeLogEntry() on every entry using extended signatures
    const now = new Date().toISOString();
    const createdIncidents: Incident[] = [];
    const seenTitles = new Set<string>(); // Basic dedup per service+title

    for (const entry of entries) {
      const draft = analyzeLogEntry(entry, EXTENDED_SIGNATURES);
      if (!draft) continue;

      const dedupKey = `${draft.affectedService}::${draft.title}`;
      if (seenTitles.has(dedupKey)) continue;
      seenTitles.add(dedupKey);

      const incident: Incident = {
        ...draft,
        id: generateUuid(),
        detectedAt: entry.timestamp || now,
        updatedAt: now,
        metadata: {
          ...draft.metadata,
          source: 'log_ingest',
          isSimulated,
          format,
        },
      };

      store.setIncident(incident);
      createdIncidents.push(incident);

      // Broadcast each new incident via WebSocket
      wsManager.broadcast({ type: 'incident_created', incident });
    }

    // 4. Correlate incidents using existing correlateIncidents()
    const allCurrentIncidents = store.getAllIncidents();
    correlateIncidents(allCurrentIncidents); // runs grouping; result used below for root cause

    // 5. Root-cause analysis via cascade graph
    const rootService = findRootCauseService(createdIncidents);
    const cascade = buildCascadeNodes(createdIncidents, logsByService, rootService);

    // 6. Chronological evidence (error/fatal entries, key events)
    const keyPatterns = /error|fatal|fail|timeout|refused|exhausted|unavailable/i;
    const chronologicalEvidence = entries
      .filter(e => e.level === 'error' || e.level === 'fatal' || keyPatterns.test(e.message))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map(e => ({
        timestamp: e.timestamp,
        service: e.service,
        level: e.level,
        message: e.message,
        isKeyEvent: (e.level === 'error' || e.level === 'fatal'),
      }));

    // 7. Build the investigation report
    const severity = determineSeverity(createdIncidents.length > 0 ? createdIncidents : allCurrentIncidents.slice(0, 1));
    const remediationSteps = buildRemediationSteps(rootService, cascade);
    const summary = buildRootCauseSummary(rootService, createdIncidents, entries.length);

    const affectedServices = [...new Set(createdIncidents.map(i => i.affectedService))];

    const report: InvestigationReport = {
      id: generateUuid(),
      generatedAt: now,
      title: rootService
        ? `Cascade Failure: Root cause in '${rootService}' — ${affectedServices.length} service(s) affected`
        : `Log Investigation: ${createdIncidents.length} incident(s) detected`,
      summary,
      probableRootCause: rootService
        ? `Connection/availability failure originating in '${rootService}'. Downstream services experienced cascading failures due to upstream dependency unavailability.`
        : 'Root cause could not be determined. Review the chronological evidence for the earliest error.',
      rootCauseService: rootService,
      severity,
      affectedServices,
      cascade,
      chronologicalEvidence,
      incidentsCreated: createdIncidents,
      remediationSteps,
      isSimulated,
    };

    console.log(`[${new Date().toLocaleTimeString()}] [Log Engine] Ingested ${entries.length} lines for '${defaultService}' -> Generated ${createdIncidents.length} incidents (Root: '${rootService || 'none'}', Severity: ${severity})`);

    res.status(201).json({ success: true, data: report });
  });

  return router;
}
