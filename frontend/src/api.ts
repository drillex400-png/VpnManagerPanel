import type { DashboardData, Server, Client, TrafficData, ProtocolType } from './types';

const BASE = '/api';

async function req<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export const api = {
  dashboard: () => req<DashboardData>('/dashboard'),
  servers: {
    list: () => req<Server[]>('/servers'),
    create: (data: Partial<Server>) => req<Server>('/servers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Server>) => req<Server>(`/servers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => req<{ success: boolean }>(`/servers/${id}`, { method: 'DELETE' }),
    addProtocol: (serverId: number, data: { type: ProtocolType; port: number }) =>
      req(`/servers/${serverId}/protocols`, { method: 'POST', body: JSON.stringify(data) }),
    deleteProtocol: (id: number) => req<{ success: boolean }>(`/protocols/${id}`, { method: 'DELETE' }),
  },
  clients: {
    list: () => req<Client[]>('/clients'),
    create: (data: Partial<Client>) => req<Client>('/clients', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Client>) => req<Client>(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => req<{ success: boolean }>(`/clients/${id}`, { method: 'DELETE' }),
  },
  traffic: (days = 30) => req<TrafficData>(`/traffic?days=${days}`),
};
