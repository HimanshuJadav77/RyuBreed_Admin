import React, { useState } from 'react';
import Modal from '../components/Modal.jsx';
import { Search, UserCheck, Shield, Clock, AlertTriangle, Check, Copy, MoreVertical } from 'lucide-react';

export default function InstitutesView({ institutes = [], onRefresh, onAction, loading, error, successMsg }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInstitute, setSelectedInstitute] = useState(null);
  const [modalType, setModalType] = useState(null); // 'activate' | 'trial' | 'revoke'
  const [copiedId, setCopiedId] = useState(null);

  // Form states
  const [planTier, setPlanTier] = useState('smart199');
  const [durationMonths, setDurationMonths] = useState(12);
  const [trialDays, setTrialDays] = useState(14);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const filtered = institutes.filter((inst) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (inst.name && inst.name.toLowerCase().includes(term)) ||
      (inst.email && inst.email.toLowerCase().includes(term)) ||
      (inst.id && inst.id.toLowerCase().includes(term))
    );
  });

  const handleCopy = (id) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openModal = (inst, type) => {
    setSelectedInstitute(inst);
    setModalType(type);
    setReason('');
    if (type === 'activate') {
      setPlanTier('smart199');
      setDurationMonths(12);
    } else if (type === 'trial') {
      setTrialDays(14);
    }
  };

  const closeModal = () => {
    setModalType(null);
    setSelectedInstitute(null);
    setSubmitting(false);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!selectedInstitute) return;
    setSubmitting(true);

    try {
      if (modalType === 'activate') {
        await onAction('/api/plans/activate', {
          instituteId: selectedInstitute.id,
          planTier,
          durationMonths: Number(durationMonths),
          reason: reason.trim() || 'Admin manual activation',
        });
      } else if (modalType === 'trial') {
        await onAction('/api/trials/grant', {
          instituteId: selectedInstitute.id,
          durationDays: Number(trialDays),
          reason: reason.trim() || 'Admin manual trial grant',
        });
      } else if (modalType === 'revoke') {
        await onAction('/api/subscriptions/revoke', {
          instituteId: selectedInstitute.id,
          reason: reason.trim() || 'Admin manual revocation',
        });
      }
      closeModal();
    } catch {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (inst) => {
    const status = inst.licenseStatus || inst.subscriptionStatus || 'none';
    if (status === 'active') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-mono">
          Active
        </span>
      );
    }
    if (status === 'trial') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-950/60 text-sky-400 border border-sky-800/40 font-mono">
          Trial
        </span>
      );
    }
    if (status === 'expired') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-950/60 text-amber-400 border border-amber-800/40 font-mono">
          Expired
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700/40 font-mono">
        Inactive
      </span>
    );
  };

  const getPlanBadge = (inst) => {
    const plan = (inst.planTier || '').toLowerCase();
    if (plan.includes('smart')) {
      return (
        <span className="text-xs font-medium text-indigo-300 bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-800/30">
          Smart ₹199
        </span>
      );
    }
    if (plan.includes('core')) {
      return (
        <span className="text-xs font-medium text-zinc-300 bg-zinc-800/60 px-2 py-0.5 rounded border border-zinc-700/30">
          Core ₹99
        </span>
      );
    }
    return <span className="text-xs text-zinc-500 font-mono">No Plan</span>;
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-zinc-800/80">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 tracking-tight">Institute directory & management</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Search academies, verify student/batch footprints, and assign subscription plans.
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

      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search by name, email, or UID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        <div className="text-xs text-zinc-500 font-mono self-center">
          Showing {filtered.length} of {institutes.length} institutes
        </div>
      </div>

      {/* Institutes Table */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400 font-medium">
                <th className="py-3 px-4">Institute</th>
                <th className="py-3 px-4">Academic Footprint</th>
                <th className="py-3 px-4">Current Plan</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Valid Until</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-500 text-xs">
                    {loading ? 'Loading institutes...' : 'No institutes found matching query.'}
                  </td>
                </tr>
              ) : (
                filtered.map((inst) => {
                  const instId = inst.id || inst._id || 'unknown';
                  return (
                    <tr key={instId} className="hover:bg-zinc-900/50 transition-colors">
                      {/* Name & Email & UID */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-zinc-200">{inst.name || 'Unnamed Institute'}</div>
                        <div className="text-zinc-400 text-[11px]">{inst.email || 'No email registered'}</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <code className="text-[10px] font-mono text-zinc-500 bg-zinc-950 px-1 py-0.5 rounded border border-zinc-800/60">
                            {instId}
                          </code>
                          <button
                            onClick={() => handleCopy(instId)}
                            title="Copy UID"
                            className="text-zinc-500 hover:text-zinc-300 transition-colors"
                          >
                            {copiedId === instId ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                          </button>
                        </div>
                      </td>

                      {/* Students & Batches */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3 font-mono text-[11px]">
                          <span className="text-zinc-300">
                            <strong className="text-zinc-100">{inst.studentsCount ?? 0}</strong> students
                          </span>
                          <span className="text-zinc-500">•</span>
                          <span className="text-zinc-300">
                            <strong className="text-zinc-100">{inst.batchesCount ?? 0}</strong> batches
                          </span>
                        </div>
                      </td>

                      {/* Current Plan */}
                      <td className="py-3 px-4">{getPlanBadge(inst)}</td>

                      {/* Status */}
                      <td className="py-3 px-4">{getStatusBadge(inst)}</td>

                      {/* Valid Until */}
                      <td className="py-3 px-4 font-mono text-[11px] text-zinc-400 tabular-nums">
                        {inst.validUntil ? new Date(inst.validUntil).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        }) : '—'}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openModal(inst, 'activate')}
                            className="px-2.5 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-700/40 text-[11px] font-medium transition-colors"
                          >
                            Assign Plan
                          </button>
                          <button
                            onClick={() => openModal(inst, 'trial')}
                            className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/60 text-[11px] font-medium transition-colors"
                          >
                            Grant Trial
                          </button>
                          <button
                            onClick={() => openModal(inst, 'revoke')}
                            className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-950/20 transition-colors"
                            title="Revoke subscription"
                          >
                            <AlertTriangle size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Activate / Assign Plan */}
      <Modal
        isOpen={modalType === 'activate'}
        onClose={closeModal}
        title="Assign Subscription Plan"
        description={`Configure an authoritative subscription tier for ${selectedInstitute?.name || 'this institute'}. Synchronizes directly to Cloudflare Worker, Firestore, and the local SQLite cache.`}
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Target institute UID</label>
            <input
              type="text"
              readOnly
              value={selectedInstitute?.id || ''}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-400 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Plan tier</label>
              <select
                value={planTier}
                onChange={(e) => setPlanTier(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="smart199">Smart Plan (₹199 / mo)</option>
                <option value="core99">Core Plan (₹99 / mo)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Duration</label>
              <select
                value={durationMonths}
                onChange={(e) => setDurationMonths(Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
              >
                <option value={1}>1 Month</option>
                <option value={3}>3 Months</option>
                <option value={6}>6 Months</option>
                <option value={12}>12 Months (1 Year)</option>
                <option value={24}>24 Months (2 Years)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Audit reason</label>
            <input
              type="text"
              placeholder="e.g. Annual institutional contract assigned"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={closeModal}
              className="px-3 py-1.5 rounded-lg border border-zinc-800 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition-colors disabled:opacity-50"
            >
              {submitting ? 'Activating...' : 'Confirm Activation'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Grant Trial */}
      <Modal
        isOpen={modalType === 'trial'}
        onClose={closeModal}
        title="Grant Evaluation Trial"
        description={`Temporarily unlock full academic features for ${selectedInstitute?.name || 'this institute'}.`}
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Target institute UID</label>
            <input
              type="text"
              readOnly
              value={selectedInstitute?.id || ''}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Trial duration (days)</label>
            <select
              value={trialDays}
              onChange={(e) => setTrialDays(Number(e.target.value))}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
            >
              <option value={7}>7 Days</option>
              <option value={14}>14 Days (Standard)</option>
              <option value={30}>30 Days</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Audit reason</label>
            <input
              type="text"
              placeholder="e.g. Onboarding pilot request"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={closeModal}
              className="px-3 py-1.5 rounded-lg border border-zinc-800 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-medium text-white transition-colors disabled:opacity-50"
            >
              {submitting ? 'Granting...' : 'Confirm Trial Grant'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Revoke */}
      <Modal
        isOpen={modalType === 'revoke'}
        onClose={closeModal}
        title="Revoke Subscription"
        description={`Are you sure you want to revoke the active license for ${selectedInstitute?.name || 'this institute'}? The academy will immediately revert to inactive state.`}
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Reason for revocation</label>
            <input
              type="text"
              required
              placeholder="e.g. Payment chargeback or account termination"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={closeModal}
              className="px-3 py-1.5 rounded-lg border border-zinc-800 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-medium text-white transition-colors disabled:opacity-50"
            >
              {submitting ? 'Revoking...' : 'Confirm Revocation'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

