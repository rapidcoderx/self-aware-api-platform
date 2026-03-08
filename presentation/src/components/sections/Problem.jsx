import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import SectionHeader from '../ui/SectionHeader'

const PROBLEMS = [
  { icon: '🔍', num: '01', heading: 'API Discovery Is Hard', desc: 'Finding the right endpoint among hundreds takes minutes, slowing down integrations across every team.' },
  { icon: '📄', num: '02', heading: 'Specs Drift from Reality', desc: 'Docs updated late — causing silent integration errors that only surface in production.' },
  { icon: '💥', num: '03', heading: 'Breaking Changes Hit Production', desc: 'Downstream systems fail before anyone is warned. The blast radius is unknown until it hurts.' },
  { icon: '🤖', num: '04', heading: 'LLMs Hallucinate Endpoints', desc: 'Without schema validation, AI suggestions invent fields and paths that do not exist.' },
]

export default function Problem() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 })
  return (
    <section id="problem" className="relative min-h-screen z-10 py-24 px-6 md:px-12 lg:px-24">
      <div className="max-w-7xl mx-auto">
        <SectionHeader title="The Problem" tag="// CONTEXT" />
        <div ref={ref} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PROBLEMS.map((p, i) => (
            <motion.div key={p.num} initial={{ opacity: 0, y: 40 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay: i * 0.15 }}
              whileHover={{ y: -4 }} className="glass rounded-2xl p-6 border-l-4 border-l-accent-red/60 hover:border-l-accent-red hover:shadow-[0_0_30px_rgba(255,71,87,0.2)] transition-all duration-300">
              <div className="flex items-start gap-4">
                <span className="text-3xl flex-shrink-0">{p.icon}</span>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono text-accent-red/60 text-xs">{p.num}</span>
                    <h3 className="font-display font-bold text-star-white text-lg">{p.heading}</h3>
                  </div>
                  <p className="font-body text-star-blue text-sm leading-relaxed">{p.desc}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
