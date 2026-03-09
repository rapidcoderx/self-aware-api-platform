import { useState } from 'react'

function CollapseChevron({ collapsed }) {
  return (
    <svg
      className={`w-3.5 h-3.5 text-gray-500 transition-transform ${collapsed ? '' : 'rotate-180'}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

const CHANGE_TYPE_LABELS = {
  REQUIRED_ADDED: 'Required Added',
  FIELD_REMOVED: 'Field Removed',
  ENDPOINT_REMOVED: 'Endpoint Removed',
  TYPE_CHANGED: 'Type Changed',
  ENUM_CHANGED: 'Enum Changed',
  FIELD_ADDED: 'Field Added',
}

function DiffRow({ item }) {
  const [expanded, setExpanded] = useState(false)
  const isBreaking = item.breaking

  return (
    <div
      className={`border rounded-md overflow-hidden ${
        isBreaking
          ? 'border-red-500/40 bg-red-500/5'
          : 'border-yellow-500/40 bg-yellow-500/5'
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/5 transition-colors"
      >
        <span className="flex items-center gap-2 min-w-0">
          <span
            className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
              isBreaking
                ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/40'
                : 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/40'
            }`}
          >
            {isBreaking ? '🔴 BREAKING' : '🟡 NON-BREAKING'}
          </span>
          <span className="text-xs font-medium text-gray-400 shrink-0">
            {CHANGE_TYPE_LABELS[item.change_type] || item.change_type}
          </span>
          <span className="text-sm font-mono text-white truncate">{item.field}</span>
        </span>
        <svg
          className={`w-3.5 h-3.5 shrink-0 text-gray-500 transition-transform ml-2 ${
            expanded ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-3 pb-2 border-t border-white/5 pt-2 text-xs space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-gray-500 w-20 shrink-0">operation:</span>
            <span className="font-mono text-gray-300">
              {item.method} {item.path}
            </span>
            <span className="font-mono text-indigo-300 text-xs">({item.operation_id})</span>
          </div>
          {item.old_value !== null && item.old_value !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-gray-500 w-20 shrink-0">before:</span>
              <span className="font-mono text-red-300 line-through">{item.old_value}</span>
            </div>
          )}
          {item.new_value !== null && item.new_value !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-gray-500 w-20 shrink-0">after:</span>
              <span className="font-mono text-green-300">{item.new_value}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function DiffPanel({ diffData, impactCount, onClose }) {
  const [collapsed, setCollapsed] = useState(false)

  if (!diffData) {
    return (
      <div className="h-full flex items-center justify-center p-6 text-center">
        <div>
          <div className="text-gray-600 text-sm">No diff loaded</div>
          <div className="text-gray-700 text-xs mt-1">
            Use the Compare button to detect breaking changes
          </div>
        </div>
      </div>
    )
  }

  const { diff_id, breaking_count, non_breaking_count, diffs } = diffData
  const breakingDiffs = diffs.filter((d) => d.breaking)
  const nonBreakingDiffs = diffs.filter((d) => !d.breaking)

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <button
          type="button"
          onClick={() => setCollapsed((p) => !p)}
          className="flex items-center gap-2 min-w-0 group"
          aria-expanded={!collapsed}
        >
          <CollapseChevron collapsed={collapsed} />
          <div className="text-left">
            <h2 className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors">Spec Diff</h2>
            <p className="text-xs text-gray-500 mt-0.5">diff_id={diff_id}</p>
          </div>
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
            aria-label="Close diff panel"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Summary bar — always visible so you know what's in the diff even when collapsed */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-900/60 border-b border-gray-800 text-xs">
        <span
          className={`inline-flex items-center gap-1 font-semibold ${
            breaking_count > 0 ? 'text-red-400' : 'text-gray-400'
          }`}
        >
          🔴 {breaking_count} breaking
        </span>
        <span className="text-gray-600">·</span>
        <span className="text-yellow-400 font-semibold">
          🟡 {non_breaking_count} non-breaking
        </span>
        <span className="text-gray-600">·</span>
        <span className="text-gray-400">
          {impactCount != null ? `${impactCount} services affected` : 'impact: loading…'}
        </span>
      </div>

      {/* Diff rows — collapsible */}
      {!collapsed && <div className="overflow-y-auto max-h-72 p-3 space-y-2">
        {diffs.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-8">
            No schema changes detected between these versions.
          </div>
        )}

        {breakingDiffs.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-red-400 uppercase tracking-wide px-1">
              Breaking Changes
            </p>
            {breakingDiffs.map((item) => (
              <DiffRow key={`${item.operation_id}-${item.change_type}-${item.field}`} item={item} />
            ))}
          </div>
        )}

        {nonBreakingDiffs.length > 0 && (
          <div className="space-y-1.5 mt-3">
            <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wide px-1">
              Non-Breaking Changes
            </p>
            {nonBreakingDiffs.map((item) => (
              <DiffRow key={`${item.operation_id}-${item.change_type}-${item.field}`} item={item} />
            ))}
          </div>
        )}
      </div>}
    </div>
  )
}
