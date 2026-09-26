# sharedenv-login

A tiny admin login for React + Vite. The only dependency is React.

```
auth.server.ts  server core: HMAC cookie sessions, hashed password, rate limit
client.tsx      AuthProvider, useAuth, <AuthBanner/>, <FullPageGuard/>, <LoginCard/>
auth.css        self-contained styles (re-theme with the --sa-* variables)
vite.ts         Vite plugin: serves /api/auth/* during `vite dev` / `vite preview`
node.ts         Node/Express adapter for production
```

## Two steps

**1. Copy this folder into `src/auth/`, then add the plugin to `vite.config.ts`**

```ts
import { sharedEnvLogin } from "./src/auth/vite";
export default defineConfig({ plugins: [react(), sharedEnvLogin()] });
```

Set `SESSION_SECRET` (a random string of 32+ characters) in your environment.
Set `ADMIN_USERNAME`, `ADMIN_PASSWORD_SALT` and `ADMIN_PASSWORD_HASH` too.
If you skip them, the login falls back to the demo account admin / admin123.

```sh
node -e 'console.log(require("crypto").createHash("sha256").update("MYSALT:MYPASSWORD").digest("hex"))'
```

**2. Wrap your app and choose a guard**

```tsx
import { AuthProvider, AuthBanner, FullPageGuard, useAuth } from "./auth/client";

<AuthProvider>
  <AuthBanner />                             {/* A: sticky bar */}
  <FullPageGuard><Admin /></FullPageGuard>   {/* B: full-page lock */}
</AuthProvider>

const { user, login, logout } = useAuth();
```

## Production

A Vite build produces only static files. The login needs a small server for `/api/auth/*`.

- **Express/Node:** `app.use(toNodeMiddleware(createAuthHandler()))`, then serve the `dist/` folder.
- **Cloudflare / Vercel / Netlify / Deno / Bun:** `return (await createAuthHandler()(request)) ?? next()`

**API guard (mode C):**

```ts
const { response } = await requireAdmin(request); if (response) return response;
```

## Security

- The session cookie is `HttpOnly; Secure; SameSite=Lax`, and its token is signed with HMAC-SHA256.
- Passwords are compared as salted hashes using a constant-time check.
- After 5 failed attempts, an IP is locked out for 15 minutes. The counter lives in memory.
- Sessions renew themselves as they are used (sliding expiration).
- Changing `SESSION_SECRET` or the password signs everyone out.
