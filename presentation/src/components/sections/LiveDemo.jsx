import { useInView } from 'react-intersection-observer'
import { TypeAnimation } from 'react-type-animation'
import SectionHeader from '../ui/SectionHeader'

export default function LiveDemo() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.2 })
  return (
    <section id="live-demo" className="relative z-10 flex flex-col justify-center pt-16 pb-2 px-6 md:px-12 lg:px-24">
      <div className="max-w-5xl mx-auto text-center" ref={ref}>
        <SectionHeader title="See It Live" tag="// DEMO" />
        <div className="glass-strong rounded-2xl overflow-hidden mb-8 text-left" style={{ boxShadow: '0 0 60px rgba(0,212,255,0.1)' }}>
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
        </div>
        <p className="font-mono text-star-blue/70 text-sm mb-8">
          Upload v2 → Breaking change detected → Migration plan generated
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a href="https://www.loom.com/share/4b05290c1cff4212a0cb85ca09a69a14" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-mono bg-accent-primary/10 text-accent-primary border border-accent-primary/40 rounded-xl px-8 py-3 text-sm tracking-wider hover:bg-accent-primary/20 hover:border-accent-primary/70 transition-colors duration-200">
            <span>▶</span> Watch Live Presentation
          </a>
          <a href="https://github.com/rapidcoderx/self-aware-api-platform" target="_blank" rel="noopener noreferrer"
            className="inline-block font-mono text-star-white border border-star-white/30 rounded-xl px-8 py-3 text-sm tracking-wider hover:border-star-white/70 hover:bg-star-white/5 transition-colors duration-200">
            View on GitHub →
          </a>
        </div>
      </div>
    </section>
  )
}
