import { useEffect, useState } from 'react';
import { PageLoading, PageError } from '../components/PageState';
import { Plus, Search, Copy, X, Clock, Trash2, Wifi, QrCode, Check, Pencil, RotateCcw, Link, Download, CheckSquare, Square, XCircle, Users2, Zap } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../api';
import { PROTOCOL_META } from '../protocols';
import type { Client, ClientStatus, Server, Group } from '../types';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';

const filterTabs: { key: ClientStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'active', label: 'Активные' },
  { key: 'disabled', label: 'Отключённые' },
  { key: 'expired', label: 'Истёкшие' },
  { key: 'limited', label: 'Ограниченные' },
];

export default function Clients() {
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ClientStatus | 'all'>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [qrClient, setQrClient] = useState<Client | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [addForm, setAddForm] = useState({ name: '', email: '', serverId: 0, totalLimit: 0, expiryDate: '' });
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', totalLimit: 0, expiryDate: '' });
  const [confirmDelete, setConfirmDelete] = useState<Client | null>(null);
  const [confirmReset, setConfirmReset] = useState<Client | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState<{ action: string } | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [showGroups, setShowGroups] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: '', color: '#8B5CF6', defaultTotalLimit: 0, defaultExpiryDays: 30, description: '' });
  const [editGroup, setEditGroup] = useState<Group | null>(null);
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<Group | null>(null);
  const [applyingGroup, setApplyingGroup] = useState<number | null>(null);

  const load = () => {
    setError('');
    setLoading(true);
    Promise.all([api.clients.list(), api.servers.list(), api.groups.list()]).then(([c, s, g]) => {
      setClients(c);
      setServers(s);
      setGroups(g);
      if (s.length > 0 && addForm.serverId === 0) {
        setAddForm(prev => ({ ...prev, serverId: s[0].id }));
      }
      setLoading(false);
    }).catch((e) => {
      setError(e.message || 'Ошибка загрузки клиентов');
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const handleAdd = () => {
    const expiry = addForm.expiryDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    api.clients.create({ ...addForm, expiryDate: expiry }).then(() => {
      setShowAdd(false);
      setAddForm({ name: '', email: '', serverId: servers[0]?.id || 0, totalLimit: 0, expiryDate: '' });
      api.clients.list().then(setClients);
      toastSuccess('Клиент добавлен');
    }).catch((e) => toastError(`Ошибка: ${(e as Error).message}`));
  };

  const handleDelete = (id: number) => {
    api.clients.delete(id).then(() => {
      api.clients.list().then(setClients);
      toastSuccess('Клиент удалён');
    });
  };

  const toggleStatus = (c: Client) => {
    const newStatus = c.status === 'active' ? 'disabled' : 'active';
    api.clients.update(c.id, { status: newStatus }).then(() => {
      api.clients.list().then(setClients);
      toastInfo(`${c.name} ${newStatus === 'active' ? 'включён' : 'отключён'}`);
    });
  };

  const handleEdit = (c: Client) => {
    setEditClient(c);
    setEditForm({ name: c.name, email: c.email, totalLimit: c.totalLimit, expiryDate: c.expiryDate });
  };

  const handleEditSave = () => {
    if (!editClient) return;
    api.clients.update(editClient.id, editForm).then(() => {
      setEditClient(null);
      api.clients.list().then(setClients);
      toastSuccess('Клиент обновлён');
    });
  };

  const handleResetStats = (id: number) => {
    api.clients.resetStats(id).then(() => {
      api.clients.list().then(setClients);
      toastSuccess('Статистика сброшена');
    });
  };

  const copyUrl = (url: string, id: number) => {
    navigator.clipboard?.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const filtered = clients.filter((c) => {
    const ms = c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase());
    const mf = filter === 'all' || c.status === filter;
    return ms && mf;
  });

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const handleBulkAction = async (action: string) => {
    try {
      const result = await api.clients.bulk([...selected], action);
      toastSuccess(`Операция выполнена для ${result.count} клиентов`);
      exitSelectMode();
      load();
    } catch (e) {
      toastError(`Ошибка: ${(e as Error).message}`);
    }
    setConfirmBulk(null);
  };

  const handleExportCsv = async () => {
    try {
      const blob = await api.clients.exportCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clients-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toastSuccess('CSV экспортирован');
    } catch (e) {
      toastError(`Ошибка экспорта: ${(e as Error).message}`);
    }
  };

  // ── Группы ──
  const handleCreateGroup = () => {
    if (!groupForm.name) { toastError('Укажите название группы'); return; }
    api.groups.create(groupForm).then(() => {
      setGroupForm({ name: '', color: '#8B5CF6', defaultTotalLimit: 0, defaultExpiryDays: 30, description: '' });
      api.groups.list().then(setGroups);
      toastSuccess('Группа создана');
    }).catch((e) => toastError(`Ошибка: ${(e as Error).message}`));
  };

  const handleUpdateGroup = () => {
    if (!editGroup) return;
    api.groups.update(editGroup.id, {
      name: editGroup.name, color: editGroup.color,
      defaultTotalLimit: editGroup.defaultTotalLimit,
      defaultExpiryDays: editGroup.defaultExpiryDays,
      description: editGroup.description,
    }).then(() => {
      setEditGroup(null);
      api.groups.list().then(setGroups);
      toastSuccess('Группа обновлена');
    }).catch((e) => toastError(`Ошибка: ${(e as Error).message}`));
  };

  const handleDeleteGroup = (id: number) => {
    api.groups.delete(id).then(() => {
      api.groups.list().then(setGroups);
      api.clients.list().then(setClients);
      toastSuccess('Группа удалена');
    });
  };

  const handleAssignGroup = (clientId: number, groupId: number | undefined) => {
    api.assignGroup(clientId, groupId).then(() => {
      api.clients.list().then(setClients);
      toastSuccess(groupId ? 'Клиент добавлен в группу' : 'Клиент удалён из группы');
    }).catch((e) => toastError(`Ошибка: ${(e as Error).message}`));
  };

  const handleApplyGroup = (id: number) => {
    setApplyingGroup(id);
    api.groups.apply(id).then((r) => {
      toastSuccess(`Политики применены к ${r.count} клиентам`);
      load();
    }).catch((e) => toastError(`Ошибка: ${(e as Error).message}`))
    .finally(() => setApplyingGroup(null));
  };

  const groupColors = ['#8B5CF6', '#06B6D4', '#F59E0B', '#10B981', '#EF4444', '#EC4899', '#6366F1', '#F97316'];

  if (loading) return <PageLoading />;
  if (error) return <PageError message={error} onRetry={load} />;

  const statusStyle = (s: ClientStatus) =>
    s === 'active'
      ? { dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Активен' }
      : s === 'disabled'
        ? { dot: 'bg-white/30', text: 'text-white/50', bg: 'bg-white/5', label: 'Отключён' }
        : s === 'expired'
          ? { dot: 'bg-red-400', text: 'text-red-400', bg: 'bg-red-500/10', label: 'Истёк' }
          : { dot: 'bg-amber-400', text: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Ограничен' };

  const daysLeft = (date: string) => {
    const diff = new Date(date).getTime() - Date.now();
    return Math.ceil(diff / 86400000);
  };

  return (
    <div className="px-4 py-6 space-y-4 animate-fade-in">
      <div>
        <h1 className="text-[1.6rem] font-bold font-display">Клиенты</h1>
        <p className="text-sm text-white/40">{clients.length} всего • {clients.filter(c => c.status === 'active').length} активны</p>
      </div>

      {/* Действия */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск клиентов..."
            className="glass-input w-full pl-10 pr-4 py-3 text-sm"
          />
        </div>
        <button
          onClick={handleExportCsv}
          className="w-11 h-11 rounded-2xl glass flex items-center justify-center text-white/50 active:scale-95 transition-transform flex-shrink-0"
          title="Экспорт в CSV"
        >
          <Download size={18} />
        </button>
        <button
          onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
          className={`w-11 h-11 rounded-2xl flex items-center justify-center active:scale-95 transition-transform flex-shrink-0 ${
            selectMode ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/40' : 'glass text-white/50'
          }`}
          title="Выбрать"
        >
          {selectMode ? <X size={18} /> : <CheckSquare size={18} />}
        </button>
        <button
          onClick={() => setShowGroups(true)}
          className="w-11 h-11 rounded-2xl glass flex items-center justify-center text-white/50 active:scale-95 transition-transform flex-shrink-0"
          title="Группы"
        >
          <Users2 size={18} />
        </button>
      </div>

      {/* Массовые действия */}
      {selectMode && (
        <div className="glass-card p-3 animate-slide-down">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-white/50">Выбрано: {selected.size}</span>
            <button
              onClick={() => selected.size === filtered.length ? setSelected(new Set()) : setSelected(new Set(filtered.map((c) => c.id)))}
              className="text-[10px] px-2 py-1 rounded-lg bg-violet-500/10 text-violet-300"
            >
              {selected.size === filtered.length ? 'Снять все' : 'Выбрать все'}
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => selected.size > 0 && setConfirmBulk({ action: 'enable' })}
              disabled={selected.size === 0}
              className="py-2 rounded-xl bg-emerald-500/10 text-emerald-400 text-[10px] font-medium disabled:opacity-30 flex items-center justify-center gap-1"
            >
              <Check size={12} /> Вкл
            </button>
            <button
              onClick={() => selected.size > 0 && setConfirmBulk({ action: 'disable' })}
              disabled={selected.size === 0}
              className="py-2 rounded-xl bg-amber-500/10 text-amber-400 text-[10px] font-medium disabled:opacity-30 flex items-center justify-center gap-1"
            >
              <XCircle size={12} /> Откл
            </button>
            <button
              onClick={() => selected.size > 0 && setConfirmBulk({ action: 'reset-stats' })}
              disabled={selected.size === 0}
              className="py-2 rounded-xl bg-cyan-500/10 text-cyan-400 text-[10px] font-medium disabled:opacity-30 flex items-center justify-center gap-1"
            >
              <RotateCcw size={12} /> Сброс
            </button>
            <button
              onClick={() => selected.size > 0 && setConfirmBulk({ action: 'delete' })}
              disabled={selected.size === 0}
              className="py-2 rounded-xl bg-red-500/10 text-red-400 text-[10px] font-medium disabled:opacity-30 flex items-center justify-center gap-1"
            >
              <Trash2 size={12} /> Удал.
            </button>
          </div>
        </div>
      )}

      {/* Фильтры */}
      <div className="flex gap-2 overflow-x-auto">
        {filterTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              filter === t.key ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/40' : 'bg-white/5 text-white/40'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Пустое состояние */}
      {filtered.length === 0 && (
        <div className="glass-card p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto mb-4">
            <Plus size={28} className="text-violet-400" />
          </div>
          <p className="text-sm text-white/60 mb-1">{servers.length === 0 ? 'Сначала добавьте ноду' : 'Клиентов пока нет'}</p>
          <p className="text-xs text-white/30">{servers.length === 0 ? 'Нужна нода, прежде чем добавлять клиентов' : 'Добавьте первого клиента'}</p>
        </div>
      )}

      {/* Карточки клиентов */}
      {filtered.map((c) => {
        const st = statusStyle(c.status);
        const used = c.upload + c.download;
        const limitPct = c.totalLimit > 0 ? Math.min((used / c.totalLimit) * 100, 100) : 0;
        const dl = daysLeft(c.expiryDate);
        const server = servers.find(s => s.id === c.serverId);

        return (
          <div key={c.id} className={`glass-card p-4 animate-slide-up ${selectMode && selected.has(c.id) ? 'ring-1 ring-violet-500/40' : ''}`}>
            {selectMode && (
              <button
                onClick={() => toggleSelect(c.id)}
                className="absolute top-3 right-3 z-10"
              >
                {selected.has(c.id) ? (
                  <CheckSquare size={18} className="text-violet-400" />
                ) : (
                  <Square size={18} className="text-white/20" />
                )}
              </button>
            )}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500/30 to-indigo-500/20 flex items-center justify-center text-sm font-semibold">
                  {c.name.split(' ').map((n) => n[0]).join('')}
                </div>
                <div>
                  <p className="font-medium text-sm">{c.name}</p>
                  <p className="text-xs text-white/30">{c.email}</p>
                </div>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${st.bg} ${st.text} font-medium`}>
                {st.label}
              </span>
            </div>

            {/* Сервер и протокол */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {(c.shareUrls || [{ protocol: 'vless', url: c.vlessUrl }]).map((su, idx) => {
                const meta = PROTOCOL_META[su.protocol] || { name: su.protocol, color: '#888' };
                return (
                  <span
                    key={idx}
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{ background: meta.color + '15', color: meta.color }}
                  >
                    {meta.name}
                  </span>
                );
              })}
              <span className="text-xs text-white/40">на {c.serverName}</span>
              {server && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${server.status === 'running' ? 'text-emerald-400 bg-emerald-500/10' : 'text-white/30 bg-white/5'}`}>
                  {server.status === 'running' ? '●' : '○'}
                </span>
              )}
              {c.groupId && (() => {
                const g = groups.find((g) => g.id === c.groupId);
                if (!g) return null;
                return (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{ background: g.color + '15', color: g.color }}
                  >
                    {g.name}
                  </span>
                );
              })()}
            </div>

            {/* Трафик */}
            <div className="mb-3">
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-white/40">Использовано</span>
                <span className="text-white/60">
                  {used.toFixed(2)} ГБ{c.totalLimit > 0 ? ` / ${c.totalLimit} ГБ` : ' ∞'}
                </span>
              </div>
              {c.totalLimit > 0 && (
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${limitPct > 90 ? 'bg-red-400' : limitPct > 70 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                    style={{ width: `${limitPct}%` }}
                  />
                </div>
              )}
            </div>

            {/* Подвал */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-[10px] text-white/30">
                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  {dl > 0 ? `${dl} дн. осталось` : 'истёк'}
                </span>
                <span className="flex items-center gap-1">
                  <Wifi size={11} />
                  {new Date(c.lastConnect).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQrClient(c)}
                  className="text-white/30 hover:text-violet-400 transition-colors"
                  title="Показать QR-код"
                >
                  <QrCode size={14} />
                </button>
                <button
                  onClick={() => copyUrl(c.vlessUrl, c.id)}
                  className="text-white/30 hover:text-violet-400 transition-colors"
                  title="Копировать ссылку"
                >
                  {copied === c.id ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
                {c.subUrl && (
                  <button
                    onClick={() => copyUrl(window.location.origin + c.subUrl, c.id + 5000)}
                    className="text-white/30 hover:text-violet-400 transition-colors"
                    title="Копировать ссылку подписки"
                  >
                    {copied === c.id + 5000 ? <Check size={14} className="text-emerald-400" /> : <Link size={14} />}
                  </button>
                )}
                <button
                  onClick={() => handleEdit(c)}
                  className="text-white/30 hover:text-violet-400 transition-colors"
                  title="Изменить клиента"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => setConfirmReset(c)}
                  className="text-white/30 hover:text-violet-400 transition-colors"
                  title="Сбросить статистику"
                >
                  <RotateCcw size={14} />
                </button>
                <button
                  onClick={() => toggleStatus(c)}
                  className={`text-[10px] px-2 py-1 rounded-lg ${c.status === 'active' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}
                >
                  {c.status === 'active' ? 'Откл.' : 'Вкл.'}
                </button>
                <button
                  onClick={() => setConfirmDelete(c)}
                  className="text-white/20 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {/* FAB — скрыт в режиме выбора */}
      {!selectMode && (
        <button
          onClick={() => setShowAdd(true)}
          disabled={servers.length === 0}
          className="fab disabled:opacity-30 disabled:pointer-events-none"
        >
          <Plus size={24} />
        </button>
      )}

      {/* Подтверждение массовых действий */}
      <ConfirmDialog
        open={!!confirmBulk}
        title={
          confirmBulk?.action === 'delete' ? 'Удалить клиентов' :
          confirmBulk?.action === 'enable' ? 'Включить клиентов' :
          confirmBulk?.action === 'disable' ? 'Отключить клиентов' :
          'Сбросить статистику'
        }
        message={
          confirmBulk?.action === 'delete'
            ? `Удалить ${selected.size} клиентов? Действие необратимо.`
            : confirmBulk?.action === 'reset-stats'
              ? `Сбросить статистику для ${selected.size} клиентов?`
              : `Применить «${confirmBulk?.action === 'enable' ? 'Включить' : 'Отключить'}» к ${selected.size} клиентам?`
        }
        confirmLabel={confirmBulk?.action === 'delete' ? 'Удалить' : 'Применить'}
        cancelLabel="Отмена"
        variant={confirmBulk?.action === 'delete' ? 'danger' : 'default'}
        onConfirm={() => confirmBulk && handleBulkAction(confirmBulk.action)}
        onCancel={() => setConfirmBulk(null)}
      />

      {/* Добавление клиента */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowAdd(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md glass-card rounded-t-3xl p-6 animate-slide-up space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Добавить клиента</h2>
              <button onClick={() => setShowAdd(false)} className="text-white/40">
                <X size={20} />
              </button>
            </div>
            <input
              placeholder="Имя"
              value={addForm.name}
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
              className="glass-input w-full px-4 py-3 text-sm"
            />
            <input
              placeholder="Email"
              value={addForm.email}
              onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
              className="glass-input w-full px-4 py-3 text-sm"
            />
            <select
              value={addForm.serverId}
              onChange={(e) => setAddForm({ ...addForm, serverId: Number(e.target.value) })}
              className="glass-input w-full px-4 py-3 text-sm"
            >
              {servers.map((s) => (
                <option key={s.id} value={s.id} className="bg-surface">
                  {s.flag} {s.name} — {s.location} (Xray {s.xrayVersion})
                </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-1.5 bg-white/[0.02] rounded-2xl p-3">
              {(servers.find(sv => sv.id === addForm.serverId)?.inbounds || []).map((ib) => {
                const meta = PROTOCOL_META[ib.protocol] || { name: ib.protocol, color: '#888' };
                return (
                  <span key={ib.id} className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: meta.color + '15', color: meta.color }}>
                    {meta.name} · {ib.security}
                  </span>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                placeholder="Лимит (ГБ, 0=∞)"
                value={addForm.totalLimit}
                onChange={(e) => setAddForm({ ...addForm, totalLimit: Number(e.target.value) })}
                className="glass-input w-full px-4 py-3 text-sm"
              />
              <input
                type="date"
                value={addForm.expiryDate}
                onChange={(e) => setAddForm({ ...addForm, expiryDate: e.target.value })}
                className="glass-input w-full px-4 py-3 text-sm"
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={!addForm.name || !addForm.email || !addForm.serverId}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white font-semibold text-sm disabled:opacity-40 active:scale-[0.98] transition-transform"
            >
              Добавить клиента
            </button>
          </div>
        </div>
      )}

      {/* QR-код */}
      {qrClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setQrClient(null)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative glass-card p-6 m-4 max-w-xs w-full animate-scale-in text-center" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{qrClient.name}</h2>
              <button onClick={() => setQrClient(null)} className="text-white/40">
                <X size={20} />
              </button>
            </div>
            <p className="text-xs text-white/40 mb-4">{qrClient.serverName}</p>
            <div className="bg-white p-4 rounded-2xl inline-block">
              <QRCodeSVG value={qrClient.vlessUrl} size={180} level="M" />
            </div>
            <p className="text-[10px] text-white/30 mt-4 break-all font-mono">{qrClient.vlessUrl}</p>
            <button
              onClick={() => copyUrl(qrClient.vlessUrl, qrClient.id)}
              className="w-full mt-4 py-3 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              {copied === qrClient.id ? <Check size={14} /> : <Copy size={14} />} Копировать ссылку
            </button>
            {(qrClient.shareUrls || []).length > 1 && (
              <div className="mt-4 space-y-1.5">
                <p className="text-[10px] text-white/30 mb-1">Все ссылки протоколов:</p>
                {qrClient.shareUrls!.filter((su) => su.url && su.url !== qrClient.vlessUrl).map((su, idx) => {
                  const meta = PROTOCOL_META[su.protocol] || { name: su.protocol, color: '#888' };
                  return (
                    <button
                      key={idx}
                      onClick={() => copyUrl(su.url, qrClient.id + idx * 1000)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl glass-soft text-left active:scale-95 transition-transform"
                    >
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: meta.color + '15', color: meta.color }}>
                        {meta.name}
                      </span>
                      <span className="text-[10px] text-white/40 truncate flex-1 font-mono">{su.url.slice(0, 40)}...</span>
                      {copied === qrClient.id + idx * 1000 ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} className="text-white/30" />}
                    </button>
                  );
                })}
              </div>
            )}
            {qrClient.subUrl && (
              <div className="mt-4 pt-4 border-t border-white/5">
                <p className="text-[10px] text-white/30 mb-1.5 flex items-center gap-1">
                  <Link size={10} /> Ссылка подписки
                </p>
                <button
                  onClick={() => copyUrl(window.location.origin + qrClient.subUrl, qrClient.id + 9000)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl glass-soft text-left active:scale-95 transition-transform"
                >
                  <span className="text-[10px] text-white/40 truncate flex-1 font-mono">{window.location.origin}{qrClient.subUrl}</span>
                  {copied === qrClient.id + 9000 ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} className="text-white/30" />}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Подтверждение удаления */}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Удалить клиента"
        message={`Удалить «${confirmDelete?.name}»? Доступ к VPN будет немедленно отозван. Действие необратимо.`}
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        variant="danger"
        onConfirm={() => {
          if (confirmDelete) handleDelete(confirmDelete.id);
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Подтверждение сброса статистики */}
      <ConfirmDialog
        open={!!confirmReset}
        title="Сбросить статистику"
        message={`Сбросить всю статистику трафика для «${confirmReset?.name}»? Счётчики загрузки и отдачи обнулятся.`}
        confirmLabel="Сбросить"
        cancelLabel="Отмена"
        onConfirm={() => {
          if (confirmReset) handleResetStats(confirmReset.id);
          setConfirmReset(null);
        }}
        onCancel={() => setConfirmReset(null)}
      />

      {/* Редактирование клиента */}
      {editClient && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setEditClient(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md glass-card rounded-t-3xl p-6 animate-slide-up space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Изменить клиента</h2>
              <button onClick={() => setEditClient(null)} className="text-white/40">
                <X size={20} />
              </button>
            </div>
            <input
              placeholder="Имя"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="glass-input w-full px-4 py-3 text-sm"
            />
            <input
              placeholder="Email"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              className="glass-input w-full px-4 py-3 text-sm"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                placeholder="Лимит (ГБ, 0=∞)"
                value={editForm.totalLimit}
                onChange={(e) => setEditForm({ ...editForm, totalLimit: Number(e.target.value) })}
                className="glass-input w-full px-4 py-3 text-sm"
              />
              <input
                type="date"
                value={editForm.expiryDate}
                onChange={(e) => setEditForm({ ...editForm, expiryDate: e.target.value })}
                className="glass-input w-full px-4 py-3 text-sm"
              />
            </div>
            {/* Группа */}
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Группа</label>
              <select
                value={editClient.groupId || 0}
                onChange={(e) => {
                  const gid = Number(e.target.value) || undefined;
                  handleAssignGroup(editClient.id, gid);
                  setEditClient({ ...editClient, groupId: gid });
                }}
                className="glass-input w-full px-4 py-3 text-sm"
              >
                <option value={0} className="bg-surface">Без группы</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id} className="bg-surface">{g.name}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleEditSave}
              disabled={!editForm.name || !editForm.email}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white font-semibold text-sm disabled:opacity-40 active:scale-[0.98] transition-transform"
            >
              Сохранить
            </button>
          </div>
        </div>
      )}

      {/* Управление группами */}
      {showGroups && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowGroups(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
          <div
            className="relative w-full max-w-md glass-card rounded-t-[2rem] p-6 animate-slide-up space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold font-display flex items-center gap-2">
                <Users2 size={18} className="text-violet-400" /> Группы клиентов
              </h2>
              <button onClick={() => setShowGroups(false)} className="text-white/40">
                <X size={20} />
              </button>
            </div>

            {/* Существующие группы */}
            {groups.length > 0 && (
              <div className="space-y-2">
                {groups.map((g) => (
                  <div key={g.id} className="glass-soft rounded-2xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ background: g.color }} />
                        <span className="text-sm font-medium">{g.name}</span>
                        <span className="text-[10px] text-white/30">{g.clientCount || 0} клиентов</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleApplyGroup(g.id)}
                          disabled={applyingGroup === g.id}
                          className="text-[10px] px-2 py-1 rounded-lg bg-violet-500/10 text-violet-300 flex items-center gap-1 disabled:opacity-50"
                          title="Применить политики ко всем клиентам группы"
                        >
                          {applyingGroup === g.id ? <RotateCcw size={10} className="animate-spin" /> : <Zap size={10} />}
                          Применить
                        </button>
                        <button
                          onClick={() => setEditGroup({ ...g })}
                          className="text-white/30 hover:text-violet-400 transition-colors p-1"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteGroup(g)}
                          className="text-white/20 hover:text-red-400 transition-colors p-1"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-3 text-[10px] text-white/30">
                      <span>Лимит: {g.defaultTotalLimit > 0 ? `${g.defaultTotalLimit} ГБ` : '∞'}</span>
                      <span>Срок: {g.defaultExpiryDays} дн.</span>
                    </div>
                    {g.description && <p className="text-[10px] text-white/30 mt-1">{g.description}</p>}
                  </div>
                ))}
              </div>
            )}

            {groups.length === 0 && !editGroup && (
              <p className="text-xs text-white/30 text-center py-4">Групп пока нет. Создайте первую.</p>
            )}

            {/* Форма создания/редактирования группы */}
            {editGroup ? (
              <div className="space-y-3 pt-3 border-t border-white/5">
                <p className="text-xs font-medium text-white/60">Редактирование группы</p>
                <input
                  placeholder="Название группы"
                  value={editGroup.name}
                  onChange={(e) => setEditGroup({ ...editGroup, name: e.target.value })}
                  className="glass-input w-full px-4 py-3 text-sm"
                />
                <div className="flex gap-2 flex-wrap">
                  {groupColors.map((c) => (
                    <button
                      key={c}
                      onClick={() => setEditGroup({ ...editGroup, color: c })}
                      className={`w-7 h-7 rounded-full transition-all ${editGroup.color === c ? 'ring-2 ring-white/40' : ''}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    placeholder="Лимит (ГБ, 0=∞)"
                    value={editGroup.defaultTotalLimit}
                    onChange={(e) => setEditGroup({ ...editGroup, defaultTotalLimit: Number(e.target.value) })}
                    className="glass-input w-full px-4 py-3 text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Срок (дней)"
                    value={editGroup.defaultExpiryDays}
                    onChange={(e) => setEditGroup({ ...editGroup, defaultExpiryDays: Number(e.target.value) })}
                    className="glass-input w-full px-4 py-3 text-sm"
                  />
                </div>
                <input
                  placeholder="Описание (необязательно)"
                  value={editGroup.description}
                  onChange={(e) => setEditGroup({ ...editGroup, description: e.target.value })}
                  className="glass-input w-full px-4 py-3 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditGroup(null)}
                    className="flex-1 py-3 rounded-2xl bg-white/5 text-white/60 text-sm font-medium"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleUpdateGroup}
                    disabled={!editGroup.name}
                    className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-sm font-semibold disabled:opacity-40"
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-3 border-t border-white/5">
                <p className="text-xs font-medium text-white/60">Новая группа</p>
                <input
                  placeholder="Название группы"
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  className="glass-input w-full px-4 py-3 text-sm"
                />
                <div className="flex gap-2 flex-wrap">
                  {groupColors.map((c) => (
                    <button
                      key={c}
                      onClick={() => setGroupForm({ ...groupForm, color: c })}
                      className={`w-7 h-7 rounded-full transition-all ${groupForm.color === c ? 'ring-2 ring-white/40' : ''}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    placeholder="Лимит (ГБ, 0=∞)"
                    value={groupForm.defaultTotalLimit}
                    onChange={(e) => setGroupForm({ ...groupForm, defaultTotalLimit: Number(e.target.value) })}
                    className="glass-input w-full px-4 py-3 text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Срок (дней)"
                    value={groupForm.defaultExpiryDays}
                    onChange={(e) => setGroupForm({ ...groupForm, defaultExpiryDays: Number(e.target.value) })}
                    className="glass-input w-full px-4 py-3 text-sm"
                  />
                </div>
                <input
                  placeholder="Описание (необязательно)"
                  value={groupForm.description}
                  onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                  className="glass-input w-full px-4 py-3 text-sm"
                />
                <button
                  onClick={handleCreateGroup}
                  disabled={!groupForm.name}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white font-semibold text-sm disabled:opacity-40 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                >
                  <Plus size={16} /> Создать группу
                </button>
              </div>
            )}

            <p className="text-[10px] text-white/30 leading-relaxed">
              Группы позволяют задать лимит трафика и срок действия по умолчанию для категории клиентов. При добавлении клиента в группу его политики обновляются автоматически. «Применить» распространяет текущие настройки группы на всех её клиентов.
            </p>
          </div>
        </div>
      )}

      {/* Подтверждение удаления группы */}
      <ConfirmDialog
        open={!!confirmDeleteGroup}
        title="Удалить группу"
        message={`Удалить «${confirmDeleteGroup?.name}»? Клиенты останутся, но потеряют привязку к группе.`}
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        variant="danger"
        onConfirm={() => {
          if (confirmDeleteGroup) handleDeleteGroup(confirmDeleteGroup.id);
          setConfirmDeleteGroup(null);
        }}
        onCancel={() => setConfirmDeleteGroup(null)}
      />
    </div>
  );
}
