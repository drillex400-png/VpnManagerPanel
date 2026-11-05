import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Server, Users, Activity, Settings, Menu, X } from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/servers', icon: Server, label: 'Servers' },
  { to: '/clients', icon: Users, label: 'Clients' },
  { to: '/traffic', icon: Activity, label: 'Traffic' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen text-white max-w-md mx-auto relative">
      {/* Top bar with hamburger */}
      <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40 px-4 pt-3 pb-2"
        style={{ background: 'linear-gradient(180deg, rgba(7,7,12,0.95) 0%, rgba(7,7,12,0.7) 70%, transparent 100%)' }}>
        <div className="flex items-center justify-between">
          <button
            onClick={() => setOpen(true)}
            className="w-11 h-11 rounded-2xl glass flex items-center justify-center active:scale-95 transition-transform"
            aria-label="Open menu"
          >
            <Menu size={20} className="text-violet-300" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
              <Server size={14} className="text-white" />
            </div>
            <span className="text-sm font-bold font-display tracking-tight">Xray Panel</span>
          </div>
          <div className="w-11 h-11 rounded-2xl glass flex items-center justify-center">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white font-semibold text-xs">
              AD
            </div>
          </div>
        </div>
      </header>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Side drawer */}
      <nav
        className={`fixed top-0 left-0 h-full w-72 z-50 transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full glass rounded-r-[2rem] flex flex-col p-5 pt-6">
          {/* Drawer header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
                <Server size={18} className="text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold font-display">Xray Panel</h2>
                <p className="text-[10px] text-white/40">VPN Control Center</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-9 h-9 rounded-xl glass-soft flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation links */}
          <div className="flex-1 space-y-1.5">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `relative flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 ${
                    isActive
                      ? 'bg-violet-500/15 text-violet-300'
                      : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-full bg-violet-400 shadow-[0_0_12px_rgba(139,92,246,0.5)]" />
                    )}
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                    <span className="text-sm font-medium">{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-white/5">
            <p className="text-[10px] text-white/30 leading-relaxed">
              VLESS · VMess · Trojan · Shadowsocks<br />
              Powered by Xray-core
            </p>
          </div>
        </div>
      </nav>

      {/* Main content with top padding for the header */}
      <main className="pt-16 pb-6 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
