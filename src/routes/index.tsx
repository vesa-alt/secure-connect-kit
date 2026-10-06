import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AuthBanner, AuthProvider, FullPageGuard, LoginCard, useAuth } from "@/lib/auth/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SharedEnv Auth — drop-in admin login library" },
      { name: "description", content: "Reusable admin auth: HMAC session cookies, banner and full-page guards, API middleware. Live playground and docs." },
      { property: "og:title", content: "SharedEnv Auth — drop-in admin login library" },
      { property: "og:description", content: "Banner, full-page and API guard modes with a live playground." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AuthProvider>
      <Page />
    </AuthProvider>
  ),
});

type Mode = "banner" | "guard" | "api";

function Page() {
  const [tab, setTab] = useState<"play" | "docs">("play");
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-end justify-between gap-6 px-6 py-8">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">@sharedenv/login</p>
            <h1 className="mt-2 font-display text-4xl font-bold tracking-tight md:text-5xl">One admin identity.<br />Every app.</h1>
          </div>
          <nav className="flex rounded-lg border border-border p-1 font-mono text-sm">
            {(["play", "docs"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded-md px-4 py-1.5 ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {t === "play" ? "Playground" : "Docs"}
              </button>
            ))}
            <Link to="/admin" className="rounded-md px-4 py-1.5 text-muted-foreground hover:text-foreground">Admin</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{tab === "play" ? <Playground /> : <Docs />}</main>
    </div>
  );
}

function Playground() {
  const [mode, setMode] = useState<Mode>("banner");
  const { user, logout } = useAuth();
  const modes: { id: Mode; label: string; hint: string }[] = [
    { id: "banner", label: "A · Banner", hint: "Public page, protected actions" },
    { id: "guard", label: "B · Full-page", hint: "Blocks everything until sign-in" },
    { id: "api", label: "C · API only", hint: "401 JSON from middleware" },
  ];
  return (
    <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
      <aside className="space-y-2">
        {modes.map((m) => (
          <button key={m.id} onClick={() => setMode(m.id)} className={`w-full rounded-lg border p-3 text-left transition ${mode === m.id ? "border-primary bg-primary/10" : "border-border hover:border-muted-foreground"}`}>
            <div className="font-mono text-sm font-semibold">{m.label}</div>
            <div className="text-xs text-muted-foreground">{m.hint}</div>
          </button>
        ))}
        <div className="mt-6 rounded-lg border border-dashed border-border p-3 font-mono text-xs text-muted-foreground">
          demo login<br />user: <span className="text-foreground">admin</span><br />pass: <span className="text-foreground">admin123</span>
          <div className="mt-3">session: {user ? <span className="text-primary">{user.username}</span> : "none"}</div>
          {user && <button onClick={logout} className="mt-2 underline">reset session</button>}
        </div>
      </aside>
      <section className="relative min-h-[520px] overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-1.5 border-b border-border px-4 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" /><span className="h-2.5 w-2.5 rounded-full bg-chart-4/70" /><span className="h-2.5 w-2.5 rounded-full bg-chart-2/70" />
          <span className="ml-3 font-mono text-xs text-muted-foreground">your-app.example/{mode}</span>
        </div>
        <div className="relative h-[480px] overflow-auto">
          {mode === "banner" && <BannerDemo />}
          {mode === "guard" && <FullPageGuard contained><FakeDashboard /></FullPageGuard>}
          {mode === "api" && <ApiDemo />}
        </div>
      </section>
    </div>
  );
}

function FakeDashboard() {
  return (
    <div className="grid gap-4 p-6 sm:grid-cols-3">
      {["Revenue", "Orders", "Refunds"].map((k, i) => (
        <div key={k} className="rounded-lg border border-border p-4">
          <div className="text-xs text-muted-foreground">{k}</div>
          <div className="mt-1 font-display text-2xl font-bold">{["$48.2k", "1,204", "12"][i]}</div>
        </div>
      ))}
      <div className="h-48 rounded-lg border border-border bg-gradient-to-t from-primary/20 to-transparent sm:col-span-3" />
    </div>
  );
}

function BannerDemo() {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const act = (name: string) => (user ? setLog((l) => [`✓ ${name} by ${user.username}`, ...l]) : setPrompt(true));
  return (
    <div className="relative">
      <AuthBanner />
      <div className="p-6">
        <h3 className="font-display text-xl font-semibold">Inventory (public, read-only)</h3>
        <table className="mt-4 w-full text-sm">
          <tbody>
            {["Widget", "Gizmo", "Sprocket"].map((n, i) => (
              <tr key={n} className="border-b border-border">
                <td className="py-2">{n}</td>
                <td className="font-mono text-muted-foreground">{[40, 12, 7][i]} in stock</td>
                <td className="text-right">
                  <button onClick={() => act(`Edit ${n}`)} className="rounded border border-border px-2 py-1 text-xs hover:border-primary">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={() => act("Delete all")} className="mt-4 rounded-md bg-destructive px-3 py-1.5 text-sm text-destructive-foreground">Delete all</button>
        <ul className="mt-4 space-y-1 font-mono text-xs text-primary">{log.map((l, i) => <li key={i}>{l}</li>)}</ul>
      </div>
      {prompt && !user && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && setPrompt(false)}>
          <LoginCard title="Sign in to continue" onSuccess={() => setPrompt(false)} />
        </div>
      )}
    </div>
  );
}

function ApiDemo() {
  const [res, setRes] = useState<{ status: number; body: string } | null>(null);
  const call = async () => {
    const r = await fetch("/api/protected/data");
    setRes({ status: r.status, body: JSON.stringify(await r.json(), null, 2) });
  };
  return (
    <div className="space-y-4 p-6 font-mono text-sm">
      <div className="flex items-center gap-3">
        <span className="rounded bg-primary/15 px-2 py-1 text-primary">GET</span>
        <span>/api/protected/data</span>
        <button onClick={call} className="ml-auto rounded-md bg-primary px-4 py-1.5 font-semibold text-primary-foreground">Send request</button>
      </div>
      {res && (
        <div className="rounded-lg border border-border bg-background p-4">
          <div className={res.status === 200 ? "text-chart-2" : "text-destructive"}>HTTP {res.status}</div>
          <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{res.body}</pre>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Signed out → 401 JSON. Sign in via the demo credentials (switch to mode A or B) and resend.</p>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return <pre className="overflow-auto rounded-lg border border-border bg-sidebar p-4 font-mono text-xs leading-relaxed text-sidebar-foreground">{children}</pre>;
}

function Docs() {
  return (
    <article className="max-w-3xl space-y-8">
      <section>
        <h2 className="font-display text-2xl font-bold">Drop it into any React + Vite app, in two steps</h2>
        <p className="mt-2 text-muted-foreground">Copy the <code className="font-mono text-primary">auth/</code> folder (only needs React, no other packages) into <code className="font-mono">src/</code> and set <code className="font-mono">SESSION_SECRET</code>.</p>
      </section>
      <section className="space-y-3">
        <h3 className="font-mono text-sm uppercase tracking-widest text-primary">1 · Add the Vite plugin + provider</h3>
        <Code>{`// vite.config.ts
import { sharedEnvLogin } from "./src/auth/vite";
export default defineConfig({ plugins: [react(), sharedEnvLogin()] });

// main.tsx
import { AuthProvider } from "./auth/client";
<AuthProvider><App /></AuthProvider>

// production (Express): app.use(toNodeMiddleware(createAuthHandler()))`}</Code>
      </section>
      <section className="space-y-3">
        <h3 className="font-mono text-sm uppercase tracking-widest text-primary">2 · Mount a guard</h3>
        <Code>{`// A — banner on a public page
<AuthBanner position="top" />

// B — lock the whole route
<FullPageGuard><AdminDashboard /></FullPageGuard>

// C — protect an API route
import { requireAdmin } from "@/lib/auth/auth.server";
GET: async ({ request }) => {
  const { response, user } = await requireAdmin(request);
  if (response) return response;           // 401 JSON
  return Response.json({ hello: user.username });
}

// Anywhere
const { user, login, logout } = useAuth();`}</Code>
      </section>
      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">Configuration</h2>
        <table className="w-full text-sm">
          <tbody className="[&_td]:border-b [&_td]:border-border [&_td]:py-2 [&_td:first-child]:font-mono [&_td:first-child]:text-primary">
            <tr><td>SESSION_SECRET</td><td>HMAC signing key. Rotate to revoke every session.</td></tr>
            <tr><td>AUTH_PASSWORD_HASH</td><td>Encoded password <code>pbkdf2_sha256:iterations:salt:hash</code>. Generate it on the Admin page or with <code>node hash-password.mjs</code>. Changing it signs everyone out.</td></tr>
            <tr><td>ADMIN_PASSWORD_SALT / _HASH</td><td>Hex SHA-256 of <code>salt:password</code>. Changing it also revokes sessions.</td></tr>
            <tr><td>defaultAuthConfig</td><td><code>enabled</code>, <code>sessionTtlSeconds</code> (24h sliding), <code>maxAttempts</code> (5), <code>lockoutSeconds</code> (15 min).</td></tr>
          </tbody>
        </table>
      </section>
      <section className="space-y-2 text-sm text-muted-foreground">
        <h2 className="font-display text-xl font-bold text-foreground">Security model</h2>
        <p>• The plain password is never stored: input is re-encoded with PBKDF2-SHA256 (100k rounds, per-password salt) and compared in constant time.</p>
        <p>• Passwords compared as salted hashes with constant-time equality.</p>
        <p>• 5 failed attempts per IP → 15-minute lockout (HTTP 429). The counter is in memory per server instance.</p>
        <p>• Sliding expiration: a session past half its lifetime is silently re-issued on the next request.</p>
      </section>
    </article>
  );
}
