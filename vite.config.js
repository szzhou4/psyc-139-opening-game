import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/**
 * In production Vercel serves api/claude.js as a serverless function. The plain
 * Vite dev server doesn't know about /api, so this plugin mounts the very same
 * file during `npm run dev` behind a small Node-request shim.
 *
 * Running the identical handler in both places means local testing actually
 * exercises the deployed code path — no second implementation to drift.
 */
function claudeApiDevPlugin(env) {
  return {
    name: "claude-api-dev",
    configureServer(server) {
      server.middlewares.use("/api/claude", async (req, res) => {
        // The handler reads the key from process.env, same as on Vercel.
        if (env.ANTHROPIC_API_KEY) {
          process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
        }

        try {
          const body = await readJsonBody(req);
          req.body = body;

          // Give the Node response the Express-ish helpers Vercel provides.
          res.status = (code) => {
            res.statusCode = code;
            return res;
          };
          res.json = (payload) => {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(payload));
            return res;
          };

          const { default: handler } = await server.ssrLoadModule("/api/claude.js");
          await handler(req, res);
        } catch (err) {
          server.config.logger.error(`[claude-api-dev] ${err.stack || err}`);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Dev proxy failed — see terminal" }));
        }
      });
    },
  };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.method === "GET" || req.method === "OPTIONS") return resolve(undefined);
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw) return resolve(undefined);
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

export default defineConfig(({ mode }) => {
  // Third arg "" loads every var, not just VITE_-prefixed ones. ANTHROPIC_API_KEY
  // is intentionally unprefixed so Vite never inlines it into the bundle.
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), claudeApiDevPlugin(env)],
    base: "/",
  };
});
