import { motion } from 'framer-motion'

export default function GlassCard({ children, className = '', hover = true, glowColor = 'cyan', onClick }) {
  const glowMap = {
    cyan:   'hover:border-accent-primary/40 hover:shadow-glow-cyan',
    red:    'hover:border-accent-red/40',
    green:  'hover:border-accent-green/40',
    gold:   'hover:border-accent-gold/40 hover:shadow-glow-gold',
    purple: 'hover:border-accent-secondary/40 hover:shadow-glow-purple',
  }
  return (
    <motion.div whileHover={hover ? { y: -4, scale: 1.01 } : {}} transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      onClick={onClick} className={`glass rounded-2xl p-6 transition-all duration-300 ${hover ? glowMap[glowColor] || glowMap.cyan : ''} ${className}`}>
      {children}
    </motion.div>
  )
}
