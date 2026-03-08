import SectionHeader from '../ui/SectionHeader'

const METRICS = [{ target: 5, label: 'MCP Tools' }, { target: 3, label: 'Demo Scenarios' }, { target: 10, label: 'Responsible AI Guardrails' }]
const CRITERIA = [
  { label: 'Innovation', desc: 'Tool-first MCP architecture' },
  { label: 'Technical Depth', desc: 'pgvector + Claude tool_use + schema validation' },
  { label: 'Responsible AI', desc: '10 built-in guardrails' },
  { label: 'Demo Polish', desc: '3 clean flows, 4 minutes' },
]

export default function CallToAction() {
  return (
    <section id="cta" className="relative min-h-screen z-10 py-24 px-6 md:px-12 lg:px-24 nebula-bg">
      <div className="max-w-7xl mx-auto">
        <SectionHeader title="Why We Win" tag="// JUDGING" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16 text-center">
          {METRICS.map(({ target, label }) => (
            <div key={label} className="glass rounded-2xl p-8">
              <span className="font-display font-black text-6xl text-gradient-cyan glow-text-cyan tabular-nums">{target}</span>
              <p className="font-body text-star-blue mt-2">{label}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-16">
          {CRITERIA.map(({ label, desc }) => (
            <div key={label}
              className="glass-strong rounded-xl p-4 flex items-center gap-4 hover:border-accent-green/40 transition-colors duration-200">
              <span className="text-accent-green text-xl flex-shrink-0">✅</span>
              <div>
                <p className="font-display font-bold text-star-white text-sm">{label}</p>
                <p className="font-body text-star-blue text-xs">{desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center">
          <p className="font-display font-black text-3xl md:text-4xl lg:text-5xl text-gradient-cyan glow-text-cyan mb-6 leading-tight">
            "Self-Aware API Platform.<br />Living infrastructure for the agentic era."
          </p>
          <p className="font-mono text-star-blue/50 text-sm mb-3">
            Built in 48 hours · March 2026
          </p>
          <p className="font-body text-star-blue/40 text-sm flex items-center justify-center gap-2">
            Built with
            <span className="text-accent-red/70 text-base">♥</span>
            using
            <span className="font-mono text-accent-primary/70">Claude</span>
            by
            <span className="font-display font-semibold text-star-white/60">The Autonomous Duo</span>
          </p>
        </div>
      </div>
    </section>
  )
}
