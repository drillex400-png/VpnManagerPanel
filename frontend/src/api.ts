import type { DashboardData, Server, Client, TrafficData, Notification, PingData, XrayVersions } from './types';

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
  },
  clients: {
    list: () => req<Client[]>('/clients'),
    create: (data: { name: string; email: string; serverId: number; totalLimit: number; expiryDate: string }) =>
      req<Client>('/clients', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Client>) => req<Client>(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => req<{ success: boolean }>(`/clients/${id}`, { method: 'DELETE' }),
  },
  traffic: (days = 30) => req<TrafficData>(`/traffic?days=${days}`),
  notifications: () => req<Notification[]>('/notifications'),
  ping: () => req<PingData[]>('/ping'),
  xray: {
    versions: () => req<XrayVersions>('/xray/versions'),
    download: (version: string) => req<{ success: boolean; version: string }>('/xray/download', { method: 'POST', body: JSON.stringify({ version }) }),
  },
};
