import { Router, Request, Response } from 'express';
import { CreateIncidentPayloadSchema, Incident } from '@apex/shared';
import { store } from '../store';
import { analyzeIncident } from '../gemini';
import { ApexWebSocketManager } from '../websocket';

export function createIncidentsRouter(wsManager: ApexWebSocketManager): Router {
  const router = Router();

  router.get('/incidents', (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: store.getAllIncidents()
    });
  });

  router.get('/incidents/:id', (req: Request, res: Response): void => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const incident = store.getIncidentById(id);
    if (!incident) {
      res.status(404).json({ success: false, error: 'Incident not found' });
      return;
    }
    res.json({ success: true, data: incident });
  });

  router.post('/incidents', (req: Request, res: Response): void => {
    const parse = CreateIncidentPayloadSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ success: false, error: parse.error.format() });
      return;
    }

    const now = new Date().toISOString();
    const newIncident: Incident = {
      ...parse.data,
      id: 'inc-' + Math.random().toString(36).substring(2, 10),
      detectedAt: now,
      updatedAt: now,
      recommendedActions: parse.data.recommendedActions || [],
      metadata: parse.data.metadata || {}
    };

    store.setIncident(newIncident);
    wsManager.broadcast({
      type: 'incident_created',
      incident: newIncident
    });

    res.status(201).json({ success: true, data: newIncident });
  });

  router.post('/incidents/:id/analyze', async (req: Request, res: Response): Promise<void> => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const target = store.getIncidentById(id);
    if (!target) {
      res.status(404).json({ success: false, error: 'Incident not found' });
      return;
    }

    const diagnosis = await analyzeIncident(target);
    const updated: Incident = {
      ...target,
      rootCauseAnalysis: diagnosis.suggestedRootCause,
      updatedAt: new Date().toISOString()
    };
    store.setIncident(updated);

    wsManager.broadcast({
      type: 'ai_analysis_result',
      incidentId: target.id,
      analysis: diagnosis.analysis,
      suggestedRootCause: diagnosis.suggestedRootCause,
      recommendedMitigations: diagnosis.recommendedMitigations
    });

    wsManager.broadcast({
      type: 'incident_updated',
      incident: updated
    });

    res.json({ success: true, data: diagnosis });
  });

  return router;
}
