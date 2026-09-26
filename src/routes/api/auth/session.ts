import { createFileRoute } from "@tanstack/react-router";
import { getSession, json } from "@/lib/auth/auth.server";

export const Route = createFileRoute("/api/auth/session")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { user, setCookie } = await getSession(request);
        return json({ user }, 200, setCookie ? { "set-cookie": setCookie } : {});
      },
    },
  },
});
