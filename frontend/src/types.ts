export type ServerStatus = 'running' | 'stopped' | 'error';

export interface Protocol {
  id: number;
  serverId: number;
  type: 'vless';
  port: number;
  status: 'running' | 'stopped';
  clients: number;
  upload: number;
  download: number;
}

export interface Server {
  id: number;
  name: string;
  host: string;
  port: number;
  apiPort: number;
  location: string;
  flag: string;
  status: ServerStatus;
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
  protocols?: Protocol[];
}

export type ClientStatus = 'active' | 'disabled' | 'expired' | 'limited';

export interface Client {
  id: number;
  name: string;
  email: string;
  uuid: string;
  serverId: number;
  serverName: string;
  status: ClientStatus;
  flow: string;
  upload: number;
  download: number;
  totalLimit: number;
  expiryDate: string;
  createdAt: string;
  lastConnect: string;
  ip: string;
  vlessUrl: string;
}

export interface ServerListItem {
  id: number;
  name: string;
  flag: string;
  status: ServerStatus;
  cpu: number;
  ram: number;
  clientCount: number;
  uploadSpeed: number;
  downloadSpeed: number;
  ping: number;
}

export interface DashboardData {
  servers: { total: number; online: number };
  clients: { total: number; active: number };
  traffic: {
    today: { date: string; upload: number; download: number };
    month: { upload: number; download: number };
  };
  protocolDistribution: { type: string; name: string; color: string; count: number }[];
  recentTraffic: { date: string; upload: number; download: number }[];
  serversList: ServerListItem[];
  xrayVersions: { available: string[]; default: string };
}

export interface TrafficData {
  daily: { date: string; upload: number; download: number }[];
  perServer: { name: string; flag: string; upload: number; download: number }[];
  protocolDistribution: { type: string; name: string; color: string; count: number }[];
  totals: { upload: number; download: number; total: number };
}

export interface Notification {
  id: number;
  type: 'warning' | 'error' | 'info' | 'success';
  title: string;
  message: string;
  time: string;
  read: boolean;
}

export interface PingData {
  id: number;
  name: string;
  ping: number;
  status: string;
}

export interface XrayVersions {
  available: string[];
  downloaded: string[];
  default: string;
}

export const PROTOCOL_META: Record<string, { name: string; color: string }> = {
  vless: { name: 'VLESS + Reality', color: '#8B5CF6' },
};
