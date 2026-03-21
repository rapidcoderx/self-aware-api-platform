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
    <section id="architecture" className="relative z-10 h-screen overflow-hidden flex flex-col justify-center pt-16 pb-2 px-6 md:px-12 lg:px-24">
      <div className="max-w-7xl mx-auto w-full">
        <SectionHeader title="System Architecture" tag="// DESIGN" />
        <div className="space-y-2">
          {LAYERS.map((layer) => (
            <div key={layer.label}
              className="glass rounded-2xl p-4 md:p-5 flex items-center gap-4 md:gap-6"
              style={{ borderLeft: '3px solid ' + layer.color + '60' }}>
              <div className="flex-shrink-0 w-20 md:w-28">
                <span className="font-mono text-xs tracking-widest" style={{ color: layer.color }}>{layer.label}</span>
              </div>
              <div className="flex flex-wrap gap-2 flex-1">
                {layer.items.map(item => (
                  <div key={item.name} className="glass-strong rounded-xl px-3 md:px-4 py-2 flex items-center gap-2"
                    style={{ borderColor: layer.color + '30' }}>
                    {item.icon && <span className="text-sm">{item.icon}</span>}
                    <span className="font-mono text-xs text-star-white">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {LAYERS.slice(0, -1).map((_, i) => (
            <div key={i} className="flex justify-center -my-1">
              <svg width="24" height="16">
                <line x1="12" y1="0" x2="12" y2="16" stroke="#00d4ff" strokeWidth="1.5" strokeDasharray="3 2" />
                <circle cx="12" cy="8" r="2" fill="#00d4ff" opacity="0.6" />
              </svg>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
