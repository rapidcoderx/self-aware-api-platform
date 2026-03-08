import { motion } from 'framer-motion'

const fu = (delay = 0) => ({ initial: { opacity: 0, y: 30 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay } })

export default function Hero() {
  return (
    <section id="hero" className="relative min-h-screen flex items-center justify-center z-10 nebula-bg">
      <div className="max-w-5xl mx-auto px-6 text-center">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden>
          <div className="relative w-96 h-96 opacity-20">
            <div className="absolute inset-0 rounded-full border border-accent-primary/30" style={{ animation: 'heroSpin 20s linear infinite' }} />
            <div className="absolute inset-8 rounded-full border border-accent-secondary/20" style={{ animation: 'heroSpin 14s linear infinite reverse' }} />
            <div className="absolute inset-16 rounded-full border border-accent-gold/20" style={{ animation: 'heroSpin 10s linear infinite' }} />
          </div>
        </div>
        <motion.p {...fu(0.1)} className="font-mono text-accent-primary text-sm md:text-base tracking-widest mb-6">
          // HACKATHON 2026 · AGENTIC INFRASTRUCTURE
        </motion.p>
        <motion.h1 {...fu(0.25)} className="font-display font-black text-5xl md:text-7xl lg:text-8xl leading-tight mb-6">
          <span className="text-gradient-cyan glow-text-cyan">Self-Aware</span><br />
          <span className="text-star-white">API Platform</span>
        </motion.h1>
        <motion.p {...fu(0.4)} className="font-body text-star-blue text-lg md:text-xl max-w-2xl mx-auto mb-10">
          Agentic API Intelligence using MCP · Change Detection · Schema-Aware Reasoning
        </motion.p>
        <motion.div {...fu(0.55)} className="flex flex-wrap justify-center gap-4 mb-12">
          {['5 MCP Tools', '3 Demo Flows', '48hr Build'].map(label => (
            <div key={label} className="glass rounded-full px-6 py-2 border-accent-primary/25">
              <span className="font-mono text-accent-primary text-sm font-medium">{label}</span>
            </div>
          ))}
        </motion.div>
        <motion.button {...fu(0.7)} whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(0,212,255,0.5)' }} whileTap={{ scale: 0.97 }}
          onClick={() => document.getElementById('architecture')?.scrollIntoView({ behavior: 'smooth' })}
          className="font-mono text-accent-primary border border-accent-primary/50 rounded-xl px-8 py-3 text-sm tracking-wider transition-all hover:bg-accent-primary/10">
          View Architecture ↓
        </motion.button>
      </div>
      <style>{`@keyframes heroSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </section>
  )
}
