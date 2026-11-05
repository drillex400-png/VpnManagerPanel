import { useState, useEffect } from 'react';
import { X, Key, Globe, Cpu, Download, Loader2, Shield, Hash, Network, Zap, RefreshCw, Check } from 'lucide-react';
import { api } from '../api';
import type { Server, XrayVersions } from '../types';

const REALITY_TARGETS = [
  { dest: 'www.microsoft.com:443', sni: 'www.microsoft.com' },
  { dest: 'www.apple.com:443', sni: 'www.apple.com' },
  { dest: 'www.cloudflare.com:443', sni: 'www.cloudflare.com' },
  { dest: 'www.amazon.com:443', sni: 'www.amazon.com' },
  { dest: 'www.google.com:443', sni: 'www.google.com' },
  { dest: 'www.yahoo.com:443', sni: 'www.yahoo.com' },
  { dest: 'www.tesla.com:443', sni: 'www.tesla.com' },
  { dest: 'www.lovelive.us:443', sni: 'www.lovelive.us' },
];

const FLOW_OPTIONS = ['xtls-rprx-vision', 'none'];

export default function ProtocolEditor({
  server,
  onClose,
  onSaved,
}: {
  server: Server;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [versions, setVersions] = useState<XrayVersions | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Protocol configuration form state
  const [form, setForm] = useState({
    xrayVersion: server.xrayVersion,
    port: server.port,
    realityDest: server.realityDest,
    realitySNI: server.realitySNI,
    realityPublicKey: server.realityPublicKey,
    realityPrivateKey: server.realityPrivateKey,
    realityShortIds: server.realityShortIds.join(', '),
    flow: 'xtls-rprx-vision',
  });

  useEffect(() => {
    api.xray.versions().then(setVersions).catch(console.error);
  }, []);

  const update = (patch: Partial<typeof form>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  };

  const handleTargetChange = (dest: string) => {
    const target = REALITY_TARGETS.find((t) => t.dest === dest);
    if (target) {
      update({ realityDest: target.dest, realitySNI: target.sni });
    } else {
      update({ realityDest: dest, realitySNI: dest.split(':')[0] });
    }
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

  const handleRegenerateKeys = async () => {
    if (!confirm('Regenerate Reality keys? All existing clients will need updated URLs.')) return;
    setRegenerating(true);
    try {
      const res = await api.servers.regenerateKeys(server.id);
      update({
        realityPublicKey: res.server.realityPublicKey,
        realityPrivateKey: res.server.realityPrivateKey,
        realityShortIds: res.server.realityShortIds.join(', '),
      });
      onSaved();
    } catch (e) {
      alert(`Error: ${(e as Error).message}`);
    }
    setRegenerating(false);
  };

  const handleSave = () => {
    setSaving(true);
    const shortIds = form.realityShortIds
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    api.servers
      .update(server.id, {
        xrayVersion: form.xrayVersion,
        port: form.port,
        realityDest: form.realityDest,
        realitySNI: form.realitySNI,
        realityShortIds: shortIds,
      })
      .then(() => {
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        onSaved();
      })
      .catch((e) => {
        setSaving(false);
        alert(`Save failed: ${(e as Error).message}`);
      });
  };

  const needsDownload =
    form.xrayVersion && versions && !versions.downloaded.includes(form.xrayVersion);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
      <div
        className="relative w-full max-w-md glass-card rounded-t-[2rem] p-6 animate-slide-up space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center">
              <Shield size={18} className="text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-display">Protocol Editor</h2>
              <p className="text-[10px] text-white/40">VLESS + Reality · {server.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/70 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Section: Xray Core */}
        <Section icon={Cpu} title="Xray Core">
          <label className="text-xs text-white/40 mb-1.5 block">Version</label>
          <select
            value={form.xrayVersion}
            onChange={(e) => update({ xrayVersion: e.target.value })}
            className="glass-input w-full px-4 py-3 text-sm"
          >
            {versions?.available?.length ? (
              versions.available.map((v) => (
                <option key={v} value={v} className="bg-surface">
                  {v} {versions.downloaded.includes(v) ? '✓' : '(download needed)'}
                </option>
              ))
            ) : (
              <option value={form.xrayVersion} className="bg-surface">{form.xrayVersion}</option>
            )}
          </select>
          {needsDownload && (
            <button
              onClick={() => handleDownloadVersion(form.xrayVersion)}
              disabled={downloading === form.xrayVersion}
              className="w-full mt-2 py-2.5 rounded-2xl bg-violet-500/15 text-violet-400 text-xs font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {downloading === form.xrayVersion ? (
                <><Loader2 size={14} className="animate-spin" /> Downloading...</>
              ) : (
                <><Download size={14} /> Download {form.xrayVersion}</>
              )}
            </button>
          )}
        </Section>

        {/* Section: Network */}
        <Section icon={Network} title="Network">
          <label className="text-xs text-white/40 mb-1.5 block">VLESS Listen Port</label>
          <input
            type="number"
            value={form.port}
            onChange={(e) => update({ port: Number(e.target.value) })}
            className="glass-input w-full px-4 py-3 text-sm"
          />
          <label className="text-xs text-white/40 mb-1.5 mt-3 block">Flow</label>
          <select
            value={form.flow}
            onChange={(e) => update({ flow: e.target.value })}
            className="glass-input w-full px-4 py-3 text-sm"
          >
            {FLOW_OPTIONS.map((f) => (
              <option key={f} value={f} className="bg-surface">{f}</option>
            ))}
          </select>
        </Section>

        {/* Section: Reality Camouflage */}
        <Section icon={Globe} title="Reality Camouflage (SNI)">
          <label className="text-xs text-white/40 mb-1.5 block">SNI Target</label>
          <select
            value={form.realityDest}
            onChange={(e) => handleTargetChange(e.target.value)}
            className="glass-input w-full px-4 py-3 text-sm"
          >
            {REALITY_TARGETS.map((t) => (
              <option key={t.dest} value={t.dest} className="bg-surface">{t.sni}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div>
              <label className="text-[10px] text-white/30 mb-1 block">Dest</label>
              <input
                value={form.realityDest}
                onChange={(e) => update({ realityDest: e.target.value })}
                className="glass-input w-full px-3 py-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] text-white/30 mb-1 block">Server Name (SNI)</label>
              <input
                value={form.realitySNI}
                onChange={(e) => update({ realitySNI: e.target.value })}
                className="glass-input w-full px-3 py-2 text-xs font-mono"
              />
            </div>
          </div>
          <p className="text-[10px] text-white/30 leading-relaxed mt-2">
            The SNI target is the website Xray uses as camouflage. It must support TLS 1.3 and H2.
          </p>
        </Section>

        {/* Section: Keys */}
        <Section icon={Key} title="Reality Keys">
          <div className="space-y-2">
            <KeyRow label="Public Key" value={form.realityPublicKey} />
            <KeyRow label="Private Key" value={form.realityPrivateKey} />
            <div>
              <label className="text-[10px] text-white/30 mb-1 flex items-center gap-1">
                <Hash size={9} /> Short IDs
              </label>
              <input
                value={form.realityShortIds}
                onChange={(e) => update({ realityShortIds: e.target.value })}
                placeholder="comma-separated hex"
                className="glass-input w-full px-3 py-2 text-xs font-mono"
              />
            </div>
          </div>
          <button
            onClick={handleRegenerateKeys}
            disabled={regenerating}
            className="w-full mt-3 py-2.5 rounded-2xl bg-violet-500/15 text-violet-400 text-xs font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {regenerating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {regenerating ? 'Regenerating...' : 'Regenerate Keys'}
          </button>
          <p className="text-[10px] text-amber-400/60 mt-1.5 leading-relaxed flex items-center gap-1">
            <Zap size={9} /> Regenerating keys invalidates all existing client URLs.
          </p>
        </Section>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary w-full py-3.5 text-sm flex items-center justify-center gap-2"
        >
          {saved ? <Check size={16} /> : saving ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
          {saved ? 'Saved' : saving ? 'Saving...' : 'Save Protocol'}
        </button>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof Key; title: string; children: React.ReactNode }) {
  return (
    <div className="glass-soft rounded-2xl p-4 space-y-1">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className="text-violet-400" />
        <h3 className="text-sm font-semibold text-white/70 font-display">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function KeyRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="text-[10px] text-white/30 mb-1 block">{label}</label>
      <div className="glass-input w-full px-3 py-2 text-xs font-mono text-white/60 truncate">
        {value}
      </div>
    </div>
  );
}
