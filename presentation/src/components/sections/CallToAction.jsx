import SectionHeader from '../ui/SectionHeader'

const METRICS = [{ target: 5, label: 'MCP Tools Shipped' }, { target: 3, label: 'End-to-End Demo Flows' }, { target: 48, label: 'Hours to Build' }]
const ACHIEVED = [
  { icon: '🔧', label: 'Tool-First Agent Pattern', desc: 'Hand-rolled Claude tool_use loop — no LangChain, no magic. Every reasoning step is visible and auditable.' },
  { icon: '🔍', label: 'Semantic API Search', desc: 'Voyage AI embeddings + pgvector cosine search. Natural language → correct endpoint, schema-validated.' },
  { icon: '⚠️', label: 'Breaking Change Detection', desc: 'Spec diff at upload time, not in production. REQUIRED_ADDED, ENUM_CHANGED, TYPE_CHANGED — all classified.' },
  { icon: '🛡', label: 'Responsible AI by Design', desc: 'Schema validation on every tool output. Human-in-the-loop migration. Full audit log. Sandbox mode enforced.' },
]

export default function CallToAction() {
  return (
    <section id="cta" className="relative z-10 flex flex-col justify-center pt-16 pb-2 px-6 md:px-12 lg:px-24 nebula-bg">
      <div className="max-w-7xl mx-auto">
        <SectionHeader title="What We Built" tag="// WHAT'S UNIQUE" subtitle="48 hours. A working agentic API intelligence system — not a prototype." />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6 text-center">
          {METRICS.map(({ target, label }) => (
            <div key={label} className="glass rounded-2xl p-8">
              <span className="font-display font-black text-6xl text-gradient-cyan glow-text-cyan tabular-nums">{target}</span>
              <p className="font-body text-star-blue mt-2">{label}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          {ACHIEVED.map(({ icon, label, desc }) => (
            <div key={label}
              className="glass-strong rounded-xl p-5 flex items-start gap-4 hover:border-accent-primary/30 transition-colors duration-200">
              <span className="text-2xl flex-shrink-0 mt-0.5">{icon}</span>
              <div>
                <p className="font-display font-bold text-star-white text-sm mb-1">{label}</p>
                <p className="font-body text-star-blue text-xs leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center">
          <p className="font-display font-black text-3xl md:text-4xl lg:text-5xl text-gradient-cyan glow-text-cyan mb-6 leading-tight">
            "API specs as living infrastructure —<br />observable, validated, self-healing."
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
          <p className="font-mono text-star-blue/30 text-xs mt-3">
            <a href="https://github.com/rapidcoderx/self-aware-api-platform" target="_blank" rel="noopener noreferrer"
              className="hover:text-accent-primary/70 transition-colors duration-200">
              github.com/rapidcoderx/self-aware-api-platform ↗
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}
