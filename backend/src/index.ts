import express from 'express';
import cors from 'cors';
import { store } from './store';
import { authMiddleware, createSession, destroySession, validateSession } from './auth';
import { generateShareUrl } from './xray/share';
import {
  listAvailableVersions,
  listLocalVersions,
  downloadVersion,
  startServer,
  stopServer,
  restartServer,
  isServerRunning,
  verifyRunning,
  queryStats,
  tcpPing,
  resetProcesses,
  getServerLogs,
  clearServerLogs,
  getServerConfig,
  testConnection,
} from './xray/manager';
import { generateShareUrl } from './xray/share';
import type { ServerData, ClientData } from './store';

const app = express();
app.use(cors());
app.use(express.json());

// Auth middleware — защищает все эндпоинты кроме публичных
app.use(authMiddleware);

const PORT = Number(process.env.PORT) || 3001;

resetProcesses();
store.resetStatuses();

// Периодически опрашиваем статистику с запущенных нод.
setInterval(async () => {
  for (const server of store.servers) {
    if (isServerRunning(server.id)) {
      const stats = await queryStats(server);
      if (Object.keys(stats).length > 0) {
        store.updateTrafficStats(stats);
      }
    }
  }

  // Автоматическая проверка лимитов и срока действия
  if (store.settings.autoLimitEnabled) {
    const changedServers = store.checkClientLimits();
    for (const serverId of changedServers) {
      const server = store.getServer(serverId);
      if (server && isServerRunning(serverId)) {
        const clients = store.getClientsByServer(serverId);
        startServer(server, clients);
      }
    }
  }
}, 10000);

// Периодически проверяем, живы ли процессы на нодах.
setInterval(async () => {
  for (const server of store.servers) {
    if (isServerRunning(server.id)) {
      const alive = await verifyRunning(server);
      if (!alive) store.updateServer(server.id, { status: 'stopped' });
    }
  }
}, 20000);

setInterval(() => store.pushTrafficPoint(), 3600000);
store.pushTrafficPoint();

// ===== Helpers =====

function clientWithUrls(c: ClientData): ClientData & { vlessUrl: string; subUrl: string; shareUrls: { protocol: string; url: string }[] } {
  const server = store.getServer(c.serverId);
  if (!server) return { ...c, vlessUrl: '', subUrl: '', shareUrls: [] };

  const inbounds = server.inbounds || [];
  const shareUrls = inbounds
    .filter((inbound) => inbound.protocol !== 'dokodemo-door')
    .map((inbound) => {
      const ss = { ...inbound.securitySettings };
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

  const primary = shareUrls[0]?.url || '';
  const subUrl = `/api/sub/${c.subToken}`;
  return { ...c, vlessUrl: primary, subUrl, shareUrls };
}

function serverWithRunning(s: ServerData): ServerData {
  return { ...s, status: isServerRunning(s.id) ? 'running' : s.status === 'error' ? 'error' : 'stopped' };
}

// ===== Routes =====

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ── Авторизация ───────────────────────────────────────────────────────

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Введите логин и пароль' });
  if (username !== store.settings.adminUser || password !== store.settings.adminPassword) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }
  const token = createSession(username);
  res.json({ token, user: username });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) destroySession(token);
  res.json({ success: true });
});

app.get('/api/auth/check', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token && validateSession(token)) {
    res.json({ authenticated: true, user: store.settings.adminUser });
  } else {
    res.json({ authenticated: false });
  }
});

// ── Подписки клиентов (публичный эндпоинт) ─────────────────────────────

app.get('/api/sub/:token', (req, res) => {
  const client = store.getClientBySubToken(req.params.token);
  if (!client) return res.status(404).json({ error: 'Подписка не найдена' });

  const server = store.getServer(client.serverId);
  if (!server) return res.status(404).json({ error: 'Сервер не найден' });

  const inbounds = server.inbounds || [];
  const urls: string[] = [];
  for (const inbound of inbounds) {
    if (inbound.protocol === 'dokodemo-door') continue;
    const ss = { ...inbound.securitySettings };
    if (inbound.security === 'reality' && server.realityPublicKey) {
      ss._publicKey = server.realityPublicKey;
    }
    const url = generateShareUrl({
      protocol: inbound.protocol,
      uuid: client.uuid,
      host: server.host,
      port: inbound.port,
      network: inbound.network,
      security: inbound.security,
      securitySettings: ss,
      transportSettings: inbound.transportSettings,
      protocolSettings: inbound.protocolSettings,
      name: client.name,
    });
    if (url) urls.push(url);
  }

  if (urls.length === 0) return res.status(404).json({ error: 'Нет доступных конфигураций' });

  // Возвращаем base64-кодированный список ссылок (стандартный формат подписок)
  const subscription = Buffer.from(urls.join('\n')).toString('base64');
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Subscription-Userinfo', `upload=${(client.upload * 1024 * 1024 * 1024).toFixed(0)}; download=${(client.download * 1024 * 1024 * 1024).toFixed(0)}; total=${client.totalLimit > 0 ? client.totalLimit * 1024 * 1024 * 1024 : 0}; expire=${new Date(client.expiryDate).getTime() / 1000 | 0}`);
  res.send(subscription);
});

// Проверка SSH-соединения с нодой (до создания сервера)
app.post('/api/servers/test', async (req, res) => {
  const { host, sshPort, sshUser, sshAuthType, sshPrivateKey, sshPassword } = req.body;
  if (!host) return res.status(400).json({ error: 'Укажите хост ноды' });
  const probe: ServerData = {
    id: 0,
    name: '',
    host,
    port: 0,
    apiPort: 0,
    location: '',
    flag: '',
    status: 'stopped',
    xrayVersion: '',
    cpu: 0,
    ram: 0,
    uptime: 0,
    clientCount: 0,
    totalUpload: 0,
    totalDownload: 0,
    uploadSpeed: 0,
    downloadSpeed: 0,
    createdAt: '',
    inbounds: [],
    sshPort: Number(sshPort) || 22,
    sshUser: sshUser || 'root',
    sshAuthType: sshAuthType || 'password',
    sshPrivateKey: sshPrivateKey || '',
    sshPassword: sshPassword || '',
  };
  const result = await testConnection(probe);
  res.json(result);
});

// Версии Xray
app.get('/api/xray/versions', async (_req, res) => {
  try {
    const remote = await listAvailableVersions();
    res.json({ available: remote, downloaded: listLocalVersions(), default: store.DEFAULT_XRAY_VERSION });
  } catch {
    res.json({ available: listLocalVersions(), downloaded: listLocalVersions(), default: store.DEFAULT_XRAY_VERSION });
  }
});

app.post('/api/xray/download', async (req, res) => {
  const { version } = req.body;
  if (!version) return res.status(400).json({ error: 'Укажите версию' });
  try {
    await downloadVersion(version);
    res.json({ success: true, version });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// Дашборд
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

// Серверы
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
  const {
    name, host, port, location, flag, xrayVersion,
    realityDest, realitySNI,
    sshPort, sshUser, sshAuthType, sshPrivateKey, sshPassword,
  } = req.body;
  if (!name || !host) return res.status(400).json({ error: 'Укажите имя и хост ноды' });
  if (!sshUser) return res.status(400).json({ error: 'Укажите пользователя SSH' });
  const server = store.addServer({
    name, host, port: port || 443, location: location || '',
    flag: flag || '🌐', xrayVersion: xrayVersion || store.DEFAULT_XRAY_VERSION,
    realityDest, realitySNI,
    sshPort: Number(sshPort) || 22, sshUser,
    sshAuthType: sshAuthType || 'password',
    sshPrivateKey: sshPrivateKey || '', sshPassword: sshPassword || '',
  });
  res.status(201).json(server);
});

app.put('/api/servers/:id', (req, res) => {
  const id = Number(req.params.id);
  const updated = store.updateServer(id, req.body);
  if (!updated) return res.status(404).json({ error: 'Сервер не найден' });
  res.json(updated);
});

app.delete('/api/servers/:id', async (req, res) => {
  const id = Number(req.params.id);
  const server = store.getServer(id);
  if (server) await stopServer(server);
  store.deleteServer(id);
  res.json({ success: true });
});

app.post('/api/servers/:id/start', async (req, res) => {
  const id = Number(req.params.id);
  const server = store.getServer(id);
  if (!server) return res.status(404).json({ error: 'Сервер не найден' });
  const clients = store.getClientsByServer(id);
  const result = await startServer(server, clients);
  if (result.ok) store.updateServer(id, { status: 'running', error: undefined });
  else store.updateServer(id, { status: 'error', error: result.error });
  res.json({ success: result.ok, error: result.error });
});

app.post('/api/servers/:id/stop', async (req, res) => {
  const id = Number(req.params.id);
  const server = store.getServer(id);
  if (server) await stopServer(server);
  store.updateServer(id, { status: 'stopped' });
  res.json({ success: true });
});

app.post('/api/servers/:id/restart', async (req, res) => {
  const id = Number(req.params.id);
  const server = store.getServer(id);
  if (!server) return res.status(404).json({ error: 'Сервер не найден' });
  const clients = store.getClientsByServer(id);
  const result = await restartServer(server, clients);
  if (result.ok) store.updateServer(id, { status: 'running', error: undefined });
  else store.updateServer(id, { status: 'error', error: result.error });
  res.json({ success: result.ok, error: result.error });
});

app.post('/api/servers/:id/regenerate-keys', (req, res) => {
  const id = Number(req.params.id);
  const server = store.getServer(id);
  if (!server) return res.status(404).json({ error: 'Сервер не найден' });
  const updated = store.regenerateServerKeys(id);
  res.json({ success: true, server: updated });
});

app.get('/api/servers/:id/logs', async (req, res) => {
  const id = Number(req.params.id);
  const server = store.getServer(id);
  if (!server) return res.status(404).json({ error: 'Сервер не найден' });
  const logs = await getServerLogs(server);
  res.json({ logs });
});

app.delete('/api/servers/:id/logs', async (req, res) => {
  const id = Number(req.params.id);
  const server = store.getServer(id);
  if (!server) return res.status(404).json({ error: 'Сервер не найден' });
  await clearServerLogs(server);
  res.json({ success: true });
});

app.get('/api/servers/:id/config', (req, res) => {
  const id = Number(req.params.id);
  const server = store.getServer(id);
  if (!server) return res.status(404).json({ error: 'Сервер не найден' });
  const clients = store.getClientsByServer(id);
  const config = getServerConfig(server, clients);
  res.json({ config, filename: `server-${id}-config.json` });
});

// ── Inbound CRUD ───────────────────────────────────────────────────────

app.get('/api/servers/:id/inbounds', (req, res) => {
  const id = Number(req.params.id);
  res.json(store.getInbounds(id));
});

app.post('/api/servers/:id/inbounds', async (req, res) => {
  const id = Number(req.params.id);
  const server = store.getServer(id);
  if (!server) return res.status(404).json({ error: 'Сервер не найден' });
  const { protocol, port, network, security, protocolSettings, transportSettings, securitySettings } = req.body;
  if (!protocol || !port) return res.status(400).json({ error: 'Укажите протокол и порт' });
  const inbound = store.addInbound(id, { protocol, port, network, security, protocolSettings, transportSettings, securitySettings });
  if (!inbound) return res.status(500).json({ error: 'Не удалось создать инбаунд' });
  if (isServerRunning(id)) {
    const clients = store.getClientsByServer(id);
    startServer(server, clients);
  }
  res.status(201).json(inbound);
});

app.put('/api/servers/:id/inbounds/:inboundId', async (req, res) => {
  const id = Number(req.params.id);
  const inboundId = Number(req.params.inboundId);
  const updated = store.updateInbound(id, inboundId, req.body);
  if (!updated) return res.status(404).json({ error: 'Инбаунд не найден' });
  const server = store.getServer(id);
  if (server && isServerRunning(id)) {
    const clients = store.getClientsByServer(id);
    startServer(server, clients);
  }
  res.json(updated);
});

app.delete('/api/servers/:id/inbounds/:inboundId', async (req, res) => {
  const id = Number(req.params.id);
  const inboundId = Number(req.params.inboundId);
  const deleted = store.deleteInbound(id, inboundId);
  if (!deleted) return res.status(404).json({ error: 'Инбаунд не найден' });
  const server = store.getServer(id);
  if (server && isServerRunning(id)) {
    const clients = store.getClientsByServer(id);
    startServer(server, clients);
  }
  res.json({ success: true });
});

app.post('/api/servers/:id/inbounds/:inboundId/regenerate-keys', (req, res) => {
  const id = Number(req.params.id);
  const server = store.getServer(id);
  if (!server) return res.status(404).json({ error: 'Сервер не найден' });
  const updated = store.regenerateServerKeys(id);
  res.json({ success: true, server: updated });
});

// Клиенты
app.get('/api/clients', (_req, res) => {
  res.json(store.clients.map(clientWithUrls));
});

app.post('/api/clients', async (req, res) => {
  const { name, email, serverId, totalLimit, expiryDate } = req.body;
  if (!name || !email || !serverId) return res.status(400).json({ error: 'Укажите имя, email и сервер' });
  const client = store.addClient({ name, email, serverId, totalLimit, expiryDate });
  const server = store.getServer(serverId);
  if (server && isServerRunning(serverId)) {
    const clients = store.getClientsByServer(serverId);
    startServer(server, clients);
  }
  res.status(201).json(clientWithUrls(client));
});

app.put('/api/clients/:id', async (req, res) => {
  const id = Number(req.params.id);
  const updated = store.updateClient(id, req.body);
  if (!updated) return res.status(404).json({ error: 'Клиент не найден' });
  const server = store.getServer(updated.serverId);
  if (server && isServerRunning(updated.serverId)) {
    const clients = store.getClientsByServer(updated.serverId);
    startServer(server, clients);
  }
  res.json(clientWithUrls(updated));
});

app.delete('/api/clients/:id', async (req, res) => {
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
  if (!updated) return res.status(404).json({ error: 'Клиент не найден' });
  res.json(clientWithUrls(updated));
});

// Трафик
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

// Уведомления
app.get('/api/notifications', (_req, res) => {
  const notifications: { id: number; type: 'warning' | 'error' | 'info' | 'success'; title: string; message: string; time: string; read: boolean }[] = [];
  let nid = 1;
  const servers = store.servers.map(serverWithRunning);

  servers.forEach((s) => {
    if (s.status === 'error') {
      notifications.push({ id: nid++, type: 'error', title: 'Ошибка сервера', message: `${s.name}: не удалось запустить${s.error ? ` — ${s.error}` : ''}`, time: new Date().toISOString(), read: false });
    }
    if (s.status === 'stopped' && s.clientCount > 0) {
      notifications.push({ id: nid++, type: 'warning', title: 'Сервер остановлен', message: `${s.name} остановлен, но к нему привязан ${s.clientCount} клиент(ов)`, time: new Date(Date.now() - 3600000).toISOString(), read: false });
    }
  });

  store.clients.forEach((c) => {
    const used = c.upload + c.download;
    if (c.status === 'expired') {
      notifications.push({ id: nid++, type: 'error', title: 'Подписка истекла', message: `У клиента ${c.name} истекла подписка`, time: new Date(Date.now() - 86400000).toISOString(), read: false });
    }
    if (c.totalLimit > 0) {
      const pct = used / c.totalLimit;
      if (pct > 1) {
        notifications.push({ id: nid++, type: 'error', title: 'Лимит превышен', message: `${c.name} превысил лимит: ${used.toFixed(1)} / ${c.totalLimit} ГБ`, time: new Date(Date.now() - 43200000).toISOString(), read: false });
      } else if (pct > 0.8) {
        notifications.push({ id: nid++, type: 'warning', title: 'Лимит почти исчерпан', message: `${c.name} использовал ${Math.round(pct * 100)}% лимита`, time: new Date(Date.now() - 43200000).toISOString(), read: false });
      }
    }
    const daysLeft = Math.ceil((new Date(c.expiryDate).getTime() - Date.now()) / 86400000);
    if (daysLeft > 0 && daysLeft <= 3) {
      notifications.push({ id: nid++, type: 'warning', title: 'Подписка скоро истечёт', message: `У клиента ${c.name} подписка истечёт через ${daysLeft} дн.`, time: new Date(Date.now() - 21600000).toISOString(), read: false });
    }
  });

  if (store.servers.length === 0) {
    notifications.push({ id: nid++, type: 'info', title: 'Добро пожаловать', message: 'Добавьте первую ноду, чтобы начать управлять VPN на базе Xray', time: new Date().toISOString(), read: false });
  }

  res.json(notifications);
});

// Пинг
app.get('/api/ping', async (_req, res) => {
  const servers = store.servers.map(serverWithRunning);
  const results = await Promise.all(
    servers.map(async (s) => {
      const ping = isServerRunning(s.id) ? await tcpPing(s.host, s.port) : -1;
      return { id: s.id, name: s.name, ping, status: s.status };
    }),
  );
  res.json(results);
});

// Настройки
app.get('/api/settings', (_req, res) => res.json(store.settings));

app.put('/api/settings', (req, res) => {
  res.json(store.updateSettings(req.body));
});

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
