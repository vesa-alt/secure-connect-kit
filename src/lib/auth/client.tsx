import { createContext, useCallback, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Lock, LogOut, ShieldCheck } from "lucide-react";

type User = { username: string } | null;
type Ctx = {
  user: User;
  loading: boolean;
  login: (u: string, p: string, remember?: boolean) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children, basePath = "/api/auth" }: { children: ReactNode; basePath?: string }) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`${basePath}/session`, { credentials: "same-origin" });
      const d = await r.json();
      setUser(d.user ? { username: d.user.username } : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [basePath]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback<Ctx["login"]>(
    async (username, password, remember) => {
      const r = await fetch(`${basePath}/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password, remember }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        const extra = typeof d.attemptsLeft === "number" && d.attemptsLeft > 0 ? ` (${d.attemptsLeft} attempts left)` : "";
        return { ok: false, error: (d.error ?? "Sign in failed") + extra };
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

const inputCls =
  "h-9 rounded-md border border-input bg-background/60 px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring font-mono";
const btnCls =
  "h-9 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition";

/** Mode A: sticky non-intrusive bar. */
export function AuthBanner({ position = "top", className = "" }: { position?: "top" | "bottom"; className?: string }) {
  const { user, login, logout } = useAuth();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await login(u, p, true);
    setBusy(false);
    setErr(r.error);
    if (r.ok) setP("");
  }

  return (
    <div
      className={`sticky ${position === "top" ? "top-0" : "bottom-0"} z-40 border-b border-border bg-sidebar/95 backdrop-blur ${className}`}
    >
      <div className="flex flex-wrap items-center gap-3 px-4 py-2">
        {user ? (
          <>
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="text-sm text-sidebar-foreground">
              Signed in as <b className="font-mono">{user.username}</b>
            </span>
            <button onClick={logout} className="ml-auto flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </>
        ) : (
          <form onSubmit={submit} className="flex w-full flex-wrap items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            <span className="mr-2 text-xs uppercase tracking-widest text-muted-foreground">Admin</span>
            <input aria-label="Username" placeholder="Username" value={u} onChange={(e) => setU(e.target.value)} className={`${inputCls} w-36`} />
            <input aria-label="Password" placeholder="Password" type="password" value={p} onChange={(e) => setP(e.target.value)} className={`${inputCls} w-36`} />
            <button disabled={busy} className={btnCls}>{busy ? "…" : "Sign In"}</button>
            {err && <span className="text-xs text-destructive">{err}</span>}
          </form>
        )}
      </div>
    </div>
  );
}

/** Login card used by FullPageGuard (and usable standalone as an inline prompt). */
export function LoginCard({ title = "Restricted area", onSuccess }: { title?: string; onSuccess?: () => void }) {
  const { login } = useAuth();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await login(u, p, remember);
    setBusy(false);
    setErr(r.error);
    if (r.ok) onSuccess?.();
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl">
      <div className="mb-5 flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/15"><Lock className="h-4 w-4 text-primary" /></div>
        <div>
          <h2 className="font-semibold text-card-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">Sign in with your admin credentials</p>
        </div>
      </div>
      <label className="mb-1 block text-xs text-muted-foreground">Username</label>
      <input value={u} onChange={(e) => setU(e.target.value)} className={`${inputCls} mb-3 w-full`} autoFocus />
      <label className="mb-1 block text-xs text-muted-foreground">Password</label>
      <input type="password" value={p} onChange={(e) => setP(e.target.value)} className={`${inputCls} mb-3 w-full`} />
      {err && <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</p>}
      <label className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-primary" />
        Remember me
      </label>
      <button disabled={busy} className={`${btnCls} w-full`}>{busy ? "Signing in…" : "Sign In"}</button>
    </form>
  );
}

/** Mode B: blocks children until authenticated. */
export function FullPageGuard({ children, contained = false }: { children: ReactNode; contained?: boolean }) {
  const { user, loading } = useAuth();
  if (user) return <>{children}</>;
  return (
    <div className={`${contained ? "absolute" : "fixed"} inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-md`}>
      {loading ? <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <LoginCard />}
    </div>
  );
}
