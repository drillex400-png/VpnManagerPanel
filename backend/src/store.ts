import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { generateX25519KeyPair, generateShortIds } from './xray/keys';
import {
  type InboundData,
  type ProtocolType,
  type NetworkType,
  type SecurityType,
  PROTOCOL_DEFAULTS,
  defaultTransportSettings,
  defaultSecuritySettings,
  generatePassword,
} from './xray/protocols';

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
  inbounds: InboundData[];
  // SSH-доступ к удалённой ноде
  sshPort: number;
  sshUser: string;
  sshAuthType: 'key' | 'password';
  sshPrivateKey: string;
  sshPassword: string;
  // Legacy fields kept for backward-compat migration (not used if inbounds exist)
  realityDest?: string;
  realitySNI?: string;
  realityPublicKey?: string;
  realityPrivateKey?: string;
  realityShortIds?: string[];
}

export { type InboundData, type ProtocolType, type NetworkType, type SecurityType };

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

interface Settings {
  defaultXrayVersion: string;
  defaultRealityDest: string;
  defaultRealitySNI: string;
  defaultTotalLimit: number;
  defaultExpiryDays: number;
}

interface State {
  servers: ServerData[];
  clients: ClientData[];
  traffic: TrafficPoint[];
  settings: Settings;
}

const DEFAULT_XRAY_VERSION = 'v25.10.15';

const DEFAULT_SETTINGS: Settings = {
  defaultXrayVersion: DEFAULT_XRAY_VERSION,
  defaultRealityDest: 'www.microsoft.com:443',
  defaultRealitySNI: 'www.microsoft.com',
  defaultTotalLimit: 0,
  defaultExpiryDays: 30,
};

// ── Migration: convert legacy Reality fields to an inbound ─────────────

function migrateServer(server: any): ServerData {
  if (server.inbounds && server.inbounds.length > 0) {
    return server as ServerData;
  }
  // Create a VLESS+Reality inbound from legacy fields
  const keys = server.realityPublicKey
    ? { publicKey: server.realityPublicKey, privateKey: server.realityPrivateKey || '' }
    : generateX25519KeyPair();
  const shortIds = server.realityShortIds?.length
    ? server.realityShortIds
    : generateShortIds(2);

  const inbound: InboundData = {
    id: 1,
    serverId: server.id,
    tag: 'vless-reality',
    protocol: 'vless',
    listen: '0.0.0.0',
    port: server.port || 443,
    network: 'tcp',
    security: 'reality',
    protocolSettings: { flow: 'xtls-rprx-vision' },
    transportSettings: { headerType: 'none' },
    securitySettings: {
      dest: server.realityDest || 'www.microsoft.com:443',
      serverNames: server.realitySNI || 'www.microsoft.com',
      privateKey: keys.privateKey,
      shortIds: shortIds.join(', '),
      fingerprint: 'chrome',
      xver: 0,
      show: false,
      maxTimeDiff: 0,
    },
    sniffing: { enabled: true, destOverride: ['http', 'tls'] },
    createdAt: server.createdAt || new Date().toISOString(),
  };

  return {
    ...server,
    inbounds: [inbound],
    realityPublicKey: keys.publicKey, // keep for URL generation compat
    sshPort: server.sshPort || 22,
    sshUser: server.sshUser || 'root',
    sshAuthType: server.sshAuthType || 'password',
    sshPrivateKey: server.sshPrivateKey || '',
    sshPassword: server.sshPassword || '',
  } as ServerData;
}

function loadState(): State {
  if (existsSync(DATA_FILE)) {
    try {
      const raw = readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (!parsed.settings) parsed.settings = DEFAULT_SETTINGS;
      // Migrate legacy servers
      if (parsed.servers) {
        parsed.servers = parsed.servers.map(migrateServer);
      }
      return parsed;
    } catch {
      // corrupt file — start fresh
    }
  }
  return {
    servers: [],
    clients: [],
    traffic: [],
    settings: { ...DEFAULT_SETTINGS },
  };
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

  get settings(): Settings {
    return state.settings;
  },

  updateSettings(patch: Partial<Settings>): Settings {
    state.settings = { ...state.settings, ...patch };
    save();
    return state.settings;
  },

  nextServerId(): number {
    return state.servers.length ? Math.max(...state.servers.map((s) => s.id)) + 1 : 1;
  },

  nextClientId(): number {
    return state.clients.length ? Math.max(...state.clients.map((c) => c.id)) + 1 : 1;
  },

  nextInboundId(serverId: number): number {
    const server = state.servers.find((s) => s.id === serverId);
    if (!server || !server.inbounds) return 1;
    return server.inbounds.length ? Math.max(...server.inbounds.map((i) => i.id)) + 1 : 1;
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
    sshPort?: number;
    sshUser?: string;
    sshAuthType?: 'key' | 'password';
    sshPrivateKey?: string;
    sshPassword?: string;
  }): ServerData {
    const id = this.nextServerId();
    const dest = data.realityDest || 'www.microsoft.com:443';
    const sni = data.realitySNI || dest.split(':')[0];
    const keys = generateX25519KeyPair();
    const shortIds = generateShortIds(2);

    // Create default VLESS+Reality inbound
    const inbound: InboundData = {
      id: 1,
      serverId: id,
      tag: `inbound-${id}-1`,
      protocol: 'vless',
      listen: '0.0.0.0',
      port: data.port || 443,
      network: 'tcp',
      security: 'reality',
      protocolSettings: { flow: 'xtls-rprx-vision' },
      transportSettings: { headerType: 'none' },
      securitySettings: {
        dest,
        serverNames: sni,
        privateKey: keys.privateKey,
        shortIds: shortIds.join(', '),
        fingerprint: 'chrome',
        xver: 0,
        show: false,
        maxTimeDiff: 0,
      },
      sniffing: { enabled: true, destOverride: ['http', 'tls'] },
      createdAt: new Date().toISOString(),
    };

    const server: ServerData = {
      id,
      name: data.name,
      host: data.host,
      port: data.port || 443,
      apiPort: 10000 + id,
      location: data.location,
      flag: data.flag || '🌐',
      status: 'stopped',
      xrayVersion: data.xrayVersion || DEFAULT_XRAY_VERSION,
      cpu: 0,
      ram: 0,
      uptime: 100,
      clientCount: 0,
      totalUpload: 0,
      totalDownload: 0,
      uploadSpeed: 0,
      downloadSpeed: 0,
      createdAt: new Date().toISOString(),
      inbounds: [inbound],
      realityPublicKey: keys.publicKey,
      sshPort: data.sshPort || 22,
      sshUser: data.sshUser || 'root',
      sshAuthType: data.sshAuthType || 'password',
      sshPrivateKey: data.sshPrivateKey || '',
      sshPassword: data.sshPassword || '',
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

  // ── Inbound CRUD ────────────────────────────────────────────────────

  addInbound(serverId: number, data: {
    protocol: ProtocolType;
    port: number;
    network?: NetworkType;
    security?: SecurityType;
    protocolSettings?: Record<string, any>;
    transportSettings?: Record<string, any>;
    securitySettings?: Record<string, any>;
  }): InboundData | null {
    const server = state.servers.find((s) => s.id === serverId);
    if (!server) return null;

    const defaults = PROTOCOL_DEFAULTS[data.protocol];
    const network = data.network || defaults.network;
    const security = data.security || defaults.security;

    // For reality security, auto-generate keys if not provided
    let securitySettings = data.securitySettings || defaultSecuritySettings(security);
    if (security === 'reality' && !securitySettings.privateKey) {
      const keys = generateX25519KeyPair();
      const shortIds = generateShortIds(2);
      securitySettings = {
        ...securitySettings,
        privateKey: keys.privateKey,
        shortIds: shortIds.join(', '),
      };
    }

    // For shadowsocks, auto-generate password if not provided
    let protocolSettings = data.protocolSettings || defaults.protocolSettings;
    if (data.protocol === 'shadowsocks' && !protocolSettings.password) {
      protocolSettings = { ...protocolSettings, password: generatePassword() };
    }

    const inboundId = this.nextInboundId(serverId);
    const inbound: InboundData = {
      id: inboundId,
      serverId,
      tag: `inbound-${serverId}-${inboundId}`,
      protocol: data.protocol,
      listen: '0.0.0.0',
      port: data.port,
      network,
      security,
      protocolSettings,
      transportSettings: data.transportSettings || defaultTransportSettings(network),
      securitySettings,
      sniffing: { enabled: true, destOverride: ['http', 'tls'] },
      createdAt: new Date().toISOString(),
    };

    if (!server.inbounds) server.inbounds = [];
    server.inbounds.push(inbound);
    save();
    return inbound;
  },

  updateInbound(serverId: number, inboundId: number, patch: Partial<InboundData>): InboundData | null {
    const server = state.servers.find((s) => s.id === serverId);
    if (!server || !server.inbounds) return null;
    const idx = server.inbounds.findIndex((i) => i.id === inboundId);
    if (idx === -1) return null;
    server.inbounds[idx] = { ...server.inbounds[idx], ...patch, id: inboundId, serverId };
    save();
    return server.inbounds[idx];
  },

  deleteInbound(serverId: number, inboundId: number): boolean {
    const server = state.servers.find((s) => s.id === serverId);
    if (!server || !server.inbounds) return false;
    const before = server.inbounds.length;
    server.inbounds = server.inbounds.filter((i) => i.id !== inboundId);
    if (server.inbounds.length !== before) {
      save();
      return true;
    }
    return false;
  },

  getInbounds(serverId: number): InboundData[] {
    const server = state.servers.find((s) => s.id === serverId);
    return server?.inbounds || [];
  },

  // Keep the public key accessible for backward-compat URL generation
  getRealityPublicKey(serverId: number): string {
    const server = state.servers.find((s) => s.id === serverId);
    if (!server) return '';
    // Check if legacy field exists
    if (server.realityPublicKey) return server.realityPublicKey;
    // Derive from first reality inbound
    const realityInbound = server.inbounds?.find((i) => i.security === 'reality');
    if (realityInbound) {
      // We stored the private key; the public key was used for URLs.
      // In practice, clients use the publicKey from the share URL.
      // We keep the legacy field for this purpose.
    }
    return '';
  },

  regenerateServerKeys(id: number): ServerData | null {
    const idx = state.servers.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    const keys = generateX25519KeyPair();
    const shortIds = generateShortIds(2);
    // Update legacy fields
    state.servers[idx].realityPublicKey = keys.publicKey;
    state.servers[idx].realityPrivateKey = keys.privateKey;
    state.servers[idx].realityShortIds = shortIds;
    // Update all reality inbounds
    if (state.servers[idx].inbounds) {
      for (const inbound of state.servers[idx].inbounds) {
        if (inbound.security === 'reality') {
          inbound.securitySettings = {
            ...inbound.securitySettings,
            privateKey: keys.privateKey,
            shortIds: shortIds.join(', '),
          };
        }
      }
    }
    save();
    return state.servers[idx];
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

  resetClientStats(id: number): ClientData | null {
    const idx = state.clients.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    state.clients[idx] = { ...state.clients[idx], upload: 0, download: 0 };
    save();
    return state.clients[idx];
  },

  getClientsByServer(serverId: number): ClientData[] {
    return state.clients.filter((c) => c.serverId === serverId);
  },

  updateTrafficStats(stats: Record<string, { uplink: number; downlink: number }>): void {
    for (const client of state.clients) {
      const stat = stats[client.email];
      if (stat) {
        client.upload = stat.uplink / (1024 * 1024 * 1024);
        client.download = stat.downlink / (1024 * 1024 * 1024);
      }
    }
    save();
  },

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

  resetStatuses(): void {
    for (const s of state.servers) {
      if (s.status === 'running') s.status = 'stopped';
    }
    save();
  },

  DEFAULT_XRAY_VERSION,
};
