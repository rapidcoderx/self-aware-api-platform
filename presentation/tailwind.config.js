/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'space-black': '#020409',
        'space-dark': '#060b14',
        'space-navy': '#0a1628',
        'nebula-blue': '#0d1f3c',
        'accent-primary': '#00d4ff',
        'accent-secondary': '#7c3aed',
        'accent-gold': '#ffd700',
        'accent-red': '#ff4757',
        'accent-green': '#2ed573',
        'star-white': '#f8faff',
        'star-blue': '#a8d8f0',
        'glass-border': 'rgba(0, 212, 255, 0.15)',
        'glass-bg': 'rgba(255, 255, 255, 0.03)',
      },
      fontFamily: {
        display: ['Exo 2', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'gradient-cyan': 'linear-gradient(135deg, #00d4ff, #7c3aed)',
        'gradient-gold': 'linear-gradient(135deg, #ffd700, #ff8c00)',
        'nebula-mesh':
          'radial-gradient(ellipse at 20% 20%, rgba(0,212,255,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(124,58,237,0.08) 0%, transparent 60%), radial-gradient(ellipse at 50% 50%, rgba(255,215,0,0.03) 0%, transparent 80%)',
      },
      animation: {
        'twinkle': 'twinkle 3s ease-in-out infinite',
        'orbit': 'orbit 8s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'dash': 'dash 2s linear infinite',
        'type-cursor': 'type-cursor 1s step-end infinite',
      },
      keyframes: {
        twinkle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
        orbit: {
          '0%': { transform: 'rotate(0deg) translateX(60px) rotate(0deg)' },
          '100%': { transform: 'rotate(360deg) translateX(60px) rotate(-360deg)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(0,212,255,0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(0,212,255,0.7)' },
        },
        dash: {
          '0%': { strokeDashoffset: '100' },
          '100%': { strokeDashoffset: '0' },
        },
        'type-cursor': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(0, 212, 255, 0.4)',
        'glow-purple': '0 0 20px rgba(124, 58, 237, 0.4)',
        'glow-gold': '0 0 20px rgba(255, 215, 0, 0.4)',
        'glass': 'inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 32px rgba(0,0,0,0.4)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}


