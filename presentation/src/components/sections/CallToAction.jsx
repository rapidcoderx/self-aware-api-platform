import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import SectionHeader from '../ui/SectionHeader'
import AnimatedCounter from '../ui/AnimatedCounter'

const METRICS = [{ target: 5, label: 'MCP Tools' }, { target: 3, label: 'Demo Scenarios' }, { target: 10, label: 'Responsible AI Guardrails' }]
const CRITERIA = [
  { label: 'Innovation', desc: 'Tool-first MCP architecture' },
  { label: 'Technical Depth', desc: 'pgvector + Claude tool_use + schema validation' },
  { label: 'Responsible AI', desc: '10 built-in guardrails' },
  { label: 'Demo Polish', desc: '3 clean flows, 4 minutes' },
]

export default function CallToAction() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 })
  return (
    <section id="cta" className="relative min-h-screen z-10 py-24 px-6 md:px-12 lg:px-24 nebula-bg">
      <div className="max-w-7xl mx-auto" ref={ref}>
        <SectionHeader title="Why We Win" tag="// JUDGING" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16 text-center">
          {METRICS.map(({ target, label }) => (
            <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }} className="glass rounded-2xl p-8">
              <AnimatedCounter target={target} />
              <p className="font-body text-star-blue mt-2">{label}</p>
            </motion.div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-16">
          {CRITERIA.map(({ label, desc }, i) => (
            <motion.div key={label} initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ delay: 0.2 + i * 0.1 }}
              className="glass-strong rounded-xl p-4 flex items-center gap-4 hover:border-accent-green/40 hover:shadow-[0_0_20px_rgba(46,213,115,0.15)] transition-all">
              <span className="text-accent-green text-xl flex-shrink-0">✅</span>
              <div>
                <p className="font-display font-bold text-star-white text-sm">{label}</p>
                <p className="font-body text-star-blue text-xs">{desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.6 }} className="text-center">
          <p className="font-display font-black text-3xl md:text-4xl lg:text-5xl text-gradient-cyan glow-text-cyan mb-6 leading-tight">
            "Self-Aware API Platform.<br />Living infrastructure for the agentic era."
          </p>
          <motion.p initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ delay: 0.9 }} className="font-mono text-star-blue/50 text-sm mb-3">
            Built in 48 hours · March 2026
          </motion.p>
          <motion.p initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ delay: 1.1 }} className="font-body text-star-blue/40 text-sm flex items-center justify-center gap-2">
            Built with
            <span className="text-accent-red/70 text-base">♥</span>
            using
            <span className="font-mono text-accent-primary/70">Claude</span>
            by
            <span className="font-display font-semibold text-star-white/60">The Autonomous Duo</span>
          </motion.p>
          <div className="mt-16 flex justify-center gap-8 opacity-30" aria-hidden>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="w-1 h-1 rounded-full bg-accent-primary"
                style={{ animation: `twinkle ${2 + (i % 4) * 0.5}s ${i * 0.3}s ease-in-out infinite` }} />
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
