import { describe, it, expect } from 'vitest';
import { evaluateMetric, transitionIncident, correlateIncidents } from '../src';
import { TelemetryMetric, Incident } from '@apex/shared';

describe('incident-core: evaluator', () => {
  it('returns null when metric is within safe limits', () => {
    const metric: TelemetryMetric = {
      id: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6',
      service: 'payment-gateway',
      metric: 'cpu_percent',
      value: 45,
      unit: '%',
      timestamp: new Date().toISOString()
    };

    const result = evaluateMetric(metric);
    expect(result).toBeNull();
  });

  it('triggers critical incident when metric exceeds critical threshold', () => {
    const metric: TelemetryMetric = {
      id: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6',
      service: 'payment-gateway',
      metric: 'cpu_percent',
      value: 98,
      unit: '%',
      timestamp: new Date().toISOString()
    };

    const result = evaluateMetric(metric);
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('critical');
    expect(result?.affectedService).toBe('payment-gateway');
    expect(result?.category).toBe('resource_exhaustion');
  });

  it('triggers medium incident on warning threshold', () => {
    const metric: TelemetryMetric = {
      id: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6',
      service: 'auth-service',
      metric: 'http_error_rate_percent',
      value: 8.5,
      unit: '%',
      timestamp: new Date().toISOString()
    };

    const result = evaluateMetric(metric);
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('medium');
    expect(result?.category).toBe('error_rate');
  });
});

describe('incident-core: lifecycle', () => {
  const baseIncident: Incident = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    title: 'High latency',
    description: 'API latency > 500ms',
    severity: 'medium',
    status: 'detected',
    category: 'performance',
    affectedService: 'api-gateway',
    detectedAt: '2026-11-07T00:00:00.000Z',
    updatedAt: '2026-11-07T00:00:00.000Z',
    recommendedActions: [],
    metadata: {}
  };

  it('allows valid transitions: detected -> investigating -> resolved', () => {
    const investigating = transitionIncident(baseIncident, 'investigating');
    expect(investigating.status).toBe('investigating');

    const resolved = transitionIncident(investigating, 'resolved');
    expect(resolved.status).toBe('resolved');
    expect(resolved.resolvedAt).toBeDefined();
  });

  it('throws an error on illegal transitions: resolved -> detected', () => {
    const resolved: Incident = {
      ...baseIncident,
      status: 'resolved'
    };

    expect(() => transitionIncident(resolved, 'detected')).toThrow(/Illegal incident status transition/);
  });
});

describe('incident-core: analyzer', () => {
  it('correlates active incidents by affectedService and sorts by severity', () => {
    const incidents: Incident[] = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        title: 'Auth warning',
        description: 'Memory warning',
        severity: 'medium',
        status: 'detected',
        category: 'resource_exhaustion',
        affectedService: 'auth-service',
        detectedAt: '2026-11-07T01:00:00.000Z',
        updatedAt: '2026-11-07T01:00:00.000Z',
        recommendedActions: [],
        metadata: {}
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        title: 'Database crash',
        description: 'Connection pool exhausted',
        severity: 'critical',
        status: 'investigating',
        category: 'availability',
        affectedService: 'database-primary',
        detectedAt: '2026-11-07T01:05:00.000Z',
        updatedAt: '2026-11-07T01:05:00.000Z',
        recommendedActions: [],
        metadata: {}
      },
      {
        id: '33333333-3333-3333-3333-333333333333',
        title: 'Auth crash',
        description: 'Process terminated',
        severity: 'critical',
        status: 'detected',
        category: 'system_crash',
        affectedService: 'auth-service',
        detectedAt: '2026-11-07T01:10:00.000Z',
        updatedAt: '2026-11-07T01:10:00.000Z',
        recommendedActions: [],
        metadata: {}
      }
    ];

    const correlated = correlateIncidents(incidents);
    expect(correlated.length).toBe(2);

    // Auth service has 2 incidents, top is critical
    const authGroup = correlated.find(g => g.affectedService === 'auth-service');
    expect(authGroup).toBeDefined();
    expect(authGroup?.incidents.length).toBe(2);
    expect(authGroup?.highestSeverity).toBe('critical');
    expect(authGroup?.primaryIncidentId).toBe('33333333-3333-3333-3333-333333333333');
  });
});

