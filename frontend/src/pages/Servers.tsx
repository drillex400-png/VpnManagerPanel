import { useEffect, useState } from 'react';
import { Plus, Search, ChevronDown, Cpu, HardDrive, MemoryStick, Trash2, X, Globe } from 'lucide-react';
import { api } from '../api';
import { PROTOCOL_META, PROTOCOL_TYPES } from '../types';
import type { Server, ProtocolType } from '../types';

const flags = ['🇩🇪', '🇳🇱', '🇯🇵', '🇺🇸', '🇸🇬', '🇬🇧', '🇫🇷', '🇨🇦', '🌐'];

export default function Servers() {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', host: '', port: 443, location: '', flag: '🌐' });
  const [addProto, setAddProto] = useState<{ serverId: number; type: ProtocolType; port: number } | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = () => {
    api.servers.list().then((s) => {
      setServers(s);
      setLoading(false);
    });
  };

  const handleAdd = () => {
    api.servers.create(addForm).then(() => {
      setShowAdd(false);
      setAddForm({ name: '', host: '', port: 443, location: '', flag: '🌐' });
      load();
    });
  };

  const handleDelete = (id: number) => {
    api.servers.delete(id).then(load);
  };

  const handleAddProto = () => {
    if (!addProto) return;
    api.servers.addProtocol(addProto.serverId, { type: addProto.type, port: addProto.port }).then(() => {
      setAddProto(null);
      load();
    });
  };

  const handleDeleteProto = (id: number) => {
    api.servers.deleteProtocol(id).then(load);
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
    s === 'online'
      ? { dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Online' }
      : s === 'maintenance'
        ? { dot: 'bg-amber-400', text: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Maintenance' }
        : { dot: 'bg-red-400', text: 'text-red-400', bg: 'bg-red-500/10', label: 'Offline' };

  return (
    <div className="px-4 py-6 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Servers</h1>
          <p className="text-sm text-white/40">{servers.length} servers • {servers.filter(s => s.status === 'online').length} online</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search servers..."
          className="glass-input w-full pl-10 pr-4 py-3 text-sm"
        />
      </div>

      {/* Server cards */}
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
                    <p className="font-semibold">{s.name}</p>
                    <p className="text-xs text-white/40 flex items-center gap-1">
                      <Globe size={11} /> {s.host}:{s.port}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${st.bg} ${st.text} font-medium`}>
                    {st.label}
                  </span>
                  <ChevronDown
                    size={18}
                    className={`text-white/30 transition-transform ${isExp ? 'rotate-180' : ''}`}
                  />
                </div>
              </div>

              {/* Protocol tags */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {s.protocols?.map((p) => (
                  <span
                    key={p.id}
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: PROTOCOL_META[p.type].color + '15',
                      color: PROTOCOL_META[p.type].color,
                    }}
                  >
                    {PROTOCOL_META[p.type].name} :{p.port}
                  </span>
                ))}
              </div>

              {/* Resource bars */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: Cpu, label: 'CPU', value: s.cpu },
                  { icon: MemoryStick, label: 'RAM', value: s.ram },
                  { icon: HardDrive, label: 'SSD', value: s.disk },
                ].map((r, i) => (
                  <div key={i} className="bg-white/[0.03] rounded-xl p-2">
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
              <div className="border-t border-white/5 p-4 space-y-2 animate-slide-down">
                {s.protocols?.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: PROTOCOL_META[p.type].color }} />
                      <div>
                        <span className="text-sm font-medium">{PROTOCOL_META[p.type].name}</span>
                        <span className="text-xs text-white/30 ml-2">:{p.port}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-[10px] text-white/40">{p.clients} clients</p>
                        <p className="text-[10px] text-white/30">↑{p.upload} ↓{p.download} GB</p>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${p.status === 'running' ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>
                        {p.status}
                      </span>
                      <button onClick={() => handleDeleteProto(p.id)} className="text-white/20 hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => setAddProto({ serverId: s.id, type: 'vless', port: 443 })}
                  className="w-full py-2.5 rounded-2xl border border-dashed border-white/10 text-white/40 text-xs hover:border-violet-500/40 hover:text-violet-400 transition-colors flex items-center justify-center gap-1"
                >
                  <Plus size={14} /> Add Protocol
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="w-full py-2.5 rounded-2xl bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={14} /> Delete Server
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* FAB */}
      <button onClick={() => setShowAdd(true)} className="fab">
        <Plus size={24} />
      </button>

      {/* Add Server Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowAdd(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md glass-card rounded-t-3xl p-6 animate-slide-up space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Add Server</h2>
              <button onClick={() => setShowAdd(false)} className="text-white/40">
                <X size={20} />
              </button>
            </div>
            <input
              placeholder="Server name"
              value={addForm.name}
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
              className="glass-input w-full px-4 py-3 text-sm"
            />
            <input
              placeholder="Host (e.g. de-fra-01.example.com)"
              value={addForm.host}
              onChange={(e) => setAddForm({ ...addForm, host: e.target.value })}
              className="glass-input w-full px-4 py-3 text-sm"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                placeholder="Port"
                value={addForm.port}
                onChange={(e) => setAddForm({ ...addForm, port: Number(e.target.value) })}
                className="glass-input w-full px-4 py-3 text-sm"
              />
              <input
                placeholder="Location"
                value={addForm.location}
                onChange={(e) => setAddForm({ ...addForm, location: e.target.value })}
                className="glass-input w-full px-4 py-3 text-sm"
              />
            </div>
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
            <button
              onClick={handleAdd}
              disabled={!addForm.name || !addForm.host}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white font-semibold text-sm disabled:opacity-40 active:scale-[0.98] transition-transform"
            >
              Add Server
            </button>
          </div>
        </div>
      )}

      {/* Add Protocol Modal */}
      {addProto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setAddProto(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md glass-card rounded-t-3xl p-6 animate-slide-up space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Add Protocol</h2>
              <button onClick={() => setAddProto(null)} className="text-white/40">
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PROTOCOL_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setAddProto({ ...addProto, type: t })}
                  className={`p-3 rounded-2xl text-sm font-medium transition-all ${
                    addProto.type === t ? 'ring-1' : 'bg-white/5'
                  }`}
                  style={
                    addProto.type === t
                      ? { background: PROTOCOL_META[t].color + '20', boxShadow: `0 0 0 1px ${PROTOCOL_META[t].color}80` }
                      : {}
                  }
                >
                  {PROTOCOL_META[t].name}
                </button>
              ))}
            </div>
            <input
              type="number"
              placeholder="Port"
              value={addProto.port}
              onChange={(e) => setAddProto({ ...addProto, port: Number(e.target.value) })}
              className="glass-input w-full px-4 py-3 text-sm"
            />
            <button
              onClick={handleAddProto}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white font-semibold text-sm active:scale-[0.98] transition-transform"
            >
              Add Protocol
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
