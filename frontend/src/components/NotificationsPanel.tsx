import { useEffect, useState, useRef } from 'react';
import { Bell, X, AlertCircle, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { api } from '../api';
import type { Notification } from '../types';

const typeConfig = {
  error: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
  warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  success: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
};

function timeAgo(time: string) {
  const diff = Date.now() - new Date(time).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationsPanel() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api.notifications().then(setNotifications);
  }, []);

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-10 h-10 rounded-full glass flex items-center justify-center relative active:scale-95 transition-transform"
      >
        <Bell size={18} className="text-white/60" />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-[9px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-12 right-0 w-80 max-w-[calc(100vw-2rem)] glass-card p-4 z-50 animate-scale-in max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Notifications</h3>
              <span className="text-[10px] text-white/30">{unread} unread</span>
            </div>
            <div className="space-y-1.5">
              {notifications.length === 0 && (
                <p className="text-xs text-white/30 text-center py-4">No notifications</p>
              )}
              {notifications.map((n) => {
                const cfg = typeConfig[n.type];
                return (
                  <div
                    key={n.id}
                    className={`flex gap-3 p-2.5 rounded-2xl ${n.read ? '' : 'bg-white/[0.03]'}`}
                  >
                    <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                      <cfg.icon size={14} className={cfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">{n.title}</p>
                      <p className="text-[10px] text-white/40 mt-0.5 leading-snug">{n.message}</p>
                      <p className="text-[9px] text-white/20 mt-1">{timeAgo(n.time)}</p>
                    </div>
                    {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0 mt-2" />}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
