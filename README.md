# Agentic Remix Discovery PM Studio

A six-agent orchestration that ingests a coded customer-interview corpus — pain observations, behaviors, desired outcomes, workarounds, quotes — and produces a discovery synthesis brief for a product trio: user pain clusters with cross-segment evidence, said-vs-did contradictions that PMs care most about, recommendations sorted into Build / Research / Deprioritize, and the open questions for the next research round.

Built with **React 18 + Vite**, deployed to **Cloudflare Pages**, powered by the **Anthropic Claude API** (Opus 4.7 by default).

---

## What this is for

A senior PM who runs proper discovery rounds — codes their own interviews, weighs showed-me evidence above told-me, watches for leading-question artifacts, distinguishes vocal-minority noise from real cross-segment patterns. The synthetic demo is a fictional B2B SaaS analytics company called Brightline, investigating why existing customers love daily use but aren't expanding into new teams or higher tiers. The corpus is engineered to surface the patterns a working PM would expect to find: the second-user problem, power-user plateau, champion burnout, AI-native tool substitution, and one noise-flagged mobile pattern.

## Architecture

The six agents (Ingestion → Theme → Contradiction → Recommendation → Critic → Memo) run sequentially, with strict JSON contracts between them. Each call goes through a Cloudflare Pages Function proxy that keeps your API key off the browser.

```
  Browser (React)          Cloudflare Edge          Anthropic
  ┌──────────────┐        ┌──────────────────┐    ┌──────────┐
  │ Discovery    │ POST   │ /api/claude      │    │ /v1/     │
  │ fetch(       │──────▶ │ functions/api/   │──▶ │ messages │
  │   "/api/     │        │ claude.js        │    │          │
  │   claude")   │◀────── │ adds x-api-key   │◀── │          │
  └──────────────┘  JSON  │ from env var     │    └──────────┘
                          └──────────────────┘
```

**Two execution modes:**
- **DEMO** — replays a hand-curated gold-run synthesis, no API calls, instant.
- **LIVE** — calls Anthropic API through the proxy. Full pipeline ~60-120s on Opus 4.7.

## Discovery-specific UI

Differs from the exec-mix sibling in four ways visible to the user:

1. **Theme cards show segment coverage** — every theme displays which user segments it draws from (power_user, stalled_champion, secondary_teammate, churned), so a reader can see at a glance whether a theme is cross-segment or vocal-minority.

2. **Contradiction cards carry a type badge** — Said vs. did / Cross-segment / Leading-question artifact. The said-vs-did pattern is PM gold; the leading-question artifact is the methodology check that distinguishes a careful synthesis from a credulous one.

3. **Recommendations grouped under three subheadings** — Build, Research, Deprioritize. Each has a distinct visual treatment. Card numbering stays continuous across groups. Exactly one recommendation in the set is marked as the Hard Call.

4. **Critic outputs an "Open questions for next research round" section** — bridges this round to the next one. Discovery is iterative; PMs think in cycles; the critic produces the agenda for the follow-up.

## Prerequisites

- [Node.js](https://nodejs.org/) 20 or newer
- An [Anthropic API key](https://console.anthropic.com/) with billing
- A free [Cloudflare account](https://dash.cloudflare.com/sign-up)
- [GitHub](https://github.com/) account (for Git-connected deploy)

## Quick start — local development

```bash
# 1. Install dependencies
npm install

# 2. Configure your local API key
cp .dev.vars.example .dev.vars
# Open .dev.vars and paste your Anthropic key

# 3. Run with the local Pages Function proxy
npm run dev:local
```

Visit the URL it prints (usually `http://localhost:8788`). Toggle DEMO → LIVE in the header and click **Run discovery synthesis** to exercise the full Opus 4.7 pipeline.

> Plain `npm run dev` runs Vite without the Pages Function — useful for UI-only work in DEMO mode, but LIVE mode will fail with a 404 on `/api/claude`.

## Deploy to Cloudflare Pages

### Option A — Connect to GitHub

1. Push this project to a new GitHub repo:
   ```bash
   git init && git add . && git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR-USERNAME/remix-discovery-studio.git
   git push -u origin main
   ```

2. In the Cloudflare dashboard: **Workers & Pages** → **Create** → **Pages** tab → **Connect to Git** → select the repo. Build settings:
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Build output directory: `dist`

3. Add the API key — **Settings** → **Environment variables** → `ANTHROPIC_API_KEY` (encrypted, both Production and Preview).

4. Redeploy to pick up the env var.

### Option B — Deploy via CLI

```bash
npx wrangler login
npm run deploy
# First time prompts for project name; pick e.g. remix-discovery-studio

# Set production secret via CLI (preferred over dashboard)
npx wrangler pages secret put ANTHROPIC_API_KEY --project-name=remix-discovery-studio

# Redeploy with the secret in place
npm run deploy
```

## Configuration

Default model is **`claude-opus-4-7`** — the strongest current model. Edit `src/DiscoveryStudio.jsx`:

```js
const MODEL = "claude-opus-4-7";        // Gold-run target
// const MODEL = "claude-sonnet-4-6";   // Faster, cheaper, meaningful quality drop
// const MODEL = "claude-haiku-4-5-20251001";  // Iteration only
```

## Cost estimate

Per full pipeline run on Opus 4.7: ~25-35k input tokens, ~5-8k output tokens. Roughly **$0.20-0.40 per run** at current pricing ($5 input / $25 output per million tokens). Set a budget alert at [console.anthropic.com](https://console.anthropic.com/) → Settings → Limits before extensive testing.

## Project structure

```
remix-discovery-studio/
├── functions/
│   └── api/
│       └── claude.js         # Pages Function — Anthropic proxy
├── src/
│   ├── main.jsx              # React root
│   ├── index.css             # Minimal base styles
│   └── DiscoveryStudio.jsx   # The app — agents, UI, dataset, prompts
├── index.html                # Vite entry HTML
├── vite.config.js
├── package.json
├── .gitignore
├── .dev.vars.example
├── .nvmrc
└── README.md
```

## What's in the synthetic dataset

35 chunks across 14 interviews:
- 12 pain_observation, 8 behavior_observation, 8 desired_outcome, 4 workaround, 3 quote
- 3 power users, 4 stalled champions, 5 secondary teammates, 2 churned/downgraded
- 18 PM, 6 Marketer, 4 Engineer, 3 Designer, 3 Founder, 1 Analyst
- April 2 - April 15, 2026

Engineered patterns the live pipeline should surface:
- 4 real themes + 1 noise-flagged theme
- 1 said-vs-did contradiction (the highest-leverage one)
- 1 cross-segment contradiction
- 1 leading-question artifact (methodology flag, not product flag)
- 5 recommendations across Build / Research / Deprioritize
- 1 hard call (deprioritize mobile)

## Troubleshooting

**`npm run dev:local` errors with "wrangler: command not found":**
Run `npm install` first — wrangler is a devDependency.

**LIVE mode returns `ANTHROPIC_API_KEY not configured on server`:**
Local: `.dev.vars` missing or wrongly named. Production: env var unset / not encrypted / not deployed yet — verify in Pages settings then redeploy.

**Cloudflare build fails with module errors:**
Add `NODE_VERSION=20` in Pages → Settings → Environment variables.

**Pipeline hangs >2 min:**
Expected on Opus 4.7. Switch `MODEL` to `claude-sonnet-4-6` for ~3x speedup if you're iterating.

## Sibling product

**Remix Studio** (exec mix) is the sister product — same six-agent platform, same architecture, applied to weekly cross-functional executive signal mix instead of customer interview synthesis. Separate repo, separate deployment, separate buyer.

## License

Apache 2.0
