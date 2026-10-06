import { createFileRoute } from "@tanstack/react-router";
import { requireAdmin } from "@/lib/auth/auth.server";

// Example of mode C: pure API route guard.
export const Route = createFileRoute("/api/protected/data")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { user, response, setCookie } = await requireAdmin(request, { sameSite: "None" });
        if (response) return response;
        return new Response(
          JSON.stringify({ secret: "Quarterly numbers: +42%", servedTo: user!.username, at: new Date().toISOString() }),
          { headers: { "content-type": "application/json", ...(setCookie && { "set-cookie": setCookie }) } },
        );
      },
    },
  },
});
