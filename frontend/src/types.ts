import type { ProtocolType, NetworkType, SecurityType } from './protocols';

export type ServerStatus = 'running' | 'stopped' | 'error';

export interface Inbound {
  id: number;
  serverId: number;
  tag: string;
  protocol: ProtocolType;
  listen: string;
  port: number;
  network: NetworkType;
  security: SecurityType;
  protocolSettings: Record<string, any>;
  transportSettings: Record<string, any>;
  securitySettings: Record<string, any>;
  sniffing: { enabled: boolean; destOverride: string[] };
  createdAt: string;
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
  cpu: number;
  ram: number;
  disk: number;
  uptime: number;
  clientCount: number;
  totalUpload: number;
  totalDownload: number;
  uploadSpeed: number;
  downloadSpeed: number;
  createdAt: string;
  error?: string;
  inbounds: Inbound[];
  // SSH-доступ к ноде
  sshPort: number;
  sshUser: string;
  sshAuthType: 'key' | 'password';
  sshPrivateKey: string;
  sshPassword: string;
  realityPublicKey?: string;
  // Legacy fields
  realityDest?: string;
  realitySNI?: string;
}

export type ClientStatus = 'active' | 'disabled' | 'expired' | 'limited';

export interface ShareUrl {
  protocol: string;
  url: string;
}

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
  subUrl?: string;
  shareUrls?: ShareUrl[];
}

export interface ServerListItem {
  id: number;
  name: string;
  flag: string;
  status: ServerStatus;
  cpu: number;
  ram: number;
  disk: number;
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

export interface Settings {
  defaultXrayVersion: string;
  defaultRealityDest: string;
  defaultRealitySNI: string;
  defaultTotalLimit: number;
  defaultExpiryDays: number;
  adminUser: string;
  adminPassword: string;
  autoLimitEnabled: boolean;
}

export interface ServerLogs {
  logs: string[];
}

export interface ServerConfig {
  config: string;
  filename: string;
}

export { type ProtocolType, type NetworkType, type SecurityType };
