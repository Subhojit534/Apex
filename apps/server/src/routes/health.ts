import { Router, Request, Response } from 'express';
import { getGeminiClient } from '../gemini';
import { store } from '../store';

export const healthRouter = Router();

const startTime = Date.now();

healthRouter.get('/health', (_req: Request, res: Response) => {
  const activeIncidents = store.getAllIncidents().filter(
    (i) => i.status !== 'resolved' && i.status !== 'closed'
  );

  res.json({
    status: 'ok',
    service: 'apex-server',
    version: '0.1.0-phase0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    activeIncidentsCount: activeIncidents.length,
    geminiConfigured: Boolean(getGeminiClient())
  });
});

