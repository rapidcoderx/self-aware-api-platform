function MethodBadge({ method }) {
  const colors = {
    GET: 'bg-green-500/20 text-green-400 ring-green-500/30',
    POST: 'bg-blue-500/20 text-blue-400 ring-blue-500/30',
    PUT: 'bg-amber-500/20 text-amber-400 ring-amber-500/30',
    PATCH: 'bg-orange-500/20 text-orange-400 ring-orange-500/30',
    DELETE: 'bg-red-500/20 text-red-400 ring-red-500/30',
  }
  const cls = colors[method?.toUpperCase()] || 'bg-gray-500/20 text-gray-400 ring-gray-500/30'
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-bold ring-1 ring-inset ${cls}`}>
      {method?.toUpperCase()}
    </span>
  )
}

function ValidBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-400 ring-1 ring-inset ring-green-500/30">
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
      Valid
    </span>
  )
}

function InvalidBadge({ errorCount }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-medium text-red-400 ring-1 ring-inset ring-red-500/30">
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
      </svg>
      {errorCount} {errorCount === 1 ? 'error' : 'errors'}
    </span>
  )
}

export default function ValidationPanel({ validation, endpoint }) {
  if (!validation && !endpoint) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm p-6">
        <svg className="w-10 h-10 mb-3 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p>Endpoint details appear here</p>
        <p className="text-xs text-gray-600 mt-1">Ask a question to get started</p>
      </div>
    )
  }

  const isValid = validation?.isValid ?? false
  const hasErrors = validation?.hasErrors ?? false

  let endpointMethod = null
  let endpointPath = null
  let endpointVersion = null

  if (endpoint?.raw) {
    const match = endpoint.raw.match(/^(\w+)\s+(\S+)\s+\(v(\d+)\)/)
    if (match) {
      endpointMethod = match[1]
      endpointPath = match[2]
      endpointVersion = match[3]
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
        Endpoint Details
      </h2>

      {(endpointMethod || endpointPath) && (
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4 space-y-2">
          <div className="flex items-center gap-2">
            {endpointMethod && <MethodBadge method={endpointMethod} />}
            <span className="font-mono text-sm text-gray-200">{endpointPath}</span>
          </div>
          {endpointVersion && (
            <span className="text-xs text-gray-500">Spec version: v{endpointVersion}</span>
          )}
        </div>
      )}

      {validation && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-300">Validation</h3>
            {isValid && <ValidBadge />}
            {hasErrors && <InvalidBadge errorCount={parseErrorCount(validation.raw)} />}
          </div>

          {isValid && (
            <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4 text-center">
              <p className="text-sm text-green-400">
                Payload validated successfully against the endpoint schema
              </p>
            </div>
          )}

          {hasErrors && (
            <div className="space-y-2">
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                <p className="text-sm text-red-300">{validation.raw}</p>
              </div>
            </div>
          )}

          {!isValid && !hasErrors && validation?.raw && (
            <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-3 text-sm text-gray-400">
              {validation.raw}
            </div>
          )}
        </div>
      )}

      {!endpointMethod && !endpointPath && !validation && endpoint?.raw && (
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4 text-sm text-gray-300">
          {endpoint.raw}
        </div>
      )}
    </div>
  )
}

function parseErrorCount(raw) {
  if (!raw) return 0
  const match = raw.match(/(\d+)\s+errors?/)
  return match ? parseInt(match[1], 10) : 1
}
