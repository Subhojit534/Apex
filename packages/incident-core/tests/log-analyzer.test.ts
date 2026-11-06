import { describe, it, expect } from 'vitest';
import { analyzeLogEntry } from '../src/log-analyzer';
import { LogEntry } from '@apex/shared';

describe('incident-core: log-analyzer', () => {
  it('detects OutOfMemory log signatures and flags critical resource exhaustion incident', () => {
    const entry: LogEntry = {
      id: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6',
      service: 'search-indexer',
      level: 'error',
      message: 'FATAL: JavaScript heap out of memory while buffering Lucene index segments',
      timestamp: new Date().toISOString(),
      traceId: 'tr-998811'
    };

    const incident = analyzeLogEntry(entry);
    expect(incident).not.toBeNull();
    expect(incident?.severity).toBe('critical');
    expect(incident?.category).toBe('resource_exhaustion');
    expect(incident?.title).toContain('Process Out of Memory');
    expect(incident?.affectedService).toBe('search-indexer');
  });

  it('detects database deadlock log signatures as high severity availability incident', () => {
    const entry: LogEntry = {
      id: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6',
      service: 'order-service',
      level: 'error',
      message: 'QueryFailedError: Deadlock detected in PostgreSQL transaction order_checkout_v2',
      timestamp: new Date().toISOString()
    };

    const incident = analyzeLogEntry(entry);
    expect(incident).not.toBeNull();
    expect(incident?.severity).toBe('high');
    expect(incident?.category).toBe('availability');
  });

  it('detects fatal log levels without explicit signature as critical system_crash', () => {
    const entry: LogEntry = {
      id: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6',
      service: 'gateway',
      level: 'fatal',
      message: 'Kernel signal 9 received, aborting runtime immediately',
      timestamp: new Date().toISOString()
    };

    const incident = analyzeLogEntry(entry);
    expect(incident).not.toBeNull();
    expect(incident?.severity).toBe('critical');
    expect(incident?.category).toBe('system_crash');
  });

  it('returns null for normal informational or debug logs', () => {
    const entry: LogEntry = {
      id: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6',
      service: 'user-service',
      level: 'info',
      message: 'User 12345 logged in successfully via OAuth',
      timestamp: new Date().toISOString()
    };

    const incident = analyzeLogEntry(entry);
    expect(incident).toBeNull();
  });
});

