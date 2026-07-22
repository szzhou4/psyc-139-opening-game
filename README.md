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
   `ANTHROPIC_API_KEY=sk-ant-...`
5. Run `npm run dev`

The app runs without a key — it falls back to the generic wording in
`src/data/decisions.js` — but nothing will be personalized.

> **The variable has no `VITE_` prefix, and that is deliberate.** Vite inlines
> `VITE_`-prefixed variables into the browser bundle. This key is read
> server-side by `api/claude.js` instead, so it never reaches the client.
> Renaming it to `VITE_ANTHROPIC_API_KEY` would publish it to every visitor.

## Before First Use

`src/data/decisions.js` (11 decision points) and `src/data/knowledgeBase.js`
(career science summary) are already populated and ready to use as-is.
Review and edit their content if you want to adjust scenarios or emphasis.

Model is set in `src/api/claudeClient.js` (`claude-sonnet-4-5`).

## How the API key is protected

The browser never receives the key. `src/api/claudeClient.js` posts to
`/api/claude`, a serverless function (`api/claude.js`) that adds the key
server-side and forwards the request to Anthropic.

That endpoint is deliberately narrow so it can't be repurposed as a free
general-purpose Claude proxy if someone finds the URL:

- the model and token ceiling are pinned in the function, not sent by the client
- only `system` and `messages` are forwarded
- requests must come from an allowed origin
- payloads over 100 KB are rejected

`npm run dev` mounts the *same* function file via a small plugin in
`vite.config.js`, so local testing exercises the deployed code path rather than
a second implementation that could drift.

**GitHub Pages is not suitable for this app.** Pages serves static files only —
there is no server to hold the key — so the only way to deploy there is to inline
the key into the bundle, where anyone can read it. Use Vercel (below).

## Deployment (Vercel)

One-time setup:

1. Go to [vercel.com/new](https://vercel.com/new) and sign in with GitHub.
2. Import `szzhou4/psyc-139-opening-game`. Vercel detects Vite automatically —
   accept the defaults (build `npm run build`, output `dist`).
3. Before the first deploy, expand **Environment Variables** and add:
   - Name: `ANTHROPIC_API_KEY`
   - Value: your key
   - Environment: **Production and Preview**
4. Click **Deploy**.

> Vercel pre-selects **Development**, which is the one option that won't work
> here — it only applies to the `vercel dev` CLI, and local `npm run dev` reads
> `.env.local` instead. Deployed builds read **Production**; leaving the default
> selected makes the live site report `configured: false`.

You get a URL like `https://psyc-139-opening-game.vercel.app` — that's the link
for students. Every `git push` to `main` redeploys automatically.

If you add or change the key later, **redeploy** — environment variables are
read at deploy time, so an existing deployment won't pick up a new value.

### Verifying a deployment

Visit `https://<your-app>.vercel.app/api/claude` in a browser. It should return:

```json
{ "configured": true }
```

`false` means the environment variable didn't reach the deployment — check the
name is exactly `ANTHROPIC_API_KEY` (no `VITE_` prefix) and redeploy.

To confirm the key is not in the client bundle, run `npm run build` and search
`dist/` for `sk-ant`. It should return nothing.

### Rotating the key

Because the key stays server-side, it no longer has to be rotated after every
class. Update it in **Vercel → Settings → Environment Variables**, then
redeploy. Setting a spend limit in the Anthropic Console is still worthwhile.

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
