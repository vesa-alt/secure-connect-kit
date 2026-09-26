import { createFileRoute } from "@tanstack/react-router";
import { json, requireAdmin } from "@/lib/auth/auth.server";

// Example of mode C: pure API route guard.
export const Route = createFileRoute("/api/protected/data")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { user, response, setCookie } = await requireAdmin(request);
        if (response) return response;
        return json(
          { secret: "Quarterly numbers: +42%", servedTo: user!.username, at: new Date().toISOString() },
          200,
          setCookie ? { "set-cookie": setCookie } : {},
        );
      },
    },
  },
});
