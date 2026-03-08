#!/bin/bash

# =============================================================================
# Self-Aware API Platform — Presentation Site Bootstrap
# Creates a Vite + React + Tailwind presentation app at:
#   ~/self-aware-api-platform/presentation/
# Deploys to Vercel with zero config
# =============================================================================

PROJECT_ROOT="$HOME/self-aware-api-platform"
PRES_DIR="$PROJECT_ROOT/presentation"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# --------------------------------------------------------------------------
# Ensure project root exists before touching the log
# --------------------------------------------------------------------------
if [ ! -d "$PROJECT_ROOT" ]; then
  echo -e "${YELLOW}  ⚠️  ${NC}Project root not found at $PROJECT_ROOT"
  echo -e "${CYAN}  →  ${NC}Creating project root..."
  mkdir -p "$PROJECT_ROOT"
fi

LOGFILE="$PROJECT_ROOT/bootstrap-presentation.log"
echo "" > "$LOGFILE"

log()     { echo -e "$1" | tee -a "$LOGFILE"; }
ok()      { log "${GREEN}  ✅ ${NC}$1"; }
info()    { log "${CYAN}  →  ${NC}$1"; }
warn()    { log "${YELLOW}  ⚠️  ${NC}$1"; }
fail()    { log "${RED}  ❌ FATAL:${NC} $1"; exit 1; }
section() { log "\n${CYAN}${BOLD}── $1 ──────────────────────────────────────────${NC}"; }

log "${BOLD}"
log "============================================================"
log "  Self-Aware API Platform — Presentation Bootstrap"
log "  Target: $PRES_DIR"
log "  $(date)"
log "============================================================${NC}"

# ==========================================================================
# 0. Pre-flight checks
# ==========================================================================
section "0 — PRE-FLIGHT"

command -v node &>/dev/null || fail "Node.js not found. Run: brew install node"
NODE_VER=$(node --version)
NODE_MAJOR=$(echo "$NODE_VER" | sed 's/v\([0-9]*\).*/\1/')
[ "$NODE_MAJOR" -ge 18 ] || fail "Node.js $NODE_VER is too old — need v18+. Run: brew upgrade node"
ok "Node.js: $NODE_VER"

command -v npm &>/dev/null || fail "npm not found"
ok "npm: v$(npm --version)"

command -v git &>/dev/null || fail "git not found"
ok "git available"

# Check Vercel CLI (warn only — can install later)
if command -v vercel &>/dev/null; then
  ok "Vercel CLI: $(vercel --version 2>/dev/null | head -1)"
else
  warn "Vercel CLI not installed — will install in step 6"
fi

# ==========================================================================
# 1. Guard — handle existing presentation dir
# ==========================================================================
section "1 — DIRECTORY GUARD"

if [ -d "$PRES_DIR" ]; then
  warn "Presentation dir already exists: $PRES_DIR"
  read -r -p "  Overwrite? This deletes existing presentation [y/N]: " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    log "Aborted — existing presentation preserved."
    exit 0
  fi
  rm -rf "$PRES_DIR"
  ok "Removed existing presentation dir"
fi

# ==========================================================================
# 2. Scaffold Vite + React project
# ==========================================================================
section "2 — VITE + REACT SCAFFOLD"

info "Scaffolding Vite React project at $PRES_DIR..."
cd "$PROJECT_ROOT"
npm create vite@latest presentation -- --template react 2>&1 | tee -a "$LOGFILE"
[ -d "$PRES_DIR" ] || fail "Vite scaffold failed — check npm output above"
ok "Vite React project created"

cd "$PRES_DIR"

# ==========================================================================
# 3. Install core dependencies
# ==========================================================================
section "3 — DEPENDENCIES"

info "Installing base dependencies..."
npm install 2>&1 | tee -a "$LOGFILE"
ok "Base deps installed"

info "Installing Tailwind CSS..."
npm install -D tailwindcss@3 postcss autoprefixer 2>&1 | tee -a "$LOGFILE"
npx tailwindcss init -p 2>&1 | tee -a "$LOGFILE"
ok "Tailwind CSS 3 installed"

info "Installing animation + UI libraries..."
npm install \
  framer-motion \
  react-intersection-observer \
  react-type-animation \
  react-countup \
  react-syntax-highlighter \
  lucide-react \
  clsx \
  2>&1 | tee -a "$LOGFILE"
ok "Animation + UI libraries installed"

info "Installing font packages..."
npm install -D @fontsource/space-grotesk @fontsource/inter 2>&1 | tee -a "$LOGFILE"
ok "Font packages installed"

# ==========================================================================
# 4. Configure Tailwind
# ==========================================================================
section "4 — TAILWIND CONFIG"

cat > "$PRES_DIR/tailwind.config.js" << 'EOF'
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand palette — starry dark theme
        space: {
          950: '#020409',
          900: '#050d1a',
          800: '#0a1628',
          700: '#0f2040',
          600: '#162d57',
        },
        star: {
          white: '#F8FAFF',
          blue:  '#A8D8F0',
          gold:  '#FFD700',
          cyan:  '#00E5FF',
          purple:'#B388FF',
        },
        accent: {
          primary:  '#2E86AB',
          breaking: '#FF4444',
          safe:     '#00E676',
          warning:  '#FFB300',
        }
      },
      fontFamily: {
        display: ['"Exo 2"', 'sans-serif'],
        body:    ['"DM Sans"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'twinkle':      'twinkle 3s ease-in-out infinite',
        'twinkle-slow': 'twinkle 5s ease-in-out infinite',
        'float':        'float 6s ease-in-out infinite',
        'pulse-glow':   'pulseGlow 2s ease-in-out infinite',
        'slide-up':     'slideUp 0.6s ease-out forwards',
        'fade-in':      'fadeIn 0.8s ease-out forwards',
        'orbit':        'orbit 20s linear infinite',
        'shooting-star':'shootingStar 3s linear infinite',
      },
      keyframes: {
        twinkle: {
          '0%, 100%': { opacity: 1,   transform: 'scale(1)' },
          '50%':      { opacity: 0.2, transform: 'scale(0.7)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-20px)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(0, 229, 255, 0.3)' },
          '50%':      { boxShadow: '0 0 30px rgba(0, 229, 255, 0.8)' },
        },
        slideUp: {
          from: { opacity: 0, transform: 'translateY(30px)' },
          to:   { opacity: 1, transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: 0 },
          to:   { opacity: 1 },
        },
        orbit: {
          from: { transform: 'rotate(0deg) translateX(120px) rotate(0deg)' },
          to:   { transform: 'rotate(360deg) translateX(120px) rotate(-360deg)' },
        },
        shootingStar: {
          '0%':   { transform: 'translateX(-100px) translateY(-100px)', opacity: 1 },
          '70%':  { opacity: 1 },
          '100%': { transform: 'translateX(300px) translateY(300px)', opacity: 0 },
        },
      },
      backgroundImage: {
        'nebula': 'radial-gradient(ellipse at 20% 50%, rgba(46,134,171,0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(179,136,255,0.1) 0%, transparent 50%)',
        'grid-glow': 'linear-gradient(rgba(46,134,171,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(46,134,171,0.05) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
}
EOF
ok "tailwind.config.js written"

# ==========================================================================
# 5. Base CSS + Google Fonts
# ==========================================================================
section "5 — BASE CSS"

cat > "$PRES_DIR/src/index.css" << 'EOF'
/* Google Fonts — loaded in index.html for performance */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    background-color: #020409;
    color: #F8FAFF;
    font-family: 'DM Sans', sans-serif;
    overflow-x: hidden;
  }
  ::selection {
    background: rgba(0, 229, 255, 0.3);
    color: #F8FAFF;
  }
}

@layer utilities {
  .text-gradient-cyan {
    background: linear-gradient(135deg, #00E5FF, #2E86AB);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .text-gradient-gold {
    background: linear-gradient(135deg, #FFD700, #FF8C00);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .text-gradient-purple {
    background: linear-gradient(135deg, #B388FF, #7B1FA2);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .glass {
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }
  .glow-cyan {
    box-shadow: 0 0 20px rgba(0, 229, 255, 0.25),
                0 0 40px rgba(0, 229, 255, 0.1);
  }
  .glow-text-cyan {
    text-shadow: 0 0 20px rgba(0, 229, 255, 0.6);
  }
  .border-glow {
    border: 1px solid rgba(0, 229, 255, 0.3);
    box-shadow: inset 0 0 20px rgba(0, 229, 255, 0.05);
  }
}

/* Scrollbar */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: #020409; }
::-webkit-scrollbar-thumb {
  background: rgba(0, 229, 255, 0.3);
  border-radius: 2px;
}
EOF
ok "index.css written"

# Update index.html with Google Fonts
cat > "$PRES_DIR/index.html" << 'EOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Self-Aware API Platform</title>
    <meta name="description" content="Agentic API Intelligence using MCP, Change Detection, and Schema-Aware Reasoning" />
    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Exo+2:wght@300;400;600;700;900&family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
EOF
ok "index.html updated with Google Fonts"

# Favicon
cat > "$PRES_DIR/public/favicon.svg" << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <circle cx="16" cy="16" r="15" fill="#020409" stroke="#00E5FF" stroke-width="1.5"/>
  <circle cx="16" cy="16" r="3" fill="#00E5FF"/>
  <circle cx="16" cy="16" r="8" fill="none" stroke="#2E86AB" stroke-width="1" stroke-dasharray="3 2"/>
  <circle cx="24" cy="16" r="2" fill="#B388FF"/>
</svg>
EOF
ok "favicon.svg created"

# ==========================================================================
# 6. Placeholder App.jsx — replaced by Copilot prompt
# ==========================================================================
section "6 — PLACEHOLDER APP"

cat > "$PRES_DIR/src/App.jsx" << 'EOF'
import './index.css'

export default function App() {
  return (
    <div className="min-h-screen bg-space-950 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-display font-bold text-gradient-cyan mb-4">
          Self-Aware API Platform
        </h1>
        <p className="text-star-blue text-lg">
          Bootstrap complete — run the Copilot prompt to build the full presentation
        </p>
        <p className="text-gray-500 text-sm mt-4">
          /build-presentation in VS Code Copilot Chat
        </p>
      </div>
    </div>
  )
}
EOF
ok "Placeholder App.jsx created"

# ==========================================================================
# 7. Vercel config
# ==========================================================================
section "7 — VERCEL CONFIG"

cat > "$PRES_DIR/vercel.json" << 'EOF'
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
EOF
ok "vercel.json created"

# .vercelignore
cat > "$PRES_DIR/.vercelignore" << 'EOF'
node_modules
.env
*.log
EOF
ok ".vercelignore created"

# ==========================================================================
# 8. Vercel CLI
# ==========================================================================
section "8 — VERCEL CLI"

if ! command -v vercel &>/dev/null; then
  info "Installing Vercel CLI globally..."
  npm install -g vercel 2>&1 | tee -a "$LOGFILE"
  if command -v vercel &>/dev/null; then
    ok "Vercel CLI installed: $(vercel --version 2>/dev/null | head -1)"
  else
    warn "Vercel CLI install may have failed — check npm output. Install manually: npm i -g vercel"
  fi
else
  ok "Vercel CLI already present: $(vercel --version 2>/dev/null | head -1)"
fi

# ==========================================================================
# 9. Git — add presentation to existing repo
# ==========================================================================
section "9 — GIT"

cd "$PROJECT_ROOT"
if [ -d ".git" ]; then
  git add presentation/ 2>/dev/null
  git commit -q -m "chore: add presentation site scaffold" 2>/dev/null \
    && ok "Committed presentation scaffold to existing git repo" \
    || warn "Git commit skipped (nothing new or git issue)"
else
  warn "No git repo found at $PROJECT_ROOT — run bootstrap-project.sh first to init git"
fi

# ==========================================================================
# 10. Dev server smoke test
# ==========================================================================
section "10 — SMOKE TEST"

info "Starting dev server briefly to verify build..."
cd "$PRES_DIR"
npm run build 2>&1 | tee -a "$LOGFILE"
if [ -d "$PRES_DIR/dist" ]; then
  ok "Production build succeeded — dist/ folder created"
else
  warn "Build may have had issues — check output above"
fi

# ==========================================================================
# SUMMARY
# ==========================================================================
section "BOOTSTRAP COMPLETE"

log ""
log "${GREEN}${BOLD}  Presentation site ready at: $PRES_DIR${NC}"
log ""
log "  ${BOLD}Next steps:${NC}"
log ""
log "  1. Open VS Code in the presentation folder:"
log "     ${CYAN}code $PRES_DIR${NC}"
log ""
log "  2. Run the build prompt in Copilot Chat:"
log "     ${CYAN}/build-presentation${NC}  (or paste the prompt from build-presentation.prompt.md)"
log ""
log "  3. Start dev server to preview:"
log "     ${CYAN}cd $PRES_DIR && npm run dev${NC}"
log "     Open: http://localhost:5173"
log ""
log "  4. Deploy to Vercel:"
log "     ${CYAN}cd $PRES_DIR && vercel${NC}          ← first deploy (follow prompts)"
log "     ${CYAN}cd $PRES_DIR && vercel --prod${NC}   ← subsequent deploys"
log ""
log "  ${BOLD}Stack:${NC} React 18 + Vite 5 + Tailwind 3 + Framer Motion"
log "  ${BOLD}Fonts:${NC} Exo 2 (display) · DM Sans (body) · JetBrains Mono (code)"
log "  ${BOLD}Theme:${NC} Deep space dark · animated star field · cyan/gold accents"
log ""
log "  Log saved to: $LOGFILE"
log ""