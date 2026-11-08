import React from 'react';
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Sliders,
  ShieldAlert,
  ExternalLink,
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'institutes', label: 'Institutes', icon: Building2 },
  { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
  { id: 'plans', label: 'Pricing & Plans', icon: Sliders },
  { id: 'audit', label: 'Security & Audit', icon: ShieldAlert },
];

export default function Sidebar({ currentTab, onSelectTab, mobileOpen, onCloseMobile }) {
  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
        />
      )}

      <aside
        className={`fixed md:sticky top-14 bottom-0 left-0 z-30 w-60 bg-zinc-950 border-r border-zinc-800/80 flex flex-col justify-between py-4 transition-transform duration-200 ease-out md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ height: 'calc(100vh - 3.5rem)' }}
      >
        <div className="px-3 space-y-1">
          <div className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500 font-mono">
            Navigation
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-zinc-900 text-zinc-100 border border-zinc-800/80'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-indigo-400' : 'text-zinc-500'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* System Footnote */}
        <div className="px-4 py-3 mx-3 rounded-lg border border-zinc-800/60 bg-zinc-900/30">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
            <span className="font-medium text-zinc-300">RyuBreed Engine</span>
            <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">v1.2.0</span>
          </div>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            Multi-tenant license & synchronization authority.
          </p>
        </div>
      </aside>
    </>
  );
}

