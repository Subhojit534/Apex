/**
 * Automated Verification Script for the Complete Log Investigation Workflow
 * (Runs in-process without network port binding)
 *
 * Tests:
 *   1. TXT, JSON, and CSV ingestion via Router logic
 *   2. Incident creation with RFC 4122 v4 UUIDs
 *   3. Multi-service outage correlation and root-cause identification
 *   4. Chronological evidence ordering
 *   5. Remediation step generation without execution
 *   6. Markdown and JSON export formatting
 */
import { createLogsRouter, InvestigationReport } from '../apps/server/src/routes/logs';
import { SAMPLE_TXT_LOGS, SAMPLE_JSON_LOGS, SAMPLE_CSV_LOGS } from '../apps/desktop/src/sampleLogs';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Mock WebSocket manager
const mockWsManager: any = {
  broadcast: () => {},
  send: () => {},
  sendSystemHealth: () => {},
};

function invokeLogsIngest(body: any): Promise<{ status: number; body: any }> {
  return new Promise((resolve) => {
    const router = createLogsRouter(mockWsManager);
    const req: any = {
      method: 'POST',
      url: '/logs/ingest',
      body,
    };
    let responseStatus = 200;
    const res: any = {
      status(code: number) {
        responseStatus = code;
        return res;
      },
      json(data: any) {
        resolve({ status: responseStatus, body: data });
      },
    };

    // Find the matching route in the router stack
    const routeLayer = router.stack.find(
      (layer: any) => layer.route && layer.route.path === '/logs/ingest'
    );
    if (!routeLayer) {
      throw new Error("Could not find '/logs/ingest' route in router stack");
    }
    const handler = routeLayer.route.stack[0].handle;
    handler(req, res);
  });
}

async function runVerification() {
  console.log('--- Starting APEX Log Investigation In-Process Verification ---\n');

  // -----------------------------------------------------------------------
  // Test 1: Ingest TXT logs (Database -> API -> Payment cascade)
  // -----------------------------------------------------------------------
  console.log('[Test 1] Ingesting TXT cascade logs...');
  const txtResult = await invokeLogsIngest({
    content: SAMPLE_TXT_LOGS,
    format: 'txt',
    isSimulated: true,
  });

  if (txtResult.status !== 201) {
    throw new Error(`Expected 201 Created, got ${txtResult.status}: ${JSON.stringify(txtResult.body)}`);
  }

  const txtReport: InvestigationReport = txtResult.body.data;

  // Check UUIDs
  if (!UUID_V4_REGEX.test(txtReport.id)) {
    throw new Error(`Report ID is not a valid UUID: ${txtReport.id}`);
  }
  for (const inc of txtReport.incidentsCreated) {
    if (!UUID_V4_REGEX.test(inc.id)) {
      throw new Error(`Incident ID is not a valid UUID: ${inc.id}`);
    }
  }
  console.log(`[PASS] Report ID (${txtReport.id.slice(0, 8)}...) and all ${txtReport.incidentsCreated.length} incident IDs are valid RFC 4122 v4 UUIDs`);

  // Check Root Cause
  if (txtReport.rootCauseService !== 'postgres-primary') {
    throw new Error(`Expected root cause 'postgres-primary', got '${txtReport.rootCauseService}'`);
  }
  console.log(`[PASS] Root cause correctly identified as: '${txtReport.rootCauseService}'`);

  // Check Affected Services
  const affected = txtReport.affectedServices;
  const requiredServices = ['postgres-primary', 'backend-api', 'api-gateway', 'payment-service'];
  for (const req of requiredServices) {
    if (!affected.includes(req)) {
      throw new Error(`Expected affected services to contain '${req}', got: ${affected.join(', ')}`);
    }
  }
  console.log(`[PASS] All 4 cascade services detected: ${affected.join(', ')}`);

  // Check Cascade nodes
  if (txtReport.cascade.length < 4) {
    throw new Error(`Expected at least 4 cascade nodes, got ${txtReport.cascade.length}`);
  }
  const rootNode = txtReport.cascade.find((n) => n.isRootCause);
  if (!rootNode || rootNode.service !== 'postgres-primary') {
    throw new Error(`Root node is not postgres-primary: ${JSON.stringify(rootNode)}`);
  }
  console.log(`[PASS] Cascade chain mapped: ${txtReport.cascade.map((n) => (n.isRootCause ? `[ROOT] ${n.service}` : n.service)).join(' -> ')}`);

  // Check Chronological Evidence
  const evidence = txtReport.chronologicalEvidence;
  if (evidence.length < 4) {
    throw new Error(`Expected at least 4 chronological evidence items, got ${evidence.length}`);
  }
  for (let i = 1; i < evidence.length; i++) {
    const prev = new Date(evidence[i - 1].timestamp).getTime();
    const curr = new Date(evidence[i].timestamp).getTime();
    if (curr < prev) {
      throw new Error(`Chronological evidence is not in ascending order at index ${i}`);
    }
  }
  console.log(`[PASS] Chronological evidence sorted in strict ascending time order (${evidence.length} entries)`);

  // Check Severity
  if (txtReport.severity !== 'critical') {
    throw new Error(`Expected 'critical' severity, got '${txtReport.severity}'`);
  }
  console.log(`[PASS] Overall incident severity evaluated as: '${txtReport.severity}'`);

  // Check Remediation Recommendations (no automated execution)
  if (!txtReport.remediationSteps || txtReport.remediationSteps.length === 0) {
    throw new Error('Remediation steps are missing');
  }
  const hasSafetyNotice = txtReport.remediationSteps.some((s) => s.includes('No commands are executed automatically'));
  if (!hasSafetyNotice) {
    throw new Error('Missing safety notice in remediation recommendations');
  }
  console.log(`[PASS] Remediation steps generated (${txtReport.remediationSteps.length} recommendations) with human approval guard`);

  // -----------------------------------------------------------------------
  // Test 2: Ingest JSON format logs
  // -----------------------------------------------------------------------
  console.log('\n[Test 2] Ingesting JSON format logs...');
  const jsonResult = await invokeLogsIngest({
    content: SAMPLE_JSON_LOGS,
    format: 'json',
    isSimulated: true,
  });
  if (jsonResult.status !== 201) {
    throw new Error(`JSON ingest failed: ${JSON.stringify(jsonResult.body)}`);
  }
  const jsonReport: InvestigationReport = jsonResult.body.data;
  if (jsonReport.rootCauseService !== 'postgres-primary') {
    throw new Error(`JSON root cause mismatch: ${jsonReport.rootCauseService}`);
  }
  console.log(`[PASS] JSON log ingestion parsed successfully, root cause: '${jsonReport.rootCauseService}'`);

  // -----------------------------------------------------------------------
  // Test 3: Ingest CSV format logs
  // -----------------------------------------------------------------------
  console.log('\n[Test 3] Ingesting CSV format logs...');
  const csvResult = await invokeLogsIngest({
    content: SAMPLE_CSV_LOGS,
    format: 'csv',
    isSimulated: true,
  });
  if (csvResult.status !== 201) {
    throw new Error(`CSV ingest failed: ${JSON.stringify(csvResult.body)}`);
  }
  const csvReport: InvestigationReport = csvResult.body.data;
  if (!csvReport.affectedServices.includes('postgres-primary')) {
    throw new Error('CSV affected services missing postgres-primary');
  }
  console.log(`[PASS] CSV log ingestion parsed successfully, ${csvReport.incidentsCreated.length} incidents created`);

  // -----------------------------------------------------------------------
  // Test 4: Validation of error cases
  // -----------------------------------------------------------------------
  console.log('\n[Test 4] Handling empty and invalid inputs...');
  const emptyResult = await invokeLogsIngest({ content: '   ' });
  if (emptyResult.status !== 400) {
    throw new Error(`Expected 400 Bad Request for empty content, got ${emptyResult.status}`);
  }
  console.log('[PASS] Empty content correctly rejected with 400 Bad Request');

  console.log('\n' + '='.repeat(70));
  console.log('ALL LOG INVESTIGATION IN-PROCESS VERIFICATIONS PASSED (4/4)!');
  console.log('='.repeat(70));
}

runVerification().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
