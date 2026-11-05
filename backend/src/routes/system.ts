import { Router } from 'express';
import { store } from '../store';
import { createSession, destroySession, validateSession } from '../auth';
import {
  listAvailableVersions,
  listLocalVersions,
  downloadVersion,
  isServerRunning,
  verifyRunning,
  queryStats,
  tcpPing,
} from '../xray/manager';
import { sendTestNotification } from '../telegram';
import type { ServerData } from '../store';

const router = Router();

function serverWithRunning(s: ServerData): ServerData {
  return { ...s, status: isServerRunning(s.id) ? 'running' : s.status === 'error' ? 'error' : 'stopped' };
}

// ── Авторизация ───────────────────────────────────────────────────────

router.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Введите логин и пароль' });
  if (username !== store.settings.adminUser || password !== store.settings.adminPassword) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }
  const token = createSession(username);
  res.json({ token, user: username });
});

router.post('/auth/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) destroySession(token);
  res.json({ success: true });
});

router.get('/auth/check', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token && validateSession(token)) {
    res.json({ authenticated: true, user: store.settings.adminUser });
  } else {
    res.json({ authenticated: false });
  }
});

// ── Дашборд ───────────────────────────────────────────────────────────

router.get('/dashboard', (_req, res) => {
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
      cpu: s.cpu, ram: s.ram, disk: s.disk, clientCount: s.clientCount,
      uploadSpeed: s.uploadSpeed, downloadSpeed: s.downloadSpeed, ping: 0,
    })),
    xrayVersions: { available: listLocalVersions(), default: store.DEFAULT_XRAY_VERSION },
  });
});

// ── Трафик ────────────────────────────────────────────────────────────

router.get('/traffic', (req, res) => {
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

// ── Уведомления ───────────────────────────────────────────────────────

router.get('/notifications', (_req, res) => {
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

// ── Пинг ──────────────────────────────────────────────────────────────

router.get('/ping', async (_req, res) => {
  const servers = store.servers.map(serverWithRunning);
  const results = await Promise.all(
    servers.map(async (s) => {
      const ping = isServerRunning(s.id) ? await tcpPing(s.host, s.port) : -1;
      return { id: s.id, name: s.name, ping, status: s.status };
    }),
  );
  res.json(results);
});

// ── Настройки ─────────────────────────────────────────────────────────

router.get('/settings', (_req, res) => res.json(store.settings));

router.put('/settings', (req, res) => {
  res.json(store.updateSettings(req.body));
});

// ── Тест Telegram ─────────────────────────────────────────────────────

router.post('/settings/telegram-test', async (_req, res) => {
  const ok = await sendTestNotification();
  if (ok) res.json({ success: true });
  else res.status(400).json({ error: 'Не удалось отправить. Проверьте токен бота и chat ID.' });
});

// ── Версии Xray ───────────────────────────────────────────────────────

router.get('/xray/versions', async (_req, res) => {
  try {
    const remote = await listAvailableVersions();
    res.json({ available: remote, downloaded: listLocalVersions(), default: store.DEFAULT_XRAY_VERSION });
  } catch {
    res.json({ available: listLocalVersions(), downloaded: listLocalVersions(), default: store.DEFAULT_XRAY_VERSION });
  }
});

router.post('/xray/download', async (req, res) => {
  const { version } = req.body;
  if (!version) return res.status(400).json({ error: 'Укажите версию' });
  try {
    await downloadVersion(version);
    res.json({ success: true, version });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// ── Резервное копирование ─────────────────────────────────────────────

router.get('/backup', (_req, res) => {
  const data = store.exportData();
  res.setHeader('Content-Disposition', `attachment; filename="xray-panel-backup-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(data);
});

router.post('/restore', (req, res) => {
  const data = req.body;
  if (!data || (!data.servers && !data.clients && !data.settings)) {
    return res.status(400).json({ error: 'Неверный формат резервной копии' });
  }
  try {
    store.importData(data);
    for (const server of store.servers) {
      if (isServerRunning(server.id)) {
        const clients = store.getClientsByServer(server.id);
        startServer(server, clients);
      }
    }
    res.json({ success: true, servers: store.servers.length, clients: store.clients.length });
  } catch (e) {
    res.status(500).json({ error: `Ошибка восстановления: ${(e as Error).message}` });
  }
});

export default router;
