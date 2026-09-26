import { createFileRoute } from "@tanstack/react-router";
import { clearCookie, json } from "@/lib/auth/auth.server";

export const Route = createFileRoute("/api/auth/logout")({
  server: {
    handlers: {
      POST: async () => json({ ok: true }, 200, { "set-cookie": clearCookie() }),
    },
  },
});
