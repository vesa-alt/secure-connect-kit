// Zero-dependency server core. Works anywhere with Web Request/Response + WebCrypto
// (Node 18+, Vite dev/preview, Express, Cloudflare Workers, Vercel, Netlify, Deno, Bun).
import { describeHash, timingSafeEqual, toB64url, verifyPassword, fromB64url } from "./password";

export { hashPassword, verifyPassword, timingSafeEqual } from "./password";

export type AuthOptions = {
  secret?: string; // default: env SESSION_SECRET
  username?: string; // default: env ADMIN_USERNAME || "admin"
  passwordHash?: string; // encoded value, default: env ADMIN_PASSWORD_HASH
  appName?: string; // default: env AUTH_APP_NAME
  enabled?: boolean; // default: env AUTH_ENABLED !== "false"
  cookieName?: string;
  ttlSeconds?: number; // sliding session lifetime
  maxAttempts?: number;
  lockoutSeconds?: number;
  basePath?: string;
};
export type SessionUser = { username: string; iat: number; exp: number };

// Demo account admin / admin123 — used only when ADMIN_PASSWORD_HASH is not set.
const DEMO_HASH = "pbkdf2_sha256:100000:c2hhcmVkZW52LWRlbW8tc2FsdA:mcBRxi2xWglZ_aB9uGZ7Q6L1ifroXissrADh6xiVa-s";

const env = (k: string) => (typeof process !== "undefined" ? process.env?.[k] : undefined) || undefined;

function resolve(o: AuthOptions = {}) {
  const secret = o.secret ?? env("SESSION_SECRET");
  if (!secret) throw new Error("[sharedenv-login] SESSION_SECRET is not configured");
  const passwordHash = o.passwordHash ?? env("ADMIN_PASSWORD_HASH");
  return {
    secret,
    username: o.username ?? env("ADMIN_USERNAME") ?? "admin",
    passwordHash: passwordHash ?? DEMO_HASH,
    demoCredentials: !passwordHash,
    appName: o.appName ?? env("AUTH_APP_NAME") ?? "App",
    enabled: o.enabled ?? env("AUTH_ENABLED") !== "false",
    cookieName: o.cookieName ?? "sharedenv_session",
    ttlSeconds: o.ttlSeconds ?? Number(env("AUTH_SESSION_TTL") ?? 60 * 60 * 24),
    maxAttempts: o.maxAttempts ?? 5,
    lockoutSeconds: o.lockoutSeconds ?? 15 * 60,
    basePath: o.basePath ?? "/api/auth",
  };
}
type Cfg = ReturnType<typeof resolve>;

const enc = new TextEncoder();

// Signing key includes the stored hash: changing the secret OR the password signs everyone out.
async function hmac(c: Cfg, data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(c.secret + c.passwordHash), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toB64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data))));
}

async function signToken(c: Cfg, username: string) {
  const now = Math.floor(Date.now() / 1000);
  const body = toB64url(enc.encode(JSON.stringify({ username, iat: now, exp: now + c.ttlSeconds })));
  return `${body}.${await hmac(c, body)}`;
}

async function verifyToken(c: Cfg, token?: string): Promise<SessionUser | null> {
  const [body, sig] = token?.split(".") ?? [];
  if (!body || !sig || !timingSafeEqual(sig, await hmac(c, body))) return null;
  try {
    const p = JSON.parse(new TextDecoder().decode(fromB64url(body))) as SessionUser;
    return p.exp > Date.now() / 1000 ? p : null;
  } catch {
    return null;
  }
}

// In-memory brute-force limiter (per server instance).
const attempts = new Map<string, { count: number; lockedUntil: number }>();

const ipOf = (r: Request) =>
  r.headers.get("cf-connecting-ip") || r.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

function readCookie(r: Request, name: string) {
  for (const part of (r.headers.get("cookie") ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

const cookie = (c: Cfg, value: string, maxAge?: number) =>
  `${c.cookieName}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax${maxAge !== undefined ? `; Max-Age=${maxAge}` : ""}`;

const json = (data: unknown, status = 200, setCookie?: string) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...(setCookie && { "set-cookie": setCookie }) },
  });

/** Reads the session cookie and re-issues it once past half its lifetime (sliding expiration). */
export async function getSession(request: Request, opts?: AuthOptions) {
  const c = resolve(opts);
  const user = await verifyToken(c, readCookie(request, c.cookieName));
  const renew = user && user.exp - Date.now() / 1000 < c.ttlSeconds / 2;
  return { user, setCookie: renew ? cookie(c, await signToken(c, user.username), c.ttlSeconds) : undefined };
}

/** Mode C — API guard. `if (response) return response;` */
export async function requireAdmin(request: Request, opts?: AuthOptions) {
  if (!resolve(opts).enabled) return { user: { username: "anonymous", iat: 0, exp: 0 }, response: null };
  const { user, setCookie } = await getSession(request, opts);
  if (!user) return { user: null, response: json({ error: "unauthorized" }, 401) };
  return { user, response: null, setCookie };
}

/** Safe, non-secret view of the active configuration (for the admin page). */
function publicConfig(c: Cfg, user: SessionUser) {
  const now = Date.now();
  return {
    appName: c.appName,
    enabled: c.enabled,
    username: c.username,
    password: { ...describeHash(c.passwordHash), source: c.demoCredentials ? "demo default" : "ADMIN_PASSWORD_HASH" },
    sessionSecret: { set: true, length: c.secret.length, strong: c.secret.length >= 32 },
    cookie: { name: c.cookieName, flags: "HttpOnly; Secure; SameSite=Lax" },
    session: { ttlSeconds: c.ttlSeconds, sliding: true, issuedAt: user.iat, expiresAt: user.exp },
    rateLimit: {
      maxAttempts: c.maxAttempts,
      lockoutSeconds: c.lockoutSeconds,
      lockedIps: [...attempts.values()].filter((e) => e.lockedUntil > now).length,
    },
    basePath: c.basePath,
    warnings: [
      c.demoCredentials && "Demo password in use — set ADMIN_PASSWORD_HASH.",
      c.secret.length < 32 && "SESSION_SECRET is shorter than 32 characters.",
      !describeHash(c.passwordHash).valid && "ADMIN_PASSWORD_HASH has an unknown format.",
    ].filter(Boolean),
  };
}
export type PublicConfig = ReturnType<typeof publicConfig>;

/**
 * Handles, under basePath (default /api/auth):
 *   POST /login  · POST /logout  · GET /session  · GET /config (admin only)
 * Returns null for any other URL so you can fall through to your own routes.
 */
export function createAuthHandler(opts?: AuthOptions) {
  return async (request: Request): Promise<Response | null> => {
    const c = resolve(opts);
    const path = new URL(request.url).pathname;
    if (!path.startsWith(c.basePath + "/")) return null;
    const action = `${request.method} ${path.slice(c.basePath.length + 1)}`;

    if (action === "GET session") {
      const { user, setCookie } = await getSession(request, opts);
      return json({ user: user && { username: user.username }, appName: c.appName }, 200, setCookie);
    }
    if (action === "GET config") {
      const { user, setCookie } = await getSession(request, opts);
      return user ? json(publicConfig(c, user), 200, setCookie) : json({ error: "unauthorized" }, 401);
    }
    if (action === "POST logout") return json({ ok: true }, 200, cookie(c, "", 0));
    if (action !== "POST login") return null;

    const ip = ipOf(request);
    const now = Date.now();
    const entry = attempts.get(ip) ?? { count: 0, lockedUntil: 0 };
    if (entry.lockedUntil > now)
      return json({ error: `Too many attempts. Try again in ${Math.ceil((entry.lockedUntil - now) / 60000)} min.` }, 429);

    const body = (await request.json().catch(() => null)) as { username?: unknown; password?: unknown; remember?: unknown } | null;
    const username = typeof body?.username === "string" ? body.username.slice(0, 100) : "";
    const password = typeof body?.password === "string" ? body.password.slice(0, 200) : "";
    if (!username || !password) return json({ error: "Username and password are required." }, 400);

    // Always hash, even for a wrong username, so timing reveals nothing.
    const passOk = await verifyPassword(password, c.passwordHash);
    const userOk = timingSafeEqual(username, c.username);
    if (!userOk || !passOk) {
      entry.count += 1;
      if (entry.count >= c.maxAttempts) Object.assign(entry, { count: 0, lockedUntil: now + c.lockoutSeconds * 1000 });
      attempts.set(ip, entry);
      return json({ error: "Invalid credentials", attemptsLeft: c.maxAttempts - entry.count }, 401);
    }
    attempts.delete(ip);
    return json({ user: { username } }, 200, cookie(c, await signToken(c, username), body?.remember ? c.ttlSeconds : undefined));
  };
}
