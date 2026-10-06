import { createFileRoute } from "@tanstack/react-router";
import { createAuthHandler } from "@/lib/auth/auth.server";

const handle = async ({ request }: { request: Request }) =>
  (await createAuthHandler({ sameSite: "None" })(request)) ?? new Response("Not found", { status: 404 });

export const Route = createFileRoute("/api/auth/$")({
  server: { handlers: { GET: handle, POST: handle } },
});
