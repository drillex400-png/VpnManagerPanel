import { Router } from 'express';
import { store } from '../store';
import { getEvents, clearEvents } from '../events';
import { getQueue, clearCompleted } from '../queue';
import {
  isServerRunning,
  verifyRunning,
  tcpPing,
  testConnection,
  getSystemStats,
} from '../xray/manager';

const router = Router();

// ── Метрики (в памяти, 10-мин интервалы, 144 точки = 24ч) ──────────────

interface MetricPoint {
  time: string;
  cpu: number;
  ram: number;
  disk: number;
  uptime: number;
  uploadSpeed: number;
  downloadSpeed: number;
}

const metricsHistory = new Map<number, MetricPoint[]>();
const MAX_POINTS = 144;

export function recordMetrics(
  serverId: number,
  metrics: { cpu: number; ram: number; disk: number; uptime: number; uploadSpeed: number; downloadSpeed: number },
): void {
  if (!metricsHistory.has(serverId)) metricsHistory.set(serverId, []);
  const arr = metricsHistory.get(serverId)!;
  arr.push({ time: new Date().toISOString(), ...metrics });
  if (arr.length > MAX_POINTS) arr.shift();
}

// ── Журнал событий ────────────────────────────────────────────────────

router.get('/events', (req, res) => {
  const limit = Number(req.query.limit) || 100;
  const filter = (req.query.filter as string) || 'all';
  res.json(getEvents(limit, filter));
});

router.delete('/events', (_req, res) => {
  clearEvents();
  res.json({ success: true });
});

// ── Метрики ───────────────────────────────────────────────────────────

router.get('/metrics/:serverId', (req, res) => {
  const serverId = Number(req.params.serverId);
  res.json(metricsHistory.get(serverId) || []);
});

router.get('/metrics', (_req, res) => {
  const result: Record<number, MetricPoint[]> = {};
  for (const [id, points] of metricsHistory) {
    result[id] = points.slice(-20);
  }
  res.json(result);
});

// ── Диагностика ноды ──────────────────────────────────────────────────

router.get('/diagnostics/:serverId', async (req, res) => {
  const serverId = Number(req.params.serverId);
  const server = store.getServer(serverId);
  if (!server) return res.status(404).json({ error: 'Сервер не найден' });

  const diag = {
    serverId,
    serverName: server.name,
    running: isServerRunning(serverId),
    ping: -1,
    sshOk: false,
    sshError: '',
    xrayProcess: false,
    systemStats: null as { cpu: number; ram: number; disk: number; uptime: number } | null,
  };

  diag.ping = await tcpPing(server.host, server.port);

  try {
    const sshResult = await testConnection(server);
    diag.sshOk = sshResult.ok;
    diag.sshError = sshResult.error || '';
  } catch (e) {
    diag.sshError = (e as Error).message;
  }

  if (isServerRunning(serverId)) {
    diag.xrayProcess = await verifyRunning(server);
  }

  if (diag.sshOk) {
    diag.systemStats = await getSystemStats(server);
  }

  res.json(diag);
});

// ── Очередь операций ─────────────────────────────────────────────────

router.get('/queue', (_req, res) => {
  clearCompleted();
  res.json(getQueue());
});

export default router;
