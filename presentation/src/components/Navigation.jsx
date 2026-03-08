import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

const SECTIONS = [
  { id: 'hero', label: 'Home' }, { id: 'problem', label: 'Problem' },
  { id: 'solution', label: 'Solution' }, { id: 'architecture', label: 'Architecture' },
  { id: 'mcp-tools', label: 'MCP Tools' }, { id: 'demo-flow', label: 'Demo' },
  { id: 'tech-stack', label: 'Tech Stack' }, { id: 'responsible-ai', label: 'Resp. AI' },
  { id: 'live-demo', label: 'Live Demo' }, { id: 'cta', label: 'Why We Win' },
]

export default function Navigation() {
  const [active, setActive] = useState('hero')
  useEffect(() => {
    const obs = []
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (!el) return
      const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) setActive(id) }, { threshold: 0.4 })
      o.observe(el); obs.push(o)
    })
    return () => obs.forEach(o => o.disconnect())
  }, [])

  return (
    <motion.nav initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6, delay: 0.3 }}
      className="fixed top-0 left-0 right-0 z-50 glass border-b border-accent-primary/20"
      style={{ boxShadow: '0 0 30px rgba(0,212,255,0.05)' }}>
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="3" fill="#00d4ff" />
            <ellipse cx="14" cy="14" rx="10" ry="5" stroke="#00d4ff" strokeWidth="1.2" fill="none" opacity="0.7" transform="rotate(30 14 14)" />
            <ellipse cx="14" cy="14" rx="10" ry="5" stroke="#7c3aed" strokeWidth="1.2" fill="none" opacity="0.7" transform="rotate(-30 14 14)" />
          </svg>
          <span className="font-display font-bold text-star-white text-sm tracking-wide hidden sm:block">Self-Aware API</span>
        </div>
        <div className="flex items-center gap-2">
          {SECTIONS.map(({ id, label }) => (
            <button key={id} onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })} title={label} className="group relative p-1">
              <div className={`w-2 h-2 rounded-full transition-all duration-300 ${active === id ? 'bg-accent-primary shadow-glow-cyan scale-125' : 'bg-star-blue/30 hover:bg-star-blue/70'}`} />
              <span className="absolute top-6 left-1/2 -translate-x-1/2 font-mono text-xs text-accent-primary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </motion.nav>
  )
}
