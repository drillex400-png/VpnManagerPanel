import { useEffect, useState, useCallback } from 'react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { Activity, Cpu, MemoryStick, HardDrive, Clock, Wifi, Terminal, ShieldCheck, AlertCircle, CheckCircle, XCircle, Loader2, RefreshCw, Trash2, Server as ServerIcon } from 'lucide-react';
import { PageLoading, PageError } from '../components/PageState';
import { api } from '../api';
import type { EventEntry, MetricPoint, DiagnosticsData, Server } from '../types';
import { useToast } from '../components/Toast';

const eventIcons = {
  server: { icon: ServerIcon, color: 'text-violet-400', bg: 'bg-violet-500/10' },
  client: { icon: Activity, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  queue: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  system: { icon: Terminal, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  security: { icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
};

const severityDot: Record<string, string> = {
  info: 'bg-blue-400',
  warning: 'bg-amber-400',
  error: 'bg-red-400',
  success: 'bg-emerald-400',
};

function timeAgo(time: string) {
  const diff = Date.now() - new Date(time).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}с назад`;
  const mins = Math.floor(sec / 60);
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч назад`;
  return `${Math.floor(hours / 24)} дн назад`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}д ${hours}ч`;
  return `${hours}ч`;
}

export default function Monitor() {
  const { success: toastSuccess, error: toastError } = useToast();
  const [servers, setServers] = useState<Server[]>([]);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [eventFilter, setEventFilter] = useState('all');
  const [metrics, setMetrics] = useState<Record<number, MetricPoint[]>>({});
  const [selectedServer, setSelectedServer] = useState<number | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    Promise.all([
      api.servers.list(),
      api.monitor.events(eventFilter),
      api.monitor.allMetrics(),
    ]).then(([s, e, m]) => {
      setServers(s);
      setEvents(e);
      setMetrics(m);
      if (selectedServer === null && s.length > 0) setSelectedServer(s[0].id);
      setLoading(false);
    }).catch((err) => {
      setError(err.message || 'Ошибка загрузки монитора');
      setLoading(false);
    });
  }, [eventFilter, selectedServer]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

  const runDiagnostics = async (serverId: number) => {
    setDiagLoading(true);
    setDiagnostics(null);
    try {
      const diag = await api.monitor.diagnostics(serverId);
      setDiagnostics(diag);
    } catch (e) {
      toastError(`Ошибка диагностики: ${(e as Error).message}`);
    }
    setDiagLoading(false);
  };

  const clearEvents = () => {
    api.monitor.clearEvents().then(() => {
      setEvents([]);
      toastSuccess('Журнал очищен');
    });
  };

  if (loading) return <PageLoading />;
  if (error) return <PageError message={error} onRetry={load} />;

  const serverMetrics = selectedServer ? metrics[selectedServer] || [] : [];
  const filterTabs = [
    { key: 'all', label: 'Все' },
    { key: 'server', label: 'Ноды' },
    { key: 'client', label: 'Клиенты' },
    { key: 'queue', label: 'Очередь' },
    { key: 'security', label: 'Безопасность' },
  ];

  return (
    <div className="px-4 py-6 space-y-5 animate-fade-in">
      <div>
        <h1 className="text-[1.6rem] font-bold font-display">Монитор</h1>
        <p className="text-sm text-white/40">Живые метрики, диагностика и журнал событий</p>
      </div>

      {/* Выбор ноды */}
      {servers.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {servers.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedServer(s.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                selectedServer === s.id
                  ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/40'
                  : 'bg-white/5 text-white/40'
              }`}
            >
              <span>{s.flag}</span>
              {s.name}
              <span className={`w-1.5 h-1.5 rounded-full ${s.status === 'running' ? 'bg-emerald-400' : s.status === 'error' ? 'bg-red-400' : 'bg-white/30'}`} />
            </button>
          ))}
        </div>
      )}

      {/* Метрики ноды */}
      {selectedServer && serverMetrics.length > 0 && (
        <div className="space-y-3">
          {/* Текущие показатели */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Cpu, label: 'ЦП', value: serverMetrics[serverMetrics.length - 1]?.cpu || 0, color: '#8B5CF6' },
              { icon: MemoryStick, label: 'ОЗУ', value: serverMetrics[serverMetrics.length - 1]?.ram || 0, color: '#06B6D4' },
              { icon: HardDrive, label: 'Диск', value: serverMetrics[serverMetrics.length - 1]?.disk || 0, color: '#F59E0B' },
            ].map((m, i) => (
              <div key={i} className="glass-card p-3 text-center">
                <div className="flex items-center justify-center mb-2">
                  <m.icon size={16} style={{ color: m.color }} />
                </div>
                <p className="text-xl font-bold">{m.value}%</p>
                <p className="text-[10px] text-white/30 mt-0.5">{m.label}</p>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden mt-2">
                  <div
                    className={`h-full rounded-full ${m.value > 80 ? 'bg-red-400' : m.value > 60 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                    style={{ width: `${m.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Графики */}
          <div className="glass-card p-5">
            <h2 className="text-sm font-semibold text-white/60 mb-4">Загрузка ресурсов (24ч)</h2>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={serverMetrics} margin={{ top: 5, right: 5, left: -28, bottom: 0 }}>
                <XAxis
                  dataKey="time"
                  tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: string) => new Date(v).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  interval={Math.max(0, Math.floor(serverMetrics.length / 5))}
                />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ background: '#16161F', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
                  labelFormatter={(v: string) => new Date(v).toLocaleString('ru-RU')}
                />
                <Line type="monotone" dataKey="cpu" stroke="#8B5CF6" strokeWidth={2} dot={false} name="ЦП" />
                <Line type="monotone" dataKey="ram" stroke="#06B6D4" strokeWidth={2} dot={false} name="ОЗУ" />
                <Line type="monotone" dataKey="disk" stroke="#F59E0B" strokeWidth={2} dot={false} name="Диск" />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2">
              {[
                { c: '#8B5CF6', l: 'ЦП' },
                { c: '#06B6D4', l: 'ОЗУ' },
                { c: '#F59E0B', l: 'Диск' },
              ].map((item) => (
                <div key={item.l} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: item.c }} />
                  <span className="text-[10px] text-white/40">{item.l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Uptime и скорость */}
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={14} className="text-emerald-400" />
                <span className="text-xs text-white/40">Uptime</span>
              </div>
              <p className="text-lg font-bold">
                {formatUptime(serverMetrics[serverMetrics.length - 1]?.uptime || 0)}
              </p>
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity size={14} className="text-cyan-400" />
                <span className="text-xs text-white/40">Скорость</span>
              </div>
              <p className="text-lg font-bold">
                ↑{serverMetrics[serverMetrics.length - 1]?.uploadSpeed || 0}{' '}
                <span className="text-xs text-white/30">↓{serverMetrics[serverMetrics.length - 1]?.downloadSpeed || 0}</span>
              </p>
              <p className="text-[10px] text-white/30">МБ/с</p>
            </div>
          </div>
        </div>
      )}

      {selectedServer && serverMetrics.length === 0 && (
        <div className="glass-card p-8 text-center">
          <Activity size={28} className="text-white/20 mx-auto mb-3" />
          <p className="text-sm text-white/40">Метрики ещё не собраны</p>
          <p className="text-xs text-white/30 mt-1">Данные появятся через несколько минут после запуска ноды</p>
        </div>
      )}

      {/* Диагностика */}
      {selectedServer && (
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/60 flex items-center gap-2">
              <Terminal size={14} className="text-violet-400" /> Диагностика
            </h2>
            <button
              onClick={() => runDiagnostics(selectedServer)}
              disabled={diagLoading}
              className="text-xs px-3 py-1.5 rounded-xl bg-violet-500/15 text-violet-400 font-medium flex items-center gap-1.5 disabled:opacity-50 active:scale-95 transition-transform"
            >
              {diagLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              {diagLoading ? 'Проверка...' : 'Проверить'}
            </button>
          </div>

          {diagnostics && !diagLoading && (
            <div className="space-y-2 animate-slide-down">
              <DiagRow
                label="SSH-соединение"
                ok={diagnostics.sshOk}
                value={diagnostics.sshOk ? 'Доступен' : 'Ошибка'}
                detail={diagnostics.sshError || undefined}
              />
              <DiagRow
                label="Процесс Xray"
                ok={diagnostics.xrayProcess}
                value={diagnostics.xrayProcess ? 'Работает' : diagnostics.running ? 'Не отвечает' : 'Остановлен'}
              />
              <DiagRow
                label="TCP-пинг"
                ok={diagnostics.ping > 0}
                value={diagnostics.ping > 0 ? `${diagnostics.ping} мс` : 'Недоступен'}
              />
              {diagnostics.systemStats && (
                <div className="grid grid-cols-3 gap-2 pt-2">
                  {[
                    { label: 'ЦП', value: diagnostics.systemStats.cpu, unit: '%' },
                    { label: 'ОЗУ', value: diagnostics.systemStats.ram, unit: '%' },
                    { label: 'Диск', value: diagnostics.systemStats.disk, unit: '%' },
                  ].map((s, i) => (
                    <div key={i} className="glass-soft rounded-xl p-2.5 text-center">
                      <p className="text-sm font-bold">{s.value}{s.unit}</p>
                      <p className="text-[9px] text-white/30">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!diagnostics && !diagLoading && (
            <p className="text-xs text-white/30 text-center py-2">Нажмите «Проверить» для запуска диагностики</p>
          )}
        </div>
      )}

      {/* Журнал событий */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white/60 flex items-center gap-2">
            <Clock size={14} className="text-violet-400" /> Журнал событий
          </h2>
          <button
            onClick={clearEvents}
            className="text-[10px] px-2 py-1 rounded-lg bg-white/5 text-white/40 hover:text-red-400 flex items-center gap-1"
          >
            <Trash2 size={10} /> Очистить
          </button>
        </div>

        {/* Фильтры событий */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3">
          {filterTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setEventFilter(t.key)}
              className={`px-3 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-all ${
                eventFilter === t.key
                  ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/40'
                  : 'bg-white/5 text-white/40'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {events.length === 0 && (
            <p className="text-xs text-white/30 text-center py-6">Событий пока нет</p>
          )}
          {events.map((e) => {
            const cfg = eventIcons[e.type] || eventIcons.system;
            return (
              <div key={e.id} className="flex gap-3 items-start p-2.5 rounded-2xl bg-white/[0.02]">
                <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                  <cfg.icon size={14} className={cfg.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${severityDot[e.severity]}`} />
                    <p className="text-xs font-medium">{e.title}</p>
                  </div>
                  <p className="text-[10px] text-white/40 mt-0.5 leading-snug">{e.message}</p>
                  <p className="text-[9px] text-white/20 mt-1">{timeAgo(e.timestamp)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DiagRow({ label, ok, value, detail }: { label: string; ok: boolean; value: string; detail?: string }) {
  return (
    <div className="flex items-center justify-between p-2.5 rounded-xl glass-soft">
      <div className="flex items-center gap-2">
        {ok ? (
          <CheckCircle size={14} className="text-emerald-400" />
        ) : (
          <XCircle size={14} className="text-red-400" />
        )}
        <span className="text-xs text-white/60">{label}</span>
      </div>
      <div className="text-right">
        <p className={`text-xs font-medium ${ok ? 'text-emerald-400' : 'text-red-400'}`}>{value}</p>
        {detail && <p className="text-[9px] text-white/30 mt-0.5 max-w-[180px] truncate">{detail}</p>}
      </div>
    </div>
  );
}
