/**
 * SIMULATED log data for the database-to-payment outage cascade scenario.
 * These logs are entirely fictional and are labelled as simulated throughout the UI.
 *
 * Timeline (UTC offsets relative to T+0 = 04:00:00):
 *   T+00  postgres-primary  — connection failures begin
 *   T+01  backend-api       — pool exhaustion
 *   T+02  api-gateway       — 504 timeouts
 *   T+03  payment-service   — payment failures
 *   T+04  payment-service   — user-facing disruption
 */

export const SAMPLE_TXT_LOGS = `2026-11-07T04:00:03Z [ERROR] [postgres-primary] FATAL: remaining connection slots are reserved for non-replication superuser connections
2026-11-07T04:00:05Z [ERROR] [postgres-primary] FATAL: connection pool exhausted — max_connections=100 reached
2026-11-07T04:00:07Z [ERROR] [postgres-primary] Database unavailable: too many clients already
2026-11-07T04:00:12Z [ERROR] [backend-api] connect ECONNREFUSED 127.0.0.1:5432 — PostgreSQL refused connection
2026-11-07T04:00:14Z [ERROR] [backend-api] connection pool exhausted — all 20 pooled connections are busy
2026-11-07T04:00:16Z [ERROR] [backend-api] Unhandled query timeout after 30000ms on service backend-api traceId=tr-9a3f1b
2026-11-07T04:00:22Z [ERROR] [api-gateway] 504 Gateway Timeout — upstream backend-api failed to respond within 30s
2026-11-07T04:00:24Z [ERROR] [api-gateway] upstream timed out (30000ms) while reading response header from upstream traceId=tr-9a3f1b
2026-11-07T04:00:28Z [ERROR] [api-gateway] 504 Gateway Timeout — /api/v1/checkout endpoint unresponsive
2026-11-07T04:00:35Z [ERROR] [payment-service] Payment processing failed: upstream API gateway returned 504
2026-11-07T04:00:37Z [ERROR] [payment-service] Transaction charge failed for order-7823: connect ECONNREFUSED
2026-11-07T04:00:39Z [FATAL] [payment-service] payment timeout — circuit breaker OPEN after 5 consecutive failures
2026-11-07T04:00:45Z [ERROR] [payment-service] user-facing service disruption: 100% of payment requests failing
2026-11-07T04:01:00Z [WARN]  [backend-api] retry attempt 3/3 failed for DB query — giving up traceId=tr-9a3f1b
2026-11-07T04:01:10Z [ERROR] [postgres-primary] Lock wait timeout exceeded; try restarting transaction
`;

export const SAMPLE_JSON_LOGS = JSON.stringify([
  { timestamp: '2026-11-07T04:00:03.000Z', level: 'error', service: 'postgres-primary', message: 'FATAL: remaining connection slots are reserved for non-replication superuser connections' },
  { timestamp: '2026-11-07T04:00:05.000Z', level: 'error', service: 'postgres-primary', message: 'FATAL: connection pool exhausted — max_connections=100 reached' },
  { timestamp: '2026-11-07T04:00:07.000Z', level: 'error', service: 'postgres-primary', message: 'Database unavailable: too many clients already' },
  { timestamp: '2026-11-07T04:00:12.000Z', level: 'error', service: 'backend-api',       message: 'connect ECONNREFUSED 127.0.0.1:5432 — PostgreSQL refused connection', traceId: 'tr-9a3f1b' },
  { timestamp: '2026-11-07T04:00:14.000Z', level: 'error', service: 'backend-api',       message: 'connection pool exhausted — all 20 pooled connections are busy', traceId: 'tr-9a3f1b' },
  { timestamp: '2026-11-07T04:00:22.000Z', level: 'error', service: 'api-gateway',       message: '504 Gateway Timeout — upstream backend-api failed to respond within 30s' },
  { timestamp: '2026-11-07T04:00:35.000Z', level: 'error', service: 'payment-service',   message: 'Payment processing failed: upstream API gateway returned 504' },
  { timestamp: '2026-11-07T04:00:37.000Z', level: 'error', service: 'payment-service',   message: 'Transaction charge failed for order-7823: connect ECONNREFUSED' },
  { timestamp: '2026-11-07T04:00:39.000Z', level: 'fatal', service: 'payment-service',   message: 'payment timeout — circuit breaker OPEN after 5 consecutive failures' },
], null, 2);

export const SAMPLE_CSV_LOGS = `timestamp,level,service,message
2026-11-07T04:00:03.000Z,error,postgres-primary,"FATAL: remaining connection slots are reserved"
2026-11-07T04:00:05.000Z,error,postgres-primary,"FATAL: connection pool exhausted — max_connections=100"
2026-11-07T04:00:12.000Z,error,backend-api,"connect ECONNREFUSED 127.0.0.1:5432"
2026-11-07T04:00:14.000Z,error,backend-api,"connection pool exhausted — all 20 pooled connections busy"
2026-11-07T04:00:22.000Z,error,api-gateway,"504 Gateway Timeout — upstream backend-api unresponsive"
2026-11-07T04:00:35.000Z,error,payment-service,"Payment processing failed: upstream returned 504"
2026-11-07T04:00:39.000Z,fatal,payment-service,"circuit breaker OPEN after 5 consecutive failures"
`;
