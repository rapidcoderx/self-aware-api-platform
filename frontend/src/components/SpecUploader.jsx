import { useState, useRef, useCallback } from 'react'
import axios from 'axios'

function validateFileType(file) {
  const name = file.name.toLowerCase()
  if (!name.endsWith('.yaml') && !name.endsWith('.yml') && !name.endsWith('.json')) {
    return 'Only .yaml, .yml, or .json files are accepted'
  }
  return null
}

export default function SpecUploader({ onUploaded }) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [uploaded, setUploaded] = useState(null)
  const inputRef = useRef(null)

  const uploadFile = useCallback(
    async (file) => {
      const typeError = validateFileType(file)
      if (typeError) {
        setError(typeError)
        return
      }

      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', file.name.replace(/\.(yaml|yml|json)$/i, ''))

      setLoading(true)
      setError(null)
      setUploaded(null)

      try {
        const res = await axios.post('/api/specs/ingest', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        setUploaded(res.data)
        onUploaded?.(res.data)
      } catch (err) {
        setError(
          err.response?.data?.detail || err.message || 'Upload failed'
        )
      } finally {
        setLoading(false)
      }
    },
    [onUploaded]
  )

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) uploadFile(file)
    },
    [uploadFile]
  )

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => setDragging(false), [])

  const handleFileChange = useCallback(
    (e) => {
      const file = e.target.files[0]
      if (file) uploadFile(file)
      e.target.value = ''
    },
    [uploadFile]
  )

  return (
    <div className="flex flex-col gap-1">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !loading && inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && !loading && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload OpenAPI spec file"
        className={`flex items-center gap-2 rounded-lg border border-dashed px-3 py-1.5 cursor-pointer transition-colors text-xs outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          dragging
            ? 'border-blue-400 bg-blue-500/10 text-blue-300'
            : loading
            ? 'border-gray-700 bg-gray-800/50 text-gray-500 cursor-not-allowed'
            : 'border-gray-600 bg-gray-800/40 text-gray-400 hover:border-gray-400 hover:bg-gray-800/70 hover:text-gray-200'
        }`}
      >
        {loading ? (
          <>
            <svg
              className="animate-spin w-3 h-3 text-blue-400 shrink-0"
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
            <span>Uploading…</span>
          </>
        ) : (
          <>
            <svg
              className="w-3 h-3 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            <span>Upload spec (.yaml / .json)</span>
          </>
        )}

        {uploaded && !loading && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-semibold text-green-400 ring-1 ring-green-500/40 shrink-0">
            {uploaded.name} v{uploaded.version}
          </span>
        )}
      </div>

      {error && <p className="text-xs text-red-400 px-0.5">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept=".yaml,.yml,.json"
        className="hidden"
        onChange={handleFileChange}
        aria-hidden="true"
      />
    </div>
  )
}
