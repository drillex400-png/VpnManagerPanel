import express from 'express';
import cors from 'cors';
import { store } from './store';
import {
  listAvailableVersions,
  listLocalVersions,
  downloadVersion,
  startServer,
  stopServer,
  restartServer,
  isServerRunning,
  queryStats,
  tcpPing,
  resetProcesses,
  getServerLogs,
  clearServerLogs,
  getServerConfigPath,
} from './xray/manager';
import { readFileSync } from 'fs';
import { generateShareUrl } from './xray/share';
import type { ServerData, ClientData, InboundData } from './store';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT) || 3001;

resetProcesses();
store.resetStatuses();

// Periodically poll stats from running servers
setInterval(async () => {
  for (const server of store.servers) {
    if (isServerRunning(server.id)) {
      const stats = queryStats(server.apiPort);
      if (Object.keys(stats).length > 0) {
        store.updateTrafficStats(stats);
      }
    }
  }
}, 10000);

setInterval(() => store.pushTrafficPoint(), 3600000);
store.pushTrafficPoint();

// ===== Helpers =====

function clientWithUrls(c: ClientData): ClientData & { vlessUrl: string; shareUrls: { protocol: string; url: string }[] } {
  const server = store.getServer(c.serverId);
  if (!server) return { ...c, vlessUrl: '', shareUrls: [] };

  const inbounds = server.inbounds || [];
  const shareUrls = inbounds
    .filter((inbound) => inbound.protocol !== 'dokodemo-door')
    .map((inbound) => {
      const ss = { ...inbound.securitySettings };
      // Inject the public key for VLESS+Reality URLs
      if (inbound.security === 'reality' && server.realityPublicKey) {
        ss._publicKey = server.realityPublicKey;
      }
      const url = generateShareUrl({
        protocol: inbound.protocol,
        uuid: c.uuid,
        host: server.host,
        port: inbound.port,
        network: inbound.network,
        security: inbound.security,
        securitySettings: ss,
        transportSettings: inbound.transportSettings,
        protocolSettings: inbound.protocolSettings,
        name: c.name,
      });
      return { protocol: inbound.protocol, url };
    })
    .filter((s) => s.url);

  // Primary URL for backward compat (first non-empty)
  const primary = shareUrls[0]?.url || '';

  return { ...c, vlessUrl: primary, shareUrls };
}

function serverWithRunning(s: ServerData): ServerData {
  return { ...s, status: isServerRunning(s.id) ? 'running' : s.status === 'error' ? 'error' : 'stopped' };
}

// ===== Routes =====

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Xray versions
app.get('/api/xray/versions', async (_req, res) => {
  try {
    const remote = await listAvailableVersions();
    const local = listLocalVersions();
    res.json({ available: remote, downloaded: local, default: store.DEFAULT_XRAY_VERSION });
  } catch {
    res.json({ available: listLocalVersions(), downloaded: listLocalVersions(), default: store.DEFAULT_XRAY_VERSION });
  }
});

app.post('/api/xray/download', async (req, res) => {
  const { version } = req.body;
  if (!version) return res.status(400).json({ error: 'Version required' });
  try {
    await downloadVersion(version);
    res.json({ success: true, version });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// Dashboard
app.get('/api/dashboard', (_req, res) => {
  const servers = store.servers.map(serverWithRunning);
  const runningServers = servers.filter((s) => s.status === 'running').length;
  const activeClients = store.clients.filter((c) => c.status === 'active').length;

  const traffic = store.traffic;
  const todayTraffic = traffic[traffic.length - 1] || { date: '', upload: 0, download: 0 };
  const monthTraffic = traffic.slice(-30).reduce(
    (acc, t) => ({ upload: acc.upload + t.upload, download: acc.download + t.download }),
    { upload: 0, download: 0 },
  );

  // Protocol distribution from all inbounds
  const protoMap = new Map<string, number>();
  for (const s of store.servers) {
    for (const ib of s.inbounds || []) {
      protoMap.set(ib.protocol, (protoMap.get(ib.protocol) || 0) + s.clientCount);
    }
  }
  const protoColors: Record<string, string> = {
    vless: '#8B5CF6', vmess: '#06B6D4', trojan: '#F59E0B',
    shadowsocks: '#10B981', socks: '#EF4444', http: '#EC4899',
    'dokodemo-door': '#6366F1',
  };
  const protoNames: Record<string, string> = {
    vless: 'VLESS', vmess: 'VMess', trojan: 'Trojan',
    shadowsocks: 'Shadowsocks', socks: 'SOCKS', http: 'HTTP',
    'dokodemo-door': 'Dokodemo',
  };
  const protocolDistribution = Array.from(protoMap.entries()).map(([type, count]) => ({
    type, name: protoNames[type] || type, color: protoColors[type] || '#888', count,
  }));
  if (protocolDistribution.length === 0) {
    protocolDistribution.push({ type: 'vless', name: 'VLESS', color: '#8B5CF6', count: 0 });
  }

  res.json({
    servers: { total: servers.length, online: runningServers },
    clients: { total: store.clients.length, active: activeClients },
    traffic: { today: todayTraffic, month: monthTraffic },
    protocolDistribution,
    recentTraffic: traffic.slice(-7),
    serversList: servers.map((s) => ({
      id: s.id, name: s.name, flag: s.flag, status: s.status,
      cpu: s.cpu, ram: s.ram, clientCount: s.clientCount,
      uploadSpeed: s.uploadSpeed, downloadSpeed: s.downloadSpeed, ping: 0,
    })),
    xrayVersions: { available: listLocalVersions(), default: store.DEFAULT_XRAY_VERSION },
  });
});

// Servers
app.get('/api/servers', (_req, res) => {
  const result = store.servers.map((s) => ({
    ...serverWithRunning(s),
    protocols: (s.inbounds || []).map((ib) => ({
      id: ib.id, serverId: s.id, type: ib.protocol, port: ib.port,
      network: ib.network, security: ib.security,
      status: s.status === 'running' ? 'running' : 'stopped',
      clients: s.clientCount, upload: s.totalUpload, download: s.totalDownload,
    })),
  }));
  res.json(result);
});

app.post('/api/servers', (req, res) => {
  const { name, host, port, location, flag, xrayVersion, realityDest, realitySNI } = req.body;
  if (!name || !host) return res.status(400).json({ error: 'Name and host required' });
  const server = store.addServer({
    name, host, port: port || 443, location: location || '',
    flag: flag || '🌐', xrayVersion: xrayVersion || store.DEFAULT_XRAY_VERSION,
    realityDest, realitySNI,
  });
  res.status(201).json(server);
});

app.put('/api/servers/:id', (req, res) => {
  const id = Number(req.params.id);
  const updated = store.updateServer(id, req.body);
  if (!updated) return res.status(404).json({ error: 'Server not found' });
  res.json(updated);
});

app.delete('/api/servers/:id', (req, res) => {
  const id = Number(req.params.id);
  stopServer(id);
  store.deleteServer(id);
  res.json({ success: true });
});

app.post('/api/servers/:id/start', async (req, res) => {
  const id = Number(req.params.id);
  const server = store.getServer(id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  const clients = store.getClientsByServer(id);
  const result = await startServer(server, clients);
  if (result.ok) store.updateServer(id, { status: 'running', error: undefined });
  else store.updateServer(id, { status: 'error', error: result.error });
  res.json({ success: result.ok, error: result.error });
});

app.post('/api/servers/:id/stop', (req, res) => {
  const id = Number(req.params.id);
  stopServer(id);
  store.updateServer(id, { status: 'stopped' });
  res.json({ success: true });
});

app.post('/api/servers/:id/restart', async (req, res) => {
  const id = Number(req.params.id);
  const server = store.getServer(id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  const clients = store.getClientsByServer(id);
  const result = await restartServer(server, clients);
  if (result.ok) store.updateServer(id, { status: 'running', error: undefined });
  else store.updateServer(id, { status: 'error', error: result.error });
  res.json({ success: result.ok, error: result.error });
});

app.post('/api/servers/:id/regenerate-keys', (req, res) => {
  const id = Number(req.params.id);
  const server = store.getServer(id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  const updated = store.regenerateServerKeys(id);
  res.json({ success: true, server: updated });
});

app.get('/api/servers/:id/logs', (req, res) => {
  res.json({ logs: getServerLogs(Number(req.params.id)) });
});

app.delete('/api/servers/:id/logs', (req, res) => {
  clearServerLogs(Number(req.params.id));
  res.json({ success: true });
});

app.get('/api/servers/:id/config', (req, res) => {
  const id = Number(req.params.id);
  const server = store.getServer(id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  const clients = store.getClientsByServer(id);
  const configPath = getServerConfigPath(server, clients);
  try {
    const config = readFileSync(configPath, 'utf-8');
    res.json({ config, filename: `server-${id}-config.json` });
  } catch {
    res.status(500).json({ error: 'Failed to read config' });
  }
});

// ── Inbound CRUD ───────────────────────────────────────────────────────

app.get('/api/servers/:id/inbounds', (req, res) => {
  const id = Number(req.params.id);
  res.json(store.getInbounds(id));
});

app.post('/api/servers/:id/inbounds', (req, res) => {
  const id = Number(req.params.id);
  const server = store.getServer(id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  const { protocol, port, network, security, protocolSettings, transportSettings, securitySettings } = req.body;
  if (!protocol || !port) return res.status(400).json({ error: 'Protocol and port required' });
  const inbound = store.addInbound(id, { protocol, port, network, security, protocolSettings, transportSettings, securitySettings });
  if (!inbound) return res.status(500).json({ error: 'Failed to create inbound' });
  // If server is running, restart to apply
  if (isServerRunning(id)) {
    const clients = store.getClientsByServer(id);
    startServer(server, clients);
  }
  res.status(201).json(inbound);
});

app.put('/api/servers/:id/inbounds/:inboundId', (req, res) => {
  const id = Number(req.params.id);
  const inboundId = Number(req.params.inboundId);
  const updated = store.updateInbound(id, inboundId, req.body);
  if (!updated) return res.status(404).json({ error: 'Inbound not found' });
  // If server is running, restart to apply
  const server = store.getServer(id);
  if (server && isServerRunning(id)) {
    const clients = store.getClientsByServer(id);
    startServer(server, clients);
  }
  res.json(updated);
});

app.delete('/api/servers/:id/inbounds/:inboundId', (req, res) => {
  const id = Number(req.params.id);
  const inboundId = Number(req.params.inboundId);
  const deleted = store.deleteInbound(id, inboundId);
  if (!deleted) return res.status(404).json({ error: 'Inbound not found' });
  const server = store.getServer(id);
  if (server && isServerRunning(id)) {
    const clients = store.getClientsByServer(id);
    startServer(server, clients);
  }
  res.json({ success: true });
});

app.post('/api/servers/:id/inbounds/:inboundId/regenerate-keys', (req, res) => {
  const id = Number(req.params.id);
  const inboundId = Number(req.params.inboundId);
  // Regenerate keys for a specific reality inbound
  const server = store.getServer(id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  // Use the server-level key regeneration (updates all reality inbounds)
  const updated = store.regenerateServerKeys(id);
  res.json({ success: true, server: updated });
});

// Clients
app.get('/api/clients', (_req, res) => {
  res.json(store.clients.map(clientWithUrls));
});

app.post('/api/clients', (req, res) => {
  const { name, email, serverId, totalLimit, expiryDate } = req.body;
  if (!name || !email || !serverId) return res.status(400).json({ error: 'Name, email and server required' });
  const client = store.addClient({ name, email, serverId, totalLimit, expiryDate });
  const server = store.getServer(serverId);
  if (server && isServerRunning(serverId)) {
    const clients = store.getClientsByServer(serverId);
    startServer(server, clients);
  }
  res.status(201).json(clientWithUrls(client));
});

app.put('/api/clients/:id', (req, res) => {
  const id = Number(req.params.id);
  const updated = store.updateClient(id, req.body);
  if (!updated) return res.status(404).json({ error: 'Client not found' });
  const server = store.getServer(updated.serverId);
  if (server && isServerRunning(updated.serverId)) {
    const clients = store.getClientsByServer(updated.serverId);
    startServer(server, clients);
  }
  res.json(clientWithUrls(updated));
});

app.delete('/api/clients/:id', (req, res) => {
  const id = Number(req.params.id);
  const client = store.clients.find((c) => c.id === id);
  const serverId = client?.serverId;
  store.deleteClient(id);
  if (serverId) {
    const server = store.getServer(serverId);
    if (server && isServerRunning(serverId)) {
      const clients = store.getClientsByServer(serverId);
      startServer(server, clients);
    }
  }
  res.json({ success: true });
});

app.post('/api/clients/:id/reset-stats', (req, res) => {
  const id = Number(req.params.id);
  const updated = store.resetClientStats(id);
  if (!updated) return res.status(404).json({ error: 'Client not found' });
  res.json(clientWithUrls(updated));
});

// Traffic
app.get('/api/traffic', (req, res) => {
  const days = Number(req.query.days) || 30;
  const traffic = store.traffic.slice(-days);
  const totals = traffic.reduce(
    (acc, t) => ({ upload: acc.upload + t.upload, download: acc.download + t.download }),
    { upload: 0, download: 0 },
  );
  const perServer = store.servers.map((s) => ({
    name: s.name, flag: s.flag, upload: s.totalUpload, download: s.totalDownload,
  }));

  // Protocol distribution from inbounds
  const protoMap = new Map<string, number>();
  for (const s of store.servers) {
    for (const ib of s.inbounds || []) {
      protoMap.set(ib.protocol, (protoMap.get(ib.protocol) || 0) + s.clientCount);
    }
  }
  const protoColors: Record<string, string> = {
    vless: '#8B5CF6', vmess: '#06B6D4', trojan: '#F59E0B',
    shadowsocks: '#10B981', socks: '#EF4444', http: '#EC4899',
    'dokodemo-door': '#6366F1',
  };
  const protoNames: Record<string, string> = {
    vless: 'VLESS', vmess: 'VMess', trojan: 'Trojan',
    shadowsocks: 'Shadowsocks', socks: 'SOCKS', http: 'HTTP',
    'dokodemo-door': 'Dokodemo',
  };
  let protocolDistribution = Array.from(protoMap.entries()).map(([type, count]) => ({
    type, name: protoNames[type] || type, color: protoColors[type] || '#888', count,
  }));
  if (protocolDistribution.length === 0) {
    protocolDistribution = [{ type: 'vless', name: 'VLESS', color: '#8B5CF6', count: 0 }];
  }

  res.json({
    daily: traffic, perServer, protocolDistribution,
    totals: { upload: totals.upload, download: totals.download, total: totals.upload + totals.download },
  });
});

// Notifications
app.get('/api/notifications', (_req, res) => {
  const notifications: { id: number; type: 'warning' | 'error' | 'info' | 'success'; title: string; message: string; time: string; read: boolean }[] = [];
  let nid = 1;
  const servers = store.servers.map(serverWithRunning);

  servers.forEach((s) => {
    if (s.status === 'error') {
      notifications.push({ id: nid++, type: 'error', title: 'Server Error', message: `${s.name} failed to start${s.error ? `: ${s.error}` : ''}`, time: new Date().toISOString(), read: false });
    }
    if (s.status === 'stopped' && s.clientCount > 0) {
      notifications.push({ id: nid++, type: 'warning', title: 'Server Stopped', message: `${s.name} is stopped but has ${s.clientCount} client${s.clientCount > 1 ? 's' : ''}`, time: new Date(Date.now() - 3600000).toISOString(), read: false });
    }
  });

  store.clients.forEach((c) => {
    const used = c.upload + c.download;
    if (c.status === 'expired') {
      notifications.push({ id: nid++, type: 'error', title: 'Client Expired', message: `${c.name}'s subscription has expired`, time: new Date(Date.now() - 86400000).toISOString(), read: false });
    }
    if (c.totalLimit > 0) {
      const pct = used / c.totalLimit;
      if (pct > 1) {
        notifications.push({ id: nid++, type: 'error', title: 'Data Limit Exceeded', message: `${c.name} exceeded limit: ${used.toFixed(1)} / ${c.totalLimit} GB`, time: new Date(Date.now() - 43200000).toISOString(), read: false });
      } else if (pct > 0.8) {
        notifications.push({ id: nid++, type: 'warning', title: 'Data Limit Near', message: `${c.name} used ${Math.round(pct * 100)}% of limit`, time: new Date(Date.now() - 43200000).toISOString(), read: false });
      }
    }
    const daysLeft = Math.ceil((new Date(c.expiryDate).getTime() - Date.now()) / 86400000);
    if (daysLeft > 0 && daysLeft <= 3) {
      notifications.push({ id: nid++, type: 'warning', title: 'Subscription Expiring', message: `${c.name}'s subscription expires in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`, time: new Date(Date.now() - 21600000).toISOString(), read: false });
    }
  });

  if (store.servers.length === 0) {
    notifications.push({ id: nid++, type: 'info', title: 'Welcome', message: 'Add your first server to start managing Xray VPN', time: new Date().toISOString(), read: false });
  }

  res.json(notifications);
});

// Ping
app.get('/api/ping', async (_req, res) => {
  const servers = store.servers.map(serverWithRunning);
  const results = await Promise.all(
    servers.map(async (s) => {
      const ping = isServerRunning(s.id) ? await tcpPing('127.0.0.1', s.port) : -1;
      return { id: s.id, name: s.name, ping, status: s.status };
    }),
  );
  res.json(results);
});

// Settings
app.get('/api/settings', (_req, res) => res.json(store.settings));

app.put('/api/settings', (req, res) => {
  res.json(store.updateSettings(req.body));
});

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
