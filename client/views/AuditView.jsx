import React, { useState } from 'react';
import { ShieldCheck, Filter, Clock, Search, Terminal } from 'lucide-react';

export default function AuditView({ logs = [], loading, error }) {
  const [filterAction, setFilterAction] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = logs.filter((log) => {
    const action = log.action || log.event || 'UNKNOWN';
    if (filterAction !== 'ALL' && !action.toUpperCase().includes(filterAction)) {
      return false;
    }
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const target = (log.targetInstituteId || log.instituteId || '').toLowerCase();
    const reason = (log.reason || log.details || '').toLowerCase();
    const operator = (log.operator || log.adminEmail || '').toLowerCase();
    return target.includes(term) || reason.includes(term) || operator.includes(term);
  });

  const getActionBadge = (actionStr) => {
    const act = (actionStr || '').toUpperCase();
    if (act.includes('ACTIVATE') || act.includes('GRANT')) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
          {act}
        </span>
      );
    }
    if (act.includes('EXTEND')) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-sky-950/60 text-sky-400 border border-sky-800/40">
          {act}
        </span>
      );
    }
    if (act.includes('REVOKE') || act.includes('EXPIRE')) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-red-950/60 text-red-400 border border-red-800/40">
          {act}
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-zinc-800 text-zinc-400 border border-zinc-700/40">
        {act}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-zinc-800/80">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 tracking-tight">Security & audit trail</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Immutable log of all licensing actions, manual overrides, and subscription mutations.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search audit trail by institute, operator, or reason..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          {['ALL', 'ACTIVATE', 'TRIAL', 'EXTEND', 'REVOKE'].map((action) => (
            <button
              key={action}
              onClick={() => setFilterAction(action)}
              className={`px-2.5 py-1 rounded text-[11px] font-mono font-medium transition-colors ${
                filterAction === action
                  ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/80'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden font-mono">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400 font-sans font-medium">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Target Institute</th>
                <th className="py-3 px-4">Details / Reason</th>
                <th className="py-3 px-4">Operator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-[11px]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-zinc-500 text-xs font-sans">
                    {loading ? 'Loading audit records...' : 'No security logs found.'}
                  </td>
                </tr>
              ) : (
                filtered.map((log, idx) => {
                  const timestamp = log.timestamp || log.createdAt || log.date;
                  const dateStr = timestamp
                    ? new Date(timestamp).toLocaleString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })
                    : '—';
                  const targetInst = log.targetInstituteId || log.instituteId || 'system';
                  const op = log.operator || log.adminEmail || log.performedBy || 'admin';
                  const reason = log.reason || (typeof log.details === 'object' ? JSON.stringify(log.details) : log.details) || '—';

                  return (
                    <tr key={log.id || idx} className="hover:bg-zinc-900/50 transition-colors">
                      <td className="py-3 px-4 text-zinc-400 tabular-nums whitespace-nowrap">{dateStr}</td>
                      <td className="py-3 px-4">{getActionBadge(log.action || log.event)}</td>
                      <td className="py-3 px-4 text-zinc-300">{targetInst}</td>
                      <td className="py-3 px-4 text-zinc-400 max-w-xs truncate" title={reason}>
                        {reason}
                      </td>
                      <td className="py-3 px-4 text-zinc-500">{op}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

