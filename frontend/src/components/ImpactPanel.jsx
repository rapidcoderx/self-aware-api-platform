import { useState, useEffect } from 'react'
import axios from 'axios'

const SEVERITY_STYLES = {
  HIGH: 'bg-red-500/20 text-red-400 ring-1 ring-red-500/40',
  MEDIUM: 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40',
  LOW: 'bg-gray-500/20 text-gray-400 ring-1 ring-gray-500/40',
}

export default function ImpactPanel({ diffId, onImpactCount }) {
  const [impacts, setImpacts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (!diffId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setImpacts([])

    axios
      .get(`/api/specs/impact/${diffId}`)
      .then((res) => {
        if (cancelled) return
        setImpacts(res.data)
        onImpactCount?.(res.data.length)
      })
      .catch((err) => {
        if (cancelled) return
        setError(
          err.response?.data?.detail || err.message || 'Failed to load impact'
        )
        onImpactCount?.(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [diffId, onImpactCount])

  if (!diffId) return null

  return (
    <div className="border-t border-gray-800">
      {/* Header — click to collapse */}
      <button
        type="button"
        onClick={() => setCollapsed((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-2 bg-gray-900/60 border-b border-gray-800 hover:bg-gray-800/60 transition-colors"
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-3.5 h-3.5 text-gray-500 transition-transform ${collapsed ? '' : 'rotate-180'}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          <h2 className="text-xs font-semibold text-white uppercase tracking-wide">
            Impact Analysis
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {!loading && impacts.length > 0 && (
            <span className="text-xs text-gray-400">
              {impacts.length} service{impacts.length !== 1 ? 's' : ''} affected
            </span>
          )}
          {loading && (
            <svg className="animate-spin w-3 h-3 text-indigo-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
        </div>
      </button>

      {/* States + rows — hidden when collapsed */}
      {!collapsed && loading && impacts.length === 0 && (
        <div className="px-4 py-3 text-xs text-gray-500">Analysing downstream impact…</div>
      )}

      {!collapsed && error && (
        <div className="px-4 py-3 text-xs text-red-400">{error}</div>
      )}

      {!collapsed && !loading && !error && impacts.length === 0 && (
        <div className="px-4 py-3 text-xs text-gray-500">
          No affected services found.
        </div>
      )}

      {/* Impact rows */}
      {!collapsed && impacts.length > 0 && (
        <div className="divide-y divide-gray-800/60">
          {impacts.map((impact) => (
            <div
              key={`${impact.affected_service}-${impact.operation_id}`}
              className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-800/40 transition-colors"
            >
              <div className="min-w-0 mr-3">
                <p className="text-sm font-medium text-white truncate">
                  {impact.affected_service}
                </p>
                <p className="text-xs text-gray-500 truncate mt-0.5">
                  {impact.team}
                  {' · '}
                  <span className="font-mono">{impact.operation_id}</span>
                  {' · '}
                  <span className="text-red-400/80">
                    {impact.breaking_changes.length} breaking
                  </span>
                </p>
              </div>
              <span
                className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  SEVERITY_STYLES[impact.severity] ?? SEVERITY_STYLES.LOW
                }`}
              >
                {impact.severity}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
