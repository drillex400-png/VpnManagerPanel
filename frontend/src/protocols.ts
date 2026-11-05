// Каталог протоколов Xray-core — единый источник истины для интерфейса.
// На основе документации https://xtls.github.io/en/config/

export type ProtocolType = 'vless' | 'vmess' | 'trojan' | 'shadowsocks' | 'socks' | 'http' | 'dokodemo-door';
export type NetworkType = 'tcp' | 'kcp' | 'ws' | 'http' | 'grpc' | 'quic';
export type SecurityType = 'none' | 'tls' | 'reality';

export type FieldType = 'text' | 'number' | 'select' | 'boolean' | 'list';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  default: string | number | boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  description?: string;
  showIf?: { field: string; value: string | boolean };
}

export interface ProtocolDef {
  type: ProtocolType;
  label: string;
  description: string;
  color: string;
  supportedNetworks: NetworkType[];
  supportedSecurity: SecurityType[];
  hasClients: boolean;
  fields: FieldDef[];
}

export interface NetworkDef {
  type: NetworkType;
  label: string;
  description: string;
  fields: FieldDef[];
}

export interface SecurityDef {
  type: SecurityType;
  label: string;
  description: string;
  fields: FieldDef[];
}

// ── Протоколы ──────────────────────────────────────────────────────────

export const PROTOCOLS: ProtocolDef[] = [
  {
    type: 'vless',
    label: 'VLESS',
    description: 'Лёгкий протокол без состояния. Поддерживает XTLS Vision и Reality.',
    color: '#8B5CF6',
    supportedNetworks: ['tcp', 'kcp', 'ws', 'http', 'grpc', 'quic'],
    supportedSecurity: ['none', 'tls', 'reality'],
    hasClients: true,
    fields: [
      {
        key: 'flow',
        label: 'Flow по умолчанию',
        type: 'select',
        default: 'xtls-rprx-vision',
        options: [
          { value: '', label: 'нет (стандартный TLS)' },
          { value: 'xtls-rprx-vision', label: 'xtls-rprx-vision (XTLS)' },
        ],
        description: 'Управление потоком. Vision требует TCP + TLS/Reality.',
      },
    ],
  },
  {
    type: 'vmess',
    label: 'VMess',
    description: 'Шифрованный транспортный протокол с AEAD. Зависит от синхронизации времени.',
    color: '#06B6D4',
    supportedNetworks: ['tcp', 'kcp', 'ws', 'http', 'grpc', 'quic'],
    supportedSecurity: ['none', 'tls', 'reality'],
    hasClients: true,
    fields: [],
  },
  {
    type: 'trojan',
    label: 'Trojan',
    description: 'TLS-протокол с парольной аутентификацией. Имитирует HTTPS-трафик.',
    color: '#F59E0B',
    supportedNetworks: ['tcp', 'kcp', 'ws', 'http', 'grpc', 'quic'],
    supportedSecurity: ['none', 'tls', 'reality'],
    hasClients: true,
    fields: [],
  },
  {
    type: 'shadowsocks',
    label: 'Shadowsocks',
    description: 'Лёгкий шифрованный прокси с различными шифрами.',
    color: '#10B981',
    supportedNetworks: ['tcp', 'kcp', 'ws', 'http', 'grpc', 'quic'],
    supportedSecurity: ['none', 'tls'],
    hasClients: true,
    fields: [
      {
        key: 'method',
        label: 'Метод шифрования',
        type: 'select',
        default: 'aes-256-gcm',
        options: [
          { value: 'aes-256-gcm', label: 'aes-256-gcm' },
          { value: 'aes-128-gcm', label: 'aes-128-gcm' },
          { value: 'chacha20-ietf-poly1305', label: 'chacha20-ietf-poly1305' },
          { value: '2022-blake3-aes-128-gcm', label: '2022-blake3-aes-128-gcm' },
          { value: '2022-blake3-aes-256-gcm', label: '2022-blake3-aes-256-gcm' },
          { value: '2022-blake3-chacha20-poly1305', label: '2022-blake3-chacha20-poly1305' },
          { value: 'none', label: 'none (без шифрования)' },
        ],
      },
      {
        key: 'password',
        label: 'Пароль',
        type: 'text',
        default: '',
        placeholder: 'Оставьте пустым для авто-генерации',
      },
    ],
  },
  {
    type: 'socks',
    label: 'SOCKS',
    description: 'SOCKS5-прокси с опциональной аутентификацией.',
    color: '#EF4444',
    supportedNetworks: ['tcp', 'ws', 'http'],
    supportedSecurity: ['none', 'tls'],
    hasClients: true,
    fields: [
      {
        key: 'auth',
        label: 'Аутентификация',
        type: 'select',
        default: 'noauth',
        options: [
          { value: 'noauth', label: 'Без аутентификации' },
          { value: 'password', label: 'Пароль (email/uuid клиента)' },
        ],
      },
      {
        key: 'udp',
        label: 'Поддержка UDP',
        type: 'boolean',
        default: true,
      },
      {
        key: 'ip',
        label: 'IP (для UDP)',
        type: 'text',
        default: '',
        placeholder: 'напр. 127.0.0.1',
        showIf: { field: 'udp', value: true },
      },
    ],
  },
  {
    type: 'http',
    label: 'HTTP',
    description: 'HTTP/HTTPS-прокси с базовой аутентификацией.',
    color: '#EC4899',
    supportedNetworks: ['tcp'],
    supportedSecurity: ['none', 'tls'],
    hasClients: true,
    fields: [
      {
        key: 'transparent',
        label: 'Прозрачный прокси',
        type: 'boolean',
        default: false,
      },
    ],
  },
  {
    type: 'dokodemo-door',
    label: 'Dokodemo-door',
    description: 'Любая-дверь: перенаправляет трафик на указанный адрес/порт.',
    color: '#6366F1',
    supportedNetworks: ['tcp'],
    supportedSecurity: ['none', 'tls'],
    hasClients: false,
    fields: [
      {
        key: 'address',
        label: 'Адрес назначения',
        type: 'text',
        default: '',
        placeholder: 'напр. 127.0.0.1',
      },
      {
        key: 'targetPort',
        label: 'Порт назначения',
        type: 'number',
        default: 80,
      },
      {
        key: 'followRedirect',
        label: 'Следовать перенаправлению',
        type: 'boolean',
        default: false,
      },
      {
        key: 'networkMode',
        label: 'Сетевой режим',
        type: 'select',
        default: 'tcp,udp',
        options: [
          { value: 'tcp', label: 'Только TCP' },
          { value: 'udp', label: 'Только UDP' },
          { value: 'tcp,udp', label: 'TCP + UDP' },
        ],
      },
    ],
  },
];

// ── Транспорты ─────────────────────────────────────────────────────────

export const NETWORKS: NetworkDef[] = [
  {
    type: 'tcp',
    label: 'TCP (RAW)',
    description: 'Сырой TCP, опционально с маскировкой HTTP-заголовков.',
    fields: [
      {
        key: 'headerType',
        label: 'Тип заголовка',
        type: 'select',
        default: 'none',
        options: [
          { value: 'none', label: 'Нет (сырой TCP)' },
          { value: 'http', label: 'Маскировка HTTP' },
        ],
      },
      {
        key: 'requestPath',
        label: 'Путь запроса',
        type: 'text',
        default: '/',
        showIf: { field: 'headerType', value: 'http' },
      },
      {
        key: 'requestHost',
        label: 'Host запроса',
        type: 'list',
        default: '',
        placeholder: 'хосты через запятую',
        showIf: { field: 'headerType', value: 'http' },
      },
    ],
  },
  {
    type: 'kcp',
    label: 'mKCP (KCP)',
    description: 'UDP-транспорт с маскировкой заголовков.',
    fields: [
      {
        key: 'headerType',
        label: 'Тип заголовка (маскировка)',
        type: 'select',
        default: 'none',
        options: [
          { value: 'none', label: 'Нет' },
          { value: 'srtp', label: 'SRTP (видеозвонок)' },
          { value: 'utp', label: 'uTP (BitTorrent)' },
          { value: 'wechat-video', label: 'WeChat Video' },
          { value: 'dtls', label: 'DTLS' },
          { value: 'wireguard', label: 'WireGuard' },
        ],
      },
      { key: 'mtu', label: 'MTU', type: 'number', default: 1350 },
      { key: 'tti', label: 'TTI (мс)', type: 'number', default: 20 },
      { key: 'uplinkCapacity', label: 'Скорость отдачи (МБ/с)', type: 'number', default: 5 },
      { key: 'downlinkCapacity', label: 'Скорость загрузки (МБ/с)', type: 'number', default: 20 },
      { key: 'congestion', label: 'Контроль перегрузки', type: 'boolean', default: false },
      { key: 'readBufferSize', label: 'Буфер чтения (МБ)', type: 'number', default: 2 },
      { key: 'writeBufferSize', label: 'Буфер записи (МБ)', type: 'number', default: 2 },
    ],
  },
  {
    type: 'ws',
    label: 'WebSocket',
    description: 'Транспорт WebSocket, работает за CDN и обратными прокси.',
    fields: [
      { key: 'path', label: 'Путь', type: 'text', default: '/', placeholder: '/' },
      { key: 'host', label: 'Host', type: 'text', default: '', placeholder: 'domain.com' },
    ],
  },
  {
    type: 'http',
    label: 'HTTP/2',
    description: 'Транспорт HTTP/2 с TLS. Поддерживает мультиплексирование.',
    fields: [
      { key: 'path', label: 'Путь', type: 'text', default: '/', placeholder: '/' },
      { key: 'host', label: 'Host (домены)', type: 'list', default: '', placeholder: 'домены через запятую' },
      { key: 'readBufferSize', label: 'Буфер чтения (МБ)', type: 'number', default: 0, description: '0 = по умолчанию' },
      { key: 'writeBufferSize', label: 'Буфер записи (МБ)', type: 'number', default: 0, description: '0 = по умолчанию' },
    ],
  },
  {
    type: 'grpc',
    label: 'gRPC',
    description: 'Транспорт gRPC. Поддерживает мультиплексирование и стриминг.',
    fields: [
      { key: 'serviceName', label: 'Имя сервиса', type: 'text', default: '', placeholder: 'напр. GunService' },
      { key: 'multiMode', label: 'Multi-Mode', type: 'boolean', default: false, description: 'gRPC over h2 (эксперимент)' },
    ],
  },
  {
    type: 'quic',
    label: 'QUIC',
    description: 'UDP-транспорт со встроенным шифрованием.',
    fields: [
      {
        key: 'security',
        label: 'Шифрование',
        type: 'select',
        default: 'none',
        options: [
          { value: 'none', label: 'Нет' },
          { value: 'aes-128-gcm', label: 'AES-128-GCM' },
          { value: 'chacha20-poly1305', label: 'ChaCha20-Poly1305' },
        ],
      },
      {
        key: 'key',
        label: 'Ключ',
        type: 'text',
        default: '',
        placeholder: 'Ключ шифрования',
        showIf: { field: 'security', value: 'aes-128-gcm' },
      },
      {
        key: 'headerType',
        label: 'Тип заголовка (маскировка)',
        type: 'select',
        default: 'none',
        options: [
          { value: 'none', label: 'Нет' },
          { value: 'srtp', label: 'SRTP' },
          { value: 'utp', label: 'uTP' },
          { value: 'wechat-video', label: 'WeChat Video' },
          { value: 'dtls', label: 'DTLS' },
          { value: 'wireguard', label: 'WireGuard' },
        ],
      },
    ],
  },
];

// ── Безопасность ──────────────────────────────────────────────────────

export const SECURITY: SecurityDef[] = [
  {
    type: 'none',
    label: 'Нет',
    description: 'Без шифрования транспортного уровня.',
    fields: [],
  },
  {
    type: 'tls',
    label: 'TLS',
    description: 'Стандартное TLS-шифрование. Требуется сертификат.',
    fields: [
      { key: 'serverName', label: 'Server Name (SNI)', type: 'text', default: '', placeholder: 'domain.com' },
      {
        key: 'alpn',
        label: 'ALPN',
        type: 'list',
        default: 'h2,http/1.1',
        placeholder: 'через запятую (h2, http/1.1)',
      },
      { key: 'allowInsecure', label: 'Разрешить небезопасные', type: 'boolean', default: false },
      { key: 'rejectUnknownSNI', label: 'Отклонять неизвестный SNI', type: 'boolean', default: false },
      {
        key: 'minVersion',
        label: 'Мин. версия TLS',
        type: 'select',
        default: '1.2',
        options: [
          { value: '1.0', label: 'TLS 1.0' },
          { value: '1.1', label: 'TLS 1.1' },
          { value: '1.2', label: 'TLS 1.2' },
          { value: '1.3', label: 'TLS 1.3' },
        ],
      },
      {
        key: 'maxVersion',
        label: 'Макс. версия TLS',
        type: 'select',
        default: '1.3',
        options: [
          { value: '1.0', label: 'TLS 1.0' },
          { value: '1.1', label: 'TLS 1.1' },
          { value: '1.2', label: 'TLS 1.2' },
          { value: '1.3', label: 'TLS 1.3' },
        ],
      },
      { key: 'certificateFile', label: 'Файл сертификата', type: 'text', default: '', placeholder: '/path/to/fullchain.pem' },
      { key: 'keyFile', label: 'Файл ключа', type: 'text', default: '', placeholder: '/path/to/privkey.pem' },
      { key: 'certificateText', label: 'Сертификат (встроенный)', type: 'list', default: '', placeholder: 'вставьте PEM-содержимое', description: 'Используйте файл ИЛИ встроенный сертификат' },
    ],
  },
  {
    type: 'reality',
    label: 'Reality',
    description: 'XTLS Reality: заимствует рукопожатие реального TLS-сайта. Сертификат не нужен.',
    fields: [
      { key: 'dest', label: 'Dest (цель маскировки)', type: 'text', default: 'www.microsoft.com:443' },
      { key: 'serverNames', label: 'Server Names (SNI)', type: 'list', default: 'www.microsoft.com', placeholder: 'SNI-хосты через запятую' },
      { key: 'privateKey', label: 'Приватный ключ', type: 'text', default: '', description: 'Авто-генерация, если пусто' },
      { key: 'shortIds', label: 'Short IDs', type: 'list', default: '', placeholder: 'hex ID через запятую (авто-генерация, если пусто)' },
      {
        key: 'fingerprint',
        label: 'Fingerprint (uTLS)',
        type: 'select',
        default: 'chrome',
        options: [
          { value: 'chrome', label: 'Chrome' },
          { value: 'firefox', label: 'Firefox' },
          { value: 'safari', label: 'Safari' },
          { value: 'edge', label: 'Edge' },
          { value: 'random', label: 'Случайный' },
          { value: 'randomized', label: 'Рандомизированный' },
        ],
      },
      { key: 'xver', label: 'Xver (версия PROXY protocol)', type: 'number', default: 0 },
      { key: 'show', label: 'Показать (отладка)', type: 'boolean', default: false },
      { key: 'maxTimeDiff', label: 'Макс. разница времени (мс)', type: 'number', default: 0, description: '0 = отключено' },
    ],
  },
];

// ── Помощники поиска ───────────────────────────────────────────────────

export const getProtocol = (t: ProtocolType) => PROTOCOLS.find((p) => p.type === t)!;
export const getNetwork = (t: NetworkType) => NETWORKS.find((n) => n.type === t)!;
export const getSecurity = (t: SecurityType) => SECURITY.find((s) => s.type === t)!;

export const PROTOCOL_META: Record<string, { name: string; color: string }> = {
  vless: { name: 'VLESS', color: '#8B5CF6' },
  vmess: { name: 'VMess', color: '#06B6D4' },
  trojan: { name: 'Trojan', color: '#F59E0B' },
  shadowsocks: { name: 'Shadowsocks', color: '#10B981' },
  socks: { name: 'SOCKS', color: '#EF4444' },
  http: { name: 'HTTP', color: '#EC4899' },
  'dokodemo-door': { name: 'Dokodemo-door', color: '#6366F1' },
};

// Построить объект настроек по умолчанию из определений полей
export function buildDefaults(fields: FieldDef[]): Record<string, any> {
  const result: Record<string, any> = {};
  for (const f of fields) {
    result[f.key] = f.default;
  }
  return result;
}

export function buildInboundDefaults(protocol: ProtocolType): {
  protocolSettings: Record<string, any>;
  transportSettings: Record<string, any>;
  securitySettings: Record<string, any>;
} {
  const p = getProtocol(protocol);
  const n = getNetwork(p.supportedNetworks[0]);
  const s = getSecurity(p.supportedSecurity[0]);
  return {
    protocolSettings: buildDefaults(p.fields),
    transportSettings: buildDefaults(n.fields),
    securitySettings: buildDefaults(s.fields),
  };
}

// SNI-цели Reality, обычно используемые для маскировки
export const REALITY_TARGETS = [
  { dest: 'www.microsoft.com:443', sni: 'www.microsoft.com' },
  { dest: 'www.apple.com:443', sni: 'www.apple.com' },
  { dest: 'www.cloudflare.com:443', sni: 'www.cloudflare.com' },
  { dest: 'www.amazon.com:443', sni: 'www.amazon.com' },
  { dest: 'www.google.com:443', sni: 'www.google.com' },
  { dest: 'www.yahoo.com:443', sni: 'www.yahoo.com' },
  { dest: 'www.tesla.com:443', sni: 'www.tesla.com' },
  { dest: 'www.lovelive.us:443', sni: 'www.lovelive.us' },
];
