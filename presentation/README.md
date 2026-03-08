# Self-Aware API Platform — Hackathon Presentation

> Deep-space mission control aesthetic. Agentic API intelligence showcase.

## Local Development

```bash
cd ~/self-aware-api-platform/presentation
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Production Build

```bash
npm run build
npm run preview  # local preview of dist/
```

## Deploy to Vercel

```bash
cd ~/self-aware-api-platform/presentation

# First deploy
vercel

# Production deploy
vercel --prod
```

Set no environment variables — this is a pure static site.
Vercel auto-detects Vite. Build command: `npm run build`. Output: `dist/`.

## Stack

- React 19 + Vite 8
- Tailwind CSS 3 (custom design tokens: space-black, accent-primary, star-white)
- Framer Motion (scroll-triggered reveals, stagger animations)
- react-intersection-observer (triggerOnce viewport detection)
- react-type-animation (LiveDemo terminal typewriter)
- lucide-react (icons)
- HTML5 Canvas (StarField with 220 stars + 5 shooting stars + parallax)
- Google Fonts: Exo 2 · DM Sans · JetBrains Mono

## Sections

1. Hero — full-viewport title with animated orbit rings
2. Problem — 4 problem cards with red left-border accents
3. Solution — pitch line + 3 pillars + animated flow diagram
4. Architecture — 5-layer system diagram with animated connectors
5. MCP Tools — 5 tool cards with expandable code snippets
6. Demo Flow — 3 demo scenarios with diff previews
7. Tech Stack — pill grid + "why this stack" Q&A
8. Responsible AI — 6 principle cards
9. Live Demo — terminal typewriter animation
10. Call to Action — animated counters + judging criteria alignment

