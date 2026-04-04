/* eslint-disable no-unused-vars */
import { useEffect, useState } from 'react'
import { motion as m, AnimatePresence } from 'framer-motion'
import satsPhoto from '../../pics/satsphoto.jpg'
import editedPhoto from '../../pics/edited-photo.png'

const TEAM = [
  {
    codename: 'ARCHITECT-01',
    name: 'Sathishkumar Krishnan',
    designation: 'Industry Principal',
    role: 'Finacle Technical Consultant',
    clearance: 'TOP SECRET',
    photo: satsPhoto,
    status: 'ACTIVE',
  },
  {
    codename: 'ARCHITECT-02',
    name: 'Vinotha Sathishkumar',
    designation: 'Senior Project Manager',
    role: 'Lead Java Developer',
    clearance: 'TOP SECRET',
    photo: editedPhoto,
    status: 'ACTIVE',
  },
]

export default function TeamDossier({ open, onClose }) {
  const [phase, setPhase] = useState('hidden') // hidden | classified | revealed

  useEffect(() => {
    if (!open) {
      const t0 = setTimeout(() => setPhase('hidden'), 0)
      return () => clearTimeout(t0)
    }
    const t0 = setTimeout(() => setPhase('classified'), 0)
    const t1 = setTimeout(() => setPhase('revealed'), 1000)
    return () => { clearTimeout(t0); clearTimeout(t1) }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const revealed = phase === 'revealed'

  return (
    <AnimatePresence>
      {open && (
        <m.div
          key="dossier-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[100] flex items-center justify-center px-8 py-4"
          style={{ background: 'rgba(2, 4, 9, 0.97)' }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
          <m.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="relative z-10 w-full max-w-6xl"
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
                {revealed ? 'THE AUTONOMOUS DUO' : '████ ██████████ ████'}
              </h2>

              <div
                className="mt-3 mx-auto w-48 h-px"
                style={{
                  background: 'linear-gradient(to right, transparent, #00d4ff, transparent)',
                }}
              />
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl mx-auto w-full">
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
                <m.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="font-mono text-center mt-5 text-xs"
                  style={{ color: 'rgba(0,212,255,0.3)' }}
                >
                  Esc to close · arrow keys or clicker to navigate sections ✓
                </m.p>
              )}
            </AnimatePresence>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  )
}

function DossierCard({ member, delay, revealed }) {
  const [imgError, setImgError] = useState(false)

  return (
    <m.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.28, ease: 'easeOut' }}
      className="rounded-2xl p-6 relative overflow-hidden"
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
            background: member.isAI ? 'rgba(124,58,237,0.12)' : 'rgba(46,213,115,0.08)',
            color: member.isAI ? '#a78bfa' : '#2ed573',
            border: member.isAI ? '1px solid rgba(124,58,237,0.35)' : '1px solid rgba(46,213,115,0.2)',
          }}
        >
          ● {member.status}
        </span>
      </div>

      {/* Photo + identity */}
      <div className="flex items-center gap-4 mb-4">
        {/* Avatar */}
        <div className="relative flex-shrink-0 w-36 h-36">
          <div
            className="w-36 h-36 rounded-full overflow-hidden"
            style={{
              boxShadow: revealed
                ? member.isAI
                  ? '0 0 0 2px rgba(124,58,237,0.9), 0 0 24px rgba(124,58,237,0.4)'
                  : '0 0 0 2px rgba(0,212,255,0.7), 0 0 16px rgba(0,212,255,0.25)'
                : '0 0 0 2px rgba(0,212,255,0.2)',
              transition: 'box-shadow 0.5s ease',
            }}
          >
            {member.isAI ? (
              <div
                className="w-full h-full flex flex-col items-center justify-center gap-1"
                style={{
                  background: revealed
                    ? 'linear-gradient(135deg, #0f0a2e 0%, #1e1b4b 50%, #0a0a1a 100%)'
                    : 'rgba(10,10,26,0.8)',
                  transition: 'background 0.5s ease',
                }}
              >
                <span style={{ fontSize: '2.5rem', filter: revealed ? 'none' : 'grayscale(1) brightness(0.2)', transition: 'filter 0.5s ease' }}>🤖</span>
                {revealed && (
                  <span
                    className="font-mono text-center leading-tight"
                    style={{ fontSize: '0.45rem', color: 'rgba(167,139,250,0.7)', letterSpacing: '0.05em' }}
                  >
                    ANTHROPIC<br/>× GITHUB
                  </span>
                )}
              </div>
            ) : !imgError ? (
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
            className="font-display font-bold text-xl leading-snug mb-1"
            style={{
              color: revealed ? '#f8faff' : 'rgba(248,250,255,0.15)',
              transition: 'color 0.5s ease',
            }}
          >
            {revealed ? member.name : '████████████████'}
          </p>
          <p
            className="font-mono text-sm mb-1"
            style={{
              color: revealed
                ? member.isAI ? '#a78bfa' : '#ffd700'
                : 'rgba(255,215,0,0.1)',
              transition: 'color 0.5s ease',
            }}
          >
            {revealed ? `// ${member.designation}` : '// ████████████████'}
          </p>
          <p
            className="font-body text-base font-semibold mb-3"
            style={{
              color: revealed ? 'rgba(168,216,240,0.9)' : 'rgba(168,216,240,0.07)',
              transition: 'color 0.5s ease',
            }}
          >
            {revealed ? member.role : '████████████████'}
          </p>

        </div>
      </div>

      {/* Faint clearance watermark */}
      <div className="absolute bottom-3 right-3 pointer-events-none select-none opacity-[0.07] rotate-[-15deg]">
        <p className="font-display font-black text-2xl tracking-widest" style={{ color: member.isAI ? '#a78bfa' : '#00d4ff' }}>
          {member.clearance}
        </p>
      </div>
    </m.div>
  )
}
