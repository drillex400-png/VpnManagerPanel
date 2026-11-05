// Backend protocol types, defaults, and Xray config generation for all protocols.
// Mirrors frontend/src/protocols.ts for the settings the backend needs.

export type ProtocolType = 'vless' | 'vmess' | 'trojan' | 'shadowsocks' | 'socks' | 'http' | 'dokodemo-door';
export type NetworkType = 'tcp' | 'kcp' | 'ws' | 'http' | 'grpc' | 'quic';
export type SecurityType = 'none' | 'tls' | 'reality';

export interface InboundData {
  id: number;
  serverId: number;
  tag: string;
  protocol: ProtocolType;
  listen: string;
  port: number;
  network: NetworkType;
  security: SecurityType;
  protocolSettings: Record<string, any>;
  transportSettings: Record<string, any>;
  securitySettings: Record<string, any>;
  sniffing: { enabled: boolean; destOverride: string[] };
  createdAt: string;
}

export interface ClientData {
  id: number;
  name: string;
  email: string;
  uuid: string;
  serverId: number;
  status: 'active' | 'disabled' | 'expired' | 'limited';
  flow: string;
}

// ── Defaults ───────────────────────────────────────────────────────────

export const PROTOCOL_DEFAULTS: Record<ProtocolType, {
  network: NetworkType;
  security: SecurityType;
  protocolSettings: Record<string, any>;
}> = {
  vless: {
    network: 'tcp',
    security: 'reality',
    protocolSettings: { flow: 'xtls-rprx-vision' },
  },
  vmess: {
    network: 'tcp',
    security: 'tls',
    protocolSettings: {},
  },
  trojan: {
    network: 'tcp',
    security: 'tls',
    protocolSettings: {},
  },
  shadowsocks: {
    network: 'tcp',
    security: 'none',
    protocolSettings: { method: 'aes-256-gcm', password: '' },
  },
  socks: {
    network: 'tcp',
    security: 'none',
    protocolSettings: { auth: 'noauth', udp: true },
  },
  http: {
    network: 'tcp',
    security: 'none',
    protocolSettings: { transparent: false },
  },
  'dokodemo-door': {
    network: 'tcp',
    security: 'none',
    protocolSettings: { address: '', targetPort: 80, followRedirect: false, networkMode: 'tcp,udp' },
  },
};

export function defaultTransportSettings(network: NetworkType): Record<string, any> {
  switch (network) {
    case 'tcp': return { headerType: 'none' };
    case 'kcp': return { headerType: 'none', mtu: 1350, tti: 20, uplinkCapacity: 5, downlinkCapacity: 20, congestion: false, readBufferSize: 2, writeBufferSize: 2 };
    case 'ws': return { path: '/', host: '' };
    case 'http': return { path: '/', host: '' };
    case 'grpc': return { serviceName: '', multiMode: false };
    case 'quic': return { security: 'none', key: '', headerType: 'none' };
  }
}

export function defaultSecuritySettings(security: SecurityType): Record<string, any> {
  switch (security) {
    case 'none': return {};
    case 'tls': return { serverName: '', alpn: 'h2,http/1.1', allowInsecure: false, rejectUnknownSNI: false, minVersion: '1.2', maxVersion: '1.3', certificateFile: '', keyFile: '' };
    case 'reality': return { dest: 'www.microsoft.com:443', serverNames: 'www.microsoft.com', privateKey: '', shortIds: '', fingerprint: 'chrome', xver: 0, show: false, maxTimeDiff: 0 };
  }
}

// ── Password generation ────────────────────────────────────────────────

export function generatePassword(length = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

// ── Helpers ───────────────────────────────────────────────────────────

function parseList(value: string | string[]): string[] {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

function activeClients(clients: ClientData[]): ClientData[] {
  return clients.filter((c) => c.status === 'active');
}

// ── Protocol settings ─────────────────────────────────────────────────

function buildProtocolSettings(inbound: InboundData, clients: ClientData[]): Record<string, any> {
  const ps = inbound.protocolSettings || {};
  const active = activeClients(clients);

  switch (inbound.protocol) {
    case 'vless':
      return {
        clients: active.map((c) => ({
          id: c.uuid,
          flow: c.flow || ps.flow || '',
          email: c.email,
        })),
        decryption: 'none',
      };

    case 'vmess':
      return {
        clients: active.map((c) => ({
          id: c.uuid,
          level: 0,
          email: c.email,
        })),
      };

    case 'trojan':
      return {
        clients: active.map((c) => ({
          password: c.uuid,
          level: 0,
          email: c.email,
        })),
      };

    case 'shadowsocks':
      return {
        method: ps.method || 'aes-256-gcm',
        password: ps.password || generatePassword(),
        network: 'tcp,udp',
      };

    case 'socks':
      return {
        auth: ps.auth || 'noauth',
        udp: ps.udp !== false,
        ...(ps.auth === 'password' ? {
          accounts: active.map((c) => ({
            user: c.email,
            pass: c.uuid,
          })),
        } : {}),
        ...(ps.ip ? { ip: ps.ip } : {}),
      };

    case 'http':
      return {
        accounts: active.map((c) => ({
          user: c.email,
          pass: c.uuid,
        })),
        transparent: ps.transparent || false,
        userLevel: 0,
      };

    case 'dokodemo-door':
      return {
        address: ps.address || '127.0.0.1',
        port: Number(ps.targetPort) || 80,
        followRedirect: ps.followRedirect || false,
        network: ps.networkMode || 'tcp,udp',
      };
  }
}

// ── Transport / stream settings ───────────────────────────────────────

function buildStreamSettings(inbound: InboundData): Record<string, any> {
  const ts = inbound.transportSettings || {};
  const ss = inbound.securitySettings || {};
  const network = inbound.network;

  const stream: Record<string, any> = {
    network,
    security: inbound.security,
  };

  // Transport-specific settings
  switch (network) {
    case 'tcp': {
      const headerType = ts.headerType || 'none';
      if (headerType === 'http') {
        stream.tcpSettings = {
          header: {
            type: 'http',
            request: {
              version: '1.1',
              method: 'GET',
              path: [ts.requestPath || '/'],
              headers: {
                Host: parseList(ts.requestHost),
              },
            },
          },
        };
      } else {
        stream.tcpSettings = { header: { type: 'none' } };
      }
      break;
    }
    case 'kcp':
      stream.kcpSettings = {
        mtu: Number(ts.mtu) || 1350,
        tti: Number(ts.tti) || 20,
        uplinkCapacity: Number(ts.uplinkCapacity) || 5,
        downlinkCapacity: Number(ts.downlinkCapacity) || 20,
        congestion: ts.congestion || false,
        readBufferSize: Number(ts.readBufferSize) || 2,
        writeBufferSize: Number(ts.writeBufferSize) || 2,
        header: { type: ts.headerType || 'none' },
      };
      break;
    case 'ws':
      stream.wsSettings = {
        path: ts.path || '/',
        ...(ts.host ? { headers: { Host: ts.host } } : {}),
      };
      break;
    case 'http':
      stream.httpSettings = {
        path: ts.path || '/',
        host: parseList(ts.host),
        ...(Number(ts.readBufferSize) > 0 ? { readBufferSize: Number(ts.readBufferSize) } : {}),
        ...(Number(ts.writeBufferSize) > 0 ? { writeBufferSize: Number(ts.writeBufferSize) } : {}),
      };
      break;
    case 'grpc':
      stream.grpcSettings = {
        serviceName: ts.serviceName || '',
        multiMode: ts.multiMode || false,
      };
      break;
    case 'quic':
      stream.quicSettings = {
        security: ts.security || 'none',
        key: ts.key || '',
        header: { type: ts.headerType || 'none' },
      };
      break;
  }

  // Security-specific settings
  if (inbound.security === 'tls') {
    const tlsSettings: Record<string, any> = {};
    if (ss.serverName) tlsSettings.serverName = ss.serverName;
    const alpn = parseList(ss.alpn);
    if (alpn.length) tlsSettings.alpn = alpn;
    if (ss.allowInsecure) tlsSettings.allowInsecure = true;
    if (ss.rejectUnknownSNI) tlsSettings.rejectUnknownSNI = true;
    if (ss.minVersion) tlsSettings.minVersion = ss.minVersion;
    if (ss.maxVersion) tlsSettings.maxVersion = ss.maxVersion;

    const certFile = ss.certificateFile as string;
    const keyFile = ss.keyFile as string;
    if (certFile && keyFile) {
      tlsSettings.certificates = [{
        certificateFile: certFile,
        keyFile,
      }];
    }
    const certInline = parseList(ss.certificateText);
    if (certInline.length) {
      tlsSettings.certificates = [{
        certificate: certInline,
        key: ss.keyFile ? [ss.keyFile] : undefined,
      }];
    }

    stream.tlsSettings = tlsSettings;
  } else if (inbound.security === 'reality') {
    stream.realitySettings = {
      show: ss.show || false,
      dest: ss.dest || 'www.microsoft.com:443',
      xver: Number(ss.xver) || 0,
      serverNames: parseList(ss.serverNames),
      privateKey: ss.privateKey,
      shortIds: parseList(ss.shortIds),
      ...(ss.fingerprint ? { fingerprint: ss.fingerprint } : {}),
      ...(Number(ss.maxTimeDiff) > 0 ? { maxTimeDiff: Number(ss.maxTimeDiff) } : {}),
    };
  }

  return stream;
}

// ── Build a single inbound for the Xray config ─────────────────────────

export function buildInboundXray(inbound: InboundData, clients: ClientData[]): Record<string, any> {
  return {
    tag: inbound.tag,
    listen: inbound.listen || '0.0.0.0',
    port: inbound.port,
    protocol: inbound.protocol,
    settings: buildProtocolSettings(inbound, clients),
    streamSettings: buildStreamSettings(inbound),
    sniffing: {
      enabled: inbound.sniffing?.enabled !== false,
      destOverride: inbound.sniffing?.destOverride || ['http', 'tls'],
    },
  };
}
