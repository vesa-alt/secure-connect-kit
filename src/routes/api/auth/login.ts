import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  checkCredentials,
  getIp,
  json,
  rateLimitStatus,
  recordFailure,
  recordSuccess,
  sessionCookie,
  signToken,
} from "@/lib/auth/auth.server";

const Body = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
  remember: z.boolean().optional(),
});

export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = getIp(request);
        const rl = rateLimitStatus(ip);
        if (rl.locked)
          return json({ error: `Too many attempts. Try again in ${Math.ceil(rl.retryAfter / 60)} min.` }, 429, {
            "retry-after": String(rl.retryAfter),
          });
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ error: "Username and password are required." }, 400);
        const { username, password, remember } = parsed.data;
        if (!(await checkCredentials(username, password))) {
          const left = recordFailure(ip);
          return json({ error: "Invalid credentials", attemptsLeft: left }, 401);
        }
        recordSuccess(ip);
        const token = await signToken(username);
        return json({ user: { username } }, 200, { "set-cookie": sessionCookie(token, !!remember) });
      },
    },
  },
});
