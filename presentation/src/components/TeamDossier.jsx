import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import satsPhoto from '../../pics/satsphoto.jpg'
import editedPhoto from '../../pics/edited-photo.png'

const TEAM = [
  {
    codename: 'ARCHITECT-01',
    name: 'Sathishkumar Krishnan',
    designation: 'Industry Principal',
    role: 'Platform Engineer & AI Systems',
    clearance: 'LEVEL-5',
    photo: satsPhoto,
    status: 'ACTIVE',
    expertise: [
      '> backend: FastAPI · PostgreSQL · pgvector',
      '> agent: Claude tool_use · MCP SDK',
      '> infra: uv · Docker · CI/CD',
      '> spec: OpenAPI · prance · jsonschema',
    ],
    tags: ['Backend', 'Agent Loop', 'Vector DB'],
  },
  {
    codename: 'ARCHITECT-02',
    name: 'Vinotha Sathishkumar',
    designation: 'Senior Project Manager',
    role: 'Frontend Engineer & UX Systems',
    clearance: 'LEVEL-5',
    photo: editedPhoto,
    status: 'ACTIVE',
    expertise: [
      '> frontend: React 18 · Vite · Tailwind',
      '> motion: Framer Motion · CSS FX',
      '> ux: Component systems · Design tokens',
      '> delivery: Agile · Stakeholder Mgmt',
    ],
    tags: ['Frontend', 'UX/UI', 'Project Mgmt'],
  },
]

const SCANLINES =
  'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.12) 2px, rgba(0,0,0,0.12) 3px)'

export default function TeamDossier({ open, onClose }) {
  const [phase, setPhase] = useState('hidden') // hidden | classified | glitch | revealed

  useEffect(() => {
    if (!open) { setPhase('hidden'); return }
    setPhase('classified')
    const t1 = setTimeout(() => setPhase('glitch'), 500)
    const t2 = setTimeout(() => setPhase('revealed'), 1100)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const revealed = phase === 'revealed'
  const glitch = phase === 'glitch'

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="dossier-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(2, 4, 9, 0.96)' }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
          {/* Scanlines overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ backgroundImage: SCANLINES, opacity: 0.7 }}
          />

          <motion.div
            initial={{ scale: 0.9, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 24 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="relative z-10 w-full max-w-3xl"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center font-mono text-sm z-10 transition-all duration-200"
              style={{
                background: 'rgba(255,71,87,0.15)',
                border: '1px solid rgba(255,71,87,0.4)',
                color: '#ff4757',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,71,87,0.35)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,71,87,0.15)')}
            >
              ✕
            </button>

            {/* Header */}
            <div className="text-center mb-8">
              <motion.p
                className="font-mono text-xs tracking-[0.3em] mb-2 transition-colors duration-150"
                style={{ color: revealed ? '#00d4ff' : glitch ? '#ffd700' : '#ff4757' }}
              >
                {glitch
                  ? '// D█SSIER_L█ADING... DECRYPTING...'
                  : revealed
                    ? '// DOSSIER UNLOCKED — TEAM CREDENTIALS VERIFIED'
                    : '// [CLASSIFIED] — LEVEL-5 CLEARANCE REQUIRED'}
              </motion.p>

              <h2
                className="font-display font-black text-3xl md:text-4xl tracking-tight"
                style={{
                  background: 'linear-gradient(135deg, #00d4ff, #7c3aed)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  filter: glitch ? 'blur(3px) brightness(1.5)' : 'none',
                  transition: 'filter 0.15s',
                }}
              >
                {revealed ? 'THE AUTONOMOUS DUO' : '████ ██████████ ███'}
              </h2>

              <div
                className="mt-3 mx-auto w-48 h-px"
                style={{
                  background: 'linear-gradient(to right, transparent, #00d4ff, transparent)',
                }}
              />
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {TEAM.map((member, i) => (
                <DossierCard
                  key={member.codename}
                  member={member}
                  delay={0.15 + i * 0.15}
                  revealed={revealed}
                  glitch={glitch}
                />
              ))}
            </div>

            {/* Footer hint */}
            <AnimatePresence>
              {revealed && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="font-mono text-center mt-5 text-xs"
                  style={{ color: 'rgba(0,212,255,0.3)' }}
                >
                  Esc to close · arrow keys or clicker to navigate sections ✓
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function DossierCard({ member, delay, revealed, glitch }) {
  const [imgError, setImgError] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="rounded-2xl p-5 relative overflow-hidden"
      style={{
        background: 'rgba(10, 20, 40, 0.97)',
        border: `1px solid ${glitch ? 'rgba(255,215,0,0.4)' : 'rgba(0,212,255,0.2)'}`,
        boxShadow: glitch
          ? '0 0 30px rgba(255,215,0,0.1)'
          : 'inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 40px rgba(0,0,0,0.7)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
    >
      {/* Bracket corners */}
      {[
        'top-2 left-2 border-t border-l',
        'top-2 right-2 border-t border-r',
        'bottom-2 left-2 border-b border-l',
        'bottom-2 right-2 border-b border-r',
      ].map((cls) => (
        <div
          key={cls}
          className={`absolute w-3 h-3 ${cls}`}
          style={{ borderColor: 'rgba(0,212,255,0.35)' }}
        />
      ))}

      {/* Codename + status row */}
      <div className="flex items-center justify-between mb-4">
        <span
          className="font-mono text-xs px-2 py-0.5 rounded"
          style={{
            background: 'rgba(0,212,255,0.08)',
            color: '#00d4ff',
            border: '1px solid rgba(0,212,255,0.2)',
          }}
        >
          {member.codename}
        </span>
        <span
          className="font-mono text-xs px-2 py-0.5 rounded"
          style={{
            background: 'rgba(46,213,115,0.08)',
            color: '#2ed573',
            border: '1px solid rgba(46,213,115,0.2)',
          }}
        >
          ● {member.status}
        </span>
      </div>

      {/* Photo + identity */}
      <div className="flex items-start gap-4 mb-4">
        {/* Avatar with hologram ring */}
        <div className="relative flex-shrink-0 w-20 h-20">
          <div
            className="w-20 h-20 rounded-full overflow-hidden relative z-10"
            style={{
              boxShadow: glitch
                ? '0 0 0 2px #ffd700, 0 0 24px rgba(255,215,0,0.4)'
                : revealed
                  ? '0 0 0 2px rgba(0,212,255,0.7), 0 0 20px rgba(0,212,255,0.3)'
                  : '0 0 0 2px rgba(0,212,255,0.2)',
              transition: 'box-shadow 0.15s',
            }}
          >
            {!imgError ? (
              <img
                src={member.photo}
                alt={member.name}
                onError={() => setImgError(true)}
                className="w-full h-full object-cover"
                style={{
                  filter: revealed ? 'none' : 'grayscale(100%) brightness(0.25)',
                  transition: 'filter 0.6s ease',
                }}
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ background: 'rgba(0,212,255,0.08)' }}
              >
                <span className="font-display font-black text-2xl" style={{ color: '#00d4ff' }}>
                  {member.name[0]}
                </span>
              </div>
            )}
          </div>

          {/* Spinning hologram ring — only when revealed */}
          {revealed && (
            <div
              className="absolute inset-0 rounded-full animate-spin pointer-events-none"
              style={{
                background:
                  'conic-gradient(from 0deg, transparent 70%, rgba(0,212,255,0.5) 85%, transparent 100%)',
                animationDuration: '4s',
              }}
            />
          )}
        </div>

        {/* Name + designation + role + tags */}
        <div className="flex-1 min-w-0">
          <p
            className="font-display font-bold text-sm leading-snug mb-0.5 transition-all duration-500"
            style={{ color: revealed ? '#f8faff' : 'rgba(248,250,255,0.15)' }}
          >
            {revealed ? member.name : '████████████████'}
          </p>
          {/* Designation badge */}
          <p
            className="font-mono text-xs mb-1 transition-all duration-500"
            style={{ color: revealed ? '#ffd700' : 'rgba(255,215,0,0.1)' }}
          >
            {revealed ? `// ${member.designation}` : '// ████████████████'}
          </p>
          <p className="font-body text-xs leading-relaxed mb-2" style={{ color: 'rgba(168,216,240,0.65)' }}>
            {member.role}
          </p>
          <div className="flex flex-wrap gap-1">
            {member.tags.map((tag) => (
              <span
                key={tag}
                className="font-mono px-1.5 py-0.5 rounded"
                style={{
                  background: 'rgba(124,58,237,0.12)',
                  color: '#7c3aed',
                  border: '1px solid rgba(124,58,237,0.2)',
                  fontSize: '0.6rem',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Terminal expertise block */}
      <div
        className="rounded-lg p-3"
        style={{
          background: 'rgba(0,0,0,0.5)',
          border: '1px solid rgba(0,212,255,0.07)',
        }}
      >
        <p className="font-mono text-xs mb-2" style={{ color: 'rgba(0,212,255,0.45)', fontSize: '0.65rem' }}>
          $ cat expertise.log
        </p>
        {member.expertise.map((line, j) => (
          <motion.p
            key={j}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: delay + 0.4 + j * 0.07 }}
            className="font-mono leading-relaxed"
            style={{ color: 'rgba(46,213,115,0.85)', fontSize: '0.62rem' }}
          >
            {line}
          </motion.p>
        ))}
      </div>

      {/* Faint clearance watermark */}
      <div className="absolute bottom-3 right-3 pointer-events-none select-none opacity-[0.07] rotate-[-15deg]">
        <p className="font-display font-black text-2xl tracking-widest" style={{ color: '#00d4ff' }}>
          {member.clearance}
        </p>
      </div>
    </motion.div>
  )
}
