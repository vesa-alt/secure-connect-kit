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

## Install as a versioned package (recommended)

Install the library once per project by version number. You don't need to copy any files.

### Publish it once (to your own GitHub)

1. Create a GitHub repo, for example `your-name/sharedenv-login`.
2. Put the contents of this folder at the **root** of that repo (`package.json` must be at the top level).
3. Tag a version and push it:

```sh
git tag v1.0.0
git push origin main --tags
```

### Use it in any React + Vite project

```sh
npm install github:your-name/sharedenv-login#v1.0.0
# or
bun add github:your-name/sharedenv-login#v1.0.0
pnpm add github:your-name/sharedenv-login#v1.0.0
```

When it installs, the package builds itself through the `prepare` script, so `dist/` doesn't have to be committed.
For a **private** repo, the installing machine needs Git access to it (SSH key or `GITHUB_TOKEN`).

```ts
// vite.config.ts
import { sharedEnvLogin } from "sharedenv-login/vite";
export default defineConfig({ plugins: [react(), sharedEnvLogin()] });
```

```tsx
import { AuthProvider, FullPageGuard, AuthBanner, useAuth } from "sharedenv-login/client";
import { AdminPanel, HashTool } from "sharedenv-login/admin";            // optional
import { createAuthHandler, requireAdmin } from "sharedenv-login/server"; // your production server
import { toNodeMiddleware } from "sharedenv-login/node";                  // Express / Node
import "sharedenv-login/styles.css";
```

Create an encoded password: `npx sharedenv-hash-password "your-password"`.

### Release an update

1. Change the code, bump `"version"` in `package.json` (for example `1.0.1`).
2. `git commit -am "v1.0.1" && git tag v1.0.1 && git push origin main --tags`
3. In each project, change the number in its `package.json`:

```json
"dependencies": { "sharedenv-login": "github:your-name/sharedenv-login#v1.0.1" }
```

Then run `npm install`. Projects stay on their pinned version until you change the number.

Use [semantic versioning](https://semver.org): `1.0.x` fixes, `1.x.0` new features, `x.0.0` breaking changes.

### Optional: publish to npm or GitHub Packages

```sh
npm login
npm publish --access public      # then: npm install sharedenv-login@1.0.0
```

For a private package, rename it to `@your-name/sharedenv-login` and publish it to GitHub Packages
(`npm publish --registry=https://npm.pkg.github.com`).

---

## Install by copying (no package)

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
AUTH_USERNAME=sadie                               # any username you like (default: admin)
AUTH_PASSWORD_HASH=pbkdf2_sha256:100000:Xq3…:k9F…
AUTH_APP_NAME=My Project                          # optional
AUTH_SESSION_TTL=86400                            # optional, seconds
AUTH_COOKIE_SAMESITE=Lax                          # optional: Lax | Strict | None (use None if the app is shown inside an iframe on another site)
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

The plain password is never stored anywhere. Only an encoded value is kept in `AUTH_PASSWORD_HASH`:

```
pbkdf2_sha256 : 100000 : <salt> : <hash>
  algorithm    rounds    random   result
```

At sign-in, the library:

1. reads the algorithm, rounds and salt from `AUTH_PASSWORD_HASH`,
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

To share one identity across all your apps, give every app the same `SESSION_SECRET`, `AUTH_USERNAME` and
`AUTH_PASSWORD_HASH`. To give one project its own login, set different values in that project only.

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
| Revocation | Changing `SESSION_SECRET` or `AUTH_PASSWORD_HASH` invalidates every session |
| Admin page | Shows only non-secret settings. It never shows the secret or the hash |

**Note:** browsers send `Secure` cookies only over HTTPS or on `localhost`.
