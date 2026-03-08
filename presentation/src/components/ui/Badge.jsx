export default function Badge({ label, variant = 'cyan' }) {
  const v = {
    cyan:   'bg-accent-primary/10 text-accent-primary border-accent-primary/30',
    red:    'bg-accent-red/10 text-accent-red border-accent-red/30',
    green:  'bg-accent-green/10 text-accent-green border-accent-green/30',
    gold:   'bg-accent-gold/10 text-accent-gold border-accent-gold/30',
    purple: 'bg-accent-secondary/10 text-accent-secondary border-accent-secondary/30',
    white:  'bg-star-white/10 text-star-white border-star-white/30',
  }
  return <span className={`inline-block font-mono text-xs px-3 py-1 rounded-full border font-medium tracking-wider ${v[variant] || v.cyan}`}>{label}</span>
}
