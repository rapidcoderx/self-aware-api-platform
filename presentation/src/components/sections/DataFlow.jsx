import { useState, useEffect } from 'react'
import SectionHeader from '../ui/SectionHeader'

const FLOWS = [
  {
    id: 'ingest',
    label: 'Ingest Flow',
    icon: '📥',
    color: '#7c3aed',
    description: 'How an OpenAPI spec becomes searchable, validated knowledge',
    steps: [
      { icon: '📄', label: 'OpenAPI Spec',        sub: 'YAML / JSON uploaded via UI',                  color: '#00d4ff' },
      { icon: '🔧', label: 'Normalizer',           sub: 'prance resolves $refs',                        color: '#7c3aed' },
      { icon: '✂️',  label: 'Text Chunker',         sub: 'endpoint → text chunks',                       color: '#7c3aed' },
      { icon: '🌊', label: 'Voyage AI',            sub: 'voyage-3 · 1024-dim vectors',                  color: '#ffd700' },
      { icon: '🗄',  label: 'pgvector',             sub: 'ivfflat cosine index',                         color: '#2ed573' },
    ],
  },
  {
    id: 'query',
    label: 'Query Flow',
    icon: '🔍',
    color: '#00d4ff',
    description: 'How a natural language question becomes a schema-validated answer',
    steps: [
      { icon: '👤', label: 'User Query',    sub: 'Natural language via React UI',        color: '#f8faff' },
      { icon: '🚀', label: 'FastAPI',       sub: 'chat route → agent orchestrator',       color: '#00d4ff' },
      { icon: '🤖', label: 'Claude Agent',  sub: 'tool_use loop · max 10 iterations',    color: '#7c3aed' },
      { icon: '🔧', label: 'MCP Server',    sub: 'stdio · 5 typed tools dispatched',     color: '#7c3aed' },
      { icon: '🗄',  label: 'pgvector',      sub: 'cosine search · schema lookup',        color: '#2ed573' },
      { icon: '📋', label: 'Audit Log',     sub: 'tool · inputs · outputs · ms',         color: '#ffd700' },
      { icon: '✅', label: 'Answer',        sub: 'schema-validated + provenance',        color: '#2ed573' },
    ],
  },
  {
    id: 'selfheal',
    label: 'Self-Heal Flow',
    icon: '🔄',
    color: '#2ed573',
    description: 'How a breaking change becomes an audited, validated migration plan',
    steps: [
      { icon: '📤', label: 'New Spec',        sub: 'v2 ingested + versioned',              color: '#00d4ff' },
      { icon: '🔀', label: 'diff_specs',      sub: 'BREAKING / NON_BREAKING',             color: '#ff4757' },
      { icon: '💥', label: 'analyze_impact',  sub: 'services · teams · severity',         color: '#ffd700' },
      { icon: '🤖', label: 'Claude Agent',    sub: 'before/after payloads',               color: '#7c3aed' },
      { icon: '✅', label: 'validate',        sub: 'jsonschema on healed payload',        color: '#2ed573' },
      { icon: '📋', label: 'Migration Plan',  sub: 'human-reviewable · audited',          color: '#2ed573' },
    ],
  },
]

export default function DataFlow() {
  const [activeFlow, setActiveFlow] = useState('query')
  const [activeStep, setActiveStep] = useState(-1)

  const flow = FLOWS.find(f => f.id === activeFlow)

  useEffect(() => {
    setActiveStep(-1)
    let s = 0
    const id = setInterval(() => {
      setActiveStep(s)
      s++
      if (s >= flow.steps.length) clearInterval(id)
    }, 600)
    return () => clearInterval(id)
  }, [activeFlow, flow.steps.length])

  return (
    <section id="data-flow" className="relative z-10 h-screen overflow-hidden flex flex-col justify-start pt-16 pb-2 px-6 md:px-12 lg:px-24">
      <div className="max-w-7xl mx-auto w-full">
        {/* ── Compact header + tabs row ── */}
        <div className="flex flex-col items-center mb-3">
          <p className="font-mono text-accent-primary text-xs tracking-widest uppercase mb-1">// FLOWS</p>
          <h2 className="font-display font-black text-3xl md:text-4xl text-gradient-cyan mb-3">Data Flow</h2>
          <div className="flex gap-3 justify-center flex-wrap">
            {FLOWS.map(f => (
              <button
                key={f.id}
                onClick={() => setActiveFlow(f.id)}
                className={`font-mono text-sm px-5 py-2 rounded-xl border transition-all duration-200 ${
                  activeFlow === f.id ? 'font-bold text-space-black' : 'glass text-star-blue hover:text-star-white'
                }`}
                style={activeFlow === f.id
                  ? { background: f.color, borderColor: f.color }
                  : { borderColor: f.color + '40' }}
              >
                {f.icon} {f.label}
              </button>
            ))}
          </div>
          <p className="font-mono text-star-blue/70 text-xs mt-2 tracking-wide">{flow.description}</p>
        </div>

        {/* ── Pipeline — wraps to 2 rows on small screens ── */}
        <div className="flex flex-wrap justify-center items-center gap-y-4">
          {flow.steps.map((step, idx) => {
            const lit = activeStep >= idx
            return (
              <div key={step.label + idx} className="flex items-center">
                {/* Step node */}
                <div
                  className="flex flex-col items-center text-center transition-all duration-500"
                  style={{
                    width: '108px',
                    opacity: lit ? 1 : 0.3,
                    transform: lit ? 'translateY(-3px)' : 'translateY(0)',
                  }}
                >
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mb-1.5 glass transition-all duration-500"
                    style={{
                      border: `2px solid ${lit ? step.color : step.color + '25'}`,
                      boxShadow: lit ? `0 0 18px ${step.color}55` : undefined,
                    }}
                  >
                    <span className="text-xl select-none">{step.icon}</span>
                  </div>
                  <div
                    className="font-mono text-xs font-bold leading-tight mb-0.5 transition-colors duration-300"
                    style={{ color: lit ? step.color : '#a8d8f0' }}
                  >
                    {step.label}
                  </div>
                  <div className="font-mono text-[9px] text-star-blue/50 leading-tight px-1">
                    {step.sub}
                  </div>
                  <div
                    className="w-1.5 h-1.5 rounded-full mt-1.5 transition-all duration-300"
                    style={{
                      background: lit ? step.color : 'transparent',
                      border: `1.5px solid ${step.color}`,
                      boxShadow: lit ? `0 0 5px ${step.color}` : undefined,
                    }}
                  />
                </div>

                {/* Arrow to next */}
                {idx < flow.steps.length - 1 && (
                  <svg width="36" height="14" viewBox="0 0 36 14" className="flex-shrink-0">
                    <line
                      x1="0" y1="7" x2="26" y2="7"
                      stroke={activeStep > idx ? flow.color : '#1e3a5f'}
                      strokeWidth="2"
                      strokeDasharray={activeStep > idx ? 'none' : '4 3'}
                      style={{ transition: 'stroke 0.35s ease' }}
                    />
                    <polygon
                      points="26,3 36,7 26,11"
                      fill={activeStep > idx ? flow.color : '#1e3a5f'}
                      style={{ transition: 'fill 0.35s ease' }}
                    />
                  </svg>
                )}
              </div>
            )
          })}
        </div>

        {/* ── Replay ── */}
        <div className="flex justify-center mt-4">
          <button
            onClick={() => setActiveFlow(activeFlow)}
            className="glass font-mono text-xs text-star-blue px-5 py-2 rounded-xl border border-accent-primary/20 hover:text-accent-primary hover:border-accent-primary/50 transition-colors duration-200"
          >
            ↺ replay
          </button>
        </div>
      </div>
    </section>
  )
}
