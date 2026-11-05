import { Router } from 'express';
import { store } from '../store';
import { isServerRunning, startServer } from '../xray/manager';
import { generateShareUrl } from '../xray/share';
import { notifyClientAdded } from '../telegram';
import type { ClientData } from '../store';

const router = Router();

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

// Список клиентов
router.get('/clients', (_req, res) => {
  res.json(store.clients.map(clientWithUrls));
});

// Добавить клиента
router.post('/clients', async (req, res) => {
  const { name, email, serverId, totalLimit, expiryDate } = req.body;
  if (!name || !email || !serverId) return res.status(400).json({ error: 'Укажите имя, email и сервер' });
  const client = store.addClient({ name, email, serverId, totalLimit, expiryDate });
  const server = store.getServer(serverId);
  if (server && isServerRunning(serverId)) {
    const clients = store.getClientsByServer(serverId);
    startServer(server, clients);
  }
  // Telegram-уведомление
  if (store.settings.telegramNotifications) {
    notifyClientAdded(client).catch(() => {});
  }
  res.status(201).json(clientWithUrls(client));
});

// Изменить клиента
router.put('/clients/:id', async (req, res) => {
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

// Удалить клиента
router.delete('/clients/:id', async (req, res) => {
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

// Сброс статистики
router.post('/clients/:id/reset-stats', (req, res) => {
  const id = Number(req.params.id);
  const updated = store.resetClientStats(id);
  if (!updated) return res.status(404).json({ error: 'Клиент не найден' });
  res.json(clientWithUrls(updated));
});

// ── Массовые операции ─────────────────────────────────────────────────

router.post('/clients/bulk', async (req, res) => {
  const { ids, action } = req.body;
  if (!Array.isArray(ids) || ids.length === 0 || !action) {
    return res.status(400).json({ error: 'Укажите ids и action' });
  }
  const validActions = ['enable', 'disable', 'delete', 'reset-stats'];
  if (!validActions.includes(action)) {
    return res.status(400).json({ error: 'Неизвестное действие' });
  }

  const affectedServers = new Set<number>();

  for (const id of ids) {
    const client = store.clients.find((c) => c.id === id);
    if (!client) continue;

    if (action === 'delete') {
      store.deleteClient(id);
      affectedServers.add(client.serverId);
    } else if (action === 'enable') {
      store.updateClient(id, { status: 'active' });
      affectedServers.add(client.serverId);
    } else if (action === 'disable') {
      store.updateClient(id, { status: 'disabled' });
      affectedServers.add(client.serverId);
    } else if (action === 'reset-stats') {
      store.resetClientStats(id);
    }
  }

  // Перезапускаем затронутые серверы
  for (const serverId of affectedServers) {
    const server = store.getServer(serverId);
    if (server && isServerRunning(serverId)) {
      const clients = store.getClientsByServer(serverId);
      startServer(server, clients);
    }
  }

  res.json({ success: true, count: ids.length, action });
});

// ── Экспорт в CSV ──────────────────────────────────────────────────────

router.get('/clients/export', (_req, res) => {
  const headers = ['Имя', 'Email', 'Сервер', 'Статус', 'Загружено (ГБ)', 'Отдано (ГБ)', 'Лимит (ГБ)', 'Срок действия', 'Дата создания'];

  const rows = store.clients.map((c) => [
    c.name,
    c.email,
    c.serverName,
    c.status,
    c.upload.toFixed(2),
    c.download.toFixed(2),
    c.totalLimit > 0 ? String(c.totalLimit) : '∞',
    c.expiryDate,
    c.createdAt.split('T')[0],
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="clients-${new Date().toISOString().slice(0, 10)}.csv"`);
  // BOM для корректного отображения кириллицы в Excel
  res.send('\ufeff' + csv);
});

export default router;
