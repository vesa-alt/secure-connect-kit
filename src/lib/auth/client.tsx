// React client for sharedenv-login. Only depends on React.
import { createContext, useCallback, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import "./auth.css";

type User = { username: string } | null;
type Result = { ok: boolean; error?: string };
type Ctx = {
  user: User;
  loading: boolean;
  login: (username: string, password: string, remember?: boolean) => Promise<Result>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children, basePath = "/api/auth" }: { children: ReactNode; basePath?: string }) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const d = await (await fetch(`${basePath}/session`)).json();
      setUser(d.user ? { username: d.user.username } : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [basePath]);

  useEffect(() => void refresh(), [refresh]);

  const login = useCallback<Ctx["login"]>(
    async (username, password, remember) => {
      const r = await fetch(`${basePath}/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password, remember }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        const left = d.attemptsLeft > 0 ? ` (${d.attemptsLeft} attempts left)` : "";
        return { ok: false, error: (d.error ?? "Sign in failed") + left };
      }
      setUser(d.user);
      return { ok: true };
    },
    [basePath],
  );

  const logout = useCallback(async () => {
    await fetch(`${basePath}/logout`, { method: "POST" });
    setUser(null);
  }, [basePath]);

  return <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const c = useContext(AuthContext);
  if (!c) throw new Error("useAuth must be used inside <AuthProvider>");
  return c;
}

const LockIcon = () => (
  <svg className="sa-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const ShieldIcon = () => (
  <svg className="sa-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

/** Shared form state for both login UIs. */
function useLoginForm(onSuccess?: () => void) {
  const { login } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const submit = async (e: FormEvent<HTMLFormElement>, remember = true) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    const r = await login(String(f.get("username")), String(f.get("password")), remember);
    setBusy(false);
    setError(r.error);
    if (r.ok) {
      form.reset();
      onSuccess?.();
    }
  };
  return { busy, error, submit };
}

/** Mode A: sticky non-intrusive bar. */
export function AuthBanner({ position = "top" }: { position?: "top" | "bottom" }) {
  const { user, logout } = useAuth();
  const { busy, error, submit } = useLoginForm();
  return (
    <div className={`sa sa-banner ${position === "bottom" ? "sa-bottom" : ""}`}>
      {user ? (
        <div className="sa-row">
          <ShieldIcon />
          <span>Signed in as <b>{user.username}</b></span>
          <button className="sa-link" onClick={logout}>Sign out</button>
        </div>
      ) : (
        <form className="sa-row" onSubmit={(e) => submit(e)}>
          <LockIcon />
          <span className="sa-tag">Admin</span>
          <input className="sa-input" name="username" aria-label="Username" placeholder="Username" />
          <input className="sa-input" name="password" type="password" aria-label="Password" placeholder="Password" />
          <button className="sa-btn" disabled={busy}>{busy ? "…" : "Sign In"}</button>
          {error && <span className="sa-err">{error}</span>}
        </form>
      )}
    </div>
  );
}

/** Login card (used by FullPageGuard; also usable as an inline prompt). */
export function LoginCard({ title = "Restricted area", onSuccess }: { title?: string; onSuccess?: () => void }) {
  const [remember, setRemember] = useState(true);
  const { busy, error, submit } = useLoginForm(onSuccess);
  return (
    <form className="sa sa-card" onSubmit={(e) => submit(e, remember)}>
      <div className="sa-head">
        <div className="sa-badge"><LockIcon /></div>
        <div>
          <h2 className="sa-title">{title}</h2>
          <p className="sa-sub">Sign in with your admin credentials</p>
        </div>
      </div>
      <label className="sa-label">Username</label>
      <input className="sa-input" name="username" autoFocus />
      <label className="sa-label">Password</label>
      <input className="sa-input" name="password" type="password" />
      {error && <p className="sa-err">{error}</p>}
      <label className="sa-check">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me
      </label>
      <button className="sa-btn" disabled={busy}>{busy ? "Signing in…" : "Sign In"}</button>
    </form>
  );
}

/** Mode B: blocks children until signed in. `contained` = cover the parent instead of the viewport. */
export function FullPageGuard({ children, contained = false }: { children: ReactNode; contained?: boolean }) {
  const { user, loading } = useAuth();
  if (user) return <>{children}</>;
  return (
    <div className={`sa sa-overlay ${contained ? "sa-contained" : ""}`}>
      {loading ? <div className="sa-spin" /> : <LoginCard />}
    </div>
  );
}
