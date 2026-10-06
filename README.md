# SharedEnv Auth: library and showcase

This project contains two things:

1. **`src/lib/auth/`**, the **sharedenv-login** library. It's a portable admin login for any React project, and React is its only runtime dependency.
   See [`src/lib/auth/README.md`](src/lib/auth/README.md) for the full installation and API guide.
2. **The showcase app**, a live playground, documentation and an Admin page built on that library.

## Pages

| Path | What it shows |
| --- | --- |
| `/` | The playground. Switch between **A · Banner**, **B · Full-page guard** and **C · API only**. The **Docs** tab explains setup |
| `/admin` | The Admin page. It uses the same login, shows the active settings and has a password encoder |

## How this app uses the library

```
src/lib/auth/            ← the library (copy this folder to reuse it)
src/routes/api/auth/$.ts ← mounts createAuthHandler() at /api/auth/*
src/routes/api/protected/data.ts ← example API route protected with requireAdmin()
src/routes/index.tsx     ← playground + docs
src/routes/admin.tsx     ← <FullPageGuard><AdminPanel/></FullPageGuard>
```

## Configuration

| Variable | Required | Meaning |
| --- | --- | --- |
| `SESSION_SECRET` | yes | Key that signs sessions (32+ random characters) |
| `AUTH_USERNAME` | no | Admin username. Default `admin` |
| `AUTH_PASSWORD_HASH` | recommended | Encoded password (`pbkdf2_sha256:…`). Without it, the demo password `admin123` is used |
| `AUTH_APP_NAME` | no | Name shown on the Admin page |
| `AUTH_SESSION_TTL` | no | Session lifetime in seconds. Default 86400 |
| `AUTH_ENABLED` | no | `false` turns protection off |

Create an encoded password with `node src/lib/auth/hash-password.mjs "password"`, or with the box on the Admin page.

## Reusing it in another React + Vite project

1. Copy `src/lib/auth/` to `src/auth/` and add `sharedEnvLogin()` to `vite.config.ts`.
2. Wrap the app in `<AuthProvider>` and place `<AuthBanner>`, `<FullPageGuard>` or `<AdminPanel>` wherever you need them.

For production servers (Express, Workers, Vercel and others), see the library README.
