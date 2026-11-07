/**
 * APEX Platform Terminal Status & Live Monitor
 * Run via: node scripts/status.js or pnpm run status
 */

const os = require('os');

const SERVER_URL = process.env.VITE_SERVER_URL || 'http://localhost:3001';
const DESKTOP_URL = 'http://localhost:5173';
const MOBILE_URL = 'http://localhost:5174';

function getLanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const MAGENTA = '\x1b[35m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

async function checkUrl(url, timeoutMs = 2000) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

async function getJson(endpoint) {
  try {
    const res = await fetch(`${SERVER_URL}${endpoint}`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log(`${BOLD}${MAGENTA}  APEX NOVA — Backend Services & Operations Terminal Status${RESET}`);
  console.log('='.repeat(70) + '\n');

  // 1. Service Health Checks
  console.log(`${BOLD}1. ACTIVE RUNNING SERVICES${RESET}`);
  const [serverCheck, desktopCheck, mobileCheck] = await Promise.all([
    checkUrl(`${SERVER_URL}/health`),
    checkUrl(DESKTOP_URL),
    checkUrl(MOBILE_URL),
  ]);

  const printService = (name, url, check) => {
    const status = check.ok
      ? `${GREEN}● ONLINE${RESET} (HTTP ${check.status})`
      : `${RED}○ OFFLINE${RESET}`;
    console.log(`  - ${name.padEnd(26)} ${url.padEnd(28)} ${status}`);
  };

  printService('APEX Backend Server', SERVER_URL, serverCheck);
  printService('Desktop Assistant (NOVA)', DESKTOP_URL, desktopCheck);
  printService('Mobile PWA Interface', MOBILE_URL, mobileCheck);

  if (!serverCheck.ok) {
    console.log(`\n${RED}Backend server is currently unreachable at ${SERVER_URL}.${RESET}`);
    console.log(`Start it using: ${CYAN}pnpm run dev:server${RESET}\n`);
    return;
  }

  // 2. Health & Telemetry Metrics
  const health = await getJson('/health');
  if (health) {
    console.log(`\n${BOLD}2. SYSTEM HEALTH & TELEMETRY${RESET}`);
    console.log(`  - Service Name:        ${CYAN}${health.service || 'apex-server'}${RESET}`);
    console.log(`  - Version:             ${health.version || '0.1.0'}`);
    console.log(`  - Server Uptime:       ${GREEN}${health.uptimeSeconds}s${RESET}`);
    console.log(`  - Active Incidents:    ${health.activeIncidentsCount > 0 ? YELLOW + health.activeIncidentsCount : GREEN + '0'}${RESET}`);
    console.log(`  - Gemini AI Ready:     ${health.geminiConfigured ? GREEN + 'Configured' : YELLOW + 'Heuristic Fallback Mode'}${RESET}`);
  }

  // 3. Vercel Live Connection
  const vercel = await getJson('/api/vercel/status');
  console.log(`\n${BOLD}3. VERCEL INTEGRATION STATUS${RESET}`);
  if (vercel && vercel.configured && vercel.valid && vercel.user) {
    console.log(`  - Vercel Status:       ${GREEN}● CONNECTED${RESET}`);
    console.log(`  - User:                ${vercel.user.username} (${vercel.user.email})`);
    if (vercel.teamId) {
      console.log(`  - Team ID:             ${vercel.teamId}`);
    }
  } else {
    console.log(`  - Vercel Status:       ${YELLOW}○ Not Connected (Ready for Token in UI)${RESET}`);
    console.log(`  - Token Link:          https://vercel.com/account/tokens`);
  }

  // 4. Live Incidents List
  const incidentsData = await getJson('/api/incidents');
  const incidents = incidentsData?.data || [];
  console.log(`\n${BOLD}4. CURRENT INCIDENTS IN LOG INVESTIGATION (${incidents.length} registered)${RESET}`);

  if (incidents.length === 0) {
    console.log(`  ${GREEN}✓ No active incidents detected. All monitored services healthy.${RESET}`);
  } else {
    const preview = incidents.slice(0, 6);
    preview.forEach((inc, idx) => {
      const sevColor =
        inc.severity === 'critical' ? RED : inc.severity === 'high' ? YELLOW : CYAN;
      console.log(
        `  [${idx + 1}] ${sevColor}[${inc.severity.toUpperCase()}]${RESET} ${inc.title} ` +
        `(${CYAN}${inc.affectedService}${RESET}) · ${inc.status}`
      );
    });
    if (incidents.length > 6) {
      console.log(`  ... and ${incidents.length - 6} more incident(s) in memory`);
    }
  }

  const lanIp = getLanIp();
  console.log('\n' + '='.repeat(70));
  console.log(`${BOLD}ACCESS APEX ON YOUR DEVICES:${RESET}`);
  console.log(`  - Local PC Browser:    ${CYAN}http://localhost:5173${RESET}`);
  console.log(`  - Local PC Mobile PWA: ${CYAN}http://localhost:5174${RESET}`);
  console.log(`  - ${BOLD}📱 Mobile Phone (Wi-Fi):${RESET} ${GREEN}${BOLD}http://${lanIp}:5174${RESET}`);
  console.log(`  - 💻 LAN Desktop UI:   ${CYAN}http://${lanIp}:5173${RESET}`);
  console.log(`  - ⚡ Backend Server:   ${CYAN}http://${lanIp}:3001/health${RESET}`);
  console.log('='.repeat(70) + '\n');
}

main();
