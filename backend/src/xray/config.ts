import type { ServerData, ClientData } from '../store';

/**
 * Generate a real Xray-core JSON config for VLESS+Reality.
 * Includes the API inbound for stats, the VLESS+Reality inbound for clients,
 * and routing rules.
 */
export function generateXrayConfig(server: ServerData, clients: ClientData[]): object {
  const activeClients = clients.filter(
    (c) => c.serverId === server.id && c.status === 'active',
  );

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
    inbounds: [
      {
        tag: 'api',
        listen: '127.0.0.1',
        port: server.apiPort,
        protocol: 'dokodemo-door',
        settings: {
          address: '127.0.0.1',
        },
      },
      {
        tag: 'vless-reality',
        listen: '0.0.0.0',
        port: server.port,
        protocol: 'vless',
        settings: {
          clients: activeClients.map((c) => ({
            id: c.uuid,
            flow: c.flow,
            email: c.email,
          })),
          decryption: 'none',
        },
        streamSettings: {
          network: 'tcp',
          security: 'reality',
          realitySettings: {
            show: false,
            dest: server.realityDest,
            xver: 0,
            serverNames: [server.realitySNI],
            privateKey: server.realityPrivateKey,
            shortIds: server.realityShortIds,
          },
        },
        sniffing: {
          enabled: true,
          destOverride: ['http', 'tls'],
        },
      },
    ],
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
      rules: [
        {
          type: 'field',
          inboundTag: ['api'],
          outboundTag: 'api',
        },
        {
          type: 'field',
          protocol: ['bittorrent'],
          outboundTag: 'block',
        },
      ],
    },
  };
}
