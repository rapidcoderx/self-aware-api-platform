import SectionHeader from '../ui/SectionHeader'

const PILLARS = [
  { icon: '🔭', title: 'Tool-First Intelligence', desc: 'Agent only acts through typed MCP tools. Never guesses. Every recommendation traces back to a spec.' },
  { icon: '⚡', title: 'Change Detection', desc: 'Breaking changes caught at spec upload, not in production. Classified and attributed automatically.' },
  { icon: '🛠', title: 'Self-Healing', desc: 'Validated migration plans generated and reviewed before applying. Advisory only — humans decide.' },
]

const FLOW = ['OpenAPI Spec', 'Ingestion', 'Vector Index', 'MCP Tools', 'Agent', 'Validated Answer']

export default function Solution() {
  return (
    <section id="solution" className="relative min-h-screen z-10 py-24 px-6 md:px-12 lg:px-24">
      <div className="max-w-7xl mx-auto">
        <SectionHeader title="The Solution" tag="// APPROACH" />
        <p className="font-display text-2xl md:text-3xl text-center italic text-gradient-gold mb-16 max-w-3xl mx-auto">
          "Turn API specs into living infrastructure — observable, validated, and self-healing."
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {PILLARS.map((p) => (
            <div key={p.title}
              className="glass-strong rounded-2xl p-8 text-center hover:border-accent-primary/40 transition-colors duration-200">
              <div className="text-4xl mb-4">{p.icon}</div>
              <h3 className="font-display font-bold text-star-white text-xl mb-3">{p.title}</h3>
              <p className="font-body text-star-blue text-sm leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-0">
          {FLOW.map((step, i) => (
            <div key={step} className="flex items-center">
              <div className="glass rounded-xl px-4 py-2 border-accent-primary/20">
                <span className="font-mono text-xs text-accent-primary">{step}</span>
              </div>
              {i < FLOW.length - 1 && (
                <svg width="40" height="16" className="flex-shrink-0">
                  <line x1="0" y1="8" x2="32" y2="8" stroke="#00d4ff" strokeWidth="1.5" strokeDasharray="4 3" />
                  <polygon points="32,4 40,8 32,12" fill="#00d4ff" opacity="0.7" />
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
