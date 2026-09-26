// Vite plugin: serves /api/auth/* from `vite dev` and `vite preview` — no extra server needed locally.
import type { Plugin } from "vite";
import { createAuthHandler, type AuthOptions } from "./auth.server";
import { toNodeMiddleware } from "./node";

export function sharedEnvLogin(opts?: AuthOptions): Plugin {
  const mw = toNodeMiddleware(createAuthHandler(opts));
  return {
    name: "sharedenv-login",
    configureServer: (s) => void s.middlewares.use(mw),
    configurePreviewServer: (s) => void s.middlewares.use(mw),
  };
}
