import React, { useState } from 'react';
import Modal from '../components/Modal.jsx';
import { Filter, Calendar, Key, Check, Copy, AlertTriangle, ArrowRight } from 'lucide-react';

export default function SubscriptionsView({ subscriptions = [], onAction, loading, error, successMsg }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedSub, setSelectedSub] = useState(null);
  const [extendModalOpen, setExtendModalOpen] = useState(false);
  const [extendDays, setExtendDays] = useState(30);
  const [extendReason, setExtendReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  const filtered = subscriptions.filter((sub) => {
    if (statusFilter === 'all') return true;
    return (sub.status || '').toLowerCase() === statusFilter;
  });

  const handleCopy = (key) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const openExtend = (sub) => {
    setSelectedSub(sub);
    setExtendDays(30);
    setExtendReason('');
    setExtendModalOpen(true);
  };

  const closeExtend = () => {
    setExtendModalOpen(false);
    setSelectedSub(null);
    setSubmitting(false);
  };

  const handleExtendSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSub) return;
    setSubmitting(true);
    try {
      await onAction('/api/subscriptions/extend', {
        subscriptionId: selectedSub.id || selectedSub._id,
        days: Number(extendDays),
        reason: extendReason.trim() || 'Admin manual license extension',
      });
      closeExtend();
    } catch {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'active') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-mono">
          Active
        </span>
      );
    }
    if (s === 'trial') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-950/60 text-sky-400 border border-sky-800/40 font-mono">
          Trial
        </span>
      );
    }
    if (s === 'expired') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-950/60 text-amber-400 border border-amber-800/40 font-mono">
          Expired
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700/40 font-mono">
        {status || 'Unknown'}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-zinc-800/80">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 tracking-tight">Subscription ledger</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Authoritative billing records, verified license cryptographic keys, and manual extensions.
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

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800/60 pb-3">
        {['all', 'active', 'trial', 'expired'].map((filter) => (
          <button
            key={filter}
            onClick={() => setStatusFilter(filter)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              statusFilter === filter
                ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/60'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Ledger Table */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400 font-medium">
                <th className="py-3 px-4">Subscription ID / Institute</th>
                <th className="py-3 px-4">Plan Tier</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">License Key</th>
                <th className="py-3 px-4">Term Dates</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-500 text-xs">
                    {loading ? 'Loading subscription records...' : 'No subscriptions matching filter.'}
                  </td>
                </tr>
              ) : (
                filtered.map((sub) => {
                  const subId = sub.id || sub._id || 'unknown';
                  const instId = sub.instituteId || sub.userId || '—';
                  const licKey = sub.licenseKey || '—';
                  return (
                    <tr key={subId} className="hover:bg-zinc-900/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-mono text-zinc-300 text-[11px]">{subId}</div>
                        <div className="text-zinc-500 text-[10px] font-mono mt-0.5">Institute: {instId}</div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-mono text-xs uppercase text-zinc-300">
                          {sub.planTier || sub.planId || 'Standard'}
                        </span>
                      </td>

                      <td className="py-3 px-4">{getStatusBadge(sub.status)}</td>

                      <td className="py-3 px-4">
                        {licKey !== '—' ? (
                          <div className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-400">
                            <span>{licKey.slice(0, 10)}...{licKey.slice(-6)}</span>
                            <button
                              onClick={() => handleCopy(licKey)}
                              className="text-zinc-500 hover:text-zinc-300"
                              title="Copy full key"
                            >
                              {copiedKey === licKey ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px] text-zinc-400 tabular-nums">
                        <div>
                          Start:{' '}
                          {sub.startDate
                            ? new Date(sub.startDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
                            : '—'}
                        </div>
                        <div className="text-zinc-500">
                          Expires:{' '}
                          {sub.validUntil || sub.endDate
                            ? new Date(sub.validUntil || sub.endDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
                            : '—'}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => openExtend(sub)}
                          className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/60 text-[11px] font-medium transition-colors"
                        >
                          Extend
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Extend */}
      <Modal
        isOpen={extendModalOpen}
        onClose={closeExtend}
        title="Extend Subscription License"
        description={`Add additional days to subscription ${selectedSub?.id || ''}. Updates the cryptographic expiry signature in Firestore and SQLite.`}
      >
        <form onSubmit={handleExtendSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Additional days</label>
            <input
              type="number"
              min="1"
              max="730"
              required
              value={extendDays}
              onChange={(e) => setExtendDays(Number(e.target.value))}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Audit reason</label>
            <input
              type="text"
              required
              placeholder="e.g. Compensation for network maintenance window"
              value={extendReason}
              onChange={(e) => setExtendReason(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={closeExtend}
              className="px-3 py-1.5 rounded-lg border border-zinc-800 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition-colors disabled:opacity-50"
            >
              {submitting ? 'Extending...' : 'Confirm Extension'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

