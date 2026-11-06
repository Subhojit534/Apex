import { describe, it, expect } from 'vitest';
import {
  evaluateMetric,
  transitionIncident,
  canTransition,
  correlateIncidents,
  isValidRule,
  generateUuid,
  generateUuidFromCrypto,
  CryptoLike,
  MetricRule
} from '../src';
import {
  TelemetryMetric,
  Incident,
  IncidentStatus,
  RemediationActionSchema,
  CreateIncidentPayloadSchema
} from '@apex/shared';

describe('incident-core: uuid', () => {
  const RFC4122_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  it('generates valid RFC4122 v4 UUIDs using standard generateUuid()', () => {
    const uuid = generateUuid();
    expect(uuid).toMatch(RFC4122_V4_REGEX);
  });

  it('prefers crypto.randomUUID() when available', () => {
    const mockRandomUuid = '11111111-2222-4333-8444-555555555555';
    const mockCrypto: CryptoLike = {
      randomUUID: () => mockRandomUuid,
      getRandomValues: () => {
        throw new Error('Should not be called when randomUUID is present');
      }
    };

    const result = generateUuidFromCrypto(mockCrypto);
    expect(result).toBe(mockRandomUuid);
    expect(result).toMatch(RFC4122_V4_REGEX);
  });

  it('falls back to crypto.getRandomValues() when randomUUID is unavailable and produces valid v4 UUID', () => {
    const mockCrypto: CryptoLike = {
      randomUUID: undefined,
      getRandomValues: <T extends ArrayBufferView | null>(arr: T): T => {
        if (arr && 'byteLength' in arr) {
          const u8 = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
          for (let i = 0; i < u8.length; i++) {
            u8[i] = (i * 17 + 23) & 0xff;
          }
        }
        return arr;
      }
    };

    const uuid = generateUuidFromCrypto(mockCrypto);
    expect(uuid).toMatch(RFC4122_V4_REGEX);

    // Verify 14th character is '4' (version 4)
    expect(uuid.charAt(14)).toBe('4');
    // Verify 19th character is in [8, 9, a, b] (variant 1)
    expect(['8', '9', 'a', 'b', '8', '9', 'A', 'B']).toContain(uuid.charAt(19).toLowerCase());
  });

  it('throws descriptive error if neither randomUUID nor getRandomValues is available', () => {
    const emptyCrypto: CryptoLike = {};
    expect(() => generateUuidFromCrypto(emptyCrypto)).toThrow(
      /Cryptographically secure random number generator is not available/
    );
  });

  it('throws descriptive error if crypto provider is undefined', () => {
    expect(() => generateUuidFromCrypto(undefined)).toThrow(
      /Cryptographically secure random number generator is not available/
    );
  });
});

describe('incident-core: evaluator', () => {
  const baseMetric: TelemetryMetric = {
    id: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6',
    service: 'payment-gateway',
    metric: 'cpu_percent',
    value: 50,
    unit: '%',
    timestamp: '2026-11-07T00:00:00.000Z'
  };

  it('returns null when metric is below warning threshold', () => {
    const result = evaluateMetric({ ...baseMetric, value: 79.9 });
    expect(result).toBeNull();
  });

  it('triggers medium incident when metric is exactly at warning threshold', () => {
    const result = evaluateMetric({ ...baseMetric, value: 80 });
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('medium');
    expect(result?.affectedService).toBe('payment-gateway');
  });

  it('triggers medium incident when metric is between warning and critical thresholds', () => {
    const result = evaluateMetric({ ...baseMetric, value: 90 });
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('medium');
  });

  it('triggers critical incident when metric is exactly at critical threshold', () => {
    const result = evaluateMetric({ ...baseMetric, value: 95 });
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('critical');
  });

  it('triggers critical incident when metric exceeds critical threshold', () => {
    const result = evaluateMetric({ ...baseMetric, value: 99.5 });
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('critical');
    expect(result?.category).toBe('resource_exhaustion');
  });

  it('rejects negative metric values to prevent misleading incidents', () => {
    expect(evaluateMetric({ ...baseMetric, value: -1 })).toBeNull();
    expect(evaluateMetric({ ...baseMetric, value: -99 })).toBeNull();
  });

  it('safely handles and rejects invalid metric values (NaN, Infinity, non-numeric)', () => {
    expect(evaluateMetric({ ...baseMetric, value: NaN })).toBeNull();
    expect(evaluateMetric({ ...baseMetric, value: Infinity })).toBeNull();
    expect(evaluateMetric({ ...baseMetric, value: -Infinity })).toBeNull();
    // @ts-expect-error Testing runtime invalid input
    expect(evaluateMetric({ ...baseMetric, value: '99' })).toBeNull();
    // @ts-expect-error Testing runtime invalid input
    expect(evaluateMetric({ ...baseMetric, value: null })).toBeNull();
    // @ts-expect-error Testing runtime invalid input
    expect(evaluateMetric({ ...baseMetric, value: undefined })).toBeNull();
  });

  it('rejects invalid or missing service strings', () => {
    expect(evaluateMetric({ ...baseMetric, service: '', value: 99 })).toBeNull();
    expect(evaluateMetric({ ...baseMetric, service: '   ', value: 99 })).toBeNull();
    // @ts-expect-error Testing runtime invalid input
    expect(evaluateMetric({ ...baseMetric, service: null, value: 99 })).toBeNull();
  });

  it('supports custom configurable metric rules', () => {
    const customRule: MetricRule = {
      metric: 'disk_io_wait_percent',
      warningThreshold: 25,
      criticalThreshold: 50,
      category: 'performance',
      titleTemplate: (svc, val, unit) => `Custom IO Wait on ${svc}: ${val}${unit}`
    };

    const metric: TelemetryMetric = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      service: 'storage-node-1',
      metric: 'disk_io_wait_percent',
      value: 30,
      unit: '%',
      timestamp: '2026-11-07T00:00:00.000Z'
    };

    const result = evaluateMetric(metric, [customRule]);
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('medium');
    expect(result?.title).toBe('Custom IO Wait on storage-node-1: 30%');
  });

  it('validates threshold rules and ignores invalid rule configurations', () => {
    const invalidRuleInverted: MetricRule = {
      metric: 'cpu_percent',
      warningThreshold: 90,
      criticalThreshold: 50, // critical < warning is invalid
      category: 'resource_exhaustion',
      titleTemplate: () => 'Invalid'
    };

    const invalidRuleNegative: MetricRule = {
      metric: 'cpu_percent',
      warningThreshold: -10,
      criticalThreshold: 50,
      category: 'resource_exhaustion',
      titleTemplate: () => 'Invalid'
    };

    expect(isValidRule(invalidRuleInverted)).toBe(false);
    expect(isValidRule(invalidRuleNegative)).toBe(false);

    expect(evaluateMetric({ ...baseMetric, value: 95 }, [invalidRuleInverted])).toBeNull();
    expect(evaluateMetric({ ...baseMetric, value: 95 }, [invalidRuleNegative])).toBeNull();
  });

  it('generates remediation actions with valid UUIDs satisfying RemediationActionSchema', () => {
    const result = evaluateMetric({ ...baseMetric, value: 99 });
    expect(result).not.toBeNull();
    expect(result?.recommendedActions.length).toBeGreaterThan(0);

    for (const action of result!.recommendedActions) {
      expect(action.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
      const parseResult = RemediationActionSchema.safeParse(action);
      expect(parseResult.success).toBe(true);
    }
  });

  it('produces payload that fully satisfies CreateIncidentPayloadSchema validation', () => {
    const result = evaluateMetric({ ...baseMetric, value: 99 });
    expect(result).not.toBeNull();

    const parseResult = CreateIncidentPayloadSchema.safeParse(result);
    expect(parseResult.success).toBe(true);
  });
});

describe('incident-core: lifecycle transitions', () => {
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

  const validTransitions: [IncidentStatus, IncidentStatus][] = [
    ['detected', 'investigating'],
    ['detected', 'mitigating'],
    ['detected', 'resolved'],
    ['detected', 'closed'],
    ['investigating', 'mitigating'],
    ['investigating', 'resolved'],
    ['investigating', 'closed'],
    ['mitigating', 'investigating'],
    ['mitigating', 'resolved'],
    ['mitigating', 'closed'],
    ['resolved', 'closed'],
    ['resolved', 'investigating'], // reopen
    ['closed', 'investigating'] // reopen
  ];

  it.each(validTransitions)(
    'allows valid transition: %s -> %s',
    (fromStatus, toStatus) => {
      expect(canTransition(fromStatus, toStatus)).toBe(true);
      const inc: Incident = { ...baseIncident, status: fromStatus };
      const updated = transitionIncident(inc, toStatus);
      expect(updated.status).toBe(toStatus);
    }
  );

  const invalidTransitions: [IncidentStatus, IncidentStatus][] = [
    ['resolved', 'detected'],
    ['resolved', 'mitigating'],
    ['closed', 'detected'],
    ['closed', 'mitigating'],
    ['closed', 'resolved']
  ];

  it.each(invalidTransitions)(
    'rejects invalid transition: %s -> %s with meaningful error',
    (fromStatus, toStatus) => {
      expect(canTransition(fromStatus, toStatus)).toBe(false);
      const inc: Incident = { ...baseIncident, status: fromStatus };
      expect(() => transitionIncident(inc, toStatus)).toThrow(
        new RegExp(`Illegal incident status transition from '${fromStatus}' to '${toStatus}'`)
      );
    }
  );

  it('repeating the same status returns incident unchanged without unnecessary updates', () => {
    const originalTime = '2026-11-07T01:00:00.000Z';
    const inc: Incident = { ...baseIncident, status: 'investigating', updatedAt: originalTime };
    const result = transitionIncident(inc, 'investigating', '2026-11-07T02:00:00.000Z');

    expect(result).toBe(inc); // Exact same reference
    expect(result.updatedAt).toBe(originalTime);
  });

  it('resolving an incident sets resolvedAt', () => {
    const resolveTime = '2026-11-07T02:30:00.000Z';
    const investigating = transitionIncident(baseIncident, 'investigating');
    expect(investigating.resolvedAt).toBeUndefined();

    const resolved = transitionIncident(investigating, 'resolved', resolveTime);
    expect(resolved.status).toBe('resolved');
    expect(resolved.resolvedAt).toBe(resolveTime);
  });

  it('closing an already resolved incident preserves its original resolution timestamp', () => {
    const resolveTime = '2026-11-07T02:30:00.000Z';
    const closeTime = '2026-11-07T03:00:00.000Z';

    const resolved = transitionIncident(baseIncident, 'resolved', resolveTime);
    expect(resolved.resolvedAt).toBe(resolveTime);

    const closed = transitionIncident(resolved, 'closed', closeTime);
    expect(closed.status).toBe('closed');
    expect(closed.resolvedAt).toBe(resolveTime); // Preserved!
    expect(closed.updatedAt).toBe(closeTime);
  });

  it('closing an unresolved incident does not mark it as resolved', () => {
    const closeTime = '2026-11-07T03:00:00.000Z';

    const investigating: Incident = { ...baseIncident, status: 'investigating' };
    const closed = transitionIncident(investigating, 'closed', closeTime);

    expect(closed.status).toBe('closed');
    expect(closed.resolvedAt).toBeUndefined(); // Not marked as resolved!
  });

  it('reopening a resolved incident clears the previous resolution timestamp', () => {
    const resolveTime = '2026-11-07T02:30:00.000Z';
    const reopenTime = '2026-11-07T03:15:00.000Z';

    const resolved = transitionIncident(baseIncident, 'resolved', resolveTime);
    expect(resolved.resolvedAt).toBe(resolveTime);

    const reopened = transitionIncident(resolved, 'investigating', reopenTime);
    expect(reopened.status).toBe('investigating');
    expect(reopened.resolvedAt).toBeUndefined(); // Cleared!
  });

  it('reopening a closed incident clears the previous resolution timestamp', () => {
    const resolveTime = '2026-11-07T02:30:00.000Z';
    const reopenTime = '2026-11-07T03:15:00.000Z';

    const resolved = transitionIncident(baseIncident, 'resolved', resolveTime);
    const closed = transitionIncident(resolved, 'closed');
    expect(closed.resolvedAt).toBe(resolveTime);

    const reopened = transitionIncident(closed, 'investigating', reopenTime);
    expect(reopened.status).toBe('investigating');
    expect(reopened.resolvedAt).toBeUndefined(); // Cleared!
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

    const authGroup = correlated.find((g) => g.affectedService === 'auth-service');
    expect(authGroup).toBeDefined();
    expect(authGroup?.incidents.length).toBe(2);
    expect(authGroup?.highestSeverity).toBe('critical');
    expect(authGroup?.primaryIncidentId).toBe('33333333-3333-3333-3333-333333333333');
  });
});
