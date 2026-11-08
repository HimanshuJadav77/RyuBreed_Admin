import React from 'react';
import { Shield, LogOut, CheckCircle2, AlertCircle, Menu, X } from 'lucide-react';

export default function Navbar({ user, onLogout, workerHealthy, mobileMenuOpen, setMobileMenuOpen }) {
  return (
    <header className="h-14 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur sticky top-0 z-40 px-4 md:px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
          aria-label="Toggle Navigation"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-sm tracking-tight shadow-sm shadow-indigo-600/30">
            R
          </div>
          <div>
            <span className="font-semibold text-zinc-100 text-sm tracking-tight">RyuBreed Academia</span>
            <span className="hidden sm:inline-block ml-2 text-xs text-zinc-500 font-mono">admin-console</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Worker & Cloud Status */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-zinc-800 bg-zinc-900/60 text-xs">
          {workerHealthy ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span className="text-zinc-400">Worker Live</span>
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              <span className="text-zinc-400">Worker Standby</span>
            </>
          )}
        </div>

        {/* User Info & Logout */}
        {user && (
          <div className="flex items-center gap-3 pl-2 border-l border-zinc-800">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-medium text-zinc-200">{user.email || 'Admin'}</div>
              <div className="text-[10px] text-zinc-500 font-mono capitalize">{user.role || 'Super Admin'}</div>
            </div>
            <button
              onClick={onLogout}
              title="Sign Out"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-950/20 transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

