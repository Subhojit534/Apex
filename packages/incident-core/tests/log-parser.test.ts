import { describe, it, expect } from 'vitest';
import { parseLogs, parseJsonLogs, parseCsvLogs, parseTxtLogs, normalizeLogLevel } from '../src/log-parser';
import { LogEntrySchema } from '@apex/shared';

describe('incident-core: log-parser', () => {
  it('normalizes various log level string variants', () => {
    expect(normalizeLogLevel('ERROR')).toBe('error');
    expect(normalizeLogLevel('err')).toBe('error');
    expect(normalizeLogLevel('CRITICAL')).toBe('error');
    expect(normalizeLogLevel('WARN')).toBe('warn');
    expect(normalizeLogLevel('warning')).toBe('warn');
    expect(normalizeLogLevel('INFO')).toBe('info');
    expect(normalizeLogLevel('debug')).toBe('debug');
    expect(normalizeLogLevel('FATAL')).toBe('fatal');
    expect(normalizeLogLevel('panic')).toBe('fatal');
    expect(normalizeLogLevel(undefined)).toBe('info');
  });

  it('parses JSON array logs correctly with validation', () => {
    const jsonContent = JSON.stringify([
      {
        timestamp: '2026-11-07T02:00:00.000Z',
        service: 'payment-gateway',
        level: 'error',
        message: 'Database query timed out',
        traceId: 'tr-998811'
      },
      {
        timestamp: '2026-11-07T02:00:01.000Z',
        service: 'payment-gateway',
        level: 'info',
        message: 'Retry attempt 1'
      }
    ]);

    const entries = parseJsonLogs(jsonContent);
    expect(entries.length).toBe(2);
    expect(entries[0].service).toBe('payment-gateway');
    expect(entries[0].level).toBe('error');
    expect(entries[0].traceId).toBe('tr-998811');

    for (const entry of entries) {
      expect(LogEntrySchema.safeParse(entry).success).toBe(true);
    }
  });

  it('parses newline-delimited JSON (NDJSON) logs correctly', () => {
    const ndjson = [
      '{"time":"2026-11-07T03:00:00.000Z","service":"auth","level":"warn","message":"Rate limit exceeded"}',
      '{"time":"2026-11-07T03:00:01.000Z","service":"auth","level":"error","message":"Failed login burst"}'
    ].join('\n');

    const entries = parseLogs(ndjson);
    expect(entries.length).toBe(2);
    expect(entries[0].level).toBe('warn');
    expect(entries[1].level).toBe('error');
    expect(entries[0].service).toBe('auth');
  });

  it('parses CSV formatted logs correctly', () => {
    const csvContent = [
      'timestamp,service,level,message,traceId',
      '2026-11-07T04:00:00.000Z,db-primary,error,"Deadlock detected in transaction",tr-5544',
      '2026-11-07T04:00:02.000Z,db-primary,info,"Process recovered",tr-5544'
    ].join('\n');

    const entries = parseCsvLogs(csvContent);
    expect(entries.length).toBe(2);
    expect(entries[0].service).toBe('db-primary');
    expect(entries[0].level).toBe('error');
    expect(entries[0].message).toBe('Deadlock detected in transaction');
    expect(entries[0].traceId).toBe('tr-5544');

    for (const entry of entries) {
      expect(LogEntrySchema.safeParse(entry).success).toBe(true);
    }
  });

  it('parses standard TXT formatted logs with brackets and levels', () => {
    const txtContent = [
      '2026-11-07T05:00:00.000Z [ERROR] [api-gateway] Upstream connection refused to auth-service traceId=tr-1122',
      '2026-11-07T05:00:01.000Z [WARN] [api-gateway] Retrying upstream connection'
    ].join('\n');

    const entries = parseTxtLogs(txtContent);
    expect(entries.length).toBe(2);
    expect(entries[0].service).toBe('api-gateway');
    expect(entries[0].level).toBe('error');
    expect(entries[0].traceId).toBe('tr-1122');
    expect(entries[1].level).toBe('warn');

    for (const entry of entries) {
      expect(LogEntrySchema.safeParse(entry).success).toBe(true);
    }
  });

  it('auto-detects format between JSON, CSV, and TXT', () => {
    const jsonStr = '[{"message":"hello","level":"info"}]';
    const csvStr = 'timestamp,service,level,message\n2026-11-07T00:00:00Z,svc,info,test';
    const txtStr = '2026-11-07T00:00:00Z [INFO] [svc] plain text log';

    expect(parseLogs(jsonStr).length).toBe(1);
    expect(parseLogs(csvStr).length).toBe(1);
    expect(parseLogs(txtStr).length).toBe(1);
  });
});

