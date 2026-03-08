export default function AnimatedCounter({ target, suffix = '' }) {
  return (
    <span className="font-display font-black text-6xl text-gradient-cyan glow-text-cyan tabular-nums">
      {target}{suffix}
    </span>
  )
}
