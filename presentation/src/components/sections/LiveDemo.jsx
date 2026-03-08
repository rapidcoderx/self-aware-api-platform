import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { TypeAnimation } from 'react-type-animation'
import SectionHeader from '../ui/SectionHeader'

export default function LiveDemo() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.2 })
  return (
    <section id="live-demo" className="relative min-h-screen z-10 py-24 px-6 md:px-12 lg:px-24">
      <div className="max-w-5xl mx-auto text-center" ref={ref}>
        <SectionHeader title="See It Live" tag="// DEMO" />
        <motion.div initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7 }}
          className="glass-strong rounded-2xl overflow-hidden mb-8 text-left" style={{ boxShadow: '0 0 60px rgba(0,212,255,0.1)' }}>
          <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5 bg-black/40">
            <div className="w-3 h-3 rounded-full bg-accent-red/60" /><div className="w-3 h-3 rounded-full bg-accent-gold/60" /><div className="w-3 h-3 rounded-full bg-accent-green/60" />
            <span className="font-mono text-star-blue/50 text-xs ml-3">self-aware-api — chat agent</span>
          </div>
          <div className="p-6 md:p-8 min-h-64">
            {inView && (
              <TypeAnimation
                sequence={[
                  '> How do I create a corporate deposit account?', 600,
                  '> How do I create a corporate deposit account?\n\n[spec.search] Searching Banking API v1...', 400,
                  '> How do I create a corporate deposit account?\n\n[spec.search] Searching Banking API v1...\n[spec.get]    Retrieved: POST /accounts (createAccount)', 400,
                  '> How do I create a corporate deposit account?\n\n[spec.search] Searching Banking API v1...\n[spec.get]    Retrieved: POST /accounts (createAccount)\n[spec.validate] Payload valid ✓', 600,
                  '> How do I create a corporate deposit account?\n\n[spec.search] Searching Banking API v1...\n[spec.get]    Retrieved: POST /accounts (createAccount)\n[spec.validate] Payload valid ✓\n\nAnswer: Use POST /accounts with:\n  accountName: "Acme Corp"\n  accountType: "corporate"\n\nProvenance: Banking API v1.0 · operationId: createAccount',
                ]}
                wrapper="pre"
                speed={75}
                style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', lineHeight: '1.6', color: '#2ed573', whiteSpace: 'pre-wrap' }}
                cursor={true}
              />
            )}
          </div>
        </motion.div>
        <motion.p initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ delay: 0.5 }} className="font-mono text-star-blue/70 text-sm mb-8">
          Upload v2 → Breaking change detected → Migration plan generated
        </motion.p>
        <motion.a initial={{ opacity: 0, y: 10 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.7 }}
          href="https://github.com" target="_blank" rel="noopener noreferrer"
          className="inline-block font-mono text-star-white border border-star-white/30 rounded-xl px-8 py-3 text-sm tracking-wider hover:border-star-white/70 hover:bg-star-white/5 transition-all duration-300">
          View on GitHub →
        </motion.a>
      </div>
    </section>
  )
}
