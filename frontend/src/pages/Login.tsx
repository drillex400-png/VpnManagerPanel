import { useState } from 'react';
import { Lock, User, Server, ArrowRight } from 'lucide-react';
import { api } from '../api';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    api.auth.login(username, password).then((res) => {
      localStorage.setItem('auth_token', res.token);
      window.location.href = '/';
    }).catch((err) => {
      setError(err.message || 'Ошибка входа');
      setLoading(false);
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-gradient-to-b from-[#0a0a12] via-[#0d0d1a] to-[#0a0a12]">
      {/* Фоновое свечение */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-violet-500/10 blur-[120px]" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-indigo-500/10 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Логотип */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center mx-auto mb-4 shadow-[0_0_40px_rgba(139,92,246,0.3)]">
            <Server size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold font-display">Xray Панель</h1>
          <p className="text-sm text-white/40 mt-1">Центр управления VPN</p>
        </div>

        {/* Форма */}
        <form onSubmit={handleLogin} className="glass-card p-6 space-y-4">
          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Логин</label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoFocus
                className="glass-input w-full pl-10 pr-4 py-3 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Пароль</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="glass-input w-full pl-10 pr-4 py-3 text-sm"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={!username || !password || loading}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white font-semibold text-sm disabled:opacity-40 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>Войти <ArrowRight size={16} /></>
            )}
          </button>
        </form>

        <p className="text-center text-[10px] text-white/20 mt-6">
          VLESS · VMess · Trojan · Shadowsocks · Xray-core
        </p>
      </div>
    </div>
  );
}
