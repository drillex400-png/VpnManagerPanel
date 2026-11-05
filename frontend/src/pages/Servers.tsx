import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, ChevronDown, Cpu, HardDrive, MemoryStick, Trash2, X, Globe, Wifi, Play, Square, Download, Loader2, RotateCcw, FileDown, ScrollText, Pencil, Shield, Layers, KeyRound, Plug } from 'lucide-react';
import { api } from '../api';
import { PROTOCOL_META } from '../protocols';
import type { Server, PingData, XrayVersions, Inbound } from '../types';
import InboundEditor from '../components/InboundEditor';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';

const flags = ['🇩🇪', '🇳🇱', '🇯🇵', '🇺🇸', '🇸🇬', '🇬🇧', '🇫🇷', '🇨🇦', '🌐'];
const REALITY_TARGETS = [
  { dest: 'www.microsoft.com:443', sni: 'www.microsoft.com' },
  { dest: 'www.apple.com:443', sni: 'www.apple.com' },
  { dest: 'www.cloudflare.com:443', sni: 'www.cloudflare.com' },
  { dest: 'www.amazon.com:443', sni: 'www.amazon.com' },
  { dest: 'www.google.com:443', sni: 'www.google.com' },
];

const emptyAddForm = {
  name: '', host: '', port: 443, location: '', flag: '🌐',
  xrayVersion: '', realityDest: 'www.microsoft.com:443', realitySNI: 'www.microsoft.com',
  sshPort: 22, sshUser: 'root', sshAuthType: 'password' as 'key' | 'password',
  sshPrivateKey: '', sshPassword: '',
};

export default function Servers() {
  const { success: toastSuccess, error: toastError } = useToast();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ ...emptyAddForm });
  const [versions, setVersions] = useState<XrayVersions | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [starting, setStarting] = useState<number | null>(null);
  const [restarting, setRestarting] = useState<number | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; info?: string; error?: string } | null>(null);
  const [pings, setPings] = useState<PingData[]>([]);
  const [editServer, setEditServer] = useState<Server | null>(null);
  const [editForm, setEditForm] = useState({ name: '', host: '', port: 443, location: '', flag: '🌐' });
  const [inboundEditor, setInboundEditor] = useState<{ server: Server; inbound?: Inbound | null } | null>(null);
  const [logsServer, setLogsServer] = useState<Server | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [logsInterval, setLogsInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null);
  const [confirmDeleteInbound, setConfirmDeleteInbound] = useState<{ serverId: number; inboundId: number; name: string; port: number } | null>(null);

  const load = useCallback(() => {
    api.servers.list().then((s) => {
      setServers(s);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
    api.xray.versions().then(v => {
      setVersions(v);
      if (!addForm.xrayVersion && v.available.length > 0) {
        setAddForm(prev => ({ ...prev, xrayVersion: v.available[0] }));
      }
    }).catch(console.error);
    api.ping().then(setPings).catch(console.error);
    const interval = setInterval(() => api.ping().then(setPings).catch(() => {}), 5000);
    return () => clearInterval(interval);
  }, [load]);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.servers.testConnection(addForm);
      setTestResult(res);
      if (res.ok) toastSuccess('Соединение с нодой установлено');
      else toastError(res.error || 'Не удалось подключиться');
    } catch (e) {
      setTestResult({ ok: false, error: (e as Error).message });
      toastError(`Ошибка: ${(e as Error).message}`);
    }
    setTesting(false);
  };

  const handleAdd = () => {
    api.servers.create(addForm).then(() => {
      setShowAdd(false);
      setAddForm({ ...emptyAddForm });
      setTestResult(null);
      load();
      toastSuccess('Нода добавлена');
    }).catch((e) => toastError(`Ошибка: ${(e as Error).message}`));
  };

  const handleDelete = (id: number) => {
    api.servers.delete(id).then(() => {
      load();
      toastSuccess('Нода удалена');
    });
  };

  const handleStart = async (id: number) => {
    setStarting(id);
    try {
      const res = await api.servers.start(id);
      if (res.success) {
        toastSuccess('Xray запущен на ноде');
      } else if (res.error) {
        toastError(`Не удалось запустить: ${res.error}`);
      }
    } catch (e) {
      toastError(`Ошибка: ${(e as Error).message}`);
    }
    setStarting(null);
    load();
  };

  const handleStop = async (id: number) => {
    await api.servers.stop(id);
    load();
  };

  const handleDownloadVersion = async (version: string) => {
    setDownloading(version);
    try {
      await api.xray.download(version);
      const v = await api.xray.versions();
      setVersions(v);
      toastSuccess(`Xray ${version} загружен`);
    } catch (e) {
      toastError(`Ошибка загрузки: ${(e as Error).message}`);
    }
    setDownloading(null);
  };

  const handleRestart = async (id: number) => {
    setRestarting(id);
    try {
      const res = await api.servers.restart(id);
      if (res.success) toastSuccess('Нода перезапущена');
      else if (res.error) toastError(`Ошибка перезапуска: ${res.error}`);
    } catch (e) {
      toastError(`Ошибка: ${(e as Error).message}`);
    }
    setRestarting(null);
    load();
  };

  const handleEdit = (s: Server) => {
    setEditServer(s);
    setEditForm({ name: s.name, host: s.host, port: s.port, location: s.location, flag: s.flag });
  };

  const handleEditSave = () => {
    if (!editServer) return;
    api.servers.update(editServer.id, editForm).then(() => {
      setEditServer(null);
      load();
    });
  };

  const handleExportConfig = async (id: number) => {
    try {
      const { config, filename } = await api.servers.config(id);
      const blob = new Blob([config], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toastSuccess('Конфиг экспортирован');
    } catch (e) {
      toastError(`Ошибка экспорта: ${(e as Error).message}`);
    }
  };

  const openLogs = (s: Server) => {
    setLogsServer(s);
    api.servers.logs(s.id).then((r) => setLogs(r.logs));
    const interval = setInterval(() => {
      api.servers.logs(s.id).then((r) => setLogs(r.logs));
    }, 2000);
    setLogsInterval(interval);
  };

  const closeLogs = () => {
    if (logsInterval) clearInterval(logsInterval);
    setLogsInterval(null);
    setLogsServer(null);
    setLogs([]);
  };

  const clearLogs = (id: number) => {
    api.servers.clearLogs(id).then(() => setLogs([]));
  };

  const filtered = servers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.location.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const statusStyle = (s: string) =>
    s === 'running'
      ? { dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Запущен' }
      : s === 'error'
        ? { dot: 'bg-red-400', text: 'text-red-400', bg: 'bg-red-500/10', label: 'Ошибка' }
        : { dot: 'bg-white/30', text: 'text-white/50', bg: 'bg-white/5', label: 'Остановлен' };

  return (
    <div className="px-4 py-6 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[1.6rem] font-bold font-display">Ноды</h1>
          <p className="text-sm text-white/40">{servers.length} нод • {servers.filter(s => s.status === 'running').length} запущено</p>
        </div>
      </div>

      {/* Поиск */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск нод..."
          className="glass-input w-full pl-11 pr-4 py-3 text-sm"
        />
      </div>

      {/* Пустое состояние */}
      {filtered.length === 0 && (
        <div className="glass-card p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto mb-4">
            <Globe size={28} className="text-violet-400" />
          </div>
          <p className="text-sm text-white/60 mb-1">Нод пока нет</p>
          <p className="text-xs text-white/30">Добавьте первую ноду с доступом по SSH</p>
        </div>
      )}

      {/* Карточки нод */}
      {filtered.map((s) => {
        const st = statusStyle(s.status);
        const isExp = expanded === s.id;
        return (
          <div key={s.id} className="glass-card overflow-hidden animate-slide-up">
            <button
              onClick={() => setExpanded(isExp ? null : s.id)}
              className="w-full p-4 text-left"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{s.flag}</span>
                  <div>
                    <p className="font-semibold font-display">{s.name}</p>
                    <p className="text-xs text-white/40 flex items-center gap-1">
                      <Globe size={11} /> {s.host}:{s.port}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${st.bg} ${st.text} font-medium`}>
                    {st.label}
                  </span>
                  {(() => {
                    const p = pings.find((pp) => pp.id === s.id);
                    const pv = p?.ping ?? -1;
                    const pc = pv < 0 ? 'text-white/20' : pv < 50 ? 'text-emerald-400' : pv < 150 ? 'text-amber-400' : 'text-red-400';
                    return <span className={`flex items-center gap-0.5 text-[10px] font-mono ${pc}`}><Wifi size={10} />{pv > 0 ? `${pv}мс` : '—'}</span>;
                  })()}
                  <ChevronDown
                    size={18}
                    className={`text-white/30 transition-transform ${isExp ? 'rotate-180' : ''}`}
                  />
                </div>
              </div>

              {/* Теги протоколов */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(s.inbounds || []).map((ib) => {
                  const meta = PROTOCOL_META[ib.protocol] || { name: ib.protocol, color: '#888' };
                  return (
                    <span
                      key={ib.id}
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: meta.color + '15', color: meta.color }}
                    >
                      {meta.name} · {ib.security} :{ib.port}
                    </span>
                  );
                })}
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40 font-medium">
                  Xray {s.xrayVersion}
                </span>
              </div>

              {/* Ресурсы */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: Cpu, label: 'ЦП', value: s.cpu },
                  { icon: MemoryStick, label: 'ОЗУ', value: s.ram },
                  { icon: HardDrive, label: 'Диск', value: 0 },
                ].map((r, i) => (
                  <div key={i} className="glass-soft rounded-xl p-2">
                    <div className="flex items-center gap-1 mb-1">
                      <r.icon size={11} className="text-white/30" />
                      <span className="text-[9px] text-white/30">{r.label}</span>
                    </div>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${r.value > 80 ? 'bg-red-400' : r.value > 60 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                        style={{ width: `${r.value}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-white/40 mt-0.5 block">{r.value}%</span>
                  </div>
                ))}
              </div>
            </button>

            {isExp && (
              <div className="border-t border-white/5 p-4 space-y-3 animate-slide-down">
                {/* Сообщение об ошибке */}
                {s.error && (
                  <div className="flex items-start gap-2 p-3 rounded-2xl bg-red-500/10 text-red-400 text-xs">
                    <X size={14} className="flex-shrink-0 mt-0.5" />
                    <span className="break-all">{s.error}</span>
                  </div>
                )}

                {/* Основные кнопки */}
                <div className="flex gap-2">
                  {s.status !== 'running' ? (
                    <button
                      onClick={() => handleStart(s.id)}
                      disabled={starting === s.id}
                      className="flex-1 py-2.5 rounded-2xl bg-emerald-500/15 text-emerald-400 text-xs font-medium hover:bg-emerald-500/25 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {starting === s.id ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                      {starting === s.id ? 'Запуск...' : 'Запустить'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStop(s.id)}
                      className="flex-1 py-2.5 rounded-2xl bg-amber-500/15 text-amber-400 text-xs font-medium hover:bg-amber-500/25 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Square size={14} /> Остановить
                    </button>
                  )}
                  {s.status === 'running' && (
                    <button
                      onClick={() => handleRestart(s.id)}
                      disabled={restarting === s.id}
                      className="flex-1 py-2.5 rounded-2xl bg-violet-500/15 text-violet-400 text-xs font-medium hover:bg-violet-500/25 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {restarting === s.id ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                      {restarting === s.id ? '...' : 'Рестарт'}
                    </button>
                  )}
                  <button
                    onClick={() => setConfirmDelete({ id: s.id, name: s.name })}
                    className="py-2.5 px-3 rounded-2xl bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors flex items-center justify-center"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Инбаунды */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[11px] text-white/50 font-medium">
                    <Layers size={13} className="text-violet-400" />
                    Инбаунды ({(s.inbounds || []).length})
                  </div>
                  {(s.inbounds || []).map((ib) => {
                    const meta = PROTOCOL_META[ib.protocol] || { name: ib.protocol, color: '#888' };
                    return (
                      <div key={ib.id} className="flex items-center gap-2 glass-soft rounded-xl p-2.5">
                        <span
                          className="text-[10px] px-2 py-1 rounded-full font-medium flex-shrink-0"
                          style={{ background: meta.color + '15', color: meta.color }}
                        >
                          {meta.name}
                        </span>
                        <span className="text-[10px] text-white/40 flex-1 truncate">
                          {ib.network} · {ib.security} · :{ib.port}
                        </span>
                        <button
                          onClick={() => setInboundEditor({ server: s, inbound: ib })}
                          className="text-white/30 hover:text-violet-400 transition-colors flex-shrink-0"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteInbound({ serverId: s.id, inboundId: ib.id, name: meta.name, port: ib.port })}
                          className="text-white/20 hover:text-red-400 transition-colors flex-shrink-0"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                  <button
                    onClick={() => setInboundEditor({ server: s, inbound: null })}
                    className="w-full py-2.5 rounded-2xl bg-violet-500/10 text-violet-300 text-[11px] font-medium hover:bg-violet-500/20 transition-colors flex items-center justify-center gap-1.5 ring-1 ring-violet-500/20"
                  >
                    <Plus size={13} /> Добавить инбаунд
                  </button>
                </div>

                {/* Доп. действия */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    onClick={() => handleEdit(s)}
                    className="py-2.5 rounded-2xl bg-white/5 text-white/60 text-[11px] font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Pencil size={13} /> Изменить
                  </button>
                  <button
                    onClick={() => openLogs(s)}
                    className="py-2.5 rounded-2xl bg-white/5 text-white/60 text-[11px] font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <ScrollText size={13} /> Логи
                  </button>
                  <button
                    onClick={() => handleExportConfig(s.id)}
                    className="py-2.5 rounded-2xl bg-white/5 text-white/60 text-[11px] font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <FileDown size={13} /> Экспорт
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* FAB */}
      <button onClick={() => setShowAdd(true)} className="fab">
        <Plus size={24} />
      </button>

      {/* Модальное окно добавления ноды */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowAdd(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
          <div
            className="relative w-full max-w-md glass-card rounded-t-[2rem] p-6 animate-slide-up space-y-4 max-h-[88vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold font-display">Добавить ноду</h2>
              <button onClick={() => setShowAdd(false)} className="text-white/40">
                <X size={20} />
              </button>
            </div>

            {/* Основные данные */}
            <div className="space-y-2">
              <p className="text-[11px] text-white/40 font-medium">Данные ноды</p>
              <input
                placeholder="Имя ноды"
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                className="glass-input w-full px-4 py-3 text-sm"
              />
              <input
                placeholder="Хост / IP (например vpn.example.com)"
                value={addForm.host}
                onChange={(e) => setAddForm({ ...addForm, host: e.target.value })}
                className="glass-input w-full px-4 py-3 text-sm"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  placeholder="Порт Xray"
                  value={addForm.port}
                  onChange={(e) => setAddForm({ ...addForm, port: Number(e.target.value) })}
                  className="glass-input w-full px-4 py-3 text-sm"
                />
                <input
                  placeholder="Локация"
                  value={addForm.location}
                  onChange={(e) => setAddForm({ ...addForm, location: e.target.value })}
                  className="glass-input w-full px-4 py-3 text-sm"
                />
              </div>
            </div>

            {/* Флаг */}
            <div className="flex gap-2 flex-wrap">
              {flags.map((f) => (
                <button
                  key={f}
                  onClick={() => setAddForm({ ...addForm, flag: f })}
                  className={`text-xl p-1.5 rounded-xl transition-all ${addForm.flag === f ? 'bg-violet-500/20 ring-1 ring-violet-500/50' : 'bg-white/5'}`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* SSH-доступ */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] text-white/40 font-medium">
                <KeyRound size={12} className="text-violet-400" />
                Доступ по SSH
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  placeholder="Пользователь"
                  value={addForm.sshUser}
                  onChange={(e) => setAddForm({ ...addForm, sshUser: e.target.value })}
                  className="glass-input w-full px-4 py-3 text-sm"
                />
                <input
                  type="number"
                  placeholder="Порт SSH"
                  value={addForm.sshPort}
                  onChange={(e) => setAddForm({ ...addForm, sshPort: Number(e.target.value) })}
                  className="glass-input w-full px-4 py-3 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setAddForm({ ...addForm, sshAuthType: 'password' })}
                  className={`py-2.5 rounded-2xl text-xs font-medium transition-all ${addForm.sshAuthType === 'password' ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/40' : 'bg-white/5 text-white/50'}`}
                >
                  По паролю
                </button>
                <button
                  onClick={() => setAddForm({ ...addForm, sshAuthType: 'key' })}
                  className={`py-2.5 rounded-2xl text-xs font-medium transition-all ${addForm.sshAuthType === 'key' ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/40' : 'bg-white/5 text-white/50'}`}
                >
                  По ключу
                </button>
              </div>
              {addForm.sshAuthType === 'password' ? (
                <input
                  type="password"
                  placeholder="Пароль SSH"
                  value={addForm.sshPassword}
                  onChange={(e) => setAddForm({ ...addForm, sshPassword: e.target.value })}
                  className="glass-input w-full px-4 py-3 text-sm font-mono"
                />
              ) : (
                <textarea
                  placeholder="Приватный ключ SSH (вставьте содержимое)"
                  value={addForm.sshPrivateKey}
                  onChange={(e) => setAddForm({ ...addForm, sshPrivateKey: e.target.value })}
                  rows={4}
                  className="glass-input w-full px-4 py-3 text-sm font-mono resize-none"
                />
              )}

              {/* Проверка соединения */}
              <button
                onClick={handleTestConnection}
                disabled={!addForm.host || !addForm.sshUser || testing}
                className="w-full py-2.5 rounded-2xl bg-violet-500/15 text-violet-400 text-xs font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {testing ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />}
                {testing ? 'Проверка...' : 'Проверить соединение'}
              </button>
              {testResult && (
                <div className={`text-[11px] p-2.5 rounded-2xl ${testResult.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                  {testResult.ok ? '✓ Подключение успешно' : `✗ ${testResult.error || 'Ошибка'}`}
                  {testResult.ok && testResult.info && (
                    <p className="text-[9px] text-white/30 mt-1 font-mono break-all">{testResult.info}</p>
                  )}
                </div>
              )}
            </div>

            {/* Версия Xray */}
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Версия Xray</label>
              <select
                value={addForm.xrayVersion || versions?.default || ''}
                onChange={(e) => setAddForm({ ...addForm, xrayVersion: e.target.value })}
                className="glass-input w-full px-4 py-3 text-sm"
              >
                {versions?.available?.length ? (
                  versions.available.map((v) => (
                    <option key={v} value={v} className="bg-surface">
                      {v} {versions.downloaded.includes(v) ? '✓' : '(нужна загрузка)'}
                    </option>
                  ))
                ) : (
                  <option value={versions?.default || 'v25.10.15'} className="bg-surface">
                    {versions?.default || 'v25.10.15'} (по умолчанию)
                  </option>
                )}
              </select>
              {addForm.xrayVersion && versions && !versions.downloaded.includes(addForm.xrayVersion) && (
                <button
                  onClick={() => handleDownloadVersion(addForm.xrayVersion)}
                  disabled={downloading === addForm.xrayVersion}
                  className="w-full mt-2 py-2.5 rounded-2xl bg-violet-500/15 text-violet-400 text-xs font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {downloading === addForm.xrayVersion ? (
                    <><Loader2 size={14} className="animate-spin" /> Загрузка...</>
                  ) : (
                    <><Download size={14} /> Загрузить Xray {addForm.xrayVersion}</>
                  )}
                </button>
              )}
            </div>

            {/* Reality SNI */}
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Цель Reality (SNI)</label>
              <select
                value={addForm.realityDest}
                onChange={(e) => {
                  const target = REALITY_TARGETS.find(t => t.dest === e.target.value);
                  if (target) {
                    setAddForm({ ...addForm, realityDest: target.dest, realitySNI: target.sni });
                  } else {
                    setAddForm({ ...addForm, realityDest: e.target.value, realitySNI: e.target.value.split(':')[0] });
                  }
                }}
                className="glass-input w-full px-4 py-3 text-sm"
              >
                {REALITY_TARGETS.map((t) => (
                  <option key={t.dest} value={t.dest} className="bg-surface">{t.sni}</option>
                ))}
              </select>
            </div>

            <p className="text-[10px] text-white/30 leading-relaxed">
              Ключи X25519 и Reality short IDs генерируются автоматически. Панель подключается к ноде по SSH, устанавливает Xray и управляет им удалённо. Все настройки протокола доступны позже в редакторе инбаундов.
            </p>

            <button
              onClick={handleAdd}
              disabled={!addForm.name || !addForm.host || !addForm.sshUser}
              className="btn-primary w-full py-3.5 text-sm"
            >
              Добавить ноду
            </button>
          </div>
        </div>
      )}

      {/* Редактирование ноды */}
      {editServer && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setEditServer(null)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
          <div
            className="relative w-full max-w-md glass-card rounded-t-[2rem] p-6 animate-slide-up space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold font-display">Изменить ноду</h2>
              <button onClick={() => setEditServer(null)} className="text-white/40">
                <X size={20} />
              </button>
            </div>
            <input
              placeholder="Имя ноды"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="glass-input w-full px-4 py-3 text-sm"
            />
            <input
              placeholder="Хост / IP"
              value={editForm.host}
              onChange={(e) => setEditForm({ ...editForm, host: e.target.value })}
              className="glass-input w-full px-4 py-3 text-sm"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                placeholder="Порт"
                value={editForm.port}
                onChange={(e) => setEditForm({ ...editForm, port: Number(e.target.value) })}
                className="glass-input w-full px-4 py-3 text-sm"
              />
              <input
                placeholder="Локация"
                value={editForm.location}
                onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
              className="glass-input w-full px-4 py-3 text-sm"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {flags.map((f) => (
                <button
                  key={f}
                  onClick={() => setEditForm({ ...editForm, flag: f })}
                  className={`text-xl p-1.5 rounded-xl transition-all ${editForm.flag === f ? 'bg-violet-500/20 ring-1 ring-violet-500/50' : 'bg-white/5'}`}
                >
                  {f}
                </button>
              ))}
            </div>
            <button
              onClick={handleEditSave}
              disabled={!editForm.name || !editForm.host}
              className="btn-primary w-full py-3.5 text-sm"
            >
              Сохранить
            </button>
          </div>
        </div>
      )}

      {/* Редактор инбаундов */}
      {inboundEditor && (
        <InboundEditor
          server={inboundEditor.server}
          inbound={inboundEditor.inbound}
          onClose={() => setInboundEditor(null)}
          onSaved={load}
        />
      )}

      {/* Подтверждение удаления ноды */}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Удалить ноду"
        message={`Удалить «${confirmDelete?.name}»? Xray будет остановлен, а все клиенты и инбаунды этой ноды удалены. Действие необратимо.`}
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        variant="danger"
        onConfirm={() => {
          if (confirmDelete) handleDelete(confirmDelete.id);
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Подтверждение удаления инбаунда */}
      <ConfirmDialog
        open={!!confirmDeleteInbound}
        title="Удалить инбаунд"
        message={`Удалить инбаунд ${confirmDeleteInbound?.name} на порту ${confirmDeleteInbound?.port}? Клиенты этого протокола потеряют связь.`}
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        variant="danger"
        onConfirm={() => {
          if (confirmDeleteInbound) {
            api.servers.deleteInbound(confirmDeleteInbound.serverId, confirmDeleteInbound.inboundId).then(() => {
              load();
              toastSuccess('Инбаунд удалён');
            });
          }
          setConfirmDeleteInbound(null);
        }}
        onCancel={() => setConfirmDeleteInbound(null)}
      />

      {/* Логи */}
      {logsServer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={closeLogs}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
          <div
            className="relative glass-card m-4 p-5 max-w-md w-full max-h-[70vh] flex flex-col animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ScrollText size={16} className="text-violet-400" />
                <h2 className="text-base font-bold font-display">{logsServer.flag} {logsServer.name}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => clearLogs(logsServer.id)}
                  className="text-[10px] px-2 py-1 rounded-lg bg-white/5 text-white/40 hover:text-white/70"
                >
                  Очистить
                </button>
                <button onClick={closeLogs} className="text-white/40">
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-black/40 rounded-2xl p-3 space-y-0.5">
              {logs.length === 0 ? (
                <p className="text-xs text-white/30 text-center py-8">Логов пока нет. Запустите ноду, чтобы видеть логи.</p>
              ) : (
                logs.map((line, i) => (
                  <p
                    key={i}
                    className={`text-[10px] font-mono leading-relaxed ${
                      line.includes('[stderr]') || line.toLowerCase().includes('error') ? 'text-red-400' : 'text-white/50'
                    }`}
                  >
                    {line}
                  </p>
                ))
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-2 justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[9px] text-white/30">в реальном времени</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
