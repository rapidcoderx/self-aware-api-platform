// Stars are rendered as CSS box-shadow on a single 1px element — one GPU layer,
// zero JS after mount, zero rAF. Glows are opacity-only CSS animations which run
// entirely on the compositor thread (no paint or layout) — safe for Intel + Firefox.

// Deterministic pseudo-random so SSR/hydration is stable
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

function buildStars(count, w, h, seed) {
  const rand = mulberry32(seed)
  const colors = ['248,250,255', '168,216,240', '255,215,0']
  return Array.from({ length: count }, () => {
    const x = Math.floor(rand() * w)
    const y = Math.floor(rand() * h)
    const r = (rand() * 1.4 + 0.4).toFixed(1)
    const a = (rand() * 0.55 + 0.18).toFixed(2)
    const c = colors[Math.floor(rand() * colors.length)]
    return `${x}px ${y}px 0 ${r}px rgba(${c},${a})`
  }).join(',')
}

// 14 glow spots: position (%), animation duration, delay, color
const GLOWS = [
  { x:  8, y: 12, d: 5.1, del: 0.0, c: '0,212,255',   s: 180 },
  { x: 22, y: 68, d: 7.3, del: 1.4, c: '168,216,240', s: 120 },
  { x: 37, y: 28, d: 4.8, del: 2.7, c: '255,215,0',   s: 90  },
  { x: 51, y: 82, d: 6.2, del: 0.8, c: '0,212,255',   s: 150 },
  { x: 63, y: 14, d: 8.5, del: 3.2, c: '124,58,237',  s: 200 },
  { x: 74, y: 55, d: 5.9, del: 1.9, c: '168,216,240', s: 110 },
  { x: 85, y: 33, d: 4.4, del: 0.5, c: '0,212,255',   s: 160 },
  { x: 91, y: 77, d: 7.1, del: 2.3, c: '255,215,0',   s: 80  },
  { x: 15, y: 90, d: 6.6, del: 1.1, c: '124,58,237',  s: 130 },
  { x: 44, y: 50, d: 9.0, del: 4.0, c: '0,212,255',   s: 220 },
  { x: 58, y: 95, d: 5.5, del: 0.3, c: '168,216,240', s: 100 },
  { x: 30, y: 42, d: 7.8, del: 3.6, c: '255,215,0',   s: 75  },
  { x: 78, y: 8,  d: 4.2, del: 2.0, c: '0,212,255',   s: 140 },
  { x: 96, y: 60, d: 6.9, del: 1.7, c: '124,58,237',  s: 190 },
]

const STAR_SHADOW = buildStars(260, 1920, 1080, 0xDEADBEEF)

export default function StarField() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden>
      {/* Ambient nebula gradients */}
      <div style={{
        position: 'absolute', inset: 0,
        background: [
          'radial-gradient(ellipse 700px 600px at 15% 25%, rgba(0,212,255,0.05) 0%, transparent 100%)',
          'radial-gradient(ellipse 900px 700px at 85% 75%, rgba(124,58,237,0.05) 0%, transparent 100%)',
          'radial-gradient(ellipse 500px 400px at 50% 8%,  rgba(255,215,0,0.02) 0%, transparent 100%)',
        ].join(',')
      }} />

      {/* Static star field — single element, one composited layer */}
      <div style={{
        position: 'absolute', width: 1, height: 1,
        top: 0, left: 0,
        boxShadow: STAR_SHADOW,
        borderRadius: '50%',
        background: 'transparent',
      }} />

      {/* Glow spots — opacity-only animation, compositor thread only */}
      {GLOWS.map((g, idx) => (
        <div key={idx} style={{
          position: 'absolute',
          left: g.x + '%',
          top:  g.y + '%',
          width:  g.s + 'px',
          height: g.s + 'px',
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(${g.c},0.22) 0%, transparent 70%)`,
          opacity: 0,
          animation: `starGlow ${g.d}s ease-in-out ${g.del}s infinite`,
          transform: 'translate(-50%, -50%)',
        }} />
      ))}

      <style>{`
        @keyframes starGlow {
          0%, 100% { opacity: 0; }
          45%, 55%  { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
