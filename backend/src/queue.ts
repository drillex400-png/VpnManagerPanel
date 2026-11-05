import { logEvent } from './events';

export type OpType = 'start' | 'stop' | 'restart' | 'regenerate-keys';
export type OpStatus = 'pending' | 'running' | 'done' | 'failed';

export interface QueueOperation {
  id: number;
  type: OpType;
  serverId: number;
  serverName: string;
  status: OpStatus;
  result?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

const queue: QueueOperation[] = [];
let nextOpId = 1;
let processing = false;

let processFn: ((op: QueueOperation) => Promise<void>) | null = null;

export function setProcessor(fn: (op: QueueOperation) => Promise<void>): void {
  processFn = fn;
}

function typeLabel(t: OpType): string {
  const labels: Record<OpType, string> = {
    start: 'Запуск',
    stop: 'Остановка',
    restart: 'Перезапуск',
    'regenerate-keys': 'Регенерация ключей',
  };
  return labels[t] || t;
}

export function enqueue(type: OpType, serverId: number, serverName: string): QueueOperation {
  const op: QueueOperation = {
    id: nextOpId++,
    type,
    serverId,
    serverName,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  queue.unshift(op);
  logEvent({
    type: 'queue',
    severity: 'info',
    title: 'Операция в очереди',
    message: `${typeLabel(type)}: ${serverName}`,
    serverId,
    serverName,
  });
  void processNext();
  return op;
}

export function getQueue(): QueueOperation[] {
  return queue.slice(0, 50);
}

export function clearCompleted(): void {
  const cutoff = Date.now() - 60_000;
  for (let i = queue.length - 1; i >= 0; i--) {
    if ((queue[i].status === 'done' || queue[i].status === 'failed') && queue[i].completedAt) {
      if (new Date(queue[i].completedAt!).getTime() < cutoff) {
        queue.splice(i, 1);
      }
    }
  }
}

async function processNext(): Promise<void> {
  if (processing || !processFn) return;
  const op = [...queue].reverse().find((o) => o.status === 'pending');
  if (!op) return;
  processing = true;
  op.status = 'running';
  op.startedAt = new Date().toISOString();
  try {
    await processFn(op);
    op.status = 'done';
    op.completedAt = new Date().toISOString();
    logEvent({
      type: 'queue',
      severity: 'success',
      title: 'Операция завершена',
      message: `${typeLabel(op.type)}: ${op.serverName}`,
      serverId: op.serverId,
      serverName: op.serverName,
    });
  } catch (e) {
    op.status = 'failed';
    op.result = (e as Error).message;
    op.completedAt = new Date().toISOString();
    logEvent({
      type: 'queue',
      severity: 'error',
      title: 'Операция провалена',
      message: `${typeLabel(op.type)}: ${op.serverName} — ${(e as Error).message}`,
      serverId: op.serverId,
      serverName: op.serverName,
    });
  }
  processing = false;
  void processNext();
}
