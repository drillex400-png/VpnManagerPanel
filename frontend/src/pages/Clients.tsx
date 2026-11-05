import { useEffect, useState } from 'react';
import { Plus, Search, Copy, X, Clock, Globe, Trash2, Wifi } from 'lucide-react';
import { api } from '../api';
import { PROTOCOL_META, PROTOCOL_TYPES } from '../types';
import type { Client, ClientStatus, ProtocolType, Server } from '../types';

const filterTabs: { key: ClientStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'disabled', label: 'Disabled' },
  { key: 'expired', label: 'Expired' },
  { key: 'limited', label: 'Limited' },
];

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ClientStatus | 'all'>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', serverId: 1, protocol: 'vless' as ProtocolType, totalLimit: 0, expiryDate: '' });

  useEffect(() => {
    Promise.all([api.clients.list(), api.servers.list()]).then(([c, s]) => {
      setClients(c);
      setServers(s);
      setLoading(false);
    });
  }, []);

  const handleAdd = () => {
    const expiry = addForm.expiryDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    api.clients.create({ ...addForm, expiryDate: expiry }).then(() => {
      setShowAdd(false);
      setAddForm({ name: '', email: '', serverId: 1, protocol: 'vless', totalLimit: 0, expiryDate: '' });
      api.clients.list().then(setClients);
    });
  };

  const handleDelete = (id: number) => {
    api.clients.delete(id).then(() => api.clients.list().then(setClients));
  };

  const toggleStatus = (c: Client) => {
    const newStatus = c.status === 'active' ? 'disabled' : 'active';
    api.clients.update(c.id, { status: newStatus }).then(() => api.clients.list().then(setClients));
  };

  const copyUrl = (url: string) => {
    navigator.clipboard?.writeText(url);
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
        <h1 className="text-2xl font-bold">Clients</h1>
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

      {/* Client cards */}
      {filtered.map((c) => {
        const st = statusStyle(c.status);
        const used = c.upload + c.download;
        const limitPct = c.totalLimit > 0 ? Math.min((used / c.totalLimit) * 100, 100) : 0;
        const dl = daysLeft(c.expiryDate);

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
            <div className="flex items-center gap-2 mb-3">
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{ background: PROTOCOL_META[c.protocol].color + '15', color: PROTOCOL_META[c.protocol].color }}
              >
                {PROTOCOL_META[c.protocol].name}
              </span>
              <span className="text-xs text-white/40">on {c.serverName}</span>
            </div>

            {/* Data usage */}
            <div className="mb-3">
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-white/40">Data used</span>
                <span className="text-white/60">
                  {used.toFixed(1)} GB{c.totalLimit > 0 ? ` / ${c.totalLimit} GB` : ' ∞'}
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
                  onClick={() => copyUrl(c.subscriptionUrl)}
                  className="text-white/30 hover:text-violet-400 transition-colors"
                  title="Copy subscription URL"
                >
                  <Copy size={14} />
                </button>
                <button
                  onClick={() => toggleStatus(c)}
                  className={`text-[10px] px-2 py-1 rounded-lg ${c.status === 'active' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}
                >
                  {c.status === 'active' ? 'Disable' : 'Enable'}
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
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
      <button onClick={() => setShowAdd(true)} className="fab">
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
              <h2 className="text-lg font-bold">Add Client</h2>
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
                  {s.flag} {s.name} — {s.location}
                </option>
              ))}
            </select>
            <select
              value={addForm.protocol}
              onChange={(e) => setAddForm({ ...addForm, protocol: e.target.value as ProtocolType })}
              className="glass-input w-full px-4 py-3 text-sm"
            >
              {PROTOCOL_TYPES.map((t) => (
                <option key={t} value={t} className="bg-surface">
                  {PROTOCOL_META[t].name}
                </option>
              ))}
            </select>
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
              disabled={!addForm.name || !addForm.email}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white font-semibold text-sm disabled:opacity-40 active:scale-[0.98] transition-transform"
            >
              Add Client
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
