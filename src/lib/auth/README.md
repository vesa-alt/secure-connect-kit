# sharedenv-login

An admin login you can drop into any React project. It runs on React alone, with no other runtime dependencies.

Each project gets one admin identity, set through environment variables. The same login protects the
whole app: public pages, protected pages, the API and the built-in **Admin page**.

---

## Files

| File | Runs on | Purpose |
| --- | --- | --- |
| `auth.server.ts` | server | Sessions, login, logout, the config endpoint, rate limiting and the API guard |
| `password.ts` | server + browser | Encodes and verifies passwords (PBKDF2-SHA256) |
| `client.tsx` | browser | `AuthProvider`, `useAuth`, `<AuthBanner>`, `<FullPageGuard>`, `<LoginCard>` |
| `admin.tsx` | browser | `<AdminPanel>` (configuration view) and `<HashTool>` (password encoder) |
| `auth.css` | browser | Self-contained styles. Re-theme them with the `--sa-*` variables |
| `vite.ts` | dev | Vite plugin that serves `/api/auth/*` during `vite dev` and `vite preview` |
| `node.ts` | server | Adapter for Node, Express and Connect |
| `hash-password.mjs` | CLI | Encodes a password from the terminal |

---

## Install (2 steps)

### 1. Copy the folder, add the plugin, set the environment

Copy this folder to `src/auth/`.

```ts
// vite.config.ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { sharedEnvLogin } from "./src/auth/vite";

export default defineConfig({ plugins: [react(), sharedEnvLogin()] });
```

Then create the encoded password and add it to `.env`, which must never be committed:

```sh
node src/auth/hash-password.mjs "your-strong-password"
# → pbkdf2_sha256:100000:Xq3…:k9F…
```

```dotenv
SESSION_SECRET=<random string, 32+ chars>        # openssl rand -hex 32
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=pbkdf2_sha256:100000:Xq3…:k9F…
AUTH_APP_NAME=My Project                          # optional
AUTH_SESSION_TTL=86400                            # optional, seconds
AUTH_ENABLED=true                                 # optional, "false" turns auth off
```

> Do **not** prefix these with `VITE_`. A `VITE_` prefix would ship them to the browser.

### 2. Wrap the app and choose where to require login

```tsx
// main.tsx
import { AuthProvider } from "./auth/client";
<AuthProvider><App /></AuthProvider>
```

```tsx
import { AuthBanner, FullPageGuard, useAuth } from "./auth/client";
import { AdminPanel } from "./auth/admin";

<AuthBanner />                                    // A: sticky sign-in bar on public pages
<FullPageGuard><Dashboard /></FullPageGuard>      // B: lock a whole page
<FullPageGuard><AdminPanel /></FullPageGuard>     // Admin page: same credentials

const { user, login, logout, loading } = useAuth();
if (!user) return <button disabled>Sign in to edit</button>;
```

---

## How passwords work

The plain password is never stored anywhere. Only an encoded value is kept in `ADMIN_PASSWORD_HASH`:

```
pbkdf2_sha256 : 100000 : <salt> : <hash>
  algorithm    rounds    random   result
```

At sign-in, the library:

1. reads the algorithm, rounds and salt from `ADMIN_PASSWORD_HASH`,
2. encodes the typed password with exactly those settings,
3. compares the result with the stored hash in constant time, so response timing reveals nothing.

If they match and the username matches, the library issues a session.

You can create a new encoded value in two ways:

- run `hash-password.mjs`, or
- use the **Change password** box on the Admin page, which encodes in the browser so the plain password never leaves the page.

Changing the value signs everyone out.

---

## API

### HTTP endpoints (default base `/api/auth`)

| Method | Path | Result |
| --- | --- | --- |
| `POST` | `/login` | `{ username, password, remember }` → sets the session cookie. Returns `401` with `attemptsLeft`, or `429` when locked out |
| `POST` | `/logout` | Clears the cookie |
| `GET` | `/session` | `{ user, appName }` |
| `GET` | `/config` | Non-secret configuration for the Admin page. Admin only (`401` otherwise) |

### Server functions

```ts
import { createAuthHandler, requireAdmin, getSession, hashPassword, verifyPassword } from "./auth/auth.server";

createAuthHandler(options?)      // (Request) => Promise<Response | null>
requireAdmin(request, options?)  // { user, response, setCookie } — return `response` if set (401)
getSession(request, options?)    // { user, setCookie }
```

Every option can also be passed in code. Code values override the environment:

```ts
createAuthHandler({ username, passwordHash, secret, appName, enabled, cookieName,
                    ttlSeconds, maxAttempts, lockoutSeconds, basePath });
```

To share one identity across all your apps, give every app the same `SESSION_SECRET`, `ADMIN_USERNAME` and
`ADMIN_PASSWORD_HASH`. To give one project its own login, set different values in that project only.

---

## Production

A Vite build produces static files only. Mount the handler wherever your server code runs:

```ts
// Express / Node
import express from "express";
import { createAuthHandler, requireAdmin } from "./src/auth/auth.server";
import { toNodeMiddleware } from "./src/auth/node";

const app = express();
app.use(toNodeMiddleware(createAuthHandler()));
app.use(express.static("dist"));
```

```ts
// Cloudflare Workers / Vercel / Netlify edge / Deno / Bun
export default {
  async fetch(request) {
    return (await createAuthHandler()(request)) ?? serveYourApp(request);
  },
};
```

```ts
// Protect your own API route (mode C)
const { user, response } = await requireAdmin(request);
if (response) return response;
```

---

## Security

| Layer | Implementation |
| --- | --- |
| Password storage | PBKDF2-SHA256, 100,000 rounds, 16-byte random salt per password |
| Comparison | Constant time. The password is hashed even when the username is wrong |
| Session | Stateless token `payload.HMAC-SHA256` signed with `SESSION_SECRET` plus the password hash |
| Cookie | `HttpOnly; Secure; SameSite=Lax`, so JavaScript cannot read it |
| Expiry | Sliding: the token is re-issued once past half its lifetime |
| Brute force | 5 failures per IP lead to a 15-minute lockout (`429`). The counter lives in memory, per server instance |
| Revocation | Changing `SESSION_SECRET` or `ADMIN_PASSWORD_HASH` invalidates every session |
| Admin page | Shows only non-secret settings. It never shows the secret or the hash |

**Note:** browsers send `Secure` cookies only over HTTPS or on `localhost`.
