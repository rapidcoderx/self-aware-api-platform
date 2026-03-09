import { useState } from 'react'
import axios from 'axios'

function PayloadBox({ label, payload, valid, errors, tint }) {
  const borderColor = tint === 'red' ? 'border-red-500/40' : 'border-green-500/40'
  const bgColor = tint === 'red' ? 'bg-red-500/5' : 'bg-green-500/5'
  const labelColor = tint === 'red' ? 'text-red-400' : 'text-green-400'

  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} p-3 space-y-2`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs font-semibold uppercase tracking-wide ${labelColor}`}>
          {label}
        </span>
        {valid === true && (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-500/20 px-2.5 py-0.5 text-xs font-semibold text-green-400 ring-1 ring-green-500/40">
            ✓ Valid
          </span>
        )}
        {valid === false && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-semibold text-red-400 ring-1 ring-red-500/40">
            ✗ Invalid
          </span>
        )}
      </div>

      <pre className="text-xs font-mono text-gray-200 overflow-x-auto whitespace-pre-wrap break-words leading-relaxed">
        {JSON.stringify(payload, null, 2)}
      </pre>

      {valid === false && errors && errors.length > 0 && (
        <ul className="space-y-1">
          {errors.map((e, i) => (
            <li key={i} className="text-xs text-red-300">
              <span className="font-mono text-red-400">{e.field}</span>: {e.message}
              {e.hint && <span className="text-gray-500"> — {e.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function MigrationPanel({ diffData }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [plan, setPlan] = useState(null)
  const [showApplyDialog, setShowApplyDialog] = useState(false)

  // Auto-select first breaking operation from the diff
  const firstBreaking = diffData?.diffs?.find((d) => d.breaking)
  const operationId = firstBreaking?.operation_id ?? null

  if (!diffData || !operationId || !diffData.old_spec_id || !diffData.new_spec_id) return null

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    setPlan(null)
    try {
      const res = await axios.post('/api/agent/self-heal', {
        old_spec_id: diffData.old_spec_id,
        new_spec_id: diffData.new_spec_id,
        operation_id: operationId,
      })
      setPlan(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Self-heal failed')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    if (!plan) return
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `migration-plan-${operationId}-v${diffData.old_spec_id}-to-v${diffData.new_spec_id}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="border-t border-gray-800 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white">Self-Heal Migration</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Targeting operation:{' '}
            <span className="font-mono text-indigo-300">{operationId}</span>
          </p>
        </div>
        {!plan && (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="shrink-0 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 text-xs font-semibold text-white transition-colors"
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating…
              </span>
            ) : (
              'Generate Migration Plan'
            )}
          </button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-md bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="text-xs text-gray-400 flex items-center gap-2">
          <svg className="animate-spin h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Claude is generating a validated migration plan…
        </div>
      )}

      {/* Plan results */}
      {plan && (
        <div className="space-y-3">
          {/* Before payload */}
          <PayloadBox
            label="Before — Invalid for new spec"
            payload={plan.before_payload}
            valid={plan.before_validation?.valid}
            errors={plan.before_validation?.errors}
            tint="red"
          />

          {/* After payload */}
          <PayloadBox
            label="After — Valid for new spec"
            payload={plan.after_payload}
            valid={plan.after_validation?.valid}
            errors={plan.after_validation?.errors}
            tint="green"
          />

          {/* Migration steps */}
          {plan.migration_steps && plan.migration_steps.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
                Migration Steps
              </h4>
              <ol className="space-y-1.5 list-none">
                {plan.migration_steps.map((step, i) => (
                  <li key={i} className="flex gap-2 text-xs text-gray-300">
                    <span className="shrink-0 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 font-semibold text-[10px]">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleExport}
              className="rounded-md bg-gray-700 hover:bg-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-200 transition-colors"
            >
              Export as JSON
            </button>
            <button
              type="button"
              onClick={() => setShowApplyDialog(true)}
              className="rounded-md bg-green-700/60 hover:bg-green-600/60 px-3 py-1.5 text-xs font-semibold text-green-200 transition-colors"
            >
              Apply Migration
            </button>
            <button
              type="button"
              onClick={() => setPlan(null)}
              className="rounded-md bg-gray-800 hover:bg-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-400 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Apply confirmation dialog */}
      {showApplyDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl bg-gray-900 border border-gray-700 shadow-2xl p-5 space-y-4 mx-4">
            <h3 className="text-sm font-semibold text-white">Apply Migration?</h3>
            <p className="text-xs text-gray-400">
              This is a human-in-the-loop checkpoint. Applying this migration plan will update
              your API clients to use the new payload format. Review the migration steps before
              proceeding.
            </p>
            <p className="text-xs text-amber-400">
              In this sandbox demo, no production systems are modified.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowApplyDialog(false)}
                className="rounded-md bg-gray-700 hover:bg-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setShowApplyDialog(false)}
                className="rounded-md bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
              >
                Confirm (Sandbox)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
