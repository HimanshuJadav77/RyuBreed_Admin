import React from 'react';

export default function MetricCard({ label, value, note, formatCurrency = false, highlight = false }) {
  const displayValue = formatCurrency
    ? `₹${Number(value || 0).toLocaleString('en-IN')}`
    : Number(value || 0).toLocaleString('en-IN');

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5 flex flex-col justify-between hover:border-zinc-700/80 transition-colors">
      <div className="text-xs font-medium text-zinc-400 mb-2">{label}</div>
      <div className="flex items-baseline justify-between">
        <span className={`text-2xl font-semibold tracking-tight font-mono tabular-nums ${
          highlight ? 'text-indigo-400' : 'text-zinc-100'
        }`}>
          {displayValue}
        </span>
      </div>
      {note && (
        <div className="mt-2 text-xs text-zinc-500 font-normal">
          {note}
        </div>
      )}
    </div>
  );
}

