import { useEffect, useState, useRef } from 'react';
import { Save, RotateCcw, Cpu, HardDrive, Calendar, Check, Shield, Zap, Network, Lock, ToggleLeft, ToggleRight, Eye, EyeOff, Download, Upload, AlertTriangle } from 'lucide-react';
import { api } from '../api';
import type { Settings as SettingsType, XrayVersions } from '../types';
import { useToast } from '../components/Toast';

export default function SettingsPage() {
  const { success: toastSuccess, error: toastError } = useToast();
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [versions, setVersions] = useState<XrayVersions | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleBackup = async () => {
    setBackupBusy(true);
    try {
      const data = await api.backup.export();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `xray-panel-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toastSuccess('Резервная копия сохранена');
    } catch (e) {
      toastError(`Ошибка: ${(e as Error).message}`);
    }
    setBackupBusy(false);
  };

  const handleRestore = async (file: File) => {
    setBackupBusy(true);
    setShowRestore(false);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const result = await api.backup.restore(data);
      toastSuccess(`Восстановлено: ${result.servers} нод, ${result.clients} клиентов`);
      // Перезагружаем настройки
      const s = await api.settings.get();
      setSettings(s);
    } catch (e) {
      toastError(`Ошибка восстановления: ${(e as Error).message}`);
    }
    setBackupBusy(false);
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

  return (
    <div className="px-4 py-6 space-y-5 animate-fade-in">
      <div>
        <h1 className="text-[1.6rem] font-bold font-display">Настройки</h1>
        <p className="text-sm text-white/40">Значения по умолчанию для новых нод и клиентов</p>
      </div>

      {/* Ядро Xray */}
      <div className="glass-card p-5 space-y-3">
        <SectionTitle icon={Cpu} title="Ядро Xray" />
        <div>
          <label className="text-xs text-white/40 mb-1.5 block">Версия по умолчанию</label>
          <select
            value={settings.defaultXrayVersion}
            onChange={(e) => update({ defaultXrayVersion: e.target.value })}
            className="glass-input w-full px-4 py-3 text-sm"
          >
            {versions?.available?.length ? (
              versions.available.map((v) => (
                <option key={v} value={v} className="bg-surface">
                  {v} {versions.downloaded.includes(v) ? '✓' : '(нужна загрузка)'}
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
            {downloading === settings.defaultXrayVersion ? 'Загрузка...' : `Загрузить ${settings.defaultXrayVersion}`}
          </button>
        )}
        <div className="text-[10px] text-white/30">
          {versions?.downloaded.length || 0} верс. загружено локально
        </div>
      </div>

      {/* Клиенты по умолчанию */}
      <div className="glass-card p-5 space-y-3">
        <SectionTitle icon={HardDrive} title="Клиенты по умолчанию" />
        <div>
          <label className="text-xs text-white/40 mb-1.5 block">Лимит трафика (ГБ, 0 = без лимита)</label>
          <input
            type="number"
            value={settings.defaultTotalLimit}
            onChange={(e) => update({ defaultTotalLimit: Number(e.target.value) })}
            className="glass-input w-full px-4 py-3 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-white/40 mb-1.5 block flex items-center gap-1">
            <Calendar size={11} /> Срок действия (дней)
          </label>
          <input
            type="number"
            value={settings.defaultExpiryDays}
            onChange={(e) => update({ defaultExpiryDays: Number(e.target.value) })}
            className="glass-input w-full px-4 py-3 text-sm"
          />
        </div>
      </div>

      {/* О протоколах */}
      <div className="glass-card p-5 space-y-2">
        <SectionTitle icon={Shield} title="О протоколах" />
        <div className="space-y-1.5">
          <Row label="Протоколы" value="VLESS · VMess · Trojan · SS · SOCKS · HTTP" />
          <Row label="Транспорты" value="TCP · mKCP · WS · HTTP/2 · gRPC · QUIC" />
          <Row label="Безопасность" value="None · TLS · Reality" />
          <Row label="Ядро" value="Xray-core" />
        </div>
        <p className="text-[10px] text-white/30 leading-relaxed pt-1 flex items-start gap-1.5">
          <Zap size={10} className="text-violet-400 mt-0.5 flex-shrink-0" />
          Настройки протоколов (SNI, ключи, short IDs, шифры) задаются для каждого инбаунда в редакторе инбаундов.
        </p>
      </div>

      {/* Защита админ-панели */}
      <div className="glass-card p-5 space-y-3">
        <SectionTitle icon={Lock} title="Защита панели" />
        <div>
          <label className="text-xs text-white/40 mb-1.5 block">Логин администратора</label>
          <input
            type="text"
            value={settings.adminUser}
            onChange={(e) => update({ adminUser: e.target.value })}
            className="glass-input w-full px-4 py-3 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-white/40 mb-1.5 block">Пароль</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={settings.adminPassword}
              onChange={(e) => update({ adminPassword: e.target.value })}
              className="glass-input w-full px-4 py-3 pr-10 text-sm"
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <p className="text-[10px] text-white/30 leading-relaxed pt-1 flex items-start gap-1.5">
          <Shield size={10} className="text-violet-400 mt-0.5 flex-shrink-0" />
          Изменения вступают в силу после сохранения. Текущая сессия останется активной.
        </p>
      </div>

      {/* Автоматические лимиты */}
      <div className="glass-card p-5 space-y-3">
        <SectionTitle icon={Zap} title="Автоматические лимиты" />
        <button
          onClick={() => update({ autoLimitEnabled: !settings.autoLimitEnabled })}
          className="w-full flex items-center justify-between"
        >
          <div className="text-left">
            <p className="text-sm text-white/60">Авто-отключение при превышении</p>
            <p className="text-[10px] text-white/30 mt-0.5">Отключать клиентов при превышении лимита трафика или срока</p>
          </div>
          {settings.autoLimitEnabled ? (
            <ToggleRight size={32} className="text-violet-400 flex-shrink-0" />
          ) : (
            <ToggleLeft size={32} className="text-white/20 flex-shrink-0" />
          )}
        </button>
        {settings.autoLimitEnabled && (
          <div className="space-y-1.5 pt-2 border-t border-white/5">
            <Row label="Проверка" value="каждые 10 сек" />
            <Row label="Лимит трафика" value={settings.defaultTotalLimit > 0 ? `${settings.defaultTotalLimit} ГБ` : 'без лимита'} />
            <Row label="Срок действия" value={`${settings.defaultExpiryDays} дн.`} />
          </div>
        )}
      </div>

      {/* Резервное копирование */}
      <div className="glass-card p-5 space-y-3">
        <SectionTitle icon={Download} title="Резервное копирование" />
        <p className="text-[10px] text-white/30 leading-relaxed">
          Экспортируйте все данные панели (ноды, клиенты, настройки, статистика) в файл JSON. Используйте для резервного копирования или переноса на другой сервер.
        </p>
        <button
          onClick={handleBackup}
          disabled={backupBusy}
          className="w-full py-2.5 rounded-2xl bg-violet-500/15 text-violet-400 text-xs font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {backupBusy ? <RotateCcw size={14} className="animate-spin" /> : <Download size={14} />}
          Скачать резервную копию
        </button>
        {showRestore ? (
          <div className="space-y-2 pt-2 border-t border-white/5">
            <div className="flex items-start gap-1.5 text-[10px] text-amber-400/80">
              <AlertTriangle size={10} className="mt-0.5 flex-shrink-0" />
              <span>Восстановление заменит все текущие данные панели. Рекомендуется сделать резервную копию перед восстановлением.</span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleRestore(f);
                e.target.value = '';
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={backupBusy}
              className="w-full py-2.5 rounded-2xl bg-amber-500/15 text-amber-400 text-xs font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Upload size={14} />
              Выбрать файл для восстановления
            </button>
            <button
              onClick={() => setShowRestore(false)}
              className="w-full text-[10px] text-white/30 hover:text-white/50 py-1"
            >
              Отмена
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowRestore(true)}
            className="w-full py-2.5 rounded-2xl bg-white/5 text-white/50 text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-white/10"
          >
            <Upload size={14} />
            Восстановить из файла
          </button>
        )}
      </div>

      {/* Кнопка сохранения */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="btn-primary w-full py-3.5 text-sm flex items-center justify-center gap-2"
      >
        {saved ? <Check size={16} /> : saving ? <RotateCcw size={16} className="animate-spin" /> : <Save size={16} />}
        {saved ? 'Сохранено!' : saving ? 'Сохранение...' : 'Сохранить настройки'}
      </button>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: typeof Cpu; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={16} className="text-violet-400" />
      <h2 className="text-sm font-semibold text-white/60 font-display">{title}</h2>
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
