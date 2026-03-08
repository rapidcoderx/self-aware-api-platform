import { useEffect, useState } from 'react'
import { useInView } from 'react-intersection-observer'

export default function AnimatedCounter({ target, suffix = '', duration = 1500 }) {
  const [count, setCount] = useState(0)
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.3 })
  useEffect(() => {
    if (!inView) return
    let start = 0
    const step = target / (duration / 16)
    const timer = setInterval(() => {
      start += step
      if (start >= target) { setCount(target); clearInterval(timer) } else setCount(Math.floor(start))
    }, 16)
    return () => clearInterval(timer)
  }, [inView, target, duration])
  return <span ref={ref} className="font-display font-black text-6xl text-gradient-cyan glow-text-cyan tabular-nums">{count}{suffix}</span>
}
