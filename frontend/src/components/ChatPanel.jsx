import { useState, useRef, useEffect, useCallback } from 'react'
import axios from 'axios'

function ToolChip({ call }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-md border border-gray-700 bg-gray-800/60 text-xs">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-gray-800 transition-colors text-left"
      >
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400" />
          <span className="font-medium text-gray-300">{call.tool_name}</span>
        </span>
        <svg
          className={`w-3.5 h-3.5 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="px-3 py-2 border-t border-gray-700 space-y-1">
          <div>
            <span className="text-gray-500">Inputs: </span>
            <span className="text-gray-300 break-all">{JSON.stringify(call.inputs)}</span>
          </div>
          <div>
            <span className="text-gray-500">Result: </span>
            <span className="text-gray-300 break-all">{call.result_summary}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function ProvenanceBadge({ provenance }) {
  if (!provenance) return null
  return (
    <div className="inline-flex items-center gap-1.5 rounded-md bg-indigo-500/15 px-2.5 py-1 text-xs ring-1 ring-inset ring-indigo-500/30">
      <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="text-indigo-300 font-medium">
        {provenance.spec_name} v{provenance.spec_version}
      </span>
      <span className="text-indigo-400/70">&middot;</span>
      <span className="text-indigo-300/80 font-mono">{provenance.operation_id}</span>
    </div>
  )
}

function MessageBubble({ msg }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-lg bg-blue-600 px-4 py-2.5 text-sm text-white">
          {msg.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] space-y-2">
        {msg.provenance && <ProvenanceBadge provenance={msg.provenance} />}

        {msg.tool_calls && msg.tool_calls.length > 0 && (
          <div className="space-y-1">
            {msg.tool_calls.map((tc, i) => (
              <ToolChip key={`${tc.tool_name}-${i}`} call={tc} />
            ))}
          </div>
        )}

        <div className="rounded-lg bg-gray-800 px-4 py-2.5 text-sm text-gray-200 whitespace-pre-wrap">
          {msg.content}
        </div>
      </div>
    </div>
  )
}

export default function ChatPanel({ specId, onResult }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  const canSend = input.trim().length > 0

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || loading || !specId) return

    const userMsg = { id: `msg-${Date.now()}`, role: 'user', content: trimmed }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const res = await axios.post('/api/chat', {
        message: trimmed,
        spec_id: specId,
      })

      const data = res.data
      const assistantMsg = {
        id: `msg-${Date.now()}-a`,
        role: 'assistant',
        content: data.answer,
        tool_calls: data.tool_calls || [],
        provenance: data.provenance || null,
      }
      setMessages((prev) => [...prev, assistantMsg])

      if (onResult) {
        const validationCall = (data.tool_calls || []).find(
          (tc) => tc.tool_name === 'spec_validate_request'
        )
        const endpointCall = (data.tool_calls || []).find(
          (tc) => tc.tool_name === 'spec_get_endpoint'
        )
        onResult({
          validation: validationCall ? {
            raw: validationCall.result_summary,
            isValid: validationCall.result_summary.startsWith('valid=True'),
            hasErrors: validationCall.result_summary.startsWith('valid=False'),
          } : null,
          endpoint: endpointCall ? { raw: endpointCall.result_summary } : null,
        })
      }
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Something went wrong'
      setError(detail)
    } finally {
      setLoading(false)
    }
  }, [input, loading, specId, onResult])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm">
            <p className="text-lg mb-1">Ask about your API</p>
            <p>e.g. &quot;How do I create a corporate deposit account?&quot;</p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-gray-800 px-4 py-2.5 text-sm text-gray-400">
              <span className="inline-flex gap-1">
                <span className="animate-pulse">&bull;</span>
                <span className="animate-pulse" style={{ animationDelay: '0.2s' }}>&bull;</span>
                <span className="animate-pulse" style={{ animationDelay: '0.4s' }}>&bull;</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mx-4 mb-2 rounded-md bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="border-t border-gray-800 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={specId ? 'Ask about your API\u2026' : 'Select a spec first'}
            disabled={!specId || loading}
            className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={!specId || loading || !canSend}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
