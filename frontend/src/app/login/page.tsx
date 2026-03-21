'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { login, setup, getAuthStatus, getMe } from '@/lib/auth';
import { Loader2, Lock, AlertTriangle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();

  const [mode,     setMode]     = useState<'login' | 'setup' | 'checking'>('checking');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [name,     setName]     = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  // On mount: check if already logged in or setup is required
  useEffect(() => {
    async function init() {
      const [me, status] = await Promise.all([getMe(), getAuthStatus()]);
      if (me) {
        router.replace('/command-center');
        return;
      }
      if (status?.setupRequired) {
        setMode('setup');
      } else {
        setMode('login');
      }
    }
    init();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'setup') {
        await setup(email, password, name);
      } else {
        await login(email, password);
      }
      router.replace('/command-center');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'checking') {
    return (
      <div className="min-h-screen bg-[#0B0B0C] flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[#C9A227]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0B0C] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo / brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#C9A22715] border border-[#C9A22740] mb-4">
            <Lock size={20} className="text-[#C9A227]" aria-hidden />
          </div>
          <h1 className="text-lg font-bold text-[#E8E6E3] tracking-tight">DOMINION EDGE</h1>
          <p className="text-xs text-[#605C57] mt-1 tracking-widest uppercase">
            {mode === 'setup' ? 'Create your operator account' : 'Acquisition OS'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-xl p-6">
          {mode === 'setup' && (
            <div className="mb-5 px-3 py-2.5 rounded-lg border border-[#C9A22740] bg-[#C9A22710] text-xs text-[#C9A227]">
              First run detected. Create your operator account to get started.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'setup' && (
              <div>
                <label className="block text-[11px] tracking-widest uppercase text-[#A7A29A] mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  className="w-full bg-[#1B1B1D] border border-[#2A2A2E] rounded-lg px-3 py-2.5 text-sm text-[#E8E6E3] focus:outline-none focus:border-[#C9A227] transition-colors"
                  placeholder="Marco Fernstaedt"
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] tracking-widest uppercase text-[#A7A29A] mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full bg-[#1B1B1D] border border-[#2A2A2E] rounded-lg px-3 py-2.5 text-sm text-[#E8E6E3] focus:outline-none focus:border-[#C9A227] transition-colors"
                placeholder="marco@dominionedge.com"
              />
            </div>

            <div>
              <label className="block text-[11px] tracking-widest uppercase text-[#A7A29A] mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === 'setup' ? 'new-password' : 'current-password'}
                minLength={mode === 'setup' ? 12 : 1}
                className="w-full bg-[#1B1B1D] border border-[#2A2A2E] rounded-lg px-3 py-2.5 text-sm text-[#E8E6E3] focus:outline-none focus:border-[#C9A227] transition-colors"
                placeholder={mode === 'setup' ? 'Min 12 characters' : ''}
              />
              {mode === 'setup' && (
                <p className="mt-1 text-[10px] text-[#605C57]">
                  Minimum 12 characters. This is the only operator account.
                </p>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-red-900/50 bg-red-950/20 text-xs text-red-400">
                <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" aria-hidden />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#C9A227] hover:bg-[#C09B2A] disabled:opacity-50 disabled:cursor-not-allowed text-black text-sm font-semibold rounded-lg transition-colors"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {mode === 'setup' ? 'Create Account' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] text-[#3D3D40] mt-4">
          Dominion Edge Holdings — Private Acquisition OS
        </p>
      </div>
    </div>
  );
}
