import SectionHeader from '../ui/SectionHeader'

const LAYERS = [
  { label: 'INPUT',     color: '#00d4ff', items: [{ name: 'OpenAPI / Swagger', icon: '📄' }, { name: 'YAML / JSON', icon: '🗂' }] },
  { label: 'INGESTION', color: '#7c3aed', items: [{ name: 'Normalizer' }, { name: 'Chunker' }, { name: 'Embedder (Voyage AI)' }] },
  { label: 'STORAGE',   color: '#ffd700', items: [{ name: 'Postgres JSONB' }, { name: 'pgvector 1024d' }, { name: 'Change Watcher' }] },
  { label: 'MCP TOOLS', color: '#00d4ff', items: [{ name: 'search' }, { name: 'get' }, { name: 'validate' }, { name: 'diff' }, { name: 'impact' }] },
  { label: 'INTERFACE', color: '#2ed573', items: [{ name: 'Claude Agent (tool_use)' }, { name: 'React UI' }] },
]

export default function Architecture() {
  return (
    <section id="architecture" className="relative min-h-screen z-10 py-24 px-6 md:px-12 lg:px-24">
      <div className="max-w-7xl mx-auto">
        <SectionHeader title="System Architecture" tag="// DESIGN" />
        <div className="space-y-3">
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
      </div>
    </section>
  )
}
