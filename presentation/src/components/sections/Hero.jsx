import { scrollToSection } from '../../utils/scroll'

export default function Hero() {
  return (
    <section id="hero" className="relative min-h-screen flex items-center justify-center z-10 nebula-bg">
      <div className="max-w-5xl mx-auto px-6 text-center">
        <p className="font-mono text-accent-primary text-sm md:text-base tracking-widest mb-6">
          // HACKATHON 2026 · AGENTIC INFRASTRUCTURE
        </p>
        <h1 className="font-display font-black text-5xl md:text-7xl lg:text-8xl leading-tight mb-6">
          <span className="text-gradient-cyan glow-text-cyan">Self-Aware</span><br />
          <span className="text-star-white">API Platform</span>
        </h1>
        <p className="font-body text-star-blue text-lg md:text-xl max-w-2xl mx-auto mb-10">
          Agentic API Intelligence using MCP · Change Detection · Schema-Aware Reasoning
        </p>
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          {['5 MCP Tools', '3 Demo Flows', '48hr Build'].map(label => (
            <div key={label} className="glass rounded-full px-6 py-2 border-accent-primary/25">
              <span className="font-mono text-accent-primary text-sm font-medium">{label}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => scrollToSection('architecture')}
          className="font-mono text-accent-primary border border-accent-primary/50 rounded-xl px-8 py-3 text-sm tracking-wider transition-colors duration-200 hover:bg-accent-primary/10 hover:border-accent-primary">
          View Architecture ↓
        </button>
      </div>
    </section>
  )
}
