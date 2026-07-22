/**
 * Serverless proxy for the Anthropic API.
 *
 * The browser never sees the API key. The key lives in the ANTHROPIC_API_KEY
 * environment variable on the server (note: no VITE_ prefix — that prefix is
 * exactly what would inline it into the client bundle).
 *
 * The endpoint is deliberately narrow so it can't be repurposed as a free
 * general-purpose Claude proxy if someone finds the URL:
 *
 *   - the model and token ceiling are pinned here, not accepted from the client
 *   - only `system` and `messages` are forwarded
 *   - requests must come from an allowed origin
 *   - payload size is capped
 *
 * GET  /api/claude  -> { configured: boolean }   (health check for the UI)
 * POST /api/claude  -> proxied Anthropic response
 */

const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 1000;
const MAX_PAYLOAD_BYTES = 100_000;

/**
 * Same-origin requests are always allowed. ALLOWED_ORIGINS is only needed if
 * the front end is ever hosted somewhere other than the API (e.g. keeping the
 * github.io URL and pointing it at this function).
 */
function isOriginAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // curl, server-side calls, same-origin GETs

  const extra = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (extra.includes(origin)) return true;

  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // Health check — lets the UI warn the instructor if the key isn't set,
  // without revealing anything about the key itself.
  if (req.method === "GET") {
    return res.status(200).json({ configured: Boolean(apiKey) });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isOriginAllowed(req)) {
    return res.status(403).json({ error: "Origin not allowed" });
  }

  if (!apiKey) {
    return res.status(503).json({
      error:
        "ANTHROPIC_API_KEY is not set on the server. Add it in the Vercel " +
        "project settings (Settings -> Environment Variables) and redeploy.",
    });
  }

  const { system, messages } = req.body ?? {};
  if (!system || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Expected { system, messages }" });
  }

  if (JSON.stringify(req.body).length > MAX_PAYLOAD_BYTES) {
    return res.status(413).json({ error: "Payload too large" });
  }

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      // model and max_tokens are set here, never taken from the client
      body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, system, messages }),
    });

    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (err) {
    console.error("Anthropic proxy error:", err);
    return res.status(502).json({ error: "Upstream request failed" });
  }
}
