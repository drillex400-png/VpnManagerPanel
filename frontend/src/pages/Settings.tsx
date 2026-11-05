import { useEffect, useState } from 'react';
import { Save, RotateCcw, Globe, Cpu, HardDrive, Calendar, Check } from 'lucide-react';
import { api } from '../api';
import type { Settings as SettingsType, XrayVersions } from '../types';

const REALITY_TARGETS = [
  { dest: 'www.microsoft.com:443', sni: 'www.microsoft.com' },
  { dest: 'www.apple.com:443', sni: 'www.apple.com' },
  { dest: 'www.cloudflare.com:443', sni: 'www.cloudflare.com' },
  { dest: 'www.amazon.com:443', sni: 'www.amazon.com' },
  { dest: 'www.google.com:443', sni: 'www.google.com' },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [versions, setVersions] = useState<XrayVersions | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    api.settings.get().then(setSettings);
    api.xray.versions().then(setVersions).catch(console.error);
  }, []);

  if (!settings) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const update = (patch: Partial<SettingsType>) => {
    setSettings({ ...settings, ...patch });
    setSaved(false);
  };

  const handleSave = () => {
    setSaving(true);
    api.settings.update(settings).then(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
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

  return (
    <div className="px-4 py-6 space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-white/40">Default configuration</p>
      </div>

      {/* Xray Version */}
      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Cpu size={16} className="text-violet-400" />
          <h2 className="text-sm font-semibold text-white/60">Xray Core</h2>
        </div>
        <div>
          <label className="text-xs text-white/40 mb-1.5 block">Default Version</label>
          <select
            value={settings.defaultXrayVersion}
            onChange={(e) => update({ defaultXrayVersion: e.target.value })}
            className="glass-input w-full px-4 py-3 text-sm"
          >
            {versions?.available?.length ? (
              versions.available.map((v) => (
                <option key={v} value={v} className="bg-surface">
                  {v} {versions.downloaded.includes(v) ? '✓' : '(needs download)'}
                </option>
              ))
            ) : (
              <option value={settings.defaultXrayVersion} className="bg-surface">{settings.defaultXrayVersion}</option>
            )}
          </select>
        </div>
        {settings.defaultXrayVersion && versions && !versions.downloaded.includes(settings.defaultXrayVersion) && (
          <button
            onClick={() => handleDownloadVersion(settings.defaultXrayVersion)}
            disabled={downloading === settings.defaultXrayVersion}
            className="w-full py-2.5 rounded-2xl bg-violet-500/15 text-violet-400 text-xs font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {downloading === settings.defaultXrayVersion ? 'Downloading...' : `Download ${settings.defaultXrayVersion}`}
          </button>
        )}
        <div className="text-[10px] text-white/30">
          {versions?.downloaded.length || 0} version(s) downloaded locally
        </div>
      </div>

      {/* Reality Defaults */}
      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Globe size={16} className="text-violet-400" />
          <h2 className="text-sm font-semibold text-white/60">Reality Defaults</h2>
        </div>
        <div>
          <label className="text-xs text-white/40 mb-1.5 block">Default SNI Target</label>
          <select
            value={settings.defaultRealityDest}
            onChange={(e) => {
              const target = REALITY_TARGETS.find(t => t.dest === e.target.value);
              if (target) update({ defaultRealityDest: target.dest, defaultRealitySNI: target.sni });
            }}
            className="glass-input w-full px-4 py-3 text-sm"
          >
            {REALITY_TARGETS.map((t) => (
              <option key={t.dest} value={t.dest} className="bg-surface">{t.sni}</option>
            ))}
          </select>
        </div>
        <p className="text-[10px] text-white/30 leading-relaxed">
          The SNI target is the website Xray will use as camouflage for Reality connections. It must support TLS 1.3 and H2.
        </p>
      </div>

      {/* Client Defaults */}
      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <HardDrive size={16} className="text-violet-400" />
          <h2 className="text-sm font-semibold text-white/60">Client Defaults</h2>
        </div>
        <div>
          <label className="text-xs text-white/40 mb-1.5 block">Default Data Limit (GB, 0 = unlimited)</label>
          <input
            type="number"
            value={settings.defaultTotalLimit}
            onChange={(e) => update({ defaultTotalLimit: Number(e.target.value) })}
            className="glass-input w-full px-4 py-3 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-white/40 mb-1.5 block">
            <Calendar size={11} className="inline mr-1" />
            Default Expiry (days)
          </label>
          <input
            type="number"
            value={settings.defaultExpiryDays}
            onChange={(e) => update({ defaultExpiryDays: Number(e.target.value) })}
            className="glass-input w-full px-4 py-3 text-sm"
          />
        </div>
      </div>

      {/* About */}
      <div className="glass-card p-5 space-y-2">
        <h2 className="text-sm font-semibold text-white/60">About</h2>
        <div className="space-y-1.5">
          <Row label="Protocol" value="VLESS + Reality" />
          <Row label="Flow" value="xtls-rprx-vision" />
          <Row label="Transport" value="TCP" />
          <Row label="Encryption" value="X25519 / Reality" />
          <Row label="Core" value="Xray-core" />
        </div>
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98] transition-transform"
      >
        {saved ? <Check size={16} /> : saving ? <RotateCcw size={16} className="animate-spin" /> : <Save size={16} />}
        {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-white/40">{label}</span>
      <span className="text-xs text-white/60 font-mono">{value}</span>
    </div>
  );
}
