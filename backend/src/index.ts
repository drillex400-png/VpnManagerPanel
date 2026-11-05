import express from 'express';
import cors from 'cors';
import { store } from './store';
import {
  listAvailableVersions,
  listLocalVersions,
  downloadVersion,
  startServer,
  stopServer,
  isServerRunning,
  queryStats,
  tcpPing,
  resetProcesses,
} from './xray/manager';
import { generateVlessUrl } from './xray/vless';
import type { ServerData, ClientData } from './store';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT) || 3001;

// Reset process tracking on startup (xray processes don't survive restart)
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

// Daily traffic point
setInterval(() => store.pushTrafficPoint(), 3600000);
store.pushTrafficPoint();

// ===== Helpers =====
function clientWithVless(c: ClientData): ClientData & { vlessUrl: string } {
  const server = store.getServer(c.serverId);
  if (!server) return { ...c, vlessUrl: '' };
  return {
    ...c,
    vlessUrl: generateVlessUrl({
      uuid: c.uuid,
      host: server.host,
      port: server.port,
      publicKey: server.realityPublicKey,
      sni: server.realitySNI,
      shortId: server.realityShortIds[0] || '',
      flow: c.flow,
      name: c.name,
    }),
  };
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
    res.json({
      available: remote,
      downloaded: local,
      default: store.DEFAULT_XRAY_VERSION,
    });
  } catch (e) {
    // Fallback: return local versions only
    res.json({
      available: listLocalVersions(),
      downloaded: listLocalVersions(),
      default: store.DEFAULT_XRAY_VERSION,
    });
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

  res.json({
    servers: { total: servers.length, online: runningServers },
    clients: { total: store.clients.length, active: activeClients },
    traffic: { today: todayTraffic, month: monthTraffic },
    protocolDistribution: [
      { type: 'vless', name: 'VLESS + Reality', color: '#8B5CF6', count: activeClients },
    ],
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
      ping: 0,
    })),
    xrayVersions: {
      available: listLocalVersions(),
      default: store.DEFAULT_XRAY_VERSION,
    },
  });
});

// Servers
app.get('/api/servers', (_req, res) => {
  const result = store.servers.map((s) => ({
    ...serverWithRunning(s),
    protocols: [{ id: 1, serverId: s.id, type: 'vless', port: s.port, status: s.status === 'running' ? 'running' : 'stopped', clients: s.clientCount, upload: s.totalUpload, download: s.totalDownload }],
  }));
  res.json(result);
});

app.post('/api/servers', (req, res) => {
  const { name, host, port, location, flag, xrayVersion, realityDest, realitySNI } = req.body;
  if (!name || !host) return res.status(400).json({ error: 'Name and host required' });

  const server = store.addServer({
    name,
    host,
    port: port || 443,
    location: location || '',
    flag: flag || '🌐',
    xrayVersion: xrayVersion || store.DEFAULT_XRAY_VERSION,
    realityDest,
    realitySNI,
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

// Start/stop xray process
app.post('/api/servers/:id/start', async (req, res) => {
  const id = Number(req.params.id);
  const server = store.getServer(id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const clients = store.getClientsByServer(id);
  const result = await startServer(server, clients);

  if (result.ok) {
    store.updateServer(id, { status: 'running', error: undefined });
  } else {
    store.updateServer(id, { status: 'error', error: result.error });
  }

  res.json({ success: result.ok, error: result.error });
});

app.post('/api/servers/:id/stop', (req, res) => {
  const id = Number(req.params.id);
  stopServer(id);
  store.updateServer(id, { status: 'stopped' });
  res.json({ success: true });
});

// Clients
app.get('/api/clients', (_req, res) => {
  res.json(store.clients.map(clientWithVless));
});

app.post('/api/clients', (req, res) => {
  const { name, email, serverId, totalLimit, expiryDate } = req.body;
  if (!name || !email || !serverId) return res.status(400).json({ error: 'Name, email and server required' });

  const client = store.addClient({ name, email, serverId, totalLimit, expiryDate });

  // If server is running, restart to apply config
  const server = store.getServer(serverId);
  if (server && isServerRunning(serverId)) {
    const clients = store.getClientsByServer(serverId);
    startServer(server, clients);
  }

  res.status(201).json(clientWithVless(client));
});

app.put('/api/clients/:id', (req, res) => {
  const id = Number(req.params.id);
  const updated = store.updateClient(id, req.body);
  if (!updated) return res.status(404).json({ error: 'Client not found' });

  // If server is running, restart to apply config
  const server = store.getServer(updated.serverId);
  if (server && isServerRunning(updated.serverId)) {
    const clients = store.getClientsByServer(updated.serverId);
    startServer(server, clients);
  }

  res.json(clientWithVless(updated));
});

app.delete('/api/clients/:id', (req, res) => {
  const id = Number(req.params.id);
  const client = store.clients.find((c) => c.id === id);
  const serverId = client?.serverId;

  store.deleteClient(id);

  // If server is running, restart to apply config
  if (serverId) {
    const server = store.getServer(serverId);
    if (server && isServerRunning(serverId)) {
      const clients = store.getClientsByServer(serverId);
      startServer(server, clients);
    }
  }

  res.json({ success: true });
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
    name: s.name,
    flag: s.flag,
    upload: s.totalUpload,
    download: s.totalDownload,
  }));
  res.json({
    daily: traffic,
    perServer,
    protocolDistribution: [
      { type: 'vless', name: 'VLESS + Reality', color: '#8B5CF6', count: store.clients.filter((c) => c.status === 'active').length },
    ],
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
        notifications.push({ id: nid++, type: 'warning', title: 'Data Limit Near', message: `${c.name} used ${Math.round(pct * 100)}% of limit (${used.toFixed(1)} / ${c.totalLimit} GB)`, time: new Date(Date.now() - 43200000).toISOString(), read: false });
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
      // Ping the local xray port to check if the process is listening
      const ping = isServerRunning(s.id) ? await tcpPing('127.0.0.1', s.port) : -1;
      return { id: s.id, name: s.name, ping, status: s.status };
    }),
  );
  res.json(results);
});

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
