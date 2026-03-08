import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import SectionHeader from '../ui/SectionHeader'

const ROWS = [
  { label: 'Backend', items: [{ icon: '🐍', name: 'Python', version: '3.12.12' }, { icon: '⚡', name: 'FastAPI', version: 'latest' }, { icon: '🐘', name: 'PostgreSQL', version: '16' }, { icon: '🔢', name: 'pgvector', version: '0.8.2' }, { icon: '🔗', name: 'psycopg2', version: 'raw' }] },
  { label: 'AI / Agentic', items: [{ icon: '🤖', name: 'Claude Sonnet', version: '4' }, { icon: '🔧', name: 'MCP SDK', version: 'stdio' }, { icon: '🌊', name: 'Voyage AI', version: 'voyage-3' }, { icon: '📐', name: 'prance', version: '$ref resolver' }, { icon: '✅', name: 'jsonschema', version: 'validation' }] },
  { label: 'Frontend', items: [{ icon: '⚛️', name: 'React', version: '19' }, { icon: '⚡', name: 'Vite', version: '5' }, { icon: '🎨', name: 'Tailwind CSS', version: '3' }, { icon: '🎬', name: 'Framer Motion', version: 'latest' }, { icon: '🎭', name: 'Prism Mock', version: 'port 4010' }] },
]

const WHY = [
  { q: 'Why Claude tool_use?', a: 'Explicit tool contracts, auditable reasoning, no hallucinated endpoints. Every response traces back to a spec.' },
  { q: 'Why pgvector not Pinecone?', a: 'No third-party dependency. pgvector runs in the same Postgres instance as structured data. Simpler and faster.' },
  { q: 'Why Voyage AI?', a: 'voyage-3 outperforms on technical retrieval. 1024d vectors = rich semantic space for API concepts.' },
]

export default function TechStack() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.05 })
  return (
    <section id="tech-stack" className="relative min-h-screen z-10 py-24 px-6 md:px-12 lg:px-24">
      <div className="max-w-7xl mx-auto" ref={ref}>
        <SectionHeader title="Tech Stack" tag="// ENGINEERING" />
        <div className="space-y-8 mb-16">
          {ROWS.map((row, ri) => (
            <div key={row.label}>
              <p className="font-mono text-accent-primary/60 text-xs tracking-widest mb-3 uppercase">{row.label}</p>
              <div className="flex flex-wrap gap-3">
                {row.items.map((item, ii) => (
                  <motion.div key={item.name} initial={{ opacity: 0, scale: 0.9 }} animate={inView ? { opacity: 1, scale: 1 } : {}} transition={{ delay: ri * 0.1 + ii * 0.06 }}
                    whileHover={{ scale: 1.05, y: -2 }} className="glass rounded-xl px-4 py-3 flex items-center gap-2 hover:border-accent-primary/40 hover:shadow-glow-cyan transition-all duration-200">
                    <span className="text-base">{item.icon}</span>
                    <div>
                      <p className="font-mono text-star-white text-xs font-semibold">{item.name}</p>
                      <p className="font-mono text-accent-primary/50 text-xs">{item.version}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.5 }}>
          <p className="font-mono text-accent-primary/60 text-xs tracking-widest mb-4 uppercase">Why this stack?</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {WHY.map(({ q, a }) => (
              <div key={q} className="glass-strong rounded-xl p-5">
                <p className="font-display font-semibold text-star-white text-sm mb-2">{q}</p>
                <p className="font-body text-star-blue text-xs leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
