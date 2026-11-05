import { useEffect, useState } from 'react';
import { AreaChart, Area, ResponsiveContainer, XAxis, Tooltip } from 'recharts';
import { Server as ServerIcon, Users, TrendingUp, Activity, Bell } from 'lucide-react';
import { api } from '../api';
import type { DashboardData } from '../types';

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api.dashboard().then(setData).catch(console.error);
  }, []);

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const todayTotal = data.traffic.today.upload + data.traffic.today.download;
  const monthTotal = data.traffic.month.upload + data.traffic.month.download;

  const stats = [
    { label: 'Servers', value: data.servers.total, sub: `${data.servers.online} online`, icon: ServerIcon, accent: 'text-violet-400', bg: 'bg-violet-500/10' },
    { label: 'Clients', value: data.clients.total, sub: `${data.clients.active} active`, icon: Users, accent: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { label: 'Today', value: `${todayTotal.toFixed(1)}`, unit: 'GB', sub: `↑${data.traffic.today.upload} ↓${data.traffic.today.download}`, icon: TrendingUp, accent: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'This Month', value: `${(monthTotal / 1024).toFixed(2)}`, unit: 'TB', sub: 'Total traffic', icon: Activity, accent: 'text-amber-400', bg: 'bg-amber-500/10' },
  ];

  const statusColor = (s: string) =>
    s === 'online' ? 'bg-emerald-400' : s === 'maintenance' ? 'bg-amber-400' : 'bg-red-400';

  const maxProto = Math.max(...data.protocolDistribution.map((p) => p.count));

  return (
    <div className="px-4 py-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">VPN Panel</h1>
          <p className="text-sm text-white/40">Control Center</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="w-10 h-10 rounded-full glass flex items-center justify-center">
            <Bell size={18} className="text-white/60" />
          </button>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white font-semibold text-sm">
            AD
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s, i) => (
          <div key={i} className="glass-card p-4 animate-slide-up" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center`}>
                <s.icon size={18} className={s.accent} />
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <p className="text-2xl font-bold">{s.value}</p>
              {s.unit && <span className="text-xs text-white/40">{s.unit}</span>}
            </div>
            <p className="text-xs text-white/40 mt-1">{s.label}</p>
            <p className={`text-xs ${s.accent} mt-0.5`}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Traffic chart */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white/60">Traffic Overview</h2>
          <span className="text-xs text-white/30">Last 7 days</span>
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={data.recentTraffic} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
            <defs>
              <linearGradient id="upGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="downGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06B6D4" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#06B6D4" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: string) => v.slice(5)}
            />
            <Tooltip
              contentStyle={{ background: '#16161F', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12 }}
              labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
            />
            <Area type="monotone" dataKey="download" stroke="#06B6D4" strokeWidth={2} fill="url(#downGrad)" />
            <Area type="monotone" dataKey="upload" stroke="#8B5CF6" strokeWidth={2} fill="url(#upGrad)" />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-violet-500" />
            <span className="text-[10px] text-white/40">Upload</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-cyan-400" />
            <span className="text-[10px] text-white/40">Download</span>
          </div>
        </div>
      </div>

      {/* Server status */}
      <div className="glass-card p-5">
        <h2 className="text-sm font-semibold text-white/60 mb-4">Server Status</h2>
        <div className="space-y-3">
          {data.serversList.map((s) => (
            <div key={s.id} className="flex items-center gap-3">
              <span className="text-2xl">{s.flag}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{s.name}</p>
                <div className="flex gap-3 mt-0.5">
                  <span className="text-[10px] text-white/30">CPU {s.cpu}%</span>
                  <span className="text-[10px] text-white/30">RAM {s.ram}%</span>
                  <span className="text-[10px] text-white/30">{s.clientCount} clients</span>
                </div>
              </div>
              <span className={`w-2 h-2 rounded-full ${statusColor(s.status)}`} />
            </div>
          ))}
        </div>
      </div>

      {/* Protocol distribution */}
      <div className="glass-card p-5">
        <h2 className="text-sm font-semibold text-white/60 mb-4">Protocol Distribution</h2>
        <div className="space-y-3">
          {data.protocolDistribution.map((p) => (
            <div key={p.type}>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-white/70">{p.name}</span>
                <span className="text-white/40">{p.count}</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${(p.count / maxProto) * 100}%`, background: p.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
