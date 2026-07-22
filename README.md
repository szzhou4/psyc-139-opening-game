# Career Simulation — PSYC 139, CMC

A browser-based career simulation for the first day of *The Science of Careers,
Purpose, and Vocational Identity*. Students enter four pieces of background,
work through 11 career decision points personalized by the Claude API, and
finish with an animated map of the path they built plus a generated narrative
of their simulated working life.

Target completion time: 15–20 minutes.

## Setup

1. Clone the repo
2. Run `npm install`
3. Copy `.env.example` to `.env.local`
4. Add your Anthropic API key to `.env.local`:
   `VITE_ANTHROPIC_API_KEY=sk-ant-...`
5. Run `npm run dev`

The app runs without a key — it falls back to the generic wording in
`src/data/decisions.js` — but nothing will be personalized.

## Before First Use

`src/data/decisions.js` (11 decision points) and `src/data/knowledgeBase.js`
(career science summary) are already populated and ready to use as-is.
Review and edit their content if you want to adjust scenarios or emphasis.

Model is set in `src/api/claudeClient.js` (`claude-sonnet-4-5`).

## Deployment

Run `npm run build`, then deploy the `dist/` folder to GitHub Pages.

`vite.config.js` uses `base: "./"`, which works for both project pages
(`user.github.io/repo/`) and root pages.

### ⚠️ Key exposure

`vite build` inlines `VITE_ANTHROPIC_API_KEY` into the JavaScript bundle. Anyone
who loads the page can extract it from the source. That is an accepted tradeoff
for a single class session, but:

- Set a **spend limit** on the key in the Anthropic Console before class.
- **Rotate or revoke the key immediately after class.**

For repeat use across semesters, move the API call behind a small serverless
proxy (Cloudflare Worker, Vercel function) so the key stays server-side, and
point `callClaude` in `src/api/claudeClient.js` at that endpoint instead.

## Cost estimate

Each student makes 11 scenario calls plus 3 finale calls (14 total).

The Anthropic API is stateless, so the ~3,900-token knowledge base must be sent
with every one of those calls — there is no way to upload it once. Instead,
`claudeClient.js` marks it as a **cached prefix**, so the API charges full price
for it only once and bills every later call at 10% of the input rate.

The cached block is byte-identical for every student, so the *entire class*
shares one cache entry, not one per student. For a 25-student section that turns
roughly 1.4M billed input tokens into roughly 140k.

Budget well under $0.05 per student on Sonnet, dominated by output tokens rather
than the knowledge base.

### Warming the cache before class

Concurrent requests can't read a cache entry that's still being written. If 25
students hit "Begin" at the same instant, each of those first calls pays the
full write. To avoid it, **open the app yourself and complete one decision a
minute or two before class starts** — that writes the entry once, and every
student then reads it.

The one-hour TTL is set so a single warm-up covers the whole class period.

### Verifying it works

Open the browser console during a run. Each call logs:

```
[cache] read=3921 write=0 uncached=134
```

A warm cache shows a large `read` and a small `uncached`. If `read` stays at 0
across calls, something is invalidating the prefix — check that nothing
per-student or time-varying was added ahead of the cache breakpoint in
`buildSystem()`.

## Architecture notes

- **Prefetching:** `App.jsx` generates the *next* scenario while the student
  reads the current one, so only the first decision has a visible wait.
- **Error handling:** any failed scenario call falls back to that decision's
  `baseScenarioFrame`; the finale falls back to generic text. Errors are logged
  to the console and never crash the run.
- **No gamification:** no score, no points, no correct-answer feedback.
- **Styling:** hand-written CSS in `src/index.css` rather than Tailwind — the
  design system is small and fixed, and the avatar/road animations are keyframe
  work that gains nothing from utility classes.
