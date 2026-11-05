import { Router } from 'express';
import { store } from '../store';
import {
  startServer,
  stopServer,
  restartServer,
  isServerRunning,
  verifyRunning,
  queryStats,
  getSystemStats,
  getServerLogs,
  clearServerLogs,
  getServerConfig,
  testConnection,
} from '../xray/manager';
import type { ServerData, ClientData } from '../store';

const router = Router();

function serverWithRunning(s: ServerData): ServerData {
  return { ...s, status: isServerRunning(s.id) ? 'running' : s.status === 'error' ? 'error' : 'stopped' };
}

// Проверка SSH-соединения с нодой (до создания сервера)
router.post('/servers/test', async (req, res) => {
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

// Серверы
router.get('/servers', (_req, res) => {
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

router.post('/servers', (req, res) => {
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

router.put('/servers/:id', (req, res) => {
  const id = Number(req.params.id);
  const updated = store.updateServer(id, req.body);
  if (!updated) return res.status(404).json({ error: 'Сервер не найден' });
  res.json(updated);
});

router.delete('/servers/:id', async (req, res) => {
  const id = Number(req.params.id);
  const server = store.getServer(id);
  if (server) await stopServer(server);
  store.deleteServer(id);
  res.json({ success: true });
});

router.post('/servers/:id/start', async (req, res) => {
  const id = Number(req.params.id);
  const server = store.getServer(id);
  if (!server) return res.status(404).json({ error: 'Сервер не найден' });
  const clients = store.getClientsByServer(id);
  const result = await startServer(server, clients);
  if (result.ok) store.updateServer(id, { status: 'running', error: undefined });
  else store.updateServer(id, { status: 'error', error: result.error });
  res.json({ success: result.ok, error: result.error });
});

router.post('/servers/:id/stop', async (req, res) => {
  const id = Number(req.params.id);
  const server = store.getServer(id);
  if (server) await stopServer(server);
  store.updateServer(id, { status: 'stopped' });
  res.json({ success: true });
});

router.post('/servers/:id/restart', async (req, res) => {
  const id = Number(req.params.id);
  const server = store.getServer(id);
  if (!server) return res.status(404).json({ error: 'Сервер не найден' });
  const clients = store.getClientsByServer(id);
  const result = await restartServer(server, clients);
  if (result.ok) store.updateServer(id, { status: 'running', error: undefined });
  else store.updateServer(id, { status: 'error', error: result.error });
  res.json({ success: result.ok, error: result.error });
});

router.post('/servers/:id/regenerate-keys', (req, res) => {
  const id = Number(req.params.id);
  const server = store.getServer(id);
  if (!server) return res.status(404).json({ error: 'Сервер не найден' });
  const updated = store.regenerateServerKeys(id);
  res.json({ success: true, server: updated });
});

router.get('/servers/:id/logs', async (req, res) => {
  const id = Number(req.params.id);
  const server = store.getServer(id);
  if (!server) return res.status(404).json({ error: 'Сервер не найден' });
  const logs = await getServerLogs(server);
  res.json({ logs });
});

router.delete('/servers/:id/logs', async (req, res) => {
  const id = Number(req.params.id);
  const server = store.getServer(id);
  if (!server) return res.status(404).json({ error: 'Сервер не найден' });
  await clearServerLogs(server);
  res.json({ success: true });
});

router.get('/servers/:id/config', (req, res) => {
  const id = Number(req.params.id);
  const server = store.getServer(id);
  if (!server) return res.status(404).json({ error: 'Сервер не найден' });
  const clients = store.getClientsByServer(id);
  const config = getServerConfig(server, clients);
  res.json({ config, filename: `server-${id}-config.json` });
});

// ── Inbound CRUD ───────────────────────────────────────────────────────

router.get('/servers/:id/inbounds', (req, res) => {
  const id = Number(req.params.id);
  res.json(store.getInbounds(id));
});

router.post('/servers/:id/inbounds', async (req, res) => {
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

router.put('/servers/:id/inbounds/:inboundId', async (req, res) => {
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

router.delete('/servers/:id/inbounds/:inboundId', async (req, res) => {
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

router.post('/servers/:id/inbounds/:inboundId/regenerate-keys', (req, res) => {
  const id = Number(req.params.id);
  const server = store.getServer(id);
  if (!server) return res.status(404).json({ error: 'Сервер не найден' });
  const updated = store.regenerateServerKeys(id);
  res.json({ success: true, server: updated });
});

export default router;
