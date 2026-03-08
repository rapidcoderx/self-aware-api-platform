import { useEffect, useRef } from 'react'

export default function StarField() {
  const canvasRef = useRef(null)
  const mouseRef = useRef({ x: 0, y: 0 })
  const frameRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let W = window.innerWidth
    let H = window.innerHeight
    canvas.width = W
    canvas.height = H

    const STAR_COUNT = 220
    const stars = Array.from({ length: STAR_COUNT }, () => {
      const rand = Math.random()
      const color = rand < 0.7 ? '#F8FAFF' : rand < 0.9 ? '#A8D8F0' : '#FFD700'
      return {
        x: Math.random() * W, y: Math.random() * H, baseX: 0, baseY: 0,
        radius: 0.5 + Math.random() * 2, opacity: 0.3 + Math.random() * 0.7,
        speed: 0.3 + Math.random() * 1.2, phase: Math.random() * Math.PI * 2,
        color, parallaxFactor: 0.2 + Math.random() * 0.8,
      }
    })
    stars.forEach(s => { s.baseX = s.x; s.baseY = s.y })

    const shots = Array.from({ length: 5 }, (_, i) => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0,
      opacity: 0, timer: i * 1600, delay: 8000 + Math.random() * 6000,
      life: 0, maxLife: 60,
    }))

    const resetShot = (s) => {
      s.x = Math.random() * W * 0.6; s.y = Math.random() * H * 0.3
      const angle = Math.PI / 6 + Math.random() * (Math.PI / 4)
      const spd = 6 + Math.random() * 8
      s.vx = Math.cos(angle) * spd; s.vy = Math.sin(angle) * spd
      s.opacity = 0; s.active = true; s.life = 0; s.maxLife = 60
    }

    let t0 = null
    const draw = (ts) => {
      if (!t0) t0 = ts
      const elapsed = (ts - t0) / 1000
      ctx.clearRect(0, 0, W, H)
      const mx = mouseRef.current.x / W - 0.5
      const my = mouseRef.current.y / H - 0.5
      stars.forEach(s => {
        const tw = 0.5 + 0.5 * Math.sin(elapsed * s.speed + s.phase)
        const alpha = s.opacity * (0.4 + 0.6 * tw)
        const px = s.baseX + mx * 8 * s.parallaxFactor
        const py = s.baseY + my * 8 * s.parallaxFactor
        const r = parseInt(s.color.slice(1,3),16)
        const g = parseInt(s.color.slice(3,5),16)
        const b = parseInt(s.color.slice(5,7),16)
        ctx.beginPath(); ctx.arc(px, py, s.radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`; ctx.fill()
      })
      shots.forEach(s => {
        s.timer += 16
        if (!s.active) { if (s.timer > s.delay) { s.timer = 0; s.delay = 6000 + Math.random() * 8000; resetShot(s) } return }
        s.life++
        s.opacity = s.life < 10 ? s.life / 10 : s.life > s.maxLife - 10 ? (s.maxLife - s.life) / 10 : 1
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 12, s.y - s.vy * 12)
        const g2 = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 12, s.y - s.vy * 12)
        g2.addColorStop(0, `rgba(255,255,255,${s.opacity})`); g2.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.strokeStyle = g2; ctx.lineWidth = 2; ctx.stroke()
        s.x += s.vx; s.y += s.vy
        if (s.life >= s.maxLife || s.x > W || s.y > H) { s.active = false; s.timer = 0 }
      })
      frameRef.current = requestAnimationFrame(draw)
    }
    frameRef.current = requestAnimationFrame(draw)

    const onResize = () => {
      W = window.innerWidth; H = window.innerHeight; canvas.width = W; canvas.height = H
      stars.forEach(s => { s.baseX = Math.random() * W; s.baseY = Math.random() * H; s.x = s.baseX; s.y = s.baseY })
    }
    const onMouse = (e) => { mouseRef.current = { x: e.clientX, y: e.clientY } }
    window.addEventListener('resize', onResize)
    window.addEventListener('mousemove', onMouse)
    return () => { cancelAnimationFrame(frameRef.current); window.removeEventListener('resize', onResize); window.removeEventListener('mousemove', onMouse) }
  }, [])

  return <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none" style={{ willChange: 'transform' }} />
}
