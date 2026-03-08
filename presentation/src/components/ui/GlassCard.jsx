export default function GlassCard({ children, className = '', hover = true, glowColor = 'cyan', onClick }) {
  const glowMap = {
    cyan:   'hover:border-accent-primary/40 hover:shadow-glow-cyan',
    red:    'hover:border-accent-red/40',
    green:  'hover:border-accent-green/40',
    gold:   'hover:border-accent-gold/40',
    purple: 'hover:border-accent-secondary/40',
  }
  return (
    <div onClick={onClick}
      className={`glass rounded-2xl p-6 transition-colors duration-200 ${hover ? glowMap[glowColor] || glowMap.cyan : ''} ${className}`}>
      {children}
    </div>
  )
}
