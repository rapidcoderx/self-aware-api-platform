import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import satsPhoto from '../../pics/satsphoto.jpg'
import editedPhoto from '../../pics/edited-photo.png'

const TEAM = [
  {
    codename: 'ARCHITECT-01',
    name: 'Sathishkumar Krishnan',
    designation: 'Finacle Technical Consultant',
    clearance: 'LEVEL-5',
    photo: satsPhoto,
    status: 'ACTIVE',
    tags: ['Backend', 'Agent Loop', 'Vector DB'],
  },
  {
    codename: 'ARCHITECT-02',
    name: 'Vinotha Sathishkumar',
    designation: 'Senior Java Developer',
    clearance: 'LEVEL-5',
    photo: editedPhoto,
    status: 'ACTIVE',
    tags: ['Frontend', 'UX/UI', 'React'],
  },
]

export default function TeamDossier({ open, onClose }) {
  const [phase, setPhase] = useState('hidden') // hidden | classified | revealed

  useEffect(() => {
    if (!open) { setPhase('hidden'); return }
    setPhase('classified')
    const t1 = setTimeout(() => setPhase('revealed'), 700)
    return () => { clearTimeout(t1) }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const revealed = phase === 'revealed'
  const glitch = false

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
          style={{ background: 'rgba(2, 4, 9, 0.97)' }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="relative z-10 w-full max-w-4xl"
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
              <p
                className="font-mono text-xs tracking-[0.3em] mb-2"
                style={{ color: revealed ? '#00d4ff' : '#ff4757' }}
              >
                {revealed
                  ? '// DOSSIER UNLOCKED — TEAM CREDENTIALS VERIFIED'
                  : '// [CLASSIFIED] — LEVEL-5 CLEARANCE REQUIRED'}
              </p>

              <h2
                className="font-display font-black text-3xl md:text-4xl tracking-tight"
                style={{
                  background: 'linear-gradient(135deg, #00d4ff, #7c3aed)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
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

function DossierCard({ member, delay, revealed }) {
  const [imgError, setImgError] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.28, ease: 'easeOut' }}
      className="rounded-2xl p-7 relative overflow-hidden"
      style={{
        background: 'rgba(10, 20, 40, 0.97)',
        border: '1px solid rgba(0,212,255,0.2)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 40px rgba(0,0,0,0.7)',
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
        {/* Avatar */}
        <div className="relative flex-shrink-0 w-28 h-28">
          <div
            className="w-28 h-28 rounded-full overflow-hidden"
            style={{
              boxShadow: revealed
                ? '0 0 0 2px rgba(0,212,255,0.7), 0 0 16px rgba(0,212,255,0.25)'
                : '0 0 0 2px rgba(0,212,255,0.2)',
              transition: 'box-shadow 0.5s ease',
            }}
          >
            {!imgError ? (
              <img
                src={member.photo}
                alt={member.name}
                onError={() => setImgError(true)}
                className="w-full h-full object-cover"
                style={{
                  filter: revealed ? 'none' : 'grayscale(100%) brightness(0.3)',
                  transition: 'filter 0.5s ease',
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
        </div>

        {/* Name + designation + tags */}
        <div className="flex-1 min-w-0">
          <p
            className="font-display font-bold text-base leading-snug mb-0.5"
            style={{
              color: revealed ? '#f8faff' : 'rgba(248,250,255,0.15)',
              transition: 'color 0.5s ease',
            }}
          >
            {revealed ? member.name : '████████████████'}
          </p>
          <p
            className="font-mono text-xs mb-1"
            style={{
              color: revealed ? '#ffd700' : 'rgba(255,215,0,0.1)',
              transition: 'color 0.5s ease',
            }}
          >
            {revealed ? `// ${member.designation}` : '// ████████████████'}
          </p>
          <p
            className="font-body text-sm font-semibold mb-3"
            style={{
              color: revealed ? 'rgba(168,216,240,0.9)' : 'rgba(168,216,240,0.07)',
              transition: 'color 0.5s ease',
            }}
          >
            {revealed ? member.designation : '████████████████'}
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

      {/* Faint clearance watermark */}
      <div className="absolute bottom-3 right-3 pointer-events-none select-none opacity-[0.07] rotate-[-15deg]">
        <p className="font-display font-black text-2xl tracking-widest" style={{ color: '#00d4ff' }}>
          {member.clearance}
        </p>
      </div>
    </motion.div>
  )
}
