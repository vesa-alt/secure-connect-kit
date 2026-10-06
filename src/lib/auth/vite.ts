// Vite plugin: serves /api/auth/* from `vite dev` and `vite preview` — no extra server needed locally.
// Loads SESSION_SECRET, ADMIN_* and AUTH_* from your .env files (Vite does not put them in process.env itself).
import { loadEnv, type Plugin } from "vite";
import { createAuthHandler, type AuthOptions } from "./auth.server";
import { toNodeMiddleware } from "./node";

const KEYS = ["SESSION_SECRET", "AUTH_USERNAME", "AUTH_PASSWORD_HASH", "ADMIN_USERNAME", "ADMIN_PASSWORD_HASH", "AUTH_APP_NAME", "AUTH_ENABLED", "AUTH_SESSION_TTL", "AUTH_COOKIE_SAMESITE"];

export function sharedEnvLogin(opts?: AuthOptions): Plugin {
  let mw: ReturnType<typeof toNodeMiddleware>;
  return {
    name: "sharedenv-login",
    configResolved(config) {
      const fileEnv = loadEnv(config.mode, config.envDir || config.root, "");
      for (const k of KEYS) if (fileEnv[k] && !process.env[k]) process.env[k] = fileEnv[k];
      mw = toNodeMiddleware(createAuthHandler(opts));
    },
    configureServer: (s) => void s.middlewares.use((req, res, next) => mw(req, res, next)),
    configurePreviewServer: (s) => void s.middlewares.use((req, res, next) => mw(req, res, next)),
  };
}
