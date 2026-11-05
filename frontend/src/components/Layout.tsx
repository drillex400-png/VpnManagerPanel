import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Server, Users, Activity, Settings } from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/servers', icon: Server, label: 'Servers' },
  { to: '/clients', icon: Users, label: 'Clients' },
  { to: '/traffic', icon: Activity, label: 'Traffic' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout() {
  return (
    <div className="min-h-screen text-white max-w-md mx-auto relative">
      <main className="pb-28 min-h-screen">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50 pb-safe px-3 pb-3">
        <div className="glass rounded-[1.75rem] flex justify-around items-center px-2 py-2">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `relative flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-300 ${
                  isActive ? 'text-violet-300' : 'text-white/30'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute inset-0 rounded-2xl bg-violet-500/15 shadow-[0_0_16px_rgba(139,92,246,0.25)]" />
                  )}
                  <Icon size={21} strokeWidth={isActive ? 2.5 : 2} className="relative" />
                  <span className="text-[10px] font-medium tracking-wide relative">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
