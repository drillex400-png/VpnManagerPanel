import { useEffect, useState } from 'react';
import { ListOrdered, X, Loader2, CheckCircle, XCircle, Clock, Play, Square, RotateCcw, KeyRound } from 'lucide-react';
import { api } from '../api';
import type { QueueOperation, OpType } from '../types';

const opConfig: Record<OpType, { icon: typeof Play; color: string; label: string }> = {
  start: { icon: Play, color: 'text-emerald-400', label: 'Запуск' },
  stop: { icon: Square, color: 'text-amber-400', label: 'Остановка' },
  restart: { icon: RotateCcw, color: 'text-violet-400', label: 'Перезапуск' },
  'regenerate-keys': { icon: KeyRound, color: 'text-cyan-400', label: 'Ключи' },
};

const statusConfig: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  pending: { icon: Clock, color: 'text-white/40', label: 'В очереди' },
  running: { icon: Loader2, color: 'text-violet-400', label: 'Выполняется' },
  done: { icon: CheckCircle, color: 'text-emerald-400', label: 'Готово' },
  failed: { icon: XCircle, color: 'text-red-400', label: 'Ошибка' },
};

function timeAgo(time: string) {
  const diff = Date.now() - new Date(time).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}с назад`;
  const mins = Math.floor(sec / 60);
  return `${mins} мин назад`;
}

export default function QueuePanel() {
  const [operations, setOperations] = useState<QueueOperation[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fetchQueue = () => api.monitor.queue().then(setOperations).catch(() => {});
    fetchQueue();
    const interval = setInterval(fetchQueue, 3000);
    return () => clearInterval(interval);
  }, []);

  const activeCount = operations.filter((o) => o.status === 'pending' || o.status === 'running').length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-10 h-10 rounded-full glass flex items-center justify-center relative active:scale-95 transition-transform"
      >
        <ListOrdered size={18} className="text-white/60" />
        {activeCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 rounded-full bg-violet-500 text-[9px] font-bold flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-12 right-0 w-80 max-w-[calc(100vw-2rem)] glass-card p-4 z-50 animate-scale-in max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <ListOrdered size={14} className="text-violet-400" />
                Очередь операций
              </h3>
              <button onClick={() => setOpen(false)} className="text-white/30">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-1.5">
              {operations.length === 0 && (
                <p className="text-xs text-white/30 text-center py-6">Очередь пуста</p>
              )}
              {operations.map((op) => {
                const oc = opConfig[op.type] || opConfig.start;
                const sc = statusConfig[op.status] || statusConfig.pending;
                return (
                  <div key={op.id} className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-white/[0.02]">
                    <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0`}>
                      <oc.icon size={14} className={oc.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium truncate">{oc.label}</span>
                        <span className="text-[10px] text-white/30 truncate">— {op.serverName}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <sc.icon size={10} className={`${sc.color} ${op.status === 'running' ? 'animate-spin' : ''}`} />
                        <span className={`text-[10px] ${sc.color}`}>{sc.label}</span>
                        <span className="text-[9px] text-white/20">· {timeAgo(op.createdAt)}</span>
                      </div>
                      {op.result && op.status === 'failed' && (
                        <p className="text-[9px] text-red-400/70 mt-0.5 truncate">{op.result}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
