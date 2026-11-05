import type { DashboardData, Server, Client, TrafficData, Notification, PingData, XrayVersions, Settings, ServerLogs, ServerConfig, Inbound } from './types';

const BASE = '/api';

async function req<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `API ${res.status}` }));
    throw new Error(err.error || `API ${res.status}`);
  }
  return res.json();
}

export const api = {
  dashboard: () => req<DashboardData>('/dashboard'),
  servers: {
    list: () => req<Server[]>('/servers'),
    create: (data: Partial<Server>) => req<Server>('/servers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Server>) => req<Server>(`/servers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => req<{ success: boolean }>(`/servers/${id}`, { method: 'DELETE' }),
    start: (id: number) => req<{ success: boolean; error?: string }>(`/servers/${id}/start`, { method: 'POST' }),
    stop: (id: number) => req<{ success: boolean }>(`/servers/${id}/stop`, { method: 'POST' }),
    restart: (id: number) => req<{ success: boolean; error?: string }>(`/servers/${id}/restart`, { method: 'POST' }),
    regenerateKeys: (id: number) => req<{ success: boolean; server: Server }>(`/servers/${id}/regenerate-keys`, { method: 'POST' }),
    logs: (id: number) => req<ServerLogs>(`/servers/${id}/logs`),
    clearLogs: (id: number) => req<{ success: boolean }>(`/servers/${id}/logs`, { method: 'DELETE' }),
    config: (id: number) => req<ServerConfig>(`/servers/${id}/config`),
    // Inbound CRUD
    listInbounds: (id: number) => req<Inbound[]>(`/servers/${id}/inbounds`),
    addInbound: (id: number, data: Partial<Inbound>) => req<Inbound>(`/servers/${id}/inbounds`, { method: 'POST', body: JSON.stringify(data) }),
    updateInbound: (id: number, inboundId: number, data: Partial<Inbound>) => req<Inbound>(`/servers/${id}/inbounds/${inboundId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteInbound: (id: number, inboundId: number) => req<{ success: boolean }>(`/servers/${id}/inbounds/${inboundId}`, { method: 'DELETE' }),
    regenerateInboundKeys: (id: number, inboundId: number) => req<{ success: boolean; server: Server }>(`/servers/${id}/inbounds/${inboundId}/regenerate-keys`, { method: 'POST' }),
  },
  clients: {
    list: () => req<Client[]>('/clients'),
    create: (data: { name: string; email: string; serverId: number; totalLimit: number; expiryDate: string }) =>
      req<Client>('/clients', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Client>) => req<Client>(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => req<{ success: boolean }>(`/clients/${id}`, { method: 'DELETE' }),
    resetStats: (id: number) => req<Client>(`/clients/${id}/reset-stats`, { method: 'POST' }),
  },
  traffic: (days = 30) => req<TrafficData>(`/traffic?days=${days}`),
  notifications: () => req<Notification[]>('/notifications'),
  ping: () => req<PingData[]>('/ping'),
  xray: {
    versions: () => req<XrayVersions>('/xray/versions'),
    download: (version: string) => req<{ success: boolean; version: string }>('/xray/download', { method: 'POST', body: JSON.stringify({ version }) }),
  },
  settings: {
    get: () => req<Settings>('/settings'),
    update: (data: Partial<Settings>) => req<Settings>('/settings', { method: 'PUT', body: JSON.stringify(data) }),
  },
};
