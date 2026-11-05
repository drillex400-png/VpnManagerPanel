import { buildInboundXray, type InboundData, type ClientData } from './protocols';
import type { ServerData } from '../store';

/**
 * Generate a real Xray-core JSON config from a server's inbounds.
 * Supports all protocols (VLESS, VMess, Trojan, Shadowsocks, SOCKS, HTTP, Dokodemo-door),
 * all transports (TCP, mKCP, WebSocket, HTTP/2, gRPC, QUIC), and all security types
 * (none, TLS, Reality).
 */
export function generateXrayConfig(server: ServerData, clients: ClientData[]): object {
  const inbounds = server.inbounds || [];

  const userInbounds = inbounds.map((inbound: InboundData) =>
    buildInboundXray(inbound, clients),
  );

  // Always include the API inbound for stats
  const apiInbound = {
    tag: 'api',
    listen: '127.0.0.1',
    port: server.apiPort,
    protocol: 'dokodemo-door',
    settings: {
      address: '127.0.0.1',
    },
  };

  // Collect all inbound tags for routing
  const inboundTags = inbounds.map((i) => i.tag);

  const routingRules: any[] = [
    {
      type: 'field',
      inboundTag: ['api'],
      outboundTag: 'api',
    },
  ];

  // Block bittorrent for all user inbounds
  if (inboundTags.length > 0) {
    routingRules.push({
      type: 'field',
      inboundTag: [...inboundTags],
      protocol: ['bittorrent'],
      outboundTag: 'block',
    });
  }

  return {
    log: {
      loglevel: 'warning',
    },
    api: {
      tag: 'api',
      services: ['HandlerService', 'LoggerService', 'StatsService'],
    },
    stats: {},
    policy: {
      levels: {
        '0': {
          statsUserUplink: true,
          statsUserDownlink: true,
        },
      },
    },
    inbounds: [apiInbound, ...userInbounds],
    outbounds: [
      {
        tag: 'direct',
        protocol: 'freedom',
      },
      {
        tag: 'block',
        protocol: 'blackhole',
      },
    ],
    routing: {
      rules: routingRules,
    },
  };
}
