import StarField from './components/StarField'
import Navigation from './components/Navigation'
import GoToTop from './components/GoToTop'
import Hero from './components/sections/Hero'
import Problem from './components/sections/Problem'
import Solution from './components/sections/Solution'
import Architecture from './components/sections/Architecture'
import DataFlow from './components/sections/DataFlow'
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

      {/* All sections */}
      <main className="relative">
        <Hero />
        <Problem />
        <Solution />
        <Architecture />
        <DataFlow />
        <MCPTools />
        <DemoFlow />
        <TechStack />
        <ResponsibleAI />
        <LiveDemo />
        <CallToAction />
      </main>

      {/* Back-to-top button — visible after scrolling past hero, mobile-friendly */}
      <GoToTop />

      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
