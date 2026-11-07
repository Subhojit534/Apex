import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { healthRouter } from './routes/health';
import { createIncidentsRouter } from './routes/incidents';
import { createLogsRouter } from './routes/logs';
import { ApexWebSocketManager } from './websocket';

dotenv.config();

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// WebSocket Manager
export const wsManager = new ApexWebSocketManager(server);

// REST Routes
app.use('/', healthRouter);
app.use('/api', healthRouter);
app.use('/api', createIncidentsRouter(wsManager));
app.use('/api', createLogsRouter(wsManager));

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`[APEX Server] Running on http://${HOST}:${PORT}`);
  console.log(`[APEX Server] WebSocket available at ws://${HOST}:${PORT}/ws`);
  console.log(`[APEX Server] Health endpoint: http://${HOST}:${PORT}/health`);
});

export { app, server };

