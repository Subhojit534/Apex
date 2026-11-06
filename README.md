# APEX — Autonomous Platform for Engineering eXcellence

APEX is a cross-platform AI-powered IT operations and incident response platform.
Its desktop assistant, **NOVA**, monitors registered projects, analyzes system logs and telemetry, identifies incidents, investigates probable root causes using Google Gemini AI, and communicates with operators through a real-time mobile control interface.

---

## Architecture Overview

```
APEX Monorepo (pnpm workspaces)
├── apps/
│   ├── desktop/        # Electron + React + Vite desktop assistant (NOVA)
│   ├── server/         # Node.js + Express backend + WebSocket server + Gemini SDK
│   └── mobile/         # Touch-optimized React + Vite Progressive Web App (PWA)
├── packages/
│   ├── shared/         # Zod schemas, TypeScript types, and WebSocket event contracts
│   └── incident-core/  # Pure incident evaluation, threshold rules, and lifecycle logic
├── knowledge-base/     # Incident runbooks, heuristics, and topology models
└── demo/               # Simulation scenarios and test telemetry feeds
```

### Architectural Principles & Security Boundaries
1. **Core Independence**: `packages/incident-core` is strictly independent of Electron, Express, and Gemini. It handles deterministic rule evaluation, severity calculation, and status state machines.
2. **Backend-Only AI**: Gemini API calls (`@google/genai`) occur exclusively on `apps/server`. Secret API keys are never bundled or transmitted to the Electron renderer or mobile clients.
3. **Hardened Electron Security**: Electron uses `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`. The renderer only interacts through explicitly typed IPC bridges (`window.electronAPI`).
4. **No Arbitrary Shell Execution**: The system strictly monitors via standard metric/event APIs; it never exposes shell execution surfaces to clients.
5. **Least Privilege**: Monitoring operates without root or administrative privileges.
6. **Unified WebSocket Protocol**: Both desktop and mobile clients consume the identical real-time event protocol defined in `@apex/shared`.

---

## Prerequisites

- **Node.js**: `v20.x` or higher (verified on Node `v26.x`)
- **pnpm**: `v10.x` or higher

---

## Quickstart

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Configure Environment Variables
Copy the root `.env.example` template:
```bash
cp .env.example .env
```
*(Optional)* Add your Gemini API key:
```env
GEMINI_API_KEY=your_actual_gemini_api_key
```
> **Note**: If `GEMINI_API_KEY` is not provided, APEX runs in deterministic rule-based heuristic mode with graceful fallbacks.

### 3. Run Typecheck and Tests
Verify TypeScript compilation and test suites across the monorepo:
```bash
# Typecheck all packages and apps
pnpm run typecheck

# Run unit tests (incident-core via Vitest)
pnpm run test
```

### 4. Build All Packages and Applications
```bash
pnpm run build
```

---

## Development Workflow

You can run individual workspace applications concurrently:

### Run Backend Server (Express + WebSocket)
```bash
pnpm run dev:server
```
- REST API: `http://localhost:3001`
- Health check: `http://localhost:3001/health`
- WebSocket server: `ws://localhost:3001/ws`

### Run Mobile Control PWA
```bash
pnpm run dev:mobile
```
- Available at: `http://localhost:5174`

### Run Desktop Assistant (Vite Renderer)
```bash
pnpm run dev:desktop
```
- Renderer at: `http://localhost:5173`
- To launch full Electron client: `pnpm --filter @apex/desktop start`

---

## REST Endpoints (Phase 0)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | System health, uptime, active incident count, and Gemini readiness |
| `GET` | `/api/incidents` | Lists active and historical incidents |
| `GET` | `/api/incidents/:id` | Detailed incident record |
| `POST` | `/api/incidents` | Ingests a new incident (validated against Zod schema) |
| `POST` | `/api/incidents/:id/analyze` | Triggers server-side Gemini AI root-cause analysis |

---

## Real-Time WebSocket Protocol (`ws://localhost:3001/ws`)

### Client Messages (`WsClientMessage`)
- `{ "type": "ping", "clientTimestamp": number }`
- `{ "type": "subscribe_incidents" }`
- `{ "type": "acknowledge_incident", "incidentId": string, "status": "investigating" }`
- `{ "type": "request_ai_analysis", "incidentId": string }`

### Server Messages (`WsServerMessage`)
- `{ "type": "connection_ack", "clientId": string, "serverVersion": string, "connectedClients": number }`
- `{ "type": "pong", "clientTimestamp": number, "serverTimestamp": number }`
- `{ "type": "incident_created", "incident": Incident }`
- `{ "type": "incident_updated", "incident": Incident }`
- `{ "type": "ai_analysis_result", "incidentId": string, "analysis": string, "suggestedRootCause": string, "recommendedMitigations": string[] }`
- `{ "type": "system_health", "status": "ok" | "degraded" | "error", "uptimeSeconds": number, "activeIncidentsCount": number }`

---

## Phase 0 Validation Matrix

- [x] Working pnpm monorepo with workspace protocol
- [x] Electron desktop app with `contextIsolation: true`, `nodeIntegration: false`, typed preload
- [x] Mobile PWA with touch-responsive control interface
- [x] Express backend with `/health` and in-memory store
- [x] WebSocket bidirectional connection between server, desktop, and mobile
- [x] Gemini API integration with graceful fallback mode on server
- [x] Independent `incident-core` package with passing Vitest unit tests
- [x] Shared TypeScript package with Zod validation schemas
- [x] TypeScript typechecking and compilation passing across all targets with 0 errors

