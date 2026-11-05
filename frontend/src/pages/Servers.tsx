import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, ChevronDown, Cpu, HardDrive, MemoryStick, Trash2, X, Globe, Wifi, Play, Square, Download, Key, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../api';
import { PROTOCOL_META } from '../types';
import type { Server, PingData, XrayVersions } from '../types';

const flags = ['🇩🇪', '🇳🇱', '🇯🇵', '🇺🇸', '🇸🇬', '🇬🇧', '🇫🇷', '🇨🇦', '🌐'];
const REALITY_TARGETS = [
  { dest: 'www.microsoft.com:443', sni: 'www.microsoft.com' },
  { dest: 'www.apple.com:443', sni: 'www.apple.com' },
  { dest: 'www.cloudflare.com:443', sni: 'www.cloudflare.com' },
  { dest: 'www.amazon.com:443', sni: 'www.amazon.com' },
  { dest: 'www.google.com:443', sni: 'www.google.com' },
];

export default function Servers() {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '', host: '', port: 443, location: '', flag: '🌐',
    xrayVersion: '', realityDest: 'www.microsoft.com:443', realitySNI: 'www.microsoft.com',
  });
  const [versions, setVersions] = useState<XrayVersions | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [starting, setStarting] = useState<number | null>(null);
  const [pings, setPings] = useState<PingData[]>([]);

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
      // Auto-select the first available version if form version is empty
      if (!addForm.xrayVersion && v.available.length > 0) {
        setAddForm(prev => ({ ...prev, xrayVersion: v.available[0] }));
      }
    }).catch(console.error);
    api.ping().then(setPings).catch(console.error);
    const interval = setInterval(() => api.ping().then(setPings).catch(() => {}), 5000);
    return () => clearInterval(interval);
  }, [load]);

  const handleAdd = () => {
    api.servers.create(addForm).then(() => {
      setShowAdd(false);
      setAddForm({ name: '', host: '', port: 443, location: '', flag: '🌐', xrayVersion: '', realityDest: 'www.microsoft.com:443', realitySNI: 'www.microsoft.com' });
      load();
    });
  };

  const handleDelete = (id: number) => {
    api.servers.delete(id).then(load);
  };

  const handleStart = async (id: number) => {
    setStarting(id);
    try {
      const res = await api.servers.start(id);
      if (!res.success && res.error) {
        alert(`Failed to start: ${res.error}`);
      }
    } catch (e) {
      alert(`Error: ${(e as Error).message}`);
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
    } catch (e) {
      alert(`Download failed: ${(e as Error).message}`);
    }
    setDownloading(null);
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
      ? { dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Running' }
      : s === 'error'
        ? { dot: 'bg-red-400', text: 'text-red-400', bg: 'bg-red-500/10', label: 'Error' }
        : { dot: 'bg-white/30', text: 'text-white/50', bg: 'bg-white/5', label: 'Stopped' };

  return (
    <div className="px-4 py-6 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Servers</h1>
          <p className="text-sm text-white/40">{servers.length} servers • {servers.filter(s => s.status === 'running').length} running</p>
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

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="glass-card p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto mb-4">
            <Globe size={28} className="text-violet-400" />
          </div>
          <p className="text-sm text-white/60 mb-1">No servers yet</p>
          <p className="text-xs text-white/30">Add your first Xray server to start</p>
        </div>
      )}

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
                  {(() => {
                    const p = pings.find((pp) => pp.id === s.id);
                    const pv = p?.ping ?? -1;
                    const pc = pv < 0 ? 'text-white/20' : pv < 50 ? 'text-emerald-400' : pv < 150 ? 'text-amber-400' : 'text-red-400';
                    return <span className={`flex items-center gap-0.5 text-[10px] font-mono ${pc}`}><Wifi size={10} />{pv > 0 ? `${pv}ms` : '—'}</span>;
                  })()}
                  <ChevronDown
                    size={18}
                    className={`text-white/30 transition-transform ${isExp ? 'rotate-180' : ''}`}
                  />
                </div>
              </div>

              {/* Protocol tag */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{ background: PROTOCOL_META.vless.color + '15', color: PROTOCOL_META.vless.color }}
                >
                  VLESS + Reality :{s.port}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40 font-medium">
                  Xray {s.xrayVersion}
                </span>
              </div>

              {/* Resource bars */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: Cpu, label: 'CPU', value: s.cpu },
                  { icon: MemoryStick, label: 'RAM', value: s.ram },
                  { icon: HardDrive, label: 'SSD', value: 0 },
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
              <div className="border-t border-white/5 p-4 space-y-3 animate-slide-down">
                {/* Error message */}
                {s.error && (
                  <div className="flex items-start gap-2 p-3 rounded-2xl bg-red-500/10 text-red-400 text-xs">
                    <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                    <span className="break-all">{s.error}</span>
                  </div>
                )}

                {/* Start/Stop controls */}
                <div className="flex gap-2">
                  {s.status !== 'running' ? (
                    <button
                      onClick={() => handleStart(s.id)}
                      disabled={starting === s.id}
                      className="flex-1 py-2.5 rounded-2xl bg-emerald-500/15 text-emerald-400 text-xs font-medium hover:bg-emerald-500/25 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {starting === s.id ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                      {starting === s.id ? 'Starting...' : 'Start Xray'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStop(s.id)}
                      className="flex-1 py-2.5 rounded-2xl bg-amber-500/15 text-amber-400 text-xs font-medium hover:bg-amber-500/25 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Square size={14} /> Stop Xray
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="py-2.5 px-4 rounded-2xl bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Reality config */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-white/50 font-medium">
                    <Key size={12} /> Reality Configuration
                  </div>
                  <div className="bg-white/[0.02] rounded-2xl p-3 space-y-2">
                    <ConfigRow label="Dest" value={s.realityDest} />
                    <ConfigRow label="SNI" value={s.realitySNI} />
                    <ConfigRow label="Public Key" value={s.realityPublicKey} mono />
                    <ConfigRow label="Private Key" value={s.realityPrivateKey} mono />
                    <ConfigRow label="Short IDs" value={s.realityShortIds.join(', ')} mono />
                    <ConfigRow label="API Port" value={String(s.apiPort)} />
                    <ConfigRow label="Xray Version" value={s.xrayVersion} />
                    <ConfigRow label="Clients" value={String(s.clientCount)} />
                  </div>
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

      {/* Add Server Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowAdd(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md glass-card rounded-t-3xl p-6 animate-slide-up space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Add Xray Server</h2>
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
              placeholder="Host / IP (e.g. vpn.example.com)"
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

            {/* Flag picker */}
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

            {/* Xray version selector */}
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Xray Version</label>
              <select
                value={addForm.xrayVersion || versions?.default || ''}
                onChange={(e) => setAddForm({ ...addForm, xrayVersion: e.target.value })}
                className="glass-input w-full px-4 py-3 text-sm"
              >
                {versions?.available?.length ? (
                  versions.available.map((v) => (
                    <option key={v} value={v} className="bg-surface">
                      {v} {versions.downloaded.includes(v) ? '✓' : '(download needed)'}
                    </option>
                  ))
                ) : (
                  <option value={versions?.default || 'v25.10.14'} className="bg-surface">
                    {versions?.default || 'v25.10.14'} (default)
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
                    <><Loader2 size={14} className="animate-spin" /> Downloading...</>
                  ) : (
                    <><Download size={14} /> Download Xray {addForm.xrayVersion}</>
                  )}
                </button>
              )}
            </div>

            {/* Reality target */}
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Reality Target (SNI)</label>
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
              X25519 keys and Reality short IDs will be auto-generated. The VLESS+Reality inbound will listen on the specified port.
            </p>

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
    </div>
  );
}

function ConfigRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-[10px] text-white/30 flex-shrink-0 pt-0.5">{label}</span>
      <span className={`text-[10px] text-white/60 text-right break-all ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}
