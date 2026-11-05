import { useState, useMemo } from 'react';
import { X, Shield, Network, Globe, Key, Cpu, Download, Loader2, RefreshCw, Check, Plus, Trash2, Radio } from 'lucide-react';
import { api } from '../api';
import {
  PROTOCOLS, NETWORKS, SECURITY,
  getProtocol, getNetwork, getSecurity,
  buildDefaults, buildInboundDefaults,
  REALITY_TARGETS,
  type ProtocolType, type NetworkType, type SecurityType, type FieldDef,
} from '../protocols';
import type { Server, Inbound, XrayVersions } from '../types';

interface Props {
  server: Server;
  inbound?: Inbound | null; // null = create new, Inbound = edit existing
  onClose: () => void;
  onSaved: () => void;
}

export default function InboundEditor({ server, inbound, onClose, onSaved }: Props) {
  const isEdit = !!inbound;
  const versions = useVersions();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  // Form state
  const [protocol, setProtocol] = useState<ProtocolType>(inbound?.protocol || 'vless');
  const [port, setPort] = useState(inbound?.port || server.port || 443);
  const [network, setNetwork] = useState<NetworkType>(inbound?.network || 'tcp');
  const [security, setSecurity] = useState<SecurityType>(inbound?.security || 'reality');
  const [protocolSettings, setProtocolSettings] = useState<Record<string, any>>(
    inbound?.protocolSettings || buildInboundDefaults('vless').protocolSettings,
  );
  const [transportSettings, setTransportSettings] = useState<Record<string, any>>(
    inbound?.transportSettings || buildDefaults(NETWORKS[0].fields),
  );
  const [securitySettings, setSecuritySettings] = useState<Record<string, any>>(
    inbound?.securitySettings || buildDefaults(SECURITY[2].fields),
  );

  const protoDef = getProtocol(protocol);
  const netDef = getNetwork(network);
  const secDef = getSecurity(security);

  const handleProtocolChange = (p: ProtocolType) => {
    const def = getProtocol(p);
    const defaults = buildInboundDefaults(p);
    setProtocol(p);
    setNetwork(def.supportedNetworks[0]);
    setSecurity(def.supportedSecurity[0]);
    setProtocolSettings(defaults.protocolSettings);
    setTransportSettings(defaults.transportSettings);
    setSecuritySettings(defaults.securitySettings);
  };

  const handleNetworkChange = (n: NetworkType) => {
    const def = getNetwork(n);
    setNetwork(n);
    setTransportSettings(buildDefaults(def.fields));
  };

  const handleSecurityChange = (s: SecurityType) => {
    const def = getSecurity(s);
    setSecurity(s);
    const newSettings = buildDefaults(def.fields);
    // For reality, pre-fill from server defaults
    if (s === 'reality' && !inbound) {
      newSettings.dest = 'www.microsoft.com:443';
      newSettings.serverNames = 'www.microsoft.com';
    }
    setSecuritySettings(newSettings);
  };

  const updateSetting = (
    group: 'protocol' | 'transport' | 'security',
    key: string,
    value: any,
  ) => {
    const setter = group === 'protocol' ? setProtocolSettings : group === 'transport' ? setTransportSettings : setSecuritySettings;
    const state = group === 'protocol' ? protocolSettings : group === 'transport' ? transportSettings : securitySettings;
    setter({ ...state, [key]: value });
    setSaved(false);
  };

  const handleRegenerateKeys = async () => {
    if (!confirm('Regenerate Reality keys? All existing clients will need updated URLs.')) return;
    setRegenerating(true);
    try {
      const res = await api.servers.regenerateInboundKeys(server.id, inbound!.id);
      const updatedInbound = res.server.inbounds?.find((i) => i.id === inbound!.id);
      if (updatedInbound) {
        setSecuritySettings({ ...updatedInbound.securitySettings });
      }
      onSaved();
    } catch (e) {
      alert(`Error: ${(e as Error).message}`);
    }
    setRegenerating(false);
  };

  const handleDownloadVersion = async (ver: string) => {
    setDownloading(ver);
    try {
      await api.xray.download(ver);
      versions.refresh();
    } catch (e) {
      alert(`Download failed: ${(e as Error).message}`);
    }
    setDownloading(null);
  };

  const handleSave = () => {
    setSaving(true);
    const data = { protocol, port, network, security, protocolSettings, transportSettings, securitySettings };

    const promise = isEdit
      ? api.servers.updateInbound(server.id, inbound!.id, data)
      : api.servers.addInbound(server.id, data);

    promise
      .then(() => {
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        onSaved();
        onClose();
      })
      .catch((e) => {
        setSaving(false);
        alert(`Save failed: ${(e as Error).message}`);
      });
  };

  const handleDelete = () => {
    if (!isEdit) return;
    if (!confirm('Delete this inbound?')) return;
    api.servers
      .deleteInbound(server.id, inbound!.id)
      .then(() => {
        onSaved();
        onClose();
      })
      .catch((e) => alert(`Delete failed: ${(e as Error).message}`));
  };

  const isReality = security === 'reality';
  const needsDownload = server.xrayVersion && versions.data && !versions.data.downloaded.includes(server.xrayVersion);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
      <div
        className="relative w-full max-w-md glass-card rounded-t-[2rem] p-6 animate-slide-up space-y-5 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between sticky -top-6 -mt-6 pt-6 pb-2 bg-[rgba(7,7,12,0.6)] backdrop-blur-xl z-10 -mx-6 px-6 rounded-t-[2rem]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center">
              <Shield size={18} className="text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-display">{isEdit ? 'Edit Inbound' : 'Add Inbound'}</h2>
              <p className="text-[10px] text-white/40">{server.flag} {server.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/70 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Xray version notice */}
        {needsDownload && (
          <div className="flex items-center gap-2 p-3 rounded-2xl bg-amber-500/10 text-amber-400 text-xs">
            <Download size={14} className="flex-shrink-0" />
            <span className="flex-1">Xray {server.xrayVersion} needs download</span>
            <button
              onClick={() => handleDownloadVersion(server.xrayVersion)}
              disabled={downloading === server.xrayVersion}
              className="px-2 py-1 rounded-lg bg-amber-500/20 text-xs font-medium disabled:opacity-50"
            >
              {downloading === server.xrayVersion ? <Loader2 size={12} className="animate-spin" /> : 'Download'}
            </button>
          </div>
        )}

        {/* ── Protocol selection ─────────────────────────────────────── */}
        <Section icon={Radio} title="Protocol">
          {!isEdit && (
            <div className="grid grid-cols-2 gap-2">
              {PROTOCOLS.map((p) => (
                <button
                  key={p.type}
                  onClick={() => handleProtocolChange(p.type)}
                  className={`p-3 rounded-2xl text-left transition-all ${
                    protocol === p.type
                      ? 'ring-1 ring-violet-500/50'
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                  style={protocol === p.type ? { background: p.color + '15' } : undefined}
                >
                  <p className="text-xs font-semibold" style={{ color: protocol === p.type ? p.color : undefined }}>
                    {p.label}
                  </p>
                  <p className="text-[9px] text-white/30 leading-tight mt-0.5">{p.description}</p>
                </button>
              ))}
            </div>
          )}
          {isEdit && (
            <div className="flex items-center gap-2 p-3 rounded-2xl" style={{ background: protoDef.color + '15' }}>
              <span className="text-sm font-semibold" style={{ color: protoDef.color }}>{protoDef.label}</span>
              <span className="text-[10px] text-white/40">{protoDef.description}</span>
            </div>
          )}

          {/* Protocol-specific settings */}
          {protoDef.fields.length > 0 && (
            <div className="space-y-3 mt-3">
              {protoDef.fields.map((f) => (
                <FieldRow
                  key={f.key}
                  field={f}
                  value={protocolSettings[f.key]}
                  onChange={(v) => updateSetting('protocol', f.key, v)}
                  allValues={protocolSettings}
                />
              ))}
            </div>
          )}
        </Section>

        {/* ── Network / Port ────────────────────────────────────────── */}
        <Section icon={Globe} title="Network & Port">
          <label className="text-xs text-white/40 mb-1.5 block">Listen Port</label>
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
            className="glass-input w-full px-4 py-3 text-sm"
          />

          <label className="text-xs text-white/40 mb-1.5 mt-3 block">Transport</label>
          <div className="grid grid-cols-3 gap-2">
            {NETWORKS.filter((n) => protoDef.supportedNetworks.includes(n.type)).map((n) => (
              <button
                key={n.type}
                onClick={() => handleNetworkChange(n.type)}
                className={`py-2.5 rounded-2xl text-xs font-medium transition-all ${
                  network === n.type
                    ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/40'
                    : 'bg-white/5 text-white/50 hover:bg-white/10'
                }`}
              >
                {n.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-white/30 mt-1.5">{netDef.description}</p>

          {/* Transport-specific settings */}
          {netDef.fields
            .filter((f) => !f.showIf || transportSettings[f.showIf.field] === f.showIf.value)
            .map((f) => (
              <FieldRow
                key={f.key}
                field={f}
                value={transportSettings[f.key]}
                onChange={(v) => updateSetting('transport', f.key, v)}
                allValues={transportSettings}
              />
            ))}
        </Section>

        {/* ── Security ──────────────────────────────────────────────── */}
        <Section icon={Shield} title="Security">
          <div className="grid grid-cols-3 gap-2">
            {SECURITY.filter((s) => protoDef.supportedSecurity.includes(s.type)).map((s) => (
              <button
                key={s.type}
                onClick={() => handleSecurityChange(s.type)}
                className={`py-2.5 rounded-2xl text-xs font-medium transition-all ${
                  security === s.type
                    ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/40'
                    : 'bg-white/5 text-white/50 hover:bg-white/10'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-white/30 mt-1.5">{secDef.description}</p>

          {/* Security-specific settings */}
          {secDef.fields
            .filter((f) => !f.showIf || securitySettings[f.showIf.field] === f.showIf.value)
            .map((f) => (
              <FieldRow
                key={f.key}
                field={f}
                value={securitySettings[f.key]}
                onChange={(v) => updateSetting('security', f.key, v)}
                allValues={securitySettings}
              />
            ))}

          {/* Reality: SNI target quick-pick */}
          {isReality && (
            <div className="mt-2">
              <label className="text-[10px] text-white/30 mb-1 block">Quick-pick SNI target</label>
              <select
                value={securitySettings.dest || ''}
                onChange={(e) => {
                  const target = REALITY_TARGETS.find((t) => t.dest === e.target.value);
                  if (target) {
                    updateSetting('security', 'dest', target.dest);
                    updateSetting('security', 'serverNames', target.sni);
                  } else {
                    updateSetting('security', 'dest', e.target.value);
                  }
                }}
                className="glass-input w-full px-4 py-2.5 text-xs"
              >
                {REALITY_TARGETS.map((t) => (
                  <option key={t.dest} value={t.dest} className="bg-surface">{t.sni}</option>
                ))}
              </select>
            </div>
          )}

          {/* Reality: Regenerate keys */}
          {isReality && isEdit && (
            <>
              <button
                onClick={handleRegenerateKeys}
                disabled={regenerating}
                className="w-full mt-3 py-2.5 rounded-2xl bg-violet-500/15 text-violet-400 text-xs font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {regenerating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {regenerating ? 'Regenerating...' : 'Regenerate Reality Keys'}
              </button>
              <p className="text-[10px] text-amber-400/60 mt-1.5 leading-relaxed">
                Regenerating keys invalidates all existing client URLs for this server.
              </p>
            </>
          )}
        </Section>

        {/* ── Actions ───────────────────────────────────────────────── */}
        <div className="flex gap-3">
          {isEdit && (
            <button
              onClick={handleDelete}
              className="px-4 py-3.5 rounded-2xl bg-red-500/15 text-red-400 text-sm font-medium flex items-center justify-center active:scale-95 transition-transform"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex-1 py-3.5 text-sm flex items-center justify-center gap-2"
          >
            {saved ? <Check size={16} /> : saving ? <Loader2 size={16} className="animate-spin" /> : isEdit ? <Shield size={16} /> : <Plus size={16} />}
            {saved ? 'Saved' : saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Inbound'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reusable field renderer ────────────────────────────────────────────

function FieldRow({
  field,
  value,
  onChange,
  allValues,
}: {
  field: FieldDef;
  value: any;
  onChange: (v: any) => void;
  allValues: Record<string, any>;
}) {
  // Check conditional display
  if (field.showIf) {
    const condVal = allValues[field.showIf.field];
    if (condVal !== field.showIf.value) return null;
  }

  return (
    <div>
      <label className="text-xs text-white/40 mb-1.5 flex items-center gap-1">
        {field.label}
        {field.description && (
          <span className="text-[9px] text-white/20 ml-1">— {field.description}</span>
        )}
      </label>

      {field.type === 'boolean' ? (
        <button
          onClick={() => onChange(!value)}
          className={`w-full px-4 py-3 rounded-2xl text-sm text-left transition-all flex items-center justify-between ${
            value ? 'bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30' : 'glass-input text-white/50'
          }`}
        >
          <span>{value ? 'Enabled' : 'Disabled'}</span>
          <span className={`w-9 h-5 rounded-full transition-all relative ${value ? 'bg-violet-500' : 'bg-white/10'}`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${value ? 'left-[18px]' : 'left-0.5'}`} />
          </span>
        </button>
      ) : field.type === 'select' ? (
        <select
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className="glass-input w-full px-4 py-3 text-sm"
        >
          {field.options?.map((o) => (
            <option key={o.value} value={o.value} className="bg-surface">{o.label}</option>
          ))}
        </select>
      ) : field.type === 'list' ? (
        <input
          value={Array.isArray(value) ? value.join(', ') : String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="glass-input w-full px-4 py-3 text-sm"
        />
      ) : (
        <input
          type={field.type === 'number' ? 'number' : 'text'}
          value={String(value ?? '')}
          onChange={(e) => onChange(field.type === 'number' ? Number(e.target.value) : e.target.value)}
          placeholder={field.placeholder}
          className="glass-input w-full px-4 py-3 text-sm font-mono"
        />
      )}
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────

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

// ── Versions hook ──────────────────────────────────────────────────────

function useVersions() {
  const [data, setData] = useState<XrayVersions | null>(null);
  const refresh = () => api.xray.versions().then(setData).catch(console.error);
  useState(() => { refresh(); });
  return { data, refresh };
}
