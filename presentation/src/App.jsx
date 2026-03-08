import StarField from './components/StarField'
import Navigation from './components/Navigation'
import Hero from './components/sections/Hero'
import Problem from './components/sections/Problem'
import Solution from './components/sections/Solution'
import Architecture from './components/sections/Architecture'
import MCPTools from './components/sections/MCPTools'
import DemoFlow from './components/sections/DemoFlow'
import TechStack from './components/sections/TechStack'
import ResponsibleAI from './components/sections/ResponsibleAI'
import LiveDemo from './components/sections/LiveDemo'
import CallToAction from './components/sections/CallToAction'

export default function App() {
  return (
    <div className="relative min-h-screen bg-space-black">
      {/* Fixed star field background */}
      <StarField />

      {/* Fixed navigation */}
      <Navigation />

      {/* Floating orb decorations */}
      <div
        className="fixed pointer-events-none z-1"
        style={{
          top: '20%', left: '10%',
          width: 400, height: 400,
          background: 'radial-gradient(circle, rgba(0,212,255,0.06) 0%, transparent 70%)',
          borderRadius: '50%',
          animation: 'float 8s ease-in-out infinite',
        }}
        aria-hidden
      />
      <div
        className="fixed pointer-events-none z-1"
        style={{
          bottom: '30%', right: '8%',
          width: 500, height: 500,
          background: 'radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 70%)',
          borderRadius: '50%',
          animation: 'float 11s ease-in-out 3s infinite reverse',
        }}
        aria-hidden
      />

      {/* All sections */}
      <main className="relative">
        <Hero />
        <div className="section-divider" />
        <Problem />
        <div className="section-divider" />
        <Solution />
        <div className="section-divider" />
        <Architecture />
        <div className="section-divider" />
        <MCPTools />
        <div className="section-divider" />
        <DemoFlow />
        <div className="section-divider" />
        <TechStack />
        <div className="section-divider" />
        <ResponsibleAI />
        <div className="section-divider" />
        <LiveDemo />
        <div className="section-divider" />
        <CallToAction />
      </main>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-30px) scale(1.05); }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
