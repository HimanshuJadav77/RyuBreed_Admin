import React, { useState } from 'react';
import { Check, Sliders, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';

export default function PlansView({ plans = [], onAction, loading, error, successMsg }) {
  const corePlan = plans.find((p) => p.id === 'core99') || {
    id: 'core99',
    name: 'Core Plan',
    priceINR: 99,
    annualPriceINR: 948,
    features: [
      'Up to 150 Students',
      'Up to 10 Batches',
      'Up to 5 Staff Members',
      'Attendance & Fee Tracking',
      'Cloud Sync & Multi-Device Access',
      'Basic PDF Receipts',
    ],
  };

  const smartPlan = plans.find((p) => p.id === 'smart199') || {
    id: 'smart199',
    name: 'Smart Plan',
    priceINR: 199,
    annualPriceINR: 1908,
    features: [
      'Unlimited Students, Batches & Staff',
      'Full Academics Hub (Homework & Tests)',
      'Study Materials & Lesson Plans',
      'Automated WhatsApp Reports & Queue',
      'Graphical Performance PDF Reports',
      'Student ID Cards & Merit Certificates',
    ],
  };

  const [corePrice, setCorePrice] = useState(corePlan.priceINR);
  const [coreAnnualPrice, setCoreAnnualPrice] = useState(corePlan.annualPriceINR);
  const [smartPrice, setSmartPrice] = useState(smartPlan.priceINR);
  const [smartAnnualPrice, setSmartAnnualPrice] = useState(smartPlan.annualPriceINR);
  const [submitting, setSubmitting] = useState(false);

  const handleSavePrices = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onAction('/api/plans/update', {
        coreName: corePlan.name,
        corePrice: Number(corePrice),
        coreAnnualPrice: Number(coreAnnualPrice),
        smartName: smartPlan.name,
        smartPrice: Number(smartPrice),
        smartAnnualPrice: Number(smartAnnualPrice),
      });
      setSubmitting(false);
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-zinc-800/80">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 tracking-tight">Pricing & subscription plans</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Authoritative plan definitions synchronized across Cloudflare Worker, Razorpay, and Flutter clients.
          </p>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3 rounded-lg border border-emerald-800/50 bg-emerald-950/30 text-emerald-300 text-xs flex items-center gap-2">
          <Check size={14} />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="p-3 rounded-lg border border-red-800/50 bg-red-950/30 text-red-300 text-xs flex items-center gap-2">
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* Plans Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Core Plan */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-6 flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/60">
              <div>
                <span className="text-xs font-mono uppercase text-zinc-400">Entry Tier</span>
                <h2 className="text-lg font-semibold text-zinc-100 mt-0.5">{corePlan.name}</h2>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold font-mono text-zinc-100 tabular-nums">
                  ₹{corePlan.priceINR}
                  <span className="text-xs text-zinc-500 font-normal"> / mo</span>
                </div>
                <div className="text-[11px] text-zinc-400 font-mono">₹{corePlan.annualPriceINR} / yr</div>
              </div>
            </div>

            <div className="mt-4 space-y-2.5">
              <div className="text-xs font-medium text-zinc-300 mb-2">Included platform features:</div>
              {corePlan.features.map((feat, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-zinc-300">
                  <Check size={14} className="text-zinc-500 mt-0.5 shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-800/60 text-xs text-zinc-500 font-mono">
            Quotas: 150 students • 10 batches • 5 staff
          </div>
        </div>

        {/* Smart Plan */}
        <div className="rounded-xl border border-indigo-900/40 bg-zinc-900/50 p-6 flex flex-col justify-between space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/60">
              <div>
                <span className="text-xs font-mono uppercase text-indigo-400">Recommended Tier</span>
                <h2 className="text-lg font-semibold text-zinc-100 mt-0.5">{smartPlan.name}</h2>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold font-mono text-indigo-300 tabular-nums">
                  ₹{smartPlan.priceINR}
                  <span className="text-xs text-zinc-500 font-normal"> / mo</span>
                </div>
                <div className="text-[11px] text-zinc-400 font-mono">₹{smartPlan.annualPriceINR} / yr</div>
              </div>
            </div>

            <div className="mt-4 space-y-2.5">
              <div className="text-xs font-medium text-zinc-300 mb-2">Full academic & growth suite:</div>
              {smartPlan.features.map((feat, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-zinc-200">
                  <Check size={14} className="text-indigo-400 mt-0.5 shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-800/60 text-xs text-indigo-300/80 font-mono">
            Quotas: Unlimited students • Unlimited batches • Unlimited staff
          </div>
        </div>
      </div>

      {/* Price Configuration Form */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-6">
        <h3 className="text-sm font-semibold text-zinc-200 mb-1">Adjust authoritative live rates</h3>
        <p className="text-xs text-zinc-400 mb-4">
          Updating rates automatically propagates to Cloudflare Worker, Razorpay order calculations, and the Flutter client settings view.
        </p>

        <form onSubmit={handleSavePrices} className="space-y-4 max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Core Plan monthly rate (₹)</label>
              <input
                type="number"
                min="1"
                required
                value={corePrice}
                onChange={(e) => setCorePrice(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Core Plan annual rate (₹)</label>
              <input
                type="number"
                min="1"
                required
                value={coreAnnualPrice}
                onChange={(e) => setCoreAnnualPrice(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Smart Plan monthly rate (₹)</label>
              <input
                type="number"
                min="1"
                required
                value={smartPrice}
                onChange={(e) => setSmartPrice(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Smart Plan annual rate (₹)</label>
              <input
                type="number"
                min="1"
                required
                value={smartAnnualPrice}
                onChange={(e) => setSmartAnnualPrice(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition-colors disabled:opacity-50"
            >
              {submitting ? 'Propagating changes...' : 'Save & propagate prices'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

