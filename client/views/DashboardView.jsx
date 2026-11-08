import React from 'react';
import MetricCard from '../components/MetricCard.jsx';
import { ArrowUpRight, ShieldCheck, Zap, AlertCircle, RefreshCw } from 'lucide-react';

export default function DashboardView({ data, onNavigate, onRefresh, loading }) {
  const {
    totalInstitutes = 0,
    activeSubscriptions = 0,
    activeTrials = 0,
    expiredSubscriptions = 0,
    totalRevenue = 0,
    totalUsers = 0,
  } = data || {};

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-zinc-800/80">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 tracking-tight">Executive overview</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time subscriber distribution, revenue, and multi-tenant quotas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-xs font-medium text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total institutes"
          value={totalInstitutes}
          note="Registered academy tenants"
        />
        <MetricCard
          label="Active subscriptions"
          value={activeSubscriptions}
          note="Core & Smart active tiers"
          highlight={true}
        />
        <MetricCard
          label="Active trials"
          value={activeTrials}
          note="Evaluation tier access"
        />
        <MetricCard
          label="Total platform revenue"
          value={totalRevenue}
          formatCurrency={true}
          note="Cumulative Razorpay settlement"
        />
      </div>

      {/* Second Row: System Architecture & Quick Routing */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Architecture & Quotas panel */}
        <div className="lg:col-span-2 rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200">System architecture & safeguards</h2>
            <span className="text-[11px] font-mono text-zinc-500">Spark Plan • Zero Cloud Functions</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg border border-zinc-800/60 bg-zinc-900/50 space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
                <ShieldCheck size={14} className="text-emerald-400" />
                <span>Fail-closed licensing (REG-IMPL-01)</span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                All plan mutations route strictly through the authoritative Worker API.
              </p>
            </div>

            <div className="p-3 rounded-lg border border-zinc-800/60 bg-zinc-900/50 space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
                <Zap size={14} className="text-indigo-400" />
                <span>Dual offline SQLite synchronization</span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Local-first caching with automatic cloud pull upon login & restore.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-zinc-800/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-zinc-400 gap-2">
              <span>Platform subscriber quotas</span>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="text-zinc-300">Core: <strong className="text-zinc-100 font-semibold">150</strong> students / <strong className="text-zinc-100 font-semibold">10</strong> batches</span>
                <span className="text-zinc-300">Smart: <strong className="text-indigo-300 font-semibold">Unlimited</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Operations Actions */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-5 space-y-4 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-200 mb-1">Quick management</h2>
            <p className="text-xs text-zinc-500 mb-4">Direct shortcuts to critical workflows.</p>

            <div className="space-y-2">
              <button
                onClick={() => onNavigate('institutes')}
                className="w-full flex items-center justify-between p-2.5 rounded-lg border border-zinc-800/60 bg-zinc-900/60 text-xs font-medium text-zinc-200 hover:bg-zinc-800 hover:text-white transition-colors"
              >
                <span>Directory & grant access</span>
                <ArrowUpRight size={14} className="text-zinc-400" />
              </button>

              <button
                onClick={() => onNavigate('plans')}
                className="w-full flex items-center justify-between p-2.5 rounded-lg border border-zinc-800/60 bg-zinc-900/60 text-xs font-medium text-zinc-200 hover:bg-zinc-800 hover:text-white transition-colors"
              >
                <span>Configure pricing tiers</span>
                <ArrowUpRight size={14} className="text-zinc-400" />
              </button>

              <button
                onClick={() => onNavigate('audit')}
                className="w-full flex items-center justify-between p-2.5 rounded-lg border border-zinc-800/60 bg-zinc-900/60 text-xs font-medium text-zinc-200 hover:bg-zinc-800 hover:text-white transition-colors"
              >
                <span>Inspect audit logs</span>
                <ArrowUpRight size={14} className="text-zinc-400" />
              </button>
            </div>
          </div>

          <div className="text-[11px] text-zinc-500 font-mono pt-3 border-t border-zinc-800/60">
            {expiredSubscriptions > 0 ? (
              <span className="text-amber-400">{expiredSubscriptions} expired subscription(s) pending renewal.</span>
            ) : (
              <span className="text-zinc-500">All current subscriptions in good standing.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

