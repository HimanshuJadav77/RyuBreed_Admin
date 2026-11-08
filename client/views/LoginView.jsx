import React, { useState } from 'react';
import { Shield, AlertCircle, ArrowRight, Lock, Mail } from 'lucide-react';

export default function LoginView({ onLogin, error: propError, loading: propLoading }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);
    if (!email || !password) {
      setLocalError('Please enter both administrator email and password.');
      return;
    }
    setSubmitting(true);
    try {
      await onLogin({ email, password });
    } catch (err) {
      setLocalError(err.message || 'Authentication failed. Please verify credentials.');
      setSubmitting(false);
    }
  };

  const currentError = propError || localError;

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 font-bold text-white text-xl tracking-tight shadow-lg shadow-indigo-600/20 mb-3">
            R
          </div>
          <h1 className="text-lg font-semibold text-zinc-100 tracking-tight">RyuBreed Academia</h1>
          <p className="text-xs text-zinc-500 font-mono mt-0.5">Administrative Control Console</p>
        </div>

        {/* Login Card */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-6 shadow-xl space-y-5">
          <div className="border-b border-zinc-800/60 pb-3">
            <h2 className="text-sm font-semibold text-zinc-200">Sign in to console</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Authoritative subscription & license management</p>
          </div>

          {currentError && (
            <div className="p-3 rounded-lg border border-red-800/50 bg-red-950/40 text-red-300 text-xs flex items-start gap-2">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{currentError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Administrator email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="admin@ryubreed.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || propLoading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition-colors disabled:opacity-50"
            >
              <span>{submitting || propLoading ? 'Authenticating...' : 'Sign in as administrator'}</span>
              <ArrowRight size={14} />
            </button>
          </form>

          {/* Access Policy Information */}
          <div className="pt-3 border-t border-zinc-800/60 text-[11px] text-zinc-500 leading-relaxed space-y-1.5">
            <div className="flex items-center gap-1.5 text-zinc-400 font-medium">
              <Shield size={12} className="text-indigo-400" />
              <span>Dynamic administrative authorization</span>
            </div>
            <p>
              Access is validated against configured <code className="text-zinc-400 font-mono">ADMIN_EMAILS</code>, Firebase claims, or the Firestore <code className="text-zinc-400 font-mono">admin_users</code> collection.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

