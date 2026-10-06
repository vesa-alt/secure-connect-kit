// <AdminPanel /> — shows the active auth configuration to a signed-in admin,
// plus a tool to encode a new password for ADMIN_PASSWORD_HASH.
// Wrap it in <FullPageGuard> so it uses the same login as the rest of the app.
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useAuth } from "./client";
import { hashPassword } from "./password";
import type { PublicConfig } from "./auth.server";

const fmtDuration = (s: number) => (s >= 3600 ? `${+(s / 3600).toFixed(1)} h` : `${Math.round(s / 60)} min`);
const fmtTime = (unix: number) => new Date(unix * 1000).toLocaleString();

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="sa-kv">
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}
const Flag = ({ ok, yes = "yes", no = "no" }: { ok: boolean; yes?: string; no?: string }) => (
  <b className={ok ? "sa-ok" : "sa-bad"}>{ok ? yes : no}</b>
);

export function AdminPanel({ basePath = "/api/auth" }: { basePath?: string }) {
  const { user, logout } = useAuth();
  const [cfg, setCfg] = useState<PublicConfig | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!user) return;
    fetch(`${basePath}/config`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setCfg)
      .catch((e: Error) => setError(e.message));
  }, [user, basePath]);

  return (
    <div className="sa sa-admin">
      <div className="sa-admin-top">
        <div>
          <p className="sa-eyebrow">Admin · {cfg?.appName ?? "…"}</p>
          <h1 className="sa-h1">Access configuration</h1>
        </div>
        <button className="sa-ghost" onClick={logout}>Sign out {user?.username}</button>
      </div>

      {error && <p className="sa-warn">Could not load configuration ({error}).</p>}
      {cfg?.warnings.filter((w): w is string => Boolean(w)).map((w) => <p key={w} className="sa-warn">⚠ {w}</p>)}

      {cfg && (
        <div className="sa-grid">
          <section className="sa-panel">
            <h3>Identity</h3>
            <Row k="Auth enabled" v={<Flag ok={cfg.enabled} />} />
            <Row k="Admin username" v={cfg.username} />
            <Row k="Password source" v={cfg.password.source} />
            <Row k="Algorithm" v={cfg.password.algorithm} />
            <Row k="Iterations" v={cfg.password.iterations.toLocaleString()} />
            <Row k="Format valid" v={<Flag ok={cfg.password.valid} />} />
          </section>
          <section className="sa-panel">
            <h3>Session</h3>
            <Row k="SESSION_SECRET" v={<Flag ok={cfg.sessionSecret.strong} yes={`set · ${cfg.sessionSecret.length} chars`} no={`weak · ${cfg.sessionSecret.length} chars`} />} />
            <Row k="Lifetime" v={`${fmtDuration(cfg.session.ttlSeconds)} · sliding`} />
            <Row k="Your session started" v={fmtTime(cfg.session.issuedAt)} />
            <Row k="Your session expires" v={fmtTime(cfg.session.expiresAt)} />
            <Row k="Cookie" v={cfg.cookie.name} />
            <Row k="Cookie flags" v={cfg.cookie.flags} />
          </section>
          <section className="sa-panel">
            <h3>Protection</h3>
            <Row k="Max failed attempts" v={cfg.rateLimit.maxAttempts} />
            <Row k="Lockout" v={fmtDuration(cfg.rateLimit.lockoutSeconds)} />
            <Row k="IPs locked right now" v={cfg.rateLimit.lockedIps} />
            <Row k="API base path" v={cfg.basePath} />
          </section>
          <HashTool />
        </div>
      )}
    </div>
  );
}

/** Encodes a password in the browser. The plain password never leaves the page. */
export function HashTool() {
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const pw = String(new FormData(e.currentTarget).get("pw") ?? "");
    if (pw.length < 8) return setOut("Use at least 8 characters.");
    setBusy(true);
    setOut(`ADMIN_PASSWORD_HASH=${await hashPassword(pw)}`);
    setBusy(false);
  }
  return (
    <section className="sa-panel">
      <h3>Change password</h3>
      <form className="sa-tool" onSubmit={submit}>
        <input className="sa-input" name="pw" type="password" placeholder="New password" autoComplete="new-password" />
        <button className="sa-btn" disabled={busy}>{busy ? "…" : "Encode"}</button>
      </form>
      {out && <div className="sa-out">{out}</div>}
      <p className="sa-sub" style={{ marginTop: 10 }}>Put this line in your environment and restart or redeploy. Existing sessions end automatically.</p>
    </section>
  );
}
