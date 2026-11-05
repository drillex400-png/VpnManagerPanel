import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Server, Users, Activity, Settings, LogOut, MonitorCog } from 'lucide-react';
import { api } from '../api';
import { useEffect, useState } from 'react';
import NotificationsPanel from './NotificationsPanel';
import QueuePanel from './QueuePanel';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Главная' },
  { to: '/servers', icon: Server, label: 'Ноды' },
  { to: '/clients', icon: Users, label: 'Клиенты' },
  { to: '/monitor', icon: MonitorCog, label: 'Монитор' },
  { to: '/traffic', icon: Activity, label: 'Трафик' },
  { to: '/settings', icon: Settings, label: 'Настройки' },
];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showLogout, setShowLogout] = useState(false);

  const handleLogout = () => {
    api.auth.logout().catch(() => {}).finally(() => {
      localStorage.removeItem('auth_token');
      navigate('/login');
    });
  };

  return (
    <div className="min-h-screen text-white max-w-md mx-auto relative flex flex-col">
      {/* Top bar */}
      <header
        className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40 px-4 pt-3 pb-2 flex items-center justify-between"
        style={{ background: 'linear-gradient(180deg, rgba(7,7,12,0.95) 0%, rgba(7,7,12,0.7) 70%, transparent 100%)' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
            <Server size={14} className="text-white" />
          </div>
          <span className="text-sm font-bold font-display tracking-tight">Xray Панель</span>
        </div>
        <div className="flex items-center gap-2">
          <QueuePanel />
          <NotificationsPanel />
          <button
            onClick={() => setShowLogout(true)}
            className="w-10 h-10 rounded-2xl glass flex items-center justify-center active:scale-95 transition-transform"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white font-semibold text-xs">
              АД
            </div>
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 pt-16 pb-24 min-h-screen">
        <div key={location.pathname} className="animate-fade-in">
          <Outlet />
        </div>
      </main>

      {/* Bottom navigation */}
      <nav
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40 px-3 pb-3 pt-1"
        style={{ background: 'linear-gradient(0deg, rgba(7,7,12,0.95) 0%, rgba(7,7,12,0.7) 70%, transparent 100%)' }}
      >
        <div className="glass rounded-[1.75rem] p-1.5 flex items-center justify-around">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `relative flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-2xl transition-all duration-200 ${
                  isActive ? 'text-violet-300' : 'text-white/40'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute inset-0 rounded-2xl bg-violet-500/15" />
                  )}
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className="relative" />
                  <span className="text-[9px] font-medium relative">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Logout confirmation */}
      {showLogout && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setShowLogout(false)}
        >
          <div
            className="relative w-full max-w-md glass-card rounded-t-[2rem] p-6 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <LogOut size={18} className="text-red-400" />
              </div>
              <div>
                <p className="font-semibold text-sm">Выйти из панели?</p>
                <p className="text-xs text-white/40">Потребуется повторный вход</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogout(false)}
                className="flex-1 py-3 rounded-2xl bg-white/5 text-white/60 text-sm font-medium active:scale-95 transition-transform"
              >
                Отмена
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-3 rounded-2xl bg-red-500/15 text-red-400 text-sm font-medium active:scale-95 transition-transform"
              >
                Выйти
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
