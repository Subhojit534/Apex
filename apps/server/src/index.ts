import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { healthRouter } from './routes/health';
import { createIncidentsRouter } from './routes/incidents';
import { createLogsRouter } from './routes/logs';
import { createVercelRouter } from './routes/vercel';
import { ApexWebSocketManager } from './websocket';

dotenv.config();

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// Real-time HTTP request logger middleware
app.use((req, res, next) => {
  const start = Date.now();
  const time = new Date().toLocaleTimeString();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    // Suppress repetitive 304 cached poll logs to keep terminal clean
    if (status === 304 && req.originalUrl.startsWith('/api/incidents')) {
      return;
    }
    console.log(`[${time}] [HTTP] ${req.method.padEnd(6)} ${req.originalUrl} -> ${status} (${duration}ms)`);
  });
  next();
});

// WebSocket Manager
export const wsManager = new ApexWebSocketManager(server);

// REST Routes (mounted with and without /api prefix for dual local & Vercel serverless compatibility)
const incidentsRouter = createIncidentsRouter(wsManager);
const logsRouter = createLogsRouter(wsManager);
const vercelRouter = createVercelRouter(wsManager);

app.use('/', healthRouter);
app.use('/api', healthRouter);
app.use('/api', incidentsRouter);
app.use('/', incidentsRouter);
app.use('/api', logsRouter);
app.use('/', logsRouter);
app.use('/api/vercel', vercelRouter);
app.use('/vercel', vercelRouter);

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

if (!process.env.VERCEL) {
  server.listen(PORT, HOST, () => {
    console.log(`[APEX Server] Running on http://${HOST}:${PORT}`);
    console.log(`[APEX Server] WebSocket available at ws://${HOST}:${PORT}/ws`);
    console.log(`[APEX Server] Health endpoint: http://${HOST}:${PORT}/health`);
  });
}

export { app, server };

