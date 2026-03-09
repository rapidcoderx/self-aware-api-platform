import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'

function formatTimestamp(ts) {
  if (!ts) return '—'
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return ts
  }
}

function summariseInputs(inputs) {
  if (!inputs || typeof inputs !== 'object') return '—'
  const entries = Object.entries(inputs)
  if (entries.length === 0) return '—'
  return entries
    .map(([k, v]) => {
      if (typeof v === 'string') {
        const truncated = v.length > 28 ? v.slice(0, 28) + '…' : v
        return `${k}="${truncated}"`
      }
      const str = JSON.stringify(v)
      return `${k}=${str.length > 20 ? str.slice(0, 20) + '…' : str}`
    })
    .join(', ')
}

export default function AuditLogModal({ open, onClose }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const doFetch = useCallback(async (signal) => {
    setLoading(true)
    setError(null)
    try {
      const res = await axios.get('/api/audit-logs?limit=20', signal ? { signal } : {})
      setLogs(res.data)
    } catch (err) {
      if (!axios.isCancel(err)) {
        setError(err.response?.data?.detail || err.message || 'Failed to load audit logs')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchLogs = useCallback(() => { doFetch() }, [doFetch])

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    doFetch(controller.signal)
    return () => controller.abort()
  }, [open, doFetch])

  // Close on Escape key
  useEffect(() => {
    if (!open) return
    const handler = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-3xl bg-gray-900 border border-gray-700 rounded-xl shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-white">Audit Log</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Every MCP tool call — last 20 entries
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchLogs}
              disabled={loading}
              className="rounded-md border border-gray-700 px-2.5 py-1 text-xs text-gray-300 hover:bg-gray-800 disabled:opacity-40 transition-colors"
              aria-label="Refresh audit log"
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-colors"
              aria-label="Close audit log"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && logs.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-12 text-gray-500 text-sm">
              <svg
                className="animate-spin w-4 h-4 text-indigo-400"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Loading…
            </div>
          )}

          {error && (
            <div className="px-5 py-4 text-sm text-red-400">{error}</div>
          )}

          {!loading && !error && logs.length === 0 && (
            <div className="px-5 py-12 text-center text-gray-500 text-sm">
              No audit log entries yet.
              <br />
              <span className="text-xs text-gray-600 mt-1 block">
                Run a chat query or compare specs to populate this log.
              </span>
            </div>
          )}

          {logs.length > 0 && (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-900 border-b border-gray-800">
                <tr>
                  <th className="text-left px-4 py-2.5 text-gray-400 font-medium w-8">#</th>
                  <th className="text-left px-4 py-2.5 text-gray-400 font-medium">Tool</th>
                  <th className="text-left px-4 py-2.5 text-gray-400 font-medium">Inputs</th>
                  <th className="text-right px-4 py-2.5 text-gray-400 font-medium w-16">ms</th>
                  <th className="text-right px-4 py-2.5 text-gray-400 font-medium w-24">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/70">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="px-4 py-2 text-gray-600 font-mono">{log.id}</td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center rounded-full bg-indigo-500/15 px-2 py-0.5 font-mono text-indigo-300 ring-1 ring-indigo-500/25">
                        {log.tool_name}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-400 font-mono truncate max-w-[200px]">
                      {summariseInputs(log.inputs)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-gray-300">
                      {log.duration_ms}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-500">
                      {formatTimestamp(log.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
