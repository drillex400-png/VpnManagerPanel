import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { generateX25519KeyPair, generateShortIds } from './xray/keys';

const DATA_DIR = process.env.XRAY_DATA_DIR || join(process.cwd(), '.xray-data');
const DATA_FILE = join(DATA_DIR, 'state.json');

mkdirSync(DATA_DIR, { recursive: true });

export interface ServerData {
  id: number;
  name: string;
  host: string;
  port: number;
  apiPort: number;
  location: string;
  flag: string;
  status: 'running' | 'stopped' | 'error';
  xrayVersion: string;
  realityDest: string;
  realitySNI: string;
  realityPublicKey: string;
  realityPrivateKey: string;
  realityShortIds: string[];
  cpu: number;
  ram: number;
  uptime: number;
  clientCount: number;
  totalUpload: number;
  totalDownload: number;
  uploadSpeed: number;
  downloadSpeed: number;
  createdAt: string;
  error?: string;
}

export interface ClientData {
  id: number;
  name: string;
  email: string;
  uuid: string;
  serverId: number;
  serverName: string;
  status: 'active' | 'disabled' | 'expired' | 'limited';
  flow: string;
  upload: number;
  download: number;
  totalLimit: number;
  expiryDate: string;
  createdAt: string;
  lastConnect: string;
  ip: string;
}

interface TrafficPoint {
  date: string;
  upload: number;
  download: number;
}

interface State {
  servers: ServerData[];
  clients: ClientData[];
  traffic: TrafficPoint[];
}

const DEFAULT_XRAY_VERSION = 'v25.10.15';

function loadState(): State {
  if (existsSync(DATA_FILE)) {
    try {
      const raw = readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw);
    } catch {
      // corrupt file — start fresh
    }
  }
  return { servers: [], clients: [], traffic: [] };
}

let state: State = loadState();

function save(): void {
  writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
}

export const store = {
  get servers(): ServerData[] {
    return state.servers;
  },

  get clients(): ClientData[] {
    return state.clients;
  },

  get traffic(): TrafficPoint[] {
    return state.traffic;
  },

  nextServerId(): number {
    return state.servers.length ? Math.max(...state.servers.map((s) => s.id)) + 1 : 1;
  },

  nextClientId(): number {
    return state.clients.length ? Math.max(...state.clients.map((c) => c.id)) + 1 : 1;
  },

  addServer(data: {
    name: string;
    host: string;
    port: number;
    location: string;
    flag: string;
    xrayVersion: string;
    realityDest?: string;
    realitySNI?: string;
  }): ServerData {
    const id = this.nextServerId();
    const keys = generateX25519KeyPair();
    const shortIds = generateShortIds(2);

    // Default Reality target: a popular website with TLS 1.3 and H2
    const dest = data.realityDest || 'www.microsoft.com:443';
    const sni = data.realitySNI || dest.split(':')[0];

    const server: ServerData = {
      id,
      name: data.name,
      host: data.host,
      port: data.port || 443,
      apiPort: 10000 + id, // unique API port per server
      location: data.location,
      flag: data.flag || '🌐',
      status: 'stopped',
      xrayVersion: data.xrayVersion || DEFAULT_XRAY_VERSION,
      realityDest: dest,
      realitySNI: sni,
      realityPublicKey: keys.publicKey,
      realityPrivateKey: keys.privateKey,
      realityShortIds: shortIds,
      cpu: 0,
      ram: 0,
      uptime: 100,
      clientCount: 0,
      totalUpload: 0,
      totalDownload: 0,
      uploadSpeed: 0,
      downloadSpeed: 0,
      createdAt: new Date().toISOString(),
    };

    state.servers.push(server);
    save();
    return server;
  },

  updateServer(id: number, patch: Partial<ServerData>): ServerData | null {
    const idx = state.servers.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    state.servers[idx] = { ...state.servers[idx], ...patch, id };
    save();
    return state.servers[idx];
  },

  deleteServer(id: number): void {
    state.servers = state.servers.filter((s) => s.id !== id);
    state.clients = state.clients.filter((c) => c.serverId !== id);
    save();
  },

  getServer(id: number): ServerData | undefined {
    return state.servers.find((s) => s.id === id);
  },

  addClient(data: {
    name: string;
    email: string;
    serverId: number;
    totalLimit: number;
    expiryDate: string;
  }): ClientData {
    const id = this.nextClientId();
    const server = this.getServer(data.serverId);
    const client: ClientData = {
      id,
      name: data.name,
      email: data.email,
      uuid: crypto.randomUUID(),
      serverId: data.serverId,
      serverName: server?.name || '',
      status: 'active',
      flow: 'xtls-rprx-vision',
      upload: 0,
      download: 0,
      totalLimit: data.totalLimit || 0,
      expiryDate: data.expiryDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      lastConnect: new Date().toISOString(),
      ip: '0.0.0.0',
    };

    state.clients.push(client);
    if (server) server.clientCount++;
    save();
    return client;
  },

  updateClient(id: number, patch: Partial<ClientData>): ClientData | null {
    const idx = state.clients.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    state.clients[idx] = { ...state.clients[idx], ...patch, id };
    save();
    return state.clients[idx];
  },

  deleteClient(id: number): void {
    const client = state.clients.find((c) => c.id === id);
    if (client) {
      const server = this.getServer(client.serverId);
      if (server && server.clientCount > 0) server.clientCount--;
    }
    state.clients = state.clients.filter((c) => c.id !== id);
    save();
  },

  getClientsByServer(serverId: number): ClientData[] {
    return state.clients.filter((c) => c.serverId === serverId);
  },

  updateTrafficStats(stats: Record<string, { uplink: number; downlink: number }>): void {
    for (const client of state.clients) {
      const stat = stats[client.email];
      if (stat) {
        // Stats are cumulative bytes — store as GB
        client.upload = stat.uplink / (1024 * 1024 * 1024);
        client.download = stat.downlink / (1024 * 1024 * 1024);
      }
    }
    save();
  },

  // Traffic history (for charts) — updated daily
  pushTrafficPoint(): void {
    const today = new Date().toISOString().split('T')[0];
    const totalUp = state.clients.reduce((a, c) => a + c.upload, 0);
    const totalDown = state.clients.reduce((a, c) => a + c.download, 0);

    const existing = state.traffic.find((t) => t.date === today);
    if (existing) {
      existing.upload = totalUp;
      existing.download = totalDown;
    } else {
      state.traffic.push({ date: today, upload: totalUp, download: totalDown });
      if (state.traffic.length > 90) state.traffic.shift();
    }
    save();
  },

  // Reset all server statuses to stopped (called on backend restart)
  resetStatuses(): void {
    for (const s of state.servers) {
      if (s.status === 'running') {
        s.status = 'stopped';
      }
    }
    save();
  },

  DEFAULT_XRAY_VERSION,
};
