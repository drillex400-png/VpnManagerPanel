import express from 'express';
import cors from 'cors';
import crypto from 'crypto';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT) || 3001;

// ===== Types =====
type ServerStatus = 'online' | 'offline' | 'maintenance';
type ProtocolType = 'vless' | 'vmess' | 'trojan' | 'shadowsocks' | 'wireguard' | 'hysteria2' | 'tuic';
type ClientStatus = 'active' | 'disabled' | 'expired' | 'limited';

interface Server {
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
}

interface Protocol {
  id: number;
  serverId: number;
  type: ProtocolType;
  port: number;
  status: 'running' | 'stopped';
  clients: number;
  upload: number;
  download: number;
}

interface Client {
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

interface TrafficPoint {
  date: string;
  upload: number;
  download: number;
}

// ===== Protocol Metadata =====
const PROTOCOL_META: Record<string, { name: string; color: string }> = {
  vless: { name: 'VLESS + Reality', color: '#8B5CF6' },
  vmess: { name: 'VMess', color: '#3B82F6' },
  trojan: { name: 'Trojan', color: '#F97316' },
  shadowsocks: { name: 'Shadowsocks', color: '#06B6D4' },
  wireguard: { name: 'WireGuard', color: '#EF4444' },
  hysteria2: { name: 'Hysteria2', color: '#F59E0B' },
  tuic: { name: 'TUIC v5', color: '#10B981' },
};

// ===== Seed Data =====
let servers: Server[] = [
  { id: 1, name: 'Frankfurt-01', host: 'de-fra-01.vpnctrl.net', port: 443, location: 'Frankfurt, Germany', flag: '🇩🇪', status: 'online', uptime: 99.98, cpu: 34, ram: 58, ramTotal: 8, disk: 42, diskTotal: 160, uploadSpeed: 245.8, downloadSpeed: 890.3, clientCount: 18, totalUpload: 1234.5, totalDownload: 5678.9, createdAt: '2025-08-15T10:00:00Z' },
  { id: 2, name: 'Amsterdam-01', host: 'nl-ams-01.vpnctrl.net', port: 443, location: 'Amsterdam, Netherlands', flag: '🇳🇱', status: 'online', uptime: 99.95, cpu: 22, ram: 45, ramTotal: 16, disk: 28, diskTotal: 320, uploadSpeed: 180.4, downloadSpeed: 620.7, clientCount: 12, totalUpload: 890.2, totalDownload: 3456.7, createdAt: '2025-09-01T12:00:00Z' },
  { id: 3, name: 'Tokyo-01', host: 'jp-tyo-01.vpnctrl.net', port: 443, location: 'Tokyo, Japan', flag: '🇯🇵', status: 'online', uptime: 99.89, cpu: 45, ram: 62, ramTotal: 8, disk: 51, diskTotal: 160, uploadSpeed: 310.2, downloadSpeed: 1020.5, clientCount: 9, totalUpload: 567.8, totalDownload: 2345.6, createdAt: '2025-09-20T08:00:00Z' },
  { id: 4, name: 'NewYork-01', host: 'us-nyc-01.vpnctrl.net', port: 443, location: 'New York, USA', flag: '🇺🇸', status: 'maintenance', uptime: 98.50, cpu: 0, ram: 0, ramTotal: 16, disk: 35, diskTotal: 320, uploadSpeed: 0, downloadSpeed: 0, clientCount: 5, totalUpload: 234.5, totalDownload: 1234.5, createdAt: '2025-07-10T14:00:00Z' },
  { id: 5, name: 'Singapore-01', host: 'sg-sin-01.vpnctrl.net', port: 443, location: 'Singapore', flag: '🇸🇬', status: 'online', uptime: 99.92, cpu: 28, ram: 51, ramTotal: 8, disk: 38, diskTotal: 160, uploadSpeed: 195.6, downloadSpeed: 715.3, clientCount: 3, totalUpload: 345.6, totalDownload: 1567.8, createdAt: '2025-10-01T09:00:00Z' },
];

let protocols: Protocol[] = [
  { id: 1, serverId: 1, type: 'vless', port: 443, status: 'running', clients: 8, upload: 234.5, download: 1234.5 },
  { id: 2, serverId: 1, type: 'vmess', port: 8080, status: 'running', clients: 6, upload: 456.7, download: 2345.6 },
  { id: 3, serverId: 1, type: 'trojan', port: 8443, status: 'running', clients: 4, upload: 123.4, download: 567.8 },
  { id: 4, serverId: 2, type: 'shadowsocks', port: 8388, status: 'running', clients: 5, upload: 234.5, download: 1234.5 },
  { id: 5, serverId: 2, type: 'wireguard', port: 51820, status: 'running', clients: 4, upload: 345.6, download: 1567.8 },
  { id: 6, serverId: 2, type: 'hysteria2', port: 2000, status: 'running', clients: 3, upload: 123.4, download: 456.7 },
  { id: 7, serverId: 3, type: 'vless', port: 443, status: 'running', clients: 5, upload: 234.5, download: 1234.5 },
  { id: 8, serverId: 3, type: 'vmess', port: 8080, status: 'running', clients: 4, upload: 123.4, download: 567.8 },
  { id: 9, serverId: 4, type: 'trojan', port: 8443, status: 'stopped', clients: 3, upload: 123.4, download: 567.8 },
  { id: 10, serverId: 4, type: 'shadowsocks', port: 8388, status: 'stopped', clients: 2, upload: 45.6, download: 234.5 },
  { id: 11, serverId: 5, type: 'vless', port: 443, status: 'running', clients: 2, upload: 123.4, download: 567.8 },
  { id: 12, serverId: 5, type: 'hysteria2', port: 2000, status: 'running', clients: 1, upload: 45.6, download: 234.5 },
];

const clientNames = [
  { name: 'Alex Chen', email: 'alex.chen@email.com' },
  { name: 'Maria Garcia', email: 'maria.g@email.com' },
  { name: 'Yuki Tanaka', email: 'y.tanaka@email.com' },
  { name: 'John Smith', email: 'j.smith@email.com' },
  { name: 'Sofia Müller', email: 's.mueller@email.com' },
  { name: 'David Kim', email: 'd.kim@email.com' },
  { name: 'Emma Wilson', email: 'emma.w@email.com' },
  { name: 'Liu Wei', email: 'liu.wei@email.com' },
  { name: 'Oliver Brown', email: 'o.brown@email.com' },
  { name: 'Anna Kowalski', email: 'a.kowalski@email.com' },
  { name: 'Raj Patel', email: 'r.patel@email.com' },
  { name: 'Sophie Martin', email: 's.martin@email.com' },
  { name: 'Tom Anderson', email: 't.anderson@email.com' },
  { name: 'Lena Petrova', email: 'l.petrova@email.com' },
  { name: 'Carlos Silva', email: 'c.silva@email.com' },
];

const clientStatuses: ClientStatus[] = ['active', 'active', 'active', 'active', 'active', 'active', 'active', 'disabled', 'expired', 'limited', 'active', 'disabled', 'expired', 'active', 'limited'];
const protoTypes: ProtocolType[] = ['vless', 'vmess', 'trojan', 'shadowsocks', 'wireguard', 'hysteria2', 'tuic'];

let clients: Client[] = clientNames.map((c, i) => {
  const server = servers[i % servers.length];
  const proto = protocols[i % protocols.length];
  const status = clientStatuses[i];
  const daysOffset = Math.floor(Math.random() * 80) - 30;
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + daysOffset);
  const created = new Date();
  created.setDate(created.getDate() - Math.floor(Math.random() * 90 + 10));
  const lastConnect = new Date();
  lastConnect.setHours(lastConnect.getHours() - Math.floor(Math.random() * 48));

  const upload = Math.round(Math.random() * 500 * 10) / 10;
  const download = Math.round(Math.random() * 2000 * 10) / 10;
  const totalLimit = [0, 50, 100, 200, 500][i % 5];

  return {
    id: i + 1,
    name: c.name,
    email: c.email,
    uuid: crypto.randomUUID(),
    serverId: server.id,
    serverName: server.name,
    protocol: proto.type,
    status,
    upload,
    download,
    totalLimit,
    expiryDate: expiry.toISOString().split('T')[0],
    subscriptionUrl: `https://sub.vpnctrl.net/${crypto.randomUUID().slice(0, 8)}`,
    createdAt: created.toISOString(),
    lastConnect: lastConnect.toISOString(),
    ip: `${10 + Math.floor(Math.random() * 50)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
  };
});

function generateTraffic(days: number): TrafficPoint[] {
  const data: TrafficPoint[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const baseUpload = 40 + Math.random() * 120;
    const baseDownload = 120 + Math.random() * 250;
    const weekendMult = isWeekend ? 0.65 : 1;
    const trendMult = 1 + (days - i) / days * 0.3;
    data.push({
      date: date.toISOString().split('T')[0],
      upload: Math.round(baseUpload * weekendMult * trendMult * 10) / 10,
      download: Math.round(baseDownload * weekendMult * trendMult * 10) / 10,
    });
  }
  return data;
}

let traffic = generateTraffic(90);

// ===== Helpers =====
const nextId = (arr: { id: number }[]) => (arr.length ? Math.max(...arr.map((x) => x.id)) + 1 : 1);

// ===== Routes =====

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Dashboard
app.get('/api/dashboard', (_req, res) => {
  const onlineServers = servers.filter((s) => s.status === 'online').length;
  const activeClients = clients.filter((c) => c.status === 'active').length;
  const todayTraffic = traffic[traffic.length - 1];
  const monthTraffic = traffic.slice(-30).reduce(
    (acc, t) => ({ upload: acc.upload + t.upload, download: acc.download + t.download }),
    { upload: 0, download: 0 },
  );

  const protoDist: Record<string, number> = {};
  protocols.filter((p) => p.status === 'running').forEach((p) => {
    protoDist[p.type] = (protoDist[p.type] || 0) + p.clients;
  });

  res.json({
    servers: { total: servers.length, online: onlineServers },
    clients: { total: clients.length, active: activeClients },
    traffic: { today: todayTraffic, month: monthTraffic },
    protocolDistribution: Object.entries(protoDist)
      .map(([type, count]) => ({
        type,
        name: PROTOCOL_META[type]?.name || type,
        color: PROTOCOL_META[type]?.color || '#888',
        count,
      }))
      .sort((a, b) => b.count - a.count),
    recentTraffic: traffic.slice(-7),
    serversList: servers.map((s) => ({
      id: s.id,
      name: s.name,
      flag: s.flag,
      status: s.status,
      cpu: s.cpu,
      ram: s.ram,
      clientCount: s.clientCount,
      uploadSpeed: s.uploadSpeed,
      downloadSpeed: s.downloadSpeed,
    })),
  });
});

// Servers
app.get('/api/servers', (_req, res) => {
  const result = servers.map((s) => ({
    ...s,
    protocols: protocols.filter((p) => p.serverId === s.id),
  }));
  res.json(result);
});

app.post('/api/servers', (req, res) => {
  const { name, host, port, location, flag } = req.body;
  const id = nextId(servers);
  const server: Server = {
    id,
    name,
    host,
    port: port || 443,
    location,
    flag: flag || '🌐',
    status: 'online',
    uptime: 100,
    cpu: 0,
    ram: 0,
    ramTotal: 8,
    disk: 0,
    diskTotal: 160,
    uploadSpeed: 0,
    downloadSpeed: 0,
    clientCount: 0,
    totalUpload: 0,
    totalDownload: 0,
    createdAt: new Date().toISOString(),
  };
  servers.push(server);
  res.status(201).json(server);
});

app.put('/api/servers/:id', (req, res) => {
  const id = Number(req.params.id);
  const idx = servers.findIndex((s) => s.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Server not found' });
  servers[idx] = { ...servers[idx], ...req.body, id };
  res.json(servers[idx]);
});

app.delete('/api/servers/:id', (req, res) => {
  const id = Number(req.params.id);
  servers = servers.filter((s) => s.id !== id);
  protocols = protocols.filter((p) => p.serverId !== id);
  res.json({ success: true });
});

// Protocols
app.post('/api/servers/:id/protocols', (req, res) => {
  const serverId = Number(req.params.id);
  const { type, port } = req.body;
  const id = nextId(protocols);
  const proto: Protocol = {
    id,
    serverId,
    type,
    port,
    status: 'running',
    clients: 0,
    upload: 0,
    download: 0,
  };
  protocols.push(proto);
  res.status(201).json(proto);
});

app.delete('/api/protocols/:id', (req, res) => {
  const id = Number(req.params.id);
  protocols = protocols.filter((p) => p.id !== id);
  res.json({ success: true });
});

// Clients
app.get('/api/clients', (_req, res) => {
  res.json(clients);
});

app.post('/api/clients', (req, res) => {
  const { name, email, serverId, protocol, totalLimit, expiryDate } = req.body;
  const server = servers.find((s) => s.id === serverId);
  const id = nextId(clients);
  const client: Client = {
    id,
    name,
    email,
    uuid: crypto.randomUUID(),
    serverId,
    serverName: server?.name || '',
    protocol,
    status: 'active',
    upload: 0,
    download: 0,
    totalLimit: totalLimit || 0,
    expiryDate: expiryDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    subscriptionUrl: `https://sub.vpnctrl.net/${crypto.randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
    lastConnect: new Date().toISOString(),
    ip: '0.0.0.0',
  };
  clients.push(client);
  if (server) server.clientCount++;
  res.status(201).json(client);
});

app.put('/api/clients/:id', (req, res) => {
  const id = Number(req.params.id);
  const idx = clients.findIndex((c) => c.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Client not found' });
  clients[idx] = { ...clients[idx], ...req.body, id };
  res.json(clients[idx]);
});

app.delete('/api/clients/:id', (req, res) => {
  const id = Number(req.params.id);
  const client = clients.find((c) => c.id === id);
  if (client) {
    const server = servers.find((s) => s.id === client.serverId);
    if (server && server.clientCount > 0) server.clientCount--;
  }
  clients = clients.filter((c) => c.id !== id);
  res.json({ success: true });
});

// Traffic
app.get('/api/traffic', (req, res) => {
  const days = Number(req.query.days) || 30;
  const sliced = traffic.slice(-days);
  const totals = sliced.reduce(
    (acc, t) => ({ upload: acc.upload + t.upload, download: acc.download + t.download }),
    { upload: 0, download: 0 },
  );
  const perServer = servers.map((s) => ({
    name: s.name,
    flag: s.flag,
    upload: s.totalUpload,
    download: s.totalDownload,
  }));
  const protoDist: Record<string, number> = {};
  protocols.filter((p) => p.status === 'running').forEach((p) => {
    protoDist[p.type] = (protoDist[p.type] || 0) + p.clients;
  });
  res.json({
    daily: sliced,
    perServer,
    protocolDistribution: Object.entries(protoDist)
      .map(([type, count]) => ({
        type,
        name: PROTOCOL_META[type]?.name || type,
        color: PROTOCOL_META[type]?.color || '#888',
        count,
      }))
      .sort((a, b) => b.count - a.count),
    totals: { upload: totals.upload, download: totals.download, total: totals.upload + totals.download },
  });
});

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
