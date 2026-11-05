import { useEffect, useState } from 'react';
import { api } from '../api';
import type { PingData } from '../types';

const pingColor = (ping: number) => {
  if (ping < 0) return 'text-white/20';
  if (ping < 50) return 'text-emerald-400';
  if (ping < 150) return 'text-amber-400';
  return 'text-red-400';
};

const pingDot = (ping: number) => {
  if (ping < 0) return 'bg-white/20';
  if (ping < 50) return 'bg-emerald-400';
  if (ping < 150) return 'bg-amber-400';
  return 'bg-red-400';
};

export default function PingWidget() {
  const [pings, setPings] = useState<PingData[]>([]);

  useEffect(() => {
    api.ping().then(setPings);
    const interval = setInterval(() => api.ping().then(setPings), 5000);
    return () => clearInterval(interval);
  }, []);

  const avgPing = pings.filter((p) => p.ping > 0);
  const avg = avgPing.length ? Math.round(avgPing.reduce((a, p) => a + p.ping, 0) / avgPing.length) : 0;

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white/60">Live Ping</h2>
        <div className="flex items-center gap-2">
          {avg > 0 && <span className={`text-xs font-mono font-medium ${pingColor(avg)}`}>avg {avg}ms</span>}
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-white/30">live</span>
          </div>
        </div>
      </div>
      <div className="space-y-2.5">
        {pings.map((p) => (
          <div key={p.id} className="flex items-center justify-between">
            <span className="text-xs text-white/70">{p.name}</span>
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${pingDot(p.ping)} ${p.ping > 0 ? 'animate-pulse' : ''}`} />
              <span className={`text-xs font-mono font-medium tabular-nums w-14 text-right ${pingColor(p.ping)}`}>
                {p.ping > 0 ? `${p.ping}ms` : 'offline'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
