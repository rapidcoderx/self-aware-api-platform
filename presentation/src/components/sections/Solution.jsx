import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import SectionHeader from '../ui/SectionHeader'

const PILLARS = [
  { icon: '🔭', title: 'Tool-First Intelligence', desc: 'Agent only acts through typed MCP tools. Never guesses. Every recommendation traces back to a spec.' },
  { icon: '⚡', title: 'Change Detection', desc: 'Breaking changes caught at spec upload, not in production. Classified and attributed automatically.' },
  { icon: '🛠', title: 'Self-Healing', desc: 'Validated migration plans generated and reviewed before applying. Advisory only — humans decide.' },
]

const FLOW = ['OpenAPI Spec', 'Ingestion', 'Vector Index', 'MCP Tools', 'Agent', 'Validated Answer']

export default function Solution() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 })
  const { ref: flowRef, inView: flowIn } = useInView({ triggerOnce: true, threshold: 0.2 })
  return (
    <section id="solution" className="relative min-h-screen z-10 py-24 px-6 md:px-12 lg:px-24">
      <div className="max-w-7xl mx-auto">
        <SectionHeader title="The Solution" tag="// APPROACH" />
        <motion.p ref={ref} initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          className="font-display text-2xl md:text-3xl text-center italic text-gradient-gold mb-16 max-w-3xl mx-auto">
          "Turn API specs into living infrastructure — observable, validated, and self-healing."
        </motion.p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {PILLARS.map((p, i) => (
            <motion.div key={p.title} initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay: i * 0.15 }}
              whileHover={{ y: -4 }} className="glass-strong rounded-2xl p-8 text-center hover:border-accent-primary/40 transition-all duration-300">
              <div className="text-4xl mb-4">{p.icon}</div>
              <h3 className="font-display font-bold text-star-white text-xl mb-3">{p.title}</h3>
              <p className="font-body text-star-blue text-sm leading-relaxed">{p.desc}</p>
            </motion.div>
          ))}
        </div>
        <motion.div ref={flowRef} initial={{ opacity: 0 }} animate={flowIn ? { opacity: 1 } : {}} transition={{ duration: 0.8 }}
          className="flex flex-wrap items-center justify-center gap-0">
          {FLOW.map((step, i) => (
            <div key={step} className="flex items-center">
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={flowIn ? { opacity: 1, scale: 1 } : {}} transition={{ delay: i * 0.1 + 0.2 }}
                className="glass rounded-xl px-4 py-2 border-accent-primary/20">
                <span className="font-mono text-xs text-accent-primary">{step}</span>
              </motion.div>
              {i < FLOW.length - 1 && (
                <svg width="40" height="16" className="flex-shrink-0">
                  <line x1="0" y1="8" x2="32" y2="8" stroke="#00d4ff" strokeWidth="1.5" strokeDasharray="4 3"
                    style={flowIn ? { animation: `dashFlow 1.5s linear ${i * 0.15}s infinite` } : {}} />
                  <polygon points="32,4 40,8 32,12" fill="#00d4ff" opacity="0.7" />
                </svg>
              )}
            </div>
          ))}
        </motion.div>
      </div>
      <style>{`@keyframes dashFlow { from { stroke-dashoffset: 14; } to { stroke-dashoffset: 0; } }`}</style>
    </section>
  )
}
