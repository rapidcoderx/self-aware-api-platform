import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { scrollToSection } from '../utils/scroll'
import TeamDossier from './TeamDossier'

const SECTIONS = [
  { id: 'hero', label: 'Home' }, { id: 'problem', label: 'Problem' },
  { id: 'solution', label: 'Solution' }, { id: 'architecture', label: 'Architecture' },
  { id: 'data-flow', label: 'Data Flow' }, { id: 'mcp-tools', label: 'MCP Tools' },
  { id: 'demo-flow', label: 'Demo' }, { id: 'tech-stack', label: 'Tech Stack' },
  { id: 'responsible-ai', label: 'Resp. AI' }, { id: 'live-demo', label: 'Live Demo' },
  { id: 'cta', label: 'Why We Win' },
]

const scrollTo = (id) => scrollToSection(id)

export default function Navigation() {
  const [active, setActive] = useState('hero')
  const [showDossier, setShowDossier] = useState(false)
  const activeIndexRef = useRef(0)
  const cooldownRef = useRef(false)

  // navigate: eagerly update ref + state + scroll, then lock for 500ms
  const navigate = (targetIndex) => {
    if (cooldownRef.current) return
    const idx = Math.max(0, Math.min(targetIndex, SECTIONS.length - 1))
    activeIndexRef.current = idx
    setActive(SECTIONS[idx].id)
    scrollTo(SECTIONS[idx].id)
    cooldownRef.current = true
    setTimeout(() => { cooldownRef.current = false }, 500)
  }

  // IntersectionObserver syncs active dot when user manually scrolls
  useEffect(() => {
    const obs = []
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (!el) return
      const o = new IntersectionObserver(
        ([e]) => {
          if (e.isIntersecting && !cooldownRef.current) {
            const idx = SECTIONS.findIndex(s => s.id === id)
            activeIndexRef.current = idx
            setActive(id)
          }
        },
        { rootMargin: '-5% 0px -80% 0px', threshold: 0 }
      )
      o.observe(el); obs.push(o)
    })
    return () => obs.forEach(o => o.disconnect())
  }, [])

  // Arrow key + presentation clicker navigation
  // Clicker remotes (Logitech R400/R800/Spotlight): PageDown = next, PageUp = prev
  useEffect(() => {
    const onKey = (e) => {
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
      if (isInput) return

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        navigate(activeIndexRef.current + 1)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault()
        navigate(activeIndexRef.current - 1)
      } else if (e.key === 'Home') {
        e.preventDefault()
        navigate(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        navigate(SECTIONS.length - 1)
      } else if (e.key === 'Escape') {
        setShowDossier(false)
      } else if (e.key === 'i' || e.key === 'I') {
        setShowDossier(v => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <motion.nav initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6, delay: 0.3 }}
        className="fixed top-0 left-0 right-0 z-50 glass-nav border-b border-accent-primary/20"
        style={{ boxShadow: '0 0 30px rgba(0,212,255,0.05)' }}>
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          {/* Logo — click goes to Hero */}
          <button
            onClick={() => navigate(0)}
            className="flex items-center gap-3 group"
            title="Back to Home"
          >
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none"
              className="transition-all duration-300 group-hover:drop-shadow-[0_0_8px_rgba(0,212,255,0.8)]">
              <circle cx="14" cy="14" r="3" fill="#00d4ff" />
              <ellipse cx="14" cy="14" rx="10" ry="5" stroke="#00d4ff" strokeWidth="1.2" fill="none" opacity="0.7" transform="rotate(30 14 14)" />
              <ellipse cx="14" cy="14" rx="10" ry="5" stroke="#7c3aed" strokeWidth="1.2" fill="none" opacity="0.7" transform="rotate(-30 14 14)" />
            </svg>
            <span className="font-display font-bold text-star-white text-sm tracking-wide hidden sm:block group-hover:text-accent-primary transition-colors">
              Self-Aware API Platform
            </span>
          </button>

          {/* Section dots + info button */}
          <div className="flex items-center gap-2">
            {SECTIONS.map(({ id, label }, idx) => (
              <button key={id} onClick={() => navigate(idx)} title={label} className="group relative p-1">
                <div className={`w-2 h-2 rounded-full transition-all duration-300 ${active === id ? 'bg-accent-primary shadow-glow-cyan scale-125' : 'bg-star-blue/30 hover:bg-star-blue/70'}`} />
                <span className="absolute top-6 left-1/2 -translate-x-1/2 font-mono text-xs text-accent-primary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">{label}</span>
              </button>
            ))}

            {/* Divider */}
            <div className="w-px h-4 bg-accent-primary/20 mx-1" />

            {/* Team dossier trigger */}
            <button
              onClick={() => setShowDossier(true)}
              title="Meet the team"
              className={`group relative w-6 h-6 rounded-full border flex items-center justify-center transition-all duration-300 ${
                showDossier
                  ? 'border-accent-primary bg-accent-primary/20 text-accent-primary'
                  : 'border-star-blue/40 text-star-blue/60 hover:border-accent-primary hover:text-accent-primary'
              }`}
            >
              <span className="font-mono text-xs font-bold leading-none">i</span>
              <span className="absolute top-8 right-0 font-mono text-xs text-accent-primary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                Meet the team
              </span>
            </button>
          </div>
        </div>
      </motion.nav>

      <TeamDossier open={showDossier} onClose={() => setShowDossier(false)} />
    </>
  )
}
