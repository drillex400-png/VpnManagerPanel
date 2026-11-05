// Comprehensive Xray-core protocol catalog — single source of truth for the UI.
// Based on https://xtls.github.io/en/config/ documentation.

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

// ── Protocols ──────────────────────────────────────────────────────────

export const PROTOCOLS: ProtocolDef[] = [
  {
    type: 'vless',
    label: 'VLESS',
    description: 'Stateless lightweight protocol. Supports XTLS Vision flow and Reality.',
    color: '#8B5CF6',
    supportedNetworks: ['tcp', 'kcp', 'ws', 'http', 'grpc', 'quic'],
    supportedSecurity: ['none', 'tls', 'reality'],
    hasClients: true,
    fields: [
      {
        key: 'flow',
        label: 'Default Flow',
        type: 'select',
        default: 'xtls-rprx-vision',
        options: [
          { value: '', label: 'none (standard TLS)' },
          { value: 'xtls-rprx-vision', label: 'xtls-rprx-vision (XTLS)' },
        ],
        description: 'Flow control. Vision requires TCP + TLS/Reality.',
      },
    ],
  },
  {
    type: 'vmess',
    label: 'VMess',
    description: 'Encrypted transport protocol with AEAD. Depends on system time sync.',
    color: '#06B6D4',
    supportedNetworks: ['tcp', 'kcp', 'ws', 'http', 'grpc', 'quic'],
    supportedSecurity: ['none', 'tls', 'reality'],
    hasClients: true,
    fields: [],
  },
  {
    type: 'trojan',
    label: 'Trojan',
    description: 'TLS-based protocol with password authentication. Mimics HTTPS traffic.',
    color: '#F59E0B',
    supportedNetworks: ['tcp', 'kcp', 'ws', 'http', 'grpc', 'quic'],
    supportedSecurity: ['none', 'tls', 'reality'],
    hasClients: true,
    fields: [],
  },
  {
    type: 'shadowsocks',
    label: 'Shadowsocks',
    description: 'Lightweight encrypted proxy with various ciphers.',
    color: '#10B981',
    supportedNetworks: ['tcp', 'kcp', 'ws', 'http', 'grpc', 'quic'],
    supportedSecurity: ['none', 'tls'],
    hasClients: true,
    fields: [
      {
        key: 'method',
        label: 'Encryption Method',
        type: 'select',
        default: 'aes-256-gcm',
        options: [
          { value: 'aes-256-gcm', label: 'aes-256-gcm' },
          { value: 'aes-128-gcm', label: 'aes-128-gcm' },
          { value: 'chacha20-ietf-poly1305', label: 'chacha20-ietf-poly1305' },
          { value: '2022-blake3-aes-128-gcm', label: '2022-blake3-aes-128-gcm' },
          { value: '2022-blake3-aes-256-gcm', label: '2022-blake3-aes-256-gcm' },
          { value: '2022-blake3-chacha20-poly1305', label: '2022-blake3-chacha20-poly1305' },
          { value: 'none', label: 'none (no encryption)' },
        ],
      },
      {
        key: 'password',
        label: 'Password',
        type: 'text',
        default: '',
        placeholder: 'Leave empty to auto-generate',
      },
    ],
  },
  {
    type: 'socks',
    label: 'SOCKS',
    description: 'SOCKS5 proxy protocol with optional authentication.',
    color: '#EF4444',
    supportedNetworks: ['tcp', 'ws', 'http'],
    supportedSecurity: ['none', 'tls'],
    hasClients: true,
    fields: [
      {
        key: 'auth',
        label: 'Authentication',
        type: 'select',
        default: 'noauth',
        options: [
          { value: 'noauth', label: 'No Authentication' },
          { value: 'password', label: 'Password (use client email/uuid)' },
        ],
      },
      {
        key: 'udp',
        label: 'UDP Support',
        type: 'boolean',
        default: true,
      },
      {
        key: 'ip',
        label: 'IP (for UDP)',
        type: 'text',
        default: '',
        placeholder: 'e.g. 127.0.0.1',
        showIf: { field: 'udp', value: true },
      },
    ],
  },
  {
    type: 'http',
    label: 'HTTP',
    description: 'HTTP/HTTPS proxy protocol with basic authentication.',
    color: '#EC4899',
    supportedNetworks: ['tcp'],
    supportedSecurity: ['none', 'tls'],
    hasClients: true,
    fields: [
      {
        key: 'transparent',
        label: 'Transparent Proxy',
        type: 'boolean',
        default: false,
      },
    ],
  },
  {
    type: 'dokodemo-door',
    label: 'Dokodemo-door',
    description: 'Any-door: forwards traffic to a specified address/port.',
    color: '#6366F1',
    supportedNetworks: ['tcp'],
    supportedSecurity: ['none', 'tls'],
    hasClients: false,
    fields: [
      {
        key: 'address',
        label: 'Target Address',
        type: 'text',
        default: '',
        placeholder: 'e.g. 127.0.0.1',
      },
      {
        key: 'targetPort',
        label: 'Target Port',
        type: 'number',
        default: 80,
      },
      {
        key: 'followRedirect',
        label: 'Follow Redirect',
        type: 'boolean',
        default: false,
      },
      {
        key: 'networkMode',
        label: 'Network Mode',
        type: 'select',
        default: 'tcp,udp',
        options: [
          { value: 'tcp', label: 'TCP only' },
          { value: 'udp', label: 'UDP only' },
          { value: 'tcp,udp', label: 'TCP + UDP' },
        ],
      },
    ],
  },
];

// ── Networks / Transports ──────────────────────────────────────────────

export const NETWORKS: NetworkDef[] = [
  {
    type: 'tcp',
    label: 'TCP (RAW)',
    description: 'Raw TCP transport, optionally with HTTP header obfuscation.',
    fields: [
      {
        key: 'headerType',
        label: 'Header Type',
        type: 'select',
        default: 'none',
        options: [
          { value: 'none', label: 'None (raw TCP)' },
          { value: 'http', label: 'HTTP Camouflage' },
        ],
      },
      {
        key: 'requestPath',
        label: 'Request Path',
        type: 'text',
        default: '/',
        showIf: { field: 'headerType', value: 'http' },
      },
      {
        key: 'requestHost',
        label: 'Request Host(s)',
        type: 'list',
        default: '',
        placeholder: 'comma-separated hosts',
        showIf: { field: 'headerType', value: 'http' },
      },
    ],
  },
  {
    type: 'kcp',
    label: 'mKCP (KCP)',
    description: 'UDP-based reliable transport with obfuscation headers.',
    fields: [
      {
        key: 'headerType',
        label: 'Header Type (Obfuscation)',
        type: 'select',
        default: 'none',
        options: [
          { value: 'none', label: 'None' },
          { value: 'srtp', label: 'SRTP (Video Call)' },
          { value: 'utp', label: 'uTP (BitTorrent)' },
          { value: 'wechat-video', label: 'WeChat Video' },
          { value: 'dtls', label: 'DTLS' },
          { value: 'wireguard', label: 'WireGuard' },
        ],
      },
      { key: 'mtu', label: 'MTU', type: 'number', default: 1350 },
      { key: 'tti', label: 'TTI (ms)', type: 'number', default: 20 },
      { key: 'uplinkCapacity', label: 'Uplink Capacity (MB/s)', type: 'number', default: 5 },
      { key: 'downlinkCapacity', label: 'Downlink Capacity (MB/s)', type: 'number', default: 20 },
      { key: 'congestion', label: 'Congestion Control', type: 'boolean', default: false },
      { key: 'readBufferSize', label: 'Read Buffer (MB)', type: 'number', default: 2 },
      { key: 'writeBufferSize', label: 'Write Buffer (MB)', type: 'number', default: 2 },
    ],
  },
  {
    type: 'ws',
    label: 'WebSocket',
    description: 'WebSocket transport, works behind CDN and reverse proxies.',
    fields: [
      { key: 'path', label: 'Path', type: 'text', default: '/', placeholder: '/' },
      { key: 'host', label: 'Host', type: 'text', default: '', placeholder: 'domain.com' },
    ],
  },
  {
    type: 'http',
    label: 'HTTP/2',
    description: 'HTTP/2 transport with TLS. Supports multiplexing.',
    fields: [
      { key: 'path', label: 'Path', type: 'text', default: '/', placeholder: '/' },
      { key: 'host', label: 'Host (domains)', type: 'list', default: '', placeholder: 'comma-separated domains' },
      { key: 'readBufferSize', label: 'Read Buffer (MB)', type: 'number', default: 0, description: '0 = default' },
      { key: 'writeBufferSize', label: 'Write Buffer (MB)', type: 'number', default: 0, description: '0 = default' },
    ],
  },
  {
    type: 'grpc',
    label: 'gRPC',
    description: 'gRPC transport. Supports multiplexing and streaming.',
    fields: [
      { key: 'serviceName', label: 'Service Name', type: 'text', default: '', placeholder: 'e.g. GunService' },
      { key: 'multiMode', label: 'Multi-Mode', type: 'boolean', default: false, description: 'Enables gRPC over h2 (experimental)' },
    ],
  },
  {
    type: 'quic',
    label: 'QUIC',
    description: 'UDP-based transport with built-in encryption.',
    fields: [
      {
        key: 'security',
        label: 'Security',
        type: 'select',
        default: 'none',
        options: [
          { value: 'none', label: 'None' },
          { value: 'aes-128-gcm', label: 'AES-128-GCM' },
          { value: 'chacha20-poly1305', label: 'ChaCha20-Poly1305' },
        ],
      },
      {
        key: 'key',
        label: 'Key',
        type: 'text',
        default: '',
        placeholder: 'Encryption key',
        showIf: { field: 'security', value: 'aes-128-gcm' },
      },
      {
        key: 'headerType',
        label: 'Header Type (Obfuscation)',
        type: 'select',
        default: 'none',
        options: [
          { value: 'none', label: 'None' },
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

// ── Security ───────────────────────────────────────────────────────────

export const SECURITY: SecurityDef[] = [
  {
    type: 'none',
    label: 'None',
    description: 'No transport-layer encryption.',
    fields: [],
  },
  {
    type: 'tls',
    label: 'TLS',
    description: 'Standard TLS encryption. Requires certificate.',
    fields: [
      { key: 'serverName', label: 'Server Name (SNI)', type: 'text', default: '', placeholder: 'domain.com' },
      {
        key: 'alpn',
        label: 'ALPN',
        type: 'list',
        default: 'h2,http/1.1',
        placeholder: 'comma-separated (h2, http/1.1)',
      },
      { key: 'allowInsecure', label: 'Allow Insecure', type: 'boolean', default: false },
      { key: 'rejectUnknownSNI', label: 'Reject Unknown SNI', type: 'boolean', default: false },
      {
        key: 'minVersion',
        label: 'Min TLS Version',
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
        label: 'Max TLS Version',
        type: 'select',
        default: '1.3',
        options: [
          { value: '1.0', label: 'TLS 1.0' },
          { value: '1.1', label: 'TLS 1.1' },
          { value: '1.2', label: 'TLS 1.2' },
          { value: '1.3', label: 'TLS 1.3' },
        ],
      },
      { key: 'certificateFile', label: 'Certificate File Path', type: 'text', default: '', placeholder: '/path/to/fullchain.pem' },
      { key: 'keyFile', label: 'Key File Path', type: 'text', default: '', placeholder: '/path/to/privkey.pem' },
      { key: 'certificateText', label: 'Certificate (inline)', type: 'list', default: '', placeholder: 'paste PEM content', description: 'Use file paths OR inline certificate' },
    ],
  },
  {
    type: 'reality',
    label: 'Reality',
    description: 'XTLS Reality: steals handshake from a real TLS site. No certificate needed.',
    fields: [
      { key: 'dest', label: 'Dest (camouflage target)', type: 'text', default: 'www.microsoft.com:443' },
      { key: 'serverNames', label: 'Server Names (SNI)', type: 'list', default: 'www.microsoft.com', placeholder: 'comma-separated SNI hosts' },
      { key: 'privateKey', label: 'Private Key', type: 'text', default: '', description: 'Auto-generated if empty' },
      { key: 'shortIds', label: 'Short IDs', type: 'list', default: '', placeholder: 'comma-separated hex IDs (auto-generated if empty)' },
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
          { value: 'random', label: 'Random' },
          { value: 'randomized', label: 'Randomized' },
        ],
      },
      { key: 'xver', label: 'Xver (PROXY protocol version)', type: 'number', default: 0 },
      { key: 'show', label: 'Show (debug)', type: 'boolean', default: false },
      { key: 'maxTimeDiff', label: 'Max Time Diff (ms)', type: 'number', default: 0, description: '0 = disabled' },
    ],
  },
];

// ── Lookup helpers ─────────────────────────────────────────────────────

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

// Build default settings object from field definitions
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

// REALITY SNI targets commonly used for camouflage
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
