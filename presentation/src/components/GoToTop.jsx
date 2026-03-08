import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUp } from 'lucide-react'
import { smoothScrollTo } from '../utils/scroll'

export default function GoToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.7, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.7, y: 12 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          onClick={() => smoothScrollTo(0)}
          aria-label="Back to top"
          className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full
                     flex items-center justify-center
                     cursor-pointer select-none
                     border border-accent-primary/40
                     hover:border-accent-primary
                     active:scale-95
                     transition-[border-color,box-shadow] duration-200"
          style={{
            background: 'rgba(12, 24, 46, 0.96)',
            boxShadow: '0 0 20px rgba(0,212,255,0.12), 0 4px 16px rgba(0,0,0,0.5)',
          }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 24px rgba(0,212,255,0.35), 0 4px 20px rgba(0,0,0,0.5)'}
          onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 20px rgba(0,212,255,0.12), 0 4px 16px rgba(0,0,0,0.5)'}
        >
          <ArrowUp size={18} className="text-accent-primary" />
        </motion.button>
      )}
    </AnimatePresence>
  )
}
