export type ServerStatus = 'online' | 'offline' | 'maintenance';
export type ProtocolType = 'vless' | 'vmess' | 'trojan' | 'shadowsocks' | 'wireguard' | 'hysteria2' | 'tuic';
export type ClientStatus = 'active' | 'disabled' | 'expired' | 'limited';

export interface Protocol {
  id: number;
  serverId: number;
  type: ProtocolType;
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
  location: string;
  flag: string;
  status: ServerStatus;
  uptime: number;
  cpu: number;
  ram: number;
  ramTotal: number;
  disk: number;
  diskTotal: number;
  uploadSpeed: number;
  downloadSpeed: number;
  clientCount: number;
  totalUpload: number;
  totalDownload: number;
  createdAt: string;
  protocols?: Protocol[];
}

export interface Client {
  id: number;
  name: string;
  email: string;
  uuid: string;
  serverId: number;
  serverName: string;
  protocol: ProtocolType;
  status: ClientStatus;
  upload: number;
  download: number;
  totalLimit: number;
  expiryDate: string;
  subscriptionUrl: string;
  createdAt: string;
  lastConnect: string;
  ip: string;
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
}

export interface DashboardData {
  servers: { total: number; online: number };
  clients: { total: number; active: number };
  traffic: {
    today: { date: string; upload: number; download: number };
    month: { upload: number; download: number };
  };
  protocolDistribution: { type: ProtocolType; name: string; color: string; count: number }[];
  recentTraffic: { date: string; upload: number; download: number }[];
  serversList: ServerListItem[];
}

export interface TrafficData {
  daily: { date: string; upload: number; download: number }[];
  perServer: { name: string; flag: string; upload: number; download: number }[];
  protocolDistribution: { type: ProtocolType; name: string; color: string; count: number }[];
  totals: { upload: number; download: number; total: number };
}

export const PROTOCOL_META: Record<ProtocolType, { name: string; color: string }> = {
  vless: { name: 'VLESS + Reality', color: '#8B5CF6' },
  vmess: { name: 'VMess', color: '#3B82F6' },
  trojan: { name: 'Trojan', color: '#F97316' },
  shadowsocks: { name: 'Shadowsocks', color: '#06B6D4' },
  wireguard: { name: 'WireGuard', color: '#EF4444' },
  hysteria2: { name: 'Hysteria2', color: '#F59E0B' },
  tuic: { name: 'TUIC v5', color: '#10B981' },
};

export const PROTOCOL_TYPES: ProtocolType[] = ['vless', 'vmess', 'trojan', 'shadowsocks', 'wireguard', 'hysteria2', 'tuic'];
