// Zero-dependency server core. Works anywhere with Web Request/Response + WebCrypto
// (Node 18+, Vite dev server, Express, Cloudflare Workers, Vercel, Netlify, Deno, Bun).

export type AuthOptions = {
  secret?: string; // default: process.env.SESSION_SECRET
  username?: string; // default: process.env.ADMIN_USERNAME || "admin"
  salt?: string; // default: process.env.ADMIN_PASSWORD_SALT
  passwordHash?: string; // hex sha256(`${salt}:${password}`); default: process.env.ADMIN_PASSWORD_HASH
  enabled?: boolean;
  cookieName?: string;
  ttlSeconds?: number; // sliding session lifetime
  maxAttempts?: number;
  lockoutSeconds?: number;
  basePath?: string;
};
export type SessionUser = { username: string; iat: number; exp: number };

const env = (k: string) => (typeof process !== "undefined" ? process.env?.[k] : undefined);

function resolve(o: AuthOptions = {}) {
  const secret = o.secret ?? env("SESSION_SECRET");
  if (!secret) throw new Error("SESSION_SECRET is not configured");
  return {
    secret,
    username: o.username ?? env("ADMIN_USERNAME") ?? "admin",
    salt: o.salt ?? env("ADMIN_PASSWORD_SALT") ?? "sharedenv-salt",
    // demo default = "admin123" — override in real projects
    passwordHash:
      o.passwordHash ?? env("ADMIN_PASSWORD_HASH") ?? "41580e02e52e39e012ce70006294115f86e6125b55002bf2607e5eb848c26434",
    enabled: o.enabled ?? true,
    cookieName: o.cookieName ?? "sharedenv_session",
    ttlSeconds: o.ttlSeconds ?? 60 * 60 * 24,
    maxAttempts: o.maxAttempts ?? 5,
    lockoutSeconds: o.lockoutSeconds ?? 15 * 60,
    basePath: o.basePath ?? "/api/auth",
  };
}
type Cfg = ReturnType<typeof resolve>;

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) =>
  new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));

async function sha256Hex(s: string) {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string comparison. */
export function timingSafeEqual(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

// Key includes the password hash: rotating the secret OR the password revokes every session.
async function hmac(c: Cfg, data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(c.secret + c.passwordHash), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

async function signToken(c: Cfg, username: string) {
  const now = Math.floor(Date.now() / 1000);
  const body = b64url(enc.encode(JSON.stringify({ username, iat: now, exp: now + c.ttlSeconds })).buffer as ArrayBuffer);
  return `${body}.${await hmac(c, body)}`;
}

async function verifyToken(c: Cfg, token?: string): Promise<SessionUser | null> {
  const [body, sig] = token?.split(".") ?? [];
  if (!body || !sig || !timingSafeEqual(sig, await hmac(c, body))) return null;
  try {
    const p = JSON.parse(fromB64url(body)) as SessionUser;
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

/** Handles POST {basePath}/login, POST {basePath}/logout, GET {basePath}/session. Returns null for other URLs. */
export function createAuthHandler(opts?: AuthOptions) {
  return async (request: Request): Promise<Response | null> => {
    const c = resolve(opts);
    const path = new URL(request.url).pathname;
    if (!path.startsWith(c.basePath + "/")) return null;
    const action = path.slice(c.basePath.length + 1);

    if (action === "session" && request.method === "GET") {
      const { user, setCookie } = await getSession(request, opts);
      return json({ user }, 200, setCookie);
    }
    if (action === "logout" && request.method === "POST") return json({ ok: true }, 200, cookie(c, "", 0));
    if (action !== "login" || request.method !== "POST") return null;

    const ip = ipOf(request);
    const now = Date.now();
    const entry = attempts.get(ip) ?? { count: 0, lockedUntil: 0 };
    if (entry.lockedUntil > now)
      return json({ error: `Too many attempts. Try again in ${Math.ceil((entry.lockedUntil - now) / 60000)} min.` }, 429);

    const body = (await request.json().catch(() => null)) as { username?: unknown; password?: unknown; remember?: unknown } | null;
    const username = typeof body?.username === "string" ? body.username.slice(0, 100) : "";
    const password = typeof body?.password === "string" ? body.password.slice(0, 200) : "";
    if (!username || !password) return json({ error: "Username and password are required." }, 400);

    const userOk = timingSafeEqual(username, c.username);
    const passOk = timingSafeEqual(await sha256Hex(`${c.salt}:${password}`), c.passwordHash);
    if (!userOk || !passOk) {
      entry.count += 1;
      if (entry.count >= c.maxAttempts) Object.assign(entry, { count: 0, lockedUntil: now + c.lockoutSeconds * 1000 });
      attempts.set(ip, entry);
      return json({ error: "Invalid credentials", attemptsLeft: c.maxAttempts - entry.count }, 401);
    }
    attempts.delete(ip);
    const token = await signToken(c, username);
    return json({ user: { username } }, 200, cookie(c, token, body?.remember ? c.ttlSeconds : undefined));
  };
}
