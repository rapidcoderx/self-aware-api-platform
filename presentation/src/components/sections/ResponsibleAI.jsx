import SectionHeader from '../ui/SectionHeader'

const PRINCIPLES = [
  { icon: '🔒', label: 'Schema Validation Required', desc: 'Every tool output is validated against a Pydantic model before it reaches the agent.' },
  { icon: '📍', label: 'Provenance on Every Answer', desc: 'All responses include spec version and operationId. No answer without attribution.' },
  { icon: '🧑', label: 'Human-in-the-Loop Migration', desc: 'Self-healing plans are advisory. A human must review and approve before any change.' },
  { icon: '👁', label: 'Transparent Tool Calls', desc: 'Every MCP tool call is visible in the UI with inputs and outputs shown explicitly.' },
  { icon: '📋', label: 'Full Audit Log', desc: 'Every tool invocation logged to Postgres: tool name, inputs, outputs, duration.' },
  { icon: '🏖', label: 'Sandbox Mode Only', desc: 'SANDBOX_MODE=true. All API calls go to Prism mock — never production.' },
]

export default function ResponsibleAI() {
  return (
    <section id="responsible-ai" className="relative z-10 flex flex-col justify-center pt-16 pb-2 px-6 md:px-12 lg:px-24">
      <div className="max-w-7xl mx-auto">
        <SectionHeader title="Responsible AI" tag="// GUARDRAILS" subtitle="Built in, not bolted on." />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          {PRINCIPLES.map((p) => (
            <div key={p.label}
              className="glass rounded-2xl p-4 text-center transition-colors duration-200 hover:border-accent-primary/50">
              <div className="text-2xl mb-2">{p.icon}</div>
              <h3 className="font-display font-bold text-star-white text-sm mb-2">{p.label}</h3>
              <p className="font-body text-star-blue/70 text-xs leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
        <p className="font-body italic text-star-blue/70 text-center text-lg max-w-2xl mx-auto">
          "This is not AI safety theatre. These are architectural constraints."
        </p>
      </div>
    </section>
  )
}
