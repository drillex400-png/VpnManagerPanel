import { useEffect, useState } from 'react';
import { Plus, Search, Copy, X, Clock, Trash2, Wifi, QrCode, Check, Pencil, RotateCcw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../api';
import { PROTOCOL_META } from '../protocols';
import type { Client, ClientStatus, Server } from '../types';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';

const filterTabs: { key: ClientStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'disabled', label: 'Disabled' },
  { key: 'expired', label: 'Expired' },
  { key: 'limited', label: 'Limited' },
];

export default function Clients() {
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    Promise.all([api.clients.list(), api.servers.list()]).then(([c, s]) => {
      setClients(c);
      setServers(s);
      if (s.length > 0 && addForm.serverId === 0) {
        setAddForm(prev => ({ ...prev, serverId: s[0].id }));
      }
      setLoading(false);
    });
  }, []);

  const handleAdd = () => {
    const expiry = addForm.expiryDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    api.clients.create({ ...addForm, expiryDate: expiry }).then(() => {
      setShowAdd(false);
      setAddForm({ name: '', email: '', serverId: servers[0]?.id || 0, totalLimit: 0, expiryDate: '' });
      api.clients.list().then(setClients);
      toastSuccess('Client added');
    }).catch((e) => toastError(`Failed: ${(e as Error).message}`));
  };

  const handleDelete = (id: number) => {
    api.clients.delete(id).then(() => {
      api.clients.list().then(setClients);
      toastSuccess('Client deleted');
    });
  };

  const toggleStatus = (c: Client) => {
    const newStatus = c.status === 'active' ? 'disabled' : 'active';
    api.clients.update(c.id, { status: newStatus }).then(() => {
      api.clients.list().then(setClients);
      toastInfo(`${c.name} ${newStatus === 'active' ? 'enabled' : 'disabled'}`);
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
      toastSuccess('Client updated');
    });
  };

  const handleResetStats = (id: number) => {
    api.clients.resetStats(id).then(() => {
      api.clients.list().then(setClients);
      toastSuccess('Stats reset');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const statusStyle = (s: ClientStatus) =>
    s === 'active'
      ? { dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Active' }
      : s === 'disabled'
        ? { dot: 'bg-white/30', text: 'text-white/50', bg: 'bg-white/5', label: 'Disabled' }
        : s === 'expired'
          ? { dot: 'bg-red-400', text: 'text-red-400', bg: 'bg-red-500/10', label: 'Expired' }
          : { dot: 'bg-amber-400', text: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Limited' };

  const daysLeft = (date: string) => {
    const diff = new Date(date).getTime() - Date.now();
    return Math.ceil(diff / 86400000);
  };

  return (
    <div className="px-4 py-6 space-y-4 animate-fade-in">
      <div>
        <h1 className="text-[1.6rem] font-bold font-display">Clients</h1>
        <p className="text-sm text-white/40">{clients.length} total • {clients.filter(c => c.status === 'active').length} active</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clients..."
          className="glass-input w-full pl-10 pr-4 py-3 text-sm"
        />
      </div>

      {/* Filter tabs */}
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

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="glass-card p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto mb-4">
            <Plus size={28} className="text-violet-400" />
          </div>
          <p className="text-sm text-white/60 mb-1">{servers.length === 0 ? 'Add a server first' : 'No clients yet'}</p>
          <p className="text-xs text-white/30">{servers.length === 0 ? 'You need a server before adding clients' : 'Add your first client'}</p>
        </div>
      )}

      {/* Client cards */}
      {filtered.map((c) => {
        const st = statusStyle(c.status);
        const used = c.upload + c.download;
        const limitPct = c.totalLimit > 0 ? Math.min((used / c.totalLimit) * 100, 100) : 0;
        const dl = daysLeft(c.expiryDate);
        const server = servers.find(s => s.id === c.serverId);

        return (
          <div key={c.id} className="glass-card p-4 animate-slide-up">
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

            {/* Server + protocol */}
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
              <span className="text-xs text-white/40">on {c.serverName}</span>
              {server && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${server.status === 'running' ? 'text-emerald-400 bg-emerald-500/10' : 'text-white/30 bg-white/5'}`}>
                  {server.status === 'running' ? '●' : '○'}
                </span>
              )}
            </div>

            {/* Data usage */}
            <div className="mb-3">
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-white/40">Data used</span>
                <span className="text-white/60">
                  {used.toFixed(2)} GB{c.totalLimit > 0 ? ` / ${c.totalLimit} GB` : ' ∞'}
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

            {/* Footer */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-[10px] text-white/30">
                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  {dl > 0 ? `${dl}d left` : 'expired'}
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
                  title="Show QR code"
                >
                  <QrCode size={14} />
                </button>
                <button
                  onClick={() => copyUrl(c.vlessUrl, c.id)}
                  className="text-white/30 hover:text-violet-400 transition-colors"
                  title="Copy VLESS URL"
                >
                  {copied === c.id ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
                <button
                  onClick={() => handleEdit(c)}
                  className="text-white/30 hover:text-violet-400 transition-colors"
                  title="Edit client"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => setConfirmReset(c)}
                  className="text-white/30 hover:text-violet-400 transition-colors"
                  title="Reset traffic stats"
                >
                  <RotateCcw size={14} />
                </button>
                <button
                  onClick={() => toggleStatus(c)}
                  className={`text-[10px] px-2 py-1 rounded-lg ${c.status === 'active' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}
                >
                  {c.status === 'active' ? 'Disable' : 'Enable'}
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

      {/* FAB */}
      <button
        onClick={() => setShowAdd(true)}
        disabled={servers.length === 0}
        className="fab disabled:opacity-30 disabled:pointer-events-none"
      >
        <Plus size={24} />
      </button>

      {/* Add Client Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowAdd(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md glass-card rounded-t-3xl p-6 animate-slide-up space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Add VLESS Client</h2>
              <button onClick={() => setShowAdd(false)} className="text-white/40">
                <X size={20} />
              </button>
            </div>
            <input
              placeholder="Name"
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
                placeholder="Data limit (GB, 0=∞)"
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
              Add Client
            </button>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
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
              {copied === qrClient.id ? <Check size={14} /> : <Copy size={14} />} Copy URL
            </button>
            {(qrClient.shareUrls || []).length > 1 && (
              <div className="mt-4 space-y-1.5">
                <p className="text-[10px] text-white/30 mb-1">All protocol URLs:</p>
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
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete Client"
        message={`Delete "${confirmDelete?.name}"? This will revoke their VPN access immediately. This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (confirmDelete) handleDelete(confirmDelete.id);
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Reset stats confirmation */}
      <ConfirmDialog
        open={!!confirmReset}
        title="Reset Traffic Stats"
        message={`Reset all traffic statistics for "${confirmReset?.name}"? Upload and download counters will be set to zero.`}
        confirmLabel="Reset"
        onConfirm={() => {
          if (confirmReset) handleResetStats(confirmReset.id);
          setConfirmReset(null);
        }}
        onCancel={() => setConfirmReset(null)}
      />

      {/* Edit Client Modal */}
      {editClient && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setEditClient(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md glass-card rounded-t-3xl p-6 animate-slide-up space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Edit Client</h2>
              <button onClick={() => setEditClient(null)} className="text-white/40">
                <X size={20} />
              </button>
            </div>
            <input
              placeholder="Name"
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
                placeholder="Data limit (GB, 0=∞)"
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
            <button
              onClick={handleEditSave}
              disabled={!editForm.name || !editForm.email}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white font-semibold text-sm disabled:opacity-40 active:scale-[0.98] transition-transform"
            >
              Save Changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
