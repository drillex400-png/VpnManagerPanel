import express from 'express';
import cors from 'cors';
import { store } from './store';
import { authMiddleware } from './auth';
import { logEvent } from './events';
import { setProcessor, enqueue } from './queue';
import serverRoutes from './routes/servers';
import clientRoutes from './routes/clients';
import systemRoutes from './routes/system';
import monitorRoutes, { recordMetrics } from './routes/monitor';
import { generateShareUrl } from './xray/share';
import {
  isServerRunning,
  verifyRunning,
  queryStats,
  getSystemStats,
  startServer,
  stopServer,
  restartServer,
  resetProcesses,
} from './xray/manager';
import { notifyServerStatus, notifyClientLimit } from './telegram';

const app = express();
app.use(cors());
app.use(express.json());

// Auth middleware — защищает все эндпоинты кроме публичных
app.use(authMiddleware);

const PORT = Number(process.env.PORT) || 3001;

resetProcesses();
store.resetStatuses();

// ── Очередь операций ──────────────────────────────────────────────────

setProcessor(async (op) => {
  const server = store.getServer(op.serverId);
  if (!server) throw new Error('Сервер не найден');
  const clients = store.getClientsByServer(op.serverId);
  if (op.type === 'start') {
    const result = await startServer(server, clients);
    if (!result.ok) throw new Error(result.error || 'Не удалось запустить');
    store.updateServer(op.serverId, { status: 'running', error: undefined });
    logEvent({ type: 'server', severity: 'success', title: 'Нода запущена', message: `${server.name} (${server.host})`, serverId: server.id, serverName: server.name });
  } else if (op.type === 'stop') {
    await stopServer(server);
    store.updateServer(op.serverId, { status: 'stopped' });
    logEvent({ type: 'server', severity: 'info', title: 'Нода остановлена', message: `${server.name} (${server.host})`, serverId: server.id, serverName: server.name });
  } else if (op.type === 'restart') {
    const result = await restartServer(server, clients);
    if (!result.ok) throw new Error(result.error || 'Не удалось перезапустить');
    store.updateServer(op.serverId, { status: 'running', error: undefined });
    logEvent({ type: 'server', severity: 'success', title: 'Нода перезапущена', message: `${server.name} (${server.host})`, serverId: server.id, serverName: server.name });
  } else if (op.type === 'regenerate-keys') {
    store.regenerateServerKeys(op.serverId);
    if (isServerRunning(op.serverId)) {
      const s = store.getServer(op.serverId)!;
      await startServer(s, store.getClientsByServer(op.serverId));
    }
    logEvent({ type: 'security', severity: 'info', title: 'Ключи регенерированы', message: server.name, serverId: server.id, serverName: server.name });
  }
});

// Экспорт enqueue для использования в роутах
export { enqueue };

// ── Фоновые задачи ────────────────────────────────────────────────────

// Хранилище предыдущих значений трафика для расчёта скорости
const prevTraffic = new Map<number, { up: number; down: number; time: number }>();

// Периодически опрашиваем статистику с запущенных нод + авто-лимиты.
setInterval(async () => {
  for (const server of store.servers) {
    if (isServerRunning(server.id)) {
      const stats = await queryStats(server);
      if (Object.keys(stats).length > 0) {
        // Считаем суммарный трафик и скорость
        const totalUp = Object.values(stats).reduce((a, s) => a + s.uplink, 0);
        const totalDown = Object.values(stats).reduce((a, s) => a + s.downlink, 0);
        const now = Date.now();
        const prev = prevTraffic.get(server.id);
        let uploadSpeed = 0;
        let downloadSpeed = 0;
        if (prev) {
          const dt = (now - prev.time) / 1000;
          if (dt > 0) {
            uploadSpeed = Math.max(0, (totalUp - prev.up) / dt / (1024 * 1024)); // МБ/с
            downloadSpeed = Math.max(0, (totalDown - prev.down) / dt / (1024 * 1024));
          }
        }
        prevTraffic.set(server.id, { up: totalUp, down: totalDown, time: now });
        store.updateTrafficStats(stats);
        store.updateServer(server.id, {
          totalUpload: totalUp / (1024 * 1024 * 1024),
          totalDownload: totalDown / (1024 * 1024 * 1024),
          uploadSpeed: Number(uploadSpeed.toFixed(2)),
          downloadSpeed: Number(downloadSpeed.toFixed(2)),
        });
      }
      const sysStats = await getSystemStats(server);
      store.updateServer(server.id, sysStats);
      // Записываем метрики для центра мониторинга
      recordMetrics(server.id, {
        cpu: sysStats.cpu,
        ram: sysStats.ram,
        disk: sysStats.disk,
        uptime: sysStats.uptime,
        uploadSpeed: server.uploadSpeed,
        downloadSpeed: server.downloadSpeed,
      });
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
      // Telegram-уведомления об изменениях
      if (store.settings.telegramNotifications) {
        for (const client of store.getClientsByServer(serverId)) {
          if (client.status === 'expired' || client.status === 'limited') {
            notifyClientLimit(client, client.status === 'expired' ? 'expired' : 'limited').catch(() => {});
          }
        }
      }
      // Журнал событий: фиксируем изменения статуса клиентов
      for (const client of store.getClientsByServer(serverId)) {
        if (client.status === 'expired') {
          logEvent({ type: 'client', severity: 'warning', title: 'Подписка истекла', message: `Клиент ${client.name} (${client.email})`, clientId: client.id, clientName: client.name });
        } else if (client.status === 'limited') {
          logEvent({ type: 'client', severity: 'warning', title: 'Лимит превышен', message: `Клиент ${client.name}: ${(client.upload + client.download).toFixed(1)} / ${client.totalLimit} ГБ`, clientId: client.id, clientName: client.name });
        }
      }
    }
  }
}, 10000);

// Проверяем, живы ли процессы на нодах.
setInterval(async () => {
  for (const server of store.servers) {
    if (isServerRunning(server.id)) {
      const alive = await verifyRunning(server);
      if (!alive) {
        store.updateServer(server.id, { status: 'stopped' });
        logEvent({ type: 'server', severity: 'warning', title: 'Процесс Xray упал', message: `${server.name} (${server.host}) — процесс не отвечает`, serverId: server.id, serverName: server.name });
        // Telegram-уведомление
        if (store.settings.telegramNotifications) {
          notifyServerStatus(server, 'running').catch(() => {});
        }
      }
    }
  }
}, 20000);

// Точка трафика каждые 10 минут (вместо часа)
setInterval(() => store.pushTrafficPoint(), 600000);
store.pushTrafficPoint();

// ── Маршруты ──────────────────────────────────────────────────────────

// Публичный эндпоинт подписок (не проходит через authMiddleware из-за path check)
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

  const subscription = Buffer.from(urls.join('\n')).toString('base64');
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Subscription-Userinfo', `upload=${(client.upload * 1024 * 1024 * 1024).toFixed(0)}; download=${(client.download * 1024 * 1024 * 1024).toFixed(0)}; total=${client.totalLimit > 0 ? client.totalLimit * 1024 * 1024 * 1024 : 0}; expire=${new Date(client.expiryDate).getTime() / 1000 | 0}`);
  res.send(subscription);
});

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Подключаем модульные маршруты
app.use('/api', serverRoutes);
app.use('/api', clientRoutes);
app.use('/api', systemRoutes);
app.use('/api', monitorRoutes);

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
