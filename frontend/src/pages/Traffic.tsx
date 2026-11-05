import { useEffect, useState } from 'react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { ArrowUp, ArrowDown, Database } from 'lucide-react';
import { PageLoading, PageError } from '../components/PageState';
import { api } from '../api';
import type { TrafficData } from '../types';

const ranges = [
  { days: 7, label: '7д' },
  { days: 30, label: '30д' },
  { days: 90, label: '90д' },
];

export default function Traffic() {
  const [data, setData] = useState<TrafficData | null>(null);
  const [error, setError] = useState('');
  const [days, setDays] = useState(30);

  const load = () => {
    setError('');
    api.traffic(days).then(setData).catch((e) => {
      setError(e.message || 'Ошибка загрузки трафика');
      setData(null);
    });
  };

  useEffect(() => { load(); }, [days]);

  if (error) return <PageError message={error} onRetry={load} />;
  if (!data) return <PageLoading />;

  const summaries = [
    { label: 'Исходящий', value: data.totals.upload.toFixed(2), unit: 'ГБ', icon: ArrowUp, color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { label: 'Входящий', value: data.totals.download.toFixed(2), unit: 'ГБ', icon: ArrowDown, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { label: 'Всего', value: (data.totals.total / 1024).toFixed(3), unit: 'ТБ', icon: Database, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  ];

  const maxServer = Math.max(...data.perServer.map((s) => s.upload + s.download), 1);

  return (
    <div className="px-4 py-6 space-y-5 animate-fade-in">
      <div>
        <h1 className="text-[1.6rem] font-bold font-display">Трафик</h1>
        <p className="text-sm text-white/40">Мультипротокольная статистика</p>
      </div>

      {/* Выбор периода */}
      <div className="flex gap-2">
        {ranges.map((r) => (
          <button
            key={r.days}
            onClick={() => setDays(r.days)}
            className={`flex-1 py-2 rounded-2xl text-sm font-medium transition-all ${
              days === r.days ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/40' : 'bg-white/5 text-white/40'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Сводные карточки */}
      <div className="grid grid-cols-3 gap-3">
        {summaries.map((s, i) => (
          <div key={i} className="glass-card p-3 text-center">
            <div className={`w-8 h-8 rounded-xl ${s.bg} flex items-center justify-center mx-auto mb-2`}>
              <s.icon size={16} className={s.color} />
            </div>
            <div className="flex items-baseline justify-center gap-0.5">
              <p className="text-lg font-bold">{s.value}</p>
              <span className="text-[10px] text-white/30">{s.unit}</span>
            </div>
            <p className="text-[10px] text-white/30 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* График трафика */}
      {data.daily.length > 0 ? (
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-white/60 mb-4">Поток трафика</h2>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={data.daily} margin={{ top: 5, right: 5, left: -28, bottom: 0 }}>
              <defs>
                <linearGradient id="tUp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="tDown" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06B6D4" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#06B6D4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: string) => v.slice(5)}
                interval={Math.max(0, Math.floor(data.daily.length / 6) - 1)}
              />
              <YAxis
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{ background: '#16161F', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
              />
              <Area type="monotone" dataKey="download" stroke="#06B6D4" strokeWidth={2} fill="url(#tDown)" />
              <Area type="monotone" dataKey="upload" stroke="#8B5CF6" strokeWidth={2} fill="url(#tUp)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="glass-card p-8 text-center">
          <p className="text-sm text-white/40">Данных по трафику пока нет</p>
          <p className="text-xs text-white/30 mt-1">Запустите ноду и подключите клиентов, чтобы видеть трафик</p>
        </div>
      )}

      {/* Трафик по нодам */}
      {data.perServer.length > 0 && data.perServer.some(s => s.upload + s.download > 0) && (
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-white/60 mb-4">Трафик по нодам</h2>
          <ResponsiveContainer width="100%" height={Math.max(80, data.perServer.length * 40)}>
            <BarChart data={data.perServer} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={80}
              />
              <Tooltip
                contentStyle={{ background: '#16161F', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              />
              <Bar dataKey="upload" stackId="a" fill="#8B5CF6" radius={[0, 0, 0, 0]} />
              <Bar dataKey="download" stackId="a" fill="#06B6D4" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Распределение протоколов */}
      <div className="glass-card p-5">
        <h2 className="text-sm font-semibold text-white/60 mb-4">Распределение протоколов</h2>
        <div className="flex items-center gap-4">
          <ResponsiveContainer width={130} height={130}>
            <PieChart>
              <Pie
                data={data.protocolDistribution}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={55}
                paddingAngle={2}
              >
                {data.protocolDistribution.map((p) => (
                  <Cell key={p.type} fill={p.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#16161F', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-2">
            {data.protocolDistribution.map((p) => (
              <div key={p.type} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
                <span className="text-xs text-white/60 flex-1">{p.name}</span>
                <span className="text-xs text-white/40">{p.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
