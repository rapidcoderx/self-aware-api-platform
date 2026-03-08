---
name: build-presentation
description: Build the full Self-Aware API Platform hackathon presentation — starry dark theme, animated star field, all slides, deploy-ready for Vercel.
agent: agent
tools: ['edit/editFiles', 'search/codebase', 'execute/getTerminalOutput', 'execute/runInTerminal', 'read/terminalLastCommand', 'read/terminalSelection', 'search']
---

Build the complete hackathon presentation for the **Self-Aware API Platform**.

The bootstrap script has already created:
- `presentation/` folder inside `~/self-aware-api-platform/`
- Vite + React + Tailwind 3 + Framer Motion installed
- `tailwind.config.js` with the full design token set (colours, fonts, animations)
- `src/index.css` with glass, glow, gradient utilities
- Google Fonts loaded: **Exo 2** (display), **DM Sans** (body), **JetBrains Mono** (code)
- `App.jsx` is a placeholder — replace it entirely

---

## Design Vision

**Aesthetic**: Deep space observatory. A scientist-explorer's mission control.
Not a generic tech deck — this feels like peering into a live system from an orbital station.

**Mood**: Confident, intelligent, slightly cinematic. The kind of UI that makes judges
lean forward.

**Key visual signatures**:
- Deep space background: `#020409` with layered nebula gradients
- Animated star field: 200+ stars of 3 sizes, each twinkling at different speeds and delays
- 4–6 shooting stars that streak across randomly
- Floating orbs: soft cyan/purple radial glows that drift slowly
- All cards: glass morphism (`backdrop-blur`, subtle border, inner glow)
- Section dividers: thin horizontal lines with a cyan centre pulse
- Scroll-triggered reveals: elements slide up and fade in as they enter the viewport
- Cursor: custom CSS cursor (star/crosshair shape)

**Typography**:
- Headlines: Exo 2, weight 900, letter-spacing tight, text-gradient-cyan
- Subheads: Exo 2, weight 600, text-star-white
- Body: DM Sans, weight 400, text-star-blue (slightly muted)
- Code/labels: JetBrains Mono, weight 500, text-accent-primary

---

## File Structure to Create

Build all of this inside `presentation/src/`:

```
src/
  App.jsx                        ← main entry, renders all sections in order
  components/
    StarField.jsx                ← animated canvas star field (the hero background)
    Navigation.jsx               ← fixed top nav with section dots + logo
    sections/
      Hero.jsx                   ← title slide
      Problem.jsx                ← problem statement
      Solution.jsx               ← solution overview
      Architecture.jsx           ← system architecture diagram
      MCPTools.jsx               ← 5 MCP tools showcase
      DemoFlow.jsx               ← 3 demo flows
      TechStack.jsx              ← tech stack grid
      ResponsibleAI.jsx          ← responsible AI principles
      LiveDemo.jsx               ← demo CTA slide
      CallToAction.jsx           ← closing / judging criteria
    ui/
      GlassCard.jsx              ← reusable glass card
      SectionHeader.jsx          ← reusable section header with glow line
      AnimatedCounter.jsx        ← number count-up on scroll entry
      CodeSnippet.jsx            ← syntax-highlighted code block
      Badge.jsx                  ← status badge (BREAKING/NON-BREAKING/VALID)
      Timeline.jsx               ← horizontal build timeline
```

---

## Section-by-Section Build Spec

### `StarField.jsx`
- HTML5 Canvas, fills the entire viewport, `position: fixed`, `z-index: 0`
- Generate 220 stars on mount, each with random: x, y, radius (0.5–2.5px), opacity, twinkle speed (2–6s), twinkle phase offset
- Star colours: 70% white (#F8FAFF), 20% blue (#A8D8F0), 10% gold (#FFD700)
- Animate with `requestAnimationFrame` — smooth 60fps twinkle using `Math.sin(time * speed + phase)`
- Add 5 shooting stars: random angle, 3s duration, 8s random delay between each, thin white line with opacity trail
- Parallax: stars shift slightly on `mousemove` (max 8px at edge)

---

### `Navigation.jsx`
- Fixed top, full width, glass background
- Left: small orbit logo (SVG inline) + "Self-Aware API" in Exo 2
- Right: section dot indicators (filled = active, outline = inactive)
- Section dots highlight as user scrolls past each section (IntersectionObserver)
- Thin cyan bottom border with subtle glow

---

### `Hero.jsx`
- Full viewport height (`min-h-screen`)
- Centred layout with staggered Framer Motion entrance (0.1s delay per element)
- **Tag line** (small, JetBrains Mono, cyan): `// HACKATHON 2026 · AGENTIC INFRASTRUCTURE`
- **Main title** (Exo 2, 900, 5xl–8xl responsive): `Self-Aware API Platform`
  - "Self-Aware" in text-gradient-cyan with glow-text-cyan
  - "API Platform" in text-star-white
- **Subtitle** (DM Sans, lg, text-star-blue): `Agentic API Intelligence using MCP · Change Detection · Schema-Aware Reasoning`
- **Three stat pills** (glass cards, inline row):
  - `5 MCP Tools` · `3 Demo Flows` · `48hr Build`
- **CTA button**: "View Architecture ↓" — outlined, cyan border, hover fills with cyan glow
- **Floating orbit decoration**: small SVG orbit lines around a central dot (CSS animation `orbit`)
- Background: nebula gradient mesh behind the star field

---

### `Problem.jsx`
- Section title: "The Problem"
- **4 problem cards** in a 2×2 grid, each glass card with:
  - Icon (Lucide), problem number, headline, 1-sentence description
  - Left border accent colour (red for severity)
  - Hover: border brightens, card lifts 4px
- Problems:
  1. 🔍 **API Discovery Is Hard** — Finding the right endpoint among hundreds takes minutes
  2. 📄 **Specs Drift from Reality** — Docs updated late, causing silent integration errors
  3. 💥 **Breaking Changes Hit Production** — Downstream systems fail before anyone is warned
  4. 🤖 **LLMs Hallucinate Endpoints** — Without validation, AI suggestions break things
- Entrance: cards stagger in from bottom (0.15s delay each) on scroll entry

---

### `Solution.jsx`
- Section title: "The Solution"
- **One-line pitch** (large, centred, Exo 2, italic, text-gradient-gold):
  > "Turn API specs into living infrastructure — observable, validated, and self-healing."
- **3 pillar cards** (horizontal row, glass, icon + title + description):
  1. 🔭 **Tool-First Intelligence** — Agent only acts through typed MCP tools. Never guesses.
  2. ⚡ **Change Detection** — Breaking changes caught at spec upload, not in production.
  3. 🛠 **Self-Healing** — Validated migration plans generated and reviewed before applying.
- Below pillars: a subtle animated flow diagram (CSS only):
  `OpenAPI Spec → Ingestion → Vector Index → MCP Tools → Agent → Validated Answer`
  Connected with animated dashed lines (CSS `stroke-dashoffset` animation)

---

### `Architecture.jsx`
- Section title: "System Architecture"
- **Full-width architecture diagram** built entirely in JSX/CSS (no image):
  - 5 horizontal layers, each a glass row:
    1. **Input Layer**: `OpenAPI/Swagger` files → upload icon
    2. **Ingestion Layer**: `Normalizer` → `Chunker` → `Embedder (Voyage AI)`
    3. **Storage Layer**: `Postgres JSONB` ◄──► `pgvector (1024d)` | `Change Watcher`
    4. **MCP Tool Layer**: 5 tool pills (`search` · `get` · `validate` · `diff` · `impact`)
    5. **Interface Layer**: `Claude Agent (tool_use)` → `React UI`
  - Animated vertical connectors between layers (thin cyan lines with moving dot)
  - Each layer has a subtle left label in JetBrains Mono

---

### `MCPTools.jsx`
- Section title: "MCP Tool Contract"
- **5 tool cards** in a staggered grid (3 top, 2 bottom):
  Each card: glass, number badge (01–05), tool name, function signature in JetBrains Mono, description, return type badge
  1. `spec.search` — vector similarity search — returns `list[EndpointSummary]`
  2. `spec.get_endpoint` — full schema retrieval — returns `EndpointDetail`
  3. `spec.validate_request` — JSON Schema validation — returns `ValidationResult`
  4. `spec.diff` — breaking change classifier — returns `list[DiffItem]`
  5. `impact.analyze` — dependency impact mapper — returns `list[ImpactItem]`
- Hover on each card: code snippet expands (Framer Motion `AnimatePresence`)
- Bottom callout (glass, cyan border): "Tools are narrow, typed, and auditable. The agent orchestrates. Tools execute."

---

### `DemoFlow.jsx`
- Section title: "Three Demos · Four Minutes"
- **3 large demo cards** stacked vertically with alternating layout (text left/right):

  **Demo 1 — Discover & Validate** (90 sec)
  - Icon: 🔭 · Tag: `DEMO 1`
  - Steps shown as a mini flow: `Question` → `spec.search` → `spec.get` → `spec.validate` → `✓ Valid`
  - Key line: "Every recommendation is schema-validated before it reaches you."

  **Demo 2 — Breaking Change Detected** (60 sec)
  - Icon: ⚠️ · Tag: `DEMO 2` · Border: red accent
  - Show a mini diff snippet (JetBrains Mono):
    ```
    - required: [accountName, accountType]
    + required: [accountName, accountType, companyRegistrationNumber]
    ```
  - Red `BREAKING` badge · Yellow `NON-BREAKING` badge
  - Key line: "Caught at spec upload. Not in production."

  **Demo 3 — Self-Heal** (60 sec)
  - Icon: 🛠 · Tag: `DEMO 3` · Border: green accent
  - Before/after pill: red pill "Missing field" → green pill "Validated ✓"
  - Key line: "Advisory only. Human reviews. AI prepares."

---

### `TechStack.jsx`
- Section title: "Tech Stack"
- **Justified tech grid** — 3 rows of tech pills, each pill: icon/emoji + name + version
- Row 1 (Backend): Python 3.12 · FastAPI · PostgreSQL 16 · pgvector 0.8
- Row 2 (AI): Claude Sonnet · MCP SDK · Voyage AI voyage-3 · prance
- Row 3 (Frontend): React 18 · Vite 5 · Tailwind 3 · Framer Motion · Prism Mock
- Each pill: glass, hover glow, subtle entrance stagger
- Below grid: **"Why this stack?"** — 3 inline justification callouts (the judge Q&A answers)

---

### `ResponsibleAI.jsx`
- Section title: "Responsible AI — Built In, Not Bolted On"
- **Hexagonal grid** of 6 principle cards (CSS clip-path hexagon or rounded grid):
  1. 🔒 Schema Validation Required
  2. 📍 Provenance on Every Answer
  3. 🧑 Human-in-the-Loop Migration
  4. 👁 Transparent Tool Calls
  5. 📋 Full Audit Log
  6. 🏖 Sandbox Mode Only
- Each hexagon: icon centred, label below, hover: glows cyan
- Section footer: `"This is not AI safety theatre. These are architectural constraints."` (italic, DM Sans)

---

### `LiveDemo.jsx`
- Section title: "See It Live"
- Centred, dramatic layout
- Large animated terminal window (glass card, dark green text on near-black):
  ```
  > How do I create a corporate deposit account?

  [spec.search] Searching Banking API v1...
  [spec.get]    Retrieved: POST /accounts (createAccount)
  [spec.validate] Payload valid ✓

  Answer: Use POST /accounts with accountName, accountType: "corporate"
  Provenance: Banking API v1.0 · operationId: createAccount
  ```
  Terminal text types out with `react-type-animation` (cursor blinking)
- Below: "Upload v2 → Breaking change detected → Migration plan generated"
- CTA: `View on GitHub` button (outlined, star-white)

---

### `CallToAction.jsx`
- Section title: "Why We Win"
- **3 metric counters** (AnimatedCounter, count up on entry):
  - `5` MCP Tools
  - `3` Demo Scenarios
  - `10` Responsible AI Guardrails
- **Judging criteria alignment** — 4 glass pills:
  - ✅ Innovation: Tool-first MCP architecture
  - ✅ Technical Depth: pgvector + Claude tool_use + schema validation
  - ✅ Responsible AI: 10 built-in guardrails
  - ✅ Demo Polish: 3 clean flows, 4 minutes
- **Closing pitch** (centred, large, Exo 2, text-gradient-cyan):
  > "Self-Aware API Platform. Living infrastructure for the agentic era."
- **Team / timestamp** (small, muted): `Built in 48 hours · March 2026`
- Floating star particles (extra density on this section)

---

## Global Rules for Every Component

1. **All animations use Framer Motion** — `motion.div` with `initial`, `animate`, `whileInView`
2. **Scroll reveals**: `useInView` from `react-intersection-observer`, `triggerOnce: true`, `threshold: 0.1`
3. **Every section**: `min-h-screen`, `relative`, `z-10` (above star field which is z-0)
4. **Section padding**: `py-24 px-6 md:px-12 lg:px-24`
5. **Max content width**: `max-w-7xl mx-auto`
6. **No external image dependencies** — all visuals are CSS/SVG/JSX
7. **Mobile responsive**: stack grids to single column below `md:` breakpoint
8. **Performance**: StarField canvas uses `will-change: transform`, all animations `transform` only (no layout thrash)

---

## Deployment Instructions to Include in README

After building, add `presentation/README.md` with:

```markdown
## Deploy to Vercel

\`\`\`bash
cd ~/self-aware-api-platform/presentation

# First deploy
vercel

# Production deploy
vercel --prod
\`\`\`

Set no environment variables — this is a pure static site.
Vercel auto-detects Vite. Build command: \`npm run build\`. Output: \`dist/\`.
```

---

## Start Here

1. Replace `src/App.jsx` completely — import and render all sections in order
2. Build `StarField.jsx` first — it anchors the entire visual
3. Build `Navigation.jsx` second — it needs section IDs from the others
4. Then build sections in order: Hero → Problem → Solution → Architecture → MCPTools → DemoFlow → TechStack → ResponsibleAI → LiveDemo → CallToAction
5. Build shared UI components (`GlassCard`, `SectionHeader`, `Badge`) before the sections that use them
6. After each section: run `npm run dev` in the presentation folder and verify it renders
7. Final step: run `npm run build` — confirm zero errors — then `vercel --prod`