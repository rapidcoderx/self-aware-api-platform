---
name: check-progress
description: Read current build state from CLAUDE.md, summarise what is done, what remains, and recommend the next module to build with a time estimate.
agent: API Platform Planner
tools: ['codebase', 'search']
---

Read `CLAUDE.md` in the project root and analyse the Build Progress Tracker section.

## Report the following

### ✅ Completed modules
List every ticked item with a one-line description of what it does.

### 🔲 Remaining modules
List every unticked item grouped by Day 1 (spine) vs Day 2 (differentiators).

### 📍 Current position
- Are we on track for the Day 1 exit gate?
  > *"Ask a question → agent finds endpoint → produces payload → validates successfully"*
- Are we on track for the Day 2 exit gate?
  > *"Upload v2 → platform flags breaking change → suggests and validates fix → demo ready"*

### ⏭ Recommended next module
Based on build order dependencies, state:
1. **Which module to build next** and why (what it unblocks)
2. **Time estimate** (use these benchmarks):
   - Simple CRUD module: 20–30 min
   - Tool implementation: 25–40 min
   - Agent orchestrator: 45–60 min
   - MCP server wiring: 30–40 min
   - React component (simple): 20–30 min
   - React component (complex): 40–60 min
3. **The exact prompt to paste** into the Builder agent to start it

### ⚠️ Risk flags
- Any missing dependencies that would block the next module
- Any modules that are partially implemented (file exists but may be incomplete)
- Any `.env` keys that may not be configured yet

### 🎬 Demo path status
Rate each demo flow: **SAFE** / **AT RISK** / **BLOCKED**
- Demo 1 (Discover & Validate): [status]
- Demo 2 (Breaking Change): [status]
- Demo 3 (Self-Heal): [status]