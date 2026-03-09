import { useState, useEffect } from 'react'
import axios from 'axios'

function GuardrailItem({ label, active, description }) {
  return (
    <div className="flex items-start gap-2">
      <span
        className={`mt-0.5 shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full text-xs font-bold leading-none ${
          active
            ? 'bg-green-500/25 text-green-400 ring-1 ring-green-500/40'
            : 'bg-gray-700/80 text-gray-500 ring-1 ring-gray-600/60'
        }`}
      >
        {active ? '✓' : '○'}
      </span>
      <div className="min-w-0">
        <p
          className={`text-xs font-medium leading-tight ${
            active ? 'text-white' : 'text-gray-500'
          }`}
        >
          {label}
        </p>
        {description && (
          <p className="text-xs text-gray-600 mt-0.5 leading-snug">{description}</p>
        )}
      </div>
    </div>
  )
}

export default function ResponsibleAIPanel({
  specId,
  lastProvenance,
  diffData,
}) {
  const [sandboxActive, setSandboxActive] = useState(true)
  const [auditLogActive, setAuditLogActive] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // Read sandbox mode from /health
  useEffect(() => {
    let cancelled = false
    axios
      .get('/health')
      .then((res) => {
        if (!cancelled) setSandboxActive(res.data.environment !== 'production')
      })
      .catch(() => {
        if (!cancelled) setSandboxActive(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Check if audit log has any entries — run once on mount only
  useEffect(() => {
    let cancelled = false
    axios
      .get('/api/audit-logs?limit=1')
      .then((res) => {
        if (!cancelled) setAuditLogActive(Array.isArray(res.data) && res.data.length > 0)
      })
      .catch(() => {
        if (!cancelled) setAuditLogActive(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const guardrails = [
    {
      label: 'Sandbox Mode Active',
      active: sandboxActive,
      description: 'All API calls route to Prism mock, not production',
    },
    {
      label: 'Schema Validation Enforced',
      active: specId != null,
      description: 'Every agent answer validated against OpenAPI schema',
    },
    {
      label: 'Provenance on Every Answer',
      active: lastProvenance != null,
      description: 'Spec version and operationId cited in every response',
    },
    {
      label: 'Human-in-the-Loop for Migration',
      active: true,
      description: 'Self-heal output requires explicit confirmation',
    },
    {
      label: 'Audit Log Active',
      active: auditLogActive,
      description: 'All MCP tool calls logged with inputs, outputs, duration',
    },
    {
      label: 'Breaking Changes Explained',
      active: diffData != null && diffData.breaking_count != null,
      description: 'Breaking vs non-breaking changes surfaced with labels',
    },
  ]

  const activeCount = guardrails.filter((g) => g.active).length
  const allActive = activeCount === guardrails.length

  return (
    <div className="border-t border-gray-800 bg-gray-900/40 shrink-0">
      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-800/40 transition-colors"
        aria-expanded={!collapsed}
        aria-label="Toggle Responsible AI panel"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white">Responsible AI</span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
              allActive
                ? 'bg-green-500/15 text-green-400 ring-green-500/30'
                : 'bg-amber-500/15 text-amber-400 ring-amber-500/30'
            }`}
          >
            {activeCount}/{guardrails.length} active
          </span>
        </div>
        <svg
          className={`w-3.5 h-3.5 text-gray-500 transition-transform ${
            collapsed ? '' : 'rotate-180'
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {!collapsed && (
        <div className="px-4 pb-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
          {guardrails.map((g) => (
            <GuardrailItem key={g.label} {...g} />
          ))}
        </div>
      )}
    </div>
  )
}
