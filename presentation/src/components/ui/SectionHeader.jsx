import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'

export default function SectionHeader({ title, subtitle, tag }) {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 })
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7 }} className="text-center mb-16">
      {tag && <p className="font-mono text-accent-primary text-sm tracking-widest mb-3 uppercase">{tag}</p>}
      <h2 className="font-display font-black text-4xl md:text-5xl text-gradient-cyan mb-4">{title}</h2>
      <div className="section-divider mx-auto" style={{ maxWidth: 320 }} />
      {subtitle && <p className="font-body text-star-blue text-lg mt-4 max-w-2xl mx-auto">{subtitle}</p>}
    </motion.div>
  )
}
