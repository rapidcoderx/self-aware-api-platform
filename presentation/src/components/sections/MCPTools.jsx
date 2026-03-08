import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import SectionHeader from '../ui/SectionHeader'
import Badge from '../ui/Badge'

const TOOLS = [
  { num: '01', name: 'spec.search', icon: '🔭', sig: 'search_endpoints(\n  query: str,\n  spec_id: int,\n  limit: int = 5\n) -> list[EndpointSummary]', desc: 'Vector similarity search over all endpoints using Voyage AI embeddings.', ret: 'list[EndpointSummary]', retVariant: 'cyan', snippet: '// Embed query → cosine search pgvector\n// Returns top-N by semantic similarity' },
  { num: '02', name: 'spec.get_endpoint', icon: '📋', sig: 'get_endpoint(\n  operation_id: str,\n  spec_id: int\n) -> EndpointDetail', desc: 'Fetch the full schema_json for one operation including parameters and request body.', ret: 'EndpointDetail', retVariant: 'purple', snippet: '// Retrieves complete schema including\n// parameters, requestBody, responses' },
  { num: '03', name: 'spec.validate_request', icon: '✅', sig: 'validate_request(\n  operation_id: str,\n  payload: dict,\n  spec_id: int\n) -> ValidationResult', desc: 'Extract requestBody JSON Schema, run jsonschema.validate(), return structured errors.', ret: 'ValidationResult', retVariant: 'green', snippet: '// Uses jsonschema.validate()\n// Returns {valid: bool, errors: []}' },
  { num: '04', name: 'spec.diff', icon: '⚠️', sig: 'diff_specs(\n  old_spec_id: int,\n  new_spec_id: int\n) -> list[DiffItem]', desc: 'Compare requestBody schemas between versions. Classify BREAKING vs NON_BREAKING.', ret: 'list[DiffItem]', retVariant: 'red', snippet: '// FIELD_ADDED | FIELD_REMOVED\n// TYPE_CHANGED | ENUM_CHANGED | REQUIRED_ADDED' },
  { num: '05', name: 'impact.analyze', icon: '🗺', sig: 'analyze_impact(\n  diff_id: int\n) -> list[ImpactItem]', desc: 'Load dependencies.yaml, map breaking changes to affected services and teams.', ret: 'list[ImpactItem]', retVariant: 'gold', snippet: '// Cross-references dependency graph\n// Severity: HIGH | MEDIUM | LOW' },
]

export default function MCPTools() {
  const [expanded, setExpanded] = useState(null)
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.05 })
  return (
    <section id="mcp-tools" className="relative min-h-screen z-10 py-24 px-6 md:px-12 lg:px-24">
      <div className="max-w-7xl mx-auto">
        <SectionHeader title="MCP Tool Contract" tag="// TOOLING" subtitle="Five narrow, typed, auditable tools. The agent orchestrates. Tools execute." />
        <div ref={ref} className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          {TOOLS.map((tool, i) => (
            <motion.div key={tool.num} initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`glass rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 ${expanded === i ? 'border-accent-primary/50 shadow-glow-cyan' : 'hover:border-accent-primary/30'}`}
              onClick={() => setExpanded(expanded === i ? null : i)}>
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-accent-primary/50 text-xs">{tool.num}</span>
                  <span className="text-xl">{tool.icon}</span>
                </div>
                <h3 className="font-mono text-star-white font-semibold text-base mb-2">{tool.name}</h3>
                <pre className="font-mono text-accent-primary text-xs bg-black/40 rounded-lg p-3 mb-3 overflow-x-auto whitespace-pre-wrap">{tool.sig}</pre>
                <p className="font-body text-star-blue text-xs leading-relaxed mb-3">{tool.desc}</p>
                <Badge label={tool.ret} variant={tool.retVariant} />
              </div>
              <AnimatePresence>
                {expanded === i && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden border-t border-accent-primary/15">
                    <pre className="font-mono text-accent-green/80 text-xs p-4 bg-black/40 whitespace-pre-wrap">{tool.snippet}</pre>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.6 }}
          className="glass rounded-2xl border-accent-primary/30 p-6 text-center" style={{ boxShadow: '0 0 30px rgba(0,212,255,0.08)' }}>
          <p className="font-mono text-accent-primary text-sm">"Tools are narrow, typed, and auditable. The agent orchestrates. Tools execute."</p>
        </motion.div>
      </div>
    </section>
  )
}
