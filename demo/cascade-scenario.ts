/**
 * Database-to-Payment Outage Demonstration Script
 *
 * Simulates a cascading application outage:
 *   1. postgres-primary  — connection pool exhausted & database unavailable
 *   2. backend-api       — ECONNREFUSED & query timeout
 *   3. api-gateway       — 504 Gateway Timeout
 *   4. payment-service   — payment processing failure & circuit breaker trip
 *
 * Usage:
 *   npx tsx demo/cascade-scenario.ts [http://localhost:3001]
 */

const SERVER_URL = process.argv[2] || process.env.VITE_SERVER_URL || 'http://localhost:3001';

const SIMULATED_CASCADE_LOGS = `2026-11-07T04:00:03Z [ERROR] [postgres-primary] FATAL: connection pool exhausted — max_connections=100 reached
2026-11-07T04:00:07Z [ERROR] [postgres-primary] Database unavailable: too many clients already
2026-11-07T04:00:12Z [ERROR] [backend-api] connect ECONNREFUSED 127.0.0.1:5432 — PostgreSQL refused connection
2026-11-07T04:00:14Z [ERROR] [backend-api] connection pool exhausted — all 20 pooled connections are busy
2026-11-07T04:00:22Z [ERROR] [api-gateway] 504 Gateway Timeout — upstream backend-api failed to respond within 30s
2026-11-07T04:00:35Z [ERROR] [payment-service] Payment processing failed: upstream API gateway returned 504
2026-11-07T04:00:39Z [FATAL] [payment-service] payment timeout — circuit breaker OPEN after 5 consecutive failures
`;

async function runCascadeDemo() {
  console.log('='.repeat(70));
  console.log('APEX — Outage Cascade Scenario (Database -> API -> Payment)');
  console.log('Target Server:', SERVER_URL);
  console.log('='.repeat(70));

  try {
    // 1. Health check
    console.log('\n[1/4] Checking server health...');
    const healthRes = await fetch(`${SERVER_URL}/health`);
    if (!healthRes.ok) {
      throw new Error(`Server returned HTTP ${healthRes.status}: ${await healthRes.text()}`);
    }
    const health = await healthRes.json();
    console.log('Server health:', JSON.stringify(health));

    // 2. Ingest cascade logs
    console.log('\n[2/4] Ingesting simulated cascade logs via POST /api/logs/ingest...');
    const ingestRes = await fetch(`${SERVER_URL}/api/logs/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: SIMULATED_CASCADE_LOGS,
        format: 'txt',
        isSimulated: true
      })
    });

    if (!ingestRes.ok) {
      throw new Error(`Ingest failed with HTTP ${ingestRes.status}: ${await ingestRes.text()}`);
    }

    const report = (await ingestRes.json()).data;
    console.log('\n[3/4] Investigation Report Generated Successfully:');
    console.log('--------------------------------------------------');
    console.log(`Report Title:         ${report.title}`);
    console.log(`Probable Root Cause:  ${report.probableRootCause}`);
    console.log(`Root Cause Service:   ${report.rootCauseService}`);
    console.log(`Calculated Severity:  ${report.severity.toUpperCase()}`);
    console.log(`Affected Services:    ${report.affectedServices.join(', ')}`);
    console.log(`Incidents Created:    ${report.incidentsCreated.length}`);

    console.log('\nCascade Chain:');
    for (const node of report.cascade) {
      const marker = node.isRootCause ? '🔴 ROOT CAUSE' : '↳ CASCADE';
      const downstreams = node.downstreamServices.length ? `(downstream: ${node.downstreamServices.join(', ')})` : '';
      console.log(`  ${marker}: ${node.service} ${downstreams}`);
      for (const inc of node.incidents) {
        console.log(`     - [${inc.severity.toUpperCase()}] ${inc.title}`);
      }
    }

    console.log('\nChronological Evidence (Key Events):');
    for (const ev of report.chronologicalEvidence) {
      console.log(`  [${ev.timestamp}] [${ev.service}] ${ev.level.toUpperCase()}: ${ev.message}`);
    }

    console.log('\nRemediation Recommendations:');
    for (let i = 0; i < report.remediationSteps.length; i++) {
      console.log(`  ${i + 1}. ${report.remediationSteps[i]}`);
    }

    // 3. Verify incidents are available in store
    console.log('\n[4/4] Verifying registered incidents via GET /api/incidents...');
    const incRes = await fetch(`${SERVER_URL}/api/incidents`);
    const incData = await incRes.json();
    console.log(`Total incidents now in store: ${incData.data.length}`);

    console.log('\n' + '='.repeat(70));
    console.log('DEMONSTRATION COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(70));
  } catch (err) {
    console.error('\nDEMO ERROR:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

runCascadeDemo();
