import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import ChatPanel from './components/ChatPanel'
import ValidationPanel from './components/ValidationPanel'

export default function App() {
  const [specId, setSpecId] = useState(null)
  const [specs, setSpecs] = useState([])
  const [specsLoading, setSpecsLoading] = useState(true)
  const [specsError, setSpecsError] = useState(null)
  const [sandboxMode, setSandboxMode] = useState(true)
  const [lastValidation, setLastValidation] = useState(null)
  const [lastEndpoint, setLastEndpoint] = useState(null)

  useEffect(() => {
    let cancelled = false
    setSpecsLoading(true)
    setSpecsError(null)
    axios.get('/api/specs').then((res) => {
      if (cancelled) return
      setSpecs(res.data)
      if (res.data.length > 0 && specId === null) setSpecId(res.data[res.data.length - 1].id)
      setSpecsLoading(false)
    }).catch((err) => {
      if (cancelled) return
      setSpecsError(err.response?.data?.detail || err.message || 'Failed to load specs')
      setSpecsLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    axios.get('/health').then((res) => {
      if (!cancelled) setSandboxMode(res.data.environment !== 'production')
    }).catch(() => {
      if (!cancelled) setSandboxMode(true)
    })
    return () => { cancelled = true }
  }, [])

  const handleChatResult = useCallback((result) => {
    if (result.validation) setLastValidation(result.validation)
    if (result.endpoint) setLastEndpoint(result.endpoint)
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-white tracking-tight">Self-Aware API Platform</h1>
          {sandboxMode && (
            <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-medium text-amber-400 ring-1 ring-inset ring-amber-500/30">
              SANDBOX
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {specsLoading ? (
            <span className="text-xs text-gray-500">Loading specs&hellip;</span>
          ) : specsError ? (
            <span className="text-xs text-red-400">{specsError}</span>
          ) : specs.length === 0 ? (
            <span className="text-xs text-gray-500">No specs — POST /api/specs/ingest to add one</span>
          ) : (
            <select
              value={specId || ''}
              onChange={(e) => setSpecId(Number(e.target.value))}
              className="rounded-md bg-gray-800 border border-gray-700 text-sm text-gray-200 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {specs.map((s) => (
                <option key={s.id} value={s.id}>{s.name} v{s.version}</option>
              ))}
            </select>
          )}
        </div>
      </header>
      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 min-w-0 border-r border-gray-800">
          <ChatPanel specId={specId} onResult={handleChatResult} />
        </div>
        <div className="w-[420px] shrink-0 overflow-y-auto">
          <ValidationPanel validation={lastValidation} endpoint={lastEndpoint} />
        </div>
      </main>
    </div>
  )
}
