import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Server, Users, Activity, Settings } from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/servers', icon: Server, label: 'Servers' },
  { to: '/clients', icon: Users, label: 'Clients' },
  { to: '/traffic', icon: Activity, label: 'Traffic' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout() {
  return (
    <div className="min-h-screen bg-bg text-white max-w-md mx-auto relative">
      <main className="pb-28 min-h-screen">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50 pb-safe">
        <div className="glass border-t border-white/[0.06] mx-0 flex justify-around items-center px-2 py-2 backdrop-blur-2xl bg-black/40">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-300 ${
                  isActive ? 'text-violet-400 bg-violet-500/10' : 'text-white/35'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="text-[10px] font-medium tracking-wide">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
