import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import SectionHeader from '../ui/SectionHeader'

const LAYERS = [
  { label: 'INPUT',     color: '#00d4ff', items: [{ name: 'OpenAPI / Swagger', icon: '📄' }, { name: 'YAML / JSON', icon: '🗂' }] },
  { label: 'INGESTION', color: '#7c3aed', items: [{ name: 'Normalizer' }, { name: 'Chunker' }, { name: 'Embedder (Voyage AI)' }] },
  { label: 'STORAGE',   color: '#ffd700', items: [{ name: 'Postgres JSONB' }, { name: 'pgvector 1024d' }, { name: 'Change Watcher' }] },
  { label: 'MCP TOOLS', color: '#00d4ff', items: [{ name: 'search' }, { name: 'get' }, { name: 'validate' }, { name: 'diff' }, { name: 'impact' }] },
  { label: 'INTERFACE', color: '#2ed573', items: [{ name: 'Claude Agent (tool_use)' }, { name: 'React UI' }] },
]

export default function Architecture() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.05 })
  return (
    <section id="architecture" className="relative min-h-screen z-10 py-24 px-6 md:px-12 lg:px-24">
      <div className="max-w-7xl mx-auto">
        <SectionHeader title="System Architecture" tag="// DESIGN" />
        <div ref={ref} className="space-y-3">
          {LAYERS.map((layer, i) => (
            <motion.div key={layer.label} initial={{ opacity: 0, x: -40 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.5, delay: i * 0.12 }}
              className="glass rounded-2xl p-4 md:p-5 flex items-center gap-4 md:gap-6" style={{ borderLeft: `3px solid ${layer.color}40` }}>
              <div className="flex-shrink-0 w-20 md:w-24">
                <span className="font-mono text-xs tracking-widest" style={{ color: layer.color }}>{layer.label}</span>
              </div>
              <div className="flex flex-wrap gap-2 flex-1">
                {layer.items.map(item => (
                  <div key={item.name} className="glass-strong rounded-xl px-3 md:px-4 py-2 flex items-center gap-2" style={{ borderColor: `${layer.color}25` }}>
                    {item.icon && <span className="text-sm">{item.icon}</span>}
                    <span className="font-mono text-xs text-star-white">{item.name}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
          {LAYERS.slice(0, -1).map((_, i) => (
            <motion.div key={i} initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ delay: i * 0.12 + 0.3 }} className="flex justify-center -my-1.5">
              <svg width="24" height="20">
                <line x1="12" y1="0" x2="12" y2="20" stroke="#00d4ff" strokeWidth="1.5" strokeDasharray="3 2" />
                <circle cx="12" cy="10" r="2.5" fill="#00d4ff" opacity="0.8">
                  <animate attributeName="cy" values={`2;18;2`} dur={`${1.5 + i * 0.2}s`} repeatCount="indefinite" />
                </circle>
              </svg>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
