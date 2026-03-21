import { useState, useEffect } from 'react'
import SectionHeader from '../ui/SectionHeader'

const LAYERS = [
  { label: 'INPUT',     color: '#00d4ff', items: [{ name: 'OpenAPI / Swagger', icon: '📄' }, { name: 'YAML / JSON', icon: '🗂' }] },
  { label: 'INGESTION', color: '#7c3aed', items: [{ name: 'Normalizer' }, { name: 'Chunker' }, { name: 'Embedder (Voyage AI)' }] },
  { label: 'STORAGE',   color: '#ffd700', items: [{ name: 'Postgres JSONB' }, { name: 'pgvector 1024d' }, { name: 'Change Watcher' }] },
  { label: 'MCP TOOLS', color: '#00d4ff', items: [{ name: 'search' }, { name: 'get' }, { name: 'validate' }, { name: 'diff' }, { name: 'impact' }] },
  { label: 'INTERFACE', color: '#2ed573', items: [{ name: 'Claude Agent (tool_use)' }, { name: 'React UI' }] },
]

/* ── MCP tool definitions ─────────────────────────────────────────────────── */
const MCP_TOOLS = [
  {
    name: 'search_endpoints',
    sig: 'search_endpoints(query, spec_id, limit=5)',
    desc: 'Embeds query with Voyage AI → cosine search pgvector → returns top-N endpoint summaries',
    color: '#00d4ff',
    icon: '🔍',
    returns: 'list[EndpointSummary]',
  },
  {
    name: 'get_endpoint',
    sig: 'get_endpoint(operation_id, spec_id)',
    desc: 'Fetches full schema_json for one operation — parameters, requestBody, response schemas',
    color: '#7c3aed',
    icon: '📋',
    returns: 'EndpointDetail',
  },
  {
    name: 'validate_request',
    sig: 'validate_request(operation_id, payload, spec_id)',
    desc: 'Extracts requestBody JSON Schema → runs jsonschema.validate() → returns field-level errors',
    color: '#2ed573',
    icon: '✅',
    returns: 'ValidationResult',
  },
  {
    name: 'diff_specs',
    sig: 'diff_specs(old_spec_id, new_spec_id)',
    desc: 'Compares requestBody schemas between two spec versions → classifies BREAKING vs NON_BREAKING',
    color: '#ff4757',
    icon: '🔀',
    returns: 'list[DiffItem]',
  },
  {
    name: 'analyze_impact',
    sig: 'analyze_impact(diff_id)',
    desc: 'Loads dependencies.yaml → maps breaking changes to affected services, teams, and severity',
    color: '#ffd700',
    icon: '💥',
    returns: 'list[ImpactItem]',
  },
]

/* ── Flow definitions (from project-flow.mmd) ────────────────────────────── */
const FLOWS = [
  {
    id: 'ingest',
    label: 'Ingest Flow',
    icon: '📥',
    color: '#7c3aed',
    description: 'How an OpenAPI spec becomes searchable, validated knowledge',
    steps: [
      { icon: '📄', label: 'OpenAPI Spec',          sub: 'YAML / JSON uploaded via UI',                   color: '#00d4ff' },
      { icon: '🔧', label: 'Normalizer',             sub: 'prance resolves $refs → canonical endpoints',   color: '#7c3aed' },
      { icon: '✂️',  label: 'Text Chunker',           sub: 'endpoint → searchable text chunks',             color: '#7c3aed' },
      { icon: '🌊', label: 'Voyage AI Embedder',     sub: 'voyage-3 · 1024-dim vectors per endpoint',      color: '#ffd700' },
      { icon: '🗄',  label: 'PostgreSQL + pgvector',  sub: 'JSONB schema store · ivfflat cosine index',     color: '#2ed573' },
    ],
  },
  {
    id: 'query',
    label: 'Query Flow',
    icon: '🔍',
    color: '#00d4ff',
    description: 'How a natural language question becomes a schema-validated answer',
    steps: [
      { icon: '👤', label: 'User Query',    sub: '"How do I create a corporate deposit account?"', color: '#f8faff' },
      { icon: '⚛️',  label: 'React Frontend', sub: 'Vite 5 · Tailwind CSS · port 5173',            color: '#00d4ff' },
      { icon: '🚀', label: 'FastAPI',        sub: 'chat route → agent orchestrator',               color: '#00d4ff' },
      { icon: '🤖', label: 'Claude Agent',   sub: 'claude-sonnet-4 · tool_use loop · max 10 iter', color: '#7c3aed' },
      { icon: '🔧', label: 'MCP Server',     sub: 'stdio transport · 5 typed tools',              color: '#7c3aed' },
      { icon: '🗄',  label: 'pgvector',       sub: 'cosine similarity search · schema lookup',      color: '#2ed573' },
      { icon: '📋', label: 'Audit Log',      sub: 'tool name · inputs · outputs · duration_ms',   color: '#ffd700' },
    ],
  },
  {
    id: 'selfheal',
    label: 'Self-Heal Flow',
    icon: '🔄',
    color: '#2ed573',
    description: 'How a breaking change becomes an audited migration plan',
    steps: [
      { icon: '📤', label: 'New Spec Upload',  sub: 'banking-api-v2.yaml ingested + versioned',        color: '#00d4ff' },
      { icon: '🔍', label: 'diff_specs',        sub: 'BREAKING · NON_BREAKING change classification',   color: '#ff4757' },
      { icon: '📊', label: 'analyze_impact',    sub: 'affected services · team · severity rating',      color: '#ffd700' },
      { icon: '🤖', label: 'Claude Agent',      sub: 'generates before/after migration payloads',       color: '#7c3aed' },
      { icon: '✅', label: 'validate_request',  sub: 'jsonschema validates the healed payload',         color: '#2ed573' },
      { icon: '📋', label: 'Migration Plan',    sub: 'human-reviewable · every step audit logged',      color: '#2ed573' },
    ],
  },
]

export default function Architecture() {
  const [activeFlow, setActiveFlow] = useState('query')
  const [activeStep, setActiveStep] = useState(-1)
  const [activeTool, setActiveTool] = useState(null)

  const flow = FLOWS.find(f => f.id === activeFlow)

  useEffect(() => {
    setActiveStep(-1)
    let step = 0
    const interval = setInterval(() => {
      setActiveStep(step)
      step++
      if (step >= flow.steps.length) clearInterval(interval)
    }, 550)
    return () => clearInterval(interval)
  }, [activeFlow, flow.steps.length])

  return (
    <section id="architecture" className="relative min-h-screen z-10 pt-14 pb-16 px-6 md:px-12 lg:px-24">
      <div className="max-w-7xl mx-auto">
        <SectionHeader title="System Architecture" tag="// DESIGN" />

        {/* ── Layer stack overview ──────────────────────────────────── */}
        <div className="space-y-3 mb-8">
          {LAYERS.map((layer) => (
            <div key={layer.label}
              className="glass rounded-2xl p-4 md:p-5 flex items-center gap-4 md:gap-6"
              style={{ borderLeft: '3px solid ' + layer.color + '40' }}>
              <div className="flex-shrink-0 w-20 md:w-24">
                <span className="font-mono text-xs tracking-widest" style={{ color: layer.color }}>{layer.label}</span>
              </div>
              <div className="flex flex-wrap gap-2 flex-1">
                {layer.items.map(item => (
                  <div key={item.name} className="glass-strong rounded-xl px-3 md:px-4 py-2 flex items-center gap-2"
                    style={{ borderColor: layer.color + '25' }}>
                    {item.icon && <span className="text-sm">{item.icon}</span>}
                    <span className="font-mono text-xs text-star-white">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {LAYERS.slice(0, -1).map((_, i) => (
            <div key={i} className="flex justify-center -my-1.5">
              <svg width="24" height="20">
                <line x1="12" y1="0" x2="12" y2="20" stroke="#00d4ff" strokeWidth="1.5" strokeDasharray="3 2" />
                <circle cx="12" cy="10" r="2.5" fill="#00d4ff" opacity="0.7" />
              </svg>
            </div>
          ))}
        </div>

        {/* ── MCP Tools grid ───────────────────────────────────────── */}
        <div className="text-center mb-6">
          <p className="font-mono text-accent-primary text-sm tracking-widest uppercase mb-2">// MCP ENFORCEMENT LAYER</p>
          <h3 className="font-display font-bold text-2xl md:text-3xl text-star-white mb-1">5 Typed MCP Tools</h3>
          <p className="font-body text-star-blue text-sm">The agent NEVER hits the DB directly — every action goes through a typed, audited tool</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-24">
          {MCP_TOOLS.map(tool => (
            <button
              key={tool.name}
              onClick={() => setActiveTool(activeTool === tool.name ? null : tool.name)}
              className="glass rounded-2xl p-5 text-left transition-all duration-200 hover:scale-[1.02]"
              style={{
                borderLeft: `3px solid ${tool.color}`,
                boxShadow: activeTool === tool.name ? `0 0 28px ${tool.color}44` : undefined,
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xl">{tool.icon}</span>
                <span className="font-mono text-xs font-semibold" style={{ color: tool.color }}>{tool.name}</span>
              </div>
              <p className="font-mono text-[11px] text-accent-primary/70 mb-2 truncate">{tool.sig}</p>
              <p className="font-body text-xs text-star-blue leading-relaxed">{tool.desc}</p>
              {activeTool === tool.name && (
                <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2">
                  <span className="font-mono text-[10px] text-star-blue">returns</span>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded-md" style={{ background: tool.color + '22', color: tool.color }}>{tool.returns}</span>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* ── Flow diagram ─────────────────────────────────────────── */}
        <div className="text-center mb-10">
          <p className="font-mono text-accent-primary text-sm tracking-widest uppercase mb-2">// DATA FLOWS</p>
          <h3 className="font-display font-bold text-2xl md:text-3xl text-star-white">Step-by-Step Request Paths</h3>
        </div>

        {/* Flow tabs */}
        <div className="flex gap-3 justify-center flex-wrap mb-4">
          {FLOWS.map(f => (
            <button
              key={f.id}
              onClick={() => setActiveFlow(f.id)}
              className={`font-mono text-sm px-5 py-2.5 rounded-xl border transition-all duration-200 ${
                activeFlow === f.id ? 'font-bold text-space-black' : 'glass text-star-blue hover:text-star-white'
              }`}
              style={
                activeFlow === f.id
                  ? { background: f.color, borderColor: f.color }
                  : { borderColor: f.color + '40' }
              }
            >
              {f.icon} {f.label}
            </button>
          ))}
        </div>

        <p className="text-center font-body text-star-blue text-sm mb-10">{flow.description}</p>

        {/* Step nodes + connecting arrows */}
        <div className="max-w-lg mx-auto">
          {flow.steps.map((step, idx) => {
            const lit = activeStep >= idx
            return (
              <div key={step.label + idx}>
                <div
                  className="glass rounded-2xl p-4 flex items-center gap-4 transition-all duration-500"
                  style={{
                    borderLeft: `3px solid ${lit ? step.color : step.color + '30'}`,
                    boxShadow: lit ? `0 0 24px ${step.color}33, inset 0 1px 0 rgba(255,255,255,0.06)` : undefined,
                    transform: lit ? 'translateX(6px)' : 'translateX(0)',
                  }}
                >
                  <span className="text-2xl select-none">{step.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-mono font-semibold text-sm transition-colors duration-300"
                      style={{ color: lit ? step.color : '#a8d8f0' }}
                    >
                      {step.label}
                    </div>
                    <div className="font-mono text-xs mt-0.5 text-star-blue truncate">{step.sub}</div>
                  </div>
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all duration-300"
                    style={{
                      background: lit ? step.color : 'transparent',
                      border: `1.5px solid ${step.color}`,
                      boxShadow: lit ? `0 0 6px ${step.color}` : undefined,
                    }}
                  />
                </div>

                {idx < flow.steps.length - 1 && (
                  <div className="flex justify-center my-0.5">
                    <svg width="20" height="28" viewBox="0 0 20 28">
                      <line
                        x1="10" y1="0" x2="10" y2="20"
                        stroke={activeStep > idx ? flow.color : '#1e3a5f'}
                        strokeWidth="2"
                        style={{ transition: 'stroke 0.4s ease' }}
                      />
                      <polygon
                        points="5,17 15,17 10,26"
                        fill={activeStep > idx ? flow.color : '#1e3a5f'}
                        style={{ transition: 'fill 0.4s ease' }}
                      />
                    </svg>
                  </div>
                )}
              </div>
            )
          })}

          <div className="flex justify-center mt-8">
            <button
              onClick={() => setActiveFlow(activeFlow)}
              className="glass font-mono text-xs text-star-blue px-4 py-2 rounded-xl border border-accent-primary/20 hover:text-accent-primary hover:border-accent-primary/50 transition-colors duration-200"
            >
              ↺ replay
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
