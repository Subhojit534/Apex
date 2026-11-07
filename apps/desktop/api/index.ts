import type { Request, Response } from 'express';
import { app } from '../../server/src/index';

export default function handler(req: Request, res: Response) {
  try {
    return app(req, res);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Vercel Serverless Error]:', err);
    return res.status(500).json({ success: false, error: message });
  }
}
