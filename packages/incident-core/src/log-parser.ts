import { LogEntry, LogLevel, LogEntrySchema } from '@apex/shared';
import { generateUuid } from './uuid';

export type LogFormat = 'txt' | 'json' | 'csv' | 'auto';

const VALID_LOG_LEVELS: Set<string> = new Set(['debug', 'info', 'warn', 'error', 'fatal']);

export function normalizeLogLevel(raw: unknown): LogLevel {
  if (typeof raw !== 'string') return 'info';
  const clean = raw.toLowerCase().replace(/[^a-z]/g, '');
  if (VALID_LOG_LEVELS.has(clean)) {
    return clean as LogLevel;
  }
  if (clean === 'err' || clean === 'critical' || clean === 'crit') return 'error';
  if (clean === 'warning') return 'warn';
  if (clean === 'trace' || clean === 'verbose') return 'debug';
  if (clean === 'emergency' || clean === 'alert' || clean === 'panic') return 'fatal';
  return 'info';
}

function parseIsoTimestamp(raw: unknown): string {
  if (typeof raw === 'string') {
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return new Date().toISOString();
}

export function parseJsonLogs(content: string, defaultService = 'app'): LogEntry[] {
  const trimmed = content.trim();
  const entries: LogEntry[] = [];

  // Try parsing as a JSON array of objects
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === 'object') {
            const entry = normalizeJsonLogItem(item as Record<string, unknown>, defaultService);
            if (entry) entries.push(entry);
          }
        }
        return entries;
      }
    } catch {
      // Fall through to NDJSON line-by-line parsing
    }
  }

  // Parse line-by-line NDJSON
  const lines = content.split('\n');
  for (const line of lines) {
    const l = line.trim();
    if (!l) continue;
    try {
      const obj = JSON.parse(l);
      if (obj && typeof obj === 'object') {
        const entry = normalizeJsonLogItem(obj as Record<string, unknown>, defaultService);
        if (entry) entries.push(entry);
      }
    } catch {
      // Ignore unparseable individual JSON lines
    }
  }

  return entries;
}

function normalizeJsonLogItem(obj: Record<string, unknown>, defaultService: string): LogEntry | null {
  const service = typeof obj.service === 'string' && obj.service.trim()
    ? obj.service.trim()
    : typeof obj.component === 'string' && obj.component.trim()
    ? obj.component.trim()
    : typeof obj.app === 'string' && obj.app.trim()
    ? obj.app.trim()
    : defaultService;

  const level = normalizeLogLevel(obj.level ?? obj.severity ?? obj.lvl);
  const timestamp = parseIsoTimestamp(obj.timestamp ?? obj.time ?? obj.date ?? obj['@timestamp']);

  const message = typeof obj.message === 'string'
    ? obj.message
    : typeof obj.msg === 'string'
    ? obj.msg
    : typeof obj.error === 'string'
    ? obj.error
    : JSON.stringify(obj);

  const traceId = typeof obj.traceId === 'string'
    ? obj.traceId
    : typeof obj.trace_id === 'string'
    ? obj.trace_id
    : typeof obj.correlationId === 'string'
    ? obj.correlationId
    : undefined;

  const candidate: LogEntry = {
    id: typeof obj.id === 'string' && /^[0-9a-f-]{36}$/i.test(obj.id) ? obj.id : generateUuid(),
    service,
    level,
    message,
    timestamp,
    traceId,
    context: obj
  };

  const validated = LogEntrySchema.safeParse(candidate);
  return validated.success ? validated.data : candidate;
}

export function parseCsvLogs(content: string, defaultService = 'app'): LogEntry[] {
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const entries: LogEntry[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Basic CSV cell split handling quoted commas
    const parts = splitCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = parts[idx] ? parts[idx].trim() : '';
    });

    const timestamp = parseIsoTimestamp(row.timestamp || row.time || row.date || row.datetime);
    const service = row.service || row.component || row.app || defaultService;
    const level = normalizeLogLevel(row.level || row.severity || row.lvl);
    const message = row.message || row.msg || row.error || lines[i];
    const traceId = row.traceid || row.trace_id || row.correlation_id || undefined;

    entries.push({
      id: generateUuid(),
      service,
      level,
      message,
      timestamp,
      traceId
    });
  }

  return entries;
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && (i === 0 || line[i - 1] !== '\\')) {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.replace(/^"|"$/g, ''));
  return result;
}

// Regex matching standard text logs:
// e.g. 2026-11-07T04:00:00.000Z [ERROR] [auth-service] Failed password attempt (traceId=tr-1234)
// e.g. [2026-11-07 04:00:00] [payment-gateway] ERROR: DB pool exhausted
const TXT_LOG_REGEX = /^(?:\[?(\d{4}[-/]\d{2}[-/]\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)\]?)?\s*(?:\[([a-zA-Z]+)\]|([a-zA-Z]+):)?\s*(?:\[([a-zA-Z0-9_.-]+)\])?\s*(.*)$/;

export function parseTxtLogs(content: string, defaultService = 'app'): LogEntry[] {
  const lines = content.split('\n');
  const entries: LogEntry[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = line.match(TXT_LOG_REGEX);
    if (!match) {
      entries.push({
        id: generateUuid(),
        service: defaultService,
        level: 'info',
        message: line,
        timestamp: new Date().toISOString()
      });
      continue;
    }

    const rawTimestamp = match[1];
    const rawLevel = match[2] || match[3] || 'INFO';
    const rawService = match[4] || defaultService;
    const rawMessage = match[5] || line;

    const timestamp = parseIsoTimestamp(rawTimestamp);

    // Check for trace ID in message (e.g. traceId=tr-123 or [tr-123])
    const traceMatch = rawMessage.match(/(?:traceId=|trace_id=)([a-zA-Z0-9_-]+)/i);
    const traceId = traceMatch ? traceMatch[1] : undefined;

    entries.push({
      id: generateUuid(),
      service: rawService,
      level: normalizeLogLevel(rawLevel),
      message: rawMessage,
      timestamp,
      traceId
    });
  }

  return entries;
}

export function parseLogs(content: string, format: LogFormat = 'auto', defaultService = 'app'): LogEntry[] {
  const trimmed = content.trim();
  if (!trimmed) return [];

  let determinedFormat = format;
  if (determinedFormat === 'auto') {
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      determinedFormat = 'json';
    } else {
      const firstLine = trimmed.split('\n')[0].toLowerCase();
      if (firstLine.includes(',') && (firstLine.includes('timestamp') || firstLine.includes('message') || firstLine.includes('service') || firstLine.includes('level'))) {
        determinedFormat = 'csv';
      } else {
        determinedFormat = 'txt';
      }
    }
  }

  switch (determinedFormat) {
    case 'json':
      return parseJsonLogs(content, defaultService);
    case 'csv':
      return parseCsvLogs(content, defaultService);
    case 'txt':
    default:
      return parseTxtLogs(content, defaultService);
  }
}

