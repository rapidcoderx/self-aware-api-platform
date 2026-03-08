import SectionHeader from '../ui/SectionHeader'
import Badge from '../ui/Badge'

const STEP_FLOW = ['Question', 'spec.search', 'spec.get', 'spec.validate', '✓ Valid']

export default function DemoFlow() {
  return (
    <section id="demo-flow" className="relative min-h-screen z-10 py-24 px-6 md:px-12 lg:px-24">
      <div className="max-w-7xl mx-auto">
        <SectionHeader title="Three Demos · Four Minutes" tag="// LIVE DEMO" />
        <div className="space-y-10">
          {/* Demo 1 */}
          <div className="glass rounded-2xl p-6 md:p-8 flex flex-col md:flex-row gap-8 hover:border-accent-primary/40 transition-colors duration-200">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4"><span className="text-3xl">🔭</span><Badge label="DEMO 1" variant="cyan" /></div>
              <h3 className="font-display font-bold text-star-white text-2xl mb-3">Discover &amp; Validate</h3>
              <p className="font-body text-star-blue text-sm leading-relaxed mb-4">Ask a natural language question. The agent searches, retrieves the schema, then validates your payload — all through typed MCP tools.</p>
              <p className="font-mono text-accent-primary text-xs italic">"Every recommendation is schema-validated before it reaches you."</p>
            </div>
            <div className="flex-1">
              <p className="font-mono text-accent-primary/60 text-xs mb-3 tracking-wider">TOOL FLOW</p>
              <div className="flex flex-wrap items-center gap-1">
                {STEP_FLOW.map((s, i) => (
                  <div key={s} className="flex items-center">
                    <span className={'font-mono text-xs px-2 py-1 rounded-lg ' + (s.startsWith('✓') ? 'bg-accent-green/20 text-accent-green' : 'bg-accent-primary/10 text-accent-primary')}>{s}</span>
                    {i < STEP_FLOW.length - 1 && <span className="text-accent-primary/40 mx-1 text-xs">→</span>}
                  </div>
                ))}
              </div>
              <p className="font-mono text-accent-primary/40 text-xs mt-3">Duration: ~90 sec</p>
            </div>
          </div>
          {/* Demo 2 */}
          <div className="glass rounded-2xl p-6 md:p-8 flex flex-col md:flex-row gap-8 border-l-4 border-l-accent-red/60 hover:border-l-accent-red transition-colors duration-200">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4"><span className="text-3xl">⚠️</span><Badge label="DEMO 2" variant="red" /></div>
              <h3 className="font-display font-bold text-star-white text-2xl mb-3">Breaking Change Detected</h3>
              <p className="font-body text-star-blue text-sm leading-relaxed mb-4">Upload Banking API v2. The diff tool flags a new required field and enum change in createAccount instantly.</p>
              <div className="flex gap-2 flex-wrap mb-4"><Badge label="BREAKING" variant="red" /><Badge label="NON-BREAKING" variant="gold" /></div>
              <p className="font-mono text-accent-primary text-xs italic">"Caught at spec upload. Not in production."</p>
            </div>
            <div className="flex-1">
              <p className="font-mono text-accent-primary/60 text-xs mb-3 tracking-wider">DIFF PREVIEW</p>
              <pre className="font-mono text-xs bg-black/60 border border-accent-red/20 rounded-xl p-4 leading-relaxed">
                <span className="text-accent-red/70">{"- required: [accountName, accountType]"}</span>{`\n`}
                <span className="text-accent-green">{"+ required: [accountName, accountType,"}</span>{`\n`}
                <span className="text-accent-green">{"             companyRegistrationNumber]"}</span>{`\n\n`}
                <span className="text-accent-red/70">{"- accountType: [savings, checking, deposit]"}</span>{`\n`}
                <span className="text-accent-green">{"+ accountType: [savings, checking, corporate]"}</span>
              </pre>
              <p className="font-mono text-accent-primary/40 text-xs mt-3">Duration: ~60 sec</p>
            </div>
          </div>
          {/* Demo 3 */}
          <div className="glass rounded-2xl p-6 md:p-8 flex flex-col md:flex-row gap-8 border-l-4 border-l-accent-green/60 hover:border-l-accent-green transition-colors duration-200">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4"><span className="text-3xl">🛠</span><Badge label="DEMO 3" variant="green" /></div>
              <h3 className="font-display font-bold text-star-white text-2xl mb-3">Self-Heal</h3>
              <p className="font-body text-star-blue text-sm leading-relaxed mb-4">The agent generates a migration plan, validates against v2 schema, and presents it for human review before any change is applied.</p>
              <div className="flex items-center gap-3 mb-4">
                <span className="font-mono text-xs bg-accent-red/20 text-accent-red border border-accent-red/30 px-3 py-1 rounded-full">Missing field</span>
                <span className="text-star-blue text-sm">→</span>
                <span className="font-mono text-xs bg-accent-green/20 text-accent-green border border-accent-green/30 px-3 py-1 rounded-full">Validated ✓</span>
              </div>
              <p className="font-mono text-accent-primary text-xs italic">"Advisory only. Human reviews. AI prepares."</p>
            </div>
            <div className="flex-1">
              <p className="font-mono text-accent-primary/60 text-xs mb-3 tracking-wider">MIGRATION PLAN</p>
              <pre className="font-mono text-xs bg-black/60 border border-accent-green/20 rounded-xl p-4 leading-relaxed text-accent-green/80">{`// Migration: createAccount payload\n// Add required field:\n+ companyRegistrationNumber: "REG-001"\n\n// Update enum value:\n- accountType: "deposit"\n+ accountType: "corporate"\n\n// Validation: PASS ✓`}</pre>
              <p className="font-mono text-accent-primary/40 text-xs mt-3">Duration: ~60 sec</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
