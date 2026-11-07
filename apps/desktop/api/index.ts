import express from 'express';
import cors from 'cors';
import { Incident } from '@apex/shared';

const app = express();
app.use(cors());
app.use(express.json());

const startTime = Date.now();

// Initial sample incident state
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
      id: 'a1b2c3d4-e5f6-4789-abcd-ef0123456789',
      title: 'Increase connection pool ceiling',
      description: 'Scale connection pool max limit from 20 to 50.',
      isSafeToAutomate: false,
      estimatedRisk: 'low'
    },
    {
      id: 'b2c3d4e5-f6a7-4890-bcde-f01234567890',
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

const incidentsMap = new Map<string, Incident>([[sampleIncident.id, sampleIncident]]);

// In-memory token store for Vercel integration
let runtimeVercelToken: string | null = process.env.VERCEL_TOKEN || null;
let runtimeVercelTeamId: string | null = process.env.VERCEL_TEAM_ID || null;

function getVercelToken(req: any): string | null {
  const headerToken = req.headers['x-vercel-token'] as string | undefined;
  const queryToken = req.query?.token as string | undefined;
  return headerToken || queryToken || runtimeVercelToken || process.env.VERCEL_TOKEN || null;
}

function getVercelTeamId(req: any): string | null {
  const headerTeam = req.headers['x-vercel-team-id'] as string | undefined;
  const queryTeam = req.query?.teamId as string | undefined;
  return headerTeam || queryTeam || runtimeVercelTeamId || process.env.VERCEL_TEAM_ID || null;
}

async function vercelFetch<T>(path: string, options: { token: string; teamId?: string | null; method?: string; body?: unknown }): Promise<T> {
  const url = new URL(`https://api.vercel.com${path}`);
  if (options.teamId) {
    url.searchParams.set('teamId', options.teamId);
  }

  const response = await fetch(url.toString(), {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${options.token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'APEX-Operations-Platform/0.1.0'
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    let parsedMessage = errorBody;
    try {
      const parsed = JSON.parse(errorBody);
      parsedMessage = parsed.error?.message || parsed.message || errorBody;
    } catch {
      // ignore json parse error
    }
    throw new Error(`Vercel API error (${response.status}): ${parsedMessage || response.statusText}`);
  }

  return response.json() as Promise<T>;
}

// Router helper to mount routes at both / and /api
const router = express.Router();

// Health check
router.get('/health', (_req: any, res: any) => {
  const activeIncidents = Array.from(incidentsMap.values()).filter(
    (i) => i.status !== 'resolved' && i.status !== 'closed'
  );
  res.json({
    status: 'ok',
    service: 'apex-serverless',
    version: '0.1.0-phase0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    activeIncidentsCount: activeIncidents.length,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here')
  });
});

// Incidents List
router.get('/incidents', (_req: any, res: any) => {
  const list = Array.from(incidentsMap.values()).sort(
    (a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
  );
  res.json({ success: true, data: list });
});

// Single Incident
router.get('/incidents/:id', (req: any, res: any): void => {
  const incident = incidentsMap.get(req.params.id);
  if (!incident) {
    res.status(404).json({ success: false, error: 'Incident not found' });
    return;
  }
  res.json({ success: true, data: incident });
});

// Acknowledge Incident
router.post('/incidents/:id/acknowledge', (req: any, res: any): void => {
  const incident = incidentsMap.get(req.params.id);
  if (!incident) {
    res.status(404).json({ success: false, error: 'Incident not found' });
    return;
  }
  incident.status = 'investigating';
  incident.updatedAt = new Date().toISOString();
  incidentsMap.set(incident.id, incident);
  res.json({ success: true, data: incident });
});

// Resolve Incident
router.post('/incidents/:id/resolve', (req: any, res: any): void => {
  const incident = incidentsMap.get(req.params.id);
  if (!incident) {
    res.status(404).json({ success: false, error: 'Incident not found' });
    return;
  }
  incident.status = 'resolved';
  incident.resolvedAt = new Date().toISOString();
  incident.updatedAt = new Date().toISOString();
  incidentsMap.set(incident.id, incident);
  res.json({ success: true, data: incident });
});

// AI Analyze Incident
router.post('/incidents/:id/analyze', (req: any, res: any): void => {
  const incident = incidentsMap.get(req.params.id);
  if (!incident) {
    res.status(404).json({ success: false, error: 'Incident not found' });
    return;
  }

  const diagnosis = {
    incidentId: incident.id,
    analysis: `Root-cause analysis: Incident '${incident.title}' breached latency & error thresholds on service '${incident.affectedService}'.`,
    suggestedRootCause: `Database connection pool exhaustion and transaction lock contention on '${incident.affectedService}'.`,
    recommendedMitigations: [
      `Increase max connection pool limit on ${incident.affectedService} cluster`,
      'Scale worker replicas to absorb peak checkout traffic',
      'Throttle asynchronous reconciliation cron tasks during high demand'
    ],
    poweredByGemini: false
  };

  incident.rootCauseAnalysis = diagnosis.suggestedRootCause;
  incident.updatedAt = new Date().toISOString();
  incidentsMap.set(incident.id, incident);

  res.json({ success: true, data: diagnosis });
});

// Sync Vercel Token
router.post('/vercel/token', (req: any, res: any) => {
  const { token, teamId } = req.body;
  if (typeof token === 'string' && token.trim()) {
    runtimeVercelToken = token.trim();
  }
  if (typeof teamId === 'string') {
    runtimeVercelTeamId = teamId.trim() || null;
  }
  res.json({ success: true, message: 'Vercel token synced successfully in memory.' });
});

// Vercel Projects
router.get('/vercel/projects', async (req: any, res: any): Promise<void> => {
  const token = getVercelToken(req);
  const teamId = getVercelTeamId(req);

  if (!token) {
    res.status(401).json({ success: false, error: 'Vercel token not configured.' });
    return;
  }

  try {
    const data = await vercelFetch<{ projects: any[] }>('/v9/projects?limit=20', { token, teamId });
    const projects = (data.projects || []).map((p) => ({
      id: p.id,
      name: p.name,
      framework: p.framework,
      updatedAt: p.updatedAt,
      createdAt: p.createdAt,
      productionUrl: p.targets?.production?.url ? `https://${p.targets.production.url}` : undefined
    }));
    res.json({ success: true, count: projects.length, projects });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: msg });
  }
});

// Vercel Deployments
router.get('/vercel/projects/:projectId/deployments', async (req: any, res: any): Promise<void> => {
  const token = getVercelToken(req);
  const teamId = getVercelTeamId(req);
  const projectId = req.params.projectId;

  if (!token) {
    res.status(401).json({ success: false, error: 'Vercel token not configured.' });
    return;
  }

  try {
    const data = await vercelFetch<{ deployments: any[] }>(
      `/v6/deployments?projectId=${encodeURIComponent(projectId)}&limit=10`,
      { token, teamId }
    );
    const deployments = (data.deployments || []).map((d) => ({
      id: d.uid || d.id,
      name: d.name,
      url: d.url ? `https://${d.url}` : '',
      readyState: d.readyState || d.state || 'READY',
      createdAt: d.created || d.createdAt,
      meta: {
        commitMessage: d.meta?.githubCommitMessage || d.meta?.commitMessage || '',
        commitAuthor: d.meta?.githubCommitAuthorName || ''
      }
    }));
    res.json({ success: true, count: deployments.length, deployments });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: msg });
  }
});

// Vercel Logs
router.get('/vercel/projects/:projectId/logs', async (req: any, res: any): Promise<void> => {
  const token = getVercelToken(req);
  const teamId = getVercelTeamId(req);
  const projectId = req.params.projectId;
  let deploymentId = req.query.deploymentId as string | undefined;

  if (!token) {
    res.status(401).json({ success: false, error: 'Vercel token not configured.' });
    return;
  }

  try {
    if (!deploymentId) {
      const depData = await vercelFetch<{ deployments: any[] }>(
        `/v6/deployments?projectId=${encodeURIComponent(projectId)}&limit=1`,
        { token, teamId }
      );
      if (depData.deployments && depData.deployments.length > 0) {
        deploymentId = depData.deployments[0].uid || depData.deployments[0].id;
      }
    }

    if (!deploymentId) {
      res.json({ success: true, projectName: projectId, deploymentId: null, rawLogs: '', errorCount: 0, warnCount: 0 });
      return;
    }

    const events = await vercelFetch<any[]>(`/v2/deployments/${encodeURIComponent(deploymentId)}/events`, { token, teamId });
    const lines = (Array.isArray(events) ? events : []).map((e) => {
      const text = e.text || e.payload?.text || JSON.stringify(e);
      return `[${new Date(e.created || e.date || Date.now()).toISOString()}] ${text}`;
    });

    const errorCount = lines.filter((l) => /error|failed|exception/i.test(l)).length;
    const warnCount = lines.filter((l) => /warn/i.test(l)).length;

    res.json({
      success: true,
      projectName: projectId,
      deploymentId,
      rawLogs: lines.join('\n'),
      errorCount,
      warnCount
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: msg });
  }
});

// Vercel Simulated Sample Logs
router.get('/vercel/projects/:projectId/sample-logs', (req: any, res: any): void => {
  const projectId = req.params.projectId;
  const projectName = (req.query.projectName as string) || projectId;
  const now = new Date();
  const t = (offsetSec: number) => new Date(now.getTime() - (60 - offsetSec) * 1000).toISOString();

  const simulatedLogs = [
    `${t(0)} [INFO] [${projectName}] Serverless function runtime cold-start initiated in iad1 region`,
    `${t(5)} [INFO] [${projectName}] GET /api/v1/checkout - incoming request from edge proxy`,
    `${t(12)} [WARN] [${projectName}] PrismaClient: connection attempt took 2450ms (warning threshold 1000ms)`,
    `${t(18)} [ERROR] [${projectName}] PrismaClientInitializationError: Can't reach database server at 'postgres-primary.internal:5432'`,
    `${t(24)} [ERROR] [${projectName}] connection pool exhausted — 100/100 pooled connections active`,
    `${t(31)} [ERROR] [${projectName}] Task timed out after 10.01 seconds (FUNCTION_INVOCATION_TIMEOUT)`,
    `${t(33)} [ERROR] [${projectName}] 504 Gateway Timeout: Edge router aborted upstream serverless invocation`,
    `${t(40)} [ERROR] [${projectName}] UnhandledPromiseRejection: Database connection lost during transaction commit`,
    `${t(45)} [ERROR] [${projectName}] 500 Internal Server Error returned to client for /api/v1/checkout`
  ].join('\n');

  res.json({
    success: true,
    projectName,
    isSimulated: true,
    rawLogs: simulatedLogs
  });
});

// Mount router on both '/' and '/api'
app.use('/api', router);
app.use('/', router);

// Export serverless handler compatible with both CommonJS and ESM
export default function handler(req: any, res: any) {
  return app(req, res);
}

// Dual export for Vercel Node runtime
if (typeof module !== 'undefined' && module.exports) {
  module.exports = handler;
  module.exports.default = handler;
}

