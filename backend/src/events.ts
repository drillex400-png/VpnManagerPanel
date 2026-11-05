import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = process.env.XRAY_DATA_DIR || join(process.cwd(), '.xray-data');
const EVENTS_FILE = join(DATA_DIR, 'events.json');
const MAX_EVENTS = 500;

export type EventType = 'server' | 'client' | 'queue' | 'system' | 'security';
export type EventSeverity = 'info' | 'warning' | 'error' | 'success';

export interface EventEntry {
  id: number;
  type: EventType;
  severity: EventSeverity;
  title: string;
  message: string;
  serverId?: number;
  serverName?: string;
  clientId?: number;
  clientName?: string;
  timestamp: string;
}

let events: EventEntry[] = [];
let nextId = 1;

try {
  if (existsSync(EVENTS_FILE)) {
    const data = JSON.parse(readFileSync(EVENTS_FILE, 'utf-8'));
    events = data.events || [];
    nextId = data.nextId || (events.length + 1);
  }
} catch {
  // corrupt file — start fresh
}

function persist(): void {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(EVENTS_FILE, JSON.stringify({ events, nextId }, null, 2));
  } catch {
    // best-effort
  }
}

export function logEvent(entry: Omit<EventEntry, 'id' | 'timestamp'>): EventEntry {
  const event: EventEntry = {
    ...entry,
    id: nextId++,
    timestamp: new Date().toISOString(),
  };
  events.unshift(event);
  if (events.length > MAX_EVENTS) events = events.slice(0, MAX_EVENTS);
  persist();
  return event;
}

export function getEvents(limit = 100, filter?: string): EventEntry[] {
  if (filter && filter !== 'all') {
    return events.filter((e) => e.type === filter).slice(0, limit);
  }
  return events.slice(0, limit);
}

export function clearEvents(): void {
  events = [];
  nextId = 1;
  persist();
}
