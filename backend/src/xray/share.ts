/**
 * Generate share URLs for all supported Xray protocols.
 * Based on standard sharing formats used by popular clients.
 */

export function generateShareUrl(params: {
  protocol: string;
  uuid: string;
  host: string;
  port: number;
  network: string;
  security: string;
  securitySettings: Record<string, any>;
  transportSettings: Record<string, any>;
  protocolSettings: Record<string, any>;
  name: string;
}): string {
  const { protocol, uuid, host, port, network, security, securitySettings, transportSettings, protocolSettings, name } = params;

  switch (protocol) {
    case 'vless':
      return generateVlessUrl({ uuid, host, port, network, security, securitySettings, transportSettings, protocolSettings, name });
    case 'vmess':
      return generateVmessUrl({ uuid, host, port, network, security, securitySettings, transportSettings, name });
    case 'trojan':
      return generateTrojanUrl({ uuid, host, port, network, security, securitySettings, transportSettings, name });
    case 'shadowsocks':
      return generateShadowsocksUrl({ uuid, host, port, protocolSettings, name });
    case 'socks':
    case 'http':
      return generateSocksUrl({ protocol, uuid, host, port, name });
    default:
      return '';
  }
}

function parseList(v: any): string[] {
  if (Array.isArray(v)) return v;
  if (!v) return [];
  return String(v).split(',').map((s) => s.trim()).filter(Boolean);
}

function generateVlessUrl(p: {
  uuid: string; host: string; port: number; network: string;
  security: string; securitySettings: Record<string, any>;
  transportSettings: Record<string, any>; protocolSettings: Record<string, any>; name: string;
}): string {
  const params: Record<string, string> = {
    type: p.network,
    security: p.security,
  };

  // Flow
  const flow = p.protocolSettings.flow || '';
  if (flow) params.flow = flow;

  // Reality params
  if (p.security === 'reality') {
    const ss = p.securitySettings;
    const sni = parseList(ss.serverNames)[0] || '';
    if (sni) params.sni = sni;
    const shortIds = parseList(ss.shortIds);
    if (shortIds.length) params.sid = shortIds[0];
    if (ss.privateKey) {
      // Derive public key from what we stored — the share URL needs pbk (public key)
      // We store the public key on the server.realityPublicKey field
      params.pbk = ss._publicKey || '';
    }
    params.fp = ss.fingerprint || 'chrome';
  }

  // TLS params
  if (p.security === 'tls') {
    const ss = p.securitySettings;
    if (ss.serverName) params.sni = ss.serverName;
    const alpn = parseList(ss.alpn);
    if (alpn.length) params.alpn = alpn.join(',');
  }

  // Transport params
  if (p.network === 'ws') {
    params.path = p.transportSettings.path || '/';
    if (p.transportSettings.host) params.host = p.transportSettings.host;
  } else if (p.network === 'grpc') {
    params.serviceName = p.transportSettings.serviceName || '';
    if (p.transportSettings.multiMode) params.mode = 'multi';
  } else if (p.network === 'http') {
    params.path = p.transportSettings.path || '/';
    const hosts = parseList(p.transportSettings.host);
    if (hosts.length) params.host = hosts[0];
  } else if (p.network === 'kcp') {
    if (p.transportSettings.headerType && p.transportSettings.headerType !== 'none') {
      params.headerType = p.transportSettings.headerType;
    }
  } else if (p.network === 'quic') {
    if (p.transportSettings.security && p.transportSettings.security !== 'none') {
      params.quicSecurity = p.transportSettings.security;
    }
    if (p.transportSettings.key) params.key = p.transportSettings.key;
    if (p.transportSettings.headerType && p.transportSettings.headerType !== 'none') {
      params.headerType = p.transportSettings.headerType;
    }
  }

  const qs = new URLSearchParams(params).toString();
  return `vless://${p.uuid}@${p.host}:${p.port}?${qs}#${encodeURIComponent(p.name)}`;
}

function generateVmessUrl(p: {
  uuid: string; host: string; port: number; network: string;
  security: string; securitySettings: Record<string, any>;
  transportSettings: Record<string, any>; name: string;
}): string {
  const obj: Record<string, any> = {
    v: '2',
    ps: p.name,
    add: p.host,
    port: String(p.port),
    id: p.uuid,
    aid: '0',
    scy: 'auto',
    net: p.network,
    type: 'none',
    tls: p.security === 'tls' ? 'tls' : p.security === 'reality' ? 'reality' : '',
  };

  if (p.security === 'tls') {
    if (p.securitySettings.serverName) obj.sni = p.securitySettings.serverName;
    const alpn = parseList(p.securitySettings.alpn);
    if (alpn.length) obj.alpn = alpn.join(',');
  }

  if (p.network === 'ws') {
    obj.path = p.transportSettings.path || '/';
    if (p.transportSettings.host) obj.host = p.transportSettings.host;
  } else if (p.network === 'grpc') {
    obj.path = p.transportSettings.serviceName || '';
    if (p.transportSettings.multiMode) obj.mode = 'multi';
  } else if (p.network === 'http') {
    obj.path = p.transportSettings.path || '/';
    const hosts = parseList(p.transportSettings.host);
    if (hosts.length) obj.host = hosts[0];
  } else if (p.network === 'kcp') {
    obj.type = p.transportSettings.headerType || 'none';
  } else if (p.network === 'quic') {
    obj.type = p.transportSettings.headerType || 'none';
    if (p.transportSettings.security) obj.quicSecurity = p.transportSettings.security;
    if (p.transportSettings.key) obj.key = p.transportSettings.key;
  }

  return `vmess://${Buffer.from(JSON.stringify(obj)).toString('base64')}`;
}

function generateTrojanUrl(p: {
  uuid: string; host: string; port: number; network: string;
  security: string; securitySettings: Record<string, any>;
  transportSettings: Record<string, any>; name: string;
}): string {
  const params: Record<string, string> = {
    type: p.network,
    security: p.security,
  };

  if (p.security === 'tls') {
    if (p.securitySettings.serverName) params.sni = p.securitySettings.serverName;
    const alpn = parseList(p.securitySettings.alpn);
    if (alpn.length) params.alpn = alpn.join(',');
  } else if (p.security === 'reality') {
    const ss = p.securitySettings;
    const sni = parseList(ss.serverNames)[0] || '';
    if (sni) params.sni = sni;
    const shortIds = parseList(ss.shortIds);
    if (shortIds.length) params.sid = shortIds[0];
    params.fp = ss.fingerprint || 'chrome';
  }

  if (p.network === 'ws') {
    params.path = p.transportSettings.path || '/';
    if (p.transportSettings.host) params.host = p.transportSettings.host;
  } else if (p.network === 'grpc') {
    params.serviceName = p.transportSettings.serviceName || '';
    if (p.transportSettings.multiMode) params.mode = 'multi';
  } else if (p.network === 'http') {
    params.path = p.transportSettings.path || '/';
  }

  const qs = new URLSearchParams(params).toString();
  return `trojan://${p.uuid}@${p.host}:${p.port}?${qs}#${encodeURIComponent(p.name)}`;
}

function generateShadowsocksUrl(p: {
  uuid: string; host: string; port: number;
  protocolSettings: Record<string, any>; name: string;
}): string {
  const method = p.protocolSettings.method || 'aes-256-gcm';
  const password = p.protocolSettings.password || p.uuid;
  const userinfo = Buffer.from(`${method}:${password}`).toString('base64');
  return `ss://${userinfo}@${p.host}:${p.port}#${encodeURIComponent(p.name)}`;
}

function generateSocksUrl(p: {
  protocol: string; uuid: string; host: string; port: number; name: string;
}): string {
  return `${p.protocol}://${p.uuid}@${p.host}:${p.port}#${encodeURIComponent(p.name)}`;
}
